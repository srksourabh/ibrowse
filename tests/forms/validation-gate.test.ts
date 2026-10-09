import { describe, expect, it } from 'vitest'
import { FOCUS_AFTER_INVALID_MS, ValidationGate } from '../../src/forms/validation-gate'

describe('ValidationGate', () => {
  it('lets a focus announcement interrupt normally', () => {
    expect(new ValidationGate(() => 0).focusMayInterrupt()).toBe(true)
  })

  it('makes a focus announcement wait its turn right after a validation message', () => {
    let clock = 1000
    const gate = new ValidationGate(() => clock)
    gate.noteInvalid()
    clock += FOCUS_AFTER_INVALID_MS - 1
    expect(gate.focusMayInterrupt()).toBe(false)
  })

  it('goes back to interrupting once the moment has passed', () => {
    let clock = 1000
    const gate = new ValidationGate(() => clock)
    gate.noteInvalid()
    clock += FOCUS_AFTER_INVALID_MS + 1
    expect(gate.focusMayInterrupt()).toBe(true)
  })
})
