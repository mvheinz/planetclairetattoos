import type { BehaviorContext, Unmount } from './types'

// `data-behavior="reservation-countdown"` (DESIGN KO-15, MI-08; KONZEPT §4.6; PLAN P4.9): Restzeit der Reservierung auf
// Kasse (R07) und Korb (R06). Zeitbasis ist das serverseitige `displayExpiresAt` (`data-expires-at`) minus Client-
// Offset (einmal beim Binden aus `data-server-now` ermittelt); Takt `setInterval` 1 s (Playwright-Clock steuerbar).
// Nur Text- und Farbwechsel ohne Übergang (`data-level`: normal · warn ≤ 5:00 · last ≤ 1:00 · expired), keine
// Animation (AK-DS-11). Die Zeit steht in `role="timer"` mit `aria-live="off"`; eine getrennte `aria-live="polite"`-
// Region (`[data-countdown-announce]`) meldet nur 10, 5 und 1 min und den Ablauf. Bei 0 erscheint der Ablaufblock
// (`[data-countdown-expired]`: „Deine Reservierung ist abgelaufen.“ + „Nochmal reservieren“ + „Zum Korb“) und das
// Ereignis `pc:reservation-expired` am `document` sperrt den Bestellknopf. Im Modus `preview` läuft eine Demo ab 30:00.
//
// Markup (vom Server gerendert, Texte als Attribute):
// <div data-behavior="reservation-countdown" data-expires-at="ISO" data-server-now="ISO"
//      data-text-warn="…" data-text-last="…" data-announce-10="…" data-announce-5="…" data-announce-1="…"
//      data-announce-expired="…" [data-time-template="Noch {time} reserviert"]>
//   <p role="timer" aria-live="off" data-countdown-time>29:59</p>
//   <p data-countdown-text>Dein Stück ist für dich reserviert.</p>
//   <p aria-live="polite" data-countdown-announce></p>
//   <div data-countdown-expired hidden>…</div>
// </div>

export const RESERVATION_EXPIRED_EVENT = 'pc:reservation-expired'

export type CountdownLevel = 'normal' | 'warn' | 'last' | 'expired'

const SECOND = 1000
const MINUTE = 60 * SECOND
/** Demo in der Vorschau-Datei (KONZEPT §12.9): 30 Minuten ab dem Binden. */
export const PREVIEW_DEMO_MS = 30 * MINUTE

/** Schwelle der Farbe/des Satzes (≤ 5:00 warn, ≤ 1:00 last, ≤ 0 expired). */
export function countdownLevel(remainingMs: number): CountdownLevel {
  if (remainingMs <= 0) return 'expired'
  if (remainingMs <= MINUTE) return 'last'
  if (remainingMs <= 5 * MINUTE) return 'warn'
  return 'normal'
}

/** Ansage-Stufe (nur 10, 5, 1 min und Ablauf). */
export function announceStep(remainingMs: number): 10 | 5 | 1 | 0 | null {
  if (remainingMs <= 0) return 0
  if (remainingMs <= MINUTE) return 1
  if (remainingMs <= 5 * MINUTE) return 5
  if (remainingMs <= 10 * MINUTE) return 10
  return null
}

/** `mm:ss` (Sekunden aufgerundet, nie negativ). */
export function formatRemaining(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / SECOND))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  const doc = root.ownerDocument
  const el = root as HTMLElement
  const timeEl = el.querySelector<HTMLElement>('[data-countdown-time]')
  const textEl = el.querySelector<HTMLElement>('[data-countdown-text]')
  const announceEl = el.querySelector<HTMLElement>('[data-countdown-announce]')
  const expiredEl = el.querySelector<HTMLElement>('[data-countdown-expired]')
  const normalText = textEl?.textContent ?? ''
  const template = el.dataset.timeTemplate

  const mountedAt = Date.now()
  let expiresAt: number
  let offset = 0
  if (ctx.mode === 'preview') {
    expiresAt = mountedAt + PREVIEW_DEMO_MS
  } else {
    expiresAt = Date.parse(el.dataset.expiresAt ?? '')
    const serverNow = Date.parse(el.dataset.serverNow ?? '')
    // Client-Offset: Abstand der Browser-Uhr zur Serverzeit beim Laden (KO-15).
    if (Number.isFinite(serverNow)) offset = mountedAt - serverNow
  }
  if (!Number.isFinite(expiresAt)) return () => {}

  let lastLevel: CountdownLevel | null = null
  let lastStep: ReturnType<typeof announceStep> | undefined
  let timer: ReturnType<typeof setInterval> | null = null

  const remaining = () => expiresAt - (Date.now() - offset)

  const render = () => {
    const left = remaining()
    const level = countdownLevel(left)
    const time = formatRemaining(left)
    if (timeEl) timeEl.textContent = template ? template.replace('{time}', time) : time
    if (level !== lastLevel) {
      el.setAttribute('data-level', level)
      if (textEl) {
        textEl.textContent =
          level === 'warn'
            ? (el.dataset.textWarn ?? normalText)
            : level === 'last'
              ? (el.dataset.textLast ?? normalText)
              : level === 'expired'
                ? ''
                : normalText
        textEl.hidden = level === 'expired'
      }
      if (expiredEl) expiredEl.hidden = level !== 'expired'
      if (level === 'expired') {
        doc.dispatchEvent(new CustomEvent(RESERVATION_EXPIRED_EVENT))
        stop()
      }
    }
    const step = announceStep(left)
    // Nur beim Überschreiten einer Stufe ansagen (nicht beim ersten Binden).
    if (announceEl && lastStep !== undefined && step !== lastStep && step !== null) {
      const message = el.getAttribute(`data-announce-${step === 0 ? 'expired' : step}`)
      if (message) announceEl.textContent = message
    }
    lastStep = step
    lastLevel = level
  }

  const stop = () => {
    if (timer !== null) clearInterval(timer)
    timer = null
  }

  render()
  if (lastLevel !== 'expired') timer = setInterval(render, SECOND)

  return () => {
    stop()
  }
}
