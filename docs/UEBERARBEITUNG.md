# Überarbeitung nach Juttas Rückmeldung (Phase P12, 06.10.2026)

> **Verbindlich für P12.** Jutta hat nach der Vorschau-Datei (Release `vorschau-p10`) Änderungswünsche geäußert und sie im
> Gespräch (Multiple-Choice-Runden vom 06.10.2026) konkretisiert. Diese Datei hält die Antworten fest; sie ergänzt
> `docs/ENTSCHEIDUNGEN.md` (wird nicht verändert, dort stehen nur Umsetzungsnotizen, die auf diese Datei verweisen).
> Wo ein Eintrag hier einer früheren Entscheidung (E-xx) oder einem Fachdokument widerspricht, **gilt dieser Eintrag**
> (Jutta ist die Inhaberin und hat die Änderung selbst verlangt). Betroffene Fachdokumente werden in P12 nachgezogen.
> Arbeitsweise: ohne Rückfragen bis zum leeren Plan, Selbst-Merge je Teilphase erlaubt (Squash, grüne CI), eine neue
> HTML-Vorschau am Ende. Keine echten Konten/Schlüssel, nie Force-Push.

## Dauerhafte Regel

| ID | Regel |
|---|---|
| U-00 | **Die gesamte Seite ist dauerhaft zweisprachig (Deutsch/Englisch), auch wenn Jutta nur deutsche Texte liefert.** Jede neue oder geänderte Textstelle (Seiten, Shop, Verwaltung, Fehlermeldungen, Rechtstexte, E-Mails, Alt-Texte, Beispieldaten) bekommt eine **eigenständig formulierte, gleichwertige englische Fassung** im selben Ton – keine wörtliche Übersetzung. Maschinelle Übersetzung (DeepL) bleibt nur Hilfsmittel für Texte, die Jutta später selbst in der Verwaltung einträgt. Rechtstexte sind auf Deutsch verbindlich, die englische Fassung steht gleichwertig daneben (Hinweis „Deutsche Fassung maßgeblich“ nur dort, wo rechtlich nötig). |

## Coco (Hund)

| ID | Entscheidung |
|---|---|
| U-01 | Schreibweise bleibt **Coco** (Jutta schrieb „Koko“ im Chat; Coco bleibt überall). Eine Figur „**Koko, Vorsitzende der Goth Dogs Berlin**“ ist dagegen die Narrenkappen-Figur aus U-08 (Name im Bild: Koko). |
| U-02 | **Sitzpose neu** in **Seitenansicht wie auf Juttas Fotos** (Brust leicht vorgestreckt, gerade Vorderbeine, Hinterteil seitlich abgesetzt, buschiger Schwanz, große aufrechte Ohren) – darf **nicht** mehr wie eine Katze wirken. Monoline-Strich nach Juttas Skizzen (`content/art/jutta-skizzen/README.md`). |
| U-03 | **Warte-/Sitz-Aktionen** (beim Stillstand, gestaffelt nach Dauer): Hecheln, Kopf schief + Ohr zucken, Hinterbein kratzt (hinterm Ohr), Gähnen und Strecken, Schwanz wedelt; bei sehr langer Ruhe einrollen und schlafen. |
| U-04 | **Vier neue Posen/Momente:** Spielverbeugung (Vorderkörper runter, Hinterteil hoch), sich schütteln/Fell auslockern, Freudenhüpfer/Drehung (bei Erfolg: Korb gefüllt, Bestellung abgeschickt), Hinlegen mit Pfoten übereinander/Bauch hoch (vor dem Einrollen). Je mindestens 3 Frames im Strich wie die vorhandenen Posen; reduzierte Bewegung = Standbild. |
| U-05 | Coco an der Leinenspitze **25 % größer** (56 → 70 px mobil, 88 → 110 px Desktop); Gutter-/Rinnen-Regeln und Budget (CO-08) entsprechend nachziehen. |
| U-06 | Die **Tuschelinie baut sich etwa doppelt so langsam** auf (Kringel/Schlaufen sichtbar entstehen); Teilstück-Budgets (PF-04) bleiben. |
| U-07 | **Knickohr:** Cocos **rechtes** Ohr (aus ihrer Sicht) ist **immer geknickt**, außer sie spitzt kurz auf (frontal: im Bild links; Seitenansicht Blick nach rechts: das hintere Ohr; Blick nach links: das vordere). Gilt für alle Posen, Sprite, Charakterblatt, Fitness-Coco. |
| U-07a | **Leine in Raster-Seiten** (Flash, Shop, Galerie, Karten-Listen): läuft in einer Rinne **am Seitenrand**, kringelt sich nur zwischen den Zeilen, **wickelt nie Karten ein** (Mängel LG-01, Fund auf der Flash-Seite). |
| U-08 | **Koko, Vorsitzende der Goth Dogs Berlin** (Vorlage `content/art/jutta-skizzen/koko-vorsitzende-goth-dogs-01.jpg`, auf einem T-Shirt gemalt): **rechte Seite der Startseite oben**, darunter in derselben Spalte „Planet Claire on Tour“ (U-20); mobil untereinander. Das Bild wird **freigestellt und sauber nachgezeichnet** (Shirt-Falten und Hintergrund entfallen; schwarzes Fell mit Tuschestrich, orange Flächen, weiße Brust/Pfoten, Narrenkappe mit grünen Bommeln), **ohne das Knochenkreuz**. **Nur die Pupillen sind animiert**: sie wandern gemächlich von links nach rechts und zurück (Seitenblick), Standbild bei „weniger Bewegung“. Name in Texten: „Goth Dogs Berlin“. Handgezeichnete Anmutung, kein glattes Vektorbild; Datenbudget beachten. |
| U-09 | **Fitness-Coco auf der Startseite** ersetzt die große sitzende Coco im Haupt-Bereich. Vorlage: Juttas Skizzenblatt (siehe `content/art/jutta-skizzen/FITNESS-COCO.md`): **sieben Übungen in deiner Reihenfolge** – Body wave, Body bounce („Boing Boing Boing“), Single arm raises, Body bounces with hip rotation, Chest opener, Straight arm trunk twist, Arm raises both arms (thump up) – dann liegt Coco **erschöpft ausgestreckt mit Zunge** am Boden; danach beginnt die **Endlosschleife** von vorn. Jede Übung ca. 4–6 s, weiche Übergänge; **sehr fein von Hand gezeichnet gewirkt**, viele Zwischenbilder (12–24 je Übung, Tuschelinie mit leichtem Zittern), **mit zartem orangem Buntstift-Strich im Fell** (Linie bleibt schwarz, Papierkörnung); **ohne Beschriftungen** (nur Zeichnung). Bei „weniger Bewegung“: Standbild einer Übung. Daten werden nach dem ersten Bild nachgeladen (Tempo-Budgets bleiben). Die frühere Auswahl „Hanteln/Liegestütze/Seilspringen/Yoga“ ist **hinfällig**. |

