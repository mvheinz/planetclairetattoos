# SEED-SPEC – Beispielbestand Planet Claire (E-63)

> Stand 26.09.2026 · Leser: Agenten für **P1** (Grund-Seed, Lader, Datenebene) und **P8** (vollständiger Bestand),
> außerdem P4 (Beleg-PDFs), P7 (Tattoo-Seiten), P9 (Zeichnungen) und der Vorschau-Generator (P10).
> Quellen: ENTSCHEIDUNGEN (E-14…E-18, E-22…E-25, E-42, E-47, E-50…E-53, E-62…E-64, E-98), DATENMODELL §4–§7, §13,
> KONZEPT §3, §9, §11, §12, RECHT R-172, R-180…R-182 und V-01…V-31, ARCHITEKTUR §2.1, §4.8, §5.2, §6.10, §8.6, §14,
> DESIGN §11.4, §12.3, §12.4, Manifest `content/seed/instagram/manifest.json`.
> **Rangfolge:** ENTSCHEIDUNGEN > Fachdokumente > PLAN. Für den Beispielbestand sind **diese Datei und DATENMODELL §13.3**
> maßgeblich (Nummern, Nummernkreise, Mengen, Mail-Domains, Beispiel-IBAN, Referenzzeit, `seedKey`, Hook-Ausnahmen);
> KONZEPT §11 und DATENMODELL §13.2 verweisen für alle Einzelwerte hierher; die Mengen stehen **nur** in §0.1.
> Namen im Code (Umgebungsvariablen, Skripte, Task-Slugs, Pfade): ARCHITEKTUR · Feldnamen/Enums: DATENMODELL ·
> Verhalten/UI-Texte: KONZEPT · Recht: RECHT.
> §0.3 fasst die Festlegungen zusammen, §20 listet die offenen Punkte `SE-01` ff.
> **Wichtig:** Diese Datei liegt unter `content/**` und wird vom Verbotsmuster-Test (RECHT §5) mitgescannt. Sie ist so
> geschrieben, dass sie ohne Allowlist-Eintrag besteht. Zitate aus Instagram-Bildern (Liedzeilen o. Ä.) stehen bewusst
> nicht hier.

---

## 0. Überblick

### 0.1 Mengen (kanonisch, nach `pnpm seed:reset` mit kanonischem `SEED_NOW`)

Diese Tabelle ist die **einzige** Quelle für die Mengen des Beispielbestands. KONZEPT §11, DATENMODELL §13.2 und
PLAN P8 wiederholen die Zahlen nicht, sondern verweisen hierher. Die Mengen gelten vollständig ab P8; P1 legt nur den
Grund-Seed und den Mini-Satz an (Spalte „Phase“, §1.8).

| Collection | Anzahl | `seed` | Phase | Abschnitt |
|---|---|---|---|---|
| `users` (Admin) | 0–1 | – | P1 | §3.5 |
| `categories` | 6 | – (Grund-Seed) | P1 | §3.3 |
| `settings`, `site-texts` (Globals) | je 1 | – (Grund-Seed) | P1 | §3.1 |
| `legal-texts` | 6 (Platzhalter v1) | `false` (Grund-Seed) | P1 | §3.4 |
| `media` | 48 (17 Instagram-Ausschnitte + 1 eigenes Foto von Jutta + 30 Platzhalter) | `true` | P1 Mini-Satz · P8 vollständig | §4 |
| `private-uploads` | 7 (+ 15 Beleg-PDFs) | `true` | P1 Mini-Satz · P8 vollständig | §4.4, §9 |
| `products` | 30 | `true` | P1 Mini-Satz · P8 vollständig | §5 |
| `checkouts` | 14 (12 abgeschlossen, 1 abgelaufen, 1 offen) | `true` | P1 Mini-Satz (KS2) · P8 vollständig | §7.3 |
| `orders` | 14 | `true` | P8 | §7 |
| `reservations` | 10 (nur die bei `N` noch vorhandenen, L-02) | `true` | P1 Mini-Satz (KS2) · P8 vollständig | §8 |
| `invoices` | 15 (12 Rechnungen, 3 Gutschriften) | `true` | P8 (PDF-Renderer aus P4) | §9 |
| `invoice-counters` | 2 Zeilen (`BSP-RE`/`BSP-GS`, 2026) | – (wird entfernt) | P8 | §9 |
| `withdrawals` | 7 (jeder Wert aus `WITHDRAWAL_STATUSES` und `WITHDRAWAL_MATCH_STATUSES`) | `true` | P8 | §10 |
| `complaints` | 4 (je einer aus `COMPLAINT_STATUSES`) | `true` | P8 | §10a |
| `inquiries` | 7 (je einer aus `INQUIRY_STATUSES`) | `true` | P8 | §11 |
| `privacy-requests` | 5 (je einer aus `PRIVACY_REQUEST_STATUSES`) | `true` | P8 | §11a |
| `flash` | 10 | `true` | P8 | §12.1 |
| `tattoo-gallery` | 6 | `true` | P8 | §12.3 |
| `tour-dates` | 8 | `true` | P12 | §12.5 |
| `pages` | 13 (alle `PAGE_KEYS`) | `true` | P1 Mini-Satz (`home`, `contact`) · P8 vollständig | §13 |
| `faqs` | 12 | `true` | P8 | §14 |
| `revenue-entries` | 18 (9 Monate × Tattoo/Flohmarkt) | `true` | P8 | §15 |
| `email-log` | 78 | `true` | P8 | §16.1 |
| `consent-log` | 14 | `true` | P8 | §16.2 |
| `audit-log` | 8 | `true` | P8 | §16.3 |
| `webhook-events`, `documents`, `conformity-declarations` | 0 | – | – | §0.3 |

### 0.2 Was der Bestand abdeckt

- **Stücke:** alle 6 Kategorien; alle 5 `PRODUCT_STATUSES`; `soldChannel` `online`, `pickup`, `offline`; 1 verkauftes Stück
  ohne Archiv; alle 4 `SHIPPING_CLASSES`; Mehrkomponenten-Faserangabe, Mischgewebe, „Etikett fehlt“, abweichende
  Beschaffenheit (Textil und Papier), Nickel-Nachweis, EN fehlt / maschinell, Rückläufer wieder verfügbar.
- **Bestellungen:** jeder der 13 `ORDER_STATUSES` (DATENMODELL §4) mindestens einmal (`refunded` zweimal: Voll-Widerruf
  und Erstattung einer bezahlten Bestellung, deren Keramik vor dem Versand zerbrochen ist, Übergang O15 mit Grund
  `breakage`); `cancelled` mit `cancelReason = payment_timeout`;
  `disputed` mit `statusBeforeDispute`; alle `PAYMENT_METHODS` (Karte, Apple Pay, Google Pay, PayPal, Vorkasse);
  Versand und Abholung; Teil-Widerruf mit Teil-Erstattung; Voll-Erstattung; automatisch gesetzte Zustellung
  (`deliveredSource = auto`); Deutsche Post und DHL; Verpackungsdaten an jeder gepackten/versendeten Bestellung;
  Sprache `en` zweimal.
- **Kassen** (`checkouts`, DATENMODELL §6.25): Vorgänge ohne Bestellung sind Kassen – eine abgelaufene (PayPal
  abgebrochen, `expired`) und eine offene (`open`, Stück gerade reserviert); dazu die abgeschlossenen Kassen
  (`completed`) der Bestellungen, die jünger als 30 Tage sind (L-03).
- **Widerrufe:** alle `WITHDRAWAL_MATCH_STATUSES` (`auto_matched`, `manually_matched`, `needs_manual_match`, `no_order`);
  alle `WITHDRAWAL_STATUSES` (`received`, `goods_returned`, `partially_refunded`, `refunded`, `closed` mit `closeReason =
  duplicate`, `rejected` als Test-Eingabe mit Test/Spam-Markierung); einer auf Englisch.
- **Reklamationen** (`complaints`): alle `COMPLAINT_STATUSES`; Transportschaden (mit DHL-Frist) und Mangel; mit und ohne
  Fotos; Reparatur-Wahl verschickt (M12), von der Kund:in gewählt (Gewährleistung + 12 Monate) und offen; eine abgelehnte
  mit Streitbeilegungshinweis (M13).
- **Anfragen:** alle `INQUIRY_STATUSES`, eine mit Referenzbild, zwei auf Englisch.
- **Datenschutz-Anfragen** (`privacy-requests`): alle `PRIVACY_REQUEST_STATUSES`; Arten Auskunft, Löschung; Kanäle E-Mail,
  Brief, Instagram-Nachricht; eine auf Englisch; Fristen `dueAt` vor und nach `N`.
- **Tattoo:** 10 Flash (4 wiederholbar, 2 vergeben), 8 Termine „Planet Claire on Tour“ (§12.5), 6 Galerie-Einträge
  (2 echte Fotos ohne Einwilligung, 4 Platzhalter), Preisrahmen.
- **Texte:** alle 13 Seiten, Startseite mit Kopf-Station + 7 Stationen, 12 FAQ, Aftercare-Phasen – DE und EN.

### 0.3 Festlegungen (verbindlich, mit DATENMODELL §13.3 abgestimmt)

| Thema | Festlegung | Grund |
|---|---|---|
| Stücknummern | Seed **901–930** (`900 + n`); E2E-Fixtures **980–999** (nur Test-DB, ARCHITEKTUR §7.2). Der Bereich 901–999 ist für Jutta gesperrt, solange Beispieldaten existieren (DATENMODELL §13.3) | keine Kollision mit Juttas Nummern; der Nummernvorschlag bleibt bei 1 |
| Bestell- und Belegnummern | Bestellungen `PC-2026-900NN`; Rechnungen `BSP-RE-…`, Gutschriften `BSP-GS-…` (eigener Nummernkreis im Enum `INVOICE_SERIES`); Widerrufe `WR-2026-9000N`; Anfragen `AA-2026-900N`; Datenschutz-Anfragen `DS-2026-900N`. Bestell-, Widerrufs-, Anfrage- und Datenschutz-Nummern haben das Format echter Nummern (Seed-Bereich ab 90001 bzw. 9001) und steigen wie echte Sequenzen mit dem Eingangszeitpunkt; jede Beispiel-Bestellung und jeder Beispielbeleg zeigt zusätzlich sichtbar „Beispiel“ (§1.1) | echte Zähler `RE`/`GS` und Sequenzen bleiben lückenlos; die Widerrufs-Zuordnung `PC-\d{4}-\d{5}` funktioniert auch mit Seed |
| Referenzzeit | `SEED_NOW` (ARCHITEKTUR §5.2); CI und Tests `2026-10-15T10:00:00+02:00` | eine einzige Variable |
| E-Mail-Adressen | nur `@example.com` / `@example.org`; der Mailversand unterdrückt immer `example.com`, `example.org`, `example.net`, `*.invalid`, `*.test` (ARCHITEKTUR §3.4) | R-180; reservierte Domains |
| Beispiel-IBAN | **`DE36000000000000000000`** (Anzeige `DE36 0000 0000 0000 0000 00`) als Standardwert in `settings`; die Go-live-Sperre (DATENMODELL §13.7) meldet genau diesen Wert als Platzhalter | Prüfziffer gültig, BLZ 00000000 gehört zu keiner Bank |
| Keramik | **alle** Keramik `foodContact = deko`, 0 `conformity-declarations`; Stücke mit Lebensmittelkontakt gibt es nur als Test-Fixtures (Nummern 980–999), nie im Seed | keine erfundenen Glasur-Nachweise (E-15) |
| Stücke je Kategorie | keramik 9, textil 5, cap 4, zeichnung 7, schmuck 4, sonstiges 1 | richtet sich nach dem Instagram-Material |
| Status-Verteilung | 14 `available`, 2 `reserved`, 11 `sold`, 1 `archived`, 2 `draft` | jede verkaufende Bestellung braucht ein `sold`-Stück |
| Vorgänge | 14 Bestellungen (alle 13 Status, `refunded` zweimal) + 2 Kassen ohne Bestellung (abgelaufen, offen), 7 Widerrufe, 4 Reklamationen, 7 Anfragen, 5 Datenschutz-Anfragen (jeweils jeder Status mindestens einmal), 12 FAQ, 18 Umsatzeinträge (9 Monate) | E-63; KONZEPT §11.1; vor der Zahlung gibt es nur die Kasse (DATENMODELL §6.8, §6.25) |
| Kassen und Reservierungen | der Seed legt nur an, was bei `N` nach den Löschfristen noch existiert: Kassen mit Anlage nach `N − 30 Tage` (L-03), Reservierungen `active` oder mit Freigabe/Umwandlung nach `N − 7 Tage` (L-02); ältere Bestellungen haben `checkout = null` (SE-12) | Löschjobs ändern die Mengen nach dem Seed nicht |
| Idempotenz-Schlüssel | Feld `seedKey` in `seedField()` aller seedbaren Collections, partieller UNIQUE-Index (§1.2) | FAQ, Logs und Medien-Ausschnitte haben keinen natürlichen Schlüssel |
| Seed-Kontext | Hook-Ausnahmen bei `req.context.seed === true` (§1.6, DATENMODELL §1.5) | Endstatus und vergangene Zeitstempel beim Anlegen |
| `revenue-entries` | ein echter Eintrag für denselben Monat und dieselbe Quelle ersetzt den Seed-Eintrag (§1.3, DATENMODELL §6.20) | kein UNIQUE-Konflikt, wenn Jutta echte Monate einträgt |
| Rechtstext-Platzhalter | Grund-Seed (`seed = false`, `origin = placeholder`), `validFrom = 2026-01-01` (§3.4, R-002) | alle Seed-Bestellungen verweisen auf Version 1; die Platzhalter bleiben beim Entfernen der Beispieldaten |
| Vorkasse-Fristen | Erinnerung bei `placedAt + 72 h`; Zahlungsfrist 23:59:59 Europe/Berlin am 5. Kalendertag nach dem Bestelltag (Berliner Datum), danach Storno und Freigabe durch den Job `cancelOverduePrepayments` (§7.2, KA-28) | E-23; eine einzige Implementierung in `src/lib/commerce/` |
| Flash-Anzeige | `F-` + Nummer, z. B. `F-901` (KONZEPT §9.3) | – |
| Flash-Motive | F-905 (Schnecke) und die übrigen Platzhalter-Flash sind neue eigene Motive; das verheilte Kundentattoo G1 wird bewusst **nicht** als Flash angeboten | Einzelstück der Kundin bzw. des Kunden |
| `categories.coverImage` | bleibt leer; Kategorie-Kacheln nutzen bis zur Pflege durch Jutta die Stationszeichnungen | der Grund-Seed zeigt nie auf Seed-Medien |

---

## 1. Regeln

### 1.1 Kennzeichnung

- Jedes Dokument des **Beispielbestands** hat `seed = true` und einen `seedKey` (auch Medien, private Dateien, Belege,
  Kassen, Reservierungen, Logs). Ausnahmen: `invoice-counters` (kein Seed-Feld; die Zeilen `BSP-RE`/`BSP-GS` gelten als Seed
  und werden beim Entfernen gelöscht) und `settings.seed.*`.
- **Grund-Seed** (`categories`, `settings`, `site-texts`, `legal-texts`, Admin) hat `seed = false` und bleibt im Echtbetrieb.
- Personen sind erkennbar erfunden (§6): E-Mail nur `@example.com`/`@example.org`, keine Telefonnummern, keine echten
  Straßen in Berlin, keine Bewertungen oder Testimonials (R-180, V-17).
- **Sichtbar „Beispiel“:** Jede Bestellung und jeder Beleg mit `seed = true` trägt zusätzlich sichtbar das Wort
  „Beispiel“ / “Example”: als Etikett in Listen und Detailansichten der Verwaltung, als Hinweis auf Danke- und
  Statusseite und als Wasserzeichen „BEISPIELBELEG – kein echter Beleg“ im Beleg-PDF (§9). Die Nummern selbst bleiben
  im Format echter Nummern (§2.5).

### 1.2 `seedKey`

- Feld im Baustein `seedField()` (DATENMODELL §5) in **allen** seedbaren Collections: `seedKey` – text, readOnly,
  `admin.hidden`, **UNIQUE wenn gesetzt** (partieller UNIQUE-Index `WHERE seed_key IS NOT NULL`, P1-Migration). Wird bei
  „Übernehmen“ (adopt) **nicht** geleert.
- Format `<collection>:<schlüssel>`, Regex `^[a-z-]+:[A-Za-z0-9:#._-]{1,80}$`.

| Collection | Schlüssel | Beispiel |
|---|---|---|
| `media` Instagram | `ig:<Kürzel>[#<Ausschnitt>]` | `media:ig:DdUPhoZOoMW#a` |
| `media` Platzhalter | `ph:<typ>-<n>` | `media:ph:teller-01` |
| `private-uploads` | frei | `private-uploads:nickel-demo`, `private-uploads:O12:packing-1` |
| `products` | `S01`…`S30` | `products:S07` |
| `orders` | `O01`…`O14` | `orders:O05` |
| `checkouts` | Schlüssel der Bestellung (`O03`…`O14`) bzw. `KS1`, `KS2` für Kassen ohne Bestellung | `checkouts:O13`, `checkouts:KS2` |
| `reservations` | Schlüssel der Kasse, bei mehreren Stücken `<Kasse>:<Stück>` | `reservations:O07`, `reservations:KS2` |
| `invoices` | `<Bestellung>:invoice` / `<Bestellung>:credit_note:<k>` | `invoices:O05:credit_note:1` |
| `withdrawals` / `inquiries` | `W1`…`W7` / `A1`…`A7` | `withdrawals:W2` |
| `complaints` / `privacy-requests` | `RK1`…`RK4` / `DS1`…`DS5` | `complaints:RK2`, `privacy-requests:DS3` |
| `flash` / `tattoo-gallery` / `tour-dates` | `F901`…`F910` / `G1`…`G6` / `TD1`…`TD8` | `flash:F907` |
| `pages` / `faqs` | Page-Key / `FAQ01`…`FAQ12` | `pages:home`, `faqs:FAQ05` |
| `revenue-entries` | `<M-k>:<source>` | `revenue-entries:M-9:tattoo` |
| `email-log` / `consent-log` / `audit-log` | `<Bezug>:<template/zweck>` | `email-log:O05:refund_confirmation` |

### 1.3 Idempotenz

Ein zweiter Lauf von `pnpm seed` ändert keine Anzahl (AK-SEED-01). Suche immer über `seedKey`.

| Gruppe | Collections | Regel bei vorhandenem `seedKey` |
|---|---|---|
| Inhalt | `media`, `products`, `flash`, `tattoo-gallery`, `tour-dates`, `pages`, `faqs` | Dokument mit `seed = false` (übernommen) → **überspringen**. Sonst Inhaltsfelder aktualisieren (Texte, Alt-Texte, Maße, Bilder-Reihenfolge, Pflichtangaben). **Nie** ändern: `itemNumber`/`number`, `status` und alle Verkaufsfelder (§5.3), `category` außer bei `draft`, `priceCents` bei `reserved`/`sold`. Leere Verweise (`currentOrder`, `reservationRef`) dürfen ergänzt werden. Mediendateien werden nur mit `--refresh-media` neu hochgeladen. |
| Vorgänge | `checkouts`, `orders`, `reservations`, `invoices`, `withdrawals`, `complaints`, `inquiries`, `privacy-requests`, `revenue-entries`, `private-uploads`, alle Logs | **nur anlegen**; vorhandene nie ändern. Abweichungen zur Datei meldet der Lauf als „unverändert (create-only)“. Änderungen wirken erst nach `pnpm seed:reset`. |
| Grund-Seed | `categories`, `settings`, `site-texts`, `legal-texts`, Admin | **nur fehlende** Dokumente anlegen bzw. **leere** Felder füllen; nie Juttas Werte überschreiben. |

Zusatzregeln:
- `revenue-entries`: Hält ein echtes Dokument (`seed = false`) schon (`month`, `source`), wird der Seed-Eintrag
  übersprungen. Umgekehrt ersetzt ein echter Eintrag den Seed-Eintrag: Der `beforeChange`-Hook löscht beim Anlegen
  eines echten Eintrags den Seed-Eintrag gleicher (`month`, `source`) in derselben Transaktion, damit kein
  UNIQUE-Konflikt entsteht (DATENMODELL §6.20).
- Nummernkollision (`itemNumber`, `flash.number`) mit einem echten Dokument → Lauf bricht vor dem ersten Schreiben ab
  und nennt die Nummer.

### 1.4 Befehle (`package.json`)

| Befehl | Inhalt | In Produktion |
|---|---|---|
| `pnpm seed:base` | nur Grund-Seed (§3), create-if-missing | **erlaubt** (Erstbefüllung P11) |
| `pnpm seed:example [--only=<collection,…>] [--refresh-media]` | Beispielbestand (§4–§16) | Abbruch, Exit 1 |
| `pnpm seed` | `seed:base` + `seed:example` | Abbruch **vor** dem ersten Schreiben, Exit 1 (AK-11-04) |
| `pnpm seed:remove --yes [--drop-texts]` | §18 (entspricht dem Admin-Knopf); ohne `--yes` nur Mengenvorschau | Abbruch, Exit 1 (ARCHITEKTUR §4.8); in Produktion entfernt stattdessen der Admin-Knopf „Beispieldaten entfernen“ (ab P8, mit „Texte behalten“, DATENMODELL §13.5) die Beispieldaten |
| `pnpm seed:reset` | `seed:remove --yes --drop-texts`, dann `seed:base`, dann `seed:example` (nur Entwicklung, Test, Vorschau-Export) | Abbruch, Exit 1 |

Skriptnamen nach ARCHITEKTUR §6.10; `seed:reset` ist die Ergänzung dieser Datei dazu. Umsetzung:
`"seed": "cross-env NODE_OPTIONS=--no-deprecation payload run scripts/seed/cli.ts -- all"` usw.; Unterbefehle `base`,
`example`, `remove`, `reset`, `all`. Die Logik liegt in `src/lib/seed/` (ARCHITEKTUR §2.1), das Skript ruft sie nur auf.
Ausgabe je Collection: angelegt / aktualisiert / übersprungen.

### 1.5 Produktionssperre

- `src/lib/seed/guard.ts`: Abbruch mit Exit 1 und Meldung, **bevor** eine Verbindung schreibt, wenn
  `APP_ENV === 'production'` **oder** die Datenbank als Produktion markiert ist (`COMMENT ON DATABASE …
  'planetclaire:production'`, `isProductionDatabase()` aus `src/lib/db/guard.ts`, ARCHITEKTUR §4.8) – für `seed`,
  `seed:example`, `seed:remove`, `seed:reset`.
- Zusätzlich: Abbruch, wenn in `orders` ein Dokument mit `stripe.livemode = true` existiert.
- Kein Schalter hebelt das aus (KONZEPT §11.2). Seed ist nicht Teil von Build, Migration, Deploy oder `postinstall`.
- `NODE_ENV` und `VERCEL_ENV` werden nicht ausgewertet (Produktion = `APP_ENV=production`, ARCHITEKTUR §4.2, §5.2).

### 1.6 Seed-Kontext (Hook-Ausnahmen)

Alle Schreibvorgänge laufen über die Local API mit `overrideAccess: true` und
`req.context = { seed: true, skipAudit: true }`. Hooks müssen darauf so reagieren (verbindlich, DATENMODELL §1.5; die
Ausnahmen gelten nur bei `req.context.seed === true`, nie über die Verwaltung oder die REST-API):

| Collection | Normal | Mit `context.seed` |
|---|---|---|
| alle | Mails, Jobs, `revalidateTag`, Audit | **aus** (keine Mail, kein Job, kein Stripe/DeepL, keine Revalidierung) |
| `products` | Status nur über Aktionen; `firstPublishedAt` & Co. vom System | `status`, Verkaufsfelder und Zeitstempel beim **Anlegen** aus den Daten; `validateForPublish` läuft trotzdem für `available`/`reserved` |
| `checkouts` | Anlage nur über `startCheckout`, Zustand über die Kassen-Services, `tokenHash` aus Zufallstoken | Anlegen mit Endzustand (`completed`, `expired`, `open`), Zeitstempeln und `tokenHash` aus §2.5; keine Stripe-Session, kein Cookie |
| `orders` | Status über `transitionOrder()`, Nummer aus Sequenz, Zeitstempel = jetzt | Anlegen mit Endstatus, fester `orderNumber`, Zeitstempeln, `statusHistory` (aus der Zeitleiste, §7.2) und `statusTokenHash`/`statusTokenSealed` aus §2.5; Sequenz bleibt unberührt |
| `invoices` | Nummer aus Zähler, `issueDate` = heute, danach Job `renderInvoicePdf` | Nummer **aus dem Zähler** (Serie `BSP-*`), `issueDate`/`deliveryDate` aus den Daten, **kein** Job; PDF siehe §9 |
| `withdrawals` | `receivedAt` = Serverzeit, Auto-Zuordnung, sofortige Mail | `receivedAt`, `matchStatus`, `status` aus den Daten; keine Mail |
| `inquiries`, `complaints`, `privacy-requests` | Nummer aus Sequenz (`AA`, `DS`), Anlage-/Eingangszeit = jetzt, Status nur über Aktionen, Mails über die Outbox | feste Nummer (§2.5), `createdAt`/`receivedAt`, Status und alle Zeitstempel (`lastActivityAt`, `repairChoiceSentAt`, `customerChoiceAt`, `vsbgNoticeSentAt`, `identityVerifiedAt`, `answeredAt`) aus den Daten; berechnete Felder (`deleteAfter`, `dueAt`, `retainUntil`, `carrierClaimDueAt`, `warrantyEndsAt`) rechnet der Hook wie sonst; keine Mail, kein Job |
| `tattoo-gallery` | `published` nur mit Einwilligung bei `showsCustomer` | erlaubt `published = true` ohne Einwilligung, **nur** wenn `seed = true`; öffentlich sichtbar nur bei wirksamem `SEED_PREVIEW_MODE` (`APP_ENV ≠ production`), nie in Produktion (KONZEPT §9.7, R-172, R-181) |
| `legal-texts` | `validFrom ≥ jetzt − 1 min` | `validFrom` in der Vergangenheit erlaubt (Grund-Seed) |
| `pages`, `faqs` | jedes Speichern ohne `context.seed` setzt `seed = false` (adopt) | kein adopt |
| `email-log`, `consent-log`, `audit-log`, `reservations` | `create: none` | Anlegen über Local API |

