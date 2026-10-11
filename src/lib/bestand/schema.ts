import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import {
  DEVIATION_DECISIONS,
  FIBER_COMPONENTS,
  FOOD_CONTACT,
  PRODUCT_CATEGORIES,
  SHIPPING_CLASSES,
  TEXTILE_CONDITIONS,
  TEXTILE_FIBERS,
  VAT_CATEGORIES,
} from '@/lib/enums'
import { isReservedItemNumber } from '@/lib/products/itemNumber'

// Echter Bestand aus Juttas Fotos (U-76, U-77, PLAN P16.1): `content/bestand/products.json` mit den Fotos in
// `content/bestand/fotos/`. Anders als der Beispielbestand (SEED-SPEC) sind das echte Stücke: `pnpm bestand:import`
// legt sie als Entwürfe an (`seed: false`), Jutta prüft jedes Stück und stellt es selbst online. Alle Texte DE und EN
// (U-00); Schriftzüge auf den Stücken werden nie zitiert (U-77).

export const BESTAND_DIR = path.join('content', 'bestand')
export const BESTAND_FILE = 'products.json'
export const BESTAND_PHOTO_DIR = 'fotos'

const text = (min = 1) => z.string().trim().min(min)
const l10nBoth = z.strictObject({ de: text(), en: text() })
const cm = z
  .number()
  .positive()
  .max(300)
  .refine((v) => Math.round(v * 10) === v * 10, 'höchstens eine Nachkommastelle')

/** Foto eines Stücks: Datei in `content/bestand/fotos/` (`B001-1.jpg`) und Alt-Text DE/EN (5–250 Zeichen). */
const photo = z.strictObject({
  file: z.string().regex(/^B\d{3}-\d{1,2}\.jpg$/, 'Dateiname B001-1.jpg erwartet'),
  alt: z.strictObject({
    de: z.string().trim().min(5).max(250),
    en: z.string().trim().min(5).max(250),
  }),
})

export const bestandProductSchema = z
  .strictObject({
    /** Fester Schlüssel des Stücks (`B001` …); bleibt, auch wenn Jutta Nummer oder Titel ändert. */
    key: z.string().regex(/^B\d{3}$/),
    itemNumber: z
      .number()
      .int()
      .min(1)
      .max(99_999)
      .refine((n) => !isReservedItemNumber(n), 'Nr. 901–999 sind für Beispieldaten reserviert'),
    category: z.enum(PRODUCT_CATEGORIES),
    title: z.strictObject({
      de: z.string().trim().min(3).max(120),
      en: z.string().trim().min(3).max(120),
    }),
    description: l10nBoth,
    materials: l10nBoth,
    dimensions: z.strictObject({
      widthCm: cm.optional(),
      heightCm: cm.optional(),
      depthCm: cm.optional(),
      diameterCm: cm.optional(),
      note: l10nBoth.optional(),
    }),
    weightGrams: z.number().int().positive(),
    shippingClass: z.enum(SHIPPING_CLASSES),
    priceCents: z.number().int().min(100).max(1_000_000),
    vatCategory: z.enum(VAT_CATEGORIES),
    sizeLabel: l10nBoth.optional(),
    isSecondHand: z.boolean().optional(),
    condition: z.enum(TEXTILE_CONDITIONS).optional(),
    fiberComposition: z
      .array(
        z.strictObject({
          component: z.enum(FIBER_COMPONENTS),
          fiber: z.enum(TEXTILE_FIBERS),
          percent: z.number().int().min(1).max(100),
        }),
      )
      .optional(),
    careInstructions: l10nBoth.optional(),
    blankBrandVisible: z.boolean().optional(),
    foodContact: z.enum(FOOD_CONTACT).optional(),
    smallPartsWarning: z.boolean().optional(),
    deviationDecision: z.enum(DEVIATION_DECISIONS),
    deviationDescription: l10nBoth.optional(),
    images: z.array(photo).min(1).max(12),
    /** U-57 d: Foto zum Größenvergleich (z. B. mit Juttas Hand). */
    scalePhoto: photo.optional(),
    /** Prüfpunkte für Jutta (Deutsch): landen als interne Notiz am Stück und in der Prüfliste. */
    review: z.array(text(3)).min(1),
  })
  .superRefine((p, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', message: `${p.key}: ${message}` })
    const textile = p.category === 'textil' || p.category === 'cap'
    if ((p.deviationDecision === 'described') !== !!p.deviationDescription)
      issue('Abweichung „beschrieben“ genau dann, wenn es einen Abweichungstext gibt')
    if (p.foodContact === 'lebensmittelecht')
      issue('„lebensmittelecht“ nur mit Konformitätserklärung – der Import setzt „Deko“')
    if (p.category === 'keramik' && p.foodContact !== 'deko')
      issue('Keramik braucht foodContact „deko“')
    if (p.category === 'schmuck' && p.smallPartsWarning !== true)
      issue('Schmuck braucht den Kleinteile-Hinweis')
    const textileOnly = [
      'sizeLabel',
      'isSecondHand',
      'condition',
      'fiberComposition',
      'careInstructions',
      'blankBrandVisible',
    ] as const
    if (!textile)
      for (const f of textileOnly) if (p[f] !== undefined) issue(`${f} nur bei Textil und Cap`)
    if (textile && p.isSecondHand === undefined) issue('Second-Hand-Angabe fehlt')
    if (
      !textile &&
      !Object.entries(p.dimensions).some(([k, v]) => k !== 'note' && typeof v === 'number')
    )
      issue('mindestens ein Maß fehlt')
    const files = [...p.images, ...(p.scalePhoto ? [p.scalePhoto] : [])].map((i) => i.file)
    for (const f of files)
      if (!f.startsWith(`${p.key}-`)) issue(`Foto ${f} gehört nicht zu ${p.key}`)
  })

