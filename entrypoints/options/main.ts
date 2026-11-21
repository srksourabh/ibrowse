import { latencyText } from '../../src/audio/latency-text'
import type { LatencyReport } from '../../src/audio/latency-meter'
import { ClaudeClient } from '../../src/cloud/claude-client'
import { GeminiClient } from '../../src/cloud/gemini-client'
import { keyVault, loadAnthropicKey, loadVaultKey } from '../../src/cloud/key-vault'
import { moveKeyOut } from '../../src/cloud/secrets'
import { byId, createPageSpeaker } from '../../src/pages/page-speaker'
import { SettingsEditor } from '../../src/settings/editor'
import {
  SETTING_GROUPS,
  SETTINGS_FIELDS,
  fieldFor,
  focusDescription,
  warningFor,
  type FieldSpec,
} from '../../src/settings/schema'
import { loadSettings, type Settings } from '../../src/shared/settings'

type Control = HTMLInputElement | HTMLSelectElement

const controlId = (key: string): string => `setting-${key}`
const INTRO = 'Settings. Use Tab to move between them. Each one is read out when you reach it, and every change is spoken.'

function createControl(field: FieldSpec): Control {
  if (field.kind === 'choice') {
    const select = document.createElement('select')
    select.replaceChildren(...field.options.map((o) => new Option(o.label, o.value)))
    return select
  }
  const input = document.createElement('input')
  if (field.kind === 'boolean') input.type = 'checkbox'
  else if (field.kind === 'text') Object.assign(input, { type: 'text', maxLength: field.maxLength })
  else Object.assign(input, { type: 'number', min: String(field.min), max: String(field.max), step: String(field.step) })
  return input
}

function readValue(field: FieldSpec, control: Control): unknown {
  if (field.kind === 'boolean') return (control as HTMLInputElement).checked
  if (field.kind === 'number') return Number(control.value)
  return field.kind === 'text' ? control.value.trim() : control.value
}

function writeValue(field: FieldSpec, control: Control, value: unknown): void {
  if (field.kind === 'boolean') (control as HTMLInputElement).checked = value === true
  else control.value = String(value)
}

function createRow(field: FieldSpec): HTMLElement {
  const id = controlId(field.key)
  const row = document.createElement('div')
  row.className = field.kind === 'boolean' ? 'row row-check' : 'row'
  const label = Object.assign(document.createElement('label'), { htmlFor: id, textContent: field.label })
  if (field.kind === 'number') {
    const hint = Object.assign(document.createElement('span'), {
      className: 'range-hint',
      textContent: `(${field.min}–${field.max})`,
    })
    hint.setAttribute('aria-hidden', 'true')
    label.append(hint)
  }
  const control = createControl(field)
  control.id = id
  control.dataset.key = field.key
  control.setAttribute('aria-describedby', `${id}-help`)
  const help = Object.assign(document.createElement('p'), { id: `${id}-help`, className: 'help', textContent: field.help })
  if (field.kind === 'boolean') {
    const line = document.createElement('div')
    line.className = 'check-line'
    line.append(control, label)
    row.append(line, help)
  } else {
    row.append(label, control, help)
  }
  return row
}

function buildForm(form: HTMLElement): void {
  for (const group of SETTING_GROUPS) {
    const section = document.createElement('section')
    section.className = 'card'
    const heading = Object.assign(document.createElement('h2'), {
      id: `group-${group.id}`,
      textContent: group.label,
    })
    const desc = Object.assign(document.createElement('p'), {
      className: 'group-desc',
      textContent: group.description,
    })
    section.setAttribute('aria-labelledby', heading.id)
    section.append(heading, desc, ...SETTINGS_FIELDS.filter((f) => f.group === group.id).map(createRow))
    form.append(section)
  }
}

function fillForm(settings: Settings): void {
  for (const field of SETTINGS_FIELDS) {
    writeValue(field, byId<Control>(controlId(field.key)), settings[field.key])
  }
}

async function refreshKeyStatus(editor: SettingsEditor): Promise<void> {
  byId('key-status').textContent = (await editor.hasKey()) ? 'A key is saved.' : 'No key is saved.'
  byId('anthropic-key-status').textContent = (await editor.hasAnthropicKey())
    ? 'An Anthropic fallback key is saved.'
    : 'No Anthropic key is saved.'
}

async function readLatency(speak: (text: string) => void): Promise<void> {
  const { latency } = await chrome.storage.session.get('latency')
  const report = (latency ?? { earcon: null, speech: null, cancel: null }) as LatencyReport
  speak(latencyText(report))
}

function openPage(path: string): void {
  void chrome.tabs.create({ url: path.startsWith('chrome://') ? path : chrome.runtime.getURL(path) })
}