### 1.7 Import-Reihenfolge (eine Transaktion je Schritt)

1. Guard (§1.5), `SEED_NOW` auflösen (§2.2), Daten laden und mit zod prüfen (alles oder nichts).
2. Grund-Seed (§3).
3. `media` (Ausschnitte erzeugen, §4) → `private-uploads` (§4.4).
4. `products` (ohne `currentOrder`) → `flash` → `tattoo-gallery` → `tour-dates` → `pages` → `faqs`.
5. `checkouts` (§7.3) → `orders` in Reihenfolge `placedAt` → `reservations` (§8); danach `checkouts.order`,
   `orders.checkout`, `reservations.order` und `products.currentOrder`/`reservationRef` setzen.
6. `invoices`: je Serie streng nach `issueAt` (§9), danach `orders.invoice` und `refunds[].creditNote` verknüpfen.
7. `withdrawals` → `complaints` (§10a) → `inquiries` → `privacy-requests` (§11a) → `revenue-entries`; danach
   `private-uploads.relatedComplaint` bzw. `relatedInquiry` der Fotos und Skizzen setzen (wie Schritt 5).
8. Logs (P8): `email-log`, `consent-log`, `audit-log`.
9. `settings.seed.exampleDataPresent = true`, `settings.seed.importedAt` = aktuelle Zeit der injizierten Uhr
   (ARCHITEKTUR A-08, nicht `N`).

### 1.8 Phasen

| Phase | Aufgabe |
|---|---|
| **P1** | Seed-Rahmen: `src/lib/seed/*` (Lader, zod-Schemas, Guard, `time.ts`, `tokens.ts`, `fallbackArt.ts`, `remove.ts`) und `scripts/seed/cli.ts` mit allen Befehlen §1.4; Grund-Seed §3 (Plan P1.29). Vom Beispielbestand nur der **Mini-Satz** (Plan P1.30, DATENMODELL §13.1, W-21): Stücke S01, S06, S09, S11, S15, S18, S20, S25, S26, S27 (alle Kategorien außer `sonstiges` – S30 hängt an der Bestellung O09 –, jeder `ProductStatus`), dazu die offene Kasse KS2 mit ihrer Reservierung, die privaten Dateien `nickel-demo` und `glaze-demo` (Nachweise für S26), die dafür und für die Startseite nötigen Medien (Instagram-Ausschnitte §4.1 über die Pipeline aus P1.13; `ph:`-Bilder über `fallbackArt.ts`, §4.3) und die Seiten `home` und `contact`. Die Datendateien tragen schon die endgültigen `seedKey`s; spätere Phasen ergänzen nur |
| P4 | Beleg-PDF-Renderer mit Wasserzeichen „BEISPIELBELEG“ (§9), den der Seed ab P8 direkt (ohne Job) nutzt. Tests zu Kasse, Danke- und Statusseite laufen bis P8 gegen gleichartige Fixtures (Nummern 980–999) statt gegen die Anker §17 (Regel „Beispielbestand vor P8“ in den Arbeitsregeln von `PLAN.md`; mit den echten Ankern prüft P8.21) |
| P7 | Tattoo-Seiten für `flash`, `tattoo-gallery` und die Seiten-Blöcke aus §13.5; bis P8 mit Test-Fixtures |
| **P8** | Vollständiger Bestand laut §0.1: alle übrigen Datensätze aus §4–§15 (Medien, private Dateien, Stücke, Kund:innen, Bestellungen, Kassen, Reservierungen, Belege mit BSP-PDFs, Widerrufe, Reklamationen, Anfragen, Datenschutz-Anfragen, Tattoo, Seiten, FAQ, Umsätze; Reklamationen und Datenschutz-Anfragen samt aller Status in Plan P8.5a), Logs (§16), echte Platzhalter-SVGs nach DESIGN §12.3 in `src/art/placeholders/`, Texte gegenlesen, Import aus dem Instagram-Export (bessere Auflösung, gleiche `seedKey`s), AK-SEED vollständig grün |
| P9 | Feinschliff Platzhalter (`--refresh-media`), Stationszeichnungen (Code-Assets, nicht in `media`) |
| P10 | Vorschau-Datei liest den Bestand mit `SEED_PREVIEW_MODE=true` (§17) |

---

## 2. Formate

### 2.1 Dateien

| Pfad | Inhalt |
|---|---|
| `content/seed/SEED-SPEC.md` | diese Spezifikation |
| `content/seed/data/base.json` | Grund-Seed §3 |
| `content/seed/data/media.json` | §4.1, §4.2 |
| `content/seed/data/private-uploads.json` | §4.4 |
| `content/seed/data/products.json` | §5 |
| `content/seed/data/customers.json` | §6 |
| `content/seed/data/orders.json` | §7, §8, §9 (Kassen, Bestellungen inkl. Reservierungen, Erstattungen, Belegen) |
| `content/seed/data/withdrawals.json`, `complaints.json`, `inquiries.json`, `privacy-requests.json` | §10, §10a, §11, §11a |
| `content/seed/data/tattoo.json` | §12 (Flash, Galerie) |
| `content/seed/data/tour.json` | §12.5 (Termine „Planet Claire on Tour“) |
| `content/seed/data/pages.json`, `faqs.json` | §13, §14 |
| `content/seed/data/revenue.json` | §15 |
| `content/seed/data/logs.json` | §16 (Regeln + Ausnahmen) |
| `src/lib/seed/` | Seed-Bibliothek (Lader, Guard, `time.ts`, `tokens.ts`, `remove.ts`, `fallbackArt.ts`; ARCHITEKTUR §2.1) |
| `scripts/seed/cli.ts` | CLI für alle Befehle §1.4 (ruft nur `src/lib/seed/` auf) |
| `src/lib/seed/schemas.ts` | zod-Schemas je Datei; Enum-Werte **nur** aus `src/lib/enums.ts` |
| `src/art/placeholders/{typ}-{n}.svg` | Platzhalter (P8/P9, DESIGN §12.3); fehlt die Datei → `src/lib/seed/fallbackArt.ts` |

Die Daten liegen unter `content/**`, damit der Verbotsmuster-Test (RECHT §5) sie prüft. Einziger Allowlist-Eintrag:
der fremde Figurenname in `tattoo.json` (Galerie G2, Bildunterschrift aus dem Manifest) – mit Begründung „Tattoo-Portfolio,
keine Verkaufsware (E-18)“ (offen: SE-04).

### 2.2 Zeitausdrücke

Alle Datums-/Zeitwerte in den Datendateien sind **Ausdrücke relativ zu `N`**; die Datei enthält keine absoluten Daten.

```
expr      = dayExpr | nowExpr | monthExpr
dayExpr   = anchor [ "@" time ]          ; ohne Uhrzeit → 12:00
anchor    = "D" sign int                 ; Berliner Kalendertag von N ± n Tage
          | "SAT>=D" sign int            ; erster Samstag an oder nach diesem Tag
nowExpr   = "N" [ sign int ( "min" | "h" ) ]   ; Zeitpunkt-Arithmetik
monthExpr = "M-" int                     ; Monat von N minus k → "YYYY-MM"
time      = HH ":" MM [ ":" SS ]         ; Wanduhrzeit Europe/Berlin (Sommer-/Winterzeit beachten)
sign      = "+" | "-"
```

- **`N`** = `SEED_NOW` (ISO 8601 mit Offset, ARCHITEKTUR §5.2). Nicht gesetzt → Ausführungszeit, auf die Minute
  abgerundet. Gesetzt, aber kein gültiger ISO-8601-Zeitpunkt mit Offset → Exit 1.
- **Kanonisch:** `N = 2026-10-15T10:00:00+02:00` (Donnerstag; so auch in CI). Alle Tests, Screenshots und Beispielwerte
  dieser Datei beziehen sich darauf. Der Vorschau-Export setzt `SEED_NOW` = Exportdatum 12:00 Berlin (ARCHITEKTUR §14.3).
- Funktion `resolveSeedTime(expr: string, opts: { now: Date }): Date | string` in `src/lib/seed/time.ts`
  (Berlin-Kalender über `Intl`/`Temporal`-Polyfill, keine eigene Offset-Rechnung).
- Jahr in Nummern (`PC-2026-…`, `WR-2026-…`, `AA-2026-…`, `DS-2026-…`) ist fest (DATENMODELL §13.3). Belegnummern nehmen das Jahr aus
  `issueDate` (Zählerlogik).

Pflicht-Testfälle (`tests/unit/seed/time.unit.spec.ts`, kanonisches `N`):

| Ausdruck | Ergebnis |
|---|---|
| `D-50` | `2026-08-26T10:00:00Z` (12:00 Sommerzeit) |
| `D-41@19:12` | `2026-09-04T17:12:00Z` |
| `D+3@23:59:59` | `2026-10-18T21:59:59Z` |
| `D+13@21:18` | `2026-10-28T20:18:00Z` (Winterzeit ab 25.10.) |
| `SAT>=D+56@12:00` | `2026-12-12T11:00:00Z` |
| `SAT>=D-50@12:00` | `2026-08-29T10:00:00Z` |
| `N-6min` | `2026-10-15T07:54:00Z` |
| `M-9` / `M-1` | `"2026-01"` / `"2026-09"` |

### 2.3 Kalender bei kanonischem `N` (nur verwendete Tage)

| Ausdruck | Tag | Ausdruck | Tag | Ausdruck | Tag |
|---|---|---|---|---|---|
| D-111 | Fr 26.06. | D-36 | Mi 09.09. | D-10 | Mo 05.10. |
| D-109 | So 28.06. | D-35 | Do 10.09. | D-9 | Di 06.10. |
| D-94 | Mo 13.07. | D-33 | Sa 12.09. | D-8 | Mi 07.10. |
| D-91 | Do 16.07. | D-32 | So 13.09. | D-7 | Do 08.10. |
| D-84 | Do 23.07. | D-30 | Di 15.09. | D-6 | Fr 09.10. |
| D-73 | Mo 03.08. | D-29 | Mi 16.09. | D-5 | Sa 10.10. |
| D-60 | So 16.08. | D-28 | Do 17.09. | D-4 | So 11.10. |
| D-55 | Fr 21.08. | D-27 | Fr 18.09. | D-3 | Mo 12.10. |
| D-50 | Mi 26.08. | D-26 | Sa 19.09. | D-2 | Di 13.10. |
| D-49 | Do 27.08. | D-25 | So 20.09. | D-1 | Mi 14.10. |
| D-47 | Sa 29.08. | D-24 | Mo 21.09. | D+0 | **Do 15.10.** |
| D-46 | So 30.08. | D-22 | Mi 23.09. | D+1 | Fr 16.10. |
| D-45 | Mo 31.08. | D-21 | Do 24.09. | D+3 | So 18.10. |
| D-43 | Mi 02.09. | D-20 | Fr 25.09. | D+4 | Mo 19.10. |
| D-41 | Fr 04.09. | D-19 | Sa 26.09. | D+5 | Di 20.10. |
| D-40 | Sa 05.09. | D-18 | So 27.09. | D+6 | Mi 21.10. |
| D-38 | Mo 07.09. | D-16 | Di 29.09. | D+10 | So 25.10. (Winterzeit) |
| D-37 | Di 08.09. | D-14 | Do 01.10. | D+13 | Mi 28.10. |
| – | – | D-13 | Fr 02.10. | D+26 | Di 10.11. |
| – | – | D-12 | Sa 03.10. (Feiertag) | D+29 | Fr 13.11. |
| – | – | D-11 | So 04.10. | D+31 | So 15.11. |
| – | – | – | – | SAT>=D-50 | Sa 29.08. |
| – | – | – | – | SAT>=D+56 | **Sa 12.12.** |
| – | – | – | – | M-9 … M-1 | 2026-01 … 2026-09 |

Die Instagram-Beiträge liegen bei kanonischem `N` genau auf ihrem Manifest-Datum (z. B. `DdUPhoZOoMW` = D-30).

### 2.4 Werte

- Geld: Ganzzahl in Cent (`priceCents: 4500`). Anzeige macht der Code.
- Maße: cm, max. 1 Nachkommastelle; Gewicht: Gramm ohne Verpackung.
- Lokalisierte Felder: `{ "de": "…", "en": "…" }`; fehlendes `en` = Schlüssel weglassen (nicht `""`).
- Ausschnitte: `crop: { x, y, w, h }` in **Prozent** der Quelle (Ursprung oben links). Pixel =
  `round(pct / 100 × Kantenlänge)` der **tatsächlichen** Quelle, auf das Bild begrenzt – dieselben Prozentwerte gelten
  auch für höher aufgelöste Bilder aus dem Instagram-Export. Der Seed schneidet mit sharp **vor** dem Upload aus
  (`sharp(file).extract(...)`); das hochgeladene Original ist bereits der Ausschnitt.
- Fokuspunkt: `focal: { x, y }` in Prozent → `focalX`/`focalY`.
- Rich Text (FAQ-Antworten, `richText`-Blöcke, Aftercare-Phasen): Datei enthält Klartext; Helfer `toLexical(text)`
  macht aus Leerzeilen Absätze, aus Zeilen mit `- ` Listen, aus `**…**` fett und aus `[Text](url)` Links.
- Text-Token: `{{date:<expr>}}` → Datum der Feldsprache (DE `dd.MM.yyyy`, EN `d MMM yyyy`).

### 2.5 Nummern und IDs

| Objekt | Format | Beispiel |
|---|---|---|
| `products.itemNumber` | `900 + n` für `S{n}` (901–930); E2E-Fixtures 980–999; 901–999 für Jutta gesperrt, solange Beispieldaten existieren (DATENMODELL §13.3) | S07 → 907 (Anzeige „Nr. 907“) |
| `products.slug` | automatisch (`<Nr>-<slugify(title)>`) | `907-teller-hasen-reigen` |
| `flash.number` | 901–910 | Anzeige `F-901` … `F-910` (KONZEPT §9.3) |
| `orders.orderNumber` | `PC-2026-900NN`, NN = Schlüssel `O01`…`O14` | O07 → `PC-2026-90007` |
| `checkouts.reservationRef` = `reservations.ref` | Kasse der Bestellung ONN: `00000000-0000-4000-8000-0000000900NN`; `KS1`/`KS2`: `…-000000090101`/`…-000000090102` | O07 → `…-000000090007` |
| `orders.items[].id` | `<Order>-L<n>` | `O05-L2` |
| `withdrawals.reference` | `WR-2026-9000N` | W3 → `WR-2026-90003` |
| `inquiries.reference` | `AA-2026-900N` | A2 → `AA-2026-9002` |
| `privacy-requests.reference` | `DS-2026-900N` | DS3 → `DS-2026-9003` |
| Belegnummern | aus Zähler, eigener Nummernkreis `BSP-RE`/`BSP-GS` (Enum `INVOICE_SERIES`) | `BSP-RE-2026-00004` |
| Stripe-IDs (Mock) | `cs_seed_900NN` (Kassen ohne Bestellung `cs_seed_ks1`, `cs_seed_ks2`), `pi_seed_900NN`, `ch_seed_900NN`, `re_seed_900NN_<k>`, `dp_seed_900NN` | `re_seed_90005_1` |
| DHL-Sendungsnummer | `SEEDDHL` + `90000000000` + NN (13 Ziffern) | `SEEDDHL9000000000010` |
| Deutsche-Post-Nummer | `SEEDDP` + 9 Ziffern + `DE` | `SEEDDP000000003DE` |
| Rücksende-Nummer | `SEEDRET` + `90000000000` + NN | `SEEDRET9000000000001` |
| Kassen-/Danke- und Status-Token | nur für `seed = true` deterministisch aus dem `seedKey` (DATENMODELL §6.8.2): `seedToken(seedKey: string, purpose: 'checkout' \| 'status'): string` = `base64url(SHA-256("pc-seed-token:v1:" + purpose + ":" + seedKey))`, 43 Zeichen; `purpose = 'checkout'` für Kassen (Danke-Link, gespeichert als `checkouts.tokenHash`), `purpose = 'status'` für Bestellungen (`orders.statusTokenHash`). Eingabe ist immer der `seedKey` (z. B. `orders:O10`, `checkouts:O14`), **nie** die `orderNumber`; **nie** aus `PAYLOAD_SECRET` oder einem anderen Schlüssel abgeleitet (ARCHITEKTUR §8.6). Gespeichert wird nur der SHA-256-Hash (hex) wie bei echten Token. Echte Token bleiben zufällig | `seedToken('orders:O10', 'status')`, `seedToken('checkouts:O14', 'checkout')` in `src/lib/seed/tokens.ts` (für Vorschau und e2e) |
| `email-log.messageId` | `<seed.<seedKey ohne Sonderzeichen>@planetclairetattoos.invalid>` | – |

Alle Tracking-Nummern erfüllen `^[A-Z0-9]{8,35}$`. `stripe.livemode = false` überall.

### 2.6 Beispiel-Datensätze (Form der JSON-Dateien)

```json
{
  "key": "S11",
  "itemNumber": 911,
  "category": "textil",
  "title": { "de": "T-Shirt „Coco fliegt zum Mond“", "en": "T-shirt “Coco Flies to the Moon”" },
  "description": { "de": "…", "en": "…" },
  "priceCents": 6400,
  "materials": { "de": "Second-Hand-T-Shirt, bemalt mit Textilfarbe", "en": "Second-hand T-shirt, painted with fabric paint" },
  "dimensions": { "note": { "de": "Brustweite 56 cm, Länge 74 cm", "en": "Chest width 56 cm, length 74 cm" } },
  "weightGrams": 200,
  "shippingClass": "paket_klein",
  "sizeLabel": { "de": "L", "en": "L" },
  "isSecondHand": true,
  "condition": "good",
  "fiberComposition": [
    { "component": "main", "fiber": "cotton", "percent": 60 },
    { "component": "main", "fiber": "polyester", "percent": 40 }
  ],
  "hasDeviation": true,
  "deviationDescription": { "de": "…", "en": "…" },
  "ownDesignConfirmed": true,
  "images": ["media:ph:shirt-02"],
  "state": { "status": "available", "firstPublishedAt": "D-16@18:00", "showInArchiveAfterSale": true },
  "storageLocation": "Stange T",
  "enStatus": "reviewed"
}
```

```json
{
  "key": "O10",
  "orderNumber": "PC-2026-90010",
  "status": "shipped",
  "locale": "de",
  "customer": "C10",
  "fulfillmentMethod": "shipping",
  "items": [{ "product": "S02" }],
  "payment": { "method": "paypal", "provider": "mock", "methodType": "paypal", "feeCents": 231 },
  "carrierEmailConsent": true,
  "timeline": { "placedAt": "D-3@18:25", "paidAt": "D-3@18:26", "packedAt": "D-2@10:10", "shippedAt": "D-2@16:00" },
  "shipment": { "carrier": "dhl", "trackingNumber": "SEEDDHL9000000000010" },
  "packaging": { "templateKey": "keramik-doppelkarton" },
  "checkout": "checkouts:O10"
}
```

Snapshot-Felder (`items[].titleDe`, `characteristicsDe/En`, `priceCents`, `coverImageUrl`, Summen, `shippingClass`,
`shippingZone`, `taxModeAtOrder`, `legalTextVersions`, `packaging.templateName`/`components`) berechnet der Seed mit
denselben Funktionen wie Kasse und Verwaltung (`buildCharacteristics()`, Verpackungsvorlage aus `settings.packaging`
usw.), nicht aus der Datei.

---

## 3. Grund-Seed (`pnpm seed:base`, `seed = false`)

### 3.1 `settings`

Nur leere Felder werden gefüllt (§1.3); Ausnahme U-46 (P13.7): die früheren Platzhalter `[Name folgt]`, `[Adresse folgt]`
und PLZ `00000` gelten als leer und werden durch Juttas Anschrift ersetzt (`LEGACY_SETTINGS_PLACEHOLDERS` in
`src/lib/seed/globals.ts`). Alle nicht genannten Felder: Default aus DATENMODELL §7.1.

| Feld | Wert |
|---|---|
| `business.legalName` | `Jutta Dollmann` (U-46) |
| `business.tradeName` | `Planet Claire` |
| `business.street` | `Anklamer Straße 28` (U-46) |
| `business.postalCode` / `business.city` / `business.country` | `10115` / `Berlin` / `DE` (U-46) |
| `business.email` | `jutta@planetclairetattoos.com` |
| `business.phone` | `[Telefon folgt]` |
| `business.economicId` | `[W-IdNr. folgt]` |
| `business.taxNumber`, `business.vatId` | leer (ohne Steuernummer entstehen nur Seed-Belege) |
| `tax.modes` | `[{ "mode": "kleinunternehmer", "validFrom": "2026-01-01" }]` |
| `shipping.enabledCountries` | `["DE"]` |
| `shipping.rates` (DE, E-25) | `brief` 450 · `paket_klein` 650 · `keramik` 890; EU/CH ohne Tarife (E-24: Start nur Deutschland; Zonen vorbereitet, leer, DATENMODELL §7.1, DM-12) |
| `shipping.pickupEnabled` / `pickupCity` | `true` / `Berlin` |
| `shipping.deliveryTimeText` | DE `2–5 Werktage` · EN `2–5 working days` |
| `shipping.trackingUrlTemplates` | Default aus DATENMODELL §7.1 (DM-12): je eine Vorlage für `dhl` und `deutsche_post` (beide die DHL-Sendungsverfolgung mit `{trackingNumber}`) |
| `packaging.templates` / `packaging.defaultsByShippingClass` (E-47) | Default aus DATENMODELL §7.1: `brief-karton` (paper_cardboard 60 g) · `tasche-papier` (paper_cardboard 90 g) · `keramik-doppelkarton` (paper_cardboard 900 g); brief → `brief-karton`, paket_klein → `tasche-papier`, keramik → `keramik-doppelkarton` (Schätzwerte, KA-29) |
| `pickup.instructions` | DE „Abholung in Berlin nach Absprache: Wir machen per Mail einen Termin aus, die Adresse bekommst du mit der Terminbestätigung. Bring bitte deine Bestellnummer mit.“ · EN “Pickup in Berlin by arrangement: we'll set a time by email, and you'll get the address with the confirmation. Please bring your order number.” |
| `payment.prepaymentEnabled` | `true` |
| `payment.accountHolder` | `[Kontoinhaberin folgt]` |
| `payment.iban` | `DE36000000000000000000` (Anzeige `DE36 0000 0000 0000 0000 00`; Prüfziffer gültig, BLZ 00000000 existiert nicht; die Go-live-Sperre DATENMODELL §13.7 meldet genau diesen Wert als Platzhalter) |
| `payment.reservationMinutes` / `prepaymentDays` / `prepaymentReminderHours` | 30 / 5 / 72 (Erinnerung `placedAt` + 72 h; Zahlungsfrist 23:59:59 Berlin am 5. Kalendertag nach dem Bestelltag, §7.2) |
| `tattoo.studioDistrict` | `[Bezirk folgt]` (KA-13) |
| `tattoo.minPriceCents` | 8000 |
| `tattoo.customPriceFromCents` / `customPriceToCents` | 15000 / 40000 |
| `tattoo.priceNote` | DE „Alle Preise sind Endpreise. Flash hat einen Festpreis direkt am Motiv, eigene Ideen rechne ich nach Größe und Aufwand.“ · EN “All prices are final prices. Flash has a fixed price right on the design; custom ideas are priced by size and effort.” |
| `social.instagramHandle` / `social.contactEmail` | `planet.claire.tattoos` / `jutta@planetclairetattoos.com` |
| `packingChecklists` | §3.2 |
| `safetyTemplates`, `careTemplates` | §3.2 |

### 3.2 Vorlagen

**`safetyTemplates`** (genau 1 je Kategorie; RECHT darf ändern):

| Kategorie | DE | EN |
|---|---|---|
| keramik | Handgemacht: Kanten und Glasur können unregelmäßig sein. Zerbrechlich – Scherben bei Bruch vorsichtig entfernen. | Handmade: edges and glaze may be irregular. Fragile – remove shards carefully if it breaks. |
| textil | Gebrauchtes Kleidungsstück, von Hand bemalt. Farbe kann bei der ersten Wäsche leicht ausbluten – separat waschen. | Pre-owned garment, painted by hand. Colour may bleed slightly in the first wash – wash separately. |
| cap | Gebrauchte Cap, von Hand bemalt. Farbe kann bei Nässe abfärben. | Pre-owned cap, painted by hand. Colour may transfer when wet. |
| zeichnung | Original auf Papier. Vor direktem Sonnenlicht und Feuchtigkeit schützen. | Original on paper. Keep away from direct sunlight and moisture. |
| schmuck | Keramik kann bei Stößen brechen. Nicht beim Schlafen oder beim Sport tragen. | Ceramic can break if knocked. Do not wear while sleeping or doing sport. |
| sonstiges | Handgemachtes Einzelstück – bitte die Hinweise in der Beschreibung beachten. | Handmade one-off – please note the details in the description. |

Der Kleinteile-Hinweis für Schmuck kommt über `smallPartsWarning = true` (Baustein `product.jewelrySmallParts`), der
Deko-Hinweis für Keramik („Dekorationsobjekt – nicht für Lebensmittel geeignet“) über `foodContact = deko` (Baustein
`product.ceramicsDecorative`, R-044, KONZEPT §7.4). Beide stehen deshalb nicht in der Vorlage (keine Doppelung).

**`careTemplates`:** textil DE „Links gewendet bei 30 °C waschen, nicht in den Trockner, Motiv nicht bügeln.“ · EN
“Wash inside out at 30 °C, do not tumble dry, do not iron over the design.” — cap DE „Nicht in die Waschmaschine.
Flecken mit einem feuchten Tuch vorsichtig abtupfen, an der Luft trocknen.“ · EN “Do not machine wash. Gently dab
stains with a damp cloth and let it air dry.”

**`packingChecklists`** (nur DE, KONZEPT §7.6):

| `shippingClass` | Punkte |
|---|---|
| keramik | Hohlräume mit Papier füllen · jedes Teil einzeln einwickeln · Innenkarton · Außenkarton mit mind. 6 cm Polster rundum · Schütteltest · zwei Fotos vor dem Zukleben |
| paket_klein | Papier- oder Kartonversandtasche, niemals Plastik · Zeichnungen zwischen zwei feste Kartonplatten · zwei Fotos vor dem Zukleben |
| brief | Zeichnung zwischen zwei Kartonplatten, „Bitte nicht knicken“ · Anhänger in Seidenpapier und kleine Schachtel · zwei Fotos vor dem Zukleben |

