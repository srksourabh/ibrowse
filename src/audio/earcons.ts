import { clampPan } from './pan'

export const EARCON_NAMES = [
  'interactive',
  'static',
  'boundary',
  'edge',
  'error',
  'confirm',
  'tick',
] as const

export type EarconName = (typeof EARCON_NAMES)[number]

interface Pulse {
  readonly freq: number
  readonly ms: number
  readonly gain: number
}

interface EarconDefinition {
  readonly pulses: readonly Pulse[]
  readonly gapMs: number
}

// Audible tones, not the haptic frequencies in the PRD: laptop speakers and
// headphones cannot reproduce 90 to 280 Hz at useful loudness.
const EARCONS: Record<EarconName, EarconDefinition> = {
  interactive: {
    pulses: [
      { freq: 880, ms: 20, gain: 0.5 },
      { freq: 1175, ms: 15, gain: 0.5 },
    ],
    gapMs: 10,
  },
  static: { pulses: [{ freq: 440, ms: 12, gain: 0.2 }], gapMs: 0 },
  boundary: {
    pulses: [
      { freq: 196, ms: 40, gain: 0.6 },
      { freq: 165, ms: 40, gain: 0.5 },
    ],
    gapMs: 20,
  },
  edge: { pulses: [{ freq: 660, ms: 30, gain: 0.4 }], gapMs: 0 },
  error: {
    pulses: [
      { freq: 147, ms: 20, gain: 0.6 },
      { freq: 147, ms: 20, gain: 0.6 },
      { freq: 147, ms: 20, gain: 0.6 },
    ],
    gapMs: 10,
  },
  confirm: { pulses: [{ freq: 523, ms: 35, gain: 0.5 }], gapMs: 0 },
  // The click that marks each word while scrubbing.
  tick: { pulses: [{ freq: 1000, ms: 8, gain: 0.35 }], gapMs: 0 },
}

const msToSamples = (ms: number, sampleRate: number): number =>
  Math.round((ms * sampleRate) / 1000)

/**
 * Renders an earcon as mono samples. Each pulse is shaped by a sine window
 * that is exactly zero at both ends, so playback never clicks.
 */
export function renderEarcon(name: EarconName, sampleRate: number): Float32Array {
  const { pulses, gapMs } = EARCONS[name]
  const gap = msToSamples(gapMs, sampleRate)
  const lengths = pulses.map((p) => msToSamples(p.ms, sampleRate))
  const total = lengths.reduce((sum, n) => sum + n, 0) + gap * (pulses.length - 1)
  const out = new Float32Array(total)

  let offset = 0
  pulses.forEach((pulse, index) => {
    const length = lengths[index] ?? 0
    for (let i = 0; i < length; i++) {
      const window = Math.sin((Math.PI * i) / (length - 1))
      const tone = Math.sin((2 * Math.PI * pulse.freq * i) / sampleRate)
      out[offset + i] = pulse.gain * window * tone
    }
    offset += length + gap
  })
  return out
}

interface BufferLike {
  getChannelData(channel: number): Float32Array
}

/** The slice of AudioContext the engine uses, so tests can supply a fake. */
export interface AudioContextLike {
  readonly sampleRate: number
  readonly destination: unknown
  createBuffer(channels: number, length: number, sampleRate: number): BufferLike
  createBufferSource(): { buffer: unknown; connect(node: unknown): void; start(): void }
  createStereoPanner(): { pan: { value: number }; connect(node: unknown): void }
}

export class EarconEngine {
  readonly #context: AudioContextLike
  readonly #buffers = new Map<EarconName, BufferLike>()

  constructor(context: AudioContextLike) {
    this.#context = context
  }

  play(name: EarconName, pan: number): void {
    const source = this.#context.createBufferSource()
    source.buffer = this.#bufferFor(name)
    const panner = this.#context.createStereoPanner()
    panner.pan.value = clampPan(pan)
    source.connect(panner)
    panner.connect(this.#context.destination)
    source.start()
  }

  #bufferFor(name: EarconName): BufferLike {
    const cached = this.#buffers.get(name)
    if (cached) return cached
    const samples = renderEarcon(name, this.#context.sampleRate)
    const buffer = this.#context.createBuffer(1, samples.length, this.#context.sampleRate)
    buffer.getChannelData(0).set(samples)
    this.#buffers.set(name, buffer)
    return buffer
  }
}
