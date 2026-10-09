# Fortschritt

Neueste Einträge oben. Format: `## YYYY-MM-DD – Phase/Aufgabe` + was erledigt wurde + wie getestet.

## 2026-10-09 – P14.7 Flash ↔ Galerie (U-56)

- Galerie-Einträge haben einen Anker `g-<id>` und kennen die Nummer ihres Flash-Motivs (Feld `flash`, nur veröffentlichte
  Motive). Flash-Karte (R12): „Schon gestochen – Foto ansehen“ → `/de/tattoo/galerie#g-<id>`; Galerie (R15): „nach Flash
  F-012“ → `/de/tattoo/flash#f-012` (EN „Already tattooed – see the photo“ / „after flash F-012“).
- Verlinkt werden nur Fotos, die die Galerie ohnehin öffentlich zeigt (`toPublicGallery`: Einwilligung, Widerruf nimmt
  den Eintrag offline; Seed-Ausnahme nur im Vorschau-Modus). Cache: R12 liest zusätzlich die Galerie (Tag
  `tattoo-gallery`), R15 zusätzlich die Motive (Tag `flash`).
- Tests: Unit `tests/unit/tattoo/flash-gallery-link.unit.spec.ts`, E2E `tests/e2e/tattoo/flash-gallery-link.e2e.spec.ts`
  (beide Richtungen, Kundenfoto ohne Einwilligung ohne Link, DE/EN) plus bestehende Flash-/Galerie-E2E grün.

## 2026-10-08 – P13 abgeschlossen: zweite Runde nach deiner Rückmeldung – für Jutta

Hallo Jutta,

deine zweite Runde ist fertig und auf der Seite. Das hat sich geändert:

- **Startseite:** Die Station „Komm näher.“ und die Fitness-Coco sind ganz weg, die Stationen sind neu durchnummeriert.
  Koko mit der Mütze ist jetzt direkt aus deinem Bild ausgeschnitten – Augäpfel und Lidstriche genau wie gemalt, nur die
  Pupillen wandern ruhig nach links und rechts. Unten sieht man jetzt auch Fellkragen, orange Brust und die weiße Blesse.
  Rechts neben Koko steht die schmale Tour-Tafel, darunter der Link zu Instagram mit einem von Hand gezeichneten Zeichen.
- **Coco läuft überall mit:** auf allen Shop- und Tattoo-Seiten, mit Schleifen an den Überschriften und Bögen um die
  Bilder; auf der Startseite zwei Umrundungen mehr. Die Pausen-Spielereien kommen etwa ein Fünftel schneller.
- **Schrift:** Alle Überschriften sind jetzt in derselben Schrift wie der Titel (Spectral).
- **Gewährleistung:** Der neue EU-Pflichthinweis steht mit dem offiziellen Wortlaut im Shop – als Platzhalter, bis die
  Kanzlei drüberschaut.
- **Anschrift:** „Jutta Dollmann, Anklamer Straße 28, 10115 Berlin“ steht in Impressum, Rechtstexten, Mails, auf der
  Kontaktseite und bei „Über mich“.
- **Sprache:** Rechts neben „Menü“ kannst du mit „DE | EN“ die Sprache wechseln.
- **Über mich:** nur noch Überschrift, euer Foto mit „Zu zweit“ und „Sag etwas“.

Die neue Vorschau-Datei (HTML) bekommst du direkt hier im Chat; außerdem liegt sie wieder unter „Releases“ auf GitHub.

Technik-Notiz: CI und Kunst-QA grün (u. a. Schrift-Regel für Überschriften auch in Formularen, Startseiten-Grafik unter
60 KB durch schlankere Koko-Augen-Umrisse und Linien-Attribute im Stylesheet, Anschrift auf R19/R20 laut U-46 erlaubt),
Referenzbilder erneuert.

## 2026-10-07 – P12.6 (Nacharbeit 2) Koko als große Büste, Augen links/rechts

- Zuschnitt auf Kopf, Kappe, Bommeln und Fellkragen (kein Körper), 700×690 WebP ≈ 45 KB; Spalte verbreitert, Bild füllt sie. Pupillen: ruhiger Halt 3 s, 0,4 s Wechsel, beide Augen gleichzeitig, rein CSS, endlos (`--dur-koko-look` 6,8 s).
- Tests: Unit (Koko), E2E `home-koko` (22 s, beide Seiten mehrfach, ruhige Halts), Build, Bundle-Budget.
## 2026-10-07 – P12.2 (Nacharbeit) Linienpapier statt Karo

- Seitengrund jetzt liniert wie ein Schreibblock statt kariert: Zeilenlinien alle 32 px in zartem Petrol-Grau, oben ein breiteres Kopfband (56 px) mit etwas kräftigerer Linie; der Olivgrün→Petrol-Verlauf bleibt darunter. Kein Rand-Strich links (die Tuschelinie läuft dort). Reines CSS, keine Bilder. Menü-Overlay und Vorschaubilder (OG) ebenfalls liniert; Raster-Tokens entfernt.
- Tests: `tests/unit/design` (Kontrast gegen die dunkelste Linienstelle, Linien-Regeln), Details DESIGN §3.4.

## 2026-10-07 – P12.6 (Nacharbeit) Koko aus dem Foto

- Koko nicht mehr nachgezeichnet, sondern aus Juttas Malerei freigestellt und gesäubert (`scripts/art/koko-cutout.py` → `public/art/koko.v2.webp`, 660×867, 66 KB; altes `koko.v1.svg`/`scripts/art/koko.ts` entfernt). Original-Pupillen übermalt, neue Pupillen als SVG-Ellipsen (je Auge Standort + Läufer) in reinem CSS, endlos, links → rechts.
- Fehlersuche „Animation nach 3–4 s weg“: im Code nichts, das anhält; alte Amplitude nur ±2,5 px. Neu: ≥ 20 px, E2E über 22 s (Animationen laufen, Pupille bewegt sich weiter, nie sichtbar rückwärts).
- Tests: `pnpm check` (Unit inkl. neuer Koko-Tests), `pnpm build`, `check:bundle` grün (Koko 66 KB / Budget 80 KB), E2E home/home-tour/home-fitness/home-koko auf desktop + pixel-7, Referenzbilder r01-start neu.
## 2026-10-07 – P12.5 Fitness-Coco komplett neu (Überarbeitung)

- Du fandest die Fitness-Coco „schrecklich“ – zu Recht: Die erste Fassung war eine Reihe code-gezeichneter Strichfiguren, die nicht nach Coco aussahen. Ich habe sie **von Grund auf neu** gebaut.
- **Neu:** Coco ist jetzt eine kleine „Gelenkpuppe“ aus ihren eigenen Merkmalen (hohe Ohren, das rechte geknickt, weiße Blesse, weiße Brust und Pfoten, rotes Halsband mit Ring wie auf der Webseite). Jedes Bild wird frisch gezeichnet: schwarze Tuschelinie, orange Buntstift-Schraffur auf zartem Fellton. Dadurch bewegt sie sich fließend (≈ 30 Bilder pro Sekunde), ohne zu springen.
- **Die sieben Übungen in deiner Reihenfolge**, je ≈ 5 s: Body wave (Körper schwingt, ein Arm kreist über dem Kopf, Schwanz schwingt) · Body bounce („boing boing“, ganzer Körper federt, Ohren flattern, Schwanz hängt) · Single arm raises (ein Arm nach oben, Kopf und Augen folgen, halbe Lider – unbeeindruckt) · Hüpfer mit Hüftdrehung (Schwanz peitscht) · Brustöffner (Arme weit auf, dann vor der Brust zusammen, würdevoller Blick) · Rumpfdrehung (gestreckte Arme, Oberkörper und Kopf drehen) · Thump up (Seitenansicht, Arme hoch und mit Aufprall runter). Danach liegt sie **erschöpft am Boden, Zunge seitlich heraus, Augen zu**, und die Schleife beginnt nahtlos von vorn.
- **Technik:** Die Daten sind winzig geworden (Ablaufplan ≈ 1,3 KB statt 120 KB, Standbild ≈ 26 KB als Bild), das Laden nach dem ersten Bild und die Tempo-Grenzen bleiben. Pause im verborgenen Tab und außerhalb des Bildes, bei „weniger Bewegung“ steht ein Standbild.
- **Getestet:** Unit-Tests für Gerüst und Ablauf (Knickohr in jeder Pose, Bild passt in die Box, nichts unter dem Boden, keine Sprünge, nahtlose Schleife, jede Übung mit ihrem Merkmal), Verhaltens-Test (30 Bilder/s, Pause, reduzierte Bewegung), E2E (läuft, Endlosschleife über 43 s, Pause außerhalb des Bildes, keine Konsolenfehler), Bundle-Budgets, visuelle Referenzen. Offene Sichtprüfung mit dir: siehe `docs/OFFENE-PUNKTE.md` (P12.5).

## 2026-10-08 – P12b Nachbesserung nach deiner zweiten Rückmeldung – für Jutta

Hallo Jutta,

die Nachbesserungen sind fertig und alle Prüfläufe auf GitHub sind grün (normale Tests, alle Browser, Tempo, Bildvergleiche, Kunst-Prüfung 62 von 62 automatischen Punkten):

- **Koko:** aus deinem Originalbild ausgeschnitten und nur als Büste gezeigt (Kopf, Mütze, Fellkragen), deutlich größer. Die Augen schauen ruhig nach links und rechts, mit langen Pausen dazwischen; sie bleiben endlos in Bewegung.
- **Gymnastik-Coco:** komplett neu, als Gelenkpuppe in Cocos Zeichenstil: sieben Übungen, am Ende liegt sie erschöpft mit Zunge da, dann geht es von vorn los. Deine Skizzenfotos habe ich weiterhin nicht als Dateien, die Bewegungen folgen deiner Beschreibung.
- **Hintergrund:** liniert wie ein Notizblock, mit breiterer erster Zeile oben.
- **Termine („Planet Claire on Tour“):** ein kompakter Schaukasten mit angepinnten Zetteln; der nächste Termin ist als Plakat hervorgehoben.
- **Shop:** Kategorie-Kacheln mit Coco-Bildern, alle gleich groß (aus dem Instagram-Material; die Bilder sind klein und auf scharfen Bildschirmen etwas weich, größere Originale ersetzen sie später).
- **Über mich:** dein Foto mit Coco in einem eigenen Abschnitt „Zu zweit“. Beim Start (P11) muss es beim Entfernen der Beispieldaten erhalten bleiben (steht in den offenen Punkten).
- **Fehler behoben:** In der Vorschau-Datei verschwand die kleine Coco bei ihren Warte-Aktionen (Hecheln, Zucken …), weil deren Bilder dort nicht geladen wurden. Jetzt sind sie in der Datei enthalten.

Die neue Vorschau-Datei liegt als Release „Planet Claire – Vorschau (Stand P12)“ bereit: https://github.com/mvheinz/planetclairetattoos/releases/tag/vorschau-p12

## 2026-10-07 – P12 Abschlussbericht (Überarbeitung nach deiner Rückmeldung) – für Jutta

### Phase 12 fertig: Deine Wünsche vom 06.10. sind umgesetzt, die neue Vorschau-Datei entsteht nach dem Merge

Hallo Jutta,

alles, was du dir bei der Überarbeitung gewünscht hast, ist eingebaut. Auf GitHub sind alle Prüfläufe grün: die normalen Tests, der große Lauf mit allen Browsern (Desktop, iPhone, Android), die Tempo-Messung, die Bildvergleiche und die Kunst-Prüfung (62 von 62 automatischen Punkten). Die Prüfung „sieht das wirklich schön aus?“ durch Menschenaugen steht noch aus – die machen wir zusammen (siehe unten).

### Was neu ist

- **Coco:** Sie sitzt jetzt seitlich (wie auf deinem Foto), wartet mit kleinen Aktionen, hat vier neue Posen, ist ein Viertel größer, die Tuschelinie zeichnet doppelt so langsam, das rechte Ohr ist immer geknickt, und die Leine liegt nur noch am Rand der Raster, nie quer über Karten. Beim Seitenwechsel läuft Coco mit.
- **Fitness-Coco:** Auf der Startseite ersetzt sie die große sitzende Coco: sieben Übungen aus deinem Skizzenblatt, am Ende liegt sie erschöpft mit Zunge da, dann geht es von vorn los. Ohne Beschriftung.
- **Koko:** Die Vorsitzende der Goth Dogs Berlin sitzt oben in der rechten Spalte (mit Narrenhut, ohne Knochenkreuz); nur die Pupillen wandern immer von links nach rechts. Darunter steht „Planet Claire on Tour“.
- **Planet Claire on Tour:** Ein kleiner Kalender mit deinen Terminen (kommende oben, vergangene eingeklappt, abgesagte durchgestrichen, ohne Karte oder Fremddienste). In der Verwaltung pflegst du die Termine im Bereich „Tattoo“, Reiter „Termine“. Beispieltermine sind dabei.
- **Aussehen:** Spectral als Schrift, helles Olivgrün mit Verlauf nach Petrol beim Scrollen, Petrol als Akzentfarbe, dünne Goth-Rahmen aus Filigran um alle Fotos.
- **Aufgeräumt:** „Angebote“ und alle DM-Hinweise sind weg; Instagram steht nur noch als Profil-Link im Fuß.
- **Alle Texte neu:** verträumt und philosophisch in der Ich-Form; Preise, Versand und Pflege stehen weiter klar und verständlich darin. Die Seite ist dauerhaft zweisprachig (Deutsch und Englisch), das Englische ist eigenständig geschrieben, nicht wörtlich übersetzt.
- **Rechtstexte und Schutz deiner Werke:** Impressum, Datenschutz, AGB, Widerruf (mit Muster-Formular), Versand und Zahlung sind vollständig ausformuliert (mit Platzhaltern für deine Angaben). Dazu: Urheberrechtsvermerk, Kaufklausel (was Käufer:innen mit dem Stück dürfen), Vorbehalt gegen KI-Training (`robots.txt`, `ai.txt`, Hinweise im Seitenkopf) und der Hinweis, dass Flash-Motive nur mit deiner Erlaubnis nachgestochen werden.
- **Platzhalter-Gesichter:** Jede Figur hat ein eigenes, einzeln gezeichnetes Gesicht (sechs Stile). Neue kleine Animationen: Karten heben sich leicht, Menü-Links rücken ein, die Korb-Bestätigung gleitet herein.

### So öffnest du die neue Vorschau-Datei

1. Öffne den Link: https://github.com/mvheinz/planetclairetattoos/releases/tag/vorschau-p12 (Release „Planet Claire – Vorschau (Stand P12)“). Er funktioniert erst, nachdem der Pull Request übernommen („gemergt“) ist; das erledige ich gleich nach diesem Eintrag.
2. Klicke unter „Assets“ auf `planet-claire-vorschau.html`; die Datei lädt direkt herunter.
3. Doppelklick darauf: Sie öffnet sich im Browser, auf jedem Rechner ganz ohne Internet. Warnt der Browser, wähle „Behalten“.
4. **Nur privat ansehen**, nicht weitergeben und nicht veröffentlichen: Sie enthält Beispieldaten, zwei Tattoo-Fotos ohne Einwilligung und Rechtstexte, die noch Platzhalter sind. Die ältere Fassung „Stand P10“ bleibt zum Vergleich stehen.

### Diese Punkte aus `docs/OFFENE-PUNKTE.md` solltest du entscheiden

1. **Rechtstexte durch die Kanzlei prüfen lassen (J-04):** Das gilt jetzt auch für die neuen Schutz-Klauseln (Kaufklausel, KI-Vorbehalt, Flash-Nachstechen). Sie sind sorgfältig formuliert, aber nicht anwaltlich geprüft.
2. **Sichtprüfung gemeinsam (P11):** 25 Urteilspunkte der Kunst-Prüfung sind noch offen, weil die Aufnahmen aus meiner Umgebung nicht abrufbar sind. Schau dir bitte Fitness-Coco, Koko, Coco beim Seitenwechsel, die Rahmen und die Gesichter an und sag mir, was dir noch nicht gefällt.
3. **Deine Skizzenblätter als Dateien:** Die Fitness-Skizzen liegen bei mir nur als Beschreibung (`content/art/jutta-skizzen/FITNESS-COCO.md`). Lade sie gern als Fotos nach `content/art/jutta-skizzen/` hoch, dann kann ich die Übungen noch genauer an deinen Strich anlehnen.
4. **Tour-Termine:** Die acht Beispieltermine werden vor dem Start entfernt; du trägst deine echten Termine ein.
5. Die übrigen Punkte aus dem Bericht „P10“ gelten weiter (Adresse, Telefon, Verpackung, Steuer, Instagram-Export, echtes iPhone).

### Das passiert in P11 gemeinsam

Wie im Bericht „P10“ beschrieben (`docs/GO-LIVE.md`, `docs/owner/AUFGABEN.md`): Konten anlegen, echte Schlüssel, Rechtstexte der Kanzlei einsetzen, Beispieldaten entfernen, Probekauf, dann der Start. Das machen wir zusammen, ich fange nicht allein damit an.

## 2026-10-06 – P12.12

- Platzhalter: Jede Figur hat jetzt ihr eigenes, einzeln gezeichnetes Gesicht (sechs Stile: Kulleraugen, Schlaflider, Knopfaugen, Blinzeln, Schiefblick, Staunen – je mit eigenen Brauen und eigenem Mund). Die sechs Coco-Platzhalter und die Hasen in `flash-902`/`spiegel-01` teilen kein Gesicht mehr (AR-05; Test `placeholders.unit.spec.ts`).
- Coco reist beim Seitenwechsel mit (MO-14): beim Aufbruch Lauf-Pose, mit Gegenstück (Start ↔ Über mich) wandert sie in 350 ms zur neuen Leinenspitze und steht dort sofort (kein Hereinrennen von links), ohne Gegenstück läuft sie hinaus bzw. herein. Neuer Chunk `src/leash/cocoTravel.ts` (nur bei voller Bewegung, ≤ 2 KB gz); Engine unverändert.
- Neue Mikro-Animationen MI-17 (Karte hebt sich), MI-18 (Menülink rückt ein), MI-19 (Korb-Bestätigung gleitet ein) – nur CSS, Tokens `--dur-short`/`--ease-ink-out`, bei reduzierter Bewegung/Schalter aus.
- Katalog nachgezogen: DESIGN §11.5, KUNST-QA (MO-11 auf MI-19, MO-14, AR-05), `/qa/motion`, SC-14 (Hover-Auslöser), Budget `tests/perf/budgets.json`.

## 2026-10-06 – P12.11

- Alle sechs Rechtstexte (Impressum, Datenschutz, AGB, Widerrufsbelehrung, Muster-Widerrufsformular, Versand & Zahlung) vollständig auf Deutsch (verbindlich) und Englisch (gleichwertig) ausformuliert, knapper Einstieg im Ton der Marke, Platzhalter aus den Einstellungen; bleiben origin=placeholder (Kanzlei-Prüfung P11). Speicher-/Cookie-Hinweis in der Datenschutzerklärung, Barrierefreiheits-Hinweis ohne Konformitätsaussage im Impressum.
- Schutz des geistigen Eigentums: vier Bausteine ip.* (Urheberrechtsvermerk, KI/TDM-Vorbehalt, Kaufklausel, Flash-Nachstechen) in der Verwaltung pflegbar, sichtbar im Footer, auf der Produktseite und bei Flash/Preisen/Ablauf, Abschnitte in AGB und Impressum; technisch robots.txt-Gruppe für KI-Crawler, ai.txt, tdmrep.json, Meta noai/noimageai und tdm-reservation, X-Robots-Tag in Produktion.
- Grund-Seed legt DE+EN direkt an; bestehende Datenbanken bekommen automatisch eine neue aktive Fassung (v2).
- Tests: legal-texts-p12 und ai-reservation (unit), base/public-pages/lifecycle (int), ip-notices (e2e); pnpm check, check:migrations, build und check:bundle grün; Rechtsseiten-E2E bis auf die bereits bestehenden Ruhe-Prüfungen (getAnimations, P12.2) grün. Offene Punkte: docs/OFFENE-PUNKTE.md (P12.11).
## 2026-10-06 – P12.9 und P12.10

- P12.10 Alle Texte neu (U-21): Ton verträumt-philosophisch, Ich-Form von Jutta, Sachtexte poetisch gerahmt mit klaren Fakten. Neu sind Sprachdateien (`src/i18n/messages/de.json`, `en.json`), Standardtexte der Verwaltung (`site-texts`), Beispielbestand (Seiten, Stationen, Kategorien, FAQ, Termine, Stücke) und Titelzeilen einiger Mails. Pflichttexte, Button „Zahlungspflichtig bestellen“, Rechtstexte (P12.11) und Verbotsliste (kein DM, kein „inkl. MwSt.“) unverändert beachtet.
- Leitfaden `docs/design/TEXTE.md` (Stimme, Sachtexte, Verbote, Zweisprachigkeit, Alt-Texte).
- P12.9 Zweisprachigkeit (U-00): englische Fassungen eigenständig geschrieben; fehlende EN-Alt-Texte ergänzt, doppelte „Zeichnung: Zeichnung:“ bereinigt.
- Tests: neu `tests/unit/i18n/bilingual.unit.spec.ts` (Schlüssel-Parität, EN ≠ DE mit Allowlist, kein lorem/TODO, keine Umlaute im EN-Text, Platzhalter, Alt-Texte, Beispielbestand DE+EN, site-texts) und `tests/unit/i18n/text-inventory.unit.spec.ts` (keine Reste der ~300 alten Texte aus `tests/fixtures/old-texts-p12.json`, kein DM, Pflichttexte unverändert). Mail-Referenzdateien und Unit-/Int-/E2E-Erwartungen auf die neuen Texte angepasst (Absicht unverändert).

## 2026-10-06 – P12.3

- Goth-Fotorahmen: viktorianischer Filigran-Rahmen mit dünner Tuschelinie als eine gemeinsame SVG-Datei (3,9 KB, scripts/art/build-photo-frame.ts), per border-image an ResponsiveImage (alle Foto-Stellen: Karten, Produktseite, Galerie, Flash, Über mich, Startseite, Teaser, Korb, Kasse); Passepartout/Doppelrahmen und Flash-Rand ersetzt.
- Außenmaße fest (CLS 0), kein SVG im DOM je Foto (PF-10), IM-04 in KUNST-QA und DESIGN §12.2a dokumentiert.
- Tests: Unit photo-frame (Registry-Suche, Größe, dünne Linie), E2E photo-frame (alle Kontexte, CLS ≤ 0,1, einmaliger Abruf), Visual-Referenzen neu.

## 2026-10-06 – P12.2

- Schrift: Spectral 500 und Spectral 500 Italic (@fontsource/spectral 5.3.0 exakt gepinnt, selbst gehostet, 4 Dateien zusammen 73,2 KB); Mansalva, GlyphFallback, Mansalva-Abdeckung und Fallback-Fläche entfernt, Metrik-Ersatzflächen für Spectral gemessen.
- Farben: helles Olivgrün als Grund, Petrol-Akzent (Links, Primärknöpfe, sold-Stempel, Fokus), Text-Tokens für AA nachgedunkelt; DESIGN §3/§4/§7 neu.
- Verlauf Olivgrün → Petrol-Hauch: statisch auf html, mit Scroll-Zeitleiste ein einziger opacity-Layer, statisch bei weniger Bewegung; Leine-Engine unberührt (Budget 12 000 B gz eingehalten).
- Tests: pnpm check (nur der schon vorher rote Test final-report offen), Int 1101 grün, E2E desktop/pixel-7 (Rahmen, a11y, home, shell, shop; Leine-Tests brauchen Debug-Build), Visual 70 neu erzeugt und im zweiten Lauf stabil, check:bundle und check:external grün.
## 2026-10-06 – P12.6

- Koko, Vorsitzende der Goth Dogs Berlin: freigestellt und von Hand nachgezeichnet (schwarzes Fell mit Tuschestrich, orange Flächen, weiße Brust/Pfoten, Narrenkappe mit grünen Bommeln, Seitenblick-Augen, ohne Knochenkreuz); nur die Pupillen bewegen sich (9 s, CSS), Standbild bei reduzierter Bewegung; Komponente ChairwomanKoko rechts neben dem Hero (mobil darunter, Platzhalter data-slot="chairwoman"); Bild 9 KB (<img>), Alt-Text DE/EN.
- Tests: Unit (Quelle, Budget, nur Pupillen animiert, reduzierte Bewegung, Alt-Text), E2E (nur zwei animierte Pupillen-Elemente, reduziert 0).

## 2026-10-06 – P12.5

- Fitness-Coco ersetzt die große sitzende Coco der Station „Hallo“: sieben Übungen in Juttas Reihenfolge + erschöpft Liegen, Endlosschleife (≈ 42 s), je Übung 12–20 gezeichnete Zwischenbilder, weiche Übergänge, schwarze Tuschelinie mit Zittern, oranger Buntstift mit Papierkörnung, keine Beschriftung, Knickohr; Standbild als <img>, Bildfolge (120 KB gz) nach dem load nachgeladen und auf einer Leinwand gespielt; Standbild bei reduzierter Bewegung; Alt-Texte DE/EN.
- Tests: Unit (Daten, Budget, Knickohr, Verhalten), E2E (home-fitness: Daten erst nach load, Schleife läuft, reduziert still), check:bundle (SVG der Startseite 54,3 KB ≤ 60). Kunst-QA: SC-01 um Fitness-Coco- und Koko-Bilder erweitert und lokal aufgenommen (art-desktop motion + reduced).

## 2026-10-06 – P12.4

- Coco: Sitzen/Kopf schief neu in Seitenansicht (Juttas Foto), Knickohr (hinteres Ohr) in allen Posen, Warte-Aktionen gestaffelt (Hecheln, Ohr zucken, Kratzen, Gähnen, Strecken, Wedeln, Hinlegen → Einrollen → Schlafen) und vier neue Posen (Spielverbeugung, Schütteln, Freudenhüpfer mit Drehung bei „Korb gefüllt“/„Bestellung abgeschickt“, Hinlegen mit Bauch hoch) in der nachgeladenen Datei coco-extra (27 Symbole); Coco +25 % (70/110 px, Rinne 56/88 px); Tuschelinie doppelt so langsam; Leine in Raster-Seiten (Flash, Shop, Kategorie, Archiv) nur in der Rinne am Rand, kringelt sich zwischen den Zeilen, umwickelt nie Karten.
- Budgets: Engine 11 805 B gz (≤ 12 000), Coco-Steuerung 2 884 B (≤ 3 000), Zusatz-Chunk 1 072 B, Sprite 43,8 KB/10,3 KB gz, Zusatz-Datei 56 KB/12,6 KB gz.
- Tests: Unit (Sprite, CO-01…08 mit Zusatz-Posen, Knickohr, Zusatz-Aktionen, Raster-Geometrie), E2E Raster-Seiten (LG-01 Flash/Shop, 390 und 1280 px), leash/coco/home-choreo/reduced-motion/a11y/home (desktop + pixel-7), check:bundle, pnpm check, Int 1 101 grün. Tempo-Gates (PF-02/04, LCP) und Kunst-QA-Linsen: CI/P12.13.
## 2026-10-06 – P12.8

- Neue Collection `tour-dates` (Migration, Zugriff nur Admin schreiben, Revalidierung, Beispieltermine `seed`) und Reiter „Termine“ in der Verwaltung (Liste, Neuer Termin, Absagen, Offline, Löschen, Übersetzen).
- Startseite: rechte Spalte (mobil darunter) mit leerem Platz für Koko (`data-slot="chairwoman"`) und „Planet Claire on Tour“: kommende oben, vergangene eingeklappt, abgesagte durchgestrichen; keine Karte, keine Fremd-Requests.
- Tests: Unit (Datum/Status/Texte), Int (Zugriff, Hook, Loader, Seed, Constraints), E2E Verwaltung → Startseite und Startseite mit Beispielbestand (Desktop, Pixel 7), check:external grün.

## 2026-10-06 – P12.7

- „Angebote“ (Seite R13, Menüpunkt, Verwaltungs-Reiter, Collection samt Beispieldaten, Task `revalidateEndedOffers`, Block `offersList`) entfernt; Migration `p12_remove_offers` (+ Aufräum-Migration) läuft auf frischer und gefüllter Datenbank.
- Alle DM-Hinweise weg: Anfrage im Tattoo-Bereich nur per Mail (Betreff-Vorlage bleibt); Instagram-Profil nur noch im Fuß (und im Menü).
- Tests: pnpm check (Unit außer dem schon vorher roten Abschlussbericht-Test), Int-Gesamtlauf + Nachläufe grün, Build, Desktop und Pixel-7: home, tattoo, admin, seed, empty-states, a11y, menu, about, contact grün.

## 2026-10-06 – P12 gestartet: deine Änderungswünsche

Danke für deine Rückmeldungen und die Zeichnungen! Ich habe alles in `docs/UEBERARBEITUNG.md` festgehalten und als eigene Phase P12 vor dem Go-live angelegt: neue Sitzpose und mehr Posen für Coco (Knickohr rechts), Fitness-Coco auf der Startseite, die Vorsitzende der Goth Dogs Berlin mit wandernden Pupillen, Schrift Spectral, Olivgrün mit Petrol und Scroll-Verlauf, Goth-Rahmen für alle Fotos, „Angebote“ und DM-Hinweise raus, „Planet Claire on Tour“, komplett neue Texte, vollständige Rechtstexte mit Schutz für deine Werke, und die ganze Seite dauerhaft auf Deutsch und Englisch. Am Ende bekommst du eine neue HTML-Vorschau. Deine Skizzenfotos der Fitness-Übungen konnte ich nur im Chat ansehen; ich habe sie beschrieben abgelegt. Wenn du magst, lädst du die Originale später in den Ordner `content/art/jutta-skizzen` hoch (Anleitung G4).

## 2026-10-06 – P10 CI grün

Phasenlauf `238d9f6`: CI, CI full (sechs Browser-Hälften, Abdeckung, Docker, Lighthouse), Vorschau-Export, Kunst-QA, Restore-Drill und der Probelauf des Vorschau-Releases grün; zuvor schon `a912d25` grün (zwei Volläufe hintereinander ohne Wackler). Vorschau-Artefakt `planet-claire-vorschau-p10-238d9f6`. Plan P1–P10 abgehakt.

## 2026-10-06 – P10 Abschlussbericht (P1–P10) – für Jutta

### Phase 10 fertig: Die Vorschau-Datei steht bereit, der Plan ist bis auf den Start (P11) leer

Hallo Jutta,

alle Phasen von P1 bis P10 sind fertig. Auf GitHub sind alle Prüfläufe grün: die normalen Tests, der große Lauf mit allen Browsern, die Tempo-Messung, die Übung „Datenbank aus dem Backup wiederherstellen“, der Docker-Notausgang (ein Umzug auf einen eigenen Server, falls Vercel einmal ausfällt) und die Kunst-Prüfung. Die Tempo-Werte stehen weiter unten im Eintrag „P10 Kennzahlen“. Jetzt bist du dran: lesen, ansehen, entscheiden – und dann gemeinsam der Start (P11).

### Was fertig ist

- **Seite und Shop (P1–P5):** Startseite, Über mich, Tattoo-Bereich mit Anfrageformular, Shop mit Keramik, Schmuck, Textil und Zeichnungen. Jedes Unikat kann nur einmal verkauft werden. Bezahlen mit Karte und PayPal (über Stripe) oder per Vorkasse, Abholung oder Versand, Rechnungen und Bestätigungs-Mails. Alles läuft bisher nur zum Üben (mit Test-Zahlungen, ohne echtes Geld).
- **Verwaltung (P5–P6):** Du bearbeitest Bestellungen mit wenigen Taps am Handy („bezahlt → versendet“ in höchstens fünf Taps), druckst Etiketten und Beileger und siehst den Umsatz-Wächter für die Kleinunternehmer-Grenze.
- **Recht und Datenschutz (P7):** Widerruf in zwei Schritten (Link „Vertrag widerrufen“ in jedem Seitenfuß), Einwilligung pro Tattoo-Foto, Löschfristen, keine Cookies vor dem ersten Warenkorb-Klick, keine Fremd-Dienste auf den öffentlichen Seiten. Die Rechtstexte sind noch Platzhalter, bis die Kanzlei liefert.
- **Beispielbestand (P8):** Rund dreißig Beispiel-Stücke, Tattoos und Texte, damit du die Seite „wie echt“ sehen kannst. Alles ist als Beispiel markiert und wird vor dem Start restlos entfernt.
- **Kunst und Bewegung (P9):** Coco nach deinen Fotos, die Tuschelinie, Zeichnungen und Seitenübergänge; wer „weniger Bewegung“ eingestellt hat, bekommt ruhige Seiten.
- **Betrieb und Absicherung (P10):** Backups samt Wiederherstellungs-Übung, Überwachung mit Alarmen, Besucher-Statistik ohne Cookies (ausgeschaltet), die „Startklar“-Prüfung (bleibt absichtlich rot, bis wir die echten Angaben eingetragen haben), Betriebs- und Start-Handbuch (`docs/RUNBOOK.md`, `docs/GO-LIVE.md`), dein Handbuch mit 41 Bildschirmfotos (`docs/owner/HANDBUCH.md`) und die fertige Vorschau-Datei.

### So öffnest du die Vorschau-Datei

1. Öffne den Link: https://github.com/mvheinz/planetclairetattoos/releases/tag/vorschau-p10 (Release „Planet Claire – Vorschau (Stand P10)“). Er funktioniert erst, nachdem der Pull Request übernommen („gemergt“) ist; dann erscheint die Vorschau automatisch dort.
2. Klicke unter „Assets“ auf `planet-claire-vorschau.html`; die Datei lädt direkt herunter (Schritt für Schritt: `docs/owner/ANLEITUNGEN.md`, G7).
3. Doppelklick darauf. Sie öffnet sich im Browser, **auf jedem Rechner ganz ohne Internet** (V1). Warnt der Browser („selten heruntergeladen“), wähle „Behalten“: Die Datei kommt aus deinem eigenen Repo und schickt nichts ins Netz. Sie ist ca. 8 MB groß; am Handy klappt es nicht zuverlässig.
4. **Nur privat ansehen**, nicht weitergeben und nicht veröffentlichen: Sie enthält Beispieldaten, zwei Tattoo-Fotos ohne Einwilligung und Rechtstexte, die noch Platzhalter sind.

### Video-Bündel der Kunst-Prüfung

Die Videos der Kunst-Prüfung (Handy und Desktop) liegen im Lauf https://github.com/mvheinz/planetclairetattoos/actions/runs/37403045986 unter „Artifacts“ als `art-qa-20261006-iter01-b093408`. Sie sind **30 Tage ab dem 06.10.2026** abrufbar. Danach lasse ich den Lauf `art-qa.yml` neu starten (Actions → „art-qa“ → „Run workflow“) und trage den neuen Link ein.

### Diese Punkte aus `docs/OFFENE-PUNKTE.md` solltest du entscheiden (nach Wichtigkeit)

1. **Kanzlei beauftragen (J-04)**: Ohne die fertigen Rechtstexte (Impressum, Datenschutz, AGB, Widerrufsbelehrung) geht die Seite nicht live; die Kanzlei braucht Zeit, also zuerst.
2. **Deine Adresse im Impressum (J-01)**: Privatadresse lassen oder eine Geschäftsadresse nehmen – die Kanzlei klärt, was reicht.
3. **Telefonnummer (J-02)**: Sie ist Pflicht im Impressum und in der Widerrufsbelehrung; eine eigene Geschäftsnummer ist am besten.
4. **Verpackung (J-03)**: LUCID-Registrierung und Verpackungslizenz brauchst du vor dem ersten Paket; das kannst nur du selbst anlegen.
5. **Steuer und Rechnungen (J-09, J-11)**: Mit der Steuerberatung Steuernummer, Kleinunternehmer-Status und die Aufbewahrung der Rechnungen (10 statt der Mindest-8 Jahre) klären.
6. **Instagram-Export (J-06)**: Er fehlt noch; der Beispielbestand nutzt die kleinen 640-Pixel-Bilder. Sobald du ihn hochlädst, baue ich alles in voller Qualität neu.
7. **Kunst-QA offen (J-07, KUNST-QA)**: Die Platzhalter-Bilder haben Note 3 statt 4 (die Gesichter wirken noch zu glatt), und Coco wandert beim Seitenwechsel noch nicht mit. Das schauen wir in P11 gemeinsam an; du entscheidest, ob du die Gesichter selbst zeichnest.
8. **Amtliche Widerrufs-Grafik (R-049)**: Die Grafik zum Widerruf ist noch eine Platzhalter-Grafik; die endgültige Fassung kommt von der Kanzlei bzw. aus der amtlichen Vorlage.
9. **Echtes iPhone (und Instagram-Browser) prüfen**: Alle Tests laufen auf Test-Browsern; ein Blick auf einem echten Handy gehört zur Start-Checkliste (P11.16).
10. **Nickel-/Glasur-/Produktsicherheit (J-12, J-13, J-14)**: Nachweise vor dem ersten Schmuckstück, Entscheidung „Deko“ oder „lebensmittelecht“ bei Keramik.
11. **Einwilligungen für Tattoo-Fotos (J-05)** und **Statistik an oder aus (J-16)**: Einwilligungen einholen; die Statistik bleibt aus, bis die Kanzlei zustimmt.
12. **Kleine Shop-Regeln (J-25 bis J-35)**: Je ein Satz zum Bestätigen, z. B. wer bei doppelter Zahlung erstattet oder wie lange du in der Verwaltung angemeldet bleibst.
13. **Beispielbestand-Fragen (J-21 bis J-24)**: Stimmen Material und Maße, ist auf den Fotos etwas Fremdes zu sehen?

Alle Punkte mit Hintergrund und Frist stehen in `docs/OFFENE-PUNKTE.md`.

### Das kannst du vor dem Start erledigen (AUFGABEN §3, A23–A32)

- **A23** Stripe-Konto verifizieren (Ausweis, IBAN, Steuernummer gibst du selbst ein) und **A24** PayPal in Stripe verbinden.
- **A25** Konten anlegen (alle auf jutta@planetclairetattoos.com, mit Zwei-Faktor-Anmeldung).
- **A26** Stammdaten und Bankverbindung für Vorkasse bereitlegen.
- **A27** Bei IONOS die DNS-Seite (Adress-Einstellungen der Domain) finden und Bildschirmfotos machen, aber nichts ändern.
- **A28** Prüfen, ob die Kanzleitexte vollständig da sind (als Text- und HTML-Datei).
- **A29** Erste echte Stücke fotografieren und die Angaben notieren.
- **A30** Die Vorschau-Datei anschauen und Anmerkungen notieren; **A31** diesen Bericht und die offenen Punkte lesen.
- **A32** Den Termin für den Start-Tag festlegen (ca. 5–6 Stunden am Computer, gern auf zwei Termine verteilt).

### Das passiert in P11 gemeinsam (AUFGABEN §4, A33–A41; Ablauf in `docs/GO-LIVE.md`)

Du meldest dich überall selbst an und gibst Passwörter, Schlüssel und IBAN selbst ein; ich sage dir, wo du klickst, und prüfe, was keine Geheimnisse zeigt.

- **A33** Konten verbinden und Schlüssel sicher hinterlegen; **A33a** Probelauf auf der Test-Seite, alles einmal durchklicken.
- **A34** In der Verwaltung eintragen: Passwort, Stammdaten, IBAN, LUCID-Nummer, Rechtstexte.
- **A35** Verträge zur Auftragsverarbeitung (Datenschutz-Verträge mit den Diensten) bestätigen; **A36** Statistik an oder aus; **A36a** Backup-Schlüssel erzeugen und sicher aufheben.
- **A41** Beispieldaten entfernen und „Startklar“ komplett grün sehen.
- **A37** DNS bei IONOS umstellen (spätestens einen Tag vorher die Mail-Einträge); **A38** Stripe live schalten.
- **A39** Echter Testkauf: kaufen, widerrufen, erstatten; **A40** Links in die Instagram-Bio setzen (Website und Impressum).

### Nach dem Start (AUFGABEN §5, A42–A50)

- **A42** Bestellungen bearbeiten (packen, Paketmarke, Sendungsnummer); **A43** Vorkasse: „Zahlung erhalten“ antippen.
- **A44** Widerrufe: Ware prüfen und spätestens 14 Tage nach dem Widerruf erstatten.
- **A45** Monatlich: Einnahmen in den Umsatz-Wächter eintragen, Monatsexport herunterladen; **A46** jährlich bis 1. Juni Verpackungsmengen melden.
- **A47** Jährlich Rechtstexte prüfen lassen; **A48** Tattoo-Fotos nur mit Einwilligung zeigen; **A49** Datenschutz-Anfragen innerhalb eines Monats beantworten, Datenpannen innerhalb von 72 Stunden melden; **A50** Kosten im Blick behalten.

Ab hier halte ich an. Ich beginne P11 nicht allein: Echte Konten und Schlüssel gibt es nur gemeinsam mit dir.

## 2026-10-06 – P10 Kennzahlen aus dem grünen Phasenlauf (3ff41ee)

Erster vollständig grüner Phasenlauf von Phase 10 (CI, CI full mit allen sechs Browser-Hälften, Abdeckung, Docker, Lighthouse, Vorschau-Export, Kunst-QA, Restore-Drill, Release-Probelauf). Die Tempo-Messung (Lighthouse, Median aus 3, Handy, gedrosselt):

| Seite | LCP | CLS | TBT |
|---|---|---|---|
| Startseite (R01) | 1669 ms | 0,005 | 183 ms (Gate ≤ 200, Ziel ≤ 150 knapp verfehlt) |
| Shop (R02) | 1669 ms | 0,034 | 110 ms |
| Produktseite (R04) | 1738 ms | 0,000 | 106 ms |
| Tattoo (R11) | 1479 ms | 0,008 | 122 ms |

Gate (LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms) überall eingehalten; Ziele (LCP ≤ 2,0 s, CLS ≤ 0,05) erreicht, nur der Blockierzeit-Wert der Startseite (TBT) liegt knapp über dem Ziel von 150 ms. Abdeckung insgesamt: 92 % Zeilen, 81 % Zweige; die geforderten Schwellen für Kasse, Zahlung, Sicherheit und Recht sind eingehalten. Vorschau-Datei ≈ 7,9 MB (Ziel ≤ 20 MB). Für die Abnahme von P10.2 („zwei aufeinanderfolgende Volläufe grün“) läuft ein zweiter Phasenlauf.

## 2026-10-06 – P10 CI-Reparatur, vierte Runde (Vorschau-Datei)

Bei der Vorschau-Datei ist eine Seite („schon ein Zuhause“, englische Variante) im GitHub-Lauf einmal nicht fertig im Browser erfasst worden; lokal trat das nie auf. Die Erfassung versucht es jetzt bis zu dreimal mit frischer Seite, und scheitert sie doch, bricht der Export mit einer klaren Meldung ab statt später mit einem unklaren Testfehler. Der Phasenlauf startet erneut.

## 2026-10-06 – P10 CI-Reparatur, dritte Runde

Zwei echte Funde: Im Docker-Image fehlten ein paar Dateien des React-Pakets, deshalb lieferte die Startseite dort einen Fehler (der Gesundheits-Check lief trotzdem durch) – jetzt werden sie mitgepackt. Und ein Test mit absichtlicher Fremd-Anfrage verhält sich unter WebKit anders; er prüft dort jetzt genau die zwei erwarteten Sicherheits-Meldungen und lässt alles andere durchfallen. Der Phasenlauf startet erneut.

## 2026-10-06 – P10 CI-Reparatur, zweite Runde

Gefunden und behoben: Die Vorschau-Seite der Verwaltung hatte in ihrer Sicherheitsrichtlinie den Hash eines kleinen Skripts vergessen; ein Test lief versehentlich im normalen Browser-Lauf statt im eigenen Vorschau-Lauf; ein Gesundheitstest brauchte in frischer Umgebung einen ersten Takt; im Docker-Job fehlte die Umgebungsdatei beim Warten; und für die Abdeckung der Rechts-Bausteine gibt es jetzt elf zusätzliche Tests. Ein Test mit absichtlicher Fremd-Anfrage prüft unter WebKit jetzt den erwarteten Sicherheits-Hinweis und entfernt nur genau diesen. Der Phasenlauf startet erneut.

## 2026-10-06 – P10 CI-Reparatur (veralteter Test-Schnappschuss, Docker-Build)

Im ersten Phasenlauf von P10 scheiterten zwei Dinge: ein veralteter Schnappschuss eines E-Mail-Tests (nur in CI ein Fehler, jetzt bereinigt) und der Docker-Build, der beim Bauen ohne Zugangsdaten über ein fehlendes Geheimnis stolperte (jetzt nur in der Bauphase ein Platzhalter, nie zur Laufzeit). Der Phasenlauf startet erneut.

## 2026-10-06 – P10 Phasenlauf

Alles für Phase 10 ist umgesetzt. Der Phasenlauf prüft jetzt auf GitHub: Abdeckung, alle Browser-Tests in zwei Durchläufen ohne Wackler, Tempo (Lighthouse), den Docker-Ausweg, die Wiederherstellungsübung und die finale Vorschau-Datei mit Offline-Test. Danach schreibe ich den Abschlussbericht für dich.

## 2026-10-06 – P10.1/P10.2/P10.4/P10.20/P10.21 Vorbereitung für den Phasenlauf

- Neue Kennzahl-Tests `tests/e2e/metrics/purchase-path.e2e.spec.ts` (EK-02: Karte, PayPal, Vorkasse, Abholung bei 390×844 und 412×915, genau 4 Seiten) und `tests/e2e/metrics/admin-taps.e2e.spec.ts` (EK-08/AK-7-05/AK-7-04: „bezahlt → versendet“ in höchstens 5 Taps, kein waagerechtes Scrollen); lokal gegen den Produktions-Build grün (18 Tests auf `iphone-15`/`pixel-7`), Kennzahlen als JSON unter `test-results/metrics/`.
- Flaky-Wächter `pnpm ci:flaky` (`scripts/ci/flaky-check.ts`) im Job `e2e-full`: ein Test, der erst im Wiederholungslauf besteht, macht den Lauf rot; Playwright schreibt dazu in CI `test-results/report.json`.
- `ci-full` Job `quality`: neuer Schritt `check:bundle` (Tempo-Budgets je Seitentyp); lokal ohne Debug-Flag alle Budgets eingehalten.
- Fehler behoben: `preview-export.yml` installierte nur Chromium, der Portabilitätstest braucht aber auch WebKit. Der Portabilitätstest meldete außerdem fälschlich „__leash“ in CSS-Klassennamen der Kunst-QA-Seiten (jetzt wie im Int-Test nur als eigenes Wort).
- Lokal geprüft: `pnpm preview:export` (7,88 MB) und `pnpm test:preview-export` (Chromium und WebKit) grün, `pnpm test:int` (166 Dateien) grün, `pnpm check` grün.
- Hinweis zu `E2E_SERVER=start`: Der 308 beim Vorwärmen (`/de/about` → `/de/ueber-mich`) entsteht nur, wenn auf dem Port ein anderer Server als der aus `.next` läuft (z. B. `pnpm dev` oder ein älterer Build); mit frischem Start ist es 200. Kein Fehler im Code; `global-setup.ts` nennt jetzt die Ursache.
- Der Phasenlauf `[ci:full p10]` muss noch belegen: Abdeckungs-Schwellen, E2E-Gesamtlauf ohne flaky, Lighthouse (Median aus 3), visuelle Prüfung, docker-Job, Restore-Drill, `verify-asset` und PR-Probelauf von `release.yml`.

## 2026-10-06 – P9 CI grün

Phasenlauf `d912802`: CI, CI full (sechs Browser-Hälften, Abdeckung, visuelle Prüfung, Lighthouse), Vorschau-Export und Kunst-QA grün. Vorschau-Artefakt `planet-claire-vorschau-p9-d912802`. P9.17 (Tempo/Barrierefreiheit: `art:check` 62/62, Lighthouse und axe in CI full) und P9.19 (Abschluss, Bündel `art-qa-20261006-iter01-b093408`) abgehakt; `LEGAL_TRACE_PHASE = 9`, `art:space`/`art:admin-icons` in ARCHITEKTUR §6.10 nachgetragen.

## 2026-10-06 – P9 CI-Reparatur (zwei Testfehler)

Im Phasenlauf von P9 scheiterten zwei Tests, beides Testprobleme und keine Fehler auf der Seite: Eine Prüfung auf „__leash“ im Vorschau-Export traf versehentlich Klassennamen der QA-Seiten (jetzt wird nur der eigenständige Name geprüft, wie im Debug-Check), und ein Test für Cocos Sprite lief in CI knapp über sein Zeitlimit (jetzt 30 Sekunden). Der Phasenlauf startet erneut.

## 2026-10-06 – P9 Phasen-Abnahme (Kunst & Bewegung) – für Jutta

### Phase 9 fertig: Zeichnungen und Animationen sind gebaut und dreifach geprüft

Hallo Jutta,

Phase 9 ist fertig. Coco, die Tuschelinie, die Zeichnungen und die Bewegungen sind jetzt so umgesetzt, wie ich deinen Strich aus den Skizzen und den Coco-Fotos verstanden habe.

### Was neu ist

- **Coco** ist nach deinen Fotos neu gezeichnet: große aufrechte Ohren, runder Kopf, helle Schnauze, weiße Brust und Pfoten. Sie läuft an der Linie mit, setzt sich, wenn du stehen bleibst, und blickt zur Seite.
- **Die Tuschelinie** wird von Hand gezeichnet gewirkt (Absetzer, leichtes Zittern) und führt dich durch die Startseite. Am Ende bildet sie ein Herz.
- **Stationen und Platzhalter** sind frei im Linienstil gezeichnet, mit viel Papier und nur kleinen schwarzen Punkten.
- **Fotos** bekommen einen einheitlichen Look; Produktfotos sitzen in einem Papierrand.
- **Seitenübergänge** und kleine Bewegungen (Hover, Korb, 404-Seite). Wer „weniger Bewegung“ eingestellt hat, bekommt ruhige Seiten.

### Wie es geprüft wurde

Neun Prüfrunden mit Videoaufnahmen auf Handy und Desktop, jedes Mal von drei unabhängigen Prüfern („Linsen“) ohne Vorwissen. Der automatische Check bestand am Ende mit 62 von 62 Kriterien, auch auf dem GitHub-Rechner ([Lauf mit den Videos](https://github.com/mvheinz/planetclairetattoos/actions/runs/37403045986), das Paket „art-qa-20261006-iter01-b093408“ ist 30 Tage verfügbar).

### Was noch offen ist (in `docs/OFFENE-PUNKTE.md`, „Kunst-QA offen“)

- Die Platzhalter-Bilder wirken auf den Prüfer noch nicht ganz handgemacht genug (Note 3 statt 4). Der nächste Schritt wäre, die Gesichter neu zu zeichnen – das machen wir gemeinsam in Phase 11.
- Kleine Bewegungs-Feinheiten (Coco wandert beim Seitenwechsel noch nicht mit).
- Du schaust dir alles einmal auf einem echten Handy an (auch im Instagram-Browser) – Liste in der Go-live-Checkliste.

## 2026-10-06 – P9 Kunst-QA: Abschlusslauf in CI (Tempo der Linie)

Im letzten CI-Lauf war nur noch eine Messung rot: der Aufbau der Linie am Desktop dauerte in einzelnen Teilstücken bis zu 9,5 ms statt höchstens 8. Die Linie wird jetzt in noch kleineren Stücken aufgebaut (höchstens ca. 1 ms je Stück). Der Lauf bestätigt das auf einer ruhigen Maschine.

## 2026-10-05 – P10.3

- Neue Suiten tests/e2e/a11y/audit.e2e.spec.ts (je Registry-Route DE/EN: 200 % Schrift bei 390 px ohne waagerechtes Scrollen, erzwungene Farben, prefers-reduced-motion ohne laufende Animation/Maske, Alt-Texte aller Bilder, Produkt-Alt DE/EN verschieden; Verwaltung: Login und jede Hauptansicht bei 390x844 mit axe) und tests/e2e/a11y/keyboard.e2e.spec.ts (Kauf Produktseite → Korb → Kasse → Danke und Widerruf vom Fußbereich, DE/EN, nur Tab/Enter/Pfeiltasten, :focus-visible an jedem Halt)
- Bestehende Suiten decken axe je Route und Zustand (leer, Fehler, reserviert, verkauft, Menü), Tastatur-Durchläufe (Menü, Galerie/Zoom, Auftragsformular, Verwaltung), AK-DS-07/08/09 und V-26 ab; keine neuen Befunde, nichts zu beheben (keine Konformitätsaussage)
- Stand ohne die Kunst-Phase P9: nach Zusammenführung wiederholen (OFFENE-PUNKTE)
- Tests: E2E desktop 215 Tests grün (a11y, keyboard, forms, frontend, security-headers u. a.)

## 2026-10-05 – P10.6

- Rate-Limits: tests/int/security/rate-limits.int.spec.ts liest die Grenzen aus ARCHITEKTUR §8.5 und prüft jeden Bucket tabellengetrieben an der echten Stelle (cart_add, checkout_start, checkout_start_day, checkout_submit, commission_submit/_day, commission_upload, commission_form_uploads, withdrawal_submit, admin_login, forgot_password, token_pages über 5 Stellen, product_status, client_errors): N-ter Aufruf erlaubt, N+1 abgelehnt mit Retry-After (429) bzw. stilles Verwerfen (204), andere IP unberührt
- i18n-Texte der 429-Antworten DE/EN geprüft, nur Hashes gespeichert (keine Klar-IP, kein Klar-Token), Zähler nach 24 h per purgeRateLimits (Wartungs-Job) gelöscht
- Honeypot und Zeitfalle: Schein-Erfolg ohne Datensatz und ohne Zähler (Auftragsanfrage, Widerruf)
- R-162: tests/e2e/privacy/forms.e2e.spec.ts crawlt alle Registry-Routen DE/EN plus 404: Texteingaben im Formular nur auf Kasse, Auftragsarbeiten, Widerruf (einzige Ausnahme: Stücknummern-Suche der 404-Seite, OFFENE-PUNKTE)
- R-137/T-20: Logger-Schwärzung und URL-Prüfungen der bestehenden Tests bleiben maßgeblich (logger.unit, redact.unit, E2E Kasse/Anfrage/Widerruf); Upload-Grenzen 413/415 in commission/upload.int
- Tests: 31 neue Int-Tests, 2 E2E, pnpm check grün

## 2026-10-05 – P10.5

- Audit über alle Registry-Routen DE/EN und alle Kontexte (public, dynamic, checkout, admin, api): tests/unit/security/audit.unit.spec.ts (Kontext je Route nach ARCHITEKTUR §8.1, Umgebung x Kontext, HSTS nur production/staging, noindex außer Produktion, keine unsafe-inline in Nonce-Kontexten, ignoreCves nur CVE-IDs mit OFFENE-PUNKTE-Zeile), tests/e2e/security-headers.e2e.spec.ts erweitert (noindex/kein HSTS auf allen Routen, alle API-Endpunkte im Kontext api auch bei Fehlern, Admin-Login/Manifest/Service Worker mit Nonce, R-136 privat ohne Anmeldung 401/403, /admin und GraphQL 404, Verwaltungspfad in keinem öffentlichen HTML, Selbsttest des CSP-Wächters)
- CSP-Wächter: Auto-Fixture cspViolations in tests/e2e/fixtures.ts lässt jeden E2E-Test bei securitypolicyviolation oder CSP-Konsolenfehler scheitern; 22 Spezifikationen laufen jetzt über die Fixtures
- Spike B-03 erneut bewertet: Rückfall bleibt (public: script-src 'self' 'unsafe-inline', keine Fremd-Hosts), B-01 Soll (Nonce) erfüllt; in ARCHITEKTUR Anhang B und ADR 0002 eingetragen
- Abhängigkeiten: pnpm audit --prod ohne high/critical: nodemailer 10.0.15 und undici 7.30.0 per Override (gepatcht), braces nur als ignoreCves CVE-2026-93687 (kein Fix vorhanden), alle mit OFFENE-PUNKTE-Zeile; pnpm check:external --built grün (560 Dateien, Verwaltungspfad nicht enthalten)
- gitleaks läuft nur im CI (lokal nicht installierbar), siehe OFFENE-PUNKTE
- Tests: pnpm check grün, pnpm test:int 166 Dateien grün, E2E security-headers (desktop) grün

## 2026-10-05 – P10.19

- RECHT §7 Teil A vollständig abgehakt (05.10.2026): R-049 (amtliche Grafik offline nicht ladbar, Platzhalter in OFFENE-PUNKTE), R-095 (Token withdrawalUrl und phone), R-156 (VVT V1–V19 vollständig, zugleich R-210 Nr. 14), R-157 (RUNBOOK §9 und Handbuch Kapitel 16), R-161, R-190, V-18/V-28/V-29 erneut gesichtet (nur EN-Fachbegriff legal guarantee), EK-09 erneut (Paritäts- und lorem-Tests grün)
- Instagram-Export fehlt weiter (nur LIESMICH): seed:import-instagram/--refresh-media entfallen, art:vectorize und art:coco-refs unverändert reproduzierbar; KUNST-QA-Teilaufnahme bewusst auf den Abschlusslauf nach dem Zusammenführen mit P9 verschoben (OFFENE-PUNKTE)
- OFFENE-PUNKTE bereinigt: Überblick nach Zuständigkeit (Jutta, Kanzlei, Steuerberatung, technisch erledigt), neuer Abschnitt 4.2, veraltete Angaben zu Coco-Fotos und DATEV korrigiert
- Tests: tests/unit/legal/withdrawal-placeholder.unit.spec.ts (3), pnpm check grün (1960 Tests)

## 2026-10-05 – P10.18

- docs/owner/HANDBUCH.md: 20 Kapitel in Du-Form (Anmelden/PWA, Heute, Neues Stück mit Pflichtangaben und Fotoregeln, Meine Stücke, Packen/Versendet, Vorkasse, Abholung, Widerruf und Erstattung, Anfragen, Tattoo, Texte, Einstellungen, Umsatz-Wächter, Export, Datenschutz-Anfragen, Datenpanne nach R-157, Startklar, Beispieldaten, Vorschau-Datei und Hinweis zur Barrierefreiheit nach R-190, Notfall und Hilfe), jedes mit Bildschirmfoto aus P10.17
- AUFGABEN §5 und ANLEITUNGEN §17 verlinken das Handbuch statt „kommt in P10“
- Verwaltungspfad steht bewusst nicht im Handbuch (kommt als Lesezeichen in P11)
- Tests: tests/unit/docs/handbook.unit.spec.ts (7: Kapitel, Links/Bilder/Anker, V-26, R-157, keine Geheimnisse); pnpm check grün (1957 Tests)

## 2026-10-05 – P10.17

- pnpm handbook:shots (scripts/handbook/shots.ts, shotList.ts): 41 WebP-Bilder 390x844 DPR 2 nach docs/owner/img/handbuch/ (alle Handy-Ansichten, Detail- und Dialogansichten, 3 öffentliche Seiten), zusammen 1,5 MB, je Bild max. 68 KB
- Deterministisch (Wiederholung byte-gleich), nur Beispieldaten, kein Verwaltungspfad im Bild (Textprüfung)
- Beispieldaten-entfernen-Knopf ist im Beispielbestand gesperrt: Bild zeigt den gesperrten Knopf
- Tests: tests/unit/docs/handbook-images.unit.spec.ts, pnpm check grün (1950 Tests)

## 2026-10-05 – P10.16

- docs/GO-LIVE.md: Spielregeln (wer tippt was), Konten-/Ressourcenliste (§12.2), Variablen je Vercel-Umgebung, Datenbank-Ablauf (Migration, Beispielbestand in `main`, Zweige seed-root/staging/preview, `db:mark-production`), DNS-Umstellung mit Ist-/Soll-Tabelle wörtlich aus ARCHITEKTUR §12.4, `dig`-Befehle, TTL T−1/T+7, Rückweg, AK-A-12-01…03, Stand der Spikes (B-01 Soll erfüllt, B-07 im Staging bestätigen), je ein Abschnitt P11.1–P11.17 mit Prüfkriterium und Verknüpfung zu AUFGABEN A23–A41/ANLEITUNGEN, Testkauf-Drehbuch, KUNST-QA §10 Nr. 4, EK-08-Stoppuhr, 7-Tage-Überwachung.
- Tests: tests/unit/docs/golive (5: Abschnitte P11.1–P11.17, DNS-Tabellen = ARCHITEKTUR, Verknüpfungen, B-01, keine Geheimnisse/tiefen URLs)

## 2026-10-05 – P10.15

- docs/RUNBOOK.md (14 Kapitel): Topologie, Konfiguration (alle 68 Variablen aus der Registry mit „Pflicht in“/Geheim, ohne Werte), Deploy/Rollback/rückwärtsverträgliche Migrationen, Schlüsseltausch je Geheimnis (§8.9), Sicherheitsupdate (Session starten, 48 h), Backups und Wiederherstellung Schritt für Schritt (Flags wie in den Skripten), halbjährliche Übung, Wartungsmodus, Alarme M-01…M-12 mit Handlungsanweisung, Datenpanne (R-157: erkennen, bewerten, 72 h, Online-Formular der Berliner Beauftragten, Betroffene, DE-Vorlagen, Kontaktliste), Kosten-Routine, DNS-Verweis auf GO-LIVE, Docker-Umzug, Vorlage Vorfallprotokoll, Betriebsprotokoll.
- Tests: tests/unit/docs/runbook (7: Überschriften, Variablen-Vollständigkeit, M-01…M-12, Geheimnisse, Datenpanne, pnpm-Befehle/Flags gegen package.json und Skripte, keine Geheimniswerte)

## 2026-10-05 – P10.14

- src/lib/golive/{checks,collect}.ts: eine Prüffunktion (15 Punkte R-210 Nr. 1–15 inkl. KONZEPT §7.16/DATENMODELL §13.7) für `pnpm check:golive [--json]`, Ansicht Einstellungen → System → „Startklar“ (grün/rot mit Erklärung, AVV-Liste aus services.generated.ts), Hinweis „Startklar-Prüfung nicht grün“ mit Link unter „Heute“ und die Go-live-Sperre „Shop öffnen“ in Produktion (Settings.ts listet alle offenen Punkte; Knopf in den Shop-Einstellungen zeigt dieselbe Liste). Platzhalter „kommt in P10“ entfernt (`systemStartklarLater`/`todayStartklarLater`, `STARTKLAR_PLANNED`); `countUnapprovedOwnerPhotos` und Galerie ohne Einwilligung fließen in Punkt 15 ein; `docs/recht/VVT.md` per outputFileTracingIncludes im Build.
- Trockenlauf `pnpm check:golive` gegen die Grund-Seed-Datenbank (Exit 1): rot sind Rechtstexte, Bausteine, Stammdaten, IBAN, LUCID/Systembeteiligung, AVVs (7 Dienste), Beispielbestand/Vorschau-Modus, ADMIN_ROUTE, Treiber/Stripe, Statistik-Entscheidung, harmonisierte Mitteilung (Platzhalter-Grafik), Steuer/Vorjahresumsatz – grün: Lieferländer, VVT, Fotos (12 von 15 offen, erwartet).
- Tests: tests/unit/golive/checks (25, jede Prüfung einzeln grün/rot, R-155 AVV), tests/int/golive/shop-open-lock (3), settings-part3/today int angepasst; E2E today + settings-system (pixel-7) grün, Suche „kommt in P…“ ohne Ausnahme; pnpm check/build grün

## 2026-10-05 – P10.13

- vercel.json (fra1, Crons tick/backup, Ignored Build Step scripts/vercel-ignore-build.mjs); Origin-Listen cors/csrf (Apex + Vercel-Produktions-Domain in Produktion); pnpm db:mark-production (--yes); /api/health?deep=1 mit Bearer (DB- und Speicher-Ping)\n- admin:create/unlock und assertProductionEnv bereits vorhanden; Spike B-01 Stand: Soll erfüllt (ARCHITEKTUR Anhang B)\n- Tests: tests/unit/deploy/vercel-json, tests/unit/security/origins, tests/int/admin/admin-create, tests/int/health/deep; AK-1-02/AK-A-3-02/AK-A-4-01/AK-A-4-02 weiter grün

## 2026-10-05 – P10.12

- Dockerfile: Ziel migrator, HEALTHCHECK, Schriften, BUILD_WITHOUT_DB=1; docker-compose.prod.yml (caddy, app, migrate, postgres ohne Port, scheduler 30 1 * * *), deploy/Caddyfile, .env.production.example (generiert), .dockerignore; Job docker in ci-full.yml\n- Spike B-08 bestanden: Build ohne DB (dbGate/connection()), danach gegen befüllte DB gestartet: /api/health, /de, /en, Shop, Archiv 200; Ergebnis in ARCHITEKTUR Anhang B\n- Tests: tests/unit/deploy/docker-files, tests/unit/ci/workflows; Image-Größe/UID/Compose-Lauf belegt der CI-Job docker im Phasenende-PR (Docker-Daemon lokal nicht verfügbar)

## 2026-10-05 – P10.11

- @vercel/analytics 2.0.1 exakt gepinnt; AnalyticsSlot/AnalyticsClient (nur mit NEXT_PUBLIC_ANALYTICS_ENABLED, APP_ENV=production, kein PREVIEW_EXPORT, settings.analytics.enabled+confirmedAt+Notiz), beforeSend filtert R06–R09/R26/Admin/API und Query
- Tests: tests/unit/analytics/before-send (inkl. Registry-Abgleich), tests/e2e/privacy/analytics (desktop+pixel-7 grün), check:external und check:bundle grün

## 2026-10-05 – P10.10

- @sentry/nextjs 11.4.0 nur in instrumentation.ts (ohne DSN nie geladen), redactSentryEvent, Logger→Sentry-Brücke, /api/client-errors (aus, 404), Client-Slot, check:external prüft Sentry-Leaks, System-Ansicht zeigt Backup
- Tests: tests/int/monitoring/{sentry,client-errors,alert-throttle}; Unit check-external; Build + check:external grün

## 2026-10-05 – P10.9

- Spiegel (mirror.ts), Cron-Route /api/cron/backup, backup-status.json, Monatsstand, A12 bei Fehlern, Nach-Wiederherstellung-Abgleich (postRestore.ts, Endpoint, Ansicht System), restore-drill.yml + scripts/ci/restore-drill.ts
- Tests: tests/int/backup/{mirror,cron-route,retention-replay,post-restore}; Drill lokal grün; GitHub-Lauf folgt im PR der Phasen-Abnahme

## 2026-10-05 – P10.8

- Backup I: src/lib/backup/{format,dump,crypto,run,restore,s3}.ts („pcdump v1“: REPEATABLE READ/READ ONLY, COPY nach Primärschlüssel, md5 je Tabelle, setval; gzip → age; Datei oder S3-Multipart); Wiederherstellung in einer Transaktion (Fremdschlüssel/Trigger, Rollback bei Abweichung)
- Skripte pnpm backup:run, backup:restore, backup:verify (Schlüssel nur als Datei)
- Spike B-06 bestanden (400 000 Zeilen in 3,4 s, 33 MB, konstanter Speicher) und in ARCHITEKTUR Anhang B eingetragen
- Tests: tests/unit/backup/format (6), tests/int/backup/roundtrip (8: AK-A-10-01/-02/-05)

## 2026-10-05 – P10.7

- Wartungsmodus: Proxy liefert 503-Seite in Juttas Ton (DE/EN, mit Fußlink „Vertrag widerrufen“); Impressum, Datenschutz, AGB, Widerrufsbelehrung und R26 bleiben offen; Webhook/Kasse-Zustand/Upload 503, Tick 204, Health mit maintenance
- R26 ohne erreichbare Datenbank: mailto-Weg an MAIL_REPLY_TO (isDatabaseReachable)
- Tests: tests/int/maintenance.int.spec.ts (10), tests/e2e/maintenance.e2e.spec.ts (4, eigener Server: pnpm test:e2e:maintenance)
## 2026-10-06 – P9.12, P9.13, P9.18 abgehakt (Kunst-QA, Fall b)

Neun Prüf-Durchgänge (Iteration 01–09, Protokolle in `docs/design/qa-log/`, Reviews je Linse) mit jeweils grünem `art:check` auf der Vollaufnahme in Iteration 06–09. Die Schleife endet nach Fall b (8+ Iterationen): alle nicht verhandelbaren Punkte bestehen, der Prüfer R3 meldet PASS. Offen als „Kunst-QA offen“ (in `docs/OFFENE-PUNKTE.md`): Platzhalter noch nicht ganz auf Note 4 (AR-05 = 3; nächste Stufe: Gesichter neu zeichnen, gemeinsam mit Jutta in P11), die Bewegungs-Feinheiten MO-11/MO-12 und Cocos Wanderung im Seitenübergang (MO-14). Gefundener und behobener Fehler: Der Seitenübergang stand am Ende der Seite statt im Kopf und wurde von Chromium übersprungen.

## 2026-10-06 – P9.18a

- Fall b (KUNST-QA §6.6 Nr. 6.1) nach 9 Iterationen (Iteration 06–09 in dieser Session): alle nicht verhandelbaren Punkte PASS, `art:check` 62/62 in jedem Lauf. Iteration 09: R1 FAIL (AR-05 Note 3), R2 FAIL (MO-11, MO-12 Note 3), R3 PASS.
- Offen als „Kunst-QA offen“ (docs/OFFENE-PUNKTE.md): AR-05, MO-11/MO-12 (MI-01 Posenwechsel, MI-06/07/10/12 Aufnahme), MO-14 (Coco wandert nicht, ADR 0003). Protokolle: docs/design/qa-log/2026-10-05-iter-06.md bis -09.md, Reviews unter reviews/iter-06 bis iter-09.
- Echter Produktfund: `@view-transition` stand am Ende des `<body>`, Chromium übersprang den Seitenübergang; jetzt im `<head>` (MO-14 misst 242 statt 0 Animationen).
- Weitere Produkt-Änderungen: Nr. 922 im Raster nicht mehr schwarz (kein Multiplizieren bei Aquarellen), Coco-Boil ohne Lücke, Ruheplatz hinter der Kopf-Schlaufe (reduziert), Herz am Endanker, Planeten-Marke bei erzwungenen Farben ohne Füllung, Stationen hallo/jutta-und-coco neu, zehn Platzhalter ohne Wash.
- Tests: pnpm check grün (207 Dateien, 1 889 Tests), pnpm build grün, pnpm test:perf (Lighthouse-Gates) Exit 0, visuelle Referenzen für 6 Bilder erneuert, E2E-Teilauswahl (desktop + pixel-7: leash, coco, home, home-choreo, reduced-motion, motion-toggle, art-gate, error-pages, menu) 81 grün; rot bleiben in dieser Umgebung `coco.e2e` „Weiche Navigation“ (2 Fälle, rot auch mit dem alten `SiteDocument`, einzeln mit `-g` grün) und ein reihenfolge-abhängiger Fall in `home.e2e` (einzeln grün); `@a11y`-Auswahl: `keyboard.e2e` EK-07 scheitert am Footer-Schalter „Animationen: aus (Systemeinstellung)“ (Umgebung mit System-Bewegungsreduktion) – nicht abgehakt, siehe Bericht.

## 2026-10-05 – P9.7 Kunst-QA-Workflow bewiesen

`[ci:art]`-Lauf 37329881684 (Commit 85347b4) ist grün: 62 von 62 automatischen Kriterien bestanden, Bündel `art-qa-20261005-iter01-85347b4` (≈ 100 MB) hochgeladen, genau ein Bündel vorhanden, Laufzeit ≈ 44 Minuten (Gate ≤ 45, Abbruch 60). Probe `gh run download`: Der Download der Artefakt-Datei ist von dieser Cloud-Umgebung aus nicht möglich (Proxy erlaubt keine Weiterleitung auf den Blob-Speicher); Auswertung läuft deshalb über die Zeilen im Job-Log (`ROT <ID>: …`) – Eintrag in OFFENE-PUNKTE.

## 2026-10-05 – P9 Kunst-QA: vierter Lauf in CI

Zwei Aufnahme-Worker statt drei (drei störten sich gegenseitig), die Kassen-Szenarien laufen nacheinander, und rote Kriterien stehen jetzt mit Messwert im Log. Die Messung der Linien-Nachführung auf dem iPhone-Profil ist genauer geworden. Der Lauf zeigt auf einer ruhigen Maschine, ob alles besteht.

## 2026-10-05 – P9 Kunst-QA: dritter Lauf in CI

Im letzten CI-Lauf war nur noch eine Messung rot (Tempo der Linie auf dem iPhone-Profil). Ursache war ein echter Fehler (die Linie reagierte beim schnellen Wischen nur auf gedrosselte Scroll-Ereignisse) plus ein Messproblem; beides ist behoben. Außerdem nehmen drei Worker parallel auf, damit der Lauf kürzer wird. Der Lauf bestätigt das auf einer ruhigen Maschine.

## 2026-10-05 – P9 Kunst-QA in CI: Zeitlimit 60 Minuten

Der zweite Kunst-Lauf in CI brauchte allein für die Aufnahmen 41 Minuten (mehr Szenarien als beim ersten Lauf) und lief ins 45-Minuten-Limit. Limit auf 60 Minuten angehoben (öffentliches Repo); Lauf startet erneut.

## 2026-10-05 – P9 Kunst-QA: zweiter Lauf in CI

Stand nach den Prüf-Durchgängen 2–5 (PF-02/PF-04 behoben, Coco größer an der Linienspitze, Stationen und Platzhalter freier gezeichnet, Papierrand um Produktfotos). Der zweite `[ci:art]`-Lauf misst Tempo und Bewegungen auf einer ruhigen Maschine, weil der lokale Rechner stark schwankt.

## 2026-10-04 – P9 erster Kunst-QA-Lauf in CI

Stand der Kunst-Arbeit (Coco nach deinen Fotos, neue Stationszeichnungen, Linie, Foto-Look, Bewegungen) ist im Arbeitsbranch. Der erste `[ci:art]`-Lauf nimmt Videos und Messwerte auf einer ruhigen Maschine auf (P9.7).

## 2026-10-04 – P9 (Arbeitsstand, nicht abgehakt: P9.12, P9.13, P9.17, P9.18)

- P8-Stand übernommen (parallele Int-Worker, E2E-Shards, Test-Fixes); `pnpm check` grün, `PC_INT_WORKERS=3 pnpm test:int` 153/153 Dateien grün (ohne preview-export); visuelle Referenzen jetzt immer mit kanonischem SEED_NOW (`test:visual`), zwei Läufe 70/70.
- Coco nach Juttas 5 Fotos: große aufrechte Ohren (Ohr/Kopf ≈ 0,68), kürzere Beine, buschigerer Schwanz, Nase/Maul mittig; Charakterblatt, Platzhalter, Stationen und OG-Bild neu. CO-01…CO-08 PASS (Lauf iter44/iter45).
- Stationen keramik, tattoo, zeichnungen frei neu gezeichnet, einheitlich 2 px Strich; Platzhalter: Schraffur je Motiv verschieden, Hand und Wade lesbar.
- Foto-Look: Gamma-Untergrenze 0,7 und Weißabgleich in zwei Durchgängen – IM-02 jetzt auch bei frischem Seed grün (σ 4,97).
- Kunst-QA Iteration 01 (Lauf iter45): art:check 59/62 (PF-02/PF-04 unter Fremdlast, LQ-06 einmalig); Linsen R1/R2/R3 FAIL – R1: CO-09 4, AR-05 3, IM-04 3, LQ-08 3, AR-07 PASS; Details `docs/design/qa-log/2026-10-04-iter-01.md`.
- Lighthouse (3 Durchläufe): LCP überall ≤ 2,1 s; TBT 86–275 ms, schwankt mit der Rechnerlast.

## 2026-10-04 – P9.16

- Letztes offenes Kriterium Vorschau-Datei (KONZEPT §12.7 Nr. 5 und 7) im Arbeitsbaum mit eigener DB/Port belegt: pnpm preview:export (PREVIEW_EXPORT_DB_NAME=planetclaire_c_preview_export, Port 3250) → 164 Routen, 0 Warnungen; pnpm test:preview-export 32/32 grün (Nr. 5: Linie zeichnet beim Scrollen weiter, Coco bewegt sich; reduzierte Bewegung statisch; Nr. 7 und P3.16: „In den Korb“-Mikromoment, Schild-Schwingen ohne Anfragen)\n- MO-01…MO-04, MO-13…MO-15, RZ-01/02, A11Y-06 PASS in art:check (Lauf iter39); AK-DS-11/16 grün\n- Tests: pnpm test:preview-export (32), pnpm check

## 2026-10-04 – P9.15

- Choreografie journey (Stationen, Posen, Brücken, Intro) in coco.ts/runtime.ts/presets.ts\n- Lauf iter39: MO-04…MO-10 PASS in allen Profilen, LG-01 auf SC-01 leer, PF-01…PF-06 PASS\n- Tests: tests/unit/leash/choreo.unit.spec.tsx, tests/e2e/home-choreo.e2e.spec.ts (421 E2E grün, desktop + pixel-7)

## 2026-10-04 – P9.14

- Foto-Look-Pipeline (Weißabgleich, Belichtung, Schalter) in enhance.ts, media:regenerate idempotent\n- Lauf iter39: IM-01, IM-02 (σ Median-L* 3,28 über 9 Fotos), IM-05 PASS; Population und Papier-Anteil in OFFENE-PUNKTE\n- Tests: enhance.unit.spec.ts, regenerate.int.spec.ts

## 2026-10-04 – P9.11

- Engine-Parameter wie DESIGN, Randbahn-Routing und Stale-Linie in geometry.ts/runtime.ts; Engine 11 998 B gz (Budget 12 000 gehalten)\n- Lauf 20261004-iter39-9953802: LQ-01…LQ-06 und A11Y-05 PASS, PF-09/PF-12 PASS\n- Tests: tests/unit/leash/{ink,geometry,loops,routing}.unit.spec.ts, E2E leash/home-choreo grün

## 2026-10-03 – P9.11–P9.13 (Zwischenstand, noch nicht abgehakt)

- Tuschelinie Stufe A: LQ-01…LQ-06 PASS (Lauf 20261003-iter23-a0f8bdc, LQ-06 11,7 L*), PF-09 Engine 11 759 B gz (Luft 241 B), PF-12 PASS (A → B), PF-04 Desktop max. 12,9 ms unter Fremdlast. Offen für P9.11: A11Y-05/LG-01 (Coco-Box über Text auf R01, kommt mit P9.15), PF-05 (R01 16 Layouts, R07 10: Countdown-Sekundentakt und nachgeladene Karten, nicht die Engine), PF-10 Startseite (siehe OFFENE-PUNKTE).
- Stationen/Weltraum/Marke: AR-01…AR-03, AR-06 PASS; 16-px-Favicon mit dickerem Strich (Planet mit Ring lesbar). Frische Prüf-Linse (Lauf lens5): Stationen keramik/tattoo/zeichnungen noch als „Trace-nah“ bemängelt, Strichstärke zwischen Stationen uneinheitlich – AR-07 daher offen.
- Platzhalter: AR-03/AR-04 PASS; Linse AR-05 = 3, IM-04 = 3, CO-09 = 3 (Ziel ≥ 4): Platzhalter „niedlicher als Juttas Hand“, Raster beginnt mit zwei reinen Platzhalter-Reihen; Coco-Dynamikposen haben spitze Schnauzen.
- Tests: `pnpm check` (1833 Unit-Tests) grün.

## 2026-10-03 – P9.10

- `rennen` mit drei echten Gangphasen (A Streckung, B Sammlung, C Flug; IoU 0,59–0,66, Anker ± 1,5), `schnueffeln` (Nase am Boden, C 1 Einheit Schnüffel-Zucken), `springen` (Luftbogen, Ballen sichtbar wie in Juttas Sprung-Skizze), Brücken `bremsen`, `abspringen` – alle 22 Symbole final.
- PF-10 Sprite 42,4 KB roh / 10,7 KB gz (≤ 45/12), PF-09 Coco-Steuerung 1,7 KB gz; MO-03 PASS (12/10/8 fps, Seek 0/1/2 → a/b/c).
- Tests: Erweiterung `sprite.unit.spec.ts` (COCO_POSE_TO_SPRITE, fps, Budgets, B/C neu gezeichnet, Schlaf-Schraffur).

## 2026-10-03 – P9.9

- Neuer Zeichen-Generator `scripts/art/draw-coco.ts` (`pnpm art:coco`, ersetzt den Platzhalter-Generator): Frame A je Pose von Hand gesetzt (Stützpunkte, keine Primitive), B/C jede Linie neu nachgezeichnet (0,5–1,5 Einheiten), Juttas Strich: offene Konturen, Haken an Strichenden, offene Augenringe mit Seitenblick, ferne Beine als ein Strich; `sitzen`, `kopfschief` (rechtes Ohr an der Spitze geknickt), `schlafen` (Augen als Bögen, 5 Schraffurstriche), Brücken `einrollen-1/-2`.
- Sprite v2: `public/art/coco-sprite.v2.svg` 42,4 KB / 10,7 KB gz; Version nur in `SPRITE_VERSION` (build-sprite.ts) – art:check, check-bundle, Tests lesen den Pfad aus `coco-sprite.json`/`coco-anchors.json`; v1 gelöscht.
- `art:check` (Lauf 20261003-iter18-09c99dd, SC-12): CO-01, CO-02, CO-04, CO-05, CO-06, CO-07, CO-08, MO-03 PASS. CO-02 gilt laut KUNST-QA nicht für `schlafen` (Checker korrigiert, OFFENE-PUNKTE).
- Prüf-Linse auf dem Coco-Bogen: Coco in allen 22 Frames erkennbar; Geschirr überall, wo Rücken/Brust sichtbar; D-Ring nach Vergrößerung/Anbindung an den Rückensteg; Hinweis: Nase im Schlafgesicht klein. Stilnote 3.
- Tests: `tests/unit/art/sprite.unit.spec.ts` (21 inkl. Charakterblatt), `pnpm check` (1817), Int (1006), E2E Coco/Leash (13 bestanden, 13 projektbedingt übersprungen).

## 2026-10-03 – P9.8

- Coco-Charakterblatt `content/art/coco/character-sheet.svg` + `.webp` (219 KB) mit `pnpm art:character-sheet` (`scripts/art/character-sheet.ts`): Seitenansicht (stehend) mit K-Hilfslinien (Boden, Widerrist 1,3 K, Ohrspitze, K-Raster), ¾-Ansicht (sitzen), 9 nummerierte Merkmale, Messtabelle (gemessen wie art:check CO-02: Ohr 0,88/0,92, Auge 0,19, Schnauze 0,34/0,37, Nase 0,10/0,14, Bein 0,14 – alle im Bereich), Wash-Versatz, Strich-Regeln, Gesten aller 6 Posen + 4 Brücken. Kein `<image>`, nicht in `public/`, nicht im Build.
- Grundlage ohne eigene Fotos: Juttas Skizzen + 9 Highlights (Annahme in OFFENE-PUNKTE); kein Instagram-Export vorhanden.
- Frische Prüf-Linse (4 getrennte Headless-Läufe, KUNST-QA §6.1 Nr. 5): letzte Iteration „Coco erkennbar? ja (eingeschränkt)“; CO-03: Ohren groß/aufrecht ja (Knick bei kopfschief im Blatt-Thumbnail schwer sichtbar), Augen mit Glanzpunkt ja, kurze Schnauze ja, schwarze Nase ja, schlanke Beine ja, Sichelschwanz ja, Geschirr mit D-Ring ja (D-Ring klein). Stilnote CO-09: 3 (Ziel ≥ 4 erst P9.13). Offene Hinweise der Linse: Ohren eher fennekartig, Fell-Wash heller als Cocos Goldton, Strich zu gleichmäßig – Nacharbeit P9.13/P11 (Jutta).
- Tests: `tests/unit/art/character-sheet.unit.spec.ts` (5, grün).

## 2026-10-03 – P9.6

- pnpm art:check um MO-01…10/13…15, LG-01…04, PF-01…12, A11Y-01…07, CT-01…03, RZ-01/02 ergänzt (Sonden: getAnimations mit Easing, poseLog, data-boil, Textzeilen per Range.getClientRects, Fokusring, Zusatzmessungen Intro/Folgen/Lesezeile/Tab-Reihenfolge/200 %/qa-jank/verborgener Tab/Desktop-Messungen); PF gegen perf.json (P9.4); --evidence führt AK-DS-01/AK-DS-17 aus
- Stand iter15: 34/62 auto grün; rot u. a. LQ-03/04/05 (Engine-Parameter, P9.11), PF-04/PF-05 (P9.11/P9.15), LG-01 (Coco-Box/Linie über Text R01/R08), CO-02/05/06 (Sprite v1, P9.9), IM-02 (P9.14), A11Y-06/RZ-01 (je 1 Transition auf Ruhe-Routen), MO-02/14 (View Transition ease/250 ms)
- Tests: check-art.unit.spec.ts (Abgleich AUTO_IDS ↔ KUNST-QA §5; ease/MO-02, 7 s Boil/MO-04, Linie über Text/LG-01, LoAF 80 ms leash/PF-01)

## 2026-10-03 – P9.5

- pnpm art:sheets (Kontaktbögen 2400 px/6 Spalten, Coco je Pose A/B/C + ?parts=1, Stationen neben Quelle, Kalibrierbogen; je ≤ 1,5 MB), pnpm art:bundle (manifest.json §8, Vollständigkeit §4.3, ≤ 100 MB, Sonden gzip), pnpm art:check (check.json/check.md, Kriterien aus KUNST-QA §5 geparst, R1/R2/R3 offen markiert, Exit ≠ 0 bei FAIL)
- Kunst-Kriterien LQ-01…06, CO-01/02/04…08, AR-01…04/06, IM-01/02/05; Aufnahme-Sonden je Standbild (raw/**/probes.json) und axe je Route
- Lauf 20261003-iter15-21c6686 (alle Bild-Szenarien, 81/81 grün, Last bis 11 bei 4 Kernen): 167 Bögen (56 MB), Bündel 100 MB (Pflichtteil 62 MB)
- Tests: tests/unit/art/check-art.unit.spec.ts, tests/unit/art/bundle.unit.spec.ts (Negativ-Fixtures Kreisschlaufe/LQ-04, <circle>+Spiegelung/CO-07, #333333/LQ-01, <text>/AR-04; fehlendes Video/Frames/Kalibrierbogen)

## 2026-10-03 – P9.4

- `tests/art/sc-18.art.spec.ts` (Pixel 7, CPU 4×, ohne Video, Vorlauf verworfen, R01/R02/R04/R07 je 3× mit und 3× `?leash=off`, CDP-Trace je Route) und `pnpm art:metrics` → `metrics/perf.json` mit allen Größen, Gates PF-01…PF-08 relativ zur Grundlinie plus absolute Grenzen; Rechnerlast je Lauf (`host.reliable`).
- Basis-Lauf im qa-log (`docs/design/qa-log/2026-10-03-basislauf-sc18.md`), bei ruhiger Maschine wiederholt (`iter14`, Last ≤ 2,6 bei 4 Kernen): rot nur PF-04 (R01/R02) und PF-05 – Arbeitspunkte für P9.11/P9.15, Grenzwerte unverändert.
- Tests: `tests/unit/art/metrics.unit.spec.ts` mit Beispiel-JSONs aus `tests/fixtures/art/` (grün), `pnpm check`, Int grün.

## 2026-10-03 – P9.3

- Szenarien SC-01…SC-11, SC-14, SC-15, SC-17 als `tests/art/sc-XX.art.spec.ts` nach KUNST-QA §4.3 (Frames mit `t`/`y` in der Beschriftung, Kasse/Danke mit Mock-Zahlung, Fremd-Host-Wächter).
- `art:record` verteilt die Bild-Läufe auf 2 Worker und misst SC-18 danach allein; Rechnerlast wird in `run.json` protokolliert.
- Leere Frames (nicht gerasterte Kacheln nach Scroll-Sprung in der Pixel-7-Emulation) werden erkannt und neu aufgenommen (`retakes.json`).
- Tests: vollständige Aufnahme `20261003-iter13-bb9ffe0`: 81 Bild-Tests + SC-18 grün, 3 968 Frames, 81 Videos, 0 leere Frames, 0 Fremd-Hosts; 26,3 min unter Fremdlast (ohne Fremdlast 24,0 min, `iter11`); `pnpm check`, Int grün.

## 2026-10-03 – P9.2

- `playwright.art.config.ts`: Projekte `art-iphone15` (WebKit), `art-pixel7`, `art-desktop` × `motion`/`reduced` + `art-pixel7-tempo`; Auswahl per Tags am Test; Server = QA-Build `.next-art` (`pnpm art:build`, Debug + ART_QA) auf Port 3200\n- Helfer `tests/art/helpers/` (Clock vor Navigation, scrollTo + 2 rAF, WAAPI-Seek, Boil-Seek, Sequenzen per Clock, Video in Viewport-Größe, Fremd-Hosts blockiert = Testfehler); `pnpm art:record` (Lauf-ID, verweigert bei unsauberem git status, `artifacts/art-qa/<lauf-id>/`), `pnpm art:compare`\n- SC-00, SC-12, SC-13 (Playwright), SC-16 (Skript, `metrics/images.json`); Kalibrierbogen vom unveränderten Sprite v1 neu (72 + 180 px, 137 KB)\n- Nachweis: `art:record --scope SC-00,SC-12,SC-13` zweimal auf Commit 050a858 → 12/12 grün je Lauf, `art:compare`: 75 reduced-Frames pixelgleich\n- Tests: tests/unit/art/record.unit.spec.ts (7), sprite.unit.spec.ts angepasst

## 2026-10-03 – P9.1

- QA-Modus `ART_QA` (`artQaActive`, Startregel: in Produktion Abbruch), QA-Seiten `/{locale}/qa/{coco,art,motion,leash,error}` (dynamisch, sonst 404, noindex, nicht in Registry/Sitemap/robots/Vorschau-Export)\n- Query-Schalter `?leash=off` (kein Engine-/Coco-Chunk), `?freeze=1`, `?qa-jank=30` nur mit Server-Marke `pc-art-qa` (`src/lib/qa/switches.ts`, `QaRuntime`); `/qa/motion` spielt MI-01…16 mit Produkt-Komponenten und -Modulen (`QaReplay`, Modus preview)\n- `check:no-debug`: Marker nur als eigener Bezeichner (CSS-Modul-Klassen wie `…__leashEnd` lösten fälschlich aus)\n- Tests: tests/unit/qa/qa-mode.unit.spec.ts (11), tests/e2e/qa-mode.e2e.spec.ts (7 je Projekt, desktop+pixel-7 grün), pnpm check, check:no-debug grün
## 2026-10-04 – Coco-Fotos von Jutta

Danke für die fünf Fotos von Coco! Sie liegen jetzt als Vorlage im Projekt (zusammengerollt, frontal liegend, stehend mit Blick über die Schulter, frontal von nah, im Profil sitzend). Coco wird in Phase 9 danach nachgezeichnet – vor allem Kopfform, Ohren, die helle Schnauze und die Haltung. Die Fotos sind recht klein; wenn du irgendwann größere Originale hast, werden Details noch genauer. Das ist aber kein Muss.

## 2026-10-04 – P8 CI grün

Phasenlauf `8518023`: CI, CI full (alle sechs Browser-Hälften, Abdeckung, visuelle Prüfung, Lighthouse) und Vorschau-Export grün. Vorschau-Artefakt `planet-claire-vorschau-p8-8518023`.

## 2026-10-04 – P8 CI: vierter Phasenlauf

Im dritten Lauf waren alle Browser-Prüfungen und der Vorschau-Export grün; nur ein Test-Aufräumschritt (alte Beleg-Dateien blieben im frischen CI-Speicher liegen) ließ eine Integrationsdatei scheitern. Behoben, nur Test-Hilfe, kein Seiten-Code. Der Phasenlauf startet noch einmal.

## 2026-10-04 – P8 CI-Fix: Test-Beleg-PDFs wurden nicht aufgeräumt

In der CI schlug eine Prüfdatei zur Vertragsbestätigung fehl (Bestätigungsmail kam nicht an). Ursache war nur in den Tests: Beim Aufräumen der Test-Bestellungen begann die Rechnungsnummer wieder bei 1, die alte Rechnungs-Datei mit dieser Nummer blieb aber liegen; die neue (anderer Inhalt) wurde zu Recht nicht überschrieben (Belege sind unveränderlich), die Mail wartete auf ihren Anhang. Lokal fiel das nicht auf, weil dort der Speicherordner schon von früheren Läufen gefüllt war. Der Test-Helfer räumt jetzt auch Beleg-PDFs (Datensatz und Datei) auf. Geprüft mit frischem Speicherordner: Datei und gesamte Int-Suite mit 3 Workern grün.

## 2026-10-04 – P8 CI: Zeitlimits für quick und quality auf 60 Minuten

Zweiter Phasenlauf: alle sechs Browser-Prüfungen und der Vorschau-Export waren grün. Die Jobs „quick“ und „quality“ liefen aber ins 45-Minuten-Limit, weil die Integrationstests mit dem vollen Beispielbestand rund 30 Minuten brauchen (auch mit drei Workern). Limit auf 60 Minuten angehoben (öffentliches Repo, keine Kosten); nichts übersprungen. Phasenlauf startet erneut.

## 2026-10-04 – P8 CI-Neustart nach Reparatur

Der erste Phasenlauf von P8 war rot: Die Integrationstests brauchten mit dem vollen Beispielbestand über 40 Minuten, und zwei E2E-Prüfungen gingen von der falschen Uhr aus. Beides ist behoben (Tests laufen jetzt parallel, die Uhr-Annahmen stimmen). Der Phasenlauf startet neu.

## 2026-10-04 – P8 CI-Fix nach rotem `[ci:full p8]` (Lauf 37167124027/37167124034)

- Ursachen: (1) `quick`/`quality`: Integrationstests mit vollem Beispielbestand > 40 min (154 Dateien nacheinander, je Datei
  ~5–8 s Start, Seed-Dateien 30–60 s, Export-Test 6,5 min) → Abbruch bei 45 min. (2) E2E `home` (Angebot „läuft“) und
  `admin/today` (letzte Bestellungen): CI seedet mit festem `SEED_NOW` 15.10.2026, die echte Uhr stand auf 04.10. →
  Angebot „kommt“, Seed-Bestellungen „neuer“ als die Test-Bestellung. (3) `e2e-full (iphone-15)` lief in die 40-min-Grenze.
- Behoben: Tests rechnen gegen die echte Uhr; Int-Tests laufen in CI mit `PC_INT_WORKERS=3` (je Worker eigene
  Datenbankkopie + Speicherordner); `e2e-full` je Projekt in zwei Playwright-Hälften.
- Getestet: `pnpm check` grün; `PC_INT_WORKERS=3 pnpm test:int` 154/154 Dateien, 1017 Tests grün (auf stark ausgelasteter
  Maschine 25 min); E2E `home` + `admin/today` (desktop, Produktions-Build mit Debug-Flag, SEED_NOW 15.10.2026) grün.

## 2026-10-04 – P8 Phasen-Abnahme (Beispielbestand) – für Jutta

### Phase 8 fertig: der Beispielbestand ist komplett

Hallo Jutta,

Phase 8 ist gebaut. Deine Seite ist jetzt voll mit Beispielen – so siehst du, wie alles mit echtem Leben aussieht,
bevor es losgeht. Alles davon ist als „Beispiel“ markiert und lässt sich mit einem Knopf wieder entfernen.

### Was du im Beispielbestand jetzt sehen kannst

- **Shop:** 30 Stücke in allen 6 Kategorien – frei, gerade reserviert, verkauft, offline und im Archiv. Die Fotos
  stammen aus deinen Instagram-Beiträgen (17 Ausschnitte), dazu 30 gezeichnete Platzhalter, wo noch ein Foto fehlt.
- **Bestellungen und Belege:** 14 Beispiel-Bestellungen in jedem Zustand (bezahlt, versendet, abgeholt, widerrufen,
  erstattet …) und 15 Belege. Jeder Beleg trägt groß „BEISPIELBELEG – kein echter Beleg“.
- **Postfach in der Verwaltung:** Widerrufe, Reklamationen, Anfragen für Auftragsarbeiten und Datenschutz-Anfragen –
  von jeder Sorte ein Beispiel in jedem Zustand. Die Kund:innen sind erfunden.
- **Tattoo-Bereich:** 10 Flash-Motive, 3 Angebote (Flash-Days), 6 Galerie-Bilder, 12 Fragen im FAQ.
- **Texte:** Entwürfe für alle Seiten in deinem Ton, z. B. „Über mich“, Pflege (Aftercare), Ablauf und FAQ. Dazu die
  neue Seite **„Über mich“** mit Jutta & Coco. Fotos, auf denen du selbst zu sehen bist, erscheinen dort erst, wenn
  du sie in der Verwaltung freigibst (Häkchen „Jutta hat dieses Foto von sich freigegeben“ beim Foto).
- **Zahlen:** Umsätze aus Tattoo und Flohmarkt für 9 Monate, damit der Umsatz-Wächter etwas zeigt.
- **Zeichnungen:** Coco ist nach deinen Highlight-Bildchen und Skizzen gezeichnet, die Stationen der Startseite sind
  aus deinen Zeichnungen übertragen. In Phase 9 werden Coco und die Linie noch einmal gründlich verfeinert.
- **Leere Seiten:** Wo noch nichts da ist (z. B. kein Flash), steht ein freundlicher Hinweis statt einer leeren Fläche.

Die Texte kannst du in Ruhe in der Vorschau-Datei lesen (die HTML-Datei, die du per Doppelklick im Browser öffnest).
Was dir nicht passt, korrigierst du später einfach in der Verwaltung.

### Beispiele behalten oder entfernen

- **Einzelne Beispiele behalten:** In der Verwaltung unter **Einstellungen → Beispieldaten** steht bei jedem Beispiel
  der Knopf **„Übernehmen“**. Danach ist es ein echter Eintrag (mit seinen Bildern) und bleibt stehen. Seitentexte und
  FAQ übernimmst du noch einfacher: Text bearbeiten und speichern – fertig.
- **Alle Beispiele entfernen:** Am selben Ort der Knopf **„Beispieldaten entfernen“**. Du tippst zur Sicherheit
  „ENTFERNEN“ ein. Mit dem Haken „Seitentexte und FAQ behalten“ bleiben die Texte als deine eigenen stehen.
- Der Knopf ist gesperrt, bis die Texte der Kanzlei eingesetzt sind – sonst wären die Rechtsseiten leer.
- Echte Stücke, Bestellungen und Rechnungsnummern fasst das Entfernen nie an. Die Beispiele erscheinen auch nie auf
  der echten Seite, nur in der Vorschau. Das machen wir gemeinsam beim Start (Phase 11).

### So funktioniert der Instagram-Import

- Bisher nutzen die Beispiele kleine Bilder aus deinem Instagram-Profil.
- Wenn du magst, lädst du bei Instagram deinen **Daten-Export** herunter (Einstellungen → „Deine Informationen
  herunterladen“, Format JSON). Die ZIP-Datei gibst du uns.
- Wir legen sie in einen Ordner und starten den Import. Er findet zu jedem Beispielbild das passende Originalfoto in
  voller Größe und tauscht es aus. Nichts davon wird hochgeladen oder veröffentlicht, alles bleibt bei dir.
- Genauso mit **Fotos von Coco**: Je mehr echte Fotos (von vorne, von der Seite, beim Schlafen …), desto treffender
  wird die gezeichnete Coco.
- Beides kannst du jederzeit nachreichen, es hält nichts auf.

### Was du dir anschauen könntest

Ein paar Beispiel-Angaben sind geschätzt (Material, Maße, Gewichte, Pflegetipps). Wenn dir beim Durchklicken etwas
auffällt, schreib es einfach auf – wir korrigieren es. Die Liste steht in den offenen Punkten (J-19 bis J-24).

## 2026-10-03 – P7 CI grün

- Phasenlauf `[ci:full p7]` (e866e29): CI, CI full (e2e desktop/iphone-15/pixel-7, quality inkl. Lighthouse) und Vorschau-Export grün; Artefakt `planet-claire-vorschau-p7-e866e29`.

## 2026-10-03 – P7 CI-Reparatur (Tempo TBT)

- Phasenlauf (00da128): nur Lighthouse TBT rot (R01 211, R02 221, R04 253 ms). Ursachen behoben: Ersatzschriften ohne Arial lösten ~60 Schriftsuchen pro Aufbau aus (jetzt 0); Tuschelinie baut in Häppchen ≤ 8 ms; Menü, Fuß, Stationen, untere Karten und Produktabschnitte als statisches HTML ohne Hydrierung (Fasern R01 526→160). Lokal TBT R01 136→69, R02 142→120, R04 126→107 ms. Dabei behoben: `react-dom/server` fehlte im Server-Bündel (hätte auf Vercel ISR und Mailversand gebrochen). Mail-Sofortversand: Wettlauf mit dem Job-Wecker behoben.

## 2026-10-03 – Fix: Sofortversand von Mails kollidierte selten mit parallelem Job-Lauf (P7.12)

- Ursache: `runEmailJobNow` rief `payload.jobs.runByID` ohne Bedingung auf. Hatte der Job-Wecker/`jobs.run` den Job
  gerade erledigt und gelöscht, scheiterte Payload mit „Cannot read properties of null (reading 'log')“
  (`commission.mail_failed`, ≈ 1× in 60); lief der andere Lauf noch, konnte die Mail doppelt rausgehen.
- Fix: Sofortversand nur neben dem Tick (geteilte Sperre `tick`, `besideTick` in `src/lib/jobs/lock.ts`) und mit atomarer
  Beanspruchung (`UPDATE payload_jobs … WHERE processing = false … RETURNING`); Job schon weg → kein Fehler. Task
  `sendEmail` sperrt zusätzlich je `email-log`-Zeile (Advisory-Lock in Transaktion), sodass jede Mail genau einmal
  versendet wird (Idempotenz-Schlüssel P4.13 unverändert). Übersprungene Jobs holt der nächste Tick nach.
- Tests: neu `tests/int/email/run-now-race.int.spec.ts` (6 Tests, davon 2 × 50 Runden parallel) – ohne Fix alle 6 rot
  mit genau dem Fehlerbild, mit Fix grün (4 Läufe hintereinander); `pnpm check` (1646 Unit) grün; Int email, jobs,
  commission, withdrawals, legal + Umsatz-Tests: 60 Dateien / 309 Tests grün.

## 2026-10-03 – P7 Phasen-Abnahme (Tattoo-Bereich) – für Jutta

Hallo Jutta,

Phase 7 ist gebaut. Hier steht kurz, was der Tattoo-Bereich jetzt kann und wie du ihn selbst pflegst.

### Was Besucher:innen jetzt sehen

- **Tattoo-Übersicht** mit „Mein Stil“, dem nächsten Flash-Day, drei freien Flash-Motiven und drei Bildern aus der
  Galerie. Von dort geht es zu allen Unterseiten.
- **Flash** (fertig gezeichnete Motive): ein Raster mit Nummer (z. B. F-012), Größe und Preis. Man sieht, ob ein Motiv
  nur einmal gestochen wird oder öfter. Ein Filter zeigt „nur noch frei“.
- **Angebote** (Flash-Days und Aktionen): Datum, Uhrzeit und nur der Bezirk – nie deine Straße. Vorbei ist vorbei: Ein
  abgelaufenes Angebot verschwindet von selbst, auch von der Startseite.
- **Galerie** „frisch“ und „verheilt“, mit großer Ansicht. Es gibt dort keine Preise.
- **Preise, Ablauf, Pflege (Aftercare) und FAQ** als eigene Seiten. Die Pflege-Seite lässt sich gut ausdrucken.
- **Auftragsarbeiten**: eine Seite mit Beispielen und einem Anfrage-Formular. Wer anfragt, kann bis zu 5 Bilder
  anhängen. Die Bilder werden dabei verkleinert und ohne versteckte Ortsdaten gespeichert.
- **Wichtig:** Ein Tattoo kann man nirgends online kaufen oder bezahlen. Jeder Knopf führt zu einer Mail oder
  Instagram-Nachricht an dich, schon mit passendem Betreff (z. B. „Anfrage Flash F-012“).

### So pflegst du Flash, Angebote und Galerie

Alles findest du in der Verwaltung unter **„Tattoo“**. Oben gibt es vier Reiter: Flash · Angebote · Galerie · Texte.

- **Flash:** „Neuer Flash“ → Foto (bis zu 5), kurze Bildbeschreibung, Titel, Größe, Preis. Die nächste Nummer
  schlägt das System vor. Den Status (frei, reserviert, vergeben) änderst du mit zwei Tippern. Ein Motiv, das du
  öfter stichst, pausierst du über **„Offline nehmen“**.
- **Angebote:** „Neues Angebot“ → Datum, wenn du willst mit Uhrzeit, Ort (Bezirk), Preis-Info und die passenden
  Flash-Motive. Kommende, laufende und abgelaufene Angebote siehst du getrennt; abgelaufene sind grau.
- **Galerie:** Foto hochladen, „frisch“ oder „verheilt“ wählen, Bildunterschrift schreiben.
- **Texte:** Preise, Stil, Ablauf, Pflege und FAQ. Englisch macht der Knopf **„Übersetzen“**; du kannst danach
  noch etwas ändern.
- **Anfragen** zu Auftragsarbeiten landen unter „Anfragen“. Du bekommst eine Mail. Die Kundin bekommt eine
  Eingangsbestätigung. Im Detail gibt es eine Vorlage für dein Angebot zum Kopieren. Eine Anfrage wird
  **6 Monate nach Eingang** automatisch gelöscht, samt Bildern.

### Fotos von Kund:innen – nur mit Einwilligung

- Ein Foto von einem Tattoo auf der Haut einer Person darf nur online, wenn sie **ja gesagt hat**. Dafür hakst du
  beim Foto „Einwilligung zur Veröffentlichung auf der Website liegt vor“ an und legst den Nachweis ab (z. B. ein Bildschirmfoto der Nachricht).
- Ohne dieses Häkchen geht „Online“ nicht. Das System sperrt es.
- Zieht jemand die Einwilligung zurück: Knopf **„Einwilligung widerrufen“**. Das Foto ist sofort offline und auch
  über einen alten Link nicht mehr erreichbar. Auf Wunsch schickt das System der Person ihre Fotos an eine Adresse,
  die du in dem Fenster eintippst.
- Deine eigenen Bilder (Zeichnungen, Flash) brauchen das nicht.

### Was noch Platzhalter ist

Die Beispiel-Motive, Angebote und Galerie-Bilder kommen in Phase 8. Texte wie Preise und Pflege-Hinweise sind
Vorschläge in deinem Ton. Bitte lies sie später einmal durch und ändere, was nicht passt.
## 2026-10-03 – P8.21

- Vorschau-Export mit vollem Bestand: Status-Anker um O03 ergänzt, S08 als 404-Variante „schon ein Zuhause“ (im Browser gerendert, `clientRendered.ts` – das Server-HTML ist nur die Next-Fehlerhülle), eingebettete `data:`-Bilder (EPC-QR) bleiben erhalten, Zeitstempel-Angleichung ohne GoBD-Trigger-Abbruch (`session_replication_role` nur in der Export-DB). Ergebnis: 164 Routen, 0 nicht gebaut (R19 und alle Tattoo-Routen `ok`), 0 Warnungen, 8,19 MB.
- Neue Umgebungsvariablen nur für parallele Exporte: `PREVIEW_EXPORT_DB_NAME`, `PREVIEW_EXPORT_PORT` (ARCHITEKTUR §5.2, `.env.example`).
- Seed-Lücke behoben: O09 (`ready_for_pickup`) hat jetzt den Abholtext `pickup.messageText` (sonst ließ sich M07 nicht erneut senden).
- Tests: `pnpm preview:export && pnpm test:preview-export` 32/32 grün (neu: „P8.21 Anker in der Datei …“, „P8.21 keine anderen Personendaten …“, Bericht: R08–R19 gebaut); `tests/e2e/seed-anchors.e2e.spec.ts` (9 × desktop/pixel-7); `tests/int/seed/anchors.int.spec.ts` (10).
- Kriterium mit Vermerk „mit dem echten Anker prüft P8.21“ → Test:
  - P1.19/P5.6 Bruch-Erstattung S09/O08 (P13 ja, P11 nein) → anchors.int „P8.21 S09/O08 …“
  - P3.6 Archiv S19/S08 · P3.13 Sitemap → seed-anchors „P8.21 S19 Archiv und Sitemap …“
  - P3.7 AK-3-04 S08 → seed-anchors „P8.21 S08 /de/shop/908-… → 404-Variante …“ und preview-export „P8.21 Anker in der Datei …“
  - P3.8 Produktseiten S14, S19, S29, S30 → seed-anchors „P8.21 Produktseiten …“
  - P4.13 Kasse S01 + S11 (8,90 €, 109,00 €, 117,90 €, Abweichung) → preview-export „P8.21 Anker in der Datei …“ (E2E reservieren nie Seed-Stücke, ARCHITEKTUR §7.2)
  - P4.23 O03 + AK-SEED-20 (O01/O10/O13, Danke O13/O14) → seed-anchors „P8.21 O03 Bestellstatus …“, seed-status.e2e „AK-SEED-20 …“
  - P5.8 Filter „reserviert“ S14/O13 → anchors.int „P8.21 S14/O13 Meine Stücke …“
  - P5.10 Zu packen O14/O12 → anchors.int „P8.21 O14/O12 Zu packen …“, seed-anchors „P8.21 O14/O12 Zu packen, O13 …, O09 …“
  - P5.11/P5.24 Exporte ohne Seed-Sendung/BSP-Beleg → revenue.int „AK-SEED-21 …“
  - P5.17 Abholung O09 + M07 erneut → anchors.int „P8.21 O09 Abholung …“
  - P5.18 Vorkasse O13 „Zahlung erhalten“ → anchors.int „P8.21 O13 Vorkasse offen …“
  - P5.19 Widerrufe W3–W7 → seed-anchors „P8.21 W3–W7 Widerrufe …“
  - P5.27 Vorlagen O10/O07 → anchors.int „P8.21 O10/O07 Vorlagen …“
  - P5.28 Heute (§17) → withdrawals-inquiries.int „zeigt genau die Anker aus SEED_TODAY_ANCHORS“, seed-anchors „P8.21 Heute …“
  - P6.4 Bestellungen je Fassung → anchors.int „P8.21 Bestellungen je Rechtstext-Fassung …“
  - P6.8–P6.11 Mails M08/M09/M12/M13 → anchors.int „P8.21 W5/O05/RK1 Mails …“
  - P6.13 Auskunft-Export → anchors.int „P8.21 DS3 Auskunft-Export …“
  - P7.2 Flash F-901/F-903/F-905 → seed-anchors „P8.21 F-901/F-903/F-905 …“, seed-tattoo „AK-9-02 Seed …“
  - P7.3 Angebote TO1–TO3 → anchors.int „P8.21 TO1–TO3 …“, seed-tattoo „AK-9-03 Seed …“
  - P7.5 Galerie G1–G6 → tattoo.int „AK-SEED-11 …“, seed-tattoo „AK-9-04 Seed …“, preview-export (G1/G2 mit Etikett)
  - P7.10 Seite commissions → seed-anchors „P8.21 commissions Auftragsarbeiten …“
  - P7.11 Anfragen A1–A7 Löschfrist → withdrawals-inquiries.int „createdAt, lastActivityAt, deleteAfter = createdAt + 6 Monate …“

## 2026-10-03 – P8.20

- Geprüft: `assertProductionEnv` bricht mit `SEED_PREVIEW_MODE=true` in Produktion ab, `seedPreviewModeActive()` dort immer `false`.
- Neu: Feld `media.ownerApproved` (Migration `p8_media_owner_approved`, Hinweis „Nur ankreuzen, wenn Jutta dieses Foto freigegeben hat“, nur bei `showsPerson = jutta` sichtbar); `isMediaPubliclyVisible`, Lese-Zugriff und Bildroute sperren Fotos von Jutta ohne Häkchen (auch im Vorschau-Modus); „Über mich“ nutzt dieselbe Regel. Startklar-Punkt vorgemerkt (`STARTKLAR_PLANNED`, `countUnapprovedOwnerPhotos`).
- Tests: `tests/unit/env/seed-preview.unit.spec.ts` (8, R-181); `tests/int/media/owner-approved.int.spec.ts` (4, DM-MEDIA-06); AK-1-03/AK-9-04 grün (seed-tattoo E2E, tattoo.int).

## 2026-10-03 – P8.19a

- Verwaltung „Texte“ → „Seiten und FAQ“ (`PagesArea`): Liste aller `PAGE_KEYS` (Beispieltext/eigener Text), Handy-Formular je Seite mit Titel, SEO-Feldern und allen Textblöcken DE/EN (`PAGE_TEXT_BLOCKS`: Hero, Stationen, Bild+Text, Formular-Texte …, Feldgrenzen wie P8.7), „Übersetzen“, FAQ aller Kategorien sortierbar (Hoch/Runter).
- Endpunkte `POST /api/pages/texts`, `POST /api/faqs/texts-save`; Speichern setzt `seed = false` und revalidiert (≤ 60 s). Leeres EN-Titelfeld = deutscher Titel.
- Keine „kommt in P…“-Texte mehr außer Startklar „kommt in P10“ (Einstellungen → Rechtstexte verlinkt jetzt auf „Texte“).
- Tests: `tests/int/admin/pages-adopt.int.spec.ts` (5, AK-SEED-17 für pages und faqs, Feldgrenzen, 403); `tests/e2e/admin/texts-pages.e2e.spec.ts` (4 × desktop/pixel-7: alle 13 Seiten 390 px + axe, Übersetzen + öffentlich ≤ 60 s, FAQ-Reihenfolge per Tastatur öffentlich gleich, Suche „kommt in P“ über `adminViews.ts`); P7-Test `tattoo-texts.e2e` an den Beispielbestand angepasst.

## 2026-10-03 – P8.19

- Einstellungen → Beispieldaten (`SeedArea`): Anzahl je Bereich, „Beispieldaten entfernen“ mit Dialog (Mengen, „Seitentexte und FAQ behalten“ vorausgewählt, Eintippen von „ENTFERNEN“), Sperre mit Platzhalter-Rechtstexten (Text „Bitte zuerst die Texte der Kanzlei einsetzen …“ + Typen), „Übernehmen“ je Stück/Flash/Galerie/Bild.
- Endpunkte `GET /api/admin/seed/summary`, `POST /api/admin/seed/remove` (`src/endpoints/seed.ts`, Logik `removeSeedData`, danach `revalidateAll`), `POST /api/{products,flash,tattoo-gallery,media}/:id/adopt` (`src/lib/seed/adopt.ts`, Audit `product_adopted`, Medien mit).
- Tests: `tests/int/seed/admin-remove.int.spec.ts` (6: 403, Zählung, Sperre/Freigabe mit Fixture-Rechtstexten, falsches Wort 400, Übernahme, AK-11-03/R-180 zweimal); `tests/e2e/admin-seed.e2e.spec.ts` (390 px, axe; Entfernen-Aufruf abgefangen, siehe OFFENE-PUNKTE).

## 2026-10-03 – P8.18

- Neue Route R19 /de/ueber-mich · /en/about (src/app/(frontend)/[locale]/about, Registry-Status live, ISR mit Tag pages): H1 „Jutta & Coco“, Blöcke aus pages:about in Reihenfolge (Text, Bild und Text, Coco mit Coco-Zeichnung, Bildergalerie, „Was ich mache“ mit Kategorien + Shop/Tattoo/Auftragsarbeiten, Kontaktwege), Instagram-Link rel=noopener noreferrer; Leerzustand ohne Seite (DM-PAGE-01). SEO-Beschreibung DE/EN, Sitemap, canonical/hreflang über routeMetadata, OG-Bild wie alle Seiten.\n- Tuschelinie Preset about: drei Stationen jutta → coco → werkstatt (Schlaufen right/left/right, Posen sitzen/kopfschief/schnueffeln); Bilder von Jutta ausgeblendet bis zur Freigabe (P8.20).\n- Tests: neu tests/e2e/about.e2e.spec.ts (desktop + pixel-7 16/16: Inhalt DE/EN, canonical + 3 hreflang, Sitemap, keine Jutta-Bilder, Instagram rel, Linie überdeckt keinen Text, reducedMotion → Stufe C vollständig und 0 Animationen, axe); neu tests/unit/leash/about.unit.spec.ts (Preset-Daten und Geometrie 390/1440); Registry-Test auf R19 live angepasst.

## 2026-10-03 – P8.17

- Startseite liest Stationen aus pages.home (bereits seit P2/P3/P7); ergänzt: Station „Jutta & Coco“ mit Links Mehr über uns (R19), Auftragsarbeiten (R10) und Instagram (rel=noopener noreferrer, i18n home.stationCommissions/stationInstagram).\n- Geprüft gegen SEED-SPEC §5.1/§12.2: Keramik S01/S04/S05/S07, Textil 4 aus S11/S12/S14/S15/S17, Zeichnungen S20/S22/S23, Schmuck S26–S29; Tattoo-Station mit TO2 „läuft gerade“ als Datums-Badge, TO3 nicht, ≤ 3 freie Flash; Preisfußnote einmal; JSON-LD Organization ohne Adresse.\n- Visuelle Referenz r01-start (desktop, mobile) mit vollem Beispielbestand erneuert (lokal, Linux).\n- Tests: tests/e2e/home.e2e.spec.ts +2 (DE/EN), home- und Stationen-E2E desktop + pixel-7 25/25 grün inkl. LCP < 2,5 s / CLS < 0,1 (mobil); Lighthouse lokal R01 mobil (3 Läufe, Median): LCP 2,18 s, CLS 0,009, TBT 148 ms – innerhalb der Gates; Lighthouse-CI (EK-01) bestätigt im CI-Job.

## 2026-10-03 – P8.16

- Leerzustände KO-17 an allen Listen geprüft/ergänzt: neuer FAQ-Block (src/components/content/FaqList.tsx, Leerzustand „Noch keine Fragen“) auf Kontakt (PageBlocks faqList) und Auftragsarbeiten; R18 Leerzustand mit Link zum Kontakt; R27 Konformitätserklärungen als Leerzustand mit Satz aus KONZEPT §3.14 und Link zur Keramik.\n- 404: Rich Text der Seite not_found unter der festen H1 (Test angepasst); Variante „schon ein Zuhause“ für S08/908 mit Shop/Archiv, noindex; 500 unverändert.\n- seed:remove repariert: echte Kassen/Reservierungen mit Beispiel-Stücken blockierten das Löschen der Stücke (NOT NULL + SET NULL) – werden jetzt mitgelöscht; echte Bestellungen mit Beispiel-Stücken stoppen den Lauf.\n- CMS-Rich-Text: externe Links mit rel="noopener noreferrer" (R-139, z. B. Safer-Tattoo-Link R17).\n- Tests: neu tests/e2e/empty-states.e2e.spec.ts (desktop + pixel-7 je 7/7: alle Registry-Routen DE/EN 200/404 nie 500 nach seed:remove --drop-texts, Leerzustände mit Weiter-Link und Pose, Vertrag widerrufen, axe auf Leerzuständen/404/500, reduzierte Bewegung statisch); tests/visual/empty-states.visual.spec.ts (404-Variante, Shop leer); Int tests/int/seed/lifecycle.int.spec.ts +1 (8/8); error-pages, legal, tattoo, commission E2E grün.

## 2026-10-03 – P8.15

- Texte DE/EN gegengelesen (i18n, site-texts, Seed-Seiten, FAQ, Tattoo, Mails): Ton passt (du-Form, kurz, Kulleraugen), keine Treffer zu V-18 (Garantie nur als EU-Fachbegriff „legal guarantee“), V-26 (Barrierefreiheit/Zertifikate), V-28 (Liedtext/Audio); Rechtstexte und legalSnippets unverändert (R-002). RECHT §7 Teil A: R-190, V-18/V-28/V-29 und „FAQ-/Tattoo-/Über-mich-Entwürfe gegen §5 geprüft“ abgehakt (03.10.2026).\n- site-texts: Standardwerte „Seite nicht gefunden“ an die feste 404-Überschrift angeglichen („Coco hat sich losgerissen“ / “Coco slipped her leash”).\n- Prüfliste für Jutta (SE-06, SE-07) in OFFENE-PUNKTE.\n- Tests: neu tests/unit/i18n/site-texts-defaults.unit.spec.ts (4: Gruppen §7.2, jedes Textfeld DE+EN, Navigationslisten, Betreff je Kund:innen-Mail DE+EN); i18n-Parität und Verbotsmuster unit grün; E2E tests/e2e/legal/forbidden.e2e.spec.ts (+ product-info, gpsr) desktop 121/121 grün.

## 2026-10-03 – Erstlade-Budget R10/R26 (check:bundle wieder grün)

- Ursache 1: Formulare R10 (Auftragsarbeiten) und R26 (Widerruf) waren komplette Client-Komponenten – Felder, Buttons, Fehlerkästen, alle Schritte und die ganze Icon-Tabelle (`ICON_SHAPES` über `Icon` in `Field`/`Button`) lagen im Erstlade-Chunk (6,7 bzw. 5,5 KB gz). Jetzt: Erstansicht rendert der Server (`CommissionView`, `WithdrawalView` ohne `'use client'`), im Browser bleiben nur Zustand, Server Action und `<form>` (`CommissionForm`, `WithdrawalFlow`, je ≈ 2,1 KB gz); Folgezustände (Fehler, Auswahl, Bestätigung, Ergebnis) lädt `React.lazy` nach `load` vor, Bildauswahl (`CommissionImages`) und Verkleinern/Hochladen (`imageUpload`) erst nach `load` bzw. bei der ersten Auswahl. Icons als Einzelkonstanten (`ICON_WARN` …) + `Glyph`; `Icon` (Name → Tabelle) nur noch serverseitig. Gemeinsamer Hinweis-/Fehlerkasten `FormAlert`.
- Ursache 2: Menü, Korbzahl und Animationen-Schalter (≈ 4 KB gz) luden je nach Reihenfolge von Hydrierung und `load` mal vor, mal nach `load` – daher die Schwankung 150,4–155,4 KB. Alle Verhaltensmodule laden jetzt im Modus `app` erst nach `load` (wie schon die Produktseiten-Module, P3.10/P4.25; ohne JS bzw. davor: Menü-Link auf die Fußnavigation).
- Ergebnis `pnpm check:bundle`: R10 und R26 je 146,8 KB (Budget 150), alle übrigen Seiten stabil 144,6–144,9 KB; Budget unverändert.
- Tests: unit (Verhalten nach `load`, Icons) grün; E2E desktop + pixel-7 Widerruf (inkl. ohne JS) und Auftragsarbeiten 32/32, Menü/Shell/Tastatur/Korb/Bewegung grün; visuelle Referenzen R26 (Schritt 1, 2, Bestätigung) unverändert.

## 2026-10-03 – P6 CI grün

- Phasenlauf `[ci:full p6]` (7823d67): CI, CI full (e2e desktop/iphone-15/pixel-7, quality inkl. Lighthouse über HTTP/2) und Vorschau-Export grün; Artefakt `planet-claire-vorschau-p6-7823d67`.

## 2026-10-03 – P6 CI-Reparatur (Tempo R04)

- Phasenlauf (26d07e2): nur Lighthouse R04 (LCP) rot. Produktseite trägt die 404-Varianten nicht mehr in den Inline-Daten (ein JS-Chunk weniger); Lighthouse misst jetzt wie die Produktion über HTTP/2 (lokaler TLS-Vorschaltserver `scripts/perf/serve-h2.mjs`, Grenzen unverändert) – R04 LCP lokal Median ≈ 1,55 s statt zweigipflig bis 2,6 s.

## 2026-10-03 – P6 Phasen-Abnahme (Recht, Widerruf, Datenschutz) – für Jutta

Hallo Jutta,

Phase 6 ist gebaut. Hier ist kurz und einfach, was jetzt da ist und was du später mit der Kanzlei klären musst.

### Was rechtlich jetzt da ist

- **Alle Rechtsseiten** auf Deutsch und Englisch: Impressum, Datenschutzerklärung, AGB, Widerrufsbelehrung mit
  Muster-Formular, Versand und Zahlung sowie die Kontaktseite. Die Texte sind noch **Platzhalter**. Oben auf jeder
  Seite steht ein deutlicher Hinweis „vorläufiger Text“, bis die Kanzlei die echten Texte liefert.
- **Rechtstexte in der Verwaltung** (Bereich „Texte → Rechtstexte“): Du kannst später den Text der Kanzlei einfach
  hineinkopieren. Jede Änderung wird eine neue Fassung mit Datum. Alte Fassungen bleiben gespeichert, damit man immer
  zeigen kann, was eine Kundin beim Kauf gesehen hat. Dazu gibt es PDFs zum Herunterladen.
- **Kleine Rechtsbausteine** (z. B. der Hinweis zu den Rücksendekosten oder der Kleinunternehmer-Satz am Preis) liegen
  ebenfalls versioniert in der Verwaltung. Es sind vorerst Arbeitsfassungen.
- **Datenschutz-Anfragen** (Auskunft, Löschen, Berichtigen …): eigene Liste unter „Export und Datenschutz“. Das System
  zeigt die Monatsfrist, erinnert dich rechtzeitig und hilft beim Suchen aller Daten einer Person und beim Export.
- **Automatisches Löschen**: Alte Daten (z. B. abgebrochene Bestellungen, alte Mail-Protokolle, Anfragen nach
  6 Monaten) werden nach festen Fristen gelöscht oder unkenntlich gemacht. In den Einstellungen siehst du vorher in der
  „Löschvorschau“, was in den nächsten Tagen gelöscht würde. Rechnungen bleiben so lange, wie das Gesetz es verlangt.
- **Reklamationen** werden mit Fotos zur Bestellung gespeichert, mit Antwort-Vorlage (Reparatur oder Ersatz).
- **Jährliche Erinnerung**, die Rechtstexte prüfen zu lassen.
- **Verzeichnis der Verarbeitungen** und eine Liste aller Dienste (z. B. Stripe, DHL) für die Kanzlei.

### So funktioniert der Widerruf

1. Auf **jeder Seite** unten steht der Link **„Vertrag widerrufen“**.
2. **Schritt 1:** Die Kundin gibt Name, E-Mail und Bestellnummer ein. Sie kann (muss aber nicht) einzelne Stücke
   auswählen und einen Grund nennen.
3. **Schritt 2:** Sie sieht alles noch einmal und klickt **„Widerruf bestätigen“**.
4. Sie bekommt **sofort** eine Bestätigung auf der Seite und per Mail (mit Datum und Uhrzeit). Du bekommst auch eine
   Mail.
5. In der Verwaltung unter **„Widerrufe“** siehst du alles: Ware ist zurück → Erstattung auslösen (Stripe macht das
   automatisch, bei Vorkasse überweist du und klickst „überwiesen“). Das System erinnert dich an die 14-Tage-Frist und
   erstellt die Gutschrift.

### Was du vor dem Go-live mit der Kanzlei klären musst

Die Kanzlei-Mappe (`docs/recht/KANZLEI-BRIEFING.md`, jetzt Version 1.4, mit Bildschirmfotos des Widerrufs) ist
fertig. Die wichtigsten Punkte:

- **Echte Rechtstexte** liefern lassen (Impressum, Datenschutz, AGB, Widerrufsbelehrung, Versand) – sie ersetzen die
  Platzhalter.
- **Widerruf:** Passt der Ablauf in zwei Schritten (K-11)? Wer trägt bei einem Teil-Widerruf die Versandkosten
  (K-09)? Vorläufig gilt: Die Rücksendung zahlt die Kundin; behält sie einen Teil, bekommt sie den Warenwert und den Unterschied
  bei den Versandkosten zurück.
- **Rechnungen 8 oder 10 Jahre** aufbewahren (K-33, auch mit der Steuerberatung)? Vorläufig: 10 Jahre.
- **Wortlaut der Bausteine** (Kleinunternehmer-Hinweis, DHL-Einwilligung, Transportschaden, Rücksendekosten):
  bisher nur Arbeitsfassungen (K-15, K-21, K-23, K-31).
- **Deine Anschrift** im Impressum und in der Belehrung (K-39) und ob eine Telefonnummer nötig ist (K-28).
- **Ohne Cookie-Banner** zulässig (K-30, K-38)?

Du musst jetzt nichts tun. Diese Punkte besprechen wir gemeinsam beim Go-live (P11).
## 2026-10-03 – P8.14

- content/art/sources.json (Schema DESIGN §12.4, Prozent-Ausschnitte; zusätzlich optional dense) und pnpm art:vectorize (scripts/art/vectorize.ts): sharp (Ausschnitt → luma/min → normalise → Lanczos3 → blur 0.5 → Otsu/fest → Median 3) → potrace 2.1.8 (nur devDependency, dynamisch importiert) → SVGO → fill currentColor, evenodd. Gemappte Export-Originale (P8.10) haben Vorrang.
- Stationen: keramik (Hund aus der Schale, nur schwarze Linien), textil (Wesen der pinken Cap, Kanal min), zeichnungen (zwei Figuren, oberer Ausschnitt, Kritzelfell als Fläche), tattoo (Kelch mit Schlange); schmuck als Linienzeichnung im Platzhalter-Stil (content/art/stations/schmuck.ts, Fuchs-Anhänger); planet-claire aus der Planet-Marke; hallo und jutta-und-coco aus Coco sitzen (Sprite) bzw. + Planet. Ausgabe src/art/stations/*.svg + stations.generated.ts, eingebunden in StationArt (KO-21), aria-hidden.
- Größen: 0,6–6,3 KB je Station (≤ 8 KB); R01: SVG gesamt 54,1 KB (≤ 60 KB), Pfaddaten im DOM unter 60 KB; potrace in keinem Client-Chunk (neue Prüfung in pnpm check:bundle). Deterministisch (zwei Läufe byte-gleich). Hinweis: check:bundle meldet R10/R26 JS 150,4–155,4 KB > 150 KB – unabhängig von P8.14 (kein Client-Code geändert).
- Tests: tests/unit/art/stations.unit.spec.ts (6: Größe, Quellen-Whitelist AR-01, currentColor E-73, generiertes Modul = Dateien, potrace nur devDependency, Determinismus mit Mini-Quelle), tests/unit/perf/check-bundle.unit.spec.ts (+1), E2E tests/e2e/home/station-art.e2e.spec.ts (desktop + pixel-7: 7 Stationszeichnungen, aria-hidden, Tusche, ohne Konsolenfehler) sowie home/leash-E2E grün gegen Produktions-Build.

## 2026-10-03 – P8.13

- Flash-Platzhalter flash-902 … flash-910 (ohne Wash, Grund Papier-2, klare Kontur): Hasen-Trio, Fuchs mit Kulleraugen, Schmetterling mit Tupfen, Schnecke mit Planetenhaus, Coco sitzt (mit rotem Geschirr), winziger Planet, Reh mit Tupfen, Flammenwesen, Herz mit Beinen – passend zu den Titeln SEED-SPEC §12.1.
- Tattoo-Platzhalter tattoo-01 … tattoo-04 (Wash --wash-clay): Knöchel/Fuß mit Hasen-Trio (F902, frisch, Linie 3), Handgelenk mit winzigem Planeten (F907, verheilt, Linie 1,8), Oberarm mit Coco (F906, frisch, Linie 3), Schienbein mit Herz mit Beinen (F910, verheilt, Linie 2); Körperumriss in 2,4.
- pnpm seed:example --refresh-media: Flash-Raster (R12) und Galerie (R15) zeigen die Zeichnungen statt fallbackArt.
- Prüf-Linse (gleicher Lauf wie P8.12, Kontaktbogen mit allen 30): alle Flash-/Tattoo-Motive „lesbar: ja“, Coco (flash-906, tattoo-03) „ja“.
- Tests: tests/unit/art/placeholders.unit.spec.ts deckt Flash (0 Wash-Flächen) und Tattoo (eigene Linienstärke nur im Tattoo) ab; tests/int/seed/media.int.spec.ts „kein Platzhalter stammt mehr aus fallbackArt“ (alle 30 aus src/art/placeholders, Pixelvergleich) – 7/7 grün.

## 2026-10-03 – P8.12

- Werkzeug scripts/art/lib/handline.ts (gesäter Wackel quer zur Richtung, offene Enden/Überstände bei geschlossenen Formen, Absetzer bei langen Strichen, Doppelkonturen, Schatten aus 5–7 Schraffurstrichen unter 40°, eine um 3–4 Einheiten versetzte Wash-Fläche, gefüllt nur Pupillen/Nase/Tupfen, Glanzpunkte in Papier) und Generator pnpm art:placeholders (scripts/art/placeholders.ts, optional --sheet/--png).
- Motiv-Skizzen content/art/placeholders/{typ}-{n}.ts aus gezeichneten Bezier-Kontrollpunkten; wiederkehrende Figuren (Hasen, Fuchs, Reh, Coco, Planet, Mond, Stern, Shirt, Bügel, Blatt) in _parts.ts, Strich nach Juttas Skizzen (content/art/jutta-skizzen). Ausgabe src/art/placeholders/*.svg (alle ≤ 6 KB), Wash laut content/seed/data/media.json; pnpm seed:example --refresh-media ersetzt die fallbackArt-Bilder.
- Prüf-Linse R1 (frisch, Headless, KUNST-QA §6.7/§6.1 Nr. 5), 3 Durchgänge: Kalibrierung P2-Ersatzzeichnung Note 1 (gültig); Lauf 3: alle 30 Motive „lesbar/erkennbar: ja“, alle Coco-Fragen (shirt-02, cap-01, zeichnung-01, anhaenger-01, flash-906, tattoo-03) „ja“; Stilnote AR-05 = 3 → Feinschliff P9.13 (OFFENE-PUNKTE).
- Tests: tests/unit/art/placeholders.unit.spec.ts (7 Tests: Bestand 30, viewBox/Strich/kein Text/keine Primitive/≤ 6 KB/±3°, genau eine Wash-Farbe bzw. Flash ohne Wash, Coco mit rotem Geschirr, Motivhöhe 55–70 % nach Rasterung, Skizzen ohne Primitive, Determinismus) grün; tests/unit/seed/data.unit.spec.ts angepasst.

## 2026-10-03 – P8.11

- `pnpm art:coco-refs` (scripts/art/coco-refs.ts): liest Fotos aus content/seed/coco/ (JPG/PNG/HEIC, .mp4 nur gelistet) und Juttas Skizzen aus content/art/jutta-skizzen/, normalisiert mit sharp (Orientierung, sRGB, ohne jede Metadaten inkl. GPS, ≤ 1600 px) nach .data/art-refs/coco/ und schreibt content/art/coco-refs.json (Quelle, sha256, Maße, Pose aus coco-<pose>-<n>, Herkunft); die 9 Highlight-Referenzen stehen immer drin; nicht dekodierbares HEIC wird übersprungen und gemeldet.\n- Ohne eigene Fotos: Hinweis „keine eigenen Fotos“ (OFFENE-PUNKTE: wartet auf Jutta).\n- Tests: tests/unit/art/coco-refs.unit.spec.ts (7: GPS-Fixture ohne EXIF/GPS nach der Normalisierung, Posen-Erkennung, HEIC-Rückfall, Idempotenz byte-gleich, committete Datei aktuell, kein Hash in public/.next/static/Vorschau/Seed-Medien).

## 2026-10-03 – P8.10

- `pnpm seed:import-instagram` (scripts/seed/import-instagram.ts): findet ZIPs (entpackt nach .data/instagram-export/), Monatsordner, JSON-Ordner, ältere Uploads und Mischformen; Zuordnung nur über Dateinamen, Art über JSON-uri, Datum aus JSON oder Monatsordner; Kandidaten ±1 Tag, dHash 64 Bit ≤ 10 und Seitenverhältnis ±1 %; Map content/seed/instagram-export-map.json (leer committet) mit override-Vorrang. Ohne Export: Meldung, Exit 0, Map unverändert.\n- Medien-Schritt (src/lib/seed/exportMap.ts, example.ts): gemappte Kürzel nehmen das Original (neu kodiert, ohne Metadaten) mit denselben Prozent-Ausschnitten und seedKeys, source = instagram_export (beim Anlegen bzw. --refresh-media).\n- Tests: tests/unit/seed/import-instagram.unit.spec.ts (9, fiktive Fixture tests/fixtures/instagram-export/), tests/int/seed/import-instagram.int.spec.ts (4: Refresh ersetzt Datei, seedKey/Anzahl gleich, AK-SEED-19 mit Quellpixeln, kein ungeschnittenes Export-Bild in media). Echter Export fehlt weiter (OFFENE-PUNKTE: wartet auf Jutta).

## 2026-10-03 – P8.9

- Lebenszyklus geprüft und ergänzt: seed:remove erfasst vor dem ersten Löschschritt alle Verweise echter (und gleich übernommener) Dokumente und Globals auf Seed-Dokumente (src/lib/seed/references.ts) und listet sie im Bericht; entfernt werden sie beim Löschen über die Fremdschlüssel (Übersetzungen in Blöcken bleiben unangetastet). Guard, Reihenfolge §1.7, settings.seed und Audit seed_imported/seed_removed waren vorhanden.\n- Tests: tests/int/seed/lifecycle.int.spec.ts (7: Mengen = SEED_EXPECTED_COUNTS, Kennzeichnung, zweiter Lauf ohne Änderung, Vorschau per CLI ohne Schreiben, Entfernen mit/ohne Texte, Reset, Gegenprobe Stück Nr. 17 + Umsatz 2026-09/tattoo + echte Aktion mit Seed-Flash, Sequenzen PC/WR/AA/DS und RE/GS unverändert, seed:base mit APP_ENV=production), tests/unit/seed/guard.unit.spec.ts (16, jede Sperrbedingung einzeln); time.unit grün.

## 2026-10-02 – P8.8

- `content/seed/data/logs.json` mit den Ableitungsregeln (Ereignis → Vorlagen aus `EMAIL_TEMPLATES`), den Einwilligungen und den 8 Audit-Einträgen (SEED-SPEC §16); Import `src/lib/seed/logs.ts` (Schritt 8): 78 Mail-Einträge (Anzahl je Bezug wie §16.1, Betreff aus den Mail-Texten mit Nummer, Admin-Mails an die Verwaltung auf Deutsch, `messageId` §2.5), 14 Einwilligungen mit gerendertem Baustein (`getSnippet`, kein erfundener Rechtstext), 8 Audit-Einträge; `withdrawals.confirmationEmail` zeigt auf die Eingangsbestätigung.\n- `email-log`: im Seed-Kontext bleibt `status = sent` (sonst `suppressed` für example.*).\n- Tests: `tests/int/seed/logs.int.spec.ts` (7, inkl. AK-SEED-05 mit Spionen) grün.

## 2026-10-02 – P8.7

- `content/seed/data/pages.json` für alle 13 `PAGE_KEYS` (SEED-SPEC §13, Juttas Ton, du-Form; keine Rechtstexte) und `faqs.json` (12 FAQ, §14); Seiten-Import kann jetzt alle Blocktypen (Bilder über seedKey, Schritte/Phasen mit gleichen Zeilen-IDs in DE/EN, `seo.metaTitle` der Startseite), FAQ-Import (Inhalt-Gruppe, übernommene FAQ werden übersprungen).\n- Datums-Token `{{date:<expr>}}` + `seedRichText` in `src/lib/seed/lexical.ts`.\n- Tests: `tests/unit/seed/lexical.unit.spec.ts` (6), `tests/int/seed/pages-faqs.int.spec.ts` (6: Mengen, AK-SEED-17, AK-SEED-18, Feldgrenzen, V-28, EN-Texte) grün; E2E `tests/e2e/seed-pages.e2e.spec.ts` (DE/EN der gebauten Routen).

## 2026-10-02 – P8.6

- Tattoo-Bestand `content/seed/data/tattoo.json` (SEED-SPEC §12): Flash F901–F910 (F903/F905 vergeben, F901 mit Instagram-Bild), Angebote TO1–TO3, Galerie G1–G6 (G1/G2 Kundenfotos ohne Einwilligung, nur im Vorschau-Modus); Import `src/lib/seed/tattoo.ts` (Inhalt-Gruppe, Nummernkollision auch für `flash.number`).\n- Hook `tattoo-gallery`: Anlegen ohne Einwilligung im Seed-Kontext erlaubt (SEED-SPEC §1.6), sichtbar weiter nur mit wirksamem Vorschau-Modus. Allowlist-Eintrag „Godzilla“ für `tattoo.json` (E-18).\n- E2E `tests/e2e/tattoo/offers.e2e.spec.ts`: Testangebot beginnt vor TO2, damit es im Teaser steht.\n- Tests: `tests/int/seed/tattoo.int.spec.ts` (8, mit vorgestellter Uhr, Einwilligungsregel, Betreff) grün; E2E `tests/e2e/tattoo/seed-tattoo.e2e.spec.ts` (Betreff, Sichtbarkeit mit Seed-Daten).

## 2026-10-02 – P8.5a

- Reklamationen RK1–RK4 (`complaints.json`, SEED-SPEC §10a; Fotos RK1/RK2 als erzeugte Linienzeichnungen, angelegt mit Pflichtbezug auf die Reklamation) und Datenschutz-Anfragen DS1–DS5 (`privacy-requests.json`, §11a, ohne Exportdatei).\n- Hook `privacy-requests`: im Seed-Kontext bleibt `identityVerifiedAt` aus den Daten (SEED-SPEC §1.6); `seedField()` war schon vorhanden (keine Migration).\n- Tests: `tests/int/seed/complaints-privacy.int.spec.ts` (8: Status-Abdeckung, DM-CMP-01, DM-PRQ-01, „Heute“, Fristen-Jobs ohne Mail, Idempotenz, Entfernen) + AK-SEED-22 in `withdrawals-inquiries.int.spec.ts` – grün.

## 2026-10-02 – P8.5

- Widerrufe W1–W7 (`withdrawals.json`, SEED-SPEC §10), Anfragen A1–A7 (`inquiries.json`, §11, Skizze nur bei A2), Umsätze M-9…M-1 (`revenue.json`, §15); Import in `src/lib/seed/cases.ts` (Schritt 7, Hooks sehen N als Request-Zeit über `seedStep(…, now)`), Datums-Token `{{date:…}}` (`withDateTokens`), Umsatz-Seed überspringt belegte (Monat, Quelle).\n- Anker-Tabelle „Heute“ `SEED_TODAY_ANCHORS` in `src/lib/seed/expected.ts`.\n- Tests: `tests/int/seed/withdrawals-inquiries.int.spec.ts` (9), `tests/int/seed/revenue.int.spec.ts` (5: Wächter grün nur mit Vorschau-Modus, Verdrängen, Überspringen, AK-SEED-15, AK-SEED-21 Exporte ohne Seed) – grün.

## 2026-10-02 – P8.4a

- `src/lib/seed/invoices.ts`: Rechnung je bezahlter Bestellung (issueAt = Zahlung) und Gutschrift je Erstattung (Grund der Erstattung) über den normalen Zähler (`createInvoiceForOrder`/`createCreditNote`, Serien `BSP-RE`/`BSP-GS`), je Serie streng nach issueAt; PDF direkt mit dem P4-Renderer (Wasserzeichen, ohne Job) als `private-uploads` `invoice-pdf:<Nummer>`; `orders.invoice` und `refunds[].creditNote` verknüpft.
- Ergebnis wie SEED-SPEC §9: BSP-RE-2026-00001…00012, BSP-GS-2026-00001…00003 (O08 mit Grund `breakage`), Zähler BSP-RE = 12, BSP-GS = 3, RE/GS unberührt; `seed:remove` löscht die BSP-Zählerzeilen.
- Tests: `tests/int/seed/invoices.int.spec.ts` (3: AK-SEED-08 gegen die Tabelle §9, Verknüpfungen, PDF-Text mit Wasserzeichen/sha256/issued) grün.

## 2026-10-02 – P8.4

- `content/seed/data/customers.json` (24 erfundene Personen, SEED-SPEC §6) und `orders.json` mit O01–O14 (Form §2.6: Zeitleiste, Zahlung, Sendung, Erstattungen, Anfechtung) sowie den Kassen ohne Bestellung KS1 (`expired`, `reservation_expired`) und KS2 (`open`). Neu `src/lib/seed/orderPlan.ts` (reine Ableitung: Statusverlauf über `evaluateOrderTransition`, Vorkasse-Fristen aus `prepaymentDeadlines`, `finalStatusAt`/`retainUntil` wie der Hook, Kasse T0 = placedAt − 4 min, Reservierungen; Filter L-02/L-03 aus `retention/policy`, SE-12) und `src/lib/seed/orders.ts` (Snapshot mit `buildCharacteristics`/`computeShipping`, Verpackung aus `settings.packaging`, Tracking-Link aus den Vorlagen, Rechtstexte v1, Bausteine `draft-1`, Token nur aus `seedToken`, Verknüpfungen Kasse/Bestellung/Reservierung/Stück/Packfotos).
- Nach `pnpm seed:reset` (kanonisch): 14 Bestellungen (alle 13 Status, alle Zahlarten, Versand + Abholung), 14 Kassen, 10 Reservierungen; Summen wie §7.1. E2E-Anker auf den vollen Bestand nachgezogen (Startseite Textil-Station, Archiv- und Shop-Listen, Leerzustände blenden Seed-Stücke kurz aus); „Alle Daten“-Listen: Blätter-Pfeile mit Namen (axe).
- Tests: `tests/int/seed/orders.int.spec.ts` (8), `tests/unit/seed/timeline.unit.spec.ts` (7, AK-SEED-09), `persons.unit.spec.ts` (2, AK-SEED-12), `tokens.unit.spec.ts` (3), `tests/e2e/seed-status.e2e.spec.ts` (7 je Projekt, AK-SEED-20) grün; `pnpm check`, `test:int` (138 Dateien, ohne preview-export), `pnpm build`, betroffene E2E (desktop + pixel-7) grün.

## 2026-10-02 – P8.3

- `content/seed/data/products.json` mit allen 30 Stücken nach SEED-SPEC §5.1–§5.4 (Texte DE/EN inkl. `juttaSays`, Maße/Gewichte/Faserangaben, gemeinsame Werte §5.2, Verkaufsfelder §5.3 nur beim Anlegen); die 10 Stücke des Mini-Satzes blieben unverändert. `reservationRef` reservierter Stücke (S14 → Kasse O13, S27 → KS2) aus `seedReservationRef()` (§2.5); `currentOrder` setzt P8.4.
- Material-, Faser- und Maßangaben sind Annahmen (SE-06, OFFENE-PUNKTE §4.1), S04–S06 neutral betitelt (SE-01).
- Tests: `tests/int/seed/products.int.spec.ts` (4: Mengen/Verteilungen aus `SEED_EXPECTED_*`, Verkaufsfelder, AK-SEED-06, Sonderfälle S11/S14/S22/S26–S30/S23); Verbotsmuster über `content/seed/**` (`tests/unit/legal/forbidden.unit.spec.ts`, `data.unit.spec.ts`) grün.

## 2026-10-02 – P8.2

- `content/seed/data/media.json` vollständig nach SEED-SPEC §4.1/§4.2 (17 Instagram-Ausschnitte mit `crop`/`focal` in Prozent und Alt-Texten DE/EN, 30 Platzhalter mit Wash und Alt „Platzhalter-Zeichnung: …“); Ausschnitte per sharp vor dem Upload, danach dieselbe Pipeline wie Juttas Uploads; Platzhalter aus `fallbackArt.ts` (WebP 800×1000), solange `src/art/placeholders/` fehlt.
- `private-uploads.json` nach §4.4 um `O12:packing-1/-2` (JPEG 1200×900, Schriftzug „BEISPIEL-PACKFOTO 1/2“ bzw. „2/2“) und `A2:sketch-1` (PNG 1000×1000 ohne Text) ergänzt; Linienzeichnungen in `src/lib/seed/drawings.ts`; Schema mit `pdfText` **oder** `image` und Bezügen (`relatedOrder`/`relatedInquiry`/`relatedComplaint`, gesetzt nach den Vorgängen).
- Tests: `tests/unit/seed/crop.unit.spec.ts` (3, jede Zeile §4.1 Prozent → Pixel gegen die echten Quellen), `tests/int/seed/media.int.spec.ts` (6: Mengen aus `SEED_EXPECTED_COUNTS`, Felder, Ausschnitt-Maße, AK-SEED-19 per SHA-256, DM-MEDIA-04 404 ohne Vorschau-Modus, keine Hochskalierung/kein EXIF, R-136) grün.

## 2026-10-02 – P8.1

- Soll-Mengen als einzige Quelle in `src/lib/seed/expected.ts` (`SEED_EXPECTED_COUNTS` je Zeile aus SEED-SPEC §0.1, dazu Aufteilungen und Verteilungen je Kategorie/Status/Verkaufskanal); offene SE-Punkte (SE-01–07, SE-10, SE-12, SE-14) in OFFENE-PUNKTE §4.1 mit „Standard“, „Entscheidet“, „So änderbar“.
- Abgleich Code ↔ SEED-SPEC §0.3/DATENMODELL §13.3: Nummern 901–930, Belegserien `BSP-RE`/`BSP-GS` (Hook `invoices`), Etikett „Beispiel“ (`ExampleNote`, Verwaltung), Beispiel-IBAN als Standard in `settings`, Keramik nur `deko`, Kassen-Modell (`checkouts` für Vorgänge ohne Bestellung) – keine Abweichung im vorhandenen Code; Bestellungen fehlten noch (P8.4).
- Ist/Soll nach `pnpm seed:reset` (kanonisches `SEED_NOW`), Stand vor P8.2: media 11/47 · private-uploads 2/22 (7 Dateien + 15 Beleg-PDFs) · products 10/30 · checkouts 1/14 · orders 0/14 · reservations 1/10 · invoices 0/15 · invoice-counters (BSP) 0/2 · withdrawals 0/7 · complaints 0/4 · inquiries 0/7 · privacy-requests 0/5 · flash 0/10 · tattoo-offers 0/3 · tattoo-gallery 0/6 · pages 2/13 · faqs 0/12 · revenue-entries 0/18 · email-log 0/78 · consent-log 0/14 · audit-log 0/8 · webhook-events/documents/conformity-declarations 0/0 · Grund-Seed: categories 6/6, legal-texts 6/6, settings/site-texts 1/1, users 1/0–1.
- Folgeaufgaben: P8.2 bauen (Medien ergänzen, Packfotos/Skizze erzeugen) · P8.3 bauen (20 Stücke fehlen) · P8.4 bauen (Bestellungen, Kassen, Reservierungen) · P8.4a bauen (Seed-Anbindung des P4-Renderers) · P8.5 bauen · P8.5a bauen · P8.6 bauen · P8.7 ergänzen (2 von 13 Seiten, FAQ fehlen) · P8.8 bauen · P8.9 nur prüfen/ergänzen (Guard, Entfernen, Reset und Idempotenz aus P1 vorhanden).
- Tests: `tests/unit/seed/expected.unit.spec.ts` (2, liest §0.1 per Markdown-Parser) grün.

## 2026-10-02 – P7.15

- `tests/e2e/tattoo/no-purchase.e2e.spec.ts` (AK-9-01, AK-9-05, R-139 auf R11–R18 DE/EN), `tests/int/legal/tattoo-cart.int.spec.ts` (R-170), `tests/unit/legal/tattoo-content.unit.spec.ts` (V-15/V-24/V-25, R-034); ANFORDERUNGEN §3 Nachweise für P7-Zeilen, `LEGAL_TRACE_PHASE = 7`.
- Tests: alle grün (e2e desktop + pixel-7; `pnpm check`, `test:int` ohne preview-export, `pnpm build`).

## 2026-10-02 – P7.14

- Durchstich Formular → M11/A05 → Verwaltung → „Jetzt löschen“; Anfrage-Detail mit Abschnitt „Angebot“ (Vorlage `commission.offer` kopieren bzw. `mailto:`, Hinweis Umsatz-Wächter); `commission.offer` als Platzhalter mit Gliederung (R-161 in ANFORDERUNGEN §7 abgehakt).
- Tests: `tests/int/legal/retention-inquiries.int.spec.ts` (4), `tests/e2e/commission/flow.e2e.spec.ts` (desktop + pixel-7 grün).

## 2026-10-02 – P7.13

- `src/components/commission/CommissionForm.tsx`: Pflichtfelder, Fehlerzusammenfassung mit Sprunglinks, FileDrop (≤ 5 Bilder, ≤ 15 MB, Verkleinerung im Browser ≤ 2560 px/≤ 4 MB, Upload einzeln mit Fortschritt, Fehler je Bild), Datenschutz-Hinweis mit Link, keine Checkbox, Erfolg ersetzt das Formular; ohne JavaScript ohne Bilder.
- Tests: `tests/e2e/commission/form.e2e.spec.ts` (5 je Projekt, desktop + pixel-7 grün).

## 2026-10-02 – P7.12

- Dienst `src/lib/commission/submit.ts` + Server Action `submitCommissionInquiry`: Honeypot/Zeitfalle (< 3 s) → Schein-Erfolg, Rate-Limits 5/h und 20/Tag → 429, Grenzen laut DATENMODELL, Anlage AA-JJJJ-NNNN, Bilder nur mit Ticket (gleiche Frist L-10), M11 (neue Vorlage `inquiry_receipt`) und A05 über die Outbox, doppeltes Absenden → ein Datensatz.
- Tests: `tests/int/commission/submit.int.spec.ts` (6), `tests/unit/email/inquiry-receipt.unit.spec.ts` (5, Snapshots DE/EN).

## 2026-10-02 – P7.11

- `POST /api/uploads/commission` (`src/lib/commission/upload.ts`): Formular-Token (HKDF `pc:form-token:v1`, 2 h, Kopf `x-form-token`), Rate-Limit `commission_upload` 15/h, > 4,5 MB → 413, Typ am Inhalt (sharp) sonst 415, Neukodierung ohne EXIF/GPS, `private-uploads` `pending` mit Löschung nach 24 h, Antwort `{ uploadId, ticket }`, 6. Upload je Formular → 409.
- Tests: `tests/int/commission/upload.int.spec.ts` (6 grün).

## 2026-10-02 – P7.10

- R10 Auftragsarbeiten (`src/app/(frontend)/[locale]/commissions/page.tsx`): H1, „So läuft’s“, Beispiele mit Bildunterschrift, Hinweis „individuell vereinbart, Bezahlung nicht im Shop, kein Online-Vertrag“, Formular-Block mit Kontur (Preset `frame`, Coco `sitzen`), FAQ `commissions`, Kontaktalternative; Seite wird ungecacht gelesen, ohne Seite Leerzustand statt 500; Registry R10 `live`.
- Tests: `tests/e2e/commission/page.e2e.spec.ts` (6 grün, desktop + pixel-7), dazu a11y/security-headers/seo/privacy/forbidden für alle Live-Routen grün.

## 2026-10-02 – P7.9

- Reiter Texte: Preise (`settings.tattoo.*`, Bereich `tattooPrices`), Blöcke der Seiten `tattoo`/`tattoo_aftercare` (Stil, Preise, Ablauf, Pflege-Phasen, Hinweise; Rich Text als Klartext), FAQ Tattoo/Aftercare (sortierbar), alles mit „Übersetzen“ (`POST /api/pages/:id/translate`, `/api/faqs/:id/translate`; `translateDocumentFields` kann jetzt Listen/Blöcke).
- Warnung bei V-24/V-15 beim Speichern, Speichern bleibt möglich; keine Gesundheitsfelder (V-25).
- Tests: `tests/int/tattoo/texts-admin.int.spec.ts` (3), `tests/e2e/admin/tattoo-texts.e2e.spec.ts`; Int gesamt 880 grün, Build grün.

## 2026-10-02 – P7.8

- Reiter Galerie: Einwilligungs-Häkchen je Foto, Formular (Felder §6.16, Nachweis privat, Instagram-Hinweis), „Online“ ohne Einwilligung gesperrt („Ohne Einwilligung der Kundin/des Kunden nicht veröffentlichen“, auch im Hook).
- `POST /api/tattoo-gallery/:id/withdraw-consent`: offline, Bilder gesperrt (Datei 404), sofortige Revalidierung, Audit, Nachweis-Frist 3 Jahre (L-19 b); Dateien löscht `retentionConsentEvidence` nach 24 h (L-20); M16 Portfolio nur an eingetippte Adresse. Link im DSGVO-Werkzeug.
- Tests: `tests/int/legal/gallery-withdraw.int.spec.ts` (5), `tests/e2e/admin/tattoo-gallery.e2e.spec.ts` (2).

## 2026-10-02 – P7.7

- Reiter Angebote: Zustand kommt/läuft/abgelaufen (abgelaufen grau), „Neues Angebot“ mit Datum + optionalen Uhrzeiten → `startsAt`/`endsAt` Europe/Berlin (`offerTimesFromInput`, ohne Uhrzeit 00:00–23:59:59), Ort ohne Straße aus den Stammdaten (`containsStreet`, E-50), Preis-Info, Flash-Motive, Bild, „Übersetzen“ (`POST /api/tattoo-offers/:id/translate`); Weckzeiten setzt der Hook (P7.3).
- Tests: `tests/int/tattoo/offers-admin.int.spec.ts` (2), `tests/e2e/admin/tattoo-offers.e2e.spec.ts`.

## 2026-10-02 – P7.6

- Ansicht `/tattoo` mit Reitern Flash · Angebote · Galerie · Texte (Links `?reiter=…`, `aria-current`), ersetzt den Platzhalter; je Reiter Weg in „Alle Daten“.
- Flash: Liste mit Status-Chip (antippen + bestätigen = 2 Taps, `POST /api/flash/:id/status`), „Offline nehmen“, „Neuer Flash“ mit Foto-Baustein (max. 5, Alt-Text DE Pflicht), Nummernvorschlag ohne Seed/Fixtures (`GET /api/flash/next-number`), Titel DE/EN + „Übersetzen“ (`POST /api/flash/:id/translate`).
- Wiederholbare Motive: Ablehnung mit Hinweis auf „Offline nehmen“ (Hook + DB-CHECK).
- Tests: `tests/int/tattoo/flash-admin.int.spec.ts` (3), `tests/e2e/admin/tattoo-flash.e2e.spec.ts` (2 × desktop/pixel-7), Unit `tests/unit/admin/tattoo-admin.unit.spec.ts`.

## 2026-10-02 – P7.5

- Zentrale Regel isPubliclyVisible/isMediaPubliclyVisible (src/lib/tattoo/visibility.ts) in Galerie-Abfragen, Teasern (R11), media.read und im Datei-Handler: nicht sichtbare Dateien 404 statt 403 (auch erratene URL), Verwaltung privat; Seed-/Kund:innen-Medien Cache public, max-age=300
- R15 Galerie: Filter ?kind=fresh|healed (statische Variante), Raster ohne Preise, Vollbild mit Bildunterschrift (lightbox), „3,5 Jahre verheilt“, Etikett „intern – Einwilligung fehlt“, Leerzustand
- Tests: tests/int/legal/gallery-consent.int.spec.ts (R-172, AK-9-04, G1–G6; Umgebung injiziert), tests/e2e/tattoo/gallery.e2e.spec.ts (grün); Querschnitt a11y/SEO/Verbotsmuster/Header/Datenschutz über die neuen live-Routen grün

## 2026-10-02 – P7.4

- R14 Preise (Mindestpreis, Preisrahmen, Flash-Hinweis, Anzahlung persönlich ohne Verfallsklausel, Fußnote, Kontakt „eigene Idee“), R16 Ablauf (5 Schritte, ab 18, Bezirk), R17 Aftercare (Blöcke der Seite tattoo_aftercare, Warnzeichen, Safer-Tattoo-Link, Druck-CSS ohne Kopf/Navigation/Linie/Coco), R18 FAQ als details
- Tests: tests/e2e/tattoo/info-pages.e2e.spec.ts (R-034, V-24, Druck, Tastatur; grün)

## 2026-10-02 – P7.3

- R13 Angebote: Zustand aus startsAt/endsAt (läuft gerade / in X Tagen), Datums-Badge, Uhrzeit, Ort nur Bezirk, Motive mit Link auf R12#f-…, Mail-Betreff „Anfrage … am …“; Teaser auf R11 und Startseite (gleiche Abfrage)
- Task revalidateEndedOffers (maintenance, Wecker an Beginn/Ende per jobAlarm.bump beim Speichern und im Task, Sicherheitsnetz täglich ab 00:05), erneuert tattoo-offers/home und R01/R11/R13; Migration p7_revalidate_offers_task (Task-Slug-Enum)
- Tests: tests/int/tattoo/offers.int.spec.ts (R-171), tests/int/jobs/revalidate-offers.int.spec.ts (AK-8-01), tests/e2e/tattoo/offers.e2e.spec.ts (AK-9-03, Cron-Route mit CRON_SECRET; grün)

## 2026-10-02 – P7.2

- R11 Übersicht (Mein Stil, Angebots-Teaser, 3 freie Flash-Motive, 3 Galerie-Bilder bevorzugt healed, Links zu allen Unterseiten) und R12 Flash (Filter ?available=1 als statische Variante, Raster 2/3 Spalten, Karten mit F-012, Größe, Preis „120 €*“, einmalig/wiederholbar, Mail/DM/Baustein; vergeben: Stempel in --stencil ohne Knöpfe, Anker #f-012, MI-14 ohne Übergang)
- Registry R11–R18 live; LIST_ROUTE_IDS um R12/R15 erweitert; Tuschelinie stencil mit Konturen und Endpunkt unter dem Raster (Feinschliff P9, OFFENE-PUNKTE)
- Tests: tests/int/tattoo/flash-data.int.spec.ts (3), tests/e2e/tattoo/flash.e2e.spec.ts (AK-9-02, R-034, @a11y; desktop + pixel-7 grün)

## 2026-10-02 – P7.1

- Tattoo-Grundgerüst: Unter-Navigation (TattooSubNav, Chips, aria-current), Kontakt-Block (Mail-Knopf mit Vorlage, Instagram-DM mit rel noopener noreferrer, Adresse kopieren mit Rückfall Markieren), Rahmen TattooShell, Preis-Fußnote price.tattooNote
- src/lib/tattoo/mailto.ts (RFC 6068, Betreffe Flash/Angebot/allgemein/eigene Idee DE/EN, Gesundheits-Hinweis), gecachte Lesefunktionen src/lib/data/tattoo.ts (Tags flash, tattoo-offers, tattoo-gallery, faqs, page:tattoo, page:tattoo_aftercare, settings)
- SEO-Titel „{Seite} · Tattoo · Planet Claire“ und eigene Beschreibungen R11–R18; SE-09 geklärt (vorhandene PAGE_KEYS reichen)
- Tests: tests/unit/tattoo/mailto.unit.spec.ts (AK-9-02, R-170), copy-button-Rückfall (Unit)
## 2026-10-03 – P6 Phasen-Abnahme (Recht, Widerruf, Datenschutz) – für Jutta

Hallo Jutta,

Phase 6 ist gebaut. Hier ist kurz und einfach, was jetzt da ist und was du später mit der Kanzlei klären musst.

### Was rechtlich jetzt da ist

- **Alle Rechtsseiten** auf Deutsch und Englisch: Impressum, Datenschutzerklärung, AGB, Widerrufsbelehrung mit
  Muster-Formular, Versand und Zahlung sowie die Kontaktseite. Die Texte sind noch **Platzhalter**. Oben auf jeder
  Seite steht ein deutlicher Hinweis „vorläufiger Text“, bis die Kanzlei die echten Texte liefert.
- **Rechtstexte in der Verwaltung** (Bereich „Texte → Rechtstexte“): Du kannst später den Text der Kanzlei einfach
  hineinkopieren. Jede Änderung wird eine neue Fassung mit Datum. Alte Fassungen bleiben gespeichert, damit man immer
  zeigen kann, was eine Kundin beim Kauf gesehen hat. Dazu gibt es PDFs zum Herunterladen.
- **Kleine Rechtsbausteine** (z. B. der Hinweis zu den Rücksendekosten oder der Kleinunternehmer-Satz am Preis) liegen
  ebenfalls versioniert in der Verwaltung. Es sind vorerst Arbeitsfassungen.
- **Datenschutz-Anfragen** (Auskunft, Löschen, Berichtigen …): eigene Liste unter „Export und Datenschutz“. Das System
  zeigt die Monatsfrist, erinnert dich rechtzeitig und hilft beim Suchen aller Daten einer Person und beim Export.
- **Automatisches Löschen**: Alte Daten (z. B. abgebrochene Bestellungen, alte Mail-Protokolle, Anfragen nach
  6 Monaten) werden nach festen Fristen gelöscht oder unkenntlich gemacht. In den Einstellungen siehst du vorher in der
  „Löschvorschau“, was in den nächsten Tagen gelöscht würde. Rechnungen bleiben so lange, wie das Gesetz es verlangt.
- **Reklamationen** werden mit Fotos zur Bestellung gespeichert, mit Antwort-Vorlage (Reparatur oder Ersatz).
- **Jährliche Erinnerung**, die Rechtstexte prüfen zu lassen.
- **Verzeichnis der Verarbeitungen** und eine Liste aller Dienste (z. B. Stripe, DHL) für die Kanzlei.

### So funktioniert der Widerruf

1. Auf **jeder Seite** unten steht der Link **„Vertrag widerrufen“**.
2. **Schritt 1:** Die Kundin gibt Name, E-Mail und Bestellnummer ein. Sie kann (muss aber nicht) einzelne Stücke
   auswählen und einen Grund nennen.
3. **Schritt 2:** Sie sieht alles noch einmal und klickt **„Widerruf bestätigen“**.
4. Sie bekommt **sofort** eine Bestätigung auf der Seite und per Mail (mit Datum und Uhrzeit). Du bekommst auch eine
   Mail.
5. In der Verwaltung unter **„Widerrufe“** siehst du alles: Ware ist zurück → Erstattung auslösen (Stripe macht das
   automatisch, bei Vorkasse überweist du und klickst „überwiesen“). Das System erinnert dich an die 14-Tage-Frist und
   erstellt die Gutschrift.

### Was du vor dem Go-live mit der Kanzlei klären musst

Die Kanzlei-Mappe (`docs/recht/KANZLEI-BRIEFING.md`, jetzt Version 1.4, mit Bildschirmfotos des Widerrufs) ist
fertig. Die wichtigsten Punkte:

- **Echte Rechtstexte** liefern lassen (Impressum, Datenschutz, AGB, Widerrufsbelehrung, Versand) – sie ersetzen die
  Platzhalter.
- **Widerruf:** Passt der Ablauf in zwei Schritten (K-11)? Wer trägt bei einem Teil-Widerruf die Versandkosten
  (K-09)? Vorläufig gilt: Die Rücksendung zahlt die Kundin; behält sie einen Teil, bekommt sie den Warenwert und den Unterschied
  bei den Versandkosten zurück.
- **Rechnungen 8 oder 10 Jahre** aufbewahren (K-33, auch mit der Steuerberatung)? Vorläufig: 10 Jahre.
- **Wortlaut der Bausteine** (Kleinunternehmer-Hinweis, DHL-Einwilligung, Transportschaden, Rücksendekosten):
  bisher nur Arbeitsfassungen (K-15, K-21, K-23, K-31).
- **Deine Anschrift** im Impressum und in der Belehrung (K-39) und ob eine Telefonnummer nötig ist (K-28).
- **Ohne Cookie-Banner** zulässig (K-30, K-38)?

Du musst jetzt nichts tun. Diese Punkte besprechen wir gemeinsam beim Go-live (P11).

## 2026-10-02 – P6.23

- ANFORDERUNGEN §3 um Spalte „Nachweis“ (Testdatei-Pfade, bis P6 gefüllt); Parser liest Spalten über die Kopfzeile und prüft, dass jeder Pfad existiert; `LEGAL_TRACE_PHASE = 6`\n- §7 Teil A: R-095 abgehakt (02.10.2026)\n- Tests: `tests/unit/legal/traceability.unit.spec.ts` (9, inkl. Gegenproben Titel/Pfad)

## 2026-10-02 – P6.19

- Mail-Protokoll (Typ, Betreff, Zeitpunkt, Anbieter-ID, Status, Anhänge; Empfänger maskiert) an Widerrufen, Anfragen und Datenschutz-Anfragen; Einwilligungs-Protokoll an Bestellungen\n- Gesamtliste `/export/protokolle` mit Filtern (Art, Zeitraum, Status, Typ), ohne Inhalte/Freitexte\n- „Kopie an mich“ für M08 (`POST /api/withdrawals/:id/receipt-copy`) nur an die Verwaltungs-Adresse\n- Tests: `tests/int/email/logs-admin.int.spec.ts` (4), `tests/e2e/admin/logs.e2e.spec.ts`, `tests/e2e/admin/privacy-requests.e2e.spec.ts` (desktop + pixel-7 grün)

## 2026-10-02 – P6.18

- Löschplan je Datensatz (`src/lib/privacy/erasure.ts`, Regel aus LOESCHKONZEPT): Bestellungen nach Fristende anonymisiert (Stufe D), sonst eingeschränkt (`processingRestricted`, Notizen/Packfotos weg, DHL-Einwilligung widerrufen) oder behalten (Sperre mit Begründung); Kassen, Anfragen, Nachweise ohne Bezug gelöscht; Belege unverändert; `deletion-log` (`privacy_request`/`DSGVO`/`privacyRequestRef`); M15\n- Outbox und `sendEmail` unterdrücken Kund:innen-Mails zu eingeschränkten Bestellungen (`suppressed`)\n- Berichtigung: ohne Rechnung direkt (Vermerk im Verlauf, Kontext `rectify`), sonst `reissueInvoice` (GS `correction` + neue RE mit `replacesInvoice`); Migrationen `p6_invoice_reissue` (+ `_constraints`: partieller UNIQUE, GoBD-Trigger)\n- M16 beim DHL-Widerruf auf Wunsch; M14–M16 DE/EN\n- Tests: `tests/int/legal/privacy-erasure.int.spec.ts` (4), `tests/unit/legal/p6-mails.unit.spec.ts` (R-084 M14–M16)

## 2026-10-02 – P6.17

- Personensuche (`src/lib/privacy/search.ts`): E-Mail normalisiert, Bestellnummer oder Name über Bestellungen, Kassen, Belege, Widerrufe, Anfragen (inkl. Bilder), Reklamationen, Mail-/Einwilligungs-Protokoll und frühere Anfragen; Treffer in `matched*`\n- Auskunft-Export (`src/lib/privacy/export.ts`): ZIP mit `daten.json`, `auskunft.html` (Art. 15 lit. a–h, Empfänger aus DIENSTE, Fristen aus `policy.ts`, Berliner Beauftragte) und Kopien der Bilder/PDFs; privat (`data_export`), Audit `data_exported`; ohne interne Notizen, Verwaltungs-Mails und Token-Merkmale\n- M14 `privacy_access_response` mit signiertem Link `GET /api/privacy-export/[token]` (HMAC `pc:privacy-export:v1`, 7 Tage, danach 410; Token erst beim Versand eingesetzt, nie im `email-log`); Ansicht „Personensuche und Auskunft“ im Anfrage-Detail\n- Tests: `tests/int/legal/privacy-export.int.spec.ts` (3, R-150/R-137, Zählvergleich), Mail-Fixtures M14–M16; pnpm check grün

## 2026-10-02 – P6.16

- Ansicht `/export/datenschutz` (Liste offen/abgeschlossen, „Anfrage erfassen“) und Detail `/export/datenschutz/:id` (Status, Identität, Verlängerung, Abschluss); Endpunkte `/api/privacy-requests/intake` und `/:id/save`\n- Task `privacyRequestsDeadlineReminder` (ab 08:00, A14 genau an Tag −7 und −1 vor `extendedDueAt ?? dueAt`, Beispieldaten ausgenommen), Migration `p6_privacy_requests_task`; Hinweis unter „Heute“ (auch Beispieldaten)\n- Tests: `tests/unit/legal/gdpr-deadline.unit.spec.ts` (DM-PRQ-01, R-153), `tests/int/legal/privacy-requests.int.spec.ts` (7 Tests), pnpm check grün

## 2026-10-02 – P6.13

- Quelltext-Scans je Verbot (V-01, V-03–V-07, V-16, V-20–V-23, V-25, V-30), Schema-Scan V-23 und R-096, gerenderte Mails (V-01, V-02, V-09, V-11, V-18); Allowlist als JSON mit Pflicht-Begründung\n- Crawl aller live-Routen DE/EN inkl. V-27 (externe Links), V-28 (kein Audio), V-31 (Straße nur auf erlaubten Seiten); Gegenproben je Verbot\n- @privacy T-03/T-04 auch für Verwaltungsansichten (R-130, R-131)\n- Tests: forbidden.unit, forbidden.e2e, privacy-Suiten auf desktop und pixel-7 grün

## 2026-10-02 – P6.12

- Prüf-Suite für den Kaufweg: Knopf-Text, Übersicht vor dem Knopf, Zahlarten/Lieferbeschränkungen am Anfang, „Ändern“-Links, AGB/Widerruf abrufbar und speicherbar (R-012, R-036, R-063–R-065)\n- Vertragsschluss über den Kassen-Datensatz; gescheiterte Zahlung → keine Bestellung, keine M01; M01 mit genau drei PDFs in der Bestellfassung, EN zusätzlich EN-PDFs (AK-6-02, R-013, R-015, R-081)\n- Keine Lücken im Kaufweg gefunden\n- Tests: contract-confirmation.int (4), checkout-compliance.e2e auf desktop und pixel-7 grün (iphone-15 läuft in CI)

## 2026-10-02 – P6.11

- Reklamationsakte im Bestell-Detail und über „Reklamation (Bruch)“ in „Versendet“ (Art, Eingang, bis 6 Fotos, Beschreibung, betroffene Stücke, DHL-Frist, carrierClaimFiledAt)\n- „Reklamation beantworten“ sendet M12 (Wahlrecht Reparatur/Ersatz, Unikat-Hinweis, +12 Monate) über die Outbox; Kund:innen-Wahl, warrantyEndsAt +2 Jahre bzw. +12 Monate bei Reparatur\n- Streitfall: M13 mit Universalschlichtungsstelle (Anschrift, URL), kein OS-Link; vsbgNoticeSentAt\n- Tests: complaints.int (R-110, R-111, R-112), vsbg.unit (R-112), p6-mails.unit (R-084, Snapshots DE/EN), E2E admin/complaints (desktop, pixel-7) grün

## 2026-10-02 – P6.10

- Dialog „Erstatten“ im Widerruf und in der Bestellung: Positionen wählen, Vorschlag nach KONZEPT §5.3 (`refundAmount.ts`, Teil-Widerruf mit Versanddifferenz, Hinweis K-09), nur erhöhbar mit Notiz, nie über den Rest; Pflicht-Grund in der Bestellung (Storno, Bruch, Kulanz, Reklamation).
- Karte/PayPal über den Zahlungsadapter (Idempotenz `refund:<orderId>:<Nr>`), Erfolg (Mock/Webhook) → Gutschrift GS mit demselben Grund, O13/O14/O15/O21, Widerruf W4/W6, M09 `refund_confirmation` mit GS-PDF; Fehlschlag → A08; Vorkasse „Erstattung überwiesen“ ohne IBAN.
- Tests: `tests/unit/commerce/refund-amount.unit.spec.ts` (9), `tests/int/legal/refund.int.spec.ts` (8); P4.22-Test angepasst (Erfolg schließt jetzt ab).

## 2026-10-02 – P6.9

- Widerrufs-Posteingang mit Aktionen: Bestellung zuordnen (Suche, O11/O4), Ware ist zurück (O12, Zustandsnotiz `returnConditionNote`, Fotos), Rücksendenachweis, Ohne Erstattung abschließen (O20 nur ohne weiteren offenen Widerruf), Ablehnen und Test/Spam (nur manuell, Begründung Pflicht), Stück wieder verkaufen/ausblenden; manuelle Erfassung per Mail/Brief (`POST /api/withdrawals/manual`, Berliner Ortszeit, M08 nur mit E-Mail und Haken).
- „erstatten bis“ jetzt 14 Berliner Kalendertage (`addBerlinDays`), Task `withdrawalDeadlines` (A13 einmal ab Tag 10, ohne Beispieldaten); Migrationen `p6_withdrawal_inbox_refunds`, `p6_withdrawal_deadlines_task`.
- Tests: `tests/int/legal/withdrawal-inbox.int.spec.ts` (11), `tests/int/jobs/withdrawal-deadlines.int.spec.ts` (1), `tests/e2e/admin/withdrawal-inbox.e2e.spec.ts` (3 je Projekt).

## 2026-10-02 – P6.22

- Anlage E erzeugt: `docs/recht/anlagen/E-01…E-06.png` (390 px, DE, Mock, 68–145 KB) mit `scripts/legal/briefing-screenshots.ts`; M08 wird vorab außerhalb von Playwright gerendert, Konfiguration löst Pfade zur Repo-Wurzel auf.
- Tests: `tests/unit/legal/briefing.unit.spec.ts` prüft jetzt alle sechs Dateien (PNG, ≤ 300 KB) statt `it.todo`.

## 2026-10-02 – P6.8

- R26 als zweistufige Widerrufsfunktion (Server Action mit `useActionState`, ohne JavaScript nutzbar): Schritt 1 → Auswahl der Stücke (nur bei passender Bestellnummer + E-Mail, keine Checkbox angehakt) → Schritt 2 mit „Ändern“ und „Widerruf bestätigen“ → Bestätigungsseite mit allen Angaben, Eingang (MEZ/MESZ), Vorgangsnummer, Mail-Hinweis, Drucken.
- Eingaben reisen im signierten Formular-Token (HMAC, HKDF `pc:form-token:v1`, 6 h) per POST, nie in URL oder Cookie; Einmal-Kennung verhindert doppelte Datensätze bei Doppelklick.
- Tests: `tests/int/legal/withdrawal-form.int.spec.ts` (7), `tests/e2e/legal/withdrawal-flow.e2e.spec.ts` (7 je Projekt, desktop + pixel-7, inkl. ohne JS, Tastatur, axe).

## 2026-10-02 – P6.21

- E2E legal/processor-table (R-155, DE/EN, ohne JS) grün; Tabellen-Container per Tastatur erreichbar (axe R22)

## 2026-10-02 – P6.15

- E2E admin/deletion-preview (390×844, axe) desktop+pixel-7 grün

## 2026-10-02 – P6.6

- Fuß mit „Vertrag widerrufen“ und Pflichtlinks auf jeder Registry-Route DE/EN inkl. Danke/Status (Fixture), 404, 500; M08 zeigt den Link jetzt auch\n- Tests: E2E legal/footer (390/1440 × reduce/no-preference, elementFromPoint, ≥ 44 px), unit mail-withdrawal-link (M01–M09) grün

## 2026-10-02 – P6.5

- Rechtsseiten: PDF-Download je Text (außer Impressum), translation.disclaimer auf EN mit EN-Fassung, Anker-IDs der Datenschutzerklärung (§11.10), Seite neu bei nachgetragenem PDF; Kontakt mit „Adresse kopieren“\n- Startseite: dynamicParams=false entfernt (Neuerzeugung nach Tag-Erneuerung lieferte dauerhaft 404)\n- Tests: unit phone (R-021), anchors; E2E legal/pages (R-010/R-002/R-015/R-020/R-021/R-023/R-049) desktop+pixel-7 grün

## 2026-10-02 – P6.4

- Texte → Rechtstexte: je Typ aktive Fassung (Stand, Herkunft, Alter, Bestellungen je Fassung, letzte Prüfung), frühere/geplante Fassungen, „Neue Version“ (HTML/Text DE, EN optional, bereinigt → Lexical), Vorschau mit Fehlerliste ohne Speichern, Veröffentlichen sofort/ab Datum mit Rückfrage, „Geprüft, keine Änderung“; Bausteine nach Schlüssel mit Spalte Kanzlei ja/nein\n- Endpunkte /api/legal-texts|legal-snippets/{preview,publish}-version, /api/legal-texts/confirm-review\n- Tests: int legal-texts-admin (9), E2E admin/legal-texts (390×844, axe) grün

## 2026-10-02 – P6.20

- Task `legalReviewReminder` (täglich ab 08:30 Berlin, `runOncePer`), Logik `src/lib/legal/review.ts`: Alter je Typ = jüngeres Datum aus `activatedAt` und `reviewedAt` (Berliner Kalendertage), A10 mit allen fälligen Typen, Wiederholung alle 30 Tage über `lastReminderSentAt`; Migration `p6_legal_review_job` (Task-Enum)\n- „Heute“-Kachel „Rechtstexte“ je Typ (Version, gültig ab, Herkunft, Alter; Warnung bei fehlendem Typ, Herkunft ≠ Kanzlei, > Intervall)\n- Tests: tests/int/jobs/legal-review.int.spec.ts (4, R-014 Tag 364/365/380/395), Slug-Test angepasst

## 2026-10-02 – P6.14

- Runner src/lib/retention/runner.ts (≤ 500/Lauf, je Datensatz eigene Transaktion, deletion-log, Legal Hold, Trockenlauf, 3 Fehlschläge → A12 über Tabelle retention_failures)\n- Tasks retentionAbandonedCheckouts, retentionOrderMinimize, retentionOrders, retentionInvoices (pc.now, GoBD-Trigger), retentionWithdrawals; policy.ts um isDue/eventCutoff ergänzt\n- Migrationen p6_retention_failures, p6_retention_jobs\n- Tests: tests/unit/legal/retention-rules.unit.spec.ts (7), tests/int/legal/retention.int.spec.ts Teil 1 (10) – grün

## 2026-10-02 – P6.7

- submitWithdrawal (src/lib/legal/withdrawal.ts): Honeypot, Rate-Limit withdrawal_submit 30/h je IP-Hash, zod, unveränderlicher Datensatz ohne IP, Auto-Zuordnung (Bestellnummer + E-Mail ohne Groß/Klein), O11 bzw. O4 withdrawn + W5, M08 + A04 direkt nach Commit\n- M08-Vorlage withdrawal_receipt (MEZ/MESZ), A04 mit Kopie der Erklärung, sendEmail-Kette für M08 (≤ 5 min bis 24 h, A12 ab 2. Fehlversuch und nach 24 h), Hinweis unter „Heute“\n- Tests: tests/int/legal/withdrawal.int.spec.ts (8), tests/int/email/withdrawal-retry.int.spec.ts (2), Unit M08 (7) – grün

## 2026-10-02 – P6.3

- Geschlossene Token-Liste in `src/lib/legal/tokens.ts` (= R-012 = DATENMODELL §6.12 = KANZLEI-BRIEFING §16.3, Unit-Abgleich); `{{returnCostsNote}}` aus dem aktiven Baustein; Bausteine nur R-012- plus eigene Kontext-Tokens.\n- Prüfungen vor dem Veröffentlichen (`checkLegalText`/`checkLegalSnippet`): Widerrufs-URL Pflicht (R-095), OS-Link (V-01) und Steuerhinweis im KU-Modus (V-02) gesperrt; `activateLegalText(req, id, { validFrom, now })` und `activateLegalSnippet` planen bzw. aktivieren, `jobAlarm.bump(validFrom)`.\n- Task `activateScheduledLegalTexts` (Migration `p6_activate_legal_job`, im Job-Wecker); HTML-Bereinigung `sanitize-html` 2.18.0 mit Allowlist KANZLEI-BRIEFING §1.2; Platzhalter-Belehrung mit `Telefon: {{phone}}`.\n- Tests: render-tokens.unit (5), legal-texts.int (+4 R-012), activate-legal-texts.int; volle Int-Suite 105 Dateien grün (ohne preview-export).

## 2026-10-02 – P6.2

- Geprüft: `privacy-requests` (§6.26), `deletion-log` + `writeDeletionLog` (§6.27), `privacyFields()` an orders/withdrawals/inquiries, `orders.timestamps.finalStatusAt` – vorhanden seit P1.\n- Verdrahtet: Audit `legal_hold_changed`/`processing_restricted` (ohne Begründungstext), Zeitstempel über die Request-Uhr; Reklamationen mit `carrierClaimDueAt` (Zustellung + 7 Tage) und `warrantyEndsAt` (+ 12 Monate bei Reparatur), Audit `complaint_changed`; virtuelles `orders.warrantyEndsAt`.\n- Tests: no-versions.unit (R-154, 12), complaints-model.int (4), Zugriffsmatrix (privacy-requests, deletion-log, complaints anonym 403).

## 2026-10-02 – P6.1

- Collections `legal-snippets` (öffentlich nur aktive Fassung, Update nur Entwürfe, Tokens je Schlüssel geprüft) und `complaints`; `private-uploads.relatedComplaint`, Join `orders.complaints`; Migrationen `p6_legal_snippets_complaints` + `…_constraints` (eine aktive Fassung je Schlüssel, seed_key-Index).\n- Grund-Seed: 36 Bausteine v1 aktiv (Arbeitsfassung `draft` bzw. Platzhalter); `getSnippet` liest die Collection (Speicherstand, Version „1“), Rückfall Seed-Text `draft-1`; `activateLegalSnippet` mit Audit.\n- Rechtsfelder aus P1 geprüft (legal-texts, settings, withdrawals, Enums) – vorhanden.\n- Tests: snippets.int (3), Zugriffsmatrix (T-15, 29 Collections), pg-objects (T-14), check:migrations ohne Drift.






## 2026-10-02 – P5 CI grün

- Phasenlauf `[ci:full p5]` (ed37101): CI full (e2e desktop/iphone-15/pixel-7, quality inkl. Lighthouse) und Vorschau-Export grün, Artefakt `planet-claire-vorschau-p5-ed37101`; schneller Lauf nach gitleaks-Ausnahme (47a0605) grün.

## 2026-10-02 – P5 CI-Reparaturen (3)

- Phasenlauf 4 (ed37101): CI full und Vorschau-Export grün (Artefakt `planet-claire-vorschau-p5-ed37101`); im schnellen Lauf meldete der Geheimnis-Scan einen Fehlalarm (Vorlagen-Kennung `dispute_vsbg37`) → eng begrenzte Ausnahme in `.gitleaks.toml`, lokal 241 Commits ohne Fund.

## 2026-10-02 – P5 CI-Reparaturen (2)

- Schneller CI-Lauf lief seit P5 ins 30-Minuten-Limit (als „abgebrochen“ gemeldet) → Limit 45 min, Beschleunigung als offener Punkt.
- Produktseite R04: Coco-Bild des Menüs lädt erst nach dem ersten Bild (spart 90–150 ms bis zum Hauptfoto).

## 2026-10-02 – P5 CI-Reparaturen

- Phasenlauf 1 (18a10e2): Abdeckung (Randfall-Tests Packen/Versand/Abholung ergänzt) und iphone-15 Foto-Upload-Test (WebKit liefert Upload-Inhalt nicht an Playwright) behoben.
- Phasenlauf 2 (edbfb30): „Erneut senden“-Hinweis in Einstellungen → System verschwand nach dem Neuladen (echter Fehler, behoben); Produktseite R04: zweites Galeriefoto lädt erst nach dem Hauptfoto, Hauptfoto `decoding=sync` → LCP lokal ca. 2,0 s statt 2,24 s.

## 2026-10-02 – P5 Phasen-Abnahme (deine Werkstatt, also die Verwaltung) – für Jutta

**Was ist neu?** Deine Verwaltung ist fertig gebaut – gemacht fürs Handy. Du erreichst sie über deinen geheimen
Verwaltungs-Link und kannst sie wie eine App auf den Startbildschirm legen („Zum Home-Bildschirm“). Alles ist auf
Deutsch, mit großen Knöpfen, und vor jeder wichtigen Aktion fragt sie kurz nach, was passieren wird.

**Was du in deiner Verwaltung jetzt kannst:**

- **Heute:** Die Startseite zeigt dir auf einen Blick, was zu tun ist – Bestellungen zum Packen, offene
  Vorkasse-Zahlungen, Abholungen, neue Anfragen und Widerrufe – plus die letzten Bestellungen.
- **Neues Stück:** Fotos direkt mit dem Handy aufnehmen oder aus der Galerie wählen (werden automatisch verkleinert,
  Standortdaten fliegen raus), Kategorie antippen, Titel und Preis eingeben, „Online stellen“. Die Objektnummer wird
  dir vorgeschlagen und sofort geprüft („✓ frei“). Mit „Übersetzen → EN“ bekommst du einen englischen Vorschlag.
- **Meine Stücke:** alle Stücke mit Suche und Filter; „Bearbeiten“, „Offline verkauft“ (z. B. auf dem Flohmarkt)
  und ein Etikett als PDF.
- **Zu packen → Versendet:** Liste der bezahlten Bestellungen, Adresse kopieren, Packfotos und Checkliste, Packzettel
  und Beileger als PDF, dann die Sendungsnummer eintippen oder mit der Kamera scannen und „Versendet melden“ – die
  Kundin bekommt automatisch ihre Versandmail. Nach 10 Tagen gilt die Sendung von selbst als zugestellt.
- **Abholung:** „Bereit zur Abholung“ schickt der Kundin deinen Abholtext, „Abgeholt“ schließt die Bestellung ab.
- **Vorkasse offen:** sehen, wer noch überweisen muss und bis wann; „Zahlung erhalten“ verschickt die Rechnung.
- **Widerrufe** (zum Nachlesen) und **Anfragen** für Auftragsarbeiten (mit Bild, Status, Notiz und Antwort).
- **Texte:** deine Mail-Bausteine auf Deutsch und Englisch, deine Grußformel und fertige Vorlagen fürs Mailprogramm.
- **Einstellungen:** deine Daten, Steuer, Zahlung, Versand (EU-Versand erst nach fünf Häkchen), Produktsicherheit
  (hier legst du die Unterlagen je Kategorie ab – mit Vorlage als PDF), der **Umsatz-Wächter** (zeigt dir, wie nah du
  an der Kleinunternehmer-Grenze bist, und warnt rechtzeitig per Mail) und „System“ für die Technik.
- **Export:** pro Monat eine Tabelle und alle Rechnungen als ZIP für deine Steuerberatung, auf Wunsch auch als
  DATEV-Datei – nie mit Namen oder Adressen, nie mit Beispieldaten. Dazu die Jahresmengen der Verpackung für LUCID.
- **Erinnerungen per Mail an dich:** z. B. bei neuer Bestellung, Anfrage, Widerruf, einmal im Monat zum
  Monatsabschluss und zu den Produktsicherheits-Unterlagen.

**So schaust du dir die Vorschau-Datei an:** Die Datei „planet-claire-vorschau.html“ herunterladen und doppelklicken
(wie in Anleitung V0) – sie öffnet sich im Browser, ohne Internet. Unter „Verwaltung“ siehst du jetzt Bildschirmfotos
aller neuen Ansichten so, wie sie auf dem Handy aussehen (Heute, Neues Stück, Meine Stücke, Zu packen, Vorkasse,
Versendet, Abholung, Widerrufe, Anfragen, Texte, Einstellungen mit Produktsicherheit, Versand, Umsatz-Wächter und
System, Export). Nur „Tattoo“ steht dort noch als „kommt in P7“. Die Fotos sind Bilder – klicken kannst du darin nichts.

**Kleine Reparatur nebenbei:** Bei der Abnahme haben wir gemerkt, dass die Startseite nach einer Reservierung kurz
verschwinden konnte. Das ist behoben und wird jetzt automatisch geprüft.

**Was bis zum Start (P11) noch von dir kommt:** die Unterlagen zur Produktsicherheit hochladen, die DATEV-Konten mit
deiner Steuerberatung festlegen und deine echten Daten (Adresse, Bankverbindung, Telefon) eintragen – alles steht in
deiner Aufgabenliste.

## 2026-10-02 – P4 CI grün

- Phasenlauf `[ci:full p4]` (Commit aeef4fc): CI, CI full (e2e desktop/iphone-15/pixel-7, quality) und Vorschau-Export grün; Artefakt `planet-claire-vorschau-p4-aeef4fc`. Davor (6ec1f2c) war nur der Vorschau-Test rot, der noch den P3-Stand der Verwaltungsfotos erwartete – jetzt phasenunabhängig.

## 2026-10-01 – P4 Phasen-Abnahme (Korb, Kasse, Bezahlen) – für Jutta

**Was ist neu?** Man kann jetzt richtig einkaufen: Stück in den Korb, zur Kasse, bezahlen – bisher nur mit einer
Test-Zahlung, es fließt also noch kein Geld.

**Was du in der Vorschau-Datei jetzt siehst** (Datei herunterladen und doppelklicken, wie in Anleitung V0):

- **Korb:** Darin liegen als Beispiel die Schale Nr. 901 und das T-Shirt Nr. 911 – mit Foto, Preis, Versandkosten,
  Summe und dem Hinweis zur Umsatzsteuer. Du kannst zwischen Versand und Abholung in Berlin wählen.
- **Kasse:** alle Felder (E-Mail, Name, Adresse, bei Abholung die Rechnungsadresse), die Wahl zwischen Karte/PayPal
  und Vorkasse, die Übersicht direkt über dem Knopf „Zahlungspflichtig bestellen“ und die Häkchen-Frage beim T-Shirt
  mit der beschriebenen Besonderheit. Oben läuft eine Uhr ab 30:00 herunter: So lange ist ein Stück für eine Kundin
  reserviert, niemand anderes kann es in der Zeit kaufen. In der Vorschau-Datei läuft die Uhr nur zum Anschauen, und
  statt des Zahlungsfelds steht ein Platzhalter. Ein Klick auf „Zahlungspflichtig bestellen“ zeigt „Vorschau – hier
  wird nichts gekauft“ – es wird nichts gespeichert.
- **Danke-Seite und Bestellstatus** (die Seite, die Kundinnen über ihren Link sehen): Die zeigt die Vorschau-Datei ab
  Phase P8, wenn es die Beispielbestellungen gibt. In der Liste „Alle Seiten“ steht bei ihnen „noch nicht gebaut“.
- **Versand & Zahlung:** Die Seite mit allen Versandkosten, Lieferzeiten und Zahlarten.

**Was auf der echten Seite schon funktioniert** (geprüft mit einer Test-Zahlung, die sich wie Stripe verhält):

- **Bezahlen mit Karte, Apple Pay/Google Pay und PayPal:** Nach der Zahlung kommt die Danke-Seite mit Bestellnummer,
  deinen nächsten Schritten und dem Link zum Bestellstatus. Die Kundin bekommt sofort eine Bestätigungsmail mit
  Rechnung (als PDF) und den Rechtstexten, du bekommst eine Mail „Neue Bestellung“.
- **Wenn etwas schiefgeht:** Lehnt die Bank die Karte ab, sieht die Kundin eine Meldung und kann es noch einmal
  versuchen oder auf Vorkasse wechseln. Bricht sie bei PayPal ab, führt „Zurück zur Kasse“ sie wieder hinein – ihre
  Eingaben sind noch da. Dauert die Bestätigung länger, wartet die Danke-Seite kurz und zeigt dann „bezahlt“.
- **Vorkasse:** Die Kundin sieht deine Bankdaten, den Verwendungszweck (die Bestellnummer), die Frist und einen
  QR-Code für die Banking-App; das steht auch in ihrer Mail. Sobald das Geld da ist, klickst du in der Verwaltung bei
  der Bestellung auf „Zahlung erhalten“ – dann bekommt sie ihre Rechnung. Kommt nichts, erinnert die Seite sie einmal
  und storniert nach Ablauf der Frist.
- **Nie doppelt verkauft:** Wollen zwei Leute gleichzeitig dasselbe Stück kaufen, bekommt nur eine die Kasse; die
  andere sieht „gerade reserviert – schau in 30 Minuten nochmal“. Läuft die Reservierung ab, ist das Stück wieder frei.
- **Datenschutz:** Erst mit „In den Korb“ speichert die Seite ein kleines Korb-Cookie, mit „Zur Kasse“ ein zweites für
  die Kasse – vorher nichts. Nach der Bestellung löscht die Danke-Seite beide. Keine Verbindung zu fremden Diensten;
  Stripe wird später nur auf der Kasse geladen.

**Was du in P11 (Start-Tag) dafür erledigst** (Liste in deinen Aufgaben):

- **A23** Stripe-Konto verifizieren (Ausweis, IBAN, Steuernummer – gibst du selbst ein; kann ein paar Tage dauern).
- **A24** PayPal in Stripe verbinden (geht erst nach A23).
- **A26** Stammdaten und Bankverbindung für die Vorkasse bereitlegen (Name, Adresse, IBAN, Abhol-Infos).
- **A33** Konten verbinden und Schlüssel sicher hinterlegen – dabei auch die Stripe-Schlüssel.
- **A38** Stripe live schalten – ab dann fließt echtes Geld.
- Danach machen wir zusammen einen echten Testkauf mit Widerruf und Erstattung (**A39**).

**Noch offen (Platzhalter bis P11):** deine echte Bankverbindung (bis dahin eine Beispiel-IBAN), die Rechtstexte der
Kanzlei und die Frage an die Kanzlei, ob die Rechnungsadresse bei Abholung Pflicht sein muss (so ist es jetzt
eingestellt).

## 2026-10-01 – P4.25

- Qualitätsgates P4: `@privacy` (R06–R09, R25), Header je Kontext, axe, AK-DS-11, JS-Budget R06/R07 (R07 mit Kasse 170 KB gz nach `zod/mini`, R02 Zier-Module nach dem Laden), CLS, Logger-Schwärzung nach Kassen-Durchlauf, Verbotsmuster über P4-Seiten und Mails, Statusliste nur `ORDER_STATUSES`.
- Abdeckung (`pnpm test:coverage`): commerce 93,4 % Zeilen / 85,1 % Zweige, payments 96,4 % / 89,2 %.
- Visuelle Referenzen Korb, Kasse, Danke, Status (lokal gegen Produktions-Build, Suite seriell wie CI; CI-Artefakt hier nicht abrufbar).
- Vorschau-Datei: Korb (S01 + S11) und Kasse je Sprache mit Zahlungsfeld-Platzhalter, Demo-Countdown ab 30:00, Vorschau-Dialog statt Bestellen, nichts gespeichert; Danke/Status „ab P8“. Crawler wartet vor „In den Korb“ auf den Live-Zustand (sonst unter Last leerer Korb); SVG-Fragmente in CSS-Daten-URIs bleiben intakt.
- Tests: `pnpm check` (1332 Unit), `pnpm test:int` (73 Dateien, 599 Tests inkl. Determinismus des Exports), `pnpm build`, `pnpm test:preview-export` 28/28, visual 42/42 (3×), E2E desktop 526/0 rot, iphone-15 (WebKit) 402/0, pixel-7 394/0, @perf pixel-7 8/8, `check:bundle`, `check:external`.

## 2026-09-29 – P4.24

- Kaufpfad Ende-zu-Ende mit Mock unter `tests/e2e/purchase/` (nur `iphone-15` und `pixel-7`; `desktop` ignoriert den Ordner): Produktseite → „In den Korb“ → Korb → „Zur Kasse“ → Kasse → Danke in 4 Seiten (EK-02) für Karte mit Versand, Wallet (Mock Apple Pay) mit Abholung, PayPal „Abbruch“ → „Zurück zur Kasse“ → „Erfolg“, „Abgelehnt“ → erneuter Versuch, „Abgelehnt“ → Vorkasse (genau eine Bestellung `awaiting_prepayment`), „Verzögert“ → wartet → Testhilfe setzt die Session auf bezahlt → „bezahlt“ (Rückfall `getCheckoutSession`), Vorkasse mit Versand → Verwaltung „Zahlung erhalten“ → M05, Abholung mit Vorkasse (Rechnungsadresse Pflicht).
- Reservierung: Countdown-Ablauf mit `page.clock` → „Nochmal reservieren“ legt eine neue Kasse an (alte `cancelled`); zwei Käufer:innen in zwei Kontexten gleichzeitig „Zur Kasse“ → genau eine Kasse, die andere „gerade reserviert“, nach Ablauf der ersten kauft die zweite (EK-03). Die Server-Uhr läuft echt – Abläufe setzen die Zeitpunkte in der Test-DB zurück.
- Je Fall: keine Bestellung vor der Zahlung bzw. dem Vorkasse-Klick, nur Kassen `cancelled`/`expired` bei Abbruch/Ablauf, Mails im Datei-Treiber (`readOutbox`), keine Konsolenfehler, keine CSP-Verstöße. AK-3-10: geänderter Klassenpreis gleich auf R25, im Korb und in einer neuen Kasse (einmal je Lauf, `pixel-7`, Lock exklusiv).
- `@smoke`: Kartenkauf und Vorkassekauf (laufen in `ci.yml` auf `iphone-15`). Stripe-Testmodus (`stripe-testmode.e2e.spec.ts`, `@stripe`) angelegt, läuft nur mit `PAYMENTS_DRIVER=stripe` und `sk_test_`-Schlüssel – hier übersprungen (OFFENE-PUNKTE).
- Tests: 22 E2E grün (11 × iphone-15 WebKit/pixel-7, Produktions-Build), Reservierungs-Suite 3× wiederholt stabil; `pnpm check` grün.
## 2026-10-02 – P5.29

- Verwaltung als Web-App: ADMIN_ROUTE/manifest.webmanifest, ADMIN_ROUTE/sw.js (ohne Cache, ohne Push), Icons 192/512 maskierbar + Apple 180 auf Matte-Grün (pnpm art:admin-icons, src/admin/pwa/, ausgeliefert unter ADMIN_ROUTE/pwa/…); Manifest-Link und Registrierung nur in der Verwaltung\n- /manifest.webmanifest, /sw.js, /admin/… → 404 (Startseite: dynamicParams = false); Verwaltungspfad nicht in public/ und .next/static (check:external)\n- Tests: tests/unit/admin/sw.unit.spec.ts (4), tests/e2e/admin/pwa.e2e.spec.ts (AK-7-06 per CDP Page.getInstallabilityErrors, T-04)

## 2026-10-02 – P5.28

- Start-Ansicht „Heute“ (/heute und ADMIN_ROUTE): Kacheln Zu packen, Vorkasse offen (davon heute fällig), Abholung, Widerrufe offen (nächste Frist), Neue Anfragen; Hinweise rot/gelb mit Link (Umsatz-Wächter, Rechtstexte-Prüfung je Typ, adminAttention an Stück/Bestellung, Aufbewahrungssperren ≥ 6 Monate, fehlgeschlagene Mails/Jobs 24 h, Anfechtungen, Abholung > 14 Tage, fehlende Monatssummen Vormonat, Kostenwarnung ≥ Schwelle, Beispieldaten), Startklar-Platzhalter, letzte 5 Bestellungen, Schnellknopf „Neues Stück“\n- Dienst getTodaySummary(now, payload) in src/lib/admin/today.ts; Regel legalHoldReviewDue für P6.15\n- Tests: tests/int/admin/today.int.spec.ts (6), tests/e2e/admin/today.e2e.spec.ts (Heute + Texte, desktop/pixel-7, axe, 390 px)

## 2026-10-02 – P5.27

- Ansicht „Texte“ (/texte): Seiten/FAQ (kommt in P8), Rechtstexte (kommt in P6), Mail-Bausteine DE/EN mit Übersetzen (Signatur, Abhol-Vorlage, Antwortzeit-Satz; Bereich mailTexts im Einstellungs-Endpunkt, schreibt settings + site-texts), Vorlagen fürs Mailprogramm mit Bestellnummer, mailto: und Kopieren\n- src/lib/legal/templates.ts: 4 Arbeitsfassungen (Bruch/Fotos mit Reklamationsfrist für Jutta = Versanddatum + 7 Tage, Reparatur/Ersatz, § 37 VSBG, Bitte um IBAN)\n- Signatur aus site-texts.emails.signature steht jetzt unter allen Kund:innen-Mails (closingBlock)\n- Tests: tests/unit/legal/admin-templates.unit.spec.ts (13), tests/int/email/signature.int.spec.ts (3)

## 2026-10-02 – P5.25

- DATEV-Knopf in /export: ausgegraut mit Hinweis „Konten mit der Steuerberatung festlegen“ und fehlenden Feldern, mit Konten als Download\n- Tests: e2e export, int datev-export grün

## 2026-10-02 – P5.24

- Ansicht /export: Monatsauswahl (25 Monate), Monats-CSV und Rechnungs-ZIP als Download, Jahresauswahl Verpackung\n- Tests: e2e export (desktop/pixel-7) grün; int monthly-export bestehend

## 2026-10-02 – P5.22a

- Bereiche Shop (inkl. Übersetzen, Go-live-Sperre in Produktion), Kosten, Vorlagen, Steuer-Bestätigung + Jahressummen, Statistik (R-132), Rechtstexte über POST /api/globals/settings/area (DE+EN in einer Transaktion)\n- Umsatz-Wächter-Ansicht (/einstellungen/umsatz-waechter, P5.23): Balken, Monatstabelle, Monatssummen-Eingabe, Jahressummen, Verlauf, Hinweissatz\n- Tests: int settings-part3 (7), e2e settings-part3 (2) grün

## 2026-10-02 – P5.22

- Einstellungen → Versand (/einstellungen/versand): Lieferländer mit EU-Sperre (fünf Häkchen, „EU-Versand geprüft“ mit Datum, R-202), Tarife, Lieferzeit DE/EN, Abholung, Sendungsverfolgung, Checklisten, Verpackungsvorlagen, Jahressumme\n- isOrderableInCountry: lebensmittelechte Keramik nicht nach NL/LU (computeShipping/Summen, Absenden der Kasse)\n- Beispieldaten-Anzahl (Entfernen in P8); System (/einstellungen/system): Version, APP_ENV, Job-Wecker, Jetzt ausführen, Lauf-Protokoll 90 Tage, fehlgeschlagene Mails erneut senden, Webhooks\n- Tests: int eu-activation (3), e2e settings-system (3 × desktop/pixel-7) grün

## 2026-10-01 – P5.21

- Ansicht „Einstellungen“ Teil 1 (/einstellungen): Stammdaten & Impressum (Postfach abgelehnt R-020, Telefonformat R-021, Steuernummer „nie öffentlich“), Steuer (neuer Modus mit „gilt ab“, Aufbewahrung 8/10 mit K-33-Rückfrage, Audit retention_setting_changed), Zahlung (IBAN mod 97, BIC, Anbieter-Anzeige), Benachrichtigungen, Rechtstexte „kommt in P6“, Konto (Passwort ≥ 12, Abmelden); Speichern je Bereich mit Audit settings_changed (maskiert).
- Tests: tests/unit/payments/iban.unit.spec.ts (3), tests/int/legal/business-profile.int.spec.ts (6, R-020, R-021), tests/e2e/admin/settings.e2e.spec.ts (390×844, axe).

## 2026-10-01 – P5.20

- Ansicht „Anfragen“ (/anfragen, /anfragen/:id): Liste mit „wird gelöscht am“, Detail mit Referenzbildern über die angemeldete Dateiroute, Notizen, Status-Knöpfe nach INQUIRY_TRANSITIONS (src/lib/inquiries/transitions.ts, Audit inquiry_status_changed, lastActivityAt statt deleteAfter), „Antworten“ per mailto je Sprache, „Jetzt löschen“ (Anfrage + Bilder, Audit inquiry_deleted, deletion-log ADMIN/admin).
- Tests: tests/int/inquiries/admin.int.spec.ts (4, AK-5-01 Anfrage, AK-10-04), tests/e2e/admin/inquiries.e2e.spec.ts.

## 2026-10-01 – P5.19

- Ansicht „Widerrufe“ (/widerrufe, /widerrufe/:id), nur lesend: WR-Nummer, Eingang (Berlin), Name, Bestellung bzw. „nicht zugeordnet“, Kanal, Status, „erstatten bis“ (Eingang + 14 Tage, ab Tag 10 rot); Detail mit unveränderlicher Erklärung, Bestellung mit Positionen und Zahlart, Notizen separat speicherbar (POST /api/withdrawals/:id/notes); Aktionen „Bearbeitung ab P6“.
- Tests: tests/int/withdrawals/notes.int.spec.ts (3, inkl. DM-WDR-03), tests/e2e/admin/withdrawals-list.e2e.spec.ts.

## 2026-10-01 – P5.18

- Ansicht „Vorkasse offen“ (/vorkasse): Frist „noch X Tage bis Storno“ (letzter Tag rot), Erinnerung, Bankdaten kopieren; „Zahlung erhalten“ (O3, Betrag Pflicht, Abweichungs-Warnung) → paid, Rechnung RE, M05; „Stornieren“ (O4, Grund Pflicht) → M04; „Kürzlich automatisch storniert“ mit „Nachträglich bezahlt“ (O5, 409 wenn ein Stück weg ist, sonst Hinweis „bitte Geld zurücküberweisen“).
- Tests: tests/int/orders/prepayment-admin.int.spec.ts (R-071, 2), AK-8-02 grün (tests/int/jobs/prepayment-deadlines.int.spec.ts), tests/e2e/admin/prepayment.e2e.spec.ts (Desktop + Pixel 7).

## 2026-10-01 – P5.17

- Ansicht `/abholung`: bezahlte Abholungen und abholbereite mit Wartetagen (> 14 markiert); „Bereit zur Abholung“ mit vorbelegtem Text (settings.pickup.instructions + Adresse aus settings.business, editierbar, gespeichert in pickup.messageText) → O8 + M07; „Abgeholt“ → O9
- `src/lib/legal/periods.ts`: withdrawalPeriodEnd (Erhalt + 14 Tage, Ende Berliner Tag), warrantyStart
- Tests: tests/int/legal/pickup.int.spec.ts (6, R-083/R-102, Snapshots M07 DE/EN), tests/e2e/admin/pickup.e2e.spec.ts (desktop + pixel-7)

## 2026-10-01 – P5.16

- Ansicht `/versendet`: shipped + delivered (30 Tage) mit Versanddatum, Nummer als Link, Status, „geschätzt“; Knöpfe Zugestellt (O10 manual), Sendungsnummer korrigieren/nachtragen (Rückfrage „Versandmail erneut senden?“ ja/nein), Reklamation (Bruch) → Texte
- Endpunkte `delivered`, `tracking`; Task `markDelivered` (commerce, täglich ab 03:00 Berlin, ≥ 10 Kalendertage, auto, ohne Mail), Migration p5_mark_delivered_job; Tick führt Jobs jetzt nacheinander aus (Pool-Erschöpfung bei 8 Wecker-Tasks)
- Tests: tests/int/jobs/mark-delivered.int.spec.ts (3, AK-8-01), tests/e2e/admin/shipped.e2e.spec.ts (desktop + pixel-7)

## 2026-10-01 – P5.14

- Scan-Baustein `src/admin/components/TrackingScanner.tsx`: Kamera erst nach Tipp, natives BarcodeDetector (Code 128/39, ITF, Data Matrix, Rückkamera), sonst Foto (`capture=environment`) über `@zxing/browser` als dynamischer Chunk nur in der Versand-Ansicht; Texteingabe bleibt
- Pakete exakt gepinnt: @zxing/browser 0.2.1, @zxing/library 0.23.0, bwip-js 4.11.4 (dev), ARCHITEKTUR §1.2; Fixtures `pnpm fixtures:barcodes` → tests/fixtures/barcodes/*.png (mit zxing-Selbstprüfung)
- Tests: tests/e2e/admin/tracking-scan.e2e.spec.ts (Foto-Rückfall ohne BarcodeDetector, zxing-Chunk nicht auf /heute, keine fremden Hosts; desktop + pixel-7)

## 2026-10-01 – P5.15

- `POST /api/orders/:id/ship` reiht M06 (`order_shipped`, DE/EN) in derselben Transaktion ein, Schlüssel `order_shipped:<id>:<Nummer|none>`, direkt nach dem Commit zugestellt; Brief ohne Nummer ohne Verfolgungslink
- Vorlage `src/lib/email/templates/fulfillment.tsx` (Positionen, Versanddienst, Nummer, Link, „meist 1–3 Werktage“, Baustein email.shipping.damageNotice „unberührt“); „Erneut senden“ für M06/M07 in resendEmail.ts; Dialogtexte „mit/ohne Sendungsnummer“
- Tests: tests/unit/legal/shipping-mail.unit.spec.ts (7, Snapshots DE/EN mit/ohne Nummer), tests/int/orders/ship.int.spec.ts (4), tests/e2e/admin/ship-order.e2e.spec.ts (AK-7-05, 4 Taps, desktop + pixel-7)

## 2026-10-01 – P5.13

- Einstellungen → „Produktsicherheit“ (`/einstellungen/produktsicherheit`): Unterlagen je Kategorie mit Frist, Hinweis „Technische Unterlagen fehlen“, Hochladen nur PDF (Kennung %PDF- im Browser und am Server), Beispiel-Kennzeichen
- Vorlage `GET /api/admin/compliance/template.pdf?category=` (Gliederung, keine Rechtsberatung); `technical_file` nur mit Kategorie und als PDF
- Task `complianceDocsReview` (maintenance, monatlich am 1. ab 08:10 Berlin, runOncePer mit Minute): A16 mit fehlenden Kategorien und löschbaren Unterlagen, ohne Beispieldaten; Migration p5_compliance_docs_job
- Tests: tests/int/legal/compliance-docs.int.spec.ts (5, inkl. T-15-Erweiterung), A16-Unit/Snapshot, Registry/Slugs-Unit

## 2026-10-01 – P5.12

- Packzettel (src/lib/pdf/PackingSlip.tsx, ohne Preise, Beileger je Stück mit Herstellerin, Warn-/Pflegehinweisen, EN zusätzlich bei EN-Bestellungen) und Etikett/Beileger (src/lib/pdf/ProductLabel.tsx mit QR-Code zur Produktseite, „Nur Deko – nicht für Lebensmittel“); nur lokale Schriften
- Endpunkte GET /api/orders/:id/packing-slip.pdf und GET /api/products/:id/label.pdf (nur Verwaltung); Knöpfe in „Zu packen“, Bestell-Detail und „Meine Stücke“
- Tests: tests/int/pdf/packing-slip.int.spec.ts (3), tests/int/legal/gpsr-label.int.spec.ts (2) grün; pnpm check, test:int (89 Dateien), build grün

## 2026-10-01 – P5.11

- Checkliste je Versandklasse + Punkte für alle Sendungen (packingChecklistState), Verpackung vorbelegt aus settings.packaging (Vorlage, Material, Gramm änderbar; Wertkopie mit „Gepackt“ bzw. „Versendet melden“), Packfotos über die Kamera (privat)
- „Versendet melden“ (O7, POST /api/orders/:id/ship) mit Verpackungs-Pflicht und Rückfrage „Ohne Packfoto versenden?“ (Audit packing_photo_skipped); M06 folgt in P5.15
- Jahres-Export GET /api/admin/packaging-report?year=JJJJ (ohne Beispieldaten/Abholungen), Download unter /export, Jahressumme unter Einstellungen → Versand; Owner-Aufgabe A52 (Verpackungen wiegen)
- Tests: tests/int/legal/packaging-report.int.spec.ts (4), tests/int/legal/transport-risk.int.spec.ts (4), tests/e2e/admin/packing-photos.e2e.spec.ts grün

## 2026-10-01 – P5.10

- Ansicht „Zu packen“ /packen: paid/packed mit Versand (älteste zuerst; Widerruf vor dem Versand mit Hinweis), Karte mit Fotos, Nr., Versandklasse, Name/Ort und Hinweisen wörtlich laut KONZEPT §7.6
- formatShippingAddress() (src/lib/commerce/address.ts) + virtuelles Feld copyAddressText; „Adresse kopieren“ mit Kopier-Symbol je Zeile; „Einwilligung widerrufen“ (consent-log withdrawnAt + Widerrufs-Eintrag, Audit); „Gepackt“ = O6
- Tests: tests/unit/legal/address-formatter.unit.spec.ts (4), tests/int/legal/packing-hints.int.spec.ts (5), tests/e2e/admin/packing.e2e.spec.ts (Desktop, Pixel 7) grün

## 2026-10-01 – P5.9

- Bestell-Detail /bestellungen/:id (Positionen mit Foto, Nr., Preis; Lieferung, Zahlart, Beträge, Statusverlauf, Hinweise inkl. Anfechtung, interne Notiz, Mail-Protokoll) und Aktions-Rahmen src/endpoints/orders/_action.ts (Admin-Pflicht, eine Transaktion, ORDER_TRANSITIONS → 409, Historie actorType admin + O-Nummer, Audit, Mails nur über die Outbox)
- „Erneut senden“ M01/M02/M05 (M06/M07 mit P5.15/P5.17) mit Dialog-Schlüssel: ein Dialog = höchstens eine Mail
- Tests: tests/int/orders/admin-action.int.spec.ts (4), tests/e2e/admin/order-detail.e2e.spec.ts (Desktop + 390×844, axe) grün

## 2026-09-29 – P5.8

- Ansicht „Meine Stücke“ (`/stuecke`): Suche nach Nummer (exakt, auch „017“) oder Titel, Filter Status/Kategorie, 20 Karten je Seite, Status-Badge mit Reservierungs-/Vorkasse-Hinweis, Knöpfe je Status auf die P5.7-Endpunkte, Dialog „offline verkauft“ mit Archiv-Schalter, „Zur Bestellung“, „Im Archiv zeigen“.
- Tests: pieces-query.int; E2E pieces (Produktions-Build: offline verkauft → nicht mehr in „nur verfügbare“, im Archiv mit Stempel ≤ 5 s; Schalter aus → in keiner Liste; Mini-Satz unverändert; axe 390×844) grün.

## 2026-09-29 – P5.6

- Handy-Formular „Neues Stück“/„Stück bearbeiten“ (`src/admin/views/pieces/`): Felder je Kategorie mit Vorlagen, Nummernvorschlag + Live-Prüfung `GET /api/products/item-number-status`, Preis per `parseEuroInput` (1–10.000 €), „Als Entwurf speichern“, Vorschau unter `/stuecke/:id/vorschau` (ohne Draft-Mode-Cookie), „Online stellen“ mit Liste „Das fehlt noch:“ und Sprunglinks, Erfolgsseite mit Link/Kurzlink kopieren.
- REST-Fehler behalten ihre Feldliste (globaler afterError-Hook `src/lib/payload/validationErrorResponse.ts`), damit das Formular deutsche Feldhinweise zeigt.
- Tests: parse-euro.unit, validation-error-response.unit, item-number.int; E2E new-piece (EK-08 ≤ 10 Eingaben, AK-7-01, AK-7-03) und shell grün (desktop, pixel-7).

## 2026-09-29 – P5.5

- Foto-Baustein `src/admin/components/PhotoPicker/`: „Foto aufnehmen“ (capture) und „Aus Galerie wählen“ (mehrere), Verkleinerung im Browser auf ≤ 2560 px (JPEG 0,85), ein Bild je Upload (≤ 4,5 MB), 1–12 Fotos mit Hinweis unter 2, Hoch/Runter per Tastatur, Titelbild, Fokuspunkt, Entfernen, Vorschlag für Bildbeschreibungen.
- Tests: resize.unit; E2E photo-picker (desktop, pixel-7 bei 390×844): 6000×4000 → ≤ 2560 px, kein GPS in allen Größen, 13. Foto abgelehnt, Reihenfolge/Titelbild gespeichert.

## 2026-09-29 – P5.4

- Knopf „Übersetzen → EN“ als allgemeine Admin-Komponente `src/admin/components/TranslateButton.tsx` (Rückfrage vor dem Überschreiben = `force`, in Produktion ohne DeepL gesperrt mit Hinweis); im Formular „Neues Stück“ eingebaut (füllt auch die EN-Bildbeschreibungen).
- Dienst, Treiber und Endpunkt stammen aus dem vorigen P5.4-Commit.
- Tests: translation.contract.int, lexical.unit, products/translate.int grün; E2E new-piece (Übersetzen-Schritt) grün.

## 2026-09-29 – P5.1

- Ansichten-Registry src/admin/views/registry.ts (13 Ansichten + 4 Detailpfade, Titel, Phase, Aufgabe, Symbol, Rückfall „Alle Daten“) als Payload-Custom-Views; ADMIN_ROUTE zeigt „Heute“; Platzhalter bis zur jeweiligen Aufgabe, /tattoo „kommt in P7“; Anmeldeprüfung in der View\n- Navigation: Seitenleiste (beforeNavLinks) mit allen Ansichten vor „Alle Daten“, Handy-Leiste unten „Heute · Neues Stück · Packen · Mehr“ (Mehr öffnet das Menü)\n- Bausteine ActionButton (Doppeltipp-Sperre, Dialog-Pflicht per Typ), ConfirmDialog, StatusBadge, CopyButton (Rückfall), Notice (aria-live), postAdminAction; Endpunkte liefern { unchanged: true } bei erreichtem Zielzustand\n- Mail-Direktlinks auf Registry-Pfade; Vorschau-Liste aus der Registry; Lösch-Recht für veröffentlichte Stücke/Rechtstexte entzogen\n- Tests: unit registry (7) + components (9), int admin/shell (2) + transitions-Matrix angepasst, E2E admin/shell (desktop + pixel-7, @a11y) grün; pnpm check, test:int, build grün

## 2026-09-29 – P5.26

- Tasks `monthlyClose` (documents) und `invoiceIntegrityCheck` (maintenance), monatlich am 1. ab 04:00 Berlin über `runOncePer`; Monats-CSV + Rechnungs-ZIP privat (`monthly_export`, L-07), A11 mit Summen und fehlenden Monatssummen, je Monat einmal; Belegprüfung → A12 mit Belegnummern
- R-122: `putIfAbsent` im Speicher-Adapter, Beleg-PDFs unter `private/invoices/{JJJJ}/{Nummer}.pdf` nur, wenn nicht vorhanden; Migration `p5_monthly_close_jobs` (Task-Enum)
- Tests: `tests/int/legal/invoice-integrity.int.spec.ts` (5, R-122 local/s3/Manipulation/fehlend), `tests/int/jobs/monthly-close.int.spec.ts` (2, AK-8-01); gesamte Int-Suite ohne Vorschau-Export grün (79 Dateien)

## 2026-09-29 – P5.3

- Lauf-Protokoll `job_runs` (Migration `p5_job_runs`, CHECK + Index laut DATENMODELL §11), Einträge je Task-Lauf inkl. „Jetzt ausführen“, Fehler geschwärzt (R-137); Fehlschlag in commerce/documents → A12 über `notifyAdmin`
- Tick unter Advisory-Lock `tick` (parallele Ticks → genau ein Lauf), `POST /api/cron/run/[task]` jetzt 501 für spätere Phasen; `runOncePer(task, 'day'|'month', Stunde, now)` (Berliner Datum/Monat, sommerzeitfest); `GET /api/health/freshness` ohne DB (jobs/backup ok|late|off, 60 s Cache, Wartungsmodus 200)
- Tests: `tests/int/jobs/cron.int.spec.ts` (7), `run-once.int.spec.ts` (5, 29.03./25.10.2026), `tests/int/health/freshness.int.spec.ts` (5), `tick.int.spec.ts` angepasst, `tests/unit/jobs/slugs.unit.spec.ts`; jobs/email/commerce/payments/db-Int grün (212)

## 2026-09-29 – P5.2

- Verwaltungs-Mails A04, A05, A10, A11, A13–A16 neu (`src/lib/email/templates/admin/`: records, reminders; A01–A09/A12 dorthin verschoben), strikte Schemata (A05 ohne Name/E-Mail/Freitext/Bilder, R-160)
- `ADMIN_MAILS` in `src/lib/email/registry.ts`: A01–A17 → Schlüssel laut DATENMODELL §4; Dienst `notifyAdmin` (`src/lib/email/notifyAdmin.ts`), A01–A03, A06–A09 darauf umgestellt
- Tests: `tests/unit/email/admin-templates.unit.spec.ts` (26, Snapshots A01–A17, AK-6-03), `tests/int/email/notify-admin.int.spec.ts` (6, Rückfall ADMIN_NOTIFY_EMAIL, A12-Drosselung mit vorgestellter Uhr); Lint-Test: ESLint-Aufwärmen im beforeAll (Timeout unter Last)

## 2026-09-29 – P5.7

- Statusautomat der Stücke mit KONZEPT §5.1 abgeglichen: P3/P12 jetzt auch mit Prüfung „keine aktive Reservierung“ (nicht abgelaufene Reservierung → 409); DATENMODELL §6.6.7-Diagramm um P6 ergänzt\n- Tests: tests/int/products/transitions.int.spec.ts (AK-5-01 Matrix als reine Funktion und über alle Admin-Endpunkte inkl. Löschen P15, AK-5-02 Audit mit Auslöser, Erstattungsgründe breakage/admin_cancellation/goodwill), tests/int/legal/offline-sale.int.spec.ts (R-127: keine Bestellung/Rechnung/Umsatz, Vorkasse → 409) – 16 Tests grün; status.int.spec.ts weiter grün

## 2026-09-29 – P5.25 (Dienst und Endpunkt; Knopf in der Ansicht `/export` offen)

- `src/lib/export/datev.ts`: Buchungsstapel EXTF 700/21 je Monat (Kopfzeile mit Berater-/Mandantennummer, WJ-Beginn, Zeitraum; je Beleg eine Buchung, Stripe-Gebühren eigene Buchungen; Buchungstext ohne Personendaten; nie Beispieldaten), Windows-1252. `datevConfigStatus` prüft `settings.export.datev.*` (Schema seit P1, unverändert) für den ausgegrauten Knopf („Konten mit der Steuerberatung festlegen“).
- `GET /api/admin/export/{JJJJ-MM}.datev.csv`: ohne Konten 409 mit fehlenden Feldern; Annahmen zu Kodierung/Feldern in OFFENE-PUNKTE; AUFGABEN A51 ergänzt.
- Offen: ausgegrauter Knopf mit Hinweis in der Ansicht `/export` (P5.24-Ansicht) – Aufgabe deshalb noch nicht abgehakt.
- Tests: `tests/int/legal/datev-export.int.spec.ts` (3, „R-124 DATEV …“: 409 ohne Konten, byte-genau gegen `tests/fixtures/csv/2026-10.datev.csv`, zweiter Export identisch, kein `BSP-`/`@`/Name, Windows-1252).

## 2026-09-29 – P5.24 (Dienste und Endpunkte; Ansicht `/export` offen)

- `src/lib/export/monthlyCsv.ts`: `planetclaire-{JJJJ-MM}.csv` (UTF-8 mit BOM, `;`, CRLF, Dezimalkomma, `TT.MM.JJJJ`, nach Belegnummer) mit den 15 Spalten aus KONZEPT §7.15; Belege aus `src/lib/export/documents.ts` (nur Serien RE/GS, nie `seed = true`, keine Personendaten geladen); Gebühren/Auszahlungen über `payments.listBalanceTransactions` (Mock: Fixtures).
- `src/lib/export/invoiceZip.ts`: Rechnungs-ZIP mit `fflate` 0.8.2 (ARCHITEKTUR §1.2) – alle RE/GS-PDFs als `{Nummer}.pdf` plus CSV, fester Zeitstempel → byte-identisch; fehlende PDFs → 409.
- Admin-Endpunkte `GET /api/admin/export/{JJJJ-MM}.csv` und `.zip` (`src/endpoints/export.ts`, nur Verwaltung, `private, no-store`).
- Offen: Ansicht `/export` (Monats- und Jahresauswahl) und `tests/e2e/admin/export.e2e.spec.ts` – Aufgabe deshalb noch nicht abgehakt.
- Tests: `tests/int/legal/monthly-export.int.spec.ts` (6, R-124: byte-genau gegen `tests/fixtures/csv/2026-10.csv`, zweiter Export identisch, kein `BSP-` auch mit `SEED_PREVIEW_MODE=true`, kein `@`/Name, ZIP genau die Belege, Endpunkte 401/200/404/409).

## 2026-09-29 – P5.23

- Reine Rechnung `computeRevenueStatus` (`src/lib/revenue/guard.ts`): Shop = Rechnungen − Gutschriften nach Berliner Belegmonat, plus Monatssummen (inkl. Auftragsarbeiten) und Jahressummen vor dem Shop; Stufen U0–U5 aus `settings.revenueGuard`; Beispieldaten nur bei `seedPreviewModeActive()`.\n- Task `revenueGuardCheck` (Migration `p5_revenue_guard`): A09 `admin_revenue_guard` genau einmal je Stufe und Jahr (`lastNotified` + Idempotenz-Schlüssel), eingereiht vom Job-Wecker ab 07:00 Berlin und nach jedem neuen Beleg bzw. jeder Änderung einer Monatssumme.\n- Offen (UI): Ansicht Einstellungen → Umsatz-Wächter (Balken, Monatstabelle, Eingaben, Verlauf) und Hinweis unter „Heute“ – Daten liefert `getRevenueStatus`.\n- Tests: unit `tests/unit/legal/revenue-guard.unit.spec.ts` (10), A09-Mail + Snapshot; int `tests/int/jobs/revenue-guard.int.spec.ts` (4); invoices/jobs/collections/commerce-Int grün.

## 2026-09-29 – P4.10

- Übersicht unmittelbar über dem Knopf (KONZEPT §4.5, R-063): Positionen aus dem Kassen-Snapshot (Foto 48×60, Titel, Nr., Eigenschaften, Preis), Versand mit Klasse, Gesamt mit Steuerhinweis, Lieferzeit, live Lieferadresse/Rechnungsadresse/E-Mail/Zahlart (bei Vorkasse Frist + „ab Zahlungseingang“), vier „Ändern“-Links (Anker + Fokus aufs erste Feld). Baustein `checkout.legalNotice` mit AGB/Widerrufsbelehrung/Datenschutz als `<dialog>` (ohne JavaScript normale Links) + `withdrawal.returnCostsNote`; je Stück mit Abweichung eine eigene Pflicht-Checkbox, Knopf `disabled` mit Hinweis; Knopf exakt „Zahlungspflichtig bestellen“ / „Order with obligation to pay“ (KO-11 ruhig), Statuszeile `aria-live`, PayPal-Zeile bei Stripe.\n- Tests: tests/e2e/checkout/overview.e2e.spec.ts (R-063, R-064, R-048, S8 „Abgelehnt“, R-137 „Erfolg“ → /de/danke/<Token> ohne Eingaben in der URL), tests/e2e/checkout/legal-dialogs.e2e.spec.ts – desktop, iphone-15, pixel-7 grün.

## 2026-09-29 – P4.9

- Kasse R07 `/de/kasse` (src/app/(frontend)/[locale]/checkout/page.tsx): dynamisch, CSP-Kontext `checkout`, ohne gültiges `pc_checkout` bzw. bei beendeter Kasse 307 auf den Korb mit Hinweis. Fünf Abschnitte mit Ankern, Felder nach KONZEPT §4.4 (ein Namensfeld, Rechnungsadresse bei Abholung immer Pflicht, DHL-Einwilligung nicht angehakt, kein Telefon-/Firmen-/Anredefeld), gemeinsames zod-Schema, Fehlerzusammenfassung mit Sprunglinks, Datenschutz-Link, `autocomplete`. Zahlungsfeld: MockPaymentField (Testmodus, Erfolg/Abgelehnt/Abbruch/Verzögert + Test-Zahlart), StripePaymentField (nur bei `stripe`, lazy, `@stripe/stripe-js/pure`), Platzhalter bei `PREVIEW_EXPORT`; S13 nur Vorkasse; Instagram-Hinweis.\n- Countdown KO-15: Verhaltensmodul `reservation-countdown` (Schwellen 5:00/1:00, Ansagen 10/5/1 min + Ablauf, „Nochmal reservieren“, Bestellknopf gesperrt), auch im Korb nur bei eigener laufender Reservierung (V-17). R07 in der Registry „gebaut“.\n- Tests: tests/e2e/checkout/checkout-form.e2e.spec.ts (10), tests/e2e/legal/checkout-fields.e2e.spec.ts (3), cart.e2e.spec.ts (+V-17), tests/unit/behaviors/reservation-countdown.unit.spec.ts (9) – desktop, iphone-15, pixel-7 grün; security-headers.e2e an die 307-Antwort der Kasse angepasst.

## 2026-09-29 – P4.10b

- `changeCheckoutDelivery` (src/lib/commerce/changeDelivery.ts): Versand und Summen neu aus `settings.shipping.rates`, Reservierung bleibt; Session per `updateShipping`, bei `recreate_required` neu mit derselben Reservierung und `sessionSeq + 1` (Rückfall: keine Session → nur Vorkasse). `reopenCheckout` (`confirming → open`, S8).\n- Mock-Wege in src/lib/commerce/mockConfirm.ts (`mockConfirmOutcome`): Abgelehnt → Kasse wieder `open`; Abbruch → Danke-Seite, Session bleibt offen; Verzögert → neue Test-API `completeUnpaidWithoutEvent` (complete/unpaid ohne Ereignis). Server-Actions `submitCheckout`, `mockConfirm`, `reopenCheckout`, `changeCheckoutDelivery` (303, ohne JavaScript bedienbar). Stripe-Client: E-Mail/Adresse über das Checkout-Objekt, `confirm({ returnUrl })`, Fehler → `reopenCheckout`.\n- Tests: tests/int/commerce/change-delivery.int.spec.ts (5 grün, inkl. AK-4-03), tests/int/commerce/mock-confirm.int.spec.ts (+3: S8, S9, S10; keine Bestellung, kein webhook-events-Eintrag).

## 2026-09-29 – P4.10a

- `submitCheckout` (src/lib/commerce/submitCheckout.ts): prüft Kasse `open`, Ablauf (bei Stripe auch Session), Reservierung mit dieser `reservationRef`, Korb = Snapshot (S6), Lieferart = Kasse, Pflichtfelder über das gemeinsame Schema, Land DE (R-060), Abweichungs-Bestätigungen (fehlt eine → 400); speichert in einer Transaktion Eingaben, `legalTextVersions`, `legalSnippetVersions`, `submittedAt` an der Kasse plus `consent-log` (DHL nur bei Häkchen, Abweichung je Stück). Stripe: `open → confirming` + Weckzeit +10 min; Vorkasse: `placePrepaymentOrder` (P4.19). Rate-Limit `checkout_submit` (10/30 min je Token-Hash). Keine Personendaten im Log.\n- Tests: tests/int/commerce/submit-checkout.int.spec.ts (11 grün: R-013/R-065, R-048, R-060, R-101, DM-CHK-02, S6, S7, Ablauf, erneutes Absenden, Vorkasse, Log-Schwärzung R-137/V-22); tests/unit/commerce/checkout-schema.unit.spec.ts (9).
## 2026-09-29 – Fehlerbehebung Galerie-Fokus (EK-07, KO-09)

- Fokusring der Galerie-Fotos war in WebKit (iPhone/Safari) unsichtbar: Umriss (`outline-offset: -3px`) und Papier-Halo des Links lagen unter dem Bildrahmen (`position: relative`); der Tastatur-Test bestand nur durch Pixelrauschen der Bildschirmfotos und scheiterte gelegentlich. Der Ring sitzt jetzt auf einer Deckschicht `.zoomLink:focus-visible::after` über dem Foto (mit `forced-colors`-Variante).
- Menü-Tastaturtest bekommt `test.slow()` wie die Tab-Durchläufe (zwei Bildschirmfotos je Halt, in WebKit an der 30-s-Grenze).
- Tests: `keyboard.e2e` in desktop, iphone-15, pixel-7 gegen den Produktions-Build grün; `gallery.e2e` grün bis auf den Doppeltipp-Test (iphone-15), der bei hoher Maschinenlast den 300-ms-Abstand überschreitet (unabhängig von dieser Änderung); `pnpm check` grün.

## 2026-09-29 – P4.23

- Bestellstatus R09 `src/app/(frontend)/[locale]/order/[token]/page.tsx` (DE `/de/bestellung/[token]`, Preset `calm`, Header über den Proxy: `noindex, nofollow`, `no-referrer`, `private, no-store`; Rate-Limit `token_pages`; Suche über `statusTokenHash` + Vergleich in konstanter Zeit; unbekannt → 404): Nummer, Datum, `OrderStatusLine` (KO-16, `<ol>` mit `aria-current="step"`, Varianten Versand/Abholung/Vorkasse, Widerruf/Erstattung als eigene Einträge, `disputed` → `statusBeforeDispute`), Sendungsnummer mit Link aus `trackingUrlTemplates`, Positionen, Summe, Zahlart, bei Vorkasse Bankdaten + Frist + EPC-QR, nur Name/PLZ+Ort/maskierte E-Mail, nur AGB und Widerrufsbelehrung-und-Formular (Hinweis „Deine Rechnung hast du per Mail bekommen“), „Vertrag widerrufen“ → R26 `?order=`, Kontakt. R09 `live`.
- `GET /api/orders/[token]/documents/[file]` (`src/lib/commerce/tokenPages.ts`): nur die Rechtstext-PDFs aus `legalTextVersions`, Belege gesperrt (`STATUS_PAGE_INVOICE_DOWNLOAD = false`), `private, no-store`. Logger normalisiert Token-Pfade (`normalizeLogPath`: `/de/bestellung/[token]`, `/api/orders/[token]/documents/[file]`).
- Tests: `tests/int/orders/documents-route.int.spec.ts` (4), `tests/unit/commerce/order-status-line.unit.spec.ts` (7), Logger-Unit-Test, `tests/e2e/order/order-status.e2e.spec.ts` (5: Fixtures analog O01, O03, O10, O13 + EN; Header, Maskierung, keine Beleg-Links, Ruhe-Modus, `@a11y` Desktop und 390 px) grün auf desktop, pixel-7, iphone-15 gegen den Produktions-Build (Port 3200).

## 2026-09-29 – P4.17

- Danke-Seite R08 `src/app/(frontend)/[locale]/thank-you/[token]/page.tsx` (DE `/de/danke/[token]`): Zustände wartet, bezahlt (Mini-Preisschilder, nächste Schritte, S4-Block „Leider schon weg“, Status-Link aus dem Siegel, „Vertrag widerrufen“), Vorkasse (Bankdaten, „IBAN/Verwendungszweck kopieren“, Frist, EPC-QR 168 px), leider schon weg (O19, Text wie M10) und nicht bezahlt („Zurück zur Kasse“ bzw. „Zum Korb“); „Beispiel“ bei Seed-Daten; mit Bestellung werden `pc_cart`/`pc_checkout` gelöscht. R08 `live`, Preset `thanks`.
- `getThanksState(token, now)` (`src/lib/commerce/thanksState.ts`): Kassen-Token vor Status-Token; bei `confirming` genau eine Anbieter-Abfrage → bezahlt ⇒ `fulfillCheckout` (Rückfall 2), `open` ⇒ Kasse `confirming → open` (S9), sonst wartet (S10). Endpunkt `GET /api/checkout/[token]/state` (nur Zustandscode, `no-store`, 404, 429 über neuen Bucket `token_pages` 60/min).
- Verhaltensmodule `thanks-poll` (2 s bis 60 s, dann Hinweis „Das dauert länger als sonst“), `thanks-moment` (MI-09 Grundfassung + Stempel-Knall MI-03, reduzierte Bewegung = Endzustand), `copy-button`; neue Budget-Gruppe in `tests/perf/budgets.json`.
- Tests: `tests/int/commerce/thank-you-fallback.int.spec.ts` (4), `tests/int/api/checkout-state.int.spec.ts` (5), Unit `thanks-poll` (6), `thanks-moment` (3), `copy-button` (2) + Vertragstest AK-DS-18, `tests/e2e/checkout/thank-you.e2e.spec.ts` (6: wartet→bezahlt, nicht bezahlt, Vorkasse analog O13, leider schon weg, EN analog O14, 404; R-066 Header, Cookies, `@a11y`) grün auf desktop, pixel-7, iphone-15; `pnpm check`, `pnpm build` grün.

## 2026-09-29 – P4.8

- R06 gebaut (Registry live): Positionen (CartLine: Foto 64×80, Link, Nr./Kategorie, MoneyAmount, Entfernen, Zustandshinweise, gedämpft), Lieferart-Radiogruppe mit Preis bzw. nur_abholung ausgegraut, Versandklassen-Zeile, Summen + PriceNote, Lieferzeit, Baustein cart.paymentAndDeliveryInfo + Zahlarten vor „Zur Kasse“ (aria-disabled mit Hinweis), WarrantyNotice, closedMessage, Leerzustand KO-17, Coco statisch\n- evaluateCart liefert shippingQuoteCents und imageId; dynamische Seiten: Cache-Control private, no-store; Radio disabled, Button ariaDisabled\n- Tests: tests/e2e/cart/cart.e2e.spec.ts, tests/e2e/legal/cart-info.e2e.spec.ts (R-031/035/036/049, AK-DS-11, EK-04, S01+S11 = 117,90 €, ohne JS, @a11y) gegen pnpm start in 3 Projekten grün; Unit evaluate-cart/headers erweitert; check, test:int, build grün

## 2026-09-29 – P4.3

- R25 ersetzt das Gerüst: Rechtstext-Fassung versand-zahlung (Platzhalter-Band), Versandtabelle ShippingTable über computeShipping aus settings.shipping (Zone DE + Abholung 0,00 €), Regel höchste Klasse, Lieferzeit, Liefergebiet, Zahlarten, Belastung, Transportschaden (unberührt), Rücksendekosten, Link R24, WarrantyNotice\n- Loader getShippingPaymentSettings (Tag settings); Test-Lock holdShippingRates; Helfer tests/e2e/{adminApi,axe}.ts\n- Tests: tests/e2e/legal/shipping-page.e2e.spec.ts (R-031, R-035, R-049, V-10/11/12/19/21, @a11y, Preisänderung ≤ 60 s) 3 Projekte grün; legal-pages grün; check, test:int, build grün

## 2026-09-29 – P3 CI grün

- Phasenlauf `[ci:full p3]` (Commit 32029fc): CI, CI full (e2e desktop/iphone-15/pixel-7, quality) und Vorschau-Export grün; Artefakt `planet-claire-vorschau-p3-32029fc`.

## 2026-09-29 – P3 Phasen-Abnahme (Shop, Produktseiten, Archiv) – für Jutta

**Was ist neu?** Dein Shop steht – vorerst mit den Beispielstücken (Fotos aus deinem Instagram, Texte als Muster).

**Was du in der Vorschau-Datei jetzt siehst** (Datei herunterladen und doppelklicken, wie in Anleitung V0):

- **Shop:** alle Stücke als Karten mit Foto, Preisschild und Nummer. Oben kannst du nach Kategorie filtern (Keramik,
  Textil, Caps, Zeichnungen, Schmuck) und „nur verfügbare“ anzeigen lassen. Die Preisschilder schwingen kurz, wenn
  sie ins Bild kommen – wie Anhänger an einer Schnur.
- **Reserviert und verkauft:** Ein reserviertes Stück zeigt „Gerade reserviert“, ein verkauftes bekommt den
  „sold“-Stempel. Verkaufte Stücke, die du zeigen möchtest, stehen zusätzlich im **Archiv** („Schon ausgezogen – aber
  schön anzusehen“).
- **Produktseite** für jedes Beispielstück: Fotos zum Wischen, ein Tipp aufs Foto öffnet die große Ansicht zum
  Heranzoomen. Darunter Preis mit dem Hinweis zur Umsatzsteuer, Versandkosten, Lieferzeit, alle Pflichtangaben je
  Kategorie (z. B. Material und Pflege bei Textil, „nur zur Deko“ bei Keramik ohne Nachweis), deine Angaben als
  Herstellerin, Versand & Rückgabe und „Mehr aus …“ mit ähnlichen Stücken.
- **Kurzlink für Instagram:** `planetclairetattoos.com/nr/<Nummer>` führt direkt zum Stück – praktisch für Stories.
- **Wenn es ein Stück nicht mehr gibt,** erscheint eine freundliche Seite („Dieses Stück hat schon ein Zuhause
  gefunden“) mit Links zu Shop und Archiv.

**Wie „In den Korb“ wirkt:** Auf der echten Website legt der Knopf das Stück in den Korb, ohne dass die Seite neu
lädt; oben zählt der Korb eins hoch, und beim Stück steht „Liegt schon in deinem Korb“. Erst in diesem Moment speichert
die Seite ein kleines Korb-Cookie – vorher nichts (so will es das Datenschutzrecht). In der Vorschau-Datei zählt der Korb
nur zum Anschauen hoch und zeigt „In der Vorschau zeigt der Korb ein Beispiel“ – hier wird nichts gekauft und nichts
gespeichert. Warenkorb, Kasse und Bezahlen kommen in der nächsten Phase (P4).

**Geprüft:** Auf keiner Shop-Seite gibt es ein Cookie vor „In den Korb“, keine Verbindung zu fremden Diensten, kein
„inkl. MwSt.“, keine durchgestrichenen Preise und keinen Satz wie „kein Umtausch“. Alle Seiten gibt es auf Deutsch und
Englisch, sie sind per Tastatur bedienbar und für Screenreader geprüft, und Shop und Produktseite laden auf dem Handy
schnell (Messung wie bei Google, Ziel unter 2,5 Sekunden).

**Was noch fehlt (kommt später oder mit dir in P11):** deine echten Stücke und Fotos in voller Größe (aus dem
Instagram-Export), die Rechtstexte der Kanzlei und die offizielle Grafik zur Gewährleistung – bis dahin stehen dort
gekennzeichnete Platzhalter.

## 2026-09-29 – P3.16

- Querschnittssuiten auf R02–R05 ausgedehnt: @privacy (Request-Log, CSP), @a11y (axe je Kategorie/Zustand, 404-Variante) plus Tastatur-Durchlauf, Verbotsmuster-Scan, JS-Budget (check:bundle), Lighthouse-CI für R02/R04, CLS-Messung (Playwright) jetzt auch für R02 und R04.
- Visuelle Referenzen für Shop, Produktseite, Archiv, 404-Variante „Schon ein Zuhause“ und Shop-Bausteine (P3.4) lokal gegen den Produktions-Build erzeugt (OFFENE-PUNKTE N-02); R01 (Karten aus P3.12) und 404 (Nummernfeld aus P3.7) erneuert. Mobile Kauf-Leiste in ganzseitigen Aufnahmen ausgeblendet, alle Bilder vor der Aufnahme geladen.
- Ursache instabiler R01-Aufnahmen behoben: Der Daten-Cache des Produktions-Builds (`.next/cache/fetch-cache`) überlebte Server-Neustarts und `db:reset`, die Seite zeigte Medien-Dateinamen des vorigen Seeds (HTTP 403). Playwright leert ihn jetzt vor `pnpm start` (`startCommand` in `playwright.config.ts`, auch für die visuellen Tests).
- Vorschau-Datei: R02–R05, Listen-Varianten und alle Seed-Produktseiten enthalten; Test für Schild-Schwingen robuster (Desktop: erste Kartenreihe liegt unter dem Banner, wird hingescrollt).
- Tests: pnpm check (1022), test:int (413), build, test:e2e (1266, desktop/iphone-15 WebKit/pixel-7), test:visual 34/34 zweimal hintereinander stabil, @perf 6/6, test:preview-export 26/26.
## 2026-09-29 – P4.22

- `processPaymentEvent` behandelt jetzt Erstattungen und Anfechtungen (`src/lib/payments/orderEvents.ts`, ersetzt die vorläufige `ignored`-Ablage): `refund.created/updated/failed` → `refunds[].status` über `stripeRefundId` (Rückfall: offene Erstattung gleichen Betrags ohne ID; `pending` überschreibt kein Ergebnis), `failed` → `adminAttention refund_failed` + A08 genau einmal je Erstattung, kein Statuswechsel; `charge.refunded` → offene Erstattungen bis zur erstatteten Summe `succeeded`.
- Anfechtungen über `transitionOrder()`: `charge.dispute.created` → O16 (nur Stripe/Mock-Zahlung in den neun erlaubten Status; `statusBeforeDispute`, `disputedAt`, `dispute.open`, `adminAttention dispute_open`, A07); `charge.dispute.closed` gewonnen → O17 (zurück auf `statusBeforeDispute`, `won`, Hinweis entfernt, Notiz), verloren → O18 (`refunds[]` `dispute`/`succeeded` mit Gutschrift GS zur Rechnung, Notiz „durch Anfechtung erstattet“, keine M09); sonst kein Statuswechsel + A12 `dispute_not_applicable`.
- Tests: `tests/int/payments/refund-dispute-events.int.spec.ts` (7, signierte Stripe-Fixtures, doppelte Zustellung), `tests/unit/commerce/order-transitions.unit.spec.ts` (+1 Paare mit `disputed`); `pnpm check` grün, `pnpm test:int` (ohne preview-export) 552 grün.

## 2026-09-29 – P4.21

- `fulfillCheckout` nach DATENMODELL §8.4 (ersetzt `OversoldNotHandledError`): fehlende Stücke ohne Verkaufsbuchung. **Alle fehlen:** O19 (`refunded`), keine Rechnung, Positionen `refunded`, `refunds[]` (`item_unavailable`, voller Betrag, `includesShipping`, `pending`), Kasse `completed`, M10 + A06. **Einige fehlen:** O1, fehlende Positionen `refunded`/`refundedCents`, Erstattung = Preise + (bezahlter Versand − Versand der höchsten verbleibenden Klasse, höchstens bezahlt), Rechnung nur über Geliefertes und Restversand (`createInvoiceForOrder` mit `lines`/`shippingCents`), keine Gutschrift, Block „Leider schon weg“ in M01, A06. Immer `adminAttention oversold`, Audit `reservation_conflict`; Reservierungen der fehlenden Stücke freigegeben.
- `src/lib/commerce/refunds.ts`: `executeRefund` nach dem Commit über `adapter.refund` (Idempotenz `refund:<orderId>:<refundSeq>`), Ergebnis in `refunds[].status`/`stripeRefundId`; `setRefundStatus` (bei `failed` `adminAttention refund_failed` + A08 genau einmal) – auch für P4.22.
- Tests: `tests/int/commerce/oversold.int.spec.ts` (3: AK-4-10/O19 inkl. zweiter Zustellung, Teilfall mit Betrag/Rechnung/ohne Gutschrift/M01-Block, Erstattung failed → A08); Int-Tests jobs/commerce/payments/endpoints/invoices grün; `pnpm check` grün.

## 2026-09-29 – P4.20

- Endpunkte `src/endpoints/orders/actions.ts` (nur `isAdmin`, an `orders` registriert): `POST /api/orders/:id/prepayment-received` (O3 über `markPrepaymentPaid`: Verkauf über die Vorkasse-Reservierung, `receivedAt`/`receivedAmountCents`, `paidAt`, Rechnung, M05; Betrag ≠ Summe nur mit `confirmMismatch` → `adminAttention payment_amount_mismatch`), `/cancel` (O4 `admin`, Grund Pflicht, Freigabe `order_cancelled`, M04 mit Juttas Text, keine A03), `/late-payment` (`reactivate` → O5 nur wenn alle Stücke `available`, sonst 409 „Stück inzwischen verkauft – bitte Geld zurücküberweisen“; `refund_transfer_done` → Notiz + Audit, keine Rechnung). Doppelaufruf im Zielzustand → 200 `alreadyDone` ohne Nebenwirkungen. `transitionOrder()` prüft Ausgangsstatus.
- Admin-Komponente `src/admin/components/OrderActions.tsx` (UI-Feld oben in der Bestellung, Logik in `orderActionsModel.ts`): Knöpfe je Status, Bestätigungsdialog mit Folge, Betrag, Verwendungszweck, „noch X Tage bis Storno“, Idempotenz-Schlüssel je Klick, gesperrt während der Anfrage; Texte in `src/admin/translations.ts`; Import-Map erneuert.
- Tests: `tests/int/endpoints/order-prepayment-actions.int.spec.ts` (7: anonym 403, O3 + Doppelaufruf, Betragsabweichung, O4 Admin, O5, O5 verkauft → 409 + Rücküberweisung, AK-5-01-Matrix), `tests/unit/admin/order-actions.unit.spec.ts` (2), `tests/e2e/admin/order-actions.e2e.spec.ts` (Desktop + 390×844, Dialogtexte, `@a11y`) grün gegen den Produktions-Build (Port 3200); `pnpm build`, `pnpm check` grün.

## 2026-09-29 – P4.19

- Dienst `src/lib/commerce/prepayment.ts`: `placePrepaymentOrder(req, checkoutId, { now, checkoutData })` in einer Transaktion (nur bei `settings.payment.prepaymentEnabled`, Kasse `open`): Eingaben an der Kasse (`paymentChoice = prepayment`, `submittedAt`), `createOrderFromCheckout` O2, Reservierung/Stücke nach §8.5 umgestellt (`source = prepayment`, Frist `dueAt`, `order_id`/`current_order_id`), Kasse `completed`, M02 + A02; `afterCommit`: Session beenden (`already_complete_paid` → `adminAttention manual` + A12 S17), Mails direkt, `jobAlarm.bump(reminderDueAt)`. Die Server-Action `submitCheckout` (303 auf die Danke-Seite) ruft den Dienst mit P4.10a auf.
- Tasks `prepaymentReminders` (M03 genau einmal, `reminderSentAt`) und `cancelOverduePrepayments` (O4 `payment_timeout` über `cancelPrepaymentOrder`, Freigabe `prepayment_overdue`, Revalidierung, M04 + A03, keine Rechnung), beide mit Advisory-Lock, ohne `seed = true`, nächster Weckzeitpunkt; Migration `p4_prepayment_jobs`.
- Tests: `tests/int/commerce/prepayment.int.spec.ts` (6: Bestellen + Umstellung + nachfolgendes expired, Wechsel nach abgelehntem Kartenversuch, confirming abgelehnt, S13 ohne Session, S17 → A12, Vorkasse aus), `tests/int/jobs/prepayment-deadlines.int.spec.ts` (2: R-071/AK-8-02 mit vorgestellter Uhr + Doppel-Lauf, Gegenprobe `seed = true`); `pnpm check` grün.

## 2026-09-29 – P4.18

- Task `releaseExpiredReservations` (`src/jobs/releaseExpiredReservations.ts`, Queue `commerce`, Advisory-Lock je Task über `src/lib/jobs/lock.ts`, Dienst `src/lib/commerce/expiry.ts`, jede Aktion eigene Transaktion, `now` injiziert): (a) aktive `checkout_session`-Reservierungen mit `expiresAt < now` → `releaseReservation` (Session beenden; `already_complete_paid` ⇒ `fulfillCheckout` S3; sonst – auch `already_complete_unpaid` – Freigabe `session_expired` + Kasse `expired`/`reservation_expired`), Vorkasse nie; (b) Kassen `confirming` > 10 min: bezahlt ⇒ `fulfillCheckout` (S10), Session offen + Reservierung gültig ⇒ `open`, sonst warten; (c) `jobAlarm.bump` auf die nächste Reservierung bzw. `confirmingAt + 10 min`.
- Tick: reiht bei jedem vollen Lauf die Fristen-Tasks ein (`WAKE_TASK_SLUGS`, ohne Doppel) und übernimmt von Tasks gesetzte künftige Weckzeiten. `transitionOrder()` (`src/lib/commerce/transitionOrder.ts`) als einziger Weg für Bestell-Statuswechsel vorbereitet; `context.actorType` für den Statusverlauf. Migration `p4_release_job` (Task-Slug-Enum).
- Tests: `tests/int/jobs/release-expired-reservations.int.spec.ts` (7: AK-4-09/DM-CHK-04, AK-4-10 S3, AK-8-01/T-18, Vorkasse unberührt, ohne Session, Weckzeit, AK-A-9-02 Tick), `tests/int/jobs/reconcile-confirming.int.spec.ts` (4); `pnpm check` grün, Int-Tests jobs/commerce/payments grün.

## 2026-09-29 – P4.16b

- `fulfillCheckout` Schritt (1) für bezahlte Sessions ohne mögliche Bestellung: Kasse `expired`/`cancelled`/`failed` (S16) → keine Bestellung, keine Rechnung, Stücke und Kasse unverändert, A12 `s16_payment_after_checkout_closed` („Zahlung zu einer beendeten Kasse – bitte im Stripe-Dashboard erstatten“, Betrag, Session- und Zahlungs-ID), Ereignis `processed` mit `relatedCheckout`; Kasse `completed` mit Vorkasse-Bestellung (S17) → keine zweite Bestellung, `adminAttention` (`manual`, Notiz „Vorkasse bestellt, aber Kartenzahlung eingegangen – bitte eine Zahlung erstatten“) + A12 `s17_paid_despite_prepayment`; beide A12 ungedrosselt, nach dem Commit direkt versendet.
- Tests: `tests/int/commerce/fulfill-checkout.int.spec.ts` (+4 „AK-4-17 …“: expired/cancelled/failed, S17 mit O2-Fixture); `tests/e2e/checkout/revalidation.e2e.spec.ts` `@slow` (T-21: signiertes Mock-Ereignis an den laufenden Server, Produktseite zeigt „sold“ ≤ 5 s) grün gegen den Produktions-Build (Port 3200); `pnpm build`, `pnpm check` grün.

## 2026-09-29 – P4.16a

- `src/lib/commerce/fulfillCheckout.ts` `fulfillCheckout(checkoutId, req, { payment, now })` in einer Transaktion (Transaktion des Aufrufers per `dbFor`): Kasse `FOR UPDATE`, Idempotenz über `orders.stripe_checkout_session_id`, nur `open`/`confirming`; Stücke `FOR UPDATE` (`reserved` mit dieser Referenz oder `available`, sonst `OversoldNotHandledError` bis P4.21 → Ereignis `failed`, Wiederholung); `createOrderFromCheckout` (O1, Zahlart card/paypal, `paymentMethodType` card/apple_pay/google_pay/paypal, Session/PaymentIntent/Charge/livemode/amountReceived, Abweichung → `adminAttention payment_amount_mismatch`); Verkaufs-SQL §8.3 (`online`/`pickup`), Reservierungen `converted`, Kasse `completed`; Rechnung; M01 + A01 per Outbox; `afterCommit`: Beleg-PDF, Mails direkt, `revalidateProduct(…, { immediate: true })`.
- `processPaymentEvent` fragt bei bezahlten Sessions vor der Transaktion `getCheckoutSession` (Zahlart, Belastung) und ruft `fulfillCheckout`; `releaseReservation` bei `already_complete_paid` ebenso (lazy release). Mock-„Erfolg“ `mockConfirmSuccess` (`src/lib/commerce/mockConfirm.ts`): Mock `complete`/`paid`, Ereignis über `processPaymentEvent`, Ziel `/de/danke/<Token>` (Server-Action samt 303 folgt mit P4.10b).
- Tests: `tests/int/commerce/fulfill-checkout.int.spec.ts` (8: R-065, open/Abholung, abgelaufen aber frei, schon completed, Betragsabweichung, PayPal, R-081 M01 mit genau 3 PDF-Anhängen im Datei-Treiber, 13 Statuswerte), `tests/int/payments/webhook.int.spec.ts` (+3: T-02-Rest completed/async_succeeded als Stripe-Fixture, DM-CHK-03/AK-A-3-03 Mock-Erfolg + Fixture), `tests/int/commerce/mock-confirm.int.spec.ts` (3), `start-checkout.int.spec.ts` (+1 lazy release → eine Bestellung); `pnpm check` grün, `pnpm test:int` (ohne preview-export) 512 grün.

## 2026-09-29 – P4.16

- Route `src/app/(api)/api/stripe/webhook/route.ts` (`nodejs`, `maxDuration = 60`, Rohkörper per `req.text()`) → `handleWebhookRequest` (`src/lib/payments/webhook.ts`: `parseWebhook` des aktiven Treibers, ungültige Signatur/Form → 400, Fehler → 500, Körper nie geloggt, nur SHA-256) → `processPaymentEvent` (`src/lib/payments/processPaymentEvent.ts`): Beanspruchen per `INSERT … ON CONFLICT (event_id) … WHERE status = 'failed'` (zusätzlich hängengebliebene `processing` > 10 min), Verarbeitung + `processed`/`ignored` in einer Transaktion, Fehler → `failed` + `lastError`, ab dem 2. Fehlversuch A12; Kasse über `client_reference_id` bzw. `stripe_checkout_session_id`.
- Ereignisse: `completed` unbezahlt → nur protokolliert; bezahlt/`async_succeeded` → Übergabe an `fulfillCheckout` (P4.16a); `async_failed` (nur `confirming`) → `failed`/`payment_failed` + Freigabe; `expired` nur bei `open`/`confirming` und derselben Session, nur Reservierungen `checkout_session`; Vorkasse-Kasse `completed` bleibt unberührt; unbekannte Typen → `ignored`. Freigabe-SQL als `releaseInTransaction` aus `reservation.ts` herausgelöst. `SessionState.chargeId` (Stripe/Mock). `pnpm payments:reconcile [--since=<ISO>]` (`scripts/payments-reconcile.ts`).
- Tests: `tests/int/payments/webhook.int.spec.ts` (10: Signaturen Mock/Stripe inkl. Route, unbekannter Typ, expired, R-065 async_failed per Stripe-Fixture, completed unbezahlt, Vorkasse-Kasse unberührt, alte Session, doppelte Zustellung parallel, Fehler → 500 → A12 → Wiederholung gelingt); `pnpm check` grün, betroffene Int-Tests grün.

## 2026-09-29 – P4.15

- Kund:innen-Vorlagen `src/lib/email/templates/prepayment.tsx`: M03 `prepayment_reminder` (offener Betrag, Bankdaten + EPC-QR per CID, Frist, Baustein `email.vorkasse.reminder`, „Hast du schon überwiesen? …“), M04 `prepayment_cancelled` (Grund `payment_timeout` → „keine Zahlung eingegangen“ bzw. Text von Jutta; `withdrawn` vom Schema abgelehnt; Baustein `email.vorkasse.cancellation` als gekennzeichneter Platzhalter; Rücküberweisungs-Satz), M10 `oversold_apology` (Entschuldigung, volle Erstattung über dasselbe Zahlungsmittel in 5–10 Werktagen, Link zum Shop, keine Rechnung, kein Rabattcode) – DE/EN.
- Verwaltungs-Vorlagen `templates/admin.tsx` (Deutsch, Direktlink `ADMIN_ROUTE/collections/orders/{id}`): A01/A02 `admin_order_placed` (Hinweise Keramik und > 500 €), A03, A06, A07 (Grund laut Stripe, Antwortfrist, Belege-Hinweis), A08; A12 unverändert. Alle in `registry.ts` registriert, Betreffzeilen exakt nach KONZEPT §6.2/§6.4.
- Tests: `tests/unit/email/templates/{prepayment-reminder,prepayment-cancelled,oversold-apology,admin-mails}.unit.spec.ts` (Snapshot + Pflichtinhalt, R-084, V-09), `tests/unit/email/registry.unit.spec.ts` (Schlüssel ↔ ID, Admin-Empfänger mit Rückfall); `pnpm check` grün.

## 2026-09-29 – P4.14

- Vorlagen M01 `order_confirmation`, M02 `prepayment_instructions`, M05 `prepayment_received` (DE/EN) in `src/lib/email/templates/orderConfirmation.tsx` mit Abschnitten `orderSections.tsx` (Schema `orderMailDataSchema`, Positionen mit Nr./Titel/Eigenschaften/Abweichung, Versand/Abholung, Gesamt + KU-Satz, Zahlart + „bezahlt am“ bzw. Bankblock mit IBAN in 4er-Gruppen, BIC, Verwendungszweck, Frist, EPC-QR per CID und Baustein `email.vorkasse.paymentInstructions`, Adressen, Lieferzeit bzw. „Ich melde mich wegen der Abholung“, Mängelhaftung mit Link auf R25, Anhänge „in der Fassung vom“, Rücksendekosten, „Vertrag widerrufen“, DHL-Einwilligung nur wenn erteilt, Bestellstatus/Datenschutz, Anbieterkennung mit Telefon nur in M01/M02, Kanzlei-Satz als gekennzeichneter Platzhalter, S4-Block „Leider schon weg“). Baukasten `kit.tsx` (HTML und Text aus denselben Blöcken, `fill` wirft bei fehlenden Werten). Texte `email.*` in de/en.json.
- `buildOrderMailData(req, order)` (`src/lib/email/orderMailData.ts`) und `legalAttachmentInfo` (Dateinamen/Fassungsdaten ohne Rendern); `MailBusiness.phone` (nur Anbieterkennung).
- Tests: `tests/unit/email/templates/order-confirmation.unit.spec.ts` (17, je R-081-Element eine Assertion), `prepayment-instructions.unit.spec.ts` (8, EPC-QR per `jsqr` byte-gleich), `prepayment-received.unit.spec.ts` (6); Snapshots unter `tests/fixtures/mails/`; `pnpm check` grün (1204).

## 2026-09-29 – P4.13

- `enqueueEmail(req, { template, to, locale, data, idempotencyKey, relations })` (`src/lib/email/outbox.ts`): Vorlagen-Daten per Schema geprüft, Advisory-Lock je Schlüssel + neues Feld `email-log.idempotencyKey` (UNIQUE, Migration `p4_email_outbox`) → gleicher Schlüssel = `duplicate`, keine zweite Mail; Zeile + Job in der Transaktion des Auslösers; `runEmailJobNow` für die direkte Ausführung nach dem Commit (plus Weckzeit).\n- `src/lib/email/registry.ts`: alle 32 Schlüssel mit KONZEPT-ID, Empfängerart, Pflicht-Anhängen, Bestellmail-Kennung; umgesetzt: A12 (`templates/adminAlert.tsx`), Kund:innen-Vorlagen folgen ab P4.14. Layout `src/lib/email/layout/` (EmailLayout ≤ 600 px, Inline-Stile, `CidImage`, Coco-Vignette per CID, Kund:innen-Fuß mit Anbieterkennung ohne Telefon + Impressum/Datenschutz, bei Bestellmails Bestellstatus + „Vertrag widerrufen“; Verwaltungs-Fuß mit `ADMIN_ROUTE`-Link; Textfassung).\n- `src/jobs/sendEmail.ts` + `src/lib/email/prepare.ts`: Rendern, Status-Link aus `statusTokenSealed` erst nach dem Hash eingesetzt (`bodySha256` mit Platzhalter), Anhänge (Rechnung, Gutschrift, Rechtstext-PDFs) mit SHA-256 im Log; fehlender Anhang → +1 min (≤ 30×); Fehler → 1/5/15/60/240 min, dann `failed` + A12. `src/lib/email/alerts.ts` `sendAdminAlert` (je Fehlerart höchstens einmal pro Stunde, S16/S17/M08 immer); Konformitäts-Widerruf nutzt es. Logger schwärzt zusätzlich Empfänger, alle Token-Felder, Siegel, Adressen, Käufer:innen.\n- Tests: `tests/int/email/outbox.int.spec.ts` (6: AK-A-3-04 alle Treiber, Rollback, Doppelauslösung seriell/parallel, T-18 Kette + A12-Drosselung, Anhang-Warten, Status-Link aus dem Siegel ohne Token im Log), `tests/unit/email/layout.unit.spec.ts` (7 inkl. Snapshot A12, R-080/V-01/V-02/V-09-Scan), `tests/unit/logging/redact.unit.spec.ts` (2, T-20), Snapshot-Hilfe `tests/helpers/mails.ts`; bestehende Mail-/Job-Tests angepasst; `pnpm check` grün.

## 2026-09-29 – P4.12

- `src/lib/legal/pdf.ts`: `issueLegalTextPdfs` (Zeilensperre, je vorhandener Sprache ein PDF → `documents` `legal_text_pdf`, `pdfDe`/`pdfEn`, fehlende `contentSha256De/En` nachgetragen; idempotent), Tokens über `render.ts` (R-012, Render-Fehler → kein PDF); `src/lib/pdf/LegalTextDocument.tsx` (Lexical → PDF, Band „PLATZHALTER – nicht rechtsverbindlich“ bei `origin ≠ lawyer`, feste PDF-Daten = Aktivierung). Task `src/jobs/renderLegalTextPdf.ts` (Migration `p4_legal_pdf`), eingereiht von `activateLegalText` im selben Commit (`pdfJobId`); der Grund-Seed erzeugt die PDFs der Platzhalter-Fassungen direkt.\n- `src/lib/legal/attachments.ts` `buildLegalAttachments(req, order)`: `AGB_v{n}.pdf` (gespeichertes PDF der Bestellfassung) + `Widerrufsbelehrung-und-Formular_v{n}.pdf` (Belehrung + Formular, deterministisch), bei EN-Bestellungen zusätzlich `…_EN.pdf`; fehlendes PDF → `AttachmentNotReadyError` (für `sendEmail`, P4.13).\n- Route `src/app/(api)/api/legal/[...slug]/route.ts` (Logik `src/lib/legal/download.ts`): `/api/legal/[type].pdf?locale=de|en`, `/api/legal/[type]/[versionId].pdf`, `Cache-Control: public, max-age=3600`; 404 für Entwürfe/unbekannte Typen/fehlendes PDF; EN ohne EN-PDF → DE. `readStoredFile` in `src/lib/storage/read.ts` (local/S3, alle Bereiche).\n- Tests: `tests/int/legal/legal-pdf.int.spec.ts` (5: PDF + SHA-256 je aktiver Fassung, Tokens ersetzt, R-002, DM-LEG-04, DM-LEG-02 inkl. Determinismus und EN, Download-Routen); bestehende Legal-/Seed-Tests grün; `pnpm check` grün.

## 2026-09-29 – P4.11

- `src/lib/invoices/`: `schema.ts` (`InvoiceDataV1` als zod-Schema mit Summen-/Steuerzeilen-Prüfung), `build.ts` (Belegdaten aus Bestellung + `settings.business`: Empfänger nach R-061, Positionen „Nr. 017 · Titel · Kategorie“, Versand als Position, Leistungsmonat, KU-Satz bzw. Steuerzeilen aus `computeTax`; Gutschrift-Daten mit Verweis), `create.ts` (`createInvoiceForOrder`, `createCreditNote` in der Transaktion des Auslösers, Nummer per Zählerzeile, `orders.invoice`, Job `renderInvoicePdf` im selben Commit; im Seed-Kontext ohne Job), `issue.ts` (`issueInvoicePdf`: Zeilensperre, PDF → `private-uploads` `invoice_pdf`/`credit_note_pdf` mit Präfix `private/invoices/{JJJJ}` und `{Nummer}.pdf`, `sha256`, `renderedAt`, `issued` genau einmal; `runInvoicePdfJob` für die direkte Ausführung nach dem Commit).\n- PDF: `@react-pdf/renderer` 4.9.0 exakt gepinnt, `src/lib/pdf/{InvoiceDocument.tsx,render.ts,fonts.ts}`; lokale TTF-Schriften `src/lib/pdf/fonts/` (von `pnpm fonts:copy` offline aus `@fontsource` erzeugt), keine Netzwerk-Anfrage; Wasserzeichen „BEISPIELBELEG – kein echter Beleg“ bei `seed = true`. Task `src/jobs/renderInvoicePdf.ts` registriert (Migration `p4_invoice_pdf`: Task-Slug-Enum).\n- Tests: `tests/int/invoices/numbering.int.spec.ts` (3: 50 parallel, Rollback, R-121 mit `removeSeedData`), `pdf.int.spec.ts` (6: R-120 per `pdf-parse` 2.4.5, Abholung/R-061, DM-INV-05 + genau einmal, Gutschrift, DM-INV-04, Wasserzeichen), `immutability.int.spec.ts` (4: REST/Local API/SQL, Seed-Ausnahme, Hash); `pnpm check` grün; `pnpm build` in dieser Sitzung nicht gelaufen (Parallel-Last).

## 2026-09-29 – P4.7

- `src/lib/commerce/cart.ts`: `readCart()` (tolerant, `decodeCartCookie` + zod), `removeFromCart` (offene Kasse → `cancelled`/`cart_changed`, Freigabe `customer_cancelled`, S6; `confirming` oder „bezahlt“ beim Anbieter → abgelehnt `payment_running`; leerer Korb → Cookie löschen), `setDeliveryMethod` (`shipping` mit `nur_abholung` → `pickup_only` mit Nummern, AK-4-02; ohne Korb kein Cookie; Kasse und Reservierung bleiben), `evaluateCart(cart, now)` (DB-Stand je Position, eigene Kasse über `pc_checkout`) mit reinem Kern `src/lib/commerce/evaluateCart.ts` (`available`/`reserved_by_you`/`reserved`/`sold`, `priceChanged`, Summen nur über kaufbare Positionen mit DB-Preis, `canCheckout` + `blockers`), `reservedByYou()`.
- Server-Actions `removeFromCart`/`setDeliveryMethod` in `src/app/(frontend)/[locale]/cart/actions.ts` (Formular → 303 auf R06 mit Hinweis, `via=script` → Antwort); Hinweis-Code `pickup_only` + Texte DE/EN.
- `GET /api/public/product-status`: Feld `reservedByYou` (Abgleich mit `pc_checkout`, ohne Cookie `false`, weiter `no-store`); Abruf nun `credentials: 'same-origin'`; `product-status` meldet `reservedByYou`, `add-to-cart` zeigt auf der Produktseite und in der Kauf-Leiste „Du hast es gerade in der Kasse“ + „Zur Kasse“ (R07). ARCHITEKTUR §2.5/§8.5 ergänzt.
- Tests: `tests/unit/commerce/evaluate-cart.unit.spec.ts` (10), `tests/int/commerce/cart-actions.int.spec.ts` (10: S6 inkl. sofort öffentlich frei, letztes Stück, `confirming`, AK-4-02, Lieferart ohne Freigabe, Preisänderung, eigene/fremde Kasse, `reservedByYou`), Behavior-Unit-Tests erweitert; `add-to-cart.int` angepasst; `pnpm check` grün (1164), betroffene Int-Tests grün.

## 2026-09-29 – P4.6

- `src/lib/commerce/reservation.ts`: `reserveProducts` (atomares `UPDATE products … WHERE id = ANY(…) AND status = 'available' AND is_custom_commission IS NOT TRUE RETURNING id` + `INSERT INTO reservations … 'checkout_session'`; weniger Zeilen oder UNIQUE-Verletzung → `ReservationConflictError`, Rollback), `releaseReservation(ref, reason, now)` nach §8.2 (Session vorher beenden; `already_complete_paid`/unbezahlt abgeschlossen/Anbieterfehler → keine Freigabe; Kasse je Grund nach `expired`/`cancelled`/`failed`), `releaseExpiredFor` (lazy release, nur `checkout_session`). Übergabe an `fulfillCheckout` bei „bezahlt“ bleibt für P4.16a markiert.
- `src/lib/commerce/checkout.ts`: `startCheckout({ cart, locale, existingToken, now })` (Shop offen, öffentlich/`available`, ≤ `maxItemsPerCheckout`, S14 Wiederverwendung ohne Verlängerung bzw. `replaced`, lazy release, eine Transaktion Kasse + Reservierung, Session danach mit `sessionSeq = 1`, S13 ohne Session, `jobAlarm.bump`, `revalidateProduct(…, { immediate: true })`), `cancelCheckout`, Cookie-Attribute `pc_checkout`, Rate-Limit `checkout_start` (10/10 min + Bucket `checkout_start_day` 30/Tag), Korb-Hinweis `?hinweis=reserved&nr=17` (Texte `cart.notes.*` DE/EN für P4.8).
- `transitionCheckout()` in `checkoutTransitions.ts` (Zeilensperre, Tabelle, `context.transition`) als einziger Weg für Kassen-Statuswechsel.
- Server-Action `src/app/(frontend)/[locale]/cart/actions.ts` `startCheckoutAction`: setzt `pc_checkout` nur bei neuer Kasse, 303 auf R07; Ablehnung 303 auf R06 mit Hinweis.
- Tests: `tests/int/commerce/start-checkout.int.spec.ts` (16: Gleichheit Referenzen/Zeiten, Snapshot, AK-A-9-02, AK-4-08, S13, S14 inkl. `replaced`, lazy release inkl. „bereits bezahlt“, Limit, Shop geschlossen, Anbieterfehler), `tests/int/commerce/reservation-race.int.spec.ts` (20 parallele Starts × 100 Runden in ≈ 38 s, Pool 25 → kein `@slow` nötig); `pnpm check` grün (1152 Unit-Tests).

## 2026-09-28 – P4.5

- Spike B-07 zuerst: `stripe` 22.6.2 und `@stripe/stripe-js` 9.17.0 exakt gepinnt; `STRIPE_API_VERSION` = `2026-08-26.dahlia` = Version des SDK (Unit-Test). OpenAPI/SDK-Typen und stripe-mock v0.205.0 (gleiche Version, per `go install` ohne Konto) erlauben `checkout.sessions.update` mit neuen `shipping_options` für jeden `ui_mode` → Soll `updated`, Rückfall `recreate_required` automatisch bei Ablehnung (Schalter `UPDATE_SHIPPING_STRATEGY`); Ergebnis in ARCHITEKTUR Anhang B.
- Stripe-Treiber `src/lib/payments/stripe/{config,client,index}.ts`: Parameter nur aus `buildSessionParams` (elements/payment/eur, nur card+paypal, `expires_at`, `client_reference_id`, Metadaten `{ checkoutRef, appEnv }`, `locale`, `return_url` über neues `checkoutReturnUrl`, eine `fixed_amount`-Versandoption), Idempotenz `checkout:<ref>:<sessionSeq>` (neues Pflichtfeld `sessionSeq`) und `refund:<orderId>:<refundSeq>`, `maxNetworkRetries: 2`, `timeout: 10000`, `STRIPE_API_BASE_URL` für stripe-mock (in Produktion verboten), Modus-Wächter (`livemode` ≠ Schlüssel → Treiber gestoppt), `parseWebhook` mit `STRIPE_WEBHOOK_SECRET`, Abfragen/Beenden/Erstatten/Abgleich/Gebühren.
- Eingabeprüfung aller Treiber: `sessionSeq` ≥ 1, `returnUrl` = Danke-Seite der Sprache mit genau einem Token.
- Kassen-CSP (aus P2.12) bestätigt: Stripe-Hosts exakt aus der DIENSTE-YAML, nur Kontext `checkout` und nur bei `PAYMENTS_DRIVER=stripe`; `docker-compose.yml` pinnt `stripe/stripe-mock:v0.205.0`.
- Tests: `tests/unit/payments/stripe-params.unit.spec.ts` (19, SDK mit `fetch`-Ersatz ohne Netz), `tests/unit/security/stripe-imports.unit.spec.ts` (3, R-062), `tests/unit/security/csp.unit.spec.ts` (4, T-16), Ergänzungen in `checkout-session`, `production-rules`, `network-guard`; `tests/int/adapters/payments.contract.int.spec.ts` in Kern/Lebenszyklus/Abschluss geteilt: Mock 25 grün, gegen stripe-mock zusätzlich 8 grün (sonst übersprungen mit Hinweis), Stripe-Testmodus nur mit `sk_test_…` + `PC_TEST_ALLOW_STRIPE_API=1`. E2E `tests/e2e/security-headers.e2e.spec.ts` um den Kassen-Kontext erweitert (hier nicht ausgeführt). `pnpm check` grün.

## 2026-09-28 – P4.4

- `src/lib/payments/types.ts` nach ARCHITEKTUR §3.5 (unverändert, dazu `PaymentEventShapeError`, `InvalidCheckoutSessionInputError`); `normalize.ts`: eine Normalisierung Stripe-Ereignis → `PaymentEvent` für Stripe und Mock (zehn behandelte Typen, sonst `ignored`; Daten je Typ mit zod geprüft, ohne Personendaten; `paymentEventData()` für typisierten Zugriff); `checkoutSession.ts`: gemeinsame Eingaberegeln (Referenz = UUID statt Token, `metadata` genau `{ checkoutRef, appEnv }`, 1–10 Positionen, ganze Cent, Ablauf 30 min–24 h), Session-Parameter (nur `card`/`paypal`, `elements`), Protokollform ohne `return_url`/E-Mail, Idempotenz-Schlüssel, `clientSecretMissing()` (offene Session ohne Secret → Neuanlage, `sessionSeq + 1`); `stripe/config.ts` mit `STRIPE_API_VERSION = 2026-08-26.dahlia` (Version von `stripe` 22.6.2).
- Mock-Treiber (`src/lib/payments/mock/`): Zustand in `checkouts.mock.state` (Sessions je Kasse, Erstattungen, Anfechtungen, Ereignisprotokoll; Zeilensperre, `lock_timeout`), Client-Secret aus der Session-ID abgeleitet (nie gespeichert), Ablauf von selbst nach `expires_at`; Ereignisse aus den Fixtures mit ersetzten Werten, HMAC-Signatur `x-pc-mock-signature` (HKDF `pc:mock-webhook:v1`); Test-API `mockPayments.emit(sessionId, type)` (liefert Ereignis, Rohkörper, Header) und `setNextOutcome` (Ergebnis, Zahlart card/paypal mit Wallet, Erstattung, Anfechtung) nur bei `APP_ENV` development/test; `refund` → `succeeded` oder vorgegebenes Ergebnis; `listBalanceTransactions` aus der Fixture.
- Migration `p4_mock_state_guard`: Trigger `checkouts_keep_mock_state` – nur der Mock schreibt `mock_state`, Payload-Updates der Kasse überschreiben ihn nicht.
- Fixtures `tests/fixtures/stripe/*.json` (zehn Ereignisse + Balance Transactions, bereinigt, API-Version gepinnt) und `pnpm stripe:fixture <name>|--all [--write]` (prüft; fehlende Dateien werden aus Vorlagen erzeugt).
- Start-Prüfung: außerhalb von Produktion nur `sk_test_`/`rk_test_` bzw. `pk_test_` (Live-Schlüssel ohnehin Abbruch); `PAYMENTS_DRIVER=mock` in Produktion bricht ab.
- Tests: `tests/int/adapters/payments.contract.int.spec.ts` (23 grün, 1 übersprungen ohne stripe-mock: Kontrakt-Reihe anlegen/abfragen/beenden/Erstattung/zehn Fixtures/Signatur/R-062, zwei Prozesse, Trigger, alle zehn `emit`-Typen, Test-API), `tests/unit/payments/normalize.unit.spec.ts` (11), `tests/unit/payments/checkout-session.unit.spec.ts` (18), `tests/unit/env/production-rules.unit.spec.ts` (19); `pnpm check` grün (1117 Unit-Tests), `pnpm test:int` grün.

## 2026-09-28 – P4.1

- Schema-Abgleich: `checkouts` und `orders` entsprechen DATENMODELL §6.25.1/§6.8.1, `src/lib/enums.ts` führt alle Werte aus §4 (13 Bestellstatus, `REFUND_REASONS` inkl. `item_unavailable`/`dispute`); `check:migrations` ohne Drift → keine Migration `p4_checkout` nötig, `payload-types.ts` unverändert.
- `src/lib/security/tokens.ts`: `createToken()` (32 Zufallsbytes, base64url, 43 Zeichen), `hashToken`, `matchesHash` (SHA-256-Digests in konstanter Zeit), `sealToken`/`unsealToken` (AES-256-GCM, HKDF `pc:status-token-seal:v1`, `TokenSealError` ohne Token in der Meldung); `randomToken` bleibt als Alias.
- `src/lib/commerce/createOrderFromCheckout.ts`: einzige Stelle der Bestellanlage (O1 `paid`, O2 `awaiting_prepayment` mit Überweisung und Fristen aus `prepaymentDeadlines`, O19 `refunded`); sperrt die Kasse (`FOR UPDATE`), lehnt Kassen ohne `submittedAt`, mit Bestellung oder außerhalb von `open`/`confirming` ab; übernimmt Snapshot, Summen, Adressen, Rechtsstand, Steuermodus zu `submittedAt`, neuen Status-Token (Hash + Siegel), ersten `statusHistory`-Eintrag; setzt `checkouts.order`; gibt `{ order, statusToken }` zurück.
- `src/lib/commerce/statusToken.ts`: `issueStatusToken`, `rotateStatusToken` (`rotateToken`, Audit `order_status_link_rotated`), `statusTokenForMail` (Siegel öffnen; scheitert es, neuer Token – bei `seed = true` nie).
- Statische Prüfung `order-create` in `check:static`: `orders` werden nur in `createOrderFromCheckout.ts` und im Seed angelegt (Local API und SQL).
- Tests: `tests/unit/security/tokens.unit.spec.ts` (9), `tests/unit/static/order-create.unit.spec.ts` (5), `tests/int/commerce/create-order.int.spec.ts` (11: O1/O2/O19, Snapshot-Treue, DM-ORD-02, Ablehnungen, Parallelität, DB- und Log-Scan ohne Klartext-Token, Rotation, keine Rotation bei Seed); `pnpm check` grün (1069 Unit-Tests), betroffene Int-Tests (13 Dateien) grün.

## 2026-09-28 – P4.2

- Rechenkern als reine Funktionen ohne DB (`now` immer als Parameter): `computeShipping` vervollständigt (höchste Klasse, `pickup` = 0, `nur_abholung` → „Nr. 023 gibt es nur zur Abholung.“, Land nur aus `settings.shipping.enabledCountries`, GB/US nie – R-060; Anzeigename „DHL Paket (Keramik)“/„Abholung in Berlin“ aus `SHIPPING_OPTION_LABELS`), `computeTotals` (ohne Zahlart-Eingang, R-070), `computeTax` mit Versandaufteilung nach Warenwert (KA-10, `splitShippingByRate`), `deadlines.ts` (`reservationTimes`, `prepaymentDeadlines` in Europe/Berlin), `epc.ts` (`buildEpcPayload` nach EPC069-12, `formatIban`), `qr.ts` (PNG/SVG mit `qrcode` 1.5.4, Byte-Segment, Fehlerkorrektur M, Version ≤ 13).
- Neue Pakete exakt gepinnt: `qrcode` 1.5.4, dev `@types/qrcode` 1.5.6 und `jsqr` 1.4.0 (ARCHITEKTUR §1.2); `ci-full` (e2e-full) führt die Unit-Tests für `tests/unit/commerce` und `tests/unit/tax` zusätzlich mit `TZ=Europe/Berlin` aus.
- Doku: Wochentage im Beispiel 26.09.2026 korrigiert (Sa/Di/Do statt Fr/Mo/Mi) in PLAN, KONZEPT, DATENMODELL – Daten und Uhrzeiten unverändert.
- Tests: `tests/unit/commerce/{shipping,totals,deadlines,epc,qr}.unit.spec.ts`, `tests/unit/tax/compute-tax.unit.spec.ts` (AK-4-01, AK-4-02, AK-4-15, AK-8-02, R-060, R-070, R-071; EPC byte-gleich „EUR53.90“; PNG und gerastertes SVG mit `jsqr` dekodiert) – 118 Tests grün mit `TZ=UTC` und `TZ=Europe/Berlin`; `pnpm check` grün (1055 Unit-Tests).

## 2026-09-28 – P3.15

- Admin-Endpunkte (publish, unpublish, sell-offline, archive, restore, return-to-stock, adopt) und Speichern in der Verwaltung laufen über den Produkt-Hook → `revalidateProduct`: Statuswechsel sofort (`{ expire: 0 }`), Bearbeitungen/Preis `'max'`; `settings` und `categories` erneuern ihre Tags; bei `context.seed` nichts.\n- `revalidate.ts`: `updateTag` außerhalb von Server-Actions fällt auf `{ expire: 0 }` zurück, Tags entdoppelt; Startseite bekommt Segment-Rückfall `revalidate = 3600`; Kategorie-Wechsel erneuert auch die alte Kategorie sofort bei Statuswechsel. ARCHITEKTUR §9.3 ergänzt.\n- Gemessen im Produktions-Build: Statuswechsel sichtbar nach ≈ 0,4 s (Produktseite, Shop, Kategorie, Startseite), Text-/Versandpreis-Änderung nach ≈ 1,2 s.\n- Tests: `tests/int/shop/revalidate.int.spec.ts` (11, Spy auf `next/cache`, inkl. „R-033 …“ Preis-Historie + kein Vergleichspreis-Feld, Seed-Kontext, Segment-Konfiguration); `tests/e2e/shop/revalidation.e2e.spec.ts` @slow (2, grün gegen `E2E_SERVER=start` und `pnpm dev`); pnpm check, test:int (ohne preview-export), build grün.

## 2026-09-28 – P3.12

- Kategorie-Stationen der Startseite zeigen bis zu 4 Stücke (`listStationProducts`, `available`/`reserved`, neueste zuerst, gecacht mit Tag `home`); Textil = textil + cap (KA-17); Karten KO-07 ohne Schnur mit Schild `pinned` am Kartenfuß; „Alle {Kategorie}“ → R03; Leerzustand „Gerade ist hier nichts …“ + Archiv-Link; Preis-Fußnote einmal pro Seite; Live-Zustand per `product-status`. Tattoo-Station unverändert.\n- Tests: E2E `home/stations.e2e.spec.ts` (Anzahl/Status/Sortierung/KA-17 lesend in 3 Projekten, eigene Stücke 975–979 exklusiv, Leerzustand mit Test-Kategorie `sonstiges` exklusiv; 10 grün), `home.e2e` angepasst, Leinen-Tests (AK-DS-13/14) grün; Int home-data +2 (KA-17, Link-Fallback). `pnpm check`, `pnpm build`, `check:bundle` (R01 144–149 KB, R04 144,6 KB) grün.

## 2026-09-28 – P3.11

- Endpunkt `GET /api/public/product-status` (zod, ≤ 24 IDs, Rate-Limit `product_status` 120/min, `no-store`, je ID nur available/reserved/sold/gone), Dienst `src/lib/commerce/cart.ts` + Server-Action `addToCart` (Rate-Limit `cart_add`, Shop offen, öffentlich, available, nicht doppelt, < 20; setzt erst dann `pc_cart` nach §8.7). Format `encodeCartCookie`/`decodeCartCookie` in `src/lib/commerce/cartCookie.ts` (auch für `cart-count`).\n- Module `product-status` (Produktseite und Shop-/Kategorie-Raster: Karten-Badges/Name, Kaufbereich, MI-03 über `sold-stamp`) und `add-to-cart` (ohne Seitenwechsel, „Liegt schon in deinem Korb“ + „Zum Korb“, Bestätigung, MI-07, MI-01 Grundfassung; Vorschau nur Anzeige); ohne JavaScript 303 mit `#in-cart` (CSS `:target`).\n- Tests: Unit cart-cookie (21), product-status (10), add-to-cart (21), Vertrag AK-DS-18; Int add-to-cart (13); E2E privacy/cart-cookie @privacy + shop/add-to-cart (3 Projekte; dazu veraltete Shop-Seite live, desktop; 14 grün); Regression shop/legal/privacy/a11y/keyboard/shell/leash/home grün (725). `pnpm check`, `pnpm build` grün.
## 2026-09-28 – P3.14

- OG-Produktbild `src/app/(frontend)/[locale]/shop/[product]/opengraph-image.tsx` (`next/og`, 1200 × 630, DESIGN §12.6): erstes Foto 504 × 630 am Fokuspunkt aus der lokal gespeicherten Größe (`card` → Original-Zuschnitt → `thumb`, `src/og/photo.ts`, `src/lib/storage/read.ts`), Titel Bricolage 600 höchstens 3 Zeilen mit „…“ (`src/og/text.ts`), Preisschild (`formatTagPrice`) mit Sternchen, `Nr. 017`, „* Endpreis zzgl. Versand“ (DA-6), kleine Wortmarke, Tuschelinie von der Öse zur Wortmarke, verkauft mit Stempel „sold“; `generateImageMetadata` für Alt-Text je Stück/Sprache, Next setzt `og:image` (absolut über `metadataBase`), `:alt`, `:width`, `:height`, `:type`; Daten mit Tag `product:<id>` (`src/lib/data/ogProduct.ts`).\n- Standard-OG-Bild `/de/og-image.png`, `/en/og-image.png` (Route `[locale]/og-image.png`, statisch): Papier-Raster, Tuschelinie mit Orbit um die Planet-Marke, Wortmarke, Zeile „Tattoos & Unikate aus Berlin“ / „Tattoos & one-offs from Berlin“, Coco `rennen` an der Linienspitze; alle übrigen Seiten verweisen absolut darauf; Rückfall `public/og/default.png` bei Fehlern.\n- Schriften: `pnpm fonts:copy` erzeugt offline `src/og/fonts/mansalva-400.ttf` und `bricolage-grotesque-600.ttf` aus `@fontsource/mansalva` bzw. neu `@fontsource/bricolage-grotesque` 5.3.0 (statisch) mit `wawoff2` 2.0.1 (beide exakt gepinnte Dev-Abhängigkeiten, ARCHITEKTUR §1.2), prüft Glyphen (Umlaute, ß, €, „“) und schreibt `src/og/fontMetrics.generated.ts` (Abdeckung + Laufweiten); Zeichen ohne Glyphe fallen im Bild weg, damit satori nie Schriften/Emoji aus dem Netz lädt. `check:bundle` meldet TTF/OTF unter `.next/static`.\n- Tests: unit `seo/og-text` (7, Titelkürzung), `fonts/og-fonts` (5: TTF, keine fvar, Glyphen, byte-gleich, ohne fetch, keine TTF in public/), `seo/og-render` (5: PNG 1200 × 630 DE/EN, Stempel nur bei sold, keine Netz-Anfrage); e2e `seo/og-image` (alle öffentlichen Seed-Stücke DE/EN: 200, image/png, 1200 × 630, sold mit Stempel, EN-Titel im Alt-Text und eigenes Bild; alle live-Seiten mit absolutem `og:image`) – grün gegen `pnpm dev` und gegen `next start` (dort og:image mit `NEXT_PUBLIC_SITE_URL`); `seo/*`, `seo.e2e`, `shop/product-routing`, `error-pages` grün; `pnpm check`, `pnpm build`, `check:versions`, `check:bundle --no-pages` grün; `test:int` grün bis auf das schon vorher rote `preview-export/determinism`. `check:external --built` meldet nur den schon vorhandenen Linkziel-Treffer `europa.eu/youreurope` (Gewährleistungs-Hinweis aus P3.3/P3.9), sonst keine Fremd-URL.

## 2026-09-28 – P3.13

- Metadaten R02–R05: Titel nach KONZEPT (Produkt `{Titel} – Nr. 017 · Planet Claire`, CMS-Titel hat Vorrang), Beschreibung aus `seo.metaDescription` bzw. erste 155 Zeichen (Wortgrenze, „…“), Listen aus `pages.seo` (shop/archive) bzw. Kategorie-SEO, sonst Vorlage; canonical/hreflang (de, en, x-default) absolut mit `NEXT_PUBLIC_SITE_URL`, `metadataBase`; Open Graph mit `og:type` product (R04, per `<meta>` aus `ProductSeo` im Produkt-Layout) bzw. website, `og:locale` + Alternate.\n- 404-Varianten (Produkt unbekannt/Entwurf/archiviert/„Zuhause“, unbekannte Kategorie, Seite hinter der letzten): `generateMetadata` in den `not-found.tsx` (`notFoundMetadata`), noindex, ohne canonical/hreflang.\n- JSON-LD `src/lib/seo/jsonld.ts` (umbenannt von `jsonLd.ts`): `Product` mit `Offer` (Preis als Zeichenkette aus Cent, InStock/SoldOut, Used/NewCondition, Marke, sku 3-stellig; Regelbesteuerung `priceSpecification.valueAddedTaxIncluded`, KU ohne Steuerangabe R-126), `BreadcrumbList` (`src/lib/seo/breadcrumbs.ts`) auf R02–R05.\n- Sitemap: öffentliche Stücke (available/reserved/sold mit Archiv) und alle Kategorien beider Sprachen mit Alternates und `lastmod` (`src/lib/data/sitemap.ts`, Tag `sitemap`, ISR 1 h, ohne DB nur feste Seiten); Seed nur außerhalb Produktion (öffentlicher Zugriff + eigener Filter).\n- Tests: unit `seo/jsonld` (Snapshot je Zustand × Steuermodus, Preis, Brotkrumen, Produkttexte), `seo/metadata` (+3); e2e `seo/meta` (canonical, hreflang, og je Seitentyp DE/EN, JSON-LD, 404-Varianten) und `seo/sitemap` (XML geparst: S01/S06 ja, S09/S18/Fixture analog S08 nein, EN-Slug, Alternates, kein Verwaltungspfad) grün; `seo.e2e` und `shop/*` (desktop) grün; `pnpm check`, `pnpm build` grün. `test:int`: alles grün außer `preview-export/determinism` (zwei Platzhalter-Zeichnungen `ph:shirt-*` unterscheiden sich zwischen zwei Export-Läufen – schon auf dem Ausgangsstand b4f650b rot, nicht SEO-bezogen).

## 2026-09-28 – P3.10

- ProductGallery (Scroll-Snap 4:5, Fokuspunkt, srcset card/detail, Punkte + Zähler, ab 768 px Pfeile + Miniaturen mit aria-current, erstes Foto fetchpriority=high), Lightbox als <dialog> (größte Größe, Klick/Doppeltipp 1×↔2×, Ziehen, Wischen, Pfeiltasten, Esc/Schließen/Browser-Zurück via pushState, Fokus zurück), mobile Kauf-Leiste (IntersectionObserver, inert wenn verborgen)\n- Module gallery/lightbox/buy-bar (2,4 KB gz, eigene Budget-Gruppe ≤ 4 KB), nach load geladen; Vorschau-Datei ohne Anfragen (Lightbox nutzt eingebettetes Foto)\n- Tests: Unit gallery/lightbox/buy-bar + Vertrag (AK-DS-18), E2E shop/gallery (desktop, iphone-15, reduced motion, ohne JS), @perf Zoom öffnen 72–112 ms (Gate 200), Vorschau-Export-Test ergänzt – grün

## 2026-09-28 – P3.9

- Produktseite Blöcke 7–11: Beschreibung + „Jutta sagt“, Details-Tabelle (KO-09b, Gewicht via formatWeight), „Herstellerin & Sicherheit“ (R-040, Warnhinweise DE immer, auf /en zusätzlich EN, Pflicht-Bausteine ergänzt), Versand & Rückgabe (Versandklasse mit DE-Preis, Abholung, Widerrufshinweis ohne V-19, Baustein returnCostsNote, Links R24/R25), WarrantyNotice (R-049), „Mehr aus {Kategorie}“ (ohne sold/aktuelles Stück)\n- Neu: src/lib/shop/productInfo.ts, src/components/shop/product/ProductInfo.tsx, getProductInfoSettings\n- Test-Stabilität: Fixture-Block je Projekt per Advisory-Lock serialisiert; Leerzustand-Test exklusiv\n- Tests: Unit product-info (8), E2E legal/gpsr (je Kategorie DE/EN), product-page (+7), forbidden (+R04 je Kategorie, V-31) – grün

## 2026-09-28 – P3.8

- `ProductPage` (Blöcke 2–6 in fester DOM-Reihenfolge): H1, Kurzdaten (Nr. · Unikat · Kategorie · Maße), `PriceTag` pinned + Steuer-/Versandhinweis + Lieferzeit (Abhol-Baustein bei `nur_abholung`), Pflichtangaben je Kategorie mit Bausteinen `product.*` (Keramik Deko/lebensmittelecht mit Link R27 `#glaze-<id>` nur bei aktiver Erklärung, Textil/Cap Fasern/Etikett fehlt/Größe/Zustand/Second-Hand, Schmuck Metallteile/Nickel/Kleinteile, Zeichnung Technik/Maße/Glasrahmen), Abweichungs-Kasten, Kaufbereich je Zustand (available/reserved/sold, Shop pausiert mit closedMessage) samt Liefergebiet-Satz (R-036). EN-Lücken mit `lang="de"` (`getUntranslatedFields`). Leinen-Preset `product`: Start unter der H1, `hook` am Knopf; Coco-Box 48×40. Engine unverändert 11 093 B gz.\n- R27-Einträge mit Anker `glaze-<id>`; Lock `holdConformityData` für Tests mit eigener Erklärung (Fußlink-Test geteilt); R31 im Verbotsmuster-Scan.\n- Tests: unit `tests/unit/shop/product-state.unit.spec.ts` (2) + Einstellungen; E2E `tests/e2e/shop/product-page.e2e.spec.ts` (10) und `tests/e2e/legal/product-info.e2e.spec.ts` (6, R-043/044/045/046/048, AK-3-07) in 3 Projekten grün; shop/legal/leash/home/perf/a11y/seo/privacy/footer/error-pages grün mit Debug-Build (Schriften-Tor-Test in home flackert unter Last, isoliert grün).

## 2026-09-28 – P3.7

- Produktseite `shop/[product]`: Auflösung nur über die führenden Ziffern (`parseProductSegment`), nicht kanonische Formen → 308 auf `productPath()`, Entwurf/archiviert/unbekannt → 404, verkauft + ausgeblendet → 404-Variante „Dieses Stück hat schon ein Zuhause gefunden“ (Layout meldet `isProductGone` per Kontext an `not-found.tsx`; Preset `lost` ohne Weglaufen, Links Shop/Archiv). ISR mit `generateStaticParams` (alle öffentlichen Stücke), `dynamicParams`.\n- Kurzlink R31 `/nr/[nummer]` (+ `/nr?nummer=` für das neue Nummernfeld der 404): 307 in die Sprache aus Accept-Language, Vary, no-store, kein Cookie; unbekannt → 404-Seite.\n- R04/R31 in der Registry gebaut; Beispiel-Parameter R04 = S01.\n- Tests: unit `tests/unit/shop/product-routing.unit.spec.ts` (7), int `tests/int/shop/data.int.spec.ts` (+2), E2E `tests/e2e/shop/product-routing.e2e.spec.ts` (6 × 3 Projekte) grün; shop/error-pages/seo/a11y/privacy grün (routing www-Test nur lokal rot: Port 3100 ≠ NEXT_PUBLIC_SITE_URL).

## 2026-09-28 – P3.6

- Archiv R05 (/de/archiv, /en/archive) samt statischer Varianten ?category=/?page=: H1, Satz „Schon ausgezogen – aber schön anzusehen“, Kategorie-Chips nur für Kategorien mit Archiv-Stücken (Slug der Seitensprache), Raster aller verkauften Stücke mit Archiv-Freigabe nach Verkaufsdatum (24 je Seite), Preis und statischer sold-Stempel (kein Knall beim Laden), Leerzustand „Noch ist nichts verkauft.“ mit Shop-Link, Schnur shopString; unbekannte Kategorie wird ignoriert, canonical ohne category.
- Tests: E2E tests/e2e/shop/archive.e2e.spec.ts (4 lesend je Projekt + 2 mit eigenen Stücken: Fixture analog S08 unsichtbar, Filter DE/EN, Reihenfolge, Leerzustand) und @a11y/SEO/Privacy/CSP für R05 DE/EN – grün gegen den Produktions-Build; Unit registry/transform-html angepasst.

## 2026-09-28 – P3.5

- Shop-Übersicht R02 und Kategorie-Seiten R03 (samt statischer Varianten ?available=1/?page=n aus Spike B-05) über eine gemeinsame Listen-Komponente: H1, Einleitung, Filter-Chips als echte Links (aria-current), Umschalter „nur verfügbare“, Raster aus Produktkarten, „Mehr zeigen“ als Link, Preis-Fußnote und Lieferzeile, Leerzustände KO-17, Hinweis „Shop pausiert“ über dem Raster; Kategorie unbekannt → 404, Slug der anderen Sprache → 308.
- Leinen-Preset shopString: die Linie läuft als Schnur durch jede Kartenreihe (Serpentine, Durchhang), Coco-Platzhalter am Schnuranfang, jede Reihe zeichnet sich beim Hineinscrollen.
- Querschnittsprüfungen (Barrierefreiheit, SEO, Datenschutz, Header, Verbotsliste) rufen Routen mit Parametern über Beispiel-Parameter auf (samplePath).
- Tests: Unit list-page (6) + leash/shop-string (8); E2E tests/e2e/shop/shop.e2e.spec.ts (10 je Projekt, u. a. 25 Fixture-Stücke 975–999, ohne JavaScript, 308/404, Shop pausiert) sowie @a11y/SEO/Privacy/CSP für R02/R03 DE/EN – grün gegen den Produktions-Build.

## 2026-09-28 – P3.4

- Komponenten `src/components/shop/`: `PriceTag` (KO-05, Varianten hanging/pinned/mini; Drehung, Fadenlänge, Kontur-Wackel und Stempelwinkel deterministisch aus der Nummer in `src/lib/shop/priceTag.ts`; Preis `formatMoney(…, tag)` + Sternchen, `Nr. 017`; Faden-Anker `data-leash-anchor="tag"` für die Schnur), `SoldStamp` (KO-06, aria-hidden, lang=en, rauer Rahmen mit Lücken, Druck-Maske), `Badge` (KO-10, sechs Arten, neue Icons `clock`/`plate-off`), `ProductCard` (KO-07, genau ein Link, aria-label mit Zustand, Foto 4:5 mit srcset thumb/card, erste zwei Karten eager), `src/components/media/ResponsiveImage.tsx` (feste Endhöhe, Dominanzfarbe, Fokuspunkt); Schraffur-Schatten `.u-hatch-shadow`. Callout (KO-22) besteht seit P2 unter `src/components/ui/`.
- Verhaltensmodule `price-tag-swing` (MI-02: Reihen-Eintritt nach 500 ms, 60 ms versetzt, Hover/Fokus) und `sold-stamp` (MI-03 nur bei Ereignis `pc:product-sold`, max. 3 Knalle, 120 ms gestaffelt), im Register und in der Vorschau-Laufzeit; bei reduzierter Bewegung aus.
- JS-Budget Mikro-Interaktionen jetzt je gemeinsam geladener Modulgruppe ≤ 4 KB (OFFENE-PUNKTE).
- Tests: `tests/unit/shop/price-tag.unit.spec.ts` (14), `tests/unit/shop/product-card.unit.spec.ts` (8, jsdom, AK-DS-10), `tests/unit/behaviors/price-tag-swing.unit.spec.ts` (6) und `sold-stamp.unit.spec.ts` (6, AK-DS-18), Vertragstest um beide Module erweitert; `tests/visual/shop-components.visual.spec.ts` angelegt (Referenzbilder entstehen in CI mit P3.16); `pnpm check` grün (855 Tests)

## 2026-09-28 – P3.3

- `src/lib/legal/snippets.ts`: alle 36 Bausteine aus ANFORDERUNGEN §6 (DE wörtlich, EN sinngemäß, Version `draft-1`, `sha256` des DE-Texts; 7 Schlüssel ohne Arbeitsfassung als Platzhalter laut DATENMODELL §6.28), `LEGAL_SNIPPET_REQUIRES_LAWYER`, `getSnippet` mit Fehler bei unbekanntem/unersetztem Platzhalter.
- Komponenten `src/components/shop/`: `PriceNote` (Steuermodus über `getTaxModeAt`, Kleinunternehmer-Baustein bzw. „inkl. 19/7 % USt.“ ab `validFrom`), `MoneyAmount`, `ShippingNoteLink` (R25), `DeliveryTime` (Versand/Abholung, R-035), `PriceFootnote` (feste id, einmal je Seite), `WarrantyNotice` (R-049, Platzhalter-Grafik `public/legal/`, EU-Link).
- `check:static` `money-usage`: `formatMoney` außerhalb `src/lib/` nur in PriceTag/PriceNote/MoneyAmount; Audit-Text der Preisänderung nach `src/lib/shop/priceChange.ts` verschoben. Lieferzeit-Einstellung lehnt vage Angaben ab.
- Tests: `tests/unit/legal/snippets.unit.spec.ts` (8), `tests/unit/shop/price-note.unit.spec.ts` (10, jsdom), `tests/unit/static/money-usage.unit.spec.ts` (3), `tests/unit/legal/forbidden.unit.spec.ts` (+3) – alle grün; `pnpm check`, `pnpm test:int` (44 Dateien), `pnpm build` grün

## 2026-09-28 – P3.2

- Spike B-05: Soll erfüllt. `src/proxy.ts` schreibt bekannte Listen-Parameter über `decideListVariant` (`src/lib/shop/listParams.ts`: `parseListParams`, `variantKey`, `parseVariantKey`, `canonicalListUrl`) auf `…/variant/<schlüssel>` um; interne Pfade direkt → 404; Proxy ohne Payload/DB (Import-Graph-Test).
- Prototyp-Variante R02 `[locale]/shop/variant/[variant]/page.tsx` (`generateStaticParams`, `dynamicParams`, ISR, canonical in Query-Form, bewusst ohne Preise); `matchSegments` ordnet Varianten der Liste zu; `check:static` erlaubt Varianten-Seiten für R02/R03/R05.
- `available` gilt laut KONZEPT §2.3 nur für R02/R03 (PLAN nennt auch R05; KONZEPT hat Vorrang).
- Ergebnis in ARCHITEKTUR Anhang B (B-05), OFFENE-PUNKTE §4 erledigt.
- Tests: `tests/unit/shop/list-params.unit.spec.ts` (11, grün); `tests/e2e/shop/list-variants.e2e.spec.ts` gegen `pnpm start` (3, grün, auch wiederholt: `?available=1` HIT, `?available=1&page=2` MISS→HIT); `pnpm check`, `pnpm build` grün

## 2026-09-28 – P3.1

- `src/lib/cache/cached.ts` (`cached(fn, { key, tags, revalidate })` über `unstable_cache`, Rückfall 3600 s; außerhalb von Next ungecacht)
- `src/lib/data/products.ts` (Shop-Liste mit zweistufiger Sortierung, Archiv, Einzelstück, verwandte Stücke, Stationen; Admin-Felder entfernt) und `src/lib/data/categories.ts` (Slug inkl. anderer Sprache → redirect, Navigation)
- `src/lib/shop/format.ts` (Nummer, Maße, Fasern, Zustand, Gewicht DA-9, `productPath`); `check:static` Regel `money-usage` (kein `toFixed`/`Intl.NumberFormat` mit `currency` in Shop, Komponenten, Seiten)
- Tests: `tests/int/shop/data.int.spec.ts` (9, grün), `tests/unit/shop/format.unit.spec.ts` (11, grün); `pnpm check` grün
## 2026-09-28 – P2 CI grün

- Phasenende-Lauf `[ci:full p2]` auf PR #2 grün (Kopf `3670d65`): `quick`, `e2e-full` (desktop, iphone-15 WebKit, pixel-7),
  `quality` (kein Debug im Build, visuelle Referenzen, Lighthouse, `@perf`), `Vorschau-Export`.
- Artefakt `planet-claire-vorschau-p2-3670d65` (Lauf https://github.com/mvheinz/planetclairetattoos/actions/runs/36416754832),
  PR-Kommentar mit Anleitung vorhanden, höchstens 3 Vorschau-Artefakte.
- Unterwegs behoben: Debug-Flag ohne `.env` nicht als Konstante eingesetzt; mobile LCP über 2,5 s (Schriften jetzt nach
  dem ersten Bild); Playwright-Cache ohne WebKit; `@perf`-Messung brauchte die Debug-Schnittstelle.

## 2026-09-28 – P2 Phasen-Abnahme (Designsystem, Tuschelinie, Vorschau-Datei)

- Alle Aufgaben P2.1–P2.29 erledigt: Sprachen/Routen, Design-Tokens, selbst gehostete Schriften, Icons/Wortmarke,
  Seitenrahmen mit Menü und Fuß (alle Pflichtlinks inkl. „Vertrag widerrufen“), SEO, Sicherheits-Header/CSP,
  Rechts-/Kontakt-/Widerruf-Gerüste, Tuschelinie A/B/C mit Coco-Platzhalter-Sprite, Fehlerseiten, Startseite,
  Datenschutz-, a11y-, Tempo- und visuelle Prüfungen, Vorschau-Export, Workflows `ci-full.yml`/`preview-export.yml`.
- Lokal grün: `pnpm check`, `pnpm test:int`, `pnpm build`, volle E2E-Suite gegen den Produktions-Build (Chromium und
  echtes WebKit; Leinen-Tests mit Debug-Build), `pnpm test:preview-export` (20 grün), `pnpm test:visual` (16, 3× stabil).
- Spikes in ARCHITEKTUR Anhang B: B-03 (Rückfall, ADR 0002), B-01 CSP-Teil (erfüllt), B-10 View Transitions (ADR 0003).
- Visuelle Referenzbilder lokal gegen den Produktions-Build erzeugt, weil das CI-Artefakt aus der Sandbox nicht
  abrufbar ist (OFFENE-PUNKTE); der CI-Job `quality` prüft sie gegen.
- Nächster Schritt: Lauf `[ci:full p2]` (quick, e2e-full, quality, Vorschau-Export) grün → Merge, dann P3.1.
  Stolpersteine: Leinen-E2E brauchen einen Build mit `NEXT_PUBLIC_LEASH_DEBUG=1`; visuelle Tests nur gegen `pnpm start`.

## 2026-09-28 – P2.29

- `LEGAL_TRACE_PHASE = 2`; neuer R-001-Test prüft R-010, R-011, R-090, R-130, R-131, R-191 samt Gegenprobe mit fehlender P2-ID.\n- Verbotsmuster-E2E über das gerenderte HTML aller live-Routen (DE/EN, 404/500, Weiterleitung): `tests/e2e/legal/forbidden.e2e.spec.ts` (Name laut ANFORDERUNGEN §5 statt `forbidden-html`, OFFENE-PUNKTE), prüft vorher den Kleinunternehmer-Modus; Gegenprobe für OS-Link, „inkl. MwSt.“, Tracker, vorbelegte Checkbox.\n- ANLEITUNGEN: neuer Abschnitt V0 „Vorschau-Datei ansehen“ (Checks → Summary → Artifacts, ZIP entpacken, doppelklicken); G6 nennt den Ablauf „Vorschau-Export“; AUFGABEN A21 verlinkt V0.\n- qa-log: Eintrag zum Kalibrierbogen + INDEX.md; Bogen liegt mit 240 KB über dem Ablagebudget 150 KB (OFFENE-PUNKTE, P9.2).\n- Tests: pnpm check (766) grün, pnpm test:int grün, E2E forbidden desktop + iphone-15 (52) grün.

## 2026-09-28 – P2.28

- `ci-full.yml`: Auslöser pull_request/workflow_dispatch; Job `mode` liest die Kennung ohne Checkout (`gh api`), Ausgaben full/phase/snapshots/art/sha7; Jobs `e2e-full` (Build mit Debug-Flag, desktop/iphone-15/pixel-7 ohne @visual/@perf), `quality` (Build ohne Debug, check:no-debug, test:visual, test:perf, @perf pixel-7), `snapshots` (test:visual --update-snapshots, Pflicht-Upload visual-snapshots-<sha7>, 2 Tage); Fehlerberichte hinter dem Budget-Schritt.\n- `preview-export.yml`: Job `export` nur bei `[ci:full pN]`/Dispatch; preview:export → test:preview-export (eigener Schritt) → Upload planet-claire-vorschau-<phase>-<sha7> (30 Tage) → nur 3 neueste behalten → Kurzanleitung → PR-Kommentar (R-182).\n- Fehlende visuelle Referenzen: Hinweis statt rot (OFFENE-PUNKTE); erste Referenzen per [ci:update-snapshots] stehen noch aus.\n- Tests: workflows.unit.spec.ts 32 grün (Kennungs- und Aufräum-Skripte mit Ersatz-gh in bash ausgeführt); actionlint sauber; pnpm check grün.

## 2026-09-28 – P2.27

- `adminViews.ts` (KONZEPT §7.3–§7.15 mit Phase; in P2 Anmeldung, Liste, Formular – Rest „kommt in P5/P7“) und `adminShots.ts` (Anmeldung mit `SEED_ADMIN_*` aus `.env.example`, 390×844 DPR 2 → WebP 780 px q70, Uhr fest auf `SEED_NOW`, nur Export-Server erreichbar).\n- `report.ts`: `PreviewReport` mit zod, Budget 20/40 MB mit Stufung (q60, dann 1000 px), Richtwert-Warnungen, über 40 MB Exit 1; `phase.ts`: `PREVIEW_PHASE` → PLAN.md (höchste vollständig abgehakte Phase) → `px`, nie Branch-Name.\n- `playwright.preview.config.ts` (`pv-mobile` 390×844, `pv-desktop` 1440×900, offline) und `tests/e2e/preview-export.e2e.spec.ts` (KONZEPT §12.7 Nr. 1–9, CSP-Meta, kein Cookie/Storage, Bericht nennt jede Registry-Route; Nr. 7 mit Shop/Kasse/Formular übersprungen bis P3/P4/P7, Dialog per eingefügtem Formular geprüft); `pnpm test:preview-export`.\n- Export-DB: Uhrzeit-Zeitstempel des Laufs → `SEED_NOW` (byte-gleiche Fotos, OFFENE-PUNKTE).\n- Tests: unit `preview-export/{report,phase}` (13), e2e 20 grün (2 übersprungen: Nr. 7 ab P3/P4/P7), Determinismus-Test mit Fotos grün; `pnpm check`, `pnpm test:int` grün. Datei ≈ 0,88 MB, Budget ok.

## 2026-09-28 – P2.26

- Umwandlung `scripts/preview-export/transform/{html,css,images,fonts,svg,links}.ts` (cheerio): Skripte/Preloads/Next-Daten raus, je Route ein `<template data-route …>`, ein `<style>` mit Schriften als Data-URI, Bilder per sharp (≤ 1200 px, WebP q70, dedupliziert) in `#pv-assets`, Coco-Sprite als `#pv-sprites` mit `<use href="#id">`, Links/Formulare nach KONZEPT §12.5, Zusatzseiten `#/vorschau/nicht-enthalten` und `#/vorschau/verwaltung` (DE/EN, Texte `previewExport.*`), Kopf mit `robots noindex` + CSP-Meta.\n- Laufzeit `src/preview-runtime/{main,router,assets,dialogs,cartDemo,banner,leash,types}.ts` (framework-frei, esbuild iife ≈ 50 KB): Hash-Router mit Aufräumen/Einhängen von Verhaltensmodulen und Tuschelinie, Fokus auf H1, `window.__PV_ROUTES`, Dialog „Vorschau – hier wird nichts gekauft“, Korb nur im Speicher, Banner (R-182) mit „Alle Seiten“.\n- `write.ts` deterministisch (sortiert, keine Zeitstempel); Export-Adresse in Texten → echte Domain.\n- `ci.yml`: Playwright-Chromium wird jetzt vor den Integrationstests installiert (Export-Test braucht ihn).\n- Tests: unit `preview-export/{transform-html,transform-css,links,router}` (31), int `determinism` (AK-A-14-01/02, Build + `--skip-build` byte-gleich, ≈ 2,5 min); `pnpm check`, `pnpm test:int` grün; Datei lokal ≈ 0,76 MB.

## 2026-09-28 – P2.25

- `pnpm preview:export` (`scripts/preview-export/`): Ablauf §14.2 mit Exit-Codes 0/1/2 (deutsche Anleitung bei fehlendem Postgres/Chromium), Server immer im `finally` beendet, Optionen `--skip-build`/`--keep-server`.\n- `env.ts` (Export-Umgebung §14.3, `SEED_NOW` = Exportdatum 12:00 Berlin), `db.ts` (`planetclaire_preview_export` anlegen, leeren, migrieren, `seed:base` + `seed:example`), `server.ts` (Build nach `.next-preview` ohne Debug-Flag, `next start -p 3999`, Warten auf `/api/health` ≤ 120 s), `crawl.ts` (Start-Menge aus der Registry + `/de/__404`/`/en/__404`, Breitensuche ≤ 500, Filter §14.4, nur Pfade des Export-Servers).\n- `tsconfig.json` enthält `.next-preview/types`, damit `next build` die Datei nicht umschreibt; `cheerio` als Dev-Abhängigkeit.\n- Tests: unit `preview-export/{env,crawl-filter}` (15), int `preview-export/exit-codes` (3, AK-A-14-03); `pnpm check`, `pnpm test:int` grün; Export lokal gelaufen (20 Seiten).

## 2026-09-28 – P2.24

- playwright.visual.config.ts (Chromium desktop 1440×900 + mobile 390×844, reduzierte Bewegung, maxDiffPixelRatio 0,01, Referenzen tests/visual/__screenshots__/**/*-linux.png), tests/visual/{helpers,shell,pages}.visual.spec.ts: R01, Impressum, R26, 404, 500, Kopf, offenes Menü, Fuß; Uhr fest, fonts.ready, Fremd-Hosts blockiert; nur Linux
- pnpm test:visual (für P2.28/Job snapshots); Referenzbilder entstehen erst in CI, lokal erzeugte Probe-Bilder verworfen
- Lokal geprüft: --update-snapshots 16/16, zweiter Lauf 16/16 stabil; Token --paper absichtlich auf #DDE8F4 → 16/16 scheitern (Ratio 0,72), zurückgesetzt → grün
- Tests: 3 Unit (Konfiguration T-12), 16 visuelle Tests; pnpm check grün

## 2026-09-28 – P2.23

- tests/perf/budgets.json (alle Grenzen aus ARCHITEKTUR §7.7/DESIGN §9.10), check:bundle misst per Chromium gegen next start jede live-Route DE/EN + R28/R29 (JS vor load, gzip 9), Pfaddaten, SVG der Startseite, Module (inkl. Mikro-Interaktionen), SVG-Dateien, Schriften
- Erstlade-JS von 170 auf 144 KB gz gesenkt (kein NextIntlClientProvider, Fehleransichten per React.lazy), R01 144 KB (Ziel 140 verfehlt – nur Bericht)
- Lighthouse-CI @lhci/cli 0.15.1 (tests/perf/lighthouserc.cjs, mobil, 3 Läufe, filesystem, Playwright-Chromium), pnpm test:perf mit Tabellenbericht: R01 LCP 2,28 s, CLS 0, TBT 101 ms, 0,30 MB
- @perf tests/e2e/perf.e2e.spec.ts (pixel-7, CPU 4×): Menü öffnen 96–120 ms, CLS 0,004, leash:frame p95 2,1 ms
- ci.yml: Playwright-Installation vor Budgets
- Tests: 15 Unit (T-09 inkl. CLI-Abbruch mit Fixture-Budget, T-10 Konfig/Bericht), check:bundle grün, test:perf grün, 3 @perf grün; pnpm check, test:int, E2E komplett (481) grün

## 2026-09-28 – P2.22

- `@axe-core/playwright` 4.13.0 exakt gepinnt; `tests/e2e/a11y.e2e.spec.ts` @a11y: axe (wcag2a/2aa/21a/21aa/22aa) auf allen live-Routen DE/EN sowie offenes Menü, 404, 500, Rechtsseite mit Platzhalter und Leerzustand der Startseite (home kurz auf Entwurf, Abruf im Draft-Modus ohne Cache-Schreiben, Advisory-Lock); Gate 0 serious/critical, moderate/minor als Annotation; `lang` je Seite (EN-Rückfall auf Deutsch als `lang="de"`).\n- `tests/e2e/keyboard.e2e.spec.ts`: Skip-Link zuerst und springt zu `#inhalt`, jedes fokussierbare Element per Tab erreichbar (vorwärts/rückwärts), Kopf→Menü (Falle, Esc), Fuß: Schalter „Animationen“ per Leertaste/Enter, Sprachumschalter; Fokus an jedem Halt sichtbar (Screenshot mit/ohne Fokus verschieden; Gegenprobe ohne Fokusring schlägt fehl). WebKit: Alt+Tab (Safari-Tastaturbedienung für Links).\n- Keine Verstöße im Produktcode gefunden.\n- Tests: a11y 84 + keyboard 18 E2E grün in 3 Projekten; Gesamtlauf `pnpm test:e2e` 478 grün.

## 2026-09-28 – P2.21

- `tests/e2e/privacy.e2e.spec.ts` @privacy: alle live-Routen (R01, R20–R27 je DE/EN, 404/500 je Sprache, Weiterleitung `/`) in frischem Kontext, 3 Projekte: keine Cookies, kein `Set-Cookie`, Local/Session Storage, IndexedDB und Service Worker leer; Requests nur eigener Origin/`data:`/`blob:`, nie Google Fonts; Registry-Abdeckung geprüft.\n- `pnpm check:external --built` prüft jetzt auch Fremd-URLs in öffentlich ausgelieferten Dateien (HTML/RSC + transitiv geladene Chunks), Allowlist Instagram + nie geladene Kennungen.\n- Tests: 72 E2E grün (desktop, iphone-15/WebKit, pixel-7), Unit check-external 2 grün, check:external ok.

## 2026-09-28 – P2.20

- Startseite R01 aus `pages:home` (`src/lib/data/home.ts`, öffentlicher Payload, Name aus `settings.business.tradeName`): Kopf-Station „Planet Claire“ mit Planet-Marke (Anker `orbit`, Intro MI-10) und 7 Stationen (`HomeStation`, KO-21): Stationsmarke Planet/Stern mit MI-12-„pop“, Kicker „Station 01“ (Plex Mono), H2 Mansalva, Text, Stationszeichnung (`src/art/stations` bzw. Ersatzzeichnung), Link „Alle …“ (Kategorie-Slugs je Sprache). Schlaufen je Station laut §11.4 (right/lasso/left/spiral/right/contour/left), Coco-Posen aus `cocoPose`; ab 768 Zeichnung links an der Rinne, damit die Linie keinen Text kreuzt. Keine Produktkarten (W-33). Fehlt `home`: Leerzustand (DM-PAGE-01).\n- Engine: `data-leash-reached` an erreichten Stations-Ankern (für MI-12).\n- Tests: int `pages/home-data.int.spec.ts` (4), e2e `home.e2e.spec.ts` (Reihenfolge DE/EN, ohne JS, Linie zeichnet beim Scrollen, mobil LCP < 2,5 s / CLS < 0,1) grün; volle E2E-Suite grün bis auf den vorbestehenden WebKit-Menütest; `pnpm check`, `test:int`, `build`, `check:bundle` grün.

## 2026-09-28 – P2.19

- 404 R28 „Coco hat sich losgerissen“ / „Coco slipped her leash“ (NotFoundContent): Preset `lost` für jede Adresse ohne Registry-Route, Tuschelinie vom Kopf in Schlingen (`coil`), Leinenende = offener Karabiner mit leerem roten Geschirr (Tuschestrich-Zeichnung `src/art/errorArt.ts`), Coco `horizon` rennt einmal weg und die Leine schwingt 2 × (Modul `lost`, MI-11, ≤ 5 s); CMS-Text `not_found` mit Rückfall-Satz; Links Start, Shop, Tattoo; Variante „Zuhause“ als Prop vorbereitet.\n- 500 R29 (`error.tsx`, `global-error.tsx`): Knäuel aus 3 Schlingen, Coco `kopfschief` xl, „Nochmal versuchen“ (`retry()`), Link Start, Fußbereich; ohne Preset, Engine abgebaut, keine Animation (`body[data-page-error]`). Test-Auslöser `/<sprache>/__fehler-test` wirft nur bei APP_ENV=test (Playwright-Webserver setzt es), sonst 404; nicht in Registry/Sitemap.\n- Abweichung: kein `[...rest]` – Next 16.3 liefert dafür nur eine leere Fehler-Hülle; 404 bleibt bei `global-not-found` (OFFENE-PUNKTE).\n- Tests: e2e `error-pages.e2e.spec.ts` 8 Tests × 3 Projekte grün (inkl. ohne JS, reduzierte Bewegung); Unit `art/error-art` + Verhaltensvertrag `lost`; volle E2E-Suite gegen Produktions-Build grün bis auf den vorbestehenden WebKit-Menütest; `pnpm check`, `test:int`, `build` grün.

## 2026-09-28 – P2.18

- Coco-Platzhalter-Sprite mit allen 22 Symbolen (6 Posen × A/B/C + 4 Brücken), gezeichnet im Tuschestrich mit Fell-/Geschirr-Wash, D-Ring-Anker, `data-part`-Gruppen, nur `<path>`; `pnpm art:coco-placeholder` (Generator), `pnpm art:sprite` (SVGO → `public/art/coco-sprite.v1.svg` ≈ 42,9 KB / 11,5 KB gz, `coco-sprite.json`), Kalibrierbogen `docs/design/qa-log/img/calibration-p2-placeholder.webp` (`pnpm art:calibration`).\n- `src/leash/coco.ts` (≈ 1,7 KB gz): Posenwechsel nur an Frame-Grenzen, Brücken (bremsen, abspringen, einrollen), Boil-Budget (höchstens 5 s ohne Aktion), reduzierte Bewegung = Ruhe-Pose Frame A. `src/components/Coco.tsx` + `src/styles/coco.css` (feste Box je Größe, kein CLS, forced-colors).\n- Coco läuft an der Leinenspitze der Startseite, sitzt im Menü (kopfschief) und in leeren Zuständen; Sprite mit `Cache-Control: immutable`.\n- View Transitions mit Coco: weich (React-`<ViewTransition>`, nicht zu/von calm, nicht bei reduzierter Bewegung) und hart (`view-transition-name: coco`); ADR 0003 ergänzt.\n- Tests: unit `tests/unit/art/sprite.unit.spec.ts` (12), `tests/unit/leash/coco.unit.spec.tsx` (11), Budgets in `check:bundle`; e2e `tests/e2e/coco.e2e.spec.ts` (8) – ganze E2E-Suite gegen `pnpm start` grün (266), `check:no-debug` grün.

## 2026-09-28 – P2.17

- `src/leash/static.ts`: statischer Renderer Stufe C (≈ 2,2 KB gz) – Randlinie auf Rechtsseiten, H1-Unterstreichung auf calm; die Laufzeit nutzt ihn bei reduzierter Bewegung. Rechtsseiten laden die Engine nicht.\n- Reduzierte Bewegung: Linie sofort vollständig, kein Intro, Coco ruht in der Ruhe-Pose (`REST_POSE`, §10.6) an Station 1; Umschalten ohne Neuladen.\n- Debug nur mit `NEXT_PUBLIC_LEASH_DEBUG=1`: `window.__leash` inkl. `pose()`, `setReadingY(y)`; `window.__qa` (frames, loaf, longtasks, shifts, events, poseLog, marks, start/stop/dump). `pnpm check:no-debug` neu; Modul-Budgets in `check:bundle`.\n- Tests: unit runtime (+5), static (4), check-no-debug/Budgets (3); e2e `reduced-motion.e2e.spec.ts` (AK-DS-14, AK-DS-03 R01/R21, Schalter, Rechtsseite ohne Engine) gegen `pnpm start` grün; `check:no-debug` grün (Gegenprobe mit Debug-Build schlägt an).

## 2026-09-28 – P2.16

- `src/leash/measure.ts` (eine Lesephase), `runtime.ts` → `mountLeash` mit Stufen A (Maske)/B (Feder)/C, Abstufung A → B nur im Speicher, Segment-Zuständen, Lesezeile 0,72, monotoner Tinte, Coco-Glättung, Neuaufbau (ResizeObserver, fonts.ready, load; 150 ms entprellt, < 120 px Höhe ignoriert), IntersectionObserver-Pause, journey-Intro und Leinen-Anschluss.\n- React-Hüllen `src/components/leash/{LeashLayer,Station,ViewTransitionOptIn}.tsx`; Laufzeit lädt nach LCP + 300 ms bzw. load + 1200 ms per Idle (`schedule.ts`), nie auf legal/calm; `window.__leash`-Grundumfang (`debug.ts`) nur bei NEXT_PUBLIC_LEASH_DEBUG=1.\n- Spike View Transitions → ADR 0003 (harte Navigation per @view-transition unter no-preference, ohne calm).\n- Tests: unit runtime (12, AK-DS-18) + motion (3); e2e tests/e2e/leash.e2e.spec.ts (AK-DS-13, AK-DS-15, Chunk-Analyse, legal ohne Laufzeit, View Transitions) gegen dev und start grün; Engine-Chunk 8,6 KB gz.

## 2026-09-28 – P2.15

- `src/leash/` Kern ohne DOM: `types.ts` (wörtlich DESIGN §9.1), `random.ts` (fnv1a32, mulberry32, valueNoise1D), `presets.ts` (Tabelle §9.7 für alle 11 Presets, Wackel, Rinnen, Scroll-Wege), `poses.ts` (COCO_POSE_TO_SPRITE).\n- `geometry.ts`: buildGeometry mit Schritten 1–11 (§9.3), allen Schlaufenformen (§9.5) inkl. Freiraum-Regel, Tintenpunkten, Verjüngung, Segmenten, LUT und scrollMap (§9.6); dazu mapReadingY/pointAt.\n- Tests: unit tests/unit/leash/{random,geometry,loops,poses}.unit.spec.ts (26 Tests, AK-DS-12); Median journey 390×844 ≈ 3 ms in Node; Pfaddaten ≈ 18 KB mobil / 23 KB Desktop.

## 2026-09-27 – P2.14

- Kontakt R20 (Preset margin) aus pages:contact mit Kontaktwegen aus getPublicSettings() (mailto mit Betreff, Instagram-Profil und DM-Link, Studio-Bezirk), Hinweise „Vertrag widerrufen“ und Impressum, kein Formular; ohne Seite neutraler Leerzustand (DM-PAGE-01).\n- „Vertrag widerrufen“ R26 (Preset calm, dynamisch, noindex/follow): h1, Hinweis „noch ohne Funktion – kommt in P6“, Link zur Widerrufsbelehrung, E-Mail als Alternative.\n- Gerüst-Komponente ScaffoldPage entfernt (alle Gerüstseiten ausgebaut).\n- Tests: e2e contact-withdraw (17 grün, 4 nur-desktop übersprungen), Fußlink-Prüfung 7 Links × DE/EN auf allen Live-Seiten = 200; bestehende Frontend-E2E (135) grün; pnpm check, test:int, build grün.

## 2026-09-27 – P2.13

- Rechtsseiten R21–R25 aus der gültigen legal-texts-Fassung (Loader src/lib/data/legal.ts, Tokens ersetzt, Lexical als Server-HTML mit h1→h2), Platzhalter-Band, „Stand“, EN-Rückfall auf Deutsch, neutraler Leerzustand statt 500; R24 mit Muster-Formular und Link „Vertrag widerrufen“; R25 nur Text (Tabelle P4).\n- R27 mit Einleitung aus pages:conformity (falls vorhanden) und Liste aktiver Erklärungen, sonst fester Satz.\n- Ruhe-Modus: keine Animation/Transition im <main> bei Preset legal/calm (global.css).\n- Tests: e2e legal-pages (48 grün, 3 Geräte), int public-pages (8 grün); pnpm check, test:int, build grün.

## 2026-09-27 – P2.12

- `src/lib/security/csp.ts` (Kontexte `public`, `dynamic`, `checkout`, `admin`, `api` nach §8.1; Fremd-Hosts nur Stripe auf der Kasse bei `PAYMENTS_DRIVER=stripe`; Nonce je Anfrage) und `headers.ts` (allgemeine Header, HSTS nur production/staging, `X-Robots-Tag` außerhalb production, Token-Seiten, Kasse, Verwaltung). Anwendung: `next.config.ts headers()` für alle Pfade (`public`) und `/api/*` (`api`), der Proxy überschreibt für Nonce-Kontexte (R26 jetzt dynamisch gerendert, Verwaltung); genau ein CSP-Header je Antwort.
- Spike B-03: Soll (SRI + Hash) scheitert an den Inline-RSC-Daten von Next → Rückfall `'unsafe-inline'` im Kontext `public`, nur `'self'` (ADR `docs/adr/0002-csp-script-src.md`, ARCHITEKTUR Anhang B). CSP-Teil B-01: Verwaltung läuft mit Nonce ohne Verstoß (Soll erfüllt).
- `pc-motion`-Hash aus `inlineScripts.ts` in `dynamic`/`checkout` neben der Nonce; `security/{csp,headers,inlineScripts}.ts` ohne `server-only` (von `next.config.ts` geladen, Ausnahme im Static-Check); Stripe-Hosts nur in diesen Dateien erlaubt. Gegenprobe in `admin-privacy.e2e.spec.ts` umgeht die CSP (`bypassCSP`), weil die CSP die Probe-Anfrage jetzt selbst blockiert.
- Tests: unit `tests/unit/security/headers.unit.spec.ts` (12; T-16, R-131 gegen DIENSTE-YAML, Hash-Abgleich), e2e `tests/e2e/security-headers.e2e.spec.ts` (AK-A-8-01, R-136, keine CSP-Verstöße auf live-Routen und in Login/Liste/Bearbeiten); volle E2E-Suite 183 grün (Produktions-Build, 3 Projekte), `pnpm check`, `pnpm test:int`, `pnpm build`, `check:external --built` grün.

## 2026-09-27 – P2.11

- `src/lib/seo/metadata.ts` → `buildMetadata(routeId, locale, params)`: Titel „{Seite} · Planet Claire“ (Start „Planet Claire – {Claim}“), Beschreibung je Seitentyp aus den Nachrichten (`seo.descriptions`, 120–160 Zeichen), Open Graph mit Standardbild, `robots` aus der Registry; canonical + hreflang `de`/`en`/`x-default` (absolute Apex-URLs aus `NEXT_PUBLIC_SITE_URL`) nur auf indexierbaren Seiten. Alle Seiten nutzen `routeMetadata(id)`.
- Organization-JSON-LD auf R01 (Name, URL, Logo, `sameAs` Instagram, ohne Adresse); `https://schema.org` als Bezeichner in die URL-Allowlist von `check:static` aufgenommen.
- `src/app/robots.ts` + `src/lib/seo/robots.ts` (Produktion `Allow` + Sperrliste aus der Registry + Sitemap, sonst `Disallow: /`, nie `ADMIN_ROUTE`), `src/app/sitemap.ts` (live + indexierbar, beide Sprachen mit Alternates); `X-Robots-Tag: noindex, nofollow` außerhalb der Produktion über `next.config.ts headers()`, für Weiterleitungen/404 des Proxys im Proxy.
- Tests: unit `tests/unit/seo/metadata.unit.spec.ts` (10), e2e `tests/e2e/seo.e2e.spec.ts` (AK-2-04, AK-2-05, AK-A-4-03, T-07, R26 `noindex, follow`) – 78 E2E grün (3 Projekte, Produktions-Build); `pnpm check`, `pnpm build`, `check:external --built` grün.

## 2026-09-27 – P2.10

- Fußbereich `SiteFooter` (KO-04, liegt wie die übrigen Rahmen-Bausteine unter `src/components/layout/`) in DOM-Reihenfolge: „Vertrag widerrufen“ als Knopf-Link → R26, `LegalFooter` (6 Pflichtlinks, Konformitätserklärungen nur bei aktiver Erklärung), `nav#fussnavigation` mit Menüliste + Instagram, Sprachumschalter, Schalter „Animationen“ (`src/behaviors/motion-toggle.ts`, `aria-pressed`, „aus (Systemeinstellung)“, `pc-motion` erst nach Klick, Vorschau nur im Speicher), Platz für Preis-Fußnote, „© {Berliner Jahr} Planet Claire · Berlin“.
- Damit der Fuß auch auf 404/500 steht, gibt es minimale Grundformen: `[locale]/not-found.tsx`, `src/app/global-not-found.tsx` (Next `experimental.globalNotFound`, Kopf und Fuß schon im HTML) und `[locale]/error.tsx`; Gestaltung, Coco und Fehler-Auslöser folgen in P2.19. Gemeinsames Dokument `SiteDocument`, `RouteOverride` für 404 ohne Registry-Route.
- Tests: e2e `footer.e2e.spec.ts` @smoke (R-011, R-090, AK-3-11, AK-DS-09; 390/1440, reduce/no-preference, ohne JS) und `motion-toggle.e2e.spec.ts`; unit `motion-toggle.unit.spec.ts`, `footer-links.unit.spec.ts`; 102 E2E (3 Projekte, gegen Produktions-Build), `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P2.9

- MenuOverlay (KO-03): serverseitiges <dialog id="menu" aria-label="Menü"> mit Hauptliste (Start · Shop · Archiv · Auftragsarbeiten · Tattoo · Über mich & Coco · Kontakt), Kategorien aus categories (showInNavigation, src/lib/data/navigation.ts, gecacht, ohne DB robust), Tattoo-Unterseiten aus der Registry, unten Sprachumschalter, Instagram und Pflichtlinks inkl. „Vertrag widerrufen“, Coco-Platz\n- Verhaltensmodul src/behaviors/menu.ts: showModal, Fokus auf ersten Link, eigene Tab-Falle (auch Safari), Esc/„Schließen“ mit Fokus zurück, html[data-menu-open] (overflow hidden + scrollbar-gutter stable), MI-05 per WAAPI (≤ 700 ms), Linkklick schließt sofort; bei reduzierter Bewegung ohne Animation\n- LinkUnderline (MI-06, 3 Pfade per Hash des href) an Menü- und Kopflinks; ohne JS führt „Menü“ zu #fussnavigation\n- Tests: e2e tests/e2e/menu.e2e.spec.ts @smoke (AK-DS-08, ohne JS; 21 grün in 3 Projekten inkl. WebKit), Vertragstest AK-DS-18 um menu ergänzt; pnpm check, pnpm build grün

## 2026-09-27 – P2.8

- Seitenrahmen AppShell (KO-01): Skip-Link → SiteHeader → Vorschau-Banner → <main id="inhalt"> mit Linien-Ebene als Geschwister; <body data-preset>/<data-route> aus der Registry über die Layout-Segmente (PresetBody), <html data-motion> per festem Inline-Skript pc-motion (src/lib/security/inlineScripts.ts mit sha256-Hash für P2.12)\n- SiteHeader (KO-02): Wortmarke bzw. unter 375 px Planet-Marke, Shop/Tattoo (aria-current), Korb mit immer reserviertem Platz für die Anzahl (cart-count), Menü-Link #fussnavigation mit aria-controls/-haspopup/-expanded, handgezeichnete Unterkante in 3 Varianten nach Routen-Seed\n- Vorschau-Banner nur bei SEED_PREVIEW_MODE=true und APP_ENV≠production, im Export mit Phase\n- Tests: e2e tests/e2e/shell.e2e.spec.ts @smoke (AK-DS-07 bei 320/360/390/1440, Korb-Cookie, Skip-Link, Banner; 27 grün in desktop/iPhone-WebKit/Pixel), unit tests/unit/layout/shell.unit.spec.ts (15); pnpm check, pnpm build grün

## 2026-09-27 – P2.7

- Grundbausteine unter src/components/ui/: Button (Primär/Sekundär/Text, KO-11), Field/Select/Checkbox/Radio/RadioGroup (KO-12), EmptyState (KO-17-Rahmen mit Coco-Platz), Callout (KO-22), PlaceholderBanner (R-002), LinkUnderline (MI-06, für Sekundärknopf und Menü)\n- Checkbox/Radio haken nur bei ausdrücklichem checked=true an; Knopf-/Auswahl-Zielflächen ≥ 44 px\n- Tests: unit tests/unit/components/ui.unit.spec.tsx (14, jsdom + Testing Library); pnpm check, test:int grün

## 2026-09-27 – P2.6

- src/behaviors/types.ts (mount → unmount), Register src/behaviors/index.ts mit mountBehaviors (lädt per import() nur Benötigtes), BehaviorHost im Layout (bindet bei Routenwechsel neu)
- erstes Modul cart-count: liest pc_cart nur, wenn vorhanden, setzt nichts; MI-07 (scale 1→1.25→1, 240 ms, --ease-stamp), bei reduzierter Bewegung sofort; Vorschau zählt nur im Speicher
- Tests: unit behaviors/contract (10: AK-A-15-02, AK-A-2-03 inkl. transitiver Importe, AK-DS-18 mit Listener-/Observer-/Timer-/Animations-/Speicher-Protokoll, Gegenproben), cart-count (8), leash/motion (2); pnpm check, test:int, build, E2E (75) grün

## 2026-09-27 – P2.5

- 18 handgezeichnete Icons (src/art/icons, je ≤ 600 B) → pnpm art:icons → Inline-SVG-Komponente Icon (aria-hidden, mit label role=img)
- pnpm art:brand: Wortmarke (4,4 KB, Mansalva-Umrisse, Planet als i-Punkt), icon.svg, favicon.ico (16/32), apple-icon.png (180), public/og/default.png (1200×630); Komponente WordmarkLink; Verwaltung mit eigenem Logo/Icon/Favicon
- Tests: unit icons (9: Bestand, Größe, Attribute, Freshness, aria, Name „planet claire – Startseite“, ICO/PNG-Maße); Build grün, alle Dateien per pnpm start mit 200 vom eigenen Origin geprüft; pnpm check, test:int grün

## 2026-09-27 – P2.4

- Fontsource-Pakete, subset-font, fontkit als Dev-Abhängigkeiten; `pnpm fonts:copy` (scripts/fonts/copy.ts) erzeugt 3 WOFF2 unter src/styles/fonts (98,6 KB) und die Mansalva-Abdeckung
- next/font/local in src/styles/fonts.ts (Mansalva/Bricolage mit Preload, Plex Mono ohne), Klassen am <html>; GlyphFallback + .glyph-fallback (Bricolage 600)
- check:bundle prüft AK-DS-04 (genau 3 .woff2, ≤ 100 KB, keine Google-Fonts-Verweise)
- Tests: unit glyphs (5, AK-DS-05) und fonts/copy (6: Determinismus, Budget, Achse 400–700, eingecheckt = erzeugt, check:bundle); pnpm check, test:int, build + check:bundle grün

## 2026-09-27 – P2.3

- src/styles/tokens.css wörtlich aus DESIGN §7 (von Prettier ausgenommen; Test vergleicht Byte für Byte); src/styles/global.css: Reset, Typografie §4.2/§4.3, Links §3.2, Fokus-Ring, Container/Rinne je Preset (data-preset), Ebenen, Sticky/scroll-padding, Schneidematten-Raster §3.4, Bewegungsreduktion (prefers-reduced-motion und html[data-motion=reduced]), forced-colors, Druck; eingebunden im [locale]-Layout\n- Ruheseiten ohne eigene Routengruppe; Ruheseiten-Ordner kommen aus der Registry (Presets calm/legal)\n- Tests: tests/unit/design/{contrast,lint-colors,lint-shadows,lint-motion}.unit.spec.ts (AK-DS-01, -02, -06, -16; mit Negativproben), Helfer tests/helpers/designLint.ts; pnpm check, test:int, build grün; 390 px geprüft (kein Querscrollen)

## 2026-09-27 – P2.2

- src/proxy.ts: Reihenfolge www→Apex (308) → Verwaltung (ADMIN_ROUTE-Umschreibung, /admin 404) → Schrägstrich (308) → Sprachlogik → next-intl-Middleware; nie Set-Cookie\n- Reine Entscheidung decidePublicRoute (src/lib/routes/redirects.ts): / und unpräfixierte Pfade 307 nach Accept-Language mit Vary (übersetzt), Pfad der anderen Sprache und Aliasse 308; pickLocale als reine Funktion (src/i18n/pickLocale.ts)\n- Sieben Kurz-URLs (R-010) als statische redirects() in next.config.ts (308) aus der Registry; R30 in der Registry live\n- Tests: tests/unit/i18n/pick-locale.unit.spec.ts (26), tests/e2e/routing.e2e.spec.ts @smoke (AK-2-02, R-010, AK-A-2-04, AK-A-8-02; 3 Projekte grün), pnpm check + build grün

## 2026-09-27 – P2.1

- next-intl 4.14.7 exakt gepinnt; Routen-Registry src/lib/routes/registry.ts (R01–R31, shortLinks, aliases) + Pfad-Helfer src/lib/routes/paths.ts (localizedPath, alternatePath, matchRoute)\n- src/i18n/{routing,request,navigation}.ts, Nachrichten de/en (9 Namensräume, EN als Entwurf E-62)\n- App-Ordner [locale]/ mit Startseite (vorläufig) und Gerüsten R20–R27; P0-Platzhalter entfernt\n- check:static: neue Teilprüfungen i18n-parity und route-registry (inkl. Abgleich page.tsx ↔ live-Routen)\n- Tests: tests/unit/i18n/parity.unit.spec.ts (T-06), tests/unit/routes/registry.unit.spec.ts (T-07, AK-2-01); pnpm check + build grün
## 2026-09-27 – P1 CI grün

- Phasenende-Lauf `[ci:full p1]` auf PR #1 grün (`CI / quick`, 11 min, Kopf `f266c47`): Lint, Typen, statische
  Prüfungen, Unit, Migrationen + Drift, Int (reihenfolgeunabhängig dank Ausgangszustand je Datei), Seed + Build,
  Budgets, E2E-Rauchtest, gitleaks, audit. Zuvor behoben: falscher `CARRIER_DRIVER` in `ci.yml`, `db:reset` prüft den
  DB-Namen vor dem Verbinden, Int-Tests hingen von der Dateireihenfolge ab.

## 2026-09-27 – P1 Phasen-Abnahme (Datenmodell, Verwaltung, Werkzeuge)

- Alle Aufgaben P1.1–P1.33a erledigt: 27 Collections + 2 Globals mit Migrationen und eigenen Postgres-Objekten,
  Zugriffsschutz (Matrix T-15), Adapter mit Mocks (Speicher, Mail, Zahlung, Übersetzung, Versand), Bildpipeline ohne
  Metadaten, Objektnummern und Veröffentlichungsregeln je Kategorie, Verwaltung unter `/werkstatt` mit Sperre,
  Seed-Rahmen mit Grund-Seed und Mini-Beispielbestand, erweiterte CI (gitleaks, audit, Budget, Minuten-Wächter).
- Lokal grün: `pnpm check` (418 Unit-Tests), `pnpm test:int` (358 grün, 5 optional übersprungen: S3/stripe-mock ohne
  Dienst), `pnpm test:e2e --grep @smoke` (24, desktop/iphone-15/pixel-7), `pnpm build`, `check:migrations`,
  `seed:reset` auf frischer Test-DB.
- Spikes B-01, B-02, B-09 in ARCHITEKTUR Anhang B; ADR 0001 (`server-only` in Skripten).
- Nächster Schritt: CI-Lauf `[ci:full p1]` grün → Merge, dann P2.1. Stolpersteine: Login-Rate-Limit in E2E (Fixture
  `adminPage` meldet über die Local API an); lokalisierte Felder brauchen `localeSync`; Nummern kommen aus Sequenzen.

## 2026-09-27 – P1.33a

- `pnpm ci:minutes` (`scripts/ci/minutes.ts`): Läufe des laufenden UTC-Monats (`created>=JJJJ-MM-01`, alle Seiten), je Lauf `timing` (`billable.UBUNTU.job_runs`), sonst `jobs` (`completed_at − started_at`), je Job aufgerundet; Ausgabe `MINUTEN_MONAT`/`MINUTEN_STATUS` (knapp ab 1.500, erschoepft ab 2.000, `unbekannt` mit deutscher Meldung bei fehlendem `gh`/Netz/Rechten); Exit immer 0; nur GET über injizierbare `gh`-Aufrufe.\n- Lokal ohne `gh`: `MINUTEN_STATUS=unbekannt` („Minuten-Stand nicht abrufbar“).\n- Tests: `minutes.unit.spec.ts` (6, AK-A-6-03) mit aufgezeichneten Antworten unter `tests/fixtures/github/minutes/`; `pnpm check` grün.

## 2026-09-27 – P1.33

- `ci.yml` (Job `quick`) vollständig nach ARCHITEKTUR §6.3: Next-Cache, `check:bundle` + `check:external --built`, Playwright Chromium + WebKit (gecacht), E2E-Rauchtest, gitleaks 8.30.1 (gepinnt, Prüfsumme, nur PR-Commits, `.gitleaks.toml`), `pnpm audit` (critical blockiert, high als Warnung); bei Fehler Budget-Schritt `pnpm ci:artifacts` → Upload nur bei `upload_optional=true`, 2 Tage; `permissions: contents/actions: read`.\n- Neu: `scripts/check-bundle.ts` (Gerüst, nur Gesamtgröße), `scripts/ci/artifact-budget.ts` + `scripts/ci/gh.ts` (gh-Aufrufe injizierbar), `ci-full.yml` (Gerüst, nur `workflow_dispatch`), `.github/dependabot.yml` (nur Sicherheits-Updates), PR-Vorlage; Dev-Abhängigkeit `yaml` 2.9.1.\n- `pnpm audit --prod`: nur eine moderate Lücke (esbuild über drizzle-kit), keine high/critical.\n- Tests: `workflows.unit.spec.ts` (16), `artifact-budget.unit.spec.ts` (5) grün; `pnpm check`, E2E-Rauchtest mit `E2E_SERVER=start` (16 grün), gitleaks lokal ohne Fund.

## 2026-09-27 – P1.32

- `check:static` Teilprüfung `generated-files`: erzeugt `src/payload-types.ts` und `importMap.js` neu, meldet Abweichungen und `any` (DM-P1-06); `typescript.schema`-Hook entfernt Lexicals `tsType: 'any'`.\n- DM-P1-05-Test (TypeScript-AST) für Collections/Globals; `documents.language` nimmt die Optionen jetzt aus `LOCALES`.\n- R-001-Nachverfolgbarkeit (`LEGAL_TRACE_PHASE = 1`, Tabelle §3 geparst, Gegenprobe) und Verbotsmuster-Scan über `src/**`/`content/**` mit begründeter Allowlist.\n- Tests: 5 neue Unit-Dateien grün; `pnpm check`, `pnpm test:int`, `pnpm build`, `check:migrations` grün.

## 2026-09-27 – P1.31

- Playwright nach ARCHITEKTUR §7.3: `trace: 'retain-on-failure'`, Screenshots nur bei Fehler, `video: 'off'`, `testIgnore` für `preview-export.e2e.spec.ts`.\n- `tests/e2e/fixtures.ts`: Fremd-Host-Wächter (`context.route`, protokolliert), Admin-Anmeldung des Grund-Seed-Admins über die Local API (schont das Login-Rate-Limit), Stück-Fixtures 980–999 je Projekt eigener Block.\n- Neue E2E: `admin-product-form.e2e.spec.ts` (DM-P1-07 Pflichtangaben je Kategorie bei 375 px, fehlende Angabe → Publish 400 mit deutscher Meldung, AK-7-04 ohne horizontales Scrollen bei 390×844, T-05/R-135 GPS-Upload ohne EXIF) und `admin-privacy.e2e.spec.ts` @smoke (R-136: Login, Liste, Formulare, JSON-Feld ohne Fremd-Requests, Gegenprobe).\n- Tests: 19 E2E in desktop/iphone-15 (WebKit)/pixel-7 grün; `pnpm check`, `pnpm test:int` grün.

## 2026-09-27 – P1.30

- Mini-Satz in `content/seed/data/` (media, private-uploads, products S01/S06/S09/S11/S15/S18/S20/S25/S26/S27, orders mit Kasse und Reservierung KS2, pages home/contact) mit endgültigen seedKeys; Import `src/lib/seed/example.ts` (IG-Ausschnitte per sharp, Ersatzzeichnungen, Beispiel-PDFs), Entfernen `remove.ts`, settings.seed.\n- Station-Link optional (hallo ohne Link); `test:e2e` nutzt `db:reset --test --seed=all`; ci.yml Schritt „Seed + Build“.\n- Tests: int seed/example (DM-P1-04, AK-11-01…03, AK-SEED-06, AK-SEED-14, AK-SEED-15, AK-SEED-18), unit seed/data (zod, AK-SEED-12, AK-SEED-19 Teil); volle Int-Suite, check, check:migrations, build grün.

## 2026-09-27 – P1.29

- `content/seed/data/base.json` (settings §3.1/§3.2, 6 Kategorien, 6 Platzhalter-Rechtstexte v1) und Import `src/lib/seed/base.ts`: create-if-missing, nur leere Felder füllen, Admin aus SEED_ADMIN_* (nie in Produktion).\n- `db:reset --test` ruft danach `seed:base` auf (`--seed=none|base|all`).\n- Tests: int seed/base (DM-P1-04, AK-SEED-02, AK-SEED-13 Teil), volle Int-Suite grün.

## 2026-09-27 – P1.28

- Seed-Bibliothek `src/lib/seed/` (guard, time, tokens, schemas, loader, upsert, context, fallbackArt, remove, run) und CLI `scripts/seed/cli.ts` (payload run, Top-Level-await); Skripte seed, seed:base, seed:example, seed:remove, seed:reset.\n- Guard prüft vor dem Start von Payload über eine nur lesende Verbindung (APP_ENV, DB-Markierung, livemode-Bestellungen).\n- Tests: unit seed/time (AK-SEED-16), seed/loader; int seed/guard (AK-SEED-04, AK-11-04, AK-A-4-01, Fingerabdruck aller Tabellen), seed/side-effects (AK-SEED-05) – grün.

## 2026-09-27 – P1.27

- Zugriffsmatrix tests/int/access/matrix.ts: 27 Collections + 2 Globals mit anonymem Ergebnis für GET/POST/PATCH/DELETE, öffentlichem Where-Filter (inkl. Seed-Filter) und versteckten Feldern.\n- Test prüft jeden Eintrag über den REST-Handler (auch Einzelabruf und Massenänderung/-löschung), vergleicht die Zugriffsfunktion mit dem Matrix-Filter, scheitert bei fehlendem Eintrag und leitet die adminField-Felder aus der Konfiguration ab.\n- Tests: int access-matrix (32, T-15, DM-P1-03, R-136); pnpm check, test:int (336) grün.

## 2026-09-27 – P1.26

- Migration p1_constraints: 4 Sequenzen, CHECKs aus §9.2 (item_number 1–99999, Summen, Storno-Grund …) plus Cent-CHECK für jede *_cents-Spalte, partielle UNIQUE-Indizes (aktive Reservierung/Rechtstext, eine Rechnung je Bestellung, seed_key für 22 Tabellen), GoBD-Trigger invoices_guard; down entfernt alles.\n- Nummern PC-/WR-/AA-/DS- aus den Sequenzen (src/lib/db/sequences.ts, Hook assignSequenceNumber); die Verwaltung kann Datenschutz-Anfragen ohne Nummer anlegen.\n- DATENMODELL §8.7/§9 an die echten Spalten angepasst (reason, created_at, legal_texts).\n- Tests: int pg-objects (6, T-14/DM-P1-02, inkl. down/up), constraints (16, DM-RES-03, DM-INV-03, CHECKs, Sequenzen), angepasste Nummern-Tests; pnpm check, test:int (304), build grün.

## 2026-09-27 – P1.24

- Collections `inquiries` (Anlage nur serverseitig, Löschfrist createdAt + 6 Monate nur verkürzbar, Datenschutz-Fassung, Bilder werden mitgelöscht), `faqs`, `pages` (17 Blöcke unter src/blocks/, Entwürfe, key eindeutig, stationId je Seite eindeutig), `revenue-entries` (UNIQUE Monat+Quelle, echter Eintrag ersetzt Seed-Eintrag), `privacy-requests` (Frist +1 Monat kalendergenau Berlin, Übergänge, L-17, Audit ohne Inhalte, kein Löschen)\n- Übernahme-Regel für pages/faqs; email-log.inquiry, consent-log.inquiry, private-uploads.relatedInquiry/relatedPrivacyRequest; Migration `p1_content`\n- Tests: int content (5) und privacy-requests (3, DM-PRQ-01); check, test:int, build grün

## 2026-09-27 – P1.23

- Collections `flash` (Nummer max+1 ohne Seed, F-012, claimedAt, wiederholbar nie vergeben), `tattoo-offers` (öffentlich nur published und endsAt > jetzt mit injizierbarer Uhr, Ende standardmäßig 23:59 Berlin, keine Adresse im Ort), `tattoo-gallery` (Veröffentlichung nur mit Einwilligung, Ausnahme Seed + Vorschau außerhalb Produktion, keine Versionen, Einwilligungsfelder nur für Admin, media.restricted-Sync)\n- private-uploads.relatedGalleryItem, Medien-/Upload-Verweise registriert; Migration `p1_tattoo`\n- Tests: int tattoo (4: Flash, DM-OFF-01, DM-GAL-01, AK-1-03); check, test:int, build grün

## 2026-09-27 – P1.22

- Collection `legal-texts` (Fassungen, Status nur über `activateLegalText`, aktive/abgelöste unveränderlich, nur Entwürfe löschbar, `isPlaceholder` folgt `origin`, Version/Label automatisch, UNIQUE (type, version))\n- Renderer `src/lib/legal/render.ts` (geschlossene Token-Liste R-012, Fehler bei unbekannten/unersetzten Tokens), `getActiveLegalText`, Versandtabelle `src/lib/shop/shippingTable.ts`\n- `legalTextVersions` an Kassen und Bestellungen (dort Pflicht und unveränderlich); Migration `p1_legal`\n- Tests: int legal-texts (6: DM-LEG-01/03/04, DM-DOC-01, R-012), orders um DM-ORD-02 (legalTextVersions) erweitert; check, test:int, build grün

## 2026-09-27 – P1.19

- `src/lib/commerce/productTransitions.ts`: Tabelle `PRODUCT_TRANSITIONS` (P2–P14, Namen publish/unpublish/reserve/release/convertToPrepayment/sell/sellOffline/returnToStock/archive/archiveAfterReturn/restore), reine Prüfung `evaluateProductTransition` und Service `transitionProduct` (eine Transaktion, Nebenwirkungen firstPublishedAt/soldAt/soldChannel/archivedAt/currentOrder; P10 beendet Kasse und Reservierungen).
- Speicher-Hook: Status nur mit `context.transition` und erlaubtem Paar (sonst 403/409), Systemfelder gesperrt, Preis/Versandklasse/Kategorie bei reserved/sold gesperrt, EN-Status (machine/reviewed/missing), Audit `product_status_changed` je Wechsel (+ `product_published`, `product_offline_sold`), sofortige Revalidierung; Löschen nur nie veröffentlichter Entwürfe ohne Bestellposition, eigene Bilder mit.
- Endpunkte `/api/products/:id/{publish,unpublish,sell-offline,archive,archive-after-return,restore,return-to-stock,translate,adopt}`; Übersetzen über den Adapter (Mock "[EN] …") inkl. Alt-Texte.
- `revokeConformityDeclaration` (R-044): Erklärung widerrufen, betroffene Stücke per P3 offline + Hinweis, Mail `admin_alert` über die Outbox; Löschsperre bei verknüpften Stücken; Endpunkt `/api/conformity-declarations/:id/revoke`.
- Test-Fixtures mit Endstatus laufen im Seed-Kontext; REST-Test veröffentlicht über den Endpunkt.
- Tests: unit transitions (8, Matrix aller Statuspaare AK-5-01/DM-PROD-10); int status (10: DM-PROD-06, DM-PROD-08, AK-5-02, Endpunkte, P10, P11, P13, Übernahme, Löschen), translate (3), conformity-revoke (3, R-044); pnpm check, test:int, build grün.

## 2026-09-27 – P1.21

- Collections `invoices` (Nummer lückenlos per Zählerzeile mit Row-Lock in der Transaktion der Anlage, Serien RE/GS/BSP-RE/BSP-GS, Steuermodus je Beleg eingefroren, retainUntil nach settings.retention.invoiceYears, nach Anlage unveränderlich, ausgestellt genau einmal mit PDF und SHA-256, Löschen nur Beispielbelege), `invoice-counters` (UNIQUE Serie+Jahr) und `withdrawals` (Serverzeit bei der Widerrufsfunktion, Angaben unveränderlich, Snapshot, Frist + 14 Tage, Auto-Zuordnung über Bestellnummer + E-Mail, Übergänge laut `withdrawalTransitions.ts`, Ablehnen nie automatisch, Aufbewahrung L-08).
- `src/lib/commerce/invoiceNumber.ts`, `src/lib/db/tx.ts` (SQL in der Payload-Transaktion), `src/lib/tax/` (`getTaxModeAt`, `computeTax`); `orders.invoice`, Joins `creditNotes`/`withdrawals`, `refunds[].creditNote`, `email-log.withdrawal`. Migration `p1_invoices`.
- Tests: unit tax-mode (5, R-032/DM-INV-04 Logik); int invoice-number (5: DM-INV-01 20 parallele Vergaben ohne Lücke, DM-INV-02 Rollback verbraucht keine Nummer, Gutschrift, Unveränderlichkeit, DM-INV-04 alter Beleg bleibt Kleinunternehmer), int withdrawals (6: DM-WDR-03, Serverzeit, Zuordnung, manuelle Erfassung, Übergänge, REST 403/404); pnpm check, test:int, build grün.

## 2026-09-27 – P1.20

- Collections `checkouts` (nur Token-Hash, Snapshot fest, Zustände über `checkoutTransitions.ts`), `reservations` (active → converted/released mit Grund) und `orders` (Snapshot, Summen, Nummer, Steuermodus, Zahlart, Bausteinfassungen und Statusverlauf unveränderlich; Status nur mit Übergangs-Kennung nach `ORDER_TRANSITIONS`, je Wechsel Verlaufseintrag O1–O21, Zeitstempel, `finalStatusAt`/`retainUntil` Stufe D, Audit; Status-Token nur als Hash + verborgenes Siegel; Löschen echter Bestellungen gesperrt).
- `src/lib/commerce/`: `orderTransitions.ts`, `checkoutTransitions.ts`, `shipping.ts` (`computeShipping`: höchste Versandklasse, Abholung 0, nur_abholung nie versenden), `transitionError.ts`.
- `products.currentOrder` (nur Verwaltung), Bezüge `email-log.order`, `consent-log.checkout/order/product`, `webhook-events.relatedCheckout/relatedOrder`; Fristen der Nachweise folgen der Bestellung. Migration `p1_orders`.
- Tests: unit order-transitions (47, Matrix DM-ORD-01), checkout-transitions (DM-CHK-02), shipping (DM-ORD-05); int orders (13: DM-ORD-02, DM-CHK-01 Token in keinem Log/keiner Zeile, DM-PROD-07 currentOrder, anonymes REST 403/404, Fristen); pnpm check, test:int, build grün.

## 2026-09-27 – P1.18

- `src/lib/products/validate.ts`: `validateForPublish` (Regeltabelle DATENMODELL §6.6.6 inkl. R-043–R-048, gesammelte deutsche Meldungen mit Feldname) und `checkFoodContact` (lebensmittelecht schon beim Entwurf, AK-7-01).
- `src/lib/products/fibers.ts`: `checkFibers` (Summe genau 100 je Teil, Hauptstoff, keine Doppelten, sonstige Fasern ≤ 15 %, labelMissing ⇒ Fasern und fiberFreeText), Anhang-Nummern mit EUR-Lex-Quelle; deutsche Faserbezeichnungen korrigiert (DATENMODELL §6.6.5 nachgezogen).
- `src/lib/legal/forbidden.ts`: Lint-Listen V-13 und V-16.
- Speicher-Hook prüft bei Status available/reserved (auch draft → available, sold → available), lebensmittelecht bei jedem Entwurf; Systemschreibvorgänge nur bei publish/returnToStock.
- Tests: unit `tests/unit/products/validate.unit.spec.ts` (109, R-042–R-048), int `tests/int/products/publish-validation.int.spec.ts` (34: DM-PROD-01…04, DM-PROD-09, AK-7-01, R-042 inkl. REST); pnpm check, test:int, build grün.

## 2026-09-27 – P1.17

- `src/lib/products/itemNumber.ts`: `formatItemNumber`/`padItemNumber` (einzige Stelle), `slugify`, `buildProductSlug`, Nummernbereiche und `suggestItemNumber`.
- `GET /api/products/next-item-number` (nur Verwaltung, `src/endpoints/products/nextItemNumber.ts`): max(Nicht-Seed)+1, belegte und bei Beispieldaten 901–999 übersprungen; Vorschlag auch als Voreinstellung beim Anlegen.
- Hooks: Nummer nach erster Veröffentlichung fest (Local API ohne seed abgelehnt, Formular/REST schreibgeschützt), Meldung „Nr. 017 ist schon vergeben – nächste freie: …“, Sperre 901–999 bei Beispieldaten, Slug je Sprache (EN aus EN-Titel, Fallback DE).
- Tests: unit `tests/unit/products/item-number.unit.spec.ts` (7, R-041), int `tests/int/products/item-number.int.spec.ts` (6: DM-PROD-05, AK-7-03, R-041); pnpm check, test:int, build grün.

## 2026-09-27 – P1.16

- `src/collections/Products.ts` mit Tabs Basis/Pflichtangaben/Bilder/Verkauf/Intern, Feldern aus DATENMODELL §6.6.1 (inkl. R-043–R-048), Bedingungen je Kategorie, Zugriff §6.6.9, keine Versionen; Migration `p1_products` (inkl. Index category/status).
- Hooks (`src/collections/hooks/products.ts`): Trimmen, Kategorie-Voreinstellungen nur für leere Felder (DE und EN), Leeren fremder Angaben beim Kategoriewechsel, `hasDeviation` aus `deviationDecision`, Pflicht-Warnhinweise (Kleinteile, Glasrahmen) nicht entfernbar, Kategorie nur im Entwurf, Preis/Versandklasse gesperrt bei reserviert/verkauft, Audit Anlage/Preis, Cache.
- `src/lib/products/`: `characteristics.ts` (`buildCharacteristics`), `fibers.ts` (`formatFibers`), `categoryRules.ts`, `warnings.ts`, `itemNumber.ts` (Format); Medien-/Upload-Referenzen registriert.
- Tests: unit `tests/unit/products/characteristics.unit.spec.ts` (6, Snapshot DE/EN), int `tests/int/collections/products-fields.int.spec.ts` (12: DM-PROD-07, DM-MEDIA-05, Voreinstellungen, Kategorie-Sperre, DM-PROD-08); pnpm check, test:int, build grün.

## 2026-09-27 – P1.15

- Collection `categories`: 6 feste Schlüssel, Name aus den Labels (DE/EN), Slug je Sprache eindeutig (Index + Prüfung), Anlegen/Löschen nur mit Seed-Kontext, `key` unveränderlich, Versionen 10, Cache-Tag `categories`. Slugs stehen nicht im Code (kommen mit dem Grund-Seed P1.29).\n- Collection `conformity-declarations`: Laborbericht privat (nur Zweck `lab_report`), Erklärung als öffentliches PDF (Art `conformity_declaration`), öffentlich nur aktive ohne Labor/Notizen; Statuswechsel nur mit Übergang `revokeConformityDeclaration` (Service und Stück-Sperre in P1.19). Verwendete Dateien sind löschgesperrt; `private-uploads.relatedDeclaration` ergänzt.\n- Migration `p1_categories`.\n- Tests: int `categories.int.spec.ts` (4) und `conformity.int.spec.ts` (4, R-044 Teil), alle grün.

## 2026-09-27 – P1.25

- Global `settings` (alle Felder aus DATENMODELL §7.1 mit Standardwerten, Beispiel-IBAN, Versionen max. 50) mit Regeln in `src/lib/settings/rules.ts`: Steuermodus nur mit Begründung + „mit Steuerberatung abgestimmt“, IBAN-Prüfsumme, DE-Pflicht und EU-Sperre, Tarife je Zone, Verpackung genau 1 je Versandklasse, Umsatzwächter-Reihenfolge u. a.; Audit `settings_changed` (maskiert), `tax_mode_changed`, `retention_setting_changed`.\n- Global `site-texts` (DE/EN-Standardtexte, Navigation, Mail-Texte je Vorlage), öffentlich lesbar.\n- `src/lib/legal/constants.ts` (Bestell-Button, „Vertrag widerrufen“, „Widerruf bestätigen“, Kleinunternehmer-Satz); `getPublicSettings()` ans Global angeschlossen; `retention.invoiceYears` wirkt auf Beleg-PDFs; AV-Verträge sperren das Löschen ihrer Datei.\n- Migration `p1_globals`.\n- Tests: int `tests/int/globals/settings.int.spec.ts` (11 grün, R-032), unit `legal/constants` (4) und `settings/rules` (6).

## 2026-09-27 – P1.14

- Collections `documents` (öffentliche PDFs, nur PDF ≤ 20 MB, sha256, Rechtstext-PDFs nie löschbar) und `private-uploads` (privater Speicher, nur angemeldet, ≤ 10 MB, Typprüfung am Inhalt, Bilder gedreht/≤ 2560 px/JPEG q85 ohne Metadaten, Vorschau `thumb`).\n- Aufbewahrung je Zweck in `src/lib/retention/policy.ts` (`privateUploadRetention`): `deleteAfter` nur verkürzbar, `retainUntil` für Belege eingefroren, Löschsperre davor (außer Seed); Verweis-Register `src/lib/uploads/references.ts`; Audit `private_upload_deleted`. Bezüge (Bestellung, Anfrage, Rechnung …) verdrahten die späteren Aufgaben.\n- Migration `p1_documents`.\n- Tests: int `private-uploads.int.spec.ts` (14 grün, s3-Teil ohne MinIO übersprungen: DM-PRIV-01/-02, R-135, R-136), unit Fristen je Zweck (4 neu).

## 2026-09-27 – P1.13

- `media` laut DATENMODELL §6.2: Felder (Alt-Text DE Pflicht mit Regeln, EN optional; `showsPerson`, `restricted`, `source`, `enhance`, `derivativesVersion`, LQIP, Dominanzfarbe), öffentlich nur nicht gesperrte Bilder – auch über die Dateiroute; Migration `p1_media`.
- Bildpipeline (`src/lib/media/pipeline.ts`): nur JPEG/PNG/WebP (Inhalt geprüft), Orientierung + sRGB, alle Metadaten weg, Original WebP q90 ≤ 2560 px, Dateiname mit Inhalts-Hash; Größen `thumb`/`card` (4:5 am Fokuspunkt), `detail`, `zoom`, `og` (JPEG) – zu kleine Größen entfallen, nie hochskaliert.
- Admin: `DownscaleUpload` verkleinert große Fotos im Browser auf 2560 px (JPEG 0,85); `beforeDelete` prüft Verweise über `src/lib/media/references.ts`.
- Fixtures per `scripts/fixtures/make-exif-fixture.ts`: `gps-orientation-6.jpg` (GPS, Orientation 6, XMP, IPTC), `landscape-small.jpg`.
- Tests: int `tests/int/collections/media.int.spec.ts` (13 Fälle: DM-MEDIA-01…04, R-135, T-05, GIF/SVG, Verweise), unit `tests/unit/media/pipeline.unit.spec.ts`; Upload über die Verwaltung im Browser geprüft; `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.12

- Spike B-01 Soll erfüllt: `src/proxy.ts` schreibt `ADMIN_ROUTE/*` intern auf den Ordner `admin/` um, `/admin` und `/admin/*` → 404; `routes.admin` aus `getEnv()`, Import-Map-Pfad fest (ARCHITEKTUR Anhang B).
- GraphQL-Routen gelöscht (`/api/graphql` → 404); `GET /api/health` ohne DB (`{ status, version, appEnv }`, no-store).
- JSON-Felder in der Verwaltung ohne Monaco: Nur-Lese-Anzeige `JsonPreview` (auch für `payload-jobs`).
- `pnpm check:external --built` (Grundgerüst): Verwaltungspfad in keiner Datei unter `.next/static`/öffentlichem HTML.
- Playwright-Projekte desktop/iphone-15/pixel-7 (§7.3), E2E gegen die Test-DB; `test.fixme` in `admin.e2e.spec.ts` entfernt.
- Tests: e2e `admin-route.e2e.spec.ts` @smoke + `admin.e2e.spec.ts` (30/30 grün in 3 Projekten, `pnpm dev`; desktop auch gegen `pnpm start`), int `tests/int/api/health.int.spec.ts`, unit Proxy + check:external; `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.11

- Konto `users` laut DATENMODELL §6.1: genau ein Konto (Access + Hook, auch Local API), Passwortregel (auch beim Zurücksetzen), Sperre 5/15 min, Cookie SameSite=Strict, `lastLoginAt` + Audit `login_succeeded`.
- „Passwort vergessen“ (A17): deutsche Mail mit Link unter `ADMIN_ROUTE`, 1 h gültig; `email-log` `admin_password_reset` ohne Token, Audit `password_reset_requested`.
- Rate-Limit-Tabelle `rate_limit_hits` (Migration `p1_rate_limit`) + `src/lib/security/rateLimit.ts`: `admin_login` 10/15 min, `forgot_password` 3/h → 429 mit Retry-After; Migration `p1_users`.
- `pnpm admin:create` (interaktiv, verweigert zweites Konto) und `pnpm admin:unlock`.
- Tests: int `tests/int/collections/users.int.spec.ts` (17 Fälle: DM-USER-01…03, AK-A-8-03, R-136, A17, Unlock, Reset hebt Sperre auf); `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.10

- `src/lib/payments/` (Schnittstelle vollständig nach ARCHITEKTUR §3.5, `getPaymentsAdapter()`, Mock mit `cs_mock_`/`pi_mock_`/`re_mock_`/`evt_mock_`, HMAC-Webhook-Prüfung, in Produktion verboten; `stripe/` als Gerüst mit ConfigError ohne Schlüssel), `src/lib/translation/` (Mock "[EN] " + Text mit `usage`, DeepL-Gerüst), `src/lib/carrier/` (`manual`, `trackingUrl`, `validateTrackingNumber`).
- `docker-compose.yml`: Profil `payments` (stripe-mock); DHL-Verfolgungslink in der URL-Allowlist von `check:static`.
- Mock-Zustand bis P4.4 im Prozess-Speicher hinter `MockPaymentsStore` (OFFENE-PUNKTE).
- Tests: int payments/translation/carrier.contract (20; stripe-mock-Teil nur wenn erreichbar, lokal geprüft); `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.9

- `src/lib/email/` (Treiber file/smtp/memory/log, eine Transport-Fabrik `createMailTransport` auch für Payloads eigene Mails, Unterdrückung R-180 und Umleitung im Transport), Outbox `outbox.ts`, `tests/helpers/outbox.ts`; `@payloadcms/email-nodemailer` 3.90.2, `nodemailer` 9.1.1.
- Jobs: `src/jobs/index.ts` (alle Slugs aus A.3 mit Queue und Phase), Task `sendEmail` (P1: `admin_alert`), `jobs` in payload.config (vier Queues, autoRun nur bei JOBS_AUTORUN, access.run Admin oder Bearer), Migration `p1_jobs`; Job-Wecker `src/lib/jobs/alarm.ts`, Routen `/api/cron/tick` und `/api/cron/run/[task]` (Gerüst), `pnpm jobs:run <task> [--now=<ISO>]`.
- Spike B-09: Soll erfüllt (handleSchedules/run/runByID in 3.90.2, auch mit vorgestellter Uhr).
- Tests: int email.contract (18, SMTP gegen lokalen Fake-Server), jobs/send-email (5), jobs/tick (7, Pool-Zähler), spikes/b09-jobs (2); unit jobs/slugs (3); `pnpm check`, `pnpm test:int`, `pnpm build` grün; Routen zusätzlich per `pnpm start` geprüft (401/200/204/409).

## 2026-09-27 – P1.8

- `src/lib/storage/`: `uploadStorage(area)` (staticDir `.data/{media,documents,private}`, Datei-Handler mit dokumentabhängigen Cache-Headern), `storagePlugins()` mit zwei Instanzen `@payloadcms/storage-s3` 3.90.2 (öffentlich/privat, signierte Downloads 300 s), `systemFiles.ts`, `signed.ts`; `media` nutzt es; Migration `p1_storage` (Felder `prefix`, `_objectKey`).
- `docker-compose.yml`: Profil `s3` (MinIO + Bucket-Anlage).
- Spike B-02: Soll erfüllt (gegen RustFS als MinIO-Ersatz, siehe OFFENE-PUNKTE).
- Tests: int `tests/int/adapters/storage.contract.int.spec.ts` (11 Tests: local immer, s3 gegen lokalen S3-Dienst inkl. Ablauf 403); `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.7

- Protokoll-Collections `audit-log`, `email-log`, `consent-log`, `webhook-events`, `deletion-log` (Gruppe „System“, nur lesen; Anlegen/Ändern/Löschen nur über Server-Code; unveränderliche Felder per Hook gesperrt); Migration `p1_logs`.\n- `src/lib/retention/policy.ts` mit allen Fristen als L-Konstanten und `retainUntil()` (Berliner Kalender, Jahresende-Regel); `writeAudit()` maskiert E-Mail, IBAN, Namen und Adressen; `getStatusHistory()`; `writeDeletionLog()` in der Transaktion des Aufrufers.\n- Tests: unit policy (47, Fristen aus LOESCHKONZEPT geparst), int logs (43: anonymes REST verboten, Local API ohne overrideAccess verboten, Maskierung, ruleId-Muster, Fristen, Rollback); pnpm check, test:int, build grün.

## 2026-09-27 – P1.6

- Zugriffsschicht `src/access` (isAdmin, none, publicRead mit Seed-Filter, adminField), Kontext-Flags `AppContext`/`withSystem`, `getPublicPayload()`/`getPublicSettings()` mit Whitelist, Cache-Tags und Revalidierung (nichts bei `context.seed`).\n- Feldbausteine `src/fields/` (seedField, privacyFields, addressFields, internalLinkFields, moneyField mit Admin-Komponente EuroInput, sortOrderField).\n- Payload: Sprachen de/en mit Rückfall, Verwaltung nur Deutsch (`@payloadcms/translations` 3.90.2), GraphQL aus, Avatar ohne Gravatar; Migration `p1_localization` (Enum `_locales`).\n- Tests: unit access (8), money-field mit jsdom (5), seed-field (4); pnpm check, test:int, build grün.

## 2026-09-27 – P1.5

- `scripts/db-ensure.ts` (`db:ensure`), `scripts/db-reset.ts` (`db:reset --test`, nur `*_test`, nicht bei `APP_ENV=production` oder markierter DB), `src/lib/db/guard.ts` (`isProductionDatabase`, gemeinsame Sperrregel).
- `payload.config.ts`: Pool `max = DB_POOL_MAX`, Push nur mit `PAYLOAD_DB_PUSH` in `development`, `migrationDir`; erste Migration `p1_baseline`.
- `scripts/check-migration-drift.ts` (`check:migrations`); `ci.yml` Schritt 6 (migrate + Drift). Gegenprobe: ein Feld ohne Migration lässt die Prüfung scheitern.
- Int-Setup (`tests/int/setup/global.ts`, `env.ts` → immer `DATABASE_URL_TEST`), Helfer `getTestPayload()`/`withClock()`; Netzwerk-Wächter `tests/setup/network-guard.ts` (Socket, `http(s).request`, `fetch`) in Unit und Int.
- Spike `server-only` in Skripten → ADR `docs/adr/0001-server-only-in-scripts.md` (Import-Hook).
- Tests: int `tests/int/db/reset-guard.int.spec.ts`, `tests/int/db/migrate.int.spec.ts` (DM-P1-01), unit `tests/unit/setup/network-guard.unit.spec.ts`; `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.4

- `src/lib/time.ts` (Uhr, Berliner Tag/Monat/Jahr, Zeitumstellung korrekt, `formatBerlin`) mit `date-fns`/`@date-fns/tz` (exakt gepinnt); `src/lib/money.ts` (`formatMoney` full/tag, `parseEuroInput`, `assertCents`, ohne Fließkomma-Rechnung).
- `src/lib/monitoring/logger.ts` (JSON-Zeilen, `LOG_LEVEL`) mit `src/lib/security/redact.ts` (Schlüsselliste §8.11, E-Mail, IBAN, 43-Zeichen-Token, Telefonnummern).
- `src/lib/enums.ts` wörtlich aus DATENMODELL §4 (inkl. 64 Fasern), `src/lib/enumLabels.ts` (DE für alle, EN für öffentliche Enums).
- `src/lib/security/keys.ts` (HKDF, feste Bezeichner), `ipHash.ts` (täglich wechselnd), `tokens.ts` (Zufalls-Token, Hash, konstanter Vergleich).
- Tests: `tests/unit/lib/{time,money,logger,enums,keys}.unit.spec.ts`; `pnpm check` grün.

## 2026-09-27 – P1.3

- `src/lib/env.schema.ts` (Registry aller Variablen aus ARCHITEKTUR §5.2 mit Beschreibung, Beispiel, Geheimnis-Kennung, „Seit“) und `src/lib/env.ts` (`getEnv()` gecacht, `collectEnvViolations`/`assertProductionEnv` sammeln alle Verstöße, `seedPreviewModeActive`); `src/instrumentation.ts` prüft beim Start (Produktion ohne `APP_ENV` bricht ab).
- `pnpm env:example` erzeugt `.env.example`; `pnpm check:static` mit Teilprüfungen `versions`, `env-example`, `import-rules`, `stripe-import`, `external-urls`; `pnpm check` enthält sie; `ci.yml` Schritt 4.
- ESLint: `process.env` nur in `src/lib/env.ts`/`instrumentation.ts`; `getPayload` nicht in öffentlichen Seiten. `payload.config.ts` nutzt `getEnv()`.
- Import-Hook `scripts/lib/register-server-only.mjs` macht `server-only` in CLI-Skripten (payload, tsx) ladbar.
- Tests: `tests/unit/env/assert-production.unit.spec.ts` (T-17, AK-A-3-02, AK-1-02, AK-SEED-16), `tests/unit/env/env-example.unit.spec.ts` (AK-A-5-01), Lint-Regeltest (AK-A-5-02); `pnpm check`, `pnpm test:int`, `pnpm build` grün, `pnpm dev` startet.

## 2026-09-27 – P1.2

- Prüfstellen abgeglichen (Liste im PR-Text). Korrigiert: DATENMODELL §6.12 (Begriffe laut R-012/R-002), SEED-SPEC §1.4, §1.8, §2.1.
- OFFENE-PUNKTE §4: fehlende IDs C-28 und SE-14 ergänzt; alle W-, C-, DM-, DA-, KA-, SE-IDs vorhanden. ENTSCHEIDUNGEN unverändert.
- Tests: `tests/unit/docs/resolutions.unit.spec.ts` (W-IDs in OFFENE-PUNKTE); `pnpm test:unit` grün.

## 2026-09-27 – P1.1b

- `scripts/check-versions.ts` (`pnpm check:versions`): `@payloadcms/*` = `payload`, `eslint-config-next` = `next`, `react` = `react-dom`, kein `^`/`~` bei Laufzeit-Abhängigkeiten; ab 30.09.2026 Warnung bei `next` < 16.3.7.
- Next.js-Patch: 16.3.7 ist noch nicht erschienen, 16.3.6 ist der neueste 16.3.x-Patch → bleibt; Zeile in OFFENE-PUNKTE.
- Tests: `tests/unit/tooling/check-versions.unit.spec.ts` (AK-A-1-01/-02); `pnpm check` grün.

## 2026-09-27 – P1.1a

- `ci.yml` nach ARCHITEKTUR §6.3: Job `quick`, nur `pull_request`/`workflow_dispatch` (kein `push`), Wegwerf-DB `planetclaire_test`, `TZ=UTC`, `DB_POOL_MAX`, `SEED_*`, `NEXT_PUBLIC_LEASH_DEBUG`, `E2E_SERVER`; Schritt „Kennung“ überspringt bei `[ci:update-snapshots]`/`[ci:art]`.
- Test-Helfer (`tests/helpers/adminEnv.ts`, `login.ts`, `seedUser.ts`) nutzen `ADMIN_ROUTE` und `SEED_ADMIN_*`; `admin.e2e.spec.ts` bis P1.12 als `fixme`.
- Tests: YAML lokal geparst (Auslöser, Job `quick`); `pnpm check` grün.

## 2026-09-27 – P1.1

- tsconfig: `noUncheckedIndexedAccess`, `noImplicitOverride`; `.npmrc` `save-exact=true`; `cross-env`, `graphql`, `eslint`, `prettier` exakt gepinnt.
- ESLint nach ARCHITEKTUR §15: `no-explicit-any` als Fehler, `no-console` in `src/` (außer Logger), Uhr-Verbot (`new Date()`, `Date.now()`) in commerce/jobs/legal, `toFixed` in commerce, framework-freie `behaviors`/`leash`/`preview-runtime`. `pnpm lint` prüft zusätzlich das Format (`.prettierignore` für Doku und generierte Dateien).
- Vitest: Int-Tests nacheinander (`fileParallelism: false`), `server-only` → Stub in beiden Konfigurationen.
- P0-Prüfpunkte bestätigt (`.gitattributes` lf/binary, `.gitignore`, `next.config.ts`, Build-Speicher).
- Tests: `tests/unit/lint/rules.unit.spec.ts` (AK-A-15-01); `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P0 abgeschlossen (P0.8 GitHub)

- Plan zu einer Datei `PLAN.md` zusammengeführt (P0 erledigt, P1–P10: 329 offene Aufgaben, P11 mit Jutta);
  `bash scripts/cloud-setup.sh --plan-status` → erste offene Aufgabe P1.1.
- GitHub-Beschriftungen am 27.09.2026 nachgeprüft und in CLOUD-SETUP, ANLEITUNGEN, AUFGABEN, ARCHITEKTUR,
  OFFENE-PUNKTE korrigiert (Squash-Einstellung „Default to pull request title and description“, CLOUD-SETUP F-31).
- Privates Repository `planetclairetattoos` angelegt, `main` gepusht; erster CI-Lauf (Lint, Typen, Unit,
  Integrationstest gegen Postgres 17, Build) grün – von Jutta im Reiter „Actions“ bestätigt.
- `pnpm check` und `pnpm build` lokal grün.
- Nächster Schritt: Jutta richtet die Cloud ein (`docs/CLOUD-SETUP.md` §1–§2) und startet die erste Cloud-Session;
  sie beginnt mit P1.1.

## 2026-09-26 – P0 Fundament (lokal)

- Interview mit Jutta (13 Fragerunden) und Recherche (Recht, Produkt-Compliance, Technik, Zahlung/Versand, Design,
  Tattoo, Cloud-Arbeitsweise) mit Faktencheck; Ergebnisse in `docs/research/`.
- Konzept freigegeben („Freigabe, Instagram-Bilder darfst du herunterladen“); Entscheidungen in `docs/ENTSCHEIDUNGEN.md`.
- 22 Instagram-Bilder (öffentlich sichtbar, mit Erlaubnis) in `content/seed/instagram/` + `manifest.json`.
- Fachdokumente: KONZEPT, DATENMODELL, ARCHITEKTUR, DESIGN + KUNST-QA, Recht (Anforderungen, Kanzlei-Briefing,
  Dienste, Löschkonzept), Aufgaben & Anleitungen für Jutta, Cloud-Setup, Beispielbestand-Spezifikation, PLAN.md.
- App-Gerüst: Next.js 16.3.6 + Payload 3.90.2 (Postgres), pnpm 10.34.5; Lint, Typprüfung, Unit-Test und Build
  lokal grün; CI-Workflow (inkl. Integrationstest gegen Postgres) angelegt.
- Nächster Schritt: Session in die Cloud verschieben, dort P1 starten (siehe `docs/CLOUD-SETUP.md`).

## 2026-10-07 – P12.8 Tour als Schaukasten

- „Planet Claire on Tour“ ist jetzt eine kompakte, gerahmte Tafel mit angepinnten Zetteln (Datumsblock, nächster Termin als Plakat, Abgesagt-Stempel). Tests: `pnpm check`, `home-tour` (desktop + pixel-7), `check:bundle` grün.
## 2026-10-07 – P12.15 Shop: Kategorie-Karten mit Coco

- Jede Kategorie im Shop (und „Alle“) ist jetzt eine kleine Karte: oben ein Coco-Foto aus deinem Instagram-Material, darunter der Name. Alle Karten sind gleich groß (mobil seitlich wischbar, am Rechner in einer Reihe). Das gilt auch im Archiv.
- Tests: Unit (Zuordnung, Dateigröße), E2E (gleiche Größe, Bilder geladen, Links, DE/EN, Desktop und Pixel 7).
- P12.16: Dein Foto mit Coco ist auf „Über mich“ eingebaut (Block „Zu zweit“ unter dem Coco-Abschnitt, Goth-Rahmen, beide Gesichter im Ausschnitt). Hinweis für P11: Das Foto muss beim Entfernen der Beispieldaten behalten werden (siehe OFFENE-PUNKTE).
## 2026-10-08 – P13.1–P13.3 Startseite: ohne „Komm näher.“, neue Koko, Koko + Tour nebeneinander

- **P13.1 (U-40):** Die Station „Komm näher.“ mit Text und Gymnastik-Coco ist weg – samt Programmcode, Bilddaten, Budgets und Tests. Keramik ist jetzt Station 01, insgesamt 6 Stationen.
- **P13.2 (U-41):** Koko hat wieder ihre gemalten Augen aus deinem Bild (unregelmäßig, zittrige Lidstriche, auch der linke Augenschlitz); nur die Pupillen wandern links ↔ rechts. Der Ausschnitt reicht jetzt ein Drittel weiter nach unten: Kragenspitzen ganz, orange Brust mit weißem Fleck, unten ein gezeichneter Tuschebogen als Abschluss.
- **P13.3 (U-42):** Oben rechts steht Koko, direkt daneben ein schmaler Schaukasten „Planet Claire on Tour“ mit den nächsten drei Terminen; alle weiteren und vergangenen klappen darunter auf. Darunter ein Link zu deinem Instagram mit einem von Hand gezeichneten Instagram-Zeichen (nicht das bunte Logo). Auf dem Handy stehen Koko und Schaukasten untereinander.
- Tests: `pnpm check` (Unit 2182), Int (Startseite, Seed, Übernahme), E2E desktop + pixel-7 + iphone-15 (`home`, `home-tour`, `home-koko`, `home/*`, `home-choreo`, `admin/tattoo-tour`), `check:bundle`. Visuelle Referenzen erneuert die Hauptsession zentral.

## 2026-10-08 – P13.5 Coco läuft überall mit (U-44)

- Im Shop (auch Kategorien, Archiv und auf jeder Produktseite), bei den Auftragsarbeiten und auf allen Tattoo-Seiten läuft Coco jetzt wie auf der Startseite an der Leine mit: Sie läuft vorn und zieht die Tusche hinter sich her, die Linie kringelt sich an den Überschriften und zwischen den Kartenreihen. Beim Öffnen einer Seite läuft sie die Leine bis zur Leseposition entlang, zwischen diesen Seiten reist sie mit.
- Umrundungen: Im Shop läuft sie (am Rechner) einmal um die Kategorie-Bilder, auf der Tattoo-Übersicht um eine kleine Galerie-Leiste, auf der Startseite zusätzlich um die Zeichnung „Textil & Caps“ und (am großen Bildschirm) mit einem Lasso um „Schmuck“. Formulare, Knöpfe und Karten mit Text umrundet sie nie (sie würde sie sonst verdecken).
- Warte-Aktionen (Hecheln, Ohr zucken, Kratzen …) kommen etwa 20 % schneller hintereinander. Ruheseiten (Rechtliches, Korb, Kasse) bleiben ruhig; bei „Animationen aus“ steht die Linie still und Coco sitzt.
- Tests: Unit (Spur, Kringel, Umrundung nur mit Platz, Warte-Plan), neuer E2E `leash-trail` (13 Seiten × 14 Lesepositionen, Desktop und Pixel 7: Linie und Coco überdecken keinen Text und keine Knöpfe, Linie nie vor Coco), Coco reist Start → Shop → Tattoo (MO-14); Leinen-, Coco-, Choreografie-, Shop-, Tattoo- und Auftragsarbeiten-E2E.

## 2026-10-08 – P13.4, P13.6–P13.9 Schriften, Gewährleistung, Anschrift, Sprache, „Jutta & Coco“

- P13.4 (U-43): Alle Überschriften auf allen Seiten (außer den Startseiten-Bausteinen) stehen jetzt in Spectral wie der
  Titel – auch Produkt-Abschnitte, Kasse, Rechtsseiten und die Spalten im Fuß. Fließtext bleibt Bricolage. Neuer Test
  geht alle Seiten durch (`tests/e2e/headings-font.e2e.spec.ts`); die Kunst-Prüfung LG-03 erlaubt Überschriften jetzt
  auch auf den ruhigen Seiten.
- P13.6 (U-45): Das leere Feld „Gesetzliche Gewährleistung“ zeigt jetzt den Inhalt der EU-Mitteilung auf Deutsch und
  Englisch (mindestens zwei Jahre, Reparatur oder Ersatz, Rechte gegenüber dem Verkäufer …) in Text und Grafik, deutlich
  als „Platzhalter-Fassung“ markiert, bis die Kanzlei sie mit der amtlichen Vorlage abgleicht (OFFENE-PUNKTE).
- P13.7 (U-46): Deine Anschrift „Jutta Dollmann, Anklamer Straße 28, 10115 Berlin“ steht in den Einstellungen
  (Stammdaten); Impressum, Datenschutz, AGB, Widerruf, Rechnungen und Mails übernehmen sie, die Kontaktseite zeigt sie
  jetzt vollständig statt nur des Bezirks.
- P13.8 (U-47): In der Kopfzeile rechts neben „Menü“ steht „DE | EN“; die aktive Sprache ist mit einer kleinen
  Tusche-Linie unterstrichen, ein Klick führt auf dieselbe Seite in der anderen Sprache (auch bei Stücken und
  Kategorien). Auf dem Handy zeigt der Korb dafür nur noch Symbol und Anzahl.
- P13.9 (U-48): „Jutta & Coco“ ist gekürzt: Überschrift, dein Foto mit Coco („Zu zweit“) und „Sag etwas“.
- Tests: Unit (Kunst-Prüfung LG-03, Mitteilung, Stammdaten, Sprachdateien), Integration (Grund-Seed, Seiten, Kontakt),
  E2E (Überschriften, Über mich, Sprach-Umschalter, Kontakt/Rechtsseiten) – Einzelheiten im PR-Text.
