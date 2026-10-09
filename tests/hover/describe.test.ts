import { beforeEach, describe, expect, it } from 'vitest'
import { describeElement } from '../../src/hover/describe'

function el(html: string, selector = '#t'): Element {
  document.body.innerHTML = html
  return document.querySelector(selector)!
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('describeElement: interactive controls', () => {
  it('describes a button by its text', () => {
    const info = describeElement(el('<button id="t">Submit application</button>'))
    expect(info).toMatchObject({
      role: 'button',
      label: 'Submit application',
      affordance: 'interactive',
      certainty: 'sure',
      disabled: false,
    })
  })

  it('describes a link with an href, but not an anchor without one', () => {
    expect(describeElement(el('<a id="t" href="/x">Forgot password</a>'))).toMatchObject({
      role: 'link',
      affordance: 'interactive',
    })
    expect(describeElement(el('<a id="t">Plain</a>')).affordance).toBe('static')
  })

  it('prefers aria-label over visible text', () => {
    expect(describeElement(el('<button id="t" aria-label="Close dialog">X</button>')).label).toBe(
      'Close dialog',
    )
  })

  it('names an input from its label and reports checkbox state', () => {
    const info = describeElement(
      el('<label for="t">Subscribe</label><input id="t" type="checkbox" checked>'),
    )
    expect(info).toMatchObject({ role: 'checkbox', label: 'Subscribe', state: { checked: true } })
  })

  it('maps input types to roles', () => {
    expect(describeElement(el('<input id="t" type="text" aria-label="Name">')).role).toBe('textbox')
    expect(describeElement(el('<input id="t" type="search" aria-label="Find">')).role).toBe(
      'searchbox',
    )
    expect(describeElement(el('<input id="t" type="range" aria-label="Volume">')).role).toBe(
      'slider',
    )
    expect(describeElement(el('<select id="t" aria-label="Day"><option>Mon</option></select>')).role).toBe(
      'combobox',
    )
    expect(describeElement(el('<textarea id="t" aria-label="Notes"></textarea>')).role).toBe(
      'textbox',
    )
  })

  it('honours an explicit ARIA role', () => {
    expect(describeElement(el('<div id="t" role="tab">Overview</div>'))).toMatchObject({
      role: 'tab',
      affordance: 'interactive',
    })
  })

  it('reports aria-expanded and aria-pressed', () => {
    const info = describeElement(
      el('<button id="t" aria-expanded="false" aria-pressed="true">Menu</button>'),
    )
    expect(info.state).toMatchObject({ expanded: false, pressed: true })
  })

  it('marks native and ARIA disabled controls as disabled', () => {
    expect(describeElement(el('<button id="t" disabled>Buy</button>')).disabled).toBe(true)
    expect(describeElement(el('<div id="t" role="button" aria-disabled="true">Buy</div>')).disabled).toBe(
      true,
    )
  })
})

describe('describeElement: form values', () => {
  it('reports the text in an edit field, empty or not', () => {
    expect(describeElement(el('<input id="t" aria-label="Name" value="John">')).value).toBe('John')
    expect(describeElement(el('<input id="t" aria-label="Name">')).value).toBe('')
    expect(describeElement(el('<textarea id="t" aria-label="Notes">Hello</textarea>')).value).toBe(
      'Hello',
    )
  })

  it('shortens a long value at a word boundary', () => {
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ')
    const value = describeElement(el(`<input id="t" aria-label="Bio" value="${long}">`)).value!
    expect(value.length).toBeLessThanOrEqual(60)
    expect(long.startsWith(value)).toBe(true)
  })

  it('never reveals a password, only whether it is filled', () => {
    const empty = describeElement(el('<input id="t" type="password" aria-label="Password">'))
    expect(empty).toMatchObject({ secret: true, value: '' })
    const filled = describeElement(
      el('<input id="t" type="password" aria-label="Password" value="hunter2">'),
    )
    expect(filled).toMatchObject({ secret: true, value: 'filled' })
    expect(JSON.stringify(filled)).not.toContain('hunter2')
  })

  it('reports the selected option of a select and the value of a slider', () => {
    expect(
      describeElement(
        el('<select id="t" aria-label="Day"><option>Mon</option><option selected>Tue</option></select>'),
      ).value,
    ).toBe('Tue')
    expect(describeElement(el('<input id="t" type="range" aria-label="Volume" value="40">')).value).toBe(
      '40',
    )
  })

  it('reports required fields, native or ARIA', () => {
    expect(describeElement(el('<input id="t" aria-label="Email" required>')).required).toBe(true)
    expect(describeElement(el('<div id="t" role="textbox" aria-required="true">x</div>')).required).toBe(
      true,
    )
    expect(describeElement(el('<input id="t" aria-label="Email">')).required).toBeFalsy()
  })

  it('has no value for things that are not form fields', () => {
    expect(describeElement(el('<p id="t">Hi</p>')).value).toBeUndefined()
    expect(describeElement(el('<button id="t">Go</button>')).value).toBeUndefined()
  })
})

describe('describeElement: possibly clickable elements', () => {
  it('flags a generic element with cursor:pointer as maybe clickable', () => {
    const info = describeElement(el('<div id="t" style="cursor:pointer">Open card</div>'))
    expect(info).toMatchObject({ affordance: 'interactive', certainty: 'maybe', role: 'generic' })
  })

  it('flags onclick and focusable generic elements as maybe clickable', () => {
    expect(describeElement(el('<div id="t" onclick="x()">Go</div>')).certainty).toBe('maybe')
    expect(describeElement(el('<div id="t" tabindex="0">Go</div>')).certainty).toBe('maybe')
  })

  it('treats ordinary text as static', () => {
    expect(describeElement(el('<p id="t">Just words</p>'))).toMatchObject({
      affordance: 'static',
      certainty: 'sure',
    })
  })
})

describe('describeElement: static content', () => {
  it('reports heading level', () => {
    expect(describeElement(el('<h2 id="t">Welcome back</h2>'))).toMatchObject({
      role: 'heading',
      headingLevel: 2,
      label: 'Welcome back',
      affordance: 'static',
    })
  })

  it('uses alt text for images and leaves the label empty without it', () => {
    expect(describeElement(el('<img id="t" src="a.png" alt="A red kite">'))).toMatchObject({
      role: 'image',
      label: 'A red kite',
    })
    expect(describeElement(el('<img id="t" src="a.png">')).label).toBe('')
  })

  it('uses the start of a paragraph as its label, cut at a word boundary', () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ')
    const info = describeElement(el(`<p id="t">${words}</p>`))
    expect(info.label.length).toBeLessThanOrEqual(80)
    expect(info.label.startsWith('word0 word1')).toBe(true)
    expect(info.label.endsWith(' ')).toBe(false)
    expect(words.startsWith(info.label)).toBe(true)
  })
})
