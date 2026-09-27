import 'server-only'

import type { PayloadRequest } from 'payload'

import { LEGAL_TEXT_TRANSITION, VALID_FROM_TOLERANCE_MS } from '@/collections/LegalTexts'
import { writeAudit } from '@/lib/audit'
import { TransitionError } from '@/lib/commerce/transitionError'
import type { LegalTextType, Locale } from '@/lib/enums'
import { requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'

import {
  LegalRenderError,
  loadLegalTokenValues,
  renderLegalContent,
  type LexicalContent,
} from './render'

// Aktivierung einer Rechtstext-Fassung (DATENMODELL §6.12, R-012) in einer Transaktion: `draft`/`scheduled` → `active`
// (validFrom ≤ jetzt) bzw. `draft` → `scheduled` (validFrom in der Zukunft; der Job `activateScheduledLegalTexts`
// ruft den Service später erneut auf). Beim Aktivieren wird die bisher aktive Fassung desselben Typs `superseded`;
// vorher müssen DE- und (falls vorhanden) EN-Text fehlerfrei rendern – sonst ist das Aktivieren gesperrt. PDFs erzeugt
// der Job `renderLegalTextPdf` (ab P4/P6).

export interface ActivateLegalTextOptions {
  /** Text des Bausteins `withdrawal.returnCostsNote` für `{{returnCostsNote}}` (Bausteine ab P3.3/P6). */
  returnCostsNote?: string | null
}

export interface ActivateLegalTextResult {
  id: number
  type: LegalTextType
  status: 'active' | 'scheduled'
  supersededId: number | null
}

type LocalizedContent = Partial<Record<Locale, LexicalContent | null>>

export async function activateLegalText(
  req: PayloadRequest,
  id: number,
  options: ActivateLegalTextOptions = {},
): Promise<ActivateLegalTextResult> {
  return inTransaction(req, async () => {
    const now = requestNow(req)
    const doc = await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'legal-texts',
        id,
        locale: 'all',
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )
    if (doc.status !== 'draft' && doc.status !== 'scheduled') {
      throw new TransitionError('Nur Entwürfe und geplante Fassungen lassen sich aktivieren.')
    }
    const validFrom = new Date(doc.validFrom)
    const content = (doc.content ?? {}) as unknown as LocalizedContent
    if (!content.de?.root) throw new TransitionError('Der deutsche Text fehlt.')

    // Render-Prüfung je Sprache (R-012): unbekannte oder unersetzte Tokens sperren das Aktivieren.
    const hashes: Partial<Record<Locale, string>> = {}
    for (const locale of ['de', 'en'] as const) {
      const c = content[locale]
      if (!c?.root) continue
      const values = await loadLegalTokenValues(req, locale, options)
      try {
        hashes[locale] = renderLegalContent(c, values).sha256
      } catch (e) {
        if (e instanceof LegalRenderError) {
          throw new TransitionError(`${locale.toUpperCase()}: ${e.message}`, 422)
        }
        throw e
      }
    }

    const context = { ...req.context, system: true, transition: LEGAL_TEXT_TRANSITION }
    const update = (docId: number, data: Record<string, unknown>) =>
      preservingReq(req, () =>
        req.payload.update({
          collection: 'legal-texts',
          id: docId,
          data,
          depth: 0,
          overrideAccess: true,
          req,
          context,
        }),
      )

    if (validFrom.getTime() > now.getTime() + VALID_FROM_TOLERANCE_MS) {
      await update(id, {
        status: 'scheduled',
        contentSha256De: hashes.de ?? null,
        contentSha256En: hashes.en ?? null,
      })
      return { id, type: doc.type, status: 'scheduled', supersededId: null }
    }

    const current = await preservingReq(req, () =>
      req.payload.find({
        collection: 'legal-texts',
        where: { and: [{ type: { equals: doc.type } }, { status: { equals: 'active' } }] },
        depth: 0,
        pagination: false,
        overrideAccess: true,
        req,
      }),
    )
    let supersededId: number | null = null
    for (const prev of current.docs) {
      if (prev.id === id) continue
      await update(prev.id, { status: 'superseded', supersededAt: now.toISOString() })
      supersededId = prev.id
      await writeAudit(req, {
        action: 'legal_text_superseded',
        entityCollection: 'legal-texts',
        entityId: prev.id,
        summary: `Rechtstext ${doc.type} ${prev.versionLabel ?? `v${prev.version}`} abgelöst`,
        changes: { status: ['active', 'superseded'] },
        transition: LEGAL_TEXT_TRANSITION,
      })
    }
    await update(id, {
      status: 'active',
      activatedAt: now.toISOString(),
      contentSha256De: hashes.de ?? null,
      contentSha256En: hashes.en ?? null,
    })
    await writeAudit(req, {
      action: 'legal_text_activated',
      entityCollection: 'legal-texts',
      entityId: id,
      summary: `Rechtstext ${doc.type} ${doc.versionLabel ?? `v${doc.version}`} veröffentlicht`,
      changes: { status: [doc.status, 'active'] },
      transition: LEGAL_TEXT_TRANSITION,
    })
    return { id, type: doc.type, status: 'active', supersededId }
  })
}
