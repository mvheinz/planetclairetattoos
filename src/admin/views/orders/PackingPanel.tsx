'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState, useSyncExternalStore } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { AdminActionError, postAdminAction } from '../../components/adminAction'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Notice } from '../../components/Notice'
import { TrackingScanner } from '../../components/TrackingScanner'
import {
  isAcceptedPhotoType,
  isUploadTooLarge,
  PHOTO_ACCEPT,
  preparePhoto,
} from '../../components/PhotoPicker/resize'
import { adminText } from '../../translations'

// Packen an der Bestellung (PLAN P5.10/P5.11, KONZEPT §7.6): Verpackungs-Checkliste (Häkchen werden sofort
// gespeichert), Verpackungsmengen (Vorlage, Material, Gramm – vorbelegt mit der Standard-Vorlage der Versandklasse),
// Packfotos über die Kamera (privat, 0–4), „Gepackt“ (O6) und „Versendet melden“ (O7; bei Keramik ohne Packfoto die
// Rückfrage „Ohne Packfoto versenden?“, R-100). Nach jeder Aktion wird die Ansicht neu geladen.

export interface PackagingComponentView {
  material: string
  grams: number
}

export interface PackingPanelProps {
  orderId: number
  orderNumber: string
  status: string
  canPack: boolean
  canShip: boolean
  ceramic: boolean
  checklist: { key: string; text: string; done: boolean }[]
  packaging: {
    templateKey: string | null
    components: PackagingComponentView[]
    recorded: boolean
    recordedAt: string | null
  }
  templates: { key: string; name: string; components: PackagingComponentView[] }[]
  materials: { value: string; label: string }[]
  photos: { id: number; thumbUrl: string | null }[]
  photosMax: number
  carriers: { value: string; label: string }[]
  defaultCarrier: string
  trackingNumber: string | null
}

type Feedback = { tone: 'success' | 'error' | 'info'; text: string } | null

async function uploadPackingPhoto(file: File, orderId: number): Promise<number> {
  const body = new FormData()
  body.append('file', file)
  body.append('_payload', JSON.stringify({ purpose: 'packing_photo', relatedOrder: orderId }))
  let res: Response
  try {
    res = await fetch('/api/private-uploads?depth=0', {
      method: 'POST',
      credentials: 'include',
      body,
    })
  } catch {
    throw new Error(adminText('actionOffline'))
  }
  const json = (await res.json().catch(() => ({}))) as {
    doc?: { id: number }
    errors?: { message?: string; data?: { errors?: { message?: string }[] } }[]
  }
  if (!res.ok || !json.doc) {
    const first = json.errors?.[0]
    throw new Error(first?.data?.errors?.[0]?.message ?? first?.message ?? res.statusText)
  }
  return json.doc.id
}

