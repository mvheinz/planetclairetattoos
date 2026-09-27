// Flash-Nummern (DATENMODELL §6.14, E-52): Ganzzahl 1–9999, Anzeige mindestens dreistellig („F-012“), Seed ab 901.

export const FLASH_NUMBER_MIN = 1
export const FLASH_NUMBER_MAX = 9999

/** `12` → `F-012`, `1234` → `F-1234`. */
export function formatFlashNumber(n: number): string {
  if (!Number.isInteger(n) || n < FLASH_NUMBER_MIN || n > FLASH_NUMBER_MAX) {
    throw new Error(`Ungültige Flash-Nummer: ${n}`)
  }
  return `F-${String(n).padStart(3, '0')}`
}
