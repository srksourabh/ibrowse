import { loadGeminiKey, moveKeyOut, type SecretStore } from './secrets'

const DATABASE = 'ibrowse-secrets'
const TABLE = 'secrets'

function openVault(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(TABLE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('The key vault could not be opened'))
  })
}

async function inVault<T>(mode: IDBTransactionMode, act: (table: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openVault()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(TABLE, mode)
      const request = act(transaction.objectStore(TABLE))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = transaction.onabort = () =>
        reject(transaction.error ?? new Error('The key vault could not be used'))
    })
  } finally {
    db.close()
  }
}

/**
 * Where the Gemini key is kept: IndexedDB in the extension's own origin. The background
 * worker and the extension's pages can open it; content scripts run in each web page's
 * origin and cannot, unlike chrome.storage.local.
 */
export const keyVault: SecretStore = {
  async get(key) {
    const value: unknown = await inVault('readonly', (table) => table.get(key))
    return value === undefined ? {} : { [key]: value }
  },
  async set(items) {
    for (const [key, value] of Object.entries(items)) await inVault('readwrite', (table) => table.put(value, key))
  },
  async remove(key) {
    await inVault('readwrite', (table) => table.delete(key))
  },
}

/** The key, after moving one saved by an older version out of chrome.storage.local. */
export async function loadVaultKey(): Promise<string | null> {
  await moveKeyOut(chrome.storage.local, keyVault)
  return loadGeminiKey(keyVault)
}
