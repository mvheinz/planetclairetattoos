'use client'

import { useRouter } from 'next/navigation'
import React, { useRef, useState } from 'react'

import { AdminActionError, postAdminAction } from '../../components/adminAction'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Notice } from '../../components/Notice'
import { adminText } from '../../translations'

// „Alle fertigen online stellen“ (V-32, P20.6): Der Dialog zählt zuerst die fertigen Entwürfe (dieselbe Prüfung wie
// beim Online-Stellen, `GET /api/products/publish-ready`) und nennt die Zahl. Nach dem Bestätigen stellt die Verwaltung
// sie in kleinen Paketen online (`POST`, je Stück eigene Prüfung) und meldet Erfolge und Fehler. Häkchen wie „nur
// eigene Figuren“ oder „nickelfrei“ setzt die Sammelaktion nie (R-047, nichts vorangekreuzt).

interface PieceRef {
  id: number
  nr: string
  title: string | null
}
interface Failed extends PieceRef {
  message: string
}
interface Count {
  drafts: number
  ready: PieceRef[]
}
type Report = { published: number; failed: Failed[] }

async function readJson<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new AdminActionError(
      adminText('actionFailed', { message: json.error ?? String(res.status) }),
      res.status,
    )
  }
  return json
}

export function PublishReadyButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState<Count | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const running = useRef(false)

  const start = async () => {
    setOpen(true)
    setCount(null)
    setError(null)
    setReport(null)
    try {
      const res = await fetch('/api/products/publish-ready', { credentials: 'include' })
      setCount(await readJson<Count>(res))
    } catch (err) {
      setError(err instanceof AdminActionError ? err.message : adminText('actionOffline'))
    }
  }

  const run = async () => {
    if (running.current || !count || count.ready.length === 0) return
    running.current = true
    setBusy(true)
    setError(null)
    const total = count.ready.length
    let published = 0
    const failed: Failed[] = []
    setProgress({ done: 0, total })
    try {
      // In Paketen, bis nichts Fertiges mehr übrig ist; gescheiterte Stücke werden nicht noch einmal versucht.
      for (let round = 0; round < 50; round++) {
        const r = await postAdminAction<{
          published?: PieceRef[]
          failed?: Failed[]
          remaining?: number
        }>('/api/products/publish-ready', {
          // genau die gezählten und bestätigten Stücke – kein Entwurf, der erst danach fertig wurde
          ids: count.ready.map((p) => p.id),
          skip: failed.map((f) => f.id),
        })
        published += r.published?.length ?? 0
        failed.push(...(r.failed ?? []))
        setProgress({ done: published, total })
        if ((r.published?.length ?? 0) + (r.failed?.length ?? 0) === 0 || !r.remaining) break
      }
      setReport({ published, failed })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      if (published > 0) router.refresh()
    } finally {
      running.current = false
      setBusy(false)
      setProgress(null)
    }
  }

  const ready = count?.ready.length ?? 0
  const consequence = report
    ? report.published === 1
      ? adminText('piecesPublishReadyDoneOne')
      : adminText('piecesPublishReadyDone', { n: report.published })
    : !count
      ? adminText('piecesPublishReadyCounting')
      : ready === 0
        ? adminText('piecesPublishReadyNone')
        : adminText('piecesPublishReadyText', { ready, drafts: count.drafts })

  return (
    <>
      <button
        type="button"
        className="pc-admin-btn pc-admin-btn--secondary"
        onClick={() => void start()}
        data-testid="pieces-publish-ready"
      >
        {adminText('piecesPublishReady')}
      </button>
      <ConfirmDialog
        open={open}
        title={adminText('piecesPublishReadyTitle')}
        consequence={consequence}
        confirmLabel={
          report || ready === 0
            ? adminText('piecesPublishReadyClose')
            : adminText('piecesPublishReadyConfirm', { n: ready })
        }
        confirmDisabled={!count && !error}
        busy={busy}
        onConfirm={() => (report || ready === 0 ? setOpen(false) : void run())}
        onCancel={() => setOpen(false)}
      >
        {progress ? (
          <p role="status" data-testid="pieces-publish-ready-progress">
            {adminText('piecesPublishReadyRunning', progress)}
          </p>
        ) : null}
        {report && report.failed.length > 0 ? (
          <div data-testid="pieces-publish-ready-failed">
            <p>{adminText('piecesPublishReadyFailed')}</p>
            <ul>
              {report.failed.map((f) => (
                <li key={f.id}>
                  {f.nr}
                  {f.title ? ` „${f.title}“` : ''}: {f.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </ConfirmDialog>
    </>
  )
}
