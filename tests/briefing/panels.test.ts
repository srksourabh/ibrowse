import { beforeEach, describe, expect, it } from 'vitest'
import { findPanels } from '../../src/briefing/panels'
import type { Rect } from '../../src/briefing/placement'

const VIEWPORT = { width: 1200, height: 800 }
const ZERO: Rect = { left: 0, top: 0, width: 0, height: 0 }

let rects: Record<string, Rect> = {}
const env = () => ({ rectOf: (el: Element): Rect => rects[el.id] ?? ZERO, viewport: VIEWPORT })
const kinds = () => findPanels(document, env()).map((panel) => panel.kind)

const TOP = { left: 0, top: 0, width: 1200, height: 80 }
const LEFT = { left: 0, top: 80, width: 250, height: 900 }
const MIDDLE = { left: 250, top: 80, width: 700, height: 900 }
const RIGHT = { left: 950, top: 80, width: 250, height: 900 }
const BOTTOM = { left: 0, top: 980, width: 1200, height: 120 }

beforeEach(() => {
  document.body.innerHTML = ''
  rects = {}
})

describe('findPanels on a page with landmarks', () => {
  const PAGE = `
    <header id="h">
      <a href="/" id="home"><img src="logo.png" alt="Garden Shop"></a>
      <nav aria-label="Top menu"><a href="/a">A</a><a href="/b">B</a></nav>
      <form role="search"><input type="search" aria-label="Search"></form>
    </header>
    <nav id="l" aria-label="Categories"><a href="/1">1</a><a href="/2">2</a><a href="/3">3</a></nav>
    <main id="m">
      <article><header><h2>Not the page header</h2></header><h1>Tomatoes</h1><p>One</p><p>Two</p></article>
      <button>Add to basket</button>
    </main>
    <aside id="r"><h2>Offers</h2><a href="/x">X</a></aside>
    <footer id="f"><a href="/c">Contact</a><a href="/p">Privacy</a></footer>`

  beforeEach(() => {
    document.body.innerHTML = PAGE
    rects = { h: TOP, l: LEFT, m: MIDDLE, r: RIGHT, f: BOTTOM }
  })

  it('finds the header, both side panels, the main content and the footer, in reading order', () => {
    expect(kinds()).toEqual(['header', 'left', 'main', 'right', 'footer'])
  })

  it('counts what each panel holds', () => {
    const [header, left, main, right, footer] = findPanels(document, env())
    expect(header!.contents).toMatchObject({ links: 3, logo: true, search: true, images: 0, inputs: 0 }) // the search box is not also a field
    expect(left!.contents).toMatchObject({ links: 3, search: false })
    expect(left!.label).toBe('Categories')
    expect(main!.contents).toMatchObject({ paragraphs: 2, buttons: 1, firstHeading: 'Tomatoes' })
    expect(right!.contents).toMatchObject({ links: 1, headings: 1, firstHeading: 'Offers' })
    expect(footer!.contents).toMatchObject({ links: 2 })
  })

  it('takes a header inside an article as part of the article, not the page header', () => {
    document.querySelector('#h')!.remove()
    expect(kinds()).toEqual(['left', 'main', 'right', 'footer'])
  })

  it('places a side panel by where it sits beside the main content, not by its tag', () => {
    rects = { h: TOP, l: RIGHT, m: MIDDLE, r: LEFT, f: BOTTOM }
    const panels = findPanels(document, env())
    expect(panels.find((p) => p.kind === 'left')!.element.id).toBe('r')
    expect(panels.find((p) => p.kind === 'right')!.element.id).toBe('l')
  })

  it('leaves out hidden panels', () => {
    document.querySelector('#r')!.setAttribute('hidden', '')
    expect(kinds()).toEqual(['header', 'left', 'main', 'footer'])
  })
})

