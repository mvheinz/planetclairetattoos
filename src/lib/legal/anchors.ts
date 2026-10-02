import 'server-only'

// Anker-IDs der Datenschutzerklärung (KANZLEI-BRIEFING §11.10, PLAN P6.5): Formulare und Hinweise verlinken direkt auf
// Abschnitte (`/de/datenschutz#bestellung`). Eingefügte Texte verlieren `id`-Attribute bei der Bereinigung, deshalb
// leitet die Seite die IDs aus den `h2`-Überschriften ab (DE und EN, erste passende Regel, jede ID höchstens einmal).
// Die Tabelle der Auftragsverarbeiter trägt ihren Anker `auftragsverarbeiter-tabelle` selbst (P6.21).

export const PRIVACY_ANCHORS = [
  'verantwortliche',
  'hosting',
  'cookies',
  'bestellung',
  'zahlung',
  'versand',
  'e-mails',
  'widerruf',
  'auftragsarbeiten',
  'kontakt',
  'statistik',
  'fehlerueberwachung',
  'portfolio',
  'instagram',
  'empfaenger',
  'drittland',
  'speicherdauer',
  'rechte',
  'beschwerde',
] as const
export type PrivacyAnchor = (typeof PRIVACY_ANCHORS)[number]

/** Erkennung je Anker (Reihenfolge = Priorität). */
const RULES: readonly [PrivacyAnchor, RegExp][] = [
  ['verantwortliche', /verantwortlich|controller/],
  ['drittland', /drittl|third countr/],
  ['beschwerde', /beschwerde|complain|supervisory/],
  ['fehlerueberwachung', /fehler|error|monitoring/],
  ['statistik', /statisti|analytics/],
  ['speicherdauer', /speicherdauer|aufbewahr|retention|storage period/],
  ['cookies', /cookie/],
  ['hosting', /hosting/],
  ['auftragsarbeiten', /auftragsarbeit|commission/],
  ['portfolio', /portfolio/],
  ['instagram', /instagram/],
  ['empfaenger', /empf(ae|ä)nger|recipient/],
  ['zahlung', /zahlung|payment/],
  ['versand', /versand|shipping|delivery/],
  ['e-mails', /e-?mails?\b/],
  ['widerruf', /widerruf|withdraw/],
  ['bestellung', /bestellung|\border/],
  ['kontakt', /kontakt|contact/],
  ['rechte', /rechte\b|rights/],
]

/** Anker einer Überschrift der Datenschutzerklärung oder `undefined`. */
export function privacyAnchorFor(heading: string): PrivacyAnchor | undefined {
  const text = heading.toLowerCase()
  return RULES.find(([, re]) => re.test(text))?.[0]
}

/** IDs für die `h2` einer Seite vergeben; jede ID höchstens einmal. */
export function anchorAssigner(
  match: (heading: string) => string | undefined,
): (heading: string, tag: string) => string | undefined {
  const used = new Set<string>()
  return (heading, tag) => {
    if (tag !== 'h2') return undefined
    const id = match(heading)
    if (!id || used.has(id)) return undefined
    used.add(id)
    return id
  }
}
