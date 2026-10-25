import { chromium, expect, test, type BrowserContext } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const extensionPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../.output/chrome-mv3',
)

const PAGE_URL = 'https://ibrowse.test/'

let context: BrowserContext

test.beforeAll(async () => {
  // Extensions need a persistent context; `channel: 'chromium'` enables the new headless mode.
  context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'ibrowse-')), {
    channel: 'chromium',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  })
  await context.route(`${PAGE_URL}**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<main><p>Hello world</p></main>' }),
  )
})

test.afterAll(async () => {
  await context.close()
})

async function backgroundWorker() {
  return context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
}

test('loads the extension with its background worker', async () => {
  const worker = await backgroundWorker()
  expect(await worker.evaluate(() => chrome.runtime.getManifest().name)).toBe('iBrowse')
})

test('a toggle message reaches the content script on a web page', async () => {
  const page = await context.newPage()
  await page.goto(PAGE_URL)
  const worker = await backgroundWorker()
  const result = await worker.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url: `${url}*` })
    if (tab?.id === undefined) return { delivered: false, error: 'tab not found' }
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'toggle-explore' })
      return { delivered: true, error: null }
    } catch (error) {
      return { delivered: false, error: error instanceof Error ? error.message : String(error) }
    }
  }, PAGE_URL)
  expect(result).toEqual({ delivered: true, error: null })
})

test('the toolbar button shows whether Explore Mode is on in that tab', async () => {
  const page = await context.newPage()
  await page.goto(`${PAGE_URL}toolbar`)
  const worker = await backgroundWorker()
  const toggle = () =>
    worker.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ url: `${url}toolbar` })
      await chrome.tabs.sendMessage(tab!.id!, { type: 'toggle-explore' })
    }, PAGE_URL)
  // The page reports its new state back to the worker, which then updates the button.
  const button = () =>
    worker.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ url: `${url}toolbar` })
      return {
        badge: await chrome.action.getBadgeText({ tabId: tab!.id! }),
        title: await chrome.action.getTitle({ tabId: tab!.id! }),
      }
    }, PAGE_URL)

  await toggle()
  await expect.poll(button).toEqual({ badge: 'ON', title: 'iBrowse: Explore Mode on. Click to turn it off.' })
  await toggle()
  await expect.poll(button).toEqual({ badge: '', title: 'iBrowse: Explore Mode off. Click to turn it on.' })
  await page.close()
})

test('sending to a page with no content script fails, which triggers the inaccessible-page notice', async () => {
  const worker = await backgroundWorker()
  const error = await worker.evaluate(async () => {
    const tab = await chrome.tabs.create({ url: 'chrome://version' })
    try {
      await chrome.tabs.sendMessage(tab.id!, { type: 'toggle-explore' })
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  })
  expect(error).not.toBeNull()
})
