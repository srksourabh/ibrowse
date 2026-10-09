import { describe, expect, it } from 'vitest'
import { AudioCache } from '../../src/cloud/audio-cache'
import { splitForSpeech } from '../../src/cloud/speech-split'

describe('splitForSpeech', () => {
  it('leaves short text whole', () => {
    expect(splitForSpeech('Hello there.', 100)).toEqual(['Hello there.'])
  })

  it('gives nothing for empty or blank text', () => {
    expect(splitForSpeech('', 100)).toEqual([])
    expect(splitForSpeech('   \n ', 100)).toEqual([])
  })

  it('splits at sentence ends, keeping each chunk within the limit', () => {
    const text = 'One is here. Two is here. Three is here. Four is here.'
    const chunks = splitForSpeech(text, 30)
    expect(chunks.every((c) => c.length <= 30)).toBe(true)
    expect(chunks.join(' ')).toBe(text)
    expect(chunks.every((c) => /[.!?]$/.test(c))).toBe(true)
  })

  it('packs as many whole sentences into a chunk as fit', () => {
    expect(splitForSpeech('Aa. Bb. Cc. Dd.', 9)).toEqual(['Aa. Bb.', 'Cc. Dd.'])
  })

  it('splits a very long sentence at spaces', () => {
    const text = 'word '.repeat(60).trim()
    const chunks = splitForSpeech(text, 40)
    expect(chunks.every((c) => c.length <= 40)).toBe(true)
    expect(chunks.join(' ')).toBe(text)
  })

  it('hard-splits a single piece with no spaces at all', () => {
    const chunks = splitForSpeech('x'.repeat(95), 40)
    expect(chunks.map((c) => c.length)).toEqual([40, 40, 15])
  })

  it('treats runs of whitespace as one space', () => {
    expect(splitForSpeech('One.   Two.\n\nThree.', 100)).toEqual(['One. Two. Three.'])
  })
})

describe('AudioCache', () => {
  it('remembers a value by its key', () => {
    const cache = new AudioCache<string>(3)
    cache.set('a', '1')
    expect(cache.get('a')).toBe('1')
    expect(cache.get('missing')).toBeUndefined()
  })

  it('forgets the least recently used entry when full', () => {
    const cache = new AudioCache<string>(2)
    cache.set('a', '1')
    cache.set('b', '2')
    cache.get('a') // a is now the most recently used
    cache.set('c', '3')
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe('1')
    expect(cache.get('c')).toBe('3')
  })

  it('replaces a value stored again under the same key', () => {
    const cache = new AudioCache<string>(2)
    cache.set('a', '1')
    cache.set('a', '2')
    expect(cache.get('a')).toBe('2')
    expect(cache.size).toBe(1)
  })

  it('can be emptied', () => {
    const cache = new AudioCache<string>(2)
    cache.set('a', '1')
    cache.clear()
    expect(cache.size).toBe(0)
  })
})
