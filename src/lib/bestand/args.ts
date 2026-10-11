// Aufruf von `pnpm bestand:import` (PLAN P16.2): reine Funktionen, getestet ohne Payload.

export interface BestandCliArgs {
  only?: string[]
  preview: boolean
}

export const BESTAND_USAGE = 'Aufruf: pnpm bestand:import [--only=B001,B002] [--preview]'

export function parseBestandArgs(argv: readonly string[]): BestandCliArgs {
  const unknown = argv.filter((a) => a !== '--preview' && !a.startsWith('--only=') && a !== '--')
  if (unknown.length > 0)
    throw new Error(`Unbekannte Angabe ${unknown.join(' ')}. ${BESTAND_USAGE}`)
  const only = argv.find((a) => a.startsWith('--only='))
  const keys = only ? only.slice('--only='.length).split(',').filter(Boolean) : undefined
  if (keys && keys.length === 0) throw new Error(`--only ohne Stücke. ${BESTAND_USAGE}`)
  return { preview: argv.includes('--preview'), only: keys }
}

/** `--preview` nur im Vorschau-Modus (Beispieldaten sichtbar) und nie in Produktion; sonst der Grund. */
export function previewBlockedReason(env: Record<string, string | undefined>): string | null {
  if (env.APP_ENV === 'production') return '--preview ist in Produktion gesperrt.'
  if (env.SEED_PREVIEW_MODE !== 'true')
    return '--preview nur mit SEED_PREVIEW_MODE=true (Vorschau-Datei).'
  return null
}
