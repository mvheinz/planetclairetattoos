# KONZEPT – Fach-Spezifikation planetclairetattoos.com

> **Stand:** 26.09.2026 · **Version:** 1.0 (P0) · **Status:** verbindlich für P1–P10, Rang siehe §0.3
> **Grundlage:** `docs/ENTSCHEIDUNGEN.md` (E-01…E-99), freigegebene Konzeptseite `docs/konzept/planet-claire-konzept.html`,
> Recherche `docs/research/*.md`, Bild-Manifest `content/seed/instagram/manifest.json`.
> **Sprache:** Deutsch. Code-Bezeichner, Feldnamen, Enums und Umgebungsvariablen auf Englisch.

---

## Inhalt

0. [Zweck, Leser, Rangfolge der Dokumente](#0-zweck-leser-rangfolge-der-dokumente)
1. [Überblick, Zielgruppen, Erfolgskriterien](#1-überblick-zielgruppen-erfolgskriterien)
2. [Sitemap & Routen](#2-sitemap--routen)
3. [Seiten-Spezifikationen](#3-seiten-spezifikationen)
4. [Kaufprozess end-to-end](#4-kaufprozess-end-to-end)
5. [Statusmodelle](#5-statusmodelle)
6. [E-Mails](#6-e-mails)
7. [Verwaltung](#7-verwaltung)
8. [Automatisierte Jobs](#8-automatisierte-jobs)
9. [Tattoo-Bereich](#9-tattoo-bereich)
10. [Auftragsarbeiten-Formular](#10-auftragsarbeiten-formular)
11. [Beispielbestand](#11-beispielbestand)
12. [Single-File-Vorschau](#12-single-file-vorschau)
13. [Nicht-Ziele](#13-nicht-ziele)
14. [Glossar](#14-glossar)
- [Anhang A – Annahmen und offene Punkte](#anhang-a--annahmen-und-offene-punkte)
- [Anhang B – Recherche-Empfehlungen, die nicht gelten](#anhang-b--recherche-empfehlungen-die-nicht-gelten)

---

## 0. Zweck, Leser, Rangfolge der Dokumente

### 0.1 Zweck

Dieses Dokument beschreibt **was** die Software fachlich tut: Seiten, Routen, Abläufe, Zustände, E-Mails, Verwaltung,
Hintergrund-Jobs, Beispielbestand und Vorschau-Datei. Es beschreibt **nicht**:

| Thema | Zuständiges Dokument |
|---|---|
| Collections, Felder, Typen, Relationen, Indizes | `docs/DATENMODELL.md` |
| Technik, Ordnerstruktur, Adapter, Umgebungsvariablen, CI, Deployment | `docs/ARCHITEKTUR.md` |
| Aussehen, Farben, Schriften, Tuschelinie, Coco, Bewegung | `docs/design/DESIGN.md` |
| Prüfverfahren Kunst & Animation (P9) | `docs/design/KUNST-QA.md` |
| Rechtstexte, Pflichtangaben-Checkliste, Kanzlei-Briefing, Dienste-Verzeichnis | `docs/recht/` |
| Beispieldaten im Detail | `content/seed/SEED-SPEC.md` |
| Reihenfolge der Arbeit, Aufgaben, Definition of Done je Phase | `PLAN.md` |
| Ungeklärtes, Annahmen, Aufgaben für Jutta | `docs/OFFENE-PUNKTE.md` |
| Arbeitsregeln für Agenten | `CLAUDE.md` |

Die Pfade der Nachbar-Dokumente sind Stand P0. Heißt ein Dokument später anders, gilt sein Inhalt.

### 0.2 Leser

- **Primär:** autonome Claude-Code-Agenten in Cloud-Sessions (P1–P10). Sie können Jutta **nichts fragen** (E-97).
  Deshalb ist jede Anforderung konkret, mit Namen und prüfbaren Akzeptanzkriterien (`AK-…`).
- **Sekundär:** Claude und Jutta in P11 (Go-live), Kanzlei und Steuerberatung (indirekt über `docs/recht/`).

Regeln für Agenten beim Lesen:

1. „MUSS“ ist verbindlich. „SOLL“ ist verbindlich, außer ein Leistungs- oder Rechtsziel wird dadurch verfehlt; dann Eintrag in
   `docs/OFFENE-PUNKTE.md`. „KANN“ ist optional.
2. Mit **[Annahme]** markierte Punkte sind konservative Standardwerte ohne Entscheidung der Inhaberin. Sie gelten, bis
   Jutta etwas anderes entscheidet, und stehen gesammelt in Anhang A (zur Übernahme nach `docs/OFFENE-PUNKTE.md`).
3. Fehlt etwas: konservativste Variante bauen, Eintrag in `docs/OFFENE-PUNKTE.md`, nicht blockieren (E-97).
4. Phasen-Markierungen wie **[P4]** sagen, in welcher Phase ein Punkt gebaut wird. Maßgeblich ist `PLAN.md`.

### 0.3 Rangfolge bei Widersprüchen

```
1. docs/ENTSCHEIDUNGEN.md                     (oberste Instanz, ändert nur Jutta)
2. KONZEPT · DATENMODELL · ARCHITEKTUR · DESIGN · RECHT   (gleichrangig, je Zuständigkeit)
3. PLAN.md
4. docs/research/*.md                         (Fakten mit Quellen, Empfehlungen nur, wenn nicht überstimmt)
```

Auflösung auf Rang 2: Jedes Dokument gewinnt in seiner Zuständigkeit (Tabelle §0.1).
- **Verhalten, Umfang, Abläufe, Texte von Knöpfen** → KONZEPT gewinnt.
- **Namen von Feldern, Collections, Enums** → DATENMODELL gewinnt. Die hier genannten Namen sind die fachliche Referenz;
  weicht DATENMODELL ab, gilt dessen Name mit dem hier beschriebenen Verhalten.
- **Namen von Umgebungsvariablen, Adaptern, Endpunkten, Cookies und Task-Slugs** → ARCHITEKTUR gewinnt (hier genannte
  Namen folgen ARCHITEKTUR §5.2, §2.5, §8.7 und Anhang A).
- **Rechtliche Formulierungen** (Pflichtsätze, Checkboxtexte, Belehrungen) → RECHT gewinnt; bis RECHT einen Text festlegt,
  gelten die hier genannten Texte.

Die freigegebene Konzeptseite (`docs/konzept/planet-claire-konzept.html`) ist der Wortlaut, dem Jutta zugestimmt hat. Wo
dieses Dokument sie präzisiert, gilt dieses Dokument; wo es ihr widerspricht, ist es ein Fehler (melden in `OFFENE-PUNKTE.md`).

### 0.4 Konventionen

| Thema | Regel |
|---|---|
| Anrede | Öffentliche Seiten und Kund:innen-Mails duzen („du“), locker, in Juttas Insta-Ton (E-62). Rechtstexte in der Form, die die Kanzlei liefert. |
| Geld | Ganzzahlig in Cent, Währung EUR. Anzeige DE `53,90 €`, EN `€53.90`. Alle Preise sind Endpreise (Brutto = Endpreis, E-02). |
| Zeit | Fachliche Zeitpunkte in UTC speichern, anzeigen und berechnen in `Europe/Berlin`. „Tag“ = Kalendertag in Berlin. |
| Datum | DE `26.09.2026`, `Sa 26.09.`; EN `26 Sep 2026`, `Sat 26 Sep`. |
| Objektnummer | Ganzzahl, Anzeige mindestens dreistellig: `Nr. 017` (EN `No. 017`), ab 1000 ohne Auffüllen (E-12). |
| Belegnummern | Formate laut DATENMODELL §8.6/§8.7: Bestellung `PC-2026-00017`, Rechnung `RE-2026-00001`, Storno/Gutschrift `GS-2026-00001`, Widerruf `WR-2026-00001`, Anfrage (Auftragsarbeit) `AA-2026-0001`, Datenschutz-Anfrage `DS-2026-0001`, Flash `F-012`. Beispieldaten (DATENMODELL §13.3): Bestellungen `PC-2026-900NN`, Widerrufe `WR-2026-9000N`, Anfragen `AA-2026-900N`, Belege in den eigenen Serien `BSP-RE-…`/`BSP-GS-…` (§11.2). |
| Sprachen | `de` (Standard) und `en` (E-60). Admin nur Deutsch. |
| Akzeptanzkriterien | `AK-<Abschnitt>-<Nr>`, z. B. `AK-4-07`. Jedes AK ist automatisiert testbar (Vitest/Playwright), sonst ausdrücklich als „manuell“ markiert. |

---

## 1. Überblick, Zielgruppen, Erfolgskriterien

### 1.1 Das Produkt in einem Absatz

planetclairetattoos.com ist **eine** zweisprachige Website (DE/EN) der Berliner Künstlerin Jutta (@planet.claire.tattoos)
mit drei Welten: **Shop** für handgemachte **Unikate** (Keramik, bemalte Second-Hand-Textilien und Caps, Zeichnungen,
Keramikschmuck), **Tattoo** (zeigen, einladen, erklären – nichts kaufbar) und **Jutta & Coco**. Dazu kommen ein
**Anfrageformular für Auftragsarbeiten**, alle **Pflichtseiten** und eine **Verwaltung als Web-App** für das Handy.
Gestalterisches Leitmotiv ist die **Tuschelinie**: eine tuscheschwarze Linie, die sich beim Scrollen zeichnet und Cocos
Leine ist (E-70…E-73). Technisch ist es eine Next.js-16-App mit eingebettetem Payload CMS 3 und eigenem Commerce-Kern (E-90).

### 1.2 Bausteine im Überblick

| Baustein | Kern | Phase |
|---|---|---|
| Datenmodell & Verwaltung | Collections, Pflichtfelder je Kategorie, Login, Grund-Seed | P1 |
| Designsystem & Tuschelinie | Tokens, Schriften, Kopf/Menü/Fuß, Linien-Maschine, Startseite | P2 |
| Shop-Schaufenster | Shop, Kategorien, Produktseite, Archiv, SEO | P3 |
| Warenkorb/Kasse/Bezahlen | Korb, Versand, Kasse, Reservierung, Stripe, Vorkasse, Abholung, Rechnung, Mails | P4 |
| Abläufe hinter den Kulissen | Handy-Ansichten, Packen, Versand, Abholung, Export, Verpackungsmengen, Umsatz-Wächter, PWA | P5 |
| Recht & Datenschutz | Rechtstexte versioniert, Widerrufsbutton, Erstattung, Löschfristen, DSGVO-Werkzeuge | P6 |
| Tattoo & Auftragsarbeiten | Tattoo-Seiten, Flash, Galerie mit Einwilligung, Anfrageformular | P7 |
| Inhalte & Beispielbestand | Alle Texte DE/EN, kompletter Seed, Übersetzen-Knopf, leere Zustände | P8 |
| Kunst & Bewegung | Coco-Posen, Line Boil, Choreografie, Foto-Look, Studio-QA | P9 |
| Qualität & Start | Tests, Barrierefreiheit, Tempo, Handbuch, Vorschau-Datei final | P10 |
| Go-live | Konten, DNS, Stripe live, echte Rechtstexte | P11 |

### 1.3 Zielgruppen

| Zielgruppe | Situation | Was sie braucht | Folgen für die Umsetzung |
|---|---|---|---|
| **Instagram-Follower** (Hauptgruppe, ca. 90 % mobil) | Tippen in Story/Post/Bio auf einen Link, landen im **Instagram-In-App-Browser** (iOS: WebKit; Android: WebView) auf Startseite oder direkt auf einem Stück | Schnell sehen, ob das Stück noch da ist, Preis inkl. Versand, in 2–3 Minuten gekauft | Mobile-first (360–430 px), LCP < 2,5 s, direkter Produktlink `/de/shop/017-…` und Kurzlink `/nr/17`, keine Pop-ups/neuen Tabs im Kaufpfad, Karte + PayPal funktionieren auch ohne Apple/Google Pay |
| Kaufende aus Berlin | Wollen abholen statt Versand | Abholung wählen, Absprache per Mail | Lieferart „Abholung in Berlin“ 0 €, Ort erst in der Abholmail (E-29) |
| Tattoo-Interessierte | Wollen Stil, Flash, Preise, Termine sehen | Motiv-Nummer, Preis, Kontaktweg | Flash mit Nummer, Festpreis, Status; Mail-Knopf mit Motiv im Betreff; Adresse kopierbar; Anfrage nur per Mail (E-51, P12.7) |
| Auftragsarbeit-Interessierte | Haben eine Idee (Cap, Teller …) | Unkompliziert anfragen, Bilder mitschicken | Kurzes Formular, bis 5 Bilder, Bestätigungsmail (E-11) |
| Englischsprachige Besucher:innen | Touristen, internationale Follower | Gleiche Inhalte auf Englisch | Alle öffentlichen Seiten unter `/en/…` (E-60) |
| **Jutta** (einzige Admin-Person, E-03) | Am Handy (Flohmarkt, Atelier, unterwegs) und am Laptop | Stück in Minuten online, Bestellung am Handy packen/versenden, Warnungen | Eigene Handy-Ansichten, PWA-Icon, Bestätigungsdialoge, klare Texte ohne Technikbegriffe |
| Kanzlei, Steuerberatung | Indirekt | Versionierte Rechtstexte, Exporte, Rechnungen | Versionierung, CSV/DATEV-Export, unveränderliche PDFs |
| Suchmaschinen/Link-Vorschauen | Crawler, Instagram-/WhatsApp-Linkvorschau | Titel, Bild, Beschreibung | OG-Tags, JSON-LD, Sitemap, hreflang |

### 1.4 Erfolgskriterien (messbar)

| ID | Kriterium | Messung | Phase |
|---|---|---|---|
| EK-01 | **Tempo mobil:** LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms auf Start, Shop, Produktseite, Tattoo | Lighthouse CI, Profil „mobile“, Median aus 3 Läufen, als CI-Gate. Strengere Ziele (LCP ≤ 2,0 s, CLS ≤ 0,05) werden berichtet, blockieren aber nicht. | P2, P3, P7, P10 |
| EK-02 | **Kaufpfad kurz:** vom Produktlink bis zur bezahlten Bestellung höchstens 4 Seiten (Produkt → Warenkorb → Kasse → Danke) | Playwright-E2E bei 390×844 und 412×915 für Karte, PayPal, Vorkasse, Abholung | P4 |
| EK-03 | **Nie doppelt verkauft:** 0 Doppelverkäufe | Integrationstest: 20 parallele Reservierungen desselben Stücks → genau 1 Erfolg, 100 Wiederholungen | P4 |
| EK-04 | **Kein Cookie vor dem Korb:** 0 Cookies, 0 localStorage/sessionStorage-Einträge vor dem ersten „In den Korb“ | Playwright besucht alle öffentlichen Routen DE+EN und prüft `document.cookie`, Storage und `Set-Cookie`-Header | P2 ff., P6 |
| EK-05 | **Keine fremden Dienste:** keine Requests an Fremd-Domains außer Stripe auf `/kasse` bzw. `/checkout` | Playwright-Request-Log + CI-Prüfung der ausgelieferten HTML auf externe URLs | P6, P10 |
| EK-06 | **Rechtlich vollständig:** 100 % der Punkte der Rechts-Checkliste (`docs/recht/`) umgesetzt und getestet | Checkliste mit Test-Referenz je Punkt | P6 |
| EK-07 | **Barrierearm:** 0 axe-Verstöße „serious/critical“ auf allen Seitentypen; alles per Tastatur bedienbar | axe-core in Playwright; Tastatur-Durchlauf-Tests | P2 ff., P10 |
| EK-08 | **Handy-Pflege:** „Neues Stück“ bis „online“ mit höchstens den Pflichtfeldern der Kategorie (Keramik: ≤ 10 Eingaben ohne Fotos); Bestellung „bezahlt → versendet“ in ≤ 5 Taps plus Eingabe der Sendungsnummer | Playwright bei 390×844 zählt Eingaben/Klicks (P10, automatisch); Stoppuhr-Test ≤ 3 min mit Jutta in P11 (manuell, Aufteilung in `tests/manual-checks.json`) | P5, P10, P11 |
| EK-09 | **Zweisprachig vollständig:** jede öffentliche Route existiert in DE und EN; keine fehlenden Übersetzungsschlüssel; kein „Lorem ipsum“ | CI-Skript prüft Schlüssel-Parität, Route-Parität, Suche nach `lorem` | P8, P10 |
| EK-10 | **Kosten:** laufend ≤ 25 €/Monat ohne Zahlungsgebühren (E-05) | Kostenaufstellung in P11 | P11 |
| EK-11 | **Vorschau-Datei:** `dist/planet-claire-vorschau.html` ≤ 40 MB (Ziel ≤ 20 MB, §12.6), offline öffnbar, alle Routen klickbar, 0 Netzwerk-Requests, 0 Konsolenfehler | Playwright-Test §12.7 | P2 ff., P10 |
| EK-12 | **Kunst-Qualität:** alle Punkte aus `docs/design/KUNST-QA.md` in allen Prüf-Durchgängen abgenommen, EK-01 weiterhin erfüllt | QA-Protokoll P9 | P9 |

### 1.5 Umgebungen und Ersatz-Adapter (bis P11 ohne echte Konten)

Bis P11 gibt es **keine** echten Konten oder Geheimnisse (kein Stripe-Live, kein Vercel, Neon, R2, Lettermint, DeepL).
Alles MUSS lokal und in der Cloud-Sandbox (Postgres 16 + Docker vorhanden) bau- und testbar sein. Deshalb hat **jede
Integration eine Adapter-Schnittstelle mit Mock**. Technische Namen legt `docs/ARCHITEKTUR.md` fest (Umgebungsvariablen
§5.2); fachlich gilt:

| Integration | Produktion (ab P11) | Lokal / Cloud-Session / CI | Auswahlregel | Verhalten des Ersatzes |
|---|---|---|---|---|
| Datenbank | Neon Postgres (Frankfurt) | lokales Postgres 16/17 (Docker oder vorinstalliert) | `DATABASE_URL` | – |
| Medien öffentlich | Cloudflare R2 (EU) | lokales Dateisystem, z. B. `./.data/media` | `STORAGE_DRIVER=s3\|local` | gleiche URLs über die App-Dateiroute |
| Medien privat (Anfrage-Uploads, Rechnungen, Packfotos) | R2 privater Bucket | `./.data/private` | wie oben | nie öffentlich erreichbar; Auslieferung nur über authentifizierte Admin-Route oder Token-Route |
| Mailversand | Lettermint SMTP (E-92) | Datei-Transport (`.eml` in `./.data/mail-outbox`) oder In-Memory für Tests; optional Mailpit | `EMAIL_DRIVER=smtp\|file\|memory\|log` | Mails vollständig gerendert inkl. Anhängen, Tests lesen sie aus |
| Zahlung | Stripe live (E-21) | Stripe **Test-Keys**, falls vorhanden (`sk_test_…`; in der Cloud bevorzugt als API-Credential der Umgebung, ARCHITEKTUR §5.3); sonst **Mock-Provider** mit aufgezeichneten Event-Fixtures; optional `stripe-mock` für API-Form-Tests | `PAYMENTS_DRIVER=stripe\|mock`; `sk_live_…` nur bei `APP_ENV=production` erlaubt, sonst Start-Abbruch | Mock rendert ein Test-Zahlungsfeld mit Auswahl „Erfolg / Abgelehnt / Abbruch / Verzögert“ (§4.7) und schickt synthetische Events **durch denselben Webhook-Handler** |
| Übersetzen | DeepL API Free (E-61) | Mock | `TRANSLATION_DRIVER=deepl\|mock` | liefert deterministisch `[EN] <Originaltext>` |
| Statistik | Vercel Web Analytics, cookielos (E-96) | aus | nur mit `NEXT_PUBLIC_ANALYTICS_ENABLED=true` **und** `APP_ENV=production` **und** bestätigter Admin-Einstellung (R-132; Standard `false`, ARCHITEKTUR §3.8) | – |
| Fehler-Monitoring | Sentry EU | aus | nur wenn `SENTRY_DSN` gesetzt | – |
| Zeitgesteuerte Jobs | Job-Wecker: Vercel Cron → `GET /api/cron/tick` mit `CRON_SECRET`, führt nur fällige Tasks aus (§8.1) | `pnpm jobs:run <task>` bzw. `JOBS_AUTORUN=true`; Tests rufen Tasks direkt mit fixer Uhrzeit auf | `JOBS_AUTORUN` | Jobs sind idempotent (§8.1) |
| Versanddienst | manuell (E-26) | manuell | `CARRIER_DRIVER=manual` (Carrier-Schnittstelle mit einzigem Adapter `manual`) | – |

Umgebungskennung: `APP_ENV=development|test|preview|staging|production` (ARCHITEKTUR §4.2). Fachliche Bedingungen
„Produktion“ hängen nur an `APP_ENV=production`, nie an `NODE_ENV`.
`SEED_PREVIEW_MODE=true` ist nur in `development`, `test`, `preview` und im Vorschau-Export wirksam. Bei
`APP_ENV=production` gilt doppelt (R-181): Der Serverstart bricht mit `SEED_PREVIEW_MODE=true` und klarer Meldung ab
(`assertProductionEnv`), und `seedPreviewModeActive()` liefert in Produktion unabhängig vom Wert immer `false` (§9.7, §11).

**AK-1-01** Ohne jede Zugangsdaten-Variable laufen `pnpm build`, `pnpm test`, `pnpm test:e2e` und `pnpm preview:export` in
der Cloud-Sandbox grün (nur lokales Postgres nötig).
**AK-1-02** Mit `STRIPE_SECRET_KEY=sk_live_…` und `APP_ENV≠production` bricht der App-Start mit klarer Meldung ab.
**AK-1-03** Mit `APP_ENV=production` und `SEED_PREVIEW_MODE=true` bricht der Serverstart ab (Unit-Test der Startprüfung);
`seedPreviewModeActive()` liefert mit `APP_ENV=production` immer `false`, die Galerie-Abfrage liefert dann keine Einträge mit
`showsCustomer=true` und `consentGiven=false`.

### 1.6 Querschnittsanforderungen (Kurzfassung)

- **Datenschutz-Architektur ohne Banner (E-43):** keine Cookies und kein Web-Storage vor der ersten Nutzeraktion
  „In den Korb“ (einzige Ausnahme: `localStorage['pc-motion']` erst nach Klick auf den Schalter „Animationen“; vollständige
  Liste ARCHITEKTUR §8.7); keine Einbettungen (Instagram, YouTube, Maps); keine fremden Schriften (alle selbst gehostet,
  E-79); kein Tracking-Pixel; Stripe.js wird **nur** auf der Kasse geladen; Statistik cookielos (E-96). Die Sprach-Erkennung
  setzt **kein** Cookie (next-intl-Locale-Cookie abgeschaltet). Auch Admin-Cookies entstehen nur unter dem Admin-Pfad.
- **Barrierefreiheit:** Ziel WCAG 2.2 AA (keine gesetzliche Pflicht, `recht-shop.md` BFSG). Die Tuschelinie ist Schmuck
  (`aria-hidden`), nie der einzige Weg; Navigation immer als echte Links mit Text (E-78, Konzeptseite „Menü“).
- **Bewegung:** Startseite und Menü verspielt, Shop/Kasse/Admin ruhig (E-78); `prefers-reduced-motion` → statisch.
  Umsetzung mit eigenem Code und Web Animations API; GSAP wird standardmäßig **nicht** verwendet (nur per ADR, nur R01,
  ≤ 30 KB gz, DESIGN §9.10).
- **Sicherheit:** Admin-Pfad nicht `/admin` (E-93), Login-Sperre nach Fehlversuchen, deny-by-default-Zugriffsregeln,
  private Dateien nie öffentlich, Security-Header (Details ARCHITEKTUR).
- **Aktualität:** Änderungen im Admin sind öffentlich nach spätestens 60 s sichtbar; Statuswechsel eines Stücks
  (reserviert, verkauft, wieder frei) nach spätestens 5 s (gezielte Revalidierung).

---

## 2. Sitemap & Routen

### 2.1 Grundregeln

1. Alle öffentlichen Seiten liegen unter `/de/…` und `/en/…` (E-60). Jede DE-Route hat genau eine EN-Entsprechung.
2. Pfade ohne abschließenden Schrägstrich; Kleinbuchstaben; Umlaute in Slugs werden transliteriert (`ä→ae`, `ö→oe`,
   `ü→ue`, `ß→ss`), alles andere außer `a–z0–9` wird zu `-`, mehrfache `-` zusammengefasst, Länge ≤ 60 Zeichen.
3. Kanonische Domain ist die Apex-Domain `https://planetclairetattoos.com` (Konfiguration `NEXT_PUBLIC_SITE_URL`).
4. Seiten mit geheimen Tokens, Warenkorb, Kasse und Formular-Ergebnisse sind `noindex` und nicht in der Sitemap.
5. Der Admin-Pfad ist **nicht** `/admin` (E-93) und steht weder in `robots.txt` noch in der Sitemap (§7.1).

### 2.2 Routentabelle (öffentlich)

| ID | Seite | DE | EN | Index | Phase |
|---|---|---|---|---|---|
| R01 | Startseite | `/de` | `/en` | ja | P2 |
| R02 | Shop (alle Stücke) | `/de/shop` | `/en/shop` | ja | P3 |
| R03 | Shop-Kategorie | `/de/shop/kategorie/[slug]` | `/en/shop/category/[slug]` | ja | P3 |
| R04 | Produktseite | `/de/shop/[nummer]-[slug]` | `/en/shop/[nummer]-[slug]` | ja (auch verkauft, wenn im Archiv sichtbar) | P3 |
| R05 | Archiv (verkaufte Stücke) | `/de/archiv` | `/en/archive` | ja | P3 |
| R06 | Warenkorb | `/de/warenkorb` | `/en/cart` | nein | P4 |
| R07 | Kasse | `/de/kasse` | `/en/checkout` | nein | P4 |
| R08 | Danke-Seite | `/de/danke/[token]` | `/en/thank-you/[token]` | nein | P4 |
| R09 | Bestellstatus | `/de/bestellung/[token]` | `/en/order/[token]` | nein | P4 |
| R10 | Auftragsarbeiten | `/de/auftragsarbeiten` | `/en/commissions` | ja | P7 |
| R11 | Tattoo – Übersicht | `/de/tattoo` | `/en/tattoo` | ja | P7 |
| R12 | Tattoo – Flash | `/de/tattoo/flash` | `/en/tattoo/flash` | ja | P7 |
| R14 | Tattoo – Preise | `/de/tattoo/preise` | `/en/tattoo/prices` | ja | P7 |
| R15 | Tattoo – Galerie (fresh & healed) | `/de/tattoo/galerie` | `/en/tattoo/gallery` | ja | P7 |
| R16 | Tattoo – Ablauf | `/de/tattoo/ablauf` | `/en/tattoo/process` | ja | P7 |
| R17 | Tattoo – Aftercare | `/de/tattoo/aftercare` | `/en/tattoo/aftercare` | ja | P7 |
| R18 | Tattoo – FAQ | `/de/tattoo/faq` | `/en/tattoo/faq` | ja | P7 |
| R19 | Über mich & Coco | `/de/ueber-mich` | `/en/about` | ja | P8 |
| R20 | Kontakt | `/de/kontakt` | `/en/contact` | ja | P6 (Gerüst P2) |
| R21 | Impressum | `/de/impressum` | `/en/legal-notice` | ja | P6 (Gerüst P2) |
| R22 | Datenschutz | `/de/datenschutz` | `/en/privacy` | ja | P6 (Gerüst P2) |
| R23 | AGB | `/de/agb` | `/en/terms` | ja | P6 (Gerüst P2) |
| R24 | Widerrufsbelehrung inkl. Muster-Widerrufsformular | `/de/widerrufsbelehrung` | `/en/right-of-withdrawal` | ja | P6 (Gerüst P2) |
| R25 | Versand & Zahlung | `/de/versand-und-zahlung` | `/en/shipping-and-payment` | ja | P4 (Gerüst P2) |
| R26 | Vertrag widerrufen (Widerrufsbutton) | `/de/vertrag-widerrufen` | `/en/withdraw-from-contract` | nein (`noindex, follow`) | P6 (Gerüst P2) |
| R27 | Konformitätserklärungen Keramik | `/de/konformitaetserklaerungen` | `/en/declarations-of-conformity` | ja | P6 (Gerüst P2) |
| R28 | 404 „Coco hat sich losgerissen“ | jede unbekannte Route | jede unbekannte Route | nein | P2 |
| R29 | Fehlerseite 500 | – | – | nein | P2 |
| R30 | Wurzel | `/` → Weiterleitung (§2.4) | – | – | P2 |
| R31 | Kurzlink Stück | `/nr/[nummer]` → Weiterleitung (§2.4) | – | – | P3 |

„Gerüst P2“ heißt: Die Route existiert ab P2 mit Überschrift, Fußbereich und einem als Platzhalter gekennzeichneten Text
(Seed), damit die Pflichtlinks im Fußbereich nie ins Leere führen. Den vollständigen Inhalt liefert die genannte Phase.

**Kategorien und Slugs (R03; Namen, Slugs und Felder laut DATENMODELL §4, §6.5):**

| Kategorie (Anzeige DE) | `key` (`products.category`) | DE-Slug | EN-Slug | Standard-Versandklasse | in der Navigation |
|---|---|---|---|---|---|
| Keramik | `keramik` | `keramik` | `ceramics` | `keramik` | ja |
| Textil | `textil` | `textil` | `textiles` | `paket_klein` | ja |
| Caps | `cap` | `caps` | `caps` | `paket_klein` | ja |
| Zeichnungen | `zeichnung` | `zeichnungen` | `drawings` | `brief` | ja |
| Schmuck | `schmuck` | `schmuck` | `jewellery` | `brief` | ja |
| Sonstiges | `sonstiges` | `sonstiges` | `other` | `paket_klein` | nein (`showInNavigation=false`) |

Es gibt genau diese **sechs festen Kategorien** (Grund-Seed, Collection `categories`); neue Kategorien werden nicht
angelegt und keine gelöscht. Jutta pflegt je Kategorie Name DE/EN, Slug DE/EN, Einleitungstext (`intro`), Bild,
Reihenfolge, Sichtbarkeit in der Navigation und SEO-Texte. Die Kategorie eines Stücks (`products.category`) bestimmt
Pflichtfelder, Vorbelegungen und Standard-Versandklasse (§7.4, DATENMODELL §6.6.3). Slugs werden im Code nie fest
verdrahtet, sondern aus `categories` gelesen.

### 2.3 Parameter und Slugs

**Produkt-URL (R04):** `/{locale}/shop/{nummer}-{slug}`.
- `{nummer}` = Objektnummer, auf mindestens 3 Stellen mit Nullen aufgefüllt (`017`).
- `{slug}` = aus dem Titel der jeweiligen Sprache (EN fehlt → DE-Slug).
- Auflösung **nur über die Nummer** (führende Ziffern des Segments). Passt der Rest nicht zur kanonischen Form
  (andere Auffüllung, alter Slug nach Titeländerung, Slug der anderen Sprache, gar kein Slug) → `308` auf die kanonische URL.
  Beispiel: `/de/shop/17` → `308` → `/de/shop/017-schale-mit-hund`.
- Stück im Status `draft` oder `archived` → 404. Stück `sold` mit `showInArchiveAfterSale=false` → 404-Seite in der Variante
  „Dieses Stück hat schon ein Zuhause“ (HTTP 404, `noindex`, Links zu Shop und Archiv).

**Listen-Parameter:** `?available=1` (R02/R03: nur nicht verkaufte Stücke; R12: nur verfügbare Flash-Motive),
`?category=<slug der Seiten-Sprache>` (nur R05), `?kind=fresh|healed` (nur R15), `?page=2` (Shop-Listen: 24 Stücke je
Seite, Knopf „Mehr zeigen“ ist ein echter Link). Parameternamen sind in beiden Sprachen gleich. Kanonische URL ohne
`available`, `category` und `kind`, mit `page` ab Seite 2. Unbekannte Parameter werden ignoriert.

**Token (R08, R09):** 32 zufällige Bytes, base64url (43 Zeichen), pro Bestellung bzw. Kasse einmalig; gespeichert wird nur
der SHA-256-Hash (DATENMODELL §6.8.2, §6.25.2); nie aus `PAYLOAD_SECRET` abgeleitet (ARCHITEKTUR §8.6). Unbekannter
Token → 404.

### 2.4 Weiterleitungen

| Von | Nach | Status | Regel |
|---|---|---|---|
| `http://…` | `https://…` | 308 | Hosting |
| `https://www.planetclairetattoos.com/<pfad>?<query>` | `https://planetclairetattoos.com/<pfad>?<query>` | 308 | Hosting-Domainkonfiguration; zusätzlich der Next-16-Proxy (`src/proxy.ts`, ARCHITEKTUR §2.1) als Rückfallebene |
| `/` | `/de` oder `/en` | 307 + `Vary: Accept-Language` | Sprach-Erkennung über `Accept-Language` (q-Werte beachten): erste passende Sprache aus `de`, `en`; keine passende oder kein Header → `/de`. **Kein Cookie.** |
| die sieben rechtlichen Kurz-URLs `/impressum`, `/datenschutz`, `/agb`, `/widerrufsbelehrung`, `/versand`, `/vertrag-widerrufen`, `/widerruf` (Liste RECHT `ANFORDERUNGEN.md` §2, R-010) | kanonische DE-Route aus §2.2, z. B. `/de/impressum`, `/de/versand-und-zahlung`, `/de/vertrag-widerrufen` | 308 | feste Zuordnung ohne Sprach-Erkennung, kein Cookie; für Instagram-Bio und Aushänge. Rechtstexte und Mails nennen immer die kanonische URL, nie die Kurz-URL |
| sonstiger Pfad ohne Sprachpräfix, z. B. `/shop/017`, `/tattoo/flash` | Entsprechung in erkannter Sprache, z. B. `/de/shop/017-…` bzw. `/en/tattoo/flash` | 307 | Pfad wird gegen die DE- und EN-Routentabelle geprüft und in die erkannte Sprache übersetzt; kein Treffer → 404 in erkannter Sprache. Ausgenommen: `/api`, Admin-Pfad, `/_next`, statische Dateien, `/nr`, Kurz-URLs (Zeile davor), `/sitemap.xml`, `/robots.txt`. |
| DE-Slug unter `/en/…`, z. B. `/en/impressum`, `/en/vertrag-widerrufen`, sowie feste EN-Aliasse der Routen-Registry, z. B. `/en/imprint` | EN-Route aus §2.2, z. B. `/en/legal-notice`, `/en/withdraw-from-contract` | 308 | – |
| `/nr/[nummer]` | kanonische Produktseite in erkannter Sprache | 307 | Nummer unbekannt oder Stück nicht öffentlich → 404 |
| Pfad mit abschließendem `/` | ohne `/` | 308 | – |
| Nicht-kanonische Produkt-URL | kanonische Produkt-URL | 308 | §2.3 |
| Kategorie-Slug der anderen Sprache (`/en/shop/category/keramik`) | richtiger Slug (`/en/shop/category/ceramics`) | 308 | – |
| `/admin` und `/admin/*` | – | 404 | **Keine** Weiterleitung auf den echten Admin-Pfad |

### 2.5 hreflang, canonical, robots, Sitemap

- Jede indexierbare Seite hat `<link rel="canonical">` (absolute URL, Apex-Domain, eigene Sprache) und
  `<link rel="alternate" hreflang="de|en|x-default">`; `x-default` zeigt auf die DE-URL.
- Token-Seiten, Warenkorb, Kasse, Vertrag-widerrufen, 404, 500: `<meta name="robots" content="noindex">`, kein hreflang.
- `/robots.txt` (Produktion): `Allow: /`, `Disallow: /api/`, `/de/warenkorb`, `/en/cart`, `/de/kasse`, `/en/checkout`,
  `/de/danke/`, `/en/thank-you/`, `/de/bestellung/`, `/en/order/`; Verweis auf `/sitemap.xml`. Der Admin-Pfad steht
  **nicht** darin (Admin-Antworten tragen stattdessen `X-Robots-Tag: noindex, nofollow`).
- `/robots.txt` außerhalb von Produktion: `Disallow: /`; zusätzlich Header `X-Robots-Tag: noindex` auf allen Antworten.
- `/sitemap.xml`: alle indexierbaren Routen beider Sprachen inkl. `xhtml:link`-Alternates; Produkte in `available`,
  `reserved` und `sold` mit `showInArchiveAfterSale=true`; Kategorien; `lastmod` aus `updatedAt`. Seed-Dokumente nur
  außerhalb von Produktion.

### 2.6 Sprachwechsel

- Umschalter DE/EN im Menü und im Fuß. Er verlinkt **direkt** auf die Entsprechung der aktuellen Seite (Routentabelle,
  Produkt mit Slug der Zielsprache). Query-Parameter `available` und `page` bleiben erhalten.
- Auf Token-Seiten wechselt der Umschalter zur Token-Route der anderen Sprache mit demselben Token.
- Die gewählte Sprache wird **nicht** gespeichert (kein Cookie, E-43); sie ergibt sich nur aus der URL.

### 2.7 Fachlich relevante technische Endpunkte

Namen sind Vorschläge; verbindlich ist ARCHITEKTUR (§2.5).

| Endpunkt | Zweck | Zugriff |
|---|---|---|
| `POST /api/stripe/webhook` | Stripe-Events (§4.10) | Signaturprüfung |
| `GET /api/cron/tick` | Job-Wecker, jede Minute durch Vercel Cron; führt nur fällige Tasks aus (§8.1) | `Authorization: Bearer <CRON_SECRET>` |
| `POST /api/cron/run/[task]` | einen Task sofort ausführen (Tests, Admin „Jetzt ausführen“) | `CRON_SECRET` oder Admin-Sitzung |
| `GET /api/cron/backup` | nächtliches Backup in der App (§8.2) | `Authorization: Bearer <CRON_SECRET>` |
| `GET /api/legal/[type].pdf?locale=de` und `/api/legal/[type]/[versionId].pdf` | aktuelle bzw. historische Rechtstext-PDFs (`type` laut DATENMODELL `LEGAL_TEXT_TYPES`) | öffentlich |
| `GET /api/orders/[token]/documents/[file]` | Rechtstext-PDFs der Bestellung in ihrer Fassung (AGB, Widerrufsbelehrung inkl. Formular); **keine** Rechnungen/Gutschriften (R-067, §4.12) | Token |
| `GET /api/public/product-status?ids=…` | Live-Zustand von Stücken (Kaufknopf, Korb), höchstens 24 IDs | öffentlich, Rate-Limit |
| `GET /api/checkout/[token]/state` | Zustand der Kasse bzw. Bestellung für die wartende Danke-Seite (§4.12), `no-store` | Token, Rate-Limit `token_pages` |
| `POST /api/uploads/commission` | einzelnes Referenzbild des Anfrageformulars (§10.2) | Formular-Token, Rate-Limit |
| `POST /api/client-errors` | minimale Browser-Fehlermeldungen; **standardmäßig aus**, bis Kanzleifrage K-30 (c) beantwortet ist; wenn an, nur first-party, ohne Cookies, IP-Speicher und Personendaten (R-133, R-137) | öffentlich, Rate-Limit |
| `GET /api/health` | Erreichbarkeit | öffentlich, ohne Daten |
| Payload-REST unter `/api/<collection>` | CMS | deny-by-default; öffentlich lesbar nur freigegebene Inhalte; GraphQL deaktiviert |

**AK-2-01** Für jede Zeile in §2.2 existiert die Route in DE und EN (automatischer Paritätstest gegen eine Routen-Registry).
**AK-2-02** `GET /` mit `Accept-Language: en-US,en;q=0.9` → 307 auf `/en`; ohne Header → 307 auf `/de`; die Antwort setzt kein Cookie.
**AK-2-03** `GET /de/shop/17` → 308 auf `/de/shop/017-<slug>`; `GET /en/shop/017-<de-slug>` → 308 auf den EN-Slug.
**AK-2-04** `GET /admin` → 404; der konfigurierte Admin-Pfad erscheint weder in `robots.txt` noch in `sitemap.xml` noch im HTML öffentlicher Seiten.
**AK-2-05** Jede indexierbare Seite hat canonical und drei hreflang-Links mit absoluten Apex-URLs.
**AK-2-06** `/nr/17` mit `Accept-Language: de` → 307 auf die kanonische DE-Produktseite; unbekannte Nummer → 404.
**AK-2-07** `GET /widerruf` und `GET /vertrag-widerrufen` → 308 auf `/de/vertrag-widerrufen` (auch mit `Accept-Language: en`); jede Kurz-URL aus §2.4 liefert 308 auf ihre DE-Route und setzt kein Cookie.

---

## 3. Seiten-Spezifikationen

Aufbau jeder Seitenbeschreibung: **Zweck · Blöcke (in Reihenfolge) · Datenquelle · Zustände · Recht · SEO/OG ·
Tuschelinie/Coco · AK.** Das Verhalten der Tuschelinie ist hier nur benannt; Form, Timing und Posen legt
`docs/design/DESIGN.md` fest (E-72: je Seitentyp). Collection-, Global-, Feld- und Enum-Namen folgen DATENMODELL; redaktionelle
Seiten kommen aus `pages` (Feld `key` aus `PAGE_KEYS`), Stammdaten und Betriebswerte aus dem Global `settings`.

### 3.0 Globale Bausteine (auf jeder öffentlichen Seite)

**3.0.1 Kopfleiste** [P2] – schmal, immer sichtbar (Konzeptseite „Menü“):
1. Wortmarke „planet claire“ (handgeschrieben, echter Text als zugänglicher Name) → Startseite der aktuellen Sprache.
2. Links **Shop** und **Tattoo** (EN: Shop, Tattoo).
3. **Korb** mit Anzahl (EN: Basket). Anzahl wird clientseitig aus dem Warenkorb-Cookie gelesen (§4.2); ohne Cookie
   „Korb“ ohne Zahl. Platz ist reserviert, damit nichts springt (CLS).
4. Knopf **Menü** (EN: Menu), `aria-expanded`, `aria-controls`.

**3.0.2 Menü** [P2] – „Papierseite“ mit handgeschriebenen Links, die Linie unterstreicht den Link unter Zeiger/Finger:
Start · Shop · Archiv · Auftragsarbeiten · Tattoo · Über mich & Coco · Kontakt · Sprache DE/EN.
Fokus wird im Menü gehalten, `Esc` schließt, Fokus kehrt zum Menü-Knopf zurück. Ohne JavaScript ist das Menü als
Link-Liste im Fuß erreichbar.

**3.0.3 Fußbereich** [P2, Inhalte P6] – auf **jeder** Seite inklusive Kasse, Danke, Bestellstatus, 404, 500:
- Pflichtlinks: Impressum · Datenschutz · AGB · Widerrufsbelehrung · Versand & Zahlung · Kontakt ·
  Konformitätserklärungen (nur wenn mindestens eine aktive Konformitätserklärung existiert; R27 selbst bleibt erreichbar).
- **Hervorgehobener Link/Knopf „Vertrag widerrufen“** (EN „Withdraw from contract here“, R-090) → R26 (E-44).
- Instagram-Link `https://www.instagram.com/planet.claire.tattoos/` (einfacher Link, kein Embed).
- Sprachumschalter.
- Hinweis-Kurzzeile zum Preis nur, wenn auf der Seite Preise stehen (steht dann ohnehin am Preis).
- Keine Animation darf diese Links verdecken oder verzögern (Konzeptseite „Pflicht und Service“).

**3.0.4 Weitere globale Elemente**
- Skip-Link „Zum Inhalt springen“ als erstes fokussierbares Element.
- Banner „Vorschau mit Beispieldaten“ (DE) / „Preview with sample data“ (EN), wenn `SEED_PREVIEW_MODE` wirksam ist
  (§11.4). Im Vorschau-Export ersetzt durch das Export-Banner (§12.5).
- `<html lang="de|en">`; `theme-color` gemäß DESIGN.

**3.0.5 SEO-Grundregeln**
- `<title>`: `{Seitentitel} · Planet Claire`; Startseite: `Planet Claire – {Claim}`.
- `meta description`: aus CMS-Feld der Seite, sonst Vorlage je Seitentyp, 120–160 Zeichen.
- Open Graph: `og:title`, `og:description`, `og:url`, `og:type` (`website`, Produkt `product`), `og:locale`
  (`de_DE` / `en_GB`, Alternate der anderen Sprache), `og:image` 1200×630 (Produkt: erstes Foto mit Fokuspunkt
  zugeschnitten; sonst Standardbild mit Wortmarke und Coco-Zeichnung).
- JSON-LD: Startseite `Organization` (Name „Planet Claire“, `sameAs` Instagram, **ohne** Adresse); Produkt `Product`
  mit `Offer`; Listen `BreadcrumbList`.

**3.0.6 Zustände – gemeinsame Regeln**
- **leer:** jede Liste hat einen gestalteten Leerzustand mit Coco und einem Weiter-Link (nie eine leere Fläche).
- **lädt:** Seiten werden serverseitig gerendert; Ladezustände gibt es nur für clientseitig nachgeladene Teile
  (Korb-Anzahl, Danke-Seite beim Warten auf die Zahlung, Admin-Aktionen). Platzhalter haben feste Maße.
- **Fehler:** Fehlerseite R29 „Hoppla – die Leine hat sich verheddert“ mit „Nochmal versuchen“ und Link zur Startseite.
  Formularfehler stehen als Text am Feld und in einer Zusammenfassung oben (verlinkt), nie nur farbig.
- **reserviert / verkauft:** Stücke zeigen überall denselben Zustand: `reserved` → Hinweis „Gerade reserviert – schau in
  30 Minuten nochmal“; `sold` → „sold“-Stempel (E-77).

### 3.1 Startseite (R01) [P2, Inhalte P8]

- **Zweck:** Die „Reise entlang der Linie“ (Konzeptseite): in 1 Minute verstehen, wer Jutta ist, was es gibt, und in
  Shop oder Tattoo abbiegen.
- **Blöcke:**
  1. **Planet Claire** (oberste Station): H1 als echter Text in Handschrift-Schrift (DE-Vorschlag „Tattoos & handgemachte
     Unikate aus Berlin“, pflegbar), 1–2 Sätze Intro, Knöpfe „Zum Shop“ und „Tattoo“. Die Linie kreist einmal um einen
     kleinen Planeten.
  2. **Hallo:** 1–3 Sätze von Jutta, Coco steht da.
  3. **Keramik**, 4. **Textil** (Kategorien `textil` und `cap`), 5. **Zeichnungen**, 6. **Schmuck** – je Station:
     Stationszeichnung, Überschrift, 1–2 Sätze, bis zu 4 Stücke der Kategorie (Status `available` oder `reserved`, neueste
     zuerst, als Preisschild-Karten; die Karten kommen in P3, P2 zeigt die Stationen ohne Karten), Link „Alle {Kategorie}“
     → R03. `sonstiges` hat keine eigene Station.
  7. **Tattoo:** 1–2 Sätze, bis zu 3 verfügbare Flash-Motive, Link „Zum Tattoo-Bereich“ → R11.
  8. **Jutta & Coco:** Teaser-Text, Link „Mehr über uns“ → R19, Zeile „Eigene Idee? → Auftragsarbeiten“ → R10,
     Instagram-Link.
- **Datenquelle:** `pages` mit `key = home` (Blöcke `hero` und `station`, Texte DE/EN), `settings.business`
  (Name/Geschäftsbezeichnung), Collections `products`, `categories`, `flash`.
- **Zustände:** Kategorie ohne sichtbare Stücke → Station zeigt Zeichnung, Text „Gerade ist hier nichts – schau bald
  wieder oder stöbere im Archiv“ und Link auf das Archiv. Kein Flash → Tattoo-Station ohne Motivreihe.
- **Recht:** Preise auf Karten mit Sternchen, Fußnote gemäß §3.4 (Steuer-/Versandhinweis) einmal pro Seite.
- **SEO/OG:** Titel „Planet Claire – Tattoos & Unikate aus Berlin“; `Organization`-JSON-LD.
- **Tuschelinie/Coco:** „die große Reise“: Linie zeichnet sich mit dem Scrollen, Coco rennt an der Spitze, wechselt an
  Stationen die Pose (rennen, schnüffeln, sitzen); die Linie macht an jeder Station eine Schlaufe um das Foto.
  Reduced Motion: Linie fertig gezeichnet, Coco still.
- **AK-3-01** Die Startseite zeigt die Kopf-Station „Planet Claire“ und danach genau 7 Stationen in dieser Reihenfolge: Hallo, Keramik, Textil, Zeichnungen, Schmuck, Tattoo, Jutta & Coco.
- **AK-3-02** Pro Kategorie-Station höchstens 4 Stücke, nie `sold`, `draft` oder `archived`.

### 3.2 Shop (R02) [P3]

- **Zweck:** Alle Stücke stöbern, filtern, Verfügbarkeit auf einen Blick.
- **Blöcke:**
  1. H1 „Shop“, 1 Satz Einleitung (pflegbar).
  2. Filter-Chips (Links): „Alle“ + je Kategorie → R03; Schalter „nur verfügbare“ (`?available=1`).
  3. Raster: Karte je Stück = Foto (4:5), Titel, Preisschild (Preis, `Nr. 017`), Zustand. Sortierung: zuerst `available`
     und `reserved` nach `firstPublishedAt` absteigend, danach `sold` mit `showInArchiveAfterSale=true` nach `soldAt`
     absteigend. Mit `?available=1` entfallen `sold`.
  4. „Mehr zeigen“ (Link `?page=n+1`), 24 Stücke je Seite.
  5. Hinweiszeile: Steuer-/Versandhinweis (Fußnote), „Lieferung innerhalb Deutschlands · Abholung in Berlin möglich“.
- **Datenquelle:** `products` (öffentlich: `available`, `reserved`, `sold` mit `showInArchiveAfterSale=true`),
  `categories`, `pages` mit `key = shop` (Einleitung), `settings.shipping` (Lieferzeit, Liefergebiet).
- **Zustände:** leer (keine Stücke) → Coco + „Gerade ist alles weg – neue Stücke kommen auf Instagram zuerst“ + Archiv-Link.
  Karte `reserved` → Hinweis „gerade reserviert“; Karte `sold` → Stempel „sold“, gedämpft. Shop pausiert
  (`settings.shop.isOpen = false`, §4.2) → Hinweis mit `settings.shop.closedMessage` über dem Raster; die Stücke bleiben
  sichtbar, kaufen lässt sich nichts.
- **Recht:** Preisangaben als Endpreis mit Fußnote (§3.4). Keine Streichpreise (§13).
- **SEO/OG:** Titel „Shop · Planet Claire“; `BreadcrumbList`.
- **Tuschelinie:** wird zur **Schnur**, an der die Flohmarkt-Preisschilder hängen (E-77); ruhig, keine Scroll-Choreografie.
- **AK-3-03** Mit `?available=1` erscheint kein Stück mit Status `sold`.
- **AK-3-04** Ein Stück mit `status=sold` und `showInArchiveAfterSale=false` erscheint auf keiner Liste.

### 3.3 Shop-Kategorie (R03) [P3]

Wie R02, gefiltert auf eine Kategorie. Zusätzlich H1 = Kategoriename, Einleitungstext der Kategorie (DE/EN). Aktiver
Filter-Chip mit `aria-current="page"`. Unbekannter Slug → 404. SEO-Titel `{Kategorie} · Shop · Planet Claire`.

### 3.4 Produktseite (R04) [P3]

- **Zweck:** Ein Unikat vollständig und rechtssicher zeigen und in den Korb legen. Häufigster Einstieg aus Instagram.
- **Blöcke (Reihenfolge ist verbindlich, weil Pflichtangaben vor dem Knopf stehen müssen):**
  1. **Galerie:** 1–12 Fotos, wischbar (Scroll-Snap), Zoom per Tipp (Vollbild-Dialog, schließbar mit `Esc`/X), Punkte-Anzeige.
  2. **Titel** (H1).
  3. **Kurzdaten:** `Nr. 017` · „Unikat“ · Kategorie · Maße (z. B. „Ø 14 cm, H 6 cm“).
  4. **Preisschild:** Preis mit Sternchen; darunter Pflichtzeile Steuerhinweis und Versand:
     - Kleinunternehmerin (E-02): „*Endpreis. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet. zzgl. [Versand](R25)“
     - Regelbesteuerung (Schalter, §4.14): „*inkl. {19|7} % MwSt., zzgl. [Versand](R25)“
     - Lieferzeit: „Lieferzeit 2–5 Werktage“ (`settings.shipping.deliveryTimeText`, E-31, R-035) bzw. bei Versandklasse
       `nur_abholung` „Nur Abholung in Berlin nach Absprache“; in der Nähe des Knopfs der Satz zum Liefergebiet (R-036).
  5. **Pflichtangaben je Kategorie (vor dem Knopf; Wortlaut der Rechtsbausteine `product.*` laut RECHT §6):**
     - `keramik`: Badge je `foodContact`: `deko` → „Deko – nicht für Lebensmittel“ (Standard, E-15) **oder**
       `lebensmittelecht` → „Lebensmittelecht – Konformitätserklärung ansehen“ (Link R27).
     - `textil`, `cap`: Faserzusammensetzung (`fiberComposition`) in Prozent mit amtlichen Bezeichnungen (z. B.
       „100 % Baumwolle“), bei `labelMissing` zusätzlich „Etikett fehlt – Material nach bestem Wissen: {`fiberFreeText`}“
       (E-16, R-043); Größe (`sizeLabel`); Zustand (`condition`, ggf. `conditionNote`); Kennzeichnung „Second-Hand/Vintage“
       (`isSecondHand`).
     - `schmuck`: Material der Metallteile (`metalPartsMaterial`, z. B. „Öse: Edelstahl, nickelfrei“) und Warnhinweis
       „Kein Spielzeug – enthält verschluckbare Kleinteile. Nicht für Kinder unter 3 Jahren.“ (E-17, `smallPartsWarning`).
     - `zeichnung`: Technik und Papier stehen in `materials` (z. B. „Aquarell auf Papier 300 g“), Maße; bei `framed` und
       `frameHasGlass` automatisch der Warnhinweis zum Glasrahmen (R-046).
     - Abweichende Beschaffenheit (falls `hasDeviation` gesetzt, z. B. Fleck, Riss, Glasurfehler): hervorgehobener
       Kasten „Besonderheit dieses Stücks: {`deviationDescription`}“ (Wortlaut laut RECHT R-048 Nr. 1) (wird in der Kasse gesondert bestätigt, §4.4).
  6. **Kaufknopf je Zustand:**
     - Shop pausiert (`settings.shop.isOpen = false`, §4.2) und Stück nicht `sold` → Knopf „In den Korb“ deaktiviert,
       darüber der Text aus `settings.shop.closedMessage`.
     - `available`, nicht im eigenen Korb → **„In den Korb“** (EN „Add to basket“).
     - bereits im eigenen Korb → „Liegt schon in deinem Korb“ + Link zum Korb.
     - `reserved` durch fremde Kasse → Knopf deaktiviert, Text „Gerade reserviert – schau in 30 Minuten nochmal“.
     - `reserved` durch die eigene Kasse → „Du hast es gerade in der Kasse“ + Link „Zur Kasse“.
     - `sold` → „sold“-Stempel, Text „Schon verkauft“, Links „Ähnliche Stücke“ (Kategorie) und Archiv.
  7. **Beschreibung** (Rich Text DE/EN, EN fehlt → DE).
  8. **Details-Tabelle** (DESIGN KO-09b): Maße, Gewicht (`weightGrams`, ohne Verpackung), Material, Technik, Größe,
     Zustand, Pflegehinweise (je nach Produktart; leere Zeilen entfallen). Das Gewicht steht dort, weil die freigegebene
     Konzeptseite „Maße, Gewicht, Material“ auf der Produktseite zusagt. **Gewichtsformat** (`formatWeight(grams, locale)`
     in `src/lib/shop/format.ts`, DESIGN DA-9): unter 1000 g in Gramm („210 g“), ab 1000 g in Kilogramm mit einer
     Nachkommastelle („2,4 kg“, EN „2.4 kg“; „,0“ entfällt, also „1 kg“).
  9. **Herstellerin & Sicherheit** (GPSR, R-040): **immer sichtbar, nicht eingeklappt** [Annahme KA-02]: Name
     (`settings.business.legalName`, ggf. `tradeName`), Postanschrift (Privatadresse, E-40), E-Mail; Produktkennung
     `Nr. 017`; Kategorie; Warn- und Sicherheitshinweise des Stücks (`safetyWarnings`, immer auf Deutsch, auf `/en/…`
     zusätzlich englisch). Gilt für **alle** Kategorien, auch Zeichnungen.
  10. **Versand & Rückgabe kurz:** Versandklasse und Preis (z. B. „Versand als Keramik-Paket 8,90 €“), Abholung möglich
      (außer Stück hat Versandklasse `nur_abholung`), neutraler Hinweis ohne Werbung mit Selbstverständlichkeiten (V-19):
      „Infos zu deinem Widerrufsrecht findest du in der [Widerrufsbelehrung](R24).“ plus Baustein
      `withdrawal.returnCostsNote` (E-27, Wortlaut nur in ANFORDERUNGEN §6) mit Link [Versand & Zahlung](R25); dazu die
      harmonisierte Mitteilung zur Gewährleistung (R-049).
  11. **Mehr aus {Kategorie}:** bis zu 4 andere sichtbare Stücke (nicht `sold`).
- **Datenquelle:** `products` (+ `media`, `categories`, `conformity-declarations`), `settings.business` (Herstellerin),
  `settings.shipping` (Lieferzeit, Tarife je Versandklasse), `settings.tax` (Steuermodus).
- **Zustände:** siehe Punkt 6; Stück existiert nicht / Entwurf / ausgeblendet → 404; verkauft und ausgeblendet → 404-Variante (§2.3).
- **Recht:** Preisangabe (PAngV), Textilkennzeichnung vor dem Kaufknopf, GPSR-Block, Keramik-Badge, Schmuck-Warnung,
  Widerrufshinweis; nie „inkl. MwSt.“ im Kleinunternehmer-Modus; nie „Handmade = kein Widerruf“.
- **SEO/OG:** Titel `{Titel} – Nr. 017 · Planet Claire`; Beschreibung = erste 155 Zeichen der Beschreibung;
  `og:type=product`, `og:image` = erstes Foto 1200×630; JSON-LD `Product` (`name`, `image`, `description`, `sku`=`017`,
  `brand`=„Planet Claire“, `itemCondition` = `UsedCondition` bei `isSecondHand` sonst `NewCondition`, `offers`
  mit `price`, `priceCurrency=EUR`, `availability` `InStock` | `SoldOut` (reserviert = `InStock`)).
- **Tuschelinie:** unterstreicht den Titel und führt zum Knopf „In den Korb“; sonst Ruhe (Konzeptseite).
  **Coco** hüpft kurz bei „In den Korb“ (Mikromoment, P9).
- **AK-3-05** Bei `category` ∈ {`textil`, `cap`} stehen Faserzusammensetzung und Größe im DOM **vor** dem Knopf „In den Korb“.
- **AK-3-06** Der Block „Herstellerin & Sicherheit“ ist ohne Interaktion sichtbar (nicht in geschlossenem `<details>`).
- **AK-3-07** Im Kleinunternehmer-Modus enthält keine öffentliche Seite die Zeichenfolge „inkl. MwSt“.
- **AK-3-08** „In den Korb“ auf einem inzwischen reservierten/verkauften Stück (veraltete Seite) wird serverseitig
  abgelehnt und zeigt den aktuellen Zustand.

### 3.5 Archiv (R05) [P3]

- **Zweck:** Vergangene Stücke als Portfolio mit „sold“-Stempel (E-14).
- **Blöcke:** H1 „Archiv“ (EN „Archive“), 1 Satz („Schon ausgezogen – aber schön anzusehen“), Kategorie-Chips
  (`?category=<slug>` [Annahme KA-26: Query statt eigener Route]), Raster aller `sold` mit `showInArchiveAfterSale=true`,
  nach `soldAt` absteigend, 24 je Seite. Karte zeigt Preis und Stempel. Datenquelle: `products`, `categories`, `pages` mit
  `key = archive`.
- **Zustände:** leer → „Noch ist nichts verkauft“ + Shop-Link.
- **Tuschelinie:** wie Shop (Schnur), Stempel ohne „Knall“-Animation beim Laden (die gibt es nur im Moment des Verkaufs, P9).
- **AK-3-09** Das Archiv zeigt ausschließlich `sold` mit `showInArchiveAfterSale=true`.

### 3.6 Warenkorb (R06) [P4]

Details in §4.2–4.3. Blöcke: H1 „Dein Korb“; Positionen (Foto, Titel, Nr., Preis, „Entfernen“, Status-Warnung);
Lieferart-Wahl (Versand innerhalb Deutschlands / Abholung in Berlin); Versandkosten (automatisch); Summe; Steuerhinweis;
Lieferzeit; Hinweis Liefergebiet („Wir liefern nur innerhalb Deutschlands. Abholung in Berlin nach Absprache.“);
**akzeptierte Zahlarten** (Karte, Apple Pay, Google Pay, PayPal, Vorkasse – § 312j Abs. 1 BGB; Baustein
`cart.paymentAndDeliveryInfo`, R-036); harmonisierte Mitteilung zur Gewährleistung (R-049); Knopf **„Zur Kasse“**.
Shop pausiert (`settings.shop.isOpen = false`, §4.2) → `settings.shop.closedMessage` über den Positionen, „Zur Kasse“
gesperrt. Leer → Coco mit leerem Korb + „Zum Shop“. Tuschelinie still, Coco sitzt neben dem Korb (E-78).
`noindex`. Kein Stripe.js auf dieser Seite.

### 3.7 Kasse (R07) [P4]

Details in §4.4–4.9. Ein-Seiten-Kasse mit Abschnitten 1 Kontakt · 2 Lieferung · 3 Rechnungsadresse · 4 Zahlart ·
5 Übersicht, darunter Hinweistext und Knopf **„Zahlungspflichtig bestellen“**, Reservierungs-Countdown mit Coco.
Ohne gültige Kasse (Kassen-Token im Cookie `pc_checkout`, §4.2) → 307 auf den Warenkorb. Tuschelinie: nur eine stille, feine Linie ohne Animation.
Fußbereich mit Pflichtlinks bleibt sichtbar. `noindex`. Stripe.js wird **nur hier** geladen.

### 3.8 Danke-Seite (R08) [P4]

Details §4.12. Blöcke: H1 „Danke!“, Bestellnummer, Zusammenfassung, nächste Schritte (je Zahlart/Lieferart), bei
Vorkasse Bankdaten + Frist + EPC-QR-Code, Hinweis auf Bestätigungsmail, Link zum Bestellstatus, Link „Vertrag
widerrufen“. Zustände: wartet auf Zahlungsbestätigung / bezahlt / Vorkasse offen / Zahlung fehlgeschlagen / leider schon
weg (bezahlt, aber alle Stücke inzwischen verkauft, O19). Coco rollt
sich ein und schläft, die Linie endet in einem kleinen Herz. `noindex`, `Referrer-Policy: no-referrer`.

### 3.9 Bestellstatus (R09) [P4]

Details §4.12. Statusverlauf, Sendungsverfolgung, Dokumente (AGB und Widerrufsbelehrung inkl. Formular in der Version
zum Bestellzeitpunkt; Rechnung und Gutschriften **nicht** hier, sondern nur als Mail-Anhang, R-067), Knopf „Vertrag
widerrufen“ (vorbelegt mit Bestellnummer), Kontakt. Personenbezogene Daten gekürzt. `noindex`,
`Referrer-Policy: no-referrer`. Tuschelinie still.

### 3.10 Auftragsarbeiten (R10) [P7]

- **Zweck:** Zeigen, was auf Anfrage geht, und Anfragen einsammeln (E-11). Nicht kaufbar.
- **Blöcke:** H1 „Auftragsarbeiten“ (EN „Commissions“); Text „So läuft’s“ (Anfrage → Angebot per Mail → Bezahlung
  außerhalb des Shops → Anfertigung); Beispiele (3–9 Bilder mit Bildunterschrift); Formular (§10); Datenschutzhinweis;
  Kontaktalternative (Mail).
- **Datenquelle:** `pages` mit `key = commissions` (Texte, Beispielbilder, Block `commissionForm`), Collection
  `inquiries` (schreiben nur über die Server-Action des Formulars, §10).
- **Zustände:** Formular leer / Fehler / gesendet (Bestätigung mit Referenz `AA-2026-0007`) / zu viele Anfragen (429).
- **Recht:** Hinweis: Auftragsarbeiten werden individuell vereinbart, Bezahlung nicht im Shop; kein Online-Vertrag.
- **Tuschelinie:** ruhig; Linie führt als Rahmen um das Formular (DESIGN).

### 3.11 Tattoo-Seiten (R11–R18) [P7]

Inhalt und Regeln in §9. Gemeinsam für alle Tattoo-Seiten:
- Unter-Navigation (Links): Übersicht · Flash · Preise · Galerie · Ablauf · Aftercare · FAQ.
- **Kontakt-Block** am Ende jeder Tattoo-Seite: „Mail schreiben“ (mailto; Anfrageweg nur E-Mail, P12.7/U-15), E-Mail-Adresse als Text
  mit Knopf „Adresse kopieren“ (E-51).
- **Nirgends** „In den Korb“, Preisschild-Kaufoptik oder Warenkorb-Aktion (Test).
- Ort: nur „Privatstudio in Berlin-{Bezirk}“ (E-50), nie Straße.
- **Tuschelinie:** wirkt wie die Kontur eines Stencils um die Flash-Motive, bleibt tuscheschwarz (E-73).
- SEO: `{Seitentitel} · Tattoo · Planet Claire`.

### 3.12 Über mich & Coco (R19) [P8]

- **Blöcke:** H1 „Jutta & Coco“; Text über Jutta (Stil, Werkstatt, Flohmarkt, Planet-Claire-Name); Fotos von Jutta
  (`media.showsPerson = jutta`) **nur** mit Admin-Häkchen `media.ownerApproved = true` (R-181), sonst Zeichnungen. Bilder
  mit Jutta aus dem Instagram-Material (z. B. `profil.jpg`) werden nie importiert und ohne ihre Freigabe auch nicht als
  Zeichenvorlage genutzt (DESIGN §12.4, SEED-SPEC); Abschnitt Coco (Text, Zeichnung, Fotos von Coco); „Was ich mache“
  (Links Shop, Tattoo, Auftragsarbeiten); Instagram-Link.
- **Datenquelle:** `pages` mit `key = about`, `media`.
- **Tuschelinie:** Coco läuft ein kurzes Stück mit (mittlere Bewegung, DESIGN).

### 3.13 Kontakt (R20) [P6]

- **Blöcke:** H1 „Kontakt“; E-Mail `jutta@planetclairetattoos.com` (mailto + „Adresse kopieren“); (Instagram-Profil nur im Fuß, P12.7); „Privatstudio in Berlin-{Bezirk}“; Hinweise: „Frage zu einer
  Bestellung? Nenn bitte deine Bestellnummer.“, „Du willst widerrufen? → Vertrag widerrufen“, „Tattoo-Anfragen bitte per
  Mail“, „Auftragsarbeit? → Formular“; Link Impressum.
- **Kein** Kontaktformular (E-51 sinngemäß; kein Bedarf, R-162).
- **Datenquelle:** `pages` mit `key = contact` (Block `contactLinks`), `settings.business.email`, `settings.social.*`,
  `settings.tattoo.studioDistrict`.

### 3.14 Rechtsseiten (R21–R24, R27) [P6, Gerüst P2]

Gemeinsam: Inhalt aus Collection `legal-texts` (jede Fassung ein eigenes Dokument, E-41, DATENMODELL §6.12), und zwar die
aktive Fassung (`status = active`, `validFrom ≤ jetzt`; entspricht „published“ in RECHT R-012) des Typs der Seite:
R21 `impressum`, R22 `datenschutz`, R23 `agb`, R24 `widerrufsbelehrung` und `widerrufsformular`, R25 `versand-zahlung`.
Anzeige „Stand: {`validFrom`}“; PDF-Download der aktiven Fassung (außer Impressum). Englische Seiten zeigen die
EN-Fassung mit dem Baustein `translation.disclaimer`; fehlt sie, den deutschen Text mit dem englischen Hinweis „Only
available in German“ (R-015). Platzhalter-Tokens `{{…}}` im Text werden aus den Einstellungen ersetzt (§7.13).
Bis die Kanzleitexte vorliegen, sind die aktiven Fassungen Platzhalter des Grund-Seeds (`seed = false`,
`origin = placeholder`, `isPlaceholder = true`); jede Fassung mit `origin ≠ lawyer` zeigt oben gut sichtbar
„PLATZHALTER – nicht rechtsverbindlich“ (R-002). Die Startklar-Prüfung blockiert den Go-live, solange ein aktiver Text
kein Kanzleitext ist (§7.16). Tuschelinie: ruhige Randlinie, keine Animation.

| Seite | Besonderheiten |
|---|---|
| Impressum (R21) | Name, ladungsfähige Anschrift (Privatadresse, E-40; ob eine andere ladungsfähige Geschäftsadresse genügt, ist Kanzleifrage K-39), E-Mail, zweiter schneller Kontaktweg (Telefon, KA-03), ggf. W-IdNr./USt-IdNr.; **nie** die Steuernummer (E-46); Satz „Dieses Impressum gilt auch für instagram.com/planet.claire.tattoos“. **Kein** Link/Text zur EU-OS-Plattform. |
| Datenschutz (R22) | Kanzleitext. Grundlage für die Kanzlei: Dienste-Verzeichnis in `docs/recht/`. |
| AGB (R23) | Kanzleitext; PDF-Download. |
| Widerrufsbelehrung (R24) | Kanzleitext inkl. Satz zur Online-Widerrufsfunktion mit der URL von R26 (DE: `https://planetclairetattoos.com/de/vertrag-widerrufen`; Pflicht seit 19.06.2026); Muster-Widerrufsformular als Text **und** PDF-Download; Hinweis Rücksendekosten trägt die Kund:in (E-27); Link „Vertrag widerrufen“. |
| Konformitätserklärungen (R27) | Liste aller aktiven `conformity-declarations` (Glasurname, `validFrom`, PDF-Download) und der Stücke, die sie nutzen (`Nr. 017`); Einleitung aus `pages` mit `key = conformity`. Ohne Einträge: Text „Derzeit sind alle Keramiken als Dekoration gekennzeichnet und nicht für Lebensmittel bestimmt.“ (Seite bleibt erreichbar, kein Fußlink). |

### 3.15 Versand & Zahlung (R25) [P4]

- **Blöcke:** Einleitung (aktive `legal-texts`-Fassung Typ `versand-zahlung`, sonst gekennzeichneter Platzhalter, §3.14);
  **Tabelle Versandklassen aus den Einstellungen** (`settings.shipping.rates`, Zone DE: Klasse, wofür, Preis,
  Versanddienst; dazu „Abholung in Berlin – 0,00 €“) – Werte identisch mit der Warenkorb-Berechnung (eine Quelle,
  E-25); Lieferzeit (E-31); Liefergebiet: nur Deutschland, Abholung in Berlin nach Absprache, Ausland derzeit nicht
  (E-24); mehrere Stücke: es gilt die höchste Versandklasse; Zahlarten (Karte, Apple Pay, Google Pay, PayPal über
  Stripe; Vorkasse per Überweisung, Stück bis zum Ende des 5. Kalendertags nach dem Bestelltag reserviert, E-20/E-23);
  wann abgebucht wird; Transportschäden („bitte melde dich schnell mit Fotos – deine gesetzlichen Rechte bleiben davon
  unberührt“); Rücksendekosten bei Widerruf trägt die Kund:in (E-27); Link R24; harmonisierte Mitteilung zur
  Gewährleistung (R-049).
- **AK-3-10** Ändert Jutta einen Versandpreis im Admin, zeigen R25, Warenkorb und Kasse denselben neuen Wert (≤ 60 s).

### 3.16 Vertrag widerrufen (R26) [P6]

Details §5.4 und §6. Zwei Schritte ohne Login (E-44, § 356a BGB):
1. **Formular:** Name* · Bestellnummer oder andere Angaben zum Vertrag* (Freitext, Hinweis „z. B. PC-2026-00017 oder
   Bestelldatum und Stück“) · E-Mail für die Eingangsbestätigung* · optional „Nur bestimmte Stücke? Dann nenne die
   Nummern“ · optional Grund (nie Pflicht) · Honeypot (unsichtbar). Knopf „Weiter“. Vorbelegung der Bestellnummer über
   `?order=PC-2026-00017` (nur Bestellnummer, nie E-Mail in der URL).
2. **Bestätigen:** Zusammenfassung aller Angaben, Knöpfe „Ändern“ und **„Widerruf bestätigen“** (EN „Confirm withdrawal“).
3. **Ergebnis:** Seite zeigt Inhalt der Erklärung, **Datum und Uhrzeit des Eingangs** (Europe/Berlin), Vorgangsnummer
  `WR-2026-00003`, Hinweis „Eine Bestätigung ist per E-Mail unterwegs“ und „Drucken/als PDF sichern“.
- Kein CAPTCHA; Rate-Limit großzügig (30 pro IP-Hash und Stunde, Zähler höchstens 24 h gespeichert, ARCHITEKTUR §8.5),
  damit echte Widerrufe nie blockiert werden. Der Widerrufs-Datensatz selbst speichert keine IP und keinen IP-Hash (R-093).
- Widerrufe ohne passende Bestellung werden **trotzdem angenommen** und zur manuellen Zuordnung markiert
  (`matchStatus = needs_manual_match`).
- Seite ist dauerhaft online (nicht nach 14 Tagen ausblenden).
- **Wartungsmodus** (`MAINTENANCE_MODE`, ARCHITEKTUR §5.2): R26 bleibt erreichbar. Ist die Datenbank erreichbar,
  funktioniert die Widerrufsfunktion vollständig (Formular, Datensatz, M08); nur wenn die Datenbank nicht erreichbar ist,
  zeigt R26 statt des Formulars den Weg per E-Mail (Adresse aus `MAIL_REPLY_TO`) [Annahme KA-30].
- **AK-3-11** Der Link „Vertrag widerrufen“ ist auf jeder öffentlichen Route (DE/EN, inkl. Kasse, Danke, 404) im DOM vorhanden und sichtbar.
- **AK-3-12** Nach „Widerruf bestätigen“ existiert ein unveränderlicher Datensatz mit Server-Zeitstempel und die Mail M08 ist versendet (Mail-Log).

### 3.17 404 (R28) und 500 (R29) [P2]

- **404:** HTTP 404, H1 fest „Coco hat sich losgerissen“ (EN „Coco slipped her leash“); darunter als Fließtext der
  Rich Text der Seite `pages` mit `key = not_found` (die Überschrift der Seite ersetzt die H1 nicht); Links Start, Shop,
  Tattoo; Feld „Du suchst ein Stück? Nummer eingeben“ → `/nr/[nummer]`. Tuschelinie hängt lose, Coco ist weg. Variante für
  verkaufte, ausgeblendete Stücke: „Dieses Stück hat schon ein Zuhause gefunden“ (§2.3).
- **500:** H1 „Hoppla – die Leine hat sich verheddert“, „Nochmal versuchen“, Link Start. Fehler an Monitoring (falls aktiv).
- Beide mit vollständigem Fußbereich.

---

## 4. Kaufprozess end-to-end

### 4.1 Ablauf im Überblick

```
Produktseite ──„In den Korb“──► Warenkorb-Cookie entsteht (erst jetzt, E-43)
Warenkorb ──„Zur Kasse“ (POST)──► atomare Reservierung aller Stücke, 30 min (E-22)
                                   + Kassen-Datensatz (Checkout) + Stripe Checkout Session (ui_mode 'elements')
Kasse ──„Zahlungspflichtig bestellen“──┬─ Zahlart Stripe: Stripe confirm (ggf. 3-D-Secure / PayPal-Weiterleitung)
                                        │    → Danke-Seite (wartet) ◄── Webhook legt Bestellung „paid“ an, Stück „sold“,
                                        │                               Rechnung, Mails
                                        └─ Zahlart Vorkasse: Bestellung „awaiting_prepayment“, Reservierung bis zur Zahlungsfrist (E-23)
                                             → Danke-Seite mit Bankdaten, Mail mit IBAN
```

Grundsätze:
1. **Nur Unikate, Bestand 1, keine Varianten** (E-10). Menge ist immer 1; es gibt keine Mengenwahl.
2. **Gastbestellung**, keine Kundenkonten (E-30). Bestellstatus über geheimen Link.
3. **Ein Stück gilt erst als verkauft, wenn die Zahlung sicher bestätigt ist** (Stripe-Webhook bzw. „Zahlung erhalten“).
4. **Bestand und Bestellung ändern sich nur serverseitig** in Datenbank-Transaktionen; nie auf Grund von URL-Parametern.

### 4.2 Warenkorb und Cookie

**Cookies** (die einzigen öffentlichen Cookies des Shops; das erste entsteht erst beim ersten „In den Korb“; vollständige
Liste mit Stripe- und Admin-Cookies: ARCHITEKTUR §8.7):

| Eigenschaft | `pc_cart` (Warenkorb) | `pc_checkout` (Kasse) |
|---|---|---|
| Entsteht | erstes „In den Korb“ (Nutzeraktion) | „Zur Kasse“ (POST) |
| Inhalt | base64url-JSON `{"v":1,"items":[{"id":<productId>,"p":<Preis in Cent beim Hinzufügen>},…],"delivery":"shipping"\|"pickup"}`, ≤ 20 Stücke – nur Stück-IDs, Preis beim Hinzufügen (nur für den Hinweis „Preis wurde aktualisiert“) und Lieferart, keine Kennung, keine personenbezogenen Daten | zufälliger Kassen-Token (§2.3) |
| Attribute | `Path=/`, `SameSite=Lax`, `Secure` (außer `localhost`), **nicht** `HttpOnly` (die Korb-Anzahl im Kopf wird clientseitig gelesen), `Max-Age=604800` (7 Tage) | `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age=3600` (1 h) |
| Löschen | wenn der Korb leer wird, nach abgeschlossener Bestellung (beim Aufruf der Danke-Seite) | nach abgeschlossener Bestellung (Danke-Seite); sonst Ablauf nach 1 h |

Beide Cookies sind technisch notwendig (§ 25 Abs. 2 Nr. 2 TDDDG): erst nach einer Nutzeraktion, minimaler Inhalt, kurze
Laufzeit, kein Tracking. Ob stattdessen ein Server-Warenkorb mit Zufalls-ID nötig ist, klärt die Kanzlei in P11
(Kanzleifrage K-38, ARCHITEKTUR Anhang C, C-05). Der Server prüft bei jeder Aktion jedes Stück neu; der Inhalt von
`pc_cart` ist nur eine Merkliste.

**Aktionen:**

| Aktion | Auslöser | Prüfung | Ergebnis |
|---|---|---|---|
| Hinzufügen | „In den Korb“ (POST/Server-Action) | Shop geöffnet (`settings.shop.isOpen = true`); Stück öffentlich, `available`, noch nicht im Korb, Korb < 20 Stücke | Cookie gesetzt/aktualisiert; Knopf wird zu „Liegt schon in deinem Korb“; Kopf-Anzahl +1; kurze Bestätigung „Liegt im Korb“ mit Link „Zum Korb“ (kein Seitenwechsel). Coco-Hüpfer (P9). |
| Entfernen | „Entfernen“ im Korb | – | Cookie aktualisiert; aktive Kasse wird abgebrochen (Reservierung frei, §4.6) |
| Lieferart wählen | Auswahl im Korb oder in der Kasse | Stück mit Versandklasse `nur_abholung` erzwingt `pickup` | Cookie aktualisiert; Versandkosten neu; eine aktive Kasse wird neu gerechnet (Versandbetrag im Kassen-Snapshot und in der Stripe-Session aktualisiert oder Session neu angelegt, Mechanik ARCHITEKTUR §3.5) – **die Reservierung bleibt** |
| Zur Kasse | Knopf „Zur Kasse“ (**POST**, nie durch Seitenaufruf oder Prefetch) | Shop geöffnet (`settings.shop.isOpen = true`); alle Stücke `available` oder bereits durch diese Kasse reserviert; höchstens `settings.shop.maxItemsPerCheckout` Stücke (Standard 10; der Korb selbst fasst bis zu 20), sonst Meldung „Höchstens {n} Stücke pro Bestellung“ | §4.6 Reservierung, Kasse anlegen, Cookie `pc_checkout` setzen, Weiterleitung auf R07 |

**Anzeige je Position im Korb:** Foto, Titel, `Nr. 017`, Preis, „Entfernen“ und Zustand:
- `available` → nichts.
- `reserved` durch andere Kasse → „Gerade reserviert – schau in 30 Minuten nochmal“; „Zur Kasse“ ist gesperrt, solange
  diese Position im Korb liegt.
- `sold`/nicht mehr öffentlich → „Leider schon verkauft“ + Knopf „Entfernen“; „Zur Kasse“ gesperrt.
- Preis seit dem Hinzufügen geändert → aktueller Preis wird gezeigt, Hinweis „Preis wurde aktualisiert“.

**Shop-Pause** (`settings.shop.isOpen = false`, Einstellungen → Shop, §7.14): „In den Korb“ (R04) und „Zur Kasse“ (R06)
sind gesperrt, und R02–R04 sowie R06 zeigen den Text `settings.shop.closedMessage`; der Server lehnt beide Aktionen ab,
auch bei veralteter Seite. Stücke, Archiv, Tattoo-Seiten und alle Pflichtseiten bleiben unverändert erreichbar; ein
vorhandener Korb bleibt erhalten (Entfernen und Lieferart wählen gehen weiter). Bereits laufende Kassen werden nicht
abgebrochen und können bis zu ihrem Ablauf bezahlt werden [Annahme KA-36].

**AK-4-16** Mit `settings.shop.isOpen = false` sind „In den Korb“ und „Zur Kasse“ deaktiviert, `closedMessage` ist auf
R02–R04 und R06 sichtbar, und ein direkter POST auf beide Aktionen wird abgelehnt; eine vorher gestartete Kasse lässt sich
noch bezahlen.

### 4.3 Versandlogik

**Versandklassen** (`shippingClass` je Stück, E-25; Werte laut DATENMODELL `SHIPPING_CLASSES`; Preise in
`settings.shipping.rates` im Admin änderbar, Startwerte):

| Code | Anzeige DE / EN | Rang | Preis Start | Standard-Versanddienst (`Carrier`) | Typische Stücke |
|---|---|---|---|---|---|
| `brief` | Brief / Letter | 1 | 4,50 € | Deutsche Post Großbrief mit Einschreiben (`deutsche_post`) | Zeichnungen, Anhänger |
| `paket_klein` | Paket klein / Small parcel | 2 | 6,50 € | DHL Paket 2 kg (`dhl`) | Textil, Caps |
| `keramik` | Keramik-Paket / Ceramics parcel | 3 | 8,90 € | DHL Paket 5 kg, Karton-in-Karton (`dhl`) | Keramik |
| `nur_abholung` | nur Abholung / Pickup only | – | – | – | zu groß oder zu zerbrechlich für Versand |

**Lieferarten** (`fulfillmentMethod`): `shipping` (Versand, nur Länder aus `settings.shipping.enabledCountries`; Start:
nur DE, E-24) und `pickup` (Abholung in Berlin, 0,00 €, E-25/E-29).

**Regeln:**
1. `shipping`: Versandkosten = Preis der Klasse mit dem **höchsten Rang** unter allen Stücken im Korb (E-25).
2. `pickup`: 0,00 €.
3. Enthält der Korb ein Stück mit Versandklasse `nur_abholung`, ist nur `pickup` wählbar; `shipping` ist ausgegraut mit
   Text „Nr. 023 gibt es nur zur Abholung“.
4. Standard beim ersten Hinzufügen: `shipping` (bzw. `pickup`, wenn erzwungen).
5. Keine versandkostenfreie Grenze, keine Gewichtsberechnung, keine Auslandspreise aktiv. Länderliste und Tarife je
   Zone sind im Datenmodell vorbereitet (EU-Länder, CH) und **aus**; freischalten lässt sich ein EU-Land nur mit den
   Pflicht-Bestätigungen aus R-202 (`settings.shipping.euShippingAcknowledged`), lebensmittelechte Keramik bleibt für
   NL und LU gesperrt; GB und US sind nicht wählbar (E-24, R-060).
6. Gesamtpreis = Summe der Stückpreise + Versandkosten. Keine Zahlungsgebühren/Aufschläge.

**AK-4-01** Korb mit `brief` + `keramik` bei `shipping` → Versand 8,90 €; mit `pickup` → 0,00 €.
**AK-4-02** Korb mit einem `nur_abholung`-Stück bietet `shipping` nicht an (Server lehnt `shipping` ab).
**AK-4-03** Geänderte Klassenpreise in den Einstellungen wirken sofort auf neue Kassen, nicht auf laufende (Snapshot) –
das gilt ohne Lieferartwechsel; wechselt die Lieferart in einer laufenden Kasse, werden Versand und Summen mit den dann
gültigen Tarifen aus `settings.shipping.rates` neu berechnet (§4.2).

### 4.4 Kasse: Abschnitte und Felder

Die Kasse (R07) ist **eine Seite** mit fünf Abschnitten („Schritte“) von oben nach unten. Jeder Abschnitt hat eine
Überschrift mit Anker (`#kontakt`, `#lieferung`, `#rechnung`, `#zahlart`, `#uebersicht`), damit die „Ändern“-Links der
Übersicht dorthin springen und das erste Feld fokussieren. Oben: Reservierungs-Countdown mit Coco (§4.6).

Feldnamen laut DATENMODELL §6.25.1 (Kasse) bzw. §6.8.1 (Bestellung, Adressen über den Feldbaustein `addressFields`);
Pflichtfelder laut R-061.

| Abschnitt | Feld (Label DE) | Name | Pflicht | Validierung / Regel |
|---|---|---|---|---|
| 1 Kontakt | E-Mail | `customer.email` | ja | gültige Adresse, ≤ 254 Zeichen, kleingeschrieben gespeichert; Hinweis „Hierhin schicken wir Bestätigung und Rechnung“ |
| 2 Lieferung | Lieferart | `fulfillmentMethod` | ja | `shipping` \| `pickup` (aus dem Korb übernommen, hier änderbar → Versandkosten und Übersicht aktualisieren sich; die Reservierung bleibt bestehen, weil sich die Stücke nicht ändern) |
| | Vor- und Nachname | `customer.name` (bei `shipping` zugleich `shippingAddress.name`) | ja | ein Feld, 2–100 Zeichen |
| | Straße und Hausnummer | `shippingAddress.addressLine1` | ja bei `shipping` | 3–100 Zeichen; Hinweis „Packstation: ‚Packstation 123‘ und Postnummer in Adresszusatz“ |
| | Adresszusatz | `shippingAddress.addressLine2` | nein | ≤ 100 |
| | PLZ | `shippingAddress.postalCode` | ja bei `shipping` | DE: genau 5 Ziffern |
| | Ort | `shippingAddress.city` | ja bei `shipping` | 2–60 |
| | Land | `shippingAddress.country` | ja bei `shipping` | nur Länder aus `settings.shipping.enabledCountries`; Start: fest „Deutschland“ (Anzeige als Text, ohne Auswahl) |
| | DHL-Benachrichtigung | `carrierEmailConsent` | nein, **nicht vorangekreuzt** | nur bei `shipping`; Text aus Baustein `checkout.dhlEmailConsent` (R-101; Wortlaut nur in RECHT ANFORDERUNGEN §6); Nachweis im `consent-log` |
| | Abhol-Hinweis | – | – | nur bei `pickup`: „Privatstudio in Berlin-{Bezirk}. Ort und Termin sprechen wir per Mail ab.“ |
| 3 Rechnungsadresse | „Rechnungsadresse weicht ab“ | `billingAddressDiffers` | – | nur bei `shipping`; Checkbox **nicht angehakt** (V-03); angehakt → Felder der Rechnungsadresse erscheinen |
| | Name, Straße und Hausnr., Zusatz, PLZ, Ort, Land | `billingAddress.name`, `.addressLine1`, `.addressLine2`, `.postalCode`, `.city`, `.country` | ja bei `billingAddressDiffers`; bei `pickup` **immer** (R-061, Standard bis Kanzleifrage K-07) [Annahme KA-31] | Regeln wie Lieferadresse; Land fest „Deutschland“ |
| 4 Zahlart | Zahlart | `paymentChoice` | ja | `stripe` („Karte, Apple Pay, Google Pay oder PayPal“) \| `prepayment` („Vorkasse per Überweisung“) |
| | Stripe-Zahlungsfeld | – | bei `stripe` | Stripe Payment Element; zeigt je nach Gerät Karte, Apple Pay, Google Pay, PayPal |
| | Vorkasse-Hinweis | – | – | bei `prepayment`: „Du bekommst unsere Bankverbindung per Mail.“ plus Baustein `checkout.vorkasseInfo` (Wortlaut nur in ANFORDERUNGEN §6; Frist nach §4.8) |
| 5 Übersicht | siehe §4.5 | | | |
| – | Bestätigung abweichende Beschaffenheit (je betroffenes Stück) | `deviationAgreements[]` (`product`, `agreedAt`) | ja, wenn das Stück `hasDeviation` hat | **nicht vorangekreuzt**, je Stück eine eigene Checkbox; Text aus Baustein `checkout.deviationAgreement` (§ 476 Abs. 1 S. 2 BGB, R-048; Wortlaut nur in RECHT ANFORDERUNGEN §6); ohne Haken ist der Bestellknopf gesperrt und der Server lehnt ab |

Weitere Regeln:
- **Kein** Telefonfeld, **kein** Firmen- oder Anrede-Feld, **keine** Kundenkonto-Option, **kein** Newsletter, **keine**
  Pflicht-Checkbox „AGB akzeptieren“ (R-061, R-063). Neben dem Formular ein Link auf die Datenschutzerklärung (R-138).
- Eingaben bleiben beim Wechsel der Lieferart erhalten. Fehler werden beim Klick auf den Bestellknopf geprüft: Fokus auf
  die Fehlerzusammenfassung oben, Fehlertext am Feld.
- Im Instagram-In-App-Browser (User-Agent enthält `Instagram`) erscheint über der Zahlart der Hinweis: „Tipp: Für Apple Pay
  oder Google Pay öffne die Seite im Browser (⋯ → Im Browser öffnen).“ (Karte und PayPal funktionieren auch so.)

### 4.5 Übersicht und Bestellknopf

Abschnitt 5 „Übersicht“ steht **unmittelbar** über dem Knopf und aktualisiert sich live (§ 312j Abs. 2 BGB):

1. Jede Position: Foto, Titel, `Nr. 017`, wesentliche Eigenschaften (`buildCharacteristics`, DATENMODELL §6.6.2:
   Kategorie, Maße, Material bzw. bei Textil/Caps Faserzusammensetzung, Größe und Zustand, bei Keramik „Deko – nicht für
   Lebensmittel“ bzw. „lebensmittelecht“, bei Schmuck Material der Metallteile, Abweichungstext), Preis.
2. Versand: Klasse und Preis (z. B. „Versand als Keramik-Paket (DHL) 8,90 €“) oder „Abholung in Berlin 0,00 €“.
3. **Gesamtpreis** (hervorgehoben) mit Steuerhinweis (Kleinunternehmerin: „Gemäß § 19 UStG wird keine Umsatzsteuer
   berechnet.“; Regelbesteuerung: enthaltene MwSt. je Satz).
4. Lieferzeit („2–5 Werktage“, bei Vorkasse mit Zusatz „ab Zahlungseingang“ und der Zahlungsfrist, bzw. „Abholung nach
   Absprache“; R-035).
5. Lieferadresse **[Ändern → #lieferung]**, Rechnungsadresse **[Ändern → #rechnung]**, E-Mail **[Ändern → #kontakt]**,
   Zahlart **[Ändern → #zahlart]**.
6. Hinweistext: Baustein `checkout.legalNotice` (Wortlaut nur in RECHT ANFORDERUNGEN §6, R-063) mit Links auf AGB,
   Widerrufsbelehrung und Datenschutzerklärung; die Links öffnen den Text in einem Dialog auf der Seite (kein
   Seitenwechsel, kein neuer Tab). Darunter der Baustein `withdrawal.returnCostsNote` (Rücksendekosten, E-27).
7. Die Bestätigungen zur abweichenden Beschaffenheit (falls vorhanden).
8. **Knopf mit exakt dem Text „Zahlungspflichtig bestellen“** (E-21), EN „Order with obligation to pay“; kein weiterer
   Text im Knopf, keine Icons, die den Text ersetzen. Gleicher Knopf für Stripe und Vorkasse.
9. Unter dem Knopf: bei Stripe „Bei PayPal wirst du kurz zu PayPal weitergeleitet.“; der Countdown.

**Klick auf „Zahlungspflichtig bestellen“** (Server-Aktion `submitCheckout`):
1. Clientseitige Pflichtfeldprüfung; bei Fehlern Abbruch (§4.4).
2. Server prüft: Kasse `open`, Reservierung nicht abgelaufen, Stücke/Preise/Versand unverändert gegenüber Snapshot,
   Pflicht-Bestätigungen gesetzt.
3. Server speichert an der Kasse (`checkouts`): Kundendaten, `carrierEmailConsent`, `deviationAgreements`, **IDs der
   aktiven Rechtstext-Fassungen** (`legalTextVersions`: AGB, Widerrufsbelehrung, Muster-Widerrufsformular, Datenschutz,
   Versand & Zahlung), die angezeigten Preise (Snapshot), `submittedAt` (= späteres `timestamps.placedAt`), Sprache;
   Einwilligung und Abweichungs-Vereinbarung zusätzlich im `consent-log`. Damit ist R-065 erfüllt: Der Klick ist mit
   allen Vertragsdaten gespeichert, bevor bezahlt wird.
4. Weiter mit §4.7 (Stripe) bzw. §4.8 (Vorkasse).

**AK-4-04** Der Bestellknopf hat den zugänglichen Namen exakt „Zahlungspflichtig bestellen“ (DE) bzw. „Order with obligation to pay“ (EN).
**AK-4-05** Die Übersicht enthält vor dem Knopf: alle Positionen mit Nr. und Preis, Versandkosten, Gesamtpreis, Lieferzeit, Adressen, Zahlart und vier „Ändern“-Links, die zum richtigen Abschnitt springen.
**AK-4-06** Keine Checkbox auf der Kasse ist beim Laden angehakt (V-03), auch nicht „Rechnungsadresse weicht ab“.

### 4.6 Reservierung (30 Minuten, E-22)

**Anlegen** bei „Zur Kasse“ (POST): in **einer** Datenbank-Transaktion für **alle** Stücke des Korbs
(sinngemäß `UPDATE products SET status='reserved' WHERE id = ANY($ids) AND status='available'`; Anzahl geänderter Zeilen
muss der Anzahl der Stücke entsprechen, sonst Rollback; SQL laut DATENMODELL §8.1). Dazu die Kasse (`checkouts`) und je
Stück ein Reservierungs-Datensatz (`reservations`: `ref` = `checkouts.reservationRef`, `checkout`, `product`,
`source = checkout_session`, `status = active`; höchstens eine aktive Reservierung je Stück, partieller UNIQUE-Index).
Alles oder nichts.

**Zeiten** (T0 = Start der Kasse, DATENMODELL §8.1): Countdown bis `displayExpiresAt` = T0 + 30 min
(`settings.payment.reservationMinutes`); Stripe-Session `expires_at` = T0 + 31 min (Stripe-Minimum 30 min ab eigener
Erstellung); Reservierung `expiresAt` = Stripe-Ablauf + 5 min Kulanz (= T0 + 36 min), damit eine Zahlung in letzter
Sekunde nie auf ein schon freigegebenes Stück trifft. Öffentlich gilt das Stück bis zur Freigabe als „gerade reserviert“.

**Anzeige:** Countdown `mm:ss` oben auf der Kasse (Serverzeit, Abweichung der Geräteuhr korrigiert), Coco hält ihn
(Konzeptseite). Bei ≤ 5:00 zusätzlich „Noch 5 Minuten reserviert“, bei ≤ 1:00 „Nur noch 1 Minute“ (DESIGN KO-15). Für
Screenreader getrennte Ansage (`aria-live=polite`) nur bei 10, 5 und 1 Minute und beim Ablauf. Bei 0:00 Satz „Deine
Reservierung ist abgelaufen.“ mit Primärknopf „Nochmal reservieren“ (versucht „Zur Kasse“ erneut) und Link „Zum Korb“;
der Bestellknopf ist dann gesperrt.

**Freigabe** (Stück → `available`, Reservierung `released`, Stripe-Session per API beenden, falls offen) bei:
- Stripe-Event `checkout.session.expired` für diese Session,
- Task `releaseExpiredReservations` (Weckzeitpunkt `expiresAt`, §8.2) für `expiresAt < jetzt`,
- Korb-Änderung: Stück entfernt oder hinzugefügt (eine reine Änderung der Lieferart gibt **nicht** frei, §4.2),
- Zahlung endgültig fehlgeschlagen (`checkout.session.async_payment_failed`),
- Vorkasse storniert (`source = prepayment`).

Freigegebene Reservierungen erhalten `status = released` mit `releaseReason`, bezahlte `status = converted`
(DATENMODELL §6.7, §8.2).

**Wichtig vor jeder Freigabe einer Stripe-Kasse:** Stripe-Session per API beenden. Meldet Stripe, dass die Session bereits
bezahlt ist, wird **nicht** freigegeben, sondern die Bestellung angelegt (§4.10).

**Keine Verlängerung:** Eine Kasse wird nie verlängert (Countdown 30 Minuten); danach neue Reservierung (falls das Stück
noch frei ist).

**Umwandlung bei Vorkasse:** `source = checkout_session` → `prepayment`, `expiresAt = prepayment.dueAt` (23:59:59 Berlin am
5. Kalendertag nach dem Bestelltag, §4.8, E-23).

**AK-4-07** 20 gleichzeitige „Zur Kasse“-Anfragen für dasselbe Stück → genau 1 Erfolg, 19 Meldungen „gerade reserviert“ (100 Wiederholungen, Integrationstest gegen echtes Postgres).
**AK-4-08** Korb mit zwei Stücken, von denen eines reserviert ist → keine Teilreservierung (das freie Stück bleibt `available`).
**AK-4-09** Nach Ablauf (Uhr im Test vorgestellt) und Joblauf ist das Stück `available`, die Stripe-/Mock-Session beendet und die Kasse `expired`.

### 4.7 Zahlung über Stripe (Checkout Sessions, `ui_mode: 'elements'`, E-20/E-21)

**Session anlegen** (bei „Zur Kasse“, direkt nach der Reservierung), fachliche Parameter:

| Parameter | Wert |
|---|---|
| `ui_mode` | `elements` (Zahlungsfeld auf eigener Seite, eigener Bestellknopf) |
| `mode` / Währung | `payment` / `eur` |
| Zahlarten | ausdrücklich `card` und `paypal` (Karte deckt Apple Pay und Google Pay ab). **Keine** Zahlarten mit verzögerter Bestätigung (keine SEPA-Lastschrift, keine Überweisung über Stripe, kein Klarna – E-20). |
| Positionen | je Stück eine Position, Name `Nr. 017 · {Titel}`, Betrag in Cent, Menge 1 |
| Versand | genau eine feste Versandoption mit dem berechneten Betrag, Anzeigename z. B. „DHL Paket (Keramik)“ oder „Abholung in Berlin“ |
| Sprache | `de` bzw. `en` (Seiten-Sprache) |
| Ablauf | `expires_at` = Start der Kasse + 31 min (Stripe-Minimum 30 min; Countdown 30 min, Reservierung bis + 36 min, §4.6) |
| Zuordnung | `client_reference_id` = Kassen-Referenz `checkouts.reservationRef`; `metadata` nur `checkoutRef` (dieselbe Referenz) und `appEnv` – **kein** Kassen-Token und keine Personendaten in Stripe-Feldern |
| Rückkehr | `return_url` = `{NEXT_PUBLIC_SITE_URL}/de/danke/{token}` bzw. `/en/thank-you/{token}` (einzige Stelle, an der der Kassen-Token an Stripe geht) |

**Oberfläche:** Stripe **Payment Element** im Abschnitt 4. **Nicht** das Express Checkout Element (dessen Wallet-Knöpfe
würden den Knopf „Zahlungspflichtig bestellen“ umgehen). Stripe.js wird nur auf R07 geladen.

**Bestellen:** Nach erfolgreichem `submitCheckout` (§4.5) übergibt die Kasse E-Mail und Adresse an die Session
(Mechanik: ARCHITEKTUR), setzt die Kasse auf `confirming` und ruft die Stripe-Bestätigung auf. Stripe führt ggf. 3-D-Secure
oder die PayPal-Weiterleitung durch und kehrt auf die Danke-Seite zurück. Fehler (z. B. Karte abgelehnt) zeigt das
Zahlungsfeld an; die Kasse geht zurück auf `open`, die Reservierung läuft weiter.

**Mock-Provider** (`PAYMENTS_DRIVER=mock`, §1.5): Statt des Payment Elements erscheint ein gleich großes Testfeld
„Testmodus – keine echte Zahlung“ mit Auswahl „Erfolg“ (Standard), „Abgelehnt“, „Abbruch (wie PayPal zurück)“ und
„Verzögert“ (ARCHITEKTUR §3.5).
„Erfolg“ erzeugt ein synthetisches `checkout.session.completed` aus einer Fixture und gibt es an **denselben** Handler wie
der echte Webhook; danach Weiterleitung wie bei Stripe. „Abgelehnt“ zeigt den Fehler im Zahlungsfeld (S8), „Abbruch“
führt auf die Danke-Seite im Zustand „nicht bezahlt“ (S9), „Verzögert“ führt ohne Ereignis auf die Danke-Seite im Zustand
„wartet“; die Kasse bleibt `confirming`, bis der Abgleich sie klärt (S10). Der Mock ist bei `APP_ENV=production` nicht
verfügbar.

### 4.8 Vorkasse (E-23)

**Bestellen** (Zahlart `prepayment`, Klick auf „Zahlungspflichtig bestellen“), in einer Transaktion:
1. Zahlungsfrist berechnen: `prepayment.dueAt` = 23:59:59 (Berlin) am 5. Kalendertag (`settings.payment.prepaymentDays`)
   nach dem Bestelltag (Berliner Datum; Bestellung am Fr 26.09. → Frist Mi 01.10., 23:59:59); Erinnerung
   `prepayment.reminderDueAt` = `timestamps.placedAt` + 72 h (`settings.payment.prepaymentReminderHours`). Reservierung →
   `source = prepayment`, `expiresAt = prepayment.dueAt`. Frist und Erinnerungszeitpunkt berechnet **eine einzige**
   Implementierung in `src/lib/commerce/` (`prepaymentDeadlines`, DATENMODELL §8.5), die Kasse, Mails, Verwaltung und
   Tasks gemeinsam nutzen.
2. Bestellung anlegen (O2): Status `awaiting_prepayment`, `paymentMethod = prepayment`, `paymentProvider = bank_transfer`,
   `prepayment.dueAt`, Snapshot aller Positionen, Preise, Adressen, Rechtstext-Fassungen, Sprache, Status-Token.
3. Stripe-Session der Kasse nach dem Commit beenden (falls vorhanden); Kasse `completed`.
4. Mails M02 (Kund:in, mit Bankdaten und Rechtstext-PDFs) und A02 (Jutta). Keine Rechnung (die entsteht bei Zahlung).
5. Weiterleitung auf die Danke-Seite; Warenkorb-Cookie wird dort gelöscht.

**Bankdaten** (`settings.payment`): Kontoinhaberin, IBAN (Anzeige in 4er-Gruppen), BIC, Betrag, **Verwendungszweck = exakt die
Bestellnummer** (`PC-2026-00017`), Zahlungsfrist als Datum („bis Do 01.10.2026“). Zusätzlich ein **EPC-QR-Code
(GiroCode)** mit denselben Daten auf Danke-Seite, Bestellstatus und in M02 (als eingebettetes Bild).

**Fristen:** 72 h nach der Bestellung (`timestamps.placedAt + 72 h`) ohne Zahlung Erinnerung M03 (E-23: „nach 3 Tagen“;
Task `prepaymentReminders`, `prepayment.reminderSentAt`); nach Ablauf von `prepayment.dueAt` automatische Stornierung
(Status `cancelled`, `cancelReason=payment_timeout`), Stück wieder `available`, Mails M04 und A03 (Task
`cancelOverduePrepayments`, §8.2).

**Zahlung erhalten** (Admin, Ansicht „Vorkasse offen“): Dialog zeigt erwarteten Betrag und Verwendungszweck; Jutta trägt
den eingegangenen Betrag ein (`prepayment.receivedAmountCents`, Pflicht; weicht er vom Gesamtbetrag ab, erscheint eine
Warnung) und optional das Eingangsdatum (Standard heute, `prepayment.receivedAt`). Bestätigen → Status `paid` (O3),
Stücke `sold`, Rechnung, Mail M05 (mit Rechnung).

**Zahlung kommt nach der Stornierung:** Admin-Aktion „Nachträglich bezahlt“ an einer wegen Fristablauf stornierten
Bestellung (`cancelReason = payment_timeout`): Sind alle Stücke noch `available`, wird die Bestellung `paid` (O5; Stücke
`sold`, Rechnung, M05). Sonst zeigt der Dialog „Stück inzwischen
verkauft – bitte Geld zurücküberweisen“ und bietet „Rücküberweisung erledigt“ an (Notiz an der Bestellung, keine Rechnung).

Über- oder Unterzahlung wird nicht automatisiert: Jutta bestätigt nur vollständige Zahlungen und klärt den Rest per Mail.

### 4.9 Abholung (E-29)

- Lieferart `pickup` im Korb oder in der Kasse: 0,00 €, keine Lieferadresse, Name und Rechnungsadresse Pflicht (R-061,
  Standard bis Kanzleifrage K-07, KA-31).
- Bezahlen wie beim Versand über Stripe oder Vorkasse. **Keine** Barzahlung bei Abholung [Annahme, Anhang A].
- Nach Zahlung erscheint die Bestellung im Admin unter „Abholung“. Jutta tippt **„Bereit zur Abholung“**: Ein Textfeld ist
  mit der Vorlage aus den Einstellungen (`settings.pickup.instructions`) vorbelegt (Adresse des Privatstudios, mögliche
  Zeiten, Kontakt) und editierbar →
  Mail M07 mit diesem Text, Status `ready_for_pickup`. **Der Ort steht nur in dieser Mail**, nirgends öffentlich.
- **„Abgeholt“** → Status `picked_up`.
- Liegt eine Bestellung länger als 14 Tage in `ready_for_pickup`, markiert die Admin-Übersicht sie; keine Automatik.
- Widerrufsrecht gilt auch bei Abholung (Fernabsatz); die Frist beginnt mit der Übergabe (`timestamps.pickedUpAt`, R-083).

### 4.10 Bestellanlage per Webhook (`fulfillCheckout`)

Eine einzige, **idempotente** Funktion legt Stripe-Bestellungen an. Aufrufer:
1. **Primär:** Webhook `checkout.session.completed` mit `payment_status=paid` (auch `async_payment_succeeded`, defensiv).
2. **Rückfall:** die Danke-Seite, nachdem sie die Session **serverseitig bei Stripe** abgefragt hat und diese bezahlt ist.
3. **Rückfall:** „Kassen abgleichen“ im Task `releaseExpiredReservations` für Kassen in `confirming` seit > 10 min
   (Weckzeitpunkt 10 min nach dem Wechsel in `confirming`, §8.2).

Ablauf in einer Transaktion (Sperre auf den Kassen-Datensatz):
1. Existiert bereits eine Bestellung zu dieser Session → nichts tun (Idempotenz; eindeutige Indizes auf
   `orders.stripe.checkoutSessionId` und `orders.checkout`, zusätzlich `webhook-events`). Weitere Vorprüfungen der Kasse
   (Bestellung nur für Kassen in `open`/`confirming`):
   - Kasse `completed` durch eine Vorkasse-Bestellung, aber Stripe meldet diese Session als bezahlt (§4.11 S17) → keine
     zweite Bestellung; Hinweis an der Vorkasse-Bestellung (`adminAttention` mit Notiz „zusätzlich per Karte/PayPal
     bezahlt“) und Mail A12 [Annahme KA-35].
   - Kasse `expired`, `cancelled` oder `failed`, aber Stripe meldet die Session als bezahlt (§4.11 S16) → **keine**
     Bestellung, Stücke unverändert; Mail A12 „Zahlung zu einer beendeten Kasse – bitte im Stripe-Dashboard erstatten“
     [Annahme KA-34].
2. Für jedes Stück: Ist es `reserved` durch diese Kasse **oder** `available` → `sold` (`soldChannel = online` bei Versand
   bzw. `pickup` bei Abholung, `soldAt`, `currentOrder`). Sonst (verkauft oder fremd reserviert) → „fehlt“.
3. Bestellung aus dem Kassen-Snapshot anlegen (O1: `paid`, `timestamps.paidAt`, Positionen, Adressen,
   `legalTextVersions`, `carrierEmailConsent`; Zahlart aus Stripe: `paymentMethod = card` – Wallet `apple_pay`/
   `google_pay` in `stripe.paymentMethodType` – oder `paypal`; `stripe.paymentIntentId`), Reservierungen `converted`,
   Kasse `completed`.
4. Bestellnummer aus der Sequenz (`PC-JJJJ-NNNNN`); Rechnung (§4.13) anlegen – außer alle Stücke fehlen (Punkt 6).
5. Nach dem Commit: Mails M01 und A01; Revalidierung von Produktseite, Listen, Startseite.
6. **Fehlende Stücke** (§4.11 S4, DATENMODELL §8.4): alle fehlen → Bestellung ohne Rechnung, sofortige Voll-Erstattung,
   Status `refunded` (O19), `refunds[].reason = item_unavailable`, Mails M10 und A06. Teilweise → Teil-Erstattung (Preis der
   fehlenden Stücke + Differenz der Versandkosten zur Klasse der verbleibenden Stücke) als Eintrag in `refunds[]` ohne
   Statuswechsel und ohne Gutschrift, Bestellung bleibt `paid`, Hinweisblock in M01, A06; Rechnung nur über die gelieferten
   Stücke.

**Verarbeitete Stripe-Events:**

| Event | Wirkung |
|---|---|
| `checkout.session.completed` (`payment_status=paid`) | `fulfillCheckout` (Sonderfälle beendete Kasse bzw. schon bestellte Vorkasse: §4.11 S16/S17) |
| `checkout.session.completed` (`unpaid`) | protokollieren, nichts tun (kommt bei unseren Zahlarten nicht vor) |
| `checkout.session.async_payment_succeeded` | `fulfillCheckout` (defensiv) |
| `checkout.session.async_payment_failed` | Kasse `failed`, Reservierung frei |
| `checkout.session.expired` | Kasse `open`/`confirming` → `expired` und Reservierung frei – **nur** Reservierungen mit `source = checkout_session` dieser Kasse; ist die Kasse schon `completed` (z. B. Vorkasse bestellt), wird das Event ignoriert |
| `charge.refunded`, `refund.created`, `refund.updated` | Erstattungsstatus an der Bestellung aktualisieren (`refunds[].status`, §5.3) |
| `refund.failed` bzw. `refund.updated` mit `status=failed` | Erstattung als fehlgeschlagen markieren (`adminAttention = refund_failed`), Mail A08 |
| `charge.dispute.created` | Status `disputed` (§5.3 O16), Mail A07 |
| `charge.dispute.closed` | gewonnen → vorheriger Status; verloren → `refunded` (§5.3) |
| alle anderen | 200 OK, ignorieren |

Signatur ungültig → HTTP 400. Verarbeitungsfehler → HTTP 500 (Stripe wiederholt) und bei Wiederholung Mail A12.

### 4.11 Wettlauf und Sonderfälle

| # | Situation | Verhalten |
|---|---|---|
| S1 | Zwei Personen klicken gleichzeitig „Zur Kasse“ für dasselbe Stück | Genau eine Reservierung gelingt. Die andere bleibt im Korb: „Nr. 017 ist gerade reserviert – schau in 30 Minuten nochmal.“ |
| S2 | Reservierung läuft ab, niemand zahlt | Freigabe (Event `expired` oder Job); Kasse zeigt „abgelaufen“; Stück wieder `available`. |
| S3 | Zahlung in letzter Sekunde, Webhook kommt nach dem Joblauf | Job beendet vor der Freigabe die Stripe-Session; Stripe meldet „bereits bezahlt“ → keine Freigabe, `fulfillCheckout`. |
| S4 | **Bezahlt, aber Stück schon verkauft** (Restfall trotz S3) | Automatische (Teil-)Erstattung über Stripe, Kund:innen-Mail M10 bzw. Hinweis in M01, **Admin-Alarm A06** (E-22, Konzeptseite „Risiken“). |
| S5 | Jutta klickt „Offline verkauft“, während jemand in der Kasse ist | Dialog warnt („Nr. 017 ist gerade in einer Kasse reserviert“). Bestätigen → Stripe-Session beenden, Reservierung freigeben, Stück `sold` (`offline`). Die Kasse meldet beim Bestellen „leider gerade verkauft“. Geht die Zahlung dennoch durch → S4. Bei `source = prepayment` ist „Offline verkauft“ gesperrt („erst Vorkasse-Bestellung PC-… stornieren“). |
| S6 | Korb wird in anderem Tab geändert, während die Kasse offen ist | Kasse abgebrochen, Reservierung frei; Kasse zeigt „Dein Korb hat sich geändert“ + Link zum Korb. |
| S7 | Preise ändern sich während einer offenen Kasse | Snapshot-Preis der Kasse gilt bis zu ihrem Ende; neue Kasse → neuer Preis. |
| S8 | Karte abgelehnt | Meldung im Zahlungsfeld; erneuter Versuch bis Ablauf der Reservierung. |
| S9 | PayPal abgebrochen | Rückkehr auf die Danke-Seite, Zustand „nicht bezahlt“ mit Knopf „Zurück zur Kasse“ (Reservierung läuft weiter). |
| S10 | Webhook kommt nie | Danke-Seite fragt Stripe; Job „Kassen abgleichen“ holt nach. |
| S11 | Webhook kommt doppelt | idempotent (Event-ID, eindeutige Session-ID an der Bestellung). |
| S12 | Jemand will ein Vorkasse-reserviertes Stück kaufen | Anzeige „gerade reserviert“ bis Zahlung oder Storno. |
| S13 | Stripe beim Kassenstart nicht erreichbar | Kasse öffnet mit nur „Vorkasse“ und Hinweis „Kartenzahlung ist gerade nicht erreichbar“. |
| S14 | Zwei Tabs derselben Person | Gleiches Cookie `pc_checkout` → dieselbe Kasse wird wiederverwendet (keine doppelte Reservierung). |
| S15 | Jutta will ein reserviertes Stück bearbeiten/offline nehmen | Bearbeiten erlaubt (wirkt nicht auf laufende Kasse), „Offline nehmen“ und „Ausblenden“ gesperrt mit Hinweis bis HH:MM. |
| S16 | Stripe meldet eine Zahlung zu einer Kasse, die schon `expired`, `cancelled` oder `failed` ist (Restfall, weil vor jeder Freigabe die Session beendet wird, §4.6) | Keine Bestellung, keine Rechnung, Stücke unverändert; Ereignis protokolliert; Mail A12 an Jutta mit Betrag, Stripe-Zahlungs-ID und Anweisung „bitte im Stripe-Dashboard erstatten und der Kundin schreiben“ [Annahme KA-34]. |
| S17 | Kund:in hat Vorkasse bestellt, und die Stripe-Session derselben Kasse wird trotzdem bezahlt (z. B. zweiter Tab) | Keine zweite Bestellung; die Vorkasse-Bestellung bleibt unverändert und erhält einen Hinweis (`adminAttention` mit Notiz, sichtbar unter „Heute“); Mail A12 „Karte/PayPal bezahlt, obwohl Vorkasse bestellt – Kartenzahlung im Stripe-Dashboard erstatten oder mit der Kundin klären“ [Annahme KA-35]. |

**AK-4-10** Szenario S3 und S4 sind als Integrationstests mit Mock-Provider und vorgestellter Uhr abgedeckt; bei S4 gibt es genau eine Erstattung, Mail M10 und Mail A06.
**AK-4-11** Doppelte Zustellung desselben `checkout.session.completed` erzeugt genau eine Bestellung, eine Rechnung, eine Mail M01.
**AK-4-17** S16 und S17 (Integrationstests mit Mock-Provider): ein bezahltes `checkout.session.completed` zu einer Kasse in `expired`/`cancelled`/`failed` bzw. zu einer schon per Vorkasse abgeschlossenen Kasse erzeugt keine Bestellung und keine Rechnung, aber genau eine Mail A12; bei S17 trägt die Vorkasse-Bestellung den Hinweis.

### 4.12 Danke-Seite und Bestellstatus

**Danke-Seite (R08)** – Zustände:

| Zustand | Bedingung | Anzeige |
|---|---|---|
| wartet | Kasse `confirming`, noch keine Bestellung | „Coco wartet auf die Bestätigung …“; Abfrage alle 2 s bis 60 s (`GET /api/checkout/[token]/state`, §2.7); danach „Das dauert länger als sonst. Du bekommst eine Mail, sobald alles bestätigt ist.“ |
| bezahlt | Bestellung `paid` | „Danke!“, Bestellnummer, Positionen, Summe, Lieferart, nächste Schritte („Ich packe dein Paket in den nächsten Tagen“ bzw. „Ich melde mich zur Abholung“), Hinweis auf Mail, Link Bestellstatus, Link „Vertrag widerrufen“; fehlt ein Teil der Stücke (S4 teilweise), zusätzlich der Block „Leider schon weg: Nr. … – erstattet: … €“ wie in M01 (§6.3 Punkt 11) |
| Vorkasse | Bestellung `awaiting_prepayment` | wie bezahlt, plus Bankdaten, Frist, EPC-QR-Code |
| leider schon weg | Bestellung `refunded` durch O19 (bezahlt, aber alle Stücke weg, S4) | H1 „Leider schon weg“ (EN „Sorry, already gone“) statt „Danke!“, Text wie M10 (§6.3): Entschuldigung, „Jemand war ein paar Sekunden schneller“, der volle Betrag wird über dasselbe Zahlungsmittel erstattet, sichtbar meist nach 5–10 Werktagen; Bestellnummer, Hinweis auf die Mail, Link zum Shop; keine Rechnung, kein Rabattcode |
| nicht bezahlt | Kasse `open`/`failed` nach Rückkehr | „Die Zahlung hat nicht geklappt“; „Zurück zur Kasse“ (falls Reservierung aktiv) sonst „Zum Korb“ |
| unbekannt | Token unbekannt | 404 |

Die Danke-Seite prüft den Token gegen den Kassen-Token (`checkouts.tokenHash`) und – für angelegte Bestellungen – gegen
den Status-Token der Bestellung (`orders.statusTokenHash`). Beim ersten
Aufruf mit Bestellung werden die Cookies `pc_cart` und `pc_checkout` gelöscht. Nach dem Löschen der Kasse (30 Tage, §5.2)
liefert der Kassen-Token 404; der Status-Link bleibt gültig.

**Bestellstatus (R09)** – über den Link in jeder Kund:innen-Mail erreichbar bis 180 Tage nach dem Endstatus
(`timestamps.finalStatusAt`, LOESCHKONZEPT L-05 Stufe B); danach Seite „Link abgelaufen“ mit Kontaktadresse (R-067).
„Statuslink neu senden“ in der Verwaltung erzeugt einen neuen Token (der alte wird ungültig).
1. Bestellnummer, Datum, Status als Verlauf aus `orders.statusHistory` (bestellt → bezahlt → gepackt → versendet →
   zugestellt bzw. bereit zur Abholung → abgeholt; Widerruf/Erstattung als eigene Einträge).
2. Sendungsnummer mit Link zur Sendungsverfolgung (Vorlage je Versanddienst, §7.14), falls vorhanden.
3. Positionen (Foto, Titel, Nr., Preis), Versand, Summe, Zahlart.
4. Bei `awaiting_prepayment`: Bankdaten, Frist, EPC-QR-Code.
5. Dokumente: AGB und Widerrufsbelehrung inkl. Muster-Widerrufsformular **in der Fassung der Bestellung** (PDF).
   **Keine** Rechnung und keine Gutschrift zum Download (R-067, strengere Regel: Belege enthalten die volle Anschrift);
   Belege kommen als Mail-Anhang (M01, M05, M09) und liegen in der Verwaltung.
6. Knopf „Vertrag widerrufen“ → R26 mit `?order=<Bestellnummer>`.
7. Personenbezogenes gekürzt: Name, PLZ und Ort; E-Mail maskiert (`j•••@outlook.de`); keine Straße.

**AK-4-12** Danke- und Statusseite senden `noindex`, `Referrer-Policy: no-referrer` und `Cache-Control: private, no-store`;
die Statusseite bietet keine Rechnung/Gutschrift an, und die Dokument-Route liefert nur Rechtstext-PDFs der Bestellung und
nur mit gültigem Token.

### 4.13 Rechnungen und Gutschriften

| Thema | Regel |
|---|---|
| Zeitpunkt | beim Übergang nach `paid` (O1, O3, O5); nie bei Vorkasse-Bestellung vor Zahlung |
| Nummer | `RE-{JJJJ}-{NNNNN}`, **lückenlos** je Kalenderjahr, vergeben in derselben Transaktion (Zeilensperre auf Zähler); Beispieldaten: eigene Serien `BSP-RE-{JJJJ}-{NNNNN}` bzw. `BSP-GS-{JJJJ}-{NNNNN}` mit eigenem Zähler (§11.2) |
| Inhalt (Kleinunternehmerin, § 34a UStDV, R-120) | „Rechnung“, Nummer, Rechnungsdatum (= Ausstellungsdatum), Leistungszeitpunkt **als Monat** (z. B. „Oktober 2026“, R-120), Verkäuferin (Name, Anschrift, E-Mail, Steuernummer bzw. W-IdNr./USt-IdNr. aus `settings.business`), Empfänger:in (Rechnungsadresse; bei Versand ohne abweichende Rechnungsadresse die Lieferadresse), Positionen (`Nr. 017`, Titel und Kategorie, Menge 1, Preis), Versandkosten als Position, Gesamtbetrag, **„Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.“**, Zahlart und „bezahlt am“, Bestellnummer |
| Inhalt (Regelbesteuerung, § 14 Abs. 4 UStG) | zusätzlich Netto je Steuersatz, Steuersatz, Steuerbetrag, Brutto; Liefertag bzw. -monat |
| Unveränderlich | PDF wird einmal erzeugt, privat gespeichert, SHA-256-Prüfsumme gespeichert; kein Bearbeiten, kein Neu-Erzeugen, kein Löschen (Ausnahme: Seed); Datenbank-Trigger laut DATENMODELL §9.4 |
| Korrektur | nur per Beleg `GS-{JJJJ}-{NNNNN}`: „Stornorechnung“ bei Voll-Erstattung, „Gutschrift“ bei Teil-Erstattung, mit Bezug auf die RE-Nummer; lückenlos wie RE |
| Zugriff | Kund:in als Mail-Anhang (Rechnung mit M01 bzw. M05, Gutschrift mit M09) – **nicht** über die Statusseite (R-067, §4.12); Jutta in der Verwaltung; Monats-Export und Rechnungs-ZIP (§7.15) |
| Aufbewahrung | Einstellung `settings.retention.invoiceYears` ∈ {8, 10}, Standard **10 Jahre** ab Ende des Ausstellungsjahres (freigegebene Konzeptseite), umstellbar auf 8 (Steuerberatung/Kanzlei entscheidet, KA-01); `retainUntil` wird beim Anlegen eingefroren; danach PDF löschen und Registerzeile anonymisieren (LOESCHKONZEPT L-06, §8.3) |

**AK-4-13** 50 parallele Zahlungsabschlüsse erzeugen 50 Rechnungen mit lückenlosen Nummern ohne Dubletten.
**AK-4-14** Ein Versuch, ein Rechnungs-Dokument zu ändern oder zu löschen (Admin/API), wird abgelehnt (außer `seed=true`).

### 4.14 Steuermodus (E-02)

- `settings.tax.modes`: Liste {`mode` ∈ `kleinunternehmer` | `regelbesteuert`, `validFrom`}; Standard
  `[{ kleinunternehmer, 2026-01-01 }]`; es gilt der letzte Eintrag mit `validFrom` ≤ Zeitpunkt (DATENMODELL §7.1).
- Pro Stück `vatCategory = standard | reduced_art` (Standard `standard`; `reduced_art` nur für `category = zeichnung` und
  nur mit Begründung `vatReducedReason`, Anlage 2 Nr. 53 UStG).
- Wirkung für Bestellungen ab dem `validFrom` eines Eintrags `regelbesteuert`: Preis-Hinweis „inkl. 19 % bzw. 7 % USt.“;
  Kassen-Übersicht mit enthaltener Steuer je Satz; Rechnung nach § 14 Abs. 4 UStG; Versandkosten werden anteilig nach
  Warenwert auf die Steuersätze verteilt [Annahme KA-10, Steuerberatung]. Die eingegebenen Preise bleiben Endpreise.
  Ältere Belege bleiben unverändert (Modus je Beleg eingefroren).
- Umstellen im Admin (Verhalten laut RECHT R-032): Warnung „Nur nach Rücksprache mit der Steuerberatung umstellen.“,
  Bestätigungsdialog mit Pflicht-Begründung, Audit-Eintrag `tax_mode_changed`.

**AK-4-15** Beide Modi sind getestet (Preisanzeige, Kasse, Rechnung); im Modus `kleinunternehmer` erscheint nirgends ein Umsatzsteuerbetrag.

---

## 5. Statusmodelle

Allgemeine Regeln:
1. Statuswechsel laufen **nur** über definierte Aktionen (Admin-Knopf, System-Ereignis, Job). Freies Umstellen im
   Standard-Payload-Formular ist für Status-Felder gesperrt (Feld schreibgeschützt).
2. Jeder Wechsel wird protokolliert (von, nach, Zeitpunkt, Auslöser = `ActorType` `admin|system|webhook|job|customer|seed`,
   Notiz): bei Bestellungen im Array `orders.statusHistory` (mit Übergangs-ID `O1`…`O21`, DATENMODELL DM-21), bei Stücken,
   Widerrufen und Anfragen als Einträge im `audit-log` (z. B. `product_status_changed`, `withdrawal_status_changed`;
   Aktionen laut DATENMODELL §4 `AUDIT_ACTIONS`); Kassen tragen je Zielstatus einen eigenen Zeitstempel (`confirmingAt`,
   `completedAt`, `expiredAt`, `cancelledAt`, `failedAt`) und `closeReason` (DATENMODELL §6.25). Der Helfer
   `getStatusHistory()` liefert den Verlauf einheitlich.
3. Nicht aufgeführte Übergänge werden serverseitig abgelehnt. **Test:** Für jedes Modell prüft ein Matrix-Test, dass
   alle erlaubten Übergänge gelingen und alle anderen scheitern.

### 5.1 Produkt (Stück)

| Status | DE-Anzeige (Admin) | Öffentlich | Bedeutung |
|---|---|---|---|
| `draft` | Entwurf | nein | in Arbeit |
| `available` | online | ja, kaufbar | im Shop |
| `reserved` | reserviert | ja, nicht kaufbar | in einer Kasse (Countdown 30 min) oder Vorkasse (bis zur Zahlungsfrist, §4.8) |
| `sold` | verkauft | ja nur mit `showInArchiveAfterSale=true` (mit Stempel) | online verkauft (`soldChannel=online` bei Versand, `pickup` bei Abholung) oder offline (`soldChannel=offline`, E-28) |
| `archived` | ausgeblendet | nein | nicht verkauft, aber nicht mehr im Angebot (z. B. beschädigt, zurückgezogen) |

Zusatzfelder (DATENMODELL §6.6.1): `showInArchiveAfterSale` (bool, Standard `true`, E-14; nur für `sold` wirksam),
`soldChannel`, `soldAt`, `firstPublishedAt` (erste Veröffentlichung; ab dann ist `itemNumber` unveränderlich, E-12),
`reservedUntil`, `reservationRef`, `currentOrder`, `archivedAt`.

| # | Von | Nach | Auslöser | Bedingung | Nebenwirkungen |
|---|---|---|---|---|---|
| P1 | – | `draft` | Admin „Als Entwurf speichern“ | Nummer eindeutig | – |
| P2 | `draft` | `available` | Admin „Online stellen“ | Veröffentlichungsprüfung bestanden (§7.4) | `firstPublishedAt` (nur beim ersten Mal; ab dann Nummer gesperrt), Revalidierung |
| P3 | `available` | `draft` | Admin „Offline nehmen“ · System, wenn eine verknüpfte Konformitätserklärung eines lebensmittelechten Stücks widerrufen wird | keine aktive Reservierung | Revalidierung (Seite → 404); beim System-Übergang Admin-Mail und Hinweis unter „Heute“ (`adminAttention`) |
| P4 | `available` | `reserved` | System „Zur Kasse“ | atomar (§4.6) | Reservierung `source = checkout_session` |
| P5 | `reserved` | `available` | System: Ablauf, Event `expired`, Korb geändert, Zahlung gescheitert, Vorkasse storniert | – | Reservierung `released`, Stripe-Session beendet |
| P6 | `reserved` | `reserved` | System: Vorkasse bestellt | Reservierung dieser Kasse gültig | `source → prepayment`, `expiresAt = prepayment.dueAt` |
| P7 | `reserved` | `sold` | System `fulfillCheckout` / Admin „Zahlung erhalten“ | Reservierung gehört zur Bestellung | `soldChannel = online`/`pickup` je Lieferart, `soldAt`, `currentOrder`, Revalidierung |
| P8 | `available` | `sold` | System `fulfillCheckout` (Reservierung war schon frei, Stück noch frei) / Admin „Nachträglich bezahlt“ | – | wie P7 |
| P9 | `available` | `sold` | Admin „Offline verkauft“ | – | `soldChannel=offline`, `soldAt`; `showInArchiveAfterSale` wie im Dialog gewählt |
| P10 | `reserved` (`source = checkout_session`) | `sold` | Admin „Offline verkauft“ mit Warnung (S5) | Bestätigung im Dialog | Stripe-Session beenden, Reservierung freigeben, `soldChannel=offline` |
| P11 | `sold` | `available` | Admin „Wieder verkaufen“ | `soldChannel=offline` (Korrektur) **oder** zugehörige Bestellposition erstattet und Ware zurück **oder** Bestellung vor Versand bzw. Übergabe mit Grund `admin_cancellation` erstattet (Stück nie verschickt) [Annahme KA-37] | `soldAt`, `soldChannel`, `currentOrder` leeren; Historie bleibt; Veröffentlichungsprüfung erneut |
| P12 | `draft`, `available` | `archived` | Admin „Ausblenden“ | keine aktive Reservierung | `archivedAt`, Revalidierung |
| P13 | `sold` | `archived` | Admin „Ausblenden“ nach Rückgabe oder Bruch (beschädigt) | Bestellposition erstattet und Ware zurück **oder** Bestellung wegen `breakage` erstattet (Stück vor dem Versand beschädigt, nie verschickt) | `archivedAt`; `soldAt`, `soldChannel`, `currentOrder` leeren; Revalidierung |
| P14 | `archived` | `draft` | Admin „Wieder bearbeiten“ (Endpunkt `/restore`) | – | `archivedAt = null` |
| P15 | `draft` | gelöscht | Admin „Löschen“ | `firstPublishedAt` leer (nie veröffentlicht) und keine Bestellposition verweist auf das Stück | Bilder gelöscht, Nummer wieder frei |

Nicht erlaubt u. a.: `reserved` (`source = prepayment`) → `sold` per „Offline verkauft“; Löschen veröffentlichter Stücke;
Ändern der Nummer nach der ersten Veröffentlichung. „Im Archiv zeigen“ ist ein Schalter (`showInArchiveAfterSale`), kein
Statuswechsel.

### 5.2 Kasse (Checkout) und Reservierung – intern

| Status | Bedeutung |
|---|---|
| `open` | Reservierung aktiv, Formular wird ausgefüllt |
| `confirming` | „Zahlungspflichtig bestellen“ geklickt, Stripe-Bestätigung läuft |
| `completed` | Bestellung angelegt (Stripe bezahlt oder Vorkasse bestellt) |
| `expired` | Reservierung abgelaufen |
| `cancelled` | Korb geändert oder ersetzt |
| `failed` | Zahlung endgültig gescheitert |

| Von | Nach | Auslöser |
|---|---|---|
| – | `open` | „Zur Kasse“ |
| `open` | `confirming` | `submitCheckout` mit Stripe |
| `confirming` | `open` | Stripe meldet Fehler/Abbruch zurück, Reservierung noch gültig |
| `open`, `confirming` | `completed` | `fulfillCheckout` bzw. Vorkasse bestellt |
| `open`, `confirming` | `expired` | Ablauf + Stripe bestätigt, dass nicht bezahlt wurde |
| `open` | `cancelled` | Korb geändert, neue Kasse ersetzt diese |
| `confirming` | `failed` | `async_payment_failed` |

Bei `expired`, `cancelled` und `failed` speichert die Kasse den Grund (`closeReason`, DATENMODELL §6.25). Es gibt **keine**
Bestellstatus für abgebrochene, abgelaufene oder gescheiterte Bezahlvorgänge – das sind Kassen-Zustände. Kassen werden
30 Tage nach Anlage gelöscht (LOESCHKONZEPT L-03, §8.3), auch Kassen mit Bestellung, deren Daten die Bestellung selbst
enthält (DATENMODELL DM-05).

### 5.3 Bestellung

| Status | DE-Anzeige (Admin / Kund:in) |
|---|---|
| `awaiting_prepayment` | Vorkasse offen / Warten auf Überweisung |
| `paid` | bezahlt / Bezahlt |
| `packed` | gepackt / Wird verpackt |
| `shipped` | versendet / Unterwegs |
| `ready_for_pickup` | bereit zur Abholung / Abholbereit |
| `picked_up` | abgeholt / Abgeholt |
| `delivered` | zugestellt / Zugestellt |
| `cancelled` | storniert / Storniert |
| `withdrawal_received` | Widerruf eingegangen / Widerruf eingegangen |
| `return_received` | Ware zurück / Rücksendung angekommen |
| `refunded` | erstattet / Erstattet |
| `partially_refunded` | teilweise erstattet / Teilweise erstattet |
| `disputed` | angefochten / (Kund:in sieht den vorherigen Status) |

Die Statusliste ist exakt das Enum `ORDER_STATUSES` aus DATENMODELL §4 (13 Werte). Eine Bestellung entsteht erst mit
bestätigter Zahlung (O1, O19) bzw. beim Vorkasse-Abschluss (O2); davor gibt es nur die Kasse (§5.2).

Zusatzfelder (Namen laut DATENMODELL §6.8.1): `fulfillmentMethod = shipping | pickup`,
`paymentMethod = card | paypal | prepayment` (Wallet `apple_pay`/`google_pay` in `stripe.paymentMethodType`),
`paymentProvider = stripe | mock | bank_transfer`, `cancelReason = payment_timeout | admin | withdrawn` (+ `cancelNote`),
`statusBeforeWithdrawal`, `statusBeforeDispute`, `dispute.*`, `refunds[]` (`amountCents`, `reason` ∈ `withdrawal |
goodwill | complaint | item_unavailable | dispute | admin_cancellation | breakage` (Werte laut DATENMODELL
`REFUND_REASONS`), `itemIds`, `includesShipping`, `status` `pending|succeeded|failed`,
`stripeRefundId`, `manualTransferConfirmedAt`, `creditNote` → Beleg GS), `shipment.carrier`, `shipment.trackingNumber`,
`shipment.deliveredSource = manual | auto`, `packaging.*`, `prepayment.dueAt`, `prepayment.reminderSentAt` (nur Vorkasse),
`timestamps.*`, `statusHistory`.

| # | Von | Nach | Auslöser | Bedingung | Nebenwirkungen |
|---|---|---|---|---|---|
| O1 | – | `paid` | Webhook/`fulfillCheckout` | Stripe `payment_status=paid` | Stücke `sold`, Rechnung RE, M01, A01 |
| O2 | – | `awaiting_prepayment` | Kund:in bestellt mit Vorkasse | Reservierung gültig | Reservierung bis `prepayment.dueAt`, M02, A02 |
| O3 | `awaiting_prepayment` | `paid` | Admin „Zahlung erhalten“ | – | Stücke `sold`, RE, M05 |
| O4 | `awaiting_prepayment` | `cancelled` | Job (nach `prepayment.dueAt`, `payment_timeout`) / Admin „Stornieren“ (`admin`, Grund Pflicht in `cancelNote`) / zugeordneter Widerruf (`withdrawn`) | – | Reservierung freigegeben, Stücke `available`; Mail M04 (bei Widerruf stattdessen Hinweis in M08); A03 nur beim Job |
| O5 | `cancelled` (nur `payment_timeout`) | `paid` | Admin „Nachträglich bezahlt“ | alle Stücke `available` | Stücke `sold`, RE, M05 |
| O6 | `paid` | `packed` | Admin „Gepackt“ | `fulfillmentMethod=shipping` | `timestamps.packedAt` |
| O7 | `paid`, `packed` | `shipped` | Admin „Versendet melden“ | `shipping`; Verpackung erfasst (`packaging.*`, §7.6); Sendungsnummer 8–35 Zeichen `[A-Za-z0-9]` Pflicht bei Versandklasse `paket_klein` und `keramik`, bei `brief` optional; bei Keramik ohne Packfoto Rückfrage „Ohne Packfoto versenden?“, Bestätigung wird protokolliert | `timestamps.shippedAt`, `shipment.carrier`, `shipment.trackingNumber`, M06 (ohne Verfolgungslink, wenn keine Sendungsnummer) |
| O8 | `paid` | `ready_for_pickup` | Admin „Bereit zur Abholung“ | `fulfillmentMethod=pickup` | Abholtext gespeichert, M07 |
| O9 | `ready_for_pickup` | `picked_up` | Admin „Abgeholt“ | – | `timestamps.pickedUpAt` |
| O10 | `shipped` | `delivered` | Admin „Zugestellt“ (`manual`) / Task `markDelivered` am 10. Berliner Kalendertag nach dem Versandtag (`auto`) | – | `timestamps.deliveredAt`, `shipment.deliveredSource` |
| O11 | `paid`, `packed`, `shipped`, `delivered`, `ready_for_pickup`, `picked_up` | `withdrawal_received` | Widerruf zugeordnet (automatisch oder Admin) | – | `statusBeforeWithdrawal`; bei `paid`/`packed` Admin-Hinweis „Nicht mehr versenden“ |
| O12 | `withdrawal_received` | `return_received` | Admin „Ware ist zurück“ | – | `timestamps.returnReceivedAt`, Zustandsnotiz, optional Fotos |
| O13 | `withdrawal_received`, `return_received` | `refunded` | Erstattung (voll) erfolgreich | Stripe-Refund `succeeded` bzw. Vorkasse „Erstattung überwiesen“ | Stornorechnung GS, M09 |
| O14 | `withdrawal_received`, `return_received` | `partially_refunded` | Erstattung (teilweise) erfolgreich | wie O13 | Gutschrift GS, M09 |
| O15 | `paid`, `packed`, `shipped`, `delivered`, `ready_for_pickup`, `picked_up` | `refunded` / `partially_refunded` | Admin „Erstatten“ (Kulanz, Reklamation, Bruch, Storno) | Grund Pflicht: `goodwill` (Kulanz), `complaint` (Reklamation, §7.8), `breakage` (Stück vor dem Versand beschädigt; danach „Ausblenden“ P13) oder `admin_cancellation` (Jutta storniert eine bezahlte Bestellung, meist vor dem Versand; Stück danach wieder verkaufbar, P11) | GS, M09 |
| O16 | `paid`, `packed`, `shipped`, `delivered`, `ready_for_pickup`, `picked_up`, `withdrawal_received`, `return_received`, `partially_refunded` (nur Stripe) | `disputed` | Webhook `charge.dispute.created` | – | `statusBeforeDispute`, A07 |
| O17 | `disputed` | `statusBeforeDispute` | Webhook `charge.dispute.closed` (gewonnen) | – | Notiz |
| O18 | `disputed` | `refunded` | Webhook `charge.dispute.closed` (verloren) | – | Notiz „durch Anfechtung erstattet“, GS |
| O19 | – | `refunded` | System: bezahlt, aber alle Stücke weg (S4) | – | keine RE, Voll-Erstattung, M10, A06 |
| O20 | `withdrawal_received` | `statusBeforeWithdrawal` | Admin „Widerruf ohne Erstattung abschließen“ (§5.4 W5) | Grund Pflicht; kein anderer Widerruf derselben Bestellung ist offen (Status `received`, `goods_returned` oder `partially_refunded`) – sonst bleibt die Bestellung `withdrawal_received` | – |
| O21 | `partially_refunded` | `refunded` | weitere Erstattung erfolgreich (Widerruf, Kulanz, Reklamation, Bruch, Storno) | Σ `refunds[].amountCents` erreicht den Gesamtbetrag (`totalCents`) | Gutschrift GS über den erstatteten Betrag, M09; bei Widerruf W6 |

**Aus `partially_refunded`** führen O21 (weitere Erstattung bis zum vollen Betrag) und O16 (Anfechtung). Ein weiterer
Widerruf zu derselben Bestellung wird trotzdem angenommen und zugeordnet (W1 wird nie blockiert) und ändert den
Bestellstatus nicht; jede weitere Erstattung entsteht als zusätzlicher `refunds[]`-Eintrag mit eigener Gutschrift. Solange
die Summe den Gesamtbetrag nicht erreicht, bleibt die Bestellung `partially_refunded`; erreicht sie ihn, gilt O21
(DATENMODELL DM-06).

Regeln zu Erstattungen:
- **Voll-Widerruf:** Erstattet werden alle Stückpreise **und** die ursprünglichen Versandkosten (Standardversand).
  Rücksendekosten trägt die Kund:in (E-27). **Teil-Widerruf:** Preise der widerrufenen Stücke + Differenz zwischen
  bezahlten Versandkosten und den Versandkosten, die für die behaltenen Stücke angefallen wären. Diese
  kundenfreundliche Regel ist vorläufig, bis Kanzleifrage K-09 beantwortet ist (RECHT R-072); der Erstattungsdialog
  weist darauf hin [Annahme KA-32].
- Jutta kann den Betrag im Dialog **erhöhen** (Kulanz, z. B. Rücksendekosten übernehmen) mit Pflicht-Notiz; nie über den
  noch erstattbaren Betrag hinaus.
- Stripe-Erstattung immer über dasselbe Zahlungsmittel (Refund-API). Vorkasse: Jutta überweist selbst und bestätigt
  „Erstattung überwiesen“ (IBAN der Kund:in erfragt sie per Mail; der Shop speichert keine Kund:innen-IBAN).
- Frist: spätestens 14 Tage nach Eingang des Widerrufs; Zurückhalten, bis die Ware oder ein Nachweis der Rücksendung da
  ist, ist erlaubt (§ 357 BGB). Die Admin-Ansicht zeigt die Frist (§7.10), Job-Erinnerung A13 an Tag 10.
- Stripe-Refund `pending` → Status bleibt, Anzeige „Erstattung läuft“; Abschluss per Webhook.

### 5.4 Widerruf

Status und Felder laut DATENMODELL §6.11 (`WITHDRAWAL_STATUSES`, `WITHDRAWAL_MATCH_STATUSES`):

| Status | Bedeutung |
|---|---|
| `received` | eingegangen; Zuordnung über `order` und `matchStatus` (`auto_matched`, `manually_matched`; ohne Bestellung `needs_manual_match` bzw. `no_order`) |
| `goods_returned` | Ware ist zurück |
| `partially_refunded` | teilweise erstattet |
| `refunded` | voll erstattet |
| `rejected` | abgelehnt – **nur manuell**, Begründung Pflicht (`closeNote`), z. B. Test/Spam oder Frist eindeutig abgelaufen; nie automatisch (R-094); Endzustand |
| `closed` | ohne (weitere) Erstattung abgeschlossen; Grund Pflicht (`closeReason`: `unpaid_order_cancelled`, `duplicate`, `retracted`, `other` – bei `other` zusätzlich `closeNote`); Endzustand |

`refunded`, `rejected` und `closed` sind Endzustände. Eine Markierung „Test/Spam“ (`spam.markedAt`, `spam.reason`, nur mit
Begründung) ist kein Status; sie verkürzt die Aufbewahrung auf 30 Tage (L-08).

| # | Von | Nach | Auslöser | Nebenwirkungen |
|---|---|---|---|---|
| W1 | – | `received` | Formular R26 „Widerruf bestätigen“ | unveränderlicher Datensatz (`receivedAt` Serverzeit, alle Eingaben, `submissionSnapshot`, Sprache; **keine** IP, kein IP-Hash, kein User-Agent, R-093), Nummer `WR-{JJJJ}-{NNNNN}`, `refundDueAt = receivedAt + 14 Tage`, M08 an die angegebene E-Mail, A04 an Jutta; automatische Zuordnung, wenn eine Bestellnummer `PC-…` im Text **und** die E-Mail (ohne Groß/Klein) zu einer Bestellung passen → `auto_matched` und O11 bzw. bei `awaiting_prepayment` O4 (`withdrawn`) + W5; sonst `needs_manual_match` |
| W2 | `received` (nicht zugeordnet) | `received` (zugeordnet, `manually_matched`) | Admin „Bestellung zuordnen“ (Suche nach Nummer, E-Mail, Name) | O11 bzw. O4 |
| W3 | `received` | `goods_returned` | Admin „Ware ist zurück“ | O12 |
| W4 | `received`, `goods_returned` | `refunded` / `partially_refunded` | Erstattung (voll/teilweise) erfolgreich | O13/O14 |
| W5 | `received`, `goods_returned`, `partially_refunded` | `closed` | Admin „Ohne Erstattung abschließen“ (`closeReason` Pflicht) / System bei unbezahlter Vorkasse (`closeReason = unpaid_order_cancelled`) | O20 (falls zugeordnet, nicht storniert und kein anderer Widerruf derselben Bestellung offen) |
| W6 | `partially_refunded` | `refunded` | weitere Erstattung bis zum vollen Betrag erfolgreich | O21 |
| W7 | `received` | `rejected` | Admin „Ablehnen“ (`closeNote` Pflicht) | – |

Die Erklärung selbst (Eingaben, Zeitpunkt) ist nach dem Anlegen **unveränderlich**; Admin-Notizen sind separat.

### 5.5 Anfrage (Auftragsarbeit, E-11)

Status laut DATENMODELL `INQUIRY_STATUSES`:

| Status | DE-Anzeige |
|---|---|
| `new` | neu |
| `in_progress` | in Arbeit |
| `offer_sent` | Angebot geschickt |
| `accepted` | angenommen |
| `declined` | abgelehnt |
| `completed` | erledigt |
| `closed` | geschlossen (ohne Auftrag beendet, z. B. keine Rückmeldung) [Annahme KA-33] |

| Von | Nach | Auslöser |
|---|---|---|
| – | `new` | Formular abgeschickt (M11, A05) |
| `new` | `in_progress`, `offer_sent`, `declined`, `closed` | Admin |
| `in_progress` | `offer_sent`, `declined`, `closed` | Admin |
| `offer_sent` | `accepted`, `declined`, `in_progress`, `closed` | Admin |
| `accepted` | `completed`, `in_progress` | Admin |
| `declined`, `completed`, `closed` | `in_progress` | Admin „Wieder öffnen“ |
| beliebig | gelöscht | Admin „Jetzt löschen“ / Task `retentionCommissionInquiries` (§8.3) |

Jeder Admin-Wechsel und jede Notiz setzt `lastActivityAt` (nur Anzeige; die Löschfrist `deleteAfter` = Eingang + 6 Monate
verschiebt sich dadurch **nicht**, L-10). Angebote und Bezahlung laufen per Mail außerhalb des Shops (E-11).

### 5.6 Tattoo-Inhalte (Kurzfassung, Details §9)

| Objekt | Zustände | Regel |
|---|---|---|
| Flash | `status` = `available` / `claimed` + Schalter `repeatable`, `published` | einmalige Motive werden nach dem Stechen `claimed` und bleiben mit Stempel „vergeben“ sichtbar; wiederholbare sind immer `available` (DB-CHECK) und werden zum Pausieren über `published=false` („Offline nehmen“) ausgeblendet (E-52) |
| Galerie-Eintrag | `published` bei `showsCustomer=true` nur möglich mit `consentGiven=true`, `consentDate` und `consentNote` (E-42) | Ausnahme nur `seed=true` bei wirksamem `SEED_PREVIEW_MODE` (§9.7) |

**AK-5-01** Matrix-Tests für Produkt, Kasse, Bestellung, Widerruf und Anfrage: alle Übergänge aus den Tabellen gelingen, alle anderen werden abgelehnt.
**AK-5-02** Jeder Statuswechsel erzeugt einen Verlaufseintrag mit Auslöser: bei Bestellungen in `orders.statusHistory`, sonst im `audit-log` (§5 Regel 2).

---

## 6. E-Mails

### 6.1 Grundregeln

| Thema | Regel |
|---|---|
| Versand | über den Mail-Adapter (§1.5); Produktion Lettermint SMTP (E-92). IONOS-Postfach bleibt unverändert (E-95). |
| Absender | `MAIL_FROM` (Standard `Planet Claire <shop@planetclairetattoos.com>`) [Annahme, Anhang A], Antwortadresse `MAIL_REPLY_TO` (Standard `jutta@planetclairetattoos.com`) |
| Sprache | Kund:innen-Mails in der Sprache der Bestellung bzw. des Formulars; Admin-Mails immer Deutsch |
| Format | HTML (einspaltig, ≤ 600 px, Design gemäß DESIGN) **und** Textfassung; Bilder nur eingebettet (CID): Coco-Vignette, EPC-QR-Code. **Keine** externen Bilder, keine Tracking-Pixel, keine Klick-Tracking-Links. |
| Fuß jeder Kund:innen-Mail | Anbieterkennung aus `settings.business` (Name, Anschrift, E-Mail; die Telefonnummer nur in der Bestellbestätigung M01/M02, R-021), Links auf Impressum und Datenschutz, Link Bestellstatus (bei Bestell-Mails), Link „Vertrag widerrufen“ (bei Bestell-Mails), keine Werbung (keine Produktempfehlungen, Rabattcodes, Social-Icons, „Folge mir“), **kein** Link/Text zur EU-OS-Plattform (R-080) |
| Zuverlässigkeit | Mails werden in derselben Transaktion wie das auslösende Ereignis in eine Ausgangs-Warteschlange geschrieben (Outbox: `email-log`-Zeile + Task `sendEmail`, kein Versand bei Rollback) und direkt danach bzw. vom Task `sendEmail` versendet; Wiederholung mit Backoff (§8.2). Mehrfach-Auslösen desselben Ereignisses erzeugt keine zweite Mail (Idempotenz-Schlüssel = Mail-Typ + Objekt-ID + Ereignis). |
| Protokoll | Jede Mail wird im `email-log` protokolliert (Vorlagen-Schlüssel, Empfänger, Betreff, Zeitpunkt, Anbieter-Nachrichten-ID, Status `queued|sent|failed|suppressed`, Anhänge-Namen und -Prüfsummen) – Nachweis des Zugangs; sichtbar an der Bestellung/Anfrage/Widerruf. Aufbewahrung wie das Bezugsobjekt, ohne Bezug 90 Tage (L-12). Empfänger unter `example.com`, `example.org`, `example.net`, `*.invalid`, `*.test` werden in allen Umgebungen unterdrückt (`suppressed`). |
| Pflegbare Textbausteine | Grußformel und Signatur, Abhol-Vorlage, Antwortzeit-Satz der Anfrage-Bestätigung (Einstellungen → Mail-Bausteine). Alle Pflichtinhalte sind im Code fest und nicht abschaltbar. |
| Erneut senden | Admin kann M01, M02, M05, M06, M07 an der Bestellung erneut senden (Bestätigungsdialog); M08 nur als Kopie an Jutta |
| Schlüssel | Die IDs M01…/A01… sind Anzeige- und Referenznummern; im Code gilt je Zeile der Vorlagen-Schlüssel aus DATENMODELL `EMAIL_TEMPLATES`. |
| Nur Vorlagen zum Öffnen | Rückfragen ohne Rechtspflicht (Fotos anfordern bei Bruch, Bitte um Bankverbindung für eine Vorkasse-Erstattung) sind `mailto:`-Vorlagen der Verwaltung ohne Schlüssel und laufen nicht über die Outbox (R-084). |
| Tests | Jede Mail hat Snapshot-Tests DE und EN (HTML + Text) und einen Test auf Pflichtinhalte (§6.3). |

### 6.2 Kund:innen-Mails

| ID | Schlüssel | Auslöser | Empfänger | Betreff DE | Betreff EN | Anhänge |
|---|---|---|---|---|---|---|
| M01 | `order_confirmation` | O1 (Stripe bezahlt) | Kund:in | Danke! Deine Bestellung PC-2026-00017 | Thank you! Your order PC-2026-00017 | Rechnung RE (PDF), `AGB_v{n}.pdf`, `Widerrufsbelehrung-und-Formular_v{n}.pdf`; bei EN-Bestellung zusätzlich die vorhandenen EN-PDFs |
| M02 | `prepayment_instructions` | O2 (Vorkasse bestellt) | Kund:in | Deine Bestellung PC-2026-00017 – bitte überweise bis 01.10.2026 | Your order PC-2026-00017 – please transfer by 1 Oct 2026 | `AGB_v{n}.pdf`, `Widerrufsbelehrung-und-Formular_v{n}.pdf` (EN wie M01); EPC-QR eingebettet |
| M03 | `prepayment_reminder` | Task `prepaymentReminders` zum Zeitpunkt `prepayment.reminderDueAt` ohne Zahlung | Kund:in | Erinnerung: Überweisung für PC-2026-00017 bis 01.10.2026 | Reminder: payment for PC-2026-00017 due 1 Oct 2026 | EPC-QR eingebettet |
| M04 | `prepayment_cancelled` | O4 durch Task oder Admin (nicht bei Widerruf) | Kund:in | Deine Bestellung PC-2026-00017 wurde storniert | Your order PC-2026-00017 has been cancelled | – |
| M05 | `prepayment_received` | O3, O5 | Kund:in | Zahlung erhalten – Bestellung PC-2026-00017 | Payment received – order PC-2026-00017 | Rechnung RE (PDF) |
| M06 | `order_shipped` | O7 | Kund:in | Dein Paket ist unterwegs – PC-2026-00017 | Your parcel is on its way – PC-2026-00017 | – |
| M07 | `pickup_ready` | O8 | Kund:in | Abholbereit: Bestellung PC-2026-00017 | Ready for pickup: order PC-2026-00017 | – |
| M08 | `withdrawal_receipt` | W1 (sofort nach dem Commit) | eingegebene E-Mail; Kopie an Jutta (A04) | Eingangsbestätigung deines Widerrufs WR-2026-00003 vom 26.09.2026, 14:03 Uhr | Confirmation of receipt of your withdrawal WR-2026-00003 (26 Sep 2026, 14:03) | – |
| M09 | `refund_confirmation` | O13, O14, O15, O21 sowie weitere Teil-Erstattungen aus `partially_refunded` ohne Statuswechsel (nicht bei O18 – dort erstattet die Bank der Kund:in) | Kund:in | Erstattung zu PC-2026-00017: 45,00 € | Refund for order PC-2026-00017: €45.00 | Stornorechnung/Gutschrift GS (PDF) |
| M10 | `oversold_apology` | O19 (S4, alle Stücke weg) | Kund:in | Leider schon weg – dein Geld kommt zurück (PC-2026-00017) | Sorry, already gone – your money is on its way back (PC-2026-00017) | – |
| M11 | `inquiry_receipt` | Anfrage abgeschickt (§10) | Anfragende:r | Deine Anfrage AA-2026-0007 ist angekommen | Your request AA-2026-0007 has arrived | – |
| M12 | `complaint_repair_choice` | Admin „Reklamation beantworten“ an der Reklamationsakte (§7.8, R-111) | Kund:in | Deine Reklamation zu PC-2026-00017: Reparatur oder Ersatz | Your complaint about order PC-2026-00017: repair or replacement | – |
| M13 | `dispute_vsbg` | Admin „Streitbeilegungshinweis senden“ bei ungelöstem Streit (§7.8, R-112) | Kund:in | Deine Reklamation zu PC-2026-00017: Hinweis zur Streitbeilegung | Your complaint about order PC-2026-00017: information on dispute resolution | – |
| M14 | `privacy_access_response` | Admin „Antwort senden“ bei Auskunft/Übertragbarkeit (§7.15, R-150) | anfragende Person | Deine Datenschutz-Anfrage DS-2026-0001: Auskunft | Your data protection request DS-2026-0001: access | – (Download-Link auf den privaten Export) |
| M15 | `privacy_erasure_response` | Admin „Antwort senden“ bei Löschung/Einschränkung (§7.15, R-151) | anfragende Person | Deine Datenschutz-Anfrage DS-2026-0001: Löschung | Your data protection request DS-2026-0001: erasure | – |
| M16 | `consent_withdrawal_confirmation` | Admin „Einwilligung widerrufen“ (DHL-Weitergabe, Portfolio-Einwilligung; R-152) | betroffene Person | Dein Widerruf der Einwilligung ist eingetragen | Your withdrawal of consent has been recorded | – |

Alle Mails der Tabelle laufen über die Outbox und stehen im `email-log` (§6.1). M12 und M13 nennen Bestellnummer, Stücke
und Reklamationsdatum aus der Reklamationsakte (Collection `complaints`).

### 6.3 Pflichtinhalte je Mail

**M01 Bestell- und Vertragsbestätigung** (§§ 312i, 312f BGB; R-081; `recht-shop.md` „E-MAIL 1“), spätestens 5 Minuten
nach dem Zahlungs-Webhook (Outbox):
1. Anrede, Dank, Bestellnummer, Datum und Uhrzeit der Bestellung (Europe/Berlin).
2. Alle Positionen: `Nr. 017`, Titel, wesentliche Eigenschaften (wie Kassen-Übersicht §4.5), Preis.
3. Versandart und Versandkosten bzw. Abholung; Gesamtpreis; Steuerhinweis (Kleinunternehmerin: „Gemäß § 19 UStG wird keine
   Umsatzsteuer berechnet.“).
4. Zahlart und „bezahlt am“.
5. Lieferadresse und Rechnungsadresse; Lieferzeit bzw. „Ich melde mich wegen der Abholung“.
6. Hinweis auf die Anhänge: Rechnung, AGB (`AGB_v{n}.pdf`) und Widerrufsbelehrung mit Muster-Widerrufsformular
   (`Widerrufsbelehrung-und-Formular_v{n}.pdf`) **in der Fassung vom {Datum der Version}** (Versionen aus
   `orders.legalTextVersions`); bei EN-Bestellung zusätzlich die vorhandenen EN-PDFs.
7. Kurzhinweis Widerrufsrecht mit Link auf R26 und Rücksendekosten-Hinweis (E-27).
8. Hinweis auf das gesetzliche Mängelhaftungsrecht mit der harmonisierten Mitteilung (R-049).
9. Bei abweichender Beschaffenheit: die ausdrücklich vereinbarte Abweichung je Stück (R-048).
10. Nur bei erteilter DHL-Einwilligung (`carrierEmailConsent`): Status der Einwilligung und wie man sie widerruft (R-101).
11. Bei Teil-Nichtverfügbarkeit (S4): Block „Leider schon weg: Nr. … – erstattet: … €“.
12. Link zum Bestellstatus, Link zur Datenschutzerklärung, Kontakt, Anbieterkennung (nur in M01/M02 mit Telefonnummer
    `settings.business.phone`, R-021). Keine Werbung, kein OS-Link.

Nachweis im `email-log` wie R-081 (Vorlagen-Version, Anhänge mit SHA-256, `bodySha256` mit festem Platzhalter an der
Stelle des Status-Tokens).

**M02 Vorkasse-Bestellung** (ebenfalls Bestellbestätigung nach R-081, direkt nach dem Klick): wie M01 Punkte 1–3, 5–10, 12,
statt „bezahlt“ der Block **Bankverbindung** aus `settings.payment` (Kontoinhaberin, IBAN, BIC), Betrag,
Verwendungszweck (= Bestellnummer), **„bitte bis {Datum}“** (`prepayment.dueAt`), EPC-QR-Code; Satz „Dein Stück ist bis
{Datum} für dich reserviert. Kommt bis dahin keine Zahlung an, wird die Bestellung automatisch storniert.“ Keine Rechnung.

**M03 Erinnerung:** Bestellnummer, offener Betrag, Bankverbindung und EPC-QR erneut, Frist-Datum, „Hast du schon überwiesen?
Dann ist alles gut – Überweisungen brauchen manchmal 1–2 Tage.“

**M04 Storniert:** Bestellnummer, Grund („keine Zahlung eingegangen“ bzw. Text von Jutta), „Falls du doch schon überwiesen
hast, melde dich – dann überweise ich dir das Geld zurück.“

**M05 Zahlung erhalten:** Bestellnummer, Betrag, nächster Schritt (packen/Abholung), Rechnung im Anhang.

**M06 Versand** (R-082): versandte Positionen, Versanddienst, Sendungsnummer und Link zur Sendungsverfolgung (Vorlage aus
`settings.shipping.trackingUrlTemplates`), übliche Laufzeit („meist 1–3 Werktage“), Baustein `email.shipping.damageNotice`
(„Kommt etwas beschädigt an? Schick mir bitte möglichst schnell Fotos von Paket und Inhalt, damit ich es bei DHL
reklamieren kann. Deine gesetzlichen Rechte bleiben davon unberührt.“), Links Bestellstatus und R26. Bei Versandklasse
`brief` ohne Sendungsnummer (vorläufig bis Kanzleifrage K-40): kein Verfolgungslink, stattdessen Versanddatum und
Versandart.

**M07 Abholbereit** (R-083): Positionen, der von Jutta bestätigte Abholtext (Baustein `email.pickup.ready` mit Ort, Zeiten,
Absprache aus `settings.pickup.instructions`), „Antworte einfach auf diese Mail“, Link Bestellstatus.

**M08 Eingangsbestätigung Widerruf** (§ 356a Abs. 4 BGB, R-093, `recht-shop.md` „E-MAIL 3“):
1. **Vollständiger Inhalt der Erklärung:** Name, Angaben zum Vertrag, ggf. genannte Stücke, ggf. Grund, E-Mail.
2. **Datum und Uhrzeit des Eingangs** (Europe/Berlin mit Zeitzone, z. B. „12.10.2026, 14:03 Uhr (MESZ)“), Vorgangsnummer
   `WR-2026-00003`.
3. Baustein `withdrawal.receiptNotice`: „Mit dieser Mail bestätigen wir nur den Eingang deines Widerrufs.“
4. Nächste Schritte (Baustein `withdrawal.returnInfo`): Rücksendeadresse (`settings.business.returnAddress`, leer =
   Geschäftsadresse), „Die Kosten der Rücksendung trägst du“ (E-27), Erstattung über dasselbe Zahlungsmittel spätestens
   14 Tage nach Eingang, ggf. erst nach Eingang der Ware.
5. Bei unbezahlter Vorkasse-Bestellung stattdessen: „Deine Bestellung ist damit storniert. Bitte nichts überweisen.“

Versand sofort nach dem Commit; scheitert er, wiederholt `sendEmail` ihn im Abstand von höchstens 5 Minuten bis 24 Stunden
nach Eingang. Nach dem 2. Fehlversuch geht A12 an Jutta, und erneut, wenn nach 24 Stunden noch kein Versand gelang (dann
Bestätigung manuell senden, §8.2).

**M09 Erstattung:** Bestellnummer, erstatteter Betrag, Aufstellung (Stücke, Versand), Zahlungsweg („auf deine Karte/dein
PayPal-Konto – sichtbar meist nach 5–10 Werktagen“ bzw. „per Überweisung am {Datum}“), Beleg GS im Anhang.

**M10 Leider schon weg:** Entschuldigung, Erklärung („Jemand war ein paar Sekunden schneller“), voller Betrag erstattet über
dasselbe Zahlungsmittel, Dauer 5–10 Werktage, Link zum Shop. Keine Rechnung, kein Rabattcode (§13).

**M11 Anfrage-Bestätigung:** Referenz, Zusammenfassung (Gegenstand, Idee-Text, Wunschzeitraum, Budget, **Anzahl** der Bilder
– nie die Bilder selbst), Antwortzeit-Satz (Baustein, Standard „Ich melde mich meist innerhalb einer Woche.“ [Annahme]),
„Angebot und Bezahlung laufen per Mail, nicht über den Shop“, Datenschutz-Kurzinfo „Deine Anfrage und Bilder werden
spätestens 6 Monate nach Eingang gelöscht“ mit Link R22.

**M12 Reklamation: Reparatur oder Ersatz** (R-111, für Kaufverträge ab 31.07.2026): Bestellnummer, betroffene Stücke,
Eingang der Reklamation, Baustein `complaint.repairChoice` (Wahlrecht Reparatur/Ersatzlieferung, bei Unikaten ist Ersatz in
der Regel unmöglich, Verlängerung der Gewährleistung um 12 Monate bei Reparatur), „Antworte einfach auf diese Mail“. Der
Versandzeitpunkt wird in der Reklamationsakte gespeichert, die Wahl der Kund:in trägt Jutta dort ein.

**M13 Hinweis zur Streitbeilegung** (R-112): Bestellnummer, Baustein `dispute.vsbg37` (Universalschlichtungsstelle des
Bundes mit Anschrift und URL; Arbeitsfassung „nicht bereit und nicht verpflichtet“, bis Kanzleifrage K-22). Kein Link oder
Text zur EU-OS-Plattform.

**M14 Antwort Auskunft** (R-150): Referenz `DS-…`, Baustein `privacyRequest.accessResponse`, Link auf den privaten
ZIP-Export (gültig bis zur Löschung 30 Tage nach Versand, L-17).

**M15 Antwort Löschung/Einschränkung** (R-151): Referenz `DS-…`, Baustein `privacyRequest.erasureResponse`, je
Datenbereich „gelöscht“ bzw. „eingeschränkt bis {Datum} wegen gesetzlicher Aufbewahrung“.

**M16 Bestätigung Einwilligungswiderruf** (R-152, LOESCHKONZEPT §5.10): welche Einwilligung (DHL-Weitergabe der E-Mail
bzw. Portfolio-Einwilligung), Zeitpunkt des Widerrufs, Wirkung ab sofort.

### 6.4 Admin-Benachrichtigungen

Empfänger: Einstellung `settings.adminNotificationEmail`, Startwert und Rückfall `ADMIN_NOTIFY_EMAIL` (Standard
**jutta@planetclairetattoos.com**, Konzeptseite „Benachrichtigung“). Immer Deutsch, kurz, mit Direktlink in die passende
Admin-Ansicht. Keine Kund:innen-Freitexte, keine Anfrage-Bilder.

| ID | Schlüssel | Auslöser | Betreff | Inhalt |
|---|---|---|---|---|
| A01 | `admin_order_placed` | O1 | Neue Bestellung PC-2026-00017 – 53,90 € – Versand | Positionen (Nr., Titel), Lieferart, Name und Ort, Zahlart, Hinweise (Keramik, > 500 €), Link „Zu packen“ bzw. „Abholung“ |
| A02 | `admin_order_placed` | O2 | Vorkasse offen: PC-2026-00017 – 53,90 € bis 01.10. | Positionen, Frist, Link „Vorkasse offen“ |
| A03 | `admin_prepayment_cancelled` | O4 durch Task | Vorkasse storniert: PC-2026-00017 (keine Zahlung) | Positionen wieder online |
| A04 | `admin_withdrawal_received` | W1 | Widerruf eingegangen: WR-2026-00003 (PC-2026-00017 / nicht zugeordnet) | Kopie des M08-Inhalts, Frist „erstatten bis {Datum}“, Link „Widerrufe“ |
| A05 | `admin_inquiry_received` | Anfrage | Neue Anfrage AA-2026-0007 (Cap) | Referenz, Gegenstand, Anzahl Bilder, Link „Anfragen“ – **ohne** Name, E-Mail, Freitext und Bilder |
| A06 | `admin_oversold` | S4 | ACHTUNG: Nr. 017 doppelt bezahlt – automatisch erstattet | Bestellungen, erstatteter Betrag, Erstattungsstatus |
| A07 | `admin_dispute_opened` | O16 | ACHTUNG: Zahlung angefochten – PC-2026-00017 | Betrag, Grund laut Stripe, Antwortfrist, Hinweis „Belege (Sendungsnummer, Rechnung, Packfotos) im Stripe-Dashboard einreichen“ |
| A08 | `admin_refund_failed` | Refund `failed` (Webhook `refund.failed`) | ACHTUNG: Erstattung fehlgeschlagen – PC-2026-00017 | Betrag, Fehlermeldung, Link zur Bestellung |
| A09 | `admin_revenue_guard` | Task `revenueGuardCheck` | Umsatz-Wächter: {Schwelle} erreicht | Stand, Schwelle, Erklärung, Handlungsempfehlung (§8.4) |
| A10 | `admin_legal_review_due` | Task `legalReviewReminder` | Jährliche Erinnerung: Rechtstexte prüfen lassen | betroffene Texte mit Datum, Link „Texte“ |
| A11 | `admin_monthly_close` | Task `monthlyClose` | Monatsexport {Monat JJJJ} ist bereit | Summen, Link „Export“; Hinweis, falls manuelle Monatssummen (Tattoo, Flohmarkt, Auftragsarbeiten, Sonstiges) fehlen |
| A12 | `admin_alert` | technischer Fehler (Zahlung, Bestellung, Mail M08 ab dem 2. Fehlversuch und nach 24 h, Prüfsumme, Job); Zahlung zu einer beendeten Kasse bzw. Karte/PayPal bezahlt trotz Vorkasse (§4.11 S16/S17); Konformitätserklärung widerrufen – Stücke offline (§5.1 P3) | Technisches Problem: {Kurzbeschreibung} | Was betroffen ist, was automatisch passiert ist, was zu tun ist; höchstens 1 Mail je Fehlerart und Stunde (Ausnahme: beide M08-Alarme und jede Meldung zu S16/S17 gehen immer, weil Geld zu erstatten ist) |
| A13 | `admin_withdrawal_deadline` | Task `withdrawalDeadlines` | Erstattungsfrist läuft ab: WR-2026-00003 (noch 4 Tage) | Bestellung, Frist, Link |
| A14 | `admin_privacy_request_due` | Task `privacyRequestsDeadlineReminder` (7 Tage und 1 Tag vor Frist, R-153) | Datenschutz-Anfrage DS-2026-0001: Frist endet am {Datum} | Art der Anfrage, Frist, Link „Datenschutz-Anfragen“ |
| A15 | `admin_legal_hold_review` | Task `legalHoldReview` (Aufbewahrungssperren älter als 6 Monate) | Aufbewahrungssperre prüfen: {Anzahl} Vorgänge | betroffene Vorgänge mit Grund und Datum, Link |
| A16 | `admin_compliance_docs_review` | Task `complianceDocsReview` (L-24, nur Erinnerung) | Produktsicherheits-Unterlagen prüfen | Unterlagen (Konformitätserklärungen, Prüfberichte, Lieferantenerklärungen), deren 10-Jahres-Frist nach dem letzten betroffenen Stück abläuft; Link |
| A17 | `admin_password_reset` | „Passwort vergessen“ im Login (Payload) | Passwort zurücksetzen | Link zum Zurücksetzen (zeitlich begrenzt) |

**AK-6-01** Für jede Mail M01–M16 und A01–A17 existiert ein Renderer mit dem Schlüssel laut DATENMODELL `EMAIL_TEMPLATES`; Snapshot-Tests DE/EN (Kund:innen) bzw. DE (Admin) sind grün.
**AK-6-02** M01 einer DE-Bestellung mit Karte/PayPal enthält alle Punkte aus §6.3 und genau drei PDF-Anhänge (Rechnung, `AGB_v{n}.pdf`, `Widerrufsbelehrung-und-Formular_v{n}.pdf`) in der Version der Bestellung; bei einer EN-Bestellung kommen die vorhandenen EN-PDFs hinzu.
**AK-6-03** Keine Mail enthält `ec.europa.eu/consumers/odr`, externe Bild-URLs oder Tracking-Parameter.
**AK-6-04** M08 wird auch bei unbekannter Bestellnummer versendet und enthält Datum und Uhrzeit des Eingangs.

---

## 7. Verwaltung

### 7.1 Grundsätze

| Thema | Regel |
|---|---|
| Technik | Payload-Admin mit **eigenen Handy-Ansichten** (Custom Views) plus den Standard-Collection-Ansichten (E-93) |
| Pfad | **nicht** `/admin`; konfigurierbar über `ADMIN_ROUTE` (ARCHITEKTUR §5.2), Entwicklungs-Standard `/werkstatt`; der Produktionswert wird in P11 festgelegt und steht nicht in öffentlich ausgelieferten Dateien |
| Konten | genau ein Konto, Rolle `owner` (E-03); keine Selbstregistrierung; Anlage per CLI (z. B. `pnpm admin:create`), Passwort ≥ 12 Zeichen |
| Login-Schutz | Sperre nach 5 Fehlversuchen für 15 Minuten; zusätzlich Rate-Limit je IP-Hash; angemeldet bleiben 7 Tage [Annahme]; Abmelden-Knopf |
| Sprache | nur Deutsch, einfache Wörter, keine Technikbegriffe („online stellen“ statt „publish“) |
| Layout | Mobile-first (390 px), gleichwertig am Laptop (E-03); große Tipp-Flächen (≥ 44 px); ruhig, keine Tuschelinien-Animation (E-78) |
| Bestätigungen | Aktionen, die eine Mail an Kund:innen senden, Geld bewegen, Bestand ändern oder Daten löschen, verlangen einen Dialog, der die Folge nennt (z. B. „Die Kundin bekommt eine Versandmail.“). Doppeltes Tippen löst nichts doppelt aus. |
| Rückmeldung | jede Aktion zeigt Erfolg/Fehler als Text; Fehler mit Handlungsvorschlag |
| PWA | Web-App-Manifest nur für den Admin-Bereich: Name „Planet Claire Werkstatt“, Kurzname „Werkstatt“, `start_url` = Ansicht „Heute“, `scope` = Admin-Pfad, `display: standalone`, Icons 192/512 (auch maskable) und Apple-Touch-Icon 180; minimaler Service Worker nur im Admin-Scope, **ohne** Zwischenspeichern von Daten (nur für die Installierbarkeit); keine Push-Nachrichten (Benachrichtigung per Mail) |
| Fremdcode | keine externen Skripte im Admin; Barcode-Leser: natives `BarcodeDetector`, sonst eine selbst gehostete JS-Bibliothek, nur in der Versand-Ansicht geladen |
| Robots | alle Admin-Antworten `X-Robots-Tag: noindex, nofollow` |

### 7.2 Navigation

- **Handy:** Leiste unten mit 4 Einträgen: **Heute** · **Neues Stück** · **Packen** · **Mehr**. „Mehr“ listet alle Ansichten
  aus §7.3–7.15 und „Alle Daten“ (Standard-Payload).
- **Laptop:** Seitenleiste mit allen Ansichten; Standard-Payload-Navigation unter „Alle Daten“.
- Jede Ansicht hat eine eigene URL unter dem Admin-Pfad (Vorschlag: `/heute`, `/neues-stueck`, `/stuecke`, `/packen`,
  `/vorkasse`, `/versendet`, `/abholung`, `/widerrufe`, `/anfragen`, `/tattoo`, `/texte`, `/einstellungen`, `/export`;
  die Datenschutz-Werkzeuge aus §7.15 liegen unter `/export`).

### 7.3 Heute (Start-Ansicht)

- **Kacheln mit Zahl und Link:** Zu packen · Vorkasse offen (davon heute fällig) · Abholung · Widerrufe offen (nächste Frist)
  · Neue Anfragen.
- **Hinweise** (rot/gelb, jeweils mit Link): Umsatz-Wächter-Stufe (§8.4); Rechtstexte-Prüfung fällig (R-014); offene
  Datenschutz-Anfragen mit nächster Frist (R-153); Aufbewahrungssperren zur Prüfung; Stücke und Bestellungen mit
  `adminAttention` (z. B. Konformitätserklärung widerrufen, abweichender Zahlbetrag); fehlgeschlagene Mails;
  fehlgeschlagene Jobs; Anfechtungen; Abholungen > 14 Tage; manuelle Monatssummen fehlen; Kostenwarnung, sobald der
  letzte Monatswert in `settings.costs.monthlyEntries` die Schwelle `settings.costs.warningThresholdCents` erreicht
  (≥, Standard 30 €, E-05); **Beispieldaten vorhanden**
  (Anzahl, Link zu Einstellungen → Beispieldaten); Startklar-Prüfung nicht grün (nur Anzeige).
- **Letzte 5 Bestellungen** (Nummer, Betrag, Status).
- Schnellknopf „Neues Stück“.

### 7.4 Neues Stück / Stück bearbeiten

Feldnamen, Grenzen und Kategorie-Vorbelegungen laut DATENMODELL §6.6 (`products`); die Handy-Ansicht nutzt dieselben
Felder und dieselbe Validierung wie das Standardformular.

**Felder für alle Kategorien:**

| Feld (Label) | Name | Pflicht zum Online-Stellen | Regel / Hilfe |
|---|---|---|---|
| Fotos | `images` (→ `media`) | 1–12 (ab 1 Pflicht; unter 2 Warnung „Mindestens 2 Fotos empfohlen“) | Kamera oder Galerie; Dateiauswahl nur JPEG/PNG/WebP (iOS wandelt HEIC dann selbst um); Verkleinerung im Browser auf max. 2560 px lange Kante; Server entfernt EXIF/GPS und dreht richtig (Konzeptseite „Fotos“); erstes Foto = Titelbild; Reihenfolge änderbar; Fokuspunkt setzbar; keine `restricted`-Bilder |
| Bildbeschreibung DE je Foto | `media.alt` (DE) | ja | 5–250 Zeichen; Knopf „Vorschlag“ füllt `„{Kategorie} {Titel} – Ansicht {n}“` |
| Bildbeschreibung EN je Foto | `media.alt` (EN) | ja | per „Vorschlag“ oder „Übersetzen“ (R-042, R-191) |
| Objektnummer | `itemNumber` | ja | vorbelegt über `GET /api/products/next-item-number` (höchste Nummer ohne Beispieldaten + 1; der Bereich 901–999 ist gesperrt, solange Beispieldaten existieren, §11.2); Live-Prüfung „✓ frei“ bzw. „✗ vergeben: Nr. 017 Schale mit Hund“; eindeutig (UNIQUE); nach erster Veröffentlichung gesperrt (E-12) |
| Kategorie | `category` | ja | eine der 6 Kategorien (§2.2); setzt Standard-Versandklasse und Vorbelegungen; änderbar nur im Entwurf |
| Titel DE | `title` (DE) | ja | 2–80 Zeichen |
| Beschreibung DE | `description` (DE) | ja | mehrzeiliges Textfeld, Absätze per Leerzeile, 20–4000 Zeichen |
| „Jutta sagt“ | `juttaSays` | nein | ≤ 280 Zeichen |
| „Übersetzen → EN“ | Knopf | – | füllt alle EN-Felder (Titel, Beschreibung, „Jutta sagt“, Material, Maß-Zusatz, Größe, Zustand, Faser-Freitext, Pflege, Metallteile, Warnhinweise, Abweichung, Alt-Texte) per DeepL/Mock (E-61); vorhandene geprüfte EN-Texte nur nach Rückfrage überschreiben; Ergebnis bleibt editierbar |
| Titel/Beschreibung EN | `title` (EN), `description` (EN) | nein (Badge „EN fehlt“) | EN-Seiten fallen auf DE zurück |
| Preis | `priceCents` | ja | Eingabe „45“ oder „45,50“; 1,00–10.000,00 €; gesperrt bei `reserved`/`sold` |
| Versandklasse | `shippingClass` | ja | vorbelegt aus Kategorie (§2.2); `nur_abholung` möglich; Warnung, wenn Keramik nicht `keramik`/`nur_abholung` |
| Maße | `dimensions.widthCm`, `heightCm`, `depthCm`, `diameterCm`, `dimensions.note` | ja, mindestens ein Maß (außer `textil`/`cap`) | Anzeige z. B. „Ø 14 cm, H 6 cm“ |
| Gewicht | `weightGrams` | ja | ohne Verpackung, 1–31 500 g |
| Material | `materials` (DE/EN) | ja | z. B. „Steinzeug, Unterglasurfarbe, Transparentglasur“, „Aquarell auf Papier 300 g“ |
| Warn- und Sicherheitshinweise | `safetyWarnings` (DE/EN) | ja | vorbelegt aus `settings.safetyTemplates` je Kategorie, änderbar; Pflicht-Bausteine ergänzt das System (unten) |
| Eigene Figur | `ownDesignConfirmed` | ja (Häkchen, nicht vorausgewählt) | Text „Das Motiv zeigt nur eigene Figuren – keine geschützten fremden Figuren, Marken, Logos oder Schriftzüge Dritter“ (E-18, R-047) |
| Abweichende Beschaffenheit | `deviationDecision` (Textil/Cap Pflicht: „Geprüft: keine Abweichung“ \| „Abweichung beschrieben“), `hasDeviation`, `deviationDescription` (DE/EN, 10–300) | bei `textil`/`cap` ausdrückliche Entscheidung Pflicht (R-048); sonst optional | bei Abweichung Hinweis auf Produktseite + eigene Bestätigung in der Kasse (§4.4) |
| Nach Verkauf im Archiv zeigen | `showInArchiveAfterSale` | – | Standard an (E-14), jederzeit änderbar |
| Steuerkategorie | `vatCategory`, `vatReducedReason` | – | Standard `standard`; `reduced_art` nur bei `zeichnung` mit Begründung (§4.14); nur bei Regelbesteuerung wirksam |
| Lagerort, interne Notiz | `storageLocation`, `internalNote` | – | nur Verwaltung; Lagerort steht auf dem Packzettel |

**Zusätzliche Pflichtfelder je Kategorie:**

| Kategorie | Feld | Name | Regel |
|---|---|---|---|
| `keramik` | Lebensmittelkontakt | `foodContact` | `deko` (Standard, E-15) \| `lebensmittelecht`; bei `deko` zeigen Produktseite, Übersicht, Bestätigung und Beileger den Baustein `product.ceramicsDecorative` (R-044) |
| | Konformitätserklärungen | `conformityDeclarations` | Pflicht bei `lebensmittelecht`; ≥ 1 verknüpfte Erklärung, **jede** `active` und gültig, sonst ist `lebensmittelecht` schon beim Speichern abgelehnt (E-15, R-044); Widerruf einer Erklärung nimmt betroffene freie Stücke offline (§5.1 P3) |
| `textil`, `cap` | Faserzusammensetzung | `fiberComposition[]` = {`component`, `fiber` (amtliche Bezeichnungen, DE/EN), `percent`} | immer Pflicht, auch bei fehlendem Etikett; je Komponente Summe genau 100 % (E-16, R-043) |
| | Etikett fehlt | `labelMissing` + `fiberFreeText` (DE/EN) | bei `labelMissing` Faserangabe „nach bestem Wissen“ **und** Freitext Pflicht; Anzeige mit Hinweis „Etikett fehlt“ |
| | Größe | `sizeLabel` | Pflicht, z. B. „M“, „Einheitsgröße, verstellbar 54–60 cm“ |
| | Zustand | `condition` | Pflicht: `like_new` (wie neu) \| `very_good` (sehr gut) \| `good` (gut) \| `worn` (deutliche Gebrauchsspuren) + optional `conditionNote` |
| | Second-Hand/Vintage | `isSecondHand` | Standard an (E-16), Anzeige „Second-Hand/Vintage“ |
| | Pflegehinweise | `careInstructions` (DE/EN) | optional, vorbelegt aus `settings.careTemplates` |
| | Fremdes Hersteller-Logo sichtbar | `blankBrandVisible` | Pflichtangabe, Standard aus; angehakt sperrt die Veröffentlichung, solange `settings.legal.allowVisibleBlankBrands = false` (Standard, R-047) |
| `schmuck` | Material der Metallteile | `metalPartsMaterial` (DE/EN) | Pflicht, z. B. „Edelstahl 316L“ |
| | Nickel-Nachweis | `nickelFreeConfirmed` + `nickelEvidence` | Häkchen „Metallteile nickelfrei, Nachweis liegt vor“ **und** hochgeladener Nachweis (privat) Pflicht (E-17, R-045) |
| | Bleifreie Glasur | `leadFreeGlazeConfirmed` | Häkchen „Glasur bleifrei laut Hersteller-Datenblatt“ Pflicht (R-045) |
| | Kleinteile-Warnung | `smallPartsWarning` | immer an; Baustein `product.jewelrySmallParts` wird angefügt und ist nicht entfernbar |
| `zeichnung` | Gerahmt | `framed`, `frameHasGlass` | `framed` Pflichtangabe; bei Glasrahmen fügt das System den Baustein `product.glassFrame` an (R-046); Technik und Papier stehen in `materials` |

**Vorbelegte Warn- und Sicherheitshinweise:** je Kategorie ein Text aus `settings.safetyTemplates` (DE/EN, Startwerte
SEED-SPEC §3.2; RECHT darf ändern). Die Pflicht-Hinweise ergänzt das System automatisch (R-040): `product.jewelrySmallParts`
und `product.glassFrame` werden in `safetyWarnings` eingefügt und sind nicht entfernbar, `product.ceramicsDecorative` wird
bei `deko` zusätzlich angezeigt. „Keine besonderen Warnhinweise“ (`product.noSpecialWarnings`) ist außer bei Keramik und
Schmuck wählbar.

**Veröffentlichungsprüfung** („Online stellen“, P2/P11 in §5.1) – serverseitig (`validateForPublish`, Regeltabelle
DATENMODELL §6.6.6, auch vollständige Herstellerangaben in `settings.business`); bei Fehlern Liste „Das fehlt noch:“ mit
Sprung zum Feld. Ohne sie lässt sich nichts veröffentlichen (Konzeptseite „Vom Foto zum Verkauf“).

**Knöpfe:** „Als Entwurf speichern“ · „Vorschau“ (Produktseite im Entwurfsmodus, nur für Admin) · **„Online stellen“** →
Erfolgsseite mit „Link kopieren“ (kanonische DE-URL), „Kurzlink kopieren“ (`planetclairetattoos.com/nr/17`) und
„Noch ein Stück“.

**AK-7-01** Ein Keramik-Stück mit `lebensmittelecht` ohne aktive Konformitätserklärung lässt sich schon als Entwurf nicht speichern; ein Schmuck-Stück ohne `nickelFreeConfirmed`, `nickelEvidence` oder `leadFreeGlazeConfirmed` nicht online stellen; ein Textil/Cap ohne Faserangabe (auch mit „Etikett fehlt“), ohne `deviationDecision` oder mit `blankBrandVisible` (bei `allowVisibleBlankBrands = false`) nicht online stellen; ein Foto ohne EN-Alt-Text verhindert das Online-Stellen.
**AK-7-02** Ein hochgeladenes Foto mit GPS-EXIF wird ohne GPS-Daten ausgeliefert (alle Bildgrößen, auch Original).
**AK-7-03** Die Objektnummer lässt sich nach der ersten Veröffentlichung weder in der Handy-Ansicht noch über das Standardformular oder die API ändern.

### 7.5 Meine Stücke

- Suche: Nummer (exakt) oder Titel (enthält); Filter Status (Entwurf, online, reserviert, verkauft, ausgeblendet) und Kategorie.
- Karte: Foto, `Nr. 017`, Titel, Preis, Status-Badge; bei `reserved` „reserviert bis HH:MM“ bzw. „Vorkasse PC-… bis {Datum}“.
- **Aktionen je Status:**

| Status | Knöpfe | Wirkung |
|---|---|---|
| alle | Bearbeiten | §7.4 |
| `draft` | Online stellen · Ausblenden · Löschen (nur nie veröffentlichte) | P2 · P12 · P15 |
| `available` | Link kopieren · **Offline verkauft** · Offline nehmen · Ausblenden | – · P9 (Dialog: „Nr. 017 als offline verkauft markieren? Es verschwindet aus dem Shop.“ + Schalter „Im Archiv mit sold-Stempel zeigen“) · P3 · P12 |
| `reserved` | Offline verkauft (nur Reservierung mit `source = checkout_session`, mit Warnung S5) · Zur Bestellung (bei Vorkasse) | P10 |
| `sold` | Im Archiv zeigen an/aus · Wieder verkaufen (nur bei P11-Bedingung) · Ausblenden (nur bei P13-Bedingung, z. B. nach Erstattung wegen `breakage`) · Zur Bestellung (online verkauft) | Schalter `showInArchiveAfterSale` · P11 · P13 |
| `archived` | Wieder bearbeiten | P14 |

### 7.6 Zu packen

- **Liste:** Bestellungen `paid` und `packed` mit `fulfillmentMethod = shipping`, älteste zuerst. Karte: Bestellnummer,
  Datum, Fotos + `Nr.` der Stücke, Versandklasse, Name und Ort, Badges: „Keramik – Karton in Karton“, „Warenwert > 500 € –
  Transportversicherung buchen“ (`settings.shipping.insuranceHintThresholdCents`, DHL haftet bis 500 €, Konzeptseite),
  „Brief über 25 € – Einschreiben haftet nur bis 25 €“, „E-Mail an DHL: ja/nein“ (`carrierEmailConsent` ohne
  `carrierEmailConsentRevokedAt`), „Nicht mehr versenden – Widerruf!“ (falls O11).
- **Detail und Knöpfe:**

| Knopf | Wirkung |
|---|---|
| Adresse kopieren | kopiert `Name ⏎ Adresszusatz ⏎ Straße Nr. ⏎ PLZ Ort` in die Zwischenablage; zusätzlich Kopier-Symbole je Zeile; E-Mail nur mit erteilter und nicht widerrufener Einwilligung, Telefonnummern nie (R-101, E-26) |
| Einwilligung widerrufen | nur sichtbar bei erteilter DHL-Einwilligung: Dialog, dann `carrierEmailConsentRevokedAt` und Widerruf im `consent-log` (`withdrawnAt`); „Adresse kopieren“ gibt ab sofort keine E-Mail mehr aus; auf Wunsch Bestätigung M16 (R-101, R-152) |
| Packzettel (PDF) | `GET /api/orders/:id/packing-slip.pdf`; A4, ohne Preise: Bestellnummer, Datum, Empfänger:in, Positionen mit Foto, `Nr.`, Titel, Lagerort (`storageLocation`); Verpackungs-Checkliste; **Beileger-Block** je Stück (Herstellerin mit Anschrift und E-Mail aus `settings.business`, `Nr.`, Warn-/Sicherheits- und Pflegehinweise – GPSR; bei EN-Bestellungen zusätzlich EN); Platz für eine handschriftliche Karte |
| Etikett und Beileger (PDF) | `GET /api/products/:id/label.pdf`, je Stück (R-203, auch in „Meine Stücke“ und im Bestell-Detail): Objektnummer, Name, Postanschrift, E-Mail, Warnhinweise, bei Deko-Keramik „Nur Deko – nicht für Lebensmittel“ (für die Kennzeichnung am Boden), QR-Code zur kanonischen Produktseite |
| Verpackungs-Checkliste | Häkchen je Punkt (gespeichert in `packingChecklistState`), Punkte aus `settings.packingChecklists` je Versandklasse: Keramik – Hohlräume mit Papier füllen, jedes Teil einzeln einwickeln, Innenkarton, Außenkarton mit mind. 6 cm Polster rundum, Schütteltest; Textil – Papier- oder Kartonversandtasche, niemals Plastik (sonst DHL-Sperrgutzuschlag); Zeichnungen – zwischen zwei feste Kartonplatten, „Bitte nicht knicken“; alle – zwei Fotos vor dem Zukleben (Konzeptseite „Verpackungs-Checkliste“) |
| Packfotos hinzufügen | 0–4 Fotos (Kamera; Datenmodell erlaubt bis 6), privat gespeichert (`packingPhotos`), an der Bestellung (Nachweis bei Bruch/Anfechtung); empfohlen, keine Pflicht |
| Verpackung [P5] | Verpackungsart und -gewicht dieser Sendung (E-47, R-201): vorbelegt mit der Vorlage der Versandklasse (`settings.packaging.defaultsByShippingClass` → `settings.packaging.templates`, §7.14) – Material `paper_cardboard` (Papier/Pappe) · `plastic` (Kunststoff) · `other` (Sonstiges) mit Gewicht in g, auch mehrere Materialien je Sendung –, beim Packen änderbar (z. B. zusätzlicher Karton). Gespeichert als Wertkopie in `packaging.*` mit „Gepackt“, spätestens mit „Versendet melden“; Grundlage für den Jahres-Export der Verpackungsmengen (§7.15) |
| Gepackt | O6 |
| Sendungsnummer eingeben / scannen | Textfeld + „Scannen“ (Kamera, Barcode); Versanddienst `shipment.carrier` (vorbelegt aus Versandklasse: `brief` → `deutsche_post`, sonst `dhl`); Prüfung 8–35 Zeichen `A–Z 0–9` (normalisiert in Großbuchstaben); Pflicht bei `paket_klein` und `keramik`, bei `brief` optional (vorläufig bis Kanzleifrage K-40) |
| Versendet melden | O7 nach Dialog „Die Kundin bekommt eine Versandmail mit Sendungsnummer.“ (ohne Nummer: „… mit Versanddatum, ohne Sendungsverfolgung“) → M06. Enthält die Bestellung ein Stück der Versandklasse `keramik` und gibt es kein Packfoto, fragt die Verwaltung zuerst „Ohne Packfoto versenden?“; erst nach Bestätigung wird der Status gesetzt, die Bestätigung wird mit Zeitpunkt protokolliert (Audit `packing_photo_skipped`, R-100) |

### 7.7 Vorkasse offen

- Liste `awaiting_prepayment`, Fälligste zuerst: Bestellnummer (= Verwendungszweck), Betrag, Bestelldatum, „noch X Tage bis
  Storno“ (am letzten Tag rot), Erinnerung verschickt ja/nein.
- Knöpfe: **„Zahlung erhalten“** (O3, Dialog mit Verwendungszweck, eingegangenem Betrag `prepayment.receivedAmountCents`
  (Pflicht; weicht er vom Gesamtbetrag ab, erscheint eine Warnung) und optional Eingangsdatum `prepayment.receivedAt`) ·
  **„Stornieren“** (O4, Grund Pflicht in `cancelNote`, M04) · „Bankdaten kopieren“.
- Unterliste „Kürzlich automatisch storniert (30 Tage)“ mit Knopf **„Nachträglich bezahlt“** (O5 bzw. Rücküberweisungs-Hinweis, §4.8).

### 7.8 Versendet

- Liste `shipped` (alle) und `delivered` (letzte 30 Tage): Bestellnummer, Versanddatum, Sendungsnummer mit Link, Status;
  automatisch gesetzte Zustellung (`shipment.deliveredSource = auto`, Task `markDelivered`) mit Kennzeichen „geschätzt“.
- Knöpfe: „Zugestellt“ (O10) · „Sendungsnummer korrigieren“ (Dialog: „Versandmail erneut senden?“ ja/nein) ·
  **„Reklamation (Bruch)“** bzw. im Bestell-Detail „Reklamation“ (Transportschaden oder Mangel) [P6] → legt eine
  Reklamationsakte an (`complaints`, DATENMODELL §6.29, R-110: `kind`, `receivedAt`, betroffene Stücke, private `photos`,
  `remedy`, `status`) und bietet:
  - „Fotos anfordern“ und später „Bitte um Bankverbindung“ (Vorkasse-Erstattung): `mailto:`-Vorlagen aus §7.13, ohne Rechtspflicht;
  - Frist „bis {Datum} bei DHL reklamieren“ (`carrierClaimDueAt` = Zustellung + 7 Tage) und Feld „bei DHL reklamiert am“;
  - **„Reklamation beantworten“** → M12 (`complaint_repair_choice`) über die Outbox; `repairChoiceSentAt` und später die
    Wahl der Kund:in (`customerChoice`, `customerChoiceAt`) stehen in der Akte; Reparatur verlängert `warrantyEndsAt` um
    12 Monate (R-111);
  - Angebot Erstattung (→ O15, `refunds[].reason = complaint`);
  - **„Streitbeilegungshinweis senden“** → M13 (`dispute_vsbg`) über die Outbox, für ungelöste Streitfälle
    (`vsbgNoticeSentAt`, R-112).

### 7.9 Abholung

- Liste `paid` mit `fulfillmentMethod = pickup` und `ready_for_pickup` (Wartetage; > 14 Tage markiert).
- Knöpfe: **„Bereit zur Abholung“** (Textfeld mit Vorlage `settings.pickup.instructions`, editierbar → O8, M07) ·
  **„Abgeholt“** (O9, setzt `timestamps.pickedUpAt` = Beginn der Widerrufsfrist und der Gewährleistung, R-083).

### 7.10 Widerrufe

- Liste: `WR-2026-00003`, Eingang (Datum/Uhrzeit), Name, Bestellung oder „nicht zugeordnet“ (`matchStatus`), Status
  (`received`, `goods_returned`, `partially_refunded`, `refunded`, `rejected`, `closed`), **Erstattungsfrist**
  (`refundDueAt` = Eingang + 14 Tage, ab Tag 10 rot); Info-Anzeige der regulären Widerrufsfrist (Zustellung bzw. Übergabe
  + 14 Tage, bei automatisch gesetzter Zustellung „geschätzt“) – **nie** automatisch ablehnen (R-094).
- Detail: unveränderliche Erklärung, zugeordnete Bestellung mit Positionen und Zahlart, Notizen (`adminNotes`).
- Knöpfe: „Bestellung zuordnen“ (W2) · „Ware ist zurück“ (W3/O12, Zustandsnotiz, optional Fotos `returnPhotos`) ·
  **„Erstatten“** (Dialog: Positionen wählen, Betrag nach Regel §5.3 vorberechnet, erhöhbar mit Notiz; bei Teil-Widerruf
  Hinweis „Versandanteil vorläufig kundenfreundlich – Kanzleifrage K-09“; Stripe → Refund-API; Vorkasse → „Erstattung
  überwiesen“ bestätigen) · „Rücksendenachweis liegt vor“ (`returnProofReceivedAt`, beendet das Zurückbehaltungsrecht) ·
  „Ohne Erstattung abschließen“ (W5, `closeReason` Pflicht) · „Ablehnen“ (W7, `closeNote` Pflicht) · „Als Test/Spam
  markieren“ (Begründung Pflicht) · „Stück wieder verkaufen“ (P11) bzw. „Stück ausblenden“ (P13, z. B. beschädigt) ·
  „Widerruf manuell erfassen“ (per Mail oder Brief eingegangen: Kanal, Eingangszeitpunkt; M08 nur, wenn eine E-Mail
  angegeben ist; R-094).
- Umfang je Phase: In P5 sind Liste und Detail nur lesend; die Knöpfe entstehen mit der Widerrufsfunktion in P6.

### 7.11 Anfragen (Auftragsarbeiten)

- Liste (`inquiries`): `AA-2026-0007`, Datum, Name, Gegenstand (`objectType`), Status, „wird gelöscht am {Datum}“
  (`deleteAfter` = Eingang + 6 Monate, L-10).
- Detail: alle Angaben, Bilder (`referenceImages`, nur über kurzlebige signierte Links bzw. authentifizierte Route, nie
  öffentliche URL), interne Notizen (`adminNotes`), Status-Knöpfe (§5.5), **„Antworten“** (öffnet `mailto:` an die
  Anfragende mit Betreff „Deine Anfrage AA-2026-0007“ – Antwort aus Juttas eigenem Postfach), **„Jetzt löschen“** (Dialog;
  löscht Anfrage und Bilder sofort, Eintrag im `deletion-log`).
- Umfang je Phase: Liste und Detail entstehen in P5 (ohne Daten bis auf den Beispielbestand), das öffentliche Formular in P7.

### 7.12 Tattoo

Unterbereiche (Details §9):
- **Flash** (`flash`): Liste mit Status-Chips; Wechsel „verfügbar ↔ vergeben“ (`available` ↔ `claimed`, nur einmalige
  Motive) mit höchstens 2 Taps; wiederholbare Motive pausiert Jutta mit „Offline nehmen“ (`published = false`); „Neuer
  Flash“ (Bild `image`, weitere Bilder, Nummer `number` vorbelegt, Titel DE + Übersetzen, Größe `sizeCm` + `sizeNote`,
  Festpreis `priceCents`, einmalig/wiederholbar `repeatable`, veröffentlichen `published`).
- **Galerie** (`tattoo-gallery`): Liste mit Einwilligungsangaben je Foto (`showsCustomer`, `consentGiven`, `consentDate`,
  `consentNote`, optional Nachweis `consentEvidence`; E-42); „Veröffentlichen“ ohne vollständige Einwilligung ist bei
  `showsCustomer` gesperrt mit Hinweis „Ohne Einwilligung der Kundin/des Kunden nicht veröffentlichen“; Knopf
  „Einwilligung widerrufen“ nimmt das Foto sofort offline (R-172).
- **Preise, Stil, Ablauf, Aftercare, FAQ:** Zahlen in `settings.tattoo.*`, Texte in den Seiten `tattoo` und
  `tattoo_aftercare` (`pages`, Blöcke `priceInfo`, `processSteps`, `aftercareSteps`, `faqList`) und `faqs`; DE/EN mit
  Übersetzen-Knopf.

### 7.13 Texte

- **Seiten** (`pages`, gefunden über `key`): Startseite (`home`, Stationstexte), Über mich & Coco (`about`),
  Auftragsarbeiten (`commissions`, inkl. Beispielbilder), Kontakt (`contact`), Shop- und Archiv-Einleitungen (`shop`,
  `archive`), Tattoo (`tattoo`, `tattoo_aftercare`), Danke/Bestellstatus (`thanks`, `order_status`), Widerruf-Hinweis
  (`withdrawal`), Konformität (`conformity`), 404-Text (`not_found`), SEO-Beschreibungen. Die Einleitung von Versand &
  Zahlung ist der Rechtstext `versand-zahlung`. Alle DE/EN, Übersetzen-Knopf (E-62).
- **FAQ** (`faqs`) – sortierbare Einträge Frage/Antwort DE/EN.
- **Rechtstexte** (`legal-texts`, E-41), Typen `impressum`, `datenschutz`, `agb`, `widerrufsbelehrung`,
  `widerrufsformular`, `versand-zahlung`:
  - „Neue Version“ → Text einfügen (DE, optional EN), Herkunft `origin` wählen (`draft` Arbeitsfassung, `lawyer` Kanzlei;
    `placeholder` nur Grund-Seed) → „Vorschau“ → „Veröffentlichen“ (sofort = `active`, oder ab Datum = `scheduled`, Task
    `activateScheduledLegalTexts`); die bisher aktive Fassung wird `superseded`.
  - Aktive und abgelöste Fassungen sind **unveränderlich**; beim Aktivieren entsteht das PDF (Task `renderLegalTextPdf`)
    und wird unveränderlich gespeichert.
  - Platzhalter im Text – genau diese Liste (R-012, KANZLEI-BRIEFING §16.3): `{{name}}`, `{{street}}`, `{{postalCode}}`,
    `{{city}}`, `{{email}}`, `{{phone}}`, `{{wIdNr}}`, `{{ustIdNr}}`, `{{siteUrl}}`, `{{withdrawalUrl}}` (= absolute URL von
    R26 in der Sprache der Fassung), `{{shippingTable}}`, `{{deliveryTime}}`, `{{vorkasseDays}}`, `{{returnCostsNote}}` –
    ersetzt aus `settings`, Umgebung bzw. dem Baustein `withdrawal.returnCostsNote` (Quellen DATENMODELL §6.12). Ein unbekanntes oder nicht ersetzbares Token ist ein Render-Fehler und sperrt das
    Veröffentlichen; `{{STEUERNUMMER}}` wird nie ersetzt (E-46).
  - Prüfungen vor dem Veröffentlichen: `widerrufsbelehrung` muss `{{withdrawalUrl}}` oder die URL von R26 enthalten
    (R-095); **gesperrt**, wenn der Text `ec.europa.eu/consumers/odr` enthält oder im Kleinunternehmer-Modus „inkl. MwSt“/
    „zzgl. MwSt“.
  - Fassungen mit `origin ≠ lawyer` zeigen öffentlich das Band „PLATZHALTER – nicht rechtsverbindlich“ (R-002).
  - Liste zeigt je Typ: aktive Fassung, Herkunft, gültig ab, Anzahl Bestellungen mit dieser Fassung, Datum der letzten
    Prüfung (`settings.legal.reviews`, R-014).
- **Rechtsbausteine** (`legal-snippets`, ab P6; vorher Konstanten): kurze Rechtstexte laut RECHT §6 (z. B.
  `checkout.dhlEmailConsent`, `withdrawal.receiptNotice`, `complaint.repairChoice`, `dispute.vsbg37`), versioniert wie
  Rechtstexte.
- **Mail-Bausteine:** Signatur, Abhol-Vorlage (`settings.pickup.instructions`, DE/EN, enthält die Abholadresse),
  Antwortzeit-Satz der Anfrage-Bestätigung.
- **Vorlagen zum Öffnen im Mailprogramm** (`mailto:`, ohne Rechtspflicht, R-084): Fotos anfordern bei Bruch, Bitte um
  Bankverbindung für eine Vorkasse-Erstattung. Reparatur/Ersatz (M12) und § 37 VSBG (M13) sind Transaktionsmails über die
  Outbox (§6.2, §7.8).

### 7.14 Einstellungen

Alle Werte liegen im Global `settings` (Feldnamen DATENMODELL §7.1); jede Änderung erzeugt einen Audit-Eintrag.

| Bereich | Inhalte |
|---|---|
| Stammdaten & Impressum | `settings.business.*`: Name (`legalName`), Geschäftsbezeichnung (`tradeName`, „Planet Claire“), Straße, PLZ, Ort, Land (Privatadresse, E-40; kein Postfach), E-Mail, Telefon, Steuernummer (`taxNumber`, nie öffentlich, E-46), W-IdNr./USt-IdNr. (`economicId`/`vatId`, optional), Rücksendeadresse (`returnAddress`, leer = Geschäftsadresse); dazu Bezirk des Privatstudios (`settings.tattoo.studioDistrict`, E-50) und Instagram-Handle (`settings.social.instagramHandle`); dienen Impressum, GPSR-Block, Rechnung, Packzettel, Etikett |
| Steuer | Modus-Verlauf `settings.tax.modes` (Kleinunternehmerin/Regelbesteuerung + „gilt ab“, §4.14): neuer Eintrag nur mit Begründung und Häkchen „mit Steuerberatung abgestimmt“ (R-032), Warnhinweis; Knopf „Steuerangaben bestätigt“ (`settings.tax.confirmedAt`); Aufbewahrung Rechnungen/Gutschriften `settings.retention.invoiceYears` (10 oder 8 Jahre, Standard 10, §4.13, Kanzleifrage K-33) mit demselben Warnhinweis |
| Versand | Tarife `settings.shipping.rates` je Zone und Versandklasse (E-25), Lieferzeit-Text DE/EN `deliveryTimeText` (Standard „2–5 Werktage“, E-31), Lieferländer `enabledCountries` (nur DE an; andere Länder erst nach der EU-Checkliste `euChecklist` und dem Häkchen `euShippingAcknowledged` mit Datum, R-202; lebensmittelechte Keramik nie nach NL/LU; CH vorbereitet aus, E-24), Abholung an/aus (`pickupEnabled`), Versicherungs-Hinweis ab `insuranceHintThresholdCents` (Standard 500 €), Sendungsverfolgungs-Vorlagen `trackingUrlTemplates` je Versanddienst (`dhl`, `deutsche_post`; Standard `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode={trackingNumber}`), Abhol-Vorlage `settings.pickup.instructions`, Verpackungs-Checklisten `settings.packingChecklists` |
| Verpackung [P5] | Vorlagen `settings.packaging.templates` (Name, Materialien `paper_cardboard`/`plastic`/`other` mit Gewicht in g) und Standard je Versandklasse `settings.packaging.defaultsByShippingClass` (Startwerte sind Schätzwerte, Annahme KA-29); LUCID-Nummer `settings.business.lucidNumber` und duales System `settings.business.packagingScheme.*` (E-47, R-200) |
| Zahlung | `settings.payment.*`: Vorkasse an/aus, Kontoinhaberin, IBAN (Prüfziffer wird geprüft; Beispiel-IBAN gilt als Platzhalter), BIC, Bank; Reservierungsdauer (`reservationMinutes`, 30–60); Anzeige des Zahlungsanbieters (Mock/Test/Live) ohne Schlüssel; Vorkasse-Fristen (`prepaymentReminderHours` Standard 72 h, `prepaymentDays` Standard 5 → Storno nach 23:59:59 Berlin am 5. Kalendertag nach dem Bestelltag; E-23, §4.8) |
| Shop | Schalter „Shop geöffnet“ `settings.shop.isOpen` (aus = Shop-Pause: „In den Korb“ und „Zur Kasse“ gesperrt, Pausen-Text sichtbar, §4.2; einschalten in Produktion erst, wenn die Startklar-Prüfung grün ist, DATENMODELL §13.7), Pausen-Text `closedMessage` (DE/EN), `maxItemsPerCheckout` (Standard 10) |
| Benachrichtigungen | `settings.adminNotificationEmail` (Startwert `ADMIN_NOTIFY_EMAIL`, Standard jutta@planetclairetattoos.com) |
| Umsatz-Wächter | manuelle Monatssummen (`revenue-entries`) je Monat und Quelle: Tattoo, Flohmarkt, Auftragsarbeiten, Sonstiges (E-45); Jahressummen vor dem Shop (`settings.revenueGuard.manualYearTotals`); Grenzen und Stufen `settings.revenueGuard.*` (§8.4); Verlauf |
| Rechtstexte | je Typ Stand, Herkunft, Datum der letzten Prüfung und der letzten Erinnerung (`settings.legal.reviews`, Intervall `settings.legal.reviewIntervalDays`, R-014); Knopf „geprüft, keine Änderung“; Schalter `settings.legal.allowVisibleBlankBrands` (Standard aus, nur nach Kanzleifrage K-13) |
| Datenschutz & Dienste | Auftragsverarbeitungsverträge `settings.processorAgreements` je Dienst aus DIENSTE.md (R-155); Statistik `settings.analytics.enabled` nur mit dokumentierter Entscheidung (`confirmedAt`, `note`) und zusätzlich `NEXT_PUBLIC_ANALYTICS_ENABLED=true` (R-132) |
| Kosten | Budget und Warnschwelle (`settings.costs.*`, E-05), Monatswerte |
| Vorlagen | Warnhinweise je Kategorie `settings.safetyTemplates`, Pflegehinweise `settings.careTemplates` |
| Beispieldaten | Anzahl `seed=true` je Collection; Knopf **„Beispieldaten entfernen“** (§11.3) |
| System | letzte Job-Läufe und Fehler, fehlgeschlagene Mails (mit „erneut senden“), App-Version, **Startklar-Prüfung** (§7.16) |
| Konto | Passwort ändern, Abmelden |

### 7.15 Export und Datenschutz-Werkzeuge

- **Monatsexport CSV** (E-04, R-124): Monat wählen → Download `planetclaire-{JJJJ-MM}.csv`; UTF-8 mit BOM, Trennzeichen
  `;`, Dezimalkomma, Datum `TT.MM.JJJJ`. Spalten: Belegdatum; Belegart (Rechnung/Stornorechnung/Gutschrift); Belegnummer;
  Bestellnummer; Zahlart; Betrag brutto; davon Versand; Steuermodus; Steuersatz; Steuerbetrag (0 im
  Kleinunternehmer-Modus); Zahlungsdatum; Stripe-Zahlungs-ID bzw. Stripe-Erstattungs-ID; Stripe-Gebühr (Mock: 0);
  Auszahlungs-ID; Auszahlungsdatum. **Keine Namen, Adressen oder E-Mail-Adressen.** Gleiche Eingaben erzeugen eine
  byte-identische Datei (feste Sortierung, feste Formatierung). Gebühren und Auszahlungen aus Stripe (Mock: Fixtures).
- **DATEV-Buchungsstapel** (optional, E-04): erst aktiv, wenn in den Einstellungen Konten hinterlegt sind (Erlöskonto,
  Geldtransitkonto Stripe, Bankkonto, Gebührenkonto; mit Steuerberatung festlegen) – bis dahin ausgegraut.
- **Rechnungen als ZIP** je Monat (alle Beleg-PDFs des Monats).
- **Keine Beispieldaten in Exporten:** Monats-CSV, DATEV-Buchungsstapel, Rechnungs-ZIP und Verpackungs-CSV enthalten
  **nie** Datensätze mit `seed=true` (auch keine `BSP-`-Belege) – auch nicht bei wirksamem `SEED_PREVIEW_MODE` oder im
  Vorschau-Export (§11.4).
- **Verpackungsmengen (Jahres-CSV)** [P5] (E-47, R-201): Jahr wählen → `GET /api/admin/packaging-report?year=JJJJ`, Download
  `planetclaire-verpackung-{JJJJ}.csv` (Trennzeichen `;`, UTF-8 mit BOM) mit Anzahl versendeter Sendungen und Summe in kg je
  Material (Papier/Pappe, Kunststoff, Sonstiges) nach Versanddatum aus den beim Packen erfassten Werten (§7.6); Abholungen
  zählen nicht – für die Meldung an LUCID und das duale System; dazu die laufende Jahressumme in der Verwaltung. Keine
  Kundendaten, keine Beispieldaten (siehe oben).
- **Datenschutz-Anfragen** (`privacy-requests`, Nummer `DS-2026-0001`, R-150 bis R-153, Ablauf LOESCHKONZEPT §5): Anfrage
  erfassen (Art, Eingang, Frist `dueAt` = Eingang + 1 Monat, optional Verlängerung mit Begründung), Identität prüfen,
  bearbeiten, beantworten; Erinnerung A14 7 Tage und 1 Tag vor Fristende; Hinweis auf „Heute“ bei offenen Anfragen.
  - **Auskunft/Übertragbarkeit:** Suche nach E-Mail (normalisiert), Bestellnummer oder Name über Bestellungen, Kassen,
    Belege, Widerrufe, Anfragen (inkl. Bilder), Reklamationen, Mail- und Einwilligungs-Protokoll und frühere
    Datenschutz-Anfragen → ZIP mit `daten.json`, `auskunft.html` und Kopien der Bilder/PDFs, privat gespeichert und
    30 Tage nach Versand der Antwort gelöscht (L-17); Antwort M14.
  - **Löschen/Einschränken:** zeigt je Datensatz die Regel aus dem LOESCHKONZEPT und die Aktion: sofort löschen (inkl.
    Dateien und Mail-Protokoll), einschränken bis {Datum} (`privacy.processingRestricted = true`: keine weiteren Mails, aus
    Listen ausgeblendet, nur für Export/Steuer; nicht erforderliche Felder wie Telefon, Notizen, Packfotos sofort
    entfernen) oder behalten (Aufbewahrungssperre `privacy.legalHold` mit Pflicht-Begründung). Belege bleiben bis
    Fristende unverändert. Antwort M15.
  - **Berichtigung:** Name/Adresse/E-Mail vor Rechnungsstellung editierbar, danach nur per Gutschrift + neuer Rechnung;
    **Einwilligungen widerrufen** (DHL-Weitergabe, Portfolio) per Knopf mit Wirkung ab sofort, Bestätigung M16 (R-152).
  - Jede Aktion → `deletion-log`.
- **Löschvorschau:** was die Löschjobs in den nächsten 30 Tagen löschen oder anonymisieren (R-154).

### 7.16 Standard-Payload-Ansichten und Startklar-Prüfung

**Standard-Ansichten** („Alle Daten“) bleiben für alle Collections erreichbar. Einschränkungen: Status-Felder
schreibgeschützt (nur Aktionen, §5); Rechnungen/Gutschriften nur lesen; veröffentlichte Rechtstext-Versionen nur lesen;
Widerrufserklärungen nur lesen (Notizen separat); keine Lösch-Knöpfe für veröffentlichte Stücke, Bestellungen, Belege.

**Startklar-Prüfung** (Admin-Seite „Startklar“ und Skript `pnpm check:golive` mit derselben Logik, R-210, DATENMODELL
§13.7; Liste grün/rot, bis P10 informativ; in P11 müssen alle Punkte grün sein, das Skript endet sonst mit Code ≠ 0):
1. Alle sechs Rechtstext-Typen mit aktiver Fassung `origin = lawyer` (kein Platzhalter); die Widerrufsbelehrung enthält
   die URL von R26; alle Rechtsbausteine mit „Kanzlei: ja“ mit aktiver Fassung `origin = lawyer`.
2. `settings.business` vollständig (`legalName`, `street`, `postalCode`, `city`, `email`, `phone`, `taxNumber`) und ohne
   Platzhalter (`[`, „folgt“, „Muster“, `example`, PLZ `00000`); `settings.tattoo.studioDistrict` und
   `settings.pickup.instructions` gesetzt.
3. Vorkasse aktiv → IBAN gesetzt, Prüfziffer gültig, nicht die Beispiel-IBAN `DE36000000000000000000`; Kontoinhaberin
   gesetzt.
4. LUCID-Nummer und Systembeteiligung gesetzt (`settings.business.lucidNumber`, `settings.business.packagingScheme`, R-200).
5. Auftragsverarbeitungsverträge für alle Dienste mit `avv: required` und `production: true` (`settings.processorAgreements`).
6. 0 Datensätze mit `seed=true`; `SEED_PREVIEW_MODE` nicht `true`; `APP_ENV=production`.
7. Admin-Pfad `ADMIN_ROUTE` ≠ `/admin`.
8. `PAYMENTS_DRIVER=stripe` im Live-Modus, Webhook-Geheimnis gesetzt (nur „gesetzt ja/nein“ anzeigen); `EMAIL_DRIVER=smtp`,
   `STORAGE_DRIVER=s3`.
9. Statistik-Entscheidung dokumentiert (`settings.analytics.*`).
10. Harmonisierte Mitteilung ist die amtliche Grafik (R-049).
11. Steuerangaben bestätigt (`settings.tax.confirmedAt`), Vorjahresumsatz eingetragen (`settings.revenueGuard.manualYearTotals`).
12. Nur Deutschland als Lieferland aktiv, oder die Bestätigungen nach R-202 liegen vor (E-24).
13. `docs/recht/VVT.md` existiert.
14. Kein öffentlich sichtbares Bild mit `showsPerson = jutta` ohne `media.ownerApproved`; keine veröffentlichten
    Galerie-Bilder mit Kund:innen ohne Einwilligung (R-181, E-42).

**AK-7-04** Alle Handy-Ansichten sind bei 390×844 ohne horizontales Scrollen bedienbar; axe ohne „serious/critical“.
**AK-7-05** E2E: Bestellung ohne Keramik `paid` → „Gepackt“ (Verpackung aus der Vorlage übernommen) → Sendungsnummer eingeben → „Versendet melden“ → Status `shipped`, M06 im Mail-Log, in ≤ 5 Taps plus Texteingabe.
**AK-7-06** Das Admin-Manifest ist nur unter dem Admin-Pfad erreichbar und macht die Verwaltung installierbar: Chromium meldet über CDP `Page.getInstallabilityErrors` für den Admin-Scope keine Fehler; Manifest-Felder und Service-Worker-Scope werden zusätzlich geprüft.

---

## 8. Automatisierte Jobs

### 8.1 Grundregeln

1. **Idempotent:** Jeder Job entscheidet nach gespeicherten Zeitstempeln, nicht nach seiner Ausführungszeit. Zweimal
   laufen = gleiches Ergebnis. Jede Aktion eines Jobs ist einzeln transaktional.
2. **Keine Parallelläufe** desselben Jobs (Datenbank-Sperre).
3. **Tägliche und monatliche Jobs** laufen beim ersten vollen Lauf des Job-Weckers (mindestens stündlich, Nr. 6) nach
   der genannten Berliner Uhrzeit und führen ihre Arbeit höchstens einmal je Berliner Kalendertag bzw. -monat aus (robust
   gegen Sommerzeit und UTC-Cron).
4. **Protokoll** je Lauf (Job, Start, Ende, Ergebnis, Zähler, Fehler) 90 Tage; sichtbar unter Einstellungen → System.
   Fehlschlag bei geldrelevanten Jobs → A12.
5. **Testbarkeit:** Jede Job-Funktion nimmt „jetzt“ als Parameter; Tests laufen mit vorgestellter Uhr.
6. **Auslösung über den Job-Wecker** (ARCHITEKTUR §9.6): Vercel Cron ruft jede Minute `GET /api/cron/tick` mit
   `CRON_SECRET` auf. Der Tick prüft **ohne Datenbankzugriff** den nächsten Weckzeitpunkt und führt nur dann die fälligen
   Tasks der Jobs-Queue aus; sonst antwortet er sofort. Wer eine zeitgebundene Sache anlegt (Reservierung, Vorkasse-Frist,
   Mail-Wiederholung, Angebotsgrenze, Kasse in `confirming`), setzt einen Weckzeitpunkt; mindestens stündlich gibt es einen
   vollen Lauf als Sicherheitsnetz. Kein Minuten-Cron mit Datenbankzugriff (Kosten, E-05). Einzelner Task sofort:
   `POST /api/cron/run/[task]`; `/api/payload-jobs/run` nur als Rückfall. Lokal `pnpm jobs:run <task>` bzw.
   `JOBS_AUTORUN=true`; im Vorschau-Export laufen keine Jobs.
7. **Namen:** Task-Slugs **nur** laut ARCHITEKTUR Anhang A.3 (Tabelle §8.2); Uhrzeiten, Fristen und Regeln stehen hier.
8. **Beispieldaten:** Die Fristen- und Erinnerungs-Tasks (`prepaymentReminders`, `cancelOverduePrepayments`,
   `withdrawalDeadlines`, `legalHoldReview`, `privacyRequestsDeadlineReminder`, `complianceDocsReview`) überspringen
   Datensätze mit `seed = true` (keine Mails, vor allem keine Admin-Mails, und keine Statuswechsel zu Beispieldaten); die
   Verwaltung zeigt die Beispiel-Fristen trotzdem an. Die Löschfristen (§8.3) gelten für Beispieldaten unverändert.

### 8.2 Job-Tabelle

| Task (Slug, ARCHITEKTUR Anhang A.3) | Takt (Berlin) / Auslösung | Aufgabe | Phase |
|---|---|---|---|
| `releaseExpiredReservations` | Weckzeitpunkt `expiresAt` der Reservierung bzw. 10 min nach dem Wechsel einer Kasse in `confirming`; stündliches Sicherheitsnetz | Checkout-Reservierungen mit `expiresAt < jetzt`: Stripe-Session beenden; meldet Stripe „bezahlt“ → `fulfillCheckout`, sonst Freigabe (P5, Kasse `expired`). „Kassen abgleichen“: Kassen in `confirming` seit > 10 min bei Stripe abfragen und abgleichen. | P4 |
| `prepaymentReminders` | Weckzeitpunkt `prepayment.reminderDueAt` (`placedAt + 72 h`); stündliches Sicherheitsnetz | `awaiting_prepayment` ohne Zahlung ab `prepayment.reminderDueAt`: einmalig M03 (`prepayment.reminderSentAt`) | P4 |
| `cancelOverduePrepayments` | Weckzeitpunkt `prepayment.dueAt`; stündliches Sicherheitsnetz | `awaiting_prepayment` nach `prepayment.dueAt` (§4.8): O4 (`payment_timeout`) + M04 + A03, Reservierung `released`, Stücke `available` | P4 |
| `sendEmail` | direkt nach jedem Commit; Wiederholungen über Weckzeitpunkte | offene Mails senden; Wiederholung nach 1, 5, 15, 60, 240 min; danach `failed` + A12. **M08:** Wiederholung im Abstand von höchstens 5 min bis 24 h nach Eingang; A12 schon nach dem 2. Fehlversuch und erneut nach 24 h ohne Versand (dann `failed`, Bestätigung manuell senden), Hinweis unter „Heute“ (R-093) | P4 |
| `renderInvoicePdf`, `renderLegalTextPdf` | bei Bedarf (Rechnung/Gutschrift ausgestellt bzw. Rechtstext aktiviert) | PDF erzeugen, SHA-256 speichern; ab P4, weil M01/M02 die Rechtstext-PDFs anhängen | P4 |
| `activateScheduledLegalTexts` | Weckzeitpunkt `validFrom`; stündliches Sicherheitsnetz | Rechtstexte (ab P6 auch Rechtsbausteine) im Status `scheduled` mit `validFrom ≤ jetzt` aktivieren, Vorgängerfassung `superseded` | P6 |
| `markDelivered` | täglich ab 03:00 | `shipped` am 10. Berliner Kalendertag nach dem Versandtag (`timestamps.shippedAt`) → `delivered` (O10, `shipment.deliveredSource = auto`); in der Verwaltung als „geschätzt“ gekennzeichnet | P5 |
| `retention…`-Tasks (`retentionAbandonedCheckouts`, `retentionOrderMinimize`, `retentionOrders`, `retentionInvoices`, `retentionWithdrawals`, `retentionCommissionInquiries`, `retentionEmailLog`, `retentionConsentEvidence`, `retentionPrivacyRequests`, `retentionDeletionLog`) | täglich ab 03:05 (Reihenfolge und Richtzeiten LOESCHKONZEPT §4) | Löschfristen §8.3 ausführen, `deletion-log` schreiben, Legal Holds überspringen (Details: LOESCHKONZEPT §4) | P6 |
| `retentionTechnical` | stündlich | Reservierungen 7 Tage nach Ablauf/Umwandlung (L-02), nicht abgeschickte Uploads und Rate-Limit-Zähler älter als 24 h, Webhook-Event-IDs und Job-Protokoll älter als 90 Tage, `audit-log`-Einträge nach ihrer Frist (L-13) | P4 (Reservierungen), P7 (Uploads) |
| `legalHoldReview` | täglich ab 08:00 | Aufbewahrungssperren älter als 6 Monate (bzw. seit der letzten Prüfung) → A15 | P6 |
| `privacyRequestsDeadlineReminder` | täglich ab 08:00 | offene Datenschutz-Anfragen 7 Tage und 1 Tag vor `dueAt` bzw. `extendedDueAt` → A14 (R-153) | P6 |
| `withdrawalDeadlines` | täglich ab 08:00 | Widerrufe `received`/`goods_returned`, `refundDueAt` in ≤ 4 Tagen (Eingang vor ≥ 10 Tagen), ohne Erstattung → A13 (einmal je Widerruf, `deadlineReminderSentAt`) | P6 |
| `legalReviewReminder` | täglich ab 08:30 | je Rechtstext-Typ: Sind `activatedAt` der aktiven Fassung und `settings.legal.reviews[type].reviewedAt` beide ≥ `settings.legal.reviewIntervalDays` (Standard 365) Tage alt und die letzte Erinnerung ≥ 30 Tage her → A10 und Hinweis unter „Heute“ (E-41, R-014) | P6 |
| `revenueGuardCheck` | täglich ab 07:00 und bei Bedarf | Umsatz berechnen, Stufen prüfen (§8.4), A09 einmal je Stufe und Jahr; am 1. Januar Stufe U0 | P5 |
| `monthlyClose` | monatlich am 1. ab 04:00 | für den Vormonat: CSV-Export und Rechnungs-ZIP erzeugen und privat ablegen (**Rechnungsarchiv**); A11 (inkl. Hinweis auf fehlende manuelle Monatssummen) | P5 |
| `invoiceIntegrityCheck` | monatlich am 1. ab 04:00 | Prüfsummen **aller** gespeicherten Rechnungs-/Gutschrift-PDFs gegen die gespeicherten SHA-256-Werte prüfen (Abweichung → A12) | P5 |
| `complianceDocsReview` | monatlich am 1. ab 08:10 | Produktsicherheits-Unterlagen, deren 10-Jahres-Frist abläuft (L-24) → A16; keine automatische Löschung | P5 |
| Backup | nächtlich (eigener Vercel-Cron-Eintrag `GET /api/cron/backup`, nicht über die Jobs-Queue) | verschlüsselter Datenbank-Dump **in der App** nach R2 (EU); aktiv nur bei `APP_ENV=production` **und** `BACKUP_ENABLED=true` (bis P11 `false`, Route antwortet 404); **nie** über GitHub Actions (keine Kundendaten über GitHub, DIENSTE §3.11, LOESCHKONZEPT L-23); auf GitHub läuft nur `restore-drill.yml` mit synthetischen Beispieldaten; Details ARCHITEKTUR §10 | P10 (aktiv ab P11) |
| Kostenwarnung ab 30 € | kein Task | in der App: Hinweis unter „Heute“ ab Erreichen der Schwelle (§7.3, E-05); außerhalb der App: Ausgabenlimit mit Benachrichtigung beim Hosting (ARCHITEKTUR §12.3) | P5 (Hinweis), P11 (Hosting) |

### 8.3 Löschfristen

Die Fristen gelten ausschließlich laut `docs/recht/LOESCHKONZEPT.md` (L-Nummern); die Tabelle fasst sie zusammen.
Umsetzung zentral in `src/lib/retention/policy.ts`, ausgeführt von den Tasks aus §8.2.

| L | Daten | Frist | Aktion |
|---|---|---|---|
| L-01 | Cookies `pc_cart` (7 Tage) und `pc_checkout` (1 h) | `Max-Age` | Browser verwirft sie |
| L-02 | Reservierungen | 7 Tage nach Freigabe bzw. Umwandlung | löschen |
| L-03 | **Alle** Kassen (`checkouts`: offene, abgebrochene, abgelaufene, gescheiterte und abgeschlossene – die Bestellung hat einen eigenen Snapshot) inkl. eingegebener Kundendaten; `consent-log`-Einträge einer Kasse ohne Bestellung | 30 Tage nach Anlage der Kasse | löschen (`orders.checkout` wird geleert; Danke-Link danach 404, Status-Link bleibt) |
| L-04 | Stornierte, nie bezahlte Vorkasse-Bestellungen (`cancelled`, `cancelReason` `payment_timeout`, `admin` oder `withdrawn`) | Stufe 1: 30 Tage nach Stornierung (Lieferadresse **und** Rechnungsadresse sowie DHL-Einwilligung entfernen; Status-Token wie L-05 Stufe B); Stufe 2: 6 Jahre ab Ende des Stornojahres | minimieren, dann anonymisieren |
| L-05 | Bezahlte Bestellungen, auch widerrufene/erstattete | Stufe A 30 Tage nach `finalStatusAt` (Telefon – derzeit ohne Wirkung, die Kasse erfasst keins); Stufe B 180 Tage nach `finalStatusAt` (Status-Token → „Link abgelaufen“); Stufe C 12 Monate nach `shippedAt` bzw. `pickedUpAt` (Packfotos) und 12 Monate nach `returnReceivedAt` (Rückgabefotos); Stufe D 6 Jahre ab Ende des Jahres von `finalStatusAt` (dann auch Reklamationen, zugeordnete `email-log`-/`consent-log`-Einträge und Widerrufe löschen) | schrittweise löschen, zuletzt anonymisieren (Nummer, Daten, Positionen, Beträge, Belegnummern bleiben) |
| L-06 | Rechnungen und Gutschriften (PDF + Registerzeile) | `settings.retention.invoiceYears` (Standard 10, umstellbar auf 8) ab Ende des Ausstellungsjahres, beim Anlegen als `retainUntil` eingefroren | PDF löschen, Registerzeile anonymisieren |
| L-07 | Monatsexporte CSV/DATEV und Rechnungs-ZIP | 10 Jahre ab Ende des Exportjahres | löschen |
| L-08 | Widerrufe | 6 Jahre ab Ende des Eingangsjahres, mindestens so lange wie die zugeordnete Bestellung; Test/Spam 30 Tage nach Markierung | löschen |
| L-09 | Reklamationen (Fotos, Verlauf, gesendete Mails) | wie die Bestellung (L-05) | mit der Bestellung |
| L-10 | Auftragsarbeiten: Anfrage inkl. Bilder | **6 Monate nach Eingang** (`createdAt`), unabhängig vom Bearbeitungsstand | löschen (Datenbank und privater Speicher) |
| L-12 | Mail-Protokoll `email-log` | wie das Bezugsobjekt; ohne Bezug 90 Tage | löschen |
| L-13 | Technische Protokolle: a) Rate-Limit-Zähler (HMAC der IP, nie Klar-IP); b) Sicherheitsprotokoll Admin-Login; c) eigene Anwendungslogs; d) Webhook-Ereignisse; f) nicht abgeschickte Uploads; g) Job-Protokoll der Jobs-Queue (nur IDs, §8.1 Nr. 4); h) Verwaltungsprotokoll `audit-log` | a) 24 h; b) 14 Tage; c) ≤ 14 Tage; d) 90 Tage; f) 24 h; g) 90 Tage; h) Beleg-, Bestell-, Widerrufs- und Rechtstext-Aktionen 10 Jahre ab Ende des Jahres, sonst 3 Jahre | löschen |
| L-17 | Datenschutz-Anfragen; Exportdateien | 3 Jahre ab Ende des Abschlussjahres; Exporte 30 Tage nach der Antwort | löschen |
| L-18 | Löschprotokoll `deletion-log` (keine Inhalte) | 3 Jahre | löschen |
| L-19, L-20 | Einwilligungsnachweise; Portfolio-Fotos | DHL-Einwilligung mit der Bestellung; Portfolio-Nachweis 3 Jahre ab Widerruf bzw. Ende der Veröffentlichung; Fotos nach Widerruf sofort offline, Dateien spätestens nach 24 h gelöscht | löschen |
| L-23 | Backups und Wiederherstellungsstände: a) tägliche DB-Dumps; b) Monatsstand; c) verschlüsselter Datei-Spiegel; d) Neon-Wiederherstellungsfenster; e) nach einer Wiederherstellung die abgelöste Datenbank | a) 30 Tage; b) 12 Monate; c) solange die Quelldatei existiert, danach 7 Tage; d) höchstens 7 Tage; e) 30 Tage | Rotation bzw. Löschen (ARCHITEKTUR §10) |
| L-24 | Produktsicherheits-Unterlagen | 10 Jahre ab dem letzten betroffenen Stück | nur Erinnerung (A16) |

