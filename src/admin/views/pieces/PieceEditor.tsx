'use client'

import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import { CopyButton } from '../../components/CopyButton'
import { Notice } from '../../components/Notice'
import { PhotoPicker } from '../../components/PhotoPicker/PhotoPicker'
import { refreshAutoAlts, type PiecePhoto } from '../../components/PhotoPicker/photoList'
import { StatusBadge } from '../../components/StatusBadge'
import { TranslateButton } from '../../components/TranslateButton'
import { ADMIN_CUSTOM_DE, adminText, type AdminCustomKey } from '../../translations'
import { ENUM_LABELS } from '@/lib/enumLabels'
import {
  DEVIATION_DECISIONS,
  FIBER_COMPONENTS,
  PRODUCT_CATEGORIES,
  SHIPPING_CLASSES,
  TEXTILE_CONDITIONS,
  TEXTILE_FIBERS,
  type ProductStatus,
} from '@/lib/enums'
import { PRICE_CENTS_RANGE, parseEuroInput } from '@/lib/money'
import { isTextile } from '@/lib/products/categoryRules'
import { padItemNumber } from '@/lib/products/itemNumber'
import { productPath } from '@/lib/shop/format'

import {
  applyCategory,
  fieldAnchor,
  formFromDoc,
  issuesFromResponse,
  pieceLocks,
  textFieldsFor,
  toEnData,
  toSaveData,
  type CategoryTemplateTexts,
  type FieldIssue,
  type PieceForm,
  type PieceTextField,
} from './pieceForm'

// Handy-Formular „Neues Stück“ / „Stück bearbeiten“ (PLAN P5.5/P5.6, KONZEPT §7.4). Felder, Grenzen und Regeln laut
// DATENMODELL §6.6 – geprüft wird auf dem Server (dieselbe Validierung wie das Standardformular); Fehler erscheinen als
// Liste mit Sprunglinks. Speichern schreibt DE (+ nicht lokalisierte Felder), danach bei Bedarf EN, Alt-Texte und
// Fokuspunkte am Bild. „Online stellen“ = `POST /api/products/:id/publish`, danach Erfolgsseite mit Links.

export interface PieceEditorInitial {
  id: number | null
  status: ProductStatus | null
  firstPublishedAt: string | null
  slug: string | null
  form: PieceForm
  photos: PiecePhoto[]
}

export interface PieceEditorProps {
  adminRoute: string
  siteUrl: string
  initial: PieceEditorInitial
  templates: CategoryTemplateTexts
  declarations: { id: number; label: string }[]
  translation: { enabled: boolean; reason?: string }
}

type Phase = 'idle' | 'saving' | 'publishing'
type Result =
  | { kind: 'saved' }
  | { kind: 'issues'; heading: string; issues: FieldIssue[] }
  | { kind: 'error'; text: string }
  | null

type Doc = Record<string, unknown>

const ITEM_CHECK_DELAY = 350

