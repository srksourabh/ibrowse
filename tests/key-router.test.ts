import { describe, expect, it } from 'vitest'
import { routeKey } from '../src/key-router'

const key = (overrides: Partial<Parameters<typeof routeKey>[0]>) =>
  routeKey({
    key: '',
    code: '',
    altKey: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    ...overrides,
  })

const altShift = { altKey: true, shiftKey: true }

describe('routeKey', () => {
  it('maps the Alt+Shift commands', () => {
    expect(key({ ...altShift, code: 'KeyB' })).toBe('brief-detailed')
    expect(key({ ...altShift, code: 'KeyR' })).toBe('read-from-here')
    expect(key({ ...altShift, code: 'ArrowRight' })).toBe('next-page')
    expect(key({ ...altShift, code: 'ArrowLeft' })).toBe('prev-page')
  })

  it('maps heading, landmark and where-am-i commands', () => {
    expect(key({ ...altShift, code: 'ArrowDown' })).toBe('next-heading')
    expect(key({ ...altShift, code: 'ArrowUp' })).toBe('prev-heading')
    expect(key({ ...altShift, code: 'PageDown' })).toBe('next-landmark')
    expect(key({ ...altShift, code: 'PageUp' })).toBe('prev-landmark')
    expect(key({ ...altShift, code: 'KeyW' })).toBe('where-am-i')
  })

  it('maps the AI commands: describe this, and summarise the page', () => {
    expect(key({ ...altShift, code: 'KeyD' })).toBe('describe-this')
    expect(key({ ...altShift, code: 'KeyM' })).toBe('summarize-page')
  })

  it('maps Escape to stop speech', () => {
    expect(key({ key: 'Escape', code: 'Escape' })).toBe('stop-speech')
  })

  it('uses the physical key, so it works on any keyboard layout', () => {
    expect(key({ ...altShift, code: 'KeyB', key: 'ß' })).toBe('brief-detailed')
  })

  it('ignores the same keys without the full modifier chord', () => {
    expect(key({ altKey: true, code: 'KeyB' })).toBeNull()
    expect(key({ shiftKey: true, code: 'KeyB' })).toBeNull()
    expect(key({ code: 'ArrowRight' })).toBeNull()
  })

  it('ignores chords with Ctrl or Meta so browser shortcuts keep working', () => {
    expect(key({ ...altShift, ctrlKey: true, code: 'KeyB' })).toBeNull()
    expect(key({ ...altShift, metaKey: true, code: 'KeyB' })).toBeNull()
    expect(key({ ctrlKey: true, key: 'Escape', code: 'Escape' })).toBeNull()
  })

  it('returns null for unrelated keys', () => {
    expect(key({ key: 'a', code: 'KeyA' })).toBeNull()
  })
})
