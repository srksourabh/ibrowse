import { beforeEach, describe, expect, it } from 'vitest'
import { findAnything, findControl, isRisky, type ControlMatch } from '../../src/voice/find'

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
      <button id="continue">Continue</button>
      <button id="delete">Delete account</button>
    </main>`
})

const one = (match: ControlMatch): string | null => (match.kind === 'one' ? match.element.id : null)

describe('findControl', () => {
  it('prefers an exact name over one that only starts with it', () => {
    expect(one(findControl(document, 'sign in'))).toBe('signin')
  })

  it('ignores case, punctuation and extra spaces', () => {
    expect(one(findControl(document, '  Add to Basket! '))).toBe('buy')
  })

  it('takes a name that starts with the words said', () => {
    expect(one(findControl(document, 'contact'))).toBe('contact')
  })

  it('takes a name that contains the words said, as whole words', () => {
    expect(one(findControl(document, 'shop'))).toBe('q')
  })

  it('never matches part of a word, so "on" does not press "Continue"', () => {
    expect(findControl(document, 'on')).toEqual({ kind: 'none' })
    expect(findControl(document, 'tin')).toEqual({ kind: 'none' })
  })

  it('names the choices instead of guessing when several match equally well', () => {
    document.body.insertAdjacentHTML('beforeend', '<button>Delete photo</button>')
    expect(findControl(document, 'delete')).toEqual({ kind: 'several', names: ['Delete account', 'Delete photo'] })
  })

  it('says how many there are when several share the same name', () => {
    document.body.insertAdjacentHTML('beforeend', '<button>Add to basket</button>')
    expect(findControl(document, 'add to basket')).toEqual({ kind: 'several', names: ['Add to basket', 'Add to basket'] })
  })

  it('finds only controls, never paragraphs', () => {
    expect(findControl(document, 'past orders')).toEqual({ kind: 'none' })
  })

  it('skips hidden controls', () => {
    expect(findControl(document, 'secret')).toEqual({ kind: 'none' })
  })

  it('finds nothing for an empty name', () => {
    expect(findControl(document, '  ')).toEqual({ kind: 'none' })
  })
})

describe('isRisky', () => {
  it.each(['delete', 'signin-later'])('knows a control that cannot be taken back (%s)', (id) => {
    document.getElementById('signin-later')!.textContent = 'Place order'
    expect(isRisky(document.getElementById(id)!)).toBe(true)
  })

  it('goes by the name, so an everyday form button such as Search is not slowed down', () => {
    document.body.insertAdjacentHTML('beforeend', '<form><button id="go">Search</button><button id="send">Send message</button></form>')
    expect(isRisky(document.getElementById('go')!)).toBe(false)
    expect(isRisky(document.getElementById('send')!)).toBe(true)
  })

  it('does not count ordinary controls', () => {
    expect(isRisky(document.getElementById('contact')!)).toBe(false)
    expect(isRisky(document.getElementById('continue')!)).toBe(false)
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

  it('matches whole words here too', () => {
    expect(findAnything(document, 'mat')).toBeNull()
  })

  it('finds nothing when nothing matches', () => {
    expect(findAnything(document, 'giraffe')).toBeNull()
  })
})
