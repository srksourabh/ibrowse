import { beforeEach, describe, expect, it } from 'vitest'
import { changeText, invalidText } from '../../src/forms/changes'

function el(html: string): Element {
  document.body.innerHTML = html
  return document.querySelector('#t')!
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('changeText', () => {
  it('says whether a checkbox is now checked', () => {
    const box = el('<input id="t" type="checkbox" aria-label="Subscribe">') as HTMLInputElement
    box.checked = true
    expect(changeText(box)).toBe('Subscribe: checked')
    box.checked = false
    expect(changeText(box)).toBe('Subscribe: not checked')
  })

  it('says a radio button is now selected', () => {
    expect(changeText(el('<input id="t" type="radio" aria-label="Small" checked>'))).toBe(
      'Small: selected',
    )
  })

  it('says what a select now holds', () => {
    expect(
      changeText(
        el('<select id="t" aria-label="Day"><option>Mon</option><option selected>Tue</option></select>'),
      ),
    ).toBe('Day: Tue')
  })

  it('says the value of a slider', () => {
    expect(changeText(el('<input id="t" type="range" aria-label="Volume" value="70">'))).toBe(
      'Volume: 70',
    )
  })

  it('leaves text fields to the typing echo', () => {
    expect(changeText(el('<input id="t" aria-label="Name" value="x">'))).toBeNull()
    expect(changeText(el('<textarea id="t" aria-label="Notes">x</textarea>'))).toBeNull()
  })

  it('names an unlabeled control', () => {
    expect(changeText(el('<input id="t" type="checkbox" checked>'))).toBe('Unlabeled: checked')
  })
})

describe('invalidText', () => {
  it('speaks the browser validation message with the field name', () => {
    const input = el('<input id="t" aria-label="Email" type="email">') as HTMLInputElement
    input.setCustomValidity('Enter an email address')
    expect(invalidText(input)).toBe('Email: Enter an email address')
  })

  it('has a fallback when the browser gives no message', () => {
    expect(invalidText(el('<input id="t" aria-label="Email">'))).toBe('Email: Invalid value')
  })
})
