import type { ListenRequest, ListenResponse } from '../voice/messages'
import { VoiceRelay } from '../voice/voice-relay'

const OFFSCREEN_URL = 'offscreen.html'
/** Large and random, so ids from before a worker restart are never reused. */
const ID_SPACE = 1_000_000_000

let creating: Promise<void> | null = null

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

function closeOffscreen(): void {
  void chrome.offscreen
    .hasDocument()
    .then((open) => (open ? chrome.offscreen.closeDocument() : undefined))
    .catch(() => {})
}

/** Wires the voice relay to Chrome. `transcribe` uses the cloud host, which holds the key. */
export function createVoiceHost(deps: {
  engine: () => Promise<'off' | 'chrome' | 'gemini'>
  transcribe: (audio: string) => Promise<ListenResponse>
}): VoiceRelay {
  return new VoiceRelay({
    ...deps,
    ensureOffscreen,
    closeOffscreen,
    toOffscreen: (request) => chrome.runtime.sendMessage(request),
    firstId: Math.floor(Math.random() * ID_SPACE),
  })
}

/** Relays a page's request to listen, and its answer back. */
export function handleListen(
  relay: VoiceRelay,
  message: ListenRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: ListenResponse) => void,
): boolean {
  const key = `${sender.tab?.id ?? -1}:${sender.frameId ?? 0}:${message.id}`
  if (message.type === 'listen-start') {
    relay.start(key, message.maxMs).then(sendResponse, (error: unknown) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : 'failed' }),
    )
    return true // the answer comes when the user has spoken
  }
  relay.control(key, message.type === 'listen-stop' ? 'stop' : 'cancel')
  sendResponse({ ok: true, text: null })
  return false
}
