import { describe, expect, it, vi } from 'vitest'
import { HidHost } from '../../src/haptics/hid-host'
import type { HidDeviceLike } from '../../src/haptics/hid-driver'
import type { DeviceProfile } from '../../src/haptics/profile'

const PROFILE: DeviceProfile = {
  schema: 1,
  id: 'example-mouse',
  name: 'Example Mouse',
  match: { vendorId: 0x1234 },
  reportId: 3,
  events: { boundary: [9, 9] },
}

function setup(
  options: {
    profileId?: string
    profiles?: DeviceProfile[]
    devices?: HidDeviceLike[]
    noHid?: boolean
    sendFails?: boolean
  } = {},
) {
  const device = {
    vendorId: 0x1234,
    productId: 1,
    opened: false,
    open: vi.fn(async () => {
      device.opened = true
    }),
    close: vi.fn(async () => {
      device.opened = false
    }),
    sendReport: vi.fn(async () => {
      if (options.sendFails) throw new Error('write failed')
    }),
  }
  const getDevices = vi.fn(async () => options.devices ?? [device as HidDeviceLike])
  const disconnectListeners: Array<(e: { device: HidDeviceLike }) => void> = []
  const onDisconnected = vi.fn()
  const hid = {
    getDevices,
    addEventListener: (_t: 'disconnect', l: (e: { device: HidDeviceLike }) => void) =>
      void disconnectListeners.push(l),
    removeEventListener: (_t: 'disconnect', l: (e: { device: HidDeviceLike }) => void) =>
      void disconnectListeners.splice(disconnectListeners.indexOf(l), 1),
  }
  const host = new HidHost({
    loadSettings: async () => ({ hapticProfileId: options.profileId ?? 'example-mouse' }),
    loadProfiles: async () => options.profiles ?? [PROFILE],
    hid: options.noHid ? undefined : hid,
    onDisconnected,
  })
  return {
    host,
    device,
    getDevices,
    onDisconnected,
    unplug: () => disconnectListeners.forEach((l) => l({ device: device as HidDeviceLike })),
  }
}

describe('HidHost.connect', () => {
  it('connects the device named by the saved profile', async () => {
    const { host, device } = setup()
    expect(await host.connect()).toEqual({ ok: true })
    expect(device.open).toHaveBeenCalledOnce()
  })

  it('says to run hardware setup when nothing has been paired', async () => {
    const result = await setup({ profileId: '' }).host.connect()
    expect(!result.ok && result.reason).toMatch(/Alt\+Shift\+P/)
  })

  it('says to run hardware setup when the saved profile has gone', async () => {
    const result = await setup({ profiles: [] }).host.connect()
    expect(!result.ok && result.reason).toMatch(/Alt\+Shift\+P/)
  })

  it('says so where the browser has no WebHID', async () => {
    const result = await setup({ noHid: true }).host.connect()
    expect(!result.ok && result.reason).toMatch(/does not support/i)
  })

  it('passes on the reason when the device has not been granted', async () => {
    const result = await setup({ devices: [] }).host.connect()
    expect(!result.ok && result.reason).toMatch(/Alt\+Shift\+P/)
  })

  it('does nothing more when already connected', async () => {
    const { host, device } = setup()
    await host.connect()
    await host.connect()
    expect(device.open).toHaveBeenCalledOnce()
  })
})

describe('HidHost.play', () => {
  it('sends the profile report', async () => {
    const { host, device } = setup()
    expect(await host.play('boundary', 1)).toEqual({ ok: true })
    expect(device.sendReport).toHaveBeenCalledWith(3, new Uint8Array([9, 9]))
  })

  it('connects by itself, because the worker may have been restarted since', async () => {
    const { host, device } = setup()
    await host.play('boundary', 1)
    expect(device.open).toHaveBeenCalledOnce()
  })

  it('connects only once when many effects arrive at the same time', async () => {
    const { host, getDevices } = setup()
    await Promise.all([host.play('boundary', 1), host.play('boundary', 1), host.play('boundary', 1)])
    expect(getDevices).toHaveBeenCalledOnce()
  })

  it('reports a device that does not respond, and tries again next time', async () => {
    const { host, getDevices } = setup({ sendFails: true })
    const result = await host.play('boundary', 1)
    expect(!result.ok && result.reason).toMatch(/did not respond/i)
    await host.play('boundary', 1)
    expect(getDevices).toHaveBeenCalledTimes(2)
  })

  it('passes on the reason when it cannot connect', async () => {
    const result = await setup({ profileId: '' }).host.play('boundary', 1)
    expect(result.ok).toBe(false)
  })
})

describe('HidHost lifecycle', () => {
  it('tells its owner when the device is unplugged, and connects afresh afterwards', async () => {
    const { host, unplug, onDisconnected, getDevices } = setup()
    await host.connect()
    unplug()
    expect(onDisconnected).toHaveBeenCalledOnce()
    await host.connect()
    expect(getDevices).toHaveBeenCalledTimes(2)
  })

  it('closes the device on disconnect', async () => {
    const { host, device } = setup()
    await host.connect()
    await host.disconnect()
    expect(device.close).toHaveBeenCalledOnce()
  })
})
