import type { HapticDriver } from './driver'
import { HAPTIC_EVENTS, type HapticEvent } from './events'

export interface ConformanceResult {
  readonly name: string
  readonly status: 'pass' | 'fail' | 'skip'
  readonly detail?: string
}

export interface ConformanceReport {
  /** True when nothing failed. Skipped checks do not count against a driver. */
  readonly passed: boolean
  readonly results: readonly ConformanceResult[]
}

const ID_PATTERN = /^[a-z0-9-]{1,40}$/
const IN_RANGE_INTENSITIES = [0, 0.5, 1]
const OUT_OF_RANGE_INTENSITIES = [-1, 2, Number.NaN, Number.POSITIVE_INFINITY]

const pass = (name: string): ConformanceResult => ({ name, status: 'pass' })
const fail = (name: string, detail: string): ConformanceResult => ({ name, status: 'fail', detail })
const skip = (name: string, detail: string): ConformanceResult => ({ name, status: 'skip', detail })
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

function supportedEvents(driver: HapticDriver): HapticEvent[] {
  const { events } = driver.capabilities()
  const known = (events === 'all' ? [...HAPTIC_EVENTS] : events) as readonly string[]
  return HAPTIC_EVENTS.filter((event) => known.includes(event))
}

async function tryPlaying(
  driver: HapticDriver,
  events: readonly HapticEvent[],
  intensities: readonly number[],
): Promise<string | null> {
  try {
    for (const event of events) {
      for (const intensity of intensities) await driver.play(event, intensity)
    }
    return null
  } catch (error) {
    return messageOf(error)
  }
}

function checkIdentity(driver: HapticDriver): ConformanceResult {
  const name = 'has a lower-case id and a name'
  return ID_PATTERN.test(driver.id) && driver.name.trim() !== ''
    ? pass(name)
    : fail(name, `id "${driver.id}", name "${driver.name}"`)
}

function checkCapabilities(driver: HapticDriver): ConformanceResult {
  const name = 'declares known events'
  const { events } = driver.capabilities()
  if (events === 'all') return pass(name)
  const unknown = events.filter((e) => !(HAPTIC_EVENTS as readonly string[]).includes(e))
  return events.length > 0 && unknown.length === 0
    ? pass(name)
    : fail(name, unknown.length > 0 ? `unknown: ${unknown.join(', ')}` : 'no events declared')
}

function checkUnsubscribe(driver: HapticDriver): ConformanceResult {
  const name = 'returns a function to stop listening for disconnects'
  return typeof driver.onDisconnect(() => {}) === 'function'
    ? pass(name)
    : fail(name, 'onDisconnect must return an unsubscribe function')
}

/**
 * Runs a driver through the contract. Third parties call this in their own
 * tests, usually with a fake device behind the driver. If the driver cannot
 * connect (no device), the playing checks are skipped, not failed.
 */
export async function runConformance(driver: HapticDriver): Promise<ConformanceReport> {
  const results: ConformanceResult[] = [checkIdentity(driver), checkCapabilities(driver), checkUnsubscribe(driver)]

  const connectName = 'connects, or says why not'
  let connected = false
  try {
    const result = await driver.connect()
    if (result.ok) {
      connected = true
      results.push(pass(connectName))
    } else if (typeof result.reason === 'string' && result.reason.trim() !== '') {
      results.push(pass(connectName))
    } else {
      results.push(fail(connectName, 'a failed connect must give a reason to speak'))
    }
  } catch (error) {
    results.push(fail(connectName, `connect threw: ${messageOf(error)}`))
  }

  results.push(...(await playChecks(driver, connected)))
  return { passed: results.every((r) => r.status !== 'fail'), results }
}

async function playChecks(driver: HapticDriver, connected: boolean): Promise<ConformanceResult[]> {
  const names = [
    'plays every supported event without throwing',
    'copes with an out-of-range intensity',
    'survives being played after disconnect',
  ] as const
  if (!connected) return names.map((name) => skip(name, 'not connected'))

  const events = supportedEvents(driver)
  const playError = await tryPlaying(driver, events, IN_RANGE_INTENSITIES)
  if (playError !== null) {
    return [fail(names[0], playError), skip(names[1], 'playing failed'), skip(names[2], 'playing failed')]
  }
  const rangeError = await tryPlaying(driver, events.slice(0, 1), OUT_OF_RANGE_INTENSITIES)

  let afterError: string | null
  try {
    await driver.disconnect()
    afterError = await tryPlaying(driver, events.slice(0, 1), [1])
  } catch (error) {
    afterError = `disconnect threw: ${messageOf(error)}`
  }
  return [
    pass(names[0]),
    rangeError === null ? pass(names[1]) : fail(names[1], rangeError),
    afterError === null ? pass(names[2]) : fail(names[2], afterError),
  ]
}
