'use server'

import { headers } from 'next/headers'

import { withdrawalStep, type WithdrawalFlowState } from '@/lib/legal/withdrawalForm'
import { clientIp } from '@/lib/security/rateLimit'

// Server Action der Widerrufsfunktion R26 (PLAN P6.8): ein Schritt je Absenden (mit `useActionState`, ohne JavaScript
// als normales POST-Formular). Die Sprache kommt aus dem versteckten Feld `locale`, die Uhrzeit vom Server, die IP nur
// für das Rate-Limit beim Bestätigen (nie am Datensatz, R-093).
export async function withdrawalAction(
  prev: WithdrawalFlowState,
  formData: FormData,
): Promise<WithdrawalFlowState> {
  const locale = formData.get('locale') === 'en' ? 'en' : 'de'
  const ip = clientIp(await headers())
  return withdrawalStep(prev, formData, { now: new Date(), locale, ip })
}
