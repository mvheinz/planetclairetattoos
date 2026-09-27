'use client'

import { useEffect, useRef, useState } from 'react'
import type { UIFieldClientComponent } from 'payload'
import { useField, useTranslation } from '@payloadcms/ui'

import {
  DOWNSCALE_JPEG_QUALITY,
  downscaleDimensions,
  downscaledName,
  needsDownscale,
} from '@/lib/media/downscale'

// Schritt 1 der Bildpipeline (DESIGN §12.2, DATENMODELL §6.2): Große Fotos werden vor dem Hochladen im Browser auf
// höchstens 2560 px lange Kante verkleinert (JPEG q 0,85), damit der Upload unter dem Größenlimit bleibt. Der Server
// prüft und normiert trotzdem (Orientierung, sRGB, Metadaten).

type State =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; width: number; height: number }
  | { kind: 'failed' }

const RASTER_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function downscale(
  file: File,
): Promise<{ file: File; width: number; height: number } | null> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    if (!needsDownscale(file, bitmap.width, bitmap.height)) return null
    const { width, height } = downscaleDimensions(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', DOWNSCALE_JPEG_QUALITY),
    )
    if (!blob) throw new Error('toBlob')
    const out = new File([blob], downscaledName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
    return { file: out, width, height }
  } finally {
    bitmap.close()
  }
}

export const DownscaleUpload: UIFieldClientComponent = () => {
  const { value, setValue } = useField<File | null>({ path: 'file' })
  const { t } = useTranslation()
  const tr = t as (key: string, vars?: Record<string, unknown>) => string
  const handled = useRef(new WeakSet<File>())
  const [state, setState] = useState<State>({ kind: 'idle' })

  useEffect(() => {
    if (typeof File === 'undefined' || !(value instanceof File)) return
    if (handled.current.has(value) || !RASTER_TYPES.includes(value.type)) return
    handled.current.add(value)
    let cancelled = false
    setState({ kind: 'working' })
    downscale(value)
      .then((result) => {
        if (cancelled) return
        if (!result) return setState({ kind: 'idle' })
        handled.current.add(result.file)
        setValue(result.file)
        setState({ kind: 'done', width: result.width, height: result.height })
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'failed' })
      })
    return () => {
      cancelled = true
    }
  }, [value, setValue])

  const text =
    state.kind === 'working'
      ? tr('custom:downscaleWorking')
      : state.kind === 'done'
        ? tr('custom:downscaleDone', { width: state.width, height: state.height })
        : state.kind === 'failed'
          ? tr('custom:downscaleFailed')
          : tr('custom:downscaleHint')
  return (
    <p className="field-description" aria-live="polite" style={{ marginBottom: '1rem' }}>
      {text}
    </p>
  )
}
