// Stempel „frisch im Shop“ (V-60, U-93, P20.3): Wer auf Instagram ein neues Stück sieht, erkennt es im Shop wieder. Nicht
// „neu“ – die Textilien sind Second-Hand. Entschieden beim Rendern (ISR ≤ 1 h) aus `firstPublishedAt`, rein und ohne
// Datenbank (der Start des Shops kommt als Argument, `getShopStartedAt()` in `src/lib/data/products.ts`).
//
// Regel: frisch = erstmals online vor höchstens 14 Tagen **und** nicht Teil der Erstbefüllung. Die Erstbefüllung sind alle
// Stücke, die in den ersten 48 Stunden nach dem allerersten `firstPublishedAt` des Shops online gingen (der Start mit dem
// ganzen Bestand per Import, `bestand:import` bzw. „Startinhalt übernehmen“) – sonst trügen zum Start alle Stücke den
// Stempel und er sagte nichts mehr. Ein später wieder online gestelltes Stück behält sein erstes Datum (kein neuer Stempel).

/** So lange gilt ein Stück als frisch (Tage ab dem ersten Online-Stellen). */
export const FRESH_DAYS = 14
/** Fenster der Erstbefüllung ab dem allerersten Online-Stellen im Shop (Stunden). */
export const LAUNCH_GRACE_HOURS = 48

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

const time = (v: Date | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null
  const t = (typeof v === 'string' ? new Date(v) : v).getTime()
  return Number.isNaN(t) ? null : t
}

export interface FreshContext {
  /** „Jetzt“ beim Rendern (`tourNow()`: in Test und Vorschau `SEED_NOW`). */
  now: Date
  /** Frühestes `firstPublishedAt` aller Stücke (Start des Shops); `null` = noch nie etwas online. */
  shopStartedAt: Date | string | null
}

/** Trägt ein Stück mit diesem `firstPublishedAt` gerade den Stempel „frisch im Shop“? */
export function isFreshInShop(
  firstPublishedAt: Date | string | null | undefined,
  ctx: FreshContext,
): boolean {
  const published = time(firstPublishedAt)
  const now = time(ctx.now)
  if (published === null || now === null) return false
  const age = now - published
  if (age < 0 || age > FRESH_DAYS * DAY_MS) return false
  const start = time(ctx.shopStartedAt)
  // Ohne bekannten Start (Datenbank nicht erreichbar) lieber kein Stempel als ein falscher Stempel auf allem.
  if (start === null) return false
  return published >= start + LAUNCH_GRACE_HOURS * HOUR_MS
}

/** Stück für den Stempel: nur sichtbare, nicht verkaufte Stücke (verkauft/weg zeigt den „sold“-Stempel bzw. nichts). */
export function freshFor(
  product: { status: string; firstPublishedAt?: string | null },
  ctx: FreshContext | null | undefined,
): boolean {
  if (!ctx) return false
  if (product.status !== 'available' && product.status !== 'reserved') return false
  return isFreshInShop(product.firstPublishedAt, ctx)
}
