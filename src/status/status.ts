/** The pointer is in the status zone within this many pixels of the top of the viewport. */
export const STATUS_ZONE_PX = 6
/** It has left the zone once it is this far down, so a shaky hand does not repeat the announcement. */
export const STATUS_ZONE_EXIT_PX = 24

export interface PageStatus {
  readonly title: string
  readonly host: string
  /** True for https, false for plain http, null where the idea does not apply. */
  readonly secure: boolean | null
  readonly loading: boolean
  readonly tab: { readonly index: number; readonly count: number } | null
}

/** "Where am I": the page, where it came from, whether it is safe, and which tab. */
export function statusText(status: PageStatus): string {
  const sentences = [
    status.title || 'Untitled page',
    status.host,
    status.secure === null ? '' : status.secure ? 'Secure connection' : 'Not secure',
    status.loading ? 'Still loading' : '',
    status.tab && status.tab.count > 1 ? `Tab ${status.tab.index} of ${status.tab.count}` : '',
  ]
  return sentences
    .filter(Boolean)
    .map((sentence) => `${sentence}.`)
    .join(' ')
}

/**
 * A strip at the very top of the viewport that reads out the page status
 * when the pointer arrives (PRD §5.8). `update` returns true while inside,
 * so the caller can leave ordinary hover alone.
 */
export class StatusZone {
  readonly #announce: () => void
  #inside = false

  constructor(announce: () => void) {
    this.#announce = announce
  }

  update(y: number): boolean {
    if (!this.#inside && y <= STATUS_ZONE_PX) {
      this.#inside = true
      this.#announce()
    } else if (this.#inside && y > STATUS_ZONE_EXIT_PX) {
      this.#inside = false
    }
    return this.#inside
  }
}
