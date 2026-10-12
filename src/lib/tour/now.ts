import { getEnv } from '@/lib/env'

/**
 * „Jetzt“ für die Termin-Einteilung und Kokos Schlafenszeit auf der Startseite. In der Testumgebung (`APP_ENV=test`) und
 * im Vorschau-Export (`PREVIEW_EXPORT`, U-78: `SEED_NOW` = Exportdatum 12 Uhr) gilt `SEED_NOW`, damit der Beispielbestand
 * (relativ zu `SEED_NOW`), die visuellen Referenzen und die Vorschau-Datei nicht mit der echten Uhr wandern – eine nachts
 * erzeugte Datei zeigte sonst Koko schlafend; sonst die Uhrzeit.
 */
export function tourNow(
  env: { APP_ENV?: string; SEED_NOW?: string; PREVIEW_EXPORT?: boolean } = getEnv(),
): Date {
  if ((env.APP_ENV === 'test' || env.PREVIEW_EXPORT === true) && env.SEED_NOW) {
    const d = new Date(env.SEED_NOW)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}
