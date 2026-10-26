import { describeElement } from '../hover/describe'
import { isHidden, isRendered } from '../hover/hit-test'
import { blockText, readableBlocks } from '../reading/blocks'

const CONTROLS = [
  'a[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea', 'summary',
  '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="radio"]', '[role="switch"]',
  '[role="tab"]', '[role="menuitem"]', '[role="option"]', '[role="combobox"]', '[role="textbox"]',
  '[role="searchbox"]', '[role="slider"]',
].join(',')
const HEADINGS = 'h1,h2,h3,h4,h5,h6,[role="heading"]'
/** Words a user adds to say what kind of thing they mean ("the contact link"), which are not part of its name. */
const ROLE_WORDS = /\s+(?:button|link|box|field|tab|checkbox|menu|heading|section)$/
/** Controls whose effect may not be taken back, which voice presses only after a spoken yes. */
const RISKY =
  /\b(?:delete|remove|erase|buy|pay|purchase|order|checkout|check out|submit|send|confirm|unsubscribe|close account|sign out|log out|transfer|donate|subscribe|accept|agree|authori[sz]e|install|reset|publish|post)\b/i
/** Form fields that mean money is involved: a card number, expiry or security code. */
const PAYMENT_FIELDS = 'input[autocomplete^="cc-"]'

const EXACT = 3
const STARTS = 2
const CONTAINS = 1

export type ControlMatch =
  | { readonly kind: 'one'; readonly element: Element }
  /** Several equally good matches: their names, so the user can say which. */
  | { readonly kind: 'several'; readonly names: readonly string[] }
  | { readonly kind: 'none' }

const plain = (text: string): string =>
  text.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim()

const visible = (el: Element): boolean => !isHidden(el) && isRendered(el)

/** Whole words only: "on" never matches inside "Continue". */
function score(name: string, wanted: string): number {
  if (name === wanted) return EXACT
  if (name.startsWith(`${wanted} `)) return STARTS
  return ` ${name} `.includes(` ${wanted} `) ? CONTAINS : 0
}

/** Every visible element sharing the best score, in page order. */
function bestMatches(elements: Iterable<Element>, wanted: string, nameOf: (el: Element) => string): Element[] {
  let found: Element[] = []
  let top = 0
  for (const el of elements) {
    if (!visible(el)) continue
    const points = score(plain(nameOf(el)), wanted)
    if (points > top) {
      found = [el]
      top = points
    } else if (points > 0 && points === top) {
      found.push(el)
    }
  }
  return found
}

const controlName = (el: Element): string => describeElement(el).label

/** The control (button, link, field…) whose spoken name matches, for "click" by name. Never a guess. */
export function findControl(root: ParentNode, name: string): ControlMatch {
  const wanted = plain(name)
  if (wanted.length < 2) return { kind: 'none' }
  const matches = bestMatches(root.querySelectorAll(CONTROLS), wanted, controlName)
  if (matches.length === 0) return { kind: 'none' }
  if (matches.length === 1) return { kind: 'one', element: matches[0]! }
  return { kind: 'several', names: matches.map(controlName) }
}

/** The form this control would send if pressed, or null. */
function formSentBy(el: Element): HTMLFormElement | null {
  if (el instanceof HTMLButtonElement) return el.type === 'submit' ? el.form : null
  if (el instanceof HTMLInputElement) return el.type === 'submit' || el.type === 'image' ? el.form : null
  return null
}

/** A form that changes something: one posted to the site, or one taking card details. */
function changesSomething(form: HTMLFormElement): boolean {
  return form.method === 'post' || form.querySelector(PAYMENT_FIELDS) !== null
}

/**
 * True for a control whose effect may not be taken back: buying, sending, deleting and the like.
 * The page chooses a control's name, so its visible text and the form it sends count too.
 */
export function isRisky(el: Element): boolean {
  const words = [controlName(el), el.textContent ?? '', el.getAttribute('value') ?? '']
  if (words.some((text) => RISKY.test(text))) return true
  const form = formSentBy(el)
  return form !== null && changesSomething(form)
}

function findByText(root: ParentNode, wanted: string): Element | null {
  return (
    bestMatches(root.querySelectorAll(CONTROLS), wanted, controlName)[0] ??
    bestMatches(root.querySelectorAll(HEADINGS), wanted, (el) => el.textContent ?? '')[0] ??
    bestMatches(readableBlocks(root), wanted, blockText)[0] ??
    null
  )
}

/** Anything matching the words, for "find" and "where is": a control, then a heading, then text. Moving there is harmless, so the first match is taken. */
export function findAnything(root: ParentNode, words: string): Element | null {
  const wanted = plain(words)
  if (wanted.length < 2) return null
  const withoutRole = wanted.replace(ROLE_WORDS, '')
  return findByText(root, wanted) ?? (withoutRole !== wanted ? findByText(root, withoutRole) : null)
}
