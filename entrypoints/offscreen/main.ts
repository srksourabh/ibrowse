// The offscreen document: the only place the extension may use the microphone (ADR-0017 #2).
// It holds no page content and no key. For Chrome's recogniser it turns one spoken request into
// text; for Gemini it records the request, and the background worker, which holds the key, transcribes it.
import { ChromeRecognizer, chooseMode, type RecognitionClass } from '../../src/voice/chrome-recognizer'
import type { ListenResponse, OffscreenRequest, RecordingResponse } from '../../src/voice/messages'
import { recordingToAudio } from '../../src/voice/wav'
import { SAMPLE_RATE, recordMicrophone } from './recorder'

interface Control {
  stop(): void
  cancel(): void
}

const scope = globalThis as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass }
const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition
const active = new Map<number, Control>()
/** A stop or cancel that arrived before its request had started. */
const early = new Map<number, 'stop' | 'cancel'>()
let recognizer: Promise<ChromeRecognizer> | null = null

const codeOf = (error: unknown): string => (error instanceof Error ? error.message : 'failed')

function begin(id: number, control: Control): void {
  active.set(id, control)
  const pending = early.get(id)
  early.delete(id)
  if (pending) control[pending]()
}

function listenWithChrome(id: number, maxMs: number, respond: (r: ListenResponse) => void): void {
  if (!Recognition) {
    respond({ ok: false, error: 'unsupported' })
    return
  }
  const lang = navigator.language
  recognizer ??= chooseMode(Recognition, lang).then((mode) => new ChromeRecognizer(Recognition, lang, mode))
  recognizer
    .then((r) => {
      const listening = r.listen({ maxMs })
      begin(id, listening)
      return listening.result.finally(() => active.delete(id))
    })
    // The page is always answered, so its listening can never hang.
    .then((text) => respond({ ok: true, text }), (error: unknown) => respond({ ok: false, error: codeOf(error) }))
}

function recordForGemini(id: number, maxMs: number, respond: (r: RecordingResponse) => void): void {
  const recording = recordMicrophone(maxMs)
  begin(id, recording)
  recording.samples
    .then(
      (samples) => respond({ ok: true, audio: recordingToAudio(samples, SAMPLE_RATE) }),
      (error: unknown) => respond({ ok: false, error: codeOf(error) }),
    )
    .finally(() => active.delete(id))
}

function control(id: number, action: 'stop' | 'cancel'): void {
  const running = active.get(id)
  if (running) running[action]()
  else early.set(id, action)
}

chrome.runtime.onMessage.addListener((message: OffscreenRequest, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.target !== 'offscreen') return false
  switch (message.type) {
    case 'recognize':
      if (message.engine === 'gemini') recordForGemini(message.id, message.maxMs, sendResponse)
      else listenWithChrome(message.id, message.maxMs, sendResponse)
      return true // the answer comes when the user has spoken
    case 'recognize-stop':
      control(message.id, 'stop')
      return false
    case 'recognize-cancel':
      control(message.id, 'cancel')
      return false
  }
})
