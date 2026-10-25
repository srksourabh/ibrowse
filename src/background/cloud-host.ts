import { AiAssistant } from '../ai/ai-assistant'
import { fetchImage } from '../ai/image-fetch'
import type { AiRequest, AiResponse, LatencyReportMessage } from '../ai/messages'
import { AudioCache } from '../cloud/audio-cache'
import { GeminiClient } from '../cloud/gemini-client'
import type { CloudCancelRequest, CloudSpeechRequest, CloudSpeechResponse } from '../cloud/messages'
import { loadGeminiKey } from '../cloud/secrets'
import { CloudVoiceService } from '../cloud/voice-service'
import { loadSettings } from '../shared/settings'

const REMEMBERED_PHRASES = 30

export type CloudMessage = CloudSpeechRequest | CloudCancelRequest | AiRequest | LatencyReportMessage
type Respond = (response: CloudSpeechResponse | AiResponse) => void

/**
 * The background worker's half of the cloud features. It alone reads the key,
 * and the key never leaves this worker: pages send text and receive audio or
 * words, nothing else.
 */
export class CloudHost {
  readonly #voice: CloudVoiceService
  readonly #ai: AiAssistant

  constructor() {
    const client = new GeminiClient({
      fetch: (input, init) => fetch(input, init),
      getKey: () => loadGeminiKey(chrome.storage.local),
    })
    this.#voice = new CloudVoiceService({
      client,
      getSettings: () => loadSettings(chrome.storage.local),
      cache: new AudioCache(REMEMBERED_PHRASES),
    })
    this.#ai = new AiAssistant({
      client,
      getSettings: () => loadSettings(chrome.storage.local),
      fetchImage: (url) => fetchImage(url, (input, init) => fetch(input, init)),
    })
  }

  /** Returns true when the answer will be sent later. */
  handle(message: CloudMessage, respond: Respond): boolean {
    switch (message.type) {
      case 'cloud-speech':
        void this.#voice.speak(message.id, message.text).then(respond)
        return true
      case 'cloud-cancel':
        this.#voice.cancel(message.id)
        return false
      case 'ai-request':
        void this.#answer(message).then(respond)
        return true
      case 'latency-report':
        void chrome.storage.session.set({ latency: message.report })
        return false
    }
  }

  #answer(request: AiRequest): Promise<AiResponse> {
    if (request.task === 'image') return this.#ai.describeImage(request.image)
    if (request.task === 'question') return this.#ai.answerQuestion(request.question)
    return request.task === 'purpose' ? this.#ai.purpose(request.page) : this.#ai.summarize(request.page)
  }
}
