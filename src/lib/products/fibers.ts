import { ENUM_LABELS } from '@/lib/enumLabels'
import {
  FIBER_COMPONENTS,
  TEXTILE_FIBERS,
  type FiberComponent,
  type Locale,
  type TextileFiber,
} from '@/lib/enums'

// Faserzusammensetzung (E-16, R-043, DATENMODELL §6.6.5). Reines Modul (auch im Browser nutzbar).

export interface FiberRow {
  component?: FiberComponent | string | null
  fiber?: TextileFiber | string | null
  percent?: number | null
}

const COMPONENT_ORDER: readonly FiberComponent[] = ['main', 'lining', 'trim', 'other']

function fiberName(fiber: string, locale: Locale): string {
  const label = ENUM_LABELS.TEXTILE_FIBERS[fiber as TextileFiber]
  if (!label) return fiber
  // Auf Englisch: amtliche deutsche Bezeichnung plus Übersetzung in Klammern (R-043).
  return locale === 'en' && label.en ? `${label.de} (${label.en})` : label.de
}

/**
 * „60 % Baumwolle, 40 % Polyester“; weitere Komponenten mit Präfix („Futter: 100 % Polyester“), je Komponente
 * absteigend nach Anteil.
 */
export function formatFibers(rows: readonly FiberRow[] | null | undefined, locale: Locale): string {
  if (!rows?.length) return ''
  const parts: string[] = []
  for (const component of COMPONENT_ORDER) {
    const list = rows
      .filter((r) => (r.component ?? 'main') === component && r.fiber && r.percent)
      .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
      .map((r) => `${r.percent} % ${fiberName(String(r.fiber), locale)}`)
    if (list.length === 0) continue
    const label = ENUM_LABELS.FIBER_COMPONENTS[component]
    const prefix = component === 'main' ? '' : `${locale === 'en' ? label.en : label.de}: `
    parts.push(prefix + list.join(', '))
  }
  return parts.join('; ')
}

// Amtliche Faserbezeichnungen: VO (EU) Nr. 1007/2011, Anhang I Tabelle 1 und 2 (ABl. L 272 vom 18.10.2011, S. 1;
// deutsche Fassung, EUR-Lex CELEX 32011R1007, abgeglichen am 27.09.2026), ergänzt durch die Delegierten Verordnungen
// (EU) Nr. 286/2012 (Nr. 49, Polypropylen/Polyamid-Bikomponentenfaser) und (EU) 2018/122 (Nr. 50, Polyacrylat).
// Abgleich: Die deutschen Anzeigenamen in `ENUM_LABELS.TEXTILE_FIBERS` folgen der Spalte „Bezeichnung“ (u. a.
// Nr. 10 „Manila“, Nr. 23 „Regenerierte Proteinfaser“, Nr. 27 „Polychlorid“, Nr. 38 „Polyharnstoff“, Nr. 2
// „Fischotter“; Nr. 26 „Polyacryl“ laut Berichtigung – die Erstfassung nennt dort irrtümlich „Seide“). Nr. 48 lässt
// die Bezeichnung nach dem Stoff zu („Metall“, „Papier“ mit Zusatz „Faser“); `other_fibres` ist „sonstige Fasern“
// (Art. 9 Abs. 3).
export { TEXTILE_FIBERS }

/** Nummer in Anhang I je Wert (`null` = keine eigene Nummer, Art. 9 Abs. 3). */
export const TEXTILE_FIBER_ANNEX: Readonly<Record<TextileFiber, number | null>> = {
  wool: 1,
  alpaca: 2,
  llama: 2,
  camel: 2,
  cashmere: 2,
  mohair: 2,
  angora: 2,
  vicuna: 2,
  yak: 2,
  guanaco: 2,
  cashgora: 2,
  beaver: 2,
  otter: 2,
  animal_hair: 3,
  horsehair: 3,
  silk: 4,
  cotton: 5,
  kapok: 6,
  flax: 7,
  hemp: 8,
  jute: 9,
  abaca: 10,
  alfa: 11,
  coir: 12,
  broom: 13,
  ramie: 14,
  sisal: 15,
  sunn: 16,
  henequen: 17,
  maguey: 18,
  acetate: 19,
  alginate: 20,
  cupro: 21,
  modal: 22,
  protein: 23,
  triacetate: 24,
  viscose: 25,
  acrylic: 26,
  chlorofibre: 27,
  fluorofibre: 28,
  modacrylic: 29,
  polyamide: 30,
  aramid: 31,
  polyimide: 32,
  lyocell: 33,
  polylactide: 34,
  polyester: 35,
  polyethylene: 36,
  polypropylene: 37,
  polycarbamide: 38,
  polyurethane: 39,
  vinylal: 40,
  trivinyl: 41,
  elastodiene: 42,
  elastane: 43,
  glass_fibre: 44,
  elastomultiester: 45,
  elastolefin: 46,
  melamine: 47,
  metal_fibre: 48,
  paper_fibre: 48,
  pp_pa_bicomponent: 49,
  polyacrylate: 50,
  other_fibres: null,
}

