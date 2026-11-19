import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'wxt'
import { manifest } from './src/manifest'

/**
 * Reads GEMINI_API_KEY from the environment or .env.local when building a
 * private production bundle (EMBED_GEMINI_KEY=1). Public/CI builds omit it.
 */
function readEmbeddedGeminiKey(): string {
  if (process.env.EMBED_GEMINI_KEY !== '1') return ''
  if (process.env.GEMINI_API_KEY?.trim()) return process.env.GEMINI_API_KEY.trim()
  const envFile = path.resolve('.env.local')
  if (!existsSync(envFile)) return ''
  const match = /^GEMINI_API_KEY\s*=\s*(.+)$/m.exec(readFileSync(envFile, 'utf8'))
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? ''
}

export default defineConfig({
  vite: () => ({
    define: {
      __EMBEDDED_GEMINI_KEY__: JSON.stringify(readEmbeddedGeminiKey()),
    },
  }),
  manifest: {
    name: manifest.name,
    description: manifest.description,
    permissions: [...manifest.permissions],
    host_permissions: [...manifest.host_permissions],
    optional_host_permissions: [...manifest.optional_host_permissions],
    commands: manifest.commands,
    action: manifest.action,
  },
})
