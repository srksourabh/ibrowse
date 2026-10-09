import { chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ORIGIN = 'https://ibrowse.test'

const extensionPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../.output/chrome-mv3',
)

export interface Harness {
  context: BrowserContext
  worker: Worker
  /** Everything the extension asked the voice to say, in order. */
  spoken(): Promise<string[]>
  /** Waits until something spoken matches. */
  expectSpoken(pattern: RegExp): Promise<void>
  /** Forgets what has been spoken so far. */
  clearSpoken(): Promise<void>
  /** Toggles Explore Mode in the tab showing a page on this origin. */
  toggleExplore(origin: string): Promise<void>
  /** The extension's own id, for opening its pages. */
  extensionId: string
  /** Writes values straight into the extension's storage, as the options would. */
  store(items: Record<string, unknown>): Promise<void>
  /** Reads the saved settings back. */
  storedSettings(): Promise<Record<string, unknown>>
  /** The first-run tour that opened by itself, if `keepTour` was asked for. */
  tourPage: Page | null
  close(): Promise<void>
}

export interface HarnessOptions {
  hasTouch?: boolean
  /** Leave the first-run tour open for the test to use. By default it is waited for, then closed. */
  keepTour?: boolean
}

const TOUR_FIRST_STEP = /^Welcome to iBrowse\. It lets you/

/** Loading the extension is a fresh install, so the tour opens by itself. */
async function findTourPage(context: BrowserContext): Promise<Page> {
  let found: Page | undefined
  await expect
    .poll(() => (found = context.pages().find((p) => p.url().includes('/onboarding.html'))) !== undefined, {
      message: 'the first-run tour did not open',
      timeout: 15_000,
    })
    .toBe(true)
  return found!
}

/**
 * Launches Chromium with the built extension, serves `pages` (path to HTML)
 * under ORIGIN, and records speech in place of a real voice.
 */
export async function launchHarness(
  pages: Record<string, string>,
  options: HarnessOptions = {},
): Promise<Harness> {
  const context = await chromium.launchPersistentContext(
    mkdtempSync(path.join(tmpdir(), 'ibrowse-')),
    {
      channel: 'chromium',
      hasTouch: options.hasTouch ?? false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    },
  )
  await context.route(`${ORIGIN}/**`, (route) => {
    const body = pages[new URL(route.request().url()).pathname]
    return body === undefined
      ? route.fulfill({ status: 404, body: 'not found' })
      : route.fulfill({ contentType: 'text/html', body })
  })

  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
  await worker.evaluate(() => {
    const spoken: string[] = []
    ;(globalThis as unknown as { spoken: string[] }).spoken = spoken
    chrome.tts.speak = ((text: string, options?: { onEvent?: (e: { type: string }) => void }) => {
      spoken.push(text)
      // A real voice says when it starts and when it ends; the delay to "start" is what is measured.
      setTimeout(() => options?.onEvent?.({ type: 'start' }), 2)
      setTimeout(() => options?.onEvent?.({ type: 'end' }), 6)
    }) as typeof chrome.tts.speak
  })

  const spoken = (): Promise<string[]> =>
    worker.evaluate(() => [...(globalThis as unknown as { spoken: string[] }).spoken])
  const harness: Harness = {
    context,
    worker,
    spoken,
    expectSpoken: async (pattern) => {
      try {
        await expect.poll(async () => (await spoken()).some((text) => pattern.test(text))).toBe(true)
      } catch {
        const heard = (await spoken()).map((text) => `  - ${text}`).join('\n')
        throw new Error(`Nothing spoken matched ${pattern}. Spoken so far:\n${heard}`)
      }
    },
    clearSpoken: () =>
      worker.evaluate(() => {
        ;(globalThis as unknown as { spoken: string[] }).spoken.length = 0
      }),
    toggleExplore: (origin) =>
      worker.evaluate(async (url) => {
        const [tab] = await chrome.tabs.query({ url: `${url}/*` })
        await chrome.tabs.sendMessage(tab!.id!, { type: 'toggle-explore' })
      }, origin),
    extensionId: new URL(worker.url()).host,
    store: (items) => worker.evaluate((values) => chrome.storage.local.set(values), items),
    storedSettings: () =>
      worker.evaluate(async () => {
        const { settings } = await chrome.storage.local.get('settings')
        return (settings ?? {}) as Record<string, unknown>
      }),
    tourPage: null,
    close: () => context.close(),
  }

  const tour = await findTourPage(context)
  if (options.keepTour) {
    harness.tourPage = tour
  } else {
    await harness.expectSpoken(TOUR_FIRST_STEP)
    await tour.close()
    await harness.clearSpoken()
  }
  return harness
}
