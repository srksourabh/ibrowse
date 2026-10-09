const INPUT_ROLES: Readonly<Record<string, string>> = {
  checkbox: 'checkbox',
  radio: 'radio',
  range: 'slider',
  number: 'spinbutton',
  search: 'searchbox',
  button: 'button',
  submit: 'button',
  reset: 'button',
  image: 'button',
}

/** Roles a user can activate or type into. */
export const INTERACTIVE_ROLES: ReadonlySet<string> = new Set([
  'link',
  'button',
  'checkbox',
  'radio',
  'textbox',
  'searchbox',
  'combobox',
  'listbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
])

/**
 * The element's ARIA role: explicit if given, otherwise the native one.
 * Returns 'generic' for anything with no role of interest.
 */
export function roleOf(el: Element): string {
  const explicit = el.getAttribute('role')?.trim().split(/\s+/)[0]
  if (explicit && explicit !== 'presentation' && explicit !== 'none') return explicit

  const tag = el.localName
  if (/^h[1-6]$/.test(tag)) return 'heading'
  switch (tag) {
    case 'a':
    case 'area':
      return el.hasAttribute('href') ? 'link' : 'generic'
    case 'button':
    case 'summary':
      return 'button'
    case 'select':
      return 'combobox'
    case 'textarea':
      return 'textbox'
    case 'input': {
      const type = (el.getAttribute('type') ?? 'text').toLowerCase()
      return type === 'hidden' ? 'generic' : (INPUT_ROLES[type] ?? 'textbox')
    }
    case 'img':
      // An empty alt marks the image as decorative.
      return el.getAttribute('alt') === '' ? 'generic' : 'image'
    case 'p':
      return 'paragraph'
    default:
      return 'generic'
  }
}
