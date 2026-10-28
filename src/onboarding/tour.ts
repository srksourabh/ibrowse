import { chordWords, type ShortcutKeys } from '../key-router'
import type { KeyValueStore } from '../shared/settings'

export interface TourStep {
  readonly id: string
  readonly text: string
}

/**
 * The first-run tour, written to be listened to, naming the keys the user chose.
 * Keys are spelled "Control, Alt and W", because a voice reads "Ctrl+Alt+W" as
 * "Control plus Alt plus W". Alt and I, and Alt and O, work from anywhere; the
 * rest work while Explore mode is on (ADR-0018).
 */
export function onboardingSteps(keys: ShortcutKeys): readonly TourStep[] {
  const chord = (key: string): string => chordWords(keys, key)
  return [
    {
      id: 'welcome',
      text:
        'Welcome to iBrowse. It lets you explore a web page by moving a mouse or a finger over it, and hearing what is there. ' +
        'This tour takes about three minutes. Press Enter to hear the next step, Backspace to go back, R to hear a step again, and Escape to skip the tour.',
    },
    {
      id: 'start',
      text:
        'To start, open any web page and press Alt and I. iBrowse says Explore mode on, tells you what is in the header, the left panel, the main content and the right panel, and asks whether you want it read. ' +
        `Press Y to hear it, or N to decline. Press Alt and I again, or ${chord('E')}, to turn Explore mode off.`,
    },
    {
      id: 'explore',
      text:
        'With Explore mode on, move the mouse or your finger over the page. iBrowse says what is under it, and a sound tells you whether it is to your left or right. ' +
        'The words clickable and text only tell you whether you can press it.',
    },
    {
      id: 'read',
      text:
        'Click a paragraph to hear all of it. Roll the scroll wheel over text to hear one word at a time. ' +
        'Hold Shift while you roll to hear a word spelled out, or hold Alt to scroll the page instead.',
    },
    {
      id: 'move',
      text:
        `To move around, press ${chord('Down Arrow')} for the next heading, and Up Arrow for the previous one. ` +
        `${chord('Page Down')} jumps to the next landmark. ${chord('Right Arrow')} goes to the next page. ` +
        'Your Tab key and screen reader carry on from where iBrowse took you.',
    },
    {
      id: 'where',
      text:
        `Press ${chord('W')} at any time to hear where you are: the page title, the website, whether the connection is secure, and which tab this is. ` +
        'Press Escape to stop speech whenever you like.',
    },
    {
      id: 'voice',
      text:
        `iBrowse can also listen. Turn on voice commands in settings. Then hold ${chord('V')} and say what you want: click, click and a name, scroll down, go back, what is on the left, or a question about the page. ` +
        'When you rest the pointer on something, iBrowse asks what you would like to do, and listens for your answer.',
    },
    {
      id: 'forms',
      text:
        'In a form, iBrowse reads each field as you reach it, and echoes what you type. Passwords are never spoken. ' +
        'If a field is wrong when you submit, the problem is read out.',
    },
    {
      id: 'touch',
      text:
        'On a touchscreen, drag a finger to explore and tap to hear. Double tap anywhere to press the last thing you heard.',
    },
    {
      id: 'settings',
      text:
        'Press Alt and O to open settings. Everything there can be changed with the keyboard, and each change is spoken. ' +
        `There you can keep Explore mode on for every page, and change these keys. Press ${chord('P')} to set up haptic hardware. You can hear this tour again from settings.`,
    },
    {
      id: 'done',
      text: 'That is the tour. Press Enter to finish. Have a good explore.',
    },
  ]
}

const SKIPPED = 'Tour skipped. You can hear it again from settings.'

export interface TourDeps {
  readonly steps: readonly TourStep[]
  speak(text: string): void
  /** Called once, when the tour is finished or skipped. */
  done(): void
}

/** Steps through the tour by ear. Every step is spoken; nothing needs to be seen. */
export class OnboardingTour {
  readonly #deps: TourDeps
  #index = 0
  #started = false
  #finished = false

  constructor(deps: TourDeps) {
    this.#deps = deps
  }

  get index(): number {
    return this.#index
  }

  get finished(): boolean {
    return this.#finished
  }

  start(): void {
    this.#started = true
    this.#index = 0
    this.#say()
  }

  next(): void {
    if (!this.#active()) return
    if (this.#index >= this.#deps.steps.length - 1) {
      this.#finish()
      return
    }
    this.#index++
    this.#say()
  }

  previous(): void {
    if (!this.#active()) return
    this.#index = Math.max(0, this.#index - 1)
    this.#say()
  }

  repeat(): void {
    if (this.#active()) this.#say()
  }

  skip(): void {
    if (!this.#active()) return
    this.#deps.speak(SKIPPED)
    this.#finish()
  }

  /** Returns true if the key was one of the tour's, so the page can swallow it. */
  handleKey(key: string): boolean {
    switch (key) {
      case 'Enter':
      case 'ArrowRight':
        this.next()
        return true
      case 'Backspace':
      case 'ArrowLeft':
        this.previous()
        return true
      case 'r':
      case 'R':
        this.repeat()
        return true
      case 'Escape':
        this.skip()
        return true
      default:
        return false
    }
  }

  #active(): boolean {
    return this.#started && !this.#finished
  }

  #say(): void {
    this.#deps.speak(this.#deps.steps[this.#index]!.text)
  }

  #finish(): void {
    this.#finished = true
    this.#deps.done()
  }
}

/** The tour opens by itself only on a fresh install, and only once. */
export function shouldOpenOnboarding(reason: string, alreadyDone: boolean): boolean {
  return reason === 'install' && !alreadyDone
}

const STORAGE_KEY = 'onboardingDone'

export async function hasDoneOnboarding(store: KeyValueStore): Promise<boolean> {
  return (await store.get(STORAGE_KEY))[STORAGE_KEY] === true
}

export function markOnboardingDone(store: KeyValueStore): Promise<void> {
  return store.set({ [STORAGE_KEY]: true })
}
