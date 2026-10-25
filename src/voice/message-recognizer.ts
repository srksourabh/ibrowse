import type { Listening, SpeechRecognizer } from './listening'
import type { ListenRequest, ListenResponse } from './messages'

/** The page's view of the recogniser, which runs in the offscreen document behind the background worker. */
export class MessageRecognizer implements SpeechRecognizer {
  readonly #send: (request: ListenRequest) => Promise<ListenResponse>
  #nextId = 1

  constructor(send: (request: ListenRequest) => Promise<ListenResponse>) {
    this.#send = send
  }

  listen({ maxMs }: { readonly maxMs: number }): Listening {
    const id = this.#nextId++
    const result = this.#send({ type: 'listen-start', id, maxMs }).then((response) => {
      if (!response.ok) throw new Error(response.error)
      return response.text
    })
    // A stop or cancel that cannot reach the worker changes nothing: the request ends on its own.
    const tell = (type: 'listen-stop' | 'listen-cancel'): void => void this.#send({ type, id }).catch(() => {})
    return { result, stop: () => tell('listen-stop'), cancel: () => tell('listen-cancel') }
  }
}
