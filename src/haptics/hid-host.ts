import type { Settings } from '../shared/settings'
import type { HapticEvent } from './events'
import { HidDriver, type HidApiLike } from './hid-driver'
import type { HapticResponse } from './messages'
import type { DeviceProfile } from './profile'

const SETUP_HINT = 'Press Alt+Shift+P to open hardware setup.'

export interface HidHostDeps {
  loadSettings(): Promise<Pick<Settings, 'hapticProfileId'>>
  loadProfiles(): Promise<DeviceProfile[]>
  /** `navigator.hid`, or undefined where the browser has none. */
  hid: HidApiLike | undefined
  /** Called when the device is unplugged. */
  onDisconnected(): void
}

/**
 * Owns the paired HID device on behalf of every page. Chrome may stop and
 * restart the background worker at any time, so nothing is assumed to still
 * be connected: each effect connects first if it has to, and many effects
 * arriving together share one connection attempt.
 */
export class HidHost {
  readonly #deps: HidHostDeps
  #driver: HidDriver | null = null
  #stopListening: (() => void) | null = null
  #connecting: Promise<HapticResponse> | null = null

  constructor(deps: HidHostDeps) {
    this.#deps = deps
  }

  connect(): Promise<HapticResponse> {
    if (this.#driver) return Promise.resolve({ ok: true })
    this.#connecting ??= this.#open().finally(() => {
      this.#connecting = null
    })
    return this.#connecting
  }

  async play(event: HapticEvent, intensity: number): Promise<HapticResponse> {
    const connected = await this.connect()
    const driver = this.#driver
    if (!connected.ok || !driver) return connected
    try {
      await driver.play(event, intensity)
      return { ok: true }
    } catch {
      await this.disconnect() // so the next effect starts from a fresh connection
      return { ok: false, reason: 'The haptic device did not respond.' }
    }
  }

  async disconnect(): Promise<void> {
    const driver = this.#driver
    this.#driver = null
    this.#stopListening?.()
    this.#stopListening = null
    try {
      await driver?.disconnect()
    } catch {
      // Closing a device that has already gone away can fail; the result is the same.
    }
  }

  async #open(): Promise<HapticResponse> {
    const { hid } = this.#deps
    if (!hid) return { ok: false, reason: 'This browser does not support pairing hardware.' }

    const { hapticProfileId } = await this.#deps.loadSettings()
    if (!hapticProfileId) {
      return { ok: false, reason: `No haptic device has been paired. ${SETUP_HINT}` }
    }
    const profile = (await this.#deps.loadProfiles()).find((p) => p.id === hapticProfileId)
    if (!profile) {
      return { ok: false, reason: `The saved device profile is missing. ${SETUP_HINT}` }
    }

    const driver = new HidDriver(profile, hid)
    const result = await driver.connect()
    if (!result.ok) return result
    this.#driver = driver
    this.#stopListening = driver.onDisconnect(() => {
      void this.disconnect()
      this.#deps.onDisconnected()
    })
    return { ok: true }
  }
}