### 3.3 `categories` (6 Dokumente)

`key`, `name`, `slug`, `sortOrder`, `showInNavigation` laut DATENMODELL §6.5. `coverImage` bleibt leer (Grund-Seed darf
nicht auf Seed-Medien zeigen). `intro`:

| key | DE | EN |
|---|---|---|
| keramik | Alles hier ist von Hand geformt und bemalt – mit Tieren, die zurückgucken. Jede Keramik ist ein Deko-Stück: schön für Schlüssel, Ringe und Kleinkram, nicht für Essen. | Everything here is shaped and painted by hand – with animals that look back at you. Every ceramic piece is decorative: great for keys, rings and odds and ends, not for food. |
| textil | Second-Hand-Teile, die ich bemale. Größe, Zustand und Material stehen bei jedem Stück – bitte kurz nachmessen, jedes gibt es nur einmal. | Second-hand pieces that I paint. Size, condition and fabric are listed for each one – please measure, every piece exists only once. |
| cap | Gebrauchte Caps mit neuen Bewohnern. Ob verstellbar oder feste Größe, steht bei jeder Cap dabei. | Pre-loved caps with new residents. Whether adjustable or a fixed size is listed on each cap. |
| zeichnung | Originale auf Papier: Tusche, Aquarell, Skizzenbuchseiten. Keine Drucke – was du siehst, ist genau das Blatt, das du bekommst. | Originals on paper: ink, watercolour, sketchbook pages. No prints – what you see is exactly the sheet you get. |
| schmuck | Winzige Anhänger aus Keramik mit Öse aus Edelstahl. Die Kette ist nicht dabei – du hast bestimmt schon eine Lieblingskette. | Tiny ceramic pendants with a stainless steel loop. Chain not included – you've probably got a favourite one already. |
| sonstiges | Was nirgends reinpasst: Flohmarktfunde, die ich bemalt habe. | Things that don't fit anywhere else: flea market finds I've painted. |

### 3.4 `legal-texts` (6 Platzhalter)

Grund-Seed (`seed = false`), nicht Beispielbestand: Die Platzhalter bleiben beim Entfernen der Beispieldaten erhalten,
bis Kanzleitexte aktiviert sind (R-002, DATENMODELL §13.1). **Stand P12.11 (UEBERARBEITUNG U-22):** Die Seed-Datei enthält
die Texte vollständig ausformuliert (DE verbindlich, EN gleichwertig; `intro`/`introEn`, `sections`/`sectionsEn` je Typ);
sie bleiben `origin = placeholder`, bis die Kanzlei sie in P11 ersetzt. Die Tabelle unten beschreibt den früheren Stand
(nur Gliederung); abweichend gilt: `content.de` und `content.en` sind gefüllt, `sourceNote` lautet
„Platzhalter-Fassung (ausformuliert in P12.11, Kanzlei-Prüfung offen)“. Bestehende Datenbanken mit der alten Gliederung
bekommen beim nächsten `seed:base` automatisch eine neue aktive Fassung (v2).

| Feld | Wert |
|---|---|
| `type` | je einer von `LEGAL_TEXT_TYPES` |
| `version` / `status` / `origin` / `source` | 1 / `active` / `placeholder` / `manual` (`isPlaceholder = true` folgt aus `origin`) |
| `validFrom` | `2026-01-01T00:00:00+01:00` (fest, damit jede Seed-Bestellung auf v1 verweist) |
| `content.de` | Gliederung laut KANZLEI-BRIEFING §1 (Überschriften des jeweiligen Texts), unter jeder Überschrift nur der Satz „Text folgt von der Kanzlei.“ (R-002). Tokens nur aus der Liste in DATENMODELL §6.12 / KANZLEI-BRIEFING §16.3: beim Impressum `{{name}}`, `{{street}}`, `{{postalCode}} {{city}}`, `{{email}}`, `{{phone}}`; bei der Widerrufsbelehrung `{{withdrawalUrl}}`; bei Versand & Zahlung `{{shippingTable}}`, `{{deliveryTime}}`, `{{vorkasseDays}}`. Das Band „PLATZHALTER – nicht rechtsverbindlich“ rendert die Seite (`PlaceholderBanner`), es steht nicht im Inhalt |
| `content.en` | leer – EN-Seiten zeigen den DE-Text mit dem Hinweis „Only available in German“ (R-015) |
| `sourceNote` | `Platzhalter aus dem Grund-Seed` |

### 3.5 Admin und `site-texts`

- Admin nur außerhalb von Produktion (ARCHITEKTUR §8.4), nur wenn `users` leer ist und `SEED_ADMIN_EMAIL`/
  `SEED_ADMIN_PASSWORD` gesetzt sind (nie ein echtes Passwort).
- `site-texts`: Defaults aus dem Code (P1); diese Datei legt sie nicht fest. Consent-Texte kommen aus den
  RECHT-Bausteinen (§16.2).

---

## 4. Medien

### 4.1 Instagram-Ausschnitte (`source = instagram_seed`)

Regeln: nur Beiträge aus dem Manifest; Highlights (Coco) **nie** importieren, nur Zeichenvorlage für Coco (P9).
`profil.jpg` zeigt Jutta: **nie** importieren und ohne ihre Freigabe auch nicht als Zeichenvorlage verwenden (Manifest
„nur nach Freigabe“, DESIGN §12.4, R-181). `post-DdHXUQsDjqm.jpg` **nur** als gesichtsfreier Ausschnitt für das
Produktbild (das ungeschnittene Foto zeigt Jutta; SE-02). Kund:innen-Tattoofotos (Manifest `consentRequired: true`)
nur als eingeschränkte Galerie-Medien für G1/G2 (§12.3, SE-03). `sourceRef` =
Kürzel (+ `#Ausschnitt`). Quellmaße: 480×640, außer `DaDz8yljp3i` 640×640 und `DdUPhoZOoMW` 360×640. Maßgeblich sind
die Prozentwerte (§2.4); die Ausschnitt-Pixel (links, oben, Breite, Höhe) gelten nur für diese 640-px-Quellen und
stehen zur Kontrolle da. Bei Bildern aus dem Instagram-Export rechnen Seed und Prüfung die Pixel aus den tatsächlichen
Quellmaßen.

| seedKey | Datei | crop % (x, y, w, h) | px | `showsPerson` | Verwendet von |
|---|---|---|---|---|---|
| `ig:DdUPhoZOoMW#a` | post-DdUPhoZOoMW.jpg | 46, 21.5, 54, 38 | 166, 138, 194, 243 | none | S01 |
| `ig:DdUPhoZOoMW#b` | post-DdUPhoZOoMW.jpg | 0, 35.5, 53, 37.3 | 0, 227, 191, 239 | none | S02 |
| `ig:DdUPhoZOoMW#c` | post-DdUPhoZOoMW.jpg | 28, 49.375, 72, 50.625 | 101, 316, 259, 324 | none | S03 (Ränder der Nachbarschalen oben sichtbar – akzeptiert) |
| `ig:DdUPhoZOoMW` | post-DdUPhoZOoMW.jpg | ganz, focal 55, 55 | 360×640 | none | S01–S03 (2. Bild), about, commissions |
| `ig:DcrENrOjlGP#a` | post-DcrENrOjlGP.jpg | 10, 36, 45, 42.1875 | 48, 230, 216, 270 | none | S04 |
| `ig:DcrENrOjlGP#b` | post-DcrENrOjlGP.jpg | 37.1, 49, 52.1, 48.8 | 178, 314, 250, 312 | none | S05 |
| `ig:DcrENrOjlGP` | post-DcrENrOjlGP.jpg | 0, 3.125, 100, 93.75 | 0, 20, 480, 600 | none (nur Hand/Arm am Rand) | S04, S05 (2. Bild) |
| `ig:Dav1kUkDgR7` | post-Dav1kUkDgR7.jpg | 0, 3.125, 100, 93.75 | 0, 20, 480, 600 | none (nur Hand) | S06 |
| `ig:DcT7ErBDsWi` | post-DcT7ErBDsWi.jpg | 0, 3.125, 100, 93.75 | 0, 20, 480, 600 | none | S15, commissions |
| `ig:DdHXUQsDjqm#cap` | post-DdHXUQsDjqm.jpg | 16, 0, 68, 45; focal 50, 55 | 77, 0, 326, 288 | **none** (kein Gesicht im Ausschnitt) | S16 |
| `ig:DaDz8yljp3i` | post-DaDz8yljp3i.jpg | 12.5, 3.125, 75, 93.75 | 80, 20, 480, 600 | none | S19, commissions |
| `ig:DaJH_kADpsK` | post-DaJH_kADpsK.jpg | 0, 3.125, 100, 93.75 | 0, 20, 480, 600 | none | S20 |
| `ig:DbJ1QRrjCcb` | post-DbJ1QRrjCcb.jpg | 0, 3.125, 100, 93.75 | 0, 20, 480, 600 | none | S21, Flash F-901 |
| `ig:DblvrTRiUqi` | post-DblvrTRiUqi.jpg | 0, 3.125, 100, 93.75 | 0, 20, 480, 600 | none | S22 |
| `ig:Da2WrEgDpC_#pendant` | post-Da2WrEgDpC_.jpg | 10, 25, 80, 75 | 48, 160, 384, 480 | none (Größen-Beschriftung liegt außerhalb) | S26, commissions |
| `ig:DOZTG7PjLAD` | post-DOZTG7PjLAD.jpg | 0, 3.125, 100, 93.75 | 0, 20, 480, 600 | **customer** (Manifest `consentRequired: true`) → `restricted = true` | G1 |
| `ig:DZqBCSZDDiE` | post-DZqBCSZDDiE.jpg | 0, 3.125, 100, 93.75 | 0, 20, 480, 600 | **customer** (Manifest `consentRequired: true`) → `restricted = true` | G2 |

Alt-Texte (`alt` Pflicht DE, für Produktbilder auch EN):

| seedKey | DE | EN |
|---|---|---|
| `ig:DdUPhoZOoMW#a` | Weiße Keramikschale von oben, innen schwarz bemalt: ein langohriger Hase und ein zotteliger Hund mit Kulleraugen | White ceramic bowl from above, painted inside in black: a long-eared bunny and a shaggy dog with googly eyes |
| `ig:DdUPhoZOoMW#b` | Weiße Keramikschale von oben mit zwei gemalten Hunden, einer hell mit Schlappohren, einer schwarz | White ceramic bowl from above with two painted dogs, one light with floppy ears, one black |
| `ig:DdUPhoZOoMW#c` | Weiße Keramikschale von oben: heller Hund mit Kulleraugen und ein schwarzer Hase mit langen Ohren | White ceramic bowl from above: a light dog with googly eyes and a black bunny with long ears |
| `ig:DdUPhoZOoMW` | Drei weiße Keramikschalen mit Tuschetieren auf grüner Schneidematte | Three white ceramic bowls with ink-drawn animals on a green cutting mat |
| `ig:DcrENrOjlGP#a` | Rundes Keramikschälchen mit gemaltem Schmetterling und handgeschriebener Textzeile, Rand mit Punkten | Round ceramic dish with a painted butterfly and a handwritten line of text, dotted rim |
| `ig:DcrENrOjlGP#b` | Flaches Keramikschälchen mit Lasche zum Aufhängen, darauf ein zart gefärbter Schmetterling und handgeschriebene Worte | Flat ceramic dish with a hanging tab, showing a softly coloured butterfly and handwritten words |
| `ig:DcrENrOjlGP` | Zwei Schmetterlings-Schälchen auf grünem Untergrund, dahinter das Skizzenbuch mit der Vorzeichnung | Two butterfly dishes on a green surface, with the sketchbook drawing behind them |
| `ig:Dav1kUkDgR7` | Bemalte Keramikfliese in Schutzhülle: Figur im dunklen Anzug auf einer Bühne, handgeschriebene Worte, dahinter ein Flohmarktstand | Painted ceramic tile in a sleeve: a figure in a dark suit on stage, handwritten words, a flea market stall behind |
| `ig:DcT7ErBDsWi` | Pinke Baseballcap, bemalt mit rotem Fabelwesen, schwarzen Ranken und dem Wort „sometimes“ auf dem Schirm | Pink baseball cap painted with a red creature, black vines and the word “sometimes” on the brim |
| `ig:DdHXUQsDjqm#cap` | Grau gewaschene Cap von vorn, bemalt mit einem schwarzen Wesen in bunten Flammen | Washed grey cap from the front, painted with a black creature in colourful flames |
| `ig:DaDz8yljp3i` | Aquarell eines orangefarbenen Fuchses mit großen Augen und Schnurrhaaren vor grün-pinkem Hintergrund | Watercolour of an orange fox with big eyes and whiskers on a green and pink background |
| `ig:DaJH_kADpsK` | Tuschezeichnung: Figur im karierten Kleid mit tätowierten Beinen, daneben eine kopfüber hängende Figur mit langen Haaren | Ink drawing: a figure in a checked dress with tattooed legs, next to a long-haired figure hanging upside down |
| `ig:DbJ1QRrjCcb` | Tuschezeichnung eines Kelchs, aus dem sich eine Schlange windet, auf weißem Papier | Ink drawing of a chalice with a snake winding out of it, on white paper |
| `ig:DblvrTRiUqi` | Aquarell eines Rehkitzes mit großen Ohren und hellen Tupfen vor grünem Hintergrund, im Skizzenbuch | Watercolour of a fawn with big ears and pale spots on a green background, in a sketchbook |
| `ig:Da2WrEgDpC_#pendant` | Winziger Fuchs-Anhänger aus Keramik, orange-weiß glasiert, mit Metallöse auf grüner Schneidematte | Tiny ceramic fox pendant, glazed orange and white, with a metal loop on a green cutting mat |
| `ig:DOZTG7PjLAD` | Verheiltes Fine-Line-Tattoo am Unterarm: Comicfigur mit Schiebermütze und langer Nase | Healed fine line tattoo on a forearm: cartoon figure with a flat cap and a long nose |
| `ig:DZqBCSZDDiE` | Frisches Blackwork-Tattoo an der Wade: großes Monster mit Hasen, dahinter der Berliner Fernsehturm | Fresh blackwork tattoo on a calf: a big monster with bunnies, the Berlin TV tower behind |

Hinweise: Die Ausschnitte sind klein (ab 191 px Breite); `detail`/`zoom` werden nicht hochskaliert. Bessere Auflösung
kommt aus dem Instagram-Export (P8, gleiche `seedKey`s, `--refresh-media`, dieselben Prozent-Ausschnitte).

### 4.2 Platzhalter (`source = placeholder`)

DESIGN §12.3: SVG `viewBox="0 0 400 500"`, Strich 2.4 `--ink`, runde Enden, Wackel, offene Enden, höchstens **eine**
Wash-Fläche (3–4 Einheiten versetzt), Motiv 55–70 % der Bildhöhe, ±3° schief, **kein Text**, keine fremden Figuren,
≤ 6 KB, gerastert als WebP 800×1000. Datei `src/art/placeholders/{typ}-{n}.svg`, KUNST-QA-ID `ART-PH-{typ}-{n}`.
Alt DE „Platzhalter-Zeichnung: {Objekt}“, EN “Placeholder drawing: {object}”. Flash-Platzhalter ohne Wash (Grund
`--paper-2`, Stencil-Anmutung).

| seedKey | Wash | Motiv-Brief | Objekt DE / EN (für Alt) | Verwendet von |
|---|---|---|---|---|
| `ph:teller-01` | `--wash-clay` | Runder Teller schräg von oben (Ellipse), am Rand drei kleine Hasen mit Kulleraugen hintereinander im Kreis, in der Mitte ein kleiner Planet mit Ring | Teller mit fünf Hasen im Kreis / plate with five bunnies in a circle | S07 |
| `ph:teller-02` | `--wash-sky` | Kleiner Teller, ein Fuchs mit Kulleraugen liegt eingerollt in einer Mondsichel, drei 4-zackige Sterne | kleiner Teller mit Fuchs auf dem Mond / small plate with a fox on the moon | S08 |
| `ph:fliese-01` | `--wash-mat` | Quadratische Fliese, leicht schräg; stehendes Reh mit Tupfen, von oben fallen 6–8 kleine Planeten wie Tropfen | Fliese mit Reh im Planetenregen / tile with a deer in planet rain | S09 |
| `ph:shirt-01` | `--wash-sky` | T-Shirt flach liegend, auf der Brust zwei Hasen im Gleichschritt | T-Shirt mit zwei marschierenden Hasen / T-shirt with two marching bunnies | S10 |
| `ph:shirt-02` | `--wash-clay` | T-Shirt, Coco mit rundem Helm auf einer kleinen Rakete Richtung Mondsichel; an der linken Seitennaht ein gestopfter Fleck aus Kreuzstichen | T-Shirt mit Coco auf einer Rakete / T-shirt with Coco on a rocket | S11 |
| `ph:shirt-03` | `--wash-pink` | Ringer-Shirt (Bündchen an Hals und Ärmeln als Doppelkontur), Fuchskopf mit Kulleraugen und Schnurrhaaren auf der Brust | Ringer-Shirt mit Fuchs / ringer tee with a fox | S12 |
| `ph:kleid-01` | `--wash-mat` | Ärmelloses Sommerkleid auf einem Bügel, am Saum eine Bordüre aus Hasenköpfen im Wechsel mit Tupfen | Kleid mit Hasen-Bordüre / dress with a bunny border | S13 |
| `ph:kleid-02` | `--wash-sky` | Langärmliges Kleid auf einem Bügel, verstreute Planeten und Sterne; am Saum hinten eine kleine Fläche ohne Muster | Kleid mit Planeten und Sternen / dress with planets and stars | S14 |
| `ph:cap-01` | `--wash-clay` | Cap von vorn, darauf Cocos Kopf mit großen Ohren und dunklen Augen mit Glanzpunkt | Cap mit Coco-Kopf / cap with Coco's head | S17 |
| `ph:cap-02` | `--wash-pink` | Cap von der Seite, kleiner Planet mit Ring und zwei Sterne | Cap mit kleinem Planeten / cap with a little planet | S18 |
| `ph:zeichnung-01` | `--wash-sky` | Blatt mit Klebeband-Ecken; Coco sitzt auf einer Mondsichel und lässt die Beine baumeln | Zeichnung: Coco auf dem Mond / drawing: Coco on the moon | S23 |
| `ph:zeichnung-02` | `--wash-pink` | Blatt; vierbeiniges Wesen mit Flammenmähne im Sprung (eigene Figur, verwandt mit der grauen Cap) | Zeichnung: Flammenwesen / drawing: flame creature | S24 |
| `ph:zeichnung-03` | `--wash-mat` | Skizzenblatt A5; drei Hasen stehen im Halbkreis und beraten | Skizze: drei Hasen im Halbkreis / – (EN absichtlich leer, Test S25) | S25 |
| `ph:anhaenger-01` | `--wash-pink` | Anhänger: Cocos Kopf mit einem Planetenring drumherum, Öse oben, ohne Kette | Anhänger Coco mit Planetenring / pendant Coco with a planet ring | S27 |
| `ph:anhaenger-02` | `--wash-sky` | Mini-Planet mit Ring, Öse oben; daneben ein Streichholz als Größenvergleich | Mini-Planet-Anhänger / mini planet pendant | S28 |
| `ph:anhaenger-03` | `--wash-clay` | Rehköpfchen mit großen Ohren und drei Tupfen auf der Stirn, Öse oben | Anhänger Rehköpfchen / little deer head pendant | S29 |
| `ph:spiegel-01` | `--wash-mat` | Rechteckiger Spiegel im Holzrahmen, drei diagonale Glanzstriche, oben gucken zwei Hasen über die Rahmenkante | Spiegel mit Hasen am Rahmen / mirror with bunnies on the frame | S30 |
| `ph:flash-902` | – | Drei Hasen sitzen eng nebeneinander, der mittlere etwas größer, alle mit Kulleraugen | Flash-Motiv Hasen-Trio / flash design bunny trio | F902 |
| `ph:flash-903` | – | Sitzender Fuchs von vorn, Schwanz um die Pfoten gelegt, Kulleraugen, drei Schnurrhaare je Seite | Flash-Motiv Fuchs mit Kulleraugen / flash design googly-eyed fox | F903 |
| `ph:flash-904` | – | Schmetterling von oben, Flügel mit 6–8 Tupfen, Fühler mit Punkten | Flash-Motiv Schmetterling mit Tupfen / flash design spotted butterfly | F904 |
| `ph:flash-905` | – | Schnecke mit Kulleraugen auf Stielen, das Haus ist ein Planet mit Ring | Flash-Motiv Schnecke mit Planetenhaus / flash design snail with a planet shell | F905 |
| `ph:flash-906` | – | Coco sitzend, Kopf leicht schief, große Ohren | Flash-Motiv Coco sitzt / flash design Coco sitting | F906 |
| `ph:flash-907` | – | Planet mit Ring und ein kleiner 4-zackiger Stern | Flash-Motiv winziger Planet / flash design tiny planet | F907 |
| `ph:flash-908` | – | Stehendes Reh im Profil, Tupfen auf dem Rücken, Kopf zur Betrachterin gedreht | Flash-Motiv Reh mit Tupfen / flash design spotted deer | F908 |
| `ph:flash-909` | – | Wesen mit Flammenmähne im Sprung, Flammen als offene Striche | Flash-Motiv Flammenwesen / flash design flame creature | F909 |
| `ph:flash-910` | – | Herz mit zwei dünnen Beinen und kleinen Schuhen, läuft nach rechts | Flash-Motiv Herz mit Beinen / flash design heart with legs | F910 |
| `ph:tattoo-01` | `--wash-clay` | Umriss Knöchel/Fuß seitlich, darauf das Hasen-Trio (F-902), Linie etwas kräftiger (frisch) | frisches Tattoo Hasen-Trio am Knöchel / fresh bunny trio tattoo on an ankle | G3 |
| `ph:tattoo-02` | `--wash-clay` | Umriss Handgelenk, winziger Planet (F-907), feine Linie | verheiltes Tattoo winziger Planet am Handgelenk / healed tiny planet tattoo on a wrist | G4 |
| `ph:tattoo-03` | `--wash-clay` | Umriss Oberarm, Coco sitzt (F-906) | frisches Tattoo Coco am Oberarm / fresh Coco tattoo on an upper arm | G5 |
| `ph:tattoo-04` | `--wash-clay` | Umriss Schienbein, Herz mit Beinen (F-910) | verheiltes Tattoo Herz mit Beinen am Schienbein / healed heart-with-legs tattoo on a shin | G6 |

### 4.3 Ersatzzeichnung bis P8 (`src/lib/seed/fallbackArt.ts`)

Fehlt `src/art/placeholders/{typ}-{n}.svg`, erzeugt der Seed deterministisch ein SVG 400×500: Grund `--paper-2`
(`#…` aus den Design-Tokens), die Wash-Fläche aus der Tabelle als versetztes Rechteck, eine einfache Tusche-Form je
`typ` (Ellipse für `teller`, Quadrat für `fliese`, T-Form für `shirt`, Trapez für `kleid`, Kuppel + Schirm für `cap`,
Blatt mit Klebeband für `zeichnung`, Kreis + Öse für `anhaenger`, Rahmen für `spiegel`, Planet mit Ring für `flash`,
Körperumriss-Linie für `tattoo`). Kein Text. Gleicher Rasterpfad (sharp → WebP 800×1000) wie die echten Platzhalter.

### 4.4 Private Dateien (`private-uploads`, `seed = true`)

| seedKey | `purpose` | Inhalt (vom Seed erzeugt) | Bezug | Phase |
|---|---|---|---|---|
| `nickel-demo` | `nickel_evidence` | PDF, 1 Seite: „BEISPIELDOKUMENT – kein Nachweis. Platzhalter für die Lieferantenerklärung zu den Ösen (Edelstahl).“ | `nickelEvidence` von S26–S29; `complianceCategory = schmuck` | P1 |
| `glaze-demo` | `supplier_document` | PDF, 1 Seite: „BEISPIELDOKUMENT – kein Nachweis. Platzhalter für das Hersteller-Datenblatt der Glasur.“ | Beleg zu `leadFreeGlazeConfirmed` von S26–S29 (R-045); `complianceCategory = schmuck` | P1 |
| `O12:packing-1`, `O12:packing-2` | `packing_photo` | JPEG 1200×900: Linienzeichnung eines offenen Kartons mit Papierpolster bzw. des zugeklebten Kartons, Schriftzug „BEISPIEL-PACKFOTO 1/2“ bzw. „2/2“ | `orders.packingPhotos` von O12, `relatedOrder` O12 | P8 |
| `A2:sketch-1` | `commission_reference` | PNG 1000×1000: Linienskizze eines Tellers mit zwei Hasen, die sich an den Pfoten halten; keine Person, kein Text | `inquiries.referenceImages` von A2 | P8 |
| `RK1:photo-1` | `complaint_photo` | JPEG 1200×900: Linienzeichnung einer Schale mit Sprung am Rand in einem eingedrückten Karton, Schriftzug „BEISPIEL-REKLAMATIONSFOTO“ | `complaints.photos` von RK1, `relatedComplaint` RK1 | P8 |
| `RK2:photo-1` | `complaint_photo` | JPEG 1200×900: Linienzeichnung eines T-Shirts mit verblasster Stelle an der Schulter, Schriftzug „BEISPIEL-REKLAMATIONSFOTO“ | `complaints.photos` von RK2, `relatedComplaint` RK2 | P8 |
| `invoice-pdf:<Nummer>` | `invoice_pdf` / `credit_note_pdf` | Beleg-PDF mit Wasserzeichen „BEISPIELBELEG – kein echter Beleg“ | §9 | P8 (Renderer aus P4) |

---

## 5. Stücke (`products`, 30)

### 5.1 Übersicht

