import { LiveRegionProvider } from '../audio/live-region-provider'
import { MessageSpeechProvider } from '../audio/providers'
import { RoutingProvider } from '../audio/routing-provider'
import { SpeechService, type SpeechProvider } from '../audio/speech-service'
import { chooseVoice, withVoiceSettings } from '../audio/voice-choice'
import { CloudVoiceProvider, type PlayingAudio } from '../cloud/cloud-voice-provider'
import type { CloudCancelRequest, CloudSpeechRequest, CloudSpeechResponse } from '../cloud/messages'
import type { SpeechRequest, SpeechResponse } from '../shared/messages'
import type { Settings } from '../shared/settings'

export interface SpeechChain {
  readonly speech: SpeechService
  /** The background worker says the sound of speech request `id` has begun. */
  handleSpeechStarted(id: number): void
  /** The settings or the key changed, so a lasting cloud problem may be gone. */
  resetCloud(): void
}

export interface SpeechChainDeps {
  getSettings(): Settings
  audioContext(): AudioContext
  reportError(error: unknown): void
}

/** How long to wait for the browser to start audio before giving up on the cloud voice. */
const RESUME_WAIT_MS = 800

function bytesFrom(base64: string): ArrayBuffer {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer
}

/** Plays decoded cloud audio, panned, and lets it be stopped. */
function createCloudAudio(audioContext: () => AudioContext) {
  return {
    canPlay: async (): Promise<boolean> => {
      const ctx = audioContext()
      const isRunning = (): boolean => ctx.state === 'running' // read afresh: it changes while we wait
      if (isRunning()) return true
      // The browser wakes audio a moment after the first click or key press; wait for that, briefly.
      if (!navigator.userActivation?.hasBeenActive) return false
      try {
        await Promise.race([ctx.resume(), new Promise((resolve) => setTimeout(resolve, RESUME_WAIT_MS))])
      } catch {
        return false
      }
      return isRunning()
    },
    decode: (base64: string): Promise<AudioBuffer> => audioContext().decodeAudioData(bytesFrom(base64)),
    play(audio: unknown, options: { pan: number; rate: number }): PlayingAudio {
      const ctx = audioContext()
      const source = ctx.createBufferSource()
      source.buffer = audio as AudioBuffer
      source.playbackRate.value = options.rate
      const panner = ctx.createStereoPanner()
      panner.pan.value = options.pan
      source.connect(panner)
      panner.connect(ctx.destination)
      const ended = new Promise<void>((resolve) => {
        source.onended = () => resolve()
      })
      source.start()
      return {
        ended,
        stop: () => {
          try {
            source.stop()
          } catch {
            // Already stopped: nothing left to do.
          }
        },
      }
    },
  }
}

/**
 * Builds the page's voice: a local voice by default, a cloud voice for
 * reading if the user chose that, and a hidden live region instead of both
 * when a screen reader is speaking (Companion mode). Which one speaks is
 * decided afresh for each utterance, from the current settings.
 */
export function createSpeechChain(deps: SpeechChainDeps): SpeechChain {
  const send = (request: SpeechRequest): Promise<SpeechResponse> => chrome.runtime.sendMessage(request)
  const messageProvider = new MessageSpeechProvider(send, deps.reportError)
  const local = withVoiceSettings(messageProvider, deps.getSettings)
  const companion = new LiveRegionProvider(document)
  const audio = createCloudAudio(deps.audioContext)

  const cloud = new CloudVoiceProvider({
    request: (request: CloudSpeechRequest): Promise<CloudSpeechResponse> => chrome.runtime.sendMessage(request),
    cancelRequest: (id) => {
      const cancel: CloudCancelRequest = { type: 'cloud-cancel', id }
      chrome.runtime.sendMessage(cancel).catch(deps.reportError)
    },
    decode: audio.decode,
    play: audio.play,
    canPlay: audio.canPlay,
    fallback: local,
    onProblem: (text) => void local.speak({ text }).catch(deps.reportError),
  })

  const choose = (utterance: Parameters<SpeechProvider['speak']>[0]): SpeechProvider => {
    const kind = chooseVoice(deps.getSettings(), utterance)
    return kind === 'companion' ? companion : kind === 'cloud' ? cloud : local
  }

  return {
    speech: new SpeechService(new RoutingProvider(choose), { onError: deps.reportError }),
    handleSpeechStarted: (id) => messageProvider.handleStarted(id),
    resetCloud: () => cloud.reset(),
  }
}
