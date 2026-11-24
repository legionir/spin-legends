import { SAVE_SCHEMA_VERSION, createDefaultSaveData } from '../domain/rules';
import { sanitizeAndMigrateSave } from '../domain/saveValidation';
import type { PlayerSaveData } from '../domain/types';

export { sanitizeAndMigrateSave };

const DB_NAME = 'SpinLegendsDB';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const PRIMARY_KEY = 'player_primary';
const BACKUP_KEY = 'player_backup';
const LS_FALLBACK_KEY = 'spin_legends_save_v1';

let storageDegradedReason: string | null = null;

export function getStorageStatus(): { degraded: boolean; reason: string | null } {
  return { degraded: storageDegradedReason !== null, reason: storageDegradedReason };
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export function exportSaveToJson(save: PlayerSaveData): string {
  return JSON.stringify(save, null, 2);
}

export function importSaveFromJson(jsonText: string): {
  save: PlayerSaveData | null;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonText);
    const migrated = sanitizeAndMigrateSave(parsed);
    if (!migrated) {
      return { save: null, error: 'Invalid or corrupted Spin Legends save file format.' };
    }
    return { save: migrated };
  } catch {
    return { save: null, error: 'Unable to parse JSON save file.' };
  }
}

export async function loadPlayerSave(): Promise<PlayerSaveData> {
  const db = await openDatabase();
  if (db) {
    const primary = await idbGet(db, PRIMARY_KEY);
    const validPrimary = sanitizeAndMigrateSave(primary);
    if (validPrimary) {
      db.close();
      storageDegradedReason = null;
      return validPrimary;
    }
    const backup = await idbGet(db, BACKUP_KEY);
    const validBackup = sanitizeAndMigrateSave(backup);
    db.close();
    if (validBackup) return validBackup;
  }

  try {
    const lsRaw = localStorage.getItem(LS_FALLBACK_KEY);
    if (lsRaw) {
      const parsed = sanitizeAndMigrateSave(JSON.parse(lsRaw));
      if (parsed) return parsed;
    }
  } catch {
    storageDegradedReason = 'Browser storage is restricted; progress will persist in memory for this session.';
  }

  return createDefaultSaveData();
}

export async function savePlayerData(data: PlayerSaveData): Promise<void> {
  const payload: PlayerSaveData = {
    ...data,
    schemaVersion: SAVE_SCHEMA_VERSION,
    updatedAtMs: Date.now(),
  };

  let wroteAny = false;
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(payload));
    wroteAny = true;
  } catch {
    // ignore quota error
  }

  const db = await openDatabase();
  if (db) {
    const prev = await idbGet(db, PRIMARY_KEY);
    if (prev) {
      await idbPut(db, BACKUP_KEY, prev);
    }
    const ok = await idbPut(db, PRIMARY_KEY, payload);
    if (ok) wroteAny = true;
    db.close();
  }

  if (!wroteAny) {
    storageDegradedReason = 'Local browser persistence is unavailable (incognito or quota full). Use JSON Export to back up.';
  } else {
    storageDegradedReason = null;
  }
}

export async function resetPlayerSave(): Promise<PlayerSaveData> {
  const fresh = createDefaultSaveData();
  await savePlayerData(fresh);
  return fresh;
}