## Optik

| ID | Entscheidung |
|---|---|
| U-10 | **Schrift:** **Spectral** (Serifenschrift, frei, selbst gehostet über `@fontsource/spectral`) für Überschriften, **Spectral Italic** als Akzent-Schrift. Die bisherige handschriftliche Akzentschrift (Mansalva, „Zentnähte“) entfällt vollständig. Lesbarkeits-/Tempo-Budgets bleiben. |
| U-11 | **Hintergrund:** **helles Olivgrün** als Grundton; **Scroll-Verlauf**: am Seitenanfang hell, nach unten dunkler Richtung Petrol (Verlauf bewegt sich sanft mit dem Scrollen); Text bleibt AA-lesbar; bei „weniger Bewegung“ statischer Verlauf. |
| U-12 | **Zusätzliche Akzentfarbe Petrol** (dunkles Blaugrün) für Links, Buttons und Stempel; Hover-/Fokus-Zustände angepasst. Tokens in `docs/design/DESIGN.md`; Kontraste nach R-190/WCAG AA. |
| U-13 | **Alle Foto-Rahmen** (Shop-Karten, Produktseiten, Galerie, Flash, „Über mich“, Startseite): neuer **viktorianischer Zierrahmen mit Filigran** im Goth-Ton; **dünne** Tuschelinie (keine dicken schwarzen Elemente, damit die Leine wirkt); ersetzt den beigen Doppelrahmen/das Passepartout. Feste Seitenverhältnisse (CLS ≤ 0,1), Budgets bleiben. |

## Inhalte und Funktionen

