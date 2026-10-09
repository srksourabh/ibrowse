import type { HapticDriver } from './driver'
import { HAPTIC_EFFECTS, type HapticEvent } from './events'

const STOPPED = 'Haptic feedback stopped working. Continuing with sound only.'
const UNPLUGGED = 'Haptic device disconnected. Continuing with sound only.'
const COULD_NOT_START = 'Haptic device could not be started. Continuing with sound only.'

export interface HapticManagerDeps {
  /** 0 to 1; zero switches haptics off. */
  getIntensity(): number
  /** A sentence to tell the user, spoken once per problem. */
  onProblem(message: string): void
  now?(): number
}

/**
 * Sends Haptic Events to the active driver, applying the intensity setting
 * and a cool-down per event. A driver that fails or is unplugged is dropped
 * with one spoken notice; sound carries on regardless.
 */
export class HapticManager {
  readonly #deps: HapticManagerDeps
  readonly #lastPlayed = new Map<HapticEvent, number>()
  #driver: HapticDriver | null = null
  #stopListening: (() => void) | null = null

  constructor(deps: HapticManagerDeps) {
    this.#deps = deps
  }

  /** Switches to a driver, or to none. The previous driver is disconnected. */
  async use(driver: HapticDriver | null): Promise<void> {
    await this.#release()
    if (!driver) return
    try {
      const result = await driver.connect()
      if (!result.ok) {
        this.#deps.onProblem(result.reason)
        return
      }
    } catch {
      this.#deps.onProblem(COULD_NOT_START)
      return
    }
    this.#driver = driver
    this.#stopListening = driver.onDisconnect(() => {
      if (this.#driver !== driver) return
      this.#driver = null
      this.#deps.onProblem(UNPLUGGED)
    })
  }

  play(event: HapticEvent): void {
    const driver = this.#driver
    if (!driver) return
    const intensity = Math.min(1, Math.max(0, this.#deps.getIntensity()))
    if (intensity <= 0 || !this.#canPlay(driver, event)) return

    try {
      const outcome = driver.play(event, intensity)
      if (outcome instanceof Promise) outcome.catch(() => this.#fail(driver))
    } catch {
      this.#fail(driver)
    }
  }

  #canPlay(driver: HapticDriver, event: HapticEvent): boolean {
    const { events } = driver.capabilities()
    if (events !== 'all' && !events.includes(event)) return false
    const now = (this.#deps.now ?? Date.now)()
    const last = this.#lastPlayed.get(event)
    if (last !== undefined && now - last < HAPTIC_EFFECTS[event].cooldownMs) return false
    this.#lastPlayed.set(event, now)
    return true
  }

  #fail(driver: HapticDriver): void {
    if (this.#driver !== driver) return
    this.#driver = null
    this.#deps.onProblem(STOPPED)
  }

  async #release(): Promise<void> {
    this.#stopListening?.()
    this.#stopListening = null
    const old = this.#driver
    this.#driver = null
    this.#lastPlayed.clear()
    try {
      await old?.disconnect()
    } catch {
      // The old device is being let go of; there is nothing useful to do if it complains.
    }
  }
}
