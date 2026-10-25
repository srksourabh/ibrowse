import { describe, expect, it, vi } from 'vitest'
import { MessageRecognizer } from '../../src/voice/message-recognizer'
import type { ListenRequest, ListenResponse } from '../../src/voice/messages'

function setup(answer: ListenResponse = { ok: true, text: 'scroll down' }) {
  const send = vi.fn(async (_request: ListenRequest): Promise<ListenResponse> => answer)
  return { recognizer: new MessageRecognizer(send), send }
}

describe('MessageRecognizer', () => {
  it('asks the background worker to listen, and gives back what was heard', async () => {
    const { recognizer, send } = setup()
    const listening = recognizer.listen({ maxMs: 5000 })
    await expect(listening.result).resolves.toBe('scroll down')
    expect(send).toHaveBeenCalledWith({ type: 'listen-start', id: 1, maxMs: 5000 })
  })

  it('numbers each request, and stops or cancels the right one', () => {
    const { recognizer, send } = setup()
    recognizer.listen({ maxMs: 5000 })
    const second = recognizer.listen({ maxMs: 15000 })
    second.stop()
    second.cancel()
    expect(send).toHaveBeenCalledWith({ type: 'listen-stop', id: 2 })
    expect(send).toHaveBeenCalledWith({ type: 'listen-cancel', id: 2 })
  })

  it('fails with the recogniser error', async () => {
    const { recognizer } = setup({ ok: false, error: 'not-allowed' })
    await expect(recognizer.listen({ maxMs: 5000 }).result).rejects.toThrow('not-allowed')
  })

  it('fails plainly if the worker cannot be reached', async () => {
    const send = vi.fn(async () => {
      throw new Error('Could not establish connection')
    })
    await expect(new MessageRecognizer(send).listen({ maxMs: 5000 }).result).rejects.toThrow(
      'Could not establish connection',
    )
  })
})
