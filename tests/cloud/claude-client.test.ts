import { describe, expect, it, vi } from 'vitest'
import { ClaudeClient, DEFAULT_CLAUDE_MODEL, withClaudeFallback } from '../../src/cloud/claude-client'
import { CloudError } from '../../src/cloud/cloud-error'

const KEY = 'sk-ant-api03-TESTKEY1234567890abcdef'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('ClaudeClient.generate', () => {
  it('sends text and image parts to Anthropic messages API with the key in headers only', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ content: [{ type: 'text', text: 'A sunset over hills.' }] }),
    )
    const client = new ClaudeClient({ fetch: fetchFn as unknown as typeof fetch, getKey: async () => KEY })

    const answer = await client.generate({
      model: 'gemini-3.8-flash',
      parts: [
        { type: 'text', text: 'Describe this.' },
        { type: 'image', data: 'QUJD', mimeType: 'image/jpeg' },
      ],
      maxOutputTokens: 160,
    })

    expect(answer).toBe('A sunset over hills.')
    const [url, init] = fetchFn.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect((init.headers as Record<string, string>)['x-api-key']).toBe(KEY)
    expect((init.headers as Record<string, string>)['anthropic-dangerous-direct-browser-access']).toBe('true')
    const body = JSON.parse(String(init.body))
    expect(body).toEqual({
      model: DEFAULT_CLAUDE_MODEL,
      max_tokens: 160,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this.' },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } },
          ],
        },
      ],
    })
  })

  it('throws CloudError(no-key) without fetching when no Anthropic key is configured', async () => {
    const fetchFn = vi.fn()
    const client = new ClaudeClient({ fetch: fetchFn as unknown as typeof fetch, getKey: async () => null })
    await expect(
      client.generate({ model: 'm', parts: [{ type: 'text', text: 'hi' }], maxOutputTokens: 50 }),
    ).rejects.toMatchObject({ kind: 'no-key' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('maps HTTP errors to CloudError without leaking the key', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: { message: `bad ${KEY}` } }, 429))
    const client = new ClaudeClient({ fetch: fetchFn as unknown as typeof fetch, getKey: async () => KEY })
    const err = await client
      .generate({ model: 'm', parts: [{ type: 'text', text: 'hi' }], maxOutputTokens: 50 })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CloudError)
    expect((err as CloudError).kind).toBe('rate-limit')
    expect(JSON.stringify(err)).not.toContain(KEY)
  })
})

describe('withClaudeFallback', () => {
  const req = { model: 'gemini-3.8-flash', parts: [{ type: 'text' as const, text: 'hi' }], maxOutputTokens: 50 }

  it('uses primary when it succeeds', async () => {
    const primary = { generate: vi.fn(async () => 'from gemini') }
    const fallback = { generate: vi.fn(async () => 'from claude') }
    const client = withClaudeFallback(primary, fallback, async () => true)
    expect(await client.generate(req)).toBe('from gemini')
    expect(fallback.generate).not.toHaveBeenCalled()
  })

  it('falls back to Claude when Gemini fails and an Anthropic key is present', async () => {
    const primary = { generate: vi.fn(async () => { throw new CloudError('rate-limit') }) }
    const fallback = { generate: vi.fn(async () => 'from claude') }
    const client = withClaudeFallback(primary, fallback, async () => true)
    expect(await client.generate(req)).toBe('from claude')
    expect(fallback.generate).toHaveBeenCalledOnce()
  })

  it('rethrows Gemini error when no Anthropic key is present', async () => {
    const primary = { generate: vi.fn(async () => { throw new CloudError('no-key') }) }
    const fallback = { generate: vi.fn(async () => 'from claude') }
    const client = withClaudeFallback(primary, fallback, async () => false)
    await expect(client.generate(req)).rejects.toMatchObject({ kind: 'no-key' })
    expect(fallback.generate).not.toHaveBeenCalled()
  })

  it('never falls back on AbortError', async () => {
    const primary = { generate: vi.fn(async () => { throw new DOMException('aborted', 'AbortError') }) }
    const fallback = { generate: vi.fn(async () => 'from claude') }
    const client = withClaudeFallback(primary, fallback, async () => true)
    await expect(client.generate(req)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fallback.generate).not.toHaveBeenCalled()
  })
})
