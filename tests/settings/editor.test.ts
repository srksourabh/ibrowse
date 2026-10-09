import { describe, expect, it, vi } from 'vitest'
import { CloudError } from '../../src/cloud/gemini-client'
import { GEMINI_ORIGIN } from '../../src/cloud/permissions'
import { SettingsEditor } from '../../src/settings/editor'
import { DEFAULT_SETTINGS, loadSettings } from '../../src/shared/settings'

const KEY = 'AIzaSyD-example_key_0123456789abcdef'

function setup(options: { permission?: boolean; checkKey?: () => Promise<void>; initial?: Record<string, unknown> } = {}) {
  const data: Record<string, unknown> = { ...options.initial }
  const store = {
    data,
    get: async (key: string) => ({ [key]: data[key] }),
    set: async (items: Record<string, unknown>) => void Object.assign(data, items),
    remove: async (key: string) => void delete data[key],
  }
  const spoken: string[] = []
  const requestPermission = vi.fn(async (_origins: string[]) => options.permission ?? true)
  const editor = new SettingsEditor({
    store,
    speak: (text) => void spoken.push(text),
    requestPermission,
    checkKey: options.checkKey ?? (async () => {}),
  })
  return { editor, store, spoken, requestPermission, last: () => spoken.at(-1) }
}

describe('SettingsEditor.change: ordinary settings', () => {
  it('saves the value and says what it is now', async () => {
    const { editor, store, last } = setup()
    expect(await editor.change('speechRate', 1.5)).toBe('saved')
    expect((await loadSettings(store)).speechRate).toBe(1.5)
    expect(last()).toBe('Speech rate: 1.5.')
  })

  it('refuses a value that is not allowed, says so, and saves nothing', async () => {
    const { editor, store, last } = setup()
    expect(await editor.change('speechRate', 99)).toBe('rejected')
    expect((await loadSettings(store)).speechRate).toBe(DEFAULT_SETTINGS.speechRate)
    expect(last()).toMatch(/not allowed/i)
    expect(last()).toContain('Speech rate')
  })

  it('works for a switch and a choice', async () => {
    const { editor, last } = setup()
    await editor.change('shortMode', true)
    expect(last()).toBe('Short announcements: on.')
    await editor.change('typingEcho', 'words')
    expect(last()).toBe('Typing echo: Each word.')
  })

  it('loads the saved settings', async () => {
    const { editor } = setup({ initial: { settings: { pitch: 1.3 } } })
    expect((await editor.load()).pitch).toBe(1.3)
  })
})

