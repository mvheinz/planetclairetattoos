// Prüfliste für Jutta (U-76, PLAN P16.3): eine einzelne HTML-Datei mit allen Stücken aus `content/bestand` – Fotos
// (klein, eingebettet), Name DE/EN, Kategorie, Preis, Maße, Gewicht und die Punkte, die sie prüfen soll. Offline, ohne
// Anfragen nach außen, druckbar. Nur Deutsch (Arbeitsliste wie die Verwaltung). Reine Funktion; die Fotos verkleinert
// `pruefliste.ts`.
import type { BestandProduct } from '../../src/lib/bestand/schema'

export interface PrueflisteInput {
  products: readonly BestandProduct[]
  /** Eingebettete Vorschaubilder je Dateiname (`data:image/jpeg;base64,…`). */
  thumbs: ReadonlyMap<string, string>
  /** Stand (Anzeige), z. B. „10.10.2026“. */
  date: string
}

const CATEGORY: Record<string, string> = {
  keramik: 'Keramik',
  textil: 'Textil',
  cap: 'Cap',
  zeichnung: 'Zeichnung',
  schmuck: 'Schmuck',
  sonstiges: 'Sonstiges',
}

const CONDITION: Record<string, string> = {
  like_new: 'wie neu',
  very_good: 'sehr gut',
  good: 'gut',
  worn: 'deutliche Gebrauchsspuren',
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const euro = (cents: number): string =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)

const cm = (v: number) => `${String(v).replace('.', ',')} cm`

function dimensions(p: BestandProduct): string {
  const d = p.dimensions
  const parts = [
    d.widthCm !== undefined ? `B ${cm(d.widthCm)}` : '',
    d.heightCm !== undefined ? `H ${cm(d.heightCm)}` : '',
    d.depthCm !== undefined ? `T ${cm(d.depthCm)}` : '',
    d.diameterCm !== undefined ? `⌀ ${cm(d.diameterCm)}` : '',
  ].filter(Boolean)
  return [parts.join(' · '), d.note?.de ?? ''].filter(Boolean).join(' – ') || '–'
}

function row(label: string, value: string): string {
  return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`
}

function card(p: BestandProduct, thumbs: ReadonlyMap<string, string>): string {
  const photos = [...p.images, ...(p.scalePhoto ? [p.scalePhoto] : [])]
    .map((i) => {
      const src = thumbs.get(i.file)
      return src
        ? `<img src="${src}" alt="${escapeHtml(i.alt.de)}" loading="lazy" width="150" height="150">`
        : ''
    })
    .join('')
  const facts = [
    row('Kategorie', CATEGORY[p.category] ?? p.category),
    row('Preis (Vorschlag)', euro(p.priceCents)),
    row('Maße', dimensions(p)),
    row('Gewicht', `${p.weightGrams} g (geschätzt)`),
    row('Material', p.materials.de),
    p.sizeLabel ? row('Größe', p.sizeLabel.de) : '',
    p.condition ? row('Zustand', CONDITION[p.condition] ?? p.condition) : '',
    p.isSecondHand !== undefined ? row('Second Hand', p.isSecondHand ? 'ja' : 'nein') : '',
    p.deviationDescription ? row('Abweichung', p.deviationDescription.de) : '',
  ].join('')
  const checks = p.review
    .map(
      (r, i) =>
        `<li><input type="checkbox" id="${p.key}-${i}"><label for="${p.key}-${i}">${escapeHtml(r)}</label></li>`,
    )
    .join('')
  return `<article id="${p.key}">
<header><span class="nr">Nr. ${String(p.itemNumber).padStart(3, '0')}</span><h2>${escapeHtml(p.title.de)}</h2><p class="en">${escapeHtml(p.title.en)}</p></header>
<div class="photos">${photos}</div>
<p class="desc">${escapeHtml(p.description.de)}</p>
<dl>${facts}</dl>
<h3>Bitte prüfen</h3>
<ul class="checks">${checks}</ul>
</article>`
}

export function renderPruefliste(input: PrueflisteInput): string {
  const counts = new Map<string, number>()
  for (const p of input.products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1)
  const summary = [...counts].map(([c, n]) => `${n} × ${CATEGORY[c] ?? c}`).join(' · ')
  const toc = input.products
    .map(
      (p) =>
        `<li><a href="#${p.key}">${String(p.itemNumber).padStart(3, '0')} ${escapeHtml(p.title.de)}</a></li>`,
    )
    .join('')
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Prüfliste Bestand</title>
<style>
:root{--ink:#1c1a17;--paper:#faf7f0;--line:#d9d2c3;--muted:#6b645a;--accent:#8a2e2e}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ink:#efe9dc;--paper:#1d1b18;--line:#3b372f;--muted:#a59d8f;--accent:#e08b7a}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:56rem;margin:0 auto;padding:1.5rem 16px 4rem}
h1{font-size:1.75rem;margin:0 0 .25rem}
.lead{color:var(--muted);margin:0 0 1.5rem}
.toc{columns:2 16rem;padding-left:1.2rem;font-size:.9rem;margin:0 0 2rem}
.toc a{color:inherit}
article{border-top:2px solid var(--line);padding:1.5rem 0;break-inside:avoid}
article header{display:flex;flex-wrap:wrap;align-items:baseline;gap:.25rem .75rem}
.nr{font-variant-numeric:tabular-nums;color:var(--accent);font-weight:600}
h2{font-size:1.25rem;margin:0}
.en{color:var(--muted);margin:0;width:100%}
.photos{display:flex;flex-wrap:wrap;gap:.5rem;margin:.75rem 0}
.photos img{width:150px;height:150px;object-fit:cover;border-radius:4px;background:var(--line)}
.desc{margin:.5rem 0}
dl{display:grid;grid-template-columns:max-content 1fr;gap:.25rem .75rem;margin:.75rem 0;font-size:.95rem}
dt{color:var(--muted)}
dd{margin:0}
h3{font-size:1rem;margin:1rem 0 .25rem}
.checks{list-style:none;padding:0;margin:0}
.checks li{display:flex;gap:.5rem;align-items:flex-start;padding:.2rem 0}
.checks input{margin-top:.3rem;flex:none;width:1.1rem;height:1.1rem}
@media print{.toc{display:none}article{page-break-inside:avoid}}
</style>
</head>
<body>
<main>
<h1>Prüfliste: deine Stücke für den Shop</h1>
<p class="lead">Stand ${escapeHtml(input.date)} · ${input.products.length} Stücke (${escapeHtml(summary)}). Alles stammt aus deinen Fotos – Preise, Maße und Gewichte sind Schätzungen. In der Verwaltung sind die Stücke Entwürfe mit rotem Vermerk; die Punkte unten stehen dort auch unter „Interne Notiz“. Die Häkchen hier speichern nichts.</p>
<ol class="toc">${toc}</ol>
${input.products.map((p) => card(p, input.thumbs)).join('\n')}
</main>
</body>
</html>
`
}
