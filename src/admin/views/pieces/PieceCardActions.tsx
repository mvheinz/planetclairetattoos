'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { AdminActionError, postAdminAction } from '../../components/adminAction'
import { ChoiceDialog } from '../../components/ChoiceDialog'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { CopyButton } from '../../components/CopyButton'
import { Notice } from '../../components/Notice'
import { adminText } from '../../translations'
import type { ProductStatus } from '@/lib/enums'
import { formatEuroInput, PRICE_CENTS_RANGE, parseEuroInput } from '@/lib/money'

import type { PieceAction } from './piecesQuery'

// Knöpfe einer Karte in „Meine Stücke“ (PLAN P5.8, KONZEPT §7.5) auf die Endpunkte aus P5.7. Aktionen mit Wirkung auf
// den Bestand (Verkauft (Markt/privat), Aus dem Shop nehmen, Weglegen, Löschen, Wieder verkaufen) fragen vorher nach und
// nennen die Folge. V-34 (P20.6): „Aus dem Shop nehmen“ fragt „Kommt es wieder?“ – Ja = zurück zum Entwurf (P3), Nein =
// weglegen (P12, „ausgeblendet“). V-33 a: erzielten Markt-Preis nachtragen. Nach jeder Aktion wird die Liste neu geladen.

export interface PieceCardActionsProps {
  id: number
  /** „Nr. 017“ */
  nr: string
  status: ProductStatus
  actions: PieceAction[]
  adminRoute: string
  publicUrl: string
  orderId: number | null
  showInArchive: boolean
  /** U-60: Markt-Termine für „Verkauft (Markt/privat)“ (neueste zuerst). */
  tourOptions?: { id: number; label: string }[]
  /** V-33 a: erzielter Preis eines Markt-Verkaufs (Cent) – nachtragen oder ändern. */
  offlinePriceCents?: number | null
}

async function send(url: string, method: 'PATCH' | 'DELETE', body?: unknown) {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new AdminActionError(adminText('actionOffline'), 0)
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as {
      errors?: { message?: string; data?: { errors?: { message?: string }[] } }[]
    }
    const first = json.errors?.[0]
    throw new AdminActionError(
      adminText('actionFailed', {
        message: first?.data?.errors?.[0]?.message ?? first?.message ?? String(res.status),
      }),
      res.status,
    )
  }
}

