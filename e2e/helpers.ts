import { expect, type Page } from '@playwright/test'

/** Sign in as a brand-new guest reader, so every test starts with empty shelves. */
export async function signIn(page: Page) {
  const key = `t${Date.now()}${Math.random().toString(36).slice(2, 8)}`
  await page.goto('/')
  const response = await page.request.post('/api/auth/guest', {
    data: { key },
    headers: { Origin: new URL(page.url()).origin },
  })
  expect(response.ok()).toBeTruthy()
  await page.goto('/library')
  await expect(page.getByRole('heading', { name: 'Your shelves' })).toBeVisible()
}

export const shelf = (page: Page, name: string) => page.getByRole('region', { name, exact: true })

/** Search the catalogue and shelve the first result onto the chosen shelf. */
export async function shelveBook(
  page: Page,
  query: string,
  title: string,
  target = 'Want to Read',
) {
  await page
    .getByRole('button', { name: /find a book/i })
    .first()
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: target, exact: true }).click()
  await dialog.getByLabel('Search for a book').fill(query)
  await dialog.getByRole('button', { name: `Add ${title} to ${target}` }).click()
  await expect(dialog.getByRole('link', { name: target })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(
    shelf(page, target).getByRole('button', { name: new RegExp(`^Open ${title}`) }),
  ).toBeVisible()
}
