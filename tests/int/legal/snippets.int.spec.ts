import { createLocalReq, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { LEGAL_SNIPPET_KEYS } from '@/lib/enums'
import { activateLegalSnippet } from '@/lib/legal/activate'
import { LEGAL_SNIPPET_SEED } from '@/lib/legal/snippetSeed'
import { getSnippet, loadLegalSnippets, sha256Text } from '@/lib/legal/snippets'

import { resetAdmin } from '../helpers/admin'
import { createOrder, orderData } from '../helpers/commerce'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P6.1: Collection `legal-snippets` (DATENMODELL §6.28, R-012, R-013) – Grund-Seed, Unveränderlichkeit, Aktivierung
// neuer Fassungen, `getSnippet` aus der Collection.

const NOW = '2026-10-10T10:00:00.000Z'
const KEY = 'checkout.legalNotice' as const

const h = shopHarness({ start: NOW, numbers: [981], tag: 'snippets' })
let payload: Payload
let adminId: number

type Err = { status?: number; message?: string; data?: { errors?: { message: string }[] } }
async function failure(promise: Promise<unknown>): Promise<Err> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as Err,
  )
  expect(err, 'erwartet Ablehnung').not.toBeNull()
  return err!
}
const messages = (e: Err) => [e.message ?? '', ...(e.data?.errors ?? []).map((x) => x.message)]

async function activeOf(key: string) {
  return payload.find({
    collection: 'legal-snippets',
    where: { and: [{ key: { equals: key } }, { status: { equals: 'active' } }] },
    locale: 'all',
    depth: 0,
    overrideAccess: true,
  })
}

beforeAll(async () => {
  payload = h.payload
  adminId = (await resetAdmin(payload)).userId
  await loadLegalSnippets(payload)
})

