import React from 'react'

import { getEnv } from '@/lib/env'
import { clientErrorsActive } from '@/lib/monitoring/clientErrors'

import { ClientErrorReporter } from './ClientErrorReporter'

/** Bindet das Meldeskript nur ein, wenn Browser-Fehlermeldungen erlaubt sind (aus, bis K-30 c beantwortet ist). */
export function ClientErrorSlot() {
  return clientErrorsActive(getEnv()) ? <ClientErrorReporter /> : null
}
