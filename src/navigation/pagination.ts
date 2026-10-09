import { isHidden } from '../hover/hit-test'

export interface PaginationTarget {
  readonly href: string
  /** The link to click, so a site's own script runs. Null for a `<link rel>` in the head. */
  readonly element: HTMLAnchorElement | null
}

type Direction = 'next' | 'prev'

const TEXT_PATTERNS: Readonly<Record<Direction, RegExp>> = {
  next: /^(next|next page|older|older posts|older entries|›|»|→|>|next\s*[›»→>]|[›»→>]\s*next)$/,
  prev: /^(prev|previous|previous page|newer|newer posts|newer entries|‹|«|←|<|[‹«←<]\s*(prev|previous))$/,
}

/** Only web links are followed; `javascript:` and similar are refused. */
function safeHref(raw: string | null, doc: Document): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw, doc.baseURI)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function labelOf(anchor: Element): string {
  const raw =
    anchor.getAttribute('aria-label') || anchor.textContent || anchor.getAttribute('title') || ''
  return raw.replace(/\s+/g, ' ').trim().toLowerCase()
}

function anchorTarget(anchor: Element, doc: Document): PaginationTarget | null {
  const href = safeHref(anchor.getAttribute('href'), doc)
  return href && anchor instanceof HTMLAnchorElement ? { href, element: anchor } : null
}

/**
 * The link to the next or previous page, if the page has one: an explicit
 * `rel`, then a link whose whole label is "Next", "Previous" or an arrow.
 */
export function findPaginationTarget(doc: Document, direction: Direction): PaginationTarget | null {
  const visibleAnchors = Array.from(doc.querySelectorAll('a[href]')).filter((a) => !isHidden(a))

  for (const anchor of visibleAnchors.filter((a) => a.getAttribute('rel')?.split(/\s+/).includes(direction))) {
    const target = anchorTarget(anchor, doc)
    if (target) return target
  }

  for (const link of Array.from(doc.querySelectorAll(`link[rel~="${direction}"][href]`))) {
    const href = safeHref(link.getAttribute('href'), doc)
    if (href) return { href, element: null }
  }

  for (const anchor of visibleAnchors) {
    if (!TEXT_PATTERNS[direction].test(labelOf(anchor))) continue
    const target = anchorTarget(anchor, doc)
    if (target) return target
  }
  return null
}