| Key | Nr. | Kategorie | Titel DE | Preis | Versandklasse | Status | Bilder (1. = Titelbild) |
|---|---|---|---|---|---|---|---|
| S01 | 901 | keramik | Schale „Langohr & Wuschel“ | 45,00 | keramik | available | ig:DdUPhoZOoMW#a, ig:DdUPhoZOoMW |
| S02 | 902 | keramik | Schale „Zwei Hunde“ | 48,00 | keramik | sold (O10) | ig:DdUPhoZOoMW#b, ig:DdUPhoZOoMW |
| S03 | 903 | keramik | Schale „Hund & schwarzer Hase“ | 45,00 | keramik | sold (O12) | ig:DdUPhoZOoMW#c, ig:DdUPhoZOoMW |
| S04 | 904 | keramik | Schmetterlings-Schälchen, rund | 38,00 | keramik | available (Rückläufer O05) | ig:DcrENrOjlGP#a, ig:DcrENrOjlGP |
| S05 | 905 | keramik | Schmetterlings-Schälchen zum Aufhängen | 42,00 | keramik | available | ig:DcrENrOjlGP#b, ig:DcrENrOjlGP |
| S06 | 906 | keramik | Fliese „Auftritt“ | 65,00 | keramik | sold offline, Archiv sichtbar | ig:Dav1kUkDgR7 |
| S07 | 907 | keramik | Teller „Hasen-Reigen“ | 58,00 | keramik | available (Rückläufer O01) | ph:teller-01 |
| S08 | 908 | keramik | Kleiner Teller „Fuchs auf dem Mond“ | 49,00 | keramik | sold (O11), **nicht** im Archiv | ph:teller-02 |
| S09 | 909 | keramik | Fliese „Reh im Planetenregen“ | 85,00 | keramik | archived (vor dem Versand zerbrochen, O08 erstattet) | ph:fliese-01 |
| S10 | 910 | textil | T-Shirt „Hasen-Parade“ | 68,00 | paket_klein | sold (O05) | ph:shirt-01 |
| S11 | 911 | textil | T-Shirt „Coco fliegt zum Mond“ | 64,00 | paket_klein | available | ph:shirt-02 |
| S12 | 912 | textil | Ringer-Shirt „Fuchs“ | 72,00 | paket_klein | available (nach O07) | ph:shirt-03 |
| S13 | 913 | textil | Kleid „Hasen-Bordüre“ | 145,00 | paket_klein | sold (O06) | ph:kleid-01 |
| S14 | 914 | textil | Kleid „Planeten-Nacht“ | 128,00 | paket_klein | reserved (O13, Vorkasse) | ph:kleid-02 |
| S15 | 915 | cap | Pinke Cap „sometimes“ | 85,00 | paket_klein | available | ig:DcT7ErBDsWi |
| S16 | 916 | cap | Graue Cap „Flammenwesen“ | 89,00 | paket_klein | sold (O04) | ig:DdHXUQsDjqm#cap |
| S17 | 917 | cap | Cap „Coco-Kopf“ | 79,00 | paket_klein | available | ph:cap-01 |
| S18 | 918 | cap | Cap „Kleiner Planet“ | 75,00 | paket_klein | draft | ph:cap-02 |
| S19 | 919 | zeichnung | „Fuchs“, Aquarell | 120,00 | paket_klein | sold (O02, Abholung) | ig:DaDz8yljp3i |
| S20 | 920 | zeichnung | „Zwei Figuren“, Tusche | 95,00 | brief | available | ig:DaJH_kADpsK |
| S21 | 921 | zeichnung | „Kelch mit Schlange“, Tusche | 80,00 | brief | sold (O03) | ig:DbJ1QRrjCcb |
| S22 | 922 | zeichnung | „Reh“, Aquarell aus dem Skizzenbuch | 110,00 | brief | available | ig:DblvrTRiUqi |
| S23 | 923 | zeichnung | „Coco auf dem Mond“, Tusche | 140,00 | paket_klein | available | ph:zeichnung-01 |
| S24 | 924 | zeichnung | „Flammenwesen“, Aquarell | 180,00 | paket_klein | sold (O14) | ph:zeichnung-02 |
| S25 | 925 | zeichnung | „Kleine Hasenversammlung“, Tusche | 60,00 | brief | draft | ph:zeichnung-03 |
| S26 | 926 | schmuck | Fuchs-Anhänger | 28,00 | brief | available | ig:Da2WrEgDpC_#pendant |
| S27 | 927 | schmuck | Anhänger „Coco mit Planetenring“ | 32,00 | brief | reserved (offene Kasse KS2) | ph:anhaenger-01 |
| S28 | 928 | schmuck | Mini-Planet-Anhänger | 24,00 | brief | available | ph:anhaenger-02 |
| S29 | 929 | schmuck | Reh-Köpfchen-Anhänger | 29,00 | brief | available (EN fehlt) | ph:anhaenger-03 |
| S30 | 930 | sonstiges | Flohmarkt-Spiegel „Hasen-Rahmen“ | 98,00 | nur_abholung | sold (O09, Abholung) | ph:spiegel-01 |

Summe Status: 14 `available`, 2 `reserved`, 11 `sold` (10 im Archiv sichtbar; `soldChannel` 8 × `online`, 2 × `pickup`,
1 × `offline`), 1 `archived`, 2 `draft`.
Startseite (höchstens 4 je Station, `available`/`reserved`): Keramik S01, S04, S05, S07 · Textil S11, S12, S14, S15, S17
(Auswahl macht der Code) · Zeichnungen S20, S22, S23 · Schmuck S26, S27, S28, S29.

### 5.2 Gemeinsame Werte

| Feld | Wert |
|---|---|
| `vatCategory` | `reduced_art` bei allen `zeichnung` (mit Default-`vatReducedReason`), sonst `standard` |
| `ownDesignConfirmed` | `true` bei allen 30 (bemalte Second-Hand-Teile tragen Juttas eigene Motive; keine fremden Figuren, Marken oder Schriftzüge Dritter, E-18, R-047) |
| `blankBrandVisible` | `false` bei allen textil- und cap-Stücken (Instagram-Fotos S15/S16 geprüft, Platzhalter ohne Logo; R-047); `settings.legal.allowVisibleBlankBrands` bleibt beim Default `false` |
| `deviationDecision` | textil/cap: `described` bei S11 und S14 (→ `hasDeviation = true`), sonst `none` (auch beim Entwurf S18, damit er genau an der Faserangabe scheitert; R-048); übrige Kategorien leer, S22 setzt `hasDeviation = true` direkt |
| `framed` / `frameHasGlass` | `false` / `false` bei allen `zeichnung` (ungerahmte Blätter, R-046) |
| `isCustomCommission` | `false` |
| `foodContact` | `deko` bei allen `keramik`; `conformityDeclarations` leer |
| `safetyWarnings` | Vorlage §3.2 der Kategorie (DE+EN); S30 eigene Fassung (§5.4) |
| `careInstructions` | Vorlage §3.2 bei textil/cap |
| `isSecondHand` | `true` bei textil, cap und S30 |
| Schmuck | `metalPartsMaterial` DE „Öse: Edelstahl 316L“ · EN “Loop: stainless steel 316L”; `nickelFreeConfirmed = true`; `nickelEvidence` = `private-uploads:nickel-demo`; `leadFreeGlazeConfirmed = true` (Beispieldokument `private-uploads:glaze-demo`, R-045); `smallPartsWarning = true` |
| `storageLocation` | keramik `Regal K` · textil `Stange T` · cap `Kiste C` · zeichnung `Mappe Z` · schmuck `Kästchen S` · sonstiges `Flur` |
| `i18n.enStatus` | `reviewed`, außer S23 `machine`, S25 und S29 `missing` |
| `materials` keramik | DE „Steinzeug, Unterglasurfarben, Transparentglasur“ · EN “Stoneware, underglaze colours, clear glaze” (S06: DE „Keramikfliese, bemalt, glasiert“ · EN “Ceramic tile, painted, glazed”) |
| `materials` textil | DE „Second-Hand-T-Shirt, bemalt mit Textilfarbe“ bzw. „Second-Hand-Kleid, bemalt mit Textilfarbe“ · EN “Second-hand T-shirt, painted with fabric paint” / “Second-hand dress, painted with fabric paint” |
| `materials` cap | DE „Second-Hand-Cap, bemalt mit Textilfarbe“ · EN “Second-hand cap, painted with fabric paint” |
| `materials` zeichnung | Aquarell: DE „Aquarell auf Papier (300 g/m²)“ · EN “Watercolour on paper (300 gsm)”; Tusche: DE „Tusche auf Papier“ · EN “Ink on paper”; S22: DE „Aquarell im Skizzenbuch, Seite herausgetrennt“ · EN “Watercolour on a sketchbook page, removed from the book” |
| `materials` schmuck | DE „Steinzeug, glasiert; Öse aus Edelstahl“ · EN “Stoneware, glazed; stainless steel loop” |
| `materials` S30 | DE „Spiegelglas, alter Holzrahmen, bemalt mit Acrylfarbe, Klarlack“ · EN “Mirror glass, old wooden frame, painted with acrylic, clear varnish” |

### 5.3 Pflichtangaben und Verkaufsfelder

**Maße, Gewicht, Textilangaben**

| Key | Maße (cm) | g | `sizeLabel` DE / EN | Faser (`component` `fiber` %) | `condition` | Abweichung |
|---|---|---|---|---|---|---|
| S01 | Ø 11, H 5 | 210 | – | – | – | – |
| S02 | Ø 12, H 5,5 | 240 | – | – | – | – |
| S03 | Ø 11,5, H 5 | 220 | – | – | – | – |
| S04 | Ø 10, H 2 | 120 | – | – | – | – |
| S05 | B 12, H 11, T 1,5 | 110 | – | – | – | – |
| S06 | B 10, H 10, T 0,6 | 180 | – | – | – | – |
| S07 | Ø 22, H 2,5 | 520 | – | – | – | – |
| S08 | Ø 17, H 2 | 330 | – | – | – | – |
| S09 | B 20, H 20, T 0,8 | 650 | – | – | – | – |
| S10 | Note DE „Brustweite 52 cm, Länge 70 cm“ / EN “Chest width 52 cm, length 70 cm” | 180 | M / M | main cotton 100 | very_good | – |
| S11 | Note „Brustweite 56 cm, Länge 74 cm“ / “Chest width 56 cm, length 74 cm” | 200 | L / L | main cotton 60, main polyester 40 | good; `conditionNote` DE „leichte Knötchen unter den Armen“ · EN “light pilling under the arms” | ja (§5.4) |
| S12 | Note „Brustweite 46 cm, Länge 64 cm“ / “Chest width 46 cm, length 64 cm” | 150 | S / S | main cotton 100 | like_new | – |
| S13 | Note „Brustweite 46 cm, Länge 98 cm“ / “Chest width 46 cm, length 98 cm” | 260 | EU 38 / EU 38 | main viscose 100; lining polyester 100 | very_good | – |
| S14 | Note „Brustweite 48 cm, Länge 105 cm“ / “Chest width 48 cm, length 105 cm” | 380 | ca. M (EU 38–40) / approx. M (EU 38–40) | main cotton 100 (nach bestem Wissen) **und** `labelMissing = true` mit `fiberFreeText` DE „Baumwolle (nach bestem Wissen)“ · EN “cotton (to the best of my knowledge)” (R-043) | good | ja (§5.4) |
| S15 | Note „Kopfumfang ca. 54–60 cm“ / “Head size approx. 54–60 cm” | 110 | Einheitsgröße, verstellbar / One size, adjustable | main cotton 100 | very_good | – |
| S16 | wie S15 | 110 | wie S15 | main cotton 100 | good | – |
| S17 | wie S15 | 100 | wie S15 | main cotton 100 | like_new | – |
| S18 | wie S15 | 100 | wie S15 | **leer** und `labelMissing = false` (Entwurf, Veröffentlichung scheitert) | like_new | – |
| S19 | B 20, H 30 | 30 | – | – | – | – |
| S20 | B 21, H 29,7 | 15 | – | – | – | – |
| S21 | B 18, H 24 | 12 | – | – | – | – |
| S22 | B 14, H 21 | 10 | – | – | – | ja (§5.4) |
| S23 | B 24, H 30 | 25 | – | – | – | – |
| S24 | B 24, H 32 | 35 | – | – | – | – |
| S25 | B 14,8, H 21 | 8 | – | – | – | – |
| S26 | B 1, H 1,5 | 4 | – | – | – | – |
| S27 | B 2, H 1,8 | 5 | – | – | – | – |
| S28 | B 1,2, H 1,2 | 3 | – | – | – | – |
| S29 | B 1,5, H 1,8 | 4 | – | – | – | – |
| S30 | B 45, H 60, T 3 | 2400 | – | – | – | – |

**Verkaufsfelder** (nur beim Anlegen gesetzt; §1.3)

| Key | `firstPublishedAt` | `soldAt` / `soldChannel` | weitere Felder |
|---|---|---|---|
| S01, S02, S03 | `D-30@18:00` (Beitrag DdUPhoZOoMW) | S02 `D-3@18:26` online (O10) · S03 `D-2@07:49` online (O12) | `currentOrder` S02 → O10, S03 → O12 |
| S04, S05 | `D-46@18:00` (DcrENrOjlGP) | – | S04 `internalNote` „Rückläufer aus PC-2026-90005 (Teil-Widerruf), unbeschädigt, wieder online.“ |
| S06 | `D-94@18:00` (Dav1kUkDgR7) | `D-32@15:00` offline | `offlineSaleNote` „Flohmarkt Mauerpark“, `showInArchiveAfterSale = true` |
| S07 | `D-60@18:00` | – | `internalNote` „Rückläufer aus PC-2026-90001 (Widerruf), unbeschädigt, wieder online.“ |
| S08 | `D-45@18:00` | `D-3@19:11` online (O11) | `currentOrder` O11, **`showInArchiveAfterSale = false`**; `internalNote` „Käuferin möchte den Teller verschenken – bitte nicht im Archiv zeigen.“ |
| S09 | `D-20@18:00` | – | `archivedAt` `D-6@09:35` (Produkt-Übergang P13 nach der `breakage`-Erstattung von O08, KONZEPT §5.1, DATENMODELL §6.6.7; `soldAt`/`soldChannel`/`currentOrder` leer wie nach P13); `internalNote` „Beim Packen für PC-2026-90008 zerbrochen – Bestellung voll erstattet, nicht mehr verkaufen.“ |
| S10 | `D-40@18:00` | `D-22@12:31` online (O05) | `currentOrder` O05 |
| S11 | `D-16@18:00` | – | – |
| S12 | `D-25@18:00` | – | `internalNote` „War für PC-2026-90007 reserviert, Vorkasse kam nicht.“ |
| S13 | `D-33@18:00` | `D-13@20:41` online (O06) | `currentOrder` O06 |
| S14 | `D-10@18:00` | – | `status = reserved`, `reservedUntil` `D+3@23:59:59`, `reservationRef` = `checkouts:O13`.`reservationRef`, `currentOrder` O13 |
| S15 | `D-55@18:00` (DcT7ErBDsWi) | – | – |
| S16 | `D-35@18:00` (DdHXUQsDjqm) | `D-22@14:00` online (O04) | `currentOrder` O04 |
| S17 | `D-6@18:00` | – | – |
| S18 | – | – | `internalNote` „Etikett noch abschreiben.“ |
| S19 | `D-111@18:00` (DaDz8yljp3i) | `D-41@19:14` pickup (O02) | `currentOrder` O02 |
| S20 | `D-109@18:00` (DaJH_kADpsK) | – | – |
| S21 | `D-84@18:00` (DbJ1QRrjCcb) | `D-30@21:05` online (O03) | `currentOrder` O03 |
| S22 | `D-73@18:00` (DblvrTRiUqi) | – | – |
| S23 | `D-8@18:00` | – | – |
| S24 | `D-29@18:00` | `D-1@22:07` online (O14) | `currentOrder` O14 |
| S25 | – | – | – |
| S26 | `D-91@18:00` (Da2WrEgDpC_) | – | – |
| S27 | `D-18@18:00` | – | `status = reserved`, `reservedUntil` = `N+30min`, `reservationRef` = `checkouts:KS2`.`reservationRef`, `currentOrder` leer (noch keine Bestellung) |
| S28 | `D-18@18:00` | – | – |
| S29 | `D-5@18:00` | – | – |
| S30 | `D-27@18:00` | `D-6@11:00` pickup (O09) | `currentOrder` O09 |

Nicht genannt: `showInArchiveAfterSale = true`, übrige Verkaufsfelder leer.

### 5.4 Texte

Ton: locker, du-Form, kurze Sätze, Tiere mit Kulleraugen (E-62). Keine Heil-, Umwelt- oder Qualitätsversprechen,
keine fremden Figuren oder Marken, keine Liedzeilen.

**S01 · 901 · Schale „Langohr & Wuschel“** · EN Bowl “Long Ears & Fluff”
- DE: Kleine Schale, innen wohnen ein Hase mit sehr langen Ohren und ein Wuschelhund, der ihn anhimmelt. Leicht schief geformt, weiß glasiert, schwarze Linie. Für Ringe, Schlüssel oder Kleinkram.
- EN: A small bowl where a very long-eared bunny lives with a fluffy dog who adores him. Slightly wonky, white glaze, black line. For rings, keys or odds and ends.
- juttaSays: DE „Die beiden sind unzertrennlich. Bitte nicht auseinanderbringen.“ · EN “These two are inseparable. Please don't split them up.”

**S02 · 902 · Schale „Zwei Hunde“** · EN Bowl “Two Dogs”
- DE: Zwei Hunde in einer Schale: einer hell mit Schlappohren, einer schwarz und sehr aufgeregt. Handgeformt, weiß glasiert, innen bemalt.
- EN: Two dogs in one bowl: a light one with floppy ears and a black one who is very excited. Hand-formed, white glaze, painted inside.

**S03 · 903 · Schale „Hund & schwarzer Hase“** · EN Bowl “Dog & Black Bunny”
- DE: Ein heller Hund mit Kulleraugen trifft einen schwarzen Hasen mit Riesenohren. Wer hier wen erschreckt, ist noch nicht geklärt.
- EN: A light dog with googly eyes meets a black bunny with giant ears. Who's scaring whom is still up for debate.

**S04 · 904 · Schmetterlings-Schälchen, rund** · EN Round butterfly dish
- DE: Flaches rundes Schälchen mit einem Schmetterling aus meinem Skizzenbuch und einer handgeschriebenen Zeile. Rundherum kleine Punkte am Rand. Für Ohrringe, Ringe oder einfach zum Angucken.
- EN: A flat round dish with a butterfly from my sketchbook and a handwritten line. Little dots all around the rim. For earrings, rings or just to look at.

**S05 · 905 · Schmetterlings-Schälchen zum Aufhängen** · EN Butterfly dish for hanging
- DE: Flaches Schälchen mit Lasche: ein zart gefärbter Schmetterling, drumherum handgeschriebene Worte. Hängt am Nagel genauso schön, wie es auf dem Tisch liegt.
- EN: A flat dish with a tab: a softly coloured butterfly with handwritten words around it. Looks just as good on a nail as it does on a table.

**S06 · 906 · Fliese „Auftritt“** · EN Tile “On Stage”
- DE: Bemalte Fliese: Jemand im dunklen Anzug steht auf der Bühne, die Worte schweben drumherum. Vom Flohmarkttisch direkt in die Welt.
- EN: A painted tile: someone in a dark suit on stage, words floating all around. Straight from the flea market table out into the world.

**S07 · 907 · Teller „Hasen-Reigen“** · EN Plate “Bunny Round Dance”
- DE: Fünf Hasen laufen im Kreis um den Teller, und keiner weiß mehr, wer angefangen hat. In der Mitte parkt ein kleiner Planet. Zum Hinstellen oder Aufhängen (Aufhänger nicht dabei).
- EN: Five bunnies running in circles around the plate, and nobody remembers who started it. A little planet is parked in the middle. To stand up or hang (hanger not included).
- juttaSays: DE „Der war schon einmal unterwegs und ist zurückgekommen. Ganz heil, nur etwas reiseerfahrener.“ · EN “This one went on a trip and came back. Perfectly fine, just a bit more well-travelled.”

**S08 · 908 · Kleiner Teller „Fuchs auf dem Mond“** · EN Small plate “Fox on the Moon”
- DE: Ein Fuchs macht es sich in der Mondsichel gemütlich, drei Sterne gucken zu. Kleiner Deko-Teller.
- EN: A fox getting cosy in a crescent moon while three stars watch. Small decorative plate.

**S09 · 909 · Fliese „Reh im Planetenregen“** · EN Tile “Deer in Planet Rain”
- DE: Ein Reh mit Tupfen bleibt ganz ruhig, während es kleine Planeten regnet. Quadratische Fliese zum Hinstellen oder Aufhängen.
- EN: A spotted deer stays perfectly calm while it rains little planets. Square tile to stand up or hang.

**S10 · 910 · T-Shirt „Hasen-Parade“** · EN T-shirt “Bunny Parade”
- DE: Weißes Second-Hand-Shirt, vorne marschieren vier Hasen im Gleichschritt. Von Hand bemalt, schön weich gewaschen.
- EN: White second-hand tee with four bunnies marching in step across the front. Painted by hand, nice and soft from washing.

**S11 · 911 · T-Shirt „Coco fliegt zum Mond“** · EN T-shirt “Coco Flies to the Moon”
- DE: Graues Shirt: Coco sitzt mit Helm auf einer Rakete und will zum Mond. Second-Hand, von Hand bemalt.
- EN: Grey tee: Coco in a helmet, riding a rocket to the moon. Second-hand, painted by hand.
- deviationDescription: DE „Kleines Loch an der linken Seitennaht, von mir sichtbar gestopft (ca. 1 cm).“ · EN “Small hole at the left side seam, visibly darned by me (approx. 1 cm).”
- juttaSays: DE „Das Loch hab ich extra bunt gestopft – Coco findet, das gehört jetzt dazu.“ · EN “I darned the hole in a bright colour on purpose – Coco says it's part of the look now.”

**S12 · 912 · Ringer-Shirt „Fuchs“** · EN Ringer tee “Fox”
- DE: Ringer-Shirt mit roten Bündchen und einem Fuchs mit Kulleraugen auf der Brust. Kaum getragen.
- EN: Ringer tee with red trims and a googly-eyed fox on the chest. Barely worn.

**S13 · 913 · Kleid „Hasen-Bordüre“** · EN Dress “Bunny Border”
- DE: Leichtes Sommerkleid, am Saum eine gemalte Bordüre aus Hasenköpfen und Tupfen. Mit Futter, Second-Hand.
- EN: Light summer dress with a painted border of bunny heads and dots along the hem. Lined, second-hand.

**S14 · 914 · Kleid „Planeten-Nacht“** · EN Dress “Planet Night”
- DE: Dunkelblaues Kleid mit langen Ärmeln, übersät mit Planeten und Sternen. Das Etikett fehlt – nach bestem Wissen Baumwolle.
- EN: Dark blue long-sleeved dress scattered with planets and stars. The label is missing – to the best of my knowledge it's cotton.
- deviationDescription: DE „Am Saum hinten ist eine Stelle heller ausgeblichen (ca. 4 × 2 cm).“ · EN “There's a lighter faded patch on the back hem (approx. 4 × 2 cm).”

**S15 · 915 · Pinke Cap „sometimes“** · EN Pink cap “sometimes”
- DE: Pinke Cap mit einem roten Fabelwesen, schwarzen Ranken und kleinen blauen Schlangen. Auf dem Schirm steht „sometimes“ – manchmal eben.
- EN: Pink cap with a red creature, black vines and little blue snakes. The brim says “sometimes” – because sometimes, well.
- juttaSays: DE „Das Wesen hat keinen Namen. Vorschläge nehme ich gern per Mail.“ · EN “The creature doesn't have a name yet. Suggestions welcome by email.”

**S16 · 916 · Graue Cap „Flammenwesen“** · EN Grey cap “Flame Creature”
- DE: Grau gewaschene Cap, vorne springt ein schwarzes Wesen durch bunte Flammen. Mit Schriftzug auf dem Schirm.
- EN: Washed grey cap with a black creature leaping through colourful flames. Lettering on the brim.

**S17 · 917 · Cap „Coco-Kopf“** · EN Cap “Coco Head”
- DE: Sandfarbene Cap, vorne guckt Coco mit ihren Riesenohren raus. Wie neu.
- EN: Sand-coloured cap with Coco and her giant ears peeking out from the front. Like new.

**S18 · 918 · Cap „Kleiner Planet“** (Entwurf) · EN Cap “Little Planet”
- DE: Schwarze Cap mit einem kleinen Planeten und zwei Sternen an der Seite.
- EN: Black cap with a little planet and two stars on the side.

**S19 · 919 · „Fuchs“, Aquarell** · EN “Fox”, watercolour
- DE: Ein Fuchs mit großen Augen und langen Schnurrhaaren, leuchtend orange auf Grün und Pink. Original-Aquarell, ungerahmt.
- EN: A fox with big eyes and long whiskers, bright orange on green and pink. Original watercolour, unframed.

**S20 · 920 · „Zwei Figuren“, Tusche** · EN “Two Figures”, ink
- DE: Eine Figur im karierten Kleid mit tätowierten Beinen, daneben hängt jemand kopfüber ab. Feine, zittrige Linie – mein Lieblingsstrich.
- EN: A figure in a checked dress with tattooed legs, and someone hanging upside down next to her. Fine, shaky line – my favourite kind.

**S21 · 921 · „Kelch mit Schlange“, Tusche** · EN “Chalice with Snake”, ink
- DE: Aus einem Kelch windet sich eine Schlange. Klare schwarze Linie auf Weiß. Das Motiv gibt es auch als Flash F-901.
- EN: A snake winding its way out of a chalice. Clean black line on white. The design is also available as flash F-901.

**S22 · 922 · „Reh“, Aquarell aus dem Skizzenbuch** · EN “Deer”, sketchbook watercolour
- DE: Ein Rehkitz mit großen Ohren und hellen Tupfen, direkt aus meinem Skizzenbuch getrennt.
- EN: A fawn with big ears and pale spots, taken straight out of my sketchbook.
- deviationDescription: DE „Linker Rand mit Perforation vom Skizzenbuch, Papier leicht gewellt.“ · EN “Perforated left edge from the sketchbook, paper slightly wavy.”
- juttaSays: DE „Die Welle im Papier kommt vom Wasser. Das gehört beim Aquarell dazu.“ · EN “The wave in the paper comes from the water. That's just watercolour.”

**S23 · 923 · „Coco auf dem Mond“, Tusche** (EN maschinell) · EN “Coco on the Moon”, ink
- DE: Coco sitzt auf dem Mond und lässt die Beine baumeln. Tusche auf festem Papier.
- EN: Coco sits on the moon and lets her legs dangle. Ink on firm paper.

