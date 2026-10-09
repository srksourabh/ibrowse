import { computeAccessibleName } from 'dom-accessibility-api'
import type { SpeechService } from '../audio/speech-service'
import { isHidden } from '../hover/hit-test'

/** The same words are not spoken twice within this long. */
export const SAME_TEXT_WINDOW_MS = 1500
const MAX_TEXT_LENGTH = 300
const MAX_REMEMBERED = 50

const LIVE_REGION = '[aria-live],[role="alert"],[role="status"],[role="log"]'
const DIALOG = 'dialog[open],[role="dialog"],[role="alertdialog"]'
const ALERT = '[role="alert"]'
/** Companion mode's own region. Reading it back would announce iBrowse's speech in a loop. */
const OWN_REGION = '[data-ibrowse-live]'

export interface LiveAnnouncerDeps {
  speech: Pick<SpeechService, 'speak'>
  getRate(): number
  now?(): number
}

function normalise(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= MAX_TEXT_LENGTH) return flat
  const cut = flat.slice(0, MAX_TEXT_LENGTH)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()
}

function regionOf(node: Node | null): Element | null {
  const el = node instanceof Element ? node : (node?.parentElement ?? null)
  if (el?.closest(OWN_REGION)) return null
  return el?.closest(LIVE_REGION) ?? null
}

/** 'assertive' interrupts, 'polite' waits its turn, null means the region is switched off. */
function politenessOf(region: Element): 'polite' | 'assertive' | null {
  const live = region.getAttribute('aria-live')
  if (live === 'off') return null
  if (live === 'assertive' || live === 'polite') return live
  return region.getAttribute('role') === 'alert' ? 'assertive' : 'polite'
}

/**
 * Speaks changes the page announces for itself: live regions, alerts and
 * dialogs that open (PRD FR-2.8). It only listens while started.
 */
export class LiveAnnouncer {
  readonly #root: Node
  readonly #deps: LiveAnnouncerDeps
  readonly #recent = new Map<string, number>()
  #observer: MutationObserver | null = null

  constructor(root: Node, deps: LiveAnnouncerDeps) {
    this.#root = root
    this.#deps = deps
  }

  start(): void {
    if (this.#observer) return
    this.#observer = new MutationObserver((records) => this.#handle(records))
    this.#observer.observe(this.#root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['open'],
    })
  }

  stop(): void {
    this.#observer?.disconnect()
    this.#observer = null
  }

  #handle(records: MutationRecord[]): void {
    const changed = new Map<Element, string[]>()
    const note = (region: Element | null, text: string | null): void => {
      if (region && text) changed.set(region, [...(changed.get(region) ?? []), text])
    }

    for (const record of records) {
      if (record.type === 'attributes') {
        if (record.target instanceof Element && record.target.matches(DIALOG)) {
          this.#announceDialog(record.target)
        }
      } else if (record.type === 'characterData') {
        note(regionOf(record.target), record.target.textContent)
      } else {
        const added = Array.from(record.addedNodes)
        added.forEach((node) => node instanceof Element && this.#onAdded(node))
        note(regionOf(record.target), added.map((node) => node.textContent ?? '').join(' '))
      }
    }
    changed.forEach((texts, region) => this.#announceRegion(region, texts))
  }

  /** New dialogs and alerts speak at once, wherever on the page they appear. */
  #onAdded(node: Element): void {
    if (node.closest(OWN_REGION)) return
    for (const dialog of [node, ...node.querySelectorAll(DIALOG)]) {
      if (dialog.matches(DIALOG)) this.#announceDialog(dialog)
    }
    for (const alert of [node, ...node.querySelectorAll(ALERT)]) {
      if (alert.matches(ALERT) && !isHidden(alert)) this.#say(alert.textContent ?? '', true)
    }
  }

  #announceRegion(region: Element, texts: string[]): void {
    const politeness = politenessOf(region)
    if (!politeness || isHidden(region)) return
    const atomic = region.getAttribute('aria-atomic') === 'true' || region.matches(ALERT)
    this.#say(atomic ? (region.textContent ?? '') : texts.join(' '), politeness === 'assertive')
  }

  #announceDialog(dialog: Element): void {
    if (isHidden(dialog)) return
    const name = computeAccessibleName(dialog).replace(/\s+/g, ' ').trim()
    this.#say(name ? `Dialog opened: ${name}` : 'Dialog opened', true)
  }

  #say(raw: string, interrupt: boolean): void {
    const text = normalise(raw)
    if (!text) return
    const now = (this.#deps.now ?? Date.now)()
    const last = this.#recent.get(text)
    if (last !== undefined && now - last < SAME_TEXT_WINDOW_MS) return
    this.#remember(text, now)
    void this.#deps.speech.speak({ text, rate: this.#deps.getRate() }, { interrupt })
  }

  #remember(text: string, now: number): void {
    this.#recent.set(text, now)
    if (this.#recent.size <= MAX_REMEMBERED) return
    for (const [old, at] of this.#recent) {
      if (now - at >= SAME_TEXT_WINDOW_MS) this.#recent.delete(old)
    }
  }
}
