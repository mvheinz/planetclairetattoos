# Fortschritt

Neueste Einträge oben. Format: `## YYYY-MM-DD – Phase/Aufgabe` + was erledigt wurde + wie getestet.

## 2026-09-29 – P4.24

- Kaufpfad Ende-zu-Ende mit Mock unter `tests/e2e/purchase/` (nur `iphone-15` und `pixel-7`; `desktop` ignoriert den Ordner): Produktseite → „In den Korb“ → Korb → „Zur Kasse“ → Kasse → Danke in 4 Seiten (EK-02) für Karte mit Versand, Wallet (Mock Apple Pay) mit Abholung, PayPal „Abbruch“ → „Zurück zur Kasse“ → „Erfolg“, „Abgelehnt“ → erneuter Versuch, „Abgelehnt“ → Vorkasse (genau eine Bestellung `awaiting_prepayment`), „Verzögert“ → wartet → Testhilfe setzt die Session auf bezahlt → „bezahlt“ (Rückfall `getCheckoutSession`), Vorkasse mit Versand → Verwaltung „Zahlung erhalten“ → M05, Abholung mit Vorkasse (Rechnungsadresse Pflicht).
- Reservierung: Countdown-Ablauf mit `page.clock` → „Nochmal reservieren“ legt eine neue Kasse an (alte `cancelled`); zwei Käufer:innen in zwei Kontexten gleichzeitig „Zur Kasse“ → genau eine Kasse, die andere „gerade reserviert“, nach Ablauf der ersten kauft die zweite (EK-03). Die Server-Uhr läuft echt – Abläufe setzen die Zeitpunkte in der Test-DB zurück.
- Je Fall: keine Bestellung vor der Zahlung bzw. dem Vorkasse-Klick, nur Kassen `cancelled`/`expired` bei Abbruch/Ablauf, Mails im Datei-Treiber (`readOutbox`), keine Konsolenfehler, keine CSP-Verstöße. AK-3-10: geänderter Klassenpreis gleich auf R25, im Korb und in einer neuen Kasse (einmal je Lauf, `pixel-7`, Lock exklusiv).
- `@smoke`: Kartenkauf und Vorkassekauf (laufen in `ci.yml` auf `iphone-15`). Stripe-Testmodus (`stripe-testmode.e2e.spec.ts`, `@stripe`) angelegt, läuft nur mit `PAYMENTS_DRIVER=stripe` und `sk_test_`-Schlüssel – hier übersprungen (OFFENE-PUNKTE).
- Tests: 22 E2E grün (11 × iphone-15 WebKit/pixel-7, Produktions-Build), Reservierungs-Suite 3× wiederholt stabil; `pnpm check` grün.

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
