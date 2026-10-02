import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { PWA_ICON_FILES, type PwaIconFile } from '@/admin/pwa/manifest'

// App-Icons der Verwaltung unter `ADMIN_ROUTE/pwa/<Datei>` (PLAN P5.29, DESIGN §12.6): Dateien aus `src/admin/pwa/`
// (nicht `public/`, damit kein ausgelieferter Dateiname den Verwaltungspfad verrät).

export const dynamic = 'force-dynamic'

const ICON_DIR = path.join(process.cwd(), 'src', 'admin', 'pwa')

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await params
  if (!(PWA_ICON_FILES as readonly string[]).includes(file)) {
    return new Response('Nicht gefunden', { status: 404 })
  }
  const body = await readFile(path.join(ICON_DIR, file as PwaIconFile))
  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=86400',
      'x-robots-tag': 'noindex, nofollow',
    },
  })
}
