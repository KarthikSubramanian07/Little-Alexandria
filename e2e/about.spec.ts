import { expect, test } from '@playwright/test'
import { shelf, shelveBook, signIn } from './helpers'

test('a book’s card says what the open catalogues know about it', async ({ page }) => {
  await signIn(page)
  await shelveBook(page, 'piranesi', 'Piranesi')
  await shelf(page, 'Want to Read')
    .getByRole('button', { name: /^Piranesi\b/ })
    .click()
  const card = page.getByRole('dialog')

  // The quick answer to "is it worth it?", first.
  await expect(card.getByText('Reading time')).toBeVisible()
  await expect(card.getByText('want to read it')).toBeVisible()
  await expect(card.getByText('3,120', { exact: true })).toBeVisible()
  await expect(card.getByText(/hour read, on the wish lists of/)).toBeVisible()

  await expect(card.getByRole('heading', { name: 'It begins…' })).toBeVisible()
  await expect(card.getByText(/^Sample opening lines/)).toBeVisible()

  const story = card.getByRole('region', { name: 'In the story' })
  await expect(story.getByText('A house of endless halls')).toBeVisible()
  await expect(story.getByText('Solitude')).toBeVisible()
  // Genres stay in their own row, not repeated as themes.
  await expect(story.getByText('Fiction', { exact: true })).toHaveCount(0)

  const author = card.getByRole('region', { name: 'About the author' })
  await expect(author.getByText('Susanna Clarke', { exact: true })).toBeVisible()
  await expect(author.getByRole('img', { name: /portrait/i })).toHaveCount(0)
  await expect(author.getByText(/^Sample biography/)).toBeVisible()
  await expect(author.getByRole('link', { name: /Open Library/ })).toHaveAttribute(
    'target',
    '_blank',
  )

  await expect(card.getByRole('link', { name: /A sample review/ })).toBeVisible()
  await expect(card.getByText(/Ratings, reading logs, and story details from/)).toBeVisible()
})

test('the catalogue’s notes are public, but only for books someone has shelved', async ({
  page,
}) => {
  await page.goto('/')
  const unknown = await page.request.get('/api/books/openlibrary%3AOL0W/about')
  expect(unknown.status()).toBe(404)
})
