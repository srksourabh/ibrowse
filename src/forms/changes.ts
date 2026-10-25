import { describeElement } from '../hover/describe'

const labelOf = (el: Element): string => describeElement(el).label || 'Unlabeled'

/**
 * What to say when a control's value is changed by the user: a checkbox ticked,
 * an option chosen. Text fields return null because the typing echo covers them.
 */
export function changeText(el: Element): string | null {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox') return `${labelOf(el)}: ${el.checked ? 'checked' : 'not checked'}`
    if (el.type === 'radio') return el.checked ? `${labelOf(el)}: selected` : null
    if (el.type === 'range') return `${labelOf(el)}: ${el.value}`
  }
  if (el instanceof HTMLSelectElement) {
    const chosen = Array.from(el.selectedOptions)
      .map((option) => (option.textContent ?? '').trim())
      .join(', ')
    return `${labelOf(el)}: ${chosen}`
  }
  return null
}

/** The browser's own message for a field that failed validation, with the field's name. */
export function invalidText(el: Element): string {
  const message = (el as HTMLInputElement).validationMessage
  return `${labelOf(el)}: ${message || 'Invalid value'}`
}

/**
 * What to say when a form is sent: the button that sent it, or the form's own
 * name. The browser fires this only once validation has passed.
 */
export function submitText(form: HTMLFormElement, submitter: Element | null): string {
  const name =
    (submitter && describeElement(submitter).label) || describeElement(form).label || 'Form'
  return `${name}: submitted`
}
