import { execFileSync } from 'node:child_process'
import path from 'node:path'

const env = { ...process.env, EMBED_GEMINI_KEY: '1' }
const wxtBin = path.resolve('node_modules', 'wxt', 'bin', 'wxt.mjs')

execFileSync(process.execPath, [wxtBin, 'build'], { stdio: 'inherit', env })
execFileSync(process.execPath, [wxtBin, 'zip'], { stdio: 'inherit', env })
