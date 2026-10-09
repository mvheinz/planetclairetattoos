import { formatBerlin } from '@/lib/time'

// Koko schläft nachts (U-53, P14.4): nach Berliner Uhrzeit von 22:00 bis 06:59 hat sie die Lider zu, tagsüber wandern die
// Pupillen. Rein und ohne Server-Zugriff; die Startseite entscheidet beim Rendern (ISR, höchstens eine Stunde alt – wie
// der Zustand der Tour-Termine). „Jetzt“ ist `tourNow()` (in der Testumgebung `SEED_NOW`).

/** Schlafenszeit in vollen Berliner Stunden: ab `from` Uhr bis vor `to` Uhr. */
export const KOKO_SLEEP_HOURS = { from: 22, to: 7 } as const

/** Schläft Koko zum Zeitpunkt `now` (Europe/Berlin, Sommer- und Winterzeit)? */
export function kokoAsleep(now: Date): boolean {
  const hour = Number(formatBerlin(now, 'H'))
  return hour >= KOKO_SLEEP_HOURS.from || hour < KOKO_SLEEP_HOURS.to
}
