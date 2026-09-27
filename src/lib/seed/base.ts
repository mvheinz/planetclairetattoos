import 'server-only'

import type { GlobalSlug, Payload, PayloadRequest } from 'payload'

import { LOCALES } from '@/lib/enums'

import { seedOp, seedStep } from './context'
import {
  deepMerge,
  fieldDefaults,
  fillEmpty,
  isEmptyValue,
  pickLocaleTree,
  stripMeta,
} from './globals'
import { toLexical } from './lexical'
import type { SeedReport } from './report'
import type { BaseData } from './schemas'

// Grund-Seed (SEED-SPEC §3, DATENMODELL §13.1): `settings`, `site-texts`, 6 Kategorien, 6 Rechtstext-Platzhalter und
// das Admin-Konto. `seed = false`, create-if-missing: nur fehlende Dokumente anlegen bzw. leere Felder füllen, nie
// vorhandene Werte überschreiben (§1.3). In Produktion erlaubt (Erstbefüllung P11), das Admin-Konto dort nie.

export interface BaseOptions {
  report: SeedReport
  appEnv: string
  admin?: { email?: string; password?: string }
}

type Obj = Record<string, unknown>

async function seedGlobal(
  payload: Payload,
  slug: GlobalSlug,
  desiredFromData: Obj,
  report: SeedReport,
): Promise<void> {
  await seedStep(payload, async (req) => {
    const config = payload.config.globals.find((g) => g.slug === slug)
    if (!config) return
    let changed = false
    let created = false
    for (const locale of LOCALES) {
      const current = stripMeta(
        await req.payload.findGlobal({
          slug,
          locale,
          fallbackLocale: false,
          ...seedOp(req),
        }),
      )
      const stored = await req.payload.db.findGlobal({ slug, req, locale })
      if (!stored) created = true
      const desired = deepMerge(
        await fieldDefaults(config.fields, locale, req),
        pickLocaleTree(desiredFromData, locale) as Obj,
      )
      const next = fillEmpty(current, desired) as Obj
      if (!stored || JSON.stringify(next) !== JSON.stringify(current)) {
        await req.payload.updateGlobal({ slug, data: next as never, locale, ...seedOp(req) })
        changed = true
      }
    }
    report.add(slug, created ? 'created' : changed ? 'updated' : 'skipped')
  })
}

async function seedCategories(payload: Payload, base: BaseData, report: SeedReport) {
  await seedStep(payload, async (req) => {
    for (const cat of base.categories) {
      const found = await req.payload.find({
        collection: 'categories',
        where: { key: { equals: cat.key } },
        limit: 1,
        locale: 'de',
        fallbackLocale: false,
        ...seedOp(req),
      })
      const existing = found.docs[0]
      if (!existing) {
        const doc = await req.payload.create({
          collection: 'categories',
          locale: 'de',
          data: {
            key: cat.key,
            name: cat.name.de,
            slug: cat.slug.de,
            intro: cat.intro.de,
            sortOrder: cat.sortOrder,
            showInNavigation: cat.showInNavigation,
          },
          ...seedOp(req),
        })
        await req.payload.update({
          collection: 'categories',
          id: doc.id,
          locale: 'en',
          data: { name: cat.name.en, slug: cat.slug.en, intro: cat.intro.en },
          ...seedOp(req),
        })
        report.add('categories', 'created')
        continue
      }
      let changed = false
      for (const locale of LOCALES) {
        const doc = await req.payload.findByID({
          collection: 'categories',
          id: existing.id,
          locale,
          fallbackLocale: false,
          ...seedOp(req),
        })
        const patch: Obj = {}
        for (const f of ['name', 'slug', 'intro'] as const) {
          if (isEmptyValue(doc[f])) patch[f] = cat[f][locale]
        }
        if (Object.keys(patch).length > 0) {
          await req.payload.update({
            collection: 'categories',
            id: existing.id,
            locale,
            data: patch,
            ...seedOp(req),
          })
          changed = true
        }
      }
      report.add('categories', changed ? 'updated' : 'skipped')
    }
  })
}

async function seedLegalTexts(payload: Payload, base: BaseData, report: SeedReport) {
  await seedStep(payload, async (req) => {
    for (const text of base.legalTexts) {
      const existing = await req.payload.count({
        collection: 'legal-texts',
        where: { type: { equals: text.type } },
        overrideAccess: true,
        req,
      })
      if (existing.totalDocs > 0) {
        report.add('legal-texts', 'skipped')
        continue
      }
      const validFrom = new Date(text.validFrom).toISOString()
      const content = text.sections
        .map((s) => [`## ${s.heading}`, ...s.paragraphs].join('\n\n'))
        .join('\n\n')
      await req.payload.create({
        collection: 'legal-texts',
        locale: 'de',
        data: {
          type: text.type,
          version: 1,
          status: 'active',
          origin: 'placeholder',
          source: 'manual',
          validFrom,
          activatedAt: validFrom,
          sourceNote: text.sourceNote,
          content: toLexical(content) as never,
          seed: false,
        },
        ...seedOp(req),
      })
      report.add('legal-texts', 'created')
    }
  })
}

async function seedAdmin(payload: Payload, options: BaseOptions) {
  const { email, password } = options.admin ?? {}
  if (options.appEnv === 'production') {
    options.report.note('users: kein Admin-Konto in Produktion (pnpm admin:create nutzen)')
    return
  }
  if (!email || !password) {
    options.report.note('users: SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD fehlen – kein Admin angelegt')
    return
  }
  await seedStep(payload, async (req: PayloadRequest) => {
    const { totalDocs } = await req.payload.count({
      collection: 'users',
      overrideAccess: true,
      req,
    })
    if (totalDocs > 0) {
      options.report.add('users', 'skipped')
      return
    }
    await req.payload.create({
      collection: 'users',
      data: { email: email.trim().toLowerCase(), password, name: 'Jutta', role: 'admin' },
      ...seedOp(req),
    })
    options.report.add('users', 'created')
  })
}

export async function importBase(
  payload: Payload,
  base: BaseData,
  options: BaseOptions,
): Promise<void> {
  await seedGlobal(payload, 'settings', base.settings as Obj, options.report)
  await seedGlobal(payload, 'site-texts', {}, options.report)
  await seedCategories(payload, base, options.report)
  await seedLegalTexts(payload, base, options.report)
  await seedAdmin(payload, options)
}
