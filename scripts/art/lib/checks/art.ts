import { mean, medianOf, noData, result, round, type CheckResult } from './common'
import {
  copyKind,
  fillSilhouette,
  iou,
  maskBox,
  openSubPaths,
  parseXml,
  principalExtent,
  rasterGray,
  rasterMask,
  serialize,
  walk,
  type Mask,
  type XNode,
} from './svg'

// Coco (KUNST-QA §5.2 CO-01/02/04–08), Zeichnungen (§5.3 AR-01–04, AR-06) und Foto-Look (§5.9 IM-01/02/05).
// Eingaben sind Dateiinhalte bzw. Messdaten – die Prüfungen lesen selbst keine Dateien (Fixtures im Unit-Test).

export const SPRITE_POSES = [
  'rennen',
  'schnueffeln',
  'sitzen',
  'schlafen',
  'springen',
  'kopfschief',
] as const
/** Zusatz-Posen der nachgeladenen Datei `coco-extra` (P12.4, U-03/U-04). */
export const EXTRA_POSES = [
  'hecheln',
  'zucken',
  'kratzen',
  'gaehnen',
  'wedeln',
  'verbeugung',
  'schuetteln',
  'freude',
  'liegen',
] as const
export const SPRITE_BRIDGES = ['bremsen', 'abspringen', 'einrollen-1', 'einrollen-2'] as const
export const SPRITE_PARTS = [
  'head',
  'snout',
  'nose',
  'ear-l',
  'ear-r',
  'eye-l',
  'eye-r',
  'body',
  'leg-fl',
  'leg-fr',
  'leg-hl',
  'leg-hr',
  'tail',
  'harness',
  'ring',
] as const

export interface SpriteSymbol {
  id: string
  viewBox: string
  hiddenParts: string[]
  node: XNode
  style: string
}

/** Haupt- und Zusatz-Sprite zu einem Dokument (für Messungen über alle Symbole; Stil nur einmal). */
export function combineSprites(main: string, extra: string): string {
  return (
    main.replace(/<\/svg>\s*$/, '') +
    extra.replace(/^[\s\S]*?<\/style>/, '').replace(/^<svg[^>]*>/, '')
  )
}

export function spriteSymbols(svg: string): SpriteSymbol[] {
  const root = parseXml(svg)
  const style = /<style>([\s\S]*?)<\/style>/.exec(svg)?.[1] ?? ''
  const out: SpriteSymbol[] = []
  walk(root, (n) => {
    if (n.tag !== 'symbol') return
    out.push({
      id: n.attrs.id ?? '',
      viewBox: n.attrs.viewBox ?? '',
      hiddenParts: (n.attrs['data-hidden-parts'] ?? '').split(/\s+/).filter(Boolean),
      node: n,
      style,
    })
  })
  return out
}

const expectedIds = () => [
  ...SPRITE_POSES.flatMap((p) => ['a', 'b', 'c'].map((f) => `coco-${p}-${f}`)),
  ...SPRITE_BRIDGES.map((b) => `coco-bridge-${b}`),
]

function partsOf(sym: SpriteSymbol): Set<string> {
  const s = new Set<string>()
  walk(sym.node, (n) => {
    if (n.attrs['data-part']) s.add(n.attrs['data-part'])
  })
  return s
}

export function co01(svg: string, extraSvg = ''): CheckResult {
  const th =
    '≥ 22 Symbole (6 Posen × 3 + 4 Brücken, IDs DESIGN §10.4) + 27 Zusatz-Symbole (9 Posen × 3, nachgeladen, P12.4), gleiche viewBox, alle data-part vorhanden oder begründet'
  const syms = [...spriteSymbols(svg), ...(extraSvg ? spriteSymbols(extraSvg) : [])]
  const ids = new Set(syms.map((s) => s.id))
  const bad: string[] = []
  for (const id of expectedIds()) if (!ids.has(id)) bad.push(`${id} fehlt`)
  if (extraSvg)
    for (const p of EXTRA_POSES)
      for (const f of ['a', 'b', 'c'])
        if (!ids.has(`coco-${p}-${f}`)) bad.push(`coco-${p}-${f} fehlt`)
  const boxes = new Set(syms.map((s) => s.viewBox))
  if (boxes.size > 1) bad.push(`verschiedene viewBox: ${[...boxes].join(' | ')}`)
  for (const s of syms) {
    const parts = partsOf(s)
    for (const p of SPRITE_PARTS)
      if (!parts.has(p) && !s.hiddenParts.includes(p)) bad.push(`${s.id}: data-part „${p}“ fehlt`)
  }
  return result('CO-01', bad.length === 0 && syms.length >= 22, `${syms.length} Symbole`, th, bad)
}

