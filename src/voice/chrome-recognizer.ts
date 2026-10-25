import { CloudError } from '../cloud/cloud-error'
import type { Listening, SpeechRecognizer } from './listening'

/** The parts of the Web Speech API's SpeechRecognition that iBrowse uses. */
export interface RecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  processLocally?: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

export interface RecognitionClass {
  new (): RecognitionLike
  available?(options: { langs: string[]; processLocally: boolean }): Promise<string>
}

/** On this computer (Chrome 139+, when the language is installed), or Google's online service. */
export type RecognizerMode = 'on-device' | 'online'

/** Errors that only mean nobody spoke, or the request was stopped. */
const SILENT_ERRORS = new Set(['no-speech', 'aborted'])

/**
 * On-device when the language is already installed. A download is never
 * waited for: it can take minutes, or never finish on some builds.
 */
export async function chooseMode(recognition: RecognitionClass, lang: string): Promise<RecognizerMode> {
  if (typeof recognition.available !== 'function') return 'online'
  try {
    const status = await recognition.available({ langs: [lang], processLocally: true })
    return status === 'available' ? 'on-device' : 'online'
  } catch {
    return 'online'
  }
}

/** Chrome's own recogniser (ADR-0017 #1). Runs in the offscreen document. */
export class ChromeRecognizer implements SpeechRecognizer {
  readonly #Recognition: RecognitionClass
  readonly #lang: string
  readonly #mode: RecognizerMode

  constructor(recognition: RecognitionClass, lang: string, mode: RecognizerMode) {
    this.#Recognition = recognition
    this.#lang = lang
    this.#mode = mode
  }

  listen({ maxMs }: { readonly maxMs: number }): Listening {
    const recognition = new this.#Recognition()
    recognition.lang = this.#lang
    recognition.interimResults = false
    recognition.continuous = false
    recognition.maxAlternatives = 1
    recognition.processLocally = this.#mode === 'on-device'

    let heard: string | null = null
    let failure: string | null = null
    let dropped = false
    const result = new Promise<string | null>((resolve, reject) => {
      recognition.onresult = (event) => {
        heard = Array.from(event.results, (r) => r[0]?.transcript ?? '').join(' ').trim() || null
      }
      recognition.onerror = (event) => {
        if (!SILENT_ERRORS.has(event.error)) failure = event.error
      }
      recognition.onend = () => {
        clearTimeout(timer)
        if (failure && !dropped) reject(new Error(failure))
        else resolve(dropped ? null : heard)
      }
    })
    const timer = setTimeout(() => recognition.stop(), maxMs)
    try {
      recognition.start()
    } catch (error) {
      // For example another recognition is still running: fail now rather than wait out the window.
      clearTimeout(timer)
      const failed = Promise.reject(error instanceof Error ? error : new Error('failed'))
      return { result: failed, stop: () => {}, cancel: () => {} }
    }
    return {
      result,
      stop: () => recognition.stop(),
      cancel: () => {
        dropped = true
        recognition.abort()
      },
    }
  }
}

/** What to say when listening failed, from the browser's error code or Gemini's error kind. */
export function recognitionErrorText(error: Error): string {
  switch (error.message) {
    case 'voice-off':
      return 'Voice commands are off. Turn them on in settings, opened with Alt+Shift+S.'
    case 'no-key':
    case 'bad-key':
    case 'bad-model':
      return new CloudError(error.message).spoken
    case 'rate-limit':
      return "Google's limit has been reached for now. Chrome's speech recognition can be chosen in settings instead."
    case 'not-allowed':
    case 'service-not-allowed':
      return 'The microphone is not allowed. Open settings with Alt+Shift+S and turn on voice to allow it.'
    case 'audio-capture':
      return 'No microphone was found.'
    case 'network':
      return 'Speech recognition needs an internet connection on this computer.'
    default:
      return 'I could not listen just now. Please try again.'
  }
}
