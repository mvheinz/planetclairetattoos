import type { InquiryStatus } from '@/lib/enums'

// Statusautomat der Anfragen (Auftragsarbeiten, KONZEPT §5.5, DATENMODELL §6.17): `new` entsteht über das Formular
// (P7); alle weiteren Wechsel macht Jutta in der Verwaltung („Anfragen“, PLAN P5.20). Endzustände lassen sich
// über „Wieder öffnen“ zurück nach `in_progress` holen. Rein, ohne Server-Abhängigkeiten (Knöpfe und Hook nutzen
// dieselbe Tabelle).

export const INQUIRY_TRANSITIONS: Readonly<Record<InquiryStatus, readonly InquiryStatus[]>> = {
  new: ['in_progress', 'offer_sent', 'declined', 'closed'],
  in_progress: ['offer_sent', 'declined', 'closed'],
  offer_sent: ['accepted', 'declined', 'in_progress', 'closed'],
  accepted: ['completed', 'in_progress'],
  declined: ['in_progress'],
  completed: ['in_progress'],
  closed: ['in_progress'],
}

/** Endzustände: der Wechsel nach `in_progress` heißt dort „Wieder öffnen“. */
export const INQUIRY_FINAL_STATUSES: readonly InquiryStatus[] = ['declined', 'completed', 'closed']

/** Übergangs-Kennung im Audit (`changes.$transition`), z. B. `new→in_progress`. */
export const inquiryTransitionId = (from: InquiryStatus, to: InquiryStatus) => `${from}→${to}`

export function canTransitionInquiry(from: InquiryStatus, to: InquiryStatus): boolean {
  return INQUIRY_TRANSITIONS[from]?.includes(to) ?? false
}

export function isReopen(from: InquiryStatus, to: InquiryStatus): boolean {
  return INQUIRY_FINAL_STATUSES.includes(from) && to === 'in_progress'
}
