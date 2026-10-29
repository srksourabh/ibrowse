import { holdsChord, type KeyLike, type ShortcutKeys } from '../key-router'

/** Push to talk: the shortcut modifiers and V held down (ADR-0017 #3). The physical key, so any keyboard layout works. */
export function isTalkKey(event: KeyLike, keys: ShortcutKeys): boolean {
  return holdsChord(event, keys) && event.code === 'KeyV'
}

const HELD: Readonly<Record<ShortcutKeys, readonly string[]>> = {
  'ctrl-alt': ['Control', 'Alt'],
  'alt-shift': ['Alt', 'Shift'],
}

/** Letting go of V or either held modifier ends the request. */
export function endsTalk(event: Pick<KeyLike, 'key' | 'code'>, keys: ShortcutKeys): boolean {
  return event.code === 'KeyV' || HELD[keys].includes(event.key)
}
