/**
 * Stops the page scrolling or zooming under a finger, so dragging explores
 * instead. Returns a function that puts the page's own settings back.
 */
export function guardTouchScrolling(doc: Document): () => void {
  const elements = [doc.documentElement, doc.body]
  const previous = elements.map((el) => el.style.touchAction)
  elements.forEach((el) => {
    el.style.touchAction = 'none'
  })
  return () =>
    elements.forEach((el, i) => {
      el.style.touchAction = previous[i] ?? ''
    })
}
