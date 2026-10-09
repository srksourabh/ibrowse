import { describe, expect, it } from 'vitest'
import { WordScrubber } from '../../src/reading/scrubber'
import { spellWord, tokenize } from '../../src/reading/words'

describe('tokenize', () => {
  it('splits on whitespace and drops empties', () => {
    expect(tokenize('  one  two\nthree ')).toEqual(['one', 'two', 'three'])
    expect(tokenize('')).toEqual([])
  })
})

describe('spellWord', () => {
  it('separates letters so the voice says each one', () => {
    expect(spellWord('cat')).toBe('c, a, t')
  })

  it('drops trailing punctuation but keeps digits', () => {
    expect(spellWord('abc1.')).toBe('a, b, c, 1')
  })
})

function setup(blocks: Record<string, string>) {
  const elements = Object.keys(blocks).map((id) => {
    const el = document.createElement('p')
    el.id = id
    return el
  })
  const byId = new Map(elements.map((el) => [el.id, el]))
  const scrubber = new WordScrubber({
    textOf: (el) => blocks[el.id] ?? '',
    adjacentBlock: (el, direction) => {
      const index = elements.indexOf(el as HTMLParagraphElement) + direction
      return elements[index] ?? null
    },
  })
  return { scrubber, a: byId.get('a')!, b: byId.get('b')! }
}

describe('WordScrubber', () => {
  it('moves forward one word at a time from the first word', () => {
    const { scrubber, a } = setup({ a: 'one two three' })
    scrubber.start(a)
    expect(scrubber.step(1)).toMatchObject({ kind: 'word', word: 'one', changedBlock: false })
    expect(scrubber.step(1)).toMatchObject({ kind: 'word', word: 'two' })
    expect(scrubber.step(-1)).toMatchObject({ kind: 'word', word: 'one' })
  })

  it('stops at the end of the block first, then continues into the next on a second push', () => {
    const { scrubber, a, b } = setup({ a: 'one two', b: 'three four' })
    scrubber.start(a)
    scrubber.step(1)
    scrubber.step(1)
    expect(scrubber.step(1)).toEqual({ kind: 'boundary', edge: 'end' })
    expect(scrubber.step(1)).toMatchObject({ kind: 'word', word: 'three', changedBlock: true })
    expect(scrubber.block).toBe(b)
  })

  it('stops at the start of the block first, then continues into the previous on a second push', () => {
    const { scrubber, a, b } = setup({ a: 'one two', b: 'three four' })
    scrubber.start(b)
    scrubber.step(1)
    expect(scrubber.step(-1)).toEqual({ kind: 'boundary', edge: 'start' })
    expect(scrubber.step(-1)).toMatchObject({ kind: 'word', word: 'two', changedBlock: true })
    expect(scrubber.block).toBe(a)
  })

  it('keeps reporting the boundary when there is no further block', () => {
    const { scrubber, a } = setup({ a: 'only' })
    scrubber.start(a)
    scrubber.step(1)
    expect(scrubber.step(1)).toEqual({ kind: 'boundary', edge: 'end' })
    expect(scrubber.step(1)).toEqual({ kind: 'boundary', edge: 'end' })
  })

  it('treats the first push after moving normally as a fresh boundary', () => {
    const { scrubber, a } = setup({ a: 'one two' })
    scrubber.start(a)
    scrubber.step(1)
    scrubber.step(1)
    scrubber.step(1) // boundary
    scrubber.step(-1) // back to a word
    scrubber.step(1)
    expect(scrubber.step(1)).toEqual({ kind: 'boundary', edge: 'end' })
  })

  it('knows the current word and the rest of the block', () => {
    const { scrubber, a } = setup({ a: 'one two three' })
    scrubber.start(a)
    expect(scrubber.word).toBeNull()
    expect(scrubber.remainingText()).toBe('one two three')
    scrubber.step(1)
    scrubber.step(1)
    expect(scrubber.word).toBe('two')
    expect(scrubber.remainingText()).toBe('two three')
  })

  it('has no block until started', () => {
    const { scrubber } = setup({ a: 'x' })
    expect(scrubber.block).toBeNull()
    expect(scrubber.remainingText()).toBe('')
  })
})
