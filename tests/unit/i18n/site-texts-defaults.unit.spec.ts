import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { SiteTexts } from '@/globals/SiteTexts'
import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import { EMAIL_TEMPLATES } from '@/lib/enums'

// PLAN P8.15: Jedes `site-texts`-Feld hat einen DE- und einen EN-Standardwert (DATENMODELL §7.2, Juttas Ton E-62).
// Ausnahme: die Zeilen `emails.templates` (Betreff/Einleitung/Schluss je Vorlage) sind absichtlich leer – leer heißt
// „Standardtext der Vorlage“, und der steht in `src/i18n/messages/{de,en}.json` unter `email.*` (hier mitgeprüft).

type AnyField = Field & {
  name?: string
  type: string
  fields?: Field[]
  tabs?: { fields: Field[] }[]
  localized?: boolean
  defaultValue?: unknown
}

interface Leaf {
  path: string
  field: AnyField
}

function collect(fields: Field[], prefix = ''): Leaf[] {
  const out: Leaf[] = []
  for (const raw of fields) {
    const f = raw as AnyField
    const path = f.name ? (prefix ? `${prefix}.${f.name}` : f.name) : prefix
    if (f.type === 'tabs') for (const tab of f.tabs ?? []) out.push(...collect(tab.fields, prefix))
    else if (f.type === 'group') out.push(...collect(f.fields ?? [], path))
    else out.push({ path, field: f })
  }
  return out
}

const valueFor = (field: AnyField, locale: 'de' | 'en'): unknown =>
  typeof field.defaultValue === 'function'
    ? (field.defaultValue as (a: { locale: string }) => unknown)({ locale })
    : field.defaultValue

const leaves = collect(SiteTexts.fields)
const TEMPLATE_ROWS = 'emails.templates'

describe('site-texts: Standardwerte DE/EN (P8.15)', () => {
  it('es gibt die Gruppen aus DATENMODELL §7.2', () => {
    const groups = new Set(leaves.map((l) => l.path.split('.')[0]))
    for (const g of [
      'navigation',
      'footer',
      'shop',
      'product',
      'cart',
      'checkout',
      'thanks',
      'orderStatus',
      'withdrawal',
      'notFound',
      'errors',
      'emails',
    ])
      expect(groups, g).toContain(g)
  })

  it('jedes Textfeld ist lokalisiert und hat einen nicht leeren DE- und EN-Standardwert', () => {
    const texts = leaves.filter((l) => l.field.type === 'text' || l.field.type === 'textarea')
    expect(texts.length).toBeGreaterThan(30)
    for (const { path, field } of texts) {
      expect(field.localized, path).toBe(true)
      for (const locale of ['de', 'en'] as const) {
        const v = valueFor(field, locale)
        expect(typeof v === 'string' && v.trim().length > 0, `${path} (${locale})`).toBe(true)
        expect(v as string, `${path} (${locale})`).not.toMatch(/lorem|todo|xxx/i)
      }
    }
  })

  it('Navigationslisten haben je Eintrag eine DE- und eine EN-Beschriftung', () => {
    const arrays = leaves.filter((l) => l.field.type === 'array' && l.path !== TEMPLATE_ROWS)
    expect(arrays.map((a) => a.path).sort()).toEqual([
      'navigation.mainLinks',
      'navigation.menuLinks',
    ])
    for (const { path, field } of arrays) {
      for (const locale of ['de', 'en'] as const) {
        const rows = valueFor(field, locale) as { label?: string }[]
        expect(rows.length, path).toBeGreaterThan(0)
        for (const row of rows) expect(row.label?.trim(), `${path} (${locale})`).toBeTruthy()
      }
    }
  })

  it('Mail-Vorlagen: leere Zeile = Standardtext; jede Kund:innen-Vorlage hat Betreff DE und EN', () => {
    const rows = leaves.find((l) => l.path === TEMPLATE_ROWS)
    expect(rows?.field.type).toBe('array')
    const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
    const customer = EMAIL_TEMPLATES.filter((t) => !t.startsWith('admin_'))
    expect(customer.length).toBeGreaterThan(10)
    for (const t of customer) {
      for (const [locale, messages] of [
        ['de', de],
        ['en', en],
      ] as const) {
        const mail = (messages.email as Record<string, { subject?: string } | undefined>)[camel(t)]
        expect(mail?.subject?.trim(), `${t} (${locale})`).toBeTruthy()
      }
    }
  })
})