Server- und Hosting-Logs mit IP (L-13 e) regelt die Hosting-Einstellung außerhalb der App. Eine Aufbewahrungssperre
(`privacy.legalHold`) schiebt jede Löschung auf. Beispieldaten (`seed=true`) folgen denselben Fristen, werden aber mit
„Beispieldaten entfernen“ sofort gelöscht (L-22).

### 8.4 Umsatz-Wächter (E-45)

- **Shop-Umsatz eines Jahres** = Summe der Rechnungsbeträge (Endpreise inkl. Versand) mit Rechnungsdatum im Jahr −
  Summe der Stornorechnungen/Gutschriften im Jahr. Beispieldaten zählen nur bei wirksamem `SEED_PREVIEW_MODE` (§11.4),
  in Produktion also nie.
- **Gesamtumsatz** = Shop-Umsatz + manuelle Monatssummen (`revenue-entries`, Quellen `tattoo`, `flohmarkt`,
  `auftragsarbeiten`, `sonstiges`) des Jahres (R-125). Vorjahr: berechnet, für Jahre vor dem Shop aus
  `settings.revenueGuard.manualYearTotals`.
- **Stufen** (Standard, Beträge änderbar in `settings.revenueGuard.*`; Grundlage § 19 UStG in der Fassung ab 01.01.2025):

