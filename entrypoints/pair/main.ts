import { createHapticDriver, type DriverEnv } from '../../src/haptics/factory'
import { HapticManager } from '../../src/haptics/manager'
import type { HapticRequest, HapticResponse } from '../../src/haptics/messages'
import { PairingController, type PairingDeps } from '../../src/haptics/pairing'
import { runTestPattern } from '../../src/haptics/test-pattern'
import { byId, createPageSpeaker } from '../../src/pages/page-speaker'
import { loadSettings } from '../../src/shared/settings'

function driverEnv(): DriverEnv {
  return {
    audioContext: () => new AudioContext(),
    getGamepads: () => navigator.getGamepads(),
    onGamepadDisconnected: (listener) => {
      window.addEventListener('gamepaddisconnected', listener)
      return () => window.removeEventListener('gamepaddisconnected', listener)
    },
    send: (request: HapticRequest): Promise<HapticResponse> => chrome.runtime.sendMessage(request),
  }
}

/** Plays the test pattern through whatever driver is selected right now. */
async function playThroughSelectedDriver(speak: (text: string) => void): Promise<void> {
  const settings = await loadSettings(chrome.storage.local)
  const manager = new HapticManager({ getIntensity: () => settings.hapticIntensity, onProblem: speak })
  await manager.use(createHapticDriver(settings.hapticDriver, driverEnv()))
  await runTestPattern({
    speak,
    play: (event) => manager.play(event),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  })
  await manager.use(null)
}

function createController(speak: (text: string) => void): PairingController {
  return new PairingController({
    speak,
    store: chrome.storage.local,
    hid: (navigator as unknown as { hid?: PairingDeps['hid'] }).hid,
    getGamepads: () => navigator.getGamepads(),
    playTest: () => playThroughSelectedDriver(speak),
  })
}

async function fillProfiles(controller: PairingController): Promise<void> {
  const select = byId<HTMLSelectElement>('profile')
  select.replaceChildren(
    ...(await controller.listProfiles()).map((p) => new Option(p.name, p.id)),
  )
}

function bindButtons(controller: PairingController, speak: (text: string) => void): void {
  const on = (id: string, action: () => Promise<unknown>): void => {
    byId(id).addEventListener('click', () => {
      action().catch((error: unknown) => {
        console.error('iBrowse setup error:', error instanceof Error ? error.message : 'unknown')
        speak('Something went wrong. Please try again.')
      })
    })
  }
  on('choose-none', () => controller.choose('none'))
  on('choose-simulator', () => controller.choose('simulator'))
  on('choose-gamepad', () => controller.choose('gamepad'))
  on('pair', () => controller.pairDevice(byId<HTMLSelectElement>('profile').value))
  on('test', () => controller.test())
  on('import', async () => {
    const imported = await controller.importProfile(byId<HTMLTextAreaElement>('profile-json').value)
    if (imported) await fillProfiles(controller)
  })
}

async function main(): Promise<void> {
  const { screenReaderMode } = await loadSettings(chrome.storage.local)
  const speak = createPageSpeaker(byId('status'), screenReaderMode === 'companion')
  const controller = createController(speak)
  bindButtons(controller, speak)
  await fillProfiles(controller)
  speak(controller.describeOptions())
}

main().catch((error: unknown) => {
  console.error('iBrowse setup error:', error instanceof Error ? error.message : 'unknown')
})
