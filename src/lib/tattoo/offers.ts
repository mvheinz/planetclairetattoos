import { addBerlinDays, berlinDayStart } from '@/lib/time'

// Tattoo-Angebote (DATENMODELL §6.15, E-53): ohne Angabe endet ein Angebot am Starttag um 23:59 Uhr (Europe/Berlin).
// Öffentlich sichtbar nur `published = true` und `endsAt > jetzt`; einen gespeicherten Status gibt es nicht.

/** Ende des Starttags 23:59 Uhr Berlin (als UTC-Zeitpunkt). */
export function defaultOfferEnd(startsAt: Date): Date {
  return new Date(berlinDayStart(addBerlinDays(startsAt, 1)).getTime() - 60_000)
}
