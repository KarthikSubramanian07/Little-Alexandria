import { expect, test } from '@playwright/test'
import { shelf, shelveBook, signIn } from './helpers'

test('the landing page invites you in', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Every great reader deserves')
  await expect(page.getByRole('link', { name: /sign in with google/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /look around as a guest/i })).toBeVisible()
})

test('a guest can step inside from the landing page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /look around as a guest/i }).click()
  await expect(page).toHaveURL(/\/library$/)
  await expect(page.getByRole('heading', { name: 'Your shelves' })).toBeVisible()
})

test('a new library offers to find or import books', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: /ready for its first book/i })).toBeVisible()
  for (const name of ['Want to Read', 'Currently Reading', 'Read']) {
    await expect(shelf(page, name)).toBeVisible()
  }
})

test('search, shelve, rate, finish, and remove a book', async ({ page }) => {
  await signIn(page)
  await shelveBook(page, 'earthsea', 'A Wizard of Earthsea')

  // Open the book's card.
  await shelf(page, 'Want to Read')
    .getByRole('button', { name: /^Open A Wizard of Earthsea/ })
    .click()
  const card = page.getByRole('dialog')
  await expect(card.getByRole('heading', { name: 'A Wizard of Earthsea' })).toBeVisible()

  // Rate it, then finish it: the stamp lands and the dates fill themselves in.
  await card.getByRole('radio', { name: /4 stars/ }).click()
  await expect(card.getByText('Really liked it')).toBeVisible()
  await card.getByRole('radio', { name: 'Read', exact: true }).click()
  await expect(card.getByLabel(/^Finished /)).toBeVisible()

  // Notes save themselves.
  await card.getByPlaceholder(/what stayed with you/i).fill('Names have power.')
  await expect(card.getByText('kept ✓')).toBeVisible({ timeout: 5_000 })

  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/library$/)
  const read = shelf(page, 'Read')
  await expect(read.getByRole('button', { name: /^Open A Wizard of Earthsea/ })).toBeVisible()

  // Everything survived a reload.
  await page.reload()
  await read.getByRole('button', { name: /^Open A Wizard of Earthsea/ }).click()
  await expect(page.getByRole('dialog').getByRole('radio', { name: /4 stars/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByRole('dialog').getByPlaceholder(/what stayed with you/i)).toHaveValue(
    'Names have power.',
  )

  // Take it off the shelves, then undo.
  await page.getByRole('dialog').getByRole('button', { name: 'Take off the shelves' }).click()
  await expect(read.getByRole('button', { name: /^Open A Wizard of Earthsea/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(read.getByRole('button', { name: /^Open A Wizard of Earthsea/ })).toBeVisible()
})

test('the move menu carries a book between shelves', async ({ page }) => {
  await signIn(page)
  await shelveBook(page, 'dune', 'Dune')
  const want = shelf(page, 'Want to Read')
  await want.getByRole('listitem').filter({ hasText: '' }).first().hover()
  await want.getByRole('button', { name: 'Move or remove Dune' }).click()
  await page.getByRole('menuitem', { name: 'Currently Reading' }).click()
  await expect(
    shelf(page, 'Currently Reading').getByRole('button', { name: /^Open Dune/ }),
  ).toBeVisible()
  await expect(want.getByRole('button', { name: /^Open Dune/ })).toHaveCount(0)
})

test('⌘K opens search from anywhere', async ({ page, isMobile }) => {
  test.skip(isMobile, 'no keyboard shortcuts on phones')
  await signIn(page)
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.getByLabel('Search for a book')).toBeFocused()
})

test('the garden blooms for finished books and keeps a goal', async ({ page }) => {
  await signIn(page)
  await shelveBook(page, 'piranesi', 'Piranesi', 'Read')
  await page.getByRole('link', { name: 'Garden' }).click()
  await expect(page.getByRole('heading', { name: 'Your reading garden' })).toBeVisible()
  await expect(
    page.getByRole('list', { name: /books finished in/i }).getByRole('listitem'),
  ).toHaveCount(1)
  await page.getByRole('button', { name: 'Set a goal' }).click()
  await page.getByLabel(/books to read in/i).fill('20')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('19 more books and the sun is all the way up.')).toBeVisible()
})
