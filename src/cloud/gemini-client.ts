import { CloudError, type CloudErrorKind } from './cloud-error'

export { CloudError, type CloudErrorKind } from './cloud-error'

const BASE_URL = 'https://generativelanguage.googleapis.com'
const DEFAULT_AUDIO_TYPE = 'audio/wav'

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
  if (status === 401 || status === 403) return new CloudError('bad-key')
  if (status === 404) return new CloudError('bad-model')
  if (status === 429) return new CloudError('rate-limit')
  if (status >= 500) return new CloudError('server')
  if (status === 400) {
    // Google answers a bad key with 400, so what it says decides. The words are only read, never repeated.
    const message = await response
      .json()
      .then((body: unknown) => (isRecord(body) && isRecord(body.error) ? String(body.error.message ?? '') : ''))
      .catch(() => '')
    return new CloudError(/api key/i.test(message) ? 'bad-key' : 'bad-request')
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
  async checkKey(): Promise<void> {
    await this.#request('/v1beta/models?pageSize=1', { method: 'GET' })
  }

  async synthesize(request: SynthesizeRequest): Promise<{ base64: string; mimeType: string }> {
    if (request.text.trim() === '') throw new CloudError('bad-request')
    const body = await this.#request('/v1beta/interactions', {
      method: 'POST',
      signal: request.signal,
      body: {
        model: request.model,
        input: [{ type: 'user_input', content: [{ type: 'text', text: request.text }] }],
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
        generation_config: { max_output_tokens: request.maxOutputTokens },
      },
    })
    const text = textFrom(body)
    if (text === '') throw new CloudError('empty')
    return text
  }

  async #request(
    path: string,
    init: { method: 'GET' | 'POST'; body?: Json; signal?: AbortSignal | undefined },
  ): Promise<unknown> {
    const key = await this.#deps.getKey()
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
