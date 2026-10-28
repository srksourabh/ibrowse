import { describe, expect, it } from 'vitest'
import type { ElementInfo } from '../../src/hover/describe'
import { spokenText } from '../../src/hover/affordance-speech'

function info(overrides: Partial<ElementInfo>): ElementInfo {
  return {
    role: 'generic',
    label: '',
    affordance: 'static',
    certainty: 'sure',
    disabled: false,
    state: {},
    ...overrides,
  }
}

describe('spokenText: full mode', () => {
  it('says "Clickable" for interactive controls', () => {
    expect(
      spokenText(info({ role: 'button', label: 'Submit application', affordance: 'interactive' })),
    ).toBe('Submit application — Button, Clickable')
    expect(
      spokenText(info({ role: 'link', label: 'Forgot password', affordance: 'interactive' })),
    ).toBe('Forgot password — Link, Clickable')
  })

  it('says "Text only" for static text', () => {
    expect(spokenText(info({ label: 'Welcome back to your dashboard' }))).toBe(
      'Welcome back to your dashboard — Text only',
    )
  })

  it('offers to read a paragraph, naming its first five words', () => {
    expect(
      spokenText(info({ role: 'paragraph', label: 'The quick brown fox jumps over the lazy dog.' })),
    ).toBe('Paragraph: The quick brown fox jumps. Click to read.')
  })

  it('offers to read a short paragraph in full', () => {
    expect(spokenText(info({ role: 'paragraph', label: 'Hello there' }))).toBe(
      'Paragraph: Hello there. Click to read.',
    )
  })

  it('drops the offer in short mode but still names the paragraph', () => {
    expect(
      spokenText(info({ role: 'paragraph', label: 'The quick brown fox jumps over' }), {
        shortMode: true,
      }),
    ).toBe('Paragraph: The quick brown fox jumps')
  })

  it('includes the heading level', () => {
    expect(spokenText(info({ role: 'heading', headingLevel: 1, label: 'Dashboard' }))).toBe(
      'Dashboard — Heading level 1, Text only',
    )
  })

  it('describes images, with a fallback when there is no description', () => {
    expect(spokenText(info({ role: 'image', label: 'A red kite' }))).toBe('A red kite — Image')
    expect(spokenText(info({ role: 'image', label: '' }))).toBe('Image, no description')
  })

  it('offers an AI description for an image that has none, only when AI is on', () => {
    const bare = info({ role: 'image', label: '' })
    expect(spokenText(bare)).toBe('Image, no description')
    expect(spokenText(bare, { aiHint: true, keys: 'ctrl-alt' })).toBe(
      'Image, no description. Press Control, Alt and D to describe it.',
    )
    expect(spokenText(bare, { aiHint: true, keys: 'alt-shift' })).toBe(
      'Image, no description. Press Alt, Shift and D to describe it.',
    )
  })

  it('does not offer a description for an image that already has one', () => {
    expect(spokenText(info({ role: 'image', label: 'A red kite' }), { aiHint: true })).toBe(
      'A red kite — Image',
    )
  })

  it('hedges when clickability is only a guess', () => {
    expect(
      spokenText(info({ label: 'Open card', affordance: 'interactive', certainty: 'maybe' })),
    ).toBe('Open card — May be clickable')
  })

  it('says "Disabled" instead of "Clickable" for disabled controls', () => {
    expect(
      spokenText(
        info({ role: 'button', label: 'Buy', affordance: 'interactive', disabled: true }),
      ),
    ).toBe('Buy — Button, Disabled')
  })

  it('speaks control state', () => {
    expect(
      spokenText(
        info({
          role: 'checkbox',
          label: 'Subscribe',
          affordance: 'interactive',
          state: { checked: true },
        }),
      ),
    ).toBe('Subscribe — Checkbox, checked, Clickable')
    expect(
      spokenText(
        info({
          role: 'button',
          label: 'Menu',
          affordance: 'interactive',
          state: { expanded: false },
        }),
      ),
    ).toBe('Menu — Button, collapsed, Clickable')
  })

  it('names unlabeled controls instead of speaking an empty label', () => {
    expect(spokenText(info({ role: 'button', label: '', affordance: 'interactive' }))).toBe(
      'Unlabeled — Button, Clickable',
    )
  })
})

describe('spokenText: form fields', () => {
  const field = (overrides: Partial<ElementInfo>) =>
    info({ role: 'textbox', label: 'Email', affordance: 'interactive', ...overrides })

  it('says whether an edit field is empty or what it holds', () => {
    expect(spokenText(field({ value: '' }))).toBe('Email — Edit text, empty, Clickable')
    expect(spokenText(field({ label: 'Name', value: 'John' }))).toBe(
      'Name — Edit text, John, Clickable',
    )
  })

  it('says a password field is filled or empty, never what it holds', () => {
    expect(spokenText(field({ label: 'Password', secret: true, value: 'filled' }))).toBe(
      'Password — Password field, filled, Clickable',
    )
    expect(spokenText(field({ label: 'Password', secret: true, value: '' }))).toBe(
      'Password — Password field, empty, Clickable',
    )
  })

  it('speaks the selection of a combo box and the value of a slider', () => {
    expect(spokenText(field({ role: 'combobox', label: 'Day', value: 'Monday' }))).toBe(
      'Day — Combo box, Monday, Clickable',
    )
    expect(spokenText(field({ role: 'slider', label: 'Volume', value: '40' }))).toBe(
      'Volume — Slider, 40, Clickable',
    )
  })

  it('leaves the value out when a combo box or slider has none', () => {
    expect(spokenText(field({ role: 'combobox', label: 'Day' }))).toBe('Day — Combo box, Clickable')
  })

  it('says when a field is required', () => {
    expect(spokenText(field({ value: '', required: true }))).toBe(
      'Email — Edit text, empty, required, Clickable',
    )
  })

  it('drops "Clickable" in short mode, which is also used when a field gains focus', () => {
    expect(spokenText(field({ value: '', required: true }), { shortMode: true })).toBe(
      'Email — Edit text, empty, required',
    )
  })
})

describe('spokenText: short mode', () => {
  it('drops "Clickable" and "Text only", leaving it to the Earcon', () => {
    expect(
      spokenText(info({ role: 'button', label: 'Submit', affordance: 'interactive' }), {
        shortMode: true,
      }),
    ).toBe('Submit — Button')
    expect(spokenText(info({ label: 'Hello there' }), { shortMode: true })).toBe('Hello there')
  })

  it('keeps the "Disabled" and "May be clickable" warnings', () => {
    expect(
      spokenText(
        info({ role: 'button', label: 'Buy', affordance: 'interactive', disabled: true }),
        { shortMode: true },
      ),
    ).toBe('Buy — Button, Disabled')
    expect(
      spokenText(info({ label: 'Open', affordance: 'interactive', certainty: 'maybe' }), {
        shortMode: true,
      }),
    ).toBe('Open — May be clickable')
  })
})
