import { describe, expect, it } from 'vitest'
import { LATENCY_TARGETS_MS, LatencyMeter, failingTargets } from '../../src/audio/latency-meter'

function meterWithClock() {
  let t = 0
  const meter = new LatencyMeter(() => t)
  return { meter, advance: (ms: number) => (t += ms) }
}

describe('LatencyMeter', () => {
  it('records the time between start and stop', () => {
    const { meter, advance } = meterWithClock()
    const stop = meter.start('earcon')
    advance(12)
    expect(stop()).toBe(12)
  })

  it('counts a stop function only once', () => {
    const { meter, advance } = meterWithClock()
    const stop = meter.start('earcon')
    advance(5)
    stop()
    advance(5)
    expect(stop()).toBeUndefined()
    expect(meter.report().earcon?.count).toBe(1)
  })

  it('reports null for kinds with no samples', () => {
    expect(new LatencyMeter(() => 0).report().speech).toBeNull()
  })

  it('computes median, 95th percentile and max by nearest rank', () => {
    const { meter, advance } = meterWithClock()
    for (let i = 1; i <= 20; i++) {
      const stop = meter.start('speech')
      advance(i * 10)
      stop()
    }
    expect(meter.report().speech).toEqual({ count: 20, p50: 100, p95: 190, max: 200 })
  })

  it('flags kinds whose 95th percentile exceeds the target', () => {
    const { meter, advance } = meterWithClock()
    const fast = meter.start('earcon')
    advance(LATENCY_TARGETS_MS.earcon - 1)
    fast()
    const slow = meter.start('cancel')
    advance(LATENCY_TARGETS_MS.cancel + 5)
    slow()
    expect(failingTargets(meter.report())).toEqual(['cancel'])
  })

  it('ignores kinds with no samples when checking targets', () => {
    expect(failingTargets(new LatencyMeter(() => 0).report())).toEqual([])
  })

  it('clears samples on reset', () => {
    const { meter, advance } = meterWithClock()
    const stop = meter.start('earcon')
    advance(3)
    stop()
    meter.reset()
    expect(meter.report().earcon).toBeNull()
  })
})
