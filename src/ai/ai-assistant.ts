import { AudioCache } from '../cloud/audio-cache'
import { CloudError, type CloudErrorKind, type GeminiClient, type GeminiPart } from '../cloud/gemini-client'
import type { Settings } from '../shared/settings'
import { ImageError } from './image-fetch'
import { imagePrompt, purposePrompt, summaryPrompt } from './prompts'

const PURPOSE_TOKENS = 80
const SUMMARY_TOKENS = 300
const IMAGE_TOKENS = 160
const MAX_ANSWER_CHARS = 500
const REMEMBERED_ANSWERS = 50

export type AiResult =
  | { readonly ok: true; readonly text: string }
  | {
      readonly ok: false
      readonly kind: CloudErrorKind | 'disabled' | 'cancelled' | 'image'
      readonly reason: string
    }

/**
 * Makes a model's answer safe and short to speak: no markdown marks, bullets
 * or links, whatever the page tried to get it to say, and cut at a sentence
 * end where there is one.
 */
export function cleanAnswer(text: string, max: number): string {
  const plain = text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '')
    .replace(/^\s*[-•*]\s+/gm, '')
    .replace(/[*_#`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= max) return plain
  const cut = plain.slice(0, max)
  const lastSentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  const endsAtLimit = /[.!?]$/.test(cut)
  if (endsAtLimit) return cut
  if (lastSentenceEnd > 0) return cut.slice(0, lastSentenceEnd + 1)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()
}

export interface AiAssistantDeps {
  client: Pick<GeminiClient, 'generate'>
  getSettings(): Promise<Pick<Settings, 'aiAssist' | 'aiModel'>>
  fetchImage(url: string): Promise<{ base64: string; mimeType: string }>
}

export interface PageInput {
  readonly title: string
  readonly headings: readonly string[]
  readonly excerpt: string
}

export interface ImageInput {
  readonly url: string
  readonly alt: string
  readonly pageTitle: string
  readonly context: string
}

const off: AiResult = { ok: false, kind: 'disabled', reason: 'AI features are off.' }

function failureFor(error: unknown): AiResult {
  if (error instanceof CloudError) return { ok: false, kind: error.kind, reason: error.spoken }
  if (error instanceof ImageError) return { ok: false, kind: 'image', reason: error.spoken }
  if ((error as { name?: string } | null)?.name === 'AbortError') {
    return { ok: false, kind: 'cancelled', reason: 'Cancelled.' }
  }
  const network = new CloudError('network') // anything unexpected: fixed words, never the detail
  return { ok: false, kind: network.kind, reason: network.spoken }
}

/**
 * Descriptions and summaries from the model. Runs in the background worker,
 * where the key is. Page text is always sent as fenced, untrusted data, and
 * every answer is cleaned before it is spoken.
 */
export class AiAssistant {
  readonly #deps: AiAssistantDeps
  readonly #answers = new AudioCache<string>(REMEMBERED_ANSWERS)

  constructor(deps: AiAssistantDeps) {
    this.#deps = deps
  }

  /** One sentence on what the page is for. */
  purpose(page: PageInput): Promise<AiResult> {
    const key = `purpose|${page.title}|${page.headings.join(';')}|${page.excerpt.slice(0, 200)}`
    return this.#answer(key, PURPOSE_TOKENS, async () => [
      { type: 'text', text: purposePrompt(page) },
    ])
  }

  summarize(page: PageInput): Promise<AiResult> {
    const key = `summary|${page.title}|${page.excerpt.slice(0, 200)}|${page.excerpt.length}`
    return this.#answer(key, SUMMARY_TOKENS, async () => [
      { type: 'text', text: summaryPrompt(page) },
    ])
  }

  describeImage(image: ImageInput): Promise<AiResult> {
    return this.#answer(`image|${image.url}`, IMAGE_TOKENS, async () => {
      const data = await this.#deps.fetchImage(image.url)
      return [
        { type: 'text', text: imagePrompt(image) },
        { type: 'image', data: data.base64, mimeType: data.mimeType },
      ]
    })
  }

  async #answer(
    key: string,
    maxOutputTokens: number,
    buildParts: () => Promise<GeminiPart[]>,
  ): Promise<AiResult> {
    const settings = await this.#deps.getSettings()
    if (!settings.aiAssist) return off
    const cacheKey = `${settings.aiModel}|${key}`
    const remembered = this.#answers.get(cacheKey)
    if (remembered !== undefined) return { ok: true, text: remembered }
    try {
      const parts = await buildParts()
      const raw = await this.#deps.client.generate({ model: settings.aiModel, parts, maxOutputTokens })
      const text = cleanAnswer(raw, MAX_ANSWER_CHARS)
      if (text === '') return failureFor(new CloudError('empty'))
      this.#answers.set(cacheKey, text)
      return { ok: true, text }
    } catch (error) {
      return failureFor(error)
    }
  }
}
