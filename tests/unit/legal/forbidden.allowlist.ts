// Allowlist zum Verbotsmuster-Scan (RECHT §5, `forbidden.unit.spec.ts`): je Eintrag Datei, Verbots-ID, optional der
// getroffene Text und eine Begründung. Nicht mehr gebrauchte Einträge lassen den Test scheitern.

export interface AllowlistEntry {
  /** Pfad relativ zum Repo, mit `/`. */
  file: string
  id: string
  /** Teilstring des Treffers; ohne Angabe gilt der Eintrag für alle Treffer dieser ID in der Datei. */
  match?: string
  reason: string
}

export const FORBIDDEN_ALLOWLIST: readonly AllowlistEntry[] = [
  {
    file: 'src/lib/legal/forbidden.ts',
    id: 'V-15',
    match: 'allergiefrei',
    reason:
      'Die Lint-Liste V-13 selbst: Muster, mit denen Produkttexte geprüft werden (DATENMODELL §6.6.6).',
  },
  {
    file: 'content/seed/instagram/manifest.json',
    id: 'V-16',
    match: 'Godzilla',
    reason:
      'Tattoo-Portfolio, keine Verkaufsware (E-18): Bildunterschrift des Galerie-Tattoos G2 aus dem Manifest (SEED-SPEC §2.1, SE-04).',
  },
]
