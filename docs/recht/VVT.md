# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 Abs. 1 DSGVO) – planetclairetattoos.com

> **Stand:** 02.10.2026 · **Version:** 1.0 · **Status:** Fachdokument (R-156), erzeugt in P6.21
> **Grundlage:** `docs/recht/DIENSTE.md` (Dienste, Rollen, Drittland; YAML §7), `docs/recht/LOESCHKONZEPT.md`
> (Fristen L-xx), `docs/recht/KANZLEI-BRIEFING.md` §11.4 (Verarbeitungen V1–V19), `docs/ARCHITEKTUR.md` §8.7
> (Cookies/Speicher), `docs/recht/ANFORDERUNGEN.md` R-136 (TOM).
> **Pflege:** Bei jeder Dienständerung (DIENSTE §1 Regel 1) und jeder neuen Verarbeitung aktualisieren. Jutta
> bekommt die Datei in P11 zum Aufbewahren (Owner-Aufgabe, R-156). Rechtsgrundlagen sind **Vorschläge** aus dem
> Kanzlei-Briefing, die die Kanzlei prüft (keine Rechtsberatung).

---

## 1. Verantwortliche (Art. 30 Abs. 1 lit. a)

| Angabe | Wert |
|---|---|
| Verantwortliche | [Vorname Nachname – Owner ergänzt] („Jutta“), Geschäftsbezeichnung [z. B. „Planet Claire“] |
| Anschrift | [Anschrift – Owner ergänzt; dieselbe wie `settings.business` / Impressum] |
| Kontakt | jutta@planetclairetattoos.com (Postfach bei IONOS, DIENSTE §3.8) |
| Datenschutzbeauftragte:r | nicht benannt (KANZLEI-BRIEFING §11.1) |
| Gemeinsam Verantwortliche | keine; ggf. Meta für Instagram-Insights (K-29, V19) |
| Aufsichtsbehörde | Berliner Beauftragte für Datenschutz und Informationsfreiheit, Alt-Moabit 59–61, 10555 Berlin |

Die Platzhalter in eckigen Klammern ergänzt Jutta in P11 (wie im Kanzlei-Briefing „Vor dem Versand …“).

## 2. Technische und organisatorische Maßnahmen (Art. 30 Abs. 1 lit. g, Art. 32)

Für **alle** Verarbeitungen gilt R-136 (ANFORDERUNGEN): HTTPS mit HSTS, Sicherheits-Header und Content-Security-Policy
je Kontext (`src/lib/security/headers.ts`, `src/lib/security/csp.ts`; Fremd-Hosts nur Stripe auf der Kasse, R-131),
Verwaltung unter eigener Route mit Anmeldesperre und Passwortregeln (`src/collections/Users.ts`), privater
Speicherbereich mit kurzlebigen signierten Links (`src/collections/PrivateUploads.ts`), Rate-Limit mit IP-Hash statt
IP (`src/lib/security/ipHash.ts`, `src/lib/security/rateLimit.ts`), Logger mit Schwärzung (`src/lib/security/redact.ts`,
R-137), Verwaltungsprotokoll mit maskierten Personendaten (`src/collections/AuditLog.ts`), automatische Löschjobs
(`src/lib/retention/`, LOESCHKONZEPT §4), verschlüsselte Backups in der EU (ARCHITEKTUR §10, ab P11), keine
Produktionsdaten in Entwicklungswerkzeugen (DIENSTE §1 Regel 4). Weitere Einzelheiten: ARCHITEKTUR §8.

## 3. Übersicht der Verarbeitungen

Spalten nach Art. 30 Abs. 1 lit. b–f. „Empfänger“ nennt die Dienst-IDs aus DIENSTE §7 in Klammern; die Rolle (AV =
Auftragsverarbeiter, eV = eigene Verantwortung) steht in DIENSTE §2. Drittland: „USA“ = Übermittlung an bzw. Zugriff
durch ein US-Unternehmen (Garantien laut DIENSTE §2: Datenschutzrahmen EU-USA und/oder Standardvertragsklauseln,
in P11 beim Vertragsabschluss zu prüfen).