| Stufe | Bedingung | Meldung (Kurzform) |
|---|---|---|
| U1 | Gesamtumsatz laufendes Jahr ≥ 20.000 € | „80 % der 25.000-€-Grenze erreicht. Liegst du am Jahresende darüber, gilt ab 1. Januar die Regelbesteuerung. Sprich mit der Steuerberatung.“ |
| U2 | > 25.000 € | „25.000 € überschritten: Ab 1. Januar nächsten Jahres keine Kleinunternehmerregelung. Umstellung vorbereiten und mit der Steuerberatung sprechen.“ |
| U3 | ≥ 80.000 € | „80 % der 100.000-€-Grenze erreicht.“ |
| U3a | ≥ 90.000 € | „Dringend: 90.000 € erreicht – die 100.000-€-Grenze ist nah.“ |
| U4 | ≥ 95.000 € | „Nur noch {Rest} € bis 100.000 € – Steuerberatung jetzt kontaktieren.“ |
| U5 | > 100.000 € | „100.000 € überschritten: Ab jetzt gilt die Regelbesteuerung. Steuermodus umstellen (Einstellungen → Steuer, R-032).“ |
| U0 | am 1. Januar: Gesamtumsatz des Vorjahres > 25.000 € | „Dieses Jahr gilt die Kleinunternehmerregelung nicht (Vorjahr über 25.000 €).“ |

