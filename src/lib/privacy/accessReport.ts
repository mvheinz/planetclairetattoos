import 'server-only'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import type { Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
import { SERVICES } from '@/lib/legal/services.generated'
import {
  L_03_CHECKOUTS,
  L_05_ORDERS_STAGE_D,
  L_06_INVOICES_DEFAULT_YEARS,
  L_08_WITHDRAWALS,
  L_10_INQUIRIES,
  L_12_EMAIL_LOG_UNRELATED,
  L_17_EXPORT_FILES,
  L_17_PRIVACY_REQUESTS,
} from '@/lib/retention/policy'
import { formatBerlin } from '@/lib/time'

import type { PersonMatches } from './search'

// `auskunft.html` im DSGVO-Export (PLAN P6.17, LOESCHKONZEPT §5.4, R-150): Angaben nach Art. 15 Abs. 1 lit. a–h DSGVO in
// der Sprache der Anfrage – Zwecke, Kategorien, Empfänger laut DIENSTE (`services.generated.ts`), Speicherdauer laut
// LOESCHKONZEPT (Fristen aus `src/lib/retention/policy.ts`), Rechte, Beschwerderecht bei der Berliner Beauftragten,
// Herkunft, automatisierte Entscheidungen – plus Baustein `privacyRequest.accessResponse` (bis zum Kanzlei-Wortlaut als
// Platzhalter gekennzeichnet) und die Anzahl gefundener Datensätze je Bereich. Ohne Skripte, ohne externe Ressourcen.

const MESSAGES = { de: de.privacyExport, en: en.privacyExport } as const
type Texts = (typeof MESSAGES)['de']

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  )
const fill = (t: string, vars: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

export interface AccessReportInput {
  locale: Locale
  reference: string
  createdAt: Date
  business: {
    legalName?: string | null
    tradeName?: string | null
    street?: string | null
    postalCode?: string | null
    city?: string | null
    email?: string | null
  }
  counts: Record<keyof PersonMatches, number>
  invoiceYears?: number
}

/** Fristen je Bereich (Text mit Zahlen aus `policy.ts`). */
export function retentionLines(
  t: Texts,
  invoiceYears: number = L_06_INVOICES_DEFAULT_YEARS,
): string[] {
  return [
    fill(t.retention.orders, { years: L_05_ORDERS_STAGE_D.duration.years ?? 6 }),
    fill(t.retention.invoices, { years: invoiceYears }),
    fill(t.retention.withdrawals, { years: L_08_WITHDRAWALS.duration.years ?? 6 }),
    fill(t.retention.inquiries, { months: L_10_INQUIRIES.duration.months ?? 6 }),
    fill(t.retention.checkouts, { days: L_03_CHECKOUTS.duration.days ?? 30 }),
    fill(t.retention.emailLog, { days: L_12_EMAIL_LOG_UNRELATED.duration.days ?? 90 }),
    fill(t.retention.consentLog, { days: L_03_CHECKOUTS.duration.days ?? 30 }),
    fill(t.retention.privacyRequests, {
      years: L_17_PRIVACY_REQUESTS.duration.years ?? 3,
      days: L_17_EXPORT_FILES.duration.days ?? 30,
    }),
  ]
}

/** Empfänger laut DIENSTE: Dienste mit Personenbezug, die in Produktion laufen. */
export function recipientLines(t: Texts, locale: Locale): string[] {
  return SERVICES.filter((s) => s.production && s.personalData !== 'no' && s.role !== 'none').map(
    (s) => `${s.name} – ${t.role[s.role]}; ${s.seat[locale]}; ${t.thirdCountry[s.thirdCountry]}`,
  )
}

const list = (items: readonly string[]) =>
  `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
const section = (heading: string, body: string) => `<h2>${esc(heading)}</h2>${body}`

export function renderAccessReport(input: AccessReportInput): string {
  const t = MESSAGES[input.locale] as Texts
  const b = input.business
  const snippet = getSnippet('privacyRequest.accessResponse', input.locale)
  const placeholder = (snippet.origin as string) === 'placeholder'
  const found = (Object.keys(t.areas) as (keyof Texts['areas'])[])
    .filter((k) => (input.counts[k] ?? 0) > 0)
    .map((k) => `${t.areas[k]}: ${input.counts[k]}`)
  const address = [
    b.legalName || b.tradeName,
    b.street,
    [b.postalCode, b.city].filter(Boolean).join(' '),
    b.email,
  ]
    .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    .map(esc)
    .join('<br>')
  const body = [
    `<h1>${esc(t.title)}</h1>`,
    `<p>${esc(fill(t.subtitle, { reference: input.reference }))}<br>${esc(
      fill(t.createdAt, {
        date: formatBerlin(
          input.createdAt,
          input.locale === 'de' ? 'dd.MM.yyyy' : 'd MMM yyyy',
          input.locale,
        ),
      }),
    )}</p>`,
    `<p>${esc(t.intro)}</p>`,
    placeholder
      ? `<p class="note"><strong>${esc(t.placeholderMark)}</strong> ${esc(snippet.text)}</p>`
      : `<p>${esc(snippet.text)}</p>`,
    section(t.controllerHeading, `<p>${address}</p>`),
    section(t.summaryHeading, found.length > 0 ? list(found) : `<p>${esc(t.summaryNone)}</p>`),
    section(t.purposesHeading, list(t.purposes)),
    section(t.categoriesHeading, list(t.categories)),
    section(
      t.recipientsHeading,
      `<p>${esc(t.recipientsIntro)}</p>${list(recipientLines(t, input.locale))}`,
    ),
    section(t.retentionHeading, list(retentionLines(t, input.invoiceYears))),
    section(t.rightsHeading, list(t.rights)),
    section(t.complaintHeading, `<p>${esc(t.complaint)}</p>`),
    section(t.sourceHeading, `<p>${esc(t.source)}</p>`),
    section(t.automatedHeading, `<p>${esc(t.automated)}</p>`),
    section(t.noteHeading, `<p>${esc(t.notesHint)}</p>`),
  ].join('\n')
  return `<!doctype html>
<html lang="${input.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)} – ${esc(input.reference)}</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;line-height:1.55;color:#1d1a17;background:#fff}
h1{font-size:1.5rem}h2{font-size:1.1rem;margin-top:1.6rem}.note{border:1px dashed #5b5550;padding:.5rem .75rem;color:#5b5550}
</style>
</head>
<body>
${body}
</body>
</html>
`
}
