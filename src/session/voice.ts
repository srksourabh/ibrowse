import type { Briefer } from '../briefing/briefer'
import { findPanels } from '../briefing/panels'
import { spokenText } from '../hover/affordance-speech'
import { describeElement } from '../hover/describe'
import type { HoverController } from '../hover/hover-controller'
import type { JumpNavigator } from '../navigation/jump-navigator'
import type { PageNavigator } from '../navigation/page-navigator'
import type { TextReader } from '../reading/text-reader'
import type { NavigationNotice } from '../shared/messages'
import { AskAfterRest } from '../voice/ask-after-rest'
import { recognitionErrorText } from '../voice/chrome-recognizer'
import { parseUtterance } from '../voice/commands'
import { findAnything, findControl, isRisky } from '../voice/find'
import { ListeningController, NOTHING_HEARD } from '../voice/listening'
import { MessageRecognizer } from '../voice/message-recognizer'
import type { ListenResponse } from '../voice/messages'
import { VoiceRunner } from '../voice/runner'
import type { SessionAi } from './ai'
import type { Services } from './services'

const NOT_UNDERSTOOD = 'I did not understand. Say help to hear what you can say.'
const VOICE_OFF = 'Voice commands are off. Turn them on in settings, opened with Alt and O.'

/** Push to talk in the top frame, whichever frame the key was pressed in. */
export function talk(s: Services, listening: ListeningController, start: boolean): void {
  if (!start) listening.endHold()
  else if (s.settings().voiceInput === 'off') void s.speech.speak({ text: VOICE_OFF, rate: s.rate() })
  else listening.startHold()
}

export interface VoiceParts {
  readonly hover: HoverController
  readonly jumps: JumpNavigator
  readonly briefer: Briefer
  readonly reader: TextReader
  readonly navigator: PageNavigator
  readonly whereAmI: () => void
  readonly activate: (el: Element) => void
  readonly ai: SessionAi
  /** Opens the short answer window; bound once the listening controller exists. */
  readonly listenForAnswer: () => void
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
    isRisky,
    askAndListen: (text) => {
      void s.speech.speak({ text, rate: s.rate() }).then((outcome) => {
        if (outcome === 'finished' && !s.speech.isBusy && s.settings().voiceInput !== 'off') p.listenForAnswer()
      })
    },
    now: () => performance.now(),
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
    // Questions go to the AI only when the user turned it on; otherwise iBrowse says so (PRD FR-11.5).
    ask: (question) => (s.settings().aiAssist ? p.ai.answer(question) : say(NOT_UNDERSTOOD)),
    lastSpoken: () => s.speech.lastText,
    speech: s.speech,
    earcons: s.earcons,
    getRate: s.rate,
  })
}

/** The microphone side: what is heard is understood and carried out by the runner. */
export function createListening(s: Services, runner: VoiceRunner): ListeningController {
  const recognizer = new MessageRecognizer(
    (request) => chrome.runtime.sendMessage<typeof request, ListenResponse>(request),
    { onNotice: (text) => void s.speech.speak({ text, rate: s.rate() }, { interrupt: false }) },
  )
  return new ListeningController({
    recognizer,
    speech: s.speech,
    earcons: s.earcons,
    onHeard: (text) => runner.run(parseUtterance(text)),
    onNothingHeard: () => void s.speech.speak({ text: NOTHING_HEARD, rate: s.rate() }),
    onError: (error) => void s.speech.speak({ text: recognitionErrorText(error), rate: s.rate() }),
  })
}

/** After the pointer rests on something, asks what to do and listens (PRD FR-11.2). */
export function createAsk(s: Services, hover: HoverController, listening: ListeningController): AskAfterRest {
  return new AskAfterRest({
    isOn: () => s.settings().voiceInput !== 'off',
    current: () => hover.current,
    speech: s.speech,
    listening,
    getRate: s.rate,
  })
}
