import React from 'react'

import { berlinYear } from '@/lib/time'

import { Notice } from '../../components/Notice'
import { PackagingYearTotal } from '../../components/PackagingYearTotal'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { allDataPath, adminView } from '../registry'

// „Export und Datenschutz“ `/export` (KONZEPT §7.15). Bisher: Jahres-Export der Verpackungsmengen (PLAN P5.11, R-201)
// als einfaches GET-Formular (funktioniert ohne JavaScript). Monats-CSV, Rechnungs-ZIP und DATEV ergänzt P5.24/P5.25,
// die Datenschutz-Werkzeuge P6.

export async function ExportView({ adminRoute, req }: AdminViewBodyProps) {
  const current = berlinYear(new Date())
  const years = [current, current - 1, current - 2]
  return (
    <div className="pc-order">
      <section className="pc-order__section" aria-labelledby="export-packaging">
        <h2 id="export-packaging">{adminText('exportPackagingTitle')}</h2>
        <p>{adminText('exportPackagingHint')}</p>
        <PackagingYearTotal payload={req.payload} year={current} />
        <form
          method="get"
          action="/api/admin/packaging-report"
          className="pc-admin-row pc-order__form"
          data-testid="packaging-report-form"
        >
          <div className="pc-field">
            <label htmlFor="packaging-year" className="pc-field__label">
              {adminText('exportPackagingYear')}
            </label>
            <select id="packaging-year" name="year" defaultValue={String(current)}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="pc-admin-btn pc-admin-btn--primary">
            {adminText('exportPackagingDownload')}
          </button>
        </form>
      </section>
      <Notice
        tone="info"
        data-testid="admin-view-placeholder"
        action={{
          href: `${adminRoute}${allDataPath(adminView('export'))}`,
          label: adminText('shellOpenAllData'),
        }}
      >
        {adminText('exportMoreLater')}
      </Notice>
    </div>
  )
}
