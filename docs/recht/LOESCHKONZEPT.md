# Löschkonzept – planetclairetattoos.com

> **Stand:** 27.09.2026 · **Version:** 1.4 · **Status:** verbindliches Fachdokument (Rang wie ANFORDERUNGEN.md)
> **Zweck:** Aufbewahrungs- und Löschfristen je Datenkategorie (L-xx), die automatischen Löschjobs und das Verfahren
> für Anfragen betroffener Personen. Grundlage für R-150 bis R-154, die Datenschutzerklärung (Kanzlei) und das
> Verzeichnis von Verarbeitungstätigkeiten (R-156).
> **Grundlage:** E-11, E-30, E-41, E-42, E-63; `docs/research/recht-shop.md`, `produkt-compliance-steuern.md`,
> `zahlung-versand-betrieb.md`, `tattoo-bereich.md`, `tech-stack.md`; Konzeptseite; technische Umsetzung
> `docs/ARCHITEKTUR.md` (§8.7 Cookies, §9.6 Job-Wecker, §10 Backups, Anhang A.3 Task-Slugs). Offene Rechtsfragen:
> Kanzleifragen K-33 (Fristen), K-25 (Anfragen), K-38 (Warenkorb) im KANZLEI-BRIEFING. „K-xx“ bedeutet in diesem
> Dokument immer eine Kanzleifrage; Annahmen aus `docs/KONZEPT.md` heißen KA-xx. Keine Rechtsberatung.
>
> **Aufteilung:** Dieses Dokument legt Fristen, Fristbeginn und Aktion fest (bei widersprüchlichen Löschfristen gilt
> es vor KONZEPT §8.3 und DATENMODELL §12, ARCHITEKTUR Anhang A.3). Namen im Code (Collections, Tasks, Einstellungen)
> kommen aus DATENMODELL bzw. ARCHITEKTUR.

---

## 1. Grundsätze

1. **Speicherbegrenzung:** Personenbezogene Daten werden nur so lange gespeichert, wie es der Zweck oder eine
   gesetzliche Pflicht verlangt (Art. 5 Abs. 1 lit. e, Art. 17 DSGVO). Wo das Gesetz eine Mindestfrist vorgibt und
   keine Höchstfrist, gilt die hier festgelegte Frist.
2. **Begriffe:**
   - **Löschen:** Datensatz und alle zugehörigen Speicherobjekte (Bilder, PDFs, Exporte) werden entfernt – auch aus
     Versions- und Papierkorb-Tabellen. Keine „weichen“ Löschungen für personenbezogene Daten.
   - **Anonymisieren:** Alle personenbezogenen Felder werden geleert (`null`), der Rest bleibt (z. B. Beträge,
     Objektnummern). Danach ist kein Personenbezug mehr herstellbar. Braucht ein Pflichtfeld einen Wert (E-Mail der
     Bestellung), steht dort der Platzhalter `anonymisiert@example.invalid` (DATENMODELL §6.8.3); an ihn wird nie
     gemailt, weil der Mailversand `*.invalid` immer unterdrückt.
   - **Einschränken** (Art. 18, Art. 17 Abs. 3 lit. b): Datensatz bleibt wegen gesetzlicher Aufbewahrung, wird aber
     mit `privacy.processingRestricted: true` von jeder weiteren Verarbeitung ausgenommen (keine Mails, keine Anzeige außer
     für Pflichtzwecke); nicht erforderliche Felder werden sofort entfernt.
   - **Legal Hold** (Art. 17 Abs. 3 lit. e): Jutta sperrt einen Datensatz wegen eines konkreten Rechtsstreits,
     einer Anfechtung oder Reklamation gegen die automatische Löschung – nur mit Begründung
     (`privacy.legalHold` + `privacy.legalHoldReason`, DATENMODELL §5); Erinnerung alle 6 Monate (`legalHoldReview`).
3. **Fristberechnung:** Zeiten liegen in der DB in UTC; gerechnet wird in **Europe/Berlin**.
   - „ab Ende des Kalenderjahres“ (steuer- und handelsrechtliche Fristen, § 147 Abs. 4 AO): Ablauf am
     **01.01. des Jahres (Ereignisjahr + N + 1), 00:00 Uhr**. Beispiel: Rechnung vom 15.03.2027, 10 Jahre →
     löschbar ab 01.01.2038.
   - „ab Ereignis“: Ereigniszeitpunkt + Dauer (Monate kalendergenau, z. B. 15.10. + 6 Monate = 15.04.).
4. **Eine Quelle für Fristen:** Alle Regeln (ID, Dauer, Fristbeginn, Aktion) stehen als Konstanten in
   `src/lib/retention/policy.ts` (ARCHITEKTUR §2.1); das Protokoll schreibt `src/lib/retention/log.ts`. Jobs, Hooks für
   `deleteAfter`/`retainUntil`, Admin-„Löschvorschau“ und Tests importieren dieses Modul.
5. **Nachweis:** Jede Löschung, Anonymisierung und Einschränkung schreibt einen Eintrag in die Collection
   `deletion-log` (DATENMODELL §6.27: Collection, interne ID, Regel L-xx, Aktion, Auslöser, Zeitpunkt, Anzahl
   Speicherobjekte) – **ohne** Inhalte, Namen oder E-Mail-Adressen.
6. **Payload-Technik:** Collections mit personenbezogenen Daten (`orders`, `checkouts`, `withdrawals`, `complaints`,
   `inquiries`, `privacy-requests`, `email-log`, `consent-log`, `private-uploads`, `tattoo-gallery`) haben keine
   Versionen/Entwürfe und keinen Papierkorb (`trash`) (DATENMODELL §1.6, R-154). `tattoo-gallery` enthält
   Einwilligungsangaben und Kundenfotos; ohne Versionen wirkt ein Widerruf bzw. eine Löschung sofort vollständig.
7. **Anbieter-Logs:** Wo Dienstleister eigene Protokolle führen (Vercel, Lettermint, Sentry), wird die kürzeste
   verfügbare Aufbewahrung eingestellt und in P11 in DIENSTE.md dokumentiert.

## 2. Aufbewahrungs- und Löschfristen je Datenkategorie

