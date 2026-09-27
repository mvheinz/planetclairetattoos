import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { formatBerlin } from '@/lib/time'

import { dbOf, deleteCommerce } from '../helpers/commerce'
import { deleteLegalTexts, ensureLegalTextFixtures, lexical } from '../helpers/legal'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P1.24: `inquiries`, `faqs`, `pages`, `revenue-entries` (DATENMODELL §6.17–§6.20, §13.4).

const NOW = '2026-10-15T09:00:00.000Z'
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

let payload: Payload

type Err = { message?: string; data?: { errors?: { message: string }[] } }
async function rejects(promise: Promise<unknown>, re: RegExp): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as Err,
  )
  expect(err, `erwartet Ablehnung mit ${re}`).not.toBeNull()
  const text = [err!.message ?? '', ...(err!.data?.errors ?? []).map((x) => x.message)].join(' | ')
  expect(text).toMatch(re)
}

async function wipe() {
  const db = dbOf(payload)
  for (const table of [
    'email_log',
    'inquiries',
    'faqs',
    '_faqs_v',
    'pages',
    '_pages_v',
    'revenue_entries',
  ]) {
    await db.execute(sql.raw(`DELETE FROM "${table}"`))
  }
  await db.execute(sql`DELETE FROM private_uploads WHERE purpose = 'commission_reference'`)
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await wipe()
  await deleteLegalTexts(payload)
  await ensureLegalTextFixtures(payload)
})

afterAll(async () => {
  await wipe()
  await deleteCommerce(payload)
  await deleteLegalTexts(payload)
})

describe('pages (DATENMODELL §6.19)', () => {
  it('ein zweites Dokument mit key = home wird abgelehnt; öffentlich nur veröffentlichte Fassung', async () => {
    const home = await payload.create({
      collection: 'pages',
      data: {
        key: 'home',
        title: 'Startseite',
        _status: 'published',
        layout: [
          { blockType: 'hero', heading: 'Planet Claire', cocoPose: 'run' },
          {
            blockType: 'station',
            stationId: 'shop',
            heading: 'Der Shop',
            link: { target: 'shop', label: 'Zum Shop' },
          },
          { blockType: 'richText', content: lexical('Hallo!') },
          { blockType: 'contactLinks', heading: 'Schreib mir' },
        ],
      } as never,
      overrideAccess: true,
    })
    expect(home.layout).toHaveLength(4)
    await rejects(
      payload.create({
        collection: 'pages',
        data: { key: 'home', title: 'Noch eine Startseite', _status: 'published' } as never,
        overrideAccess: true,
      }),
      /key|Seite/,
    )
    await rejects(
      payload.update({
        collection: 'pages',
        id: home.id,
        data: {
          layout: [
            {
              blockType: 'station',
              stationId: 'shop',
              heading: 'A',
              link: { target: 'shop', label: 'A' },
            },
            {
              blockType: 'station',
              stationId: 'shop',
              heading: 'B',
              link: { target: 'shop', label: 'B' },
            },
          ],
        } as never,
        overrideAccess: true,
      }),
      /gibt es schon/,
    )
    await payload.create({
      collection: 'pages',
      data: { key: 'about', title: 'Über mich', _status: 'draft' } as never,
      overrideAccess: true,
      draft: true,
    })
    const res = await rest('GET', '/pages?limit=50&depth=0')
    expect(res.status).toBe(200)
    const keys = ((await res.json()) as { docs: { key: string }[] }).docs.map((d) => d.key)
    expect(keys).toContain('home')
    expect(keys).not.toContain('about')
    expect((await rest('DELETE', `/pages/${home.id}`)).status).toBe(403)
  })
})

