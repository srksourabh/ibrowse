import { describe, expect, it, vi } from 'vitest'
import { HAPTIC_EFFECTS } from '../../src/haptics/events'
import { GamepadDriver, planRumble } from '../../src/haptics/gamepad-driver'

describe('planRumble', () => {
  it('uses the heavy motor for low thuds and the light motor for sharp ticks', () => {
    const [thud] = planRumble(HAPTIC_EFFECTS.boundary, 1)
    const [tick] = planRumble(HAPTIC_EFFECTS['word-tick'], 1)
    expect(thud!.strongMagnitude).toBeGreaterThan(thud!.weakMagnitude)
    expect(tick!.weakMagnitude).toBeGreaterThan(tick!.strongMagnitude)
  })

  it('makes one step per pulse, delayed by the pulses and gaps before it', () => {
    const steps = planRumble(HAPTIC_EFFECTS.boundary, 1)
    expect(steps.map((s) => [s.startDelayMs, s.durationMs])).toEqual([
      [0, 40],
      [60, 40],
    ])
  })

  it('scales the magnitudes by intensity', () => {
    const [full] = planRumble(HAPTIC_EFFECTS['action-confirm'], 1)
    const [half] = planRumble(HAPTIC_EFFECTS['action-confirm'], 0.5)
    expect(half!.strongMagnitude).toBeCloseTo(full!.strongMagnitude / 2)
    expect(half!.weakMagnitude).toBeCloseTo(full!.weakMagnitude / 2)
  })

  it('keeps every magnitude between 0 and 1', () => {
    for (const effect of Object.values(HAPTIC_EFFECTS)) {
      for (const step of planRumble(effect, 1)) {
        expect(step.strongMagnitude).toBeGreaterThanOrEqual(0)
        expect(step.strongMagnitude).toBeLessThanOrEqual(1)
        expect(step.weakMagnitude).toBeGreaterThanOrEqual(0)
        expect(step.weakMagnitude).toBeLessThanOrEqual(1)
      }
    }
  })
})

function setup(options: { pads?: unknown[]; rejects?: boolean } = {}) {
  const playEffect = vi.fn(async () => {
    if (options.rejects) throw new Error('unsupported')
    return 'complete'
  })
  const pads = options.pads ?? [{ connected: true, vibrationActuator: { playEffect } }]
  const listeners: Array<() => void> = []
  const driver = new GamepadDriver({
    getGamepads: () => pads as never,
    onGamepadDisconnected: (listener) => {
      listeners.push(listener)
      return () => {}
    },
  })
  return { driver, playEffect, unplug: () => listeners.forEach((l) => l()) }
}

describe('GamepadDriver', () => {
  it('identifies itself', () => {
    const { driver } = setup()
    expect(driver.id).toBe('gamepad')
    expect(driver.name).toBe('Game controller')
    expect(driver.capabilities()).toEqual({ events: 'all' })
  })

  it('connects even with no controller yet, because browsers hide controllers until a button is pressed', async () => {
    expect(await setup({ pads: [null] }).driver.connect()).toEqual({ ok: true })
  })

  it('fails to connect where the browser has no gamepad support', async () => {
    const driver = new GamepadDriver({
      getGamepads: undefined,
      onGamepadDisconnected: () => () => {},
    })
    const result = await driver.connect()
    expect(result.ok).toBe(false)
  })

  it('rumbles the controller, one dual-rumble effect per pulse', async () => {
    const { driver, playEffect } = setup()
    await driver.play('boundary', 1)
    expect(playEffect).toHaveBeenCalledTimes(2)
    expect(playEffect).toHaveBeenNthCalledWith(
      1,
      'dual-rumble',
      expect.objectContaining({ startDelay: 0, duration: 40 }),
    )
    expect(playEffect).toHaveBeenNthCalledWith(
      2,
      'dual-rumble',
      expect.objectContaining({ startDelay: 60, duration: 40 }),
    )
  })

  it('finds the first controller that can vibrate', async () => {
    const playEffect = vi.fn(async () => 'complete')
    const { driver } = setup({
      pads: [null, { connected: true }, { connected: true, vibrationActuator: { playEffect } }],
    })
    await driver.play('word-tick', 1)
    expect(playEffect).toHaveBeenCalled()
  })

  it('does nothing, quietly, when no controller is there to rumble', async () => {
    const { driver } = setup({ pads: [null] })
    await expect(driver.play('word-tick', 1)).resolves.toBeUndefined()
  })

  it('lets a failing controller reject, so the manager can drop it', async () => {
    const { driver } = setup({ rejects: true })
    await expect(driver.play('word-tick', 1)).rejects.toThrow()
  })

  it('reports a controller being unplugged', () => {
    const { driver, unplug } = setup()
    const listener = vi.fn()
    driver.onDisconnect(listener)
    unplug()
    expect(listener).toHaveBeenCalledOnce()
  })
})
