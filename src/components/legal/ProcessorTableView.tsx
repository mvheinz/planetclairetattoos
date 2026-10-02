import React from 'react'

import type { Locale } from '@/lib/enums'
import type { ProcessorTableRow } from '@/lib/legal/services'

import styles from './ProcessorTable.module.css'

// Auftragsverarbeiter und weitere Empfänger (PLAN P6.21, DIENSTE §7, R-155): generierte Komponente unter dem Text der
// Datenschutzerklärung (R22 DE/EN), Spalten Name, Rolle, Sitz, Drittland. Quelle ist die YAML über
// `services.generated.ts` plus der AVV-Stand aus `settings.processorAgreements`. Kein Token im Rechtstext (R-012,
// DATENMODELL §6.12, KANZLEI-BRIEFING §16.3): die Tabelle steht auch beim Platzhalter-Text. Preset `legal`, ohne JS.

export function ProcessorTableView({
  rows,
  t,
  locale,
}: {
  rows: readonly ProcessorTableRow[]
  t: (key: string) => string
  locale: Locale
}) {
  const role = (r: ProcessorTableRow) =>
    r.agreementSigned && (r.role === 'processor' || r.role === 'processorAndController')
      ? `${t(`role.${r.role}`)} – ${t('agreementSigned')}`
      : t(`role.${r.role}`)
  return (
    <section
      className={styles.section}
      aria-labelledby="auftragsverarbeiter-tabelle"
      data-processor-table=""
    >
      <h2 id="auftragsverarbeiter-tabelle">{t('title')}</h2>
      <p className={styles.intro}>{t('intro')}</p>
      <div className={styles.wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('colName')}</th>
              <th scope="col">{t('colRole')}</th>
              <th scope="col">{t('colSeat')}</th>
              <th scope="col">{t('colThirdCountry')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-service={r.id}>
                <th scope="row">{r.name}</th>
                <td>{role(r)}</td>
                <td>{r.seat[locale]}</td>
                <td>{t(`thirdCountry.${r.thirdCountry}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
