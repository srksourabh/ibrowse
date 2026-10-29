import { describe, expect, it, vi } from 'vitest'
import {
  QUESTION,
  QUESTION_VOICE_DELAY_MS,
  ScreenReaderQuestion,
  hasAnsweredScreenReader,
  markScreenReaderAnswered,
} from '../../src/onboarding/first-run'

function setup() {
  const announced: string[] = []
  const voiced: string[] = []
  const saved: string[] = []
  const done = vi.fn()
  let pending: (() => void) | null = null
  const cancel = vi.fn(() => void (pending = null))
  const question = new ScreenReaderQuestion({
    announce: (text) => void announced.push(text),
    voice: async (text) => void voiced.push(text),
    save: async (mode) => void saved.push(mode),
    later: (run) => {
      pending = run
      return cancel
    },
    done,
  })
  const fire = (): void => pending?.()
  return { question, announced, voiced, saved, done, fire, cancel }
}

describe('ScreenReaderQuestion', () => {
  it('asks in the live region at once, so a screen reader hears it before iBrowse speaks', () => {
    const { question, announced, voiced } = setup()
    question.start({ screenReaderDetected: false })
    expect(announced).toEqual([QUESTION])
    expect(voiced).toEqual([])
    expect(QUESTION).toBe('Do you use a screen reader? Press Y for yes, N for no.')
  })

  it('then says it in its own voice, for someone with no screen reader', () => {
    const { question, voiced, fire } = setup()
    question.start({ screenReaderDetected: false })
    fire()
    expect(voiced).toEqual([QUESTION])
    expect(QUESTION_VOICE_DELAY_MS).toBeGreaterThanOrEqual(1000)
  })

  it('does not add its own voice when a screen reader is known to be running', () => {
    const { question, voiced, fire } = setup()
    question.start({ screenReaderDetected: true })
    fire()
    expect(voiced).toEqual([])
  })

  it('switches to Companion on Y, before saying anything in its own voice', async () => {
    const { question, voiced, saved, done, cancel, announced } = setup()
    question.start({ screenReaderDetected: false })
    expect(question.handleKey('KeyY')).toBe(true)
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith('companion'))
    expect(cancel).toHaveBeenCalled()
    expect(saved).toEqual(['companion'])
    expect(voiced).toEqual([])
    expect(announced.at(-1)).toMatch(/screen reader will speak for iBrowse/)
  })

  it('keeps its own voice on N, and says so aloud', async () => {
    const { question, voiced, saved, done } = setup()
    question.start({ screenReaderDetected: false })
    expect(question.handleKey('KeyN')).toBe(true)
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith('standalone'))
    expect(saved).toEqual(['standalone'])
    expect(voiced.at(-1)).toMatch(/iBrowse will speak in its own voice/)
  })

  it('lets the thank-you finish before the tour speaks over it', async () => {
    const done = vi.fn()
    let finish: () => void = () => {}
    const question = new ScreenReaderQuestion({
      announce: () => {},
      voice: (text) => (/^Thank you/.test(text) ? new Promise<void>((r) => (finish = r)) : Promise.resolve()),
      save: async () => {},
      later: () => () => {},
      done,
    })
    question.start({ screenReaderDetected: false })
    question.answer(false)
    await new Promise((r) => setTimeout(r, 10))
    expect(done).not.toHaveBeenCalled()
    finish()
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith('standalone'))
  })

  it('uses the physical key, so Y and N work on a Hindi or Bengali keyboard', () => {
    const { question } = setup()
    question.start({ screenReaderDetected: false })
    expect(question.handleKey('KeyA')).toBe(false)
    expect(question.handleKey('KeyY')).toBe(true)
  })

  it('takes only the first answer', async () => {
    const { question, saved, done } = setup()
    question.start({ screenReaderDetected: false })
    question.answer(true)
    question.answer(false)
    expect(question.handleKey('KeyN')).toBe(false)
    await vi.waitFor(() => expect(done).toHaveBeenCalledOnce())
    expect(saved).toEqual(['companion'])
  })

  it('ignores keys before it has asked', () => {
    const { question } = setup()
    expect(question.handleKey('KeyY')).toBe(false)
  })
})

describe('the screen reader answer is remembered', () => {
  const memoryStore = () => {
    const data: Record<string, unknown> = {}
    return {
      data,
      get: async (key: string) => ({ [key]: data[key] }),
      set: async (items: Record<string, unknown>) => void Object.assign(data, items),
    }
  }

  it('is not answered on a fresh install, and is once marked', async () => {
    const store = memoryStore()
    expect(await hasAnsweredScreenReader(store)).toBe(false)
    await markScreenReaderAnswered(store)
    expect(await hasAnsweredScreenReader(store)).toBe(true)
  })
})
