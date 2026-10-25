import type { SpeechOutcome, SpeechService } from '../audio/speech-service'
import type { ListeningController } from './listening'

/** How much longer the pointer must rest, after the description, before iBrowse asks. */
export const REST_MS = 1000
export const ASK_QUESTION = 'What would you like to do?'

export interface AskAfterRestDeps {
  /** Voice commands are on. */
  isOn(): boolean
  /** What the pointer rests on now. */
  current(): Element | null
  speech: Pick<SpeechService, 'speak' | 'isBusy'>
  listening: Pick<ListeningController, 'listenForAnswer' | 'cancelAnswer'>
  getRate(): number
}

/**
 * After hover has described something, and the pointer stays on it a further
 * second, asks what the user wants to do, then listens for the answer
 * (PRD FR-11.2). Sweeping across a page never triggers it.
 */
export class AskAfterRest {
  readonly #deps: AskAfterRestDeps
  #timer: ReturnType<typeof setTimeout> | undefined
  #round = 0

  constructor(deps: AskAfterRestDeps) {
    this.#deps = deps
  }

  described(target: Element, spoken: Promise<SpeechOutcome>): void {
    if (!this.#deps.isOn()) return
    const round = ++this.#round
    void spoken.then((outcome) => {
      if (outcome !== 'finished' || !this.#still(round, target)) return
      this.#timer = setTimeout(() => void this.#ask(round, target), REST_MS)
    })
  }

  /** The pointer moved to something else: drop the question, and close a window opened for it. */
  moved(_target: Element | null): void {
    this.stop()
    this.#deps.listening.cancelAnswer()
  }

  stop(): void {
    this.#round++
    clearTimeout(this.#timer)
  }

  async #ask(round: number, target: Element): Promise<void> {
    if (!this.#still(round, target)) return
    const outcome = await this.#deps.speech.speak(
      { text: ASK_QUESTION, rate: this.#deps.getRate() },
      { interrupt: false },
    )
    // Never while something else is still to be said (an alert, a message): the microphone would hear it.
    if (outcome === 'finished' && !this.#deps.speech.isBusy && this.#still(round, target)) {
      this.#deps.listening.listenForAnswer()
    }
  }

  #still(round: number, target: Element): boolean {
    return round === this.#round && this.#deps.current() === target
  }
}
