// Exports the presentation: one PNG per slide (docs/media/slides/) and a PDF of the whole
// deck (docs/presentation/iBrowse-presentation.pdf), which GitHub shows in the browser.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const deck = pathToFileURL(path.join(root, 'docs', 'presentation', 'index.html')).href
const slidesDir = path.join(root, 'docs', 'media', 'slides')
mkdirSync(slidesDir, { recursive: true })

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 790 }, reducedMotion: 'reduce' })
  await page.goto(deck)
  // The on-screen controls are for people moving through the deck, not part of a slide.
  await page.addStyleTag({ content: '.controls, .progress { display: none !important; }' })
  const count = await page.locator('.slide').count()
  for (let i = 1; i <= count; i++) {
    await page.goto(`${deck}#slide-${i}`)
    await page.evaluate(() => (document.querySelector('.deck').style.transform = 'none'))
    await page.waitForTimeout(150)
    await page.locator(`#slide-${i}`).screenshot({ path: path.join(slidesDir, `slide-${String(i).padStart(2, '0')}.png`) })
  }
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: path.join(root, 'docs', 'presentation', 'iBrowse-presentation.pdf'), width: '1280px', height: '720px', printBackground: true })
  console.log(`exported ${count} slides and the PDF`)
} finally {
  await browser.close()
}
