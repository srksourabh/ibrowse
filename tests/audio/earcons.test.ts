import { describe, expect, it, vi } from 'vitest'
import { EARCON_NAMES, EarconEngine, renderEarcon } from '../../src/audio/earcons'

describe('renderEarcon', () => {
  it('renders non-silent audio for every named earcon', () => {
    for (const name of EARCON_NAMES) {
      const samples = renderEarcon(name, 48000)
      expect(samples.length).toBeGreaterThan(0)
      expect(Math.max(...samples.map(Math.abs))).toBeGreaterThan(0.05)
    }
  })

  it('starts and ends at silence so playback never clicks', () => {
    for (const name of EARCON_NAMES) {
      const samples = renderEarcon(name, 48000)
      expect(Math.abs(samples[0]!)).toBeLessThan(0.01)
      expect(Math.abs(samples[samples.length - 1]!)).toBeLessThan(0.01)
    }
  })

  it('keeps every earcon under 150 ms', () => {
    for (const name of EARCON_NAMES) {
      expect(renderEarcon(name, 48000).length / 48000).toBeLessThan(0.15)
    }
  })

  it('makes the interactive earcon longer than the static one', () => {
    expect(renderEarcon('interactive', 48000).length).toBeGreaterThan(
      renderEarcon('static', 48000).length,
    )
  })
})

function fakeContext() {
  const panner = { pan: { value: 0 }, connect: vi.fn() }
  const source = { buffer: null as unknown, connect: vi.fn(), start: vi.fn() }
  const ctx = {
    sampleRate: 48000,
    destination: {},
    createBuffer: vi.fn((_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    })),
    createBufferSource: vi.fn(() => source),
    createStereoPanner: vi.fn(() => panner),
  }
  return { ctx, panner, source }
}

describe('EarconEngine', () => {
  it('plays an earcon through a panner set to the requested pan', () => {
    const { ctx, panner, source } = fakeContext()
    new EarconEngine(ctx as never).play('interactive', 0.5)
    expect(panner.pan.value).toBe(0.5)
    expect(source.start).toHaveBeenCalledOnce()
  })

  it('clamps an out-of-range pan', () => {
    const { ctx, panner } = fakeContext()
    new EarconEngine(ctx as never).play('static', 3)
    expect(panner.pan.value).toBe(1)
  })

  it('renders each earcon buffer only once', () => {
    const { ctx } = fakeContext()
    const engine = new EarconEngine(ctx as never)
    engine.play('edge', 0)
    engine.play('edge', 0)
    expect(ctx.createBuffer).toHaveBeenCalledTimes(1)
  })
})
