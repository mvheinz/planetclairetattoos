import { describe, expect, it } from 'vitest'

import { seedField, SEED_KEY_REGEX, validateSeedKey } from '@/fields'

type Validate = (value: unknown, opts: { collectionSlug?: string }) => true | string

describe('seedField() (DATENMODELL §5, SEED-SPEC §1.2)', () => {
  const [seed, seedKey] = seedField()
  const validate = seedKey.validate as unknown as Validate

  it('seed: Checkbox, Default false, readOnly, Index, Seitenleiste', () => {
    expect(seed).toMatchObject({
      name: 'seed',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    })
    expect(seedKey).toMatchObject({ name: 'seedKey', type: 'text', index: true })
    expect(seedKey.admin).toMatchObject({ hidden: true, readOnly: true })
  })

  it('akzeptiert gültige Schlüssel der eigenen Collection', () => {
    expect(validate('products:S07', { collectionSlug: 'products' })).toBe(true)
    expect(validate('media:ig:DdUPhoZOoMW#a', { collectionSlug: 'media' })).toBe(true)
    expect(validate('email-log:O05:refund_confirmation', { collectionSlug: 'email-log' })).toBe(
      true,
    )
    expect(validate(null, { collectionSlug: 'products' })).toBe(true)
    expect(validate(undefined, { collectionSlug: 'products' })).toBe(true)
  })

  it('AK-P1.6-03 seedKey ohne Präfix <collection>: wird abgelehnt', () => {
    expect(validate('S07', { collectionSlug: 'products' })).toEqual(expect.any(String))
    expect(validate('orders:O05', { collectionSlug: 'products' })).toEqual(expect.any(String))
    expect(validateSeedKey(':S07')).toEqual(expect.any(String))
  })

  it('lehnt ungültige Zeichen und zu lange Schlüssel ab', () => {
    expect(SEED_KEY_REGEX.test(`products:${'a'.repeat(80)}`)).toBe(true)
    expect(validate(`products:${'a'.repeat(81)}`, { collectionSlug: 'products' })).not.toBe(true)
    expect(validate('products:S 07', { collectionSlug: 'products' })).not.toBe(true)
    expect(validate('Products:S07', { collectionSlug: 'Products' })).not.toBe(true)
    expect(validate(42, { collectionSlug: 'products' })).not.toBe(true)
  })
})
