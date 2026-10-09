import type { EarconName } from '../audio/earcons'

/** The tactile moments iBrowse reports. The vocabulary is fixed (PRD §7.3). */
export const HAPTIC_EVENTS = [
  'enter-interactive',
  'enter-static',
  'word-tick',
  'boundary',
  'edge-cross',
  'action-confirm',
  'error',
  'page-change',
] as const

export type HapticEvent = (typeof HAPTIC_EVENTS)[number]

/** One burst of vibration, sliding from `startHz` to `endHz`. `gain` is 0 to 1 at full intensity. */
export interface HapticPulse {
  readonly startHz: number
  readonly endHz: number
  readonly ms: number
  readonly gain: number
}

export interface HapticEffect {
  readonly pulses: readonly HapticPulse[]
  /** Silence between pulses. */
  readonly gapMs: number
  /** The same event is not repeated inside this long, so shaking the pointer does not buzz. */
  readonly cooldownMs: number
}

const pulse = (startHz: number, endHz: number, ms: number, gain: number): HapticPulse => ({
  startHz,
  endHz,
  ms,
  gain,
})

/** The reference waveforms from the PRD's haptic matrix. Drivers interpret them for their hardware. */
export const HAPTIC_EFFECTS: Readonly<Record<HapticEvent, HapticEffect>> = {
  'enter-interactive': {
    pulses: [pulse(240, 240, 20, 1), pulse(240, 240, 15, 1)],
    gapMs: 10,
    cooldownMs: 60,
  },
  'enter-static': { pulses: [pulse(150, 150, 12, 0.4)], gapMs: 0, cooldownMs: 80 },
  'word-tick': { pulses: [pulse(280, 280, 8, 0.8)], gapMs: 0, cooldownMs: 25 },
  boundary: {
    pulses: [pulse(90, 90, 40, 0.9), pulse(90, 90, 40, 0.5)],
    gapMs: 20,
    cooldownMs: 120,
  },
  'edge-cross': { pulses: [pulse(120, 220, 30, 0.8)], gapMs: 0, cooldownMs: 80 },
  'action-confirm': { pulses: [pulse(180, 180, 35, 1)], gapMs: 0, cooldownMs: 100 },
  error: {
    pulses: [pulse(110, 110, 20, 0.9), pulse(110, 110, 20, 0.9), pulse(110, 110, 20, 0.9)],
    gapMs: 10,
    cooldownMs: 150,
  },
  'page-change': {
    pulses: [pulse(140, 200, 25, 0.8), pulse(200, 260, 25, 1)],
    gapMs: 15,
    cooldownMs: 300,
  },
}

export function effectDurationMs(effect: HapticEffect): number {
  const pulses = effect.pulses.reduce((sum, p) => sum + p.ms, 0)
  return pulses + effect.gapMs * Math.max(0, effect.pulses.length - 1)
}

/** Every Earcon has a matching Haptic Event, so what is heard and what is felt always agree. */
export const EARCON_TO_HAPTIC: Readonly<Record<EarconName, HapticEvent>> = {
  interactive: 'enter-interactive',
  static: 'enter-static',
  tick: 'word-tick',
  boundary: 'boundary',
  edge: 'edge-cross',
  confirm: 'action-confirm',
  error: 'error',
}
