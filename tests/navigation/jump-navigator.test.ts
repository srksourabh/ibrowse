import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JumpNavigator } from '../../src/navigation/jump-navigator'

const $ = (selector: string): Element => document.querySelector(selector)!

function setup() {
  document.body.innerHTML = '<h2 id="a">A</h2><h2 id="b">B</h2><h2 id="c">C</h2>'
  const speech = { speak: vi.fn(async () => 'finished' as const) }
  const earcons = { play: vi.fn() }
  const reveal = vi.fn()
  const navigator = new JumpNavigator({
    targets: () => Array.from(document.querySelectorAll('h2')),
    reveal,
    describe: (el) => `described ${el.id}`,
    speech,
    earcons,
    getRate: () => 1,
  })
  return { navigator, speech, earcons, reveal }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('JumpNavigator', () => {
  it('moves to the first target, reveals it and speaks it', () => {
    const { navigator, speech, reveal, earcons } = setup()
    expect(navigator.jump('heading', 1)).toBe('moved')
    expect(navigator.cursor).toBe($('#a'))
    expect(reveal).toHaveBeenCalledWith($('#a'))
    expect(earcons.play).toHaveBeenCalledWith('tick', 0)
    expect(speech.speak).toHaveBeenCalledWith({ text: 'described a', rate: 1 })
  })

  it('keeps moving from the cursor', () => {
    const { navigator, speech } = setup()
    navigator.jump('heading', 1)
    navigator.jump('heading', 1)
    expect(navigator.cursor).toBe($('#b'))
    navigator.jump('heading', -1)
    expect(navigator.cursor).toBe($('#a'))
    expect(speech.speak).toHaveBeenLastCalledWith({ text: 'described a', rate: 1 })
  })

  it('starts from wherever the cursor was placed, such as the hovered element', () => {
    const { navigator } = setup()
    navigator.setCursor($('#b'))
    navigator.jump('heading', 1)
    expect(navigator.cursor).toBe($('#c'))
  })

  it('says so, with a boundary cue, at the end and does not move the cursor', () => {
    const { navigator, speech, earcons } = setup()
    navigator.setCursor($('#c'))
    expect(navigator.jump('heading', 1)).toBe('none')
    expect(navigator.cursor).toBe($('#c'))
    expect(earcons.play).toHaveBeenCalledWith('boundary', 0)
    expect(speech.speak).toHaveBeenCalledWith({ text: 'No next heading', rate: 1 })
  })

  it('says "previous" going backwards, and names landmarks', () => {
    const { navigator, speech } = setup()
    navigator.setCursor($('#a'))
    navigator.jump('landmark', -1)
    expect(speech.speak).toHaveBeenCalledWith({ text: 'No previous landmark', rate: 1 })
  })

  it('can clear the cursor', () => {
    const { navigator } = setup()
    navigator.setCursor($('#b'))
    navigator.setCursor(null)
    expect(navigator.cursor).toBeNull()
  })
})