| ID | Entscheidung |
|---|---|
| U-14 | **„Angebote“ (Tattoo) komplett entfernen:** Seite (R13), Navigationseintrag, Verwaltungs-Reiter, Collection samt Beispieldaten, Verweise (Startseite, Footer, Tattoo-Übersicht, Sitemap, Hinweise, Suche, Tests, Handbuch). Migration löscht die Daten/Tabellen sauber. |
| U-15 | **„Per DM anfragen“ und jede textliche Erwähnung von DM/Instagram als Anfrageweg entfällt überall.** Anfrageweg im Tattoo-Bereich ist **nur E-Mail**. Ein Link zum Profil @planet.claire.tattoos bleibt **nur im Footer** (ohne Anfrage-Aufforderung). |
| U-20 | **„Planet Claire on Tour“** (Märkte/Flohmärkte/Kunstmärkte): rechte Spalte der Startseite, **unter Koko** (U-08), mobil darunter; kommende Termine oben, vergangene einklappbar. Pro Termin: Datum (von–bis), Name des Marktes, Ort/Bezirk, Adresse + Link (normaler Textlink, **keine** eingebettete Karte), Standnummer, Uhrzeiten, kurze Notiz (z. B. „Coco ist dabei“), Status (geplant/abgesagt/vorbei, abgesagt durchgestrichen), optionales Foto vom Stand. **Pflege in der Verwaltung** (Liste „Termine“, „Neuer Termin“), Beispieltermine als `seed:true`, DE/EN. |
| U-21 | **Alle Texte neu** (Seiten, Stationen, Shop, Tattoo, FAQ, Über mich, Leerzustände, Fehlerseiten, Beispieldaten, Buttons, E-Mail-Betreffs soweit nicht rechtlich festgelegt): **verträumt-philosophisch, geheimnisvoll, nie erklärend**, **Ich-Form von Jutta**, kaum Selbsterklärung („so zeichne ich“, Hund erklären entfällt – Coco tritt als Figur auf). **Sachtexte** (Pflege/Aftercare, Ablauf, Preise, Versand, FAQ, Kasse, Rechtliches) bleiben korrekt und klar: **poetisch gerahmt (Einstieg/Überschrift), Fakten kurz und eindeutig darunter**. Button „Zahlungspflichtig bestellen“ und Pflichttexte bleiben unverändert (E-xx/R-xxx). |
| U-22 | **Rechtstexte vollständig ausformulieren** (Impressum, Datenschutz, AGB, Widerrufsbelehrung und -formular, Versand/Zahlung, Cookie-/Speicher-Hinweis, Barrierefreiheit u. a.) mit **Platzhaltern für persönliche Angaben** (Anschrift, E-Mail, Steuerstatus, IBAN …) – Jutta trägt sie einmal in den Einstellungen ein; Kanzlei-Prüfung bleibt P11. Dazu **Schutz des geistigen Eigentums von Jutta:** (a) Urheberrechtsvermerk + Nutzungsbedingungen für alle Bilder und Texte; (b) **Kaufklausel:** Käufer:in erwirbt nur das Unikat, keine Rechte an der Motiv-Reproduktion (kein Nachdruck, Merchandise, Digitalisierung, Weiterverkauf als Reproduktion); (c) **KI-/Text-und-Data-Mining-Vorbehalt (§ 44b UrhG)** auch technisch in `robots.txt`, `ai.txt`, Meta-Tags; (d) **Tattoo-Motive/Flash:** Nachstechen nur mit schriftlicher Genehmigung. Die Klauseln stehen sichtbar im Shop (Produktseite, AGB, Footer) und in der Verwaltung als Bausteine. |
| U-23 | **Zusatzarbeiten:** Platzhalter-Gesichter und -Zeichnungen neu zeichnen (Kunst-QA „offen“ AR-05 auf ≥ 4), Coco wandert im Seitenwechsel mit (MO-14), weitere Mikro-Animationen (MI-xx), danach **neue Kunst-QA-Runde** mit Videos nach allen Änderungen. |

## Ablauf

| ID | Entscheidung |
|---|---|
| U-30 | Eigene Phase **P12** vor P11. Selbst-Merge (Squash) je Teilphase, wenn die CI grün ist; Zwischenstände nur im PR-Text; **eine** neue HTML-Vorschau (Release `vorschau-p12`) am Ende; Abschlussbericht für Jutta in `docs/FORTSCHRITT.md`. |

## Zweite Runde (08.10.2026, Phase P13)

Antworten von Jutta im Chat (Multiple Choice), verbindlich wie U-00 … U-30. Gilt **für die ganze Seite** (Handy und Desktop).

