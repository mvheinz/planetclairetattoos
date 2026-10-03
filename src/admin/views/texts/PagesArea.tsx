import Link from 'next/link'
import React from 'react'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { FAQ_CATEGORIES, PAGE_KEYS, type PageKey } from '@/lib/enums'
import { loadFaqs, loadPageTexts } from '@/lib/tattoo/admin'
import { isPageKey } from '@/lib/tattoo/textBlocks'

import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { FaqEditor } from '../tattoo/FaqEditor'
import { PageTextsEditor } from '../tattoo/PageTextsEditor'

// Ansicht „Texte“ → „Seiten und FAQ“ (PLAN P8.19a, KONZEPT §7.13): Liste aller `PAGE_KEYS` (Beispieltext oder eigener
// Text); `?seite=<key>` öffnet das Handy-Formular der Seite (Titel, SEO, alle Textblöcke DE/EN, „Übersetzen“). Darunter
// die FAQ aller Kategorien als sortierbare Liste (Hoch/Runter, auch per Tastatur). Speichern setzt `seed = false`
// (Übernahme, DATENMODELL §13.4) und erneuert die öffentlichen Seiten (≤ 60 s).

function param(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? ''
}

export async function PagesArea({
  adminRoute,
  req,
  searchParams,
  translateDisabled,
}: Pick<AdminViewBodyProps, 'adminRoute' | 'req' | 'searchParams'> & {
  translateDisabled: string | null
}) {
  const base = `${adminRoute}/texte`
  const selectedRaw = param(searchParams?.seite)
  const selected: PageKey | null = isPageKey(selectedRaw) ? selectedRaw : null
  const pages = await req.payload.find({
    collection: 'pages',
    select: { key: true, seed: true },
    pagination: false,
    depth: 0,
    draft: true,
    overrideAccess: true,
    req,
  })
  const state = new Map(
    (pages.docs as Array<{ key?: string | null; seed?: boolean | null }>).map((d) => [
      String(d.key),
      d.seed === true,
    ]),
  )
  const editing = selected ? await loadPageTexts(req, selected) : null
  const faqs = await loadFaqs(req, FAQ_CATEGORIES)

  return (
    <div data-testid="texts-pages-area">
      <p className="pc-order__muted">{adminText('textsPagesIntro')}</p>
      {selected && editing ? (
        <div
          className="pc-order__card"
          id="seite"
          data-testid="texts-page-editor"
          data-key={selected}
        >
          <h3 id="texts-page-editing">
            {adminText('textsPagesEditing', { page: ENUM_LABELS.PAGE_KEYS[selected].de })}
          </h3>
          {editing.page?.seed ? (
            <Notice tone="info" data-testid="texts-page-seed-hint">
              {adminText('textsPagesSeedHint')}
            </Notice>
          ) : null}
          <PageTextsEditor
            key={selected}
            mode="all"
            pageKey={selected}
            initialPageId={editing.page?.id ?? null}
            initialBlocks={editing.blocks}
            initialMeta={
              editing.page ? { title: editing.page.title, seo: editing.page.seo } : undefined
            }
            translateDisabled={translateDisabled}
          />
          <p className="pc-admin-row">
            <Link href={`${base}#texts-pages`} prefetch={false} className="pc-admin-link">
              {adminText('textsPagesClose')}
            </Link>
          </p>
        </div>
      ) : null}
      <h3 id="texts-pages-list">{adminText('textsPagesList')}</h3>
      <ul className="pc-order__items" aria-labelledby="texts-pages-list">
        {PAGE_KEYS.map((key) => {
          const exists = state.has(key)
          const seed = state.get(key) === true
          return (
            <li
              key={key}
              className="pc-order__item"
              data-testid="texts-page-item"
              data-key={key}
              aria-current={key === selected ? 'true' : undefined}
            >
              <Link
                href={`${base}?seite=${key}#seite`}
                prefetch={false}
                className="pc-admin-link"
                data-testid={`texts-page-link-${key}`}
              >
                {ENUM_LABELS.PAGE_KEYS[key].de}
                <span className="pc-visually-hidden"> – {adminText('textsPagesEdit')}</span>
              </Link>{' '}
              {!exists ? (
                <StatusBadge tone="warning">{adminText('textsPagesMissing')}</StatusBadge>
              ) : seed ? (
                <StatusBadge tone="info">{adminText('textsPagesSeed')}</StatusBadge>
              ) : (
                <StatusBadge tone="success">{adminText('textsPagesOwn')}</StatusBadge>
              )}
            </li>
          )
        })}
      </ul>

      <h3 id="texts-faq">{adminText('textsFaq')}</h3>
      <p className="pc-order__muted">{adminText('textsFaqIntro')}</p>
      {FAQ_CATEGORIES.map((category) => (
        <section
          key={category}
          aria-labelledby={`texts-faq-${category}`}
          data-testid={`texts-faq-${category}`}
        >
          <h4 id={`texts-faq-${category}`}>{ENUM_LABELS.FAQ_CATEGORIES[category].de}</h4>
          <FaqEditor
            category={category}
            items={faqs.filter((f) => f.category === category)}
            translateDisabled={translateDisabled}
            saveEndpoint="/api/faqs/texts-save"
          />
        </section>
      ))}
    </div>
  )
}
