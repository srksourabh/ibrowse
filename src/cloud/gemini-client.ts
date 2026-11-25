import { CloudError, type CloudErrorKind } from './cloud-error'

export { CloudError, type CloudErrorKind } from './cloud-error'

const BASE_URL = 'https://generativelanguage.googleapis.com'
const DEFAULT_AUDIO_TYPE = 'audio/wav'
const DEFAULT_VOICE_STYLE = 'clear, natural, subtle Indian English accent'

export interface GeminiClientDeps {
  fetch: typeof fetch
  getKey(): Promise<string | null>
  baseUrl?: string
}

export type GeminiPart =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'image' | 'audio'; readonly data: string; readonly mimeType: string }

export interface SynthesizeRequest {
  readonly text: string
  readonly voice: string
  readonly model: string
  readonly signal?: AbortSignal
}

export interface GenerateRequest {
  readonly model: string
  readonly parts: readonly GeminiPart[]
  readonly maxOutputTokens: number
  readonly signal?: AbortSignal
}

type Json = Record<string, unknown>

const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null

const isAbort = (error: unknown): boolean => (error as { name?: string } | null)?.name === 'AbortError'

async function errorFor(response: Response): Promise<CloudError> {
  const { status } = response
  let message = ''
  let statusStr = ''
  let reason = ''

  try {
    const body: unknown = await response.json()
    if (isRecord(body) && isRecord(body.error)) {
      message = String(body.error.message ?? '')
      statusStr = String(body.error.status ?? '')
      if (Array.isArray(body.error.details)) {
        for (const detail of body.error.details) {
          if (isRecord(detail) && typeof detail.reason === 'string') {
            reason = detail.reason
            break
          }
        }
      }
    }
  } catch {
    // Non-JSON response body
  }

  const msgLower = message.toLowerCase()

  // 1. API not enabled / Service disabled in Google Cloud
  if (
    reason === 'SERVICE_DISABLED' ||
    reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' ||
    msgLower.includes('has not been used') ||
    msgLower.includes('is disabled') ||
    msgLower.includes('api not enabled')
  ) {
    return new CloudError('api-disabled')
  }

  // 2. Key restrictions or auth block (HTTP referrer, IP address blocked, not authorized)
  if (
    reason === 'API_KEY_HTTP_REFERRER_BLOCKED' ||
    reason === 'API_KEY_IP_ADDRESS_BLOCKED' ||
    reason === 'IP_REFERRER_BLOCKED' ||
    msgLower.includes('requests from this referrer are blocked') ||
    (msgLower.includes('requests to this api') && msgLower.includes('blocked')) ||
    msgLower.includes('not authorized')
  ) {
    return new CloudError('auth-failed')
  }

  // 3. Billing disabled or quota exceeded
  if (reason === 'BILLING_DISABLED' || msgLower.includes('billing')) {
    return new CloudError('quota-exceeded')
  }

  // 4. Invalid API key (400 or 401 or explicit reason)
  if (
    reason === 'API_KEY_INVALID' ||
    status === 401 ||
    /api key.*(?:not valid|invalid)/i.test(message) ||
    /invalid api key/i.test(message)
  ) {
    return new CloudError('bad-key')
  }

  // 5. 403 Forbidden
  if (status === 403) {
    if (statusStr === 'PERMISSION_DENIED' && reason !== '') {
      return new CloudError('auth-failed')
    }
    return new CloudError('bad-key')
  }

  // 6. 404 Model Not Found
  if (status === 404) return new CloudError('bad-model')

  // 7. 429 Rate limit / Quota exceeded
  if (status === 429) {
    if (statusStr === 'RESOURCE_EXHAUSTED' || msgLower.includes('quota')) {
      return new CloudError('quota-exceeded')
    }
    return new CloudError('rate-limit')
  }

  // 8. 5xx Server error
  if (status >= 500) return new CloudError('server')

  // 9. 400 Bad Request
  if (status === 400) {
    if (/api key/i.test(message)) return new CloudError('bad-key')
    return new CloudError('bad-request')
  }

  return new CloudError('bad-request')
}

