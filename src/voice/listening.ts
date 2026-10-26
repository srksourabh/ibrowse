import type { EarconName } from '../audio/earcons'
import type { SpeechService } from '../audio/speech-service'

/** How long iBrowse waits for an answer after asking a question (ADR-0017 #3). */
export const ANSWER_WINDOW_MS = 5000
/** Said when the talk key was held but nothing was made out. */
export const NOTHING_HEARD = "I didn't catch that. Hold Alt+Shift+V and try again."
/** The longest a held key keeps the microphone open. */
export const HOLD_MAX_MS = 15000

/** One request being listened to. */
export interface Listening {
  /** What was said, or null for silence or a cancelled request. Rejects if the recogniser fails. */
  readonly result: Promise<string | null>
  /** Stop listening and give what was heard so far. */
  stop(): void
  /** Stop listening and drop what was heard. */
  cancel(): void
}

/** A source of transcripts: Chrome's recogniser or Gemini (ADR-0017 #1). */
export interface SpeechRecognizer {
  listen(options: { readonly maxMs: number }): Listening
}

export interface ListeningDeps {
  readonly recognizer: SpeechRecognizer
  readonly speech: Pick<SpeechService, 'cancel'>
  readonly earcons: { play(name: EarconName, pan: number): void }
  onHeard(text: string): void
  /** The user held the talk key but nothing was made out. */
  onNothingHeard(): void
  onError(error: Error): void
}

interface Session {
  readonly listening: Listening
  readonly held: boolean
  /** The talk key was let go; the request is now being turned into text. */
  released: boolean
}

/**
 * Decides when the microphone is open: for a short window after iBrowse has
 * asked a question, or while the push-to-talk key is held. Never while
 * iBrowse is speaking, and one request at a time.
 */
export class ListeningController {
  readonly #deps: ListeningDeps
  #session: Session | null = null

  constructor(deps: ListeningDeps) {
    this.#deps = deps
  }

  get isListening(): boolean {
    return this.#session !== null
  }

  /** Called once a question has finished being spoken. */
  listenForAnswer(): void {
    if (this.#session) return
    this.#begin(ANSWER_WINDOW_MS, false)
  }

  startHold(): void {
    // Still held is a key repeat; once released, a new press starts a new request.
    if (this.#session?.held && !this.#session.released) return
    this.cancel()
    // Whatever iBrowse was saying stops, so the microphone hears only the user.
    this.#deps.speech.cancel()
    this.#begin(HOLD_MAX_MS, true)
  }

  endHold(): void {
    const session = this.#session
    if (!session?.held || session.released) return
    session.released = true
    session.listening.stop()
  }

  /** Closes a window opened for an answer, but never a held push-to-talk request. */
  cancelAnswer(): void {
    if (this.#session && !this.#session.held) this.cancel()
  }

  cancel(): void {
    const session = this.#session
    if (!session) return
    this.#end(session)
    session.listening.cancel()
  }

  #begin(maxMs: number, held: boolean): void {
    this.#deps.earcons.play('listen', 0)
    const session: Session = { listening: this.#deps.recognizer.listen({ maxMs }), held, released: false }
    this.#session = session
    session.listening.result.then(
      (text) => {
        if (this.#session !== session) return // cancelled or replaced: a late result is dropped
        this.#end(session)
        if (text && text.trim()) this.#deps.onHeard(text.trim())
        else if (session.held) this.#deps.onNothingHeard()
      },
      (error: unknown) => {
        if (this.#session !== session) return
        this.#end(session)
        this.#deps.onError(error instanceof Error ? error : new Error('Listening failed'))
      },
    )
  }

  #end(session: Session): void {
    if (this.#session !== session) return
    this.#session = null
    this.#deps.earcons.play('listen-end', 0)
  }
}
