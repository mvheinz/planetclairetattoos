// Query-Schalter der Kunst-Abnahme (KUNST-QA §3.1, P9.1): `?leash=off` (Seite ohne Engine = Grundlinie für
// Tempo-Vergleiche), `?freeze=1` (Boil aus, zeitbasierte Abläufe sofort im Endzustand) und `?qa-jank=<ms>` (künstliche
// Last je Frame, prüft die Laufzeit-Abstufung A → B). Sie wirken **nur** mit `ART_QA=1`: Der Server rendert dann
// `<meta name="pc-art-qa" content="1">` (SiteDocument); ohne diese Marke gibt `readQaSwitches` immer „aus“ zurück.
// Rein und framework-frei (auch in Unit-Tests ohne DOM nutzbar).

export const QA_META_NAME = 'pc-art-qa'
/** Obergrenze für `?qa-jank` (ms Busy-Loop je Frame). */
export const QA_JANK_MAX_MS = 200

export interface QaSwitches {
  /** `?leash=off`: weder Engine- noch Coco-Chunk laden. */
  leashOff: boolean
  /** `?freeze=1`: Boil aus, alle zeitbasierten Abläufe auf Endzustand. */
  freeze: boolean
  /** `?qa-jank=30`: Busy-Loop je Frame in ms (0 = aus). */
  jankMs: number
}

export const QA_SWITCHES_OFF: QaSwitches = Object.freeze({
  leashOff: false,
  freeze: false,
  jankMs: 0,
})

const isOn = (v: string | null) => v !== null && ['1', 'true', 'on'].includes(v.toLowerCase())
const isOff = (v: string | null) => v !== null && ['off', '0', 'false'].includes(v.toLowerCase())

/** Wertet die Query aus; `artQa` = QA-Modus aktiv (Server-Marke vorhanden). */
export function parseQaSwitches(search: string | URLSearchParams, artQa: boolean): QaSwitches {
  if (!artQa) return QA_SWITCHES_OFF
  const q = typeof search === 'string' ? new URLSearchParams(search) : search
  const jankRaw = Number.parseInt(q.get('qa-jank') ?? '', 10)
  const jankMs = Number.isFinite(jankRaw) ? Math.min(QA_JANK_MAX_MS, Math.max(0, jankRaw)) : 0
  return {
    leashOff: isOff(q.get('leash')),
    freeze: isOn(q.get('freeze')),
    jankMs,
  }
}

/** Ist die Server-Marke des QA-Modus im Dokument? */
export function artQaMarked(doc: Document): boolean {
  return doc.querySelector(`meta[name="${QA_META_NAME}"][content="1"]`) !== null
}

/** Schalter der aktuellen Seite (Browser). */
export function readQaSwitches(doc: Document = document): QaSwitches {
  const loc = doc.defaultView?.location
  if (!loc) return QA_SWITCHES_OFF
  return parseQaSwitches(loc.search, artQaMarked(doc))
}
