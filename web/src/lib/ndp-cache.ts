import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { z } from 'zod';

export const NDP_CACHE_DATABASE = 'clio.ndp-metadata.v1';
const STORE = 'queries';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_ENTRIES = 20;

type Entry = { id: string; updatedAt: number; bytes: number; payload: string };
type Saved<T> = { data: T; updatedAt: number };

function id(key: string): string {
  return bytesToHex(sha256(utf8ToBytes(key)));
}

async function open(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') return undefined;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NDP_CACHE_DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'id' });
      // Key cursors can evict by age/size without cloning every cached payload.
      store.createIndex('age', ['updatedAt', 'bytes']);
    };
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      resolve(undefined);
    };
  });
}

/** Restore validated metadata; unavailable or corrupt storage never blocks live reads. */
export async function readNdpCache<T>(
  key: string,
  schema: z.ZodType<T>,
): Promise<Saved<T> | undefined> {
  let db: IDBDatabase | undefined;
  try {
    db = await open();
    if (!db) return undefined;
    const entry = await new Promise<Entry | undefined>((resolve, reject) => {
      const request = db!.transaction(STORE).objectStore(STORE).get(id(key));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (
      !entry ||
      typeof entry.payload !== 'string' ||
      entry.payload.length > MAX_ENTRY_BYTES ||
      !Number.isFinite(entry.updatedAt) ||
      entry.updatedAt > Date.now() ||
      entry.updatedAt < Date.now() - MAX_AGE_MS
    )
      return undefined;
    const parsed = schema.safeParse(JSON.parse(entry.payload));
    return parsed.success ? { data: parsed.data, updatedAt: entry.updatedAt } : undefined;
  } catch {
    // Privacy modes, blocked storage and old schemas fall back to the existing query.
    return undefined;
  } finally {
    db?.close();
  }
}

/** Persist successful metadata queries under bounded storage, never credentials or file bytes. */
export async function writeNdpCache(key: string, data: unknown, updatedAt: number): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  let db: IDBDatabase | undefined;
  try {
    const payload = JSON.stringify(data);
    if (!payload || payload.length > MAX_ENTRY_BYTES || !Number.isFinite(updatedAt)) return;
    const bytes = new Blob([payload]).size;
    if (bytes > MAX_ENTRY_BYTES) return;
    db = await open();
    if (!db) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = db!.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      store.put({ id: id(key), updatedAt, bytes, payload } satisfies Entry);
      const entries: Array<Omit<Entry, 'payload'>> = [];
      const request = store.index('age').openKeyCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const [at, size] = cursor.key as [number, number];
          entries.push({ id: String(cursor.primaryKey), updatedAt: at, bytes: size });
          cursor.continue();
          return;
        }
        let total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
        let count = entries.length;
        for (const entry of entries) {
          if (
            entry.updatedAt < Date.now() - MAX_AGE_MS ||
            count > MAX_ENTRIES ||
            total > MAX_TOTAL_BYTES
          ) {
            store.delete(entry.id);
            total -= entry.bytes;
            count--;
          }
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch {
    // A quota/storage failure must not fail an otherwise successful catalog read.
  } finally {
    db?.close();
  }
}
