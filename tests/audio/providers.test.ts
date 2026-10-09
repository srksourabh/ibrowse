import { describe, expect, it, vi } from 'vitest'
import { ChromeTtsProvider, MessageSpeechProvider } from '../../src/audio/providers'

type TtsEvent = { type: string; errorMessage?: string }
type TtsOptions = {
  rate?: number
  pitch?: number
  volume?: number
  voiceName?: string
  onEvent?: (e: TtsEvent) => void
}

function fakeTts() {
  let options: TtsOptions = {}
  const api = {
    speak: vi.fn((_text: string, o: TtsOptions) => {
      options = o
    }),
    stop: vi.fn(),
  }
  return { api, emit: (e: TtsEvent) => options.onEvent?.(e) }
}

describe('ChromeTtsProvider', () => {
  it('resolves when the voice reports end', async () => {
    const { api, emit } = fakeTts()
    const done = new ChromeTtsProvider(api).speak({ text: 'Hi', rate: 1.5 })
    expect(api.speak).toHaveBeenCalledWith('Hi', expect.objectContaining({ rate: 1.5 }))
    emit({ type: 'end' })
    await expect(done).resolves.toBeUndefined()
  })

  it('resolves when speech is interrupted or cancelled', async () => {
    for (const type of ['interrupted', 'cancelled']) {
      const { api, emit } = fakeTts()
      const done = new ChromeTtsProvider(api).speak({ text: 'Hi' })
      emit({ type })
      await expect(done).resolves.toBeUndefined()
    }
  })

  it('rejects with the engine message on error', async () => {
    const { api, emit } = fakeTts()
    const done = new ChromeTtsProvider(api).speak({ text: 'Hi' })
    emit({ type: 'error', errorMessage: 'no voice' })
    await expect(done).rejects.toThrow('no voice')
  })

  it('stops the engine on cancel', () => {
    const { api } = fakeTts()
    new ChromeTtsProvider(api).cancel()
    expect(api.stop).toHaveBeenCalledOnce()
  })

  it('passes pitch, volume and voice to the engine when they are given', () => {
    const { api } = fakeTts()
    void new ChromeTtsProvider(api).speak({ text: 'Hi', pitch: 1.2, volume: 0.5, voiceName: 'Zira' })
    expect(api.speak).toHaveBeenCalledWith(
      'Hi',
      expect.objectContaining({ pitch: 1.2, volume: 0.5, voiceName: 'Zira' }),
    )
  })

  it('leaves out settings that were not given, so the engine keeps its defaults', () => {
    const { api } = fakeTts()
    void new ChromeTtsProvider(api).speak({ text: 'Hi' })
    const options = api.speak.mock.calls[0]![1]
    expect(Object.keys(options)).toEqual(['onEvent'])
  })

  it('tells the utterance when speech actually begins, once, without ending it', async () => {
    const { api, emit } = fakeTts()
    const onStart = vi.fn()
    let done = false
    const speaking = new ChromeTtsProvider(api).speak({ text: 'Hi', onStart }).then(() => {
      done = true
    })
    emit({ type: 'start' })
    emit({ type: 'start' })
    await Promise.resolve()
    expect(onStart).toHaveBeenCalledOnce()
    expect(done).toBe(false)
    emit({ type: 'end' })
    await speaking
  })

  it('ignores a voice-engine word or sentence event', async () => {
    const { api, emit } = fakeTts()
    let done = false
    void new ChromeTtsProvider(api).speak({ text: 'Hi' }).then(() => {
      done = true
    })
    emit({ type: 'word' })
    emit({ type: 'sentence' })
    await Promise.resolve()
    expect(done).toBe(false)
  })
})

describe('MessageSpeechProvider', () => {
  it('sends a speak message and resolves on ok', async () => {
    const send = vi.fn(async () => ({ ok: true as const }))
    await new MessageSpeechProvider(send).speak({ text: 'Hi' })
    expect(send).toHaveBeenCalledWith({
      type: 'speak',
      id: expect.any(Number),
      utterance: { text: 'Hi' },
    })
  })

  it('sends only what the worker needs, never functions or page-side fields', async () => {
    const send = vi.fn(async () => ({ ok: true as const }))
    await new MessageSpeechProvider(send).speak({
      text: 'Hi',
      rate: 1.5,
      pitch: 1,
      volume: 0.8,
      voiceName: 'Zira',
      pan: -0.5,
      kind: 'reading',
      onStart: () => {},
    })
    expect(send).toHaveBeenCalledWith({
      type: 'speak',
      id: expect.any(Number),
      utterance: { text: 'Hi', rate: 1.5, pitch: 1, volume: 0.8, voiceName: 'Zira' },
    })
  })

  it('gives each utterance its own id', async () => {
    const send = vi.fn(async (_request: unknown) => ({ ok: true as const }))
    const provider = new MessageSpeechProvider(send)
    await provider.speak({ text: 'a' })
    await provider.speak({ text: 'b' })
    const ids = send.mock.calls.map((c) => (c[0] as { id: number }).id)
    expect(new Set(ids).size).toBe(2)
  })

  it('calls an utterance onStart when the worker says its speech began', async () => {
    let finish: (r: { ok: true }) => void = () => {}
    const send = vi.fn(
      (_request: unknown) =>
        new Promise<{ ok: true }>((resolve) => {
          finish = resolve
        }),
    )
    const onStart = vi.fn()
    const provider = new MessageSpeechProvider(send)
    const speaking = provider.speak({ text: 'Hi', onStart })
    const { id } = send.mock.calls[0]![0] as unknown as { id: number }
    provider.handleStarted(id)
    provider.handleStarted(id)
    expect(onStart).toHaveBeenCalledOnce()
    finish({ ok: true })
    await speaking
  })

  it('ignores a start notice for speech it is no longer waiting for', async () => {
    const send = vi.fn(async (_request: unknown) => ({ ok: true as const }))
    const onStart = vi.fn()
    const provider = new MessageSpeechProvider(send)
    await provider.speak({ text: 'Hi', onStart })
    const { id } = send.mock.calls[0]![0] as unknown as { id: number }
    provider.handleStarted(id)
    provider.handleStarted(9999)
    expect(onStart).not.toHaveBeenCalled()
  })

  it('rejects with the background error message', async () => {
    const send = vi.fn(async () => ({ ok: false as const, error: 'no voice' }))
    await expect(new MessageSpeechProvider(send).speak({ text: 'Hi' })).rejects.toThrow('no voice')
  })

  it('sends a cancel message', () => {
    const send = vi.fn(async () => ({ ok: true as const }))
    new MessageSpeechProvider(send).cancel()
    expect(send).toHaveBeenCalledWith({ type: 'cancel' })
  })
})
