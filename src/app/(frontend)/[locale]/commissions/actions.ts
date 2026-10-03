'use server'

import { headers } from 'next/headers'

import { commissionStep, type CommissionFormState } from '@/lib/commission/form'
import { clientIp } from '@/lib/security/rateLimit'

// Server Action des Auftragsarbeiten-Formulars R10 (PLAN P7.12, KONZEPT §10): progressiv (mit `useActionState`, ohne
// JavaScript als normales POST-Formular). Die Sprache kommt aus dem versteckten Feld `locale` (von der Route gesetzt),
// die Uhrzeit vom Server, die IP nur für das Rate-Limit (täglich wechselnder Hash, nie am Datensatz).
export async function submitCommissionInquiry(
  prev: CommissionFormState,
  formData: FormData,
): Promise<CommissionFormState> {
  const ip = clientIp(await headers())
  return commissionStep(prev, formData, { now: new Date(), ip })
}
