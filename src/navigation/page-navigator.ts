import type { EarconEngine } from '../audio/earcons'
import type { SpeechService } from '../audio/speech-service'
import type { PaginationTarget } from './pagination'

/** A scroll of this fraction of the screen leaves a little overlap to keep context. */
const SCREEN_FRACTION = 0.9
/** Within this many pixels of the end counts as the end. */
const EDGE_TOLERANCE_PX = 2

type Direction = 'next' | 'prev'

export interface PageNavigatorDeps {
  scroll: {
    y(): number
    maxY(): number
    viewportHeight(): number
    by(dy: number): void
  }
  findLink(direction: Direction): PaginationTarget | null
  activate(target: PaginationTarget): void
  /** Tells the background worker to turn Explore Mode back on after the page loads. */
  willNavigate(): void
  /** A spoken description of what is on screen now. */
  briefViewport(): string
  speech: Pick<SpeechService, 'speak'>
  earcons: Pick<EarconEngine, 'play'>
  getRate(): number
}

/** Next and Previous Page: follow pagination if there is any, otherwise scroll a screen. */
export class PageNavigator {
  readonly #deps: PageNavigatorDeps

  constructor(deps: PageNavigatorDeps) {
    this.#deps = deps
  }

  go(direction: Direction): 'navigated' | 'scrolled' | 'edge' {
    const link = this.#deps.findLink(direction)
    if (link) {
      this.#say(`Going to ${direction === 'next' ? 'next' : 'previous'} page`)
      this.#deps.willNavigate()
      this.#deps.activate(link)
      return 'navigated'
    }

    const { scroll } = this.#deps
    const forward = direction === 'next'
    if (forward ? this.#atBottom() : scroll.y() <= 0) {
      this.#deps.earcons.play('boundary', 0)
      this.#say(forward ? 'End of page' : 'Top of page')
      return 'edge'
    }

    const distance = scroll.viewportHeight() * SCREEN_FRACTION
    scroll.by(forward ? distance : -distance)
    const brief = this.#deps.briefViewport()
    this.#say(`Scrolled ${forward ? 'down' : 'up'}.${brief ? ` ${brief}` : ''}`)
    return 'scrolled'
  }

  /** Scrolls the page by a pixel amount, announcing the end or top of the page on arrival. */
  scrollBy(dy: number): void {
    const wasAtBottom = this.#atBottom()
    const wasAtTop = this.#deps.scroll.y() <= 0
    this.#deps.scroll.by(dy)
    if (dy > 0 && !wasAtBottom && this.#atBottom()) {
      this.#deps.earcons.play('boundary', 0)
      const hasNext = this.#deps.findLink('next') !== null
      this.#say(hasNext ? 'End of page. Next page is available.' : 'End of page')
    } else if (dy < 0 && !wasAtTop && this.#deps.scroll.y() <= 0) {
      this.#deps.earcons.play('boundary', 0)
      this.#say('Top of page')
    }
  }

  #atBottom(): boolean {
    const { scroll } = this.#deps
    return scroll.y() >= scroll.maxY() - EDGE_TOLERANCE_PX
  }

  #say(text: string): void {
    void this.#deps.speech.speak({ text, rate: this.#deps.getRate() })
  }
}
