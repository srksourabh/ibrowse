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

const EXACT = 3
const STARTS = 2
const CONTAINS = 1

const plain = (text: string): string =>
  text.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim()

const visible = (el: Element): boolean => !isHidden(el) && isRendered(el)

function score(name: string, wanted: string): number {
  if (name === wanted) return EXACT
  if (name.startsWith(wanted)) return STARTS
  return name.includes(wanted) ? CONTAINS : 0
}

/** The best match by name, earliest in the page on a tie; null when nothing matches. */
function best(elements: Iterable<Element>, wanted: string, nameOf: (el: Element) => string): Element | null {
  let found: Element | null = null
  let top = 0
  for (const el of elements) {
    if (!visible(el)) continue
    const points = score(plain(nameOf(el)), wanted)
    if (points > top) {
      found = el
      top = points
    }
  }
  return found
}

const controlName = (el: Element): string => describeElement(el).label

/** The control (button, link, field…) whose spoken name best matches, for "click" by name. */
export function findControl(root: ParentNode, name: string): Element | null {
  const wanted = plain(name)
  return wanted ? best(root.querySelectorAll(CONTROLS), wanted, controlName) : null
}

function findByText(root: ParentNode, wanted: string): Element | null {
  return (
    best(root.querySelectorAll(CONTROLS), wanted, controlName) ??
    best(root.querySelectorAll(HEADINGS), wanted, (el) => el.textContent ?? '') ??
    best(readableBlocks(root), wanted, blockText)
  )
}

/** Anything matching the words, for "find" and "where is": a control, then a heading, then text. */
export function findAnything(root: ParentNode, words: string): Element | null {
  const wanted = plain(words)
  if (!wanted) return null
  const withoutRole = wanted.replace(ROLE_WORDS, '')
  return findByText(root, wanted) ?? (withoutRole !== wanted ? findByText(root, withoutRole) : null)
}
