// lib/storage/health.ts
import { loadMetas } from "./local/meta-cache";
import { checkIndexedDBHealth } from "./local/idb";

export async function getStorageHealth() {
  const idbHealth = await checkIndexedDBHealth();
  const metasCount = loadMetas().length;
  return {
    localStorage: { available: true, metasCount },
    indexedDB: idbHealth,
    timestamp: Date.now(),
  };
}
