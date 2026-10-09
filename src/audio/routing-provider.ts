import type { SpeechProvider, Utterance } from './speech-service'

/**
 * Chooses a voice for each utterance, and remembers which voices are speaking
 * so that cancelling reaches exactly those and no others.
 */
export class RoutingProvider implements SpeechProvider {
  readonly #choose: (utterance: Utterance) => SpeechProvider
  readonly #speaking = new Map<SpeechProvider, number>()

  constructor(choose: (utterance: Utterance) => SpeechProvider) {
    this.#choose = choose
  }

  async speak(utterance: Utterance): Promise<void> {
    const provider = this.#choose(utterance)
    this.#speaking.set(provider, (this.#speaking.get(provider) ?? 0) + 1)
    try {
      await provider.speak(utterance)
    } finally {
      const remaining = (this.#speaking.get(provider) ?? 1) - 1
      if (remaining > 0) this.#speaking.set(provider, remaining)
      else this.#speaking.delete(provider)
    }
  }

  cancel(): void {
    for (const provider of [...this.#speaking.keys()]) provider.cancel()
  }
}
