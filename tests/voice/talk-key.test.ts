import { describe, expect, it } from 'vitest'
import { endsTalk, isTalkKey } from '../../src/voice/talk-key'

const key = (overrides: Partial<KeyboardEventInit & { code: string }>) => ({
  key: 'V',
  code: 'KeyV',
  altKey: true,
  shiftKey: true,
  ctrlKey: false,
  metaKey: false,
  ...overrides,
})

describe('isTalkKey', () => {
  it('is Alt+Shift+V, by physical key so any layout works', () => {
    expect(isTalkKey(key({}))).toBe(true)
    expect(isTalkKey(key({ key: 'М' }))).toBe(true)
  })

  it('needs both Alt and Shift, and nothing else', () => {
    expect(isTalkKey(key({ altKey: false }))).toBe(false)
    expect(isTalkKey(key({ shiftKey: false }))).toBe(false)
    expect(isTalkKey(key({ ctrlKey: true }))).toBe(false)
    expect(isTalkKey(key({ metaKey: true }))).toBe(false)
    expect(isTalkKey(key({ code: 'KeyB' }))).toBe(false)
  })
})

describe('endsTalk', () => {
  it('ends when V, Alt or Shift is released', () => {
    expect(endsTalk({ key: 'v', code: 'KeyV' })).toBe(true)
    expect(endsTalk({ key: 'Alt', code: 'AltLeft' })).toBe(true)
    expect(endsTalk({ key: 'Shift', code: 'ShiftRight' })).toBe(true)
  })

  it('does not end on other keys', () => {
    expect(endsTalk({ key: 'a', code: 'KeyA' })).toBe(false)
  })
})