/** Symbol als eigenständiges SVG; optional nur die Teile `only` (ohne Fell-Fläche). */
/** Fester Strich in viewBox-Einheiten für Messungen (statt `non-scaling-stroke` in CSS-Pixeln). */
const MEASURE_STYLE =
  '.line path,.harness path{vector-effect:none!important}.line,.harness{stroke-width:1.6px!important}'

export function symbolSvg(sym: SpriteSymbol, only?: readonly string[]): string {
  const filter = (n: XNode): XNode | null => {
    const part = n.attrs['data-part']
    if (part !== undefined) return only!.includes(part) ? n : null
    if (n.tag === 'path') return null // Fell-Fläche u. Ä. ohne Teil-Zuordnung
    const children = n.children.map(filter).filter((c): c is XNode => !!c)
    return children.length ? { ...n, children } : null
  }
  const body = (
    only ? sym.node.children.map(filter).filter((c): c is XNode => !!c) : sym.node.children
  )
    .map(serialize)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sym.viewBox}" width="160" height="120"><style>${sym.style}${MEASURE_STYLE}</style>${body}</svg>`
}

const POSE_OF = (id: string) => /^coco-(?:bridge-)?(.+?)(?:-([abc]))?$/.exec(id)
const isBridge = (id: string) => id.startsWith('coco-bridge-')

export interface CocoProportions {
  id: string
  earToHead: number | null
  eyeToHead: number | null
  snoutToHead: number | null
  noseToHead: number | null
  legWidthToLength: number | null
  earAsym: number | null
  eyeDiff: number | null
}

const RASTER_W = 640

export async function cocoProportions(sym: SpriteSymbol): Promise<CocoProportions> {
  const box = async (parts: string[]) =>
    maskBox(await rasterMask(symbolSvg(sym, parts), RASTER_W, 0.3))
  const visible = (p: string) => !sym.hiddenParts.includes(p)
  const head = await box(['head', 'snout', 'nose'])
  const earL = visible('ear-l') ? await box(['ear-l']) : null
  const earR = visible('ear-r') ? await box(['ear-r']) : null
  const eyeL = visible('eye-l') ? await box(['eye-l']) : null
  const eyeR = visible('eye-r') ? await box(['eye-r']) : null
  const snout = await box(['snout'])
  const nose = await box(['nose'])
  const legs: number[] = []
  for (const leg of ['leg-fl', 'leg-fr', 'leg-hl', 'leg-hr'])
    if (visible(leg)) {
      const e = principalExtent(await rasterMask(symbolSvg(sym, [leg]), RASTER_W, 0.3))
      if (e && e.length > 0) legs.push(e.width / e.length)
    }
  const hl = head?.w ?? null
  const ear = Math.max(earL?.h ?? 0, earR?.h ?? 0) || null
  const ratio = (v: number | null | undefined) => (v && hl ? v / hl : null)
  return {
    id: sym.id,
    earToHead: ratio(ear),
    eyeToHead: ratio(Math.max(eyeL?.w ?? 0, eyeR?.w ?? 0) || null),
    snoutToHead: ratio(snout?.w),
    noseToHead: ratio(nose?.w),
    legWidthToLength: legs.length ? Math.max(...legs) : null,
    earAsym: earL && earR ? Math.abs(earL.h - earR.h) / Math.max(earL.h, earR.h) : null,
    eyeDiff: eyeL && eyeR ? Math.abs(eyeL.w - eyeR.w) / Math.max(eyeL.w, eyeR.w) : null,
  }
}

const SIDE_POSES = ['rennen', 'schnueffeln', 'springen']
const CO02_POSES = [...SIDE_POSES, 'sitzen', 'kopfschief', ...EXTRA_POSES]
/**
 * Abweichende Obergrenzen einzelner Zusatz-Frames (P12.4, begründet in OFFENE-PUNKTE): geschlossene Augen sind
 * Bögen (breiter als der Ring), das weit offene Maul beim Gähnen verlängert die Schnauze, die Drehung des
 * Freudenhüpfers (Frame B, von vorn gestaucht) verkürzt die Kopfbreite.
 */
const CO02_EXTRA_MAX: {
  re: RegExp
  eye?: number
  snout?: number
  snoutMin?: number
  ear?: number
}[] = [
  { re: /^coco-(kratzen|liegen-c|gaehnen-[bc])/, eye: 0.32 },
  { re: /^coco-gaehnen-[bc]/, snout: 0.55 },
  { re: /^coco-(schuetteln|liegen)/, snoutMin: 0.28 },
  { re: /^coco-freude-b/, ear: 1.0, snout: 0.5 },
  { re: /^coco-zucken-b/, ear: 0.92 },
]

