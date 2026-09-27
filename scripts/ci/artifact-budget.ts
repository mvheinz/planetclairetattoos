import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { errorText, ghApiPages, type GhApiPages } from './gh'

// Budget-Schritt vor optionalen Uploads (ARCHITEKTUR §6.2, §6.10; `pnpm ci:artifacts`): summiert `size_in_bytes`
// aller nicht abgelaufenen Artefakte des Repositorys und schreibt `upload_optional=true|false` nach $GITHUB_OUTPUT.
// Ab 350 MB (dezimal, strengere Lesart gegenüber MiB) und bei jedem API-Fehler `false`. Scheitert nie (Exit 0).

export const STORAGE_LIMIT_BYTES = 500 * 1_000_000
export const OPTIONAL_UPLOAD_LIMIT_BYTES = 350 * 1_000_000
export const ARTIFACTS_ENDPOINT = 'repos/{owner}/{repo}/actions/artifacts?per_page=100'

export interface BudgetResult {
  uploadOptional: boolean
  totalBytes: number | null
  summary: string
}

interface ArtifactsPage {
  artifacts?: { size_in_bytes?: number; expired?: boolean }[]
}

const mb = (bytes: number) => (bytes / 1_000_000).toFixed(1).replace('.', ',')

/** Summe der nicht abgelaufenen Artefakte über alle Seiten. */
export function sumArtifactBytes(pages: unknown[]): number {
  let total = 0
  for (const page of pages as ArtifactsPage[]) {
    if (!page || !Array.isArray(page.artifacts)) throw new Error('Antwort ohne Liste `artifacts`')
    for (const a of page.artifacts) {
      if (a.expired) continue
      if (typeof a.size_in_bytes !== 'number') throw new Error('Artefakt ohne `size_in_bytes`')
      total += a.size_in_bytes
    }
  }
  return total
}

export async function checkArtifactBudget(pagesOf: GhApiPages = ghApiPages): Promise<BudgetResult> {
  let total: number
  try {
    total = sumArtifactBytes(await pagesOf(ARTIFACTS_ENDPOINT))
  } catch (err) {
    return {
      uploadOptional: false,
      totalBytes: null,
      summary: `Fehlerbericht nicht hochgeladen – Artefakt-Speicher nicht abrufbar (${errorText(err)}).`,
    }
  }
  if (total >= OPTIONAL_UPLOAD_LIMIT_BYTES) {
    return {
      uploadOptional: false,
      totalBytes: total,
      summary: `Fehlerbericht nicht hochgeladen – Artefakt-Speicher fast voll (${mb(total)}/500 MB).`,
    }
  }
  return {
    uploadOptional: true,
    totalBytes: total,
    summary: `Artefakt-Speicher ${mb(total)}/500 MB – Fehlerbericht wird hochgeladen.`,
  }
}

export interface BudgetIo {
  env: Record<string, string | undefined>
  append: (file: string, text: string) => void
  log: (line: string) => void
}

/** Schreibt Ausgabe und Job-Summary; wirft nie. */
export async function runArtifactBudget(
  pagesOf: GhApiPages = ghApiPages,
  io: BudgetIo = {
    env: process.env,
    append: (f, t) => appendFileSync(f, t),
    log: (l) => console.log(l),
  },
): Promise<BudgetResult> {
  const result = await checkArtifactBudget(pagesOf).catch((err: unknown): BudgetResult => ({
    uploadOptional: false,
    totalBytes: null,
    summary: `Fehlerbericht nicht hochgeladen – Budget-Prüfung fehlgeschlagen (${errorText(err)}).`,
  }))
  const line = `upload_optional=${result.uploadOptional}`
  const write = (file: string | undefined, text: string) => {
    if (!file) return
    try {
      io.append(file, text)
    } catch (err) {
      io.log(`Hinweis: ${file} nicht beschreibbar (${errorText(err)})`)
    }
  }
  write(io.env.GITHUB_OUTPUT, `${line}\n`)
  write(io.env.GITHUB_STEP_SUMMARY, `${result.summary}\n`)
  io.log(line)
  io.log(result.summary)
  return result
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void runArtifactBudget().finally(() => process.exit(0))
}
