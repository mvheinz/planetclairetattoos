// Vorschau-Export (ARCHITEKTUR §14, KONZEPT §12, E-98): `pnpm preview:export [--skip-build] [--keep-server]`.
// Ablauf §14.2: Voraussetzungen → Datenbank → Build → Server → Crawl → Umwandlung → Datei → Bericht → Server beenden.
// Exit-Codes: 0 = erfolgreich (auch mit Warnungen) · 1 = Fehler/Budget · 2 = Voraussetzung fehlt (deutsche Anleitung).
import 'dotenv/config'

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import dotenv from 'dotenv'

import { assemble, type PreviewMessages } from './assemble'
import { crawl, createServerFetcher, seedParamProvider, startSet, type CrawlResult } from './crawl'
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
import { bundleRuntime } from './runtime'
import { buildApp, startServer, type RunningServer } from './server'
import { DEFAULT_IMAGE_SETTINGS } from './transform/images'
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
  const phase = (process.env.PREVIEW_PHASE || 'px').toLowerCase()
  const env = buildExportEnv({ source: process.env, example, now, phase })

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
  try {
    log('Server starten')
    server = await startServer(env)
    const fetcher = await createServerFetcher(server.origin)
    try {
      log('Crawl')
      result = await crawl(fetcher.fetch, {
        adminRoute: EXPORT_ADMIN_ROUTE,
        start: startSet(undefined, seedParamProvider),
      })
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
  const assembled = await assemble({
    crawl: result,
    messages: loadPreviewMessages(root),
    phase: env.PREVIEW_PHASE!,
    seedNow: env.SEED_NOW!,
    imageSettings: DEFAULT_IMAGE_SETTINGS,
    runtime: runtime.code,
    origin: EXPORT_ORIGIN,
  })
  const file = writeOutput(root, OUTPUT_DIR, OUTPUT_HTML, assembled.html)
  log(`${file} geschrieben (${Buffer.byteLength(assembled.html)} Byte)`)
  writeOutput(
    root,
    OUTPUT_DIR,
    OUTPUT_REPORT,
    `${JSON.stringify(
      {
        version: 1,
        phase,
        gitSha: gitSha(root),
        seedNow: env.SEED_NOW,
        sizeBytes: Buffer.byteLength(assembled.html),
        sizeByKind: assembled.sizeByKind,
        routes: assembled.routes,
        warnings: [...result.warnings, ...assembled.warnings],
      },
      null,
      2,
    )}\n`,
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
