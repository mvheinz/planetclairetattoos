// Startklar-Prüfung für „Shop öffnen“ in Produktion (DATENMODELL §13.7, R-210, PLAN P5.22a). Bis P10.14 gilt die Prüfung
// in Produktion als nicht grün; P10.14 ersetzt `startklarStatus` durch die echte Prüffunktion (dieselbe wie
// `pnpm check:golive` und die Seite „Startklar“). Rein, ohne Server-Abhängigkeiten.

export interface StartklarStatus {
  ready: boolean
  /** Offene Punkte (Deutsch, für Fehlermeldung und Ansicht). */
  openItems: string[]
}

export const STARTKLAR_LATER = 'Startklar-Prüfung kommt in P10'

/** Stand der Startklar-Prüfung (Platzhalter bis P10.14: nie grün). */
export function startklarStatus(): StartklarStatus {
  return { ready: false, openItems: [STARTKLAR_LATER] }
}

/** Meldung, wenn „Shop öffnen“ in Produktion abgelehnt wird. */
export function shopOpenBlockedMessage(status: StartklarStatus): string {
  return `Shop öffnen geht in Produktion erst, wenn die Startklar-Prüfung grün ist. Offen: ${status.openItems.join('; ')}.`
}

/**
 * Für P10.14 vorgemerkte Prüfpunkte (PLAN P8.20): Die echte Prüffunktion übernimmt sie in ihre Liste (rot, solange
 * `count` > 0). Zähler liefern die genannten Funktionen.
 */
export const STARTKLAR_PLANNED = [
  {
    id: 'owner-photos-unapproved',
    text: 'Fotos von Jutta ohne ihre Freigabe („Jutta hat dieses Foto von sich freigegeben“)',
    ref: 'R-181, DATENMODELL §6.2, PLAN P8.20',
    counter: 'countUnapprovedOwnerPhotos (src/lib/media/ownerPhotos.ts)',
  },
] as const
