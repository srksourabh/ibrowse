import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_EXCERPT_CHARS, collectPagePayload, imageTargetFor } from '../../src/ai/page-excerpt'

beforeEach(() => {
  document.title = 'Garden Journal'
  document.body.innerHTML = ''
})

describe('collectPagePayload', () => {
  it('gives the title, the headings and the text of the main content', () => {
    document.body.innerHTML = `
      <nav><p>Menu text</p></nav>
      <main><h1>Welcome</h1><p>Roses need sun.</p><h2>Care</h2><p>Water them weekly.</p></main>`
    const payload = collectPagePayload(document)
    expect(payload.title).toBe('Garden Journal')
    expect(payload.headings).toEqual(['Welcome', 'Care'])
    expect(payload.excerpt).toBe('Welcome Roses need sun. Care Water them weekly.')
  })

  it('never includes form values, passwords, scripts or hidden text', () => {
    document.body.innerHTML = `
      <main>
        <p>Visible words.</p>
        <p hidden>Hidden words.</p>
        <input type="password" value="hunter2">
        <input type="text" value="my private note">
        <textarea>draft message</textarea>
        <script>var secret = 'token'</script>
        <style>p { color: red }</style>
      </main>`
    const { excerpt } = collectPagePayload(document)
    expect(excerpt).toBe('Visible words.')
    for (const secret of ['hunter2', 'private note', 'draft message', 'token', 'Hidden']) {
      expect(excerpt).not.toContain(secret)
    }
  })

  it('falls back to the whole page when there is no main content', () => {
    document.body.innerHTML = '<p>Only paragraph.</p>'
    expect(collectPagePayload(document).excerpt).toBe('Only paragraph.')
  })

  it('cuts a long page at a word boundary, within the limit', () => {
    document.body.innerHTML = `<main><p>${'word '.repeat(5000)}</p></main>`
    const { excerpt } = collectPagePayload(document)
    expect(excerpt.length).toBeLessThanOrEqual(MAX_EXCERPT_CHARS)
    expect(excerpt.endsWith(' ')).toBe(false)
  })

  it('lists at most ten headings', () => {
    document.body.innerHTML = `<main>${Array.from({ length: 15 }, (_, i) => `<h2>H${i}</h2>`).join('')}</main>`
    expect(collectPagePayload(document).headings).toHaveLength(10)
  })

  it('has an empty excerpt for an empty page', () => {
    expect(collectPagePayload(document)).toEqual({ title: 'Garden Journal', headings: [], excerpt: '' })
  })
})

describe('imageTargetFor', () => {
  it('finds the address and alt text of an image', () => {
    document.body.innerHTML = '<img id="i" src="/kite.png" alt="A kite">'
    expect(imageTargetFor(document.querySelector('#i')!)).toMatchObject({
      url: 'http://localhost:3000/kite.png',
      alt: 'A kite',
    })
  })

  it('finds the image inside a link or button that is hovered', () => {
    document.body.innerHTML = '<a id="a" href="/x"><img src="/kite.png" alt=""></a>'
    expect(imageTargetFor(document.querySelector('#a')!)?.url).toBe('http://localhost:3000/kite.png')
  })

  it('uses the caption of a figure as context', () => {
    document.body.innerHTML = '<figure><img id="i" src="/k.png"><figcaption>Kites at dawn</figcaption></figure>'
    expect(imageTargetFor(document.querySelector('#i')!)?.context).toBe('Kites at dawn')
  })

  it('finds the image from a figure that was hovered', () => {
    document.body.innerHTML = '<figure id="f"><img src="/k.png" alt="x"><figcaption>c</figcaption></figure>'
    expect(imageTargetFor(document.querySelector('#f')!)?.url).toBe('http://localhost:3000/k.png')
  })

  it('has nothing for an element with no image', () => {
    document.body.innerHTML = '<p id="p">Just text</p>'
    expect(imageTargetFor(document.querySelector('#p')!)).toBeNull()
  })

  it('has nothing for an image with no address', () => {
    document.body.innerHTML = '<img id="i" alt="x">'
    expect(imageTargetFor(document.querySelector('#i')!)).toBeNull()
  })
})
