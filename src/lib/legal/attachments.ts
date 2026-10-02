import 'server-only'

import { createHash } from 'node:crypto'

import type { PayloadRequest } from 'payload'

import { AttachmentNotReadyError } from '@/lib/email/errors'
import type { Locale } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import { readStoredFile } from '@/lib/storage/read'
import type { Order } from '@/payload-types'

import {
  loadLegalTextAll,
  renderLegalPdf,
  renderLegalSection,
  type LegalTextAllLocales,
} from './pdf'

// Rechtstext-Anhänge der Bestellbestätigungen M01/M02 (KONZEPT §6.2, AK-6-02, DM-LEG-02): immer die in der Bestellung
// gespeicherten Fassungen (`legalTextVersions`), nie die gerade aktive. `AGB_v{n}.pdf` ist das gespeicherte PDF der
// Fassung; `Widerrufsbelehrung-und-Formular_v{n}.pdf` fasst Belehrung und Muster-Formular in einem PDF zusammen
// (deterministisch: gleiche Fassungen und Einstellungen ergeben dieselbe Datei). EN-Bestellungen bekommen zusätzlich
// die vorhandenen EN-Fassungen (`…_EN.pdf`).

export interface LegalAttachment {
  filename: string
  content: Buffer
  contentType: 'application/pdf'
  sha256: string
}

type OrderLegal = Pick<Order, 'id' | 'locale' | 'legalTextVersions'>

const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? (v as { id: number }).id
      : Number(v)

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')

function attachment(filename: string, content: Buffer): LegalAttachment {
  return { filename, content, contentType: 'application/pdf', sha256: sha(content) }
}

async function storedPdf(
  req: PayloadRequest,
  doc: LegalTextAllLocales,
  locale: Locale,
): Promise<Buffer | null> {
  const id = idOf(locale === 'de' ? doc.pdfDe : doc.pdfEn)
  if (id === null) return null
  const file = await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'documents',
      id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )
  if (!file?.filename) return null
  return readStoredFile('documents', file.filename, (file as { prefix?: string }).prefix)
}

async function bundle(
  req: PayloadRequest,
  belehrung: LegalTextAllLocales,
  formular: LegalTextAllLocales,
  locale: Locale,
): Promise<Buffer> {
  const first = await renderLegalSection(req, belehrung, locale)
  const second =
    (await renderLegalSection(req, formular, locale)) ??
    (await renderLegalSection(req, formular, 'de'))
  if (!first || !second) throw new AttachmentNotReadyError('Widerrufsbelehrung-und-Formular')
  const fixed = [belehrung, formular]
    .map((d) => new Date(d.activatedAt ?? d.validFrom).getTime())
    .reduce((a, b) => Math.max(a, b))
  const settings = await preservingReq(req, () =>
    req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
  )
  const pdf = await renderLegalPdf({
    title:
      locale === 'de'
        ? 'Widerrufsbelehrung und Muster-Widerrufsformular'
        : 'Right of withdrawal and model withdrawal form',
    locale,
    sections: [first.section, second.section],
    fixedDate: new Date(fixed),
    author: settings.business?.legalName || 'planetclairetattoos.com',
  })
  return pdf.data
}

/** Anhänge M01/M02 in der Fassung der Bestellung; fehlt ein gespeichertes PDF noch → `AttachmentNotReadyError`. */
export async function buildLegalAttachments(
  req: PayloadRequest,
  order: OrderLegal,
): Promise<LegalAttachment[]> {
  const versions = order.legalTextVersions ?? {}
  const agbId = idOf(versions.agb)
  const belehrungId = idOf(versions.widerrufsbelehrung)
  const formularId = idOf(versions.widerrufsformular)
  if (agbId === null || belehrungId === null || formularId === null) {
    throw new Error(`Bestellung ${order.id}: Rechtstext-Fassungen fehlen.`)
  }
  const [agb, belehrung, formular] = await Promise.all(
    [agbId, belehrungId, formularId].map((id) => loadLegalTextAll(req, id)),
  )
  const out: LegalAttachment[] = []
  const agbDe = await storedPdf(req, agb!, 'de')
  if (!agbDe) throw new AttachmentNotReadyError(`AGB_v${agb!.version}.pdf`)
  out.push(attachment(`AGB_v${agb!.version}.pdf`, agbDe))
  const name = `Widerrufsbelehrung-und-Formular_v${belehrung!.version}`
  out.push(attachment(`${name}.pdf`, await bundle(req, belehrung!, formular!, 'de')))

  if (order.locale === 'en') {
    if (agb!.pdfEn) {
      const agbEn = await storedPdf(req, agb!, 'en')
      if (!agbEn) throw new AttachmentNotReadyError(`AGB_v${agb!.version}_EN.pdf`)
      out.push(attachment(`AGB_v${agb!.version}_EN.pdf`, agbEn))
    }
    if (renderableIn(belehrung!, 'en')) {
      out.push(attachment(`${name}_EN.pdf`, await bundle(req, belehrung!, formular!, 'en')))
    }
  }
  return out
}

function renderableIn(doc: LegalTextAllLocales, locale: Locale): boolean {
  const c = (doc.content ?? {}) as Partial<Record<Locale, { root?: unknown } | null>>
  return !!c[locale]?.root
}

export interface LegalAttachmentInfo {
  /** Dateinamen in Versandreihenfolge (wie `buildLegalAttachments`, ohne zu rendern). */
  files: string[]
  agb: { version: number; date: string }
  withdrawal: { version: number; date: string }
}

const versionDate = (d: LegalTextAllLocales) => new Date(d.activatedAt ?? d.validFrom).toISOString()

/** Namen und Fassungsdaten der Rechtstext-Anhänge einer Bestellung – für den Mailtext (M01/M02, „in der Fassung vom“). */
export async function legalAttachmentInfo(
  req: PayloadRequest,
  order: OrderLegal,
): Promise<LegalAttachmentInfo> {
  const versions = order.legalTextVersions ?? {}
  const agbId = idOf(versions.agb)
  const belehrungId = idOf(versions.widerrufsbelehrung)
  if (agbId === null || belehrungId === null) {
    throw new Error(`Bestellung ${order.id}: Rechtstext-Fassungen fehlen.`)
  }
  const [agb, belehrung] = await Promise.all([
    loadLegalTextAll(req, agbId),
    loadLegalTextAll(req, belehrungId),
  ])
  const name = `Widerrufsbelehrung-und-Formular_v${belehrung.version}`
  const files = [`AGB_v${agb.version}.pdf`, `${name}.pdf`]
  if (order.locale === 'en') {
    if (agb.pdfEn) files.push(`AGB_v${agb.version}_EN.pdf`)
    if (renderableIn(belehrung, 'en')) files.push(`${name}_EN.pdf`)
  }
  return {
    files,
    agb: { version: Number(agb.version), date: versionDate(agb) },
    withdrawal: { version: Number(belehrung.version), date: versionDate(belehrung) },
  }
}
