// `pnpm media:regenerate [--force] [--ids=1,2]` (DATENMODELL §6.2): alle Bildgrößen neu erzeugen, wenn sich die
// Pipeline geändert hat (`derivativesVersion`). Idempotent; nur Entwicklung/Vorschau/Betrieb mit STORAGE_DRIVER=local.
import 'dotenv/config'

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const ids = argv
    .find((a) => a.startsWith('--ids='))
    ?.slice(6)
    .split(',')
    .map(Number)
    .filter(Number.isFinite)
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const { regenerateMedia } = await import('../src/lib/media/regenerate')
  const payload = await getPayload({ config })
  try {
    const r = await regenerateMedia(payload, { force: argv.includes('--force'), ids })
    console.log(
      `media:regenerate: ${r.checked} geprüft, ${r.regenerated.length} neu erzeugt, ${r.skipped} aktuell, ${r.failed.length} Fehler`,
    )
    for (const f of r.failed) console.error(`  Bild ${f.id}: ${f.message}`)
    if (r.failed.length) process.exitCode = 1
  } finally {
    await payload.destroy()
  }
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e: unknown) => {
    console.error(e)
    process.exit(1)
  },
)
