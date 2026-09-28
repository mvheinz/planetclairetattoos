// Aufbau und Schreiben der Vorschau-Datei (KONZEPT §12.4, ARCHITEKTUR §14.5): Kopf mit `robots noindex` und CSP-Meta,
// ein `<style>`, Banner- und Seiten-Container, Sprites, Templates, `#pv-data`, `#pv-assets`, Laufzeit. Deterministisch:
// feste Reihenfolgen (sortiert), keine Zeitstempel – nur das Stand-Datum (Tag) aus `SEED_NOW`.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { PvData } from '../../src/preview-runtime/types'

/** CSP der Datei (ARCHITEKTUR §14.5): verhindert jedes Nachladen technisch. */
export const PREVIEW_CSP = [
  "default-src 'none'",
  'img-src data: blob:',
  'media-src data: blob:',
  "style-src 'unsafe-inline'",
  'font-src data:',
  "script-src 'unsafe-inline'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

/** Stile der Vorschau-Elemente (Banner, Liste „Alle Seiten“, Dialog, Korb-Hinweis, Zusatzseiten). */
export const PV_CSS = `
#pv-banner{position:relative;z-index:60;background:var(--ink,#1c1a17);color:var(--paper,#f4efe6);font-family:var(--font-body,system-ui,sans-serif);font-size:0.875rem;line-height:1.4;padding:0.5rem 1rem;display:flex;flex-wrap:wrap;gap:0.25rem 1rem;align-items:center}
#pv-banner .pv-banner__line{margin:0;flex:1 1 100%}
#pv-banner .pv-banner__line--strong{font-weight:700}
#pv-banner .pv-banner__toggle{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:4px;min-height:44px;padding:0.25rem 0.75rem;cursor:pointer}
#pv-banner .pv-banner__toggle:focus-visible,#pv-banner a:focus-visible,.pv-dialog__close:focus-visible{outline:3px solid var(--color-focus,#c23b2a);outline-offset:2px}
#pv-all{flex:1 1 100%;display:grid;gap:0.5rem 1.5rem;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));padding:0.5rem 0 0.75rem}
#pv-all[hidden]{display:none}
#pv-all h2{font-size:0.875rem;margin:0 0 0.25rem;text-transform:uppercase;letter-spacing:0.04em}
#pv-all ul{margin:0;padding:0;list-style:none}
#pv-all li{padding:0.125rem 0}
#pv-all a{color:inherit;display:inline-block;min-height:24px}
#pv-all .pv-all__missing{opacity:0.75;font-style:italic}
#pv-dialog{border:2px solid var(--ink,#1c1a17);border-radius:6px;background:var(--paper,#f4efe6);color:var(--ink,#1c1a17);font-family:var(--font-body,system-ui,sans-serif);padding:1.5rem;max-width:min(26rem,calc(100vw - 2rem))}
#pv-dialog::backdrop{background:rgb(28 26 23 / 0.45)}
.pv-dialog__title{font-size:1.125rem;font-weight:700;margin:0 0 1rem}
.pv-dialog__close{font:inherit;min-height:44px;padding:0.5rem 1rem;border:2px solid var(--ink,#1c1a17);border-radius:4px;background:var(--ink,#1c1a17);color:var(--paper,#f4efe6);cursor:pointer}
.pv-cart-note{position:fixed;left:50%;bottom:1rem;transform:translateX(-50%);z-index:70;margin:0;background:var(--ink,#1c1a17);color:var(--paper,#f4efe6);font-family:var(--font-body,system-ui,sans-serif);padding:0.75rem 1rem;border-radius:6px;max-width:calc(100vw - 2rem)}
.pv-cart-note[hidden]{display:none}
.pv-admin{list-style:none;margin:1.5rem 0 0;padding:0;display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fill,minmax(min(100%,16rem),1fr))}
.pv-admin figure{margin:0}
.pv-admin img{display:block;width:100%;height:auto;border:1px solid var(--color-border-ui,#8a8479);border-radius:8px}
.pv-admin figcaption,.pv-admin__missing{font-size:0.9375rem;margin-top:0.5rem}
.pv-admin__missing{padding:1rem;border:1px dashed var(--color-border-ui,#8a8479);border-radius:8px}
`.trim()

/** JSON sicher in `<script type="application/json">` (kein `</script>`, kein `<!--`). */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/** Laufzeit sicher in `<script>` einbetten. */
export function scriptForHtml(code: string): string {
  return code.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--')
}

const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export interface DocumentParts {
  htmlClass: string
  title: string
  css: string
  sprites: string
  templates: string[]
  data: PvData
  /** Hash → Data-URI (Reihenfolge wird sortiert). */
  assets: Map<string, string>
  runtime: string
}

export function buildDocument(parts: DocumentParts): string {
  const assets: Record<string, string> = {}
  for (const key of [...parts.assets.keys()].sort()) assets[key] = parts.assets.get(key)!
  return [
    '<!doctype html>',
    `<html lang="de"${parts.htmlClass ? ` class="${escapeHtml(parts.htmlClass)}"` : ''}>`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex, nofollow">',
    `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`,
    `<title>${escapeHtml(parts.title)}</title>`,
    `<style>${parts.css}\n${PV_CSS}</style>`,
    '</head>',
    '<body>',
    '<div id="pv-banner"></div>',
    '<div id="pv-root"></div>',
    parts.sprites,
    ...parts.templates,
    `<script type="application/json" id="pv-data">${jsonForScript(parts.data)}</script>`,
    `<script type="application/json" id="pv-assets">${jsonForScript(assets)}</script>`,
    `<script>${scriptForHtml(parts.runtime)}</script>`,
    '</body>',
    '</html>',
  ]
    .filter((line) => line !== '')
    .join('\n')
    .concat('\n')
}

export function writeOutput(root: string, dir: string, file: string, content: string): string {
  const target = path.join(root, dir, file)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, content)
  return target
}