| ID | Kategorie und Daten | Zweck | Rechtsgrundlage der Speicherung | Frist | Fristbeginn | Danach | Job |
|---|---|---|---|---|---|---|---|
| L-01 | Warenkorb und Kasse im Browser (ARCHITEKTUR §8.7, R-130): Cookie `pc_cart` (nur Stück-IDs, Preis beim Hinzufügen und Lieferart, keine Kennung, keine Personendaten) und Cookie `pc_checkout` (zufälliger Kassen-Token, `HttpOnly`). Es gibt **keinen** Server-Warenkorb | Warenkorb- und Kassenfunktion | § 25 Abs. 2 Nr. 2 TDDDG; Art. 6 Abs. 1 lit. b DSGVO | `pc_cart` 7 Tage (`Max-Age`), `pc_checkout` 1 h (`Max-Age`); `pc_cart` wird gelöscht, wenn der Korb leer ist oder die Bestellung abgeschlossen ist | Setzen bzw. letzte Änderung des Cookies | Browser verwirft das Cookie | – (Cookie-Laufzeit; Kassen-Datensätze in der DB: L-03) |
| L-02 | Reservierungen (`reservations`: Stück, Kassen-Referenz, Ablaufzeit, Status; keine Personendaten) | Doppelverkauf verhindern | Art. 6 Abs. 1 lit. b | 7 Tage | Freigabe bzw. Umwandlung (`releasedAt`/`convertedAt`) | Löschen | `retentionTechnical` |
| L-03 | Kassen (`checkouts`, DATENMODELL §6.25): Hash des Kassen-Tokens, Snapshot, eingegebene Namen, E-Mail, Adressen, Einwilligungen, Stripe-Session-Referenz – **alle** Kassen, auch abgebrochene, abgelaufene, gescheiterte und abgeschlossene (die Bestellung hat einen eigenen Snapshot, DATENMODELL DM-05); `consent-log`-Einträge einer Kasse ohne Bestellung. Vor der Zahlung gibt es keine Bestellung, nur die Kasse | Bezahlvorgang abschließen, Missbrauch klären | Art. 6 Abs. 1 lit. b, f | **30 Tage** | Anlage der Kasse | Löschen (`orders.checkout` wird geleert; Danke-Link danach „nicht gefunden“, Status-Link der Bestellung bleibt) | `retentionAbandonedCheckouts`, `retentionConsentEvidence` |
| L-04 | Stornierte Vorkasse-Bestellungen (`cancelled`, nie bezahlt; `cancelReason` `payment_timeout`, `admin` oder `withdrawn`) | Nachweis versandter Geschäftsbriefe (Bestätigung, Storno) | § 147 Abs. 1 Nr. 2, 3, Abs. 3 AO (Standard bis K-33) | Stufe 1: nach 30 Tagen Liefer- und Rechnungsadresse und DHL-Einwilligung entfernen (Telefon wird nicht erfasst); Status-Token wie §3.1 Stufe B; Stufe 2: 6 Jahre | Stornierung (`timestamps.cancelledAt`); Stufe 2 ab Ende des Stornojahres (`orders.retainUntil`) | Anonymisieren | `retentionOrderMinimize`, `retentionOrders` |
| L-05 | Bestellungen mit Zahlung, auch widerrufene/erstattete (Kontaktdaten, Adressen, Snapshot, Status-Historie, Mail-Protokoll `email-log`, Einwilligungs- und Abweichungsnachweise `consent-log`, Pack- und Rückgabefotos, Status-Token als Hash und Siegel) | Vertragserfüllung, Gewährleistung, Nachweise | Art. 6 Abs. 1 lit. b, c, f; § 147 Abs. 1 Nr. 2, 3 AO; §§ 195, 199, 438 BGB | mehrstufig, siehe §3.1; Endstufe **6 Jahre** | Endstatus (`timestamps.finalStatusAt`, §3.1) | Anonymisieren | `retentionOrderMinimize`, `retentionOrders` |
| L-06 | Rechnungen und Gutschriften (PDF + Registerzeile `invoices`) | Buchungsbelege | Art. 6 Abs. 1 lit. c; § 147 Abs. 1 Nr. 1, 4, Abs. 3 AO; § 14b Abs. 1 UStG | `settings.retention.invoiceYears`: **Standard 10 Jahre** (Konzept-Freigabe), umstellbar auf 8 (gesetzliche Mindestfrist für Buchungsbelege, K-33); beim Anlegen als `retainUntil` eingefroren | Ende des Ausstellungsjahres | PDF löschen, Registerzeile anonymisieren – erst nach `retainUntil` (DATENMODELL §9.4) | `retentionInvoices` |
| L-07 | Monatsexporte CSV/DATEV und Rechnungs-ZIP (`private-uploads`, Zweck `monthly_export`; ohne Kundennamen, R-124) | Aufzeichnungen der EÜR | § 147 Abs. 1 Nr. 1, Abs. 3 AO | 10 Jahre | Ende des Exportjahres | Löschen | `retentionInvoices` |
| L-08 | Widerrufserklärungen (`withdrawals`) und Eingangsbestätigungen | Nachweis von Zugang und Frist, Erstattung | Art. 6 Abs. 1 lit. c, f; § 147 Abs. 1 Nr. 2 AO; §§ 355–357 BGB | 6 Jahre, mindestens so lange wie die zugeordnete Bestellung (L-05); als Test/Spam markiert: 30 Tage | Ende des Eingangsjahres bzw. Markierung (`spam.markedAt`) | Löschen | `retentionWithdrawals` |
| L-09 | Reklamationen (`complaints`, DATENMODELL §6.29: Eingang, Beschreibung, Fotos `complaint_photo`, Abhilfe, Wahl der Kund:in, Fristen; versendete Vorlagen im `email-log`) | Gewährleistung | wie L-05 | wie L-05 | wie L-05 | Löschen mit Stufe D der Bestellung | `retentionOrders` |
| L-10 | Anfragen Auftragsarbeiten (`inquiries`) inkl. Referenzbilder (`private-uploads`, Zweck `commission_reference`), Eingangsbestätigung im `email-log` und Nachweis des Datenschutzhinweises im `consent-log` | Anfrage beantworten | Art. 6 Abs. 1 lit. b; E-11 | **6 Monate** | Eingang (`createdAt`; `deleteAfter`) | Löschen (DB + privater Speicher) | `retentionCommissionInquiries` |
| L-11 | Postfach jutta@ (IONOS): Kundenmails, Benachrichtigungen (nur Referenzen) | Kommunikation | Art. 6 Abs. 1 lit. b, f; § 147 AO | Empfehlung: Benachrichtigungen 6 Monate; Geschäftskorrespondenz 6 Jahre | Eingang | manuell durch Jutta | – |
| L-12 | E-Mail-Versandprotokoll `email-log` (Vorlagenschlüssel, Empfänger, Betreff, Bezug, Message-ID, Status, Zeit, Hash des gerenderten Inhalts und der Anhänge; Inhalt selbst wird nicht gespeichert) | Nachweis des Versands (§§ 312f, 356a BGB) | Art. 6 Abs. 1 lit. c, f | wie das Bezugsobjekt (Bestellung Stufe D, Widerruf L-08, Anfrage L-10); ohne Bezug 90 Tage | wie Bezug bzw. Versand (`sentAt`) | Löschen | `retentionEmailLog` |
| L-13 | Technische Protokolle: a) Rate-Limit-Zähler (HMAC der IP mit täglich wechselndem Schlüssel, Tabelle `rate_limit_hits`, ARCHITEKTUR §3.9/§8.5); b) Sicherheitsprotokoll Admin-Login (falls mit IP-Hash); c) eigene Anwendungslogs (ohne Personendaten, R-137); d) Webhook-Ereignisse (`webhook-events`); e) Hosting-/CDN-Logs beim Anbieter; f) nicht abgeschickte Formular-Uploads (`private-uploads` mit Status `pending`, ARCHITEKTUR §8.8); g) Job-Protokoll der Jobs-Queue (Tabelle `job_runs`, DATENMODELL §11; nur IDs, keine Inhalte); h) Verwaltungsprotokoll `audit-log` (personenbezogene Werte maskiert, DATENMODELL §6.21) | Sicherheit, Missbrauchsschutz, Idempotenz, Nachvollziehbarkeit | Art. 6 Abs. 1 lit. f; Art. 32 DSGVO; f) Art. 6 Abs. 1 lit. b; h) Art. 6 Abs. 1 lit. c, f | a) 24 h; b) 14 Tage; c) ≤ 14 Tage; d) 90 Tage; e) nach Anbieter-Plan (≤ 14 Tage anstreben, P11 prüfen); f) 24 h; g) 90 Tage; h) Beleg-, Bestell-, Widerrufs- und Rechtstext-Aktionen 10 Jahre ab Ende des Jahres, sonst 3 Jahre | Erfassung; h) Eintrag | Löschen | `retentionTechnical` |
| L-14 | Sentry-Ereignisse (bereinigt) | Fehleranalyse | Art. 6 Abs. 1 lit. f | kürzeste Plan-Einstellung (Developer-Plan laut Recherche ca. 30 Tage, P11 prüfen) | Ereignis | Anbieter löscht | – |
| L-15 | Statistik (Vercel Web Analytics, falls aktiviert) | Reichweite | Art. 6 Abs. 1 lit. f | Besucher-Hash 24 h (Anbieter); Aggregate ohne Personenbezug | Aufruf | Anbieter | – |
| L-16 | Zahlungsdaten bei Stripe, PayPal, Bank; im Shop nur Zahlungs-/Erstattungs-IDs | Zahlung | eigene Pflichten der Anbieter | Shop-IDs wie L-05/L-06; beim Anbieter nach dessen Regeln | – | – | – |
| L-17 | Betroffenenanfragen `privacy-requests` (Nummer `DS-JJJJ-NNNN`) inkl. Schriftverkehr; Exportdateien (ZIP, `private-uploads` mit Zweck `data_export`) | Nachweis der Erfüllung (Art. 5 Abs. 2) | Art. 6 Abs. 1 lit. c, f; §§ 195, 199 BGB | Datensatz 3 Jahre; Exportdateien 30 Tage nach Antwort | Ende des Abschlussjahres bzw. Antwort | Löschen | `retentionPrivacyRequests` |
| L-18 | Löschprotokoll `deletion-log` (keine Inhalte) | Nachweis; Wiederholung nach Backup-Restore | Art. 5 Abs. 2 DSGVO | 3 Jahre | Eintrag | Löschen | `retentionDeletionLog` |
| L-19 | Einwilligungs- und Vereinbarungsnachweise: a) `consent-log`-Einträge zur Bestellung – DHL-E-Mail-Einwilligung (`carrier_email_forwarding`, Textfassung, Bausteinversion, Zeitpunkt; Widerruf als eigener Eintrag und `orders.carrierEmailConsentRevokedAt`) und Abweichungsvereinbarungen (`deviation_agreement`); b) Portfolio-Einwilligung (`tattoo-gallery`: Häkchen, Datum, Umfang; Nachweisdatei `consent_evidence`) | Nachweis (Art. 7 Abs. 1 DSGVO, § 476 Abs. 1 S. 2 BGB) | Art. 6 Abs. 1 lit. c, f | a) mit der Bestellung (Stufe D); ohne Bestellung wie die Kasse (L-03, 30 Tage); b) solange das Foto veröffentlicht ist + 3 Jahre | a) wie Bezug; b) Ende der Veröffentlichung bzw. Widerruf | Löschen | `retentionConsentEvidence` |
| L-20 | Portfolio-Fotos von Kund:innen (`tattoo-gallery`, Bilder mit `showsPerson = customer`) | Portfolio | Art. 6 Abs. 1 lit. a DSGVO; § 22 KUG | bis Widerruf oder Entfernung; nach Widerruf sofort unveröffentlicht und `media.restricted`, Bilddateien und Varianten spätestens nach 24 h gelöscht | Widerruf | Löschen | sofortige Aktion + `retentionConsentEvidence` |
| L-21 | Verwaltungskonto (Jutta) und Sitzungen | Verwaltung | Art. 6 Abs. 1 lit. b, f | Konto solange genutzt; Sitzungstoken ≤ 7 Tage | – | – | Payload-Einstellung |
| L-22 | Beispielbestand (`seed: true`, fiktive Personen); nicht dazu gehört der Grund-Seed (`seed = false`, z. B. Platzhalter-Rechtstexte, R-002) | Demo, Tests, Vorschau | keine realen Personen | vor Go-live vollständig entfernt; in der Produktionsdatenbank höchstens vorübergehend vor der Freischaltung, öffentlich nie (§3.7) | Go-live | Löschen | Knopf „Beispieldaten entfernen“ + Gate R-210 |
| L-23 | Backups und Wiederherstellungsstände (ARCHITEKTUR §10): im Bucket `pct-backups` (R2, EU) a) tägliche DB-Dumps (age-verschlüsselt); b) Monatsstand der DB; c) verschlüsselter Datei-Spiegel der privaten Dateien (inkl. Rechnungs-PDFs) und Medien; beim Datenbank-Anbieter d) Neon-Wiederherstellungsfenster (Point-in-Time-Historie); e) nach einer Wiederherstellung die abgelöste Datenbank `planetclaire_broken_<JJJJMMTT>` | Wiederherstellung | Art. 32 DSGVO; Art. 6 Abs. 1 lit. c, f | a) 30 Tage; b) 12 Monate (365 Tage); c) solange die Quelldatei existiert, danach 7 Tage; d) höchstens 7 Tage, kürzer, wenn der Tarif es vorgibt; e) 30 Tage | Erstellung bzw. Löschung der Quelle; d) Änderung in der DB; e) Umschalten | Ablauf per Lebenszyklus bzw. Spiegel-Abgleich; d) Anbieter verwirft die Historie; e) Datenbank löschen | R2-Lebenszyklusregeln (`db/daily/`, `db/monthly/`); Spiegel-Lauf nach dem Backup; d) Neon-Einstellung (P11 prüfen); e) manuell (ARCHITEKTUR §10.5) |
| L-24 | Produktsicherheits- und Konformitätsunterlagen (GPSR-Unterlagen, Prüfberichte, Konformitätserklärungen, Lieferantenerklärungen) | Herstellerpflichten | Art. 9 Abs. 3 GPSR | 10 Jahre | Inverkehrbringen des letzten betroffenen Stücks | Erinnerung an Jutta (keine Auto-Löschung) | `complianceDocsReview` |
| L-25 | Inhalte ohne Bezug zu Dritten: Produkte, Seiten, Rechtstext-Versionen, Einstellungen, Umsatz-Summen, Preis-Historie | Betrieb | – | keine Löschfrist; Rechtstext-Versionen mindestens so lange wie referenzierende Bestellungen/Rechnungen | – | – | – |

