// Companion mode with a real screen reader: NVDA speaks what iBrowse writes to its live region,
// and iBrowse does not speak it too. Skipped unless IBROWSE_NVDA is the path to nvda.exe.
// NVDA runs minimal, with its own config folder, and logs what it says (log level 12, "io").
//
//   IBROWSE_NVDA=C:\path\to\NVDA\nvda.exe npx playwright test e2e/live/nvda-live.spec.ts
import { expect, test } from '@playwright/test'
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchHarness, ORIGIN } from '../helpers'

const here = path.dirname(fileURLToPath(import.meta.url))

const nvda = process.env.IBROWSE_NVDA ?? ''

const PAGE = `<!doctype html>
  <title>Garden Shop</title>
  <style>body { margin: 0; font: 20px sans-serif; } button { margin: 40px; padding: 20px; }</style>
  <main><h1>Tomatoes</h1><p>Easy to grow in sun.</p><button>Add to basket</button></main>`

/** What NVDA said, from its log: the text of each "Speaking" line. */
function nvdaSaid(logFile: string): string {
  if (!existsSync(logFile)) return ''
  return readFileSync(logFile, 'utf8')
    .split('\n')
    .filter((line) => line.includes('Speaking'))
    .join('\n')
}

const count = (text: string, phrase: string): number => text.split(phrase).length - 1

test.describe('Companion mode with NVDA', () => {
  test.skip(!nvda || !existsSync(nvda), 'set IBROWSE_NVDA to the path of nvda.exe')
  test.setTimeout(90_000)

  test('NVDA speaks what iBrowse writes, once, and iBrowse stays quiet itself', async () => {
    const work = mkdtempSync(path.join(tmpdir(), 'ibrowse-nvda-'))
    const logFile = path.join(work, 'nvda.log')
    const screenReader = spawn(nvda, ['-m', '-c', path.join(work, 'config'), '-f', logFile, '-l', '12'], {
      detached: true,
      stdio: 'ignore',
    })
    screenReader.unref()
    const harness = await launchHarness({ '/': PAGE }, { headed: true })
    try {
      await expect.poll(() => existsSync(logFile), { timeout: 20_000 }).toBe(true)
      await harness.store({ settings: { screenReaderMode: 'companion' } })
      const page = await harness.context.newPage()
      await page.goto(`${ORIGIN}/`)
      await page.bringToFront()
      // NVDA follows the window Windows has in front, so ask Windows to bring the browser forward.
      await new Promise((resolve) =>
        execFile(
          'powershell',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'focus-window.ps1'), '-Title', 'Garden Shop'],
          (_error, stdout) => resolve(console.log(`window: ${String(stdout).trim()}`)),
        ),
      )
      await expect.poll(() => nvdaSaid(logFile), { timeout: 20_000 }).toContain('Garden Shop')
      await page.waitForTimeout(3000) // NVDA reads the new page first
      await harness.toggleExplore(ORIGIN)

      await expect.poll(() => nvdaSaid(logFile), { timeout: 20_000 }).toContain('Explore mode on')
      await expect.poll(() => nvdaSaid(logFile), { timeout: 20_000 }).toContain('Want me to read it?')
      await page.keyboard.press('Escape')

      const box = (await page.getByRole('button', { name: 'Add to basket' }).boundingBox())!
      await page.mouse.move(box.x + 10, box.y + 10)
      await expect.poll(() => nvdaSaid(logFile), { timeout: 20_000 }).toContain('Add to basket — Button, Clickable')

      const said = nvdaSaid(logFile)
      expect(count(said, 'Explore mode on')).toBe(1)
      expect(await harness.spoken()).toEqual([]) // one voice: NVDA's
      console.log(`NVDA said:\n${said}`)
    } finally {
      await harness.close()
      await new Promise((resolve) => execFile(nvda, ['-q'], () => resolve(undefined)))
    }
  })
})
