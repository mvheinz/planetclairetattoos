import React from 'react'

import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import {
  CARRIERS,
  COUNTRY_CODES,
  PACKAGING_MATERIALS,
  SHIPPING_CLASSES,
  SHIPPING_ZONES,
} from '@/lib/enums'
import { SHIPPABLE_CLASSES } from '@/lib/settings/rules'

import { PackagingYearTotal } from '../../components/PackagingYearTotal'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { PackingForm, ShippingForm } from './AreaForms'
import { areaText, initialAreaValues, type Obj } from './settingsAreas'

// Einstellungen → Versand `/einstellungen/versand` (PLAN P5.22, KONZEPT §7.14, DATENMODELL §7.1): Lieferländer mit
// EU-Sperre (nur DE aktiv; ein EU-Land erst nach den fünf Häkchen der EU-Checkliste und „EU-Versand geprüft“, R-202;
// GB/US gibt es nicht, R-060), Abholung, Lieferzeit DE/EN, Tarife je Zone und Klasse, Sendungsverfolgung; darunter
// Checklisten, Verpackungsvorlagen und die laufende Jahressumme der Verpackung (P5.11).

export async function ShippingSettingsView({ req }: AdminViewBodyProps) {
  const load = (locale: 'de' | 'en') =>
    req.payload.findGlobal({
      slug: 'settings',
      depth: 0,
      locale,
      fallbackLocale: false,
      overrideAccess: true,
      req,
    })
  const area = initialAreaValues(
    (await load('de')) as unknown as Obj,
    (await load('en')) as unknown as Obj,
  )
  return (
    <div className="pc-order pc-settings" data-testid="settings-shipping-view">
      <section className="pc-order__section" aria-labelledby="shipping-title">
        <h2 id="shipping-title">{adminText('settingsAreaShipping')}</h2>
        <ShippingForm
          initial={area.shipping}
          countries={enumOptions(COUNTRY_CODES, ENUM_LABELS.COUNTRY_CODES).map((o) => ({
            value: String(o.value),
            label: String(o.label),
          }))}
          zones={SHIPPING_ZONES.map((z) => ({ value: z, label: ENUM_LABELS.SHIPPING_ZONES[z].de }))}
          classes={SHIPPABLE_CLASSES.map((c) => ({
            value: c,
            label: ENUM_LABELS.SHIPPING_CLASSES[c].de,
          }))}
          carriers={CARRIERS.map((c) => ({ value: c, label: ENUM_LABELS.CARRIERS[c].de }))}
        />
      </section>
      <section className="pc-order__section" aria-labelledby="packing-title">
        <h2 id="packing-title">{adminText('settingsAreaPacking')}</h2>
        <h3>{areaText('packYearTotal')}</h3>
        <PackagingYearTotal payload={req.payload} />
        <PackingForm
          initial={area.packing}
          classes={SHIPPING_CLASSES.map((c) => ({
            value: c,
            label: ENUM_LABELS.SHIPPING_CLASSES[c].de,
          }))}
          materials={PACKAGING_MATERIALS.map((m) => ({
            value: m,
            label: ENUM_LABELS.PACKAGING_MATERIALS[m].de,
          }))}
        />
      </section>
    </div>
  )
}
