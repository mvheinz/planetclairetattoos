// Kachel-Bilder der Kategorie-Karten im Shop (P12.15): je Kategorie ein Coco-Foto aus Juttas Instagram-Material
// (content/seed/instagram/highlight-*.jpg, 150 × 150 px, als WebP in public/shop-tiles/). Statische Zuordnung nach
// `Category.key`; `all` = Karte „Alle“. Austausch: neue Datei `<key>.v2.webp` ablegen und hier eintragen.
// Bewusst kein CMS-Feld (keine Migration); siehe docs/OFFENE-PUNKTE.md.
export const TILE_SIZE = 150

export interface CategoryTile {
  src: string
  position: string
}

const ALL: CategoryTile = { src: '/shop-tiles/all.v1.webp', position: '50% 50%' }

export const CATEGORY_TILES: Record<string, CategoryTile> = {
  all: ALL,
  keramik: { src: '/shop-tiles/keramik.v1.webp', position: '50% 50%' },
  textil: { src: '/shop-tiles/textil.v1.webp', position: '50% 50%' },
  cap: { src: '/shop-tiles/cap.v1.webp', position: '50% 40%' },
  zeichnung: { src: '/shop-tiles/zeichnung.v1.webp', position: '50% 50%' },
  schmuck: { src: '/shop-tiles/schmuck.v1.webp', position: '50% 50%' },
  sonstiges: { src: '/shop-tiles/sonstiges.v1.webp', position: '50% 50%' },
}

export function categoryTile(key: string): CategoryTile {
  return CATEGORY_TILES[key] ?? ALL
}