**S24 · 924 · „Flammenwesen“, Aquarell** · EN “Flame Creature”, watercolour
- DE: Das Wesen von der grauen Cap hat sein eigenes Blatt bekommen: schwarz, mit einer Mähne aus bunten Flammen.
- EN: The creature from the grey cap got its own sheet: black, with a mane of colourful flames.

**S25 · 925 · „Kleine Hasenversammlung“, Tusche** (Entwurf, EN fehlt)
- DE: Fünf Hasen stehen im Halbkreis und beraten etwas sehr Wichtiges. Tusche, A5.
- EN: – (Titel, Beschreibung **und** EN-Alt-Text des Bildes fehlen → Veröffentlichung scheitert an „Bildbeschreibung EN“)

**S26 · 926 · Fuchs-Anhänger** · EN Fox pendant
- DE: Winziger Fuchs aus Keramik, orange-weiß glasiert, mit schwarz gemaltem Gesicht und Öse. Kette nicht dabei.
- EN: A tiny ceramic fox, glazed orange and white, with a black-painted face and a loop. Chain not included.
- juttaSays: DE „1 × 1,5 cm. Ja, wirklich so klein.“ · EN “1 × 1.5 cm. Yes, really that small.”

**S27 · 927 · Anhänger „Coco mit Planetenring“** · EN Pendant “Coco with a Planet Ring”
- DE: Coco als Planet – mit Ring um den Kopf. Kleiner Keramik-Anhänger mit Öse.
- EN: Coco as a planet – with a ring around her head. Small ceramic pendant with a loop.

**S28 · 928 · Mini-Planet-Anhänger** · EN Mini planet pendant
- DE: Ein Planet mit Ring, kleiner als eine Fingerkuppe. Weiß glasiert, der Ring in Pink.
- EN: A planet with a ring, smaller than a fingertip. White glaze, pink ring.

**S29 · 929 · Reh-Köpfchen-Anhänger** (EN fehlt → Fallback-Test)
- DE: Ein Rehköpfchen mit großen Ohren und Tupfen auf der Stirn. Keramik, glasiert, mit Öse.
- EN: – (Titel und Beschreibung fehlen; der Alt-Text des Bildes hat EN, sonst wäre das Stück nicht veröffentlichbar)

**S30 · 930 · Flohmarkt-Spiegel „Hasen-Rahmen“** · EN Flea-market mirror “Bunny Frame”
- DE: Alter Holzspiegel vom Flohmarkt, auf dem Rahmen gucken Hasen über die Kante. Zu schwer und zu zerbrechlich für die Post – nur Abholung in Berlin.
- EN: An old wooden mirror from the flea market, with bunnies peeking over the edge of the frame. Too heavy and fragile to post – pickup in Berlin only.
- safetyWarnings: DE „Spiegelglas kann bei Stößen brechen. Nur an einer geeigneten Wand sicher aufhängen.“ · EN “Mirror glass can break if knocked. Only hang securely on a suitable wall.”
- juttaSays: DE „Die Hasen gucken dir beim Zähneputzen zu. Sorry.“ · EN “The bunnies will watch you brush your teeth. Sorry.”

---

## 6. Kund:innen (`customers.json`, nur Seed-intern)

Erkennbar erfunden (R-180): E-Mail `@example.com`/`@example.org`, keine Telefonnummer, erfundene Straßennamen
(Prüfung gegen das Berliner Straßenverzeichnis: SE-05), echte Postleitzahlen. Alle `country = DE`, `addressLine2` leer.

| Key | Name | E-Mail | Adresse | Sprache | Vorgänge |
|---|---|---|---|---|---|
| C01 | Paula Beispiel | paula.beispiel@example.com | Probegasse 3, 50667 Köln | de | O01, W1, DS1 |
| C02 | Erika Musterfrau | erika.musterfrau@example.com | Musterstraße 1, 10115 Berlin (Rechnungsadresse) | de | O02, RK3 |
| C03 | Max Mustermann | max.mustermann@example.com | Beispielweg 7, 20095 Hamburg | de | O03 |
| C04 | Lena Platzhalter | lena.platzhalter@example.org | Platzhalterplatz 5, 80331 München | de | O04, W3 |
| C05 | Tom Testmann | tom.testmann@example.com | Testallee 12, 04109 Leipzig | de | O05, W2, RK2 |
| C06 | Alex Sample | alex.sample@example.org | Beispielufer 21, 69117 Heidelberg | en | O06, W5, RK4 |
| C07 | Greta Gedacht | greta.gedacht@example.com | Gedankenweg 10, 99084 Erfurt | de | O07 |
| C08 | Uwe Unbekannt | uwe.unbekannt@example.org | Unbekanntstraße 3, 39104 Magdeburg | de | O08, DS3 |
| C09 | Hanna Demo | hanna.demo@example.com | Demoring 2, 14467 Potsdam (Rechnungsadresse) | de | O09 |
| C10 | Frieda Fiktiv | frieda.fiktiv@example.com | Erfundenweg 9, 01067 Dresden | de | O10, RK1 |
| C11 | Ida Irgendwer | ida.irgendwer@example.org | Irgendwoallee 6, 24103 Kiel | de | O11, Kasse KS1 |
| C12 | Karl Exempel | karl.exempel@example.com | Exempelstraße 4, 60311 Frankfurt am Main | de | O12 |
| C13 | Otto Normal | otto.normal@example.org | Normalweg 8, 28195 Bremen | de | O13 |
| C14 | Sam Placeholder | sam.placeholder@example.org | Musterdamm 14, 30159 Hannover | en | O14, DS5 |
| C15 | Rudi Rätselhaft | rudi.raetselhaft@example.com | – | de | W4, W6 (ohne Bestellung), DS4 |
| C16 | Casey Example | casey.example@example.org | – | en | A1 |
| C17 | Felix Fantasie | felix.fantasie@example.com | – | de | A2 |
| C18 | Nora Nirgends | nora.nirgends@example.com | – | de | A3 |
| C19 | Jana Jedermann | jana.jedermann@example.com | – | de | A4 |
| C20 | Emil Erdacht | emil.erdacht@example.com | – | de | A5 |
| C21 | Robin Specimen | robin.specimen@example.org | – | en | A6 |
| C22 | Zoe Zufall | zoe.zufall@example.com | – | de | A7 |
| C23 | Test Test | test@example.org | – | de | W7 (Test-Eingabe) |
| C24 | Kai Kontakt | kai.kontakt@example.org | – | de | DS2 (Anfrage für eine andere Person) |

Versand: `shippingAddress` = Adresse, `billingAddressDiffers = false`. Abholung (O02, O09): `billingAddress` = Adresse,
`shippingAddress` leer. `customer.name` = Name der Tabelle (ein Feld „Vor- und Nachname“). Die offene Kasse KS2 hat noch
keine Kund:innen-Daten (vor dem Absenden, §7.3).

---

## 7. Bestellungen (`orders`, 14) und Kassen (`checkouts`, 14)

### 7.1 Übersicht

Eine Bestellung entsteht erst mit bestätigter Zahlung (O1) bzw. beim Vorkasse-Abschluss (O2); davor gibt es nur die
Kasse (DATENMODELL §6.8, §6.25). Status exakt aus `ORDER_STATUSES` (DATENMODELL §4, 13 Werte), Übergänge O1–O20
(DATENMODELL §6.8.5; Bestellungen haben die zweistelligen Schlüssel O01–O14 – wo eine Verwechslung möglich ist, steht
„Übergang Onn“). Nummern steigen mit `placedAt` (wie bei echter Sequenz).

| Key | Nummer | Status | Kund:in | Zahlart (`paymentMethod` / `stripe.paymentMethodType`) | Lieferung | Positionen | Versand | Summe |
|---|---|---|---|---|---|---|---|---|
| O01 | PC-2026-90001 | `refunded` (Widerruf, Übergang O13) | C01 | paypal / paypal | shipping | S07 | 890 | 6690 |
| O02 | PC-2026-90002 | `picked_up` | C02 | card / apple_pay | pickup | S19 | 0 | 12000 |
| O03 | PC-2026-90003 | `disputed` (Übergang O16, `statusBeforeDispute = delivered`) | C03 | card / card | shipping | S21 | 450 | 8450 |
| O04 | PC-2026-90004 | `return_received` | C04 | prepayment | shipping | S16 | 650 | 9550 |
| O05 | PC-2026-90005 | `partially_refunded` | C05 | card / google_pay | shipping | S10, S04 | 890 | 11490 |
| O06 | PC-2026-90006 | `withdrawal_received` | C06 (en) | card / card | shipping | S13 | 650 | 15150 |
| O07 | PC-2026-90007 | `cancelled` (`payment_timeout`) | C07 | prepayment | shipping | S12 | 650 | 7850 |
| O08 | PC-2026-90008 | `refunded` (vor dem Versand zerbrochen, Übergang O15, Grund `breakage`) | C08 | card / card | shipping | S09 | 890 | 9390 |
| O09 | PC-2026-90009 | `ready_for_pickup` | C09 | prepayment | pickup | S30 | 0 | 9800 |
| O10 | PC-2026-90010 | `shipped` | C10 | paypal / paypal | shipping | S02 | 890 | 5690 |
| O11 | PC-2026-90011 | `delivered` | C11 | card / card | shipping | S08 | 890 | 5790 |
| O12 | PC-2026-90012 | `packed` | C12 | card / apple_pay | shipping | S03 | 890 | 5390 |
| O13 | PC-2026-90013 | `awaiting_prepayment` | C13 | prepayment | shipping | S14 | 650 | 13450 |
| O14 | PC-2026-90014 | `paid` | C14 (en) | card / google_pay | shipping | S24 | 650 | 18650 |

Gemeinsam: `currency = EUR`; `taxModeAtOrder = kleinunternehmer`; `shippingZone = DE` bei Versand, leer bei Abholung;
`shippingClass` = höchste Klasse der Positionen (O02 `paket_klein`, O09 `nur_abholung`); `paymentProvider` = `mock` bei
Karte/PayPal, `bank_transfer` bei Vorkasse; `legalTextVersions` = aktive v1 (§3.4); `legalSnippetVersions` = Arbeitsfassung
der angezeigten Bausteine (`draft-1`); `dispute.status = none` außer O03; `checkout` = Kasse `checkouts:<Key>` (§7.3),
bei O01 und O02 `null` (Kasse nach 30 Tagen gelöscht, L-03); `statusTokenHash` aus `seedToken('orders:<Key>', 'status')`
(§2.5), `statusTokenSealed` versiegelt denselben Token wie bei echten Bestellungen (DATENMODELL §6.8); eine
Seed-Bestellung bekommt nie einen neu erzeugten Status-Token (auch nicht, wenn das Entsiegeln scheitert); `statusHistory`
baut der Seed aus der Zeitleiste (§7.2), je Zeitpunkt ein Eintrag mit Übergang und `actorType`
laut DATENMODELL §6.8.5 (Webhook bei Übergang O1 und O16, Job bei Übergang O4 und bei Übergang O10 mit `auto`, sonst
Admin); `timestamps.finalStatusAt` und `retainUntil` berechnet der Seed wie der Hook.

**Verpackung** (E-47, DATENMODELL §6.8.8): Jede gepackte oder versendete Bestellung (O01, O03, O04, O05, O06, O10, O11,
O12) hat `packaging.templateKey` = Standard ihrer Versandklasse aus `settings.packaging.defaultsByShippingClass` (brief →
`brief-karton`, paket_klein → `tasche-papier`, keramik → `keramik-doppelkarton`), `components` als Kopie der Vorlage und
`packaging.recordedAt` = `packedAt`. Packfotos hat nur O12; die übrigen Keramik-Sendungen (O01, O05, O10, O11) gelten als
„ohne Packfoto versendet“ (R-100, keine Pflicht) – die zugehörigen Audit-Einträge `packing_photo_skipped` legt der Seed
nicht an (Protokoll-Auswahl §16.3). Exporte enthalten nie Beispieldaten, auch nicht bei wirksamem `SEED_PREVIEW_MODE`:
weder der Jahres-Export der Verpackungsmengen noch Monats-CSV, DATEV-Export oder Rechnungs-ZIP (KONZEPT §11.4,
AK-SEED-21). Admin-Listen, Danke- und Statusseiten zeigen das Etikett „Beispiel“ (§1.1).

### 7.2 Zeitleisten, Zahlung, Versand

`stripe.*` bei Karte/PayPal: `checkoutSessionId` `cs_seed_900NN`, `paymentIntentId` `pi_seed_900NN`, `chargeId`
`ch_seed_900NN`, `amountReceivedCents = totalCents`, `feeCents` wie angegeben (Karte 1,5 % + 25 ct, PayPal 3,19 % +
49 ct, kaufmännisch gerundet – nur Beispielwerte). `timeline` nennt die Zeitpunkte für `timestamps.*`; wo nichts anderes
steht, ist `shipment.deliveredSource = manual`.

**O01 · refunded** — `carrierEmailConsent` true · `feeCents` 262
- placedAt `D-50@20:15` · paidAt `D-50@20:16` · packedAt `D-49@10:00` · shippedAt `D-49@14:30` (dhl `SEEDDHL9000000000001`) · deliveredAt `D-47@12:10` · withdrawalReceivedAt `D-43@18:22` (W1) · returnReceivedAt `D-38@11:00` · refundedAt `D-37@09:15` (Übergang O13)
- `statusBeforeWithdrawal = delivered` · Position O01-L1: `status refunded`, `refundedCents` 5800
- refunds: `[{ amountCents 6690, reason withdrawal, itemIds [O01-L1], includesShipping true, status succeeded, stripeRefundId re_seed_90001_1, createdAt D-37@09:15 }]` → Gutschrift GS-1

**O02 · picked_up** — Abholung · `carrierEmailConsent` false · `feeCents` 205
- placedAt `D-41@19:12` · paidAt `D-41@19:14` · readyForPickupAt `D-38@10:30` · pickedUpAt `D-36@17:00`
- `notes` „Abholung Mittwoch nach Feierabend, hat sich über Coco gefreut.“

**O03 · disputed** — Brief · `carrierEmailConsent` false · `feeCents` 152
- placedAt `D-30@21:03` · paidAt `D-30@21:05` · packedAt `D-28@09:40` · shippedAt `D-28@15:20` (deutsche_post `SEEDDP000000003DE`, `trackingUrl` aus der Vorlage `deutsche_post`) · deliveredAt `D-18@03:05` (Task `markDelivered` am 10. Berliner Kalendertag nach dem Versandtag, `deliveredSource = auto`) · disputedAt `D-5@08:12` (Webhook `charge.dispute.created`, O16)
- `statusBeforeDispute = delivered` (die Statusseite zeigt diesen Status) · `dispute = { status open, stripeDisputeId dp_seed_90003 }`
- `adminAttention = { flag true, reason dispute_open, note „Anfechtung ‚nicht erhalten‘ – Einlieferungsbeleg und Packfotos heraussuchen.“ }`

**O04 · return_received** — Vorkasse · `carrierEmailConsent` false
- placedAt `D-24@08:55` · `prepayment.dueAt` `D-19@23:59:59` · `prepayment.reminderDueAt` `D-21@08:55` · `prepayment.receivedAt` = paidAt `D-22@14:00`, `receivedAmountCents` 9550 · packedAt `D-21@10:30` · shippedAt `D-21@16:45` (dhl `SEEDDHL9000000000004`) · deliveredAt `D-19@12:40` · withdrawalReceivedAt `D-9@19:30` (W3) · returnReceivedAt `D-2@11:15`
- `statusBeforeWithdrawal = delivered` · Position O04-L1: `status returned`
- refunds: `[]` (Erstattung per Überweisung fällig bis W3.refundDueAt `D+5@19:30`)
- `notes` „Erstattung per Überweisung: Kontoverbindung per Mail erfragt. IBAN nicht im System speichern.“

**O05 · partially_refunded** — Teil-Widerruf · `carrierEmailConsent` true · `feeCents` 197
- placedAt `D-22@12:30` · paidAt `D-22@12:31` · packedAt `D-21@10:00` · shippedAt `D-21@16:45` (dhl `SEEDDHL9000000000005`) · deliveredAt `D-19@10:20` · withdrawalReceivedAt `D-14@22:47` (W2, manuell zugeordnet `D-13@09:00`) · returnReceivedAt `D-8@11:30` · refundedAt `D-7@10:05`
- `statusBeforeWithdrawal = delivered` · O05-L1 (S10) `active` · O05-L2 (S04) `refunded`, `refundedCents` 3800
- refunds: `[{ amountCents 4040, reason withdrawal, itemIds [O05-L2], includesShipping true, status succeeded, stripeRefundId re_seed_90005_1, createdAt D-7@10:05 }]` – 3800 Ware + 240 Versand-Mehrkosten (Keramik 890 − Paket klein 650, Teil-Widerruf nach KONZEPT §5.3; offen: SE-10) → Gutschrift GS-2

**O06 · withdrawal_received** — `locale en` · `carrierEmailConsent` true · `feeCents` 252
- placedAt `D-13@20:40` · paidAt `D-13@20:41` · packedAt `D-10@09:30` · shippedAt `D-10@15:10` (dhl `SEEDDHL9000000000006`) · deliveredAt `D-8@13:05` · withdrawalReceivedAt `D-1@21:18` (W5)
- `statusBeforeWithdrawal = delivered`

**O07 · cancelled (`cancelReason = payment_timeout`)** — `carrierEmailConsent` false
- placedAt `D-9@10:10` · `prepayment.reminderDueAt` `D-6@10:10` · `prepayment.reminderSentAt` `D-6@11:00` · `prepayment.dueAt` `D-4@23:59:59` · cancelledAt `D-3@00:05` (Task `cancelOverduePrepayments`, O4)
- kein Beleg; Reservierung `released` (`prepayment_overdue`)

**O08 · refunded (Keramik vor dem Versand zerbrochen, Erstattung einer bezahlten Bestellung, Übergang O15)** — `carrierEmailConsent` false · `feeCents` 166
- placedAt `D-7@11:09` · paidAt `D-7@11:11` · refundedAt `D-6@09:30` (Admin-Erstattung aus `paid`, Übergang O15)
- O08-L1 (S09) `refunded`, `refundedCents` 8500; danach S09 → `archived` (Produkt-Übergang P13, §5.3)
- refunds: `[{ amountCents 9390, reason breakage, itemIds [O08-L1], includesShipping true, status succeeded, stripeRefundId re_seed_90008_1, createdAt D-6@09:30 }]` → Gutschrift GS-3 (Grund `breakage`)
- `notes` „Fliese beim Packen zerbrochen. Kunde per Mail informiert, nicht versendet, voll erstattet.“

**O09 · ready_for_pickup** — Vorkasse, Abholung
- placedAt `D-7@13:20` · `prepayment.dueAt` `D-2@23:59:59` · `prepayment.reminderDueAt` `D-4@13:20` · `prepayment.receivedAt` = paidAt `D-6@11:00`, `receivedAmountCents` 9800 · readyForPickupAt `D-6@11:05`

**O10 · shipped** — `carrierEmailConsent` true · `feeCents` 231
- placedAt `D-3@18:25` · paidAt `D-3@18:26` · packedAt `D-2@10:10` · shippedAt `D-2@16:00` (dhl `SEEDDHL9000000000010`, `trackingUrl` aus Vorlage)

**O11 · delivered** — `carrierEmailConsent` true · `feeCents` 112
- placedAt `D-3@19:10` · paidAt `D-3@19:11` · packedAt `D-2@09:15` · shippedAt `D-2@15:30` (dhl `SEEDDHL9000000000011`) · deliveredAt `D-1@11:40` (`deliveredSource = manual`)
- `notes` „Kundin hat per Mail geschrieben, dass der Teller heil angekommen ist.“

**O12 · packed** — `carrierEmailConsent` false · `feeCents` 106
- placedAt `D-2@07:48` · paidAt `D-2@07:49` · packedAt `D-1@17:30`
- `packingPhotos` [`private-uploads:O12:packing-1`, `…:packing-2`]

**O13 · awaiting_prepayment** — Vorkasse, Stück mit Abweichung · `carrierEmailConsent` false
- placedAt `D-2@15:37` · `prepayment.reminderDueAt` `D+1@15:37` · `prepayment.dueAt` `D+3@23:59:59`
- O13-L1 (S14): `deviationText` = S14.`deviationDescription.de`, `deviationAgreedAt` `D-2@15:37`

**O14 · paid** — `locale en` · `carrierEmailConsent` true · `feeCents` 305
- placedAt `D-1@22:05` · paidAt `D-1@22:07`

Vorkasse-Fristen (E-23, KA-28; eine einzige Implementierung in `src/lib/commerce/`): `reminderDueAt` = `placedAt` + 72 h
(Job `prepaymentReminders`); `dueAt` = 23:59:59 Europe/Berlin am 5. Kalendertag nach dem Bestelltag (Berliner Datum von
`placedAt` + `prepaymentDays`); danach Storno und Freigabe des Stücks durch `cancelOverduePrepayments`. Die Reservierung
der Vorkasse läuft bis `dueAt` (§8).

### 7.3 Kassen (`checkouts`, 14)

Zeitwerte laut DATENMODELL §8.1 mit T0 = `createdAt` („Zur Kasse“): `displayExpiresAt = T0 + 30 min`,
`stripe.sessionExpiresAt = T0 + 31 min`, `expiresAt = T0 + 36 min`. Für die Kasse einer Bestellung gilt
`T0 = placedAt − 4 min` und `submittedAt = placedAt`; Positionen-Snapshot, Summen, Adressen, `carrierEmailConsent`,
`deviationAgreements` (nur O13) und `legalTextVersions` entsprechen der Bestellung. `tokenHash` aus
`seedToken('checkouts:<Key>', 'checkout')` (§2.5), `stripe.sessionSeq = 1`, `stripe.livemode = false`, `mock.state`
passend zum Zustand. Angelegt werden nur Kassen mit `createdAt` nach `N − 30 Tage` (L-03, SE-12); O01 und O02 haben
deshalb keine Kasse mehr.

| Key | Zustand | Bestellung | `paymentChoice` | Zeitpunkte | `closeReason` |
|---|---|---|---|---|---|
| O03, O05, O06, O08, O10, O11, O12, O14 | `completed` | gleicher Key | `stripe` | `confirmingAt` = placedAt, `completedAt` = paidAt (O1) | – |
| O04, O07, O09, O13 | `completed` | gleicher Key | `prepayment` | `completedAt` = placedAt (O2) | – |
| KS1 | `expired` | – | `stripe` (PayPal abgebrochen) | createdAt `D-3@20:40` · submittedAt = confirmingAt `D-3@20:44` · `stripe.sessionExpiresAt` `D-3@21:11` · expiredAt `D-3@21:12` (Webhook `checkout.session.expired`) · `expiresAt` `D-3@21:16` | `reservation_expired` |
| KS2 | `open` | – | – (noch nicht abgesendet) | createdAt `N-6min` · `displayExpiresAt` `N+24min` · `stripe.sessionExpiresAt` `N+25min` · `expiresAt` `N+30min` | – |

- **KS1:** Kund:in C11, S27, Versand (brief 450), Summe 3650, `stripe.checkoutSessionId` `cs_seed_ks1`,
  `carrierEmailConsent` false; keine Bestellung, kein Beleg, keine Mail.
- **KS2:** S27, `fulfillmentMethod = shipping`, Summe 3650, `locale de`, `stripe.checkoutSessionId` `cs_seed_ks2`; noch
  keine Kund:innen-Daten und kein `submittedAt`. Ohne festes `SEED_NOW` läuft die Reservierung 30 Minuten nach dem
  Seed ab; `releaseExpiredReservations` setzt KS2 dann auf `expired`, und S27 wird `available`. Das ist gewollt;
  `pnpm seed:reset` stellt den Zustand wieder her. Tests nutzen festes `N`.

---

## 8. Reservierungen (`reservations`, 10)

`ref` = `checkouts.reservationRef`, `checkout` = Kasse, `order` = Bestellung (falls vorhanden); `createdAt` = T0 der
Kasse (§7.3); Kasse: `displayExpiresAt = T0 + 30 min`, `expiresAt = T0 + 36 min`; Vorkasse: `source = prepayment`,
`expiresAt = prepayment.dueAt` (DATENMODELL §8.5). Angelegt werden nur Reservierungen, die bei `N` noch existieren:
`active` oder mit `releasedAt`/`convertedAt` nach `N − 7 Tage` (L-02, SE-12). Die Reservierungen von O01–O06 sind danach
schon gelöscht.

| Key | Stück | `source` | `status` | Ende | `releaseReason` |
|---|---|---|---|---|---|
| O08, O10, O11, O12, O14 | Position der Bestellung | checkout_session | converted | `convertedAt` = paidAt | – |
| O09 | S30 | prepayment | converted | `convertedAt` `D-6@11:00` („Zahlung erhalten“) | – |
| O07 | S12 | prepayment | released | `releasedAt` `D-3@00:05` | prepayment_overdue |
| O13 | S14 | prepayment | **active** | `expiresAt` `D+3@23:59:59` | – |
| KS1 | S27 | checkout_session | released | `releasedAt` `D-3@21:12` | session_expired |
| KS2 | S27 | checkout_session | **active** | `expiresAt` `N+30min`, `displayExpiresAt` `N+24min` | – |

Bei mehreren Stücken je Kasse gäbe es eine Reservierung je Stück mit gleicher `ref` (seedKey `reservations:<Kasse>:<Stück>`);
bei kanonischem `N` betrifft das keine vorhandene Reservierung. Gesamtzahl 10 (so auch §0.1 und AK-SEED-03).

---

## 9. Belege (`invoices`, 15)

Anlage über den normalen Zähler (DATENMODELL §8.6) im eigenen Nummernkreis `BSP-RE` bzw. `BSP-GS` (Enum
`INVOICE_SERIES`), **je Serie streng nach `issueAt`**; dann stimmen die Nummern mit der Tabelle überein. Jeder Beleg zeigt
sichtbar „Beispiel“ (Wasserzeichen im PDF, Etikett in der Verwaltung, §1.1). `issueDate` = Datum von `issueAt`, `deliveryDate` = Datum von `paidAt`,
`taxMode = kleinunternehmer`, `isKleinunternehmer = true`, `totalNetCents = totalGrossCents`, `totalTaxCents = 0`,
`data` nach `InvoiceDataV1` (Verkäufer aus `settings.business`, Käufer aus Rechnungs-/Lieferadresse, `legalNote` mit dem
§-19-Satz). Die Belege entstehen mit den Bestellungen in P8 (§1.8); der Seed rendert die PDFs dabei direkt (ohne Job)
mit dem Renderer aus P4 und dem Wasserzeichen und setzt `pdf`, `sha256`, `renderedAt`, `status = issued`.

