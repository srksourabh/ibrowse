import { beforeEach, describe, expect, it } from 'vitest'
import {
  describeTarget,
  headingTargets,
  landmarkTargets,
  nextInOrder,
} from '../../src/navigation/landmarks'

const $ = (selector: string): Element => document.querySelector(selector)!

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('headingTargets', () => {
  it('lists headings in document order, including ARIA headings', () => {
    document.body.innerHTML =
      '<h1 id="a">A</h1><p>x</p><div role="heading" aria-level="2" id="b">B</div><h3 id="c">C</h3>'
    expect(headingTargets(document).map((h) => h.id)).toEqual(['a', 'b', 'c'])
  })

  it('skips hidden headings', () => {
    document.body.innerHTML = '<h2 id="a">A</h2><h2 hidden>B</h2><div aria-hidden="true"><h2>C</h2></div>'
    expect(headingTargets(document).map((h) => h.id)).toEqual(['a'])
  })
})

describe('landmarkTargets', () => {
  it('finds the standard landmarks, native and ARIA, in document order', () => {
    document.body.innerHTML = `
      <header id="banner"></header>
      <nav id="nav"></nav>
      <main id="main"><section aria-label="Offers" id="region"></section></main>
      <aside id="side"></aside>
      <div role="search" id="search"></div>
      <footer id="foot"></footer>`
    expect(landmarkTargets(document).map((l) => l.id)).toEqual([
      'banner',
      'nav',
      'main',
      'region',
      'side',
      'search',
      'foot',
    ])
  })

  it('ignores a section with no name, and headers nested inside articles', () => {
    document.body.innerHTML = '<section id="s"></section><article><header id="h"></header></article>'
    expect(landmarkTargets(document)).toEqual([])
  })
})

describe('nextInOrder', () => {
  beforeEach(() => {
    document.body.innerHTML = '<h2 id="a">A</h2><p id="p">x</p><h2 id="b">B</h2><h2 id="c">C</h2>'
  })
  const targets = () => headingTargets(document)

  it('goes to the first target from nowhere, and the last when going back', () => {
    expect(nextInOrder(targets(), null, 1)?.id).toBe('a')
    expect(nextInOrder(targets(), null, -1)?.id).toBe('c')
  })

  it('moves to the next and previous target from a heading', () => {
    expect(nextInOrder(targets(), $('#a'), 1)?.id).toBe('b')
    expect(nextInOrder(targets(), $('#c'), -1)?.id).toBe('b')
  })

  it('works from an element that is not itself a target', () => {
    expect(nextInOrder(targets(), $('#p'), 1)?.id).toBe('b')
    expect(nextInOrder(targets(), $('#p'), -1)?.id).toBe('a')
  })

  it('returns null at either end', () => {
    expect(nextInOrder(targets(), $('#c'), 1)).toBeNull()
    expect(nextInOrder(targets(), $('#a'), -1)).toBeNull()
  })

  it('counts a landmark that contains the cursor as behind it, and one inside it as ahead', () => {
    document.body.innerHTML = '<main id="m"><h2 id="h">H</h2></main>'
    expect(nextInOrder(headingTargets(document), $('#m'), 1)?.id).toBe('h')
    expect(nextInOrder(landmarkTargets(document), $('#h'), -1)?.id).toBe('m')
  })
})

describe('describeTarget', () => {
  it('speaks a heading with its level', () => {
    document.body.innerHTML = '<h2 id="h">Pricing</h2>'
    expect(describeTarget($('#h'), 'heading')).toBe('Pricing — Heading level 2, Text only')
  })

  it('speaks a landmark by role, with its name when it has one', () => {
    document.body.innerHTML =
      '<nav id="n" aria-label="Main menu"></nav><main id="m"></main><aside id="a"></aside><footer id="f"></footer>'
    expect(describeTarget($('#n'), 'landmark')).toBe('Main menu — Navigation landmark')
    expect(describeTarget($('#m'), 'landmark')).toBe('Main landmark')
    expect(describeTarget($('#a'), 'landmark')).toBe('Sidebar landmark')
    expect(describeTarget($('#f'), 'landmark')).toBe('Footer landmark')
  })
})
