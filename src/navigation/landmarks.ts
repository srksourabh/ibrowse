import { computeAccessibleName } from 'dom-accessibility-api'
import { spokenText } from '../hover/affordance-speech'
import { describeElement } from '../hover/describe'
import { isHidden, isRendered } from '../hover/hit-test'

export type JumpKind = 'heading' | 'landmark'

const HEADINGS = 'h1,h2,h3,h4,h5,h6,[role="heading"]'
const LANDMARKS = [
  'main,[role="main"]',
  'nav,[role="navigation"]',
  'aside,[role="complementary"]',
  '[role="search"],[role="banner"],[role="contentinfo"]',
  '[role="region"][aria-label]',
  'body > header,body > footer',
  'section[aria-label],section[aria-labelledby],form[aria-label],form[aria-labelledby]',
].join(',')

const TAG_ROLES: Readonly<Record<string, string>> = {
  main: 'main',
  nav: 'navigation',
  aside: 'complementary',
  header: 'banner',
  footer: 'contentinfo',
  section: 'region',
  form: 'form',
}

const ROLE_NAMES: Readonly<Record<string, string>> = {
  main: 'Main',
  navigation: 'Navigation',
  complementary: 'Sidebar',
  banner: 'Banner',
  contentinfo: 'Footer',
  search: 'Search',
  region: 'Region',
  form: 'Form',
}

const isVisible = (el: Element): boolean => !isHidden(el) && isRendered(el)

export function headingTargets(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll(HEADINGS)).filter(isVisible)
}

export function landmarkTargets(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll(LANDMARKS)).filter(isVisible)
}

function landmarkRole(el: Element): string {
  return el.getAttribute('role') ?? TAG_ROLES[el.localName] ?? 'region'
}

function describeLandmark(el: Element): string {
  const role = ROLE_NAMES[landmarkRole(el)] ?? 'Region'
  const name = computeAccessibleName(el).replace(/\s+/g, ' ').trim()
  return name ? `${name} — ${role} landmark` : `${role} landmark`
}

/** What to say on arriving at a heading or landmark. */
export function describeTarget(el: Element, kind: JumpKind): string {
  return kind === 'heading' ? spokenText(describeElement(el)) : describeLandmark(el)
}

/**
 * The target after (direction 1) or before (-1) an element in document
 * order. From nowhere it gives the first or last. A container counts as
 * behind everything inside it, so a landmark is "before" its headings.
 */
export function nextInOrder(
  targets: readonly Element[],
  from: Element | null,
  direction: 1 | -1,
): Element | null {
  if (!from) return (direction > 0 ? targets[0] : targets[targets.length - 1]) ?? null
  const ahead = (t: Element): boolean =>
    t !== from && (from.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  const behind = (t: Element): boolean =>
    t !== from && (from.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_PRECEDING) !== 0
  if (direction > 0) return targets.find(ahead) ?? null
  return [...targets].reverse().find(behind) ?? null
}
