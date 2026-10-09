export type Edge = 'left' | 'right' | 'top' | 'bottom'

const EDGE_PX = 6
/** The finger must be this far from every edge before the cue can play again. */
const REARM_PX = 18

interface Screen {
  readonly width: number
  readonly height: number
}

function edgeAt(x: number, y: number, { width, height }: Screen): Edge | null {
  if (x <= EDGE_PX) return 'left'
  if (x >= width - EDGE_PX) return 'right'
  if (y <= EDGE_PX) return 'top'
  return y >= height - EDGE_PX ? 'bottom' : null
}

/** Plays once when a finger reaches the edge of the screen (PRD FR-7.4). */
export class EdgeCue {
  readonly #play: (edge: Edge) => void
  #current: Edge | null = null

  constructor(play: (edge: Edge) => void) {
    this.#play = play
  }

  update(x: number, y: number, screen: Screen): void {
    const edge = edgeAt(x, y, screen)
    if (edge) {
      if (edge === this.#current) return
      this.#current = edge
      this.#play(edge)
      return
    }
    const nearest = Math.min(x, screen.width - x, y, screen.height - y)
    if (nearest > REARM_PX) this.#current = null
  }
}
