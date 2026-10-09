import { describe, expect, it } from 'vitest'
import {
  EARCON_TO_HAPTIC,
  HAPTIC_EFFECTS,
  HAPTIC_EVENTS,
  effectDurationMs,
} from '../../src/haptics/events'
import { EARCON_NAMES } from '../../src/audio/earcons'

describe('HAPTIC_EVENTS', () => {
  it('has the eight events of PRD §7.3', () => {
    expect([...HAPTIC_EVENTS]).toEqual([
      'enter-interactive',
      'enter-static',
      'word-tick',
      'boundary',
      'edge-cross',
      'action-confirm',
      'error',
      'page-change',
    ])
  })

  it('has an effect for every event', () => {
    for (const event of HAPTIC_EVENTS) expect(HAPTIC_EFFECTS[event], event).toBeDefined()
  })
})

describe('HAPTIC_EFFECTS (PRD §5 and §7.3)', () => {
  const first = (event: (typeof HAPTIC_EVENTS)[number]) => HAPTIC_EFFECTS[event].pulses[0]!

  it('enter-interactive is a dual pulse at 240 Hz, 20 ms then 15 ms', () => {
    const { pulses } = HAPTIC_EFFECTS['enter-interactive']
    expect(pulses.map((p) => [p.startHz, p.endHz, p.ms])).toEqual([
      [240, 240, 20],
      [240, 240, 15],
    ])
  })

  it('enter-static is one gentle 150 Hz pulse of 12 ms', () => {
    expect(HAPTIC_EFFECTS['enter-static'].pulses).toHaveLength(1)
    expect(first('enter-static')).toMatchObject({ startHz: 150, endHz: 150, ms: 12 })
    expect(first('enter-static').gain).toBeLessThan(first('enter-interactive').gain)
  })

  it('word-tick is a sharp 280 Hz, 8 ms tick', () => {
    expect(first('word-tick')).toMatchObject({ startHz: 280, endHz: 280, ms: 8 })
  })

  it('boundary is a damped double thud at 90 Hz', () => {
    const { pulses } = HAPTIC_EFFECTS.boundary
    expect(pulses).toHaveLength(2)
    expect(pulses.every((p) => p.startHz === 90 && p.ms === 40)).toBe(true)
    expect(pulses[1]!.gain).toBeLessThan(pulses[0]!.gain)
  })

  it('edge-cross ramps from 120 Hz to 220 Hz over 30 ms', () => {
    expect(first('edge-cross')).toMatchObject({ startHz: 120, endHz: 220, ms: 30 })
  })

  it('action-confirm is one 180 Hz pulse of 35 ms', () => {
    expect(first('action-confirm')).toMatchObject({ startHz: 180, endHz: 180, ms: 35 })
  })

  it('error is a triple buzz at 110 Hz lasting about 80 ms', () => {
    expect(HAPTIC_EFFECTS.error.pulses).toHaveLength(3)
    expect(HAPTIC_EFFECTS.error.pulses.every((p) => p.startHz === 110)).toBe(true)
    expect(effectDurationMs(HAPTIC_EFFECTS.error)).toBeGreaterThanOrEqual(80)
    expect(effectDurationMs(HAPTIC_EFFECTS.error)).toBeLessThanOrEqual(100)
  })

  it('page-change is a rising double pulse', () => {
    const { pulses } = HAPTIC_EFFECTS['page-change']
    expect(pulses).toHaveLength(2)
    expect(pulses[1]!.startHz).toBeGreaterThan(pulses[0]!.startHz)
  })

  it('keeps every gain within 0 to 1 and every effect short', () => {
    for (const event of HAPTIC_EVENTS) {
      const effect = HAPTIC_EFFECTS[event]
      expect(effect.pulses.every((p) => p.gain > 0 && p.gain <= 1), event).toBe(true)
      expect(effectDurationMs(effect), event).toBeLessThan(200)
      expect(effect.cooldownMs, event).toBeGreaterThan(0)
    }
  })
})

describe('effectDurationMs', () => {
  it('adds the pulses and the gaps between them', () => {
    expect(
      effectDurationMs({
        pulses: [
          { startHz: 100, endHz: 100, ms: 20, gain: 1 },
          { startHz: 100, endHz: 100, ms: 15, gain: 1 },
        ],
        gapMs: 10,
        cooldownMs: 50,
      }),
    ).toBe(45)
  })
})

describe('EARCON_TO_HAPTIC', () => {
  it('gives every Earcon a Haptic Event, so sound and touch always agree', () => {
    for (const earcon of EARCON_NAMES) {
      expect(HAPTIC_EVENTS).toContain(EARCON_TO_HAPTIC[earcon])
    }
  })

  it('maps the Earcons the way the PRD describes', () => {
    expect(EARCON_TO_HAPTIC.interactive).toBe('enter-interactive')
    expect(EARCON_TO_HAPTIC.static).toBe('enter-static')
    expect(EARCON_TO_HAPTIC.tick).toBe('word-tick')
    expect(EARCON_TO_HAPTIC.boundary).toBe('boundary')
    expect(EARCON_TO_HAPTIC.edge).toBe('edge-cross')
    expect(EARCON_TO_HAPTIC.confirm).toBe('action-confirm')
    expect(EARCON_TO_HAPTIC.error).toBe('error')
  })
})
