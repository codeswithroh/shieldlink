#!/usr/bin/env node
/**
 * ShieldLink — Sepolia Deployment (starknet.js v10 + drpc.org positional-param patch)
 */
const fs = require('fs');
const path = require('path');
const { RpcProvider, Account, Signer, hash, CallData } = require('starknet');

const PROJECT_DIR = path.resolve(__dirname, '..');
const CONTRACT_DIR = path.join(PROJECT_DIR, 'contracts');
const HOOK_SRC = path.join(PROJECT_DIR, 'src/hooks/useStarknetState.ts');

const RPC_URL     = 'https://starknet-sepolia.drpc.org';
const PRIVATE_KEY = '0x031e524a903ec22efb816f074cbafde979566cc772432ecbe790cceea8717b3e';
const DEPLOYER    = '0x0714241cbb9d97874f28399063c6c5946659c4ad78b34a0b730dbbf113a9c1d8';
const PUBLIC_KEY  = '0x4a595e43a7b83441baabd9103f4e1045f6a647965c244087d8dc14685b25856';
const STRK        = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const OZ_CLASS    = '0x05b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564';
const ACCOUNT_SALT = '0x2a5eb19db5a8e2cb64b3e73ae703215239d2cfb65fa86bdb4856718142a7698';

// ── drpc.org positional-params transformer ────────────────────────────────────
// drpc.org ONLY accepts positional arrays, not named-param objects.
// Map: method → function(namedParams) → positionalArray
const NAMED_TO_POS = {
  starknet_call:                  p => [p.request, p.block_id ?? 'latest'],
  starknet_getNonce:              p => [p.block_id ?? 'latest', p.contract_address],
  starknet_getClassHashAt:        p => [p.block_id ?? 'latest', p.contract_address],
  starknet_getTransactionReceipt: p => [p.transaction_hash],
  starknet_getBlockWithTxHashes:  p => [p.block_id ?? 'latest'],
  starknet_chainId:               _p => [],
  starknet_addDeclareTransaction:  p => [p.declare_transaction],
  starknet_addDeployAccountTransaction: p => [p.deploy_account_transaction],
  starknet_addInvokeTransaction:  p => [p.invoke_transaction],
  starknet_estimateFee:           p => [p.request, p.simulation_flags ?? [], p.block_id ?? 'latest'],
  starknet_simulateTransactions:  p => [p.transactions, p.simulation_flags ?? [], p.block_id ?? 'latest'],
  starknet_getStorageAt:          p => [p.contract_address, p.key, p.block_id ?? 'latest'],
  starknet_getClassAt:            p => [p.block_id ?? 'latest', p.contract_address],
  starknet_getClass:              p => [p.block_id ?? 'latest', p.class_hash],
  starknet_getTransactionByHash:  p => [p.transaction_hash],
  starknet_blockHashAndNumber:    _p => [],
};

function toPositional(method, params) {
  if (!params) return undefined;
  if (Array.isArray(params)) return params; // already positional
  const fn = NAMED_TO_POS[method];
  if (fn) {
    try { return fn(params); }
    catch { /* fall through to named */ }
  }
  // Fallback: wrap in array (for methods we haven't explicitly listed)
  return [params];
}

