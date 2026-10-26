import type { SpeechRequest, SpeechResponse, WireUtterance } from '../shared/messages'
import type { SpeechProvider, Utterance } from './speech-service'

interface TtsEvent {
  readonly type: string
  readonly errorMessage?: string
}

interface TtsOptions {
  rate?: number
  pitch?: number
  volume?: number
  voiceName?: string
  onEvent?: (event: TtsEvent) => void
}

/** The slice of chrome.tts the provider uses. */
export interface TtsApi {
  speak(text: string, options: TtsOptions): void
  stop(): void
}

/** Local OS voices through chrome.tts. Runs in the background worker. */
export class ChromeTtsProvider implements SpeechProvider {
  readonly #tts: TtsApi

  constructor(tts: TtsApi) {
    this.#tts = tts
  }

  speak(utterance: Utterance): Promise<void> {
    return new Promise((resolve, reject) => {
      let started = false
      const onEvent = (event: TtsEvent): void => {
        if (event.type === 'start' && !started) {
          started = true
          utterance.onStart?.()
        } else if (
          event.type === 'end' ||
          event.type === 'interrupted' ||
          event.type === 'cancelled'
        ) {
          resolve()
        } else if (event.type === 'error') {
          reject(new Error(event.errorMessage || 'Speech failed'))
        }
      }
      // Only what was asked for is passed on, so the engine keeps its own defaults for the rest.
      this.#tts.speak(utterance.text, {
        onEvent,
        ...(utterance.rate === undefined ? {} : { rate: utterance.rate }),
        ...(utterance.pitch === undefined ? {} : { pitch: utterance.pitch }),
        ...(utterance.volume === undefined ? {} : { volume: utterance.volume }),
        ...(utterance.voiceName === undefined ? {} : { voiceName: utterance.voiceName }),
      })
    })
  }

  cancel(): void {
    this.#tts.stop()
  }
}

function toWire(utterance: Utterance): WireUtterance {
  return {
    text: utterance.text,
    ...(utterance.rate === undefined ? {} : { rate: utterance.rate }),
    ...(utterance.pitch === undefined ? {} : { pitch: utterance.pitch }),
    ...(utterance.volume === undefined ? {} : { volume: utterance.volume }),
    ...(utterance.voiceName === undefined ? {} : { voiceName: utterance.voiceName }),
  }
}

/** Forwards speech to the background worker, where chrome.tts lives. */
export class MessageSpeechProvider implements SpeechProvider {
  readonly #send: (request: SpeechRequest) => Promise<SpeechResponse>
  readonly #onCancelError: (error: unknown) => void
  readonly #waitingForStart = new Map<number, () => void>()
  #nextId = 1

  /**
   * `onCancelError` receives failures of the fire-and-forget cancel message.
   * Speech failures are not reported here: `speak` rejects and the
   * SpeechService reports them.
   */
  constructor(
    send: (request: SpeechRequest) => Promise<SpeechResponse>,
    onCancelError: (error: unknown) => void = () => {},
  ) {
    this.#send = send
    this.#onCancelError = onCancelError
  }

  async speak(utterance: Utterance): Promise<void> {
    const id = this.#nextId++
    if (utterance.onStart) this.#waitingForStart.set(id, utterance.onStart)
    try {
      const response = await this.#send({ type: 'speak', id, utterance: toWire(utterance) })
      if (!response.ok) throw new Error(response.error)
    } finally {
      this.#waitingForStart.delete(id)
    }
  }

  cancel(): void {
    this.#send({ type: 'cancel' }).catch(this.#onCancelError)
  }

  /** The worker reports that the sound of request `id` has begun. */
  handleStarted(id: number): void {
    const onStart = this.#waitingForStart.get(id)
    if (!onStart) return
    this.#waitingForStart.delete(id)
    onStart()
  }
}
