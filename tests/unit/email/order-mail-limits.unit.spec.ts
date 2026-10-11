import { describe, expect, it } from 'vitest'

import {
  clampMailText,
  MAIL_CHARACTERISTICS_MAX,
  orderMailDataSchema,
} from '@/lib/email/templates/orderSections'
import { buildCharacteristics, type CharacteristicsInput } from '@/lib/products/characteristics'

import { ORDER_MAIL_FIXTURE } from '../../helpers/mails'

// P18.5: Die Eigenschaftszeile der Bestellmails darf das Einreihen in der Bestell-Transaktion nie scheitern lassen –
// auch nicht bei Pflegefeldern an ihrer Höchstlänge (Material 200, Abweichung 300, Größe 60).

const deviation = 'x'.repeat(300)
const LONGEST: Record<string, CharacteristicsInput> = {
  textil: {
    category: 'textil',
    sizeLabel: { de: 'G'.repeat(60), en: 'S'.repeat(60) },
    fiberComposition: [
      { component: 'main', fiber: 'cotton', percent: 60 },
      { component: 'main', fiber: 'polyester', percent: 40 },
      { component: 'lining', fiber: 'viscose', percent: 100 },
    ],
    labelMissing: true,
    condition: 'very_good',
    hasDeviation: true,
    deviationDescription: { de: deviation, en: deviation },
  },
  keramik: {
    category: 'keramik',
    materials: { de: 'm'.repeat(200), en: 'm'.repeat(200) },
    dimensions: { widthCm: 12.5, heightCm: 9.5, depthCm: 8.5, diameterCm: 10.5 },
    foodContact: 'lebensmittelecht',
    hasDeviation: true,
    deviationDescription: { de: deviation, en: deviation },
  },
}

const withCharacteristics = (characteristics: string) => ({
  ...ORDER_MAIL_FIXTURE,
  items: [{ ...ORDER_MAIL_FIXTURE.items[0]!, characteristics }],
})

describe('Bestellmail-Daten: Eigenschaftszeile (P18.5)', () => {
  for (const [category, input] of Object.entries(LONGEST)) {
    for (const locale of ['de', 'en'] as const) {
      it(`${category} (${locale}) mit Höchstlängen passt ins Mail-Schema`, () => {
        const line = buildCharacteristics(input, locale)
        expect(line.length).toBeGreaterThan(450)
        expect(orderMailDataSchema.safeParse(withCharacteristics(line)).success).toBe(true)
      })
    }
  }

  it('clampMailText kürzt überlange Zeilen auf die Schema-Grenze, kurze bleiben unverändert', () => {
    expect(clampMailText('Keramik · 300 ml', MAIL_CHARACTERISTICS_MAX)).toBe('Keramik · 300 ml')
    const long = 'ä'.repeat(MAIL_CHARACTERISTICS_MAX + 50)
    const clamped = clampMailText(long, MAIL_CHARACTERISTICS_MAX)
    expect(clamped).toHaveLength(MAIL_CHARACTERISTICS_MAX)
    expect(clamped.endsWith('…')).toBe(true)
    expect(orderMailDataSchema.safeParse(withCharacteristics(clamped)).success).toBe(true)
    expect(orderMailDataSchema.safeParse(withCharacteristics(long)).success).toBe(false)
  })

  it('clampMailText trennt kein Ersatzzeichen-Paar (Emoji)', () => {
    const clamped = clampMailText('a' + '🌸'.repeat(10), 6)
    expect(clamped).toBe('a🌸🌸…')
    expect(clamped.length).toBeLessThanOrEqual(6)
  })
})
