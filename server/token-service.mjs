import { createHmac, randomBytes, randomUUID, timingSafeEqual, verify as verifySignature } from 'node:crypto'

const GOOGLE_AUTH_TOKENS_URL = 'https://generativelanguage.googleapis.com/v1alpha/auth_tokens'
const DEFAULT_LIVE_MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025'
const DEFAULT_TOKEN_TTL_SEC = 600
const DEFAULT_NEW_SESSION_TTL_SEC = 120
const MAX_TOKEN_TTL_SEC = 1800
const MIN_TOKEN_TTL_SEC = 60
const DEVICE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const SIGNATURE_MAX_SKEW_MS = 60_000
const GOOGLE_TIMEOUT_MS = 10_000
const MAX_BODY_BYTES = 16 * 1024

/**
 * Simple sliding-window rate limiter for per-IP and per-device quotas.
 */
class WindowLimiter {
  #hits = new Map()

  check(key, limit, windowMs, now) {
    const cutoff = now - windowMs
    const list = (this.#hits.get(key) ?? []).filter((t) => t > cutoff)
    if (list.length >= limit) {
      this.#hits.set(key, list)
      const retryAfterSec = Math.max(1, Math.ceil((list[0] + windowMs - now) / 1000))
      return { allowed: false, retryAfterSec }
    }
    list.push(now)
    this.#hits.set(key, list)
    if (this.#hits.size > 10_000) {
      const oldestKey = this.#hits.keys().next().value
      if (oldestKey !== undefined) this.#hits.delete(oldestKey)
    }
    return { allowed: true, retryAfterSec: 0 }
  }
}

function b64urlEncode(input) {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input)
  return buf.toString('base64url')
}

function b64urlDecode(str) {
  return Buffer.from(str, 'base64url')
}