| Nummer (kanonisch) | Typ | Bestellung | `issueAt` | Betrag | `reason` | `relatedInvoice` |
|---|---|---|---|---|---|---|
| BSP-RE-2026-00001 | invoice | O01 | `D-50@20:16` | 6690 | – | – |
| BSP-RE-2026-00002 | invoice | O02 | `D-41@19:14` | 12000 | – | – |
| BSP-RE-2026-00003 | invoice | O03 | `D-30@21:05` | 8450 | – | – |
| BSP-RE-2026-00004 | invoice | O05 | `D-22@12:31` | 11490 | – | – |
| BSP-RE-2026-00005 | invoice | O04 | `D-22@14:00` | 9550 | – | – |
| BSP-RE-2026-00006 | invoice | O06 | `D-13@20:41` | 15150 | – | – |
| BSP-RE-2026-00007 | invoice | O08 | `D-7@11:11` | 9390 | – | – |
| BSP-RE-2026-00008 | invoice | O09 | `D-6@11:00` | 9800 | – | – |
| BSP-RE-2026-00009 | invoice | O10 | `D-3@18:26` | 5690 | – | – |
| BSP-RE-2026-00010 | invoice | O11 | `D-3@19:11` | 5790 | – | – |
| BSP-RE-2026-00011 | invoice | O12 | `D-2@07:49` | 5390 | – | – |
| BSP-RE-2026-00012 | invoice | O14 | `D-1@22:07` | 18650 | – | – |
| BSP-GS-2026-00001 | credit_note | O01 | `D-37@09:15` | 6690 | withdrawal | BSP-RE-2026-00001 |
| BSP-GS-2026-00002 | credit_note | O05 | `D-7@10:05` | 4040 | withdrawal | BSP-RE-2026-00004 |
| BSP-GS-2026-00003 | credit_note | O08 | `D-6@09:30` | 9390 | breakage | BSP-RE-2026-00007 |

`reason` der Gutschrift = `reason` der Erstattung (`REFUND_REASONS`). Zählerstand danach: `BSP-RE`/2026 = 12,
`BSP-GS`/2026 = 3; `RE`/`GS` unberührt. Summe Beispiel-Shopumsatz 1180,40 € − 201,20 € = 979,20 € (zählt nur im
Umsatz-Wächter und nur bei wirksamem `SEED_PREVIEW_MODE`; in Exporten nie, KONZEPT §11.4).

---

## 10. Widerrufe (`withdrawals`, 7)

Alle mit `channel = online_form` (Widerrufsfunktion R26). `submissionSnapshot` baut der Seed aus den Feldern +
`receivedAt` (ISO und Berlin-Text). `refundDueAt` = `receivedAt` + 14 Kalendertage, gleiche Berliner Uhrzeit.
`confirmationSentAt` = `receivedAt` (Mail-Log §16.1). Status und Übergänge laut DATENMODELL §6.11 (`WITHDRAWAL_STATUSES`).

| Key | Referenz | Bestellung | `receivedAt` | Name / E-Mail | `matchStatus` | `status` | weitere Zeitpunkte |
|---|---|---|---|---|---|---|---|
| W1 | WR-2026-90001 | O01 | `D-43@18:22` | C01 | auto_matched | refunded | goodsReturnedAt `D-38@11:00`, refundedAt `D-37@09:15`, `returnTrackingNumber` `SEEDRET9000000000001` |
| W2 | WR-2026-90002 | O05 | `D-14@22:47` | C05 | manually_matched (Zuordnung `D-13@09:00`) | partially_refunded | goodsReturnedAt `D-8@11:30`, refundedAt `D-7@10:05`, `affectedItemIds` [O05-L2] |
| W3 | WR-2026-90003 | O04 | `D-9@19:30` | C04 | auto_matched | goods_returned | goodsReturnedAt `D-2@11:15`, `returnTrackingNumber` `SEEDRET9000000000004`, refundDueAt `D+5@19:30` |
| W4 | WR-2026-90004 | – | `D-4@16:02` | C15 | needs_manual_match | received | – |
| W5 | WR-2026-90005 | O06 | `D-1@21:18` | C06 (`locale en`) | auto_matched | received | refundDueAt `D+13@21:18` |
| W6 | WR-2026-90006 | – | `D-1@23:05` | C15 | needs_manual_match | closed (`closeReason = duplicate`) | closedAt `D+0@08:40` |
| W7 | WR-2026-90007 | – | `D+0@03:12` | C23 | no_order | rejected | rejectedAt `D+0@08:45`, `closeNote` (unten), `spam.markedAt` `D+0@08:45` |

`refunded` (W1) folgt auf die Voll-Erstattung (Übergang O13), `partially_refunded` (W2) auf die Teil-Erstattung
(Übergang O14): Erstattung ausgeführt, der Widerruf betrifft nur einen Teil der Bestellung. `closed` (W6, Übergang W5):
dieselbe Erklärung wie W4 noch einmal abgeschickt, ohne Bestellung – deshalb ändert das Abschließen keine Bestellung (O20
greift nur bei zugeordneten Widerrufen). `rejected` (W7, Übergang W7): offensichtliche Test-Eingabe, manuell abgelehnt und
als Test/Spam markiert (`spam.reason` „Offensichtliche Testeingabe ohne Vertragsbezug.“); `retainUntil` = `spam.markedAt` +
30 Tage (L-08), bei kanonischem `N` also noch vorhanden. `retainUntil` von W6 = Ende des Eingangsjahres + 6 Jahre (nicht
zugeordnet, L-08). Beide sind Endzustände und zählen nicht zu den offenen Widerrufen (§17).

Texte (unveränderliche Felder, so wie abgesendet):

| Key | `contractIdentification` | `itemsText` | `reason` | `adminNotes` |
|---|---|---|---|---|
| W1 | Bestellung PC-2026-90001 vom {{date:D-50}} | Teller „Hasen-Reigen“ | – | – |
| W2 | Ich habe letzte Woche zwei Sachen bestellt, ein Shirt und ein Schälchen. | Nur das runde Schmetterlings-Schälchen, das Shirt behalte ich. | Passt farblich doch nicht zu meinem Regal. | Über E-Mail-Adresse und Stück manuell PC-2026-90005 zugeordnet. |
| W3 | PC-2026-90004 | graue Cap | – | Vorkasse-Bestellung: Erstattung per Überweisung. Kontoverbindung per Mail erfragt, nicht im System speichern. |
| W4 | Hab bei dir auf dem Flohmarkt eine Tasse gekauft, die möchte ich zurückgeben. | Tasse mit Hund | – | Kauf auf dem Flohmarkt, keine Bestellung im Shop gefunden. Rudi per Mail antworten. |
| W5 | Order PC-2026-90006 | Dress “Bunny Border” | Lovely dress, but too long for me. | – |
| W6 | Wie schon geschrieben: Die Tasse vom Flohmarkt möchte ich zurückgeben. | Tasse mit Hund | – | Doppelt abgeschickt, gleiche Erklärung wie WR-2026-90004; Antwort läuft dort. |
| W7 | test | test | – | – |

`closeNote` W7: „Test-Eingabe ohne Vertragsbezug (Name und Text ‚test‘), nicht als Widerruf gemeint.“

---

## 10a. Reklamationen (`complaints`, 4)

Reklamationsakten laut DATENMODELL §6.29 (Collection ab P6, Seed-Daten ab P8). Je ein Wert aus `COMPLAINT_STATUSES`, nur
an bezahlten Bestellungen und immer nach Versand bzw. Übergabe. Berechnete Felder setzt der Hook wie sonst:
`carrierClaimDueAt` = (Zustellung, sonst `receivedAt`) + 7 Tage nur bei `transport_damage`; `warrantyEndsAt` = Zustellung
bzw. Übergabe + 2 Jahre, + 12 Monate bei `customerChoice = repair` (R-110, R-111), leer ohne erfasste Zustellung. Die Mails
M12/M13 stehen nur im `email-log` (§16.1); der Seed verschickt nichts. Keine Reklamation hat eine Erstattung ausgelöst –
Bestellstatus, `refunds[]` und Belege (§7, §9) bleiben unverändert. Aufbewahrung wie die Bestellung (L-09).

| Key | Bestellung | Position | `kind` | `receivedAt` | `status` | `remedy` | weitere Felder |
|---|---|---|---|---|---|---|---|
| RK1 | O10 (versendet) | O10-L1 (S02) | transport_damage | `D-1@19:05` | open | – | `photos` [`RK1:photo-1`]; `carrierClaimDueAt` `D+6@19:05` (keine Zustellung erfasst, daher ab `receivedAt`); `warrantyEndsAt` leer |
| RK2 | O05 | O05-L1 (S10) | defect | `D-6@20:30` | waiting_customer | repair | `photos` [`RK2:photo-1`]; `repairChoiceSentAt` `D-3@10:00` (M12); `customerChoice` leer; `warrantyEndsAt` = deliveredAt `D-19@10:20` + 2 Jahre |
| RK3 | O02 (abgeholt) | O02-L1 (S19) | defect | `D-30@11:00` | resolved | repair | `repairChoiceSentAt` `D-29@09:30` (M12); `customerChoice` repair, `customerChoiceAt` `D-28@18:10`; `warrantyEndsAt` = pickedUpAt `D-36@17:00` + 3 Jahre (2 Jahre + 12 Monate) |
| RK4 | O06 (`locale en`) | O06-L1 (S13) | defect | `D-5@09:40` | rejected | none | `vsbgNoticeSentAt` `D-4@11:00` (M13, englisch); `warrantyEndsAt` = deliveredAt `D-8@13:05` + 2 Jahre |

| Key | `description` (so, wie die Kund:in es geschrieben hat) | `notes` |
|---|---|---|
| RK1 | Die Schale kam mit einem Sprung am Rand an, der Karton war außen eingedrückt. | Foto kam per Mail. Bei DHL bis {{date:D+6}} reklamieren; danach Erstattung anbieten (Unikat, kein Ersatz möglich). |
| RK2 | Nach der ersten Wäsche (30 °C, auf links) ist die Farbe an einem Hasen auf der Schulter verblasst. | Nachmalen angeboten; Mail „Reparatur oder Ersatz“ verschickt, Antwort offen. Ersatz geht bei einem Unikat nicht. |
| RK3 | Kleiner grauer Fleck am unteren Rand, beim Abholen nicht aufgefallen. | Kundin hat Reparatur gewählt. Blatt am {{date:D-24}} zurückgebracht, Fleck ausgebessert, am {{date:D-21}} wieder abgeholt. |
| RK4 | The dress is much longer than I expected. | Kein Mangel: Die Länge (98 cm) steht in den Maßen der Produktseite. Hinweis auf das Widerrufsrecht per Mail, Streitbeilegungshinweis verschickt. Widerruf kam am {{date:D-1}} (WR-2026-90005). |

---

## 11. Anfragen (`inquiries`, 7)

`privacyNoticeVersion` = aktive Datenschutz-v1; `deleteAfter = createdAt + 6 Monate` (L-10, unabhängig vom
Bearbeitungsstand; `lastActivityAt` dient nur der Anzeige). Keine Fotos von Personen, keine Gesundheitsangaben;
Referenzbild nur bei A2 (erzeugte Skizze, §4.4, `status = attached`, `relatedInquiry` A2). Jeder Wert aus
`INQUIRY_STATUSES` kommt genau einmal vor; die Übergänge dorthin sind die aus KONZEPT §5.5. Keine Keramik mit
Lebensmittelkontakt als Auftrag (E-15).

| Key | Referenz | Name | `locale` | `objectType` | `status` | createdAt | `lastActivityAt` |
|---|---|---|---|---|---|---|---|
| A1 | AA-2026-9001 | C16 Casey Example | en | textil_sonstiges | declined | `D-40@16:20` | `D-38@10:00` |
| A2 | AA-2026-9002 | C17 Felix Fantasie | de | teller | accepted | `D-16@09:12` | `D-5@19:20` |
| A3 | AA-2026-9003 | C18 Nora Nirgends | de | cap | completed | `D-11@13:05` | `D-2@16:30` |
| A4 | AA-2026-9004 | C19 Jana Jedermann | de | cap | new | `D-1@08:30` | `D-1@08:30` |
| A5 | AA-2026-9005 | C20 Emil Erdacht | de | fliese | offer_sent | `D-1@12:40` | `D+0@09:15` |
| A6 | AA-2026-9006 | C21 Robin Specimen | en | zeichnung | in_progress | `D-1@18:40` | `D+0@08:50` |
| A7 | AA-2026-9007 | C22 Zoe Zufall | de | shirt | closed | `D-1@20:10` | `D+0@08:55` |

| Key | `idea` | `desiredTimeframe` | `budget` | `adminNotes` |
|---|---|---|---|---|
| A1 | Could you paint a well-known cartoon character on my denim jacket? The famous one with the big round ears. | before Christmas | around 150 € | Abgelehnt: fremde Figur (E-18). Eigene Figur mit großen Ohren angeboten, keine Antwort. |
| A2 | Wir heiraten im Frühling! Hättest du Lust, einen Teller mit zwei Hasen zu bemalen, die sich an den Pfoten halten? Gern mit unserem Datum am Rand. | bis Ende März | ca. 90 € | Angebot per Mail: Ø 24 cm, 95 €, fertig ca. 4 Wochen nach Zusage. Zusage per Mail am {{date:D-5}}; bezahlt wird per Überweisung nach Fertigstellung. |
| A3 | Ich hätte gern eine Cap mit einem kleinen Planeten und dem Namen unserer Katze „Mo“ auf dem Schirm. | im November | – | Angebot 85 € angenommen, Bezahlung per Überweisung außerhalb des Shops ist da. Cap am {{date:D-2}} per Post verschickt. |
| A4 | Hallo Jutta! Ich hätte so gern eine Cap mit unserem Dackel Bruno drauf – am liebsten schlafend, mit einem umgeklappten Ohr. Fotos von Bruno kann ich per Mail schicken. | zum Geburtstag im Dezember | – | – |
| A5 | Kannst du eine Fliese mit einem kleinen Fuchs bemalen, der aus einem Fenster guckt? Die soll bei uns in den Flur. | bis Mitte Dezember | ca. 60 € | Angebot per Mail: Fliese 15 × 15 cm mit Fuchs im Fenster, 65 €, fertig ca. 3 Wochen nach Zusage. |
| A6 | Could you draw our two cats as tiny astronauts floating around a planet? Ink would be lovely, about A5. | no rush | – | Rückfrage per Mail: Fellfarben der Katzen und ob gerahmt oder ungerahmt. |
| A7 | Kannst du mir ein T-Shirt mit einem kleinen Planeten auf der Brusttasche bemalen? Größe M. | bis Samstag | ca. 50 € | Am nächsten Morgen per Mail abgesagt (Geschenk hat sich erledigt); ohne Auftrag geschlossen. |

---

## 11a. Datenschutz-Anfragen (`privacy-requests`, 5)

Felder laut DATENMODELL §6.26, Ablauf laut LOESCHKONZEPT §5 (Logik ab P6, Seed-Daten ab P8). Je ein Wert aus
`PRIVACY_REQUEST_STATUSES`. `receivedAt` ist der Tag des Zugangs (Berliner Datum). `dueAt` (= `receivedAt` + 1 Monat,
kalendergenau) und `retainUntil` (bei `answered`/`rejected`: Ende des Jahres von `answeredAt` + 3 Jahre, L-17) rechnet der
Hook. Bei kanonischem `N` ist noch keine Erinnerung fällig (`remindersSent = {}`); `privacyRequestsDeadlineReminder`
überspringt Beispieldaten ohnehin (`seed = true`, DATENMODELL §11) und verschickt nach dem Seed also nichts. Der Seed legt **keine Exportdatei** an: Die einzige beantwortete Auskunft (DS1) liegt
mehr als 30 Tage zurück, ihre Datei wäre nach L-17 schon gelöscht (`exportFile` leer). `deletion-log` hat kein Seed-Flag;
der Seed schreibt dort nichts (DATENMODELL §6.27). Keine Anfrage hat bisher eine Löschung oder Einschränkung ausgeführt –
`privacy.*` an Bestellungen und Widerrufen bleibt unverändert.

| Key | Referenz | `types` | `channel` | Person | `locale` | `receivedAt` (→ `dueAt` bei kanonischem `N`) | `status` | Identität | weitere Felder |
|---|---|---|---|---|---|---|---|---|---|
| DS1 | DS-2026-9001 | access | email | C01 | de | `D-36` (→ `D-6`) | answered | `identityVerified` true, `identityMethod` `stored_email`, `identityVerifiedAt` `D-36@10:00` | `matchedOrders` [O01], `matchedWithdrawals` [W1]; `answeredAt` `D-33@17:00` (M14); `exportFile` leer |
| DS2 | DS-2026-9002 | erasure | instagram_dm | C24 | de | `D-25` (→ `D+5`) | rejected | `identityVerified` false, `identityMethod` `other` | `answeredAt` `D-10@10:00`; `resultNote` unten |
| DS3 | DS-2026-9003 | erasure | email | C08 | de | `D-5` (→ `D+26`) | in_progress | `identityVerified` true, `stored_email`, `identityVerifiedAt` `D-5@11:20` | `matchedOrders` [O08]; `adminNotes` unten |
| DS4 | DS-2026-9004 | access | letter | C15 | de | `D-2` (→ `D+29`) | identity_check | `identityVerified` false, `identityMethod` `stored_email` (Bestätigung angefragt) | `matchedWithdrawals` [W4, W6]; `adminNotes` unten |
| DS5 | DS-2026-9005 | access | email | C14 | en | `D+0` (→ `D+31`) | received | `identityVerified` false | – |

`contactName`/`contactEmail` = Name und E-Mail der Person aus §6. Texte:

- **DS2** `resultNote`: „Abgelehnt: Die Nachricht bat darum, die Daten einer anderen Person zu löschen. Eine Vollmacht haben
  wir am {{date:D-25}} erbeten; bis {{date:D-11}} kam keine. Ohne Nachweis dürfen wir für diese Person nichts löschen und
  keine Auskunft geben (Art. 12 Abs. 6 DSGVO). Antwort per E-Mail mit Begründung, dem Hinweis, dass sich die betroffene
  Person selbst melden kann, und dem Beschwerderecht bei der Berliner Beauftragten für Datenschutz und
  Informationsfreiheit. Keine Daten herausgegeben, nichts gelöscht.“ `adminNotes`: „Kam per Instagram-Nachricht; auf
  E-Mail verwiesen (LOESCHKONZEPT §5.1).“
- **DS3** `adminNotes`: „Bestellung PC-2026-90008 mit Rechnung und Gutschrift: Belege bleiben bis Fristende (L-06), die
  Bestellung wird eingeschränkt statt gelöscht (L-05, LOESCHKONZEPT §5.6). Antwort M15 nach der Umsetzung.“
- **DS4** `adminNotes`: „Brief ohne Nachweis, dass er von der Person hinter der gespeicherten Adresse kommt: Bestätigung
  über die gespeicherte E-Mail-Adresse erbeten (LOESCHKONZEPT §5.2). Treffer: zwei Widerrufserklärungen ohne Bestellung.“

---

## 12. Tattoo

### 12.1 Flash (`flash`, 10)

Nur eigene Motive. Anzeige-Nummer `F-<number>`; `published = true`; `sortOrder` = 10 × Position; Preise sind
Gesamtpreise (Festpreis, E-53).

| Key | `number` | Titel DE / EN | `sizeCm` | `sizeNote` DE / EN | Preis | `repeatable` | `status` / `claimedAt` | `image` |
|---|---|---|---|---|---|---|---|---|
| F901 | 901 | Kelch mit Schlange / Chalice with snake | 9 | – | 12000 | false | available | ig:DbJ1QRrjCcb |
| F902 | 902 | Hasen-Trio / Bunny trio | 6 | Größe anpassbar / size adjustable | 9000 | true | available | ph:flash-902 |
| F903 | 903 | Fuchs mit Kulleraugen / Googly-eyed fox | 7 | – | 11000 | false | claimed `D-12@15:00` | ph:flash-903 |
| F904 | 904 | Schmetterling mit Tupfen / Spotted butterfly | 9 | – | 14000 | false | available | ph:flash-904 |
| F905 | 905 | Schnecke mit Planetenhaus / Snail with a planet shell | 8 | – | 13000 | false | claimed `D-26@13:00` | ph:flash-905 |
| F906 | 906 | Coco sitzt / Coco sitting | 5 | Größe anpassbar / size adjustable | 8000 | true | available | ph:flash-906 |
| F907 | 907 | Winziger Planet / Tiny planet | 3 | – | 8000 | true | available | ph:flash-907 |
| F908 | 908 | Reh mit Tupfen / Spotted deer | 10 | – | 16000 | false | available | ph:flash-908 |
| F909 | 909 | Flammenwesen / Flame creature | 12 | – | 22000 | false | available | ph:flash-909 |
| F910 | 910 | Herz mit Beinen / Heart with legs | 4 | – | 8000 | true | available | ph:flash-910 |

Mail-Betreff (KONZEPT §9.4) z. B. `Flash-Anfrage F-907 – Winziger Planet` / `Flash request F-907 – Tiny planet`.

### 12.2 Angebote (entfallen, P12.7)

„Angebote“ (frühere TO1–TO3) gibt es nicht mehr (U-14). Die Nummer 12.2 bleibt unbelegt.

### 12.3 Galerie (`tattoo-gallery`, 6)

| Key | `image` | `kind` | `healedDurationMonths` / `healedLabel` DE / EN | `placement` DE / EN | `flash` | `showsCustomer` | `consentGiven` | `published` | `featured` | `sortOrder` |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | ig:DOZTG7PjLAD | healed | 42 / „3,5 Jahre verheilt“ / “3.5 years healed” | Unterarm / forearm | – | true | **false** | true (Seed-Ausnahme) | true | 10 |
| G2 | ig:DZqBCSZDDiE | fresh | – | Wade / calf | – | true | **false** | true (Seed-Ausnahme) | false | 20 |
| G3 | ph:tattoo-01 | fresh | – | Knöchel / ankle | F902 | false | false | true | false | 30 |
| G4 | ph:tattoo-02 | healed | 12 / – | Handgelenk / wrist | F907 | false | false | true | true | 40 |
| G5 | ph:tattoo-03 | fresh | – | Oberarm / upper arm | F906 | false | false | true | false | 50 |
| G6 | ph:tattoo-04 | healed | 8 / – | Schienbein / shin | F910 | false | false | true | false | 60 |

`caption`: G1 DE „Fine Line am Unterarm, ein paar Jahre später“ · EN “Fine line on a forearm, a few years later” — G2 DE
und EN = `title_de` von `post-DZqBCSZDDiE.jpg` aus dem Manifest, unverändert (Juttas eigene Bildunterschrift; enthält
einen fremden Figurennamen → genau ein Allowlist-Eintrag für `tattoo.json`; Portfolio, keine Verkaufsware, E-18, R-047;
offen: SE-04) — G3 „Hasen-Trio, frisch gestochen“ /
“Bunny trio, freshly done” — G4 „Winziger Planet, ein Jahr später“ / “Tiny planet, one year on” — G5 „Coco sitzt – jetzt
für immer“ / “Coco sitting – now forever” — G6 „Herz mit Beinen, acht Monate später“ / “Heart with legs, eight months on”.

Sichtbarkeit: G1/G2 zeigen Haut von Kund:innen (Manifest `consentRequired: true`, `consentGiven = false`). Öffentlich
**nur** bei `SEED_PREVIEW_MODE = 'true'` und `APP_ENV ≠ production` (KONZEPT §9.7, DATENMODELL §6.16, R-172, R-181), nie in
Produktion; ihre Medien bleiben `restricted = true` und werden sonst mit 404 ausgeliefert. Die Vorschau-Datei versieht
beide mit dem Etikett „intern – Einwilligung fehlt“ und wird nur im privaten Repository verteilt (R-182, KA-21,
Kanzleifrage K-34; SE-03). Adopt von G1/G2 nur mit echter Einwilligung; beim Entfernen der Beispieldaten werden sie immer
gelöscht (§18).

### 12.4 Preise

Kommen aus `settings.tattoo` (§3.1): Mindestpreis 80 €, eigene Ideen meist 150–400 €. Text im Block `priceInfo` (§13.5).

### 12.5 Termine „Planet Claire on Tour“ (`tour-dates`, 8)

Fiktive Märkte in Berlin (Straßen heißen „Beispiel…“), `published = true`, ohne Link und Foto; Datum relativ zu `N`, ganze Berliner Tage (Beginn 00:00, Ende 23:59:59). „vorbei“ ergibt sich aus dem Datum, `cancelled` ist abgesagt. Alle Texte DE und EN.

