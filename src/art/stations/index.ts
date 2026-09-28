// Stationszeichnungen der Startseite (DESIGN §12.4): `src/art/stations/{stationId}.svg` aus `pnpm art:vectorize`
// (P8 erste Fassung, P9 Feinschliff), je ≤ 8 KB, Füllung `currentColor`. Solange eine Datei fehlt, zeichnet
// `StationArt` die Ersatzzeichnung (`fallbackArtSvg`, SEED-SPEC §4.3) bzw. Coco aus dem Sprite. Neue Dateien hier
// eintragen (statischer Import, kein Dateizugriff zur Laufzeit), z. B.:
//   import keramik from './keramik.svg?raw'  →  keramik,
export const STATION_ART: Readonly<Partial<Record<string, string>>> = {}
