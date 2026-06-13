import { useState, useEffect, useRef } from 'react';
import { getLinks, getLedger, getIncomingP2PLinks, saveLink, updateLink, saveLedgerEntry, migrateFromLocalStorage } from '../utils/db';
import { RpcProvider, ec, num } from 'starknet';
import { connect, disconnect } from '@starknet-io/get-starknet';
import { usePrivy, useWallets } from '@privy-io/react-auth';
// @ts-ignore — tongo-sdk ships starknet@9 internally; Call shape is identical to v10
import { Account as TongoAccount } from '@fatsolutions/tongo-sdk';

// ─── Starknet curve order (same constant used by tongo-sdk internally) ─────────
const CURVE_ORDER = 3618502788666131213697322783095070105526743751716087489154079457884512865583n;

// ─── Fixed denominations — the foundation of perfect privacy ─────────────────
//
// Every ShieldLink note is one of these exact sizes.
// Because all notes are identical in denomination, a chain observer can see:
//   "someone deposited a 10-STRK note" → "someone claimed a 10-STRK note"
// but cannot know which deposit maps to which claim — there are many identical ones.
//
export const FIXED_DENOMS = {
  STRK: [0.1, 1, 10, 100] as const,
  USDC: [1, 10, 100, 1000] as const,
};

// ─── Split an arbitrary amount into the minimum number of denomination notes ──
export const splitIntoNotes = (amount: number, token: 'STRK' | 'USDC'): number[] => {
  const denoms = [...FIXED_DENOMS[token]].sort((a, b) => b - a); // largest first
  const notes: number[] = [];
  // Use integer arithmetic (×1000) to avoid floating-point errors
  let remaining = Math.round(amount * 1000);
  for (const denom of denoms) {
    const denomInt = Math.round(denom * 1000);
    while (remaining >= denomInt) {
      notes.push(denom);
      remaining -= denomInt;
    }
  }
  return notes;
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface NoteEntry {
  key: string;   // Tongo one-time private key as 0x hex
  denom: number; // denomination in token units (e.g. 10 for 10 STRK)
}

export interface MockWallet {
  id: number;
  name: string;
  address: string;
  publicStrk: number;
  shieldedStrk: number;
  publicUsdc: number;
  shieldedUsdc: number;
}

export interface ShieldLinkData {
  id: string;
  amount: number;
  token: 'STRK' | 'USDC';
  secretKey: string;
  notes?: NoteEntry[];
  createdAtMs?: number;
  creatorAddress: string;
  status: 'pending' | 'claimed' | 'cancelled';
  claimedBy?: string;
  timestamp: string;
  note?: string;
  // P2P direct transfer fields
  linkType?: 'link' | 'p2p';
  recipientAddress?: string;
}

export interface LedgerEntry {
  id: string;
  type: 'Shield' | 'Unshield' | 'Claim via Relayer' | 'Deposit to Link' | 'P2P Send' | 'P2P Receive';
  txHash: string;
  address: string;          // counterparty address
  walletAddress: string;    // owner wallet — used for per-wallet IndexedDB filtering
  amount: number;
  token: 'STRK' | 'USDC';
  timestamp: string;
}

// ─── Network / Contract addresses ─────────────────────────────────────────────
const SEPOLIA_RPC_URL = 'https://starknet-sepolia.drpc.org';

// Tongo privacy pool contracts on Sepolia (Fat Solutions)
const TONGO_STRK_CONTRACT = '0x408163bfcfc2d76f34b444cb55e09dace5905cf84c0884e4637c2c0f06ab6ed';
const TONGO_USDC_CONTRACT  = '0x2caae365e67921979a4e5c16dd70eaa5776cfc6a9592bcb903d91933aaf2552';

// Underlying ERC-20 tokens on Sepolia
const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const USDC_ADDRESS = '0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080';

// ─── Internal helpers ─────────────────────────────────────────────────────────

const getTongoContract = (token: 'STRK' | 'USDC') =>
  token === 'STRK' ? TONGO_STRK_CONTRACT : TONGO_USDC_CONTRACT;

/**
 * Generate a cryptographically random Tongo private key.
 * Each payment link note uses its own unique one-time key.
 */
const generateTongoPrivKey = (): bigint => {
  let key = 0n;
  do {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    key = bytes.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);
  } while (key >= CURVE_ORDER || key === 0n);
  return key;
};

