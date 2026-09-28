// Bilder der Vorschau-Datei (ARCHITEKTUR §14.6): `#pv-assets` hält jedes Bild einmal als Data-URI; beim Einhängen
// einer Seite bekommt jedes `<img data-pv-src="<hash>">` eine Blob-URL (einmal je Hash erzeugt, danach wiederverwendet).
// Kein Netz: `data:` → Blob im Speicher.

export interface AssetStore {
  /** Setzt `src` aller `img[data-pv-src]` unterhalb von `root`. */
  resolve(root: ParentNode): void
  /** Blob-URL zu einem Hash (oder `null`). */
  url(hash: string): string | null
}

export function dataUriToBlob(dataUri: string): Blob {
  const comma = dataUri.indexOf(',')
  const header = dataUri.slice(5, comma)
  const mime = header.split(';')[0] || 'application/octet-stream'
  const payload = dataUri.slice(comma + 1)
  if (header.includes(';base64')) {
    const bin = atob(payload)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  }
  return new Blob([decodeURIComponent(payload)], { type: mime })
}

export function createAssetStore(assets: Record<string, string>): AssetStore {
  const urls = new Map<string, string>()
  const url = (hash: string): string | null => {
    const cached = urls.get(hash)
    if (cached) return cached
    const data = assets[hash]
    if (!data) return null
    const blobUrl = URL.createObjectURL(dataUriToBlob(data))
    urls.set(hash, blobUrl)
    return blobUrl
  }
  return {
    url,
    resolve(root) {
      for (const img of Array.from(root.querySelectorAll<HTMLImageElement>('img[data-pv-src]'))) {
        const src = url(img.getAttribute('data-pv-src') ?? '')
        if (src && img.getAttribute('src') !== src) img.src = src
      }
    },
  }
}
