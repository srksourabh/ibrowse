import { describe, expect, it, vi } from 'vitest'
import { EARCON_NAMES } from '../../src/audio/earcons'
import { withHaptics } from '../../src/haptics/earcon-bridge'
import { EARCON_TO_HAPTIC } from '../../src/haptics/events'

describe('withHaptics', () => {
  it('plays the Earcon and the matching Haptic Event together', () => {
    const earcons = { play: vi.fn() }
    const haptics = { play: vi.fn() }
    withHaptics(earcons, haptics).play('interactive', 0.5)
    expect(earcons.play).toHaveBeenCalledWith('interactive', 0.5)
    expect(haptics.play).toHaveBeenCalledWith('enter-interactive')
  })

  it('does this for every Earcon', () => {
    for (const name of EARCON_NAMES) {
      const haptics = { play: vi.fn() }
      withHaptics({ play: vi.fn() }, haptics).play(name, 0)
      expect(haptics.play, name).toHaveBeenCalledWith(EARCON_TO_HAPTIC[name])
    }
  })

  it('still plays the haptic when the browser will not let the sound start', () => {
    const haptics = { play: vi.fn() }
    const earcons = {
      play: () => {
        throw new Error('The AudioContext was not allowed to start')
      },
    }
    expect(() => withHaptics(earcons, haptics).play('tick', 0)).toThrow()
    expect(haptics.play).toHaveBeenCalledWith('word-tick')
  })

  it('exposes a way to fire a Haptic Event that has no Earcon', () => {
    const haptics = { play: vi.fn() }
    withHaptics({ play: vi.fn() }, haptics).haptic('page-change')
    expect(haptics.play).toHaveBeenCalledWith('page-change')
  })
})
