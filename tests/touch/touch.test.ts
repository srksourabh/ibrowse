import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EdgeCue } from '../../src/touch/edge-cue'
import { TouchActivator, DOUBLE_TAP_MS } from '../../src/touch/touch-activator'
import { guardTouchScrolling } from '../../src/touch/touch-guard'
import { VirtualPointer } from '../../src/touch/virtual-pointer'

describe('VirtualPointer', () => {
  it('uses the mouse position until the screen has been touched', () => {
    const pointer = new VirtualPointer()
    expect(pointer.pointFor({ x: 5, y: 6 })).toEqual({ x: 5, y: 6 })
  })

  it('uses the touch position for the wheel after a touch, whatever the mouse reports', () => {
    const pointer = new VirtualPointer()
    pointer.noteTouch(100, 200)
    expect(pointer.pointFor({ x: 5, y: 6 })).toEqual({ x: 100, y: 200 })
  })

  it('goes back to the mouse once the mouse moves', () => {
    const pointer = new VirtualPointer()
    pointer.noteTouch(100, 200)
    pointer.noteMouse()
    expect(pointer.pointFor({ x: 5, y: 6 })).toEqual({ x: 5, y: 6 })
  })
})

describe('TouchActivator', () => {
  const target = document.createElement('button')
  const other = document.createElement('a')
  let clock = 0

  function setup(mode: 'lift' | 'direct') {
    const activate = vi.fn()
    const activator = new TouchActivator({
      activate,
      targetAt: (x) => (x < 500 ? target : null),
      current: () => other,
      getMode: () => mode,
      now: () => clock,
    })
    const tap = (x = 100, y = 100, duration = 80) => {
      activator.down(x, y)
      clock += duration
      activator.up(x, y)
    }
    return { activator, activate, tap }
  }

  beforeEach(() => {
    clock = 1000
  })

  it('direct mode activates what is under the finger on a tap', () => {
    const { activate, tap } = setup('direct')
    tap(100, 100)
    expect(activate).toHaveBeenCalledOnce()
    expect(activate).toHaveBeenCalledWith(target)
  })

  it('direct mode does nothing over empty space', () => {
    const { activate, tap } = setup('direct')
    tap(900, 100)
    expect(activate).not.toHaveBeenCalled()
  })

  it('lift mode explores on a single tap and activates the last touched item on a double tap', () => {
    const { activate, tap } = setup('lift')
    tap(100, 100)
    expect(activate).not.toHaveBeenCalled()
    clock += DOUBLE_TAP_MS - 100
    tap(700, 400) // anywhere on the screen
    expect(activate).toHaveBeenCalledOnce()
    expect(activate).toHaveBeenCalledWith(other)
  })

  it('activates the item explored before the double tap began, even though the taps moved the pointer on', () => {
    let current: Element | null = other
    const activate = vi.fn()
    const activator = new TouchActivator({
      activate,
      targetAt: () => null,
      current: () => current,
      getMode: () => 'lift',
      now: () => clock,
    })
    const tap = () => {
      activator.down(100, 100)
      clock += 80
      activator.up(100, 100)
    }
    tap()
    current = null // the first tap landed on empty space, so the pointer is on nothing now
    tap()
    expect(activate).toHaveBeenCalledWith(other)
  })

  it('starts afresh for a later tap: the explored item is whatever it is then', () => {
    let current: Element | null = other
    const activate = vi.fn()
    const activator = new TouchActivator({
      activate,
      targetAt: () => null,
      current: () => current,
      getMode: () => 'lift',
      now: () => clock,
    })
    const tap = () => {
      activator.down(100, 100)
      clock += 80
      activator.up(100, 100)
    }
    tap()
    clock += DOUBLE_TAP_MS + 100
    current = target // the user explored somewhere new in the meantime
    tap()
    tap()
    expect(activate).toHaveBeenCalledOnce()
    expect(activate).toHaveBeenCalledWith(target)
  })

  it('needs the second tap to come soon enough', () => {
    const { activate, tap } = setup('lift')
    tap()
    clock += DOUBLE_TAP_MS + 100
    tap()
    expect(activate).not.toHaveBeenCalled()
  })

  it('does not count a third tap as another double tap', () => {
    const { activate, tap } = setup('lift')
    tap()
    tap()
    tap()
    expect(activate).toHaveBeenCalledOnce()
  })

  it('treats a drag as exploring, not tapping, and forgets an earlier tap', () => {
    for (const mode of ['direct', 'lift'] as const) {
      const { activator, activate, tap } = setup(mode)
      if (mode === 'lift') tap()
      activator.down(100, 100)
      activator.move(200, 100)
      clock += 80
      activator.up(200, 100)
      if (mode === 'lift') tap() // would have been a double tap without the drag
      expect(activate, mode).not.toHaveBeenCalled()
    }
  })

  it('ignores small finger wobble during a tap', () => {
    const { activator, activate } = setup('direct')
    activator.down(100, 100)
    activator.move(104, 103)
    clock += 80
    activator.up(104, 103)
    expect(activate).toHaveBeenCalledOnce()
  })

  it('does not treat a long press as a tap', () => {
    const { activate, tap } = setup('direct')
    tap(100, 100, 800)
    expect(activate).not.toHaveBeenCalled()
  })
})

describe('EdgeCue', () => {
  const screen = { width: 1000, height: 800 }

  it('plays once when a finger reaches an edge', () => {
    const play = vi.fn()
    const cue = new EdgeCue(play)
    cue.update(3, 400, screen)
    cue.update(2, 400, screen)
    expect(play).toHaveBeenCalledTimes(1)
    expect(play).toHaveBeenCalledWith('left')
  })

  it('names each edge', () => {
    const play = vi.fn()
    const cue = new EdgeCue(play)
    cue.update(997, 400, screen)
    cue.update(500, 400, screen)
    cue.update(500, 2, screen)
    cue.update(500, 400, screen)
    cue.update(500, 798, screen)
    expect(play.mock.calls.map((c) => c[0])).toEqual(['right', 'top', 'bottom'])
  })

  it('plays again after the finger has moved well away and come back', () => {
    const play = vi.fn()
    const cue = new EdgeCue(play)
    cue.update(3, 400, screen)
    cue.update(100, 400, screen)
    cue.update(3, 400, screen)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('stays quiet in the middle of the screen', () => {
    const play = vi.fn()
    new EdgeCue(play).update(500, 400, screen)
    expect(play).not.toHaveBeenCalled()
  })

  it('plays once at a corner', () => {
    const play = vi.fn()
    new EdgeCue(play).update(2, 2, screen)
    expect(play).toHaveBeenCalledOnce()
  })
})

describe('guardTouchScrolling', () => {
  afterEach(() => {
    document.documentElement.style.touchAction = ''
    document.body.style.touchAction = ''
  })

  it('stops the page scrolling under the finger, and restores it afterwards', () => {
    document.documentElement.style.touchAction = 'pan-y'
    const restore = guardTouchScrolling(document)
    expect(document.documentElement.style.touchAction).toBe('none')
    expect(document.body.style.touchAction).toBe('none')
    restore()
    expect(document.documentElement.style.touchAction).toBe('pan-y')
    expect(document.body.style.touchAction).toBe('')
  })
})
