import { describe, expect, it } from 'vitest'
import { manifest } from '../src/manifest'

describe('manifest', () => {
  it('requests exactly the documented permissions', () => {
    expect([...manifest.permissions].sort()).toEqual(
      ['activeTab', 'contextMenus', 'offscreen', 'scripting', 'storage', 'tts'].sort(),
    )
  })

  it('requests host access to all URLs and nothing else', () => {
    expect(manifest.host_permissions).toEqual(['<all_urls>'])
  })

  it('declares the Explore Mode hotkey as Alt+Shift+E', () => {
    expect(manifest.commands['toggle-explore'].suggested_key.default).toBe('Alt+Shift+E')
  })

  it('declares the hardware setup hotkey as Alt+Shift+P', () => {
    expect(manifest.commands['pair-hardware'].suggested_key.default).toBe('Alt+Shift+P')
  })

  it('declares the settings hotkey as Alt+Shift+S', () => {
    expect(manifest.commands['open-settings'].suggested_key.default).toBe('Alt+Shift+S')
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
