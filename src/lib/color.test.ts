import { describe, expect, it } from 'vitest'
import { bloomColor, fallbackSpine, inkOn, luminance } from './color'

describe('colour helpers', () => {
  it('measures luminance', () => {
    expect(luminance('#000000')).toBe(0)
    expect(luminance('#ffffff')).toBeCloseTo(1)
  })
  it('picks readable ink', () => {
    expect(inkOn('#f3ecdd')).toBe('#2a1e16')
    expect(inkOn('#2f4058')).toBe('#f6efe0')
  })
  it('derives a stable cloth colour', () => {
    expect(fallbackSpine('Dune')).toBe(fallbackSpine('Dune'))
    expect(fallbackSpine('Dune')).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('bloomColor', () => {
  it('lifts dark spines into bright petals', () => {
    expect(luminance(bloomColor('#1a2238'))).toBeGreaterThan(0.2)
    expect(luminance(bloomColor('#000000'))).toBeGreaterThan(0.2)
  })
  it('returns a valid hex colour', () => {
    expect(bloomColor('#6b3f36')).toMatch(/^#[0-9a-f]{6}$/)
  })
})
