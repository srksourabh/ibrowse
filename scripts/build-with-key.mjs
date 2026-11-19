import { execFileSync } from 'node:child_process'

const env = { ...process.env, EMBED_GEMINI_KEY: '1' }
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

execFileSync(npx, ['wxt', 'build'], { stdio: 'inherit', env, shell: process.platform === 'win32' })
execFileSync(npx, ['wxt', 'zip'], { stdio: 'inherit', env, shell: process.platform === 'win32' })
