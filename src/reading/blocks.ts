import { deepElementsAt, hasOwnText, isEmptyLeaf, isHidden } from '../hover/hit-test'

const READABLE = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,dt,dd,figcaption'
const CONTROLS =
  'button,input,select,textarea,[role="button"],[role="checkbox"],[role="radio"],[role="textbox"],[role="combobox"],[role="slider"],[role="switch"],[role="tab"],[role="menuitem"],[role="option"]'

export function blockText(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Readable text blocks in document order. A block that contains another
 * (a list item holding a paragraph) is skipped in favour of the inner one,
 * so nothing is read twice.
 */
export function readableBlocks(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll(READABLE)).filter(
    (el) => !isHidden(el) && blockText(el) !== '' && !el.querySelector(READABLE),
  )
}

/**
 * The blocks from an element onwards, for reading from the navigation cursor.
 * A block that contains the cursor is included, so reading starts at its start.
 */
export function blocksFrom(blocks: readonly Element[], from: Element | null): Element[] {
  if (!from) return [...blocks]
  return blocks.filter(
    (block) =>
      block === from ||
      block.contains(from) ||
      (from.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
  )
}

/** The part of the page worth reading first. */
export function mainContent(doc: Document): Element {
  return (
    doc.querySelector('main,[role="main"]') ?? doc.querySelector('article') ?? doc.body
  )
}

/** The next or previous readable block in the document, or null at either end. */
export function adjacentBlock(
  current: Element,
  direction: 1 | -1,
  root: ParentNode = document,
): Element | null {
  const blocks = readableBlocks(root)
  const index = blocks.indexOf(current)
  return index < 0 ? null : (blocks[index + direction] ?? null)
}

/**
 * The text block under a point, for wheel scrubbing. A link inside a
 * paragraph gives the paragraph; a button or form control gives nothing,
 * so the wheel scrolls the page as usual there.
 */
export function scrubBlockAt(
  x: number,
  y: number,
  elementsAt: (x: number, y: number) => Element[] = deepElementsAt,
): Element | null {
  const candidate = elementsAt(x, y).find((el) => !isEmptyLeaf(el))
  if (!candidate || isHidden(candidate)) return null
  if (candidate.closest(CONTROLS)) return null
  const block = candidate.closest(READABLE)
  if (block) return blockText(block) === '' ? null : block
  return hasOwnText(candidate) ? candidate : null
}
