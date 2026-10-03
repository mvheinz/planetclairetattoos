// Stationszeichnungen der Startseite (DESIGN §12.4): `src/art/stations/{stationId}.svg` aus `pnpm art:vectorize`
// (P8.14 erste Fassung aus 640-px-Quellen, P9 Feinschliff, nach dem Instagram-Export erneut), je ≤ 8 KB, Tusche über
// `currentColor`. Die SVGs kommen als Text aus `stations.generated.ts` (kein Loader, kein Dateizugriff zur Laufzeit).
// Fehlt eine Station hier, zeichnet `StationArt` die Ersatzzeichnung (`fallbackArtSvg`, SEED-SPEC §4.3) bzw. Coco.
import { STATION_SVGS } from './stations.generated'

export const STATION_ART: Readonly<Partial<Record<string, string>>> = STATION_SVGS
