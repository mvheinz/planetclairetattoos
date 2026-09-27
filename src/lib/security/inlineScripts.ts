import { createHash } from 'node:crypto'

// Feste Inline-Skripte der öffentlichen Seiten (ARCHITEKTUR §8.1, DESIGN §11.7). Der Text ist unveränderlich; die CSP
// (`src/lib/security/csp.ts`) erlaubt ihn über seinen `sha256`-Hash – in `dynamic`/`checkout` neben der Nonce, weil das
// Skript im gemeinsamen, statisch gerenderten Wurzel-Layout steht und die Nonce dort nicht kennt (ADR 0002). Ohne
// `server-only`, weil `next.config.ts` den Hash über `csp.ts` lädt (Ausnahme in `import-rules.ts`); keine Geheimnisse.

/**
 * `pc-motion`: liest vor dem ersten Rendern die gespeicherte Wahl des Schalters „Animationen“ und setzt
 * `html[data-motion]`. Gespeichert wird nur nach Klick (Modul `motion-toggle`, R-130 a); ohne Eintrag bleibt das
 * Attribut weg und die Systemeinstellung gilt. Fehler (Speicher gesperrt) werden geschluckt.
 */
export const MOTION_SCRIPT =
  "(function(){try{var v=window.localStorage.getItem('pc-motion');if(v==='reduced'||v==='full'){document.documentElement.setAttribute('data-motion',v)}}catch(e){}})();"

/** CSP-Quelle `'sha256-…'` eines Inline-Skripts (Base64 des SHA-256 über den exakten Text). */
export function scriptHash(script: string): string {
  return `'sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}'`
}

/** Hash des Skripts `pc-motion` für `script-src` im Kontext `public` (ARCHITEKTUR §8.1). */
export const MOTION_SCRIPT_HASH = scriptHash(MOTION_SCRIPT)
