// Katalog der Mikro-Interaktionen für `/qa/motion` und SC-14 (DESIGN §11.5, KUNST-QA §3.2/§4.3). `clock`: Ablauf hängt
// an rAF/Timern (Aufnahme per Playwright-Clock), sonst WAAPI/CSS (Aufnahme per Seek über `getAnimations()`). `viewport`:
// Aufnahme des ganzen Sichtbereichs statt nur der Bühne (Menü, Kauf-Leiste, Seitenübergang). `press`: Auslöser ist
// ein gedrückter Zeiger (`:active`), den nur die Aufnahme erzeugen kann (MI-17/MI-18 analog `hover`).

export interface QaMicro {
  id: `MI-${string}`
  name: string
  /** längster Ablauf in ms (Ende der Seek-Sequenz). */
  durationMs: number
  clock?: true
  viewport?: true
  press?: true
  /** Auslöser ist ein schwebender Zeiger (`:hover`), den nur die Aufnahme erzeugen kann. */
  hover?: true
}

export const QA_MICROS: readonly QaMicro[] = [
  { id: 'MI-01', name: 'Hüpfer „In den Korb“', durationMs: 600 },
  { id: 'MI-02', name: 'Preisschild schwingt', durationMs: 1500, clock: true },
  { id: 'MI-03', name: 'Stempel-Knall', durationMs: 400 },
  { id: 'MI-04', name: 'Seitenübergang', durationMs: 400, viewport: true },
  { id: 'MI-05', name: 'Menü öffnen', durationMs: 800, viewport: true },
  { id: 'MI-06', name: 'Unterstreichung zeichnen', durationMs: 320 },
  { id: 'MI-07', name: 'Korbzahl hüpft', durationMs: 280 },
  { id: 'MI-08', name: 'Countdown', durationMs: 2000, clock: true },
  { id: 'MI-09', name: 'Danke: Einrollen + Herz', durationMs: 5000, clock: true },
  { id: 'MI-10', name: 'Coco rennt herein', durationMs: 1600, clock: true },
  { id: 'MI-11', name: 'Lose Leine / Weglaufen (404)', durationMs: 5000, clock: true },
  { id: 'MI-12', name: 'Stationsmarke „pop“', durationMs: 450 },
  { id: 'MI-13', name: 'Stationszeichnung zieht ein', durationMs: 750 },
  { id: 'MI-14', name: 'Stencil-Abdruck', durationMs: 450 },
  { id: 'MI-15', name: 'Kauf-Leiste', durationMs: 250, viewport: true },
  { id: 'MI-16', name: 'Knopf drücken', durationMs: 120, press: true },
  { id: 'MI-17', name: 'Karte hebt sich', durationMs: 260, hover: true },
  { id: 'MI-18', name: 'Menülink rückt ein', durationMs: 260, hover: true },
  { id: 'MI-19', name: 'Korb-Bestätigung gleitet ein', durationMs: 260 },
]

export const qaMicro = (id: string | undefined): QaMicro | null =>
  QA_MICROS.find((m) => m.id === id) ?? null
