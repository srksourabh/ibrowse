// @vitest-environment node
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTokenService } from '../../server/token-service.mjs'
import { DeviceAuth } from '../../src/cloud/device-auth'
import { GeminiLiveClient, withLiveVoiceFallback, type WebSocketLike } from '../../src/cloud/gemini-live'
import { parseSettings } from '../../src/shared/settings'

function memoryStore() {
  const data: Record<string, unknown> = {}
  return {
    data,
    get: async (key: string) => ({ [key]: data[key] }),
    set: async (items: Record<string, unknown>) => void Object.assign(data, items),
  }
}

function startHttpServer(service: ReturnType<typeof createTokenService>) {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    void service.handle(req, res, url.pathname).then((handled) => {
      if (!handled) {
        res.writeHead(404)
        res.end()
      }
    })
  })
  return new Promise<{ baseUrl: string; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      })
    })
  })
}

class FakeLiveSocket implements WebSocketLike {
  readyState = 1
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onclose: (() => void) | null = null
  sent: string[] = []
  open(): void {
    this.onopen?.()
    this.onmessage?.({ data: JSON.stringify({ setupComplete: {} }) })
  }
  send(data: string): void {
    this.sent.push(data)
    if (data.includes('clientContent')) {
      this.onmessage?.({
        data: JSON.stringify({
          serverContent: {
            modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm', data: btoa('ABCD') } }] },
            turnComplete: true,
          },
        }),
      })
    }
  }
  close(): void {
    this.readyState = 3
  }
}

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!()
})

describe('End-to-end Gemini Live ephemeral auth flow (Extension -> Token Backend -> Live WS)', () => {
  it('registers device, mints ephemeral token via backend, and connects Live WS without permanent key', async () => {
    const googleFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          name: 'auth_tokens/live_e2e_token_987',
          expireTime: new Date(Date.now() + 600_000).toISOString(),
        }),
        { status: 200 },
      ),
    )
    const service = createTokenService({
      apiKey: 'PERMANENT_SERVER_API_KEY_NEVER_IN_EXT',
      signingSecret: 'integration-test-secret',
      fetch: googleFetch as unknown as typeof fetch,
    })
    const srv = await startHttpServer(service)
    cleanups.push(srv.close)

    const store = memoryStore()
    const deviceAuth = new DeviceAuth({ store })
    const wsUrls: string[] = []
    const sockets: FakeLiveSocket[] = []
    const liveClient = new GeminiLiveClient({
      getEphemeralToken: () => deviceAuth.fetchLiveToken(srv.baseUrl),
      createSocket: (url) => {
        wsUrls.push(url)
        const s = new FakeLiveSocket()
        sockets.push(s)
        queueMicrotask(() => s.open())
        return s
      },
    })

    const restClient = { synthesize: vi.fn(async () => ({ base64: 'REST', mimeType: 'audio/wav' })) }
    const voice = withLiveVoiceFallback(liveClient, restClient)

    const audio = await voice.synthesize({ text: 'Hello from iBrowse.', voice: 'Kore', model: 'm' })
    expect(audio.mimeType).toBe('audio/wav')
    expect(restClient.synthesize).not.toHaveBeenCalled()
    expect(wsUrls).toHaveLength(1)
    expect(wsUrls[0]).toContain('BidiGenerateContentConstrained')
    expect(wsUrls[0]).toContain('access_token=auth_tokens%2Flive_e2e_token_987')
    expect(wsUrls[0]).not.toContain('PERMANENT_SERVER_API_KEY_NEVER_IN_EXT')
    expect(wsUrls[0]).not.toMatch(/[?&]key=/)
    const setupMsg = JSON.parse(sockets[0]!.sent[0]!) as { setup: { model: string } }
    expect(setupMsg.setup.model).toBe('models/gemini-2.5-flash-native-audio-preview-12-2025')
    // Ephemeral Live token must NOT be persisted in storage
    expect(JSON.stringify(store.data)).not.toContain('live_e2e_token_987')
  })

  it('falls back cleanly to REST TTS when token backend is disabled/unavailable', async () => {
    const service = createTokenService({ apiKey: '', fetch: vi.fn() as unknown as typeof fetch })
    const srv = await startHttpServer(service)
    cleanups.push(srv.close)

    const deviceAuth = new DeviceAuth({ store: memoryStore() })
    const liveClient = new GeminiLiveClient({
      getEphemeralToken: () => deviceAuth.fetchLiveToken(srv.baseUrl),
      createSocket: () => new FakeLiveSocket(),
    })
    const restClient = { synthesize: vi.fn(async () => ({ base64: 'REST_AUDIO', mimeType: 'audio/wav' })) }
    const voice = withLiveVoiceFallback(liveClient, restClient)

    const audio = await voice.synthesize({ text: 'Fallback test.', voice: 'Kore', model: 'm' })
    expect(audio).toEqual({ base64: 'REST_AUDIO', mimeType: 'audio/wav' })
    expect(restClient.synthesize).toHaveBeenCalledOnce()
  })

  it('validates liveTokenServiceUrl settings securely', () => {
    expect(parseSettings({ liveTokenServiceUrl: 'https://live.ibrowse.example.com' }).liveTokenServiceUrl).toBe(
      'https://live.ibrowse.example.com',
    )
    expect(parseSettings({ liveTokenServiceUrl: 'http://localhost:3000' }).liveTokenServiceUrl).toBe('http://localhost:3000')
    expect(parseSettings({ liveTokenServiceUrl: 'http://insecure.example.com' }).liveTokenServiceUrl).toBe('')
  })
})
