import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { APIRequestContext } from '@playwright/test'

import { localizedPath } from '../../../src/lib/routes/paths'
import { LOCALES } from '../../../src/lib/routes/registry'
import { testPayload } from '../fixtures'
import { refresh } from '../shop/fresh'

// Fixtures des Tattoo-Bereichs (P7, Nummern 980–999, `seed = true` außer ein Kriterium verlangt echte Datensätze):
// Flash-Motive, Angebote, Galerie-Einträge und FAQ per Local API im Testprozess. Danach bringt `refreshTattoo()` die
// betroffenen statischen Seiten auf den Stand der Test-DB (On-Demand-Revalidierung wie `global-setup.ts`).

const IMAGE = path.resolve('tests/fixtures/images/landscape-small.jpg')

export const TATTOO_ROUTES = [
  'R01',
  'R11',
  'R12',
  'R13',
  'R14',
  'R15',
  'R16',
  'R17',
  'R18',
] as const

/** Alle Tattoo-Seiten (und die Startseite) beider Sprachen inklusive der Filter-Varianten neu erzeugen. */
export async function refreshTattoo(request: APIRequestContext): Promise<void> {
  const urls: string[] = []
  for (const id of TATTOO_ROUTES) for (const l of LOCALES) urls.push(localizedPath(id, l))
  for (const l of LOCALES) {
    urls.push(`${localizedPath('R12', l)}?available=1`)
    urls.push(`${localizedPath('R15', l)}?kind=fresh`, `${localizedPath('R15', l)}?kind=healed`)
  }
  await refresh(request, urls)
}

export async function uploadImage(
  alt: string,
  data: Record<string, unknown> = {},
): Promise<{
  id: number
  filename: string
}> {
  const payload = await testPayload()
  const buf = await readFile(IMAGE)
  const doc = await payload.create({
    collection: 'media',
    data: { alt, ...data } as never,
    file: {
      data: buf,
      name: `tattoo-${randomUUID().slice(0, 8)}.jpg`,
      mimetype: 'image/jpeg',
      size: buf.length,
    },
    overrideAccess: true,
    context: { seed: true },
  })
  return { id: doc.id as number, filename: String(doc.filename) }
}

export async function removeMedia(ids: number[]): Promise<void> {
  const payload = await testPayload()
  for (const id of ids) {
    await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => null)
  }
}
