// Shared SVG filters for every drawing in the app. Mounted once, referenced by id.
// - la-wobble nudges every line a little, like a hand that isn't a ruler.
// - la-crayon breaks fills into waxy grain, like a child's crayon on paper.

export function InkDefs() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: 'absolute' }} focusable="false">
      <defs>
        <filter id="la-wobble" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="2.6" />
        </filter>
        <filter id="la-crayon" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.4" result="wobbly" />
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="11" result="grain" />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.12"
            result="holes"
          />
          <feComposite in="wobbly" in2="holes" operator="in" />
        </filter>
      </defs>
    </svg>
  )
}
