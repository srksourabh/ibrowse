// The offscreen document: the only place the extension may run the speech recogniser (ADR-0017 #2).
// It holds no page content; it turns one spoken request at a time into text for the background worker.
import { ChromeRecognizer, chooseMode, type RecognitionClass } from '../../src/voice/chrome-recognizer'
import type { Listening } from '../../src/voice/listening'
import type { ListenResponse, OffscreenRequest } from '../../src/voice/messages'

const scope = globalThis as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass }
const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition
const active = new Map<number, Listening>()
let recognizer: Promise<ChromeRecognizer> | null = null

function start(id: number, maxMs: number, respond: (r: ListenResponse) => void): void {
  if (!Recognition) {
    respond({ ok: false, error: 'unsupported' })
    return
  }
  const lang = navigator.language
  recognizer ??= chooseMode(Recognition, lang).then((mode) => new ChromeRecognizer(Recognition, lang, mode))
  void recognizer.then((r) => {
    const listening = r.listen({ maxMs })
    active.set(id, listening)
    listening.result
      .then(
        (text) => respond({ ok: true, text }),
        (error: unknown) => respond({ ok: false, error: error instanceof Error ? error.message : 'failed' }),
      )
      .finally(() => active.delete(id))
  })
}

chrome.runtime.onMessage.addListener((message: OffscreenRequest, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.target !== 'offscreen') return false
  switch (message.type) {
    case 'recognize':
      start(message.id, message.maxMs, sendResponse)
      return true // the answer comes when the user has spoken
    case 'recognize-stop':
      active.get(message.id)?.stop()
      return false
    case 'recognize-cancel':
      active.get(message.id)?.cancel()
      return false
  }
})
