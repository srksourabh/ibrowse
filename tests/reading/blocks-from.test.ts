import { beforeEach, describe, expect, it } from 'vitest'
import { blocksFrom, readableBlocks } from '../../src/reading/blocks'

const $ = (selector: string): Element => document.querySelector(selector)!

beforeEach(() => {
  document.body.innerHTML =
    '<h1 id="h">Title</h1><p id="a">A</p><section id="s"><h2 id="h2">Sub</h2><p id="b">B</p></section><p id="c">C</p>'
})

describe('blocksFrom', () => {
  it('returns every block when there is no starting point', () => {
    const blocks = readableBlocks(document.body)
    expect(blocksFrom(blocks, null)).toEqual(blocks)
  })

  it('starts at the given block, inclusive', () => {
    const ids = blocksFrom(readableBlocks(document.body), $('#a')).map((b) => b.id)
    expect(ids).toEqual(['a', 'h2', 'b', 'c'])
  })

  it('starts at the first block inside a container such as a landmark', () => {
    const ids = blocksFrom(readableBlocks(document.body), $('#s')).map((b) => b.id)
    expect(ids).toEqual(['h2', 'b', 'c'])
  })

  it('returns nothing when the starting point is after every block', () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="end"></div>')
    expect(blocksFrom(readableBlocks(document.body), $('#end'))).toEqual([])
  })
})
