import { ExploreMode } from '../explore-mode'
import { withHaptics } from '../haptics/earcon-bridge'
import type { HapticNotice } from '../haptics/messages'
import { startLatencyPublisher } from './latency'
import type { ExploreMessage, SpeechStartedNotice } from '../shared/messages'
import { guardTouchScrolling } from '../touch/touch-guard'
import { createHandlers } from './handlers'
import { createHaptics, type SessionHaptics } from './haptics'
import { createServices, type Services } from './services'
import { createTools, type Tools } from './tools'

/** Turns the pieces on and off together as Explore Mode changes. */
function manageLifecycle(
  mode: ExploreMode,
  s: Services,
  t: Tools,
  haptics: SessionHaptics,
  cancelPending: () => void,
): void {
  let restoreTouch: (() => void) | undefined
  let stopLatency: (() => void) | undefined
  mode.onChange((enabled) => {
    if (enabled) {
      s.resumeAudio()
      if (t.isTopFrame) stopLatency = startLatencyPublisher(s, t.meter)
      t.live.start()
      restoreTouch = guardTouchScrolling(document)
      const hapticsReady = haptics.setActive(true)
      // Every frame switches on, but only the top frame speaks and briefs, so a
      // page with iframes does not announce the change several times.
      if (!t.isTopFrame) return
      void hapticsReady.then(() => s.earcons.haptic('page-change'))
      void s.speech.speak({ text: 'Explore mode on' })
      t.briefer.brief({ interrupt: false })
      return
    }
    cancelPending()
    t.hover.stop()
    t.briefer.stop()
    t.live.stop()
    stopLatency?.()
    restoreTouch?.()
    void haptics.setActive(false)
    if (t.isTopFrame) void s.speech.speak({ text: 'Explore mode off' })
  })
}

function listenForMessages(
  mode: ExploreMode,
  s: Services,
  t: Tools,
  haptics: SessionHaptics,
): void {
  chrome.runtime.onMessage.addListener((message: ExploreMessage | HapticNotice | SpeechStartedNotice, sender) => {
    if (sender.id !== chrome.runtime.id) return
    switch (message.type) {
      case 'toggle-explore':
        mode.toggle()
        break
      case 'resume-explore':
        mode.enable()
        break
      case 'next-page':
        t.navigator.go('next')
        break
      case 'prev-page':
        t.navigator.go('prev')
        break
      case 'action':
        if (t.isTopFrame) t.runAction(message.action)
        break
      case 'haptic-disconnected':
        haptics.deviceLost()
        break
      case 'speech-started':
        s.handleSpeechStarted(message.id)
        break
    }
  })
}

/** Builds everything an Explore Mode session needs and waits for it to be switched on. */
export function startExploreSession(): void {
  const isTopFrame = window === window.top
  const base = createServices()
  const haptics = createHaptics(base, isTopFrame)
  // From here on, every Earcon is also felt, whichever driver (if any) is in use.
  const services: Services = { ...base, earcons: withHaptics(base.earcons, haptics.manager) }
  const tools = createTools(services, isTopFrame)
  const handlers = createHandlers(services, tools)
  const mode = new ExploreMode(document, handlers.specs)

  manageLifecycle(mode, services, tools, haptics, handlers.cancelPending)
  listenForMessages(mode, services, tools, haptics)
  services.watchSettings((settings) => {
    void haptics.apply(settings)
    if (settings.alwaysExplore) mode.enable()
  })
}
