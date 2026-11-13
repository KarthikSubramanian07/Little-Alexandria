import { createFileRoute } from '@tanstack/react-router'

// The detail card is drawn by the /library page itself, so the cover can fly
// between the shelf and the card. This route only gives every book its own URL.
export const Route = createFileRoute('/library/$entryId')({
  component: () => null,
})