function Checklist({
  orderId,
  items,
  disabled,
}: {
  orderId: number
  items: PackingPanelProps['checklist']
  disabled: boolean
}) {
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.key, i.done])),
  )
  const [feedback, setFeedback] = useState<Feedback>(null)
  const headingId = useId()
  const toggle = async (key: string, done: boolean) => {
    const next = { ...state, [key]: done }
    setState(next)
    try {
      await postAdminAction(`/api/orders/${orderId}/packing`, { checklist: next })
      setFeedback({ tone: 'success', text: adminText('packingChecklistSaved') })
    } catch (err) {
      setFeedback({ tone: 'error', text: (err as Error).message })
    }
  }
  return (
    <section className="pc-order__section" aria-labelledby={headingId}>
      <h3 id={headingId}>{adminText('packingChecklist')}</h3>
      <ul className="pc-order__checklist" data-testid="packing-checklist">
        {items.map((item) => (
          <li key={item.key}>
            <label className="pc-choice">
              <input
                type="checkbox"
                checked={state[item.key] === true}
                disabled={disabled}
                onChange={(e) => void toggle(item.key, e.target.checked)}
              />
              <span>{item.text}</span>
            </label>
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite" className="pc-order__muted">
        {feedback?.tone === 'success' ? feedback.text : ''}
      </p>
      {feedback?.tone === 'error' ? <Notice tone="error">{feedback.text}</Notice> : null}
    </section>
  )
}

function PackagingEditor({
  orderId,
  props,
  value,
  setValue,
}: {
  orderId: number
  props: PackingPanelProps
  value: { templateKey: string; components: PackagingComponentView[] }
  setValue: (v: { templateKey: string; components: PackagingComponentView[] }) => void
}) {
  const router = useRouter()
  const headingId = useId()
  const templateId = useId()
  const editable = props.canShip
  const setComponent = (i: number, patch: Partial<PackagingComponentView>) =>
    setValue({
      ...value,
      components: value.components.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    })
  return (
    <section className="pc-order__section" aria-labelledby={headingId} data-testid="packaging">
      <h3 id={headingId}>{adminText('packingPackaging')}</h3>
      <p className="pc-order__muted">{adminText('packingPackagingHint')}</p>
      <p className="pc-order__muted" data-testid="packaging-state">
        {props.packaging.recorded && props.packaging.recordedAt
          ? adminText('packingPackagingRecorded', { date: props.packaging.recordedAt })
          : adminText('packingPackagingNotRecorded')}
      </p>
      <div className="pc-field">
        <label htmlFor={templateId} className="pc-field__label">
          {adminText('packingTemplate')}
        </label>
        <select
          id={templateId}
          value={value.templateKey}
          disabled={!editable}
          onChange={(e) => {
            const t = props.templates.find((x) => x.key === e.target.value)
            setValue({ templateKey: e.target.value, components: t ? [...t.components] : [] })
          }}
        >
          {props.templates.map((t) => (
            <option key={t.key} value={t.key}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <ol className="pc-order__components">
        {value.components.map((c, i) => (
          <li key={i} className="pc-order__component">
            <div className="pc-field">
              <label htmlFor={`${templateId}-m${i}`} className="pc-field__label">
                {adminText('packingMaterial')}
              </label>
              <select
                id={`${templateId}-m${i}`}
                value={c.material}
                disabled={!editable}
                onChange={(e) => setComponent(i, { material: e.target.value })}
              >
                {props.materials.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="pc-field">
              <label htmlFor={`${templateId}-g${i}`} className="pc-field__label">
                {adminText('packingGrams')}
              </label>
              <input
                id={`${templateId}-g${i}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(c.grams)}
                disabled={!editable}
                onChange={(e) =>
                  setComponent(i, { grams: Number(e.target.value.replace(/\D/g, '')) || 0 })
                }
              />
            </div>
            {editable && value.components.length > 1 ? (
              <button
                type="button"
                className="pc-admin-btn pc-admin-btn--secondary"
                onClick={() =>
                  setValue({ ...value, components: value.components.filter((_, j) => j !== i) })
                }
              >
                {adminText('packingRemoveComponent', { n: i + 1 })}
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      {editable ? (
        <div className="pc-admin-row">
          <button
            type="button"
            className="pc-admin-btn pc-admin-btn--secondary"
            onClick={() =>
              setValue({
                ...value,
                components: [...value.components, { material: 'paper_cardboard', grams: 10 }],
              })
            }
          >
            {adminText('packingAddComponent')}
          </button>
          <ActionButton
            variant="secondary"
            data-testid="packaging-save"
            action={() => postAdminAction(`/api/orders/${orderId}/packing`, { packaging: value })}
            onDone={() => router.refresh()}
          >
            {adminText('packingSavePackaging')}
          </ActionButton>
        </div>
      ) : null}
    </section>
  )
}

function Photos({ props }: { props: PackingPanelProps }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const headingId = useId()
  const ids = props.photos.map((p) => p.id)
  const full = ids.length >= props.photosMax
  const save = (next: number[]) =>
    postAdminAction(`/api/orders/${props.orderId}/packing`, { packingPhotos: next })

  const add = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setFeedback({ tone: 'info', text: adminText('packingPhotoUploading') })
    setBusy(true)
    try {
      if (!isAcceptedPhotoType(file.type)) throw new Error(adminText('photoWrongType'))
      const prepared = await preparePhoto(file).catch(() => ({ file }))
      if (isUploadTooLarge(prepared.file.size)) throw new Error(adminText('photoTooLarge'))
      const id = await uploadPackingPhoto(prepared.file, props.orderId)
      await save([...ids, id])
      setFeedback(null)
      router.refresh()
    } catch (err) {
      setFeedback({ tone: 'error', text: (err as Error).message })
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <section className="pc-order__section" aria-labelledby={headingId} data-testid="packing-photos">
      <h3 id={headingId}>{adminText('packingPhotos')}</h3>
      <p className="pc-order__muted">{adminText('packingPhotosHint', { max: props.photosMax })}</p>
      {props.photos.length > 0 ? (
        <ul className="pc-order__photos">
          {props.photos.map((p, i) => (
            <li key={p.id} className="pc-order__photo">
              {p.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- privates Packfoto aus der eigenen API
                <img
                  src={p.thumbUrl}
                  alt={adminText('packingPhotoAlt', { n: i + 1 })}
                  width={96}
                  height={96}
                />
              ) : null}
              {props.canShip ? (
                <ActionButton
                  variant="secondary"
                  action={() => save(ids.filter((x) => x !== p.id))}
                  onDone={() => router.refresh()}
                >
                  {adminText('packingPhotoRemove', { n: i + 1 })}
                </ActionButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {props.canShip ? (
        full ? (
          <p className="pc-order__muted">
            {adminText('packingPhotoMax', { max: props.photosMax })}
          </p>
        ) : (
          <>
            <input
              ref={input}
              type="file"
              accept={PHOTO_ACCEPT}
              capture="environment"
              className="pc-order__file"
              data-testid="packing-photo-input"
              aria-label={adminText('packingPhotoTake')}
              onChange={(e) => void add(e.target.files)}
              disabled={busy}
            />
            <button
              type="button"
              className="pc-admin-btn pc-admin-btn--secondary"
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={() => input.current?.click()}
            >
              {busy ? adminText('packingPhotoUploading') : adminText('packingPhotoTake')}
            </button>
          </>
        )
      ) : null}
      {feedback ? (
        <Notice tone={feedback.tone === 'info' ? 'info' : feedback.tone}>{feedback.text}</Notice>
      ) : null}
    </section>
  )
}

function ShipForm({
  props,
  packaging,
}: {
  props: PackingPanelProps
  packaging: { templateKey: string; components: PackagingComponentView[] }
}) {
  const router = useRouter()
  const [carrier, setCarrier] = useState(props.defaultCarrier)
  const [tracking, setTracking] = useState(props.trackingNumber ?? '')
  const [open, setOpen] = useState<'ship' | 'photo' | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const running = useRef(false)
  const carrierId = useId()
  const trackingId = useId()
  const hintId = useId()
  const noPhoto = props.ceramic && props.photos.length === 0

  const run = async (confirmWithoutPackingPhoto: boolean) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setFeedback(null)
    try {
      const res = await postAdminAction(`/api/orders/${props.orderId}/ship`, {
        carrier,
        trackingNumber: tracking,
        confirmWithoutPackingPhoto,
        ...(props.packaging.recorded ? {} : { packaging }),
      })
      setOpen(null)
      setFeedback({
        tone: 'success',
        text: adminText(res.unchanged ? 'actionUnchanged' : 'actionDone'),
      })
      router.refresh()
    } catch (err) {
      if (err instanceof AdminActionError && err.code === 'packing_photo_missing') {
        setOpen('photo')
      } else {
        setFeedback({ tone: 'error', text: (err as Error).message })
      }
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <section className="pc-order__section" data-testid="ship-form">
      <h3>{adminText('packingShip')}</h3>
      <div className="pc-field">
        <label htmlFor={carrierId} className="pc-field__label">
          {adminText('packingCarrier')}
        </label>
        <select id={carrierId} value={carrier} onChange={(e) => setCarrier(e.target.value)}>
          {props.carriers.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="pc-field">
        <label htmlFor={trackingId} className="pc-field__label">
          {adminText('packingTracking')}
        </label>
        <input
          id={trackingId}
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={tracking}
          aria-describedby={hintId}
          onChange={(e) => setTracking(e.target.value)}
        />
        <p id={hintId} className="pc-order__muted">
          {adminText('packingTrackingHint')}
        </p>
        <TrackingScanner disabled={busy} onDetected={setTracking} />
      </div>
      <p className="pc-admin-row">
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--primary"
          data-testid="ship-order"
          disabled={busy}
          onClick={() => setOpen(noPhoto ? 'photo' : 'ship')}
        >
          {adminText('packingShip')}
        </button>
      </p>
      <ConfirmDialog
        open={open === 'ship'}
        title={adminText('packingShipTitle', { order: props.orderNumber })}
        consequence={adminText(
          tracking.trim() ? 'packingShipConsequence' : 'packingShipConsequenceNoTracking',
        )}
        busy={busy}
        onConfirm={() => void run(false)}
        onCancel={() => setOpen(null)}
      >
        {feedback?.tone === 'error' ? <Notice tone="error">{feedback.text}</Notice> : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={open === 'photo'}
        title={adminText('packingNoPhotoTitle')}
        consequence={adminText('packingNoPhotoConsequence')}
        confirmLabel={adminText('packingNoPhotoConfirm')}
        busy={busy}
        onConfirm={() => void run(true)}
        onCancel={() => setOpen(null)}
      >
        {feedback?.tone === 'error' ? <Notice tone="error">{feedback.text}</Notice> : null}
      </ConfirmDialog>
      {feedback && open === null ? (
        <Notice tone={feedback.tone === 'error' ? 'error' : 'success'}>{feedback.text}</Notice>
      ) : null}
    </section>
  )
}

const noopSubscribe = () => () => undefined

export function PackingPanel(props: PackingPanelProps) {
  const router = useRouter()
  const [packaging, setPackaging] = useState({
    templateKey: props.packaging.templateKey ?? props.templates[0]?.key ?? '',
    components: props.packaging.components,
  })
  // Erst nach dem Binden nimmt das Panel Eingaben an (vorher Getipptes verwirft React beim Hydrieren) – Marker für Tests.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  return (
    <div
      className="pc-order__packing"
      data-testid="packing-panel"
      data-hydrated={hydrated ? 'true' : undefined}
    >
      <Checklist orderId={props.orderId} items={props.checklist} disabled={!props.canShip} />
      <PackagingEditor
        orderId={props.orderId}
        props={props}
        value={packaging}
        setValue={setPackaging}
      />
      <Photos props={props} />
      {props.canPack ? (
        <p className="pc-admin-row">
          <ActionButton
            data-testid="mark-packed"
            action={() => postAdminAction(`/api/orders/${props.orderId}/packed`, { packaging })}
            onDone={() => router.refresh()}
          >
            {adminText('packingPacked')}
          </ActionButton>
        </p>
      ) : null}
      {props.canShip ? <ShipForm props={props} packaging={packaging} /> : null}
    </div>
  )
}
