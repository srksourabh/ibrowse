import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeechOutcome } from '../../src/audio/speech-service'
import { ASK_QUESTION, AskAfterRest, REST_MS } from '../../src/voice/ask-after-rest'

function setup(options: { on?: boolean; questionOutcome?: SpeechOutcome; busyAfter?: boolean } = {}) {
  const button = document.createElement('button')
  let current: Element | null = button
  const deps = {
    isOn: () => options.on ?? true,
    current: () => current,
    speech: { speak: vi.fn(async () => options.questionOutcome ?? ('finished' as const)), isBusy: options.busyAfter ?? false },
    listening: { listenForAnswer: vi.fn(), cancelAnswer: vi.fn() },
    getRate: () => 1,
  }
  const ask = new AskAfterRest(deps)
  const moveTo = (el: Element | null): void => {
    current = el
    ask.moved(el)
  }
  return { ask, deps, button, moveTo }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('AskAfterRest', () => {
  it('asks what to do once the pointer has rested a further second after the description, then listens', async () => {
    const { ask, deps, button } = setup()
    ask.described(button, Promise.resolve('finished'))
    await vi.advanceTimersByTimeAsync(REST_MS - 1)
    expect(deps.speech.speak).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(deps.speech.speak).toHaveBeenCalledWith({ text: ASK_QUESTION, rate: 1 }, { interrupt: false })
    expect(deps.listening.listenForAnswer).toHaveBeenCalledOnce()
  })

  it('does not ask when the description was cut off', async () => {
    const { ask, deps, button } = setup()
    ask.described(button, Promise.resolve('cancelled'))
    await vi.advanceTimersByTimeAsync(REST_MS)
    expect(deps.speech.speak).not.toHaveBeenCalled()
  })

  it('does not ask once the pointer has moved on', async () => {
    const { ask, deps, button, moveTo } = setup()
    ask.described(button, Promise.resolve('finished'))
    await vi.advanceTimersByTimeAsync(REST_MS / 2)
    moveTo(null)
    await vi.advanceTimersByTimeAsync(REST_MS)
    expect(deps.speech.speak).not.toHaveBeenCalled()
  })

  it('does not listen if the question itself was cut off', async () => {
    const { ask, deps, button } = setup({ questionOutcome: 'cancelled' })
    ask.described(button, Promise.resolve('finished'))
    await vi.advanceTimersByTimeAsync(REST_MS)
    expect(deps.listening.listenForAnswer).not.toHaveBeenCalled()
  })

  it('does not listen while something else is still being said, so it never hears itself', async () => {
    const { ask, deps, button } = setup({ busyAfter: true })
    ask.described(button, Promise.resolve('finished'))
    await vi.advanceTimersByTimeAsync(REST_MS)
    expect(deps.speech.speak).toHaveBeenCalled()
    expect(deps.listening.listenForAnswer).not.toHaveBeenCalled()
  })

  it('closes the answer window when the pointer moves to something else', () => {
    const { ask, deps, moveTo } = setup()
    moveTo(document.createElement('p'))
    expect(deps.listening.cancelAnswer).toHaveBeenCalled()
    void ask
  })

  it('does nothing while voice commands are off', async () => {
    const { ask, deps, button } = setup({ on: false })
    ask.described(button, Promise.resolve('finished'))
    await vi.advanceTimersByTimeAsync(REST_MS)
    expect(deps.speech.speak).not.toHaveBeenCalled()
  })

  it('can be stopped, for example when Explore Mode turns off', async () => {
    const { ask, deps, button } = setup()
    ask.described(button, Promise.resolve('finished'))
    ask.stop()
    await vi.advanceTimersByTimeAsync(REST_MS)
    expect(deps.speech.speak).not.toHaveBeenCalled()
  })
})
