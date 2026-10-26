import { expect, test } from '@playwright/test'
import { build } from 'esbuild'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// PRD §9.4: accessible names are checked against the Web Platform Tests for
// accname, in real Chromium, through the same `describeElement` the hover uses.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURES = path.join(root, 'tests', 'fixtures', 'wpt-accname')

/** Speech collapses every run of spaces, non-breaking ones included; the ear cannot tell the difference. */
const spoken = (text: string): string => text.replace(/\s+/g, ' ').trim()

// Why iBrowse differs from the standard today. Every difference sits in dom-accessibility-api 0.7.1.
const CSS = 'CSS generated content (::before, ::after, counters) is not read'
const TRANSFORM = 'text-transform is ignored, which makes no difference to speech'
const NESTED_SPACE = 'a space inside nested elements is lost, joining two words'
const COMBOBOX = 'the value of a combobox inside a label is left out'
const HIDDEN_REF = 'a hidden aria-labelledby target does not win over aria-label'
const VISIBILITY = 'visibility set inside a referenced or hidden subtree is mishandled'

/** Known differences by file and WPT test name. A difference that gets fixed must leave this list. */
const KNOWN: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'comp_embedded_control.html': {
    'checkbox label with embedded combobox (span)': COMBOBOX,
    'checkbox label with embedded combobox (div)': COMBOBOX,
  },
  'comp_hidden_not_referenced.html': {
    'link labelled by elements with assorted visibility and a11y tree exposure': VISIBILITY,
    'heading with name from content, containing element that is visibility:hidden with nested content that is visibility:visible': VISIBILITY,
  },
  'comp_label.html': {
    "button's hidden referenced name (display:none) supercedes aria-label": HIDDEN_REF,
    "button's hidden referenced name (visibility:hidden) supercedes aria-label": HIDDEN_REF,
    "button's hidden referenced name (visibility:hidden) with hidden aria-labelledby traversal falls back to aria-label": HIDDEN_REF,
  },
  'comp_labelledby_hidden_nodes.html': {
    'button with aria-labelledby using visibility:hidden span (with nested span)': VISIBILITY,
    'button with aria-labelledby using visibility:hidden span (with nested spans, depth 2)': VISIBILITY,
    'button with aria-labelledby using visibility:hidden hidden span (with nested sibling spans)': VISIBILITY,
    'button with aria-labelledby using span without visibility:collapse (with nested visibility:collapse sibling spans)': VISIBILITY,
  },
  'comp_name_from_content.html': {
    'button with alt counter on ::before': CSS,
    'heading with alt counter on ::before': CSS,
    'link with alt counter on ::before': CSS,
    'button with multiple alt counters and counter increments': CSS,
    'heading with multiple alt counters and counter increments': CSS,
    'link with multiple alt counters and counter increments': CSS,
    'button name from content with ::before': CSS,
    'heading name from content with ::before': CSS,
    'link name from content with ::before': CSS,
    'button name from content with ::after': CSS,
    'heading name from content with ::after': CSS,
    'link name from content with ::after': CSS,
    'button name from content with ::before and ::after': CSS,
    'heading name from content with ::before and ::after': CSS,
    'link name from content with ::before and ::after': CSS,
    'button name from content no space joiners ::before and ::after': CSS,
    'heading name from content no space joiners ::before and ::after': CSS,
    'link name from content no space joiners ::before and ::after': CSS,
    'button name from content with ::before and ::after in rtl': CSS,
    'heading name from content with ::before and ::after in rtl': CSS,
    'link name from content with ::before and ::after in rtl': CSS,
    'button name from fallback content with ::before and ::after': CSS,
    'heading name from fallback content with ::before and ::after': CSS,
    'link name from fallback content with ::before and ::after': CSS,
    'button name from fallback content mixing attr() and strings with ::before and ::after': CSS,
    'heading name from fallback content mixing attr() and strings with ::before and ::after': CSS,
    'link name from fallback content mixing attr() and strings with ::before and ::after': CSS,
    'heading name from content with text-transform:uppercase': TRANSFORM,
    'heading name from content with text-transform:capitalize': TRANSFORM,
    'heading name from content with text-transform:lowercase': TRANSFORM,
  },
  'comp_text_node.html': {
    'span[role=button] with text node, with deeply nested space': NESTED_SPACE,
    'div[role=heading] with text node, with deeply nested space': NESTED_SPACE,
    'button with text node, with deeply nested space': NESTED_SPACE,
    'heading with text node, with deeply nested space': NESTED_SPACE,
    'link with text node, with deeply nested space': NESTED_SPACE,
  },
}

const knownReason = (file: string, name: string): string | undefined => KNOWN[file]?.[name]

interface Case {
  readonly name: string
  readonly want: string
  readonly got: string
}

async function describeBundle(): Promise<string> {
  const result = await build({
    stdin: {
      contents:
        "import { describeElement } from './src/hover/describe';" +
        '(globalThis as unknown as { label: (el: Element) => string }).label = (el) => describeElement(el).label',
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    format: 'iife',
    write: false,
  })
  return result.outputFiles[0]!.text
}

const files = readdirSync(FIXTURES).filter((name) => name.endsWith('.html'))

test.describe('accessible names match the WPT accname tests', () => {
  let bundle: string
  test.beforeAll(async () => {
    bundle = await describeBundle()
  })

  for (const file of files) {
    test(file, async ({ page }) => {
      // The WPT scripts need its test runner; only the markup and styles are used.
      const html = readFileSync(path.join(FIXTURES, file), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '')
      await page.setContent(html)
      await page.addScriptTag({ content: bundle })
      const cases: Case[] = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-expectedlabel]')).map((el) => ({
          name: el.getAttribute('data-testname') ?? el.outerHTML.slice(0, 80),
          want: el.getAttribute('data-expectedlabel') ?? '',
          got: (globalThis as unknown as { label: (el: Element) => string }).label(el),
        })),
      )
      expect(cases.length).toBeGreaterThan(0)
      const wrong = cases.filter(
        (c) => spoken(c.got) !== spoken(c.want) && knownReason(file, c.name) === undefined,
      )
      const fixed = cases.filter((c) => spoken(c.got) === spoken(c.want) && knownReason(file, c.name) !== undefined)
      expect(wrong.map((c) => `${c.name}: wanted "${c.want}", got "${c.got}"`)).toEqual([])
      expect(fixed.map((c) => `${c.name} now passes; take it off the known list`)).toEqual([])
    })
  }
})
