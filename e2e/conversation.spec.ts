import { expect, test, type Page } from '@playwright/test'
import { launchHarness, ORIGIN, type Harness } from './helpers'

const LANDMARKS = `<!doctype html>
  <title>Garden Shop</title>
  <style>
    body { margin: 0; font: 16px sans-serif; display: grid; grid-template: auto 1fr auto / 220px 1fr 220px; min-height: 100vh; }
    header, footer { grid-column: 1 / 4; }
  </style>
  <header>
    <a href="/"><img alt="Garden Shop" width="40" height="40" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></a>
    <form role="search"><input type="search" aria-label="Search"></form>
    <a href="/a">Seeds</a> <a href="/b">Tools</a>
  </header>
  <nav aria-label="Categories"><a href="/1">Herbs</a> <a href="/2">Fruit</a> <a href="/3">Flowers</a></nav>
  <main><h1>Tomatoes</h1><p>Easy to grow in sun.</p><p>Water often.</p>
    <button onclick="document.getElementById('status').textContent='Added'">Add to basket</button>
    <div id="status" role="status"></div></main>
  <aside><h2>Offers</h2><a href="/x">Half price pots</a></aside>
  <footer><a href="/c">Contact</a> <a href="/p">Privacy</a></footer>`

const BOXES = `<!doctype html>
  <title>Plain News</title>
  <style>
    body { margin: 0; font: 16px sans-serif; }
    .row { display: flex; }
    .side { width: 20%; } .middle { width: 60%; }
  </style>
  <div class="top"><a href="/">Home</a> <a href="/world">World</a></div>
  <div class="row">
    <div class="side"><a href="/1">Sport</a> <a href="/2">Weather</a></div>
    <div class="middle"><h1>Rain tomorrow</h1><p>Bring a coat.</p></div>
    <div class="side"><p>Advertisement</p></div>
  </div>
  <div class="bottom"><p>Copyright</p></div>`

test.describe.serial('the panel briefing', () => {
  let harness: Harness
  let page: Page

  test.beforeAll(async () => {
    harness = await launchHarness({ '/': LANDMARKS, '/boxes': BOXES })
    page = await harness.context.newPage()
  })

  test.afterAll(async () => {
    await harness.close()
  })

  test('walks a page with landmarks panel by panel', async () => {
    await page.goto(`${ORIGIN}/`)
    await harness.toggleExplore(ORIGIN)
    await harness.expectSpoken(
      /^Garden Shop\. Web page\. Header: logo, search box, 3 links\. Left panel, Categories: 3 links\. Main content, Tomatoes: 2 paragraphs, 1 button\. Right panel, Offers: 1 link\. Footer: 2 links\. Want me to read it\?$/,
    )
    await harness.toggleExplore(ORIGIN)
  })

  test('walks a page built from plain boxes, by its layout', async () => {
    await harness.clearSpoken()
    await page.goto(`${ORIGIN}/boxes`)
    await harness.toggleExplore(ORIGIN)
    await harness.expectSpoken(
      /^Plain News\. Web page\. Header: 2 links\. Left panel: 2 links\. Main content, Rain tomorrow: 1 paragraph\. Right panel: 1 paragraph\. Footer: 1 paragraph\. Want me to read it\?$/,
    )
  })
})

test.describe.serial('voice commands', () => {
  let harness: Harness
  let page: Page

  test.beforeAll(async () => {
    harness = await launchHarness({ '/': LANDMARKS })
    page = await harness.context.newPage()
    await page.goto(`${ORIGIN}/`)
  })

  test.afterAll(async () => {
    await harness.close()
  })

  test('are ignored while Explore Mode is off', async () => {
    await harness.hear(ORIGIN, 'go to the left panel')
    await page.waitForTimeout(300)
    expect(await harness.spoken()).toEqual([])
  })

  test('move to a panel and describe it', async () => {
    await harness.toggleExplore(ORIGIN)
    await harness.expectSpoken(/Want me to read it\?$/)
    await harness.hear(ORIGIN, 'go to the left panel')
    await harness.expectSpoken(/^Left panel, Categories: 3 links\.$/)
  })

  test('press a button by its name', async () => {
    await harness.hear(ORIGIN, 'click Add to basket')
    await harness.expectSpoken(/^Add to basket: pressed$/)
    await harness.expectSpoken(/^Added$/)
  })

  test('repeat what was last said', async () => {
    await harness.clearSpoken()
    await harness.hear(ORIGIN, 'what is on the right')
    await harness.expectSpoken(/^Right panel, Offers: 1 link\.$/)
    await harness.hear(ORIGIN, 'say that again')
    await expect.poll(async () => (await harness.spoken()).filter((t) => t.startsWith('Right panel')).length).toBe(2)
  })

  test('without AI, a question gets help instead of a guess', async () => {
    await harness.hear(ORIGIN, 'Is there free delivery?')
    await harness.expectSpoken(/^I did not understand\. Say help to hear what you can say\.$/)
  })

  test('with AI on, a question goes to the AI, which asks for a key when there is none', async () => {
    await harness.store({ settings: { aiAssist: true } })
    await expect.poll(() => harness.storedSettings().then((s) => s.aiAssist)).toBe(true)
    await page.waitForTimeout(300) // the page reloads its settings when storage changes
    await harness.clearSpoken()
    await harness.hear(ORIGIN, 'Is there free delivery?')
    await harness.expectSpoken(/^One moment\.$/)
    await harness.expectSpoken(/^No Google key has been entered\. Add one in settings\.$/)
  })
})

