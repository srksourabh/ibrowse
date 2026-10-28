import { describe, expect, it } from 'vitest'
import { endsTalk, isTalkKey } from '../../src/voice/talk-key'

const ctrlAltV = (overrides: Partial<KeyboardEventInit & { code: string }>) => ({
  key: 'v',
  code: 'KeyV',
  altKey: true,
  shiftKey: false,
  ctrlKey: true,
  metaKey: false,
  ...overrides,
})

describe('isTalkKey with Ctrl+Alt, the default', () => {
  it('is Ctrl+Alt+V, by physical key so any layout works', () => {
    expect(isTalkKey(ctrlAltV({}), 'ctrl-alt')).toBe(true)
    expect(isTalkKey(ctrlAltV({ key: 'व' }), 'ctrl-alt')).toBe(true)
  })

  it('needs both Ctrl and Alt, and nothing else', () => {
    expect(isTalkKey(ctrlAltV({ ctrlKey: false }), 'ctrl-alt')).toBe(false)
    expect(isTalkKey(ctrlAltV({ altKey: false }), 'ctrl-alt')).toBe(false)
    expect(isTalkKey(ctrlAltV({ shiftKey: true }), 'ctrl-alt')).toBe(false)
    expect(isTalkKey(ctrlAltV({ metaKey: true }), 'ctrl-alt')).toBe(false)
    expect(isTalkKey(ctrlAltV({ code: 'KeyB' }), 'ctrl-alt')).toBe(false)
  })

  it('is not AltGr+V, which types a character', () => {
    expect(isTalkKey({ ...ctrlAltV({}), altGraph: true }, 'ctrl-alt')).toBe(false)
  })
})

describe('isTalkKey with Alt+Shift', () => {
  it('is Alt+Shift+V', () => {
    expect(isTalkKey(ctrlAltV({ ctrlKey: false, shiftKey: true }), 'alt-shift')).toBe(true)
    expect(isTalkKey(ctrlAltV({}), 'alt-shift')).toBe(false)
  })
})

describe('endsTalk', () => {
  it('ends when V or a held modifier is released', () => {
    expect(endsTalk({ key: 'v', code: 'KeyV' }, 'ctrl-alt')).toBe(true)
    expect(endsTalk({ key: 'Control', code: 'ControlLeft' }, 'ctrl-alt')).toBe(true)
    expect(endsTalk({ key: 'Alt', code: 'AltLeft' }, 'ctrl-alt')).toBe(true)
    expect(endsTalk({ key: 'Shift', code: 'ShiftRight' }, 'alt-shift')).toBe(true)
  })

  it('does not end on other keys', () => {
    expect(endsTalk({ key: 'a', code: 'KeyA' }, 'ctrl-alt')).toBe(false)
    expect(endsTalk({ key: 'Shift', code: 'ShiftLeft' }, 'ctrl-alt')).toBe(false)
  })
})
