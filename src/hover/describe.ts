import { computeAccessibleName } from 'dom-accessibility-api'
import { INTERACTIVE_ROLES, roleOf } from './roles'

export interface ElementState {
  readonly checked?: boolean | 'mixed'
  readonly pressed?: boolean | 'mixed'
  readonly expanded?: boolean
  readonly selected?: boolean
}

export interface ElementInfo {
  readonly role: string
  readonly label: string
  readonly affordance: 'interactive' | 'static'
  /** 'maybe' when clickability is only a guess from styling or attributes. */
  readonly certainty: 'sure' | 'maybe'
  readonly disabled: boolean
  readonly headingLevel?: number
  readonly state: ElementState
  /** What a form field holds. For a password, only '' or 'filled', never the text itself. */
  readonly value?: string
  readonly secret?: boolean
  readonly required?: boolean
}

const MAX_LABEL_LENGTH = 80
const MAX_VALUE_LENGTH = 60

function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Cuts at a word boundary so speech never ends mid-word. */
function truncate(text: string, max = MAX_LABEL_LENGTH): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()
}

function labelOf(el: Element, canNameFromText: boolean): string {
  const name = normalise(computeAccessibleName(el))
  if (name || !canNameFromText) return truncate(name)
  return truncate(normalise(el.textContent ?? ''))
}

function parseTristate(value: string | null): boolean | 'mixed' | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return value === 'mixed' ? 'mixed' : undefined
}

function stateOf(el: Element, role: string): ElementState {
  const checked =
    el instanceof HTMLInputElement && (role === 'checkbox' || role === 'radio')
      ? el.checked
      : parseTristate(el.getAttribute('aria-checked'))
  const pressed = parseTristate(el.getAttribute('aria-pressed'))
  const expanded = parseTristate(el.getAttribute('aria-expanded'))
  const selected = parseTristate(el.getAttribute('aria-selected'))
  return {
    ...(checked === undefined ? {} : { checked }),
    ...(pressed === undefined ? {} : { pressed }),
    ...(typeof expanded === 'boolean' ? { expanded } : {}),
    ...(typeof selected === 'boolean' ? { selected } : {}),
  }
}

const TEXT_ROLES = new Set(['textbox', 'searchbox', 'spinbutton'])

/** The value of a form field, if it is one. A password is reported as filled or empty only. */
function valueOf(el: Element, role: string): { value?: string; secret?: boolean } {
  if (el instanceof HTMLInputElement && el.type === 'password') {
    return { secret: true, value: el.value ? 'filled' : '' }
  }
  if (el instanceof HTMLSelectElement) {
    const chosen = Array.from(el.selectedOptions).map((o) => normalise(o.textContent ?? ''))
    return { value: truncate(chosen.join(', '), MAX_VALUE_LENGTH) }
  }
  if (el instanceof HTMLInputElement && el.type === 'range') return { value: el.value }
  if (
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
    TEXT_ROLES.has(role)
  ) {
    return { value: truncate(normalise(el.value), MAX_VALUE_LENGTH) }
  }
  if (role === 'slider' || role === 'spinbutton') {
    const aria = el.getAttribute('aria-valuetext') ?? el.getAttribute('aria-valuenow')
    return aria === null ? {} : { value: aria }
  }
  return {}
}

function isRequired(el: Element): boolean {
  const native =
    (el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement) &&
    el.required
  return native || el.getAttribute('aria-required') === 'true'
}

function looksClickable(el: Element): boolean {
  if (el.hasAttribute('onclick')) return true
  const tabindex = el.getAttribute('tabindex')
  if (tabindex !== null && Number(tabindex) >= 0) return true
  return getComputedStyle(el).cursor === 'pointer'
}

function headingLevelOf(el: Element): number | undefined {
  const fromTag = /^h([1-6])$/.exec(el.localName)
  if (fromTag) return Number(fromTag[1])
  const fromAria = Number(el.getAttribute('aria-level'))
  return Number.isInteger(fromAria) && fromAria > 0 ? fromAria : undefined
}

/**
 * Role, name, state and Affordance of an element. Event listeners added by
 * the page are invisible to a content script, so clickability of plain
 * elements is a guess, reported as certainty 'maybe' (ADR-0010).
 */
export function describeElement(el: Element): ElementInfo {
  const role = roleOf(el)
  const sure = INTERACTIVE_ROLES.has(role)
  const guess = !sure && role === 'generic' && looksClickable(el)
  const headingLevel = role === 'heading' ? headingLevelOf(el) : undefined
  const { value, secret } = valueOf(el, role)

  return {
    role,
    label: labelOf(el, !sure),
    affordance: sure || guess ? 'interactive' : 'static',
    certainty: guess ? 'maybe' : 'sure',
    disabled: el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true',
    ...(headingLevel === undefined ? {} : { headingLevel }),
    state: stateOf(el, role),
    ...(value === undefined ? {} : { value }),
    ...(secret ? { secret } : {}),
    ...(isRequired(el) ? { required: true } : {}),
  }
}
