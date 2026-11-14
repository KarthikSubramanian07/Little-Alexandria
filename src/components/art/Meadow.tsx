// A comic-book meadow under a word: rows of classic cartoon grass tufts with
// bold outlines, and see-through flowers on thin stems peeking up behind the
// letters. A gust of wind rolls across it from left to right, forever. It sits
// behind the text, so the word itself is never covered.
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

/** The same little generator the design was drawn with, so the meadow matches it. */
function lcg(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

const f = (value: number) => value.toFixed(1)
const OUTLINE = '#1f3a14'
const TUFT_GREENS = ['#5cc93b', '#4fb832', '#6ad448', '#47a92c']
const BACK_GREEN = '#3a9a2a'
const FLOWERS: [petal: string, heart: string][] = [
  ['#ff5c8a', '#ffd23a'],
  ['#ffffff', '#ffb300'],
  ['#5b7cff', '#ffe14d'],
  ['#ff8a2a', '#7a3b12'],
  ['#b56cff', '#ffe14d'],
  ['#ff4a3a', '#2a1426'],
]
/** How long a gust takes to cross the word, in seconds. */
const GUST = 1.8

/** A cartoon tuft: a few pointed blades from one base. */
function tuftPath(x: number, base: number, width: number, height: number, rand: () => number) {
  const n = 3 + Math.floor(rand() * 3)
  const half = width / 2
  let d = `M${f(x - half)} ${f(base)}`
  for (let k = 0; k < n; k++) {
    const t0 = k / n,
      t1 = (k + 1) / n,
      tm = (t0 + t1) / 2
    const tipH = height * (0.55 + rand() * 0.45) * (k === Math.floor(n / 2) ? 1.15 : 1)
    const lean = (rand() - 0.4) * width * 0.35
    const tipX = x - half + width * tm + lean,
      tipY = base - tipH
    const leftX = x - half + width * t0,
      rightX = x - half + width * t1
    const valleyY = base - height * (0.12 + rand() * 0.12)
    if (k > 0) d += ` L${f(leftX)} ${f(valleyY)}`
    d += ` Q ${f(leftX + (tipX - leftX) * 0.35)} ${f(base - tipH * 0.55)}, ${f(tipX)} ${f(tipY)}`
    d += ` Q ${f(rightX - (rightX - tipX) * 0.25)} ${f(base - tipH * 0.5)}, ${f(rightX)} ${f(k === n - 1 ? base : valleyY)}`
  }
  return `${d}Z`
}

interface Petal {
  cx: number
  cy: number
  rx: number
  ry: number
  rotate: number
}
interface Flower {
  x: number
  top: number
  stem: string
  r: number
  phase: number
  sway: number
  delay: number
  petals: Petal[]
  colour: string
  heart: string
}
interface Tuft {
  d: string
  fill: string
  delay: number
  phase: number
  sway: number
  shine: string | null
}

/** Grow the whole meadow for a word box of w × h pixels. */
function growMeadow(w: number, h: number) {
  const rand = lcg(31)
  const base = h * 1.24,
    x0 = -w * 0.04,
    x1 = w * 1.04
  const across = (x: number) => (x - x0) / (x1 - x0)
  const phase = (x: number) => -across(x) * GUST

  const flowers: Flower[] = []
  const count = 8
  for (let i = 0; i < count; i++) {
    const x = x0 + (x1 - x0) * ((i + 0.25 + rand() * 0.5) / count)
    const top = h * (0.12 + rand() * 0.42)
    const r = h * (0.12 + rand() * 0.06)
    const lean = (rand() - 0.5) * h * 0.2
    const sway = 10 + rand() * 4
    const [colour, heart] = FLOWERS[i % FLOWERS.length]!
    const petals: Petal[] = []
    const offset = rand() * 360
    const n = 5 + (i % 2)
    for (let p = 0; p < n; p++) {
      const turn = offset + (p * 360) / n
      const a = (turn * Math.PI) / 180
      const pr = r * (0.5 + rand() * 0.12)
      petals.push({
        cx: Math.cos(a) * r * 0.62,
        cy: Math.sin(a) * r * 0.62,
        rx: pr,
        ry: pr * 0.82,
        rotate: turn,
      })
    }
    flowers.push({
      x: x + lean,
      top,
      r,
      sway,
      colour,
      heart,
      petals,
      stem: `M${f(x)} ${f(base)} Q ${f(x + lean * 0.2)} ${f((base + top) / 2)}, ${f(x + lean)} ${f(top)}`,
      phase: phase(x),
      delay: 0.5 + i * 0.12,
    })
  }

  // A darker back row, then the bright front row with a little shine on each tuft.
  const tufts: Tuft[] = []
  const rows: [row: number, count: number, height: number, shade: string | null][] = [
    [0, 15, 0.2, BACK_GREEN],
    [1, 19, 0.16, null],
  ]
  for (const [row, n, tall, shade] of rows) {
    for (let i = 0; i < n; i++) {
      const x = x0 + ((x1 - x0) * (i + 0.5 + (rand() - 0.5) * 0.6)) / n
      const width = h * (0.42 + rand() * 0.2)
      const height = h * tall * (0.8 + rand() * 0.5)
      const fill = shade ?? TUFT_GREENS[Math.floor(rand() * TUFT_GREENS.length)]!
      const d = tuftPath(x, base + h * 0.02, width, height, rand)
      tufts.push({
        d,
        fill,
        delay: 0.05 + across(x) * 0.8 + row * 0.1,
        phase: phase(x) - rand() * 0.2,
        sway: 2.5 + rand() * 2.5,
        shine: row
          ? `M${f(x - width * 0.12)} ${f(base - height * 0.15)} q ${f(width * 0.04)} ${f(-height * 0.25)} ${f(width * 0.1)} ${f(-height * 0.4)}`
          : null,
      })
    }
  }
  return { flowers, tufts }
}

const vars = (values: Record<string, string>) => values as CSSProperties

/**
 * Plants a meadow under its parent, which must be `position: relative` and
 * `isolation: isolate`, so the meadow can sit behind the text.
 */
export function Meadow() {
  const anchor = useRef<SVGSVGElement>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const word = anchor.current?.parentElement
    if (!word) return
    const measure = () => {
      const { offsetWidth: w, offsetHeight: h } = word
      setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(word)
    return () => observer.disconnect()
  }, [])

  const meadow = useMemo(() => (box && box.w > 0 ? growMeadow(box.w, box.h) : null), [box])
  const h = box?.h ?? 0
  const m = h
  const width = (box?.w ?? 0) + 2 * m
  const height = h + 2 * m

  return (
    <svg
      ref={anchor}
      aria-hidden
      focusable="false"
      className="pointer-events-none overflow-visible"
      width={width}
      height={height}
      viewBox={`0 0 ${f(width)} ${f(height)}`}
      style={{ position: 'absolute', left: -m, top: -m, zIndex: -1 }}
    >
      {meadow && (
        <g transform={`translate(${f(m)} ${f(m)})`}>
          {meadow.flowers.map((flower, i) => (
            <g
              key={`f${i}`}
              className="meadow-stalk"
              style={vars({
                '--meadow-phase': `${flower.phase.toFixed(2)}s`,
                '--meadow-sway': `${flower.sway.toFixed(1)}deg`,
              })}
            >
              <path
                className="meadow-stem"
                pathLength={1}
                d={flower.stem}
                fill="none"
                stroke="#3f9a2c"
                strokeOpacity={0.8}
                strokeWidth={h * 0.035}
                strokeLinecap="round"
                style={vars({ '--meadow-delay': `${flower.delay.toFixed(2)}s` })}
              />
              <g transform={`translate(${f(flower.x)} ${f(flower.top)})`}>
                <g
                  className="meadow-bloom"
                  style={vars({ '--meadow-delay': `${(flower.delay + 0.7).toFixed(2)}s` })}
                >
                  <g
                    className="meadow-head"
                    style={vars({ '--meadow-phase': `${(flower.phase - 0.3).toFixed(2)}s` })}
                  >
                    {flower.petals.map((p, j) => (
                      <ellipse
                        key={j}
                        cx={f(p.cx)}
                        cy={f(p.cy)}
                        rx={f(p.rx)}
                        ry={f(p.ry)}
                        transform={`rotate(${f(p.rotate)} ${f(p.cx)} ${f(p.cy)})`}
                        fill={flower.colour}
                        fillOpacity={0.55}
                        stroke={OUTLINE}
                        strokeOpacity={0.75}
                        strokeWidth={flower.r * 0.09}
                      />
                    ))}
                    <circle
                      r={flower.r * 0.36}
                      fill={flower.heart}
                      fillOpacity={0.85}
                      stroke={OUTLINE}
                      strokeOpacity={0.75}
                      strokeWidth={flower.r * 0.09}
                    />
                    <circle
                      cx={-flower.r * 0.1}
                      cy={-flower.r * 0.12}
                      r={flower.r * 0.1}
                      fill="#fff"
                      fillOpacity={0.7}
                    />
                  </g>
                </g>
              </g>
            </g>
          ))}
          {meadow.tufts.map((tuft, i) => (
            <g
              key={`t${i}`}
              className="meadow-tuft"
              style={vars({
                '--meadow-delay': `${tuft.delay.toFixed(2)}s`,
                '--meadow-phase': `${tuft.phase.toFixed(2)}s`,
                '--meadow-sway': `${tuft.sway.toFixed(1)}deg`,
              })}
            >
              <path
                d={tuft.d}
                fill={tuft.fill}
                stroke={OUTLINE}
                strokeWidth={h * 0.03}
                strokeLinejoin="round"
              />
              {tuft.shine && (
                <path
                  d={tuft.shine}
                  stroke="#b8f08a"
                  strokeWidth={h * 0.02}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.8}
                />
              )}
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}
