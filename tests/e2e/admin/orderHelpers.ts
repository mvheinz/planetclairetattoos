import AxeBuilder from '@axe-core/playwright'
import { sql } from '@payloadcms/db-postgres'
import type { Page } from '@playwright/test'
import type { Payload, RequestContext } from 'payload'

import { createOrder, dbOf, orderData } from '../../int/helpers/commerce'
import { expect } from '../fixtures'

// Bestell-Fixtures für die E2E-Tests der Verwaltung (P5.9–P5.11): Beispiel-Bestellungen (`seed = true`, damit sie sich
// wieder löschen lassen) zu Fixture-Stücken 980–999; Bestellnummern aus dem Bereich PC-2026-9xxxx.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

export async function fixtureOrder(
  payload: Payload,
  product: { id: number; itemNumber: number },
  number: number,
  overrides: Record<string, unknown> = {},
  context: RequestContext = { system: true, transition: 'O1' },
): Promise<{ id: number; orderNumber: string }> {
  const order = await createOrder(
    payload,
    orderData(number, [{ id: product.id, itemNumber: product.itemNumber }], {
      seed: true,
      timestamps: { placedAt: new Date().toISOString() },
      ...overrides,
    }),
    context,
  )
  return { id: order.id as number, orderNumber: order.orderNumber as string }
}

export async function removeOrder(payload: Payload, id: number): Promise<void> {
  const db = dbOf(payload)
  await db.execute(sql`UPDATE products SET current_order_id = NULL WHERE current_order_id = ${id}`)
  await db.execute(sql`UPDATE orders SET invoice_id = NULL WHERE id = ${id}`)
  await db.execute(
    sql.raw(`DO $$ BEGIN
      ALTER TABLE invoices DISABLE TRIGGER USER;
      DELETE FROM invoices WHERE order_id = ${Number(id)};
      ALTER TABLE invoices ENABLE TRIGGER USER;
    END $$`),
  )
  await db.execute(sql`DELETE FROM email_log WHERE order_id = ${id}`)
  await db.execute(sql`DELETE FROM complaints WHERE order_id = ${id}`)
  await db.execute(sql`DELETE FROM consent_log WHERE order_id = ${id}`)
  const photos = await payload.find({
    collection: 'private-uploads',
    where: { relatedOrder: { equals: id } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  for (const p of photos.docs) {
    await payload
      .delete({
        collection: 'private-uploads',
        id: p.id,
        overrideAccess: true,
        context: { seed: true },
      })
      .catch(() => undefined)
  }
  await payload.delete({ collection: 'orders', id, overrideAccess: true, context: { seed: true } })
}

/** axe ohne `serious`/`critical` im Bereich `selector`. */
export async function expectAccessible(page: Page, selector: string): Promise<void> {
  const result = await new AxeBuilder({ page }).include(selector).withTags(TAGS).analyze()
  const blocking = result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)
  expect(blocking).toEqual([])
}

/** Kein horizontales Scrollen der Seite. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  // Nach einer vollen Navigation (z. B. GET-Formular) erst messen, wenn alle Stylesheets da sind: Unter Last stand der
  // Text schon im DOM, das Layout aber noch ohne CSS (Payload-Navigation offen, Tabellen 1500 px breit).
  await page.waitForLoadState('load')
  const { overflow, wide } = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement
    return {
      overflow: el.scrollWidth - el.clientWidth,
      // Diagnose bei Rot: die ersten Elemente, die rechts über den Rand ragen.
      wide: [...document.querySelectorAll('body *')]
        .filter((e) => e.getBoundingClientRect().right > el.clientWidth + 1)
        .slice(0, 6)
        .map((e) => {
          const r = e.getBoundingClientRect()
          return `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} L${Math.round(r.left)} R${Math.round(r.right)}`
        }),
    }
  })
  expect(
    overflow,
    `kein horizontales Scrollen auf ${page.url()} (${wide.join(' | ')})`,
  ).toBeLessThanOrEqual(0)
}

export const orderStatus = async (payload: Payload, id: number) =>
  (await payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: true })) as {
    status: string
    statusHistory?: { transition?: string | null }[] | null
  }

/** Wartet, bis das Pack-Panel gebunden ist; vorher Getipptes ginge beim Hydrieren verloren (WebKit unter Last). */
export async function packingPanelReady(page: Page) {
  const panel = page.locator('[data-testid="packing-panel"][data-hydrated="true"]')
  await expect(panel).toBeVisible()
  return panel
}
