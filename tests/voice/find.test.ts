import { beforeEach, describe, expect, it } from 'vitest'
import { findControl, findAnything } from '../../src/voice/find'

beforeEach(() => {
  document.body.innerHTML = `
    <header><a id="home" href="/">Home</a><input id="q" type="search" aria-label="Search the shop"></header>
    <main>
      <h1 id="h">Tomatoes</h1>
      <p id="p">Sign in to see your basket and past orders.</p>
      <button id="signin-later">Sign in later</button>
      <button id="signin">Sign in</button>
      <button id="hidden" hidden>Secret</button>
      <a id="contact" href="/c">Contact us</a>
      <button id="buy" aria-label="Add to basket"><img alt=""></button>
    </main>`
})

describe('findControl', () => {
  it('prefers an exact name over one that only starts with it', () => {
    expect(findControl(document, 'sign in')?.id).toBe('signin')
  })

  it('ignores case, punctuation and extra spaces', () => {
    expect(findControl(document, '  Add to Basket! ')?.id).toBe('buy')
  })

  it('takes a name that starts with what was said', () => {
    expect(findControl(document, 'contact')?.id).toBe('contact')
  })

  it('takes a name that contains what was said, when nothing starts with it', () => {
    expect(findControl(document, 'shop')?.id).toBe('q')
  })

  it('finds only controls, never paragraphs', () => {
    expect(findControl(document, 'past orders')).toBeNull()
  })

  it('skips hidden controls', () => {
    expect(findControl(document, 'secret')).toBeNull()
  })

  it('finds nothing for an empty name', () => {
    expect(findControl(document, '  ')).toBeNull()
  })
})

describe('findAnything', () => {
  it('prefers a control', () => {
    expect(findAnything(document, 'sign in')?.id).toBe('signin')
  })

  it('then a heading', () => {
    expect(findAnything(document, 'tomatoes')?.id).toBe('h')
  })

  it('then text in a readable block', () => {
    expect(findAnything(document, 'past orders')?.id).toBe('p')
  })

  it('accepts a role word the user added, such as "search box" or "contact link"', () => {
    expect(findAnything(document, 'search box')?.id).toBe('q')
    expect(findAnything(document, 'contact link')?.id).toBe('contact')
  })

  it('finds nothing when nothing matches', () => {
    expect(findAnything(document, 'giraffe')).toBeNull()
  })
})
