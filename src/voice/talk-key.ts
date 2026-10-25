import type { KeyLike } from '../key-router'

/** Push to talk: Alt+Shift+V held down (ADR-0017 #3). The physical key, so any keyboard layout works. */
export function isTalkKey(event: KeyLike): boolean {
  return event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyV'
}

/** Letting go of any of the three keys ends the request. */
export function endsTalk(event: Pick<KeyLike, 'key' | 'code'>): boolean {
  return event.code === 'KeyV' || event.key === 'Alt' || event.key === 'Shift'
}
