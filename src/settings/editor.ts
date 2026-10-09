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
  store: SecretStore
  /** Says something aloud. The settings page is for people who cannot see it. */
  speak(text: string): void
  /** Asks the browser for permission to contact these sites. It needs a fresh user gesture. */
  requestPermission(origins: string[]): Promise<boolean>
  /** Asks Google whether the saved key works. Throws CloudError if not. */
  checkKey(): Promise<void>
}

const ADD_KEY = ' Add your Google key to use it.'
const AI_KEYS =
  ' Press Alt, Shift and D to describe what is under the pointer, and Alt, Shift and M to summarise the page.'

function alreadyOn(key: FieldSpec['key'], current: Settings): boolean {
  if (key === 'cloudVoice') return current.cloudVoice !== 'off'
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
    if (warning && !alreadyOn(key, await this.load())) {
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

    let granted = false
    try {
      granted = await this.#deps.requestPermission([GEMINI_ORIGIN])
    } catch {
      this.#deps.speak('The browser could not ask for permission. Try pressing Allow again.')
      return 'denied'
    }
    if (!granted) {
      this.#deps.speak(`Permission was not granted, so ${pending.label.toLowerCase()} stays off.`)
      return 'denied'
    }
    await this.#save(fieldFor(pending.key), pending.value)
    return 'saved'
  }

  cancelPending(): void {
    this.#pending = null
    this.#deps.speak('Cancelled. Nothing was changed.')
  }

  hasKey(): Promise<boolean> {
    return hasGeminiKey(this.#deps.store)
  }

  /** Saves a key. Neither the reply nor any error repeats what was typed. */
  async saveKey(raw: string): Promise<boolean> {
    try {
      await saveGeminiKey(this.#deps.store, raw)
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
    await clearGeminiKey(this.#deps.store)
    this.#deps.speak('Key removed.')
  }

  async #save(field: FieldSpec, value: unknown): Promise<void> {
    await saveSettings(this.#deps.store, { [field.key]: value })
    let text = confirmationFor(field, value)
    const turnedOn = (field.key === 'cloudVoice' && value !== 'off') || (field.key === 'aiAssist' && value === true)
    if (turnedOn) {
      const hasKey = await this.hasKey()
      text += hasKey ? (field.key === 'aiAssist' ? AI_KEYS : '') : ADD_KEY
    }
    this.#deps.speak(text)
  }
}
