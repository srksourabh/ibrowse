import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HapticDriver } from '../../src/haptics/driver'
import { HAPTIC_EFFECTS } from '../../src/haptics/events'
import { HapticManager } from '../../src/haptics/manager'

function fakeDriver(overrides: Partial<HapticDriver> = {}) {
  const disconnectListeners: Array<() => void> = []
  const driver: HapticDriver = {
    id: 'fake',
    name: 'Fake',
    capabilities: () => ({ events: 'all' }),
    connect: vi.fn(async () => ({ ok: true as const })),
    disconnect: vi.fn(async () => {}),
    play: vi.fn(),
    onDisconnect: (listener) => {
      disconnectListeners.push(listener)
      return () => {}
    },
    ...overrides,
  }
  return { driver, unplug: () => disconnectListeners.forEach((l) => l()) }
}

let clock = 0
let intensity = 1
const onProblem = vi.fn()

function manager() {
  return new HapticManager({ getIntensity: () => intensity, onProblem, now: () => clock })
}

beforeEach(() => {
  clock = 1000
  intensity = 1
  onProblem.mockClear()
})

describe('HapticManager.use', () => {
  it('connects the driver and plays through it', async () => {
    const { driver } = fakeDriver()
    const m = manager()
    await m.use(driver)
    m.play('word-tick')
    expect(driver.connect).toHaveBeenCalledOnce()
    expect(driver.play).toHaveBeenCalledWith('word-tick', 1)
  })

  it('reports why a driver could not connect, and stays silent', async () => {
    const { driver } = fakeDriver({
      connect: async () => ({ ok: false as const, reason: 'No paired device.' }),
    })
    const m = manager()
    await m.use(driver)
    m.play('boundary')
    expect(onProblem).toHaveBeenCalledWith('No paired device.')
    expect(driver.play).not.toHaveBeenCalled()
  })

  it('reports a driver that throws while connecting', async () => {
    const { driver } = fakeDriver({
      connect: async () => {
        throw new Error('boom')
      },
    })
    await manager().use(driver)
    expect(onProblem).toHaveBeenCalledWith(expect.stringContaining('Haptic'))
  })

  it('disconnects the driver it replaces', async () => {
    const a = fakeDriver()
    const b = fakeDriver()
    const m = manager()
    await m.use(a.driver)
    await m.use(b.driver)
    expect(a.driver.disconnect).toHaveBeenCalledOnce()
  })

  it('can be switched off by using nothing', async () => {
    const { driver } = fakeDriver()
    const m = manager()
    await m.use(driver)
    await m.use(null)
    m.play('word-tick')
    expect(driver.play).not.toHaveBeenCalled()
    expect(driver.disconnect).toHaveBeenCalledOnce()
  })
})

describe('HapticManager.play', () => {
  it('scales the effect by the intensity setting', async () => {
    const { driver } = fakeDriver()
    const m = manager()
    await m.use(driver)
    intensity = 0.4
    m.play('word-tick')
    expect(driver.play).toHaveBeenCalledWith('word-tick', 0.4)
  })

  it('plays nothing when the intensity is zero', async () => {
    const { driver } = fakeDriver()
    const m = manager()
    await m.use(driver)
    intensity = 0
    m.play('word-tick')
    expect(driver.play).not.toHaveBeenCalled()
  })

  it('does nothing without a driver', () => {
    expect(() => manager().play('word-tick')).not.toThrow()
  })

  it('holds back the same event inside its cool-down, but not other events', async () => {
    const { driver } = fakeDriver()
    const m = manager()
    await m.use(driver)
    m.play('word-tick')
    clock += HAPTIC_EFFECTS['word-tick'].cooldownMs - 1
    m.play('word-tick')
    m.play('boundary')
    expect(driver.play).toHaveBeenCalledTimes(2)
    clock += 5
    m.play('word-tick')
    expect(driver.play).toHaveBeenCalledTimes(3)
  })

  it('skips events the driver says it cannot do', async () => {
    const { driver } = fakeDriver({
      capabilities: () => ({ events: ['boundary'] as const }),
    })
    const m = manager()
    await m.use(driver)
    m.play('word-tick')
    m.play('boundary')
    expect(driver.play).toHaveBeenCalledTimes(1)
    expect(driver.play).toHaveBeenCalledWith('boundary', 1)
  })

  it('reports a failing driver once and carries on without it', async () => {
    const { driver } = fakeDriver({
      play: () => {
        throw new Error('write failed')
      },
    })
    const m = manager()
    await m.use(driver)
    m.play('word-tick')
    clock += 1000
    m.play('word-tick')
    expect(onProblem).toHaveBeenCalledTimes(1)
  })

  it('reports a driver whose play rejects', async () => {
    const { driver } = fakeDriver({ play: async () => Promise.reject(new Error('x')) })
    const m = manager()
    await m.use(driver)
    m.play('word-tick')
    await vi.waitFor(() => expect(onProblem).toHaveBeenCalledTimes(1))
  })

  it('says so, once, when the device is unplugged, and stops playing', async () => {
    const { driver, unplug } = fakeDriver()
    const m = manager()
    await m.use(driver)
    unplug()
    expect(onProblem).toHaveBeenCalledWith(expect.stringMatching(/disconnected/i))
    m.play('word-tick')
    expect(driver.play).not.toHaveBeenCalled()
  })
})
