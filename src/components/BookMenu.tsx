import { DropdownMenu } from 'radix-ui'
import { SHELF_LABELS, SHELVES, type LibraryEntry } from '../../shared/types'
import { useMoveEntry, useRemoveEntry } from '../lib/queries'

const itemClass =
  'flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-moss data-[highlighted]:text-on-moss'

/**
 * The quiet "move" chip above each book: the keyboard-and-thumb friendly
 * alternative to dragging. Visible on hover and focus, always on touch screens.
 */
export function BookMenu({ entry }: { entry: LibraryEntry }) {
  const move = useMoveEntry()
  const remove = useRemoveEntry()
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Move or remove ${entry.book.title}`}
        className="absolute -top-8 right-0 grid size-7 place-items-center rounded-full border border-line-strong bg-card text-ink-soft opacity-0 shadow-sm transition group-hover/book:opacity-100 group-focus-within/book:opacity-100 hover:text-ink focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
          <circle cx="3" cy="8" r="1.4" fill="currentColor" />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" />
          <circle cx="13" cy="8" r="1.4" fill="currentColor" />
        </svg>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-48 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-xl border border-line bg-card p-1.5 shadow-[0_18px_40px_-14px_rgb(var(--shadow-rgb)/0.45)] data-[state=open]:animate-[menu-in_160ms_var(--ease-out-soft)]"
        >
          <DropdownMenu.Label className="px-3 pt-1.5 pb-1 font-hand text-base text-ink-faint">Move to…</DropdownMenu.Label>
          {SHELVES.filter((shelf) => shelf !== entry.shelf).map((shelf) => (
            <DropdownMenu.Item key={shelf} className={itemClass} onSelect={() => move(entry, shelf)}>
              {SHELF_LABELS[shelf]}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            className={`${itemClass} text-rose data-[highlighted]:bg-rose data-[highlighted]:text-paper`}
            onSelect={() => remove.mutate(entry)}
          >
            Take off the shelves
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
