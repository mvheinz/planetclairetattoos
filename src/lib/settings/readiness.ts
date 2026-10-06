// Startklar-Status für „Shop öffnen“ in Produktion (DATENMODELL §13.7, R-210, PLAN P5.22a/P10.14). Rein, ohne
// Server-Abhängigkeiten; die Prüfung selbst liefert `runGoliveCheck` (src/lib/golive) – dieselbe wie `pnpm check:golive`
// und die Ansicht „Startklar“.

export interface StartklarStatus {
  ready: boolean
  /** Offene Punkte (Deutsch, für Fehlermeldung und Ansicht). */
  openItems: string[]
}

/** Status aus dem Prüfbericht. */
export function startklarFromReport(report: {
  ready: boolean
  openItems: string[]
}): StartklarStatus {
  return { ready: report.ready, openItems: [...report.openItems] }
}

/** Meldung, wenn „Shop öffnen“ in Produktion abgelehnt wird (listet alle offenen Punkte). */
export function shopOpenBlockedMessage(status: StartklarStatus): string {
  return `Shop öffnen geht in Produktion erst, wenn die Startklar-Prüfung grün ist. Offen: ${status.openItems.join('; ')}.`
}
