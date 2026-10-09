import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LiveRegionProvider,
  MIN_SPEECH_MS,
  REGION_RESET_MS,
  estimateSpeechMs,
} from '../../src/audio/live-region-provider'

const region = (): HTMLElement | null => document.querySelector('[data-ibrowse-live]')

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = ''
})
afterEach(() => {
  vi.useRealTimers()
  document.querySelector('[data-ibrowse-live]')?.remove()
})

describe('estimateSpeechMs', () => {
  it('grows with the length of the text', () => {
    expect(estimateSpeechMs('a'.repeat(200), 1)).toBeGreaterThan(estimateSpeechMs('a'.repeat(50), 1))
  })

  it('shrinks at a faster rate and never goes below the minimum', () => {
    expect(estimateSpeechMs('a'.repeat(200), 2)).toBeLessThan(estimateSpeechMs('a'.repeat(200), 1))
    expect(estimateSpeechMs('Hi', 3)).toBe(MIN_SPEECH_MS)
  })

  it('treats a missing or silly rate as normal', () => {
    expect(estimateSpeechMs('a'.repeat(100), undefined)).toBe(estimateSpeechMs('a'.repeat(100), 1))
    expect(estimateSpeechMs('a'.repeat(100), 0)).toBe(estimateSpeechMs('a'.repeat(100), 1))
  })
})

describe('LiveRegionProvider', () => {
  it('creates one hidden polite region that a screen reader will read', () => {
    const provider = new LiveRegionProvider(document)
    void provider.speak({ text: 'Hello' })
    const el = region()!
    expect(el.getAttribute('role')).toBe('status')
    expect(el.getAttribute('aria-live')).toBe('polite')
    expect(el.getAttribute('aria-atomic')).toBe('true')
    void provider.speak({ text: 'Again' })
    expect(document.querySelectorAll('[data-ibrowse-live]')).toHaveLength(1)
  })

  it('is hidden from sight but not from assistive technology', () => {
    void new LiveRegionProvider(document).speak({ text: 'Hello' })
    const el = region()!
    expect(el.hasAttribute('hidden')).toBe(false)
    expect(el.getAttribute('aria-hidden')).toBeNull()
    expect(el.style.position).toBe('absolute')
    expect(el.style.width).toBe('1px')
  })

  it('clears the region first, then writes the text, so the same words are announced again', () => {
    const provider = new LiveRegionProvider(document)
    void provider.speak({ text: 'Saved' })
    expect(region()!.textContent).toBe('')
    vi.advanceTimersByTime(REGION_RESET_MS)
    expect(region()!.textContent).toBe('Saved')
  })

  it('resolves after about as long as the text takes to say', async () => {
    const provider = new LiveRegionProvider(document)
    let done = false
    const speaking = provider.speak({ text: 'a'.repeat(100), rate: 1 }).then(() => {
      done = true
    })
    vi.advanceTimersByTime(estimateSpeechMs('a'.repeat(100), 1) - 1)
    await Promise.resolve()
    expect(done).toBe(false)
    vi.advanceTimersByTime(2)
    await speaking
    expect(done).toBe(true)
  })

  it('empties the region and settles the speech when cancelled', async () => {
    const provider = new LiveRegionProvider(document)
    const speaking = provider.speak({ text: 'Hello there' })
    vi.advanceTimersByTime(REGION_RESET_MS)
    provider.cancel()
    expect(region()!.textContent).toBe('')
    await expect(speaking).resolves.toBeUndefined()
  })

  it('does not write text after being cancelled', () => {
    const provider = new LiveRegionProvider(document)
    void provider.speak({ text: 'Hello there' })
    provider.cancel()
    vi.advanceTimersByTime(REGION_RESET_MS * 2)
    expect(region()!.textContent).toBe('')
  })

  it('has nothing to do when cancelled while idle', () => {
    expect(() => new LiveRegionProvider(document).cancel()).not.toThrow()
  })

  it('starts the utterance-start callback when the text is written', () => {
    const onStart = vi.fn()
    void new LiveRegionProvider(document).speak({ text: 'Hi', onStart })
    expect(onStart).not.toHaveBeenCalled()
    vi.advanceTimersByTime(REGION_RESET_MS)
    expect(onStart).toHaveBeenCalledOnce()
  })
})