export function co02(props: readonly CocoProportions[]): CheckResult {
  const th =
    'Ohr/Kopf 0,55–0,85 · Auge/Kopf 0,18–0,26 · Schnauze/Kopf 0,30–0,45 · Bein Breite/Länge ≤ 0,18 (Seitenansicht) · Nase ≤ 0,15 Kopf'
  // KUNST-QA CO-02 gilt für die Seitenansicht-Posen und (aus den Kopfteilen) die Sitzposen – nicht für `schlafen`
  // (Ohren angelegt, Kopf eingerollt, DESIGN §10.3) und nicht für Brücken.
  const frames = props.filter(
    (p) => !isBridge(p.id) && CO02_POSES.includes(POSE_OF(p.id)?.[1] ?? ''),
  )
  if (!frames.length) return noData('CO-02', th, 'kein Sprite')
  const bad: string[] = []
  const check = (p: CocoProportions, name: string, v: number | null, lo: number, hi: number) => {
    if (v === null) return
    if (v < lo || v > hi) bad.push(`${p.id}: ${name} ${round(v, 3)}`)
  }
  for (const p of frames) {
    // große aufrechte Ohren nach Juttas Coco-Fotos (04.10.2026, gemessen ≈ 0,65; OFFENE-PUNKTE): früher 0,80–1,10
    // (Fennek), dann 0,35–0,65 (kleine Ohren nach der Skizze)
    const over = CO02_EXTRA_MAX.filter((o) => o.re.test(p.id))
    const max = (k: 'eye' | 'snout' | 'ear', d: number) =>
      Math.max(d, ...over.map((o) => o[k] ?? 0))
    check(p, 'Ohr/Kopf', p.earToHead, 0.55, max('ear', 0.85))
    check(p, 'Auge/Kopf', p.eyeToHead, 0.18, max('eye', 0.26))
    check(
      p,
      'Schnauze/Kopf',
      p.snoutToHead,
      Math.min(0.3, ...over.map((o) => o.snoutMin ?? 1)),
      max('snout', 0.45),
    )
    check(p, 'Nase/Kopf', p.noseToHead, 0, 0.15)
    if (SIDE_POSES.includes(POSE_OF(p.id)?.[1] ?? ''))
      check(p, 'Bein Breite/Länge', p.legWidthToLength, 0, 0.18)
  }
  const med = (k: keyof CocoProportions) =>
    round(medianOf(frames.map((f) => f[k]).filter((v): v is number => typeof v === 'number')), 2)
  return result(
    'CO-02',
    bad.length === 0,
    `Median Ohr ${med('earToHead')}, Auge ${med('eyeToHead')}, Schnauze ${med('snoutToHead')}, Nase ${med('noseToHead')}, Bein ${med('legWidthToLength')}`,
    th,
    bad,
  )
}

export interface ManifestSymbol {
  id: string
  pose: string
  frame: string | null
  bridge: boolean
  anchor: { x: number; y: number }
  groundY: number
  fps?: number
}

/** Zusatz-Posen, deren Körper sich über die Frames bewegt (Anker darf stärker wandern). */
const MOVING_EXTRA: Record<string, number> = {
  verbeugung: 4,
  kratzen: 4,
  schuetteln: 6,
  freude: 12,
}

export function co04(symbols: readonly ManifestSymbol[]): CheckResult {
  const th =
    'D-Ring je Pose über A/B/C ± 2 (rennen ± 3; bewegte Zusatz-Posen: Verbeugung/Kratzen ± 4, Schütteln ± 6, Freudenhüpfer ± 12 – der Hüpfer hebt den Körper), data-ground-y ± 2'
  const bad: string[] = []
  const vals: string[] = []
  const extra = symbols.some((s) => (EXTRA_POSES as readonly string[]).includes(s.pose))
  for (const pose of [...SPRITE_POSES, ...(extra ? EXTRA_POSES : [])]) {
    const f = symbols.filter((s) => s.pose === pose && !s.bridge)
    if (f.length !== 3) {
      bad.push(`${pose}: ${f.length} Frames`)
      continue
    }
    const span = (v: number[]) => Math.max(...v) - Math.min(...v)
    const tol = pose === 'rennen' ? 3 : (MOVING_EXTRA[pose] ?? 2)
    const dx = span(f.map((s) => s.anchor.x))
    const dy = span(f.map((s) => s.anchor.y))
    const dg = span(f.map((s) => s.groundY))
    vals.push(`${pose} ${dx}/${dy}/${dg}`)
    if (dx > tol || dy > tol) bad.push(`${pose}: D-Ring schwankt ${dx}/${dy} Einheiten`)
    if (dg > 2) bad.push(`${pose}: Bodenlinie schwankt ${dg}`)
  }
  return result('CO-04', bad.length === 0, vals.join(', '), th, bad)
}

