import { expect, test, type Page } from '@playwright/test'
import { launchHarness, ORIGIN, type Harness } from './helpers'

const PAGE = `<!doctype html><title>Haptics</title>
  <style>button { position: absolute; left: 100px; top: 100px; width: 200px; height: 60px; }</style>
  <button>Buy now</button>`

const PROFILE = {
  schema: 1,
  id: 'example-mouse',
  name: 'Example Mouse',
  match: { vendorId: 4660, productId: 22136 },
  reportId: 1,
  events: { boundary: [1, 2, 3] },
}

test.describe.serial('hardware setup page', () => {
  let harness: Harness
  let page: Page

  test.beforeAll(async () => {
    harness = await launchHarness({ '/': PAGE })
    page = await harness.context.newPage()
    await page.goto(`chrome-extension://${harness.extensionId}/pair.html`)
  })

  test.afterAll(async () => {
    await harness.close()
  })

  test('speaks the options as soon as it opens', async () => {
    await harness.expectSpoken(/^Hardware setup\. Choose how iBrowse gives touch feedback/)
  })

  test('is built from real headings and buttons, so any assistive technology can use it', async () => {
    await expect(page.getByRole('heading', { level: 1, name: 'iBrowse hardware setup' })).toBeVisible()
    for (const name of ['Sound only', 'Sound simulator', 'Game controller', 'Pair a device']) {
      await expect(page.getByRole('button', { name })).toBeVisible()
    }
    await expect(page.getByRole('status')).toBeAttached()
  })

  test('has no sideways scrolling on a narrow screen', async () => {
    await page.setViewportSize({ width: 320, height: 640 })
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('chooses the sound simulator with the keyboard alone, and says so', async () => {
    await page.focus('#choose-simulator')
    await page.keyboard.press('Enter')
    await harness.expectSpoken(/^Sound simulator selected/)
    await expect.poll(async () => (await harness.storedSettings()).hapticDriver).toBe('simulator')
  })

  test('chooses sound only with the keyboard alone', async () => {
    await page.focus('#choose-none')
    await page.keyboard.press('Enter')
    await harness.expectSpoken(/^Sound only\. No haptic device will be used\./)
    await expect.poll(async () => (await harness.storedSettings()).hapticDriver).toBe('none')
  })

  test('says there is nothing to feel when sound only is selected', async () => {
    await page.focus('#test')
    await page.keyboard.press('Enter')
    await harness.expectSpoken(/nothing to feel/i)
  })

  test('says when pasted text is not JSON', async () => {
    await page.fill('#profile-json', '{nope')
    await page.focus('#import')
    await page.keyboard.press('Enter')
    await harness.expectSpoken(/not valid JSON/i)
  })

  test('imports a device profile and offers it for pairing', async () => {
    await page.fill('#profile-json', JSON.stringify(PROFILE))
    await page.focus('#import')
    await page.keyboard.press('Enter')
    await harness.expectSpoken(/^Imported Example Mouse\.$/)
    await expect(page.locator('#profile option')).toHaveText(['Example Mouse'])
  })

  test('plays the test pattern, naming each effect, once a driver is chosen', async () => {
    await page.focus('#choose-simulator')
    await page.keyboard.press('Enter')
    await page.focus('#test')
    await page.keyboard.press('Enter')
    await harness.expectSpoken(/^Playing a test pattern\.$/)
    await harness.expectSpoken(/^Over a button or link$/)
  })
})

test.describe.serial('a haptic device is chosen but not paired', () => {
  let harness: Harness
  let page: Page

  test.beforeAll(async () => {
    harness = await launchHarness({ '/': PAGE })
    await harness.store({ settings: { hapticDriver: 'webhid', hapticProfileId: '' } })
    page = await harness.context.newPage()
    await page.goto(`${ORIGIN}/`)
  })

  test.afterAll(async () => {
    await harness.close()
  })

  test('stays completely quiet while Explore Mode is off', async () => {
    await page.waitForTimeout(1000)
    expect(await harness.spoken()).toEqual([])
  })

  test('says what is wrong, once, when Explore Mode turns on', async () => {
    await harness.toggleExplore(ORIGIN)
    await harness.expectSpoken(/^No haptic device has been paired\. Press Alt\+Shift\+P to open hardware setup\.$/)
    await page.waitForTimeout(600)
    const spoken = await harness.spoken()
    expect(spoken.filter((t) => /No haptic device/.test(t))).toHaveLength(1)
  })

  test('carries on with sound: hovering still announces', async () => {
    await page.mouse.move(150, 120)
    await harness.expectSpoken(/^Buy now — Button, Clickable$/)
  })
})

test.describe('a profile is saved but no device has been granted', () => {
  test('asks the real WebHID API and explains that nothing is paired', async () => {
    const harness = await launchHarness({ '/': PAGE })
    try {
      await harness.store({
        settings: { hapticDriver: 'webhid', hapticProfileId: 'example-mouse' },
        hapticProfiles: [PROFILE],
      })
      const page = await harness.context.newPage()
      await page.goto(`${ORIGIN}/`)
      await harness.toggleExplore(ORIGIN)
      await harness.expectSpoken(/^No paired Example Mouse found\. Press Alt\+Shift\+P to open hardware setup\.$/)
    } finally {
      await harness.close()
    }
  })
})
