import { describe, expect, it, vi } from 'vitest'
import type { OffscreenRequest } from '../../src/voice/messages'
import { VoiceRelay, type VoiceRelayDeps } from '../../src/voice/voice-relay'

/** A promise and its resolve, for holding a step open. */
function gate<T = void>() {
  let open!: (value: T) => void
  const promise = new Promise<T>((resolve) => {
    open = resolve
  })
  return { promise, open }
}

function setup(overrides: Partial<VoiceRelayDeps> = {}) {
  const sent: OffscreenRequest[] = []
  const answers = new Map<number, (answer: unknown) => void>()
  const deps: VoiceRelayDeps = {
    engine: vi.fn(async () => 'chrome' as const),
    ensureOffscreen: vi.fn(async () => {}),
    closeOffscreen: vi.fn(),
    toOffscreen: vi.fn((request: OffscreenRequest) => {
      sent.push(request)
      if (request.type !== 'recognize') return Promise.resolve(undefined)
      return new Promise((resolve) => answers.set(request.id, resolve))
    }),
    transcribe: vi.fn(async () => ({ ok: true as const, text: 'scroll down' })),
    firstId: 100,
    ...overrides,
  }
  const relay = new VoiceRelay(deps)
  const answer = (value: unknown): void => answers.get(sent.find((r) => r.type === 'recognize')!.id)!(value)
  return { relay, deps, sent, answer }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('VoiceRelay.start', () => {
  it('refuses while voice commands are off, whatever the page asks', async () => {
    const { relay, deps } = setup({ engine: vi.fn(async () => 'off' as const) })
    expect(await relay.start('tab:0:1', 5000)).toEqual({ ok: false, error: 'voice-off' })
    expect(deps.ensureOffscreen).not.toHaveBeenCalled()
  })

  it('asks the offscreen document to listen, with an id of its own, and passes the answer back', async () => {
    const { relay, sent, answer } = setup()
    const result = relay.start('tab:0:1', 5000)
    await flush()
    expect(sent).toEqual([{ target: 'offscreen', type: 'recognize', id: 100, maxMs: 5000, engine: 'chrome' }])
    answer({ ok: true, text: 'click' })
    expect(await result).toEqual({ ok: true, text: 'click' })
  })

  it('has a Gemini recording transcribed, and silence is not sent', async () => {
    const { relay, deps, answer } = setup({ engine: vi.fn(async () => 'gemini' as const) })
    const spoken = relay.start('tab:0:1', 5000)
    await flush()
    answer({ ok: true, audio: 'UklGRg==' })
    expect(await spoken).toMatchObject({ ok: true, text: 'scroll down', mode: 'gemini' })
    expect(deps.transcribe).toHaveBeenCalledWith('UklGRg==')

    const silent = setup({ engine: vi.fn(async () => 'gemini' as const) })
    const nothing = silent.relay.start('tab:0:2', 5000)
    await flush()
    silent.answer({ ok: true, audio: null })
    expect(await nothing).toEqual({ ok: true, text: null })
    expect(silent.deps.transcribe).not.toHaveBeenCalled()
  })
})

describe('VoiceRelay: a stop or cancel that comes early', () => {
  it('is not lost while the offscreen document is still being created', async () => {
    const ready = gate()
    const { relay, sent } = setup({ ensureOffscreen: vi.fn(() => ready.promise) })
    void relay.start('tab:0:1', 15000)
    relay.control('tab:0:1', 'stop')
    ready.open()
    await flush()
    expect(sent.map((r) => r.type)).toEqual(['recognize', 'recognize-stop'])
  })

  it('never opens the microphone at all when cancelled before it was asked to', async () => {
    const ready = gate()
    const { relay, sent } = setup({ ensureOffscreen: vi.fn(() => ready.promise) })
    const result = relay.start('tab:0:1', 15000)
    relay.control('tab:0:1', 'cancel')
    ready.open()
    expect(await result).toEqual({ ok: true, text: null })
    expect(sent).toEqual([])
  })

  it('never sends a cancelled Gemini recording to Google', async () => {
    const { relay, deps, answer } = setup({ engine: vi.fn(async () => 'gemini' as const) })
    const result = relay.start('tab:0:1', 15000)
    await flush()
    relay.control('tab:0:1', 'cancel')
    answer({ ok: true, audio: 'UklGRg==' })
    expect(await result).toEqual({ ok: true, text: null })
    expect(deps.transcribe).not.toHaveBeenCalled()
  })
})

describe('VoiceRelay: ids and the offscreen document', () => {
  it('gives every request its own id, so a late answer cannot clear a newer request', async () => {
    const { relay, sent, answer } = setup()
    const first = relay.start('tab:0:1', 5000)
    await flush()
    answer({ ok: true, text: null })
    await first
    void relay.start('tab:0:1', 5000)
    await flush()
    relay.control('tab:0:1', 'stop')
    const ids = sent.filter((r) => r.type === 'recognize').map((r) => r.id)
    expect(ids).toEqual([100, 101])
    expect(sent.at(-1)).toEqual({ target: 'offscreen', type: 'recognize-stop', id: 101 })
  })

  it('closes the offscreen document only once no tab explores and nothing is being listened to', async () => {
    const { relay, deps, answer } = setup()
    relay.noteExploreState(1, true)
    const listening = relay.start('tab:1:1', 5000)
    await flush()
    relay.noteExploreState(1, false)
    expect(deps.closeOffscreen).not.toHaveBeenCalled()
    answer({ ok: true, text: null })
    await listening
    expect(deps.closeOffscreen).toHaveBeenCalledOnce()
  })

  it('keeps it open while another tab explores', () => {
    const { relay, deps } = setup()
    relay.noteExploreState(1, true)
    relay.noteExploreState(2, true)
    relay.noteExploreState(1, false)
    expect(deps.closeOffscreen).not.toHaveBeenCalled()
  })
})

describe('VoiceRelay: saying where speech goes', () => {
  /** Answers the most recent recognize request. */
  function answerLatest(sent: OffscreenRequest[], _deps: VoiceRelayDeps, value: unknown): void {
    const latest = sent.filter((r) => r.type === 'recognize').at(-1)!
    latestAnswer.get(latest.id)!(value)
  }
  const latestAnswer = new Map<number, (value: unknown) => void>()

  function relayWithAnswers(engine: 'chrome' | 'gemini') {
    const sent: OffscreenRequest[] = []
    const deps: VoiceRelayDeps = {
      engine: vi.fn(async () => engine),
      ensureOffscreen: vi.fn(async () => {}),
      closeOffscreen: vi.fn(),
      toOffscreen: vi.fn((request: OffscreenRequest) => {
        sent.push(request)
        if (request.type !== 'recognize') return Promise.resolve(undefined)
        return new Promise((resolve) => latestAnswer.set(request.id, resolve))
      }),
      transcribe: vi.fn(async () => ({ ok: true as const, text: 'scroll down' })),
      firstId: 1,
    }
    return { relay: new VoiceRelay(deps), sent, deps }
  }

  it("says once, with the first answer, that Google's online service turned speech into text", async () => {
    const { relay, sent, deps } = relayWithAnswers('chrome')
    const first = relay.start('tab:0:1', 5000)
    await flush()
    answerLatest(sent, deps, { ok: true, text: 'click', mode: 'online' })
    expect(await first).toEqual({
      ok: true,
      text: 'click',
      mode: 'online',
      notice: "Speech is turned into text by Google's online service.",
    })
    const second = relay.start('tab:0:2', 5000)
    await flush()
    answerLatest(sent, deps, { ok: true, text: 'stop', mode: 'online' })
    expect(await second).toEqual({ ok: true, text: 'stop', mode: 'online' })
  })

  it('says so when speech stays on this computer', async () => {
    const { relay, sent, deps } = relayWithAnswers('chrome')
    const result = relay.start('tab:0:1', 5000)
    await flush()
    answerLatest(sent, deps, { ok: true, text: 'click', mode: 'on-device' })
    expect((await result) as { notice?: string }).toMatchObject({ notice: 'Speech is turned into text on this computer.' })
  })

  it('says that a recording went to Gemini, once', async () => {
    const { relay, sent, deps } = relayWithAnswers('gemini')
    const result = relay.start('tab:0:1', 5000)
    await flush()
    answerLatest(sent, deps, { ok: true, audio: 'UklGRg==' })
    expect((await result) as { notice?: string }).toMatchObject({
      notice: 'What you said was sent to Google Gemini, with your key, to be turned into text.',
    })
  })
})
