import localFont from 'next/font/local'

// Selbst gehostete Schriften (DESIGN §4.1, E-43, E-79): Dateien aus `pnpm fonts:copy`, nie Google-Fonts-CDN und nie
// den Google-Lader von next/font. Metrik-Fallbacks gegen CLS (DESIGN §4.1 „adjustFontFallback“): die Flächen
// `<name> Fallback` stehen nicht mehr von next/font (`adjustFontFallback: false`), sondern in `global.css` – mit denselben
// Arial-Metriken, aber neben `local(Arial)` auch den metrisch gleichen Arial-Nachbauten Liberation Sans/Arimo. Grund: Fehlt
// Arial (Linux, auch der Lighthouse-Rechner), ist die Fläche leer und Chrome fragt für jede Familie im Stapel den
// Systemschrift-Dienst synchron ab – ~60 Abfragen, ~15–30 ms im ersten Layout (TBT, ARCHITEKTUR §7.7). Die Fallback-
// Stapel laut DESIGN §4.1 stehen zusätzlich in `tokens.css`. Die CSS-Variablen setzt das Wurzel-Layout auf `<html>`.
// Kein Preload (DESIGN §4.1, P2.20): Die Schriften lädt der Browser erst nach dem ersten Bild (Schriften-Tor
// `html[data-fonts]` in `global.css`, gesetzt vom Inline-Skript `pc-motion`) – sie zählen so nicht zum LCP-Pfad.

/** Überschriften und Anzeige-Schrift (U-10): Spectral 500, ein Schnitt – Anfragen nach 400/600 treffen ihn ohne Synthese. */
export const spectral = localFont({
  src: './fonts/spectral-latin-500-normal.woff2',
  weight: '500',
  style: 'normal',
  display: 'swap',
  preload: false,
  variable: '--font-spectral',
  adjustFontFallback: false,
  fallback: ['spectral Fallback', 'Georgia', 'Times New Roman', 'serif'],
})

/** Akzent-Schrift (U-10): Spectral Italic 500. */
export const spectralItalic = localFont({
  src: './fonts/spectral-latin-500-italic.woff2',
  weight: '500',
  style: 'italic',
  display: 'swap',
  preload: false,
  variable: '--font-spectral-italic',
  adjustFontFallback: false,
  fallback: ['spectralItalic Fallback', 'Georgia', 'Times New Roman', 'serif'],
})

export const bricolage = localFont({
  src: './fonts/bricolage-grotesque-latin-wght-normal.woff2',
  weight: '400 700',
  style: 'normal',
  display: 'swap',
  preload: false,
  variable: '--font-bricolage',
  adjustFontFallback: false,
  fallback: [
    'bricolage Fallback',
    'ui-sans-serif',
    'system-ui',
    '-apple-system',
    'Segoe UI',
    'sans-serif',
  ],
})

export const plexMono = localFont({
  src: './fonts/ibm-plex-mono-latin-400-normal.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  preload: false,
  variable: '--font-plex-mono',
  adjustFontFallback: false,
  fallback: [
    'plexMono Fallback',
    'ui-monospace',
    'SFMono-Regular',
    'Menlo',
    'Consolas',
    'monospace',
  ],
})

/** Klassen für `<html>`: setzen `--font-spectral`, `--font-spectral-italic`, `--font-bricolage`, `--font-plex-mono`. */
export const fontVariables = [
  spectral.variable,
  spectralItalic.variable,
  bricolage.variable,
  plexMono.variable,
].join(' ')