export async function silhouettes(svg: string, width = 256): Promise<Map<string, Mask>> {
  const out = new Map<string, Mask>()
  for (const s of spriteSymbols(svg))
    out.set(
      s.id,
      fillSilhouette(
        await rasterMask(symbolSvg(s), width, 0.5),
        Math.max(2, Math.round(width / 80)),
      ),
    )
  return out
}

/** Silhouetten-IoU je Zusatz-Pose: die Aktionen sind echte Bewegung (nicht nur Boil), daher breitere Bänder. */
const EXTRA_IOU: Record<string, [number, number]> = {
  zucken: [0.8, 0.97],
  kratzen: [0.8, 0.97],
  gaehnen: [0.8, 0.97],
  verbeugung: [0.7, 0.97],
  schuetteln: [0.6, 0.97],
  freude: [0.1, 0.9], // Drehung: gespiegelt und von vorn gestaucht
  liegen: [0.8, 0.97],
}

export function co05(masks: ReadonlyMap<string, Mask>): CheckResult {
  const th =
    'Silhouetten-IoU (256 px, 50 %) je Pose 0,88–0,97; rennen 0,55–0,85; Zusatz-Posen mit Bewegung breiter (EXTRA_IOU)'
  const bad: string[] = []
  const vals: string[] = []
  const extra = masks.has('coco-freude-a')
  for (const pose of [...SPRITE_POSES, ...(extra ? EXTRA_POSES : [])]) {
    const f = ['a', 'b', 'c'].map((k) => masks.get(`coco-${pose}-${k}`))
    if (f.some((m) => !m)) {
      bad.push(`${pose}: Frames fehlen`)
      continue
    }
    const [lo, hi] = pose === 'rennen' ? [0.55, 0.85] : (EXTRA_IOU[pose] ?? [0.88, 0.97])
    for (const [i, j] of [
      [0, 1],
      [1, 2],
      [0, 2],
    ] as const) {
      const v = iou(f[i]!, f[j]!)
      vals.push(`${pose} ${'abc'[i]}/${'abc'[j]} ${round(v, 3)}`)
      if (v < lo || v > hi) bad.push(`${pose} ${'abc'[i]}/${'abc'[j]}: IoU ${round(v, 3)}`)
    }
  }
  return result('CO-05', bad.length === 0, vals.join(', '), th, bad)
}

export function co06(svg: string, props: readonly CocoProportions[]): CheckResult {
  const th =
    'je Frame ≥ 2 offene Konturstellen; Ohren-Asymmetrie 5–15 %; Augen verschieden (≥ 3 %); Überstand/Doppelkontur: R1'
  const bad: string[] = []
  const vals: string[] = []
  for (const s of spriteSymbols(svg).filter((x) => !isBridge(x.id))) {
    let open = 0
    walk(s.node, (n, parents) => {
      if (n.tag === 'path' && parents.some((p) => p.attrs.class === 'line'))
        open += openSubPaths(n.attrs.d ?? '')
    })
    const p = props.find((x) => x.id === s.id)
    vals.push(`${s.id} ${open} offen`)
    if (open < 2) bad.push(`${s.id}: nur ${open} offene Konturstellen`)
    if (p?.earAsym !== null && p?.earAsym !== undefined && (p.earAsym < 0.05 || p.earAsym > 0.15))
      bad.push(`${s.id}: Ohren-Asymmetrie ${round(p.earAsym * 100, 1)} %`)
    if (p?.eyeDiff !== null && p?.eyeDiff !== undefined && p.eyeDiff < 0.03)
      bad.push(`${s.id}: Augen gleich (${round(p.eyeDiff * 100, 1)} %)`)
  }
  return result('CO-06', bad.length === 0, `${vals.length} Frames geprüft`, th, bad)
}

export function co07(svg: string, masks: ReadonlyMap<string, Mask>): CheckResult {
  const th =
    'kein <circle|ellipse|rect|line|polygon> im Sprite; kein Frame Spiegel/Verschiebung eines anderen'
  const bad: string[] = []
  const prim = svg.match(/<(circle|ellipse|rect|line|polygon|polyline)\b/g) ?? []
  if (prim.length) bad.push(`Formen-Primitive: ${[...new Set(prim)].join(', ')}`)
  const ids = [...masks.keys()]
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const pi = POSE_OF(ids[i]!)?.[1]
      const pj = POSE_OF(ids[j]!)?.[1]
      if (pi !== pj) continue
      const kind = copyKind(masks.get(ids[i]!)!, masks.get(ids[j]!)!)
      if (kind) bad.push(`${ids[j]} ist ${kind} von ${ids[i]}`)
    }
  return result(
    'CO-07',
    bad.length === 0,
    `${prim.length} Primitive, ${bad.length - (prim.length ? 1 : 0)} Kopien`,
    th,
    bad,
  )
}

