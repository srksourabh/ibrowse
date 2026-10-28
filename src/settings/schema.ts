import type { Settings } from '../shared/settings'

export const SETTING_GROUPS = [
  { id: 'speech', label: 'Speech' },
  { id: 'exploring', label: 'Exploring' },
  { id: 'voice', label: 'Voice commands' },
  { id: 'screenreader', label: 'Screen reader' },
  { id: 'haptics', label: 'Haptics' },
  { id: 'cloud', label: 'Cloud voice and AI' },
  { id: 'developer', label: 'Developer' },
] as const

export type SettingGroup = (typeof SETTING_GROUPS)[number]['id']

interface FieldBase {
  readonly key: Exclude<keyof Settings, 'hapticProfileId'>
  readonly label: string
  readonly group: SettingGroup
  /** One plain sentence on what it does. It is read out when the field gets focus. */
  readonly help: string
}

export type FieldSpec =
  | (FieldBase & { readonly kind: 'boolean' })
  | (FieldBase & {
      readonly kind: 'choice'
      readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>
    })
  | (FieldBase & {
      readonly kind: 'number'
      readonly min: number
      readonly max: number
      readonly step: number
    })
  | (FieldBase & { readonly kind: 'text'; readonly maxLength: number })

/**
 * Every setting a person can change, described once. The options page is built
 * from it, the spoken confirmations read from it, and the tests check it
 * against the validators, so none of the three can drift from the others.
 */
export const SETTINGS_FIELDS: readonly FieldSpec[] = [
  {
    key: 'speechRate', kind: 'number', group: 'speech', label: 'Speech rate', min: 0.5, max: 3, step: 0.1,
    help: 'How fast iBrowse speaks. One is normal.',
  },
  {
    key: 'pitch', kind: 'number', group: 'speech', label: 'Pitch', min: 0.5, max: 2, step: 0.1,
    help: 'How high or low the voice is. One is normal.',
  },
  {
    key: 'volume', kind: 'number', group: 'speech', label: 'Volume', min: 0, max: 1, step: 0.1,
    help: 'How loud iBrowse speaks, from silent to full.',
  },
  {
    key: 'voiceName', kind: 'text', group: 'speech', label: 'Local voice', maxLength: 100,
    help: 'The name of a voice installed on this computer. Leave it empty for the system default.',
  },
  {
    key: 'shortMode', kind: 'boolean', group: 'speech', label: 'Short announcements',
    help: 'Leave out the words "clickable" and "text only", and let the sounds say it.',
  },
  {
    key: 'alwaysExplore', kind: 'boolean', group: 'exploring', label: 'Start in Explore Mode on every page',
    help: 'Switch Explore Mode on automatically. Off, it starts only when you press Alt and I, or remembers what you chose on each website.',
  },
  {
    key: 'shortcutKeys', kind: 'choice', group: 'exploring', label: 'Shortcut keys',
    options: [
      { value: 'ctrl-alt', label: 'Control and Alt' },
      { value: 'alt-shift', label: 'Alt and Shift' },
    ],
    help:
      'The keys you hold for iBrowse shortcuts, such as the next heading. ' +
      'Alt and Shift also switch the keyboard language on Windows, so Control and Alt is safer.',
  },
  {
    key: 'touchActivation', kind: 'choice', group: 'exploring', label: 'Touch activation',
    options: [
      { value: 'lift', label: 'Double-tap to activate' },
      { value: 'direct', label: 'Direct tap' },
    ],
    help: 'Double-tap explores with a tap and activates with a double tap. Direct tap activates at once.',
  },
  {
    key: 'typingEcho', kind: 'choice', group: 'exploring', label: 'Typing echo',
    options: [
      { value: 'characters', label: 'Each character' },
      { value: 'words', label: 'Each word' },
      { value: 'none', label: 'Nothing' },
    ],
    help: 'What is spoken as you type in a form field. Passwords are never spoken.',
  },
  {
    key: 'screenReaderMode', kind: 'choice', group: 'screenreader', label: 'Screen reader mode',
    options: [
      { value: 'standalone', label: 'Standalone, spoken by iBrowse' },
      { value: 'companion', label: 'Companion, spoken by your screen reader' },
    ],
    help: 'Companion sends what iBrowse says to your screen reader, so there is one voice, not two.',
  },
  {
    key: 'hapticIntensity', kind: 'number', group: 'haptics', label: 'Haptic strength', min: 0, max: 1, step: 0.1,
    help: 'How strong the feeling is. Zero turns haptics off.',
  },
  {
    key: 'hapticDriver', kind: 'choice', group: 'haptics', label: 'Haptic device',
    options: [
      { value: 'none', label: 'Sound only' },
      { value: 'simulator', label: 'Sound simulator' },
      { value: 'gamepad', label: 'Game controller' },
      { value: 'webhid', label: 'Paired haptic device' },
    ],
    help: 'Pair a device on the hardware setup page, opened from the button below.',
  },
  {
    key: 'voiceInput', kind: 'choice', group: 'voice', label: 'Voice commands',
    options: [
      { value: 'off', label: 'Off' },
      { value: 'chrome', label: "On, with Chrome's speech recognition" },
      { value: 'gemini', label: 'On, with Google Gemini, using your key' },
    ],
    help: 'Speak commands and questions. Hold your shortcut keys and V to talk, or answer when iBrowse asks what to do.',
  },
  {
    key: 'cloudVoice', kind: 'choice', group: 'cloud', label: 'Cloud voice',
    options: [
      { value: 'off', label: 'Off, use the local voice' },
      { value: 'reading', label: 'For reading aloud only' },
      { value: 'all', label: 'For everything' },
    ],
    help: 'A more natural voice from Google. It needs your own key and sends the text it speaks to Google.',
  },
  {
    key: 'cloudVoiceName', kind: 'text', group: 'cloud', label: 'Cloud voice name', maxLength: 40,
    help: 'The Google voice to use, for example Kore, Puck or Charon.',
  },
  {
    key: 'cloudVoiceModel', kind: 'text', group: 'cloud', label: 'Cloud voice model', maxLength: 60,
    help: 'The Google speech model. The default is fast and low cost.',
  },
  {
    key: 'aiAssist', kind: 'boolean', group: 'cloud', label: 'AI descriptions and summaries',
    help: 'Describe images, summarise a page, and say what a page is for. It needs your own key.',
  },
  {
    key: 'aiModel', kind: 'text', group: 'cloud', label: 'AI model', maxLength: 60,
    help: 'The Google model used for descriptions and summaries.',
  },
  {
    key: 'latencyReadout', kind: 'boolean', group: 'developer', label: 'Measure delays',
    help: 'Keep a record of how long sounds and speech take to start, so it can be read out.',
  },
]

