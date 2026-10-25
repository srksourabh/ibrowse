import { describe, expect, it, vi } from 'vitest'
import { SpeechService, type SpeechProvider } from '../../src/audio/speech-service'

function controllableProvider() {
  const pending: Array<{ text: string; resolve: () => void; reject: (e: Error) => void }> = []
  const provider: SpeechProvider = {
    speak: vi.fn(
      (u) => new Promise<void>((resolve, reject) => pending.push({ text: u.text, resolve, reject })),
    ),
    cancel: vi.fn(),
  }
  return { provider, pending }
}

describe('SpeechService', () => {
  it('remembers the last thing it was asked to say, so it can be repeated', () => {
    const { provider } = controllableProvider()
    const service = new SpeechService(provider)
    expect(service.lastText).toBeNull()
    void service.speak({ text: 'Save — Button' })
    void service.speak({ text: 'End of page' }, { interrupt: false })
    expect(service.lastText).toBe('End of page')
  })

  it('speaks an utterance and reports it finished', async () => {
    const { provider, pending } = controllableProvider()
    const outcome = new SpeechService(provider).speak({ text: 'Hello' })
    pending[0]!.resolve()
    await expect(outcome).resolves.toBe('finished')
  })

  it('cancels the active utterance when an interrupting one arrives', async () => {
    const { provider, pending } = controllableProvider()
    const service = new SpeechService(provider)
    const first = service.speak({ text: 'first' })
    const second = service.speak({ text: 'second' })
    expect(provider.cancel).toHaveBeenCalledOnce()
    await expect(first).resolves.toBe('cancelled')
    expect(pending.map((p) => p.text)).toEqual(['first', 'second'])
    pending[1]!.resolve()
    await expect(second).resolves.toBe('finished')
  })

  it('queues non-interrupting utterances in order', async () => {
    const { provider, pending } = controllableProvider()
    const service = new SpeechService(provider)
    const a = service.speak({ text: 'a' }, { interrupt: false })
    const b = service.speak({ text: 'b' }, { interrupt: false })
    expect(provider.speak).toHaveBeenCalledTimes(1)
    pending[0]!.resolve()
    await a
    expect(provider.speak).toHaveBeenCalledTimes(2)
    pending[1]!.resolve()
    await expect(b).resolves.toBe('finished')
  })

  it('cancel drops the active utterance and the whole queue', async () => {
    const { provider } = controllableProvider()
    const service = new SpeechService(provider)
    const a = service.speak({ text: 'a' }, { interrupt: false })
    const b = service.speak({ text: 'b' }, { interrupt: false })
    service.cancel()
    await expect(a).resolves.toBe('cancelled')
    await expect(b).resolves.toBe('cancelled')
    expect(provider.speak).toHaveBeenCalledTimes(1)
  })

  it('does not touch the provider when cancelled while idle', () => {
    const { provider } = controllableProvider()
    new SpeechService(provider).cancel()
    expect(provider.cancel).not.toHaveBeenCalled()
  })

  it('reports provider failures to onError and moves on to the next utterance', async () => {
    const { provider, pending } = controllableProvider()
    const onError = vi.fn()
    const service = new SpeechService(provider, { onError })
    const a = service.speak({ text: 'a' }, { interrupt: false })
    const b = service.speak({ text: 'b' }, { interrupt: false })
    pending[0]!.reject(new Error('voice unavailable'))
    await expect(a).resolves.toBe('failed')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'voice unavailable' }))
    pending[1]!.resolve()
    await expect(b).resolves.toBe('finished')
  })

  it('ignores a late completion from a cancelled utterance', async () => {
    const { provider, pending } = controllableProvider()
    const service = new SpeechService(provider)
    const first = service.speak({ text: 'first' })
    const second = service.speak({ text: 'second' })
    pending[0]!.resolve()
    await first
    expect(provider.speak).toHaveBeenCalledTimes(2)
    pending[1]!.resolve()
    await expect(second).resolves.toBe('finished')
  })
})
