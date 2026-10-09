import type { ElementInfo, ElementState } from './describe'

const ROLE_NAMES: Readonly<Record<string, string>> = {
  link: 'Link',
  button: 'Button',
  checkbox: 'Checkbox',
  radio: 'Radio button',
  textbox: 'Edit text',
  searchbox: 'Search box',
  combobox: 'Combo box',
  listbox: 'List box',
  slider: 'Slider',
  spinbutton: 'Spin button',
  switch: 'Switch',
  tab: 'Tab',
  menuitem: 'Menu item',
  menuitemcheckbox: 'Menu item',
  menuitemradio: 'Menu item',
  option: 'Option',
}

const UNLABELED = 'Unlabeled'
const LEAD_WORDS = 5

/** The first few words, without trailing punctuation, so a spoken offer to read stays short. */
function leadingWords(label: string): string {
  return label
    .split(/\s+/)
    .slice(0, LEAD_WORDS)
    .join(' ')
    .replace(/[.,;:!?]+$/, '')
}

function roleName(role: string): string {
  return ROLE_NAMES[role] ?? role.charAt(0).toUpperCase() + role.slice(1)
}

function triState(value: boolean | 'mixed', on: string, off: string): string {
  if (value === 'mixed') return `partially ${on}`
  return value ? on : off
}

const EMPTYABLE_ROLES = new Set(['textbox', 'searchbox'])

/** What a field holds. Edit fields say "empty"; other controls say nothing when they hold nothing. */
function valueWords(info: ElementInfo): string[] {
  if (info.value === undefined) return []
  if (info.value === '') return info.secret || EMPTYABLE_ROLES.has(info.role) ? ['empty'] : []
  return [info.value]
}

function stateWords(state: ElementState): string[] {
  const words: string[] = []
  if (state.checked !== undefined) words.push(triState(state.checked, 'checked', 'not checked'))
  if (state.pressed !== undefined) words.push(triState(state.pressed, 'pressed', 'not pressed'))
  if (state.expanded !== undefined) words.push(state.expanded ? 'expanded' : 'collapsed')
  if (state.selected !== undefined) words.push(state.selected ? 'selected' : 'not selected')
  return words
}

/**
 * The spoken description of an element (PRD §5.4). Short Mode leaves
 * "Clickable" and "Text only" to the Earcon, but never drops a warning.
 */
export function spokenText(
  info: ElementInfo,
  options: { shortMode?: boolean; aiHint?: boolean } = {},
): string {
  const short = options.shortMode ?? false
  const label = info.label || UNLABELED

  if (info.role === 'image') {
    if (info.label) return `${info.label} — Image`
    return options.aiHint
      ? 'Image, no description. Press Alt+Shift+D to describe it.'
      : 'Image, no description'
  }
  if (info.affordance === 'interactive' && info.certainty === 'maybe') {
    return `${label} — May be clickable`
  }
  if (info.affordance === 'interactive') {
    const parts = [
      info.secret ? 'Password field' : roleName(info.role),
      ...valueWords(info),
      ...stateWords(info.state),
      ...(info.required ? ['required'] : []),
    ]
    if (info.disabled) parts.push('Disabled')
    else if (!short) parts.push('Clickable')
    return `${label} — ${parts.join(', ')}`
  }
  if (info.role === 'paragraph' && info.label) {
    const lead = leadingWords(info.label)
    return short ? `Paragraph: ${lead}` : `Paragraph: ${lead}. Click to read.`
  }
  if (info.role === 'heading') {
    const parts = [`Heading level ${info.headingLevel ?? 1}`]
    if (!short) parts.push('Text only')
    return `${label} — ${parts.join(', ')}`
  }
  if (!info.label) return 'Text only'
  return short ? info.label : `${info.label} — Text only`
}