- Jede Stufe löst **einmal je Jahr** A09 aus (gemerkt in `settings.revenueGuard.lastNotified`) und bleibt als Hinweis
  unter „Heute“ bis Jahresende.
- Anzeige in Einstellungen → Umsatz-Wächter: Balken mit Stand und Stufen, Monatstabelle (Shop, Tattoo, Flohmarkt,
  Auftragsarbeiten, Sonstiges).
- Hinweistext in der Ansicht: „Der Wächter ersetzt keine Steuerberatung.“

**AK-8-01** Jeder Job ist mit vorgestellter Uhr getestet, inklusive Doppel-Lauf (Idempotenz).
**AK-8-02** Vorkasse (Bestellung Sa 26.09. 10:00): bis Di 29.09. 09:59 keine Mail, ab 10:00 genau eine M03; Do 01.10. 23:59 noch offen, Fr 02.10. 00:00 (nächster Joblauf) Storno + M04 + A03, Stück `available`.
**AK-8-03** Retention: Eine Anfrage wird samt Bildern am Tag nach Eingang + 6 Monate gelöscht (L-10), auch wenn `lastActivityAt` jünger ist; mit Aufbewahrungssperre bleibt sie; je Anfrage ein `deletion-log`-Eintrag ohne Inhalte.
**AK-8-04** Umsatz-Wächter: 19.999 € (keine Meldung), 20.000 € (U1), 25.001 € (U2), 80.000 € (U3), 90.000 € (U3a), 95.000 € (U4), 100.001 € (U5) – je Stufe genau eine A09 im Jahr; Neujahrsprüfung U0.

