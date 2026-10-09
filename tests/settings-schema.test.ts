import { describe, expect, it } from 'vitest'
import {
  SETTING_GROUPS,
  SETTINGS_FIELDS,
  confirmationFor,
  fieldFor,
  focusDescription,
  warningFor,
} from '../src/settings/schema'
import { DEFAULT_SETTINGS, parseSettings, type Settings } from '../src/shared/settings'

/** Set by the hardware pairing page, not chosen from a list. */
const INTERNAL_KEYS: ReadonlyArray<keyof Settings> = ['hapticProfileId']

describe('SETTINGS_FIELDS', () => {
  it('describes every setting exactly once, except the internal ones', () => {
    const expected = (Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>)
      .filter((key) => !INTERNAL_KEYS.includes(key))
      .sort()
    expect(SETTINGS_FIELDS.map((f) => f.key).sort()).toEqual(expected)
  })

  it('gives every field a unique label, some help, and a known group', () => {
    const labels = SETTINGS_FIELDS.map((f) => f.label)
    expect(new Set(labels).size).toBe(labels.length)
    for (const field of SETTINGS_FIELDS) {
      expect(field.label.trim(), field.key).not.toBe('')
      expect(field.help.trim(), field.key).not.toBe('')
      expect(SETTING_GROUPS.map((g) => g.id), field.key).toContain(field.group)
    }
  })

  it('keeps every default inside what its own field allows', () => {
    for (const field of SETTINGS_FIELDS) {
      const value = DEFAULT_SETTINGS[field.key]
      if (field.kind === 'number') {
        expect(value, field.key).toBeGreaterThanOrEqual(field.min)
        expect(value, field.key).toBeLessThanOrEqual(field.max)
      }
      if (field.kind === 'choice') {
        expect(field.options.map((o) => o.value), field.key).toContain(value)
      }
      if (field.kind === 'boolean') expect(typeof value, field.key).toBe('boolean')
    }
  })

  it('accepts every option the page offers, and the validator agrees with the number limits', () => {
    for (const field of SETTINGS_FIELDS) {
      if (field.kind === 'choice') {
        for (const option of field.options) {
          expect(parseSettings({ [field.key]: option.value })[field.key], `${field.key}=${option.value}`).toBe(
            option.value,
          )
        }
      }
      if (field.kind === 'number') {
        expect(parseSettings({ [field.key]: field.min })[field.key], field.key).toBe(field.min)
        expect(parseSettings({ [field.key]: field.max })[field.key], field.key).toBe(field.max)
        const below = parseSettings({ [field.key]: field.min - field.step })[field.key]
        expect(below, field.key).toBe(DEFAULT_SETTINGS[field.key])
      }
    }
  })

  it('finds a field by key', () => {
    expect(fieldFor('speechRate').label).toBe('Speech rate')
  })
})

describe('confirmationFor', () => {
  it('says a switch as on or off', () => {
    expect(confirmationFor(fieldFor('shortMode'), true)).toBe('Short announcements: on.')
    expect(confirmationFor(fieldFor('shortMode'), false)).toBe('Short announcements: off.')
  })

  it('says a choice by its label', () => {
    expect(confirmationFor(fieldFor('touchActivation'), 'direct')).toMatch(/direct/i)
    expect(confirmationFor(fieldFor('screenReaderMode'), 'companion')).toMatch(/screen reader/i)
  })

  it('says a number as it is', () => {
    expect(confirmationFor(fieldFor('speechRate'), 1.5)).toBe('Speech rate: 1.5.')
  })

  it('says an empty text as the default', () => {
    expect(confirmationFor(fieldFor('voiceName'), '')).toMatch(/default/i)
    expect(confirmationFor(fieldFor('cloudVoiceName'), 'Puck')).toBe('Cloud voice name: Puck.')
  })
})

describe('focusDescription', () => {
  it('says the setting, its value and what it does, so a person with no screen reader can use the page', () => {
    expect(focusDescription(fieldFor('speechRate'), 1)).toBe(
      'Speech rate: 1. How fast iBrowse speaks. One is normal.',
    )
    expect(focusDescription(fieldFor('shortMode'), false)).toMatch(/^Short announcements: off\. Leave out/)
  })

  it('reads every field without producing empty text', () => {
    for (const field of SETTINGS_FIELDS) {
      const text = focusDescription(field, DEFAULT_SETTINGS[field.key])
      expect(text.startsWith(`${field.label}:`), field.key).toBe(true)
      expect(text.endsWith(field.help), field.key).toBe(true)
    }
  })
})

describe('warningFor', () => {
  it('says nothing about ordinary settings', () => {
    expect(warningFor('speechRate', 2)).toBeNull()
    expect(warningFor('shortMode', true)).toBeNull()
  })

  it('warns, before cloud voice is switched on, what will be sent and to whom', () => {
    const text = warningFor('cloudVoice', 'reading')
    expect(text).toMatch(/Google/)
    expect(text).toMatch(/text/i)
    expect(warningFor('cloudVoice', 'off')).toBeNull()
  })

  it('warns, before AI is switched on, that page text and images are sent', () => {
    const text = warningFor('aiAssist', true)
    expect(text).toMatch(/Google/)
    expect(text).toMatch(/page text/i)
    expect(text).toMatch(/images/i)
    expect(warningFor('aiAssist', false)).toBeNull()
  })
})
