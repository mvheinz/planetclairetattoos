import type { SelectField, TextField, TextareaField } from 'payload'

import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { COCO_POSES, type CocoPose } from '@/lib/enums'

// Gemeinsame Feldbausteine der Seitenblöcke (DATENMODELL §6.19). Alle Textfelder sind lokalisiert.

export const heading = (required = false): TextField => ({
  name: 'heading',
  type: 'text',
  label: 'Überschrift',
  localized: true,
  required,
  maxLength: 120,
})

export const textarea = (
  name: string,
  label: string,
  options: { required?: boolean; maxLength?: number } = {},
): TextareaField => ({
  name,
  type: 'textarea',
  label,
  localized: true,
  required: options.required,
  maxLength: options.maxLength,
})

export const cocoPose = (defaultValue: CocoPose): SelectField => ({
  name: 'cocoPose',
  type: 'select',
  label: 'Coco-Pose',
  defaultValue,
  options: enumOptions(COCO_POSES, ENUM_LABELS.COCO_POSES),
})
