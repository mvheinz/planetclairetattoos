# Entscheidungsprotokoll – planetclairetattoos.com

> **Verbindlich.** Diese Datei ist die oberste Quelle der Wahrheit für alle Entwicklungs-Sessions.
> Reihenfolge bei Widersprüchen: **dieses Protokoll > docs/KONZEPT.md & Fachdokumente > PLAN.md > docs/research/**.
> Grundlage: Interview mit der Inhaberin (13 Fragerunden) am 26.09.2026, Konzept-Freigabe am 26.09.2026
> („Freigabe, Instagram-Bilder darfst du herunterladen“). Konzeptseite: `docs/konzept/planet-claire-konzept.html`
> (veröffentlicht als Artifact https://claude.ai/artifact/DaoukHosUUM5L943AB3Gh8).
>
> Entscheidungen mit **[V]** sind Vorschläge von Claude, die die Inhaberin mit der Freigabe angenommen hat.
> Entscheidungen ändern: nur die Inhaberin. Cloud-Sessions ändern diese Datei nicht inhaltlich, sie ergänzen höchstens
> den Abschnitt „Umsetzungsnotizen“ am Ende.

## Inhaberin & Geschäft

| ID | Thema | Entscheidung |
|---|---|---|
| E-01 | Person | Jutta, Künstlerin in Berlin: Fine-Line-/naive Tattoos (Privatstudio), handgemachte Unikat-Keramik, bemalte Second-Hand-Textilien/Caps, Zeichnungen/Aquarelle. Instagram @planet.claire.tattoos, Mail jutta@planetclairetattoos.com. Hund **Coco** (Chihuahua-Mix) ist Maskottchen. |
| E-02 | Steuer | **Kleinunternehmerin § 19 UStG.** Globaler Schalter „Regelbesteuerung“ mit Gültig-ab-Datum ist vorbereitet (19 % bzw. 7 % für echte Kunst nach Anlage 2 Nr. 53 UStG), Standard AUS. |
| E-03 | Team | Nur Jutta, **ein** Admin-Konto. Bedienung am Handy und Laptop gleichwertig. |
| E-04 | Buchhaltung | Selbst (EÜR). Shop erzeugt Rechnungs-PDFs + Monatsexport CSV (optional DATEV-Format). Keine Anbindung an Buchhaltungssoftware. |
| E-05 | Budget | Laufende Kosten ≤ ca. 25 €/Monat (ohne Zahlungsgebühren). Kostenwarnung ab 30 €. |
| E-06 | Termin | Kein fester Starttermin. |
| E-07 | Name | „Planet Claire“ = B-52's-Song. Retro-Space-Motive willkommen, aber **handgezeichnet**. |

## Sortiment

| ID | Thema | Entscheidung |
|---|---|---|
| E-10 | Produktarten | **Nur Unikate** (Bestand 1). **Keine** Serien, **keine** Größenvarianten (Größe = Eigenschaft des Unikats). Datenmodell muss keine Varianten können. |
| E-11 | Auftragsarbeiten | **Nur Anfrageformular** (Referenzbilder optional, privat, Löschung nach 6 Monaten). Bezahlung außerhalb des Shops. Nicht kaufbar. |
| E-12 | Objektnummern | Vergibt Jutta selbst, **reine Zahlen**, frei eingetragen. System erzwingt Eindeutigkeit (UNIQUE) und schlägt die nächste freie Zahl vor. Nummer nach Veröffentlichung nicht mehr änderbar. Anzeige z. B. „Nr. 017“. |
| E-13 | Veröffentlichung | Stücke werden **sofort online** gestellt (Entwurf → online). Keine Drops, kein Countdown, kein Newsletter. |
| E-14 | Verkaufte Stücke | **Pro Stück wählbar**, ob es mit „sold“-Stempel im Archiv sichtbar bleibt [V: Standard = sichtbar]. |
| E-15 | Keramik | Glasur-Nachweise ungeklärt → Standard **„Dekoration – nicht für Lebensmittel“**. Pro Stück auf „lebensmittelecht“ umstellbar **nur** wenn eine Konformitätserklärung (PDF) für alle verwendeten Glasuren hinterlegt ist. |
| E-16 | Textil | **Second-Hand/Vintage.** Pflichtfelder: Faserzusammensetzung laut Etikett (amtliche Bezeichnungen, Summe 100 %), Größe, Zustand. Option „Etikett fehlt“ + Materialangabe nach bestem Wissen (Rechtsfrage in Kanzlei-Briefing). |
| E-17 | Schmuck | Metallteile bisher unbekannt → Veröffentlichung von Schmuck **nur** mit Häkchen „Metallteile nickelfrei, Nachweis liegt vor“. Warnhinweis Kleinteile. |
| E-18 | Motive | Auf Verkaufsware **nur eigene Figuren** (keine geschützten fremden Figuren). |

## Verkauf, Zahlung, Versand

| ID | Thema | Entscheidung |
|---|---|---|
| E-20 | Zahlarten | **Karte + Apple Pay + Google Pay, PayPal (über Stripe), Vorkasse/Überweisung.** Kein Klarna, keine SEPA-Lastschrift [V]. |
| E-21 | Zahlungsanbieter | **Stripe**, Checkout Sessions API mit `ui_mode: 'elements'` → Kasse auf eigener Seite mit eigenem Button **„Zahlungspflichtig bestellen“** [V]. |
| E-22 | Reservierung | Beim Start des Bezahlvorgangs **30 Minuten** Reservierung (atomar in der DB) [V]; sichtbarer Countdown mit Coco. |
| E-23 | Vorkasse | Stück **5 Tage** reserviert. Bestellmail mit IBAN + Bestellnummer als Verwendungszweck. Erinnerung nach 3 Tagen, automatische Stornierung + Freigabe nach 5 Tagen [V]. Admin-Knopf „Zahlung erhalten“. |
| E-24 | Liefergebiet | **Start nur Deutschland** + **Abholung in Berlin**. EU-Länder technisch vorbereitet, einzeln freischaltbar (Grund: PPWR Art. 45 Bevollmächtigter pro Land). GB/US gesperrt. CH vorbereitet, aus. |
| E-25 | Versandkosten | Versandklasse pro Stück, im Warenkorb gilt die höchste. Startpreise: **Brief 4,50 € · Paket klein 6,50 € · Keramik 8,90 € · Abholung 0 €**. Im Admin änderbar. |
| E-26 | Versanddienst | **DHL.** Labels manuell (Post & DHL App / Online-Frankierung). Admin: „Adresse kopieren“, Sendungsnummer eintippen/scannen → Versandmail. DHL-API später (Carrier-Schnittstelle vorbereiten). |
| E-27 | Rücksendekosten | Bei Widerruf trägt die **Kund:in** die Rücksendekosten (in Widerrufsbelehrung angekündigt). Kulanz im Einzelfall. |
| E-28 | Flohmarkt | Nur Knopf **„offline verkauft“** (kein Markt-Modus). Kartenzahlung dort weiter per SumUp o. ä.; Shop verwaltet nur den Bestand. |
| E-29 | Abholung | Nach Absprache; Ort erst in der Abholmail (Privatstudio) [V]. |
| E-30 | Kundenkonten | **Keine.** Gastbestellung, Bestellstatus über geheimen Link in der Mail [V]. |
| E-31 | Lieferzeit | Anzeige „2–5 Werktage“, im Admin änderbar [V]. |

## Recht

| ID | Thema | Entscheidung |
|---|---|---|
| E-40 | Impressum/Hersteller | **Privatadresse** (auch GPSR-Herstellerangabe auf Produktseiten). Stammdaten im Admin. |
| E-41 | Rechtstexte | **Einmalig von Anwältin/Anwalt.** CMS-Collection mit Versionierung; jede Bestellung speichert die gültige Version. Claude erstellt eine **Kanzlei-Briefing-Mappe**. Jährliche Erinnerung zur Prüfung. Schnittstelle zu Update-Diensten (IT-Recht Kanzlei LTI) nur als spätere Option. |
| E-42 | Portfolio-Einwilligung | Jutta holt Einwilligungen nach. **Häkchen pro Foto**; ohne Häkchen keine Veröffentlichung von Fotos mit Kund:innen. |
| E-43 | Cookie-Banner | **Keins.** Architektur ohne einwilligungspflichtige Dienste: keine Embeds, keine fremden Fonts, kein Tracking-Pixel, Warenkorb-Cookie erst nach erster Aktion, cookielose Statistik [V]. |
| E-44 | Widerrufsbutton | § 356a BGB (seit 19.06.2026): „Vertrag widerrufen“ auf jeder Seite, zweistufig, sofortige Eingangsbestätigung. |
| E-45 | Umsatz-Wächter | Zähler Shop-Umsatz + monatliche manuelle Summen (Tattoo, Flohmarkt), Warnungen vor der Kleinunternehmer-Grenze [V]. |

## Tattoo-Bereich (nicht kaufbar)

| ID | Thema | Entscheidung |
|---|---|---|
| E-50 | Ort | **Privatstudio**, öffentlich nur der Bezirk. |
| E-51 | Anfragen | **Nur E-Mail- und Instagram-DM-Links**, kein Formular. Flash-„Anfragen“-Knopf öffnet Mail mit Motiv-Nummer im Betreff; Adresse zusätzlich als kopierbarer Text [V]. |
| E-52 | Flash | Pro Motiv **einmalig oder wiederholbar**; Status verfügbar/vergeben. |
| E-53 | Angebote | **Flash mit Festpreis, Flash-Days/Aktionen mit Datum (automatisch ausgeblendet nach Ablauf), Preisrahmen Custom.** Keine Guest-Spot-Liste. Keine Online-Anzahlung. |

## Sprache & Inhalte

| ID | Thema | Entscheidung |
|---|---|---|
| E-60 | Sprachen | **Deutsch (Standard) + Englisch.** Routen `/de/…`, `/en/…`. |
| E-61 | Übersetzung | Englische Produkttexte per **„Übersetzen“-Knopf** im Admin (DeepL API Free), editierbar. |
| E-62 | Seitentexte | **Entwürfe von Claude** in Juttas Insta-Ton (locker, DE/EN gemischt), Jutta korrigiert im Admin. |
| E-63 | Beispielbestand | **Für alles ein Beispielbestand** (Wunsch nach Freigabe): ca. 30 Stücke in allen Kategorien (einige sold), ca. 12 Bestellungen in allen Status (erfundene Namen), Flash, Flash-Day, Galerie, FAQ, Aftercare, Über mich – alles DE/EN ausformuliert. Als `seed` markiert, per Knopf entfernbar. **Keine** Bilder/Texte aus fremden Shops (Urheberrecht) – nur Struktur-Inspiration. |
| E-64 | Instagram-Bilder | Erlaubnis erteilt. 22 öffentlich sichtbare Bilder liegen in `content/seed/instagram/` (Beschreibung: `manifest.json`). Volle Auflösung später aus Juttas Instagram-Datenexport (`content/seed/instagram-export/`). |

## Design

| ID | Thema | Entscheidung |
|---|---|---|
| E-70 | Leitmotiv | **Konzept D „Tuschelinie“**: eine durchgehende Linie zeichnet sich beim Scrollen. |
| E-71 | Linie = Leine | Die Linie ist **Cocos Leine**; Coco rennt voraus, schnüffelt an Stationen. |
| E-72 | Reichweite | Linie **verbindet alle Seiten** (nicht nur Startseite); Verhalten je Seitentyp siehe docs/design/DESIGN.md. |
| E-73 | Linienfarbe | **Immer tuscheschwarz.** |
| E-74 | Stimmung | **Hell: Papier & Ton** (zartes Schneidematten-Raster erlaubt). |
| E-75 | Coco | Coco ist **Guide-Figur**; gezeichnet nach Fotos (Referenz: Instagram-Highlights), Jutta liefert ggf. weitere Fotos. |
| E-76 | Zeichnungen | Aus Juttas Instagram-Bildern (digitalisiert zu SVG-Linien). |
| E-77 | Shop-Look | **Flohmarkt-Preisschilder** (handgeschrieben, an der Linie/Schnur hängend), **„sold“-Stempel**. |
| E-78 | Animation | **Mittel**: Startseite/Menü verspielt, Shop/Kasse/Admin ruhig und schnell. `prefers-reduced-motion` → statisch. |
| E-79 | Schrift | **Freie Handschrift-Schrift**, keine eigene Font. Festlegung: Mansalva (Display/Preisschild), Bricolage Grotesque (Text), IBM Plex Mono (Nummern) – alle OFL, **selbst gehostet**. |
| E-80 | Extra-Aufwand | Wunsch nach Freigabe: **Bilder und Animationen besonders hochwertig** → eigene Phase P9 „Kunst & Bewegung“ mit Studio-QA (Videoaufnahmen, mehrere unabhängige Prüf-Durchgänge, Checkliste docs/design/KUNST-QA.md). |

## Technik & Betrieb

| ID | Thema | Entscheidung |
|---|---|---|
| E-90 | Stack | **Eine** Next.js-16-App mit eingebettetem **Payload CMS 3** (TypeScript, pnpm), Postgres. Eigener Commerce-Kern (kein Payload-Ecommerce-Plugin, da Beta ohne Reservierung). |
| E-91 | Hosting | **Komfort-Variante**: Vercel Pro (Region fra1) + Neon Postgres (aws-eu-central-1) + Cloudflare R2 (EU-Jurisdiktion). Docker-Exit-Pfad (Hetzner) wird gepflegt. |
| E-92 | Mails | Transaktionsmails über EU-Anbieter **Lettermint** (SMTP). IONOS-Postfach bleibt unverändert. |
| E-93 | Admin | **Web-App (PWA)** mit eigenen Handy-Ansichten; keine native App. Admin-Pfad nicht `/admin` [V]. |
| E-94 | Konten | GitHub + IONOS vorhanden. Stripe, PayPal-Business, Vercel, Neon, Cloudflare, Lettermint, Sentry, DeepL neu – alle auf jutta@planetclairetattoos.com mit 2FA. |
| E-95 | DNS | Bleibt bei IONOS. Nur Web-Einträge ändern (A/CNAME, AAAA der Parkseite löschen); MX/SPF/DKIM unverändert. |
| E-96 | Statistik | Cookielos (Vercel Web Analytics), keine Drittanbieter-Tracker [V]. |
| E-97 | Arbeitsweise Cloud | Jede Phase = Branch + Pull Request; Merge bei grüner CI durch die Session (falls Rechte fehlen: Jutta klickt „Merge“). Keine Rückfragen an Jutta – alles steht in den Docs; Unklares → konservativste Variante + Eintrag in `docs/OFFENE-PUNKTE.md`. |
| E-98 | Vorschau-Datei | **Wunsch nach Freigabe:** Wenn der Plan leer ist, automatisch **`planet-claire-vorschau.html`** erzeugen – die ganze Website als **eine einzige HTML-Datei** (alle Seiten, Bilder, Schriften, Animationen inline, offline auf jedem Rechner öffnbar, Kasse als Attrappe). Zusätzlich ab P2 nach jeder Phase eine Zwischenversion als GitHub-Actions-Artefakt. |
| E-99 | Phasen | P0 lokal (dann **Stopp**), P1–P10 in der Cloud autonom, P11 Go-live gemeinsam mit Jutta. |

## Später (bewusst nicht im Plan)

EU-Versand je Land, Schweiz, DHL-API-Labels, Produktvideos, Drops/Countdown/Newsletter/Warteliste, Gutscheine, Rabattcodes, Online-Anzahlung Tattoo, Klarna, eigene Handschrift-Font, Markt-Modus „Marktkiste“, Kundenkonten.

## Umsetzungsnotizen (von Cloud-Sessions ergänzt)

_(leer)_
