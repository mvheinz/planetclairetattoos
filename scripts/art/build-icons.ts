// `pnpm art:icons` (PLAN P2.5, DESIGN §6.5): liest die Icon-Quellen `src/art/icons/*.svg` (je ≤ 600 B, 24er-viewBox,
// Strich 1.75, `currentColor`) und erzeugt `src/components/icons/icons.generated.ts` – die Formen als Daten für die
// Inline-SVG-Komponente `Icon` (kein Sprite, kein `<use href>`).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const ICON_SOURCE_DIR = 'src/art/icons'
export const ICON_MAX_BYTES = 600
/** Bestand laut DESIGN §6.5 (Reihenfolge wie dort). */
export const ICON_NAMES = [
  'basket',
  'menu',
  'close',
  'arrow-right',
  'arrow-left',
  'external',
  'mail',
  'instagram',
  'copy',
  'zoom',
  'check',
  'warn',
  'info',
  'planet',
  'star',
  'truck',
  'pickup',
  'withdraw',
  // ab P3 (KO-10 Badges „reserviert“ und „Deko – nicht für Lebensmittel“)
  'clock',
  'plate-off',
] as const

const ALLOWED_TAGS = new Set(['path', 'circle', 'ellipse', 'line', 'polyline', 'rect'])
const ALLOWED_ATTRS = new Set([
  'd',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'width',
  'height',
  'points',
  'transform',
])

export type IconShape = [tag: string, attrs: Record<string, string>]

/** Formen einer Icon-Quelle; wirft bei fremden Elementen/Attributen oder falschem Rahmen. */
export function parseIcon(svg: string, name: string): IconShape[] {
  const root = /^<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(svg.trim())
  if (!root) throw new Error(`${name}: keine SVG-Datei`)
  const rootAttrs = root[1]!
  for (const required of [
    'viewBox="0 0 24 24"',
    'stroke="currentColor"',
    'stroke-width="1.75"',
    'stroke-linecap="round"',
    'stroke-linejoin="round"',
    'fill="none"',
  ]) {
    if (!rootAttrs.includes(required)) throw new Error(`${name}: ${required} fehlt (DESIGN §6.5)`)
  }
  const shapes: IconShape[] = []
  const inner = root[2]!.trim()
  const re = /<([a-z]+)\b([^>]*?)\/>/g
  let consumed = ''
  for (const m of inner.matchAll(re)) {
    const tag = m[1]!
    if (!ALLOWED_TAGS.has(tag)) throw new Error(`${name}: Element <${tag}> nicht erlaubt`)
    const attrs: Record<string, string> = {}
    for (const a of m[2]!.matchAll(/([a-zA-Z0-9-]+)="([^"]*)"/g)) {
      if (!ALLOWED_ATTRS.has(a[1]!)) throw new Error(`${name}: Attribut ${a[1]} nicht erlaubt`)
      attrs[a[1]!] = a[2]!
    }
    shapes.push([tag, attrs])
    consumed += m[0]
  }
  if (consumed.replace(/\s/g, '') !== inner.replace(/\s/g, ''))
    throw new Error(`${name}: unerwarteter Inhalt`)
  if (shapes.length === 0) throw new Error(`${name}: keine Formen`)
  return shapes
}

export function readIconSources(
  root = process.cwd(),
): Record<string, { bytes: number; shapes: IconShape[] }> {
  const dir = path.join(root, ICON_SOURCE_DIR)
  const out: Record<string, { bytes: number; shapes: IconShape[] }> = {}
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.svg'))
    .sort()) {
    const name = file.replace(/\.svg$/, '')
    const svg = readFileSync(path.join(dir, file), 'utf8')
    out[name] = { bytes: Buffer.byteLength(svg), shapes: parseIcon(svg, name) }
  }
  return out
}

export function iconsModule(sources: Record<string, { shapes: IconShape[] }>): string {
  const lines = ICON_NAMES.map((name) => {
    const src = sources[name]
    if (!src) throw new Error(`Icon-Quelle ${name}.svg fehlt`)
    return `  '${name}': ${JSON.stringify(src.shapes)},`
  })
  return [
    '// Erzeugt von `pnpm art:icons` (scripts/art/build-icons.ts) aus src/art/icons/*.svg – nicht von Hand ändern.',
    'export const ICON_SHAPES = {',
    ...lines,
    '} as const satisfies Record<string, readonly (readonly [string, Record<string, string>])[]>',
    '',
    'export type IconName = keyof typeof ICON_SHAPES',
    '',
  ].join('\n')
}

function main(): void {
  const sources = readIconSources()
  const extra = Object.keys(sources).filter((n) => !(ICON_NAMES as readonly string[]).includes(n))
  if (extra.length > 0)
    throw new Error(`Icons außerhalb des Bestands (DESIGN §6.5): ${extra.join(', ')}`)
  for (const [name, { bytes }] of Object.entries(sources)) {
    if (bytes > ICON_MAX_BYTES) throw new Error(`${name}.svg: ${bytes} B > ${ICON_MAX_BYTES} B`)
  }
  writeFileSync(path.resolve('src/components/icons/icons.generated.ts'), iconsModule(sources))
  console.log(`art:icons: ${ICON_NAMES.length} Icons erzeugt`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
