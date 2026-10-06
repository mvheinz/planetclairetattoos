import { LEGAL_TEXT_TYPES, type LegalTextType } from '@/lib/enums'
import { isValidIban, normalizeIban } from '@/lib/settings/rules'

// Startklar-Prüfung (Go-live-Gate, R-210, KONZEPT §7.16, DATENMODELL §13.7): reine Prüffunktionen ohne Datenbank und
// Netz. Dieselbe Funktion `evaluateGolive` nutzen `pnpm check:golive`, die Verwaltungsansicht „Startklar“, der Hinweis
// unter „Heute“ und die Sperre „Shop öffnen“ (Settings-Global). Die Daten sammelt `collect.ts`.

export const EXAMPLE_IBAN = 'DE36000000000000000000'

export type GoliveGroup =
  'texts' | 'business' | 'payment' | 'services' | 'data' | 'system' | 'content'

export const GOLIVE_GROUP_LABELS: Readonly<Record<GoliveGroup, string>> = {
  texts: 'Rechtstexte',
  business: 'Stammdaten',
  payment: 'Zahlung',
  services: 'Dienste und Verträge',
  data: 'Daten',
  system: 'Technik',
  content: 'Bilder und Inhalte',
}

export interface GoliveCheck {
  /** Stabile ID (`R210-01` …), auch für Tests und Protokolle. */
  id: string
  group: GoliveGroup
  /** Kurzname in Juttas Sprache. */
  title: string
  ok: boolean
  /** Erklärung: bei Rot, was fehlt und was zu tun ist; bei Grün, was geprüft wurde. */
  detail: string
  /** Quellen (R-xxx, KONZEPT, DATENMODELL). */
  ref: string
}

export interface GoliveReport {
  ready: boolean
  checks: GoliveCheck[]
  /** Kurztexte der roten Punkte (für Fehlermeldungen). */
  openItems: string[]
}

/** Eingabe der Prüfung: nur einfache Werte, vom Sammler (`collect.ts`) bzw. von Tests geliefert. */
export interface GoliveInput {
  now: Date
  env: {
    appEnv: string
    paymentsDriver: string
    emailDriver: string
    storageDriver: string
    adminRoute: string
    seedPreviewMode: boolean
    stripeWebhookSecretSet: boolean
    stripeLiveKey: boolean
  }
  /** Aktive Fassung je Rechtstext-Typ (fehlend = keine aktive Fassung). */
  legalTexts: Partial<
    Record<LegalTextType, { origin: string | null; isPlaceholder?: boolean | null }>
  >
  /** Schlüssel der Bausteine mit „Kanzlei: ja“, die keine aktive Fassung `origin = lawyer` haben. */
  snippetsNotLawyer: string[]
  settings: GoliveSettings
  /** Dienste mit `avv: required` und `production: true` (DIENSTE-YAML). */
  requiredAgreements: { id: string; name: string }[]
  /** Anzahl Datensätze mit `seed = true` je Collection (leer = keine). */
  seedCounts: Record<string, number>
  ownerPhotosUnapproved: number
  galleryWithoutConsent: number
  /** Die Grafik der harmonisierten Mitteilung ist noch die Platzhalter-Grafik (R-049). */
  warrantyGraphicPlaceholder: boolean
  vvtExists: boolean
}

export interface GoliveSettings {
  business?: {
    legalName?: string | null
    street?: string | null
    postalCode?: string | null
    city?: string | null
    email?: string | null
    phone?: string | null
    taxNumber?: string | null
    lucidNumber?: string | null
    packagingScheme?: { name?: string | null; contractFrom?: string | null } | null
  } | null
  tattoo?: { studioDistrict?: string | null } | null
  pickup?: { instructions?: string | null } | null
  payment?: {
    prepaymentEnabled?: boolean | null
    iban?: string | null
    accountHolder?: string | null
  } | null
  processorAgreements?: { serviceId?: string | null; signedAt?: string | null }[] | null
  analytics?: { enabled?: boolean | null; confirmedAt?: string | null } | null
  tax?: { confirmedAt?: string | null } | null
  revenueGuard?: { manualYearTotals?: { year?: number | null }[] | null } | null
  shipping?: {
    enabledCountries?: string[] | null
    euShippingAcknowledged?: boolean | null
  } | null
  seed?: { exampleDataPresent?: boolean | null } | null
}

