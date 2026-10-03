import sharp from 'sharp'

// SVG-Hilfen der Kunst-Prüfung (KUNST-QA §5.2/§5.3): kleiner XML-Baum für Sprite/Zeichnungen, Endpunkte von Teilpfaden
// (offene Konturen), Rasterung mit sharp und Masken-Maße (Bounding-Box, Hauptachsen, IoU, Spiegel/Verschiebung).

export interface XNode {
  tag: string
  attrs: Record<string, string>
  children: XNode[]
}

/** Minimaler XML-Leser für die eigenen, einfachen SVG-Dateien (Elemente, Attribute, Text wird ignoriert). */
export function parseXml(src: string): XNode {
  const root: XNode = { tag: '#root', attrs: {}, children: [] }
  const stack: XNode[] = [root]
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (!m[2]) continue
    if (m[1]) {
      const at = stack.map((n) => n.tag).lastIndexOf(m[2])
      if (at > 0) stack.length = at
      continue
    }
    const attrs: Record<string, string> = {}
    for (const a of (m[3] ?? '').matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1]!] = a[2]!
    const node: XNode = { tag: m[2], attrs, children: [] }
    stack[stack.length - 1]!.children.push(node)
    if (!m[4]) stack.push(node)
  }
  return root
}

export function walk(node: XNode, fn: (n: XNode, parents: XNode[]) => void, parents: XNode[] = []) {
  fn(node, parents)
  for (const c of node.children) walk(c, fn, [...parents, node])
}

export function serialize(node: XNode): string {
  const attrs = Object.entries(node.attrs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('')
  if (node.children.length === 0) return `<${node.tag}${attrs}/>`
  return `<${node.tag}${attrs}>${node.children.map(serialize).join('')}</${node.tag}>`
}

// ---------- Pfade ----------

export interface SubPath {
  start: [number, number]
  end: [number, number]
  closed: boolean
  /** Stützpunkte (Endpunkte aller Befehle). */
  points: [number, number][]
}

/** Teilpfade mit Anfangs-/Endpunkt (alle SVG-Befehle, absolut und relativ). */
export function subPaths(d: string): SubPath[] {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? []
  const out: SubPath[] = []
  let i = 0
  let cmd = ''
  let cur: [number, number] = [0, 0]
  let sub: SubPath | null = null
  const num = () => Number(tokens[i++])
  const ARGS: Record<string, number> = { M: 2, L: 2, T: 2, H: 1, V: 1, Q: 4, S: 4, C: 6, A: 7, Z: 0 }
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i]!)) cmd = tokens[i++]!
    const up = cmd.toUpperCase()
    const rel = cmd !== up
    const n = ARGS[up]
    if (n === undefined) throw new Error(`Unbekannter Pfadbefehl ${cmd}`)
    if (up === 'Z') {
      if (sub) {
        sub.closed = true
        sub.end = sub.start
        cur = sub.start
      }
      continue
    }
    const a = Array.from({ length: n }, num)
    if (a.some((v) => Number.isNaN(v))) break
    let p: [number, number]
    if (up === 'H') p = [rel ? cur[0] + a[0]! : a[0]!, cur[1]]
    else if (up === 'V') p = [cur[0], rel ? cur[1] + a[0]! : a[0]!]
    else {
      const x = a[n - 2]!
      const y = a[n - 1]!
      p = rel ? [cur[0] + x, cur[1] + y] : [x, y]
    }
    if (up === 'M') {
      sub = { start: p, end: p, closed: false, points: [p] }
      out.push(sub)
      cmd = rel ? 'l' : 'L'
    } else if (sub) {
      sub.end = p
      sub.points.push(p)
    }
    cur = p
  }
  return out
}

/** Offene Teilpfade (nicht geschlossen und Enden > `gap` auseinander). */
export function openSubPaths(d: string, gap = 1.5): number {
  return subPaths(d).filter(
    (s) => !s.closed && Math.hypot(s.end[0] - s.start[0], s.end[1] - s.start[1]) > gap,
  ).length
}

// ---------- Rasterung ----------

export interface Mask {
  w: number
  h: number
  /** 1 = Tinte/Figur. */
  m: Uint8Array
}

/** CSS-Variablen mit Rückfallwert auflösen (`var(--ink,#1C1A17)` → `#1C1A17`), damit librsvg die Farben kennt. */
export const resolveVars = (svg: string) =>
  svg.replace(/var\(--[\w-]+\s*,\s*([^()]+?)\)/g, '$1').replace(/var\(--[\w-]+\)/g, '#000')

