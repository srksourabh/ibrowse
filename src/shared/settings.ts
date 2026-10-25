export interface Settings {
  readonly alwaysExplore: boolean
  readonly screenReaderMode: 'standalone' | 'companion'
  readonly shortMode: boolean
  readonly speechRate: number
  readonly touchActivation: 'lift' | 'direct'
  readonly hapticIntensity: number
  /** What is spoken as the user types in a form field. */
  readonly typingEcho: 'characters' | 'words' | 'none'
  /** Which haptic driver to use. 'none' is sound only, which is complete on its own. */
  readonly hapticDriver: 'none' | 'simulator' | 'gamepad' | 'webhid'
  /** The Device Profile used by the 'webhid' driver. */
  readonly hapticProfileId: string
  /** A local voice by name; empty means the system default. */
  readonly voiceName: string
  readonly pitch: number
  readonly volume: number
  /** Whether a cloud voice speaks: never, only long-form reading, or everything. */
  readonly cloudVoice: 'off' | 'reading' | 'all'
  readonly cloudVoiceName: string
  readonly cloudVoiceModel: string
  /** AI descriptions and summaries. Sends page text and images to the provider when used. */
  readonly aiAssist: boolean
  readonly aiModel: string
  /** Developer option: report speech and sound delays so they can be read out. */
  readonly latencyReadout: boolean
  /** Spoken commands and questions (ADR-0017). Off until the user allows the microphone. */
  readonly voiceInput: 'off' | 'chrome'
}

export const DEFAULT_SETTINGS: Settings = {
  alwaysExplore: false,
  screenReaderMode: 'standalone',
  shortMode: false,
  speechRate: 1,
  touchActivation: 'lift',
  hapticIntensity: 1,
  typingEcho: 'characters',
  hapticDriver: 'none',
  hapticProfileId: '',
  voiceName: '',
  pitch: 1,
  volume: 1,
  cloudVoice: 'off',
  cloudVoiceName: 'Kore',
  cloudVoiceModel: 'gemini-3.8-flash-lite-tts',
  aiAssist: false,
  aiModel: 'gemini-3.8-flash',
  latencyReadout: false,
  voiceInput: 'off',
}

const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'
const inRange =
  (min: number, max: number) =>
  (v: unknown): boolean =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const oneOf =
  (...options: readonly string[]) =>
  (v: unknown): boolean =>
    typeof v === 'string' && options.includes(v)

const VALIDATORS: Record<keyof Settings, (value: unknown) => boolean> = {
  alwaysExplore: isBoolean,
  screenReaderMode: oneOf('standalone', 'companion'),
  shortMode: isBoolean,
  speechRate: inRange(0.5, 3),
  touchActivation: oneOf('lift', 'direct'),
  hapticIntensity: inRange(0, 1),
  typingEcho: oneOf('characters', 'words', 'none'),
  hapticDriver: oneOf('none', 'simulator', 'gamepad', 'webhid'),
  hapticProfileId: (v) => typeof v === 'string' && /^[a-z0-9-]{0,40}$/.test(v),
  voiceName: (v) => typeof v === 'string' && v.length <= 100,
  pitch: inRange(0.5, 2),
  volume: inRange(0, 1),
  cloudVoice: oneOf('off', 'reading', 'all'),
  cloudVoiceName: (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v),
  cloudVoiceModel: (v) => typeof v === 'string' && /^[a-z0-9.-]{1,60}$/.test(v),
  aiAssist: isBoolean,
  aiModel: (v) => typeof v === 'string' && /^[a-z0-9.-]{1,60}$/.test(v),
  latencyReadout: isBoolean,
  voiceInput: oneOf('off', 'chrome'),
}

/** Builds Settings from untrusted stored data. Invalid fields fall back to defaults. */
export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS
  const input = raw as Record<string, unknown>
  const pick = <K extends keyof Settings>(key: K): Settings[K] => {
    const value = input[key]
    return VALIDATORS[key](value) ? (value as Settings[K]) : DEFAULT_SETTINGS[key]
  }
  return {
    alwaysExplore: pick('alwaysExplore'),
    screenReaderMode: pick('screenReaderMode'),
    shortMode: pick('shortMode'),
    speechRate: pick('speechRate'),
    touchActivation: pick('touchActivation'),
    hapticIntensity: pick('hapticIntensity'),
    typingEcho: pick('typingEcho'),
    hapticDriver: pick('hapticDriver'),
    hapticProfileId: pick('hapticProfileId'),
    voiceName: pick('voiceName'),
    pitch: pick('pitch'),
    volume: pick('volume'),
    cloudVoice: pick('cloudVoice'),
    cloudVoiceName: pick('cloudVoiceName'),
    cloudVoiceModel: pick('cloudVoiceModel'),
    aiAssist: pick('aiAssist'),
    aiModel: pick('aiModel'),
    latencyReadout: pick('latencyReadout'),
    voiceInput: pick('voiceInput'),
  }
}

/** The slice of chrome.storage.local the settings code uses. */
export interface KeyValueStore {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

const STORAGE_KEY = 'settings'

export async function loadSettings(store: KeyValueStore): Promise<Settings> {
  const stored = await store.get(STORAGE_KEY)
  return parseSettings(stored[STORAGE_KEY])
}

/** Validates the patch, merges it over the stored settings and saves. Throws RangeError on bad input. */
export async function saveSettings(
  store: KeyValueStore,
  patch: Partial<Settings>,
): Promise<Settings> {
  for (const [key, value] of Object.entries(patch)) {
    const validator = VALIDATORS[key as keyof Settings]
    if (!validator || !validator(value)) {
      // The value is deliberately left out of the message: settings may later hold keys.
      throw new RangeError(`Invalid value for setting "${key}"`)
    }
  }
  const merged: Settings = { ...(await loadSettings(store)), ...patch }
  await store.set({ [STORAGE_KEY]: merged })
  return merged
}
