// The crayon box for every drawing, and a seeded random source so each drawing
// is unique but never changes between renders.

export const CRAYON = {
  ink: '#3a2a20',
  rose: '#d8676b',
  coral: '#e98a6b',
  marigold: '#e9b44c',
  butter: '#f2d27a',
  sky: '#86abc9',
  lilac: '#a58bc6',
  leaf: '#6f9a5b',
  moss: '#4f7a45',
  soil: '#8a5a3b',
  cream: '#fbf3e1',
} as const

/** A tiny seeded random generator, so every drawing is unique but never changes. */
export function seeded(seed: string | number) {
  let state = typeof seed === 'number' ? seed : [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}