async function requestJson(
  url: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<{ ok: boolean; status: number; json: Doc }> {
  const { json: body, ...rest } = init
  let res: Response
  try {
    res = await fetch(url, {
      credentials: 'include',
      ...rest,
      headers: body === undefined ? rest.headers : { 'content-type': 'application/json' },
      body: body === undefined ? rest.body : JSON.stringify(body),
    })
  } catch {
    throw new Error(adminText('actionOffline'))
  }
  const json = (await res.json().catch(() => ({}))) as Doc
  return { ok: res.ok, status: res.status, json }
}

class IssuesError extends Error {
  constructor(readonly issues: FieldIssue[]) {
    super(issues.map((i) => i.message).join(' '))
  }
}

function fieldLabel(path: string): string {
  const key = `pieceField_${path.split('.')[0]}`
  return key in ADMIN_CUSTOM_DE ? adminText(key as AdminCustomKey) : ''
}

export function PieceEditor({
  adminRoute,
  siteUrl,
  initial,
  templates,
  declarations,
  translation,
}: PieceEditorProps) {
  const [id, setId] = useState(initial.id)
  const [status, setStatus] = useState<ProductStatus | null>(initial.status)
  const [firstPublishedAt, setFirstPublishedAt] = useState(initial.firstPublishedAt)
  const [form, setForm] = useState<PieceForm>(initial.form)
  const [photos, setPhotos] = useState<PiecePhoto[]>(initial.photos)
  const [savedImages, setSavedImages] = useState<number[]>(initial.photos.map((p) => p.id))
  const [removed, setRemoved] = useState<number[]>([])
  const [enDirty, setEnDirty] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<Result>(null)
  const [published, setPublished] = useState<{ url: string; short: string } | null>(null)
  const [itemCheck, setItemCheck] = useState<{ for: string; text: string; ok: boolean } | null>(
    null,
  )
  const [evidenceName, setEvidenceName] = useState<string | null>(null)
  const router = useRouter()
  const running = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const locks = pieceLocks(status, firstPublishedAt)
  const category = form.category
  const itemNumber = /^\d+$/.test(form.itemNumber) ? Number(form.itemNumber) : null
  const altInfo = useMemo(
    () => ({ category, title: form.de.title, itemNumber }),
    [category, form.de.title, itemNumber],
  )

  // Automatische Alt-Texte folgen Titel, Kategorie, Nummer und Anzahl der Fotos (abgeleitet, nicht gespeichert).
  const shownPhotos = useMemo(() => refreshAutoAlts(photos, altInfo), [photos, altInfo])

  // Live-Prüfung der Objektnummer (nur solange änderbar); das Ergebnis gilt nur für die geprüfte Eingabe.
  const rawItemNumber = form.itemNumber.trim()
  useEffect(() => {
    if (locks.itemNumber || rawItemNumber === '') return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      const q = new URLSearchParams({ n: rawItemNumber })
      if (id) q.set('exclude', String(id))
      fetch(`/api/products/item-number-status?${q}`, {
        credentials: 'include',
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then((j: { status?: string; message?: string }) =>
          setItemCheck({ for: rawItemNumber, text: j.message ?? '', ok: j.status === 'free' }),
        )
        .catch(() => undefined)
    }, ITEM_CHECK_DELAY)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [rawItemNumber, id, locks.itemNumber])
  const itemCheckShown = itemCheck && itemCheck.for === rawItemNumber ? itemCheck : null

  const set = <K extends keyof PieceForm>(key: K, value: PieceForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))
  const setDe = (key: PieceTextField, value: string) =>
    setForm((f) => ({ ...f, de: { ...f.de, [key]: value } }))
  const setEn = (key: PieceTextField, value: string) => {
    setEnDirty(true)
    setForm((f) => ({ ...f, en: { ...f.en, [key]: value } }))
  }

  const showResult = (r: Result) => {
    setResult(r)
    requestAnimationFrame(() => resultRef.current?.focus())
  }

  /** Speichert alles; liefert die ID des Stücks (oder wirft). */
  const persist = useCallback(async (): Promise<number> => {
    if (uploading) throw new Error(adminText('pieceWaitUploads'))
    const priceText = form.price.trim()
    const priceCents =
      priceText === '' ? null : (parseEuroInput(priceText, PRICE_CENTS_RANGE) ?? -1)
    if (priceCents === -1) {
      throw new IssuesError([{ field: 'priceCents', message: adminText('piecePriceInvalid') }])
    }

    // 1. Bilder: Alt-Texte und Fokuspunkt
    for (const p of shownPhotos.filter((x) => x.dirty)) {
      const de = await requestJson(`/api/media/${p.id}?locale=de&depth=0`, {
        method: 'PATCH',
        json: { alt: p.altDe, focalX: p.focalX, focalY: p.focalY },
      })
      if (!de.ok) {
        throw new IssuesError(
          issuesFromResponse(de.json).map((i) => ({
            field: 'images',
            message: `${adminText('photoNumber', { n: shownPhotos.indexOf(p) + 1 })}: ${i.message}`,
          })),
        )
      }
      const en = await requestJson(`/api/media/${p.id}?locale=en&depth=0`, {
        method: 'PATCH',
        json: { alt: p.altEn.trim() === '' ? null : p.altEn },
      })
      if (!en.ok) throw new IssuesError(issuesFromResponse(en.json))
    }
    setPhotos(shownPhotos.map((p) => (p.dirty ? { ...p, dirty: false } : p)))

    // 2. Stück (DE + nicht lokalisierte Felder)
    const images = shownPhotos.map((p) => p.id)
    const data = toSaveData(form, { priceCents, images, locks })
    const res = await requestJson(
      id ? `/api/products/${id}?locale=de&depth=0` : '/api/products?locale=de&depth=0',
      { method: id ? 'PATCH' : 'POST', json: data },
    )
    if (!res.ok) {
      const issues = issuesFromResponse(res.json)
      throw issues.length ? new IssuesError(issues) : new Error(String(res.status))
    }
    const doc = (res.json.doc ?? {}) as Doc
    const newId = Number(doc.id)

    // 3. Englische Texte (nur wenn du sie geändert hast)
    if (enDirty) {
      const en = await requestJson(`/api/products/${newId}?locale=en&depth=0`, {
        method: 'PATCH',
        json: toEnData(form),
      })
      if (!en.ok) throw new IssuesError(issuesFromResponse(en.json))
      setEnDirty(false)
    }

    // 4. Entfernte Fotos löschen (nur wenn nichts anderes sie nutzt; sonst bleiben sie liegen)
    for (const mediaId of removed) {
      await requestJson(`/api/media/${mediaId}`, { method: 'DELETE' }).catch(() => undefined)
    }
    setRemoved([])
    setSavedImages(images)

    // Server-Vorbelegungen (Kategorie-Vorlagen, Versandklasse) übernehmen, eigene EN-Eingaben behalten.
    setForm((f) => ({ ...formFromDoc(doc, null), en: f.en }))
    setStatus((doc.status as ProductStatus) ?? 'draft')
    setFirstPublishedAt((doc.firstPublishedAt as string | null) ?? null)
    if (!id) {
      setId(newId)
      window.history.replaceState(null, '', `${adminRoute}/stuecke/${newId}`)
    }
    return newId
  }, [adminRoute, enDirty, form, id, locks, shownPhotos, removed, uploading])

  const guard = async (next: Phase, fn: () => Promise<void>) => {
    if (running.current) return
    running.current = true
    setPhase(next)
    setResult(null)
    try {
      await fn()
    } catch (err) {
      if (err instanceof IssuesError) {
        showResult({ kind: 'issues', heading: adminText('pieceCheckHeading'), issues: err.issues })
      } else {
        showResult({
          kind: 'error',
          text: adminText('actionFailed', { message: (err as Error)?.message ?? String(err) }),
        })
      }
    } finally {
      running.current = false
      setPhase('idle')
    }
  }

  const saveDraft = () =>
    guard('saving', async () => {
      await persist()
      showResult({ kind: 'saved' })
    })

  const publish = () =>
    guard('publishing', async () => {
      const pid = await persist()
      const res = await requestJson(`/api/products/${pid}/publish`, { method: 'POST', json: {} })
      if (!res.ok) {
        const issues = issuesFromResponse(res.json)
        showResult({ kind: 'issues', heading: adminText('pieceMissingHeading'), issues })
        return
      }
      const doc = (res.json.doc ?? {}) as Doc
      setStatus('available')
      setFirstPublishedAt((doc.firstPublishedAt as string | null) ?? new Date().toISOString())
      const nr = Number(doc.itemNumber ?? itemNumber)
      const base = siteUrl.replace(/\/$/, '')
      setPublished({
        url: `${base}${productPath({ itemNumber: nr, slug: doc.slug as string | undefined }, 'de')}`,
        short: `${base}/nr/${nr}`,
      })
    })

  const preview = () =>
    guard('saving', async () => {
      const pid = await persist()
      router.push(`${adminRoute}/stuecke/${pid}/vorschau`)
    })

  const prepareTranslate = async (): Promise<string | null> => {
    try {
      const pid = await persist()
      return `/api/products/${pid}/translate`
    } catch (err) {
      if (err instanceof IssuesError) {
        showResult({ kind: 'issues', heading: adminText('pieceCheckHeading'), issues: err.issues })
        return null
      }
      throw err
    }
  }

  const applyTranslation = async (res: { doc?: Doc }) => {
    const en = formFromDoc(res.doc ?? {}, res.doc ?? {}).en
    setForm((f) => ({ ...f, en }))
    setEnDirty(false)
    const alts = await Promise.all(
      photos.map(async (p) => {
        const r = await requestJson(`/api/media/${p.id}?locale=en&fallback-locale=none&depth=0`)
        return typeof r.json.alt === 'string' ? r.json.alt : p.altEn
      }),
    )
    setPhotos((prev) => prev.map((p, i) => ({ ...p, altEn: alts[i] ?? p.altEn })))
  }

  const uploadEvidence = async (file: File | undefined) => {
    if (!file) return
    const body = new FormData()
    body.append('file', file)
    body.append('_payload', JSON.stringify({ purpose: 'nickel_evidence' }))
    const res = await fetch('/api/private-uploads?depth=0', {
      method: 'POST',
      credentials: 'include',
      body,
    }).catch(() => null)
    const json = (await res?.json().catch(() => ({}))) as { doc?: { id?: number } }
    if (res?.ok && json.doc?.id) {
      set('nickelEvidence', json.doc.id)
      setEvidenceName(file.name)
    } else {
      showResult({
        kind: 'issues',
        heading: adminText('pieceCheckHeading'),
        issues: issuesFromResponse(json).length
          ? issuesFromResponse(json)
          : [{ field: 'nickelEvidence', message: adminText('pieceEvidenceFailed') }],
      })
    }
  }

  const jump = (e: React.MouseEvent<HTMLAnchorElement>, anchor: string) => {
    const el = document.getElementById(anchor)
    if (!el) return
    e.preventDefault()
    el.scrollIntoView({ block: 'center' })
    el.focus()
  }

  const busy = phase !== 'idle'
  const hasEnglish =
    Object.values(form.en).some((v) => v.trim() !== '') || photos.some((p) => p.altEn.trim() !== '')
  const textile = isTextile(category)
  const statusLabel = status ? ENUM_LABELS.PRODUCT_STATUSES[status].de : null
  const imagesChanged =
    savedImages.length !== photos.length || savedImages.some((v, i) => v !== photos[i]?.id)

  if (published) {
    return (
      <div className="pc-piece" data-testid="piece-published">
        <Notice tone="success">
          {adminText('piecePublished', { nr: padItemNumber(itemNumber ?? 0) })}
        </Notice>
        <p className="pc-piece__url" data-testid="piece-public-url">
          {published.url}
        </p>
        <div className="pc-admin-row">
          <CopyButton text={published.url} label={adminText('pieceCopyLink')} />
          <CopyButton text={published.short} label={adminText('pieceCopyShort')} />
        </div>
        <p className="pc-admin-row">
          <a
            className="pc-admin-btn pc-admin-btn--primary"
            href={`${adminRoute}/neues-stueck`}
            data-testid="piece-another"
          >
            {adminText('pieceAnother')}
          </a>
          <a className="pc-admin-btn pc-admin-btn--secondary" href={`${adminRoute}/stuecke/${id}`}>
            {adminText('pieceBackToEdit')}
          </a>
          <a className="pc-admin-btn pc-admin-btn--secondary" href={`${adminRoute}/stuecke`}>
            {adminText('pieceToList')}
          </a>
        </p>
      </div>
    )
  }

  return (
    <form
      className="pc-piece"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void saveDraft()
      }}
      data-testid="piece-form"
    >
      {statusLabel ? (
        <p className="pc-piece__status">
          {adminText('pieceStatus')}{' '}
          <StatusBadge tone={status === 'available' ? 'success' : 'neutral'}>
            {statusLabel}
          </StatusBadge>
        </p>
      ) : null}

      <PhotoPicker
        photos={shownPhotos}
        setPhotos={setPhotos}
        altInfo={altInfo}
        onBusyChange={setUploading}
        onRemoved={(p) => setRemoved((r) => [...r, p.id])}
        disabled={busy}
      />
      {imagesChanged ? <p className="pc-piece__hint">{adminText('photoUnsaved')}</p> : null}

      <Section title={adminText('pieceSectionBasics')}>
        <fieldset id="pf-category" tabIndex={-1} className="pc-field pc-field--choices">
          <legend className="pc-field__label">
            {adminText('pieceField_category')} <Required />
          </legend>
          {locks.category ? (
            <p className="pc-piece__hint">{adminText('pieceCategoryLocked')}</p>
          ) : null}
          <div className="pc-choices">
            {PRODUCT_CATEGORIES.map((c) => (
              <label key={c} className="pc-choice">
                <input
                  type="radio"
                  name="category"
                  value={c}
                  checked={category === c}
                  disabled={locks.category || busy}
                  onChange={() => setForm((f) => applyCategory(f, c, templates))}
                />
                <span>{ENUM_LABELS.PRODUCT_CATEGORIES[c].de}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          id="pf-itemNumber"
          label={adminText('pieceField_itemNumber')}
          required
          hint={
            locks.itemNumber ? adminText('pieceItemNumberLocked') : adminText('pieceItemNumberHint')
          }
        >
          {(props) => (
            <>
              <input
                {...props}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={form.itemNumber}
                readOnly={locks.itemNumber}
                disabled={busy}
                onChange={(e) => set('itemNumber', e.target.value.replace(/\D/g, '').slice(0, 5))}
              />
              {!locks.itemNumber && itemCheckShown ? (
                <span
                  className={`pc-piece__check ${itemCheckShown.ok ? 'is-ok' : 'is-bad'}`}
                  role="status"
                  aria-live="polite"
                  data-testid="item-number-status"
                >
                  {itemCheckShown.text}
                </span>
              ) : null}
            </>
          )}
        </Field>

        <TextField
          id="pf-title"
          label={adminText('pieceField_title')}
          required
          value={form.de.title}
          max={80}
          disabled={busy}
          onChange={(v) => setDe('title', v)}
        />
        <TextField
          id="pf-description"
          label={adminText('pieceField_description')}
          required
          multiline
          rows={5}
          hint={adminText('pieceDescriptionHint')}
          value={form.de.description}
          max={4000}
          disabled={busy}
          onChange={(v) => setDe('description', v)}
        />
        <TextField
          id="pf-juttaSays"
          label={adminText('pieceField_juttaSays')}
          multiline
          rows={2}
          value={form.de.juttaSays}
          max={280}
          disabled={busy}
          onChange={(v) => setDe('juttaSays', v)}
        />
        <TextField
          id="pf-priceCents"
          label={adminText('pieceField_priceCents')}
          required
          inputMode="decimal"
          hint={locks.price ? adminText('piecePriceLocked') : adminText('piecePriceHint')}
          readOnly={locks.price}
          value={form.price}
          disabled={busy}
          onChange={(v) => set('price', v)}
          suffix="€"
        />
      </Section>

      <Section title={adminText('pieceSectionRequired')}>
        <TextField
          id="pf-materials"
          label={adminText('pieceField_materials')}
          required
          value={form.de.materials}
          max={200}
          hint={adminText('pieceMaterialsHint')}
          disabled={busy}
          onChange={(v) => setDe('materials', v)}
        />
        <fieldset id="pf-dimensions" tabIndex={-1} className="pc-field">
          <legend className="pc-field__label">
            {adminText('pieceField_dimensions')} {textile ? null : <Required />}
          </legend>
          <div className="pc-piece__dims">
            {(['widthCm', 'heightCm', 'depthCm', 'diameterCm'] as const).map((k) => (
              <TextField
                key={k}
                id={`pf-${k}`}
                label={adminText(`pieceDim_${k}`)}
                inputMode="decimal"
                value={form[k]}
                disabled={busy}
                onChange={(v) => set(k, v)}
                suffix="cm"
              />
            ))}
          </div>
          <TextField
            id="pf-dimensionsNote"
            label={adminText('pieceField_dimensionsNote')}
            value={form.de.dimensionsNote}
            max={120}
            disabled={busy}
            onChange={(v) => setDe('dimensionsNote', v)}
          />
        </fieldset>
        <TextField
          id="pf-weightGrams"
          label={adminText('pieceField_weightGrams')}
          required
          inputMode="numeric"
          value={form.weightGrams}
          hint={adminText('pieceWeightHint')}
          disabled={busy}
          onChange={(v) => set('weightGrams', v)}
          suffix="g"
        />
        <SelectField
          id="pf-shippingClass"
          label={adminText('pieceField_shippingClass')}
          required
          value={form.shippingClass}
          disabled={busy || locks.price}
          options={SHIPPING_CLASSES.map((s) => ({
            value: s,
            label: ENUM_LABELS.SHIPPING_CLASSES[s].de,
          }))}
          onChange={(v) => set('shippingClass', v as PieceForm['shippingClass'])}
          hint={
            category === 'keramik' &&
            form.shippingClass &&
            form.shippingClass !== 'keramik' &&
            form.shippingClass !== 'nur_abholung'
              ? adminText('pieceShippingCeramicWarning')
              : adminText('pieceShippingHint')
          }
        />

        {category === 'keramik' ? (
          <>
            <fieldset id="pf-foodContact" tabIndex={-1} className="pc-field pc-field--choices">
              <legend className="pc-field__label">
                {adminText('pieceField_foodContact')} <Required />
              </legend>
              <div className="pc-choices">
                {(['deko', 'lebensmittelecht'] as const).map((v) => (
                  <label key={v} className="pc-choice">
                    <input
                      type="radio"
                      name="foodContact"
                      value={v}
                      checked={form.foodContact === v}
                      disabled={busy}
                      onChange={() => set('foodContact', v)}
                    />
                    <span>{ENUM_LABELS.FOOD_CONTACT[v].de}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {form.foodContact === 'lebensmittelecht' ? (
              <fieldset id="pf-conformityDeclarations" tabIndex={-1} className="pc-field">
                <legend className="pc-field__label">
                  {adminText('pieceField_conformityDeclarations')} <Required />
                </legend>
                {declarations.length === 0 ? (
                  <p className="pc-piece__hint">{adminText('pieceNoDeclarations')}</p>
                ) : (
                  declarations.map((d) => (
                    <Check
                      key={d.id}
                      label={d.label}
                      checked={form.conformityDeclarations.includes(d.id)}
                      disabled={busy}
                      onChange={(on) =>
                        set(
                          'conformityDeclarations',
                          on
                            ? [...form.conformityDeclarations, d.id]
                            : form.conformityDeclarations.filter((x) => x !== d.id),
                        )
                      }
                    />
                  ))
                )}
              </fieldset>
            ) : null}
          </>
        ) : null}

        {textile ? (
          <>
            <TextField
              id="pf-sizeLabel"
              label={adminText('pieceField_sizeLabel')}
              required
              value={form.de.sizeLabel}
              max={60}
              hint={adminText('pieceSizeHint')}
              disabled={busy}
              onChange={(v) => setDe('sizeLabel', v)}
            />
            <SelectField
              id="pf-condition"
              label={adminText('pieceField_condition')}
              required
              value={form.condition}
              disabled={busy}
              options={TEXTILE_CONDITIONS.map((c) => ({
                value: c,
                label: ENUM_LABELS.TEXTILE_CONDITIONS[c].de,
              }))}
              onChange={(v) => set('condition', v as PieceForm['condition'])}
            />
            <TextField
              id="pf-conditionNote"
              label={adminText('pieceField_conditionNote')}
              multiline
              rows={2}
              value={form.de.conditionNote}
              max={300}
              disabled={busy}
              onChange={(v) => setDe('conditionNote', v)}
            />
            <Check
              id="pf-isSecondHand"
              label={adminText('pieceField_isSecondHand')}
              checked={form.isSecondHand}
              disabled={busy}
              onChange={(v) => set('isSecondHand', v)}
            />
            <fieldset id="pf-fiberComposition" tabIndex={-1} className="pc-field">
              <legend className="pc-field__label">
                {adminText('pieceField_fiberComposition')} <Required />
              </legend>
              <p className="pc-piece__hint">{adminText('pieceFiberHint')}</p>
              {form.fiberComposition.map((row, i) => (
                <div key={i} className="pc-piece__fiber">
                  <SelectField
                    id={`pf-fiber-${i}-component`}
                    label={adminText('pieceFiberComponent')}
                    value={row.component}
                    disabled={busy}
                    options={FIBER_COMPONENTS.map((c) => ({
                      value: c,
                      label: ENUM_LABELS.FIBER_COMPONENTS[c].de,
                    }))}
                    onChange={(v) =>
                      set(
                        'fiberComposition',
                        form.fiberComposition.map((r, j) =>
                          j === i ? { ...r, component: v as typeof r.component } : r,
                        ),
                      )
                    }
                  />
                  <SelectField
                    id={`pf-fiber-${i}-fiber`}
                    label={adminText('pieceFiberFiber')}
                    value={row.fiber}
                    disabled={busy}
                    options={TEXTILE_FIBERS.map((c) => ({
                      value: c,
                      label: ENUM_LABELS.TEXTILE_FIBERS[c].de,
                    }))}
                    onChange={(v) =>
                      set(
                        'fiberComposition',
                        form.fiberComposition.map((r, j) =>
                          j === i ? { ...r, fiber: v as typeof r.fiber } : r,
                        ),
                      )
                    }
                  />
                  <TextField
                    id={`pf-fiber-${i}-percent`}
                    label={adminText('pieceFiberPercent')}
                    inputMode="numeric"
                    value={row.percent}
                    disabled={busy}
                    suffix="%"
                    onChange={(v) =>
                      set(
                        'fiberComposition',
                        form.fiberComposition.map((r, j) => (j === i ? { ...r, percent: v } : r)),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="pc-admin-btn pc-admin-btn--secondary"
                    disabled={busy}
                    onClick={() =>
                      set(
                        'fiberComposition',
                        form.fiberComposition.filter((_, j) => j !== i),
                      )
                    }
                  >
                    {adminText('pieceFiberRemove')}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="pc-admin-btn pc-admin-btn--secondary"
                disabled={busy}
                onClick={() =>
                  set('fiberComposition', [
                    ...form.fiberComposition,
                    {
                      component: 'main',
                      fiber: '',
                      percent: form.fiberComposition.length === 0 ? '100' : '',
                    },
                  ])
                }
              >
                {adminText('pieceFiberAdd')}
              </button>
            </fieldset>
            <Check
              id="pf-labelMissing"
              label={adminText('pieceField_labelMissing')}
              checked={form.labelMissing}
              disabled={busy}
              onChange={(v) => set('labelMissing', v)}
            />
            {form.labelMissing ? (
              <TextField
                id="pf-fiberFreeText"
                label={adminText('pieceField_fiberFreeText')}
                required
                value={form.de.fiberFreeText}
                max={200}
                disabled={busy}
                onChange={(v) => setDe('fiberFreeText', v)}
              />
            ) : null}
            <TextField
              id="pf-careInstructions"
              label={adminText('pieceField_careInstructions')}
              multiline
              rows={3}
              value={form.de.careInstructions}
              max={500}
              disabled={busy}
              onChange={(v) => setDe('careInstructions', v)}
            />
            <Check
              id="pf-blankBrandVisible"
              label={adminText('pieceField_blankBrandVisible')}
              hint={adminText('pieceBlankBrandHint')}
              checked={form.blankBrandVisible}
              disabled={busy}
              onChange={(v) => set('blankBrandVisible', v)}
            />
          </>
        ) : null}

        {category === 'schmuck' ? (
          <>
            <TextField
              id="pf-metalPartsMaterial"
              label={adminText('pieceField_metalPartsMaterial')}
              required
              value={form.de.metalPartsMaterial}
              max={120}
              hint={adminText('pieceMetalHint')}
              disabled={busy}
              onChange={(v) => setDe('metalPartsMaterial', v)}
            />
            <Check
              id="pf-nickelFreeConfirmed"
              label={adminText('pieceField_nickelFreeConfirmed')}
              required
              checked={form.nickelFreeConfirmed}
              disabled={busy}
              onChange={(v) => set('nickelFreeConfirmed', v)}
            />
            <div id="pf-nickelEvidence" tabIndex={-1} className="pc-field">
              <span className="pc-field__label">
                {adminText('pieceField_nickelEvidence')} <Required />
              </span>
              <p className="pc-piece__hint">
                {form.nickelEvidence
                  ? adminText('pieceEvidenceAttached', {
                      name: evidenceName ?? `#${form.nickelEvidence}`,
                    })
                  : adminText('pieceEvidenceMissing')}
              </p>
              <label className="pc-admin-btn pc-admin-btn--secondary pc-photos__pick">
                {adminText('pieceEvidenceUpload')}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="pc-photos__input"
                  disabled={busy}
                  onChange={(e) => void uploadEvidence(e.currentTarget.files?.[0])}
                />
              </label>
            </div>
            <Check
              id="pf-leadFreeGlazeConfirmed"
              label={adminText('pieceField_leadFreeGlazeConfirmed')}
              required
              checked={form.leadFreeGlazeConfirmed}
              disabled={busy}
              onChange={(v) => set('leadFreeGlazeConfirmed', v)}
            />
            <p className="pc-piece__hint">{adminText('pieceSmallPartsHint')}</p>
          </>
        ) : null}

        {category === 'zeichnung' ? (
          <>
            <Check
              id="pf-framed"
              label={adminText('pieceField_framed')}
              checked={form.framed}
              disabled={busy}
              onChange={(v) => set('framed', v)}
            />
            {form.framed ? (
              <Check
                id="pf-frameHasGlass"
                label={adminText('pieceField_frameHasGlass')}
                hint={adminText('pieceGlassHint')}
                checked={form.frameHasGlass}
                disabled={busy}
                onChange={(v) => set('frameHasGlass', v)}
              />
            ) : null}
          </>
        ) : null}

        <TextField
          id="pf-safetyWarnings"
          label={adminText('pieceField_safetyWarnings')}
          required
          multiline
          rows={3}
          value={form.de.safetyWarnings}
          max={600}
          hint={adminText('pieceSafetyHint')}
          disabled={busy}
          onChange={(v) => setDe('safetyWarnings', v)}
        />

        <SelectField
          id="pf-deviationDecision"
          label={adminText('pieceField_deviationDecision')}
          required={textile}
          value={form.deviationDecision}
          disabled={busy}
          options={DEVIATION_DECISIONS.map((d) => ({
            value: d,
            label: ENUM_LABELS.DEVIATION_DECISIONS[d].de,
          }))}
          hint={adminText('pieceDeviationHint')}
          onChange={(v) => {
            set('deviationDecision', v as PieceForm['deviationDecision'])
            set('hasDeviation', v === 'described')
          }}
        />
        {form.deviationDecision === 'described' ? (
          <TextField
            id="pf-deviationDescription"
            label={adminText('pieceField_deviationDescription')}
            required
            multiline
            rows={2}
            value={form.de.deviationDescription}
            max={300}
            disabled={busy}
            onChange={(v) => setDe('deviationDescription', v)}
          />
        ) : null}

        <Check
          id="pf-ownDesignConfirmed"
          label={adminText('pieceField_ownDesignConfirmed')}
          required
          checked={form.ownDesignConfirmed}
          disabled={busy}
          onChange={(v) => set('ownDesignConfirmed', v)}
        />
      </Section>

      <Section title={adminText('pieceSectionEnglish')}>
        <p className="pc-piece__hint">{adminText('pieceEnglishHint')}</p>
        <TranslateButton
          endpoint={id ? `/api/products/${id}/translate` : null}
          hasEnglish={hasEnglish}
          disabledReason={translation.enabled ? null : (translation.reason ?? null)}
          prepare={prepareTranslate}
          onTranslated={applyTranslation}
          disabled={busy || uploading}
        />
        <details className="pc-piece__details">
          <summary>{adminText('pieceEnglishFields')}</summary>
          {textFieldsFor(category).map((f) => (
            <TextField
              key={f}
              id={`pf-en-${f}`}
              label={`${adminText(f === 'dimensionsNote' ? 'pieceField_dimensionsNote' : (`pieceField_${f}` as AdminCustomKey))} (EN)`}
              lang="en"
              multiline={[
                'description',
                'juttaSays',
                'safetyWarnings',
                'careInstructions',
                'conditionNote',
                'deviationDescription',
              ].includes(f)}
              rows={3}
              value={form.en[f]}
              disabled={busy}
              onChange={(v) => setEn(f, v)}
            />
          ))}
        </details>
      </Section>

      <Section title={adminText('pieceSectionMore')}>
        <Check
          id="pf-showInArchiveAfterSale"
          label={adminText('pieceField_showInArchiveAfterSale')}
          checked={form.showInArchiveAfterSale}
          disabled={busy}
          onChange={(v) => set('showInArchiveAfterSale', v)}
        />
        <SelectField
          id="pf-vatCategory"
          label={adminText('pieceField_vatCategory')}
          value={form.vatCategory}
          disabled={busy}
          options={(category === 'zeichnung'
            ? (['standard', 'reduced_art'] as const)
            : (['standard'] as const)
          ).map((v) => ({
            value: v,
            label: ENUM_LABELS.VAT_CATEGORIES[v].de,
          }))}
          hint={adminText('pieceVatHint')}
          onChange={(v) => set('vatCategory', v as PieceForm['vatCategory'])}
        />
        {form.vatCategory === 'reduced_art' ? (
          <TextField
            id="pf-vatReducedReason"
            label={adminText('pieceField_vatReducedReason')}
            value={form.vatReducedReason}
            disabled={busy}
            onChange={(v) => set('vatReducedReason', v)}
          />
        ) : null}
        <TextField
          id="pf-storageLocation"
          label={adminText('pieceField_storageLocation')}
          value={form.storageLocation}
          max={60}
          disabled={busy}
          onChange={(v) => set('storageLocation', v)}
        />
        <TextField
          id="pf-internalNote"
          label={adminText('pieceField_internalNote')}
          multiline
          rows={2}
          value={form.internalNote}
          max={1000}
          disabled={busy}
          onChange={(v) => set('internalNote', v)}
        />
      </Section>

      <div ref={resultRef} tabIndex={-1} className="pc-piece__result" data-testid="piece-result">
        {result?.kind === 'saved' ? (
          <Notice tone="success">{adminText('pieceSaved')}</Notice>
        ) : result?.kind === 'error' ? (
          <Notice tone="error">{result.text}</Notice>
        ) : result?.kind === 'issues' ? (
          <div
            role="alert"
            className="pc-admin-notice pc-admin-notice--error"
            data-testid="piece-issues"
          >
            <p className="pc-admin-notice__text">
              <strong>{result.heading}</strong>
            </p>
            <ul className="pc-piece__issues">
              {result.issues.map((issue, i) => {
                const anchor = fieldAnchor(issue.field)
                const label = fieldLabel(issue.field)
                const text =
                  label && !issue.message.includes(label)
                    ? `${label}: ${issue.message}`
                    : issue.message
                return (
                  <li key={i}>
                    {anchor ? (
                      <a
                        href={`#${anchor}`}
                        className="pc-admin-link"
                        onClick={(e) => jump(e, anchor)}
                      >
                        {text}
                      </a>
                    ) : (
                      text
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="pc-piece__actions">
        <button
          type="submit"
          className="pc-admin-btn pc-admin-btn--secondary"
          disabled={busy || uploading}
          aria-busy={phase === 'saving' || undefined}
          data-testid="piece-save"
        >
          {phase === 'saving'
            ? adminText('actionBusy')
            : status && status !== 'draft'
              ? adminText('pieceSave')
              : adminText('pieceSaveDraft')}
        </button>
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--secondary"
          disabled={busy || uploading}
          onClick={() => void preview()}
          data-testid="piece-preview"
        >
          {adminText('piecePreview')}
        </button>
        {!status || status === 'draft' ? (
          <button
            type="button"
            className="pc-admin-btn pc-admin-btn--primary"
            disabled={busy || uploading}
            aria-busy={phase === 'publishing' || undefined}
            onClick={() => void publish()}
            data-testid="piece-publish"
          >
            {phase === 'publishing' ? adminText('actionBusy') : adminText('piecePublish')}
          </button>
        ) : null}
      </div>
    </form>
  )
}

// --- Bausteine -------------------------------------------------------------------------------------------------

function Required() {
  return (
    <span className="pc-field__required" aria-hidden="true">
      *
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const hid = useId()
  return (
    <section className="pc-piece__section" aria-labelledby={hid}>
      <h2 id={hid} className="pc-piece__heading">
        {title}
      </h2>
      {children}
    </section>
  )
}

interface ControlProps {
  id: string
  'aria-describedby'?: string
  'aria-required'?: boolean
}

function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
  children: (props: ControlProps) => React.ReactNode
}) {
  const hintId = `${id}-hint`
  return (
    <div className="pc-field">
      <label htmlFor={id} className="pc-field__label">
        {label} {required ? <Required /> : null}
      </label>
      {children({
        id,
        'aria-describedby': hint ? hintId : undefined,
        'aria-required': required || undefined,
      })}
      {hint ? (
        <p id={hintId} className="pc-piece__hint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  required,
  multiline,
  rows = 3,
  max,
  hint,
  disabled,
  readOnly,
  inputMode,
  suffix,
  lang,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  multiline?: boolean
  rows?: number
  max?: number
  hint?: string
  disabled?: boolean
  readOnly?: boolean
  inputMode?: 'decimal' | 'numeric'
  suffix?: string
  lang?: string
}) {
  return (
    <Field id={id} label={label} required={required} hint={hint}>
      {(props) =>
        multiline ? (
          <textarea
            {...props}
            rows={rows}
            maxLength={max}
            value={value}
            disabled={disabled}
            readOnly={readOnly}
            lang={lang}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <span className="pc-field__wrap">
            <input
              {...props}
              type="text"
              inputMode={inputMode}
              autoComplete="off"
              maxLength={max}
              value={value}
              disabled={disabled}
              readOnly={readOnly}
              lang={lang}
              onChange={(e) => onChange(e.target.value)}
            />
            {suffix ? <span aria-hidden="true">{suffix}</span> : null}
          </span>
        )
      }
    </Field>
  )
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  required,
  hint,
  disabled,
}: {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  required?: boolean
  hint?: string
  disabled?: boolean
}) {
  return (
    <Field id={id} label={label} required={required} hint={hint}>
      {(props) => (
        <select
          {...props}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{adminText('pieceChoose')}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

function Check({
  id,
  label,
  checked,
  onChange,
  required,
  hint,
  disabled,
}: {
  id?: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  required?: boolean
  hint?: string
  disabled?: boolean
}) {
  const auto = useId()
  const cid = id ?? auto
  return (
    <div className="pc-field pc-field--check">
      <label className="pc-choice" htmlFor={cid}>
        <input
          id={cid}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={hint ? `${cid}-hint` : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          {label} {required ? <Required /> : null}
        </span>
      </label>
      {hint ? (
        <p id={`${cid}-hint`} className="pc-piece__hint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
