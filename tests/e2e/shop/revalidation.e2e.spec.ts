import type { APIRequestContext } from '@playwright/test'

import { holdAdminSessions, withLoginLock, type ReleaseLock } from '../../helpers/adminSessionLock'
import { serverURL, testUser } from '../../helpers/adminEnv'
import { seedTestUser } from '../../helpers/seedUser'
import { expect, test, testPayload } from '../fixtures'
import { NO_CACHE, refresh } from './fresh'
import { PUBLISHED, pathOf } from './productPage'

// P3.15 Aktualität (KONZEPT §1.6, ARCHITEKTUR §9.3, RECHT R-031): Änderungen in der Verwaltung laufen über dieselben
// HTTP-Wege wie die Knöpfe bzw. „Speichern“ (Admin-Endpunkte `POST /api/products/:id/<aktion>`, REST `PATCH
// /api/products/:id`, `POST /api/globals/settings`) – im Server-Prozess, der die Cache-Tags erneuert. Geprüft wird das
// Server-HTML ohne JavaScript (der Live-Zustand `product-status` würde veraltete Seiten sonst überdecken).
// Gegen den Produktions-Build (`E2E_SERVER=start`): Statuswechsel ≤ 5 s, Bearbeitungen ≤ 60 s. Mit `pnpm dev` gelten
// großzügigere Grenzen für Statuswechsel, weil Seiten beim ersten Aufruf übersetzt werden.
// Ausgangslage: Fixtures entstehen per Local API im Testprozess (Seed-Kontext, keine Erneuerung) – deshalb bringt
// `prime()` die betroffenen Seiten vorher auf den Stand der Test-DB; alles danach erneuert allein der Server.

const PRODUCTION = process.env.E2E_SERVER === 'start'
const IMMEDIATE_MS = PRODUCTION ? 5_000 : 30_000
const EDIT_MS = 60_000
const POLL = { intervals: [100, 250, 500] }

test.describe.configure({ timeout: 180_000 })

interface Admin {
  token: string
  release: ReleaseLock
}

/** Anmeldung über die Local API (kein Formular-Login, Rate-Limit), Sitzung gegen parallele Resets geschützt. */
async function adminLogin(): Promise<Admin> {
  const release = await holdAdminSessions('shared')
  try {
    await seedTestUser()
    const payload = await testPayload()
    const { token } = await withLoginLock(() =>
      payload.login({ collection: 'users', data: testUser }),
    )
    if (!token) throw new Error('Anmeldung des Grund-Seed-Admins fehlgeschlagen.')
    return { token, release }
  } catch (err) {
    await release()
    throw err
  }
}

async function call(
  request: APIRequestContext,
  admin: Admin,
  method: 'post' | 'patch',
  path: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const res = await request[method](`${serverURL}/api${path}`, {
    headers: { Authorization: `JWT ${admin.token}` },
    data,
  })
  expect(res.status(), `${method.toUpperCase()} ${path}: ${await res.text()}`).toBe(200)
}

/** Server-HTML ohne Weiterleitung. */
async function html(
  request: APIRequestContext,
  url: string,
): Promise<{ status: number; body: string }> {
  const res = await request.get(url, { maxRedirects: 0, failOnStatusCode: false })
  return { status: res.status(), body: await res.text() }
}

interface Html {
  status: number
  body: string
}

/** Mehrere Seiten gleichzeitig abrufen. */
async function htmlOf<K extends string>(
  request: APIRequestContext,
  urls: Record<K, string>,
): Promise<Record<K, Html>> {
  const entries = await Promise.all(
    (Object.entries(urls) as [K, string][]).map(
      async ([k, u]) => [k, await html(request, u)] as const,
    ),
  )
  return Object.fromEntries(entries) as Record<K, Html>
}

/**
 * Ausgangsstand herstellen: im Produktions-Build On-Demand-Revalidierung (`refresh`), mit `pnpm dev` eine Anfrage mit
 * `Cache-Control: no-cache`, die den Daten-Cache frisch aus der DB füllt.
 */
async function prime(request: APIRequestContext, urls: string[]): Promise<void> {
  if (PRODUCTION) return refresh(request, urls)
  for (const url of urls)
    await request.get(url, { headers: NO_CACHE, maxRedirects: 0, failOnStatusCode: false })
}

const card = (nr: number, state: string) => `data-item-number="${nr}" data-status="${state}"`

