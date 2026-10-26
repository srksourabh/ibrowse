// Records the demo video: iBrowse on a made-up shop page, with what it says shown as captions
// and spoken by a Windows voice. The user's voice commands are fed in as text, as the other
// end-to-end tests do. Skipped unless IBROWSE_DEMO=1; then run `node scripts/media/make-demo.mjs`.
//
//   npm run build && IBROWSE_DEMO=1 npx playwright test e2e/media/demo-video.spec.ts
import { test, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchHarness, ORIGIN, type Harness } from '../helpers'
import { DEMO_PAGE, OVERLAY } from './demo-page'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const out = path.join(root, '.output', 'demo')
const VOICES = { ibrowse: 'Microsoft Zira Desktop', you: 'Microsoft David Desktop' } as const
/** iBrowse speaks briskly, as screen reader users usually set it; the user speaks at an easy pace. */
const RATES = { ibrowse: '4', you: '1' } as const
type Who = 'ibrowse' | 'you' | 'key'
/**
 * Lines that come only from the test browser having no real microphone or recogniser:
 * where speech goes, and listening failures. A real install says these once, or never.
 */
const BACKSTAGE = /^(Speech is turned into text|What you said was sent|Speech recognition needs|I could not listen|No microphone|I didn't catch that)/

interface Clip {
  readonly at: number
  readonly file: string
  readonly who: Who
  readonly text: string
}

/** Seconds of sound in a WAV file made by say.ps1. */
function seconds(file: string): number {
  const wav = readFileSync(file)
  const dataAt = wav.indexOf('data') + 4
  return wav.readUInt32LE(dataAt) / wav.readUInt32LE(28)
}

class Director {
  readonly clips: Clip[] = []
  #heard = 0
  #count = 0

  constructor(
    readonly page: Page,
    readonly harness: Harness,
    readonly start: number,
  ) {}

  async caption(who: Who, text: string): Promise<void> {
    const label = { ibrowse: 'iBrowse says', you: 'You say', key: 'You press' }[who]
    await this.page.evaluate(
      ({ label, who, text }) => {
        const bar = document.getElementById('demo-caption')!
        bar.innerHTML = ''
        const chip = document.createElement('span')
        chip.className = `who ${who}`
        chip.textContent = label
        const words = document.createElement('span')
        words.textContent = text
        bar.append(chip, words)
        bar.style.display = 'flex'
      },
      { label, who, text },
    )
  }

  /** Shows the line, speaks it into a clip at this moment of the video, and waits while it plays. */
  async line(who: Who, text: string): Promise<void> {
    console.log(`${who}: ${text}`)
    await this.caption(who, text)
    if (who === 'key') return this.page.waitForTimeout(1300)
    const at = (Date.now() - this.start) / 1000
    const textFile = path.join(out, `line-${this.#count}.txt`)
    const file = path.join(out, `line-${this.#count++}.wav`)
    writeFileSync(textFile, text)
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts', 'media', 'say.ps1'),
      '-TextFile', textFile, '-Out', file, '-Voice', VOICES[who], '-Rate', RATES[who]])
    this.clips.push({ at, file, who, text })
    const waited = (Date.now() - this.start) / 1000 - at
    await this.page.waitForTimeout(Math.max(0, (seconds(file) - waited) * 1000) + 350)
  }

  /** Speaks what iBrowse said since last time: all of it, or only the last line after a sweep of the pointer. */
  async narrate(only: 'all' | 'last' = 'all'): Promise<void> {
    await this.page.waitForTimeout(450)
    const said = (await this.harness.spoken()).slice(this.#heard)
    this.#heard += said.length
    const lines = said.filter((text) => !BACKSTAGE.test(text))
    for (const text of only === 'last' ? lines.slice(-1) : lines) await this.line('ibrowse', text)
  }

  async until(pattern: RegExp, only: 'all' | 'last' = 'all'): Promise<void> {
    await this.harness.expectSpoken(pattern, 10_000)
    await this.narrate(only)
  }

  async pointAt(selector: string): Promise<void> {
    const box = (await this.page.locator(selector).boundingBox())!
    await this.page.mouse.move(box.x + Math.min(40, box.width / 2), box.y + Math.min(18, box.height / 2), { steps: 30 })
  }

  async say(text: string): Promise<void> {
    await this.line('you', text)
    await this.harness.hear(ORIGIN, text)
  }

  async card(eyebrow: string, title: string, tagline: string, ms: number): Promise<void> {
    await this.page.evaluate(
      ({ eyebrow, title, tagline }) => {
        const card = document.getElementById('demo-card')!
        card.innerHTML = ''
        for (const [tag, text, cls] of [['div', eyebrow, 'eyebrow'], ['h1', title, ''], ['p', tagline, '']] as const) {
          const el = document.createElement(tag)
          el.textContent = text
          if (cls) el.className = cls
          card.append(el)
        }
        card.style.display = 'flex'
      },
      { eyebrow, title, tagline },
    )
    await this.page.waitForTimeout(ms)
    await this.page.evaluate(() => (document.getElementById('demo-card')!.style.display = 'none'))
  }
}

