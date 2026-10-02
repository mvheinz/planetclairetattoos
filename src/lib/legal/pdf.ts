import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import { createElement } from 'react'
import type { PayloadRequest } from 'payload'

import { dbFor } from '@/lib/db/tx'
import { ENUM_LABELS } from '@/lib/enumLabels'
import type { LegalTextType, Locale } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import {
  LegalTextDocument,
  type LegalPdfSection,
  type LegalTextDocumentProps,
} from '@/lib/pdf/LegalTextDocument'
import { renderPdf, type RenderedPdf } from '@/lib/pdf/render'
import { formatBerlin } from '@/lib/time'
import type { LegalText } from '@/payload-types'

import { loadLegalTokenValues, renderLegalContent, type LexicalContent } from './render'
import { getSnippet } from './snippets'

// Rechtstext-PDFs (DATENMODELL §6.12, P4.12; Ausbau P6.3): je veröffentlichter bzw. abgelöster Fassung ein PDF je
// vorhandener Sprache → `documents` (`kind = legal_text_pdf`), verknüpft als `pdfDe`/`pdfEn`, Hash des gerenderten
// Texts in `contentSha256De`/`contentSha256En`. Tokens über den Renderer aus P1 (R-012); ein unbekanntes oder nicht
// ersetzbares Token (auch `{{STEUERNUMMER}}`, E-46) ist ein Render-Fehler – dann entsteht kein PDF.

/** Übergangs-Kennung (`req.context.transition`) für das Setzen der PDFs an veröffentlichten Fassungen. */
export const LEGAL_PDF_TRANSITION = 'renderLegalTextPdf'

type LocalizedContent = Partial<Record<Locale, LexicalContent | null>>

export type LegalTextAllLocales = Omit<LegalText, 'content'> & { content?: unknown }

const hasRoot = (c: unknown): c is LexicalContent =>
  typeof c === 'object' && c !== null && !!(c as LexicalContent).root

/** Inhalt einer Fassung in `locale` (mit `locale: 'all'` geladen); `null`, wenn es ihn nicht gibt. */
export function contentIn(doc: LegalTextAllLocales, locale: Locale): LexicalContent | null {
  const c = (doc.content ?? {}) as LocalizedContent
  const v = c[locale]
  return hasRoot(v) ? v : null
}

/** Sprachen mit Text (DE immer zuerst). */
export function localesOf(doc: LegalTextAllLocales): Locale[] {
  return (['de', 'en'] as const).filter((l) => contentIn(doc, l) !== null)
}

export function legalTypeTitle(type: LegalTextType, locale: Locale): string {
  const label = ENUM_LABELS.LEGAL_TEXT_TYPES[type]
  return label[locale] ?? label.de
}

/** „v3 · gültig ab 01.10.2026“ bzw. „v3 · valid from 1 Oct 2026“. */
export function legalVersionLabel(version: number, validFrom: Date, locale: Locale): string {
  return locale === 'de'
    ? `v${version} · gültig ab ${formatBerlin(validFrom, 'dd.MM.yyyy')}`
    : `v${version} · valid from ${formatBerlin(validFrom, 'd MMM yyyy', 'en')}`
}

/** Text des aktiven Bausteins `withdrawal.returnCostsNote` für `{{returnCostsNote}}` (RECHT §6); sonst leer. */
function returnCostsNote(locale: Locale): string | null {
  try {
    return getSnippet('withdrawal.returnCostsNote', locale).text
  } catch {
    return null
  }
}

export interface RenderedLegalSection {
  section: LegalPdfSection
  contentSha256: string
}

/** Rendert eine Fassung in `locale` (Tokens ersetzt); wirft `LegalRenderError`. */
export async function renderLegalSection(
  req: PayloadRequest,
  doc: LegalTextAllLocales,
  locale: Locale,
): Promise<RenderedLegalSection | null> {
  const content = contentIn(doc, locale)
  if (!content) return null
  const values = await loadLegalTokenValues(req, locale, {
    returnCostsNote: returnCostsNote(locale),
  })
  const rendered = renderLegalContent(content, values)
  return {
    section: {
      title: legalTypeTitle(doc.type, locale),
      versionLabel: legalVersionLabel(doc.version ?? 1, new Date(doc.validFrom), locale),
      content: rendered.content,
      placeholder: doc.origin !== 'lawyer',
    },
    contentSha256: rendered.sha256,
  }
}

