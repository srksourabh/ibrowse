import { beforeEach, describe, expect, it } from 'vitest'
import {
  adjacentBlock,
  blockText,
  mainContent,
  readableBlocks,
  scrubBlockAt,
} from '../../src/reading/blocks'

const $ = (selector: string): Element => document.querySelector(selector)!
const stackOf = (el: Element): Element[] => {
  const chain: Element[] = []
  for (let node: Element | null = el; node; node = node.parentElement) chain.push(node)
  return chain
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('readableBlocks', () => {
  it('returns headings, paragraphs and list items in document order', () => {
    document.body.innerHTML = '<h1>Title</h1><p>One</p><ul><li>Item</li></ul><p>Two</p>'
    expect(readableBlocks(document.body).map((b) => b.textContent)).toEqual([
      'Title',
      'One',
      'Item',
      'Two',
    ])
  })

  it('skips hidden, empty and whitespace-only blocks', () => {
    document.body.innerHTML =
      '<p>Keep</p><p hidden>Hidden</p><div aria-hidden="true"><p>Also hidden</p></div><p>  </p>'
    expect(readableBlocks(document.body).map((b) => b.textContent)).toEqual(['Keep'])
  })

  it('reads the inner block, not its container, so nothing is spoken twice', () => {
    document.body.innerHTML = '<ul><li><p>Inner</p></li></ul>'
    expect(readableBlocks(document.body).map((b) => b.textContent)).toEqual(['Inner'])
  })
})

describe('mainContent', () => {
  it('prefers main, then article, then the body', () => {
    document.body.innerHTML = '<article id="a"></article><main id="m"></main>'
    expect(mainContent(document)).toBe($('#m'))
    document.body.innerHTML = '<article id="a"></article>'
    expect(mainContent(document)).toBe($('#a'))
    document.body.innerHTML = '<p>x</p>'
    expect(mainContent(document)).toBe(document.body)
  })
})

describe('blockText', () => {
  it('collapses whitespace', () => {
    document.body.innerHTML = '<p id="p">  Hello\n   there \t world  </p>'
    expect(blockText($('#p'))).toBe('Hello there world')
  })
})

describe('adjacentBlock', () => {
  it('finds the next and previous readable block, and null at the ends', () => {
    document.body.innerHTML = '<p id="a">A</p><div>skip</div><p id="b">B</p>'
    expect(adjacentBlock($('#a'), 1, document)).toBe($('#b'))
    expect(adjacentBlock($('#b'), -1, document)).toBe($('#a'))
    expect(adjacentBlock($('#a'), -1, document)).toBeNull()
    expect(adjacentBlock($('#b'), 1, document)).toBeNull()
  })

  it('returns null for an element that is not a readable block', () => {
    document.body.innerHTML = '<div id="d">x</div><p>y</p>'
    expect(adjacentBlock($('#d'), 1, document)).toBeNull()
  })
})

describe('scrubBlockAt', () => {
  it('finds the paragraph when the pointer is on a link inside it', () => {
    document.body.innerHTML = '<p id="p">See <a id="a" href="/x">this link</a> now</p>'
    expect(scrubBlockAt(0, 0, () => stackOf($('#a')))).toBe($('#p'))
  })

  it('finds nothing on a button or form control', () => {
    document.body.innerHTML = '<button id="b">Buy</button><input id="i" aria-label="Name">'
    expect(scrubBlockAt(0, 0, () => stackOf($('#b')))).toBeNull()
    expect(scrubBlockAt(0, 0, () => stackOf($('#i')))).toBeNull()
  })

  it('finds nothing over empty space or hidden content', () => {
    document.body.innerHTML = '<div id="d"><p>text</p></div><p id="h" hidden>x</p>'
    expect(scrubBlockAt(0, 0, () => [$('#d'), document.body])).toBeNull()
    expect(scrubBlockAt(0, 0, () => stackOf($('#h')))).toBeNull()
    expect(scrubBlockAt(0, 0, () => [])).toBeNull()
  })

  it('accepts loose text in a plain element', () => {
    document.body.innerHTML = '<div id="d">Loose words</div>'
    expect(scrubBlockAt(0, 0, () => stackOf($('#d')))).toBe($('#d'))
  })
})
