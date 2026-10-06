# KUNST-QA – Studio-Abnahme für Zeichnungen und Animationen (P9)

> **Stand:** 26.09.2026 · **Version:** 1.1 (P0, an ARCHITEKTUR angeglichen; Abgleich der P0-Dokumente vom 26.09.2026) · **Status:** verbindlich für P9 „Kunst & Bewegung“ (E-80), Stichproben in P10
> **Grundlage:** `docs/ENTSCHEIDUNGEN.md` (E-70…E-80), `docs/design/DESIGN.md` (Maße, Tokens, Posen, Presets, Komponenten KO-xx,
> Katalog MI-xx), `docs/KONZEPT.md` (EK-01 Tempo, EK-07 Barrierefreiheit, EK-12 Kunst-Qualität), Referenzbilder
> `content/seed/instagram/`. Skriptnamen, Ordner, Umgebungsvariablen, Playwright-Projekte und CI-Workflows: `docs/ARCHITEKTUR.md`
> (§2.1, §5.2, §6, §7.3).
> **Wunsch der Inhaberin (E-80):** Bilder und Animationen besonders hochwertig – Videoaufnahmen, mehrere unabhängige
> Prüf-Durchgänge, nachbessern, bis alle zustimmen, ohne die Tempo-Ziele zu reißen.

---

## Inhalt