function audioFrom(body: unknown): { base64: string; mimeType: string } | null {
  if (!isRecord(body)) return null
  const direct = body.output_audio
  if (isRecord(direct) && typeof direct.data === 'string') {
    return { base64: direct.data, mimeType: String(direct.mime_type ?? DEFAULT_AUDIO_TYPE) }
  }
  for (const step of Array.isArray(body.steps) ? body.steps : []) {
    for (const item of isRecord(step) && Array.isArray(step.content) ? step.content : []) {
      if (isRecord(item) && item.type === 'audio' && typeof item.data === 'string') {
        return { base64: item.data, mimeType: String(item.mime_type ?? DEFAULT_AUDIO_TYPE) }
      }
    }
  }
  return null
}

function textFrom(body: unknown): string {
  if (!isRecord(body)) return ''
  if (typeof body.output_text === 'string' && body.output_text.trim() !== '') return body.output_text.trim()
  const pieces: string[] = []
  for (const step of Array.isArray(body.steps) ? body.steps : []) {
    if (!isRecord(step) || step.type !== 'model_output' || !Array.isArray(step.content)) continue
    for (const item of step.content) {
      if (isRecord(item) && item.type === 'text' && typeof item.text === 'string') pieces.push(item.text)
    }
  }
  return pieces.join(' ').trim()
}

const toWirePart = (part: GeminiPart): Json =>
  part.type === 'text'
    ? { type: 'text', text: part.text }
    : { type: part.type, data: part.data, mime_type: part.mimeType }

/**
 * The only code that talks to Google's Gemini API. The key goes in a header,
 * never in an address or a body, and no error carries it.
 */
export class GeminiClient {
  readonly #deps: GeminiClientDeps

  constructor(deps: GeminiClientDeps) {
    this.#deps = deps
  }

  /** Lists models with the key. It costs nothing, so it is how a key is tested. */
  async checkKey(candidateKey?: string): Promise<void> {
    await this.#request('/v1beta/models?pageSize=1', { method: 'GET' }, candidateKey)
  }

  async synthesize(request: SynthesizeRequest): Promise<{ base64: string; mimeType: string }> {
    if (request.text.trim() === '') throw new CloudError('bad-request')
    const body = await this.#request('/v1beta/interactions', {
      method: 'POST',
      signal: request.signal,
      body: {
        model: request.model,
        input: [
          {
            type: 'user_input',
            content: [
              {
                type: 'text',
                text: request.text,
                annotations: [{ type: 'speech_metadata', style: DEFAULT_VOICE_STYLE }],
              },
            ],
          },
        ],
        response_format: { type: 'audio', mime_type: DEFAULT_AUDIO_TYPE },
        generation_config: { speech_config: [{ voice: request.voice }] },
      },
    })
    const audio = audioFrom(body)
    if (!audio) throw new CloudError('empty')
    return audio
  }

  async generate(request: GenerateRequest): Promise<string> {
    const body = await this.#request('/v1beta/interactions', {
      method: 'POST',
      signal: request.signal,
      body: {
        model: request.model,
        input: request.parts.map(toWirePart),
        generation_config: {
          max_output_tokens: request.maxOutputTokens,
          thinking_level: 'low',
        },
      },
    })
    const text = textFrom(body)
    if (text === '') throw new CloudError('empty')
    return text
  }

  async #request(
    path: string,
    init: { method: 'GET' | 'POST'; body?: Json; signal?: AbortSignal | undefined },
    overrideKey?: string,
  ): Promise<unknown> {
    const key = overrideKey !== undefined && overrideKey.trim() !== '' ? overrideKey.trim() : await this.#deps.getKey()
    if (!key) throw new CloudError('no-key')

    let response: Response
    try {
      response = await this.#deps.fetch(`${this.#deps.baseUrl ?? BASE_URL}${path}`, {
        method: init.method,
        headers: {
          'x-goog-api-key': key,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(init.body ? { body: JSON.stringify(init.body) } : {}),
        ...(init.signal ? { signal: init.signal } : {}),
      })
    } catch (error) {
      if (isAbort(error)) throw error
      throw new CloudError('network')
    }
    if (!response.ok) throw await errorFor(response)
    return response.json().catch(() => {
      throw new CloudError('empty')
    })
  }
}
