import React from 'react'

import { Button } from '@/components/ui/Button'
import formStyles from '@/components/ui/forms.module.css'
import { translatorFor } from '@/i18n/translator'
import type { Locale } from '@/lib/enums'
import {
  SHORT_LINK_FORM_PATH,
  SHORT_LINK_LOCALE_PARAM,
  SHORT_LINK_NUMBER_PARAM,
} from '@/lib/shop/shortLink'

import styles from './NumberLookup.module.css'

// Nummernfeld „Nr. aus dem Post“ (V-60, U-93, P20.3; KONZEPT §3.2, §3.0.2, §3.17): Wer auf Instagram „Nr. 115“ sieht, tippt
// die Nummer ein und landet beim Stück. Ein schlichtes GET-Formular auf `/nr?nummer=115&locale=de` (R31, ohne JavaScript
// bedienbar, kein Cookie): Der Knopf trägt `name="locale"` mit der Sprache der Seite, auf der das Feld steht – sie geht vor
// `Accept-Language` (`src/app/(api)/nr/resolve.ts`). Unbekannte Nummer → die freundliche 404 mit demselben Feld. Steht im
// Shop-Kopf (R02/R03), im Menü (KO-03) und auf der 404 (`variant="notFound"` mit deren eigenen Texten). Ohne `pattern`:
// „Nr. 115“ oder „#115“ versteht der Server auch (`parseShortLinkNumber`). Rein, ohne Hooks (auch in `StaticHtml`).

export type NumberLookupVariant = 'shop' | 'menu' | 'notFound'

export function NumberLookup({
  locale,
  id,
  variant,
  label,
  submit,
  className,
  data,
}: {
  locale: Locale
  /** Eindeutige ID des Eingabefelds auf der Seite (Menü und Seite stehen gleichzeitig im HTML). */
  id: string
  variant: NumberLookupVariant
  /** Eigene Texte (404); sonst „Nr. aus dem Post“ / „Zeigen“. */
  label?: string
  submit?: string
  className?: string
  data?: Readonly<Record<`data-${string}`, string>>
}) {
  const t = translatorFor(locale, 'shop.lookup')
  return (
    <form
      className={[styles.form, styles[variant], className].filter(Boolean).join(' ')}
      action={SHORT_LINK_FORM_PATH}
      method="get"
      data-nr-lookup={variant}
      {...data}
    >
      <div className={`${formStyles.field} ${styles.field}`}>
        <label htmlFor={id} className={`${formStyles.label} ${styles.label}`}>
          {label ?? t('label')}
        </label>
        <input
          id={id}
          name={SHORT_LINK_NUMBER_PARAM}
          type="text"
          inputMode="numeric"
          enterKeyHint="go"
          maxLength={10}
          autoComplete="off"
          spellCheck={false}
          required
          placeholder={variant === 'notFound' ? undefined : t('placeholder')}
          className={`${formStyles.control} ${styles.input}`}
        />
      </div>
      {/* Die Sprache reist mit dem Knopf (`name`/`value`): Auch Enter im Feld sendet über diesen Standard-Knopf – so gibt es
          kein verstecktes Feld, an dem die Tab-Reihenfolge des Menüs hängen bliebe. */}
      <Button
        type="submit"
        variant="secondary"
        name={SHORT_LINK_LOCALE_PARAM}
        value={locale}
        className={styles.submit}
      >
        {submit ?? t('submit')}
      </Button>
    </form>
  )
}
