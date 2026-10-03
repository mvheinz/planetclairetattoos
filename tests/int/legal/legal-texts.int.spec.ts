import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { activateLegalText, checkLegalText } from '@/lib/legal/activate'
import { getActiveLegalText } from '@/lib/legal/getActive'
import {
  buildLegalTokenValues,
  LegalRenderError,
  renderLegalContent,
  renderLegalString,
  type LegalTokenSettings,
} from '@/lib/legal/render'

import { resetAdmin } from '../helpers/admin'
import { deleteCommerce } from '../helpers/commerce'
import { deleteLegalTexts, lexical } from '../helpers/legal'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P1.22: Collection `legal-texts`, Aktivierung, Renderer (DATENMODELL §6.12, R-002, R-012).

const NOW = '2026-10-01T10:00:00.000Z'
const LATER = '2026-11-01T10:00:00.000Z'
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n40\n%%EOF\n',
)

let payload: Payload
const documents: number[] = []

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

const ctx = (now = NOW) => ({ now })

async function draft(data: Record<string, unknown> = {}, now = NOW) {
  return payload.create({
    collection: 'legal-texts',
    data: {
      type: 'agb',
      validFrom: now,
      origin: 'draft',
      content: lexical('§ 1 Geltungsbereich', 'Anbieter: {{name}}'),
      ...data,
    } as never,
    overrideAccess: true,
    context: ctx(now),
  })
}

async function activate(id: number, now = NOW) {
  const req = await createLocalReq({ context: ctx(now) }, payload)
  return activateLegalText(req, id, {})
}

const byId = (id: number) =>
  payload.findByID({ collection: 'legal-texts', id, depth: 0, overrideAccess: true })

async function activeCount(type: string): Promise<number> {
  const res = await payload.count({
    collection: 'legal-texts',
    where: { and: [{ type: { equals: type } }, { status: { equals: 'active' } }] },
    overrideAccess: true,
  })
  return res.totalDocs
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteLegalTexts(payload)
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteLegalTexts(payload)
  for (const id of documents) {
    await payload
      .delete({ collection: 'documents', id, overrideAccess: true, context: { seed: true } })
      .catch(() => null)
  }
})

