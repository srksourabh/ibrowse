import { describe, expect, it, vi } from 'vitest'
import { HAPTIC_EFFECTS, effectDurationMs } from '../../src/haptics/events'
import { SimulatorDriver, renderHaptic } from '../../src/haptics/simulator-driver'

const RATE = 48000
const peak = (samples: Float32Array): number => Math.max(...Array.from(samples, Math.abs))

describe('renderHaptic', () => {
  it('is as long as the effect, pulses and gaps included', () => {
    for (const effect of Object.values(HAPTIC_EFFECTS)) {
      const expected = (effectDurationMs(effect) * RATE) / 1000
      expect(Math.abs(renderHaptic(effect, RATE, 1).length - expected)).toBeLessThan(
        effect.pulses.length + 1,
      )
    }
  })

  it('starts and ends in silence so it never clicks', () => {
    for (const effect of Object.values(HAPTIC_EFFECTS)) {
      const samples = renderHaptic(effect, RATE, 1)
      expect(Math.abs(samples[0]!)).toBeLessThan(0.01)
      expect(Math.abs(samples[samples.length - 1]!)).toBeLessThan(0.01)
    }
  })

  it('reaches roughly the gain of the loudest pulse at full intensity', () => {
    const effect = HAPTIC_EFFECTS['action-confirm']
    expect(peak(renderHaptic(effect, RATE, 1))).toBeGreaterThan(0.85)
    expect(peak(renderHaptic(effect, RATE, 1))).toBeLessThanOrEqual(1)
  })

  it('scales with intensity', () => {
    const effect = HAPTIC_EFFECTS['action-confirm']
    const full = peak(renderHaptic(effect, RATE, 1))
    expect(peak(renderHaptic(effect, RATE, 0.5))).toBeCloseTo(full / 2, 1)
  })

  it('is silent between pulses', () => {
    const effect = HAPTIC_EFFECTS.boundary
    const samples = renderHaptic(effect, RATE, 1)
    const firstEnd = Math.round((effect.pulses[0]!.ms * RATE) / 1000)
    const gap = samples.slice(firstEnd + 5, firstEnd + Math.round((effect.gapMs * RATE) / 1000) - 5)
    expect(peak(gap)).toBe(0)
  })

  it('makes the second thud of a boundary softer than the first', () => {
    const effect = HAPTIC_EFFECTS.boundary
    const samples = renderHaptic(effect, RATE, 1)
    const half = Math.floor(samples.length / 2)
    expect(peak(samples.slice(half))).toBeLessThan(peak(samples.slice(0, half)))
  })
})

function fakeContext() {
  const panner = { pan: { value: 0 }, connect: vi.fn() }
  const source = { buffer: null as unknown, connect: vi.fn(), start: vi.fn() }
  return {
    ctx: {
      sampleRate: RATE,
      destination: {},
      createBuffer: vi.fn((_c: number, length: number) => ({
        getChannelData: () => new Float32Array(length),
      })),
      createBufferSource: vi.fn(() => source),
      createStereoPanner: vi.fn(() => panner),
    },
    source,
  }
}

describe('SimulatorDriver', () => {
  it('identifies itself and supports every event', () => {
    const driver = new SimulatorDriver(fakeContext().ctx as never)
    expect(driver.id).toBe('simulator')
    expect(driver.name).toBe('Sound simulator')
    expect(driver.capabilities()).toEqual({ events: 'all' })
  })

  it('always connects: it needs no hardware', async () => {
    expect(await new SimulatorDriver(fakeContext().ctx as never).connect()).toEqual({ ok: true })
  })

  it('plays the event as sound', () => {
    const { ctx, source } = fakeContext()
    new SimulatorDriver(ctx as never).play('boundary', 1)
    expect(source.start).toHaveBeenCalledOnce()
  })

  it('tells observers what was played, for a visual display', () => {
    const driver = new SimulatorDriver(fakeContext().ctx as never)
    const seen: Array<{ event: string; intensity: number; length: number }> = []
    driver.observe((played) =>
      seen.push({ event: played.event, intensity: played.intensity, length: played.samples.length }),
    )
    driver.play('word-tick', 0.5)
    expect(seen).toEqual([{ event: 'word-tick', intensity: 0.5, length: expect.any(Number) }])
  })

  it('stops telling an observer that has unsubscribed', () => {
    const driver = new SimulatorDriver(fakeContext().ctx as never)
    const listener = vi.fn()
    const stop = driver.observe(listener)
    stop()
    driver.play('word-tick', 1)
    expect(listener).not.toHaveBeenCalled()
  })

  it('has no device to lose, but honours the contract for disconnect listeners', () => {
    const driver = new SimulatorDriver(fakeContext().ctx as never)
    expect(typeof driver.onDisconnect(() => {})).toBe('function')
  })
})
