import type { KeyValueStore } from '../shared/settings'
import { CloudError } from './cloud-error'
import type { EphemeralToken } from './gemini-live'

const STORAGE_PREFIX = 'deviceAuth:'
const TOKEN_TIMEOUT_MS = 5_000
const EXPIRY_BUFFER_MS = 60_000

interface StoredDeviceAuth {
  readonly deviceId: string
  readonly deviceToken: string
  readonly expiresAt: number
  readonly privateKeyJwk: JsonWebKey
  readonly publicKeyJwk: JsonWebKey
}

export interface DeviceAuthDeps {
  readonly store: KeyValueStore
  readonly fetch?: typeof fetch
  readonly now?: () => number
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function randomNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
}

function normalizeServiceOrigin(rawUrl: string): string {
  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    throw new CloudError('auth-failed')
  }
  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  if (parsed.protocol !== 'https:' && !isLocal) {
    throw new CloudError('auth-failed')
  }
  return parsed.origin
}

/**
 * Extension-side device registration and ECDSA P-256 Proof-of-Possession client
 * for the iBrowse Gemini Live token service.
 *
 * - Never uses a hardcoded shared secret.
 * - Never persists short-lived Gemini Live ephemeral tokens to storage.
 */
export class DeviceAuth {
  readonly #deps: DeviceAuthDeps
  readonly #inflightReg = new Map<string, Promise<StoredDeviceAuth>>()

  constructor(deps: DeviceAuthDeps) {
    this.#deps = deps
  }

  async fetchLiveToken(serviceUrl: string): Promise<EphemeralToken> {
    const origin = normalizeServiceOrigin(serviceUrl)
    const tokenEndpoint = new URL('/api/gemini/live-token', origin).toString()

    let auth = await this.#ensureRegistered(origin)
    const res = await this.#requestLiveToken(tokenEndpoint, auth)
    if (res.status === 401) {
      // Server signing secret rotated or device token expired: re-register once.
      await this.#deps.store.set({ [`${STORAGE_PREFIX}${origin}`]: null })
      auth = await this.#ensureRegistered(origin)
      const retry = await this.#requestLiveToken(tokenEndpoint, auth)
      return this.#parseTokenResponse(retry)
    }
    return this.#parseTokenResponse(res)
  }

  async #ensureRegistered(origin: string): Promise<StoredDeviceAuth> {
    const storageKey = `${STORAGE_PREFIX}${origin}`
    const existing = (await this.#deps.store.get(storageKey))[storageKey] as StoredDeviceAuth | null | undefined
    const now = this.#deps.now ? this.#deps.now() : Date.now()
    if (
      existing &&
      typeof existing.deviceId === 'string' &&
      typeof existing.deviceToken === 'string' &&
      typeof existing.expiresAt === 'number' &&
      existing.expiresAt > now + EXPIRY_BUFFER_MS &&
      existing.privateKeyJwk &&
      existing.publicKeyJwk
    ) {
      return existing
    }

    const pending = this.#inflightReg.get(origin)
    if (pending) return pending

    const regPromise = this.#register(origin, storageKey).finally(() => {
      this.#inflightReg.delete(origin)
    })
    this.#inflightReg.set(origin, regPromise)
    return regPromise
  }

  async #register(origin: string, storageKey: string): Promise<StoredDeviceAuth> {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )
    const [publicKeyJwk, privateKeyJwk] = await Promise.all([
      crypto.subtle.exportKey('jwk', keyPair.publicKey),
      crypto.subtle.exportKey('jwk', keyPair.privateKey),
    ])

    const fetchFn = this.#deps.fetch ?? fetch
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS)
    try {
      const res = await fetchFn(new URL('/api/auth/device', origin).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ publicKeyJwk }),
        signal: controller.signal,
      })
      if (res.status === 429) throw new CloudError('rate-limit')
      if (!res.ok) throw new CloudError('auth-failed')
      const body = (await res.json()) as { deviceId?: unknown; deviceToken?: unknown; expiresAt?: unknown }
      if (
        typeof body.deviceId !== 'string' ||
        typeof body.deviceToken !== 'string' ||
        typeof body.expiresAt !== 'number'
      ) {
        throw new CloudError('auth-failed')
      }
      const stored: StoredDeviceAuth = {
        deviceId: body.deviceId,
        deviceToken: body.deviceToken,
        expiresAt: body.expiresAt,
        privateKeyJwk,
        publicKeyJwk,
      }
      await this.#deps.store.set({ [storageKey]: stored })
      return stored
    } catch (error) {
      if (error instanceof CloudError) throw error
      throw new CloudError('network')
    } finally {
      clearTimeout(timer)
    }
  }

  async #requestLiveToken(endpoint: string, auth: StoredDeviceAuth): Promise<Response> {
    const now = this.#deps.now ? this.#deps.now() : Date.now()
    const ts = String(now)
    const nonce = randomNonce()
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      auth.privateKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    )
    const payload = new TextEncoder().encode(`${auth.deviceToken}.${ts}.${nonce}`)
    const sigBuf = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, payload)
    const sig = toBase64Url(new Uint8Array(sigBuf))

    const fetchFn = this.#deps.fetch ?? fetch
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS)
    try {
      return await fetchFn(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth.deviceToken}`,
          'X-Device-Timestamp': ts,
          'X-Device-Nonce': nonce,
          'X-Device-Signature': sig,
        },
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof CloudError) throw error
      throw new CloudError('network')
    } finally {
      clearTimeout(timer)
    }
  }

  async #parseTokenResponse(res: Response): Promise<EphemeralToken> {
    if (res.status === 401 || res.status === 403) throw new CloudError('auth-failed')
    if (res.status === 429) throw new CloudError('rate-limit')
    if (!res.ok) throw new CloudError('server')
    const body = (await res.json().catch(() => null)) as { token?: unknown; expiresAt?: unknown } | null
    if (
      !body ||
      typeof body.token !== 'string' ||
      body.token.trim() === '' ||
      typeof body.expiresAt !== 'number' ||
      !Number.isFinite(body.expiresAt)
    ) {
      throw new CloudError('auth-failed')
    }
    return { token: body.token.trim(), expiresAt: body.expiresAt }
  }
}
