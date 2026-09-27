import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CONFORMITY_REVOKE_TRANSITION } from '@/collections/ConformityDeclarations'

import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P1.15: Collection `conformity-declarations` (DATENMODELL §6.13, E-15, R-044 Teil).

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n40\n%%EOF\n',
)
const file = (name: string) => ({ data: PDF, name, mimetype: 'application/pdf', size: PDF.length })

let payload: Payload
let labReport: number
let otherUpload: number
let declarationPdf: number
let otherDoc: number
const declarations: number[] = []

async function rejects(promise: Promise<unknown>, re: RegExp): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as { message?: string; data?: { errors?: { message: string }[] } },
  )
  expect(err, `erwartet Ablehnung mit ${re}`).not.toBeNull()
  const text = [err!.message ?? '', ...(err!.data?.errors ?? []).map((x) => x.message)].join(' | ')
  expect(text).toMatch(re)
}

async function createDeclaration(data: Record<string, unknown> = {}, context = {}) {
  const doc = await payload.create({
    collection: 'conformity-declarations',
    data: {
      name: 'Seladon blau',
      glazeManufacturer: 'Botz',
      labName: 'Prüflabor Berlin',
      labReportDate: '2026-08-01T00:00:00.000Z',
      labReport,
      declarationPdf,
      validFrom: '2026-09-01T00:00:00.000Z',
      notes: 'Befund liegt im Ordner',
      ...data,
    } as never,
    overrideAccess: true,
    context,
  })
  declarations.push(doc.id as number)
  return doc
}

beforeAll(async () => {
  payload = await getTestPayload()
  const create = async (collection: 'private-uploads' | 'documents', data: object, name: string) =>
    (
      await payload.create({
        collection,
        data: data as never,
        file: file(name),
        overrideAccess: true,
      })
    ).id as number
  labReport = await create(
    'private-uploads',
    { purpose: 'lab_report', complianceCategory: 'keramik' },
    'labor.pdf',
  )
  otherUpload = await create(
    'private-uploads',
    { purpose: 'supplier_document', complianceCategory: 'keramik' },
    'lieferant.pdf',
  )
  declarationPdf = await create(
    'documents',
    { title: 'Konformitätserklärung Seladon', kind: 'conformity_declaration' },
    'erklaerung.pdf',
  )
  otherDoc = await create(
    'documents',
    { title: 'Pflegeanleitung', kind: 'aftercare_pdf' },
    'pflege.pdf',
  )
})

afterAll(async () => {
  for (const id of declarations) {
    await payload
      .delete({ collection: 'conformity-declarations', id, overrideAccess: true })
      .catch(() => null)
  }
  for (const id of [labReport, otherUpload]) {
    await payload
      .delete({ collection: 'private-uploads', id, overrideAccess: true })
      .catch(() => null)
  }
  for (const id of [declarationPdf, otherDoc]) {
    await payload.delete({ collection: 'documents', id, overrideAccess: true }).catch(() => null)
  }
})

describe('conformity-declarations (DATENMODELL §6.13)', () => {
  it('R-044 ein direktes update({ status: revoked }) ohne den Service wird abgelehnt', async () => {
    const doc = await createDeclaration()
    expect(doc.status).toBe('active')
    await rejects(
      payload.update({
        collection: 'conformity-declarations',
        id: doc.id,
        data: { status: 'revoked' } as never,
        overrideAccess: true,
      }),
      /widerrufen/,
    )
    // Auch mit Systemkontext, aber ohne die Übergangs-Kennung des Service
    await rejects(
      payload.update({
        collection: 'conformity-declarations',
        id: doc.id,
        data: { status: 'revoked' } as never,
        overrideAccess: true,
        context: { system: true },
      }),
      /widerrufen/,
    )
    // Der Service (P1.19) setzt die Übergangs-Kennung
    const revoked = await payload.update({
      collection: 'conformity-declarations',
      id: doc.id,
      data: { status: 'revoked' } as never,
      overrideAccess: true,
      context: { system: true, transition: CONFORMITY_REVOKE_TRANSITION },
    })
    expect(revoked.status).toBe('revoked')
    await rejects(
      payload.update({
        collection: 'conformity-declarations',
        id: doc.id,
        data: { status: 'active' } as never,
        overrideAccess: true,
        context: { system: true, transition: CONFORMITY_REVOKE_TRANSITION },
      }),
      /bleibt widerrufen/,
    )
    await rejects(createDeclaration({ status: 'revoked' }), /immer aktiv/)
  })

  it('öffentlich nur aktive Erklärungen, ohne Laborbericht, Labor und Notizen', async () => {
    const active = await createDeclaration({ name: 'Klar glänzend' })
    const res = await rest('GET', `/conformity-declarations/${active.id}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.name).toBe('Klar glänzend')
    expect(body.declarationPdf).toBeTruthy()
    expect(body.labReport).toBeUndefined()
    expect(body.labName).toBeUndefined()
    expect(body.notes).toBeUndefined()
    const revoked = await createDeclaration({ name: 'Alte Glasur' })
    await payload.update({
      collection: 'conformity-declarations',
      id: revoked.id,
      data: { status: 'revoked' } as never,
      overrideAccess: true,
      context: { system: true, transition: CONFORMITY_REVOKE_TRANSITION },
    })
    expect([403, 404]).toContain(
      (await rest('GET', `/conformity-declarations/${revoked.id}`)).status,
    )
    expect((await rest('POST', '/conformity-declarations', { name: 'x' })).status).toBe(403)
  })

  it('Laborbericht nur mit Zweck lab_report, Erklärung nur als PDF der Art conformity_declaration; Datum nicht in der Zukunft', async () => {
    await expect(createDeclaration({ labReport: otherUpload })).rejects.toThrow()
    await expect(createDeclaration({ declarationPdf: otherDoc })).rejects.toThrow()
    await rejects(createDeclaration({ labReportDate: '2099-01-01T00:00:00.000Z' }), /Zukunft/)
    await expect(createDeclaration({ labName: 'L' })).rejects.toThrow()
  })

  it('verwendete Dateien lassen sich nicht löschen (Erklärung aktiv, Laborbericht verknüpft)', async () => {
    await createDeclaration({ name: 'Weiß matt' })
    await rejects(
      payload.delete({ collection: 'documents', id: declarationPdf, overrideAccess: true }),
      /Konformitätserklärung/,
    )
    await rejects(
      payload.delete({ collection: 'private-uploads', id: labReport, overrideAccess: true }),
      /Konformitätserklärung/,
    )
  })
})
