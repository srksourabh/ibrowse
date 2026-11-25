import type { NavigationNotice } from '../shared/messages'

export interface NavigationCoordinatorDeps {
  readonly notifyWillNavigate?: () => void
  readonly reportError?: (error: unknown) => void
  readonly now?: () => number
}

/**
 * Determines whether activating this element or processing this click event
 * indicates the browser will navigate to another page in the current tab.
 */
export function isNavigatingElement(
  el: Element | null,
  event?: MouseEvent | KeyboardEvent,
  win: Window = window,
): boolean {
  if (!el) return false

  // Form submission check
  if (
    el instanceof HTMLFormElement ||
    (el instanceof HTMLElement && (el as HTMLButtonElement).type === 'submit')
  ) {
    const form = el instanceof HTMLFormElement ? el : el.closest('form')
    if (form) {
      if (form.target === '_blank') return false
      return true
    }
  }

  // Anchor or area check
  const anchor = el.closest('a[href], area[href]')
  if (!anchor || !(anchor instanceof HTMLAnchorElement || anchor instanceof HTMLAreaElement)) {
    return false
  }

  const rawHref = anchor.getAttribute('href') ?? ''
  if (!rawHref || rawHref.trim() === '') return false

  // Disregard non-HTTP/HTML navigation schemes
  const trimmed = rawHref.trim().toLowerCase()
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  ) {
    return false
  }

  // Modified clicks (Ctrl/Cmd/Shift/Middle-click) open in a new tab or window
  if (event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) return false
    if ('button' in event && event.button !== 0) return false
  }

  // Explicit target='_blank' opens in a new tab
  if (anchor.target === '_blank') return false

  // Download links trigger file downloads, not web navigation
  if (anchor.hasAttribute('download')) return false

  // Check for same-page hash fragment navigation (e.g. #overview)
  try {
    const targetUrl = new URL(anchor.href, win.location.href)
    const currentUrl = new URL(win.location.href)

    if (
      targetUrl.origin === currentUrl.origin &&
      targetUrl.pathname === currentUrl.pathname &&
      targetUrl.search === currentUrl.search &&
      targetUrl.hash !== '' &&
      targetUrl.hash !== currentUrl.hash
    ) {
      return false
    }
  } catch {
    if (rawHref.startsWith('#')) return false
  }

  return true
}

/**
 * Centralized coordinator for managing Explore Mode cross-page navigation persistence.
 * Tracks user navigation intent across mouse clicks, touch activations, virtual pointer,
 * voice commands, keyboard shortcuts, and pagination.
 */
export class NavigationCoordinator {
  readonly #notify: () => void
  readonly #now: () => number
  #lastNotified = 0

  constructor(deps?: NavigationCoordinatorDeps) {
    this.#notify =
      deps?.notifyWillNavigate ??
      (() => {
        const notice: NavigationNotice = { type: 'will-navigate' }
        try {
          chrome.runtime?.sendMessage(notice)?.catch?.((err: unknown) => deps?.reportError?.(err))
        } catch (err) {
          deps?.reportError?.(err)
        }
      })
    this.#now = deps?.now ?? (() => Date.now())
  }

  /**
   * Inspects the target element and event, sending `will-navigate` if navigation will occur.
   */
  beforeActivation(el: Element | null, event?: MouseEvent | KeyboardEvent, win?: Window): boolean {
    if (isNavigatingElement(el, event, win)) {
      this.noteNavigation()
      return true
    }
    return false
  }

  /**
   * Explicitly dispatches `will-navigate` to the background service worker,
   * debounced to prevent duplicate messages within 500ms.
   */
  noteNavigation(): void {
    const now = this.#now()
    if (now - this.#lastNotified < 500) return
    this.#lastNotified = now
    this.#notify()
  }
}

let defaultCoordinator: NavigationCoordinator | undefined

export function getNavigationCoordinator(): NavigationCoordinator {
  if (!defaultCoordinator) defaultCoordinator = new NavigationCoordinator()
  return defaultCoordinator
}

export function resetNavigationCoordinatorForTest(coordinator?: NavigationCoordinator): void {
  defaultCoordinator = coordinator
}