/** „sonstige Fasern“ höchstens 15 % je Komponente (§6.6.5). */
export const OTHER_FIBRES_MAX_PERCENT = 15

export interface FiberIssue {
  field: 'fiberComposition' | 'fiberFreeText'
  message: string
}

const COMPONENT_LABEL = (c: string) => ENUM_LABELS.FIBER_COMPONENTS[c as FiberComponent]?.de ?? c

/**
 * Regeln §6.6.5 (E-16, R-043): mindestens eine Zeile „Hauptstoff“, nur amtliche Fasern, Ganzzahlen 1–100, je
 * Komponente Summe genau 100 und keine Faser doppelt, „sonstige Fasern“ ≤ 15 %; bei fehlendem Etikett zusätzlich
 * `fiberFreeText` (DE). Meldungen deutsch, mit Feldname.
 */
export function checkFibers(
  rows: readonly FiberRow[] | null | undefined,
  opts: { labelMissing?: boolean | null; fiberFreeTextDe?: string | null } = {},
): FiberIssue[] {
  const issues: FiberIssue[] = []
  const add = (message: string) => issues.push({ field: 'fiberComposition', message })
  const list = rows ?? []
  if (list.length === 0) {
    add(
      opts.labelMissing
        ? 'Faserzusammensetzung fehlt – auch ohne Etikett nach bestem Wissen angeben.'
        : 'Faserzusammensetzung fehlt.',
    )
  } else {
    if (!list.some((r) => (r.component ?? 'main') === 'main')) {
      add('Faserzusammensetzung: mindestens eine Zeile „Hauptstoff“ angeben.')
    }
    const byComponent = new Map<string, FiberRow[]>()
    for (const row of list) {
      const component = String(row.component ?? 'main')
      if (!(FIBER_COMPONENTS as readonly string[]).includes(component)) {
        add(`Faserzusammensetzung: unbekannter Teil „${component}“.`)
        continue
      }
      if (!row.fiber || !(TEXTILE_FIBERS as readonly string[]).includes(String(row.fiber))) {
        add(
          `Faserzusammensetzung: „${String(row.fiber ?? '')}“ ist keine amtliche Faserbezeichnung.`,
        )
      }
      const p = row.percent
      if (typeof p !== 'number' || !Number.isInteger(p) || p < 1 || p > 100) {
        add('Faserzusammensetzung: Anteile als ganze Zahl von 1 bis 100 %.')
      }
      byComponent.set(component, [...(byComponent.get(component) ?? []), row])
    }
    for (const [component, part] of byComponent) {
      const label = COMPONENT_LABEL(component)
      const sum = part.reduce((acc, r) => acc + (typeof r.percent === 'number' ? r.percent : 0), 0)
      if (sum !== 100) {
        add(`Faserzusammensetzung (${label}): Summe ${sum} % – sie muss genau 100 % sein.`)
      }
      const fibers = part.map((r) => String(r.fiber))
      if (new Set(fibers).size !== fibers.length) {
        add(`Faserzusammensetzung (${label}): jede Faser nur einmal angeben.`)
      }
      const other = part.find((r) => r.fiber === 'other_fibres')
      if (other && (other.percent ?? 0) > OTHER_FIBRES_MAX_PERCENT) {
        add(
          `Faserzusammensetzung (${label}): „sonstige Fasern“ höchstens ${OTHER_FIBRES_MAX_PERCENT} %.`,
        )
      }
    }
  }
  if (opts.labelMissing && !opts.fiberFreeTextDe?.trim()) {
    issues.push({
      field: 'fiberFreeText',
      message: 'Material nach bestem Wissen (Deutsch) fehlt – bei fehlendem Etikett Pflicht.',
    })
  }
  return issues
}
