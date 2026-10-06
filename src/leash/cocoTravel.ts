// Coco reist mit (P12.12, U-23, KUNST-QA MO-14): Beim Seitenwechsel läuft Coco sichtbar los, statt stehen zu bleiben.
// Der Übergang selbst (Wandern in `--dur-page`) kommt aus den View Transitions (`coco.css`, ADR 0003); dieses Modul
// ergänzt nur, was CSS nicht kann: im Moment des Aufbruchs von `sitzen` & Co. in den Lauf wechseln (Frame-Reihe
// `rennen`), damit der alte Schnappschuss eine laufende Coco zeigt. Eigener nachgeladener Chunk (Engine-Budget
// §9.10); kein Cookie, kein Storage – der Zustand liegt nur im Speicher der Seite. Nur bei voller Bewegung geladen.
import { matchRoute, splitLocale } from '@/lib/routes/paths'

import type { CocoController } from './coco'
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
 * Macht Coco beim Aufbruch zur Läuferin. Gibt die Abmeldung zurück. Ohne Navigation-API (Firefox, Safari) passiert
 * nichts – der Seitenwechsel läuft dann ohne Lauf-Pose, nur mit Überblendung.
 */
export function attachTravel(coco: CocoController): () => void {
  const nav = (globalThis as { navigation?: NavigationApi }).navigation
  if (!nav) return () => undefined
  let timer: ReturnType<typeof setTimeout> | null = null
  const rest = () => {
    timer = null
    coco.x.b(false)
    coco.x.s(coco.pose())
  }
  const onNavigate = (e: NavigateEvent) => {
    if (e.hashChange || e.downloadRequest !== null || e.navigationType === 'reload') return
    if (new URL(e.destination.url).pathname === location.pathname) return
    if (!transitionTarget(e.destination.url)) return
    coco.x.p?.() // laufende Warte-Aktion abbrechen
    coco.x.s('rennen')
    coco.x.b(true)
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(rest, GIVE_UP_MS)
  }
  nav.addEventListener('navigate', onNavigate)
  return () => {
    nav.removeEventListener('navigate', onNavigate)
    if (timer !== null) clearTimeout(timer)
  }
}
