import 'server-only'

import type { PayloadRequest } from 'payload'

import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import type { Order, Setting } from '@/payload-types'

import {
  checklistState,
  cleanComponents,
  packagingForOrder,
  packagingTemplates,
  type PackagingComponent,
} from './packing'
import { loadOrder, lockOrder, transitionOrder, updateOrderFields } from './transitionOrder'

// Packen (PLAN P5.10/P5.11, KONZEPT §7.6, DATENMODELL §6.8.8): Checkliste, Verpackungsmengen und Packfotos an der
// Bestellung speichern sowie „Gepackt“ (O6, `timestamps.packedAt`). Die Verpackung wird als Wertkopie gespeichert
// (`packaging.templateKey`, `templateName`, `components`; `recordedAt` setzt der Speicher-Hook) – spätestens mit
// „Gepackt“ bzw. „Versendet melden“; eine später geänderte Vorlage wirkt deshalb nur auf neue Sendungen.

/** Höchstens so viele Packfotos bietet die Oberfläche an (Datenmodell erlaubt 6). */
export const PACKING_PHOTOS_UI_MAX = 4
export const PACKING_PHOTOS_MAX = 6

export class PackingError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'PackingError'
  }
}

export interface PackagingInput {
  templateKey?: unknown
  components?: unknown
}

export interface SavePackingInput {
  checklist?: unknown
  packaging?: PackagingInput | null
  packingPhotos?: unknown
}

export async function loadSettings(req: PayloadRequest): Promise<Setting> {
  return (await preservingReq(req, () =>
    req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
  )) as Setting
}

const PACKABLE = new Set(['paid', 'packed'])

function assertPackable(order: Order, status = order.status): void {
  if (order.fulfillmentMethod !== 'shipping') {
    throw new PackingError(409, 'Packen gibt es nur bei Bestellungen mit Versand.')
  }
  if (!PACKABLE.has(status)) {
    throw new PackingError(
      409,
      status === 'withdrawal_received'
        ? 'Nicht mehr versenden – Widerruf! Die Bestellung lässt sich nicht mehr packen.'
        : 'Diese Bestellung ist nicht (mehr) zu packen.',
    )
  }
}

/** Verpackungswerte prüfen: Vorlage aus den Einstellungen, 1–10 Bestandteile mit Material und ganzen Gramm. */
export function parsePackaging(
  input: PackagingInput,
  settings: Setting,
): { templateKey: string; templateName: string; components: PackagingComponent[] } {
  const templates = packagingTemplates(settings)
  const template = templates.find((t) => t.key === input.templateKey)
  if (!template) throw new PackingError(400, 'Bitte eine Verpackungsvorlage aus der Liste wählen.')
  const raw = input.components === undefined ? template.components : input.components
  const components = cleanComponents(raw)
  if (
    !Array.isArray(raw) ||
    components.length !== raw.length ||
    components.length < 1 ||
    components.length > 10
  ) {
    throw new PackingError(
      400,
      'Verpackung: je Bestandteil ein Material und ganze Gramm von 1 bis 10.000 (mindestens ein Bestandteil).',
    )
  }
  return { templateKey: template.key, templateName: template.name, components }
}

async function parsePhotos(
  req: PayloadRequest,
  orderId: number,
  value: unknown,
): Promise<{ ids: number[]; unlinked: number[] }> {
  if (!Array.isArray(value)) throw new PackingError(400, 'Packfotos: Liste erwartet.')
  const ids = [...new Set(value.map(Number))]
  if (ids.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw new PackingError(400, 'Packfotos: unbekannte Datei.')
  }
  if (ids.length > PACKING_PHOTOS_MAX) {
    throw new PackingError(400, `Höchstens ${PACKING_PHOTOS_MAX} Packfotos je Bestellung.`)
  }
  if (ids.length === 0) return { ids, unlinked: [] }
  const found = await preservingReq(req, () =>
    req.payload.find({
      collection: 'private-uploads',
      where: { and: [{ id: { in: ids } }, { purpose: { equals: 'packing_photo' } }] },
      pagination: false,
      depth: 0,
      select: { relatedOrder: true },
      overrideAccess: true,
      req,
    }),
  )
  if (found.docs.length !== ids.length) throw new PackingError(400, 'Packfotos: unbekannte Datei.')
  const relOf = (d: (typeof found.docs)[number]) =>
    d.relatedOrder && typeof d.relatedOrder === 'object' ? d.relatedOrder.id : d.relatedOrder
  if (found.docs.some((d) => relOf(d) && relOf(d) !== orderId)) {
    throw new PackingError(400, 'Packfotos: Das Foto gehört zu einer anderen Bestellung.')
  }
  const unlinked = found.docs.filter((d) => !relOf(d)).map((d) => d.id)
  return { ids, unlinked }
}

