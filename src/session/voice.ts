import type { Briefer } from '../briefing/briefer'
import { findPanels } from '../briefing/panels'
import { spokenText } from '../hover/affordance-speech'
import { describeElement } from '../hover/describe'
import type { HoverController } from '../hover/hover-controller'
import type { JumpNavigator } from '../navigation/jump-navigator'
import type { PageNavigator } from '../navigation/page-navigator'
import type { TextReader } from '../reading/text-reader'
import type { NavigationNotice } from '../shared/messages'
import { findAnything, findControl } from '../voice/find'
import { VoiceRunner } from '../voice/runner'
import type { Services } from './services'

const NOT_UNDERSTOOD = 'I did not understand. Say help to hear what you can say.'

export interface VoiceParts {
  readonly hover: HoverController
  readonly jumps: JumpNavigator
  readonly briefer: Briefer
  readonly reader: TextReader
  readonly navigator: PageNavigator
  readonly whereAmI: () => void
  readonly activate: (el: Element) => void
}

/** The page is about to change because of something said, so Explore Mode resumes after it loads. */
function noteNavigation(s: Services): void {
  const notice: NavigationNotice = { type: 'will-navigate' }
  chrome.runtime.sendMessage(notice).catch(s.reportError)
}

/** Builds the Voice Command runner over this page's tools (ADR-0017). */
export function createVoice(s: Services, p: VoiceParts): VoiceRunner {
  const say = (text: string): void => void s.speech.speak({ text, rate: s.rate() })
  return new VoiceRunner({
    pointedAt: () => p.hover.current ?? p.jumps.cursor,
    findControl: (name) => findControl(document, name),
    findAnything: (words) => findAnything(document, words),
    panels: () =>
      findPanels(document, {
        rectOf: (el) => el.getBoundingClientRect(),
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }),
    nameOf: (el) => describeElement(el).label || 'Unlabeled',
    describe: (el) => spokenText(describeElement(el)),
    isText: (el) => describeElement(el).affordance === 'static',
    activate: (el) => {
      if (el.closest('a[href]')) noteNavigation(s)
      p.activate(el)
    },
    readBlock: (el) => p.reader.readBlock(el),
    readAll: (from) => p.briefer.readAll(from),
    brief: () => p.briefer.brief(),
    stop: () => p.briefer.stop(),
    scrollScreen: (direction) => void p.navigator.scrollScreen(direction),
    scrollToEdge: (edge) => p.navigator.scrollToEdge(edge),
    goPage: (direction) => void p.navigator.go(direction),
    history: (step) => {
      noteNavigation(s)
      history.go(step)
    },
    whereAmI: p.whereAmI,
    reveal: (el) => {
      el.scrollIntoView({ block: 'center', behavior: 'instant' })
      p.jumps.setCursor(el)
    },
    // Answering with AI comes in slice 5b.9; without AI this is the answer (PRD FR-11.5).
    ask: () => say(NOT_UNDERSTOOD),
    lastSpoken: () => s.speech.lastText,
    speech: s.speech,
    earcons: s.earcons,
    getRate: s.rate,
  })
}
