import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, parseSettings, saveSettings } from '../src/shared/settings'

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = { ...initial }
  return {
    data,
    get: async (key: string) => ({ [key]: data[key] }),
    set: async (items: Record<string, unknown>) => void Object.assign(data, items),
  }
}

describe('parseSettings', () => {
  it('returns defaults for missing or non-object input', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('nope')).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps valid values and replaces invalid ones with defaults', () => {
    const parsed = parseSettings({
      alwaysExplore: true,
      screenReaderMode: 'companion',
      speechRate: 99,
      touchActivation: 'lasers',
      hapticIntensity: 0.5,
    })
    expect(parsed.alwaysExplore).toBe(true)
    expect(parsed.screenReaderMode).toBe('companion')
    expect(parsed.speechRate).toBe(DEFAULT_SETTINGS.speechRate)
    expect(parsed.touchActivation).toBe('lift')
    expect(parsed.hapticIntensity).toBe(0.5)
  })

  it('defaults the voice settings, and rejects values out of range', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ voiceName: '', pitch: 1, volume: 1 })
    expect(parseSettings({ pitch: 1.5, volume: 0.4 })).toMatchObject({ pitch: 1.5, volume: 0.4 })
    expect(parseSettings({ pitch: 5 }).pitch).toBe(1)
    expect(parseSettings({ pitch: 0.1 }).pitch).toBe(1)
    expect(parseSettings({ volume: 2 }).volume).toBe(1)
    expect(parseSettings({ voiceName: 'Microsoft Zira' }).voiceName).toBe('Microsoft Zira')
    expect(parseSettings({ voiceName: 'x'.repeat(101) }).voiceName).toBe('')
    expect(parseSettings({ voiceName: 7 }).voiceName).toBe('')
  })

  it('keeps cloud voice and AI off by default, with sensible Gemini defaults', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      cloudVoice: 'off',
      cloudVoiceName: 'Kore',
      cloudVoiceModel: 'gemini-3.8-flash-lite-tts',
      aiAssist: false,
      aiModel: 'gemini-3.8-flash',
      latencyReadout: false,
    })
  })

  it('accepts the cloud voice scopes, and rejects anything else', () => {
    for (const scope of ['off', 'reading', 'all']) {
      expect(parseSettings({ cloudVoice: scope }).cloudVoice).toBe(scope)
    }
    expect(parseSettings({ cloudVoice: 'always' }).cloudVoice).toBe('off')
  })

  it('accepts plain voice and model names, and rejects anything that could change a request', () => {
    expect(parseSettings({ cloudVoiceName: 'Puck' }).cloudVoiceName).toBe('Puck')
    expect(parseSettings({ cloudVoiceName: 'Kore/../x' }).cloudVoiceName).toBe('Kore')
    expect(parseSettings({ cloudVoiceModel: 'gemini-3.8-flash-tts' }).cloudVoiceModel).toBe(
      'gemini-3.8-flash-tts',
    )
    expect(parseSettings({ cloudVoiceModel: 'a b' }).cloudVoiceModel).toBe('gemini-3.8-flash-lite-tts')
    expect(parseSettings({ aiModel: 'models/../x?key=1' }).aiModel).toBe('gemini-3.8-flash')
  })

  it('defaults to sound only, and accepts the other haptic drivers', () => {
    expect(DEFAULT_SETTINGS.hapticDriver).toBe('none')
    expect(DEFAULT_SETTINGS.hapticProfileId).toBe('')
    for (const driver of ['simulator', 'gamepad', 'webhid']) {
      expect(parseSettings({ hapticDriver: driver }).hapticDriver).toBe(driver)
    }
    expect(parseSettings({ hapticDriver: 'laser' }).hapticDriver).toBe('none')
  })

  it('accepts a profile id of lower case letters, digits and dashes only', () => {
    expect(parseSettings({ hapticProfileId: 'example-mouse-2' }).hapticProfileId).toBe('example-mouse-2')
    expect(parseSettings({ hapticProfileId: 'Not Valid!' }).hapticProfileId).toBe('')
    expect(parseSettings({ hapticProfileId: 42 }).hapticProfileId).toBe('')
  })

  it('defaults to echoing characters as they are typed, and accepts words or none', () => {
    expect(DEFAULT_SETTINGS.typingEcho).toBe('characters')
    expect(parseSettings({ typingEcho: 'words' }).typingEcho).toBe('words')
    expect(parseSettings({ typingEcho: 'none' }).typingEcho).toBe('none')
    expect(parseSettings({ typingEcho: 'sentences' }).typingEcho).toBe('characters')
  })

  it('defaults to Standalone, lift-to-activate and Explore Mode off', () => {
    expect(DEFAULT_SETTINGS.screenReaderMode).toBe('standalone')
    expect(DEFAULT_SETTINGS.touchActivation).toBe('lift')
    expect(DEFAULT_SETTINGS.alwaysExplore).toBe(false)
  })
})

describe('loadSettings and saveSettings', () => {
  it('loads defaults from an empty store', async () => {
    expect(await loadSettings(memoryStore())).toEqual(DEFAULT_SETTINGS)
  })

  it('saves a patch merged over the current settings', async () => {
    const store = memoryStore()
    const saved = await saveSettings(store, { shortMode: true })
    expect(saved.shortMode).toBe(true)
    expect((await loadSettings(store)).shortMode).toBe(true)
  })

  it('rejects an invalid patch and leaves the store unchanged', async () => {
    const store = memoryStore()
    await expect(saveSettings(store, { speechRate: 99 })).rejects.toThrow(RangeError)
    expect(store.data).toEqual({})
  })
})
