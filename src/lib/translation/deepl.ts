import 'server-only'

import { ConfigError } from '@/lib/errors'

import type { TranslationAdapter } from './types'

// DeepL – Gerüst (ARCHITEKTUR §3.6). Ohne Schlüssel kein Aufruf, sondern ConfigError; die Umsetzung (Bündel ≤ 50 Texte,
// target_lang EN-GB, preserve_formatting, Lexical-Textknoten) folgt in P5.4.

export const DEEPL_MAX_TEXTS_PER_REQUEST = 50

/** `…:fx`-Schlüssel → API Free, sonst Pro. */
export function deeplEndpoint(apiKey: string): string {
  return apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate'
}

export function createDeeplAdapter(apiKey: string | undefined): TranslationAdapter {
  if (!apiKey) {
    throw new ConfigError(
      'TRANSLATION_DRIVER=deepl, aber DEEPL_API_KEY fehlt. Bitte den DeepL-Schlüssel setzen oder TRANSLATION_DRIVER=mock verwenden.',
    )
  }
  const later = () =>
    Promise.reject(new Error('DeepL-Übersetzung ist noch nicht umgesetzt (folgt in P5.4).'))
  return { driver: 'deepl', translate: later, usage: later }
}
