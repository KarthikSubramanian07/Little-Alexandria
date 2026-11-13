import type { QueryClient } from '@tanstack/react-query'
import { Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { InkDefs } from '../components/art/ink'
import { PotWithSprout } from '../components/art/scenes'
import { useTheme } from '../lib/theme'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  notFoundComponent: NotFound,
})

/** The lamp: in the night theme, a faint warm pool of light follows the pointer. */
function useLamp() {
  useEffect(() => {
    let frame = 0
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        document.body.style.setProperty('--lamp-x', `${event.clientX}px`)
        document.body.style.setProperty('--lamp-y', `${event.clientY + window.scrollY}px`)
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])
}

function Root() {
  useLamp()
  const { resolved } = useTheme()
  return (
    <>
      <InkDefs />
      <Outlet />
      <Toaster
        theme={resolved}
        position="bottom-center"
        toastOptions={{
          classNames: {
            toast: '!rounded-2xl !border !border-line !bg-card !text-ink !font-sans !shadow-[0_18px_40px_-16px_rgb(var(--shadow-rgb)/0.5)]',
            actionButton: '!rounded-full !bg-moss !text-on-moss !font-medium',
          },
        }}
      />
    </>
  )
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="size-32">
        <PotWithSprout />
      </div>
      <h1 className="mt-6 font-display text-4xl font-medium">This shelf is empty</h1>
      <p className="mt-3 font-hand text-xl text-ink-soft">The page you were looking for has been checked out, or never existed.</p>
      <Link to="/" className="mt-8 rounded-full bg-moss px-5 py-2.5 font-medium text-on-moss">
        Back to the front desk
      </Link>
    </main>
  )
}
