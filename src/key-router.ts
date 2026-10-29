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
  /** Turns Explore Mode off from the page; turning it on is a browser command, since nothing listens while off. */
  | 'explore-off'
  | 'open-settings'
  | 'open-hardware'
  /** Push to talk pressed and let go inside an iframe, carried out by the top frame. */
  | 'talk-start'
  | 'talk-end'

/**
 * The modifiers held for every in-page shortcut. Ctrl+Alt is the default because
 * Alt+Shift switches the keyboard language on Windows (ADR-0018); Alt+Shift is
 * kept for people who learned it.
 */
export type ShortcutKeys = 'ctrl-alt' | 'alt-shift'

export interface KeyLike {
  readonly key: string
  readonly code: string
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  /** AltGr, which arrives as Ctrl+Alt on Windows but types a character. */
  readonly altGraph?: boolean
}

export interface KeyContext {
  readonly keys: ShortcutKeys
  /** Focus is in a text field, where Ctrl+Alt and a letter may type a character. */
  readonly typing: boolean
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
  KeyE: 'explore-off',
  KeyS: 'open-settings',
  KeyP: 'open-hardware',
}

/** Exactly the chosen modifiers are held, and AltGr is not one of them. */
export function holdsChord(event: KeyLike, keys: ShortcutKeys): boolean {
  if (event.metaKey || event.altGraph) return false
  return keys === 'ctrl-alt'
    ? event.ctrlKey && event.altKey && !event.shiftKey
    : event.altKey && event.shiftKey && !event.ctrlKey
}

/**
 * Maps a key press to an Explore Mode command. Chords use the physical key
 * (`code`) so they work on any layout.
 */
export function routeKey(event: KeyLike, context: KeyContext): KeyAction | null {
  if (holdsChord(event, context.keys)) {
    // A letter typed with Ctrl+Alt in a field may be a character on Indian and European layouts.
    if (context.typing && context.keys === 'ctrl-alt' && event.code.startsWith('Key')) return null
    return CHORD_ACTIONS[event.code] ?? null
  }
  const bare = !event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey
  return bare && event.key === 'Escape' ? 'stop-speech' : null
}

const MODIFIER_WORDS: Readonly<Record<ShortcutKeys, string>> = {
  'ctrl-alt': 'Control, Alt',
  'alt-shift': 'Alt, Shift',
}

/** A chord as it should be heard: "Control, Alt and D". A voice reads "Ctrl+Alt+D" as "plus". */
export function chordWords(keys: ShortcutKeys, key: string): string {
  return `${MODIFIER_WORDS[keys]} and ${key}`
}
