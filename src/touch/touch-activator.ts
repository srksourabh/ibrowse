import type { Settings } from '../shared/settings'

/** A second tap this soon after the first, anywhere on the screen, is a double tap. */
export const DOUBLE_TAP_MS = 400
const TAP_MAX_MS = 300
const TAP_MAX_MOVE_PX = 10

export interface TouchActivatorDeps {
  activate(el: Element): void
  targetAt(x: number, y: number): Element | null
  /** The element last explored with a finger. */
  current(): Element | null
  getMode(): Settings['touchActivation']
  now(): number
}

interface TouchStart {
  readonly x: number
  readonly y: number
  readonly at: number
}

/**
 * Decides when a touch activates something (PRD FR-7.2). Dragging explores.
 * In 'lift' mode a double tap anywhere activates the last explored item; in
 * 'direct' mode a tap activates what is under the finger.
 */
export class TouchActivator {
  readonly #deps: TouchActivatorDeps
  #start: TouchStart | null = null
  #moved = false
  #lastTapAt: number | null = null
  /** What had been explored when the current run of taps began. */
  #explored: Element | null = null

  constructor(deps: TouchActivatorDeps) {
    this.#deps = deps
  }

  down(x: number, y: number): void {
    const now = this.#deps.now()
    this.#start = { x, y, at: now }
    this.#moved = false
    // The taps of a double tap land anywhere, and each moves the pointer on, so the
    // item to activate is the one explored before the first of them.
    const continuesDoubleTap = this.#lastTapAt !== null && now - this.#lastTapAt <= DOUBLE_TAP_MS
    if (!continuesDoubleTap) this.#explored = this.#deps.current()
  }

  move(x: number, y: number): void {
    const start = this.#start
    if (start && Math.hypot(x - start.x, y - start.y) >= TAP_MAX_MOVE_PX) this.#moved = true
  }

  up(x: number, y: number): void {
    const start = this.#start
    this.#start = null
    if (!start) return
    const now = this.#deps.now()

    if (this.#moved || now - start.at > TAP_MAX_MS) {
      this.#lastTapAt = null // dragging or holding is exploring, and breaks a double tap
      return
    }
    if (this.#deps.getMode() === 'direct') {
      this.#activate(this.#deps.targetAt(x, y))
      return
    }
    if (this.#lastTapAt !== null && now - this.#lastTapAt <= DOUBLE_TAP_MS) {
      this.#lastTapAt = null
      this.#activate(this.#explored)
      return
    }
    this.#lastTapAt = now
  }

  #activate(el: Element | null): void {
    if (el) this.#deps.activate(el)
  }
}
