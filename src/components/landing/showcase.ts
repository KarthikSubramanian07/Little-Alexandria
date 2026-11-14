// The books on the landing page's own shelves. Real Open Library covers, hand-picked
// so every one is a proper jacket (no blank scans), served through /api/cover like
// everyone's library. Offline builds fall back to the typeset cloth covers.
import type { Book } from '../../../shared/types'

type Jacket = [title: string, author: string, coverId: number, cloth: string, pages: number]

const SHOWCASE: Jacket[] = [
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

// The new-arrivals cart under the bookcase: none of these are on the shelves
// above it, so the page shows two dozen more books, not the same ones twice.
const NEW_ARRIVALS: Jacket[] = [
  ['The Night Circus', 'Erin Morgenstern', 8773134, '#1c1c1c', 512],
  ['Klara and the Sun', 'Kazuo Ishiguro', 10648686, '#ac3f27', 334],
  ['The Great Gatsby', 'F. Scott Fitzgerald', 10502606, '#1f4f7a', 185],
  ['Little Women', 'Louisa May Alcott', 8775559, '#a83a2a', 422],
  ['Project Hail Mary', 'Andy Weir', 11200092, '#22201d', 496],
  ['The Bell Jar', 'Sylvia Plath', 8477115, '#d9d4c4', 262],
  ['Babel', 'R. F. Kuang', 13154506, '#3a3a3a', 577],
  ['Lessons in Chemistry', 'Bonnie Garmus', 12725772, '#e8875a', 464],
  ['The Left Hand of Darkness', 'Ursula K. Le Guin', 10618463, '#2f6f8f', 304],
  ['Rebecca', 'Daphne du Maurier', 8767961, '#b0201c', 386],
  ['Tomorrow, and Tomorrow, and Tomorrow', 'Gabrielle Zevin', 12859975, '#2c5c8a', 460],
  ['The Overstory', 'Richard Powers', 8758252, '#4a6b3a', 531],
  ['Mrs Dalloway', 'Virginia Woolf', 6397580, '#3f6b5a', 224],
  ['The Midnight Library', 'Matt Haig', 10313767, '#1d2b45', 304],
  ['Never Let Me Go', 'Kazuo Ishiguro', 745375, '#2f5a2a', 319],
  ['Americanah', 'Chimamanda Ngozi Adichie', 8474037, '#a88a66', 592],
  ['The Goldfinch', 'Donna Tartt', 8771366, '#ece6da', 862],
  ['Cloud Atlas', 'David Mitchell', 6714077, '#5f6d36', 537],
  ['Pride and Prejudice', 'Jane Austen', 13893906, '#e89a2a', 351],
  ['The Bear and the Nightingale', 'Katherine Arden', 11946359, '#1b2433', 368],
]

const toBook = ([title, author, coverId, cloth, pages]: Jacket): Book => ({
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
})

export const SHOWCASE_BOOKS: Book[] = SHOWCASE.map(toBook)
export const NEW_ARRIVAL_BOOKS: Book[] = NEW_ARRIVALS.map(toBook)

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

/** The medium-size cover, for the marquee and the little scenes where large is wasted. */
export const thumbnailOf = (book: Book) => book.coverUrl?.replace('-L.jpg', '-M.jpg') ?? null
