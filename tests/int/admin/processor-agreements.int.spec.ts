import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { initialProcessorAgreements, type Obj } from '@/admin/views/settings/settingsAreas'
import { processorAgreementServices } from '@/lib/legal/services'

import { resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P6.21 – Einstellungen → „Auftragsverarbeitung“ (DIENSTE §6, DATENMODELL §7.1, R-155) über
// `POST /api/globals/settings/area` (Bereich `processorAgreements`): je Dienst mit `avv: required` eine Zeile, leere
// Zeilen werden nicht gespeichert, unbekannte Dienste und Nicht-https-Adressen abgelehnt.

let payload: Payload
let token: string
let snapshot: unknown

const load = async () =>
  (await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })) as unknown as Obj

async function save(v: unknown) {
  const res = await rest(
    'POST',
    '/globals/settings/area',
    { area: 'processorAgreements', values: v },
    { authorization: `JWT ${token}`, 'idempotency-key': crypto.randomUUID() },
  )
  return {
    status: res.status,
    json: (await res.json()) as { errors?: { path: string; message: string }[] },
  }
}

const services = () => processorAgreementServices().map((s) => ({ id: s.id, name: s.name }))

beforeAll(async () => {
  payload = await getTestPayload()
  ;({ token } = await resetAdmin(payload, '198.51.100.68'))
  snapshot = (await load()).processorAgreements
})

afterAll(async () => {
  await payload.updateGlobal({
    slug: 'settings',
    data: { processorAgreements: snapshot } as never,
    overrideAccess: true,
    context: { seed: true, skipAudit: true },
  })
})

describe('Auftragsverarbeitung (P6.21)', () => {
  it('R-155 Liste: Zeile je Dienst mit avv: required; Eintrag gespeichert, leere Zeilen nicht', async () => {
    const form = initialProcessorAgreements(services(), [])
    expect(form.rows.length).toBe(processorAgreementServices().length)
    const rows = form.rows.map((r) =>
      r.serviceId === 'stripe'
        ? {
            ...r,
            signedAt: '2026-11-02',
            documentVersion: 'SSA 2026',
            url: 'https://stripe.com/legal/dpa',
          }
        : r,
    )
    const r = await save({ rows })
    expect(r.status).toBe(200)
    const stored = (await load()).processorAgreements as Obj[]
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      serviceId: 'stripe',
      documentVersion: 'SSA 2026',
      url: 'https://stripe.com/legal/dpa',
    })
    expect(
      initialProcessorAgreements(services(), stored).rows.find((x) => x.serviceId === 'stripe'),
    ).toMatchObject({ signedAt: '2026-11-02', documentVersion: 'SSA 2026' })
  })

  it('R-155 unbekannter Dienst und http-Adresse abgelehnt', async () => {
    let r = await save({ rows: [{ serviceId: 'mailchimp', signedAt: '2026-11-02' }] })
    expect(r.status).toBe(400)
    r = await save({ rows: [{ serviceId: 'neon', url: 'http://neon.tech/dpa' }] })
    expect(r.status).toBe(400)
    expect((r.json.errors ?? []).map((e) => e.path).join(' ')).toMatch(/processorAgreements/)
  })
})
