# Recherche: Design- und Navigationskonzepte

> Stand 26.09.2026. Automatisch erzeugt aus dem Recherche-Workflow (Websuche mit Quellen). Konfidenz je Befund: high/medium/low. Wo ein Faktencheck vorliegt, steht er am Ende und hat Vorrang. Entscheidungen der Inhaberin stehen in docs/ENTSCHEIDUNGEN.md und haben immer Vorrang vor Empfehlungen hier.

## Zusammenfassung

Ich habe fünf eigenständige, bewusst unkonventionelle Konzepte für Navigation und Landingpage entwickelt. Jedes baut auf Juttas echter Bildsprache auf: Fine-Line-Tintenstriche, Flash-Bögen, violette Thermo-Schablonenlinien, die grüne Schneidematte, Keramikglasur, Aquarell, Coco und der Retro-Sci-Fi-Bezug „Planet Claire“. Die Konzepte heißen (1) Flash-Bogen, (2) Planet-Claire-Orbit, (3) Die Schneidematte (Werktisch/Flohmarkt), (4) Skizzenbuch mit Register-Reitern und (5) Drehscheibe & Brennofen.

Meine Empfehlung ist eine Kombination. Die Schneidematte bildet das tragende Raster für Shop, Produktkarten und Produktdetailseite, weil sie am schnellsten ist, am besten verkauft und ihre vorhandenen Produktfotos bereits so aussehen. Der Flash-Bogen ist die Landing-Navigation, sein Markenzeichen ist ein Übergang im Stil des Schablonen-Abdrucks. Der Tattoo-Bereich wird eine eigene dunkle „Planet-Nacht“-Welt ohne Warenkorb. Coco begleitet durch alle Zustände (leerer Korb, 404-Seite, Bestellbestätigung). Planet Claire taucht nur als dezentes Easter Egg auf, zum Beispiel als Morse-Bordüre und im Logo-Planeten.

Die Umsetzung setzt progressiv auf Inline-SVG, CSS und Cross-Document View Transitions. Dazu kommt Motion mini mit 2,3 KB, GSAP nur bei Bedarf (seit April 2025 kostenlos). Rive, dotLottie und Three.js kommen wegen ihrer Größe (WASM 360–900 KB gz beziehungsweise rund 185 KB gz) nicht in den kritischen Ladepfad.

Budget: LCP ≤ 2,0 s, INP ≤ 150 ms, CLS ≤ 0,05, jeweils am mobilen p75. Barrierefreiheit: WCAG 2.2 AA mit immer sichtbarer, einfacher Textnavigation, voller Unterstützung für prefers-reduced-motion und einem Schalter „Einfache Ansicht“.

Dazu liefere ich ein Design-Token-System mit geprüften Kontrastwerten, einen Schriftenplan (eigene Handschrift-Font über Calligraphr plus OFL-Fonts, selbst gehostet) sowie Textur- und Motion-Richtlinien. Als Referenzen habe ich sechs Websites geprüft. Eine Awwwards-Referenz (mystaelectric.com) leitet inzwischen auf eine Glücksspielseite um und darf nicht verlinkt werden.

Größter Projektrisiko-Faktor ist nicht die Technik, sondern die Illustrationsproduktion durch Jutta selbst: rund 25–40 Zeichnungen und Handschriftvorlagen. Diese Zulieferung muss vor dem Cloud-Start geklärt sein.

## Befunde

### Ausgangslage: Markenbausteine aus Juttas echter Arbeit `[medium]`

Aus dem Brief ergeben sich sieben wiederverwendbare Markenbausteine, die über ‚verträumt-progressiv' entscheiden:

(a) Fine-Line-/Blackwork-Tintenlinie, naiv, humorvoll, ‚wackelig'.
(b) Tattoo-Flash-Bogen, also eine Sammlung von Motiven auf einem Blatt.
(c) Violette Thermo-Schablonenlinien (Stencil) als ‚Übertragungs'-Moment vor dem Stechen.
(d) Grüne Schneidematte mit cm-Raster: Hintergrund ihrer Produktfotos und schon heute ein Wiedererkennungsmerkmal.
(e) Keramik: weißes Porzellan mit schwarzer Linie, Glasurglanz, handgeschriebener Text auf Tellerrändern.
(f) Aquarell-Tiere (Fuchs orange, Reh).
(g) Coco, die Chihuahua-Mischlingshündin, auf jedem Highlight-Cover: ein fertiges Maskottchen.

Dazu kommen der Name ‚Planet Claire' mit Retro-Sci-Fi-Anklang und die Flohmarkt-Präsenz. Alle Konzepte unten verwenden ausschließlich diese Bausteine, damit die Seite wie eine Verlängerung ihres Instagram-Accounts wirkt und nicht wie ein Template.

**Auswirkung:** Grundlage aller Konzepte. Die Farben und Motive sind aus der Brief-Beschreibung abgeleitet. Ich habe den Instagram-Account in dieser Session nicht selbst gesichtet, deshalb müssen die Hex-Werte später per Pipette aus ihren echten Fotos kalibriert werden.

Quellen:
- Projekt-Brief (Instagram-Beobachtung @planet.claire.tattoos)

### Konzept 1 – ‚Flash-Bogen' (Tattoo-Flash-Sheet als Navigation) `[medium]`

KERNIDEE: Die Startseite ist ein von Jutta gezeichneter Flash-Bogen auf porzellanweißem Papier. Jedes Motiv ist ein Navigationsziel mit handgeschriebenem Label:
- Schale mit Hund → Keramik
- Kappe mit Flammenwesen → Tragbares
- Fuchs-Anhänger → Kleinkram/Schmuck
- Kelch mit Schlange → Zeichnungen
- Tattoo-Maschine → Tattoo
- Coco → Über mich/Kontakt
- Klapptisch → Flohmärkte
- Planet → ‚Frisch aus dem Ofen' (Neuheiten)

DESKTOP: Das Blatt füllt den ersten Screen in einem 3×3-Raster mit leicht schiefen Motiven. Bei Hover oder Fokus erscheint unter der schwarzen Linie versetzt (+3 px/+2 px) dieselbe Linie in Schablonenviolett, als würde das Motiv gerade übertragen. Beim Klick zeichnet sich die violette Linie komplett nach (Stroke-Draw, 400 ms), dann morpht das Motiv per Cross-Document View Transition in die Kopfillustration der Zielseite.

MOBIL (ca. 90 % Instagram-Traffic): Der Bogen wird zu einem zweispaltigen, vertikal scrollenden Blatt mit großen Tap-Flächen (Motiv + Label, mindestens 44×44 px). Eine feste Bottom-Bar mit Textlabels (Shop · Tattoo · Coco · Korb) ist immer sichtbar. Kein Hamburger-Menü als einziger Weg.

MIKRO-INTERAKTIONEN:
- Stencil-Offset bei Hover/Fokus/aktiv.
- Handgezeichneter Kringel um den aktiven Menüpunkt.
- Preis-Anhänger ‚ab 35 €' an Kategorie-Motiven.
- Optional ein kurzes haptisches ‚Summen' (navigator.vibrate) nur auf Android. iOS unterstützt das nicht (nicht verifiziert, deshalb nur optional).

LANDING-FLOW: Hero-H1 → Bogen → ‚Frisch aus dem Ofen' → Tattoo-Teaser → Coco/Über mich → Footer.

SHOP: Karten sitzen in ‚Feldern' des Bogens mit handgezeichnetem Rahmen (SVG border-image), die Artikelnummer ist als Stempel gesetzt. Die Produktdetailseite (PDP) übernimmt das Motiv als kleines Label.

TATTOO: Dies ist die natürliche Heimat des Konzepts. Echte verfügbare Flash-Motive tragen den Stempel ‚frei' oder ‚vergeben'.

TECHNIK:
- Inline-SVG-Motive, nach SVGO je ≤ 4 KB.
- Stroke-Draw per CSS mit pathLength=1, stroke-dasharray und stroke-dashoffset.
- view-transition-name pro Motiv.
- Motion mini für Federn.
- Kein Canvas, kein WebGL.

PERFORMANCE: LCP ist die H1 oder ein AVIF-Hero. Die SVGs sind sofort gerendert, Animationen starten erst nach dem LCP.

A11Y: Jedes Motiv ist ein echtes <a href> mit Textlabel. Die DOM-Reihenfolge entspricht der Leserichtung. Bei reduced motion gibt es statischen Stencil-Offset statt Draw.

RISIKEN: Jutta muss 9–12 Motive im einheitlichen Strich liefern. Auf Mobilgeräten verliert der Bogen seinen ‚Blatt'-Charakter, wenn das Raster zu streng ist.

AUFWAND: M (Entwicklung ca. 5–8 Personentage, grobe Schätzung). Illustrationen kommen von Jutta.

**Auswirkung:** Stärkstes Alleinstellungsmerkmal und direkte Brücke zwischen Tattoo und Shop. Die Aufwandsschätzung ist eine Erfahrungsschätzung und nicht verifiziert.

