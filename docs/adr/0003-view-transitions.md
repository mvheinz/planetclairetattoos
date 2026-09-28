# ADR 0003 – View Transitions (Spike DESIGN §9.8)

- **Status:** angenommen (28.09.2026, P2.16)
- **Kontext:** DESIGN §9.8 sieht View Transitions als progressive Verbesserung vor: weiche Navigation (App Router) über
  React-`<ViewTransition>` um Seiteninhalt und Coco, harte Navigation (Sprachwechsel, Vorschau-Datei) über
  `@view-transition { navigation: auto; }` – nur unter `prefers-reduced-motion: no-preference`, nie von/zu `calm`-Routen
  (Korb, Kasse, Bestellstatus, Widerruf) und nicht bei `html[data-motion="reduced"]`. Offen war, ob die gepinnten
  Versionen `ViewTransition` anbieten und ob `experimental.viewTransition` nötig ist.
- **Spike (Next.js 16.3.6, React 19.2.6):**
  - Das installierte Paket `react@19.2.6` exportiert `ViewTransition` **nicht** (nur `Activity`). Der App Router nutzt
    aber die mitgelieferte React-Canary-Version (`next/dist/compiled/react`, 19.3.0-canary) – dort ist `ViewTransition`
    exportiert; `import { ViewTransition } from 'react'` funktioniert in App-Router-Komponenten, die Typen kommen aus
    `@types/react/canary` (`/// <reference types="react/canary" />`).
  - `experimental.viewTransition` gibt es in 16.3.6 nicht mehr (nicht im Konfigurations-Schema); laut
    `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` funktionieren View Transitions ohne Konfiguration.
  - Cross-Document-Übergänge (`@view-transition`) laufen nur, wenn **beide** Dokumente zustimmen. Ein Ausschluss
    einzelner Seiten per Selektor ist nicht möglich (At-Regel), wohl aber durch Weglassen der Regel auf diesen Seiten.
- **Entscheidung:**
  1. **Harte Navigation – umgesetzt:** `src/components/leash/ViewTransitionOptIn.tsx` rendert
     `<style media="(prefers-reduced-motion: no-preference)">@media (prefers-reduced-motion: no-preference)
     {@view-transition{navigation:auto}}</style>` nur auf Seiten, deren Preset Übergänge erlaubt
     (`PRESET_CONFIG[preset].viewTransition`, `calm` = `false`). Damit gibt es keine Übergänge hinein in oder heraus aus
     `calm`-Seiten. Bei `html[data-motion="reduced"]` (Schalter „Animationen“) setzt die Komponente `media="not all"`.
     Inline-`<style>` ist mit der CSP vereinbar (`style-src 'self' 'unsafe-inline'`, ARCHITEKTUR §8.1).
  2. **Weiche Navigation – vorbereitet, noch nicht eingeschaltet:** Ohne Coco-Element (P2.18) ergäbe `<ViewTransition>`
     nur eine allgemeine Überblendung; die Namen `coco` und `leash-head` hängen an Elementen, die erst P2.18 baut. Der
     Einbau (`import { ViewTransition } from 'react'` um `<main>` und Coco, Ausschluss von `calm`/reduzierter Bewegung
     über `addTransitionType` bzw. `default="none"`) folgt mit P2.18; bis dahin Seitenwechsel ohne Übergang (erlaubter
     Rückfall laut §9.8 „Sonst ohne Übergang“).
- **Folgen:** Kein neues Paket, kein Konfigurations-Schalter. Test: `tests/e2e/leash.e2e.spec.ts` (Regel auf R01
  vorhanden, auf R26 `calm` nicht). Wieder prüfen, wenn `react` stabil `ViewTransition` exportiert (dann ohne
  Canary-Typen) und in P9 (KUNST-QA: Coco-Übergang 350 ms `--ease-ink-inout`).

## Nachtrag P2.18 (28.09.2026) – Punkt 2 umgesetzt

- **Weiche Navigation:** `src/components/leash/PageTransition.tsx` legt `<ViewTransition default="pc-page">` um den
  Seiteninhalt in `<main>` (Überblendung 250 ms, `src/styles/coco.css`); `default="none"`, wenn die alte **oder** die neue
  Seite `calm` ist oder die Bewegung reduziert ist (`useSyncExternalStore` auf `src/leash/motion.ts`). Die Coco an der
  Leinenspitze (`LeashLayer`, Presets `journey`/`about`) steckt in `<ViewTransition name="coco" share="pc-coco"
  default="none">` mit dem Routen-Schlüssel als `key` – alte und neue Coco bilden ein Paar und wandern in `--dur-page`
  (`--ease-ink-inout`). Nachweis: `tests/e2e/coco.e2e.spec.ts` über `window.next.router.push` (R01 → R20: Übergang mit
  `coco` und Seiteninhalt; zu/von R26 und bei `reduce` keiner). Die Seite nutzt bisher nur `<a href>` (harte Navigation);
  weiche Navigation entsteht erst mit `next/link`/Router-Aufrufen späterer Phasen – dann greift diese Hülle ohne Änderung.
- **Harte Navigation:** Das Coco-Element trägt per CSS `view-transition-name: coco` (nur unter
  `prefers-reduced-motion: no-preference` und ohne `html[data-motion="reduced"]`). Es wird serverseitig am Linienanfang
  gerendert (ohne JavaScript per `<noscript>`-Stil ausgeblendet), damit es im Schnappschuss der neuen Seite schon steht.
- **Offen:** `leash-head` (erste 60 px der Linie) ist nicht benannt – die Linie entsteht erst nach LCP + Idle und stünde im
  neuen Schnappschuss nicht; Prüfung in P9 (KUNST-QA).

