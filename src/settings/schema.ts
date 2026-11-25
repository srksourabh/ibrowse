import type { Settings } from '../shared/settings'

export const SETTING_GROUPS = [
  {
    id: 'speech',
    label: 'Speech',
    description: 'Control how iBrowse sounds — reading speed, pitch, volume, and local Indian English voice.',
  },
  {
    id: 'exploring',
    label: 'Exploring',
    description: 'Choose how Explore Mode starts and how you interact with pages using keyboard, mouse, or touch.',
  },
  {
    id: 'voice',
    label: 'Voice commands',
    description: 'Talk to iBrowse to click buttons, scroll, read aloud, or ask questions about the page.',
  },
  {
    id: 'screenreader',
    label: 'Screen reader',
    description: 'Let iBrowse speak in its own voice, or pass everything to NVDA, JAWS, or VoiceOver.',
  },
  {
    id: 'haptics',
    label: 'Haptics',
    description: 'Optional gentle vibration cues when your pointer crosses buttons, links, or page edges.',
  },
  {
    id: 'cloud',
    label: 'Cloud voice and AI',
    description: 'Optional Google Gemini Live voice (fast, natural Indian English) and quick AI page summaries.',
  },
  {
    id: 'developer',
    label: 'Developer',
    description: 'Diagnostic tools for checking how quickly sounds and speech start on your computer.',
  },
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
    help: 'Optional name of a voice installed on this computer. Leave empty to use an Indian English voice automatically when available.',
  },
  {
    key: 'shortMode', kind: 'boolean', group: 'speech', label: 'Short announcements',
    help: 'Leave out the words "clickable" and "text only", and let the sounds say it.',
  },
  {
    key: 'alwaysExplore', kind: 'boolean', group: 'exploring', label: 'Start in Explore Mode on every page',
    help: 'Turn Explore Mode on automatically whenever a page loads. When off, press Alt and I to start on any page.',
  },
  {
    key: 'shortcutKeys', kind: 'choice', group: 'exploring', label: 'Shortcut keys',
    options: [
      { value: 'ctrl-alt', label: 'Control and Alt' },
      { value: 'alt-shift', label: 'Alt and Shift' },
    ],
    help:
      'The keys you hold for iBrowse shortcuts, such as jumping to the next heading. ' +
      'Control and Alt is recommended on Windows because Alt and Shift can switch your keyboard language.',
  },
  {
    key: 'touchActivation', kind: 'choice', group: 'exploring', label: 'Touch activation',
    options: [
      { value: 'lift', label: 'Double-tap to activate' },
      { value: 'direct', label: 'Direct tap' },
    ],
    help: 'On touch screens: Double-tap lets you tap once to hear what is under your finger and double-tap to press it. Direct tap presses immediately.',
  },
  {
    key: 'typingEcho', kind: 'choice', group: 'exploring', label: 'Typing echo',
    options: [
      { value: 'characters', label: 'Each character' },
      { value: 'words', label: 'Each word' },
      { value: 'none', label: 'Nothing' },
    ],
    help: 'Choose whether iBrowse reads each letter, each word, or stays quiet while you type in forms. Passwords are never spoken.',
  },
  {
    key: 'screenReaderMode', kind: 'choice', group: 'screenreader', label: 'Screen reader mode',
    options: [
      { value: 'standalone', label: 'Standalone, spoken by iBrowse' },
      { value: 'companion', label: 'Companion, spoken by your screen reader' },
    ],
    help: 'Choose Standalone if you only use iBrowse. Choose Companion if you already use NVDA, JAWS, or VoiceOver so two voices never talk over each other.',
  },
  {
    key: 'hapticIntensity', kind: 'number', group: 'haptics', label: 'Haptic strength', min: 0, max: 1, step: 0.1,
    help: 'How strong vibration feedback feels, from 0 (off) to 1 (full strength).',
  },
  {
    key: 'hapticDriver', kind: 'choice', group: 'haptics', label: 'Haptic device',
    options: [
      { value: 'none', label: 'Sound only' },
      { value: 'simulator', label: 'Sound simulator' },
      { value: 'gamepad', label: 'Game controller' },
      { value: 'webhid', label: 'Paired haptic device' },
    ],
    help: 'Choose what plays tactile feedback. Sound only works everywhere; use Hardware setup below to pair a controller or haptic device.',
  },
  {
    key: 'voiceInput', kind: 'choice', group: 'voice', label: 'Voice commands',
    options: [
      { value: 'off', label: 'Off' },
      { value: 'chrome', label: "On, with Chrome's speech recognition" },
      { value: 'gemini', label: 'On, with Google Gemini, using your key' },
    ],
    help: 'Speak commands like "read", "scroll down", or ask questions. Hold your shortcut keys and V to talk, or answer when iBrowse asks what to do.',
  },
  {
    key: 'cloudVoice', kind: 'choice', group: 'cloud', label: 'Cloud voice',
    options: [
      { value: 'off', label: 'Off, use the local voice' },
      { value: 'reading', label: 'For reading aloud only' },
      { value: 'all', label: 'For everything' },
    ],
    help: 'Use Google Gemini Live for a fast, natural Indian English voice. Needs a Google key below and sends spoken text to Google.',
  },
  {
    key: 'cloudVoiceName', kind: 'text', group: 'cloud', label: 'Cloud voice name', maxLength: 40,
    help: 'Which Google voice persona to use, such as Kore (clear), Puck (lively), Charon (deep), or Aoede (warm).',
  },
  {
    key: 'cloudVoiceModel', kind: 'text', group: 'cloud', label: 'Cloud voice model', maxLength: 60,
    help: 'The fallback Google speech model (default: gemini-3.8-flash-lite-tts). Used alongside Gemini Live for fast, low-cost speech.',
  },
  {
    key: 'liveTokenServiceUrl', kind: 'text', group: 'cloud', label: 'Live voice token server', maxLength: 200,
    help: 'Optional HTTPS address of your iBrowse token server for low-latency Gemini Live streaming. Leave empty to use REST voice.',
  },
  {
    key: 'aiAssist', kind: 'boolean', group: 'cloud', label: 'AI descriptions and summaries',
    help: 'Describe images, summarise long pages, and answer spoken questions about the page. Needs a Google key below.',
  },
  {
    key: 'aiModel', kind: 'text', group: 'cloud', label: 'AI model', maxLength: 60,
    help: 'The fast Google model used for summaries and image descriptions (default: gemini-3.8-flash, with Claude Haiku fallback when configured).',
  },
  {
    key: 'latencyReadout', kind: 'boolean', group: 'developer', label: 'Measure delays',
    help: 'Record how many milliseconds sounds and speech take to start, then hear the report using "Read out delays" below.',
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
