import type { EarconEngine } from '../audio/earcons'
import type { SpeechService } from '../audio/speech-service'
import { nextInOrder, type JumpKind } from './landmarks'

export interface JumpNavigatorDeps {
  targets(kind: JumpKind): readonly Element[]
  /** Scrolls the element into view. */
  reveal(el: Element): void
  describe(el: Element, kind: JumpKind): string
  speech: Pick<SpeechService, 'speak'>
  earcons: Pick<EarconEngine, 'play'>
  getRate(): number
}

/**
 * Jumps between headings or landmarks. The navigation cursor is the element
 * last jumped to, hovered or read, so a jump continues from where the user is.
 */
export class JumpNavigator {
  readonly #deps: JumpNavigatorDeps
  #cursor: Element | null = null

  constructor(deps: JumpNavigatorDeps) {
    this.#deps = deps
  }

  get cursor(): Element | null {
    return this.#cursor
  }

  setCursor(el: Element | null): void {
    this.#cursor = el
  }

  jump(kind: JumpKind, direction: 1 | -1): 'moved' | 'none' {
    const { speech, earcons } = this.#deps
    const rate = this.#deps.getRate()
    const target = nextInOrder(this.#deps.targets(kind), this.#cursor, direction)
    if (!target) {
      earcons.play('boundary', 0)
      void speech.speak({ text: `No ${direction > 0 ? 'next' : 'previous'} ${kind}`, rate })
      return 'none'
    }
    this.#cursor = target
    this.#deps.reveal(target)
    earcons.play('tick', 0)
    void speech.speak({ text: this.#deps.describe(target, kind), rate })
    return 'moved'
  }
}