---

## 9. Tattoo-Bereich

### 9.1 Grundsätze (E-50…E-53)

- **Nicht kaufbar:** keine Warenkorb-Aktion, keine Online-Zahlung, keine Online-Anzahlung, **kein Anfrageformular** (E-51).
  Damit entstehen hier keine Online-Verträge (Konzeptseite „Tattoo“).
- **Anfragen nur per E-Mail** (E-51, seit P12.7/U-15 ohne Instagram-DM); die E-Mail-Adresse steht zusätzlich als kopierbarer
  Text da, weil Mail-Links nicht in jedem Browser funktionieren.
- **Ort:** Privatstudio; öffentlich nur „Privatstudio in Berlin-{Bezirk}“ (E-50). Keine Straße auf Tattoo-Seiten, in
  Angeboten oder in JSON-LD.
- **Preise** sind Gesamtpreise mit Kleinunternehmer-Hinweis (Sternchen, gleiche Fußnote wie im Shop ohne Versandteil).
- **Keine Gesundheitsdaten:** Mail-Vorlagen enthalten den Satz „Bitte keine Gesundheitsinfos – die klären wir persönlich.“
- **Fotos von Kund:innen** nur mit Einwilligungs-Häkchen (E-42). Motive mit fremden Figuren (z. B. „Godzilla“) nur im
  Portfolio, nie als Verkaufsware (E-18, Manifest).

