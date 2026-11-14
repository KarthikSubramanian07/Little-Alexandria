import { expect, test } from '@playwright/test'

test('the landing page is a reading room: a stocked bookcase, the stacks, and three rituals', async ({
  page,
}) => {
  await page.goto('/')
  const bookcase = page.getByRole('figure', { name: /example bookcase/i })
  await expect(bookcase).toBeVisible()
  // Twelve real books on two shelves, each named for assistive tech.
  await expect(bookcase.getByRole('listitem')).toHaveCount(12)
  await expect(bookcase.getByText(/^The Hobbit/).first()).toBeAttached()

  await expect(page.getByRole('heading', { name: /straight from the stacks/i })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: /three small rituals/i })).toBeVisible()
  for (const name of [/one tap from your shelf/i, /for every book you keep/i, /plant a flower/i]) {
    await expect(page.getByRole('heading', { level: 3, name })).toBeVisible()
  }
  await expect(page.getByRole('heading', { name: /your shelves are waiting/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /step inside as a guest/i })).toBeVisible()
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the scenes hold still in their finished state', async ({ page }) => {
    await page.goto('/')
    const stamp = page.getByText('READ', { exact: true })
    await stamp.scrollIntoViewIfNeeded()
    await expect(stamp).toBeVisible()
    await expect(page.getByText('finished 19 March')).toBeVisible()
    // Nothing loops forever: every animation on the page comes to rest.
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== 'running'),
    )
  })
})

test('the closing doors let a guest in', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /step inside as a guest/i }).click()
  await expect(page).toHaveURL(/\/library$/)
})
