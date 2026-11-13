import { expect, test } from '@playwright/test'
import { shelf, shelveBook, signIn } from './helpers'

test('a shared library is visible to strangers, without notes', async ({
  page,
  browser,
  isMobile,
}) => {
  await signIn(page)
  await shelveBook(page, 'circe', 'Circe', 'Read')
  await shelf(page, 'Read')
    .getByRole('button', { name: /^Open Circe/ })
    .click()
  await page
    .getByRole('dialog')
    .getByPlaceholder(/what stayed with you/i)
    .fill('my secret thoughts')
  await expect(page.getByRole('dialog').getByText('kept ✓')).toBeVisible({ timeout: 5_000 })
  await page.keyboard.press('Escape')

  if (isMobile) {
    await page.getByRole('button', { name: /signed in as/i }).click()
    await page.getByRole('menuitem', { name: 'Share your shelves' }).click()
  } else {
    await page.getByRole('button', { name: 'Share your shelves' }).click()
  }
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('switch').click()
  await expect(dialog.getByText('Your library is open')).toBeVisible()
  const handle = await dialog.getByLabel('Your address').inputValue()

  const stranger = await browser.newContext()
  const visit = await stranger.newPage()
  await visit.goto(`/u/${handle}`)
  await expect(visit.getByRole('heading', { name: 'Guest Reader' })).toBeVisible()
  await expect(visit.getByRole('link', { name: /start your own library/i }).first()).toBeVisible()
  await visit.getByRole('button', { name: /^Open Circe/ }).click()
  await expect(visit.getByRole('dialog').getByText(/on guest’s read shelf/i)).toBeVisible()
  await expect(visit.getByText('my secret thoughts')).toHaveCount(0)
  await stranger.close()
})

test('a private library stays closed', async ({ page, browser }) => {
  await signIn(page)
  const handle = await page.evaluate(
    async () => (await (await fetch('/api/auth/me')).json()).user.handle,
  )
  const stranger = await browser.newContext()
  const visit = await stranger.newPage()
  await visit.goto(`/u/${handle}`)
  await expect(visit.getByRole('heading', { name: 'This library is closed' })).toBeVisible()
  await stranger.close()
})

test('importing a reading list fills the shelves', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'Import a list' }).first().click()
  const dialog = page.getByRole('dialog')
  const csv = [
    'Dune,Frank Herbert,2025',
    'The Hobbit,J.R.R. Tolkien',
    'Circe,',
    'A Book Nobody Wrote,Nobody',
  ].join('\n')
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'Books List - Fiction.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  })
  await expect(dialog.getByText('4 books, ready to shelve')).toBeVisible()
  await dialog.getByRole('button', { name: /shelve 4 books/i }).click()
  await expect(dialog.getByText('Every book has found a shelf.')).toBeVisible({ timeout: 30_000 })
  await expect(dialog.getByText('A Book Nobody Wrote')).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(shelf(page, 'Read').getByRole('button', { name: /^Open Dune/ })).toBeVisible()
  await expect(
    shelf(page, 'Want to Read').getByRole('button', { name: /^Open The Hobbit/ }),
  ).toBeVisible()
  await shelf(page, 'Read')
    .getByRole('button', { name: /^Open Dune/ })
    .click()
  await expect(page.getByRole('dialog').getByText('sometime in 2025')).toBeVisible()
})

test('a reader can download their library and close their account', async ({ page }) => {
  await signIn(page)
  await shelveBook(page, 'dune', 'Dune')
  await page.getByRole('button', { name: /signed in as/i }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /download my library/i }).click()
  expect((await download).suggestedFilename()).toMatch(/^little-alexandria-\d{4}-\d{2}-\d{2}\.csv$/)

  await page.getByRole('button', { name: /signed in as/i }).click()
  await page.getByRole('menuitem', { name: /delete my account/i }).click()
  await page.getByRole('button', { name: 'Delete everything' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(
    await page.evaluate(async () => (await (await fetch('/api/auth/me')).json()).user),
  ).toBeNull()
})
