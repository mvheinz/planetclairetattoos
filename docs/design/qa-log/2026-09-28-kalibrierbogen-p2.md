# Kalibrierbogen P2-Platzhalter (2026-09-28)

> Eintrag laut PLAN P2.29 · Grundlage KUNST-QA §3.1 („Kalibrierbogen“), §8 (Ablage) · erzeugt in P2.18 (Commit `e54689c`)

| Feld | Wert |
|---|---|
| Datei | [`img/calibration-p2-placeholder.webp`](img/calibration-p2-placeholder.webp) |
| Quelle | Coco-Platzhalter-Sprite `v1` (`public/art/coco-sprite.v1.svg`, P2.18) – alle 22 Symbole (6 Posen × 3 Frames + 4 Brücken) |
| Größenklassen | seit P9.2: 72 und 180 px (PLAN P9.2, KUNST-QA §3.1), je mit zugehörigem `data-size`-Strich; P2-Fassung hatte alle 7 Größen (die zeigt jetzt `/de/qa/coco`, SC-12) |
| Erzeugt mit | `pnpm art:calibration` (`scripts/art/calibration-sheet.ts`, Chromium-Screenshot 1600 px breit → WebP q82) |
| Maße, Größe | P9.2: 1360 × 1125 px, 137 KB (WebP q90, ≤ 150 KB laut KUNST-QA §8); P2: 1600 × 2517 px, 240 KB |
| Zweck | Bezugsbild für die Kunst-QA in P9: Linse R1 vergleicht die gezeichneten Coco-Frames mit dem Platzhalter (Proportionen, Strichstärken je Größe, Anker); das Bündel kopiert ihn nach `sheets/art/calibration-p2-placeholder.webp` |
| Ergebnis | liegt vor (P2-Abnahme „Kalibrierbogen liegt vor“); keine Bewertung – bewertet wird erst in P9 |

## Anmerkungen

- **Größe über dem Ablagebudget:** KUNST-QA §8 nennt ≤ 150 KB für diese Datei; sie hat 240 KB. Ein erneutes Verlustkodieren
  der vorhandenen Datei brächte nur ~160 KB und verschlechterte die Striche. P9.2 erstellt den Bogen
  ohnehin vom selben Sprite `v1` (dort nur 72 und 180 px) und hält dabei das Budget ein – vermerkt in
  `docs/OFFENE-PUNKTE.md`.
- Der Bogen stammt nachweislich vom Sprite `v1` (Commit oben); spätere Sprite-Fassungen ändern ihn nicht.

## P9.2 – Neuerzeugung (2026-10-03)

- Erzeugt vor jeder Zeichenarbeit in P9 mit `pnpm art:calibration` vom **unveränderten Sprite `v1`**: `public/art/coco-sprite.v1.svg`
  ist seit P2.18 (Commit `e54689c`) nicht geändert worden (`git log -- public/art/coco-sprite.v1.svg` zeigt nur diesen Commit);
  der Bogen trägt die Kennung „Sprite v1“ im Titel. Damit stammt er nachweislich vom Sprite vor P9.9.
- Budget eingehalten (137 KB ≤ 150 KB); der Punkt „Größe über dem Ablagebudget“ ist erledigt.