### 9.2 Seiten und Inhalte

| Seite | Blöcke (Reihenfolge) | Leerzustand |
|---|---|---|
| R11 Übersicht | H1 „Tattoo“; **Mein Stil** (Fine Line, naiv, mit Humor – Text in Juttas Ton); 3 verfügbare Flash-Motive; 3 Bilder aus der Galerie (bevorzugt „healed“); Links zu allen Unterseiten mit je einem Satz; Kontakt-Block | Blöcke ohne Inhalt entfallen |
| R12 Flash | Einleitung; Filter „alle“/„verfügbar“ (Links, `?available=1`); Raster der Motive (§9.3); Kontakt-Block | „Gerade keine Flash-Motive online – schreib mir deine eigene Idee“ |
| R14 Preise | Mindestpreis; Flash: „Jedes Flash-Motiv hat einen Festpreis – steht direkt am Motiv“ + Link R12; Custom: Preisrahmen-Text; Anzahlung: Text (vereinbaren wir persönlich, außerhalb der Website); Kleinunternehmer-Fußnote; Kontakt-Block | – |
| R15 Galerie | Filter „alle“/„fresh“/„healed“ (Links, `?kind=fresh|healed`); Raster; Bild antippen → Vollbild mit Bildunterschrift; Kontakt-Block | „Hier kommen bald Fotos“ |
| R16 Ablauf | 5 Schritte (Konzeptseite): **Anfrage → Termin → Anzahlung (offline) → Stechen → Aftercare**, je Schritt 1–3 Sätze; Hinweis „Tattoos erst ab 18“; Ort; Kontakt-Block | – |
| R17 Aftercare | Phasen: direkt danach · Tag 1–3 · Woche 1–2 · Woche 3–6 · langfristig (Sonnenschutz); „Warnzeichen – wann zum Arzt“; Link auf die Safer-Tattoo-Checklisten des Bundesumweltministeriums (einfacher externer Link); druckfreundliche Darstellung (Druck-CSS) | – |
| R18 FAQ | Fragen als aufklappbare Einträge (`<details>`), Reihenfolge pflegbar; Themen mindestens: ab 18, Privatstudio/Bezirk, Anzahlung, Absagen/Verschieben, Coco im Studio (Allergien), Farbe/Schwarz, Cover-ups, Instagram-DM vs. Mail | „Noch keine Fragen“ (nur im Admin sichtbar relevant) |

