import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { revokeConformityDeclaration } from '@/lib/commerce/conformity'
import { transitionProduct } from '@/lib/commerce/productTransitions'

import { adminReq, resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P1.19 / R-044: Widerruf einer Konformitätserklärung (DATENMODELL §6.6.6, §6.13, DM-PROD-03).

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n40\n%%EOF\n',
)
const pdf = (name: string) => ({ data: PDF, name, mimetype: 'application/pdf', size: PDF.length })

let payload: Payload
let fx: ProductFixtures
let admin: PayloadRequest
let token: string
let labReport: number
let declarationPdf: number
let nr = 980

async function declaration(name: string): Promise<number> {
  const doc = await payload.create({
    collection: 'conformity-declarations',
    data: {
      name,
      labName: 'Prüflabor Berlin',
      labReportDate: '2026-08-01T00:00:00.000Z',
      labReport,
      declarationPdf,
      validFrom: '2026-09-01T00:00:00.000Z',
    } as never,
    overrideAccess: true,
  })
  return doc.id as number
}

async function foodSafe(declarations: number[], publish = true) {
  const p = await createProduct(
    payload,
    completeProduct('keramik', nr++, fx, {
      foodContact: 'lebensmittelecht',
      conformityDeclarations: declarations,
    }),
  )
  return publish ? transitionProduct(admin, p.id as number, 'publish') : p
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteProducts(payload)
  fx = await createProductFixtures(payload)
  const acc = await resetAdmin(payload, '198.51.100.43')
  token = acc.token
  admin = await adminReq(payload, acc.userId)
  labReport = (
    await payload.create({
      collection: 'private-uploads',
      data: { purpose: 'lab_report', complianceCategory: 'keramik' } as never,
      file: pdf('labor.pdf'),
      overrideAccess: true,
    })
  ).id as number
  declarationPdf = (
    await payload.create({
      collection: 'documents',
      data: { title: 'Konformitätserklärung', kind: 'conformity_declaration' } as never,
      file: pdf('erklaerung.pdf'),
      overrideAccess: true,
    })
  ).id as number
})

afterAll(async () => {
  await deleteProducts(payload)
})

describe('revokeConformityDeclaration (R-044)', () => {
  it('R-044 Widerruf nimmt betroffene Stücke offline, mit Audit und Mail-Zeile; Stück mit weiterer Erklärung bleibt online', async () => {
    const a = await declaration('Seladon blau')
    const b = await declaration('Klar glänzend')
    const only = await foodSafe([a])
    const both = await foodSafe([a, b])
    const draft = await foodSafe([a], false)
    const unrelated = await foodSafe([b])

    const res = await rest(
      'POST',
      `/conformity-declarations/${a}/revoke`,
      {},
      { authorization: `JWT ${token}` },
    )
    expect(res.status, await res.clone().text()).toBe(200)
    const result = (await res.json()) as {
      unpublished: number[]
      keptOnline: number[]
      emailLogId: number
    }
    expect(result.unpublished).toEqual([only.id])
    expect(result.keptOnline).toEqual([both.id])

    const get = (id: number) =>
      payload.findByID({ collection: 'products', id, depth: 0, overrideAccess: true })
    expect(await get(only.id)).toMatchObject({
      status: 'draft',
      adminAttention: { flag: true, reason: 'conformity_revoked' },
    })
    expect((await get(both.id)).status).toBe('available')
    expect((await get(draft.id)).status).toBe('draft')
    expect((await get(unrelated.id)).status).toBe('available')
    expect(
      (
        await payload.findByID({
          collection: 'conformity-declarations',
          id: a,
          overrideAccess: true,
        })
      ).status,
    ).toBe('revoked')

    const audit = await payload.find({
      collection: 'audit-log',
      where: {
        and: [
          { action: { equals: 'product_status_changed' } },
          { entityId: { equals: String(only.id) } },
        ],
      },
      sort: '-createdAt',
      overrideAccess: true,
    })
    expect(audit.docs[0]).toMatchObject({ actorType: 'system' })
    expect(audit.docs[0]!.summary).toMatch(/available → draft.*Seladon blau/)
    expect((audit.docs[0]!.changes as Record<string, unknown>).$transition).toBe('P3')

    const mail = await payload.findByID({
      collection: 'email-log',
      id: result.emailLogId,
      overrideAccess: true,
    })
    expect(mail).toMatchObject({ template: 'admin_alert', locale: 'de' })
    expect(mail.subject).toMatch(/Konformitätserklärung widerrufen – 1 Stück/)

    // Zweiter Widerruf derselben Erklärung: abgelehnt
    await expect(revokeConformityDeclaration(admin, a)).rejects.toThrow(/schon widerrufen/)
  })

  it('R-044 eine Erklärung mit verknüpften Stücken ist nicht löschbar; ohne Verknüpfung schon', async () => {
    const linked = await declaration('Matt weiß')
    await foodSafe([linked], false)
    await expect(
      payload.delete({ collection: 'conformity-declarations', id: linked, overrideAccess: true }),
    ).rejects.toThrow(/verknüpft/)
    const free = await declaration('Unbenutzt')
    await payload.delete({ collection: 'conformity-declarations', id: free, overrideAccess: true })
    await expect(
      payload.findByID({ collection: 'conformity-declarations', id: free, overrideAccess: true }),
    ).rejects.toThrow()
  })

  it('ohne Anmeldung: 403', async () => {
    const d = await declaration('Anonym')
    expect((await rest('POST', `/conformity-declarations/${d}/revoke`, {})).status).toBe(403)
  })
})
