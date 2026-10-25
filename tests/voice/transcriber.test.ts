import { describe, expect, it, vi } from 'vitest'
import { CloudError, type GenerateRequest } from '../../src/cloud/gemini-client'
import { transcribe } from '../../src/voice/transcriber'

function client(answer: string | Error) {
  return {
    generate: vi.fn(async (_request: GenerateRequest) => {
      if (answer instanceof Error) throw answer
      return answer
    }),
  }
}

describe('transcribe', () => {
  it('asks Gemini for exactly the words spoken, sending the recording as WAV audio', async () => {
    const gemini = client('Scroll down, please')
    expect(await transcribe(gemini, 'gemini-3.8-flash', 'UklGRg==')).toEqual({ ok: true, text: 'Scroll down, please' })
    const request = gemini.generate.mock.calls[0]![0]
    expect(request.model).toBe('gemini-3.8-flash')
    expect(request.parts).toEqual([
      { type: 'text', text: expect.stringMatching(/only those words/i) },
      { type: 'audio', data: 'UklGRg==', mimeType: 'audio/wav' },
    ])
  })

  it('takes an empty reply as silence', async () => {
    expect(await transcribe(client(new CloudError('empty')), 'm', 'UklGRg==')).toEqual({ ok: true, text: null })
  })

  it('passes on what went wrong, by kind, never the detail', async () => {
    expect(await transcribe(client(new CloudError('no-key')), 'm', 'UklGRg==')).toEqual({ ok: false, error: 'no-key' })
    expect(await transcribe(client(new Error('boom')), 'm', 'UklGRg==')).toEqual({ ok: false, error: 'network' })
  })
})

describe('transcribe: a request that hangs', () => {
  it('gives up after a time limit and reports a network problem', async () => {
    const hanging = {
      generate: vi.fn(
        (request: GenerateRequest) =>
          new Promise<string>((_, reject) =>
            request.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))),
          ),
      ),
    }
    expect(await transcribe(hanging, 'm', 'UklGRg==', 20)).toEqual({ ok: false, error: 'network' })
    expect(hanging.generate.mock.calls[0]![0].signal).toBeInstanceOf(AbortSignal)
  })
})
