import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { shelf, shelveBook, signIn } from './helpers'

// WCAG 2.2 A and AA, plus axe's best practices, on every kind of page in both themes.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

async function expectAccessible(page: Page, label: string) {
  // Reduced motion still fades things in; measure contrast once they have settled.
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running'),
  )
  await page.waitForTimeout(400)
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const summary = violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  )
  expect(summary, label).toEqual([])
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme, reducedMotion: 'reduce' })

    test('the public pages are accessible', async ({ page }) => {
      for (const path of ['/', '/about', '/privacy', '/contact', '/docs', '/no-such-page']) {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expectAccessible(page, path)
      }
    })

    test('the shelves, a book card, search, and the garden are accessible', async ({ page }) => {
      await signIn(page)
      await shelveBook(page, 'earthsea', 'A Wizard of Earthsea', 'Read')
      await shelveBook(page, 'piranesi', 'Piranesi')
      await expectAccessible(page, '/library')

      await shelf(page, 'Read')
        .getByRole('button', { name: /^A Wizard of Earthsea\b/ })
        .click()
      await expect(
        page.getByRole('dialog').getByRole('heading', { name: 'A Wizard of Earthsea' }),
      ).toBeVisible()
      await expectAccessible(page, 'book card')
      await page.keyboard.press('Escape')

      await page
        .getByRole('button', { name: /find a book/i })
        .first()
        .click()
      await page.getByRole('dialog').getByLabel('Search for a book').fill('the')
      await expect(
        page
          .getByRole('dialog')
          .getByRole('button', { name: /^Shelve / })
          .first(),
      ).toBeVisible()
      await expectAccessible(page, 'search')
      await page.keyboard.press('Escape')

      await page.goto('/garden')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectAccessible(page, '/garden')
    })
  })
}
