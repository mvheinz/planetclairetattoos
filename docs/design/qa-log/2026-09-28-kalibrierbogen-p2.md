# Kalibrierbogen P2-Platzhalter (2026-09-28)

> Eintrag laut PLAN P2.29 · Grundlage KUNST-QA §3.1 („Kalibrierbogen“), §8 (Ablage) · erzeugt in P2.18 (Commit `e54689c`)

| Feld | Wert |
|---|---|
| Datei | [`img/calibration-p2-placeholder.webp`](img/calibration-p2-placeholder.webp) |
| Quelle | Coco-Platzhalter-Sprite `v1` (`public/art/coco-sprite.v1.svg`, P2.18) – alle 22 Symbole (6 Posen × 3 Frames + 4 Brücken) |
| Größenklassen | 24, 40, 42, 64, 72, 180, 240 px (DESIGN §10.5), je mit zugehörigem `data-size`-Strich |
| Erzeugt mit | `pnpm art:calibration` (`scripts/art/calibration-sheet.ts`, Chromium-Screenshot 1600 px breit → WebP q82) |
| Maße, Größe | 1600 × 2517 px, 240 KB |
| Zweck | Bezugsbild für die Kunst-QA in P9: Linse R1 vergleicht die gezeichneten Coco-Frames mit dem Platzhalter (Proportionen, Strichstärken je Größe, Anker); das Bündel kopiert ihn nach `sheets/art/calibration-p2-placeholder.webp` |
| Ergebnis | liegt vor (P2-Abnahme „Kalibrierbogen liegt vor“); keine Bewertung – bewertet wird erst in P9 |

## Anmerkungen

- **Größe über dem Ablagebudget:** KUNST-QA §8 nennt ≤ 150 KB für diese Datei; sie hat 240 KB. Ein erneutes Verlustkodieren
  der vorhandenen Datei brächte nur ~160 KB und verschlechterte die Striche. P9.2 erstellt den Bogen
  ohnehin vom selben Sprite `v1` (dort nur 72 und 180 px) und hält dabei das Budget ein – vermerkt in
  `docs/OFFENE-PUNKTE.md`.
- Der Bogen stammt nachweislich vom Sprite `v1` (Commit oben); spätere Sprite-Fassungen ändern ihn nicht.
