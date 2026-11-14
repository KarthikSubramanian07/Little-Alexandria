import { z } from 'zod'
import { SHELVES } from './types'

const shelfSchema = z.enum(SHELVES)

/** A real calendar date in 'YYYY-MM-DD' form. */
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Not a real date')

/** fractional-indexing keys are base62 strings. */
const positionSchema = z.string().regex(/^[0-9A-Za-z]{1,64}$/)

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

/** A public address: 3–30 lowercase letters, digits, and inner hyphens. */
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/, 'Use 3–30 letters, numbers, or hyphens')

export const profileSchema = z
  .object({ handle: handleSchema, isPublic: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update')

const importRowSchema = z.object({
  title: z.string().trim().min(1).max(300),
  author: z.string().trim().max(200).nullable(),
  isbn: z
    .string()
    .regex(/^(\d{9}[\dX]|\d{13})$/)
    .nullable(),
  shelf: shelfSchema,
  rating: z.number().int().min(1).max(5).nullable(),
  finishedAt: isoDateSchema.nullable(),
  finishedYear: z.number().int().min(1900).max(3000).nullable(),
  notes: z.string().max(20000).nullable(),
  genreHint: z.string().max(40).nullable(),
})

/** Small batches keep each request well inside the Workers subrequest budget. */
export const IMPORT_BATCH_SIZE = 6
export const importBatchSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(IMPORT_BATCH_SIZE),
  today: isoDateSchema,
})
