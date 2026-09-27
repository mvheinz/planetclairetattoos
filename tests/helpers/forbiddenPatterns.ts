// Verbotsmuster für Quelltext/Inhalte (RECHT §5, V-xx), soweit sie sich per Textsuche prüfen lassen. Genutzt für
// `content/seed/**` (AK-SEED-13); den vollständigen Scan über `src/**` und `content/**` mit Allowlist baut P1.32
// (`tests/unit/legal/forbidden.unit.spec.ts`).

export interface ForbiddenPattern {
  id: string
  re: RegExp
}

const p = (id: string, source: string): ForbiddenPattern => ({ id, re: new RegExp(source, 'iu') })

export const FORBIDDEN_CONTENT_PATTERNS: readonly ForbiddenPattern[] = [
  p('V-01', String.raw`ec\.europa\.eu/consumers/odr|Online-Streitbeilegung|OS-Plattform|\bODR\b`),
  p(
    'V-02',
    String.raw`inkl\.?\s*(MwSt|USt|Mehrwertsteuer|Umsatzsteuer)|zzgl\.?\s*(MwSt|USt)|\bMwSt\b|incl\.?\s*VAT|VAT included`,
  ),
  p(
    'V-04',
    String.raw`fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net|cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com`,
  ),
  p(
    'V-08',
    String.raw`kein(e|en)?\s+(Widerruf|Umtausch|Rückgabe|Rücknahme)|vom\s+(Umtausch|Widerruf)\s+ausgeschlossen|Rückgabe\s+ausgeschlossen|no\s+returns|final\s+sale`,
  ),
  p(
    'V-10',
    String.raw`auf\s+(Gefahr|Risiko)\s+(des|der)\s+(Käufer|Kund)|keine\s+Haftung\s+für\s+(Transport|Versand)schäden|Versand\s+auf\s+eigene\s+Gefahr`,
  ),
  p('V-12', String.raw`unfrei(e)?\s+(Rück)?sendung.{0,40}(nicht\s+angenommen|verweigert)`),
  p(
    'V-14',
    String.raw`nachhaltig|umweltfreundlich|klimaneutral|CO2-neutral|(?<!\p{L})öko|eco-friendly|sustainable`,
  ),
  p(
    'V-15',
    String.raw`heilt\s+garantiert|schmerzfrei|allergiefrei|hautfreundlich|medizinisch\s+geprüft`,
  ),
  p(
    'V-17',
    String.raw`nur\s+noch\s+heute|\d+\s+(Personen|Leute)\s+(sehen|schauen)|Bestseller|Kundenbewertung|★★★★★`,
  ),
  p(
    'V-19',
    String.raw`14\s*Tage\s*(Widerrufs|Rückgabe)recht|2\s*Jahre\s*Gewährleistung|DSGVO-konform|rechtssicher|abmahnsicher`,
  ),
  p('V-21', String.raw`(PayPal|Karten?)-?(Gebühr|Aufschlag)|Zahlungsgebühr`),
  p('V-24', String.raw`Anzahlung.{0,30}(nicht\s+erstatt|verfällt|einbehalten)|non-?refundable`),
  p('V-26', String.raw`barrierefrei(e|er|en)?\s+(Shop|Website|Seite)|WCAG-konform|BFSG-konform`),
  p('V-27', String.raw`mystaelectric`),
]
