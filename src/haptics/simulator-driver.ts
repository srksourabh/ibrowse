import type { AudioContextLike } from '../audio/earcons'
import { clampPan } from '../audio/pan'
import type { ConnectResult, HapticCapabilities, HapticDriver } from './driver'
import { HAPTIC_EFFECTS, type HapticEffect, type HapticEvent } from './events'

const msToSamples = (ms: number, sampleRate: number): number => Math.round((ms * sampleRate) / 1000)

/**
 * Renders an effect as mono samples at the given intensity. Each pulse
 * glides from its start to its end frequency under a sine window that is
 * zero at both ends, so it never clicks.
 */
export function renderHaptic(effect: HapticEffect, sampleRate: number, intensity: number): Float32Array {
  const gap = msToSamples(effect.gapMs, sampleRate)
  const lengths = effect.pulses.map((p) => msToSamples(p.ms, sampleRate))
  const total = lengths.reduce((sum, n) => sum + n, 0) + gap * Math.max(0, effect.pulses.length - 1)
  const out = new Float32Array(total)

  let offset = 0
  effect.pulses.forEach((pulse, index) => {
    const length = lengths[index] ?? 0
    let phase = 0
    for (let i = 0; i < length; i++) {
      const progress = length > 1 ? i / (length - 1) : 0
      phase += (2 * Math.PI * (pulse.startHz + (pulse.endHz - pulse.startHz) * progress)) / sampleRate
      out[offset + i] = pulse.gain * intensity * Math.sin(Math.PI * progress) * Math.sin(phase)
    }
    offset += length + gap
  })
  return out
}

export interface PlayedHaptic {
  readonly event: HapticEvent
  readonly intensity: number
  readonly samples: Float32Array
  readonly sampleRate: number
}

/**
 * Plays Haptic Events as low sound, so what hardware would feel can be heard
 * through headphones or a subwoofer, and drawn by anything that observes it.
 * It needs no device, so it is also how evaluators and developers try the
 * event vocabulary.
 */
export class SimulatorDriver implements HapticDriver {
  readonly id = 'simulator'
  readonly name = 'Sound simulator'
  readonly #context: AudioContextLike
  readonly #observers = new Set<(played: PlayedHaptic) => void>()

  constructor(context: AudioContextLike) {
    this.#context = context
  }

  capabilities(): HapticCapabilities {
    return { events: 'all' }
  }

  async connect(): Promise<ConnectResult> {
    return { ok: true }
  }

  async disconnect(): Promise<void> {}

  play(event: HapticEvent, intensity: number): void {
    const { sampleRate } = this.#context
    const samples = renderHaptic(HAPTIC_EFFECTS[event], sampleRate, intensity)
    const buffer = this.#context.createBuffer(1, samples.length, sampleRate)
    buffer.getChannelData(0).set(samples)

    const source = this.#context.createBufferSource()
    source.buffer = buffer
    const panner = this.#context.createStereoPanner()
    panner.pan.value = clampPan(0)
    source.connect(panner)
    panner.connect(this.#context.destination)
    source.start()

    this.#observers.forEach((observer) => observer({ event, intensity, samples, sampleRate }))
  }

  /** Receives every played effect, for example to draw its waveform. Returns a function to stop. */
  observe(observer: (played: PlayedHaptic) => void): () => void {
    this.#observers.add(observer)
    return () => this.#observers.delete(observer)
  }

  /** There is no device to lose, so the listener is never called. */
  onDisconnect(_listener: () => void): () => void {
    return () => {}
  }
}
