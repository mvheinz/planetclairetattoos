import { linePoints, rects, type Probe, type ProbeFile } from '../probe'
import { isCalmRoute, routeOf } from '../routes'
import { combine, noData, quantileOf, result, round, type CheckResult } from './common'

// Bewegung (MO), Lesbarkeit (LG), Tempo (PF), Barrierefreiheit (A11Y), Kontrast (CT) und Ruhezonen (RZ) – KUNST-QA
// §5.4–§5.8, §5.10 (PLAN P9.6). Grundlage sind die Sonden der Aufnahme (`probes.json`), die Tempo-Auswertung
// `metrics/perf.json` (P9.4), axe-Ergebnisse und Dateien des Repos. Rein.

export interface Entry {
  sc: string
  profile: string
  variant: string
  p: Probe
}

export function entries(
  files: readonly ProbeFile[],
  filter: Partial<Pick<Entry, 'sc' | 'profile' | 'variant'>> = {},
): Entry[] {
  return files
    .filter(
      (f) =>
        (!filter.sc || f.sc === filter.sc) &&
        (!filter.profile || f.profile === filter.profile) &&
        (!filter.variant || f.variant === filter.variant),
    )
    .flatMap((f) => f.probes.map((p) => ({ sc: f.sc, profile: f.profile, variant: f.variant, p })))
}

const where = (e: Entry) => `${e.sc}/${e.profile}/${e.variant} ${e.p.label}`
const extra = <T>(
  files: readonly ProbeFile[],
  key: string,
  filter: Partial<Pick<Entry, 'sc' | 'profile' | 'variant'>> = {},
) =>
  files
    .filter(
      (f) =>
        f.extra?.[key] !== undefined &&
        (!filter.sc || f.sc === filter.sc) &&
        (!filter.profile || f.profile === filter.profile) &&
        (!filter.variant || f.variant === filter.variant),
    )
    .map((f) => ({ file: f, value: f.extra![key] as T }))

// ---------- MO ----------

/** Bewegt sich wirklich: aktive Phase, Dauer > 1 ms (0-s-Übergänge zählen nicht), keine View-Transition-Pseudo-Animation
 * (die hält die Sequenz-Aufnahme per Seek fest; Übergänge prüft MO-14). */
export const moving = (a: Probe['anims'][number]) =>
  a.act && a.s !== 'finished' && (a.d ?? 0) > 1 && !(a.pe ?? '').startsWith('::view-transition')

/** Zulässige Dauern (ms): Token aus `tokens.css`, Boil-Zyklen (3 × Frame-Länge) und alle ms-Werte aus DESIGN §11.3/§11.5. */
export function allowedDurations(tokensCss: string, designMd: string): number[] {
  const out = new Set<number>()
  for (const m of tokensCss.matchAll(/--(?:dur|boil|run|sleep)-[\w-]*:\s*([\d.]+)ms/g)) {
    const v = Number(m[1])
    out.add(v)
    if (/frame/.test(m[0])) out.add(3 * v)
  }
  const start = designMd.indexOf('### 11.3')
  const end = designMd.indexOf('### 11.6')
  if (start >= 0) {
    const part = designMd.slice(start, end < 0 ? undefined : end)
    for (const m of part.matchAll(/(\d[\d.]*)\s*ms\b/g)) out.add(Number(m[1]))
    // Sekunden-Angaben („2,4 s“) ebenfalls als Token
    for (const m of part.matchAll(/(\d+(?:,\d+)?)\s*s\b/g))
      out.add(Math.round(Number(m[1]!.replace(',', '.')) * 1000))
  }
  return [...out].filter((v) => v > 0).sort((a, b) => a - b)
}

const MOTION_SCENARIOS = ['SC-01', 'SC-03', 'SC-04', 'SC-05', 'SC-08', 'SC-09', 'SC-10', 'SC-11']

export function mo01(files: readonly ProbeFile[], allowed: readonly number[]): CheckResult {
  const th = 'jede gemessene Animation = Token-Dauer (DESIGN §11.3/§11.5) ± 10 %'
  const seen = new Map<string, string>()
  let n = 0
  for (const e of entries(files).filter(
    (x) => x.variant === 'motion' && MOTION_SCENARIOS.includes(x.sc),
  ))
    for (const a of e.p.anims) {
      if (!a.d || a.d <= 0) continue
      n++
      const ok = allowed.some((v) => Math.abs(a.d! - v) <= 0.1 * v)
      if (!ok) seen.set(`${a.n}@${a.tg}`, `${a.n} (${a.tg}) ${a.d} ms – ${where(e)}`)
    }
  if (n === 0) return noData('MO-01', th, 'keine Animationen in den Sonden (Variante motion)')
  return result('MO-01', seen.size === 0, `${n} Messungen, ${seen.size} abweichend`, th, [
    ...seen.values(),
  ])
}

const norm = (e: string) => e.replace(/\s+/g, '').toLowerCase()
const bezierKey = (e: string) => {
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(norm(e))
  return m
    ? m[1]!
        .split(',')
        .map((v) => round(Number(v), 2))
        .join(',')
    : null
}

/** Easing-Token aus `tokens.css` (DESIGN §11.2). */
export function allowedEasings(tokensCss: string): string[] {
  return [...tokensCss.matchAll(/--ease-[\w-]+:\s*(cubic-bezier\([^)]+\))/g)].map((m) =>
    bezierKey(m[1]!)!,
  )
}

export function easingAllowed(e: string, tokens: readonly string[]): boolean {
  const n = norm(e)
  if (n === 'linear' || n.startsWith('steps(') || n === 'step-end' || n === 'step-start')
    return true
  if (/^ease(-in|-out|-in-out)?$/.test(n)) return false
  const k = bezierKey(n)
  return k !== null && tokens.includes(k)
}

export function mo02(files: readonly ProbeFile[], tokens: readonly string[]): CheckResult {
  const th = 'nur Kurven aus DESIGN §11.2 (Token), linear oder steps(); kein ease*'
  const bad = new Map<string, string>()
  let n = 0
  for (const e of entries(files).filter((x) => x.variant === 'motion'))
    for (const a of e.p.anims) {
      n++
      for (const ease of [a.e, ...a.ke])
        if (!easingAllowed(ease, tokens))
          bad.set(`${a.n}@${a.tg}@${ease}`, `${a.n} (${a.tg}): ${ease} – ${where(e)}`)
    }
  if (n === 0) return noData('MO-02', th, 'keine Animationen in den Sonden (Variante motion)')
  return result('MO-02', bad.size === 0, `${n} Animationen, ${bad.size} mit fremder Kurve`, th, [
    ...bad.values(),
  ])
}