## 3. Details zu mehrstufigen Kategorien

### 3.1 Bestellungen (L-05)

**Endstatus-Zeitpunkt `timestamps.finalStatusAt`** (DATENMODELL §6.8.1): Zeitpunkt des letzten Wechsels in
`delivered`, `picked_up`, `refunded` oder `cancelled`. `delivered` setzt Jutta oder der Task `markDelivered`
(10 Berliner Kalendertage nach dem Versandtag, `deliveredSource = auto`). Bleibt eine versendete Bestellung dennoch im
Status `shipped`, gilt `shippedAt + 30 Tage`. Stufe D steht als `orders.retainUntil` an der Bestellung.

| Stufe | Wann | Aktion |
|---|---|---|
| A | 30 Tage nach `finalStatusAt` | Telefonnummer löschen – derzeit ohne Wirkung, weil die Kasse kein Telefonfeld hat (R-061); die Stufe greift, falls künftig eine Telefonnummer gespeichert wird |
| B | 180 Tage nach `finalStatusAt` | Bestellstatus-Token löschen – Hash `statusTokenHash` und Siegel `statusTokenSealed` gemeinsam → Link zeigt „abgelaufen“ (R-067) |
| C | 12 Monate nach `shippedAt` (bei Abholung `pickedUpAt`); Rückgabefotos 12 Monate nach `returnReceivedAt` | Pack- und Rückgabefotos löschen (außer bei Legal Hold, z. B. offene Reklamation oder Anfechtung) |
| D | 6 Jahre ab Ende des Kalenderjahres von `finalStatusAt` (`retainUntil`) | **Anonymisieren:** Name, E-Mail (Platzhalter §1 Nr. 2), Telefon, alle Adressfelder, Notizen und Freitexte (auch im Status-Verlauf), DHL-Einwilligung. **Löschen:** Pack- und Rückgabefotos, Reklamationen samt Fotos (L-09), zugeordnete `email-log`- und `consent-log`-Einträge (L-12, L-19 a), zugeordnete Widerrufe (L-08). **Bleibt:** Bestellnummer, Daten, Status-Historie ohne Freitext, Positionen (Objektnummer, Titel, Preis), Beträge, Zahlart-Typ, Belegnummern, Rechtstext- und Bausteinfassungen |

