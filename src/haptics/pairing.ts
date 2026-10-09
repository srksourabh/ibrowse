import { loadSettings, saveSettings, type KeyValueStore, type Settings } from '../shared/settings'
import { loadProfiles, saveProfile, validateDeviceProfile, type DeviceProfile } from './profile'

const MAX_PROBLEMS_SPOKEN = 3

export interface PairingDeps {
  /** Says something aloud. The pairing page is for people who cannot see it. */
  speak(text: string): void
  store: KeyValueStore
  /** `navigator.hid`, or undefined where the browser has none. */
  hid:
    | {
        requestDevice(options: {
          filters: Array<Record<string, number>>
        }): Promise<ReadonlyArray<{ productName?: string }>>
      }
    | undefined
  getGamepads(): ReadonlyArray<{ vibrationActuator?: unknown } | null>
  /** Plays each Haptic Event in turn through whatever is selected. */
  playTest(): Promise<void>
}

const CHOICE_MESSAGES = {
  none: 'Sound only. No haptic device will be used.',
  simulator: 'Sound simulator selected. Haptic effects will also be played as low sound.',
  gamepad: 'Game controller selected.',
} as const

/**
 * The logic behind the hardware setup page. Everything it does is spoken, so
 * it can be used with the keyboard alone.
 */
export class PairingController {
  readonly #deps: PairingDeps

  constructor(deps: PairingDeps) {
    this.#deps = deps
  }

  describeOptions(): string {
    return (
      'Hardware setup. Choose how iBrowse gives touch feedback: sound only, sound simulator, ' +
      'game controller, or a paired haptic device. ' +
      'Press Tab to move between options and Enter to choose one.'
    )
  }

  listProfiles(): Promise<DeviceProfile[]> {
    return loadProfiles(this.#deps.store)
  }

  async choose(driver: keyof typeof CHOICE_MESSAGES): Promise<void> {
    await saveSettings(this.#deps.store, { hapticDriver: driver } satisfies Partial<Settings>)
    let message: string = CHOICE_MESSAGES[driver]
    if (driver === 'gamepad' && !this.#hasVibratingController()) {
      message += ' No controller is detected yet. Press a button on the controller, then choose this again.'
    }
    this.#deps.speak(message)
  }

  /** Saves a Device Profile from pasted JSON. Returns whether it was accepted. */
  async importProfile(json: string): Promise<boolean> {
    let raw: unknown
    try {
      raw = JSON.parse(json)
    } catch {
      this.#deps.speak('That is not valid JSON.')
      return false
    }
    const result = validateDeviceProfile(raw)
    if (!result.ok) {
      const problems = result.errors.slice(0, MAX_PROBLEMS_SPOKEN).join('. ')
      this.#deps.speak(`That profile is not valid. ${problems}.`)
      return false
    }
    await saveProfile(this.#deps.store, result.profile)
    this.#deps.speak(`Imported ${result.profile.name}.`)
    return true
  }

  /** Asks the browser to let iBrowse use a device of this profile, then remembers the choice. */
  async pairDevice(profileId: string): Promise<void> {
    const profile = (await this.listProfiles()).find((p) => p.id === profileId)
    if (!profile) {
      this.#deps.speak('No profile with that name. Import a profile first.')
      return
    }
    const { hid } = this.#deps
    if (!hid) {
      this.#deps.speak('This browser does not support pairing hardware.')
      return
    }
    try {
      const devices = await hid.requestDevice({ filters: [filterFor(profile)] })
      const [device] = devices
      if (!device) {
        this.#deps.speak('No device was chosen.')
        return
      }
      await saveSettings(this.#deps.store, { hapticDriver: 'webhid', hapticProfileId: profile.id })
      this.#deps.speak(`Paired ${device.productName ?? profile.name}. Haptic feedback will use it on every page.`)
    } catch (error) {
      this.#deps.speak(describePairingFailure(error))
    }
  }

  async test(): Promise<void> {
    const { hapticDriver } = await loadSettings(this.#deps.store)
    if (hapticDriver === 'none') {
      this.#deps.speak('Sound only is selected, so there is nothing to feel. Choose another option first.')
      return
    }
    this.#deps.speak('Playing a test pattern.')
    await this.#deps.playTest()
  }

  #hasVibratingController(): boolean {
    return this.#deps.getGamepads().some((pad) => Boolean(pad?.vibrationActuator))
  }
}

function filterFor(profile: DeviceProfile): Record<string, number> {
  const { vendorId, productId, usagePage, usage } = profile.match
  return {
    vendorId,
    ...(productId === undefined ? {} : { productId }),
    ...(usagePage === undefined ? {} : { usagePage }),
    ...(usage === undefined ? {} : { usage }),
  }
}

function describePairingFailure(error: unknown): string {
  const name = (error as { name?: string } | null)?.name
  if (name === 'NotFoundError') return 'No device was chosen.'
  if (name === 'SecurityError' || name === 'NotAllowedError') {
    return 'The browser did not allow access to the device.'
  }
  return 'Pairing failed.'
}