| ID | Entscheidung |
|---|---|
| U-40 | **Startseite:** Station „Komm näher.“ samt Text und Gymnastik-Coco (Fitness-Coco) **komplett entfernen**, auch der Programmcode und die Bilddaten; die übrigen Stationen werden neu durchnummeriert (Keramik = Station 01 …). U-09 entfällt damit. |
| U-41 | **Koko** (Büste aus dem Originalbild, U-08): Augäpfel und Lidstrich **wie im Original** (leicht unregelmäßige Form, zittriger Tuschestrich, Lid ungleich dick, keine glatten Linsenformen; auch der linke Augenschlitz); nur die Pupillen wandern. Unter dem Fellkragen **etwa ein Drittel der Kappenlänge mehr** aus dem Original: Kragenspitzen ganz, Ansatz der orangen Brust mit weißem Brustfleck, sauberer Abschluss – damit man Coco erkennt. Kappe selbst bleibt. |
| U-42 | **Koko + Tour nebeneinander:** oben rechts auf der Startseite Koko links, direkt rechts daneben ein **schmaler, deutlich kompakterer Schaukasten** „Planet Claire on Tour“ (nächste 2–3 Termine, ältere aufklappbar); auf dem Handy untereinander. Darunter ein **Instagram-Link** mit handgezeichnetem Instagram-Symbol in Tusche (nicht das bunte Logo) + „@planet.claire.tattoos“ (ändert U-15: Instagram darf zusätzlich hier stehen, weiterhin nicht als Anfrageweg). |
| U-43 | **Schriften:** alle Überschriften (H1–H3, z. B. „Planet Claire on Tour“) in **Spectral** wie der Titel; Fließtext bleibt Bricolage. Alle Seiten prüfen. |
| U-44 | **Coco läuft überall mit:** auf allen Shop-, Kategorie-, Produkt-, Archiv-, Tattoo-, Galerie-, Flash-, Preise-, Ablauf-, Pflege-, FAQ- und Auftragsarbeiten-Seiten läuft Coco an der Leine mit (etwas voraus), mit Kringeln und ab und zu einer **Umrundung eines Bildes**; auf der Startseite 1–2 Umrundungen mehr. Warte-Aktionen etwa **20 % schneller** hintereinander. Ruheseiten (Rechtliches, Korb, Kasse) bleiben ruhig. |
| U-45 | **Harmonisierte Mitteilung zur gesetzlichen Gewährleistung:** amtlicher EU-Wortlaut (DE + EN) einsetzen, als Platzhalter-Fassung markiert bis zur Kanzlei-Prüfung. |
| U-46 | **Anschrift überall:** „Jutta Dollmann, Anklamer Straße 28, 10115 Berlin“ – Impressum, Datenschutz, AGB, Widerruf, Rechnungen, Mails **und Kontaktseite** (statt nur Bezirk). Eingetragen in den Einstellungen (Stammdaten), damit alle Texte sie übernehmen. |
| U-47 | **Sprach-Umschalter** in der Kopfzeile rechts neben „Menü“: „DE \| EN“ in der Menü-Schrift, aktive Sprache mit kleiner Tusche-Linie unterstrichen; Klick führt auf dieselbe Seite in der anderen Sprache. |
| U-48 | **„Jutta & Coco“ (Über uns):** löschen: Abschnitt „Ich bin Jutta …/Hier ist Planet Claire“, „Die zittrige Linie“, den Coco-Absatz mit gezeichneter Coco, die drei Bilder unter dem Foto, „Wo ich zeichne“ mit den Kategorie-Aufrufen. **Es bleiben:** Überschrift, Foto von Jutta und Coco mit dem kurzen Text „Zu zweit“, darunter „Sag etwas“. |
| U-49 | **Ablauf:** Phase **P13** vor P11, selbst durcharbeiten, CI + Kunst-QA grün, selbst mergen (Squash), am Ende neue HTML-Vorschau (Release `vorschau-p12` mit neuem Stand) an Jutta. |

## Dritte Runde (09.10.2026, Phase P14)

Juttas Wunsch zur Startseite plus ihre Auswahl aus den Verbesserungsvorschlägen (Formulare vom 09.10.2026). Gilt vor
Fachdokumenten und E-xx; U-00 (zweisprachig) gilt weiter.

