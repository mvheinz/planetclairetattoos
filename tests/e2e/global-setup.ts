import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { FullConfig } from '@playwright/test'

// Wartepunkt für E2E gegen den Produktions-Build (`E2E_SERVER=start`, ARCHITEKTUR §7.2).
//
// Ursache der früheren Erstlauf-Fehler (Rechtsseiten, Wiederholungen grün): `next build` rendert die statischen Seiten
// (R01, R19–R25, R27, sitemap …) mit dem Datenbank-Stand **zur Build-Zeit** vor. `pnpm test:e2e` setzt die Test-Datenbank
// danach zurück (`db:reset --test --seed=all`, ohne Cache-Erneuerung, weil Seed nie revalidiert) – oder der Build lief gegen
// eine andere Datenbank (lokal `DATABASE_URL` statt `DATABASE_URL_TEST`). Der erste Aufruf jeder Seite lieferte dann den
// eingebackenen Build-Stand (stale-while-revalidate) und erst der zweite den Stand der Test-Datenbank.
//
// Abhilfe: Nach dem Start (Playwright startet `webServer` vor `globalSetup`) wird jede vorgerenderte Route einmal per
// On-Demand-Revalidierung neu erzeugt – dieselbe Mechanik, die Next für `res.revalidate()` nutzt (Kopf
// `x-prerender-revalidate` mit der geheimen `previewModeId` aus dem Build, nie öffentlich). Dabei liest `unstable_cache`
// nicht aus dem Daten-Cache, sondern frisch aus der Test-Datenbank. Erst danach laufen die Tests; jede Seite antwortet
// ab dem ersten Aufruf mit dem Stand der Test-Datenbank und muss nichts mehr rechnen.
// Anfragen mit `x-prerender-revalidate` umgehen den Proxy – deshalb erreichen sie auch die internen Pfade der
// Listen-Varianten (`/de/shop/variant/available-1`, Spike B-05), die sonst mit 404 antworten.

interface PrerenderManifest {
  preview: { previewModeId: string }
  routes: Record<string, { initialRevalidateSeconds?: number | false }>
}

/** Routen, deren Inhalt aus der Datenbank kommt und die zeitgesteuert erneuert werden (ISR). */
export function revalidatableRoutes(manifest: PrerenderManifest): string[] {
  return Object.entries(manifest.routes)
    .filter(([, r]) => typeof r.initialRevalidateSeconds === 'number')
    .map(([route]) => route)
    .sort()
}

export default async function globalSetup(_config: FullConfig) {
  if (process.env.E2E_SERVER !== 'start') return
  const distDir = process.env.NEXT_DIST_DIR || '.next'
  const manifestPath = path.join(
    // Repo-Wurzel relativ zu dieser Datei (auch für Konfigurationen außerhalb der Wurzel, z. B. scripts/legal/)
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
    distDir,
    'prerender-manifest.json',
  )
  if (!existsSync(manifestPath)) {
    throw new Error(
      `E2E_SERVER=start ohne Produktions-Build (${manifestPath} fehlt) – erst pnpm build.`,
    )
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PrerenderManifest
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
  const routes = revalidatableRoutes(manifest)
  const failures: string[] = []
  // Nacheinander: Payload-Kaltstart einmal, danach je Route wenige Millisekunden.
  for (const route of routes) {
    const res = await fetch(new URL(route, baseURL), {
      headers: { 'x-prerender-revalidate': manifest.preview.previewModeId },
      redirect: 'manual',
    })
    await res.arrayBuffer()
    const cache = res.headers.get('x-nextjs-cache')
    if (res.status !== 200 || cache !== 'REVALIDATED') {
      failures.push(`${route}: HTTP ${res.status}, x-nextjs-cache=${cache ?? '–'}`)
    }
  }
  if (failures.length) {
    throw new Error(`Vorwärmen der vorgerenderten Seiten fehlgeschlagen:\n${failures.join('\n')}`)
  }
}
