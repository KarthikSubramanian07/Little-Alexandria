// The books on the landing page's own shelves. Real Open Library covers, hand-picked
// so every one is a proper jacket (no blank scans), served through /api/cover like
// everyone's library. Offline builds fall back to the typeset cloth covers.
import type { Book } from '../../../shared/types'

const SHOWCASE: Array<
  [title: string, author: string, coverId: number, cloth: string, pages: number]
> = [
  ['The Hobbit', 'J. R. R. Tolkien', 14627509, '#c4762f', 310],
  ['Circe', 'Madeline Miller', 8739376, '#d08a2c', 393],
  ['Piranesi', 'Susanna Clarke', 10226290, '#2f3b6b', 245],
  ['Jane Eyre', 'Charlotte Brontë', 8235363, '#6b2a2a', 532],
  ['The Name of the Wind', 'Patrick Rothfuss', 11480483, '#2e2a22', 662],
  ['Beloved', 'Toni Morrison', 8261367, '#9a3d2c', 324],
  ['The Secret History', 'Donna Tartt', 744854, '#1f1f1f', 559],
  ['Dune', 'Frank Herbert', 11481354, '#8f4e24', 612],
  ['A Wizard of Earthsea', 'Ursula K. Le Guin', 15255407, '#3e6b74', 183],
  ['Normal People', 'Sally Rooney', 8794265, '#a8b67a', 266],
  ['The Remains of the Day', 'Kazuo Ishiguro', 95742, '#4b5a3a', 245],
  ['Middlemarch', 'George Eliot', 252882, '#5b4a6b', 880],
  ['Frankenstein', 'Mary Shelley', 12356249, '#2d3a2f', 280],
  ['Anna Karenina', 'Leo Tolstoy', 2560652, '#2a2320', 864],
  ['The Song of Achilles', 'Madeline Miller', 7098465, '#2f8fc4', 378],
  ['Station Eleven', 'Emily St. John Mandel', 7369961, '#2b4a6b', 333],
  ['A Little Life', 'Hanya Yanagihara', 12065783, '#3a3a3a', 720],
]

export const SHOWCASE_BOOKS: Book[] = SHOWCASE.map(([title, author, coverId, cloth, pages]) => ({
  id: `showcase:${coverId}`,
  source: 'openlibrary',
  sourceId: String(coverId),
  title,
  subtitle: null,
  authors: [author],
  publishedYear: null,
  pageCount: pages,
  description: null,
  genres: [],
  coverUrl: `/api/cover?src=${encodeURIComponent(`https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`)}`,
  isbn13: null,
  spineColor: cloth,
}))

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** Cream or ink lettering, whichever reads better on a cloth colour. */
export function letteringOn(cloth: string) {
  const l = luminance(cloth)
  const cream = (luminance('#f6ead2') + 0.05) / (l + 0.05)
  const ink = (l + 0.05) / (luminance('#2a1e16') + 0.05)
  return cream >= ink ? '#f6ead2' : '#2a1e16'
}