export function fieldFor(key: FieldSpec['key']): FieldSpec {
  const field = SETTINGS_FIELDS.find((f) => f.key === key)
  if (!field) throw new Error(`No field for setting "${key}"`)
  return field
}

function valueWords(field: FieldSpec, value: unknown): string {
  if (field.kind === 'boolean') return value ? 'on' : 'off'
  if (field.kind === 'choice') return field.options.find((o) => o.value === value)?.label ?? String(value)
  if (field.kind === 'number') return String(Number(Number(value).toFixed(2)))
  return value === '' ? 'the system default' : String(value)
}

/** What is spoken after a setting changes, for example "Speech rate: 1.5." */
export function confirmationFor(field: FieldSpec, value: unknown): string {
  return `${field.label}: ${valueWords(field, value)}.`
}

/** What is spoken when a setting gets focus: its name, its value, and what it does. */
export function focusDescription(field: FieldSpec, value: unknown): string {
  return `${confirmationFor(field, value)} ${field.help}`
}

const CLOUD_VOICE_WARNING =
  'Cloud voice sends the text it speaks to Google, to be turned into speech. ' +
  'That text comes from the pages you read. Your browser will ask for permission.'
const AI_WARNING =
  'AI features send page text and images to Google: part of each page you explore, so the briefing can say ' +
  'what the page is for, and more when you ask for a summary, an image description or an answer. ' +
  'Your browser will ask for permission.'

const VOICE_WARNING =
  'Voice commands use the microphone, only while iBrowse is listening. ' +
  'Chrome turns speech into text on this computer when it can; otherwise what you say is sent to Google for that. ' +
  'Your browser will ask to use the microphone.'

const GEMINI_VOICE_WARNING =
  'Voice commands with Gemini use the microphone, only while iBrowse is listening. ' +
  'iBrowse records what you say and sends it to Google, with your key, to be turned into text. ' +
  'Your browser will ask to use the microphone, and to contact Google.'

/** What must be said before a setting that sends data off this computer is switched on. */
export function warningFor(key: FieldSpec['key'], value: unknown): string | null {
  if (key === 'voiceInput' && value === 'gemini') return GEMINI_VOICE_WARNING
  if (key === 'voiceInput' && value !== 'off') return VOICE_WARNING
  if (key === 'cloudVoice' && value !== 'off') return CLOUD_VOICE_WARNING
  if (key === 'aiAssist' && value === true) return AI_WARNING
  return null
}
