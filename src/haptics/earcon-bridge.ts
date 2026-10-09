import type { EarconName } from '../audio/earcons'
import { EARCON_TO_HAPTIC, type HapticEvent } from './events'
import type { HapticManager } from './manager'

/**
 * Makes every Earcon also fire its Haptic Event, so what is heard and what is
 * felt always agree and no caller has to remember both. The haptic goes first:
 * the browser may refuse to start sound before the first click, and the touch
 * feedback should not depend on that.
 */
export function withHaptics(
  earcons: { play(name: EarconName, pan: number): void },
  haptics: Pick<HapticManager, 'play'>,
): { play(name: EarconName, pan: number): void; haptic(event: HapticEvent): void } {
  return {
    play(name, pan) {
      haptics.play(EARCON_TO_HAPTIC[name])
      earcons.play(name, pan)
    },
    haptic: (event) => haptics.play(event),
  }
}
