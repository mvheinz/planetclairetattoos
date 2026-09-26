# Dienste und Auftragsverarbeiter – planetclairetattoos.com

> **Stand:** 26.09.2026 · **Version:** 1.3 · **Status:** verbindliches Fachdokument (Rang wie ANFORDERUNGEN.md)
> **Zweck:** Einzige Quelle für alle externen Dienste: Datenschutzerklärung (Kanzlei), Verzeichnis von
> Verarbeitungstätigkeiten (R-156), AVV-Abschluss (R-155), Content-Security-Policy (R-131) und Go-live-Gate (R-210).
> **Grundlage:** ENTSCHEIDUNGEN E-20, E-21, E-26, E-61, E-90–E-96; `docs/research/tech-stack.md`,
> `recht-shop.md`, `zahlung-versand-betrieb.md`; Anbieterseiten (abgerufen 26.09.2026, siehe Links).
> Angaben zu Rechtsträgern, Anschriften und Vertragsdokumenten sind beim Vertragsabschluss in **P11 zu prüfen**
> (Spalte bzw. Zeile „Prüfen“). „K-xx“ bedeutet hier immer eine Kanzleifrage aus KANZLEI-BRIEFING §17.
> Technische Namen (Buckets, Endpunkte, Umgebungsvariablen) laut `docs/ARCHITEKTUR.md`. Keine Rechtsberatung.

---

## 1. Regeln

1. **Kein Dienst ohne Entscheidung.** Nur die hier gelisteten Dienste werden eingebunden. Ein neuer Dienst braucht
   eine Entscheidung der Inhaberin (E-xx). Wird einer ergänzt: Detailblock (§3), Übersicht (§2), YAML (§7),
   `docs/recht/VVT.md`, Hinweis an Jutta, dass die Datenschutzerklärung angepasst werden muss.
2. **Bis P11 keine echten Konten.** Alle Integrationen laufen über Treiber und lokale Ersatzdienste (§4). Keine
   echten Kundendaten vor dem Go-live.
3. **Datensparsamkeit an jeder Schnittstelle:** Es werden nur die Felder übermittelt, die in „Daten“ stehen.
   Tests prüfen bei Treibern die gesendeten Felder (z. B. DeepL, Stripe-Metadaten).
4. **Keine Produktionsdaten in Entwicklungswerkzeugen** (GitHub, Claude-Cloud-Sessions, Preview-Datenbanken).
5. **Rollen:** *AV* = Auftragsverarbeiter (Art. 28 DSGVO, AVV nötig); *eV* = eigene Verantwortung des Anbieters
   (kein AVV, aber Nennung als Empfänger in der Datenschutzerklärung); *–* = keine personenbezogenen Daten.

## 2. Übersicht

| Dienst | Rolle | Rechtsträger, Sitz | Zweck | Pers. Daten | AVV | Drittland | Aktiv ab |
|---|---|---|---|---|---|---|---|
| Vercel (Hosting) | AV | Vercel Inc., Covina (CA), USA | Hosting App, CDN, Funktionen fra1, Cron, Logs | ja | ja | USA (DPF + SCC) | P11 |
| Vercel Web Analytics | AV | Vercel Inc. (wie oben) | Cookielose Reichweitenmessung | minimal | über Vercel-DPA | USA | P11, nur nach K-30 (R-132) |
| Neon | AV | Neon/Databricks, San Francisco, USA; Daten in Frankfurt | Postgres-Datenbank | ja | ja | USA-Zugriff (DPF/SCC) | P11 |
| Cloudflare R2 | AV | Cloudflare, Inc., San Francisco, USA; EU-Jurisdiktion | Bilder, Rechnungen, private Uploads, Backups | ja | ja | USA-Zugriff (DPF/SCC) | P11 |
| Stripe | AV + eV | Stripe Payments Europe, Ltd., Dublin, Irland | Karte, Apple Pay, Google Pay, PayPal-Abwicklung | ja | ja (im Services Agreement) | USA (Stripe, Inc.; DPF/SCC) | Test optional ab P4, live P11 |
| PayPal | eV | PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg | Zahlung per PayPal (über Stripe verknüpft) | ja | nein | gruppenintern (PayPal-DSE) | P11 |
| Lettermint | AV | Lettermint B.V., Zwolle, Niederlande | Transaktionsmails (SMTP) | ja | ja | nein (EU-Infrastruktur) | P11 |
| IONOS | AV | IONOS SE, Montabaur | Domain, DNS, Postfach jutta@ | ja | ja | nein | besteht |
| DeepL | – | DeepL SE, Köln | „Übersetzen“-Knopf für Produkt-/Seitentexte | **nein** (verboten) | nein | nein | P11 (bis dahin Mock) |
| Sentry | AV | Functional Software, Inc. (Sentry), San Francisco, USA; EU-Region | Fehlerüberwachung serverseitig/Admin | minimal | ja | USA (DPF/SCC) | P11 |
| GitHub | – | GitHub, Inc., San Francisco, USA | Code, CI, Vorschau-Artefakte (nur Entwicklung) | keine Kundendaten | nein (s. §3.11) | USA | besteht |
| DHL / Deutsche Post | eV | DHL Paket GmbH bzw. Deutsche Post AG, Bonn | Zustellung | ja (Adresse; E-Mail nur mit Einwilligung) | nein | nein | erster Versand (P11) |

