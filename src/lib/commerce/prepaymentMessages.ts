import 'server-only'

import type { OrderCancelReason } from '@/lib/enums'

// Texte der Vorkasse-Aktionen bei stornierten Bestellungen (KONZEPT §4.8, §5.3 O4/O5; P18.5): Nach einem Widerruf
// (O4 `withdrawn`) oder einem Storno durch Jutta (`admin`) lebt die Bestellung nie wieder auf – kommt trotzdem Geld an,
// geht es zurück („Rücküberweisung erledigt“, nach Widerruf binnen 14 Tagen, § 357 Abs. 1 BGB). Nur nach abgelaufener
// Zahlungsfrist (`payment_timeout`) gibt es „Nachträglich bezahlt“ (O5). Ohne Payload (Endpunkt und Dienst).

/** Meldung, wenn „Zahlung erhalten“ bzw. „Nachträglich bezahlt“ eine stornierte Bestellung trifft. */
export function paidAfterCancelMessage(cancelReason: string | null | undefined): string {
  if (cancelReason === 'withdrawn') {
    return 'Die Bestellung wurde widerrufen – bitte das Geld zurücküberweisen und dann „Rücküberweisung erledigt“ klicken.'
  }
  if (cancelReason === 'admin') {
    return 'Die Bestellung ist storniert – bitte das Geld zurücküberweisen und dann „Rücküberweisung erledigt“ klicken.'
  }
  return 'Die Bestellung wurde wegen abgelaufener Zahlungsfrist storniert – bitte „Nachträglich bezahlt“ nutzen.'
}

/** Anlass der Rücküberweisung je Storno-Grund (Audit-Text). */
export const REFUND_TRANSFER_OCCASION: Readonly<Record<OrderCancelReason, string>> = {
  payment_timeout: 'verspätete Vorkasse-Zahlung',
  withdrawn: 'Zahlung trotz Widerruf',
  admin: 'Zahlung trotz Storno',
}
