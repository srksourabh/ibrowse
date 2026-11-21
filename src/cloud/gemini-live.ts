import { CloudError } from './cloud-error'
import type { GeminiClient, SynthesizeRequest } from './gemini-client'

const LIVE_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'
export const DEFAULT_LIVE_MODEL = 'models/gemini-3.8-live'
export const LIVE_PCM_SAMPLE_RATE = 24_000
const CONNECT_TIMEOUT_MS = 3_000
const TURN_TIMEOUT_MS = 15_000
export const LIVE_COOLDOWN_MS = 30_000

const LIVE_SYSTEM_INSTRUCTION =
  'Read the text provided by the user aloud verbatim in a clear, natural, subtle Indian English accent. ' +
  'Speak promptly at a steady pace. Do not add commentary, greetings, or extra words.'

export interface WebSocketLike {
  readonly readyState: number
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: ((event: unknown) => void) | null
  onclose: (() => void) | null
  send(data: string): void
  close(): void
}

export interface GeminiLiveDeps {
  getKey(): Promise<string | null>
  createSocket?: (url: string) => WebSocketLike
  model?: string
  wsUrl?: string
}

type Json = Record<string, unknown>
const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null
const isAbort = (error: unknown): boolean => (error as { name?: string } | null)?.name === 'AbortError'

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

/** Wraps raw 16-bit mono little-endian PCM bytes in a standard RIFF/WAV header for Web Audio decoding. */
export function pcm16ToWavBase64(pcmChunks: readonly Uint8Array[], sampleRate = LIVE_PCM_SAMPLE_RATE): string {
  const dataLength = pcmChunks.reduce((sum, c) => sum + c.length, 0)
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)
  const out = new Uint8Array(buffer)
  const writeStr = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate (16-bit mono)
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, dataLength, true)

  let offset = 44
  for (const chunk of pcmChunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return encodeBase64(out)
}

async function parseMessage(data: unknown): Promise<Json | null> {
  try {
    if (typeof data === 'string') return JSON.parse(data) as Json
    if (data instanceof Blob) return JSON.parse(await data.text()) as Json
    if (data instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(data)) as Json
  } catch {
    return null
  }
  return null
}

function extractPcmParts(msg: Json): Uint8Array[] {
  const sc = msg.serverContent
  if (!isRecord(sc)) return []
  const turn = sc.modelTurn
  if (!isRecord(turn) || !Array.isArray(turn.parts)) return []
  const out: Uint8Array[] = []
  for (const part of turn.parts) {
    if (!isRecord(part) || !isRecord(part.inlineData)) continue
    const data = part.inlineData.data
    if (typeof data === 'string' && data.length > 0) out.push(decodeBase64(data))
  }
  return out
}

/**
 * Persistent Gemini Live API (BidiGenerateContent WebSocket) client for low-latency
 * native audio synthesis in the background worker.
 */
export class GeminiLiveClient implements Pick<GeminiClient, 'synthesize'> {
  readonly #deps: GeminiLiveDeps
  #socket: WebSocketLike | null = null
  #ready: Promise<WebSocketLike> | null = null
  #voice = ''
  #queue: Promise<void> = Promise.resolve()

  constructor(deps: GeminiLiveDeps) {
    this.#deps = deps
  }

