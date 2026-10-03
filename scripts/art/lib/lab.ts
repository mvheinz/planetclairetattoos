// Farbmaße für SC-16 (KUNST-QA §4.3, §5.9 IM-01/IM-02): sRGB → CIELAB (D65) und Kennzahlen eines Bildes. Rein.

const lin = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116)

export function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = lin(r)
  const G = lin(g)
  const B = lin(b)
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

export function quantile(values: readonly number[], q: number): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]!
}

export interface ImageLook {
  /** Median-L* des mittleren 60 %-Bereichs. */
  medianL: number | null
  /** Mittleres a* und b* heller, unbunter Pixel („Papier“: L* ≥ 75, Chroma < 12), sonst null. */
  paperA: number | null
  paperB: number | null
  /** Anteil Pixel mit L* ≥ 99 bzw. ≤ 1 (Clipping). */
  clipped: number
}

/** Kennzahlen aus RGB(A)-Rohdaten. */
export function imageLook(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
): ImageLook {
  const ls: number[] = []
  let pa = 0
  let pb = 0
  let pn = 0
  let clip = 0
  const x0 = Math.floor(width * 0.2)
  const x1 = Math.ceil(width * 0.8)
  const y0 = Math.floor(height * 0.2)
  const y1 = Math.ceil(height * 0.8)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      const [L, a, b] = srgbToLab(data[i]!, data[i + 1]!, data[i + 2]!)
      if (x >= x0 && x < x1 && y >= y0 && y < y1) ls.push(L)
      if (L >= 75 && Math.hypot(a, b) < 12) {
        pa += a
        pb += b
        pn++
      }
      if (L >= 99 || L <= 1) clip++
    }
  return {
    medianL: median(ls),
    paperA: pn > 0 ? pa / pn : null,
    paperB: pn > 0 ? pb / pn : null,
    clipped: clip / Math.max(1, width * height),
  }
}
