import { createLocalReq } from 'payload'
import { describe, expect, it } from 'vitest'

import { rotateStatusToken } from '@/lib/commerce/statusToken'
import { handleOrderDocument, STATUS_PAGE_INVOICE_DOWNLOAD } from '@/lib/commerce/tokenPages'
import { createToken } from '@/lib/security/tokens'
import type { Invoice, LegalText } from '@/payload-types'

import { shopHarness } from '../helpers/shop'

// P4.23 – `GET /api/orders/[token]/documents/[file]` (ARCHITEKTUR §2.5, §8.3, R-067, C-24): zu gültigem Status-Token
// nur die beiden Rechtstext-PDFs der Bestellung (in ihrer Fassung); Rechnung, Gutschrift und alles andere → 404; falscher
// Token → 404; Belegtypen per Konstante gesperrt.

const NUMBERS = [995, 996]
const h = shopHarness({ start: '2026-10-09T10:00:00.000Z', numbers: NUMBERS, tag: 'docs' })

const get = (token: string, file: string) =>
  handleOrderDocument(
    new Request(`http://localhost/api/orders/${token}/documents/${file}`, {
      headers: { 'x-forwarded-for': '198.51.100.99' },
    }),
    token,
    file,
    h.now(),
    { payload: h.payload },
  )

async function paidOrderWithToken() {
  const id = await h.piece(995)
  const s = await h.submitted([id])
  await h.deliver(s.session!, 'checkout.session.completed')
  const order = await h.orderOfCheckout(s.checkoutId)
  const req = await createLocalReq({ context: { system: true } }, h.payload)
  const token = await rotateStatusToken(req, order.id, { now: h.now(), reason: 'resend' })
  const version = async (id: number): Promise<number> => {
    const doc = (await h.payload.findByID({
      collection: 'legal-texts',
      id,
      depth: 0,
      overrideAccess: true,
    })) as LegalText
    return Number(doc.version)
  }
  const idOf = (v: unknown) => (typeof v === 'object' && v ? (v as { id: number }).id : Number(v))
  return {
    order: await h.order(order.id),
    token,
    agb: await version(idOf(order.legalTextVersions.agb)),
    belehrung: await version(idOf(order.legalTextVersions.widerrufsbelehrung)),
  }
}

describe('Dokument-Route der Statusseite (P4.23)', () => {
  it('Konstante: Belege sind gesperrt (C-24)', () => {
    expect(STATUS_PAGE_INVOICE_DOWNLOAD).toBe(false)
  })

  it('DM-ORD-10 gültiger Token: 200 für AGB und Widerrufsbelehrung inkl. Formular in der Fassung der Bestellung', async () => {
    const { token, agb, belehrung } = await paidOrderWithToken()
    for (const file of [`AGB_v${agb}.pdf`, `Widerrufsbelehrung-und-Formular_v${belehrung}.pdf`]) {
      const res = await get(token, file)
      expect(res.status, file).toBe(200)
      expect(res.headers.get('content-type')).toBe('application/pdf')
      expect(res.headers.get('cache-control')).toBe('private, no-store')
      expect(res.headers.get('referrer-policy')).toBe('no-referrer')
      expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
      expect(res.headers.get('content-disposition')).toContain(file)
      const body = Buffer.from(await res.arrayBuffer())
      expect(body.subarray(0, 5).toString()).toBe('%PDF-')
    }
  })

  it('R-067 jeder andere Dateiname → 404, auch Rechnung und Gutschrift derselben Bestellung; falscher Token → 404', async () => {
    const { order, token, agb } = await paidOrderWithToken()
    const invoiceId = typeof order.invoice === 'object' ? order.invoice?.id : order.invoice
    expect(invoiceId).toBeTruthy()
    const invoice = (await h.payload.findByID({
      collection: 'invoices',
      id: invoiceId!,
      depth: 0,
      overrideAccess: true,
    })) as Invoice
    const year = invoice.number.split('-').at(-2)
    for (const file of [
      `${invoice.number}.pdf`,
      `GS-${year}-00001.pdf`,
      `AGB_v${agb + 1}.pdf`,
      `AGB_v${agb}_EN.pdf`,
      'Datenschutz_v1.pdf',
      '../AGB_v1.pdf',
      'rechnung.pdf',
    ]) {
      expect((await get(token, file)).status, file).toBe(404)
    }
    expect((await get(createToken(), `AGB_v${agb}.pdf`)).status).toBe(404)
    expect((await get('kaputt', `AGB_v${agb}.pdf`)).status).toBe(404)
  })

  it('DM-ORD-04 die DB enthält keinen Klartext-Token (nur Hash und Siegel)', async () => {
    const { order, token } = await paidOrderWithToken()
    const raw = JSON.stringify(order)
    expect(raw).not.toContain(token)
    expect(order.statusTokenHash).toMatch(/^[0-9a-f]{64}$/)
  })
})
