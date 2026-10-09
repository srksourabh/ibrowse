import { createHapticDriver, type DriverEnv } from '../haptics/factory'
import { HapticManager } from '../haptics/manager'
import type { HapticRequest, HapticResponse } from '../haptics/messages'
import { RelayDriver } from '../haptics/relay-driver'
import { HapticSwitch } from '../haptics/switch'
import type { Settings } from '../shared/settings'
import type { Services } from './services'

export interface SessionHaptics {
  readonly manager: HapticManager
  /** The settings arrived or changed. The driver is only touched while Explore Mode is on. */
  apply(settings: Settings): Promise<void>
  /** Explore Mode turned on or off: connect the driver, or let it go. */
  setActive(active: boolean): Promise<void>
  /** The background worker says the paired device was unplugged. */
  deviceLost(): void
}

function driverEnv(s: Services): DriverEnv {
  return {
    audioContext: s.audioContext,
    getGamepads: typeof navigator.getGamepads === 'function' ? () => navigator.getGamepads() : undefined,
    onGamepadDisconnected: (listener) => {
      window.addEventListener('gamepaddisconnected', listener)
      return () => window.removeEventListener('gamepaddisconnected', listener)
    },
    send: (request: HapticRequest): Promise<HapticResponse> => chrome.runtime.sendMessage(request),
  }
}

/** Builds the haptic manager for a page and keeps its driver in step with the settings. */
export function createHaptics(s: Services, isTopFrame: boolean): SessionHaptics {
  const manager = new HapticManager({
    getIntensity: () => s.settings().hapticIntensity,
    // Every frame has a manager, but only the top frame speaks, so a problem is said once.
    onProblem: (text) => {
      if (isTopFrame) void s.speech.speak({ text, rate: s.rate() }, { interrupt: false })
    },
  })
  const env = driverEnv(s)
  let relay: RelayDriver | null = null
  const switcher = new HapticSwitch({
    manager,
    create: (kind) => {
      const driver = createHapticDriver(kind, env)
      relay = driver instanceof RelayDriver ? driver : null
      return driver
    },
  })

  return {
    manager,
    apply: (settings) => switcher.setSettings(settings),
    setActive: (active) => switcher.setActive(active),
    deviceLost: () => relay?.handleDisconnected(),
  }
}