| Nr. | Verarbeitung | Zweck | Rechtsgrundlage (Vorschlag) | Betroffene | Datenkategorien | Empfänger | Drittland | Löschfrist |
|---|---|---|---|---|---|---|---|---|
| V1 | Aufruf der Website (Hosting, CDN, Logs) | Auslieferung, Sicherheit | Art. 6 Abs. 1 lit. f | Besucher:innen | IP-Adresse, URL, User-Agent, Zeit (Hosting-Logs) | Vercel (`vercel`) | USA | L-13 e (nach Anbieter-Plan, ≤ 14 Tage anstreben), eigene Logs L-13 c ≤ 14 Tage |
| V2 | Warenkorb, Kasse und Endgeräte-Speicher | Warenkorb, Zuordnung des Bezahlvorgangs, Einstellung „Animationen“ | Art. 6 Abs. 1 lit. b; § 25 Abs. 2 Nr. 2 TDDDG (K-38) | Besucher:innen, Kund:innen | Cookie `pc_cart` (Stück-Nummern, Preis beim Hinzufügen, Lieferart), Cookie `pc_checkout` (zufällige Kassen-Kennung), `localStorage['pc-motion']` (`reduced`/`full`, nur nach Klick, verlässt den Browser nie); Reservierungen ohne Personendaten | Vercel (`vercel`), Neon (`neon`) | USA | L-01 (7 Tage bzw. 1 h; `pc-motion` bis zur Löschung im Browser), L-02 (7 Tage) |
| V3 | Bestellung, Vertragsabwicklung, Bestellstatus-Link | Vertrag | Art. 6 Abs. 1 lit. b, c | Kund:innen | Name, E-Mail, Liefer-/Rechnungsadresse, Bestelldaten, Einwilligungen; kein Telefon | Vercel (`vercel`), Neon (`neon`), Cloudflare R2 (`cloudflareR2`, Pack-/Rückgabefotos), Lettermint (`lettermint`) | USA | Kassen L-03 (30 Tage), Bestellungen L-04/L-05 (gestuft, Endstufe 6 Jahre, dann Anonymisierung) |
| V4 | Zahlung | Zahlung, Betrugsprävention | Art. 6 Abs. 1 lit. b, c, f | Kund:innen | Name, E-Mail, Adresse, Betrag, Zahlungs-/Erstattungs-IDs; Kartendaten nur beim Anbieter; Betrugssignale (Stripe) | Stripe (`stripe`, AV und eV), PayPal (`paypal`, eV), Apple/Google (Wallets, eV, DIENSTE §3.13), Bank (Vorkasse, eV) | USA (Stripe, Inc.) | L-16 (im Shop wie L-05/L-06; beim Anbieter nach dessen Pflichten) |
| V5 | Versand | Zustellung | Art. 6 Abs. 1 lit. b; lit. a (E-Mail an DHL) | Kund:innen | Name, Lieferadresse, Sendungsnummer; E-Mail nur mit Einwilligung | DHL Paket GmbH / Deutsche Post AG (`dhl`, eV) – **ohne** Schnittstelle: `CARRIER_DRIVER=manual` (`src/lib/carrier/manual.ts`), Jutta überträgt die Daten selbst | nein | mit der Bestellung (L-04/L-05); Einwilligungsnachweis L-19 a |
| V6 | Transaktions-E-Mails | Bestätigungen, Pflichtinformationen | Art. 6 Abs. 1 lit. b, c | Kund:innen, Anfragende, Widerrufende | E-Mail, Name, Mailinhalt (nicht gespeichert), Versandprotokoll (`src/collections/EmailLog.ts`) | Lettermint (`lettermint`) | nein | L-12 (wie Bezugsobjekt; ohne Bezug 90 Tage) |
| V7 | Rechnungen, Buchhaltung, Monatsexporte | gesetzliche Aufbewahrung, EÜR | Art. 6 Abs. 1 lit. c | Kund:innen | Name, Anschrift, Beträge, Rechnungsnummer | Neon (`neon`), Cloudflare R2 (`cloudflareR2`); Finanzamt/Steuerberatung (eV) | USA (Speicher-Anbieter) | L-06 (10 Jahre, umstellbar auf 8, K-33), L-07 (10 Jahre) |
| V8 | Widerrufsfunktion (§ 356a BGB) | Widerruf entgegennehmen, Eingangsbestätigung, Erstattung | Art. 6 Abs. 1 lit. c, f | Kund:innen | Name, Vertragsangaben, E-Mail, Grund (freiwillig), Eingangszeit (`src/collections/Withdrawals.ts`) | Neon (`neon`), Lettermint (`lettermint`) | USA (Speicher-Anbieter) | L-08 (6 Jahre; Spam/Test 30 Tage) |
| V9 | Reklamationen | Gewährleistung | Art. 6 Abs. 1 lit. b, c | Kund:innen | Kontaktdaten, Beschreibung, Fotos, Verlauf (`src/collections/Complaints.ts`) | Neon (`neon`), Cloudflare R2 (`cloudflareR2`), Lettermint (`lettermint`) | USA (Speicher-Anbieter) | L-09 (mit Stufe D der Bestellung) |
| V10 | Anfrage Auftragsarbeiten | Anfrage beantworten | Art. 6 Abs. 1 lit. b (K-25) | Anfragende | Name, E-Mail, Beschreibung, bis zu 5 Bilder, Nachweis des Datenschutzhinweises (`src/collections/Inquiries.ts`) | Vercel (`vercel`), Neon (`neon`), Cloudflare R2 (`cloudflareR2`), Lettermint (`lettermint`) | USA | L-10 (6 Monate ab Eingang) |
| V11 | Kontakt per E-Mail/Instagram | Kommunikation | Art. 6 Abs. 1 lit. b, f | Kontaktpersonen | Mailinhalt, Kontaktdaten | IONOS (`ionos`); Meta (bei DM, eV) | nein (IONOS); Meta laut Anbieter | L-11 (manuell: Benachrichtigungen 6 Monate, Geschäftsbriefe 6 Jahre) |
| V12 | Statistik (erst nach Bestätigung, K-30) | Reichweite | Art. 6 Abs. 1 lit. f (K-30) | Besucher:innen | Seitenaufrufe, grobe Region, Browser, Gerätetyp, Besucher-Hash 24 h | Vercel Web Analytics (`vercelAnalytics`, AV über Vercel-DPA) | USA | L-15 (Hash 24 h) – derzeit **aus** (`production: false`) |
| V13 | Fehlerüberwachung | Stabilität | Art. 6 Abs. 1 lit. f | Besucher:innen, Verwaltung | technische Fehlerdaten, bereinigt, ohne Personendaten | Sentry (`sentry`, EU-Region) | USA | L-14 (kürzeste Plan-Einstellung) |
| V14 | Spam- und Missbrauchsschutz | Sicherheit | Art. 6 Abs. 1 lit. f | Besucher:innen | HMAC der IP mit täglich wechselndem Schlüssel (`rate_limit_hits`) | – (eigene Datenbank: Neon) | USA (Speicher-Anbieter) | L-13 a (24 h) |
| V15 | Portfolio-Fotos von Tattoo-Kund:innen | Darstellung der Arbeit | Art. 6 Abs. 1 lit. a; § 22 KUG | Tattoo-Kund:innen | Fotos, Einwilligungsnachweis (`src/collections/TattooGallery.ts`) | Vercel (`vercel`), Cloudflare R2 (`cloudflareR2`) | USA | L-20 (bis Widerruf; Dateien spätestens 24 h danach gelöscht), Nachweis L-19 b (+ 3 Jahre) |
| V16 | Datenschutz-Anfragen | Erfüllung der Betroffenenrechte | Art. 6 Abs. 1 lit. c | Antragstellende | Kontaktdaten, Schriftverkehr, Exportdateien (`src/collections/PrivacyRequests.ts`), Löschprotokoll ohne Inhalte (`src/collections/DeletionLog.ts`) | Neon (`neon`), Cloudflare R2 (`cloudflareR2`), Lettermint (`lettermint`) | USA (Speicher-Anbieter) | L-17 (3 Jahre; Exporte 30 Tage nach Antwort), L-18 (3 Jahre) |
| V17 | Backups | Wiederherstellung | Art. 6 Abs. 1 lit. c, f; Art. 32 | alle oben genannten | alle Daten, vor dem Upload verschlüsselt | Cloudflare R2 (`cloudflareR2`, eigener Backup-Speicher), Neon (`neon`, Wiederherstellungsfenster); **nicht** GitHub | USA (Speicher-Anbieter) | L-23 (30 Tage täglich, 12 Monate monatlich, Neon ≤ 7 Tage) |
| V18 | Übersetzung eigener Texte | Übersetzen von Produkt-/Seitentexten | – (keine personenbezogenen Daten) | – | **keine** personenbezogenen Daten (Allowlist, `src/lib/translation/deepl.ts`) | DeepL (`deepl`) | nein | – |
| V19 | Instagram-Profil | Präsentation | Art. 6 Abs. 1 lit. f; ggf. Art. 26 (K-29) | Nutzer:innen von Instagram | Daten bei Meta; die Website verlinkt nur, keine Einbettung | Meta Platforms Ireland Ltd. (eV) | laut Meta | nach Meta |
| V20 | Verwaltung (Konto, Sitzung, Verwaltungsprotokoll) | Betrieb der Verwaltung, Nachvollziehbarkeit | Art. 6 Abs. 1 lit. b, c, f | Jutta | Konto, Sitzungstoken, Protokoll mit maskierten Personendaten (`src/collections/Users.ts`, `src/collections/AuditLog.ts`) | Vercel (`vercel`), Neon (`neon`) | USA | L-21 (Sitzung ≤ 7 Tage), L-13 h (3 bzw. 10 Jahre) |

