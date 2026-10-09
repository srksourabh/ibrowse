interface Point {
  readonly x: number
  readonly y: number
}

/**
 * A browser extension cannot move the real mouse pointer. This stands in for
 * "the mouse snaps to the finger" (PRD FR-7.3): after a touch, the wheel acts
 * at the touched spot until the mouse is moved again.
 */
export class VirtualPointer {
  #touch: Point | null = null

  noteTouch(x: number, y: number): void {
    this.#touch = { x, y }
  }

  noteMouse(): void {
    this.#touch = null
  }

  /** Where a wheel event should act: the touched spot if there is one, else the mouse position. */
  pointFor(mouse: Point): Point {
    return this.#touch ?? mouse
  }
}
