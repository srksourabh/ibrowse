import { describe, expect, it } from 'vitest'
import {
  encodeEvent,
  loadProfiles,
  removeProfile,
  saveProfile,
  validateDeviceProfile,
  type DeviceProfile,
} from '../../src/haptics/profile'

const VALID = {
  schema: 1,
  id: 'example-mouse',
  name: 'Example Mouse',
  match: { vendorId: 0x1234, productId: 0x5678, usagePage: 0xff00 },
  reportId: 1,
  events: { 'enter-interactive': [1, 2, 3], boundary: [1, 9, 9] },
  intensity: { byteIndex: 2, max: 255 },
}

const errorsFor = (profile: unknown): string[] => {
  const result = validateDeviceProfile(profile)
  return result.ok ? [] : result.errors
}

describe('validateDeviceProfile', () => {
  it('accepts a good profile and returns it', () => {
    const result = validateDeviceProfile(VALID)
    expect(result.ok).toBe(true)
    expect(result.ok && result.profile.name).toBe('Example Mouse')
  })

  it('accepts a profile with no productId, usage page or intensity byte', () => {
    const { productId: _p, usagePage: _u, ...match } = VALID.match
    const { intensity: _i, ...rest } = VALID
    expect(validateDeviceProfile({ ...rest, match }).ok).toBe(true)
  })

  it('rejects anything that is not an object', () => {
    for (const bad of [null, 'x', 5, [], undefined]) {
      expect(errorsFor(bad)[0]).toMatch(/object/i)
    }
  })

  it('requires schema 1', () => {
    expect(errorsFor({ ...VALID, schema: 2 }).join()).toMatch(/schema/i)
  })

  it('requires a short lower-case id', () => {
    for (const id of ['Example', 'has space', '', 'x'.repeat(41)]) {
      expect(errorsFor({ ...VALID, id }).join(), id).toMatch(/id/i)
    }
  })

  it('requires a name', () => {
    expect(errorsFor({ ...VALID, name: '' }).join()).toMatch(/name/i)
  })

  it('requires a 16-bit vendor id and, if given, product id', () => {
    expect(errorsFor({ ...VALID, match: { vendorId: 70000 } }).join()).toMatch(/vendorId/)
    expect(errorsFor({ ...VALID, match: { vendorId: 1.5 } }).join()).toMatch(/vendorId/)
    expect(errorsFor({ ...VALID, match: { vendorId: 1, productId: -1 } }).join()).toMatch(/productId/)
  })

  it('requires a report id from 0 to 255', () => {
    expect(errorsFor({ ...VALID, reportId: 256 }).join()).toMatch(/reportId/)
  })

  it('requires at least one event, and only known ones', () => {
    expect(errorsFor({ ...VALID, events: {} }).join()).toMatch(/event/i)
    expect(errorsFor({ ...VALID, events: { wiggle: [1] } }).join()).toMatch(/wiggle/)
  })

  it('requires each event to be 1 to 64 bytes', () => {
    expect(errorsFor({ ...VALID, events: { boundary: [] } }).join()).toMatch(/boundary/)
    expect(errorsFor({ ...VALID, events: { boundary: [256] } }).join()).toMatch(/boundary/)
    expect(errorsFor({ ...VALID, events: { boundary: ['a'] } }).join()).toMatch(/boundary/)
    expect(errorsFor({ ...VALID, events: { boundary: new Array(65).fill(1) } }).join()).toMatch(
      /boundary/,
    )
  })

  it('requires the intensity byte to lie inside every event', () => {
    expect(
      errorsFor({ ...VALID, intensity: { byteIndex: 3, max: 255 } }).join(),
    ).toMatch(/intensity/i)
    expect(errorsFor({ ...VALID, intensity: { byteIndex: 0, max: 0 } }).join()).toMatch(/intensity/i)
  })

  it('rejects unknown top-level fields, which are usually typos', () => {
    expect(errorsFor({ ...VALID, reportid: 1 }).join()).toMatch(/reportid/)
  })

  it('lists every problem, not just the first', () => {
    expect(errorsFor({ ...VALID, id: 'BAD', name: '' }).length).toBeGreaterThanOrEqual(2)
  })
})

describe('encodeEvent', () => {
  const profile = validateDeviceProfile(VALID).ok ? (VALID as unknown as DeviceProfile) : (null as never)

  it('returns the event bytes as a fresh array', () => {
    const bytes = encodeEvent(profile, 'enter-interactive', 1)!
    expect(bytes).toBeInstanceOf(Uint8Array)
    bytes[0] = 99
    expect(profile.events['enter-interactive']).toEqual([1, 2, 3])
  })

  it('writes the intensity into the byte the profile names', () => {
    expect(Array.from(encodeEvent(profile, 'enter-interactive', 1)!)).toEqual([1, 2, 255])
    expect(Array.from(encodeEvent(profile, 'enter-interactive', 0.5)!)).toEqual([1, 2, 128])
    expect(Array.from(encodeEvent(profile, 'enter-interactive', 0)!)).toEqual([1, 2, 0])
  })

  it('clamps an out-of-range intensity', () => {
    expect(encodeEvent(profile, 'boundary', 5)![2]).toBe(255)
    expect(encodeEvent(profile, 'boundary', -3)![2]).toBe(0)
  })

  it('leaves the bytes alone when the profile has no intensity byte', () => {
    const { intensity: _i, ...rest } = VALID
    const plain = rest as unknown as DeviceProfile
    expect(Array.from(encodeEvent(plain, 'boundary', 0.3)!)).toEqual([1, 9, 9])
  })

  it('returns null for an event the profile does not define', () => {
    expect(encodeEvent(profile, 'word-tick', 1)).toBeNull()
  })
})

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = { ...initial }
  return {
    data,
    get: async (key: string) => ({ [key]: data[key] }),
    set: async (items: Record<string, unknown>) => void Object.assign(data, items),
  }
}

describe('stored profiles', () => {
  const profile = VALID as unknown as DeviceProfile

  it('starts empty', async () => {
    expect(await loadProfiles(memoryStore())).toEqual([])
  })

  it('saves a profile and loads it back', async () => {
    const store = memoryStore()
    await saveProfile(store, profile)
    expect(await loadProfiles(store)).toEqual([profile])
  })

  it('replaces a profile with the same id', async () => {
    const store = memoryStore()
    await saveProfile(store, profile)
    await saveProfile(store, { ...profile, name: 'Renamed' })
    const loaded = await loadProfiles(store)
    expect(loaded).toHaveLength(1)
    expect(loaded[0]!.name).toBe('Renamed')
  })

  it('removes a profile by id', async () => {
    const store = memoryStore()
    await saveProfile(store, profile)
    await removeProfile(store, 'example-mouse')
    expect(await loadProfiles(store)).toEqual([])
  })

  it('drops stored entries that no longer validate, instead of failing', async () => {
    const store = memoryStore({ hapticProfiles: [VALID, { schema: 9 }, 'junk'] })
    expect(await loadProfiles(store)).toHaveLength(1)
  })

  it('refuses to save an invalid profile', async () => {
    await expect(saveProfile(memoryStore(), { ...profile, id: 'BAD' })).rejects.toThrow(/id/i)
  })
})
