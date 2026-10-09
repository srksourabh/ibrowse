import type { ConnectResult } from './driver'
import type { HapticEvent } from './events'

/** Content script to background: the WebHID device lives in the background worker. */
export type HapticRequest =
  | { readonly type: 'haptic-connect' }
  | { readonly type: 'haptic-play'; readonly event: HapticEvent; readonly intensity: number }
  | { readonly type: 'haptic-disconnect' }

export type HapticResponse = ConnectResult

/** Background to content script: the device went away. */
export type HapticNotice = { readonly type: 'haptic-disconnected' }
