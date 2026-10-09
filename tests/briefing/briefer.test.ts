import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Briefer } from '../../src/briefing/briefer'
import type { LayoutModel } from '../../src/briefing/layout-model'

const COUNTS = { paragraphs: 3, headings: 0, links: 0, buttons: 0, inputs: 0, forms: 0, frames: 0 }
const MODEL: LayoutModel = {
  title: 'Garden',
  kind: 'page',
  regions: [],
  media: [],
  counts: COUNTS,
  headings: [],
}

function setup(
  overrides: { model?: LayoutModel; texts?: string[]; enrich?: () => Promise<string | null> } = {},
) {
  const resolvers: Array<() => void> = []
  const speech = {
    speak: vi.fn(
      () =>
        new Promise<'finished'>((resolve) => {
          resolvers.push(() => resolve('finished'))
        }),
    ),
    cancel: vi.fn(),
  }
  const hover = { setMuted: vi.fn() }
  const readTexts = vi.fn((_from: Element | null) => overrides.texts ?? ['One', 'Two', 'Three'])
  const briefer = new Briefer({
    analyze: () => overrides.model ?? MODEL,
    readTexts,
    speech,
    hover,
    getRate: () => 1,
    ...(overrides.enrich ? { enrich: overrides.enrich } : {}),
  })
  return { briefer, speech, hover, resolvers, readTexts }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Briefer.brief', () => {
  it('speaks the briefing and asks to read', () => {
    const { briefer, speech } = setup()
    briefer.brief()
    expect(speech.speak).toHaveBeenCalledWith(
      { text: 'Garden. Web page. 3 paragraphs. Want me to read it?', rate: 1 },
      { interrupt: true },
    )
  })

  it('can queue after the "Explore mode on" announcement', () => {
    const { briefer, speech } = setup()
    briefer.brief({ interrupt: false })
    expect(speech.speak).toHaveBeenCalledWith(expect.anything(), { interrupt: false })
  })

  it('reads the detailed briefing on request', () => {
    const { briefer, speech } = setup({
      model: { ...MODEL, counts: { ...COUNTS, headings: 1 }, headings: ['Intro'] },
    })
    briefer.brief({ detailed: true })
    expect(speech.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('Headings: Intro.') }),
      expect.anything(),
    )
  })

  it('reads the page when the user answers Y', () => {
    const { briefer, speech } = setup()
    briefer.brief()
    speech.speak.mockClear()
    expect(briefer.handleKey('y')).toBe(true)
    expect(speech.speak).toHaveBeenCalledWith({ text: 'One', rate: 1, kind: 'reading' }, { interrupt: true })
  })

  it('does not ask, and ignores Y, when there is nothing to read', () => {
    const { briefer, speech } = setup({ model: { ...MODEL, counts: { ...COUNTS, paragraphs: 0 } } })
    briefer.brief()
    speech.speak.mockClear()
    expect(briefer.handleKey('y')).toBe(false)
    expect(speech.speak).not.toHaveBeenCalled()
  })

  it('stops asking after N, and after a real pointer move', () => {
    const a = setup()
    a.briefer.brief()
    expect(a.briefer.handleKey('n')).toBe(true)
    expect(a.briefer.handleKey('y')).toBe(false)

    const b = setup()
    b.briefer.brief()
    b.briefer.handlePointerMove(10, 10)
    b.briefer.handlePointerMove(200, 10)
    expect(b.briefer.handleKey('y')).toBe(false)
  })
})

