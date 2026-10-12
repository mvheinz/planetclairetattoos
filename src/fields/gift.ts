import type { GroupField } from 'payload'

import { GIFT_MESSAGE_MAX } from '@/lib/commerce/checkoutSchema'

// Geschenk mit Gruß für eine handgeschriebene Karte (V-18 b, U-93; DATENMODELL §6.8.1/§6.25.1): an der Kasse
// eingegeben, in die Bestellung übernommen, nur für Jutta sichtbar (Bestellung, „Zu packen“, Packzettel). Nur Dienste
// schreiben; der Gruß wird 30 Tage nach Versand bzw. Abholung geleert (LOESCHKONZEPT L-05 Stufe E), die Kasse selbst
// nach 30 Tagen gelöscht (L-03).

const ro = { readOnly: true } as const

export function giftFields(): GroupField {
  return {
    name: 'gift',
    type: 'group',
    label: 'Geschenk',
    fields: [
      {
        name: 'isGift',
        type: 'checkbox',
        label: 'Das ist ein Geschenk',
        defaultValue: false,
        admin: ro,
      },
      {
        name: 'message',
        type: 'textarea',
        label: 'Gruß für die Karte',
        maxLength: GIFT_MESSAGE_MAX,
        admin: {
          ...ro,
          description: 'Wird 30 Tage nach Versand bzw. Abholung automatisch gelöscht.',
        },
      },
    ],
  }
}
