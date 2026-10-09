export interface Rect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface Viewport {
  readonly width: number
  readonly height: number
}

export type Horizontal = 'left' | 'center' | 'right'
export type Vertical = 'top' | 'middle' | 'bottom'

export interface Placement {
  readonly horizontal: Horizontal
  readonly vertical: Vertical
}

/** Which third of an axis a position falls in. A zero-size axis counts as the middle. */
function third(position: number, size: number): 0 | 1 | 2 {
  if (size <= 0) return 1
  const ratio = position / size
  if (ratio < 1 / 3) return 0
  return ratio > 2 / 3 ? 2 : 1
}

/** Where the centre of a rectangle sits on the screen, in thirds. */
export function placementOf(rect: Rect, viewport: Viewport): Placement {
  const horizontal = (['left', 'center', 'right'] as const)[
    third(rect.left + rect.width / 2, viewport.width)
  ]
  const vertical = (['top', 'middle', 'bottom'] as const)[
    third(rect.top + rect.height / 2, viewport.height)
  ]
  return { horizontal, vertical }
}

const PHRASES: Readonly<Record<Vertical, Readonly<Record<Horizontal, string>>>> = {
  top: { left: 'top left', center: 'at the top', right: 'top right' },
  middle: { left: 'on the left', center: 'in the middle', right: 'on the right' },
  bottom: { left: 'bottom left', center: 'at the bottom', right: 'bottom right' },
}

export function placementPhrase(placement: Placement): string {
  return PHRASES[placement.vertical][placement.horizontal]
}
