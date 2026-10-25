import { test, type Page } from '@playwright/test'
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
  <main><h1>Tomatoes</h1><p>Easy to grow in sun.</p><p>Water often.</p><button>Add to basket</button></main>
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
