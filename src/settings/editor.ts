import { CloudError } from '../cloud/gemini-client'
import { GEMINI_ORIGIN } from '../cloud/permissions'
import { clearGeminiKey, hasGeminiKey, saveGeminiKey, type SecretStore } from '../cloud/secrets'
import { loadSettings, parseSettings, saveSettings, type Settings } from '../shared/settings'
import { confirmationFor, fieldFor, warningFor, type FieldSpec } from './schema'

export type ChangeOutcome = 'saved' | 'pending' | 'rejected'

export interface PendingChange {
  readonly key: FieldSpec['key']
  readonly value: unknown
  readonly label: string
}

export interface EditorDeps {
  /** Settings. Content scripts read this too. */
  store: SecretStore
  /** The Gemini key, kept apart from the settings, where no web page's content script can read it. */
  secrets: SecretStore
  /** Says something aloud. The settings page is for people who cannot see it. */
  speak(text: string): void
  /** Asks the browser for permission to contact these sites. It needs a fresh user gesture. */
  requestPermission(origins: string[]): Promise<boolean>
  /** Asks the browser to let the extension use the microphone. It needs a fresh user gesture. */
  requestMicrophone(): Promise<boolean>
  /** Asks Google whether the saved key works. Throws CloudError if not. */
  checkKey(): Promise<void>
}

const ADD_KEY = ' Add your Google key to use it.'
const AI_KEYS =
  ' Press Alt, Shift and D to describe what is under the pointer, and Alt, Shift and M to summarise the page.'

const TALK_KEYS = ' Hold Alt, Shift and V and speak, or answer when iBrowse asks.'

/** True when nothing new would leave this computer, so the warning and permission are not needed again. */
function alreadyOn(key: FieldSpec['key'], value: unknown, current: Settings): boolean {
  if (key === 'cloudVoice') return current.cloudVoice !== 'off'
  // Moving to Gemini starts sending recordings to Google with the key, so it is asked about again.
  if (key === 'voiceInput') return current.voiceInput === value || (current.voiceInput !== 'off' && value === 'chrome')
  return key === 'aiAssist' && current.aiAssist
}

/**
 * The logic behind the settings page. Every change is spoken. A setting that
 * sends data off this computer is never turned on by one action: its warning
 * is spoken, and it waits for a separate, deliberate "Allow", because the
 * browser's permission request needs a fresh gesture, and a spoken warning
 * takes longer than a gesture lasts.
 */
export class SettingsEditor {
  readonly #deps: EditorDeps
  #pending: PendingChange | null = null

  constructor(deps: EditorDeps) {
    this.#deps = deps
  }

  get pending(): PendingChange | null {
    return this.#pending
  }

  load(): Promise<Settings> {
    return loadSettings(this.#deps.store)
  }

  async change(key: FieldSpec['key'], value: unknown): Promise<ChangeOutcome> {
    const field = fieldFor(key)
    if (parseSettings({ [key]: value })[key] !== value) {
      this.#deps.speak(`That value is not allowed for ${field.label}.`)
      return 'rejected'
    }

    const warning = warningFor(key, value)
    if (warning && !alreadyOn(key, value, await this.load())) {
      this.#pending = { key, value, label: field.label }
      this.#deps.speak(`${warning} Press Allow and turn on to continue, or Cancel.`)
      return 'pending'
    }
    await this.#save(field, value)
    return 'saved'
  }

  async confirmPending(): Promise<'saved' | 'denied' | 'none'> {
    const pending = this.#pending
    if (!pending) return 'none'
    this.#pending = null

    let refusal: string | null
    try {
      refusal = await this.#grant(pending)
    } catch {
      this.#deps.speak('The browser could not ask for permission. Try pressing Allow again.')
      return 'denied'
    }
    if (refusal) {
      this.#deps.speak(refusal)
      return 'denied'
    }
    await this.#save(fieldFor(pending.key), pending.value)
    return 'saved'
  }

  /**
   * Asks the browser for what the change needs, all from the one press of
   * Allow, the gesture the browser requires. Says what was refused, or null.
   */
  async #grant(pending: PendingChange): Promise<string | null> {
    if (pending.key !== 'voiceInput') {
      const granted = await this.#deps.requestPermission([GEMINI_ORIGIN])
      return granted ? null : `Permission was not granted, so ${pending.label.toLowerCase()} stays off.`
    }
    if (!(await this.#deps.requestMicrophone())) return 'The microphone was not allowed, so voice commands stay off.'
    if (pending.value !== 'gemini' || (await this.#deps.requestPermission([GEMINI_ORIGIN]))) return null
    return 'Permission to contact Google was not granted, so voice commands stay off.'
  }

  cancelPending(): void {
    this.#pending = null
    this.#deps.speak('Cancelled. Nothing was changed.')
  }

  hasKey(): Promise<boolean> {
    return hasGeminiKey(this.#deps.secrets)
  }

  /** Saves a key. Neither the reply nor any error repeats what was typed. */
  async saveKey(raw: string): Promise<boolean> {
    try {
      await saveGeminiKey(this.#deps.secrets, raw)
    } catch (error) {
      this.#deps.speak(error instanceof Error ? error.message : 'That key could not be saved.')
      return false
    }
    this.#deps.speak('Key saved. Use Test key to check it.')
    return true
  }

  async testKey(): Promise<boolean> {
    try {
      await this.#deps.checkKey()
    } catch (error) {
      this.#deps.speak(error instanceof CloudError ? error.spoken : 'Could not check the key.')
      return false
    }
    this.#deps.speak('Key accepted.')
    return true
  }

  async removeKey(): Promise<void> {
    await clearGeminiKey(this.#deps.secrets)
    this.#deps.speak('Key removed.')
  }

  async #save(field: FieldSpec, value: unknown): Promise<void> {
    await saveSettings(this.#deps.store, { [field.key]: value })
    let text = confirmationFor(field, value)
    const turnedOn =
      (field.key === 'cloudVoice' && value !== 'off') ||
      (field.key === 'aiAssist' && value === true) ||
      (field.key === 'voiceInput' && value === 'gemini')
    if (field.key === 'voiceInput' && value !== 'off') text += TALK_KEYS
    if (turnedOn) {
      const hasKey = await this.hasKey()
      text += hasKey ? (field.key === 'aiAssist' ? AI_KEYS : '') : ADD_KEY
    }
    this.#deps.speak(text)
  }
}
