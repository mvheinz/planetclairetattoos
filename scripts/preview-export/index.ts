// Vorschau-Export (ARCHITEKTUR §14, KONZEPT §12, E-98): `pnpm preview:export [--skip-build] [--keep-server]`.
// Ablauf §14.2: Voraussetzungen → Datenbank → Build → Server → Crawl → Umwandlung → Datei → Bericht → Server beenden.
// Exit-Codes: 0 = erfolgreich (auch mit Warnungen) · 1 = Fehler/Budget · 2 = Voraussetzung fehlt (deutsche Anleitung).
import 'dotenv/config'

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import dotenv from 'dotenv'

import { ADMIN_VIEWS } from './adminViews'
import { captureAdminShots } from './adminShots'
import { assemble, type PreviewMessages } from './assemble'
import { captureCartSession } from './cartSession'
import { captureClientRendered } from './clientRendered'
import { crawl, createServerFetcher, paramProviderFor, startSet, type CrawlResult } from './crawl'
import { postgresReachable, prepareExportDatabase } from './db'
import {
  EXPORT_ADMIN_ROUTE,
  EXPORT_DIST_DIR,
  EXPORT_ORIGIN,
  OUTPUT_DIR,
  OUTPUT_HTML,
  OUTPUT_REPORT,
  buildExportEnv,
} from './env'
import { CHROMIUM_HELP, ExportError, POSTGRES_HELP } from './errors'
import { cartAnchors, resolveInventory } from './inventory'
import { displayPhase, resolvePhase } from './phase'
import {
  LIMIT_BYTES,
  TARGET_BYTES,
  buildWithinBudget,
  kindWarnings,
  serializeReport,
  type PreviewReport,
} from './report'
import { bundleRuntime } from './runtime'
import { buildApp, startServer, type RunningServer } from './server'
import { writeOutput } from './write'

export interface ExportArgs {
  skipBuild: boolean
  keepServer: boolean
}

export function parseArgs(argv: readonly string[]): ExportArgs {
  const known = new Set(['--skip-build', '--keep-server'])
  const unknown = argv.filter((a) => a.startsWith('--') && !known.has(a))
  if (unknown.length) {
    throw new ExportError(
      1,
      `Unbekannte Option ${unknown.join(', ')} (erlaubt: --skip-build, --keep-server).`,
    )
  }
  return { skipBuild: argv.includes('--skip-build'), keepServer: argv.includes('--keep-server') }
}

function log(msg: string): void {
  console.log(`[preview:export] ${msg}`)
}

async function checkPrerequisites(): Promise<string> {
  const sourceUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  if (!sourceUrl) throw new ExportError(2, `${POSTGRES_HELP}\n(DATABASE_URL ist nicht gesetzt.)`)
  const pgError = await postgresReachable(sourceUrl)
  if (pgError) throw new ExportError(2, `${POSTGRES_HELP}\n(Technische Meldung: ${pgError})`)
  const { chromium } = await import('@playwright/test')
  let exe = ''
  try {
    exe = chromium.executablePath()
  } catch {
    exe = ''
  }
  if (!exe || !existsSync(exe)) throw new ExportError(2, CHROMIUM_HELP)
  return sourceUrl
}

function gitSha(root: string): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

