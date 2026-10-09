import { beforeEach, describe, expect, it } from 'vitest'
import { analyzePage } from '../../src/briefing/layout-model'
import type { Rect } from '../../src/briefing/placement'

const VIEWPORT = { width: 1000, height: 800 }
const ZERO: Rect = { left: 0, top: 0, width: 0, height: 0 }

const PAGE = `
  <header><nav id="nav"><a href="/a">A</a><a href="/b">B</a></nav></header>
  <section id="hero"><h1>Welcome</h1><img id="pic" src="a.png" alt="Hero picture"><a href="/go">Go</a></section>
  <main>
    <h2>Intro</h2><h2>Pricing</h2>
    <p>One</p><p>Two</p><p>Three</p><p>Four</p><p>Five</p><p>Six</p>
    <p aria-hidden="true">Hidden</p>
    <button>Buy</button>
  </main>
  <aside id="side"><a href="/c">C</a></aside>
  <form><input id="search" type="search" aria-label="Search"></form>`

const RECTS: Record<string, Rect> = {
  nav: { left: 0, top: 0, width: 1000, height: 60 },
  hero: { left: 0, top: 60, width: 1000, height: 400 },
  pic: { left: 50, top: 250, width: 300, height: 300 },
  side: { left: 800, top: 500, width: 200, height: 300 },
  search: { left: 800, top: 10, width: 180, height: 30 },
}

const rectOf = (el: Element): Rect => RECTS[el.id] ?? ZERO

beforeEach(() => {
  document.title = 'Garden Journal'
  document.body.innerHTML = PAGE
})

describe('analyzePage', () => {
  it('reports the title and counts visible content', () => {
    const model = analyzePage(document, { rectOf, viewport: VIEWPORT })
    expect(model.title).toBe('Garden Journal')
    expect(model.counts).toMatchObject({
      paragraphs: 6,
      headings: 3,
      links: 4,
      buttons: 1,
      forms: 1,
    })
  })

  it('counts visible frames', () => {
    document.body.innerHTML = '<iframe src="/a"></iframe><iframe src="/b" hidden></iframe><p>x</p>'
    expect(analyzePage(document, { rectOf, viewport: VIEWPORT }).counts.frames).toBe(1)
  })

  it('classifies a page with many paragraphs as an article', () => {
    expect(analyzePage(document, { rectOf, viewport: VIEWPORT }).kind).toBe('article')
  })

  it('classifies a page with a form and little prose as a form', () => {
    document.body.innerHTML =
      '<form><input aria-label="a"><input aria-label="b"><input aria-label="c"></form><p>Hi</p>'
    expect(analyzePage(document, { rectOf, viewport: VIEWPORT }).kind).toBe('form')
  })

  it('classifies anything else as an ordinary page', () => {
    document.body.innerHTML = '<p>Short</p>'
    expect(analyzePage(document, { rectOf, viewport: VIEWPORT }).kind).toBe('page')
  })

  it('falls back to the first h1 when the document has no title', () => {
    document.title = ''
    expect(analyzePage(document, { rectOf, viewport: VIEWPORT }).title).toBe('Welcome')
  })

  it('finds the navigation, sidebar and search regions with their placement', () => {
    const { regions } = analyzePage(document, { rectOf, viewport: VIEWPORT })
    expect(regions).toContainEqual({
      kind: 'navigation',
      placement: { horizontal: 'center', vertical: 'top' },
    })
    expect(regions).toContainEqual({
      kind: 'sidebar',
      placement: { horizontal: 'right', vertical: 'bottom' },
    })
    expect(regions).toContainEqual({
      kind: 'search',
      placement: { horizontal: 'right', vertical: 'top' },
    })
  })

  it('finds a hero: a large block near the top with a heading and an image', () => {
    const { regions } = analyzePage(document, { rectOf, viewport: VIEWPORT })
    expect(regions).toContainEqual({
      kind: 'hero',
      placement: { horizontal: 'center', vertical: 'top' },
    })
  })

  it('does not call a small block a hero', () => {
    const small: Record<string, Rect> = { ...RECTS, hero: { left: 0, top: 60, width: 300, height: 80 } }
    const { regions } = analyzePage(document, {
      rectOf: (el) => small[el.id] ?? ZERO,
      viewport: VIEWPORT,
    })
    expect(regions.some((r) => r.kind === 'hero')).toBe(false)
  })

  it('reports a single picture with its placement', () => {
    const { media } = analyzePage(document, { rectOf, viewport: VIEWPORT })
    expect(media).toEqual([
      { kind: 'picture', count: 1, placement: { horizontal: 'left', vertical: 'middle' } },
    ])
  })

  it('reports several pictures as a count without a placement', () => {
    document.body.innerHTML = '<img src="a.png" alt="a"><img src="b.png" alt="b"><img src="c.png" alt="c">'
    expect(analyzePage(document, { rectOf, viewport: VIEWPORT }).media).toEqual([
      { kind: 'picture', count: 3, placement: null },
    ])
  })

  it('ignores decorative images', () => {
    document.body.innerHTML = '<img src="a.png" alt="">'
    expect(analyzePage(document, { rectOf, viewport: VIEWPORT }).media).toEqual([])
  })

  it('lists the first headings by text', () => {
    expect(analyzePage(document, { rectOf, viewport: VIEWPORT }).headings).toEqual([
      'Welcome',
      'Intro',
      'Pricing',
    ])
  })

  it('in viewport scope counts only what is on screen', () => {
    document.body.innerHTML = '<p id="a">on</p><p id="b">on</p><p id="c">off</p>'
    const rects: Record<string, Rect> = {
      a: { left: 0, top: 100, width: 100, height: 20 },
      b: { left: 0, top: 700, width: 100, height: 20 },
      c: { left: 0, top: 2000, width: 100, height: 20 },
    }
    const env = { rectOf: (el: Element) => rects[el.id] ?? ZERO, viewport: VIEWPORT }
    expect(analyzePage(document, env).counts.paragraphs).toBe(3)
    expect(analyzePage(document, { ...env, scope: 'viewport' }).counts.paragraphs).toBe(2)
  })
})
