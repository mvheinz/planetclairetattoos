import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import base from '../../../content/seed/data/base.json'

import {
  buildLegalTokenValues,
  LEGAL_TOKENS,
  LegalRenderError,
  renderLegalContent,
  renderLegalString,
  type LegalTokenSettings,
} from '@/lib/legal/render'
import { toLexical } from '@/lib/seed/lexical'

// P6.3 Renderer (R-012, R-095, KANZLEI-BRIEFING §16.3): geschlossene Token-Liste, Platzhalter-Belehrung mit
// aufgelöster Widerrufs-URL und Telefonnummer.

const ROOT = path.resolve(import.meta.dirname, '../../..')
const SITE = 'https://planetclairetattoos.com'
const PHONE = '+49 30 1234 5678'

type BaseLegalText = { type: string; sections: { heading: string; paragraphs: string[] }[] }

const settings = {
  ...(base.settings as unknown as LegalTokenSettings),
  business: { ...(base.settings as unknown as LegalTokenSettings).business, phone: PHONE },
} as LegalTokenSettings

function placeholder(type: string) {
  const text = (base.legalTexts as BaseLegalText[]).find((t) => t.type === type)!
  const md = text.sections
    .map((s) => [`## ${s.heading}`, ...s.paragraphs].join('\n\n'))
    .join('\n\n')
  return toLexical(md) as never
}

/** `{{token}}`-Liste eines Dokumentabschnitts (zwischen zwei Überschriften). */
function tokensIn(file: string, startHeading: RegExp): string[] {
  const lines = readFileSync(path.join(ROOT, file), 'utf8').split('\n')
  const start = lines.findIndex((l) => startHeading.test(l))
  expect(start, `${file}: ${startHeading}`).toBeGreaterThanOrEqual(0)
  const level = /^#+/.exec(lines[start]!)![0].length
  const end = lines.findIndex(
    (l, i) => i > start && /^#+ /.test(l) && /^#+/.exec(l)![0].length <= level,
  )
  const section = lines.slice(start, end === -1 ? undefined : end).join('\n')
  return [...new Set([...section.matchAll(/\{\{([A-Za-z.]+)\}\}/g)].map((m) => m[1]!))]
}

describe('R-095 Platzhalter-Belehrung und Token-Liste (P6.3)', () => {
  it('R-095 gerenderte Platzhalter-Belehrung (DE) enthält genau die R26-URL und die Telefonnummer', () => {
    const values = buildLegalTokenValues({
      settings,
      siteUrl: SITE,
      locale: 'de',
      returnCostsNote: 'Die unmittelbaren Kosten der Rücksendung der Waren trägst du.',
    })
    const r = renderLegalContent(placeholder('widerrufsbelehrung'), values)
    expect(r.plainText).toContain(`${SITE}/de/vertrag-widerrufen`)
    expect(r.plainText).toContain(PHONE)
    expect(r.plainText).not.toMatch(/\{\{|\}\}/)
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('R-095 EN-Lesefassung löst {{withdrawalUrl}} zur englischen Adresse auf', () => {
    const values = buildLegalTokenValues({ settings, siteUrl: `${SITE}/`, locale: 'en' })
    expect(renderLegalString('{{withdrawalUrl}}', values)).toBe(`${SITE}/en/withdraw-from-contract`)
  })

  it('R-095 Render-Fehler: {{unknown}}, {{NAME}}, {{processorTable}}, {{STEUERNUMMER}}', () => {
    const values = buildLegalTokenValues({ settings, siteUrl: SITE, locale: 'de' })
    for (const bad of ['{{unknown}}', '{{NAME}}', '{{processorTable}}', '{{STEUERNUMMER}}']) {
      expect(() => renderLegalString(`Text ${bad}`, values), bad).toThrow(LegalRenderError)
    }
    // Leere Werte nur für W-IdNr./USt-IdNr.
    const noPhone = buildLegalTokenValues({
      settings: { ...settings, business: { ...settings.business, phone: '' } },
      siteUrl: SITE,
      locale: 'de',
    })
    expect(() => renderLegalString('Tel. {{phone}}', noPhone)).toThrow(/ohne Wert/)
    expect(renderLegalString('USt-IdNr. {{ustIdNr}}', noPhone)).toBe('USt-IdNr. ')
  })

  it('R-095 Token-Liste des Renderers = R-012 = DATENMODELL §6.12 = KANZLEI-BRIEFING §16.3', () => {
    const renderer = [...LEGAL_TOKENS].sort()
    expect(renderer).toHaveLength(14)
    const r012 = tokensIn('docs/recht/ANFORDERUNGEN.md', /^#### R-012 /).filter(
      (t) => !['STEUERNUMMER', 'orderNumber', 'unknown'].includes(t),
    )
    const dm = tokensIn('docs/DATENMODELL.md', /^### 6\.12 /).filter(
      (t) => !['STEUERNUMMER', 'unknown', 'business.street'].includes(t),
    )
    const kb = tokensIn('docs/recht/KANZLEI-BRIEFING.md', /^### 16\.3 /)
    expect(r012.sort()).toEqual(renderer)
    expect(dm.sort()).toEqual(renderer)
    expect(kb.sort()).toEqual(renderer)
  })
})

describe('Bereinigung eingefügter Rechtstexte (KANZLEI-BRIEFING §1.2)', () => {
  it('R-012 nur erlaubte Elemente; keine Styles, Klassen, Skripte oder fremde Protokolle; Tokens bleiben', async () => {
    const { sanitizeLegalHtml, legalPlainTextToHtml } = await import('@/lib/legal/sanitize')
    const dirty =
      '<h1 class="x">Titel</h1><p style="color:red" onclick="x()">Text <b>fett</b> <i>kursiv</i>' +
      '<script>alert(1)</script><img src="https://evil.example/x.png"></p>' +
      '<p><a href="javascript:alert(1)">böse</a> <a href="{{withdrawalUrl}}" target="_blank">Widerruf</a>' +
      ' <a href="mailto:jutta@planetclairetattoos.com">Mail</a></p><iframe src="https://x"></iframe>' +
      '<table><thead><tr><th>Klasse</th></tr></thead><tbody><tr><td>{{shippingTable}}</td></tr></tbody></table>'
    const clean = sanitizeLegalHtml(dirty)
    expect(clean).toBe(
      '<h2>Titel</h2><p>Text <strong>fett</strong> <em>kursiv</em></p>' +
        '<p><a>böse</a> <a href="{{withdrawalUrl}}">Widerruf</a>' +
        ' <a href="mailto:jutta@planetclairetattoos.com">Mail</a></p>' +
        '<table><thead><tr><th>Klasse</th></tr></thead><tbody><tr><td>{{shippingTable}}</td></tr></tbody></table>',
    )
    expect(sanitizeLegalHtml(clean)).toBe(clean)
    expect(legalPlainTextToHtml('Absatz 1\nZeile 2\n\n<b>Absatz</b> 2')).toBe(
      '<p>Absatz 1<br>Zeile 2</p><p>&lt;b&gt;Absatz&lt;/b&gt; 2</p>',
    )
  })
})
