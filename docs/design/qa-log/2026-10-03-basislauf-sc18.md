# Basis-Lauf der Aufnahme und Tempo-Messung (2026-10-03, vor Iteration 01)

> Eintrag laut PLAN P9.4 („ein Basis-Lauf ist als Kennzahl im ersten qa-log-Eintrag vermerkt“) · KUNST-QA §4, §4.6, §5.6 ·
> noch keine Review-Iteration (die beginnt mit P9.6); Grundlage zum Vergleich späterer Iterationen.

| Feld | Wert |
|---|---|
| Lauf-ID | `20261003-iter11-2991a2b` (lokal, `artifacts/art-qa/…`, nicht committet) |
| Commit | `2991a2b` (Stand P9.1–P9.3, Coco-Sprite `v1`, Stationszeichnungen v1) |
| Umfang | SC-00 … SC-18 vollständig: 81 Bild-Tests (3 Profile × motion/reduced laut KUNST-QA §4.3) + SC-18; 81 Videos, 3 968 Frames, 335 MB |
| Dauer | 24,0 min (Bild-Läufe 15,7 min auf 2 Workern, Tempo-Lauf 8,1 min allein) |
| Browser | Chromium 1194 (Playwright 1.58.2), WebKit 2248 (echtes WebKit für `art-iphone15`, keine Emulation) |
| Fremd-Hosts | 0 Anfragen (jede wäre ein Testfehler) |

## Kennzahlen SC-18 (Pixel 7, CPU 4×, headless ohne GPU; Median aus 3 Läufen, „mit / ohne“ Engine)

| Größe | R01 | R02 | R04 | R07 | Grenze |
|---|---|---|---|---|---|
| p95 rAF-Intervall (ms) | 16,7 / 16,8 | 16,7 / 16,8 | 16,7 / 16,7 | 16,7 / 16,8 | Δ ≤ 3 (PF-02) |
| Anteil Frames > 33,4 ms | 0,14 % / 0,28 % | 0,28 % / 0,28 % | 0,25 % / 0,25 % | 0,14 % / 0,14 % | Δ ≤ 3 pp |
| LoAF > 50 ms aus leash/coco/micro | 0 | 0 | 0 | 0 | 0 (PF-01) |
| `leash:frame` p95 (ms) | 1,2 | 1,3 | 0,6 | – (calm, statisch) | ≤ 6 (PF-03) |
| `leash:build` max. (ms) | **75,4** | **88,0** | 27,1 | – | ≤ 50 bei 4× (PF-04) |
| `Layout` im Trace (5 s Scrollen) | **26** | **4** | **15** | **11** | ≤ 3 (PF-05) |
| CLS mit / ohne | 0 / 0 | 0 / 0 | 0,014 / 0,014 | 0 / 0 | mit ≤ ohne (PF-06) |
| LCP (ms) mit / ohne | 268 / 248 | 236 / 280 | 236 / 256 | 304 / 332 | Δ ≤ 100 (PF-07) |
| Event-Timing Menü / „In den Korb“ (ms) | 88 / – | 112 / – | 72 / 24 | 80 / – | ≤ 150 (PF-08) |

Bilder (SC-16, 30 Titelbilder, Größe `card` gegen Original): σ(Median-L*) 16,7 (IM-01 verlangt ≤ 6 – Foto-Look-Pipeline
folgt in P9.14), Median `card` 18 KB, `thumb` 8 KB.

## Abschluss P9.3/P9.4: Wiederholung mit Lastprotokoll (Commit `bb9ffe0`)

Tempo-Messungen sind unter Last unzuverlässig (KUNST-QA §4.1). Seit `bb9ffe0` schreibt jeder Lauf die Rechnerlast mit
(`run.json` → `hostLoadAtStart`, je SC-18-Lauf `host.load1`, in `metrics/perf.json` → `host` mit `reliable` = 1-min-Last nie
über 75 % der Kerne). Grenzwerte unverändert.

| Lauf | Umfang | Dauer | Last (1 min, 4 Kerne) | Ergebnis |
|---|---|---|---|---|
| `20261003-iter12-80582a0` | vollständig | 21,0 + 8,1 min | Bild-Läufe ~10, SC-18 max. 3,56 → **unzuverlässig** | 81 + 1 grün; 3 leere bzw. 18 halb leere Frames (s. u.) |
| `20261003-iter13-bb9ffe0` | vollständig | 26,3 min (17,9 + 8,2 + Start/SC-16) | Start 1,6, SC-18-Start 6,6 (parallele Lighthouse-/E2E-Last), max. 4,11 → unzuverlässig | 81 + 1 grün; 3 968 Frames, 81 Videos, 0 leere Frames |
| `20261003-iter14-bb9ffe0` | SC-18 allein, nach Abklingen der Last | 8,2 min | Start 1,25, max. 2,57 → **zuverlässig** | Kennzahlen unten |

SC-18 bei ruhiger Maschine (`iter14`, Median, mit / ohne Engine): p95 rAF 16,7–16,8 / 16,7–16,8 ms (alle Routen);
Anteil Frames über 33,4 ms R01 0,28 / 0,28 %, R02 0,41 / 0,28 %, R04 0,50 / 0,25 %, R07 0,14 / 0,14 %; LoAF aus leash/coco/micro 0;
`leash:frame` p95 1,5 / 1,2 / 0,7 ms (R01/R02/R04); `leash:build` max. **71,7 / 88,1** / 24,5 ms; `Layout` im Trace
**30 / 7 / 15 / 11**; CLS gleich mit/ohne (R04 0,0138); LCP 276/244, 216/324, 300/268, 336/336 ms; Menü 112/112/88/80 ms,
„In den Korb“ 40 ms. Bild bestätigt den Basis-Lauf: rot nur PF-04 (R01, R02) und PF-05 (alle Routen) – Arbeitspunkte für
P9.11/P9.15. Die Vollaufnahme liegt ohne Fremdlast bei ~24 min (`iter11`), unter Fremdlast knapp darüber (`iter13`).

**Leere Frames (behoben in `bb9ffe0`):** In `art-pixel7` (Chromium-Mobil-Emulation, angehaltene Uhr) waren nach großen
Scroll-Sprüngen Kacheln noch nicht gerastert (SC-00, SC-01 Station-Grenzen, SC-04 `+250 ms`, SC-14 MI-04 `t0`; in `iter11`
ebenso, 13 Frames mit ≥ 20 % leerer Fläche). `ArtSession.frame` erkennt jetzt einen einfarbigen Block ≥ 20 % der Höhe (das
Papier hat ein Raster), wartet in Echtzeit und nimmt bis zu 3× neu auf; Protokoll `raw/<SC>/<profil>/<variante>/retakes.json`.
Übrig bleiben nur die echten einfarbigen Flächen der Zoom-Ansicht (SC-05 `zoom-open`).

## Anmerkungen

- Rot im Basis-Lauf: PF-04 (Aufbau der Linie auf R01/R02 bei 4× in einem Stück > 50 ms) und PF-05 (`Layout`-Ereignisse
  während des Scrollens; gezählt werden alle Layouts im Trace, nicht nur aus der Engine – die Zuordnung zur Engine
  prüft `art:check`, P9.5). Beides sind Arbeitspunkte für P9.11/P9.15, keine Abnahme.
- Absolute Bildraten sind headless ohne GPU nicht aussagekräftig (KUNST-QA §4.6); deshalb sind die Gates relativ zur
  Grundlinie `?leash=off` plus absolute Grenzen nur für Skriptzeit und Long Tasks (`scripts/art/lib/perf.ts`).
