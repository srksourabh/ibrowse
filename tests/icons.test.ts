import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// WXT adds every public/icon/<size>.png to the manifest. The Web Store needs the 128 px one.
const SIZES = [16, 32, 48, 128]
const PNG_SIGNATURE = '89504e470d0a1a0a'

function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file)
  expect(bytes.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE)
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('extension icons', () => {
  it.each(SIZES)('has a %i px square PNG icon', (size) => {
    const file = path.resolve('public', 'icon', `${size}.png`)
    expect(existsSync(file)).toBe(true)
    expect(pngSize(file)).toEqual({ width: size, height: size })
  })
})
