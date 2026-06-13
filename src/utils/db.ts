import type { ShieldLinkData, LedgerEntry } from '../hooks/useStarknetState';

const DB_NAME = 'shieldlink_v1';
const DB_VERSION = 3; // v3: payroll stores (orgs, recipients, payRuns)

// ─── Payroll types ────────────────────────────────────────────
export interface OrgRecord {
  id: string;          // uuid
  name: string;
  ownerAddress: string;
  createdAtMs: number;
}

export interface RecipientRecord {
  id: string;          // uuid
  orgId: string;
  label: string;       // "Alice — Engineering"
  walletAddress: string;
  addedAtMs: number;
}

export interface PayRunRecord {
  id: string;          // uuid
  orgId: string;
  ownerAddress: string;
  token: 'STRK' | 'USDC';
  recipients: Array<{ recipientId: string; walletAddress: string; label: string; amount: number }>;
  totalAmount: number;
  status: 'pending' | 'running' | 'done' | 'failed';
  createdAtMs: number;
  completedAtMs?: number;
  txHashes?: string[]; // one per recipient batch tx
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const tx = (e.target as IDBOpenDBRequest).transaction!;

      // Version 1 stores
      if (e.oldVersion < 1) {
        const ls = db.createObjectStore('links', { keyPath: 'id' });
        ls.createIndex('walletAddress', 'creatorAddress', { unique: false });
        const le = db.createObjectStore('ledger', { keyPath: 'id' });
        le.createIndex('walletAddress', 'walletAddress', { unique: false });
      }

      // Version 2: add recipientAddress index so incoming P2P links are queryable
      if (e.oldVersion < 2) {
        const ls = tx.objectStore('links');
        if (!ls.indexNames.contains('recipientAddress')) {
          ls.createIndex('recipientAddress', 'recipientAddress', { unique: false });
        }
      }

      // Version 3: payroll stores
      if (e.oldVersion < 3) {
        const orgs = db.createObjectStore('orgs', { keyPath: 'id' });
        orgs.createIndex('ownerAddress', 'ownerAddress', { unique: false });

        const recipients = db.createObjectStore('recipients', { keyPath: 'id' });
        recipients.createIndex('orgId', 'orgId', { unique: false });

        const payRuns = db.createObjectStore('payRuns', { keyPath: 'id' });
        payRuns.createIndex('orgId', 'orgId', { unique: false });
        payRuns.createIndex('ownerAddress', 'ownerAddress', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(store: IDBObjectStore, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbGetByIndex<T>(store: IDBObjectStore, indexName: string, value: IDBValidKey): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const index = store.index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

// ─── Public API ───────────────────────────────────────────────

/** Links created by this wallet */
export async function getLinks(walletAddress: string): Promise<ShieldLinkData[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('links', 'readonly');
    const store = tx.objectStore('links');
    idbGetByIndex<ShieldLinkData>(store, 'walletAddress', walletAddress)
      .then(rows => resolve(rows.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))))
      .catch(reject);
  });
}

/** Links where this wallet is the P2P recipient (incoming transfers) */
export async function getIncomingP2PLinks(walletAddress: string): Promise<ShieldLinkData[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('links', 'readonly');
    const store = tx.objectStore('links');
    idbGetByIndex<ShieldLinkData>(store, 'recipientAddress', walletAddress)
      .then(rows => resolve(rows.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))))
      .catch(reject);
  });
}

export async function saveLink(link: ShieldLinkData): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('links', 'readwrite');
    idbPut(tx.objectStore('links'), link).then(resolve).catch(reject);
  });
}

export async function updateLink(id: string, updates: Partial<ShieldLinkData>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('links', 'readwrite');
    const store = tx.objectStore('links');
    idbGet<ShieldLinkData>(store, id).then(existing => {
      if (!existing) { resolve(); return; }
      idbPut(store, { ...existing, ...updates }).then(resolve).catch(reject);
    }).catch(reject);
  });
}

export async function getLedger(walletAddress: string): Promise<LedgerEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ledger', 'readonly');
    const store = tx.objectStore('ledger');
    idbGetByIndex<LedgerEntry>(store, 'walletAddress', walletAddress)
      .then(rows => resolve(rows.sort((a, b) => b.id.localeCompare(a.id))))
      .catch(reject);
  });
}

export async function saveLedgerEntry(entry: LedgerEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ledger', 'readwrite');
    idbPut(tx.objectStore('ledger'), entry).then(resolve).catch(reject);
  });
}

// ─── Payroll API ──────────────────────────────────────────────

export async function getOrg(ownerAddress: string): Promise<OrgRecord | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('orgs', 'readonly');
    idbGetByIndex<OrgRecord>(tx.objectStore('orgs'), 'ownerAddress', ownerAddress)
      .then(rows => resolve(rows[0]))
      .catch(reject);
  });
}

export async function saveOrg(org: OrgRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('orgs', 'readwrite');
    idbPut(tx.objectStore('orgs'), org).then(resolve).catch(reject);
  });
}

export async function getRecipients(orgId: string): Promise<RecipientRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recipients', 'readonly');
    idbGetByIndex<RecipientRecord>(tx.objectStore('recipients'), 'orgId', orgId)
      .then(rows => resolve(rows.sort((a, b) => a.addedAtMs - b.addedAtMs)))
      .catch(reject);
  });
}

export async function saveRecipient(r: RecipientRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recipients', 'readwrite');
    idbPut(tx.objectStore('recipients'), r).then(resolve).catch(reject);
  });
}

export async function deleteRecipient(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recipients', 'readwrite');
    const req = tx.objectStore('recipients').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getPayRuns(orgId: string): Promise<PayRunRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('payRuns', 'readonly');
    idbGetByIndex<PayRunRecord>(tx.objectStore('payRuns'), 'orgId', orgId)
      .then(rows => resolve(rows.sort((a, b) => b.createdAtMs - a.createdAtMs)))
      .catch(reject);
  });
}

export async function savePayRun(run: PayRunRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('payRuns', 'readwrite');
    idbPut(tx.objectStore('payRuns'), run).then(resolve).catch(reject);
  });
}

// ─── One-time migration from localStorage ────────────────────
export async function migrateFromLocalStorage(walletAddress: string): Promise<void> {
  if (!walletAddress) return;
  const migKey = `sl_idb_migrated_${walletAddress}`;
  if (localStorage.getItem(migKey)) return;

  const rawLinks = localStorage.getItem('sl_links');
  const rawLedger = localStorage.getItem('sl_ledger');

  if (rawLinks) {
    try {
      const links: ShieldLinkData[] = JSON.parse(rawLinks);
      const mine = links.filter(l => !l.creatorAddress || l.creatorAddress === walletAddress);
      for (const link of mine) {
        await saveLink({ ...link, creatorAddress: walletAddress });
      }
    } catch { /* ignore */ }
  }

  if (rawLedger) {
    try {
      const entries: LedgerEntry[] = JSON.parse(rawLedger);
      for (const entry of entries) {
        await saveLedgerEntry({ ...entry, walletAddress });
      }
    } catch { /* ignore */ }
  }

  localStorage.setItem(migKey, '1');
}
