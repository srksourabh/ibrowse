import { OnboardingTour, onboardingSteps, type TourStep } from '../../src/onboarding/tour'
import {
  QUESTION_VOICE_DELAY_MS,
  ScreenReaderQuestion,
  hasAnsweredScreenReader,
  markScreenReaderAnswered,
} from '../../src/onboarding/first-run'
import { byId, createPageSpeaker, sayInOwnVoice } from '../../src/pages/page-speaker'
import { loadSettings, saveSettings, type KeyValueStore } from '../../src/shared/settings'

/** Long enough to hear the last words before the tab goes away. */
const CLOSE_DELAY_MS = 3000

function render(tour: OnboardingTour, steps: readonly TourStep[]): void {
  byId('progress').textContent = `Step ${tour.index + 1} of ${steps.length}`
  byId('step').textContent = steps[tour.index]!.text
}

/** Closes the tab once the tour is over, unless a screen reader is speaking through this page. */
function closeSoon(companion: boolean): void {
  if (companion) return
  setTimeout(() => {
    chrome.tabs
      .getCurrent()
      .then((tab) => (tab?.id === undefined ? undefined : chrome.tabs.remove(tab.id)))
      .catch((error: unknown) =>
        console.error('iBrowse tour error:', error instanceof Error ? error.message : 'unknown'),
      )
  }, CLOSE_DELAY_MS)
}

/** Asks whether a screen reader is in use, and resolves once the answer is saved (ADR-0019). */
function askScreenReader(store: KeyValueStore): Promise<void> {
  // Its own live region, so the tour's first step cannot replace the thank-you before it is read.
  const live = byId('answer')
  const panel = byId('question')
  return new Promise((resolve) => {
    const question = new ScreenReaderQuestion({
      announce: (text) => {
        live.textContent = text
        byId('step').textContent = text
      },
      voice: sayInOwnVoice,
      save: async (mode) => {
        await saveSettings(store, { screenReaderMode: mode })
        await markScreenReaderAnswered(store)
      },
      later: (run) => {
        const timer = setTimeout(run, QUESTION_VOICE_DELAY_MS)
        return () => clearTimeout(timer)
      },
      done: () => {
        document.removeEventListener('keydown', onKey)
        panel.hidden = true
        resolve()
      },
    })
    const onKey = (event: KeyboardEvent): void => {
      if (question.handleKey(event.code)) event.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    byId('uses-screen-reader').addEventListener('click', () => question.answer(true))
    byId('no-screen-reader').addEventListener('click', () => question.answer(false))
    panel.hidden = false
    // A web page cannot tell whether a screen reader is running, so the question is always voiced.
    question.start({ screenReaderDetected: false })
  })
}

async function main(): Promise<void> {
  const store = chrome.storage.local
  if (!(await hasAnsweredScreenReader(store))) await askScreenReader(store)
  byId('tour-help').hidden = false
  byId('tour-controls').hidden = false
  const { screenReaderMode, shortcutKeys } = await loadSettings(store)
  const steps = onboardingSteps(shortcutKeys)
  const companion = screenReaderMode === 'companion'
  const say = createPageSpeaker(byId('status'), companion)

  const tour: OnboardingTour = new OnboardingTour({
    steps,
    speak: (text) => {
      render(tour, steps)
      say(text)
    },
    done: () => closeSoon(companion),
  })

  byId('previous').addEventListener('click', () => tour.previous())
  byId('repeat').addEventListener('click', () => tour.repeat())
  byId('next').addEventListener('click', () => tour.next())
  byId('skip').addEventListener('click', () => tour.skip())
  // Keys are taken here, ahead of any button that has focus, so Enter does not also press it.
  document.addEventListener('keydown', (event) => {
    if (tour.handleKey(event.key)) event.preventDefault()
  })

  tour.start()
}

main().catch((error: unknown) => {
  console.error('iBrowse tour error:', error instanceof Error ? error.message : 'unknown')
})
