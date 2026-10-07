// Coco reist mit (P12.12, U-23, KUNST-QA MO-14): Beim Seitenwechsel läuft Coco sichtbar los, statt stehen zu bleiben.
// Der Übergang selbst (Wandern in `--dur-page`) kommt aus den View Transitions (`coco.css`, ADR 0003); dieses Modul
// ergänzt nur, was CSS nicht kann: im Moment des Aufbruchs von `sitzen` & Co. in den Lauf wechseln (Frame-Reihe
// `rennen`), damit der alte Schnappschuss eine laufende Coco zeigt. Eigener nachgeladener Chunk (Engine-Budget
// §9.10); kein Cookie, kein Storage – der Zustand liegt nur im Speicher der Seite. Nur bei voller Bewegung geladen.
import { matchRoute, splitLocale } from '@/lib/routes/paths'

import type { CocoController } from './coco'
import type { SpritePose } from './types'
import { viewTransitionAllowed } from './presets'

/** Wie lange der Lauf-Zustand höchstens hält, falls der Seitenwechsel doch nicht stattfindet (Abbruch, Download). */
const GIVE_UP_MS = 1500

interface NavigateEvent extends Event {
  destination: { url: string }
  hashChange: boolean
  downloadRequest: string | null
  navigationType: 'push' | 'replace' | 'traverse' | 'reload'
}
interface NavigationApi {
  addEventListener(type: 'navigate', cb: (e: NavigateEvent) => void): void
  removeEventListener(type: 'navigate', cb: (e: NavigateEvent) => void): void
}

/** Ob die Adresse zu einer Registry-Route gehört, die Seitenübergänge erlaubt (nie `calm`, Ruheseiten). */
export function transitionTarget(url: string, origin = location.origin): boolean {
  try {
    const u = new URL(url, origin)
    if (u.origin !== origin) return false
    const loc = splitLocale(u.pathname)
    const match = loc ? matchRoute(loc.rest, loc.locale) : null
    const preset = match?.route.preset
    return preset != null && viewTransitionAllowed(preset)
  } catch {
    return false
  }
}

/**
 * Macht Coco beim Aufbruch zur Läuferin. Gibt die Abmeldung zurück. Ohne Navigation-API (Firefox, Safari) gilt nur der
 * Klick auf einen Link; andere Wege (Adressleiste) laufen ohne Lauf-Pose, nur mit Überblendung.
 */
export function attachTravel(coco: CocoController): () => void {
  const nav = (globalThis as { navigation?: NavigationApi }).navigation
  let timer: ReturnType<typeof setTimeout> | null = null
  let before: SpritePose | null = null
  /** Zurück in den Normalbetrieb (Seitenwechsel blieb aus) in der vorherigen Pose. */
  const rest = () => {
    timer = null
    coco.x.b(false)
    coco.setMotion('full')
    if (before) coco.setPose(before)
    before = null
  }
  const run = () => {
    coco.x.p?.() // laufende Warte-Aktion abbrechen
    before ??= coco.pose()
    // „Reduziert“ räumt Brücken und Timer ab und hält die Pose fest: eine laufende Brücke überschreibt `rennen` nicht mehr
    // (CI-Fund „bridge-bremsen“); das Boil läuft über den eigenen Haken weiter.
    coco.setMotion('reduced', 'rennen')
    coco.x.b(true)
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(rest, GIVE_UP_MS)
  }
  const onNavigate = (e: NavigateEvent) => {
    if (e.hashChange || e.downloadRequest !== null || e.navigationType === 'reload') return
    if (new URL(e.destination.url).pathname === location.pathname) return
    if (transitionTarget(e.destination.url)) run()
  }
  // Weiche Navigation: Der App Router startet den Übergang vor `navigate` (Verlauf wird erst beim Einsetzen geschrieben) –
  // der alte Schnappschuss entsteht also schon vorher. Deshalb zusätzlich beim Klick (Erfassungsphase, vor React).
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
    if (a.pathname === location.pathname || a.hash) return
    if (transitionTarget(a.href)) run()
  }
  coco.el.setAttribute('data-travel-ready', '') // Hinweis für Tests und QA: Reise-Modul ist angehängt
  nav?.addEventListener('navigate', onNavigate)
  document.addEventListener('click', onClick, true)
  return () => {
    nav?.removeEventListener('navigate', onNavigate)
    document.removeEventListener('click', onClick, true)
    if (timer !== null) clearTimeout(timer)
    coco.el.removeAttribute('data-travel-ready')
  }
}
