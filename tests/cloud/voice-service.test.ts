import { describe, expect, it, vi } from 'vitest'
import { AudioCache } from '../../src/cloud/audio-cache'
import { CloudError } from '../../src/cloud/gemini-client'
import { CloudVoiceService } from '../../src/cloud/voice-service'
import { DEFAULT_SETTINGS, type Settings } from '../../src/shared/settings'

function setup(
  options: {
    settings?: Partial<Settings>
    synthesize?: (req: { text: string; signal?: AbortSignal }) => Promise<{ base64: string; mimeType: string }>
  } = {},
) {
  const synthesize = vi.fn(
    options.synthesize ??
      (async (_req: { text: string; voice: string; model: string; signal?: AbortSignal }) => ({
        base64: 'QUJD',
        mimeType: 'audio/wav',
      })),
  )
  const service = new CloudVoiceService({
    client: { synthesize } as never,
    getSettings: async () => ({ ...DEFAULT_SETTINGS, cloudVoice: 'reading', ...options.settings }),
    cache: new AudioCache(10),
  })
  return { service, synthesize }
}

describe('CloudVoiceService.speak', () => {
  it('asks for the text in the voice and model from the settings', async () => {
    const { service, synthesize } = setup({ settings: { cloudVoiceName: 'Puck', cloudVoiceModel: 'gemini-3.8-flash-tts' } })
    const response = await service.speak(1, 'Hello')
    expect(response).toEqual({ ok: true, base64: 'QUJD', mimeType: 'audio/wav' })
    expect(synthesize).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Hello', voice: 'Puck', model: 'gemini-3.8-flash-tts' }),
    )
  })

  it('refuses, and sends nothing, when cloud voice is off', async () => {
    const { service, synthesize } = setup({ settings: { cloudVoice: 'off' } })
    expect(await service.speak(1, 'Hello')).toMatchObject({ ok: false, kind: 'disabled' })
    expect(synthesize).not.toHaveBeenCalled()
  })

  it('answers a repeated phrase from the cache without asking again', async () => {
    const { service, synthesize } = setup()
    await service.speak(1, 'End of page')
    await service.speak(2, 'End of page')
    expect(synthesize).toHaveBeenCalledOnce()
  })

  it('does not share cached audio between voices', async () => {
    const a = setup({ settings: { cloudVoiceName: 'Kore' } })
    await a.service.speak(1, 'Hi')
    expect(a.synthesize).toHaveBeenCalledOnce()
    const b = setup({ settings: { cloudVoiceName: 'Puck' } })
    await b.service.speak(1, 'Hi')
    expect(b.synthesize).toHaveBeenCalledOnce()
  })

  it('asks again when the voice setting changes between requests', async () => {
    let voice = 'Kore'
    const synthesize = vi.fn(async (_r: unknown) => ({ base64: 'QUJD', mimeType: 'audio/wav' }))
    const service = new CloudVoiceService({
      client: { synthesize } as never,
      getSettings: async () => ({ ...DEFAULT_SETTINGS, cloudVoice: 'reading', cloudVoiceName: voice }),
      cache: new AudioCache(10),
    })
    await service.speak(1, 'Hi')
    voice = 'Puck'
    await service.speak(2, 'Hi')
    expect(synthesize).toHaveBeenCalledTimes(2)
  })

  it('turns a cloud error into a failure with a sentence to say', async () => {
    const { service } = setup({
      synthesize: async () => {
        throw new CloudError('bad-key')
      },
    })
    const response = await service.speak(1, 'Hello')
    expect(response).toMatchObject({ ok: false, kind: 'bad-key' })
    expect(response.ok === false && response.reason).toMatch(/did not accept the key/i)
  })

  it('does not cache a failure', async () => {
    let fail = true
    const { service, synthesize } = setup({
      synthesize: async () => {
        if (fail) throw new CloudError('server')
        return { base64: 'QUJD', mimeType: 'audio/wav' }
      },
    })
    await service.speak(1, 'Hi')
    fail = false
    expect(await service.speak(2, 'Hi')).toMatchObject({ ok: true })
    expect(synthesize).toHaveBeenCalledTimes(2)
  })
})

describe('CloudVoiceService.cancel', () => {
  it('aborts a request that is still going, and reports it as cancelled', async () => {
    let seen: AbortSignal | undefined
    const { service } = setup({
      synthesize: (req) =>
        new Promise((_resolve, reject) => {
          seen = req.signal
          req.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    })
    const pending = service.speak(7, 'A long reading')
    await vi.waitFor(() => expect(seen).toBeDefined())
    service.cancel(7)
    expect(seen?.aborted).toBe(true)
    expect(await pending).toMatchObject({ ok: false, kind: 'cancelled' })
  })

  it('cancels a request that was cancelled before it even started', async () => {
    const { service, synthesize } = setup()
    service.cancel(8)
    const response = await service.speak(8, 'Hello')
    expect(response).toMatchObject({ ok: false, kind: 'cancelled' })
    expect(synthesize).not.toHaveBeenCalled()
  })

  it('does nothing for a request it does not know', () => {
    expect(() => setup().service.cancel(999)).not.toThrow()
  })
})
