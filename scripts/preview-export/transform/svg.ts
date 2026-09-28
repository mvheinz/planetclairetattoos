// SVG-Sprites der Vorschau-Datei (ARCHITEKTUR §14.5, DESIGN §9.12): externe Sprites unter `public/art/` (z. B.
// `coco-sprite.v1.svg`) werden einmal als `<svg id="pv-sprites" hidden aria-hidden="true">` mit ihren `<symbol>`s
// eingebettet; `<use href="/art/…svg#id">` wird zu `<use href="#id">`. Symbol-IDs sind projektweit eindeutig – eine
// doppelte ID ist ein Fehler (Exit 1). Einzel-SVGs (Icons, Zeichnungen) bleiben inline im Template.
import * as cheerio from 'cheerio'

import { ExportError } from '../errors'

/** `href` eines `<use>` → `#id`, falls es auf eine Sprite-Datei zeigt; sonst `null`. */
export function spriteUseTarget(href: string): { file: string; id: string } | null {
  const m = /^([^#]+\.svg)(?:\?[^#]*)?#(.+)$/.exec(href)
  return m ? { file: m[1]!, id: m[2]! } : null
}

/** Baut `#pv-sprites` aus den Sprite-Dateien (sortiert nach Pfad → deterministisch). */
export function buildSpriteSheet(sprites: readonly { path: string; svg: string }[]): string {
  const ids = new Map<string, string>()
  const defs: string[] = []
  const styles: string[] = []
  const symbols: string[] = []
  for (const sprite of [...sprites].sort((a, b) => a.path.localeCompare(b.path))) {
    const $ = cheerio.load(sprite.svg, { xml: true })
    // Sprite-Stile (z. B. `.fur`, `.harness`) wie in der ausgelieferten Datei; die Klassen gibt es nur in den Symbolen.
    $('svg > style').each((_, el) => {
      const css = $(el).text().trim()
      if (css) styles.push(css)
    })
    $('defs').each((_, el) => {
      const inner = $(el).html()?.trim()
      if (inner) defs.push(inner)
    })
    $('symbol').each((_, el) => {
      const id = $(el).attr('id')
      if (!id) return
      const other = ids.get(id)
      if (other) {
        throw new ExportError(1, `Symbol-ID „${id}“ doppelt (${other}, ${sprite.path}).`)
      }
      ids.set(id, sprite.path)
      symbols.push($.xml(el))
    })
  }
  if (symbols.length === 0 && defs.length === 0) return ''
  const style = styles.length ? `<style>${styles.join('\n')}</style>` : ''
  const defsEl = defs.length ? `<defs>${defs.join('')}</defs>` : ''
  return `<svg id="pv-sprites" xmlns="http://www.w3.org/2000/svg" hidden aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">${style}${defsEl}${symbols.join('')}</svg>`
}
