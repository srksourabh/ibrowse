import { describe, expect, it, vi } from 'vitest'
import { ImageError, MAX_IMAGE_BYTES, fetchImage } from '../../src/ai/image-fetch'

function imageResponse(bytes: number[], type = 'image/png', status = 200): Response {
  return new Response(new Uint8Array(bytes), { status, headers: { 'Content-Type': type } })
}

const caught = async (promise: Promise<unknown>): Promise<ImageError> => {
  try {
    await promise
  } catch (error) {
    if (error instanceof ImageError) return error
    throw error
  }
  throw new Error('expected an ImageError')
}

describe('fetchImage', () => {
  it('fetches a web image and returns it as base64 with its type', async () => {
    const fetchFn = vi.fn(async () => imageResponse([1, 2, 3]))
    const image = await fetchImage('https://example.com/a.png', fetchFn as unknown as typeof fetch)
    expect(image).toEqual({ base64: 'AQID', mimeType: 'image/png' })
    expect(fetchFn).toHaveBeenCalledWith('https://example.com/a.png', expect.objectContaining({ credentials: 'omit' }))
  })

  it('reads a data address without fetching', async () => {
    const fetchFn = vi.fn()
    const image = await fetchImage('data:image/jpeg;base64,AQID', fetchFn as unknown as typeof fetch)
    expect(image).toEqual({ base64: 'AQID', mimeType: 'image/jpeg' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it.each(['javascript:alert(1)', 'file:///etc/passwd', 'blob:https://a/b', 'chrome://version', 'ftp://x/y.png'])(
    'refuses %s',
    async (url) => {
      const fetchFn = vi.fn()
      const error = await caught(fetchImage(url, fetchFn as unknown as typeof fetch))
      expect(error.spoken).toMatch(/cannot be described/i)
      expect(fetchFn).not.toHaveBeenCalled()
    },
  )

  it('refuses a kind of image that cannot be described, such as SVG', async () => {
    const fetchFn = vi.fn(async () => imageResponse([1], 'image/svg+xml'))
    const error = await caught(fetchImage('https://example.com/a.svg', fetchFn as unknown as typeof fetch))
    expect(error.spoken).toMatch(/cannot be described/i)
  })

  it('refuses something that is not an image at all', async () => {
    const fetchFn = vi.fn(async () => imageResponse([1], 'text/html'))
    await caught(fetchImage('https://example.com/page', fetchFn as unknown as typeof fetch))
  })

  it('refuses an image that is too large, by its declared size', async () => {
    const response = new Response(new Uint8Array([1]), {
      headers: { 'Content-Type': 'image/png', 'Content-Length': String(MAX_IMAGE_BYTES + 1) },
    })
    const error = await caught(fetchImage('https://example.com/big.png', (async () => response) as unknown as typeof fetch))
    expect(error.spoken).toMatch(/too large/i)
  })

  it('refuses an image that is too large, by what actually arrives', async () => {
    const big = imageResponse(new Array(MAX_IMAGE_BYTES + 1).fill(0))
    const error = await caught(fetchImage('https://example.com/big.png', (async () => big) as unknown as typeof fetch))
    expect(error.spoken).toMatch(/too large/i)
  })

  it('says so when the image cannot be loaded', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const error = await caught(fetchImage('https://example.com/a.png', failing as unknown as typeof fetch))
    expect(error.spoken).toMatch(/could not load/i)

    const notFound = vi.fn(async () => imageResponse([], 'image/png', 404))
    const error2 = await caught(fetchImage('https://example.com/a.png', notFound as unknown as typeof fetch))
    expect(error2.spoken).toMatch(/could not load/i)
  })

  it('does not put the address in what is spoken', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('Failed')
    })
    const error = await caught(fetchImage('https://secret.example/a.png?token=XYZ', failing as unknown as typeof fetch))
    expect(error.spoken).not.toContain('secret')
    expect(error.message).not.toContain('XYZ')
  })
})
