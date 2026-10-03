'use client'

import { useRouter } from 'next/navigation'
import React, { useRef, useState } from 'react'

import type { FaqCategory } from '@/lib/enums'
import { lexicalToPlain } from '@/lib/richtext/plain'
import type { TattooTextWarning } from '@/lib/tattoo/textWarnings'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { Notice } from '../../components/Notice'
import { TranslateButton } from '../../components/TranslateButton'
import { adminText } from '../../translations'
import type { FieldIssue } from '../pieces/pieceForm'
import {
  CheckInput,
  IssueList,
  IssuesError,
  LocInput,
  errorsOf,
  issuesOf,
  requestJson,
  type Loc,
} from './tattooForm'
import { tattooText } from './tattooText'

// FAQ der Kategorien „Tattoo“ und „Aftercare“ (PLAN P7.9): je Frage ein kleines Formular (Frage und Antwort DE/EN,
// online), „Übersetzen“ (`POST /api/faqs/:id/translate`), Reihenfolge per „Hoch“/„Runter“ (`POST /api/faqs/:id/move`).
// Gespeichert über `POST /api/faqs/tattoo-save` mit Warnungen bei V-24/V-15 (Speichern bleibt möglich). In der Ansicht
// „Texte“ (P8.19a) für alle Kategorien über `POST /api/faqs/texts-save`.

export interface FaqItemValues {
  id: number | null
  category: FaqCategory
  question: Loc
  answer: Loc
  published: boolean
  lossy?: boolean
}

type Doc = Record<string, unknown>

function FaqItem({
  initial,
  index,
  count,
  translateDisabled,
  onCreated,
  saveEndpoint,
}: {
  initial: FaqItemValues
  index: number
  count: number
  translateDisabled: string | null
  onCreated?: () => void
  saveEndpoint: string
}) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [issues, setIssues] = useState<FieldIssue[]>([])
  const [warnings, setWarnings] = useState<TattooTextWarning[]>([])
  const [saved, setSaved] = useState(false)
  const running = useRef(false)
  const errors = errorsOf(issues)
  const prefix = `faq-${form.id ?? 'neu'}`

  const persist = async (): Promise<number> => {
    const res = await requestJson(saveEndpoint, { method: 'POST', json: form })
    if (!res.ok) throw new IssuesError(issuesOf(res.json))
    const id = Number((res.json.doc as Doc | undefined)?.id)
    setWarnings((res.json.warnings as TattooTextWarning[] | undefined) ?? [])
    if (!form.id) {
      setForm((f) => ({ ...f, id }))
      onCreated?.()
      router.refresh()
    }
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

  const title = form.question.de.trim() || tattooText('faqNew')
  return (
    <li
      className="pc-pieces__card pc-tattoo__card--nophoto"
      data-testid="faq-item"
      data-id={form.id ?? ''}
    >
      <details open={!form.id || undefined} className="pc-tattoo__faq">
        <summary className="pc-pieces__title">{title}</summary>
        <form
          className="pc-settings__form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          {form.lossy ? <Notice tone="warning">{tattooText('textsLossy')}</Notice> : null}
          <LocInput
            path={`${prefix}.question`}
            label={tattooText('faqQuestion')}
            value={form.question}
            maxLength={200}
            required
            errors={Object.fromEntries(
              Object.entries(errors).map(([k, v]) => [`${prefix}.${k}`, v]),
            )}
            onChange={(question) => setForm((f) => ({ ...f, question }))}
          />
          <LocInput
            path={`${prefix}.answer`}
            label={tattooText('faqAnswer')}
            hint={tattooText('textsMarkupHint')}
            value={form.answer}
            multiline
            rows={5}
            required
            errors={Object.fromEntries(
              Object.entries(errors).map(([k, v]) => [`${prefix}.${k}`, v]),
            )}
            onChange={(answer) => setForm((f) => ({ ...f, answer }))}
          />
          <CheckInput
            path={`${prefix}.published`}
            label={tattooText('onlineLabel')}
            checked={form.published}
            errors={{}}
            onChange={(published) => setForm((f) => ({ ...f, published }))}
          />
          <TranslateButton<{ doc?: Doc }>
            endpoint={form.id ? `/api/faqs/${form.id}/translate` : null}
            hasEnglish={form.question.en.trim() !== '' || form.answer.en.trim() !== ''}
            disabledReason={translateDisabled}
            disabled={busy}
            prepare={async () => {
              try {
                return `/api/faqs/${await persist()}/translate`
              } catch (err) {
                if (err instanceof IssuesError) {
                  setIssues(err.issues)
                  return null
                }
                throw err
              }
            }}
            onTranslated={(r) =>
              setForm((f) => ({
                ...f,
                question: { ...f.question, en: String(r.doc?.question ?? '') },
                answer: { ...f.answer, en: lexicalToPlain(r.doc?.answer).text },
              }))
            }
          />
          <IssueList issues={issues} testId="faq-issues" />
          {warnings.length > 0 ? (
            <Notice tone="warning" data-testid="tattoo-text-warning">
              {tattooText('warningsSaved')}{' '}
              {warnings.map((w) => `„${w.match}“: ${w.message}`).join(' ')}
            </Notice>
          ) : null}
          {saved ? (
            <Notice tone="success" data-testid="faq-saved">
              {tattooText('saved')}
            </Notice>
          ) : null}
          <p className="pc-admin-row">
            <button
              type="submit"
              className="pc-admin-btn pc-admin-btn--primary"
              disabled={busy}
              aria-busy={busy || undefined}
              data-testid="faq-save"
            >
              {busy ? adminText('actionBusy') : tattooText('save')}
            </button>
          </p>
        </form>
      </details>
      {form.id ? (
        <div className="pc-admin-row">
          <ActionButton
            variant="secondary"
            disabled={index === 0}
            data-testid="faq-up"
            action={() => postAdminAction(`/api/faqs/${form.id}/move`, { direction: 'up' })}
            onDone={() => router.refresh()}
          >
            {tattooText('moveUp')}
            <span className="pc-visually-hidden">: {title}</span>
          </ActionButton>
          <ActionButton
            variant="secondary"
            disabled={index === count - 1}
            data-testid="faq-down"
            action={() => postAdminAction(`/api/faqs/${form.id}/move`, { direction: 'down' })}
            onDone={() => router.refresh()}
          >
            {tattooText('moveDown')}
            <span className="pc-visually-hidden">: {title}</span>
          </ActionButton>
        </div>
      ) : null}
    </li>
  )
}

