import { describe, expect, it } from 'vitest'
import { toolbarState } from '../../src/shared/toolbar'

describe('toolbarState', () => {
  it('shows ON and says how to turn it off while Explore Mode is on', () => {
    expect(toolbarState(true)).toEqual({
      badge: 'ON',
      title: 'iBrowse: Explore Mode on. Click to turn it off.',
    })
  })

  it('shows no badge and says how to turn it on while Explore Mode is off', () => {
    expect(toolbarState(false)).toEqual({
      badge: '',
      title: 'iBrowse: Explore Mode off. Click to turn it on.',
    })
  })
})