function bindTools(editor: SettingsEditor, speak: (text: string) => void, refresh: () => Promise<void>): void {
  const click = (id: string, action: () => unknown): void => {
    byId(id).addEventListener('click', () => {
      Promise.resolve(action()).catch((error: unknown) => {
        console.error('iBrowse settings error:', error instanceof Error ? error.message : 'unknown')
        speak('Something went wrong. Please try again.')
      })
    })
  }
  click('save-key', async () => {
    const input = byId<HTMLInputElement>('key')
    if (await editor.saveKey(input.value)) input.value = ''
    await refreshKeyStatus(editor)
  })
  click('test-key', () => editor.testKey())
  click('remove-key', async () => {
    await editor.removeKey()
    await refreshKeyStatus(editor)
  })
  click('save-anthropic-key', async () => {
    const input = byId<HTMLInputElement>('anthropic-key')
    if (await editor.saveAnthropicKey(input.value)) input.value = ''
    await refreshKeyStatus(editor)
  })
  click('test-anthropic-key', () => editor.testAnthropicKey())
  click('remove-anthropic-key', async () => {
    await editor.removeAnthropicKey()
    await refreshKeyStatus(editor)
  })
  click('tour', () => openPage('onboarding.html'))
  click('hardware', () => openPage('pair.html'))
  click('shortcuts', () => openPage('chrome://extensions/shortcuts'))
  click('latency', () => readLatency(speak))
  // The consent buttons: the permission request must start inside this click.
  click('allow', async () => {
    await editor.confirmPending()
    byId('consent').hidden = true
    await refresh()
  })
  click('cancel', async () => {
    editor.cancelPending()
    byId('consent').hidden = true
    await refresh()
  })
}

function bindForm(
  form: HTMLElement,
  editor: SettingsEditor,
  speak: (text: string) => void,
  shouldAnnounceFocus: () => boolean,
  refresh: () => Promise<void>,
): void {
  form.addEventListener('submit', (event) => event.preventDefault())
  form.addEventListener('change', (event) => {
    const control = event.target as Control
    const key = control.dataset.key as FieldSpec['key'] | undefined
    if (!key) return
    const nextValue = readValue(fieldFor(key), control)
    void editor.change(key, nextValue).then(async (outcome) => {
      if (outcome === 'pending') {
        byId('consent-text').textContent = String(warningFor(key, nextValue))
        const consent = byId('consent')
        consent.hidden = false
        consent.scrollIntoView?.({ block: 'nearest' })
        byId('allow').focus()
      }
      await refresh()
    })
  })
  // With iBrowse's own voice and no screen reader, nothing else would say what a setting is.
  form.addEventListener('focusin', (event) => {
    if (!shouldAnnounceFocus()) return
    const control = event.target as Control
    const key = control.dataset.key as FieldSpec['key'] | undefined
    if (key) speak(focusDescription(fieldFor(key), readValue(fieldFor(key), control)))
  })
}

/**
 * Asks Chrome to let iBrowse use the microphone. The grant belongs to the
 * extension, so the offscreen recogniser can use it later; the stream itself
 * is closed at once (ADR-0017 #2).
 */
async function requestMicrophone(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch {
    return false
  }
}

async function main(): Promise<void> {
  const store = chrome.storage.local
  await moveKeyOut(store, keyVault)
  const initial = await loadSettings(store)
  let companion = initial.screenReaderMode === 'companion'
  let pageSpeak = createPageSpeaker(byId('status'), companion)
  const speak = (text: string): void => pageSpeak(text)

  const client = new GeminiClient({ fetch: (input, init) => fetch(input, init), getKey: loadVaultKey })
  const claudeClient = new ClaudeClient({ fetch: (input, init) => fetch(input, init), getKey: loadAnthropicKey })
  const editor = new SettingsEditor({
    store,
    secrets: keyVault,
    speak,
    requestPermission: async (origins) => {
      if (await chrome.permissions.contains({ origins })) return true
      return chrome.permissions.request({ origins })
    },
    requestMicrophone,
    checkKey: () => client.checkKey(),
    checkAnthropicKey: () => claudeClient.checkKey(),
  })

  const form = byId('settings')
  buildForm(form)
  const refresh = async (): Promise<void> => {
    const current = await editor.load()
    const nextCompanion = current.screenReaderMode === 'companion'
    if (nextCompanion !== companion) {
      companion = nextCompanion
      pageSpeak = createPageSpeaker(byId('status'), companion)
    }
    fillForm(current)
    await refreshKeyStatus(editor)
  }
  bindForm(form, editor, speak, () => !companion, refresh)
  bindTools(editor, speak, refresh)
  await refresh()
  speak(INTRO)
}

main().catch((error: unknown) => {
  console.error('iBrowse settings error:', error instanceof Error ? error.message : 'unknown')
})
