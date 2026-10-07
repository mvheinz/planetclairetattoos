// Schutz der Privatadresse (E-50): Die Adresse eines Markttermins ist öffentlich gewollt, aber nie die Straße des
// Privatstudios aus den Stammdaten (`settings.business.street`). Rein, ohne Datenbank.

/** Straßenname aus `settings.business.street` (ohne Hausnummer) im Text? Groß/klein und „ß“/„ss“ egal. */
export function containsStreet(text: string, street: string | null | undefined): boolean {
  const norm = (v: string) => v.toLowerCase().replace(/ß/g, 'ss').replace(/\s+/g, ' ').trim()
  const name = norm((street ?? '').replace(/\s*\d+\s*[a-z]?(\s*[-–/]\s*\d+\s*[a-z]?)?\s*$/i, ''))
  if (name.length < 3) return false
  const variants = new Set([
    name,
    name.replace(/strasse\b/, 'str.'),
    name.replace(/str\.$/, 'strasse'),
  ])
  const hay = norm(text)
  return [...variants].some((v) => hay.includes(v))
}

const HTTPS = ['https', '//'].join(':')

/** Normalisierte Web-Adresse eines Marktes: nur `http(s)`, ohne Leerzeichen, höchstens 300 Zeichen; sonst `null`. */
export function parseTourLink(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim()
  if (!raw || raw.length > 300 || /\s/.test(raw)) return null
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `${HTTPS}${raw}`)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!url.hostname.includes('.')) return null
    if (url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}
