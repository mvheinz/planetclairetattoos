import type { InspectableLeashHandle } from './runtime'

// Test-Schnittstelle `window.__leash` (DESIGN §9.13) – Grundumfang aus P2.16 für die E2E-Tests der Laufzeit
// (`geometry`, `drawnLen()`, `cocoLen()`, `tier()`, `rebuildCount()`). P2.17 ergänzt `pose()`, `setReadingY(y)`,
// `window.__qa` und die Prüfung `check:no-debug`. Wird nur bei `NEXT_PUBLIC_LEASH_DEBUG=1` geladen
// (Bedingung in `src/components/leash/LeashLayer.tsx`); ohne das Flag entfernt der Build den Import.

export interface LeashDebugApi {
  readonly geometry: ReturnType<InspectableLeashHandle['inspect']>['geometry']
  preset(): string
  drawnLen(): number
  cocoLen(): number
  tier(): 'A' | 'B' | 'C'
  rebuildCount(): number
}

type DebugWindow = Window & { __leash?: LeashDebugApi }

export function exposeLeashDebug(handle: InspectableLeashHandle, win: Window = window): () => void {
  const api: LeashDebugApi = {
    get geometry() {
      return handle.inspect().geometry
    },
    preset: () => handle.inspect().preset,
    drawnLen: () => handle.inspect().drawnLen,
    cocoLen: () => handle.inspect().cocoLen,
    tier: () => handle.inspect().tier,
    rebuildCount: () => handle.inspect().rebuildCount,
  }
  const w = win as DebugWindow
  w.__leash = api
  return () => {
    if (w.__leash === api) delete w.__leash
  }
}
