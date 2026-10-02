import type { PrivacyRequest } from '@/payload-types'

import type { AdminViewBodyProps } from '../AdminViewBody'

// Werkzeuge einer Datenschutz-Anfrage unter den Eckdaten (PLAN P6.17–P6.19): Personensuche und Auskunft-Export,
// Löschen/Einschränken, Berichtigung, Einwilligungswiderruf und Mails zur Anfrage.

export interface PrivacyRequestSectionsProps extends AdminViewBodyProps {
  request: PrivacyRequest
  now: Date
}

export async function PrivacyRequestSections(_props: PrivacyRequestSectionsProps) {
  return null
}
