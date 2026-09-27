import 'server-only'

import type { TranslationAdapter } from './types'

// Mock (ARCHITEKTUR §3.6, C-21): deterministisch "[EN] " + Text, keine Netzwerk-Anfrage.

export const MOCK_PREFIX = '[EN] '
/** Kontingent wie DeepL API Free (500.000 Zeichen im Monat), damit die Anzeige im Admin realistisch ist. */
export const MOCK_CHARACTER_LIMIT = 500_000

export function createMockTranslationAdapter(): TranslationAdapter {
  let characterCount = 0
  return {
    driver: 'mock',
    async translate({ texts }) {
      characterCount += texts.reduce((n, t) => n + t.length, 0)
      return texts.map((t) => `${MOCK_PREFIX}${t}`)
    },
    async usage() {
      return { characterCount, characterLimit: MOCK_CHARACTER_LIMIT }
    },
  }
}
