import { getTranslations } from 'next-intl/server'
import React from 'react'

import { computeShipping, ShippingError, type ShippingSettings } from '@/lib/commerce/shipping'
import { ENUM_LABELS } from '@/lib/enumLabels'
import { SHIPPING_CLASS_RANK, type Locale, type ShippingClass } from '@/lib/enums'

import { MoneyAmount } from './MoneyAmount'
import styles from './ShippingTable.module.css'

// Versandtabelle (KONZEPT §3.15, RECHT R-031, E-25): je Versandklasse Zone DE „Klasse, wofür, Preis, Versanddienst“, dazu
// „Abholung in Berlin – 0,00 €“. Die Preise rechnet `computeShipping` aus `settings.shipping` – dieselbe Funktion und
// dieselbe Quelle wie im Korb und in der Kasse; eine Klasse ohne Tarif erscheint nicht (nie stillschweigend 0 €).

type ParcelClass = Exclude<ShippingClass, 'nur_abholung'>
const PARCEL_CLASSES = (Object.keys(SHIPPING_CLASS_RANK) as ShippingClass[])
  .filter((c): c is ParcelClass => c !== 'nur_abholung')
  .sort((a, b) => SHIPPING_CLASS_RANK[a] - SHIPPING_CLASS_RANK[b])

/** Versanddienst je Klasse (KONZEPT §7.6: Brief → Deutsche Post, sonst DHL). */
const CARRIER: Record<ParcelClass, 'deutsche_post' | 'dhl'> = {
  brief: 'deutsche_post',
  paket_klein: 'dhl',
  keramik: 'dhl',
}

export interface ShippingTableRow {
  key: ParcelClass | 'pickup'
  priceCents: number
}

/** Zeilen der Tabelle über den Rechenkern (`computeShipping`, Lieferland DE). */
export function shippingTableRows(
  settings: ShippingSettings,
  pickupEnabled: boolean,
): ShippingTableRow[] {
  const rows: ShippingTableRow[] = []
  for (const cls of PARCEL_CLASSES) {
    try {
      const r = computeShipping([{ shippingClass: cls }], 'shipping', settings, { country: 'DE' })
      rows.push({ key: cls, priceCents: r.shippingCents })
    } catch (err) {
      if (!(err instanceof ShippingError)) throw err
    }
  }
  if (pickupEnabled) {
    const r = computeShipping([{ shippingClass: 'brief' }], 'pickup', settings)
    rows.push({ key: 'pickup', priceCents: r.shippingCents })
  }
  return rows
}

const labelOf = (l: { de: string; en?: string }, locale: Locale) =>
  (locale === 'en' ? l.en : undefined) ?? l.de

export async function ShippingTable({
  locale,
  settings,
  pickupEnabled,
  pickupCity,
}: {
  locale: Locale
  settings: ShippingSettings
  pickupEnabled: boolean
  pickupCity: string
}) {
  const t = await getTranslations({ locale, namespace: 'shippingPayment.table' })
  const rows = shippingTableRows(settings, pickupEnabled)
  if (!rows.some((r) => r.key !== 'pickup')) {
    return (
      <p data-shipping-table-empty="" className={styles.empty}>
        {t('empty')}
      </p>
    )
  }
  return (
    <div className={styles.wrap}>
      <table className={styles.table} data-shipping-table="">
        <caption className={styles.caption}>{t('caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('class')}</th>
            <th scope="col">{t('for')}</th>
            <th scope="col" className={styles.price}>
              {t('price')}
            </th>
            <th scope="col">{t('carrier')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) =>
            row.key === 'pickup' ? (
              <tr key="pickup" data-shipping-row="pickup">
                <th scope="row">{t('pickup', { city: pickupCity })}</th>
                <td>{t('forPickup')}</td>
                <td className={styles.price}>
                  <MoneyAmount cents={row.priceCents} locale={locale} />
                </td>
                <td>{t('carrierPickup')}</td>
              </tr>
            ) : (
              <tr key={row.key} data-shipping-row={row.key}>
                <th scope="row">{labelOf(ENUM_LABELS.SHIPPING_CLASSES[row.key], locale)}</th>
                <td>{t(`forClass.${row.key}`)}</td>
                <td className={styles.price}>
                  <MoneyAmount cents={row.priceCents} locale={locale} />
                </td>
                <td>{labelOf(ENUM_LABELS.CARRIERS[CARRIER[row.key]], locale)}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}
