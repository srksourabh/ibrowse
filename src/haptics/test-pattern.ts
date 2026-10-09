import { HAPTIC_EVENTS, type HapticEvent } from './events'

/** What each event stands for, in words a person can match to what they feel. */
export const HAPTIC_LABELS: Readonly<Record<HapticEvent, string>> = {
  'enter-interactive': 'Over a button or link',
  'enter-static': 'Over plain text',
  'word-tick': 'A word, while reading',
  boundary: 'The end of a block of text',
  'edge-cross': 'An edge, or a new block',
  'action-confirm': 'An action done',
  error: 'An error',
  'page-change': 'A new page',
}

/** Long enough for the label to be spoken, and well over any cool-down. */
const PAUSE_MS = 1500

export interface TestPatternDeps {
  speak(text: string): void
  play(event: HapticEvent): void
  wait(ms: number): Promise<void>
}

/** Plays every Haptic Event in turn, naming each aloud, so a new device can be checked by feel. */
export async function runTestPattern(deps: TestPatternDeps): Promise<void> {
  for (const event of HAPTIC_EVENTS) {
    deps.speak(HAPTIC_LABELS[event])
    deps.play(event)
    await deps.wait(PAUSE_MS)
  }
}
