import { tokenize } from './words'

export type ScrubResult =
  | { readonly kind: 'word'; readonly word: string; readonly changedBlock: boolean }
  | { readonly kind: 'boundary'; readonly edge: 'start' | 'end' }

export interface ScrubberDeps {
  textOf(block: Element): string
  adjacentBlock(block: Element, direction: 1 | -1): Element | null
}

/**
 * A word cursor over a text block. At either end of the block the first push
 * only reports the Boundary; a second push in the same direction carries on
 * into the neighbouring block.
 */
export class WordScrubber {
  readonly #deps: ScrubberDeps
  #block: Element | null = null
  #words: string[] = []
  #index = -1
  #pendingEdge: 'start' | 'end' | null = null

  constructor(deps: ScrubberDeps) {
    this.#deps = deps
  }

  get block(): Element | null {
    return this.#block
  }

  /** The word at the cursor, or null before the first step. */
  get word(): string | null {
    return this.#index >= 0 ? (this.#words[this.#index] ?? null) : null
  }

  start(block: Element): void {
    this.#load(block, -1)
  }

  step(direction: 1 | -1): ScrubResult {
    const target = this.#index + direction
    if (target >= 0 && target < this.#words.length) {
      this.#index = target
      this.#pendingEdge = null
      return this.#wordResult(false)
    }

    const edge = direction > 0 ? 'end' : 'start'
    if (this.#pendingEdge !== edge) {
      this.#pendingEdge = edge
      return { kind: 'boundary', edge }
    }

    const next = this.#block ? this.#deps.adjacentBlock(this.#block, direction) : null
    const words = next ? tokenize(this.#deps.textOf(next)) : []
    if (!next || words.length === 0) return { kind: 'boundary', edge }
    this.#load(next, direction > 0 ? 0 : words.length - 1)
    return this.#wordResult(true)
  }

  /** The text from the cursor to the end of the block. */
  remainingText(): string {
    return this.#words.slice(Math.max(this.#index, 0)).join(' ')
  }

  #load(block: Element, index: number): void {
    this.#block = block
    this.#words = tokenize(this.#deps.textOf(block))
    this.#index = index
    this.#pendingEdge = null
  }

  #wordResult(changedBlock: boolean): ScrubResult {
    return { kind: 'word', word: this.#words[this.#index] ?? '', changedBlock }
  }
}
