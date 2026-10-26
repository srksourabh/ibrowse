import type { KeyValueStore } from '../shared/settings'

/** A store that can also forget a value, as chrome.storage.local can. */
export interface SecretStore extends KeyValueStore {
  remove(key: string): Promise<void>
}

const STORAGE_KEY = 'geminiKey'
/** Google API keys are letters, digits, dashes and underscores. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{20,200}$/

/**
 * The user's Google key. Only the background worker and the options page use
 * this module; a test checks that nothing that runs inside a web page does.
 */
export async function loadGeminiKey(store: KeyValueStore): Promise<string | null> {
  const stored = (await store.get(STORAGE_KEY))[STORAGE_KEY]
  return typeof stored === 'string' && stored !== '' ? stored : null
}

export async function hasGeminiKey(store: KeyValueStore): Promise<boolean> {
  return (await loadGeminiKey(store)) !== null
}

/** Saves a key. The error never repeats what was typed, in case it was a key with a typo. */
export async function saveGeminiKey(store: KeyValueStore, raw: string): Promise<void> {
  const key = raw.trim()
  if (!KEY_PATTERN.test(key)) {
    throw new Error('That does not look like a Google API key. It is 20 or more letters, digits, dashes or underscores.')
  }
  await store.set({ [STORAGE_KEY]: key })
}

export function clearGeminiKey(store: SecretStore): Promise<void> {
  return store.remove(STORAGE_KEY)
}

/**
 * Moves a key saved by an older version out of chrome.storage.local, which content
 * scripts can read, into the vault. A key already in the vault is kept.
 */
export async function moveKeyOut(from: SecretStore, to: SecretStore): Promise<void> {
  const old = await loadGeminiKey(from)
  if (old === null) return
  if ((await loadGeminiKey(to)) === null) await to.set({ [STORAGE_KEY]: old })
  await from.remove(STORAGE_KEY)
}
