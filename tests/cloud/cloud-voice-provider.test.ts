import { describe, expect, it, vi } from 'vitest'
import {
  CloudVoiceProvider,
  PROBLEM_NOTICE_INTERVAL_MS,
  type CloudVoiceDeps,
} from '../../src/cloud/cloud-voice-provider'
import type { CloudSpeechResponse } from '../../src/cloud/messages'
import type { SpeechProvider } from '../../src/audio/speech-service'

const OK: CloudSpeechResponse = { ok: true, base64: 'QUJD', mimeType: 'audio/wav' }
const fail = (kind: 'bad-key' | 'server' | 'rate-limit' | 'cancelled'): CloudSpeechResponse => ({
  ok: false,
  kind,
  reason: `reason for ${kind}`,
})

function setup(options: { canPlay?: boolean; responses?: Array<CloudSpeechResponse | (() => Promise<CloudSpeechResponse>)> } = {}) {
  let clock = 0
  const played: Array<{ pan: number; rate: number; endNow: () => void; stop: ReturnType<typeof vi.fn> }> = []
  const queue = [...(options.responses ?? [])]
  const fallback: SpeechProvider = { speak: vi.fn(async () => {}), cancel: vi.fn() }
  const deps = {
    request: vi.fn(async (_req: { id: number; text: string }) => {
      const next = queue.shift() ?? OK
      return typeof next === 'function' ? next() : next
    }),
    cancelRequest: vi.fn(),
    decode: vi.fn(async (_b: string, _m: string) => ({}) as unknown),
    play: vi.fn((_audio: unknown, opts: { pan: number; rate: number }) => {
      let end: () => void = () => {}
      const ended = new Promise<void>((resolve) => {
        end = resolve
      })
      const stop = vi.fn(() => end())
      played.push({ ...opts, endNow: () => end(), stop })
      return { ended, stop }
    }),
    canPlay: () => options.canPlay ?? true,
    fallback,
    onProblem: vi.fn(),
    now: () => clock,
  } satisfies CloudVoiceDeps
  const provider = new CloudVoiceProvider(deps)
  const tick = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve()
  }
  return { provider, deps, fallback, played, tick, advance: (ms: number) => (clock += ms) }
}

