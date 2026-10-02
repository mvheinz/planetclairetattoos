'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { Notice } from '../../components/Notice'
import {
  isAcceptedPhotoType,
  isUploadTooLarge,
  preparePhoto,
} from '../../components/PhotoPicker/resize'
import { adminText } from '../../translations'

// Knöpfe im Widerrufs-Detail `/widerrufe/:id` (PLAN P6.9, KONZEPT §7.10, R-094): „Bestellung zuordnen“ (W2, Suche nach
// Nummer, E-Mail, Name), „Ware ist zurück“ (W3/O12 mit Zustandsnotiz und optional Fotos `return_photo`),
// „Rücksendenachweis liegt vor“, „Ohne Erstattung abschließen“ (W5, Grund Pflicht), „Ablehnen“ (W7, nur manuell,
// Begründung Pflicht), „Als Test/Spam markieren“ und je Stück „wieder verkaufen“ (P11) bzw. „ausblenden“ (P13). Jede
// Aktion mit Bestätigungsdialog; danach lädt die Ansicht neu. Der Server prüft alles noch einmal.

export interface WithdrawalActionItem {
  productId: number | null
  nr: string
  status: string
}

export interface WithdrawalActionsProps {
  id: number
  reference: string
  status: string
  orderId: number | null
  returnProofReceivedAt: string | null
  items: WithdrawalActionItem[]
  closeReasons: { value: string; label: string }[]
  /** Platz für den Erstatten-Dialog (P6.10). */
  refund?: React.ReactNode
}

interface OrderHit {
  id: number
  orderNumber: string
  name: string
  email: string
  status: string
}

async function uploadReturnPhoto(file: File, orderId: number): Promise<number> {
  const body = new FormData()
  body.append('file', file)
  body.append('_payload', JSON.stringify({ purpose: 'return_photo', relatedOrder: orderId }))
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
    errors?: { message?: string }[]
  }
  if (!res.ok || !json.doc) throw new Error(json.errors?.[0]?.message ?? res.statusText)
  return json.doc.id
}

