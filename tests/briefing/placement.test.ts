import { describe, expect, it } from 'vitest'
import { placementOf, placementPhrase } from '../../src/briefing/placement'

const VIEWPORT = { width: 900, height: 900 }
const rectAt = (cx: number, cy: number) => ({ left: cx - 10, top: cy - 10, width: 20, height: 20 })

describe('placementOf', () => {
  it('splits the viewport into thirds by the centre of the rectangle', () => {
    expect(placementOf(rectAt(100, 100), VIEWPORT)).toEqual({ horizontal: 'left', vertical: 'top' })
    expect(placementOf(rectAt(450, 450), VIEWPORT)).toEqual({
      horizontal: 'center',
      vertical: 'middle',
    })
    expect(placementOf(rectAt(800, 800), VIEWPORT)).toEqual({
      horizontal: 'right',
      vertical: 'bottom',
    })
  })

  it('treats a zero-size viewport as the middle instead of failing', () => {
    expect(placementOf(rectAt(5, 5), { width: 0, height: 0 })).toEqual({
      horizontal: 'center',
      vertical: 'middle',
    })
  })
})

describe('placementPhrase', () => {
  it.each([
    [{ horizontal: 'center', vertical: 'top' }, 'at the top'],
    [{ horizontal: 'left', vertical: 'top' }, 'top left'],
    [{ horizontal: 'right', vertical: 'top' }, 'top right'],
    [{ horizontal: 'left', vertical: 'middle' }, 'on the left'],
    [{ horizontal: 'center', vertical: 'middle' }, 'in the middle'],
    [{ horizontal: 'right', vertical: 'middle' }, 'on the right'],
    [{ horizontal: 'center', vertical: 'bottom' }, 'at the bottom'],
    [{ horizontal: 'left', vertical: 'bottom' }, 'bottom left'],
    [{ horizontal: 'right', vertical: 'bottom' }, 'bottom right'],
  ] as const)('%j is spoken as "%s"', (placement, phrase) => {
    expect(placementPhrase(placement)).toBe(phrase)
  })
})
