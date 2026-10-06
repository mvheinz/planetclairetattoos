import 'server-only'

import { Encrypter } from 'age-encryption'

import { sha256Key, type MirrorArea, type MirrorStore, type SourceStore } from './stores'

// Datei-Spiegel (ARCHITEKTUR §10.4): inkrementell, je Objekt age-verschlüsselt, Spiegel-Schlüssel sind SHA-256-Hashes der
// Quell-Schlüssel (`files/<bereich>/<sha256>.age`, keine Dateinamen im Klartext, AK-A-10-02).
//
// Abweichung von §10.4 (Annahme in OFFENE-PUNKTE): Der Spiegelstand liegt **nicht** in `files/state.json.age`, denn die App
// kann ihre eigenen Backups nicht lesen (BK-2: privater Schlüssel nur offline). Der Stand ergibt sich stattdessen aus den
// Spiegel-Objekten selbst: „geändert“ = Quelle jünger als das Spiegel-Objekt; „fehlt“ = Marker-Objekt
// `files/<bereich>/<sha256>.missing` (Zeitpunkt des Markers = `missingSince`, höchstens 7 Tage bis zum Löschen).

export const MISSING_GRACE_MS = 7 * 24 * 60 * 60 * 1000
export const MIRROR_PREFIX = 'files'

export interface MirrorOptions {
  source: SourceStore
  mirror: MirrorStore
  recipient: string
  areas: readonly MirrorArea[]
  now: Date
  /** Zeitbudget; danach bleibt der Rest für den nächsten Lauf. */
  budgetMs: number
  /** Quell-Schlüssel, die nicht gesichert werden (Dateien mit `status = pending`, §10.4). */
  skipKeys?: ReadonlySet<string>
  /** Messuhr (Tests); Standard: `Date.now`. */
  clock?: () => number
}

export interface MirrorResult {
  copied: number
  deleted: number
  markedMissing: number
  skippedPending: number
  remaining: number
  bytes: number
}

const mirrorKey = (area: MirrorArea, hash: string) => `${MIRROR_PREFIX}/${area}/${hash}.age`
const markerKey = (area: MirrorArea, hash: string) => `${MIRROR_PREFIX}/${area}/${hash}.missing`

async function encryptBuffer(plain: Buffer, recipient: string): Promise<Buffer> {
  const enc = new Encrypter()
  enc.addRecipient(recipient)
  return Buffer.from(await enc.encrypt(new Uint8Array(plain)))
}

export async function runMirror(opts: MirrorOptions): Promise<MirrorResult> {
  const clock = opts.clock ?? Date.now
  const startedAt = clock()
  const result: MirrorResult = {
    copied: 0,
    deleted: 0,
    markedMissing: 0,
    skippedPending: 0,
    remaining: 0,
    bytes: 0,
  }
  const skip = opts.skipKeys ?? new Set<string>()

  for (const area of opts.areas) {
    const sources = await opts.source.list(area)
    const present = new Map<string, (typeof sources)[number]>() // hash → Quelle (ohne Pending)
    const keep = new Set<string>() // Hashes, die nie als „fehlend“ gelten (auch Pending)
    for (const o of sources) {
      const h = sha256Key(o.key)
      keep.add(h)
      if (skip.has(o.key)) {
        result.skippedPending++
        continue
      }
      present.set(h, o)
    }
    const mirrorObjs = await opts.mirror.list(`${MIRROR_PREFIX}/${area}/`)
    const copies = new Map<string, Date>()
    const markers = new Map<string, Date>()
    for (const o of mirrorObjs) {
      const base = o.key.slice(`${MIRROR_PREFIX}/${area}/`.length)
      if (base.endsWith('.age')) copies.set(base.slice(0, -4), o.lastModified)
      else if (base.endsWith('.missing')) markers.set(base.slice(0, -8), o.lastModified)
    }

    // Neue und geänderte Objekte kopieren, solange das Zeitbudget reicht.
    let outOfTime = false
    for (const [hash, src] of present) {
      const have = copies.get(hash)
      if (have && src.lastModified.getTime() <= have.getTime()) {
        if (markers.has(hash)) await opts.mirror.delete(markerKey(area, hash))
        continue
      }
      if (outOfTime || clock() - startedAt >= opts.budgetMs) {
        outOfTime = true
        result.remaining++
        continue
      }
      const cipher = await encryptBuffer(await opts.source.get(src.key), opts.recipient)
      await opts.mirror.put(mirrorKey(area, hash), cipher)
      result.copied++
      result.bytes += cipher.length
      if (markers.has(hash)) await opts.mirror.delete(markerKey(area, hash))
    }

    // Fehlende Quellen: Marker setzen; nach 7 Tagen Spiegel-Objekt und Marker löschen (Löschungen wirken, §10.1 BK-4).
    for (const hash of copies.keys()) {
      if (keep.has(hash)) continue
      const since = markers.get(hash)
      if (!since) {
        await opts.mirror.put(markerKey(area, hash), Buffer.alloc(0))
        result.markedMissing++
      } else if (opts.now.getTime() - since.getTime() >= MISSING_GRACE_MS) {
        await opts.mirror.delete(mirrorKey(area, hash))
        await opts.mirror.delete(markerKey(area, hash))
        result.deleted++
      }
    }
    // Verwaiste Marker (Kopie schon weg oder Quelle wieder da) aufräumen.
    for (const hash of markers.keys()) {
      if (!copies.has(hash) || keep.has(hash)) await opts.mirror.delete(markerKey(area, hash))
    }
  }
  return result
}
