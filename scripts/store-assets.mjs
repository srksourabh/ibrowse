// Makes the Chrome Web Store images from the built extension: 1280x800 screenshots and the
// 440x280 small promo tile. Run `npm run build` first, then `npm run store-assets`.
import { chromium } from '@playwright/test'
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const extensionPath = path.join(root, '.output', 'chrome-mv3')
const outDir = path.join(root, 'docs', 'store')
mkdirSync(outDir, { recursive: true })

const SCREENSHOTS = [
  { file: 'screenshot-1-tour.png', path: 'onboarding.html' },
  { file: 'screenshot-2-settings.png', path: 'options.html' },
  { file: 'screenshot-3-hardware.png', path: 'pair.html' },
]

const icon = readFileSync(path.join(root, 'scripts', 'icon.svg'), 'utf8')
const TILE = `<!doctype html>
  <style>
    body { margin: 0; width: 440px; height: 280px; display: flex; align-items: center; gap: 24px;
      padding: 0 32px; box-sizing: border-box; background: #10233f; color: #fff; font: 600 20px system-ui, sans-serif; }
    svg { width: 120px; height: 120px; flex: none; }
    h1 { margin: 0 0 8px; font-size: 40px; }
    p { margin: 0; font-weight: 400; line-height: 1.35; }
  </style>
  ${icon}
  <div><h1>iBrowse</h1><p>Hear any website.<br>Explore by mouse, touch and voice.</p></div>`

const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'ibrowse-store-')), {
  channel: 'chromium',
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
})

try {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
  const extensionId = new URL(worker.url()).host
  for (const shot of SCREENSHOTS) {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/${shot.path}`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(outDir, shot.file) })
    console.log(`captured docs/store/${shot.file}`)
    await page.close()
  }
  const tile = await context.newPage()
  await tile.setViewportSize({ width: 440, height: 280 })
  await tile.setContent(TILE)
  await tile.screenshot({ path: path.join(outDir, 'promo-small-440x280.png') })
  console.log('captured docs/store/promo-small-440x280.png')
} finally {
  await context.close()
}