| Key | `name` DE / EN | `startsAt` → `endsAt` | `status` | Zustand (kanonisch) | `place` | `address` · Stand · Zeit | `note` DE / EN |
|---|---|---|---|---|---|---|---|
| TD1 | Hinterhof-Flohmarkt Nord / Backyard flea market North | `D-52` → `D-52` | planned | vorbei | Berlin-Wedding | Hof der Alten Bäckerei, Beispielweg 3 · B12 · 10:00–17:00 | Coco war dabei und hat alle Tüten bewacht. / Coco came along and guarded all the bags. |
| TD2 | Sommerflohmarkt am Kanal / Summer flea market by the canal | `D-24` → `D-23` | planned | vorbei | Berlin-Neukölln | Uferweg am Beispielkanal · Platz 27 · 11:00–18:00 | – |
| TD3 | Kunstmarkt in der Remise / Art market in the carriage house | `D-10` → `D-10` | cancelled | abgesagt, vorbei | Berlin-Friedrichshain | Remise Beispielhof, Beispielallee 8 · A4 · 12:00–19:00 | Fällt leider aus. / Sadly cancelled. |
| TD4 | Herbstmarkt der Hinterhöfe / Autumn market of the backyards | `D-1` → `D+1` | planned | läuft gerade | Berlin-Kreuzberg | Innenhof am Beispielplatz 1 · H7 · 10:00–18:00 | Drei Tage, viele kleine Stände, Coco ist dabei. / Three days, many small stalls, Coco is coming along. |
| TD5 | Design- und Zeichenmarkt / Design and drawing market | `D+9` → `D+9` | planned | kommt | Berlin-Prenzlauer Berg | Bürgersaal Beispielstraße 10 · D3 · 11:00–17:30 | Neue Zeichnungen im Gepäck. / With new drawings in my bag. |
| TD6 | Flohmarkt auf dem Parkdeck / Flea market on the car park roof | `D+16` → `D+16` | cancelled | abgesagt, kommt | Berlin-Schöneberg | Parkdeck Beispielring · C21 · 10:00–16:00 | Der Markt wurde vom Veranstalter abgesagt. / The organiser has cancelled this market. |
| TD7 | Winter-Kunstmarkt in der Schalterhalle / Winter art market in the ticket hall | `D+37` → `D+38` | planned | kommt | Berlin-Mitte | Alte Schalterhalle, Beispieldamm 2 · S9 · 11:00–19:00 | – |
| TD8 | Markt der kleinen Läden / Market of the little shops | `D+58` → `D+58` | planned | kommt | Berlin-Charlottenburg | – · – · 12:00–18:00 | Ort und Stand folgen. / Place and stall to follow. |

Sichtbar: alle acht; die kommenden (TD4–TD8) oben (TD6 durchgestrichen), die vergangenen (TD1–TD3) eingeklappt (AK-SEED-23).

---

## 13. Seiten (`pages`, 13)

Alle Seiten `_status = published`, `seed = true`. Texte sind Entwürfe in Juttas Ton (E-62); Jutta übernimmt sie durch
Bearbeiten (adopt). Link-Felder nach `internalLinkFields()`.

### 13.1 `home` – Titel „Startseite“ / “Home”

Reihenfolge fest (KONZEPT AK-3-01): `hero` + 7 `station`-Blöcke. Stationsbilder sind Code-Assets
(`src/art/stations/{stationId}.svg`, DESIGN §12.4) → Feld `image` bleibt leer.

| # | Block | `stationId` | `heading` DE / EN | `cocoPose` | `ornament` | `link` (`target` · Label DE / EN) |
|---|---|---|---|---|---|---|
| 0 | hero | – | Tattoos & handgemachte Unikate aus Berlin / Tattoos & handmade one-offs from Berlin | run | – | – |
| 1 | station | `hallo` | Hallo! / Hi! | sit | star | – |
| 2 | station | `keramik` | Keramik / Ceramics | sniff | planet | category `keramik` · Alle Keramik / All ceramics |
| 3 | station | `textil` | Textil & Caps / Textiles & caps | sniff | star | category `textil` · Alle Textilien / All textiles |
| 4 | station | `zeichnungen` | Zeichnungen / Drawings | sit | none | category `zeichnung` · Alle Zeichnungen / All drawings |
| 5 | station | `schmuck` | Schmuck / Jewellery | jump | none | category `schmuck` · Zum Schmuck / See the jewellery |
| 6 | station | `tattoo` | Tattoo / Tattoo | head_tilt | planet | tattoo · Zum Tattoo-Bereich / Go to tattoos |
| 7 | station | `jutta-und-coco` | Jutta & Coco / Jutta & Coco | sit | star | about · Mehr über uns / More about us |

Texte (`subheading` bzw. `text`, ≤ 400 Zeichen):

| # | DE | EN |
|---|---|---|
| 0 | Fine-Line-Tattoos, bemalte Keramik, Caps und Shirts, Tusche auf Papier – alles von Hand, alles nur einmal. Coco passt auf. | Fine line tattoos, painted ceramics, caps and shirts, ink on paper – all by hand, each one only once. Coco keeps an eye on things. |
| 1 | Ich bin Jutta. Ich zeichne Tiere mit Kulleraugen – auf Haut, auf Ton, auf Stoff und auf Papier. Und das ist Coco. Sie rennt schon mal vor. | I'm Jutta. I draw animals with googly eyes – on skin, clay, fabric and paper. And that's Coco. She's already running ahead. |
| 2 | Schalen, Tellerchen, Fliesen – gekniffen, gedreht, bemalt. Jede Form ist ein bisschen schief, genau so soll sie sein. Alles Deko, nicht für Essen. | Bowls, little plates, tiles – pinched, shaped, painted. Every piece is a little wonky, exactly as it should be. All decorative, not for food. |
| 3 | Second-Hand-Shirts, Kleider und Caps, von Hand bemalt. Jedes Teil gibt's genau einmal – in genau einer Größe. | Second-hand shirts, dresses and caps, painted by hand. Every piece exists exactly once – in exactly one size. |
| 4 | Tusche, Aquarell, Skizzenbuchseiten. Hier fängt eigentlich alles an. | Ink, watercolour, sketchbook pages. This is where it all starts, really. |
| 5 | Winzige Anhänger aus Keramik: Füchse, Planeten, Rehköpfchen. Klein genug für die Hosentasche, groß genug für gute Laune. | Tiny ceramic pendants: foxes, planets, little deer. Small enough for your pocket, big enough for a good mood. |
| 6 | Fine Line, naiv, mit Humor. Flash mit Festpreis oder deine eigene Idee – Anfragen per Mail, gestochen wird im Privatstudio in Berlin. | Fine line, naive, with a sense of humour. Flash with fixed prices or your own idea – ask by email, tattooed in a private studio in Berlin. |
| 7 | Werkstatt unter der Woche, Flohmarkt am Wochenende, Coco immer dabei. Und falls du eine eigene Idee hast: Auftragsarbeiten gehen auch. | Workshop during the week, flea market at the weekend, Coco always along. And if you've got your own idea: commissions are possible too. |

### 13.2 `about` – „Jutta & Coco“ / “Jutta & Coco”

**Gekürzt nach U-48 (P13.9, 08.10.2026):** Es bleiben die Überschrift (Seitentitel, darunter die feste Einleitung aus
den Sprachdateien), das von Jutta freigegebene Foto von Jutta und Coco mit dem Text „Zu zweit“ und darunter „Sag
etwas“. Gelöscht sind „Ich bin Jutta …/Hier ist Planet Claire“, „Die zittrige Linie“, der Coco-Absatz mit gezeichneter
Coco, die drei Bilder (ig:DcrENrOjlGP, ig:Dav1kUkDgR7, ig:DblvrTRiUqi) und „Wo ich zeichne“ mit den Kategorie-Aufrufen;
die Bilder bleiben als Produktfotos im Bestand. Kein Band-Name, keine Liedzeilen; Fotos von Jutta nur mit
`ownerApproved` (R-181).

| # | Block | Inhalt |
|---|---|---|
| 1 | imageText (`image` own:jutta-coco, `imagePosition` left) | „Zu zweit“ / “The two of us” (Text in `content/seed/data/pages.json`) |
| 2 | contactLinks (`heading` „Sag etwas“ / “Say something”, `emailSubject` „Hallo Jutta“ / “Hello Jutta”) | – |

Bestehende Datenbanken: Ein erneuter Lauf von `pnpm seed` (bzw. `seed:example`) ersetzt das Layout der Seed-Seite
`about` (Inhaltsgruppe, SEED-SPEC §1.3); eine von Jutta übernommene Seite (`seed = false`) bleibt unverändert – dort
löscht sie die Abschnitte in der Verwaltung (Seiten → Über mich).

### 13.3 `contact` – „Kontakt“ / “Contact”

| # | Block | Inhalt DE / EN |
|---|---|---|
| 1 | richText | Am schnellsten erreichst du mich per Mail. / The quickest way to reach me is by email. |
| 2 | contactLinks | `heading` „Schreib mir“ / “Write to me”, alle `show*` an, `emailSubject` „Hallo Jutta“ / “Hi Jutta” |
| 3 | callout (`tone` info) | Frage zu einer Bestellung? Nenn bitte deine Bestellnummer. Tattoo-Anfragen bitte per Mail, eigene Ideen für Keramik und Co. über das Formular bei den Auftragsarbeiten. / Question about an order? Please include your order number. Tattoo requests by email, please; custom ideas for ceramics and more via the commissions form. |
| 4 | faqList | `category` shop, `heading` „Shop“ / “Shop” |
| 5 | faqList | `category` shipping, `heading` „Versand“ / “Shipping” |

### 13.4 `commissions` – „Auftragsarbeiten“ / “Commissions”

| # | Block | Inhalt |
|---|---|---|
| 1 | processSteps | `heading` „So läuft's“ / “How it works”; Schritte unten |
| 2 | imageGallery | ig:DcT7ErBDsWi, ig:DdUPhoZOoMW, ig:DaDz8yljp3i, ig:Da2WrEgDpC_#pendant; `caption` „Solche Sachen mache ich – deins wird anders.“ / “This is the kind of thing I make – yours will be different.” |
| 3 | callout (`tone` hint) | Auftragsarbeiten vereinbaren wir einzeln per Mail, bezahlt wird nicht hier im Shop. Fremde Figuren aus Comics, Filmen oder von Marken male ich nicht. / Commissions are agreed individually by email; payment doesn't go through this shop. I don't paint characters from comics, films or brands. |
| 4 | commissionForm | `heading` „Deine Idee“ / “Your idea”; `intro` „Erzähl mir, was du dir vorstellst. Bitte keine Fotos von Personen und keine Gesundheitsinfos.“ / “Tell me what you have in mind. Please no photos of people and no health information.”; `successText` „Danke! Deine Anfrage ist angekommen, die Referenz steht in deiner Bestätigungsmail. Ich melde mich per Mail.“ / “Thank you! Your request has arrived – the reference is in your confirmation email. I'll get back to you by email.” |
| 5 | faqList | `category` commissions |

Schritte (`title` / `text`): 1 „Anfrage“ / “Request” – „Schick mir über das Formular, was du dir wünschst: Gegenstand, Motiv, Zeitraum.“ / “Use the form to tell me what you'd like: object, motif, timeframe.” · 2 „Angebot“ / “Offer” – „Ich antworte per Mail mit Preis und ungefährer Dauer.“ / “I'll reply by email with a price and a rough timeframe.” · 3 „Bezahlung“ / “Payment” – „Passt alles, überweist du außerhalb des Shops.“ / “If it all works for you, you pay by bank transfer outside the shop.” · 4 „Anfertigung“ / “Making it” – „Ich male, schicke dir ein Foto, dann geht dein Stück auf die Reise.“ / “I paint, send you a photo, and then your piece is on its way.”

### 13.5 `tattoo` – „Tattoo“ / “Tattoo”

Die Unterseiten R12–R18 nutzen die Blöcke dieser Seite nach Typ (Flash → `flashGrid`, Preise →
`priceInfo`, Galerie → `tattooGallery`, Ablauf → `processSteps`, FAQ → `faqList`) (SE-09).

| # | Block | Inhalt |
|---|---|---|
| 1 | richText | Mein Stil (unten) |
| 2 | flashGrid | `heading` „Flash“ / “Flash”; `showClaimed` true |
| 3 | tattooGallery | `heading` „Fresh & healed“; `filter` all; `limit` 12 |
| 4 | priceInfo | `heading` „Preise“ / “Prices”; `content` DE „Jedes Flash-Motiv hat einen Festpreis, der direkt am Motiv steht. Für eigene Ideen findest du oben meinen Preisrahmen. Die Anzahlung besprechen wir persönlich per Mail – auf dieser Website zahlst du nichts.“ · EN “Every flash design has a fixed price shown right next to it. For custom ideas you'll find my price range above. We'll sort out the deposit personally by email – you don't pay anything on this website.” |
| 5 | processSteps | `heading` „Ablauf“ / “How it works”; 5 Schritte unten |
| 6 | callout (`tone` hint) | Tattoos erst ab 18. / Tattoos for 18+ only. |
| 7 | faqList | `category` tattoo, `heading` „FAQ“ |
| 8 | contactLinks | `heading` „Anfrage per Mail“ / “Request by email”; `emailSubject` „Tattoo-Anfrage“ / “Tattoo request” |

- **Mein Stil DE:** Fine Line, naiv, mit Humor. Ich steche am liebsten kleine Tiere mit Kulleraugen, Figuren mit zittriger Linie und Motive, die ein bisschen schief gucken. Schwarz, fein und so, dass es zu dir passt.
- **Mein Stil EN:** Fine line, naive, with a sense of humour. My favourite things to tattoo are small animals with googly eyes, figures with a shaky line and designs that look at you slightly sideways. Black, fine, and made to suit you.

Ablauf (KONZEPT R16): 1 „Anfrage“ / “Request” – „Schreib mir per Mail: Idee oder Flash-Nummer, Stelle am Körper, ungefähre Größe.“ / “Email me: your idea or the flash number, placement, rough size.” · 2 „Termin“ / “Appointment” – „Wir finden einen Tag. Die genaue Adresse bekommst du mit der Bestätigung.“ / “We find a date. You'll get the exact address with the confirmation.” · 3 „Anzahlung“ / “Deposit” – „Klären wir persönlich per Mail, nicht hier auf der Website.“ / “We sort that out personally by email, not on this website.” · 4 „Stechen“ / “Tattooing” – „Bring deinen Ausweis mit, komm ausgeschlafen und mit etwas im Bauch. Coco schläft meistens nebenan.“ / “Bring your ID, come well rested and with something in your stomach. Coco is usually asleep next door.” · 5 „Aftercare“ – „Du bekommst die Pflegeschritte mit, alles steht auch auf der Aftercare-Seite.“ / “You'll get the aftercare steps to take home, and everything's on the aftercare page too.”

### 13.6 `tattoo_aftercare` – „Aftercare“ / “Aftercare”

Entwurf, von Jutta an ihre eigene Methode anzupassen (Folie/Second Skin ist eine Annahme aus der Recherche, SE-07).
Keine Heilversprechen (V-15). Druckfreundlich (KONZEPT R17).