function parseChecklist(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PackingError(400, 'Checkliste: ungültige Angabe.')
  }
  const state = checklistState(value)
  if (Object.keys(state).length > 50) throw new PackingError(400, 'Checkliste: zu viele Punkte.')
  return state
}

/** Checkliste, Verpackung und/oder Packfotos speichern (ohne Statuswechsel). */
export async function savePacking(
  req: PayloadRequest,
  order: Order,
  input: SavePackingInput,
  now: Date,
): Promise<Order> {
  return inTransaction(req, async () => {
    const locked = await lockOrder(req, order.id)
    assertPackable(order, locked.status)
    const data: Record<string, unknown> = {}
    if (input.checklist !== undefined) data.packingChecklistState = parseChecklist(input.checklist)
    if (input.packaging) {
      const settings = await loadSettings(req)
      data.packaging = parsePackaging(input.packaging, settings)
    }
    if (input.packingPhotos !== undefined) {
      const { ids, unlinked } = await parsePhotos(req, order.id, input.packingPhotos)
      data.packingPhotos = ids
      for (const id of unlinked) {
        await preservingReq(req, () =>
          req.payload.update({
            collection: 'private-uploads',
            id,
            data: { relatedOrder: order.id } as never,
            depth: 0,
            overrideAccess: true,
            req,
            context: { ...req.context, system: true },
          }),
        )
      }
    }
    if (Object.keys(data).length === 0) return loadOrder(req, order.id)
    return updateOrderFields(req, order.id, data, now)
  })
}

/**
 * Verpackungsdaten, die mit „Gepackt“ bzw. „Versendet melden“ gespeichert werden: die übergebene Auswahl oder – noch
 * nicht erfasst – die Vorbelegung aus der Standard-Vorlage der Versandklasse; `null`, wenn schon erfasst.
 */
export async function packagingToRecord(
  req: PayloadRequest,
  order: Order,
  input: PackagingInput | null | undefined,
): Promise<Record<string, unknown> | null> {
  const settings = await loadSettings(req)
  if (input) return parsePackaging(input, settings)
  const current = packagingForOrder(order, settings)
  if (current.recorded) return null
  if (!current.templateKey || current.components.length === 0) {
    throw new PackingError(
      409,
      'Für diese Versandklasse gibt es keine Verpackungsvorlage – bitte die Verpackung von Hand erfassen.',
    )
  }
  return {
    templateKey: current.templateKey,
    templateName: current.templateName,
    components: current.components,
  }
}

/**
 * „Gepackt“ (O6): Übergang gegen `ORDER_TRANSITIONS` (unerlaubt → 409 ohne Änderung), Verpackung im selben Schritt;
 * zweiter Tipp → keine zweite Wirkung.
 */
export async function markPacked(
  req: PayloadRequest,
  order: Order,
  input: { packaging?: PackagingInput | null },
  now: Date,
): Promise<{ order: Order; unchanged: boolean }> {
  return inTransaction(req, async () => {
    const locked = await lockOrder(req, order.id)
    if (locked.status === 'packed')
      return { order: await loadOrder(req, order.id), unchanged: true }
    if (order.fulfillmentMethod !== 'shipping') {
      throw new PackingError(409, 'Packen gibt es nur bei Bestellungen mit Versand.')
    }
    const current = await loadOrder(req, order.id)
    const packaging = await packagingToRecord(req, current, input.packaging)
    const res = await transitionOrder(req, order.id, 'packed', {
      now,
      actorType: 'admin',
      ...(packaging ? { data: { packaging } } : {}),
    })
    return { order: res.order, unchanged: false }
  })
}
