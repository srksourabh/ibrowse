// Captures the README screenshots from the built extension.
// Run `npm run build` first, then `npm run screenshots`.
import { chromium } from '@playwright/test'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const extensionPath = path.join(root, '.output', 'chrome-mv3')
const outDir = path.join(root, 'docs', 'images')
mkdirSync(outDir, { recursive: true })

const PAGES = [
  { file: 'settings.png', path: 'options.html', name: 'settings' },
  { file: 'hardware-setup.png', path: 'pair.html', name: 'hardware setup' },
  { file: 'first-run-tour.png', path: 'onboarding.html', name: 'first-run tour' },
]

const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'ibrowse-shots-')), {
  channel: 'chromium',
  viewport: { width: 1100, height: 760 },
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
})

try {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
  const extensionId = new URL(worker.url()).host
  for (const shot of PAGES) {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/${shot.path}`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(outDir, shot.file) })
    console.log(`captured ${shot.name} -> docs/images/${shot.file}`)
    await page.close()
  }
} finally {
  await context.close()
}
