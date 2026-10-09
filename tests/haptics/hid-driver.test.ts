import { describe, expect, it, vi } from 'vitest'
import { HidDriver, type HidDeviceLike } from '../../src/haptics/hid-driver'
import type { DeviceProfile } from '../../src/haptics/profile'

const PROFILE: DeviceProfile = {
  schema: 1,
  id: 'example-mouse',
  name: 'Example Mouse',
  match: { vendorId: 0x1234, productId: 0x5678, usagePage: 0xff00 },
  reportId: 7,
  events: { 'enter-interactive': [1, 2, 3], boundary: [4, 5, 6] },
  intensity: { byteIndex: 2, max: 200 },
}

function fakeDevice(overrides: Partial<HidDeviceLike> = {}): HidDeviceLike & { opened: boolean } {
  const device = {
    vendorId: 0x1234,
    productId: 0x5678,
    productName: 'Example Mouse',
    opened: false,
    collections: [{ usagePage: 0xff00, usage: 1 }],
    open: vi.fn(async () => {
      device.opened = true
    }),
    close: vi.fn(async () => {
      device.opened = false
    }),
    sendReport: vi.fn(async () => {}),
    ...overrides,
  }
  return device as HidDeviceLike & { opened: boolean }
}

function setup(devices: HidDeviceLike[], profile = PROFILE) {
  const listeners: Array<(event: { device: HidDeviceLike }) => void> = []
  const hid = {
    getDevices: async () => devices,
    addEventListener: (_type: 'disconnect', fn: (e: { device: HidDeviceLike }) => void) => {
      listeners.push(fn)
    },
    removeEventListener: (_type: 'disconnect', fn: (e: { device: HidDeviceLike }) => void) => {
      listeners.splice(listeners.indexOf(fn), 1)
    },
  }
  return {
    driver: new HidDriver(profile, hid),
    unplug: (device: HidDeviceLike) => listeners.forEach((l) => l({ device })),
    listeners,
  }
}

describe('HidDriver.connect', () => {
  it('opens the granted device that matches the profile', async () => {
    const device = fakeDevice()
    const { driver } = setup([fakeDevice({ vendorId: 9 }), device])
    expect(await driver.connect()).toEqual({ ok: true })
    expect(device.open).toHaveBeenCalledOnce()
  })

  it('matches on the usage page when the profile gives one', async () => {
    const wrongPage = fakeDevice({ collections: [{ usagePage: 1, usage: 2 }] })
    const { driver } = setup([wrongPage])
    expect((await driver.connect()).ok).toBe(false)
  })

  it('does not reopen a device that is already open', async () => {
    const device = fakeDevice()
    device.opened = true
    await setup([device]).driver.connect()
    expect(device.open).not.toHaveBeenCalled()
  })

  it('says how to pair when no matching device has been granted', async () => {
    const result = await setup([]).driver.connect()
    expect(result.ok).toBe(false)
    expect(!result.ok && result.reason).toMatch(/Alt\+Shift\+P/)
  })

  it('explains when the device cannot be opened', async () => {
    const device = fakeDevice({
      open: vi.fn(async () => {
        throw new Error('busy')
      }),
    })
    const result = await setup([device]).driver.connect()
    expect(!result.ok && result.reason).toMatch(/could not open/i)
  })
})

describe('HidDriver.play', () => {
  it('sends the profile report, with the intensity written in', async () => {
    const device = fakeDevice()
    const { driver } = setup([device])
    await driver.connect()
    await driver.play('enter-interactive', 0.5)
    expect(device.sendReport).toHaveBeenCalledWith(7, new Uint8Array([1, 2, 100]))
  })

  it('sends nothing for an event the profile does not define', async () => {
    const device = fakeDevice()
    const { driver } = setup([device])
    await driver.connect()
    await driver.play('word-tick', 1)
    expect(device.sendReport).not.toHaveBeenCalled()
  })

  it('does nothing before it is connected', async () => {
    const device = fakeDevice()
    const { driver } = setup([device])
    await driver.play('boundary', 1)
    expect(device.sendReport).not.toHaveBeenCalled()
  })

  it('lets a failed write reject, so the manager can drop the device', async () => {
    const device = fakeDevice({
      sendReport: vi.fn(async () => {
        throw new Error('write failed')
      }),
    })
    const { driver } = setup([device])
    await driver.connect()
    await expect(driver.play('boundary', 1)).rejects.toThrow('write failed')
  })
})

describe('HidDriver other', () => {
  it('names itself after the profile and offers only the events the profile defines', () => {
    const { driver } = setup([])
    expect(driver.id).toBe('example-mouse')
    expect(driver.name).toBe('Example Mouse')
    expect(driver.capabilities()).toEqual({ events: ['enter-interactive', 'boundary'] })
  })

  it('closes the device when disconnected', async () => {
    const device = fakeDevice()
    const { driver } = setup([device])
    await driver.connect()
    await driver.disconnect()
    expect(device.close).toHaveBeenCalledOnce()
  })

  it('tells listeners when its own device is unplugged, but not another one', async () => {
    const device = fakeDevice()
    const { driver, unplug } = setup([device])
    await driver.connect()
    const listener = vi.fn()
    driver.onDisconnect(listener)
    unplug(fakeDevice({ vendorId: 99 }))
    expect(listener).not.toHaveBeenCalled()
    unplug(device)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('stops listening when told to', async () => {
    const { driver, listeners } = setup([])
    const stop = driver.onDisconnect(() => {})
    expect(listeners).toHaveLength(1)
    stop()
    expect(listeners).toHaveLength(0)
  })
})
