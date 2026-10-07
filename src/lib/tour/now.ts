import { getEnv } from '@/lib/env'

/**
 * „Jetzt“ für die Termin-Einteilung auf der Startseite. In der Testumgebung (`APP_ENV=test`) gilt `SEED_NOW`, damit der
 * Beispielbestand (relativ zu `SEED_NOW`) und die visuellen Referenzen nicht mit der echten Uhr wandern; sonst die Uhrzeit.
 */
export function tourNow(env: { APP_ENV?: string; SEED_NOW?: string } = getEnv()): Date {
  if (env.APP_ENV === 'test' && env.SEED_NOW) {
    const d = new Date(env.SEED_NOW)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}
