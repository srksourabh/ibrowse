import { expect, test, type Page } from '@playwright/test'
import { launchHarness, ORIGIN, type Harness } from './helpers'

const HTML = `
  <style>
    body { margin: 0; font: 16px sans-serif; }
    button { position: absolute; left: 100px; top: 100px; width: 200px; height: 60px; }
    p { position: absolute; left: 100px; top: 250px; width: 400px; margin: 0; }
  </style>
  <button>Buy now</button>
  <p>The quick brown fox jumps over the lazy dog.</p>`

let harness: Harness
let page: Page

test.beforeAll(async () => {
  harness = await launchHarness({ '/': HTML })
})

test.afterAll(async () => {
  await harness.close()
})

test.describe.serial('hover exploration', () => {
  test('announces that Explore Mode is on', async () => {
    page = await harness.context.newPage()
    await page.goto(`${ORIGIN}/`)
    await harness.toggleExplore(ORIGIN)
    await harness.expectSpoken(/^Explore mode on$/)
  })

  test('reads a button when the pointer rests on it', async () => {
    await page.mouse.move(150, 120)
    await harness.expectSpoken(/^Buy now — Button, Clickable$/)
  })

  test('offers to read a paragraph', async () => {
    await page.mouse.move(200, 260)
    await harness.expectSpoken(/^Paragraph: The quick brown fox jumps\. Click to read\.$/)
  })

  test('says nothing over empty space', async () => {
    const before = await harness.spoken()
    await page.mouse.move(700, 500)
    await page.waitForTimeout(400)
    expect(await harness.spoken()).toEqual(before)
  })

  test('stays silent once Explore Mode is turned off', async () => {
    await harness.toggleExplore(ORIGIN)
    await harness.expectSpoken(/^Explore mode off$/)
    const before = await harness.spoken()
    await page.mouse.move(150, 120)
    await page.waitForTimeout(400)
    expect(await harness.spoken()).toEqual(before)
  })
})
