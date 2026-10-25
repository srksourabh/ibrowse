import { GEMINI_ORIGIN } from './cloud/permissions'
import { toolbarState } from './shared/toolbar'

/**
 * The extension's permission surface, kept in one place so a test can pin it.
 * Browsers allow at most four suggested shortcuts per extension (ADR-0009), so
 * only the Explore Mode toggle is a global command. Every other shortcut is
 * handled by the content script while Explore Mode is on.
 */
export const manifest = {
  name: 'iBrowse',
  description:
    'Explore and operate any website by touch, mouse and audio. Built for blind users.',
  permissions: ['activeTab', 'contextMenus', 'scripting', 'storage', 'tts'],
  host_permissions: ['<all_urls>'],
  // Asked for only when the user turns on cloud voice or AI. Until granted, nothing can be sent.
  optional_host_permissions: [GEMINI_ORIGIN],
  // The toolbar button switches Explore Mode, like Alt+Shift+E. Each page sets its own state (ADR-0016).
  action: { default_title: toolbarState(false).title },
  commands: {
    'toggle-explore': {
      suggested_key: { default: 'Alt+Shift+E' },
      description: 'Turn Explore Mode on or off',
    },
    'pair-hardware': {
      suggested_key: { default: 'Alt+Shift+P' },
      description: 'Open hardware setup',
    },
    'open-settings': {
      suggested_key: { default: 'Alt+Shift+S' },
      description: 'Open settings',
    },
  },
} as const
