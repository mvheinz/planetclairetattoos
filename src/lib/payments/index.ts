import 'server-only'

import { getEnv, type Env } from '@/lib/env'
import { ConfigError } from '@/lib/errors'
import { logger as defaultLogger, type Logger } from '@/lib/monitoring/logger'

import {
  createMockPaymentsAdapter,
  isMockPaymentsAdapter,
  MockTestApiDisabledError,
  type MockPaymentsAdapter,
  type MockPaymentsTestApi,
} from './mock'
import { createStripeAdapter } from './stripe'
import type { PaymentsAdapter } from './types'

export type * from './types'
export {
  InvalidCheckoutSessionInputError,
  InvalidSignatureError,
  PaymentEventShapeError,
  PaymentSessionNotFoundError,
} from './types'

// Auswahl nur über PAYMENTS_DRIVER (ARCHITEKTUR §3.1 Nr. 1): fehlt für `stripe` der Schlüssel → ConfigError, außer bei
// APP_ENV=development (Warnung + Mock). Mock in Produktion ist verboten.

export function createPaymentsAdapter(env: Env, log: Logger = defaultLogger): PaymentsAdapter {
  const mock = () => createMockPaymentsAdapter({ appEnv: env.APP_ENV, logger: log })
  if (env.PAYMENTS_DRIVER === 'stripe') {
    try {
      return createStripeAdapter(env)
    } catch (e) {
      if (e instanceof ConfigError && env.APP_ENV === 'development') {
        log.warn('payments.fallback_to_mock', { reason: e.message })
        return mock()
      }
      throw e
    }
  }
  if (env.APP_ENV === 'production') {
    throw new ConfigError('PAYMENTS_DRIVER=mock ist in Produktion verboten.')
  }
  return mock()
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

function activeMock(): MockPaymentsAdapter {
  const adapter = getPaymentsAdapter()
  if (!isMockPaymentsAdapter(adapter)) {
    throw new MockTestApiDisabledError(`${getEnv().APP_ENV} mit PAYMENTS_DRIVER=${adapter.driver}`)
  }
  return adapter
}

/**
 * Test-API des Mock-Treibers (ARCHITEKTUR §3.5): nur mit aktivem Mock und APP_ENV development/test, sonst
 * `MockTestApiDisabledError`. Wirkt auf den Zustand in der DB, also auch für andere Prozesse (Danke-Seite, Jobs).
 */
export const mockPayments: MockPaymentsTestApi = {
  emit: async (sessionId, type) => activeMock().emit(sessionId, type),
  setNextOutcome: async (sessionId, next) => activeMock().setNextOutcome(sessionId, next),
}
