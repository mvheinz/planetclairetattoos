import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'

import {
  buildOrderView,
  orderLegalDocuments,
  type OrderView,
  type OrderViewDocument,
} from '@/lib/commerce/orderView'
import {
  findOrderByStatusToken,
  getThanksState,
  type ThanksState,
} from '@/lib/commerce/thanksState'
import { hitTokenPages } from '@/lib/commerce/tokenPages'
import type { Locale } from '@/lib/enums'

// Daten der Token-Seiten R08 (Danke) und R09 (Bestellstatus) (ARCHITEKTUR §2.2: öffentliche Seiten lesen nur über
// `src/lib/data/*`). Zuerst das Rate-Limit `token_pages`, dann die Token-Prüfung; unbekannt → `not_found` (404).

export type TokenPageResult<T> =
  { kind: 'rate_limited' } | { kind: 'not_found' } | ({ kind: 'ok' } & T)

/** Danke-Seite: Zustand (`getThanksState`) und – falls es eine Bestellung gibt – ihre Anzeige-Daten. */
export async function loadThanksPage(
  token: string,
  locale: Locale,
  requestHeaders: Pick<Headers, 'get'>,
  now: Date,
): Promise<TokenPageResult<{ state: ThanksState; view: OrderView | null }>> {
  const payload = await getPayload({ config })
  const limit = await hitTokenPages(requestHeaders, payload, now)
  if (!limit.allowed) return { kind: 'rate_limited' }
  const state = await getThanksState(token, now, { payload })
  if (!state) return { kind: 'not_found' }
  const view = 'order' in state ? await buildOrderView(payload, state.order, locale) : null
  return { kind: 'ok', state, view }
}

/** Bestellstatus: Anzeige-Daten und die Rechtstext-Dokumente in der Fassung der Bestellung. */
export async function loadOrderStatusPage(
  token: string,
  locale: Locale,
  requestHeaders: Pick<Headers, 'get'>,
  now: Date,
): Promise<TokenPageResult<{ view: OrderView; documents: OrderViewDocument[] }>> {
  const payload = await getPayload({ config })
  const limit = await hitTokenPages(requestHeaders, payload, now)
  if (!limit.allowed) return { kind: 'rate_limited' }
  const order = await findOrderByStatusToken(payload, token)
  if (!order) return { kind: 'not_found' }
  const [view, docs] = await Promise.all([
    buildOrderView(payload, order, locale),
    orderLegalDocuments(payload, order, locale),
  ])
  return { kind: 'ok', view, documents: docs.shown }
}
