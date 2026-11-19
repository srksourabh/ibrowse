import { describe, expect, it, vi } from 'vitest'
import { CloudError } from '../../src/cloud/cloud-error'
import {
  DEFAULT_LIVE_MODEL,
  GeminiLiveClient,
  pcm16ToWavBase64,
  withLiveVoiceFallback,
  type WebSocketLike,
} from '../../src/cloud/gemini-live'

class FakeSocket implements WebSocketLike {
  readyState = 1
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onclose: (() => void) | null = null
  readonly sent: string[] = []
  closed = false

  send(data: string): void {
    this.sent.push(data)
    const parsed = JSON.parse(data) as Record<string, unknown>
    if ('setup' in parsed) {
      queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ setupComplete: {} }) }))
    }
  }

  close(): void {
    this.closed = true
    this.readyState = 3
  }

  open(): void {
    this.onopen?.()
  }

  emitAudio(base64: string, done = false): void {
    this.onmessage?.({
      data: JSON.stringify({
        serverContent: {
          modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: base64 } }] },
          turnComplete: done,
        },
      }),
    })
  }
}

describe('pcm16ToWavBase64', () => {
  it('wraps raw 16-bit PCM bytes with a valid 44-byte RIFF/WAVE header', () => {
    const pcm = new Uint8Array([1, 2, 3, 4])
    const wav = Uint8Array.from(atob(pcm16ToWavBase64([pcm], 24_000)), (c) => c.charCodeAt(0))
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe('WAVE')
    expect(wav.length).toBe(48)
    expect([...wav.slice(44)]).toEqual([1, 2, 3, 4])
  })
})

describe('GeminiLiveClient', () => {
  it('opens a Live WebSocket with Indian English setup and reuses it across turns', async () => {
    const sockets: FakeSocket[] = []
    const client = new GeminiLiveClient({
      getKey: async () => 'AIzaTESTKEY1234567890abcdef',
      createSocket: () => {
        const s = new FakeSocket()
        sockets.push(s)
        queueMicrotask(() => s.open())
        return s
      },
    })

    const first = client.synthesize({ text: 'Hello world.', voice: 'Kore', model: 'm' })
    await new Promise((r) => setTimeout(r, 10))
    const setupMsg = JSON.parse(sockets[0]!.sent[0]!) as { setup: { model: string; systemInstruction: { parts: Array<{ text: string }> } } }
    expect(setupMsg.setup.model).toBe(DEFAULT_LIVE_MODEL)
    expect(setupMsg.setup.systemInstruction.parts[0]!.text).toMatch(/Indian English/i)

    sockets[0]!.emitAudio(btoa('ABCD'), false)
    sockets[0]!.emitAudio(btoa('EFGH'), true)
    const audio1 = await first
    expect(audio1.mimeType).toBe('audio/wav')

    // Second utterance reuses the exact same WebSocket without reconnecting!
    const second = client.synthesize({ text: 'Next sentence.', voice: 'Kore', model: 'm' })
    await new Promise((r) => setTimeout(r, 10))
    sockets[0]!.emitAudio(btoa('IJKL'), true)
    const audio2 = await second
    expect(audio2.mimeType).toBe('audio/wav')
    expect(sockets).toHaveLength(1)
  })

  it('rejects with AbortError and closes the socket when cancelled', async () => {
    const sockets: FakeSocket[] = []
    const client = new GeminiLiveClient({
      getKey: async () => 'AIzaTESTKEY1234567890abcdef',
      createSocket: () => {
        const s = new FakeSocket()
        sockets.push(s)
        queueMicrotask(() => s.open())
        return s
      },
    })
    const ac = new AbortController()
    const promise = client.synthesize({ text: 'Cancel me', voice: 'Kore', model: 'm', signal: ac.signal })
    await new Promise((r) => setTimeout(r, 10))
    ac.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(sockets[0]!.closed).toBe(true)
  })
})

describe('withLiveVoiceFallback', () => {
  const req = { text: 'Hi', voice: 'Kore', model: 'gemini-3.8-flash-lite-tts' }

  it('uses Live WebSocket when it succeeds', async () => {
    const live = { synthesize: vi.fn(async () => ({ base64: 'LIVE', mimeType: 'audio/wav' })) }
    const rest = { synthesize: vi.fn(async () => ({ base64: 'REST', mimeType: 'audio/wav' })) }
    expect(await withLiveVoiceFallback(live, rest).synthesize(req)).toEqual({ base64: 'LIVE', mimeType: 'audio/wav' })
    expect(rest.synthesize).not.toHaveBeenCalled()
  })

  it('falls back to REST TTS when Live WebSocket fails', async () => {
    const live = { synthesize: vi.fn(async () => { throw new CloudError('network') }) }
    const rest = { synthesize: vi.fn(async () => ({ base64: 'REST', mimeType: 'audio/wav' })) }
    expect(await withLiveVoiceFallback(live, rest).synthesize(req)).toEqual({ base64: 'REST', mimeType: 'audio/wav' })
    expect(rest.synthesize).toHaveBeenCalledOnce()
  })

  it('never falls back on AbortError', async () => {
    const live = { synthesize: vi.fn(async () => { throw new DOMException('aborted', 'AbortError') }) }
    const rest = { synthesize: vi.fn(async () => ({ base64: 'REST', mimeType: 'audio/wav' })) }
    await expect(withLiveVoiceFallback(live, rest).synthesize(req)).rejects.toMatchObject({ name: 'AbortError' })
    expect(rest.synthesize).not.toHaveBeenCalled()
  })
})
