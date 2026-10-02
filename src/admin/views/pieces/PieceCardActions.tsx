'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { AdminActionError, postAdminAction } from '../../components/adminAction'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { CopyButton } from '../../components/CopyButton'
import { Notice } from '../../components/Notice'
import { adminText } from '../../translations'
import type { ProductStatus } from '@/lib/enums'

import type { PieceAction } from './piecesQuery'

// Knöpfe einer Karte in „Meine Stücke“ (PLAN P5.8, KONZEPT §7.5) auf die Endpunkte aus P5.7. Aktionen mit Wirkung auf
// den Bestand (Offline verkauft, Offline nehmen, Ausblenden, Löschen, Wieder verkaufen) fragen vorher nach und nennen
// die Folge. Nach jeder Aktion wird die Liste neu geladen.

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
  onDone,
}: {
  id: number
  nr: string
  reserved: boolean
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [archive, setArchive] = useState(true)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const running = useRef(false)
  const noteId = useId()
  const switchId = useId()

  const run = async () => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError(null)
    try {
      await postAdminAction(`/api/products/${id}/sell-offline`, {
        showInArchive: archive,
        note: note.trim() || undefined,
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
        <SellOfflineButton id={id} nr={nr} reserved={has('sellOfflineReserved')} onDone={refresh} />
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
      {has('unpublish') ? (
        <ActionButton
          variant="secondary"
          action={post('unpublish')}
          onDone={refresh}
          effects={['stock']}
          confirm={{
            title: adminText('piecesUnpublishTitle', { nr }),
            consequence: adminText('piecesUnpublishText'),
          }}
        >
          {adminText('piecesUnpublish')}
        </ActionButton>
      ) : null}
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
          confirm={{
            title: adminText('piecesArchiveTitle', { nr }),
            consequence: adminText('piecesArchiveText'),
          }}
        >
          {adminText('piecesArchive')}
        </ActionButton>
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
