'use client'

import React, { useId, useState } from 'react'

import { adminText } from '../../translations'

// Monatsauswahl der Exporte (PLAN P5.24/P5.25, KONZEPT §7.15): Links auf `GET /api/admin/export/{JJJJ-MM}.csv`,
// `.zip` und `.datev.csv` (Admin-Sitzung, Download als Anhang). Ohne JavaScript zeigen die Links auf den
// vorausgewählten Monat (Vormonat). DATEV ist ausgegraut mit Hinweis, solange Konten fehlen (409 am Endpunkt).

export interface MonthOption {
  value: string
  label: string
}

export function MonthExport({
  months,
  initial,
  datevMissing,
}: {
  months: readonly MonthOption[]
  initial: string
  /** Fehlende DATEV-Angaben (leer = bereit). */
  datevMissing: readonly string[]
}) {
  const [month, setMonth] = useState(initial)
  const id = useId()
  const hintId = `${id}-datev`
  const href = (ext: string) => `/api/admin/export/${month}.${ext}`
  return (
    <div className="pc-order__form" data-testid="export-month">
      <div className="pc-field">
        <label htmlFor={id} className="pc-field__label">
          {adminText('exportMonth')}
        </label>
        <select
          id={id}
          name="month"
          value={month}
          data-testid="export-month-select"
          onChange={(e) => setMonth(e.target.value)}
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <p className="pc-admin-row">
        <a
          className="pc-admin-btn pc-admin-btn--primary"
          href={href('csv')}
          download
          data-testid="export-csv"
        >
          {adminText('exportCsv')}
        </a>
        <a
          className="pc-admin-btn pc-admin-btn--secondary"
          href={href('zip')}
          download
          data-testid="export-zip"
        >
          {adminText('exportZip')}
        </a>
        {datevMissing.length === 0 ? (
          <a
            className="pc-admin-btn pc-admin-btn--secondary"
            href={href('datev.csv')}
            download
            data-testid="export-datev"
          >
            {adminText('exportDatev')}
          </a>
        ) : (
          <button
            type="button"
            className="pc-admin-btn pc-admin-btn--secondary"
            disabled
            aria-describedby={hintId}
            data-testid="export-datev"
          >
            {adminText('exportDatev')}
          </button>
        )}
      </p>
      {datevMissing.length > 0 ? (
        <p id={hintId} className="pc-order__muted" data-testid="export-datev-hint">
          {adminText('exportDatevMissing', { fields: datevMissing.join(', ') })}
        </p>
      ) : null}
      <p className="pc-order__muted">{adminText('exportMonthHint')}</p>
    </div>
  )
}
