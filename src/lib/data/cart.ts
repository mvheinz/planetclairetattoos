import 'server-only'

import { createLogger } from '@/lib/monitoring/logger'
import { getPublicPayload } from '@/lib/payload/public'
import type { Media } from '@/payload-types'

// Fotos der Korbzeilen (R06, KO-13): erstes Foto je Stück über die öffentliche Leseregel, ungecacht (die Korbseite ist
// ohnehin dynamisch). Ohne Datenbank bleibt die schraffierte Fläche – die Zeile bleibt bedienbar.

const log = createLogger()

export async function getCartMedia(ids: readonly number[]): Promise<Map<number, Media>> {
  const out = new Map<number, Media>()
  if (ids.length === 0) return out
  try {
    const payload = await getPublicPayload()
    const res = await payload.find({
      collection: 'media',
      where: { id: { in: [...new Set(ids)] } },
      depth: 0,
      pagination: false,
    })
    for (const m of res.docs as Media[]) out.set(m.id, m)
  } catch (err) {
    log.warn('cart.media_failed', { reason: (err as Error).message })
  }
  return out
}
