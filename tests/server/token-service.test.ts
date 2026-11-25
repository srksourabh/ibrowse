import { generateKeyPairSync, sign } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTokenService } from '../../server/token-service.mjs'

function startTestServer(service: ReturnType<typeof createTokenService>) {
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

function makeDeviceKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const publicKeyJwk = publicKey.export({ format: 'jwk' })
  return { publicKeyJwk, privateKey }
}

function signRequest(deviceToken: string, privateKey: ReturnType<typeof makeDeviceKeys>['privateKey'], now: number, nonce: string) {
  const payload = Buffer.from(`${deviceToken}.${now}.${nonce}`, 'utf8')
  const sig = sign('sha256', payload, { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  return {
    Authorization: `Bearer ${deviceToken}`,
    'X-Device-Timestamp': String(now),
    'X-Device-Nonce': nonce,
    'X-Device-Signature': sig,
  }
}

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!()
})

describe('Gemini Live Token Service', () => {
  it('registers a device and mints a constrained Google ephemeral token using server-side GEMINI_API_KEY', async () => {
    let now = 1_700_000_000_000
    const googleFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          name: 'auth_tokens/ephemeral_abc123',
          expireTime: new Date(now + 600_000).toISOString(),
        }),
        { status: 200 },
      ),
    )
    const service = createTokenService({
      apiKey: 'SERVER_ONLY_GEMINI_KEY_SECRET',
      signingSecret: 'test-signing-secret-0123456789',
      model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
      fetch: googleFetch as unknown as typeof fetch,
      now: () => now,
    })
    const srv = await startTestServer(service)
    cleanups.push(srv.close)

    const { publicKeyJwk, privateKey } = makeDeviceKeys()
    const regRes = await fetch(`${srv.baseUrl}/api/auth/device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKeyJwk }),
    })
    expect(regRes.status).toBe(201)
    const reg = (await regRes.json()) as { deviceId: string; deviceToken: string; expiresAt: number }
    expect(reg.deviceId).toBeTruthy()
    expect(reg.deviceToken).toContain('.')

    const headers = signRequest(reg.deviceToken, privateKey, now, 'unique-nonce-0123456789')
    const tokRes = await fetch(`${srv.baseUrl}/api/gemini/live-token`, { method: 'POST', headers })
    expect(tokRes.status).toBe(200)
    const tok = (await tokRes.json()) as { token: string; expiresAt: number; model: string }
    expect(tok.token).toBe('auth_tokens/ephemeral_abc123')
    expect(tok.expiresAt).toBe(now + 600_000)
    expect(tok.model).toBe('models/gemini-2.5-flash-native-audio-preview-12-2025')
    expect(JSON.stringify(tok)).not.toContain('SERVER_ONLY_GEMINI_KEY_SECRET')

    expect(googleFetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1alpha/auth_tokens',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-goog-api-key': 'SERVER_ONLY_GEMINI_KEY_SECRET' }),
      }),
    )
    const sentBody = JSON.parse(String((googleFetch.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(sentBody).toMatchObject({
      uses: 1,
      liveConnectConstraints: {
        model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
        config: { responseModalities: ['AUDIO'] },
      },
    })
  })

  it('rejects unauthenticated, tampered, invalid signature, and replay requests with 401', async () => {
    const now = 1_700_000_000_000
    const service = createTokenService({
      apiKey: 'SERVER_KEY',
      signingSecret: 'test-signing-secret',
      fetch: vi.fn() as unknown as typeof fetch,
      now: () => now,
    })
    const srv = await startTestServer(service)
    cleanups.push(srv.close)

    // No auth header
    expect((await fetch(`${srv.baseUrl}/api/gemini/live-token`, { method: 'POST' })).status).toBe(401)

    // Register valid device
    const { publicKeyJwk, privateKey } = makeDeviceKeys()
    const reg = (await (
      await fetch(`${srv.baseUrl}/api/auth/device`, {
        method: 'POST',
        body: JSON.stringify({ publicKeyJwk }),
      })
    ).json()) as { deviceToken: string }

    // Tampered token
    const badHeaders = signRequest(`${reg.deviceToken}x`, privateKey, now, 'nonce-tampered-123456')
    expect((await fetch(`${srv.baseUrl}/api/gemini/live-token`, { method: 'POST', headers: badHeaders })).status).toBe(401)

    // Wrong private key signature
    const otherKeys = makeDeviceKeys()
    const wrongSig = signRequest(reg.deviceToken, otherKeys.privateKey, now, 'nonce-wrong-key-123456')
    expect((await fetch(`${srv.baseUrl}/api/gemini/live-token`, { method: 'POST', headers: wrongSig })).status).toBe(401)

    // Stale timestamp (>60s skew)
    const stale = signRequest(reg.deviceToken, privateKey, now - 120_000, 'nonce-stale-12345678')
    expect((await fetch(`${srv.baseUrl}/api/gemini/live-token`, { method: 'POST', headers: stale })).status).toBe(401)
  })

  it('enforces per-device rate limits and daily quotas, and detects replay nonces', async () => {
    const now = 1_700_000_000_000
    const googleFetch = vi.fn(async () =>
      new Response(JSON.stringify({ name: 'auth_tokens/tok', expireTime: new Date(now + 60_000).toISOString() }), { status: 200 }),
    )
    const service = createTokenService({
      apiKey: 'SERVER_KEY',
      signingSecret: 'secret',
      tokenLimitPerMin: 2,
      tokenDailyQuota: 3,
      fetch: googleFetch as unknown as typeof fetch,
      now: () => now,
    })
    const srv = await startTestServer(service)
    cleanups.push(srv.close)

    const { publicKeyJwk, privateKey } = makeDeviceKeys()
    const { deviceToken } = (await (
      await fetch(`${srv.baseUrl}/api/auth/device`, { method: 'POST', body: JSON.stringify({ publicKeyJwk }) })
    ).json()) as { deviceToken: string }

    const h1 = signRequest(deviceToken, privateKey, now, 'nonce-rate-11111111')
    expect((await fetch(`${srv.baseUrl}/api/gemini/live-token`, { method: 'POST', headers: h1 })).status).toBe(200)
    // Replay same nonce -> 401
    expect((await fetch(`${srv.baseUrl}/api/gemini/live-token`, { method: 'POST', headers: h1 })).status).toBe(401)

    const h2 = signRequest(deviceToken, privateKey, now, 'nonce-rate-22222222')
    expect((await fetch(`${srv.baseUrl}/api/gemini/live-token`, { method: 'POST', headers: h2 })).status).toBe(200)

    // 3rd request within 1 min -> 429 rate_limited
    const h3 = signRequest(deviceToken, privateKey, now, 'nonce-rate-33333333')
    const r3 = await fetch(`${srv.baseUrl}/api/gemini/live-token`, { method: 'POST', headers: h3 })
    expect(r3.status).toBe(429)
    expect(r3.headers.get('retry-after')).toBeTruthy()
  })

  it('handles missing server API key, Google errors, invalid payloads, and timeouts without leaking secrets', async () => {
    const now = 1_700_000_000_000
    // 1. Disabled / missing API key -> 503
    const disabled = createTokenService({ apiKey: '', fetch: vi.fn() as unknown as typeof fetch, now: () => now })
    const srv1 = await startTestServer(disabled)
    cleanups.push(srv1.close)
    expect((await fetch(`${srv1.baseUrl}/api/gemini/live-token`, { method: 'POST' })).status).toBe(503)

    // 2. Upstream Google 403 / 429 / invalid JSON / timeout
    let mode: 'auth-err' | 'rate-limit' | 'bad-json' | 'timeout' = 'auth-err'
    const googleFetch = vi.fn(async () => {
      if (mode === 'auth-err') return new Response(JSON.stringify({ error: { message: 'bad SERVER_SECRET_KEY' } }), { status: 403 })
      if (mode === 'rate-limit') return new Response('{}', { status: 429 })
      if (mode === 'bad-json') return new Response(JSON.stringify({ unexpected: true }), { status: 200 })
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    })
    const service = createTokenService({
      apiKey: 'SERVER_SECRET_KEY',
      signingSecret: 'secret',
      fetch: googleFetch as unknown as typeof fetch,
      now: () => now,
    })
    const srv2 = await startTestServer(service)
    cleanups.push(srv2.close)

    const { publicKeyJwk, privateKey } = makeDeviceKeys()
    const { deviceToken } = (await (
      await fetch(`${srv2.baseUrl}/api/auth/device`, { method: 'POST', body: JSON.stringify({ publicKeyJwk }) })
    ).json()) as { deviceToken: string }

    const resAuth = await fetch(`${srv2.baseUrl}/api/gemini/live-token`, {
      method: 'POST',
      headers: signRequest(deviceToken, privateKey, now, 'nonce-err-111111111'),
    })
    expect(resAuth.status).toBe(502)
    expect(await resAuth.text()).not.toContain('SERVER_SECRET_KEY')

    mode = 'rate-limit'
    expect(
      (await fetch(`${srv2.baseUrl}/api/gemini/live-token`, {
        method: 'POST',
        headers: signRequest(deviceToken, privateKey, now, 'nonce-err-222222222'),
      })).status,
    ).toBe(429)

    mode = 'bad-json'
    expect(
      (await fetch(`${srv2.baseUrl}/api/gemini/live-token`, {
        method: 'POST',
        headers: signRequest(deviceToken, privateKey, now, 'nonce-err-333333333'),
      })).status,
    ).toBe(502)

    mode = 'timeout'
    expect(
      (await fetch(`${srv2.baseUrl}/api/gemini/live-token`, {
        method: 'POST',
        headers: signRequest(deviceToken, privateKey, now, 'nonce-err-444444444'),
      })).status,
    ).toBe(504)
  })

  it('rejects malformed device registration requests with 400', async () => {
    const service = createTokenService({ apiKey: 'k', fetch: vi.fn() as unknown as typeof fetch })
    const srv = await startTestServer(service)
    cleanups.push(srv.close)

    const badJson = await fetch(`${srv.baseUrl}/api/auth/device`, { method: 'POST', body: '{bad' })
    expect(badJson.status).toBe(400)

    const badKey = await fetch(`${srv.baseUrl}/api/auth/device`, {
      method: 'POST',
      body: JSON.stringify({ publicKeyJwk: { kty: 'RSA' } }),
    })
    expect(badKey.status).toBe(400)
  })
})
