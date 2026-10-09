/**
 * After a failed submit the browser moves focus to the first invalid field.
 * That focus announcement must not cut off the validation message spoken
 * just before it, so for a moment it waits its turn instead.
 */
export const FOCUS_AFTER_INVALID_MS = 300

export class ValidationGate {
  readonly #now: () => number
  #lastInvalidAt = Number.NEGATIVE_INFINITY

  constructor(now: () => number = () => performance.now()) {
    this.#now = now
  }

  noteInvalid(): void {
    this.#lastInvalidAt = this.#now()
  }

  focusMayInterrupt(): boolean {
    return this.#now() - this.#lastInvalidAt >= FOCUS_AFTER_INVALID_MS
  }
}
