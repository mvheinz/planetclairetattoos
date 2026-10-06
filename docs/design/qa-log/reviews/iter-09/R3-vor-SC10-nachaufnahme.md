# Review R3 – Lauf 20261005-iter09-0a61d00
verdict: FAIL
calibration: –
ratings: –

Die Tempo-Werte stammen aus der CI-Messung (`metrics/perf.json`, Pixel 7, 4×). `run.json` zeigt keine übermäßige Last (loadavg 2,64 bei 4 CPUs bei Start). `metrics/desktop.json` meldet 4,83 bei 4 CPUs, daher werte ich die Desktop-Zeiten nur als konservative Obergrenze.

| Punkt | Ergebnis | Beleg |
|---|---|---|
| LG-01 | PASS | check.json/check.md: 1548 Sonden, 0 Überdeckungen (Hundekante). Zusätzlich sichtbar: `SC-17-art-pixel7-motion.webp`, Coco sitzt bei Station 01/03/05/07 neben der Überschrift, ohne den Text zu berühren. |
| LG-02 | PASS | check.json: 131 Messungen. „Vertrag widerrufen“ sichtbar in `SC-10-art-pixel7-reduced.webp` r28-home-t0000. |
| LG-03 | PASS | check.json: 68622 Mansalva-Elemente, 0 Verstöße. |
| LG-04 | PASS | check.json: 6 Sonden. |
| LG-05 | PASS | `SC-17-art-pixel7-motion.webp`: bei hallo-y465, keramik-y1212, textil-y2485, zeichnungen-y3963, schmuck-y5339 und jutta-und-coco-y7814 sind H2 und Text vollständig sichtbar, Coco ist an der Linie. Geprüft nur an diesen Frames. |
| PF-01 | PASS | perf.json: `loafEngine` 0 in R01/R02/R04/R07 (die 2 LoAF > 50 ms treten auch ohne Engine auf, ohne Zuordnung zu leash/coco/micro). |
| PF-02 | PASS | check.md: Differenzen R01a −0,1 … R07b 0,001. perf.json: rafP95 16,7 (Engine) gegen 16,8 (aus). |
| PF-03 | PASS | perf.json: `leashFrameP95` R01 2,4 / R02 1,6 / R04 1,1 ms bei 4×. `desktop.json`: frameP95 0,5 ms. |
| PF-04 | PASS | `desktop.json`: buildMax 3,5 ms (≤ 8). Bei 4× max. 7,9 / 11,1 / 8,2 ms, kein Teilstück > 50 ms. |
| PF-05 | PASS | perf.json: `layoutEventsWhileScrolling` 0 in R01/R02/R04. |
| PF-06 | PASS | perf.json: Engine-CLS 0 in R01/R02/R07. R04 hat 0,0138 mit 2 Quellen, aber identisch ohne Engine (0,0138 / 2 Quellen) – kein Engine-Beitrag. |
| PF-07 | PASS | check.md: Engine minus Grundlinie R01 64 / R02 24 / R04 12 / R07 −20 ms. |
| PF-08 | PASS | perf.json: menuEventMs 120 / 120 / 88 / 96 ms, addEventMs 24 ms. |
| PF-09 | PASS | check.md: Engine 11995 B (≤ 12 KB), Coco 2691 B, Mikro max. 3992 B, statischer Renderer 2262 B. Schwellen unverändert. Reserve siehe R3-09-02. |
| PF-10 | PASS | check.md: Sprite 44918 / 10659 B, Startseite 58796 B, Pfade max. 45291 B. |
| PF-11 | PASS | check.md: 0 Frames bei verborgenem Tab. |
| PF-12 | PASS | check.md: Stufe A → B. |
| A11Y-01 | FAIL | `SC-10-art-{desktop,iphone15,pixel7}-reduced.webp`, Label r29-error: t0000 zeigt den Fußbereich (Rechtliches, Vertrag widerrufen) ohne Linie, t2000/t4000/t6000 zeigen die Fehlerseite „Hoppla“ mit Linie. t0 und t2 s sind damit nicht pixelgleich. check.json meldet dagegen PASS (684 Sonden, 3 Zeitvergleiche). Siehe R3-09-01. |
| A11Y-02 | PASS | check.json: 3 Profile, vor dem Klick 0 Speicher-Einträge. |
| A11Y-03 | PASS | check.json: 2031 Sonden, Tab-Reihenfolge mit/ohne Engine identisch. |
| A11Y-04 | PASS | check.json: 108 axe-Prüfungen, 0 serious/critical. |
| A11Y-05 | PASS | `SC-17-art-pixel7-reduced.webp` und `-motion.webp`: Linie schwarz (CanvasText), Links/Preise in Systemfarbe, Planet-Marke bei planet-claire als Umriss ohne Füllung. Kein Wash oder Fell. Keine Fläche verdeckt Text. check.json: 18 Sonden. |
| A11Y-06 | PASS | check.json: 116 Sonden. In `SC-09-art-*-reduced.webp` sind die Ruhe-Routen still. |
| A11Y-07 | PASS | check.json: 205 Fokus-Sonden. |
| CT-01 | PASS | check.json: 14 passed (14). |
| CT-02 | PASS | check.json: axe 108 Prüfungen, Pixel min. 4,7:1 (82 Zeilen). |
| CT-03 | PASS | check.json: 1003 Messungen, min. 3,94:1 (Stempel ≥ 3:1). |

