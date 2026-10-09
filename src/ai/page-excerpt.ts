import { isHidden } from '../hover/hit-test'
import { blockText, mainContent, readableBlocks } from '../reading/blocks'
import type { PageInput } from './ai-assistant'

export const MAX_EXCERPT_CHARS = 6000
const MAX_HEADINGS = 10

const normalise = (text: string | null): string => (text ?? '').replace(/\s+/g, ' ').trim()

/**
 * What may be sent about a page: its title, its headings and the text of its
 * readable blocks. Never form values, passwords, scripts or hidden text, since
 * only readable text blocks are collected.
 */
export function collectPagePayload(doc: Document): PageInput {
  const root = mainContent(doc)
  const headings = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .filter((el) => !isHidden(el))
    .map((el) => normalise(el.textContent))
    .filter(Boolean)
    .slice(0, MAX_HEADINGS)

  let excerpt = readableBlocks(root).map(blockText).join(' ')
  if (excerpt.length > MAX_EXCERPT_CHARS) {
    const cut = excerpt.slice(0, MAX_EXCERPT_CHARS)
    const lastSpace = cut.lastIndexOf(' ')
    excerpt = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()
  }
  return { title: normalise(doc.title), headings, excerpt }
}

export interface ImageTarget {
  readonly url: string
  readonly alt: string
  /** A caption, if the image sits in a figure. */
  readonly context: string
}

/** The image an element is, holds, or sits in a figure with, if any. */
export function imageTargetFor(el: Element): ImageTarget | null {
  const image =
    el instanceof HTMLImageElement
      ? el
      : (el.querySelector('img') ?? el.closest('figure')?.querySelector('img') ?? null)
  if (!image) return null
  const source = image.currentSrc || image.getAttribute('src')
  if (!source) return null
  let url: string
  try {
    url = new URL(source, image.ownerDocument.baseURI).href
  } catch {
    return null
  }
  return {
    url,
    alt: image.getAttribute('alt') ?? '',
    context: normalise(image.closest('figure')?.querySelector('figcaption')?.textContent ?? ''),
  }
}
