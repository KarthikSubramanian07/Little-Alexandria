import type { Transition } from 'motion/react'

/** A soft, slightly springy settle: books have weight, but they're not rubber. */
export const settle: Transition = { type: 'spring', stiffness: 380, damping: 32, mass: 0.9 }
export const gentle: Transition = { type: 'spring', stiffness: 220, damping: 28 }
export const snappy: Transition = { type: 'spring', stiffness: 600, damping: 30 }
