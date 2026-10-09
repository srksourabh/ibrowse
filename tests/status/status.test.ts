import { describe, expect, it, vi } from 'vitest'
import { STATUS_ZONE_EXIT_PX, STATUS_ZONE_PX, StatusZone, statusText } from '../../src/status/status'

const FULL = {
  title: 'Garden Journal',
  host: 'ibrowse.test',
  secure: true,
  loading: false,
  tab: { index: 2, count: 5 },
}

describe('statusText', () => {
  it('gives title, host, security and tab position', () => {
    expect(statusText(FULL)).toBe('Garden Journal. ibrowse.test. Secure connection. Tab 2 of 5.')
  })

  it('warns when the connection is not secure', () => {
    expect(statusText({ ...FULL, secure: false })).toContain('Not secure.')
  })

  it('says nothing about security for pages where it does not apply', () => {
    expect(statusText({ ...FULL, secure: null })).not.toMatch(/secure/i)
  })

  it('says when the page is still loading', () => {
    expect(statusText({ ...FULL, loading: true })).toContain('Still loading.')
  })

  it('names an untitled page and leaves out a missing host', () => {
    expect(statusText({ ...FULL, title: '', host: '' })).toBe(
      'Untitled page. Secure connection. Tab 2 of 5.',
    )
  })

  it('leaves out the tab position when it is unknown or there is only one tab', () => {
    expect(statusText({ ...FULL, tab: null })).not.toContain('Tab')
    expect(statusText({ ...FULL, tab: { index: 1, count: 1 } })).not.toContain('Tab')
  })
})

describe('StatusZone', () => {
  it('announces once when the pointer reaches the top edge, and reports it is inside', () => {
    const announce = vi.fn()
    const zone = new StatusZone(announce)
    expect(zone.update(STATUS_ZONE_PX)).toBe(true)
    expect(zone.update(2)).toBe(true)
    expect(announce).toHaveBeenCalledOnce()
  })

  it('is not entered below the edge', () => {
    const announce = vi.fn()
    const zone = new StatusZone(announce)
    expect(zone.update(STATUS_ZONE_PX + 1)).toBe(false)
    expect(announce).not.toHaveBeenCalled()
  })

  it('stays inside until the pointer is clearly away, so jitter does not repeat it', () => {
    const announce = vi.fn()
    const zone = new StatusZone(announce)
    zone.update(0)
    expect(zone.update(STATUS_ZONE_PX + 5)).toBe(true)
    expect(zone.update(STATUS_ZONE_EXIT_PX)).toBe(true)
    expect(announce).toHaveBeenCalledOnce()
  })

  it('announces again on the next visit', () => {
    const announce = vi.fn()
    const zone = new StatusZone(announce)
    zone.update(0)
    expect(zone.update(STATUS_ZONE_EXIT_PX + 1)).toBe(false)
    zone.update(0)
    expect(announce).toHaveBeenCalledTimes(2)
  })
})