**Begründung der 6 Jahre:** Bestellbestätigung, Storno- und Reklamationsschreiben sind Handels- bzw. Geschäftsbriefe
(§ 147 Abs. 1 Nr. 2, 3, Abs. 3 AO: 6 Jahre). Außerdem deckt die Frist Gewährleistung (2 Jahre ab Übergabe, bei
Reparatur + 12 Monate) und die regelmäßige Verjährung (3 Jahre ab Jahresende, §§ 195, 199 BGB) ab. Bestätigung: K-33.

### 3.2 Rechnungen und Gutschriften (L-06)

- Frist standardmäßig **10 Jahre** ab Ende des Ausstellungsjahres. Grund: Konzept-Freigabe („Rechnungen … werden 10 Jahre
  aufbewahrt“) und konservative Einordnung von Rechnungsregister und Monatsexport als Aufzeichnungen der EÜR
  (§ 147 Abs. 1 Nr. 1 AO: 10 Jahre). Gesetzliche Mindestfrist für Buchungsbelege seit BEG IV: 8 Jahre
  (§ 147 Abs. 1 Nr. 4, Abs. 3 AO; § 14b Abs. 1 UStG).
- Die Frist ist als Einstellung `settings.retention.invoiceYears` ∈ {8, 10} hinterlegt (Feld laut DATENMODELL
  §7.1), **Standard 10**; umstellen nur nach Antwort von Kanzlei/Steuerberatung (K-33) und nur für die Zukunft
  nachvollziehbar (Änderungsprotokoll): Jeder Beleg erhält beim Anlegen `retainUntil` = 01.01.(Ausstellungsjahr +
  `invoiceYears` + 1); eine Umstellung wirkt nur auf neu ausgestellte Belege. Monatsexporte (L-07) bleiben unabhängig
  davon 10 Jahre (Aufzeichnungen, § 147 Abs. 1 Nr. 1 AO).
- Vor `retainUntil`: keine Lösch- oder Änderungsmöglichkeit (R-121, R-122; Datenbank-Trigger DATENMODELL §9.4); Bitte um
  Löschung → Einschränkung.
- Nach `retainUntil`: PDF löschen; Registerzeile anonymisieren (Käuferfelder in `data` leeren, `anonymizedAt` setzen) –
  der Trigger erlaubt genau diese Änderung erst dann und nur einmal; Nummer, Datum, Betrag und Prüfsumme bleiben ohne
  Personenbezug.
- Ablage: privater Bucket, Präfix `private/invoices/`, **ohne** Versionierung (DIENSTE §3.4, ARCHITEKTUR §3.3/C-06).
  Die R2-Bucket-Sperre für dieses Präfix (soweit verfügbar) läuft `settings.retention.invoiceYears` Jahre ab Upload;
  sie endet damit spätestens mit der Aufbewahrungsfrist (die erst am Jahresende beginnt), sodass die Löschung danach
  möglich ist. Bei Umstellung der Einstellung wird die Sperrregel mit angepasst. Gleiches gilt für die Rückfallebene
  eines eigenen Rechnungs-Buckets.

### 3.3 Widerrufe (L-08)

