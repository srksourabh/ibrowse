import { afterEach, describe, expect, it, vi } from 'vitest'
import { keyVault } from '../../src/cloud/key-vault'

describe('keyVault IndexedDB error handling', () => {
  const originalIdb = globalThis.indexedDB

  afterEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', { value: originalIdb, configurable: true })
    vi.restoreAllMocks()
  })

  it('rejects cleanly when IndexedDB cannot be opened', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        open: () => {
          const failingRequest = { error: new Error('IDB blocked') } as unknown as IDBOpenDBRequest
          queueMicrotask(() => {
            failingRequest.onerror?.(new Event('error'))
          })
          return failingRequest
        },
      },
    })

    await expect(keyVault.get('geminiKey')).rejects.toThrow('IDB blocked')
    await expect(keyVault.set({ geminiKey: 'AIzaTestKey1234567890abcdef' })).rejects.toThrow('IDB blocked')
    await expect(keyVault.remove('geminiKey')).rejects.toThrow('IDB blocked')
  })
})
