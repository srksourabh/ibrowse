import { describe, expect, it, vi } from 'vitest'
import type { HapticResponse } from '../../src/haptics/messages'
import { RelayDriver } from '../../src/haptics/relay-driver'

const ok: HapticResponse = { ok: true }

describe('RelayDriver', () => {
  it('asks the background worker to connect, and passes its answer on', async () => {
    const send = vi.fn(async () => ok)
    expect(await new RelayDriver(send).connect()).toEqual({ ok: true })
    expect(send).toHaveBeenCalledWith({ type: 'haptic-connect' })

    const refused = new RelayDriver(async () => ({ ok: false, reason: 'No paired device.' }))
    expect(await refused.connect()).toEqual({ ok: false, reason: 'No paired device.' })
  })

  it('turns a failed message into a spoken reason, not an exception', async () => {
    const driver = new RelayDriver(async () => {
      throw new Error('worker asleep')
    })
    const result = await driver.connect()
    expect(result.ok).toBe(false)
    expect(!result.ok && result.reason).toMatch(/haptic/i)
  })

  it('sends each event with its intensity', async () => {
    const send = vi.fn(async () => ok)
    await new RelayDriver(send).play('boundary', 0.7)
    expect(send).toHaveBeenCalledWith({ type: 'haptic-play', event: 'boundary', intensity: 0.7 })
  })

  it('rejects if the background worker could not play it, so the manager can drop the driver', async () => {
    const driver = new RelayDriver(async () => ({ ok: false, reason: 'unplugged' }))
    await expect(driver.play('boundary', 1)).rejects.toThrow('unplugged')
  })

  it('asks the background worker to let go of the device on disconnect', async () => {
    const send = vi.fn(async () => ok)
    await new RelayDriver(send).disconnect()
    expect(send).toHaveBeenCalledWith({ type: 'haptic-disconnect' })
  })

  it('leaves it to the device in the background to say which events it supports', () => {
    expect(new RelayDriver(async () => ok).capabilities()).toEqual({ events: 'all' })
  })

  it('tells listeners when the background worker says the device went away', () => {
    const driver = new RelayDriver(async () => ok)
    const listener = vi.fn()
    const stop = driver.onDisconnect(listener)
    driver.handleDisconnected()
    expect(listener).toHaveBeenCalledOnce()
    stop()
    driver.handleDisconnected()
    expect(listener).toHaveBeenCalledOnce()
  })
})
