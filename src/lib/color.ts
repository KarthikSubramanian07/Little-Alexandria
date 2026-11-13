import { FastAverageColor } from 'fast-average-color'

const sampler = new FastAverageColor()

/** Relative luminance (WCAG) of a #rrggbb colour. */
export function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** Ink that reads well on top of `hex`. */
export const inkOn = (hex: string) => (luminance(hex) > 0.36 ? '#2a1e16' : '#f6efe0')

const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0')

/**
 * The dominant colour of a loaded, same-origin cover, nudged darker and
 * slightly desaturated so spines look like cloth and board rather than neon.
 */
export function sampleSpineColor(image: HTMLImageElement): string | null {
  try {
    const [r, g, b] = sampler.getColor(image, { algorithm: 'dominant', mode: 'precision' }).value
    const grey = (r! + g! + b!) / 3
    const tone = (c: number) => Math.max(0, Math.min(255, (c * 0.82 + grey * 0.18) * 0.86))
    return `#${toHex(tone(r!))}${toHex(tone(g!))}${toHex(tone(b!))}`
  } catch {
    return null
  }
}

/** A stable, pleasant cloth colour for books without a cover, derived from the title. */
export function fallbackSpine(seed: string): string {
  const cloths = ['#6b3f36', '#3f5a4a', '#2f4058', '#7a5a2f', '#5a3f5e', '#4d5a33', '#7d4b2a', '#33525a']
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return cloths[hash % cloths.length]!
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function fromHsl(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return `#${[f(0), f(8), f(4)].map((v) => toHex(v * 255)).join('')}`
}

/**
 * A spine colour lifted into a flower: same hue, but sunlit. Near-greys (black
 * and white covers) borrow a warm rose so no flower ever comes up grey.
 */
export function bloomColor(hex: string): string {
  const [h, s, l] = toHsl(hex)
  if (s < 0.12) return fromHsl((h + 350) % 360, 0.5, 0.66)
  return fromHsl(h, Math.max(0.45, Math.min(0.75, s)), Math.max(0.58, Math.min(0.7, l + 0.25)))
}
