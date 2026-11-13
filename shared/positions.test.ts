import { describe, expect, it } from 'vitest'
import { comparePositions, frontOf, positionAt } from './positions'

const shelf = (...keys: string[]) => keys.map((position) => ({ position }))

describe('positionAt', () => {
  const others = shelf('a0', 'a1', 'a2')
  it('slots between neighbours', () => {
    const key = positionAt(others, 1)
    expect(comparePositions('a0', key)).toBe(-1)
    expect(comparePositions(key, 'a1')).toBe(-1)
  })
  it('handles both ends and an empty shelf', () => {
    expect(comparePositions(positionAt(others, 0), 'a0')).toBe(-1)
    expect(comparePositions('a2', positionAt(others, 3))).toBe(-1)
    expect(positionAt([], 0)).toBe(frontOf(null))
  })
  it('clamps out-of-range indexes', () => {
    expect(comparePositions('a2', positionAt(others, 99))).toBe(-1)
  })
})
