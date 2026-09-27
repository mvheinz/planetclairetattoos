// Statische Design-Prüfungen (DESIGN AK-DS-01, -02, -06, -16) für die Unit-Tests unter tests/unit/design/.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { ROUTES } from '../../src/lib/routes/registry'

export const ROOT = path.resolve(import.meta.dirname, '../..')

export interface SourceFile {
  path: string
  source: string
}

const SKIP = new Set(['node_modules', '.next', '.next-preview'])

/** Alle Dateien unter `dir` (relativ zu ROOT) mit einer der Endungen. */
export function collectFiles(dir: string, exts: string[]): SourceFile[] {
  const out: SourceFile[] = []
  const walk = (rel: string) => {
    let entries: string[]
    try {
      entries = readdirSync(path.join(ROOT, rel))
    } catch {
      return
    }
    for (const name of entries) {
      if (SKIP.has(name)) continue
      const child = `${rel}/${name}`
      if (statSync(path.join(ROOT, child)).isDirectory()) walk(child)
      else if (exts.some((e) => name.endsWith(e)))
        out.push({ path: child, source: readFileSync(path.join(ROOT, child), 'utf8') })
    }
  }
  walk(dir)
  return out
}

/** Stylesheets und Komponenten, die AK-DS-02/-06/-16 durchsuchen. Die Verwaltung (Payload-Theme) ist ausgenommen. */
export const designSources = (exts = ['.css', '.scss', '.tsx']): SourceFile[] =>
  collectFiles('src', exts).filter((f) => !f.path.startsWith('src/app/(payload)/'))

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')

// ---------- Tokens und Kontrast ----------

/** Liest alle Custom Properties aus `:root` (erster Block) von tokens.css. */
export function readTokens(css: string): Map<string, string> {
  const map = new Map<string, string>()
  const clean = stripComments(css)
  const rootBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(clean)?.[1] ?? ''
  for (const m of rootBlock.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) map.set(m[1]!, m[2]!.trim())
  return map
}

/** Löst `var(--x)`-Ketten auf. */
export function resolveToken(tokens: Map<string, string>, name: string, depth = 0): string {
  const v = tokens.get(name)
  if (v === undefined || depth > 10) throw new Error(`Token ${name} fehlt`)
  const ref = /^var\((--[\w-]+)\)$/.exec(v)
  return ref ? resolveToken(tokens, ref[1]!, depth + 1) : v
}

export type Rgb = [number, number, number]

export function parseHex(hex: string): Rgb {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as Rgb
}

const channel = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export const luminance = ([r, g, b]: Rgb) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

/** WCAG-2.2-Kontrastverhältnis. */
export function contrast(a: Rgb, b: Rgb): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Legt `rgb(r g b / a)` über eine Grundfarbe. */
export function composite(over: string, base: Rgb): Rgb {
  const m = /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\s*\)/.exec(over)
  if (!m) throw new Error(`Keine rgb()-Farbe: ${over}`)
  const alpha = Number(m[4])
  return [1, 2, 3].map((i) => Math.round(Number(m[i]) * alpha + base[i - 1]! * (1 - alpha))) as Rgb
}

// ---------- AK-DS-02 Farben ----------

export interface Violation {
  file: string
  line: number
  text: string
}

const lineOf = (source: string, index: number) => source.slice(0, index).split('\n').length

