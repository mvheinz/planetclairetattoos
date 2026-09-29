// Typen für `wawoff2` (Paket ohne eigene Deklarationen), nur die in `scripts/fonts/copy.ts` genutzte Umwandlung.
// Achtung: `decompress` liefert eine Sicht auf den WASM-Speicher – vor dem nächsten Aufruf kopieren (`Buffer.from`).
declare module 'wawoff2' {
  export function decompress(woff2: Buffer | Uint8Array): Promise<Uint8Array>
  export function compress(sfnt: Buffer | Uint8Array): Promise<Uint8Array>
}
