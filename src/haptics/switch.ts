import type { Settings } from '../shared/settings'
import type { HapticDriver } from './driver'
import type { HapticManager } from './manager'

type HapticSettings = Pick<Settings, 'hapticDriver' | 'hapticProfileId'>

export interface HapticSwitchDeps {
  manager: Pick<HapticManager, 'use'>
  create(kind: Settings['hapticDriver']): HapticDriver | null
}

const OFF = 'off'

/**
 * Keeps the haptic driver in step with the settings, but only while Explore
 * Mode is on. Off, nothing is connected and nothing is said, so the extension
 * stays inert on every page the user has not switched it on for (ADR-0003).
 */
export class HapticSwitch {
  readonly #deps: HapticSwitchDeps
  #settings: HapticSettings | null = null
  #active = false
  #applied = OFF

  constructor(deps: HapticSwitchDeps) {
    this.#deps = deps
  }

  setSettings(settings: HapticSettings): Promise<void> {
    this.#settings = settings
    return this.#sync()
  }

  setActive(active: boolean): Promise<void> {
    this.#active = active
    return this.#sync()
  }

  #sync(): Promise<void> {
    const settings = this.#settings
    const wanted = this.#active && settings ? `${settings.hapticDriver}:${settings.hapticProfileId}` : OFF
    if (wanted === this.#applied) return Promise.resolve()
    this.#applied = wanted
    return this.#deps.manager.use(settings && wanted !== OFF ? this.#deps.create(settings.hapticDriver) : null)
  }
}
