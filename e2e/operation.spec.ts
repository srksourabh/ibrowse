import { expect, test, type Page } from '@playwright/test'
import { launchHarness, ORIGIN, type Harness } from './helpers'

const MAIN = `<!doctype html>
  <title>Operation Test</title>
  <style>
    body { margin: 0; font: 16px sans-serif; }
    nav { position: absolute; left: 20px; top: 40px; }
    h1 { position: absolute; left: 200px; top: 40px; margin: 0; }
    h2 { position: absolute; left: 200px; top: 100px; margin: 0; }
    #f { position: absolute; left: 20px; top: 160px; width: 300px; }
    #f label, #f input, #f button { display: block; margin: 4px 0; }
    #live { position: absolute; left: 20px; top: 460px; }
    #save { position: absolute; left: 20px; top: 500px; }
    #dlg { position: absolute; left: 140px; top: 500px; }
  </style>
  <nav aria-label="Main menu"><a href="/other">Home</a></nav>
  <h1>Welcome</h1>
  <h2>Section</h2>
  <form id="f" onsubmit="return false">
    <label for="email">Email</label><input id="email" type="email" required>
    <label for="pw">Password</label><input id="pw" type="password">
    <label for="sub">Subscribe</label><input id="sub" type="checkbox">
    <button id="submit" type="submit">Submit</button>
  </form>
  <form id="g" action="/done" target="_blank" aria-label="Feedback" style="position:absolute;left:400px;top:300px">
    <button id="send" type="submit">Send</button>
  </form>
  <div id="live" aria-live="polite"></div>
  <button id="save" onclick="document.getElementById('live').textContent='Saved'">Save</button>
  <button id="dlg" onclick="document.body.insertAdjacentHTML('beforeend','<div role=dialog aria-label=&quot;Sign in&quot;><p>Hi</p></div>')">Open</button>
  <iframe src="/frame" style="position:absolute;left:400px;top:150px;width:300px;height:120px;border:0"></iframe>`

const FRAME = `<!doctype html><title>Inner</title>
  <style>body{margin:0} button{position:absolute;left:20px;top:20px;width:150px;height:40px}</style>
  <button>Inside</button>`

const TOUCH = `<!doctype html><title>Touch Test</title>
  <style>
    body { margin: 0; font: 16px sans-serif; }
    #t { position: absolute; left: 100px; top: 100px; width: 200px; height: 60px; }
    #out { position: absolute; left: 100px; top: 300px; }
  </style>
  <button id="t" onclick="document.getElementById('out').textContent='Clicked'">Tap me</button>
  <div id="out" aria-live="polite"></div>`

const WHERE_AM_I = /^Operation Test\. ibrowse\.test\. Secure connection\./

const count = async (harness: Harness, pattern: RegExp): Promise<number> =>
  (await harness.spoken()).filter((text) => pattern.test(text)).length

const lastSpoken = async (harness: Harness): Promise<string | undefined> =>
  (await harness.spoken()).at(-1)