/** Fester Zeitpunkt der PDF-Metadaten: Aktivierung, sonst `validFrom`. */
const fixedDateOf = (doc: LegalTextAllLocales) => new Date(doc.activatedAt ?? doc.validFrom)

async function authorOf(req: PayloadRequest): Promise<string> {
  const settings = await preservingReq(req, () =>
    req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
  )
  return settings.business?.legalName || 'planetclairetattoos.com'
}

export function renderLegalPdf(props: LegalTextDocumentProps): Promise<RenderedPdf> {
  return renderPdf(
    createElement(LegalTextDocument, props) as unknown as Parameters<typeof renderPdf>[0],
  )
}

export async function loadLegalTextAll(
  req: PayloadRequest,
  id: number,
): Promise<LegalTextAllLocales> {
  return (await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'legal-texts',
      id,
      locale: 'all',
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )) as unknown as LegalTextAllLocales
}

export interface IssueLegalPdfsResult {
  created: Locale[]
  skipped: Locale[]
}

/**
 * Erzeugt die fehlenden PDFs einer veröffentlichten bzw. abgelösten Fassung (idempotent: vorhandene `pdfDe`/`pdfEn`
 * bleiben). Job `renderLegalTextPdf` und Grund-Seed (Platzhalter-Fassungen) nutzen dieselbe Funktion.
 */
export async function issueLegalTextPdfs(
  req: PayloadRequest,
  legalTextId: number,
): Promise<IssueLegalPdfsResult> {
  return inTransaction(req, async () => {
    const db = await dbFor(req)
    await db.execute(sql`SELECT id FROM legal_texts WHERE id = ${legalTextId} FOR UPDATE`)
    const doc = await loadLegalTextAll(req, legalTextId)
    if (doc.status !== 'active' && doc.status !== 'superseded') {
      throw new Error(`Rechtstext ${legalTextId}: PDFs nur für veröffentlichte Fassungen.`)
    }
    const context = { ...req.context, system: true, transition: LEGAL_PDF_TRANSITION }
    const author = await authorOf(req)
    const result: IssueLegalPdfsResult = { created: [], skipped: [] }
    const patch: Record<string, unknown> = {}
    for (const locale of localesOf(doc)) {
      const pdfField = locale === 'de' ? 'pdfDe' : 'pdfEn'
      const hashField = locale === 'de' ? 'contentSha256De' : 'contentSha256En'
      if (doc[pdfField]) {
        result.skipped.push(locale)
        continue
      }
      const rendered = await renderLegalSection(req, doc, locale)
      if (!rendered) continue
      const title = `${rendered.section.title} ${rendered.section.versionLabel}`.slice(0, 120)
      const pdf = await renderLegalPdf({
        title,
        locale,
        sections: [rendered.section],
        fixedDate: fixedDateOf(doc),
        author,
      })
      const upload = await preservingReq(req, () =>
        req.payload.create({
          collection: 'documents',
          locale: 'de',
          data: {
            title,
            kind: 'legal_text_pdf',
            language: locale,
            seed: doc.seed === true,
          } as never,
          file: {
            data: pdf.data,
            name: `${doc.type}_v${doc.version}_${locale}.pdf`,
            mimetype: 'application/pdf',
            size: pdf.data.length,
          },
          depth: 0,
          overrideAccess: true,
          req,
          context,
        }),
      )
      patch[pdfField] = upload.id
      if (!doc[hashField]) patch[hashField] = rendered.contentSha256
      result.created.push(locale)
    }
    if (Object.keys(patch).length > 0) {
      await preservingReq(req, () =>
        req.payload.update({
          collection: 'legal-texts',
          id: legalTextId,
          data: patch,
          depth: 0,
          overrideAccess: true,
          req,
          context,
        }),
      )
    }
    return result
  })
}
