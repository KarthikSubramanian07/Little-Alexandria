// A slow river of real covers, the way a library's new-arrivals cart looks
// when you walk past it. Pauses under the pointer; still when motion is reduced.
import { useState } from 'react'
import type { Book } from '../../../shared/types'
import { letteringOn, NEW_ARRIVAL_BOOKS, thumbnailOf } from './showcase'

function Jacket({ book, index }: { book: Book; index: number }) {
  const [failed, setFailed] = useState(false)
  return (
    <li
      className="w-[84px] shrink-0 list-none sm:w-[96px]"
      style={{ transform: `rotate(${((index * 37) % 7) - 3}deg)` }}
    >
      <div
        className="aspect-[2/3] overflow-hidden rounded-[3px] shadow-[4px_8px_16px_-8px_rgb(var(--shadow-rgb)/0.7)]"
        style={{ background: book.spineColor ?? 'var(--paper-deep)' }}
      >
        {book.coverUrl && !failed ? (
          <img
            src={thumbnailOf(book)!}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div
            className="grid h-full place-items-center p-2 text-center font-display text-xs leading-tight"
            style={{ color: letteringOn(book.spineColor ?? '#6b4a32') }}
          >
            {book.title}
          </div>
        )}
      </div>
    </li>
  )
}

export function CoverMarquee() {
  const books = NEW_ARRIVAL_BOOKS
  return (
    <section
      aria-labelledby="stacks-heading"
      className="relative overflow-hidden border-y border-line bg-paper-deep/60 py-10"
    >
      <div className="mx-auto mb-6 flex max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 sm:px-8">
        <h2 id="stacks-heading" className="font-hand text-2xl text-moss">
          straight from the stacks
        </h2>
        <p className="text-sm text-ink-faint">
          Real covers and details from the Open Library, for millions of books.
        </p>
      </div>
      <div className="marquee-mask">
        <ol aria-hidden className="marquee flex w-max gap-7 py-3 pl-7">
          {[...books, ...books].map((book, i) => (
            <Jacket key={`${book.id}-${i}`} book={book} index={i} />
          ))}
        </ol>
      </div>
    </section>
  )
}
