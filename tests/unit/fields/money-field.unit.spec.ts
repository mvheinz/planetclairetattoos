// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EuroInputControl, INVALID_CENTS } from '@/admin/components/EuroInputControl'
import { EURO_INPUT_COMPONENT, moneyField, sortOrderField, validateCents } from '@/fields'
import { formatEuroInput } from '@/lib/money'

afterEach(cleanup)

const MSG = 'ungültig'

function setup(value: number | null = null) {
  const onChange = vi.fn()
  render(createElement(EuroInputControl, { id: 'price', value, onChange, invalidMessage: MSG }))
  return { onChange, input: screen.getByRole('textbox') as HTMLInputElement }
}

describe('moneyField() und EuroInput (DATENMODELL §5)', () => {
  it('Feld ist number mit Admin-Komponente EuroInput und Ganzzahl-Validierung', () => {
    const f = moneyField('priceCents', { required: true })
    expect(f).toMatchObject({ name: 'priceCents', type: 'number', required: true, min: 0 })
    expect(f.admin?.components?.Field).toBe(EURO_INPUT_COMPONENT)
    const validate = f.validate as unknown as (v: unknown) => true | string
    expect(validate(3850)).toBe(true)
    expect(validate(3850.5)).not.toBe(true)
    expect(validate(INVALID_CENTS)).not.toBe(true)
    expect(validate(null)).not.toBe(true)
    expect(validateCents(null)).toBe(true)
  })

  it('AK-P1.6-02 EuroInput speichert „38,50“ als 3850', () => {
    const { onChange, input } = setup()
    fireEvent.change(input, { target: { value: '38,50' } })
    expect(onChange).toHaveBeenLastCalledWith(3850)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('AK-P1.6-02 EuroInput lehnt „38,555“ ab (Fehlermeldung, Wert ungültig für die Validierung)', () => {
    const { onChange, input } = setup()
    fireEvent.change(input, { target: { value: '38,555' } })
    expect(onChange).toHaveBeenLastCalledWith(INVALID_CENTS)
    expect(screen.getByRole('alert').textContent).toBe(MSG)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(validateCents(INVALID_CENTS)).not.toBe(true)
  })

  it('zeigt gespeicherte Cent als Euro und formatiert beim Verlassen', () => {
    const { onChange, input } = setup(4500)
    expect(input.value).toBe('45,00')
    fireEvent.change(input, { target: { value: '1.234,5' } })
    expect(onChange).toHaveBeenLastCalledWith(123450)
    fireEvent.blur(input)
    expect(input.value).toBe('1234,50')
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(formatEuroInput(5)).toBe('0,05')
  })

  it('sortOrderField: Ganzzahl 0–9999, Default 100', () => {
    const f = sortOrderField()
    expect(f).toMatchObject({ name: 'sortOrder', type: 'number', defaultValue: 100 })
    const validate = f.validate as unknown as (v: unknown) => true | string
    expect(validate(0)).toBe(true)
    expect(validate(9999)).toBe(true)
    expect(validate(10000)).not.toBe(true)
    expect(validate(1.5)).not.toBe(true)
  })
})
