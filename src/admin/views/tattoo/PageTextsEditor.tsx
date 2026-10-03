'use client'

import React, { useRef, useState } from 'react'

import { lexicalToPlain } from '@/lib/richtext/plain'
import {
  TATTOO_TEXT_BLOCKS,
  TATTOO_TEXT_PAGES,
  blockLabel,
  editorTexts,
  newEditorBlock,
  newEditorRow,
  type EditorBlock,
  type LocalizedText,
  type TattooTextPageKey,
} from '@/lib/tattoo/textBlocks'
import type { TattooTextWarning } from '@/lib/tattoo/textWarnings'

import { Notice } from '../../components/Notice'
import { TranslateButton } from '../../components/TranslateButton'
import { adminText } from '../../translations'
import type { FieldIssue } from '../pieces/pieceForm'
import { IssueList, IssuesError, LocInput, errorsOf, issuesOf, requestJson } from './tattooForm'
import { tattooText } from './tattooText'

// Texte einer Tattoo-Seite (PLAN P7.9, KONZEPT §7.12): Stil/Einleitung, Preise, Ablauf bzw. Pflege-Phasen und Hinweise
// als Feldpaare DE/EN (Rich Text als Klartext: Leerzeile = Absatz, „- “ = Liste, **fett**, [Text](Link)). Speichern über
// `POST /api/pages/tattoo-texts` (legt die Seite bei Bedarf an, veröffentlicht sie), „Übersetzen“ über
// `POST /api/pages/:id/translate` (alle Blöcke, Struktur gleich). Warnungen bei V-24/V-15 – Speichern bleibt möglich.

type Doc = Record<string, unknown>

