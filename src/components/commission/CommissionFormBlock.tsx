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

// Block `commissionForm` der Seite R10 (DESIGN §9.7 Preset `frame`, KONZEPT §3.10): Überschrift mit Coco `sitzen`
// (Stations-Anker), Einleitung, Formular-Karte mit `contour` der Tuschelinie (einmal beim Eintritt; das Formular selbst
// ohne Animation; seine Erstansicht `CommissionView` rendert der Server). Das Formular-Token entsteht hier je Aufruf
// (Zeitfalle und Upload-Berechtigung, ARCHITEKTUR §8.6).
export async function CommissionFormBlock({
  locale,
  heading,
  intro,
  successText,
  contactEmail,
}: {
  locale: Locale
  heading: string
  intro: string | null
  successText: string | null
  contactEmail: string | null
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
  }
  const initial = initialCommissionState(new Date())
  return (
    <section
      className={styles.formSection}
      aria-labelledby="commission-form-title"
      data-commission-form-block=""
    >
      <h2 id="commission-form-title" className={styles.formTitle}>
        <Station id="commission-coco" as="span" pose="sitzen" className={styles.cocoAnchor}>
          {heading}
        </Station>
      </h2>
      {intro ? <p>{intro}</p> : null}
      <Station id="commission-form" loop="contour" className={styles.frame}>
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
      </Station>
      <span className={styles.lineEnd} data-leash-anchor="end" aria-hidden="true" />
    </section>
  )
}