/** Größenklassen (px) und Strichstärke aus `tokens.css` (Mobil + ab 768) und `coco.css`. */
export function cocoStrokeTable(
  tokensCss: string,
  cocoCss: string,
): { size: number; stroke: number; label: string }[] {
  const tok = (name: string, css: string) =>
    [...css.matchAll(new RegExp(`--${name}:\\s*([\\d.]+)px`, 'g'))].map((m) => Number(m[1]))
  const rootStroke = tok('coco-stroke', tokensCss)
  const leash = tok('coco-leash', tokensCss)
  const out: { size: number; stroke: number; label: string }[] = []
  for (const m of cocoCss.matchAll(/\.coco\[data-size='([\w]+)'\]\s*\{([^}]*)\}/g)) {
    const body = m[2]!
    const w = /--coco-w:\s*(?:min\()?(?:var\(--([\w-]+)\)|([\d.]+)px)/.exec(body)
    const stroke = /--coco-stroke:\s*([\d.]+)px/.exec(body)
    const sizes = w?.[2] ? [Number(w[2])] : w?.[1] ? tok(w[1], tokensCss) : []
    const strokes = stroke ? [Number(stroke[1])] : rootStroke
    sizes.forEach((size, i) =>
      out.push({ size, stroke: strokes[Math.min(i, strokes.length - 1)]!, label: m[1]! }),
    )
  }
  if (!out.some((o) => o.label === 'leash'))
    leash.forEach((size, i) =>
      out.push({ size, stroke: rootStroke[i] ?? rootStroke[0]!, label: 'leash' }),
    )
  return out
}

/** Sollbereiche CO-08 (DESIGN §10.5) nach Größe. */
export function strokeRange(size: number): [number, number] {
  if (size <= 32) return [1.0, 1.4]
  if (size <= 52) return [1.4, 1.8]
  if (size <= 120) return [1.6, 2.0]
  return [2.0, 2.4]
}

export function co08(
  table: readonly { size: number; stroke: number; label: string }[],
): CheckResult {
  const th = '24 px: 1,0–1,4 · 40/42: 1,4–1,8 · 64/72: 1,6–2,0 · 180/240: 2,0–2,4 px'
  if (!table.length) return noData('CO-08', th, 'keine Größenklassen in coco.css')
  const bad: string[] = []
  for (const t of table) {
    const [lo, hi] = strokeRange(t.size)
    if (t.stroke < lo || t.stroke > hi) bad.push(`${t.label} ${t.size} px: Strich ${t.stroke} px`)
  }
  return result(
    'CO-08',
    bad.length === 0,
    table.map((t) => `${t.label} ${t.size}px→${t.stroke}`).join(', '),
    th,
    bad,
  )
}

// ---------- AR ----------

export interface SourcesJson {
  vectorize: {
    id: string
    file: string
    threshold?: number | 'otsu'
    crop?: { x: number; y: number; w: number; h: number }
  }[]
  derived: {
    id: string
    from: string
    kind: string
    reference?: string
    threshold?: number | 'otsu'
    crop?: { x: number; y: number; w: number; h: number }
  }[]
}

/** Quellen, die nie Vorlage sein dürfen (AR-01: Highlights, Profilbild mit Jutta, Godzilla). */
export const FORBIDDEN_SOURCE = /highlight-|profil\.jpg|DdHXUQsDjqm|godzilla/i

export function ar01(
  sources: SourcesJson,
  stationFiles: readonly string[],
  customerCodes: readonly string[],
): CheckResult {
  const th =
    'jede Station aus der Zuordnung DESIGN §12.4; keine Kundenhaut-Fotos, kein Godzilla, keine Bilder mit Jutta'
  const bad: string[] = []
  const ids = [...sources.vectorize.map((v) => v.id), ...sources.derived.map((d) => d.id)]
  for (const f of stationFiles) if (!ids.includes(f)) bad.push(`${f}: keine Quelle in sources.json`)
  for (const id of ids) if (!stationFiles.includes(id)) bad.push(`${id}: Quelle ohne Zeichnung`)
  const all = JSON.stringify(sources)
  const m = FORBIDDEN_SOURCE.exec(all)
  if (m) bad.push(`verbotene Quelle „${m[0]}“`)
  for (const c of customerCodes)
    if (c && all.includes(c)) bad.push(`Kundenhaut-Foto ${c} als Quelle`)
  return result(
    'AR-01',
    bad.length === 0,
    `${stationFiles.length} Stationen, ${ids.length} Quellen`,
    th,
    bad,
  )
}

