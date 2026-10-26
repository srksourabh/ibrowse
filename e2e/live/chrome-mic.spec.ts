// Chrome's own recogniser with a real microphone: a recorded spoken command is played out loud
// through the speakers and heard by the computer's microphone. Google Chrome cannot load an
// unpacked extension from the command line, so this checks the same Web Speech calls the
// extension's offscreen document makes. Needs an unlocked desktop (Windows mutes the microphone
// while locked), speakers and a microphone. Skipped unless IBROWSE_MIC=1.
//
//   IBROWSE_MIC=1 IBROWSE_SPEECH_DIR=<folder with scroll-down.wav> npx playwright test e2e/live/chrome-mic.spec.ts
//
// Some laptop microphones filter out the laptop's own speakers. Then leave IBROWSE_SPEECH_DIR
// unset and say "Scroll down." into the microphone yourself after the beep.
import { chromium, expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const speechDir = process.env.IBROWSE_SPEECH_DIR
const LISTEN_MS = speechDir ? 9000 : 12_000

const powershell = (command: string): Promise<void> =>
  new Promise((resolve) => execFile('powershell', ['-NoProfile', '-Command', command], () => resolve()))

/** Plays the recorded command out loud, or beeps for a person to say it. */
const speak = (): Promise<void> =>
  speechDir
    ? powershell(`(New-Object System.Media.SoundPlayer '${path.join(speechDir, 'scroll-down.wav')}').PlaySync()`)
    : powershell('[console]::beep(880, 300)')

test.describe("Chrome's recogniser with a real microphone", () => {
  test.skip(process.env.IBROWSE_MIC !== '1', 'set IBROWSE_MIC=1 at an unlocked computer with speakers and a microphone')
  test.setTimeout(60_000)

  test('hears "Scroll down." through the microphone', async () => {
    const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'ibrowse-mic-')), {
      channel: 'chrome',
      headless: false,
      args: ['--use-fake-ui-for-media-stream'],
    })
    try {
      const page = await context.newPage()
      await page.goto('https://example.com/')
      await page.evaluate((listenMs) => {
        const Recognition = (window as unknown as { webkitSpeechRecognition: new () => any }).webkitSpeechRecognition
        const log: string[] = ((window as unknown as { log: string[] }).log = [])
        const r = new Recognition()
        r.lang = 'en-US'
        r.continuous = true
        r.interimResults = false
        r.onresult = (e: any) => log.push(`result: ${Array.from(e.results, (x: any) => x[0].transcript).join(' ')}`)
        r.onerror = (e: any) => log.push(`error: ${e.error}`)
        r.onend = () => log.push('end')
        r.start()
        setTimeout(() => r.stop(), listenMs)
      }, LISTEN_MS)
      await page.waitForTimeout(1500)
      await speak()
      await page.waitForFunction(() => (window as unknown as { log: string[] }).log.includes('end'), null, {
        timeout: LISTEN_MS + 6000,
      })
      const log = await page.evaluate(() => (window as unknown as { log: string[] }).log)
      console.log(`Chrome heard: ${JSON.stringify(log)}`)
      expect(log.join(' ')).toMatch(/result: .*scroll down/i)
    } finally {
      await context.close()
    }
  })
})