/** MO-03: Boil-Takt aus `coco.css`/`tokens.css` und Reihenfolge der Frames (Verzögerungen) – statisch. */
export function mo03(
  cocoCss: string,
  tokensCss: string,
  fps: readonly { id: string; pose: string; fps?: number }[],
): CheckResult {
  const th =
    'Frame-Länge 83–125 ms (8–12 fps); rennen/springen 12 fps, schlafen 8 fps; Seek 0/1/2 → Frame a/b/c'
  const bad: string[] = []
  const tok = (name: string) => {
    const m = new RegExp(`--${name}:\\s*([\\d.]+)ms`).exec(`${tokensCss}\n${cocoCss}`)
    return m ? Number(m[1]) : null
  }
  const frames = { boil: tok('boil-frame'), run: tok('run-frame'), sleep: tok('sleep-frame') }
  for (const [k, v] of Object.entries(frames))
    if (v === null || v < 83 || v > 125) bad.push(`--${k}-frame ${v ?? 'fehlt'} ms`)
  if (!/\[data-pose='rennen'\][\s\S]*?--boil-frame:\s*var\(--run-frame\)/.test(cocoCss))
    bad.push('rennen nicht auf --run-frame')
  if (!/\[data-pose='springen'\]/.test(cocoCss)) bad.push('springen nicht auf --run-frame')
  if (!/\[data-pose='schlafen'\]\s*\{\s*--boil-frame:\s*var\(--sleep-frame\)/.test(cocoCss))
    bad.push('schlafen nicht auf --sleep-frame')
  for (const s of fps) {
    const want = s.pose === 'schlafen' ? 8 : ['rennen', 'springen'].includes(s.pose) ? 12 : null
    if (want !== null && s.fps !== want) bad.push(`${s.id}: ${s.fps} fps statt ${want}`)
  }
  // Reihenfolge: sichtbar ist der Frame, dessen Zyklus-Phase bei 0 liegt (Keyframe 0–33 % deckend).
  const delay = (f: string) => {
    const m = new RegExp(
      `\\.f-${f}\\s*\\{[^}]*animation-delay:\\s*calc\\(var\\(--boil-frame\\)\\s*\\*\\s*(-?[\\d.]+)\\)`,
    ).exec(cocoCss)
    return m ? Number(m[1]) : 0
  }
  const order: string[] = []
  for (let k = 0; k < 3; k++)
    order.push(['a', 'b', 'c'].find((f) => (((k - delay(f)) % 3) + 3) % 3 === 0) ?? '?')
  if (order.join('') !== 'abc') bad.push(`Seek 0/1/2 zeigt ${order.join('/')}`)
  return result(
    'MO-03',
    bad.length === 0,
    `Frame ${frames.boil}/${frames.run}/${frames.sleep} ms, Folge ${order.join('→')}`,
    th,
    bad,
  )
}

/** MO-04: In Zeitsequenzen ohne Nutzeraktion läuft nach 5 s nichts mehr (Boil aus, keine aktive Animation). */
export function mo04(files: readonly ProbeFile[]): CheckResult {
  const th =
    'nach 5 s ohne Nutzereingabe: kein Boil, kein Atmen, kein Ablauf aktiv (SC-09/SC-10, Sequenzen bis 6 s)'
  const late = entries(files).filter(
    (e) => e.variant === 'motion' && e.p.t !== null && ['SC-09', 'SC-10'].includes(e.sc),
  )
  if (!late.some((e) => e.p.t! > 5100))
    return noData('MO-04', th, 'keine Sequenz-Sonden über 5 s (SC-09, SC-10)')
  const bad: string[] = []
  for (const e of late.filter((x) => x.p.t! > 5100)) {
    if (e.p.coco?.boil === 'on') bad.push(`${where(e)}: Boil an`)
    const act = e.p.anims.filter(moving)
    if (act.length)
      bad.push(
        `${where(e)}: ${act.length} aktiv (${[...new Set(act.map((a) => a.n))].slice(0, 3).join(', ')})`,
      )
  }
  return result(
    'MO-04',
    bad.length === 0,
    `${late.filter((x) => x.p.t! > 5100).length} Sonden nach 5 s, ${bad.length} aktiv`,
    th,
    bad,
  )
}

/** MO-05/MO-06 aus der Lesezeilen-Reihe `mo05-NN` und `mo06-up400` (SC-01, frische Seite). */
export function mo05(files: readonly ProbeFile[]): CheckResult {
  const th =
    'an 12 Scroll-Positionen drawnLen = map(readingY) ± 1 px nach 2 Frames (Tinte bleibt: max. mit dem bisher Gezeichneten)'
  const bad: string[] = []
  let n = 0
  let worst = 0
  for (const f of files.filter((x) => x.sc === 'SC-01' && x.variant === 'motion')) {
    const rows = f.probes.filter((p) => /^mo05-/.test(p.label) && p.leash)
    let prev: number | null = null
    for (const p of rows) {
      const l = p.leash!
      n++
      // Erste Position: mindestens map(readingY) (Intro/Einstieg kann schon weiter gezeichnet haben).
      const want = prev === null ? l.mapped : Math.max(l.mapped, prev)
      const dev = prev === null ? Math.max(0, l.mapped - l.drawnLen) : Math.abs(l.drawnLen - want)
      worst = Math.max(worst, dev)
      if (dev > 1)
        bad.push(
          `${f.profile} ${p.label}: drawnLen ${l.drawnLen} vs. ${round(want, 1)} (map ${l.mapped})`,
        )
      prev = l.drawnLen
    }
  }
  if (n < 12) return noData('MO-05', th, `nur ${n} Lesezeilen-Sonden (SC-01 mo05-*)`)
  return result(
    'MO-05',
    bad.length === 0,
    `${n} Positionen, max. Abweichung ${round(worst, 2)} px`,
    th,
    bad,
  )
}

export function mo06(files: readonly ProbeFile[]): CheckResult {
  const th = '400 px hoch: drawnLen unverändert (Coco gespiegelt: R2)'
  const bad: string[] = []
  let n = 0
  for (const f of files.filter((x) => x.sc === 'SC-01' && x.variant === 'motion')) {
    const rows = f.probes.filter((p) => /^mo05-/.test(p.label) && p.leash)
    const up = f.probes.find((p) => p.label === 'mo06-up400' && p.leash)
    const before = rows[rows.length - 1]
    if (!up || !before) continue
    n++
    if (Math.abs(up.leash!.drawnLen - before.leash!.drawnLen) > 1)
      bad.push(`${f.profile}: ${before.leash!.drawnLen} → ${up.leash!.drawnLen}`)
  }
  if (!n) return noData('MO-06', th, 'keine Sonde mo06-up400 (SC-01)')
  return result('MO-06', bad.length === 0, `${n} Profile`, th, bad)
}

export function mo07(files: readonly ProbeFile[]): CheckResult {
  const th = 'nach Scrollstopp ≤ 400 ms bis Abstand < 1 px; beim Wischen nie > 300 px Rückstand'
  const runs = extra<{ t: number; coco: number; drawn: number; scrolling: boolean }[]>(
    files,
    'mo07',
    { sc: 'SC-01' },
  )
  if (!runs.length) return noData('MO-07', th, 'keine Folge-Messung (SC-01 extra.mo07)')
  const bad: string[] = []
  const vals: string[] = []
  for (const { file, value } of runs) {
    if (!value.length) continue
    const lag = Math.max(...value.filter((s) => s.scrolling).map((s) => s.drawn - s.coco), 0)
    const stop = value.filter((s) => s.scrolling).at(-1)?.t ?? 0
    const final = value.at(-1)!.coco
    let settle = 0
    for (const s of value) if (s.t > stop && Math.abs(s.coco - final) >= 1) settle = s.t - stop
    vals.push(`${file.profile} Rückstand ${round(lag, 0)} px, Nachlauf ${settle} ms`)
    if (lag > 300) bad.push(`${file.profile}: Rückstand ${round(lag, 0)} px`)
    if (settle > 400) bad.push(`${file.profile}: Nachlauf ${settle} ms`)
  }
  return result('MO-07', bad.length === 0, vals.join('; '), th, bad)
}

/** Zusätzliche erlaubte Posen beim Verweilen je Station (DESIGN §11.4, `DWELL` in `src/leash/coco.ts`). */
const STATION_POSES: Readonly<Record<string, readonly string[]>> = {
  'planet-claire': ['sitzen', 'kopfschief'],
  textil: ['schnueffeln', 'kopfschief'],
  schmuck: ['springen', 'sitzen'],
}

export function mo08(files: readonly ProbeFile[]): CheckResult {
  const th = 'Pose beim Verweilen = Tabelle DESIGN §11.4 an allen Stationen'
  const rows = entries(files, { sc: 'SC-01', variant: 'motion' }).filter(
    (e) => /^station\d+-stay/.test(e.p.label) && e.p.leash,
  )
  if (!rows.length) return noData('MO-08', th, 'keine Verweil-Sonden (SC-01 station*-stay1500)')
  const bad: string[] = []
  for (const e of rows) {
    const i = Number(/^station(\d+)/.exec(e.p.label)![1]) - 1
    const st = e.p.leash!.stations[i]
    // Tabelle §11.4: Ankunft → Verweilen; Schmuck endet nach dem Sprung sitzend, Kopf-Station/Textil wechseln nach 1,2/1,5 s
    const allowed = new Set<string>([st?.pose ?? '', ...(st ? (STATION_POSES[st.id] ?? []) : [])])
    if (st && !allowed.has(e.p.leash!.pose ?? ''))
      bad.push(`${where(e)}: ${e.p.leash!.pose} statt ${[...allowed].filter(Boolean).join(' / ')}`)
  }
  return result('MO-08', bad.length === 0, `${rows.length} Verweil-Sonden`, th, bad)
}

/** Brücke laut DESIGN §10.4 (Tabelle „Brücken-Frames“); null = direkter Schnitt. */
export function expectedBridge(from: string, to: string): string | null {
  if (to === 'springen' && from !== 'springen') return 'abspringen'
  if (['rennen', 'springen'].includes(from) && ['schnueffeln', 'sitzen', 'kopfschief'].includes(to))
    return 'bremsen' // nach dem Sprung der Station Schmuck ebenfalls (DESIGN §11.4)
  if (['sitzen', 'schnueffeln'].includes(from) && to === 'rennen') return 'abspringen'
  if (from === 'sitzen' && to === 'schlafen') return 'einrollen-1+einrollen-2'
  return null
}

export function mo09(files: readonly ProbeFile[]): CheckResult {
  const th = 'jeder Posenwechsel mit der definierten Brücke (DESIGN §10.4) bzw. an der Frame-Grenze'
  const logs = files
    .filter((f) => f.variant === 'motion')
    .map((f) => ({ f, log: f.probes.at(-1)?.poseLog ?? [] }))
    .filter((x) => x.log.length)
  if (!logs.length) return noData('MO-09', th, 'kein poseLog in den Sonden')
  const bad: string[] = []
  let n = 0
  for (const { f, log } of logs)
    for (const e of log) {
      if (!e.from || e.from === e.to) continue
      n++
      const want = expectedBridge(e.from, e.to)
      if ((e.bridge ?? null) !== want)
        bad.push(
          `${f.sc}/${f.profile}: ${e.from} → ${e.to} mit ${e.bridge ?? 'Schnitt'} statt ${want ?? 'Schnitt'}`,
        )
    }
  return result('MO-09', bad.length === 0, `${n} Wechsel`, th, [...new Set(bad)])
}

export function mo10(files: readonly ProbeFile[]): CheckResult {
  const th = 'Start ≥ LCP + 300 ms; Dauer 900 ms ± 90'
  const runs = extra<{ lcp: number | null; start: number | null; end: number | null }>(
    files,
    'mo10',
    { sc: 'SC-01' },
  )
  if (!runs.length) return noData('MO-10', th, 'keine Intro-Messung (SC-01 extra.mo10)')
  const bad: string[] = []
  const vals: string[] = []
  for (const { file, value } of runs) {
    const { lcp, start, end } = value
    const dur = start !== null && end !== null ? end - start : null
    vals.push(
      `${file.profile} LCP ${lcp ?? '?'} ms, Start ${start ?? '?'} ms, Dauer ${dur ?? '?'} ms`,
    )
    if (start === null || dur === null) bad.push(`${file.profile}: Intro nicht gemessen`)
    else {
      if (lcp !== null && start < lcp + 300)
        bad.push(`${file.profile}: Start ${start} ms < LCP ${lcp} + 300`)
      if (Math.abs(dur - 900) > 90) bad.push(`${file.profile}: Dauer ${dur} ms`)
    }
  }
  return result('MO-10', bad.length === 0, vals.join('; '), th, bad)
}

const isStamp = (n: string, tg: string) => /stamp/i.test(n) || /stamp/i.test(tg)

export function mo13(files: readonly ProbeFile[]): CheckResult {
  const th = 'Archiv/Shop: 0 Stempel-Animationen; Danke „bezahlt“: MI-03 ≤ 3×'
  const shop = entries(files, { sc: 'SC-04' })
  const paid = entries(files, { sc: 'SC-09', variant: 'motion' }).filter((e) =>
    /^paid/.test(e.p.label),
  )
  if (!shop.length && !paid.length) return noData('MO-13', th, 'keine Sonden SC-04/SC-09')
  const bad: string[] = []
  const shopStamps = shop.flatMap((e) =>
    e.p.anims.filter((a) => isStamp(a.n, a.tg)).map((a) => `${where(e)}: ${a.n}`),
  )
  bad.push(...shopStamps)
  const paidTargets = new Set(
    paid.flatMap((e) => e.p.anims.filter((a) => isStamp(a.n, a.tg)).map((a) => `${a.n}@${a.tg}`)),
  )
  if (paidTargets.size > 3) bad.push(`Danke bezahlt: ${paidTargets.size} Stempel`)
  return result(
    'MO-13',
    bad.length === 0,
    `Shop/Archiv ${shopStamps.length}, bezahlt ${paidTargets.size}`,
    th,
    bad,
  )
}

export function mo14(files: readonly ProbeFile[]): CheckResult {
  const th = 'Seitenübergang 350 ms ± 35; keine Übergänge von/zu calm-Routen'
  const rows = entries(files, { sc: 'SC-11', variant: 'motion' })
  if (!rows.length) return noData('MO-14', th, 'keine Sonden SC-11')
  const bad: string[] = []
  let n = 0
  for (const e of rows)
    for (const a of e.p.anims.filter((x) => (x.pe ?? '').startsWith('::view-transition'))) {
      n++
      if (/^r04-r06/.test(e.p.label) || isCalmRoute(e.p.url))
        bad.push(`${where(e)}: Übergang zur Ruhe-Route`)
      else if (a.d === null || Math.abs(a.d - 350) > 35) bad.push(`${where(e)}: ${a.pe} ${a.d} ms`)
    }
  return result('MO-14', bad.length === 0, `${n} Übergangs-Animationen gemessen`, th, [
    ...new Set(bad),
  ])
}

/** Relative Leuchtdichte (WCAG) eines sRGB-Pixels. */
export function relLum(r: number, g: number, b: number): number {
  const f = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export interface Sequence {
  label: string
  /** Zeitpunkte (ms) der Bilder */
  t: number[]
  /** Leuchtdichte je Bild (gleich groß, verkleinert) */
  lum: Float32Array[]
  /** Anteil der Bildfläche, der dem WCAG-Flächenmaß entspricht (341 × 256 px bei 1024 × 768) */
  areaFrac: number
}

/** WCAG-Blitze: gegenläufige Leuchtdichte-Wechsel ≥ 10 % (dunklerer Zustand < 0,80) über ≥ `areaFrac` der Fläche. */
export function flashesPerSecond(seq: Sequence): number {
  const events: { t: number; dir: 1 | -1 }[] = []
  for (let i = 1; i < seq.lum.length; i++) {
    const a = seq.lum[i - 1]!
    const b = seq.lum[i]!
    let up = 0
    let down = 0
    for (let k = 0; k < a.length; k++) {
      const d = b[k]! - a[k]!
      if (Math.abs(d) < 0.1 || Math.min(a[k]!, b[k]!) >= 0.8) continue
      if (d > 0) up++
      else down++
    }
    const n = a.length
    if (up / n >= seq.areaFrac) events.push({ t: seq.t[i]!, dir: 1 })
    if (down / n >= seq.areaFrac) events.push({ t: seq.t[i]!, dir: -1 })
  }
  let best = 0
  for (let i = 0; i < events.length; i++) {
    let flips = 0
    let last = 0
    for (let j = i; j < events.length && events[j]!.t - events[i]!.t < 1000; j++) {
      if (events[j]!.dir !== last) flips++
      last = events[j]!.dir
    }
    best = Math.max(best, Math.floor(flips / 2))
  }
  return best
}

export function mo15(seqs: readonly Sequence[]): CheckResult {
  const th = 'kein Element blinkt > 3× pro Sekunde (WCAG-Blitze in SC-01/03/09/10)'
  if (!seqs.length) return noData('MO-15', th, 'keine Bildsequenzen')
  const bad: string[] = []
  let worst = 0
  for (const s of seqs) {
    const f = flashesPerSecond(s)
    worst = Math.max(worst, f)
    if (f > 3) bad.push(`${s.label}: ${f} Blitze/s`)
  }
  return result(
    'MO-15',
    bad.length === 0,
    `${seqs.length} Sequenzen, max. ${worst} Blitze/s`,
    th,
    bad,
  )
}

// ---------- LG ----------

type R = { x: number; y: number; w: number; h: number }

/** LG-01: Überdeckungen von Linie (Punkte ± halbe Breite) und Coco-Box mit Textzeilen und Bedienelementen. */
export function overlaps(p: Probe, tol = 1): string[] {
  const occ = p.occTop ?? 0
  const obstacles: R[] = [...rects(p.text), ...rects(p.ctrl)]
    .map((r) => ({ x: r.x + tol, y: r.y + tol, w: r.w - 2 * tol, h: r.h - 2 * tol }))
    .map((r) => {
      // Teil unter einem festen Kopfbereich ist nicht sichtbar
      const top = Math.max(r.y, occ)
      return { ...r, y: top, h: r.y + r.h - top }
    })
    .filter((r) => r.w > 0 && r.h > 0)
  const out: string[] = []
  if (p.leash) {
    const hw = p.leash.halfW
    for (const q of linePoints(p.leash.pts).filter((x) => x.y >= occ))
      for (const r of obstacles) {
        const dx = Math.max(r.x - q.x, 0, q.x - (r.x + r.w))
        const dy = Math.max(r.y - q.y, 0, q.y - (r.y + r.h))
        if (dx * dx + dy * dy < hw * hw) {
          out.push(`Linie bei (${Math.round(q.x)}, ${Math.round(q.y)}) s=${Math.round(q.len)}`)
          break
        }
      }
  }
  if (p.coco)
    for (const r of obstacles) {
      const ix = Math.min(p.coco.x + p.coco.w, r.x + r.w) - Math.max(p.coco.x, r.x)
      const iy = Math.min(p.coco.y + p.coco.h, r.y + r.h) - Math.max(p.coco.y, r.y)
      if (ix > 0 && iy > 0) {
        out.push(
          `Coco-Box über (${Math.round(r.x)}, ${Math.round(r.y)}, ${Math.round(r.w)}×${Math.round(r.h)})`,
        )
        break
      }
    }
  return out
}

export const LG01_SCENARIOS = ['SC-01', 'SC-04', 'SC-05', 'SC-08', 'SC-09', 'SC-10']

export function lg01(files: readonly ProbeFile[]): CheckResult {
  const th =
    'Schnittmenge (Linie ± halbe Breite ∪ Coco-Box) mit Textzeilen und Bedienelementen = leer (SC-01/04/05/08/09/10)'
  const rows = entries(files).filter((e) => LG01_SCENARIOS.includes(e.sc))
  if (!rows.length) return noData('LG-01', th, 'keine Sonden in SC-01/04/05/08/09/10')
  const bad: string[] = []
  for (const e of rows) {
    const o = overlaps(e.p)
    if (o.length) bad.push(`${where(e)}: ${o[0]}${o.length > 1 ? ` (+${o.length - 1})` : ''}`)
  }
  return result(
    'LG-01',
    bad.length === 0,
    `${rows.length} Sonden, ${bad.length} mit Überdeckung`,
    th,
    bad,
  )
}

export function lg02(files: readonly ProbeFile[]): CheckResult {
  const th =
    'AK-DS-09: „Vertrag widerrufen“ sichtbar, ≥ 44 px hoch, elementFromPoint trifft den Link (mit/ohne reduzierte Bewegung)'
  const rows = entries(files).filter((e) => e.p.withdraw)
  if (!rows.length) return noData('LG-02', th, 'Link nie im Bild (SC-00 bottom)')
  const variants = new Set(rows.map((r) => r.variant))
  const bad = rows
    .filter((e) => e.p.withdraw!.h < 44 || !e.p.withdraw!.hit)
    .map(
      (e) => `${where(e)}: Höhe ${e.p.withdraw!.h} px, ${e.p.withdraw!.hit ? 'frei' : 'verdeckt'}`,
    )
  if (!variants.has('motion') || !variants.has('reduced'))
    bad.push('nicht in beiden Varianten gemessen')
  return result('LG-02', bad.length === 0, `${rows.length} Messungen`, th, bad)
}

const MANSALVA_ROLES = ['h1', 'h2', 'price', 'stamp', 'menu', 'badge']

export function lg03(files: readonly ProbeFile[]): CheckResult {
  const th = 'Mansalva nur in erlaubten Rollen (DESIGN §4.3; Ruhe-Routen nur H1), nie < 24 px'
  const rows = entries(files)
  if (!rows.length) return noData('LG-03', th, 'keine Sonden')
  const bad = new Set<string>()
  let n = 0
  for (const e of rows) {
    const calm = isCalmRoute(e.p.url)
    for (const m of e.p.mansalva) {
      n++
      const route = routeOf(e.p.url)?.id ?? e.p.url
      if (m.size < 24) bad.add(`${route}: <${m.tag}> ${m.size} px`)
      if (!MANSALVA_ROLES.includes(m.role)) bad.add(`${route}: <${m.tag}> Rolle ${m.role}`)
      else if (calm && m.role !== 'h1')
        bad.add(`${route}: <${m.tag}> Rolle ${m.role} auf Ruhe-Route`)
    }
  }
  return result('LG-03', bad.size === 0, `${n} Mansalva-Elemente`, th, [...bad])
}

export function lg04(files: readonly ProbeFile[]): CheckResult {
  const th = 'fontSize 32px bei 390 px: kein horizontales Scrollen, LG-01 leer, Linie neu aufgebaut'
  const rows = entries(files, { sc: 'SC-15' }).filter((e) => /^font200/.test(e.p.label))
  const ext = extra<{ rebuildBefore: number | null; rebuildAfter: number | null }>(files, 'lg04', {
    sc: 'SC-15',
  })
  if (!rows.length || !ext.length) return noData('LG-04', th, 'keine Sonden font200-* (SC-15)')
  const bad: string[] = []
  for (const e of rows) {
    if (e.p.scrollW > e.p.clientW + 1)
      bad.push(`${where(e)}: horizontal ${e.p.scrollW} > ${e.p.clientW}`)
    const o = overlaps(e.p)
    if (o.length) bad.push(`${where(e)}: ${o[0]}${o.length > 1 ? ` (+${o.length - 1})` : ''}`)
  }
  for (const { file, value } of ext)
    if (
      value.rebuildBefore === null ||
      value.rebuildAfter === null ||
      value.rebuildAfter <= value.rebuildBefore
    )
      bad.push(`${file.variant}: kein Neuaufbau (${value.rebuildBefore} → ${value.rebuildAfter})`)
  return result('LG-04', bad.length === 0, `${rows.length} Sonden`, th, bad)
}

// ---------- PF ----------

export interface PerfGate {
  id: string
  route: string
  pass: boolean
  value: number | null
  limit: string
}
export interface PerfJson {
  gates: PerfGate[]
  host?: { reliable: boolean | null; load1Max: number | null; cpus: number | null }
}

/** PF-01…PF-08 aus `metrics/perf.json` (P9.4), je Kriterium über alle Routen. */
export function perfFromGates(id: string, perf: PerfJson | null, threshold: string): CheckResult {
  if (!perf) return noData(id, threshold, 'metrics/perf.json fehlt (pnpm art:metrics nach SC-18)')
  const gates = perf.gates.filter(
    (g) => g.id === id || (g.id.startsWith(id) && /^[a-z]$/.test(g.id.slice(id.length))),
  )
  if (!gates.length) return noData(id, threshold, 'Gate fehlt in perf.json')
  const bad = gates.filter((g) => !g.pass).map((g) => `${g.route} ${g.id}: ${g.value} (${g.limit})`)
  const host =
    perf.host?.reliable === false
      ? ` – Messung unter Last (max. ${perf.host.load1Max}/${perf.host.cpus})`
      : ''
  return result(
    id,
    bad.length === 0,
    `${gates.map((g) => `${g.route}${g.id.slice(id.length)} ${g.value ?? '–'}`).join(', ')}${host}`,
    threshold,
    bad,
  )
}

/** Desktop 1×: Zusatzmessung ohne Playwright-Uhr (SC-00 extra.desktopMeasures), sonst die Sonden. */
const desktopMeasures = (files: readonly ProbeFile[]): { build: number[]; frame: number[] }[] => {
  const ext = extra<{ build: number[]; frame: number[] }>(files, 'desktopMeasures', {
    sc: 'SC-00',
    profile: 'art-desktop',
  })
  if (ext.length) return ext.map((x) => x.value)
  return entries(files, { sc: 'SC-00', profile: 'art-desktop', variant: 'motion' }).map(
    (e) => e.p.measures,
  )
}

export function pf03(perf: PerfJson | null, files: readonly ProbeFile[]): CheckResult {
  const th = 'leash:frame p95 ≤ 6 ms (4×), ≤ 2 ms (Desktop 1×)'
  const mobile = perfFromGates('PF-03', perf, th)
  const frames = desktopMeasures(files).flatMap((m) => m.frame)
  const desk = frames.length
    ? result(
        'PF-03',
        quantileOf(frames, 0.95) <= 2,
        `Desktop p95 ${round(quantileOf(frames, 0.95), 2)} ms`,
        th,
        quantileOf(frames, 0.95) <= 2 ? [] : ['Desktop über 2 ms'],
      )
    : noData('PF-03', th, 'Desktop: keine leash:frame-Messung (SC-00 art-desktop)')
  return { ...combine('PF-03', th, [mobile, desk]) }
}

export function pf04(perf: PerfJson | null, files: readonly ProbeFile[]): CheckResult {
  const th = 'leash:build ≤ 8 ms (Desktop 1×); bei 4× kein Teilstück > 50 ms'
  const mobile = perfFromGates('PF-04', perf, th)
  const builds = desktopMeasures(files).flatMap((m) => m.build)
  const max = builds.length ? Math.max(...builds) : null
  const desk =
    max === null
      ? noData('PF-04', th, 'Desktop: keine leash:build-Messung (SC-00 art-desktop)')
      : result(
          'PF-04',
          max <= 8,
          `Desktop max. ${round(max, 2)} ms`,
          th,
          max <= 8 ? [] : [`Desktop ${round(max, 2)} ms`],
        )
  return combine('PF-04', th, [mobile, desk])
}

export interface ModuleSize {
  name: string
  gzipBytes: number
  gzipMax: number
}

export function pf09(modules: readonly ModuleSize[] | null, gsapFound: string[]): CheckResult {
  const th =
    'gz: Engine ≤ 12 KB, Coco ≤ 3 KB, Mikro ≤ 4 KB, statischer Renderer ≤ 4 KB; kein GSAP (Erstlade-Bundle: check:bundle)'
  if (!modules) return noData('PF-09', th, 'Modulgrößen nicht gemessen')
  const bad = modules
    .filter((m) => m.gzipBytes > m.gzipMax)
    .map((m) => `${m.name}: ${m.gzipBytes} B > ${m.gzipMax} B`)
  for (const g of gsapFound) bad.push(`GSAP gefunden: ${g}`)
  return result(
    'PF-09',
    bad.length === 0,
    modules.map((m) => `${m.name.split(' ')[0]} ${m.gzipBytes} B`).join(', '),
    th,
    bad,
  )
}

export function pf10(
  sprite: { raw: number; gz: number } | null,
  files: readonly ProbeFile[],
): CheckResult {
  const th =
    'Sprite ≤ 45 KB roh/≤ 12 KB gz; Startseite SVG gesamt ≤ 60 KB roh; Pfaddaten im DOM ≤ 60 KB'
  const bad: string[] = []
  if (!sprite) bad.push('Sprite fehlt')
  else {
    if (sprite.raw > 45_000) bad.push(`Sprite roh ${sprite.raw} B`)
    if (sprite.gz > 12_000) bad.push(`Sprite gz ${sprite.gz} B`)
  }
  const rows = entries(files)
  const home = rows.filter((e) => routeOf(e.p.url)?.id === 'R01')
  const homeMax = home.length ? Math.max(...home.map((e) => e.p.svg.bytes)) : null
  const pathMax = rows.length ? Math.max(...rows.map((e) => e.p.svg.pathBytes)) : null
  if (homeMax === null) bad.push('Startseite nicht gemessen')
  else if (homeMax > 60_000) bad.push(`Startseite SVG ${homeMax} B`)
  if (pathMax !== null && pathMax > 60_000) bad.push(`Pfaddaten ${pathMax} B`)
  return result(
    'PF-10',
    bad.length === 0,
    `Sprite ${sprite?.raw ?? '?'}/${sprite?.gz ?? '?'} B, Startseite ${homeMax ?? '?'} B, Pfade max. ${pathMax ?? '?'} B`,
    th,
    bad,
  )
}

export function pf11(files: readonly ProbeFile[]): CheckResult {
  const th = 'Tab verborgen: 0 Engine-Frames über 2 s'
  const ext = extra<{ hiddenFrames: number }>(files, 'pf11', { sc: 'SC-15' })
  if (!ext.length) return noData('PF-11', th, 'keine Messung (SC-15 extra.pf11)')
  const n = Math.max(...ext.map((x) => x.value.hiddenFrames))
  return result(
    'PF-11',
    n === 0,
    `${n} Frames`,
    th,
    n === 0 ? [] : [`${n} leash:frame bei verborgenem Tab`],
  )
}

export function pf12(files: readonly ProbeFile[]): CheckResult {
  const th = '?qa-jank=30 schaltet Stufe A → B innerhalb von 2 s Scrollen'
  const ext = extra<{ before: string | null; after: string | null }>(files, 'pf12', { sc: 'SC-15' })
  if (!ext.length) return noData('PF-12', th, 'keine Messung (SC-15 extra.pf12)')
  const bad = ext
    .filter((x) => x.value.before !== 'A' || x.value.after !== 'B')
    .map((x) => `${x.value.before} → ${x.value.after}`)
  return result(
    'PF-12',
    bad.length === 0,
    ext.map((x) => `${x.value.before} → ${x.value.after}`).join(', '),
    th,
    bad,
  )
}

// ---------- A11Y ----------

export function a11y01(
  files: readonly ProbeFile[],
  timeCompare: readonly { profile: string; identical: boolean }[],
): CheckResult {
  const th =
    'reduced: Linie vollständig, keine laufende Animation (AK-DS-14) auf allen Szenario-Routen; t=0 und t=2 s pixelgleich'
  const rows = entries(files, { variant: 'reduced' })
  if (!rows.length) return noData('A11Y-01', th, 'keine Sonden in Variante reduced')
  const bad = new Set<string>()
  for (const e of rows) {
    if (e.p.leash && e.p.leash.drawnLen < e.p.leash.total - 1)
      bad.add(
        `${e.sc} ${routeOf(e.p.url)?.id ?? e.p.url}: Linie ${e.p.leash.drawnLen}/${e.p.leash.total}`,
      )
    for (const a of e.p.anims.filter(moving))
      bad.add(`${e.sc} ${routeOf(e.p.url)?.id ?? e.p.url}: ${a.n} (${a.tg})`)
  }
  if (!timeCompare.length) bad.add('SC-02 Zeitvergleich fehlt')
  for (const t of timeCompare) if (!t.identical) bad.add(`SC-02 ${t.profile}: t=0 ≠ t=2 s`)
  return result(
    'A11Y-01',
    bad.size === 0,
    `${rows.length} Sonden, ${timeCompare.length} Zeitvergleiche`,
    th,
    [...bad],
  )
}

export function a11y02(files: readonly ProbeFile[]): CheckResult {
  const th =
    'Schalter „Animationen“: data-motion="reduced" wirkt wie A11Y-01; vor dem Klick 0 Speicher-Einträge'
  const fs = files.filter((f) => f.sc === 'SC-00' && f.variant === 'motion')
  const bad: string[] = []
  let n = 0
  for (const f of fs) {
    const before = f.probes.find((p) => p.label === 'toggle-before')
    const after = f.probes.find((p) => p.label === 'toggle-after')
    const ext = f.extra?.a11y02 as { motion: string | null } | undefined
    if (!before || !after) continue
    n++
    if (before.storage !== 0)
      bad.push(`${f.profile}: ${before.storage} Speicher-Einträge vor dem Klick`)
    if (ext?.motion !== 'reduced') bad.push(`${f.profile}: data-motion ${ext?.motion ?? 'fehlt'}`)
    if (after.leash && after.leash.drawnLen < after.leash.total - 1)
      bad.push(`${f.profile}: Linie nicht vollständig`)
    for (const a of after.anims.filter(moving)) bad.push(`${f.profile}: ${a.n} läuft`)
  }
  if (!n) return noData('A11Y-02', th, 'keine Schalter-Sonden (SC-00 toggle-*)')
  return result('A11Y-02', bad.length === 0, `${n} Profile`, th, bad)
}

export function a11y03(files: readonly ProbeFile[]): CheckResult {
  const th =
    'Linie, Coco, Motive aria-hidden mit 0 fokussierbaren Nachfahren; Tab-Reihenfolge mit/ohne Engine identisch'
  const rows = entries(files)
  if (!rows.length) return noData('A11Y-03', th, 'keine Sonden')
  const bad = new Set<string>()
  for (const e of rows) {
    if (e.p.deco.count && !e.p.deco.hidden)
      bad.add(`${routeOf(e.p.url)?.id ?? e.p.url}: Deko nicht aria-hidden`)
    if (e.p.deco.focusable)
      bad.add(`${routeOf(e.p.url)?.id ?? e.p.url}: ${e.p.deco.focusable} fokussierbar in Deko`)
  }
  const tabs = extra<{ engine: string[]; off: string[] }>(files, 'tabOrder', { sc: 'SC-00' })
  if (!tabs.length) bad.add('Tab-Reihenfolge nicht gemessen (SC-00 extra.tabOrder)')
  for (const { file, value } of tabs)
    if (value.engine.join('\n') !== value.off.join('\n'))
      bad.add(`${file.profile}: Tab-Reihenfolge weicht ab`)
  return result(
    'A11Y-03',
    bad.size === 0,
    `${rows.length} Sonden, ${tabs.length} Tab-Vergleiche`,
    th,
    [...bad],
  )
}

export interface AxeFile {
  sc: string
  profile: string
  variant: string
  label: string
  url: string
  violations?: { id: string; impact: string | null; nodes: number }[]
  error?: string
}

export function a11y04(axe: readonly AxeFile[]): CheckResult {
  const th = '0 axe-Verstöße serious/critical auf allen Szenario-Routen in beiden Varianten'
  if (!axe.length) return noData('A11Y-04', th, 'keine axe-Ergebnisse (raw/**/axe-*.json)')
  const bad = new Set<string>()
  for (const a of axe) {
    if (a.error) bad.add(`${a.sc} ${a.label}: axe-Fehler ${a.error.slice(0, 80)}`)
    for (const v of a.violations ?? [])
      if (v.impact === 'serious' || v.impact === 'critical')
        bad.add(`${routeOf(a.url)?.id ?? a.url} (${a.variant}): ${v.id} ×${v.nodes}`)
  }
  const variants = new Set(axe.map((a) => a.variant))
  if (!variants.has('motion') || !variants.has('reduced'))
    bad.add('nicht in beiden Varianten geprüft')
  return result('A11Y-04', bad.size === 0, `${axe.length} Prüfungen`, th, [...bad])
}

export function a11y05(files: readonly ProbeFile[]): CheckResult {
  const th = 'SC-17: Linie in CanvasText, keine Fläche verdeckt Text (Ansicht: R3)'
  const rows = entries(files, { sc: 'SC-17' }).filter((e) => e.p.leash)
  if (!rows.length) return noData('A11Y-05', th, 'keine Sonden SC-17')
  const bad: string[] = []
  for (const e of rows) {
    if (e.p.leash!.stroke !== e.p.canvasText)
      bad.push(`${where(e)}: Linie ${e.p.leash!.stroke} statt ${e.p.canvasText}`)
    const o = overlaps(e.p)
    if (o.length) bad.push(`${where(e)}: ${o[0]}${o.length > 1 ? ` (+${o.length - 1})` : ''}`)
  }
  return result('A11Y-05', bad.length === 0, `${rows.length} Sonden`, th, [...new Set(bad)])
}

/** Ruhe-Routen: keine Animation (außer MI-07 im Kopf), keine Transition in `main`, kein Boil. */
function calmViolations(files: readonly ProbeFile[]): { n: number; bad: string[] } {
  const rows = entries(files).filter((e) => isCalmRoute(e.p.url))
  const bad = new Set<string>()
  for (const e of rows) {
    const id = routeOf(e.p.url)?.id ?? e.p.url
    for (const a of e.p.anims)
      if (a.z !== 'header' && (a.d ?? 0) > 1) bad.add(`${id}: ${a.n} (${a.tg})`)
    if (e.p.transitions)
      bad.add(
        `${id}: ${e.p.transitions} Elemente mit Transition${e.p.transitionsAt?.length ? ` (${e.p.transitionsAt.join(', ')})` : ''}`,
      )
    if (e.p.coco?.boil === 'on') bad.add(`${id}: Boil`)
  }
  return { n: rows.length, bad: [...bad] }
}

export function a11y06(files: readonly ProbeFile[]): CheckResult {
  const th =
    'AK-DS-11: Korb, Kasse, Bestellstatus, Widerruf, Rechtsseiten ohne Animation/Transition'
  const { n, bad } = calmViolations(files)
  if (!n) return noData('A11Y-06', th, 'keine Sonden auf Ruhe-Routen (SC-06)')
  return result('A11Y-06', bad.length === 0, `${n} Sonden`, th, bad)
}

export function a11y07(files: readonly ProbeFile[]): CheckResult {
  const th = 'Fokusring sichtbar, an 4 Ringpunkten nicht von Linie/Coco/Kauf-Leiste verdeckt'
  const rows = entries(files).filter((e) => e.p.focus)
  if (!rows.length) return noData('A11Y-07', th, 'kein fokussiertes Element in den Sonden (SC-03)')
  const bad = new Set<string>()
  for (const e of rows) {
    const f = e.p.focus!
    if (!f.ring) bad.add(`${where(e)}: ${f.desc} ohne Fokusring`)
    if (f.hits.some((h) => h === 'deco' || h === 'buybar'))
      bad.add(`${where(e)}: ${f.desc} verdeckt (${f.hits.join('/')})`)
  }
  return result('A11Y-07', bad.size === 0, `${rows.length} Fokus-Sonden`, th, [...bad])
}

// ---------- CT ----------

export function evidence(
  id: string,
  threshold: string,
  ev: { pass: boolean; detail: string } | null,
  hint: string,
): CheckResult {
  if (!ev) return noData(id, threshold, hint)
  return result(id, ev.pass, ev.detail, threshold, ev.pass ? [] : [ev.detail])
}

export interface ContrastSample {
  label: string
  ratio: number
}

export function ct02(axe: readonly AxeFile[], samples: readonly ContrastSample[]): CheckResult {
  const th = 'axe color-contrast ohne Verstoß; Text über Raster-Hauptlinien ≥ 4,5:1 (Pixelmessung)'
  if (!axe.length) return noData('CT-02', th, 'keine axe-Ergebnisse')
  const bad = new Set<string>()
  for (const a of axe)
    for (const v of a.violations ?? [])
      if (v.id === 'color-contrast')
        bad.add(`${routeOf(a.url)?.id ?? a.url}: color-contrast ×${v.nodes}`)
  if (!samples.length) bad.add('keine Pixel-Stichprobe (SC-04)')
  const min = samples.length ? Math.min(...samples.map((s) => s.ratio)) : null
  for (const s of samples) if (s.ratio < 4.5) bad.add(`${s.label}: ${round(s.ratio, 2)}:1`)
  return result(
    'CT-02',
    bad.size === 0,
    `axe ${axe.length} Prüfungen, Pixel min. ${min === null ? '–' : round(min, 2)}:1 (${samples.length} Zeilen)`,
    th,
    [...bad],
  )
}

export function ct03(files: readonly ProbeFile[]): CheckResult {
  const th = 'Stempel ≥ 3:1 (≥ 24 px); Badge-Texte ≥ 4,5:1'
  const rows = entries(files).flatMap((e) => e.p.badges.map((b) => ({ e, b })))
  if (!rows.length) return noData('CT-03', th, 'keine Stempel/Badges im Bild')
  const bad = new Set<string>()
  for (const { e, b } of rows) {
    const min = b.sel === 'stamp' && b.size >= 24 ? 3 : 4.5
    if (b.ratio < min)
      bad.add(`${routeOf(e.p.url)?.id ?? e.p.url} ${b.sel}: ${b.ratio}:1 (${b.size} px)`)
  }
  return result(
    'CT-03',
    bad.size === 0,
    `${rows.length} Messungen, min. ${Math.min(...rows.map((r) => r.b.ratio))}:1`,
    th,
    [...bad],
  )
}

// ---------- RZ ----------

export function rz01(files: readonly ProbeFile[]): CheckResult {
  const th =
    'DESIGN §11.6 belegt: Ruhe-Routen still, Bilder/Fußbereich nie animiert, Archiv ohne Stempel/Hüpfer'
  const rows = entries(files)
  if (!rows.length) return noData('RZ-01', th, 'keine Sonden')
  const calm = calmViolations(files)
  const bad = new Set<string>(calm.bad)
  if (!calm.n) bad.add('keine Sonden auf Ruhe-Routen (SC-06)')
  // SC-15 verändert Viewport/Schriftgröße künstlich (Übergänge dort sind Folge der Prüfung, nicht des Produkts).
  for (const e of rows.filter((x) => x.sc !== 'SC-15'))
    for (const a of e.p.anims.filter((x) => (x.d ?? 0) > 1)) {
      const id = routeOf(e.p.url)?.id ?? e.p.url
      if (a.z === 'img') bad.add(`${id}: Bild animiert (${a.n})`)
      if (a.z === 'footer') bad.add(`${id}: Fußbereich animiert (${a.n})`)
      if (id === 'R05' && (isStamp(a.n, a.tg) || /hop/i.test(a.n))) bad.add(`R05 Archiv: ${a.n}`)
    }
  return result('RZ-01', bad.size === 0, `${rows.length} Sonden, ${calm.n} auf Ruhe-Routen`, th, [
    ...bad,
  ])
}

export function rz02(files: readonly ProbeFile[]): CheckResult {
  const th = 'Tattoo-Bereich (R11, R12): kein Preisschild, kein „In den Korb“'
  const rows = entries(files).filter((e) => ['R11', 'R12'].includes(routeOf(e.p.url)?.id ?? ''))
  if (!rows.length) return noData('RZ-02', th, 'keine Sonden auf R11/R12 (SC-08)')
  const bad = new Set<string>()
  for (const e of rows) {
    if (e.p.commerce.price) bad.add(`${routeOf(e.p.url)!.id}: ${e.p.commerce.price} Preis-Elemente`)
    if (e.p.commerce.addToCart) bad.add(`${routeOf(e.p.url)!.id}: „In den Korb“`)
  }
  return result('RZ-02', bad.size === 0, `${rows.length} Sonden`, th, [...bad])
}
