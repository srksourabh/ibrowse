import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { clearGeminiKey, hasGeminiKey, loadGeminiKey, saveGeminiKey } from '../../src/cloud/secrets'

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = { ...initial }
  return {
    data,
    get: async (key: string) => ({ [key]: data[key] }),
    set: async (items: Record<string, unknown>) => void Object.assign(data, items),
    remove: async (key: string) => void delete data[key],
  }
}

const GOOD = 'AIzaSyD-example_key_0123456789abcdef'

describe('the Gemini key store', () => {
  it('has no key to begin with', async () => {
    const store = memoryStore()
    expect(await loadGeminiKey(store)).toBeNull()
    expect(await hasGeminiKey(store)).toBe(false)
  })

  it('saves a key, trimmed, and loads it back', async () => {
    const store = memoryStore()
    await saveGeminiKey(store, `  ${GOOD}  `)
    expect(await loadGeminiKey(store)).toBe(GOOD)
    expect(await hasGeminiKey(store)).toBe(true)
  })

  it('rejects text that cannot be a key, without saying what was typed', async () => {
    for (const bad of ['', 'short', 'has a space in the middle of it 12345', 'bad!chars-12345678901234567890', 'x'.repeat(300)]) {
      const store = memoryStore()
      const error = await saveGeminiKey(store, bad).catch((e: Error) => e)
      expect(error, bad).toBeInstanceOf(Error)
      expect((error as Error).message, bad).not.toContain(bad || 'NOTHING')
      expect(await loadGeminiKey(store)).toBeNull()
    }
  })

  it('removes a key', async () => {
    const store = memoryStore()
    await saveGeminiKey(store, GOOD)
    await clearGeminiKey(store)
    expect(await loadGeminiKey(store)).toBeNull()
  })

  it('ignores a stored value that is not a string', async () => {
    expect(await loadGeminiKey(memoryStore({ geminiKey: 42 }))).toBeNull()
  })
})

/** Every source file under a directory, as paths. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? sources(full) : /\.(ts|tsx)$/.test(name) ? [full] : []
  })
}

describe('where the key may be used', () => {
  const root = path.resolve(__dirname, '../..')
  const forbidden = /from\s+['"][^'"]*\/(cloud\/secrets|cloud\/gemini-client)['"]/

  it('is never imported by code that runs inside web pages', () => {
    const inPages = [...sources(path.join(root, 'src/session')), path.join(root, 'entrypoints/content.ts')]
    for (const file of inPages) {
      expect(forbidden.test(readFileSync(file, 'utf8')), path.relative(root, file)).toBe(false)
    }
  })
})
