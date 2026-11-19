import { CloudError } from './cloud-error'
import type { GeminiClient, GeminiPart, GenerateRequest } from './gemini-client'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
export const DEFAULT_CLAUDE_MODEL = 'claude-haiku-4-5-20251001'

export interface ClaudeClientDeps {
  fetch: typeof fetch
  getKey(): Promise<string | null>
  model?: string
  baseUrl?: string
}

type Json = Record<string, unknown>

const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null
const isAbort = (error: unknown): boolean => (error as { name?: string } | null)?.name === 'AbortError'

function toAnthropicPart(part: GeminiPart): Json | null {
  if (part.type === 'text') return { type: 'text', text: part.text }
  if (part.type === 'image') {
    return {
      type: 'image',
      source: { type: 'base64', media_type: part.mimeType, data: part.data },
    }
  }
  return null
}

function errorFor(status: number): CloudError {
  if (status === 401 || status === 403) return new CloudError('bad-key')
  if (status === 404) return new CloudError('bad-model')
  if (status === 429) return new CloudError('rate-limit')
  if (status >= 500) return new CloudError('server')
  return new CloudError('bad-request')
}

function textFrom(body: unknown): string {
  if (!isRecord(body) || !Array.isArray(body.content)) return ''
  const pieces: string[] = []
  for (const block of body.content) {
    if (isRecord(block) && block.type === 'text' && typeof block.text === 'string') {
      pieces.push(block.text)
    }
  }
  return pieces.join(' ').trim()
}

/**
 * Anthropic Claude fallback client for text and image AI requests (page purpose,
 * summaries, image descriptions, and spoken questions). Runs only in the background worker.
 */
export class ClaudeClient implements Pick<GeminiClient, 'generate'> {
  readonly #deps: ClaudeClientDeps

  constructor(deps: ClaudeClientDeps) {
    this.#deps = deps
  }

  async generate(request: GenerateRequest): Promise<string> {
    const key = await this.#deps.getKey()
    if (!key) throw new CloudError('no-key')

    const content = request.parts.map(toAnthropicPart).filter((p): p is Json => p !== null)
    if (content.length === 0) throw new CloudError('bad-request')

    let response: Response
    try {
      response = await this.#deps.fetch(this.#deps.baseUrl ?? ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.#deps.model ?? DEFAULT_CLAUDE_MODEL,
          max_tokens: request.maxOutputTokens,
          messages: [{ role: 'user', content }],
        }),
        ...(request.signal ? { signal: request.signal } : {}),
      })
    } catch (error) {
      if (isAbort(error)) throw error
      throw new CloudError('network')
    }

    if (!response.ok) throw errorFor(response.status)
    const body = await response.json().catch(() => {
      throw new CloudError('empty')
    })
    const text = textFrom(body)
    if (text === '') throw new CloudError('empty')
    return text
  }
}

/**
 * Tries the primary client (Gemini) first; if it fails for any non-abort reason,
 * falls back to Claude when an Anthropic key is configured.
 */
export function withClaudeFallback(
  primary: Pick<GeminiClient, 'generate'>,
  fallback: Pick<GeminiClient, 'generate'>,
  hasFallbackKey: () => Promise<boolean>,
): Pick<GeminiClient, 'generate'> {
  return {
    async generate(request: GenerateRequest): Promise<string> {
      try {
        return await primary.generate(request)
      } catch (primaryError) {
        if (isAbort(primaryError)) throw primaryError
        if (!(await hasFallbackKey())) throw primaryError
        return fallback.generate(request)
      }
    },
  }
}
