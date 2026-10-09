import { hasText, isHidden, isRendered } from '../hover/hit-test'
import { roleOf } from '../hover/roles'
import { placementOf, type Placement, type Rect, type Viewport } from './placement'

export interface LayoutEnv {
  readonly rectOf: (el: Element) => Rect
  readonly viewport: Viewport
  /** 'viewport' counts only what is on screen; the default counts the whole page. */
  readonly scope?: 'page' | 'viewport'
}

export interface RegionInfo {
  readonly kind: 'hero' | 'navigation' | 'sidebar' | 'search'
  readonly placement: Placement
}

export interface MediaInfo {
  readonly kind: 'picture' | 'video'
  readonly count: number
  /** Only given for a single item. */
  readonly placement: Placement | null
}

export interface LayoutCounts {
  readonly paragraphs: number
  readonly headings: number
  readonly links: number
  readonly buttons: number
  readonly inputs: number
  readonly forms: number
  /** Embedded frames, whose content may be out of reach (a different site). */
  readonly frames: number
}

export interface LayoutModel {
  readonly title: string
  readonly kind: 'article' | 'form' | 'page'
  readonly regions: readonly RegionInfo[]
  readonly media: readonly MediaInfo[]
  readonly counts: LayoutCounts
  readonly headings: readonly string[]
}

const ARTICLE_MIN_PARAGRAPHS = 5
const FORM_MIN_INPUTS = 3
const MAX_HEADINGS_LISTED = 10
const HEADINGS_TRIED_FOR_HERO = 3
const HERO_MIN_HEIGHT = 0.25
const HERO_MIN_WIDTH = 0.6
const HERO_MAX_TOP = 0.6
const NON_TEXT_INPUTS = new Set(['hidden', 'button', 'submit', 'reset', 'image'])

const normalise = (text: string | null): string => (text ?? '').replace(/\s+/g, ' ').trim()

function isOnScreen(rect: Rect, viewport: Viewport): boolean {
  return rect.top < viewport.height && rect.top + rect.height > 0
}

function isHeroSized(rect: Rect, viewport: Viewport): boolean {
  return (
    rect.height >= viewport.height * HERO_MIN_HEIGHT &&
    rect.width >= viewport.width * HERO_MIN_WIDTH &&
    rect.top < viewport.height * HERO_MAX_TOP &&
    rect.top + rect.height > 0
  )
}

function hasMedia(el: Element): boolean {
  if (el.querySelector('img,picture,video,svg,canvas')) return true
  const background = getComputedStyle(el).backgroundImage
  return background !== '' && background !== 'none'
}

/** A big block near the top that holds a heading and imagery. */
function findHero(
  doc: Document,
  env: LayoutEnv,
  visible: (el: Element) => boolean,
): RegionInfo | null {
  const headings = Array.from(doc.querySelectorAll('h1,h2')).filter(visible)
  for (const heading of headings.slice(0, HEADINGS_TRIED_FOR_HERO)) {
    for (let node = heading.parentElement; node && node !== doc.body; node = node.parentElement) {
      const rect = env.rectOf(node)
      if (!isHeroSized(rect, env.viewport)) continue
      if (hasMedia(node)) return { kind: 'hero', placement: placementOf(rect, env.viewport) }
      break // the smallest big ancestor has no imagery, so this heading is not part of a hero
    }
  }
  return null
}

function regionOf(
  doc: Document,
  selector: string,
  kind: RegionInfo['kind'],
  env: LayoutEnv,
  visible: (el: Element) => boolean,
): RegionInfo[] {
  const el = Array.from(doc.querySelectorAll(selector)).find(visible)
  return el ? [{ kind, placement: placementOf(env.rectOf(el), env.viewport) }] : []
}

function mediaOf(
  kind: MediaInfo['kind'],
  items: Element[],
  env: LayoutEnv,
): MediaInfo[] {
  if (items.length === 0) return []
  const [only] = items
  const placement =
    items.length === 1 && only ? placementOf(env.rectOf(only), env.viewport) : null
  return [{ kind, count: items.length, placement }]
}

/**
 * Builds the structured view of a page that the briefing is spoken from.
 * Geometry comes from `env.rectOf`, so tests can supply it (jsdom has no layout).
 */
export function analyzePage(doc: Document, env: LayoutEnv): LayoutModel {
  const visible = (el: Element): boolean =>
    !isHidden(el) &&
    isRendered(el) &&
    (env.scope !== 'viewport' || isOnScreen(env.rectOf(el), env.viewport))
  const all = (selector: string): Element[] => Array.from(doc.querySelectorAll(selector)).filter(visible)

  const headings = all('h1,h2,h3,h4,h5,h6,[role="heading"]')
  const counts: LayoutCounts = {
    paragraphs: all('p').filter(hasText).length,
    headings: headings.length,
    links: all('a[href]').length,
    buttons: all('button,[role="button"],input[type="button"],input[type="submit"],input[type="reset"]')
      .length,
    inputs: all('input,select,textarea').filter(
      (el) => !NON_TEXT_INPUTS.has((el.getAttribute('type') ?? '').toLowerCase()),
    ).length,
    forms: all('form').length,
    frames: all('iframe,frame').length,
  }

  const kind: LayoutModel['kind'] =
    counts.forms >= 1 && counts.inputs >= FORM_MIN_INPUTS && counts.paragraphs < ARTICLE_MIN_PARAGRAPHS
      ? 'form'
      : counts.paragraphs >= ARTICLE_MIN_PARAGRAPHS
        ? 'article'
        : 'page'

  const hero = findHero(doc, env, visible)
  const regions: RegionInfo[] = [
    ...(hero ? [hero] : []),
    ...regionOf(doc, 'nav,[role="navigation"]', 'navigation', env, visible),
    ...regionOf(doc, 'aside,[role="complementary"]', 'sidebar', env, visible),
    ...regionOf(doc, '[role="search"],input[type="search"]', 'search', env, visible),
  ]

  const pictures = all('img,[role="img"]').filter((el) => roleOf(el) === 'image')
  const media = [...mediaOf('picture', pictures, env), ...mediaOf('video', all('video'), env)]

  const headingTexts = headings.map((el) => normalise(el.textContent)).filter(Boolean)
  return {
    title: normalise(doc.title) || headingTexts[0] || '',
    kind,
    regions,
    media,
    counts,
    headings: headingTexts.slice(0, MAX_HEADINGS_LISTED),
  }
}
