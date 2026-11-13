// Screenshot helper for visual checks: node scripts/shoot.mjs <out-dir> [base-url]
// Signs in as the local guest, then captures key pages in both themes and on a phone.
import { chromium } from '@playwright/test'

const out = process.argv[2] ?? 'shots'
const base = process.argv[3] ?? 'http://localhost:5173'
const pages = (process.env.PAGES ?? '/,/library,/garden').split(',')
const themes = (process.env.THEMES ?? 'light,dark').split(',')
const viewports = { desktop: { width: 1360, height: 900 }, phone: { width: 390, height: 844 } }
const sizes = (process.env.SIZES ?? 'desktop,phone').split(',')

const browser = await chromium.launch()
for (const size of sizes) {
  for (const theme of themes) {
    const context = await browser.newContext({ viewport: viewports[size], colorScheme: theme, deviceScaleFactor: 2 })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
    await page.goto(`${base}/`)
    await page.request.post(`${base}/api/auth/guest`, { headers: { Origin: base } })
    for (const path of pages) {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(Number(process.env.WAIT ?? 2600))
      const name = `${out}/${size}-${theme}${path.replace(/[/?=&]+/g, '_') || '_home'}.png`
      await page.screenshot({ path: name, fullPage: process.env.FULL !== '0' })
      console.log('saved', name)
    }
    if (errors.length) console.log(`errors (${size}/${theme}):`, [...new Set(errors)].slice(0, 8))
    await context.close()
  }
}
await browser.close()
