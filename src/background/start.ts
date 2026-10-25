import { ChromeTtsProvider } from '../audio/providers'
import { hasDoneOnboarding, markOnboardingDone, shouldOpenOnboarding } from '../onboarding/tour'
import { CloudHost, type CloudMessage } from './cloud-host'
import type { HidApiLike } from '../haptics/hid-driver'
import { HidHost } from '../haptics/hid-host'
import type { AiResponse } from '../ai/messages'
import type { CloudSpeechResponse } from '../cloud/messages'
import type { HapticNotice, HapticRequest, HapticResponse } from '../haptics/messages'
import { loadProfiles } from '../haptics/profile'
import type {
  ExploreMessage,
  ExploreStateNotice,
  FrameActionRequest,
  NavigationNotice,
  SpeechRequest,
  SpeechResponse,
  SpeechStartedNotice,
  TabInfoRequest,
  TabInfoResponse,
} from '../shared/messages'
import { loadSettings } from '../shared/settings'
import { toolbarState } from '../shared/toolbar'

const INACCESSIBLE_PAGE_MESSAGE =
  'iBrowse cannot run on this page. Chrome blocks extensions on its own pages, the Web Store and the built-in PDF viewer.'

const MENU_NEXT = 'ibrowse-next'
const MENU_PREV = 'ibrowse-prev'

/** A note that Explore Mode should resume is only honoured for this long. */
const RESUME_WINDOW_MS = 15_000
const RESUME_ATTEMPTS = 6
const RESUME_RETRY_MS = 250

const resumeKey = (tabId: number): string => `resume:${tabId}`

type BackgroundMessage =
  | SpeechRequest
  | NavigationNotice
  | ExploreStateNotice
  | FrameActionRequest
  | TabInfoRequest
  | HapticRequest
  | CloudMessage
type AnyResponse = SpeechResponse | TabInfoResponse | HapticResponse | CloudSpeechResponse | AiResponse

interface Background {
  readonly speech: ChromeTtsProvider
  readonly hidHost: HidHost
  readonly cloud: CloudHost
  reportError(context: string): (error: unknown) => void
  sendToTopFrame(tabId: number, message: ExploreMessage): Promise<unknown>
}

const toErrorResponse = (error: unknown): SpeechResponse => ({
  ok: false,
  error: error instanceof Error ? error.message : 'Speech failed',
})

/** Which tab this is, among the tabs of its window. */
async function tabInfo(tab: chrome.tabs.Tab | undefined): Promise<TabInfoResponse> {
  if (!tab) return { ok: false }
  const tabs = await chrome.tabs.query({ windowId: tab.windowId })
  return { ok: true, index: tab.index + 1, count: tabs.length }
}

/** Tells every page the paired device was unplugged. Tabs with no content script will not answer. */
async function notifyDeviceLost(): Promise<void> {
  const notice: HapticNotice = { type: 'haptic-disconnected' }
  const tabs = await chrome.tabs.query({})
  await Promise.allSettled(
    tabs.flatMap((tab) => (tab.id === undefined ? [] : [chrome.tabs.sendMessage(tab.id, notice)])),
  )
}

function handleHapticMessage(
  b: Background,
  message: HapticRequest,
  sendResponse: (r: AnyResponse) => void,
): boolean {
  switch (message.type) {
    case 'haptic-connect':
      void b.hidHost.connect().then(sendResponse)
      break
    case 'haptic-play':
      void b.hidHost.play(message.event, message.intensity).then(sendResponse)
      break
    case 'haptic-disconnect':
      void b.hidHost.disconnect().then(() => sendResponse({ ok: true }))
      break
  }
  return true // the answer comes later
}

function handleMessage(
  b: Background,
  message: BackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (r: AnyResponse) => void,
): boolean {
  if (sender.id !== chrome.runtime.id) return false
  switch (message.type) {
    case 'speak':
      b.speech.speak({ ...message.utterance, onStart: () => notifySpeechStarted(sender, message.id) }).then(
        () => sendResponse({ ok: true }),
        (e: unknown) => sendResponse(toErrorResponse(e)),
      )
      return true // keep the channel open for the async response
    case 'cancel':
      b.speech.cancel()
      sendResponse({ ok: true })
      return false
    case 'tab-info':
      tabInfo(sender.tab).then(sendResponse, (e: unknown) => {
        b.reportError('tab info')(e)
        sendResponse({ ok: false })
      })
      return true
    case 'frame-action':
      if (sender.tab?.id !== undefined) {
        b.sendToTopFrame(sender.tab.id, { type: 'action', action: message.action }).catch(
          b.reportError('frame shortcut'),
        )
      }
      return false
    case 'explore-state':
      if (sender.tab?.id !== undefined) showToolbarState(sender.tab.id, message.enabled)
      return false
    case 'will-navigate':
      if (sender.tab?.id !== undefined) {
        chrome.storage.session
          .set({ [resumeKey(sender.tab.id)]: Date.now() })
          .catch(b.reportError('could not note navigation'))
      }
      return false
    case 'cloud-speech':
    case 'cloud-cancel':
    case 'ai-request':
    case 'latency-report':
      return b.cloud.handle(message, sendResponse)
    default:
      return handleHapticMessage(b, message, sendResponse)
  }
}

