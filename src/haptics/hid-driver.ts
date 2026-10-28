import type { ConnectResult, HapticCapabilities, HapticDriver } from './driver'
import type { HapticEvent } from './events'
import { encodeEvent, type DeviceProfile } from './profile'

/** The slice of a WebHID `HIDDevice` the driver uses. */
export interface HidDeviceLike {
  readonly vendorId: number
  readonly productId: number
  readonly productName?: string
  readonly opened: boolean
  readonly collections?: ReadonlyArray<{ usagePage?: number; usage?: number }>
  open(): Promise<void>
  close(): Promise<void>
  sendReport(reportId: number, data: BufferSource): Promise<void>
}

/** The slice of `navigator.hid` the driver uses. */
export interface HidApiLike {
  getDevices(): Promise<readonly HidDeviceLike[]>
  addEventListener(type: 'disconnect', listener: (event: { device: HidDeviceLike }) => void): void
  removeEventListener(type: 'disconnect', listener: (event: { device: HidDeviceLike }) => void): void
}

function matches(profile: DeviceProfile, device: HidDeviceLike): boolean {
  const { vendorId, productId, usagePage, usage } = profile.match
  if (device.vendorId !== vendorId) return false
  if (productId !== undefined && device.productId !== productId) return false
  const collections = device.collections ?? []
  if (usagePage !== undefined && !collections.some((c) => c.usagePage === usagePage)) return false
  return usage === undefined || collections.some((c) => c.usage === usage)
}

const sameDevice = (a: HidDeviceLike, b: HidDeviceLike): boolean =>
  a === b || (a.vendorId === b.vendorId && a.productId === b.productId)

/**
 * Drives a USB HID haptic device from a Device Profile. It uses a device the
 * user has already granted through the pairing page; it never asks.
 */
export class HidDriver implements HapticDriver {
  readonly id: string
  readonly name: string
  readonly #profile: DeviceProfile
  readonly #hid: HidApiLike
  #device: HidDeviceLike | null = null

  constructor(profile: DeviceProfile, hid: HidApiLike) {
    this.id = profile.id
    this.name = profile.name
    this.#profile = profile
    this.#hid = hid
  }

  capabilities(): HapticCapabilities {
    return { events: Object.keys(this.#profile.events) as HapticEvent[] }
  }

  async connect(): Promise<ConnectResult> {
    const granted = await this.#hid.getDevices()
    const device = granted.find((d) => matches(this.#profile, d))
    if (!device) {
      return {
        ok: false,
        reason: `No paired ${this.name} found. Open hardware setup from iBrowse settings, with Alt and O.`,
      }
    }
    try {
      if (!device.opened) await device.open()
    } catch {
      return { ok: false, reason: 'Could not open the haptic device. Another program may be using it.' }
    }
    this.#device = device
    return { ok: true }
  }

  async disconnect(): Promise<void> {
    const device = this.#device
    this.#device = null
    if (device?.opened) await device.close()
  }

  async play(event: HapticEvent, intensity: number): Promise<void> {
    const report = this.#device ? encodeEvent(this.#profile, event, intensity) : null
    if (this.#device && report) await this.#device.sendReport(this.#profile.reportId, report)
  }

  onDisconnect(listener: () => void): () => void {
    const handler = (event: { device: HidDeviceLike }): void => {
      if (this.#device && sameDevice(event.device, this.#device)) listener()
    }
    this.#hid.addEventListener('disconnect', handler)
    return () => this.#hid.removeEventListener('disconnect', handler)
  }
}
