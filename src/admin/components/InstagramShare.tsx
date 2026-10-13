'use client'

import React, { useEffect, useId, useState } from 'react'

import { instagramFileName } from '@/lib/products/instagram'

import { adminText } from '../translations'

// Knopf „Für Instagram“ (V-39, U-93): kopiert zuerst den fertigen Text in die Zwischenablage (Instagram übernimmt
// geteilten Text nicht) und öffnet dann das Teilen-Menü des iPads mit dem Foto (Web Share API mit Datei, nur in der
// Verwaltung). Kann der Browser keine Dateien teilen (Computer), wird das Foto gespeichert. Dazu „Story-Bild“ (Hochformat
// 1080 × 1920 für den Link-Sticker), ebenso geteilt bzw. gespeichert. Die Dateien werden beim Anzeigen vorgeladen –
// Safari erlaubt das Teilen nur direkt nach dem Tippen. Keine Meta-Schnittstelle, kein Drittanbieter.

type Status = 'idle' | 'shared' | 'saved' | 'copied' | 'copyFailed' | 'failed'

async function loadFile(url: string, name: string, type: string): Promise<File | null> {
  try {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return null
    return new File([await res.blob()], name, { type })
  } catch {
    return null
  }
}

function download(file: File) {
  const href = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = href
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 10_000)
}

/** Teilen (iPad) oder speichern (Computer); `null` = abgebrochen. */
async function shareOrSave(file: File | null): Promise<'shared' | 'saved' | 'failed' | null> {
  if (!file) return 'failed'
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null
    }
  }
  download(file)
  return 'saved'
}

export function InstagramShare({
  productId,
  itemNumber,
  text,
}: {
  productId: number
  itemNumber: number
  text: string
}) {
  const [photo, setPhoto] = useState<File | null>(null)
  const [story, setStory] = useState<File | null>(null)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const textId = useId()

  useEffect(() => {
    let alive = true
    void Promise.all([
      loadFile(
        `/api/products/${productId}/instagram-photo.jpg`,
        instagramFileName(itemNumber, 'photo', 'jpg'),
        'image/jpeg',
      ),
      loadFile(
        `/api/products/${productId}/instagram-story.png`,
        instagramFileName(itemNumber, 'story', 'png'),
        'image/png',
      ),
    ]).then(([p, s]) => {
      if (!alive) return
      setPhoto(p)
      setStory(s)
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [productId, itemNumber])

  const forInstagram = async () => {
    // 1. Text zuerst kopieren (im selben Tipp, vor dem Teilen-Menü)
    const copied: Promise<boolean> = navigator.clipboard?.writeText
      ? navigator.clipboard.writeText(text).then(
          () => true,
          () => false,
        )
      : Promise.resolve(false)
    // 2. Foto teilen bzw. speichern
    const shared = await shareOrSave(photo)
    const ok = await copied
    if (!ok) setStatus('copyFailed')
    else if (shared === 'failed') setStatus('copied')
    else if (shared) setStatus(shared)
    else setStatus('copied')
  }

  const storyImage = async () => {
    const res = await shareOrSave(story)
    if (res) setStatus(res === 'failed' ? 'failed' : res)
  }

  const message: Record<Exclude<Status, 'idle'>, string> = {
    shared: adminText('instagramShared'),
    saved: adminText('instagramSaved'),
    copied: adminText('instagramCopied'),
    copyFailed: adminText('instagramCopyFailed'),
    failed: adminText('instagramFailed'),
  }

  return (
    <section className="pc-order__card" aria-labelledby={`${textId}-title`} data-testid="instagram">
      <h2 id={`${textId}-title`}>{adminText('instagramTitle')}</h2>
      <p className="pc-order__muted">{adminText('instagramIntro')}</p>
      <p className="pc-admin-row">
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--primary"
          onClick={() => void forInstagram()}
          disabled={!ready}
          aria-busy={!ready || undefined}
          data-testid="instagram-share"
        >
          {adminText('instagramButton')}
        </button>
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--secondary"
          onClick={() => void storyImage()}
          disabled={!ready || !story}
          data-testid="instagram-story"
        >
          {adminText('instagramStory')}
        </button>
      </p>
      <p role="status" aria-live="polite" data-testid="instagram-status">
        {status === 'idle' ? '' : message[status]}
      </p>
      <label htmlFor={textId} className="pc-field__label">
        {adminText('instagramTextLabel')}
      </label>
      <textarea
        id={textId}
        readOnly
        rows={9}
        value={text}
        className="pc-instagram__text"
        data-testid="instagram-text"
        onFocus={(e) => e.currentTarget.select()}
      />
    </section>
  )
}
