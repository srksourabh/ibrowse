import type { EarconEngine, EarconName } from '../audio/earcons'
import type { LatencyMeter } from '../audio/latency-meter'
import type { SpeechOutcome, SpeechService } from '../audio/speech-service'
import type { Settings } from '../shared/settings'
import { spokenText } from './affordance-speech'
import type { ElementInfo } from './describe'

/** How long the pointer must rest before the full description is spoken. */
export const DWELL_MS = 150
/** A new target within this distance of where the last one was chosen is ignored. */
export const HYSTERESIS_PX = 5

export interface HoverDeps {
  resolve(x: number, y: number): Element | null
  describe(el: Element): ElementInfo
  speech: Pick<SpeechService, 'speak' | 'cancel'>
  earcons: Pick<EarconEngine, 'play'>
  meter: Pick<LatencyMeter, 'start'>
  /** Stereo pan for a horizontal position in this frame, measured against the whole window. */
  panAt(x: number): number
  getSettings(): Pick<Settings, 'shortMode' | 'speechRate'> & Partial<Pick<Settings, 'aiAssist' | 'shortcutKeys'>>
  /** Called when the pointer arrives on a new element, so the navigation cursor can follow it. */
  onTarget?(el: Element): void
  /** Called on every change of target, empty space included. */
  onMove?(target: Element | null): void
  /** Called with each description as it is spoken, and how that speech ends. */
  onDescribed?(target: Element, spoken: Promise<SpeechOutcome>): void
}

function earconFor(info: ElementInfo): EarconName {
  if (info.disabled) return 'error'
  // A guess must not sound like a certain control.
  return info.affordance === 'interactive' && info.certainty === 'sure' ? 'interactive' : 'static'
}

/**
 * Turns pointer movement into audio: an Earcon at once, then speech once the
 * pointer rests. Moving on cancels the old speech immediately.
 */
export class HoverController {
  readonly #deps: HoverDeps
  #current: Element | null = null
  #anchor: { x: number; y: number } | null = null
  #dwellTimer: ReturnType<typeof setTimeout> | undefined
  #muted = false

  constructor(deps: HoverDeps) {
    this.#deps = deps
  }

  /** The element the pointer is on, if any. */
  get current(): Element | null {
    return this.#current
  }

  /** While muted the pointer is ignored, so reading aloud is not interrupted. */
  setMuted(muted: boolean): void {
    this.#muted = muted
  }

  /** Drops a pending description without touching speech already under way. */
  cancelDwell(): void {
    clearTimeout(this.#dwellTimer)
  }

  onPointerMove(x: number, y: number): void {
    if (this.#muted) return
    const { meter, speech, earcons } = this.#deps
    const stopEarconTimer = meter.start('earcon')
    const target = this.#deps.resolve(x, y)
    if (target === this.#current || this.#isWithinHysteresis(x, y)) return

    this.#current = target
    this.#anchor = { x, y }
    clearTimeout(this.#dwellTimer)
    this.#deps.onMove?.(target)

    const stopCancelTimer = meter.start('cancel')
    speech.cancel()
    stopCancelTimer()
    if (!target) return

    this.#deps.onTarget?.(target)
    earcons.play(earconFor(this.#deps.describe(target)), this.#deps.panAt(x))
    stopEarconTimer()
    this.#dwellTimer = setTimeout(() => this.#speak(target), DWELL_MS)
  }

  /** Stops speaking and forgets the current element, for example when Explore Mode turns off. */
  stop(): void {
    clearTimeout(this.#dwellTimer)
    this.#current = null
    this.#anchor = null
    this.#deps.speech.cancel()
  }

  #isWithinHysteresis(x: number, y: number): boolean {
    return this.#anchor !== null && Math.hypot(x - this.#anchor.x, y - this.#anchor.y) < HYSTERESIS_PX
  }

  #speak(target: Element): void {
    // Describe again: the element may have changed while the pointer rested on it.
    const { shortMode, speechRate, aiAssist, shortcutKeys } = this.#deps.getSettings()
    const text = spokenText(this.#deps.describe(target), {
      shortMode,
      aiHint: aiAssist ?? false,
      ...(shortcutKeys ? { keys: shortcutKeys } : {}),
    })
    const pan = this.#deps.panAt(this.#anchor?.x ?? 0)
    // Moving to a new element already cancelled the old speech, so anything speaking
    // now began after the pointer arrived (a validation message, a word). Wait for it.
    // From deciding to speak to the sound beginning: the delay a user actually feels.
    const stopSpeechTimer = this.#deps.meter.start('speech')
    const spoken = this.#deps.speech.speak(
      { text, rate: speechRate, pan, onStart: () => void stopSpeechTimer() },
      { interrupt: false },
    )
    this.#deps.onDescribed?.(target, spoken)
  }
}
