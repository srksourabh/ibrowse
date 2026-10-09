import { INTERACTIVE_ROLES, roleOf } from './roles'

const TEXT_BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th,dd,dt,figcaption,pre,caption,legend'

/** Parent element, stepping out of a shadow root to its host. */
function parentOf(el: Element): Element | null {
  if (el.parentElement) return el.parentElement
  const root = el.getRootNode()
  return root instanceof ShadowRoot ? root.host : null
}

/** False for elements the browser does not render (display: none and the like). */
export function isRendered(el: Element): boolean {
  return typeof el.checkVisibility === 'function' ? el.checkVisibility() : true
}

export function isHidden(el: Element): boolean {
  for (let node: Element | null = el; node; node = parentOf(node)) {
    if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return true
  }
  return false
}

export const hasText = (el: Element): boolean => (el.textContent ?? '').trim() !== ''

export const hasOwnText = (el: Element): boolean =>
  Array.from(el.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
  )

/** A childless element with no text and no role: a spacer, backdrop or decorative overlay. */
export function isEmptyLeaf(el: Element): boolean {
  const role = roleOf(el)
  return (
    el.childElementCount === 0 && !hasText(el) && !INTERACTIVE_ROLES.has(role) && role !== 'image'
  )
}

/**
 * The thing worth announcing for an element the pointer is on: the control
 * around it, the text block containing it, or the image itself. Null when
 * there is nothing to say.
 */
export function meaningfulTarget(el: Element): Element | null {
  if (isHidden(el)) return null
  for (let node: Element | null = el; node; node = parentOf(node)) {
    if (INTERACTIVE_ROLES.has(roleOf(node))) return node
  }
  if (roleOf(el) === 'image') return el
  const block = el.closest(TEXT_BLOCKS)
  if (block && hasText(block)) return block
  return hasOwnText(el) ? el : null
}

/** Elements at a point, topmost first, descending into open shadow roots. */
export function deepElementsAt(
  x: number,
  y: number,
  root: DocumentOrShadowRoot = document,
  visited: Set<DocumentOrShadowRoot> = new Set(),
): Element[] {
  if (visited.has(root)) return []
  visited.add(root)
  const out: Element[] = []
  for (const el of root.elementsFromPoint(x, y)) {
    if (el.shadowRoot) out.push(...deepElementsAt(x, y, el.shadowRoot, visited))
    out.push(el)
  }
  return [...new Set(out)]
}

/**
 * The Element Under Pointer. Decorative empty overlays are looked through;
 * the first element with substance decides, so a page behind a modal
 * backdrop is never read.
 */
export function hitTest(
  x: number,
  y: number,
  elementsAt: (x: number, y: number) => Element[] = deepElementsAt,
): Element | null {
  for (const candidate of elementsAt(x, y)) {
    if (isEmptyLeaf(candidate)) continue
    return meaningfulTarget(candidate)
  }
  return null
}