describe('R-012 Bausteine (legal-snippets)', () => {
  it('R-012 Bausteine DM-SNIP-01: nach seed:base jeder Schlüssel genau einmal aktiv, v1 mit Seed-Text, Herkunft und Hash', async () => {
    const all = await payload.find({
      collection: 'legal-snippets',
      where: { status: { equals: 'active' } },
      locale: 'all',
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    const keys = all.docs.map((d) => d.key)
    expect([...keys].sort()).toEqual([...LEGAL_SNIPPET_KEYS].sort())
    expect(new Set(keys).size).toBe(LEGAL_SNIPPET_KEYS.length)
    for (const doc of all.docs) {
      const seed = LEGAL_SNIPPET_SEED[doc.key]
      const text = doc.text as unknown as { de: string; en: string }
      expect(doc.version, doc.key).toBe(1)
      expect(text.de, doc.key).toBe(seed.de)
      expect(text.en, doc.key).toBe(seed.en)
      expect(doc.origin, doc.key).toBe(seed.origin)
      expect(doc.sha256De, doc.key).toBe(sha256Text(seed.de))
      expect(doc.sha256En, doc.key).toBe(sha256Text(seed.en))
      expect(new Date(doc.validFrom).toISOString()).toBe('2025-12-31T23:00:00.000Z')
    }
    // Ohne Arbeitsfassung: Platzhalter (DATENMODELL §6.28)
    for (const key of [
      'complaint.repairChoice',
      'inquiry.autoReply',
      'commission.offer',
      'privacyRequest.accessResponse',
      'privacyRequest.erasureResponse',
    ] as const) {
      const doc = all.docs.find((d) => d.key === key)!
      expect(doc.origin).toBe('placeholder')
      expect((doc.text as unknown as { de: string }).de).toBe(
        key === 'commission.offer'
          ? LEGAL_SNIPPET_SEED[key].de
          : 'PLATZHALTER – Text folgt von der Kanzlei.',
      )
      expect((doc.text as unknown as { de: string }).de).toMatch(/^PLATZHALTER – /)
    }
    // getSnippet liest jetzt die Collection (Version „1“ statt der P3-Konstante „draft-1“)
    const s = getSnippet(KEY, 'de')
    expect(s.version).toBe('1')
    expect(s.sha256).toBe(sha256Text(LEGAL_SNIPPET_SEED[KEY].de))
  })

  it('R-012 Bausteine T-15: anonym nur aktive Fassungen lesbar, Entwürfe nicht; complaints anonym 403', async () => {
    const draft = await payload.create({
      collection: 'legal-snippets',
      data: {
        key: 'price.shippingNote',
        validFrom: NOW,
        text: 'zzgl. Versand (Entwurf)',
        origin: 'draft',
      } as never,
      overrideAccess: true,
      context: { now: NOW },
    })
    expect(draft.status).toBe('draft')
    expect(draft.version).toBe(2)
    const res = await rest('GET', '/legal-snippets?depth=0&pagination=false&limit=0')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { docs: { id: number; status: string }[] }
    expect(body.docs.length).toBe(LEGAL_SNIPPET_KEYS.length)
    expect(body.docs.every((d) => d.status === 'active')).toBe(true)
    expect([403, 404]).toContain((await rest('GET', `/legal-snippets/${draft.id}`)).status)
    expect((await rest('GET', '/complaints')).status).toBe(403)
    expect((await rest('POST', '/complaints', {})).status).toBe(403)
    await payload.delete({ collection: 'legal-snippets', id: draft.id, overrideAccess: true })
  })

  it('R-012 Bausteine DM-SNIP-02: aktive Fassung Update → 403; v2 aktivieren → v1 superseded; Bestellung behält v1', async () => {
    const v1 = (await activeOf(KEY)).docs[0]!
    const user = await payload.findByID({ collection: 'users', id: adminId, overrideAccess: true })

    // Verwaltung: aktive Fassung nicht änderbar (403), auch nicht löschbar
    const forbidden = await failure(
      payload.update({
        collection: 'legal-snippets',
        id: v1.id,
        data: { text: 'Heimlich geändert' },
        user: { ...user, collection: 'users' } as never,
        overrideAccess: false,
      }),
    )
    expect(forbidden.status).toBe(403)
    // Auch mit Systemzugriff lehnt der Hook jede Inhaltsänderung ab
    const immutable = await failure(
      payload.update({
        collection: 'legal-snippets',
        id: v1.id,
        data: { changeNote: 'nachträglich' },
        overrideAccess: true,
        context: { now: NOW },
      }),
    )
    expect(messages(immutable).join(' ')).toMatch(/unveränderlich/)
    expect(
      (
        await failure(
          payload.delete({ collection: 'legal-snippets', id: v1.id, overrideAccess: true }),
        )
      ).message,
    ).toMatch(/Nur Entwürfe/)

    // Bestellung mit der Fassung v1 (R-013)
    const shown = getSnippet(KEY, 'de')
    const order = await createOrder(
      payload,
      orderData(98101, [{ id: await h.piece(981), itemNumber: 981 }], {
        legalSnippetVersions: { [KEY]: { version: shown.version, sha256: shown.sha256 } },
      }),
    )

    // Unbekannte Tokens im Entwurf werden schon beim Speichern abgelehnt (nur R-012 + Kontext der Arbeitsfassung)
    const badToken = await failure(
      payload.create({
        collection: 'legal-snippets',
        data: {
          key: KEY,
          validFrom: NOW,
          text: 'Es gelten die AGB von {{STEUERNUMMER}}.',
          origin: 'draft',
        } as never,
        overrideAccess: true,
        context: { now: NOW },
      }),
    )
    expect(messages(badToken).join(' ')).toMatch(/Unbekannte Platzhalter.*STEUERNUMMER/)

    const v2 = await payload.create({
      collection: 'legal-snippets',
      locale: 'de',
      data: {
        key: KEY,
        validFrom: NOW,
        text: 'Es gelten unsere AGB (Fassung 2).',
        origin: 'draft',
        changeNote: 'Test-Fassung 2',
      } as never,
      overrideAccess: true,
      context: { now: NOW },
    })
    expect(v2.version).toBe(2)
    const req = await createLocalReq({ context: { now: NOW } }, payload)
    const res = await activateLegalSnippet(req, v2.id)
    expect(res).toMatchObject({ id: v2.id, key: KEY, status: 'active', supersededId: v1.id })

    const before = await payload.findByID({
      collection: 'legal-snippets',
      id: v1.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(before.status).toBe('superseded')
    expect(before.supersededAt).toBe(NOW)
    const after = await payload.findByID({
      collection: 'legal-snippets',
      id: v2.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(after.status).toBe('active')
    expect(after.activatedAt).toBe(NOW)
    expect(after.sha256De).toBe(sha256Text('Es gelten unsere AGB (Fassung 2).'))
    expect((await activeOf(KEY)).totalDocs).toBe(1)

    // Audit-Einträge der Aktivierung
    const audits = await payload.find({
      collection: 'audit-log',
      where: { entityCollection: { equals: 'legal-snippets' } },
      depth: 0,
      overrideAccess: true,
    })
    const actions = audits.docs.map((a) => a.action)
    expect(actions).toContain('legal_snippet_activated')
    expect(actions).toContain('legal_snippet_superseded')

    // getSnippet: jetzt v2; zum früheren Zeitpunkt weiter v1
    await loadLegalSnippets(payload)
    expect(getSnippet(KEY, 'de')).toMatchObject({
      text: 'Es gelten unsere AGB (Fassung 2).',
      version: '2',
    })
    // ohne EN-Text gilt der deutsche Text (E-61)
    expect(getSnippet(KEY, 'en').text).toBe('Es gelten unsere AGB (Fassung 2).')
    expect(getSnippet(KEY, 'de', {}, new Date('2026-06-01T00:00:00Z'))).toMatchObject({
      version: '1',
      text: LEGAL_SNIPPET_SEED[KEY].de,
    })

    // Die Bestellung verweist unverändert auf v1
    const stored = await payload.findByID({
      collection: 'orders',
      id: order.id,
      depth: 0,
      overrideAccess: true,
    })
    expect((stored.legalSnippetVersions as Record<string, { version: string }>)[KEY]).toEqual({
      version: '1',
      sha256: sha256Text(LEGAL_SNIPPET_SEED[KEY].de),
    })

    // Eine aktive Fassung lässt sich nicht erneut aktivieren
    expect((await failure(activateLegalSnippet(req, v2.id))).message).toMatch(
      /Nur Entwürfe und geplante/,
    )
  })
})
