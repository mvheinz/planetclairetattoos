import { createHash } from 'node:crypto'

// Feste Inline-Skripte der öffentlichen Seiten (ARCHITEKTUR §8.1, DESIGN §11.7). Der Text ist unveränderlich; die CSP
// (`src/lib/security/csp.ts`) erlaubt ihn über seinen `sha256`-Hash – in `dynamic`/`checkout` neben der Nonce, weil das
// Skript im gemeinsamen, statisch gerenderten Wurzel-Layout steht und die Nonce dort nicht kennt (ADR 0002). Ohne
// `server-only`, weil `next.config.ts` den Hash über `csp.ts` lädt (Ausnahme in `import-rules.ts`); keine Geheimnisse.

/**
 * Teil 1 – Bewegung: liest vor dem ersten Rendern die gespeicherte Wahl des Schalters „Animationen“ und setzt
 * `html[data-motion]`. Gespeichert wird nur nach Klick (Modul `motion-toggle`, R-130 a); ohne Eintrag bleibt das
 * Attribut weg und die Systemeinstellung gilt. Fehler (Speicher gesperrt) werden geschluckt.
 */
const MOTION_PART =
  "(function(){try{var v=window.localStorage.getItem('pc-motion');if(v==='reduced'||v==='full'){document.documentElement.setAttribute('data-motion',v)}}catch(e){}})();"

/**
 * Teil 2 – Schriften-Tor (DESIGN §4.1, Tempo-Budget R01, P2.20): setzt `html[data-fonts="wait"]`, damit das erste Bild
 * mit den metrisch angeglichenen Ersatzschriften steht (`global.css`). Zwei Frames später fordert es Mansalva/Bricolage/
 * Plex Mono per `document.fonts.load` an und nimmt das Attribut erst weg, wenn alle drei da sind (spätestens nach 2 s,
 * dann wie bisher `font-display: swap`). So tauscht die Seite die Schriften in **einem** Durchgang (Stil + Layout) statt
 * erst beim Öffnen des Tors und danach je ankommender Schrift erneut – jeder Durchgang ist eine lange Aufgabe im
 * Hauptthread (TBT, ARCHITEKTUR §7.7). Ohne Font-Loading-API öffnet das Tor sofort nach den zwei Frames. Kein Tor bei
 * einem Aufruf von derselben Website (Schriften liegen dann im Cache), ohne `requestAnimationFrame` und ohne JavaScript.
 * Liest und schreibt keinen Speicher. Familiennamen wie `src/styles/fonts.ts` (Unit-Test prüft die Übereinstimmung).
 */
const FONT_GATE_PART =
  "(function(){var w=window,d=document,h=d.documentElement;try{var r=d.referrer,o=w.location.origin;if(r&&(r===o||r.indexOf(o+'/')===0))return}catch(e){}if(typeof w.requestAnimationFrame!=='function')return;h.setAttribute('data-fonts','wait');var done=false,off=function(){if(!done){done=true;h.removeAttribute('data-fonts')}},go=function(){var f=d.fonts;if(!f||typeof f.load!=='function'||typeof Promise!=='function'){off();return}try{Promise.all([f.load('1em mansalva'),f.load('1em bricolage'),f.load('1em plexMono')]).then(off,off)}catch(e){off()}};w.requestAnimationFrame(function(){w.requestAnimationFrame(function(){w.setTimeout(go,0)})});w.setTimeout(off,2000)})();"

/** `pc-motion`: festes Inline-Skript im `<head>` aus beiden Teilen (ein Hash für die CSP). */
export const MOTION_SCRIPT = MOTION_PART + FONT_GATE_PART

/** CSP-Quelle `'sha256-…'` eines Inline-Skripts (Base64 des SHA-256 über den exakten Text). */
export function scriptHash(script: string): string {
  return `'sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}'`
}

/** Hash des Skripts `pc-motion` für `script-src` im Kontext `public` (ARCHITEKTUR §8.1). */
export const MOTION_SCRIPT_HASH = scriptHash(MOTION_SCRIPT)