describe('legal-texts (DATENMODELL §6.12)', () => {
  it('DM-LEG-01 Aktivierung von AGB v2 setzt v1 auf superseded; genau eine aktive Fassung je Typ', async () => {
    const v1 = await draft()
    expect(v1).toMatchObject({
      version: 1,
      status: 'draft',
      versionLabel: 'v1 · gültig ab 01.10.2026',
    })
    expect(await activeCount('agb')).toBe(0)
    expect(await activate(v1.id)).toMatchObject({ status: 'active', supersededId: null })
    expect(await byId(v1.id)).toMatchObject({ status: 'active', activatedAt: NOW })
    expect((await byId(v1.id)).contentSha256De).toMatch(/^[0-9a-f]{64}$/)
    expect(await activeCount('agb')).toBe(1)

    const v2 = await draft({ changeNote: 'Versandkosten ergänzt' })
    expect(v2.version).toBe(2)
    expect(await activeCount('agb')).toBe(1)
    const res = await activate(v2.id)
    expect(res).toMatchObject({ status: 'active', supersededId: v1.id })
    expect(await byId(v1.id)).toMatchObject({ status: 'superseded', supersededAt: NOW })
    expect(await byId(v2.id)).toMatchObject({ status: 'active' })
    expect(await activeCount('agb')).toBe(1)

    // Audit legal_text_activated / legal_text_superseded
    const audits = await payload.find({
      collection: 'audit-log',
      where: { entityCollection: { equals: 'legal-texts' } },
      overrideAccess: true,
      limit: 20,
    })
    const actions = audits.docs.map((a) => a.action)
    expect(actions).toContain('legal_text_activated')
    expect(actions).toContain('legal_text_superseded')

    // Gültige Fassung zu einem Zeitpunkt
    expect((await getActiveLegalText('agb', new Date(LATER), { payload }))?.id).toBe(v2.id)
    expect(
      await getActiveLegalText('agb', new Date('2026-09-01T00:00:00Z'), { payload }),
    ).toBeNull()
  })

  it('R-012 künftige Fassung wird „geplant“, Status nur über den Service, validFrom ≥ jetzt − 1 min', async () => {
    const future = await draft({ type: 'datenschutz', validFrom: LATER })
    expect(await activate(future.id)).toMatchObject({ status: 'scheduled' })
    expect(await activeCount('datenschutz')).toBe(0)
    // später: Aktivierung aus „geplant“
    expect(await activate(future.id, LATER)).toMatchObject({ status: 'active' })

    await rejects(
      draft({ type: 'datenschutz', validFrom: '2026-10-01T09:58:00.000Z' }),
      /Vergangenheit/,
    )
    const ok = await draft({ type: 'datenschutz', validFrom: '2026-10-01T09:59:30.000Z' })
    expect(ok.status).toBe('draft')
    await rejects(draft({ type: 'datenschutz', status: 'active' }), /beginnen als Entwurf/)
    await rejects(
      payload.update({
        collection: 'legal-texts',
        id: ok.id,
        data: { status: 'active' },
        overrideAccess: true,
        context: ctx(),
      }),
      /Fassung aktivieren/,
    )
    await rejects(activate(future.id, LATER), /Nur Entwürfe/)
  })

  it('DM-LEG-03 Inhaltsänderung an einer aktiven (und abgelösten) Fassung wird abgelehnt', async () => {
    const d = await draft({ type: 'widerrufsbelehrung', content: lexical('{{withdrawalUrl}}') })
    // Entwurf ist änderbar
    const edited = await payload.update({
      collection: 'legal-texts',
      id: d.id,
      data: { content: lexical('Neuer Entwurf', 'Widerruf über {{withdrawalUrl}}') },
      overrideAccess: true,
      context: ctx(),
    })
    expect(edited.status).toBe('draft')
    await activate(d.id)
    for (const data of [
      { content: lexical('Heimlich geändert') },
      { changeNote: 'nachträglich' },
      { validFrom: LATER },
      { origin: 'lawyer' },
      { type: 'agb' },
    ]) {
      await rejects(
        payload.update({
          collection: 'legal-texts',
          id: d.id,
          data: data as never,
          overrideAccess: true,
          context: ctx(),
        }),
        /unveränderlich|Unveränderlich/,
      )
    }
    // auch nicht mit Service-Kontext
    await rejects(
      payload.update({
        collection: 'legal-texts',
        id: d.id,
        data: { content: lexical('über Service') } as never,
        overrideAccess: true,
        context: { ...ctx(), system: true, transition: 'activateLegalText' },
      }),
      /unveränderlich/,
    )
    // Löschen nur für Entwürfe
    await rejects(
      payload.delete({ collection: 'legal-texts', id: d.id, overrideAccess: true }),
      /Nur Entwürfe/,
    )
    const other = await draft({ type: 'widerrufsbelehrung' })
    await payload.delete({ collection: 'legal-texts', id: other.id, overrideAccess: true })
  })

  it('DM-DOC-01 das PDF einer abgelösten Fassung ist nicht löschbar', async () => {
    const pdf = async (kind: string, name: string) => {
      const doc = await payload.create({
        collection: 'documents',
        data: { title: `Rechtstext ${name}`, kind, language: 'de' } as never,
        file: { data: PDF, name, mimetype: 'application/pdf', size: PDF.length },
        overrideAccess: true,
      })
      documents.push(doc.id as number)
      return doc.id as number
    }
    const v1 = await draft({ type: 'widerrufsformular' })
    await activate(v1.id)
    // PDF per Job-Weg (Service-Kontext) anhängen: legal_text_pdf und ein zweites als „other“ (Verweis-Sperre)
    const pdfDe = await pdf('legal_text_pdf', 'formular-v1.pdf')
    const pdfEn = await pdf('other', 'formular-v1-en.pdf')
    await payload.update({
      collection: 'legal-texts',
      id: v1.id,
      data: { pdfDe, pdfEn },
      overrideAccess: true,
      context: { ...ctx(), system: true, transition: 'activateLegalText' },
    })
    const v2 = await draft({ type: 'widerrufsformular' })
    await activate(v2.id)
    expect((await byId(v1.id)).status).toBe('superseded')
    await rejects(
      payload.delete({ collection: 'documents', id: pdfDe, overrideAccess: true }),
      /aufbewahrt/,
    )
    await rejects(
      payload.delete({ collection: 'documents', id: pdfEn, overrideAccess: true }),
      /Rechtstext/,
    )
  })

  it('DM-LEG-04 Tokens: {{name}} und {{withdrawalUrl}} ersetzt, unbekannte brechen ab; origin ⇔ isPlaceholder (R-002)', async () => {
    const settings: LegalTokenSettings = {
      business: {
        legalName: 'Jutta Beispiel',
        tradeName: 'Planet Claire Tattoos',
        street: 'Musterstraße 1',
        postalCode: '10115',
        city: 'Berlin',
        email: 'jutta@planetclairetattoos.com',
        phone: '+49 30 1234567',
        economicId: null,
        vatId: null,
      },
      shipping: {
        rates: [
          { zone: 'DE', shippingClass: 'brief', priceCents: 250 },
          { zone: 'EU', shippingClass: 'brief', priceCents: 600 },
          { zone: 'DE', shippingClass: 'keramik', priceCents: 890 },
        ],
        pickupEnabled: true,
        pickupCity: 'Berlin',
        deliveryTimeText: '3–5 Werktage',
      },
      payment: { prepaymentDays: 7 },
    }
    const siteUrl = 'https://planetclairetattoos.com'
    const de = buildLegalTokenValues({ settings, siteUrl, locale: 'de' })
    const en = buildLegalTokenValues({ settings, siteUrl, locale: 'en' })
    expect(renderLegalString('Anbieter: {{name}}', de)).toBe(
      'Anbieter: Jutta Beispiel, Planet Claire Tattoos',
    )
    expect(renderLegalString('{{withdrawalUrl}}', de)).toBe(
      'https://planetclairetattoos.com/de/vertrag-widerrufen',
    )
    expect(renderLegalString('{{withdrawalUrl}}', en)).toBe(
      'https://planetclairetattoos.com/en/withdraw-from-contract',
    )
    expect(
      renderLegalString('{{street}}, {{postalCode}} {{city}} · {{email}} · {{phone}}', de),
    ).toBe('Musterstraße 1, 10115 Berlin · jutta@planetclairetattoos.com · +49 30 1234567')
    expect(renderLegalString('{{siteUrl}} · {{deliveryTime}} · {{vorkasseDays}}', de)).toBe(
      'https://planetclairetattoos.com · 3–5 Werktage · 7',
    )
    // Nur W-IdNr./USt-IdNr. dürfen leer sein
    expect(renderLegalString('W-IdNr.: {{wIdNr}}; USt-IdNr.: {{ustIdNr}}', de)).toBe(
      'W-IdNr.: ; USt-IdNr.: ',
    )
    expect(renderLegalString('{{shippingTable}}', de).replace(/\u00a0/g, ' ')).toBe(
      [
        'Brief: 2,50 €',
        'Keramik-Paket: 8,90 €',
        'Abholung in Berlin: kostenlos',
        'Bestellst du mehrere Stücke, gilt der Preis der höchsten Versandklasse.',
      ].join('\n'),
    )
    for (const bad of [
      '{{unknown}}',
      '{{business.street}}',
      '{{STEUERNUMMER}}',
      '{{ name }}',
      '{{name',
    ]) {
      expect(() => renderLegalString(`Text ${bad}`, de), bad).toThrow(LegalRenderError)
    }
    // unersetzt: ohne Wert (z. B. Baustein fehlt, Telefon leer)
    expect(() => renderLegalString('{{returnCostsNote}}', de)).toThrow(/ohne Wert/)
    expect(
      renderLegalString('{{returnCostsNote}}', {
        ...de,
        returnCostsNote: 'Rücksendekosten trägst du.',
      }),
    ).toBe('Rücksendekosten trägst du.')
    const noPhone = buildLegalTokenValues({
      settings: { ...settings, business: { ...settings.business, phone: '' } },
      siteUrl,
      locale: 'de',
    })
    expect(() => renderLegalString('{{phone}}', noPhone)).toThrow(/ohne Wert/)

    // Lexical: Tokens in Textknoten, mehrzeilige Werte als Zeilenumbrüche, Hash über den Klartext
    const r = renderLegalContent(lexical('Anbieter: {{name}}', '{{shippingTable}}'), de)
    expect(r.plainText).toContain('Anbieter: Jutta Beispiel, Planet Claire Tattoos')
    expect(r.plainText).toMatch(/Keramik-Paket: 8,90\s€/)
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(() => renderLegalContent(lexical('{{STEUERNUMMER}}'), de)).toThrow(LegalRenderError)

    // Aktivieren ist bei Render-Fehlern gesperrt
    const bad = await draft({
      type: 'versand-zahlung',
      content: lexical('Steuernr. {{STEUERNUMMER}}'),
    })
    await rejects(activate(bad.id), /unbekannte Platzhalter/)
    expect((await byId(bad.id)).status).toBe('draft')

    // origin ⇔ isPlaceholder (R-002)
    const ph = await draft({ type: 'impressum', origin: 'placeholder' })
    expect(ph.isPlaceholder).toBe(true)
    const moved = await payload.update({
      collection: 'legal-texts',
      id: ph.id,
      data: { origin: 'lawyer', isPlaceholder: true },
      overrideAccess: true,
      context: ctx(),
    })
    expect(moved.isPlaceholder).toBe(false)
    const back = await payload.update({
      collection: 'legal-texts',
      id: ph.id,
      data: { origin: 'placeholder' },
      overrideAccess: true,
      context: ctx(),
    })
    expect(back.isPlaceholder).toBe(true)
  })

  it('R-012 öffentlich lesbar nur veröffentlichte und abgelöste Fassungen', async () => {
    const res = await rest('GET', '/legal-texts?limit=100&depth=0')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { docs: { status: string }[] }
    expect(body.docs.length).toBeGreaterThan(0)
    for (const d of body.docs) expect(['active', 'superseded']).toContain(d.status)
    expect((await rest('POST', '/legal-texts', { type: 'agb' })).status).toBe(403)
  })
})

