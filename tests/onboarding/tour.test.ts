import { describe, expect, it, vi } from 'vitest'
import {
  ONBOARDING_STEPS,
  OnboardingTour,
  markOnboardingDone,
  shouldOpenOnboarding,
} from '../../src/onboarding/tour'

function setup() {
  const spoken: string[] = []
  const done = vi.fn()
  const tour = new OnboardingTour({ speak: (text) => void spoken.push(text), done })
  return { tour, spoken, done }
}

describe('ONBOARDING_STEPS', () => {
  it('is a short tour, each step short enough to listen to', () => {
    expect(ONBOARDING_STEPS.length).toBeGreaterThanOrEqual(8)
    expect(ONBOARDING_STEPS.length).toBeLessThanOrEqual(12)
    for (const step of ONBOARDING_STEPS) {
      expect(step.text.trim(), step.id).not.toBe('')
      expect(step.text.length, step.id).toBeLessThanOrEqual(450)
    }
  })

  it('has unique step names', () => {
    const ids = ONBOARDING_STEPS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('teaches how to move through the tour itself, first of all', () => {
    const first = ONBOARDING_STEPS[0]!.text
    for (const word of ['Enter', 'Backspace', 'Escape']) expect(first).toContain(word)
  })

  it('names the keys a user cannot do without, spelled so a voice says them clearly', () => {
    const all = ONBOARDING_STEPS.map((s) => s.text).join(' ')
    for (const phrase of [
      'Alt, Shift and E', // Explore Mode
      'Alt, Shift and S', // settings
      'Alt, Shift and P', // hardware setup
      'Alt, Shift and W', // where am I
      'Alt, Shift and Down Arrow', // next heading
      'Escape', // stop speech
    ]) {
      expect(all, phrase).toContain(phrase)
    }
  })

  it('never uses the "Alt+Shift+E" form, which a voice reads as "plus"', () => {
    expect(ONBOARDING_STEPS.map((s) => s.text).join(' ')).not.toMatch(/Alt\+Shift/)
  })

  it('mentions touch, forms and passwords, so no one is surprised', () => {
    const all = ONBOARDING_STEPS.map((s) => s.text).join(' ').toLowerCase()
    expect(all).toContain('touchscreen')
    expect(all).toContain('password')
  })

  it('ends by saying that Enter finishes it', () => {
    expect(ONBOARDING_STEPS.at(-1)!.text).toMatch(/Enter to finish/i)
  })
})

describe('OnboardingTour', () => {
  it('speaks the first step when it starts', () => {
    const { tour, spoken } = setup()
    tour.start()
    expect(spoken).toEqual([ONBOARDING_STEPS[0]!.text])
    expect(tour.index).toBe(0)
  })

  it('moves forward and back through the steps', () => {
    const { tour, spoken } = setup()
    tour.start()
    tour.next()
    tour.next()
    expect(tour.index).toBe(2)
    tour.previous()
    expect(tour.index).toBe(1)
    expect(spoken.at(-1)).toBe(ONBOARDING_STEPS[1]!.text)
  })

  it('stays on the first step when going back from it, and says it again', () => {
    const { tour, spoken } = setup()
    tour.start()
    tour.previous()
    expect(tour.index).toBe(0)
    expect(spoken).toHaveLength(2)
  })

  it('repeats the current step', () => {
    const { tour, spoken } = setup()
    tour.start()
    tour.next()
    tour.repeat()
    expect(spoken.slice(-2)).toEqual([ONBOARDING_STEPS[1]!.text, ONBOARDING_STEPS[1]!.text])
  })

  it('finishes after the last step', () => {
    const { tour, done } = setup()
    tour.start()
    for (let i = 0; i < ONBOARDING_STEPS.length; i++) tour.next()
    expect(done).toHaveBeenCalledOnce()
    expect(tour.finished).toBe(true)
  })

  it('does nothing once finished', () => {
    const { tour, spoken, done } = setup()
    tour.start()
    tour.skip()
    const heard = spoken.length
    tour.next()
    tour.previous()
    tour.repeat()
    expect(spoken).toHaveLength(heard)
    expect(done).toHaveBeenCalledOnce()
  })

  it('can be skipped at any time, saying how to hear it again', () => {
    const { tour, spoken, done } = setup()
    tour.start()
    tour.next()
    tour.skip()
    expect(spoken.at(-1)).toMatch(/skipped/i)
    expect(spoken.at(-1)).toMatch(/settings/i)
    expect(done).toHaveBeenCalledOnce()
  })

  it('does nothing before it is started', () => {
    const { tour, spoken } = setup()
    tour.next()
    tour.repeat()
    expect(spoken).toEqual([])
  })
})

describe('OnboardingTour.handleKey', () => {
  it.each([
    ['Enter', 'next'],
    ['ArrowRight', 'next'],
    ['Backspace', 'previous'],
    ['ArrowLeft', 'previous'],
    ['r', 'repeat'],
    ['R', 'repeat'],
    ['Escape', 'skip'],
  ])('maps %s to %s and says it consumed the key', (key, action) => {
    const { tour, spoken, done } = setup()
    tour.start()
    tour.next()
    const before = tour.index
    expect(tour.handleKey(key)).toBe(true)
    if (action === 'next') expect(tour.index).toBe(before + 1)
    if (action === 'previous') expect(tour.index).toBe(before - 1)
    if (action === 'repeat') expect(spoken.at(-1)).toBe(ONBOARDING_STEPS[before]!.text)
    if (action === 'skip') expect(done).toHaveBeenCalled()
  })

  it('leaves other keys alone, so Tab and typing still work', () => {
    const { tour } = setup()
    tour.start()
    expect(tour.handleKey('Tab')).toBe(false)
    expect(tour.handleKey('a')).toBe(false)
    expect(tour.index).toBe(0)
  })
})

describe('when the tour opens by itself', () => {
  it('opens on a fresh install that has not seen it', () => {
    expect(shouldOpenOnboarding('install', false)).toBe(true)
  })

  it('does not reopen after an update, a browser update, or once it has been done', () => {
    expect(shouldOpenOnboarding('update', false)).toBe(false)
    expect(shouldOpenOnboarding('chrome_update', false)).toBe(false)
    expect(shouldOpenOnboarding('install', true)).toBe(false)
  })

  it('remembers that it has been done', async () => {
    const data: Record<string, unknown> = {}
    const store = {
      get: async (key: string) => ({ [key]: data[key] }),
      set: async (items: Record<string, unknown>) => void Object.assign(data, items),
    }
    await markOnboardingDone(store)
    expect(data.onboardingDone).toBe(true)
  })
})
