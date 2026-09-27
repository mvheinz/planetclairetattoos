import 'server-only'

// Übersetzungs-Adapter (ARCHITEKTUR §3.6): nur Produkt-/Seitentexte, nie personenbezogene Daten (DIENSTE §3.9).

export type TranslationDriver = 'mock' | 'deepl'

export interface TranslateInput {
  texts: string[]
  source: 'de'
  target: 'en'
}

export interface TranslationUsage {
  characterCount: number
  characterLimit: number
}

export interface TranslationAdapter {
  readonly driver: TranslationDriver
  /** Reihenfolge bleibt erhalten. */
  translate(i: TranslateInput): Promise<string[]>
  usage(): Promise<TranslationUsage | null>
}