## 3. Details je Dienst

### 3.1 Vercel (Hosting, CDN, Funktionen, Cron)
- **Rechtsträger:** Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA.
- **Zweck:** Auslieferung von Website, Shop und Verwaltung; Serverfunktionen in Region `fra1` (Frankfurt);
  CDN; Cron-Aufrufe (Job-Wecker `GET /api/cron/tick` jede Minute, nächtliches Backup `GET /api/cron/backup` – nur
  bei `APP_ENV=production` und `BACKUP_ENABLED=true`, eingeschaltet in P11; ARCHITEKTUR §9.6, §10); Laufzeit-Logs;
  Firewall/DDoS-Schutz.
- **Betroffene/Daten:** alle Besucher:innen (IP-Adresse, URL, User-Agent, Zeitpunkt); Kund:innen und Anfragende
  (Formulardaten, Bestelldaten während der Verarbeitung in Funktionen); Jutta (Admin-Login).
- **Rechtsgrundlage (Vorschlag DSE):** Art. 6 Abs. 1 lit. f DSGVO (sicherer, stabiler Betrieb); für Bestelldaten
  lit. b; Auftragsverarbeitung nach Art. 28.
- **AVV:** Vercel DPA (https://vercel.com/legal/dpa); laut Sekundärquelle für Pro-Teams Vertragsbestandteil.
  **Prüfen P11:** Geltung für den Pro-Plan bestätigen, PDF herunterladen, Datum in `settings.processorAgreements`
  eintragen.
- **Drittland:** US-Unternehmen; Konto- und Steuerungsdaten in den USA; laut tech-stack.md unter dem EU-US Data
  Privacy Framework zertifiziert; zusätzlich Standardvertragsklauseln im DPA.
- **Pflicht-Konfiguration:** `regions: ['fra1']` in `vercel.json`; Pro-Plan (Hobby ist für kommerzielle Nutzung
  nicht erlaubt); keine Log Drains an Dritte; Deployment Protection für Previews; Vercel Toolbar und Speed Insights
  auf Produktion aus; Ausgabenlimit mit Warnung (E-05); Vercel Cron nur für `/api/cron/tick` und `/api/cron/backup`
  (beide mit `CRON_SECRET`).
- **Löschung:** Laufzeit-Logs nach Plan-Aufbewahrung (LOESCHKONZEPT L-13). **Prüfen P11:** Aufbewahrungsdauer der
  Pro-Laufzeit-Logs notieren.
- **Links:** https://vercel.com/legal/privacy-policy · https://vercel.com/legal/dpa

### 3.2 Vercel Web Analytics
- **Rechtsträger:** wie 3.1.
- **Zweck:** Cookielose Reichweitenmessung (E-96).
- **Daten (laut Anbieter):** Zeitpunkt, bereinigte URL, Referrer, gefilterte Query-Parameter (bei uns: alle
  entfernt), aus der IP abgeleitete grobe Geolokation, Betriebssystem, Browser, Gerätetyp. Besucher werden über einen
  Hash aus der Anfrage erkannt, der nach 24 Stunden verworfen wird. Keine Cookies.
- **Rechtsgrundlage (Vorschlag):** Art. 6 Abs. 1 lit. f DSGVO; Einordnung nach § 25 TDDDG offen → K-30.
- **AVV:** über den Vercel-DPA (3.1).
- **Pflicht-Konfiguration:** R-132 (standardmäßig aus; `beforeSend` schließt Kasse, Danke-Seite, Bestellstatus und
  Widerrufs-Schritte aus und entfernt Query-Parameter; keine Custom Events).
- **Link:** https://vercel.com/docs/analytics/privacy-policy

### 3.3 Neon (Postgres)
- **Rechtsträger:** Neon (seit 2025 Teil von Databricks, Inc., 160 Spear Street, San Francisco, CA 94105, USA);
  Vertragspartner laut Neon-Plattformbedingungen. **Prüfen P11:** genauen Vertragspartner aus den Bedingungen
  übernehmen.
- **Zweck:** Datenbank für alle Shop-Daten (Produkte, Bestellungen, Rechnungsregister, Widerrufe, Anfragen,
  Einstellungen, Protokolle).
- **Daten:** alle in der App gespeicherten personenbezogenen Daten (Kund:innen, Anfragende, Jutta).
- **Speicherort:** Region `aws-eu-central-1` (Frankfurt); Unterauftragsverarbeiter u. a. AWS
  (https://neon.com/subprocessors).
- **AVV:** DPA in den Neon-Bedingungen eingebettet (https://neon.com/dpa). **Prüfen P11:** akzeptieren/Datum
  eintragen.
- **Drittland:** US-Unternehmen, Zugriff aus den USA möglich → DPF/SCC laut DPA.
- **Pflicht-Konfiguration:** Region Frankfurt; Preview-Branches nur aus dem Seed (fiktive Daten), **nie** aus
  Produktionsdaten; eigenes nächtliches verschlüsseltes Backup aus der App nach R2 (ARCHITEKTUR §10,
  LOESCHKONZEPT L-23). Das Wiederherstellungsfenster von Neon (Point-in-Time-Historie) auf höchstens 7 Tage
  einstellen (kürzer, wenn der Tarif es vorgibt); gelöschte Daten bleiben dort bis zu seinem Ablauf
  rekonstruierbar. **Prüfen P11:** Wert notieren (ARCHITEKTUR C-16, LOESCHKONZEPT L-23 d).

### 3.4 Cloudflare R2 (Objektspeicher)
- **Rechtsträger:** Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA.
- **Zweck:** Produktbilder und Medien (öffentlich über die App-Route ausgeliefert), Rechnungs-PDFs (privat,
  unveränderlich), private Uploads (Anfrage-Bilder, Einwilligungsnachweise, Compliance-Dokumente), verschlüsselte
  Datenbank-Backups.
- **Daten:** Bilder (auch Kundenfotos mit Einwilligung), Rechnungen (Namen, Anschriften), Anfrage-Bilder, Backups.
- **Speicherort:** Buckets mit **EU-Jurisdiktion** (Endpoint `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`;
  Jurisdiktion ist nachträglich nicht änderbar).
- **AVV:** Cloudflare Customer DPA (https://www.cloudflare.com/cloudflare-customer-dpa/), Teil der
  Self-Serve-Vereinbarung. **Prüfen P11.**
- **Drittland:** US-Unternehmen; DPF/SCC laut DPA.
- **Pflicht-Konfiguration:** EU-Jurisdiktion beim Anlegen; keine öffentlichen `r2.dev`-URLs; DNS bleibt bei IONOS
  (kein Cloudflare-Proxy, keine Cloudflare-Cookies). Buckets (Namen und Präfixe laut ARCHITEKTUR §3.3, §10):
  - **Medien** (`S3_BUCKET`, Präfixe `media/`, `documents/`): nicht öffentlich, Auslieferung über die App-Route.
  - **Privat** (`S3_PRIVATE_BUCKET`, Präfix `private/`): Anfrage-Bilder, Einwilligungsnachweise,
    Compliance-Dokumente, Exporte; **ohne** Versionierung, damit Löschungen wirken; Zugriff nur über signierte URLs
    ≤ 300 s (R-136).
  - **Rechnungsablage** (Stand ARCHITEKTUR C-06): Rechnungs- und Gutschrift-PDFs im privaten Bucket unter dem Präfix
    `private/invoices/`; R2-Bucket-Sperre (Bucket Lock) für dieses Präfix, soweit verfügbar, mit Dauer
    `settings.retention.invoiceYears` (LOESCHKONZEPT §3.2); **keine** Versionierung (R2 bietet sie nicht, und Löschungen
    nach Fristende müssen wirken); Schutz zusätzlich durch Schreiben nur ohne vorhandenes Objekt, täglichen
    verschlüsselten Spiegel und monatliche Prüfsummen (R-122). **Rückfallebene:** eigener Rechnungs-Bucket
    (z. B. `pct-invoices-prod`, ohne Versionierung, mit Bucket-Sperre), wenn die Steuerberatung es verlangt oder
    Sperren je Präfix nicht verfügbar sind (ARCHITEKTUR C-06, Spike B-02).
  - **Backups** (`pct-backups`): eigene Zugangsdaten (`BACKUP_S3_*`), die App-Zugangsdaten haben dort keinen Zugriff;
    Inhalte vor dem Upload verschlüsselt; Lebenszyklus 30 Tage (täglich) / 12 Monate (Monatsstand) (LOESCHKONZEPT L-23).

### 3.5 Stripe (Zahlungsabwicklung)
- **Rechtsträger:** Stripe Payments Europe, Limited, 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210,
  Irland.
- **Zweck:** Zahlungen mit Karte, Apple Pay, Google Pay und PayPal (E-20, E-21), Erstattungen, Anfechtungen,
  Betrugsprävention, Auszahlungen an Jutta.
- **Daten:** Name, E-Mail, Rechnungsadresse (soweit übergeben), Betrag, Währung, Positionen (`Nr. 017 · {Titel}`),
  nicht geheime Kassen-Referenz (Metadaten), Zahlungsmitteldaten (nur bei Stripe, nie im Shop), Geräte- und
  Betrugssignale von Stripe.js auf der Kasse, IP-Adresse.
- **Rolle:** AV für die Zahlungsabwicklung im Auftrag; zugleich eigene Verantwortung, u. a. für Betrugsprävention
  und regulatorische Pflichten (laut Stripe-Datenschutzerklärung) → beides in der DSE abbilden (K-32).
- **AVV:** Stripe Data Processing Agreement (https://stripe.com/legal/dpa), Bestandteil des Stripe Services
  Agreement, mit der Kontoeröffnung akzeptiert. **P11:** Datum in `settings.processorAgreements` eintragen.
- **Drittland:** Übermittlung an Stripe, Inc. (USA) – DPF und SCC.
- **Cookies/Speicher:** Stripe.js setzt auf der Kasse First-Party-Cookies `__stripe_mid` und `__stripe_sid`
  (Betrugsprävention) und lädt Frames von Stripe-Domains – erst nachdem die Kund:in die Kasse geöffnet hat (R-062).
- **Pflicht-Konfiguration:** Checkout Sessions `ui_mode: 'elements'`; nur `card` und `paypal`; **Stripe Link aus**;
  keine Adress-Autovervollständigung; `@stripe/stripe-js/pure` nur im Kassenmodul; in `client_reference_id` und
  `metadata.checkoutRef` nur die nicht geheime Kassen-Referenz (`checkouts.reservationRef`, UUID), dazu
  `metadata.appEnv` – keine
  personenbezogenen Daten und **kein** Kassen-Token (er ist ein Zugangsschlüssel zur Danke-Seite); einzige Ausnahme ist
  die `return_url`, die den Token technisch enthalten muss. Stripe Tax aus; automatische Stripe-E-Mail-Quittungen an
  Kund:innen aus (der Shop schickt eigene Mails); Beschreibung auf dem Kontoauszug „PLANETCLAIRE“;
  Webhook-Signatur prüfen. Bis P11 nur Test-Schlüssel (`sk_test_`/`rk_test_`, `livemode: false` geprüft), in der
  Cloud bevorzugt als API-Credential der Umgebung (CLOUD-SETUP).
- **Links:** https://stripe.com/de/privacy · https://stripe.com/legal/dpa · https://stripe.com/legal/cookies-policy

### 3.6 PayPal
- **Rechtsträger:** PayPal (Europe) S.à r.l. et Cie, S.C.A., 22–24 Boulevard Royal, L-2449 Luxemburg.
- **Zweck:** Zahlung per PayPal; Weiterleitung zu PayPal nach Klick auf „Zahlungspflichtig bestellen“; Juttas
  PayPal-Geschäftskonto ist mit Stripe verknüpft (E-94).
- **Daten:** Name, E-Mail, ggf. Adresse, Betrag, Bestellbezug; Anmeldung der Kund:in bei PayPal.
- **Rolle:** eigene Verantwortung; kein AVV.
- **Drittland:** Übermittlungen innerhalb der PayPal-Gruppe laut PayPal-Datenschutzerklärung → K-32.
- **Link:** https://www.paypal.com/de/legalhub/paypal/privacy-full

### 3.7 Lettermint (Transaktionsmails)
- **Rechtsträger:** Lettermint B.V., Willemsvaart 16 B, 8019 AB Zwolle, Niederlande (KvK 99337711).
- **Zweck:** Versand aller System-Mails per SMTP (E-92), Vorlagen laut DATENMODELL `EMAIL_TEMPLATES` (KONZEPT
  M01–M16, A01–A17): Bestellbestätigung, Vorkasse, Versand, Abholung, Widerrufs-Eingangsbestätigung, Erstattung,
  Hinweis „leider schon weg“, Anfrage-Bestätigung, Reklamationsantwort, Streitbeilegungshinweis, Antworten auf
  Datenschutz-Anfragen und Bestätigung eines Einwilligungswiderrufs, Benachrichtigungen an Jutta (inkl.
  Passwort-Zurücksetzen der Verwaltung). Empfänger unter `example.com`,
  `example.org`, `example.net`, `*.invalid`, `*.test` werden nie übergeben (Unterdrückung in jedem Treiber).
- **Daten:** Empfängeradresse, Name, Mailinhalt (Bestelldaten, Adressen), Anhänge (AGB, Widerrufsbelehrung,
  Rechnung), Zustellprotokolle.
- **AVV:** Datenverarbeitungsvertrag mit Lettermint abschließen (Dashboard bzw. legal@lettermint.co). **Prüfen P11.**
- **Drittland:** Infrastruktur in der EU (u. a. UpCloud NL, Backups OVH DE). Unterauftragsverarbeiter-Liste nennt
  auch US-Dienste (Slack für Teamkommunikation, Stripe für die eigene Abrechnung). **Prüfen P11:** ob Mailinhalte
  diese Dienste erreichen können.
- **Pflicht-Konfiguration:** Öffnungs- und Klick-Tracking aus; kürzeste Log-Aufbewahrung; DKIM/Return-Path als
  eigene Einträge bei IONOS (MX/SPF/DKIM von IONOS unverändert, E-95); Absender `MAIL_FROM`, Reply-To jutta@.
- **Links:** https://lettermint.co/privacy-policy · https://lettermint.co/subprocessors

### 3.8 IONOS (Domain, DNS, Postfach)
- **Rechtsträger:** IONOS SE, Elgendorfer Str. 57, 56410 Montabaur.
- **Zweck:** Domain planetclairetattoos.com, DNS (E-95), Postfach jutta@planetclairetattoos.com (Kundenmails,
  Widerrufe per Mail, Admin-Benachrichtigungen).
- **Daten:** Inhalte und Metadaten der Mails im Postfach.
- **AVV:** Vertrag zur Auftragsverarbeitung im IONOS-Kundenkonto online abschließen. **Prüfen P11:** ob bereits
  vorhanden; Datum eintragen.
- **Drittland:** nein.
- **Hinweis Owner:** Das Postfach ist Juttas Verantwortung; Empfehlung: Benachrichtigungsmails nach 6 Monaten löschen
  (LOESCHKONZEPT L-11).

### 3.9 DeepL („Übersetzen“-Knopf)
- **Rechtsträger:** DeepL SE, Maarweg 165, 50825 Köln.
- **Zweck:** Englische Rohübersetzung von Produkt- und Seitentexten (E-61).
- **Daten:** **keine personenbezogenen Daten.** Die Bedingungen der kostenlosen API (DeepL API Free, je nach Stand
  „Developer“ genannt) verbieten personenbezogene Inhalte; eingereichte Texte können zum Training genutzt werden.
- **Rolle/AVV:** keine Auftragsverarbeitung, kein AVV (bei der kostenlosen API nicht vorgesehen).
- **Pflicht-Konfiguration:** Aufruf nur serverseitig; gesendet werden ausschließlich Inhaltsfelder ohne
  Personenbezug laut Allowlist: die Produkt-Textfelder des Übersetzen-Endpunkts (DATENMODELL §6.6.10, inkl.
  Alt-Texten der Bilder), Textblöcke von Seiten und FAQ sowie Tattoo-Inhalte (Flash-Titel, Angebotstexte,
  Bildunterschriften der Galerie). **Nie** Felder aus Kassen, Bestellungen, Widerrufen, Anfragen,
  Datenschutz-Anfragen, Protokollen oder Einstellungen. Unit-Test prüft die gesendeten Schlüssel gegen die Allowlist;
  Hinweis in der Verwaltung „Keine Namen oder Kontaktdaten in Produkttexten“.
- **Hinweis Owner:** Juttas Texte können von DeepL zum Training genutzt werden. Wer das nicht möchte, braucht DeepL
  API Pro (kostenpflichtig).
- **Links:** https://www.deepl.com/de/privacy · https://www.deepl.com/de/pro-license

### 3.10 Sentry (Fehlerüberwachung)
- **Rechtsträger:** Functional Software, Inc. (Sentry), 45 Fremont Street, 8th Floor, San Francisco, CA 94105, USA.
  **Prüfen P11.**
- **Zweck:** Erkennen von Fehlern im Server/Edge-Code und in der Verwaltung. Browser-Fehler öffentlicher Seiten
  erreichen Sentry höchstens über den eigenen Endpunkt `POST /api/client-errors` (same-origin, serverseitig
  weitergereicht); der ist standardmäßig aus, bis Kanzleifrage K-30 (c) beantwortet ist (R-133).
- **Daten:** Fehlermeldungen, Stacktraces, bereinigte Request-Metadaten; keine Namen, E-Mails, Adressen, Tokens,
  IPs (Scrubbing, R-133).
- **Speicherort:** EU-Datenregion (Frankfurt, Ingest `*.de.sentry.io`).
- **AVV:** Sentry DPA (https://sentry.io/legal/dpa/) in den Organisationseinstellungen akzeptieren. **Prüfen P11.**
- **Drittland:** US-Unternehmen; SCC/DPF laut DPA.
- **Pflicht-Konfiguration:** R-133 (kein Browser-SDK auf öffentlichen Seiten, `sendDefaultPii: false`, kein Replay).

### 3.11 GitHub (nur Entwicklung)
- **Rechtsträger:** GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA.
- **Zweck:** Quellcode, Pull Requests, CI (GitHub Actions), Vorschau-Datei als Artefakt/Release im privaten
  Repository, Arbeit der Claude-Cloud-Sessions.
- **Daten:** **keine Kundendaten aus dem Shop.** Verboten: Zugang zur Produktionsdatenbank in Actions-Secrets,
  Produktions-Backups über GitHub Actions, Exporte oder Logs mit Kundendaten.
- **Achtung:** `content/seed/instagram/` enthält zwei öffentlich auf Instagram gezeigte Tattoo-Fotos von Kund:innen
  (im Seed `showsPerson = customer`, ohne Einwilligung und damit `media.restricted`) sowie Fotos von Jutta
  (`showsPerson = jutta`, öffentlich nur mit `media.ownerApproved`; `profil.jpg` wird nie importiert, R-181); die
  Vorschau-Datei kann die Tattoo-Fotos enthalten (R-182). Klärung K-34; bis dahin Repository privat halten.
- **Rolle/AVV:** Werkzeug der Inhaberin, kein AVV nötig, solange keine Kundendaten verarbeitet werden. Backups laufen
  deshalb **nie** über GitHub Actions (anders als der Vorschlag in tech-stack.md), sondern in der App
  (`GET /api/cron/backup` per Vercel Cron, ARCHITEKTUR §10); Wiederherstellungen laufen lokal, nie in Actions.
  Würde GitHub doch Kundendaten verarbeiten, wäre es Auftragsverarbeiter (GitHub DPA,
  https://github.com/customer-terms/github-data-protection-agreement) – das ist ausgeschlossen.
- **Gleiches gilt für die Claude-Cloud-Sessions (Anthropic):** nur Repository-Inhalte, keine Produktionsdaten, keine
  Produktionsgeheimnisse (CLAUDE.md §6).

### 3.12 DHL / Deutsche Post (Zustellung)
- **Rechtsträger:** DHL Paket GmbH, Sträßchensweg 10, 53113 Bonn (Pakete); Deutsche Post AG,
  Charles-de-Gaulle-Straße 20, 53113 Bonn (Briefe/Einschreiben, Post & DHL App). **Prüfen P11.**
- **Zweck:** Zustellung der Sendungen (E-26). Labels erstellt Jutta manuell (Online-Frankierung/App); keine
  Schnittstelle bis „Später“.
- **Daten:** Name, Lieferadresse, Sendungsnummer; **E-Mail nur mit Einwilligung** (R-101); nie Telefonnummer.
- **Rolle:** eigene Verantwortung (Transportdienstleister); kein AVV.
- **Rechtsgrundlage (Vorschlag):** Art. 6 Abs. 1 lit. b (Adresse), lit. a (E-Mail-Adresse).
- **Link:** https://www.dhl.de/de/toolbar/footer/datenschutz.html

### 3.13 Weitere Empfänger ohne technische Einbindung

| Empfänger | Anlass | Daten | Rolle |
|---|---|---|---|
| Apple Distribution International Ltd., Hollyhill Industrial Estate, Cork, Irland | Kund:in zahlt mit Apple Pay (über Stripe) | Zahlungsdaten im Wallet der Kund:in | eV |
| Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland | Kund:in zahlt mit Google Pay (über Stripe) | wie oben | eV |
| Juttas Bank [Name der Bank – Owner ergänzt] | Vorkasse-Überweisungen, Rücküberweisungen | Name und IBAN der Zahlenden, Betrag, Verwendungszweck | eV |
| Finanzamt, ggf. Steuerberatung | gesetzliche Pflichten (E-04: EÜR selbst) | Rechnungen, Exporte | eV (Art. 6 Abs. 1 lit. c) |
| Meta Platforms Ireland Ltd., Merrion Road, Dublin 4, Irland | Instagram-Profil; die Website verlinkt nur | keine Übermittlung durch die Website; Profil-Insights ggf. gemeinsame Verantwortung (K-29) | eV / ggf. Art. 26 |
| SumUp o. ä. (Flohmarkt, E-28) | Kartenzahlung vor Ort | keine Verbindung zur Website | nicht Teil der Website-DSE |

## 4. Lokale Ersatzdienste bis P11

Maßgeblich sind `.env.example` und `docs/ARCHITEKTUR.md`; die Tabelle ordnet die Dienste zu.

| Dienst | Umgebungsvariable | Wert bis P11 | Ersatz |
|---|---|---|---|
| Neon | `DATABASE_URL` | lokal | Postgres 17 per `docker compose` bzw. CI-Service/Systemdienst in der Cloud |
| Cloudflare R2 | `STORAGE_DRIVER` | `local` | Dateisystem; privater Bereich als eigener Ordner außerhalb von `public/` |
| Lettermint | `EMAIL_DRIVER` | `file` | Mails als Dateien; lokal optional `smtp` → Mailpit (Port 1025, UI 8025) |
| Stripe/PayPal | `PAYMENTS_DRIVER` | `mock` | Mock simuliert Sessions, Webhooks, Erstattungen; optional Stripe-**Test**modus nur mit Test-Schlüsseln (`sk_test_`/`rk_test_`, `livemode: false` beim Start geprüft; in der Cloud bevorzugt als API-Credential, als Umgebungsvariable nur im Rückfall) |
| DeepL | `TRANSLATION_DRIVER` | `mock` | Mock-Übersetzung |
| Sentry | `SENTRY_DSN` | leer | aus |
| Vercel Web Analytics | `NEXT_PUBLIC_ANALYTICS_ENABLED` (ab P1 in `.env.example`) | `false` | aus |
| Vercel Cron | `CRON_SECRET` (≥ 32 Zeichen), `BACKUP_ENABLED` | Entwicklungswert, `false` | Jobs lokal per `JOBS_AUTORUN=true`, in Tests per `pnpm jobs:run <task>`; Job-Wecker `/api/cron/tick` und Backup `/api/cron/backup` erst auf Vercel (Backup nur bei `APP_ENV=production` **und** `BACKUP_ENABLED=true`, eingeschaltet in P11; Wiederherstellungsprobe in GitHub Actions nur mit synthetischen Daten) |
| DHL | – | – | kein Dienst (manuell) |

Mocks machen **keine** Netzwerk-Anfragen an echte Anbieter (per Test geprüft). Seed-Adressen sind nur
`@example.com`/`@example.org` (R-180); der Mailversand unterdrückt `example.com`, `example.org`, `example.net`,
`*.invalid` und `*.test` in jedem Treiber.

## 5. Nicht eingesetzte bzw. verbotene Dienste

| Dienst | Grund | Stattdessen |
|---|---|---|
| Google Fonts (auch `next/font/google`), Adobe Fonts, Font-CDNs | Datenübermittlung, LG München I 3 O 17493/20; E-79 | selbst gehostete Schriften |
| Google Analytics/Tag Manager, Meta Pixel, TikTok Pixel, Hotjar, Microsoft Clarity, Matomo Cloud, Plausible, Umami | Einwilligungspflicht bzw. nicht entschieden (E-43, E-96) | R-132 |
| Vercel Speed Insights | nicht entschieden | – |
| Instagram-Embeds, oEmbed, Graph-API-Feeds, YouTube, Vimeo, Google Maps, OpenStreetMap-Kacheln, Spotify | § 25 TDDDG, EuGH C-40/17 | eigene Bilder + Links (R-139) |
| reCAPTCHA, hCaptcha, Cloudflare Turnstile, Friendly Captcha (Cloud) | Drittanbieter, Einwilligungsrisiko | Honeypot, Zeitfalle, Rate-Limit, ggf. ALTCHA selbst gehostet (R-134) |
| Klarna, SEPA-Lastschrift, Banküberweisung über Stripe, Sofort, giropay | E-20 | – |
| Stripe Link, Stripe Address-Autovervollständigung (Google Places), Express Checkout Element | nicht in E-20; zusätzliche Verantwortliche/Datenflüsse | R-062 |
| Newsletter-/Marketing-Tools (Brevo, Mailchimp, MailerLite) | kein Newsletter (E-13) | – |
| Resend, Postmark | Datenspeicherung in den USA (tech-stack.md) | Lettermint |
| Buchungs-/Tattoo-Tools (Cal.com, kisscal, Shore) | keine Online-Buchung (E-51, E-53) | Mail/DM |
| DeepL mit personenbezogenen Daten | Bedingungen der Free-API | – |
| Sentry Session Replay, Sentry-Browser-SDK auf öffentlichen Seiten | Einwilligungsrisiko | R-133 |
| Log Drains zu Drittanbietern | zusätzliche Empfänger | – |
| GitHub Actions mit Produktionsdaten (z. B. Backups) | GitHub würde Auftragsverarbeiter | Backup in der App (`GET /api/cron/backup`, ARCHITEKTUR §10; §3.11) |
| Chat-Widgets, Bewertungs-Widgets, Social-Share-Skripte | Tracking, § 25 TDDDG | einfache Links |

## 6. AVV-Checkliste für P11 (Owner, mit Unterstützung der Session)

Nach jedem Abschluss in der Verwaltung unter Einstellungen → „Auftragsverarbeitung“ eintragen: Anbieter-ID (§7),
Datum, Dokumentversion/URL, optional PDF. Das Gate R-210 prüft alle Dienste mit `avv: required` und
`production: true`.

- [ ] **Vercel:** DPA für Pro-Team prüfen/akzeptieren, PDF sichern.
- [ ] **Neon:** Plattformbedingungen inkl. DPA akzeptieren, Vertragspartner notieren.
- [ ] **Cloudflare:** Customer DPA (Self-Serve) bestätigen.
- [ ] **Stripe:** DPA ist Teil des Services Agreement – Datum der Kontoeröffnung eintragen.
- [ ] **Lettermint:** Datenverarbeitungsvertrag abschließen.
- [ ] **IONOS:** Vertrag zur Auftragsverarbeitung im Kundenkonto abschließen.
- [ ] **Sentry:** DPA in den Organisationseinstellungen akzeptieren, EU-Region prüfen.
- [ ] Keine Aktion: PayPal, DHL/Deutsche Post (eigene Verantwortung), DeepL (keine personenbezogenen Daten), GitHub
  (keine Kundendaten).

## 7. Maschinenlesbare Dienstliste (YAML)

Wird von Unit-Tests gelesen: CSP-Abgleich (R-131), AVV-Gate (R-155, R-210); der Generator
`scripts/legal/gen-services.ts` erzeugt daraus die Liste für Einstellungen → „Auftragsverarbeitung“ und die Daten der
Empfänger-Tabelle, die als generierte Komponente unter bzw. neben dem Datenschutztext gerendert wird (alle Einträge
mit `production: true`, AVV-Stand aus `settings.processorAgreements`; **kein** Platzhalter-Token, R-012,
KANZLEI-BRIEFING §16.3). Braucht die Komponente weitere Angaben (z. B. Sitz, Zweck), ergänzt die Phase, die sie baut,
die Felder hier aus §2/§3. Der Block ist der **einzige** YAML-Block dieser Datei. Felder: `id` (= `serviceId` in `settings.processorAgreements`), `name`, `role`
(`processor` | `controller` | `processorAndController` | `none`), `avv` (`required` | `coveredBy` | `notRequired` |
`notAvailable`), `avvCoveredBy`, `production` (im Livebetrieb aktiv), `personalData` (`yes` | `minimal` | `no`),
`thirdCountry`, `activeFrom`, `driverEnv`, `csp.<kontext>.<direktive>` (erlaubte Fremd-Hosts; Kontexte laut
ARCHITEKTUR §8.1: `public`, `dynamic`, `checkout`, `admin`, `api`; nicht genannte Kontexte sind leer),
`serverHosts` (ausgehende Verbindungen vom Server, informativ für Netzfreigaben). Hosts sind laut Anbieterdoku; weicht
die Stripe-CSP-Doku ab, wird der Block im PR angepasst.

```yaml
version: 1
services:
  - id: vercel
    name: Vercel (Hosting, CDN, Funktionen, Cron)
    role: processor
    avv: required
    production: true
    personalData: 'yes'
    thirdCountry: US
    activeFrom: P11
    driverEnv: null
    csp: {}
    serverHosts: []
  - id: vercelAnalytics
    name: Vercel Web Analytics
    role: processor
    avv: coveredBy
    avvCoveredBy: vercel
    production: false
    personalData: minimal
    thirdCountry: US
    activeFrom: P11
    driverEnv: NEXT_PUBLIC_ANALYTICS_ENABLED
    csp: {}
    serverHosts: []
  - id: neon
    name: Neon Postgres (aws-eu-central-1)
    role: processor
    avv: required
    production: true
    personalData: 'yes'
    thirdCountry: US
    activeFrom: P11
    driverEnv: DATABASE_URL
    csp: {}
    serverHosts: ['*.eu-central-1.aws.neon.tech']
  - id: cloudflareR2
    name: Cloudflare R2 (EU-Jurisdiktion)
    role: processor
    avv: required
    production: true
    personalData: 'yes'
    thirdCountry: US
    activeFrom: P11
    driverEnv: STORAGE_DRIVER
    csp: {}
    serverHosts: ['*.eu.r2.cloudflarestorage.com']
  - id: stripe
    name: Stripe Payments Europe
    role: processorAndController
    avv: required
    production: true
    personalData: 'yes'
    thirdCountry: US
    activeFrom: P11
    driverEnv: PAYMENTS_DRIVER
    csp:
      checkout:
        script-src: ['https://js.stripe.com', 'https://*.js.stripe.com']
        frame-src: ['https://js.stripe.com', 'https://*.js.stripe.com', 'https://hooks.stripe.com']
        connect-src: ['https://api.stripe.com']
    serverHosts: ['api.stripe.com', 'files.stripe.com']
  - id: paypal
    name: PayPal (Europe)
    role: controller
    avv: notRequired
    production: true
    personalData: 'yes'
    thirdCountry: EU
    activeFrom: P11
    driverEnv: PAYMENTS_DRIVER
    csp: {}
    serverHosts: []
  - id: lettermint
    name: Lettermint B.V.
    role: processor
    avv: required
    production: true
    personalData: 'yes'
    thirdCountry: none
    activeFrom: P11
    driverEnv: EMAIL_DRIVER
    csp: {}
    serverHosts: ['smtp.lettermint.co']
  - id: ionos
    name: IONOS SE (Domain, DNS, Postfach)
    role: processor
    avv: required
    production: true
    personalData: 'yes'
    thirdCountry: none
    activeFrom: P0
    driverEnv: null
    csp: {}
    serverHosts: []
  - id: deepl
    name: DeepL SE (API Free)
    role: none
    avv: notAvailable
    production: true
    personalData: 'no'
    thirdCountry: none
    activeFrom: P11
    driverEnv: TRANSLATION_DRIVER
    csp: {}
    serverHosts: ['api-free.deepl.com']
  - id: sentry
    name: Sentry (EU-Region)
    role: processor
    avv: required
    production: true
    personalData: minimal
    thirdCountry: US
    activeFrom: P11
    driverEnv: SENTRY_DSN
    csp: {}
    serverHosts: ['*.ingest.de.sentry.io']
  - id: github
    name: GitHub (nur Entwicklung)
    role: none
    avv: notRequired
    production: false
    personalData: 'no'
    thirdCountry: US
    activeFrom: P0
    driverEnv: null
    csp: {}
    serverHosts: []
  - id: dhl
    name: DHL Paket GmbH / Deutsche Post AG
    role: controller
    avv: notRequired
    production: true
    personalData: 'yes'
    thirdCountry: none
    activeFrom: P11
    driverEnv: null
    csp: {}
    serverHosts: []
```

Hinweise zum YAML: `vercelAnalytics.production` ist `false`, bis Jutta die Statistik nach K-30 freischaltet (dann
auf `true` setzen). Der SMTP-Host von Lettermint ist in P11 aus dem Dashboard zu übernehmen. Öffentliche und
dynamische Seiten haben keine Fremd-Hosts (`csp.public` und `csp.dynamic` sind überall leer): Statistik läuft
same-origin, Sentry nur serverseitig, Browser-Fehler (falls eingeschaltet) nur an den eigenen Endpunkt. Ein
CSP-Rückfall mit `'unsafe-inline'` in den Kontexten `public` oder `admin` (R-131, K-41) ändert keine Host-Liste.

## 8. Änderungsprotokoll

| Datum | Version | Änderung |
|---|---|---|
| 26.09.2026 | 1.0 | Erstfassung (P0) |
| 26.09.2026 | 1.1 | Angleichung an ARCHITEKTUR: §3.4 Rechnungsablage laut C-06 (Präfix `private/invoices/` im privaten Bucket, Bucket-Sperre soweit verfügbar, keine Versionierung; eigener Bucket als Rückfallebene), Buckets und Backups laut §3.3/§10; Cron-Endpunkte (§3.1, §4); Backups nie über GitHub Actions (§3.11, §5); Stripe-Metadaten (§3.5); Mail-Unterdrückung reservierter Domains (§4) |
| 26.09.2026 | 1.2 | Backup erst mit `BACKUP_ENABLED` in P11 (§3.1, §4); Neon-Wiederherstellungsfenster (§3.3); Stripe-Metadaten nur Kassen-Referenz und `appEnv`, kein Token, Test-Schlüssel (§3.5, §4); Lettermint-Zwecke (§3.7); DeepL-Allowlist (§3.9); Browser-Fehler-Endpunkt (§3.10); Seed-Bilder mit DATENMODELL-Feldern (§3.11); CSP-Kontexte laut ARCHITEKTUR §8.1 und `settings.processorAgreements` (§7) |
| 26.09.2026 | 1.3 | Empfänger-Tabelle als generierte Komponente aus der YAML, kein Token (§7); Lettermint-Zwecke inkl. Datenschutz-Antworten und Passwort-Zurücksetzen (§3.7); CSP-Rückfall `public`/`admin` (§7) |
