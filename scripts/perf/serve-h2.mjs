// HTTP/2-Vorschaltserver für Lighthouse-CI (ARCHITEKTUR §7.7): Die Produktion (Vercel) liefert über HTTP/2 mit TLS;
// `next start` kann nur HTTP/1.1. Mit HTTP/1.1 rechnet die Lighthouse-Simulation (Lantern) mit höchstens sechs
// Verbindungen je Host – der große Framework-Chunk wartete dann auf eine freie Verbindung, und R04 lag je nach
// Ankunftsreihenfolge mal bei ~1,9 s, mal bei ~2,5 s (OFFENE-PUNKTE „P5 CI“). Dieser Server startet `next start` auf
// einem internen Port und reicht jede Anfrage 1:1 durch (Methode, Pfad, Header, Körper; Antwort-Header unverändert,
// inkl. CSP/Cache-Control – nur die in HTTP/2 verbotenen Verbindungs-Header fallen weg).
//
// Zertifikat: zur Laufzeit selbstsigniert per `openssl` (kein Paket), nur für localhost, 1 Tag gültig, im temporären
// Verzeichnis. Chrome akzeptiert es nur, weil tests/perf/lighthouserc.cjs `--ignore-certificate-errors` setzt.
//
// Aufruf (startServerCommand von lhci): `node scripts/perf/serve-h2.mjs`. Ports: PERF_PORT (öffentlich, Standard 3000,
// HTTPS) und PERF_UPSTREAM_PORT (intern, Standard 3100). Meldet „HTTP/2-Vorschaltserver bereit“, sobald beide laufen.

import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import http from 'node:http'
import http2 from 'node:http2'
import { tmpdir } from 'node:os'
import path from 'node:path'

const port = Number(process.env.PERF_PORT || 3000)
const upstreamPort = Number(process.env.PERF_UPSTREAM_PORT || 3100)
export const READY_TEXT = 'HTTP/2-Vorschaltserver bereit'

/** Verbindungs-Header, die HTTP/2 verbietet (RFC 9113 §8.2.2); alle anderen Header bleiben unverändert. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'upgrade',
  'http2-settings',
])

function selfSignedCert() {
  const dir = mkdtempSync(path.join(tmpdir(), 'pc-h2-'))
  const key = path.join(dir, 'key.pem')
  const cert = path.join(dir, 'cert.pem')
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'ec',
      '-pkeyopt',
      'ec_paramgen_curve:prime256v1',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
      '-keyout',
      key,
      '-out',
      cert,
    ],
    { stdio: 'ignore' },
  )
  const pair = { key: readFileSync(key), cert: readFileSync(cert) }
  rmSync(dir, { recursive: true, force: true })
  return pair
}

const agent = new http.Agent({ keepAlive: true, maxSockets: 64 })

function forward(req, res) {
  const headers = {}
  for (const [name, value] of Object.entries(req.headers)) {
    if (name.startsWith(':') || HOP_BY_HOP.has(name)) continue
    headers[name] = value
  }
  headers.host = req.headers[':authority'] || req.headers.host || `localhost:${port}`
  const upstream = http.request(
    { host: '127.0.0.1', port: upstreamPort, method: req.method, path: req.url, headers, agent },
    (up) => {
      const out = {}
      for (const [name, value] of Object.entries(up.headers)) {
        if (!HOP_BY_HOP.has(name)) out[name] = value
      }
      res.writeHead(up.statusCode ?? 502, out)
      up.pipe(res)
    },
  )
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502)
    res.end()
  })
  req.pipe(upstream)
}

const next = spawn('pnpm', ['start', '-p', String(upstreamPort)], {
  stdio: ['ignore', 'pipe', 'inherit'],
  env: process.env,
})
const stop = () => {
  if (!next.killed) next.kill('SIGTERM')
}
process.on('SIGINT', () => (stop(), process.exit(130)))
process.on('SIGTERM', () => (stop(), process.exit(143)))
process.on('exit', stop)
next.on('exit', (code) => process.exit(code ?? 1))

let started = false
next.stdout.on('data', (chunk) => {
  // Ausgabe von Next ohne das Wort, auf das lhci wartet – bereit ist erst der Vorschaltserver.
  process.stdout.write(`[next] ${String(chunk).replaceAll('Ready', 'ready')}`)
  if (started || !/Ready/.test(String(chunk))) return
  started = true
  http2.createSecureServer({ ...selfSignedCert(), allowHTTP1: true }, forward).listen(port, () => {
    process.stdout.write(
      `${READY_TEXT}: https://localhost:${port} → http://127.0.0.1:${upstreamPort}\n`,
    )
  })
})