/** Distanztransformation (Chamfer 3-4) auf einer Binärmaske, Ergebnis in Pixeln. */
export function distanceTransform(m: Uint8Array, w: number, h: number): Float32Array {
  const d = new Float32Array(w * h)
  const INF = 1e9
  for (let k = 0; k < d.length; k++) d[k] = m[k] ? INF : 0
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]!)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x
      if (!d[k]) continue
      d[k] = Math.min(
        d[k]!,
        at(x - 1, y) + 3,
        at(x, y - 1) + 3,
        at(x - 1, y - 1) + 4,
        at(x + 1, y - 1) + 4,
      )
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const k = y * w + x
      if (!d[k]) continue
      d[k] = Math.min(
        d[k]!,
        at(x + 1, y) + 3,
        at(x, y + 1) + 3,
        at(x + 1, y + 1) + 4,
        at(x - 1, y + 1) + 4,
      )
    }
  for (let k = 0; k < d.length; k++) d[k] = d[k]! / 3
  return d
}

/** Median-Strichbreite: 2 × Distanz an Grat-Pixeln (lokale Maxima der Distanztransformation). */
export function medianStrokeWidth(m: Uint8Array, w: number, h: number): number | null {
  const d = distanceTransform(m, w, h)
  const ridge: number[] = []
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const v = d[y * w + x]!
      if (!v) continue
      let max = true
      for (let dy = -1; dy <= 1 && max; dy++)
        for (let dx = -1; dx <= 1; dx++) if (d[(y + dy) * w + x + dx]! > v) max = false
      if (max) ridge.push(v)
    }
  return ridge.length ? 2 * medianOf(ridge) - 1 : null
}

export function otsu(g: Uint8Array): number {
  const hist = new Array<number>(256).fill(0)
  for (const v of g) hist[v]!++
  const total = g.length
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]!
  let sumB = 0
  let wB = 0
  let best = 0
  let th = 128
  for (let i = 0; i < 256; i++) {
    wB += hist[i]!
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += i * hist[i]!
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > best) {
      best = between
      th = i
    }
  }
  return th
}

/** Große zusammenhängende Tintenflächen (> `minFrac` der Bildfläche), deren Gegenstück in der Quelle offen ist. */
export function clumps(
  draw: Uint8Array,
  src: Uint8Array,
  w: number,
  h: number,
  minFrac = 0.02,
): number {
  const seen = new Uint8Array(w * h)
  // Flächen: Tinte, die nach Erosion um 2 px noch steht (Striche verschwinden, Flächen bleiben).
  const d = distanceTransform(draw, w, h)
  const solid = new Uint8Array(w * h)
  for (let k = 0; k < solid.length; k++) solid[k] = d[k]! > 3 ? 1 : 0
  let count = 0
  const stack: number[] = []
  for (let k = 0; k < solid.length; k++) {
    if (!solid[k] || seen[k]) continue
    let area = 0
    let srcInk = 0
    stack.push(k)
    seen[k] = 1
    while (stack.length) {
      const p = stack.pop()!
      area++
      if (src[p]) srcInk++
      const x = p % w
      const y = (p - x) / w
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const q = ny * w + nx
        if (solid[q] && !seen[q]) {
          seen[q] = 1
          stack.push(q)
        }
      }
    }
    if (area > minFrac * w * h && srcInk / area < 0.6) count++
  }
  return count
}

export interface StrokePair {
  id: string
  /** Binärmasken gleicher Größe: Zeichnung und Schwellwertbild der Quelle. */
  draw: Uint8Array
  src: Uint8Array
  w: number
  h: number
}

export async function strokePair(
  id: string,
  drawingSvg: string,
  sourceCrop: Buffer,
  threshold: number | 'otsu' | undefined,
  width = 400,
): Promise<StrokePair> {
  const draw = await rasterGray(drawingSvg, width)
  const src = await rasterGray(sourceCrop, width)
  const h = Math.min(draw.h, src.h)
  const t = threshold === undefined || threshold === 'otsu' ? otsu(src.g) : threshold
  const dm = new Uint8Array(width * h)
  const sm = new Uint8Array(width * h)
  for (let k = 0; k < width * h; k++) {
    dm[k] = draw.g[k]! < 128 ? 1 : 0
    sm[k] = src.g[k]! < t ? 1 : 0
  }
  return { id, draw: dm, src: sm, w: width, h }
}

