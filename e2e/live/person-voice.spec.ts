// A person's own voice, through the computer's real microphone, into iBrowse: Explore Mode is on,
// the talk key is held, the person says "Scroll down." after the beep, and the page scrolls.
// Uses the Gemini recogniser with the key in .env.local, because Google Chrome cannot load an
// unpacked extension from the command line (chrome-mic.spec.ts checks Chrome's recogniser).
// Skipped unless IBROWSE_PERSON=1.
//
//   IBROWSE_PERSON=1 npx playwright test e2e/live/person-voice.spec.ts
import { expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { launchHarness, ORIGIN } from '../helpers'
import { geminiKey } from './live-helpers'

/** Long enough to hear the beep and say the command at an easy pace. */
const HOLD_MS = 6000

const PAGE = `<!doctype html>
  <title>Garden Shop</title>
  <style>main p { margin: 0 0 900px; }</style>
  <main><h1>Tomatoes</h1><p>Easy to grow in sun.</p><p>Water often.</p></main>`

const beep = (): Promise<void> =>
  new Promise((resolve) => execFile('powershell', ['-NoProfile', '-Command', '[console]::beep(880, 300)'], () => resolve()))

test.describe("a person's voice through the real microphone", () => {
  test.skip(process.env.IBROWSE_PERSON !== '1', 'set IBROWSE_PERSON=1 with someone ready to speak')
  test.setTimeout(60_000)

  test('"Scroll down." said after the beep scrolls the page', async () => {
    const harness = await launchHarness({ '/': PAGE }, { headed: true, realMicrophone: true })
    try {
      await harness.store({ settings: { voiceInput: 'gemini' }, geminiKey: geminiKey() })
      // Keeps Gemini's answers in the worker, so a failure can show what it made of the speech.
      await harness.worker.evaluate(() => {
        const answers: string[] = ((globalThis as unknown as { answers: string[] }).answers = [])
        const realFetch = globalThis.fetch
        globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
          const response = await realFetch(...args)
          void response.clone().text().then((body) => answers.push(body.slice(0, 2000)))
          return response
        }
      })
      const page = await harness.context.newPage()
      await page.goto(`${ORIGIN}/`)
      await harness.toggleExplore(ORIGIN)
      await harness.expectSpoken(/Want me to read it\?$/)
      await page.keyboard.press('Escape')
      await page.keyboard.down('Alt')
      await page.keyboard.down('Shift')
      await page.keyboard.down('KeyV')
      await beep()
      await page.waitForTimeout(HOLD_MS)
      await page.keyboard.up('KeyV')
      await page.keyboard.up('Shift')
      await page.keyboard.up('Alt')
      await expect.poll(async () => (await harness.spoken()).length, { timeout: 20_000 }).toBeGreaterThan(2)
      await page.waitForTimeout(2000)
      const answers = await harness.worker.evaluate(() => (globalThis as unknown as { answers: string[] }).answers)
      console.log(`Gemini answered: ${answers.map((a) => /"text":\s*"([^"]*)"/.exec(a)?.[1] ?? a.slice(0, 300)).join(' / ')}`)
      console.log(`iBrowse said: ${JSON.stringify(await harness.spoken())}`)
      await harness.expectSpoken(/^Scrolled down\./)
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    } finally {
      await harness.close()
    }
  })
})
