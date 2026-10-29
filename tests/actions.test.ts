import { describe, expect, it, vi } from 'vitest'
import { createActionRunner } from '../src/actions'
import type { KeyAction } from '../src/key-router'

function setup(options: { readFromHere?: boolean; cursor?: Element | null } = {}) {
  const briefer = { brief: vi.fn(), readAll: vi.fn(), stop: vi.fn() }
  const reader = { readFromHere: vi.fn(() => options.readFromHere ?? false) }
  const navigator = { go: vi.fn() }
  const jumps = { jump: vi.fn(), cursor: options.cursor ?? null }
  const whereAmI = vi.fn()
  const ai = { describeThis: vi.fn(), summarize: vi.fn() }
  const talk = vi.fn()
  const exploreOff = vi.fn()
  const openPage = vi.fn()
  const run = createActionRunner({ briefer, reader, navigator, jumps, whereAmI, ai, talk, exploreOff, openPage })
  return { run, briefer, reader, navigator, jumps, whereAmI, ai, talk, exploreOff, openPage }
}

describe('createActionRunner: shortcuts that leave exploring', () => {
  it('turns Explore Mode off', () => {
    const { run, exploreOff } = setup()
    run('explore-off')
    expect(exploreOff).toHaveBeenCalledOnce()
  })

  it('opens settings and hardware setup', () => {
    const { run, openPage } = setup()
    run('open-settings')
    run('open-hardware')
    expect(openPage.mock.calls).toEqual([['settings'], ['hardware']])
  })
})

describe('createActionRunner: push to talk passed up from an iframe', () => {
  it('starts and ends talking in the top frame', () => {
    const { run, talk } = setup()
    run('talk-start')
    run('talk-end')
    expect(talk.mock.calls).toEqual([[true], [false]])
  })
})

describe('createActionRunner', () => {
  it('gives the detailed briefing', () => {
    const { run, briefer } = setup()
    run('brief-detailed')
    expect(briefer.brief).toHaveBeenCalledWith({ detailed: true })
  })

  it('reads from the current word if the wheel has been scrubbing', () => {
    const { run, briefer } = setup({ readFromHere: true })
    run('read-from-here')
    expect(briefer.readAll).not.toHaveBeenCalled()
  })

  it('otherwise reads from the navigation cursor, or the top of the main content', () => {
    const cursor = document.createElement('h2')
    const withCursor = setup({ cursor })
    withCursor.run('read-from-here')
    expect(withCursor.briefer.readAll).toHaveBeenCalledWith(cursor)

    const noCursor = setup()
    noCursor.run('read-from-here')
    expect(noCursor.briefer.readAll).toHaveBeenCalledWith(null)
  })

  it('moves between pages', () => {
    const { run, navigator } = setup()
    run('next-page')
    run('prev-page')
    expect(navigator.go.mock.calls).toEqual([['next'], ['prev']])
  })

  it('jumps between headings and landmarks', () => {
    const { run, jumps } = setup()
    const actions: KeyAction[] = ['next-heading', 'prev-heading', 'next-landmark', 'prev-landmark']
    actions.forEach(run)
    expect(jumps.jump.mock.calls).toEqual([
      ['heading', 1],
      ['heading', -1],
      ['landmark', 1],
      ['landmark', -1],
    ])
  })

  it('describes the thing under the pointer, and summarises the page', () => {
    const { run, ai } = setup()
    run('describe-this')
    expect(ai.describeThis).toHaveBeenCalledOnce()
    expect(ai.summarize).not.toHaveBeenCalled()
    run('summarize-page')
    expect(ai.summarize).toHaveBeenCalledOnce()
  })

  it('says where the user is', () => {
    const { run, whereAmI } = setup()
    run('where-am-i')
    expect(whereAmI).toHaveBeenCalledOnce()
  })

  it('stops speech', () => {
    const { run, briefer } = setup()
    run('stop-speech')
    expect(briefer.stop).toHaveBeenCalledOnce()
  })
})
