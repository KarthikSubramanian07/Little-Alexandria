import { CRAYON } from './art/palette'
import { Meadow } from './art/Meadow'

/** The mark: a little arched library window with a sprout, then the name in Fraunces. */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <g filter="url(#la-wobble)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 28 V13 a10 10 0 0 1 20 0 V28 Z" fill="var(--moss)" />
        <path d="M10 28 V14 a6 6 0 0 1 12 0 V28" fill="var(--paper)" />
        <path
          d="M16 27 C 15.6 23, 16.4 21, 16 18"
          stroke={CRAYON.moss}
          strokeWidth="1.8"
          fill="none"
        />
        <path d="M16 21 q -4 -3 -5 0 q 2.5 2.5 5 0" fill={CRAYON.leaf} />
        <path d="M16 19.5 q 3.6 -3.6 5 -0.6 q -2.4 2.6 -5 0.6" fill={CRAYON.leaf} />
        <path d="M4 28 H28" stroke="var(--ink)" strokeWidth="1.8" />
      </g>
    </svg>
  )
}

/** `nameFrom` is the breakpoint where the name appears beside the mark. */
export function Wordmark({ nameFrom = 'sm' }: { nameFrom?: 'sm' | 'lg' }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span
        className={`hidden font-display text-[1.35rem] leading-none font-medium tracking-tight ${nameFrom === 'lg' ? 'lg:inline' : 'sm:inline'}`}
      >
        Little{' '}
        <span className="relative isolate ml-[0.4em] inline-block italic">
          Alexandria
          <Meadow />
        </span>
      </span>
    </span>
  )
}
