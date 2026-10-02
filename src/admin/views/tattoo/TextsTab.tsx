import React from 'react'

import { loadTattooFaqs, loadTattooPageTexts, TATTOO_FAQ_CATEGORIES } from '@/lib/tattoo/admin'
import { TATTOO_TEXT_PAGE_KEYS, TATTOO_TEXT_PAGES } from '@/lib/tattoo/textBlocks'
import { translationAvailability } from '@/lib/translation'

import type { AdminViewBodyProps } from '../AdminViewBody'
import { TattooPricesForm } from '../settings/AreaForms'
import { initialTattooPrices, type Obj } from '../settings/settingsAreas'
import { FaqEditor } from './FaqEditor'
import { PageTextsEditor } from './PageTextsEditor'
import { tattooText } from './tattooText'

// Reiter „Texte“ (PLAN P7.9, KONZEPT §7.12, §9.6): Preise (`settings.tattoo.*`, DE/EN), Stil, Preise-Text, Ablauf
// (Seite `tattoo`), Aftercare (Seite `tattoo_aftercare`) und FAQ der Kategorien `tattoo`/`aftercare` (sortierbar), alles
// mit „Übersetzen“. Keine Eingabefelder für Gesundheitsdaten (V-25). Übrige Seiten und FAQ-Kategorien folgen in P8.

export async function TextsTab({ req }: Pick<AdminViewBodyProps, 'req' | 'adminRoute'>) {
  const availability = translationAvailability()
  const translateDisabled = availability.enabled ? null : (availability.reason ?? null)
  const settings = (locale: 'de' | 'en') =>
    req.payload.findGlobal({
      slug: 'settings',
      locale,
      fallbackLocale: false,
      depth: 0,
      overrideAccess: true,
      req,
    }) as unknown as Promise<Obj>
  const settingsDe = await settings('de')
  const settingsEn = await settings('en')
  const pages = []
  for (const key of TATTOO_TEXT_PAGE_KEYS)
    pages.push({ key, ...(await loadTattooPageTexts(req, key)) })
  const faqs = await loadTattooFaqs(req)

  return (
    <div className="pc-order pc-texts" data-testid="tattoo-texts">
      <section className="pc-order__section" aria-labelledby="tattoo-texts-prices">
        <h2 id="tattoo-texts-prices">{tattooText('textsPrices')}</h2>
        <TattooPricesForm
          initial={initialTattooPrices(settingsDe, settingsEn)}
          translateDisabled={translateDisabled}
        />
      </section>
      {pages.map((p) => (
        <section
          key={p.key}
          className="pc-order__section"
          aria-labelledby={`tattoo-texts-${p.key}`}
        >
          <h2 id={`tattoo-texts-${p.key}`}>{TATTOO_TEXT_PAGES[p.key].label}</h2>
          {p.page ? null : <p className="pc-piece__hint">{tattooText('textsPageMissing')}</p>}
          <PageTextsEditor
            pageKey={p.key}
            initialPageId={p.page?.id ?? null}
            initialBlocks={p.blocks}
            translateDisabled={translateDisabled}
          />
        </section>
      ))}
      {TATTOO_FAQ_CATEGORIES.map((category) => (
        <section
          key={category}
          className="pc-order__section"
          aria-labelledby={`tattoo-texts-faq-${category}`}
        >
          <h2 id={`tattoo-texts-faq-${category}`}>
            {tattooText(category === 'tattoo' ? 'faqTattoo' : 'faqAftercare')}
          </h2>
          <FaqEditor
            category={category}
            items={faqs.filter((f) => f.category === category).map((f) => ({ ...f, id: f.id }))}
            translateDisabled={translateDisabled}
          />
        </section>
      ))}
    </div>
  )
}
