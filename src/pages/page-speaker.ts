/** Ids for speech requests made by setup pages, kept apart from the ones pages make while exploring. */
let nextPageSpeechId = 1_000_000

/**
 * How a setup page says something. With iBrowse's own voice it is spoken and
 * shown. With a screen reader (Companion mode) it is only put in the live
 * region, so nothing is said twice.
 */
export function createPageSpeaker(status: HTMLElement, companion: boolean): (text: string) => void {
  status.setAttribute('aria-live', companion ? 'polite' : 'off')
  return (text) => {
    status.textContent = text
    if (companion) return
    chrome.runtime
      .sendMessage({ type: 'speak', id: nextPageSpeechId++, utterance: { text } })
      .catch((error: unknown) =>
        console.error('iBrowse speech error:', error instanceof Error ? error.message : 'unknown'),
      )
  }
}

export function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`The page is missing #${id}`)
  return el as T
}
