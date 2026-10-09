export type KeyAction =
  | 'brief-detailed'
  | 'read-from-here'
  | 'next-page'
  | 'prev-page'
  | 'next-heading'
  | 'prev-heading'
  | 'next-landmark'
  | 'prev-landmark'
  | 'where-am-i'
  | 'describe-this'
  | 'summarize-page'
  | 'stop-speech'

export interface KeyLike {
  readonly key: string
  readonly code: string
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
}

const CHORD_ACTIONS: Readonly<Record<string, KeyAction>> = {
  KeyB: 'brief-detailed',
  KeyR: 'read-from-here',
  ArrowRight: 'next-page',
  ArrowLeft: 'prev-page',
  ArrowDown: 'next-heading',
  ArrowUp: 'prev-heading',
  PageDown: 'next-landmark',
  PageUp: 'prev-landmark',
  KeyW: 'where-am-i',
  KeyD: 'describe-this',
  KeyM: 'summarize-page',
}

/**
 * Maps a key press to an Explore Mode command. Chords use the physical key
 * (`code`) so they work on any layout. Anything with Ctrl or Meta is left to
 * the browser.
 */
export function routeKey(event: KeyLike): KeyAction | null {
  if (event.ctrlKey || event.metaKey) return null
  if (event.altKey && event.shiftKey) return CHORD_ACTIONS[event.code] ?? null
  return event.key === 'Escape' && !event.altKey && !event.shiftKey ? 'stop-speech' : null
}
