import 'server-only'

import { getEnv, type Env } from '@/lib/env'
import { ConfigError } from '@/lib/errors'
import { logger as defaultLogger, type Logger } from '@/lib/monitoring/logger'

import { createMockPaymentsAdapter } from './mock'
import { createStripeAdapter } from './stripe'
import type { PaymentsAdapter } from './types'

export type * from './types'
export { InvalidSignatureError } from './types'

// Auswahl nur über PAYMENTS_DRIVER (ARCHITEKTUR §3.1 Nr. 1): fehlt für `stripe` der Schlüssel → ConfigError, außer bei
// APP_ENV=development (Warnung + Mock). Mock in Produktion ist verboten.

export function createPaymentsAdapter(env: Env, log: Logger = defaultLogger): PaymentsAdapter {
  if (env.PAYMENTS_DRIVER === 'stripe') {
    try {
      return createStripeAdapter(env)
    } catch (e) {
      if (e instanceof ConfigError && env.APP_ENV === 'development') {
        log.warn('payments.fallback_to_mock', { reason: e.message })
        return createMockPaymentsAdapter()
      }
      throw e
    }
  }
  if (env.APP_ENV === 'production') {
    throw new ConfigError('PAYMENTS_DRIVER=mock ist in Produktion verboten.')
  }
  return createMockPaymentsAdapter()
}

let instance: PaymentsAdapter | undefined

export function getPaymentsAdapter(): PaymentsAdapter {
  if (!instance) instance = createPaymentsAdapter(getEnv())
  return instance
}

/** Nur in Tests benutzen. */
export function __setPaymentsAdapterForTests(adapter?: PaymentsAdapter): void {
  instance = adapter
}
