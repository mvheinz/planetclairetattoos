import { describe, expect, it } from 'vitest'

import { escapeHtml, euro, renderPruefliste } from '../../../scripts/bestand/pruefliste-render'
import { loadBestand, photosOf } from '@/lib/bestand/schema'

// P16.3: Prüfliste für Jutta – alle Stücke, alle Prüfpunkte, eingebettete Fotos, keine Anfragen nach außen.

describe('Prüfliste (dist/planet-claire-pruefliste.html)', async () => {
  const products = await loadBestand()
  const thumbs = new Map(
    products.flatMap((p) =>
      photosOf(p).map((i) => [i.file, 'data:image/jpeg;base64,AAAA'] as const),
    ),
  )
  const html = renderPruefliste({ products, thumbs, date: '10.10.2026' })

  it('jedes Stück mit Nummer, Name, Preis und allen Prüfpunkten; jedes Foto eingebettet', () => {
    for (const p of products) {
      expect(html).toContain(`id="${p.key}"`)
      expect(html).toContain(`Nr. ${p.itemNumber}`)
      expect(html).toContain(escapeHtml(p.title.de))
      expect(html).toContain(euro(p.priceCents))
      for (const r of p.review) expect(html).toContain(escapeHtml(r))
    }
    const imgs = html.match(/<img src="data:image\/jpeg;base64,/g) ?? []
    expect(imgs).toHaveLength(thumbs.size)
  })

  it('offline: keine externen Adressen, keine Skripte, keine vorangekreuzten Häkchen', () => {
    expect(html).not.toMatch(/(?:src|href)="https?:/)
    expect(html).not.toMatch(/<script/)
    expect(html).not.toMatch(/\bchecked\b/)
    expect(html).toMatch(/^<!doctype html>/)
  })

  it('aus der Excel-Liste (U-86): verkauft, Metallteile und Juttas Notiz sichtbar', () => {
    const [first, ...rest] = products
    const edited = renderPruefliste({
      products: [
        {
          ...first!,
          sold: { date: '2026-10-11', priceCents: 3500, note: 'Markt' },
          ownerNote: 'Preis prüfen',
        },
        ...rest,
      ],
      thumbs,
      date: '11.10.2026',
    })
    const card = edited.slice(edited.indexOf(`id="${first!.key}"`), edited.indexOf('</article>'))
    expect(card).toContain('<span class="sold">verkauft</span>')
    expect(card).toContain('<dt>Verkauft</dt><dd>11.10.2026 35 € Markt</dd>')
    expect(card).toContain('<dt>Deine Notiz</dt><dd>Preis prüfen</dd>')
    expect(html).not.toContain('class="sold"')
  })

  it('maskiert HTML in Texten', () => {
    expect(escapeHtml('<b>"A" & B</b>')).toBe('&lt;b&gt;&quot;A&quot; &amp; B&lt;/b&gt;')
  })
})
