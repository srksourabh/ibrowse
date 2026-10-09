/** An unanswered prompt closes silently after this long. */
export const PROMPT_TIMEOUT_MS = 6000
/** Pointer movement smaller than this does not count as moving away. */
export const MOVE_THRESHOLD_PX = 8

interface Point {
  readonly x: number
  readonly y: number
}

export interface ReadPromptDeps {
  readonly onAccept: () => void
  readonly onDismiss: () => void
}

/** The "Want me to read it?" question and its answer window. */
export class ReadPrompt {
  readonly #deps: ReadPromptDeps
  #open = false
  #timer: ReturnType<typeof setTimeout> | undefined
  #lastPointer: Point | null = null
  #origin: Point | null = null

  constructor(deps: ReadPromptDeps) {
    this.#deps = deps
  }

  get isOpen(): boolean {
    return this.#open
  }

  open(): void {
    this.#open = true
    this.#origin = this.#lastPointer
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => this.#close(), PROMPT_TIMEOUT_MS)
  }

  /** Closes without calling anything. */
  dismiss(): void {
    this.#close()
  }

  /** Returns true when the key answered the prompt, so the caller can swallow it. */
  handleKey(key: string): boolean {
    if (!this.#open) return false
    if (key === 'y' || key === 'Y' || key === 'Enter') {
      this.#close()
      this.#deps.onAccept()
      return true
    }
    if (key === 'n' || key === 'N' || key === 'Escape') {
      this.#close()
      this.#deps.onDismiss()
      return true
    }
    return false
  }

  handlePointerMove(x: number, y: number): void {
    this.#lastPointer = { x, y }
    if (!this.#open) return
    if (!this.#origin) {
      this.#origin = { x, y }
      return
    }
    if (Math.hypot(x - this.#origin.x, y - this.#origin.y) >= MOVE_THRESHOLD_PX) {
      this.#close()
      this.#deps.onDismiss()
    }
  }

  #close(): void {
    this.#open = false
    this.#origin = null
    clearTimeout(this.#timer)
  }
}
