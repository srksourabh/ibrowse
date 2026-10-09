import { describe, expect, it, vi } from 'vitest'
import { RoutingProvider } from '../../src/audio/routing-provider'
import type { SpeechProvider } from '../../src/audio/speech-service'
import { chooseVoice, withVoiceSettings } from '../../src/audio/voice-choice'
import { DEFAULT_SETTINGS } from '../../src/shared/settings'

function fakeProvider() {
  let finish: () => void = () => {}
  const provider: SpeechProvider = {
    speak: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    ),
    cancel: vi.fn(),
  }
  return { provider, finish: () => finish() }
}

describe('RoutingProvider', () => {
  it('sends each utterance to the provider chosen for it', async () => {
    const a = fakeProvider()
    const b = fakeProvider()
    const router = new RoutingProvider((u) => (u.text === 'a' ? a.provider : b.provider))
    void router.speak({ text: 'a' })
    void router.speak({ text: 'b' })
    expect(a.provider.speak).toHaveBeenCalledOnce()
    expect(b.provider.speak).toHaveBeenCalledOnce()
  })

  it('cancels only the providers that are speaking', async () => {
    const a = fakeProvider()
    const b = fakeProvider()
    const router = new RoutingProvider((u) => (u.text === 'a' ? a.provider : b.provider))
    void router.speak({ text: 'a' })
    router.cancel()
    expect(a.provider.cancel).toHaveBeenCalledOnce()
    expect(b.provider.cancel).not.toHaveBeenCalled()
  })

  it('forgets a provider once its speech has finished', async () => {
    const a = fakeProvider()
    const router = new RoutingProvider(() => a.provider)
    const speaking = router.speak({ text: 'a' })
    a.finish()
    await speaking
    router.cancel()
    expect(a.provider.cancel).not.toHaveBeenCalled()
  })

  it('forgets a provider whose speech failed, and passes the failure on', async () => {
    const failing: SpeechProvider = { speak: async () => Promise.reject(new Error('no voice')), cancel: vi.fn() }
    const router = new RoutingProvider(() => failing)
    await expect(router.speak({ text: 'a' })).rejects.toThrow('no voice')
    router.cancel()
    expect(failing.cancel).not.toHaveBeenCalled()
  })

  it('keeps a provider active while any of its utterances is still speaking', async () => {
    const a = fakeProvider()
    const router = new RoutingProvider(() => a.provider)
    void router.speak({ text: '1' })
    void router.speak({ text: '2' })
    a.finish()
    await Promise.resolve()
    router.cancel()
    expect(a.provider.cancel).toHaveBeenCalledOnce()
  })
})

describe('chooseVoice', () => {
  const s = (patch: Partial<typeof DEFAULT_SETTINGS>) => ({ ...DEFAULT_SETTINGS, ...patch })

  it('uses the screen reader whenever Companion mode is on, whatever else is set', () => {
    expect(chooseVoice(s({ screenReaderMode: 'companion', cloudVoice: 'all' }), { text: 'x' })).toBe('companion')
  })

  it('uses the local voice by default', () => {
    expect(chooseVoice(s({}), { text: 'x' })).toBe('local')
    expect(chooseVoice(s({}), { text: 'x', kind: 'reading' })).toBe('local')
  })

  it('uses the cloud voice only for reading when set to reading', () => {
    expect(chooseVoice(s({ cloudVoice: 'reading' }), { text: 'x', kind: 'reading' })).toBe('cloud')
    expect(chooseVoice(s({ cloudVoice: 'reading' }), { text: 'x' })).toBe('local')
  })

  it('uses the cloud voice for everything when set to all', () => {
    expect(chooseVoice(s({ cloudVoice: 'all' }), { text: 'x' })).toBe('cloud')
  })
})

describe('withVoiceSettings', () => {
  function recorded() {
    const speak = vi.fn(async (_utterance: unknown) => {})
    return { provider: { speak, cancel: vi.fn() } as SpeechProvider, speak }
  }

  it('adds the pitch, volume and chosen voice from the settings', async () => {
    const { provider, speak } = recorded()
    const wrapped = withVoiceSettings(provider, () => ({ pitch: 1.2, volume: 0.5, voiceName: 'Zira' }))
    await wrapped.speak({ text: 'Hi', rate: 2 })
    expect(speak).toHaveBeenCalledWith({ text: 'Hi', rate: 2, pitch: 1.2, volume: 0.5, voiceName: 'Zira' })
  })

  it('leaves out the voice name when the setting is empty, so the system default is used', async () => {
    const { provider, speak } = recorded()
    await withVoiceSettings(provider, () => ({ pitch: 1, volume: 1, voiceName: '' })).speak({ text: 'Hi' })
    expect(speak.mock.calls[0]![0]).not.toHaveProperty('voiceName')
  })

  it('does not override what the caller asked for', async () => {
    const { provider, speak } = recorded()
    await withVoiceSettings(provider, () => ({ pitch: 1.2, volume: 0.5, voiceName: 'Zira' })).speak({
      text: 'Hi',
      pitch: 0.8,
    })
    expect(speak.mock.calls[0]![0]).toMatchObject({ pitch: 0.8, volume: 0.5 })
  })

  it('passes cancel straight through', () => {
    const { provider } = recorded()
    withVoiceSettings(provider, () => ({ pitch: 1, volume: 1, voiceName: '' })).cancel()
    expect(provider.cancel).toHaveBeenCalledOnce()
  })
})
