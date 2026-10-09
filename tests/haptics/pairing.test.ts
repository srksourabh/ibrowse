import { describe, expect, it, vi } from 'vitest'
import { PairingController } from '../../src/haptics/pairing'
import { loadSettings } from '../../src/shared/settings'
import { saveProfile, type DeviceProfile } from '../../src/haptics/profile'

const PROFILE: DeviceProfile = {
  schema: 1,
  id: 'example-mouse',
  name: 'Example Mouse',
  match: { vendorId: 0x1234, productId: 0x5678 },
  reportId: 1,
  events: { boundary: [1, 2, 3] },
}

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = { ...initial }
  return {
    data,
    get: async (key: string) => ({ [key]: data[key] }),
    set: async (items: Record<string, unknown>) => void Object.assign(data, items),
  }
}

function setup(
  options: {
    hid?: { requestDevice: ReturnType<typeof vi.fn> } | null
    pads?: unknown[]
  } = {},
) {
  const store = memoryStore()
  const speak = vi.fn()
  const playTest = vi.fn(async () => {})
  const hid =
    options.hid === null
      ? undefined
      : (options.hid ?? { requestDevice: vi.fn(async () => [{ productName: 'Example Mouse' }]) })
  const pairing = new PairingController({
    speak,
    store,
    hid: hid as never,
    getGamepads: () => (options.pads ?? [null]) as never,
    playTest,
  })
  const said = () => speak.mock.calls.map((c) => c[0] as string).join(' | ')
  return { pairing, store, speak, playTest, said, hid }
}

describe('PairingController.describeOptions', () => {
  it('lists every choice and how to use the page', () => {
    const text = setup().pairing.describeOptions()
    for (const phrase of ['sound only', 'sound simulator', 'game controller', 'paired haptic device', 'Tab', 'Enter']) {
      expect(text, phrase).toContain(phrase)
    }
  })
})

describe('PairingController.choose', () => {
  it('saves sound only and says so', async () => {
    const { pairing, store, said } = setup()
    await pairing.choose('none')
    expect((await loadSettings(store)).hapticDriver).toBe('none')
    expect(said()).toMatch(/sound only/i)
  })

  it('saves the simulator', async () => {
    const { pairing, store, said } = setup()
    await pairing.choose('simulator')
    expect((await loadSettings(store)).hapticDriver).toBe('simulator')
    expect(said()).toMatch(/simulator/i)
  })

  it('saves the game controller, and says to press a button when none is visible yet', async () => {
    const { pairing, store, said } = setup({ pads: [null] })
    await pairing.choose('gamepad')
    expect((await loadSettings(store)).hapticDriver).toBe('gamepad')
    expect(said()).toMatch(/press a button/i)
  })

  it('does not nag about a button when a controller that can vibrate is already there', async () => {
    const { pairing, said } = setup({ pads: [{ vibrationActuator: { playEffect: () => {} } }] })
    await pairing.choose('gamepad')
    expect(said()).not.toMatch(/press a button/i)
  })
})

describe('PairingController.importProfile', () => {
  it('saves a valid profile and says its name', async () => {
    const { pairing, said } = setup()
    expect(await pairing.importProfile(JSON.stringify(PROFILE))).toBe(true)
    expect(said()).toContain('Imported Example Mouse')
    expect(await pairing.listProfiles()).toHaveLength(1)
  })

  it('says when the text is not JSON', async () => {
    const { pairing, said } = setup()
    expect(await pairing.importProfile('{nope')).toBe(false)
    expect(said()).toMatch(/not valid JSON/i)
  })

  it('reads out the first problems with an invalid profile', async () => {
    const { pairing, said } = setup()
    expect(await pairing.importProfile(JSON.stringify({ ...PROFILE, id: 'BAD', name: '' }))).toBe(false)
    expect(said()).toMatch(/not valid/i)
    expect(said()).toMatch(/id/)
  })

  it('reads out at most three problems', async () => {
    const { pairing, said } = setup()
    await pairing.importProfile(JSON.stringify({ a: 1, b: 2, c: 3, d: 4, e: 5 }))
    expect((said().match(/unknown field/g) ?? []).length).toBeLessThanOrEqual(3)
  })
})

describe('PairingController.pairDevice', () => {
  it('asks the browser for a matching device, and saves the choice', async () => {
    const { pairing, store, hid, said } = setup()
    await saveProfile(store, PROFILE)
    await pairing.pairDevice('example-mouse')
    expect(hid!.requestDevice).toHaveBeenCalledWith({
      filters: [{ vendorId: 0x1234, productId: 0x5678 }],
    })
    const settings = await loadSettings(store)
    expect(settings.hapticDriver).toBe('webhid')
    expect(settings.hapticProfileId).toBe('example-mouse')
    expect(said()).toContain('Paired Example Mouse')
  })

  it('says when the user chose no device', async () => {
    const hid = { requestDevice: vi.fn(async () => []) }
    const { pairing, store, said } = setup({ hid })
    await saveProfile(store, PROFILE)
    await pairing.pairDevice('example-mouse')
    expect(said()).toMatch(/no device was chosen/i)
    expect((await loadSettings(store)).hapticDriver).toBe('none')
  })

  it('treats cancelling the browser chooser as no device', async () => {
    const hid = {
      requestDevice: vi.fn(async () => {
        throw new DOMException('cancelled', 'NotFoundError')
      }),
    }
    const { pairing, store, said } = setup({ hid })
    await saveProfile(store, PROFILE)
    await pairing.pairDevice('example-mouse')
    expect(said()).toMatch(/no device was chosen/i)
  })

  it('says when the browser refuses access', async () => {
    const hid = {
      requestDevice: vi.fn(async () => {
        throw new DOMException('blocked', 'SecurityError')
      }),
    }
    const { pairing, store, said } = setup({ hid })
    await saveProfile(store, PROFILE)
    await pairing.pairDevice('example-mouse')
    expect(said()).toMatch(/did not allow/i)
  })

  it('says when there is no such profile, and when the browser cannot pair hardware', async () => {
    const a = setup()
    await a.pairing.pairDevice('missing')
    expect(a.said()).toMatch(/import/i)

    const b = setup({ hid: null })
    await saveProfile(b.store, PROFILE)
    await b.pairing.pairDevice('example-mouse')
    expect(b.said()).toMatch(/does not support/i)
  })
})

describe('PairingController.test', () => {
  it('says it is playing a test pattern and plays it', async () => {
    const { pairing, playTest, said } = setup()
    await pairing.choose('simulator')
    await pairing.test()
    expect(said()).toMatch(/test pattern/i)
    expect(playTest).toHaveBeenCalledOnce()
  })

  it('says there is nothing to feel, and plays nothing, when sound only is selected', async () => {
    const { pairing, playTest, said } = setup()
    await pairing.test()
    expect(said()).toMatch(/nothing to feel/i)
    expect(playTest).not.toHaveBeenCalled()
  })
})
