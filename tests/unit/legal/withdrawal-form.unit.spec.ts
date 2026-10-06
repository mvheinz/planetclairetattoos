import type { Payload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const submit = vi.fn()
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (orig) => ({
  ...(await orig<typeof import('payload')>()),
  getPayload: vi.fn(async () => ({
    find: async () => ({ docs: [] }),
  })),
}))
vi.mock('@/lib/legal/withdrawal', async (orig) => ({
  ...(await orig<typeof import('@/lib/legal/withdrawal')>()),
  submitWithdrawal: (...args: unknown[]) => submit(...args),
}))

import {
  emptyWithdrawalValues,
  initialWithdrawalState,
  signWithdrawalToken,
  verifyWithdrawalToken,
  WITHDRAWAL_FORM_TOKEN_TTL_MS,
  withdrawalChoices,
  withdrawalStep,
  type WithdrawalFlowState,
} from '@/lib/legal/withdrawalForm'

const NOW = new Date('2026-10-01T10:00:00Z')
const CTX = { now: NOW, locale: 'de' as const }

const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x)
  return f
}
const good = {
  name: 'Erika Beispiel',
  contractIdentification: 'Bestellung PC-2026-00012',
  email: 'Erika@Example.test',
  itemsText: '',
  reason: '',
}
const payloadWith = (order: unknown) =>
  ({ find: vi.fn(async () => ({ docs: order ? [order] : [] })) }) as unknown as Payload
const order = {
  customer: { email: 'erika@example.test' },
  items: [
    { id: 'a', status: 'active', itemNumber: 12, titleDe: 'Schale', titleEn: 'Bowl' },
    { id: 'b', status: 'cancelled', itemNumber: 13, titleDe: 'Tasse' },
    { status: 'active', itemNumber: 14, titleDe: 'ohne id' },
    { id: 'c', status: 'active', itemNumber: 15, titleDe: null, titleEn: null },
  ],
}