export const bestandSchema = z.array(bestandProductSchema).superRefine((list, ctx) => {
  const dupes = (values: (string | number)[]) =>
    values.filter((v, i) => values.indexOf(v) !== i).map(String)
  for (const [label, values] of [
    ['Schlüssel', list.map((p) => p.key)],
    ['Objektnummer', list.map((p) => p.itemNumber)],
    ['Titel (DE)', list.map((p) => p.title.de)],
    ['Titel (EN)', list.map((p) => p.title.en)],
    [
      'Foto',
      list.flatMap((p) =>
        [...p.images, ...(p.scalePhoto ? [p.scalePhoto] : [])].map((i) => i.file),
      ),
    ],
  ] as const) {
    const d = dupes([...values])
    if (d.length) ctx.addIssue({ code: 'custom', message: `${label} doppelt: ${d.join(', ')}` })
  }
})

export type BestandProduct = z.infer<typeof bestandProductSchema>

/** Liest und prüft `content/bestand/products.json` (Fehler mit allen zod-Meldungen). */
export async function loadBestand(root = process.cwd()): Promise<BestandProduct[]> {
  const file = path.join(root, BESTAND_DIR, BESTAND_FILE)
  const raw: unknown = JSON.parse(await readFile(file, 'utf8'))
  const res = bestandSchema.safeParse(raw)
  if (!res.success) {
    throw new Error(
      `${file} ist ungültig:\n${res.error.issues.map((i) => `- ${i.path.join('.')} ${i.message}`).join('\n')}`,
    )
  }
  return res.data
}

/** Pfad eines Fotos. */
export function bestandPhotoPath(root: string, file: string): string {
  return path.join(root, BESTAND_DIR, BESTAND_PHOTO_DIR, file)
}

/** Alle Fotos eines Stücks in Reihenfolge (Titelbild zuerst, das Größenvergleich-Foto zuletzt). */
export function photosOf(p: BestandProduct): z.infer<typeof photo>[] {
  return [...p.images, ...(p.scalePhoto ? [p.scalePhoto] : [])]
}