function SellOfflineButton({
  id,
  nr,
  reserved,
  tourOptions,
  onDone,
}: {
  id: number
  nr: string
  reserved: boolean
  tourOptions: { id: number; label: string }[]
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [archive, setArchive] = useState(true)
  const [note, setNote] = useState('')
  const [tourDate, setTourDate] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const running = useRef(false)
  const noteId = useId()
  const switchId = useId()
  const tourId = useId()
  const priceId = useId()

  const run = async () => {
    if (running.current) return
    const priceCents = price.trim()
      ? parseEuroInput(price, { min: 0, max: PRICE_CENTS_RANGE.max })
      : null
    if (price.trim() && priceCents === null) {
      setError(adminText('piecesOfflinePriceInvalid'))
      return
    }
    running.current = true
    setBusy(true)
    setError(null)
    try {
      await postAdminAction(`/api/products/${id}/sell-offline`, {
        showInArchive: archive,
        note: note.trim() || undefined,
        ...(tourDate ? { tourDate: Number(tourDate) } : {}),
        ...(priceCents !== null ? { priceCents } : {}),
        ...(reserved ? { confirmReservedCheckout: true } : {}),
      })
      setOpen(false)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="pc-admin-btn pc-admin-btn--primary"
        onClick={() => setOpen(true)}
        data-testid="piece-sell-offline"
      >
        {adminText('piecesSellOffline')}
      </button>
      <ConfirmDialog
        open={open}
        title={adminText('piecesSellOfflineTitle', { nr })}
        consequence={
          reserved ? adminText('piecesSellOfflineReservedText') : adminText('piecesSellOfflineText')
        }
        confirmLabel={adminText('piecesSellOfflineConfirm')}
        busy={busy}
        onConfirm={() => void run()}
        onCancel={() => setOpen(false)}
      >
        <div className="pc-field pc-field--check">
          <label className="pc-choice" htmlFor={switchId}>
            <input
              id={switchId}
              type="checkbox"
              role="switch"
              checked={archive}
              aria-checked={archive}
              onChange={(e) => setArchive(e.target.checked)}
              data-testid="piece-sell-offline-archive"
            />
            <span>{adminText('piecesShowInArchiveSwitch')}</span>
          </label>
        </div>
        <div className="pc-field">
          <label htmlFor={noteId} className="pc-field__label">
            {adminText('piecesOfflineNote')}
          </label>
          <input
            id={noteId}
            type="text"
            maxLength={120}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {tourOptions.length > 0 ? (
          <div className="pc-field">
            <label htmlFor={tourId} className="pc-field__label">
              {adminText('piecesOfflineTourDate')}
            </label>
            <select
              id={tourId}
              value={tourDate}
              onChange={(e) => setTourDate(e.target.value)}
              data-testid="piece-sell-offline-tour"
            >
              <option value="">{adminText('piecesOfflineTourDateNone')}</option>
              {tourOptions.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="pc-field">
          <label htmlFor={priceId} className="pc-field__label">
            {adminText('piecesOfflinePrice')}
          </label>
          <input
            id={priceId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={price}
            aria-describedby={`${priceId}-hint`}
            onChange={(e) => setPrice(e.target.value)}
            data-testid="piece-sell-offline-price"
          />
          <p id={`${priceId}-hint`} className="pc-piece__hint">
            {adminText('piecesOfflinePriceHint')}
          </p>
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </ConfirmDialog>
    </>
  )
}

type TakeOffChoice = 'back' | 'gone'

/** V-34: „Aus dem Shop nehmen“ → „Kommt es wieder?“ (Ja = P3 zurück zum Entwurf, Nein = P12 weglegen). */
function TakeOffButton({ id, nr, onDone }: { id: number; nr: string; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const running = useRef(false)

  const choose = async (choice: TakeOffChoice) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError(null)
    try {
      await postAdminAction(`/api/products/${id}/${choice === 'back' ? 'unpublish' : 'archive'}`)
      setOpen(false)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="pc-admin-btn pc-admin-btn--secondary"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        data-testid="piece-take-off"
      >
        {adminText('piecesTakeOff')}
      </button>
      <ChoiceDialog<TakeOffChoice>
        open={open}
        title={adminText('piecesTakeOffTitle', { nr })}
        consequence={adminText('piecesTakeOffText')}
        busy={busy}
        onCancel={() => setOpen(false)}
        onChoose={(c) => void choose(c)}
        choices={[
          {
            key: 'back',
            label: adminText('piecesTakeOffBack'),
            hint: adminText('piecesTakeOffBackHint'),
            variant: 'primary',
            'data-testid': 'piece-take-off-back',
          },
          {
            key: 'gone',
            label: adminText('piecesTakeOffGone'),
            hint: adminText('piecesTakeOffGoneHint'),
            'data-testid': 'piece-take-off-gone',
          },
        ]}
      >
        {error ? <Notice tone="error">{error}</Notice> : null}
      </ChoiceDialog>
    </>
  )
}

/** V-33 a: erzielten Preis eines Markt-/Privatverkaufs nachtragen oder ändern (leer = ohne Preis). */
function OfflinePriceButton({
  id,
  nr,
  cents,
  onDone,
}: {
  id: number
  nr: string
  cents: number | null
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [price, setPrice] = useState(cents === null ? '' : formatEuroInput(cents))
  const [error, setError] = useState<string | null>(null)
  const running = useRef(false)
  const priceId = useId()

  const save = async () => {
    if (running.current) return
    const value = price.trim()
      ? parseEuroInput(price, { min: 0, max: PRICE_CENTS_RANGE.max })
      : null
    if (price.trim() && value === null) {
      setError(adminText('piecesOfflinePriceInvalid'))
      return
    }
    running.current = true
    setBusy(true)
    setError(null)
    try {
      await send(`/api/products/${id}?depth=0`, 'PATCH', { offlineSalePriceCents: value })
      setOpen(false)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <>
      {cents !== null ? (
        <span className="pc-pieces__price-note" data-testid="piece-offline-price">
          {adminText('piecesOfflinePriceShown', { price: `${formatEuroInput(cents)} €` })}
        </span>
      ) : null}
      <button
        type="button"
        className="pc-admin-btn pc-admin-btn--secondary"
        onClick={() => {
          setPrice(cents === null ? '' : formatEuroInput(cents))
          setError(null)
          setOpen(true)
        }}
        data-testid="piece-offline-price-edit"
      >
        {adminText(cents === null ? 'piecesOfflinePriceAdd' : 'piecesOfflinePriceEdit')}
      </button>
      <ConfirmDialog
        open={open}
        title={adminText('piecesOfflinePriceTitle', { nr })}
        consequence={adminText('piecesOfflinePriceText')}
        confirmLabel={adminText('piecesOfflinePriceSave')}
        busy={busy}
        onConfirm={() => void save()}
        onCancel={() => setOpen(false)}
      >
        <div className="pc-field">
          <label htmlFor={priceId} className="pc-field__label">
            {adminText('piecesOfflinePrice')}
          </label>
          <input
            id={priceId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            data-testid="piece-offline-price-input"
          />
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </ConfirmDialog>
    </>
  )
}

export function PieceCardActions({
  id,
  nr,
  actions,
  adminRoute,
  publicUrl,
  orderId,
  showInArchive,
  tourOptions = [],
  offlinePriceCents = null,
}: PieceCardActionsProps) {
  const router = useRouter()
  const refresh = () => router.refresh()
  const has = (a: PieceAction) => actions.includes(a)
  const post = (path: string) => () => postAdminAction(`/api/products/${id}/${path}`)

  return (
    <div className="pc-admin-row pc-pieces__actions" data-testid="piece-actions">
      {has('edit') ? (
        <a className="pc-admin-btn pc-admin-btn--secondary" href={`${adminRoute}/stuecke/${id}`}>
          {adminText('piecesEdit')}
        </a>
      ) : null}
      {has('publish') ? (
        <ActionButton
          action={post('publish')}
          onDone={refresh}
          effects={['stock']}
          confirm={{
            title: adminText('piecesPublishTitle', { nr }),
            consequence: adminText('piecesPublishText'),
            confirmLabel: adminText('piecePublish'),
          }}
        >
          {adminText('piecePublish')}
        </ActionButton>
      ) : null}
      {has('copyLink') ? <CopyButton text={publicUrl} label={adminText('pieceCopyLink')} /> : null}
      {has('sellOffline') || has('sellOfflineReserved') ? (
        <SellOfflineButton
          id={id}
          nr={nr}
          reserved={has('sellOfflineReserved')}
          tourOptions={tourOptions}
          onDone={refresh}
        />
      ) : null}
      {has('toOrder') && orderId ? (
        <a
          className="pc-admin-btn pc-admin-btn--secondary"
          href={`${adminRoute}/bestellungen/${orderId}`}
          data-testid="piece-to-order"
        >
          {adminText('piecesToOrder')}
        </a>
      ) : null}
      {has('takeOff') ? <TakeOffButton id={id} nr={nr} onDone={refresh} /> : null}
      {has('toggleArchive') ? (
        <ActionButton
          variant="secondary"
          action={() =>
            send(`/api/products/${id}?depth=0`, 'PATCH', { showInArchiveAfterSale: !showInArchive })
          }
          onDone={refresh}
          data-testid="piece-toggle-archive"
        >
          {adminText(showInArchive ? 'piecesArchiveHide' : 'piecesArchiveShow')}
        </ActionButton>
      ) : null}
      {has('returnToStock') ? (
        <ActionButton
          variant="secondary"
          action={post('return-to-stock')}
          onDone={refresh}
          effects={['stock']}
          confirm={{
            title: adminText('piecesReturnTitle', { nr }),
            consequence: adminText('piecesReturnText'),
          }}
        >
          {adminText('piecesReturn')}
        </ActionButton>
      ) : null}
      {has('archive') || has('archiveAfterReturn') ? (
        <ActionButton
          variant="secondary"
          action={post(has('archive') ? 'archive' : 'archive-after-return')}
          onDone={refresh}
          effects={['stock']}
          data-testid="piece-shelve"
          confirm={{
            title: adminText('piecesShelveTitle', { nr }),
            consequence: adminText('piecesShelveText'),
            confirmLabel: adminText('piecesShelveConfirm'),
          }}
        >
          {adminText('piecesShelve')}
        </ActionButton>
      ) : null}
      {has('offlinePrice') ? (
        <OfflinePriceButton id={id} nr={nr} cents={offlinePriceCents} onDone={refresh} />
      ) : null}
      {has('restore') ? (
        <ActionButton variant="secondary" action={post('restore')} onDone={refresh}>
          {adminText('piecesRestore')}
        </ActionButton>
      ) : null}
      {has('delete') ? (
        <ActionButton
          variant="danger"
          action={() => send(`/api/products/${id}`, 'DELETE')}
          onDone={refresh}
          effects={['delete']}
          confirm={{
            title: adminText('piecesDeleteTitle', { nr }),
            consequence: adminText('piecesDeleteText'),
            confirmLabel: adminText('piecesDelete'),
          }}
        >
          {adminText('piecesDelete')}
        </ActionButton>
      ) : null}
      <a
        className="pc-admin-btn pc-admin-btn--secondary"
        href={`/api/products/${id}/label.pdf`}
        target="_blank"
        rel="noopener"
        data-testid="piece-label"
      >
        {adminText('orderLabel', { nr })}
      </a>
    </div>
  )
}