describe('R-091…R-093 Widerrufsfunktion R26 (Zweige)', () => {
  beforeEach(() => submit.mockReset())

  it('Vorbelegung nur mit gültiger Bestellnummer', () => {
    expect(initialWithdrawalState('pc-2026-00012')).toMatchObject({
      values: { contractIdentification: 'PC-2026-00012' },
    })
    expect(initialWithdrawalState('x')).toMatchObject({ values: emptyWithdrawalValues() })
    expect(initialWithdrawalState(null).step).toBe('form')
  })

  it('Token: Signatur, Alter, Form und Länge', () => {
    const body = {
      iat: NOW.getTime(),
      n: 'n'.repeat(20),
      locale: 'de' as const,
      values: good,
      hp: '',
      choices: [],
      selected: [],
    }
    const t = signWithdrawalToken(body)
    expect(verifyWithdrawalToken(t, NOW)?.values.name).toBe(good.name)
    expect(
      verifyWithdrawalToken(t, new Date(NOW.getTime() + WITHDRAWAL_FORM_TOKEN_TTL_MS + 1)),
    ).toBeNull()
    expect(verifyWithdrawalToken(t, new Date(NOW.getTime() - 61_000))).toBeNull()
    expect(verifyWithdrawalToken(5, NOW)).toBeNull()
    expect(verifyWithdrawalToken('a'.repeat(20_001), NOW)).toBeNull()
    expect(verifyWithdrawalToken('nur-ein-teil', NOW)).toBeNull()
    expect(verifyWithdrawalToken(`${t}.extra`, NOW)).toBeNull()
    expect(verifyWithdrawalToken(`${t}x`, NOW)).toBeNull()
    const [enc] = t.split('.')
    expect(verifyWithdrawalToken(`${enc}.`, NOW)).toBeNull()
    // gültige Signatur, aber falsche Form → abgelehnt
    const bad = signWithdrawalToken({ ...body, locale: 'fr' as never })
    expect(verifyWithdrawalToken(bad, NOW)).toBeNull()
    const other = signWithdrawalToken(body, Buffer.alloc(32, 1))
    expect(verifyWithdrawalToken(other, NOW)).toBeNull()
    const garbage = `${Buffer.from('kein json').toString('base64url')}`
    expect(verifyWithdrawalToken(`${garbage}.${t.split('.')[1]}`, NOW)).toBeNull()
  })

  it('Auswahl nur bei passender Bestellnummer und E-Mail (ohne Groß/Klein)', async () => {
    expect(
      await withdrawalChoices({ contractIdentification: 'ohne', email: 'a@b.de' }, 'de'),
    ).toEqual([])
    expect(
      await withdrawalChoices({ contractIdentification: 'PC-2026-00012', email: '  ' }, 'de'),
    ).toEqual([])
    expect(await withdrawalChoices(good, 'de', payloadWith(null))).toEqual([])
    expect(
      await withdrawalChoices({ ...good, email: 'fremd@example.test' }, 'de', payloadWith(order)),
    ).toEqual([])
    expect(await withdrawalChoices(good, 'de', payloadWith({ ...order, customer: null }))).toEqual(
      [],
    )
    const de = await withdrawalChoices(good, 'de', payloadWith(order))
    expect(de.map((c) => c.id)).toEqual(['a', 'c'])
    expect(de[0]!.label).toContain('Schale')
    const en = await withdrawalChoices(good, 'en', payloadWith(order))
    expect(en[0]!.label).toContain('Bowl')
    expect(
      await withdrawalChoices(good, 'de', payloadWith({ ...order, items: undefined })),
    ).toEqual([])
    // ohne Payload-Übergabe: getPayload (gemockt) liefert keine Bestellung
    expect(await withdrawalChoices(good, 'de')).toEqual([])
  })

  it('Schritt 1: Fehler → Formular mit Pflicht/ungültig; ohne Auswahl direkt zur Bestätigung', async () => {
    const bad = await withdrawalStep(
      initialWithdrawalState(),
      fd({ stage: 'form', ...good, name: '', email: 'kaputt' }),
      CTX,
    )
    expect(bad).toMatchObject({ step: 'form', errors: { name: 'required', email: 'invalid' } })
    const direct = await withdrawalStep(
      initialWithdrawalState(),
      fd({ stage: 'form', ...good, contractIdentification: 'Vertrag vom Mai', website: 'spam' }),
      { ...CTX, payload: payloadWith(null) },
    )
    expect(direct).toMatchObject({ step: 'confirm', matched: false, selectedLabels: [], rev: 1 })
  })

  it('Auswahl → Bestätigung → Ändern; abgelaufenes Token → Schritt 1 mit Hinweis', async () => {
    const select = (await withdrawalStep(initialWithdrawalState(), fd({ stage: 'form', ...good }), {
      ...CTX,
      payload: payloadWith(order),
    })) as Extract<WithdrawalFlowState, { step: 'select' }>
    expect(select.step).toBe('select')
    const confirm = (await withdrawalStep(
      select,
      fd({ stage: 'select', token: select.token, affectedItemIds: ['a', 'a', 'fremd'] }),
      CTX,
    )) as Extract<WithdrawalFlowState, { step: 'confirm' }>
    expect(confirm).toMatchObject({ step: 'confirm', matched: true })
    expect(confirm.selectedLabels).toHaveLength(1)
    const edit = await withdrawalStep(
      confirm,
      fd({ stage: 'confirm', intent: 'edit', token: confirm.token }),
      CTX,
    )
    expect(edit).toMatchObject({ step: 'form', values: good })
    const expired = await withdrawalStep(
      confirm,
      fd({ stage: 'confirm', intent: 'confirm', token: 'kaputt' }),
      CTX,
    )
    expect(expired).toMatchObject({ step: 'form', notice: 'expired' })
    const noToken = await withdrawalStep(undefined as never, fd({ stage: 'confirm' }), CTX)
    expect(noToken).toMatchObject({ step: 'form', notice: 'expired', rev: 1 })
    const other = await withdrawalStep(
      confirm,
      fd({ stage: 'unbekannt', token: confirm.token }),
      CTX,
    )
    expect(other.step).toBe('confirm')
    const justNext = await withdrawalStep(
      confirm,
      fd({ stage: 'confirm', intent: 'next', token: confirm.token }),
      CTX,
    )
    expect(justNext.step).toBe('confirm')
  })

  it('Bestätigen: Erfolg, Spam, Rate-Limit, Validierungsfehler, Ausnahme', async () => {
    const start = (await withdrawalStep(
      initialWithdrawalState(),
      fd({ stage: 'form', ...good, contractIdentification: 'Vertrag' }),
      { ...CTX, payload: payloadWith(null) },
    )) as Extract<WithdrawalFlowState, { step: 'confirm' }>
    const go = () =>
      withdrawalStep(start, fd({ stage: 'confirm', intent: 'confirm', token: start.token }), {
        ...CTX,
        ip: '1.2.3.4',
      })
    submit.mockResolvedValueOnce({
      ok: true,
      status: 201,
      spam: false,
      receipt: { items: [{ itemNumber: 12, title: 'Schale' }] },
    })
    const done = await go()
    expect(done).toMatchObject({ step: 'done' })
    expect((done as { itemLabels: string[] }).itemLabels[0]).toContain('Schale')
    submit.mockResolvedValueOnce({ ok: true, status: 200, spam: true })
    expect(await go()).toMatchObject({ step: 'done', receipt: null, itemLabels: [] })
    submit.mockResolvedValueOnce({
      ok: false,
      status: 429,
      code: 'rate_limited',
      retryAfterSeconds: 60,
    })
    expect(await go()).toMatchObject({ step: 'confirm', notice: 'rate_limited' })
    submit.mockResolvedValueOnce({
      ok: false,
      status: 400,
      code: 'invalid',
      errors: { name: 'invalid' },
    })
    expect(await go()).toMatchObject({ step: 'form', errors: { name: 'invalid' } })
    submit.mockRejectedValueOnce(new Error('db weg'))
    expect(await go()).toMatchObject({ step: 'confirm', notice: 'failed' })
    expect(submit.mock.calls[0]![1]).toMatchObject({ ip: '1.2.3.4', now: NOW })
  })
})
