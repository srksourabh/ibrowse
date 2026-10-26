import { describe, expect, it, vi } from 'vitest'
import { PageNavigator } from '../../src/navigation/page-navigator'
import type { PaginationTarget } from '../../src/navigation/pagination'

const LINK: PaginationTarget = { href: 'http://localhost:3000/2', element: null }

function setup(options: { y?: number; maxY?: number; link?: PaginationTarget | null; brief?: string } = {}) {
  let y = options.y ?? 0
  const maxY = options.maxY ?? 2000
  const speech = { speak: vi.fn(async () => 'finished' as const) }
  const earcons = { play: vi.fn() }
  const willNavigate = vi.fn()
  const activate = vi.fn()
  const navigator = new PageNavigator({
    scroll: {
      y: () => y,
      maxY: () => maxY,
      viewportHeight: () => 800,
      by: (dy) => {
        y = Math.min(maxY, Math.max(0, y + dy))
      },
    },
    findLink: () => (options.link === undefined ? null : options.link),
    activate,
    willNavigate,
    briefViewport: () => options.brief ?? '',
    speech,
    earcons,
    getRate: () => 1,
  })
  return { navigator, speech, earcons, willNavigate, activate, scrollY: () => y }
}

describe('PageNavigator.go', () => {
  it('follows a pagination link, noting the navigation so Explore Mode resumes', () => {
    const { navigator, speech, willNavigate, activate } = setup({ link: LINK })
    expect(navigator.go('next')).toBe('navigated')
    expect(speech.speak).toHaveBeenCalledWith({ text: 'Going to next page', rate: 1 })
    expect(willNavigate).toHaveBeenCalledOnce()
    expect(activate).toHaveBeenCalledWith(LINK)
  })

  it('says "previous page" going back', () => {
    const { navigator, speech } = setup({ link: LINK })
    navigator.go('prev')
    expect(speech.speak).toHaveBeenCalledWith({ text: 'Going to previous page', rate: 1 })
  })

  it('scrolls nine tenths of a screen when there is no pagination, then briefs what is new', () => {
    const { navigator, speech, scrollY } = setup({ brief: 'Picture on the right, 6 paragraphs.' })
    expect(navigator.go('next')).toBe('scrolled')
    expect(scrollY()).toBe(720)
    expect(speech.speak).toHaveBeenCalledWith({
      text: 'Scrolled down. Picture on the right, 6 paragraphs.',
      rate: 1,
    })
  })

  it('scrolls up for the previous page', () => {
    const { navigator, speech, scrollY } = setup({ y: 1000 })
    navigator.go('prev')
    expect(scrollY()).toBe(280)
    expect(speech.speak).toHaveBeenCalledWith({ text: 'Scrolled up.', rate: 1 })
  })

  it('reports the end of the page with a boundary cue when it cannot go further', () => {
    const { navigator, speech, earcons, scrollY } = setup({ y: 2000 })
    expect(navigator.go('next')).toBe('edge')
    expect(scrollY()).toBe(2000)
    expect(earcons.play).toHaveBeenCalledWith('boundary', 0)
    expect(speech.speak).toHaveBeenCalledWith({ text: 'End of page', rate: 1 })
  })

  it('reports the top of the page going back from the top', () => {
    const { navigator, speech } = setup({ y: 0 })
    expect(navigator.go('prev')).toBe('edge')
    expect(speech.speak).toHaveBeenCalledWith({ text: 'Top of page', rate: 1 })
  })
})

describe('PageNavigator.scrollBy', () => {
  it('scrolls without comment in the middle of the page', () => {
    const { navigator, speech, scrollY } = setup({ y: 500 })
    navigator.scrollBy(100)
    expect(scrollY()).toBe(600)
    expect(speech.speak).not.toHaveBeenCalled()
  })

  it('announces the end of the page, and that a next page exists', () => {
    const { navigator, speech, earcons } = setup({ y: 1950, link: LINK })
    navigator.scrollBy(100)
    expect(earcons.play).toHaveBeenCalledWith('boundary', 0)
    expect(speech.speak).toHaveBeenCalledWith({
      text: 'End of page. Next page is available.',
      rate: 1,
    })
  })

  it('announces a plain end of page when there is no next page', () => {
    const { navigator, speech } = setup({ y: 1950 })
    navigator.scrollBy(100)
    expect(speech.speak).toHaveBeenCalledWith({ text: 'End of page', rate: 1 })
  })

  it('announces the top of the page when scrolling up to it', () => {
    const { navigator, speech } = setup({ y: 50 })
    navigator.scrollBy(-100)
    expect(speech.speak).toHaveBeenCalledWith({ text: 'Top of page', rate: 1 })
  })
})

describe('PageNavigator.scrollScreen', () => {
  it('scrolls a screen down even when there is a next-page link, then briefs what is new', () => {
    const { navigator, speech, scrollY, activate } = setup({ link: LINK, brief: '2 paragraphs.' })
    expect(navigator.scrollScreen('down')).toBe('scrolled')
    expect(scrollY()).toBe(720)
    expect(activate).not.toHaveBeenCalled()
    expect(speech.speak).toHaveBeenCalledWith({ text: 'Scrolled down. 2 paragraphs.', rate: 1 })
  })

  it('reports the top of the page instead of scrolling up past it', () => {
    const { navigator, speech, earcons } = setup({ y: 0 })
    expect(navigator.scrollScreen('up')).toBe('edge')
    expect(earcons.play).toHaveBeenCalledWith('boundary', 0)
    expect(speech.speak).toHaveBeenCalledWith({ text: 'Top of page', rate: 1 })
  })
})

describe('PageNavigator.scrollToEdge', () => {
  it('goes to the top and says so', () => {
    const { navigator, speech, scrollY } = setup({ y: 900, brief: 'Header.' })
    navigator.scrollToEdge('top')
    expect(scrollY()).toBe(0)
    expect(speech.speak).toHaveBeenCalledWith({ text: 'Top of page. Header.', rate: 1 })
  })

  it('goes to the bottom and says whether a next page is available', () => {
    const { navigator, speech, scrollY } = setup({ y: 0, link: LINK })
    navigator.scrollToEdge('bottom')
    expect(scrollY()).toBe(2000)
    expect(speech.speak).toHaveBeenCalledWith({ text: 'End of page. Next page is available.', rate: 1 })
  })
})
