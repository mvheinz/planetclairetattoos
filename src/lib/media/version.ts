// Version der Bildpipeline (`media.derivativesVersion`, DATENMODELL §6.2). Bei jeder Änderung an Schritten oder Größen
// erhöhen und danach `pnpm media:regenerate` ausführen.
//   1 = P1 (Normieren, Zuschnitt, Größen)
//   2 = P9.14 (Foto-Look: Weißabgleich, Belichtung, Schalter `enhance`)
export const DERIVATIVES_VERSION = 2
