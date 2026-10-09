import type { ConnectResult, HapticCapabilities, HapticDriver } from './driver'
import type { HapticEvent } from './events'
import type { HapticRequest, HapticResponse } from './messages'

const UNREACHABLE = 'Haptic device could not be reached. Continuing with sound only.'

/**
 * Stands in, inside a web page, for a device that lives in the background
 * worker (WebHID). The device itself decides which events it can express.
 */
export class RelayDriver implements HapticDriver {
  readonly id = 'webhid'
  readonly name = 'Paired haptic device'
  readonly #send: (request: HapticRequest) => Promise<HapticResponse>
  readonly #disconnectListeners = new Set<() => void>()

  constructor(send: (request: HapticRequest) => Promise<HapticResponse>) {
    this.#send = send
  }

  capabilities(): HapticCapabilities {
    return { events: 'all' }
  }

  async connect(): Promise<ConnectResult> {
    try {
      return await this.#send({ type: 'haptic-connect' })
    } catch {
      return { ok: false, reason: UNREACHABLE }
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.#send({ type: 'haptic-disconnect' })
    } catch {
      // The worker may already be gone, which is the same as the device being let go.
    }
  }

  async play(event: HapticEvent, intensity: number): Promise<void> {
    const response = await this.#send({ type: 'haptic-play', event, intensity })
    if (!response.ok) throw new Error(response.reason)
  }

  onDisconnect(listener: () => void): () => void {
    this.#disconnectListeners.add(listener)
    return () => this.#disconnectListeners.delete(listener)
  }

  /** Called when the background worker reports that the device went away. */
  handleDisconnected(): void {
    this.#disconnectListeners.forEach((listener) => listener())
  }
}
