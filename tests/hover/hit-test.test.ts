import { beforeEach, describe, expect, it } from 'vitest'
import { deepElementsAt, hitTest, meaningfulTarget } from '../../src/hover/hit-test'

function setup(html: string): void {
  document.body.innerHTML = html
}
const $ = (selector: string): Element => document.querySelector(selector)!

/** Simulates elementsFromPoint: the element, then its ancestors, as a browser reports them. */
function stackOf(el: Element): Element[] {
  const chain: Element[] = []
  for (let node: Element | null = el; node; node = node.parentElement) chain.push(node)
  return chain
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('meaningfulTarget', () => {
  it('returns the control when the pointer is on a child of it', () => {
    setup('<button id="b"><span id="s">Buy now</span></button>')
    expect(meaningfulTarget($('#s'))).toBe($('#b'))
  })

  it('returns the whole paragraph when the pointer is on inline text inside it', () => {
    setup('<p id="p">Some <b id="b">bold</b> text</p>')
    expect(meaningfulTarget($('#b'))).toBe($('#p'))
  })

  it('returns images', () => {
    setup('<img id="i" src="a.png" alt="Kite">')
    expect(meaningfulTarget($('#i'))).toBe($('#i'))
  })

  it('returns nothing for an empty layout container', () => {
    setup('<div id="d"><p>Text elsewhere</p></div>')
    expect(meaningfulTarget($('#d'))).toBeNull()
  })

  it('returns nothing for hidden content', () => {
    setup('<div aria-hidden="true"><button id="b">Hidden</button></div>')
    expect(meaningfulTarget($('#b'))).toBeNull()
    setup('<p id="p" hidden>Hidden</p>')
    expect(meaningfulTarget($('#p'))).toBeNull()
  })

  it('does not treat a decorative image (empty alt) as content', () => {
    setup('<img id="i" src="a.png" alt="">')
    expect(meaningfulTarget($('#i'))).toBeNull()
  })

  it('returns an element that only has its own loose text', () => {
    setup('<div id="d">Loose text</div>')
    expect(meaningfulTarget($('#d'))).toBe($('#d'))
  })
})

describe('hitTest', () => {
  it('returns the meaningful target of the topmost non-empty element', () => {
    setup('<p id="p">Hello <b id="b">there</b></p>')
    expect(hitTest(0, 0, () => stackOf($('#b')))).toBe($('#p'))
  })

  it('looks through an empty decorative overlay to the content beneath', () => {
    setup('<div id="overlay"></div><button id="b">Beneath</button>')
    expect(hitTest(0, 0, () => [$('#overlay'), $('#b'), document.body])).toBe($('#b'))
  })

  it('returns null for empty space', () => {
    setup('<div id="d"><p>Text</p></div>')
    expect(hitTest(0, 0, () => [$('#d'), document.body, document.documentElement])).toBeNull()
  })

  it('returns null when nothing is at the point', () => {
    expect(hitTest(0, 0, () => [])).toBeNull()
  })
})

describe('deepElementsAt', () => {
  it('descends into open shadow roots, innermost elements first', () => {
    setup('<div id="host"></div>')
    const host = $('#host')
    const shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML = '<button id="inner">Inside</button>'
    const inner = shadow.querySelector('#inner')!
    ;(shadow as unknown as { elementsFromPoint: () => Element[] }).elementsFromPoint = () => [inner]
    const root = { elementsFromPoint: () => [host, document.body] } as unknown as Document

    expect(deepElementsAt(5, 5, root)).toEqual([inner, host, document.body])
  })

  it('works for pages with no shadow roots', () => {
    setup('<p id="p">x</p>')
    const root = { elementsFromPoint: () => [$('#p'), document.body] } as unknown as Document
    expect(deepElementsAt(1, 1, root)).toEqual([$('#p'), document.body])
  })
})
