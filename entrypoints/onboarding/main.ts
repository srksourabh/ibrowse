import { OnboardingTour, onboardingSteps, type TourStep } from '../../src/onboarding/tour'
import { byId, createPageSpeaker } from '../../src/pages/page-speaker'
import { loadSettings } from '../../src/shared/settings'

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

async function main(): Promise<void> {
  const { screenReaderMode, shortcutKeys } = await loadSettings(chrome.storage.local)
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
