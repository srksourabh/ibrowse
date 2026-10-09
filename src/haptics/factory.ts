import type { AudioContextLike } from '../audio/earcons'
import type { Settings } from '../shared/settings'
import type { HapticDriver } from './driver'
import { GamepadDriver, type GamepadDriverDeps } from './gamepad-driver'
import type { HapticRequest, HapticResponse } from './messages'
import { RelayDriver } from './relay-driver'
import { SimulatorDriver } from './simulator-driver'

/** What the drivers need from the page they run in. */
export interface DriverEnv {
  /** Only called if the sound simulator is chosen. */
  audioContext(): AudioContextLike
  getGamepads: GamepadDriverDeps['getGamepads']
  onGamepadDisconnected: GamepadDriverDeps['onGamepadDisconnected']
  /** Sends a request to the background worker, which owns the WebHID device. */
  send(request: HapticRequest): Promise<HapticResponse>
}

/** The driver for a setting. Null means sound only. */
export function createHapticDriver(
  kind: Settings['hapticDriver'],
  env: DriverEnv,
): HapticDriver | null {
  switch (kind) {
    case 'simulator':
      return new SimulatorDriver(env.audioContext())
    case 'gamepad':
      return new GamepadDriver({
        getGamepads: env.getGamepads,
        onGamepadDisconnected: env.onGamepadDisconnected,
      })
    case 'webhid':
      return new RelayDriver(env.send)
    case 'none':
      return null
  }
}
