'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Notice } from '../../components/Notice'
import { adminText } from '../../translations'

// Einstellungen → Beispieldaten (PLAN P8.19, KONZEPT §11.3): Anzahl `seed = true` je Bereich, „Beispieldaten
// entfernen“ mit Dialog (Mengen, „Seitentexte und FAQ behalten“ vorausgewählt, Bestätigung durch Eintippen von
// „ENTFERNEN“) → `POST /api/admin/seed/remove`. Gesperrt, solange ein aktiver Rechtstext ein Platzhalter ist. Darunter
// „Übernehmen“ für einzelne Stücke, Flash, Galerie-Einträge und Bilder (`POST /api/<collection>/:id/adopt`).

export const SEED_CONFIRM_WORD = 'ENTFERNEN'

export interface SeedCountRow {
  slug: string
  label: string
  count: number
}

export interface AdoptGroup {
  collection: 'products' | 'flash' | 'tattoo-gallery' | 'media'
  label: string
  items: Array<{ id: number; title: string }>
}

export function SeedArea({
  counts,
  lockedTypes,
  adoptGroups,
}: {
  counts: SeedCountRow[]
  lockedTypes: string[]
  adoptGroups: AdoptGroup[]
}) {
  const router = useRouter()
  const total = counts.reduce((a, r) => a + r.count, 0)
  const locked = lockedTypes.length > 0
  const [open, setOpen] = useState(false)
  const [keepTexts, setKeepTexts] = useState(true)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const running = useRef(false)
  const id = useId()

  const close = () => {
    setOpen(false)
    setWord('')
    setKeepTexts(true)
  }

  const remove = async () => {
    if (running.current || word.trim() !== SEED_CONFIRM_WORD) return
    running.current = true
    setBusy(true)
    setFeedback(null)
    try {
      await postAdminAction('/api/admin/seed/remove', { keepTexts, confirm: word.trim() })
      setFeedback({ tone: 'success', text: adminText('settingsSeedDone') })
      close()
      router.refresh()
    } catch (err) {
      setFeedback({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <div data-testid="settings-seed">
      <p className="pc-order__muted">{adminText('settingsSeedIntro')}</p>
      {total === 0 ? (
        <p data-testid="settings-seed-none">{adminText('settingsSeedNone')}</p>
      ) : (
        <>
          <dl className="pc-order__facts" data-testid="settings-seed-counts">
            {counts.map((r) => (
              <React.Fragment key={r.slug}>
                <dt>{r.label}</dt>
                <dd data-slug={r.slug}>{r.count}</dd>
              </React.Fragment>
            ))}
          </dl>
          <p data-testid="settings-seed-total">{adminText('settingsSeedTotal', { total })}</p>
        </>
      )}
      {locked ? (
        <Notice tone="warning" id={`${id}-locked`} data-testid="settings-seed-locked">
          {adminText('settingsSeedLocked')}{' '}
          {adminText('settingsSeedLockedTypes', { types: lockedTypes.join(', ') })}
        </Notice>
      ) : null}
      <p className="pc-admin-row">
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--danger"
          disabled={locked || total === 0}
          aria-describedby={locked ? `${id}-locked` : undefined}
          data-testid="settings-seed-remove"
          onClick={() => {
            setFeedback(null)
            setOpen(true)
          }}
        >
          {adminText('settingsSeedRemove')}
        </button>
      </p>
      {feedback ? (
        <Notice tone={feedback.tone} data-testid="settings-seed-feedback">
          {feedback.text}
        </Notice>
      ) : null}
      <ConfirmDialog
        open={open}
        danger
        busy={busy}
        title={adminText('settingsSeedDialog')}
        consequence={adminText('settingsSeedConsequence', { total })}
        confirmLabel={adminText('settingsSeedConfirmOk')}
        confirmDisabled={word.trim() !== SEED_CONFIRM_WORD}
        onConfirm={() => void remove()}
        onCancel={close}
      >
        <ul className="pc-order__items" data-testid="settings-seed-dialog-counts">
          {counts.map((r) => (
            <li key={r.slug}>
              {r.label}: {r.count}
            </li>
          ))}
        </ul>
        <div className="pc-field">
          <label className="pc-choice">
            <input
              type="checkbox"
              checked={keepTexts}
              aria-describedby={`${id}-keep-hint`}
              data-testid="settings-seed-keep-texts"
              onChange={(e) => setKeepTexts(e.target.checked)}
            />
            {adminText('settingsSeedKeepTexts')}
          </label>
          <p id={`${id}-keep-hint`} className="pc-order__muted">
            {adminText('settingsSeedKeepTextsHint')}
          </p>
        </div>
        <div className="pc-field">
          <label htmlFor={`${id}-word`} className="pc-field__label">
            {adminText('settingsSeedConfirmLabel')}
          </label>
          <input
            id={`${id}-word`}
            type="text"
            value={word}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            data-testid="settings-seed-confirm-word"
            onChange={(e) => setWord(e.target.value)}
          />
        </div>
        {feedback?.tone === 'error' ? (
          <Notice tone="error" data-testid="settings-seed-dialog-error">
            {feedback.text}
          </Notice>
        ) : null}
      </ConfirmDialog>

      {adoptGroups.some((g) => g.items.length > 0) ? (
        <details className="pc-settings__adopt" data-testid="settings-seed-adopt">
          <summary>{adminText('settingsSeedAdoptTitle')}</summary>
          <p className="pc-order__muted">{adminText('settingsSeedAdoptHint')}</p>
          {adoptGroups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.collection}>
                <h3>{g.label}</h3>
                <ul className="pc-order__items">
                  {g.items.map((item) => (
                    <li
                      key={item.id}
                      className="pc-order__item"
                      data-testid="settings-seed-adopt-item"
                      data-collection={g.collection}
                      data-id={item.id}
                    >
                      <span>{item.title}</span>
                      <ActionButton
                        variant="secondary"
                        data-testid={`settings-seed-adopt-${g.collection}-${item.id}`}
                        action={async () => {
                          const res = await postAdminAction(`/api/${g.collection}/${item.id}/adopt`)
                          return { ...res, message: adminText('settingsSeedAdoptDone') }
                        }}
                        onDone={() => router.refresh()}
                      >
                        {adminText('settingsSeedAdopt')}
                        <span className="pc-visually-hidden"> {item.title}</span>
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </details>
      ) : null}
    </div>
  )
}
