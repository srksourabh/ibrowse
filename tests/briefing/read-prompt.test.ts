import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROMPT_TIMEOUT_MS, ReadPrompt } from '../../src/briefing/read-prompt'

function setup() {
  const onAccept = vi.fn()
  const onDismiss = vi.fn()
  const prompt = new ReadPrompt({ onAccept, onDismiss })
  return { prompt, onAccept, onDismiss }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('ReadPrompt', () => {
  it('accepts on Y or Enter, and consumes the key', () => {
    for (const key of ['y', 'Y', 'Enter']) {
      const { prompt, onAccept } = setup()
      prompt.open()
      expect(prompt.handleKey(key)).toBe(true)
      expect(onAccept).toHaveBeenCalledOnce()
      expect(prompt.isOpen).toBe(false)
    }
  })

  it('dismisses on N or Escape, and consumes the key', () => {
    for (const key of ['n', 'N', 'Escape']) {
      const { prompt, onAccept, onDismiss } = setup()
      prompt.open()
      expect(prompt.handleKey(key)).toBe(true)
      expect(onDismiss).toHaveBeenCalledOnce()
      expect(onAccept).not.toHaveBeenCalled()
      expect(prompt.isOpen).toBe(false)
    }
  })

  it('leaves other keys alone and stays open', () => {
    const { prompt } = setup()
    prompt.open()
    expect(prompt.handleKey('Tab')).toBe(false)
    expect(prompt.isOpen).toBe(true)
  })

  it('ignores keys while closed', () => {
    const { prompt, onAccept } = setup()
    expect(prompt.handleKey('y')).toBe(false)
    expect(onAccept).not.toHaveBeenCalled()
  })

  it('closes silently after the timeout', () => {
    const { prompt, onAccept, onDismiss } = setup()
    prompt.open()
    vi.advanceTimersByTime(PROMPT_TIMEOUT_MS)
    expect(prompt.isOpen).toBe(false)
    expect(onAccept).not.toHaveBeenCalled()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('stays open until the timeout', () => {
    const { prompt } = setup()
    prompt.open()
    vi.advanceTimersByTime(PROMPT_TIMEOUT_MS - 1)
    expect(prompt.isOpen).toBe(true)
  })

  it('ignores pointer jitter but dismisses on a real move', () => {
    const { prompt, onDismiss } = setup()
    prompt.open()
    prompt.handlePointerMove(100, 100) // sets the origin
    prompt.handlePointerMove(104, 100)
    expect(prompt.isOpen).toBe(true)
    prompt.handlePointerMove(140, 100)
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(prompt.isOpen).toBe(false)
  })

  it('measures movement from the pointer position when it opened', () => {
    const { prompt } = setup()
    prompt.handlePointerMove(50, 50) // before opening: remembered as the latest position
    prompt.open()
    prompt.handlePointerMove(52, 50)
    expect(prompt.isOpen).toBe(true)
    prompt.handlePointerMove(90, 50)
    expect(prompt.isOpen).toBe(false)
  })

  it('dismiss() closes without calling anything', () => {
    const { prompt, onDismiss } = setup()
    prompt.open()
    prompt.dismiss()
    expect(prompt.isOpen).toBe(false)
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
