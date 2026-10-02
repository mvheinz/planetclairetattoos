import React from 'react'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { complianceOverview, type ComplianceDocument } from '@/lib/legal/complianceDocs'
import { formatBerlin } from '@/lib/time'

import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { ComplianceUpload } from './ComplianceUpload'

// Einstellungen → „Produktsicherheit“ (PLAN P5.13, RECHT R-203, LOESCHKONZEPT L-24): Unterlagen je Kategorie
// (technische Unterlagen, Lieferantenerklärungen, Prüfberichte, Nickel-Nachweise, Konformitätserklärungen) mit Frist,
// Hinweis auf fehlende technische Unterlagen, Vorlage als PDF und Hochladen (nur PDF). Beispieldaten erscheinen mit
// Kennzeichen. Nichts wird automatisch gelöscht.

const KIND_LABEL: Record<ComplianceDocument['kind'], string> = {
  technical_file: ENUM_LABELS.PRIVATE_UPLOAD_PURPOSES.technical_file.de,
  supplier_document: ENUM_LABELS.PRIVATE_UPLOAD_PURPOSES.supplier_document.de,
  lab_report: ENUM_LABELS.PRIVATE_UPLOAD_PURPOSES.lab_report.de,
  nickel_evidence: ENUM_LABELS.PRIVATE_UPLOAD_PURPOSES.nickel_evidence.de,
  conformity_declaration: 'Konformitätserklärung',
}

const date = (iso: string | null) => (iso ? formatBerlin(new Date(iso), 'dd.MM.yyyy') : null)

function DocItem({ doc, adminRoute }: { doc: ComplianceDocument; adminRoute: string }) {
  const href =
    doc.kind === 'conformity_declaration'
      ? `${adminRoute}/collections/conformity-declarations/${doc.id}`
      : (doc.url ?? `${adminRoute}/collections/private-uploads/${doc.id}`)
  return (
    <li className="pc-order__line" data-testid="compliance-doc" data-kind={doc.kind}>
      <a href={href} className="pc-admin-link" target="_blank" rel="noopener">
        {KIND_LABEL[doc.kind]}: {doc.title}
      </a>
      {doc.documentDate ? (
        <span className="pc-order__muted">
          {' '}
          · {adminText('safetyDocDate', { date: date(doc.documentDate)! })}
        </span>
      ) : null}
      {doc.note ? <span className="pc-order__muted"> · {doc.note}</span> : null}{' '}
      {doc.deletable ? (
        <StatusBadge tone="info">{adminText('safetyDeletable')}</StatusBadge>
      ) : doc.keepUntil ? (
        <StatusBadge>{adminText('safetyKeepUntil', { date: date(doc.keepUntil)! })}</StatusBadge>
      ) : null}
      {doc.seed ? <StatusBadge>{adminText('safetySeed')}</StatusBadge> : null}
    </li>
  )
}

export async function ProductSafetyView({ adminRoute, req }: AdminViewBodyProps) {
  const overview = await complianceOverview(req.payload, new Date(), { includeSeed: true, req })
  const categories = overview.categories.map((c) => ({ value: c.category, label: c.label }))
  return (
    <div className="pc-order" data-testid="product-safety">
      <p>{adminText('safetyIntro')}</p>
      {overview.categories.map((c) => {
        const headingId = `safety-${c.category}`
        return (
          <section
            key={c.category}
            className="pc-order__section"
            aria-labelledby={headingId}
            data-testid={`safety-category-${c.category}`}
          >
            <h2 id={headingId}>{c.label}</h2>
            <p className="pc-order__muted">
              {c.pieces === 0
                ? adminText('safetyNoPieces')
                : c.onMarket
                  ? adminText('safetyOnMarket', { count: c.pieces })
                  : c.keepUntil
                    ? adminText('safetyKeepAllUntil', {
                        count: c.pieces,
                        date: date(c.keepUntil)!,
                      })
                    : adminText('safetyPieces', { count: c.pieces })}
            </p>
            {c.missingTechnicalFile ? (
              <p>
                <StatusBadge tone="warning">{adminText('safetyMissing')}</StatusBadge>
              </p>
            ) : null}
            {c.documents.length > 0 ? (
              <ul className="pc-order__list">
                {c.documents.map((d) => (
                  <DocItem key={`${d.kind}-${d.id}`} doc={d} adminRoute={adminRoute} />
                ))}
              </ul>
            ) : (
              <p className="pc-order__muted">{adminText('safetyNoDocs')}</p>
            )}
            <p className="pc-admin-row">
              <a
                className="pc-admin-btn pc-admin-btn--secondary"
                href={`/api/admin/compliance/template.pdf?category=${c.category}`}
                target="_blank"
                rel="noopener"
                data-testid={`safety-template-${c.category}`}
              >
                {adminText('safetyTemplate')}
              </a>
            </p>
          </section>
        )
      })}
      {overview.uncategorized.length > 0 ? (
        <section className="pc-order__section" aria-labelledby="safety-other">
          <h2 id="safety-other">{adminText('safetyUncategorized')}</h2>
          <ul className="pc-order__list">
            {overview.uncategorized.map((d) => (
              <DocItem key={`${d.kind}-${d.id}`} doc={d} adminRoute={adminRoute} />
            ))}
          </ul>
        </section>
      ) : null}
      <ComplianceUpload categories={categories} />
    </div>
  )
}
