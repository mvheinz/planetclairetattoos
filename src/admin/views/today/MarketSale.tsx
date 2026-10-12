'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useId, useRef, useState } from 'react'

import { postAdminAction } from '../../components/adminAction'
import { Notice } from '../../components/Notice'
import { adminText } from '../../translations'
import { formatEuroInput, PRICE_CENTS_RANGE, parseEuroInput } from '@/lib/money'

// Markt-Knopf unter „Heute“ (V-33 a, P20.6): Nummer eintippen, „verkauft“ antippen – das Stück ist sofort aus dem Shop
// (derselbe Übergang wie „Verkauft (Markt/privat)“, `POST /api/products/market-sale`). Beim Tippen zeigt die
// Verwaltung, welches Stück gemeint ist (`GET …?nr=`), damit keine falsche Nummer verkauft wird. Preis freiwillig.
// Reservierte Stücke (Kasse, Vorkasse) lehnt der Server mit klarer Meldung ab.

interface Piece {
  id: number
  itemNumber: number
  nr: string
  title: string | null
  priceCents: number | null
  status: string
}

const LOOKUP_DELAY = 300

export function MarketSale({ adminRoute }: { adminRoute: string }) {
  const router = useRouter()
  const [number, setNumber] = useState('')
  const [price, setPrice] = useState('')
  const [found, setFound] = useState<{
    for: string
    piece: Piece | null
    refusal: string | null
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ piece: Piece; text: string } | null>(null)
  const running = useRef(false)
  const numberId = useId()
  const priceId = useId()

  const nr = number.trim()
  useEffect(() => {
    if (!/^\d{1,5}$/.test(nr)) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/products/market-sale?nr=${encodeURIComponent(nr)}`, {
        credentials: 'include',
        signal: ctrl.signal,
      })
        .then(async (r) => {
          const j = (await r.json().catch(() => ({}))) as {
            piece?: Piece
            refusal?: string | null
            error?: string
          }
          setFound({ for: nr, piece: j.piece ?? null, refusal: j.refusal ?? j.error ?? null })
        })
        .catch(() => undefined)
    }, LOOKUP_DELAY)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [nr])
  const shown = found && found.for === nr ? found : null

  const sell = async () => {
    if (running.current || !/^\d{1,5}$/.test(nr)) return
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
    setDone(null)
    try {
      const r = await postAdminAction<{ doc?: Piece; message?: string }>(
        '/api/products/market-sale',
        { itemNumber: nr, ...(priceCents !== null ? { priceCents } : {}) },
      )
      const piece = r.doc ?? shown?.piece
      if (piece) {
        setDone({
          piece,
          text: r.unchanged
            ? (r.message ?? adminText('todayMarketAlready', { nr: piece.nr }))
            : adminText('todayMarketDone', {
                nr: piece.nr,
                title: piece.title ? ` „${piece.title}“` : '',
              }),
        })
      }
      setNumber('')
      setPrice('')
      setFound(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  const blocked = !!shown?.refusal

  return (
    <section
      className="pc-order__section pc-today__market"
      aria-labelledby="today-market-title"
      data-testid="today-market"
    >
      <h2 id="today-market-title">{adminText('todayMarketTitle')}</h2>
      <p className="pc-piece__hint">{adminText('todayMarketIntro')}</p>
      <form
        className="pc-today__marketform"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void sell()
        }}
      >
        <div className="pc-field">
          <label htmlFor={numberId} className="pc-field__label">
            {adminText('todayMarketNumber')}
          </label>
          <input
            id={numberId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={number}
            disabled={busy}
            onChange={(e) => {
              setNumber(e.target.value.replace(/\D/g, '').slice(0, 5))
              setError(null)
            }}
            aria-describedby={`${numberId}-piece`}
            data-testid="today-market-number"
          />
        </div>
        <div className="pc-field">
          <label htmlFor={priceId} className="pc-field__label">
            {adminText('todayMarketPrice')}
          </label>
          <input
            id={priceId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={price}
            disabled={busy}
            onChange={(e) => setPrice(e.target.value)}
            aria-describedby={`${priceId}-hint`}
            data-testid="today-market-price"
          />
          <p id={`${priceId}-hint`} className="pc-piece__hint">
            {adminText('todayMarketPriceHint')}
          </p>
        </div>
        <p
          id={`${numberId}-piece`}
          className="pc-today__marketpiece"
          role="status"
          aria-live="polite"
          data-testid="today-market-piece"
        >
          {shown?.piece
            ? `${shown.piece.nr}${shown.piece.title ? ` „${shown.piece.title}“` : ''}${
                shown.piece.priceCents !== null
                  ? ` · ${formatEuroInput(shown.piece.priceCents)} €`
                  : ''
              }`
            : ''}
          {shown?.refusal ? (
            <span className="pc-today__marketrefusal"> {shown.refusal}</span>
          ) : null}
        </p>
        <p className="pc-admin-row">
          <button
            type="submit"
            className="pc-admin-btn pc-admin-btn--primary"
            disabled={busy || !/^\d{1,5}$/.test(nr) || blocked}
            aria-busy={busy || undefined}
            data-testid="today-market-sell"
          >
            {busy ? adminText('actionBusy') : adminText('todayMarketSell')}
          </button>
        </p>
      </form>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {done ? (
        <div data-testid="today-market-done">
          <Notice tone="success">{done.text}</Notice>
          <p>
            <a
              className="pc-admin-link"
              href={`${adminRoute}/stuecke?q=${done.piece.itemNumber}`}
              data-testid="today-market-open"
            >
              {adminText('todayMarketOpen')}
            </a>
          </p>
        </div>
      ) : null}
    </section>
  )
}