## Befunde
| ID | Punkt | Objekt | Schwere | Befund | Beleg | Vorschlag |
|---|---|---|---|---|---|---|
| R3-09-01 | A11Y-01 | SC-10 reduziert, Route r29-error, alle Profile | B | Der t0000-Frame zeigt nicht die Fehlerseite, sondern den Fußbereich der Vorseite (r28-home), ohne Linie. Erst bei t2000 steht die Fehlerseite mit Linie. t0 ≠ t2 s, das Muster von R3-08-01 besteht an dieser Route weiter. Ob die Aufnahme oder die Seite die Ursache ist (Scrollposition der Vorroute wird übernommen, Frame vor Routenwechsel), lässt sich aus den Bögen nicht trennen. Wenn es die Seite ist, wäre es ein echter Barrierefreiheitsfehler. | `SC-10-art-desktop-reduced.webp`, `SC-10-art-iphone15-reduced.webp`, `SC-10-art-pixel7-reduced.webp`: r29-error-t0000 gegen r29-error-t2000 | Aufnahme erst nach Routenwechsel, Scroll-Reset und eingehängter Engine starten. A11Y-01 zusätzlich per Pixelvergleich t0/t2 s auch für r29-error prüfen. Falls die Seite die Ursache ist, Scrollposition beim Routenwechsel zurücksetzen. |
| R3-09-02 | PF-09/PF-10 | Chunk- und SVG-Budgets | m | Die Budgets sind nicht gelockert, die Reserve ist aber praktisch null. Engine 11995 B gegen 12000 B (bei 1 KB = 1000 B) bzw. 12288 B (bei 1 KB = 1024 B). Sprite 44918 B roh gegen 45000 B. Startseite 58796 B gegen 60000 B. Jede kleine Änderung reißt das Budget. | check.md PF-09, PF-10 | Engine-Chunk um etwa 5–10 % verschlanken, damit weitere Iterationen nicht daran scheitern. |

## Nachprüfliste
| Vor-Befund | bestätigt behoben? | Beleg |
|---|---|---|
| R3-08-01 (A11Y-01, B) | teilweise: SC-09 und SC-10 sind behoben, r29-error nicht (neuer Befund R3-09-01) | In `SC-09-art-{desktop,iphone15,pixel7}-reduced.webp` steht die Linie bei paid-t0000 sofort und gleich wie t2000/t4000/t6000. In `SC-10-art-*-reduced.webp` steht sie bei r28-lost-t0000 und r28-home-t0000 sofort, und diese Frames sind gleich wie t2000. Nicht behoben ist r29-error-t0000 (Fußbereich statt Fehlerseite, ohne Linie). |
| R3-08-02 (PF-09/PF-10, m) | Budgets nicht gelockert: ja. Reserve: nein (als R3-09-02 offen) | check.md PF-09: Engine 11995 B (≤ 12 KB), PF-10: Sprite 44918 B (≤ 45 KB), Startseite 58796 B (≤ 60 KB), Schwellen unverändert. |
| R3-08-03 (A11Y-05, m) | ja | `SC-17-art-pixel7-reduced.webp` (forced-colors-planet-claire-y18) und `-motion.webp` (forced-colors-planet-claire-y181): Planet-Marke als reiner Umriss, keine Füllfläche. check.json: A11Y-05 mit 18 Sonden PASS. |

Offen sind 1 Blocker (R3-09-01) und 1 Minor (R3-09-02), deshalb FAIL.