describe('Briefer: the AI one-line purpose', () => {
  const later = () => {
    let arrive: (text: string | null) => void = () => {}
    const promise = new Promise<string | null>((resolve) => {
      arrive = resolve
    })
    return { promise, arrive }
  }

  it('is spoken after the briefing, in its turn, as reading', async () => {
    const { promise, arrive } = later()
    const { briefer, speech } = setup({ enrich: () => promise })
    briefer.brief()
    speech.speak.mockClear()
    arrive('A page about gardening.')
    await vi.waitFor(() => expect(speech.speak).toHaveBeenCalled())
    expect(speech.speak).toHaveBeenCalledWith(
      { text: 'A page about gardening.', rate: 1, kind: 'reading' },
      { interrupt: false },
    )
  })

  it('is dropped if the user has already started reading', async () => {
    const { promise, arrive } = later()
    const { briefer, speech } = setup({ enrich: () => promise })
    briefer.brief()
    briefer.handleKey('y')
    speech.speak.mockClear()
    arrive('A page about gardening.')
    await Promise.resolve()
    await Promise.resolve()
    expect(speech.speak).not.toHaveBeenCalled()
  })

  it('is dropped after the user stops speech', async () => {
    const { promise, arrive } = later()
    const { briefer, speech } = setup({ enrich: () => promise })
    briefer.brief()
    briefer.stop()
    speech.speak.mockClear()
    arrive('A page about gardening.')
    await Promise.resolve()
    await Promise.resolve()
    expect(speech.speak).not.toHaveBeenCalled()
  })

  it('is dropped if a newer briefing has begun', async () => {
    const first = later()
    const second = later()
    const answers = [first.promise, second.promise]
    const { briefer, speech } = setup({ enrich: () => answers.shift()! })
    briefer.brief()
    briefer.brief()
    speech.speak.mockClear()
    first.arrive('Old answer.')
    await Promise.resolve()
    await Promise.resolve()
    expect(speech.speak).not.toHaveBeenCalled()
    second.arrive('New answer.')
    await vi.waitFor(() => expect(speech.speak).toHaveBeenCalledOnce())
  })

  it('says nothing when there is no answer', async () => {
    const { briefer, speech } = setup({ enrich: async () => null })
    briefer.brief()
    speech.speak.mockClear()
    await Promise.resolve()
    await Promise.resolve()
    expect(speech.speak).not.toHaveBeenCalled()
  })

  it('does nothing extra when AI is not provided', () => {
    const { briefer, speech } = setup()
    briefer.brief()
    expect(speech.speak).toHaveBeenCalledOnce()
  })
})

describe('Briefer.readAll', () => {
  it('speaks every block in order, interrupting only for the first', () => {
    const { briefer, speech } = setup()
    briefer.readAll()
    expect(speech.speak.mock.calls).toEqual([
      [{ text: 'One', rate: 1, kind: 'reading' }, { interrupt: true }],
      [{ text: 'Two', rate: 1, kind: 'reading' }, { interrupt: false }],
      [{ text: 'Three', rate: 1, kind: 'reading' }, { interrupt: false }],
    ])
  })

  it('mutes hover while reading and restores it when the last block ends', async () => {
    const { briefer, hover, resolvers } = setup()
    briefer.readAll()
    expect(hover.setMuted).toHaveBeenCalledWith(true)
    resolvers.forEach((resolve) => resolve())
    await vi.waitFor(() => expect(hover.setMuted).toHaveBeenLastCalledWith(false))
  })

  it('reads from a given element when asked, for example the navigation cursor', () => {
    const { briefer, readTexts } = setup()
    const from = document.createElement('h2')
    briefer.readAll(from)
    expect(readTexts).toHaveBeenCalledWith(from)
    briefer.readAll()
    expect(readTexts).toHaveBeenLastCalledWith(null)
  })

  it('says so when there is nothing to read', () => {
    const { briefer, speech, hover } = setup({ texts: [] })
    briefer.readAll()
    expect(speech.speak).toHaveBeenCalledWith(
      { text: 'Nothing to read on this page.', rate: 1 },
      { interrupt: true },
    )
    expect(hover.setMuted).not.toHaveBeenCalled()
  })
})

describe('Briefer.stop', () => {
  it('cancels speech and closes the prompt', () => {
    const { briefer, speech } = setup()
    briefer.brief()
    briefer.stop()
    expect(speech.cancel).toHaveBeenCalled()
    expect(briefer.handleKey('y')).toBe(false)
  })
})
