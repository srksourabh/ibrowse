import type { SpeechProvider, Utterance } from '../audio/speech-service'
import type { CloudSpeechRequest, CloudSpeechResponse } from './messages'
import { splitForSpeech } from './speech-split'

/** The same kind of problem is spoken at most this often. */
export const PROBLEM_NOTICE_INTERVAL_MS = 60_000
/** Audio playback keeps pitch sensible only within this range of speeds. */
const MIN_PLAYBACK_RATE = 0.5
const MAX_PLAYBACK_RATE = 2
const UNPLAYABLE = 'Google sent back audio that could not be played. Using the local voice.'

/** Problems that will not mend themselves: stop asking until the settings change. */
const LASTING_PROBLEMS = new Set(['no-key', 'bad-key', 'bad-model', 'disabled'])

export interface PlayingAudio {
  readonly ended: Promise<void>
  stop(): void
}

export interface CloudVoiceDeps {
  request(request: CloudSpeechRequest): Promise<CloudSpeechResponse>
  cancelRequest(id: number): void
  decode(base64: string, mimeType: string): Promise<unknown>
  play(audio: unknown, options: { pan: number; rate: number }): PlayingAudio
  /**
   * Whether the browser will start sound. It may need a moment to wake its audio after the
   * page's first click or key press, so this may wait. False means use the local voice.
   */
  canPlay(): boolean | Promise<boolean>
  /** The voice that speaks whenever the cloud cannot, so the user is never left in silence. */
  fallback: SpeechProvider
  onProblem(text: string): void
  now?(): number
}

type Failure = Extract<CloudSpeechResponse, { ok: false }>

/**
 * Speaks with a cloud voice: the background worker makes the audio, this plays
 * it, panned. The next piece is fetched while the current one plays. If
 * anything goes wrong (a refused key, no network, sound blocked) the rest is
 * spoken by the local voice instead, and the user is told once.
 */
export class CloudVoiceProvider implements SpeechProvider {
  readonly #deps: CloudVoiceDeps
  readonly #noticedAt = new Map<string, number>()
  #token = 0
  #nextId = 1
  #requestIds: number[] = []
  #playing: PlayingAudio | null = null
  #fallbackActive = false
  #disabled = false

  constructor(deps: CloudVoiceDeps) {
    this.#deps = deps
  }

  async speak(utterance: Utterance): Promise<void> {
    if (this.#disabled) return this.#speakLocally(utterance)
    const startedAt = this.#token
    const canPlay = await this.#deps.canPlay()
    if (this.#token !== startedAt) return // cancelled while waiting to hear whether sound is allowed
    return canPlay ? this.#speakFromCloud(utterance) : this.#speakLocally(utterance)
  }

  cancel(): void {
    this.#token++
    this.#playing?.stop()
    this.#playing = null
    this.#requestIds.forEach((id) => this.#deps.cancelRequest(id))
    this.#requestIds = []
    if (this.#fallbackActive) this.#deps.fallback.cancel()
  }

  /** The settings or the key changed, so a lasting problem may be gone. */
  reset(): void {
    this.#disabled = false
  }

  async #speakFromCloud(utterance: Utterance): Promise<void> {
    const chunks = splitForSpeech(utterance.text)
    if (chunks.length === 0) return
    const token = ++this.#token
    this.#requestIds = []
    let pending = this.#fetch(chunks[0]!)

    for (let i = 0; i < chunks.length; i++) {
      // Ask for the next piece now, while this one is still on its way and then playing.
      const next = i + 1 < chunks.length ? this.#fetch(chunks[i + 1]!) : null
      const response = await pending
      if (token !== this.#token) return
      const audio = response.ok ? await this.#decode(response) : null
      if (token !== this.#token) return
      if (!audio) {
        if (!response.ok && response.kind === 'cancelled') return
        this.#report(response.ok ? { ok: false, kind: 'empty', reason: UNPLAYABLE } : response)
        await this.#speakLocally({ ...utterance, text: chunks.slice(i).join(' ') })
        return
      }
      this.#playing = this.#deps.play(audio.value, {
        pan: utterance.pan ?? 0,
        rate: Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, utterance.rate ?? 1)),
      })
      if (i === 0) utterance.onStart?.()
      await this.#playing.ended
      if (token !== this.#token) return
      pending = next ?? pending
    }
  }

  async #decode(response: Extract<CloudSpeechResponse, { ok: true }>): Promise<{ value: unknown } | null> {
    try {
      return { value: await this.#deps.decode(response.base64, response.mimeType) }
    } catch {
      return null
    }
  }

  #fetch(text: string): Promise<CloudSpeechResponse> {
    const id = this.#nextId++
    this.#requestIds.push(id)
    return this.#deps.request({ type: 'cloud-speech', id, text }).catch(
      (): CloudSpeechResponse => ({
        ok: false,
        kind: 'network',
        reason: 'Could not reach Google. Check your connection.',
      }),
    )
  }

  async #speakLocally(utterance: Utterance): Promise<void> {
    this.#fallbackActive = true
    try {
      await this.#deps.fallback.speak(utterance)
    } finally {
      this.#fallbackActive = false
    }
  }

  #report(failure: Failure): void {
    if (failure.kind === 'cancelled') return
    if (LASTING_PROBLEMS.has(failure.kind)) this.#disabled = true
    if (failure.kind === 'disabled') return // the user switched it off; nothing to tell them
    const now = (this.#deps.now ?? Date.now)()
    const last = this.#noticedAt.get(failure.kind)
    if (last !== undefined && now - last < PROBLEM_NOTICE_INTERVAL_MS) return
    this.#noticedAt.set(failure.kind, now)
    this.#deps.onProblem(failure.reason)
  }
}
