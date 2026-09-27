// Typen für `subset-font` (Paket ohne eigene Deklarationen), nur die in `scripts/fonts/copy.ts` genutzten Optionen.
declare module 'subset-font' {
  interface AxisRange {
    min: number
    max: number
    default?: number
  }
  interface SubsetFontOptions {
    targetFormat?: 'sfnt' | 'woff' | 'woff2'
    preserveNameIds?: number[]
    keepFeatures?: string[]
    variationAxes?: Record<string, number | AxisRange>
    noLayoutClosure?: boolean
    glyphNames?: boolean
    noHinting?: boolean
    dropTables?: string[]
    keepAllGlyphs?: boolean
  }
  export default function subsetFont(
    originalFont: Buffer | Uint8Array,
    text: string,
    options?: SubsetFontOptions,
  ): Promise<Buffer>
}
