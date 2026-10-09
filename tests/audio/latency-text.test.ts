import { describe, expect, it } from 'vitest'
import { LATENCY_TARGETS_MS, type LatencyReport } from '../../src/audio/latency-meter'
import { latencyText } from '../../src/audio/latency-text'

const none: LatencyReport = { earcon: null, speech: null, cancel: null }
const stats = (p50: number, p95: number, count = 10, max = p95 + 5) => ({ count, p50, p95, max })

describe('latencyText', () => {
  it('says there is nothing yet, and how to get something', () => {
    const text = latencyText(none)
    expect(text).toMatch(/no measurements yet/i)
    expect(text).toMatch(/measure delays/i)
  })

  it('reads each measured delay with its target and whether it is met', () => {
    const text = latencyText({
      earcon: stats(4, 9),
      speech: stats(80, 120),
      cancel: stats(3, 6),
    })
    expect(text).toMatch(/Sound: typically 4 milliseconds, slowest 9, target 30/)
    expect(text).toMatch(/Speech start: typically 80 milliseconds, slowest 120, target 150/)
    expect(text).toMatch(/Stopping speech: typically 3 milliseconds, slowest 6, target 20/)
  })

  it('says all is well when every delay is within target', () => {
    expect(latencyText({ earcon: stats(4, 9), speech: stats(80, 120), cancel: stats(3, 6) })).toMatch(
      /all delays are within target/i,
    )
  })

  it('names the delays that are over target', () => {
    const text = latencyText({
      earcon: stats(4, LATENCY_TARGETS_MS.earcon + 20),
      speech: stats(80, 120),
      cancel: stats(3, LATENCY_TARGETS_MS.cancel + 5),
    })
    expect(text).toMatch(/over target: sound and stopping speech/i)
    expect(text).not.toMatch(/all delays are within target/i)
  })

  it('says how many samples each figure rests on', () => {
    expect(latencyText({ ...none, speech: stats(80, 120, 7) })).toMatch(/7 measurements/)
    expect(latencyText({ ...none, speech: stats(80, 120, 1) })).toMatch(/1 measurement\b/)
  })

  it('rounds to whole milliseconds', () => {
    expect(latencyText({ ...none, earcon: stats(4.4, 9.6) })).toMatch(/typically 4 milliseconds, slowest 10/)
  })

  it('skips kinds with no measurements instead of reading zeros', () => {
    const text = latencyText({ ...none, earcon: stats(4, 9) })
    expect(text).toMatch(/Sound/)
    expect(text).not.toMatch(/Speech start/)
  })
})
