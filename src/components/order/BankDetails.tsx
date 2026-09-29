import { getTranslations } from 'next-intl/server'
import React from 'react'

import { MoneyAmount } from '@/components/shop/MoneyAmount'
import type { OrderViewBank } from '@/lib/commerce/orderView'
import { EPC_QR_DISPLAY_PX } from '@/lib/commerce/orderView'
import type { Locale } from '@/lib/enums'
import { formatBerlin } from '@/lib/time'

import styles from './Order.module.css'

// Bankdaten der Vorkasse (DESIGN KO-19, KONZEPT §4.8/§4.12): Kontoinhaberin, IBAN, BIC, Bank, Betrag, Verwendungszweck =
// Bestellnummer, Frist; Knöpfe „IBAN kopieren“ und „Verwendungszweck kopieren“ (`copy-button`, ohne JS verborgen) und
// der EPC-QR-Code (168 px, Tusche auf Papier, Beschriftung darunter). Alle Werte stehen als Text da.
export async function BankDetails({ bank, locale }: { bank: OrderViewBank; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'order.bank' })
  const due = bank.dueAt
    ? formatBerlin(new Date(bank.dueAt), locale === 'de' ? 'dd.MM.yyyy' : 'd MMMM yyyy', locale)
    : null
  const copy = (value: string, label: string, id: string) => (
    <>
      <button
        type="button"
        className={styles.copy}
        data-behavior="copy-button"
        data-copy={value}
        data-copied-text={t('copied')}
        data-copy-failed-text={t('copyFailed')}
        data-copy-status-id={id}
        hidden
      >
        {label}
      </button>
      <span id={id} className={styles.copyStatus} role="status" aria-live="polite" />
    </>
  )
  return (
    <section className={styles.bank} aria-labelledby="bank-heading" data-bank-details="">
      <h2 id="bank-heading" className={styles.h2}>
        {t('heading')}
      </h2>
      {due ? <p data-bank-due="">{t('dueBy', { date: due })}</p> : null}
      <div className={styles.bankGrid}>
        <dl className={styles.dl}>
          <dt>{t('accountHolder')}</dt>
          <dd>{bank.accountHolder}</dd>
          <dt>{t('iban')}</dt>
          <dd>
            <span className={styles.mono} data-bank-iban="">
              {bank.iban}
            </span>
            {copy(bank.ibanRaw, t('copyIban'), 'copy-iban-status')}
          </dd>
          {bank.bic ? (
            <>
              <dt>{t('bic')}</dt>
              <dd className={styles.mono}>{bank.bic}</dd>
            </>
          ) : null}
          {bank.bankName ? (
            <>
              <dt>{t('bank')}</dt>
              <dd>{bank.bankName}</dd>
            </>
          ) : null}
          <dt>{t('amount')}</dt>
          <dd data-bank-amount="">
            <MoneyAmount cents={bank.amountCents} locale={locale} />
          </dd>
          <dt>{t('reference')}</dt>
          <dd>
            <span className={styles.mono} data-bank-reference="">
              {bank.reference}
            </span>
            {copy(bank.reference, t('copyReference'), 'copy-reference-status')}
          </dd>
        </dl>
        {bank.qrDataUri ? (
          <figure className={styles.qr} data-epc-qr="">
            {/* eslint-disable-next-line @next/next/no-img-element -- erzeugtes SVG als Data-URI, keine Bildoptimierung */}
            <img
              src={bank.qrDataUri}
              width={EPC_QR_DISPLAY_PX}
              height={EPC_QR_DISPLAY_PX}
              alt={t('qrAlt')}
            />
            <figcaption>{t('qrHint')}</figcaption>
          </figure>
        ) : null}
      </div>
    </section>
  )
}
