import 'server-only'

import { getEnv, type Env } from '@/lib/env'
import { ConfigError } from '@/lib/errors'
import { logger as defaultLogger, type Logger } from '@/lib/monitoring/logger'

import { createDeeplAdapter } from './deepl'
import { createMockTranslationAdapter } from './mock'
import type { TranslationAdapter } from './types'

export type * from './types'

// Auswahl nur über TRANSLATION_DRIVER (ARCHITEKTUR §3.1 Nr. 1); fehlender Schlüssel → ConfigError, außer bei
// APP_ENV=development (Warnung + Mock).

export function createTranslationAdapter(
  env: Env,
  log: Logger = defaultLogger,
): TranslationAdapter {
  if (env.TRANSLATION_DRIVER === 'deepl') {
    try {
      return createDeeplAdapter(env.DEEPL_API_KEY)
    } catch (e) {
      if (e instanceof ConfigError && env.APP_ENV === 'development') {
        log.warn('translation.fallback_to_mock', { reason: e.message })
        return createMockTranslationAdapter()
      }
      throw e
    }
  }
  return createMockTranslationAdapter()
}

let instance: TranslationAdapter | undefined

export function getTranslationAdapter(): TranslationAdapter {
  if (!instance) instance = createTranslationAdapter(getEnv())
  return instance
}

/** Nur in Tests benutzen. */
export function __setTranslationAdapterForTests(adapter?: TranslationAdapter): void {
  instance = adapter
}
