/**
 * The public API of the iBrowse haptics SDK. Everything a hardware maker needs
 * to support a device is exported from here; nothing else in `src/haptics` is
 * promised to stay the same.
 *
 * Two ways to add a device:
 *  1. Describe it as JSON (a Device Profile) and let iBrowse's HID driver use it.
 *  2. Write a `HapticDriver` and check it with `runConformance`.
 */
export type { ConnectResult, HapticCapabilities, HapticDriver } from './driver'
export {
  HAPTIC_EFFECTS,
  HAPTIC_EVENTS,
  effectDurationMs,
  type HapticEffect,
  type HapticEvent,
  type HapticPulse,
} from './events'
export { runConformance, type ConformanceReport, type ConformanceResult } from './conformance'
export { planRumble, type RumbleStep } from './gamepad-driver'
export {
  encodeEvent,
  validateDeviceProfile,
  type DeviceMatch,
  type DeviceProfile,
  type ProfileValidation,
} from './profile'
export { renderHaptic } from './simulator-driver'
