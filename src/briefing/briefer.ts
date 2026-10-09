import type { SpeechService } from '../audio/speech-service'
import type { HoverController } from '../hover/hover-controller'
import { briefingText } from './briefing-text'
import type { LayoutModel } from './layout-model'
import { ReadPrompt } from './read-prompt'

export interface BrieferDeps {
  analyze(scope: 'page' | 'viewport'): LayoutModel
  /** The text of each block in reading order, starting at `from` or at the main content. */
  readTexts(from: Element | null): string[]
  speech: Pick<SpeechService, 'speak' | 'cancel'>
  hover: Pick<HoverController, 'setMuted'>
  getRate(): number
  /** An AI one-line purpose for the page. Resolves to null when there is none, and never rejects. */
  enrich?(): Promise<string | null>
}

const NOTHING_TO_READ = 'Nothing to read on this page.'

/** Gives the Page Briefing and the Read Prompt, and reads the whole page on request. */
export class Briefer {
  readonly #deps: BrieferDeps
  readonly #prompt: ReadPrompt
  #readToken = 0
  /** Bumped whenever the user moves on, so a late AI answer is not spoken over what they chose. */
  #epoch = 0

  constructor(deps: BrieferDeps) {
    this.#deps = deps
    this.#prompt = new ReadPrompt({ onAccept: () => this.readAll(), onDismiss: () => {} })
  }

  brief(options: { interrupt?: boolean; detailed?: boolean } = {}): void {
    const { text, askToRead } = briefingText(this.#deps.analyze('page'), {
      detailed: options.detailed ?? false,
    })
    void this.#deps.speech.speak(
      { text, rate: this.#deps.getRate() },
      { interrupt: options.interrupt ?? true },
    )
    if (askToRead) this.#prompt.open()
    else this.#prompt.dismiss()
    this.#speakPurposeWhenReady(++this.#epoch)
  }

  /**
   * Reads every block, from `from` if given. Hover is muted so moving the
   * pointer does not cut it off.
   */
  readAll(from: Element | null = null): void {
    const rate = this.#deps.getRate()
    const texts = this.#deps.readTexts(from)
    if (texts.length === 0) {
      void this.#deps.speech.speak({ text: NOTHING_TO_READ, rate }, { interrupt: true })
      return
    }

    const token = ++this.#readToken
    this.#epoch++
    this.#deps.hover.setMuted(true)
    const finished = texts.map((text, i) =>
      // Reading aloud is long-form, so a cloud voice may take it; quick feedback stays local.
      this.#deps.speech.speak({ text, rate, kind: 'reading' }, { interrupt: i === 0 }),
    )
    // Cancelling resolves every queued block too, so this also fires on stop().
    // A newer reading has a newer token, so an older one cannot unmute it.
    void Promise.all(finished).then(() => {
      if (token === this.#readToken) this.#deps.hover.setMuted(false)
    })
  }

  stop(): void {
    this.#epoch++
    this.#prompt.dismiss()
    this.#deps.speech.cancel()
  }

  handleKey(key: string): boolean {
    return this.#prompt.handleKey(key)
  }

  /**
   * Speaks the AI's one-line purpose when it arrives, after the briefing and
   * in its turn, but only if the user has not moved on since: starting to read,
   * pressing Esc, or asking for a new briefing all drop it.
   */
  #speakPurposeWhenReady(epoch: number): void {
    const { enrich } = this.#deps
    if (!enrich) return
    void enrich().then((text) => {
      if (!text || epoch !== this.#epoch) return
      void this.#deps.speech.speak(
        { text, rate: this.#deps.getRate(), kind: 'reading' },
        { interrupt: false },
      )
    })
  }

  handlePointerMove(x: number, y: number): void {
    this.#prompt.handlePointerMove(x, y)
  }
}