const holdTalkKey = async (page: Page, ms: number): Promise<void> => {
  await page.keyboard.down('Alt')
  await page.keyboard.down('Shift')
  await page.keyboard.down('KeyV')
  await page.waitForTimeout(ms)
  await page.keyboard.up('KeyV')
  await page.keyboard.up('Shift')
  await page.keyboard.up('Alt')
}

test.describe.serial('push to talk', () => {
  let harness: Harness
  let page: Page

  test.beforeAll(async () => {
    harness = await launchHarness({ '/': LANDMARKS })
    page = await harness.context.newPage()
    await page.goto(`${ORIGIN}/`)
    await harness.toggleExplore(ORIGIN)
    await harness.expectSpoken(/Want me to read it\?$/)
  })

  test.afterAll(async () => {
    await harness.close()
  })

  const offscreenOpen = (): Promise<boolean> => harness.worker.evaluate(() => chrome.offscreen.hasDocument())

  test('says how to turn voice commands on while they are off, and opens no microphone', async () => {
    await holdTalkKey(page, 100)
    await harness.expectSpoken(/^Voice commands are off\. Turn them on in settings, opened with Alt\+Shift\+S\.$/)
    expect(await offscreenOpen()).toBe(false)
  })

  test('listens through the offscreen recogniser while the key is held', async () => {
    await harness.store({ settings: { voiceInput: 'chrome' } })
    await expect.poll(() => harness.storedSettings().then((s) => s.voiceInput)).toBe('chrome')
    await page.waitForTimeout(300) // the page reloads its settings when storage changes
    await holdTalkKey(page, 500)
    await expect.poll(offscreenOpen).toBe(true)
  })

  test('closes the microphone side once Explore Mode is off', async () => {
    await harness.toggleExplore(ORIGIN)
    await expect.poll(offscreenOpen).toBe(false)
  })
})

test.describe.serial('asking what to do after resting', () => {
  let harness: Harness
  let page: Page

  test.beforeAll(async () => {
    harness = await launchHarness({ '/': LANDMARKS })
    await harness.store({ settings: { voiceInput: 'chrome' } })
    page = await harness.context.newPage()
    await page.goto(`${ORIGIN}/`)
    await harness.toggleExplore(ORIGIN)
    await harness.expectSpoken(/Want me to read it\?$/)
    await page.keyboard.press('Escape')
  })

  test.afterAll(async () => {
    await harness.close()
  })

  const button = () => page.getByRole('button', { name: 'Add to basket' })
  const asked = async (): Promise<number> =>
    (await harness.spoken()).filter((t) => t === 'What would you like to do?').length

  test('does not ask while the pointer sweeps across the page', async () => {
    await harness.clearSpoken()
    const things = [
      button(),
      page.getByText('Easy to grow in sun.'),
      page.getByRole('link', { name: 'Herbs' }),
      page.getByRole('link', { name: 'Half price pots' }),
      page.getByRole('link', { name: 'Contact' }),
    ]
    for (const thing of things) {
      const box = (await thing.boundingBox())!
      await page.mouse.move(box.x + 5, box.y + 5)
      await page.waitForTimeout(400) // long enough to be described, too short to be asked
    }
    expect(await asked()).toBe(0)
  })

  test('describes what the pointer rests on, then asks what to do, then listens', async () => {
    await harness.clearSpoken()
    const box = (await button().boundingBox())!
    await page.mouse.move(box.x + 10, box.y + 5)
    await harness.expectSpoken(/^Add to basket — Button, Clickable$/)
    await harness.expectSpoken(/^What would you like to do\?$/)
    await expect.poll(() => harness.worker.evaluate(() => chrome.offscreen.hasDocument())).toBe(true)
  })

  test('the answer is carried out on what the pointer rests on', async () => {
    await harness.hear(ORIGIN, 'click')
    await harness.expectSpoken(/^Add to basket: pressed$/)
    await harness.expectSpoken(/^Added$/)
  })
})
