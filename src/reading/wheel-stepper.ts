/** A wheel movement at least this big is one deliberate notch. */
const NOTCH_PX = 50
const LINE_PX = 40
const PAGE_PX = 800

export function deltaToPixels(delta: number, deltaMode: number): number {
  if (deltaMode === 1) return delta * LINE_PX
  return deltaMode === 2 ? delta * PAGE_PX : delta
}

const signOf = (n: number): -1 | 1 => (n < 0 ? -1 : 1)

/**
 * Turns wheel events into word steps. A mouse notch (any size from 50 px up)
 * is exactly one step, whether it reports 100 or 120. A trackpad sends many
 * small movements, which add up to one step per 50 px.
 */
export class WheelStepper {
  #accumulated = 0

  push(deltaY: number, deltaMode: number): -1 | 0 | 1 {
    const pixels = deltaToPixels(deltaY, deltaMode)
    if (pixels === 0) return 0
    if (Math.abs(pixels) >= NOTCH_PX) {
      this.#accumulated = 0
      return signOf(pixels)
    }
    if (this.#accumulated !== 0 && signOf(this.#accumulated) !== signOf(pixels)) {
      this.#accumulated = 0
    }
    this.#accumulated += pixels
    if (Math.abs(this.#accumulated) < NOTCH_PX) return 0
    const direction = signOf(this.#accumulated)
    this.#accumulated = 0
    return direction
  }

  reset(): void {
    this.#accumulated = 0
  }
}
