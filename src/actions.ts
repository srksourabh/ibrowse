import type { Briefer } from './briefing/briefer'
import type { KeyAction } from './key-router'
import type { JumpNavigator } from './navigation/jump-navigator'
import type { PageNavigator } from './navigation/page-navigator'
import type { TextReader } from './reading/text-reader'

export interface ActionDeps {
  briefer: Pick<Briefer, 'brief' | 'readAll' | 'stop'>
  reader: Pick<TextReader, 'readFromHere'>
  navigator: Pick<PageNavigator, 'go'>
  jumps: Pick<JumpNavigator, 'jump' | 'cursor'>
  whereAmI(): void
  ai: { describeThis(): void; summarize(): void }
  /** Push to talk: true when the key goes down, false when it is let go. */
  talk(start: boolean): void
}

/**
 * Carries out an Explore Mode command. Key presses in the top frame and
 * commands forwarded from an iframe both end up here.
 */
export function createActionRunner(deps: ActionDeps): (action: KeyAction) => void {
  const { briefer, reader, navigator, jumps } = deps
  return (action) => {
    switch (action) {
      case 'brief-detailed':
        briefer.brief({ detailed: true })
        break
      case 'read-from-here':
        if (!reader.readFromHere()) briefer.readAll(jumps.cursor)
        break
      case 'next-page':
        navigator.go('next')
        break
      case 'prev-page':
        navigator.go('prev')
        break
      case 'next-heading':
        jumps.jump('heading', 1)
        break
      case 'prev-heading':
        jumps.jump('heading', -1)
        break
      case 'next-landmark':
        jumps.jump('landmark', 1)
        break
      case 'prev-landmark':
        jumps.jump('landmark', -1)
        break
      case 'where-am-i':
        deps.whereAmI()
        break
      case 'describe-this':
        deps.ai.describeThis()
        break
      case 'summarize-page':
        deps.ai.summarize()
        break
      case 'stop-speech':
        briefer.stop()
        break
      case 'talk-start':
      case 'talk-end':
        deps.talk(action === 'talk-start')
        break
    }
  }
}