- Zugeordnet: Frist wie die Bestellung (Stufe D), mindestens 6 Jahre ab Ende des Eingangsjahres.
- Nicht zugeordnet und nicht als Test/Spam markiert: 6 Jahre ab Ende des Eingangsjahres.
- Als Test/Spam markiert (nur mit Begründung): Löschung 30 Tage nach der Markierung.

### 3.4 Anfragen Auftragsarbeiten (L-10)

- Löschung **6 Monate nach Eingang** (E-11), unabhängig vom Bearbeitungsstand: `inquiries.deleteAfter` =
  `createdAt` + 6 Monate, nur verkürzbar („Jetzt löschen“); die Verwaltung zeigt „wird gelöscht am …“. Referenzbilder,
  Eingangsbestätigung (`email-log`) und Nachweis des Datenschutzhinweises (`consent-log`) werden mitgelöscht.
- Legal Hold nur mit Begründung (z. B. Streit über eine Auftragsarbeit); Erinnerung nach 6 Monaten.
- Kommt ein Auftrag zustande, läuft der Vertrag per E-Mail (R-161); nötige Angaben stehen dann in Juttas Postfach bzw.
  Buchhaltung, nicht im Anfragedatensatz.

### 3.5 Einwilligungen und Portfolio (L-19, L-20)

- DHL-E-Mail-Einwilligung: `orders.carrierEmailConsent` plus `consent-log`-Eintrag (Zweck `carrier_email_forwarding`,
  angezeigter Text, Bausteinversion, Zeitpunkt); Widerruf über den Admin-Knopf „Einwilligung widerrufen“ setzt
  `orders.carrierEmailConsentRevokedAt` und schreibt einen Widerrufs-Eintrag ins `consent-log` (R-101). Löschung mit
  Stufe D; Einträge einer Kasse ohne Bestellung nach 30 Tagen (L-03).
- Portfolio: Widerruf → Eintrag sofort unveröffentlicht, `consentWithdrawnAt` gesetzt, Bilder `media.restricted`
  (R-172); Bilddateien und Varianten nach spätestens 24 h gelöscht (der Galerie-Eintrag hat keine Versionen, §1
  Nr. 6); Einwilligungsnachweis (Häkchen, Datum, Umfang,
  Nachweisdatei) noch 3 Jahre ab Widerruf bzw. Ende der Veröffentlichung, dann Löschung.

### 3.6 Backups und Wiederherstellung (L-23)

- Technik laut ARCHITEKTUR §10: nächtlich ruft Vercel Cron in der App `GET /api/cron/backup` auf (nur bei
  `APP_ENV=production` **und** `BACKUP_ENABLED=true`, eingeschaltet in P11; Bearer `CRON_SECRET`); der Datenbank-Dump wird **vor** dem Upload mit age verschlüsselt (privater Schlüssel nur
  offline bei Jutta) und im Bucket `pct-backups` (R2, EU-Jurisdiktion, eigene Zugangsdaten) abgelegt. Danach
  spiegelt derselbe Lauf die privaten Dateien und Medien verschlüsselt in denselben Bucket.
- Lebenszyklus (L-23): tägliche Dumps 30 Tage, Monatsstand 12 Monate; Spiegel-Objekte 7 Tage nach Löschung der
  Quelldatei. Die Tabelle `rate_limit_hits` wird nicht gesichert.
- Backups laufen **nie** über GitHub Actions, eine Claude-Cloud-Session oder weitere Anbieter (DIENSTE §3.11); auf
  GitHub läuft nur die Wiederherstellungsprobe `restore-drill.yml` mit synthetischen Daten. Wiederherstellung nur
  lokal bei Jutta bzw. einer beauftragten Vertrauensperson (ARCHITEKTUR §10.5).
- Gelöschte Daten verschwinden aus Backups mit deren Ablauf (Spiegel nach 7 Tagen, Dumps spätestens nach
  12 Monaten, Neon-Historie nach höchstens 7 Tagen, abgelöste Datenbank nach 30 Tagen). Backups werden für nichts
  anderes als Wiederherstellung genutzt.
- **Nach jeder Wiederherstellung** – aus dem eigenen Backup oder aus dem Neon-Wiederherstellungsfenster – läuft im
  Wartungsmodus vor dem Wiederöffnen `retention:replay` (Verwaltung „Nach Wiederherstellung abgleichen“ bzw.
  `pnpm retention:replay`): Es löscht alle IDs aus `deletion-log`, die im wiederhergestellten Stand noch existieren,
  und führt alle Löschjobs einmal aus.
- Privater Bucket **ohne** Versionierung, damit Löschungen wirken; Rechnungs-PDFs sind zusätzlich über die
  Bucket-Sperre für `private/invoices/` geschützt (§3.2).

### 3.7 Beispielbestand (L-22)

- Alle Seed-Datensätze tragen `seed: true`; fiktive Personen, E-Mails nur `@example.com`/`@example.org`;
  Bestellnummern `PC-2026-900NN`, Belege in den Serien `BSP-RE`/`BSP-GS`, jeweils sichtbar als „Beispiel“ gekennzeichnet
  (R-180). Der Mailversand unterdrückt reservierte Domains (`example.com`, `example.org`, `example.net`, `*.invalid`,
  `*.test`) immer.
- Nicht zum Beispielbestand gehört der Grund-Seed (`seed = false`), z. B. die Platzhalter-Rechtstexte
  (`isPlaceholder = true`, R-002); er enthält keine Personendaten und bleibt, bis echte Texte aktiviert sind.
- In der Produktionsdatenbank ist der Beispielbestand höchstens vorübergehend vor der Freischaltung und nie öffentlich:
  In P11 wird sie aus dem Seed befüllt, Seiten- und FAQ-Texte werden übernommen, danach „Beispieldaten entfernen“ mit
  „Seitentexte behalten“, erst dann Produktionsmarkierung und Freischaltung (R-180). Gate R-210 prüft 0 Treffer;
  `SEED_PREVIEW_MODE` ist in Produktion verboten (R-181).
- Preview-Datenbanken werden je Pull Request aus dem Seed neu aufgebaut, nie aus Produktionsdaten.
- Exporte (Monats-CSV, DATEV, Rechnungs-ZIP, Verpackungs-CSV) enthalten nie Beispieldaten, auch nicht im
  Vorschau-Modus (R-124, R-201); Beispieldaten erreichen damit nie die Aufbewahrung nach L-07.

## 4. Automatische Jobs

