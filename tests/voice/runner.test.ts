import { describe, expect, it, vi } from 'vitest'
import type { Panel } from '../../src/briefing/panels'
import { HELP_TEXT, VoiceRunner, type VoiceRunnerDeps } from '../../src/voice/runner'
import type { VoiceCommand } from '../../src/voice/commands'

const el = (id: string): Element => {
  const element = document.createElement('div')
  element.id = id
  return element
}

const CONTENTS = {
  links: 3, buttons: 0, inputs: 0, images: 0, headings: 0, paragraphs: 0,
  search: false, logo: false, firstHeading: '',
}

function setup(overrides: Partial<VoiceRunnerDeps> = {}) {
  const spoken: string[] = []
  const deps: VoiceRunnerDeps = {
    pointedAt: vi.fn(() => null),
    findControl: vi.fn(() => null),
    findAnything: vi.fn(() => null),
    panels: vi.fn((): Panel[] => []),
    nameOf: vi.fn((e: Element) => e.id),
    describe: vi.fn((e: Element) => `${e.id} — Button`),
    isText: vi.fn(() => false),
    activate: vi.fn(),
    readBlock: vi.fn(),
    readAll: vi.fn(),
    brief: vi.fn(),
    stop: vi.fn(),
    scrollScreen: vi.fn(),
    scrollToEdge: vi.fn(),
    goPage: vi.fn(),
    history: vi.fn(),
    whereAmI: vi.fn(),
    reveal: vi.fn(),
    ask: vi.fn(),
    lastSpoken: vi.fn(() => null),
    speech: { speak: vi.fn(async (u: { text: string }) => (spoken.push(u.text), 'finished' as const)) },
    earcons: { play: vi.fn() },
    getRate: () => 1,
    ...overrides,
  }
  const runner = new VoiceRunner(deps)
  const run = (command: VoiceCommand): void => runner.run({ type: 'command', command })
  return { runner, run, deps, spoken }
}

describe('VoiceRunner: click', () => {
  it('presses what the pointer is on, with a confirming sound', () => {
    const button = el('Save')
    const { run, deps, spoken } = setup({ pointedAt: () => button })
    run({ kind: 'click' })
    expect(deps.activate).toHaveBeenCalledWith(button)
    expect(deps.earcons.play).toHaveBeenCalledWith('confirm', 0)
    expect(spoken).toEqual(['Save: pressed'])
  })

  it('reads text instead of pressing it, as a click does', () => {
    const paragraph = el('p')
    const { run, deps } = setup({ pointedAt: () => paragraph, isText: () => true })
    run({ kind: 'click' })
    expect(deps.readBlock).toHaveBeenCalledWith(paragraph)
    expect(deps.activate).not.toHaveBeenCalled()
  })

  it('says how to point at something when nothing is pointed at', () => {
    const { run, spoken } = setup()
    run({ kind: 'click' })
    expect(spoken).toEqual(['Nothing to press. Move the pointer onto something first, or say click and its name.'])
  })

  it('presses a control by its name', () => {
    const signIn = el('Sign in')
    const { run, deps, spoken } = setup({ findControl: vi.fn(() => signIn) })
    run({ kind: 'click', target: 'sign in' })
    expect(deps.findControl).toHaveBeenCalledWith('sign in')
    expect(deps.activate).toHaveBeenCalledWith(signIn)
    expect(spoken).toEqual(['Sign in: pressed'])
  })

  it('says when no control has that name', () => {
    const { run, deps, spoken } = setup()
    run({ kind: 'click', target: 'giraffe' })
    expect(deps.activate).not.toHaveBeenCalled()
    expect(spoken).toEqual(['Nothing called giraffe on this page.'])
  })
})

