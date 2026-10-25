import type { Listening, SpeechRecognizer } from './listening'
import type { ListenRequest, ListenResponse } from './messages'

/** How long after its window a request may still take to answer (a Gemini round trip) before it is given up. */
const GRACE_MS = 20_000
const ID_SPACE = 1_000_000_000

export interface MessageRecognizerOptions {
  /** The first request number; random by default, so a reloaded page never reuses the old ones. */
  readonly firstId?: number
  readonly graceMs?: number
}

/** The page's view of the recogniser, which runs in the offscreen document behind the background worker. */
export class MessageRecognizer implements SpeechRecognizer {
  readonly #send: (request: ListenRequest) => Promise<ListenResponse>
  readonly #graceMs: number
  #nextId: number

  constructor(send: (request: ListenRequest) => Promise<ListenResponse>, options: MessageRecognizerOptions = {}) {
    this.#send = send
    this.#graceMs = options.graceMs ?? GRACE_MS
    this.#nextId = options.firstId ?? Math.floor(Math.random() * ID_SPACE)
  }

  listen({ maxMs }: { readonly maxMs: number }): Listening {
    const id = this.#nextId++
    const answered = this.#send({ type: 'listen-start', id, maxMs }).then((response) => {
      if (!response.ok) throw new Error(response.error)
      return response.text
    })
    // A request that never answers would leave listening stuck, so it is given up.
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), maxMs + this.#graceMs)
    })
    const result = Promise.race([answered, timeout]).finally(() => clearTimeout(timer))
    // A stop or cancel that cannot reach the worker changes nothing: the request ends on its own.
    const tell = (type: 'listen-stop' | 'listen-cancel'): void => void this.#send({ type, id }).catch(() => {})
    return { result, stop: () => tell('listen-stop'), cancel: () => tell('listen-cancel') }
  }
}
