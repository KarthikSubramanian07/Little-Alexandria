import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Landing } from '../components/Landing'
import { meQuery, useMe } from '../lib/queries'

export const Route = createFileRoute('/')({
  validateSearch: z.object({ error: z.string().optional() }),
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery).catch(() => null),
  component: Home,
})

function Home() {
  const { data: user } = useMe()
  const { error } = Route.useSearch()
  return <Landing user={user ?? null} error={error} />
}
