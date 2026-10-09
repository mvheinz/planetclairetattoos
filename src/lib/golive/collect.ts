import 'server-only'

import { access } from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'

import { LEGAL_TEXT_TYPES } from '@/lib/enums'
import { getEnv, type Env } from '@/lib/env'
import { getActiveLegalText } from '@/lib/legal/getActive'
import { requiredProductionAgreements } from '@/lib/legal/services'
import { LEGAL_SNIPPET_REQUIRES_LAWYER, loadLegalSnippets } from '@/lib/legal/snippets'
import { warrantyNoticeIsPlaceholder, warrantyNoticePlaceholderParts } from '@/lib/legal/warranty'
import { countUnapprovedOwnerPhotos } from '@/lib/media/ownerPhotos'
import { seedSummary } from '@/lib/seed/remove'
import type { Setting } from '@/payload-types'

import { evaluateGolive, type GoliveInput, type GoliveReport } from './checks'

// Datensammler der Startklar-Prüfung (R-210): liest Einstellungen, Rechtstexte, Beispieldaten und Umgebung und ruft die
// reine Prüffunktion `evaluateGolive` auf. Genutzt von `scripts/check-golive.ts`, der Ansicht „Startklar“, „Heute“ und
// der Sperre „Shop öffnen“.

export const VVT_PATH = path.join('docs', 'recht', 'VVT.md')

async function fileExists(rel: string): Promise<boolean> {
  try {
    await access(path.join(process.cwd(), rel))
    return true
  } catch {
    return false
  }
}

/** Umgebungsteil der Eingabe (ohne Geheimnisse: nur „gesetzt ja/nein“, Live-Schlüssel ja/nein). */
export function goliveEnv(env: Env = getEnv()): GoliveInput['env'] {
  return {
    appEnv: env.APP_ENV,
    paymentsDriver: env.PAYMENTS_DRIVER,
    emailDriver: env.EMAIL_DRIVER,
    storageDriver: env.STORAGE_DRIVER,
    adminRoute: env.ADMIN_ROUTE,
    seedPreviewMode: env.SEED_PREVIEW_MODE === true,
    stripeWebhookSecretSet: (env.STRIPE_WEBHOOK_SECRET ?? '').length > 0,
    stripeLiveKey: /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY ?? ''),
  }
}

export async function collectGoliveInput(payload: Payload, now: Date): Promise<GoliveInput> {
  const legalTexts: GoliveInput['legalTexts'] = {}
  for (const type of LEGAL_TEXT_TYPES) {
    const active = await getActiveLegalText(type, now, { payload, fallbackLocale: false })
    if (active)
      legalTexts[type] = { origin: active.origin ?? null, isPlaceholder: active.isPlaceholder }
  }
  const snippets = await loadLegalSnippets(payload)
  const snippetsNotLawyer = LEGAL_SNIPPET_REQUIRES_LAWYER.filter((key) => {
    const active = (snippets.get(key) ?? []).find((s) => s.validFrom.getTime() <= now.getTime())
    return !active || active.origin !== 'lawyer'
  })
  const settings = (await payload.findGlobal({
    slug: 'settings',
    depth: 0,
    overrideAccess: true,
  })) as Setting
  const { totalDocs: galleryWithoutConsent } = await payload.count({
    collection: 'tattoo-gallery',
    where: {
      and: [
        { published: { equals: true } },
        { showsCustomer: { equals: true } },
        { consentGiven: { not_equals: true } },
      ],
    },
    overrideAccess: true,
  })
  return {
    now,
    env: goliveEnv(),
    legalTexts,
    snippetsNotLawyer: [...snippetsNotLawyer],
    settings,
    requiredAgreements: requiredProductionAgreements().map((s) => ({ id: s.id, name: s.name })),
    seedCounts: await seedSummary(payload),
    ownerPhotosUnapproved: await countUnapprovedOwnerPhotos(payload),
    galleryWithoutConsent,
    warrantyGraphicPlaceholder: warrantyNoticeIsPlaceholder(),
    warrantyPlaceholderParts: warrantyNoticePlaceholderParts(),
    vvtExists: await fileExists(VVT_PATH),
  }
}

/** Die eine Prüffunktion für Skript, Ansicht, „Heute“ und Sperre. */
export async function runGoliveCheck(
  payload: Payload,
  now: Date = new Date(),
): Promise<GoliveReport> {
  return evaluateGolive(await collectGoliveInput(payload, now))
}
