import { describe, expect, it } from 'vitest'
import { panFromX } from '../../src/audio/pan'

describe('panFromX', () => {
  it('is -1 at the left edge, 0 in the centre and 1 at the right edge', () => {
    expect(panFromX(0, 1000)).toBe(-1)
    expect(panFromX(500, 1000)).toBe(0)
    expect(panFromX(1000, 1000)).toBe(1)
  })

  it('clamps positions outside the viewport', () => {
    expect(panFromX(-50, 1000)).toBe(-1)
    expect(panFromX(2000, 1000)).toBe(1)
  })

  it('returns centre for a zero-width viewport instead of NaN', () => {
    expect(panFromX(10, 0)).toBe(0)
  })
})