export function ar02(pairs: readonly StrokePair[]): CheckResult {
  const th =
    'Median-Strichbreite Zeichnung 0,75–1,25 × Quelle; keine Klumpen > 2 % der Fläche, die in der Quelle offen sind'
  // Seit P9.12 sind alle Stationen frei gezeichnet (`drawn`) – ohne vektorisierte Station gibt es nichts zu vergleichen.
  if (!pairs.length)
    return result('AR-02', true, 'keine vektorisierten Stationen (alle frei gezeichnet)', th, [])
  const bad: string[] = []
  const vals: string[] = []
  for (const p of pairs) {
    const a = medianStrokeWidth(p.draw, p.w, p.h)
    const b = medianStrokeWidth(p.src, p.w, p.h)
    const r = a && b ? a / b : null
    const c = clumps(p.draw, p.src, p.w, p.h)
    vals.push(`${p.id} ${r === null ? '?' : round(r, 2)}×${c ? `, ${c} Klumpen` : ''}`)
    if (r === null || r < 0.75 || r > 1.25)
      bad.push(`${p.id}: Strichbreite ${r === null ? '?' : round(r, 2)} × Quelle`)
    if (c > 0) bad.push(`${p.id}: ${c} Klumpen`)
  }
  return result('AR-02', bad.length === 0, vals.join('; '), th, bad)
}

export interface SizedFile {
  kind: 'station' | 'placeholder' | 'motif' | 'icon' | 'wordmark'
  name: string
  bytes: number
}
export const AR03_LIMITS: Record<SizedFile['kind'], number> = {
  station: 8000,
  placeholder: 6000,
  motif: 1500,
  icon: 600,
  wordmark: 5000,
}

export function ar03(files: readonly SizedFile[]): CheckResult {
  const th = 'Station ≤ 8 KB, Platzhalter ≤ 6 KB, Motiv ≤ 1,5 KB, Icon ≤ 600 B, Wortmarke ≤ 5 KB'
  if (!files.length) return noData('AR-03', th, 'keine Dateien')
  const bad = files
    .filter((f) => f.bytes > AR03_LIMITS[f.kind])
    .map((f) => `${f.kind} ${f.name}: ${f.bytes} B > ${AR03_LIMITS[f.kind]} B`)
  const max = (k: SizedFile['kind']) =>
    Math.max(0, ...files.filter((f) => f.kind === k).map((f) => f.bytes))
  return result(
    'AR-03',
    bad.length === 0,
    `max. Station ${max('station')} B, Platzhalter ${max('placeholder')} B, Motiv ${max('motif')} B, Icon ${max('icon')} B, Wortmarke ${max('wordmark')} B`,
    th,
    bad,
  )
}

export interface PlaceholderInput {
  name: string
  svg: string
  /** erwartete Wash-Farbe (Hex) oder null (Flash ohne Wash). */
  wash: string | null
  /** alle zulässigen Wash-Farben aus DESIGN §3.1. */
  washes: readonly string[]
  /** Tinten-Höhe nach Rasterung als Anteil der Bildhöhe. */
  inkHeight: number
}

export async function inkHeightRatio(svg: string): Promise<number> {
  const g = await rasterGray(svg, 400)
  let top = g.h
  let bottom = -1
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++)
      if (g.g[y * g.w + x]! < 80) {
        if (y < top) top = y
        bottom = y
        break
      }
  return bottom < 0 ? 0 : (bottom - top + 1) / g.h
}

export function ar04(items: readonly PlaceholderInput[]): CheckResult {
  const th =
    'viewBox 400×500, höchstens eine Wash-Farbe aus §3.1, Strich 2,8, kein <text>, Motiv 55–70 % der Höhe'
  if (!items.length) return noData('AR-04', th, 'keine Platzhalter')
  const bad: string[] = []
  for (const p of items) {
    if (!p.svg.includes('viewBox="0 0 400 500"')) bad.push(`${p.name}: viewBox`)
    if (/<text\b/.test(p.svg)) bad.push(`${p.name}: <text>`)
    const widths = [...p.svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]))
    if (!widths.length || widths[0] !== 2.8) bad.push(`${p.name}: Strich ${widths[0] ?? '–'}`)
    const fills = [...p.svg.matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]!.toUpperCase())
    const used = [...new Set(fills.filter((f) => p.washes.map((w) => w.toUpperCase()).includes(f)))]
    const want = p.wash ? [p.wash.toUpperCase()] : []
    if (used.join() !== want.join())
      bad.push(`${p.name}: Wash ${used.join('+') || 'keine'} statt ${want.join() || 'keine'}`)
    if (p.inkHeight < 0.55 || p.inkHeight > 0.7)
      bad.push(`${p.name}: Motiv ${round(p.inkHeight * 100, 1)} % der Höhe`)
  }
  return result('AR-04', bad.length === 0, `${items.length} Platzhalter`, th, bad)
}