// ── Raw RPC helper ─────────────────────────────────────────────────────────────
async function rpc(method, namedParams) {
  const params = toPositional(method, namedParams);
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message} (${JSON.stringify(json.error.data || '')})`);
  return json.result;
}

/** Poll until finalized */
async function waitForTx(txHash, maxWaitMs = 300000, intervalMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const receipt = await rpc('starknet_getTransactionReceipt', { transaction_hash: txHash });
      const fs2 = receipt?.finality_status;
      if (fs2 === 'ACCEPTED_ON_L2' || fs2 === 'ACCEPTED_ON_L1') {
        if (receipt.execution_status === 'REVERTED')
          throw new Error(`Tx REVERTED: ${receipt.revert_reason || 'unknown'}`);
        return receipt;
      }
    } catch (e) {
      const msg = e.message || '';
      if (!msg.includes('Transaction hash not found') && !msg.includes('starknet_getTransactionReceipt')) throw e;
    }
    await new Promise(r => setTimeout(r, intervalMs));
    process.stdout.write('.');
  }
  throw new Error(`Tx ${txHash} not confirmed within ${maxWaitMs}ms`);
}

async function main() {
  console.log('=== ShieldLink Deployment ===');
  console.log(`RPC     : ${RPC_URL}`);
  console.log(`Deployer: ${DEPLOYER}`);

  // ── Set up provider with channel patched for drpc.org positional params ──────
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  provider.getEstimateTip = async () => ({ medium: 0n, fast: 0n, slow: 0n });
  provider.waitForTransaction = (txHash) => waitForTx(txHash);

  // Patch the channel's fetch to transform named→positional params
  const originalFetch = provider.channel.fetch.bind(provider.channel);
  provider.channel.fetch = async (method, params, id) => {
    const positionalParams = toPositional(method, params);
    return originalFetch(method, positionalParams, id);
  };

  const account = new Account({
    provider,
    address: DEPLOYER,
    signer: new Signer(PRIVATE_KEY),
  });

  // Resource bounds: set based on actual gas prices (checked live)
  // l1 price ~1.03e14, l1_data ~4.5e11, l2 ~8e9 FRI/unit
  // Max fee: 50k*2e14 + 2M*2e10 + 100k*1e12 ≈ 10.14 STRK
  const GAS_BOUNDS = {
    tip: 0n,
    resourceBounds: {
      l2_gas:      { max_amount: 2000000n, max_price_per_unit: 20000000000n },
      l1_gas:      { max_amount: 50000n,   max_price_per_unit: 200000000000000n },
      l1_data_gas: { max_amount: 100000n,  max_price_per_unit: 1000000000000n },
    },
  };

  // ── 1. Balance check ──────────────────────────────────────────────────────────
  console.log('\n[ 1/4 ] Checking STRK balance...');
  const balRes = await rpc('starknet_call', {
    request: {
      contract_address: STRK,
      entry_point_selector: '0x2e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e',
      calldata: [DEPLOYER],
    },
    block_id: 'latest',
  });
  const balance = (BigInt(balRes[1] || '0x0') << 128n) + BigInt(balRes[0]);
  console.log(`Balance : ${(Number(balance) / 1e18).toFixed(4)} STRK`);
  if (balance < 10000000000000000n) {
    console.error('✗ Insufficient balance'); process.exit(1);
  }

  // ── 2. OZ account (already deployed) ─────────────────────────────────────────
  console.log('\n[ 2/4 ] Checking OZ account...');
  try {
    await provider.getClassHashAt(DEPLOYER);
    console.log('✓ Account already deployed');
  } catch {
    console.log('Deploying account...');
    const { transaction_hash } = await account.deployAccount({
      classHash: OZ_CLASS,
      constructorCalldata: CallData.compile({ public_key: PUBLIC_KEY }),
      addressSalt: ACCOUNT_SALT,
      ...GAS_BOUNDS,
    });
    console.log(`Tx: ${transaction_hash}`);
    process.stdout.write('Waiting');
    await waitForTx(transaction_hash);
    console.log('\n✓ Account deployed');
  }

  // ── 3. Declare ShieldLink class ───────────────────────────────────────────────
  console.log('\n[ 3/4 ] Declaring ShieldLink contract class...');
  const sierraPath = path.join(CONTRACT_DIR, 'target/dev/shieldlink_ShieldLink.contract_class.json');
  const casmPath   = path.join(CONTRACT_DIR, 'target/dev/shieldlink_ShieldLink.compiled_contract_class.json');
  const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf8'));
  const casm   = JSON.parse(fs.readFileSync(casmPath, 'utf8'));

  let classHash;
  try {
    const { transaction_hash, class_hash } = await account.declare({ contract: sierra, casm }, GAS_BOUNDS);
    classHash = class_hash;
    console.log(`\nDeclare tx : ${transaction_hash}`);
    process.stdout.write('Waiting');
    await waitForTx(transaction_hash);
    console.log('');
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.match(/already declared|ClassAlreadyDeclared/i)) {
      classHash = hash.computeSierraContractClassHash(sierra);
      console.log('Already declared');
    } else {
      console.error('\nDeclare error:', msg.substring(0, 500));
      throw err;
    }
  }
  console.log(`✓ Class hash : ${classHash}`);

  // ── 4. Deploy ShieldLink instance ─────────────────────────────────────────────
  console.log('\n[ 4/4 ] Deploying ShieldLink instance...');
  let contractAddress;
  try {
    const { transaction_hash, contract_address } = await account.deploy({
      classHash,
      constructorCalldata: [],
      salt: '0x1',
      ...GAS_BOUNDS,
    });
    contractAddress = contract_address;
    console.log(`Deploy tx  : ${transaction_hash}`);
    process.stdout.write('Waiting');
    await waitForTx(transaction_hash);
    console.log('');
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.match(/already deployed|ContractAddressAlreadyDeployed/i)) {
      contractAddress = hash.calculateContractAddressFromHash('0x1', classHash, [], DEPLOYER);
      console.log('Already deployed at:', contractAddress);
    } else {
      console.error('\nDeploy error:', msg.substring(0, 500));
      throw err;
    }
  }
  console.log(`✓ Contract : ${contractAddress}`);

  // ── 5. Patch app ───────────────────────────────────────────────────────────────
  console.log('\n[ ✓ ] Patching src/hooks/useStarknetState.ts...');
  let src = fs.readFileSync(HOOK_SRC, 'utf8');
  src = src.replace(/return saved \|\| '0x[0-9a-fA-F]+';/, `return saved || '${contractAddress}';`);
  fs.writeFileSync(HOOK_SRC, src);

  console.log(`
╔══════════════════════════════════════════════════════╗
║  🎉  Deployment Complete!                            ║
╠══════════════════════════════════════════════════════╣
║  Contract : ${contractAddress.padEnd(40)} ║
║  App      : http://localhost:5174                    ║
╚══════════════════════════════════════════════════════╝
`);
}

main().catch(err => {
  console.error('\n✗ Failed:', err?.message || err);
  process.exit(1);
});