0. [Zweck, Geltung, Fertig-Definition](#0-zweck-geltung-fertig-definition)
1. [Rollen und Ablauf auf einen Blick](#1-rollen-und-ablauf-auf-einen-blick)
2. [Prüfinventar](#2-prüfinventar)
3. [Werkzeuge und QA-Modus](#3-werkzeuge-und-qa-modus)
4. [Aufnahmeverfahren](#4-aufnahmeverfahren)
5. [Abnahmekriterien (Checkliste)](#5-abnahmekriterien-checkliste)
6. [Review-Schleife mit drei unabhängigen Linsen](#6-review-schleife-mit-drei-unabhängigen-linsen)
7. [Iterationsprotokoll](#7-iterationsprotokoll)
8. [Artefakte: Repo oder CI](#8-artefakte-repo-oder-ci)
9. [CI-Einbindung](#9-ci-einbindung)
10. [Abschluss P9 und Übergabe](#10-abschluss-p9-und-übergabe)

---

## 0. Zweck, Geltung, Fertig-Definition

**Zweck:** Ein wiederholbares Verfahren, mit dem ein autonomer Agent ohne Rückfrage an Jutta nachweist, dass Zeichnungen,
Coco und alle Animationen (a) nach Juttas Strich aussehen, (b) im Timing handgemacht wirken, (c) lesbar, barrierearm und
(d) schnell sind.

**Gilt für:** alles aus DESIGN §9 (Tuschelinie), §10 (Coco), §11 (Bewegung), §12.3–12.6 (Platzhalter, Stationszeichnungen,
Weltraum-Motive, Wortmarke/Icons) und den Foto-Look aus §12.2 Schritte 4–6.

**P9 ist fertig, wenn:**

1. Alle automatischen Prüfungen (§5, Spalte „Methode = auto“) in einer **vollständigen** Aufnahme grün sind.
2. Drei unabhängige Prüf-Durchgänge (Linsen R1, R2, R3, §6) auf **demselben Commit** und **demselben Artefakt-Bündel**
   jeweils **PASS** melden.
3. KONZEPT EK-01 (LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms) und EK-07 (axe) weiterhin grün sind.
4. Das Iterationsprotokoll mit dem PASS-Durchgang in `docs/design/qa-log/` liegt und das End-Bündel als CI-Artefakt
   hochgeladen ist (§8).

Ausnahme: Greift eine Obergrenze aus §6.6 Nr. 6, endet P9 mit dem dort beschriebenen Vermerk statt mit PASS.

---

## 1. Rollen und Ablauf auf einen Blick

| Rolle | Wer | Aufgabe | Sieht |
|---|---|---|---|
| **Umsetzer:in** | die P9-Session | baut, nimmt auf, misst, startet Prüfer:innen, behebt Befunde, führt Protokoll | alles |
| **R1 Art Direction / Stiltreue** | eigener Subagent, je Durchgang neu | Strich, Coco-Anatomie, Stationszeichnungen, Platzhalter, Weltraum-Motive, Foto-Look | Bündel-Ordner `sheets/art`, `frames/…` (Standbilder), Referenzbilder, DESIGN §2, §6, §10, §12, Checkliste §5.1–5.3, §5.9 |
| **R2 Bewegung / Timing** | eigener Subagent, je Durchgang neu | Choreografie, Easing, Dauern, Boil, Übergänge, Ruhezonen | `sheets/motion`, Frame-Sequenzen, `metrics/motion.json`, DESIGN §9.6–9.8, §11, Checkliste §5.4, §5.10 |
| **R3 Tempo / Barrierefreiheit** | eigener Subagent, je Durchgang neu | Long Tasks, Frames, CLS/LCP, Budgets, reduzierte Bewegung, Überdeckung, Kontrast, axe | `metrics/*.json`, `axe/*.json`, Reduced-Motion-Sheets, DESIGN §3, §9.9–9.11, Checkliste §5.5–5.8 |

```
bauen/fixen ─► pnpm art:record ─► pnpm art:check (automatische Kriterien)
                                   │ rot → zurück zu bauen/fixen (keine Prüfer:innen verbrauchen)
                                   ▼ grün
                 3 Subagenten parallel starten (R1, R2, R3 – frische Instanzen, getrennte Kontexte)
                                   ▼
                 Befunde ins Protokoll ─► alle PASS? ─ja─► vollständige Aufnahme bestätigt? ─► P9 fertig
                                   │ nein
                                   ▼
                 Blocker/Major beheben ─► neue Iteration
```

Hinweis: Prüfer:innen können **Bilder lesen, aber keine Videos abspielen**. Maßgeblich für die Subagenten sind deshalb
Frame-Sequenzen und Kontaktbögen (§4.5). Videos dienen Menschen (Jutta, P11) und dem Umsetzer zur Kontrolle.

---

## 2. Prüfinventar

Jedes Prüfobjekt hat eine ID. Befunde verweisen immer auf ID + Checklistenpunkt.

| ID | Objekt | Quelle (DESIGN) | Aufnahme-Szenario (§4.3) |
|---|---|---|---|
| ART-COCO-{pose}-{a\|b\|c} | mindestens 18 Pose-Frames: 6 Posen × 3 (`rennen`, `schnueffeln`, `sitzen`, `schlafen`, `springen`, `kopfschief`) | §10.3–10.4 | SC-12 |
| ART-COCO-BRIDGE-{name} | 4 Brücken-Frames | §10.3 | SC-12 |
| ART-STATION-{id} | Stationszeichnungen (Keramik, Textil, Zeichnungen, Schmuck, Tattoo, + Planet/Coco) | §12.4 | SC-13 |
| ART-PH-{typ}-{n} | Platzhalter-Illustrationen | §12.3 | SC-13, SC-04 |
| ART-SPACE-{name} | Planeten, Sterne, Mond, Untertasse, Morse-Leiste | §12.5 | SC-13 |
| ART-BRAND-{wordmark\|favicon\|apple\|pwa\|og} | Wortmarke, Icons, OG-Bilder | §12.6 | SC-13 |
| ART-UI-{stamp\|tag\|hatch\|icons} | Stempel, Preisschild-Form, Schraffur, Icon-Set | §6, KO-05, KO-06 | SC-13, SC-04 |
| ANI-LEASH-{preset} | Tuschelinie je Preset (11) | §9.7 | SC-01…SC-11, SC-15 |
| ANI-CHOREO-S{0..8} | Stationen der Startseite | §11.4 | SC-01 |
| ANI-MI-{01..16} | Mikro-Interaktionen | §11.5 | SC-03…SC-10, SC-14 |
| ANI-VT | Seitenübergänge | §9.8 | SC-11 |
| IMG-LOOK | Foto-Look (Weißabgleich, Belichtung, Zuschnitt) | §12.2 | SC-16 |

---

## 3. Werkzeuge und QA-Modus

### 3.1 Schalter

Namen der Umgebungsvariablen laut ARCHITEKTUR §5.2; Query-Schalter gelten nur mit `ART_QA=1`.

| Variable (Build/Start) | Wirkung |
|---|---|
| `NEXT_PUBLIC_LEASH_DEBUG=1` | Test-Schnittstelle `window.__leash` (DESIGN §9.13) und Frame-Logger `window.__qa` (unten); nie im Produktions-Build und nie in der Vorschau-Datei (`pnpm check:no-debug`, ARCHITEKTUR §6.4) |
| `ART_QA=1` | aktiviert QA-Seiten unter `/{locale}/qa/*` (Ordner `src/app/(frontend)/[locale]/qa/`, ARCHITEKTUR §2.1; sonst `notFound()`; nicht in Routen-Registry, Sitemap, robots) |
| `?leash=off` (nur mit `ART_QA=1`) | Seite ohne Engine rendern → **Grundlinie** für Tempo-Vergleiche |
| `?freeze=1` (nur mit `ART_QA=1`) | Boil sofort aus, alle zeitbasierten Abläufe auf Endzustand (für Pixel-Vergleiche) |
| `?qa-jank=30` (nur mit `ART_QA=1`) | künstliche Last: 30 ms Busy-Loop je Frame (prüft die Laufzeit-Abstufung A → B, PF-12) |

**Kalibrierbogen (einmalig, vor der ersten Zeichenarbeit in P9):** Den Coco-Platzhalter-Sprite aus P2 als Kontaktbogen
(alle Posen, 72 px und 180 px) rendern und als `docs/design/qa-log/img/calibration-p2-placeholder.webp` committen; das
Bündel kopiert ihn nach `sheets/art/calibration-p2-placeholder.webp` (Kalibrierung von R1, §6.2).

`window.__qa` (nur Debug-Build): `frames: number[]` (rAF-Zeitstempel während Aufnahme), `loaf: PerformanceEntry[]`
(`long-animation-frame`), `longtasks`, `shifts` (`layout-shift`), `events` (Event Timing ≥ 16 ms), `poseLog:
{t, from, to, bridge}[]`, `marks` (`leash:build`, `leash:frame` aus `performance.measure`), `start()`, `stop()`, `dump()`.

### 3.2 QA-Seiten (nur `ART_QA=1`)

| Route | Inhalt |
|---|---|
| `/de/qa/coco` | alle Coco-Symbole (mindestens 22: 6 Posen × 3 + 4 Brücken) auf Papier in allen Größenklassen (DESIGN §10.5: 24, 40, 42, 64, 72, 180, 240 px, jeweils mit dem zugehörigen `data-size`-Strich); Schalter Boil an/aus; `?parts=1` färbt `data-part`-Gruppen zur Anatomie-Prüfung ein; `?frame=a\|b\|c` zeigt nur einen Frame |
| `/de/qa/art` | Stationszeichnungen neben ihrer Quelle (gleicher Maßstab), Platzhalter, Weltraum-Motive, Wortmarke, Favicon in 16/32/180 px, OG-Bilder |
| `/de/qa/motion?mi=MI-03` | einzelne Mikro-Interaktion isoliert mit Knopf „Abspielen“ (deterministisch, gleicher Code wie im Produkt) |
| `/de/qa/leash?preset=journey&stations=7` | synthetische Langseite je Preset mit Ankern, zum isolierten Messen |

### 3.3 Skripte (P9 legt sie an; Namen laut ARCHITEKTUR §6.10, Ordner laut §2.1)

`art:sprite` und `art:vectorize` dürfen früher entstehen, wenn P2 (Coco-Platzhalter) bzw. P8 (Stationszeichnungen v1) sie
brauchen.

| Befehl | Datei | Tut |
|---|---|---|
| `pnpm art:build` | – | `next build` mit `NEXT_PUBLIC_LEASH_DEBUG=1 ART_QA=1` gegen eine Datenbank mit Beispielbestand (`pnpm payload migrate` + `pnpm seed`, `SEED_NOW` wie CI, ARCHITEKTUR §6.3) |
| `pnpm art:record [--scope SC-01,SC-04]` | `playwright.art.config.ts`, `tests/art/*.art.spec.ts` | Aufnahme aller (oder genannter) Szenarien, schreibt `artifacts/art-qa/<run>/` |
| `pnpm art:metrics` | `scripts/art/metrics.ts` | wertet Rohdaten aus → `metrics/*.json` |
| `pnpm art:sheets` | `scripts/art/sheets.ts` | Kontaktbögen (sharp) → `sheets/*.webp` |
| `pnpm art:check` | `scripts/art/check.ts` | prüft alle „auto“-Kriterien aus §5, schreibt `check.json` und `check.md`, Exit-Code ≠ 0 bei Fehler |
| `pnpm art:bundle` | `scripts/art/bundle.ts` | `manifest.json`, Größen-Check, optional ZIP für CI |
| `pnpm art:vectorize` | `scripts/art/vectorize.ts` | Stationszeichnungen neu erzeugen (DESIGN §12.4) |
| `pnpm art:sprite` | `scripts/art/build-sprite.ts` | `public/art/coco-sprite.v{N}.svg` + `src/art/coco/coco-sprite.json` (DESIGN §10.4) |

Browser: Chromium **und** WebKit müssen installiert sein (`pnpm exec playwright install chromium webkit --with-deps`).
Die Cloud-Umgebung braucht dafür die Playwright-Download-Domains in der Netzwerk-Freigabe; `scripts/cloud-setup.sh`
versucht beim Start immer, Chromium **und** WebKit zu installieren (`docs/CLOUD-SETUP.md` §1 und §3.2). Nur wenn die
WebKit-Installation scheitert, setzt das Skript `PW_SKIP_WEBKIT=1` für die Session (ARCHITEKTUR §5.2/§7.3). Dann gilt:
Aufnahme nur mit Chromium, iPhone-Profil als markierte Chromium-Emulation, Eintrag in `docs/OFFENE-PUNKTE.md`, R3 wertet
`art-iphone15` als „nur visuell“. Die CI führt WebKit immer aus; WebKit-Fehler aus der CI gelten.

---

## 4. Aufnahmeverfahren

### 4.1 Umgebung

- **Produktions-Build** (`pnpm art:build && pnpm start`), nie `pnpm dev` (Dev-Overhead verfälscht Messungen).
- Datenbank mit vollständigem Beispielbestand (P8; `pnpm seed` mit `SEED_NOW` wie CI), feste Uhrzeit per Playwright-Clock, wo
  zeitabhängig.
- Keine anderen CPU-lastigen Prozesse während Tempo-Läufen (Build vorher beenden).
- Jede Aufnahme bekommt eine Lauf-ID: `<YYYYMMDD>-iter<NN>-<sha7>`; Commit muss sauber sein (`git status` leer).

### 4.2 Geräteprofile

Eigene Playwright-Projekte in `playwright.art.config.ts` mit Präfix `art-` (ARCHITEKTUR §7.3). Sie entsprechen den Projekten
`iphone-15`, `pixel-7`, `desktop` der regulären Suite, nutzen aber die Viewport-Maße aus dem Gerätedeskriptor (die reguläre
Suite fixiert `iphone-15` auf 390×844).

| Projekt | Playwright-Gerät | Viewport / DPR | Engine | Drosselung | Zweck |
|---|---|---|---|---|---|
| `art-iphone15` | `devices['iPhone 15']` | Bildschirm 393×852 @3, touch (Viewport-Maße aus dem Deskriptor, nicht überschreiben) | **WebKit** | keine (in WebKit nicht verfügbar) | Aussehen/Timing wie im Instagram-In-App-Browser auf iOS |
| `art-pixel7` | `devices['Pixel 7']` | Bildschirm 412×915 @2.625, touch (Viewport aus dem Deskriptor) | Chromium | **CPU 4×** per CDP `Emulation.setCPUThrottlingRate` (nur Tempo-Läufe) | Mittelklasse-Android, Tempo-Messung |
| `art-desktop` | `devices['Desktop Chrome']` | 1440×900 @1 | Chromium | keine | Desktop-Choreografie (`lasso`, Hover-MI) |

Jedes Szenario läuft in zwei Bewegungs-Varianten: `motion` (Standard) und `reduced` (`reducedMotion: 'reduce'`).
Tempo-Läufe laufen **ohne** Videoaufnahme (Video kostet CPU) und getrennt von Bild-Läufen.

### 4.3 Szenarien

| ID | Route | Profile | Ablauf | Aufnahmen |
|---|---|---|---|---|
| SC-00 | Startseite | alle | Smoke: laden, 1× bis unten scrollen | Video, 3 Frames |
| SC-01 | R01 Startseite | alle | (a) Intro abwarten; (b) langsam scrollen 600 px/s bis Ende; (c) schnell „wischen“ 3000 px/s; (d) 400 px hoch; (e) 1,5 s stehen an jeder Station; (f) P12: Fitness-Coco der Hallo-Station (alle 3 s ein Bild über 42 s, Uhr angehalten) und Koko (Pupillen alle 1,5 s über 9 s); reduziert je ein Standbild | Video; Frames an jeder Station-Grenze (`y − 40`, `y`, `y + loopScroll/2`, `y + loopScroll`, `+1,5 s`); Intro-Sequenz alle 100 ms |
| SC-02 | R01 | alle, `reduced` | laden, bis Ende scrollen | Frames an denselben Positionen; Zeitvergleich t=0 vs t=2 s |
| SC-03 | Menü (auf R02) | alle | öffnen, 1 s, Link fokussieren (Tab), schließen (Esc) | Video; Öffnen-Sequenz alle 40 ms bis 800 ms; Unterstreichung alle 40 ms |
| SC-04 | R02 Shop, R05 Archiv | alle | laden, Reihe für Reihe scrollen; Desktop: Hover über 2 Karten | Video; je Reihe: vor Eintritt, +250 ms, +500 ms, +900 ms (Schwingen) |
| SC-05 | R04 Produktseite (available) | alle | laden, Galerie wischen, Zoom öffnen/schließen, „In den Korb“ | Video; Linie 0/150/300/450/600 ms; Hüpfer alle 40 ms; Kauf-Leiste |
| SC-06 | R06 Korb, R07 Kasse (Mock-Zahlung), R09 Bestellstatus, R26 Widerruf | alle | Felder ausfüllen, Fehler auslösen, Ändern-Links | Frames vor/nach jeder Interaktion; `getAnimations()`-Protokoll |
| SC-07 | R07 Countdown | alle | Clock auf `reservedUntil − 10:05`, `−5:00`, `−1:00`, `0` vorspulen | Frames je Schwelle; Live-Region-Texte |
| SC-08 | R12 Tattoo-Flash, R11 | alle | laden, scrollen, Desktop-Hover auf Flash-Karte | Video; Kontur je Karte 0/350/700 ms |
| SC-09 | R08 Danke (Zustände: warten, bezahlt, Vorkasse, fehlgeschlagen, leider schon weg) | alle | Zustände per Mock-Zahlung | Video; MI-09 alle 100 ms bis 6 s |
| SC-10 | R28 404, 404-Variante „Zuhause“, R29 500 | alle | laden, 6 s warten | Video; alle 200 ms bis 6 s |
| SC-11 | R01 → R02 → R04 → R06 (weiche Navigation) | `art-pixel7`, `art-desktop` | Links klicken | Video; View-Transition-Sequenz alle 50 ms |
| SC-12 | `/de/qa/coco` | `art-desktop` (+ `art-iphone15` Stichprobe) | alle Symbole, `?parts=1`, je Frame einzeln | Standbilder je Symbol in 7 Größen; Boil-Sequenz bei 0/1/2 Frame-Längen |
| SC-13 | `/de/qa/art` | `art-desktop` | – | Standbilder in 1× und 3× |
| SC-14 | `/de/qa/motion?mi=…` für MI-01…MI-16 | `art-desktop`, `art-iphone15` | je MI „Abspielen“ | Sequenz alle 20 ms (per Seek, §4.4) |
| SC-15 | R01, R04 | `art-pixel7` | Resize 412→768→412, Querformat, Schrift nachladen verzögert (Font-Request 2 s blockieren) | Frames vor/nach; Neuaufbau-Zähler |
| SC-16 | Alle Titelbilder des Beispielbestands | – (Skript, kein Browser) | Pipeline-Ergebnis vs. Original | Kontaktbogen Vorher/Nachher, `metrics/images.json` |
| SC-17 | R01 | `art-pixel7` | `forcedColors: 'active'` | Frames |
| SC-18 | R01, R02, R04, R07 | `art-pixel7` | Tempo-Lauf (ohne Video): jeweils mit Engine und `?leash=off` (Grundlinie), je 3 Wiederholungen | nur Messdaten (§4.6) |

### 4.4 Deterministische Frame-Aufnahme

- **Scrollgekoppelt:** `window.scrollTo(0, y)` → zwei `requestAnimationFrame` abwarten → Screenshot (nur Viewport). Für exakte
  Lesezeilen-Positionen `__leash.setReadingY(y)`.
- **Zeitbasiert, WAAPI/CSS:** `document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; })`, dann Screenshot; `t`
  in den Schritten aus §4.3.
- **Zeitbasiert, rAF/Timer:** `page.clock.install({ time: <fix> })` **vor** der Navigation; danach `page.clock.runFor(ms)`
  in Schritten (Playwright-Clock steuert `Date`, Timer, `requestAnimationFrame`, `performance.now`). Voraussetzung ist DESIGN §9.10
  „Zeitsteuerung“.
- **Boil:** Seek auf 0, 1, 2 Frame-Längen (`--boil-frame` bzw. `--run-frame`).
- Screenshots als PNG verlustfrei aufnehmen, für Bündel und Bögen nach WebP q 90 wandeln (Einzelframes) bzw. q 85 (Bögen).
- Dateinamen: `frames/<SC>/<profil>/<variante>/<nnn>-<label>.webp`, `label` z. B. `y1840`, `t0300`, `station3-arrive`.

### 4.5 Kontaktbögen (für Subagenten)

- sharp setzt Frames in ein Raster (max. 2400 px breit, 6 Spalten, Beschriftung unter jedem Frame: Szenario, Profil, `t`/`y`).
- Je Szenario × Profil × Variante ein Bogen; Coco-Bögen je Pose (Frames A/B/C nebeneinander in allen Größen, plus
  `?parts=1`-Fassung); Stationszeichnungen **neben der Quelle** im gleichen Maßstab.
- Ablage `sheets/art/*.webp`, `sheets/motion/*.webp`, `sheets/a11y/*.webp` – je Datei ≤ 1,5 MB.

### 4.6 Tempo-Messung (SC-18)

- Profil `art-pixel7`, CPU 4×, kein Video, Cache warm (1 Vorlauf verwerfen), je Route 3 Läufe **mit** Engine und 3 **ohne**
  (`?leash=off`).
- Ablauf pro Lauf: laden → LCP abwarten → `__qa.start()` → 5 s gleichmäßig scrollen (Chromium: CDP
  `Input.synthesizeScrollGesture`, 900 px/s, `gestureSourceType: 'mouse'` – synthetische Touch-Gesten scrollen im
  Headless-Chromium nicht (P9.11 gemessen: 0 px); der Gesten-Weg wird einmal kalibriert, weil die Mobil-Emulation ihn
  skaliert) → Menü öffnen/schließen → (R04) „In den Korb“ → `__qa.stop()` → `dump()`.
- Zusätzlich CDP-Trace (`devtools.timeline`) für einen Lauf je Route zum Zählen von `Layout`-Ereignissen während des Scrollens.
- Auswertung (`pnpm art:metrics`): rAF-Intervalle (p50, p95, Anteil > 33,4 ms), LoAF-Einträge > 50 ms mit Skript-Zuordnung
  (URL enthält Chunk-Namen `leash`/`coco`/`micro`), Summe `leash:frame`-Messungen je Frame, `leash:build`, CLS-Summe und
  Quellen, Event-Timing-Dauern (Menü, In den Korb), LCP (aus PerformanceObserver) – jeweils Median der 3 Läufe.
- **Headless-Hinweis:** In CI/Cloud rendert Chromium ohne GPU. Absolute Bildraten sind dort nicht aussagekräftig; Gates sind
  deshalb **relativ zur Grundlinie** (`?leash=off`) plus absolute Obergrenzen nur für Skriptzeit und Long Tasks.

---

## 5. Abnahmekriterien (Checkliste)

Spalten: **ID · Kriterium · Schwelle · Methode** (`auto` = `pnpm art:check` entscheidet; `R1/R2/R3` = Urteil der Linse mit
Beleg) **· Schwere bei Verfehlung** (B = Blocker, M = Major, m = Minor; Definition §6.4).

### 5.1 Linie (LQ) – Linse R1 (auto-Teile prüft `art:check`)

| ID | Kriterium | Schwelle | Methode | Schwere |
|---|---|---|---|---|
| LQ-01 | Linienfarbe Tusche | Median-Farbe der dunkelsten 50 % Pixel an 200 Stichproben entlang der LUT: ΔE2000 ≤ 3 zu `#1C1A17`, Chroma C* ≤ 4 | auto (Screenshot + Geometrie) | B |
| LQ-02 | Grundbreite | Mittel der Breite 0,95–1,10 × `--leash-w`; Variationskoeffizient 0,08–0,20 | auto (Geometrie) | M |
| LQ-03 | Zittern der Hand | RMS-Abweichung der gewackelten Punkte von der glatten Kurve 0,35–1,3 px; **0** gerade Strecken ≥ 120 px mit max. Abweichung < 0,3 px von der Sehne | auto | M |
| LQ-04 | Keine perfekten Schlaufen | je Schlaufe: Kreis-/Ellipsen-Fit-Residuum RMS ≥ 0,6 px und Radiusschwankung ≥ 6 % | auto | M |
| LQ-05 | Anfang/Ende wie Feder | Breite in den ersten 4 px ≤ 0,45 × Grundbreite, in den letzten 4 px ≤ 0,5 × | auto | m |
| LQ-06 | Nahtlos | an jeder Segmentgrenze: kein heller Spalt (Helligkeit entlang der Mittellinie im 8-px-Fenster nie > Median + 15 L*); 4×-Zoom-Ausschnitt im Bogen | auto + R1 | M |
| LQ-07 | Tintenpunkte | an jedem Schlaufenstart ein Tintenpunkt sichtbar | R1 | m |
| LQ-08 | Stilnähe | Bewertung ≥ 4 von 5 (Rubrik §6.5) im Vergleich zu `post-DbJ1QRrjCcb.jpg` und `post-DaJH_kADpsK.jpg` in gleichem Maßstab | R1 | M |
| LQ-09 | Stufe B sieht noch handgemacht aus | Bewertung ≥ 3 von 5 (Stufe B ist Notlösung) | R1 | m |

### 5.2 Coco (CO) – Linse R1

| ID | Kriterium | Schwelle | Methode | Schwere |
|---|---|---|---|---|
| CO-01 | Vollständigkeit | mindestens 22 Symbole (6 Posen × 3 Frames + 4 Brücken) mit IDs aus DESIGN §10.4 **plus 27 Zusatz-Symbole** (9 Zusatz-Posen × 3 Frames in der nachgeladenen Datei, DESIGN §10.8, P12.4), gleiche `viewBox`, alle `data-part` vorhanden oder in `data-hidden-parts` begründet | auto | B |
| CO-02 | Proportionen (Seitenansicht-Posen `rennen`, `schnueffeln`, `springen`; Sitzposen analog aus Kopfteilen) | Ohrhöhe / Kopflänge 0,55–0,85 (große aufrechte Ohren nach Juttas Coco-Fotos vom 04.10.2026, gemessen ≈ 0,65; vorher 0,80–1,10 bzw. 0,35–0,65) · Augenbreite / Kopflänge 0,18–0,26 · Schnauzenlänge / Kopflänge 0,30–0,45 · Beinbreite / Beinlänge ≤ 0,18 · Nase ≤ 0,15 Kopflänge | auto (`getBBox()` der `data-part`-Gruppen auf `/qa/coco`) | M |
| CO-03 | Merkmale | runder Kopf, große aufrechte Ohren mit gerundeter Spitze (bei `kopfschief` eines leicht geknickt; Juttas Coco-Fotos 04.10.2026), große runde dunkle Augen mit Glanzpunkt, kurze Schnauze, dicke schwarze Nase, schlanke Beine, Sichelschwanz (außer `schlafen`), **rotes Geschirr mit D-Ring** in jeder Pose, in der Rücken/Brust sichtbar ist | R1 (Checkliste je Frame im Befund-Format) | B |
| CO-04 | Anker stabil | D-Ring je Pose über A/B/C ± 2 Einheiten, `rennen` ± 3, bewegte Zusatz-Posen weiter (Verbeugung/Kratzen ± 4, Schütteln ± 6, Freudenhüpfer ± 12; P12.4); `data-ground-y` ± 2 | auto | M |
| CO-05 | Boil-Stärke | Silhouetten-IoU (gerastert 256 px, Schwelle 50 %) zwischen Frames derselben Pose 0,88–0,97; `rennen` 0,55–0,85 (echte Gangphasen); Zusatz-Posen mit echter Bewegung breiter (Zucken/Kratzen/Gähnen/Liegen 0,80–0,97, Verbeugung 0,70–0,97, Schütteln 0,60–0,97, Freudenhüpfer 0,10–0,90; P12.4) | auto | M |
| CO-06 | Handmerkmale je Frame | ≥ 2 offene Konturstellen, ≥ 1 Überstand, ≥ 1 Doppelkontur; Ohren-Asymmetrie (Höhe) 5–15 %; Augen verschieden (Breite ≥ 3 % Unterschied) | auto (Geometrie) + R1 (offene Stellen) | M |
| CO-07 | Keine Primitive, keine Symmetrie-Kopien | kein `<circle\|ellipse\|rect\|line\|polygon>` im Sprite; kein Frame ist Spiegel/Verschiebung eines anderen (Pfaddaten-Vergleich) | auto | M |
| CO-08 | Strichstärke gerendert | 24 px: 1,0–1,4 px · 40/42 px: 1,4–1,8 px · 64/72 px: 1,6–2,0 px · 180/240 px: 2,0–2,4 px (Sollwerte DESIGN §10.5) (Messung quer zum Strich an 10 Stellen) | auto | m |
| CO-09 | Wiedererkennbarkeit | „klar Coco“ im Vergleich mit den Highlight-Fotos: Bewertung ≥ 4 | R1 | M |
| CO-10 | Lesbarkeit klein | bei 24 px als Hund mit großen Ohren erkennbar | R1 | m |
| CO-11 | Fell-/Geschirr-Versatz | Wash-Versatz 1–2 Einheiten nach rechts unten, Farbgrenzen ohne eigene Linie | R1 | m |

### 5.3 Stationszeichnungen, Platzhalter, Motive (AR) – Linse R1

| ID | Kriterium | Schwelle | Methode | Schwere |
|---|---|---|---|---|
| AR-01 | Quelle und Rechte | jede Stationszeichnung stammt aus der Zuordnung DESIGN §12.4; **keine** Kundenhaut-Fotos, kein Godzilla, keine Bilder mit Jutta | auto (`content/art/sources.json`) + R1 | B |
| AR-02 | Strichtreue der Vektorisierung | Median-Strichbreite (Distanztransformation) der Zeichnung 0,75–1,25 × Median im Schwellwertbild der Quelle; keine Klumpen (zusammengelaufene Flächen > 2 % der Bildfläche, die im Original offen sind) | auto + R1 | M |
| AR-03 | Größe | Station ≤ 8 KB, Platzhalter ≤ 6 KB, Motive ≤ 1,5 KB, Icons ≤ 600 B, Wortmarke ≤ 5 KB | auto | m |
| AR-04 | Platzhalter-Regeln | viewBox 400×500, höchstens eine Wash-Farbe aus §3.1 (ohne Wash erlaubt), Strich 2,8 (seit P9.13; vorher 2,4), kein `<text>`, Motiv 55–70 % der Höhe | auto | m |
| AR-05 | Platzhalter wirken wie Juttas Hand | Bewertung ≥ 4 (Rubrik §6.5), im Shop-Raster zwischen echten Fotos nicht „fremd“ | R1 | M |
| AR-06 | Weltraum-Motive | handgezeichnet, max. 1 Marke/Station, ≤ 3 Sterne/Bildschirmhöhe, keine Band-Bezüge (Liedtext, Logo, Albumgrafik) | auto (Dichte) + R1 | B (Band-Bezug) / m |
| AR-07 | Marke klein lesbar | Favicon 16 px als Planet mit Ring erkennbar; Wortmarke ab 24 px Höhe lesbar | R1 | m |

### 5.4 Bewegung und Timing (MO) – Linse R2

| ID | Kriterium | Schwelle | Methode | Schwere |
|---|---|---|---|---|
| MO-01 | Dauern | jede gemessene Animation = Token-Wert aus DESIGN §11.3 / §11.5 ± 10 % | auto (`getAnimations()`-Protokoll, `effect.getTiming()`) | M |
| MO-02 | Easings | nur Kurven aus DESIGN §11.2 (Vergleich `getComputedTiming`/Keyframe-`easing`); kein `ease*` | auto | M |
| MO-03 | Boil-Takt und -Reihenfolge | 8–12 fps (Frame-Länge 83–125 ms); `rennen`/`springen` 12 fps, `schlafen` 8 fps; Seek auf 0/1/2 Frame-Längen zeigt genau Frame a/b/c (Reihenfolge A → B → C, sonst läuft der Galopp rückwärts) | auto | M |
| MO-04 | Boil-Budget | kein Boil, kein Atmen und kein Ablauf (auch endliche wie MI-09, MI-11) läuft > 5 s am Stück ohne Nutzereingabe; Danke-Wartezustand: Boil endet 5 s nach Eintritt | auto (`poseLog`, `data-boil`, `getAnimations()`) | B |
| MO-05 | Lesezeilen-Treue | an 12 Scroll-Positionen: `drawnLen` = `map(readingY)` ± 1 px nach 2 Frames | auto | M |
| MO-06 | Tinte bleibt | 400 px hochscrollen: `drawnLen` unverändert; Coco läuft gespiegelt zurück | auto + R2 | M |
| MO-07 | Coco folgt | nach Scrollstopp ≤ 400 ms bis Abstand < 1 px; beim schnellen Wischen nie > 300 px Bogenlänge Rückstand (sonst Sprung) | auto | m |
| MO-08 | Posen je Station | Pose bei Ankunft/Verweilen = Tabelle DESIGN §11.4 an allen 9 Stationen | auto (`__leash.pose()`) + R2 (Bögen) | M |
| MO-09 | Brücken | jeder Posenwechsel mit der definierten Brücke bzw. Frame-Grenze; keine Überblendung | auto (`poseLog`) + R2 | m |
| MO-10 | Intro | Start ≥ LCP + 300 ms; Dauer 1800 ms ± 180 (P12.4/U-06: doppelt so langsam; vorher 900 ± 90) (aus der Kurvenanpassung der `drawnLen`-Reihe, nicht aus dem ersten sichtbaren Bild; `art-iphone15`: Dauer nur informativ, weil WebKit ohne GPU in der Aufnahme-Sitzung nur ≈ 10 Bilder/s liefert; Start ≥ LCP + 300 gilt weiter); Coco rennt herein (MI-10) | auto | M |
| MO-11 | Katalog vollständig | jede MI-01…MI-16 in SC-14 aufgenommen und entspricht Ablauf/Eigenschaften der Tabelle | R2 | M |
| MO-12 | Timing-Gefühl | Bewertung ≥ 4 (Rubrik §6.5): Feder statt Maschine, Staffelungen leicht unregelmäßig, nichts „schwimmt“ | R2 | M |
| MO-13 | Stempel nur im Verkaufsmoment | Archiv/Shop-Aufruf: 0 Stempel-Animationen; Danke „bezahlt“: MI-03 ≤ 3× | auto | M |
| MO-14 | Seitenübergänge | Coco wandert in 350 ms ± 35; keine Übergänge von/zu `calm`-Routen | auto + R2 | m |
| MO-15 | Flackern | kein Element blinkt > 3× pro Sekunde | auto (Frame-Differenzen SC-01/03/09/10) | B |

### 5.5 Lesbarkeit (LG) – Linse R3

| ID | Kriterium | Schwelle | Methode | Schwere |
|---|---|---|---|---|
| LG-01 | Keine Überdeckung | an allen Frame-Positionen aus SC-01, SC-04, SC-05, SC-08, SC-09, SC-10: Schnittmenge aus (gezeichneten LUT-Punkten ± halbe Breite) ∪ **Hundekante der Coco** (Bbox der gezeichneten Figur: waagerecht 0,10–0,90 der Box-Breite – die Sprite-Hüllen aller 22 Symbole liegen bei 0,131–0,903 –, senkrecht die volle Box; **keine** Zusatz-Toleranz, einzige Toleranz sind die 1 px, um die jedes Textzeilen-Rechteck schrumpft; die Box selbst ist breiter als der Hund, DESIGN §10.5 – ihre Überdeckungen weist `check.json` nur informativ aus) mit (Rects aller Textzeilen via `Range.getClientRects()` in `main`/`footer`, auch innerhalb von Links/Knöpfen) ∪ (vollständige Rects aller Formularfelder, Knöpfe, Icon-Knöpfe und Fußbereich-Links) = **leer**. Block-Links (Produktkarten) zählen nur mit ihren Textzeilen (DESIGN §9.9 Nr. 3) | auto | B |
| LG-02 | Pflichtlinks frei | DESIGN AK-DS-09 auf allen Routen | auto | B |
| LG-03 | Schrift-Regeln | Mansalva nur in erlaubten Rollen (DESIGN §4.3), nie < 24 px; Scan per `getComputedStyle` | auto | M |
| LG-04 | Textgröße 200 % | `document.documentElement.style.fontSize = '32px'` bei 390 px: kein horizontales Scrollen, LG-01 weiterhin leer, Linie neu aufgebaut | auto | M |
| LG-05 | Stationsinhalt zuerst | bei jedem Stations-Frame sind H2 und Text vollständig sichtbar, bevor/während Coco dort ist | R3 (Bögen) | m |

### 5.6 Tempo (PF) – Linse R3

| ID | Kriterium | Schwelle | Methode | Schwere |
|---|---|---|---|---|
| PF-01 | Long Tasks | **0** LoAF-/Long-Task-Einträge > 50 ms mit Skript-Zuordnung zu `leash`/`coco`/`micro` während Laden, Scrollen, Menü, In den Korb (Pixel 7, 4×) | auto | B |
| PF-02 | Frames relativ | p95 rAF-Intervall mit Engine ≤ Grundlinie + 3 ms; Anteil Frames > 33,4 ms ≤ Grundlinie + 3 Prozentpunkte | auto | B |
| PF-03 | Skriptzeit je Frame | `leash:frame` p95 ≤ 6 ms (4×), ≤ 2 ms (Desktop 1×) | auto | M |
| PF-04 | Aufbau | `leash:build` ≤ 8 ms (Desktop 1×); bei 4× kein einzelnes Teilstück > 50 ms | auto | M |
| PF-05 | Kein Layout-Thrashing | während 5 s Scrollen ≤ 3 `Layout`-Ereignisse im Trace, 0 „Forced reflow“ aus Engine-Code | auto (Trace) | M |
| PF-06 | CLS | Engine-Beitrag 0 (keine `layout-shift`-Quelle in Linien-Ebene/Coco-Box); Seiten-CLS mit Engine ≤ Grundlinie | auto | B |
| PF-07 | LCP | LCP mit Engine − Grundlinie ≤ 100 ms (Median); EK-01 (≤ 2,5 s) grün | auto + Lighthouse-CI | B |
| PF-08 | Interaktion | Event-Timing Menü öffnen und „In den Korb“ ≤ 150 ms (4×) | auto | M |
| PF-09 | JS-Budget | Chunks gz: Engine ≤ 12 KB, Coco ≤ 3 KB, Mikro ≤ 4 KB, statischer Renderer ≤ 4 KB; nichts davon im Erstlade-Bundle; GSAP standardmäßig in keinem Chunk (DESIGN §9.10, DA-4), nur mit ADR, nur R01, ≤ 30 KB gz | auto (`pnpm check:bundle`, ARCHITEKTUR §7.7) | M |
| PF-10 | SVG-/Pfad-Budget | Sprite ≤ 45 KB roh/≤ 12 KB gz; Startseite SVG gesamt ≤ 60 KB roh; Pfaddaten im DOM ≤ 60 KB | auto | M |
| PF-11 | Ruhe im Hintergrund | Tab verborgen oder Linie außerhalb des Sichtbereichs: 0 rAF-Callbacks der Engine über 2 s | auto | m |
| PF-12 | Laufzeit-Abstufung | künstliche Last (`?qa-jank=30`, 30 ms Busy-Loop je Frame) schaltet Stufe A → B innerhalb von 2 s Scrollen | auto | m |

### 5.7 Reduzierte Bewegung und Barrierefreiheit (A11Y) – Linse R3

| ID | Kriterium | Schwelle | Methode | Schwere |
|---|---|---|---|---|
| A11Y-01 | Stillstand | `reduced`: DESIGN AK-DS-14 auf allen Szenario-Routen; Frame t=0 und t=2 s pixelgleich (außer Countdown-Text) | auto | B |
| A11Y-02 | Schalter „Animationen“ | `data-motion="reduced"` wirkt identisch zu A11Y-01; vor dem Klick 0 Storage-Einträge (KONZEPT EK-04) | auto | B |
| A11Y-03 | Deko unsichtbar für AT | Linien-Ebene, Coco, Motive: `aria-hidden`, 0 fokussierbare Nachfahren; Tab-Reihenfolge mit/ohne Engine identisch | auto | B |
| A11Y-04 | axe | 0 Verstöße „serious/critical“ auf allen Szenario-Routen in beiden Varianten | auto | B |
| A11Y-05 | Erzwungene Farben | SC-17: Linie in `CanvasText` sichtbar, keine Fläche verdeckt Text | auto + R3 | M |
| A11Y-06 | Ruhezonen | DESIGN AK-DS-11 (Korb, Kasse, Bestellstatus, Widerruf, Rechtsseiten ohne Animation/Transition) | auto | B |
| A11Y-07 | Fokus sichtbar | an jeder Interaktion der Szenarien: Fokusring sichtbar, nicht von Linie/Coco/Kauf-Leiste verdeckt | auto (`elementFromPoint` an 4 Ringpunkten) | M |

### 5.8 Kontrast (CT) – Linse R3

| ID | Kriterium | Schwelle | Methode | Schwere |
|---|---|---|---|---|
| CT-01 | Token-Kontraste | DESIGN AK-DS-01 grün | auto | B |
| CT-02 | Gerendert | axe `color-contrast` ohne Verstoß; Stichprobe: Text über Raster-Hauptlinien ≥ 4,5:1 (Pixelmessung) | auto | B |
| CT-03 | Stempel und Badges | Stempel ≥ 3:1 auf `--paper-2` (≥ 24 px); Badge-Texte ≥ 4,5:1 | auto | M |

### 5.9 Foto-Look (IM) – Linse R1

| ID | Kriterium | Schwelle | Methode | Schwere |
|---|---|---|---|---|
| IM-01 | Technik | DESIGN AK-DS-17 grün | auto | B |
| IM-02 | Einheitlichkeit | über alle Titelbilder: Standardabweichung Median-L* ≤ 6; neutrale Flächen (Papier) a*, b* innerhalb ± 4 | auto (SC-16) | M |
| IM-03 | Keine Überkorrektur | Holz, Haut, Aquarellpapier behalten ihren Charakter; Zeichnungen nicht farbstichig; Vorher/Nachher-Bogen | R1 | M |
| IM-04 | Wie aus einem Guss | Shop-Raster mit Fotos und Platzhaltern: Bewertung ≥ 4. **Seit P12.3 (U-13):** Maßstab ist der Goth-Fotorahmen (DESIGN §12.2a) um jedes Foto und jeden Platzhalter – gleiche Rahmung, dünne Tuschelinie, Filigran ohne Überladung, Leine daneben gut lesbar; ersetzt das Passepartout. | R1 | M |
| IM-05 | Budgets | DESIGN §12.2: Median `thumb` ≤ 40 KB, `card` ≤ 90 KB; im Profil `art-pixel7` geladenes LCP-Bild der Produktseite ≤ 120 KB | auto | m |

### 5.10 Ruhezonen und Ausschlüsse – Linse R2

| ID | Kriterium | Schwelle | Methode | Schwere |
|---|---|---|---|---|
| RZ-01 | Tabelle „Was sich nie bewegt“ | jede Zeile aus DESIGN §11.6 im Material belegt (SC-06, SC-04 Archiv) | auto + R2 | B |
| RZ-02 | Tattoo ohne Kaufoptik | kein Preisschild, kein „In den Korb“ im Tattoo-Bereich (KONZEPT §3.11) | auto | B |

---

## 6. Review-Schleife mit drei unabhängigen Linsen

### 6.1 Unabhängigkeit

1. **Drei getrennte Subagenten**, je Iteration **neu** gestartet (keine Wiederverwendung eines Prüf-Kontexts über Iterationen).
2. Jede Linse bekommt **nur** ihr Material (§1-Tabelle, Spalte „Sieht“) – **nicht** die Begründungen der Umsetzer:in, **nicht**
   die Urteile der anderen Linsen derselben Iteration, **keinen** Quellcode (Ausnahme R3: Build-Statistik und `check.json`).
3. Ab Iteration 2 bekommt jede Linse zusätzlich die **eigenen** offenen Befunde der Vor-Iteration als „Nachprüfliste“ – sie
   muss diese bestätigen **und** trotzdem die gesamte Checkliste neu prüfen.
4. Die drei Subagenten laufen parallel. Ergebnis ist je eine Datei `reviews/<R1|R2|R3>.md` im Bündel.
5. Steht kein Subagent-Werkzeug zur Verfügung: drei nacheinander gestartete, getrennte Headless-Läufe mit ausschließlich dem
   Linsen-Material; Vorgehen im Protokoll vermerken und in `docs/OFFENE-PUNKTE.md` eintragen.

### 6.2 Auftrag an die Subagenten (Vorlage)

```
Du bist unabhängige:r Prüfer:in für die Website planetclairetattoos.com, Linse {R1 Art Direction/Stiltreue |
R2 Bewegung/Timing | R3 Tempo/Barrierefreiheit}. Du prüfst NUR, du änderst nichts.

Lies zuerst: docs/design/KUNST-QA.md §5.{…} (deine Checkliste), §6.3 (Antwortformat), §6.5 (Bewertungsrubrik),
docs/design/DESIGN.md §{…}.
Material: artifacts/art-qa/{lauf-id}/ – nur die Ordner {…}. Referenzbilder: content/seed/instagram/{…}.
R1 zusätzlich: Juttas Stil-Skizzen `referenzen/jutta-skizzen/` samt `content/art/jutta-skizzen/README.md` (Stil-Beobachtungen: Monoline,
offene Konturen, nur kleine Punkte gefüllt, Schraffur nur als Akzent, viel Weißraum) – Messlatte für LQ-08, AR-05, CO-09.
Kalibrierung (nur R1): bewerte zuerst sheets/art/calibration-p2-placeholder.webp (der grobe P2-Platzhalter) nach Rubrik
§6.5. Gib ihm ehrlich eine Note; eine Note ≥ 3 macht deine Prüfung ungültig.
Nachprüfliste (ab Iteration 2): {Befund-IDs mit Kurzbeschreibung}.

Prüfe JEDEN Punkt deiner Checkliste. Für jeden Punkt: PASS oder FAIL, mit mindestens einem konkreten Beleg
(Dateiname + Frame/Label oder Messwert aus metrics/check.json). Ohne Beleg gilt der Punkt als nicht geprüft = FAIL.
Antworte ausschließlich im Format aus §6.3.
```

### 6.3 Antwortformat einer Linse

```markdown
# Review {R1|R2|R3} – Lauf {lauf-id}
verdict: PASS | FAIL
calibration: {Note für P2-Platzhalter, nur R1}
ratings: {LQ-08: 4, CO-09: 5, …}          # nur Rubrik-Punkte der Linse

| Punkt | Ergebnis | Beleg |
|---|---|---|
| LQ-01 | PASS | check.json → lq01.deltaE = 1.7 |
| CO-03 | FAIL | sheets/art/coco-sitzen.webp, Frame B: Geschirr fehlt |
…

## Befunde
| ID | Punkt | Objekt | Schwere | Befund | Beleg | Vorschlag |
|---|---|---|---|---|---|---|
| R1-03-01 | CO-03 | ART-COCO-sitzen-b | B | D-Ring und Geschirr fehlen | coco-sitzen.webp #b | Frame B aus A ableiten, Geschirr nachzeichnen |

## Nachprüfliste
| Vor-Befund | bestätigt behoben? | Beleg |
```

Befund-IDs: `R{Linse}-{Iteration zweistellig}-{laufende Nr.}`.

### 6.4 Schweregrade und PASS-Regel

| Schwere | Bedeutung | Beispiele |
|---|---|---|
| **B Blocker** | verletzt eine Entscheidung (E-xx), Recht/Barrierefreiheit oder Tempo-Gate | Linie überdeckt Text/Pflichtlink; Animation auf der Kasse; reduzierte Bewegung nicht still; Long Task > 50 ms aus Engine; Coco ohne Geschirr; Linie nicht tuscheschwarz |
| **M Major** | Schwelle verfehlt oder deutlich sichtbarer Qualitätsmangel | Boil zu stark (IoU 0,8); Stilnähe 3/5; falsche Pose an Station; Dauer 20 % daneben |
| **m Minor** | Feinschliff | Tintenpunkt fehlt an einer Schlaufe; Datei 10 % über Budget |

**Eine Linse meldet PASS nur, wenn:** alle ihre Checklistenpunkte PASS sind, alle ihre Rubrik-Noten ≥ 4 (LQ-09 ≥ 3), 0 Blocker,
0 Major und ≤ 3 offene Minor. **P9 PASS:** R1, R2, R3 PASS in derselben Iteration, auf einem Commit, aus einer **vollständigen**
Aufnahme (alle Szenarien, alle Profile, beide Varianten), und `pnpm art:check` grün.

### 6.5 Bewertungsrubrik (1–5) für Urteilspunkte

| Note | Stil (LQ-08, AR-05, CO-09) | Timing (MO-12) | Einheit (IM-04) |
|---|---|---|---|
| 5 | könnte von Jutta gezeichnet sein | wirkt gezeichnet-lebendig, jede Bewegung hat Grund, nichts stört | ein Guss, man bemerkt keine Pipeline |
| 4 | klar handgemacht, Juttas Anmutung, kleine Abweichungen | natürlich, einzelne Stellen etwas gleichförmig | einheitlich, 1–2 Bilder fallen leicht heraus |
| 3 | handgemacht, aber generisch („irgendein Doodle“) | funktioniert, wirkt teils mechanisch | erkennbar uneinheitlich |
| 2 | Vektor-sauber mit Wackel-Effekt, künstlich | mechanisch, Standard-Easing-Gefühl | deutliche Farb-/Helligkeitssprünge |
| 1 | Clipart, geometrisch | störend, ruckelig oder zu lang | chaotisch |

### 6.6 Iterationsregeln

1. Vor jedem Review muss `pnpm art:check` grün sein (automatische Punkte zuerst beheben – spart Prüf-Durchgänge).
2. Nach einem Review: **alle** Blocker und Major beheben; Minor nach Aufwand (max. 3 dürfen offen bleiben, im Protokoll).
3. Zwischen-Iterationen dürfen eine **Teil-Aufnahme** nutzen (`--scope` betroffene Szenarien + SC-00); die **abschließende**
   Iteration ist immer vollständig.
4. Jede Behebung ist ein eigener Commit mit Befund-ID in der Nachricht, Form laut ARCHITEKTUR §6.7 Nr. 2, z. B.
   `fix(P9.18a): redraw sitzen-b harness (R1-02-01) [skip ci]`.
5. **Konvergenz-Regel:** Schlägt derselbe Punkt am selben Objekt in 3 aufeinanderfolgenden Iterationen fehl, wählt die
   Umsetzer:in die nächste Stufe der **Vereinfachungsleiter** und vermerkt sie im Protokoll und in `docs/OFFENE-PUNKTE.md`:
   1. Parameter zurück auf DESIGN-Standardwerte;
   2. Effekt auf statischen Endzustand reduzieren (z. B. MI-13 ohne Wisch);
   3. Stufe B statt A für das betroffene Profil/den Browser (`presets.ts`);
   4. Choreografie-Moment streichen (Station behält Pose ohne Extra).

   **Stufen für Stil-Urteile** (Zeichnungen und Bilder: LQ-08, AR-05, IM-04, CO-09 – dort sind Parameter, Effekte und Abläufe nicht
   betroffen, Stufen 1–4 greifen nicht; eingeführt in P9.18 nach Iteration 3, konservativ, in `docs/OFFENE-PUNKTE.md` vermerkt):
   1. **Weniger Motive pro Bild, mehr Papier** (Platzhalter, Stationen, Raster): Wiederholungen streichen, Figuren einzeln zeichnen.
   2. **Einzelmotiv ersetzen:** das beanstandete Motiv durch eine Coco-Skizze nach Juttas Vorlage (`content/art/jutta-skizzen/`)
      ersetzen bzw. im Raster das Foto durch einen Platzhalter.
   3. **Station behält nur die einfachste Zeichnung** – ohne Schraffur, ohne Gekritzelfläche.
   Die Stufen werden der Reihe nach angewendet; jede zählt als „Fortschritt“ im Sinn von Nr. 6.2.
   **Nicht verhandelbar** (keine Vereinfachung, sondern Behebung): alle B-Punkte aus §5.5–5.8, mindestens 6 Posen × 3 Frames, Linie
   tuscheschwarz, reduzierte Bewegung, Ruhezonen.
6. **Obergrenzen** (die Schleife endet immer):
   1. **Weiche Grenze:** Nach 8 Iterationen ohne vollständiges PASS wird P9 mit dem besten Stand abgeschlossen, **sofern
      alle nicht verhandelbaren Punkte PASS sind**; offene Urteilspunkte kommen als „Kunst-QA offen: …“ in
      `docs/OFFENE-PUNKTE.md` (E-97: nicht blockieren). Sind nicht verhandelbare Punkte offen, wird weiter behoben – bis
      zur harten Grenze.
   2. **Harte Grenze:** Nach **12 Iterationen** insgesamt **oder** wenn derselbe B-Punkt (Schwere B, §5) am selben Objekt
      in **3 Iterationen in Folge ohne Fortschritt** bleibt, wird nicht weiter iteriert. „Fortschritt“ heißt: der Punkt
      ist PASS, sein Messwert liegt näher an der Schwelle, seine Rubrik-Note ist gestiegen, oder eine neue Stufe der
      Vereinfachungsleiter (Nr. 5) wurde angewendet. Jeder so offene Punkt kommt als **Blocker** ganz oben in den PR-Text
      und in `docs/OFFENE-PUNKTE.md` (Befund-ID, Objekt, letzter Beleg, was versucht wurde, Vorschlag für P11). Die
      P9-Aufgabe wird mit dem Vermerk „abgeschlossen mit Blocker (KUNST-QA §6.6)“ abgehakt, das Protokoll bekommt
      `result: STOP`, und die Session macht mit P10 weiter. Die Tempo-Gates (EK-01) und die Barrierefreiheit (EK-07)
      bleiben davon unberührt Pflicht für P10.

### 6.7 Geschmacksurteile außerhalb der Schleife (P2–P8, P10)

Verlangt ein Plan-Kriterium außerhalb der P9-Schleife ein Urteil über Geschmack oder Erkennbarkeit – z. B. „Coco
erkennbar“, „Zeichnung lesbar“, „Favicon bei 16 px als Planet mit Ring erkennbar“ (AR-07), „Selbstbewertung ≥ 4“ –, bewertet
das **nie** die Umsetzer:in selbst, sondern eine **frische Prüf-Linse**:

1. Ein neu gestarteter Subagent (kein wiederverwendeter Kontext) mit dem Auftrag aus §6.2 für die passende Linse (Zeichnung,
   Coco, Platzhalter, Icons: R1; Bewegung: R2; Lesbarkeit/Kontrast: R3), beschränkt auf die betroffenen Punkte.
2. Er sieht nur das Material des Kriteriums (Kontaktbogen oder Standbilder, die Referenzbilder aus
   `content/seed/instagram/` bzw. DESIGN §10.1) und die Rubrik §6.5 – keine Begründungen der Umsetzer:in, keinen Quellcode.
3. Antwort im Format §6.3 (nur die betroffenen Punkte). Bestanden, wenn jeder genannte Punkt PASS ist und die Rubrik-Note die
   Schwelle des Kriteriums erreicht (ohne eigene Schwelle: ≥ 4).
4. Ergebnis mit Datum, Commit und Note in `docs/FORTSCHRITT.md` (in P9 im `qa-log`). Nicht bestanden → nachbessern und eine
   neue frische Linse starten, höchstens 3 Durchgänge; danach Vermerk „Feinschliff in P9“ in `docs/OFFENE-PUNKTE.md`, die
   Aufgabe gilt mit diesem Vermerk als erledigt (E-97). Ohne Subagent-Werkzeug: §6.1 Nr. 5.

---

## 7. Iterationsprotokoll

- Ordner `docs/design/qa-log/`, je Iteration eine Datei `YYYY-MM-DD-iter-NN.md` (NN fortlaufend über ganz P9).
- Zusätzlich `docs/design/qa-log/INDEX.md` mit einer Zeile je Iteration (Datum, Commit, Ergebnis R1/R2/R3, Link).
- Protokolle werden nie nachträglich geändert (nur Status-Nachträge unten mit Datum).

**Vorlage:**

```markdown
---
iteration: 3
date: 2026-10-14
commit: 4f2a9c1
run_id: 20261014-iter03-4f2a9c1
scope: full            # full | partial: SC-01,SC-12
profiles: [art-iphone15, art-pixel7, art-desktop]
variants: [motion, reduced]
review_method: subagents   # subagents | headless-sequential
artifact: https://github.com/<owner>/<repo>/actions/runs/<id>  # nur bei CI-Upload, sonst "lokal"
result: FAIL           # PASS | FAIL | STOP (harte Grenze §6.6 Nr. 6)
---

# Kunst-QA Iteration 03

## Automatische Prüfung
art:check: grün | rot (Liste der roten Punkte)

## Urteile
| Linse | Verdict | Noten | Blocker | Major | Minor |
|---|---|---|---|---|---|
| R1 | FAIL | LQ-08 4 · CO-09 3 · AR-05 4 · IM-04 4 | 0 | 1 | 2 |
| R2 | PASS | MO-12 4 | 0 | 0 | 1 |
| R3 | PASS | – | 0 | 0 | 0 |

## Kennzahlen
| Größe | Wert | Grenze |
|---|---|---|
| p95 rAF-Intervall R01 (mit/ohne Engine) | 21,4 / 20,1 ms | Δ ≤ 3 |
| Long Tasks Engine | 0 | 0 |
| leash:frame p95 (4×) | 3,8 ms | ≤ 6 |
| LCP R01 (mit/ohne) | 1,84 / 1,79 s | Δ ≤ 0,1 |
| Engine-Chunk gz | 10,7 KB | ≤ 12 |
| Sprite gz | 9,9 KB | ≤ 12 |

## Befunde
| ID | Punkt | Objekt | Schwere | Status | Fix-Commit | Anmerkung |
|---|---|---|---|---|---|---|
| R1-03-01 | CO-09 | ART-COCO-kopfschief-* | M | behoben | a1b2c3d | Schnauze gekürzt |
| R1-03-02 | LQ-07 | ANI-LEASH-journey | m | offen | – | bewusst offen (3 Minor erlaubt) |

## Entscheidungen / Vereinfachungen
- keine | Vereinfachungsleiter Stufe 2 für MI-13 (Grund …), eingetragen in OFFENE-PUNKTE am …

## Nächste Schritte
- …
```

---

## 8. Artefakte: Repo oder CI

| Artefakt | Ort | Größe/Aufbewahrung |
|---|---|---|
| Iterationsprotokolle, `INDEX.md` | Repo `docs/design/qa-log/` | ≤ 30 KB je Datei |
| Ausgewählte Standbilder des **abschließenden PASS** | Repo `docs/design/qa-log/img/<datum>-iter-NN/` | ≤ 8 WebP, je ≤ 150 KB, zusammen ≤ 1,2 MB; frühere Iterationen **keine** Bilder im Repo |
| Kalibrierbogen P2-Platzhalter | Repo `docs/design/qa-log/img/calibration-p2-placeholder.webp` | ≤ 150 KB, einmalig |
| Visuelle Regressions-Referenzen (nur `reduced`/`?freeze=1`, deterministisch) | Repo `tests/art/__screenshots__/` (nur Linux-Referenzen, **nur in CI erzeugt** über den Job `snapshots` und `gh run download`, ARCHITEKTUR §6.4, §7.6) | ≤ 3 MB gesamt, nur Standbilder |
| QA-Quellen (`content/art/sources.json`, Sprite-Quelle, Skripte) | Repo | – |
| Rohdaten eines Laufs: Videos (`.webm`), Frame-Sequenzen, Kontaktbögen, Traces, `metrics/*.json`, `axe/*.json`, `reviews/*.md`, `check.*`, `manifest.json` | lokal `artifacts/art-qa/<lauf-id>/` (P9 ergänzt `artifacts/` in `.gitignore`) | lokal unbegrenzt, nie committen |
| End-Bündel (PASS-Kandidat: `art:check` grün) | CI-Artefakt `art-qa-<lauf-id>` | **≤ 100 MB** (Videos 720p-äquivalent in Viewport-Größe, Frames WebP; `art:bundle` bricht bei mehr ab), Aufbewahrung **30 Tage**; es gibt höchstens **ein** `art-qa-*`-Bündel gleichzeitig |
| CI-Lauf mit rotem `art:check` | CI-Artefakt `art-qa-check-<lauf-id>` nur mit `check.*` und `metrics/*.json` (optionaler Upload nach dem Budget-Schritt, ARCHITEKTUR §6.2) | ≤ 5 MB, Aufbewahrung **2 Tage** |
| Zwischenstände (Bündel) | nur lokal, nie als CI-Artefakt | – |

Grund für die Grenzen: GitHub Free hat für private Repos 500 MB Artefakt-Speicher gesamt (ARCHITEKTUR §6.1). Diesen Speicher
teilen sich die Vorschau-Artefakte (Aufbewahrung 30 Tage, nur die **3 neuesten** bleiben, je ≤ 40 MB, Ziel ≤ 20 MB,
ARCHITEKTUR §6.5, §14.8), die Fehlerberichte (nur bei Fehlschlag, 2 Tage) und das KUNST-QA-Bündel (≤ 100 MB). Videos gibt es
nur in diesem Bündel; die übrigen Workflows zeichnen keine auf. Deshalb löscht `art-qa.yml` **vor** jedem Upload eines
Bündels alle älteren `art-qa-*`-Artefakte (`gh api -X DELETE /repos/{owner}/{repo}/actions/artifacts/{id}`,
`permissions: actions: write`); das End-Bündel ist ein Pflicht-Upload, `art-qa-check-*` ein optionaler (Budget-Schritt ab
350 MB, ARCHITEKTUR §6.2). Nach dem P9-PASS läuft `art-qa.yml` nur noch per `workflow_dispatch`, `[ci:art]` oder erneut
gesetztem Label `art` (§9); wird das PASS-Bündel dadurch ersetzt, aktualisiert die Session den Link in
`docs/FORTSCHRITT.md`.

`manifest.json` des Bündels: `{ runId, commit, date, scope, profiles, variants, scenarios: [{id, files: [...]}],
toolVersions: {playwright, chromium, webkit, node}, sizes: {totalMB} }`.

---

## 9. CI-Einbindung

- Workflow `.github/workflows/art-qa.yml` (ARCHITEKTUR §6.2): Auslöser `workflow_dispatch` und Pull Requests
  (`labeled`, `synchronize`, `opened`, `reopened`). Er arbeitet, wenn der PR-Kopf-Commit die Kennung `[ci:art]` trägt
  oder am PR das Label `art` gesetzt ist; sonst endet er nach dem Schritt „Kennung“ (ARCHITEKTUR §6.2). Trägt der
  Kopf-Commit `[skip ci]`, startet GitHub gar keinen PR-Lauf – auch nicht, wenn das Label danach gesetzt wird.
- **Lauf auslösen:** bevorzugt per Commit mit `[ci:art]` (ein leerer Commit genügt:
  `git commit --allow-empty -m "chore(P9.18a): run art-qa [ci:art]"`, dann push). Er startet nur `art-qa.yml`, keinen
  `quick` und keine Prüf-Jobs aus `ci-full.yml` (ARCHITEKTUR §6.2, §6.7 Nr. 2). Gleichwertig: Label `art` am eigenen PR setzen, solange der
  Kopf-Commit kein `[skip ci]` trägt (`gh pr edit <nr> --add-label art`; fehlt das Label im Repository, vorher
  `gh label create art`), oder `gh workflow run art-qa.yml --ref <branch>`, sobald `art-qa.yml` auf `main` liegt.
  Kriterium der Aufgaben: ein Lauf per `[ci:art]`, Label **oder** `workflow_dispatch` ist durchgelaufen.
- **Wie oft:** P9 ist von der Regel „höchstens ein Zwischenlauf je Phase“ ausgenommen; die Zahl der CI-Läufe begrenzt die
  Obergrenze aus §6.6 Nr. 6 (höchstens 12 Iterationen). Nötig ist ein CI-Lauf nur für Bündel, die aus CI stammen müssen
  (abschließende Iteration ohne WebKit in der Session, End-Bündel nach §8); Zwischen-Iterationen laufen lokal. Meldet der
  Minuten-Wächter `CI_MINUTES_LIMIT=reached` (ARCHITEKTUR §6.8), gibt es keine eigenen `[ci:art]`-Läufe mehr: Dann setzt
  die Session vor dem Phasenende-Commit das Label `art`, sodass `art-qa.yml` einmal mit dem Phasenende läuft.
- **Label entfernen:** Das Label spätestens nach P9.19 wieder entfernen (`gh pr edit <nr> --remove-label art`),
  sonst startet jeder Push ohne `[skip ci]` einen weiteren Lauf (Minuten-Budget, ARCHITEKTUR §6.8).
- Schritte: Install (Cache) → Postgres-Service → `pnpm payload migrate` → `pnpm seed` → `pnpm art:build` → `pnpm start &` →
  `pnpm art:record` → `pnpm art:metrics` → `pnpm art:sheets` → `pnpm art:check` (Gate) → `pnpm art:bundle` → ältere
  `art-qa-*` löschen → `actions/upload-artifact` (grün: Name `art-qa-<lauf-id>`, `retention-days: 30`; rot: Budget-Schritt,
  dann nur `art-qa-check-<lauf-id>`, `retention-days: 2`, §8).
- Laufzeit-Ziel: Aufnahme ≈ 30 min (realistisch auf 4 vCPU), Gate ≤ 45 min Gesamtlauf, Abbruch bei 60 min. Gemessen: Lauf 37303234309 mit 2 Workern 40 min gesamt (Aufnahme 34 min); mit 3 Workern (Lauf 37315719966) 44 min gesamt, aber Kassen-Szenarien SC-06/07/09 kollidierten (Fixture-Bereich 990–999 reicht für 2 Worker) und PF-04 (Build-Zeit) wurde verfälscht. Daher `ART_WORKERS=2` (Workflow, Bild-Läufe); Kassen-Szenarien laufen nach den übrigen Szenarien mit höchstens 2 Workern, der Tempo-Lauf SC-18 (Chromium, ≈ 7 min) allein danach. Größte Posten: SC-14 (≈ 13 min Gerätezeit), SC-18, SC-01.
- Tempo-Läufe (SC-18) nur mit Chromium.
- Ab P9 enthält die reguläre E2E-Suite (`tests/e2e/`, Job `e2e-full` in `ci-full.yml` bei jedem Phasenende `[ci:full pN]`
  und beim Zwischenlauf `[ci:full]`, ARCHITEKTUR §6.4, §6.7) als schnelle Teilmenge: DESIGN AK-DS-09, -11, -13, -14 und
  §5 LG-01 für R01 (Projekt `pixel-7`, ohne Video). Das verhindert, dass spätere Phasen die Kunst-Abnahme unbemerkt brechen.
- Die Review-Subagenten laufen **nicht** in CI, sondern in der P9-Session über dem lokalen Bündel (oder dem heruntergeladenen
  CI-Bündel).

---

## 10. Abschluss P9 und Übergabe

1. PASS-Iteration protokolliert, `INDEX.md` aktualisiert, End-Bündel hochgeladen.
2. `docs/FORTSCHRITT.md`-Eintrag für Jutta (du-Form, ohne Fachjargon): „Die Zeichnungen und Animationen sind fertig und dreifach
   geprüft. Die Videos kannst du dir hier ansehen: {Link zum CI-Artefakt, 30 Tage gültig}.“
3. Offene Minor-Befunde und etwaige Vereinfachungen stehen in `docs/OFFENE-PUNKTE.md`.
4. **Für P11 (gemeinsam mit Jutta, echte Geräte), Checkliste:**
   - Startseite, Shop, Produktseite, Danke-Seite im **Instagram-In-App-Browser** auf ihrem iPhone und einem Android-Gerät
     ansehen (Link per DM an sich selbst schicken).
   - Coco: „Ist das Coco?“ – Jutta entscheidet; Korrekturen an Ohren, Farbe, Geschirr als Nacharbeit.
   - Stationszeichnungen nach dem Instagram-Datenexport neu vektorisieren (`pnpm art:vectorize`) und SC-13 wiederholen.
   - „Bewegung reduzieren“ am Handy einschalten und die Startseite prüfen.
5. P10 übernimmt die schnelle Teilmenge (§9) als Dauer-Gate.