/** SVG → Alpha-Maske (Schwelle in 0–1 der Deckkraft). */
export async function rasterMask(svg: string, width: number, threshold = 0.5): Promise<Mask> {
  const { data, info } = await sharp(Buffer.from(resolveVars(svg)), { density: 300 })
    .resize({ width, fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const m = new Uint8Array(info.width * info.height)
  for (let k = 0; k < m.length; k++)
    m[k] = data[k * info.channels + info.channels - 1]! >= threshold * 255 ? 1 : 0
  return { w: info.width, h: info.height, m }
}

/** SVG → Graustufen (auf Papierweiß), für Schwellwert-/Strichmessungen. */
export async function rasterGray(
  input: Buffer | string,
  width: number,
): Promise<{ w: number; h: number; g: Uint8Array }> {
  const buf = typeof input === 'string' ? Buffer.from(resolveVars(input)) : input
  const { data, info } = await sharp(buf, { density: 300 })
    .flatten({ background: '#ffffff' })
    .resize({ width })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, g: new Uint8Array(data.buffer, data.byteOffset, data.length) }
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export function maskBox(mask: Mask): Box | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < mask.h; y++)
    for (let x = 0; x < mask.w; x++)
      if (mask.m[y * mask.w + x]) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/** Ausdehnung entlang der Haupt- und Nebenachse (5.–95. Perzentil der Projektionen). */
export function principalExtent(mask: Mask): { length: number; width: number } | null {
  const xs: number[] = []
  const ys: number[] = []
  for (let y = 0; y < mask.h; y++)
    for (let x = 0; x < mask.w; x++)
      if (mask.m[y * mask.w + x]) {
        xs.push(x)
        ys.push(y)
      }
  if (xs.length < 4) return null
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (let k = 0; k < xs.length; k++) {
    const dx = xs[k]! - mx
    const dy = ys[k]! - my
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  const along: number[] = []
  const across: number[] = []
  for (let k = 0; k < xs.length; k++) {
    const dx = xs[k]! - mx
    const dy = ys[k]! - my
    along.push(dx * c + dy * s)
    across.push(-dx * s + dy * c)
  }
  const span = (v: number[]) => {
    v.sort((a, b) => a - b)
    return v[Math.floor(v.length * 0.95)]! - v[Math.floor(v.length * 0.05)]! + 1
  }
  return { length: span(along), width: span(across) }
}

/** Gefüllte Silhouette: Konturen um `r` px schließen, Außenraum vom Rand fluten, Rest = Figur. */
export function fillSilhouette(mask: Mask, r = 2): Mask {
  const { w, h } = mask
  const dil = new Uint8Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!mask.m[y * w + x]) continue
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && dx * dx + dy * dy <= r * r) dil[ny * w + nx] = 1
        }
    }
  const outside = new Uint8Array(w * h)
  const stack: number[] = []
  const push = (x: number, y: number) => {
    const k = y * w + x
    if (!dil[k] && !outside[k]) {
      outside[k] = 1
      stack.push(k)
    }
  }
  for (let x = 0; x < w; x++) {
    push(x, 0)
    push(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    push(0, y)
    push(w - 1, y)
  }
  while (stack.length) {
    const k = stack.pop()!
    const x = k % w
    const y = (k - x) / w
    if (x > 0) push(x - 1, y)
    if (x < w - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < h - 1) push(x, y + 1)
  }
  // Außenraum um r zurück an die Kontur (Schließen ohne Wachstum)
  const m = new Uint8Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x
      if (!outside[k]) {
        m[k] = 1
        continue
      }
      let near = false
      for (let dy = -r; dy <= r && !near; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && dx * dx + dy * dy <= r * r && !outside[ny * w + nx]) {
            near = true
            break
          }
        }
      m[k] = near && mask.m[k] ? 1 : 0
    }
  return { w, h, m }
}

export function iou(a: Mask, b: Mask, dx = 0, dy = 0, mirrorA = false): number {
  let inter = 0
  let uni = 0
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const ax = (mirrorA ? a.w - 1 - x : x) - dx
      const ay = y - dy
      const va = ax >= 0 && ay >= 0 && ax < a.w && ay < a.h ? a.m[ay * a.w + ax]! : 0
      const vb = b.m[y * b.w + x]!
      if (va && vb) inter++
      if (va || vb) uni++
    }
  return uni ? inter / uni : 1
}

/** Ist `b` eine Kopie, Spiegelung oder reine Verschiebung von `a` (CO-07)? */
export function copyKind(a: Mask, b: Mask, maxShift = 6, same = 0.985): string | null {
  if (iou(a, b) >= same) return 'Kopie'
  if (iou(a, b, 0, 0, true) >= same) return 'Spiegelung'
  for (let dy = -maxShift; dy <= maxShift; dy++)
    for (let dx = -maxShift; dx <= maxShift; dx++) {
      if (dx === 0 && dy === 0) continue
      if (iou(a, b, dx, dy) >= same) return `Verschiebung (${dx}, ${dy})`
    }
  return null
}
