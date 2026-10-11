// Import des echten Bestands (U-76, PLAN P16.2): `pnpm bestand:import [--only=B001,B002] [--preview]`.
// Legt die Stücke aus `content/bestand/products.json` mit ihren Fotos als Entwürfe an (echte Daten, `seed: false`,
// Vermerk „bitte prüfen“). Wiederholbar: schon importierte Stücke werden übersprungen. `--preview` nur für die
// Vorschau-Datei (SEED_PREVIEW_MODE=true, nie in Produktion): Stücke sofort „verfügbar“, Zeitpunkt aus SEED_NOW.
// Die Logik liegt in src/lib/bestand/.
import { parseBestandArgs, previewBlockedReason } from '../../src/lib/bestand/args'
import { loadBestand } from '../../src/lib/bestand/schema'
import { parseSeedNow } from '../../src/lib/seed/time'
import { systemClock } from '../../src/lib/time'

async function main(): Promise<void> {
  const args = parseBestandArgs(process.argv.slice(2))
  // Skripte dürfen vor dem App-Start process.env lesen (ARCHITEKTUR §5.1).
  const blocked = args.preview ? previewBlockedReason(process.env) : null
  if (blocked) throw new Error(blocked)
  const products = await loadBestand()
  const unknownKeys = (args.only ?? []).filter((k) => !products.some((p) => p.key === k))
  if (unknownKeys.length > 0) throw new Error(`Unbekannte Stücke: ${unknownKeys.join(', ')}`)
  const now = args.preview ? parseSeedNow(process.env.SEED_NOW, systemClock) : undefined

  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config')
  const { importBestand } = await import('../../src/lib/bestand/import')
  const payload = await getPayload({ config })
  try {
    const result = await importBestand(payload, products, {
      only: args.only,
      previewPublish: now ? { now } : undefined,
      log: (line) => console.log(`  ${line}`),
    })
    console.log(
      `bestand:import – ${result.created.length} angelegt, ${result.existing.length} schon vorhanden, ` +
        `${result.skipped.length} übersprungen; Fotos: ${result.media.created} neu, ${result.media.reused} wiederverwendet`,
    )
    for (const s of result.skipped) console.log(`  ${s.key}: ${s.reason}`)
    if (result.skipped.length > 0) process.exitCode = 1
  } finally {
    await payload.destroy()
  }
}

// `payload run` beendet den Prozess, sobald der Import des Skripts fertig ist – daher Top-Level-await.
try {
  await main()
  process.exit(process.exitCode ?? 0)
} catch (e: unknown) {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
}