describe('SettingsEditor: settings that send data off the computer', () => {
  it('does not save at once: it says what will be sent and waits for a deliberate Allow', async () => {
    const { editor, store, last, requestPermission } = setup()
    expect(await editor.change('cloudVoice', 'reading')).toBe('pending')
    expect(last()).toMatch(/sends the text it speaks to Google/i)
    expect(last()).toMatch(/Allow/)
    expect((await loadSettings(store)).cloudVoice).toBe('off')
    expect(requestPermission).not.toHaveBeenCalled()
    expect(editor.pending).toMatchObject({ key: 'cloudVoice', value: 'reading' })
  })

  it('asks the browser for permission only when allowed, then saves and says so', async () => {
    const { editor, store, last, requestPermission } = setup()
    await editor.change('cloudVoice', 'reading')
    expect(await editor.confirmPending()).toBe('saved')
    expect(requestPermission).toHaveBeenCalledWith([GEMINI_ORIGIN])
    expect((await loadSettings(store)).cloudVoice).toBe('reading')
    expect(last()).toMatch(/Cloud voice: For reading aloud only/)
    expect(editor.pending).toBeNull()
  })

  it('does not turn it on when the browser permission is refused, and says so', async () => {
    const { editor, store, last } = setup({ permission: false })
    await editor.change('aiAssist', true)
    expect(await editor.confirmPending()).toBe('denied')
    expect((await loadSettings(store)).aiAssist).toBe(false)
    expect(last()).toMatch(/permission was not granted/i)
    expect(last()).toMatch(/stays off/i)
    expect(editor.pending).toBeNull()
  })

  it('can be cancelled before anything is asked', async () => {
    const { editor, store, requestPermission, last } = setup()
    await editor.change('aiAssist', true)
    editor.cancelPending()
    expect(editor.pending).toBeNull()
    expect(last()).toMatch(/cancel/i)
    expect(requestPermission).not.toHaveBeenCalled()
    expect((await loadSettings(store)).aiAssist).toBe(false)
  })

  it('has nothing to confirm when nothing is pending', async () => {
    expect(await setup().editor.confirmPending()).toBe('none')
  })

  it('warns about AI in terms of page text and images', async () => {
    const { editor, last } = setup()
    await editor.change('aiAssist', true)
    expect(last()).toMatch(/page text and images/i)
  })

  it('turns them off at once, with no warning and no permission', async () => {
    const { editor, store, last, requestPermission } = setup({
      initial: { settings: { cloudVoice: 'reading', aiAssist: true } },
    })
    expect(await editor.change('cloudVoice', 'off')).toBe('saved')
    expect(await editor.change('aiAssist', false)).toBe('saved')
    const settings = await loadSettings(store)
    expect(settings.cloudVoice).toBe('off')
    expect(settings.aiAssist).toBe(false)
    expect(last()).toBe('AI descriptions and summaries: off.')
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('changes between "on" choices without asking again', async () => {
    const { editor, store, requestPermission } = setup({ initial: { settings: { cloudVoice: 'reading' } } })
    expect(await editor.change('cloudVoice', 'all')).toBe('saved')
    expect((await loadSettings(store)).cloudVoice).toBe('all')
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('says to add a key when one has not been entered', async () => {
    const { editor, last } = setup()
    await editor.change('aiAssist', true)
    await editor.confirmPending()
    expect(last()).toMatch(/add your Google key/i)
  })

  it('does not say that when a key is already there, and names the AI keys instead', async () => {
    const { editor, last } = setup({ initial: { geminiKey: KEY } })
    await editor.change('aiAssist', true)
    await editor.confirmPending()
    expect(last()).not.toMatch(/add your Google key/i)
    expect(last()).toMatch(/Alt, Shift and D/)
    expect(last()).toMatch(/Alt, Shift and M/)
  })

  it('a new request replaces an earlier one that was never answered', async () => {
    const { editor } = setup()
    await editor.change('cloudVoice', 'reading')
    await editor.change('aiAssist', true)
    expect(editor.pending).toMatchObject({ key: 'aiAssist' })
  })
})

describe('SettingsEditor: the key', () => {
  it('saves a key and says so, without repeating it', async () => {
    const { editor, spoken, store } = setup()
    expect(await editor.saveKey(KEY)).toBe(true)
    expect(store.data.geminiKey).toBe(KEY)
    expect(spoken.at(-1)).toMatch(/key saved/i)
    expect(spoken.join(' ')).not.toContain(KEY)
  })

  it('refuses something that cannot be a key, without repeating it', async () => {
    const { editor, spoken, store } = setup()
    expect(await editor.saveKey('not a key!')).toBe(false)
    expect(store.data.geminiKey).toBeUndefined()
    expect(spoken.at(-1)).toMatch(/does not look like/i)
    expect(spoken.join(' ')).not.toContain('not a key!')
  })

  it('tests a key, and says whether Google accepted it', async () => {
    const good = setup()
    expect(await good.editor.testKey()).toBe(true)
    expect(good.last()).toMatch(/key accepted/i)

    const bad = setup({
      checkKey: async () => {
        throw new CloudError('bad-key')
      },
    })
    expect(await bad.editor.testKey()).toBe(false)
    expect(bad.last()).toMatch(/did not accept the key/i)
  })

  it('says so, without detail, when a test fails for another reason', async () => {
    const { editor, last } = setup({
      checkKey: async () => {
        throw new Error('socket hang up: secret detail')
      },
    })
    expect(await editor.testKey()).toBe(false)
    expect(last()).not.toContain('secret')
  })

  it('removes a key', async () => {
    const { editor, store, last } = setup({ initial: { geminiKey: KEY } })
    expect(await editor.hasKey()).toBe(true)
    await editor.removeKey()
    expect(await editor.hasKey()).toBe(false)
    expect(store.data.geminiKey).toBeUndefined()
    expect(last()).toMatch(/key removed/i)
  })
})
