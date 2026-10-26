/** Below this loudness (root mean square, 0 to 1) a recording is taken as silence and never sent. */
const SILENCE_RMS = 0.01

/** 16-bit mono PCM WAV, a format Gemini accepts (Chrome's own recordings are WebM, which it does not). */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const view = new DataView(bytes.buffer)
  const ascii = (offset: number, value: string): void =>
    [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  samples.forEach((sample, i) => {
    const clipped = Math.max(-1, Math.min(1, sample))
    view.setInt16(44 + i * 2, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true)
  })
  return bytes
}

/** Loudness is judged over short stretches (50 ms at the recorder's 16 kHz), so a brief command in a long hold counts. */
const FRAME = 800

function loudness(samples: Float32Array): number {
  return Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length)
}

/** True when no stretch of the recording is as loud as speech. */
export function isSilent(samples: Float32Array): boolean {
  for (let start = 0; start < samples.length; start += FRAME) {
    if (loudness(samples.subarray(start, start + FRAME)) >= SILENCE_RMS) return false
  }
  return true
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(binary)
}

/** One recorded request, ready for Gemini as base64 WAV, or null when nobody spoke. */
export function recordingToAudio(samples: Float32Array, sampleRate: number): string | null {
  return isSilent(samples) ? null : toBase64(encodeWav(samples, sampleRate))
}
