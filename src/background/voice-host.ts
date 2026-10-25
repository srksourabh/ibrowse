import type {
  ListenRequest,
  ListenResponse,
  OffscreenRequest,
  RecordingResponse,
  VoiceEngine,
} from '../voice/messages'

export interface VoiceHostDeps {
  /** The recogniser chosen in settings, read for each request. */
  engine(): Promise<VoiceEngine>
  /** Turns a recording into words with Gemini; only the worker holds the key. */
  transcribe(audio: string): Promise<ListenResponse>
}

const OFFSCREEN_URL = 'offscreen.html'

let creating: Promise<void> | null = null
let nextId = 1
/** Each tab numbers its own requests; the offscreen document needs one number across all of them. */
const ids = new Map<string, number>()

async function ensureOffscreen(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return
  creating ??= chrome.offscreen
    .createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: 'Speech recognition for spoken commands, while the user has voice turned on.',
    })
    .finally(() => {
      creating = null
    })
  await creating
}

const keyOf = (sender: chrome.runtime.MessageSender, id: number): string =>
  `${sender.tab?.id ?? -1}:${sender.frameId ?? 0}:${id}`

const toOffscreen = (request: OffscreenRequest): Promise<unknown> => chrome.runtime.sendMessage(request)

async function recognize(id: number, maxMs: number, deps: VoiceHostDeps): Promise<ListenResponse> {
  const engine = await deps.engine()
  const answer = await toOffscreen({ target: 'offscreen', type: 'recognize', id, maxMs, engine })
  if (engine === 'chrome') return answer as ListenResponse
  const recording = answer as RecordingResponse
  if (!recording.ok) return recording
  return recording.audio === null ? { ok: true, text: null } : deps.transcribe(recording.audio)
}

/** Relays a page's request to listen to the offscreen document, and its answer back. */
export function handleListen(
  message: ListenRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: ListenResponse) => void,
  deps: VoiceHostDeps,
): boolean {
  const key = keyOf(sender, message.id)
  if (message.type === 'listen-start') {
    const id = nextId++
    ids.set(key, id)
    ensureOffscreen()
      .then(() => recognize(id, message.maxMs, deps))
      .then(
        (response) => sendResponse(response),
        (error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'failed' }),
      )
      .finally(() => ids.delete(key))
    return true // the answer comes when the user has spoken
  }
  const id = ids.get(key)
  if (id !== undefined) {
    const type = message.type === 'listen-stop' ? 'recognize-stop' : 'recognize-cancel'
    toOffscreen({ target: 'offscreen', type, id }).catch(() => {})
  }
  sendResponse({ ok: true, text: null })
  return false
}

/** Tabs with Explore Mode on. Forgotten if the worker restarts, which only delays closing. */
const exploring = new Set<number>()

/**
 * Tracks Explore Mode per tab. Once no tab has it on, the microphone has no
 * reason to stay ready, so the offscreen document is closed. A tab turning it
 * off, or a new page starting, never cuts off another tab that is listening.
 */
export function noteExploreState(tabId: number, enabled: boolean): void {
  if (enabled) exploring.add(tabId)
  else exploring.delete(tabId)
  if (exploring.size > 0) return
  void chrome.offscreen
    .hasDocument()
    .then((open) => (open ? chrome.offscreen.closeDocument() : undefined))
    .catch(() => {})
}
