export function clampPan(pan: number): number {
  return Math.min(1, Math.max(-1, pan))
}

/** Maps a horizontal position to stereo pan: -1 at the left edge, 1 at the right. */
export function panFromX(x: number, viewportWidth: number): number {
  if (viewportWidth <= 0) return 0
  return clampPan((x / viewportWidth) * 2 - 1)
}
