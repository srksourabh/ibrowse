import { describe, expect, it, vi } from 'vitest'
import { HAPTIC_EVENTS } from '../../src/haptics/events'
import { HAPTIC_LABELS, runTestPattern } from '../../src/haptics/test-pattern'

describe('runTestPattern', () => {
  it('says what each event is, then plays it, for every event in order', async () => {
    const log: string[] = []
    await runTestPattern({
      speak: (text) => void log.push(`say:${text}`),
      play: (event) => void log.push(`play:${event}`),
      wait: async () => {},
    })
    const expected = HAPTIC_EVENTS.flatMap((event) => [`say:${HAPTIC_LABELS[event]}`, `play:${event}`])
    expect(log).toEqual(expected)
  })

  it('pauses between events, longer than any cool-down', async () => {
    const wait = vi.fn(async (_ms: number) => {})
    await runTestPattern({ speak: () => {}, play: () => {}, wait })
    expect(wait).toHaveBeenCalledTimes(HAPTIC_EVENTS.length)
    for (const [ms] of wait.mock.calls) expect(ms).toBeGreaterThanOrEqual(400)
  })

  it('describes every event in plain, distinct words', () => {
    const labels = HAPTIC_EVENTS.map((event) => HAPTIC_LABELS[event])
    expect(labels.every((label) => label.trim() !== '')).toBe(true)
    expect(new Set(labels).size).toBe(labels.length)
  })
})
