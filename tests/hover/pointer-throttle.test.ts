import { describe, expect, it, vi } from 'vitest'
import { createPointerThrottle } from '../../src/hover/pointer-throttle'

function setup(intervalMs = 16) {
  let clock = 1000
  let timers: Array<{ id: number; at: number; fn: () => void }> = []
  let nextId = 1
  const handler = vi.fn()
  const throttle = createPointerThrottle(handler, {
    intervalMs,
    now: () => clock,
    schedule: (fn, ms) => {
      const id = nextId++
      timers.push({ id, at: clock + ms, fn })
      return id
    },
    unschedule: (id) => {
      timers = timers.filter((t) => t.id !== id)
    },
  })
  const advance = (ms: number) => {
    clock += ms
    const due = timers.filter((t) => t.at <= clock)
    timers = timers.filter((t) => t.at > clock)
    due.forEach((t) => t.fn())
  }
  return { throttle, handler, advance }
}

describe('createPointerThrottle', () => {
  it('handles the first movement at once, so a click right after it sees the result', () => {
    const { throttle, handler } = setup()
    throttle.push(10, 20)
    expect(handler).toHaveBeenCalledWith(10, 20)
  })

  it('holds back movements that follow too soon, then delivers only the latest', () => {
    const { throttle, handler, advance } = setup()
    throttle.push(1, 1)
    throttle.push(2, 2)
    throttle.push(3, 3)
    expect(handler).toHaveBeenCalledTimes(1)
    advance(16)
    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenLastCalledWith(3, 3)
  })

  it('handles a movement at once again after a quiet moment', () => {
    const { throttle, handler, advance } = setup()
    throttle.push(1, 1)
    advance(40)
    throttle.push(2, 2)
    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenLastCalledWith(2, 2)
  })

  it('drops a held-back movement when cancelled', () => {
    const { throttle, handler, advance } = setup()
    throttle.push(1, 1)
    throttle.push(2, 2)
    throttle.cancel()
    advance(100)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('works again after being cancelled', () => {
    const { throttle, handler, advance } = setup()
    throttle.push(1, 1)
    throttle.push(2, 2)
    throttle.cancel()
    advance(100)
    throttle.push(3, 3)
    expect(handler).toHaveBeenLastCalledWith(3, 3)
  })
})
