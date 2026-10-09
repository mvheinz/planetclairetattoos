import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import path from 'node:path'

import 'dotenv/config'

import {
  GITLEAKS_SHA256,
  GITLEAKS_VERSION,
  latestArtRun,
  parseArgs,
  planSteps,
  ports,
  repoFromRemote,
  SKIP_MARKER,
  envFor,
  inheritedEnv,
  summarize,
  USAGE,
  UsageError,
  type Options,
  type RunContext,
  type Step,
  type StepReport,
  type StepResult,
} from './ci/local-plan'

// `pnpm ci:local <quick|full|art>` – lokale Prüfschleuse statt GitHub Actions (U-65/U-66, ARCHITEKTUR §6). Führt die
// Schritte aus `scripts/ci/local-plan.ts` nacheinander aus, jeden mit eigener Logdatei unter
// `ci-reports/<zeit>-<sha7>-<modus>/`, und schreibt am Ende `report.json` und eine Zusammenfassung. Mit `--status` setzt
// es den Commit-Status `lokal/ci-<modus>` über die GitHub-API (keine Actions-Minuten). Jeder Schritt läuft in einer
// eigenen Prozessgruppe; bei Abbruch (Strg+C, Zeitgrenze) wird genau diese Gruppe beendet – nie per Muster.

const ROOT = process.cwd()

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, () => srv.close(() => resolve(true)))
  })
}

function have(cmd: string, args: string[] = ['--version']): boolean {
  return spawnSync(cmd, args, { stdio: 'ignore' }).status === 0
}

let current: { pid: number } | null = null
function killCurrent(signal: NodeJS.Signals = 'SIGTERM'): void {
  if (!current) return
  try {
    process.kill(-current.pid, signal) // ganze Prozessgruppe des Schritts (Server, Browser, Worker)
  } catch {
    // schon beendet
  }
}
for (const sig of ['SIGINT', 'SIGTERM'] as const)
  process.on(sig, () => {
    console.error(`\nci:local: ${sig} – beende den laufenden Schritt.`)
    killCurrent('SIGTERM')
    setTimeout(() => killCurrent('SIGKILL'), 5000).unref()
    setTimeout(() => process.exit(130), 6000).unref()
  })

/** Führt einen Befehl in eigener Prozessgruppe aus, Ausgabe in Konsole (gekürzt) und Logdatei. */
function runShell(
  cmd: string,
  env: NodeJS.ProcessEnv,
  logFile: string,
  timeoutMin: number,
): Promise<{ code: number; skipNote?: string; warnNote?: string }> {
  return new Promise((resolve) => {
    const log = createWriteStream(logFile, { flags: 'a' })
    log.write(`$ ${cmd}\n\n`)
    const child = spawn('bash', ['-o', 'pipefail', '-c', cmd], {
      cwd: ROOT,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    current = { pid: child.pid! }
    let skipNote: string | undefined
    let warnNote: string | undefined
    let tail = ''
    const onData = (buf: Buffer) => {
      const text = buf.toString()
      log.write(text)
      tail = (tail + text).slice(-4000)
      for (const line of text.split('\n')) {
        const i = line.indexOf(SKIP_MARKER)
        if (i >= 0) skipNote = line.slice(i + SKIP_MARKER.length).trim()
        if (line.startsWith('CI_LOCAL_WARN:')) warnNote = line.slice('CI_LOCAL_WARN:'.length).trim()
      }
    }
    child.stdout!.on('data', onData)
    child.stderr!.on('data', onData)
    const timer = setTimeout(() => {
      log.write(`\nci:local: Zeitgrenze ${timeoutMin} min überschritten – Schritt wird beendet.\n`)
      killCurrent('SIGTERM')
      setTimeout(() => killCurrent('SIGKILL'), 10_000).unref()
    }, timeoutMin * 60_000)
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      // Reste der Gruppe (z. B. ein vom Test gestarteter Server) aufräumen.
      killCurrent('SIGTERM')
      current = null
      log.end(`\n[exit ${code ?? signal}]\n`)
      if (code !== 0) process.stdout.write(tail.split('\n').slice(-25).join('\n') + '\n')
      resolve({ code: code ?? 1, skipNote, warnNote })
    })
  })
}

/** gitleaks aus PATH, sonst gepinnte Version mit Prüfsumme in ~/.cache/planetclaire-ci laden. */
function gitleaksBinary(): { bin: string | null; note: string } {
  if (have('gitleaks', ['version'])) return { bin: 'gitleaks', note: 'gitleaks aus PATH' }
  const dir = path.join(homedir(), '.cache', 'planetclaire-ci', `gitleaks-${GITLEAKS_VERSION}`)
  const bin = path.join(dir, 'gitleaks')
  if (existsSync(bin)) return { bin, note: `gitleaks ${GITLEAKS_VERSION} (Cache)` }
  mkdirSync(dir, { recursive: true })
  const tgz = path.join(dir, 'gitleaks.tgz')
  const url = `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz`
  const dl = spawnSync('curl', ['-sSfL', '-o', tgz, url], { stdio: 'ignore', timeout: 120_000 })
  if (dl.status !== 0 || !existsSync(tgz))
    return { bin: null, note: `Download fehlgeschlagen (${url})` }
  const sum = createHash('sha256').update(readFileSync(tgz)).digest('hex')
  if (sum !== GITLEAKS_SHA256) return { bin: null, note: `Prüfsumme falsch (${sum})` }
  spawnSync('tar', ['-xzf', tgz, '-C', dir, 'gitleaks'], { stdio: 'ignore' })
  return existsSync(bin)
    ? { bin, note: `gitleaks ${GITLEAKS_VERSION} geladen, Prüfsumme ok` }
    : { bin: null, note: 'Entpacken fehlgeschlagen' }
}

