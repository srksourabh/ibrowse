import { expect, test, type Page } from '@playwright/test'
import { launchHarness, ORIGIN, type Harness } from './helpers'

const PAGE_ONE = `<!doctype html>
  <title>Garden Journal</title>
  <style>
    body { margin: 0; font: 16px sans-serif; }
    h1 { position: absolute; left: 100px; top: 20px; margin: 0; }
    p { position: absolute; left: 100px; width: 400px; margin: 0; }
    #p1 { top: 100px; } #p2 { top: 200px; } #p3 { top: 300px; }
    a { position: absolute; left: 100px; top: 500px; }
  </style>
  <h1>Welcome to the garden</h1>
  <p id="p1">Tomatoes need sun and water.</p>
  <p id="p2">Basil grows best beside them.</p>
  <p id="p3">Mint should live in a pot.</p>
  <a rel="next" href="/2">Next</a>`

const PAGE_TWO = `<!doctype html>
  <title>Page two</title>
  <h1>Second page</h1>
  <p>Nothing more to see here.</p>`

let harness: Harness
let page: Page

test.beforeAll(async () => {
  harness = await launchHarness({ '/': PAGE_ONE, '/2': PAGE_TWO })
  page = await harness.context.newPage()
  await page.goto(`${ORIGIN}/`)
})

test.afterAll(async () => {
  await harness.close()
})

test.describe.serial('page intelligence', () => {
  test('briefs the page and asks to read it when Explore Mode starts', async () => {
    await harness.toggleExplore(ORIGIN)
    await harness.expectSpoken(/^Explore mode on$/)
    await harness.expectSpoken(
      /^Garden Journal\. Web page\. 3 paragraphs, 1 heading, 1 link\. Want me to read it\?$/,
    )
  })

  test('reads the page when the user answers Y', async () => {
    await page.keyboard.press('y')
    await harness.expectSpoken(/^Welcome to the garden$/)
    await harness.expectSpoken(/^Mint should live in a pot\.$/)
    const spoken = await harness.spoken()
    expect(spoken.indexOf('Tomatoes need sun and water.')).toBeLessThan(
      spoken.indexOf('Basil grows best beside them.'),
    )
  })

  test('reads a paragraph aloud when it is clicked', async () => {
    await page.mouse.click(200, 210)
    await expect
      .poll(async () => (await harness.spoken()).at(-1))
      .toBe('Basil grows best beside them.')
  })

  test('scrubs word by word with the wheel', async () => {
    await page.mouse.move(200, 310)
    await page.mouse.wheel(0, 100)
    await expect.poll(async () => (await harness.spoken()).at(-1)).toBe('Mint')
    await page.mouse.wheel(0, 100)
    await expect.poll(async () => (await harness.spoken()).at(-1)).toBe('should')
    await page.mouse.wheel(0, -100)
    await expect.poll(async () => (await harness.spoken()).at(-1)).toBe('Mint')
  })

  test('follows the Next link, then briefs the new page without another hotkey', async () => {
    await page.keyboard.press('Control+Alt+ArrowRight')
    await harness.expectSpoken(/^Going to next page$/)
    await page.waitForURL(`${ORIGIN}/2`)
    await harness.expectSpoken(/^Page two\. Web page\. 1 paragraph, 1 heading\. Want me to read it\?$/)
    const spoken = await harness.spoken()
    expect(spoken.filter((text) => text === 'Explore mode on')).toHaveLength(2)
  })

  test('reports the end of a page that has no further page', async () => {
    await page.keyboard.press('Control+Alt+ArrowRight')
    await harness.expectSpoken(/^End of page$/)
  })

  test('leaves the browser history alone when Control+Alt+Arrow is pressed', async () => {
    await page.keyboard.press('Control+Alt+ArrowLeft')
    await page.waitForTimeout(300)
    expect(page.url()).toBe(`${ORIGIN}/2`)
  })
})
