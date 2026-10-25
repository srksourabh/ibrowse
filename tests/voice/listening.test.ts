import { describe, expect, it, vi } from 'vitest'
import {
  ANSWER_WINDOW_MS,
  HOLD_MAX_MS,
  ListeningController,
  type Listening,
  type SpeechRecognizer,
} from '../../src/voice/listening'

function fakeRecognizer() {
  const sessions: Array<{ maxMs: number; resolve: (t: string | null) => void; reject: (e: Error) => void; stop: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> }> = []
  const recognizer: SpeechRecognizer = {
    listen: vi.fn(({ maxMs }): Listening => {
      let resolve!: (t: string | null) => void
      let reject!: (e: Error) => void
      const result = new Promise<string | null>((res, rej) => {
        resolve = res
        reject = rej
      })
      const session = { maxMs, resolve, reject, stop: vi.fn(), cancel: vi.fn(() => resolve(null)) }
      sessions.push(session)
      return { result, stop: session.stop, cancel: session.cancel }
    }),
  }
  return { recognizer, sessions }
}

function setup() {
  const { recognizer, sessions } = fakeRecognizer()
  const deps = {
    recognizer,
    speech: { cancel: vi.fn() },
    earcons: { play: vi.fn() },
    onHeard: vi.fn(),
    onError: vi.fn(),
  }
  return { controller: new ListeningController(deps), deps, sessions }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('ListeningController: listening for an answer', () => {
  it('listens for a short window, with a sound at the start and at the end', async () => {
    const { controller, deps, sessions } = setup()
    controller.listenForAnswer()
    expect(controller.isListening).toBe(true)
    expect(sessions[0]!.maxMs).toBe(ANSWER_WINDOW_MS)
    expect(deps.earcons.play).toHaveBeenCalledWith('listen', 0)

    sessions[0]!.resolve('click')
    await flush()
    expect(deps.earcons.play).toHaveBeenLastCalledWith('listen-end', 0)
    expect(deps.onHeard).toHaveBeenCalledWith('click')
    expect(controller.isListening).toBe(false)
  })

  it('does not interrupt speech: it is only asked to listen once the question has been spoken', () => {
    const { controller, deps } = setup()
    controller.listenForAnswer()
    expect(deps.speech.cancel).not.toHaveBeenCalled()
  })

  it('reports nothing when the user said nothing', async () => {
    const { controller, deps, sessions } = setup()
    controller.listenForAnswer()
    sessions[0]!.resolve(null)
    await flush()
    sessions[0]!.resolve('   ')
    await flush()
    expect(deps.onHeard).not.toHaveBeenCalled()
  })

  it('listens to one request at a time', () => {
    const { controller, deps } = setup()
    controller.listenForAnswer()
    controller.listenForAnswer()
    expect(deps.recognizer.listen).toHaveBeenCalledTimes(1)
  })

  it('can be cancelled, for example when the pointer moves on, without acting on a late result', async () => {
    const { controller, deps, sessions } = setup()
    controller.listenForAnswer()
    controller.cancel()
    expect(sessions[0]!.cancel).toHaveBeenCalled()
    expect(controller.isListening).toBe(false)
    expect(deps.earcons.play).toHaveBeenLastCalledWith('listen-end', 0)
    sessions[0]!.resolve('click')
    await flush()
    expect(deps.onHeard).not.toHaveBeenCalled()
    expect(deps.earcons.play).toHaveBeenCalledTimes(2)
  })

  it('reports a recogniser failure once and stops listening', async () => {
    const { controller, deps, sessions } = setup()
    controller.listenForAnswer()
    sessions[0]!.reject(new Error('not-allowed'))
    await flush()
    expect(deps.onError).toHaveBeenCalledWith(new Error('not-allowed'))
    expect(controller.isListening).toBe(false)
  })
})

describe('ListeningController: push to talk', () => {
  it('silences iBrowse first, so it cannot hear itself, then listens until the key is released', async () => {
    const { controller, deps, sessions } = setup()
    controller.startHold()
    expect(deps.speech.cancel).toHaveBeenCalled()
    expect(sessions[0]!.maxMs).toBe(HOLD_MAX_MS)
    controller.endHold()
    expect(sessions[0]!.stop).toHaveBeenCalled()
    sessions[0]!.resolve('scroll down')
    await flush()
    expect(deps.onHeard).toHaveBeenCalledWith('scroll down')
  })

  it('takes over from a window opened for an answer', () => {
    const { controller, deps, sessions } = setup()
    controller.listenForAnswer()
    controller.startHold()
    expect(sessions[0]!.cancel).toHaveBeenCalled()
    expect(deps.recognizer.listen).toHaveBeenCalledTimes(2)
    expect(sessions[1]!.maxMs).toBe(HOLD_MAX_MS)
  })

  it('ignores a key repeat while already held, and a release with nothing held', () => {
    const { controller, deps } = setup()
    controller.endHold()
    controller.startHold()
    controller.startHold()
    expect(deps.recognizer.listen).toHaveBeenCalledTimes(1)
  })
})

describe('ListeningController.cancelAnswer', () => {
  it('closes a window opened for an answer', () => {
    const { controller, sessions } = setup()
    controller.listenForAnswer()
    controller.cancelAnswer()
    expect(sessions[0]!.cancel).toHaveBeenCalled()
    expect(controller.isListening).toBe(false)
  })

  it('never cuts off push to talk', () => {
    const { controller, sessions } = setup()
    controller.startHold()
    controller.cancelAnswer()
    expect(sessions[0]!.cancel).not.toHaveBeenCalled()
    expect(controller.isListening).toBe(true)
  })
})
