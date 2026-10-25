/** Content script to background: listen for one request (ADR-0017 #2). */
export type ListenRequest =
  | { readonly type: 'listen-start'; readonly id: number; readonly maxMs: number }
  | { readonly type: 'listen-stop'; readonly id: number }
  | { readonly type: 'listen-cancel'; readonly id: number }

/** What was heard (null for silence), or the recogniser's error code. */
export type ListenResponse =
  | { readonly ok: true; readonly text: string | null }
  | { readonly ok: false; readonly error: string }

/** Background to the offscreen document, which alone may use the recogniser. */
export type OffscreenRequest =
  | { readonly target: 'offscreen'; readonly type: 'recognize'; readonly id: number; readonly maxMs: number }
  | { readonly target: 'offscreen'; readonly type: 'recognize-stop'; readonly id: number }
  | { readonly target: 'offscreen'; readonly type: 'recognize-cancel'; readonly id: number }
