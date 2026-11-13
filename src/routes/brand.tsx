import { createFileRoute, notFound } from '@tanstack/react-router'
import { CRAYON } from '../components/art/palette'
import { Flower } from '../components/art/Flower'
import { GoalSun, OvergrownBookcase } from '../components/art/scenes'
import { LogoMark } from '../components/Wordmark'

// Development-only artboards. scripts/brand.mjs screenshots them into the
// social preview image and the app icons, so they always match the real art.
export const Route = createFileRoute('/brand')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: Brand,
})

function Brand() {
  return (
    <div className="flex flex-col items-start gap-10 p-10">
      <div
        id="og"
        className="relative flex h-[630px] w-[1200px] items-center overflow-hidden bg-paper px-24"
      >
        <div className="max-w-[600px]">
          <div className="flex items-center gap-3">
            <LogoMark className="size-12" />
            <span className="font-display text-3xl font-medium tracking-tight">
              Little <span className="italic">Alexandria</span>
            </span>
          </div>
          <p className="mt-10 font-display text-[4.4rem] leading-[0.95] font-medium tracking-[-0.025em]">
            Every great reader deserves a{' '}
            <span className="ink-underline italic">great library</span>.
          </p>
          <p className="mt-8 font-hand text-3xl text-moss">
            shelve it · scribble in it · watch it bloom
          </p>
        </div>
        <div className="absolute top-14 right-20 h-[540px] w-[480px]">
          <OvergrownBookcase />
        </div>
        <div className="absolute top-6 right-8 w-32 opacity-90">
          <GoalSun progress={0.7} size={128} />
        </div>
        <div className="absolute bottom-0 left-16 flex items-end gap-1 opacity-90">
          {[CRAYON.rose, CRAYON.marigold, CRAYON.lilac].map((color, i) => (
            <Flower
              key={color}
              color={color}
              seed={`og-${i}`}
              height={54 + i * 10}
              className="h-20 w-8"
            />
          ))}
        </div>
      </div>
      <div id="icon" className="grid size-[512px] place-items-center rounded-[112px] bg-paper">
        <LogoMark className="size-[360px]" />
      </div>
    </div>
  )
}