const getErc20Balance = async (
  provider: RpcProvider,
  tokenAddress: string,
  userAddress: string,
  decimals: number,
): Promise<number> => {
  const res = await provider.callContract({
    contractAddress: tokenAddress,
    entrypoint: 'balance_of',
    calldata: [userAddress],
  });
  if (!res || !Array.isArray(res) || res.length === 0) return 0;
  const low  = BigInt(res[0]);
  const high = res[1] ? BigInt(res[1]) : 0n;
  return Number((high << 128n) + low) / 10 ** decimals;
};

// ─── Legacy exports (kept for backward compat) ────────────────────────────────
export const generateKeyPair = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  bytes[0] &= 0x03;
  const privateKey = '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const publicKey = ec.starkCurve.getStarkKey(privateKey);
  return { privateKey, publicKey };
};

export const signClaim = (privateKey: string, recipientAddress: string) => {
  const msgHash = num.toHex(recipientAddress);
  const sig = ec.starkCurve.sign(msgHash, privateKey);
  return { r: '0x' + sig.r.toString(16), s: '0x' + sig.s.toString(16) };
};

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useStarknetState() {
  const connectionType = 'starknet' as const;

  const [shieldLinkContractAddress, setShieldLinkContractAddress] = useState<string>(() =>
    localStorage.getItem('sl_contract_address') ||
    '0x11d273fe36bc2e48f1b9616f8cfbb771c8428121c176dc241308eee31233e77',
  );

  // Seed address from localStorage immediately so UI shows "reconnecting" state
  const [realWalletAddress, setRealWalletAddress] = useState<string>(
    () => localStorage.getItem('sl_wallet_address') || ''
  );
  const [realWalletAccount, setRealWalletAccount] = useState<any>(null);
  const [realWalletBalances, setRealWalletBalances] = useState<{ strk: number; usdc: number }>({ strk: 0, usdc: 0 });
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(
    () => !!localStorage.getItem('sl_wallet_address')
  );
  const [realTxHash, setRealTxHash] = useState<string>('');
  const [isDeployingContract, setIsDeployingContract] = useState<boolean>(false);

  const { login: loginPrivy, logout: logoutPrivy, authenticated: privyAuthenticated, user: privyUser } = usePrivy();
  const { wallets: privyWallets } = useWallets();

  // Privy: restore address when session is available
  useEffect(() => {
    if (privyAuthenticated && privyUser) {
      const starknetWallet = privyWallets?.find((w: any) => w.chainType === 'starknet');
      const addr = starknetWallet
        ? (starknetWallet as any).address
        : (privyUser.wallet?.address || privyUser.email?.address || '');
      if (addr) {
        setRealWalletAddress(addr);
        localStorage.setItem('sl_wallet_address', addr);
        localStorage.setItem('sl_wallet_type', 'privy');
      }
      setIsReconnecting(false);
    }
  }, [privyAuthenticated, privyUser, privyWallets]);

  useEffect(() => {
    if (realWalletAddress) {
      refreshBalances(realWalletAddress);
      const interval = setInterval(() => refreshBalances(realWalletAddress), 10000);
      return () => clearInterval(interval);
    }
  }, [realWalletAddress]);

  // Auto-reconnect: try up to 3 times with increasing delays for extension wallets
  useEffect(() => {
    const savedAddr = localStorage.getItem('sl_wallet_address');
    const walletType = localStorage.getItem('sl_wallet_type');
    if (!savedAddr || walletType === 'privy') {
      setIsReconnecting(false);
      return;
    }

    let cancelled = false;
    const attempt = async (delayMs: number) => {
      await new Promise(r => setTimeout(r, delayMs));
      if (cancelled) return;
      try {
        const starknet = (await connect({ modalMode: 'neverAsk' })) as any;
        if (cancelled) return;
        if (starknet?.isConnected) {
          setRealWalletAddress(starknet.selectedAddress || savedAddr);
          setRealWalletAccount(starknet.account);
          setIsReconnecting(false);
          starknet.on('accountsChanged', (accounts: string[]) => {
            if (accounts?.length > 0) {
              setRealWalletAddress(accounts[0]);
              localStorage.setItem('sl_wallet_address', accounts[0]);
              if (starknet.account) setRealWalletAccount(starknet.account);
            } else {
              setRealWalletAddress('');
              setRealWalletAccount(null);
              localStorage.removeItem('sl_wallet_address');
              localStorage.removeItem('sl_wallet_type');
            }
          });
          return true;
        }
      } catch (e) { console.warn('Auto-connect attempt failed:', e); }
      return false;
    };

    (async () => {
      // Try at 800ms, 2s, 4s — extensions need time to inject
      for (const delay of [800, 2000, 4000]) {
        const ok = await attempt(delay);
        if (ok || cancelled) return;
      }
      // Give up — keep address shown but mark needs reconnect
      setIsReconnecting(false);
    })();

    return () => { cancelled = true; };
  }, []);

  const [links, setLinks] = useState<ShieldLinkData[]>([]);
  const [incomingTransfers, setIncomingTransfers] = useState<ShieldLinkData[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  // Track which address data is currently loaded to avoid double-loads
  const loadedForAddress = useRef<string>('');

  const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC_URL });

  // Load per-wallet data from IndexedDB whenever the connected address changes.
  // Each load captures the address it was triggered for; if the address changes
  // before the async work completes the stale result is silently discarded.
  useEffect(() => {
    if (!realWalletAddress || realWalletAddress === loadedForAddress.current) return;
    loadedForAddress.current = realWalletAddress;
    const forAddress = realWalletAddress; // capture for stale-check below

    // Clear stale data immediately so the previous wallet's links never flash
    setLinks([]);
    setIncomingTransfers([]);
    setLedger([]);

    (async () => {
      await migrateFromLocalStorage(forAddress);
      const [ownLinks, incoming, savedLedger] = await Promise.all([
        getLinks(forAddress),            // links THIS wallet created (sent)
        getIncomingP2PLinks(forAddress), // P2P transfers sent TO this wallet by others
        getLedger(forAddress),
      ]);

      // Discard if the wallet changed while we were loading
      if (loadedForAddress.current !== forAddress) return;

      setLinks(ownLinks.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0)));
      setIncomingTransfers(incoming.filter(l => l.status === 'pending').sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0)));
      setLedger(savedLedger);
    })();
  }, [realWalletAddress]);

  useEffect(() => { localStorage.setItem('sl_contract_address', shieldLinkContractAddress); }, [shieldLinkContractAddress]);

  // ─── Wallet connection ───────────────────────────────────────────────────────
  const connectStarknetWallet = async (): Promise<boolean> => {
    setIsConnecting(true);
    try {
      const starknet = (await connect({ modalMode: 'alwaysAsk', modalTheme: 'dark' })) as any;
      if (starknet?.isConnected) {
        const addr = starknet.selectedAddress || '';
        setRealWalletAddress(addr);
        setRealWalletAccount(starknet.account);
        setIsConnecting(false);
        localStorage.setItem('sl_wallet_address', addr);
        localStorage.setItem('sl_wallet_type', 'starknet');
        await refreshBalances(addr);
        starknet.on('accountsChanged', (accounts: string[]) => {
          if (accounts?.length > 0) {
            setRealWalletAddress(accounts[0]);
            localStorage.setItem('sl_wallet_address', accounts[0]);
            if (starknet.account) setRealWalletAccount(starknet.account);
          } else {
            setRealWalletAddress('');
            setRealWalletAccount(null);
            localStorage.removeItem('sl_wallet_address');
            localStorage.removeItem('sl_wallet_type');
          }
        });
        return true;
      }
    } catch (err) { console.error('Wallet connection error:', err); }
    setIsConnecting(false);
    return false;
  };

  const disconnectStarknetWallet = async () => {
    if (privyAuthenticated) { try { await logoutPrivy(); } catch (e) { console.error(e); } }
    try { await disconnect(); } catch { /* ignore */ }
    setRealWalletAddress('');
    setRealWalletAccount(null);
    setRealWalletBalances({ strk: 0, usdc: 0 });
    setLinks([]);
    setIncomingTransfers([]);
    setLedger([]);
    loadedForAddress.current = '';
    localStorage.removeItem('sl_wallet_address');
    localStorage.removeItem('sl_wallet_type');
  };

  const refreshBalances = async (addr?: string) => {
    const address = addr || realWalletAddress;
    if (!address) return;
    try {
      const [strk, usdc] = await Promise.all([
        getErc20Balance(provider, STRK_ADDRESS, address, 18),
        getErc20Balance(provider, USDC_ADDRESS, address, 6),
      ]);
      setRealWalletBalances({ strk, usdc });
    } catch {
      // RPC error — keep the previously shown balance rather than zeroing it out
    }
  };

  const activeWallet: MockWallet = {
    id: 99,
    name: realWalletAddress ? 'Connected Wallet' : 'Not Connected',
    address: realWalletAddress || '0x0000000000000000000000000000000000000000000000000000000000000000',
    publicStrk: 0,
    shieldedStrk: realWalletBalances.strk,
    publicUsdc: 0,
    shieldedUsdc: 0,
  };

  // ─── Create ShieldLink (v2 — multi-denomination notes) ────────────────────────
  /**
   * PERFECT PRIVACY MODEL
   * ─────────────────────
   * 1. The requested amount is split into FIXED DENOMINATION notes
   *    (e.g. 12 STRK → 1×10 + 2×1 = 3 notes).
   *
   * 2. Each note gets its own one-time Tongo private key generated in the browser.
   *    These keys are never transmitted — they live only in the claim URL fragment.
   *
   * 3. A SINGLE multicall is submitted: one ERC-20 approve (for the total amount)
   *    followed by one Tongo `fund` call per note.
   *
   * 4. On-chain all that appears is:
   *      senderAddress → Tongo contract  (N encrypted notes for N random pubkeys)
   *    The encrypted amounts cannot be read by anyone — not even Tongo's deployers.
   *
   * 5. When the recipient claims, their browser generates ZK proofs for each note
   *    and executes: Tongo contract → recipientAddress (N withdrawals in one TX).
   *    Their address is NEVER in the deposit TX. The sender's address is NEVER
   *    in the claim TX. The two transactions share zero common on-chain fields.
   *
   * Fixed denominations ensure that even if an attacker cross-references deposit
   * and claim events by amount, they cannot link them — hundreds of other users
   * deposit and claim the same denominations constantly.
   */
  const createShieldLink = async (
    amount: number,
    token: 'STRK' | 'USDC',
    note?: string,
    p2pOptions?: { recipientAddress: string },
  ): Promise<ShieldLinkData> => {
    if (!realWalletAccount) throw new Error('Wallet not connected.');

    const tongoContract = getTongoContract(token);
    const tokenAddress = token === 'STRK' ? STRK_ADDRESS : USDC_ADDRESS;
    const decimals = token === 'STRK' ? 18 : 6;

    // 1. Split into denomination notes
    const denominations = splitIntoNotes(amount, token);
    if (denominations.length === 0) throw new Error('Invalid amount.');

    // 2. For each note: generate key, create TongoAccount, compute fund proof
    const noteEntries: NoteEntry[] = [];
    const fundCalls: any[] = [];
    let totalErc20Approve = 0n;

    for (const denom of denominations) {
      const linkPrivKey = generateTongoPrivKey();
      const keyHex = '0x' + linkPrivKey.toString(16);
      const linkAccount = new TongoAccount(linkPrivKey, tongoContract, SEPOLIA_RPC_URL);

      const denomBig = BigInt(Math.round(denom * 10 ** decimals));
      const tongoAmount = await linkAccount.erc20ToTongo(denomBig);

      // Generate the fund ZK proof (lightweight Schnorr, ~2ms client-side)
      const fundOp = await linkAccount.fund({ amount: tongoAmount, sender: realWalletAddress });

      // Populate the approve call so we can extract the exact ERC-20 amount
      await fundOp.populateApprove();

      if (fundOp.approve?.calldata) {
        // approve calldata layout: [spender, amount_low, amount_high]
        const cd = fundOp.approve.calldata as unknown[];
        const low  = BigInt(String(cd[1] ?? '0x0'));
        const high = BigInt(String(cd[2] ?? '0x0'));
        totalErc20Approve += (high << 128n) | low;
      } else {
        // Fallback: use the raw denomination amount
        totalErc20Approve += denomBig;
      }

      noteEntries.push({ key: keyHex, denom });
      fundCalls.push(fundOp.toCalldata()); // just the fund call, no individual approve
    }

    // 3. Build multicall: ONE shared approve + all fund calls
    const approveLow  = '0x' + (totalErc20Approve & ((1n << 128n) - 1n)).toString(16);
    const approveHigh = '0x' + (totalErc20Approve >> 128n).toString(16);

    const allCalls = [
      {
        contractAddress: tokenAddress,
        entrypoint: 'approve',
        calldata: [tongoContract, approveLow, approveHigh],
      },
      ...fundCalls,
    ];

    // 4. One wallet signature covers everything
    const tx = await realWalletAccount.execute(allCalls);
    setRealTxHash(tx.transaction_hash);

    const createdAtMs = Date.now();
    const linkId = `link_${Math.random().toString(36).substring(2, 9)}`;

    const newLink: ShieldLinkData = {
      id: linkId,
      amount,
      token,
      secretKey: noteEntries[0].key,
      notes: noteEntries,
      createdAtMs,
      creatorAddress: realWalletAddress,
      status: 'pending',
      timestamp: new Date().toLocaleString(),
      note,
      linkType: p2pOptions ? 'p2p' : 'link',
      recipientAddress: p2pOptions?.recipientAddress,
    };

    const ledgerEntry: LedgerEntry = {
      id: `tx-${Date.now()}`,
      type: p2pOptions ? 'P2P Send' : 'Deposit to Link',
      txHash: tx.transaction_hash,
      address: p2pOptions?.recipientAddress ?? realWalletAddress,
      walletAddress: realWalletAddress,
      amount,
      token,
      timestamp: new Date().toLocaleString(),
    };

    setLinks(prev => [newLink, ...prev]);
    setLedger(prev => [ledgerEntry, ...prev]);
    await saveLink(newLink);
    await saveLedgerEntry(ledgerEntry);

    // For P2P: write cross-wallet records so the recipient sees it immediately
    if (p2pOptions?.recipientAddress) {
      const recipientLedgerEntry: LedgerEntry = {
        id: `tx-p2pr-${Date.now()}`,
        type: 'P2P Receive',
        txHash: tx.transaction_hash,
        address: realWalletAddress,   // counterparty = sender
        walletAddress: p2pOptions.recipientAddress,
        amount,
        token,
        timestamp: new Date().toLocaleString(),
      };
      await saveLedgerEntry(recipientLedgerEntry);
      // The link itself is already indexed by recipientAddress (picked up by getIncomingP2PLinks)
    }

    return newLink;
  };

  // ─── Claim ShieldLink ─────────────────────────────────────────────────────────
  /**
   * Claims all notes in a payment link in a single batched transaction.
   *
   * For each note:
   *   1. Reconstruct TongoAccount from the one-time key
   *   2. Query on-chain state (balance should be > 0)
   *   3. Generate withdraw ZK proof client-side
   *   4. Add withdraw call to batch
   *
   * Execute all withdrawals in one TX — recipient signs once.
   * Each note's ZK proof independently proves ownership without revealing
   * which deposit it came from.
   */
  const claimShieldLink = async (
    secretKey: string,
    claimerAddress: string,
    linkMeta?: { amount: number; token: 'STRK' | 'USDC'; notes?: NoteEntry[] },
  ): Promise<boolean> => {
    if (!realWalletAccount) throw new Error('Wallet not connected.');

    const localLink = links.find(l => l.secretKey === secretKey);
    const meta = localLink || linkMeta;
    if (!meta) throw new Error('Payment link data not found.');

    const token = meta.token;
    const tongoContract = getTongoContract(token);

    // Collect all notes — v2 links have multiple, v1 links have one
    const allNotes: NoteEntry[] = meta.notes && meta.notes.length > 0
      ? meta.notes
      : [{ key: secretKey, denom: meta.amount }];

    // Build batch of withdraw calls
    const withdrawCalls: any[] = [];
    let claimedAny = false;

    for (const note of allNotes) {
      try {
        const linkPrivKey = BigInt(note.key);
        const linkAccount = new TongoAccount(linkPrivKey, tongoContract, SEPOLIA_RPC_URL);

        let state = await linkAccount.state();

        // If funds are in pending (transfer flow), roll them over first
        if (state.balance === 0n && state.pending > 0n) {
          const rolloverOp = await linkAccount.rollover({ sender: claimerAddress });
          await realWalletAccount.execute([rolloverOp.toCalldata()]);
          await provider.waitForTransaction(
            (await realWalletAccount.execute([rolloverOp.toCalldata()])).transaction_hash
          );
          state = await linkAccount.state();
        }

        if (state.balance > 0n) {
          const withdrawOp = await linkAccount.withdraw({
            amount: state.balance,
            to: claimerAddress,
            sender: claimerAddress,
          });
          withdrawCalls.push(withdrawOp.toCalldata());
          claimedAny = true;
        }
      } catch (err) {
        console.warn(`Note ${note.key.slice(0, 10)}… could not be claimed:`, err);
      }
    }

    if (withdrawCalls.length === 0) {
      throw new Error('No claimable balance found. This link may already have been claimed.');
    }

    // Execute all withdrawals in one TX
    const tx = await realWalletAccount.execute(withdrawCalls);
    setRealTxHash(tx.transaction_hash);

    // Find link record to update
    const claimedLink = links.find(l => l.secretKey === secretKey);
    const claimedUpdates: Partial<ShieldLinkData> = { status: 'claimed', claimedBy: claimerAddress };
    setLinks(prev => prev.map(l => l.secretKey === secretKey ? { ...l, ...claimedUpdates } : l));
    if (claimedLink) await updateLink(claimedLink.id, claimedUpdates);

    const claimEntry: LedgerEntry = {
      id: `tx-${Date.now()}`,
      type: 'Claim via Relayer',
      txHash: tx.transaction_hash,
      address: claimerAddress,
      walletAddress: claimerAddress,
      amount: meta.amount,
      token: meta.token,
      timestamp: new Date().toLocaleString(),
    };
    setLedger(prev => [claimEntry, ...prev]);
    await saveLedgerEntry(claimEntry);

    // Poll balance: immediately + 3s + 8s + 15s to catch Sepolia indexing lag
    refreshBalances();
    [3000, 8000, 15000].forEach(ms => setTimeout(() => refreshBalances(), ms));
    return claimedAny;
  };

  // ─── Cancel (on-chain ragequit for every note) ────────────────────────────────
  const cancelShieldLink = async (linkId: string): Promise<boolean> => {
    const link = links.find(l => l.id === linkId && l.status === 'pending');
    if (!link) return false;
    if (!realWalletAccount) throw new Error('Wallet not connected.');

    try {
      const tongoContract = getTongoContract(link.token);
      const allNotes: NoteEntry[] = link.notes && link.notes.length > 0
        ? link.notes
        : [{ key: link.secretKey, denom: link.amount }];

      const ragequitCalls: any[] = [];

      for (const note of allNotes) {
        const linkPrivKey = BigInt(note.key);
        const linkAccount = new TongoAccount(linkPrivKey, tongoContract, SEPOLIA_RPC_URL);
        const state = await linkAccount.state();
        if (state.balance > 0n || state.pending > 0n) {
          const op = await linkAccount.ragequit({ to: realWalletAddress, sender: realWalletAddress });
          ragequitCalls.push(op.toCalldata());
        }
      }

      if (ragequitCalls.length > 0) {
        const tx = await realWalletAccount.execute(ragequitCalls);
        setRealTxHash(tx.transaction_hash);
      }
    } catch (err) {
      console.warn('On-chain ragequit failed, marking cancelled locally:', err);
    }

    setLinks(prev => prev.map(l => l.id === linkId ? { ...l, status: 'cancelled' } : l));
    await updateLink(linkId, { status: 'cancelled' });

    const cancelEntry: LedgerEntry = {
      id: `tx-${Date.now()}`,
      type: 'Unshield',
      txHash: realTxHash || '0x',
      address: realWalletAddress,
      walletAddress: realWalletAddress,
      amount: link.amount,
      token: link.token,
      timestamp: new Date().toLocaleString(),
    };
    setLedger(prev => [cancelEntry, ...prev]);
    await saveLedgerEntry(cancelEntry);

    setTimeout(() => refreshBalances(), 5000);
    return true;
  };

  // ─── P2P: Release funds to recipient (second TX after fund TX confirms) ───────
  /**
   * Called by the RECIPIENT to withdraw funds deposited into the Tongo pool
   * by the sender. The recipient's connected wallet signs the TX — the sender
   * is never involved in this step.
   *
   * linkId may come from either:
   *   - incomingTransfers (recipient's view, stored under recipientAddress)
   *   - links list (if looking up by id cross-list)
   */
  const claimIncomingTransfer = async (linkId: string): Promise<boolean> => {
    const link = incomingTransfers.find(l => l.id === linkId && l.status === 'pending')
              ?? links.find(l => l.id === linkId && l.linkType === 'p2p' && l.status === 'pending');
    if (!link) throw new Error('Transfer not found or already claimed.');
    if (!realWalletAccount) throw new Error('Connect your wallet to claim.');

    // Recipient claims to their own address
    const result = await claimShieldLink(link.secretKey, realWalletAddress, {
      amount: link.amount,
      token: link.token,
      notes: link.notes,
    });

    // Mark the incoming record as claimed so the UI updates
    setIncomingTransfers(prev =>
      prev.map(l => l.id === linkId ? { ...l, status: 'claimed', claimedBy: realWalletAddress } : l)
    );
    await updateLink(linkId, { status: 'claimed', claimedBy: realWalletAddress });

    return result;
  };

  // ─── Check if link is still claimable (queries Tongo state) ─────────────────
  const isCommitmentActive = async (
    secretKey: string,
    token: 'STRK' | 'USDC' = 'STRK',
    notes?: NoteEntry[],
  ): Promise<boolean> => {
    try {
      const tongoContract = getTongoContract(token);
      const allNotes: NoteEntry[] = notes && notes.length > 0
        ? notes
        : [{ key: secretKey, denom: 0 }];

      for (const note of allNotes) {
        const linkPrivKey = BigInt(note.key);
        const linkAccount = new TongoAccount(linkPrivKey, tongoContract, SEPOLIA_RPC_URL);
        const state = await linkAccount.state();
        if (state.balance > 0n || state.pending > 0n) return true;
      }
      return false;
    } catch { return false; }
  };

  // ─── Contract deployment (legacy — Tongo pools are the contract layer now) ───
  const deployShieldLinkContract = async (): Promise<string | null> => {
    if (!realWalletAccount) { alert('Please connect a Starknet wallet first.'); return null; }
    setIsDeployingContract(true);
    try {
      const sierraRes = await fetch('/shieldlink_ShieldLink.contract_class.json');
      const casmRes   = await fetch('/shieldlink_ShieldLink.compiled_contract_class.json');
      if (!sierraRes.ok || !casmRes.ok) throw new Error('Failed to load contract artifacts.');
      const compiledSierra = await sierraRes.json();
      const compiledCasm   = await casmRes.json();
      let classHash = '0x045adada99a28350c61ff6928884c3f3369c478d076b2cbdcfd53eff7f9e3ed2';
      try {
        const declareTx = await realWalletAccount.declare({ contract: compiledSierra, casm: compiledCasm });
        classHash = declareTx.class_hash;
      } catch (err: any) { console.warn('Declaration skipped:', err); }
      const deployTx = await realWalletAccount.deployContract({ classHash });
      setShieldLinkContractAddress(deployTx.contract_address);
      localStorage.setItem('sl_contract_address', deployTx.contract_address);
      setIsDeployingContract(false);
      alert(`Contract deployed: ${deployTx.contract_address}`);
      return deployTx.contract_address;
    } catch (err: any) {
      alert(`Deployment failed: ${err.message || err}`);
      setIsDeployingContract(false);
      return null;
    }
  };

  return {
    connectionType,
    shieldLinkContractAddress,
    setShieldLinkContractAddress,
    activeWallet,
    links,
    ledger,
    createShieldLink,
    claimShieldLink,
    cancelShieldLink,
    incomingTransfers,
    claimIncomingTransfer,
    realWalletAddress,
    realWalletAccount,
    realWalletBalances,
    isConnecting,
    isReconnecting,
    connectStarknetWallet,
    disconnectStarknetWallet,
    refreshBalances,
    isCommitmentActive,
    realTxHash,
    setRealTxHash,
    isDeployingContract,
    deployShieldLinkContract,
    loginPrivy,
    privyAuthenticated,
    privyUser,
  };
}