/** The page may still be starting up, so try a few times. */
async function resumeExplore(b: Background, tabId: number): Promise<void> {
  for (let attempt = 0; attempt < RESUME_ATTEMPTS; attempt++) {
    try {
      await b.sendToTopFrame(tabId, { type: 'resume-explore' })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, RESUME_RETRY_MS))
    }
  }
}

/**
 * After a followed link finishes loading, turn Explore Mode back on so the
 * new page is briefed without the user having to press the hotkey again.
 */
function registerResume(b: Background): void {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'complete') return
    const key = resumeKey(tabId)
    chrome.storage.session
      .get(key)
      .then(async (stored) => {
        const notedAt = stored[key]
        if (typeof notedAt !== 'number') return
        await chrome.storage.session.remove(key)
        if (Date.now() - notedAt <= RESUME_WINDOW_MS) await resumeExplore(b, tabId)
      })
      .catch(b.reportError('could not resume Explore Mode'))
  })
}

function registerMenus(b: Background): void {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({ id: MENU_NEXT, title: 'iBrowse: Next page', contexts: ['all'] })
      chrome.contextMenus.create({ id: MENU_PREV, title: 'iBrowse: Previous page', contexts: ['all'] })
    })
  })
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (tab?.id === undefined) return
    if (info.menuItemId === MENU_NEXT) {
      b.sendToTopFrame(tab.id, { type: 'next-page' }).catch(b.reportError('next page'))
    } else if (info.menuItemId === MENU_PREV) {
      b.sendToTopFrame(tab.id, { type: 'prev-page' }).catch(b.reportError('previous page'))
    }
  })
}

/** Toggles Explore Mode in `clicked`, or in the active tab when a hotkey was pressed. */
async function toggleExploreMode(b: Background, clicked?: chrome.tabs.Tab): Promise<void> {
  const tab = clicked ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
  if (tab?.id === undefined) return
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'toggle-explore' } satisfies ExploreMessage)
  } catch {
    // No content script answered: the page is one Chrome does not allow (FR-1.5).
    b.speech.speak({ text: INACCESSIBLE_PAGE_MESSAGE }).catch(b.reportError('inaccessible page notice'))
  }
}

function showToolbarState(tabId: number, enabled: boolean): void {
  const { badge, title } = toolbarState(enabled)
  // A rejection means the tab closed in the meantime; it has no button left to update.
  chrome.action.setBadgeText({ tabId, text: badge }).catch(() => {})
  chrome.action.setTitle({ tabId, title }).catch(() => {})
}

/** The toolbar button switches Explore Mode in the tab it was clicked in. */
function registerToolbar(b: Background): void {
  chrome.action.onClicked.addListener((tab) => void toggleExploreMode(b, tab))
}

function registerCommands(b: Background): void {
  chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-explore') void toggleExploreMode(b)
    if (command === 'open-settings') void chrome.runtime.openOptionsPage()
    if (command === 'pair-hardware') {
      void chrome.tabs.create({ url: chrome.runtime.getURL('pair.html') })
    }
  })
}

/** Registers everything the background worker does. Called once, each time the worker starts. */
export function startBackground(): void {
  const reportError = (context: string) => (error: unknown) => {
    console.error(`iBrowse ${context}:`, error instanceof Error ? error.message : 'unknown')
  }
  const b: Background = {
    speech: new ChromeTtsProvider(chrome.tts),
    cloud: new CloudHost(),
    hidHost: new HidHost({
      loadSettings: () => loadSettings(chrome.storage.local),
      loadProfiles: () => loadProfiles(chrome.storage.local),
      hid: (navigator as unknown as { hid?: HidApiLike }).hid,
      onDisconnected: () => void notifyDeviceLost().catch(reportError('device lost notice')),
    }),
    reportError,
    sendToTopFrame: (tabId, message) => chrome.tabs.sendMessage(tabId, message, { frameId: 0 }),
  }

  chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) =>
    handleMessage(b, message, sender, sendResponse),
  )
  registerResume(b)
  registerMenus(b)
  registerCommands(b)
  registerToolbar(b)
  chrome.runtime.onInstalled.addListener(({ reason }) => {
    void openTourOnFirstInstall(b, reason).catch(reportError('opening the tour'))
  })
}

/** Tells the page that asked for speech that the sound has begun, so the delay can be measured. */
function notifySpeechStarted(sender: chrome.runtime.MessageSender, id: number): void {
  if (sender.tab?.id === undefined) return
  const notice: SpeechStartedNotice = { type: 'speech-started', id }
  // A rejection means the page closed while it was waiting; there is no one left to tell.
  chrome.tabs.sendMessage(sender.tab.id, notice, { frameId: sender.frameId ?? 0 }).catch(() => {})
}

/** A fresh install opens the tour once, and says so aloud, since the new tab may not be announced. */
async function openTourOnFirstInstall(b: Background, reason: string): Promise<void> {
  const done = await hasDoneOnboarding(chrome.storage.local)
  if (!shouldOpenOnboarding(reason, done)) return
  await markOnboardingDone(chrome.storage.local)
  b.speech.speak({ text: 'Welcome to iBrowse. A short tour is opening now.' }).catch(b.reportError('welcome'))
  await chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') })
}
