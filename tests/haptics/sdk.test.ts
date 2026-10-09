import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as sdk from '../../src/haptics'
import { HAPTIC_EVENTS } from '../../src/haptics/events'
import { validateDeviceProfile } from '../../src/haptics/profile'
import { ExampleMouseDriver, type ExampleTransport } from '../../sdk/examples/example-driver'

const root = path.resolve(__dirname, '../..')
const readJson = (relative: string): any => JSON.parse(readFileSync(path.join(root, relative), 'utf8'))

describe('the public API', () => {
  it('exports exactly what the SDK promises', () => {
    expect(Object.keys(sdk).sort()).toEqual(
      [
        'HAPTIC_EFFECTS',
        'HAPTIC_EVENTS',
        'effectDurationMs',
        'encodeEvent',
        'planRumble',
        'renderHaptic',
        'runConformance',
        'validateDeviceProfile',
      ].sort(),
    )
  })
})

describe('the device profile schema', () => {
  const schema = readJson('sdk/device-profile.schema.json')

  it('lists the same top-level fields as the validator', () => {
    expect(Object.keys(schema.properties).sort()).toEqual(
      ['events', 'id', 'intensity', 'match', 'name', 'reportId', 'schema'].sort(),
    )
    expect(schema.additionalProperties).toBe(false)
  })

  it('lists the same events as the vocabulary', () => {
    expect(Object.keys(schema.properties.events.properties).sort()).toEqual([...HAPTIC_EVENTS].sort())
    expect(schema.properties.events.additionalProperties).toBe(false)
  })

  it('agrees with the validator on the limits', () => {
    expect(schema.properties.schema.const).toBe(1)
    expect(schema.properties.reportId.maximum).toBe(255)
    expect(schema.properties.match.properties.vendorId.maximum).toBe(65535)
    expect(schema.properties.intensity.properties.max.maximum).toBe(255)
  })

  it('gives every event the same report shape, with the validator limits', () => {
    for (const event of HAPTIC_EVENTS) {
      expect(schema.properties.events.properties[event].$ref, event).toBe('#/$defs/report')
    }
    const report = schema.$defs.report
    expect(report.minItems).toBe(1)
    expect(report.maxItems).toBe(64)
    expect(report.items).toMatchObject({ type: 'integer', minimum: 0, maximum: 255 })
  })
})

describe('the example profile', () => {
  it('is valid', () => {
    const result = validateDeviceProfile(readJson('sdk/examples/example-haptic-mouse.profile.json'))
    expect(result.ok, JSON.stringify(!result.ok && result.errors)).toBe(true)
  })

  it('uses only the events of the vocabulary', () => {
    const profile = readJson('sdk/examples/example-haptic-mouse.profile.json')
    for (const event of Object.keys(profile.events)) expect(HAPTIC_EVENTS).toContain(event)
  })
})

describe('the example driver', () => {
  function transport(overrides: Partial<ExampleTransport> = {}) {
    const written: Uint8Array[] = []
    const closeListeners: Array<() => void> = []
    const t: ExampleTransport = {
      open: async () => true,
      write: async (bytes) => void written.push(bytes),
      close: async () => {},
      onClose: (listener) => {
        closeListeners.push(listener)
        return () => {}
      },
      ...overrides,
    }
    return { t, written, unplug: () => closeListeners.forEach((l) => l()) }
  }

  it('passes the conformance harness against a working device', async () => {
    const report = await sdk.runConformance(new ExampleMouseDriver(transport().t))
    expect(report.results.filter((r) => r.status === 'fail')).toEqual([])
    expect(report.passed).toBe(true)
    expect(report.results.every((r) => r.status === 'pass')).toBe(true)
  })

  it('passes, with the playing checks skipped, when no device is attached', async () => {
    const report = await sdk.runConformance(
      new ExampleMouseDriver(transport({ open: async () => false }).t),
    )
    expect(report.passed).toBe(true)
    expect(report.results.some((r) => r.status === 'skip')).toBe(true)
  })

  it('writes a three-byte report: a marker, the event code and the intensity', async () => {
    const { t, written } = transport()
    const driver = new ExampleMouseDriver(t)
    await driver.connect()
    await driver.play('boundary', 1)
    await driver.play('boundary', 0)
    expect(written).toHaveLength(2)
    expect(written[0]![0]).toBe(0x01)
    expect(written[0]![1]).toBe(written[1]![1]) // the same event has the same code
    expect(written[0]![2]).toBe(255)
    expect(written[1]![2]).toBe(0)
  })

  it('writes nothing before it is connected, or after it is disconnected', async () => {
    const { t, written } = transport()
    const driver = new ExampleMouseDriver(t)
    await driver.play('boundary', 1)
    await driver.connect()
    await driver.disconnect()
    await driver.play('boundary', 1)
    expect(written).toHaveLength(0)
  })

  it('tells listeners when the device is unplugged', async () => {
    const { t, unplug } = transport()
    const driver = new ExampleMouseDriver(t)
    await driver.connect()
    let lost = 0
    driver.onDisconnect(() => lost++)
    unplug()
    expect(lost).toBe(1)
  })
})