  async synthesize(request: SynthesizeRequest): Promise<{ base64: string; mimeType: string }> {
    if (request.text.trim() === '') throw new CloudError('bad-request')
    if (request.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    // Serialize turns over the persistent WebSocket so audio chunks never interleave.
    let result!: { base64: string; mimeType: string }
    const run = this.#queue.then(async () => {
      result = await this.#runTurn(request)
    })
    this.#queue = run.catch(() => {})
    await run
    return result
  }

  /** Pre-opens the Live WebSocket so the first sentence speaks without handshake delay. */
  warmup(voice: string): void {
    void this.#connect(voice).catch(() => {})
  }

  close(): void {
    const ws = this.#socket
    this.#socket = null
    this.#ready = null
    try {
      ws?.close()
    } catch {
      // ignore close errors
    }
  }

  async #connect(voice: string): Promise<WebSocketLike> {
    if (this.#socket && this.#socket.readyState === 1 && this.#voice === voice && this.#ready) {
      return this.#ready
    }
    this.close()
    const key = await this.#deps.getKey()
    if (!key) throw new CloudError('no-key')

    const url = `${this.#deps.wsUrl ?? LIVE_WS_URL}?key=${encodeURIComponent(key)}`
    const factory = this.#deps.createSocket ?? ((u: string) => new WebSocket(u) as unknown as WebSocketLike)
    const ws = factory(url)
    this.#socket = ws
    this.#voice = voice

    const ready = new Promise<WebSocketLike>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.close()
        reject(new CloudError('network'))
      }, CONNECT_TIMEOUT_MS)

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            setup: {
              model: this.#deps.model ?? DEFAULT_LIVE_MODEL,
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
                },
              },
              systemInstruction: { parts: [{ text: LIVE_SYSTEM_INSTRUCTION }] },
            },
          }),
        )
      }

      ws.onmessage = (event) => {
        void parseMessage(event.data).then((msg) => {
          if (msg && 'setupComplete' in msg) {
            clearTimeout(timer)
            resolve(ws)
          }
        })
      }

      ws.onerror = () => {
        clearTimeout(timer)
        this.close()
        reject(new CloudError('network'))
      }

      ws.onclose = () => {
        clearTimeout(timer)
        if (this.#socket === ws) {
          this.#socket = null
          this.#ready = null
        }
        reject(new CloudError('network'))
      }
    })

    this.#ready = ready
    return ready
  }

  async #runTurn(request: SynthesizeRequest): Promise<{ base64: string; mimeType: string }> {
    const ws = await this.#connect(request.voice)
    if (request.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    return new Promise((resolve, reject) => {
      const pcmChunks: Uint8Array[] = []
      let settled = false
      const finish = (err?: unknown): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        request.signal?.removeEventListener('abort', onAbort)
        if (err) reject(err)
        else if (pcmChunks.length === 0) reject(new CloudError('empty'))
        else resolve({ base64: pcm16ToWavBase64(pcmChunks), mimeType: 'audio/wav' })
      }

      const onAbort = (): void => {
        // Close socket on abort so remaining audio from this turn doesn't spill into the next one.
        this.close()
        finish(new DOMException('Aborted', 'AbortError'))
      }
      request.signal?.addEventListener('abort', onAbort, { once: true })

      const timer = setTimeout(() => {
        this.close()
        finish(new CloudError('network'))
      }, TURN_TIMEOUT_MS)

      ws.onmessage = (event) => {
        void parseMessage(event.data).then((msg) => {
          if (!msg || settled) return
          pcmChunks.push(...extractPcmParts(msg))
          const sc = msg.serverContent
          if (isRecord(sc) && (sc.turnComplete === true || sc.generationComplete === true)) {
            finish()
          }
        })
      }

      ws.onerror = () => {
        this.close()
        finish(new CloudError('network'))
      }

      ws.onclose = () => {
        if (this.#socket === ws) {
          this.#socket = null
          this.#ready = null
        }
        finish(new CloudError('network'))
      }

      ws.send(
        JSON.stringify({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text: request.text }] }],
            turnComplete: true,
          },
        }),
      )
    })
  }
}

/**
 * Tries the persistent Gemini Live WebSocket first for low-latency native audio;
 * falls back to REST Gemini TTS on any non-abort error and pauses Live retries
 * briefly so subsequent sentences do not stall on a broken socket.
 */
export function withLiveVoiceFallback(
  live: Pick<GeminiClient, 'synthesize'>,
  rest: Pick<GeminiClient, 'synthesize'>,
  now: () => number = Date.now,
): Pick<GeminiClient, 'synthesize'> {
  let retryLiveAt = 0
  return {
    async synthesize(request: SynthesizeRequest) {
      if (now() < retryLiveAt) return rest.synthesize(request)
      try {
        return await live.synthesize(request)
      } catch (error) {
        if (isAbort(error)) throw error
        retryLiveAt = now() + LIVE_COOLDOWN_MS
        return rest.synthesize(request)
      }
    },
  }
}
