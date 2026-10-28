import { describe, expect, it } from 'vitest'
import { chordWords, routeKey, type KeyContext, type KeyLike } from '../src/key-router'

const press = (overrides: Partial<KeyLike>, context: Partial<KeyContext> = {}) =>
  routeKey(
    {
      key: '',
      code: '',
      altKey: false,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      ...overrides,
    },
    { keys: 'ctrl-alt', typing: false, ...context },
  )

const ctrlAlt = { ctrlKey: true, altKey: true }
const altShift = { altKey: true, shiftKey: true }
const oldKeys: Partial<KeyContext> = { keys: 'alt-shift' }

describe('routeKey with Ctrl+Alt, the default', () => {
  it('maps the reading and page commands', () => {
    expect(press({ ...ctrlAlt, code: 'KeyB' })).toBe('brief-detailed')
    expect(press({ ...ctrlAlt, code: 'KeyR' })).toBe('read-from-here')
    expect(press({ ...ctrlAlt, code: 'ArrowRight' })).toBe('next-page')
    expect(press({ ...ctrlAlt, code: 'ArrowLeft' })).toBe('prev-page')
  })

  it('maps heading, landmark and where-am-i commands', () => {
    expect(press({ ...ctrlAlt, code: 'ArrowDown' })).toBe('next-heading')
    expect(press({ ...ctrlAlt, code: 'ArrowUp' })).toBe('prev-heading')
    expect(press({ ...ctrlAlt, code: 'PageDown' })).toBe('next-landmark')
    expect(press({ ...ctrlAlt, code: 'PageUp' })).toBe('prev-landmark')
    expect(press({ ...ctrlAlt, code: 'KeyW' })).toBe('where-am-i')
  })

  it('maps the AI commands: describe this, and summarise the page', () => {
    expect(press({ ...ctrlAlt, code: 'KeyD' })).toBe('describe-this')
    expect(press({ ...ctrlAlt, code: 'KeyM' })).toBe('summarize-page')
  })

  it('turns Explore Mode off, and opens settings and hardware setup, from the page', () => {
    expect(press({ ...ctrlAlt, code: 'KeyE' })).toBe('explore-off')
    expect(press({ ...ctrlAlt, code: 'KeyS' })).toBe('open-settings')
    expect(press({ ...ctrlAlt, code: 'KeyP' })).toBe('open-hardware')
  })

  it('never uses Alt+Shift, which switches the keyboard language on Windows', () => {
    expect(press({ ...altShift, code: 'ArrowDown' })).toBeNull()
    expect(press({ ...altShift, code: 'KeyW' })).toBeNull()
  })

  it('uses the physical key, so it works on any keyboard layout', () => {
    expect(press({ ...ctrlAlt, code: 'KeyB', key: 'ब' })).toBe('brief-detailed')
  })

  it('leaves AltGr alone, so characters typed with it still arrive', () => {
    expect(press({ ...ctrlAlt, altGraph: true, code: 'KeyW' })).toBeNull()
  })

  it('leaves letter chords alone while typing in a field, where Ctrl+Alt may type a character', () => {
    expect(press({ ...ctrlAlt, code: 'KeyW' }, { typing: true })).toBeNull()
  })

  it('still moves by heading and landmark from inside a field', () => {
    expect(press({ ...ctrlAlt, code: 'ArrowDown' }, { typing: true })).toBe('next-heading')
    expect(press({ ...ctrlAlt, code: 'PageDown' }, { typing: true })).toBe('next-landmark')
  })

  it('ignores the chord with Shift or Meta added, so other shortcuts keep working', () => {
    expect(press({ ...ctrlAlt, shiftKey: true, code: 'KeyB' })).toBeNull()
    expect(press({ ...ctrlAlt, metaKey: true, code: 'KeyB' })).toBeNull()
  })
})

describe('routeKey with Alt+Shift, kept for people who already learned it', () => {
  it('maps the same commands', () => {
    expect(press({ ...altShift, code: 'ArrowDown' }, oldKeys)).toBe('next-heading')
    expect(press({ ...altShift, code: 'KeyW' }, oldKeys)).toBe('where-am-i')
    expect(press({ ...altShift, code: 'KeyE' }, oldKeys)).toBe('explore-off')
  })

  it('ignores Ctrl+Alt', () => {
    expect(press({ ...ctrlAlt, code: 'ArrowDown' }, oldKeys)).toBeNull()
  })

  it('ignores the chord with Ctrl or Meta added', () => {
    expect(press({ ...altShift, ctrlKey: true, code: 'KeyB' }, oldKeys)).toBeNull()
    expect(press({ ...altShift, metaKey: true, code: 'KeyB' }, oldKeys)).toBeNull()
  })
})

describe('routeKey: Escape', () => {
  it('stops speech', () => {
    expect(press({ key: 'Escape', code: 'Escape' })).toBe('stop-speech')
  })

  it('is left to the browser with a modifier', () => {
    expect(press({ ctrlKey: true, key: 'Escape', code: 'Escape' })).toBeNull()
  })

  it('returns null for unrelated keys', () => {
    expect(press({ key: 'a', code: 'KeyA' })).toBeNull()
    expect(press({ code: 'ArrowRight' })).toBeNull()
  })
})

describe('chordWords', () => {
  it('spells a chord the way a voice should say it, not "plus"', () => {
    expect(chordWords('ctrl-alt', 'D')).toBe('Control, Alt and D')
    expect(chordWords('alt-shift', 'Down Arrow')).toBe('Alt, Shift and Down Arrow')
  })
})
