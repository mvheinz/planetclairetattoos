import localFont from 'next/font/local'

// Selbst gehostete Schriften (DESIGN §4.1, E-43, E-79): Dateien aus `pnpm fonts:copy`, nie Google-Fonts-CDN und nie
// den Google-Lader von next/font. `adjustFontFallback` (Standard „Arial“) erzeugt Metrik-Fallbacks gegen CLS; die Fallback-Stapel
// laut DESIGN §4.1 stehen zusätzlich in `tokens.css`. Die CSS-Variablen setzt das Wurzel-Layout auf `<html>`.

export const mansalva = localFont({
  src: './fonts/mansalva-latin-400-normal.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  preload: true,
  variable: '--font-mansalva',
  fallback: ['Segoe Print', 'Bradley Hand', 'cursive'],
})

export const bricolage = localFont({
  src: './fonts/bricolage-grotesque-latin-wght-normal.woff2',
  weight: '400 700',
  style: 'normal',
  display: 'swap',
  preload: true,
  variable: '--font-bricolage',
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
})

export const plexMono = localFont({
  src: './fonts/ibm-plex-mono-latin-400-normal.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  preload: false,
  variable: '--font-plex-mono',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
})

/** Klassen für `<html>`: setzen `--font-mansalva`, `--font-bricolage`, `--font-plex-mono`. */
export const fontVariables = [mansalva.variable, bricolage.variable, plexMono.variable].join(' ')
