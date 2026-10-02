import 'server-only'

import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { TAGS } from '@/lib/cache/tags'
import { processorTableRows, type ProcessorTableRow } from '@/lib/legal/services'
import { createLogger } from '@/lib/monitoring/logger'

// Daten der Auftragsverarbeiter-Tabelle unter der Datenschutzerklärung (PLAN P6.21, DIENSTE §7, R-155): Dienste aus der
// generierten YAML-Liste, AVV-Stand aus `settings.processorAgreements` – öffentlich nur „Vertrag eingetragen ja/nein“
// (kein Datum, keine Adresse, keine Datei). Ist die Datenbank nicht erreichbar, steht die Tabelle trotzdem (ohne
// AVV-Stand). Zwischengespeichert mit Tag `settings` (ARCHITEKTUR §9.3).

const log = createLogger()

export async function loadProcessorTableRows(): Promise<ProcessorTableRow[]> {
  try {
    const payload = await getPayload({ config })
    const raw = (await payload.findGlobal({
      slug: 'settings',
      depth: 0,
      overrideAccess: true,
      select: { processorAgreements: true },
    })) as { processorAgreements?: { serviceId: string; signedAt?: string | null }[] | null }
    return processorTableRows(
      (raw.processorAgreements ?? []).map((a) => ({
        serviceId: a.serviceId,
        signedAt: a.signedAt,
      })),
    )
  } catch (err) {
    log.warn('processors.settings_unavailable', { error: (err as Error)?.message })
    return processorTableRows([])
  }
}

export const getProcessorTableRows = (): Promise<ProcessorTableRow[]> =>
  unstable_cache(loadProcessorTableRows, ['processor-table'], {
    tags: [TAGS.settings],
    revalidate: 60,
  })()
