import type { Settings } from '../shared/settings'
import type { AudioCache } from './audio-cache'
import { CloudError, type GeminiClient } from './gemini-client'
import type { CloudSpeechResponse } from './messages'

const MAX_REMEMBERED_CANCELS = 100

export interface CloudVoiceServiceDeps {
  client: Pick<GeminiClient, 'synthesize'>
  getSettings(): Promise<Pick<Settings, 'cloudVoice' | 'cloudVoiceName' | 'cloudVoiceModel'>>
  cache: AudioCache<{ base64: string; mimeType: string }>
}

/**
 * Runs in the background worker, where the key is. Turns text into audio with
 * the voice and model from the settings, remembers what it has made, and can
 * drop a request that is no longer wanted.
 */
export class CloudVoiceService {
  readonly #deps: CloudVoiceServiceDeps
  readonly #running = new Map<number, AbortController>()
  readonly #cancelledEarly = new Set<number>()

  constructor(deps: CloudVoiceServiceDeps) {
    this.#deps = deps
  }

  async speak(id: number, text: string): Promise<CloudSpeechResponse> {
    const settings = await this.#deps.getSettings()
    if (settings.cloudVoice === 'off') {
      return { ok: false, kind: 'disabled', reason: 'Cloud voice is off.' }
    }
    if (this.#cancelledEarly.delete(id)) return cancelled()

    const cacheKey = `${settings.cloudVoiceModel}|${settings.cloudVoiceName}|${text}`
    const cached = this.#deps.cache.get(cacheKey)
    if (cached) return { ok: true, ...cached }

    const controller = new AbortController()
    this.#running.set(id, controller)
    try {
      const audio = await this.#deps.client.synthesize({
        text,
        voice: settings.cloudVoiceName,
        model: settings.cloudVoiceModel,
        signal: controller.signal,
      })
      this.#deps.cache.set(cacheKey, audio)
      return { ok: true, ...audio }
    } catch (error) {
      return failureFor(error)
    } finally {
      this.#running.delete(id)
    }
  }

  cancel(id: number): void {
    const running = this.#running.get(id)
    if (running) {
      running.abort()
      return
    }
    // Asked to cancel before the request began: remember, so it never starts.
    if (this.#cancelledEarly.size >= MAX_REMEMBERED_CANCELS) this.#cancelledEarly.clear()
    this.#cancelledEarly.add(id)
  }
}

const cancelled = (): CloudSpeechResponse => ({ ok: false, kind: 'cancelled', reason: 'Cancelled.' })

function failureFor(error: unknown): CloudSpeechResponse {
  if (error instanceof CloudError) return { ok: false, kind: error.kind, reason: error.spoken }
  if ((error as { name?: string } | null)?.name === 'AbortError') return cancelled()
  const network = new CloudError('network')
  return { ok: false, kind: network.kind, reason: network.spoken }
}