test.describe('P3.15 Aktualität nach Änderungen in der Verwaltung', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'Server-HTML und Cache – browserunabhängig, ändert Daten; einmal je Lauf im Projekt desktop',
    )
  })

  test('KONZEPT §1.6 Statuswechsel per Admin-Endpunkt: neues Stück sofort erreichbar (dynamicParams), nach „offline verkauft“ Produktseite, Shop, Kategorie und Startseite ≤ 5 s aktuell @slow', async ({
    request,
    fixtureProducts,
  }) => {
    const { id, itemNumber: nr } = await fixtureProducts.create('keramik')
    const product = await pathOf(nr, 'de')
    const shop = '/de/shop'
    const category = '/de/shop/kategorie/keramik'
    const home = '/de'
    const admin = await adminLogin()
    try {
      await prime(request, [product, shop, category, home])
      // Entwurf: 404 (die Antwort liegt im Cache – die Veröffentlichung muss sie erneuern).
      expect((await html(request, product)).status).toBe(404)
      for (const url of [shop, category, home])
        expect((await html(request, url)).body, url).not.toContain(`data-item-number="${nr}"`)

      await call(request, admin, 'post', `/products/${id}/publish`)
      await expect
        .poll(
          async () => {
            const { p, s, c, h } = await htmlOf(request, {
              p: product,
              s: shop,
              c: category,
              h: home,
            })
            return {
              product: p.status === 200 && p.body.includes(card(nr, 'available')),
              shop: s.body.includes(card(nr, 'available')),
              category: c.body.includes(card(nr, 'available')),
              home: h.body.includes(card(nr, 'available')),
            }
          },
          { ...POLL, timeout: IMMEDIATE_MS, message: 'veröffentlicht ≤ 5 s sichtbar' },
        )
        .toEqual({ product: true, shop: true, category: true, home: true })

      await call(request, admin, 'post', `/products/${id}/sell-offline`, {
        note: 'E2E Atelierverkauf',
        showInArchive: true,
      })
      await expect
        .poll(
          async () => {
            const { p, s, c, h } = await htmlOf(request, {
              p: product,
              s: shop,
              c: category,
              h: home,
            })
            return {
              product:
                p.status === 200 &&
                p.body.includes(card(nr, 'sold')) &&
                p.body.includes('data-buy-state="sold"'),
              shop: s.body.includes(card(nr, 'sold')),
              category: c.body.includes(card(nr, 'sold')),
              // Stationen der Startseite zeigen nie verkaufte Stücke (AK-3-02).
              home: !h.body.includes(`data-item-number="${nr}"`),
            }
          },
          { ...POLL, timeout: IMMEDIATE_MS, message: '„offline verkauft“ ≤ 5 s sichtbar' },
        )
        .toEqual({ product: true, shop: true, category: true, home: true })

      // Aufräumen über dieselben Wege (sofort erneuert): wieder verfügbar, dann offline → 404, aus allen Listen.
      await call(request, admin, 'post', `/products/${id}/return-to-stock`)
      await call(request, admin, 'post', `/products/${id}/unpublish`)
      await expect
        .poll(
          async () => {
            const { p, s } = await htmlOf(request, { p: product, s: shop })
            return { product: p.status, shop: s.body.includes(`data-item-number="${nr}"`) }
          },
          { ...POLL, timeout: IMMEDIATE_MS, message: 'offline genommen ≤ 5 s' },
        )
        .toEqual({ product: 404, shop: false })
    } finally {
      await admin.release()
    }
  })

  test('KONZEPT §1.6 Textänderung im Admin nach ≤ 60 s sichtbar; R-031 geänderter Klassenpreis in settings.shipping.rates erscheint auf R04 nach ≤ 60 s @slow', async ({
    request,
    fixtureProducts,
  }) => {
    const { id, itemNumber: nr } = await fixtureProducts.create('textil', {
      ...PUBLISHED,
      shippingClass: 'paket_klein',
    })
    const product = await pathOf(nr, 'de')
    const payload = await testPayload()
    type Rate = { zone: string; shippingClass: string; priceCents: number }
    const settings = (await payload.findGlobal({ slug: 'settings', overrideAccess: true })) as {
      shipping?: { rates?: Rate[] | null } | null
    }
    const original = (settings.shipping?.rates ?? []).map(
      ({ zone, shippingClass, priceCents }) => ({
        zone,
        shippingClass,
        priceCents,
      }),
    )
    const before = original.find((r) => r.zone === 'DE' && r.shippingClass === 'paket_klein')
    expect(before, 'Versandpreis Paket klein (DE) im Grund-Seed').toBeTruthy()
    const changedCents = before!.priceCents + 20
    const euro = (cents: number) =>
      `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`
    const shippingText = (body: string) =>
      body.match(/data-shipping-class="paket_klein"[^>]*>([^<]*)</)?.[1] ?? ''

    const admin = await adminLogin()
    try {
      await prime(request, [product])
      const first = await html(request, product)
      expect(first.status).toBe(200)
      expect(shippingText(first.body)).toContain(euro(before!.priceCents))

      // Textänderung wie „Speichern“ im Formular (REST PATCH) → 'max', sichtbar ≤ 60 s.
      const marker = `Neu bemalt am ${Date.now()} – mit Coco auf dem Ärmel.`
      await call(request, admin, 'patch', `/products/${id}?locale=de`, { description: marker })
      await expect
        .poll(async () => (await html(request, product)).body.includes(marker), {
          ...POLL,
          timeout: EDIT_MS,
          message: 'Textänderung ≤ 60 s sichtbar',
        })
        .toBe(true)

      // R-031: Klassenpreis ändern (Einstellungen speichern) → Tag `settings`, sichtbar ≤ 60 s.
      const rates = original.map((r) => (r === before ? { ...r, priceCents: changedCents } : r))
      await call(request, admin, 'post', '/globals/settings', { shipping: { rates } })
      await expect
        .poll(async () => shippingText((await html(request, product)).body), {
          ...POLL,
          timeout: EDIT_MS,
          message: 'geänderter Versandpreis ≤ 60 s auf R04',
        })
        .toContain(euro(changedCents))
    } finally {
      // Grund-Seed-Preis wiederherstellen (über denselben Weg, damit der Server-Cache mitzieht), dann offline nehmen.
      // Fehler beim Aufräumen werden vermerkt, überdecken aber nicht den eigentlichen Befund.
      try {
        await call(request, admin, 'post', '/globals/settings', { shipping: { rates: original } })
        await expect
          .poll(async () => shippingText((await html(request, product)).body), {
            ...POLL,
            timeout: EDIT_MS,
          })
          .toContain(euro(before!.priceCents))
        await call(request, admin, 'post', `/products/${id}/unpublish`)
      } catch (err) {
        test.info().annotations.push({ type: 'cleanup', description: String(err) })
      } finally {
        await admin.release()
      }
    }
  })
})
