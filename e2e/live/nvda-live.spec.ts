// Companion mode with a real screen reader: NVDA speaks what iBrowse writes to its live region,
// and iBrowse does not speak it too. Skipped unless IBROWSE_NVDA is the path to nvda.exe.
// NVDA runs minimal, with its own config folder, and logs what it says (log level 12, "io").
// The push-to-talk check also needs IBROWSE_SPEECH_DIR (for scroll-down.wav) and a Gemini key in
// .env.local; the keys are pressed for real, so they pass through NVDA's keyboard hook.
//
//   IBROWSE_NVDA=C:\path\to\NVDA\nvda.exe npx playwright test e2e/live/nvda-live.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchHarness, ORIGIN, type Harness } from '../helpers'
import { geminiKey, seconds } from './live-helpers'

const here = path.dirname(fileURLToPath(import.meta.url))

const nvda = process.env.IBROWSE_NVDA ?? ''
const speechDir = process.env.IBROWSE_SPEECH_DIR ?? ''
const WAIT_MS = 20_000

const PAGE = `<!doctype html>
  <title>Garden Shop</title>
  <style>body { margin: 0; font: 20px sans-serif; } button { margin: 40px; padding: 20px; }</style>
  <main><h1>Tomatoes</h1><p>Easy to grow in sun.</p><button>Add to basket</button></main>`

const PANELS = `<!doctype html>
  <title>Garden Shop</title>
  <style>
    body { margin: 0; font: 16px sans-serif; display: grid; grid-template: auto 1fr auto / 220px 1fr 220px; }
    header, footer { grid-column: 1 / 4; }
    main p { margin: 0 0 900px; }
  </style>
  <header><a href="/">Home</a> <a href="/a">Seeds</a></header>
  <nav aria-label="Categories"><a href="/1">Herbs</a> <a href="/2">Fruit</a> <a href="/3">Flowers</a></nav>
  <main><h1>Tomatoes</h1><p>Easy to grow in sun.</p><p>Water often.</p><button>Add to basket</button></main>
  <aside><h2>Offers</h2><a href="/x">Half price pots</a></aside>
  <footer><a href="/c">Contact</a></footer>`

/** What NVDA said, from its log: the text of each "Speaking" line. */
function nvdaSaid(logFile: string): string {
  if (!existsSync(logFile)) return ''
  return readFileSync(logFile, 'utf8')
    .split('\n')
    .filter((line) => line.includes('Speaking'))
    .join('\n')
}

const count = (text: string, phrase: string): number => text.split(phrase).length - 1

const powershell = (script: string, ...args: string[]): Promise<string> =>
  new Promise((resolve) =>
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, script), ...args], (_e, out) =>
      resolve(String(out).trim()),
    ),
  )

interface WithNvda {
  harness: Harness
  page: Page
  said: () => string
}

/** Starts NVDA and a headed browser in Companion mode, opens the page in front, and turns Explore Mode on. */
async function withNvda(
  html: string,
  options: { args?: string[]; store?: Record<string, unknown> },
  check: (w: WithNvda) => Promise<void>,
): Promise<void> {
  const work = mkdtempSync(path.join(tmpdir(), 'ibrowse-nvda-'))
  const logFile = path.join(work, 'nvda.log')
  const said = (): string => nvdaSaid(logFile)
  spawn(nvda, ['-m', '-c', path.join(work, 'config'), '-f', logFile, '-l', '12'], { detached: true, stdio: 'ignore' }).unref()
  const harness = await launchHarness({ '/': html }, { headed: true, args: options.args })
  try {
    await expect.poll(() => existsSync(logFile), { timeout: WAIT_MS }).toBe(true)
    const stored = (options.store?.settings ?? {}) as Record<string, unknown>
    await harness.store({ ...options.store, settings: { ...stored, screenReaderMode: 'companion' } })
    const page = await harness.context.newPage()
    await page.goto(`${ORIGIN}/`)
    await page.bringToFront()
    // NVDA follows the window Windows has in front, so ask Windows to bring the browser forward.
    console.log(`window: ${await powershell('focus-window.ps1', '-Title', 'Garden Shop')}`)
    await expect.poll(said, { timeout: WAIT_MS }).toContain('Garden Shop')
    await page.waitForTimeout(3000) // NVDA reads the new page first
    await harness.toggleExplore(ORIGIN)
    await expect.poll(said, { timeout: WAIT_MS }).toContain('Want me to read it?')
    await page.keyboard.press('Escape')
    await check({ harness, page, said })
    console.log(`NVDA said:\n${said()}`)
  } finally {
    await harness.close()
    await new Promise((resolve) => execFile(nvda, ['-q'], () => resolve(undefined)))
  }
}

test.describe('Companion mode with NVDA', () => {
  test.skip(!nvda || !existsSync(nvda), 'set IBROWSE_NVDA to the path of nvda.exe')
  test.setTimeout(90_000)

  test('NVDA speaks what iBrowse writes, once, and iBrowse stays quiet itself', async () => {
    await withNvda(PAGE, {}, async ({ harness, page, said }) => {
      const box = (await page.getByRole('button', { name: 'Add to basket' }).boundingBox())!
      await page.mouse.move(box.x + 10, box.y + 10)
      await expect.poll(said, { timeout: WAIT_MS }).toContain('Add to basket — Button, Clickable')
      expect(count(said(), 'Explore mode on')).toBe(1)
      expect(await harness.spoken()).toEqual([]) // one voice: NVDA's
    })
  })

  test('NVDA reads the panels, and push to talk works with real keys while NVDA runs', async () => {
    test.skip(!existsSync(path.join(speechDir, 'scroll-down.wav')), 'set IBROWSE_SPEECH_DIR to the folder with scroll-down.wav')
    const wav = path.join(speechDir, 'scroll-down.wav')
    const store = { settings: { voiceInput: 'gemini' }, geminiKey: geminiKey() }
    await withNvda(PANELS, { args: [`--use-file-for-fake-audio-capture=${wav}`], store }, async ({ harness, page, said }) => {
      for (const panel of ['Header: 2 links', 'Left panel, Categories: 3 links', 'Main content, Tomatoes', 'Right panel, Offers: 1 link', 'Footer: 1 link']) {
        expect(said()).toContain(panel)
      }
      const before = await page.evaluate(() => window.scrollY)
      console.log(`keys: ${await powershell('hold-keys.ps1', '-Milliseconds', String(Math.round(seconds(wav) * 1000 + 500)))}`)
      await expect.poll(said, { timeout: WAIT_MS }).toContain('Scrolled down')
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before)
      expect(await harness.spoken()).toEqual([])
    })
  })
})
