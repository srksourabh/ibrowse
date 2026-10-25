import { expect, test, type Page } from '@playwright/test'
import { launchHarness, ORIGIN, type Harness } from './helpers'

const PAGE = `<!doctype html><title>Settings Test</title>
  <style>
    body { margin: 0; font: 16px sans-serif; }
    button { position: absolute; left: 100px; top: 100px; width: 200px; height: 60px; }
    p { position: absolute; left: 100px; top: 250px; width: 400px; margin: 0; }
    img { position: absolute; left: 100px; top: 400px; width: 50px; height: 50px; }
  </style>
  <button>Buy now</button>
  <p>The quick brown fox jumps over the lazy dog.</p>
  <img src="data:image/png;base64,iVBORw0KGgo=">`

const GOOD_KEY = 'AIzaSyD-example_key_0123456789abcdef'

test.describe.serial('the first-run tour', () => {
  let harness: Harness
  let tour: Page

  test.beforeAll(async () => {
    harness = await launchHarness({ '/': PAGE }, { keepTour: true })
    tour = harness.tourPage!
    await tour.bringToFront()
  })

  test.afterAll(async () => {
    await harness.close()
  })

  test('opens by itself on a fresh install and speaks the first step', async () => {
    await harness.expectSpoken(/^Welcome to iBrowse\. It lets you explore a web page/)
    await expect(tour.getByRole('heading', { level: 1, name: 'Welcome to iBrowse' })).toBeVisible()
    await expect(tour.locator('#progress')).toHaveText('Step 1 of 10')
  })

  test('moves on with Enter and back with Backspace, speaking each step', async () => {
    await tour.keyboard.press('Enter')
    await harness.expectSpoken(/^To start, open any web page and press Alt, Shift and E/)
    await expect(tour.locator('#progress')).toHaveText('Step 2 of 10')
    await tour.keyboard.press('Backspace')
    await expect(tour.locator('#progress')).toHaveText('Step 1 of 10')
  })

  test('repeats a step with R', async () => {
    await harness.clearSpoken()
    await tour.keyboard.press('r')
    await harness.expectSpoken(/^Welcome to iBrowse\. It lets you/)
  })

  test('is skipped with Escape, which says how to hear it again, and then closes', async () => {
    await tour.keyboard.press('Escape')
    await harness.expectSpoken(/^Tour skipped\. You can hear it again from settings\.$/)
    await tour.waitForEvent('close', { timeout: 10_000 })
  })
})

