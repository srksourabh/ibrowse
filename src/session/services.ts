import { EarconEngine, type EarconName } from '../audio/earcons'
import { panFromX } from '../audio/pan'
import type { SpeechService } from '../audio/speech-service'
import type { HapticEvent } from '../haptics/events'
import { DEFAULT_SETTINGS, loadSettings, type Settings } from '../shared/settings'
import { createSpeechChain } from './speech-chain'

/** Things every part of an Explore Mode session shares: voice, sound, settings, pan. */
export interface Services {
  readonly speech: SpeechService
  /** Playing an Earcon also fires its Haptic Event; `haptic` fires one on its own. */
  readonly earcons: { play(name: EarconName, pan: number): void; haptic(event: HapticEvent): void }
  readonly reportError: (error: unknown) => void
  /** The shared audio context, created on first use. */
  audioContext(): AudioContext
  settings(): Settings
  rate(): number
  /** Stereo pan for a horizontal position in this frame, measured against the whole window. */
  panAt(clientX: number): number
  /** Learns where this frame sits in the window, from any pointer event. */
  noteScreenPosition(event: PointerEvent): void
  resumeAudio(): void
  /** The background worker says the sound of speech request `id` has begun. */
  handleSpeechStarted(id: number): void
  /** Loads settings from storage, and again whenever they change. */
  watchSettings(onLoaded: (settings: Settings) => void): void
}

function createAudio(reportError: (error: unknown) => void) {
  // The context is created on first use. Browsers may keep it suspended until the
  // page has seen a click or key press (ADR-0010), so it is resumed on those.
  let audio: { context: AudioContext; engine: EarconEngine } | undefined
  const ensure = (): NonNullable<typeof audio> => {
    if (!audio) {
      const context = new AudioContext()
      audio = { context, engine: new EarconEngine(context) }
    }
    return audio
  }
  return {
    context: (): AudioContext => ensure().context,
    play: (name: EarconName, pan: number): void => ensure().engine.play(name, pan),
    resume: (): void => {
      const { context } = ensure()
      if (context.state === 'suspended') context.resume().catch(reportError)
    },
  }
}

export function createServices(): Services {
  const reportError = (error: unknown): void => {
    console.error('iBrowse error:', error instanceof Error ? error.message : 'unknown')
  }
  const audio = createAudio(reportError)

  let settings: Settings = DEFAULT_SETTINGS
  // Distance from this frame's left edge to the window's, so an iframe pans by where it is on screen.
  let frameOffsetX = 0

  const chain = createSpeechChain({
    getSettings: () => settings,
    audioContext: audio.context,
    reportError,
  })

  const watchSettings = (onLoaded: (settings: Settings) => void): void => {
    const load = (): void => {
      loadSettings(chrome.storage.local)
        .then((loaded) => {
          settings = loaded
          chain.resetCloud()
          onLoaded(loaded)
        })
        .catch(reportError)
    }
    chrome.storage.onChanged.addListener(load)
    load()
  }

  return {
    speech: chain.speech,
    // The haptic half is attached by `withHaptics` once the haptic manager exists.
    earcons: { play: audio.play, haptic: () => {} },
    audioContext: audio.context,
    reportError,
    settings: () => settings,
    rate: () => settings.speechRate,
    panAt: (x) => panFromX(x + frameOffsetX, window.outerWidth),
    noteScreenPosition: (e) => {
      frameOffsetX = e.screenX - window.screenX - e.clientX
    },
    resumeAudio: audio.resume,
    handleSpeechStarted: chain.handleSpeechStarted,
    watchSettings,
  }
}
