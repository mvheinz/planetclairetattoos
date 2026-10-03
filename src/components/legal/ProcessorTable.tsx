import { getTranslations } from 'next-intl/server'
import React from 'react'

import { getProcessorTableRows } from '@/lib/data/processors'
import type { Locale } from '@/lib/enums'

import { ProcessorTableView } from './ProcessorTableView'

// Auftragsverarbeiter-Tabelle unter der Datenschutzerklärung (PLAN P6.21): lädt die Zeilen (YAML + AVV-Stand) und
// rendert `ProcessorTableView` (reine Darstellung, unit-getestet).

export async function ProcessorTable({ locale }: { locale: Locale }) {
  const [t, rows] = await Promise.all([
    getTranslations({ locale, namespace: 'legal.processors' }),
    getProcessorTableRows(),
  ])
  return <ProcessorTableView rows={rows} t={(k) => t(k as never)} locale={locale} />
}
