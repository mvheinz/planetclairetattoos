import type { Block } from 'payload'

import { heading, textarea } from './shared'

export const CommissionForm: Block = {
  slug: 'commissionForm',
  labels: { singular: 'Anfrageformular', plural: 'Anfrageformulare' },
  fields: [
    heading(),
    textarea('intro', 'Einleitung', { maxLength: 600 }),
    textarea('successText', 'Text nach dem Absenden', { required: true, maxLength: 600 }),
  ],
}