Quellen:
- https://caniuse.com/cross-document-view-transitions
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@view-transition
- https://motion.dev/docs/animate

### Konzept 2 – ‚Planet Claire Orbit' (Retro-Space mit Keramik-Planet) `[medium]`

KERNIDEE: Im Zentrum steht ein handgezeichneter Planet, dessen Oberfläche ein echtes Foto einer ihrer glasierten Teller- oder Schalenglasuren ist. Die Bereiche umkreisen ihn als ‚Monde'. Coco erscheint mit Retro-Raumhelm als Guide. Die Typo ist an die Space-Age-Ära (1950er/60er) angelehnt. Als rechtlich unbedenkliche Hommage läuft eine Morse-Bordüre mit, die ‚CLAIRE' buchstabiert (C -.-. L .-.. A .- I .. R .-. E .). Der Song beginnt laut Wikipedia mit Morse-Code-Elementen.

DESKTOP: Die Monde bewegen sich per CSS offset-path auf einer SVG-Ellipse. Hover oder Fokus stoppt den Orbit, der Mond zoomt heran und zeigt eine Vorschau. Die Orbit-Bewegung endet nach höchstens 5 s oder hat einen sichtbaren Pause-Knopf (WCAG 2.2.2, Level A).

MOBIL: Der Orbit wird zu einem horizontalen Scroll-Snap-Karussell (‚Umlaufbahn'). Ein Planet-Button in der Bottom-Bar öffnet ein Bogenmenü in Daumenreichweite.

MIKRO-INTERAKTIONEN:
- ‚Andocken' beim Klick: Der Mond fliegt in den Header, per View Transition.
- Sternenstaub-Partikel beim In-den-Korb-Legen, nur per CSS.
- Kein Ton standardmäßig.

SHOP als ‚Sternenkatalog': Die Katalognummer ist die Artikelnummer (PC-K-0042). Das Raster bleibt ein Standard-Grid.

TATTOO: die Nachtseite des Planeten, dunkel.

TECHNIK:
- Empfohlen: SVG + CSS offset-path.
- Ein 3D-Glasurplanet mit Three.js wäre möglich, aber allein Three.js kostet rund 185 KB gz (Bundlephobia, three 0.186.1). Deshalb besser ein vorgerenderter 6–8-s-Loop als AV1/H.264-Video oder animiertes AVIF, poster-first.

A11Y: Die Reihenfolge der Monde ist im DOM als Liste fixiert. Bei reduced motion stehen die Monde still in einem Kreis.

RISIKEN: Bewegliche Ziele sind schwer zu treffen, wirken schnell gimmickhaft und können Schwindel auslösen. Der B-52's-Bezug darf nicht in Songnutzung oder Albumgrafik kippen.

AUFWAND: M–L (6–10 Personentage, mit WebGL +5).

**Auswirkung:** Sehr verträumt und namensprägend, aber als Hauptnavigation konversionsschwächer. Besser als Easter Egg, Logo-Planet, 404-Seite und Tattoo-Nachtseite geeignet.

Quellen:
- https://en.wikipedia.org/wiki/Planet_Claire
- https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
- https://bundlephobia.com/package/three

### Konzept 3 – ‚Die Schneidematte' (Werktisch/Flohmarkt-Tisch als System) `[medium]`

KERNIDEE: Die ganze Oberfläche liegt auf ihrer grünen Schneidematte. Das cm-Raster der Matte ist das Layout-Raster (4-px-Basis = ‚Millimeter'), Lineale laufen an den Rändern. Produkte werden ‚auf den Tisch gelegt' wie am Flohmarktstand. Artikelnummern erscheinen als Rasterkoordinaten-Etikett, z. B. ‚Feld C7 · Nr. PC-K-0042'.

DESKTOP: Die Navigation ist ein handnummeriertes Lineal oben. Die Bereiche sind Maßstriche, der aktive Bereich bekommt einen Bleistift-Haken. Filter liegen als ‚Schablonen-Chips' am linken Lineal.

MOBIL: Das Lineal wird zur horizontal scrollenden Chip-Leiste (Keramik · Tragbares · Papier · Kleinkram · Unikate · unter 50 €). Dazu kommen die Bottom-Bar und ein Warenkorb als Bottom-Sheet (<dialog>).

MIKRO-INTERAKTIONEN:
- ‚Cutter-Schnitt' beim In-den-Korb: Eine gestrichelte Linie schneidet über die Karte, die Karte gleitet in die Flohmarkt-Papiertüte (Korb-Icon).
- ‚Verkauft'-Stempel.
- Maßband-Overlay auf der PDP.

SHOP: Das robusteste E-Commerce-Raster der fünf Konzepte (2 Spalten mobil, 3–4 auf dem Desktop). Die Produktfotos sehen dank Matten-Hintergrund bereits einheitlich aus.

PDP: Weil ihre Fotos auf einer cm-Matte entstehen, lassen sich Maße als gezeichnete Lineal-Annotation (SVG-Overlay) über das Foto legen. Das macht Größe sofort verständlich, ein echter Nutzwert für Keramik und Anhänger (Fuchs 1 × 1,5 cm).

TATTOO: Die Matte wird mit violettem Schablonenpapier ‚abgedeckt', das den Wechsel in eine andere Welt markiert.

TECHNIK:
- Matten-Raster rein per CSS (repeating-linear-gradient, 0 KB Bilder).
- SVG-Lineale.
- CSS Scroll-Snap.
- Motion mini.
- Shared-Element-View-Transition Karte → PDP-Bild.

PERFORMANCE: bestes Konzept, die Textur besteht aus Gradients.

A11Y: Das Lineal ist eine normale <nav>-Liste. Die Maß-Overlays haben eine textuelle Entsprechung (‚B 14 × H 6 cm').

RISIKEN: Zu viel Grün konkurriert mit den Produktfarben. Deshalb die Matte nur als Rahmen, Nav-Fläche und Foto-Hintergrund nutzen, die Inhaltsflächen bleiben porzellanweiß. Allein wirkt das Konzept eher ‚clever' als ‚verträumt'.

AUFWAND: S–M (3–6 Personentage).

**Auswirkung:** Höchste Konversion und Geschwindigkeit, nutzt vorhandene Produktfotografie. Empfohlen als Rückgrat für Shop, Produktkarte und PDP.

Quellen:
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://caniuse.com/view-transitions

### Konzept 4 – ‚Skizzenbuch mit Register-Reitern' `[medium]`

KERNIDEE: Die Seite ist ihr Skizzenbuch. Aquarell-Flecken und Randkritzeleien prägen die Seiten, Coco schläft am Rand und wacht beim Scrollen auf. Die Navigation besteht aus farbigen Register-Reitern bzw. Post-its, die aus dem Buchrand ragen, je Reiter eine Aquarell-Wash-Farbe.

DESKTOP: Die Reiter stehen rechts am Rand. Ein Klick löst einen ‚Aquarell-Durchfluss'-Übergang aus: Die neue Seite blutet über eine Maske ein (View Transition mit vorgerenderter Aquarell-Maske, mask-image).

MOBIL: Die Reiter sitzen am unteren Rand als Daumen-Reiter (entspricht der Bottom-Bar).

MIKRO-INTERAKTIONEN:
- ‚Line Boil': Linien ‚kochen' leicht, indem drei handgezeichnete Varianten mit 8–12 fps per CSS steps() wechseln. Das ist deutlich günstiger als ein live laufendes SVG-feTurbulence-Filter.
- Washi-Tape-Ecken an Fotos.
- Handschriftliche Randnotiz ‚Jutta sagt …' auf der PDP.

SHOP: Fotos sind ‚eingeklebt', stehen aber in einem strengen Raster. Die PDP zeigt zuerst das Foto, dann die Handnotiz, dann eine saubere Datentabelle.

TATTOO: ‚Tattoo-Skizzenbuch' mit Flash-Seiten, Healed-Polaroids und einer Anfrage als ‚Zettel'.

TECHNIK:
- CSS mask-image mit 3–5 AVIF/PNG-Masken (je ≤ 30 KB).
- Sprite-basierter Line Boil.
- SVG-Filter nur auf kleinen Elementen und pausiert außerhalb des Viewports.
- GSAP nur optional.

A11Y: Bei reduced motion gibt es keinen Boil, nur einen Crossfade von höchstens 150 ms. Text liegt nie auf Aquarell mit über 6 % Deckkraft.

RISIKEN: Skeuomorphismus kann schnell ‚Scrapbook-kitschig' wirken. Seitenumblättern nervt bei Wiederholung. Lesbarkeit auf Texturen.

AUFWAND: M (6–9 Personentage).

**Auswirkung:** Liefert das ‚Verträumte' (Aquarell, Handnotizen). Empfohlen sind Teile davon: Aquarell-Masken für Übergänge, Line Boil sparsam, ‚Jutta sagt'-Notiz.

Quellen:
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@view-transition
- https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html

### Konzept 5 – ‚Drehscheibe & Brennofen' `[medium]`

KERNIDEE: Die Navigation ist ein runder Teller auf einer Töpferscheibe, wie ihre Schmetterlingsteller mit handgeschriebenem Randtext. Die Menüpunkte stehen als Randtext (SVG <textPath>) um den Teller. Durch Drehen per Drag, Scroll oder Pfeiltasten wandert ein Punkt unter den 12-Uhr-Zeiger, in der Tellermitte erscheint die Vorschau. ‚Frisch aus dem Ofen' ist der Bereich für neue Drops: Eine Ofentür öffnet sich mit warmem Glühen, dazu optional ein Drop-Countdown, der zu Instagram-Ankündigungen passt.

DESKTOP: Der Teller dreht sich mit Trägheit per Pointer Events. Die Tastatur bedient ihn als role="radiogroup" oder Liste mit Pfeiltasten.

MOBIL: Der Teller liegt als halber Kreis am unteren Rand und wird mit dem Daumen gedreht. Zusätzlich gibt es immer die Listen-Alternative.

MIKRO-INTERAKTIONEN:
- Einrast-‚Klick' visuell.
- Glasur-Glanz-Sweep über Produktbilder beim Hover.

SHOP: ‚Regal'-Raster. Für die PDP bei Keramik ist ein 360°-Drehteller möglich: 24–36 Fotos auf einem Drehteller, Frame-Scrubbing, lazy geladen. Das ist ein echter Mehrwert, weil Kund:innen alle Seiten sehen.

TECHNIK:
- Rive wäre für die Scheibe als State Machine naheliegend, bringt aber mindestens 360 KB gz WASM (canvas-lite) bzw. rund 907 KB gz (webgl2) mit, gemessen an rive.wasm von unpkg. Zudem ist der .riv-Export laut Rive-Preisseite erst ab dem Cadet-Plan möglich (9 $/Sitz/Monat).
- Deshalb Umsetzung in SVG + CSS-Transforms + Motion.

RISIKEN: Drehnavigation ist ungewohnt und schwer auffindbar, die Tastatur-Semantik ist anspruchsvoll. Die 360°-Fotoproduktion ist aufwendig.

AUFWAND: M–L (6–10 Personentage, plus Fotoproduktion).

**Auswirkung:** Starkes Keramik-Bild, aber als Hauptnavigation riskant. Empfohlen: ‚Frisch aus dem Ofen' als Name für Neuheiten und 360°-Ansicht für Keramik als spätere Phase (nach P1).

Quellen:
- https://rive.app/pricing
- https://rive.app/docs/runtimes/web/canvas-vs-webgl
- https://unpkg.com/@rive-app/canvas-lite@2.43.1/rive.wasm

### Empfehlung: Kombination ‚Flash-Bogen auf der Schneidematte' + Landing-Flow `[medium]`

KOMBINATION:
- Konzept 3 ist das System: Raster, Shop, Produktkarten, PDP mit Maßband-Overlay, Filter-Chips.
- Konzept 1 ist die Landing-Navigation und die Signatur-Interaktion: Stencil-Offset und Schablonen-Übertragung als View Transition.
- Aus Konzept 4 kommen Aquarell-Wash-Flächen, Aquarell-Masken für Seitenwechsel und die ‚Jutta sagt'-Notiz.
- Aus Konzept 2 kommen die dunkle ‚Planet-Nacht' für den Tattoo-Bereich, der Logo-Planet, die Morse-Bordüre und die 404-Seite (‚Coco ist im Orbit verschollen').
- Aus Konzept 5 kommt der Name ‚Frisch aus dem Ofen' für Neuheiten; die 360°-Keramikansicht folgt später.
- Coco ist in allen Zuständen der rote Faden: leerer Korb, Laden, Erfolg (‚Coco packt dein Paket'), 404.

LANDING-FLOW (mobil zuerst, Einstieg aus Instagram):
1. Header: handgeschriebene Wortmarke ‚planet claire' mit Mini-Planet, rechts ‚Menü' als Textbutton und Korb mit Zähler.
2. Hero (höchstens 1 Screen): echte Text-H1 in Handschrift-Font, z. B. ‚Tattoos & handgemachte Unikate aus Berlin'. Sie ist LCP-fähig. CTA 1 ‚Zum Shop' (Fuchsorange, Text Tintenschwarz), CTA 2 ‚Tattoo anfragen' (Kontur, Stencil). Im Hintergrund zeichnen sich drei Flash-Motive nach dem LCP ein.
3. Der Flash-Bogen als 2×4-Motiv-Navigation.
4. ‚Frisch aus dem Ofen': 4–8 neueste Produkte mit Preis als Scroll-Snap-Reihe. Das ist die direkte Konversion für Instagram-Besucher.
5. ‚Nur einmal da': Unikat-Erklärung in einem Satz, dazu Vertrauenszeile (Versand, Zahlarten, handgemacht in Berlin).
6. Dunkles Tattoo-Band: 3 Healed-Fotos plus ‚Flash ansehen' und ‚Anfrage'.
7. Coco und kurzes Über-mich, nächste Flohmarkttermine, Instagram-Link.
8. Footer mit Pflichtseiten (aus der Rechts-Dimension).

Auf dem Desktop wird der Bogen zum 3×3-Raster neben dem Hero. Tiefe Links aus Instagram-Stories und -Posts führen direkt auf die PDP mit sprechender URL (/shop/pc-k-0042-schale-hund).

**Auswirkung:** Verbindet ‚unkonventionell' mit einem konventionell-schnellen Kaufpfad. Geschätzter Zusatzaufwand über der reinen Shop-Funktionalität: ca. 10–14 Personentage Design/Entwicklung (grobe Schätzung).

Quellen:
- https://web.dev/articles/vitals

### Shop-Raster und Produktdetailseite (Spezifikation) `[medium]`

PRODUKTKARTE:
- Bild im Format 4:5. Das entspricht dem Instagram-Hochformat, sodass Jutta Bildausschnitte wiederverwenden kann (Hochformat 4:5 in dieser Session nicht verifiziert).
- Titel einzeilig, Preis fett mit tabellarischen Ziffern, Artikelnummer klein im Stempel-Font.
- Status-Badge ‚Unikat', ‚nur noch 1', Stempel ‚schon zuhause' (= verkauft).
- Die ganze Karte ist klickbar. Keine Informationen, die nur per Hover sichtbar sind.

RASTER: 2 Spalten mobil, 3 ab 768 px, 4 ab 1200 px. Eine sticky Filter-Chip-Reihe plus Sortierung (neu, Preis).

PDP MOBIL:
- Oben ein Swipe-Galerie-Bild per CSS Scroll-Snap, ohne Slider-Bibliothek.
- Darunter Titel, Preis mit Steuerhinweis (Rechts-Dimension), Nr., ‚Unikat – nur 1×' ohne Mengenwahl.
- Maße als Text plus Lineal-Overlay auf dem Matten-Foto, Material und Pflege.
- Eine sticky ‚In den Korb'-Leiste unten, die per scroll-padding keinen Fokus verdeckt (WCAG 2.4.11 AA).
- Danach die ‚Jutta sagt'-Handnotiz, Versand und Lieferzeit, ‚passt dazu'.

KORB: Seitenschublade bzw. Bottom-Sheet (<dialog>). Coco trägt die Tüte, bei reduced motion statisch.

Kleidung (T-Shirts/Kleider/Kappen): Größen als Chips mit Maßtabelle als gezeichnete Skizze. Unikat-Kleidung hat eine Größe, keine Varianten. Das ist mit der Shop-/CMS-Dimension abzustimmen.

Pflichtfelder im CMS für das Design: Alt-Text, Maße B×H×T in cm (für das Overlay), Status, Kategorie, ‚Jutta sagt'-Text, mindestens 3 Fotos (Übersicht, Detail, Größenvergleich).

**Auswirkung:** Der Shop bleibt trotz kreativer Hülle schnell scanbar. Das Maßband-Overlay ist eine differenzierende, aber nützliche Idee.

Quellen:
- https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

### Tattoo-Bereich (nicht kaufbar, nur Anfrage) `[medium]`

Der Tattoo-Bereich ist eine eigene Welt: ‚Planet-Nacht' mit Hintergrund #1B1836, Linien in Stencil-300 #A999F2, Text Porzellan. Er ist der einzige dunkle Bereich der Seite und schafft damit eine klare mentale Trennung: Hier gibt es keinen Korb. Die Korb-Anzeige bleibt nur im Header sichtbar.

SEKTIONEN:
1. Intro zu ihrem Stil (Fine Line, Blackwork, naiv-humorvoll).
2. ‚Flash-Bogen': verfügbare Motive, je mit Stempel ‚frei'/‚vergeben', Größenempfehlung und optional ‚ab-Preis'. Ein Klick öffnet die Anfrage mit vorausgewähltem Motiv.
3. ‚Wunschmotiv / Custom'.
4. ‚Healed': Galerie mit Vorher/Nachher-Slider frisch ↔ verheilt (Highlight ‚healed', z. B. ‚3.5 years healed').
5. ‚Angebote': z. B. Flash-Fixpreise, Flash-Days, Mini-Tattoos; die Inhalte muss Jutta festlegen.
6. Ablauf & Preise mit Mindestpreis-Hinweis.
7. Pflege.
8. FAQ.
9. Anfrageformular: Motiv, Körperstelle, Größe in cm, Referenzbilder-Upload, Budget-Rahmen, Wunschzeitraum, 18+-Bestätigung, Datenschutz-Einwilligung.

MIKRO-INTERAKTION: Hover und Fokus auf Flash-Motive lösen den violetten Schablonen-Abdruck aus. Anfragen werden nicht bezahlt. Ob eine Anzahlung außerhalb der Seite läuft, ist eine offene Frage.

**Auswirkung:** Erfüllt die Vorgabe ‚sehr schön und speziell, nicht kaufbar' und hält den Shop-Kaufpfad sauber getrennt.

Quellen:
- Projekt-Brief
- https://create-tattoo.com/

### Design-Tokens: Farbpalette mit geprüften Kontrasten `[high]`

Kontraste nach WCAG-Formel berechnet (eigenes Python-Skript). Die Werte sind Vorschläge und sollen später aus Juttas Fotos per Pipette kalibriert werden.

NEUTRAL:
- ink-900 #17151C Tintenschwarz: Text und Linien, 17,07:1 auf porcelain-50.
- ink-600 #4A4552: Sekundärtext, 8,75:1.
- porcelain-50 #FBF8F2: Seitenhintergrund.
- porcelain-100 #F2ECE1: Karten/Bisque. Tintenschwarz darauf 15,39:1.

TON:
- clay-300 #DDBFA0 als Fläche, Tinte darauf 10,37:1.
- clay-600 #9C5433 Terrakotta für ‚verkauft'-Stempel, 5,31:1.

SCHNEIDEMATTE:
- mat-800 #174A37: Text und Buttons, 9,57:1.
- mat-600 #2A7053: Mattenfläche, Porzellan-Text darauf 5,59:1 (AA).
- mat-500 #3A8A66: nur dekorativ oder für große Schrift, 3,96:1.
- mat-200 #A9D3BC: Rasterlinien und Tint, Tinte darauf 10,97:1.

FUCHS:
- fox-500 #F26B1D: nur als Fläche/CTA mit Tintenschwarz-Text (5,94:1). Weißer Text darauf fällt durch (2,87:1), als Text auf hell ebenfalls ungeeignet.
- fox-700 #A8440C: Orange als Text auf hell, 5,66:1.
- fox-400 #FF8A4C: Orange auf Nacht, 7,31:1.

KAPPENPINK:
- cap-300 #F6AFC8: nur Fläche (Tinte darauf 10,24:1, als Text auf hell 1,67:1 und damit unbrauchbar).
- cap-700 #A82A5E: Pink als Text, 6,27:1.

SCHABLONENVIOLETT:
- stencil-600 #5B3FC4: Links, Fokus, aktiv. 6,71:1 auf porcelain, weißer Text darauf ebenfalls 6,71:1.
- stencil-300 #A999F2 auf Nacht, 6,93:1.
- stencil-100 #E4DDFA als Tint, stencil-600 darauf 5,43:1.

NACHT: night-900 #1B1836 für den Tattoo-Bereich, Porzellan darauf 16,10:1.

AQUARELL-WASHES (nur Flächen, Tinte darauf zwischen 13,98 und 14,95:1):
- wash-sky #D3E6F4
- wash-apricot #FBDDC2
- wash-mint #D8EFE1
- wash-lilac #E8E0F9
- wash-pink #FCE0EA

STATUS:
- error #B42318 mit 6,2:1.
- Auf Nacht #FF8F80 mit 7,71:1.
- success = mat-800.

FOKUSRING: 2 px porcelain innen plus 3 px stencil-600 außen (Doppelring). Grund: Auf der Mattenfläche hat stencil-600 nur 1,20:1 gegen mat-600. Erst der Doppelring erfüllt die 3:1 für Nicht-Text-Kontrast (WCAG 1.4.11) auf allen Hintergründen.

SEMANTISCHE ALIASE:
- --color-bg, --color-text, --color-link (= stencil-600).
- --color-cta-bg (= fox-500) mit --color-cta-text (= ink-900).
- --color-sold (= clay-600), --color-focus.

WEITERE TOKENS:
- Spacing im ‚mm-Raster' 4/8/12/16/24/32/48/64/96.
- ‚Hand-Radius' per unregelmäßigem border-radius, z. B. 255px 15px 225px 15px / 15px 225px 15px 255px.
- Stencil-Schatten box-shadow: 3px 3px 0 var(--stencil-600).

**Auswirkung:** Sofort als CSS Custom Properties plus tokens.json umsetzbar. Die Kontrastwerte sind rechnerisch belegt; die Farbtreue zu ihren echten Werken ist nur mittel sicher.

Quellen:
- https://www.w3.org/TR/WCAG22/
- Eigene Berechnung (WCAG-Relativluminanz-Formel, Python)

### Typografie (frei lizenziert plus eigene Handschrift) `[high]`

DISPLAY – ‚Jutta Hand': eine eigene Font aus ihrer Handschrift über Calligraphr.
- Free-Plan: 1 Font, 75 Zeichen, 2 Varianten, keine Ligaturen.
- Pro: 10 € für 1 Monat bzw. 6 €/Monat bei 6 Monaten. Dafür 600 Zeichen, 15 Varianten je Zeichen, Ligaturen.
- Laut FAQ ist jede Kreation ‚your sole property', ohne Namensnennung, also auch kommerziell nutzbar.
- Die Font bleibt nach Abo-Ende als TTF/OTF funktionsfähig.
- Die Randomisierung mehrerer Varianten erzeugt den ‚echten Handschrift'-Effekt. Ich nehme an, dass das technisch über OpenType-Kontextalternativen läuft (calt, im Browser standardmäßig aktiv); das ist im Browser zu testen.
- Workflow: Vorlage drucken, mit ihrem Fineliner oder Tattoo-Liner schreiben, mit 600 dpi scannen, als OTF exportieren, mit fonttools/pyftsubset zu WOFF2 subsetten (Latin + deutsche Umlaute + €).

SCHRIFTEN MIT OFFENER LIZENZ (Open Font License, OFL):
- Fraunces (OFL-1.1, Achsen opsz 9–144, wght 100–900, SOFT 0–100, WONK 0–1): weiche, ‚wonky' Old-Style-Serife. Ideal als verträumte Display-Alternative, falls die Handschrift-Font nicht rechtzeitig fertig wird.
- Bricolage Grotesque (OFL, Achsen opsz/wdth/wght): eigenwillige Grotesk für UI-Überschriften und Preise.
- Atkinson Hyperlegible Next (OFL, variabel wght + Italic): Fließtext mit maximaler Lesbarkeit.
- Big Shoulders Stencil (OFL, opsz/wght): für Artikelnummer-Stempel, ‚1 von 1' und ‚verkauft'. Nur als Ziffern/Großbuchstaben-Subset laden (ca. 10 KB).
- Alternative mit Retro-Mystik: Basteleur von Keussel/Velvetyne (OFL-1.1, Tarot-inspiriert, ‚medieval-ish and cooperblack-ish'), passt zu Planet Claire und Flohmarkt.

REGELN:
- Handschrift nur ab 24 px und für kurze Headlines und Labels, nie für Preise, Formulare oder Fließtext.
- Fließtext 17–18 px bei line-height 1,5.
- Fluid-Scale per clamp().
- Höchstens 3 Schriftdateien beim ersten Laden.
- Alle Schriften selbst hosten, nicht von Google-Servern laden. Das LG München I (20.01.2022, 3 O 17493/20) sah in dynamisch eingebundenen Google Fonts ohne Einwilligung einen DSGVO-Verstoß (100 € Schadensersatz).
- Fontshare-Schriften (ITF Free Font License) habe ich bewusst nicht empfohlen, weil ich die Lizenzseite in dieser Session nicht lesen konnte.

**Auswirkung:** Die Handschrift-Font ist das wirksamste ‚Nicht-Template'-Signal. Sie braucht 1–2 Stunden Schreibarbeit von Jutta und 1 Monat Calligraphr Pro (10 €).

Quellen:
- https://www.calligraphr.com/en/pricing/
- https://www.calligraphr.com/en/docs/faq/
- https://github.com/undercasetype/Fraunces
- https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque
- https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegiblenext
- https://github.com/google/fonts/tree/main/ofl/bigshouldersstencil
- https://velvetyne.fr/fonts/basteleur/
- https://www.rewis.io/urteile/urteil/lhm-20-01-2022-3-o-1749320/

### Textur- und Illustrationsrichtlinien `[medium]`

ILLUSTRATIONEN:
- Alle Illustrationen sind Originale von Jutta, keine Stockgrafik und keine KI-Nachahmung ihres Stils.
- Ein einziges Werkzeug (Fineliner 0,3–0,5 oder Tattoo-Liner), schwarze Tinte auf Weiß, Scan mit 600 dpi.
- Vektorisieren mit Inkscape ‚Bitmap nachzeichnen' bzw. potrace, danach SVGO.
- Farbe kommt digital als flache Aquarell-Wash hinter der Linie dazu, 2–4 px versetzt: Das ergibt den Schablonen- bzw. Riso-Look.
- Stencil-Look = violette Linie (stencil-600), versetzt unter der schwarzen Linie. Er steht ausschließlich für Zustände: Hover, Fokus, aktiv, ausgewählt.

TEXTUREN (höchstens 3):
1. Papierkorn als kachelbares AVIF (≤ 15 KB, Deckkraft 4–6 %).
2. Matten-Raster rein per CSS.
3. 3–5 Aquarell-Masken (je ≤ 30 KB).
Keine Textur über 6 % Deckkraft hinter Fließtext.

FOTOS:
- Grüne Schneidematte als konstanter Produkt-Hintergrund, bewusst als Markenwert.
- Tageslicht, 4:5-Hochformat, je Produkt Übersicht, Detail, Größenvergleich (Hand oder Lineal) und Kontext. Kleidung zusätzlich getragen.
- Einheitlicher Weißabgleich.

ASSET-LISTE FÜR JUTTA (Minimum):
- 9–12 Flash-Motive für die Navigation.
- 6–10 Coco-Posen: schlafend, schnüffelnd, Tüte tragend, mit Raumhelm, buddelnd, winkend.
- 5 Stempel: ‚1 von 1', ‚schon zuhause', ‚frisch aus dem Ofen', ‚frei', ‚vergeben'.
- Pfeile, Kringel, Unterstreichungen.
- Wortmarke ‚planet claire' mit Planet.
- Lineal-Ziffern.
- Handschrift-Vorlage für Calligraphr.

**Auswirkung:** Die Asset-Produktion durch Jutta ist der kritische Pfad des Designs und muss vor dem Cloud-Start terminiert werden.

Quellen:
- Projekt-Brief

### Motion-Prinzipien `[high]`

1. ‚Tinte zuerst, Bewegung danach': Beim LCP ist alles vollständig und statisch. Animationen starten erst danach, es gibt keinen Preloader und kein Intro.
2. ‚Von Hand, nicht von der Maschine': organische Easings (z. B. cubic-bezier(.3,.7,.2,1) oder Federn), leicht zufällige Verzögerungen von 20–60 ms, Line Boil mit 8–12 fps statt glatter 60 fps.
3. Kurz: Mikro-Interaktionen 120–250 ms, Seitenwechsel 300–450 ms, Zeichnen höchstens 1,2 s. Nichts läuft länger als 5 s ohne Pause-Möglichkeit (WCAG 2.2.2, Level A).
4. Bewegung mit Bedeutung:
   - Übertragen = ausgewählt
   - Schnitt = in den Korb
   - Stempel = verkauft
   - Andocken = Bereich gewechselt
5. Reduced Motion: kein Zeichnen, kein Boil, keine Parallaxe; Übergänge höchstens als Crossfade bis 150 ms oder ohne Animation. Dazu kommt ein manueller Schalter ‚Einfache Ansicht', der auch Texturen reduziert (WCAG 2.3.3 empfiehlt Nutzer-Einstellungen; die Präferenz wird nur lokal gespeichert).
6. Nur Compositor-freundliche Eigenschaften animieren: transform, opacity, clip-path, mask-position. Nie width, top oder box-shadow-Loops.
7. Kein Ton als Standard; kein Autoplay-Video mit Ton.

**Auswirkung:** Verhindert, dass ‚unkonventionell' auf Kosten von INP und Barrierefreiheit geht.

Quellen:
- https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html

### Browser-Unterstützung: View Transitions und scroll-getriebene Animationen (Stand caniuse, Sept. 2026) `[high]`

VIEW TRANSITIONS (innerhalb einer Seite):
- Chrome 111+, Safari/iOS 18.0+, Firefox 144+, Android WebView aktuell.
- Globale Nutzung ca. 91,75 %.

CROSS-DOCUMENT VIEW TRANSITIONS (beim Seitenwechsel):
- Chrome/Edge 126+, Safari/iOS 18.2+; Firefox ab 144 nur teilweise; Samsung Internet nicht unterstützt.
- Globale Nutzung ca. 87,78 %.
- Opt-in per @view-transition { navigation: auto; } in beiden Dokumenten.
- Nur bei gleicher Origin. Ein extern gehosteter Checkout oder eine Zahlungsseite bekommt also keinen Übergang, das ist unkritisch.
- Empfohlen: das Opt-in in @media (prefers-reduced-motion: no-preference) kapseln.

SCROLL-GETRIEBENE ANIMATIONEN (animation-timeline: scroll()):
- Chrome 115+, Safari/iOS 26+.
- Firefox laut caniuse ab Version 159. Das liegt nach meiner Hochrechnung noch nicht im stabilen Kanal, deshalb nicht verifiziert.
- Globale Nutzung ca. 87 %.

FOLGE: Alles strikt als progressive Verbesserung bauen, mit @supports-Weichen. Ohne Unterstützung gibt es einen normalen Seitenwechsel und statische Illustrationen.

Ein MPA-/Islands-Ansatz (z. B. Astro) passt dazu. Laut Astro-Doku wird <ClientRouter /> mit nativen Cross-Document-Übergängen ‚zunehmend unnötig' und deaktiviert bei prefers-reduced-motion alle Übergangsanimationen. Die Stack-Wahl gehört in die Technik-Dimension.

**Auswirkung:** Die Signatur-Interaktion (Motiv morpht in den Header) funktioniert bei rund 88 % der Nutzer nativ; der Rest bekommt einen sauberen Fallback.

Quellen:
- https://caniuse.com/view-transitions
- https://caniuse.com/cross-document-view-transitions
- https://caniuse.com/mdn-css_properties_animation-timeline_scroll
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@view-transition
- https://docs.astro.build/en/guides/view-transitions/

### Animations-Bibliotheken: Größe und Lizenz `[high]`

Gemessen im September 2026 über die Bundlephobia-API bzw. die WASM-Dateien auf unpkg, gzip-komprimiert.

- GSAP 3.15: ca. 27 KB gz (Kern). Seit April 2025 inklusive aller Plugins (ScrollTrigger, DrawSVG, MorphSVG, SplitText) kostenlos, auch kommerziell. Die Standardlizenz verbietet nur den Einsatz in No-Code-Animations-Buildern, die mit Webflow konkurrieren; für diesen Shop unkritisch.
- Motion (MIT-Lizenz): animate ‚mini' 2,3 KB, ‚hybrid' 18 KB. Vanilla-JS-, React- und Vue-Pakete.
- lottie-web 5.13: ca. 77 KB gz.
- dotLottie-web 0.80: ca. 33 KB gz JS plus ca. 496 KB gz WASM.
- Rive canvas-lite 2.43: ca. 46 KB gz JS plus ca. 360 KB gz WASM. Rive webgl2 (von Rive empfohlen): WASM ca. 907 KB gz. Der .riv-Export erst ab Cadet für 9 $/Sitz/Monat.
- three.js 0.186: ca. 185 KB gz.

EMPFEHLUNG:
- Standard sind CSS und SVG plus Motion mini.
- GSAP nur, wo CSS nicht reicht, z. B. MorphSVG-Fallback für Browser ohne View Transitions.
- Lottie, Rive und Three.js nie im kritischen Pfad, höchstens später lazy nach Interaktion (z. B. ein interaktiver Coco).
- Coco-Animationen als SVG/CSS-Sprites oder als kleines animiertes AVIF/WebP.

**Auswirkung:** Die Bibliothekswahl entscheidet über INP und LCP im Instagram-In-App-Browser. Allein die WASM-Runtimes würden das JS-Budget um das 4- bis 10-Fache sprengen.

Quellen:
- https://gsap.com/standard-license/
- https://webflow.com/blog/gsap-becomes-free
- https://gsap.com/blog/3-13/
- https://motion.dev/docs/animate
- https://github.com/motiondivision/motion
- https://bundlephobia.com/package/three
- https://bundlephobia.com/package/lottie-web
- https://rive.app/pricing
- https://rive.app/docs/runtimes/web/canvas-vs-webgl

### Instagram-In-App-Browser als Hauptumgebung `[medium]`

Nach Apples App-Store-Richtlinie 2.5.6 müssen iOS-Apps, die Webseiten anzeigen, WebKit verwenden. Ausnahmen per Sonder-Berechtigung gibt es nur in der EU und in Japan. Für den Instagram-In-App-Browser auf iOS entspricht die Feature-Unterstützung daher praktisch der Safari-Version des jeweiligen iOS:
- View Transitions ab iOS 18 bzw. 18.2 (cross-document)
- scroll-getriebene Animationen ab iOS 26

Auf Android läuft der In-App-Browser nach allgemeinem Kenntnisstand auf Basis von Chromium/Android System WebView. Das habe ich in dieser Session nicht mit einer Primärquelle belegt.

KONSEQUENZEN:
- 100dvh statt 100vh verwenden.
- Bottom-Bar mit env(safe-area-inset-bottom).
- Kein Hover-abhängiges UI.
- Kein Autoplay mit Ton.
- Keine Popups/neuen Tabs im Kaufpfad.
- Manuelle Tests im echten Instagram-In-App-Browser auf iOS und Android sind vor jedem Release Pflicht.

**Auswirkung:** Der Großteil der Besucher (laut Brief ca. 90 % mobil) erlebt die Seite zuerst im In-App-Browser.

Quellen:
- https://developer.apple.com/app-store/review/guidelines/

### Performance-Budget `[high]`

Googles Schwellen für ‚gut' am 75. Perzentil: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. Unsere Zielwerte liegen bewusst strenger, weil die Seite im In-App-Browser über Mobilfunk geladen wird.

ZIELWERTE (mobil, p75):
- LCP ≤ 2,0 s
- INP ≤ 150 ms
- CLS ≤ 0,05

JAVASCRIPT BEIM ERSTEN LADEN:
- ≤ 90 KB gz auf der Landing.
- ≤ 60 KB gz auf Shop-Listen und PDP.
- 0 KB WASM.

SCHRIFTEN: höchstens 3 WOFF2-Dateien, subsetted, zusammen ≤ 100 KB. Die Display-Font wird vorgeladen (preload). Hand-Font mit font-display: swap, und size-adjust-Fallback gegen CLS.

BILDER:
- AVIF + WebP über srcset/sizes.
- LCP-Bild ≤ 120 KB mit fetchpriority="high".
- Kartenbilder ≤ 40 KB.
- Immer width/height bzw. aspect-ratio setzen.

SVG: Motive inline ≤ 4 KB, SVG auf der Landing insgesamt ≤ 40 KB.

SEITENGEWICHT: Landing gesamt ≤ 1 MB; PDP oberhalb des Falzes ≤ 800 KB.

LAUFZEIT: keine Long Tasks über 50 ms während der Interaktion. Animationen außerhalb des Viewports per IntersectionObserver pausieren.

MESSUNG:
- Lighthouse-CI-Budgets in der Pipeline.
- Real-User-Monitoring mit der web-vitals-Bibliothek, cookielos und selbst gehostet.

**Auswirkung:** Harte Leitplanken für den Cloud-Agenten. Die Grenzwerte von Google sind belegt, die strengeren Ziele sind Empfehlung.

Quellen:
- https://web.dev/articles/vitals

### Barrierefreiheit (WCAG 2.2, BFSG) `[high]`

RECHTSLAGE: Das Barrierefreiheitsstärkungsgesetz (BFSG) nimmt ‚Kleinstunternehmen, die Dienstleistungen anbieten oder erbringen' aus (§ 3 Abs. 2). Als Kleinstunternehmen gilt nach § 2: weniger als 10 Beschäftigte und höchstens 2 Mio. € Jahresumsatz oder Bilanzsumme. Eine Solo-Künstlerin fällt sehr wahrscheinlich darunter; die Rechts-Dimension sollte das bestätigen. Trotzdem empfehle ich WCAG 2.2 AA als Ziel, denn es hilft auch SEO und Konversion.

KONKRETE REGELN:
- Skip-Link ‚Zum Shop springen'.
- Die kreative Navigation besteht immer aus echten <a href>-Links mit Textlabel. Sie ist nie die einzige Navigation: Bottom-Bar und Header-Textlinks sind immer da.
- aria-current="page".
- Logische DOM-Reihenfolge.
- Fokus-Doppelring mit mindestens 3:1.
- Zielgrößen mindestens 24×24 px (2.5.8 AA), gestaltet werden 44–48 px.
- Sticky-Leisten verdecken keinen Fokus (2.4.11 AA, scroll-padding).
- Bewegung über 5 s ist pausierbar (2.2.2 A).
- prefers-reduced-motion wird vollständig respektiert, dazu der Schalter ‚Einfache Ansicht'.
- Dekorative Kritzeleien mit aria-hidden.
- Alt-Text im CMS als Pflichtfeld, er beschreibt Objekt, Motiv und Farbe.
- Das Maß-Overlay hat eine Textentsprechung.
- Das Anfrageformular hat sichtbare Labels und Fehlermeldungen in Textform.
- Die Handschrift-Font bekommt echten Text als Accessible Name, keine Bild-Headlines.

**Auswirkung:** Kreative Navigation bleibt nutzbar für Tastatur, Screenreader und bewegungsempfindliche Menschen. Das rechtliche Risiko ist gering.

Quellen:
- https://www.gesetze-im-internet.de/bfsg/__3.html
- https://www.gesetze-im-internet.de/bfsg/__2.html
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
- https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html

### Referenz-Websites (geprüft) `[high]`

1. FRA! Doodle Artist Portfolio, https://fradesign.it/
Awwwards Honorable Mention vom 4.7.2025, Ø 8,04, Macher Patrick David. Doodle-Künstler Francesco Caporale mit Shop-Bereich. Lehre: handgezeichnete Oberfläche plus Shop in einem Auftritt.

2. LRNCE, https://lrnce.com/
Marrakech, handbemalte Keramik, Textilien und Ready-to-wear (T-Shirts, Kleider). Fast derselbe Produktmix wie bei Jutta. Lehre: Das Artisanale steckt in Bildern und Texten, die Shop-Mechanik bleibt ruhig und konventionell (klare Kategorien, Warenkorb, Wunschliste).

3. Create – Tattoos & Art, https://create-tattoo.com/
Awwwards Honorable Mention vom 26.8.2022, Graz/Klagenfurt. Tattoo-Studio, Galerie und WooCommerce-Shop mit getrennter ‚Terminanfrage'. Lehre für die Informationsarchitektur: Tattoo-Anfrage und Shop sauber trennen. Gestalterisch ein Gegenbeispiel: Schwarz/Weiß wie fast alle Tattoo-Seiten, genau davon soll sich Planet Claire abheben.

4. Lynn Fisher, https://lynnandtonic.com/
Verspielte persönliche Seite, im Header ‚v. XIX', also regelmäßig neu gestaltet, mit Modus-Umschalter. Lehre: Persönlichkeit und Humor im kleinen Maßstab, mit responsiver Kreativität statt WebGL.

5. Bruno Simon, https://bruno-simon.com/
Three.js-/WebGPU-Portfolio zum Durchfahren mit einem Auto. Anti-Referenz für den Shop: großartiges Spiel, aber ohne klassische Textnavigation, als Kaufpfad ungeeignet.

6. The Unconventional Gallery (Ruinart × makemepulse), https://unconventionalgallery.ruinart.com
Awwwards Site of the Day vom 11.1.2022, WebGL-Galerie. Zeigt die Obergrenze an Immersion. Die Live-Seite habe ich nicht geprüft, nur den Awwwards-Eintrag.

WARNUNG: Die auf Awwwards gelistete Tattoo-Referenz ‚Mysta Electric' (mystaelectric.com) leitet inzwischen per 301 auf eine Glücksspiel-Domain um. Nicht verlinken und nicht als Referenz verwenden.

**Auswirkung:** Zeigt der Kundin greifbar die Bandbreite zwischen ‚Doodle-Oberfläche mit Shop' und ‚ruhigem Handwerks-Shop'. Belegt, dass Tattoo-Seiten meist monochrom-konventionell sind; darin liegt die Chance zur Differenzierung.

Quellen:
- https://www.awwwards.com/sites/fra-doodle-artist-portfolio
- https://fradesign.it/
- https://lrnce.com/
- https://www.awwwards.com/sites/create-tattoos-art
- https://create-tattoo.com/
- https://lynnandtonic.com/
- https://bruno-simon.com/
- https://www.awwwards.com/sites/the-unconventional-gallery
- https://www.awwwards.com/inspiration/single-page-scroll-navigation-mysta-tattoo-artist-portfolio

### ‚Planet Claire': Fakten und Grenzen der Hommage `[medium]`

‚Planet Claire' ist ein Song der B-52's aus dem Jahr 1979, die zweite Single ihres Debütalbums ‚The B-52's' (Island/Warner Bros.). Als Autoren sind Fred Schneider, Keith Strickland und Henry Mancini angegeben; die Grundlage ist Mancinis ‚Peter Gunn'-Thema. Der Song beginnt mit Morse-Code-Elementen.

Gestalterisch nutzbar sind allgemeine Retro-Sci-Fi- und Space-Age-Anmutung, ein eigener, von Jutta gezeichneter Planet und Morse-Muster, das nicht schutzfähig ist.

NICHT NUTZEN:
- Song-Audio (Musikrechte/GEMA)
- Liedtexte
- Albumcover oder Band-Logos
- Andeutungen, die eine offizielle Verbindung zur Band nahelegen

Die namensrechtliche Prüfung (Marke) gehört in die Rechts-Dimension.

**Auswirkung:** Die Konzepte verwenden den Retro-Space-Bezug nur als Stimmung. Die urheberrechtliche Einschätzung ist allgemein und keine Rechtsberatung.

Quellen:
- https://en.wikipedia.org/wiki/Planet_Claire

## Empfehlungen

- **Kombination umsetzen: Die Schneidematte ist das System (Shop, Produktkarte, PDP), der Flash-Bogen ist Landing-Navigation und Signatur-Interaktion. Der Tattoo-Bereich wird zur dunklen ‚Planet-Nacht', Coco ist Guide in allen Zuständen, Planet Claire nur als Easter Egg.**  
  _BegrÃ¼ndung:_ Verbindet maximale Eigenständigkeit (Flash, Stencil, Handschrift) mit einem konventionell-schnellen Kaufpfad. Die Matte nutzt vorhandene Produktfotos, der Flash-Bogen trägt die Tattoo-DNA, die Nachtseite trennt Anfrage und Kauf klar.

- **Schablonenviolett (#5B3FC4) konsequent als Zustandsfarbe für Hover, Fokus, aktiv und ausgewählt einsetzen, mit Fokus-Doppelring (porcelain innen, stencil außen).**  
  _BegrÃ¼ndung:_ Macht das Tattoo-Ritual ‚Stencil übertragen' zur Interaktionssprache und liefert gleichzeitig einen barrierefreien Fokus-Indikator (6,71:1 auf Porzellan; der Doppelring löst die schlechten 1,20:1 auf der Matte).

- **Die Technik bleibt eine Stufe leichter als die Idee: Inline-SVG, CSS (Stroke-Draw, offset-path, mask-image, Scroll-Snap), native Cross-Document View Transitions, Motion mini. GSAP nur punktuell; Rive, dotLottie und Three.js nicht im kritischen Pfad.**  
  _BegrÃ¼ndung:_ Instagram-In-App-Browser und Mobilfunk. Die WASM-Runtimes (360–907 KB gz) und Three.js (ca. 185 KB gz) würden LCP und INP gefährden; CSS und SVG erreichen den handgemachten Look fast ohne Kosten.

- **Juttas Handschrift als Webfont mit Calligraphr Pro (1 Monat, 10 €, 15 Varianten zur Randomisierung) erstellen. Fraunces (OFL, WONK/SOFT-Achsen) dient als Fallback-Display, Atkinson Hyperlegible Next als Fließtext, Big Shoulders Stencil für Nummern-Stempel. Alles selbst hosten.**  
  _BegrÃ¼ndung:_ Die eigene Handschrift ist das stärkste Anti-Template-Signal und gehört ihr vollständig (laut Calligraphr-FAQ). Die OFL-Fonts sind frei nutzbar. Selbst-Hosting vermeidet das Google-Fonts-Abmahnrisiko (LG München I, 3 O 17493/20).

- **Eine immer verfügbare einfache Navigation (mobile Bottom-Bar mit Textlabels, Header-Textlinks, Skip-Link) plus Schalter ‚Einfache Ansicht' fest im Grundgerüst verankern, vor jeder kreativen Schicht.**  
  _BegrÃ¼ndung:_ Kreative Navigation darf nie der einzige Weg sein: Das erfüllt WCAG 2.2 AA und sichert die Konversion, auch wenn Besucher die Metapher nicht verstehen.

- **Produktfotografie als Markenwert standardisieren: grüne Schneidematte, 4:5-Hochformat, mindestens 3 Fotos je Produkt (Übersicht, Detail, Größenvergleich). Maße in cm als CMS-Pflichtfeld, damit das Maßband-Overlay auf der PDP funktioniert.**  
  _BegrÃ¼ndung:_ Einheitliche Bildwelt ohne Aufwand; das Maß-Overlay verkauft kleine Objekte (1 × 1,5 cm Fuchs-Anhänger) besser und senkt Rückfragen.

- **Die Illustrations- und Handschrift-Zulieferung von Jutta (ca. 25–40 Assets) vor dem Cloud-Start mit Liste, Format und Termin festlegen. Bis dahin arbeitet der Agent mit Platzhalter-SVGs und Fraunces.**  
  _BegrÃ¼ndung:_ Die Asset-Produktion ist der kritische Pfad; ohne sie kann der Cloud-Agent die Design-Phasen nicht abschließen, ohne nachzufragen.

- **Performance- und a11y-Gates automatisieren: Lighthouse-CI-Budgets (LCP ≤ 2,0 s, CLS ≤ 0,05, JS ≤ 60/90 KB gz), axe-core, Playwright-Screenshots bei 375×812 und 1440×900, jeweils mit und ohne prefers-reduced-motion.**  
  _BegrÃ¼ndung:_ Der Cloud-Agent arbeitet autonom; messbare Gates verhindern, dass kreative Features unbemerkt Geschwindigkeit oder Barrierefreiheit verschlechtern.

## Umsetzungsanforderungen

- Design-Tokens als CSS Custom Properties in einer zentralen Datei plus tokens.json. Farben: ink-900 #17151C, ink-600 #4A4552, porcelain-50 #FBF8F2, porcelain-100 #F2ECE1, clay-300 #DDBFA0, clay-600 #9C5433, mat-800 #174A37, mat-600 #2A7053, mat-500 #3A8A66, mat-200 #A9D3BC, fox-500 #F26B1D, fox-700 #A8440C, fox-400 #FF8A4C, cap-300 #F6AFC8, cap-700 #A82A5E, stencil-600 #5B3FC4, stencil-300 #A999F2, stencil-100 #E4DDFA, night-900 #1B1836, wash-sky #D3E6F4, wash-apricot #FBDDC2, wash-mint #D8EFE1, wash-lilac #E8E0F9, wash-pink #FCE0EA, error #B42318, error-on-dark #FF8F80. Dazu semantische Aliase (--color-bg, --color-text, --color-link, --color-cta-bg, --color-cta-text, --color-focus, --color-sold).
- Kontrastregeln als Lint/Test durchsetzen: fox-500 und cap-300 nie als Textfarbe auf hellen Flächen; CTA fox-500 immer mit ink-900-Text; Fokus-Doppelring 2 px porcelain-50 plus 3 px stencil-600 (auf night-900 stencil-300).
- Spacing-Skala 4/8/12/16/24/32/48/64/96 px (mm-Raster), Breakpoints 768 und 1200 px, Fluid-Typo per clamp(), Fließtext 17–18 px, line-height 1,5.
- Schriften selbst hosten (keine Google-CDN-Einbindung), als WOFF2 subsetted (Latin, Umlaute, €): Display-Handschrift (Platzhalter Fraunces bis zur Calligraphr-Font), Atkinson Hyperlegible Next (Fließtext), Bricolage Grotesque (UI-Headlines), Big Shoulders Stencil nur als Ziffern/Großbuchstaben-Subset. Höchstens 3 Dateien beim ersten Laden, Display-Font vorladen, font-display: swap, size-adjust-Fallback.
- Globale Navigation: Skip-Link; Header mit Wortmarke, Textlinks (Shop, Tattoo, Über mich) und Korb-Zähler; mobile Bottom-Bar (Shop · Tattoo · Coco · Korb) mit Textlabels, env(safe-area-inset-bottom), mindestens 44 px Höhe; aria-current; scroll-padding gegen verdeckten Fokus.
- Komponente ‚Flash-Bogen': datengetrieben aus dem CMS (SVG-Motiv, Label, Ziel-URL, Reihenfolge, optional ab-Preis). Desktop 3×3-Raster, mobil 2 Spalten. Hover/Fokus = Stencil-Offset per CSS, Klick = Stroke-Draw (pathLength=1) plus view-transition-name zum Seiten-Header.
- Cross-Document View Transitions per @view-transition { navigation: auto } nur innerhalb von @media (prefers-reduced-motion: no-preference). Shared Elements: Produktbild Karte ↔ PDP, Flash-Motiv ↔ Kategorie-Header. Fallback: normaler Seitenwechsel.
- Scroll-getriebene Effekte nur unter @supports (animation-timeline: scroll()); ohne Unterstützung bleibt der Zustand statisch.
- Produktkarte: Bild 4:5 (AVIF/WebP, srcset, feste aspect-ratio), Titel einzeilig, Preis mit tabular-nums, Artikelnummer-Stempel, Status-Badge (Unikat / nur noch 1 / schon zuhause), gesamte Karte als Link.
- Shop-Liste: 2/3/4 Spalten, sticky Filter-Chip-Leiste (horizontal scrollbar), Sortierung (neu, Preis), Pagination oder ‚Mehr laden'-Button statt Endlos-Scroll.
- PDP: Scroll-Snap-Galerie ohne Slider-Bibliothek; Titel, Preis, Nr., Unikat-Hinweis oberhalb des Falzes; Maße als Text plus SVG-Lineal-Overlay aus den CMS-Feldern B×H×T; sticky ‚In den Korb'-Leiste; ‚Jutta sagt'-Notiz; Versand-Info; ‚passt dazu'.
- Korb als <dialog>-Drawer mit Fokusfalle und Escape; Coco-Zustände (leer, gefüllt) als statische SVG mit optionaler CSS-Animation.
- Tattoo-Bereich in night-900-Theme ohne Warenkorb-Aktionen: Intro, Flash-Bogen mit Status frei/vergeben, Custom, Healed-Galerie mit barrierefreiem Vorher/Nachher-Slider (input type=range), Angebote, Ablauf & Preise, Pflege, FAQ, Anfrageformular (Motiv, Körperstelle, Größe cm, Referenzbild-Upload, Budget, Zeitraum, 18+-Checkbox, Einwilligung).
- Motion-Implementierung: nur transform/opacity/clip-path/mask-position animieren; Dauern micro 120–250 ms, Seitenwechsel 300–450 ms, Draw höchstens 1,2 s; Endlosbewegungen stoppen nach 5 s oder haben Pause-Knopf; IntersectionObserver pausiert Animationen außerhalb des Viewports; Line Boil als 3-Frame-Sprite mit steps().
- Schalter ‚Einfache Ansicht' (Einstellung per localStorage in try/catch) deaktiviert Motion, Texturen und Line Boil zusätzlich zu prefers-reduced-motion.
- Bibliotheken: Motion (mini) als Standard; GSAP optional nur per dynamischem Import; kein Rive, dotLottie oder Three.js im initialen Bundle.
- Asset-Pipeline: SVGO für alle Illustrationen (Ziel ≤ 4 KB je Motiv), sharp o. Ä. für AVIF/WebP-Varianten (Karten ≤ 40 KB, LCP ≤ 120 KB), fonttools/pyftsubset für Fonts, Papierkorn-Textur ≤ 15 KB, Aquarell-Masken ≤ 30 KB.
- Performance-Gates in CI: Lighthouse-CI-Budgets (mobil LCP ≤ 2,0 s, CLS ≤ 0,05, TBT niedrig, JS ≤ 90 KB gz Landing / ≤ 60 KB gz Shop+PDP, 0 KB WASM initial) und web-vitals-RUM ohne Cookies.
- A11y-Gates: axe-core in Playwright auf allen Seitentypen; Tastatur-Durchlauf-Tests für Flash-Bogen, Filter, Galerie, Korb und Formular; Screenshots bei 375×812 und 1440×900, jeweils mit reduced motion an und aus.
- CMS-Pflichtfelder für das Design: Alt-Text, Maße B×H×T (cm), Status, Kategorie, ‚Jutta sagt', mindestens 3 Fotos (4:5), Artikelnummer. Dazu Flash-Motive für den Tattoo-Bereich mit Status frei/vergeben.
- Platzhalter-Illustrationen (einfache SVG-Linien) und Fraunces verwenden, bis Juttas Assets geliefert sind; Assets über klar benannte Dateipfade austauschbar halten (z. B. /assets/illustrations/nav/keramik.svg).
- 404-Seite mit Coco-im-Orbit-Illustration, Morse-Bordüre ‚CLAIRE' als dekoratives SVG (aria-hidden), keinerlei B-52's-Audio, -Lyrics oder -Artwork.

## Offene Fragen aus der Recherche (inzwischen im Interview beantwortet, siehe docs/ENTSCHEIDUNGEN.md)

- Welche Richtung spricht Sie am meisten an? Die empfohlene Kombination (Flash-Bogen auf Schneidematte, dunkle Tattoo-Nachtseite, Coco als Guide) oder stärker eines der Einzelkonzepte (Orbit, Skizzenbuch, Drehscheibe)? _(Optionen: Empfohlene Kombination (Flash-Bogen + Schneidematte + Planet-Nacht) / Mehr Planet Claire/Retro-Space im Vordergrund (Orbit-Konzept führend) / Mehr Skizzenbuch/Aquarell (verträumter, weicher) / Drehscheibe/Brennofen (Keramik im Vordergrund); Empfehlung: Empfohlene Kombination (Flash-Bogen + Schneidematte + Planet-Nacht))_
- Können Sie die Illustrationen selbst liefern (ca. 9–12 Navigationsmotive, 6–10 Coco-Posen, 5 Stempel, Pfeile/Kringel, Wortmarke mit Planet), und bis wann? _(Optionen: Ja, ich zeichne alles neu (Termin nennen) / Teilweise: vorhandene Zeichnungen und Instagram-Motive verwenden, Rest neu / Nein, Platzhalter und später schrittweise austauschen; Empfehlung: Teilweise: vorhandene Zeichnungen und Instagram-Motive verwenden, Rest neu)_
- Soll aus Ihrer Handschrift eine eigene Webfont entstehen (Calligraphr Pro, 1 Monat, 10 €, ca. 1–2 Stunden Schreiben nach Vorlage)? _(Optionen: Ja, eigene Handschrift-Font (mit Zufallsvarianten) / Nein, Fraunces (weiche ‚wonky' Serife) als Headline-Schrift / Nein, Basteleur (Retro/Tarot-Charakter) als Headline-Schrift; Empfehlung: Ja, eigene Handschrift-Font (mit Zufallsvarianten))_
- Wie stark darf der Name ‚Planet Claire' als Retro-Weltraum-Thema sichtbar werden? _(Optionen: Dezent: Logo-Planet, Morse-Bordüre, 404-Seite, Tattoo-Nachtseite / Deutlich: Weltraum als zweites Hauptthema (Coco als Astronautin, Orbit-Elemente überall) / Gar nicht: Name ist nur Name; Empfehlung: Dezent: Logo-Planet, Morse-Bordüre, 404-Seite, Tattoo-Nachtseite)_
- Ist der dunkle Tattoo-Bereich (Planet-Nacht) in Ordnung, während der Shop hell (Porzellan/Matte) bleibt? _(Optionen: Ja, Tattoo-Bereich dunkel, Shop hell / Nein, alles hell, Tattoo-Bereich nur über Stencil-Violett abgesetzt / Ganze Seite mit Dunkel-Modus-Umschalter; Empfehlung: Ja, Tattoo-Bereich dunkel, Shop hell)_
- Darf Coco als durchgehendes Maskottchen auftreten, z. B. im leeren Korb, auf der 404-Seite oder als ‚Coco packt dein Paket' nach der Bestellung? _(Optionen: Ja, Coco überall als Guide / Nur an wenigen Stellen (Über mich, 404) / Nein; Empfehlung: Ja, Coco überall als Guide)_
- Wie sollen verkaufte Unikate angezeigt werden? _(Optionen: Im Shop sichtbar mit Stempel ‚schon zuhause', hinter verfügbaren Stücken sortiert / Nur in einem separaten ‚Archiv/Schon-zuhause'-Bereich / Ganz ausblenden; Empfehlung: Nur in einem separaten ‚Archiv/Schon-zuhause'-Bereich)_
- Soll die Seite zweisprachig sein (Deutsch/Englisch)? Ihre Instagram-Bio mischt beide Sprachen. _(Optionen: Nur Deutsch / Deutsch + Englisch von Anfang an / Deutsch jetzt, Englisch später vorbereiten (Struktur mehrsprachig anlegen); Empfehlung: Deutsch jetzt, Englisch später vorbereiten (Struktur mehrsprachig anlegen))_
- Welche Tattoo-‚Angebote' sollen gezeigt werden, und nennen Sie Preise? _(Optionen: Flash mit festen ab-Preisen + Custom auf Anfrage / Nur ‚Preis auf Anfrage' mit Mindestpreis-Hinweis / Zusätzlich Flash-Days/Aktionen mit Terminen; Empfehlung: Flash mit festen ab-Preisen + Custom auf Anfrage)_
- Soll die Produktseite für Keramik später eine 360°-Drehansicht bekommen (dafür 24–36 Fotos je Objekt auf einem Drehteller)? _(Optionen: Ja, in einer späteren Phase (nach Shop-Start) / Nein, normale Galerie reicht; Empfehlung: Ja, in einer späteren Phase (nach Shop-Start))_
- Soll es auf dem Desktop einen eigenen Cursor geben (z. B. kleiner Tintenpunkt, der der Maus folgt; der System-Cursor bleibt erhalten)? _(Optionen: Ja, dezenter Tintenpunkt / Nein; Empfehlung: Ja, dezenter Tintenpunkt)_
- Wie sollen die Artikelnummern aussehen (für Stempel-Design und URLs)? _(Optionen: Kategorie-Präfix + laufende Nummer, z. B. PC-K-0042 (K=Keramik, T=Tragbares, Z=Zeichnung, S=Schmuck/Kleinkram) / Nur laufende Nummer, z. B. #0042 / Eigenes System von Jutta; Empfehlung: Kategorie-Präfix + laufende Nummer, z. B. PC-K-0042 (K=Keramik, T=Tragbares, Z=Zeichnung, S=Schmuck/Kleinkram))_
