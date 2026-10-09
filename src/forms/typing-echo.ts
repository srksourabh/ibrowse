import type { EarconEngine } from '../audio/earcons'
import type { SpeechService } from '../audio/speech-service'
import type { Settings } from '../shared/settings'

type TypableElement = HTMLInputElement | HTMLTextAreaElement

const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'url', 'tel', 'password', 'number'])

/** Characters a voice would skip or mispronounce on their own. */
const CHARACTER_NAMES: Readonly<Record<string, string>> = {
  ' ': 'space',
  '\n': 'new line',
  '.': 'dot',
  ',': 'comma',
  '@': 'at',
  '-': 'dash',
  '_': 'underscore',
  '/': 'slash',
  ':': 'colon',
  ';': 'semicolon',
  '!': 'exclamation mark',
  '?': 'question mark',
}

const WORD_BEFORE_END = /[\p{L}\p{N}'’-]+$/u

function isTypable(el: Element): el is TypableElement {
  return (
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(el.type))
  )
}

const isWordEnd = (char: string): boolean => !/[\p{L}\p{N}]/u.test(char)
const nameOf = (char: string): string => CHARACTER_NAMES[char] ?? char
const plural = (n: number): string => `${n} character${n === 1 ? '' : 's'}`

function commonPrefixLength(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

export interface TypingEchoDeps {
  speech: Pick<SpeechService, 'speak'>
  earcons: Pick<EarconEngine, 'play'>
  getMode(): Settings['typingEcho']
  getRate(): number
}

/**
 * Speaks what is typed into a form field, as characters or as words. What is
 * typed into a password field is never spoken, only ticked.
 */
export class TypingEcho {
  readonly #deps: TypingEchoDeps
  readonly #values = new WeakMap<Element, string>()

  constructor(deps: TypingEchoDeps) {
    this.#deps = deps
  }

  /** Remembers the field's current text, so the first keystroke can be compared with it. */
  focus(el: Element): void {
    if (isTypable(el)) this.#values.set(el, el.value)
  }

  onInput(el: Element): void {
    if (!isTypable(el)) return
    const before = this.#values.get(el) ?? ''
    const after = el.value
    this.#values.set(el, after)

    if (el instanceof HTMLInputElement && el.type === 'password') {
      this.#deps.earcons.play('tick', 0)
      return
    }
    if (this.#deps.getMode() === 'none') return
    const text = this.#describe(before, after)
    if (text) void this.#deps.speech.speak({ text, rate: this.#deps.getRate() })
  }

  #describe(before: string, after: string): string | null {
    const delta = after.length - before.length
    const at = commonPrefixLength(before, after)

    if (delta === 1 && after.slice(at + 1) === before.slice(at)) {
      return this.#inserted(after, at)
    }
    if (delta === -1 && before.slice(at + 1) === after.slice(at)) {
      return `deleted ${nameOf(before.charAt(at))}`
    }
    if (delta > 0) return `Added ${plural(delta)}`
    return delta < 0 ? `Removed ${plural(-delta)}` : 'Text changed'
  }

  #inserted(after: string, at: number): string | null {
    const char = after.charAt(at)
    if (this.#deps.getMode() === 'characters') return nameOf(char)
    if (!isWordEnd(char)) return null
    return WORD_BEFORE_END.exec(after.slice(0, at))?.[0] ?? null
  }
}
