import { beforeEach, describe, expect, it } from 'vitest'
import { findPaginationTarget } from '../../src/navigation/pagination'

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('findPaginationTarget', () => {
  it('finds an anchor with rel="next"', () => {
    document.body.innerHTML = '<a id="n" rel="next" href="/page/2">More</a>'
    const target = findPaginationTarget(document, 'next')
    expect(target?.href).toBe('http://localhost:3000/page/2')
    expect(target?.element).toBe(document.getElementById('n'))
  })

  it('finds a <link rel="next"> in the head, which has no element to click', () => {
    document.head.innerHTML = '<link rel="next" href="/page/2">'
    const target = findPaginationTarget(document, 'next')
    expect(target?.href).toBe('http://localhost:3000/page/2')
    expect(target?.element).toBeNull()
  })

  it('finds links by their visible text, aria-label or symbol', () => {
    for (const markup of [
      '<a href="/2">Next</a>',
      '<a href="/2">Next page</a>',
      '<a href="/2">Next ›</a>',
      '<a href="/2">›</a>',
      '<a href="/2">»</a>',
      '<a href="/2" aria-label="Next page">→</a>',
      '<a href="/2">Older posts</a>',
    ]) {
      document.body.innerHTML = markup
      expect(findPaginationTarget(document, 'next'), markup).not.toBeNull()
    }
  })

  it('finds the previous page the same way', () => {
    for (const markup of [
      '<a rel="prev" href="/0">x</a>',
      '<a href="/0">Previous</a>',
      '<a href="/0">‹ Prev</a>',
      '<a href="/0">Newer posts</a>',
    ]) {
      document.body.innerHTML = markup
      expect(findPaginationTarget(document, 'prev'), markup).not.toBeNull()
    }
  })

  it('does not mistake a next link for a previous one, or the reverse', () => {
    document.body.innerHTML = '<a href="/2">Next</a>'
    expect(findPaginationTarget(document, 'prev')).toBeNull()
    document.body.innerHTML = '<a href="/0">Previous</a>'
    expect(findPaginationTarget(document, 'next')).toBeNull()
  })

  it('ignores text that merely contains the word next', () => {
    document.body.innerHTML = '<a href="/x">Next steps for your garden</a>'
    expect(findPaginationTarget(document, 'next')).toBeNull()
  })

  it('refuses links that are not http or https', () => {
    document.body.innerHTML = '<a rel="next" href="javascript:alert(1)">Next</a>'
    expect(findPaginationTarget(document, 'next')).toBeNull()
  })

  it('ignores hidden links and returns null when there is none', () => {
    document.body.innerHTML = '<a rel="next" href="/2" hidden>Next</a>'
    expect(findPaginationTarget(document, 'next')).toBeNull()
    document.body.innerHTML = '<p>No links</p>'
    expect(findPaginationTarget(document, 'next')).toBeNull()
  })
})