| ID | Änderung |
| --- | --- |
| U-50 | **Startseite oben:** Titel „Planet Claire“ mit Einleitung über die ganze Breite; darunter **drei Spalten**: links das **Foto von Jutta und Coco, kleiner**, direkt darunter der Text der bisherigen Station „Jutta & Coco“ („Werkstatt unter der Woche …“) mit Link „Mehr über uns“; Mitte **Koko** mit Mütze; rechts der **Tour-Schaukasten** mit Instagram-Link. Auf dem Handy untereinander (Foto + Text, Koko, Tour – Reihenfolge siehe U-51). Die **Station „Jutta & Coco“ entfällt**; Stationen 01–05. |
| U-51 | **Handy:** Der Tour-Schaukasten steht unter 1100 px **zusammengeklappt hinter Station 01**, damit man schneller zu den Stücken kommt. |
| U-52 | **Stations-Kompass:** kleine Sprungleiste aus Planeten-/Sternmarken (Keramik, Textil, Zeichnungen, Schmuck, Tattoo) – reine Anker, ohne Skript. |
| U-53 | **Koko schläft nachts:** nach Berliner Uhrzeit (z. B. 22–7 Uhr) müde/geschlossene Augen, tagsüber wandern die Pupillen wie bisher; serverseitig, ohne Speicher/Skript. |
| U-54 | **Koko lädt schneller:** Bild mit Vorrang laden, zusätzlich kleineres Bildformat (AVIF mit WebP-Rückfall). |
| U-55 | **Leine ruhiger:** Beim Umwickeln/Umrunden (Kringel, Bild-Umrundungen) darf die Linie nicht plötzlich extrem schnell werden – Zeichentempo ausgleichen, damit es nicht hektisch wirkt (überall, Startseite, Shop, Tattoo). |
| U-56 | **Flash ↔ Galerie:** Flash-Motiv zeigt „schon gestochen → Foto“, Galerie-Eintrag „nach Flash F-…“ (vorhandenes Feld `flash`), nur mit Einwilligung des Fotos. |
| U-57 | **Shop:** „Frag nach diesem Stück“ (Mail-Link mit Nummer im Betreff); bei verkauften Stücken „Etwas Ähnliches anfragen“ → Auftragsarbeiten; verkaufte Stücke nicht mehr seitenweise hinten an die Shop-Liste, sondern nach kurzer Reihe „Archiv ansehen“; optionales **Größen-Vergleichsfoto** je Stück. |
| U-58 | **Kasse:** Knopf „Erstatten“ in der Verwaltung (zu späte/doppelte Zahlungen, über den vorhandenen Erstattungs-Adapter); im Korb „reserviert bis HH:MM“ statt nur „nicht verfügbar“; im Seitenfuß eine kurze Zeile zu Zahlarten, Versand und Abholung. |
| U-59 | **EU-Gewährleistungshinweis fertig:** Aufbau für die amtliche Grafik und den amtlichen Wortlaut (DE/EN) vollständig; solange die amtliche Fassung nicht vorliegt bzw. die Kanzlei nicht geprüft hat, bleibt sie als Platzhalter markiert. |
| U-60 | **Verwaltung:** Tour-Termine als **eigener Menüpunkt**; **Stück duplizieren** („als neues Stück kopieren“, ohne Fotos/Nummer); **Termin kopieren**; **Markt-Verkauf einem Tour-Termin zuordnen**, optional mit Preis (zählt für die Umsatzgrenze). |
| U-61 | **Teilen:** Teilen-Knopf an Stücken und Flash-Motiven (Teilen-Menü des Geräts, sonst Link kopieren; nachgeladen, kein Drittanbieter); eigene **Vorschaukarten (OG-Bilder)** für Flash und Galerie. |
| U-62 | **Technik:** CI-Minuten etwa halbieren (doppelte Testläufe/Builds zusammenlegen), Wackel-Tests auf Zustände statt feste Wartezeiten umstellen, Ladebudget entlasten (nicht nötige Skripte später laden), gleichartige Listen-Seiten zusammenlegen. |
| U-63 | **GitHub-Projekt:** Jutta stellt das Repository selbst auf **privat** (Fotos und alte Vorschauen bleiben unverändert, sind dann nur noch für sie sichtbar). |
| U-64 | **Ablauf:** Phase **P14** vor P11, selbst durcharbeiten, CI + Kunst-QA grün, selbst mergen (Squash), am Ende neue HTML-Vorschau an Jutta. |
| U-65 | **Keine GitHub-Actions-Minuten:** Alle Prüfungen (bisher `ci.yml`, `ci-full.yml`, `art-qa.yml`, `preview-export.yml`, `release.yml`, `restore-drill.yml`) laufen **lokal in der Claude-Sitzung** über `pnpm ci:local quick|full|art`; die GitHub-Workflows sind nur noch per Hand startbar (`workflow_dispatch`, keine `push`/`pull_request`/`schedule`-Auslöser). Nachweis: Bericht + Commit-Status „lokal/…“ über die GitHub-API. Merge nur bei grünem lokalem Phasenlauf. Vorschauen gehen als HTML im Chat an Jutta. Konzept: `docs/KONZEPT-OHNE-ACTIONS.md`. |
| U-66 | **Ab sofort:** P14 wird bereits mit der lokalen Prüfschleuse abgeschlossen (keine GitHub-Läufe mehr). |

