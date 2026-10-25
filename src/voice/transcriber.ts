import { CloudError, type GeminiClient } from '../cloud/gemini-client'
import type { ListenResponse } from './messages'

const PROMPT =
  'Transcribe exactly what the person in this audio says, in the language they speak. ' +
  'Reply with only those words. If nobody speaks, reply with nothing.'
const MAX_WORDS_TOKENS = 100

/**
 * Gemini as a speech recogniser (ADR-0017 #1). Runs in the background worker,
 * where the key is. The audio is one request, recorded while iBrowse listened.
 */
export async function transcribe(
  client: Pick<GeminiClient, 'generate'>,
  model: string,
  wavBase64: string,
): Promise<ListenResponse> {
  try {
    const text = await client.generate({
      model,
      parts: [
        { type: 'text', text: PROMPT },
        { type: 'audio', data: wavBase64, mimeType: 'audio/wav' },
      ],
      maxOutputTokens: MAX_WORDS_TOKENS,
    })
    return { ok: true, text: text.trim() || null }
  } catch (error) {
    if (error instanceof CloudError && error.kind === 'empty') return { ok: true, text: null }
    return { ok: false, error: error instanceof CloudError ? error.kind : 'network' }
  }
}
