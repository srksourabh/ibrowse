import { createActionRunner } from '../actions'
import { LatencyMeter } from '../audio/latency-meter'
import { Briefer } from '../briefing/briefer'
import { viewportBriefing } from '../briefing/briefing-text'
import { analyzePage } from '../briefing/layout-model'
import { TypingEcho } from '../forms/typing-echo'
import { describeElement } from '../hover/describe'
import { hitTest } from '../hover/hit-test'
import { HoverController, type HoverDeps } from '../hover/hover-controller'
import { LiveAnnouncer } from '../live/live-announcer'
import { JumpNavigator } from '../navigation/jump-navigator'
import { describeTarget, headingTargets, landmarkTargets } from '../navigation/landmarks'
import { PageNavigator } from '../navigation/page-navigator'
import { findPaginationTarget, type PaginationTarget } from '../navigation/pagination'
import {
  adjacentBlock,
  blockText,
  blocksFrom,
  mainContent,
  readableBlocks,
  scrubBlockAt,
} from '../reading/blocks'
import { TextReader } from '../reading/text-reader'
import type { NavigationNotice, TabInfoRequest, TabInfoResponse } from '../shared/messages'
import { statusText } from '../status/status'
import { createAi } from './ai'
import { TouchActivator } from '../touch/touch-activator'
import { VirtualPointer } from '../touch/virtual-pointer'
import type { SessionAi } from './ai'
import type { Services } from './services'
import { createAsk, createListening, createVoice } from './voice'

type Analyze = (scope: 'page' | 'viewport') => ReturnType<typeof analyzePage>

function activatePagination(target: PaginationTarget): void {
  if (target.element) target.element.click()
  else location.assign(target.href)
}

/** Focus text fields so the user can type; click everything else. */
export function activateElement(el: Element): void {
  const info = describeElement(el)
  if (info.affordance === 'static' || !(el instanceof HTMLElement)) return
  if (['textbox', 'searchbox', 'combobox'].includes(info.role)) el.focus()
  else el.click()
}

async function requestTabInfo(): Promise<{ index: number; count: number } | null> {
  try {
    const request: TabInfoRequest = { type: 'tab-info' }
    const response: TabInfoResponse = await chrome.runtime.sendMessage(request)
    return response.ok ? { index: response.index, count: response.count } : null
  } catch {
    return null
  }
}

const securityOf = (protocol: string): boolean | null =>
  protocol === 'https:' ? true : protocol === 'http:' ? false : null

const analyzeCurrentPage: Analyze = (scope) =>
  analyzePage(document, {
    rectOf: (el) => el.getBoundingClientRect(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scope,
  })

function createJumps(s: Services): JumpNavigator {
  return new JumpNavigator({
    targets: (kind) => (kind === 'heading' ? headingTargets(document) : landmarkTargets(document)),
    reveal: (el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }),
    describe: describeTarget,
    speech: s.speech,
    earcons: s.earcons,
    getRate: s.rate,
  })
}

/** Hover hooks that are filled in once the pieces they call exist. */
type HoverHooks = Pick<HoverDeps, 'onMove' | 'onDescribed'>

function createHover(s: Services, jumps: JumpNavigator, meter: LatencyMeter, hooks: HoverHooks): HoverController {
  return new HoverController({
    ...hooks,
    resolve: (x, y) => hitTest(x, y),
    describe: describeElement,
    speech: s.speech,
    earcons: s.earcons,
    meter,
    panAt: s.panAt,
    getSettings: s.settings,
    onTarget: (el) => jumps.setCursor(el),
  })
}

function createBriefer(s: Services, hover: HoverController, ai: SessionAi): Briefer {
  return new Briefer({
    analyze: analyzeCurrentPage,
    readTexts: (from) =>
      blocksFrom(readableBlocks(from ? document.body : mainContent(document)), from).map(blockText),
    speech: s.speech,
    hover,
    getRate: s.rate,
    enrich: ai.purpose,
  })
}

function createPageNavigator(s: Services): PageNavigator {
  return new PageNavigator({
    scroll: {
      y: () => window.scrollY,
      maxY: () => document.documentElement.scrollHeight - window.innerHeight,
      viewportHeight: () => window.innerHeight,
      by: (dy) => window.scrollBy({ top: dy, behavior: 'instant' }),
    },
    findLink: (direction) => findPaginationTarget(document, direction),
    activate: activatePagination,
    willNavigate: () => {
      const notice: NavigationNotice = { type: 'will-navigate' }
      chrome.runtime.sendMessage(notice).catch(s.reportError)
    },
    briefViewport: () => viewportBriefing(analyzeCurrentPage('viewport')),
    speech: s.speech,
    earcons: s.earcons,
    getRate: s.rate,
  })
}

function createReader(s: Services, hover: HoverController, navigator: PageNavigator): TextReader {
  return new TextReader({
    blockAt: (x, y) => scrubBlockAt(x, y),
    textOf: blockText,
    adjacentBlock: (block, direction) => adjacentBlock(block, direction, document),
    speech: s.speech,
    earcons: s.earcons,
    hover,
    navigator,
    panAt: s.panAt,
    getRate: s.rate,
  })
}

function createWhereAmI(s: Services): () => void {
  return () => {
    void requestTabInfo().then((tab) => {
      const text = statusText({
        title: document.title,
        host: location.hostname,
        secure: securityOf(location.protocol),
        loading: document.readyState !== 'complete',
        tab,
      })
      void s.speech.speak({ text, rate: s.rate() })
    })
  }
}

function createTouch(s: Services, hover: HoverController, reader: TextReader): TouchActivator {
  return new TouchActivator({
    activate: (el) => {
      if (describeElement(el).affordance === 'static') {
        reader.readBlock(el)
        return
      }
      s.earcons.play('confirm', 0)
      activateElement(el)
    },
    targetAt: (x, y) => hitTest(x, y),
    current: () => hover.current,
    getMode: () => s.settings().touchActivation,
    now: () => performance.now(),
  })
}

/** Everything an Explore Mode session works with, built from the shared services. */
export function createTools(s: Services, isTopFrame: boolean) {
  const jumps = createJumps(s)
  const meter = new LatencyMeter()
  // Ask-after-rest needs listening, which needs the voice runner, which needs hover: bound late.
  let ask: ReturnType<typeof createAsk> | undefined
  const hover = createHover(s, jumps, meter, {
    onMove: (target) => ask?.moved(target),
    onDescribed: (target, spoken) => ask?.described(target, spoken),
  })
  const ai = createAi(s, hover)
  const briefer = createBriefer(s, hover, ai)
  const navigator = createPageNavigator(s)
  const reader = createReader(s, hover, navigator)
  const whereAmI = createWhereAmI(s)
  const voice = createVoice(s, { hover, jumps, briefer, reader, navigator, whereAmI, activate: activateElement, ai })
  const listening = createListening(s, voice)

  return {
    isTopFrame,
    jumps,
    hover,
    briefer,
    navigator,
    reader,
    whereAmI,
    runAction: createActionRunner({ briefer, reader, navigator, jumps, whereAmI, ai }),
    voice,
    listening,
    ask: (ask = createAsk(s, hover, listening)),
    meter,
    virtualPointer: new VirtualPointer(),
    typingEcho: new TypingEcho({
      speech: s.speech,
      earcons: s.earcons,
      getMode: () => s.settings().typingEcho,
      getRate: s.rate,
    }),
    live: new LiveAnnouncer(document, { speech: s.speech, getRate: s.rate }),
    touch: createTouch(s, hover, reader),
  }
}

export type Tools = ReturnType<typeof createTools>
