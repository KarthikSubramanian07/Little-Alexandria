// The library cat, asleep on top of the bookcase as library cats are. It breathes,
// its tail swings over the edge now and then, and the odd z drifts up.
import { CRAYON } from '../art/palette'

const ink = {
  fill: 'none',
  stroke: CRAYON.ink,
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function SleepingCat({ className }: { className?: string }) {
  return (
    <div aria-hidden className={className}>
      <svg viewBox="0 0 170 130" className="h-full w-full overflow-visible">
        <g filter="url(#la-wobble)">
          {/* the tail, hanging over the front of the crown */}
          <g className="cat-tail">
            <path d="M132 78 C 150 84, 154 104, 146 124" {...ink} strokeWidth={12} />
            <path
              d="M132 78 C 150 84, 154 104, 146 124"
              fill="none"
              stroke={CRAYON.marigold}
              strokeWidth={7.5}
              strokeLinecap="round"
            />
            <path
              d="M148 98 l 6 1 M149 110 l 6 0"
              {...ink}
              strokeWidth={1.8}
              stroke={CRAYON.soil}
            />
          </g>
          <g className="cat-breath">
            {/* the loaf */}
            <path
              d="M30 82 C 26 56, 56 40, 90 42 C 124 44, 146 58, 140 82 Z"
              fill={CRAYON.marigold}
              filter="url(#la-crayon)"
            />
            <path d="M30 82 C 26 56, 56 40, 90 42 C 124 44, 146 58, 140 82" {...ink} />
            {/* stripes */}
            <path
              d="M84 46 q 4 8 0 14 M100 46 q 5 8 1 15 M116 52 q 4 8 0 13"
              {...ink}
              strokeWidth={2}
              stroke={CRAYON.soil}
            />
            {/* a paw tucked in front */}
            <path d="M44 82 C 44 74, 62 72, 66 82" fill={CRAYON.butter} />
            <path d="M44 82 C 44 74, 62 72, 66 82" {...ink} strokeWidth={2} />
          </g>
          {/* the head, resting on its paws */}
          <g>
            <path d="M20 60 L 22 38 L 36 50 Z" fill={CRAYON.marigold} />
            <path d="M48 50 L 60 36 L 60 58 Z" fill={CRAYON.marigold} />
            <path d="M20 60 L 22 38 L 36 50 M48 50 L 60 36 L 60 58" {...ink} />
            <path d="M24 46 L 26 42 L 30 47" fill={CRAYON.rose} />
            <ellipse
              cx="40"
              cy="64"
              rx="24"
              ry="19"
              fill={CRAYON.marigold}
              filter="url(#la-crayon)"
            />
            <ellipse cx="40" cy="64" rx="24" ry="19" {...ink} />
            {/* closed eyes, nose, whiskers */}
            <path d="M28 62 q 4 3 8 0 M44 62 q 4 3 8 0" {...ink} strokeWidth={2} />
            <path d="M38 68 l 2 2 l 2 -2" {...ink} strokeWidth={1.8} stroke={CRAYON.rose} />
            <path
              d="M24 70 l -12 -1 M24 73 l -11 3 M56 70 l 12 -1 M56 73 l 11 3"
              {...ink}
              strokeWidth={1.4}
            />
            <circle cx="26" cy="70" r="3" fill={CRAYON.rose} opacity="0.35" />
            <circle cx="54" cy="70" r="3" fill={CRAYON.rose} opacity="0.35" />
          </g>
        </g>
        {/* zzz */}
        <g className="font-hand" fill="currentColor" fontSize="16">
          <text x="66" y="34" className="cat-z" style={{ animationDelay: '0s' }}>
            z
          </text>
          <text x="74" y="26" className="cat-z" fontSize="20" style={{ animationDelay: '1.3s' }}>
            z
          </text>
          <text x="84" y="16" className="cat-z" fontSize="24" style={{ animationDelay: '2.6s' }}>
            z
          </text>
        </g>
      </svg>
    </div>
  )
}
