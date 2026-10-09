import { describe, expect, it } from 'vitest'
import { WheelStepper, deltaToPixels } from '../../src/reading/wheel-stepper'

describe('WheelStepper', () => {
  it('turns each notch of a mouse wheel into exactly one step, whatever its size', () => {
    const stepper = new WheelStepper()
    expect(stepper.push(100, 0)).toBe(1)
    expect(stepper.push(120, 0)).toBe(1)
    expect(stepper.push(-100, 0)).toBe(-1)
  })

  it('accumulates small trackpad deltas into one step', () => {
    const stepper = new WheelStepper()
    expect(stepper.push(20, 0)).toBe(0)
    expect(stepper.push(20, 0)).toBe(0)
    expect(stepper.push(20, 0)).toBe(1)
    expect(stepper.push(20, 0)).toBe(0)
  })

  it('discards accumulated movement when the direction changes', () => {
    const stepper = new WheelStepper()
    stepper.push(30, 0)
    expect(stepper.push(-30, 0)).toBe(0)
    expect(stepper.push(-30, 0)).toBe(-1)
  })

  it('reads line-based wheels as large steps', () => {
    expect(new WheelStepper().push(3, 1)).toBe(1)
  })

  it('ignores a zero delta and can be reset', () => {
    const stepper = new WheelStepper()
    expect(stepper.push(0, 0)).toBe(0)
    stepper.push(30, 0)
    stepper.reset()
    expect(stepper.push(30, 0)).toBe(0)
  })
})

describe('deltaToPixels', () => {
  it('converts line and page modes to pixels', () => {
    expect(deltaToPixels(10, 0)).toBe(10)
    expect(deltaToPixels(3, 1)).toBe(120)
    expect(deltaToPixels(1, 2)).toBe(800)
  })
})