const PLACEHOLDER_WORDS = /folgt|muster|example/i

/** Platzhalter-Erkennung (R-210 Nr. 3): `[`, „folgt“, „Muster“, „example“, PLZ `00000`. */
export function looksLikePlaceholder(value: string | null | undefined): boolean {
  const v = (value ?? '').trim()
  if (!v) return false
  return v.includes('[') || PLACEHOLDER_WORDS.test(v) || /^0{5}$/.test(v)
}

const blank = (v: string | null | undefined): boolean => !v || v.trim() === ''

function check(
  id: string,
  group: GoliveGroup,
  title: string,
  ref: string,
  missing: string[],
  okDetail: string,
  redDetail: (list: string) => string,
): GoliveCheck {
  return {
    id,
    group,
    title,
    ref,
    ok: missing.length === 0,
    detail: missing.length === 0 ? okDetail : redDetail(missing.join(', ')),
  }
}

const LEGAL_TYPE_LABEL: Record<LegalTextType, string> = {
  impressum: 'Impressum',
  datenschutz: 'Datenschutzerklärung',
  agb: 'AGB',
  widerrufsbelehrung: 'Widerrufsbelehrung',
  widerrufsformular: 'Widerrufsformular',
  'versand-zahlung': 'Versand und Zahlung',
}

const BUSINESS_FIELDS: [keyof NonNullable<GoliveSettings['business']>, string][] = [
  ['legalName', 'Name'],
  ['street', 'Straße'],
  ['postalCode', 'Postleitzahl'],
  ['city', 'Ort'],
  ['email', 'E-Mail'],
  ['phone', 'Telefon'],
  ['taxNumber', 'Steuernummer'],
]

/** Zusammenfassung der Collections mit Beispieldaten für die Anzeige. */
function seedList(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([slug, n]) => `${slug} (${n})`)
    .join(', ')
}

