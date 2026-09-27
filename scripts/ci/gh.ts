import { execFile } from 'node:child_process'

// Lesender Zugriff auf die GitHub-API über die `gh`-CLI (ARCHITEKTUR §6.2, §6.8). Die CI-Hilfsskripte bekommen die
// Funktionen injiziert, damit ihre Tests ohne Netz und ohne `gh` laufen. `{owner}/{repo}` ersetzt `gh` selbst (aus
// `GH_REPO` bzw. dem Git-Remote).

/** Eine Seite bzw. Antwort der API (geparstes JSON). */
export type GhApi = (endpoint: string) => Promise<unknown>
/** Alle Seiten einer Liste (`gh api --paginate --slurp`), je Seite das geparste JSON. */
export type GhApiPages = (endpoint: string) => Promise<unknown[]>

function runGh(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'gh',
      ['api', '-H', 'Accept: application/vnd.github+json', ...args],
      { maxBuffer: 64 * 1024 * 1024, timeout: 120_000 },
      (error, stdout, stderr) => {
        if (error) {
          const code = (error as NodeJS.ErrnoException).code
          const reason =
            code === 'ENOENT'
              ? '`gh` ist nicht installiert'
              : (stderr || error.message).trim().split('\n').slice(-1)[0]
          reject(new Error(reason || 'gh api fehlgeschlagen'))
          return
        }
        resolve(stdout)
      },
    )
  })
}

/** Nur GET – die Skripte rufen ausschließlich lesende Endpunkte auf. */
export const ghApi: GhApi = async (endpoint) =>
  JSON.parse(await runGh(['--method', 'GET', endpoint])) as unknown

export const ghApiPages: GhApiPages = async (endpoint) => {
  const parsed = JSON.parse(
    await runGh(['--method', 'GET', '--paginate', '--slurp', endpoint]),
  ) as unknown
  if (!Array.isArray(parsed)) throw new Error('Unerwartete Antwort von gh api --slurp')
  return parsed
}

/** Kurzform einer Fehlermeldung für Ausgaben. */
export const errorText = (err: unknown): string =>
  err instanceof Error ? err.message : String(err ?? 'unbekannter Fehler')
