// Renders scripts/icon.svg to public/icon/<size>.png, which WXT adds to the manifest.
// Run `npm run icons` after changing the SVG.
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(path.join(root, 'scripts', 'icon.svg'), 'utf8')
const outDir = path.join(root, 'public', 'icon')
mkdirSync(outDir, { recursive: true })

const SIZES = [16, 32, 48, 128]

const browser = await chromium.launch()
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    )
    await page.screenshot({ path: path.join(outDir, `${size}.png`), omitBackground: true })
    console.log(`rendered public/icon/${size}.png`)
    await page.close()
  }
} finally {
  await browser.close()
}
