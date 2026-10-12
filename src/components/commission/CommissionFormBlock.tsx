import { getMessages } from 'next-intl/server'
import React from 'react'

import { Station } from '@/components/leash/Station'
import { initialCommissionState } from '@/lib/commission/form'
import { getSnippet } from '@/lib/legal/snippets'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

import styles from './Commission.module.css'
import { CommissionForm } from './CommissionForm'
import {
  CommissionView,
  type CommissionFormMessages,
  type CommissionViewFlow,
} from './CommissionView'

// Block `commissionForm` der Seite R10 (DESIGN §9.7 Preset `frame`, KONZEPT §3.10): Überschrift mit Kringel und Coco
// `sitzen` (Stations-Anker), Einleitung, Formular-Karte (die Leine läuft daneben in der Rinne – U-44: Coco umrundet nie
// Felder oder Knöpfe; das Formular selbst ohne Animation; seine Erstansicht `CommissionView` rendert der Server). Das Formular-Token entsteht hier je Aufruf
// (Zeitfalle und Upload-Berechtigung, ARCHITEKTUR §8.6). Vorauswahl „Was soll es werden?“ und Bezug auf ein verkauftes
// Stück kommen aus den Links „Zeichnung auf Anfrage“ / „Etwas Ähnliches anfragen“ (V-11 a, V-20).
export async function CommissionFormBlock({
  locale,
  heading,
  intro,
  successText,
  contactEmail,
  objectType,
  similarTo = null,
  children,
}: {
  locale: Locale
  heading: string
  intro: string | null
  successText: string | null
  contactEmail: string | null
  /** Vorausgewählter Gegenstand (`INQUIRY_OBJECT_TYPES`). */
  objectType?: string
  /** Öffentliche Nummer des Anlass-Stücks (V-20), geht als verstecktes Feld mit. */
  similarTo?: number | null
  /** Hinweis über dem Formular (z. B. „So etwas wie Nr. 115 …“). */
  children?: React.ReactNode
}) {
  const messages = (await getMessages({ locale })) as unknown as {
    commission: { form: CommissionFormMessages }
  }
  const flow: CommissionViewFlow = {
    locale,
    messages: messages.commission.form,
    privacyNotice: getSnippet('inquiry.privacyNotice', locale).text,
    privacyHref: `${localizedPath('R22', locale)}#auftragsarbeiten`,
    contactEmail,
    similarTo,
  }
  const initial = initialCommissionState(new Date(), { objectType })
  return (
    <section
      className={styles.formSection}
      aria-labelledby="commission-form-title"
      data-commission-form-block=""
    >
      <h2 id="commission-form-title" className={styles.formTitle}>
        <Station
          id="commission-coco"
          as="span"
          pose="sitzen"
          loop="left"
          className={styles.cocoAnchor}
        >
          {heading}
        </Station>
      </h2>
      {intro ? <p>{intro}</p> : null}
      {children}
      <div className={styles.frame} data-commission-frame="">
        <CommissionForm
          {...flow}
          initial={initial}
          initialView={
            initial.step === 'form' ? (
              <CommissionView part="fields" state={initial} flow={flow} />
            ) : null
          }
          successText={successText}
        />
      </div>
    </section>
  )
}
