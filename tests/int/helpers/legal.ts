import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import type { LegalTextType } from '@/lib/enums'

type Db = { execute: (q: ReturnType<typeof sql>) => Promise<unknown> }

// Test-Fixtures für Rechtstexte (DATENMODELL §6.12). Aktive Fassungen legt nur der Seed-Kontext direkt an (wie der
// Grund-Seed P1.30); die Tests aktivieren sonst über `activateLegalText`.

/** Minimaler Lexical-Inhalt aus Absätzen. */
export function lexical(...paragraphs: string[]) {
  return {
    root: {
      type: 'root',
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        version: 1,
        textFormat: 0,
        children: [
          { type: 'text', text, detail: 0, format: 0, mode: 'normal', style: '', version: 1 },
        ],
      })),
    },
  }
}

export const FIXTURE_TYPES: readonly LegalTextType[] = [
  'agb',
  'widerrufsbelehrung',
  'widerrufsformular',
  'datenschutz',
  'versand-zahlung',
]

/** Legt je Typ eine aktive Test-Fassung an (falls keine aktive existiert) und liefert die Felder für `legalTextVersions`. */
export async function ensureLegalTextFixtures(payload: Payload) {
  const ids: Record<string, number> = {}
  for (const type of FIXTURE_TYPES) {
    const found = await payload.find({
      collection: 'legal-texts',
      where: { and: [{ type: { equals: type } }, { status: { equals: 'active' } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc =
      found.docs[0] ??
      (await payload.create({
        collection: 'legal-texts',
        data: {
          type,
          status: 'active',
          validFrom: '2026-01-01T00:00:00.000Z',
          activatedAt: '2026-01-01T00:00:00.000Z',
          origin: 'placeholder',
          content: lexical('Text folgt von der Kanzlei.'),
          seed: true,
        } as never,
        overrideAccess: true,
        context: { seed: true },
      }))
    ids[type] = doc.id
  }
  return {
    agb: ids.agb!,
    widerrufsbelehrung: ids.widerrufsbelehrung!,
    widerrufsformular: ids.widerrufsformular!,
    datenschutz: ids.datenschutz!,
    versandZahlung: ids['versand-zahlung']!,
  }
}

/** Entfernt alle Rechtstexte (vorher Bestellungen/Kassen löschen: `deleteCommerce`). */
export async function deleteLegalTexts(payload: Payload): Promise<void> {
  const db = (payload.db as unknown as { drizzle: Db }).drizzle
  await db.execute(sql`DELETE FROM legal_texts`)
}
