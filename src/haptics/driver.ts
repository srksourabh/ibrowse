import type { HapticEvent } from './events'

export type ConnectResult =
  | { readonly ok: true }
  /** `reason` is spoken to the user, so it must read as a plain sentence. */
  | { readonly ok: false; readonly reason: string }

export interface HapticCapabilities {
  /** The events the device can express, or 'all'. Others are skipped, not faked. */
  readonly events: 'all' | readonly HapticEvent[]
}

/**
 * The contract a haptic device driver follows. Anyone can write one for their
 * own hardware; `runConformance` checks it.
 */
export interface HapticDriver {
  /** A short stable identifier, lower case, for example "my-mouse". */
  readonly id: string
  /** The name a person would call the device. */
  readonly name: string
  capabilities(): HapticCapabilities
  /** Gets the device ready. Never throws for a missing device: say so in `reason`. */
  connect(): Promise<ConnectResult>
  disconnect(): Promise<void>
  /**
   * Plays an event at an intensity from 0 to 1. Must not block, and must not
   * throw for an unsupported event or an out-of-range intensity.
   */
  play(event: HapticEvent, intensity: number): void | Promise<void>
  /** Calls the listener if the device goes away. Returns a function that stops listening. */
  onDisconnect(listener: () => void): () => void
}
