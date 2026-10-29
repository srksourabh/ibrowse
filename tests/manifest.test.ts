import { describe, expect, it } from 'vitest'
import { commandAction, manifest } from '../src/manifest'

describe('manifest', () => {
  it('requests exactly the documented permissions', () => {
    expect([...manifest.permissions].sort()).toEqual(
      ['contextMenus', 'offscreen', 'storage', 'tts'].sort(),
    )
  })

  it('requests host access to all URLs and nothing else', () => {
    expect(manifest.host_permissions).toEqual(['<all_urls>'])
  })

  it('declares the Explore Mode hotkey as Alt+I, away from the Alt+Shift language switch', () => {
    expect(manifest.commands['toggle-explore'].suggested_key.default).toBe('Alt+I')
  })

  it('declares the settings hotkey as Alt+O', () => {
    expect(manifest.commands['open-settings'].suggested_key.default).toBe('Alt+O')
  })

  it('suggests no global key that holds Alt and Shift together', () => {
    for (const command of Object.values(manifest.commands)) {
      if ('suggested_key' in command) expect(command.suggested_key.default).not.toMatch(/Alt\+Shift|Shift\+Alt/)
    }
  })

  it('lists every page shortcut as a command, so it can be changed at chrome://extensions/shortcuts', () => {
    for (const action of ['next-heading', 'prev-heading', 'next-landmark', 'prev-landmark', 'where-am-i', 'brief-detailed']) {
      expect(manifest.commands, action).toHaveProperty(action)
    }
  })

  it('describes every command in words a screen reader can say', () => {
    for (const [name, command] of Object.entries(manifest.commands)) {
      expect(command.description.length, name).toBeGreaterThan(5)
    }
  })

  it('can reach Google only if the user grants it: the permission is optional, not required', () => {
    expect(manifest.optional_host_permissions).toEqual(['https://generativelanguage.googleapis.com/*'])
    expect(manifest.host_permissions).toEqual(['<all_urls>'])
    expect(manifest.permissions).not.toContain('https://generativelanguage.googleapis.com/*')
  })

  it('has a toolbar button whose title says Explore Mode is off until a page turns it on', () => {
    expect(manifest.action.default_title).toBe('iBrowse: Explore Mode off. Click to turn it on.')
  })

  it('stays within the browser limit of four suggested shortcuts', () => {
    const withKeys = Object.values(manifest.commands).filter((c) => 'suggested_key' in c)
    expect(withKeys.length).toBeLessThanOrEqual(4)
  })
})

describe('commandAction', () => {
  it('turns a page command into the shortcut it stands for', () => {
    expect(commandAction('next-heading')).toBe('next-heading')
    expect(commandAction('summarize-page')).toBe('summarize-page')
  })

  it('is null for the commands the worker handles itself, and for anything unknown', () => {
    expect(commandAction('toggle-explore')).toBeNull()
    expect(commandAction('open-settings')).toBeNull()
    expect(commandAction('delete-everything')).toBeNull()
  })
})