/** AR-06 Dichte aus den Sonden der Startseite: Marken je Station und Sterne im Sichtbereich. */
export function ar06(
  marks: readonly { label: string; starsInView: number; maxPerStation: number }[],
): CheckResult {
  const th = 'max. 1 Weltraum-Marke je Station, ≤ 3 Sterne je Bildschirmhöhe (Band-Bezüge: R1)'
  if (!marks.length) return noData('AR-06', th, 'keine Sonden der Startseite (SC-01)')
  const bad: string[] = []
  for (const m of marks) {
    if (m.starsInView > 3) bad.push(`${m.label}: ${m.starsInView} Sterne im Bild`)
    if (m.maxPerStation > 1) bad.push(`${m.label}: ${m.maxPerStation} Marken an einer Station`)
  }
  return result(
    'AR-06',
    bad.length === 0,
    `max. ${Math.max(...marks.map((m) => m.starsInView))} Sterne/Bildschirm, max. ${Math.max(...marks.map((m) => m.maxPerStation))} Marken/Station`,
    th,
    bad,
  )
}

// ---------- IM ----------

export interface ImagesJson {
  summary: {
    count: number
    medianLStdDev: number | null
    medianCardBytes: number | null
    medianThumbBytes: number | null
  }
  items: {
    itemNumber: string
    /** Foto-Look greift (Foto mit Ableitung); fehlt in älteren Läufen = alle. */
    enhanced?: boolean
    after: { medianL: number | null; paperA: number | null; paperB: number | null }
  }[]
}

export function im01(evidence: { pass: boolean; detail: string } | null): CheckResult {
  const th = 'DESIGN AK-DS-17 grün'
  if (!evidence) return noData('IM-01', th, 'AK-DS-17 nicht ausgeführt (pnpm art:check --evidence)')
  return result('IM-01', evidence.pass, evidence.detail, th, evidence.pass ? [] : ['AK-DS-17 rot'])
}

export function im02(images: ImagesJson | null): CheckResult {
  const th = 'Standardabweichung Median-L* ≤ 6; Papier a*, b* je ± 4'
  if (!images) return noData('IM-02', th, 'metrics/images.json fehlt (SC-16)')
  const bad: string[] = []
  const sd = images.summary.medianLStdDev
  if (sd === null || sd > 6) bad.push(`Streuung Median-L* ${sd ?? '?'}`)
  for (const it of images.items.filter((i) => i.enhanced !== false)) {
    const { paperA, paperB } = it.after
    if (paperA !== null && Math.abs(paperA) > 4)
      bad.push(`Nr. ${it.itemNumber}: Papier a* ${round(paperA, 1)}`)
    if (paperB !== null && Math.abs(paperB) > 4)
      bad.push(`Nr. ${it.itemNumber}: Papier b* ${round(paperB, 1)}`)
  }
  const papers = images.items.filter((i) => i.enhanced !== false && i.after.paperB !== null)
  return result(
    'IM-02',
    bad.length === 0,
    `σ Median-L* ${sd ?? '?'}; Papier b* Mittel ${papers.length ? round(mean(papers.map((p) => p.after.paperB!)), 1) : '–'}`,
    th,
    bad,
  )
}

export function im05(images: ImagesJson | null, lcpBytes: number | null): CheckResult {
  const th = 'Median thumb ≤ 40 KB, card ≤ 90 KB; LCP-Bild Produktseite (Pixel 7) ≤ 120 KB'
  if (!images) return noData('IM-05', th, 'metrics/images.json fehlt (SC-16)')
  const bad: string[] = []
  const { medianThumbBytes: t, medianCardBytes: c } = images.summary
  if (t === null || t > 40_000) bad.push(`thumb ${t ?? '?'} B`)
  if (c === null || c > 90_000) bad.push(`card ${c ?? '?'} B`)
  if (lcpBytes === null) bad.push('LCP-Bild der Produktseite nicht gemessen (Sonde SC-05, Pixel 7)')
  else if (lcpBytes > 120_000) bad.push(`LCP-Bild ${lcpBytes} B`)
  return result(
    'IM-05',
    bad.length === 0,
    `thumb ${t ?? '?'} B, card ${c ?? '?'} B, LCP-Bild ${lcpBytes ?? '?'} B`,
    th,
    bad,
  )
}
