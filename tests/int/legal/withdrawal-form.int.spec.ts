import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { __setEmailAdapterForTests, clearMemoryOutbox, createEmailAdapter } from '@/lib/email'
import { parseEnv } from '@/lib/env'
import {
  initialWithdrawalState,
  signWithdrawalToken,
  verifyWithdrawalToken,
  withdrawalStep,
  WITHDRAWAL_FORM_TOKEN_TTL_MS,
  type WithdrawalFlowState,
} from '@/lib/legal/withdrawalForm'

import { createOrder, dbOf, deleteCommerce, orderData, type ItemInput } from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P6.8 – Ablauf der Widerrufsfunktion R26 (KONZEPT §3.16, R-091, R-092, R-137): Schritt 1 → Auswahl → Schritt 2 →
// Ergebnis über `withdrawalStep` (die Server Action ist nur eine Hülle). Eingaben reisen im signierten Token.

const NUMBERS = [985, 986]
const EMAIL = 'formular@planetclaire.local'
const NOW = new Date('2026-10-12T12:03:27.000Z')
let payload: Payload
let restoreBusiness: () => Promise<void>
let items: ItemInput[] = []
let orderNumber = ''
let ipSeq = 0

const fd = (entries: Record<string, string | string[]>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) {
    for (const x of Array.isArray(v) ? v : [v]) f.append(k, x)
  }
  return f
}
const ctx = (now = NOW) => ({ now, locale: 'de' as const, ip: `198.51.100.${++ipSeq}`, payload })
const step1 = (over: Record<string, string> = {}) =>
  fd({
    locale: 'de',
    stage: 'form',
    intent: 'next',
    name: 'Erika Formular',
    contractIdentification: 'Bestellung vom 12.10., Schale',
    email: EMAIL,
    itemsText: '',
    reason: '',
    website: '',
    ...over,
  })

async function count(email = EMAIL): Promise<number> {
  const res = await payload.count({
    collection: 'withdrawals',
    where: { email: { equals: email } },
    overrideAccess: true,
  })
  return res.totalDocs
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
  restoreBusiness = await withBusiness(payload)
  const fx = await createProductFixtures(payload)
  items = []
  for (const nr of NUMBERS) {
    const p = await createProduct(payload, completeProduct('keramik', nr, fx))
    items.push({ id: p.id as number, itemNumber: nr })
  }
  const order = await createOrder(
    payload,
    orderData(985, items, { customer: { name: 'Erika Formular', email: EMAIL.toUpperCase() } }),
  )
  orderNumber = order.orderNumber as string
})

afterAll(async () => {
  __setEmailAdapterForTests(undefined)
  await dbOf(payload).execute(sql`DELETE FROM email_log`)
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
  await restoreBusiness()
})

beforeEach(() => {
  __setEmailAdapterForTests(
    createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: 'memory' })),
  )
  clearMemoryOutbox()
})

describe('Formular-Token (pc:form-token:v1)', () => {
  it('R-137 signiert, manipuliert/abgelaufen → ungültig', () => {
    const token = signWithdrawalToken({
      iat: NOW.getTime(),
      n: 'abcdefghijklmnopqrstuv',
      locale: 'de',
      values: {
        name: 'A B',
        contractIdentification: 'xyz',
        email: 'a@b.de',
        itemsText: '',
        reason: '',
      },
      hp: '',
      choices: [],
      selected: [],
    })
    expect(verifyWithdrawalToken(token, NOW)?.values.name).toBe('A B')
    const [body, mac] = token.split('.')
    const forged = Buffer.from(
      Buffer.from(body!, 'base64url').toString('utf8').replace('A B', 'X Y'),
    ).toString('base64url')
    expect(verifyWithdrawalToken(`${forged}.${mac}`, NOW)).toBeNull()
    expect(
      verifyWithdrawalToken(token, new Date(NOW.getTime() + WITHDRAWAL_FORM_TOKEN_TTL_MS + 1000)),
    ).toBeNull()
    expect(verifyWithdrawalToken('kaputt', NOW)).toBeNull()
  })

  it('R-091 Vorbelegung nur einer gültigen Bestellnummer über ?order=', () => {
    expect(initialWithdrawalState('pc-2026-00017')).toMatchObject({
      step: 'form',
      values: { contractIdentification: 'PC-2026-00017', email: '' },
    })
    expect(initialWithdrawalState('erika@example.com')).toMatchObject({
      values: { contractIdentification: '' },
    })
  })
})