describe('CloudVoiceProvider: playing', () => {
  it('requests the audio, plays it panned and at the right speed, and ends when it ends', async () => {
    const { provider, deps, played, tick } = setup()
    let done = false
    const speaking = provider.speak({ text: 'Hello there.', pan: -0.5, rate: 1.5 }).then(() => {
      done = true
    })
    await tick()
    expect(deps.request).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hello there.' }))
    expect(played[0]).toMatchObject({ pan: -0.5, rate: 1.5 })
    expect(done).toBe(false)
    played[0]!.endNow()
    await speaking
    expect(done).toBe(true)
  })

  it('plays centred at normal speed when nothing else is asked for', async () => {
    const { provider, played, tick } = setup()
    void provider.speak({ text: 'Hello.' })
    await tick()
    expect(played[0]).toMatchObject({ pan: 0, rate: 1 })
  })

  it('keeps the speed within what audio playback can do', async () => {
    const { provider, played, tick } = setup()
    void provider.speak({ text: 'Hello.', rate: 3 })
    await tick()
    expect(played[0]!.rate).toBeLessThanOrEqual(2)
  })

  it('says when the sound begins', async () => {
    const onStart = vi.fn()
    const { provider, tick } = setup()
    void provider.speak({ text: 'Hello.', onStart })
    await tick()
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('reads long text in order, asking for the next piece while the current one plays', async () => {
    const { provider, deps, played, tick } = setup()
    const text = `${'First sentence is here. '.repeat(40)}${'Second part follows. '.repeat(40)}`
    void provider.speak({ text })
    await tick()
    expect((deps.request as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(played).toHaveLength(1)
    played[0]!.endNow()
    await tick()
    expect(played).toHaveLength(2)
  })
})

describe('CloudVoiceProvider: falling back to the local voice', () => {
  it('uses the local voice, without asking Google, when the browser will not start sound', async () => {
    const { provider, deps, fallback } = setup({ canPlay: false })
    await provider.speak({ text: 'Hello.' })
    expect(fallback.speak).toHaveBeenCalledWith({ text: 'Hello.' })
    expect(deps.request).not.toHaveBeenCalled()
  })

  it('says why and speaks the text locally when Google fails', async () => {
    const { provider, deps, fallback } = setup({ responses: [fail('server')] })
    await provider.speak({ text: 'Hello there.' })
    expect(deps.onProblem).toHaveBeenCalledWith('reason for server')
    expect(fallback.speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hello there.' }))
  })

  it('speaks only the part not yet spoken when a later piece fails', async () => {
    const text = `${'First sentence is here. '.repeat(60)}${'Second part follows. '.repeat(60)}`
    const { provider, fallback, played, tick } = setup({ responses: [OK, fail('server')] })
    const speaking = provider.speak({ text })
    await tick()
    played[0]!.endNow()
    await speaking
    const spokenLocally = (fallback.speak as ReturnType<typeof vi.fn>).mock.calls[0]![0].text as string
    expect(spokenLocally.length).toBeGreaterThan(0)
    expect(spokenLocally.length).toBeLessThan(text.length)
    expect(text.trim().endsWith(spokenLocally.slice(-30))).toBe(true)
  })

  it('treats a request that failed to decode as a failure too', async () => {
    const { provider, deps, fallback } = setup()
    ;(deps.decode as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('bad audio'))
    await provider.speak({ text: 'Hello.' })
    expect(fallback.speak).toHaveBeenCalled()
    expect(deps.onProblem).toHaveBeenCalled()
  })

  it('stops asking Google after a rejected key, until told the settings changed', async () => {
    const { provider, deps, fallback, tick } = setup({ responses: [fail('bad-key')] })
    await provider.speak({ text: 'One.' })
    ;(deps.request as ReturnType<typeof vi.fn>).mockClear()
    await provider.speak({ text: 'Two.' })
    expect(deps.request).not.toHaveBeenCalled()
    expect(fallback.speak).toHaveBeenLastCalledWith({ text: 'Two.' })
    provider.reset()
    void provider.speak({ text: 'Three.' })
    await tick()
    expect(deps.request).toHaveBeenCalled()
  })

  it('keeps trying after a passing problem such as a busy service', async () => {
    const { provider, deps, tick } = setup({ responses: [fail('server')] })
    await provider.speak({ text: 'One.' })
    ;(deps.request as ReturnType<typeof vi.fn>).mockClear()
    void provider.speak({ text: 'Two.' })
    await tick()
    expect(deps.request).toHaveBeenCalled()
  })

  it('does not nag: the same kind of problem is spoken at most once a minute', async () => {
    const { provider, deps, advance } = setup({ responses: [fail('server'), fail('server'), fail('server')] })
    await provider.speak({ text: 'One.' })
    await provider.speak({ text: 'Two.' })
    expect(deps.onProblem).toHaveBeenCalledTimes(1)
    advance(PROBLEM_NOTICE_INTERVAL_MS + 1)
    await provider.speak({ text: 'Three.' })
    expect(deps.onProblem).toHaveBeenCalledTimes(2)
  })

  it('treats a cancelled request as no problem at all', async () => {
    const { provider, deps } = setup({ responses: [fail('cancelled')] })
    void provider.speak({ text: 'Hello.' })
    await Promise.resolve()
    expect(deps.onProblem).not.toHaveBeenCalled()
  })
})

describe('CloudVoiceProvider: waiting for the browser to allow sound', () => {
  it('waits for the answer when the browser needs a moment to start audio', async () => {
    let allow: (ok: boolean) => void = () => {}
    const { provider, deps, fallback, tick } = setup()
    ;(deps as { canPlay: () => boolean | Promise<boolean> }).canPlay = () =>
      new Promise<boolean>((resolve) => (allow = resolve))
    void provider.speak({ text: 'Hello.' })
    await tick()
    expect(deps.request).not.toHaveBeenCalled()
    expect(fallback.speak).not.toHaveBeenCalled()
    allow(true)
    await tick()
    expect(deps.request).toHaveBeenCalled()
  })

  it('uses the local voice if the browser then says no', async () => {
    const { provider, deps, fallback } = setup()
    ;(deps as { canPlay: () => boolean | Promise<boolean> }).canPlay = async () => false
    await provider.speak({ text: 'Hello.' })
    expect(fallback.speak).toHaveBeenCalledWith({ text: 'Hello.' })
    expect(deps.request).not.toHaveBeenCalled()
  })

  it('plays and asks for nothing if it was cancelled while waiting', async () => {
    let allow: (ok: boolean) => void = () => {}
    const { provider, deps, played, tick } = setup()
    ;(deps as { canPlay: () => boolean | Promise<boolean> }).canPlay = () =>
      new Promise<boolean>((resolve) => (allow = resolve))
    const speaking = provider.speak({ text: 'Hello.' })
    await tick()
    provider.cancel()
    allow(true)
    await speaking
    await tick()
    expect(deps.request).not.toHaveBeenCalled()
    expect(played).toHaveLength(0)
  })
})

describe('CloudVoiceProvider: cancelling', () => {
  it('stops the sound, cancels the request, and settles the speech', async () => {
    const { provider, deps, played, tick } = setup()
    const speaking = provider.speak({ text: 'Hello there.' })
    await tick()
    provider.cancel()
    expect(played[0]!.stop).toHaveBeenCalledOnce()
    expect(deps.cancelRequest).toHaveBeenCalled()
    await speaking
  })

  it('plays nothing that arrives after it was cancelled', async () => {
    let arrive: (r: CloudSpeechResponse) => void = () => {}
    const { provider, played, tick } = setup({
      responses: [() => new Promise<CloudSpeechResponse>((resolve) => (arrive = resolve))],
    })
    const speaking = provider.speak({ text: 'Hello there.' })
    await tick()
    provider.cancel()
    arrive(OK)
    await speaking
    await tick()
    expect(played).toHaveLength(0)
  })

  it('also cancels the local voice if that is what was speaking', async () => {
    const { provider, fallback, tick } = setup({ canPlay: false })
    ;(fallback.speak as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}))
    void provider.speak({ text: 'Hello.' })
    await tick() // the local voice is now speaking
    provider.cancel()
    expect(fallback.cancel).toHaveBeenCalled()
  })

  it('is harmless when nothing is speaking', () => {
    expect(() => setup().provider.cancel()).not.toThrow()
  })
})