export async function runExport(args: ExportArgs, root = process.cwd()): Promise<void> {
  await checkPrerequisites()
  const example = dotenv.parse(readFileSync(path.join(root, '.env.example')))
  const now = new Date()
  const planPath = path.join(root, 'PLAN.md')
  const phase = resolvePhase({
    env: process.env.PREVIEW_PHASE,
    plan: existsSync(planPath) ? readFileSync(planPath, 'utf8') : null,
  })
  log(`Phase ${displayPhase(phase)}`)
  const env = buildExportEnv({ source: process.env, example, now, phase })
  const inventory = resolveInventory(env)
  log(
    inventory === 'bestand'
      ? 'Bestand: echte Stücke (content/bestand)'
      : 'Bestand: Demo (Beispielbestand)',
  )

  log(`Datenbank ${env.DATABASE_URL!.replace(/\/\/[^@]*@/, '//…@')} vorbereiten`)
  await prepareExportDatabase(env, root)

  if (args.skipBuild) {
    if (!existsSync(path.join(root, EXPORT_DIST_DIR, 'BUILD_ID'))) {
      throw new ExportError(
        1,
        `--skip-build: ${EXPORT_DIST_DIR} fehlt – erst ohne --skip-build exportieren.`,
      )
    }
    log(`Build übersprungen (${EXPORT_DIST_DIR})`)
  } else {
    log(`Build nach ${EXPORT_DIST_DIR}`)
    buildApp(env)
  }

  let server: RunningServer | null = null
  let result: CrawlResult
  let shots: Awaited<ReturnType<typeof captureAdminShots>>
  try {
    log('Server starten')
    server = await startServer(env)
    // Verwaltungs-Fotos vor dem Korb: Reservierung und Freigabe der Korb-Stücke setzen `updatedAt` auf die Wanduhr – die
    // Stückliste (sortiert und mit Datumsspalte) wäre sonst von Lauf zu Lauf verschieden (AK-A-14-01).
    log('Verwaltungs-Fotos')
    shots = await captureAdminShots({
      origin: server.origin,
      adminRoute: EXPORT_ADMIN_ROUTE,
      email: env.SEED_ADMIN_EMAIL!,
      password: env.SEED_ADMIN_PASSWORD!,
      seedNow: env.SEED_NOW!,
      phase,
      views: ADMIN_VIEWS,
    })
    const anchors = cartAnchors(inventory).map((p) => p.itemNumber)
    log(`Korb und Kasse (Nr. ${anchors.join(' + ')}, „Zur Kasse“)`)
    const cart = await captureCartSession(server.origin, anchors)
    if (inventory === 'demo') {
      log('Im Browser gerenderte Seiten (S08 „schon ein Zuhause“)')
      const rendered = await captureClientRendered(server.origin)
      // Ohne die Browser-Fassung bliebe von S08 nur die leere Fehler-Hülle (kein H1): Export lieber abbrechen, damit
      // der Grund (Warnung mit Konsole/Netz) im Log steht, statt eine kaputte Vorschau-Datei zu schreiben.
      if (rendered.warnings.length > 0) throw new ExportError(1, rendered.warnings.join('\n'))
      for (const [p, r] of rendered.pages) cart.pages.set(p, r)
      cart.warnings.push(...rendered.warnings)
    }
    const fetcher = await createServerFetcher(server.origin)
    try {
      log('Crawl')
      result = await crawl(fetcher.fetch, {
        adminRoute: EXPORT_ADMIN_ROUTE,
        start: startSet(undefined, paramProviderFor(inventory)),
        pinned: cart.pages,
      })
      result.warnings.unshift(...cart.warnings)
      log(
        `${result.pages.length} Seiten, ${result.assets.size} Dateien, ${result.notBuilt.length} Routen noch nicht gebaut`,
      )
    } finally {
      await fetcher.close()
    }
  } finally {
    if (server && !args.keepServer) {
      log('Server beenden')
      await server.stop()
    } else if (server) log(`Server läuft weiter auf ${server.origin} (--keep-server)`)
  }

  log('Umwandlung')
  const runtime = await bundleRuntime(root)
  const messages = loadPreviewMessages(root)
  const built = await buildWithinBudget(async (imageSettings) => {
    const assembled = await assemble({
      crawl: result,
      messages,
      phase: displayPhase(phase),
      seedNow: env.SEED_NOW!,
      imageSettings,
      runtime: runtime.code,
      origin: EXPORT_ORIGIN,
      adminShots: shots.entries,
      inventory,
    })
    return { ...assembled, sizeBytes: Buffer.byteLength(assembled.html) }
  })
  const { result: out } = built
  const file = writeOutput(root, OUTPUT_DIR, OUTPUT_HTML, out.html)
  log(`${file} geschrieben (${(out.sizeBytes / 1_000_000).toFixed(2)} MB, Budget ${built.budget})`)
  const report: PreviewReport = {
    version: 1,
    file: OUTPUT_HTML,
    sizeBytes: out.sizeBytes,
    sizeByKind: out.sizeByKind,
    imageSettings: built.settings,
    routes: out.routes,
    adminViews: shots.entries.map((e) => ({ key: e.key, status: e.image ? 'ok' : 'not-built' })),
    warnings: [
      ...result.warnings,
      ...shots.warnings,
      ...out.warnings,
      ...built.warnings,
      ...kindWarnings(out.sizeByKind),
    ],
    phase,
    gitSha: gitSha(root),
    seedNow: env.SEED_NOW!,
    generatedAt: new Date().toISOString(),
    inventory,
    budget: { limitBytes: LIMIT_BYTES, targetBytes: TARGET_BYTES, result: built.budget },
  }
  writeOutput(root, OUTPUT_DIR, OUTPUT_REPORT, serializeReport(report))
  log(
    `Bericht ${OUTPUT_REPORT}: ${report.routes.length} Routen, ${report.warnings.length} Warnungen`,
  )
}

/** Texte `previewExport.*` aus `src/i18n/messages/{de,en}.json`. */
export function loadPreviewMessages(root: string): Record<'de' | 'en', PreviewMessages> {
  const read = (lang: 'de' | 'en') =>
    (
      JSON.parse(readFileSync(path.join(root, 'src/i18n/messages', `${lang}.json`), 'utf8')) as {
        previewExport: PreviewMessages
      }
    ).previewExport
  return { de: read('de'), en: read('en') }
}

async function main(): Promise<number> {
  try {
    await runExport(parseArgs(process.argv.slice(2)))
    return 0
  } catch (e) {
    if (e instanceof ExportError) {
      console.error(
        `\n[preview:export] ${e.exitCode === 2 ? 'Voraussetzung fehlt' : 'Fehler'}:\n${e.message}`,
      )
      return e.exitCode
    }
    console.error('\n[preview:export] Fehler:', e instanceof Error ? (e.stack ?? e.message) : e)
    return 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = await main()
  process.exit(code)
}
