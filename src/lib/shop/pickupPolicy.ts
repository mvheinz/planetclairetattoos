// Schalter „Abholung möglich“ (`settings.shipping.pickupEnabled`, KONZEPT §11; P18.5): eine Stelle für alle Prüfungen –
// „In den Korb“, Korb (Anzeige und Lieferart), Kasse (Start, Lieferartwechsel, Absenden) und die Seiten. Ist der Schalter
// aus, gibt es keine Abholung: kein Abhol-Radio, die Dienste lehnen `pickup` mit `pickup_disabled` ab und fallen auf
// Versand zurück. Stücke mit Versandklasse `nur_abholung` sind dann nicht bestellbar (konservativer Standard,
// OFFENE-PUNKTE 2026-10-11 P18.5) – umstellbar über `PICKUP_ONLY_BLOCKED_WHEN_PICKUP_OFF`. Reines Modul ohne Datenbank.

/**
 * `true` (Standard): Solange Abholung aus ist, sind `nur_abholung`-Stücke nicht bestellbar („Gerade nicht bestellbar –
 * Abholung ist im Moment nicht möglich“). `false`: Sie bleiben bestellbar und erzwingen weiter Abholung; der Schalter gilt
 * dann nur für Stücke, die man auch verschicken kann.
 */
export const PICKUP_ONLY_BLOCKED_WHEN_PICKUP_OFF = true

/** `settings.shipping.pickupEnabled` (Standard an; nur ein ausdrückliches `false` schaltet Abholung ab). */
export function pickupEnabledIn(settings: unknown): boolean {
  const shipping = (
    settings as { shipping?: { pickupEnabled?: unknown } | null } | null | undefined
  )?.shipping
  return shipping?.pickupEnabled !== false
}

/** Darf ein Stück mit Versandklasse `nur_abholung` gerade bestellt werden? */
export function pickupOnlyOrderable(
  pickupEnabled: boolean,
  blockWhenOff: boolean = PICKUP_ONLY_BLOCKED_WHEN_PICKUP_OFF,
): boolean {
  return pickupEnabled || !blockWhenOff
}

/**
 * Ist Abholung für diesen Korb bzw. diese Kasse wählbar? An, solange der Schalter an ist; sonst nur, wenn ein
 * bestellbares `nur_abholung`-Stück dabei ist (nur mit `PICKUP_ONLY_BLOCKED_WHEN_PICKUP_OFF = false` möglich).
 */
export function pickupSelectable(
  pickupEnabled: boolean,
  hasPickupOnly: boolean,
  blockWhenOff: boolean = PICKUP_ONLY_BLOCKED_WHEN_PICKUP_OFF,
): boolean {
  return pickupEnabled || (hasPickupOnly && pickupOnlyOrderable(pickupEnabled, blockWhenOff))
}
