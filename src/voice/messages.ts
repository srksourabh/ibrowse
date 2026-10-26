/** Content script to background: listen for one request (ADR-0017 #2). */
export type ListenRequest =
  | { readonly type: 'listen-start'; readonly id: number; readonly maxMs: number }
  | { readonly type: 'listen-stop'; readonly id: number }
  | { readonly type: 'listen-cancel'; readonly id: number }

/** Where speech was turned into text. */
export type RecognizerMode = 'on-device' | 'online' | 'gemini'

/**
 * What was heard (null for silence), or the recogniser's error code. `notice`
 * says where speech went, the first time each recogniser is used (ADR-0017 #6).
 */
export type ListenResponse =
  | { readonly ok: true; readonly text: string | null; readonly mode?: RecognizerMode; readonly notice?: string }
  | { readonly ok: false; readonly error: string }

/** Which recogniser the user chose (ADR-0017 #1). */
export type VoiceEngine = 'chrome' | 'gemini'

/** Background to the offscreen document, which alone may use the recogniser. */
export type OffscreenRequest =
  | {
      readonly target: 'offscreen'
      readonly type: 'recognize'
      readonly id: number
      readonly maxMs: number
      readonly engine: VoiceEngine
    }
  | { readonly target: 'offscreen'; readonly type: 'recognize-stop'; readonly id: number }
  | { readonly target: 'offscreen'; readonly type: 'recognize-cancel'; readonly id: number }

/** For Gemini the offscreen document records, and the worker, which holds the key, transcribes. */
export type RecordingResponse =
  | { readonly ok: true; readonly audio: string | null }
  | { readonly ok: false; readonly error: string }
