import { describe, expect, it } from 'vitest'
import { encodeWav, isSilent, recordingToAudio } from '../../src/voice/wav'

const text = (bytes: Uint8Array, from: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(from, from + length))

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM WAV header for the sample rate', () => {
    const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1]), 16000)
    const view = new DataView(wav.buffer)
    expect(text(wav, 0, 4)).toBe('RIFF')
    expect(text(wav, 8, 4)).toBe('WAVE')
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(text(wav, 36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(8)
    expect(wav.length).toBe(44 + 8)
  })

  it('converts samples to 16-bit integers, clipping anything out of range', () => {
    const view = new DataView(encodeWav(new Float32Array([0, 1, -1, 2]), 16000).buffer)
    expect(view.getInt16(44, true)).toBe(0)
    expect(view.getInt16(46, true)).toBe(32767)
    expect(view.getInt16(48, true)).toBe(-32768)
    expect(view.getInt16(50, true)).toBe(32767)
  })
})

describe('isSilent', () => {
  it('is true for nothing, or for very quiet sound', () => {
    expect(isSilent(new Float32Array(0))).toBe(true)
    expect(isSilent(new Float32Array(1600).fill(0.001))).toBe(true)
  })

  it('is false for speech-level sound', () => {
    const tone = Float32Array.from({ length: 1600 }, (_, i) => 0.2 * Math.sin(i / 3))
    expect(isSilent(tone)).toBe(false)
  })
})

describe('recordingToAudio', () => {
  it('gives nothing for silence, so nothing is sent', () => {
    expect(recordingToAudio(new Float32Array(1600), 16000)).toBeNull()
  })

  it('gives the recording as base64 WAV', () => {
    const tone = Float32Array.from({ length: 1600 }, (_, i) => 0.2 * Math.sin(i / 3))
    const audio = recordingToAudio(tone, 16000)!
    const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0))
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('RIFF')
    expect(bytes.length).toBe(44 + 1600 * 2)
  })
})
