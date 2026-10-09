import type { Settings } from '../shared/settings'
import type { SpeechProvider, Utterance } from './speech-service'

export type VoiceKind = 'companion' | 'cloud' | 'local'

/**
 * Which voice should speak an utterance. A screen reader wins whenever
 * Companion mode is on. Otherwise the cloud voice speaks reading aloud, or
 * everything, if the user chose that; quick feedback stays on the local voice,
 * which starts at once.
 */
export function chooseVoice(
  settings: Pick<Settings, 'screenReaderMode' | 'cloudVoice'>,
  utterance: Utterance,
): VoiceKind {
  if (settings.screenReaderMode === 'companion') return 'companion'
  if (settings.cloudVoice === 'all') return 'cloud'
  if (settings.cloudVoice === 'reading' && utterance.kind === 'reading') return 'cloud'
  return 'local'
}

/**
 * Adds the user's pitch, volume and voice to every utterance that did not
 * choose its own. An empty voice name is left out, so the system default is used.
 */
export function withVoiceSettings(
  provider: SpeechProvider,
  getVoice: () => Pick<Settings, 'pitch' | 'volume' | 'voiceName'>,
): SpeechProvider {
  return {
    speak(utterance) {
      const { pitch, volume, voiceName } = getVoice()
      return provider.speak({ ...(voiceName ? { voiceName } : {}), pitch, volume, ...utterance })
    },
    cancel: () => provider.cancel(),
  }
}
