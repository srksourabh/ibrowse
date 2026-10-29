import type { KeyAction } from './key-router'
import { GEMINI_ORIGIN } from './cloud/permissions'
import { toolbarState } from './shared/toolbar'

/**
 * Page shortcuts also listed as browser commands, with no key of their own, so a
 * person can give any of them a key at chrome://extensions/shortcuts (ADR-0018).
 * Each one acts only while Explore Mode is on.
 */
const PAGE_COMMANDS = {
  'next-heading': { description: 'Go to the next heading' },
  'prev-heading': { description: 'Go to the previous heading' },
  'next-landmark': { description: 'Go to the next landmark' },
  'prev-landmark': { description: 'Go to the previous landmark' },
  'where-am-i': { description: 'Say where I am' },
  'brief-detailed': { description: 'Describe the whole page' },
  'read-from-here': { description: 'Read from here' },
  'next-page': { description: 'Go to the next page' },
  'prev-page': { description: 'Go to the previous page' },
  'describe-this': { description: 'Describe the image with AI' },
  'summarize-page': { description: 'Summarise the page with AI' },
} as const

/**
 * The extension's permission surface, kept in one place so a test can pin it.
 * Browsers allow at most four suggested shortcuts per extension (ADR-0009), and
 * none may hold Ctrl and Alt together, so only the commands that must work while
 * Explore Mode is off have a key. Alt and Shift are avoided because together they
 * switch the keyboard language on Windows (ADR-0018).
 */
export const manifest = {
  name: 'iBrowse',
  description:
    'Explore and operate any website by touch, mouse and audio. Built for blind users.',
  // offscreen: the speech recogniser runs in an offscreen document, the only place it may (ADR-0017 #2).
  permissions: ['contextMenus', 'offscreen', 'storage', 'tts'],
  host_permissions: ['<all_urls>'],
  // Asked for only when the user turns on cloud voice or AI. Until granted, nothing can be sent.
  optional_host_permissions: [GEMINI_ORIGIN],
  // The toolbar button switches Explore Mode, like Alt+I. Each page sets its own state (ADR-0016).
  action: { default_title: toolbarState(false).title },
  commands: {
    'toggle-explore': {
      suggested_key: { default: 'Alt+I' },
      description: 'Turn Explore Mode on or off',
    },
    'open-settings': {
      suggested_key: { default: 'Alt+O' },
      description: 'Open settings',
    },
    'pair-hardware': { description: 'Open hardware setup' },
    ...PAGE_COMMANDS,
  },
} as const

/** The browser commands that run a page shortcut. */
export const PAGE_COMMAND_NAMES = Object.keys(PAGE_COMMANDS) as ReadonlyArray<keyof typeof PAGE_COMMANDS>

/** The page shortcut a browser command stands for, or null for commands the worker handles itself. */
export function commandAction(command: string): KeyAction | null {
  return (PAGE_COMMAND_NAMES as readonly string[]).includes(command) ? (command as KeyAction) : null
}
