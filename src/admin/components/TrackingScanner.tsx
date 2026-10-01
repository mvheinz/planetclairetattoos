'use client'

import React, { useEffect, useId, useRef, useState } from 'react'

import { adminText } from '../translations'

// Sendungsnummer scannen (PLAN P5.14, KONZEPT §7.1/§7.6): Kamera erst nach Tipp. Zuerst das native `BarcodeDetector`
// (Code 128, Code 39, ITF, Data Matrix) mit der Rückkamera (`facingMode: 'environment'`); gibt es das nicht oder
// verweigert der Browser die Kamera, ein Foto (`<input type="file" capture="environment">`), das `@zxing/browser`
// ausliest – als dynamisch importierter Chunk, der nur hier (Versand im Bestell-Detail) geladen wird. Keine
// Netz-Anfragen; die Texteingabe daneben bleibt immer möglich.

const FORMATS = ['code_128', 'code_39', 'itf', 'data_matrix'] as const
const MAX_EDGE = 2000

interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
type BarcodeDetectorCtor = {
  new (options?: { formats?: readonly string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

function nativeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  return ctor && typeof navigator.mediaDevices?.getUserMedia === 'function' ? ctor : null
}

/** Gelesenen Wert wie die Eingabe normalisieren: ohne Leerzeichen, Großbuchstaben. */
export function normalizeScanned(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

/** Foto über `@zxing/browser` auslesen (eigener Chunk, erst beim ersten Foto geladen). */
async function decodePhoto(file: File): Promise<string | null> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ])
  const hints = new Map<unknown, unknown>([
    [
      DecodeHintType.POSSIBLE_FORMATS,
      [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF, BarcodeFormat.DATA_MATRIX],
    ],
    [DecodeHintType.TRY_HARDER, true],
  ])
  const reader = new BrowserMultiFormatReader(hints as never)
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  try {
    return reader.decodeFromCanvas(canvas).getText()
  } catch {
    return null
  }
}

export interface TrackingScannerProps {
  /** Gelesene Sendungsnummer (normalisiert) ins Feld übernehmen. */
  onDetected: (value: string) => void
  disabled?: boolean
}

export function TrackingScanner({ onDetected, disabled = false }: TrackingScannerProps) {
  const [mode, setMode] = useState<'idle' | 'camera' | 'reading'>('idle')
  const [status, setStatus] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const loopRef = useRef<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const statusId = useId()

  const stop = () => {
    if (loopRef.current !== null) window.clearTimeout(loopRef.current)
    loopRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }
  useEffect(() => stop, [])

  const found = (raw: string) => {
    stop()
    setMode('idle')
    const value = normalizeScanned(raw)
    onDetected(value)
    setStatus(adminText('scanFound', { value }))
  }

  const openPhoto = () => {
    setStatus(null)
    fileRef.current?.click()
  }

  const startCamera = async () => {
    const Ctor = nativeDetector()
    if (!Ctor) return openPhoto()
    let detector: BarcodeDetectorLike
    try {
      const supported = (await Ctor.getSupportedFormats?.()) ?? [...FORMATS]
      const formats = FORMATS.filter((f) => supported.includes(f))
      if (formats.length === 0) return openPhoto()
      detector = new Ctor({ formats })
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
    } catch {
      stop()
      setStatus(adminText('scanCameraUnavailable'))
      return openPhoto()
    }
    setMode('camera')
    setStatus(adminText('scanCameraHint'))
    const video = videoRef.current
    if (!video) return
    video.srcObject = streamRef.current
    await video.play().catch(() => undefined)
    const tick = async () => {
      if (!streamRef.current) return
      try {
        const codes = await detector.detect(video)
        const hit = codes.find((c) => c.rawValue?.trim())
        if (hit) return found(hit.rawValue)
      } catch {
        // Bild noch nicht bereit – nächster Versuch
      }
      loopRef.current = window.setTimeout(() => void tick(), 250)
    }
    void tick()
  }

  const onPhoto = async (file: File | undefined) => {
    if (!file) return
    setMode('reading')
    setStatus(adminText('scanReading'))
    try {
      const text = await decodePhoto(file)
      if (text) return found(text)
      setStatus(adminText('scanNotFound'))
    } catch {
      setStatus(adminText('scanNotFound'))
    } finally {
      setMode((m) => (m === 'reading' ? 'idle' : m))
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="pc-scan" data-testid="tracking-scanner">
      <p className="pc-admin-row">
        {mode === 'camera' ? (
          <button
            type="button"
            className="pc-admin-btn pc-admin-btn--secondary"
            onClick={() => {
              stop()
              setMode('idle')
              setStatus(null)
            }}
          >
            {adminText('scanStop')}
          </button>
        ) : (
          <button
            type="button"
            className="pc-admin-btn pc-admin-btn--secondary"
            disabled={disabled || mode === 'reading'}
            aria-describedby={status ? statusId : undefined}
            onClick={() => void startCamera()}
            data-testid="tracking-scan"
          >
            {adminText('scanStart')}
          </button>
        )}
        <button
          type="button"
          className="pc-admin-link"
          disabled={disabled || mode === 'reading'}
          onClick={openPhoto}
          data-testid="tracking-scan-photo"
        >
          {adminText('scanPhoto')}
        </button>
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        data-testid="tracking-scan-input"
        onChange={(e) => void onPhoto(e.target.files?.[0])}
      />
      {/* Immer im DOM (Stream wird vor dem nächsten Rendern angehängt), sichtbar nur beim Scannen. */}
      <video
        ref={videoRef}
        className="pc-scan__video"
        hidden={mode !== 'camera'}
        muted
        playsInline
        aria-label={adminText('scanVideoLabel')}
      />
      <p id={statusId} role="status" className="pc-order__muted" data-testid="tracking-scan-status">
        {status}
      </p>
    </div>
  )
}