Payload-Jobs-Queue mit den Task-Slugs aus ARCHITEKTUR Anhang A.3 (nur diese Slugs). Auslöser ist der
**Job-Wecker** (ARCHITEKTUR §9.6): Vercel Cron ruft jede Minute `GET /api/cron/tick` auf (Bearer `CRON_SECRET`); der
Tick prüft ohne Datenbankzugriff, ob etwas fällig ist, und führt nur dann die fälligen Tasks aus – mindestens stündlich
einen vollen Lauf. Einzelne Tasks lassen sich über `POST /api/cron/run/[task]` starten (Tests, Verwaltung „Jetzt
ausführen“); `/api/payload-jobs/run` ist nur Rückfall. Die Uhrzeiten unten sind Richtwerte (Europe/Berlin): Tägliche
und monatliche Tasks laufen beim ersten vollen Lauf nach dieser Uhrzeit und höchstens einmal je Berliner Tag bzw.
Monat; eine Verzögerung bis 60 min ist für Löschfristen unerheblich. Lokal/Docker: `JOBS_AUTORUN=true`; Tests:
`pnpm jobs:run <task> --now=<ISO>` bzw. direkte Aufrufe mit injizierter Uhr. Takt und Uhrzeit der Tasks, die
fachlich zu KONZEPT §8.2 gehören, stehen dort; dieses Dokument nennt für sie nur die Rechtsregel. Für die
`retention*`-Tasks gelten Reihenfolge und Richtzeiten dieser Tabelle.

| Task | Zeitplan (Richtwert) | Regeln | Bemerkung |
|---|---|---|---|
| `releaseExpiredReservations` | Weckzeit `expiresAt`, stündliches Netz (KONZEPT §8.2) | E-22 (Freigabe, keine Löschung) | zusätzlich Stripe-Webhook `checkout.session.expired` und Freigabe beim nächsten Reservierungsversuch |
| `prepaymentReminders` | Weckzeit der Erinnerung (KONZEPT §8.2) | R-071 | genau eine Erinnerung 72 h nach der Bestellung |
| `cancelOverduePrepayments` | Weckzeit der Zahlungsfrist (KONZEPT §8.2) | R-071 | Storno nach Ablauf der Zahlungsfrist (23:59:59 Europe/Berlin am 5. Kalendertag nach dem Bestelltag) |
| `sendEmail` | direkt nach dem Commit, Wiederholung per Weckzeit | R-093 | Widerrufs-Eingangsbestätigung (`withdrawal_receipt`): Wiederholung im Abstand von höchstens 5 min bis 24 h nach Eingang; Admin-Alarm A12 (`admin_alert`) schon nach dem 2. Fehlversuch und erneut, wenn nach 24 h noch kein Versand gelang |
| `withdrawalDeadlines` | täglich 08:00 (KONZEPT §8.2) | R-094 | Erstattung fällig bis (`refundDueAt`): Warnung ab Tag 10 (`admin_withdrawal_deadline`); keine Löschung, kein automatisches Ablehnen |
| `retentionAbandonedCheckouts` | täglich 03:05 | L-03 | alle `checkouts` 30 Tage nach Anlage, `orders.checkout` leeren |
| `retentionOrderMinimize` | täglich 03:10 | L-04 Stufe 1, L-05 Stufen A–C | |
| `retentionOrders` | täglich 03:15 | L-04 Stufe 2, L-05 Stufe D, L-09 | Bestellungen mit `retainUntil ≤ $now` anonymisieren, ihre Reklamationen samt Fotos löschen |
| `retentionInvoices` | täglich 03:20 | L-06, L-07 | Belege mit `retainUntil ≤ $now` (aus `settings.retention.invoiceYears`, L-06) |
| `retentionWithdrawals` | täglich 03:25 | L-08 | |
| `retentionCommissionInquiries` | täglich 03:30 | L-10 | inkl. Objekte im privaten Speicher |
| `retentionEmailLog` | täglich 03:35 | L-12 | |
| `retentionPrivacyRequests` | täglich 03:40 | L-17 | |
| `retentionConsentEvidence` | täglich 03:45 | L-03 (`consent-log` ohne Bestellung), L-19, L-20 | |
| `retentionDeletionLog` | täglich 03:50 | L-18 | ohne eigenen Protokolleintrag |
| `retentionTechnical` | stündlich | L-02, L-13 | inkl. `rate_limit_hits` und `pending`-Uploads älter als 24 h, `webhook-events` und Job-Protokoll älter als 90 Tage, `audit-log` nach Frist |
| `legalHoldReview` | täglich 08:00 | Legal Holds, deren letzte Prüfung (`legalHoldReviewedAt`, sonst `legalHoldSince`) ≥ 6 Monate her ist → Mail `admin_legal_hold_review` (KONZEPT A15) an Jutta | |
| `privacyRequestsDeadlineReminder` | täglich 08:00 | R-153 | 7 Tage und 1 Tag vor Frist (`admin_privacy_request_due`, A14) |
| `legalReviewReminder` | täglich (KONZEPT §8.2) | R-014 | |
| `revenueGuardCheck` | täglich und bei Bedarf (KONZEPT §8.2) | R-125 | inkl. Neujahrsprüfung |
| `invoiceIntegrityCheck` | monatlich am 1. (KONZEPT §8.2) | R-122 | |
| `complianceDocsReview` | monatlich, 1. Tag 08:10 | L-24 | nur Erinnerung (`admin_compliance_docs_review`, A16) |

Die Fristen- und Erinnerungs-Tasks (`prepaymentReminders`, `cancelOverduePrepayments`, `withdrawalDeadlines`,
`legalHoldReview`, `privacyRequestsDeadlineReminder`, `complianceDocsReview`) überspringen Datensätze mit `seed = true`
(keine Admin-Mails zu Beispieldaten, DATENMODELL §11); die Verwaltung zeigt deren Fristen trotzdem an, und die
`retention*`-Tasks löschen Beispieldaten nach denselben Fristen wie echte Daten.

Für L-01 gibt es keinen Task: Solange es keinen Server-Warenkorb gibt, erfüllt die Cookie-Laufzeit die Löschfrist;
Kassen-Datensätze löscht `retentionAbandonedCheckouts` (L-03). Führt die Antwort auf Kanzleifrage K-38 zu einem
Server-Warenkorb, kommt ein eigener Task mit Eintrag in ARCHITEKTUR Anhang A.3 hinzu.

**Regeln für alle Löschjobs:**
1. Idempotent; höchstens 500 Datensätze je Lauf, Rest im nächsten Lauf.
2. Reihenfolge: erst Speicherobjekte löschen, dann Datensatz. Scheitert das Objekt-Löschen, bleibt der Datensatz,
   der nächste Lauf versucht es erneut; nach 3 Fehlschlägen Mail `admin_alert` an `ADMIN_NOTIFY_EMAIL`.
