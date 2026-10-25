import type { Settings } from '../shared/settings'
import type { ListenResponse, OffscreenRequest, RecognizerMode, RecordingResponse } from './messages'

const NOTICES: Readonly<Record<RecognizerMode, string>> = {
  'on-device': 'Speech is turned into text on this computer.',
  online: "Speech is turned into text by Google's online service.",
  gemini: 'What you said was sent to Google Gemini, with your key, to be turned into text.',
}

export interface VoiceRelayDeps {
  /** The recogniser chosen in settings, read for each request; 'off' refuses. */
  engine(): Promise<Settings['voiceInput']>
  ensureOffscreen(): Promise<void>
  closeOffscreen(): void
  toOffscreen(request: OffscreenRequest): Promise<unknown>
  /** Turns a recording into words with Gemini; only the worker holds the key. */
  transcribe(audio: string): Promise<ListenResponse>
  /** The first offscreen id, different each time the worker starts, so ids never repeat. */
  firstId: number
}

interface Request {
  readonly id: number
  sent: boolean
  stopped: boolean
  cancelled: boolean
}

const SILENCE: ListenResponse = { ok: true, text: null }

/**
 * The background worker's side of listening (ADR-0017 #2): it checks voice is
 * on, relays each page request to the offscreen document under an id of its
 * own, and keeps a stop or cancel that arrives early, so the microphone is
 * never left open and a cancelled recording is never sent.
 */
export class VoiceRelay {
  readonly #deps: VoiceRelayDeps
  readonly #requests = new Map<string, Request>()
  readonly #exploring = new Set<number>()
  /** Where speech has gone so far, so each is said only once. */
  readonly #told = new Set<RecognizerMode>()
  #nextId: number

  constructor(deps: VoiceRelayDeps) {
    this.#deps = deps
    this.#nextId = deps.firstId
  }

  /** `key` names the page's request: tab, frame and the page's own number. */
  async start(key: string, maxMs: number): Promise<ListenResponse> {
    // Registered before anything is awaited, so a stop or cancel that follows at once is kept.
    const request: Request = { id: this.#nextId++, sent: false, stopped: false, cancelled: false }
    this.#requests.set(key, request)
    try {
      const engine = await this.#deps.engine()
      if (engine === 'off') return { ok: false, error: 'voice-off' }
      await this.#deps.ensureOffscreen()
      if (request.cancelled) return SILENCE
      const answer = this.#send(request, { target: 'offscreen', type: 'recognize', id: request.id, maxMs, engine })
      if (request.stopped) this.#tell(request, 'stop')
      return this.#withNotice(await this.#finish(request, engine, await answer))
    } finally {
      if (this.#requests.get(key) === request) this.#requests.delete(key)
      this.#closeIfIdle()
    }
  }

  control(key: string, action: 'stop' | 'cancel'): void {
    const request = this.#requests.get(key)
    if (!request) return
    if (action === 'stop') request.stopped = true
    else request.cancelled = true
    if (request.sent) this.#tell(request, action)
  }

  /** Tabs with Explore Mode on. Once none has and nothing is being listened to, the document closes. */
  noteExploreState(tabId: number, enabled: boolean): void {
    if (enabled) this.#exploring.add(tabId)
    else this.#exploring.delete(tabId)
    this.#closeIfIdle()
  }

  #send(request: Request, message: OffscreenRequest): Promise<unknown> {
    request.sent = true
    return this.#deps.toOffscreen(message)
  }

  #tell(request: Request, action: 'stop' | 'cancel'): void {
    const type = action === 'stop' ? 'recognize-stop' : 'recognize-cancel'
    this.#deps.toOffscreen({ target: 'offscreen', type, id: request.id }).catch(() => {})
  }

  async #finish(request: Request, engine: 'chrome' | 'gemini', answer: unknown): Promise<ListenResponse> {
    if (engine === 'chrome') return request.cancelled ? SILENCE : (answer as ListenResponse)
    const recording = answer as RecordingResponse
    if (!recording.ok) return recording
    // A cancelled or silent recording never leaves this computer.
    if (request.cancelled || recording.audio === null) return SILENCE
    const words = await this.#deps.transcribe(recording.audio)
    return words.ok ? { ...words, mode: 'gemini' } : words
  }

  #withNotice(response: ListenResponse): ListenResponse {
    if (!response.ok || !response.mode || this.#told.has(response.mode)) return response
    this.#told.add(response.mode)
    return { ...response, notice: NOTICES[response.mode] }
  }

  #closeIfIdle(): void {
    if (this.#exploring.size === 0 && this.#requests.size === 0) this.#deps.closeOffscreen()
  }
}
