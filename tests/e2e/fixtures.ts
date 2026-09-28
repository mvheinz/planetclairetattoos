import { test as base, expect, type Page, type TestInfo } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import type { ProductCategory } from '../../src/lib/enums'
import config from '../../src/payload.config.js'
import { adminRoute, serverURL } from '../helpers/adminEnv'
import { holdAdminSessions, withLoginLock } from '../helpers/adminSessionLock'
import { login } from '../helpers/login'

/** Formular-Login (zählt gegen das Login-Rate-Limit – sparsam verwenden; Aufrufer hält `holdAdminSessions`). */
export const loginViaForm = (page: Page) => login({ page, user: testUser })
import { seedTestUser, testUser } from '../helpers/seedUser'
import {
  completeProduct,
  createProductFixtures,
  type ProductFixtures,
} from '../int/helpers/products'

// Gemeinsame E2E-Fixtures (ARCHITEKTUR §7.2, PLAN P1.31):
// - `foreignRequests`: blockiert jede Anfrage an fremde Hosts per `context.route` und protokolliert sie (T-04, R-130).
// - `adminPage`: angemeldete Seite der Verwaltung mit dem Grund-Seed-Admin (SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD).
// - `fixtureProducts`: Stücke im Nummernbereich 980–999 (`seed: true`, Local API), je Playwright-Projekt ein eigener
//   Block, damit parallele Projekte sich nicht in die Quere kommen; nach jedem Test entfernt.

export { expect }

/** Nummernbereich der E2E-Fixtures (DATENMODELL §6.6.4) – nur Test-DB. */
export const FIXTURE_RANGE = { from: 980, to: 999 } as const
const PROJECT_BLOCKS: Record<string, number> = { desktop: 0, 'iphone-15': 1, 'pixel-7': 2 }
const BLOCK_SIZE = 6

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
const APP_HOST = new URL(serverURL).hostname

/** Erlaubt sind nur die App selbst und lokale Adressen; `data:`/`blob:` erreichen keinen Host. */
export function isForeignUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (!parsed.protocol.startsWith('http') && !parsed.protocol.startsWith('ws')) return false
  return !LOCAL_HOSTS.has(parsed.hostname) && parsed.hostname !== APP_HOST
}

let payloadPromise: Promise<Payload> | undefined
/** Local API gegen die Test-DB (Playwright setzt DATABASE_URL = DATABASE_URL_TEST). */
export const testPayload = (): Promise<Payload> => (payloadPromise ??= getPayload({ config }))

/** Erste Fixture-Nummer des laufenden Projekts (980, 986, 992). */
export function fixtureNumberBase(testInfo: TestInfo): number {
  const block = PROJECT_BLOCKS[testInfo.project.name] ?? 0
  return FIXTURE_RANGE.from + block * BLOCK_SIZE
}

export interface FixtureProducts {
  /** Legt ein Stück als Entwurf an (vollständig laut §6.6.6, `overrides` ersetzt Felder). */
  create(
    category: ProductCategory,
    overrides?: Record<string, unknown>,
  ): Promise<{ id: number; itemNumber: number }>
}

async function removeFixtureProducts(payload: Payload, numbers: number[]): Promise<void> {
  await payload.delete({
    collection: 'products',
    where: { itemNumber: { in: numbers } },
    overrideAccess: true,
    context: { seed: true },
  })
}

interface Fixtures {
  foreignRequests: string[]
  adminPage: Page
  fixtureProducts: FixtureProducts
}

export const test = base.extend<Fixtures>({
  foreignRequests: [
    async ({ context }, provide) => {
      const blocked: string[] = []
      await context.route(
        (url) => isForeignUrl(url.toString()),
        async (route) => {
          blocked.push(route.request().url())
          await route.abort('blockedbyclient')
        },
      )
      context.on('page', (page) =>
        page.on('websocket', (ws) => {
          if (isForeignUrl(ws.url())) blocked.push(ws.url())
        }),
      )
      await provide(blocked)
    },
    { auto: true },
  ],

  adminPage: async ({ page }, provide) => {
    // Sitzung gegen parallele Anmeldungen und den Passwort-Reset-Test schützen (siehe `adminSessionLock.ts`).
    const releaseSessions = await holdAdminSessions('shared')
    await seedTestUser()
    // Anmeldung über die Local API statt über das Formular: Das Login-Rate-Limit (10 je 15 min und IP, ARCHITEKTUR
    // §8.5) gilt nur für HTTP-Anfragen; den Formular-Login prüfen `admin.e2e.spec.ts` und `loginViaForm`.
    const payload = await testPayload()
    const { token } = await withLoginLock(() =>
      payload.login({
        collection: 'users',
        data: { email: testUser.email, password: testUser.password },
      }),
    )
    if (!token) throw new Error('Anmeldung des Grund-Seed-Admins fehlgeschlagen.')
    await page.context().addCookies([
      {
        name: `${payload.config.cookiePrefix}-token`,
        value: token,
        url: serverURL,
        httpOnly: true,
        sameSite: 'Strict',
      },
    ])
    await page.goto(adminRoute)
    await expect(page.locator('.dashboard, [class*="dashboard"]').first()).toBeVisible()
    try {
      await provide(page)
    } finally {
      await releaseSessions()
    }
  },

  fixtureProducts: async ({}, provide, testInfo) => {
    const payload = await testPayload()
    const first = fixtureNumberBase(testInfo)
    const numbers = Array.from({ length: BLOCK_SIZE }, (_, i) => first + i)
    await removeFixtureProducts(payload, numbers)
    let fx: ProductFixtures | undefined
    let next = 0
    await provide({
      async create(category, overrides = {}) {
        if (next >= numbers.length) throw new Error('Fixture-Block erschöpft (980–999).')
        fx ??= await createProductFixtures(payload)
        const itemNumber = numbers[next++]!
        const doc = await payload.create({
          collection: 'products',
          data: { ...completeProduct(category, itemNumber, fx), seed: true, ...overrides } as never,
          overrideAccess: true,
          context: { seed: true },
        })
        return { id: doc.id as number, itemNumber }
      },
    })
    await removeFixtureProducts(payload, numbers)
  },
})

/** Pfad in der Verwaltung (ADMIN_ROUTE). */
export const adminPath = (p: string): string => `${adminRoute}${p}`
