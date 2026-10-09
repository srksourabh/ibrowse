import { describe, expect, it, vi } from 'vitest'
import { CloudError, GeminiClient } from '../../src/cloud/gemini-client'

const KEY = 'AIzaSECRETKEY1234567890abcdef'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function setup(respond: (url: string, init: RequestInit) => Response | Promise<Response>, key: string | null = KEY) {
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
    respond(String(url), init ?? {}),
  )
  const client = new GeminiClient({ fetch: fetchFn as unknown as typeof fetch, getKey: async () => key })
  const lastRequest = () => {
    const [url, init] = fetchFn.mock.calls.at(-1)!
    return { url: String(url), init: init as RequestInit, body: JSON.parse(String(init?.body ?? 'null')) }
  }
  return { client, fetchFn, lastRequest }
}

const caught = async (promise: Promise<unknown>): Promise<CloudError> => {
  try {
    await promise
  } catch (error) {
    if (error instanceof CloudError) return error
    throw error
  }
  throw new Error('expected a CloudError')
}

describe('GeminiClient.synthesize', () => {
  const audio = { output_audio: { data: 'QUJD', mime_type: 'audio/wav' } }

  it('asks the interactions endpoint for audio in the chosen voice and model', async () => {
    const { client, lastRequest } = setup(() => jsonResponse(audio))
    await client.synthesize({ text: 'Hello', voice: 'Kore', model: 'gemini-3.8-flash-lite-tts' })
    const { url, init, body } = lastRequest()
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions')
    expect(init.method).toBe('POST')
    expect(body).toEqual({
      model: 'gemini-3.8-flash-lite-tts',
      input: [{ type: 'user_input', content: [{ type: 'text', text: 'Hello' }] }],
      response_format: { type: 'audio', mime_type: 'audio/wav' },
      generation_config: { speech_config: [{ voice: 'Kore' }] },
    })
  })

  it('sends the key in a header, never in the address or the body', async () => {
    const { client, lastRequest } = setup(() => jsonResponse(audio))
    await client.synthesize({ text: 'Hello', voice: 'Kore', model: 'm' })
    const { url, init, body } = lastRequest()
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY)
    expect(url).not.toContain(KEY)
    expect(JSON.stringify(body)).not.toContain(KEY)
  })

  it('returns the base64 audio and its type', async () => {
    const { client } = setup(() => jsonResponse(audio))
    expect(await client.synthesize({ text: 'Hello', voice: 'Kore', model: 'm' })).toEqual({
      base64: 'QUJD',
      mimeType: 'audio/wav',
    })
  })

  it('assumes WAV when the response does not say, since that is what was asked for', async () => {
    const { client } = setup(() => jsonResponse({ output_audio: { data: 'QUJD' } }))
    expect((await client.synthesize({ text: 'x', voice: 'Kore', model: 'm' })).mimeType).toBe('audio/wav')
  })

  it('also finds audio inside the steps of a response', async () => {
    const steps = {
      steps: [{ type: 'model_output', content: [{ type: 'audio', data: 'REVG', mime_type: 'audio/wav' }] }],
    }
    const { client } = setup(() => jsonResponse(steps))
    expect((await client.synthesize({ text: 'x', voice: 'Kore', model: 'm' })).base64).toBe('REVG')
  })

  it('treats a response with no audio as an error', async () => {
    const { client } = setup(() => jsonResponse({ steps: [] }))
    const error = await caught(client.synthesize({ text: 'x', voice: 'Kore', model: 'm' }))
    expect(error.kind).toBe('empty')
  })

  it('refuses to send empty text', async () => {
    const { client, fetchFn } = setup(() => jsonResponse(audio))
    const error = await caught(client.synthesize({ text: '   ', voice: 'Kore', model: 'm' }))
    expect(error.kind).toBe('bad-request')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('lets a caller cancel the request', async () => {
    const { client, lastRequest } = setup(() => jsonResponse(audio))
    const controller = new AbortController()
    await client.synthesize({ text: 'Hello', voice: 'Kore', model: 'm', signal: controller.signal })
    expect(lastRequest().init.signal).toBe(controller.signal)
  })
})

describe('GeminiClient.generate', () => {
  it('sends text and images as input items, with a cap on the answer length', async () => {
    const { client, lastRequest } = setup(() => jsonResponse({ output_text: 'A red kite.' }))
    const text = await client.generate({
      model: 'gemini-3.8-flash',
      parts: [
        { type: 'text', text: 'Describe this.' },
        { type: 'image', data: 'QUJD', mimeType: 'image/jpeg' },
      ],
      maxOutputTokens: 120,
    })
    expect(text).toBe('A red kite.')
    expect(lastRequest().body).toEqual({
      model: 'gemini-3.8-flash',
      input: [
        { type: 'text', text: 'Describe this.' },
        { type: 'image', data: 'QUJD', mime_type: 'image/jpeg' },
      ],
      generation_config: { max_output_tokens: 120 },
    })
  })

  it('reads the answer from the steps when there is no output_text', async () => {
    const steps = {
      steps: [
        { type: 'user_input', content: [{ type: 'text', text: 'question' }] },
        { type: 'model_output', content: [{ type: 'text', text: 'First.' }, { type: 'text', text: 'Second.' }] },
      ],
    }
    const { client } = setup(() => jsonResponse(steps))
    expect(await client.generate({ model: 'm', parts: [{ type: 'text', text: 'q' }], maxOutputTokens: 50 })).toBe(
      'First. Second.',
    )
  })

  it('treats an empty answer as an error', async () => {
    const { client } = setup(() => jsonResponse({ output_text: '  ' }))
    const error = await caught(client.generate({ model: 'm', parts: [{ type: 'text', text: 'q' }], maxOutputTokens: 5 }))
    expect(error.kind).toBe('empty')
  })

  it('sends the key in a header here too', async () => {
    const { client, lastRequest } = setup(() => jsonResponse({ output_text: 'ok' }))
    await client.generate({ model: 'm', parts: [{ type: 'text', text: 'q' }], maxOutputTokens: 5 })
    expect((lastRequest().init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY)
    expect(lastRequest().url).not.toContain(KEY)
  })
})

describe('GeminiClient.checkKey', () => {
  it('lists models with the key, which costs nothing', async () => {
    const { client, lastRequest } = setup(() => jsonResponse({ models: [] }))
    await client.checkKey()
    const { url, init } = lastRequest()
    expect(url).toMatch(/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\?/)
    expect(init.method ?? 'GET').toBe('GET')
    expect(url).not.toContain(KEY)
  })

  it('reports a rejected key', async () => {
    const { client } = setup(() => jsonResponse({ error: { code: 400, message: 'API key not valid.' } }, 400))
    expect((await caught(client.checkKey())).kind).toBe('bad-key')
  })
})

describe('GeminiClient errors', () => {
  const generate = (client: GeminiClient) =>
    client.generate({ model: 'm', parts: [{ type: 'text', text: 'q' }], maxOutputTokens: 5 })

  it.each([
    [401, 'bad-key', /did not accept the key/i],
    [403, 'bad-key', /did not accept the key/i],
    [404, 'bad-model', /model/i],
    [429, 'rate-limit', /limit/i],
    [500, 'server', /trouble/i],
    [503, 'server', /trouble/i],
  ])('turns HTTP %i into a %s error with a sentence to say', async (status, kind, sentence) => {
    const { client } = setup(() => jsonResponse({ error: { message: 'x' } }, status))
    const error = await caught(generate(client))
    expect(error.kind).toBe(kind)
    expect(error.spoken).toMatch(sentence)
  })

  it('tells a bad request from a bad key by what Google says', async () => {
    const { client } = setup(() => jsonResponse({ error: { message: 'Invalid value at input' } }, 400))
    expect((await caught(generate(client))).kind).toBe('bad-request')
  })

  it('says so when the network cannot be reached', async () => {
    const { client } = setup(() => {
      throw new TypeError('Failed to fetch')
    })
    const error = await caught(generate(client))
    expect(error.kind).toBe('network')
    expect(error.spoken).toMatch(/reach Google/i)
  })

  it('says so when there is no key, without making a request', async () => {
    const { client, fetchFn } = setup(() => jsonResponse({}), null)
    const error = await caught(generate(client))
    expect(error.kind).toBe('no-key')
    expect(error.spoken).toMatch(/no google key/i)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('passes a cancellation through as it is, not as a failure to report', async () => {
    const { client } = setup(() => {
      throw new DOMException('aborted', 'AbortError')
    })
    await expect(generate(client)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('never lets the key into an error message, a spoken sentence or a log line', async () => {
    const { client } = setup(() => jsonResponse({ error: { message: `bad key ${KEY}` } }, 401))
    const error = await caught(generate(client))
    expect(error.message).not.toContain(KEY)
    expect(error.spoken).not.toContain(KEY)
    expect(JSON.stringify(error)).not.toContain(KEY)
  })

  it('copes with an error body that is not JSON', async () => {
    const { client } = setup(() => new Response('<html>Bad gateway</html>', { status: 502 }))
    expect((await caught(generate(client))).kind).toBe('server')
  })
})