### 9.3 Flash (E-52)

**Felder** (`flash`, DATENMODELL §6.14): `number` (Ganzzahl 1–9999, eindeutig, Anzeige `F-012`, vorbelegt mit höchster
+ 1 ohne Beispieldaten; Seed-Motive `F-901` ff., §11.2), `title` (DE/EN, 2–60), `image` (Zeichnung, Pflicht, nicht
`restricted`, Alt-Text DE und EN), `extraImages` (bis 4), `sizeCm` (ungefähre Größe in cm, Pflicht) und `sizeNote` (DE/EN,
z. B. „Größe anpassbar“), `priceCents` (**Festpreis, Pflicht**, ≥ 10,00 €, E-53), `repeatable` (einmalig = aus,
wiederholbar = an), `status` (`available` | `claimed`), `claimedAt`, `published`, `sortOrder`.

**Anzeige je Karte:** Zeichnung, `F-012`, Titel, Größe, Preis mit Sternchen, Badge „einmalig“ bzw. „wiederholbar“.
- `available`: Knopf **„Per Mail anfragen“** (§9.4).
- `claimed`: Stempel **„vergeben“** (EN-Anzeigetext „taken“; gespeichert wird nur `status = claimed`), keine
  Anfrage-Knöpfe, Text „Schon vergeben – schau dir die anderen an“;
  bleibt sichtbar (hinter den verfügbaren), außer `published=false`.
- Sortierung: `available` nach `sortOrder`, dann `claimed` nach `sortOrder`.
- Jede Karte hat den Anker `#f-012`, damit Links direkt auf ein Motiv verlinken können.

**Admin:** „verfügbar ↔ vergeben“ mit höchstens 2 Taps (§7.12). Es gibt nur das Feld `status` mit den Werten aus
DATENMODELL `FLASH_STATUSES` (`available`, `claimed`); Filter wie `?available=1` (§2.3) lesen dieses Feld. Einmalige
Motive stellt Jutta nach dem Stechen auf `claimed`. Wiederholbare Motive bleiben immer `available` (DB-CHECK); zum Pausieren nimmt Jutta sie offline
(`published = false`).

### 9.4 Mail-Knopf (seit P12.7 ohne DM)

**Mail-Knopf:** `mailto:{settings.social.contactEmail}?subject={Betreff}&body={Text}`; Kodierung nach RFC 6068
(`encodeURIComponent`, Zeilenumbruch `%0D%0A`).

| Anlass | Betreff DE | Betreff EN |
|---|---|---|
| Flash | `Flash-Anfrage F-012 – Kelch mit Schlange` | `Flash request F-012 – Chalice with snake` |
| Kontakt-Block allgemein | `Tattoo-Anfrage` | `Tattoo request` |
| Eigene Idee (R14, R16) | `Tattoo-Anfrage – eigene Idee` | `Tattoo request – custom idea` |

Text (Flash, DE; andere Anlässe sinngemäß, EN entsprechend):

```
Hi Jutta,

ich interessiere mich für Flash F-012 („Kelch mit Schlange“).

Stelle am Körper:
Ungefähre Größe:
Wunschzeitraum:

(Bitte keine Gesundheitsinfos – die klären wir persönlich.)

Liebe Grüße
```

**Kein DM-Knopf (P12.7, U-15):** Es gibt keine Direktnachricht-Links und keinen kopierbaren DM-Baustein mehr; das
Instagram-Profil ist nur im Fuß verlinkt, ohne Anfrage-Aufforderung.

**Kopierbare Adresse** (Kontakt-Block und neben jedem Mail-Knopf erreichbar): E-Mail als Text + Knopf „Adresse kopieren“
(Clipboard-API; Rückfall: Text wird markiert mit Hinweis „Jetzt kopieren“). Rückmeldung „Kopiert“ (`aria-live`).

### 9.5 Angebote: entfallen (P12.7, U-14)

„Angebote“ (Flash-Days und Aktionen, Collection `tattoo-offers`, Route R13, Task `revalidateEndedOffers`) gibt es nicht mehr.
Seite, Navigationspunkt, Verwaltungs-Reiter, Collection samt Beispieldaten und Task sind entfernt (Migration
`p12_remove_offers`); die Routen-IDs R14–R18 bleiben unverändert. Termine außer Haus zeigt die Startseite als
„Planet Claire on Tour“ (§3.1a, U-20).

### 9.6 Preise

Zahlen in `settings.tattoo`: `minPriceCents` (Anzeige „Mindestpreis {Betrag}“), `customPriceFromCents`/`customPriceToCents`
(Preisrahmen für eigene Ideen, z. B. „meist 150–400 €, je nach Größe und Aufwand“), `priceNote` (DE/EN). Texte zu Custom-Preisen
und Anzahlung stehen im Block `priceInfo` der Seite `tattoo` (`pages`), den R14 rendert. **Nicht verwenden** in
Tattoo-Texten (Prüfung beim Speichern mit Warnung; Speichern bleibt möglich): „nicht erstattbar“, „verfällt“ bezogen auf
Anzahlungen (Rechtsrisiko laut Recherche) – die Regeln zur Anzahlung vereinbart Jutta individuell per Mail. Keine
Online-Anzahlung (E-53).

### 9.7 Galerie mit Einwilligung und `SEED_PREVIEW_MODE`

**Felder je Galerie-Eintrag** (`tattoo-gallery`, DATENMODELL §6.16): `image` (Pflicht) und `extraImages` (bis 4; Alt-Text
DE und EN), `kind` (`fresh` | `healed`), `healedDurationMonths` (Pflicht bei `healed`, Anzeige z. B. „3,5 Jahre verheilt“)
bzw. `healedLabel` (DE/EN, überschreibt die Anzeige), `caption` (DE/EN), `placement` (optional), `flash` (optional),
`showsCustomer` (Standard an), `consentGiven` (**Standard aus**), `consentScope`, `consentDate` und `consentNote` (Pflicht
bei `consentGiven`, z. B. „per Mail am …“), `consentEvidence` (privat, empfohlen), `creditHandleAllowed`/`creditHandle`,
`published`, `featured`, `sortOrder`, `seed`.

**Regel (E-42, R-172, R-181)** – gilt für die Galerie und für alle Bilder in `media`:

```
seedPreviewModeActive() = (env SEED_PREVIEW_MODE == "true") AND (APP_ENV != "production")

isPubliclyVisible(galleryEntry) =
       galleryEntry.published == true
   AND (   galleryEntry.showsCustomer == false
        OR galleryEntry.consentGiven == true
        OR (galleryEntry.seed == true AND seedPreviewModeActive()))

isPubliclyVisible(media) =
       (media.restricted == false OR (media.seed == true AND seedPreviewModeActive()))
   AND (media.showsPerson != "jutta" OR media.ownerApproved == true)
```

- `media.restricted` wird aus der Galerie gesteuert (`true`, solange ein Bild mit `showsPerson = customer` in keinem
  veröffentlichten Eintrag mit Einwilligung steckt). Bilder mit `showsPerson = customer` werden mit kurzer Cache-Dauer
  ausgeliefert, damit ein Widerruf spätestens nach 24 h wirkt (L-20).
- Die Regel gilt **überall**: Seitenabfragen, Startseiten-Teaser, OG-Bilder, Sitemap und die **Auslieferung der Bilddatei
  selbst** (nicht sichtbare Bilder → 404 für alle außer angemeldetem Admin). Ein erratener Datei-URL darf das Bild nicht liefern.
- Seed-Tattoofotos (Manifest: `post-DOZTG7PjLAD.jpg` „3,5 years healed“, `post-DZqBCSZDDiE.jpg` „Godzilla and the bunnies“)
  werden mit `showsCustomer = true`, `consentGiven = false`, `seed = true` und `media.restricted = true` angelegt. Fotos,
  die Jutta zeigen (`post-DdHXUQsDjqm.jpg`, `profil.jpg`), werden **nie** importiert und nie als Zeichenvorlage genutzt;
  eigene Fotos von Jutta erscheinen erst ab P8 mit `media.ownerApproved` (R-181).
- `SEED_PREVIEW_MODE=true` ist gesetzt in: Preview-Deployments (ab P11, geschützt) und beim Vorschau-Export (§12). Mit
  `APP_ENV=production` bricht der Start ab (R-181); zusätzlich liefert `seedPreviewModeActive()` in Produktion immer
  `false`, und die Startklar-Prüfung meldet die Variable rot.
- Veröffentlichen eines Galerie-Eintrags mit `showsCustomer` ohne vollständige Einwilligung ist im Admin gesperrt (§7.12);
  `seed`-Einträge sind davon ausgenommen (sie gelten ohnehin nur im Vorschau-Modus als sichtbar).

**AK-9-01** Auf keiner Tattoo-Route (DE/EN) existiert ein Element „In den Korb“, ein Formular oder ein Stripe-Request.
**AK-9-02** Der Mail-Knopf von `F-012` hat exakt den Betreff `Flash-Anfrage F-012 – {Titel}` (DE) bzw. `Flash request F-012 – {title}` (EN).
**AK-9-03** (P12.7, U-14) Es gibt keine Angebote mehr: `/de/tattoo/angebote` und `/en/tattoo/offers` liefern 404, R11 und die Startseite zeigen keine Angebotskarte.
**AK-9-04** Mit `APP_ENV=production` und `SEED_PREVIEW_MODE=true` startet die App nicht (Abbruch mit Fehlermeldung), und `seedPreviewModeActive()` liefert `false` (Unit-Test); mit `APP_ENV=preview` und `SEED_PREVIEW_MODE=true` antwortet die Bildroute eines Seed-Tattoofotos mit 200; ohne die Variable mit 404.
**AK-9-05** Auf Tattoo-Seiten erscheint keine Straßenadresse (Test sucht nach der Straße aus den Stammdaten).

---

## 10. Auftragsarbeiten-Formular

### 10.1 Zweck und Rahmen (E-11)

Auftragsarbeiten (z. B. Cap mit Wunschmotiv, Teller mit Wunschtext) sind **nicht kaufbar**. Das Formular sammelt Anfragen;
Angebot und Bezahlung laufen per Mail außerhalb des Shops. Rechtsgrundlage für die Verarbeitung: vorvertragliche Anfrage
(Datenschutzhinweis, **keine** Einwilligungs-Checkbox; RECHT kann ändern).

### 10.2 Felder und Validierung

Feldnamen und Grenzen laut DATENMODELL §6.17 (`inquiries`), Uploads laut ARCHITEKTUR §8.8.

| Feld (Label DE) | Name | Pflicht | Validierung / Regel |
|---|---|---|---|
| Name | `name` | ja | 2–100 Zeichen |
| E-Mail | `email` | ja | gültig, ≤ 254 |
| Was soll es werden? | `objectType` | ja | Auswahl laut `INQUIRY_OBJECT_TYPES`: `cap` (Cap) · `shirt` (Shirt) · `textil_sonstiges` (andere Kleidung/Stoff) · `teller` (Teller) · `schale` (Schale) · `tasse` (Tasse) · `fliese` (Fliese) · `zeichnung` (Zeichnung/Bild) · `schmuck` (Schmuck) · `sonstiges` (Etwas anderes) |
| Etwas anderes – was? | `objectTypeOther` | wenn `sonstiges` | ≤ 80 |
| Was stellst du dir vor? | `idea` | ja | 20–3000 Zeichen; Hilfetext „Motiv, Farben, Text, Größe – alles, was hilft. Bitte keine Gesundheitsangaben und keine Fotos von Personen.“ |
| Wunschzeitraum | `desiredTimeframe` | nein | ≤ 120 (z. B. „bis Weihnachten“) |
| Budget | `budget` | nein | ≤ 60, Freitext (z. B. „ca. 80 €“) |
| Bilder | `referenceImages` | nein | **0–5**; nur JPEG/PNG/WebP (Prüfung über den Inhalt); Auswahl je Datei ≤ 15 MB; Verkleinerung im Browser auf ≤ 2560 px und ≤ 4 MB; **jedes Bild einzeln** hochgeladen (`POST /api/uploads/commission`, Hosting-Grenze 4,5 MB je Anfrage; größer → 413 mit verständlichem Text) als temporärer Upload (`private-uploads`, Status `pending`, Löschung nach 24 h, falls nicht abgeschickt); Server kodiert neu, entfernt EXIF/GPS, speichert **privat**; Hinweis „Bitte keine Fotos, auf denen Personen erkennbar sind.“ |
| Sprache | `locale` | automatisch | aus der Route |
| Honeypot | `website` (Vorschlag) | – | unsichtbar für Menschen (`aria-hidden`, `tabindex=-1`, `autocomplete=off`); ausgefüllt → **Schein-Erfolg**, nichts gespeichert, keine Mail |
| Ausfüllzeit | signiertes Zeitstempel-Token | – | Absenden < 3 s nach dem Laden → Schein-Erfolg, nichts gespeichert |

Unter dem Knopf **„Anfrage senden“** (EN „Send request“) der Datenschutzhinweis (Baustein `inquiry.privacyNotice`): „Ich
nutze deine Angaben und Bilder nur, um deine Anfrage zu beantworten. Alles wird spätestens 6 Monate nach Eingang gelöscht.
Mehr in der [Datenschutzerklärung].“ (Wortlaut: RECHT). Die Fassung der aktiven Datenschutzerklärung wird an der Anfrage
gespeichert (`privacyNoticeVersion`).

### 10.3 Schutz vor Missbrauch

- Honeypot + Mindest-Ausfüllzeit (oben); **kein** CAPTCHA von Drittanbietern (E-43).
- **Rate-Limit** je IP-Hash (HMAC der IP mit täglich wechselndem Schlüssel, ARCHITEKTUR §8.6; Zähler höchstens 24 h
  gespeichert, §8.3): Bucket `commission_submit` höchstens 5 Anfragen pro Stunde und 20 pro Tag;
  darüber HTTP 429 mit Text „Du hast gerade schon mehrere Anfragen geschickt – bitte versuch es später nochmal oder schreib
  mir eine Mail.“ Temporäre Uploads (Bucket `commission_upload`): höchstens 15 pro IP-Hash und Stunde.
- Uploads nur mit gültigem, kurzlebigem Formular-Token; Server prüft Dateityp anhand des Inhalts (nicht nur der Endung).

### 10.4 Ergebnis, Speicherung, Löschung

- Erfolg: Formular wird ersetzt durch „Danke! Deine Anfrage **AA-2026-0007** ist angekommen. Du bekommst gleich eine
  Bestätigung per Mail.“ → Mail **M11** an die Anfragende, **A05** an Jutta (nur Referenz, Gegenstand, Anzahl Bilder,
  Admin-Link – ohne Name, E-Mail, Text und Bilder).
- Speicherung: Anfrage-Datensatz in `inquiries` (Status `new`, `createdAt`, `lastActivityAt` nur zur Anzeige, `deleteAfter`)
  und Bilder im privaten Speicher (`attached`, `relatedInquiry`); Anzeige nur im Admin (§7.11); nie per Mail-Anhang, nie
  öffentliche URL.
- **Löschung:** Anfrage **und** Bilder 6 Monate nach Eingang (`deleteAfter = createdAt + 6 Monate`, L-10, Task
  `retentionCommissionInquiries`, §8.2), unabhängig vom Bearbeitungsstand; Admin sieht „wird gelöscht am …“; keine
  Verlängerung (nur eine Aufbewahrungssperre mit Begründung schiebt die Löschung auf). „Jetzt löschen“ jederzeit.
- Fehlerfälle: Upload fehlgeschlagen → Hinweis am Bild, Absenden ohne das Bild möglich; Serverfehler → Formularinhalt
  bleibt erhalten (nicht speichern im Browser-Storage, nur im Seitenzustand).

**AK-10-01** Formular mit 5 Bildern à 3,9 MB wird vollständig gespeichert; ein 6. Bild wird abgelehnt.
**AK-10-02** Honeypot ausgefüllt oder Absenden nach < 3 s → Erfolgsanzeige, aber kein Datensatz und keine Mail.
**AK-10-03** Das 6. Absenden innerhalb einer Stunde vom selben IP-Hash → 429.
**AK-10-04** Gespeicherte Anfrage-Bilder enthalten keine EXIF-/GPS-Daten und sind ohne Admin-Anmeldung nicht abrufbar.

---

## 11. Beispielbestand

### 11.1 Zweck und Umfang (E-63)

Die Seite und die Verwaltung sollen von Anfang an „bewohnt“ aussehen – für Tests, Vorschau-Datei und Juttas Abnahme.
Die vollständige Liste (Datensätze, Texte, Bildzuordnung, Datumslogik) steht in **`content/seed/SEED-SPEC.md`**; die
**Mengen** stehen ausschließlich in SEED-SPEC §0.1 (Nummernbereiche SEED-SPEC §0.3 und DATENMODELL §13.3). Dieses
Dokument wiederholt keine Anzahlen, sondern legt fest, was der Bestand fachlich abdecken muss:

| Bereich | Muss abdecken |
|---|---|
| Stücke | alle 6 Kategorien; alle Werte aus `PRODUCT_STATUSES`, verkaufte mit und ohne Archiv, `soldChannel` `online`/`pickup`/`offline`; alle 4 Versandklassen inkl. `nur_abholung`; abweichende Beschaffenheit; Textil mit „Etikett fehlt“; Schmuck mit Nickel-Nachweis; **alle Keramik-Stücke `foodContact = deko`** (keine Konformitätserklärung im Seed; lebensmittelechte Keramik gibt es nur als Test-Fixture im Bereich 980–999, §11.2) |
| Bestellungen | Nummern `PC-2026-900NN`; **jeder Wert aus `ORDER_STATUSES`** mindestens einmal, `refunded` sowohl nach Voll-Widerruf als auch nach Erstattung einer bezahlten Bestellung vor dem Versand (O15), darunter `disputed` mit `statusBeforeDispute` und `cancelled` mit `payment_timeout`; alle Zahlwege (Karte, Apple Pay, Google Pay, PayPal, Vorkasse), Versand und Abholung, eine Teil-Erstattung; gepackte/versendete Bestellungen mit Verpackungsdaten; erkennbar erfundene Namen („Paula Beispiel“), E-Mail-Adressen nur `@example.com`/`@example.org`; jede Bestellung sichtbar als „Beispiel“ gekennzeichnet |
| Kassen | Vorgänge ohne Bestellung sind Kassen (`checkouts`): abgelaufen (PayPal abgebrochen) und offen (Stück gerade reserviert), dazu die abgeschlossenen Kassen der Bestellungen jünger als 30 Tage (L-03) |
| Belege | Rechnungen/Gutschriften passend zu den Bestellungen in den Serien `BSP-RE-…`/`BSP-GS-…`, sichtbar als „Beispiel“ gekennzeichnet |
| Widerrufe | Nummern `WR-2026-9000N`: automatisch und manuell zugeordnet, nicht zugeordnet, ohne Bestellung; **jeder Wert aus `WITHDRAWAL_STATUSES`** (auch `closed` mit `closeReason` und `rejected` mit Begründung, z. B. Test-Eingabe); auch auf Englisch |
| Anfragen (Auftragsarbeiten) | Nummern `AA-2026-900N`, **jeder Wert aus `INQUIRY_STATUSES`**, auch mit Bildern (eigene Bilder, keine Personen), auch auf Englisch |
| Reklamationen | mindestens eine je Wert aus `COMPLAINT_STATUSES` (Transportschaden und Mangel, mit und ohne Fotos, Reparatur-Wahl M12 und Streitbeilegungshinweis M13), jeweils an einer bezahlten Beispiel-Bestellung |
| Datenschutz-Anfragen | Nummern `DS-2026-900N`, mindestens eine je Wert aus `PRIVACY_REQUEST_STATUSES` (verschiedene Arten und Eingangskanäle, Fristen passend zu `SEED_NOW`); Exportdateien nur, solange sie nach L-17 noch existieren würden |
| Flash | Nummern ab 901 (Anzeige `F-901`); einmalige und wiederholbare Motive, darunter `claimed` |
| Galerie | fresh und healed, darunter die Tattoofotos aus dem Manifest (`showsCustomer = true`, `consentGiven = false`) und Platzhalter |
| Texte | alle Seiten (`pages`, jeder Wert aus `PAGE_KEYS`: Startseite mit Stationen, Über mich & Coco, Auftragsarbeiten, Kontakt, Shop, Archiv, Tattoo, Aftercare, Danke, Bestellstatus, Widerruf, Konformität, 404) und FAQ – **alles DE und EN ausformuliert** in Juttas Ton (E-62), kein „Lorem ipsum“ |
| Rechtstexte | **kein Beispielbestand:** der Grund-Seed (P1) legt je Typ eine Platzhalter-Fassung an (`seed = false`, `origin = placeholder`, `isPlaceholder = true`, `validFrom = 2026-01-01`), deutlich gekennzeichnet („PLATZHALTER – nicht rechtsverbindlich“), mit Tokens aus §7.13; sie bleiben beim Entfernen der Beispieldaten, bis echte Texte aktiv sind |
| Einstellungen | Grund-Seed: erkennbare Platzhalter-Stammdaten laut SEED-SPEC (z. B. „[Adresse folgt]“), Beispiel-IBAN `DE36000000000000000000` (Prüfziffer gültig, keine echte Bank; Startklar-Prüfung und Go-live-Sperre melden genau diesen Wert als Platzhalter), Versandpreise laut E-25, Platzhalter-Bezirk, Abhol-Vorlage |
| Umsatz-Wächter | Beispiel-Monatssummen der Quellen Tattoo und Flohmarkt für die Admin-Vorschau; trägt Jutta eine echte Summe für denselben Monat und dieselbe Quelle ein, ersetzt sie den Beispiel-Eintrag (der Beispiel-Eintrag wird gelöscht) |
| Protokolle | Mail-, Einwilligungs- und Audit-Protokoll passend zu den Vorgängen |
| Bilder | Ausschnitte aus `content/seed/instagram/` gemäß Feld `use` im Manifest und Platzhalter im Linienstil; **keine** Fotos, die Jutta zeigen; **keine** Bilder oder Texte aus fremden Shops (E-63) |

### 11.2 Regeln

1. **Jedes Dokument des Beispielbestands trägt `seed=true`** (auch Medien, Mail-Protokolle, Status-Historien, Belege).
   **Grunddaten** (Kategorien §2.2, Standard-Einstellungen wie Versandklassen und Lieferzeit, `site-texts`, die
   Platzhalter-Rechtstexte) sind keine Beispieldaten, werden vom Grund-Seed (P1, `pnpm seed:base`) angelegt und tragen
   `seed=false`, weil sie im Echtbetrieb bleiben (bzw. durch neue Fassungen abgelöst werden).
2. **Idempotent:** eindeutiger `seedKey` je Dokument (Feld aus dem Baustein `seedField()` in allen seedbaren Collections,
   partieller UNIQUE-Index `WHERE seed_key IS NOT NULL`); ein zweiter Lauf aktualisiert statt zu verdoppeln.
3. **Nie automatisch in Produktion:** Der Seed ist nicht Teil von Build, Migration, Deploy oder `postinstall`. Das
   Seed-Skript bricht bei `APP_ENV=production` (bzw. Produktions-Datenbank laut ARCHITEKTUR) mit Exit-Code 1 ab; es gibt
   keinen Schalter, der das umgeht.
4. **Keine Nebenwirkungen:** Der Seed sendet keine Mails, ruft weder Stripe noch DeepL auf und löst keine Jobs aus.
   Bestellungen werden mit Endstatus und Historie direkt angelegt; Beleg-PDFs werden mit `BSP-`-Nummern und sichtbarem
   Hinweis „Beispiel“ erzeugt. Kassen- und Status-Token der Beispieldaten erzeugt `seedToken(seedKey, 'checkout' | 'status')`
   deterministisch aus dem `seedKey` (für Tests und Vorschau; ARCHITEKTUR §8.6), **nie** aus der Bestellnummer oder aus
   `PAYLOAD_SECRET`. Nur im Seed-Kontext (`req.context.seed === true`) erlauben die Hooks: Anlegen mit Endstatus
   und vergangenen Zeitstempeln, `receivedAt` aus den Daten, Galerie-Einträge ohne Einwilligung (nur mit `seed=true`,
   sichtbar nur bei wirksamem `SEED_PREVIEW_MODE`, §9.7) und Rechtstexte mit `validFrom` in der Vergangenheit.
5. **Eigene Nummernkreise:** Bestellungen `PC-2026-900NN` (feste Nummern `PC-2026-90001` …, ohne Sequenzwerte zu ziehen),
   Rechnungen `BSP-RE-{JJJJ}-{NNNNN}` und Gutschriften `BSP-GS-{JJJJ}-{NNNNN}` (eigene Serien mit eigenem Zähler),
   Widerrufe `WR-2026-9000N`, Anfragen `AA-2026-900N` und Datenschutz-Anfragen `DS-2026-900N` mit festen Seed-Nummern
   laut DATENMODELL §13.3. Jede
   Beispiel-Bestellung und jeder Beispiel-Beleg
   trägt zusätzlich sichtbar „Beispiel“. Echte Zähler bleiben unberührt. Stück- und Flash-Nummern des Seeds beginnen bei
   901 (Anzeige `Nr. 901` bzw. `F-901`; genaue Bereiche SEED-SPEC §0.3); E2E-Fixtures nutzen 980–999 und existieren nur in der Test-Datenbank (dort auch
   lebensmittelechte Keramik mit Konformitätserklärung – **nicht** im Seed). Der Bereich 901–999 ist für Juttas Nummern
   gesperrt, solange Beispieldaten existieren (DATENMODELL §13.3); nach dem Entfernen ist er wieder frei.
6. **Relative Daten:** Alle Datumsangaben werden relativ zu `SEED_NOW` berechnet (ISO 8601; leer = jetzt; CI
   `2026-10-15T10:00:00+02:00`; Vorschau-Export: Exportdatum 12:00 Berlin), damit Termine „kommend/vorbei“ und
   Vorkasse-Fristen plausibel sind. Ausnahme: Seed-Rechtstexte haben fest `validFrom = 2026-01-01`.
7. **Einwilligung:** Tattoofotos von Kund:innen aus dem Manifest werden als Galerie-Einträge mit `showsCustomer = true`,
   `consentGiven = false` und ihre Bilder mit `showsPerson = customer`, `restricted = true` angelegt (§9.7). Fotos, die
   Jutta zeigen, werden nicht importiert.
8. **Erfundene Personen:** Namen erkennbar erfunden, E-Mail-Adressen nur `@example.com`/`@example.org`, keine
   Telefonnummern. Der Mailversand unterdrückt unabhängig vom Seed immer Empfänger unter `example.com`, `example.org`,
   `example.net`, `*.invalid` und `*.test`.

### 11.3 Knopf „Beispieldaten entfernen“

- Ort: Einstellungen → Beispieldaten (Anzahl `seed=true` je Collection, `GET /api/admin/seed/summary`); Aktion
  `POST /api/admin/seed/remove`; zusätzlich CLI `pnpm seed:remove --yes [--drop-texts]` (ohne `--yes` nur Mengenvorschau).
- **Sperre des Knopfs:** gesperrt, solange irgendein aktiver Rechtstext `isPlaceholder = true` hat (also nicht alle
  aktiven Rechtstexte echte Fassungen sind); der Knopf zeigt dann „Bitte zuerst die Texte der Kanzlei einsetzen – sonst
  wären die Rechtsseiten leer.“ und die betroffenen Typen. Die CLI hat diese Sperre nicht (Entwicklung, Test,
  Vorschau-Export); gegen eine als Produktion markierte Datenbank oder mit `APP_ENV=production` bricht sie immer ab
  (ARCHITEKTUR §4.8).
- Dialog nennt die Anzahlen und bietet die vorausgewählte Checkbox „Seitentexte und FAQ behalten“ (`keepTexts`):
  angehakt werden nicht übernommene Seiten und FAQ samt ihrer Bilder übernommen (`seed=false`), sonst gelöscht (das
  Frontend zeigt dann Leerzustände). Bestätigung durch Eintippen von `ENTFERNEN`.
- Wirkung: löscht **alle** übrigen Dokumente mit `seed=true` in allen Collections samt Dateien (Reihenfolge DATENMODELL
  §13.5) – ausdrücklich auch die Belege der Serien `BSP-RE`/`BSP-GS` (einzige Ausnahme von der Unveränderlichkeit) –,
  löscht die Zähler dieser Serien, revalidiert alle öffentlichen Seiten und schreibt einen zusammenfassenden
  Audit-Eintrag `seed_removed` mit den Mengen je Collection und **keinen** `deletion-log`-Eintrag (keine realen Personen,
  L-22, DATENMODELL DM-20). Grunddaten
  (inkl. Platzhalter-Rechtstexte) und echte Dokumente bleiben unberührt. Mehrfach ausführbar.

### 11.4 Sichtbarkeit von Beispieldaten

- Beispieldaten verhalten sich wie echte Daten (öffentlich sichtbar, wo sie in Entwicklung/Preview existieren) – mit der
  Ausnahme einwilligungspflichtiger Medien (§9.7).
- Ist `SEED_PREVIEW_MODE` wirksam, zeigt jede öffentliche Seite das Banner „Vorschau mit Beispieldaten“, und
  Kundenfotos ohne Einwilligung tragen das Etikett „intern – Einwilligung fehlt“ (R-182).
- Exporte (Monats-CSV, DATEV-Buchungsstapel, Rechnungs-ZIP, Verpackungs-CSV) enthalten **nie** Beispieldaten – auch
  nicht bei wirksamem `SEED_PREVIEW_MODE` (§7.15). Nur der Umsatz-Wächter zählt Beispieldaten bei wirksamem
  `SEED_PREVIEW_MODE` mit (damit die Admin-Vorschau gefüllt ist).
- Die Startklar-Prüfung meldet vorhandene Beispieldaten rot (§7.16).

**AK-11-01** Zweimal `pnpm seed` → identische Anzahlen je Collection.
**AK-11-02** Nach `pnpm seed` hat jedes vom Seed erzeugte Dokument `seed=true` (Test iteriert alle Collections außer Grunddaten).
**AK-11-03** Nach „Beispieldaten entfernen“ gibt es 0 Dokumente mit `seed=true`; vorher angelegte echte Dokumente, Grunddaten und die echten Zähler sind unverändert; solange ein aktiver Rechtstext `isPlaceholder = true` hat, ist der Knopf gesperrt (Endpoint 409).
**AK-11-04** `APP_ENV=production pnpm seed` und `pnpm seed` gegen eine als Produktion markierte Datenbank enden mit Exit-Code 1 und ändern nichts.
**AK-11-05** Mit vollständigem Beispielbestand und `SEED_PREVIEW_MODE=true` enthalten Monats-CSV, DATEV-Buchungsstapel, Rechnungs-ZIP und Verpackungs-CSV keinen Datensatz mit `seed=true` (bei reinem Beispielbestand nur Kopfzeile bzw. leeres ZIP).

---

## 12. Single-File-Vorschau

### 12.1 Ziel (E-98)

Die ganze Website als **eine einzige HTML-Datei** `planet-claire-vorschau.html`: alle öffentlichen Seiten in DE und EN,
Bilder, Schriften und Animationen eingebettet, offline auf jedem Rechner im Browser öffnbar, ohne Server und ohne Konten.
Die Kasse ist eine Attrappe. Zwischenversionen ab P2 nach jeder Phase; die finale Version in P10.

### 12.2 Befehl und Ausgabe

| Punkt | Festlegung |
|---|---|
| Befehl | `pnpm preview:export` |
| Ausgabe | `dist/planet-claire-vorschau.html` und Bericht `dist/planet-claire-vorschau.report.json` (Routen, Größen je Art, Warnungen, Phase, Git-Commit, Stand-Datum) |
| Versionierung | `dist/` steht in `.gitignore`; die Datei wird **nie committet** |
| Voraussetzung | lokales Postgres; keine Zugangsdaten nötig |
| Laufzeit | Ziel ≤ 10 min in CI |

### 12.3 Ablauf des Exports

1. **Umgebung** (vom Skript gesetzt, Namen laut ARCHITEKTUR §5.2, vollständige Liste ARCHITEKTUR §14.3): `APP_ENV=preview`,
   `SEED_PREVIEW_MODE=true`, `PREVIEW_EXPORT=true`, `PAYMENTS_DRIVER=mock`, `EMAIL_DRIVER=memory`, `STORAGE_DRIVER=local`,
   `TRANSLATION_DRIVER=mock`, `SEED_NOW=<Exportdatum>T12:00:00` mit Berliner Offset,
   `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3999`, `JOBS_AUTORUN=false`, `NEXT_PUBLIC_ANALYTICS_ENABLED=false`,
   `PREVIEW_PHASE` (§12.8).
2. **Datenbank:** eigene Datenbank (z. B. `planetclaire_preview_export`) neu anlegen, Migrationen, Grund-Seed, Beispielbestand.
   Für die Screenshots (§12.5 Punkt 9) meldet sich das Skript mit dem Admin-Konto des Grund-Seeds an (`SEED_ADMIN_EMAIL`,
   `SEED_ADMIN_PASSWORD`, nur Testwerte); ein zweites Konto wird nicht angelegt (E-03).
3. **App:** Produktions-Build (`next build`) und Start (`next start`, Port 3999) mit dieser Umgebung.
   `PREVIEW_EXPORT=true` bewirkt: Kasse rendert das Mock-Zahlungsfeld als statischen Platzhalter „Hier erscheint die
   Zahlungsauswahl von Stripe (Karte, Apple Pay, Google Pay, PayPal)“; keine Analytics.
