import type { ConnectResult, HapticCapabilities, HapticDriver } from './driver'
import { HAPTIC_EFFECTS, type HapticEffect, type HapticEvent } from './events'

/** Below this the heavy motor does all the work; the light motor takes over as the pitch rises. */
const HEAVY_ONLY_HZ = 80
const BLEND_SPAN_HZ = 200

export interface RumbleStep {
  readonly startDelayMs: number
  readonly durationMs: number
  /** The heavy, low-frequency motor, 0 to 1. */
  readonly strongMagnitude: number
  /** The light, high-frequency motor, 0 to 1. */
  readonly weakMagnitude: number
}

/**
 * Turns an effect into game-controller rumble: one step per pulse, with the
 * low thuds on the heavy motor and the sharp ticks on the light one.
 */
export function planRumble(effect: HapticEffect, intensity: number): RumbleStep[] {
  let startDelayMs = 0
  return effect.pulses.map((pulse) => {
    const centreHz = (pulse.startHz + pulse.endHz) / 2
    const light = Math.min(1, Math.max(0, (centreHz - HEAVY_ONLY_HZ) / BLEND_SPAN_HZ))
    const level = Math.min(1, pulse.gain * intensity)
    const step: RumbleStep = {
      startDelayMs,
      durationMs: pulse.ms,
      strongMagnitude: level * (1 - light),
      weakMagnitude: level * light,
    }
    startDelayMs += pulse.ms + effect.gapMs
    return step
  })
}

interface RumbleActuator {
  playEffect(
    type: 'dual-rumble',
    params: {
      startDelay: number
      duration: number
      weakMagnitude: number
      strongMagnitude: number
    },
  ): Promise<unknown>
}

interface GamepadLike {
  readonly vibrationActuator?: unknown
}

export interface GamepadDriverDeps {
  /** `navigator.getGamepads`, or undefined where the browser has none. */
  readonly getGamepads: (() => ReadonlyArray<GamepadLike | null>) | undefined
  onGamepadDisconnected(listener: () => void): () => void
}

/**
 * Rumbles a game controller. Browsers hide controllers until a button has
 * been pressed, so this connects without one and looks for it on each effect.
 */
export class GamepadDriver implements HapticDriver {
  readonly id = 'gamepad'
  readonly name = 'Game controller'
  readonly #deps: GamepadDriverDeps

  constructor(deps: GamepadDriverDeps) {
    this.#deps = deps
  }

  capabilities(): HapticCapabilities {
    return { events: 'all' }
  }

  async connect(): Promise<ConnectResult> {
    return this.#deps.getGamepads
      ? { ok: true }
      : { ok: false, reason: 'This browser does not support game controllers.' }
  }

  async disconnect(): Promise<void> {}

  async play(event: HapticEvent, intensity: number): Promise<void> {
    const actuator = this.#findActuator()
    if (!actuator) return
    const steps = planRumble(HAPTIC_EFFECTS[event], intensity)
    await Promise.all(
      steps.map((step) =>
        actuator.playEffect('dual-rumble', {
          startDelay: step.startDelayMs,
          duration: step.durationMs,
          weakMagnitude: step.weakMagnitude,
          strongMagnitude: step.strongMagnitude,
        }),
      ),
    )
  }

  onDisconnect(listener: () => void): () => void {
    return this.#deps.onGamepadDisconnected(listener)
  }

  #findActuator(): RumbleActuator | null {
    const pads = this.#deps.getGamepads?.() ?? []
    for (const pad of pads) {
      const actuator = pad?.vibrationActuator
      if (actuator && typeof (actuator as RumbleActuator).playEffect === 'function') {
        return actuator as RumbleActuator
      }
    }
    return null
  }
}
