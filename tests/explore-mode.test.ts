import { describe, expect, it, vi } from 'vitest'
import { ExploreMode } from '../src/explore-mode'

function setup() {
  const target = new EventTarget()
  const add = vi.spyOn(target, 'addEventListener')
  const remove = vi.spyOn(target, 'removeEventListener')
  const wheel = vi.fn()
  const mode = new ExploreMode(target, { wheel })
  return { target, add, remove, wheel, mode }
}

describe('ExploreMode', () => {
  it('is off and registers no listeners until enabled', () => {
    const { add, mode } = setup()
    expect(mode.isEnabled).toBe(false)
    expect(add).not.toHaveBeenCalled()
  })

  it('does not call handlers while off', () => {
    const { target, wheel } = setup()
    target.dispatchEvent(new Event('wheel'))
    expect(wheel).not.toHaveBeenCalled()
  })

  it('registers listeners as non-passive when enabled so the wheel can be handled', () => {
    const { add, mode, target, wheel } = setup()
    mode.enable()
    expect(add).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false })
    target.dispatchEvent(new Event('wheel'))
    expect(wheel).toHaveBeenCalledOnce()
  })

  it('removes every listener when disabled', () => {
    const { target, remove, mode, wheel } = setup()
    mode.enable()
    mode.disable()
    expect(remove).toHaveBeenCalledWith('wheel', expect.any(Function))
    target.dispatchEvent(new Event('wheel'))
    expect(wheel).not.toHaveBeenCalled()
  })

  it('can register a handler in the capture phase, and removes it the same way', () => {
    const target = new EventTarget()
    const add = vi.spyOn(target, 'addEventListener')
    const remove = vi.spyOn(target, 'removeEventListener')
    const invalid = vi.fn()
    const mode = new ExploreMode(target, { invalid: { listener: invalid, capture: true } })
    mode.enable()
    expect(add).toHaveBeenCalledWith('invalid', invalid, { passive: false, capture: true })
    mode.disable()
    expect(remove).toHaveBeenCalledWith('invalid', invalid, { capture: true })
  })

  it('toggle flips the state and returns it', () => {
    const { mode } = setup()
    expect(mode.toggle()).toBe(true)
    expect(mode.toggle()).toBe(false)
  })

  it('enabling twice does not register listeners twice', () => {
    const { add, mode } = setup()
    mode.enable()
    mode.enable()
    expect(add).toHaveBeenCalledTimes(1)
  })

  it('notifies subscribers of changes', () => {
    const { mode } = setup()
    const seen: boolean[] = []
    mode.onChange((on) => seen.push(on))
    mode.enable()
    mode.disable()
    expect(seen).toEqual([true, false])
  })
})
