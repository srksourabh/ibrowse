import { describe, expect, it, vi } from 'vitest'
import {
  isNavigatingElement,
  NavigationCoordinator,
} from '../../src/navigation/navigation-coordinator'
import { activateElement } from '../../src/session/tools'

describe('NavigationCoordinator & isNavigatingElement', () => {
  it('identifies standard navigating anchor links', () => {
    const a = document.createElement('a')
    a.href = 'https://example.com/page2'
    expect(isNavigatingElement(a)).toBe(true)

    const span = document.createElement('span')
    a.appendChild(span)
    expect(isNavigatingElement(span)).toBe(true)
  })

  it('rejects in-page hash anchor jumps', () => {
    const a = document.createElement('a')
    a.setAttribute('href', '#section-2')
    expect(isNavigatingElement(a)).toBe(false)
  })

  it('rejects non-navigation protocols: javascript, mailto, tel', () => {
    const js = document.createElement('a')
    js.setAttribute('href', 'javascript:alert(1)')
    expect(isNavigatingElement(js)).toBe(false)

    const mail = document.createElement('a')
    mail.setAttribute('href', 'mailto:test@example.com')
    expect(isNavigatingElement(mail)).toBe(false)

    const tel = document.createElement('a')
    tel.setAttribute('href', 'tel:+123456789')
    expect(isNavigatingElement(tel)).toBe(false)
  })

  it('rejects new-tab / new-window activations (target="_blank" or modified clicks)', () => {
    const blank = document.createElement('a')
    blank.href = 'https://example.com/external'
    blank.target = '_blank'
    expect(isNavigatingElement(blank)).toBe(false)

    const normal = document.createElement('a')
    normal.href = 'https://example.com/internal'

    const ctrlClick = new MouseEvent('click', { ctrlKey: true })
    expect(isNavigatingElement(normal, ctrlClick)).toBe(false)

    const metaClick = new MouseEvent('click', { metaKey: true })
    expect(isNavigatingElement(normal, metaClick)).toBe(false)

    const shiftClick = new MouseEvent('click', { shiftKey: true })
    expect(isNavigatingElement(normal, shiftClick)).toBe(false)

    const middleClick = new MouseEvent('click', { button: 1 })
    expect(isNavigatingElement(normal, middleClick)).toBe(false)
  })

  it('rejects download links', () => {
    const download = document.createElement('a')
    download.href = 'https://example.com/report.pdf'
    download.setAttribute('download', 'report.pdf')
    expect(isNavigatingElement(download)).toBe(false)
  })

  it('rejects standard non-navigating buttons', () => {
    const btn = document.createElement('button')
    btn.type = 'button'
    expect(isNavigatingElement(btn)).toBe(false)
  })

  it('identifies form submit buttons as navigating', () => {
    const form = document.createElement('form')
    form.action = '/submit'
    const submitBtn = document.createElement('button')
    submitBtn.type = 'submit'
    form.appendChild(submitBtn)
    expect(isNavigatingElement(submitBtn)).toBe(true)

    form.target = '_blank'
    expect(isNavigatingElement(submitBtn)).toBe(false)
  })

  it('debounces rapid duplicate navigation notices', () => {
    const notify = vi.fn()
    let now = 1000
    const coordinator = new NavigationCoordinator({
      notifyWillNavigate: notify,
      now: () => now,
    })

    const a = document.createElement('a')
    a.href = 'https://example.com/about'

    // First activation sends message
    expect(coordinator.beforeActivation(a)).toBe(true)
    expect(notify).toHaveBeenCalledTimes(1)

    // Second activation within debounce window does not duplicate message
    now = 1200
    expect(coordinator.beforeActivation(a)).toBe(true)
    expect(notify).toHaveBeenCalledTimes(1)

    // Third activation after debounce window sends message
    now = 1600
    expect(coordinator.beforeActivation(a)).toBe(true)
    expect(notify).toHaveBeenCalledTimes(2)
  })

  it('activates elements and coordinates navigation via activateElement', () => {
    const notify = vi.fn()
    const coordinator = new NavigationCoordinator({ notifyWillNavigate: notify })

    const a = document.createElement('a')
    a.href = 'https://example.com/explore'
    document.body.appendChild(a)
    const clickSpy = vi.spyOn(a, 'click').mockImplementation(() => {})

    activateElement(a, coordinator)

    expect(notify).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    a.remove()
  })
})
