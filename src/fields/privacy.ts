import type { FieldHook, GroupField } from 'payload'

import { adminText } from '@/admin/translations'

// Einschränkung und Legal Hold (DATENMODELL §5, LOESCHKONZEPT §1 Nr. 2, §4 Regel 3). Audit-Einträge
// (`legal_hold_changed`, `processing_restricted`) schreiben die Collections, die den Baustein nutzen.

type PrivacyData = { legalHold?: boolean; processingRestricted?: boolean }

/** Setzt einen Zeitstempel, wenn ein Häkchen von aus auf an wechselt; leert ihn beim Ausschalten. */
function stampWhen(flag: keyof PrivacyData): FieldHook {
  return ({ value, siblingData, originalDoc }) => {
    const now = siblingData?.[flag] === true
    const before = (originalDoc?.privacy as PrivacyData | undefined)?.[flag] === true
    if (!now) return null
    if (!before) return new Date().toISOString()
    return value
  }
}

export function validateLegalHoldReason(value: unknown, legalHold: boolean | undefined) {
  if (!legalHold) return true
  const len = typeof value === 'string' ? value.trim().length : 0
  return len >= 10 && len <= 300 ? true : adminText('legalHoldReasonRequired')
}

export function privacyFields(): GroupField {
  return {
    name: 'privacy',
    type: 'group',
    label: 'Datenschutz',
    admin: { position: 'sidebar' },
    fields: [
      {
        name: 'processingRestricted',
        type: 'checkbox',
        label: 'Verarbeitung eingeschränkt',
        defaultValue: false,
        admin: {
          description: 'Art. 18 bzw. Art. 17 Abs. 3 lit. b DSGVO: keine Mails, nur Pflichtzwecke.',
        },
      },
      {
        name: 'restrictedAt',
        type: 'date',
        label: 'Eingeschränkt am',
        admin: { readOnly: true },
        hooks: { beforeChange: [stampWhen('processingRestricted')] },
      },
      {
        name: 'legalHold',
        type: 'checkbox',
        label: 'Gegen Löschung gesperrt (Legal Hold)',
        defaultValue: false,
      },
      {
        name: 'legalHoldReason',
        type: 'text',
        label: 'Begründung der Sperre',
        maxLength: 300,
        validate: (value: unknown, { siblingData }: { siblingData: Partial<PrivacyData> }) =>
          validateLegalHoldReason(value, siblingData?.legalHold),
        admin: { condition: (_, sibling) => sibling?.legalHold === true },
      },
      {
        name: 'legalHoldSince',
        type: 'date',
        label: 'Gesperrt seit',
        admin: { readOnly: true },
        hooks: { beforeChange: [stampWhen('legalHold')] },
      },
      {
        name: 'legalHoldReviewedAt',
        type: 'date',
        label: 'Zuletzt geprüft',
        admin: { readOnly: true },
      },
      { name: 'anonymizedAt', type: 'date', label: 'Anonymisiert am', admin: { readOnly: true } },
    ],
  }
}