test.describe.serial('the settings page', () => {
  let harness: Harness
  let page: Page

  test.beforeAll(async () => {
    harness = await launchHarness({ '/': PAGE })
    page = await harness.context.newPage()
    await page.goto(`chrome-extension://${harness.extensionId}/options.html`)
  })

  test.afterAll(async () => {
    await harness.close()
  })

  test('speaks how to use it as soon as it opens', async () => {
    await harness.expectSpoken(/^Settings\. Use Tab to move between them\./)
  })

  test('is built from real headings, labels and controls', async () => {
    await expect(page.getByRole('heading', { level: 1, name: 'iBrowse settings' })).toBeVisible()
    for (const group of ['Speech', 'Exploring', 'Screen reader', 'Haptics', 'Cloud voice and AI']) {
      await expect(page.getByRole('heading', { level: 2, name: group })).toBeVisible()
    }
    await expect(page.getByLabel('Speech rate')).toBeVisible()
    await expect(page.getByLabel('Typing echo')).toBeVisible()
    await expect(page.getByLabel('Short announcements')).toBeVisible()
  })

  test('has no sideways scrolling on a narrow screen', async () => {
    await page.setViewportSize({ width: 320, height: 640 })
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('reads out a setting, its value and what it does when it gets focus', async () => {
    await page.focus('#setting-speechRate')
    await harness.expectSpoken(/^Speech rate: 1\. How fast iBrowse speaks\. One is normal\.$/)
  })

  test('changes a number by keyboard, speaks it, and saves it', async () => {
    await page.fill('#setting-speechRate', '1.5')
    await page.keyboard.press('Tab')
    await harness.expectSpoken(/^Speech rate: 1\.5\.$/)
    await expect.poll(async () => (await harness.storedSettings()).speechRate).toBe(1.5)
  })

  test('changes a switch with the space bar', async () => {
    await page.focus('#setting-shortMode')
    await page.keyboard.press('Space')
    await harness.expectSpoken(/^Short announcements: on\.$/)
    await expect.poll(async () => (await harness.storedSettings()).shortMode).toBe(true)
  })

  test('changes a choice', async () => {
    await page.selectOption('#setting-typingEcho', 'words')
    await harness.expectSpoken(/^Typing echo: Each word\.$/)
    await expect.poll(async () => (await harness.storedSettings()).typingEcho).toBe('words')
  })

  test('refuses a value that is not allowed, says so, and shows what is saved', async () => {
    await page.fill('#setting-speechRate', '99')
    await page.keyboard.press('Tab')
    await harness.expectSpoken(/^That value is not allowed for Speech rate\.$/)
    await expect(page.locator('#setting-speechRate')).toHaveValue('1.5')
    expect((await harness.storedSettings()).speechRate).toBe(1.5)
  })

  test('does not turn on cloud voice at once: it speaks the warning and waits for Allow', async () => {
    await page.selectOption('#setting-cloudVoice', 'reading')
    await harness.expectSpoken(/Cloud voice sends the text it speaks to Google/)
    await expect(page.locator('#consent')).toBeVisible()
    await expect(page.locator('#allow')).toBeFocused()
    expect((await harness.storedSettings()).cloudVoice).not.toBe('reading')
  })

  test('can be cancelled with the keyboard, and then nothing has changed', async () => {
    await page.keyboard.press('Tab')
    await expect(page.locator('#cancel')).toBeFocused()
    await page.keyboard.press('Enter')
    await harness.expectSpoken(/^Cancelled\. Nothing was changed\.$/)
    await expect(page.locator('#consent')).toBeHidden()
    await expect(page.locator('#setting-cloudVoice')).toHaveValue('off')
    expect((await harness.storedSettings()).cloudVoice).not.toBe('reading')
  })

  test('turns on voice commands only after the microphone warning and Allow, then says how to talk', async () => {
    await page.selectOption('#setting-voiceInput', 'chrome')
    await harness.expectSpoken(/Voice commands use the microphone/)
    await expect(page.locator('#allow')).toBeFocused()
    expect((await harness.storedSettings()).voiceInput).not.toBe('chrome')
    await page.keyboard.press('Enter')
    await harness.expectSpoken(
      /^Voice commands: On, with Chrome's speech recognition\. Hold Alt, Shift and V and speak, or answer when iBrowse asks\.$/,
    )
    await expect.poll(async () => (await harness.storedSettings()).voiceInput).toBe('chrome')
  })

  test('warns about AI in terms of page text and images, and waits for Allow too', async () => {
    await page.focus('#setting-aiAssist')
    await page.keyboard.press('Space')
    await harness.expectSpoken(/AI features send page text and images to Google/)
    await expect(page.locator('#consent')).toBeVisible()
    await page.focus('#cancel')
    await page.keyboard.press('Enter')
    await expect(page.locator('#setting-aiAssist')).not.toBeChecked()
    expect((await harness.storedSettings()).aiAssist).toBeFalsy()
  })

  test('refuses text that cannot be a key, without repeating it', async () => {
    await harness.clearSpoken()
    await page.fill('#key', 'not a key!')
    await page.focus('#save-key')
    await page.keyboard.press('Enter')
    await harness.expectSpoken(/does not look like a Google API key/)
    expect((await harness.spoken()).join(' ')).not.toContain('not a key!')
  })

  test('saves a key without ever speaking it, and removes it again', async () => {
    await harness.clearSpoken()
    await page.fill('#key', GOOD_KEY)
    await page.focus('#save-key')
    await page.keyboard.press('Enter')
    await harness.expectSpoken(/^Key saved\./)
    await expect(page.locator('#key-status')).toHaveText('A key is saved.')
    await expect(page.locator('#key')).toHaveValue('')
    expect((await harness.spoken()).join(' ')).not.toContain(GOOD_KEY)

    await page.focus('#remove-key')
    await page.keyboard.press('Enter')
    await harness.expectSpoken(/^Key removed\.$/)
    await expect(page.locator('#key-status')).toHaveText('No key is saved.')
  })

  test('says there is nothing to read out yet when no delays have been measured', async () => {
    await page.focus('#latency')
    await page.keyboard.press('Enter')
    await harness.expectSpoken(/^No measurements yet\./)
  })
})

test.describe.serial('Companion mode: a screen reader does the speaking', () => {
  let harness: Harness
  let page: Page

  test.beforeAll(async () => {
    harness = await launchHarness({ '/': PAGE })
    await harness.store({ settings: { screenReaderMode: 'companion' } })
    page = await harness.context.newPage()
    await page.goto(`${ORIGIN}/`)
    await harness.toggleExplore(ORIGIN)
  })

  test.afterAll(async () => {
    await harness.close()
  })

  test('writes what it would say into a live region the screen reader reads', async () => {
    const region = page.locator('[data-ibrowse-live]')
    await expect(region).toHaveText(/Explore mode on/)
    await expect(region).toHaveAttribute('role', 'status')
    await expect(region).toHaveAttribute('aria-live', 'polite')
  })

  test('does not also speak it itself, so there is one voice', async () => {
    expect(await harness.spoken()).toEqual([])
  })

  test('keeps writing as the user explores', async () => {
    await page.mouse.move(150, 120)
    await expect(page.locator('[data-ibrowse-live]')).toHaveText(/Buy now — Button, Clickable/, {
      timeout: 5000,
    })
    expect(await harness.spoken()).toEqual([])
  })
})

test.describe.serial('AI features', () => {
  test('say they are off, and send nothing, until they are turned on', async () => {
    const harness = await launchHarness({ '/': PAGE })
    try {
      const page = await harness.context.newPage()
      await page.goto(`${ORIGIN}/`)
      await harness.toggleExplore(ORIGIN)
      await harness.expectSpoken(/Want me to read it\?/)
      await page.keyboard.press('Escape')
      await page.keyboard.press('Alt+Shift+M')
      await harness.expectSpoken(/^AI features are off\. Turn them on in settings\.$/)
      await page.keyboard.press('Alt+Shift+D')
      expect((await harness.spoken()).filter((t) => /off\. Turn them on/.test(t))).toHaveLength(2)
    } finally {
      await harness.close()
    }
  })

  test('on, but without a key, ask for one instead of guessing', async () => {
    const harness = await launchHarness({ '/': PAGE })
    try {
      await harness.store({ settings: { aiAssist: true } })
      const page = await harness.context.newPage()
      await page.goto(`${ORIGIN}/`)
      await harness.toggleExplore(ORIGIN)
      await harness.expectSpoken(/Want me to read it\?/)
      await page.keyboard.press('Alt+Shift+M')
      await harness.expectSpoken(/^One moment\.$/)
      await harness.expectSpoken(/^No Google key has been entered\. Add one in settings\.$/)
    } finally {
      await harness.close()
    }
  })

  test('offer to describe an image that has no description, and ask for a key when it is tried', async () => {
    const harness = await launchHarness({ '/': PAGE })
    try {
      await harness.store({ settings: { aiAssist: true } })
      const page = await harness.context.newPage()
      await page.goto(`${ORIGIN}/`)
      await harness.toggleExplore(ORIGIN)
      await harness.expectSpoken(/Want me to read it\?/)
      await page.keyboard.press('Escape')
      await page.mouse.move(120, 420)
      await harness.expectSpoken(/^Image, no description\. Press Alt\+Shift\+D to describe it\.$/)
      await page.keyboard.press('Alt+Shift+D')
      await harness.expectSpoken(/^No Google key has been entered\. Add one in settings\.$/)
    } finally {
      await harness.close()
    }
  })
})

test.describe('cloud voice', () => {
  test('without a key, says why once and reads with the local voice instead of going quiet', async () => {
    const harness = await launchHarness({ '/': PAGE })
    try {
      await harness.store({ settings: { cloudVoice: 'reading' } })
      const page = await harness.context.newPage()
      await page.goto(`${ORIGIN}/`)
      await harness.toggleExplore(ORIGIN)
      await harness.expectSpoken(/Want me to read it\?/)
      await page.keyboard.press('y')
      await harness.expectSpoken(/^No Google key has been entered\. Add one in settings\.$/)
      await harness.expectSpoken(/The quick brown fox jumps over the lazy dog\./)
    } finally {
      await harness.close()
    }
  })
})

test.describe('the delay readout', () => {
  test('reads out real measurements, including how long speech takes to start', async () => {
    test.setTimeout(60_000)
    const harness = await launchHarness({ '/': PAGE })
    try {
      await harness.store({ settings: { latencyReadout: true } })
      const page = await harness.context.newPage()
      await page.goto(`${ORIGIN}/`)
      await harness.toggleExplore(ORIGIN)
      await harness.expectSpoken(/Want me to read it\?/)
      await page.mouse.move(150, 120)
      await harness.expectSpoken(/^Buy now — Button, Clickable$/)
      await page.mouse.move(200, 260)
      await harness.expectSpoken(/^Paragraph: The quick brown fox jumps\./)

      const settings = await harness.context.newPage()
      await settings.goto(`chrome-extension://${harness.extensionId}/options.html`)
      await harness.clearSpoken()
      await expect
        .poll(
          async () => {
            await settings.focus('#latency')
            await settings.keyboard.press('Enter')
            await settings.waitForTimeout(400)
            return (await harness.spoken()).some((t) => /Speech start: typically/.test(t))
          },
          { timeout: 30_000, intervals: [1000] },
        )
        .toBe(true)
      const readout = (await harness.spoken()).find((t) => /Speech start: typically/.test(t))!
      expect(readout).toMatch(/Sound: typically \d+ milliseconds/)
      expect(readout).toMatch(/Stopping speech: typically \d+ milliseconds/)
      expect(readout).toMatch(/within target|Over target/)
    } finally {
      await harness.close()
    }
  })
})
