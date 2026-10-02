import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildManifest,
  PWA_ICON_FILES,
  pwaPaths,
  SERVICE_WORKER_SOURCE,
} from '@/admin/pwa/manifest'

// P5.29 – Verwaltung als installierbare Web-App (KONZEPT §7.1 „PWA“, ARCHITEKTUR §8.4, DESIGN §12.6): Manifest mit
// Name, Kurzname, start_url „Heute“, scope = Verwaltungspfad, standalone, Icons 192/512 maskierbar; Service Worker ohne
// Daten-Cache und ohne Push; der Verwaltungspfad steht in keiner Datei unter `public/` (T-07). `.next/static` prüft
// `pnpm check:external --built` nach dem Build.

const ROOT = path.resolve(__dirname, '../../..')
const ADMIN = '/werkstatt'

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? listFiles(full) : [full]
  })
}

describe('PWA der Verwaltung (P5.29)', () => {
  it('Manifest: Name, Kurzname, start_url = ADMIN_ROUTE/heute, scope = ADMIN_ROUTE/, standalone, Icons 192/512 any maskable', () => {
    const m = buildManifest(ADMIN)
    expect(m).toMatchObject({
      name: 'Planet Claire Werkstatt',
      short_name: 'Werkstatt',
      start_url: '/werkstatt/heute',
      scope: '/werkstatt/',
      display: 'standalone',
      theme_color: '#2F6B4C',
    })
    expect(m.icons).toEqual([
      expect.objectContaining({
        src: '/werkstatt/pwa/icon-192.png',
        sizes: '192x192',
        purpose: 'any maskable',
      }),
      expect.objectContaining({
        src: '/werkstatt/pwa/icon-512.png',
        sizes: '512x512',
        purpose: 'any maskable',
      }),
    ])
    expect(pwaPaths(ADMIN).serviceWorker).toBe('/werkstatt/sw.js')
  })

  it('T-07 sw.js enthält weder `caches.` noch `push`; `fetch` wird durchgereicht (kein respondWith)', () => {
    expect(SERVICE_WORKER_SOURCE).not.toMatch(/caches\./)
    expect(SERVICE_WORKER_SOURCE).not.toMatch(/push/i)
    expect(SERVICE_WORKER_SOURCE).not.toMatch(/respondWith|indexedDB|localStorage/)
    expect(SERVICE_WORKER_SOURCE).toContain("addEventListener('fetch'")
  })

  it('Icons liegen in src/admin/pwa/ (192, 512, Apple 180) als PNG in der richtigen Größe', () => {
    const sizes: Record<string, number> = {
      'icon-192.png': 192,
      'icon-512.png': 512,
      'apple-touch-icon.png': 180,
    }
    for (const file of PWA_ICON_FILES) {
      const buf = readFileSync(path.join(ROOT, 'src/admin/pwa', file))
      expect(buf.subarray(1, 4).toString('latin1')).toBe('PNG')
      // IHDR: Breite und Höhe ab Byte 16
      expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([sizes[file], sizes[file]])
    }
  })

  it('T-07 kein Dateiname und kein Inhalt unter public/ verrät den Verwaltungspfad; kein Manifest, kein sw.js in public/', () => {
    const files = listFiles(path.join(ROOT, 'public'))
    const rel = files.map((f) => path.relative(ROOT, f))
    expect(rel.filter((f) => /manifest\.webmanifest|(^|\/)sw\.js$|icon-(192|512)/.test(f))).toEqual(
      [],
    )
    const leaks = files.filter((f) => {
      if (path.relative(ROOT, f).includes(ADMIN.slice(1))) return true
      if (/\.(png|jpe?g|webp|avif|ico|woff2?|mp4|webm)$/i.test(f)) return false
      return readFileSync(f, 'utf8').includes(ADMIN)
    })
    expect(leaks).toEqual([])
  })
})
