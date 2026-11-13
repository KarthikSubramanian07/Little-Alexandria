import { z } from 'zod'
import { SHELVES } from './types'

export const shelfSchema = z.enum(SHELVES)

/** A real calendar date in 'YYYY-MM-DD' form. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Not a real date')

/** fractional-indexing keys are base62 strings. */
export const positionSchema = z.string().regex(/^[0-9A-Za-z]{1,64}$/)

export const addBookSchema = z.object({
  source: z.enum(['openlibrary', 'google', 'fixture']),
  sourceId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[\w-]+$/),
  shelf: shelfSchema,
  /** The reader's local date, used to stamp started/finished dates. */
  today: isoDateSchema,
})

export const updateEntrySchema = z
  .object({
    shelf: shelfSchema,
    position: positionSchema,
    rating: z.number().int().min(1).max(5).nullable(),
    notes: z.string().max(20000).nullable(),
    startedAt: isoDateSchema.nullable(),
    finishedAt: isoDateSchema.nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update')

export const goalSchema = z.object({ target: z.number().int().min(1).max(1000) })

export const spineColorSchema = z.object({ color: z.string().regex(/^#[0-9a-f]{6}$/) })

export const yearSchema = z.coerce.number().int().min(1900).max(3000)
