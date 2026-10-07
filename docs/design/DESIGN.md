# DESIGN – Designsystem, Tuschelinie, Coco und Bewegung

> **Stand:** 26.09.2026 · **Version:** 1.1 (P0, an ARCHITEKTUR angeglichen; Abgleich der P0-Dokumente vom 26.09.2026) · **Status:** verbindlich für P2–P10
> **Zuständigkeit (KONZEPT §0.1):** Aussehen, Farben, Schriften, Layout, Komponenten-Optik, Tuschelinie, Coco, Bewegung, Bildwelt.
> Verhalten, Umfang, Routen und Knopftexte regelt `docs/KONZEPT.md`; rechtliche Formulierungen regelt `docs/recht/`.
> **Rang:** `docs/ENTSCHEIDUNGEN.md` > dieses Dokument (gleichrangig mit KONZEPT, DATENMODELL, ARCHITEKTUR, RECHT je Zuständigkeit) > `PLAN.md` > `docs/research/`.
> **Setzt um:** E-70 … E-80, dazu E-07, E-12, E-14, E-15, E-22, E-43, E-44, E-60, E-63, E-64, E-75, E-76, E-98.
> **Prüfverfahren für P9:** `docs/design/KUNST-QA.md`.

---

## Inhalt

0. [Lesehilfe](#0-lesehilfe)
1. [Leitsätze](#1-leitsätze)
2. [Was wir aus Juttas Arbeiten ableiten](#2-was-wir-aus-juttas-arbeiten-ableiten)
3. [Farben](#3-farben)
4. [Typografie](#4-typografie)
5. [Raum, Raster, Ebenen](#5-raum-raster-ebenen)
6. [Formen, Linien, Schatten, Texturen, Icons](#6-formen-linien-schatten-texturen-icons)
7. [Token-Datei](#7-token-datei)
8. [Komponenten](#8-komponenten)
9. [Tuschelinie-Engine](#9-tuschelinie-engine)
10. [Coco](#10-coco)
11. [Bewegung](#11-bewegung)
12. [Bildwelt](#12-bildwelt)
13. [Umsetzung nach Phasen und Abnahme](#13-umsetzung-nach-phasen-und-abnahme)
- [Anhang A – Annahmen und bewusst nicht übernommene Recherche-Empfehlungen](#anhang-a--annahmen-und-bewusst-nicht-übernommene-recherche-empfehlungen)

---

## 0. Lesehilfe

- **MUSS / SOLL / KANN** wie KONZEPT §0.2. Unklares → konservativste Variante, Eintrag in `docs/OFFENE-PUNKTE.md` (E-97).
- **[Annahme]** = Standardwert ohne Entscheidung der Inhaberin, gesammelt in Anhang A (IDs `DA-n`).
- **IDs dieses Dokuments:** Komponenten `KO-nn` (§8), Mikro-Interaktionen `MI-nn` (§11.5), Akzeptanzkriterien `AK-DS-nn`,
  Annahmen `DA-n`. `K-nn` ohne Zusatz gibt es hier nicht (Kanzleifragen heißen „Kanzleifrage K-nn“, KONZEPT-Annahmen `KA-nn`).
- **Akzeptanzkriterien** dieses Dokuments heißen `AK-DS-<Nr>`; jedes ist automatisiert prüfbar (Vitest/Playwright), sonst als „manuell/QA“ markiert (dann gilt KUNST-QA.md).
- **Maße** in CSS-Pixeln. „mobil“ = Breite < 768 px, „Tablet“ = 768–1199 px, „Desktop“ ≥ 1200 px.
- **Referenz-Viewports:** 360×780 (kleines Android), 390×844 (Playwright-Projekt `iphone-15`), 393×852 (iPhone-15-Bildschirm, KUNST-QA `art-iphone15`), 412×915 (Pixel 7, Projekt `pixel-7`), 768×1024, 1440×900 (Projekt `desktop`). Untergrenze 320 px Breite ohne horizontales Scrollen. Playwright-Projekte laut ARCHITEKTUR §7.3.
- **Code-Bezeichner** englisch (Komponenten PascalCase, Tokens `--kebab-case`, Verhaltensmodule kebab-case = `data-behavior`). **Ordner, Skriptnamen (`pnpm …`) und Umgebungsvariablen** sind in `docs/ARCHITEKTUR.md` verbindlich (§2.1 Baum, §2.2 Importregeln, §5.2 Variablen, §6.10 Skripte, §7.3 Playwright-Projekte); dieses Dokument verwendet diese Namen. Dateinamen innerhalb der Ordner sind Vorschläge; Inhalt und Verhalten bleiben gleich. Der Ordner `src/art/` (SVG-Quellen, die der Code einbindet: `icons/`, `coco/`, `stations/`, `space/`, `placeholders/`) steht nicht im ARCHITEKTUR-Baum; für ihn gilt dieses Dokument.
- **Stack-Stand P0:** Next.js 16.3.6 (P1 hebt auf ≥ 16.3.7, ARCHITEKTUR §1.1), React 19.2.6, Payload 3.90.2, Playwright 1.58.2 (siehe `package.json`). next-intl kommt in P2 (ARCHITEKTUR §1.2). GSAP ist optional und wird standardmäßig **nicht** verwendet (§9.10, DA-4).

---

## 1. Leitsätze

1. **Hell: Papier und Ton** (E-74). Die Oberfläche bleibt ruhig; die Farbe steckt in Juttas Fotos und Zeichnungen.
2. **Die Tuschelinie ist immer tuscheschwarz** `#1C1A17` (E-73). Sie ist Schmuck: `aria-hidden`, nie klickbar, nie der einzige Weg.
3. **Die Linie ist Cocos Leine** (E-71). Wo sich die Linie bewegt, ist Coco an der Spitze. Auf Ruheseiten ist Coco still oder fehlt.
4. **Jede Seite hat die Linie** (E-72), in der Form ihres Seitentyps (Presets, §9.7).
5. **Bewegung mittel** (E-78): verspielt auf Startseite, im Menü, auf Danke- und 404-Seite und in kleinen Momenten. Shop ruhig und schnell. Warenkorb, Kasse, Bestellstatus, Widerruf, Rechtstexte und Verwaltung **ohne Animation**.
6. **Handgemacht statt geometrisch:** keine perfekten Kreise, keine spiegelsymmetrischen Figuren, keine weichgezeichneten Schatten, keine Standard-Easings (`ease`, `ease-in-out`).
7. **Lesbarkeit vor Kunst:** Text mindestens 4,5:1 (groß 3:1). Linie und Coco überdecken nie Text oder Bedienelemente.
8. **„Bewegung reduzieren“ heißt Stillstand:** Linie fertig gezeichnet, Coco still, keine Übergänge.
9. **Pflichtlinks unten auf jeder Seite**, „Vertrag widerrufen“ hervorgehoben (E-44, KONZEPT §3.0.3).
10. **Nur drei Familien (vier Dateien):** Spectral (+ Spectral Italic als Akzent-Schrift), Bricolage Grotesque, IBM Plex Mono, selbst gehostet (E-79, U-10). Die frühere Handschrift Mansalva ist entfernt.
11. **Tempo zuerst:** Animationscode lädt nach dem LCP, bleibt im Budget (§9.10) und erzeugt 0 Layoutverschiebung.
12. **Juttas Strich ist die Messlatte** (E-76, E-80). Referenzen: `content/seed/instagram/post-DbJ1QRrjCcb.jpg` (Kelch) und `post-DaJH_kADpsK.jpg` (zwei Figuren).

---

## 2. Was wir aus Juttas Arbeiten ableiten

Gesichtet am 26.09.2026: alle 22 Bilder in `content/seed/instagram/` (Beiträge max. 640 px, Highlights 150 px).

| Merkmal | Beobachtung | Folge für das Design |
|---|---|---|
| Strich | Fineliner, fast gleich dick (Monoline), leicht zittrig mit niedriger Frequenz; Konturen oft doppelt nachgezogen (Kelchrand, Kelchfuß); Linienenden offen oder überstehend; Ecken weich | Tuschelinie und Coco: Monoline mit nur leichter Breitenvariation (±15 %), Zittern, offene Enden, gelegentliche Doppelkontur |
| Schatten und Flächen | Dichte Parallelschraffur (Kelch rechts), chaotisches Gekritzel für Haare, keine Verläufe | „Schatten“ im UI = Schraffur (§6.3), dunkle Flächen = Gekritzel oder Vollfläche |
| Figuren | Naiv, freie Proportionen; Tiere mit großen „Kulleraugen“ (weißes Oval, schwarzer Punkt, oft versetzt), lange Schnauzen, 2–3 lange Schnurrhaar-Striche (Keramikschalen, Fuchs-Aquarell, Cap-Wesen) | Coco-Augen groß und dunkel mit Glanzpunkt; Platzhalter-Zeichnungen im selben naiven Ton |
| Farbe | Flache Deckfarbe hinter der Linie (Keramik grau, Cap-Wesen rot-orange), Aquarell mit weichen Rändern (Fuchs, Reh) | Im Web nur **flache** Farbflächen („Washes“) hinter der Linie, leicht versetzt |
| Handschrift | Verbundene Schreibschrift mit langen Ober-/Unterlängen (Fliese, Cap „sometimes“, Schälchen) | Keine eigene Font (E-79); Spectral Italic (U-10) ersetzt sie |
| Untergründe | Grüne Schneidematte mit cm-Raster, Papier, Holz; Tageslicht mit harten Schatten | Zartes Schneidematten-Raster als Seitengrund (E-74); Fotos auf Matte/Papier (§12.1) |
| Coco | Siehe §10.1 | Charakterblatt |

---

## 3. Farben

### 3.1 Finale Farb-Tokens mit gemessenen Kontrasten

Kontrast nach WCAG 2.2 (relative Luminanz), neu berechnet am 06.10.2026 (P12.2, U-11/U-12: helles Olivgrün mit Verlauf nach Petrol). Spalten: **Papier** = `--paper` (Seitengrund am Seitenanfang), **Papier-2** = `--paper-2` (Karten, Preisschilder, Fußbereich), **Raster** = Farbe einer Raster-Hauptlinie auf Papier (`#D6DFC2`, §3.4), **Verlauf-Ende** = `--paper-deep` (Grund am Seitenende, §3.5; der Verlauf liegt zwischen Papier und Verlauf-Ende, jede Zwischenfarbe ist heller als dieses Ende, ein Text-Token besteht also im ganzen Verlauf). Formularfelder (`--paper-field`) sind heller als Papier und damit immer mindestens so kontrastreich.

| Token | Hex | Rolle | Papier | Papier-2 | Raster | Verlauf-Ende | Freigabe |
|---|---|---|---|---|---|---|---|
| `--paper` | `#E6EACD` | Seitengrund oben (helles Olivgrün) | – | – | – | – | Grund |
| `--paper-deep` | `#BDD6CE` | Seitengrund unten (Petrol-Hauch), Ende des Scroll-Verlaufs | – | – | – | – | Grund |
| `--paper-2` | `#DCE2C2` | Karten, Preisschild, Fußbereich, Callouts | – | – | – | – | Grund |
| `--paper-field` | `#F8F9EC` | Formularfelder, Lightbox-Grund | – | – | – | – | Grund |
| `--ink` | `#1C1A17` | **Tuschelinie**, Text, Icons | 14,07 | 12,98 | 12,56 | 11,31 | Text jeder Größe |
| `--ink-2` | `#4B463F` | Sekundärtext, Meta, Feldränder | 7,57 | 6,99 | 6,76 | 6,09 | Text jeder Größe; UI-Ränder |
| `--ink-3` | `#524C43` | Platzhaltertext in Feldern, deaktiviert | 6,88 | 6,35 | 6,14 | 5,53 | Text jeder Größe (nur diese Rollen) |
| `--clay` | `#CBBBA2` | Trennlinien, Deko-Ränder | 1,52 | 1,41 | 1,36 | 1,22 | **nur Deko** (nie Text, nie einzige Grenze eines Bedienelements) |
| `--mat` | `#2F6B4C` | Schneidematten-Raster, grüne Flächen | – | – | – | – | **nur Deko/Fläche** (kein Text mehr; Links sind `--petrol`) |
| `--petrol` | `#0F4C57` | **Akzent (U-12):** Links, Primärknöpfe, „sold“-Stempel, Fokus-Grundton | 7,76 | 7,16 | 6,93 | 6,24 | Text jeder Größe |
| `--petrol-deep` | `#0A3841` | Hover, Fokusring | 10,28 | 9,49 | 9,18 | 8,26 | Text jeder Größe; Fokusring |
| `--fox` | `#AA4515` | Deko-Akzente (Warenkorb-Hinweis) | 4,76 | 4,40 | 4,25 | 3,83 | **nur Text ≥ 24 px** (groß, ≥ 3:1) oder Deko |
| `--fox-text` | `#843709` | Hinweistext in Fuchs, Countdown < 1 min | 6,72 | 6,20 | 6,00 | 5,40 | Text jeder Größe |
| `--stencil` | `#4638A8` | Info-Badges (Deko-Hinweis), Flash-Status | 7,11 | 6,57 | 6,35 | 5,72 | Text jeder Größe |
| `--pink` | `#E58FB0` | Cap-Pink, kleine Flächenakzente | 1,91 | 1,77 | 1,71 | 1,54 | **nur Fläche/Deko** |
| `--warn` | `#714300` | Warnhinweise, Countdown < 5 min | 6,79 | 6,27 | 6,07 | 5,46 | Text jeder Größe |
| `--error` | `#92211A` | Formularfehler | 6,93 | 6,40 | 6,19 | 5,57 | Text jeder Größe |
| `--ok` | `#1B5538` | Erfolgsmeldungen | 7,08 | 6,53 | 6,32 | 5,69 | Text jeder Größe |

Kunst-Farben (nur in Zeichnungen, nie für UI-Text):

| Token | Hex | Rolle | Tusche darauf |
|---|---|---|---|
| `--coco-fur` | `#E2BF8E` | Cocos Fell (Wash) | 9,98 |
| `--coco-harness` | `#C23B2A` | Cocos rotes Geschirr | – (Fläche) |
| `--wash-clay` | `#E3D3BA` | Platzhalter-/Planeten-Wash | 11,82 |
| `--wash-pink` | `#F4CCDA` | Wash | 11,99 |
| `--wash-mat` | `#CFE2D5` | Wash | 12,81 |
| `--wash-sky` | `#D6E4EC` | Wash | 13,37 |

Umgekehrte Kombinationen (Text auf Farbfläche): Papier-Feld auf Petrol 9,01 (Primärknopf) · Papier-Feld auf Petrol-tief 11,94 (Hover) · Papier auf Tusche 14,07 · Papier auf Stencil 7,11 · Papier auf Error 6,93. Weiß (`#FFFFFF`) wird im UI nicht verwendet.

Die Werte stammten ursprünglich aus der Konzeptseite; in P12.2 (U-10 … U-12) wurden Papier, Papier-2 und Papier-Feld auf Olivgrün umgestellt, `--paper-deep` und `--petrol`/`--petrol-deep` neu eingeführt und alle Text-Tokens (`--ink-3`, `--fox-text`, `--stencil`, `--warn`, `--error`, `--ok`) gegenüber dem dunkelsten Grund (Verlauf-Ende) nachgedunkelt, damit sie überall ≥ 4,5:1 halten. `--mat` ist kein Text-Token mehr (Links wurden Petrol).

### 3.2 Regeln

1. **Tuschelinie, Coco-Linien, Preisschild-Schnur, Icons:** immer `--ink`. Keine Transparenz auf der Linie (Deckkraft 1).
2. **Links im Fließtext:** `--petrol` (U-12), unterstrichen (`text-underline-offset: 0.18em`, `text-decoration-thickness: 1px`); Hover/Fokus: Farbe `--ink`, Unterstrich 2px. **Primärknöpfe** (KO-11): Grund `--petrol`, Text `--paper-field`, gedruckter Schatten in `--ink`; Hover Grund `--petrol-deep`. Der „sold“-Stempel steht in `--petrol`. Besuchte Links gleich. Navigationslinks in Kopf und Menü in `--ink` mit gezeichneter Unterstreichung (KO-03, MI-06); Fußbereich-Links in `--ink` mit normaler Unterstreichung (KO-04).
3. **Fokus:** `outline: 3px solid var(--petrol-deep); outline-offset: 2px`. Auf Fotos und dunklen Flächen zusätzlich `box-shadow: 0 0 0 2px var(--paper)` (Papier-Halo). Fokus nie entfernen, nie nur Farbwechsel.
4. **Verboten:** `--fox` für Text < 24 px; `--pink`, `--clay`, Kunst-Farben für Text oder als einzige Grenze eines Bedienelements; farbige Flächen hinter Fließtext außer `--paper-2`, `--paper-field` und den Washes (nur für kurze Labels in `--ink`).
5. **Zustände nie nur über Farbe:** Fehler = Text + Icon; „sold“ = Stempel-Text; aktiv = Unterstreichung + `aria-current`.
6. **Statusfarben:** Erfolg `--ok`, Warnung `--warn`, Fehler `--error`, Info `--stencil`. Fuchs ist **kein** Fehlerrot (Fuchs ist nur Deko-Akzent).

**AK-DS-01** Ein Vitest-Test liest `src/styles/tokens.css`, berechnet für jede Paarung aus §3.1 den Kontrast und schlägt fehl, wenn ein als „Text jeder Größe“ freigegebenes Token gegen Papier, Papier-2, Raster (`#D6DFC2`) oder Verlauf-Ende (`--paper-deep`) unter 4,50 liegt.
**AK-DS-02** Ein Lint-Test durchsucht `src/**/*.{css,scss,tsx}` und schlägt fehl bei `color: var(--fox)` außerhalb der Komponenten `SoldStamp` und `CartLine` (Stempel-Text „sold“ ≥ 24 px, KO-13), bei `color: var(--pink|--clay|--coco-*|--wash-*)` und bei `#FFF`/`#FFFFFF`/`white` als Textfarbe.

### 3.3 Nur hell – Entscheidung zum Dunkelmodus

- **Die Website ist ausschließlich hell** (E-74). Es gibt keinen `prefers-color-scheme: dark`-Zweig und keinen Umschalter.
- `:root { color-scheme: only light; }` und `<meta name="color-scheme" content="only light">` (verhindert automatisches Abdunkeln in Chrome; Samsung Internet kann trotzdem zwangsabdunkeln – bekannte Grenze, wird nicht bekämpft).
- `<meta name="theme-color" content="#E6EACD">`.
- Die Konzeptseite hatte Dunkel-Tokens für ihre eigene Darstellung; sie werden **nicht** übernommen.
- **Verwaltung:** behält das Payload-Standard-Theme (hell/dunkel nach Payload-Einstellung). Eigene Handy-Ansichten (P5) nutzen Payload-CSS-Variablen (`--theme-*`), nicht die Website-Tokens. Einzige Übernahmen: Planet-Marke als Login-Logo und PWA-Icon (§12.6).
- **Erzwungene Farben** (Windows-Kontrastmodus, `@media (forced-colors: active)`): Raster aus, Linie und Coco-Striche `stroke: CanvasText`, Washes und Fell `fill: none`, Fokus `outline-color: Highlight`.
- **Druck** (`@media print`): Raster, Linie, Coco, Kopf-Menüknopf ausblenden; Text `#000` auf Weiß; Links mit URL in Klammern nur in Rechtstexten.

**AK-DS-03** Playwright rendert Startseite, Produktseite und Kasse mit `colorScheme: 'dark'` und `colorScheme: 'light'` bei `reducedMotion: 'reduce'`; die Screenshots sind pixelgleich.

### 3.4 Schneidematten-Raster (Seitengrund)

Zartes Raster wie auf Juttas grüner Matte (E-74): Nebenlinien alle 32 px, Hauptlinien alle 160 px (5 Felder). Die Hauptlinie ist so gewählt, dass sie zusammen mit der darunterliegenden Nebenlinie genau 9 % Matte ergibt. Seit P12.2 liegt das Raster auf dem Verlauf aus §3.5: `body` hat keine eigene Grundfarbe (`transparent`), der Grund kommt von `html`.

```css
body {
  background-color: transparent; /* Grund + Verlauf liegen auf html (§3.5) */
  background-image:
    linear-gradient(var(--grid-line-major) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line-major) 1px, transparent 1px),
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 160px 160px, 160px 160px, 32px 32px, 32px 32px;
  background-position: -1px -1px;
  background-attachment: scroll; /* nie fixed (Repaint beim Scrollen) */
}
```

| Linie | Deckkraft Matte | effektive Farbe auf Papier |
|---|---|---|
| Nebenlinie `--grid-line` | 5 % | `#DDE4C7` |
| Hauptlinie (`--grid-line-major` über Nebenlinie) | 9 % gesamt | `#D6DFC2` |

- Das Raster liegt nur auf `body`. Karten, Preisschilder, Fußbereich, Formularfelder, Menü-Overlay (Papier deckend mit eigenem Raster) und Lightbox decken es ab.
- Kreuzungspunkte (einzelne Pixel) werden für Kontrast nicht gewertet.
- Kein Papierkorn-Bild in P2. P9 DARF ein Papierkorn ergänzen, wenn Prüfer:in R1 (KUNST-QA) es verlangt, nur als Kachel ≤ 12 KB und nur, wenn AK-DS-01 mit der dunkelsten Korn-Farbe weiter besteht.

### 3.5 Seitengrund-Verlauf Olivgrün → Petrol (U-11, P12.2)

- **Grundton:** helles Olivgrün `--paper` (`#E6EACD`). **Verlaufsende:** `--paper-deep` (`#BDD6CE`, Petrol-Hauch) – bewusst nur so dunkel, dass jeder Text-Token (§3.1) und die Tuschelinie auch am Seitenende ≥ 4,5:1 halten; Karten (`--paper-2`), Felder und Menü bleiben deckend hell.
- **Grundfassung (immer):** `html` trägt `linear-gradient(180deg, var(--paper), var(--paper-deep))` über die ganze Dokumentlänge. Der Verlauf scrollt mit dem Inhalt (Leinwand-Hintergrund, kein Layout, kein Repaint) und ist **statisch** bei `prefers-reduced-motion: reduce`, bei `html[data-motion='reduced']` und in Browsern ohne Scroll-Zeitleiste.
- **Verbesserung (CSS-only):** Mit `@supports (animation-timeline: scroll())`, `prefers-reduced-motion: no-preference` und ohne `data-motion='reduced'` legt `html::before` eine feste Fläche (`position: fixed`, `z-index: -1`, Verlauf transparent → `--paper-deep`) hinter den Inhalt, deren **`opacity` 0 → 1** über die Scrollstrecke (`animation-timeline: scroll(root block)`) läuft. Es ist ein einziger Compositor-Layer ohne JavaScript, ohne Layout und Repaint; der Verlauf gehört **nicht** in die Leine-Engine (Budget CO-08/PF-01, Engine ≤ 12 000 B gz unberührt). Wirkt unabhängig von der Seitenlänge: Am Seitenende ist der Grund immer am dunkelsten.
- **Test:** AK-DS-01 prüft alle Text-Tokens gegen Papier, Papier-2, Raster und Verlauf-Ende; `tests/unit/design/page-gradient.unit.spec.ts` prüft die CSS-Regeln (statische Fassung, Scroll-Zeitleiste nur unter `no-preference`, nur `opacity` animiert).

---

## 4. Typografie

### 4.1 Schriften und Dateien

| Rolle | Familie | Quelle (npm, OFL) | Datei (Subset „latin“) | Achsen/Schnitte | Laden |
|---|---|---|---|---|---|
| Display, Überschriften, Menü | **Spectral** | `@fontsource/spectral` (exakt 5.3.0) | `spectral-latin-500-normal.woff2` | 500 (ein Schnitt; Anfragen nach 400/600 treffen ihn ohne Synthese) | kein Preload, `font-display: swap`, nach dem ersten Bild (Schriften-Tor) |
| Akzent: Preisschild, Produktpreis, „sold“, Betonungen | **Spectral Italic** | `@fontsource/spectral` | `spectral-latin-500-italic.woff2` | 500 kursiv (`font-style: italic` ist Pflicht, sonst greift der Schnitt nicht) | wie oben |
| Text, UI, Knöpfe | **Bricolage Grotesque** | `@fontsource-variable/bricolage-grotesque` | `bricolage-grotesque-latin-wght-normal.woff2` | Variable `wght` 200–800 (opsz/wdth auf Standard) | kein Preload, `swap`, nach dem ersten Bild (Schriften-Tor) |
| Nummern, Maße, Preise in Tabellen, Kicker | **IBM Plex Mono** | `@fontsource/ibm-plex-mono` | `ibm-plex-mono-latin-400-normal.woff2` | nur 400 | kein Preload, `swap`, nach dem ersten Bild (Schriften-Tor) |

- Einbindung mit `next/font/local` aus Dateien, die `pnpm fonts:copy` (`scripts/fonts/`, ARCHITEKTUR §6.10) aus `node_modules/@fontsource*` nach `src/styles/fonts/` kopiert; sie werden eingecheckt (reproduzierbar, offline, für die Vorschau-Datei inline-bar). **Nie** Google-Fonts-CDN, auch nicht `next/font/google` (E-43, E-79).
- **Schriften-Tor (P2.20, Tempo-Budget §9.10):** Das erste Bild steht mit den metrisch angeglichenen Ersatzschriften von
  `next/font` (`'spectral Fallback'`, `'spectralItalic Fallback'`, `'bricolage Fallback'`, `'plexMono Fallback'`, kein Netzabruf); zwei Frames später
  werden die vier Webschriften angefordert und per `swap` getauscht. Umsetzung: `html[data-fonts="wait"]` (Regel in
  `global.css`), gesetzt und nach zwei `requestAnimationFrame` (spätestens 2 s) entfernt vom Inline-Skript `pc-motion`
  (`src/lib/security/inlineScripts.ts`). Kein Tor, wenn die Seite von derselben Website aufgerufen wird (Schriften liegen
  im Cache), und ohne JavaScript (Vorschau-Datei, Skripte aus) – dann laden die Schriften sofort. Grund: Mit Preload
  zählen ~100 KB Schriften in Lighthouse (simulierte Drosselung) zum LCP-Pfad der Startseite und reißen das Gate
  „mobil LCP < 2,5 s“; der Tausch kostet eine Neuberechnung des Layouts nach dem ersten Bild (TBT) und CLS ≈ 0,01.
  Die Tuschelinie misst nach jedem Schriftwechsel neu (`document.fonts` `loadingdone`).
- `adjustFontFallback` aktiv (Metrik-Fallback gegen CLS). Fallback-Stapel: Spectral → `'spectral Fallback', Georgia, "Times New Roman", serif` (Fläche `local('Times New Roman'/'Liberation Serif'/'Tinos')` mit `size-adjust` 111,34 % / Kursiv 102,4 %, gemessen mit `fontkit` gegen Liberation Serif); Bricolage → `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`; Plex Mono → `ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`.
- Das Subset „latin“ der Fontsource-Dateien enthält U+0000–00FF, Gedankenstriche, typografische Anführungszeichen, € (U+20AC). Mehr wird nicht geladen.
- `font-synthesis: none` global (kein falsches Fett/Kursiv; Spectral liegt nur als 500 normal und 500 kursiv vor).
- Budget: **genau 4 Dateien, zusammen ≤ 100 KB** (Ist: 73,2 KB). Liegt Bricolage (wght) über 45 KB, beschneidet `pnpm fonts:copy` die Datei mit dem npm-Paket `subset-font` (harfbuzz-wasm, ohne Python; ARCHITEKTUR §1.2) auf `wght 400–700` (Achse `variationAxes: { wght: { min: 400, max: 700 } }`, Zeichenumfang unverändert „latin“, Ausgabe WOFF2).
- Glyphen-Pflicht für Spectral (Überschriften, Preise): `a–z A–Z 0–9 ä ö ü Ä Ö Ü ß € „ “ ‚ ‘ – · , . : ! ? & ' ( ) / %`. Die Pflichtliste ist in beiden Schnitten vollständig (Test); eine Ersatz-Komponente (früher `GlyphFallback`) entfällt.
- Für OG-Bilder (satori, §12.6) liegen TTF-Fassungen von Spectral Italic 500 und Bricolage (statische Instanz 600) in `src/og/fonts/` – werden nie an Browser ausgeliefert. `pnpm fonts:copy` erzeugt sie per Umwandlung aus den WOFF/WOFF2-Dateien der `@fontsource*`-Pakete (Bricolage 600 aus `@fontsource/bricolage-grotesque`; Wandler als npm-DevDependency, ARCHITEKTUR §1.2); **kein** Download von fonts.gstatic.com oder anderen Schrift-Servern.

**AK-DS-04** Build-Test: Summe der ausgelieferten `.woff2` ≤ 100 KB, genau 4 Dateien; kein Request an `fonts.googleapis.com`/`fonts.gstatic.com` auf irgendeiner Route.
**AK-DS-05** Unit-Test mit `fontkit` (oder `opentype.js`) prüft die Glyphen-Pflichtliste gegen beide Spectral-Dateien (U-10: Mansalva und `GlyphFallback` sind entfernt).

### 4.2 Schriftskala

Fluide Größen zwischen 360 px und 1280 px Viewport (`clamp()` mit rem-Anteil, damit Browser-Zoom und Textgröße wirken).

| Token | Schrift | Gewicht | mobil | Desktop | `clamp()` | Zeilenhöhe | Laufweite | Einsatz |
|---|---|---|---|---|---|---|---|---|
| `--fs-display` | Spectral | 500 | 44 | 76 | `clamp(2.75rem, 1.9674rem + 3.4783vw, 4.75rem)` | 1.0 | 0 | H1 Startseite |
| `--fs-h1` | Spectral | 500 | 36 | 56 | `clamp(2.25rem, 1.7609rem + 2.1739vw, 3.5rem)` | 1.05 | 0 | H1 übrige Seiten, Produkttitel |
| `--fs-h2` | Spectral | 500 | 30 | 44 | `clamp(1.875rem, 1.5326rem + 1.5217vw, 2.75rem)` | 1.08 | 0 | Stationen, Abschnitte |
| `--fs-h3` | Bricolage | 700 | 19 | 22 | `clamp(1.1875rem, 1.1141rem + 0.3261vw, 1.375rem)` | 1.3 | −0.005em | Unterabschnitte |
| `--fs-lede` | Bricolage | 400 | 18 | 20 | `clamp(1.125rem, 1.0761rem + 0.2174vw, 1.25rem)` | 1.55 | 0 | Einleitungen |
| `--fs-body` | Bricolage | 400 | 16 | 17 | `clamp(1rem, 0.9755rem + 0.1087vw, 1.0625rem)` | 1.62 | 0 | Fließtext |
| `--fs-small` | Bricolage | 400 | 14 | 15 | `clamp(0.875rem, 0.8505rem + 0.1087vw, 0.9375rem)` | 1.5 | 0 | Hinweise, Fußbereich |
| `--fs-label` | Bricolage | 500 | 15 | 15 | `0.9375rem` | 1.35 | 0 | Formular-Labels, Badges |
| `--fs-button` | Bricolage | 600 | 17 | 17 | `1.0625rem` | 1.2 | 0 | Knöpfe |
| `--fs-kicker` | Plex Mono | 400 | 12 | 13 | `clamp(0.75rem, 0.7255rem + 0.1087vw, 0.8125rem)` | 1.4 | 0.08em, VERSALIEN | „Station 01“, Tabellenköpfe |
| `--fs-meta` | Plex Mono | 400 | 13 | 14 | `clamp(0.8125rem, 0.788rem + 0.1087vw, 0.875rem)` | 1.45 | 0 | `Nr. 017 · Keramik · Ø 14 cm` |
| `--fs-price-mono` | Plex Mono | 400 | 15 | 16 | `clamp(0.9375rem, 0.913rem + 0.1087vw, 1rem)` | 1.4 | 0 | Preise in Korb/Kasse |
| `--fs-total` | Plex Mono | 400 | 18 | 20 | `clamp(1.125rem, 1.0761rem + 0.2174vw, 1.25rem)` | 1.3 | 0 | Gesamtsumme |
| `--fs-price-tag` | Spectral Italic | 500 | 28 | 32 | `clamp(1.75rem, 1.6522rem + 0.4348vw, 2rem)` | 1.0 | 0 | Preis auf Preisschild |
| `--fs-price-pdp` | Spectral Italic | 500 | 36 | 44 | `clamp(2.25rem, 2.0543rem + 0.8696vw, 2.75rem)` | 1.0 | 0 | Preis Produktseite |
| `--fs-stamp` | Spectral Italic | 500 | 24 | 28 | `clamp(1.5rem, 1.4022rem + 0.4348vw, 1.75rem)` | 1.0 | 0.02em | „sold“ |
| `--fs-menu` | Spectral | 500 | 36 | 48 | `clamp(2.25rem, 1.9565rem + 1.3043vw, 3rem)` | 1.1 | 0 | Menü-Hauptlinks |
| `--fs-wordmark` | (SVG, §12.6) | – | 24 | 28 | `clamp(1.5rem, 1.4022rem + 0.4348vw, 1.75rem)` | 1 | – | Höhe der Wortmarke |

### 4.3 Regeln

1. **Spectral** (normal) nur für Überschriften H1/H2, Menü-Hauptlinks; **Spectral Italic** nur für Preisschild-Preis, Produktpreis, Stempel, Betonungen (Akzent-Schrift, U-10). Anzeige-Größen ab 16 px (Prüfung LG-03), nie für Fließtext, Formulare, Knöpfe, Rechtstexte, Tabellen, Kasse.
2. **Kasse, Warenkorb, Rechtstexte, Widerruf:** H1 in Spectral erlaubt, alles andere Bricolage/Plex Mono. Preise dort in Plex Mono.
3. Ziffern in Tabellen und Summen: `font-variant-numeric: tabular-nums` (Plex Mono ist ohnehin monospaced).
4. Zeilenlänge Fließtext ≤ 66ch, Rechtstexte ≤ 72ch.
5. Überschriften `text-wrap: balance`; Fließtext `text-wrap: pretty`; `hyphens: auto` mit korrektem `lang` (DE-Texte haben lange Komposita).
6. Kleinste Schrift: 12 px (nur Kicker in Versalien). Pflichtangaben (Preis-Hinweis, GPSR-Block, Fußbereich) mindestens 14 px.
7. „sold“ ist ein englisches Wort auch auf DE-Seiten: `<span lang="en">sold</span>`.

### 4.4 Zahlen und Preise

Formate laut KONZEPT §0.4: DE `53,90 €`, EN `€53.90`; Objektnummer `Nr. 017` / `No. 017`.
- **Preisschild** (Spectral Italic): ganze Euro ohne Nachkommastellen (`45 €`, EN `€45`), sonst mit (`38,50 €`). Sternchen `*` direkt am Preis, Fußnote gemäß KONZEPT §3.4.
- **Korb, Kasse, Rechnungsbezüge** (Plex Mono): immer mit zwei Nachkommastellen, rechtsbündig.
- Formatierung zentral über `formatMoney(cents, locale, { style: 'tag' | 'full' })` aus `src/lib/money.ts` (einzige Formatierfunktion für Beträge, ARCHITEKTUR §15.4; Standard `style: 'full'`) mit `Intl.NumberFormat` (`de-DE`; EN `en-IE` ergibt `€53.90`).

---

## 5. Raum, Raster, Ebenen

### 5.1 Abstands-Skala („Millimeter-Raster“, Basis 4 px)

| Token | px | typischer Einsatz |
|---|---|---|
| `--space-1` | 4 | Icon-Abstand, Badge-Innenrand vertikal |
| `--space-2` | 8 | enge Gruppen |
| `--space-3` | 12 | Rasterabstand mobil |
| `--space-4` | 16 | Seitenrand mobil, Standardabstand |
| `--space-5` | 24 | Abschnittsinneres, Seitenrand Tablet |
| `--space-6` | 32 | zwischen Blöcken, Seitenrand Desktop |
| `--space-7` | 48 | zwischen Abschnitten mobil |
| `--space-8` | 64 | zwischen Abschnitten Desktop, Stationsabstand mobil |
| `--space-9` | 96 | Stationsabstand Desktop |

### 5.2 Seitenränder und Breiten

| Token | mobil | Tablet | Desktop |
|---|---|---|---|
| `--page-pad` (seitlich) | 16 | 24 | 32 |
| `--content-max` | – | – | 1200 |
| `--reading-max` | 66ch | 66ch | 66ch |
| `--header-h` | 56 | 64 | 64 |
| `--tap-min` | 44 | 44 | 44 |

Breakpoints (min-width): `768px`, `1200px`. Keine weiteren, außer lokal `@container` in Komponenten.

### 5.3 Linien-Rinne (Gutter)

Die Tuschelinie läuft auf manchen Seitentypen in einer eigenen linken Rinne. Der Inhalt beginnt rechts davon.

| Preset (§9.7) | Rinne mobil | Rinne ab 768 | Linie bei x = |
|---|---|---|---|
| `journey`, `about` | 44 | 64 | Rinnenmitte ± Schwung |
| `legal`, `margin` | 16 (liegt im Seitenrand, kein Extra-Platz) | 24 | 7 bzw. 11 |
| alle anderen | 0 | 0 | im Inhalt/Zwischenräumen |

### 5.4 Inhalts- und Shop-Raster

- Inhaltsraster: 4 Spalten mobil (Abstand 12), 8 Spalten Tablet (Abstand 20), 12 Spalten Desktop (Abstand 24).
- **Shop-Raster:** 2 Spalten mobil, 3 ab 768, 4 ab 1200; Spaltenabstand = Rasterabstand; Zeilenabstand 32 (mobil) / 48 (Desktop), damit Preisschild und Titel Platz haben.
- **Produktseite:** mobil einspaltig; ab 1200 Galerie 7/12, Info 5/12 (Info-Spalte `position: sticky; top: calc(var(--header-h) + 16px)`).
- **Startseite:** `max-width: 1040px`, Rinne links; Stationen mobil einspaltig, ab 1200 zweispaltig (Text/Bild abwechselnd).

### 5.5 Ebenen (z-index)

| Token | Wert | Element |
|---|---|---|
| `--z-leash` | 5 | Linien-Ebene und Coco (über Inhalt, `pointer-events: none`) |
| `--z-sticky` | 40 | Kauf-Leiste Produktseite |
| `--z-header` | 50 | Kopfleiste |
| `--z-skip` | 1000 | Skip-Link |
| Dialoge | Top-Layer | Menü, Lightbox (`<dialog>`, kein z-index nötig) |

### 5.6 Sticky-Elemente und Fokus

- Kopfleiste ist `position: sticky; top: 0`. Deshalb `html { scroll-padding-top: calc(var(--header-h) + 8px); }`.
- Wenn die Kauf-Leiste (KO-09a) sichtbar ist: `scroll-padding-bottom: calc(var(--buybar-h) + 8px)` (WCAG 2.4.11, Fokus nicht verdeckt).
- `scroll-behavior: smooth` nur unter `@media (prefers-reduced-motion: no-preference)` und nie auf Ruheseiten (§11.6).

---

## 6. Formen, Linien, Schatten, Texturen, Icons

### 6.1 Radien („Hand-Radien“)

Unregelmäßige Radien geben Kästen einen gezeichneten Rand, ohne SVG-Kosten.

| Token | Wert | Einsatz |
|---|---|---|
| `--r-photo` | `2px` | Fotos (wie Abzüge) |
| `--r-field` | `6px 5px 7px 5px` | Formularfelder |
| `--r-btn` | `14px 12px 15px 11px` | Knöpfe, Chips |
| `--r-badge` | `12px 10px 13px 9px` | Badges |
| `--r-card` | `3px 14px 4px 12px` | Kästen, Callouts |
| `--r-tag` | `4px 4px 14px 4px` | Preisschild-Fallback ohne SVG |
| `--r-sheet` | `255px 15px 225px 15px / 15px 225px 15px 255px` | große „handgezeichnete“ Kästen (Menü-Blatt, Danke-Karte) |
| `--r-calm` | `8px` | **nur** Kasse: Knopf „Zahlungspflichtig bestellen“, Zahlungsfeld-Rahmen |

### 6.2 Linienstärken

| Token | Wert | Einsatz |
|---|---|---|
| `--stroke-hair` | 1px | Deko-Trenner (`--clay`) |
| `--stroke-ui` | 1.5px | Feldränder (`--ink-2`), Chips, Preisschild-Kontur, Schnur-Faden |
| `--stroke-ink` | 2px | Kästen in Tusche, Unterstreichungen |
| `--stroke-stamp` | 2.5px | Stempelrahmen |
| `--leash-w` | 2.2px mobil / 2.6px ab 768 | Grundbreite der Tuschelinie (§9.4) |
| `--leash-w-calm` | 1.25px | Ruhelinie (Presets `calm`, `legal`) |

### 6.3 Schatten – nur „gedruckt“ oder „schraffiert“

**Verboten:** jeder `box-shadow`/`drop-shadow` mit Unschärfe > 0 (keine generischen Schlagschatten).

| Token/Utility | Wert | Einsatz |
|---|---|---|
| `--shadow-press` | `3px 3px 0 0 var(--ink)` | Primärknopf „In den Korb“ (versetzter Druck) |
| `--shadow-press-active` | `1px 1px 0 0 var(--ink)` | Primärknopf gedrückt |
| `--shadow-edge` | `0 1px 0 0 var(--clay)` | Papierkante (Kästen auf Papier) |
| `--shadow-stencil` | `3px 2px 0 0 var(--stencil)` | nur Tattoo: Flash-Karte bei Hover/Fokus („Schablonen-Abdruck“) |
| `.u-hatch-shadow` | Pseudo-Element mit SVG-Schraffur (Linien 1px `--ink`, Abstand 5px, 40°, Deckkraft 0.3), versetzt `translate(4px, 5px)`, `z-index: -1` | Preisschild, Danke-Karte, Station-Zeichnungen |

Schraffur-Muster als Inline-SVG-Data-URI (≤ 300 Byte), kein Bild-Request.

**AK-DS-06** Lint-Test: in `src/**/*.{css,scss,tsx}` kein `box-shadow`, `text-shadow` oder `filter: drop-shadow` mit drittem Längenwert ≠ 0.

### 6.4 Texturen und Filter

- Erlaubt: Schneidematten-Raster (§3.4), Schraffur (§6.3), Washes als Flächen in SVGs.
- `filter: url(#ink-rough)` (feTurbulence `baseFrequency 0.9`, `numOctaves 1`, feDisplacementMap `scale 0.8`) **nur** auf statischen Elementen ≤ 200×200 px: Stempel, Stationsmarken, Planet der Wortmarke. **Nie** auf der Tuschelinie, auf Coco oder auf animierten Elementen. Definiert einmal im `AppShell` in einem versteckten `<svg width="0" height="0" aria-hidden="true">` zusammen mit dem Schraffur-Muster.
- `mix-blend-mode: multiply` nur auf dem Stempel (druckt „ins“ Schild).

### 6.5 Icons

- Eigenes, handgezeichnetes Set, 24×24-viewBox, Strich 1.75 Einheiten, `stroke-linecap: round`, `stroke-linejoin: round`, Farbe `currentColor`, leicht wackelig (kein Icon-Font, keine Fremd-Bibliothek).
- Bestand (P2): `basket` (Flohmarkt-Papiertüte mit Henkeln), `menu` (drei ungleich lange Striche), `close`, `arrow-right`, `arrow-left`, `external`, `mail`, `instagram` (Kamera-Umriss, **kein** Instagram-Logo), `copy`, `zoom`, `check`, `warn`, `info`, `planet`, `star`, `truck`, `pickup` (Häuschen), `withdraw` (Pfeil zurück im Kreis). Ab P3 (Badges KO-10): `clock` (Uhr, „reserviert“), `plate-off` (Teller durchgestrichen, Deko-Hinweis).
- Icons sind `aria-hidden="true"`; jede Bedienung hat sichtbaren Text oder, nur bei Galerie-Pfeilen und Lightbox-Schließen, ein `aria-label`.
- Dateien: `src/art/icons/*.svg` (Quelle), je ≤ 600 Byte, eingebunden als **Inline-SVG-React-Komponenten** in
  `src/components/icons/` (Komponente `Icon`, SVG steht direkt im HTML) – kein externes Icon-Sprite, kein `<use href>`. So bleiben sie auch in der Vorschau-Datei
  ohne Umwandlung inline (ARCHITEKTUR §14.5).

---

## 7. Token-Datei

P2 legt `src/styles/tokens.css` exakt mit diesem Inhalt an (Werte sind verbindlich; Ergänzungen nur additiv und hier nachtragen).

```css
/* src/styles/tokens.css – Planet Claire Designsystem v1.0 (DESIGN.md §7) */
:root {
  color-scheme: only light;

  /* Grund */
  --paper: #E6EACD;           /* helles Olivgrün, Seitenanfang (U-11) */
  --paper-deep: #BDD6CE;      /* Petrol-Hauch, Verlaufsende am Seitenende (U-11) */
  --paper-2: #DCE2C2;
  --paper-field: #F8F9EC;
  --grid-line: rgb(47 107 76 / 0.05);
  --grid-line-major: rgb(47 107 76 / 0.042);

  /* Tusche und Ton */
  --ink: #1C1A17;
  --ink-2: #4B463F;
  --ink-3: #524C43;
  --clay: #CBBBA2;

  /* Akzente */
  --mat: #2F6B4C;             /* nur noch Schneidematten-Raster und Flächen, kein Text */
  --petrol: #0F4C57;          /* Akzent: Links, Knöpfe, Stempel (U-12) */
  --petrol-deep: #0A3841;     /* Hover und Fokus */
  --fox: #AA4515;
  --fox-text: #843709;
  --stencil: #4638A8;
  --pink: #E58FB0;
  --warn: #714300;
  --error: #92211A;
  --ok: #1B5538;

  /* Kunst */
  --coco-fur: #E2BF8E;
  --coco-harness: #C23B2A;
  --wash-clay: #E3D3BA;
  --wash-pink: #F4CCDA;
  --wash-mat: #CFE2D5;
  --wash-sky: #D6E4EC;

  /* Semantik */
  --color-bg: var(--paper);
  --color-surface: var(--paper-2);
  --color-text: var(--ink);
  --color-text-muted: var(--ink-2);
  --color-link: var(--petrol);
  --color-focus: var(--petrol-deep);
  --color-line: var(--ink);
  --color-sold: var(--petrol);
  --color-border-ui: var(--ink-2);
  --color-border-deco: var(--clay);

  /* Schriften (Familien setzt next/font als Variablen) */
  --font-display: var(--font-spectral), Georgia, "Times New Roman", serif;
  --font-accent: var(--font-spectral-italic), Georgia, "Times New Roman", serif;
  --font-body: var(--font-bricolage), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;

  --fs-display: clamp(2.75rem, 1.9674rem + 3.4783vw, 4.75rem);
  --fs-h1: clamp(2.25rem, 1.7609rem + 2.1739vw, 3.5rem);
  --fs-h2: clamp(1.875rem, 1.5326rem + 1.5217vw, 2.75rem);
  --fs-h3: clamp(1.1875rem, 1.1141rem + 0.3261vw, 1.375rem);
  --fs-lede: clamp(1.125rem, 1.0761rem + 0.2174vw, 1.25rem);
  --fs-body: clamp(1rem, 0.9755rem + 0.1087vw, 1.0625rem);
  --fs-small: clamp(0.875rem, 0.8505rem + 0.1087vw, 0.9375rem);
  --fs-label: 0.9375rem;
  --fs-button: 1.0625rem;
  --fs-kicker: clamp(0.75rem, 0.7255rem + 0.1087vw, 0.8125rem);
  --fs-meta: clamp(0.8125rem, 0.788rem + 0.1087vw, 0.875rem);
  --fs-price-mono: clamp(0.9375rem, 0.913rem + 0.1087vw, 1rem);
  --fs-total: clamp(1.125rem, 1.0761rem + 0.2174vw, 1.25rem);
  --fs-price-tag: clamp(1.75rem, 1.6522rem + 0.4348vw, 2rem);
  --fs-price-pdp: clamp(2.25rem, 2.0543rem + 0.8696vw, 2.75rem);
  --fs-stamp: clamp(1.5rem, 1.4022rem + 0.4348vw, 1.75rem);
  --fs-menu: clamp(2.25rem, 1.9565rem + 1.3043vw, 3rem);
  --fs-wordmark: clamp(1.5rem, 1.4022rem + 0.4348vw, 1.75rem);

  /* Raum */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px; --space-5: 24px;
  --space-6: 32px; --space-7: 48px; --space-8: 64px; --space-9: 96px;
  --page-pad: 16px;
  --content-max: 1200px;
  --reading-max: 66ch;
  --header-h: 56px;
  --tap-min: 44px;
  --buybar-h: 72px;
  --leash-gutter: 0px;          /* je Preset überschrieben, §5.3 */

  /* Formen */
  --r-photo: 2px;
  --r-field: 6px 5px 7px 5px;
  --r-btn: 14px 12px 15px 11px;
  --r-badge: 12px 10px 13px 9px;
  --r-card: 3px 14px 4px 12px;
  --r-tag: 4px 4px 14px 4px;
  --r-sheet: 255px 15px 225px 15px / 15px 225px 15px 255px;
  --r-calm: 8px;
  --stroke-hair: 1px; --stroke-ui: 1.5px; --stroke-ink: 2px; --stroke-stamp: 2.5px;
  --leash-w: 2.2px;
  --leash-w-calm: 1.25px;
  --shadow-press: 3px 3px 0 0 var(--ink);
  --shadow-press-active: 1px 1px 0 0 var(--ink);
  --shadow-edge: 0 1px 0 0 var(--clay);
  --shadow-stencil: 3px 2px 0 0 var(--stencil);

  /* Coco */
  --coco-leash: 70px;          /* Breite an der Leinenspitze (+25 %, U-05) */
  --coco-s: 40px;
  --coco-m: 72px;
  --coco-xl: 180px;
  --coco-xxl: 240px;
  --coco-stroke: 1.6px;

  /* Bewegung (§11) */
  --ease-ink-out: cubic-bezier(0.3, 0.7, 0.2, 1);
  --ease-ink-in: cubic-bezier(0.5, 0, 0.75, 0.2);
  --ease-ink-inout: cubic-bezier(0.6, 0, 0.3, 1);
  --ease-stamp: cubic-bezier(0.18, 1.6, 0.4, 1);
  --ease-hop-up: cubic-bezier(0.15, 0.75, 0.35, 1);
  --ease-hop-down: cubic-bezier(0.55, 0, 0.85, 0.35);
  --ease-swing: cubic-bezier(0.45, 0, 0.55, 1);
  --ease-calm: cubic-bezier(0.2, 0, 0, 1);
  --dur-micro: 120ms;
  --dur-short: 200ms;
  --dur-medium: 320ms;
  --dur-long: 600ms;
  --dur-draw: 1800ms;
  --dur-draw-max: 2400ms;
  --dur-page: 350ms;
  --dur-underline: 280ms;
  --dur-swing: 900ms;
  --dur-stamp: 260ms;
  --dur-hop: 360ms;
  --dur-menu-open: 420ms;
  --dur-menu-close: 180ms;
  --stagger: 40ms;
  --boil-frame: 100ms;         /* 10 fps */
  --run-frame: 83ms;           /* 12 fps */
  --sleep-frame: 125ms;        /* 8 fps, Pose schlafen */

  /* Ebenen */
  --z-leash: 5; --z-sticky: 40; --z-header: 50; --z-skip: 1000;
}

@media (min-width: 768px) {
  :root { --page-pad: 24px; --header-h: 64px; --leash-w: 2.6px; --coco-leash: 110px; --coco-stroke: 1.8px; }
}
@media (min-width: 1200px) {
  :root { --page-pad: 32px; }
}
```

---

## 8. Komponenten

Jede Komponente: **Zweck · Aufbau · Maße · Zustände · Bewegung · Barrierefreiheit · Tests.** Bewegungs-Details stehen im Katalog §11.5 (IDs `MI-xx`).

### KO-01 Seitenrahmen (`AppShell`)

- Reihenfolge im DOM: Skip-Link → `SiteHeader` → Vorschau-Banner (KONZEPT §3.0.4, falls aktiv) → `<main id="inhalt">` → `SiteFooter`. Die Linien-Ebene `LeashLayer` ist ein `aria-hidden`-Geschwister von `<main>` innerhalb eines `position: relative`-Seitencontainers.
- `<html lang>` gemäß Route; `<body data-preset="journey|…">` (Preset, §9.7); `<html data-motion="full|reduced">` (§11.7).
- **Skip-Link** „Zum Inhalt springen“ (EN „Skip to content“): erstes fokussierbares Element, unsichtbar bis Fokus, dann oben links als Papierzettel (`--paper-2`, Rand `--ink`, `--r-card`).
- **Vorschau-Banner:** schmale Leiste unter dem Kopf, `--paper-2`, gestrichelter unterer Rand `--stencil` 1.5px, Text `--ink` 14 px, nicht animiert, nicht schließbar. In der Vorschau-Datei ersetzt das Export-Banner (KONZEPT §12.5 Nr. 8) diese Leiste in gleicher Optik; seine Phasen-Kennung („Phase P3“) kommt aus `PREVIEW_PHASE` bzw. `[ci:full pN]` bzw. `PLAN.md` (ARCHITEKTUR §14.9), nie aus dem Branch-Namen.

### KO-02 Kopfleiste (`SiteHeader`)

- **Aufbau (links → rechts):** Wortmarke „planet claire“ (SVG, §12.6, Link zur Startseite, zugänglicher Name „planet claire – Startseite“) · Links **Shop**, **Tattoo** · **Korb** mit Anzahl · Knopf **Menü** (KONZEPT §3.0.1; EN: Shop, Tattoo, Basket, Menu).
- **Maße:** Höhe `--header-h` (56/64). Seitenrand `--page-pad`. Links Bricolage 500 16 px, Zielfläche ≥ 44×44 (Innenabstand). Korb: Icon `basket` 22 px + Text „Korb“ + Anzahl in Plex Mono (`2`) in einem Kreis 20 px (Rand 1.5px `--ink`, handgezeichnet); ohne Cookie nur „Korb“. Breite für die Zahl ist immer reserviert (keine Verschiebung).
- **Unter 375 px Breite:** Wortmarke schrumpft auf die Planet-Marke (32 px) mit sichtbar verstecktem Text „planet claire – Startseite“; Shop, Tattoo, Korb, Menü bleiben sichtbar. Bei 320 px darf nichts umbrechen oder überlaufen.
- **Grund:** `--paper` deckend (kein `backdrop-filter`). Unterkante: statische, handgezeichnete Linie (SVG-Pfad 2400 px lang, `preserveAspectRatio="none"` **nicht** verwenden, sondern links verankert und rechts abgeschnitten), `--ink`, 1.5 px, drei Varianten nach Routen-Seed. Diese Linie ist der **Leinen-Anschluss**: jede Seite beginnt ihre Tuschelinie hier (§9.8).
- **Zustände:** aktiver Bereich (Shop/Tattoo) mit statischer gezeichneter Unterstreichung + `aria-current="page"`; Korb-Anzahl ändert sich → MI-07 (Anzahl hüpft). Beim Scrollen verändert sich die Leiste nicht (kein Ein-/Ausblenden).
- **Barrierefreiheit:** `<header>` mit `<nav aria-label="Hauptnavigation">`; Menü-Knopf `aria-expanded`, `aria-controls="menu"`, `aria-haspopup="dialog"`.
- **Tests:** AK-DS-07.

**AK-DS-07** Bei 320, 360, 390 und 1440 px Breite: Kopfleiste ohne Überlauf (`scrollWidth ≤ clientWidth`), Shop/Tattoo/Korb/Menü sichtbar und ≥ 44×44 px klickbar; Korb-Anzahl ändert die Breite der Leiste nicht (Bounding-Box vor/nach „In den Korb“ identisch).

### KO-03 Menü (`MenuOverlay`)

- **Aufbau:** natives `<dialog id="menu" aria-label="Menü">` (modal, `showModal()`), Vollbild, Grund `--paper` mit eigenem Raster. Oben: Wortmarke + Knopf „Schließen“ (Text + Icon). Hauptliste (KONZEPT §3.0.2) in Spectral `--fs-menu`: Start · Shop · Archiv · Auftragsarbeiten · Tattoo · Über mich & Coco · Kontakt. Unter „Shop“ klein (Bricolage 17 px) die Kategorien; unter „Tattoo“ die Tattoo-Unterseiten. Unten: Sprachumschalter „Deutsch · English“, Instagram-Link, Pflichtlinks klein inkl. „Vertrag widerrufen“. Rechts unten schaut Coco herein (Pose `kopfschief`, Größe `--coco-m`, `aria-hidden`).
- **Unterstreichung:** jeder Hauptlink trägt ein Inline-SVG `LinkUnderline` (drei Pfadvarianten, Wahl per Hash des `href`), 100 % Linkbreite + 8 px Überstand, Strich `--stroke-ink`, `--ink`. Zustände: unsichtbar → bei Hover (nur `(hover: hover) and (pointer: fine)`), `:focus-visible` und `:active` wird sie gezeichnet (MI-06); aktuelle Seite: statisch gezeichnet + `aria-current="page"`.
- **Öffnen/Schließen:** MI-05. `Esc` und „Schließen“ schließen; Fokus kehrt zum Menü-Knopf zurück; `<html>` bekommt `overflow: hidden` + `scrollbar-gutter: stable` (keine Verschiebung). Klick auf einen Link schließt das Menü sofort (ohne Schließ-Animation) und navigiert.
- **Ohne JavaScript:** der Menü-Knopf ist ein Link `#fussnavigation` auf die Navigation im Fußbereich.
- **Tests:** AK-DS-08.

**AK-DS-08** Tastatur: Menü öffnen mit Enter/Leertaste, Fokus liegt auf dem ersten Link, Tab bleibt im Dialog, `Esc` schließt, Fokus zurück auf „Menü“. Mit `reducedMotion: 'reduce'` ist der Endzustand nach ≤ 1 Frame erreicht (keine laufende Animation).

### KO-04 Fußbereich (`SiteFooter`)

- **Auf jeder öffentlichen Seite** (inkl. Warenkorb, Kasse, Danke, Bestellstatus, 404, 500), DE/EN (E-44, KONZEPT §3.0.3).
- **Komponenten:** `SiteFooter` (ganzer Fußbereich) mit der Unterkomponente `LegalFooter` für den Pflichtlink-Block
  (Punkte 1 und 2 unten, R-011). `LegalFooter` rendert der Code immer; sie ist nicht über das CMS entfernbar.
- **Aufbau (DOM-Reihenfolge):**
  1. **„Vertrag widerrufen“** (EN „Withdraw from contract here“, R-090) als hervorgehobener Knopf-Link → R26. Optik: Rand 2px `--ink`, Grund `--paper`, Bricolage 600 16 px, Icon `withdraw`, Höhe ≥ 48 px, `--r-btn`. Keine Animation, kein Hover-Versatz, immer sichtbar (nie eingeklappt).
  2. Navigation Rechtliches: Impressum · Datenschutz · AGB · Widerrufsbelehrung · Versand & Zahlung · Kontakt · Konformitätserklärungen (Fußlink nur, wenn Erklärungen existieren; die Seite R27 selbst bleibt erreichbar, KONZEPT §3.0.3).
  3. `<nav id="fussnavigation" aria-label="Seitenübersicht">`: Shop · Archiv · Tattoo · Auftragsarbeiten · Über mich & Coco · Instagram ↗ (externer Link, `rel="noopener"`).
  4. Sprachumschalter.
  5. Schalter „Animationen: an/aus“ (§11.7).
  6. Preis-Fußnote nur auf Seiten mit Preisen (Text aus KONZEPT §3.4, Sternchen-Bezug).
  7. Zeile „© {Jahr} Planet Claire · Berlin“ in `--ink-2`.
- **Optik:** Grund `--paper-2` (deckt Raster), obere Kante eine statische Handlinie `--ink` 1.5px; Links Bricolage 400 15 px in `--ink`, unterstrichen, Zielhöhe ≥ 44 px mobil; Spalten ab 768 (Rechtliches | Seiten | Sprache & Einstellungen).
- **Linie:** Die Tuschelinie endet oberhalb des Fußbereichs oder verlässt die Seite am unteren Rand der Rinne; sie kreuzt nie einen Fußbereich-Link (§9.9).
- **Tests:** AK-DS-09 (ergänzt KONZEPT AK-3-11).

**AK-DS-09** Auf allen Routen der Routentabelle (DE+EN): „Vertrag widerrufen“ ist sichtbar (`isVisible`), ≥ 44 px hoch, und `document.elementFromPoint` in seiner Mitte liefert den Link selbst (nicht Linie, nicht Coco, nicht Sticky-Leiste) – geprüft am Seitenende, mit und ohne reduzierte Bewegung.

### KO-05 Preisschild (`PriceTag`)

Flohmarkt-Anhänger, handgeschrieben, an der Schnur hängend (E-77).

- **Aufbau:** Faden (senkrechter Strich 1.5 px `--ink`, Länge `6 + ((nr × 13) mod 9)` px) → Öse (Kreis Ø 8 px, Rand 1.5 px `--ink`, Füllung `--paper`) → Schild-Körper als SVG-Form „Kofferanhänger“ (oben zwei um 8 px abgeschrägte Ecken, unten leicht gerundet, Kontur mit Wackel ±0.6 px, Füllung `--paper-2`, Kontur 1.5 px `--ink`) → Inhalt: Preis (Mansalva `--fs-price-tag`, `--ink`, mit `*`) und darunter `Nr. 017` (Plex Mono 12 px, `--ink-2`).
- **Maße:** Breite `max(76px, Inhalt + 20px)` mobil, `max(92px, Inhalt + 24px)` ab 768; Höhe ≥ 58 px. `.u-hatch-shadow` darunter.
- **Drehung:** deterministisch aus der Objektnummer: `angle = ((nr × 37) mod 9) − 4` Grad; ist das Ergebnis 0 → 2.5°. `transform-origin` = Ösenmitte. Keine Zufallswerte zur Laufzeit (SSR = Client).
- **Varianten:** `hanging` (Shop, am Faden), `pinned` (Produktseite, hängt an der Titel-Unterstreichung), `mini` (Danke-Seite, 64 px breit, ohne Nr.).
- **Zustände:** normal; `sold` → Stempel KO-06 über dem Preis, Preis bleibt lesbar darunter; `reserved` → Badge KO-10 „reserviert“ an der Karte (nicht auf dem Schild).
- **Bewegung:** MI-02 (Schwingen) im Shop beim ersten Eintritt der Reihe in den Sichtbereich und bei Hover/Fokus der Karte; nie in Tattoo-Bereich, Korb, Kasse.
- **Nie im Tattoo-Bereich** (KONZEPT §3.11: keine Preisschild-Kaufoptik).
- **Barrierefreiheit:** Preis ist echter Text; das Schild ist Teil des Karten-Links (KO-07) und nicht selbst fokussierbar.

### KO-06 „sold“-Stempel (`SoldStamp`)

- **Aufbau:** Wort `sold` (Spectral Italic `--fs-stamp`, Farbe `--petrol`, `lang="en"`) in einem Rahmen (SVG-Rechteck mit rauen Kanten, 2.5 px `--petrol`, Radius 4 px), Ausbrüche: 3–5 kleine Lücken im Rahmen und leichte Fehlstellen im Wort über eine statische Maske (Stempel-Druckbild). `mix-blend-mode: multiply`, `opacity: 0.92`, Drehung −14° (±2° nach Objektnummer), `filter: url(#ink-rough)` erlaubt (statisch, klein).
- **Platzierung:** Shop-Karte: über dem Preisschild, 110 % Schildbreite, Mitte auf der Preiszeile. Produktseite: über dem Preisschild `pinned`, zusätzlich Text „Schon verkauft“ (KONZEPT §3.4 Punkt 6).
- **Barrierefreiheit:** Stempel ist `aria-hidden`; der Verkauft-Zustand steht als Text im zugänglichen Namen der Karte bzw. als Text auf der Produktseite („verkauft“ / „sold“).
- **Bewegung:** MI-03 (Knall) **nur im Moment des Verkaufs** (KONZEPT §3.5): (a) auf der Danke-Seite, wenn die Zahlung bestätigt ist, auf dem Mini-Schild des gekauften Stücks; (b) wenn eine geöffnete Shop-/Produktseite eine Statusänderung auf `sold` live übernimmt. Beim Laden von Seiten mit verkauften Stücken: statisch.

### KO-07 Produktkarte (`ProductCard`)

- **Aufbau (von oben):** Foto 4:5 (`aspect-ratio: 4 / 5`, `object-fit: cover`, Fokuspunkt aus dem CMS, `--r-photo`) → Schnur-Anschlusspunkt (Anker für die Linie, §9.7 `shopString`) → Preisschild KO-05 (`hanging`), links ausgerichtet, 8 px Einzug → Titel (Bricolage 600 15/16 px, max. 2 Zeilen, `line-clamp: 2`) → Meta (Plex Mono `--fs-meta`, `--ink-2`: „Keramik · Ø 14 cm“).
- **Klickfläche:** die **ganze Karte ist ein einziger `<a>`** (keine verschachtelten Bedienelemente). `aria-label` = „{Titel}, {Preis}{, gerade reserviert | , verkauft}“.
- **Keine Info nur bei Hover:** Hover (feiner Zeiger) löst nur MI-02 aus. Kein Zoom des Fotos, kein Einblenden von Text.
- **Zustände:**
  - `available`: normal.
  - `reserved`: Badge „reserviert“ (KO-10) oben links auf dem Foto (8 px Einzug).
  - `sold`: Foto `opacity: 0.82` („gedämpft“, KONZEPT §3.2), Stempel KO-06 auf dem Schild; Text bleibt ungedämpft.
  - Bild fehlt/lädt: Grund = gespeicherte Dominanzfarbe des Fotos (§12.2), sonst `--paper-2` mit Schraffur; feste Maße, keine Verschiebung.
- **Fokus:** Ring um die ganze Karte (`outline` am `<a>`, `outline-offset: 4px`).
- **Bild:** über `<ResponsiveImage>` (ARCHITEKTUR §9.4), `srcset` aus den Payload-Größen `thumb`/`card` (§12.2), `sizes="(min-width:1200px) 25vw, (min-width:768px) 33vw, 50vw"`, `loading="lazy"` außer den ersten 2 Karten, `decoding="async"`; Alt-Text aus dem CMS (Pflichtfeld).
- **Tests:** AK-DS-10.

**AK-DS-10** Jede Produktkarte enthält genau einen `<a>` und kein weiteres fokussierbares Element; Klick auf Foto, Schild, Titel und Meta navigiert zur Produktseite; `aria-label` enthält Titel und Preis; Bild-Container hat vor dem Laden die Endhöhe (CLS-Beitrag 0).

### KO-08 Shop-Raster, Filter, „Mehr zeigen“

- **Raster:** §5.4. Die Linie läuft als Schnur durch jede Kartenreihe (§9.7 `shopString`).
- **Filter-Chips** (KONZEPT §3.2): horizontale Reihe, mobil seitlich scrollbar (`overflow-x: auto`, Scroll-Snap, sichtbarer Fade-Rand rechts als Hinweis), Chips = Links. Chip: Höhe 40 px + 2 px Außenabstand (Zielfläche 44), Bricolage 500 15 px, Rand 1.5 px `--ink`, `--r-btn`, Grund `--paper`. Aktiv: Grund `--ink`, Text `--paper`, `aria-current="page"`. Zustandswechsel ohne Animation (ruhiger Shop).
- **„nur verfügbare“:** als Chip-Umschalter mit Häkchen-Icon (Link auf `?available=1`, KONZEPT §3.2).
- **„Mehr zeigen“:** Sekundärknopf (KO-11) als echter Link `?page=n+1`, mittig unter dem Raster.
- **Fußnote:** Preis-/Versandhinweis einmal pro Seite (KONZEPT §3.4) unter dem Raster, Bricolage 14 px `--ink-2`.

### KO-09 Produktgalerie und Zoom (`ProductGallery`, `Lightbox`)

- **Galerie mobil:** `<ul>` mit `scroll-snap-type: x mandatory`, je Folie 100 % Inhaltsbreite, 4:5, `scroll-snap-stop: always`. Darunter Punkte-Anzeige (handgezeichnete Kreise 8 px; aktuell gefüllt `--ink`, sonst Rand `--ink-2`) und Zähler „2 / 5“ (Plex Mono). Keine Slider-Bibliothek.
- **Galerie ab 768:** gleiche Scroll-Leiste plus sichtbare Knöpfe „vorheriges/nächstes Foto“ (44 px, Kreis `--paper` mit Rand `--ink`, `aria-label`), nie nur bei Hover; darunter Miniaturen (64 px, 4:5) als Buttons mit `aria-current` für das aktive Foto.
- **Tastatur:** Die Leiste ist `tabindex="0"` mit `aria-roledescription="Bildergalerie"`, Pfeiltasten wechseln das Foto; Zähler ist `aria-live="polite"` **nur** nach Knopf-/Tastendruck (nicht beim Wischen).
- **Erstes Foto** ist Titelbild und LCP-Kandidat: `fetchpriority="high"`, kein `lazy`, `srcset` aus `card`/`detail` (§12.2 „Galerie-Einbindung“); `decoding="sync"` (steht im ersten Frame). Fotos 2…n werden während des Schriften-Tors (§4.1, erste zwei Frames) nicht gerendert, damit das Nachbarfoto nicht vor dem LCP-Foto lädt.
- **Zoom/Lightbox:** Tipp/Klick auf ein Foto oder Knopf „Vergrößern“ (Icon `zoom` + Text, unten rechts auf dem Foto, Papier-Halo) öffnet `<dialog class="lightbox">` im Vollbild mit Grund `--paper-field` (kein Schwarz). Bild in Größe `zoom` (§12.2). Mobil: natives Pinch-Zoom (`touch-action: pinch-zoom pan-x pan-y`), Doppeltipp schaltet 1× ↔ 2×. Desktop: Klick schaltet 1× ↔ 2× an der Klickposition, Ziehen verschiebt. Wischen links/rechts wechselt das Foto. Schließen: Knopf „Schließen“, `Esc`, **Zurück-Taste des Browsers** (beim Öffnen `history.pushState`). Fokus zurück auf das auslösende Foto.
- **Bewegung:** keine eigene (Scroll-Snap ist nativ); Lightbox öffnet ohne Animation.
- **Sold:** Galerie unverändert (Fotos nicht gedämpft).

### KO-09a Kauf-Leiste mobil (`BuyBar`)

- Nur < 768, Produktseite, Status `available`. Erscheint, wenn der eigentliche Knopf „In den Korb“ den Sichtbereich verlassen hat (IntersectionObserver), und verschwindet, wenn er wieder sichtbar ist.
- Inhalt: Preis (Plex Mono 16 px) + Knopf „In den Korb“ (Primär, KO-11), Höhe `--buybar-h` 72 px + `env(safe-area-inset-bottom)`, Grund `--paper-2`, obere Handlinie.
- Einblenden: `transform: translateY(100%) → 0`, `--dur-short`, `--ease-calm`; reduzierte Bewegung: sofort.

### KO-09b Details-Tabelle (`ProductDetails`)

- **Zweck:** Block „Details“ der Produktseite (KONZEPT §3.4 Nr. 8): Maße, **Gewicht**, Material, Technik, Größe, Zustand, Pflegehinweise – je nach Produktart; leere Zeilen entfallen.
- **Aufbau:** Überschrift H2 „Details“ / “Details” (Bricolage 700 20 px), darunter `<dl>` als zweispaltiges Raster (`grid-template-columns: minmax(7rem, max-content) 1fr`, Zeilenabstand `--space-2`); Begriffe (`<dt>`) Bricolage 500 15 px `--ink-2`, Werte (`<dd>`) Bricolage 400 16 px `--ink`; Zahlen mit Einheit (Maße, Gewicht) in Plex Mono `--fs-meta` mit `tabular-nums`. Deko-Trenner `--stroke-hair` in `--clay` zwischen den Zeilen (§6.2), kein Kasten.
- **Gewicht** [Annahme DA-9]: `weightGrams` ohne Verpackung, formatiert von `formatWeight(grams, locale)` in `src/lib/shop/format.ts`: unter 1000 g ganze Gramm („210 g“), ab 1000 g Kilogramm mit höchstens einer Nachkommastelle, gerundet, ohne „,0“ (DE „2,4 kg“, „1 kg“; EN “2.4 kg”, “1 kg”); zwischen Zahl und Einheit ein geschütztes Leerzeichen (U+00A0).
- **Mobil (< 768):** Begriff über dem Wert (eine Spalte), damit lange Materialangaben nicht umbrechen müssen.
- **Bewegung:** keine. **Barrierefreiheit:** echtes `<dl>` (keine Layout-Tabelle); Werte sind Text, Einheiten stehen im Text.
- **Tests:** Unit – leere Felder erzeugen keine Zeile; `formatWeight` DE/EN: 210 → „210 g“, 999 → „999 g“, 1000 → „1 kg“, 2400 → „2,4 kg“ / “2.4 kg”, 1250 → „1,3 kg“ / “1.3 kg”; Reihenfolge der Zeilen wie KONZEPT §3.4 Nr. 8.

### KO-10 Badges (`Badge`)

Höhe 28 px, Innenrand 0 10 px, Bricolage 500 14 px, `--r-badge`, Rand 1.5 px, Grund transparent (auf Fotos: `--paper`).

| Badge | Text DE / EN | Rand/Text | Icon | Wo |
|---|---|---|---|---|
| Unikat | „Unikat“ / „One of a kind“ | `--ink` | Stern | Produktseite Kurzdaten |
| Deko-Hinweis | „Deko – nicht für Lebensmittel“ / „Decorative – not for food use“ | `--stencil` | Teller durchgestrichen | Produktseite (Keramik, Standard E-15) |
| Lebensmittelecht | „Lebensmittelecht – Konformitätserklärung ansehen“ / „Food-safe – view declaration“ (Link) | `--mat` | Häkchen | Produktseite (nur mit KE, E-15) |
| reserviert | „reserviert“ / „reserved“ (Karte); Produktseite: „Gerade reserviert – schau in 30 Minuten nochmal“ | `--warn` | Uhr | Karte, Produktseite, Korb |
| Second-Hand | „Second-Hand / Vintage“ | `--ink-2` | – | Produktseite Textil |
| Kleinteile | „Kein Spielzeug – verschluckbare Kleinteile“ (Kurzform; voller Text KONZEPT §3.4) | `--fox-text` | Warnung | Produktseite Schmuck |
| verfügbar / vergeben (Flash) | „verfügbar“ / „vergeben“ | `--stencil` / `--ink-2` (vergeben als Stempel-Optik in `--stencil`) | – | Tattoo-Flash (KO-20) |

Der vollständige Pflichttext steht immer als Text auf der Seite; das Badge ist Hervorhebung, nicht Ersatz.

### KO-11 Knöpfe und Links (`Button`)

| Variante | Einsatz | Optik | Hover (feiner Zeiger) | Aktiv | Deaktiviert |
|---|---|---|---|---|---|
| **Primär** | „In den Korb“, „Zur Kasse“, „Zum Shop“ | Grund `--ink`, Text `--paper`, Bricolage 600 `--fs-button`, Höhe 52 px (mobil volle Breite), `--r-btn`, `--shadow-press` | `translate(-1px,-1px)`, Schatten 4px 4px | `translate(2px,2px)`, `--shadow-press-active`, 80 ms | `aria-disabled="true"`, Grund `--paper-2`, Text `--ink-3`, Rand 1.5 px `--ink-3`, kein Schatten |
| **Bestellen (ruhig)** | nur „Zahlungspflichtig bestellen“ | Grund `--ink`, Text `--paper`, Bricolage **700** 18 px, Höhe 56 px, volle Breite (max. 480 px), `--r-calm`, **kein** Schatten, **keine** Transformation, **keine** Transition | Unterstrich des Texts | – | während Verarbeitung `disabled` + Statuszeile darunter |
| **Sekundär** | „Mehr zeigen“, „Weiter einkaufen“, „Adresse kopieren“ | Grund `--paper`, Rand 1.5 px `--ink`, Text `--ink`, Höhe 48 px, `--r-btn` | gezeichnete Unterstreichung des Texts (MI-06) | – | wie Primär |
| **Text** | „Entfernen“, „Ändern“ | Text `--ink`, unterstrichen, Zielfläche 44 px | Farbe bleibt, Unterstrich 2 px | – | – |
| **Widerruf** | „Vertrag widerrufen“ | siehe KO-04 | keine | – | nie deaktiviert |

- **Knopftexte** sind festgelegt in KONZEPT (Rang). „Zahlungspflichtig bestellen“ (EN „Order with obligation to pay“) steht **allein** im Knopf, ohne Icon, ohne Zusatztext; der Text ändert sich nie (auch nicht beim Laden). Fortschritt steht in einer `aria-live="polite"`-Zeile darunter („Zahlung wird verarbeitet …“).
- **„In den Korb“ nach Erfolg:** Knopf wird zu „Liegt schon in deinem Korb“ + Link „Zum Korb“ (KONZEPT §3.4); MI-01 (Coco-Hüpfer) + MI-07 (Korbzahl).
- **Reserviert durch fremde Kasse:** Knopf `aria-disabled` mit Text „Gerade reserviert – schau in 30 Minuten nochmal“ (KONZEPT §3.4).
- **Shop pausiert** (`settings.shop.isOpen = false`, KONZEPT §4.2): „In den Korb“ (auch in der Kauf-Leiste KO-09a) und „Zur Kasse“ sind `aria-disabled` (Optik „Deaktiviert“); der Text aus `settings.shop.closedMessage` steht als ruhiger Hinweis-Kasten (`--paper-2`, `--r-card`, Icon `info`) direkt über dem Knopf bzw. über den Korb-Positionen und im Shop über dem Raster.
- Kein Knopf nutzt `--fox` oder `--pink`.

### KO-12 Formulare (`Field`, `Checkbox`, `Radio`, `Select`, `FileDrop`)

Gilt für Kasse, Auftragsarbeiten (R10), Vertrag widerrufen (R26), 404-Nummernfeld.

- **Label** über dem Feld (Bricolage 500 `--fs-label`, `--ink`); Pflichtfelder mit „*“ und einmal oben im Formular „* Pflichtfeld“.
- **Hinweis** unter dem Label (Bricolage 400 14 px, `--ink-2`), per `aria-describedby`.
- **Feld:** Höhe 48 px (Textarea ≥ 120 px), Grund `--paper-field`, Rand 1.5 px `--ink-2` (8,81:1), `--r-field`, Text 16 px (verhindert iOS-Zoom), Platzhalter `--ink-3` nur als Beispiel, nie statt Label.
- **Fokus:** Fokusring §3.2 (Stencil 3 px), Rand wird `--ink`.
- **Fehler:** Rand 2 px `--error`, darunter Fehlertext `--error` 14 px mit Icon `warn`, `aria-invalid="true"`, `aria-describedby` auf den Fehlertext; beim Absenden zusätzlich Fehlerzusammenfassung oben (Liste mit Sprunglinks, `role="alert"`), Fokus auf die Zusammenfassung (KONZEPT §3.0.6). Fehler erscheinen **ohne** Animation.
- **Checkbox/Radio:** 24 px, handgezeichneter Kasten/Kreis (SVG, Rand 1.5 px `--ink`), Haken bzw. Punkt statisch (keine Zeichen-Animation in Formularen). Nie vorangekreuzt (CLAUDE.md §6). Zielfläche inkl. Label ≥ 44 px hoch.
- **Auswahl (Select):** natives `<select>` mit gleicher Feldoptik und eigenem Pfeil-Icon.
- **Datei-Upload** (Auftragsarbeiten, bis 5 Bilder, KONZEPT §10): Ablagefläche mit gestricheltem Handrand 1.5 px `--ink-2`, Text „Bilder auswählen (optional, bis zu 5)“, echter `<input type="file" multiple accept="image/jpeg,image/png,image/webp">` als Bedienelement (Auswahl ≤ 15 MB je Bild, der Browser verkleinert vor dem Upload, Grenzen laut ARCHITEKTUR §8.8); Vorschau-Kacheln 72 px (4:5) mit Knopf „Entfernen“; Fortschritt und Fehler je Bild als Text (`aria-live="polite"`), ohne Animation.
- **Honeypot:** visuell versteckt per `position:absolute; left:-9999px`, `tabindex="-1"`, `autocomplete="off"`, `aria-hidden="true"`.
- **Autocomplete-Attribute** für Name, E-Mail, Adresse (`name`, `email`, `street-address`, `postal-code`, `address-level2`, `country`).
- **Stripe Payment Element** (nur Kasse): Appearance API `theme: 'flat'`, Variablen `colorPrimary: #1C1A17`, `colorBackground: #FBF8F1`, `colorText: #1C1A17`, `colorTextSecondary: #4B463F`, `colorDanger: #A6261C`, `fontFamily` = Bricolage (Schrift per `fonts: [{ family, src: 'url(<eigene Domain>/…woff2)' }]`), `borderRadius: '8px'`, `spacingUnit: '4px'`, `focusBoxShadow: '0 0 0 3px #5A4BC4'`. Der Mock-Zahlungsanbieter (KONZEPT §1.5) nutzt dieselben Feldkomponenten.

### KO-13 Warenkorb (R06)

- **Aufbau** (KONZEPT §3.6): H1 „Dein Korb“ (Spectral) → Positionen → Lieferart → Summen → Hinweise → „Zur Kasse“.
- **Position:** Foto 64×80 (4:5), Titel (Link), `Nr. 017 · Keramik` (Plex Mono `--ink-2`), Preis rechts (Plex Mono `--fs-price-mono`), Text-Knopf „Entfernen“. Nicht mehr verfügbar → Badge „gerade reserviert“ bzw. Stempel-Text „sold“ in `--fox` ≥ 24 px, Zeile gedämpft, aus der Summe ausgeschlossen, Hinweis oben, „Zur Kasse“ `aria-disabled` bis entfernt.
- **Lieferart:** Radio-Gruppe „Versand innerhalb Deutschlands (DHL)“ mit Preis / „Abholung in Berlin – 0,00 €“. Darunter Versandklasse als Text („Versandklasse: Keramik – die größte Klasse im Korb zählt“).
- **Summen:** Zwischensumme, Versand, **Gesamt** (Plex Mono `--fs-total`, Trennlinie 1.5 px `--ink` darüber); Steuerhinweis; Lieferzeit; Liefergebiet; akzeptierte Zahlarten als Text „Karte · Apple Pay · Google Pay · PayPal · Vorkasse“ (keine Anbieter-Logos).
- **Tuschelinie:** Preset `calm` – eine stille, feine Linie (1.25 px) unter der H1, die rechts in einer kleinen Schleife neben Coco endet. **Coco sitzt neben der Summe** (Pose `sitzen`, `--coco-m`, erster Frame, **kein** Boil). Läuft bereits eine Reservierung (zurück aus der Kasse), steht dort der Countdown KO-15.
- **Leer:** KO-17 „Korb leer“.
- **Bewegung:** keine, außer MI-07 im Kopf.

### KO-14 Kasse (R07)

- **Aufbau** (KONZEPT §3.7): Countdown KO-15 ganz oben (nicht sticky) → Abschnitte 1 Kontakt · 2 Lieferung · 3 Rechnungsadresse · 4 Zahlart · 5 Übersicht → Hinweistext (AGB/Widerrufsbelehrung, Wortlaut RECHT) → Knopf „Zahlungspflichtig bestellen“ → kompakte Countdown-Wiederholung („Noch 24:12 reserviert“) → Fußbereich.
- **Abschnitte:** nummerierte Überschriften (Plex Mono Kicker „1 Kontakt“ + Bricolage 700 H2 20 px; hier **kein** Spectral außer H1), Abschnitte als Kästen `--paper-2`, `--r-card`, Innenrand 16/24.
- **Übersicht:** Positionen mit Foto 48×60, Titel, Nr., Preis; Versand; Gesamt; Lieferzeit; Adressen; Zahlart; je Block Text-Knopf „Ändern“ (springt zum Abschnitt und setzt Fokus).
- **Layout ab 1200:** Formular 7/12 links, Übersicht 5/12 rechts (sticky oben); Knopf unter der Übersicht.
- **Tuschelinie:** `calm` – statische Linie 1.25 px entlang der linken Kante der Abschnitte (ab 768) bzw. unter der H1 (mobil). **Keine** Animation, keine View Transition, kein Boil.
- **Bewegung auf der Kasse: keine.** Erlaubt ist nur der Sekundenwechsel des Countdowns (Textänderung) und der Fokusring. Keine CSS-Transitions (Test AK-DS-11).

**AK-DS-11** Auf `/de/warenkorb`, `/de/kasse`, `/de/bestellung/[token]`, `/de/vertrag-widerrufen` und allen Rechtsseiten liefert `document.getAnimations()` 1000 ms nach `load` und nach jeder Formular-Interaktion eine leere Liste; berechnete `transition-duration` aller Elemente im `<main>` ist `0s`.

### KO-15 Countdown mit Coco (`ReservationCountdown`)

- **Zweck:** 30-Minuten-Reservierung sichtbar machen (E-22).
- **Aufbau:** Kasten `--paper-2`, `--r-card`; links Coco (`sitzen`, `--coco-m`, statisch, hält einen handgezeichneten Zettel, auf dem der Countdown steht – Zettel ist HTML-Text, Coco ist SVG daneben); Zeit `mm:ss` in Plex Mono 28 px `tabular-nums`; darunter „Dein Stück ist für dich reserviert.“ (EN „Your piece is reserved for you.“).
- **Schwellen:** > 5 min Text `--ink`; ≤ 5 min `--warn` + Satz „Noch 5 Minuten reserviert“; ≤ 1 min `--fox-text` + „Nur noch 1 Minute“. Kein Blinken, kein Pulsieren, keine Farb-Animation.
- **Ablauf:** bei 0: Satz „Deine Reservierung ist abgelaufen.“ + Primärknopf „Nochmal reservieren“ (versucht neu zu reservieren, KONZEPT §4); Knopf „Zahlungspflichtig bestellen“ wird `disabled`.
- **Barrierefreiheit:** Zeit in `<p role="timer" aria-live="off">`; getrennte, visuell versteckte `aria-live="polite"`-Region meldet nur 10 min, 5 min, 1 min und „abgelaufen“.
- **Zeitbasis:** Serverzeit `reservedUntil` minus Client-Offset (einmal beim Laden ermittelt), Aktualisierung per `setInterval` 1 s (kontrollierbar durch Playwright-Clock).

### KO-16 Status-Leine (`OrderStatusLine`, R09)

- Statusverlauf als **statische** Tuschelinie mit Knoten: mobil senkrecht, ab 768 waagerecht. Knoten Ø 14 px: erledigt = gefüllt `--ink`; aktuell = gefüllt + handgezeichneter Kreis Ø 26 px darum + Label Bricolage 700; kommend = Kontur `--ink-2`.
- Etiketten aus KONZEPT §5 (Statusmodelle), z. B. „Bestellt · Bezahlt · Gepackt · Versendet · Zugestellt“; Abholung und Vorkasse-Varianten entsprechend.
- Als geordnete Liste `<ol>` mit Text je Schritt; aktueller Schritt `aria-current="step"`. Keine Animation.

### KO-17 Leere Zustände (`EmptyState`)

Aufbau: Coco (`--coco-xl`, statisch; Boil 2 s nach Eintritt, dann Stillstand) · Satz in Juttas Ton (H2 Spectral) · 1 Satz Erklärung · 1 Weiter-Link als Sekundärknopf. Mittig, max. 36ch.

| Ort | Coco-Pose | Text DE (Vorschlag, P8 kann umformulieren) | EN | Link |
|---|---|---|---|---|
| Korb leer | `schnueffeln` am leeren Korb | „Hier ist noch nichts drin.“ | „Nothing in here yet.“ | Zum Shop |
| Shop leer | `sitzen` | „Gerade ist alles weg – neue Stücke kommen auf Instagram zuerst.“ (KONZEPT §3.2) | „Everything’s gone for now – new pieces show up on Instagram first.“ | Archiv |
| Kategorie leer | `kopfschief` | „In dieser Ecke ist gerade nichts.“ | „Nothing in this corner right now.“ | Alle Stücke |
| Archiv leer | `sitzen` | „Noch ist nichts verkauft.“ (KONZEPT §3.5) | „Nothing sold yet.“ | Shop |
| Startseiten-Station ohne Stücke | (keine, Stationszeichnung bleibt) | KONZEPT §3.1 | – | Archiv |
| Kein Flash verfügbar | `schlafen` | „Gerade sind alle Flash-Motive vergeben.“ | „All flash designs are taken right now.“ | Kontakt |
| Bestellstatus-Token unbekannt | – (404-Seite) | – | – | – |

### KO-18 404, „schon ein Zuhause“, 500

- **404 „Coco hat sich losgerissen“** (EN „Coco slipped her leash“, KONZEPT §3.17): Preset `lost` (§9.7). Die Leine kommt vom Kopf herunter und liegt in lockeren Schlingen am Boden, das Ende ist ein leerer, offener Karabiner mit leerem roten Geschirr. Ganz klein am Horizont rennt Coco einmal aus dem Bild (MI-11). Darunter die H1 „Coco hat sich losgerissen“ (fest im Code, nicht aus dem CMS), darunter als Fließtext der Inhalt der Seite `not_found` aus dem CMS (Rückfall ohne Seite: „Diese Seite gibt es nicht (mehr).“), dann Links Start, Shop, Tattoo und das Nummernfeld „Du suchst ein Stück? Nummer eingeben“ (KO-12).
- **Variante „Dieses Stück hat schon ein Zuhause gefunden“** (verkauft + ausgeblendet): statt Karabiner liegt ein kleines Preisschild mit Stempel „sold“ am Leinenende; Coco sitzt daneben (`sitzen`, `--coco-xl`), keine Weglauf-Animation.
- **500 „Hoppla – die Leine hat sich verheddert“:** statische, verknotete Linie (ein Knäuel aus 3 Schlingen, statisch), Coco `kopfschief`; Knopf „Nochmal versuchen“. Keine Animation (Fehlerfall, geringes Risiko).

### KO-19 Danke-Seite (R08)

- **Aufbau:** Preset `thanks` (§9.7): Die Linie läuft vom Kopf in einem ruhigen Bogen nach unten und endet in einem **kleinen Herz** neben Coco. Darunter H1 „Danke!“, Bestellnummer (Plex Mono), Zusammenfassung mit Mini-Preisschildern (KO-05 `mini`), nächste Schritte, bei Vorkasse Bankdaten mit Knöpfen „IBAN kopieren“, „Verwendungszweck kopieren“ und EPC-QR-Code (Ø-Kasten 168 px, Tusche auf Papier, Beschriftung darunter).
- **Coco je Zustand** (KONZEPT §3.8, §4.12):

| Zustand | Coco | Linie/Herz | Sonstiges |
|---|---|---|---|
| wartet auf Zahlungsbestätigung | `sitzen`, Boil 5 s ab Eintritt, danach Frame A (den Wartezustand zeigt der Text, nicht die Bewegung) | Linie gezeichnet, Herz noch nicht | Zeile „Wir warten noch kurz auf die Bestätigung …“ `aria-live` |
| bezahlt | Übergang `sitzen → einrollen → schlafen` (MI-09), atmet 1 Zyklus (Gesamtablauf ≤ 5 s) | Herz zeichnet sich (MI-09) | Stempel-Knall auf den Mini-Schildern (MI-03) |
| Vorkasse offen | `sitzen` („hält Wache“), statisch nach 2 s | Herz gezeichnet | kein Stempel (noch nicht bezahlt) |
| Zahlung fehlgeschlagen | `kopfschief`, statisch | Linie ohne Herz, endet offen | Knopf „Nochmal versuchen“ |
| leider schon weg (bezahlt, aber alle Stücke weg, O19) | `kopfschief`, statisch (Frame A, Symbol `coco-kopfschief-a`) | Linie ohne Herz, endet offen | kein Stempel; H1 „Leider schon weg“ statt „Danke!“, Text und Link zum Shop laut KONZEPT §4.12 |

- Die Danke-Seite ist **keine** Ruheseite: die Momente oben sind erlaubt; alles andere (Zusammenfassung, Bankdaten) bleibt still.

### KO-20 Tattoo-Bausteine (R11–R18)

- **Unter-Navigation:** horizontale Link-Reihe wie Filter-Chips (KO-08), `aria-current`.
- **Flash-Raster:** 2 Spalten mobil, 3 ab 768; Spalten- und Zeilenabstand ≥ 32 px (Platz für die `contour`-Linie, §9.5).
- **Flash-Karte:** Zeichnung (Seitenverhältnis des Motivs, Grund `--paper-field`, `--r-photo`), Titel, Nummer `F-012` (Plex Mono), Größe, Preis als **Text** (Bricolage 600 17 px, „120 €*“ bzw. „ab 90 €*“) – **kein Preisschild** (KONZEPT §3.11). Status (Feld `status`, DATENMODELL `FLASH_STATUSES`): bei `available` Badge `verfügbar` (Rand `--stencil`), bei `claimed` Stempel „vergeben“ (Stempeloptik wie KO-06, aber Farbe `--stencil`, Text „vergeben“/„taken“). Bei `available` zwei Sekundärknöpfe untereinander (KONZEPT §9.3/§9.4): „Per Mail anfragen“ (öffnet `mailto:` mit Betreff „Flash-Anfrage F-012 – {Titel}“, EN „Flash request F-012 – {title}“) und „Per DM anfragen“ (Instagram-Link), daneben der Text-Baustein „F-012 – {Titel}“ mit Text-Knopf „Kopieren“ und Hinweis „Schick mir das in die DM“; bei `claimed` keine Knöpfe. Hover/Fokus: `--shadow-stencil` (Schablonen-Abdruck), 0 ms (ohne Übergang).
- **Angebotskarte:** Datums-Badge Spectral Italic 28 px, z. B. „12.10.“) in einem gezeichneten Kreis, Titel, Text, Preisinfo als Text.
- **Kontakt-Block:** Knopf „Mail schreiben“ (kein Instagram-DM seit P12.7), E-Mail-Adresse als Text + „Adresse kopieren“ (Rückmeldung „Kopiert“ als Text, `aria-live`, 2 s).
- **Galerie:** Raster wie Shop ohne Schnur/Preisschilder; nur Fotos mit Einwilligung (E-42).
- **Linie:** Preset `stencil` (§9.7): Konturen um Flash-Karten, tuscheschwarz (E-73).

### KO-21 Station (Startseite, `Station`)

- **Aufbau:** Kicker „Station 01“ (Plex Mono) · H2 (Spectral) · 1–2 Sätze · Stationszeichnung (§12.4) · bis zu 4 Karten (KO-07, auf der Startseite **ohne** Schnur, Preisschild `pinned` am Kartenfuß) · Link „Alle {Kategorie}“.
- **Stationsmarke:** kleiner handgezeichneter Planet/Stern (§12.5) links neben dem Kicker; Anker der Linie (`data-leash-station`).
- **Abstände:** Stationen mit `--space-8` (mobil) / `--space-9` (Desktop) Abstand.
- **Reihenfolge und Inhalte:** KONZEPT §3.1 (Planet Claire, Hallo, Keramik, Textil, Zeichnungen, Schmuck, Tattoo, Jutta & Coco).

### KO-22 Hinweis-Kasten (`Callout`)

- Grund `--paper-2`, linker Rand 3 px, `--r-card`. Varianten: `info` (Rand `--stencil`), `warn` (Rand `--warn`, Icon), `deviation` („Besonderheit dieses Stücks: …“, Wortlaut R-048 für abweichende Beschaffenheit, KONZEPT §3.4, Rand `--fox-text`, Titel Bricolage 700).

---

## 9. Tuschelinie-Engine

Die Engine erzeugt pro Seite **eine** durchgehende Tuschelinie aus Ankern im DOM, zeichnet sie (je nach Preset) beim Scrollen oder einmalig, und setzt Coco an die Spitze. Sie ist reine Dekoration.

### 9.1 Bausteine und Dateien

Ordner laut ARCHITEKTUR §2.1: Die Engine liegt in `src/leash/` und importiert **weder** `react` **noch** `next/*` noch `payload`
(ARCHITEKTUR §2.2, AK-A-2-03) – nur so läuft sie unverändert in der Vorschau-Datei (§9.12). React-Hüllen um die Engine liegen
deshalb unter `src/components/leash/` (ARCHITEKTUR §2.1).

| Datei (Dateiname Vorschlag) | Inhalt | Umgebung |
|---|---|---|
| `src/leash/types.ts` | Typen (unten) | – |
| `src/leash/poses.ts` | `COCO_POSE_TO_SPRITE: Record<CocoPose, SpritePose>` (CMS-Wert → Sprite-ID, §10.3); importiert `CocoPose` nur als Typ aus `src/lib/enums.ts` (reines Modul, erlaubt) | rein, Vitest (deckt alle `COCO_POSES` ab) |
| `src/leash/random.ts` | `fnv1a32(str)`, `mulberry32(seed)`, `valueNoise1D(seed)` | rein, Vitest |
| `src/leash/presets.ts` | Preset-Tabelle §9.7 als Daten (nur Laufzeitwerte) | rein |
| `src/leash/presetDocs.ts` | Routen, Linienform und Notizen je Preset (Spalten „Routen“/„Linienform“ §9.7) – nur für Tests, nicht in der Engine gebündelt (Budget §9.10) | rein |
| `src/leash/geometry.ts` | `buildGeometry(input): LeashGeometry` – Wegpunkte, Schlaufen, Glättung, Wackel, Breitenprofil, Umriss, Segmente, LUT, Scroll-Abbildung | **rein, ohne DOM**, Vitest |
| `src/leash/measure.ts` | liest Anker aus dem DOM (eine Lesephase) | Browser |
| `src/leash/runtime.ts` | `mountLeash(root, options): LeashHandle` – Stufenwahl, SVG-Aufbau, Scroll/rAF, Coco-Kopplung, Neuaufbau | Browser, dynamisch importiert (in der Vorschau statisch gebündelt) |
| `src/leash/coco.ts` | Coco-Steuerung (Posen, Brücken, Boil, Hüpfer) | Browser |
| `src/leash/cocoTravel.ts` | Coco reist mit (P12.12, MO-14): Lauf-Pose beim Seitenwechsel über die Navigation-API, nachgeladen (≤ 2 KB gz), nur bei voller Bewegung | Browser |
| `src/leash/motion.ts` | `getMotion(): 'full' \| 'reduced'` und `onMotionChange(cb)` aus `prefers-reduced-motion` + `html[data-motion]` (§9.11, §11.7) – gemeinsam für Engine und `src/behaviors/*` | Browser, framework-frei |
| `src/components/leash/LeashLayer.tsx` | Client-Komponente (in `src/app/(frontend)/[locale]/layout.tsx`): rendert leeren Container, importiert `runtime` nach dem LCP, ruft `mountLeash`/`destroy` | React |
| `src/components/leash/Station.tsx` | `<Station id pose loop>` rendert `data-leash-station`-Anker | React (Server-tauglich) |

```ts
// src/leash/types.ts
export type PresetId =
  | 'journey' | 'about' | 'shopString' | 'product' | 'calm'
  | 'stencil' | 'frame' | 'legal' | 'margin' | 'thanks' | 'lost';
// Sprite-IDs der Zeichnungen (§10.3); CMS-Werte (`CocoPose` aus DATENMODELL §4) übersetzt `COCO_POSE_TO_SPRITE` (poses.ts)
export type SpritePose = 'rennen' | 'schnueffeln' | 'sitzen' | 'schlafen' | 'springen' | 'kopfschief';
export type LoopKind =
  | 'none' | 'left' | 'right' | 'spiral' | 'lasso' | 'orbit'
  | 'hook' | 'contour' | 'heart' | 'coil';
export interface LeashAnchor {
  id: string;
  kind: 'start' | 'station' | 'tag' | 'target' | 'end';
  x: number; y: number; w: number; h: number;   // relativ zum Seitencontainer, CSS-px
  loop: LoopKind;
  pose?: SpritePose;
}
export interface BuildInput {
  preset: PresetId;
  seed: number;                 // fnv1a32(`${preset}:${routeKeyOhneLocale}`)
  root: { w: number; h: number };
  viewport: { w: number; h: number };
  gutter: number;               // §5.3
  baseWidth: number;            // --leash-w in px
  anchors: LeashAnchor[];
}
export interface LeashSegment {
  id: string;
  bbox: { x: number; y: number; w: number; h: number };
  centerD: string;              // Mittellinie (für Enthüllung/Stufe B)
  outlineD: string;             // gefüllter Umriss mit variabler Breite (Stufe C; erst bei Zugriff berechnet)
  centerL?: number;             // Länge der Polylinie centerD (Stufe B ohne getTotalLength)
  strokes?: LeashStroke[];      // Stufe A: { d, w, L, len0, len1 } – Mittellinie in Stücken nahezu gleicher Breite
  len0: number; len1: number;   // Bogenlängen-Bereich im Gesamtpfad
}
export interface LeashGeometry {
  segments: LeashSegment[];
  totalLength: number;
  lut: Float32Array;            // je 4 px Bogenlänge: [len, x, y, angleRad]
  stations: { id: string; pose: SpritePose; loopLen0: number; loopLen1: number; y: number }[];
  scrollMap: { readingY: number; len: number }[]; // beide Spalten monoton steigend
}
export interface LeashHandle { destroy(): void; rebuild(): void; setMotion(m: 'full' | 'reduced'): void; }
```

### 9.2 Datenfluss

```
Server-Render: Seite mit <LeashLayer preset> + Anker-Elementen (data-leash-*) – ohne Linie
      │  LCP gemeldet (PerformanceObserver 'largest-contentful-paint') + 300 ms, spätestens load + 1200 ms
      ▼
requestIdleCallback (timeout 500) → import('@/leash/runtime')  ← eigenes Chunk, nie im Erstlade-Bundle
      ▼
measure(): alle Anker in EINER Lesephase (getBoundingClientRect + scrollY), Viewport, CSS-Variablen
      ▼
buildGeometry(input)  (rein; bei > 8 ms in Teilstücken über mehrere Idle-Callbacks, je ≤ 12 ms)
      ▼
render(): SVG-Segmente einfügen (EINE Schreibphase), Coco einsetzen, Anfangszustand setzen
      ▼
Scroll/Resize/Fonts → rAF-gedrosselte Aktualisierung (nur Schreibzugriffe, §9.10)
```

### 9.3 Geometrie – Algorithmus (`buildGeometry`)

1. **Anker sortieren** nach `y`, dann `x`. `start`-Anker = Leinen-Anschluss an der Kopflinie (§9.8).
2. **Wegpunkte je Preset** (§9.7) erzeugen: zwischen zwei Ankern eine S-Kurve innerhalb der Rinne mit seitlichem Schwung `sway = ±0.18 × gutter` (Vorzeichen wechselt je Abschnitt, Betrag × `0.8 … 1.2` aus dem Seed).
3. **Schlaufen einsetzen** an Ankern mit `loop ≠ 'none'` (Formen §9.5). Jede Schlaufe hat eigene Bogenlängen `loopLen0 … loopLen1`.
4. **Glätten:** zentripetale Catmull-Rom-Kurve (α = 0.5) durch alle Wegpunkte → kubische Bézier-Segmente.
5. **Abtasten** nach Bogenlänge alle 2 px → Punkte `P_i` mit Normalen `N_i`.
6. **Wackel (Zittern der Hand):** `P_i += N_i × (A1·noise(s/λ1) + A2·noise(s/λ2))` mit `A1 = 0.9 px` (mobil) / `1.2 px` (ab 768), `λ1 = 90 px`, `A2 = 0.22 px`, `λ2 = 13 px` (seeded Zitter-Noise: Gitterwerte mit wechselndem Vorzeichen, Betrag 0.8–1, damit keine 120 px lange gerade Strecke entsteht – KUNST-QA LQ-03). Über die ersten 28 px wächst der Wackel von 0 an (Leinen-Anschluss exakt, §9.8). Presets `legal`/`calm`: `A1 = 0.5`, `A2 = 0.12`.
7. **Breitenprofil:** `w(s) = baseWidth × (0.85 + 0.30 × noise(s/220)) × (1 + min(0.25, 12 × |κ(s)|))`, begrenzt auf `[0.8, 1.35] × baseWidth`. Anfangsverjüngung über 28 px von 0.35 → 1 (`ease-out`; die ersten 4 px ruht die Feder auf 0.35), Endverjüngung über 18 px auf 0.45 (Stift hebt ab; die letzten 4 px auf 0.45); in den Verjüngungen gilt die Grundbreite ohne Zuschläge (KUNST-QA LQ-05). An Schlaufen-Starts ein Tintenpunkt (Kreis, Radius `1.3 × w`, vorher 0.9 – P9.18a, R1-05-04; P9.18, R1-03-05: bei 0.65 war er auf der Linie kaum zu sehen), wo die Feder kurz ruht.
8. **Umriss:** linke/rechte Kante `P_i ± N_i × w_i/2`, runde Kappen (Halbkreis, 8 Punkte), Vereinfachung mit Ramer-Douglas-Peucker (Toleranz 0.2 px), Ausgabe als `M … L … Z` mit 1 Nachkommastelle.
9. **Segmente:** Schnitt an Schlaufen-Enden und spätestens alle `max(600, 1.25 × viewport.h)` px Bogenlänge; Nachbar-Segmente überlappen 2 px Bogenlänge (keine Nahtlücke).
10. **LUT:** alle 4 px Bogenlänge `[len, x, y, angle]` aus den eigenen Bézier-Daten (analytisch, **ohne** `getPointAtLength`).
11. **Scroll-Abbildung** (nur scrollgekoppelte Presets, §9.6).

Determinismus: gleiche Eingabe → byte-gleiche `outlineD`/`centerD` (Seed aus Route, nicht aus Zeit/Zufall).

### 9.4 Darstellung – Qualitätsstufen

| Stufe | Wann | Technik | Kosten |
|---|---|---|---|
| **A „Tusche“** (Standard) | volle Bewegung, `hardwareConcurrency ≥ 4` (falls bekannt) und `deviceMemory ≥ 4` (falls bekannt) | Pro Segment ein `<svg>`; darin die gewackelte Mittellinie in **Stücken nahezu gleicher Breite** (`strokes`: Breite weicht im Stück ≤ 0.09 × `baseWidth` ab, Stück ≤ 420 px), je Stück `<path d stroke-width={w} pathLength="1">`; Farbe, `stroke-linecap="round"`, `fill="none"`, `stroke-dasharray="1 2"` und der Versatz stehen einmal am `<svg>` und werden vererbt (verborgen: `stroke-dashoffset="1.01"`; fertiges Stück `0`, aktives anteilig `1 − Anteil`; ist ein Segment fertig, steht `0` am `<svg>` und die Stücke tragen kein eigenes Attribut). Nachbar-Stücke teilen den Endpunkt, die runden Kappen schließen die Fuge; Tintenpunkte sind eigene Stücke der Länge 0.1 (Breite 2.6 × w). Alle Stücke stehen ab dem Aufbau im DOM: Einhängen oder Entfernen von `stroke-dasharray` löst in Chromium ein Layout aus (P9.15-Messung, PF-05), ein geänderter `stroke-dashoffset` nicht. **Keine Maske** – eine animierte Maske erzwingt in Chromium je Frame ein Layout (P9.11-Messung, KUNST-QA PF-05); `stroke-dashoffset` an sichtbaren Strichen ist reines Paint. | Repaint nur am aktiven Stück |
| **B „Feder“** | Laufzeit-Abstufung (unten) oder Browser-Ausnahme (in `presets.ts` pflegbar, z. B. falls Safari-Masken in QA ruckeln) | Nur Mittellinie als `stroke` (`--leash-w`, runde Kappen) mit Dash-Enthüllung, keine Maske, keine Breitenvariation; Wackel bleibt | geringer |
| **C „Statisch“** | reduzierte Bewegung, Schalter „Animationen aus“, Ruhe-Presets (`calm`, `legal`) | Umriss `outlineD` ohne Maske, vollständig sichtbar | keine Laufzeit |
| ohne JS | – | keine Linie; Coco statisch per SSR nur dort, wo sie Inhalt ist (leere Zustände, 404, Danke) | – |

**Laufzeit-Abstufung A → B:** Die Runtime misst während der ersten 2 s Scroll-Aktivität die rAF-Abstände. Sind > 25 % der Frames > 20 ms, schaltet sie für die restliche Sitzung (nur im Speicher, **kein** Storage, E-43) auf Stufe B.
**Segment-Zustände:** fertig (alle Stücke Versatz 0 bzw. Stufe B ohne Dash), aktiv (nur das Stück an der Feder ändert `stroke-dashoffset`), zukünftig (`visibility: hidden`). Im Scroll-Pfad ändern sich nur `stroke-dashoffset`, `visibility` und Cocos `transform` – keine Layout-Ereignisse (PF-05).
**Aufbau in Teilstücken:** Der erste Aufbau und jeder Neuaufbau nach Resize/Schriften laufen als Idle-Teilstücke (`requestIdleCallback`): Lesephase (`measure`, erst im ersten Idle-Callback – nach dem Rendern ist das Layout aktuell), dann `geometrySteps` (Pfad, Abtasten, Wackel/Breiten in Blöcken zu 768 Proben, je Segment ein Halt, LUT/Scroll-Abbildung; ≤ 3 ms je Teilstück ungedrosselt, ein weiterer Schritt nur, wenn er – geschätzt wie der vorige – noch hineinpasst), zuletzt die Schreibphase (Einhängen; die Ziel-Länge aus der gemessenen Scroll-Position, kein `scrollY`-Lesen nach dem Schreiben = kein erzwungenes Layout); jedes Teilstück ist eine eigene `leash:build`-Messung (PF-04). Der Umriss `outlineD` entsteht erst bei Bedarf (Stufe C).

### 9.5 Schlaufenformen

Alle Formen erhalten den Wackel aus §9.3 Schritt 6 und sind nie geometrisch perfekt (Radius schwankt ±12 %: glattes Rauschen plus eine Vierer-Welle je Umlauf, die kein Kreis-/Ellipsen-Fit glättet, KUNST-QA LQ-04; Ellipsen leicht verkippt, die Achsen mit versetzter Unruhe).

**Freiraum-Regeln:** Schlaufen in der Rinne haben ihren Mittelpunkt auf der Rinnenmitte und bleiben vollständig in der Rinne (Radius + halbe Linienbreite + 2 px ≤ halbe Rinnenbreite). `lasso` und `contour` laufen nur um Elemente mit mindestens 40 px (lasso) bzw. 16 px (contour) freiem Rand zu jeder Textzeile; das jeweilige Layout (KO-20 Flash-Raster, KO-21 Station, Auftragsarbeiten-Formular) reserviert diesen Rand.

| `LoopKind` | Form | Maße mobil / ab 768 | Einsatz |
|---|---|---|---|
| `right` / `left` | Tropfenschlaufe ca. 330°, im/gegen den Uhrzeigersinn | r = clamp(14, 0.3 × gutter, 22) / 28 px | Stationen Startseite |
| `spiral` | 2,5 Windungen, Radius r → 0.4 r | r = 18 / 26 | Station „Zeichnungen“ („Feder prüft die Tinte“) |
| `lasso` | Ellipse um die obere linke Ecke der Stationszeichnung, 1,1 Umläufe, rx 46, ry 34, −8° | nur ≥ 1200 | Stationen Desktop |
| `orbit` | Ellipse um die Planet-Marke der Kopf-Station, 1 Umlauf, rx = 0.9 × Planetbreite, ry = 0.35 × Planetbreite, −14°; der Teil „hinter“ dem Planeten wird vom papiergefüllten Planetenkörper verdeckt (Planet-SVG liegt über der Linie) | – | Kopf-Station „Planet Claire“ |
| `hook` | Halbschlaufe (180°) um die linke Kante des Knopfs „In den Korb“, Radius = halbe Knopfhöhe + 6 | – | Produktseite |
| `contour` | wackeliges Rechteck mit Eckradius 14 im Abstand 10 px um eine Karte, 1 Umlauf + 8 px Überlappung | – | Tattoo-Flash, Auftragsarbeiten-Formular (`frame`) |
| `heart` | Herz 36 / 48 px, linke Rundung 8 % größer, ein Zug, endet in der Spitze mit 3 px Überstand | – | Danke-Seite |
| `coil` | 3 lockere, übereinanderliegende Schlingen am Boden | Breite 120 / 180 | 404 |

### 9.6 Scroll-Kopplung

- **Lesezeile:** `readingY = scrollY + 0.72 × innerHeight` (Wert aus der Konzeptseite). `innerHeight` wird nur bei Resize neu gelesen; Höhenänderungen < 120 px (Einblenden der mobilen Adressleiste) lösen **keinen** Neuaufbau aus.
- **Abbildung `scrollMap`:** stückweise linear. Vor dem ersten Stations-Anker: `readingY` von 0 bis `station.y` ↦ Länge 0 bis `loopLen0`. An jeder Station bekommt die Schlaufe einen eigenen Scroll-Weg `loopScroll = 140 px` (mobil) / `180 px` (ab 768): `readingY ∈ [station.y, station.y + loopScroll]` ↦ `loopLen0 … loopLen1`. Zwischen Stationen linear bis zum nächsten `loopLen0`. Nach der letzten Station bis `root.h` ↦ `totalLength`.
- **Gezeichnete Länge ist monoton:** `drawnLen = max(drawnLen, map(readingY))`. Tinte wird nie „weggeradiert“; beim Hochscrollen bleibt die Linie stehen.
- **Coco folgt der Lesezeile:** `cocoTargetLen = min(map(readingY), drawnLen)`. Beim Hochscrollen läuft Coco also auf der schon gezeichneten Linie zurück (gespiegelt, Pose `rennen`).
- **Keine Glättung der Linie** (sie folgt dem Scroll exakt). **Coco wird geglättet:** `cocoLen += (cocoTargetLen − cocoLen) × (1 − (1 − 0.35)^(dt/16.7))`; Abstand > 300 px Bogenlänge → Coco springt direkt (kein langes Hinterherrennen).
- **Einstieg mitten in der Seite** (Anker-Link, Zurück-Navigation, Neuladen): `drawnLen` wird ohne Animation auf `map(readingY)` gesetzt.
- **Intro** (nur `journey`): nach dem Aufbau zeichnet sich die Linie von 0 bis `map(readingY₀)` in `--dur-draw` (1800 ms, U-06; `--ease-ink-out`), inklusive Orbit um die Planet-Marke; Coco rennt dabei von links in die Rinne (MI-10).

### 9.7 Presets je Seitentyp

| Preset | Routen (KONZEPT §2.2) | Rinne | Zeichnen | Linienform | Coco | Besonderheiten |
|---|---|---|---|---|---|---|
| `journey` | R01 Startseite | 56 / 88 | scrollgekoppelt + Intro | Rinnen-Serpentine, Schlaufen je Station (Tabelle §11.4), ≥ 1200 zusätzlich `lasso` | an der Spitze, `--coco-leash`, Posen je Station | Orbit um die Planet-Marke der Kopf-Station |
| `about` | R19 Über mich | 44 / 64 | scrollgekoppelt | wie `journey`, 3 Stationen (Jutta, Coco, Werkstatt), Schlaufen `right`/`left` | an der Spitze, Posen `sitzen`, `kopfschief`, `schnueffeln` | „Coco läuft ein kurzes Stück mit“ (KONZEPT §3.12) |
| `shopString` | R02, R03, R05 | 32 / 56 | je Kartenreihe einmal beim Eintritt (IO-Schwelle 0.3), 500 ms `--ease-ink-out`, Richtung der Serpentine; danach Schilder der Reihe schwingen (MI-02, 60 ms versetzt) | **Raster-Seiten (U-07a):** die Leine läuft nur in der Rinne am Seitenrand und kringelt sich je Kartenzeile in der Lücke zwischen den Zeilen (Schlaufe `right`/`left` im Wechsel); sie überquert oder umwickelt nie eine Karte, Ende kurz hinter der letzten Schlaufe (ersetzt die Schnur durch die Preisschilder) | `sitzen` am Schnuranfang über der ersten Reihe, `--coco-m`, Boil 2 s, dann Stillstand | „Mehr zeigen“ hängt Reihen an, bestehende bleiben gezeichnet; Filterwechsel = Neuaufbau ohne Wiederholung schon gezeichneter Reihen |
| `product` | R04 | 0 | einmal, 600 ms, nach LCP + Idle | Unterstreichung des H1 (Titelbreite + 12 px), weiter senkrecht rechts am Preisschild vorbei (Schild `pinned` hängt daran), endet mit `hook` am Knopf „In den Korb“ | `sitzen` in einer reservierten Box 48×40 neben dem Preisschild, `--coco-s`; MI-01 beim Hinzufügen | Kauf-Leiste (KO-09a) ohne Linie und ohne Coco |
| `calm` | R06, R07, R09, R26 | 0 | **nie** (Stufe C) | 1.25 px, Wackel reduziert; Korb: unter der H1 mit Endschleife neben Coco; Kasse: linke Kante der Abschnitte (≥ 768) bzw. unter der H1 | Korb: `sitzen` statisch ohne Boil; Kasse: nur im Countdown (KO-15) | keine View Transition hinein/hinaus |
| `stencil` | R11–R18 | 32 / 56 | je Flash-Karte beim Eintritt einmal, 700 ms | **U-07a:** Rinne am Seitenrand statt `contour` um die Flash-Karten: je Kartenzeile eine Schlaufe in der Lücke zur nächsten Zeile; auf Seiten ohne Flash wie `margin` | `kopfschief` bei der Seiten-H1, `--coco-m`, Boil 2 s | Linie bleibt `--ink`; Violett nur als `--shadow-stencil` an Karten |
| `frame` | R10 Auftragsarbeiten | 0 | einmal beim Eintritt des Formulars, 700 ms | `contour` um das Formular (KONZEPT §3.10) | `sitzen` neben der Formular-Überschrift, `--coco-m`, statisch | Formular selbst ohne Animation |
| `legal` | R21–R25, R27 | 16 / 24 | **nie** (Stufe C) | ruhige, fast gerade Randlinie links vom Text, `--leash-w-calm`, keine Schlaufen | keine | „ruhige Randlinie, keine Animation“ (KONZEPT §3.14) |
| `margin` | R20 Kontakt und alle sonstigen Inhaltsseiten | 16 / 24 | scrollgekoppelt, ohne Schlaufen | leise Randlinie `--leash-w` | keine | – |
| `thanks` | R08 | 0 | einmal 900 ms + Herz 400 ms (MI-09) | ruhiger Bogen vom Kopf zu Coco, endet in `heart` | je Zustand (KO-19), `--coco-xxl` | – |
| `lost` | R28 (404), Variante „Zuhause“ | 0 | einmal 700 ms, danach 2 langsame Schwingungen der losen Schlingen (MI-11) | vom Kopf herab, `coil` am Boden, Ende = offener Karabiner | winzig (24 px) am Horizont, rennt einmal weg | Variante „Zuhause“: statt Karabiner Mini-Preisschild mit „sold“, Coco `sitzen` |

R29 (500) nutzt kein Preset mit Engine: statisches Knäuel-SVG (KO-18).

### 9.8 Seitenübergreifende Kontinuität

- **Leinen-Anschluss:** Jede Linie beginnt an der Unterkante der Kopfleiste (KO-02) bei `x = page-pad + 8` bzw. Rinnenmitte und biegt in einer 24-px-Kurve ins Preset ein. So „kommt“ die Leine auf jeder Seite aus derselben Stelle (E-72).
- **View Transitions (progressive Verbesserung):**
  - Weiche Navigation (App Router): React-`<ViewTransition>` um Seiteninhalt und Coco, falls in den gepinnten Versionen verfügbar (P2-Spike: Import-Name `ViewTransition`/`unstable_ViewTransition`, ggf. `experimental.viewTransition: true` in `next.config.ts`; Ergebnis als ADR in `docs/adr/`). Sonst ohne Übergang.
  - Harte Navigation (z. B. Sprachwechsel, Vorschau-Datei): `@view-transition { navigation: auto; }` **nur** innerhalb `@media (prefers-reduced-motion: no-preference)`.
  - Namen: `view-transition-name: coco` (Coco-Element) und `leash-head` (erste 60 px der Linie). Coco wandert in `--dur-page` (350 ms, `--ease-ink-inout`) von ihrer Position auf der alten Seite zur Startposition der neuen; übriger Inhalt: Überblendung 250 ms.
  - **Keine** Übergänge von/zu `calm`-Routen (Korb, Kasse, Bestellstatus, Widerruf) und bei `data-motion="reduced"`.

### 9.9 Barrierefreiheit und Layout-Regeln

1. Linien-Ebene und Coco: `aria-hidden="true"`, `focusable="false"`, `pointer-events: none`, nicht im Tab-Fluss, kein `role`.
2. Die Linie ist nie Navigation. Jede Station hat eine echte Überschrift und echte Links.
3. **Keine Überdeckung:** Linie und Coco (gemessen wird die gezeichnete Figur, waagerecht 0,10–0,90 der Coco-Box, §10.5) schneiden keine Textzeile (auch nicht in Links/Knöpfen), kein Formularfeld, keinen Knopf, keinen Fußbereich-Link. Einzige Ausnahme: **Block-Links** wie Produktkarten – die Schnur (`shopString`) läuft absichtlich durch deren Schild-Zone zwischen Foto und Titel, nie durch deren Text. Durchsetzung: Rinne (§5.3) bzw. Anker außerhalb von Textflächen; QA-Test LG-01 (KUNST-QA).
4. Mobile Rinne: 56 px (U-05; vorher 44), Linie in Rinnenmitte ± Schwung, Coco 70 px breit (Hund ≈ 0,77 davon, ≈ 54 px) passt in die Rinne; Stationsfotos beginnen an der Rinnenkante; Schlaufen-Radius ≤ 22 px.
5. `content-visibility: auto` ist auf Abschnitten mit Linien-Ankern **verboten** (verfälscht Messungen).
6. Die Linie ändert nie das Layout (absolut positionierte Ebene) → CLS-Beitrag 0.
7. Erzwungene Farben: `fill: CanvasText` für Umriss, Masken entfallen (Stufe C).

### 9.10 Leistungsregeln und Budget

| Regel | Wert / Umsetzung |
|---|---|
| Laden | `runtime` als dynamischer Import nach LCP + Idle (§9.2); nie im Erstlade-Bundle; auf `calm`/`legal`-Seiten wird nur der statische Renderer geladen (≤ 4 KB gz) |
| Budget JS (gzip) | Engine-Chunk (Geometrie + Runtime) ≤ 12 KB · Coco-Steuerung ≤ 3 KB · Mikro-Interaktionen ≤ 4 KB · statischer Renderer ≤ 4 KB |
| Budget SVG | Coco-Sprite ≤ 45 KB roh / ≤ 12 KB gz (externe Datei, gecacht) · Stationszeichnung ≤ 8 KB roh je Stück · alle SVG der Startseite zusammen ≤ 60 KB roh · Icons ≤ 600 B je Stück · erzeugte Pfaddaten im DOM ≤ 60 KB je Seite |
| Keine Fremd-Bibliothek im Standardpfad | Engine und Mikro-Interaktionen mit eigenem Code, CSS und Web Animations API (WAAPI). **GSAP wird standardmäßig nicht verwendet und nicht installiert** (DA-4; ARCHITEKTUR §1.2 führt es nur als Option). Ausnahme nur, wenn P9 nachweist, dass WAAPI für die Startseiten-Choreografie nicht reicht: dann nur `gsap` Core (+ `CustomEase`) als Lazy-Chunk ausschließlich auf R01, ≤ 30 KB gz, mit ADR in `docs/adr/` |
| rAF-Drosselung | Kein Dauer-Loop. Scroll-Event (passiv) setzt ein Flag und fordert **einen** rAF an. Coco-Glättung läuft nur, bis `Math.abs(cocoTargetLen − cocoLen) < 0.1` px. Dann steht der Loop |
| Kein Layout-Thrashing | Messen nur in der Aufbau-Phase (eine Lesephase, dann eine Schreibphase). Im Scroll-Pfad: gelesen werden nur `scrollY` und gecachte Werte; geschrieben werden nur `style.strokeDashoffset` (aktives Segment) und `style.transform` (Coco) |
| Arbeit pro Frame | ≤ 2 ms (Desktop), ≤ 6 ms bei 4× CPU-Drosselung (Pixel-7-Profil) |
| Aufbau | ≤ 8 ms Desktop; bei 4× Drosselung in Idle-Teilstücken, kein Task > 50 ms |
| IntersectionObserver | Runtime inaktiv, wenn Linien-Ebene nicht sichtbar; Boil pausiert außerhalb des Sichtbereichs und bei `document.hidden` |
| Neuaufbau | `ResizeObserver` auf den Seitencontainer (Breite ≥ 1 px oder Höhe ≥ 24 px geändert), `document.fonts.ready`, `load`; entprellt 150 ms, in `requestIdleCallback` (timeout 300). Gezeichneter Fortschritt bleibt je Station erhalten |
| Bilder | alle Bilder mit fester `aspect-ratio`, damit Bildladen keinen Neuaufbau braucht |
| Zeitsteuerung | Zeitbasierte Abläufe nur über WAAPI/CSS (per `document.getAnimations()` anhaltbar) oder rAF mit `performance.now()` (per Playwright-Clock steuerbar) – Voraussetzung für die Frame-Aufnahmen in KUNST-QA |

Messziele im Detail und Messverfahren: KUNST-QA §5.6. Gesamt-Tempoziele: KONZEPT EK-01 (LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms als Gate).

### 9.11 Bewegung reduzieren

- Auslöser: `prefers-reduced-motion: reduce` **oder** `html[data-motion="reduced"]` (§11.7).
- Linie: Stufe C, vollständig gezeichnet, sofort. Kein Intro.
- Coco: Frame A der vorgesehenen Ruhe-Pose (Tabelle §10.6), kein Boil, keine Brücken, kein Hüpfer. Auf `journey`/`about` sitzt Coco an der ersten Station (`sitzen`).
- Keine View Transitions, keine Mikro-Interaktionen (Zustände wechseln sofort), `scroll-behavior: auto`.
- Die Seite ist inhaltlich identisch.

### 9.12 Vorschau-Datei (E-98) und Verhaltensmodule (KONZEPT §12.9)

**Gilt ab P2** (KONZEPT §12.9, ARCHITEKTUR A-11): Alles, was in `planet-claire-vorschau.html` (KONZEPT §12) funktionieren
muss, wird als **framework-unabhängiges Modul** gebaut – ohne Import von `react`, `next/*` oder `payload` (ARCHITEKTUR §2.2,
AK-A-2-03) und ohne Next.js-Router oder React-Zustand für die Kernfunktion. React-Komponenten implementieren dieses Verhalten
nicht selbst, sondern binden dieselben Module ein (im Effekt bzw. über `BehaviorHost`).

- **Verhaltensmodule:** `src/behaviors/<name>.ts` mit `mount(root: Element, ctx?: { mode: 'app' | 'preview' }) → unmount()`,
  angebunden über `data-behavior="<name>"` am serverseitig gerenderten HTML; Dateiname kebab-case = Attributwert, Register
  `src/behaviors/index.ts` (ARCHITEKTUR §9.5, §15.1, AK-A-15-02). In der App lädt `BehaviorHost` nur die benötigten Module per
  `import()`; die Vorschau-Laufzeit `src/preview-runtime/` bündelt sie statisch.
- **Tuschelinie und Coco:** Engine in `src/leash/` (§9.1) mit `mountLeash(root, options) → LeashHandle` und `destroy()`; die
  React-Hülle `LeashLayer` ruft nur diese Funktionen. Bei jedem Hash-Routenwechsel der Vorschau: `unmount()` aller Module und
  `destroy()` der Linie der alten Seite, danach `mount()` und `mountLeash()` für die neue (ARCHITEKTUR §14.6).
- **Bewegung reduzieren:** jedes Modul und die Engine lesen den Zustand über `src/leash/motion.ts` (§9.1) und reagieren auf
  Änderungen ohne Neuladen (§9.11, §11.7).
- **Modus `preview`:** keine Server-Aufrufe, kein Cookie, kein Web-Storage (der Schalter „Animationen“ merkt sich die Wahl nur
  im Speicher), Countdown als Demo ab 30:00, „In den Korb“ spielt MI-01/MI-07 und zählt nur im Speicher, Bestell- und
  Formular-Aktionen öffnen den Vorschau-Dialog (KONZEPT §12.5 Nr. 7).
- **Einbettung:** Coco-Sprite und Stationszeichnungen werden als `<symbol>` inline eingebettet (`<use href="#id">` statt
  `/art/…svg#id`; Symbol-IDs mit Präfix je Sprite, z. B. `coco-`, `station-`, ARCHITEKTUR §14.5); Icons sind ohnehin
  Inline-SVG (§6.5); Schriften als Data-URI; keine Netzwerk-Requests. Die Vorschau wird ohne `NEXT_PUBLIC_LEASH_DEBUG` gebaut (kein `__leash`).

| Modul (`data-behavior`) | Verhalten | Quelle |
|---|---|---|
| `menu` | Menü öffnen/schließen, Fokus, `Esc`, MI-05 | KO-03 |
| `gallery` | Scroll-Snap-Galerie, Knöpfe, Miniaturen, Zähler | KO-09 |
| `lightbox` | Zoom-Dialog, Pinch/Doppeltipp, Zurück-Taste | KO-09 |
| `buy-bar` | Kauf-Leiste mobil, MI-15 | KO-09a |
| `cart-count` | Korb-Anzahl im Kopf (liest nur, wenn `pc_cart` existiert, setzt nichts), MI-07 | KO-02 |
| `add-to-cart` | Rückmeldung „In den Korb“, MI-01 (über `src/leash/coco.ts`) | KO-11 |
| `price-tag-swing` | Preisschild schwingt, MI-02 | KO-05 |
| `sold-stamp` | Stempel-Knall im Verkaufsmoment, MI-03 | KO-06 |
| `reservation-countdown` | Countdown mit Schwellen und Ansagen, MI-08 | KO-15 |
| `copy-button` | „IBAN/Verwendungszweck/Adresse kopieren“, Rückmeldung „Kopiert“ | KO-19, KO-20 |
| `thanks-moment` | Danke-Seite: Einrollen und Herz, MI-09 | KO-19 |
| `lost-leash` | 404: lose Leine und Weglaufen, MI-11 | KO-18 |
| `motion-toggle` | Schalter „Animationen“ | §11.7 |

Die Tabelle nennt die gestalterisch relevanten Module; fachliche Module (z. B. Live-Zustand der Stücke) regeln KONZEPT und
ARCHITEKTUR. MI-10 und MI-12 bis MI-14 steuert die Engine selbst (`src/leash/`); MI-04 läuft über View Transitions (§9.8,
in der Vorschau per `@view-transition` bzw. ohne Übergang); MI-06 (Unterstreichung), MI-16 (Knopf drücken), MI-17 (Karte hebt sich), MI-18 (Menülink rückt ein) und MI-19 (Korb-Bestätigung) sind reines CSS.

**AK-DS-18** Unit-Test (jsdom) je Modul der Tabelle und für `mountLeash`: `mount()` → `unmount()` (bzw. `destroy()`) entfernt
alle eigenen Listener, Observer, Timer und Animationen (`document.getAnimations()` ohne Einträge des Moduls, keine
ausstehenden Timer unter Fake-Timern); ein zweites `mount()` auf neuem DOM funktioniert; im Modus `preview` erfolgt kein
`fetch`/`XMLHttpRequest` und kein Zugriff auf `document.cookie`, `localStorage` oder `sessionStorage`.

### 9.13 Tests der Engine

**Test-Schnittstelle:** Ist beim Build `NEXT_PUBLIC_LEASH_DEBUG=1` gesetzt (ARCHITEKTUR §5.2; E2E-Build in `ci.yml`/`ci-full.yml` Job `e2e-full`, `pnpm art:build`), stellt die Runtime `window.__leash = { geometry, drawnLen(), cocoLen(), tier(), pose(), rebuildCount(), setReadingY(y) }` bereit. Ohne das Flag wird der Code entfernt (Tree-Shaking; Prüfung `pnpm check:no-debug` im Job `quality`: der String `__leash` kommt im Produktions-Build und in der Vorschau-Datei nicht vor, ARCHITEKTUR §6.4, AK-A-14-02). KUNST-QA nutzt dieselbe Schnittstelle.

**AK-DS-12** Vitest: `buildGeometry` ist deterministisch (gleiche Eingabe → gleicher Hash von `outlineD`), `scrollMap` ist in beiden Spalten streng monoton, `lut` ist nach `len` sortiert mit Abstand 4 ± 0.01, jede Station liegt mit `loopLen0 < loopLen1` im Pfad, Breiten liegen in `[0.8, 1.35] × baseWidth`.
**AK-DS-13** Playwright (Chromium, 390×844): Linien-Ebene ist `aria-hidden`, hat keine fokussierbaren Nachfahren; nach Scroll bis zur Seitenmitte ist `drawnLen / totalLength` zwischen 0.35 und 0.75; nach Hochscrollen um 400 px ist `drawnLen` unverändert.
**AK-DS-14** Mit `reducedMotion: 'reduce'`: nach `load` + 1500 ms ist die Linie vollständig (`drawnLen === totalLength`, keine `mask`-Attribute), `document.getAnimations().filter(a => a.playState === 'running').length === 0`.
**AK-DS-15** Resize 390 → 768 → 390 px: Linie wird neu aufgebaut, keine Konsolenfehler, CLS-Einträge während Resize-Neuaufbau: 0.

---

## 10. Coco

### 10.1 Charakterblatt (aus den Fotos)

Referenzen: `highlight-more-ceramics.jpg` (Ganzkörper stehend, Geschirr, Schwanz), `highlight-healed.jpg` (Kopf schief, Ohren), `highlight-flash.jpg` (Ganzkörper hängend, Beine), `highlight-ceramics.jpg` (Auge, Schnauze), `highlight-coco.jpg` (Frontalgesicht, Zähne), `highlight-hi.jpg` (Nase ganz nah = Schnüffeln), `highlight-fleamarket.jpg`, `highlight-tattoos.jpg` (Spielzeug im Maul), `highlight-one-offs.jpg` (lugt hervor), alle in `content/seed/instagram/`. `profil.jpg` zeigt Jutta mit Coco im Arm: nie importiert und nur nach Juttas Freigabe als Zeichenvorlage genutzt (Manifest, §12.4). Weitere Coco-Fotos legt Jutta in `content/seed/coco/` (E-75) → P9 gleicht ab.

**Wesen:** klein, wach, neugierig, ein bisschen frech (zeigt die Zähne), selbstbewusst. Kein Kindchenschema-Kitsch.

**Proportionen** (Einheit **K** = Kopflänge von Hinterkopf bis Nasenspitze, Seitenansicht):

| Teil | Maß | Merkmal |
|---|---|---|
| Schädel | Höhe 0,8 K | **rund** (von vorn fast ein Kreis, Juttas Skizze), deutlicher Stopp zur Schnauze |
| Schnauze | Länge 0,38 K, Höhe an der Wurzel 0,35 K, verjüngt | hell (Papier), kurz bis mittel |
| Nase | 0,13–0,15 K breit | **dick**, schwarz gefülltes Oval (Juttas Skizze) |
| Ohren | Höhe ≈ 0,65 K, Basis 0,45 K | **groß, aufrecht**, breite Basis, Spitzen leicht gerundet, 10–20° nach außen (Juttas Coco-Fotos `content/seed/coco/`, 04.10.2026, gemessen Ohr/Kopflänge ≈ 0,65; vorher 0,95 K nach 150-px-Highlights, dann kurz klein und rund nach der Skizze `coco-oh-01.jpg`); eine Innenohr-Linie; **asymmetrisch** (ein Ohr ≈ 10 % kleiner; bei `kopfschief` knickt eines oben leicht nach außen ab, wie auf den Fotos) |
| Augen | Ø 0,22 K, auf halber Schädelhöhe, weit gesetzt | **groß, rund**, offener Ring mit großer Pupille (Juttas Skizze), schwarz gefüllt mit Glanzpunkt (Papier, Ø 0,06 K, oben seitlich); beide Augen minimal verschieden |
| Stirn | – | feine helle Blesse zwischen den Augen (nur als ausgesparter Wash) |
| Schnurrhaare | 2–3 Striche je Seite | wie Juttas Fuchs: lang, leicht gebogen |
| Körper | Länge (Brust bis Po) 1,9 K, Brusttiefe 0,9 K, Taille 0,6 K | kompakt, tiefe helle Brust, schlanke Taille, Rücken leicht gewölbt |
| Beine | Länge vorn 1,0 K, Breite 0,12 K | **dünn**, gerade; hinten mit Sprunggelenk-Knick; untere Beine hell („Söckchen“); Pfoten kleine Ovale 0,18 K |
| Schwanz | Länge 1,1 K | dünn zur Spitze; stehend/laufend als lockere **Sichel nach oben über den Rücken**; schlafend um den Körper gelegt |
| Fell | Rücken, Kopfoberseite, Ohren außen, Schwanz: `--coco-fur`; Schnauze, Brust, Bauch, untere Beine: Papier | Farbgrenze nur durch den Wash, **ohne** eigene Linie |
| **Geschirr** | Halsring + Bauchgurt hinter den Vorderbeinen + Rückensteg | **rot** `--coco-harness`, Kontur `--ink`; **D-Ring** (Ø 0,1 K) auf dem Rücken zwischen den Schulterblättern = **Leinen-Anker** |
| Gesamthöhe stehend | Widerrist 1,3 K; Ohrspitzen ≈ 2,3 K über Boden (P9.18: große aufrechte Ohren nach Juttas Coco-Fotos, vorher 2,0 K) | – |

### 10.2 Strich (passend zu Juttas Zeichnungen)

- Monoline, `stroke: var(--ink)`, `stroke-width: var(--coco-stroke)` mit `vector-effect: non-scaling-stroke` → gerendert je Größenklasse (§10.5): 1.2 px (Horizont), 1.6 px (S; Leine mobil), 1.8 px (M; Leine ab 768), 2.2 px (XL/XXL). `stroke-linecap: round`, `stroke-linejoin: round`.
- **Handmerkmale je Frame:** 2 offene Stellen in Konturen (Lücke 2–4 Einheiten, z. B. Brust, Rücken); 1–3 Überstände an Verbindungen (Beine an Körper, 1–3 Einheiten); eine Kontur doppelt nachgezogen (Rücken oder Ohr, Versatz 1–1,5 Einheiten); Wackel 0,5–1,5 % der Figurgröße, niedrige Frequenz.
- **Verboten:** perfekte Kreise/Ellipsen (Augen sind leicht eiförmig), Spiegelsymmetrie, Verläufe, Schlagschatten, Umriss-Outline um die ganze Figur.
- **Füllungen:** Fell-Wash `--coco-fur` und Geschirr `--coco-harness` als flache Flächen, um 1,5/1,2 Einheiten nach rechts unten gegen die Linie versetzt (Riso-Versatz, wie Juttas Keramik-Washes). Nase und Pupillen `--ink` voll; Glanzpunkt `--paper`.
- Schlaf-Pose: 4–6 Schraffurstriche als Schatten unter dem Körper (40°).

### 10.3 Posen, Frames, Boil

„Boil“ = Linienzittern durch zyklischen Wechsel von 3 leicht verschieden gezeichneten Frames (A, B, C) derselben Pose.

**Umfang (E-80, verbindlich):** Coco hat **mindestens 6 Posen × 3 Linienzitter-Frames** (die sechs Posen der Tabelle) plus 4
Brücken-Frames. Weniger ist nicht zulässig (die kürzere Posenliste der Konzeptseite gilt nicht, Anhang A.2); weitere Posen
dürfen nur additiv mit eigenen IDs nach §10.4 hinzukommen.

**Posen im CMS und im Code:** Im CMS und in der Datenbank stehen nur die englischen Werte aus `COCO_POSES`
(DATENMODELL §4: `run`, `sniff`, `sit`, `sleep`, `jump`, `head_tilt`). Die Tabelle unten nutzt die Sprite-IDs der Zeichnungen.
Die einzige Abbildung ist `COCO_POSE_TO_SPRITE` in `src/leash/poses.ts`: `run → rennen`, `sniff → schnueffeln`,
`sit → sitzen`, `sleep → schlafen`, `jump → springen`, `head_tilt → kopfschief`. Die Engine (§9.1) arbeitet nur mit
Sprite-IDs (Typ `SpritePose`); Komponenten, die CMS-Daten lesen (z. B. `Station`), übersetzen vorher über diese Abbildung.
Neue Posen kommen immer paarweise dazu (Wert in `COCO_POSES` + Sprite-ID + Eintrag in der Abbildung).

| Pose (`id`) | Beschreibung | Frames | Takt | Schleife | Blick | Einsatz |
|---|---|---|---|---|---|---|
| `rennen` | Galopp, Ohren 20° zurück, Schwanz nach oben/hinten, Körper gestreckt | **A** Streckung (Vorder- und Hinterbeine weit), **B** Sammlung (Beine unterm Körper), **C** Flug (alle Pfoten in der Luft) – der Gangzyklus ist zugleich der Boil | 12 fps (`--run-frame` 83 ms) | ja | Laufrichtung | Leinenspitze in Bewegung, 404 |
| `schnueffeln` | Kopf tief, Nase am Boden, Vorderbeine leicht gebeugt, Schwanz hoch geringelt, Ohren nach vorn | A/B/C Boil; in C Nase 1 Einheit versetzt (Schnüffel-Zucken) | 10 fps | ja | nach unten | Stationen, Korb leer |
| `sitzen` | Seitenansicht wie Juttas Foto: aufrecht sitzend, Brust vorgestreckt, Vorderbeine gerade, Hinterteil abgesetzt, buschiger Schwanz am Boden (P12.4, §10.8) | A/B/C Boil | 10 fps | ja | Betrachter | Stationen, Korb, Countdown, Ruhe-Pose |
| `schlafen` | eingerollter Donut, Nase im Schwanz, Augen als geschlossene Bögen, Ohren angelegt | A/B/C Boil + Atmen (Wrapper `scaleY 1 → 1.03 → 1`, 2,4 s je Zyklus, `--ease-swing`) | 8 fps | Boil nein (2 s), Atmen höchstens 2 Zyklen und nie über das 5-s-Budget hinaus (Danke-Seite: 1 Zyklus) | – | Danke-Seite, „Kein Flash“ |
| `springen` | Luftbogen, Vorderbeine vorgezogen, Hinterbeine gestreckt, Ohren hoch/zurück, Schwanz hoch | A/B/C Boil | 12 fps | nein | Sprungrichtung | Hüpfer „In den Korb“, Station Schmuck |
| `kopfschief` | sitzend, Kopf 20° geneigt, ein Ohr leicht geknickt, Blick zum Betrachter | A/B/C Boil | 10 fps | ja | Betrachter | Menü, leere Zustände, Tattoo, Danke „fehlgeschlagen“ und „leider schon weg“ |

**Brücken-Frames** (je 1 Zeichnung, kein Boil, Dauer je 1 Frame = 83 ms):

| Brücke | Zeigt | verbindet |
|---|---|---|
| `bremsen` | Vorderbeine gestemmt, Körper nach hinten, Ohren vor | `rennen → schnueffeln/sitzen/kopfschief`; ebenso `springen → sitzen/schnueffeln/kopfschief` (Sprung-Sequenz Schmuck, §11.4) |
| `abspringen` | geduckt, Hinterbeine gebeugt | `sitzen/schnueffeln → rennen`, `* → springen` |
| `einrollen-1`, `einrollen-2` | halb liegend → fast rund | `sitzen → schlafen` |

**Übergangsregeln:** Posenwechsel nur an einer Frame-Grenze; zwischen zwei Posen läuft die definierte Brücke (fehlt eine Zeile, direkter Schnitt an der Frame-Grenze plus 1 Frame Stauchung `scaleY(0.94)`). Keine Überblendung (Geisterbilder).

**Boil-Budget (WCAG 2.2.2):** Boil läuft nur (a) während Scroll-Aktivität + 1,5 s Nachlauf, (b) 2 s nach Posenwechsel oder Seiteneintritt, (c) auf der Danke-Seite im Wartezustand 5 s ab Eintritt. Sonst steht Frame A. Keine Bewegung (Boil, Atmen, Abläufe wie MI-09/MI-11) dauert länger als 5 s am Stück ohne Nutzeraktion.

### 10.4 Sprite-Format

- **Quelldatei:** `src/art/coco/coco-sprite.svg` (Ordner `src/art/`, §0), alle Frames als `<symbol>` mit **gleicher** `viewBox="0 0 160 120"`. Referenzfotos und Charakterblatt liegen als Zeichnungsquellen in `content/art/` (ARCHITEKTUR §2.1).
- **IDs:** `coco-{pose}-{a|b|c}` (ASCII: `schnueffeln`, `kopfschief`) und `coco-bridge-{bremsen|abspringen|einrollen-1|einrollen-2}` → mindestens 22 Symbole (6 × 3 + 4).
- **Metadaten** je Symbol: `data-anchor-x`, `data-anchor-y` (D-Ring in viewBox-Einheiten; innerhalb einer Pose über alle Frames ± 2 Einheiten gleich), `data-ground-y` (Pfotenlinie). `pnpm art:sprite` (`scripts/art/build-sprite.ts`, ARCHITEKTUR §6.10) erzeugt daraus `src/art/coco/coco-sprite.json` (IDs, Anker, Bbox, fps) und die ausgelieferte Datei `public/art/coco-sprite.v{N}.svg` (SVGO: `floatPrecision: 1`, IDs erhalten, `viewBox` erhalten). Cache-Header `immutable` (Versionsnummer im Dateinamen).
- **Ebenen je Symbol** (Klassen, damit CSS/erzwungene Farben greifen):

```svg
<symbol id="coco-sitzen-a" viewBox="0 0 160 120" data-anchor-x="78" data-anchor-y="52" data-ground-y="112">
  <g class="fur"     transform="translate(1.5 1.2)"><!-- Fell-Wash, fill: var(--coco-fur) --></g>
  <g class="harness" transform="translate(1.5 1.2)"><!-- Geschirr, fill: var(--coco-harness) --></g>
  <g class="line"><!-- alle Striche: fill none, stroke var(--ink) --></g>
  <g class="solid"><!-- Nase, Pupillen: fill var(--ink) --></g>
  <g class="hi"><!-- Glanzpunkte: fill var(--paper) --></g>
</symbol>
```

```css
.coco .fur     { fill: var(--coco-fur); }
.coco .harness { fill: var(--coco-harness); stroke: var(--ink); stroke-width: var(--coco-stroke); vector-effect: non-scaling-stroke; }
.coco .line    { fill: none; stroke: var(--ink); stroke-width: var(--coco-stroke); vector-effect: non-scaling-stroke; stroke-linecap: round; stroke-linejoin: round; }
.coco .solid   { fill: var(--ink); }
.coco .hi      { fill: var(--paper); }
@media (forced-colors: active) { .coco .fur, .coco .harness { fill: none; } .coco .line { stroke: CanvasText; } }
```

- **Einbindung:**

```html
<div class="coco" data-size="m" data-pose="sitzen" data-boil="on" aria-hidden="true">      <!-- Position: transform (Engine) -->
  <div class="coco__hop">                                                    <!-- Hüpfer/Atmen: WAAPI -->
    <svg viewBox="0 0 160 120" focusable="false">
      <use class="f f-a" href="/art/coco-sprite.v1.svg#coco-sitzen-a"/>
      <use class="f f-b" href="/art/coco-sprite.v1.svg#coco-sitzen-b"/>
      <use class="f f-c" href="/art/coco-sprite.v1.svg#coco-sitzen-c"/>
    </svg>
  </div>
</div>
```

```css
.coco .f { animation: coco-boil calc(var(--boil-frame) * 3) steps(1, end) infinite; }
/* Reihenfolge A → B → C: Frame b ist um 2, Frame c um 1 Frame-Länge vorgespult */
.coco .f-b { animation-delay: calc(var(--boil-frame) * -2); }
.coco .f-c { animation-delay: calc(var(--boil-frame) * -1); }
.coco[data-pose="rennen"] .f, .coco[data-pose="springen"] .f { --boil-frame: var(--run-frame); }
.coco[data-pose="schlafen"] .f { --boil-frame: var(--sleep-frame); }
@keyframes coco-boil { 0% { opacity: 1; } 33.333% { opacity: 0; } 100% { opacity: 0; } }
/* Boil aus = Animation entfernen (NICHT pausieren: eine pausierte Animation kann Frame A auf opacity 0 festhalten) */
.coco[data-boil="off"] .f { animation: none; }
.coco[data-boil="off"] .f-b, .coco[data-boil="off"] .f-c { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .coco .f { animation: none; } .coco .f-b, .coco .f-c { opacity: 0; } }
html[data-motion="reduced"] .coco .f { animation: none; }
html[data-motion="reduced"] .coco .f-b, html[data-motion="reduced"] .coco .f-c { opacity: 0; }
```

- **Körperteil-Markierung (für die automatische Anatomie-Prüfung, KUNST-QA §5.2):** Innerhalb von `.line`, `.solid` und `.harness` sind die Pfade in Untergruppen mit `data-part` gegliedert: `head`, `snout`, `nose`, `ear-l`, `ear-r`, `eye-l`, `eye-r`, `body`, `leg-fl`, `leg-fr`, `leg-hl`, `leg-hr`, `tail`, `harness`, `ring` (D-Ring). Verdeckte Teile (z. B. ein Bein im Sitzen, Augen im Schlaf) werden weggelassen und in `data-hidden-parts="leg-hr eye-l"` am `<symbol>` aufgeführt. SVGO darf diese Gruppen nicht zusammenfassen (`collapseGroups: false`, `removeUnknownsAndDefaults: { keepDataAttrs: true }`).
- **Keine Formen-Primitive:** `<circle>`, `<ellipse>`, `<rect>`, `<line>`, `<polygon>` sind im Sprite verboten – alles sind gezeichnete `<path>` (sonst entstehen perfekte Geometrien).
- Posenwechsel: Coco-Steuerung tauscht die drei `href` an der nächsten Frame-Grenze.
- **Platzhalter bis P9:** P2 liefert alle 22 IDs mit einer vorläufigen Zeichnung (Basis: `coco-run` der Konzeptseite, je Pose grob angepasst). P9 ersetzt nur die Zeichnungen; IDs, viewBox und Anker-Metadaten bleiben → keine Codeänderung nötig.

### 10.5 Größen

| Token | Breite | Einsatz | Strich gerendert |
|---|---|---|---|
| (Horizont) | 24 px | 404, rennt weg | 1.2 px (fester Wert) |
| `--coco-leash` | 70 px mobil / 110 px ab 768 (U-05: +25 % gegenüber 56/88; Boxbreite, der Hund füllt ≈ 0,13–0,90 davon, Rinne `journey`/`about` entsprechend 56 / 88 px) | Leinenspitze (`journey`, `about`) | 1.6 / 1.8 px |
| `--coco-s` | 40 px | Produktseite neben dem Preisschild | 1.6 px |
| `--coco-m` | 72 px | Menü, Korb, Countdown, Shop-Schnuranfang, Tattoo, Formular | 1.8 px |
| `--coco-xl` | 180 px | leere Zustände, 404-Variante „Zuhause“, 500 | 2.2 px |
| `--coco-xxl` | 240 px (mobil max. 60 vw) | Danke-Seite | 2.2 px |

Höhe = Breite × 0,75 (viewBox 160×120). Coco-Boxen haben feste Maße (keine Verschiebung beim Nachladen des Sprites). Die Größenklasse steht als `data-size` am `.coco`-Element und setzt Breite und Strich:

```css
.coco { width: var(--coco-w); aspect-ratio: 4 / 3; }
.coco[data-size="horizon"] { --coco-w: 24px;             --coco-stroke: 1.2px; }
.coco[data-size="leash"]   { --coco-w: var(--coco-leash); /* Strich aus :root: 1.6 px mobil, 1.8 px ab 768 */ }
.coco[data-size="s"]       { --coco-w: var(--coco-s);     --coco-stroke: 1.6px; }
.coco[data-size="m"]       { --coco-w: var(--coco-m);     --coco-stroke: 1.8px; }
.coco[data-size="xl"]      { --coco-w: var(--coco-xl);    --coco-stroke: 2.2px; }
.coco[data-size="xxl"]     { --coco-w: min(var(--coco-xxl), 60vw); --coco-stroke: 2.2px; }
```

### 10.6 Ruhe-Posen (reduzierte Bewegung, ohne JS)

| Ort | Pose, Frame A |
|---|---|
| Startseite, Über mich | `sitzen` an der ersten Station |
| Shop-Schnur, Korb, Countdown, Formular (`frame`), Produktseite | `sitzen` |
| Shop leer, Archiv leer, 404-Variante „Zuhause“, Danke (wartet, Vorkasse offen) | `sitzen` |
| Menü, Tattoo (`stencil`), Kategorie leer, 500, Danke (fehlgeschlagen, leider schon weg) | `kopfschief` |
| Korb leer | `schnueffeln` |
| Kein Flash, Danke (bezahlt) | `schlafen` |
| 404 | nicht sichtbar (weggelaufen) |

Maßgeblich für leere Zustände und die Danke-Seite sind die Tabellen in KO-17 und KO-19; diese Tabelle fasst sie nur zusammen.

### 10.7 Herstellung der Coco-Zeichnungen (P9)

1. Referenzblatt: die 9 Coco-Fotos aus §10.1 (`content/seed/instagram/highlight-*.jpg`) und Juttas Fotos aus `content/seed/coco/` (falls geliefert) nebeneinander; `profil.jpg` nur nach ihrer Freigabe; Maße nach §10.1 als Hilfslinien.
2. Pro Pose zuerst Frame A als sauberes SVG (Stift-Pfade, keine Formen-Primitive wie `<circle>` für Augen – Augen als gezeichnete Pfade).
3. Frames B und C: Kopie von A, **jede** Linie neu nachgezeichnet (nicht verschoben!) mit Abweichung 0,5–1,5 Einheiten, gleiche Anatomie, gleicher Anker (± 2).
4. `rennen`: drei echte Gangphasen (§10.3), Silhouette wechselt deutlich; Anker bleibt am Rücken.
5. Prüfung gegen KUNST-QA §5.2 (Anatomie) und §5.1 (Strich) – inklusive IoU-Messung zwischen Boil-Frames.
6. Juttas Stil ist Vorlage, **keine** Kopie fremder Figuren; Coco ist ihr eigener Hund (E-18 unkritisch).

### 10.8 Erweiterungen P12.4 (U-02 … U-07a)

- **Sitzen/Kopf schief** sind **Seitenansicht** (Blick nach rechts) nach Juttas Foto „Profil sitzend“ (`content/seed/coco/`): Brust leicht vorgestreckt, gerade Vorderbeine, Hinterteil seitlich abgesetzt (Oberschenkel mit nach vorn gelegter Hinterpfote), buschiger Schwanz am Boden, große aufrechte Ohren – nicht katzenhaft. Die ¾-Ansicht entfällt; Anker `sitzen` (80|65,5).
- **Knickohr (U-07):** Cocos rechtes Ohr ist in **allen** Posen geknickt (Außenkante mit Knick im oberen Drittel, Spitze hängt nach hinten); in der Seitenansicht ist es das hintere Ohr, in der Einroll-Pose (Blick nach links gezeichnet) das vordere. Ausnahme: Frame B der Aktion „Ohr zucken“ (kurzes Aufspitzen). Geometrie-Test `tests/unit/art/knickohr.unit.spec.ts` (Striche tragen `knick`).
- **Zusatz-Posen** in der **nachgeladenen** Datei `public/art/coco-extra.v{N}.svg` (≤ 60 KB roh / ≤ 14 KB gz; Quelle `src/art/coco/coco-extra.svg`, Anker `coco-extra-anchors.json`; geladen 3,5 s nach dem Einhängen der Coco, nur mit voller Bewegung, nie in der Vorschau-Datei): Warte-Aktionen `hecheln`, `zucken` (Kopf schief + Ohr zucken), `kratzen` (Hinterbein hinterm Ohr), `gaehnen`, `wedeln`; neue Posen `verbeugung` (Spielverbeugung, zugleich „Strecken“), `schuetteln`, `freude` (Hüpfer mit Drehung: A Absprung, B von vorn gestaucht, C gespiegelte Landung), `liegen` (Rücken am Boden, Bauch hoch, Pfoten übereinander). Je 3 Frames im Strich der Haupt-Posen; Takt je Pose in `coco.css`.
- **Steuerung** `src/leash/cocoExtra.ts` (eigener Chunk ≤ 2,5 KB gz): beim Stillstand in `sitzen`/`kopfschief` gestaffelt ab Beginn der Ruhe: 4 s Hecheln · 9,5 s Ohr zucken · 15 s Kratzen · 21,5 s Gähnen · 25,5 s Strecken · 32 s Wedeln · 45 s Hinlegen, dann Einrollen und Schlafen; jede Aktion ≤ 5 s, dazwischen Standbild. Jede Bewegung der Leine bricht die Aktion ab. Ereignis `pc:coco-joy` (Korb gefüllt, Bestellung abgeschickt) löst den Freudenhüpfer aus. Reduzierte Bewegung: nichts davon (Standbild).
- **Größe (U-05):** `--coco-leash` 70 px mobil / 110 px ab 768 (+25 %), Rinne `journey`/`about` 56 / 88 px; Strich 1,6 / 1,8 px (`--coco-sw` 3,7 / 2,6).
- **Tempo (U-06):** Tuschelinie doppelt so langsam (§9.4, §9.6, §11.3); **Raster-Seiten (U-07a):** Rinne 32 / 56 px am Seitenrand, Leine nur dort, eine Schlaufe je Kartenzeile zwischen den Zeilen (§9.7 `shopString`, `stencil`).

### 10.9 Fitness-Coco und Koko (P12.5, P12.6; U-09, U-08)

- **Fitness-Coco** (Station „Hallo“ der Startseite, ersetzt die große sitzende Coco): sieben Übungen nach `content/art/jutta-skizzen/FITNESS-COCO.md` in Juttas Reihenfolge (Body wave, Body bounce, Single arm raises, Body bounces with hip rotation, Chest opener, Straight arm trunk twist, Arm raises both arms), danach liegt Coco erschöpft ausgestreckt mit Zunge; Endlosschleife (≈ 42 s). Je Übung ≈ 5 s und 12–20 gezeichnete Zwischenbilder (10 Bilder/s, jedes Bild neu nachgezogen = Zittern), vor jeder Übung ein weicher Übergang (3 Bilder). Tuschelinie schwarz, **zarter oranger Buntstift-Strich** im Fell (kreuzfreie Schraffur, gestrichelt = Papierkörnung, die Linie bleibt schwarz); weiße Brust/Pfoten bleiben Papier; Bodenlinie dick und mehrfach übermalt; **keine Beschriftung**; rechtes Ohr geknickt. Standbild als `<img>` (`public/art/fitness-still.v{N}.svg`, ≈ 3 KB, feste Box 4:5 – kein Inline-SVG, damit „SVG der Startseite ≤ 60 KB“ hält), Bildfolge `public/art/fitness-coco.v{N}.json` (≤ 150 KB gz) nach dem `load` per Modul `fitness-coco`, gespielt auf einer Leinwand (`Path2D`) über dem Standbild; pausiert im verborgenen Tab, außerhalb des Bildes und bei „Animationen aus“/reduzierter Bewegung (dann Standbild). Alt-Text DE/EN (`home.fitnessAlt`). Quelle: `pnpm art:fitness` (`scripts/art/fitness-coco.ts`).
- **Koko, Vorsitzende der Goth Dogs Berlin** (Vorlage T-Shirt-Malerei, freigestellt, ohne Knochenkreuz): schwarzes Fell mit Tuschestrich-Struktur, orange Flächen, weiße Brust/Pfoten, Narrenkappe mit grünen Bommeln, Seitenblick-Augen; **nur die Pupillen bewegen sich** (9 s, links → rechts → links, `--ease-swing`), Standbild bei reduzierter Bewegung. Komponente `ChairwomanKoko` (Hero-Zeile, rechts; mobil darunter; Platz `data-slot="chairwoman"`), Zeichnung als `<img>` `public/art/koko.v{N}.svg` (≈ 9 KB, `pnpm art:koko`; Pupillen sind zwei CSS-Elemente darüber, Positionen in `src/art/koko/koko.json`), Alt-Text „Koko, Vorsitzende der Goth Dogs Berlin“ (DE/EN).

---

## 11. Bewegung

### 11.1 Prinzipien

1. **Tinte zuerst, Bewegung danach:** Beim LCP ist alles vollständig und statisch lesbar. Kein Preloader, kein Intro vor dem Inhalt.
2. **Von Hand, nicht von der Maschine:** eigene Easings (§11.2), Line Boil mit 8–12 fps, kleine gesäte Zeitversätze (0–20 ms) bei Staffelungen.
3. **Kurz:** Mikro-Interaktionen 120–360 ms, Seitenwechsel 350 ms, Zeichnen ≤ 2,4 s (U-06: die Tuschelinie baut sich doppelt so langsam auf). Nichts läuft > 5 s ohne Nutzeraktion.
4. **Bewegung mit Bedeutung:** Linie = Weg/Leine · Schwingen = Preisschild „lebt“ · Stempel = verkauft · Hüpfer = in den Korb · Einrollen = fertig/gut aufgehoben · Weglaufen = Seite fehlt.
5. **Nur Compositor-freundlich:** `transform`, `opacity`; SVG-Enthüllung über `stroke-dashoffset` (nur aktive, kleine Segmente). Nie `width/height/top/left/margin`, nie `box-shadow`-Animationen, nie Filter-Animationen.
6. **Kein Scroll-Jacking:** keine Pins, kein Einfangen, kein Parallax. Die Seite scrollt normal.
7. **Kein Ton**, keine Autoplay-Videos.

### 11.2 Easing-Tokens

| Token | `cubic-bezier` | Charakter | Einsatz |
|---|---|---|---|
| `--ease-ink-out` | `(0.3, 0.7, 0.2, 1)` | Feder setzt schnell an und läuft weich aus | Zeichnen, Eintritte, Unterstreichung, Menü öffnen |
| `--ease-ink-in` | `(0.5, 0, 0.75, 0.2)` | zögerlich, dann weg | Austritte (selten) |
| `--ease-ink-inout` | `(0.6, 0, 0.3, 1)` | ruhiges Hin und Her | View Transition (Coco) |
| `--ease-stamp` | `(0.18, 1.6, 0.4, 1)` | Überschwinger | Stempel, Marken-„Pop“, Korbzahl |
| `--ease-hop-up` | `(0.15, 0.75, 0.35, 1)` | Absprung | Hüpfer aufwärts |
| `--ease-hop-down` | `(0.55, 0, 0.85, 0.35)` | Schwerkraft | Hüpfer abwärts |
| `--ease-swing` | `(0.45, 0, 0.55, 1)` | Pendel je Teilstück | Schwingen, Atmen, lose Leine |
| `--ease-calm` | `(0.2, 0, 0, 1)` | unauffällig | Kauf-Leiste, Überblendungen |
| `linear` | – | – | **nur** scrollgekoppelte Abbildung, `steps()`-Boil und gleichförmiger Laufweg (MI-11) |

`ease`, `ease-in`, `ease-out`, `ease-in-out` sind im Projekt verboten (Lint AK-DS-16).

### 11.3 Dauer-Tokens

| Token | Wert | Einsatz |
|---|---|---|
| `--dur-micro` | 120 ms | Chip-/Knopf-Zustand |
| `--dur-short` | 200 ms | Kauf-Leiste, Überblendung |
| `--dur-medium` | 320 ms | Menü-Links (einzeln) |
| `--dur-long` | 600 ms | Produktseiten-Linie |
| `--dur-draw` | 1800 ms | Intro-Linie, Danke-Linie (U-06: doppelt so langsam wie in P9) |
| `--dur-draw-max` | 2400 ms | Obergrenze jeder Zeichen-Animation |
| `--dur-page` | 350 ms | View Transition Coco |
| `--dur-underline` | 280 ms | gezeichnete Unterstreichung |
| `--dur-swing` | 900 ms | Preisschild-Schwingen |
| `--dur-stamp` | 260 ms | Stempel |
| `--dur-hop` | 360 ms | Coco-Hüpfer |
| `--dur-menu-open` / `--dur-menu-close` | 420 / 180 ms | Menü |
| `--stagger` | 40 ms | Staffelung (+ 0–20 ms gesäter Versatz) |
| `--boil-frame` / `--run-frame` / `--sleep-frame` | 100 / 83 / 125 ms | Boil 10 fps / Lauf und Sprung 12 fps / Schlafen 8 fps |

### 11.4 Choreografie der Startseite (Preset `journey`)

Auslöser „Lesezeile erreicht Anker“ = `readingY ≥ station.y` (§9.6). „Verweilen“ = Lesezeile im Stationsbereich `[y − 40, y + loopScroll + 80]` und 1,2 s kein Scroll.

| # | Station (KONZEPT §3.1) | Anker | Linie | Coco-Pose (Ankunft → Verweilen) | Timing | Extra |
|---|---|---|---|---|---|---|
| 0 | **Planet Claire** (Kopf) | Planet-Marke neben der H1 | Intro: Leinen-Anschluss → `orbit` um die Planet-Marke → Rinne | rennt von links herein (`rennen`, 600 ms) → `bremsen` → `sitzen`; nach 1,2 s Verweilen einmal `kopfschief` (3 s), dann `sitzen` | Start: LCP + 300 ms Idle; Linie 900 ms `--ease-ink-out` | Planet „pop“ (MI-12) beim Schließen des Orbits |
| 1 | **Hallo** | Kicker der Station | kleine `right`-Schlaufe | `bremsen` → `sitzen` (schaut zum Text) | Schlaufe über 140/180 px Scroll | – |
| 2 | **Keramik** | Ecke der Stationszeichnung | `right`; ≥ 1200 `lasso` um die Zeichnung | `bremsen` → `schnueffeln` | wie oben | Stationsmarke Planet „pop“ (MI-12) |
| 3 | **Textil** (inkl. Caps) | Ecke der Stationszeichnung | `left` | `bremsen` → `schnueffeln` → nach 1,5 s Verweilen `kopfschief` | wie oben | Stern dreht sich einmal 15° (MI-12) |
| 4 | **Zeichnungen** | Ecke der Stationszeichnung | `spiral` (Feder prüft die Tinte) | `bremsen` → `sitzen` | Spirale über 180/220 px Scroll | Stationszeichnung „zieht ein“: Masken-Wisch von links, 700 ms, einmal (MI-13) |
| 5 | **Schmuck** | Anhänger-Foto/Zeichnung | kleine `right`-Schlaufe wie eine Kette, am Schlaufenende ein Tintenpunkt („Perle“) | `abspringen` → `springen` → `bremsen` → `sitzen` (einmal, 415 ms: `abspringen` 83 + `springen` A/B/C 3 × 83 + `bremsen` 83) | Sprung beginnt bei `loopLen1` | – |
| 6 | **Tattoo** | Flash-Zeichnung | `contour` um die Flash-Zeichnung (Stencil-Anmutung, Tusche) | `bremsen` → `kopfschief` | Kontur über 200/240 px Scroll | Flash-Karte bekommt einmal `--shadow-stencil` (MI-14) |
| 7 | **Jutta & Coco** | Coco-Zeichnung der Station | `left`-Schlaufe endet neben der gezeichneten Coco der Station | `bremsen` → `sitzen` (zwei Cocos: die gezeichnete sitzt still, die laufende setzt sich daneben) | – | – |
| 8 | Ende | oberhalb des Fußbereichs | Linie läuft in der Rinne aus und verlässt den Sichtbereich nach unten (Anschluss an die nächste Seite) | `sitzen`, Blick zum Betrachter | – | Linie kreuzt keinen Fußbereich-Link |

Zwischen Stationen: `rennen` (12 fps), Blickrichtung nach Schwung der Linie (Umschalten erst nach 24 px Bogenlänge in neuer Richtung). Beim Hochscrollen: `rennen` gespiegelt; Scrollstopp > 1,2 s: `sitzen`.

### 11.5 Katalog der Mikro-Interaktionen

| ID | Name | Auslöser | Ablauf | Dauer / Easing | Eigenschaften | Reduzierte Bewegung | Nie auf |
|---|---|---|---|---|---|---|---|
| MI-01 | Hüpfer „In den Korb“ | Server bestätigt „In den Korb“ | Coco (`--coco-s`): `abspringen` (83 ms) → `springen` mit `translateY(0 → −14px)` 140 ms `--ease-hop-up`, zurück 220 ms `--ease-hop-down`, Landung `scaleY(0.92)` 80 ms → `sitzen` | 83 + 360 + 80 ms | transform | kein Hüpfer, Zustandstext sofort | Kauf-Leiste, Korb, Kasse |
| MI-02 | Preisschild schwingt | Reihe tritt erstmals in den Sichtbereich; Hover/Fokus der Karte (feiner Zeiger) | Pendel um die Öse: Winkel `a → a+5° → a−3.5° → a+1.5° → a` bei 0/20/45/70/100 % | 900 ms, `--ease-swing` je Teilstück | transform (rotate) | aus | Korb, Kasse, Tattoo |
| MI-03 | Stempel-Knall | Moment des Verkaufs (KO-06) | `scale 1.8 / rotate −22° / opacity 0` → 60 %: `scale 0.94 / −13° / 1` → `scale 1 / −14°`; danach Schild-Ruck `translateY(1.5px)` 80 ms; höchstens 3 Knalle je Seitenansicht, gestaffelt 120 ms | 260 ms `--ease-stamp` + 80 ms | transform, opacity | Stempel sofort statisch | Archiv-/Shop-Seitenaufruf, Kasse |
| MI-04 | Seitenübergang | Seitenwechsel (weich und hart) zwischen nicht-ruhigen Routen | Coco **reist mit** (P12.12, U-23): beim Aufbruch Lauf-Pose `rennen`; mit Gegenstück (Startseite ↔ Über mich) wandert sie von der alten zur neuen Leinenspitze (View Transition `coco`) und steht auf der neuen Seite sofort am Linienanfang (`data-arrived`: kein Hereinrennen von links); ohne Gegenstück läuft sie nach rechts hinaus bzw. von links herein (`pc-coco-away`/`pc-coco-in`, 72 px, Opacity); Rest überblendet | 350 ms `--ease-ink-inout` / 250 ms `--ease-calm` | VT-Pseudo-Elemente | aus | von/zu `calm`-Routen |
| MI-05 | Menü öffnen/schließen | Menü-Knopf / Schließen | Öffnen: `clip-path: circle(0 at <Knopfmitte>) → circle(150vmax)` 420 ms `--ease-ink-out`; Links `opacity 0→1`, `translateY(10px→0)` je 320 ms, gestaffelt `--stagger` + 0–20 ms Seed, Summe ≤ 700 ms; Coco schiebt sich unten rechts herein (`translateY(100% → 0)`, 300 ms, Verzögerung 200 ms, Pose `kopfschief`). Schließen: `opacity 1→0` 180 ms, ohne Staffel | s. links | clip-path, opacity, transform | sofort | – |
| MI-06 | Unterstreichung zeichnen | Hover (feiner Zeiger), `:focus-visible`, `:active` auf Navigationslinks | Pfad `stroke-dashoffset 1 → 0` (normiert), beim Verlassen `opacity → 0` 150 ms (nie rückwärts „radieren“) | 280 ms `--ease-ink-out` | stroke-dashoffset, opacity | Unterstreichung sofort sichtbar bei Fokus/Hover | Fließtext-Links (dort normale `text-decoration`), Kasse |
| MI-07 | Korbzahl hüpft | Anzahl im Kopf ändert sich | `scale 1 → 1.25 → 1` | 240 ms `--ease-stamp` | transform | Zahl wechselt sofort | – |
| MI-08 | Countdown | Sekundentakt | nur Textwechsel, Farbwechsel an Schwellen ohne Übergang | – | – | gleich | – (ist keine Animation) |
| MI-09 | Danke: Einrollen + Herz | Zahlung bestätigt (KO-19) | Linie läuft 900 ms zu Coco, Herz 400 ms (`--ease-ink-out`); Coco `sitzen → einrollen-1 → einrollen-2 → schlafen` (je 1 Frame), dann Atmen 1 × 2,4 s; Stempel-Knall auf Mini-Schildern (MI-03) | ≤ 1,4 s + 2,4 s ≤ 5 s | stroke-dashoffset, transform | alles statisch im Endzustand | – |
| MI-10 | Coco rennt herein | Intro Startseite | von `x = −60` in die Rinne, `rennen` 12 fps, 600 ms `--ease-ink-out`, dann `bremsen` (83 ms) → `sitzen` | 600 + 83 ms | transform | Coco sitzt sofort | – |
| MI-11 | Lose Leine / Weglaufen (404) | Seitenaufruf | Linie 700 ms; danach Schlingen schwingen 2 × 1200 ms (`rotate ±2°` um den Aufhängepunkt, `--ease-swing`); Coco (24 px, `data-size="horizon"`) rennt einmal am Horizont von der Bildmitte nach rechts aus dem Bild, 2,4 s `linear` (Weg), Frames im 12-fps-Takt | ≤ 5 s gesamt | transform, stroke-dashoffset | statisch, Coco nicht sichtbar | – |
| MI-12 | Stationsmarke „pop“ | Linie passiert die Marke | Planet: `scale 0.6 → 1` 240 ms `--ease-stamp`; Stern: `rotate 0 → 15°` 400 ms `--ease-swing`, einmal | ≤ 400 ms | transform | aus | – |
| MI-13 | Stationszeichnung zieht ein | Station 4 erreicht | `clip-path: inset(0 100% 0 0) → inset(0 0 0 0)` | 700 ms `--ease-ink-out` | clip-path | sofort sichtbar | – |
| MI-14 | Stencil-Abdruck | Station 6 erreicht; Hover/Fokus Flash-Karte | `--shadow-stencil` erscheint (Startseite: `opacity` eines Pseudo-Elements 0 → 1 in 400 ms; Tattoo-Seiten: sofort ohne Übergang) | 400 ms `--ease-calm` / 0 | opacity | sofort | – |
| MI-15 | Kauf-Leiste | KO-09a | `translateY(100% → 0)` | 200 ms `--ease-calm` | transform | sofort | – |
| MI-16 | Knopf drücken | `:active` Primärknopf (nicht Kasse) | `translate(2px,2px)` + Schatten 1 px | 80 ms `--ease-calm` | transform, box-shadow (Sprung, keine Animation des Schattens: Schatten wechselt diskret) | ohne Übergang | Kasse |
| MI-17 | Karte hebt sich | Hover (feiner Zeiger) und `:focus-visible` einer Produktkarte (Shop-Listen, Startseite) | Foto-Rahmen `translate 0 → 0 −3px`, zurück beim Verlassen | 200 ms `--ease-ink-out` | translate | aus (Transition entfällt) | Ruheseiten, Tattoo-Seiten ohne Karten |
| MI-18 | Menülink rückt ein | Hover (feiner Zeiger) und `:focus-visible` der Hauptlinks im Menü-Overlay | `translate 0 → 6px 0` (frei von MI-05, das `transform` nutzt) | 200 ms `--ease-ink-out` | translate | aus | – |
| MI-19 | Korb-Bestätigung gleitet ein | „Liegt in deinem Korb“ erscheint nach dem Hinzufügen (3 s sichtbar) | `opacity 0 → 1`, `translate 0 6px → 0` | 200 ms `--ease-ink-out` | opacity, translate | sofort sichtbar | Kasse, Korb |

### 11.6 Was sich **nie** bewegt

| Bereich | Regel |
|---|---|
| Kasse (R07) inkl. Zahlungsfeld, Übersicht, Knopf „Zahlungspflichtig bestellen“ | keine Animation, keine Transition, kein Boil, keine View Transition (AK-DS-11) |
| Warenkorb (R06), Bestellstatus (R09), Vertrag widerrufen (R26) | wie Kasse; einzige Ausnahme im Kopf: MI-07 |
| Rechtsseiten (R21–R25, R27) | Stufe C, keine Mikro-Interaktion, kein Coco |
| Verwaltung (Payload + eigene Handy-Ansichten) | keine eigenen Animationen (Payload-Standard bleibt) |
| Formular-Validierung, Fehler, Erfolgsmeldungen | erscheinen sofort |
| Preise, Summen, Zähler (außer Korbzahl MI-07) | nie hochzählen/animieren |
| Fußbereich und Pflichtlinks | nie animiert, nie verdeckt |
| Bilder | kein Einblenden, kein Ken-Burns, kein Hover-Zoom |
| E-Mails, PDFs | statisch |
| Dauerhaft | kein Blinken > 3/s, keine Endlosschleife > 5 s ohne Nutzeraktion |

**AK-DS-16** Lint-Test: kein `ease`, `ease-in`, `ease-out`, `ease-in-out` als Timing-Funktion in `src/`; keine `@keyframes`, die `width`, `height`, `top`, `left`, `margin` oder `box-shadow` animieren; keine `transition` in den Stylesheets der Ruheseiten R06, R07, R09, R26, R21–R25, R27 (ihre Routenordner unter `src/app/(frontend)/[locale]/` laut ARCHITEKTUR §2.1, englische Ordnernamen, keine eigene Routengruppe; der Ruhe-Modus kommt über Layout/Props) und unter `src/components/checkout/`; die Laufzeitprüfung macht AK-DS-11.

### 11.7 Schalter „Animationen“

- Im Fußbereich (KO-04): Knopf „Animationen: an“ / „Animationen: aus“ (EN „Animations: on/off“), `aria-pressed`.
- Wirkung: setzt `html[data-motion="reduced"]` (gleiche Wirkung wie `prefers-reduced-motion`, §9.11) bzw. `full`.
- Standard: aus der Systemeinstellung. Ist das System auf „reduzieren“ gestellt, zeigt der Knopf „aus (Systemeinstellung)“ und kann ausdrücklich eingeschaltet werden.
- Speicherung **nur nach Klick** in `localStorage` Schlüssel `pc-motion` (`"full"`/`"reduced"`), in `try/catch` (ARCHITEKTUR §8.7); ein Inline-Skript im `<head>` liest den Wert vor dem ersten Rendern. CSP (ARCHITEKTUR §8.1, R-131): im Kontext `public` steht der `sha256`-Hash dieses festen Skripts in `script-src` (`src/lib/security/csp.ts`), in den Kontexten `dynamic`/`checkout` trägt es die Nonce. Vor dem Klick wird nichts gespeichert (E-43; erlaubter Speicher Zeile a der abschließenden Liste in `docs/recht/ANFORDERUNGEN.md` R-130; KONZEPT EK-04 bleibt erfüllt). **Hinweis für P6:** Schlüssel im Datenschutz-Dienste-Verzeichnis aufführen (Zweck: vom Nutzer gewünschte Darstellung).
- Umsetzung als Verhaltensmodul `motion-toggle` (§9.12). In der Vorschau-Datei merkt sich der Schalter die Wahl nur im Speicher (kein Web-Storage, ARCHITEKTUR §14.6).

---

## 12. Bildwelt

### 12.1 Produktfotos – Art Direction

Für Juttas Handbuch (P10) und die Beispielbilder (P8):

| Regel | Vorgabe |
|---|---|
| Format | **Hochformat 4:5** (Instagram-Hochformat), Stück mittig, 10–15 % Luft rundum |
| Licht | Tageslicht (Fensternähe), keine Blitze, kein Kunstlicht-Mix; harte Sonne erlaubt, wenn Schatten das Stück nicht verdecken |
| Untergrund | Papier (hell) oder **grüne Schneidematte** – beides Markenwerte; keine Muster-Tischdecken |
| Reihenfolge | **1. Foto = Titelbild** (ganzes Stück, gerade oder 30° von oben) · 2. Detail (Strich, Glasur, Stoff) · 3. Größenvergleich (Hand oder Matten-Raster) · weitere: Rückseite/Boden, getragen (Textil, optional) |
| Anzahl | 1–12 (KONZEPT §3.4); empfohlen 3–5 |
| Verboten | Filter, Text-Einblendungen im Bild (Maße gehören ins Feld), Wasserzeichen, fremde Marken/Figuren im Bild (E-18), Gesichter anderer Personen |
| Alt-Text | Pflichtfeld (DE/EN): Objekt, Motiv, Farbe, z. B. „Weiße Keramikschale, innen zwei Hunde in schwarzer Tusche“ |

### 12.2 Automatische Bild-Pipeline

| Schritt | Phase | Umsetzung |
|---|---|---|
| 1 Verkleinern im Browser | P1 | ≤ 2560 px lange Kante, JPEG q 0.85 (Upload-Regeln ARCHITEKTUR §8.8) |
| 2 Normieren | P1 | sharp: `rotate()` (EXIF-Orientierung), in sRGB wandeln, **alle Metadaten entfernen** (EXIF/GPS), Original als WebP q 90, `fit: inside` 2560 (maßgeblich: `docs/DATENMODELL.md`, Collection `media`) |
| 3 Zuschnitt 4:5 am Fokuspunkt | P1 | nur für `thumb` und `card`: größtmögliches 4:5-Rechteck, zentriert auf `focalX/focalY` (Payload-Fokuspunkt, Standard 50/50), an den Rändern begrenzt; nie auffüllen, nie hochskalieren. `detail` und `zoom` behalten das Originalformat |
| 4 Weißabgleich | **P9** | Neutralpunkt aus „hellen, unbunten“ Pixeln (L* im oberen 5 %-Quantil **und** Chroma < 12 in Lab); Kanal-Verstärkung, begrenzt auf **[0.92, 1.08]** (P9.17: zwei Durchgänge – der zweite wählt die unbunten Pixel auf dem schon abgeglichenen Bild neu; Gesamtverstärkung bleibt in den Grenzen); bei < 0,5 % geeigneten Pixeln (z. B. alles grüne Matte) **kein** Abgleich. Kategorie `drawing` halbe Stärke |
| 5 Belichtung | **P9** | Median-L* des mittleren 60 %-Bereichs → Ziel **62 ± 6** (nur korrigieren, wenn der Median außerhalb 56–68 liegt); Gamma `γ = ln(Ziel/100) / ln(Median/100)`, begrenzt auf **[0.7, 1.25]** (P9.17: vorher 0,8 – dunkle Instagram-Fotos mit Median-L* ≈ 40 blieben bei ≈ 47 und verfehlten IM-02 σ ≤ 6), angewandt als Tonwertkurve `v' = v^γ` auf R, G, B (normiert 0–1, per Lookup-Tabelle); wenn danach > 1 % Pixel clippen, Abstand von γ zu 1 halbieren |
| 6 Schalter je Bild | P9 | Feld `enhance` (`auto` oder `off`, Standard `auto`; DATENMODELL `media`), Vorher/Nachher-Vorschau in der Verwaltung |
| 7 Größen | P1 | wie DATENMODELL `media.imageSizes`: `thumb` 400×500 und `card` 800×1000 (4:5, WebP) · `detail` Breite 1600 und `zoom` Breite 2560 (Originalformat, WebP) · `og` 1200×630 (JPEG). `withoutEnlargement`: fehlende Größen entfallen im `srcset` |
| 8 Dominanzfarbe, LQIP | P1 | `sharp.stats().dominant` → Feld `dominantColor` für den Lade-Hintergrund (KO-07); `placeholderDataUrl` laut DATENMODELL |
| 9 OG-Bild | P3 | §12.6 (zusammengesetztes Bild per `next/og`); die `og`-Größe der Media-Collection ist der Rückfall |

Budgets (Median über den Beispielbestand): `thumb` ≤ 40 KB, `card` ≤ 90 KB; das im Profil Pixel 7 tatsächlich geladene LCP-Bild der Produktseite ≤ 120 KB. Die Instagram-Seed-Bilder sind max. 640 px breit → nur `thumb` entsteht vollständig, größere Größen entfallen (`withoutEnlargement`); Produktseiten wirken bis zum Datenexport (E-64) weicher – bekannte Grenze.

**Galerie-Einbindung (KO-09):** Folien sind 4:5 mit `object-fit: cover` und `object-position: {focalX}% {focalY}%`; `srcset` aus `card` (800w) und `detail` (1600w). Die Lightbox zeigt `zoom` (bzw. das größte vorhandene) im Originalformat, uneingeschnitten.

**AK-DS-17** Vitest mit Fixture-Bildern: `thumb`/`card` haben Seitenverhältnis 0,800 ± 0,002, `detail`/`zoom` das Seitenverhältnis des Originals ± 0,01, keine EXIF/GPS-Daten (`sharp().metadata()` ohne `exif`), Kanal-Verstärkungen innerhalb [0.92, 1.08], eine Graukarten-Fixture wird auf ΔE2000 ≤ 3 neutralisiert, eine Nur-Matte-Fixture bleibt unverändert.

### 12.2a Goth-Fotorahmen (U-13, P12.3)

Jedes Foto – Shop-Karten, Produktseite (Galerie), Galerie, Flash, „Über mich“, Startseiten-Stationen, Teaser, Korb und Kasse – trägt denselben **viktorianischen Zierrahmen mit Filigran** im Goth-Ton. Er ersetzt das frühere Passepartout aus Papierton mit Doppelrahmen (Kunst-QA IM-04).

- **Zeichnung:** dünne Tuschelinie (Außenlinie 2, Innenlinie 1,4 Einheiten von 120; nie ein dicker schwarzer Block, damit die Leine wirkt), dazwischen ein Filigranband aus Ranke, kleinen Schnecken und Perlen; Ecken: eingekerbte Außenecke mit Perle, symmetrisches Schneckenpaar mit Knospe, Ranken zu beiden Kanten. Strich mit leichtem Zittern, Bandgrund `--paper-field`.
- **Technik (PF-10):** **eine** SVG-Datei `public/art/photo-frame.v1.svg` (≈ 3,9 KB, 9 Teile à 40 Einheiten; Ecke und Kante je einmal gezeichnet und per `<use>` für alle vier Seiten gespiegelt/gedreht; erzeugt von `pnpm art:frame`, `scripts/art/build-photo-frame.ts`). Sie hängt als `border-image: url(…) 40 / var(--pf-band) round` am Bildrahmen in `ResponsiveImage` (`.frame`, `data-photo-frame`): kein zusätzliches Element, **kein SVG je Foto** und kein SVG im DOM der Seite. Das Kantenband wiederholt sich (`round`), die Ecken bleiben ganz.
- **Maße und CLS:** Das Band (`--pf-band`: `clamp(14px, 6.5cqi, 28px)`; `frameSize="thumb"` für Vorschauen ≤ 96 px: 6 px) liegt **innerhalb** der festen `aspect-ratio` (Border-Box). Außenmaße ändern sich nie (CLS 0); das Foto füllt die Innenfläche (`object-fit: cover`, Fokuspunkt). Bis die Datei geladen ist, steht ein Papierrand gleicher Breite. `border-image` ist kein LCP-Kandidat.
- **Leine:** Rahmen und Foto liegen im Inhalt, die Leine läuft in der Rinne (U-07a); keine Leine-Datei kennt den Rahmen (Test). Forced-Colors: einfache `CanvasText`-Linie.
- **Test:** `tests/unit/design/photo-frame.unit.spec.ts` (Datei = Skript-Ausgabe, ≤ 4 KB, dünne Linie, Registry-Suche „jede Foto-Stelle über `ResponsiveImage`“); Playwright-Prüfung der Rahmen je Kontext; visuelle Referenzen. Ausnahmen ohne Rahmen: Wortmarke/Icons, QR-Code (BankDetails), Vorschau eigener Uploads im Anfrageformular, Lightbox-Vollbild.

### 12.3 Platzhalter-Illustrationen

Der Beispielbestand (E-63, Mengen laut SEED-SPEC §0.1) hat mehr Stücke als Instagram-Fotos. Wo kein Foto passt, entstehen **Platzhalter im Linienstil** (Konzeptseite „Beispielbestand“).

- **Format:** SVG `viewBox="0 0 400 500"` (4:5), Grund `--paper-2` oder eine Wash-Farbe (§3.1).
- **Strich:** 2.8 Einheiten `--ink` (P9.13: kräftiger, näher an Juttas Filzstift; vorher 2.4), runde Enden, eine Werkzeugstärke, Wackel, offene Enden mit Absetzern, 1–2 Doppelkonturen, Schatten als 5–7 Schraffurstriche (40°).
- **Farbe:** höchstens **eine** flache Wash-Fläche hinter der Linie, 3–4 Einheiten versetzt.
- **Motiv:** das Stück selbst (Schale, Teller, Fliese, Cap, T-Shirt, Kleid, Anhänger, Zeichnungsblatt, Spiegel; Rahmen nur, wenn das Stück laut `framed` gerahmt ist), 55–70 % der Bildhöhe, leicht schief (±3°); auf Keramik-Platzhaltern kleine naive Tiere (Hund/Hase mit Kulleraugen) wie auf Juttas Schalen.
- **Kein Text im Bild**, keine Kopie konkreter Werke, keine fremden Figuren.
- **Dateien:** `src/art/placeholders/{typ}-{n}.svg`, je ≤ 6 KB; für die Media-Collection zusätzlich per sharp als WebP 800×1000 gerastert (gleicher Codepfad wie Fotos).
- **Kennzeichnung:** Media-Datensatz `seed: true`, `source: 'placeholder'` (DATENMODELL `MEDIA_SOURCES`), Alt-Text „Platzhalter-Zeichnung: {Objekt}“.

### 12.4 Stationszeichnungen aus Juttas Bildern (E-76)

**Zuordnung (P8 erste Fassung aus 640-px-Quellen, P9 Feinschliff, Neuaufbau nach Datenexport):**

| Station | Quelle | Motiv für die Zeichnung | Hinweis |
|---|---|---|---|
| Planet Claire | – | Planet-Marke (§12.6) | Eigenzeichnung |
| Hallo | – | Coco `sitzen` | Sprite |
| Keramik | `post-DdUPhoZOoMW.jpg` | Hund aus der Schale (oben rechts) | graue Washes stören → nur schwarze Linien extrahieren |
| Textil | `post-DcT7ErBDsWi.jpg` | Wesen von der pinken Cap (schwarze Linien) | Minimum-Kanal trennt Tusche von Pink |
| Zeichnungen | `post-DaJH_kADpsK.jpg` | zwei Figuren (Ausschnitt) | beste Linienvorlage |
| Schmuck | `post-Da2WrEgDpC_.jpg` | Fuchs-Anhänger | Foto eines Objekts → Platzhalter-Zeichnung nach §12.3, nicht vektorisieren |
| Tattoo | `post-DbJ1QRrjCcb.jpg` | Kelch mit Schlange (Flash) | **keine** Kundenhaut-Fotos als Stationsbild (E-42); Godzilla nie (E-18) |
| Jutta & Coco | – | Coco `sitzen` + Planet | `profil.jpg` und `post-DdHXUQsDjqm.jpg` zeigen Jutta → nur nach ihrer Freigabe (Manifest), nicht in Zeichnungen |

**Vektorisierung** (`pnpm art:vectorize` = `scripts/art/vectorize.ts`, ARCHITEKTUR §6.10; deterministisch, erneut ausführbar):

1. Quelle + Ausschnitt (`crop: {x,y,w,h}`) + Parameter aus `content/art/sources.json` (Schema: `{ id, file, crop, channel: 'luma'|'min', threshold: number|'otsu', upscale, turdSize, alphaMax, optTolerance }`).
2. sharp: Ausschnitt → Graustufe (`luma`) oder Minimum aus R, G, B (`min`, für farbige Untergründe) → `normalise()` → Hochskalieren auf ≥ 1800 px Breite (Lanczos3; bei 640-px-Quellen ×3) → `blur(0.5)` → Schwellwert (Otsu oder fest) → Median 3 (Staub).
3. `potrace` (npm, **nur devDependency**, GPL – nie im Client-Bundle): `turdSize 10`, `alphaMax 1.1`, `optCurve true`, `optTolerance 0.4`.
4. SVGO: `floatPrecision 1`, `convertPathData`, `mergePaths`, `removeViewBox: false`; Füllung → `currentColor` (Farbe `--ink` per CSS).
5. Ausgabe `src/art/stations/{id}.svg` ≤ 8 KB; bei Überschreitung `optTolerance` in 0.1-Schritten erhöhen.
6. Manuelle Prüfung (R1 in KUNST-QA): keine Klumpen, Linien nicht dicker als im Original, offene Enden erhalten.

Die potrace-Ausgabe ist ein gefüllter Umriss (Juttas echte Strichbreite bleibt erhalten). Enthüllungs-Animationen dafür nur per `clip-path` (MI-13), nicht per Strich-Zeichnen.

### 12.5 Weltraum-Motive (B-52's-Gruß, E-07)

- **Formen:** Planet mit Ring (Körper Ø 18–28 px, wackeliger Kreis; Ring = Ellipse 1,7× Breite, 15° gekippt, hinter dem Planeten unterbrochen), 4-zackiger Funkel-Stern und 5-zackiger schiefer Stern (8–14 px), Mondsichel, gestrichelte Umlaufbahn, kleine Retro-Untertasse (Kuppel, Scheibe, 3 Lichter), Morse-Leiste „CLAIRE“ (`−·−· ·−·· ·− ·· ·−· ·`) als Fußbereich-Ornament.
- **Stil:** Tusche-Linie wie §10.2; optional eine Wash-Fläche (`--wash-pink` oder `--wash-mat`) im Planetenkörper, versetzt.
- **Dichte:** höchstens eine Marke je Station und höchstens 3 Sterne je Bildschirmhöhe. Alle `aria-hidden`.
- **Grenzen der Hommage:** keine Liedtexte, kein Song-Audio, keine Band-Namen oder -Logos, keine Albumgrafik, keine Andeutung einer offiziellen Verbindung (`design-navigation.md`, „Planet Claire: Fakten und Grenzen“). Nur allgemeine Space-Age-Anmutung, von Hand.
- **Dateien:** `src/art/space/*.svg`, je ≤ 1,5 KB.

### 12.6 Wortmarke, Favicon, App-Icons, OG-Bilder

- **Wortmarke:** „planet claire“ in Kleinbuchstaben, Umrisse der früheren Handschrift als SVG (eingecheckte Marke; Neuerzeugung mit Spectral Italic über `pnpm art:brand --regen-wordmark`) (Glyphen-Umwandlung ist nach OFL für ein Logo zulässig), leicht nachbearbeitet (Grundlinie wackelt ±1 Einheit); der i-Punkt ist ein winziger Planet mit Ring. `public/art/wordmark.svg` ≤ 5 KB, `role="img"` im Link mit zugänglichem Namen über den Link-Text.
- **Planet-Marke:** Planet mit Ring (§12.5), Tusche auf Papierscheibe. Grundlage für Favicon und Icons.
- **Favicon und App-Icon** nach den Next.js-Dateikonventionen (ARCHITEKTUR §2.1; Next erzeugt die `<link>`-Tags selbst, nichts davon liegt in `public/`): `src/app/icon.svg` (Planet auf `--paper`-Kreis, damit er auf dunklen Tab-Leisten sichtbar bleibt) + `src/app/favicon.ico` (16/32) + `src/app/apple-icon.png` 180×180 (Papiergrund, Planet 70 %).
- **Verwaltung (PWA, E-93):** `icon-192.png`, `icon-512.png` in `src/admin/pwa/` (nur unter `ADMIN_ROUTE` ausgeliefert, ARCHITEKTUR §2.1), maskierbar, **Matte-Grün** `#2F6B4C` als Grund mit Planet in `--paper` – unterscheidet die Verwaltung auf dem Homescreen vom Shop.
- **OG-Standardbild** (1200×630, KONZEPT §3.0.5): Papier mit Schneidematten-Raster, Tuschelinie in einem Bogen mit Orbit um die Planet-Marke, Wortmarke groß, Zeile „Tattoos & Unikate aus Berlin“ (Bricolage 600), Coco `rennen` an der Linienspitze.
- **OG-Produktbild** (1200×630, P3, `next/og` `ImageResponse` mit satori, TTF-Schriften aus `src/og/fonts/`): links das erste Foto 4:5 (504×630, Fokuspunkt), rechts auf Papier: Titel (Bricolage 600, max. 3 Zeilen), Preisschild (Spectral Italic, Preis mit Sternchen, darunter klein „Endpreis zzgl. Versand“ [Annahme DA-6]), `Nr. 017`, Wortmarke klein unten rechts, Linie vom Schild zur Wortmarke. Verkaufte Stücke: Stempel „sold“.

---

## 13. Umsetzung nach Phasen und Abnahme

| Phase | Liefert aus diesem Dokument | Abnahme |
|---|---|---|
| **P2** Designsystem & Tuschelinie | `tokens.css` (§7), Schriften (§4.1), Raster (§3.4), KO-01–KO-04, KO-11, KO-12 (Basis), KO-17-Rahmen, KO-18 404/500, Icons (§6.5), Engine komplett (§9) mit Presets `journey`, `margin`, `legal`, `lost`, Stufen A/B/C, Coco-Platzhalter-Sprite mit allen 22 IDs (§10.4), reduzierte Bewegung (§9.11), Schalter „Animationen“ (§11.7), MI-05/06/07/10/12, **alle Verhaltensmodule dieser Phase als `mount/unmount`-Module und die Engine vorschau-tauglich (§9.12, KONZEPT §12.9)**, Startseite mit Beispielinhalten (Stationen noch ohne Produktkarten; die Karten der KO-21 kommen in P3), Wortmarke/Favicon (§12.6) | AK-DS-01…09, 12…16, 18; EK-01, EK-11 (KONZEPT) |
| **P3** Shop-Schaufenster | KO-05–KO-10 (inkl. KO-09a, KO-09b), KO-21, Presets `shopString`, `product`, MI-02, MI-03 (Live-Statusfall), MI-15, OG-Bilder (§12.6) | AK-DS-10; KONZEPT AK-3-xx |
| **P4** Warenkorb/Kasse | KO-13–KO-16, KO-19, Presets `calm`, `thanks`, MI-01, MI-08, MI-09 (Grundfassung) | AK-DS-11 |
| **P6** Recht | Fußbereich-Ziele (KO-04) mit echten Routen, Preset `legal` auf allen Rechtsseiten, Datenschutz-Eintrag `pc-motion` | AK-DS-09 |
| **P7** Tattoo & Auftragsarbeiten | KO-20, Presets `stencil`, `frame`, MI-14 | – |
| **P8** Inhalte | KO-17 Texte, Platzhalter (§12.3), Stationszeichnungen v1 (§12.4), Seed-Bilder durch die Pipeline, Preset `about` | – |
| **P9** Kunst & Bewegung | Coco final (§10: mindestens 6 Posen × 3 + 4 Brücken), Stationszeichnungen final, Tusche-Stufe A feinjustiert, Choreografie §11.4 vollständig, alle MI poliert, Foto-Look (§12.2 Schritte 4–6), Studio-QA **nach KUNST-QA.md** | KUNST-QA (alle Linsen PASS) + EK-01 unverändert |
| **P10** Qualität & Vorschau | finale Prüfung der Vorschau-Datei (§9.12), finale Tempo-/a11y-Läufe | EK-01, EK-07, EK-11 |

Ab P2 baut jede Phase ihr neues Verhalten gleich als Verhaltensmodul nach §9.12 (Tabelle dort); AK-DS-18 gilt je Phase für
die neuen Module, und der Vorschau-Export jeder Phase (KONZEPT §12.8) muss sie offline zeigen.

---

## Anhang A – Annahmen und bewusst nicht übernommene Recherche-Empfehlungen

### A.1 Annahmen (zur Übernahme nach `docs/OFFENE-PUNKTE.md`)

Umgesetzt wird jeweils die Spalte „Standard“. IDs `DA-n` (Design-Annahme) sind projektweit eindeutig.

| ID | Thema | Standard (umgesetzt) | So änderbar | Wer entscheidet |
|---|---|---|---|---|
| DA-1 | Kontrast der Konzept-Farben | `--warn #8F5400` statt `#9A5B00`, neu `--fox-text #A8430F` für kleinen Fuchs-Text; Konzept-Fuchs `#B84E1A` nur für Text ≥ 24 px (Stempel) und Deko (WCAG AA) | Tokens in §7 (AK-DS-01 muss grün bleiben) | Jutta (Farbton, P11); die Kontrast-Untergrenze bleibt |
| DA-2 | Schalter „Animationen“ | Knopf im Fußbereich, speichert `pc-motion` in `localStorage` **erst nach Klick** (§11.7, R-130 Zeile a) | §11.7 entfernen; `prefers-reduced-motion` bleibt | Kanzlei (Bestätigung R-130 Zeile a, Eintrag im Datenschutz-Dienste-Verzeichnis durch P6) |
| DA-3 | IBM Plex Mono nur im Schnitt 400 | Budget genau 3 Schriftdateien ≤ 100 KB | zweite Datei ergänzen, Budget AK-DS-04 anpassen | Umsetzer:in P2/P9 (technisch, ohne Jutta) |
| DA-4 | GSAP | **nicht** verwendet: eigener Code + CSS + Web Animations API (§9.10) | nur per ADR, nur R01, Lazy-Chunk ≤ 30 KB gz | Umsetzer:in P9 per ADR |
| DA-5 | Papierkorn-Textur | kein Papierkorn in P2 | §3.4 (P9 nur auf Verlangen von Prüfer:in R1) | Umsetzer:in P9 (KUNST-QA R1) |
| DA-6 | Preis-Hinweis im OG-Produktbild | Preis mit Sternchen und Kurzhinweis „Endpreis zzgl. Versand“ (§12.6) | §12.6 | Kanzlei (Wortlaut, zusammen mit den EN-Knopftexten) |
| DA-7 | Coco-Proportionen | nach den 150-px-Highlight-Fotos (§10.1) | bei neuen Fotos von Jutta (E-75) in P9 nachjustieren, sonst in P11 | Jutta („Ist das Coco?“, P11) |
| DA-8 | Auflösung der Stationszeichnungen | aus 640-px-Quellen (§12.4) | Neuaufbau nach Instagram-Datenexport (E-64) mit denselben Parametern: `pnpm art:vectorize` | Jutta liefert den Datenexport (P11) |
| DA-9 | Gewichtsanzeige auf der Produktseite (KO-09b, KONZEPT §3.4 Nr. 8) | unter 1000 g ganze Gramm („210 g“), ab 1000 g Kilogramm mit höchstens einer Nachkommastelle („2,4 kg“, EN “2.4 kg”); `formatWeight(grams, locale)` in `src/lib/shop/format.ts` | nur `formatWeight` und dessen Unit-Test ändern (z. B. immer Gramm) | Jutta (P11, beim Durchsehen der Vorschau) |

### A.2 Recherche-Empfehlungen, die hier **nicht** gelten (überstimmt durch ENTSCHEIDUNGEN oder Konzeptseite)

| Empfehlung (`docs/research/design-navigation.md`) | Stattdessen | Grund |
|---|---|---|
| Dunkler Tattoo-Bereich „Planet-Nacht“ `#1B1836` | Tattoo hell, Stencil-Kontur in Tusche, Violett nur als Abdruck-Schatten | E-73, E-74, Konzeptseite „Tattoo“ |
| Eigene Handschrift-Font (Calligraphr), Fraunces, Atkinson Hyperlegible, Big Shoulders Stencil | Spectral (+ Italic), Bricolage Grotesque, IBM Plex Mono (U-10; zuvor Mansalva) | E-79, U-10 |
| Mobile Bottom-Bar als Hauptnavigation | schmale Kopfleiste (Shop, Tattoo, Korb, Menü) + Fußnavigation | Konzeptseite „Menü“, KONZEPT §3.0.1 |
| Flash-Bogen / Orbit / Drehscheibe als Navigation | Tuschelinie als Leitmotiv, Navigation als normale Links | E-70 |
| Stempel „schon zuhause“, Badge „nur noch 1“ | Stempel „sold“, Badge „Unikat“ | E-77, E-10 |
| Artikelnummern `PC-K-0042` / `PCT-KER-26-0042` | reine Zahlen, Anzeige `Nr. 017` | E-12 |
| Cutter-Schnitt „In den Korb“, Sternenstaub-Partikel | Coco-Hüpfer (MI-01) | Konzeptseite „Kleine Momente“ |
| „Frisch aus dem Ofen“-Drops mit Countdown, Newsletter | keine Drops, kein Countdown außer Reservierung | E-13 |
| Anfrageformular im Tattoo-Bereich | nur Mail-/DM-Links | E-51 |
| Maßband-Overlay auf Produktfotos, 360°-Keramik | nicht geplant (Maße als Text) | nicht entschieden → nicht bauen |
| Motion mini als Standardbibliothek | eigener Code + WAAPI (keine zweite Animationsbibliothek) | Budget, eine Technik |
| Kontrast-Tokens `porcelain-50 #FBF8F2`, `ink-900 #17151C` usw. | Palette der freigegebenen Konzeptseite (§3.1) | Konzeptseite ist freigegeben |
| Konzeptseite: kürzere Posenliste für Coco (Abschnitt Fotos und Zeichnungen) | **mindestens 6 Posen × 3 Frames** (+ 4 Brücken) | E-80 und Konzeptseite „Extra-Aufwand“ (spätere, genauere Stelle) |
