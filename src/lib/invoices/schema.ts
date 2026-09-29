import 'server-only'

import { z } from 'zod'

import { COUNTRY_CODES, PAYMENT_METHODS } from '@/lib/enums'

// Belegdaten `InvoiceDataV1` (DATENMODELL §6.9, R-120): eingefroren im Beleg (`invoices.data`), einzige Quelle für das
// PDF. Beträge in Integer-Cent, Zeitpunkte als ISO-Zeichenkette (UTC), Leistungszeitpunkt als Monat `JJJJ-MM`.

const cents = z.number().int().nonnegative()
const vatRate = z.union([z.literal(0), z.literal(7), z.literal(19)])
const text = (max: number) => z.string().trim().min(1).max(max)
const optionalText = (max: number) => z.string().trim().max(max).nullish()

export const invoiceSellerSchema = z.object({
  legalName: text(200),
  tradeName: optionalText(200),
  street: text(200),
  postalCode: text(20),
  city: text(100),
  country: z.enum(COUNTRY_CODES),
  email: z.string().email(),
  /** Steuernummer (nur Belege, nie öffentlich, E-46); vor P11 der Grund-Seed-Platzhalter. */
  taxNumber: optionalText(40),
  vatId: optionalText(40),
  economicId: optionalText(40),
})

export const invoiceBuyerSchema = z.object({
  name: text(100),
  addressLine1: text(200),
  addressLine2: optionalText(200),
  postalCode: text(20),
  city: text(100),
  country: z.enum(COUNTRY_CODES),
  email: z.string().email(),
})

export const invoiceLineSchema = z.object({
  pos: z.number().int().min(1),
  /** Objektnummer (E-12); leer bei freien Gutschrift-Zeilen. */
  itemNumber: z.number().int().min(1).nullish(),
  /** „Nr. 017 · Titel · Kategorie“ (R-120). */
  description: text(300),
  quantity: z.literal(1),
  unitPriceCents: cents,
  totalCents: cents,
  vatRate,
})

export const invoiceTaxLineSchema = z.object({
  rate: vatRate,
  netCents: cents,
  taxCents: cents,
  grossCents: cents,
})

export const invoiceDataV1Schema = z
  .object({
    version: z.literal(1),
    seller: invoiceSellerSchema,
    buyer: invoiceBuyerSchema,
    orderNumber: z.string().regex(/^PC-\d{4}-\d{5}$/),
    paymentMethod: z.enum(PAYMENT_METHODS),
    paidAt: z.string().datetime(),
    /** Leistungszeitpunkt als Monat, Anzeige „Oktober 2026“ (R-120). */
    deliveryMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    lines: z.array(invoiceLineSchema).min(1).max(20),
    shipping: z.object({ description: text(200), totalCents: cents, vatRate }).nullable(),
    taxLines: z.array(invoiceTaxLineSchema),
    totalGrossCents: z.number().int().positive(),
    /** KU: „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.“; Regelbesteuerung: leer. */
    legalNote: z.string().max(300).nullable(),
    relatedInvoiceNumber: z
      .string()
      .regex(/^(BSP-)?RE-\d{4}-\d{5}$/)
      .nullish(),
  })
  .superRefine((d, ctx) => {
    const sum = d.lines.reduce((n, l) => n + l.totalCents, 0) + (d.shipping?.totalCents ?? 0)
    if (sum !== d.totalGrossCents) {
      ctx.addIssue({
        code: 'custom',
        message: 'Summe der Positionen ≠ Gesamtbetrag',
        path: ['lines'],
      })
    }
    if (d.taxLines.length > 0) {
      const gross = d.taxLines.reduce((n, t) => n + t.grossCents, 0)
      if (gross !== d.totalGrossCents) {
        ctx.addIssue({ code: 'custom', message: 'Steuerzeilen ≠ Gesamtbetrag', path: ['taxLines'] })
      }
      for (const t of d.taxLines) {
        if (t.netCents + t.taxCents !== t.grossCents) {
          ctx.addIssue({ code: 'custom', message: 'Netto + Steuer ≠ Brutto', path: ['taxLines'] })
        }
      }
    }
  })

export type InvoiceDataV1 = z.infer<typeof invoiceDataV1Schema>
export type InvoiceLine = z.infer<typeof invoiceLineSchema>

export class InvoiceDataError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Belegdaten ungültig (InvoiceDataV1): ${issues.join('; ')}`)
    this.name = 'InvoiceDataError'
  }
}

/** Prüft Belegdaten; wirft `InvoiceDataError` mit lesbaren Meldungen. */
export function parseInvoiceData(value: unknown): InvoiceDataV1 {
  const res = invoiceDataV1Schema.safeParse(value)
  if (!res.success) {
    throw new InvoiceDataError(
      res.error.issues.map((i) => `${i.path.join('.') || '(Wurzel)'}: ${i.message}`),
    )
  }
  return res.data
}
