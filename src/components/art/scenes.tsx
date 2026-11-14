// Little hand-drawn scenes: the empty shelves, the landing garden, the sun.
// Drawn like a child would: wobbly lines, crayon fills, a smile where you'd least expect one.
import { motion, useReducedMotion } from 'motion/react'
import type { Shelf } from '../../../shared/types'
import { Flower } from './Flower'
import { CRAYON } from './palette'

const line = {
  fill: 'none',
  stroke: CRAYON.ink,
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** A clay pot with one brave sprout: nothing planted on this shelf yet. */
export function PotWithSprout() {
  const reduce = useReducedMotion()
  return (
    <svg viewBox="0 0 120 110" className="h-full w-full" aria-hidden>
      <g filter="url(#la-wobble)">
        <path d="M30 62 L90 62 L83 104 L37 104 Z" fill={CRAYON.coral} filter="url(#la-crayon)" />
        <path d="M30 62 L90 62 L83 104 L37 104 Z" {...line} />
        <path d="M26 54 L94 54 L94 64 L26 64 Z" fill={CRAYON.coral} filter="url(#la-crayon)" />
        <path d="M26 54 L94 54 L94 64 L26 64 Z" {...line} />
        <path d="M34 54 q 26 -8 52 0" fill={CRAYON.soil} />
        <motion.g
          style={{ transformOrigin: '60px 52px' }}
          animate={reduce ? undefined : { rotate: [-3, 3, -3] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path d="M60 53 C 59 42, 61 34, 60 24" {...line} stroke={CRAYON.moss} strokeWidth={3} />
          <path d="M60 36 q -14 -10 -20 -2 q 8 8 20 2" {...line} fill={CRAYON.leaf} strokeWidth={1.6} />
          <path d="M60 28 q 13 -12 20 -4 q -8 9 -20 4" {...line} fill={CRAYON.leaf} strokeWidth={1.6} />
        </motion.g>
        <circle cx="50" cy="80" r="1.6" fill={CRAYON.ink} />
        <circle cx="70" cy="80" r="1.6" fill={CRAYON.ink} />
        <path d="M54 87 q 6 5 12 0" {...line} strokeWidth={1.6} />
      </g>
    </svg>
  )
}

/** A watering can mid-pour: a book being read is a book being tended. */
function WateringCan() {
  const reduce = useReducedMotion()
  return (
    <svg viewBox="0 0 140 110" className="h-full w-full" aria-hidden>
      <g filter="url(#la-wobble)">
        <path d="M30 50 L82 50 L78 96 L34 96 Z" fill={CRAYON.sky} filter="url(#la-crayon)" />
        <path d="M30 50 L82 50 L78 96 L34 96 Z" {...line} />
        <path d="M40 50 C 40 30, 72 30, 72 50" {...line} />
        <path d="M80 66 L112 40 L118 46 L84 78" fill={CRAYON.sky} filter="url(#la-crayon)" />
        <path d="M80 66 L112 40 M84 78 L118 46 M110 36 l 12 12" {...line} />
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx={122 + i * 3}
            cy={58}
            r={2.2}
            fill={CRAYON.sky}
            stroke={CRAYON.ink}
            strokeWidth={0.8}
            animate={reduce ? undefined : { cy: [56, 100], opacity: [1, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.45, ease: 'easeIn' }}
          />
        ))}
        <path d="M44 72 q 6 -5 12 0 M60 72 q 6 -5 12 0" {...line} strokeWidth={1.6} />
      </g>
    </svg>
  )
}

/** A bare garden bed with a seed packet: finished books bloom here. */
export function SeedBed() {
  return (
    <svg viewBox="0 0 150 110" className="h-full w-full" aria-hidden>
      <g filter="url(#la-wobble)">
        <path d="M10 92 C 40 80, 110 80, 140 92 L 140 104 L 10 104 Z" fill={CRAYON.soil} filter="url(#la-crayon)" />
        <path d="M10 92 C 40 80, 110 80, 140 92" {...line} />
        <g transform="rotate(-8 76 50)">
          <rect x="56" y="22" width="40" height="54" rx="3" fill={CRAYON.butter} filter="url(#la-crayon)" />
          <rect x="56" y="22" width="40" height="54" rx="3" {...line} />
          <path d="M56 32 L96 32" {...line} strokeWidth={1.4} />
          <circle cx="76" cy="54" r="9" fill={CRAYON.rose} />
          <circle cx="76" cy="54" r="3.5" fill={CRAYON.marigold} />
        </g>
        {[30, 44, 108, 122].map((x, i) => (
          <circle key={x} cx={x} cy={92 - (i % 2) * 2} r="1.8" fill={CRAYON.cream} />
        ))}
      </g>
    </svg>
  )
}

export function EmptyShelfArt({ shelf }: { shelf: Shelf }) {
  if (shelf === 'reading') return <WateringCan />
  if (shelf === 'read') return <SeedBed />
  return <PotWithSprout />
}

/** The sun over the garden. Its glow fills as the yearly goal does. */
export function GoalSun({ progress, size = 160 }: { progress: number; size?: number }) {
  const reduce = useReducedMotion()
  const clamped = Math.max(0, Math.min(1, progress))
  const r = 52
  const circumference = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 160 160" width={size} height={size} aria-hidden>
      <g filter="url(#la-wobble)">
        <motion.g
          style={{ transformOrigin: '80px 80px' }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
        >
          {Array.from({ length: 14 }, (_, i) => {
            const angle = (i / 14) * Math.PI * 2
            const inner = 64
            const outer = i % 2 ? 74 : 79
            return (
              <path
                key={i}
                d={`M${80 + Math.cos(angle) * inner} ${80 + Math.sin(angle) * inner} L ${80 + Math.cos(angle) * outer} ${80 + Math.sin(angle) * outer}`}
                {...line}
                stroke={CRAYON.marigold}
                strokeWidth={3.2}
              />
            )
          })}
        </motion.g>
        <circle cx="80" cy="80" r={r} fill={CRAYON.butter} opacity={0.92} />
        <motion.circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke={CRAYON.marigold}
          strokeWidth={10}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ type: 'spring', stiffness: 50, damping: 16, delay: 0.3 }}
        />
        <circle cx="80" cy="80" r={r} {...line} strokeOpacity={0.5} />
      </g>
    </svg>
  )
}

