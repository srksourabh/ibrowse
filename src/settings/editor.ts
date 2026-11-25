import { chordWords, type ShortcutKeys } from '../key-router'
import { CloudError } from '../cloud/gemini-client'
import { ANTHROPIC_ORIGIN, GEMINI_ORIGIN } from '../cloud/permissions'
import {
  clearAnthropicKey,
  clearGeminiKey,
  hasAnthropicKey,
  hasGeminiKey,
  saveAnthropicKey,
  saveGeminiKey,
  type SecretStore,
} from '../cloud/secrets'
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
  /** Asks Google whether the key works. Throws CloudError if not. */
  checkKey(candidateKey?: string): Promise<void>
  /** Asks Anthropic whether the fallback key works. Throws CloudError if not. */
  checkAnthropicKey?(candidateKey?: string): Promise<void>
}

const ADD_KEY = ' Add your Google key to use it.'
const ADD_AI_KEY = ' Add your Google key (or Anthropic key) to use it.'
const aiKeys = (keys: ShortcutKeys): string =>
  ` Press ${chordWords(keys, 'D')} to describe what is under the pointer, and ${chordWords(keys, 'M')} to summarise the page.`

const talkKeys = (keys: ShortcutKeys): string => ` Hold ${chordWords(keys, 'V')} and speak, or answer when iBrowse asks.`

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
      const origins = pending.key === 'aiAssist' ? [GEMINI_ORIGIN, ANTHROPIC_ORIGIN] : [GEMINI_ORIGIN]
      const granted = await this.#deps.requestPermission(origins)
      return granted ? null : `Permission was not granted, so ${pending.label.toLowerCase()} stays off.`
    }
    // Ask for the optional host permission first while the click user gesture is still fresh.
    if (pending.value === 'gemini' && !(await this.#deps.requestPermission([GEMINI_ORIGIN]))) {
      return 'Permission to contact Google was not granted, so voice commands stay off.'
    }
    if (!(await this.#deps.requestMicrophone())) return 'The microphone was not allowed, so voice commands stay off.'
    return null
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

  async testKey(candidateKey?: string): Promise<boolean> {
    try {
      const granted = await this.#deps.requestPermission([GEMINI_ORIGIN])
      if (!granted) {
        this.#deps.speak('Permission to contact Google was not granted.')
        return false
      }
      if (candidateKey !== undefined && candidateKey.trim() !== '') {
        const key = candidateKey.trim()
        if (!/^[A-Za-z0-9_-]{20,200}$/.test(key)) {
          this.#deps.speak('That does not look like a Google API key. It is 20 or more letters, digits, dashes or underscores.')
          return false
        }
      }
      await this.#deps.checkKey(candidateKey)
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

  hasAnthropicKey(): Promise<boolean> {
    return hasAnthropicKey(this.#deps.secrets)
  }

  /** Saves an Anthropic fallback key without repeating what was typed. */
  async saveAnthropicKey(raw: string): Promise<boolean> {
    try {
      await saveAnthropicKey(this.#deps.secrets, raw)
    } catch (error) {
      this.#deps.speak(error instanceof Error ? error.message : 'That Anthropic key could not be saved.')
      return false
    }
    this.#deps.speak('Anthropic key saved. Use Test Anthropic key to check it.')
    return true
  }

  async testAnthropicKey(candidateKey?: string): Promise<boolean> {
    if (!this.#deps.checkAnthropicKey) return false
    try {
      const granted = await this.#deps.requestPermission([ANTHROPIC_ORIGIN])
      if (!granted) {
        this.#deps.speak('Permission to contact Anthropic was not granted.')
        return false
      }
      if (candidateKey !== undefined && candidateKey.trim() !== '') {
        const key = candidateKey.trim()
        if (!/^[A-Za-z0-9_-]{20,200}$/.test(key)) {
          this.#deps.speak('That does not look like an Anthropic API key. It is 20 or more letters, digits, dashes or underscores.')
          return false
        }
      }
      await this.#deps.checkAnthropicKey(candidateKey)
    } catch (error) {
      this.#deps.speak(error instanceof CloudError ? error.spoken : 'Could not check the Anthropic key.')
      return false
    }
    this.#deps.speak('Anthropic key accepted.')
    return true
  }

  async removeAnthropicKey(): Promise<void> {
    await clearAnthropicKey(this.#deps.secrets)
    this.#deps.speak('Anthropic key removed.')
  }

  async #save(field: FieldSpec, value: unknown): Promise<void> {
    const { shortcutKeys } = await saveSettings(this.#deps.store, { [field.key]: value })
    let text = confirmationFor(field, value)
    const turnedOn =
      (field.key === 'cloudVoice' && value !== 'off') ||
      (field.key === 'aiAssist' && value === true) ||
      (field.key === 'voiceInput' && value === 'gemini')
    if (field.key === 'voiceInput' && value !== 'off') text += talkKeys(shortcutKeys)
    if (turnedOn) {
      const hasKey =
        field.key === 'aiAssist' ? (await this.hasKey()) || (await this.hasAnthropicKey()) : await this.hasKey()
      const keyPrompt = field.key === 'aiAssist' ? ADD_AI_KEY : ADD_KEY
      text += hasKey ? (field.key === 'aiAssist' ? aiKeys(shortcutKeys) : '') : keyPrompt
    }
    this.#deps.speak(text)
  }
}
