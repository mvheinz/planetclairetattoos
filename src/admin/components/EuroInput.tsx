'use client'

import type { NumberFieldClientComponent } from 'payload'
import { FieldDescription, FieldError, FieldLabel, useField, useTranslation } from '@payloadcms/ui'

import { EuroInputControl } from './EuroInputControl'

// Admin-Feld für `…Cents` (DATENMODELL §5 moneyField): Eingabe in Euro, Speicherung als Integer-Cent.
export const EuroInput: NumberFieldClientComponent = ({ field, path, readOnly }) => {
  const { value, setValue, showError } = useField<number | null>({ path })
  const { t } = useTranslation()
  const tr = t as (key: string) => string
  const id = `field-${path.replace(/\./g, '__')}`
  return (
    <div className="field-type number">
      <FieldLabel htmlFor={id} label={field.label} path={path} required={field.required} />
      <div className="field-type__wrap">
        <FieldError path={path} showError={showError} />
        <EuroInputControl
          id={id}
          value={value}
          onChange={(cents) => setValue(cents)}
          invalidMessage={tr('custom:euroInputInvalid')}
          hint={tr('custom:euroInputHint')}
          readOnly={readOnly || field.admin?.readOnly}
          required={field.required}
        />
      </div>
      {field.admin?.description ? (
        <FieldDescription description={field.admin.description} path={path} />
      ) : null}
    </div>
  )
}
