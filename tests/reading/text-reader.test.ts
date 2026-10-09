import { describe, expect, it, vi } from 'vitest'
import { panFromX } from '../../src/audio/pan'
import { TextReader, type WheelLike } from '../../src/reading/text-reader'

function setup(blocks: Record<string, string>) {
  const elements = Object.keys(blocks).map((id) => {
    const el = document.createElement('p')
    el.id = id
    return el
  })
  let underPointer: Element | null = elements[0] ?? null
  const speech = { speak: vi.fn(async () => 'finished' as const) }
  const earcons = { play: vi.fn() }
  const hover = { cancelDwell: vi.fn() }
  const navigator = { scrollBy: vi.fn() }
  const reader = new TextReader({
    blockAt: () => underPointer,
    textOf: (el) => blocks[el.id] ?? '',
    adjacentBlock: (el, direction) => elements[elements.indexOf(el as HTMLParagraphElement) + direction] ?? null,
    speech,
    earcons,
    hover,
    navigator,
    panAt: (x) => panFromX(x, 1000),
    getRate: () => 1,
  })
  const wheel = (overrides: Partial<WheelLike> = {}): WheelLike => {
    const event: WheelLike = {
      deltaY: 100,
      deltaMode: 0,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      clientX: 500,
      clientY: 50,
      preventDefault: vi.fn(),
      ...overrides,
    }
    reader.onWheel(event)
    return event
  }
  return {
    reader,
    speech,
    earcons,
    hover,
    navigator,
    wheel,
    elements,
    pointerOver: (el: Element | null) => (underPointer = el),
  }
}

describe('TextReader: wheel scrubbing', () => {
  it('speaks one word per notch with a tick, and takes over the wheel', () => {
    const { wheel, speech, earcons, hover } = setup({ a: 'one two three' })
    const event = wheel()
    expect(event.preventDefault).toHaveBeenCalled()
    expect(hover.cancelDwell).toHaveBeenCalled()
    expect(earcons.play).toHaveBeenCalledWith('tick', 0)
    expect(speech.speak).toHaveBeenCalledWith({ text: 'one', rate: 1 })
    wheel()
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'two', rate: 1 })
    wheel({ deltaY: -100 })
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'one', rate: 1 })
  })

  it('pans the tick by pointer position', () => {
    const { wheel, earcons } = setup({ a: 'one two' })
    wheel({ clientX: 1000 })
    expect(earcons.play).toHaveBeenCalledWith('tick', 1)
  })

  it('leaves the wheel alone when the pointer is not on readable text', () => {
    const { wheel, speech, pointerOver } = setup({ a: 'one' })
    pointerOver(null)
    const event = wheel()
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(speech.speak).not.toHaveBeenCalled()
  })

  it('leaves Ctrl+wheel to the browser, which zooms', () => {
    const { wheel, speech } = setup({ a: 'one' })
    const event = wheel({ ctrlKey: true })
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(speech.speak).not.toHaveBeenCalled()
  })

  it('scrolls the page for Alt+wheel', () => {
    const { wheel, navigator, speech } = setup({ a: 'one' })
    const event = wheel({ altKey: true, deltaY: 100 })
    expect(event.preventDefault).toHaveBeenCalled()
    expect(navigator.scrollBy).toHaveBeenCalledWith(100)
    expect(speech.speak).not.toHaveBeenCalled()
  })

  it('stops at the end of a block, then continues into the next on a second push', () => {
    const { wheel, speech, earcons } = setup({ a: 'one', b: 'two three' })
    wheel() // one
    wheel() // boundary
    expect(earcons.play).toHaveBeenLastCalledWith('boundary', 0)
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'End of text', rate: 1 })
    wheel() // next block
    expect(earcons.play).toHaveBeenLastCalledWith('edge', 0)
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'two', rate: 1 })
  })

  it('announces the start of a block', () => {
    const { wheel, speech } = setup({ a: 'one two' })
    wheel({ deltaY: -100 })
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'Start of text', rate: 1 })
  })

  it('accumulates small trackpad movements before stepping', () => {
    const { wheel, speech } = setup({ a: 'one two' })
    wheel({ deltaY: 20 })
    wheel({ deltaY: 20 })
    expect(speech.speak).not.toHaveBeenCalled()
    wheel({ deltaY: 20 })
    expect(speech.speak).toHaveBeenCalledWith({ text: 'one', rate: 1 })
  })

  it('starts again from the first word when the pointer moves to another block', () => {
    const { wheel, speech, pointerOver, elements } = setup({ a: 'one two', b: 'alpha beta' })
    wheel()
    wheel()
    pointerOver(elements[1]!)
    wheel()
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'alpha', rate: 1 })
  })

  it('spells the current word for Shift+wheel without moving', () => {
    const { wheel, speech } = setup({ a: 'cat dog' })
    wheel() // cat
    wheel({ shiftKey: true })
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'c, a, t', rate: 1 })
    wheel() // dog, so the spelling did not move the cursor
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'dog', rate: 1 })
  })

  it('has nothing to spell before a word is reached', () => {
    const { wheel, speech } = setup({ a: 'cat' })
    wheel({ shiftKey: true })
    expect(speech.speak).not.toHaveBeenCalled()
  })
})

describe('TextReader: reading a block', () => {
  it('reads the whole block aloud', () => {
    const { reader, speech, elements } = setup({ a: 'The quick brown fox.' })
    reader.readBlock(elements[0]!)
    expect(speech.speak).toHaveBeenCalledWith({ text: 'The quick brown fox.', rate: 1, kind: 'reading' })
  })

  it('cancels a pending hover description so it cannot cut the reading off', () => {
    const { reader, hover, elements } = setup({ a: 'The quick brown fox.' })
    reader.readBlock(elements[0]!)
    expect(hover.cancelDwell).toHaveBeenCalled()
  })

  it('reads from the current word to the end', () => {
    const { reader, wheel, speech } = setup({ a: 'one two three' })
    wheel()
    wheel()
    expect(reader.readFromHere()).toBe(true)
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'two three', rate: 1, kind: 'reading' })
  })

  it('reports that there is nowhere to read from before any scrubbing', () => {
    const { reader, speech } = setup({ a: 'one' })
    expect(reader.readFromHere()).toBe(false)
    expect(speech.speak).not.toHaveBeenCalled()
  })

  it('lets the wheel continue from a block that was just read aloud', () => {
    const { reader, wheel, speech, elements } = setup({ a: 'one two' })
    reader.readBlock(elements[0]!)
    wheel()
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'one', rate: 1 })
  })
})