describe('R-012 Renderer, Prüfungen und Aktivierung (P6.3)', () => {
  const errorText = (e: unknown) => {
    const err = e as Err & { status?: number }
    return [err.message ?? '', ...(err.data?.errors ?? []).map((x) => x.message)].join(' | ')
  }

  it('R-012 v1 aktivieren, Update → 403; v2 aktivieren → v1 superseded; contentSha256De stimmt', async () => {
    const { userId } = await resetAdmin(payload)
    const user = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
    const v1 = await draft({ type: 'datenschutz', content: lexical('Verantwortlich: {{name}}') })
    await activate(v1.id)
    const err = await payload
      .update({
        collection: 'legal-texts',
        id: v1.id,
        data: { changeNote: 'nachträglich' },
        user: { ...user, collection: 'users' } as never,
        overrideAccess: false,
      })
      .then(
        () => null,
        (e: unknown) => e as { status?: number },
      )
    expect(err?.status).toBe(403)

    const v2 = await draft({ type: 'datenschutz', content: lexical('Neu: {{name}}, {{city}}') })
    const res = await activate(v2.id)
    expect(res).toMatchObject({ status: 'active', supersededId: v1.id })
    expect((await byId(v1.id)).status).toBe('superseded')
    const active = await byId(v2.id)
    const req = await createLocalReq({ context: ctx() }, payload)
    const values = await (await import('@/lib/legal/render')).loadLegalTokenValues(req, 'de')
    const rendered = renderLegalContent(active.content as never, values)
    expect(active.contentSha256De).toBe(rendered.sha256)
    expect(rendered.plainText).not.toMatch(/\{\{/)
  })

  it('R-012 {{unknown}}, {{NAME}}, {{processorTable}} oder {{STEUERNUMMER}} → Render-Fehler, Veröffentlichen gesperrt', async () => {
    for (const bad of ['{{unknown}}', '{{NAME}}', '{{processorTable}}', '{{STEUERNUMMER}}']) {
      const d = await draft({ type: 'agb', content: lexical(`Text ${bad}`) })
      const e = await activate(d.id).then(
        () => null,
        (x: unknown) => x,
      )
      expect(e, bad).not.toBeNull()
      expect(errorText(e)).toMatch(/unbekannte Platzhalter/)
      expect((await byId(d.id)).status).toBe('draft')
      await payload.delete({ collection: 'legal-texts', id: d.id, overrideAccess: true })
    }
  })

  it('R-095/V-01/V-02 Prüfungen vor dem Veröffentlichen: Widerrufs-URL Pflicht, OS-Link und Steuerhinweis im KU-Modus gesperrt', async () => {
    const req = await createLocalReq({ context: ctx() }, payload)
    const check = (type: string, ...paragraphs: string[]) =>
      checkLegalText(req, {
        type: type as never,
        validFrom: NOW,
        content: { de: lexical(...paragraphs) },
      })

    expect((await check('widerrufsbelehrung', 'Widerrufsrecht')).errors.join(' ')).toMatch(
      /withdrawalUrl/,
    )
    expect((await check('widerrufsbelehrung', 'Online: {{withdrawalUrl}}')).errors).toEqual([])
    // feste R26-Adresse statt Token ist ebenfalls zulässig
    const url = `${(await import('@/lib/env')).getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '')}/de/vertrag-widerrufen`
    expect((await check('widerrufsbelehrung', `Online: ${url}`)).errors).toEqual([])
    expect(
      (await check('impressum', 'Plattform: https://ec.europa.eu/consumers/odr')).errors.join(' '),
    ).toMatch(/OS-Plattform/)
    expect((await check('agb', 'Alle Preise inkl. MwSt.')).errors.join(' ')).toMatch(/V-02/)
    // Fehlerliste ohne zu speichern (Vorschau P6.4)
    expect((await check('agb', 'Text {{unknown}}')).errors.join(' ')).toMatch(/unknown/)
  })

  it('R-012 activateLegalText mit validFrom: in der Zukunft geplant, sonst sofort aktiv', async () => {
    const d = await draft({
      type: 'versand-zahlung',
      content: lexical('Lieferzeit {{deliveryTime}}'),
    })
    const req = await createLocalReq({ context: ctx() }, payload)
    const res = await activateLegalText(req, d.id, { validFrom: new Date(LATER) })
    expect(res.status).toBe('scheduled')
    const doc = await byId(d.id)
    expect(doc.status).toBe('scheduled')
    expect(new Date(doc.validFrom).toISOString()).toBe(LATER)
  })
})