3. Datensätze mit `privacy.legalHold` werden übersprungen; `privacy.processingRestricted` ändert die Frist nicht.
4. Jede Aktion → `deletion-log` (§1 Nr. 5).
5. Trockenlauf-Modus für die Admin-Ansicht „Löschvorschau“ (was wird in den nächsten 30 Tagen gelöscht, je Regel).
6. Die aktuelle Zeit kommt aus einer injizierbaren Uhr (Tests mit Fake-Zeit); SQL nutzt nie `now()` direkt, sondern
   den Parameter `$now` (ARCHITEKTUR A-08). Kein Parallellauf desselben Tasks (Advisory-Lock, ARCHITEKTUR §9.6).
7. Laufzeitfehler → Mail `admin_alert` an `ADMIN_NOTIFY_EMAIL` (über den konfigurierten Mail-Treiber) und Sentry
   (serverseitig).

## 5. Verfahren bei Anfragen betroffener Personen (DSGVO)

Die Verwaltung unterstützt jeden Schritt (R-150 bis R-153). Antworten in der Sprache der Anfrage (DE/EN).

### 5.1 Eingang und Erfassung
- Jede Form zählt: E-Mail an jutta@planetclairetattoos.com, Brief, Instagram-DM, mündlich, Widerrufsformular mit
  Datenschutz-Bezug. Das Wort „DSGVO“ muss nicht vorkommen.
- Innerhalb von 1 Werktag in „Datenschutz-Anfragen“ (`privacy-requests`, DATENMODELL §6.26) anlegen: Art,
  **Eingangsdatum = Tag des Zugangs**, Kanal, Kontaktadresse. Das System vergibt die Nummer `DS-JJJJ-NNNN` und
  berechnet die Frist (R-153).
- Anfragen per Instagram-DM: freundlich auf E-Mail verweisen; keine personenbezogenen Daten per DM verschicken.

### 5.2 Identität prüfen
- Antworten mit Daten gehen **nur** an die E-Mail-Adresse, die in den Daten gespeichert ist.
- Kommt die Anfrage von einer anderen Adresse: Bestätigung von der gespeicherten Adresse erbitten oder zwei
  Kontrollangaben abfragen (Bestellnummer und Rechnungsbetrag). Keine Ausweiskopie verlangen, außer bei begründeten
  Zweifeln (Art. 12 Abs. 6 DSGVO).
- Solange die Identität offen ist: Status `identity_check`; die Prüfart wird festgehalten (`identityMethod`:
  gespeicherte Adresse, Kontrollangaben oder Sonstiges). Die Rückfrage sofort stellen, damit die Monatsfrist
  eingehalten werden kann; die Fristüberwachung läuft ab Eingang weiter (keine Annahme einer Fristhemmung).

### 5.3 Fristen und Kosten
- **1 Monat** ab Eingang (Art. 12 Abs. 3), z. B. Eingang 15.10. → Antwort bis 15.11.
- Verlängerung um höchstens 2 Monate nur bei Komplexität oder vielen Anfragen; Mitteilung mit Gründen **innerhalb des
  ersten Monats**.
- Kostenlos. Offenkundig unbegründete oder exzessive Anträge (Art. 12 Abs. 5) nur nach Rücksprache mit der Kanzlei
  ablehnen.

### 5.4 Auskunft (Art. 15)
1. Suche nach E-Mail, Name und Bestellnummer (R-150) über `orders`, `checkouts`, `invoices`, `withdrawals`,
   `complaints`, `inquiries`, `consent-log`, `email-log` und frühere `privacy-requests`.
2. Export erzeugen; Inhalte prüfen und Daten Dritter schwärzen (z. B. Notizen, die andere Personen betreffen).
3. Antwort per Mail `privacy_access_response` (KONZEPT M14) mit Baustein `privacyRequest.accessResponse`: Zwecke, Datenkategorien, Empfänger (DIENSTE.md),
   Speicherdauer (dieses Dokument), Rechte (Berichtigung, Löschung, Einschränkung, Widerspruch, Übertragbarkeit),
   Beschwerderecht, Herkunft der Daten, Hinweis zur automatisierten Risikoprüfung durch Stripe (eigene
   Verantwortung), Kopie der Daten.
4. Die Kopie wird als signierter Download-Link (7 Tage gültig) an die geprüfte Adresse geschickt; die Exportdatei wird
   30 Tage nach der Antwort gelöscht (L-17).

### 5.5 Berichtigung (Art. 16)
- Vor Rechnungsstellung direkt ändern; danach Gutschrift und neue Rechnung (R-121, R-152). Änderung im Verlauf
  vermerken, Person informieren.

### 5.6 Löschung (Art. 17)
1. Knopf „Löschen/Einschränken“ (R-151): Das System zeigt je Datensatz Regel und Aktion.
2. Sofort löschen, was keiner Aufbewahrungspflicht unterliegt (z. B. Anfragen, Kassen, Einwilligungsdaten nach
   Widerruf).
3. Aufbewahrungspflichtige Daten (Bestellungen bis Stufe D, Rechnungen, Widerrufe) einschränken; in der Antwort
   (Mail `privacy_erasure_response`, M15, Baustein `privacyRequest.erasureResponse`) nennen, welche Daten aus welchem Grund
   bis wann aufbewahrt und dann automatisch gelöscht werden.
4. Empfänger informieren, soweit nötig (Art. 19): DHL-E-Mail-Einwilligung widerrufen, falls erteilt; bei Stripe/PayPal
   auf deren eigene Datenschutzkontakte hinweisen (eigene Verantwortung); Mail-Anbieter-Logs und Backups laufen
   automatisch ab (L-12, L-23) – in der Antwort erwähnen.

### 5.7 Einschränkung (Art. 18)
- `privacy.processingRestricted: true` setzen; keine Mails, keine Nutzung außer Aufbewahrung und Rechtsverteidigung;
  Aufhebung erst nach Mitteilung an die Person.

### 5.8 Datenübertragbarkeit (Art. 20)
- `daten.json` aus dem Export (von der Person bereitgestellte Daten und Bestelldaten) in strukturiertem,
  maschinenlesbarem Format.

### 5.9 Widerspruch (Art. 21)
- Betrifft Verarbeitungen nach Art. 6 Abs. 1 lit. f (Sicherheitsprotokolle, Spamschutz, ggf. Statistik). Prüfen und
  dokumentieren; bei Statistik kann die Person über den Standard (keine Cookies, Hash 24 h) informiert werden.

