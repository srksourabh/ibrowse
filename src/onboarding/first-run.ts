import type { KeyValueStore, Settings } from '../shared/settings'

export type ScreenReaderMode = Settings['screenReaderMode']

export const QUESTION = 'Do you use a screen reader? Press Y for yes, N for no.'

/**
 * How long the live region has the question to itself before iBrowse also says
 * it. A screen reader reads the new page's title and the live region first.
 */
export const QUESTION_VOICE_DELAY_MS = 1500

const COMPANION_CHOSEN =
  'Thank you. Your screen reader will speak for iBrowse, so you hear one voice. ' +
  'You can change this in settings, under Screen reader mode.'
const STANDALONE_CHOSEN =
  'Thank you. iBrowse will speak in its own voice. ' +
  'If you start a screen reader later, change Screen reader mode in settings.'

export interface QuestionDeps {
  /** Writes to the live region, which a screen reader speaks. */
  announce(text: string): void
  /** Speaks in iBrowse's own voice; settles when it has finished. */
  voice(text: string): Promise<void>
  save(mode: ScreenReaderMode): Promise<void>
  /** Runs `run` after QUESTION_VOICE_DELAY_MS; returns a cancel function. */
  later(run: () => void): () => void
  /** Called once with the chosen mode, after it is saved. */
  done(mode: ScreenReaderMode): void
}

/**
 * The first question iBrowse asks, before it speaks anything else on its own
 * (ADR-0019). A screen reader cannot be detected from a web page, except
 * ChromeVox, so the user is always asked; detection only keeps iBrowse's own
 * voice out of the way.
 */
export class ScreenReaderQuestion {
  readonly #deps: QuestionDeps
  #state: 'idle' | 'asking' | 'answered' = 'idle'
  #cancelVoice: () => void = () => {}

  constructor(deps: QuestionDeps) {
    this.#deps = deps
  }

  start(hint: { readonly screenReaderDetected: boolean }): void {
    this.#state = 'asking'
    this.#deps.announce(QUESTION)
    if (hint.screenReaderDetected) return
    this.#cancelVoice = this.#deps.later(() => {
      if (this.#state === 'asking') void this.#deps.voice(QUESTION)
    })
  }

  /** Y or N by physical key, so any keyboard layout works. Returns true if the key was an answer. */
  handleKey(code: string): boolean {
    if (this.#state !== 'asking' || (code !== 'KeyY' && code !== 'KeyN')) return false
    this.answer(code === 'KeyY')
    return true
  }

  answer(usesScreenReader: boolean): void {
    if (this.#state !== 'asking') return
    this.#state = 'answered'
    this.#cancelVoice()
    const mode: ScreenReaderMode = usesScreenReader ? 'companion' : 'standalone'
    void this.#confirm(mode).then(() => this.#deps.done(mode))
  }

  /** Saves the answer and says what it means. The thank-you is heard in full before the tour starts. */
  async #confirm(mode: ScreenReaderMode): Promise<void> {
    await this.#deps.save(mode)
    if (mode === 'companion') return this.#deps.announce(COMPANION_CHOSEN)
    this.#deps.announce(STANDALONE_CHOSEN)
    await this.#deps.voice(STANDALONE_CHOSEN).catch(() => {})
  }
}

const ANSWERED_KEY = 'screenReaderAnswered'

export async function hasAnsweredScreenReader(store: KeyValueStore): Promise<boolean> {
  return (await store.get(ANSWERED_KEY))[ANSWERED_KEY] === true
}

export function markScreenReaderAnswered(store: KeyValueStore): Promise<void> {
  return store.set({ [ANSWERED_KEY]: true })
}
