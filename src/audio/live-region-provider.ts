import type { SpeechProvider, Utterance } from './speech-service'

/** The region is emptied this long before new text goes in, so identical text is announced again. */
export const REGION_RESET_MS = 50
export const MIN_SPEECH_MS = 400
/** A screen reader speaks roughly 15 characters a second at its normal rate. */
const MS_PER_CHARACTER = 60

/** How long a screen reader will take to say some text. It cannot tell us when it finishes. */
export function estimateSpeechMs(text: string, rate: number | undefined): number {
  const effective = rate !== undefined && rate > 0 ? rate : 1
  return Math.max(MIN_SPEECH_MS, Math.round((text.length * MS_PER_CHARACTER) / effective))
}

const HIDDEN_STYLE =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;' +
  'clip-path:inset(50%);white-space:nowrap'

/**
 * Companion mode: instead of speaking itself, iBrowse writes what it would say
 * into a hidden live region, and the user's screen reader speaks it. There is
 * one voice, theirs. A screen reader reports no end of speech, so each
 * utterance is taken to last as long as it should take to say.
 */
export class LiveRegionProvider implements SpeechProvider {
  readonly #doc: Document
  #region: HTMLElement | null = null
  #writeTimer: ReturnType<typeof setTimeout> | undefined
  #endTimer: ReturnType<typeof setTimeout> | undefined
  #settle: (() => void) | null = null

  constructor(doc: Document) {
    this.#doc = doc
  }

  speak(utterance: Utterance): Promise<void> {
    const region = this.#ensureRegion()
    this.#stopTimers()
    region.textContent = ''
    return new Promise((resolve) => {
      this.#settle = resolve
      this.#writeTimer = setTimeout(() => {
        region.textContent = utterance.text
        utterance.onStart?.()
      }, REGION_RESET_MS)
      this.#endTimer = setTimeout(() => this.#finish(), estimateSpeechMs(utterance.text, utterance.rate))
    })
  }

  cancel(): void {
    this.#stopTimers()
    if (this.#region) this.#region.textContent = ''
    this.#finish()
  }

  #finish(): void {
    const settle = this.#settle
    this.#settle = null
    settle?.()
  }

  #stopTimers(): void {
    clearTimeout(this.#writeTimer)
    clearTimeout(this.#endTimer)
  }

  #ensureRegion(): HTMLElement {
    if (this.#region?.isConnected) return this.#region
    const region = this.#doc.createElement('div')
    region.setAttribute('role', 'status')
    region.setAttribute('aria-live', 'polite')
    region.setAttribute('aria-atomic', 'true')
    // Marks it as ours, so the live-region announcer does not read it back to itself.
    region.setAttribute('data-ibrowse-live', '')
    region.style.cssText = HIDDEN_STYLE
    ;(this.#doc.body ?? this.#doc.documentElement).append(region)
    this.#region = region
    return region
  }
}
