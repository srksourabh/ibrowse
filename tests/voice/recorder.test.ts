import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordMicrophone } from '../../entrypoints/offscreen/recorder'

describe('recordMicrophone lifecycle & timer cleanup', () => {
  const originalAudioContext = globalThis.AudioContext
  const originalMediaDevices = navigator.mediaDevices

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.AudioContext = originalAudioContext
    Object.defineProperty(navigator, 'mediaDevices', { value: originalMediaDevices, configurable: true })
    vi.restoreAllMocks()
  })

  it('clears the maxMs timeout timer and releases media tracks when stopped or cancelled early', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    const stopTrack = vi.fn()
    const fakeStream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => fakeStream) },
    })

    globalThis.AudioContext = class {
      createMediaStreamSource = () => ({ connect: vi.fn(), disconnect: vi.fn() })
      createScriptProcessor = () => ({ onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() })
      destination = {}
      close = vi.fn(async () => {})
    } as unknown as typeof AudioContext

    const rec = recordMicrophone(15_000)
    await Promise.resolve()
    await Promise.resolve()
    rec.cancel()
    const samples = await rec.samples
    expect(samples).toHaveLength(0)
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(clearSpy).toHaveBeenCalled()
  })
})