async function scene(d: Director): Promise<void> {
  const { page, harness } = d
  await d.card('Demo', 'iBrowse', 'Hear any website. Explore it by mouse, touch and voice.', 3500)
  await d.line('key', 'Alt + Shift + E   to turn on Explore Mode')
  await harness.toggleExplore(ORIGIN)
  await d.until(/Want me to read it\?$/)
  await page.keyboard.press('Escape')

  await d.pointAt('a[href="/herbs"]')
  await d.until(/^Herbs/, 'last')
  await d.pointAt('main img')
  await d.until(/tomato plant/i, 'last')
  await d.pointAt('#about')
  await d.until(/^Paragraph/, 'last')
  await page.mouse.click(...(await centre(page, '#about')))
  await d.until(/Sweet, easy to grow/)

  // Voice commands go on here, so iBrowse asks what to do only where the video shows it.
  await harness.store({ settings: { voiceInput: 'chrome' } })
  await page.waitForTimeout(500)
  await d.pointAt('#basket')
  await d.until(/^Add to basket — /, 'last')
  await d.until(/^What would you like to do\?$/, 'last')
  await d.say('Click.')
  await d.until(/^Added to your basket$/)

  await d.say('Click buy now.')
  await d.until(/Say yes to press it, or no\.$/)
  await d.say('Yes.')
  await d.until(/^Order placed$/)

  await d.say('Scroll down.')
  await d.until(/^Scrolled down\./)
  await d.say('What is on the left?')
  await d.until(/^Left panel/)
  await d.say('Scroll up.')
  await d.until(/^(Scrolled up|Top of page)/)
  await d.page.evaluate(() => (document.getElementById('demo-caption')!.style.display = 'none'))
  await d.card('Free and open source', 'iBrowse', 'github.com/srksourabh/ibrowse', 3500)
}

async function centre(page: Page, selector: string): Promise<[number, number]> {
  const box = (await page.locator(selector).boundingBox())!
  return [box.x + 30, box.y + box.height / 2]
}

test.describe('the demo video', () => {
  test.skip(process.env.IBROWSE_DEMO !== '1', 'set IBROWSE_DEMO=1 to record the demo video')
  test.setTimeout(300_000)

  test('records iBrowse on a shop page', async () => {
    rmSync(out, { recursive: true, force: true })
    mkdirSync(out, { recursive: true })
    const harness = await launchHarness({ '/': DEMO_PAGE }, { recordVideoDir: out })
    try {
      const page = await harness.context.newPage()
      const start = Date.now()
      await page.goto(`${ORIGIN}/`)
      await page.addScriptTag({ content: OVERLAY })
      const director = new Director(page, harness, start)
      await scene(director)
      writeFileSync(path.join(out, 'timeline.json'), JSON.stringify({ clips: director.clips, video: await page.video()!.path() }, null, 1))
      await page.close()
    } finally {
      await harness.close()
    }
  })
})
