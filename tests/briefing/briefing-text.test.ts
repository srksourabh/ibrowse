import { describe, expect, it } from 'vitest'
import { briefingText, viewportBriefing } from '../../src/briefing/briefing-text'
import type { LayoutModel } from '../../src/briefing/layout-model'

const EMPTY_COUNTS = { paragraphs: 0, headings: 0, links: 0, buttons: 0, inputs: 0, forms: 0, frames: 0 }

function model(overrides: Partial<LayoutModel> = {}): LayoutModel {
  return {
    title: 'Dashboard',
    kind: 'article',
    regions: [],
    media: [],
    counts: EMPTY_COUNTS,
    headings: [],
    ...overrides,
  }
}

describe('briefingText', () => {
  it('describes the page in the order picture, hero, navigation, sidebar, search, counts', () => {
    const { text, askToRead } = briefingText(
      model({
        media: [{ kind: 'picture', count: 1, placement: { horizontal: 'left', vertical: 'middle' } }],
        regions: [
          { kind: 'search', placement: { horizontal: 'right', vertical: 'top' } },
          { kind: 'hero', placement: { horizontal: 'center', vertical: 'top' } },
        ],
        counts: { ...EMPTY_COUNTS, paragraphs: 34, headings: 5, links: 12 },
      }),
    )
    expect(text).toBe(
      'Dashboard. Article page. Picture on the left, hero section at the top, search box top right, 34 paragraphs, 5 headings, 12 links. Want me to read it?',
    )
    expect(askToRead).toBe(true)
  })

  it('uses singular nouns for a count of one', () => {
    const { text } = briefingText(
      model({ counts: { ...EMPTY_COUNTS, paragraphs: 1, links: 1, buttons: 1, forms: 1 } }),
    )
    expect(text).toContain('1 paragraph, 1 link, 1 button, 1 form')
  })

  it('mentions embedded frames, whose content cannot always be read', () => {
    const { text } = briefingText(
      model({ counts: { ...EMPTY_COUNTS, paragraphs: 2, frames: 2 } }),
    )
    expect(text).toContain('2 paragraphs, 2 embedded frames')
  })

  it('names several pictures by count', () => {
    const { text } = briefingText(
      model({
        media: [{ kind: 'picture', count: 4, placement: null }],
        counts: { ...EMPTY_COUNTS, paragraphs: 2 },
      }),
    )
    expect(text).toContain('4 pictures')
  })

  it('calls an ordinary page a web page and a form page a form', () => {
    expect(briefingText(model({ kind: 'page', counts: { ...EMPTY_COUNTS, paragraphs: 1 } })).text).toContain(
      'Web page.',
    )
    expect(briefingText(model({ kind: 'form', counts: { ...EMPTY_COUNTS, forms: 1 } })).text).toContain(
      'Form page.',
    )
  })

  it('does not offer to read a page with no paragraphs or headings', () => {
    const { text, askToRead } = briefingText(
      model({ kind: 'page', counts: { ...EMPTY_COUNTS, links: 3 } }),
    )
    expect(askToRead).toBe(false)
    expect(text).not.toContain('Want me to read it?')
  })

  it('says so when there is nothing to read at all', () => {
    expect(briefingText(model({ kind: 'page' }))).toEqual({
      text: 'Dashboard. Nothing to read on this page.',
      askToRead: false,
    })
  })

  it('shortens a long title and names an untitled page', () => {
    const long = 'A'.repeat(100)
    expect(briefingText(model({ title: long })).text.startsWith(`${'A'.repeat(60)}.`)).toBe(true)
    expect(briefingText(model({ title: '' })).text.startsWith('Untitled page.')).toBe(true)
  })

  it('keeps the standard briefing to seven items', () => {
    const { text } = briefingText(
      model({
        media: [{ kind: 'picture', count: 1, placement: { horizontal: 'left', vertical: 'middle' } }],
        regions: [
          { kind: 'hero', placement: { horizontal: 'center', vertical: 'top' } },
          { kind: 'navigation', placement: { horizontal: 'center', vertical: 'top' } },
          { kind: 'sidebar', placement: { horizontal: 'right', vertical: 'middle' } },
          { kind: 'search', placement: { horizontal: 'right', vertical: 'top' } },
        ],
        counts: { paragraphs: 9, headings: 8, links: 7, buttons: 6, inputs: 0, forms: 2, frames: 0 },
      }),
    )
    const items = text.split('. ')[2]!.split(', ')
    expect(items).toHaveLength(7)
    expect(text).not.toContain('form')
  })

  it('adds the headings and drops the cap in the detailed briefing', () => {
    const { text } = briefingText(
      model({
        counts: { paragraphs: 9, headings: 2, links: 7, buttons: 6, inputs: 0, forms: 2, frames: 0 },
        headings: ['Intro', 'Pricing'],
        regions: [{ kind: 'hero', placement: { horizontal: 'center', vertical: 'top' } }],
        media: [{ kind: 'picture', count: 1, placement: { horizontal: 'left', vertical: 'middle' } }],
      }),
      { detailed: true },
    )
    expect(text).toContain('2 forms')
    expect(text).toContain('Headings: Intro; Pricing.')
  })
})

describe('viewportBriefing', () => {
  it('lists only what is on screen, without title or page kind', () => {
    expect(
      viewportBriefing(
        model({
          media: [{ kind: 'picture', count: 1, placement: { horizontal: 'right', vertical: 'middle' } }],
          counts: { ...EMPTY_COUNTS, paragraphs: 6, links: 2 },
        }),
      ),
    ).toBe('Picture on the right, 6 paragraphs, 2 links.')
  })

  it('returns an empty string for an empty screen', () => {
    expect(viewportBriefing(model())).toBe('')
  })
})
