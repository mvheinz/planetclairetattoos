import type { Payload } from 'payload'
import React from 'react'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { kgComma, packagingTotals } from '@/lib/export/packagingReport'
import { berlinYear } from '@/lib/time'

import { adminText } from '../translations'

// Laufende Jahressumme der Verpackungsmengen (PLAN P5.11, E-47, R-201): unter Einstellungen → Versand und in
// „Export“. Ohne Beispieldaten (auch im Vorschau-Modus), ohne Abholungen. Server-Komponente.

export async function PackagingYearTotal({ payload, year }: { payload: Payload; year?: number }) {
  const y = year ?? berlinYear(new Date())
  const totals = await packagingTotals(payload, y)
  return (
    <div className="pc-packaging-total" data-testid="packaging-year-total">
      <p>
        <strong>
          {totals.shipments === 0
            ? adminText('packagingYearNone', { year: y })
            : adminText('packagingYearTotal', { year: y, shipments: totals.shipments })}
        </strong>
      </p>
      {totals.shipments > 0 ? (
        <ul>
          {totals.materials.map((m) => (
            <li key={m.material}>
              {ENUM_LABELS.PACKAGING_MATERIALS[m.material].de}: {kgComma(m.grams)} kg
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** UI-Feld in den Einstellungen (Payload übergibt `payload` an Server-Komponenten). */
export function PackagingYearTotalField({ payload }: { payload: Payload }) {
  return <PackagingYearTotal payload={payload} />
}