export function PageTextsEditor({
  pageKey,
  initialPageId,
  initialBlocks,
  translateDisabled,
}: {
  pageKey: TattooTextPageKey
  initialPageId: number | null
  initialBlocks: EditorBlock[]
  translateDisabled: string | null
}) {
  const [pageId, setPageId] = useState(initialPageId)
  const [blocks, setBlocks] = useState(initialBlocks)
  const [busy, setBusy] = useState(false)
  const [issues, setIssues] = useState<FieldIssue[]>([])
  const [warnings, setWarnings] = useState<TattooTextWarning[]>([])
  const [saved, setSaved] = useState(false)
  const running = useRef(false)
  const errors = errorsOf(issues)
  const page = TATTOO_TEXT_PAGES[pageKey]

  const update = (i: number, next: EditorBlock) =>
    setBlocks((bs) => bs.map((b, j) => (j === i ? next : b)))

  /** IDs neuer Blöcke/Zeilen aus der gespeicherten Seite übernehmen. */
  const adoptIds = (doc: Doc) => {
    const layout = (Array.isArray(doc.layout) ? doc.layout : []) as Doc[]
    setBlocks((bs) =>
      bs.map((b, i) => {
        const s = layout[i] ?? {}
        const rowsName = TATTOO_TEXT_BLOCKS[b.blockType]?.rows?.name
        const rows = rowsName && Array.isArray(s[rowsName]) ? (s[rowsName] as Doc[]) : []
        return {
          ...b,
          id: typeof s.id === 'string' ? s.id : b.id,
          rows: b.rows.map((r, j) => ({
            ...r,
            id: typeof rows[j]?.id === 'string' ? (rows[j]!.id as string) : r.id,
          })),
        }
      }),
    )
  }

  const persist = async (): Promise<number> => {
    const res = await requestJson('/api/pages/tattoo-texts', {
      method: 'POST',
      json: { key: pageKey, blocks },
    })
    if (!res.ok) throw new IssuesError(issuesOf(res.json))
    const doc = (res.json.doc ?? {}) as Doc
    adoptIds(doc)
    setWarnings((res.json.warnings as TattooTextWarning[] | undefined) ?? [])
    const id = Number(doc.id)
    setPageId(id)
    return id
  }

  const save = async () => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setIssues([])
    setSaved(false)
    try {
      await persist()
      setSaved(true)
    } catch (err) {
      setIssues(
        err instanceof IssuesError
          ? err.issues
          : [
              {
                field: '',
                message: adminText('actionFailed', {
                  message: String((err as Error)?.message ?? err),
                }),
              },
            ],
      )
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  const applyTranslation = (doc: Doc) => {
    const layout = (Array.isArray(doc.layout) ? doc.layout : []) as Doc[]
    const plain = (kind: string, v: unknown) =>
      kind === 'rich' ? lexicalToPlain(v).text : typeof v === 'string' ? v : ''
    setBlocks((bs) =>
      bs.map((b, i) => {
        const def = TATTOO_TEXT_BLOCKS[b.blockType]
        const s = layout.find((x) => x.id === b.id) ?? layout[i]
        if (!def || !b.editable || !s) return b
        const fields = { ...b.fields }
        for (const f of def.fields)
          fields[f.name] = {
            ...(fields[f.name] ?? { de: '', en: '' }),
            en: plain(f.kind, s[f.name]),
          }
        const rowsEn =
          def.rows && Array.isArray(s[def.rows.name]) ? (s[def.rows.name] as Doc[]) : []
        const rows = b.rows.map((r, j) => {
          const re = rowsEn.find((x) => x.id === r.id) ?? rowsEn[j]
          if (!re || !def.rows) return r
          const rf = { ...r.fields }
          for (const f of def.rows.fields)
            rf[f.name] = { ...(rf[f.name] ?? { de: '', en: '' }), en: plain(f.kind, re[f.name]) }
          return { ...r, fields: rf }
        })
        return { ...b, fields, rows }
      }),
    )
  }

  const hasEnglish = editorTexts(blocks, 'en').length > 0
  const missing = page.addable.filter((t) => !blocks.some((b) => b.blockType === t))

  return (
    <form
      className="pc-settings__form pc-tattoo-editor"
      noValidate
      data-testid={`page-texts-${pageKey}`}
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <p className="pc-piece__hint">{tattooText('textsMarkupHint')}</p>
      {blocks.length === 0 ? <p>{tattooText('textsNoBlocks')}</p> : null}
      {blocks.map((b, i) => {
        const def = TATTOO_TEXT_BLOCKS[b.blockType]
        const label = blockLabel(pageKey, b.blockType)
        return (
          <fieldset
            key={b.id ?? `new-${i}`}
            className="pc-field pc-settings__group"
            data-testid="page-block"
            data-block-type={b.blockType}
          >
            <legend className="pc-field__label">{label}</legend>
            {!b.editable || !def ? (
              <p className="pc-piece__hint">{tattooText('textsBlockElsewhere')}</p>
            ) : (
              <>
                {b.lossy ? <Notice tone="warning">{tattooText('textsLossy')}</Notice> : null}
                {def.fields.map((f) => (
                  <LocInput
                    key={f.name}
                    path={`blocks.${i}.fields.${f.name}`}
                    label={f.label}
                    value={b.fields[f.name] ?? { de: '', en: '' }}
                    multiline={f.kind !== 'text'}
                    rows={f.kind === 'rich' ? 6 : 3}
                    maxLength={f.maxLength}
                    required={f.required}
                    errors={errors}
                    onChange={(v: LocalizedText) =>
                      update(i, { ...b, fields: { ...b.fields, [f.name]: v } })
                    }
                  />
                ))}
                {def.rows
                  ? b.rows.map((r, j) => (
                      <fieldset key={r.id ?? `row-${j}`} className="pc-settings__row">
                        <legend>
                          {def.rows!.label} {j + 1}
                        </legend>
                        {def.rows!.fields.map((f) => (
                          <LocInput
                            key={f.name}
                            path={`blocks.${i}.rows.${j}.fields.${f.name}`}
                            label={f.label}
                            value={r.fields[f.name] ?? { de: '', en: '' }}
                            multiline={f.kind !== 'text'}
                            rows={f.kind === 'rich' ? 5 : 3}
                            maxLength={f.maxLength}
                            required={f.required}
                            errors={errors}
                            onChange={(v: LocalizedText) =>
                              update(i, {
                                ...b,
                                rows: b.rows.map((x, k) =>
                                  k === j ? { ...x, fields: { ...x.fields, [f.name]: v } } : x,
                                ),
                              })
                            }
                          />
                        ))}
                        {b.rows.length > def.rows!.min ? (
                          <p className="pc-admin-row">
                            <button
                              type="button"
                              className="pc-admin-btn pc-admin-btn--secondary"
                              onClick={() =>
                                update(i, { ...b, rows: b.rows.filter((_, k) => k !== j) })
                              }
                            >
                              {tattooText('removeRow', { label: `${def.rows!.label} ${j + 1}` })}
                            </button>
                          </p>
                        ) : null}
                      </fieldset>
                    ))
                  : null}
                {def.rows && b.rows.length < def.rows.max ? (
                  <p className="pc-admin-row">
                    <button
                      type="button"
                      className="pc-admin-btn pc-admin-btn--secondary"
                      onClick={() =>
                        update(i, { ...b, rows: [...b.rows, newEditorRow(b.blockType)] })
                      }
                    >
                      {tattooText('addRow', { label: def.rows.label })}
                    </button>
                  </p>
                ) : null}
              </>
            )}
          </fieldset>
        )
      })}
      {missing.length > 0 ? (
        <p className="pc-admin-row">
          {missing.map((t) => (
            <button
              key={t}
              type="button"
              className="pc-admin-btn pc-admin-btn--secondary"
              data-testid={`page-add-${t}`}
              onClick={() => setBlocks((bs) => [...bs, newEditorBlock(t)])}
            >
              {tattooText('addBlock', { label: blockLabel(pageKey, t) })}
            </button>
          ))}
        </p>
      ) : null}
      <TranslateButton<{ doc?: Doc }>
        endpoint={pageId ? `/api/pages/${pageId}/translate` : null}
        hasEnglish={hasEnglish}
        disabledReason={translateDisabled}
        disabled={busy || blocks.length === 0}
        prepare={async () => {
          try {
            return `/api/pages/${await persist()}/translate`
          } catch (err) {
            if (err instanceof IssuesError) {
              setIssues(err.issues)
              return null
            }
            throw err
          }
        }}
        onTranslated={(r) => applyTranslation(r.doc ?? {})}
      />
      <IssueList issues={issues} testId={`page-issues-${pageKey}`} />
      {warnings.length > 0 ? (
        <Notice tone="warning" data-testid="tattoo-text-warning">
          {tattooText('warningsSaved')}{' '}
          {warnings.map((w) => `„${w.match}“: ${w.message}`).join(' ')}
        </Notice>
      ) : null}
      {saved ? (
        <Notice tone="success" data-testid={`page-saved-${pageKey}`}>
          {tattooText('savedOnline')}
        </Notice>
      ) : null}
      <p className="pc-admin-row">
        <button
          type="submit"
          className="pc-admin-btn pc-admin-btn--primary"
          disabled={busy}
          aria-busy={busy || undefined}
          data-testid={`page-save-${pageKey}`}
        >
          {busy ? adminText('actionBusy') : tattooText('save')}
        </button>
      </p>
    </form>
  )
}
