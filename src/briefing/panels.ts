import { computeAccessibleName } from 'dom-accessibility-api'
import { hasText, isHidden, isRendered } from '../hover/hit-test'
import { roleOf } from '../hover/roles'
import type { Rect, Viewport } from './placement'

export type PanelKind = 'header' | 'left' | 'main' | 'right' | 'footer'

export interface PanelContents {
  readonly links: number
  readonly buttons: number
  readonly inputs: number
  readonly images: number
  readonly headings: number
  readonly paragraphs: number
  readonly search: boolean
  /** A picture that links somewhere, in the header: the site's logo. */
  readonly logo: boolean
  /** The most important heading in the panel, or ''. */
  readonly firstHeading: string
}

export interface Panel {
  readonly kind: PanelKind
  readonly element: Element
  /** The panel's own accessible name, such as a menu's aria-label, or ''. */
  readonly label: string
  readonly contents: PanelContents
}

export interface PanelEnv {
  readonly rectOf: (el: Element) => Rect
  readonly viewport: Viewport
}

const ORDER: readonly PanelKind[] = ['header', 'left', 'main', 'right', 'footer']
/** A header or footer inside one of these belongs to it, not to the page (HTML-AAM). */
const SECTIONING = 'article,aside,main,nav,section'
const SIDES = 'nav,[role="navigation"],aside,[role="complementary"]'
const MIN_ROW_WIDTH = 0.7
const MIN_FULL_WIDTH = 0.9
const MAX_SEARCH_DEPTH = 8
/** Looking for columns stops after measuring this many elements, so a huge page is briefed promptly. */
const MAX_MEASURED = 2000
const NON_TEXT_INPUTS = new Set(['hidden', 'button', 'submit', 'reset', 'image'])

const normalise = (text: string | null): string => (text ?? '').replace(/\s+/g, ' ').trim()
const visible = (el: Element): boolean => !isHidden(el) && isRendered(el)

/** The page's own header or footer, ignoring those that belong to an article or section. */
function pageLandmark(doc: Document, tag: string, role: string, last: boolean): Element | null {
  const found = Array.from(doc.querySelectorAll(`${tag},[role="${role}"]`)).filter(
    (el) => visible(el) && (el.getAttribute('role') === role || !el.parentElement?.closest(SECTIONING)),
  )
  return (last ? found.at(-1) : found[0]) ?? null
}

type Assigned = Partial<Record<PanelKind, Element>>

/** Which side of the main content a block sits on, by its centre. */
function sideOf(rect: Rect, main: Rect | null, viewport: Viewport): 'left' | 'right' | null {
  const centre = rect.left + rect.width / 2
  const [from, to] = main ? [main.left, main.left + main.width] : [viewport.width / 3, (viewport.width * 2) / 3]
  if (centre < from) return 'left'
  return centre > to ? 'right' : null
}

function landmarkSides(doc: Document, panels: Assigned, env: PanelEnv): Assigned {
  const taken = Object.values(panels)
  const mainRect = panels.main ? env.rectOf(panels.main) : null
  const sides: Assigned = {}
  for (const el of doc.querySelectorAll(SIDES)) {
    if (!visible(el) || taken.some((p) => p.contains(el)) || el.parentElement?.closest(SIDES)) continue
    const side = sideOf(env.rectOf(el), mainRect, env.viewport)
    if (side && !sides[side]) sides[side] = el
  }
  return sides
}

interface Row {
  readonly container: Element
  readonly columns: readonly Element[]
}

/** True when the blocks sit side by side and together span most of the window. */
function isRow(rects: readonly Rect[], viewport: Viewport): boolean {
  if (rects.length < 2) return false
  const sideBySide = rects.every((r, i) => i === 0 || rects[i - 1]!.left + rects[i - 1]!.width <= r.left + 1)
  const span = rects.reduce((sum, r) => sum + r.width, 0)
  return sideBySide && span >= viewport.width * MIN_ROW_WIDTH
}

/** Menus, lists and tab bars lay items side by side too, but they are not the page's columns. */
const NOT_COLUMNS = 'ul,ol,menu,[role="menubar"],[role="tablist"],[role="list"],header,nav,footer,[role="navigation"],[role="banner"],[role="contentinfo"]'
/** The widest column must hold this much text, or a heading or paragraph, to be the main content. */
const MIN_MAIN_TEXT = 80

function holdsContent(el: Element): boolean {
  return el.querySelector('h1,h2,h3,p') !== null || (el.textContent ?? '').trim().length >= MIN_MAIN_TEXT
}

function columnsOf(el: Element, env: PanelEnv): Element[] | null {
  if (el.closest(NOT_COLUMNS)) return null
  const columns = Array.from(el.children)
    .filter((child) => visible(child) && env.rectOf(child).width > 0)
    .sort((a, b) => env.rectOf(a).left - env.rectOf(b).left)
  if (!isRow(columns.map(env.rectOf), env.viewport)) return null
  const widest = columns.reduce((a, b) => (env.rectOf(b).width > env.rectOf(a).width ? b : a))
  return holdsContent(widest) ? columns : null
}

/** The first set of side-by-side content columns, searching from the top of the page down. */
function findRow(root: Element, env: PanelEnv): Row | null {
  let level: Element[] = [root]
  let measured = 0
  for (let depth = 0; depth < MAX_SEARCH_DEPTH && level.length > 0; depth++) {
    for (const el of level) {
      measured += el.children.length
      if (measured > MAX_MEASURED) return null
      const columns = columnsOf(el, env)
      if (columns) return { container: el, columns }
    }
    level = level.flatMap((el) => Array.from(el.children).filter(visible))
  }
  return null
}

