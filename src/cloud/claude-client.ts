import { CloudError } from './cloud-error'
import type { GeminiClient, GeminiPart, GenerateRequest } from './gemini-client'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models?limit=1'
const ANTHROPIC_VERSION = '2023-06-01'
export const DEFAULT_CLAUDE_MODEL = 'claude-haiku-5-5'
/** If primary (Gemini) takes longer than this and Claude is configured, start Claude in parallel. */
export const SLOW_FALLBACK_MS = 4_000

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

  /** Lists one model with the key. Costs nothing, so it is how an Anthropic key is tested. */
  async checkKey(candidateKey?: string): Promise<void> {
    const key = candidateKey !== undefined && candidateKey.trim() !== '' ? candidateKey.trim() : await this.#deps.getKey()
    if (!key) throw new CloudError('no-key')
    let response: Response
    try {
      response = await this.#deps.fetch(ANTHROPIC_MODELS_URL, {
        method: 'GET',
        headers: {
          'x-api-key': key,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      })
    } catch (error) {
      if (isAbort(error)) throw error
      throw new CloudError('network')
    }
    if (!response.ok) throw errorFor(response.status)
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
 * Tries the primary client (Gemini) first. If it fails for any non-abort reason,
 * OR takes longer than `slowFallbackMs` while an Anthropic key is configured,
 * automatically falls back to Claude Haiku 5.5 for faster processing and reliability.
 */
export function withClaudeFallback(
  primary: Pick<GeminiClient, 'generate'>,
  fallback: Pick<GeminiClient, 'generate'>,
  hasFallbackKey: () => Promise<boolean>,
  slowFallbackMs = SLOW_FALLBACK_MS,
): Pick<GeminiClient, 'generate'> {
  return {
    async generate(request: GenerateRequest): Promise<string> {
      const primaryPromise = primary.generate(request)
      if (!(await hasFallbackKey())) return primaryPromise

      let timer: ReturnType<typeof setTimeout> | undefined
      const slow = new Promise<'slow'>((resolve) => {
        timer = setTimeout(() => resolve('slow'), slowFallbackMs)
      })
      try {
        const winner = await Promise.race([
          primaryPromise.then((text) => ({ ok: true as const, text })).catch((err: unknown) => ({ ok: false as const, err })),
          slow,
        ])
        clearTimeout(timer)
        if (winner === 'slow') {
          return await Promise.any([primaryPromise, fallback.generate(request)]).catch((agg: AggregateError) => {
            throw agg.errors[0]
          })
        }
        if (winner.ok) return winner.text
        if (isAbort(winner.err)) throw winner.err
        return await fallback.generate(request)
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