/** Fireflies for the garden after dark. Pure decoration; skipped for reduced motion. */
export function Fireflies({ count = 14 }: { count?: number }) {
  const reduce = useReducedMotion()
  if (reduce) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden dark:block">
      {Array.from({ length: count }, (_, i) => {
        const left = (i * 37) % 100
        const top = 15 + ((i * 53) % 70)
        return (
          <motion.span
            key={i}
            className="absolute size-1.5 rounded-full bg-[#ffe9a8]"
            style={{ left: `${left}%`, top: `${top}%`, boxShadow: '0 0 12px 4px rgb(255 220 130 / 0.45)' }}
            animate={{ x: [0, 18, -10, 0], y: [0, -14, 8, 0], opacity: [0, 1, 0.4, 0] }}
            transition={{ duration: 6 + (i % 5), repeat: Infinity, delay: i * 0.7, ease: 'easeInOut' }}
          />
        )
      })}
    </div>
  )
}

/** The landing scene: a small bookcase gone gloriously to seed. */
export function OvergrownBookcase() {
  const reduce = useReducedMotion()
  const spines = [
    { x: 46, w: 14, h: 62, c: '#7d4b2a' },
    { x: 61, w: 10, h: 54, c: '#3f5a4a' },
    { x: 72, w: 16, h: 66, c: '#9a3d3d' },
    { x: 89, w: 12, h: 58, c: '#2f4058' },
    { x: 102, w: 9, h: 50, c: '#d9a441' },
    { x: 124, w: 15, h: 64, c: '#5a3f5e' },
    { x: 140, w: 12, h: 56, c: '#4d5a33' },
    { x: 153, w: 14, h: 60, c: '#7a5a2f' },
  ]
  const lower = [
    { x: 46, w: 12, h: 58, c: '#33525a' },
    { x: 59, w: 15, h: 64, c: '#6b3f36' },
    { x: 75, w: 11, h: 52, c: '#a58bc6' },
    { x: 104, w: 14, h: 62, c: '#3f5a4a' },
    { x: 119, w: 10, h: 54, c: '#e98a6b' },
    { x: 130, w: 16, h: 66, c: '#2f4058' },
    { x: 147, w: 12, h: 58, c: '#7d4b2a' },
  ]
  const vine = 'M40 214 C 22 180, 48 160, 30 128 S 40 70, 58 52 S 110 30, 140 40 S 186 66, 182 104'
  return (
    <svg viewBox="0 0 220 240" className="h-full w-full" role="img" aria-labelledby="hero-art-title">
      <title id="hero-art-title">A small bookcase overgrown with flowers and vines</title>
      <g filter="url(#la-wobble)">
        {/* The case */}
        <path d="M38 60 L182 60 L182 222 L38 222 Z" fill="#a36f45" filter="url(#la-crayon)" />
        <path d="M38 60 L182 60 L182 222 L38 222 Z" {...line} />
        <path d="M44 66 L176 66 L176 136 L44 136 Z M44 144 L176 144 L176 214 L44 214 Z" fill="#f3e3c4" />
        <path d="M44 136 L176 136 L176 144 L44 144 Z" fill="#7d5130" />
        {spines.map((s) => (
          <g key={`u${s.x}`}>
            <rect x={s.x} y={136 - s.h} width={s.w} height={s.h} fill={s.c} filter="url(#la-crayon)" />
            <rect x={s.x} y={136 - s.h} width={s.w} height={s.h} {...line} strokeWidth={1.6} />
          </g>
        ))}
        {/* One book leaning, as books do */}
        <g transform="rotate(-14 112 136)">
          <rect x="110" y="80" width="12" height="56" fill="#86abc9" filter="url(#la-crayon)" />
          <rect x="110" y="80" width="12" height="56" {...line} strokeWidth={1.6} />
        </g>
        {lower.map((s) => (
          <g key={`l${s.x}`}>
            <rect x={s.x} y={214 - s.h} width={s.w} height={s.h} fill={s.c} filter="url(#la-crayon)" />
            <rect x={s.x} y={214 - s.h} width={s.w} height={s.h} {...line} strokeWidth={1.6} />
          </g>
        ))}
        <path d="M44 66 L176 66 L176 136 L44 136 Z M44 144 L176 144 L176 214 L44 214 Z" {...line} strokeWidth={1.6} />
        {/* A watering can someone left on the bottom shelf */}
        <path d="M88 214 L88 196 L100 196 L100 214" fill={CRAYON.sky} />
        <path d="M88 214 L88 196 L100 196 L100 214 M100 202 L106 194" {...line} strokeWidth={1.4} />

        {/* The vine */}
        <motion.path
          d={vine}
          {...line}
          stroke={CRAYON.moss}
          strokeWidth={3.2}
          initial={reduce ? undefined : { pathLength: 0 }}
          animate={reduce ? undefined : { pathLength: 1 }}
          transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
        {[
          [30, 150, -30],
          [34, 112, 20],
          [52, 64, -10],
          [92, 38, 30],
          [128, 38, -20],
          [168, 62, 40],
          [182, 96, 70],
        ].map(([x, y, angle], i) => (
          <motion.path
            key={i}
            d={`M${x} ${y} q 10 -9 18 -1 q -8 9 -18 1 z`}
            {...line} fill={CRAYON.leaf}
            strokeWidth={1.4}
            style={{ transformOrigin: `${x}px ${y}px` }}
            transform={`rotate(${angle} ${x} ${y})`}
            initial={reduce ? undefined : { scale: 0 }}
            animate={reduce ? undefined : { scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.5 + i * 0.22 }}
          />
        ))}
      </g>
      {/* Flowers along the top of the case */}
      {[
        { x: 44, h: 46, c: CRAYON.rose, k: 'daisy' as const },
        { x: 70, h: 34, c: CRAYON.marigold, k: 'sunflower' as const },
        { x: 100, h: 52, c: CRAYON.lilac, k: 'bluebell' as const },
        { x: 132, h: 40, c: CRAYON.coral, k: 'tulip' as const },
        { x: 158, h: 30, c: CRAYON.rose, k: 'poppy' as const },
      ].map((f, i) => (
        <foreignObject key={f.x} x={f.x - 15} y={60 - 80} width="30" height="80">
          <Flower color={f.c} height={f.h} seed={`hero-${i}`} kind={f.k} delay={1 + i * 0.18} className="h-full w-full" />
        </foreignObject>
      ))}
    </svg>
  )
}
