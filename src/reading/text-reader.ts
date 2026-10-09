import type { EarconEngine } from '../audio/earcons'
import type { SpeechService } from '../audio/speech-service'
import type { HoverController } from '../hover/hover-controller'
import type { PageNavigator } from '../navigation/page-navigator'
import { WordScrubber } from './scrubber'
import { WheelStepper, deltaToPixels } from './wheel-stepper'
import { spellWord } from './words'

/** The parts of a WheelEvent the reader uses. */
export interface WheelLike {
  readonly deltaY: number
  readonly deltaMode: number
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly ctrlKey: boolean
  readonly clientX: number
  readonly clientY: number
  preventDefault(): void
}

export interface TextReaderDeps {
  blockAt(x: number, y: number): Element | null
  textOf(block: Element): string
  adjacentBlock(block: Element, direction: 1 | -1): Element | null
  speech: Pick<SpeechService, 'speak'>
  earcons: Pick<EarconEngine, 'play'>
  hover: Pick<HoverController, 'cancelDwell'>
  navigator: Pick<PageNavigator, 'scrollBy'>
  /** Stereo pan for a horizontal position in this frame, measured against the whole window. */
  panAt(x: number): number
  getRate(): number
}

/**
 * Reading Mode: wheel scrubbing word by word, spelling, and reading a block
 * aloud. Over anything that is not text the wheel is left alone.
 */
export class TextReader {
  readonly #deps: TextReaderDeps
  readonly #scrubber: WordScrubber
  readonly #stepper = new WheelStepper()

  constructor(deps: TextReaderDeps) {
    this.#deps = deps
    this.#scrubber = new WordScrubber({ textOf: deps.textOf, adjacentBlock: deps.adjacentBlock })
  }

  onWheel(event: WheelLike): void {
    // Ctrl+wheel is the browser's zoom; leave it alone (ADR-0011).
    if (event.ctrlKey) return
    if (event.altKey) {
      event.preventDefault()
      this.#deps.navigator.scrollBy(deltaToPixels(event.deltaY, event.deltaMode))
      return
    }

    const block = this.#deps.blockAt(event.clientX, event.clientY)
    if (!block) return
    event.preventDefault()
    // A late hover description must not talk over the word just spoken.
    this.#deps.hover.cancelDwell()

    if (this.#scrubber.block !== block) {
      this.#scrubber.start(block)
      this.#stepper.reset()
    }
    if (event.shiftKey) {
      const word = this.#scrubber.word
      if (word) this.#say(spellWord(word))
      return
    }

    const direction = this.#stepper.push(event.deltaY, event.deltaMode)
    if (direction === 0) return
    const pan = this.#deps.panAt(event.clientX)
    const result = this.#scrubber.step(direction)
    if (result.kind === 'word') {
      this.#deps.earcons.play(result.changedBlock ? 'edge' : 'tick', pan)
      this.#say(result.word)
    } else {
      this.#deps.earcons.play('boundary', pan)
      this.#say(result.edge === 'end' ? 'End of text' : 'Start of text')
    }
  }

  /** Reads a whole block aloud. The wheel then continues from its first word. */
  readBlock(block: Element): void {
    // A click soon after the pointer arrived must not be cut off by the hover description.
    this.#deps.hover.cancelDwell()
    this.#scrubber.start(block)
    this.#stepper.reset()
    this.#say(this.#deps.textOf(block), 'reading')
  }

  /** Reads from the current word to the end of its block. False if scrubbing has not begun. */
  readFromHere(): boolean {
    if (!this.#scrubber.block) return false
    this.#say(this.#scrubber.remainingText(), 'reading')
    return true
  }

  /** `kind: 'reading'` marks long-form text, which a cloud voice may speak. Words and cues stay local. */
  #say(text: string, kind?: 'reading'): void {
    void this.#deps.speech.speak({ text, rate: this.#deps.getRate(), ...(kind ? { kind } : {}) })
  }
}
