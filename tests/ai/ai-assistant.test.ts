import { describe, expect, it, vi } from 'vitest'
import { AiAssistant, cleanAnswer } from '../../src/ai/ai-assistant'
import { ImageError } from '../../src/ai/image-fetch'
import { CloudError } from '../../src/cloud/gemini-client'
import { DEFAULT_SETTINGS, type Settings } from '../../src/shared/settings'

function setup(options: { settings?: Partial<Settings>; answer?: string | Error; image?: Error } = {}) {
  const generate = vi.fn(async (_req: { model: string; parts: unknown[]; maxOutputTokens: number }) => {
    // Anything that is not a string is thrown. (A jsdom DOMException is not an `instanceof Error`.)
    if (options.answer !== undefined && typeof options.answer !== 'string') throw options.answer
    return options.answer ?? 'A calm garden page.'
  })
  const fetchImage = vi.fn(async (_url: string) => {
    if (options.image) throw options.image
    return { base64: 'QUJD', mimeType: 'image/png' }
  })
  const assistant = new AiAssistant({
    client: { generate } as never,
    getSettings: async () => ({ ...DEFAULT_SETTINGS, aiAssist: true, ...options.settings }),
    fetchImage,
  })
  return { assistant, generate, fetchImage }
}

const PAGE = { title: 'Garden', headings: ['Roses'], excerpt: 'Roses need sun.' }

describe('cleanAnswer', () => {
  it('removes markdown marks, list bullets and links', () => {
    expect(cleanAnswer('**Bold** text, see [here](https://x.example) and https://y.example now.', 400)).toBe(
      'Bold text, see here and now.',
    )
    expect(cleanAnswer('- one\n- two\n# Heading\n`code`', 400)).toBe('one two Heading code')
  })

  it('collapses whitespace', () => {
    expect(cleanAnswer('  a \n\n b  ', 400)).toBe('a b')
  })

  it('cuts long answers at a sentence end where it can', () => {
    const answer = 'First sentence here. Second sentence here. Third sentence here.'
    expect(cleanAnswer(answer, 45)).toBe('First sentence here. Second sentence here.')
  })

  it('cuts at a word when there is no sentence end in reach', () => {
    const cut = cleanAnswer('word '.repeat(100), 30)
    expect(cut.length).toBeLessThanOrEqual(30)
    expect(cut.endsWith(' ')).toBe(false)
  })
})

describe('AiAssistant: when it is off', () => {
  it('sends nothing and says AI features are off', async () => {
    const { assistant, generate, fetchImage } = setup({ settings: { aiAssist: false } })
    expect(await assistant.purpose(PAGE)).toMatchObject({ ok: false, kind: 'disabled' })
    expect(await assistant.summarize(PAGE)).toMatchObject({ ok: false, kind: 'disabled' })
    expect(await assistant.describeImage({ url: 'https://a/b.png', alt: '', pageTitle: '', context: '' })).toMatchObject({
      ok: false,
      kind: 'disabled',
    })
    expect(generate).not.toHaveBeenCalled()
    expect(fetchImage).not.toHaveBeenCalled()
  })
})

