import { motion, useReducedMotion } from 'motion/react'
import { CRAYON, seeded } from './ink'

export type FlowerKind = 'daisy' | 'tulip' | 'sunflower' | 'bluebell' | 'poppy'
const KINDS: FlowerKind[] = ['daisy', 'tulip', 'sunflower', 'bluebell', 'poppy']

interface FlowerProps {
  /** Petal colour. Books pass their spine colour, so each flower matches its book. */
  color: string
  /** Stem height in viewBox units (the flower is drawn in a 60 × 160 box). */
  height?: number
  seed: string
  kind?: FlowerKind
  /** Delay before the flower grows in, for staggered gardens. */
  delay?: number
  className?: string
  title?: string
}

/**
 * One hand-drawn flower. The stem draws itself upward, then the bloom opens.
 * Shapes are deliberately a little lopsided: drawn, not constructed.
 */
export function Flower({ color, height = 110, seed, kind, delay = 0, className, title }: FlowerProps) {
  const reduce = useReducedMotion()
  const rand = seeded(seed)
  const flowerKind = kind ?? KINDS[Math.floor(rand() * KINDS.length)]!
  const sway = (rand() - 0.5) * 14
  const baseY = 158
  const topY = baseY - height
  const topX = 30 + sway
  const stem = `M30 ${baseY} C ${30 - sway * 0.4} ${baseY - height * 0.35}, ${topX + sway * 0.3} ${baseY - height * 0.7}, ${topX} ${topY}`
  const leafY = baseY - height * (0.35 + rand() * 0.2)
  const leafSide = rand() > 0.5 ? 1 : -1

  const grow = reduce
    ? {}
    : {
        initial: { pathLength: 0 },
        animate: { pathLength: 1 },
        transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] as const },
      }
  const bloom = reduce
    ? {}
    : {
        initial: { scale: 0, rotate: -25 },
        animate: { scale: 1, rotate: 0 },
        transition: { type: 'spring' as const, stiffness: 260, damping: 14, delay: delay + 0.7 },
      }

  return (
    <svg viewBox="0 0 60 160" className={className} role={title ? 'img' : undefined} aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <g filter="url(#la-wobble)" strokeLinecap="round" strokeLinejoin="round">
        <motion.path d={stem} fill="none" stroke={CRAYON.moss} strokeWidth="3" {...grow} />
        <motion.path
          d={`M${30 + sway * 0.2} ${leafY} q ${leafSide * 14} -10 ${leafSide * 20} -2 q ${leafSide * -8} 10 ${leafSide * -20} 2 z`}
          fill={CRAYON.leaf}
          stroke={CRAYON.moss}
          strokeWidth="1.6"
          {...(reduce
            ? {}
            : {
                initial: { scale: 0 },
                animate: { scale: 1 },
                transition: { type: 'spring', stiffness: 300, damping: 16, delay: delay + 0.45 },
              })}
          style={{ transformOrigin: `${30 + sway * 0.2}px ${leafY}px` }}
        />
        <motion.g style={{ transformOrigin: `${topX}px ${topY}px` }} {...bloom}>
          <Bloom kind={flowerKind} x={topX} y={topY} color={color} rand={rand} />
        </motion.g>
      </g>
    </svg>
  )
}

function Bloom({
  kind,
  x,
  y,
  color,
  rand,
}: {
  kind: FlowerKind
  x: number
  y: number
  color: string
  rand: () => number
}) {
  const outline = { stroke: CRAYON.ink, strokeWidth: 1.4, strokeOpacity: 0.55 }
  switch (kind) {
    case 'daisy': {
      const petals = 8
      return (
        <g>
          {Array.from({ length: petals }, (_, i) => {
            const angle = (i / petals) * 360 + rand() * 12
            return (
              <ellipse
                key={i}
                cx={x}
                cy={y - 9}
                rx={4.2}
                ry={8.5 + rand() * 1.5}
                fill={color}
                {...outline}
                transform={`rotate(${angle} ${x} ${y})`}
              />
            )
          })}
          <circle cx={x} cy={y} r={5.5} fill={CRAYON.marigold} {...outline} />
        </g>
      )
    }
    case 'tulip':
      return (
        <path
          d={`M${x - 11} ${y - 2} C ${x - 13} ${y - 18}, ${x - 6} ${y - 22}, ${x - 4} ${y - 12} L ${x} ${y - 22} L ${x + 4} ${y - 12} C ${x + 6} ${y - 22}, ${x + 14} ${y - 18}, ${x + 11} ${y - 2} C ${x + 8} ${y + 8}, ${x - 8} ${y + 8}, ${x - 11} ${y - 2} Z`}
          fill={color}
          {...outline}
        />
      )
    case 'sunflower': {
      const petals = 12
      return (
        <g>
          {Array.from({ length: petals }, (_, i) => (
            <path
              key={i}
              d={`M${x} ${y} q -4 -10 0 -17 q 4 7 0 17`}
              fill={color}
              {...outline}
              transform={`rotate(${(i / petals) * 360 + rand() * 8} ${x} ${y})`}
            />
          ))}
          <circle cx={x} cy={y} r={7} fill={CRAYON.soil} {...outline} />
          <circle cx={x - 2} cy={y - 2} r={1.2} fill={CRAYON.ink} opacity={0.5} />
          <circle cx={x + 2.5} cy={y + 1} r={1.2} fill={CRAYON.ink} opacity={0.5} />
        </g>
      )
    }
    case 'bluebell':
      return (
        <g>
          {[-1, 0, 1].map((offset) => (
            <path
              key={offset}
              d={`M${x + offset * 9 - 5} ${y + offset * 6 - 2} q 5 -12 10 0 l 2 4 q -7 4 -14 0 z`}
              fill={color}
              {...outline}
            />
          ))}
        </g>
      )
    case 'poppy':
      return (
        <g>
          {[0, 72, 144, 216, 288].map((angle) => (
            <circle
              key={angle}
              cx={x}
              cy={y - 7}
              r={7.5 + rand() * 1.5}
              fill={color}
              {...outline}
              transform={`rotate(${angle + rand() * 10} ${x} ${y})`}
            />
          ))}
          <circle cx={x} cy={y} r={3.5} fill={CRAYON.ink} opacity={0.8} />
        </g>
      )
  }
}