describe('Ablauf (R-091, R-092)', () => {
  it('R-091 Pflichtfelder fehlen → Schritt 1 mit Fehlern, „Grund“ nie Pflicht', async () => {
    const s = await withdrawalStep(initialWithdrawalState(), step1({ name: '', email: 'x' }), ctx())
    expect(s.step).toBe('form')
    if (s.step !== 'form') return
    expect(s.errors).toEqual({ name: 'required', email: 'invalid' })
    expect(s.values.email).toBe('x')
  })

  it('R-091 R-092 unbekannte Bestellnummer, leerer Grund: kein Datensatz vor Schritt 2, danach genau einer', async () => {
    const before = await count()
    const s1 = await withdrawalStep(initialWithdrawalState(), step1(), ctx())
    expect(s1.step).toBe('confirm')
    if (s1.step !== 'confirm') return
    expect(s1.matched).toBe(false)
    expect(await count()).toBe(before)

    // „Ändern“ → Schritt 1 mit allen Eingaben
    const back = await withdrawalStep(
      s1,
      fd({ locale: 'de', stage: 'confirm', intent: 'edit', token: s1.token }),
      ctx(),
    )
    expect(back).toMatchObject({ step: 'form', values: { name: 'Erika Formular' } })
    expect(await count()).toBe(before)

    const confirmFd = fd({ locale: 'de', stage: 'confirm', intent: 'confirm', token: s1.token })
    const done = await withdrawalStep(s1, confirmFd, ctx())
    expect(done.step).toBe('done')
    if (done.step !== 'done' || !done.receipt) throw new Error('kein Ergebnis')
    expect(done.receipt.reference).toMatch(/^WR-2026-\d{5}$/)
    expect(done.receipt.receivedAtText).toBe('12.10.2026, 14:03 Uhr (MESZ)')
    expect(done.receipt.matchStatus).toBe('needs_manual_match')
    expect(await count()).toBe(before + 1)

    // Doppelklick / erneutes POST desselben Schritts 2 → derselbe Widerruf, kein zweiter Datensatz
    const again = await withdrawalStep(s1, confirmFd, ctx())
    expect(again.step === 'done' && again.receipt?.reference).toBe(done.receipt.reference)
    expect(await count()).toBe(before + 1)
  })

  it('R-091 Bestellnummer + E-Mail passen → Auswahl je Position, keine vorausgewählt; Auswahl landet im Widerruf', async () => {
    const s1 = await withdrawalStep(
      initialWithdrawalState(),
      step1({ contractIdentification: orderNumber.toLowerCase() }),
      ctx(),
    )
    expect(s1.step).toBe('select')
    if (s1.step !== 'select') return
    expect(s1.choices).toHaveLength(2)
    expect(s1.selected).toEqual([])
    expect(s1.choices[0]!.label).toMatch(/^Nr\. 985 · /)

    const chosen = s1.choices[1]!.id
    const s2 = (await withdrawalStep(
      s1,
      fd({
        locale: 'de',
        stage: 'select',
        intent: 'next',
        token: s1.token,
        affectedItemIds: [chosen, 'fremde-id'],
      }),
      ctx(),
    )) as WithdrawalFlowState
    expect(s2).toMatchObject({
      step: 'confirm',
      matched: true,
      selectedLabels: [s1.choices[1]!.label],
    })
    if (s2.step !== 'confirm') return
    const done = await withdrawalStep(
      s2,
      fd({ locale: 'de', stage: 'confirm', intent: 'confirm', token: s2.token }),
      ctx(),
    )
    if (done.step !== 'done' || !done.receipt) throw new Error('kein Ergebnis')
    expect(done.receipt.matchStatus).toBe('auto_matched')
    expect(done.receipt.items.map((i) => i.itemNumber)).toEqual([986])
    const doc = await payload.findByID({
      collection: 'withdrawals',
      id: done.receipt.id,
      overrideAccess: true,
      depth: 0,
    })
    expect(doc.affectedItemIds).toEqual([chosen])
  })

  it('R-137 manipulierter oder abgelaufener Token → Schritt 1 mit Hinweis, kein Datensatz', async () => {
    const before = await count()
    const s1 = await withdrawalStep(initialWithdrawalState(), step1(), ctx())
    if (s1.step !== 'confirm') throw new Error('kein Schritt 2')
    const late = new Date(NOW.getTime() + WITHDRAWAL_FORM_TOKEN_TTL_MS + 60_000)
    const s = await withdrawalStep(
      s1,
      fd({ locale: 'de', stage: 'confirm', intent: 'confirm', token: s1.token }),
      ctx(late),
    )
    expect(s).toMatchObject({ step: 'form', notice: 'expired' })
    expect(await count()).toBe(before)
  })

  it('R-134 Honeypot gefüllt → Schein-Erfolg ohne Datensatz', async () => {
    const before = await count()
    const s1 = await withdrawalStep(
      initialWithdrawalState(),
      step1({ website: 'http://spam' }),
      ctx(),
    )
    if (s1.step !== 'confirm') throw new Error('kein Schritt 2')
    const done = await withdrawalStep(
      s1,
      fd({ locale: 'de', stage: 'confirm', intent: 'confirm', token: s1.token }),
      ctx(),
    )
    expect(done).toMatchObject({ step: 'done', receipt: null })
    expect(await count()).toBe(before)
  })
})
