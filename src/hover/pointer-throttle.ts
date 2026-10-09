const FRAME_MS = 16

interface Point {
  readonly x: number
  readonly y: number
}

export interface PointerThrottleOptions {
  readonly intervalMs?: number
  readonly now?: () => number
  readonly schedule?: (callback: () => void, delayMs: number) => unknown
  readonly unschedule?: (handle: unknown) => void
}

/**
 * Pointer events can arrive hundreds of times a second. The first movement
 * of a burst is handled at once, so a click or tap straight after it already
 * sees the result; movements that follow within a frame are held back and
 * only the latest is delivered.
 */
export function createPointerThrottle(
  handler: (x: number, y: number) => void,
  options: PointerThrottleOptions = {},
): { push(x: number, y: number): void; cancel(): void } {
  const interval = options.intervalMs ?? FRAME_MS
  const now = options.now ?? (() => performance.now())
  const schedule = options.schedule ?? ((callback, delay) => setTimeout(callback, delay))
  const unschedule =
    options.unschedule ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))

  let lastRunAt = Number.NEGATIVE_INFINITY
  let pending: Point | null = null
  let timer: unknown = null

  const run = (x: number, y: number): void => {
    lastRunAt = now()
    handler(x, y)
  }

  return {
    push(x, y) {
      const wait = lastRunAt + interval - now()
      if (wait <= 0 && timer === null) {
        run(x, y)
        return
      }
      pending = { x, y }
      if (timer !== null) return
      timer = schedule(() => {
        timer = null
        const point = pending
        pending = null
        if (point) run(point.x, point.y)
      }, Math.max(wait, 0))
    },
    cancel() {
      pending = null
      if (timer !== null) unschedule(timer)
      timer = null
    },
  }
}