/** Alle Prüfpunkte einzeln (R-210 Nr. 1–15, KONZEPT §7.16, DATENMODELL §13.7). */
export function evaluateGolive(input: GoliveInput): GoliveReport {
  const { settings: s, env } = input
  const checks: GoliveCheck[] = []

  // 1 Rechtstexte
  checks.push(
    check(
      'R210-01',
      'texts',
      'Die sechs Rechtstexte stammen von der Kanzlei',
      'R-210 Nr. 1, R-002',
      LEGAL_TEXT_TYPES.filter((t) => {
        const a = input.legalTexts[t]
        return !a || a.isPlaceholder === true || a.origin !== 'lawyer'
      }).map((t) => LEGAL_TYPE_LABEL[t]),
      'Alle sechs Rechtstexte haben eine aktive Fassung von der Kanzlei.',
      (l) =>
        `Noch keine fertige Fassung der Kanzlei: ${l}. Bitte unter „Texte“ die Kanzlei-Fassung einsetzen und aktivieren.`,
    ),
  )
  // 2 Bausteine
  checks.push(
    check(
      'R210-02',
      'texts',
      'Die rechtlichen Textbausteine stammen von der Kanzlei',
      'R-210 Nr. 2, DATENMODELL §6.28',
      input.snippetsNotLawyer,
      'Alle Bausteine mit Kanzlei-Pflicht haben eine aktive Fassung der Kanzlei.',
      (l) =>
        `Noch Arbeitsfassungen statt Kanzlei-Text: ${l}. Bitte unter „Texte“ → Bausteine ersetzen.`,
    ),
  )
  // 3 Stammdaten
  const b = s.business ?? {}
  const businessMissing: string[] = []
  for (const [key, label] of BUSINESS_FIELDS) {
    const v = b[key] as string | null | undefined
    if (blank(v)) businessMissing.push(`${label} fehlt`)
    else if (looksLikePlaceholder(v) || (key === 'postalCode' && /^0{5}$/.test(v!.trim())))
      businessMissing.push(`${label} ist noch ein Platzhalter`)
  }
  if (blank(s.tattoo?.studioDistrict)) businessMissing.push('Bezirk des Studios fehlt')
  else if (looksLikePlaceholder(s.tattoo?.studioDistrict))
    businessMissing.push('Bezirk des Studios ist noch ein Platzhalter')
  if (blank(s.pickup?.instructions)) businessMissing.push('Hinweis zur Abholung fehlt')
  checks.push(
    check(
      'R210-03',
      'business',
      'Stammdaten sind vollständig und echt',
      'R-210 Nr. 3, KONZEPT §7.16 Nr. 2',
      businessMissing,
      'Name, Anschrift, E-Mail, Telefon, Steuernummer, Bezirk und Abholhinweis sind eingetragen.',
      (l) => `Unter Einstellungen → Stammdaten: ${l}.`,
    ),
  )
  // 4 IBAN
  const p = s.payment ?? {}
  const ibanMissing: string[] = []
  if (p.prepaymentEnabled !== false) {
    if (blank(p.iban)) ibanMissing.push('IBAN fehlt')
    else if (normalizeIban(p.iban!) === EXAMPLE_IBAN)
      ibanMissing.push('IBAN ist noch die Beispiel-IBAN')
    else if (!isValidIban(p.iban!)) ibanMissing.push('IBAN ist ungültig (Prüfsumme)')
    if (blank(p.accountHolder)) ibanMissing.push('Kontoinhaberin fehlt')
    else if (looksLikePlaceholder(p.accountHolder))
      ibanMissing.push('Kontoinhaberin ist noch ein Platzhalter')
  }
  checks.push(
    check(
      'R210-04',
      'payment',
      'Bankverbindung für Vorkasse ist echt',
      'R-210 Nr. 4, DATENMODELL §13.7 Nr. 4',
      ibanMissing,
      p.prepaymentEnabled === false
        ? 'Vorkasse ist aus – keine Bankverbindung nötig.'
        : 'IBAN und Kontoinhaberin sind eingetragen, die Prüfsumme stimmt.',
      (l) => `Unter Einstellungen → Zahlung: ${l}.`,
    ),
  )
  // 5 LUCID
  const lucidMissing: string[] = []
  if (blank(b.lucidNumber)) lucidMissing.push('LUCID-Nummer fehlt')
  else if (looksLikePlaceholder(b.lucidNumber))
    lucidMissing.push('LUCID-Nummer ist noch ein Platzhalter')
  if (blank(b.packagingScheme?.name)) lucidMissing.push('duales System fehlt')
  if (blank(b.packagingScheme?.contractFrom))
    lucidMissing.push('Vertragsbeginn beim dualen System fehlt')
  checks.push(
    check(
      'R210-05',
      'business',
      'Verpackungsregister (LUCID) und duales System',
      'R-210 Nr. 5, R-200',
      lucidMissing,
      'LUCID-Nummer, duales System und Vertragsbeginn sind eingetragen.',
      (l) => `Unter Einstellungen → Verpackung: ${l}.`,
    ),
  )
  // 6 AVV
  const signed = new Set(
    (s.processorAgreements ?? []).filter((a) => a.signedAt && a.serviceId).map((a) => a.serviceId!),
  )
  checks.push(
    check(
      'R210-06',
      'services',
      'Verträge mit allen Dienstleistern (AVV) liegen vor',
      'R-210 Nr. 6, R-155',
      input.requiredAgreements.filter((a) => !signed.has(a.id)).map((a) => a.name),
      'Für alle Dienstleister mit Vertragspflicht ist ein unterschriebener Vertrag eingetragen.',
      (l) =>
        `Es fehlt der Vertrag (Datum der Unterschrift) für: ${l}. Einstellungen → Auftragsverarbeitung.`,
    ),
  )
  // 7 Beispieldaten
  const seedMissing: string[] = []
  const seedTotal = Object.values(input.seedCounts).reduce((a, n) => a + n, 0)
  if (seedTotal > 0) seedMissing.push(`Beispieldaten vorhanden: ${seedList(input.seedCounts)}`)
  if (s.seed?.exampleDataPresent === true)
    seedMissing.push('Beispielbestand ist als vorhanden markiert')
  if (env.seedPreviewMode) seedMissing.push('SEED_PREVIEW_MODE ist an')
  checks.push(
    check(
      'R210-07',
      'data',
      'Keine Beispieldaten mehr',
      'R-210 Nr. 7, R-180, DATENMODELL §13.7 Nr. 7',
      seedMissing,
      'Es gibt keine Beispieldaten und der Vorschau-Modus ist aus.',
      (l) => `${l}. Bitte unter Einstellungen → Beispieldaten „Beispieldaten entfernen“ ausführen.`,
    ),
  )
  // 8 ADMIN_ROUTE
  const adminOk = env.adminRoute !== '/admin' && env.adminRoute !== '/werkstatt'
  checks.push({
    id: 'R210-08',
    group: 'system',
    title: 'Der Weg zur Verwaltung ist nicht der Standard',
    ref: 'R-210 Nr. 8',
    ok: adminOk,
    detail: adminOk
      ? 'Die Verwaltung hat einen eigenen, nicht erratbaren Pfad.'
      : 'Die Verwaltung liegt noch unter dem Standardpfad. Technische Einstellung ADMIN_ROUTE ändern.',
  })
  // 9 Treiber
  const drivers: string[] = []
  if (env.paymentsDriver !== 'stripe')
    drivers.push('Zahlung läuft noch im Testmodus (PAYMENTS_DRIVER)')
  if (env.emailDriver !== 'smtp')
    drivers.push('E-Mails gehen noch nicht wirklich raus (EMAIL_DRIVER)')
  if (env.storageDriver !== 's3')
    drivers.push('Bilder liegen noch nicht im echten Speicher (STORAGE_DRIVER)')
  if (env.paymentsDriver === 'stripe' && !env.stripeLiveKey)
    drivers.push('Stripe ist nicht im Live-Modus')
  if (!env.stripeWebhookSecretSet) drivers.push('Stripe-Webhook-Geheimnis ist nicht gesetzt')
  checks.push(
    check(
      'R210-09',
      'system',
      'Zahlung, E-Mail und Speicher laufen echt',
      'R-210 Nr. 9, KONZEPT §7.16 Nr. 8',
      drivers,
      'Stripe (live), E-Mail-Versand und Bildspeicher sind auf „echt“ gestellt.',
      (l) => `${l}. Das stellen wir beim Start gemeinsam um.`,
    ),
  )
  // 10 Statistik
  const analyticsOk = Boolean(s.analytics?.confirmedAt)
  checks.push({
    id: 'R210-10',
    group: 'business',
    title: 'Entscheidung zur Besucherstatistik ist dokumentiert',
    ref: 'R-210 Nr. 10',
    ok: analyticsOk,
    detail: analyticsOk
      ? s.analytics?.enabled
        ? 'Statistik ist bewusst an, die Entscheidung ist eingetragen.'
        : 'Statistik ist bewusst aus, die Entscheidung ist eingetragen.'
      : 'Noch nicht entschieden. Einstellungen → Statistik: an oder aus wählen und speichern.',
  })
  // 11 amtliche Grafik
  checks.push({
    id: 'R210-11',
    group: 'content',
    title: 'Amtliche Grafik der harmonisierten Mitteilung ist eingebaut',
    ref: 'R-210 Nr. 11, R-049',
    ok: !input.warrantyGraphicPlaceholder,
    detail: input.warrantyGraphicPlaceholder
      ? 'Noch die Platzhalter-Grafik. Die amtliche Grafik (EU-Durchführungsverordnung 2025/1960) wird beim Start eingesetzt.'
      : 'Die amtliche Grafik ist eingebaut.',
  })
  // 12 Steuer
  const taxMissing: string[] = []
  if (!s.tax?.confirmedAt) taxMissing.push('Steuerangaben noch nicht bestätigt')
  const lastYear = input.now.getUTCFullYear() - 1
  if (!(s.revenueGuard?.manualYearTotals ?? []).some((y) => y.year === lastYear))
    taxMissing.push(`Umsatz ${lastYear} nicht eingetragen (auch 0 € eintragen)`)
  checks.push(
    check(
      'R210-12',
      'business',
      'Steuerangaben bestätigt, Vorjahresumsatz eingetragen',
      'R-210 Nr. 12, DATENMODELL §13.7 Nr. 9',
      taxMissing,
      'Steuerangaben sind bestätigt, der Vorjahresumsatz ist eingetragen.',
      (l) => `${l}. Einstellungen → Steuer bzw. Umsatz-Wächter.`,
    ),
  )
  // 13 Lieferländer
  const countries = s.shipping?.enabledCountries ?? []
  const onlyDe = countries.every((c) => c === 'DE')
  const shipOk = onlyDe || s.shipping?.euShippingAcknowledged === true
  checks.push({
    id: 'R210-13',
    group: 'business',
    title: 'Nur Deutschland als Lieferland (oder EU-Versand geprüft)',
    ref: 'R-210 Nr. 13, R-202, E-24',
    ok: shipOk,
    detail: shipOk
      ? onlyDe
        ? 'Es wird nur nach Deutschland geliefert.'
        : 'Weitere Länder sind aktiv, die EU-Prüfung ist bestätigt.'
      : 'Weitere Länder sind aktiv, aber „EU-Versand geprüft“ fehlt. Einstellungen → Versand.',
  })
  // 14 VVT
  checks.push({
    id: 'R210-14',
    group: 'texts',
    title: 'Verzeichnis der Verarbeitungstätigkeiten (VVT) liegt vor',
    ref: 'R-210 Nr. 14, R-156',
    ok: input.vvtExists,
    detail: input.vvtExists
      ? 'docs/recht/VVT.md ist vorhanden.'
      : 'Die Datei docs/recht/VVT.md fehlt.',
  })
  // 15 Fotos
  const photoMissing: string[] = []
  if (input.ownerPhotosUnapproved > 0)
    photoMissing.push(
      `${input.ownerPhotosUnapproved} Foto(s) von dir ohne deine Freigabe („Jutta hat dieses Foto von sich freigegeben“)`,
    )
  if (input.galleryWithoutConsent > 0)
    photoMissing.push(
      `${input.galleryWithoutConsent} Galerie-Bild(er) mit Kund:innen ohne Einwilligung`,
    )
  checks.push(
    check(
      'R210-15',
      'content',
      'Fotos von Personen sind freigegeben',
      'R-210 Nr. 15, R-181, E-42',
      photoMissing,
      'Alle Fotos von dir sind freigegeben, alle Galerie-Bilder haben eine Einwilligung.',
      (l) => `${l}. Bitte freigeben oder entfernen.`,
    ),
  )

  const open = checks.filter((c) => !c.ok)
  return {
    ready: open.length === 0,
    checks,
    openItems: open.map((c) => c.title),
  }
}

/** Text für Meldungen („Shop öffnen“ abgelehnt, Skript): offene Punkte mit Erklärung. */
export function goliveSummaryLines(report: GoliveReport): string[] {
  return report.checks.map(
    (c) => `${c.ok ? 'OK ' : 'ROT'}  ${c.id}  ${c.title}${c.ok ? '' : ` – ${c.detail}`}`,
  )
}