describe('AiAssistant.purpose', () => {
  it('asks the chosen model for one short sentence, with a small answer cap', async () => {
    const { assistant, generate } = setup({ settings: { aiModel: 'gemini-3.8-flash' } })
    const result = await assistant.purpose(PAGE)
    expect(result).toEqual({ ok: true, text: 'A calm garden page.' })
    const request = generate.mock.calls[0]![0]
    expect(request.model).toBe('gemini-3.8-flash')
    expect(request.maxOutputTokens).toBeLessThanOrEqual(100)
    expect(request.parts).toHaveLength(1)
  })

  it('remembers the answer for the same page', async () => {
    const { assistant, generate } = setup()
    await assistant.purpose(PAGE)
    await assistant.purpose(PAGE)
    expect(generate).toHaveBeenCalledOnce()
  })

  it('asks again for a different page', async () => {
    const { assistant, generate } = setup()
    await assistant.purpose(PAGE)
    await assistant.purpose({ ...PAGE, title: 'Cars' })
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('cleans the answer before it is spoken', async () => {
    const { assistant } = setup({ answer: '**A garden** page: https://x.example' })
    expect(await assistant.purpose(PAGE)).toEqual({ ok: true, text: 'A garden page:' })
  })
})

describe('AiAssistant.summarize', () => {
  it('allows a longer answer than the one-line purpose', async () => {
    const { assistant, generate } = setup()
    await assistant.summarize(PAGE)
    expect(generate.mock.calls[0]![0].maxOutputTokens).toBeGreaterThan(100)
  })
})

describe('AiAssistant.answerQuestion', () => {
  const QUESTION = { ...PAGE, question: 'Do roses need sun?', pointedAt: '' }

  it('answers from the page, with room for a few sentences', async () => {
    const { assistant, generate } = setup({ answer: 'Yes, roses need sun.' })
    expect(await assistant.answerQuestion(QUESTION)).toEqual({ ok: true, text: 'Yes, roses need sun.' })
    expect(generate.mock.calls[0]![0].maxOutputTokens).toBeGreaterThan(100)
  })

  it('is refused while AI is off, without sending anything', async () => {
    const { assistant, generate } = setup({ settings: { aiAssist: false } })
    expect(await assistant.answerQuestion(QUESTION)).toMatchObject({ ok: false, kind: 'disabled' })
    expect(generate).not.toHaveBeenCalled()
  })
})

describe('AiAssistant.describeImage', () => {
  const IMAGE = { url: 'https://a.example/kite.png', alt: '', pageTitle: 'Kites', context: '' }

  it('sends the instructions and the image together', async () => {
    const { assistant, generate, fetchImage } = setup({ answer: 'A red kite in a blue sky.' })
    expect(await assistant.describeImage(IMAGE)).toEqual({ ok: true, text: 'A red kite in a blue sky.' })
    expect(fetchImage).toHaveBeenCalledWith('https://a.example/kite.png')
    const { parts } = generate.mock.calls[0]![0]
    expect(parts).toEqual([
      expect.objectContaining({ type: 'text' }),
      { type: 'image', data: 'QUJD', mimeType: 'image/png' },
    ])
  })

  it('remembers a description for the same image', async () => {
    const { assistant, generate } = setup()
    await assistant.describeImage(IMAGE)
    await assistant.describeImage(IMAGE)
    expect(generate).toHaveBeenCalledOnce()
  })

  it('says why when the image cannot be loaded, and asks nothing', async () => {
    const { assistant, generate } = setup({ image: new ImageError('That image cannot be described.') })
    expect(await assistant.describeImage(IMAGE)).toEqual({
      ok: false,
      kind: 'image',
      reason: 'That image cannot be described.',
    })
    expect(generate).not.toHaveBeenCalled()
  })
})

describe('AiAssistant errors', () => {
  it('turns a cloud error into a sentence to say', async () => {
    const { assistant } = setup({ answer: new CloudError('bad-key') })
    const result = await assistant.purpose(PAGE)
    expect(result).toMatchObject({ ok: false, kind: 'bad-key' })
    expect(result.ok === false && result.reason).toMatch(/did not accept the key/i)
  })

  it('does not remember a failure', async () => {
    const { assistant, generate } = setup({ answer: new CloudError('server') })
    await assistant.purpose(PAGE)
    await assistant.purpose(PAGE)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('treats a cancelled request as cancelled, not as a problem', async () => {
    const { assistant } = setup({ answer: new DOMException('aborted', 'AbortError') })
    expect(await assistant.purpose(PAGE)).toMatchObject({ ok: false, kind: 'cancelled' })
  })

  it('reports an unexpected failure as a network problem, with fixed words', async () => {
    const { assistant } = setup({ answer: new Error('socket: secret internal detail') })
    const result = await assistant.purpose(PAGE)
    expect(result.ok === false && result.reason).not.toContain('secret')
  })
})