/** Wert-Ausdrücke der Eigenschaft `color` in CSS (`color: …`) und TSX-Stilobjekten (`color: '…'`). */
function colorValues(f: SourceFile): { value: string; index: number }[] {
  const out: { value: string; index: number }[] = []
  const src = stripComments(f.source)
  for (const m of src.matchAll(/(?<![-\w])color\s*:\s*([^;}\n]+)/gi)) {
    out.push({ value: m[1]!.trim().replace(/^['"`]|['"`],?$/g, ''), index: m.index })
  }
  return out
}

const FOX_ALLOWED =
  /(^|\/)(SoldStamp|CartLine)(\.module)?\.(css|scss|tsx)$|\/(SoldStamp|CartLine)\//

/** Tokens, deren Wert (aufgelöst) eine der verbotenen Textfarben ist, z. B. `--color-sold` → `--fox`. */
export function aliasesOf(tokens: Map<string, string>, target: RegExp): string[] {
  const out: string[] = []
  for (const name of tokens.keys()) {
    let cur = name
    for (let i = 0; i < 10; i++) {
      if (target.test(cur)) {
        out.push(name)
        break
      }
      const ref = /^var\((--[\w-]+)\)$/.exec(tokens.get(cur) ?? '')
      if (!ref) break
      cur = ref[1]!
    }
  }
  return out
}

export function lintColors(files: SourceFile[], tokens: Map<string, string>): Violation[] {
  const v: Violation[] = []
  const fox = new Set(aliasesOf(tokens, /^--fox$/))
  const neverText = new Set(aliasesOf(tokens, /^--(pink|clay|coco-[\w-]+|wash-[\w-]+)$/))
  for (const f of files) {
    for (const { value, index } of colorValues(f)) {
      const vars = [...value.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!)
      const push = (text: string) => v.push({ file: f.path, line: lineOf(f.source, index), text })
      if (vars.some((n) => fox.has(n)) && !FOX_ALLOWED.test(f.path))
        push(`color: ${value} – Fuchs nur in SoldStamp/CartLine`)
      if (vars.some((n) => neverText.has(n) || /^--(pink|clay|coco-|wash-)/.test(n)))
        push(`color: ${value} – Deko-/Kunstfarbe nie als Textfarbe`)
      if (
        /^(#fff|#ffffff|white)\b/i.test(value) ||
        /(?<![-\w])(#fff|#ffffff|white)(?![-\w])/i.test(value)
      )
        push(`color: ${value} – Weiß wird im UI nicht verwendet`)
    }
  }
  return v
}

// ---------- AK-DS-06 Schatten ----------

/** Teilt einen Wert an Kommas der obersten Ebene. */
function splitTopLevel(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of value) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  parts.push(cur)
  return parts.map((p) => p.trim()).filter(Boolean)
}

const LENGTH = /^-?(\d*\.?\d+)(px|rem|em|vw|vh|ch|%)?$/

/** Dritter Längenwert (Unschärfe) eines Schattens; `null`, wenn keiner angegeben. */
export function blurOf(shadow: string): number | null {
  const tokens = shadow
    .replace(/var\([^)]*\)|rgba?\([^)]*\)|hsla?\([^)]*\)|color-mix\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter((t) => LENGTH.test(t))
  if (tokens.length < 3) return null
  return Number.parseFloat(tokens[2]!)
}

export function lintShadows(files: SourceFile[]): Violation[] {
  const v: Violation[] = []
  for (const f of files) {
    const src = stripComments(f.source)
    const decls = [
      ...src.matchAll(
        /(?<![\w-])(box-shadow|text-shadow|boxShadow|textShadow|--shadow-[\w-]+)\s*:\s*['"`]?([^;}\n'"`]+)/g,
      ),
    ]
    for (const m of decls) {
      const value = m[2]!.trim()
      if (/^(none|inherit|initial|unset|var\([^)]*\))$/.test(value)) continue
      for (const shadow of splitTopLevel(value)) {
        const blur = blurOf(shadow)
        if (blur !== null && blur !== 0)
          v.push({ file: f.path, line: lineOf(src, m.index), text: `${m[1]}: ${value}` })
      }
    }
    for (const m of src.matchAll(/drop-shadow\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g)) {
      const blur = blurOf(m[1]!)
      if (blur !== null && blur !== 0)
        v.push({ file: f.path, line: lineOf(src, m.index), text: `drop-shadow(${m[1]})` })
    }
  }
  return v
}

// ---------- AK-DS-16 Bewegung ----------

const FORBIDDEN_EASING = /(?<![-\w])(ease-in-out|ease-in|ease-out|ease)(?![-\w])/

/** Verbotene Standard-Easings in CSS-Deklarationen und in TS/TSX (z. B. WAAPI `easing: 'ease-out'`). */
export function lintEasing(files: SourceFile[]): Violation[] {
  const v: Violation[] = []
  for (const f of files) {
    const src = stripComments(f.source)
    const re =
      /(?<![\w-])(transition(?:-timing-function)?|animation(?:-timing-function)?|transitionTimingFunction|animationTimingFunction|easing)\s*:\s*([^;}\n]+)/g
    for (const m of src.matchAll(re)) {
      if (FORBIDDEN_EASING.test(m[2]!))
        v.push({ file: f.path, line: lineOf(src, m.index), text: `${m[1]}: ${m[2]!.trim()}` })
    }
  }
  return v
}

/** Liefert alle `@keyframes`-Blöcke (Name, Inhalt, Position). */
export function keyframeBlocks(source: string): { name: string; body: string; index: number }[] {
  const out: { name: string; body: string; index: number }[] = []
  const src = stripComments(source)
  for (const m of src.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    let depth = 1
    let i = m.index + m[0].length
    const start = i
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') depth--
      i++
    }
    out.push({ name: m[1]!, body: src.slice(start, i - 1), index: m.index })
  }
  return out
}

const LAYOUT_PROPS = /(?<![\w-])(width|height|top|left|margin(?:-[a-z]+)?|box-shadow)\s*:/

export function lintKeyframes(files: SourceFile[]): Violation[] {
  const v: Violation[] = []
  for (const f of files) {
    for (const k of keyframeBlocks(f.source)) {
      const m = LAYOUT_PROPS.exec(k.body)
      if (m)
        v.push({
          file: f.path,
          line: lineOf(f.source, k.index),
          text: `@keyframes ${k.name} animiert ${m[1]}`,
        })
    }
  }
  return v
}

/** Routenordner der Ruheseiten (Presets `calm` und `legal`, DESIGN §9.7/§11.6) laut Registry. */
export function calmFolders(): string[] {
  return ROUTES.filter((r) => (r.preset === 'calm' || r.preset === 'legal') && r.key).map(
    (r) => `src/app/(frontend)/[locale]${r.key}/`,
  )
}

export const CALM_COMPONENT_DIRS = ['src/components/checkout/']

export function lintCalmTransitions(files: SourceFile[], dirs: string[]): Violation[] {
  const v: Violation[] = []
  for (const f of files) {
    if (!dirs.some((d) => f.path.startsWith(d))) continue
    const src = stripComments(f.source)
    for (const m of src.matchAll(/(?<![\w-])(transition(?:-[a-z]+)?|transition[A-Z]\w*)\s*:/g)) {
      v.push({ file: f.path, line: lineOf(src, m.index), text: `${m[1]} auf einer Ruheseite` })
    }
  }
  return v
}
