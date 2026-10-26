import { isPrivateHost } from './private-network'

/** Larger images are refused: they cost more, and take too long to be useful to someone waiting. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i

/** A failure to get an image. `spoken` is fixed text: the address is never put in it. */
export class ImageError extends Error {
  readonly spoken: string

  constructor(spoken: string) {
    super('image')
    this.name = 'ImageError'
    this.spoken = spoken
  }
}

const UNDESCRIBABLE = 'That image cannot be described.'
const TOO_LARGE = 'That image is too large to describe.'
const COULD_NOT_LOAD = 'Could not load that image.'
const PRIVATE = 'That image is on a private network, so it is not sent.'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}

function fromDataUrl(url: string): { base64: string; mimeType: string } | null {
  const match = DATA_URL.exec(url)
  if (!match) return null
  const mimeType = match[1]!.toLowerCase()
  const base64 = match[2]!
  if (!ALLOWED_TYPES.has(mimeType)) throw new ImageError(UNDESCRIBABLE)
  if ((base64.length * 3) / 4 > MAX_IMAGE_BYTES) throw new ImageError(TOO_LARGE)
  return { base64, mimeType }
}

/**
 * Gets an image to describe. Only web and data addresses are accepted, never
 * with the user's cookies, never from the user's own network, and never an
 * image that is too big or of a kind that cannot be described.
 */
export async function fetchImage(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ base64: string; mimeType: string }> {
  const inline = fromDataUrl(url)
  if (inline) return inline

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new ImageError(UNDESCRIBABLE)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new ImageError(UNDESCRIBABLE)
  // A page could point at a router or printer at home; the worker would fetch it and send it to Google.
  if (isPrivateHost(parsed.hostname)) throw new ImageError(PRIVATE)

  let response: Response
  try {
    response = await fetchFn(url, { credentials: 'omit', redirect: 'follow' })
  } catch {
    throw new ImageError(COULD_NOT_LOAD)
  }
  if (!response.ok) throw new ImageError(COULD_NOT_LOAD)
  if (response.url && isPrivateHost(new URL(response.url).hostname)) throw new ImageError(PRIVATE)

  const mimeType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  if (!ALLOWED_TYPES.has(mimeType)) throw new ImageError(UNDESCRIBABLE)
  if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) throw new ImageError(TOO_LARGE)

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length > MAX_IMAGE_BYTES) throw new ImageError(TOO_LARGE)
  return { base64: bytesToBase64(bytes), mimeType }
}