### 5.10 Widerruf von Einwilligungen (Art. 7 Abs. 3)
- DHL-E-Mail-Weitergabe: Knopf „Einwilligung widerrufen“ an der Bestellung (R-101): setzt
  `orders.carrierEmailConsentRevokedAt`, schreibt den Widerruf ins `consent-log` (§3.5).
- Portfolio-Foto: „Einwilligung widerrufen“ am Galerie-Eintrag → sofort offline, Löschung nach L-20 (R-172).
- Wirkung für die Zukunft; Bestätigung an die Person (Mail `consent_withdrawal_confirmation`, M16).

### 5.11 Abschluss und Dokumentation
- Antwortdatum, Anhänge, Ergebnis im Anfragedatensatz; Status `answered` bzw. `rejected` mit Begründung.
- Aufbewahrung des Anfragedatensatzes 3 Jahre ab Ende des Abschlussjahres (L-17).
- In jeder Antwort: Hinweis auf das Beschwerderecht bei der **Berliner Beauftragten für Datenschutz und
  Informationsfreiheit, Alt-Moabit 59–61, 10555 Berlin**.
- Bei Unsicherheit: Kanzlei fragen – die Frist läuft trotzdem.

## 6. Tests und Nachweis

- `tests/int/legal/retention.int.spec.ts`: je Regel L-02 bis L-23 (soweit automatisiert) mit Fake-Zeit: einen Tag vor
  Fristende vorhanden, einen Tag danach gelöscht/anonymisiert; Speicherobjekte entfernt; keine Versions- oder
  Papierkorb-Einträge (§1 Nr. 6); `deletion-log`-Eintrag ohne Inhalte vorhanden; Legal Hold wird übersprungen. L-01 prüft der e2e-Test zu R-130
  (Cookie-Attribute und `Max-Age`).
- `tests/int/legal/privacy-requests.int.spec.ts`: Export vollständig (R-150), Löschen/Einschränken (R-151), Fristen
  und Erinnerungen (R-153).
- `tests/unit/legal/retention-rules.unit.spec.ts`: Fristberechnung „Ende des Kalenderjahres“ (inkl. Silvester
  23:59 Europe/Berlin = 22:59 UTC) und „ab Ereignis“ (Monatsenden, Sommerzeit).
- Testtitel beginnen mit der R-ID (R-154, R-150 …) und nennen die L-ID.

## 7. Offene Punkte (Kanzlei/Steuerberatung, P11)

| Punkt | Standard bis zur Klärung | Klärung |
|---|---|---|
| Rechnungen 10 statt 8 Jahre | 10 Jahre (Konzept) | K-33 / Steuerberatung |
| Bestellungen 6 Jahre, stornierte Vorkasse-Bestellungen 6 Jahre (reduziert) | wie §2 | K-33 |
| Backups 12 Monate (Monatssicherungen) | wie L-23 | K-33 |
| Anfragen Auftragsarbeiten: 6 Monate ab Eingang | ab Eingang | K-25 |
| Warenkorb nur als Cookie ohne Kennung, kein Server-Warenkorb (L-01) | Cookie-Warenkorb laut ARCHITEKTUR §8.7 | K-38 |
| Rechnungsablage: Präfix `private/invoices/` im privaten Bucket statt eigenem Bucket | Präfix mit Bucket-Sperre, ohne Versionierung | Steuerberatung (ARCHITEKTUR C-06) |
| Aufbewahrung der Logs bei Vercel, Lettermint, Sentry | kürzeste Einstellung | P11: in DIENSTE.md eintragen |
| Neon-Wiederherstellungsfenster (L-23 d) | höchstens 7 Tage | P11: Tarif und Einstellung prüfen, Wert in DIENSTE §3.3 eintragen (ARCHITEKTUR C-16) |

## 8. Änderungsprotokoll

| Datum | Version | Änderung |
|---|---|---|
| 26.09.2026 | 1.0 | Erstfassung (P0) |
| 26.09.2026 | 1.1 | Angleichung an ARCHITEKTUR: L-01 ohne Server-Warenkorb (Cookies `pc_cart`/`pc_checkout`, §8.7; Task `retentionCarts` entfällt); L-03 inkl. Kassen-Datensätze; L-13 um `rate_limit_hits` und `pending`-Uploads ergänzt; L-23 und §3.6 Backups laut ARCHITEKTUR §10; §3.2 `settings.retention.invoiceYears`, Ablage `private/invoices/` ohne Versionierung; §4 Task-Slugs laut Anhang A.3 und Job-Wecker `/api/cron/tick`; Collection-Slugs `email-log`, `deletion-log`, `privacy-requests`; Beispielnummern (§3.7); Kanzleifrage K-38 |
| 26.09.2026 | 1.2 | Angleichung an DATENMODELL und ARCHITEKTUR: Platzhalter `anonymisiert@example.invalid` (§1 Nr. 2); Modul `src/lib/retention/policy.ts` (§1 Nr. 4); Collection-Liste ohne Versionen, `tattoo-gallery`-Versionen werden mitgelöscht (§1 Nr. 6); L-03 alle Kassen 30 Tage nach Anlage, keine Bestellstatus vor der Zahlung; L-04 `cancelled` mit `cancelReason`, Adressen in Stufe 1; L-05/§3.1 ohne Telefonfeld, `markDelivered`, Rückgabefotos, Stufe D mit `email-log`/`consent-log`; L-06/§3.2 `retainUntil` eingefroren, Anonymisierung erst danach (DATENMODELL §9.4); L-09 `complaints`; L-10 `inquiries`; L-13 g) Job-Protokoll, h) `audit-log`; L-19 DHL-Einwilligung mit Widerruf; L-22/§3.7 Grund-Seed und Ablauf in P11; L-23 d) Neon-Wiederherstellungsfenster, e) abgelöste Datenbank, Backup erst mit `BACKUP_ENABLED`; §4 `sendEmail` mit A12 ab dem 2. Fehlversuch, `withdrawalDeadlines`, Mail-Schlüssel, Aufgaben der Löschjobs präzisiert; §5 Status `identity_check`, Nummer `DS-JJJJ-NNNN`, Mail-Schlüssel |
| 26.09.2026 | 1.3 | `tattoo-gallery` ohne Versionen (§1 Nr. 6, L-20, §3.5); Status-Token als Hash und Siegel, Stufe B löscht beide (L-05, §3.1); L-13 g) Tabelle `job_runs`; Exporte nie mit Beispieldaten (§3.7); Mail-IDs laut KONZEPT (§4, §5) |
| 27.09.2026 | 1.4 | Fristen- und Erinnerungs-Tasks überspringen Beispieldaten (`seed = true`), Löschjobs nicht (§4) |