test.describe.serial('operating a page', () => {
  let harness: Harness
  let page: Page

  test.beforeAll(async () => {
    harness = await launchHarness({ '/': MAIN, '/frame': FRAME })
    page = await harness.context.newPage()
    await page.goto(`${ORIGIN}/`)
    await harness.toggleExplore(ORIGIN)
    await harness.expectSpoken(/Want me to read it\?$/)
    await page.keyboard.press('Escape') // decline the read prompt
  })

  test.afterAll(async () => {
    await harness.close()
  })

  test('jumps between headings with Control+Alt+Down and Up', async () => {
    await page.keyboard.press('Control+Alt+ArrowDown')
    await expect.poll(() => lastSpoken(harness)).toBe('Welcome — Heading level 1, Text only')
    await page.keyboard.press('Control+Alt+ArrowDown')
    await expect.poll(() => lastSpoken(harness)).toBe('Section — Heading level 2, Text only')
    await page.keyboard.press('Control+Alt+ArrowUp')
    await expect.poll(() => lastSpoken(harness)).toBe('Welcome — Heading level 1, Text only')
  })

  test('ignores Alt+Shift by default, since it switches the keyboard language on Windows', async () => {
    const before = (await harness.spoken()).length
    await page.keyboard.press('Alt+Shift+ArrowDown')
    await page.waitForTimeout(300)
    expect((await harness.spoken()).length).toBe(before)
  })

  test('jumps to landmarks with Control+Alt+PageUp and PageDown', async () => {
    await page.keyboard.press('Control+Alt+PageUp') // from the first heading back to the navigation
    await expect.poll(() => lastSpoken(harness)).toBe('Main menu — Navigation landmark')
  })

  test('says where the user is with Control+Alt+W', async () => {
    const before = await count(harness, WHERE_AM_I)
    await page.keyboard.press('Control+Alt+W')
    await expect.poll(() => count(harness, WHERE_AM_I)).toBe(before + 1)
  })

  test('reads the status when the pointer reaches the top edge', async () => {
    const before = await count(harness, WHERE_AM_I)
    await page.mouse.move(600, 400)
    await page.mouse.move(600, 2)
    await expect.poll(() => count(harness, WHERE_AM_I)).toBe(before + 1)
    await page.mouse.move(600, 400)
  })

  test('announces a form field when it gains focus, and echoes what is typed', async () => {
    await page.focus('#email')
    await harness.expectSpoken(/^Email — Edit text, empty, required$/)
    await page.keyboard.type('ab@')
    await expect.poll(() => lastSpoken(harness)).toBe('at')
    const spoken = await harness.spoken()
    expect(spoken).toContain('a')
    expect(spoken).toContain('b')
  })

  test('never speaks what is typed into a password field', async () => {
    await page.focus('#pw')
    await harness.expectSpoken(/^Password — Password field, empty$/)
    const before = await harness.spoken()
    await page.keyboard.type('xyz')
    await page.waitForTimeout(300)
    const after = (await harness.spoken()).slice(before.length)
    expect(after).toEqual([])
  })

  test('announces a checkbox changing', async () => {
    await page.focus('#sub')
    await harness.expectSpoken(/^Subscribe — Checkbox, not checked$/)
    await page.keyboard.press('Space')
    await harness.expectSpoken(/^Subscribe: checked$/)
  })

  test('speaks the browser validation message for an invalid field', async () => {
    await page.click('#submit') // the pointer arrives and clicks within a frame
    await harness.expectSpoken(/^Email: .+/)
  })

  test('does not claim a submission the page stopped in its own script', async () => {
    await page.fill('#email', 'a@example.com')
    await page.click('#submit') // valid now, but the form's onsubmit returns false
    await page.waitForTimeout(500)
    expect(await count(harness, /: submitted$/)).toBe(0)
  })

  test('says a form was submitted when the browser sends it', async () => {
    const result = harness.context.waitForEvent('page')
    await page.click('#send')
    await harness.expectSpoken(/^Send: submitted$/)
    await (await result).close()
  })

  test('announces live-region updates and dialogs that open', async () => {
    await page.click('#save')
    await harness.expectSpoken(/^Saved$/)
    await page.click('#dlg')
    await harness.expectSpoken(/^Dialog opened: Sign in$/)
  })

  test('mentions the iframe in the detailed briefing, and Explore Mode on is announced once', async () => {
    await page.keyboard.press('Control+Alt+B')
    await harness.expectSpoken(/1 embedded frame/)
    expect(await count(harness, /^Explore mode on$/)).toBe(1)
  })

  test('reads what is under the pointer inside the iframe', async () => {
    await page.mouse.move(440, 190)
    await harness.expectSpoken(/^Inside — Button, Clickable$/)
  })

  test('carries out a shortcut pressed while focus is inside the iframe', async () => {
    const before = await count(harness, WHERE_AM_I)
    await page.frameLocator('iframe').locator('button').focus()
    await page.keyboard.press('Control+Alt+W')
    await expect.poll(() => count(harness, WHERE_AM_I)).toBe(before + 1)
  })
})

test.describe.serial('touch', () => {
  let harness: Harness
  let page: Page

  test.beforeAll(async () => {
    harness = await launchHarness({ '/': TOUCH }, { hasTouch: true })
    page = await harness.context.newPage()
    await page.goto(`${ORIGIN}/`)
    await harness.toggleExplore(ORIGIN)
    await harness.expectSpoken(/^Explore mode on$/)
  })

  test.afterAll(async () => {
    await harness.close()
  })

  test('a single tap explores: it announces the button without pressing it', async () => {
    await page.touchscreen.tap(200, 130)
    await harness.expectSpoken(/^Tap me — Button, Clickable$/)
    await page.waitForTimeout(700) // longer than the double-tap window
    expect(await count(harness, /^Clicked$/)).toBe(0)
  })

  test('a double tap presses the last item explored', async () => {
    await page.touchscreen.tap(200, 130)
    await page.touchscreen.tap(600, 500) // anywhere
    await harness.expectSpoken(/^Clicked$/)
  })
})
