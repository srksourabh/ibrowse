export interface Utterance {
  readonly text: string
  readonly rate?: number
  readonly pitch?: number
  readonly volume?: number
  /** A local voice, by the name the operating system gives it. */
  readonly voiceName?: string
  /**
   * Stereo pan, -1 to 1. Local voices cannot be panned in a browser, so only a
   * voice whose audio the extension controls (a cloud voice) can use it.
   */
  readonly pan?: number
  /**
   * 'reading' marks long-form text. A cloud voice, if one is on, speaks only
   * this; quick spoken feedback stays on the local voice, which starts at once.
   */
  readonly kind?: 'reading'
  /** Called when the sound actually begins, so the delay can be measured. */
  readonly onStart?: () => void
}

/** A source of voice. Local OS voices and optional cloud voices both implement this. */
export interface SpeechProvider {
  /** Resolves when speech ends or is cut off; rejects if the voice fails. */
  speak(utterance: Utterance): Promise<void>
  cancel(): void
}

export type SpeechOutcome = 'finished' | 'cancelled' | 'failed'

export interface SpeechServiceOptions {
  readonly onError?: (error: Error) => void
}

interface Entry {
  readonly utterance: Utterance
  readonly resolve: (outcome: SpeechOutcome) => void
}

/**
 * Queues and cancels Utterances. By default a new Utterance interrupts the
 * current one, which keeps speech from piling up while the pointer moves.
 */
export class SpeechService {
  readonly #provider: SpeechProvider
  readonly #onError: (error: Error) => void
  #queue: Entry[] = []
  #active: Entry | null = null
  #lastText: string | null = null

  constructor(provider: SpeechProvider, options: SpeechServiceOptions = {}) {
    this.#provider = provider
    this.#onError = options.onError ?? (() => {})
  }

  /** True while anything is being spoken or waiting to be. */
  get isBusy(): boolean {
    return this.#active !== null || this.#queue.length > 0
  }

  /** The text of the last Utterance asked for, so the user can have it repeated. */
  get lastText(): string | null {
    return this.#lastText
  }

  speak(utterance: Utterance, options: { interrupt?: boolean } = {}): Promise<SpeechOutcome> {
    this.#lastText = utterance.text
    return new Promise((resolve) => {
      if (options.interrupt ?? true) this.cancel()
      this.#queue.push({ utterance, resolve })
      this.#pump()
    })
  }

  cancel(): void {
    const dropped = this.#active ? [this.#active, ...this.#queue] : [...this.#queue]
    this.#active = null
    this.#queue = []
    if (dropped.length === 0) return
    this.#provider.cancel()
    dropped.forEach((entry) => entry.resolve('cancelled'))
  }

  #pump(): void {
    if (this.#active) return
    const next = this.#queue.shift()
    if (!next) return
    this.#active = next
    this.#provider.speak(next.utterance).then(
      () => this.#settle(next, 'finished'),
      (error: unknown) => {
        if (this.#active === next) {
          this.#onError(error instanceof Error ? error : new Error('Speech failed'))
        }
        this.#settle(next, 'failed')
      },
    )
  }

  #settle(entry: Entry, outcome: SpeechOutcome): void {
    // A cancelled Utterance may complete late; its entry is no longer active.
    if (this.#active !== entry) return
    this.#active = null
    entry.resolve(outcome)
    this.#pump()
  }
}
