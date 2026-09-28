// Datenformat der Vorschau-Datei (ARCHITEKTUR §14.5/§14.6): `#pv-data` (Texte, Routen, Stand) und `#pv-assets`
// (Bilder als Data-URI). Geschrieben von `scripts/preview-export/write.ts`, gelesen von `main.ts`.

export type PvLang = 'de' | 'en'
export type PvGroup = 'start' | 'shop' | 'tattoo' | 'service' | 'legal' | 'admin'

/** Eintrag von `window.__PV_ROUTES`. */
export interface PvRoute {
  route: string
  lang: PvLang
  title: string
  group: PvGroup
  built: boolean
}

/** Texte `previewExport.*` je Sprache (aus `src/i18n/messages/{de,en}.json`). */
export interface PvTexts {
  bannerInternal: string
  bannerStand: string
  allPages: string
  notBuilt: string
  dialogTitle: string
  dialogClose: string
  cartDemo: string
  groups: Record<PvGroup, string>
}

export interface PvData {
  /** Phase zur Anzeige, z. B. `P2`. */
  phase: string
  /** Stand-Datum je Sprache (schon formatiert). */
  date: Record<PvLang, string>
  texts: Record<PvLang, PvTexts>
  routes: PvRoute[]
}

declare global {
  interface Window {
    __PV_ROUTES?: PvRoute[]
  }
}