export function FaqEditor({
  category,
  items,
  translateDisabled,
  saveEndpoint = '/api/faqs/tattoo-save',
}: {
  category: FaqCategory
  items: FaqItemValues[]
  translateDisabled: string | null
  /** P8.19a: alle Kategorien über `POST /api/faqs/texts-save`. */
  saveEndpoint?: string
}) {
  const [adding, setAdding] = useState(0)
  return (
    <div data-testid={`faq-editor-${category}`}>
      {items.length === 0 && adding === 0 ? <p>{tattooText('faqEmpty')}</p> : null}
      <ul className="pc-pieces__list">
        {items.map((item, i) => (
          <FaqItem
            key={item.id}
            initial={item}
            index={i}
            count={items.length}
            translateDisabled={translateDisabled}
            saveEndpoint={saveEndpoint}
          />
        ))}
        {Array.from({ length: adding }, (_, k) => (
          <FaqItem
            key={`neu-${k}`}
            initial={{
              id: null,
              category,
              question: { de: '', en: '' },
              answer: { de: '', en: '' },
              published: true,
            }}
            index={items.length + k}
            count={items.length + adding}
            translateDisabled={translateDisabled}
            saveEndpoint={saveEndpoint}
            onCreated={() => setAdding((n) => Math.max(0, n - 1))}
          />
        ))}
      </ul>
      <p className="pc-admin-row">
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--secondary"
          data-testid={`faq-add-${category}`}
          onClick={() => setAdding((n) => n + 1)}
        >
          {tattooText('faqAdd')}
        </button>
      </p>
    </div>
  )
}
