import { describe, expect, it, vi } from 'vitest'
import { createHapticDriver } from '../../src/haptics/factory'

function env() {
  return {
    audioContext: vi.fn(() => ({
      sampleRate: 48000,
      destination: {},
      createBuffer: () => ({ getChannelData: () => new Float32Array(1) }),
      createBufferSource: () => ({ buffer: null, connect: () => {}, start: () => {} }),
      createStereoPanner: () => ({ pan: { value: 0 }, connect: () => {} }),
    })),
    getGamepads: () => [] as never,
    onGamepadDisconnected: () => () => {},
    send: vi.fn(async () => ({ ok: true as const })),
  }
}

describe('createHapticDriver', () => {
  it('makes no driver for sound only', () => {
    expect(createHapticDriver('none', env())).toBeNull()
  })

  it('makes the simulator, using the audio context only then', () => {
    const e = env()
    expect(createHapticDriver('simulator', e)?.id).toBe('simulator')
    expect(e.audioContext).toHaveBeenCalledOnce()
  })

  it('makes the game controller driver without touching audio', () => {
    const e = env()
    expect(createHapticDriver('gamepad', e)?.id).toBe('gamepad')
    expect(e.audioContext).not.toHaveBeenCalled()
  })

  it('makes a relay to the background worker for a paired device', () => {
    expect(createHapticDriver('webhid', env())?.id).toBe('webhid')
  })
})
