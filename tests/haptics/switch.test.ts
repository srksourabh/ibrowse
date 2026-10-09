import { describe, expect, it, vi } from 'vitest'
import type { HapticDriver } from '../../src/haptics/driver'
import { HapticSwitch } from '../../src/haptics/switch'

const driver = (id: string): HapticDriver => ({
  id,
  name: id,
  capabilities: () => ({ events: 'all' }),
  connect: async () => ({ ok: true }),
  disconnect: async () => {},
  play: () => {},
  onDisconnect: () => () => {},
})

function setup() {
  const use = vi.fn(async (_driver: HapticDriver | null) => {})
  const create = vi.fn((kind: string) => (kind === 'none' ? null : driver(kind)))
  const haptics = new HapticSwitch({ manager: { use }, create: create as never })
  return { haptics, use, create }
}

describe('HapticSwitch', () => {
  it('does nothing while Explore Mode is off, however the settings change', async () => {
    const { haptics, use, create } = setup()
    await haptics.setSettings({ hapticDriver: 'gamepad', hapticProfileId: '' })
    expect(use).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('brings up the chosen driver when Explore Mode turns on', async () => {
    const { haptics, use } = setup()
    await haptics.setSettings({ hapticDriver: 'gamepad', hapticProfileId: '' })
    await haptics.setActive(true)
    expect(use).toHaveBeenCalledOnce()
    expect(use.mock.calls[0]![0]?.id).toBe('gamepad')
  })

  it('lets the driver go when Explore Mode turns off', async () => {
    const { haptics, use } = setup()
    await haptics.setSettings({ hapticDriver: 'gamepad', hapticProfileId: '' })
    await haptics.setActive(true)
    await haptics.setActive(false)
    expect(use).toHaveBeenLastCalledWith(null)
  })

  it('does not reconnect when nothing relevant changed', async () => {
    const { haptics, use } = setup()
    await haptics.setSettings({ hapticDriver: 'gamepad', hapticProfileId: '' })
    await haptics.setActive(true)
    await haptics.setSettings({ hapticDriver: 'gamepad', hapticProfileId: '' })
    await haptics.setActive(true)
    expect(use).toHaveBeenCalledOnce()
  })

  it('switches driver when the setting changes while Explore Mode is on', async () => {
    const { haptics, use } = setup()
    await haptics.setSettings({ hapticDriver: 'gamepad', hapticProfileId: '' })
    await haptics.setActive(true)
    await haptics.setSettings({ hapticDriver: 'simulator', hapticProfileId: '' })
    expect(use.mock.calls.map((c) => c[0]?.id)).toEqual(['gamepad', 'simulator'])
  })

  it('reconnects when a different device profile is chosen', async () => {
    const { haptics, use } = setup()
    await haptics.setSettings({ hapticDriver: 'webhid', hapticProfileId: 'a' })
    await haptics.setActive(true)
    await haptics.setSettings({ hapticDriver: 'webhid', hapticProfileId: 'b' })
    expect(use).toHaveBeenCalledTimes(2)
  })

  it('uses no driver for sound only', async () => {
    const { haptics, use } = setup()
    await haptics.setSettings({ hapticDriver: 'none', hapticProfileId: '' })
    await haptics.setActive(true)
    expect(use).toHaveBeenCalledWith(null)
  })

  it('does nothing when switched on before any settings have arrived', async () => {
    const { haptics, use } = setup()
    await haptics.setActive(true)
    expect(use).not.toHaveBeenCalled()
  })
})
