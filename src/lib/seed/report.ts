import 'server-only'

// Bericht eines Seed-Laufs: je Collection angelegt / aktualisiert / übersprungen / unverändert (SEED-SPEC §1.4).

export const SEED_OUTCOMES = [
  'created',
  'updated',
  'skipped',
  'unchanged',
  'deleted',
  'adopted',
] as const
export type SeedOutcome = (typeof SEED_OUTCOMES)[number]

const LABELS: Record<SeedOutcome, string> = {
  created: 'angelegt',
  updated: 'aktualisiert',
  skipped: 'übersprungen',
  unchanged: 'unverändert (create-only)',
  deleted: 'gelöscht',
  adopted: 'übernommen',
}

export class SeedReport {
  readonly counts = new Map<string, Record<SeedOutcome, number>>()
  readonly notes: string[] = []

  add(collection: string, outcome: SeedOutcome, n = 1): void {
    const row =
      this.counts.get(collection) ??
      (Object.fromEntries(SEED_OUTCOMES.map((o) => [o, 0])) as Record<SeedOutcome, number>)
    row[outcome] += n
    this.counts.set(collection, row)
  }

  note(line: string): void {
    this.notes.push(line)
  }

  get(collection: string, outcome: SeedOutcome): number {
    return this.counts.get(collection)?.[outcome] ?? 0
  }

  /** Zeilen für die Konsole, z. B. „products: 10 angelegt, 0 aktualisiert, 0 übersprungen“. */
  lines(): string[] {
    const out: string[] = []
    for (const [collection, row] of this.counts) {
      const parts = SEED_OUTCOMES.filter(
        (o) => row[o] > 0 || o === 'created' || o === 'updated' || o === 'skipped',
      ).map((o) => `${row[o]} ${LABELS[o]}`)
      out.push(`${collection}: ${parts.join(', ')}`)
    }
    return [...out, ...this.notes]
  }
}