describe('VoiceRunner: moving around', () => {
  it('scrolls a screen, or to the top or bottom', () => {
    const { run, deps } = setup()
    run({ kind: 'scroll', direction: 'down' })
    run({ kind: 'scroll-to', edge: 'top' })
    expect(deps.scrollScreen).toHaveBeenCalledWith('down')
    expect(deps.scrollToEdge).toHaveBeenCalledWith('top')
  })

  it('follows next and previous page links', () => {
    const { run, deps } = setup()
    run({ kind: 'page', direction: 'next' })
    run({ kind: 'page', direction: 'previous' })
    expect(deps.goPage).toHaveBeenNthCalledWith(1, 'next')
    expect(deps.goPage).toHaveBeenNthCalledWith(2, 'prev')
  })

  it('goes back and forward in history, saying so first', () => {
    const { run, deps, spoken } = setup()
    run({ kind: 'back' })
    run({ kind: 'forward' })
    expect(deps.history).toHaveBeenNthCalledWith(1, -1)
    expect(deps.history).toHaveBeenNthCalledWith(2, 1)
    expect(spoken).toEqual(['Going back', 'Going forward'])
  })

  it('finds something, moves to it and describes it', () => {
    const search = el('Search')
    const { run, deps, spoken } = setup({ findAnything: vi.fn(() => search) })
    run({ kind: 'find', target: 'search box' })
    expect(deps.reveal).toHaveBeenCalledWith(search)
    expect(spoken).toEqual(['Found: Search — Button'])
  })

  it('says when nothing is found', () => {
    const { run, spoken } = setup()
    run({ kind: 'find', target: 'login' })
    expect(spoken).toEqual(['Nothing called login on this page.'])
  })
})

describe('VoiceRunner: panels', () => {
  const nav = el('nav')
  const panels: Panel[] = [{ kind: 'left', element: nav, label: 'Categories', contents: CONTENTS }]

  it('describes a panel in full', () => {
    const { run, deps, spoken } = setup({ panels: () => panels })
    run({ kind: 'panel', panel: 'left', action: 'describe' })
    expect(deps.reveal).not.toHaveBeenCalled()
    expect(spoken).toEqual(['Left panel, Categories: 3 links.'])
  })

  it('moves to a panel and describes it', () => {
    const { run, deps, spoken } = setup({ panels: () => panels })
    run({ kind: 'panel', panel: 'left', action: 'go' })
    expect(deps.reveal).toHaveBeenCalledWith(nav)
    expect(spoken).toEqual(['Left panel, Categories: 3 links.'])
  })

  it('says when the page has no such panel', () => {
    const { run, spoken } = setup({ panels: () => panels })
    run({ kind: 'panel', panel: 'right', action: 'go' })
    expect(spoken).toEqual(['There is no right panel on this page.'])
  })
})

describe('VoiceRunner: reading and speech', () => {
  it('reads what the pointer is on, or the page from the start when nothing is', () => {
    const paragraph = el('p')
    const { run, deps } = setup({ pointedAt: () => paragraph })
    run({ kind: 'read', what: 'this' })
    expect(deps.readBlock).toHaveBeenCalledWith(paragraph)

    const none = setup()
    none.run({ kind: 'read', what: 'this' })
    expect(none.deps.readAll).toHaveBeenCalledWith(null)
  })

  it('reads the whole page', () => {
    const { run, deps } = setup()
    run({ kind: 'read', what: 'page' })
    expect(deps.readAll).toHaveBeenCalledWith(null)
  })

  it('stops, briefs, and says where the user is', () => {
    const { run, deps } = setup()
    run({ kind: 'stop' })
    run({ kind: 'brief' })
    run({ kind: 'where' })
    expect(deps.stop).toHaveBeenCalled()
    expect(deps.brief).toHaveBeenCalled()
    expect(deps.whereAmI).toHaveBeenCalled()
  })

  it('repeats what was last said, or says there is nothing', () => {
    const { run, spoken } = setup({ lastSpoken: () => 'Save — Button, Clickable' })
    run({ kind: 'repeat' })
    expect(spoken).toEqual(['Save — Button, Clickable'])

    const fresh = setup()
    fresh.run({ kind: 'repeat' })
    expect(fresh.spoken).toEqual(['Nothing to repeat yet.'])
  })

  it('lists what can be said', () => {
    const { run, spoken } = setup()
    run({ kind: 'help' })
    expect(spoken).toEqual([HELP_TEXT])
  })
})

describe('VoiceRunner: questions and nothing', () => {
  it('passes a question on to be answered', () => {
    const { runner, deps } = setup()
    runner.run({ type: 'question', text: 'Is there free delivery?' })
    expect(deps.ask).toHaveBeenCalledWith('Is there free delivery?')
  })

  it('does nothing for nothing', () => {
    const { runner, spoken, deps } = setup()
    runner.run({ type: 'nothing' })
    expect(spoken).toEqual([])
    expect(deps.ask).not.toHaveBeenCalled()
  })
})
