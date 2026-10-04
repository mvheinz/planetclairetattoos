import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'

import { localizedPath } from '../../src/lib/routes/paths'
import { productPath } from '../../src/lib/shop/format'
import { testPayload } from '../e2e/fixtures'
import { revalidatePrerendered } from '../e2e/global-setup'
import { refresh } from '../e2e/shop/fresh'
import { dynamicMasks, linuxOnly, prepare, settle } from './helpers'

// T-12 P8.16 (DESIGN KO-17/KO-18): 404-Variante „Dieses Stück hat schon ein Zuhause gefunden“ (S08, Nr. 908) und „Shop
// leer“ (nach `pnpm seed:remove --yes --drop-texts`, danach `pnpm seed:reset`). 404 und 500 stehen in
// `pages.visual.spec.ts`. DE, reduzierte Bewegung, ganzseitig.

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'

function seedCli(...args: string[]) {
  execFileSync('pnpm', ['run', ...args], {
    stdio: 'pipe',
    env: { ...process.env, NODE_OPTIONS: '' },
    timeout: 240_000,
  })
}

async function revalidateAll() {
  const failures = await revalidatePrerendered(BASE_URL, { allowNotFound: true })
  expect(failures).toEqual([])
}

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  linuxOnly()
  await prepare(page)
})

test('r28-404-zuhause (S08 verkauft, nicht im Archiv)', async ({ page, request }) => {
  const payload = await testPayload()
  const doc = (
    await payload.find({
      collection: 'products',
      where: { itemNumber: { equals: 908 } },
      locale: 'de',
      overrideAccess: true,
      limit: 1,
    })
  ).docs[0]!
  const url = productPath({ itemNumber: 908, slug: doc.slug }, 'de')
  await refresh(request, [url])
  const res = await page.goto(url)
  expect(res?.status()).toBe(404)
  await settle(page)
  await expect(page).toHaveScreenshot('r28-404-zuhause.png', {
    fullPage: true,
    mask: dynamicMasks(page),
  })
})

test.describe('ohne Beispieldaten', () => {
  test.beforeAll(async () => {
    test.setTimeout(300_000)
    seedCli('seed:remove', '--yes', '--drop-texts')
    await revalidateAll()
  })

  test.afterAll(async () => {
    test.setTimeout(300_000)
    seedCli('seed:reset')
    await revalidateAll()
  })

  test('r02-shop-leer', async ({ page }) => {
    const res = await page.goto(localizedPath('R02', 'de'))
    expect(res?.status()).toBe(200)
    await expect(page.locator('main [data-empty-state]')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('r02-shop-leer.png', {
      fullPage: true,
      mask: dynamicMasks(page),
    })
  })
})