| # | Block | Inhalt |
|---|---|---|
| 1 | richText | DE „Ein frisches Tattoo ist eine kleine Wunde. Mit diesen Schritten heilt es in Ruhe – und wenn du unsicher bist, schreib mir.“ · EN “A fresh tattoo is a small wound. These steps help it heal in peace – and if you're unsure, just message me.” |
| 2 | aftercareSteps | `heading` „Pflege in Phasen“ / “Aftercare step by step”; 5 Phasen unten; `pdf` leer |
| 3 | callout (`tone` hint) | Warnzeichen (unten) |
| 4 | richText | DE „Mehr zum Nachlesen: [Safer-Tattoo-Checklisten des Bundesumweltministeriums](https://www.bundesumweltministerium.de/safer-tattoo)“ · EN “Further reading (in German): [Safer Tattoo checklists by the German Environment Ministry](https://www.bundesumweltministerium.de/safer-tattoo)” |
| 5 | faqList | `category` aftercare |

Phasen (`title` / `content`):
1. **Direkt danach / Right after** — DE: Ich verpacke dein Tattoo mit Folie. Wie lange sie drauf bleibt, sage ich dir beim Termin. Sammelt sich darunter etwas Flüssigkeit, ist das normal. · EN: I'll cover your tattoo with film. I'll tell you at the appointment how long to leave it on. A little fluid collecting underneath is normal.
2. **Tag 1–3 / Days 1–3** — DE: Vor dem Anfassen Hände waschen. Nach dem Abnehmen der Folie lauwarm mit milder, parfümfreier Seife waschen und trocken tupfen. Dünn eincremen – weniger ist mehr. · EN: Wash your hands before touching it. After removing the film, wash with lukewarm water and a mild, unscented soap and pat dry. Apply a thin layer of cream – less is more.
3. **Woche 1–2 / Weeks 1–2** — DE: Es schuppt und juckt – nicht kratzen, nicht pulen. Kein Schwimmbad, keine Sauna, kein Solarium, keine pralle Sonne. Weite Kleidung über dem Tattoo. · EN: It will flake and itch – don't scratch or pick. No swimming pools, saunas, sunbeds or strong sun. Wear loose clothing over the tattoo.
4. **Woche 3–6 / Weeks 3–6** — DE: Die Oberfläche ist zu, darunter arbeitet die Haut noch. Weiter eincremen, weiter Sonne meiden. Sieht etwas ungleichmäßig aus, schick mir ein Foto – dann schauen wir, ob ein Nachstechen sinnvoll ist. · EN: The surface has closed, but the skin underneath is still working. Keep moisturising and keep avoiding the sun. If something looks patchy, send me a photo and we'll see whether a touch-up makes sense.
5. **Langfristig / Long term** — DE: Sonnenschutz mit hohem Lichtschutzfaktor, jedes Mal. Fine Line bleibt am schönsten, wenn die Sonne sie nicht zu oft erwischt. · EN: High-SPF sunscreen, every time. Fine line stays crisp for longest when the sun doesn't get to it too often.

Warnzeichen — DE: **Wann zur Ärztin oder zum Arzt?** Wenn die Rötung nach drei Tagen weiter zunimmt, die Stelle heiß wird
oder stark anschwillt, Eiter austritt, rote Streifen entstehen oder du Fieber bekommst. Sag mir danach gern Bescheid. ·
EN: **When to see a doctor?** If the redness keeps spreading after three days, the area gets hot or very swollen, pus
comes out, red streaks appear or you get a fever. Please let me know afterwards, too.

### 13.7 Übrige Seiten

| key | Titel DE / EN | Blöcke und Text DE / EN |
|---|---|---|
| `shop` | Shop / Shop | richText: Alles Unikate – jedes Stück gibt es genau einmal. Was weg ist, zieht mit „sold“-Stempel ins Archiv. / All one-offs – each piece exists exactly once. Once it's gone, it moves to the archive with a “sold” stamp. · categoryTeaser (`heading` „Stöbern“ / “Browse”, 5 Kategorien ohne `sonstiges`) |
| `archive` | Archiv / Archive | richText: Schon ausgezogen. Zum Gucken bleibt's hier – und wenn du etwas Ähnliches möchtest, frag nach einer Auftragsarbeit. / Already moved out. They stay here to look at – and if you'd like something similar, ask about a commission. |
| `conformity` | Konformitätserklärungen / Declarations of conformity | richText: Hier stehen die Konformitätserklärungen zu meinen Glasuren, sobald es welche gibt. Bis dahin ist jede Keramik im Shop ein Deko-Stück – nicht für Lebensmittel. / This is where the declarations of conformity for my glazes will go once there are any. Until then, every ceramic piece in the shop is decorative – not for food. |
| `withdrawal` | Vertrag widerrufen / Withdraw from contract | callout (`tone` info): Du bekommst nach dem Absenden sofort eine Eingangsbestätigung per Mail. / You'll get a confirmation of receipt by email right after sending. (Formular und Pflichttexte kommen aus dem Code/RECHT-Bausteinen, nicht aus dieser Seite.) |
| `order_status` | Bestellstatus / Order status | richText: Hier siehst du, wie weit deine Bestellung ist. Den Link hast du per Mail bekommen – bitte nicht weitergeben. / Here's how far along your order is. You got this link by email – please don't share it. |
| `thanks` | Danke! / Thank you! | richText: Coco macht einen Freudensprung. Deine Bestätigung ist per Mail unterwegs. / Coco is doing a happy jump. Your confirmation is on its way by email. |
| `not_found` | Seite nicht gefunden / Page not found | richText (Fließtext unter der festen H1 „Coco hat sich losgerissen“ / “Coco slipped her leash”, KONZEPT §3.17, DESIGN KO-18): Coco hat überall geschnüffelt – diese Seite gibt es nicht (mehr). [Zur Startseite](/) / Coco sniffed everywhere – this page doesn't exist (anymore). [Back to the start](/en) |

SEO-Felder bleiben leer (Fallback aus Titel), außer `home`: `seo.metaTitle` „Planet Claire – Tattoos & Unikate aus
Berlin“ / “Planet Claire – Tattoos & one-offs from Berlin”.

---

## 14. FAQ (`faqs`, 12)

`published = true`. Antworten als Klartext → `toLexical()` (§2.4). Die Aussagen sind Entwürfe in Juttas Ton (E-62) und
fachliche Annahmen (SE-07).

| Key | `category` | `sortOrder` | Frage DE | Question EN |
|---|---|---|---|---|
| FAQ01 | tattoo | 10 | Ab wie vielen Jahren tätowierst du? | How old do I need to be? |
| FAQ02 | tattoo | 20 | Wo ist dein Studio? | Where is your studio? |
| FAQ03 | tattoo | 30 | Brauche ich eine Anzahlung? | Do I need to pay a deposit? |
| FAQ04 | tattoo | 40 | Ich kann nicht zum Termin – was jetzt? | I can't make my appointment – what now? |
| FAQ05 | tattoo | 50 | Ist Coco beim Tätowieren dabei? | Is Coco around during the session? |
| FAQ06 | tattoo | 60 | Machst du auch Farbe? | Do you do colour? |
| FAQ07 | tattoo | 70 | Machst du Cover-ups? | Do you do cover-ups? |
| FAQ08 | tattoo | 80 | Wie frage ich ein Tattoo an? | How do I request a tattoo? |
| FAQ09 | aftercare | 10 | Wie lange dauert das Abheilen? | How long does healing take? |
| FAQ10 | shop | 10 | Warum steht bei der Keramik „Deko“? | Why is the ceramic labelled “decorative”? |
| FAQ11 | shipping | 10 | Wohin verschickst du, und was kostet der Versand? | Where do you ship, and what does shipping cost? |
| FAQ12 | commissions | 10 | Kann ich etwas Eigenes bestellen? | Can I order something custom? |

Antworten:
- **FAQ01** DE: Ab 18. Bring zum Termin bitte deinen Ausweis mit. · EN: 18 and up. Please bring your ID to the appointment.
- **FAQ02** DE: In meinem Privatstudio in Berlin. Den Bezirk findest du auf der Tattoo-Seite, die genaue Adresse schicke ich dir mit der Terminbestätigung. · EN: In my private studio in Berlin. You'll find the district on the tattoo page, and I'll send you the exact address with your appointment confirmation.
- **FAQ03** DE: Ja, für jeden Termin. Wie hoch und wie wir das machen, besprechen wir persönlich per Mail – online zahlst du hier nichts. · EN: Yes, for every appointment. We'll agree on the amount and how it works personally by email – you don't pay anything online here.
- **FAQ04** DE: Sag mir so früh wie möglich Bescheid, per Mail. Dann suchen wir einen neuen Termin. Was mit der Anzahlung passiert, haben wir vorher gemeinsam abgemacht. · EN: Let me know as early as you can by email, and we'll find a new date. What happens to the deposit is whatever we agreed on together beforehand.
- **FAQ05** DE: Coco ist oft im Studio, schläft aber meistens in ihrem Körbchen. Wenn du Hunde nicht verträgst oder lieber ohne sie bist, sag's mir vorher – dann hat sie an dem Tag frei. · EN: Coco is often in the studio, but she mostly naps in her basket. If dogs don't agree with you or you'd rather be without her, tell me beforehand – she'll take the day off.
- **FAQ06** DE: Mein Ding ist schwarze Fine Line. Kleine Farbtupfer gehen manchmal – frag einfach mit deiner Idee. · EN: My thing is black fine line. Small touches of colour sometimes work – just ask with your idea.
- **FAQ07** DE: Eher selten, weil feine Linien wenig abdecken. Schick mir ein Foto vom alten Tattoo per Mail, dann sag ich dir ehrlich, ob es passt. · EN: Rarely, because fine lines don't cover much. Email me a photo of the old tattoo and I'll tell you honestly whether it works.
- **FAQ08** DE: Schreib mir eine Mail. Dort geht nichts unter, und du kannst Bilder in Ruhe anhängen. Für Flash schick einfach die Nummer mit, zum Beispiel F-902. · EN: Send me an email. Nothing gets lost that way, and you can attach pictures easily. For flash, just include the number, for example F-902.
- **FAQ09** DE: Die Oberfläche ist meist nach zwei bis drei Wochen zu, ganz durch ist die Haut nach etwa vier bis sechs Wochen. Die Schritte stehen oben auf dieser Seite. · EN: The surface usually closes after two to three weeks; the skin is fully through after about four to six weeks. The steps are listed above on this page.
- **FAQ10** DE: Weil es für meine Glasuren noch keine Konformitätserklärung gibt. Bis dahin steht bei jedem Stück: Deko – nicht für Lebensmittel. Für Schlüssel, Ringe, Pinsel und Kleinkram sind sie super. · EN: Because there's no declaration of conformity for my glazes yet. Until then, every piece says: decorative – not for food. They're great for keys, rings, brushes and odds and ends.
- **FAQ11** DE: Zurzeit nur innerhalb Deutschlands. Was der Versand kostet, hängt vom Stück ab (Brief, kleines Paket oder Keramik-Paket) – im Warenkorb gilt immer die höchste Versandart. Alles Weitere steht unter Versand & Zahlung. Abholen in Berlin kostet nichts. · EN: Only within Germany for now. The shipping cost depends on the piece (letter, small parcel or ceramics parcel) – in the cart, the highest one applies. Details are on the Shipping & payment page. Pickup in Berlin is free.
- **FAQ12** DE: Ja! Eine Cap mit deinem Hund, ein Teller zur Hochzeit, eine Zeichnung – schreib mir über das Formular bei den Auftragsarbeiten. Ich antworte mit einem Angebot per Mail; bezahlt wird nicht über den Shop. Fremde Figuren aus Comics, Filmen oder von Marken male ich nicht. · EN: Yes! A cap with your dog, a plate for a wedding, a drawing – write to me via the form on the commissions page. I'll reply with an offer by email; payment doesn't go through the shop. I don't paint characters from comics, films or brands.

---

## 15. Umsätze (`revenue-entries`, 18)

Monate `M-9` … `M-1` (kanonisch 2026-01 … 2026-09). Beträge in Cent. Der Offline-Verkauf S06 (September) steckt in der
Flohmarkt-Summe von `M-1` und erzeugt keinen eigenen Umsatz (DATENMODELL §6.20).

| Monat | tattoo | flohmarkt | `note` flohmarkt |
|---|---|---|---|
| M-9 | 64000 | 0 | Winterpause |
| M-8 | 72000 | 0 | Winterpause |
| M-7 | 98000 | 18000 | – |
| M-6 | 115000 | 32000 | – |
| M-5 | 134000 | 46000 | – |
| M-4 | 152000 | 54000 | – |
| M-3 | 118000 | 61000 | – |
| M-2 | 96000 | 58000 | – |
| M-1 | 141000 | 39000 | – |
| Summe | 990000 | 308000 | – |

Mit dem Beispiel-Shopumsatz (§9) ergibt das ca. 14 000 € im laufenden Jahr – der Umsatz-Wächter zeigt „im grünen
Bereich“ (unter 80 % von 25 000 €).

---

## 16. Protokolle (P8)

### 16.1 `email-log` (78)

Der Seed **erzeugt Einträge, versendet nichts**. Felder: `status = sent`, `transport = file`, `attempts = 1`,
`sentAt` = Zeitpunkt, `messageId` §2.5, `bodySha256` = SHA-256 von `seed:<seedKey>`, `attachments = []`, `locale` =
Sprache der Bestellung/des Widerrufs/der Anfrage (Admin-Mails immer `de`), `to` = Kunden-E-Mail bzw.
`ADMIN_NOTIFY_EMAIL` bei `admin_*`, `subject` = Betreff-Vorlage aus `site-texts.emails` mit eingesetzter Nummer
(fehlt die Vorlage: `„<Template-Label> <Nummer>“`).

Ableitung aus der Zeitleiste (Zeitpunkt = Ereignis; Schlüssel aus `EMAIL_TEMPLATES`, Auslöser laut DATENMODELL §6.8.5):

| Ereignis | Vorlagen |
|---|---|
| paidAt (Karte/PayPal, O1) | `order_confirmation`, `admin_order_placed` |
| placedAt (Vorkasse, O2) | `prepayment_instructions`, `admin_order_placed` |
| `prepayment.reminderSentAt` | `prepayment_reminder` |
| `prepayment.receivedAt` (O3) | `prepayment_received` |
| cancelledAt durch `cancelOverduePrepayments` (O4) | `prepayment_cancelled`, `admin_prepayment_cancelled` |
| shippedAt (O7) | `order_shipped` |
| readyForPickupAt (O8) | `pickup_ready` |
| Widerruf `receivedAt` | `withdrawal_receipt`, `admin_withdrawal_received` |
| refunds[].createdAt (Übergänge O13, O14, O15) | `refund_confirmation` |
| disputedAt (O16) | `admin_dispute_opened` |
| Anfrage createdAt | `inquiry_receipt`, `admin_inquiry_received` |
| Reklamation `repairChoiceSentAt` (RK2, RK3) | `complaint_repair_choice` (Bezug `order` der Reklamation) |
| Reklamation `vsbgNoticeSentAt` (RK4) | `dispute_vsbg` (Bezug `order`, `locale en`) |
| Datenschutz-Anfrage `answeredAt` bei Auskunft (DS1) | `privacy_access_response` (ohne Bezug; `retainUntil` = `sentAt` + 90 Tage, L-12) |

Kassen ohne Bestellung (KS1, KS2) erzeugen keine Mail. Abgelehnte Datenschutz-Anfragen (DS2) werden außerhalb der
Vorlagen beantwortet und erzeugen keinen Eintrag; offene Anfragen und Reklamationen ohne verschickte Vorlage ebenfalls
nicht. Ergebnis je Bezug: O01 6 · O02 4 · O03 4 · O04 6 · O05 7 · O06 6 · O07 5 · O08 3 · O09 4 · O10 3 · O11 3 · O12 2 ·
O13 2 · O14 2 · W4 2 · W6 2 · W7 2 · A1–A7 je 2 · DS1 1 = **78**. Widerrufs-Mails verweisen zusätzlich auf `withdrawal`;
`withdrawals.confirmationEmail` zeigt auf den `withdrawal_receipt`-Eintrag.

### 16.2 `consent-log` (14)

`textSnapshot` = gerenderter RECHT-Baustein in der Sprache der Bestellung/Anfrage zum Seed-Zeitpunkt (der Seed erfindet
keinen Rechtstext); `textSha256` daraus; `snippetKey`/`snippetVersion` des Bausteins; `granted = true`; `email` =
Kunden-E-Mail. Bezug `checkout` nur, wenn die Kasse noch existiert (§7.3).

| Key | `purpose` | Bezug | Zeitpunkt | Baustein |
|---|---|---|---|---|
| O01, O05, O06, O10, O11, O14 | carrier_email_forwarding | Bestellung (+ Kasse) | placedAt | `checkout.dhlEmailConsent` |
| O13 | deviation_agreement | Bestellung + Kasse + `product` S14 | placedAt | `checkout.deviationAgreement` (mit Titel, Nr. 914, Abweichungstext) |
| A1–A7 | inquiry_privacy_notice | Anfrage | createdAt | `inquiry.privacyNotice` |

### 16.3 `audit-log` (8)

| Key | `action` | `actorType` | Bezug | Zeitpunkt | `summary` |
|---|---|---|---|---|---|
| `audit-log:seed_imported` | seed_imported | seed | settings | Seed-Lauf | Beispielbestand importiert: 30 Stücke, 14 Kassen, 14 Bestellungen, 15 Belege, 7 Widerrufe, 4 Reklamationen, 7 Anfragen, 5 Datenschutz-Anfragen. |
| `audit-log:S06:offline` | product_offline_sold | admin | products S06 | `D-32@15:05` | Nr. 906 offline verkauft (Flohmarkt Mauerpark). |
| `audit-log:O03:disputed` | order_status_changed | webhook | orders O03 | `D-5@08:12` | PC-2026-90003: delivered → disputed (Anfechtung eröffnet, O16). |
| `audit-log:S09:archived` | product_status_changed | admin | products S09 | `D-6@09:35` | Nr. 909: sold → archived (vor dem Versand zerbrochen, Bestellung erstattet). |
| `audit-log:W2:matched` | withdrawal_matched | admin | withdrawals W2 | `D-13@09:00` | WR-2026-90002 manuell PC-2026-90005 zugeordnet. |
| `audit-log:O01:refund` | order_refund_created | admin | orders O01 | `D-37@09:15` | PC-2026-90001: Erstattung 66,90 € (Widerruf). |
| `audit-log:O05:refund` | order_refund_created | admin | orders O05 | `D-7@10:05` | PC-2026-90005: Teil-Erstattung 40,40 € (Widerruf). |
| `audit-log:O08:refund` | order_refund_created | admin | orders O08 | `D-6@09:30` | PC-2026-90008: Erstattung 93,90 € (Bruch vor dem Versand). |

`actorUser` = Seed-Admin, falls vorhanden, sonst leer. Belege erzeugen ihre Audit-Einträge über den normalen P4-Pfad
**nicht** (Seed-Kontext `skipAudit`).

---

## 17. Vorschau- und Testanker

| Zweck | Anker |
|---|---|
| Warenkorb-Beispiel (Crawler, KONZEPT §12) | S01 + S11 → Versandklasse `keramik` (8,90 €), Zwischensumme 109,00 €, Summe 117,90 €, Abweichung von S11 muss in der Kasse bestätigt werden |
| Danke-Seiten | O14 (bezahlt, `en`, `/en/thank-you/<seedToken('checkouts:O14', 'checkout')>`) und O13 (Vorkasse, zeigt die Beispiel-IBAN und die Frist `D+3@23:59:59`, `/de/danke/<seedToken('checkouts:O13', 'checkout')>`); beide zeigen „Beispiel“ |
| Bestellstatus-Seiten | O10 (versendet, DHL-Link), O13 (Vorkasse offen), O01 (erstattet); URL mit `seedToken('orders:<Key>', 'status')` (§2.5); O03 zeigt den Status vor der Anfechtung (`delivered`, „geschätzt“) |
| Kassen | KS2 offen: S27 öffentlich „gerade reserviert“ bis `N+30min`; KS1 abgelaufen (nur Verwaltung, Gruppe „System“) |
| Produktseiten | S01 (2 Bilder), S11 (Abweichung + Mischgewebe), S14 (reserviert, Etikett fehlt), S19 (sold, Archiv), S26 (Schmuck-Pflichtangaben), S30 (nur Abholung), S29 (EN-Fallback auf `/en`) |
| 404 für verkauftes, ausgeblendetes Stück | S08 (online verkauft, `showInArchiveAfterSale = false`; `/de/shop/908-…` → 404-Variante „schon ein Zuhause“, AK-3-04) |
| Nicht öffentlich | S18, S25 (draft), S09 (archived) |
| Widerrufs-Posteingang | W4 (`needs_manual_match`), W5 (neu, Frist `D+13`) |
| Admin „Heute“ | Zu packen 2 (O14 bezahlt, O12 gepackt) · Vorkasse offen 1 (O13) · Abholung 1 (O09) · Versendet 1 (O10) · Widerrufe offen 3 (W3 Erstattung fällig `D+5`, W4, W5; W6/W7 abgeschlossen) · Neue Anfragen 1 (A4) · rote Anfechtung (O03 `disputed`) · offene Datenschutz-Anfragen 3 (DS3, DS4, DS5; nächste Frist DS3 `D+26`) · Hinweis „Beispieldaten vorhanden“ |
| Reklamationen | RK1 offen mit DHL-Frist `D+6` (aus „Versendet“ bei O10), RK2 wartet auf die Wahl der Kund:in, RK3 erledigt (Gewährleistung + 12 Monate), RK4 abgelehnt mit Streitbeilegungshinweis |
| Tattoo | F-901 mit echtem Bild; TO1 künftig, TO2 läuft, TO3 unsichtbar; G1/G2 nur im Vorschau-Modus mit Etikett |

---

## 18. Entfernen und Reset

- Reihenfolge und Wirkung wie DATENMODELL §13.5, ergänzt um: Zählerzeilen `invoice-counters` mit `series ∈ {BSP-RE,
  BSP-GS}` löschen; `seedKey`-Index bleibt; Verweise echter Dokumente auf Seed-Dokumente (z. B. `pages`-Block einer
  übernommenen Seite → Seed-Stück) entfernen und im Bericht auflisten.
- `keepTexts = true` (Standard): nicht übernommene `pages`/`faqs` → `seed = false`, samt referenzierter Medien (die
  Instagram-Bilder gehören Jutta). Galerie G1/G2 werden immer gelöscht (keine Einwilligung).
- `--drop-texts`: `pages`/`faqs` mit `seed = true` löschen; Frontend zeigt Leerzustände (DM-PAGE-01).
- Echte Sequenzen (`PC`, `WR`, `AA`, `DS`) und Zähler `RE`/`GS` bleiben unberührt; Seed-Nummern belegen die Sequenzen nie.
- Reklamationen (samt ihrer Fotos) und Datenschutz-Anfragen werden immer gelöscht, nie übernommen (DATENMODELL §13.4).
- Grund-Seed wird nie gelöscht.

---

## 19. Akzeptanzkriterien

| ID | Kriterium | Test |
|---|---|---|
| AK-SEED-01 | Zweimal `pnpm seed` → identische Anzahlen je Collection, keine doppelten `seedKey`s | int |
| AK-SEED-02 | Nach `pnpm seed` hat jedes Dokument des Beispielbestands `seed = true` und einen `seedKey`; Grund-Seed-Dokumente `seed = false` | int |
| AK-SEED-03 | Nach `pnpm seed:reset` mit kanonischem `N` stimmen die Anzahlen mit §0.1 überein (Kassen 14, Bestellungen 14, Reservierungen 10); keine Kasse ist älter als 30 Tage und keine freigegebene oder umgewandelte Reservierung älter als 7 Tage (L-02, L-03) | int |
| AK-SEED-04 | `APP_ENV=production pnpm seed`, `APP_ENV=production pnpm seed:example`, `… seed:remove --yes` und `… seed:reset` sowie `pnpm seed` gegen eine als Produktion markierte Datenbank (`planetclaire:production`) enden mit Exit 1 ohne jede Schreiboperation; `seed:base` läuft in Produktion und überschreibt keinen vorhandenen Wert | int |
| AK-SEED-05 | Während des Seeds: 0 Mails im `file`-Transport-Verzeichnis, 0 Jobs in der Queue, 0 Aufrufe an Stripe/DeepL (Spies) | int |
| AK-SEED-06 | Jedes Stück mit `status ∈ {available, reserved}` besteht `validateForPublish`; S18 scheitert genau an der Faserangabe, S25 genau an „Bildbeschreibung EN“ | unit/int |
| AK-SEED-07 | Jeder der 13 Werte aus `ORDER_STATUSES` und jeder aus `PAYMENT_METHODS` kommt vor, kein anderer Status; beide `FULFILLMENT_METHODS`; jede `products.status`-Ausprägung; `checkouts` in `completed`, `expired` und `open`; jede Bestellung hat einen erlaubten Endstatus laut DATENMODELL §6.8.5 (`cancelled` mit `cancelReason`, `disputed` mit `statusBeforeDispute`, Erstattungsgründe aus `REFUND_REASONS`) | int |
| AK-SEED-08 | Belegnummern exakt wie §9; Zähler `BSP-RE` = 12, `BSP-GS` = 3; `RE`/`GS`-Zähler unverändert | int |
| AK-SEED-09 | Zeitlogik je Bestellung monoton (Kasse `createdAt` < placed ≤ paid ≤ packed ≤ shipped ≤ delivered ≤ withdrawal ≤ return ≤ refunded; `disputedAt` nach dem Zeitpunkt von `statusBeforeDispute`); jeder Widerruf mit Bestellung liegt ≤ 14 Tage nach `deliveredAt`/`pickedUpAt`; `firstPublishedAt` jedes Stücks < `placedAt` seiner Bestellungen; jede versendete oder gepackte Bestellung hat `packaging.templateKey` und ≥ 1 Komponente | unit |
| AK-SEED-10 | (entfallen, P12.7) Angebote TO1–TO3 gibt es nicht mehr; stattdessen keine Angebotskarte und R13 = 404 | e2e |
| AK-SEED-11 | `SEED_PREVIEW_MODE=false`: G1/G2 fehlen in der öffentlichen API, ihre Bild-URLs liefern 404; `SEED_PREVIEW_MODE=true` + `APP_ENV=preview`: sichtbar; G3–G6 immer sichtbar | int |
| AK-SEED-12 | Alle Personen-E-Mails enden auf `@example.com` oder `@example.org`; kein Datensatz hat eine Telefonnummer | unit |
| AK-SEED-13 | Verbotsmuster-Test (RECHT §5) über `content/seed/**` grün; einzige Allowlist-Ausnahme der Figurenname in `tattoo.json` | unit |
| AK-SEED-14 | `pnpm seed:remove --yes` → 0 Dokumente mit `seed = true`, keine `BSP-*`-Zählerzeilen, Seiten/FAQ übernommen; mit `--drop-texts` gelöscht | int |
| AK-SEED-15 | Ein echtes Stück Nr. 17 und ein echter Umsatz `2026-09/tattoo` bleiben bei `seed`, `seed:remove` und `seed:reset` unverändert; der Seed überspringt belegte (`month`, `source`) | int |
| AK-SEED-16 | `resolveSeedTime` erfüllt die Tabelle §2.2; ein ungültiges `SEED_NOW` (kein ISO 8601 mit Offset) → Exit 1 | unit |
| AK-SEED-17 | Übernahme: Speichern von FAQ05 im Admin setzt `seed = false`; ein weiterer `pnpm seed` legt FAQ05 nicht neu an und ändert es nicht | int |
| AK-SEED-18 | Startseite liefert `hero` + genau 7 Stationen mit `stationId` `hallo`, `keramik`, `textil`, `zeichnungen`, `schmuck`, `tattoo`, `jutta-und-coco` in dieser Reihenfolge | int |
| AK-SEED-19 | Kein importiertes Bild stammt aus Highlights/`profil.jpg`; `DdHXUQsDjqm` existiert nur als Ausschnitt `#cap` (crop % 16, 0, 68, 45; die Prüfung rechnet die Pixel aus den tatsächlichen Quellmaßen – bei der 480×640-Quelle 77, 0, 326, 288) | int |
| AK-SEED-20 | Status-URLs aus `seedToken('orders:<Key>', 'status')` für O01, O10, O13 und Danke-URLs aus `seedToken('checkouts:<Key>', 'checkout')` für O13, O14 öffnen die Seiten und zeigen „Beispiel“; ein anderer Token liefert 404; `seedToken()` hängt nicht von `PAYLOAD_SECRET` ab | e2e |
| AK-SEED-21 | Nach `pnpm seed` mit `SEED_PREVIEW_MODE=true` und `APP_ENV=preview`: Monats-CSV, DATEV-Export, Rechnungs-ZIP und der Jahres-Export der Verpackungsmengen (`GET /api/admin/packaging-report?year=`) enthalten keinen Datensatz mit `seed = true` (bei reinem Beispielbestand: nur Kopfzeile bzw. leeres Archiv) | int |
| AK-SEED-22 | Jeder Wert aus `WITHDRAWAL_STATUSES`, `WITHDRAWAL_MATCH_STATUSES`, `COMPLAINT_STATUSES`, `INQUIRY_STATUSES` und `PRIVACY_REQUEST_STATUSES` kommt mindestens einmal vor (Mengen §0.1); `closed` hat `closeReason`, `rejected` hat `closeNote` bzw. `resultNote`; jede Reklamation hängt an einer bezahlten Bestellung und hat `receivedAt` nach `shippedAt`/`pickedUpAt`; Nummern `WR`, `AA`, `DS` steigen mit `receivedAt`/`createdAt`; bei kanonischem `N` ist keine Datenschutz-Erinnerung fällig und keine Exportdatei vorhanden; `seed:remove --yes` hinterlässt 0 Reklamationen, 0 Datenschutz-Anfragen und keine `complaint_photo`-Dateien mit `seed = true` | int |
| AK-SEED-23 | Termine TD1–TD8 (P12.8): 8 Beispiel-Termine; bei kanonischem `N` stehen TD4–TD8 oben (TD6 abgesagt), TD1–TD3 eingeklappt; jeder Termin DE und EN | int, e2e |

---

## 20. Offene Punkte

Stand 26.09.2026. Der „Standard“ gilt, bis entschieden ist; er blockiert nichts und bringt nichts Riskantes online. P8.1
überträgt die offenen Punkte nach `docs/OFFENE-PUNKTE.md`; die als **geklärt** markierten (SE-08, SE-11, SE-13) bleiben nur zur
Nachverfolgung stehen und werden nicht übertragen. Die Abstimmung mit den übrigen Fachdokumenten (Nummern und
Nummernkreise, Referenzzeit, Mail-Domains, Beispiel-IBAN, Keramik, Mengen, `seedKey`, Hook-Ausnahmen, `revenue-entries`,
Rechtstext-Platzhalter, Vorkasse-Fristen, Flash-Anzeige, Bestell- und Kassen-Zustände) ist geklärt und in §0.3
festgeschrieben.

| ID | Thema | Standard bis zur Entscheidung | Entscheidet | So änderbar |
|---|---|---|---|---|
| SE-01 | Bildinhalte S04–S06: Die handgeschriebenen Zeilen auf den Schmetterlings-Schälchen (S04, S05) könnten Liedzeilen sein; die Fliese S06 zeigt vielleicht eine reale, bekannte Person und zitiert eventuell einen fremden Text | neutrale Titel und Alt-Texte, keine Zitate in Daten und Texten; die Fotos erscheinen nur im Beispielbestand (nie in Produktion) | Jutta | ist es fremdes Material: S04–S06 in `products.json`/`media.json` auf Platzhalter (§4.2) umstellen, `pnpm seed:reset` |
| SE-02 | Graue Cap `DdHXUQsDjqm`: Das ungeschnittene Foto zeigt Jutta | nur der gesichtsfreie Ausschnitt `#cap` als Produktbild S16 (am unteren Rand evtl. Haarspitzen); quer 1,13:1, `card`/`thumb` schneiden am Fokuspunkt weiter zu; nie auf „Über mich“ | Jutta (Freigabe oder besseres Foto) | Foto aus dem Instagram-Export oder von Jutta, gleicher `seedKey`, `--refresh-media` |
| SE-03 | Kund:innen-Tattoofotos G1/G2 (Manifest `consentRequired: true`) im privaten Repository und in der Vorschau-Datei | sichtbar nur bei wirksamem `SEED_PREVIEW_MODE` (`APP_ENV ≠ production`), Etikett „intern – Einwilligung fehlt“, Vorschau nur im privaten Repository (R-182, KA-21); beim Entfernen der Beispieldaten immer gelöscht | Kanzlei (Kanzleifrage K-34); Jutta (Einwilligungen, R-172) | bei Bedenken der Kanzlei: G1/G2 samt Medien aus `tattoo.json`/`media.json` entfernen und durch Platzhalter-Einträge ersetzen |
| SE-04 | Allowlist des Verbotsmuster-Tests: fremder Figurenname in der Bildunterschrift von G2 (`tattoo.json`) | Juttas Original-Bildunterschrift aus dem Manifest bleibt; genau ein Allowlist-Eintrag mit Begründung „Tattoo-Portfolio, keine Verkaufsware (E-18)“ (RECHT §5) | Jutta; Kanzlei bei Bedenken | neutrale Bildunterschrift (z. B. „Monster mit Hasen, frisch gestochen“) in `tattoo.json`, dann Allowlist-Eintrag löschen |
| SE-05 | Straßennamen der erfundenen Kund:innen (§6), besonders „Musterstraße“ in Berlin | erfundene Namen; alle übrigen Adressen liegen außerhalb Berlins (R-180) | P8 prüft gegen das Berliner Straßenverzeichnis | gibt es den Namen in Berlin: in `customers.json` durch einen erkennbar erfundenen ersetzen |
| SE-06 | Material-, Faser- und Maßangaben: Steinzeug, Unterglasurfarben, Transparentglasur, Edelstahl 316L, 300-g-Papier, Faserangaben der Instagram-Caps S15/S16, Maße und Gewichte | Annahmen nach bestem Wissen (§5.2, §5.3) | Jutta | im Admin korrigieren bzw. in `products.json` |
| SE-07 | Aftercare-Methode (Folie/Second Skin) und FAQ-Aussagen (Farbe, Cover-ups, Coco im Studio, Anzahlung, Absagen, Mindestalter) | Entwürfe in Juttas Ton, ohne Heilversprechen (V-15) und ohne Verfallsklauseln zur Anzahlung (V-24) | Jutta; Wortlaut zu Mindestalter, Absagen und Anzahlung zusätzlich Kanzleifrage K-26 | Jutta übernimmt die Texte durch Bearbeiten im Admin (adopt) |
| SE-08 | Sendungsverfolgung Deutsche Post: Link-Vorlage für O03 | **geklärt (27.09.2026):** `settings.shipping.trackingUrlTemplates` hat je eine Vorlage für `dhl` und `deutsche_post` (DATENMODELL §7.1, DM-12); O03 bekommt `trackingUrl` aus der Vorlage `deutsche_post` (§3.1, §7.2). Ob die URL für Deutsche-Post-Sendungen stimmt, prüfen P5 und die erste echte Sendung in P11 (DM-12) | – | – |
| SE-09 | `PAGE_KEYS` für die Tattoo-Unterseiten R12–R18: bisher nur `tattoo` und `tattoo_aftercare` | **geklärt (02.10.2026, P7.1):** die vorhandenen `PAGE_KEYS` reichen – R12–R16 und R18 lesen die Blöcke der Seite `tattoo` nach Typ (`flashGrid`, `offersList`, `priceInfo`, `tattooGallery`, `processSteps`, `faqList`; `src/lib/data/tattoo.ts` `blocksOfType`), R11 zusätzlich die `richText`-Blöcke als „Mein Stil“, R17 die Seite `tattoo_aftercare` (§13.5, §13.6) | – | – |
| SE-10 | Teil-Widerruf O05: Erstattung der Versand-Mehrkosten (240 ct) nach der Erstattungsregel in KONZEPT §5.3 | Betrag 4040 und Gutschrift `BSP-GS-2026-00002` wie §7.2 und §9 | Kanzlei (Kanzleifrage K-09) | ändert sich die Regel: Betrag von O05 in `orders.json` anpassen, dann `pnpm seed:reset` |
| SE-11 | Erstattungsgrund bei der Erstattung einer bezahlten Bestellung, deren Keramik vor dem Versand zerbrochen ist (O08, Übergang O15) | **geklärt (26.09.2026):** Grund `breakage` aus `REFUND_REASONS` (DATENMODELL §4); Erstattung und Gutschrift `BSP-GS-2026-00003` nutzen ihn (§7.2, §9) | – | – |
| SE-12 | Kassen und Reservierungen im Beispielbestand nach den Löschfristen L-02 (7 Tage nach Freigabe/Umwandlung) und L-03 (Kassen 30 Tage nach Anlage) | der Seed legt nur an, was bei `N` noch existieren würde (§7.3, §8): 14 Kassen, 10 Reservierungen; O01/O02 ohne Kasse | P8 (Umsetzung, §1.8), bei Friständerung LOESCHKONZEPT | Filter in `src/lib/seed/` anpassen (Fristen aus `src/lib/retention/policy.ts`), Mengen in §0.1 nachziehen |
| SE-13 | S09 nach der Erstattung von O08 `archived`, obwohl das Stück nie versendet wurde | **geklärt (26.09.2026):** Produkt-Übergang P13 (`sold → archived`) erlaubt als Vorbedingung „Ware zurück **oder** Bestellung wegen `breakage` erstattet“ (KONZEPT §5.1, DATENMODELL §6.6.7); S09 entspricht damit dem Endstand nach P13 (`soldAt`/`soldChannel`/`currentOrder` leer, Audit `sold → archived`), der Seed legt ihn direkt an (§1.6) | – | – |
| SE-14 | Beispiel-Begründungen für Ablehnungen und Abschlüsse: Reklamation RK4 (kein Mangel, Hinweis auf Widerrufsrecht, Streitbeilegungshinweis), Datenschutz-Anfrage DS2 (Anfrage für eine andere Person ohne Vollmacht), Widerruf W7 (Test-Eingabe) | interne Notizen im Beispielbestand, kein Rechtstext und keine Vorlage für echte Fälle; Antworten auf echte Fälle laufen über die Bausteine der Kanzlei (`complaint.repairChoice`, `dispute.vsbg37`, `privacyRequest.*`) | Kanzlei (bei Bedenken), Jutta | Texte in `complaints.json`, `privacy-requests.json` bzw. `withdrawals.json` ändern, dann `pnpm seed:reset` |