/** The nearest full-width block before or after the columns, looking outwards. */
function fullWidthNeighbour(from: Element, body: Element, env: PanelEnv, after: boolean): Element | null {
  for (let node: Element | null = from; node && node !== body; node = node.parentElement) {
    const sibling = after ? node.nextElementSibling : node.previousElementSibling
    if (sibling && visible(sibling) && env.rectOf(sibling).width >= env.viewport.width * MIN_FULL_WIDTH) {
      return sibling
    }
  }
  return null
}

/** Panels for a page with no main landmark, found by its geometry. */
function geometryPanels(doc: Document, env: PanelEnv): Assigned {
  const row = findRow(doc.body, env)
  if (!row) return hasText(doc.body) ? { main: doc.body } : {}
  const widths = row.columns.map((col) => env.rectOf(col).width)
  const mainIndex = widths.indexOf(Math.max(...widths))
  return {
    main: row.columns[mainIndex]!,
    ...(mainIndex > 0 ? { left: row.columns[mainIndex - 1]! } : {}),
    ...(mainIndex < row.columns.length - 1 ? { right: row.columns[mainIndex + 1]! } : {}),
    ...withKey('header', fullWidthNeighbour(row.container, doc.body, env, false)),
    ...withKey('footer', fullWidthNeighbour(row.container, doc.body, env, true)),
  }
}

const withKey = (kind: PanelKind, el: Element | null): Assigned => (el ? { [kind]: el } : {})

function assignPanels(doc: Document, env: PanelEnv): Assigned {
  const landmarks: Assigned = {
    ...withKey('header', pageLandmark(doc, 'header', 'banner', false)),
    ...withKey('footer', pageLandmark(doc, 'footer', 'contentinfo', true)),
    ...withKey('main', Array.from(doc.querySelectorAll('main,[role="main"]')).find(visible) ?? null),
  }
  // Landmarks the page names win; geometry fills the gaps.
  const base = landmarks.main ? landmarks : { ...geometryPanels(doc, env), ...landmarks }
  return { ...landmarkSides(doc, base, env), ...base }
}

function headingLevel(el: Element): number {
  const tag = /^h([1-6])$/.exec(el.localName)
  return tag ? Number(tag[1]) : Number(el.getAttribute('aria-level') ?? 2)
}

function mostImportant(headings: readonly Element[]): string {
  const top = Math.min(...headings.map(headingLevel))
  return normalise(headings.find((h) => headingLevel(h) === top)?.textContent ?? '')
}

const isSearch = (el: Element): boolean =>
  el.getAttribute('role') === 'search' ||
  (el instanceof HTMLInputElement &&
    (el.type === 'search' || /search/i.test(`${el.name} ${el.placeholder} ${computeAccessibleName(el)}`)))

function contentsOf(panel: Element, kind: PanelKind, others: readonly Element[]): PanelContents {
  // What belongs to another panel nested inside this one is counted there, not here.
  const own = (selector: string): Element[] =>
    Array.from(panel.querySelectorAll(selector)).filter(
      (el) => visible(el) && !others.some((other) => other !== panel && panel.contains(other) && other.contains(el)),
    )
  const headings = own('h1,h2,h3,h4,h5,h6,[role="heading"]')
  const images = own('img,[role="img"]').filter((el) => roleOf(el) === 'image')
  const logo = kind === 'header' ? images.find((img) => img.closest('a[href]') !== null) : undefined
  return {
    links: own('a[href]').length,
    buttons: own('button,[role="button"],input[type="button"],input[type="submit"],input[type="reset"]').length,
    // A search box is named as such, not counted again as a field.
    inputs: own('input,select,textarea').filter(
      (el) => !NON_TEXT_INPUTS.has((el.getAttribute('type') ?? '').toLowerCase()) && !isSearch(el),
    ).length,
    // The logo is named as such, not counted again as a picture.
    images: images.length - (logo ? 1 : 0),
    headings: headings.length,
    paragraphs: own('p').filter(hasText).length,
    search: own('[role="search"],input').some(isSearch),
    logo: logo !== undefined,
    firstHeading: headings.length > 0 ? mostImportant(headings) : '',
  }
}

/**
 * The page's panels in reading order: header, left panel, main content, right
 * panel, footer. Each is optional. Geometry comes from `env.rectOf`, so tests
 * can supply it (jsdom has no layout).
 */
export function findPanels(doc: Document, env: PanelEnv): Panel[] {
  // Measuring an element makes the browser lay out the page, so each is measured once.
  const rects = new Map<Element, Rect>()
  const measured: PanelEnv = {
    viewport: env.viewport,
    rectOf: (el) => {
      const known = rects.get(el)
      if (known) return known
      const rect = env.rectOf(el)
      rects.set(el, rect)
      return rect
    },
  }
  const assigned = assignPanels(doc, measured)
  const elements = ORDER.flatMap((kind) => assigned[kind] ?? [])
  return ORDER.flatMap((kind) => {
    const element = assigned[kind]
    if (!element) return []
    const label = element === doc.body ? '' : normalise(computeAccessibleName(element))
    return [{ kind, element, label, contents: contentsOf(element, kind, elements) }]
  })
}
