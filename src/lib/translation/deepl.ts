import 'server-only'

import { ConfigError } from '@/lib/errors'

import type { TranslationAdapter } from './types'

// DeepL (ARCHITEKTUR §3.6): `…:fx`-Schlüssel → API Free, sonst Pro; `target_lang: 'EN-GB'` (passend zu `og:locale
// en_GB`), `preserve_formatting`, höchstens 50 Texte je Anfrage. Nur Produkt-/Seitentexte, nie personenbezogene Daten
// (DIENSTE §3.9). Ohne Schlüssel kein Aufruf, sondern ConfigError.

export const DEEPL_MAX_TEXTS_PER_REQUEST = 50
export const DEEPL_TARGET_LANG = 'EN-GB'

export function deeplBaseUrl(apiKey: string): string {
  const url = apiKey.endsWith(':fx') ? 'https://api-free.deepl.com/' : 'https://api.deepl.com/'
  return url.slice(0, -1)
}

/** `…:fx`-Schlüssel → API Free, sonst Pro. */
export function deeplEndpoint(apiKey: string): string {
  return `${deeplBaseUrl(apiKey)}/v2/translate`
}

export interface DeeplOptions {
  /** Nur Tests: HTTP-Stub auf 127.0.0.1 statt DeepL. */
  baseUrl?: string
  fetch?: typeof fetch
  /** Abbruch nach … ms (Standard 20 s). */
  timeoutMs?: number
}

export class DeeplError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'DeeplError'
  }
}

function errorFor(status: number): DeeplError {
  const message =
    status === 456
      ? 'Das DeepL-Kontingent für diesen Monat ist aufgebraucht.'
      : status === 403 || status === 401
        ? 'Der DeepL-Schlüssel wurde abgelehnt.'
        : status === 429
          ? 'DeepL ist gerade ausgelastet – bitte gleich noch einmal versuchen.'
          : `DeepL hat nicht geantwortet (HTTP ${status}).`
  return new DeeplError(message, status)
}

export function createDeeplAdapter(
  apiKey: string | undefined,
  options: DeeplOptions = {},
): TranslationAdapter {
  if (!apiKey) {
    throw new ConfigError(
      'TRANSLATION_DRIVER=deepl, aber DEEPL_API_KEY fehlt. Bitte den DeepL-Schlüssel setzen oder TRANSLATION_DRIVER=mock verwenden.',
    )
  }
  const base = (options.baseUrl ?? deeplBaseUrl(apiKey)).replace(/\/+$/, '')
  const doFetch = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? 20_000
  const headers = {
    authorization: `DeepL-Auth-Key ${apiKey}`,
    'content-type': 'application/json',
  }

  async function call(path: string, init: RequestInit): Promise<unknown> {
    const res = await doFetch(`${base}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) throw errorFor(res.status)
    return res.json()
  }

  async function translateChunk(texts: string[]): Promise<string[]> {
    const body = (await call('/v2/translate', {
      method: 'POST',
      body: JSON.stringify({
        text: texts,
        source_lang: 'DE',
        target_lang: DEEPL_TARGET_LANG,
        preserve_formatting: true,
      }),
    })) as { translations?: { text?: unknown }[] }
    const out = (body.translations ?? []).map((t) => (typeof t.text === 'string' ? t.text : ''))
    if (out.length !== texts.length) {
      throw new DeeplError('DeepL hat eine unvollständige Antwort geschickt.', 502)
    }
    return out
  }

  return {
    driver: 'deepl',
    async translate({ texts }) {
      const result: string[] = texts.map(() => '')
      // Leere Texte gehen nicht an DeepL (kosten Kontingent, liefern nichts).
      const pending = texts.map((t, i) => ({ t, i })).filter(({ t }) => t.trim() !== '')
      for (let start = 0; start < pending.length; start += DEEPL_MAX_TEXTS_PER_REQUEST) {
        const chunk = pending.slice(start, start + DEEPL_MAX_TEXTS_PER_REQUEST)
        const translated = await translateChunk(chunk.map(({ t }) => t))
        chunk.forEach(({ i }, k) => (result[i] = translated[k]!))
      }
      return result
    },
    async usage() {
      const body = (await call('/v2/usage', { method: 'GET' })) as {
        character_count?: unknown
        character_limit?: unknown
      }
      if (typeof body.character_count !== 'number' || typeof body.character_limit !== 'number') {
        return null
      }
      return { characterCount: body.character_count, characterLimit: body.character_limit }
    },
  }
}
