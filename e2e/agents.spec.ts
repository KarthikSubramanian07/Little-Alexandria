import { expect, test } from '@playwright/test'

// What an agent or a crawler without JavaScript sees, against the real Pages server.
test.describe('for agents and crawlers', () => {
  test.skip(({ isMobile }) => isMobile, 'HTTP-level checks run once')

  test('the home page has its words in the raw HTML, and Markdown on request', async ({
    request,
  }) => {
    const html = await request.get('/', { headers: { Accept: 'text/html' } })
    expect(html.status()).toBe(200)
    expect(html.headers()['vary']).toContain('Accept')
    expect(await html.text()).toContain('<h1>Every great reader deserves a great library.</h1>')

    const markdown = await request.get('/', { headers: { Accept: 'text/markdown' } })
    expect(markdown.headers()['content-type']).toBe('text/markdown; charset=utf-8')
    expect(markdown.headers()['vary']).toContain('Accept')
    expect(await markdown.text()).toMatch(/^# Every great reader/)
  })

  test('unknown paths are real 404s', async ({ request }) => {
    const missing = await request.get('/some-path-that-does-not-exist', {
      headers: { Accept: 'text/markdown' },
    })
    expect(missing.status()).toBe(404)
    expect(missing.headers()['content-type']).toBe('text/markdown; charset=utf-8')
    expect(await missing.text()).toContain('/llms.txt')
    expect((await request.get('/nope.php')).status()).toBe(404)
    expect((await request.get('/assets/missing-chunk.js')).status()).toBe(404)
  })

  test('the machine-readable files are served', async ({ request }) => {
    const llms = await request.get('/llms.txt')
    expect(llms.headers()['content-type']).toBe('text/plain; charset=utf-8')
    expect(await llms.text()).toContain('## When to use Little Alexandria')
    const spec = await request.get('/openapi.json')
    expect((await spec.json()).openapi).toBe('3.1.0')
    expect(await (await request.get('/sitemap.xml')).text()).toContain('/docs</loc>')
    expect((await request.get('/robots.txt')).status()).toBe(200)
  })

  test('API responses carry rate-limit headers', async ({ request }) => {
    const response = await request.get('/api/auth/providers')
    expect(response.headers()['ratelimit-policy']).toBe('"default";q=600;w=60')
    expect(response.headers()['ratelimit']).toMatch(/^"default";r=\d+;t=\d+$/)
  })
})

test('the footer leads to the API docs, and the docs render in the app', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'API' }).click()
  await expect(page).toHaveURL(/\/docs$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Little Alexandria API' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Rate limits' })).toBeVisible()
  await expect(page).toHaveTitle('Little Alexandria API · Docs')
})

test('an unknown page shows the friendly not-found shelf', async ({ page }) => {
  const response = await page.goto('/no-such-page')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'This shelf is empty' })).toBeVisible()
})
