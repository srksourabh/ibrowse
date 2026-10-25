import { defineConfig } from 'wxt'
import { manifest } from './src/manifest'

export default defineConfig({
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