describe('faqs (DATENMODELL §6.18, §13.4)', () => {
  it('AK-SEED-17 (Teil) Speichern einer Seed-FAQ im Admin setzt seed = false', async () => {
    const faq = await payload.create({
      collection: 'faqs',
      data: {
        question: 'Wie lange heilt ein Tattoo?',
        answer: lexical('Etwa vier Wochen.'),
        seed: true,
        seedKey: 'faqs:heilung',
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    expect(faq.seed).toBe(true)
    // Seed-Lauf selbst bleibt Seed
    const again = await payload.update({
      collection: 'faqs',
      id: faq.id,
      data: { sortOrder: 20 },
      overrideAccess: true,
      context: { seed: true },
    })
    expect(again.seed).toBe(true)
    const adopted = await payload.update({
      collection: 'faqs',
      id: faq.id,
      data: { question: 'Wie lange heilt ein Tattoo ungefähr?', seed: true },
      overrideAccess: true,
    })
    expect(adopted).toMatchObject({ seed: false, seedKey: 'faqs:heilung' })
  })
})

describe('revenue-entries (DATENMODELL §6.20)', () => {
  const entry = (data: Record<string, unknown>, context: Record<string, unknown> = {}) =>
    payload.create({
      collection: 'revenue-entries',
      data: { month: '2026-09', source: 'tattoo', amountCents: 120000, ...data } as never,
      overrideAccess: true,
      context: { now: NOW, ...context },
    })

  it('doppelter echter Eintrag (2026-09, tattoo) wird abgelehnt; ein echter Eintrag ersetzt einen Seed-Eintrag', async () => {
    const sample = await entry(
      { source: 'flohmarkt', seed: true, amountCents: 5000 },
      { seed: true },
    )
    const real = await entry({ source: 'flohmarkt', amountCents: 7300 })
    expect(real.seed).toBe(false)
    const rows = await payload.find({
      collection: 'revenue-entries',
      where: { and: [{ month: { equals: '2026-09' } }, { source: { equals: 'flohmarkt' } }] },
      overrideAccess: true,
    })
    expect(rows.docs.map((d) => d.id)).toEqual([real.id])
    expect(rows.docs.map((d) => d.id)).not.toContain(sample.id)
    const audit = await payload.find({
      collection: 'audit-log',
      where: { entityCollection: { equals: 'revenue-entries' } },
      overrideAccess: true,
    })
    expect(audit.docs.some((a) => /Beispiel-Eintrag ersetzt/.test(a.summary))).toBe(true)

    await entry({})
    await rejects(entry({ amountCents: 1 }), /month|source|Monat|Quelle|unique|eindeutig|invalid/i)
    await rejects(entry({ month: '2026-11' }), /Zukunft/)
    await rejects(entry({ month: '2026-13' }), /JJJJ-MM/)
    await rejects(entry({ source: 'sonstiges', amountCents: 12.5 }), /Cent|Ganzzahl|ganze/i)
    expect((await rest('GET', '/revenue-entries')).status).toBe(403)
  })
})

describe('inquiries (DATENMODELL §6.17)', () => {
  const data = {
    reference: 'AA-2026-0001',
    name: 'Erika Beispiel',
    email: 'Erika@Example.com',
    idea: 'Eine Tasse mit meinem Hund im Planet-Claire-Stil, gern in Blau.',
    objectType: 'tasse',
    locale: 'de',
  }
  const create = (extra: Record<string, unknown> = {}, context: Record<string, unknown> = {}) =>
    payload.create({
      collection: 'inquiries',
      data: { ...data, ...extra } as never,
      overrideAccess: true,
      context: { system: true, now: NOW, ...context },
    })

  it('Anlage nur über den Server, deleteAfter = createdAt + 6 Monate (L-10), Bilder werden mitgelöscht', async () => {
    expect((await rest('POST', '/inquiries', data)).status).toBe(403)
    await rejects(
      payload.create({ collection: 'inquiries', data: data as never, overrideAccess: true }),
      /Anfrageformular/,
    )
    await rejects(create({ reference: 'AA-26-1' }), /AA-JJJJ-NNNN/)
    await rejects(create({ reference: 'AA-2026-0002', objectType: 'sonstiges' }), /Gegenstand/)

    const image = await payload.create({
      collection: 'private-uploads',
      data: { purpose: 'commission_reference' } as never,
      file: { data: PNG, name: 'idee.png', mimetype: 'image/png', size: PNG.length },
      overrideAccess: true,
      context: { system: true },
    })
    const inquiry = await create({ referenceImages: [image.id] })
    expect(inquiry.email).toBe('erika@example.com')
    expect(inquiry.status).toBe('new')
    expect(formatBerlin(new Date(inquiry.deleteAfter), 'dd.MM.yyyy HH:mm')).toBe(
      formatBerlin(new Date('2027-04-15T09:00:00.000Z'), 'dd.MM.yyyy HH:mm'),
    )
    expect(inquiry.privacyNoticeVersion).toBeTruthy()

    // Mail-Protokoll mit Bezug folgt der Frist der Anfrage
    const log = await payload.create({
      collection: 'email-log',
      data: {
        template: 'inquiry_receipt',
        to: 'erika@example.com',
        locale: 'de',
        subject: 'Deine Anfrage AA-2026-0001',
        inquiry: inquiry.id,
      } as never,
      overrideAccess: true,
    })
    expect(log.retainUntil).toBe(inquiry.deleteAfter)

    // Frist nur verkürzbar, Angaben und Status fest (Übergänge ab P7)
    await rejects(
      payload.update({
        collection: 'inquiries',
        id: inquiry.id,
        data: { deleteAfter: '2027-12-01T00:00:00.000Z' },
        overrideAccess: true,
      }),
      /nur verkürzt/,
    )
    await rejects(
      payload.update({
        collection: 'inquiries',
        id: inquiry.id,
        data: { idea: 'Doch lieber ein Teller mit Katze und Sternen.' },
        overrideAccess: true,
      }),
      /unveränderlich/,
    )
    await rejects(
      payload.update({
        collection: 'inquiries',
        id: inquiry.id,
        data: { status: 'in_progress' },
        overrideAccess: true,
      }),
      /Status/,
    )
    const moved = await payload.update({
      collection: 'inquiries',
      id: inquiry.id,
      data: { status: 'in_progress' },
      overrideAccess: true,
      context: { transition: 'I1', now: '2026-10-16T09:00:00.000Z' },
    })
    expect(moved.lastActivityAt).toBe('2026-10-16T09:00:00.000Z')
    expect(moved.deleteAfter).toBe(inquiry.deleteAfter)
    const audit = await payload.find({
      collection: 'audit-log',
      where: { action: { equals: 'inquiry_status_changed' } },
      overrideAccess: true,
    })
    expect(audit.docs[0]?.summary).toMatch(/AA-2026-0001: new → in_progress/)

    await payload
      .delete({
        collection: 'email-log',
        id: log.id,
        overrideAccess: true,
        context: { seed: true },
      })
      .catch(() => null)
    await dbOf(payload).execute(sql`DELETE FROM email_log`)
    await payload.delete({ collection: 'inquiries', id: inquiry.id, overrideAccess: true })
    const left = await payload.findByID({
      collection: 'private-uploads',
      id: image.id,
      overrideAccess: true,
      disableErrors: true,
    })
    expect(left).toBeNull()
  })

  it('anonymes Lesen von inquiries und privacy-requests ergibt 403', async () => {
    const inquiry = await create({ reference: 'AA-2026-0003' })
    expect((await rest('GET', '/inquiries')).status).toBe(403)
    expect((await rest('GET', `/inquiries/${inquiry.id}`)).status).toBe(403)
    expect((await rest('GET', '/privacy-requests')).status).toBe(403)
  })
})
