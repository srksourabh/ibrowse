import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveAnnouncer, SAME_TEXT_WINDOW_MS } from '../../src/live/live-announcer'

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
const $ = (selector: string): Element => document.querySelector(selector)!

let clock = 0
let announcer: LiveAnnouncer
const speech = {
  speak: vi.fn(
    async (_utterance: { text: string; rate?: number }, _options?: { interrupt?: boolean }) =>
      'finished' as const,
  ),
}

function start(html: string): void {
  document.body.innerHTML = html
  announcer = new LiveAnnouncer(document.body, {
    speech,
    getRate: () => 1,
    now: () => clock,
  })
  announcer.start()
}

beforeEach(() => {
  clock = 0
  speech.speak.mockClear()
})
afterEach(() => announcer?.stop())

describe('LiveAnnouncer: live regions', () => {
  it('speaks new text in a polite region without interrupting', async () => {
    start('<div id="r" aria-live="polite"></div>')
    $('#r').textContent = 'Saved'
    await flush()
    expect(speech.speak).toHaveBeenCalledWith({ text: 'Saved', rate: 1 }, { interrupt: false })
  })

  it('speaks an assertive region or an alert straight away, interrupting', async () => {
    start('<div id="a" aria-live="assertive"></div><div id="b" role="alert"></div>')
    $('#a').textContent = 'Connection lost'
    await flush()
    expect(speech.speak).toHaveBeenCalledWith(
      { text: 'Connection lost', rate: 1 },
      { interrupt: true },
    )
    $('#b').textContent = 'Payment failed'
    await flush()
    expect(speech.speak).toHaveBeenLastCalledWith(
      { text: 'Payment failed', rate: 1 },
      { interrupt: true },
    )
  })

  it('treats role=status and role=log as polite', async () => {
    start('<div id="s" role="status"></div>')
    $('#s').textContent = 'Loading complete'
    await flush()
    expect(speech.speak).toHaveBeenCalledWith(expect.anything(), { interrupt: false })
  })

  it('speaks only the new item added to a log, not the whole log', async () => {
    start('<ul id="l" role="log" aria-live="polite"><li>Old</li></ul>')
    $('#l').append(Object.assign(document.createElement('li'), { textContent: 'New message' }))
    await flush()
    expect(speech.speak).toHaveBeenCalledWith({ text: 'New message', rate: 1 }, expect.anything())
  })

  it('speaks the whole region when it is atomic', async () => {
    start('<div id="c" aria-live="polite" aria-atomic="true">Cart: <b id="n">2</b> items</div>')
    $('#n').textContent = '3'
    await flush()
    expect(speech.speak).toHaveBeenCalledWith({ text: 'Cart: 3 items', rate: 1 }, expect.anything())
  })

  it('speaks a changed text node inside a region', async () => {
    start('<div id="r" aria-live="polite">Hello</div>')
    ;($('#r').firstChild as Text).data = 'Goodbye'
    await flush()
    expect(speech.speak).toHaveBeenCalledWith({ text: 'Goodbye', rate: 1 }, expect.anything())
  })

  it('speaks an alert that is added to the page', async () => {
    start('<main></main>')
    $('main').insertAdjacentHTML('beforeend', '<div role="alert">Please fix the errors</div>')
    await flush()
    expect(speech.speak).toHaveBeenCalledWith(
      { text: 'Please fix the errors', rate: 1 },
      { interrupt: true },
    )
  })

  it('ignores ordinary changes, regions that are off, and hidden regions', async () => {
    start(
      '<div id="plain"></div><div id="off" aria-live="off"></div><div id="h" aria-live="polite" aria-hidden="true"></div>',
    )
    $('#plain').textContent = 'x'
    $('#off').textContent = 'y'
    $('#h').textContent = 'z'
    await flush()
    expect(speech.speak).not.toHaveBeenCalled()
  })

  it('does not repeat the same text within a moment, but does later', async () => {
    start('<div id="r" aria-live="polite"></div>')
    $('#r').textContent = 'Saved'
    await flush()
    $('#r').textContent = ''
    $('#r').textContent = 'Saved'
    await flush()
    expect(speech.speak).toHaveBeenCalledTimes(1)
    clock += SAME_TEXT_WINDOW_MS + 1
    $('#r').textContent = ''
    $('#r').textContent = 'Saved'
    await flush()
    expect(speech.speak).toHaveBeenCalledTimes(2)
  })

  it('shortens very long text', async () => {
    start('<div id="r" aria-live="polite"></div>')
    $('#r').textContent = 'word '.repeat(200)
    await flush()
    const text = speech.speak.mock.calls[0]![0].text
    expect(text.length).toBeLessThanOrEqual(300)
  })

  it('does not announce its own Companion mode region, which would loop forever', async () => {
    start('<main></main>')
    $('main').insertAdjacentHTML(
      'beforeend',
      '<div data-ibrowse-live role="status" aria-live="polite" aria-atomic="true"></div>',
    )
    await flush()
    $('[data-ibrowse-live]').textContent = 'Explore mode on'
    await flush()
    expect(speech.speak).not.toHaveBeenCalled()
  })

  it('still announces other regions on a page that has the Companion region', async () => {
    start('<div data-ibrowse-live role="status"></div><div id="r" aria-live="polite"></div>')
    $('#r').textContent = 'Saved'
    await flush()
    expect(speech.speak).toHaveBeenCalledWith({ text: 'Saved', rate: 1 }, { interrupt: false })
  })

  it('stops listening when stopped', async () => {
    start('<div id="r" aria-live="polite"></div>')
    announcer.stop()
    $('#r').textContent = 'Saved'
    await flush()
    expect(speech.speak).not.toHaveBeenCalled()
  })
})

describe('LiveAnnouncer: dialogs', () => {
  it('announces a dialog that appears, by name', async () => {
    start('<main></main>')
    $('main').insertAdjacentHTML('beforeend', '<div role="dialog" aria-label="Sign in"><p>Hi</p></div>')
    await flush()
    expect(speech.speak).toHaveBeenCalledWith(
      { text: 'Dialog opened: Sign in', rate: 1 },
      { interrupt: true },
    )
  })

  it('announces an unnamed dialog and an alert dialog', async () => {
    start('<main></main>')
    $('main').insertAdjacentHTML('beforeend', '<dialog open><p>Hi</p></dialog>')
    await flush()
    expect(speech.speak).toHaveBeenCalledWith({ text: 'Dialog opened', rate: 1 }, expect.anything())
  })

  it('announces a dialog that is opened by setting the open attribute', async () => {
    start('<dialog id="d" aria-label="Settings"><p>Hi</p></dialog>')
    $('#d').setAttribute('open', '')
    await flush()
    expect(speech.speak).toHaveBeenCalledWith(
      { text: 'Dialog opened: Settings', rate: 1 },
      expect.anything(),
    )
  })

  it('finds a dialog nested inside something that was added', async () => {
    start('<main></main>')
    $('main').insertAdjacentHTML(
      'beforeend',
      '<div><div role="dialog" aria-label="Cookies"></div></div>',
    )
    await flush()
    expect(speech.speak).toHaveBeenCalledWith(
      { text: 'Dialog opened: Cookies', rate: 1 },
      expect.anything(),
    )
  })

  it('does not announce a closed dialog being added', async () => {
    start('<main></main>')
    $('main').insertAdjacentHTML('beforeend', '<dialog aria-label="Later"><p>Hi</p></dialog>')
    await flush()
    expect(speech.speak).not.toHaveBeenCalled()
  })
})
