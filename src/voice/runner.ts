import type { EarconEngine } from '../audio/earcons'
import type { SpeechService } from '../audio/speech-service'
import { PANEL_NAMES, panelSentence } from '../briefing/briefing-text'
import type { Panel, PanelKind } from '../briefing/panels'
import type { Understood, VoiceCommand } from './commands'

export const HELP_TEXT =
  'You can say: click, or click and a name. Scroll up, scroll down, go to the top. ' +
  'Read this, or read the page. Next page, go back. What is on the left, go to the main content. ' +
  'Find, and a name. Stop. Repeat. Where am I. Or ask a question about the page.'

export interface VoiceRunnerDeps {
  /** What the pointer rests on, or else the navigation cursor. */
  pointedAt(): Element | null
  findControl(name: string): Element | null
  findAnything(words: string): Element | null
  panels(): readonly Panel[]
  /** A short name for a pressed control ("Sign in"). */
  nameOf(el: Element): string
  /** The full spoken description of an element. */
  describe(el: Element): string
  /** True for text to be read rather than pressed. */
  isText(el: Element): boolean
  activate(el: Element): void
  readBlock(el: Element): void
  readAll(from: Element | null): void
  brief(): void
  stop(): void
  scrollScreen(direction: 'up' | 'down'): void
  scrollToEdge(edge: 'top' | 'bottom'): void
  goPage(direction: 'next' | 'prev'): void
  history(step: -1 | 1): void
  whereAmI(): void
  /** Scrolls an element into view and makes it the navigation cursor. */
  reveal(el: Element): void
  /** Answers a question about the page (AI, when it is on). */
  ask(question: string): void
  lastSpoken(): string | null
  speech: Pick<SpeechService, 'speak'>
  earcons: Pick<EarconEngine, 'play'>
  getRate(): number
}

const notFound = (name: string): string => `Nothing called ${name} on this page.`

/** Carries out what the user said: a Voice Command on the page, or a question passed on. */
export class VoiceRunner {
  readonly #deps: VoiceRunnerDeps

  constructor(deps: VoiceRunnerDeps) {
    this.#deps = deps
  }

  run(understood: Understood): void {
    if (understood.type === 'question') this.#deps.ask(understood.text)
    else if (understood.type === 'command') this.#command(understood.command)
  }

  #command(command: VoiceCommand): void {
    const d = this.#deps
    switch (command.kind) {
      case 'click':
        return command.target === undefined ? this.#clickPointed() : this.#clickNamed(command.target)
      case 'scroll':
        return d.scrollScreen(command.direction)
      case 'scroll-to':
        return d.scrollToEdge(command.edge)
      case 'read':
        return this.#read(command.what)
      case 'page':
        return d.goPage(command.direction === 'next' ? 'next' : 'prev')
      case 'back':
      case 'forward':
        return this.#history(command.kind)
      case 'panel':
        return this.#panel(command.panel, command.action)
      case 'find':
        return this.#find(command.target)
      case 'repeat':
        return this.#say(d.lastSpoken() ?? 'Nothing to repeat yet.')
      case 'help':
        return this.#say(HELP_TEXT)
      case 'stop':
        return d.stop()
      case 'where':
        return d.whereAmI()
      case 'brief':
        return d.brief()
    }
  }

  #clickPointed(): void {
    const target = this.#deps.pointedAt()
    if (!target) {
      this.#say('Nothing to press. Move the pointer onto something first, or say click and its name.')
    } else if (this.#deps.isText(target)) {
      this.#deps.readBlock(target)
    } else {
      this.#press(target)
    }
  }

  #clickNamed(name: string): void {
    const control = this.#deps.findControl(name)
    if (control) this.#press(control)
    else this.#say(notFound(name))
  }

  #press(el: Element): void {
    this.#deps.earcons.play('confirm', 0)
    this.#say(`${this.#deps.nameOf(el)}: pressed`)
    this.#deps.activate(el)
  }

  #read(what: 'this' | 'page'): void {
    const target = what === 'this' ? this.#deps.pointedAt() : null
    if (target) this.#deps.readBlock(target)
    else this.#deps.readAll(null)
  }

  #history(direction: 'back' | 'forward'): void {
    this.#say(direction === 'back' ? 'Going back' : 'Going forward')
    this.#deps.history(direction === 'back' ? -1 : 1)
  }

  #panel(kind: PanelKind, action: 'describe' | 'go'): void {
    const panel = this.#deps.panels().find((p) => p.kind === kind)
    if (!panel) {
      this.#say(`There is no ${PANEL_NAMES[kind].toLowerCase()} on this page.`)
      return
    }
    if (action === 'go') this.#deps.reveal(panel.element)
    this.#say(panelSentence(panel, true))
  }

  #find(words: string): void {
    const found = this.#deps.findAnything(words)
    if (!found) {
      this.#say(notFound(words))
      return
    }
    this.#deps.reveal(found)
    this.#say(`Found: ${this.#deps.describe(found)}`)
  }

  #say(text: string): void {
    void this.#deps.speech.speak({ text, rate: this.#deps.getRate() })
  }
}
