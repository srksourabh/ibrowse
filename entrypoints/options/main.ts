import { latencyText } from '../../src/audio/latency-text'
import type { LatencyReport } from '../../src/audio/latency-meter'
import { GeminiClient } from '../../src/cloud/gemini-client'
import { loadGeminiKey } from '../../src/cloud/secrets'
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
  row.className = 'row'
  const label = Object.assign(document.createElement('label'), { htmlFor: id, textContent: field.label })
  const control = createControl(field)
  control.id = id
  control.dataset.key = field.key
  control.setAttribute('aria-describedby', `${id}-help`)
  const help = Object.assign(document.createElement('p'), { id: `${id}-help`, className: 'help', textContent: field.help })
  row.append(label, control, help)
  return row
}

function buildForm(form: HTMLElement): void {
  for (const group of SETTING_GROUPS) {
    const section = document.createElement('section')
    const heading = Object.assign(document.createElement('h2'), {
      id: `group-${group.id}`,
      textContent: group.label,
    })
    section.setAttribute('aria-labelledby', heading.id)
    section.append(heading, ...SETTINGS_FIELDS.filter((f) => f.group === group.id).map(createRow))
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
  announceFocus: boolean,
  refresh: () => Promise<void>,
): void {
  form.addEventListener('change', (event) => {
    const control = event.target as Control
    const key = control.dataset.key as FieldSpec['key'] | undefined
    if (!key) return
    void editor.change(key, readValue(fieldFor(key), control)).then(async (outcome) => {
      if (outcome === 'pending') {
        byId('consent-text').textContent = String(warningFor(key, readValue(fieldFor(key), control)))
        byId('consent').hidden = false
        byId('allow').focus()
      }
      await refresh()
    })
  })
  // With iBrowse's own voice and no screen reader, nothing else would say what a setting is.
  if (announceFocus) {
    form.addEventListener('focusin', (event) => {
      const control = event.target as Control
      const key = control.dataset.key as FieldSpec['key'] | undefined
      if (key) speak(focusDescription(fieldFor(key), readValue(fieldFor(key), control)))
    })
  }
}

async function main(): Promise<void> {
  const store = chrome.storage.local
  const initial = await loadSettings(store)
  const companion = initial.screenReaderMode === 'companion'
  const speak = createPageSpeaker(byId('status'), companion)

  const client = new GeminiClient({ fetch: (input, init) => fetch(input, init), getKey: () => loadGeminiKey(store) })
  const editor = new SettingsEditor({
    store,
    speak,
    requestPermission: (origins) => chrome.permissions.request({ origins }),
    checkKey: () => client.checkKey(),
  })

  const form = byId('settings')
  buildForm(form)
  const refresh = async (): Promise<void> => {
    fillForm(await editor.load())
    await refreshKeyStatus(editor)
  }
  bindForm(form, editor, speak, !companion, refresh)
  bindTools(editor, speak, refresh)
  await refresh()
  speak(INTRO)
}

main().catch((error: unknown) => {
  console.error('iBrowse settings error:', error instanceof Error ? error.message : 'unknown')
})
