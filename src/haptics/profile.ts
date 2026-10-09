import type { KeyValueStore } from '../shared/settings'
import { HAPTIC_EVENTS, type HapticEvent } from './events'

/** Which attached device a profile is for. */
export interface DeviceMatch {
  readonly vendorId: number
  readonly productId?: number
  readonly usagePage?: number
  readonly usage?: number
}

/**
 * A description of a haptic device, as JSON, so hardware makers can add a
 * device without writing code: the raw report to send for each event.
 */
export interface DeviceProfile {
  readonly schema: 1
  /** Lower case letters, digits and dashes. */
  readonly id: string
  readonly name: string
  readonly match: DeviceMatch
  /** The HID output report id. */
  readonly reportId: number
  /** The report bytes for each event the device can express. */
  readonly events: Readonly<Partial<Record<HapticEvent, readonly number[]>>>
  /** If given, this byte of each report is replaced by the intensity, scaled to 0..max. */
  readonly intensity?: { readonly byteIndex: number; readonly max: number }
}

export type ProfileValidation =
  | { readonly ok: true; readonly profile: DeviceProfile }
  | { readonly ok: false; readonly errors: string[] }

const MAX_REPORT_BYTES = 64
const TOP_LEVEL_FIELDS = new Set(['schema', 'id', 'name', 'match', 'reportId', 'events', 'intensity'])
const ID_PATTERN = /^[a-z0-9-]{1,40}$/

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isWhole = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

function matchErrors(match: unknown): string[] {
  if (!isRecord(match)) return ['match must be an object with a vendorId']
  const errors: string[] = []
  if (!isWhole(match.vendorId, 0, 0xffff)) {
    errors.push('match.vendorId must be a whole number from 0 to 65535')
  }
  for (const key of ['productId', 'usagePage', 'usage']) {
    if (match[key] !== undefined && !isWhole(match[key], 0, 0xffff)) {
      errors.push(`match.${key} must be a whole number from 0 to 65535`)
    }
  }
  return errors
}

function eventErrors(events: unknown): string[] {
  if (!isRecord(events) || Object.keys(events).length === 0) {
    return ['events must name at least one event']
  }
  const errors: string[] = []
  for (const [name, bytes] of Object.entries(events)) {
    if (!(HAPTIC_EVENTS as readonly string[]).includes(name)) {
      errors.push(`unknown event "${name}"`)
    } else if (
      !Array.isArray(bytes) ||
      bytes.length < 1 ||
      bytes.length > MAX_REPORT_BYTES ||
      !bytes.every((b) => isWhole(b, 0, 255))
    ) {
      errors.push(`event "${name}" must be 1 to ${MAX_REPORT_BYTES} bytes, each 0 to 255`)
    }
  }
  return errors
}

function intensityErrors(intensity: unknown, events: unknown): string[] {
  if (intensity === undefined) return []
  if (!isRecord(intensity)) return ['intensity must be an object with byteIndex and max']
  const errors: string[] = []
  if (!isWhole(intensity.max, 1, 255)) errors.push('intensity.max must be a whole number from 1 to 255')
  const byteIndex = intensity.byteIndex
  if (!isWhole(byteIndex, 0, MAX_REPORT_BYTES - 1)) {
    errors.push('intensity.byteIndex must be a whole number inside the report')
  } else if (
    isRecord(events) &&
    Object.values(events).some((bytes) => Array.isArray(bytes) && byteIndex >= bytes.length)
  ) {
    errors.push('intensity.byteIndex must lie inside every event report')
  }
  return errors
}

/** Checks untrusted JSON. Lists every problem, in plain words, so the user can fix them in one go. */
export function validateDeviceProfile(raw: unknown): ProfileValidation {
  if (!isRecord(raw)) return { ok: false, errors: ['profile must be an object'] }
  const errors: string[] = []
  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_FIELDS.has(key)) errors.push(`unknown field "${key}"`)
  }
  if (raw.schema !== 1) errors.push('schema must be 1')
  if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) {
    errors.push('id must be 1 to 40 lower case letters, digits or dashes')
  }
  if (typeof raw.name !== 'string' || raw.name.trim() === '' || raw.name.length > 80) {
    errors.push('name must be 1 to 80 characters')
  }
  if (!isWhole(raw.reportId, 0, 255)) errors.push('reportId must be a whole number from 0 to 255')
  errors.push(...matchErrors(raw.match), ...eventErrors(raw.events), ...intensityErrors(raw.intensity, raw.events))
  return errors.length > 0 ? { ok: false, errors } : { ok: true, profile: raw as unknown as DeviceProfile }
}

/** The report to send for an event, with the intensity written in. Null if the profile has no such event. */
export function encodeEvent(
  profile: DeviceProfile,
  event: HapticEvent,
  intensity: number,
): Uint8Array<ArrayBuffer> | null {
  const template = profile.events[event]
  if (!template) return null
  const report = Uint8Array.from(template)
  if (profile.intensity) {
    const level = Number.isFinite(intensity) ? Math.min(1, Math.max(0, intensity)) : 0
    report[profile.intensity.byteIndex] = Math.round(level * profile.intensity.max)
  }
  return report
}

const STORAGE_KEY = 'hapticProfiles'

/** The saved profiles. Entries that no longer validate are dropped rather than breaking everything. */
export async function loadProfiles(store: KeyValueStore): Promise<DeviceProfile[]> {
  const stored = (await store.get(STORAGE_KEY))[STORAGE_KEY]
  if (!Array.isArray(stored)) return []
  return stored.flatMap((entry) => {
    const result = validateDeviceProfile(entry)
    return result.ok ? [result.profile] : []
  })
}

/** Adds a profile, replacing one with the same id. Throws with the reasons if it is not valid. */
export async function saveProfile(store: KeyValueStore, profile: DeviceProfile): Promise<void> {
  const result = validateDeviceProfile(profile)
  if (!result.ok) throw new Error(result.errors.join('. '))
  const others = (await loadProfiles(store)).filter((p) => p.id !== profile.id)
  await store.set({ [STORAGE_KEY]: [...others, profile] })
}

export async function removeProfile(store: KeyValueStore, id: string): Promise<void> {
  const remaining = (await loadProfiles(store)).filter((p) => p.id !== id)
  await store.set({ [STORAGE_KEY]: remaining })
}
