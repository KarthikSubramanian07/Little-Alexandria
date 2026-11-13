// Renders the social preview and app icons from the /brand artboards.
//   pnpm dev  (in another terminal), then: node scripts/brand.mjs
import { chromium } from '@playwright/test'

const base = process.argv[2] ?? 'http://localhost:5173'
const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1400, height: 1400 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
})
await page.goto(`${base}/brand`, { waitUntil: 'networkidle' })
await page.waitForTimeout(4000) // let every flower finish growing
await page.locator('#og').screenshot({ path: 'public/og.png' })
const icon = page.locator('#icon')
for (const [size, file] of [
  [512, 'icon-512.png'],
  [192, 'icon-192.png'],
  [180, 'apple-touch-icon.png'],
]) {
  const buffer = await icon.screenshot({ omitBackground: true })
  const resized = await browser.newPage({ viewport: { width: size, height: size } })
  await resized.setContent(
    `<img src="data:image/png;base64,${buffer.toString('base64')}" style="width:${size}px;height:${size}px;display:block">`,
  )
  await resized.screenshot({ path: `public/${file}`, omitBackground: true })
  await resized.close()
}
await browser.close()
console.log('wrote public/og.png and icons')
