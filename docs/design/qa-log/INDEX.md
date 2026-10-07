# Kunst-QA-Protokoll – Übersicht

Ablage laut KUNST-QA §8: je Iteration eine Datei `YYYY-MM-DD-iter-NN.md` (ab P9), Bilder unter `img/`.

## Kalibrierung

| Datum | Eintrag | Commit | Datei |
|---|---|---|---|
| 2026-09-28 | [Kalibrierbogen P2-Platzhalter](2026-09-28-kalibrierbogen-p2.md) | `e54689c` | `img/calibration-p2-placeholder.webp` |

## Basis-Lauf (P9.4)

| Datum | Eintrag | Commit | Lauf |
|---|---|---|---|
| 2026-10-03 | [Basis-Lauf Aufnahme + Tempo-Messung SC-18](2026-10-03-basislauf-sc18.md) | `2991a2b` | `20261003-iter11-2991a2b` (lokal) |
| 2026-10-04 | [Vollständige Aufnahme, `art:check` 62/62 grün (P9.17)](2026-10-04-p9-17-tempo.md) | `9953802` | `20261004-iter39-9953802` (lokal) |

## Iterationen (ab P9)

| Datum | Iteration | Commit | R1 | R2 | R3 | Link |
|---|---|---|---|---|---|---|
| 2026-10-04 | 01 | `d46596a` | FAIL | FAIL | FAIL | [Iteration 01](2026-10-04-iter-01.md) (Lauf `20261004-iter45-d46596a`, lokal; `art:check` 59/62 – Fremdlast) |
| 2026-10-04 | 02 | `fdc1de8` | FAIL | FAIL | FAIL | [Iteration 02](2026-10-04-iter-02.md) (Lauf `20261004-iter48-fdc1de8`, lokal; `art:check` 59/62 – Fremdlast/Wackler; PF-04 behoben) |
| 2026-10-04 | 03 | `fbe1a57` | FAIL | FAIL | FAIL | [Iteration 03](2026-10-04-iter-03.md) (Lauf `20261004-iter52-fbe1a57`, lokal, ruhiger Rechner; `art:check` 59/62 – PF-02 R01 echt, PF-03/PF-04 Desktop-Ausreißer) |
| 2026-10-04 | 04 | `e18bc40` | FAIL | FAIL | FAIL | [Iteration 04](2026-10-04-iter-04.md) (Lauf `20261004-iter53-e18bc40`, lokal; `art:check` 62/62; Noten LQ-08 4, AR-05 4, MO-12 4, IM-04 3; PF-02 R01 behoben) |
| 2026-10-05 | 05 | `9a30c4d` | FAIL | FAIL | FAIL | [Iteration 05](2026-10-05-iter-05.md) (Lauf `20261005-iter05-9a30c4d`, lokal; `art:check` 62/62; Noten LQ-08 3, AR-05 4, MO-12 4, IM-04 3; LG-01/LG-04 Hundekante bestätigt) |
| 2026-10-05 | 06 | `987edc6` | FAIL | FAIL | PASS | [Iteration 06](2026-10-05-iter-06.md) (Lauf `20261005-iter06-987edc6`, lokal; `art:check` 62/62; Noten LQ-08 3, AR-05 3, MO-12 3, IM-04 3) |
| 2026-10-05 | 07 | `633a034` | FAIL | FAIL | FAIL | [Iteration 07](2026-10-05-iter-07.md) (Lauf `20261005-iter07-633a034`, lokal; `art:check` 62/62; MO-14 misst echte Übergänge; Noten LQ-08 3, AR-05 3, MO-12 4, IM-04 3) |
| 2026-10-05 | 08 | `2738e82` | FAIL | FAIL | FAIL | [Iteration 08](2026-10-05-iter-08.md) (Lauf `20261005-iter08-2738e82`, lokal, frischer Build; `art:check` 62/62; Noten LQ-08 4, AR-05 3, MO-12 3, IM-04 4; R3-Blocker war Aufnahme-Artefakt) |
| 2026-10-05 | 09 | `0a61d00` | FAIL | FAIL | PASS | [Iteration 09](2026-10-05-iter-09.md) (Lauf `20261005-iter09-0a61d00`, lokal; `art:check` 62/62; **Fall b**, Kunst-QA offen: AR-05 3, MO-11, MO-12 3, MO-14) |

## P12 (Überarbeitung)

| Datum | Eintrag | Commit | Lauf |
|---|---|---|---|
| 2026-10-07 | [P12 – `art:check` 62/62, Tempo-Gates grün, Linsen offen (Fall b)](2026-10-07-p12.md) | `1d2e383` | `20261007-iter01-1d2e383` (CI) |
| 2026-10-07 | [Redaktionelle Prüfung der Texte (P12.10)](text-review-p12.md) | `085cfc6` | – |
