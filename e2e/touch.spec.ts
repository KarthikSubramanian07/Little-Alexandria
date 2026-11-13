import { devices, expect, test, type Page } from '@playwright/test'
import { shelveBook, signIn } from './helpers'

// Phones and tablets: nothing pokes past the edge, controls are thumb-sized,
// and text fields are big enough that iOS Safari doesn't zoom in on focus.
async function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = []
    const overflow = document.documentElement.scrollWidth - window.innerWidth
    if (overflow > 0) problems.push(`page scrolls sideways by ${overflow}px`)
    for (const el of document.querySelectorAll<HTMLElement>('header button, header a, nav a')) {
      const box = el.getBoundingClientRect()
      if (box.width === 0) continue
      if (box.right > window.innerWidth + 1)
        problems.push(`${el.getAttribute('aria-label') ?? el.textContent} is off screen`)
      if (Math.min(box.width, box.height) < 40)
        problems.push(
          `${el.getAttribute('aria-label') ?? el.textContent} is ${Math.round(box.width)}x${Math.round(box.height)}`,
        )
    }
    for (const el of document.querySelectorAll<HTMLElement>('input, textarea')) {
      if (el.getBoundingClientRect().width === 0) continue
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size < 16)
        problems.push(
          `${el.getAttribute('aria-label') ?? el.getAttribute('type')} field is ${size}px`,
        )
    }
    return problems
  })
}

for (const name of ['iPhone SE', 'iPad Mini', 'iPad Pro 11 landscape'] as const) {
  test.describe(name, () => {
    test.beforeEach(({ page: _page }, info) => {
      test.skip(info.project.name !== 'desktop', 'device emulation runs once')
    })
    const { defaultBrowserType: _browser, ...device } = devices[name]
    test.use(device)

    test('the shelves and a book card fit and are easy to tap', async ({ page }) => {
      await signIn(page)
      await shelveBook(page, 'earthsea', 'A Wizard of Earthsea')
      expect(await layoutProblems(page)).toEqual([])
      await page.getByRole('button', { name: /^A Wizard of Earthsea\b/ }).click()
      await expect(
        page.getByRole('dialog').getByRole('heading', { name: 'A Wizard of Earthsea' }),
      ).toBeVisible()
      expect(await layoutProblems(page)).toEqual([])
    })
  })
}
