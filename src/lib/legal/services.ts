import 'server-only'

import { SERVICES, type ServiceEntry } from './services.generated'

// Dienste-Daten (PLAN P6.21, DIENSTE §6/§7, R-155): Auswahl aus der generierten Liste für Einstellungen →
// „Auftragsverarbeitung“ und für die Auftragsverarbeiter-Tabelle unter der Datenschutzerklärung (`ProcessorTable`).

export type { ServiceEntry }

export interface ProcessorAgreementRow {
  serviceId: string
  signedAt?: string | null
  documentVersion?: string | null
  url?: string | null
  file?: number | { id: number } | null
}

/** Einstellungen → „Auftragsverarbeitung“: alle Dienste mit `avv: required` (Reihenfolge der YAML). */
export function processorAgreementServices(): ServiceEntry[] {
  return SERVICES.filter((s) => s.avv === 'required')
}

/** Go-live-Gate R-210 (folgt in P10): `avv: required` und `production: true`. */
export function requiredProductionAgreements(): ServiceEntry[] {
  return SERVICES.filter((s) => s.avv === 'required' && s.production)
}

export function isKnownServiceId(id: unknown): boolean {
  return typeof id === 'string' && SERVICES.some((s) => s.id === id)
}

export interface ProcessorTableRow {
  id: string
  name: string
  role: ServiceEntry['role']
  seat: { de: string; en: string }
  thirdCountry: ServiceEntry['thirdCountry']
  /** Vertrag nach Art. 28 DSGVO in `settings.processorAgreements` mit Datum eingetragen (bzw. über `avvCoveredBy`). */
  agreementSigned: boolean
}

/**
 * Zeilen der Empfänger-Tabelle: alle Dienste mit `production: true` (DIENSTE §7) – unabhängig vom Rechtstext und ohne
 * Token (R-012). Der AVV-Stand kommt aus `settings.processorAgreements`.
 */
export function processorTableRows(
  agreements: readonly ProcessorAgreementRow[] | null | undefined,
): ProcessorTableRow[] {
  const signed = new Set(
    (agreements ?? []).filter((a) => Boolean(a.signedAt)).map((a) => a.serviceId),
  )
  return SERVICES.filter((s) => s.production).map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    seat: s.seat,
    thirdCountry: s.thirdCountry,
    agreementSigned:
      signed.has(s.id) || (s.avv === 'coveredBy' && !!s.avvCoveredBy && signed.has(s.avvCoveredBy)),
  }))
}

/** Erlaubte Fremd-Hosts je CSP-Kontext laut YAML (Vereinigung über alle Dienste und Direktiven, T-16). */
export function yamlCspHosts(context: string): Set<string> {
  const out = new Set<string>()
  for (const s of SERVICES) {
    const directives = (s.csp as Record<string, Record<string, readonly string[]>>)[context] ?? {}
    for (const hosts of Object.values(directives)) for (const h of hosts) out.add(h)
  }
  return out
}
