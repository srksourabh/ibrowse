import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'wxt'
import { manifest } from './src/manifest'

/**
 * Reads an API key from the environment, .env.local, or .env when building a
 * private production bundle (EMBED_GEMINI_KEY=1). Public/CI builds omit keys.
 */
function readEmbeddedKey(name: string): string {
  if (process.env.EMBED_GEMINI_KEY !== '1') return ''
  const fromEnv = process.env[name]?.trim()
  if (fromEnv) return fromEnv
  const pattern = new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm')
  for (const file of ['.env.local', '.env']) {
    const full = path.resolve(file)
    if (!existsSync(full)) continue
    const match = pattern.exec(readFileSync(full, 'utf8'))
    const value = match?.[1]?.trim().replace(/^['"]|['"]$/g, '')
    if (value) return value
  }
  return ''
}

export default defineConfig({
  vite: () => ({
    define: {
      __EMBEDDED_GEMINI_KEY__: JSON.stringify(readEmbeddedKey('GEMINI_API_KEY')),
      __EMBEDDED_ANTHROPIC_KEY__: JSON.stringify(readEmbeddedKey('ANTHROPIC_API_KEY')),
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
