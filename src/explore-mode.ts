type EventHost = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

/** A listener, or a listener that must run in the capture phase (for events that do not bubble). */
export type HandlerSpec = EventListener | { readonly listener: EventListener; readonly capture: true }

const listenerOf = (spec: HandlerSpec): EventListener =>
  typeof spec === 'function' ? spec : spec.listener

/**
 * Explore Mode state. While off, no listeners are registered, so the page
 * behaves exactly as if the extension were not installed (ADR-0003).
 */
export class ExploreMode {
  readonly #target: EventHost
  readonly #handlers: Readonly<Record<string, HandlerSpec>>
  readonly #subscribers = new Set<(enabled: boolean) => void>()
  #enabled = false

  constructor(target: EventHost, handlers: Readonly<Record<string, HandlerSpec>>) {
    this.#target = target
    this.#handlers = handlers
  }

  get isEnabled(): boolean {
    return this.#enabled
  }

  enable(): void {
    if (this.#enabled) return
    for (const [type, spec] of Object.entries(this.#handlers)) {
      // Non-passive, so handlers can take over wheel and touch scrolling.
      const options =
        typeof spec === 'function' ? { passive: false } : { passive: false, capture: true }
      this.#target.addEventListener(type, listenerOf(spec), options)
    }
    this.#set(true)
  }

  disable(): void {
    if (!this.#enabled) return
    for (const [type, spec] of Object.entries(this.#handlers)) {
      if (typeof spec === 'function') this.#target.removeEventListener(type, spec)
      else this.#target.removeEventListener(type, spec.listener, { capture: true })
    }
    this.#set(false)
  }

  toggle(): boolean {
    if (this.#enabled) this.disable()
    else this.enable()
    return this.#enabled
  }

  /** Returns an unsubscribe function. */
  onChange(subscriber: (enabled: boolean) => void): () => void {
    this.#subscribers.add(subscriber)
    return () => this.#subscribers.delete(subscriber)
  }

  #set(enabled: boolean): void {
    this.#enabled = enabled
    this.#subscribers.forEach((subscriber) => subscriber(enabled))
  }
}
