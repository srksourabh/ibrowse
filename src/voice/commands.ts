import type { PanelKind } from '../briefing/panels'

/** Something the user asked for by voice, understood on the device (ADR-0017 #4). */
export type VoiceCommand =
  /** Press what the pointer is on, or, with a target, the control with that name. */
  | { readonly kind: 'click'; readonly target?: string }
  | { readonly kind: 'scroll'; readonly direction: 'up' | 'down' }
  | { readonly kind: 'scroll-to'; readonly edge: 'top' | 'bottom' }
  | { readonly kind: 'read'; readonly what: 'this' | 'page' }
  | { readonly kind: 'page'; readonly direction: 'next' | 'previous' }
  | { readonly kind: 'back' }
  | { readonly kind: 'forward' }
  | { readonly kind: 'panel'; readonly panel: PanelKind; readonly action: 'describe' | 'go' }
  | { readonly kind: 'find'; readonly target: string }
  | { readonly kind: 'stop' }
  | { readonly kind: 'repeat' }
  | { readonly kind: 'help' }
  | { readonly kind: 'where' }
  | { readonly kind: 'brief' }
  /** Answers to "Say yes to press it, or no." */
  | { readonly kind: 'yes' }
  | { readonly kind: 'no' }

export type Understood =
  | { readonly type: 'command'; readonly command: VoiceCommand }
  /** Anything that is not a command, kept as said, for the AI to answer. */
  | { readonly type: 'question'; readonly text: string }
  | { readonly type: 'nothing' }

const LEADING_FILLER =
  /^(?:(?:hey|ok|okay|ibrowse|please|can you|could you|would you|will you|i want to|i'd like to|id like to|let's|lets|um|uh|er|so|now)\s+)+/
const TRAILING_FILLER = /(?:\s+(?:please|for me|now|thanks|thank you))+$/
const ONLY_FILLER = /^(?:(?:hey|ok|okay|ibrowse|please|um|uh|er|so|now)\s*)*$/
const POINTED = /^(?:on|it|this|that|here|there|on it|on this|on that|this one|that one)$/
const ROLE_WORDS = /\s+(?:button|link|tab|checkbox|box|menu|option)$/

const PANEL_WORDS: ReadonlyArray<readonly [RegExp, PanelKind]> = [
  [/^(?:left(?: panel| side| column)?)$/, 'left'],
  [/^(?:right(?: panel| side| column)?)$/, 'right'],
  [/^(?:header|top|top bar|banner)$/, 'header'],
  [/^(?:footer|bottom)$/, 'footer'],
  [/^(?:main(?: content| part)?|middle|cent(?:er|re)|content)$/, 'main'],
]

/** Lower case, no punctuation, contractions spelled out, filler words removed. */
function normalise(text: string): string {
  const plain = text
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\bwhat'?s\b/g, 'what is')
    .replace(/\bwhere'?s\b/g, 'where is')
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.replace(LEADING_FILLER, '').replace(TRAILING_FILLER, '').trim()
}

const withoutArticle = (text: string): string => text.replace(/^(?:on\s+)?(?:the\s+)?/, '').trim()

function panelOf(words: string): PanelKind | null {
  const cleaned = withoutArticle(words)
  return PANEL_WORDS.find(([pattern]) => pattern.test(cleaned))?.[1] ?? null
}

type Rule = readonly [RegExp, (match: RegExpMatchArray) => VoiceCommand | null]

const RULES: readonly Rule[] = [
  [/^(?:yes|yeah|yep|yes please|go ahead|do it|confirm)$/, () => ({ kind: 'yes' })],
  // "not now" arrives as "not": "now" is a filler word.
  [/^(?:no|nope|no thanks|no thank you|don't|do not|not|not now)$/, () => ({ kind: 'no' })],
  [/^(?:stop|quiet|be quiet|cancel|shut up|pause|silence)$/, () => ({ kind: 'stop' })],
  [/^(?:repeat(?: that)?|say that again|again|what did you say)$/, () => ({ kind: 'repeat' })],
  [/^(?:help|what can i say|what can you do|commands)$/, () => ({ kind: 'help' })],
  [/^where am i$/, () => ({ kind: 'where' })],
  [/^(?:describe (?:the |this )?page|what is on (?:this|the) page|overview)$/, () => ({ kind: 'brief' })],
  [/^(?:(?:scroll|go) )?to the (top|bottom|end)(?: of the page)?$|^(top|bottom) of the page$/, (m) => ({
    kind: 'scroll-to',
    edge: (m[1] ?? m[2]) === 'top' ? 'top' : 'bottom',
  })],
  [/^(?:scroll |go |move |page )?(up|down)(?: a bit| a little| more)?$/, (m) => ({
    kind: 'scroll',
    direction: m[1] === 'up' ? 'up' : 'down',
  })],
  [/^(?:go to )?(?:the )?(next|previous) page$/, (m) => ({
    kind: 'page',
    direction: m[1] === 'next' ? 'next' : 'previous',
  })],
  [/^(?:go |take me )?back$/, () => ({ kind: 'back' })],
  [/^(?:go )?forward$/, () => ({ kind: 'forward' })],
  [/^read(?: (it|this|that)(?: to me)?)?$/, () => ({ kind: 'read', what: 'this' })],
  [/^read (?:the (?:whole )?page|everything|all|the whole thing)$/, () => ({ kind: 'read', what: 'page' })],
  [/^what is (?:on|in|at) (.+)$/, (m) => panelCommand(m[1]!, 'describe')],
  [/^(?:go|take me|jump|move|skip) to (.+)$/, (m) => panelCommand(m[1]!, 'go')],
  [/^(?:find|where is) (.+)$/, (m) => ({ kind: 'find', target: withoutArticle(m[1]!) })],
  [/^(?:click|press|tap|select|open|activate|choose|push)(?: (.+))?$/, (m) => clickCommand(m[1])],
]

function panelCommand(words: string, action: 'describe' | 'go'): VoiceCommand | null {
  const panel = panelOf(words)
  return panel ? { kind: 'panel', panel, action } : null
}

/** "click click" or "press, press it": the command said twice, not a name. */
const REPEATED_VERB = /^(?:click|press|tap|select|open|activate|choose|push)(?: (.*))?$/

function clickCommand(words: string | undefined): VoiceCommand {
  const again = words?.match(REPEATED_VERB)
  if (again) return clickCommand(again[1])
  if (!words || POINTED.test(words)) return { kind: 'click' }
  return { kind: 'click', target: withoutArticle(words).replace(ROLE_WORDS, '') }
}

/** Turns what was heard into a command, a question for the AI, or nothing. */
export function parseUtterance(transcript: string): Understood {
  const said = transcript.trim()
  const text = normalise(said)
  if (text === '' || ONLY_FILLER.test(text)) return { type: 'nothing' }
  for (const [pattern, build] of RULES) {
    const match = text.match(pattern)
    const command = match ? build(match) : null
    if (command) return { type: 'command', command }
  }
  return { type: 'question', text: said }
}
