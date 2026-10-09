/**
 * An example driver, showing the shape of one for a device that is not
 * described by a Device Profile. It talks to the device through a small
 * `transport`, so it can be tested with no hardware: replace the transport
 * with your own (WebHID, Web Serial, a vendor library) and keep the rest.
 *
 * Run `runConformance` on it in your own tests. See `sdk/README.md`.
 */
import type {
  ConnectResult,
  HapticCapabilities,
  HapticDriver,
  HapticEvent,
} from '../../src/haptics'

/** The only thing the driver needs from the real device. */
export interface ExampleTransport {
  /** Gets the device ready. False if it is not there. */
  open(): Promise<boolean>
  write(bytes: Uint8Array): Promise<void>
  close(): Promise<void>
  /** Calls the listener if the device goes away. Returns a function that stops listening. */
  onClose(listener: () => void): () => void
}

const REPORT_MARKER = 0x01

/** The code this imaginary device uses for each event. */
const EVENT_CODES: Readonly<Record<HapticEvent, number>> = {
  'enter-interactive': 0x10,
  'enter-static': 0x11,
  'word-tick': 0x12,
  boundary: 0x13,
  'edge-cross': 0x14,
  'action-confirm': 0x15,
  error: 0x16,
  'page-change': 0x17,
}

export class ExampleMouseDriver implements HapticDriver {
  readonly id = 'example-mouse'
  readonly name = 'Example haptic mouse'
  readonly #transport: ExampleTransport
  readonly #disconnectListeners = new Set<() => void>()
  #connected = false
  #stopWatching: (() => void) | null = null

  constructor(transport: ExampleTransport) {
    this.#transport = transport
  }

  capabilities(): HapticCapabilities {
    return { events: 'all' }
  }

  async connect(): Promise<ConnectResult> {
    // Say why in a sentence a person can hear: this is spoken aloud.
    if (!(await this.#transport.open())) {
      return { ok: false, reason: 'The example haptic mouse is not plugged in.' }
    }
    this.#connected = true
    this.#stopWatching = this.#transport.onClose(() => {
      this.#connected = false
      this.#disconnectListeners.forEach((listener) => listener())
    })
    return { ok: true }
  }

  async disconnect(): Promise<void> {
    this.#connected = false
    this.#stopWatching?.()
    this.#stopWatching = null
    await this.#transport.close()
  }

  /** Never throws for an unknown intensity: anything outside 0 to 1 is clamped. */
  async play(event: HapticEvent, intensity: number): Promise<void> {
    if (!this.#connected) return
    const level = Number.isFinite(intensity) ? Math.min(1, Math.max(0, intensity)) : 0
    await this.#transport.write(Uint8Array.from([REPORT_MARKER, EVENT_CODES[event], Math.round(level * 255)]))
  }

  onDisconnect(listener: () => void): () => void {
    this.#disconnectListeners.add(listener)
    return () => this.#disconnectListeners.delete(listener)
  }
}