4. **Crawl** mit Playwright/Chromium (Breitensuche, höchstens 500 Seiten):
   - Start-Menge: alle Routen der Routen-Registry (§2.2) in DE und EN, alle Produktseiten und Kategorien des Seeds,
     Danke-Seiten für zwei Seed-Bestellungen (bezahlt, Vorkasse), Bestellstatus für drei Seed-Bestellungen (versendet,
     Vorkasse offen, erstattet), R26 (Schritt 1), eine 404-Route je Sprache.
   - Warenkorb und Kasse: Der Crawler legt 2 Seed-Stücke in den Korb, klickt „Zur Kasse“ und erfasst dann R06 und R07
     (je Sprache).
   - Folgt allen internen Links auf öffentliche Routen (inkl. Query `available`, `category`, `kind`, `page`); ignoriert
     `/api`, Admin-Pfad, externe Links.
   - Erfasst wird das **serverseitig gerenderte HTML** jeder Route (nicht der animierte DOM-Zustand) plus alle
     referenzierten Stylesheets, Schriften und Bilder. Routen, die in der aktuellen Phase noch 404 liefern, werden als
     „noch nicht gebaut“ vermerkt und ausgelassen.
5. **Umwandlung** (§12.5), **Schreiben**, **Größenprüfung** (§12.6), Bericht.

### 12.4 Aufbau der Datei

```
<!doctype html><html lang="de">
<head>  <meta charset> <title>  <style> alle CSS (dedupliziert), @font-face als data:font/woff2 </style>  </head>
<body>
  <div id="pv-banner">…</div>   <div id="pv-root"></div>
  <template data-route="/de" data-title="…" data-lang="de">…Kopf, Inhalt, Fuß…</template>
  <template data-route="/de/shop">…</template>   … (eine je Route inkl. Query-Variante)
  <script type="application/json" id="pv-assets">{"<hash>":"data:image/webp;base64,…", …}</script>
  <script> Vorschau-Laufzeit (Hash-Router, Behaviors, Dialoge) </script>
</body></html>
```

### 12.5 Umwandlungsregeln

1. **Skripte:** Alle Next.js-/React-Skripte und Hydrations-Daten werden entfernt. Stattdessen **eine** eingebettete
   Vorschau-Laufzeit (Quelltext im Repo, z. B. `src/preview-runtime/`), die die Behaviors aus §12.9 enthält.
2. **CSS:** alle Stylesheets aller Routen zusammengeführt und dedupliziert in einem `<style>`; `url()`-Verweise auf Bilder
   als Data-URI (nach Punkt 4), Schriften als `data:font/woff2;base64` (die drei selbst gehosteten Familien, E-79).
3. **Seiten:** Inhalt jeder Route (Kopf, Hauptteil, Fuß) als `<template data-route>` mit Titel, Sprache und Beschreibung.
4. **Bilder:** je Bild genau eine Fassung: längste Kante **≤ 1200 px**, **WebP, Qualität ≈ 70**; SVG bleibt SVG (inline oder
   Data-URI). Dedupliziert nach Inhalts-Hash, einmal in `#pv-assets` gespeichert; in den Templates
   `<img data-pv-src="<hash>" width height alt>` (`srcset`/`sizes` entfernt, Maße für stabiles Layout erhalten).
5. **Links:** interne Links `/de/shop/017-…` → `#/de/shop/017-…`; Query bleibt (`#/de/shop?available=1`); Anker werden
   angehängt (`#/de/tattoo/flash#f-012`; Seiten-Anker `#kontakt` → `#/<aktuelle Route>#kontakt`). Links auf nicht
   exportierte Ziele (API, PDFs, Admin, nicht gebaute Routen) → `#/vorschau/nicht-enthalten` (Infoseite „Das gibt es nur auf
   der echten Website“). Externe `https:`-Links bleiben (öffnen in neuem Tab mit `rel="noopener"`), `mailto:` bleibt.
6. **Hash-Router:** leerer Hash → `#/de`; Routenwechsel ersetzt `#pv-root`, setzt `document.title` und `lang`, scrollt nach
   oben bzw. zum Anker, setzt den Fokus auf die H1, hängt Behaviors der alten Seite ab und der neuen an; Zurück/Vor des
   Browsers funktioniert. Die Liste aller Routen steht als `window.__PV_ROUTES` bereit.
7. **Kaufen und Formulare deaktiviert:** „In den Korb“ spielt den Mikromoment ab, zählt die Korb-Anzeige im Speicher hoch
   und zeigt „In der Vorschau zeigt der Korb ein Beispiel“. Der Knopf **„Zahlungspflichtig bestellen“**, „Zur Kasse“ (führt
   zur erfassten Beispiel-Kasse), jedes Formular-Absenden (Auftragsarbeiten, Vertrag widerrufen, „Nochmal reservieren“) öffnen
   einen Dialog mit dem Text **„Vorschau – hier wird nichts gekauft“** (EN „Preview – nothing can be bought here“). Der
   Countdown der Kasse läuft als Demo ab 30:00 im Speicher. Nichts wird gespeichert (kein Storage, keine Cookies).
8. **Banner** oben auf jeder Seite, nicht verdeckend (Inhalt rückt nach unten): Zeile 1 **„Interne Vorschau – nicht
   weitergeben · Beispieldaten · Rechtstexte sind Platzhalter“** (R-182; EN-Routen englisch), Zeile 2 „Vorschau – hier
   wird nichts gekauft. Stand {Datum}, Phase {Px}.“; Knopf **„Alle Seiten“** öffnet eine Liste aller Routen, gruppiert
   (Start, Shop, Tattoo, Service, Recht, Verwaltung), mit „noch nicht gebaut“-Markierung. Kundenfotos, die nur durch
   `SEED_PREVIEW_MODE` sichtbar sind, tragen das kleine Etikett „intern – Einwilligung fehlt“.
9. **Verwaltung als Bilder:** Route `#/vorschau/verwaltung` mit Screenshots aller Handy-Ansichten aus §7.3–7.15
   (390×844, mit Seed-Daten, WebP ≤ 800 px breit) und je einer Bildunterschrift. Vor P5: Hinweis „kommt in P5“.
   Die echte Verwaltung ist **nicht** enthalten.
10. **Nicht enthalten:** echte Zahlung, Mailversand, Jobs, PDFs, Stripe.js, Analytics, Admin-Funktionen.

### 12.6 Größenbudget

- **Ziel ≤ 20 MB** (dann lässt sich die Datei per Mail verschicken), **harte Grenze 40 MB**: Über 40 MB bricht der Export
  mit Exit-Code 1 ab.
- Richtwerte: Bilder ≤ 10 MB, Schriften ≤ 0,5 MB, CSS + Laufzeit ≤ 1,5 MB, HTML-Templates ≤ 6 MB, Admin-Screenshots ≤ 2 MB.
- Liegt die Datei über 20 MB: zuerst Bildqualität auf 60, dann längste Kante auf 1000 px reduzieren (im Bericht vermerkt).
  Bleibt sie trotzdem über 20 MB (aber ≤ 40 MB), meldet der Bericht eine Warnung, und der Release-Text der finalen
  Vorschau sagt: „Die Datei ist zu groß für eine Mail – auf einen anderen eigenen Rechner bringen (per Link oder
  USB-Stick).“ Der Satz nennt nur eigene Geräte, weil die Datei nach R-182 nicht weitergegeben wird (interne Datei,
  Kanzleifrage K-34; ARCHITEKTUR §6.6, §14.8, Anhang C C-27).

### 12.7 Abnahmetest (`pnpm test:preview-export`, Playwright)

Öffnet `file://…/dist/planet-claire-vorschau.html` in Chromium mit `offline: true` und einem Request-Interceptor, der alles
außer `file:`, `data:` und `blob:` abbricht und protokolliert. Für jede Route aus `window.__PV_ROUTES`, bei 390×844 **und**
1440×900:

1. H1 sichtbar, Banner sichtbar, Fußbereich mit „Vertrag widerrufen“ vorhanden.
2. **0 Netzwerk-Requests** außer `file:`/`data:`/`blob:`; **0 Konsolenfehler** (`console.error`, `pageerror`).
3. Alle `<img>` geladen (`complete && naturalWidth > 0`); alle drei Schriftfamilien geladen (`document.fonts.check`).
4. Jeder interne Link zeigt auf eine Route aus `__PV_ROUTES` oder auf `#/vorschau/nicht-enthalten`.

Zusätzlich:
5. Startseite: Nach Scrollen auf 50 % hat sich die Tuschelinie weiter gezeichnet und Coco bewegt (Messgröße laut DESIGN,
   z. B. `stroke-dashoffset` und Transform); mit `reducedMotion: 'reduce'` ist die Linie vollständig und statisch.
6. Menü öffnet und schließt per Tastatur (`Enter`, `Esc`), Fokus kehrt zurück.
7. „In den Korb“ erhöht die Korb-Anzeige; „Zahlungspflichtig bestellen“ zeigt exakt „Vorschau – hier wird nichts gekauft“;
   Absenden des Auftragsarbeiten-Formulars zeigt denselben Dialog und navigiert nicht.
8. Sprachumschalter führt von `#/de/shop` nach `#/en/shop`; Browser-Zurück funktioniert.
9. Dateigröße ≤ 40 MB (harte Grenze); ob das Ziel ≤ 20 MB erreicht ist, steht im Bericht (§12.6).

### 12.8 CI und Verteilung

- **Zwischenversionen ab P2:** Der GitHub-Actions-Workflow `preview-export.yml` (ARCHITEKTUR §6.5) läuft **nur am
  Phasenende** – beim Phasenende-Commit mit `[ci:full pN]` (ARCHITEKTUR §6.7) –, nicht bei Zwischen-Commits (`[skip ci]`),
  nicht beim Zwischenlauf `[ci:full]` und nicht nach dem Merge auf `main`: Postgres-Service, Installation,
  `pnpm preview:export`, `pnpm test:preview-export`, Upload als **Actions-Artefakt**
  `planet-claire-vorschau-<phase>-<kurz-sha>` (HTML + Bericht), Aufbewahrung 30 Tage; danach löscht der Workflow ältere
  Vorschau-Artefakte, sodass nur die **3 neuesten** bleiben (GitHub Free: 500 MB Artefakt-Speicher, den sich Vorschau,
  Fehlerberichte und das KUNST-QA-Bündel teilen; ARCHITEKTUR §6.1).
  **Phasen-Kennung:** `PREVIEW_PHASE`, falls gesetzt (in CI aus dem Commit-Tag `[ci:full pN]`), sonst aus `PLAN.md`
  (höchste vollständig abgehakte Phase) – **nicht** aus dem Branch-Namen, denn Cloud-Branches heißen `claude/…`
  (Details ARCHITEKTUR §14.9).
  Hinweis für Jutta (Handbuch): GitHub liefert Artefakte als ZIP; darin liegt die HTML-Datei.
- **Final (P10):** GitHub **Release** mit Tag `vorschau-p10`, Titel „Planet Claire – Vorschau (Stand P10)“, die HTML-Datei
  als **Release-Asset** (nicht gezippt). **Nicht im Repository committet.** Spätere Aktualisierungen als neue Releases
  `vorschau-JJJJ-MM-TT`. Der Link steht in der P10-PR-Beschreibung und im Handbuch (`docs/owner/`). Der Release-Text nennt
  die Dateigröße und enthält über 20 MB den Hinweis aus §12.6. Veröffentlicht wird nach dem Merge auf `main` durch
  `release.yml` (Push auf `main`, täglicher Rückfall-Lauf 06:00 UTC oder manueller Start), nur wenn P1–P10 vollständig
  abgehakt sind und das Release fehlt oder veraltet ist (ARCHITEKTUR §6.6).
- Ein fehlgeschlagener Export-Test blockiert den Merge der Phase (ab P2).

### 12.9 Architektur-Voraussetzung (gilt ab P2)

Alles, was in der Vorschau funktionieren muss, wird als **framework-unabhängiges Modul** gebaut: `mount(root: Element) →
unmount()`, angebunden über `data-behavior="…"`-Attribute am serverseitig gerenderten HTML. React-Komponenten nutzen
dieselben Module (z. B. im Effekt). Betroffen: Tuschelinie und Coco, Menü, Galerie/Zoom, Kopier-Knöpfe, Countdown,
Mikromomente („In den Korb“, sold-Stempel, schwingendes Preisschild, Danke-Schlaf, lose Leine der 404), Umgang mit
`prefers-reduced-motion`. Die Module dürfen weder den Next.js-Router noch React-Zustand für ihre Kernfunktion brauchen.
(DESIGN und ARCHITEKTUR übernehmen diese Vorgabe.)

**AK-12-01** `pnpm preview:export && pnpm test:preview-export` ist grün in der Cloud-Sandbox ohne Netzwerkzugang zu Fremddiensten.
**AK-12-02** Ab dem P2-Merge erzeugt der Phasenende-Commit jeder Phase (`[ci:full pN]`) ein Artefakt (abrufbar, solange es zu den 3 neuesten gehört und jünger als 30 Tage ist), andere Commits erzeugen keins; in P10 existiert das Release `vorschau-p10` mit der Datei als Asset, und `git ls-files` enthält keine `planet-claire-vorschau.html`.

---

## 13. Nicht-Ziele

**Aus der Liste „Später“ (ENTSCHEIDUNGEN, bewusst nicht im Plan):**

| Nicht-Ziel | Vorbereitung im Code |
|---|---|
| EU-Versand je Land | Länderliste mit Schalter und Preis-Überschreibung vorhanden, alles aus (E-24) |
| Schweiz | vorbereitet, aus |
| DHL-API / Etiketten per Knopf | Carrier-Schnittstelle mit einzigem Adapter `manual` (E-26) |
| Produktvideos | – |
| Drops, Countdown, Newsletter, Warteliste | – (E-13) |
| Gutscheine, Rabattcodes | – |
| Online-Anzahlung Tattoo | – (E-53) |
| Klarna | – (E-20) |
| Eigene Handschrift-Font | – (E-79: Mansalva) |
| Markt-Modus „Marktkiste“ | nur „Offline verkauft“ (E-28) |
| Kundenkonten | – (E-30) |

**Außerdem nicht im Umfang** (folgt aus Entscheidungen oder ist nicht beauftragt):
- Tattoo-Anfrageformular, Terminbuchung, Kautionsverwaltung (E-51, E-53); Guest-Spot-Liste; „Books open/closed“-Schalter
  (ein pflegbarer Text reicht) [Annahme].
- Varianten, Serien, Lagerbestand > 1 (E-10); Streichpreise, Preis-Historie, Sonderangebote.
- Kassenfunktionen für Flohmarkt/Barverkauf (Bon, Tagesabschluss, TSE) – nur Bestandsänderung (E-28).
- API-Anbindung an Buchhaltungssoftware (E-04); Stripe Tax; E-Rechnung.
- SEPA-Lastschrift, Überweisung über Stripe, Wero; Express-Checkout-Knöpfe außerhalb des Bestellknopfs.
- Cookie-Banner und alle einwilligungspflichtigen Dienste, Instagram-Feeds/Einbettungen, Google Fonts (E-43).
- Native App, Push-Nachrichten, Offline-Betrieb der Verwaltung (E-93).
- Mehrere Admin-Konten oder Rollen (E-03); Zwei-Faktor-Login im Admin [Annahme, Anhang A].
- Rechtstext-Schnittstelle (IT-Recht Kanzlei LTI) – nur spätere Option (E-41).
- Dunkler Tattoo-Bereich, 360°-Ansichten, eigener Maus-Cursor, WebGL (E-74, E-78).
- Versandetiketten der Paketdienste (siehe „DHL-API“ oben). **Im** Umfang sind dagegen das druckbare GPSR-Etikett und
  der Beileger je Stück als PDF (R-203, §7.6, P5), die Erfassung der Verpackung je Sendung und der Jahres-Export der
  Verpackungsmengen für LUCID/duales System (§7.6, §7.15; E-47, P5).
- Shop-Suche, Wunschliste, Bewertungen, Social-Login.

---

## 14. Glossar

| Begriff | Bedeutung |
|---|---|
| **Unikat** | Stück, das es genau einmal gibt (Bestand 1, keine Varianten, E-10). |
| **Objektnummer** | Von Jutta vergebene ganze Zahl je Stück, eindeutig, nach Veröffentlichung unveränderlich; Anzeige `Nr. 017` (E-12). |
| **Kategorie** (`category`) | eine der 6 festen Kategorien `keramik`, `textil`, `cap`, `zeichnung`, `schmuck`, `sonstiges` (§2.2); bestimmt Pflichtfelder, Standard-Versandklasse und Warnhinweise. |
| **Versandklasse** (`shippingClass`) | `brief`, `paket_klein`, `keramik`, `nur_abholung`; im Korb gilt die höchste (E-25). |
| **Lieferart** (`fulfillmentMethod`) | `shipping` (Versand innerhalb Deutschlands) oder `pickup` (Abholung in Berlin, 0 €). |
| **Reservierung** | Zeitweise Sperre eines Stücks (`reservations`): 30 min Anzeige beim Start der Kasse (E-22, technisch §4.6), bei Vorkasse bis `prepayment.dueAt` = 23:59:59 Berlin am 5. Kalendertag nach dem Bestelltag (E-23, §4.8); atomar in der Datenbank. |
| **Kasse (Checkout)** | Interner Datensatz einer laufenden Bezahlung mit Token, Snapshot und Reservierung; nicht zu verwechseln mit der Bestellung. |
| **Stripe Checkout Session, `ui_mode: 'elements'`** | Stripe-Bezahlvorgang, dessen Zahlungsfeld auf der eigenen Kassen-Seite liegt; ausgelöst durch den eigenen Knopf (E-21). |
| **Webhook** | Nachricht von Stripe an den Shop (z. B. „bezahlt“); primärer Auslöser für die Bestellanlage. |
| **Job-Wecker** | Minütlicher Aufruf `GET /api/cron/tick`, der ohne Datenbank prüft, ob ein Task fällig ist, und nur dann Jobs ausführt (§8.1, ARCHITEKTUR §9.6). |
| **Vorkasse** | Zahlung per Überweisung vor Versand; Verwendungszweck = Bestellnummer; Erinnerung 72 h nach der Bestellung, Storno nach Ablauf des 5. Kalendertags (`prepayment.dueAt`, E-23, §4.8). |
| **Abholung** | Lieferart „nach Absprache“ im Privatstudio; Ort nur in der Abholmail (E-29). |
| **Token-Link** | Geheimer, nicht erratbarer Link (Danke-/Bestellstatus-Seite) statt Kundenkonto (E-30). |
| **Button-Lösung** | Pflicht, dass der Bestellknopf eindeutig die Zahlungspflicht nennt: „Zahlungspflichtig bestellen“ (§ 312j BGB). |
| **Widerrufsbutton / Widerrufsfunktion** | Link „Vertrag widerrufen“ auf jeder Seite mit zweistufigem Formular und sofortiger Eingangsbestätigung (§ 356a BGB, E-44). |
| **Kleinunternehmerin** | Umsatzsteuerbefreiung nach § 19 UStG; Preise ohne MwSt.-Ausweis (E-02). |
| **Umsatz-Wächter** | Zähler für Shop- und manuelle Umsätze mit Warnungen vor den Kleinunternehmer-Grenzen (E-45). |
| **GPSR-Block** | Pflichtangaben zur Herstellerin und Produktsicherheit auf jeder Produktseite (EU-Produktsicherheitsverordnung, E-40). |
| **Konformitätserklärung (KE)** | Nachweis, dass eine Glasur lebensmittelecht ist; Voraussetzung für „lebensmittelecht“ (E-15). |
| **Abweichende Beschaffenheit** | Mangel/Besonderheit eines Stücks, die vor dem Kauf gesondert bestätigt werden muss (§ 476 BGB). |
| **Rechtstext-Version** | Unveränderliche, datierte Fassung eines Rechtstexts; jede Bestellung speichert die gültigen Versionen (E-41). |
| **Beleg** | Rechnung `RE-…` oder Storno/Gutschrift `GS-…`, unveränderliches PDF mit Prüfsumme. |
| **Packzettel** | PDF ohne Preise mit Positionen, Checkliste und GPSR-Beileger; daneben Etikett und Beileger je Stück (R-203). |
| **Sendungsnummer** | Tracking-Nummer von DHL/Deutsche Post, im Admin eingetippt oder gescannt (E-26). |
| **Offline verkauft** | Knopf, der ein Stück als z. B. auf dem Flohmarkt verkauft markiert; nur Bestand, keine Kasse (E-28). |
| **Archiv** | Öffentliche Liste verkaufter Stücke mit „sold“-Stempel (pro Stück abschaltbar, E-14). |
| **Ausgeblendet** (`archived`) | Unverkauftes Stück, das nicht mehr angeboten wird; nicht öffentlich. |
| **Flash** | Fertiges Tattoo-Motiv mit Nummer `F-012`, Festpreis, Status verfügbar/vergeben, einmalig oder wiederholbar (E-52). |
| **Fresh / Healed** | Frisch gestochenes bzw. verheiltes Tattoo in der Galerie. |
| **Einwilligungs-Häkchen** (`tattoo-gallery.consentGiven` mit `consentDate`, `consentNote`) | Nachweis, dass die abgebildete Person der Veröffentlichung zugestimmt hat (E-42); ohne ihn bleibt das Bild `media.restricted`. |
| **Auftragsarbeit** | Individuelle Anfertigung auf Anfrage (Formular), nicht im Shop kaufbar (E-11). |
| **Tuschelinie** | Durchgehende, tuscheschwarze Linie, die sich beim Scrollen zeichnet und alle Seiten verbindet; sie ist Cocos Leine (E-70–E-73). |
| **Station** | Haltepunkt der Linie (auf der Startseite je Welt/Kategorie), an dem Coco stehen bleibt und die Linie eine Schlaufe macht. |
| **Coco** | Juttas Hündin (Chihuahua-Mix), gezeichnete Guide-Figur in mindestens 6 Posen × 3 Linienzitter-Bildern (E-75, E-80, DESIGN). |
| **Line Boil** | Minimales Zittern handgezeichneter Linien durch Wechsel zwischen 3 Zeichnungsvarianten (P9). |
| **Preisschild / Schnur** | Flohmarkt-Preisschilder, die im Shop an der Linie hängen (E-77). |
| **sold-Stempel** | Handgezeichneter Stempel auf verkauften Stücken (E-77). |
| **PWA** | Installierbare Web-App der Verwaltung mit Homescreen-Icon (E-93). |
| **Adapter / Mock** | Austauschbare Anbindung eines Dienstes; der Mock ersetzt ihn ohne Konto (§1.5). |
| **Seed / Beispielbestand** | Erfundene, vollständige Beispieldaten mit `seed=true`, per Knopf entfernbar (E-63). |
| **Grunddaten** | Echte Startdaten (Kategorien, Standard-Einstellungen, Platzhalter-Rechtstexte) mit `seed=false`. |
| **`SEED_PREVIEW_MODE`** | Umgebungsvariable; nur außerhalb von Produktion wirksam (mit `APP_ENV=production` bricht der Start ab); erlaubt, Seed-Medien ohne Einwilligung anzuzeigen, und blendet das Beispieldaten-Banner ein (§9.7). |
| **Vorschau-Datei** | `planet-claire-vorschau.html`: die ganze Website als eine Offline-Datei (E-98, §12). |
| **Startklar-Prüfung** | Liste im Admin und Skript `pnpm check:golive`, die zeigen, ob alles für den Go-live bereit ist (§7.16, R-210). |
| **Phase (P0–P11)** | Arbeitsabschnitt laut `PLAN.md`; P1–P10 autonom in der Cloud, P11 mit Jutta (E-99). |

---

## Anhang A – Annahmen und offene Punkte

Zur Übernahme nach `docs/OFFENE-PUNKTE.md`. Jede Annahme gilt, bis Jutta (bzw. Kanzlei/Steuerberatung) anders entscheidet.
IDs `KA-xx` = Annahmen dieses Dokuments; Fragen aus `docs/recht/KANZLEI-BRIEFING.md` heißen hier „Kanzleifrage K-xx“.
Einträge mit „geklärt (Abgleich vom 26.09.2026)“ sind zwischen den Fachdokumenten verbindlich aufgelöst; es gilt die genannte Regel.

| ID | Thema | Annahme in diesem Dokument | Klären mit |
|---|---|---|---|
| KA-01 | Aufbewahrung Rechnungen | Standard 10 Jahre ab Jahresende (freigegebene Konzeptseite), umstellbar auf 8 Jahre (die Recherche nennt 8 Jahre für Buchungsbelege, § 147 AO seit 2025). Name der Einstellung geklärt (Abgleich vom 26.09.2026): `settings.retention.invoiceYears` ∈ {8, 10}. | Steuerberatung, Kanzlei (Kanzleifrage K-33) |
| KA-02 | GPSR-Block | immer sichtbar statt eingeklappt (Konzeptskizze zeigte „▾“); rechtlich konservativ | Kanzlei |
| KA-03 | Impressum, zweiter Kontaktweg | Telefonnummer `settings.business.phone` ist Go-live-Pflicht (R-021); der Platzhalter „[Telefon folgt]“ ist speicherbar, aber ohne echte Nummer meldet die Startklar-Prüfung rot (§7.16 Punkt 2). Die Nummer erscheint nur im Impressum, in der Widerrufsbelehrung und in der Anbieterkennung der Bestellbestätigung M01/M02 | Jutta, Kanzlei (Kanzleifrage K-28) |
| KA-04 | Englische Rechtstexte | EN-Seiten zeigen den DE-Text mit dem Hinweis „Only available in German“ und dem Baustein `translation.disclaimer`, falls keine EN-Fassung geliefert wird (R-015); Vertragssprache in AGB | Kanzlei (Briefing, Kanzleifrage K-05) |
| KA-05 | Absenderadresse der Mails | `shop@planetclairetattoos.com` (über Lettermint), Antworten an `jutta@…` | Jutta (P11) |
| KA-06 | Abholung | keine Barzahlung bei Abholung; bezahlt wird vorher | Jutta |
| KA-07 | Admin-Login | 7 Tage angemeldet bleiben; keine Zwei-Faktor-Anmeldung im Admin (nur starkes Passwort + Sperre) | Jutta |
| KA-08 | Löschfristen | geklärt (Abgleich vom 26.09.2026): es gelten ausschließlich die Fristen aus LOESCHKONZEPT (L-xx, §8.3); Bestätigung der 6-Jahres-Stufe über Kanzleifrage K-33 | – |
| KA-09 | Rechnung | geklärt (Abgleich vom 26.09.2026): Leistungszeitpunkt als Monat, z. B. „Oktober 2026“ (R-120, §4.13) | – |
| KA-10 | Regelbesteuerung | Versandkosten anteilig nach Warenwert auf Steuersätze verteilt | Steuerberatung |
| KA-11 | Warnhinweis-Vorbelegungen | Formulierungen je Kategorie in `settings.safetyTemplates` (Startwerte SEED-SPEC §3.2; Vorbelegung und Pflicht-Bausteine §7.4) | Kanzlei |
| KA-12 | Anfrage-Bestätigung | Antwortzeit „meist innerhalb einer Woche“ | Jutta |
| KA-13 | Bezirk des Privatstudios | unbekannt → Platzhalter im Seed (`[Bezirk folgt]`, SEED-SPEC) | Jutta (P11) |
| KA-14 | Privatadresse | Impressum und GPSR zeigen die Privatadresse (E-40); damit ist der Ort des Privatstudios faktisch öffentlich, obwohl Tattoo-Seiten nur den Bezirk nennen (E-50) und die Abholadresse erst per Mail kommt (E-29) | Jutta (Hinweis) |
| KA-15 | Technische Namen | geklärt (Abgleich vom 26.09.2026): es gelten die Namen aus ARCHITEKTUR §5.2, §2.5, §8.7 und Anhang A – u. a. `APP_ENV`, `ADMIN_ROUTE` (Entwicklung `/werkstatt`), `PAYMENTS_DRIVER`, `EMAIL_DRIVER`, `STORAGE_DRIVER`, `TRANSLATION_DRIVER`, `CARRIER_DRIVER`, `PREVIEW_EXPORT`, `PREVIEW_PHASE`, `SEED_NOW`, `SEED_PREVIEW_MODE`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`; Cookies `pc_cart` und `pc_checkout`; Task-Slugs laut ARCHITEKTUR Anhang A.3 | – |
| KA-16 | Knopf „ins Archiv“ (Konzeptseite) | umgesetzt als „Ausblenden“ (unverkauft) und Schalter „Im Archiv zeigen“ (verkauft) | – |
| KA-17 | Kategorien | geklärt (Abgleich vom 26.09.2026): 6 feste Kategorien laut DATENMODELL inkl. `cap` und `sonstiges` (§2.2); die Startseite fasst `textil` + `cap` in einer Station zusammen | – |
| KA-18 | Flash-Nummern | geklärt (Abgleich vom 26.09.2026): eigene Zahlenreihe, Anzeige `F-012` | – |
| KA-19 | E-18 im Admin | Pflicht-Häkchen „eigene Figur“ je Stück | – |
| KA-20 | Kurzlink | `/nr/[nummer]` für Instagram-Stories | – |
| KA-21 | Vorschau-Datei | enthält Seed-Tattoofotos ohne Einwilligung → Banner „nicht öffentlich teilen“ | Jutta, Kanzlei (Kanzleifrage K-34) |
| KA-22 | Komfort | EPC-QR-Code (GiroCode) für Vorkasse | – |
| KA-23 | Zustellung | geklärt (Abgleich vom 26.09.2026): `shipped` → `delivered` automatisch am 10. Berliner Kalendertag nach dem Versandtag (Task `markDelivered`, `shipment.deliveredSource = auto`) | – |
| KA-24 | Uploads | geklärt (Abgleich vom 26.09.2026): Auswahl ≤ 15 MB je Bild, Upload ≤ 4 MB bei ≤ 2560 px, Server lehnt > 4,5 MB mit 413 ab (ARCHITEKTUR §8.8) | – |
| KA-25 | Kasse | Hinweis im Instagram-In-App-Browser zu Apple/Google Pay | – |
| KA-26 | Archiv-Filter | Kategorie als Query `?category=` statt eigener Route | – |
| KA-27 | Außerhalb der Software | Markenrecherche „Planet Claire“, LUCID-Registrierung und Kleinstlizenz bei einem dualen System (die Verpackungsmengen dafür erfasst der Shop, §7.6, §7.15), Glasur-Prüfung, nickelfreie Ösen, Tattoo-Einwilligungen, Impressum-Link in der Instagram-Bio | Jutta |
| KA-28 | Vorkasse-Fristen | geklärt (Abgleich vom 26.09.2026): Erinnerung M03 bei `placedAt + 72 h` (`prepayment.reminderDueAt`); Zahlungsfrist `prepayment.dueAt` = 23:59:59 (Berlin) am 5. Kalendertag nach dem Bestelltag (Berliner Datum); danach Storno und Freigabe durch `cancelOverduePrepayments`; die Reservierung läuft bis zu dieser Frist; eine einzige Implementierung in `src/lib/commerce/` (§4.8, AK-8-02) | – |
| KA-29 | Standard-Verpackung je Versandklasse | Startwerte für Material und Gewicht (`settings.packaging.templates`, §7.14) sind Schätzwerte des Grund-Seeds; Jutta prüft sie beim ersten Packen und korrigiert sie in den Einstellungen; je Sendung beim Packen änderbar (§7.6) | Jutta (P11) |
| KA-30 | Wartungsmodus und Widerruf | R26 bleibt im Wartungsmodus erreichbar; mit erreichbarer Datenbank funktioniert die Widerrufsfunktion vollständig; nur ohne Datenbank zeigt R26 den Weg per E-Mail an `MAIL_REPLY_TO` mit dem Hinweis, dass der Eingang der Mail zählt (§3.16, R-090). Änderbar in der Wartungsseite/R26-Komponente | Jutta, Kanzlei |
| KA-31 | Rechnungsadresse bei Abholung | Bei `pickup` sind Name und Rechnungsadresse immer Pflicht (R-061, Standard bis Kanzleifrage K-07; §4.4, §4.9). Änderbar über die Pflichtregel der Kasse | Kanzlei (Kanzleifrage K-07) |
| KA-32 | Teil-Widerruf, Versandanteil | Erstattet wird vorläufig die Differenz zwischen bezahlten und für die behaltenen Stücke nötigen Versandkosten (kundenfreundlich, §5.3); der Erstattungsdialog weist auf die offene Frage hin. Änderbar in der Erstattungsberechnung `src/lib/commerce/` | Kanzlei (Kanzleifrage K-09) |
| KA-33 | Anfrage-Status `closed` | `completed` = Auftrag erledigt; `closed` = ohne Auftrag beendet (z. B. keine Rückmeldung); beide ohne Wirkung auf die Löschfrist (§5.5). Änderbar über die Anzeige-Labels | Jutta |
| KA-34 | Zahlung zu einer beendeten Kasse (§4.10, §4.11 S16) | Meldet Stripe eine bezahlte Session zu einer Kasse in `expired`, `cancelled` oder `failed`, entsteht **keine** Bestellung (die Stücke können längst anders verkauft sein); der Shop erstattet nicht automatisch, sondern schickt A12 mit Betrag und Stripe-Zahlungs-ID, Jutta erstattet im Stripe-Dashboard. Änderbar in `processPaymentEvent()` (z. B. automatische Erstattung wie S4) | Jutta (P11) |
| KA-35 | Karte/PayPal bezahlt, obwohl Vorkasse bestellt (§4.10, §4.11 S17) | Keine zweite Bestellung; die Vorkasse-Bestellung bleibt `awaiting_prepayment` und erhält einen Hinweis (`adminAttention` mit Notiz); A12 empfiehlt, die Kartenzahlung im Stripe-Dashboard zu erstatten oder mit der Kundin zu klären. Kein automatisches Umbuchen auf „bezahlt“, weil Zahlart, Rechnung und Frist dann nicht zur Bestellung passen. Änderbar in `processPaymentEvent()` | Jutta (P11) |
| KA-36 | Shop-Pause und laufende Kassen (§4.2) | `settings.shop.isOpen = false` sperrt nur neue Aktionen („In den Korb“, „Zur Kasse“); eine schon gestartete Kasse läuft weiter und kann bis zu ihrem Ablauf bezahlt werden (kein Abbruch mitten in der Zahlung). Änderbar in der Prüfung von `submitCheckout` | Jutta |
| KA-37 | Stück nach Storno vor dem Versand (§5.1 P11, §5.3 O15) | Wird eine bezahlte Bestellung mit Grund `admin_cancellation` erstattet, bevor das Stück verschickt oder übergeben wurde, darf Jutta es mit „Wieder verkaufen“ (P11) zurück in den Shop stellen, ohne dass „Ware zurück“ erfasst ist. Bei `breakage` gibt es stattdessen nur „Ausblenden“ (P13). Änderbar in `src/lib/commerce/productTransitions.ts` | Jutta |

## Anhang B – Recherche-Empfehlungen, die nicht gelten

Die Recherche (`docs/research/`) ist vor den Entscheidungen entstanden. Folgende Empfehlungen sind **überstimmt** und dürfen
nicht umgesetzt werden:

| Empfehlung aus der Recherche | Quelle | Stattdessen | Grund |
|---|---|---|---|
| Stripe Checkout als gehostete Seite per Weiterleitung | recht-shop | `ui_mode: 'elements'` auf eigener Kasse mit eigenem Knopf | E-21 |
| Klarna, Wero, SEPA-Lastschrift | zahlung-versand-betrieb, tech-stack | nur Karte/Apple Pay/Google Pay/PayPal + Vorkasse | E-20 |
| „Vorkasse nicht anbieten“ | recht-shop (offene Frage) | Vorkasse mit Reservierung bis Ende des 5. Kalendertags | E-23 |
| Drops, Countdown, Warteliste, Newsletter (Brevo), Rabattcodes, Direktkauf-Links | zahlung-versand-betrieb | nicht im Umfang | E-13, „Später“ |
| Markt-Modus mit Marktkiste, QR-Bezahllink, Tap to Pay im Shop | zahlung-versand-betrieb | nur „Offline verkauft“ | E-28 |
| Automatische Artikelnummern (`PCT-KER-26-0042`, `PC-K-0042`) | tech-stack, produkt-compliance, recht-shop, design | reine Zahlen, von Jutta vergeben, UNIQUE, Vorschlag der nächsten | E-12 |
| Varianten/Lagerartikel, „Collections/Drops“ | tech-stack | nur Unikate | E-10 |
| Tattoo-Anfrageformular (mehrstufig, ALTCHA, Uploads, Kaution, Termine) | tattoo-bereich, design, claude-code-cloud | nur Mail-Knopf + kopierbare Adresse | E-51 |
| Flash-Status mit 7 Werten (reserviert, Wanna-do, nur Flash Day …), Guest Spots, „Books open/closed“ | tattoo-bereich | `available`/`claimed` + `repeatable`; Flash-Days/Aktionen mit Datum | E-52, E-53 |
| Online-Kaution/Anzahlung für Tattoos | tattoo-bereich | keine | E-53 |
| Rechtstexte per IT-Recht-Kanzlei-Abo mit LTI-Push jetzt | recht-shop | einmalig Kanzlei, CMS-Versionierung; LTI später | E-41 |
| Versand DE + AT bzw. EU zum Start | recht-shop, zahlung | nur DE + Abholung Berlin | E-24 |
| Dunkler Tattoo-Bereich „Planet-Nacht“, Flash-Bogen-Navigation, Schneidematte als System | design-navigation | Konzept D „Tuschelinie“, hell (Papier & Ton) | E-70, E-74 |
| Eigene Handschrift-Font (Calligraphr), Fraunces/Atkinson/Big Shoulders | design-navigation | Mansalva, Bricolage Grotesque, IBM Plex Mono, selbst gehostet | E-79 |
| Kundenkonten optional | tech, recht | keine | E-30 |
| Monorepo `apps/web` + `apps/api` | claude-code-cloud | eine Next.js-App mit eingebettetem Payload | E-90 |
| Google Analytics mit Consent-Banner | claude-code-cloud | cookielose Statistik, kein Banner | E-43, E-96 |
| Tattoo-Routen `/tattoo/arbeiten`, `/termine`, `/anfrage`, `/ablauf-preise`, `/pflege`, `/studio` | tattoo-bereich | Routen R11–R18 dieses Dokuments | dieses Dokument |
| Widerrufs-Route `/widerruf` | zahlung-versand-betrieb | `/de/vertrag-widerrufen` bzw. `/en/withdraw-from-contract`; `/widerruf` nur als Kurz-URL mit 308 (§2.4) | dieses Dokument, recht-shop |
| Backups nachts über einen GitHub-Actions-Workflow | tech-stack | `GET /api/cron/backup` in der App, verschlüsselt nach R2 (EU) (§8.2) | keine Kundendaten über GitHub (DIENSTE §3.11, LOESCHKONZEPT L-23) |
| Vercel Cron jede Minute auf `/api/payload-jobs/run` und alle 5 min `/api/cron/release-reservations` | tech-stack | Job-Wecker `GET /api/cron/tick` mit Weckzeitpunkten (§8.1) | Kosten (E-05): die Datenbank bliebe dauernd wach |
| GSAP für Linie und Animationen | design-navigation | eigener Code + Web Animations API; GSAP nur per ADR (§1.6, DESIGN §9.10) | Tempo-Budget (EK-01), DESIGN DA-4 |
| Entschuldigungs-Rabattcode bei Doppelzahlung | zahlung-versand-betrieb | nur Erstattung und Entschuldigung | „Später“ (keine Rabattcodes) |
| Kennzeichen `custom_made` / „kein Widerrufsrecht“ im Shop | recht-shop | entfällt: Auftragsarbeiten sind nicht kaufbar, alle Shop-Stücke haben volles Widerrufsrecht | E-11 |

