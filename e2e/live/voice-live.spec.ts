// Real speech, real recogniser: a recorded spoken command is the microphone, and Gemini, with a real
// key, turns it into text. Skipped unless IBROWSE_LIVE=1, because it uses the network and the key.
//
//   IBROWSE_LIVE=1 IBROWSE_SPEECH_DIR=<folder of WAVs> npx playwright test e2e/live
//
// The WAV files are made by scripts/make-speech.mjs-style recording: scroll-down, scroll-up,
// click-basket and left-panel. The key is read from .env.local and given to the extension's storage.
import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchHarness, ORIGIN, type Harness } from '../helpers'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const speechDir = process.env.IBROWSE_SPEECH_DIR ?? ''
const live = process.env.IBROWSE_LIVE === '1'
/** A real round trip to Google, after the key is let go, can take several seconds. */
const LIVE_WAIT_MS = 20_000

const PAGE = `<!doctype html>
  <title>Garden Shop</title>
  <style>
    body { margin: 0; font: 16px sans-serif; display: grid; grid-template: auto 1fr auto / 220px 1fr 220px; }
    header, footer { grid-column: 1 / 4; }
    main p { margin: 0 0 900px; }
  </style>
  <header><a href="/">Home</a> <a href="/a">Seeds</a></header>
  <nav aria-label="Categories"><a href="/1">Herbs</a> <a href="/2">Fruit</a> <a href="/3">Flowers</a></nav>
  <main><h1>Tomatoes</h1><p>Easy to grow in sun.</p><p>Water often.</p>
    <button onclick="document.getElementById('status').textContent='Added'">Add to basket</button>
    <div id="status" role="status"></div></main>
  <aside><h2>Offers</h2><a href="/x">Half price pots</a></aside>
  <footer><a href="/c">Contact</a></footer>`

function geminiKey(): string {
  const env = readFileSync(path.join(root, '.env.local'), 'utf8')
  const key = /^GEMINI_API_KEY=(.*)$/m.exec(env)?.[1]?.trim()
  if (!key || key === 'your-key-here') throw new Error('No GEMINI_API_KEY in .env.local')
  return key
}

/** Seconds of sound in a WAV file. */
function seconds(file: string): number {
  const wav = readFileSync(file)
  return wav.readUInt32LE(40) / wav.readUInt16LE(32) / wav.readUInt32LE(24)
}

async function sayCommand(phrase: string, before?: (h: Harness) => Promise<void>): Promise<Harness> {
  const wav = path.join(speechDir, `${phrase}.wav`)
  if (!existsSync(wav)) throw new Error(`Missing ${wav}`)
  const harness = await launchHarness({ '/': PAGE }, { args: [`--use-file-for-fake-audio-capture=${wav}`] })
  await harness.store({ settings: { voiceInput: 'gemini' }, geminiKey: geminiKey() })
  const page = await harness.context.newPage()
  await page.goto(`${ORIGIN}/`)
  await harness.toggleExplore(ORIGIN)
  await harness.expectSpoken(/Want me to read it\?$/)
  await page.keyboard.press('Escape')
  if (before) await before(harness)
  await page.keyboard.down('Alt')
  await page.keyboard.down('Shift')
  await page.keyboard.down('KeyV')
  await page.waitForTimeout(seconds(wav) * 1000 + 500)
  await page.keyboard.up('KeyV')
  await page.keyboard.up('Shift')
  await page.keyboard.up('Alt')
  return harness
}

test.describe('real speech through the Gemini recogniser', () => {
  test.skip(!live, 'set IBROWSE_LIVE=1 to run against the real Gemini API')
  test.setTimeout(60_000)

  test('"Scroll down." scrolls the page and says so, and says where speech went', async () => {
    const harness = await sayCommand('scroll-down')
    try {
      await harness.expectSpoken(/^Scrolled down\./, LIVE_WAIT_MS)
      await harness.expectSpoken(/^What you said was sent to Google Gemini, with your key, to be turned into text\.$/, LIVE_WAIT_MS)
    } finally {
      await harness.close()
    }
  })

  test('"Click add to basket." presses the button by its name', async () => {
    const harness = await sayCommand('click-basket')
    try {
      await harness.expectSpoken(/^Add to basket: pressed$/, LIVE_WAIT_MS)
      await harness.expectSpoken(/^Added$/, LIVE_WAIT_MS)
    } finally {
      await harness.close()
    }
  })

  test('"What is on the left?" describes the left panel', async () => {
    const harness = await sayCommand('left-panel')
    try {
      await harness.expectSpoken(/^Left panel, Categories: 3 links\.$/, LIVE_WAIT_MS)
    } finally {
      await harness.close()
    }
  })

  test('"Scroll up." scrolls back up from lower on the page', async () => {
    const harness = await sayCommand('scroll-up', async (h) => {
      const [page] = h.context.pages().filter((p) => p.url().startsWith(ORIGIN))
      await page!.evaluate(() => window.scrollTo(0, 1500))
    })
    try {
      await harness.expectSpoken(/^Scrolled up\./, LIVE_WAIT_MS)
    } finally {
      await harness.close()
    }
  })
})

test.describe('real speech answering "What would you like to do?"', () => {
  test.skip(!live, 'set IBROWSE_LIVE=1 to run against the real Gemini API')
  test.setTimeout(60_000)

  test('resting on a button, hearing the question, and answering "Click." presses it', async () => {
    const wav = path.join(speechDir, 'click.wav')
    const harness = await launchHarness({ '/': PAGE }, { args: [`--use-file-for-fake-audio-capture=${wav}`] })
    try {
      await harness.store({ settings: { voiceInput: 'gemini' }, geminiKey: geminiKey() })
      const page = await harness.context.newPage()
      await page.goto(`${ORIGIN}/`)
      await harness.toggleExplore(ORIGIN)
      await harness.expectSpoken(/Want me to read it\?$/)
      await page.keyboard.press('Escape')
      const button = page.getByRole('button', { name: 'Add to basket' })
      await button.scrollIntoViewIfNeeded() // the page is tall, so the button starts below the fold
      await page.waitForTimeout(300)
      await harness.clearSpoken()
      const box = (await button.boundingBox())!
      await page.mouse.move(box.x + 10, box.y + 5)
      await harness.expectSpoken(/^Add to basket — Button, Clickable$/)
      await harness.expectSpoken(/^What would you like to do\?$/)
      await harness.expectSpoken(/^Add to basket: pressed$/, LIVE_WAIT_MS)
      await harness.expectSpoken(/^Added$/, LIVE_WAIT_MS)
    } finally {
      await harness.close()
    }
  })
})
