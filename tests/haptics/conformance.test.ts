import { describe, expect, it, vi } from 'vitest'
import { runConformance } from '../../src/haptics/conformance'
import type { HapticDriver } from '../../src/haptics/driver'

function goodDriver(overrides: Partial<HapticDriver> = {}): HapticDriver {
  return {
    id: 'good-driver',
    name: 'Good driver',
    capabilities: () => ({ events: 'all' }),
    connect: async () => ({ ok: true }),
    disconnect: async () => {},
    play: () => {},
    onDisconnect: () => () => {},
    ...overrides,
  }
}

const failed = (report: Awaited<ReturnType<typeof runConformance>>): string[] =>
  report.results.filter((r) => r.status === 'fail').map((r) => r.name)

describe('runConformance', () => {
  it('passes a driver that follows the contract', async () => {
    const report = await runConformance(goodDriver())
    expect(report.passed).toBe(true)
    expect(failed(report)).toEqual([])
    expect(report.results.every((r) => r.status === 'pass')).toBe(true)
  })

  it('names the check that failed when play throws', async () => {
    const report = await runConformance(
      goodDriver({
        play: () => {
          throw new Error('boom')
        },
      }),
    )
    expect(report.passed).toBe(false)
    expect(failed(report)).toEqual(['plays every supported event without throwing'])
  })

  it('fails a driver with no usable id or name', async () => {
    const report = await runConformance(goodDriver({ id: 'Not Valid', name: '' }))
    expect(failed(report)).toContain('has a lower-case id and a name')
  })

  it('fails capabilities that name an unknown event', async () => {
    const report = await runConformance(
      goodDriver({ capabilities: () => ({ events: ['wiggle'] as never }) }),
    )
    expect(failed(report)).toContain('declares known events')
  })

  it('fails a driver that throws on an out-of-range intensity', async () => {
    const report = await runConformance(
      goodDriver({
        play: (_event, intensity) => {
          if (!(intensity >= 0 && intensity <= 1)) throw new RangeError('bad intensity')
        },
      }),
    )
    expect(failed(report)).toEqual(['copes with an out-of-range intensity'])
  })

  it('fails a driver whose play rejects', async () => {
    const report = await runConformance(goodDriver({ play: async () => Promise.reject(new Error('x')) }))
    expect(failed(report)).toContain('plays every supported event without throwing')
  })

  it('fails a driver whose connect gives no reason when it fails', async () => {
    const report = await runConformance(
      goodDriver({ connect: async () => ({ ok: false, reason: '' }) as never }),
    )
    expect(failed(report)).toContain('connects, or says why not')
  })

  it('skips the playing checks, without failing, when there is no device to connect to', async () => {
    const play = vi.fn()
    const report = await runConformance(
      goodDriver({ connect: async () => ({ ok: false, reason: 'No device.' }), play }),
    )
    expect(report.passed).toBe(true)
    expect(report.results.some((r) => r.status === 'skip')).toBe(true)
    expect(play).not.toHaveBeenCalled()
  })

  it('fails a driver that does not return a way to stop listening', async () => {
    const report = await runConformance(goodDriver({ onDisconnect: (() => undefined) as never }))
    expect(failed(report)).toContain('returns a function to stop listening for disconnects')
  })

  it('fails a driver that throws when played after disconnect', async () => {
    let connected = true
    const report = await runConformance(
      goodDriver({
        disconnect: async () => {
          connected = false
        },
        play: () => {
          if (!connected) throw new Error('closed')
        },
      }),
    )
    expect(failed(report)).toContain('survives being played after disconnect')
  })
})
