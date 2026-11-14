export interface Env {
  DB: D1Database
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GOOGLE_BOOKS_API_KEY?: string
  /** "1" enables the local guest sign-in. Never set in production. */
  DEV_LOGIN?: string
  /** "fixture" swaps the live catalogues for the bundled offline one. */
  BOOK_SOURCE?: string
}

interface Variables {
  userId: string
}

export type AppEnv = { Bindings: Env; Variables: Variables }