describe('findPanels on a page built from plain boxes', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="wrap">
        <div id="top"><a href="/">Home</a></div>
        <div id="cols">
          <div id="a"><a href="/1">1</a></div>
          <div id="b"><h1>Story</h1><p>Text</p></div>
          <div id="c"><p>Advert</p></div>
        </div>
        <div id="bottom"><p>Copyright</p></div>
      </div>`
    rects = {
      wrap: { left: 0, top: 0, width: 1200, height: 1100 },
      top: TOP,
      cols: { left: 0, top: 80, width: 1200, height: 900 },
      a: LEFT,
      b: MIDDLE,
      c: RIGHT,
      bottom: BOTTOM,
    }
  })

  it('finds the columns by geometry, and the full-width blocks above and below them', () => {
    const panels = findPanels(document, env())
    expect(panels.map((p) => [p.kind, p.element.id])).toEqual([
      ['header', 'top'],
      ['left', 'a'],
      ['main', 'b'],
      ['right', 'c'],
      ['footer', 'bottom'],
    ])
  })

  it('finds no header or footer when nothing full-width sits above or below the columns', () => {
    document.querySelector('#top')!.remove()
    document.querySelector('#bottom')!.remove()
    expect(kinds()).toEqual(['left', 'main', 'right'])
  })

  it('recognises a search box by its placeholder, and an ARIA heading by its level', () => {
    document.querySelector('#a')!.innerHTML =
      '<div role="heading" aria-level="3">Menu</div><div role="heading" aria-level="1">Shop</div><input placeholder="Search products">'
    const left = findPanels(document, env()).find((p) => p.kind === 'left')!
    expect(left.contents).toMatchObject({ search: true, inputs: 0, headings: 2, firstHeading: 'Shop' })
  })

  it('is not fooled by a menu bar of side-by-side links above the real columns', () => {
    document.body.innerHTML = `
      <div id="top"><ul id="menu"><li id="m1"><a href="/1">News</a></li><li id="m2"><a href="/2">Sport and weather today</a></li><li id="m3"><a href="/3">TV</a></li></ul></div>
      <div id="wrap"><div id="cols">
        <div id="a"><a href="/x">Links</a></div>
        <div id="b"><h1>Story</h1><p>Text of the story.</p></div>
        <div id="c"><p>Advert</p></div>
      </div></div>`
    rects = {
      wrap: { left: 0, top: 80, width: 1200, height: 900 },
      top: TOP,
      menu: TOP,
      m1: { left: 0, top: 0, width: 300, height: 80 },
      m2: { left: 300, top: 0, width: 600, height: 80 },
      m3: { left: 900, top: 0, width: 300, height: 80 },
      cols: { left: 0, top: 80, width: 1200, height: 900 },
      a: LEFT,
      b: MIDDLE,
      c: RIGHT,
    }
    expect(findPanels(document, env()).map((p) => [p.kind, p.element.id])).toEqual([
      ['header', 'top'],
      ['left', 'a'],
      ['main', 'b'],
      ['right', 'c'],
    ])
  })

  it('takes a page with a single column as main content only', () => {
    document.body.innerHTML = '<div id="only"><h1>Hello</h1><p>Text</p></div>'
    rects = { only: { left: 100, top: 0, width: 1000, height: 600 } }
    const panels = findPanels(document, env())
    expect(panels.map((p) => p.kind)).toEqual(['main'])
    expect(panels[0]!.contents).toMatchObject({ paragraphs: 1, firstHeading: 'Hello' })
  })
})

describe('findPanels on an empty page', () => {
  it('finds nothing', () => {
    expect(findPanels(document, env())).toEqual([])
  })
})

describe('findPanels: cost on a large page', () => {
  it('measures each element at most once', () => {
    document.body.innerHTML = `<div id="cols">${Array.from({ length: 50 }, (_, i) => `<div id="c${i}"><p>Text ${i}</p></div>`).join('')}</div>`
    const measured = new Map<Element, number>()
    const rectOf = (el: Element): Rect => {
      measured.set(el, (measured.get(el) ?? 0) + 1)
      return { left: 0, top: 0, width: 10, height: 10 }
    }
    findPanels(document, { rectOf, viewport: VIEWPORT })
    expect(Math.max(...measured.values())).toBe(1)
  })

  it('stops looking for columns after a few thousand elements', () => {
    const deep = Array.from({ length: 40 }, () => '<div>' + '<span>x</span>'.repeat(200) + '</div>').join('')
    document.body.innerHTML = `<div>${deep}</div>`
    let calls = 0
    findPanels(document, {
      rectOf: () => {
        calls++
        return ZERO
      },
      viewport: VIEWPORT,
    })
    expect(calls).toBeLessThanOrEqual(5000)
  })
})
