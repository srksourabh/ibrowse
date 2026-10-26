import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** The tester's Gemini key, from .env.local, which git ignores. */
export function geminiKey(): string {
  const env = readFileSync(path.join(root, '.env.local'), 'utf8')
  const key = /^GEMINI_API_KEY=(.*)$/m.exec(env)?.[1]?.trim()
  if (!key || key === 'your-key-here') throw new Error('No GEMINI_API_KEY in .env.local')
  return key
}

/** Seconds of sound in a WAV file. */
export function seconds(file: string): number {
  const wav = readFileSync(file)
  return wav.readUInt32LE(40) / wav.readUInt16LE(32) / wav.readUInt32LE(24)
}
