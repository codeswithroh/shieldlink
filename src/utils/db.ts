import type { ShieldLinkData, LedgerEntry } from '../hooks/useStarknetState';

const DB_NAME = 'shieldlink_v1';
const DB_VERSION = 2; // bumped: added recipientAddress index on links

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