/** Ersatz ohne gitleaks: offensichtliche Schlüssel-Muster in versionierten Dateien (außer tests/, docs/). */
const FALLBACK_PATTERNS: [string, RegExp][] = [
  ['Stripe-Live-Schlüssel', /\b[sr]k_live_[0-9a-zA-Z]{16,}/],
  ['AWS-Zugangsschlüssel', /\bAKIA[0-9A-Z]{16}\b/],
  ['privater Schlüssel', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub-Token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
]

function secretsCommand(): { cmd: string; warn?: string } {
  const { bin, note } = gitleaksBinary()
  if (bin) {
    let range = ''
    try {
      const base = git(['merge-base', 'HEAD', 'origin/main'])
      if (base && base !== git(['rev-parse', 'HEAD'])) range = ` --log-opts="${base}..HEAD"`
    } catch {
      // kein origin/main: ganze Historie
    }
    return {
      // Wie ci.yml: die Commits des Arbeitsbranches seit main (ohne eigene Commits: ganze Historie).
      cmd: `echo "${note}" && "${bin}" detect --source . --config .gitleaks.toml --redact --no-banner${range}`,
    }
  }
  // Ersatzprüfung – deutlich als Hinweis gemeldet, nie still grün.
  const files = git(['ls-files'])
    .split('\n')
    .filter((f) => f && !/^(tests|docs)\//.test(f))
  const hits: string[] = []
  for (const f of files) {
    let text: string
    try {
      text = readFileSync(path.join(ROOT, f), 'utf8')
    } catch {
      continue
    }
    for (const [name, re] of FALLBACK_PATTERNS) if (re.test(text)) hits.push(`${f}: ${name}`)
  }
  const msg = `gitleaks nicht verfügbar (${note}) – nur Ersatzprüfung auf ${FALLBACK_PATTERNS.length} Muster in ${files.length} Dateien`
  return hits.length
    ? { cmd: `echo ${JSON.stringify(`${msg}: ${hits.join('; ')}`)}; exit 1` }
    : { cmd: `echo "CI_LOCAL_WARN: ${msg}, ohne Fund"`, warn: msg }
}

function setCommitStatus(
  mode: string,
  sha: string,
  ok: boolean,
  line: string,
  reportDir: string,
): string {
  const remote = git(['remote', 'get-url', 'origin'])
  const repo = repoFromRemote(remote)
  if (!repo) return `Commit-Status nicht gesetzt: Repository aus ${remote} nicht erkennbar.`
  const args = [
    'api',
    '-X',
    'POST',
    `repos/${repo}/statuses/${sha}`,
    '-f',
    `state=${ok ? 'success' : 'failure'}`,
    '-f',
    `context=lokal/ci-${mode}`,
    '-f',
    `description=${line.slice(0, 140)}`,
  ]
  const res = spawnSync('gh', args, { encoding: 'utf8' })
  if (res.error) return `Commit-Status nicht gesetzt: \`gh\` fehlt (${res.error.message}).`
  if (res.status !== 0)
    return `Commit-Status nicht gesetzt: ${(res.stderr || res.stdout).trim().split('\n').at(-1)}`
  writeFileSync(path.join(reportDir, 'status.json'), res.stdout)
  return `Commit-Status lokal/ci-${mode} = ${ok ? 'success' : 'failure'} an ${sha.slice(0, 7)} gesetzt.`
}

function statusPreconditions(opts: Options): string | null {
  if (opts.only || opts.from) return 'Teillauf (--only/--from) – Status nur für vollständige Läufe.'
  if (git(['status', '--porcelain'])) return 'Arbeitsbaum nicht sauber.'
  const pushed = git(['branch', '-r', '--contains', 'HEAD'])
  if (!pushed) return 'HEAD ist noch nicht gepusht (kein Remote-Branch enthält ihn).'
  return null
}

async function main(): Promise<number> {
  let opts: Options
  let steps: Step[]
  try {
    opts = parseArgs(process.argv.slice(2))
    steps = planSteps(opts)
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(`ci:local: ${err.message}\n\n${USAGE}`)
      return 2
    }
    throw err
  }
  const sha = git(['rev-parse', 'HEAD'])
  const sha7 = sha.slice(0, 7)
  const sourceDb =
    process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/planetclaire'
  const p = ports(opts.port)

  console.log(
    `ci:local ${opts.mode} @ ${sha7} – ${steps.length} Schritte, DB ${opts.db}(_test), Ports ${opts.port}–${opts.port + 5}`,
  )
  if (opts.dryRun) {
    for (const s of steps) console.log(`  ${s.id.padEnd(14)} ${s.title}`)
    return 0
  }
  if (opts.status) {
    const why = statusPreconditions(opts)
    if (why) {
      console.error(`ci:local: --status nicht möglich: ${why}`)
      return 2
    }
  }
  const busy: number[] = []
  for (const port of Object.values(p)) if (!(await portFree(port))) busy.push(port)
  if (busy.length) {
    console.error(
      `ci:local: Ports belegt: ${busy.join(', ')} – anderen Port mit --port wählen oder den Prozess beenden.`,
    )
    return 2
  }

  const reportDir = path.join(ROOT, 'ci-reports', `${stamp()}-${sha7}-${opts.mode}`)
  mkdirSync(reportDir, { recursive: true })
  const ctx: RunContext = { opts }
  const reports: StepReport[] = []
  const dockerOk = have('docker', ['info'])
  let failed = false
  const started = new Date()

  for (const [i, step] of steps.entries()) {
    const log = path.join(reportDir, `${String(i + 1).padStart(2, '0')}-${step.id}.log`)
    const rel = path.relative(ROOT, log)
    const base: Omit<StepReport, 'result' | 'seconds'> = {
      id: step.id,
      title: step.title,
      log: rel,
    }
    if (failed && !opts.keepGoing && !step.always) {
      reports.push({ ...base, result: 'not-run', seconds: 0 })
      continue
    }
    if (step.requires === 'docker' && !dockerOk) {
      writeFileSync(log, 'docker nicht verfügbar (docker info fehlgeschlagen)\n')
      reports.push({ ...base, result: 'skipped', seconds: 0, note: 'docker nicht verfügbar' })
      console.log(`⊘ ${step.id}: übersprungen – docker nicht verfügbar`)
      continue
    }
    let cmd: string
    let warn: string | undefined
    try {
      if (step.cmd === 'internal:secrets') ({ cmd, warn } = secretsCommand())
      else cmd = typeof step.cmd === 'function' ? step.cmd(ctx) : step.cmd
    } catch (err) {
      writeFileSync(log, `${(err as Error).message}\n`)
      reports.push({
        ...base,
        result: step.always ? 'not-run' : 'failed',
        seconds: 0,
        note: (err as Error).message,
      })
      if (!step.always) failed = true
      continue
    }
    console.log(`▶ ${step.id}: ${step.title}`)
    const t0 = Date.now()
    const res = await runShell(
      cmd,
      { ...inheritedEnv(process.env), ...envFor(step, opts, sourceDb) } as NodeJS.ProcessEnv,
      log,
      step.timeoutMin,
    )
    const seconds = Math.round((Date.now() - t0) / 1000)
    let result: StepResult = res.code === 0 ? 'passed' : 'failed'
    let note: string | undefined
    if (result === 'passed' && res.skipNote) [result, note] = ['skipped', res.skipNote]
    else if (result === 'passed' && (res.warnNote || warn))
      [result, note] = ['warn', res.warnNote ?? warn]
    if (step.id === 'art-record')
      ctx.artRunId = latestArtRun(
        existsSync('artifacts/art-qa') ? readdirSync('artifacts/art-qa') : [],
      )
    reports.push({ ...base, result, seconds, ...(note ? { note } : {}) })
    const mark = { passed: '✓', failed: '✗', skipped: '⊘', warn: '!', 'not-run': '·' }[result]
    console.log(
      `${mark} ${step.id}: ${result} (${Math.round(seconds / 6) / 10} min)${note ? ` – ${note}` : ''}${result === 'failed' ? ` – Log: ${rel}` : ''}`,
    )
    if (result === 'failed') failed = true
  }

  const { ok, line } = summarize(reports)
  const report = {
    mode: opts.mode,
    sha,
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    dirty: git(['status', '--porcelain']) !== '',
    started: started.toISOString(),
    finished: new Date().toISOString(),
    db: opts.db,
    ports: p,
    options: { only: opts.only, from: opts.from, keepGoing: opts.keepGoing, e2eArgs: opts.e2eArgs },
    artRunId: ctx.artRunId ?? null,
    ok,
    summary: line,
    steps: reports,
  }
  writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`\nci:local ${opts.mode} @ ${sha7}: ${ok ? 'GRÜN' : 'ROT'} – ${line}`)
  for (const r of reports)
    console.log(
      `  ${r.result.padEnd(8)} ${r.id.padEnd(14)} ${String(Math.round(r.seconds / 6) / 10).padStart(6)} min${r.note ? `  ${r.note}` : ''}`,
    )
  console.log(`Bericht: ${path.relative(ROOT, path.join(reportDir, 'report.json'))}`)
  if (opts.status) console.log(setCommitStatus(opts.mode, sha, ok, line, reportDir))
  return ok ? 0 : 1
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err)
    killCurrent('SIGKILL')
    process.exit(1)
  },
)
