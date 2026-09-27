// Stabiler, framework-freier String-Hash (FNV-1a, 32 Bit) für die Auswahl handgezeichneter Varianten
// (z. B. `LinkUnderline` per `href`, Kopflinie per Route; DESIGN KO-02, KO-03). Kein Kryptohash.
export function fnv1a(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Variante `0 … count-1` für einen Seed-String. */
export function variantOf(seed: string, count: number): number {
  return fnv1a(seed) % count
}