function MatchOrder({ id, reference }: { id: number; reference: string }) {
  const router = useRouter()
  const fieldId = useId()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<OrderHit[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    setError(null)
    try {
      const res = await fetch(`/api/withdrawals/order-search?q=${encodeURIComponent(query)}`, {
        credentials: 'include',
      })
      const json = (await res.json()) as { orders?: OrderHit[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? res.statusText)
      setHits(json.orders ?? [])
    } catch (err) {
      setError(adminText('actionFailed', { message: (err as Error).message }))
    }
  }

  return (
    <section
      className="pc-order__section"
      aria-labelledby={`${fieldId}-h`}
      data-testid="withdrawal-match"
    >
      <h3 id={`${fieldId}-h`}>{adminText('withdrawalMatchTitle')}</h3>
      <form
        className="pc-admin-row"
        onSubmit={(e) => {
          e.preventDefault()
          void search()
        }}
      >
        <label htmlFor={fieldId} className="pc-field__label">
          {adminText('withdrawalMatchSearch')}
        </label>
        <input
          id={fieldId}
          type="search"
          value={query}
          minLength={2}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="withdrawal-match-query"
        />
        <button type="submit" className="pc-admin-btn pc-admin-btn--secondary">
          {adminText('withdrawalMatchSearchButton')}
        </button>
      </form>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {hits && hits.length === 0 ? <p>{adminText('withdrawalMatchNone')}</p> : null}
      {hits && hits.length > 0 ? (
        <ul className="pc-order__items" data-testid="withdrawal-match-hits">
          {hits.map((h) => (
            <li key={h.id} className="pc-order__item">
              <span className="pc-order__nr">{h.orderNumber}</span> {h.name} · {h.email}{' '}
              <ActionButton
                variant="secondary"
                data-testid={`withdrawal-match-${h.id}`}
                confirm={{
                  title: adminText('withdrawalMatchConfirm', {
                    ref: reference,
                    order: h.orderNumber,
                  }),
                  consequence: adminText('withdrawalMatchConsequence'),
                }}
                action={() => postAdminAction(`/api/withdrawals/${id}/match`, { orderId: h.id })}
                onDone={() => router.refresh()}
              >
                {adminText('withdrawalMatchButton')}
              </ActionButton>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function GoodsReturned({
  id,
  reference,
  orderId,
}: {
  id: number
  reference: string
  orderId: number | null
}) {
  const router = useRouter()
  const noteId = useId()
  const photoId = useId()
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const upload = async (files: FileList | null) => {
    if (!files || orderId === null) return
    setBusy(true)
    setError(null)
    try {
      const ids = [...photos]
      for (const file of [...files].slice(0, 6 - ids.length)) {
        if (!isAcceptedPhotoType(file.type)) throw new Error(adminText('photoWrongType'))
        const prepared = await preparePhoto(file).catch(() => ({ file }))
        if (isUploadTooLarge(prepared.file.size)) throw new Error(adminText('photoTooLarge'))
        ids.push(await uploadReturnPhoto(prepared.file, orderId))
      }
      setPhotos(ids)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <section
      className="pc-order__section"
      aria-labelledby={`${noteId}-h`}
      data-testid="withdrawal-goods"
    >
      <h3 id={`${noteId}-h`}>{adminText('withdrawalGoodsTitle')}</h3>
      <div className="pc-field">
        <label htmlFor={noteId} className="pc-field__label">
          {adminText('withdrawalGoodsNote')}
        </label>
        <textarea
          id={noteId}
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          data-testid="withdrawal-goods-note"
        />
      </div>
      {orderId !== null ? (
        <div className="pc-field">
          <label htmlFor={photoId} className="pc-field__label">
            {adminText('withdrawalGoodsPhotos')}
          </label>
          <input
            ref={input}
            id={photoId}
            type="file"
            accept="image/*"
            multiple
            disabled={busy || photos.length >= 6}
            onChange={(e) => void upload(e.target.files)}
          />
          {photos.length > 0 ? (
            <p className="pc-order__muted">
              {adminText('withdrawalGoodsPhotosCount', { count: photos.length })}
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <p className="pc-admin-row">
        <ActionButton
          data-testid="withdrawal-goods-returned"
          disabled={busy}
          confirm={{
            title: adminText('withdrawalGoodsConfirm', { ref: reference }),
            consequence: adminText('withdrawalGoodsConsequence'),
          }}
          action={() =>
            postAdminAction(`/api/withdrawals/${id}/goods-returned`, { note, photoIds: photos })
          }
          onDone={() => router.refresh()}
        >
          {adminText('withdrawalGoodsButton')}
        </ActionButton>
      </p>
    </section>
  )
}

function NoteAction(props: {
  testId: string
  title: string
  label: string
  button: string
  confirmTitle: string
  consequence: string
  url: string
  field: string
  danger?: boolean
  select?: { label: string; options: { value: string; label: string }[]; field: string }
}) {
  const router = useRouter()
  const noteId = useId()
  const selectId = useId()
  const [note, setNote] = useState('')
  const [choice, setChoice] = useState('')
  return (
    <section
      className="pc-order__section"
      aria-labelledby={`${noteId}-h`}
      data-testid={props.testId}
    >
      <h3 id={`${noteId}-h`}>{props.title}</h3>
      {props.select ? (
        <div className="pc-field">
          <label htmlFor={selectId} className="pc-field__label">
            {props.select.label}
          </label>
          <select
            id={selectId}
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            data-testid={`${props.testId}-reason`}
          >
            <option value="">{adminText('withdrawalCloseReasonPick')}</option>
            {props.select.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="pc-field">
        <label htmlFor={noteId} className="pc-field__label">
          {props.label}
        </label>
        <input
          id={noteId}
          type="text"
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          data-testid={`${props.testId}-note`}
        />
      </div>
      <p className="pc-admin-row">
        <ActionButton
          variant={props.danger ? 'danger' : 'secondary'}
          data-testid={`${props.testId}-button`}
          disabled={props.select ? choice === '' : note.trim().length < 10}
          confirm={{ title: props.confirmTitle, consequence: props.consequence }}
          action={() =>
            postAdminAction(props.url, {
              [props.field]: note,
              ...(props.select ? { [props.select.field]: choice } : {}),
            })
          }
          onDone={() => router.refresh()}
        >
          {props.button}
        </ActionButton>
      </p>
    </section>
  )
}

export function WithdrawalActions(props: WithdrawalActionsProps) {
  const router = useRouter()
  const { id, reference, status } = props
  const open = ['received', 'goods_returned', 'partially_refunded'].includes(status)
  const pieces = props.items.filter(
    (i) => i.productId !== null && (i.status === 'returned' || i.status === 'refunded'),
  )
  if (!open && pieces.length === 0) {
    return <Notice tone="info">{adminText('withdrawalActionsNone')}</Notice>
  }
  return (
    <div data-testid="withdrawal-actions">
      {status === 'received' && props.orderId === null ? (
        <MatchOrder id={id} reference={reference} />
      ) : null}
      {status === 'received' ? (
        <GoodsReturned id={id} reference={reference} orderId={props.orderId} />
      ) : null}
      {(status === 'received' || status === 'goods_returned') && !props.returnProofReceivedAt ? (
        <p className="pc-admin-row">
          <ActionButton
            variant="secondary"
            data-testid="withdrawal-return-proof"
            confirm={{
              title: adminText('withdrawalProofConfirm', { ref: reference }),
              consequence: adminText('withdrawalProofConsequence'),
            }}
            action={() => postAdminAction(`/api/withdrawals/${id}/return-proof`)}
            onDone={() => router.refresh()}
          >
            {adminText('withdrawalProofButton')}
          </ActionButton>
        </p>
      ) : null}
      {props.refund}
      {open ? (
        <NoteAction
          testId="withdrawal-close"
          title={adminText('withdrawalCloseTitle')}
          label={adminText('withdrawalCloseNote')}
          button={adminText('withdrawalCloseButton')}
          confirmTitle={adminText('withdrawalCloseConfirm', { ref: reference })}
          consequence={adminText('withdrawalCloseConsequence')}
          url={`/api/withdrawals/${id}/close`}
          field="closeNote"
          select={{
            label: adminText('withdrawalCloseReason'),
            options: props.closeReasons,
            field: 'closeReason',
          }}
        />
      ) : null}
      {status === 'received' ? (
        <>
          <NoteAction
            testId="withdrawal-reject"
            title={adminText('withdrawalRejectTitle')}
            label={adminText('withdrawalRejectNote')}
            button={adminText('withdrawalRejectButton')}
            confirmTitle={adminText('withdrawalRejectConfirm', { ref: reference })}
            consequence={adminText('withdrawalRejectConsequence')}
            url={`/api/withdrawals/${id}/reject`}
            field="closeNote"
            danger
          />
          <NoteAction
            testId="withdrawal-spam"
            title={adminText('withdrawalSpamTitle')}
            label={adminText('withdrawalSpamNote')}
            button={adminText('withdrawalSpamButton')}
            confirmTitle={adminText('withdrawalSpamConfirm', { ref: reference })}
            consequence={adminText('withdrawalSpamConsequence')}
            url={`/api/withdrawals/${id}/spam`}
            field="reason"
            danger
          />
        </>
      ) : null}
      {pieces.length > 0 ? (
        <ul className="pc-order__items" data-testid="withdrawal-pieces">
          {pieces.map((p) => (
            <li key={p.productId} className="pc-order__item">
              <span className="pc-order__nr">{p.nr}</span>{' '}
              <ActionButton
                variant="secondary"
                effects={['stock']}
                confirm={{
                  title: adminText('withdrawalPieceResellConfirm', { nr: p.nr }),
                  consequence: adminText('withdrawalPieceResellConsequence'),
                }}
                action={() => postAdminAction(`/api/products/${p.productId}/return-to-stock`)}
                onDone={() => router.refresh()}
              >
                {adminText('withdrawalPieceResell')}
              </ActionButton>{' '}
              <ActionButton
                variant="secondary"
                effects={['stock']}
                confirm={{
                  title: adminText('withdrawalPieceHideConfirm', { nr: p.nr }),
                  consequence: adminText('withdrawalPieceHideConsequence'),
                }}
                action={() => postAdminAction(`/api/products/${p.productId}/archive-after-return`)}
                onDone={() => router.refresh()}
              >
                {adminText('withdrawalPieceHide')}
              </ActionButton>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