Nicht verarbeitet werden: Kundenkonten, Newsletter, Kontaktformular, Bewertungen, Profiling, automatisierte
Entscheidungen durch die Verantwortliche (KANZLEI-BRIEFING §11.4), Dienste aus DIENSTE §5. Der Beispielbestand
(`seed: true`) enthält nur fiktive Personen und wird vor dem Go-live entfernt (L-22).

## 4. Empfänger und Auftragsverarbeiter

Maßgeblich ist DIENSTE §2/§7. Die öffentliche Empfänger-Tabelle unter der Datenschutzerklärung wird aus derselben YAML
erzeugt (`src/lib/legal/services.generated.ts`, Komponente `src/components/legal/ProcessorTableView.tsx`); der Stand der
Verträge nach Art. 28 DSGVO steht in der Verwaltung unter Einstellungen → „Auftragsverarbeitung“
(`settings.processorAgreements`, R-155; Abschluss durch Jutta in P11, DIENSTE §6).

## 5. Änderungsprotokoll

| Datum | Version | Änderung |
|---|---|---|
| 02.10.2026 | 1.0 | Erstfassung (P6.21) aus DIENSTE 1.4, LOESCHKONZEPT und KANZLEI-BRIEFING §11.4 (V1–V19), ergänzt um V20 (Verwaltung) und `pc-motion` (V2) |