function clamp(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function isValidP256Jwk(jwk) {
  return (
    typeof jwk === 'object' &&
    jwk !== null &&
    jwk.kty === 'EC' &&
    jwk.crv === 'P-256' &&
    typeof jwk.x === 'string' &&
    jwk.x.length >= 32 &&
    jwk.x.length <= 128 &&
    typeof jwk.y === 'string' &&
    jwk.y.length >= 32 &&
    jwk.y.length <= 128
  )
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        reject(new Error('BODY_TOO_LARGE'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('INVALID_JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  })
  res.end(payload)
}

/**
 * Creates the authenticated Gemini Live ephemeral token service.
 *
 * Authentication model:
 * - No hardcoded shared secret in the extension.
 * - On first use, the extension generates an ECDSA P-256 keypair and registers its public JWK
 *   at POST /api/auth/device (rate-limited per IP).
 * - Server returns an HMAC-SHA256-signed deviceToken binding a server-generated deviceId and JWK.
 * - On POST /api/gemini/live-token, the extension proves possession of the private key via
 *   X-Device-Timestamp, X-Device-Nonce, and X-Device-Signature over `${deviceToken}.${ts}.${nonce}`.
 */
export function createTokenService(options = {}) {
  const env = options.env ?? process.env
  const fetchFn = options.fetch ?? fetch
  const nowFn = options.now ?? Date.now

  const apiKey = (options.apiKey ?? env.GEMINI_API_KEY ?? '').trim()
  const enabledFlag = (options.enabled ?? env.GEMINI_LIVE_TOKEN_SERVICE_ENABLED ?? (apiKey ? 'true' : 'false')).toLowerCase()
  const isEnabled = enabledFlag === 'true' && apiKey !== ''

  const signingSecret = (options.signingSecret ?? env.IBROWSE_TOKEN_SIGNING_SECRET ?? '').trim() || randomBytes(32).toString('hex')
  const model = (options.model ?? env.GEMINI_LIVE_MODEL ?? DEFAULT_LIVE_MODEL).trim() || DEFAULT_LIVE_MODEL
  const tokenTtlSec = clamp(options.tokenTtlSec ?? env.GEMINI_LIVE_TOKEN_TTL, MIN_TOKEN_TTL_SEC, MAX_TOKEN_TTL_SEC, DEFAULT_TOKEN_TTL_SEC)
  const newSessionTtlSec = clamp(
    options.newSessionTtlSec ?? env.GEMINI_LIVE_NEW_SESSION_TTL,
    30,
    tokenTtlSec,
    DEFAULT_NEW_SESSION_TTL_SEC,
  )

  const registerLimitPerMin = clamp(options.registerLimitPerMin ?? env.IBROWSE_REGISTER_RATE_LIMIT_PER_MIN, 1, 1000, 10)
  const tokenLimitPerMin = clamp(options.tokenLimitPerMin ?? env.IBROWSE_TOKEN_RATE_LIMIT_PER_MIN, 1, 1000, 20)
  const tokenDailyQuota = clamp(options.tokenDailyQuota ?? env.IBROWSE_TOKEN_DAILY_QUOTA, 1, 100_000, 200)

  const ipLimiter = new WindowLimiter()
  const deviceMinLimiter = new WindowLimiter()
  const deviceDayLimiter = new WindowLimiter()
  const seenNonces = new Map() // nonce -> expiresAtMs

  function signDeviceToken(payload) {
    const encoded = b64urlEncode(JSON.stringify(payload))
    const sig = createHmac('sha256', signingSecret).update(encoded).digest('base64url')
    return `${encoded}.${sig}`
  }

  function verifyDeviceToken(token) {
    if (typeof token !== 'string') return null
    const dot = token.indexOf('.')
    if (dot <= 0 || dot === token.length - 1) return null
    const encoded = token.slice(0, dot)
    const providedSig = token.slice(dot + 1)
    const expectedSig = createHmac('sha256', signingSecret).update(encoded).digest('base64url')
    const a = Buffer.from(providedSig, 'utf8')
    const b = Buffer.from(expectedSig, 'utf8')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    try {
      const payload = JSON.parse(b64urlDecode(encoded).toString('utf8'))
      if (
        !payload ||
        typeof payload.sub !== 'string' ||
        typeof payload.exp !== 'number' ||
        !isValidP256Jwk(payload.jwk)
      ) {
        return null
      }
      if (nowFn() >= payload.exp) return null
      return payload
    } catch {
      return null
    }
  }

  function pruneNonces(now) {
    for (const [nonce, exp] of seenNonces) {
      if (exp <= now) seenNonces.delete(nonce)
    }
  }

  function clientIp(req) {
    const fwd = req.headers['x-forwarded-for']
    if (typeof fwd === 'string' && fwd.trim() !== '') return fwd.split(',')[0].trim()
    return req.socket?.remoteAddress || 'unknown'
  }

  async function handleRegisterDevice(req, res) {
    const now = nowFn()
    const ipCheck = ipLimiter.check(`reg:${clientIp(req)}`, registerLimitPerMin, 60_000, now)
    if (!ipCheck.allowed) {
      sendJson(res, 429, { error: 'rate_limited', message: 'Too many device registrations. Try again later.' }, { 'Retry-After': String(ipCheck.retryAfterSec) })
      return
    }

    let body
    try {
      body = await readJsonBody(req)
    } catch (err) {
      const status = err?.message === 'BODY_TOO_LARGE' ? 413 : 400
      sendJson(res, status, { error: 'invalid_request', message: 'Invalid JSON request body.' })
      return
    }

    if (!isValidP256Jwk(body?.publicKeyJwk)) {
      sendJson(res, 400, { error: 'invalid_request', message: 'A valid ECDSA P-256 publicKeyJwk is required.' })
      return
    }

    const deviceId = randomUUID()
    const expiresAt = now + DEVICE_TOKEN_TTL_MS
    const publicJwk = { kty: 'EC', crv: 'P-256', x: body.publicKeyJwk.x, y: body.publicKeyJwk.y }
    const deviceToken = signDeviceToken({ sub: deviceId, jwk: publicJwk, iat: now, exp: expiresAt })

    sendJson(res, 201, { deviceId, deviceToken, expiresAt })
  }

  async function handleMintLiveToken(req, res) {
    if (!isEnabled) {
      sendJson(res, 503, { error: 'service_unavailable', message: 'Gemini Live token service is not configured.' })
      return
    }

    const authHeader = req.headers.authorization
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'unauthorized', message: 'Missing Bearer device token.' })
      return
    }
    const deviceToken = authHeader.slice(7).trim()
    const claims = verifyDeviceToken(deviceToken)
    if (!claims) {
      sendJson(res, 401, { error: 'unauthorized', message: 'Invalid or expired device token.' })
      return
    }

    const tsRaw = req.headers['x-device-timestamp']
    const nonce = req.headers['x-device-nonce']
    const sigRaw = req.headers['x-device-signature']
    const ts = Number(tsRaw)
    const now = nowFn()

    if (
      !Number.isFinite(ts) ||
      Math.abs(now - ts) > SIGNATURE_MAX_SKEW_MS ||
      typeof nonce !== 'string' ||
      nonce.length < 16 ||
      nonce.length > 128 ||
      typeof sigRaw !== 'string' ||
      sigRaw.length === 0
    ) {
      sendJson(res, 401, { error: 'unauthorized', message: 'Missing or expired device proof-of-possession.' })
      return
    }

    pruneNonces(now)
    if (seenNonces.has(nonce)) {
      sendJson(res, 401, { error: 'unauthorized', message: 'Replay nonce detected.' })
      return
    }

    let sigValid = false
    try {
      const signedMessage = Buffer.from(`${deviceToken}.${tsRaw}.${nonce}`, 'utf8')
      const sigBuf = b64urlDecode(sigRaw)
      sigValid = verifySignature('sha256', signedMessage, { key: claims.jwk, format: 'jwk', dsaEncoding: 'ieee-p1363' }, sigBuf)
    } catch {
      sigValid = false
    }
    if (!sigValid) {
      sendJson(res, 401, { error: 'unauthorized', message: 'Invalid device signature.' })
      return
    }
    seenNonces.set(nonce, now + SIGNATURE_MAX_SKEW_MS * 2)

    const minCheck = deviceMinLimiter.check(claims.sub, tokenLimitPerMin, 60_000, now)
    if (!minCheck.allowed) {
      sendJson(res, 429, { error: 'rate_limited', message: 'Token rate limit exceeded.' }, { 'Retry-After': String(minCheck.retryAfterSec) })
      return
    }

    const dayCheck = deviceDayLimiter.check(claims.sub, tokenDailyQuota, 86_400_000, now)
    if (!dayCheck.allowed) {
      sendJson(res, 429, { error: 'quota_exceeded', message: 'Daily token quota exceeded.' }, { 'Retry-After': String(dayCheck.retryAfterSec) })
      return
    }

    const expireIso = new Date(now + tokenTtlSec * 1000).toISOString()
    const newSessionIso = new Date(now + newSessionTtlSec * 1000).toISOString()

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS)
    try {
      const googleRes = await fetchFn(GOOGLE_AUTH_TOKENS_URL, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uses: 1,
          expireTime: expireIso,
          newSessionExpireTime: newSessionIso,
          liveConnectConstraints: {
            model,
            config: {
              responseModalities: ['AUDIO'],
            },
          },
        }),
        signal: controller.signal,
      })

      if (googleRes.status === 429) {
        sendJson(res, 429, { error: 'upstream_rate_limit', message: 'Google token quota temporarily exceeded.' })
        return
      }
      if (!googleRes.ok) {
        // Never leak upstream Google error payloads or API keys to clients
        sendJson(res, 502, { error: 'upstream_auth_failed', message: 'Could not mint ephemeral Gemini Live token.' })
        return
      }

      const data = await googleRes.json().catch(() => null)
      const tokenName = typeof data?.name === 'string' ? data.name.trim() : ''
      const parsedExp = typeof data?.expireTime === 'string' ? Date.parse(data.expireTime) : Date.parse(expireIso)
      if (!tokenName || !Number.isFinite(parsedExp)) {
        sendJson(res, 502, { error: 'invalid_upstream_response', message: 'Invalid token response from Google.' })
        return
      }

      sendJson(res, 200, {
        token: tokenName,
        expiresAt: parsedExp,
        model,
      })
    } catch (err) {
      const status = err?.name === 'AbortError' ? 504 : 502
      sendJson(res, status, { error: 'upstream_unavailable', message: 'Google ephemeral token service unreachable.' })
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    isEnabled,
    model,
    async handle(req, res, pathname) {
      if (req.method === 'POST' && pathname === '/api/auth/device') {
        await handleRegisterDevice(req, res)
        return true
      }
      if (req.method === 'POST' && pathname === '/api/gemini/live-token') {
        await handleMintLiveToken(req, res)
        return true
      }
      return false
    },
  }
}
