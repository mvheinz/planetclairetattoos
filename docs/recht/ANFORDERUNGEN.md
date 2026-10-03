# Rechtliche Anforderungen (R-xxx) – planetclairetattoos.com

> **Stand:** 26.09.2026 · **Version:** 1.3 · **Status:** verbindliches Fachdokument
> **Rang:** unter `docs/ENTSCHEIDUNGEN.md` (E-xx), über `PLAN.md` und `docs/research/`.
> **Zielgruppe:** autonome Entwicklungs-Sessions P1–P10 (P11 gemeinsam mit Jutta).
> **Grundlage:** ENTSCHEIDUNGEN.md, Konzeptseite (`docs/konzept/planet-claire-konzept.html`), `docs/research/recht-shop.md`,
> `produkt-compliance-steuern.md`, `zahlung-versand-betrieb.md`, `tattoo-bereich.md`, `tech-stack.md`.
> Punkte, die in der Recherche fehlten und am 26.09.2026 nachrecherchiert wurden, sind mit **[ergänzt]** markiert
> (Quellen in §9).
> **Mitgeltende Dokumente:** `docs/recht/DIENSTE.md` (Dienstleister), `docs/recht/LOESCHKONZEPT.md` (Fristen, Jobs),
> `docs/recht/KANZLEI-BRIEFING.md` (Fragen K-xx an die Kanzlei).
>
> Dies ist sorgfältige Recherche, **keine Rechtsberatung**. Verbindliche Rechtstexte liefert die Kanzlei (E-41).

---

## 0. So benutzt du dieses Dokument

1. **Jede Anforderung** hat: ID, Anforderung, Rechtsgrundlage, Umsetzung, Abnahme, Phase, Owner-Aufgabe.
2. **Abnahme-Arten:** `unit` (Vitest, `tests/unit/**/*.unit.spec.ts`), `int` (Vitest gegen Postgres,
   `tests/int/**/*.int.spec.ts`), `e2e` (Playwright, `tests/e2e/**`), `manuell` (Checkliste §7).
   Rechtstests liegen in Unterordnern `legal/` (z. B. `tests/e2e/legal/footer.e2e.spec.ts`).
3. **Testnamen beginnen mit der ID**, z. B. `test('R-090 Link „Vertrag widerrufen“ auf allen Seitentypen', …)`.
   Nur so findet der Nachverfolgbarkeits-Test (R-001) die Abdeckung.
4. **Bezeichner** in `code`-Schrift (Collections, Felder, Enum-Werte, Jobs, Mail-Vorlagen) folgen `docs/DATENMODELL.md`
   (Collections, Felder, Enums, Nummernformate) bzw. `docs/ARCHITEKTUR.md` (Umgebungsvariablen, Endpunkte, Task-Slugs,
   Cookies). Weicht ein Name hier trotzdem ab, gilt dort der **Name** und hier die **Regel** (die strengere Regel
   gewinnt). Die Zuordnung steht dann im PR-Text.
5. **Unklar?** Konservativste, rechtlich sicherste und leicht änderbare Variante umsetzen und in
   `docs/OFFENE-PUNKTE.md` eintragen (CLAUDE.md §2). Fragen an die Kanzlei stehen als **K-xx** im
   KANZLEI-BRIEFING; bis zur Antwort gilt die hier beschriebene **Standardumsetzung**. In den Rechtsdokumenten
   (`docs/recht/`) bedeutet „K-xx“ immer eine **Kanzleifrage** aus KANZLEI-BRIEFING §17; Annahmen aus
   `docs/KONZEPT.md` Anhang A heißen **KA-xx** („KONZEPT KA-xx“).
6. **Keine Rechtstexte selbst formulieren** (R-002). Kurze Arbeitsfassungen für Textbausteine stehen in §6 und sind
   als `origin: 'draft'` zu kennzeichnen.
7. **Verbotsliste:** §5 (V-xx). Sie gilt für Code, Inhalte, Seed-Daten, E-Mails, PDFs und Entwürfe von Claude.
8. **Vorläufige Regeln:** Wo eine Anforderung bis zur Antwort der Kanzlei bewusst schwächer umgesetzt wird als die
   strengste Lesart, steht das als „**Vorläufige Regel**“ mit der zugehörigen Kanzleifrage an der Anforderung. Nach der
   Antwort wird die Regel angepasst (KANZLEI-BRIEFING §19).

## 1. Rahmen – von diesen Fakten gehen alle Anforderungen aus

| Thema | Festlegung | Quelle |
|---|---|---|
| Unternehmerin | Jutta, Einzelunternehmerin in Berlin, keine Beschäftigten, nicht im Handelsregister | E-01, E-03 |
| Steuer | Kleinunternehmerin § 19 UStG; Schalter „Regelbesteuerung“ mit Gültig-ab, Standard AUS | E-02 |
| Sortiment | Nur Unikate (Bestand 1), keine Varianten; Keramik (Standard Deko), Second-Hand-Textilien/Caps (bemalt), Zeichnungen/Aquarelle, Keramikschmuck | E-10, E-15–E-17 |
| Auftragsarbeiten | Nicht kaufbar; nur Anfrageformular; Vertrag/Bezahlung außerhalb des Shops | E-11 |
| Tattoo | Nicht buchbar, nicht bezahlbar; nur Mail/DM-Links, **kein Formular** | E-50–E-53 |
| Zahlarten | Karte, Apple Pay, Google Pay, PayPal (über Stripe), Vorkasse; **kein** Klarna, **keine** SEPA-Lastschrift | E-20 |
| Kasse | Eigene Seite, Stripe Checkout Sessions `ui_mode: 'elements'`, eigener Button | E-21 |
| Reservierung | 30 Minuten beim Start des Bezahlvorgangs; Vorkasse bis zur Zahlungsfrist (23:59:59 Europe/Berlin am 5. Kalendertag nach dem Bestelltag), Erinnerung 72 h nach der Bestellung, danach Auto-Storno | E-22, E-23 |
| Liefergebiet | Nur Deutschland + Abholung in Berlin; EU vorbereitet, aus; GB/US gesperrt; CH vorbereitet, aus | E-24 |
| Rücksendekosten | Trägt bei Widerruf die Kund:in | E-27 |
| Kundenkonten | Keine; Gastbestellung, Bestellstatus über geheimen Link | E-30 |
| Impressum/Hersteller | Privatadresse (auch GPSR-Angabe) | E-40 |
| Rechtstexte | Einmalig von Kanzlei; CMS mit Versionen; jährliche Erinnerung | E-41 |
| Portfolio | Häkchen pro Foto; ohne Häkchen keine Veröffentlichung | E-42 |
| Cookies | Kein Banner; keine einwilligungspflichtigen Dienste; Speichern auf dem Endgerät nur nach Nutzeraktion und nur technisch notwendig (R-130) | E-43 |
| Verpackung | Jutta ist Herstellerin ihrer Versandverpackung: LUCID-Registrierung **plus** eigene Systembeteiligung (Kleinstlizenz); vorlizenzierte Kartons reichen nicht | E-47 |
| Widerrufsbutton | § 356a BGB seit 19.06.2026 | E-44 |
| Nicht im Plan | Drops, Newsletter, Warteliste, Gutscheine, Rabattcodes, Klarna, Markt-Modus, Kundenkonten, EU-Versand zum Start | ENTSCHEIDUNGEN „Später“ |

## 2. Kanonische Routen der Rechts- und Pflichtseiten

Kanonisch sind die deutschen **und** englischen Routen der Routentabelle in `docs/KONZEPT.md` §2.2 (R-IDs in
Klammern); diese Tabelle wiederholt sie für die Rechtstests. Weiterleitungen laut KONZEPT §2.4:
- Die **sieben rechtlichen Kurz-URLs** der letzten Spalte (`/impressum`, `/datenschutz`, `/agb`, `/widerrufsbelehrung`,
  `/versand`, `/vertrag-widerrufen`, `/widerruf`) leiten per **308** fest auf die kanonische deutsche Route (ohne
  Sprach-Erkennung, ohne Cookie; für Instagram-Bio, Mails und Rechtstexte).
- Ein DE-Slug unter `/en/…` (z. B. `/en/impressum`, `/en/vertrag-widerrufen`) und der Alias `/en/imprint` leiten per
  **308** auf die EN-Route.
- `/` und alle übrigen Pfade ohne Sprachpräfix leiten per **307** in die erkannte Sprache (`Accept-Language`, kein Cookie).

In der Widerrufsbelehrung steht immer die kanonische URL `https://planetclairetattoos.com/de/vertrag-widerrufen`
(R-095), nicht die Kurz-URL.

| Zweck | DE (kanonisch) | EN (kanonisch) | Kurz-URL (308) |
|---|---|---|---|
| Impressum (R21) | `/de/impressum` | `/en/legal-notice` | `/impressum` |
| Datenschutzerklärung (R22) | `/de/datenschutz` | `/en/privacy` | `/datenschutz` |
| AGB (R23) | `/de/agb` | `/en/terms` | `/agb` |
| Widerrufsbelehrung + Muster-Widerrufsformular (R24) | `/de/widerrufsbelehrung` | `/en/right-of-withdrawal` | `/widerrufsbelehrung` |
| Versand & Zahlung (R25) | `/de/versand-und-zahlung` | `/en/shipping-and-payment` | `/versand` |
| Widerrufsfunktion (§ 356a BGB) (R26) | `/de/vertrag-widerrufen` | `/en/withdraw-from-contract` | `/vertrag-widerrufen`, `/widerruf` |
| Konformitätserklärungen Keramik (R27; immer erreichbar, Fußlink und Badge nur, wenn Erklärungen vorhanden, R-044) | `/de/konformitaetserklaerungen` | `/en/declarations-of-conformity` | – |
| Kontakt (R20) | `/de/kontakt` | `/en/contact` | – |
| Warenkorb (R06) | `/de/warenkorb` | `/en/cart` | – |
| Kasse (R07) | `/de/kasse` | `/en/checkout` | – |
| Danke-Seite (R08) | `/de/danke/[token]` | `/en/thank-you/[token]` | – |
| Bestellstatus (geheimer Link) (R09) | `/de/bestellung/[token]` | `/en/order/[token]` | – |
| Auftragsarbeiten (mit Anfrageformular) (R10) | `/de/auftragsarbeiten` | `/en/commissions` | – |

**Öffentliche Seitentypen** (Fixture `PUBLIC_PAGE_TYPES` für alle e2e-Rechtstests): Startseite, Shop-Übersicht,
Produktseite (je Kategorie ein Stück), Archiv „sold“, Warenkorb (leer und gefüllt), Kasse, Danke-Seite,
Bestellstatus, Widerrufsfunktion (Schritt 1, 2, Bestätigung), alle Rechtsseiten, Kontakt, Auftragsarbeiten,
Tattoo-Seiten (alle), Über mich & Coco, Konformitätserklärungen (mit und ohne Einträge), 404, Fehlerseite.

## 3. Übersicht aller Anforderungen (maschinenlesbar)

Diese Tabelle ist die Datenquelle für R-001. Format je Zeile: `| R-### | Titel | Phase | Test | Owner | Nachweis |`.
`Nachweis` nennt die Testdateien (Pfade ab Repository-Wurzel, Komma-Liste), bei rein manuellen Punkten „§7“; Pflicht
für alle Zeilen mit frühester Phase ≤ aktueller Phase (`LEGAL_TRACE_PHASE`, P6.23), sonst „–“. Der R-001-Test liest
die Spalten über die Kopfzeile und prüft, dass jeder genannte Pfad existiert.
`Test` ist eine Komma-Liste aus `unit`, `int`, `e2e`, `manuell`. Maßgeblich für R-001 ist die **früheste** Phase.
Lücken in der Nummerierung sind Reserve.

| ID | Titel | Phase | Test | Owner | Nachweis |
|---|---|---|---|---|---|
| R-001 | Nachverfolgbarkeit Anforderung ↔ Test | P1 | unit | nein | `tests/unit/legal/traceability.unit.spec.ts` |
| R-002 | Keine selbst formulierten Rechtstexte, Platzhalter-Kennzeichnung | P6 | unit, e2e | ja | `tests/int/legal/legal-pdf.int.spec.ts`, `tests/int/legal/legal-texts.int.spec.ts`, `tests/int/legal/public-pages.int.spec.ts`, `tests/e2e/legal-pages.e2e.spec.ts` |
| R-010 | Pflichtseiten und stabile URLs | P2, P6 | e2e | nein | `tests/e2e/legal-pages.e2e.spec.ts`, `tests/e2e/legal/pages.e2e.spec.ts`, `tests/unit/routes/registry.unit.spec.ts`, `tests/e2e/contact-withdraw.e2e.spec.ts` |
| R-011 | Footer mit Pflichtlinks auf jeder Seite | P2 | e2e | nein | `tests/unit/legal/footer-links.unit.spec.ts`, `tests/e2e/legal/footer.e2e.spec.ts`, `tests/e2e/contact-withdraw.e2e.spec.ts`, `tests/e2e/error-pages.e2e.spec.ts` |
| R-012 | Rechtstexte und Textbausteine versioniert im CMS | P1, P6 | int | nein | `tests/unit/legal/briefing.unit.spec.ts`, `tests/unit/legal/render-tokens.unit.spec.ts`, `tests/unit/legal/snippets.unit.spec.ts`, `tests/int/legal/legal-texts-admin.int.spec.ts` |
| R-013 | Bestellung speichert Rechtstext-Versionen und Snapshot | P4 | int | nein | `tests/int/legal/contract-confirmation.int.spec.ts`, `tests/e2e/legal/checkout-compliance.e2e.spec.ts`, `tests/int/commerce/submit-checkout.int.spec.ts` |
| R-014 | Jährliche Prüf-Erinnerung Rechtstexte | P6 | int | ja | `tests/int/legal/legal-texts-admin.int.spec.ts`, `tests/int/jobs/legal-review.int.spec.ts` |
| R-015 | Englische Rechtstexte als unverbindliche Übersetzung | P6 | e2e | nein | `tests/int/legal/contract-confirmation.int.spec.ts`, `tests/int/legal/public-pages.int.spec.ts`, `tests/e2e/legal/pages.e2e.spec.ts` |
| R-020 | Impressum aus Stammdaten | P6 | int, e2e | ja | `tests/int/legal/business-profile.int.spec.ts`, `tests/e2e/legal/pages.e2e.spec.ts`, `tests/unit/settings/rules.unit.spec.ts` |
| R-021 | Telefonnummer für Impressum und Widerrufsbelehrung | P6 | unit | ja | `tests/unit/legal/phone.unit.spec.ts`, `tests/int/legal/business-profile.int.spec.ts`, `tests/e2e/legal/pages.e2e.spec.ts`, `tests/unit/email/layout.unit.spec.ts` |
| R-022 | Impressum-Link im Instagram-Profil | P11 | manuell | ja | – |
| R-023 | Kontaktseite ohne Formular und ohne Karte | P6 | e2e | nein | `tests/e2e/legal/pages.e2e.spec.ts` |
| R-030 | Kleinunternehmer-Preishinweis an jedem Preis | P3 | unit, e2e | nein | `tests/unit/shop/list-page.unit.spec.ts`, `tests/unit/shop/price-note.unit.spec.ts`, `tests/unit/static/money-usage.unit.spec.ts` |
| R-031 | Versandkosten vor dem Warenkorb erkennbar | P3 | e2e | nein | `tests/e2e/legal/cart-info.e2e.spec.ts`, `tests/e2e/legal/shipping-page.e2e.spec.ts`, `tests/unit/shop/price-note.unit.spec.ts`, `tests/unit/shop/product-info.unit.spec.ts` |
| R-032 | Steuermodus-Schalter mit Gültig-ab | P1 | unit, int | nein | `tests/unit/legal/constants.unit.spec.ts`, `tests/unit/settings/rules.unit.spec.ts`, `tests/unit/shop/price-note.unit.spec.ts`, `tests/unit/tax/tax-mode.unit.spec.ts` |
| R-033 | Keine Streich- und Rabattpreise, Preis-Historie | P3 | unit, int | nein | `tests/int/shop/revalidate.int.spec.ts` |
| R-034 | Tattoo-Preise als Gesamtpreise | P7 | unit, e2e | nein | `tests/unit/legal/tattoo-content.unit.spec.ts`, `tests/e2e/tattoo/flash.e2e.spec.ts`, `tests/e2e/tattoo/info-pages.e2e.spec.ts` |
| R-035 | Lieferzeit-Angabe | P3 | e2e | nein | `tests/e2e/legal/cart-info.e2e.spec.ts`, `tests/e2e/legal/shipping-page.e2e.spec.ts`, `tests/unit/shop/price-note.unit.spec.ts` |
| R-036 | Zahlarten und Lieferbeschränkungen zu Beginn des Bestellvorgangs | P4 | e2e | nein | `tests/e2e/legal/cart-info.e2e.spec.ts`, `tests/e2e/legal/checkout-compliance.e2e.spec.ts` |
| R-040 | Block „Herstellerin & Produktsicherheit“ (GPSR) | P3 | e2e | nein | `tests/e2e/legal/gpsr.e2e.spec.ts`, `tests/unit/shop/product-info.unit.spec.ts` |
| R-041 | Objektnummer als Produktkennung | P1 | unit, int | nein | `tests/unit/products/item-number.unit.spec.ts`, `tests/unit/shop/format.unit.spec.ts`, `tests/int/products/item-number.int.spec.ts` |
| R-042 | Veröffentlichungs-Validierung je Kategorie | P1 | int | nein | `tests/unit/products/validate.unit.spec.ts`, `tests/int/products/publish-validation.int.spec.ts` |
| R-043 | Textil: Faserzusammensetzung, Größe, Zustand, Second-Hand | P1, P3 | unit, e2e | nein | `tests/e2e/legal/product-info.e2e.spec.ts`, `tests/unit/products/validate.unit.spec.ts`, `tests/unit/shop/format.unit.spec.ts`, `tests/int/products/publish-validation.int.spec.ts` |
| R-044 | Keramik: Lebensmittelkontakt-Status und Konformitätserklärung | P1, P3 | unit, int, e2e | ja | `tests/e2e/legal/product-info.e2e.spec.ts`, `tests/unit/products/validate.unit.spec.ts`, `tests/unit/shop/product-state.unit.spec.ts`, `tests/int/collections/conformity.int.spec.ts` |
| R-045 | Schmuck: Nickel-Nachweis, bleifreie Glasur, Kleinteile-Warnung | P1, P3 | int | ja | `tests/e2e/legal/product-info.e2e.spec.ts`, `tests/unit/products/validate.unit.spec.ts`, `tests/int/products/publish-validation.int.spec.ts` |
| R-046 | Zeichnungen und Aquarelle | P1, P3 | int | nein | `tests/e2e/legal/product-info.e2e.spec.ts`, `tests/unit/products/validate.unit.spec.ts`, `tests/int/collections/products-fields.int.spec.ts`, `tests/int/products/publish-validation.int.spec.ts` |
| R-047 | Nur eigene Motive, keine fremden Marken | P1 | unit, int | nein | `tests/unit/products/validate.unit.spec.ts`, `tests/int/globals/settings.int.spec.ts`, `tests/int/products/publish-validation.int.spec.ts` |
| R-048 | Abweichende Beschaffenheit ausdrücklich und gesondert vereinbaren | P1, P4 | int, e2e | nein | `tests/e2e/legal/product-info.e2e.spec.ts`, `tests/unit/commerce/checkout-schema.unit.spec.ts`, `tests/unit/components/ui.unit.spec.tsx`, `tests/unit/products/validate.unit.spec.ts` |
| R-049 | Harmonisierte Mitteilung zur gesetzlichen Gewährleistung | P3, P6 | e2e | nein | `tests/e2e/legal/cart-info.e2e.spec.ts`, `tests/e2e/legal/pages.e2e.spec.ts`, `tests/e2e/legal/shipping-page.e2e.spec.ts`, `tests/unit/email/templates/order-confirmation.unit.spec.ts` |
| R-060 | Liefergebiet und Länder-Whitelist | P4 | unit, int | nein | `tests/int/legal/eu-activation.int.spec.ts`, `tests/unit/commerce/checkout-schema.unit.spec.ts`, `tests/unit/commerce/shipping.unit.spec.ts`, `tests/unit/commerce/totals.unit.spec.ts` |
| R-061 | Gastbestellung mit minimalen Pflichtfeldern | P4 | e2e | nein | `tests/e2e/legal/checkout-fields.e2e.spec.ts`, `tests/unit/commerce/checkout-schema.unit.spec.ts`, `tests/int/invoices/pdf.int.spec.ts` |
| R-062 | Stripe nur auf der Kasse, Zahlarten technisch begrenzt | P4 | unit, int, e2e | nein | `tests/unit/payments/checkout-session.unit.spec.ts`, `tests/unit/payments/stripe-params.unit.spec.ts`, `tests/unit/security/stripe-imports.unit.spec.ts`, `tests/int/adapters/payments.contract.int.spec.ts` |
| R-063 | Bestellübersicht unmittelbar vor dem Button | P4 | e2e | nein | `tests/e2e/legal/checkout-compliance.e2e.spec.ts`, `tests/e2e/checkout/overview.e2e.spec.ts` |
| R-064 | Bestell-Button „Zahlungspflichtig bestellen“ | P4 | e2e | nein | `tests/e2e/legal/checkout-compliance.e2e.spec.ts`, `tests/e2e/checkout/overview.e2e.spec.ts`, `tests/e2e/shop/product-page.e2e.spec.ts` |
| R-065 | Vertragsschluss-Mechanik | P4 | int | nein | `tests/int/legal/contract-confirmation.int.spec.ts`, `tests/e2e/legal/checkout-compliance.e2e.spec.ts`, `tests/int/commerce/fulfill-checkout.int.spec.ts`, `tests/int/commerce/submit-checkout.int.spec.ts` |
| R-066 | Danke-Seite | P4 | e2e | nein | `tests/unit/commerce/order-view.unit.spec.ts`, `tests/e2e/checkout/thank-you.e2e.spec.ts` |
| R-067 | Bestellstatus-Seite per geheimem Link | P4 | int, e2e | nein | `tests/unit/commerce/checkout-schema.unit.spec.ts`, `tests/unit/commerce/order-status-line.unit.spec.ts`, `tests/unit/commerce/order-view.unit.spec.ts`, `tests/unit/security/tokens.unit.spec.ts` |
| R-070 | Zahlarten ohne Aufschläge | P4 | unit | nein | `tests/unit/commerce/order-view.unit.spec.ts`, `tests/unit/commerce/totals.unit.spec.ts` |
| R-071 | Vorkasse: Zahlungsdaten, Erinnerung, automatische Stornierung | P4, P5 | int | ja | `tests/unit/commerce/deadlines.unit.spec.ts`, `tests/unit/commerce/epc.unit.spec.ts`, `tests/unit/email/templates/prepayment-instructions.unit.spec.ts`, `tests/int/jobs/prepayment-deadlines.int.spec.ts` |
| R-072 | Erstattung über dasselbe Zahlungsmittel | P6 | int | nein | `tests/int/legal/refund.int.spec.ts`, `tests/unit/commerce/refund-amount.unit.spec.ts` |
| R-080 | Transaktionsmails: Absender, Anbieterkennung, keine Werbung | P4 | unit | nein | `tests/e2e/legal/forbidden.e2e.spec.ts`, `tests/unit/email/layout.unit.spec.ts`, `tests/unit/email/templates/order-confirmation.unit.spec.ts` |
| R-081 | Bestellbestätigung (Eingangs- und Vertragsbestätigung) | P4 | int | nein | `tests/int/legal/contract-confirmation.int.spec.ts`, `tests/e2e/legal/checkout-compliance.e2e.spec.ts`, `tests/unit/email/templates/order-confirmation.unit.spec.ts`, `tests/unit/email/templates/prepayment-instructions.unit.spec.ts` |
| R-082 | Versandmail | P5 | unit, int | nein | `tests/unit/legal/shipping-mail.unit.spec.ts` |
| R-083 | Abholmail und Übergabe | P5 | int | nein | `tests/int/legal/pickup.int.spec.ts` |
| R-084 | Weitere Pflichtmails | P4 | unit | nein | `tests/unit/legal/admin-templates.unit.spec.ts`, `tests/unit/legal/p6-mails.unit.spec.ts`, `tests/unit/email/templates/order-confirmation.unit.spec.ts`, `tests/unit/email/templates/oversold-apology.unit.spec.ts` |
| R-090 | Link „Vertrag widerrufen“ überall | P2, P6 | unit, e2e | nein | `tests/unit/legal/constants.unit.spec.ts`, `tests/unit/legal/footer-links.unit.spec.ts`, `tests/unit/legal/mail-withdrawal-link.unit.spec.ts`, `tests/e2e/legal-pages.e2e.spec.ts` |
| R-091 | Widerrufsfunktion Schritt 1: Erklärung erfassen | P6 | e2e | nein | `tests/int/legal/withdrawal-form.int.spec.ts`, `tests/e2e/legal/withdrawal-flow.e2e.spec.ts` |
| R-092 | Widerrufsfunktion Schritt 2: „Widerruf bestätigen“ | P6 | e2e | nein | `tests/unit/legal/constants.unit.spec.ts`, `tests/int/legal/withdrawal-form.int.spec.ts`, `tests/e2e/legal/withdrawal-flow.e2e.spec.ts` |
| R-093 | Widerruf speichern und sofort bestätigen | P6 | int, e2e | nein | `tests/int/legal/withdrawal.int.spec.ts`, `tests/e2e/legal/withdrawal-flow.e2e.spec.ts`, `tests/unit/email/templates/withdrawal-receipt.unit.spec.ts`, `tests/int/email/logs-admin.int.spec.ts` |
| R-094 | Widerrufs-Posteingang in der Verwaltung | P6 | int | nein | `tests/int/legal/withdrawal-inbox.int.spec.ts`, `tests/int/collections/withdrawals.int.spec.ts`, `tests/e2e/admin/withdrawal-inbox.e2e.spec.ts` |
| R-095 | Widerrufsbelehrung, Muster-Formular, Rücksendekosten | P6 | unit, manuell | ja | `tests/unit/legal/render-tokens.unit.spec.ts`, `tests/int/legal/legal-texts.int.spec.ts`, `tests/e2e/legal/pages.e2e.spec.ts` |
| R-096 | Kein Widerrufsausschluss im Shop | P3, P6 | unit | nein | `tests/unit/legal/forbidden.unit.spec.ts`, `tests/e2e/legal/forbidden.e2e.spec.ts` |
| R-100 | Transportrisiko trägt die Verkäuferin | P5 | int | nein | `tests/int/legal/packing-hints.int.spec.ts`, `tests/int/legal/transport-risk.int.spec.ts` |
| R-101 | E-Mail-Adresse an DHL nur mit Einwilligung | P4, P5 | unit, e2e | nein | `tests/unit/legal/address-formatter.unit.spec.ts`, `tests/int/legal/packing-hints.int.spec.ts`, `tests/e2e/legal/checkout-fields.e2e.spec.ts`, `tests/int/commerce/submit-checkout.int.spec.ts` |
| R-102 | Abholung in Berlin | P4, P5 | int | nein | `tests/int/legal/pickup.int.spec.ts`, `tests/int/commerce/pickup.int.spec.ts` |
| R-110 | Gesetzliche Mängelhaftung, keine „Garantie“, Reklamationsakte | P6 | int | nein | `tests/int/legal/complaints.int.spec.ts` |
| R-111 | Reklamationsvorlage „Recht auf Reparatur“ | P6 | int | nein | `tests/unit/legal/p6-mails.unit.spec.ts`, `tests/int/legal/complaints.int.spec.ts` |
| R-112 | Streitbeilegung: § 37 VSBG-Vorlage, kein OS-Link | P6 | unit | nein | `tests/unit/legal/vsbg.unit.spec.ts`, `tests/int/legal/complaints.int.spec.ts` |
| R-120 | Rechnung je bezahlter Bestellung (§ 34a UStDV) | P4, P5 | int | ja | `tests/int/invoices/pdf.int.spec.ts`, `tests/int/orders/prepayment-admin.int.spec.ts` |
| R-121 | Lückenloser Nummernkreis, Storno statt Löschen | P4 | int | nein | `tests/int/invoices/numbering.int.spec.ts`, `tests/int/invoices/pdf.int.spec.ts` |
| R-122 | Unveränderbarkeit der Rechnungs-PDFs | P5 | int | nein | `tests/int/legal/invoice-integrity.int.spec.ts` |
| R-123 | Aufbewahrung von Rechnungen und Aufzeichnungen | P5, P6 | int | nein | `tests/int/legal/retention.int.spec.ts` |
| R-124 | Monatsexport ohne Kundendaten | P5 | int | nein | `tests/int/legal/datev-export.int.spec.ts`, `tests/int/legal/monthly-export.int.spec.ts` |
| R-125 | Umsatz-Wächter Kleinunternehmergrenzen | P5 | unit, int | ja | `tests/unit/legal/revenue-guard.unit.spec.ts`, `tests/unit/email/templates/admin-mails.unit.spec.ts`, `tests/int/jobs/revenue-guard.int.spec.ts` |
| R-126 | Kein Umsatzsteuerausweis im Kleinunternehmer-Modus | P3 | unit, e2e | nein | `tests/unit/seo/jsonld.unit.spec.ts`, `tests/unit/shop/price-note.unit.spec.ts`, `tests/e2e/seo/meta.e2e.spec.ts` |
| R-127 | „Offline verkauft“ ohne Kassenfunktion | P5 | int | nein | `tests/int/legal/offline-sale.int.spec.ts` |
| R-130 | Kein Speichern/Auslesen auf dem Endgerät vor Nutzeraktion | P2, P4 | e2e | nein | `tests/unit/behaviors/motion-toggle.unit.spec.ts`, `tests/e2e/motion-toggle.e2e.spec.ts`, `tests/e2e/privacy.e2e.spec.ts`, `tests/e2e/privacy/cart-cookie.e2e.spec.ts` |
| R-131 | Keine Drittanbieter-Requests, CSP, selbst gehostete Schriften | P2 | unit, e2e | nein | `tests/unit/legal/services.unit.spec.ts`, `tests/unit/security/csp.unit.spec.ts`, `tests/unit/security/headers.unit.spec.ts`, `tests/unit/tooling/check-external.unit.spec.ts` |
| R-132 | Statistik (Vercel Web Analytics) nur nach Freigabe | P10 | unit, e2e | ja | – |
| R-133 | Fehlerüberwachung ohne Personenbezug | P10 | unit, e2e | nein | – |
| R-134 | Spamschutz ohne Drittanbieter | P6, P7 | int | nein | `tests/int/legal/retention.int.spec.ts`, `tests/int/legal/withdrawal-form.int.spec.ts`, `tests/int/legal/withdrawal.int.spec.ts`, `tests/unit/lib/keys.unit.spec.ts`, `tests/int/commission/submit.int.spec.ts` |
| R-135 | Metadaten aus allen Bild-Uploads entfernen | P1, P7 | int | nein | `tests/int/collections/media.int.spec.ts`, `tests/int/collections/private-uploads.int.spec.ts`, `tests/e2e/admin-product-form.e2e.spec.ts`, `tests/int/commission/upload.int.spec.ts` |
| R-136 | Technisch-organisatorische Maßnahmen | P1, P10 | int, e2e | nein | `tests/int/access/access-matrix.int.spec.ts`, `tests/int/adapters/storage.contract.int.spec.ts`, `tests/int/collections/private-uploads.int.spec.ts`, `tests/int/collections/users.int.spec.ts` |
| R-137 | Keine personenbezogenen Daten in URLs und Logs | P4 | unit, e2e | nein | `tests/int/legal/privacy-export.int.spec.ts`, `tests/int/legal/withdrawal-form.int.spec.ts`, `tests/e2e/legal/withdrawal-flow.e2e.spec.ts`, `tests/unit/lib/logger.unit.spec.ts`, `tests/e2e/commission/form.e2e.spec.ts` |
| R-138 | Datenschutzhinweise am Ort der Erhebung | P4, P6, P7 | e2e | nein | `tests/e2e/legal/checkout-fields.e2e.spec.ts`, `tests/e2e/legal/withdrawal-flow.e2e.spec.ts`, `tests/e2e/commission/form.e2e.spec.ts` |
| R-139 | Instagram nur als Link | P3 | unit | nein | `tests/unit/legal/forbidden.unit.spec.ts`, `tests/e2e/legal/forbidden.e2e.spec.ts`, `tests/e2e/tattoo/no-purchase.e2e.spec.ts` |
| R-150 | Auskunft und Datenübertragbarkeit (Art. 15, 20 DSGVO) | P6 | int | nein | `tests/unit/legal/p6-mails.unit.spec.ts`, `tests/int/legal/privacy-export.int.spec.ts` |
| R-151 | Löschen und Einschränken mit Aufbewahrungssperre (Art. 17, 18) | P6 | int | nein | `tests/unit/legal/p6-mails.unit.spec.ts`, `tests/int/legal/privacy-erasure.int.spec.ts` |
| R-152 | Berichtigung, Widerspruch, Widerruf von Einwilligungen | P6 | int | nein | `tests/unit/legal/p6-mails.unit.spec.ts`, `tests/int/legal/privacy-erasure.int.spec.ts` |
| R-153 | Fristüberwachung Betroffenenanfragen | P6 | int | nein | `tests/unit/legal/gdpr-deadline.unit.spec.ts`, `tests/int/legal/privacy-requests.int.spec.ts` |
| R-154 | Automatische Löschjobs | P6 | int | nein | `tests/unit/legal/no-versions.unit.spec.ts`, `tests/int/legal/retention.int.spec.ts` |
| R-155 | Auftragsverarbeitungsverträge vor Go-live | P10, P11 | unit, manuell | ja | – |
| R-156 | Verzeichnis von Verarbeitungstätigkeiten | P6 | manuell | ja | `tests/unit/legal/briefing.unit.spec.ts`, `tests/unit/legal/services.unit.spec.ts` |
| R-157 | Prozess Datenpanne | P10 | manuell | ja | – |
| R-160 | Anfrageformular Auftragsarbeiten | P7 | int, e2e | nein | `tests/int/commission/submit.int.spec.ts`, `tests/int/commission/upload.int.spec.ts`, `tests/unit/email/inquiry-receipt.unit.spec.ts`, `tests/e2e/commission/form.e2e.spec.ts`, `tests/e2e/commission/flow.e2e.spec.ts` |
| R-161 | Verträge über Auftragsarbeiten außerhalb des Shops | P7, P11 | manuell | ja | §7 |
| R-162 | Keine weiteren Datenerhebungen | P10 | e2e | nein | – |
| R-170 | Tattoo-Bereich ohne Online-Vertragsschluss | P7 | unit, int, e2e | nein | `tests/unit/legal/tattoo-content.unit.spec.ts`, `tests/unit/tattoo/mailto.unit.spec.ts`, `tests/int/legal/tattoo-cart.int.spec.ts`, `tests/e2e/tattoo/no-purchase.e2e.spec.ts`, `tests/e2e/tattoo/flash.e2e.spec.ts` |
| R-171 | Abgelaufene Flash-Days/Aktionen ausblenden | P7 | int | nein | `tests/int/tattoo/offers.int.spec.ts`, `tests/int/jobs/revalidate-offers.int.spec.ts`, `tests/e2e/tattoo/offers.e2e.spec.ts` |
| R-172 | Portfolio-Fotos nur mit Einwilligung | P7 | int | ja | `tests/int/legal/gallery-consent.int.spec.ts`, `tests/int/legal/gallery-withdraw.int.spec.ts`, `tests/e2e/tattoo/gallery.e2e.spec.ts` |
| R-180 | Beispielbestand kennzeichnen und entfernbar | P8 | int | nein | `tests/int/seed/admin-remove.int.spec.ts`, `tests/int/collections/logs.int.spec.ts`, `tests/unit/seed/persons.unit.spec.ts`, `tests/e2e/admin-seed.e2e.spec.ts` |
| R-181 | `SEED_PREVIEW_MODE` nie in Produktion | P8 | unit, int | nein | `tests/unit/env/seed-preview.unit.spec.ts`, `tests/unit/env/assert-production.unit.spec.ts`, `tests/int/media/owner-approved.int.spec.ts`, `tests/int/legal/gallery-consent.int.spec.ts` |
| R-182 | Vorschau-Datei als interne Datei | P10 | unit | nein | – |
| R-190 | BFSG-Ausnahme dokumentiert, keine Konformitätsbehauptung | P10 | manuell | nein | – |
| R-191 | Freiwillige Barrierearmut (Ziel WCAG 2.2 AA) | P2, P10 | e2e | nein | `tests/e2e/a11y.e2e.spec.ts`, `tests/e2e/keyboard.e2e.spec.ts` |
| R-200 | LUCID-Registrierung und Systembeteiligung | P10, P11 | unit, manuell | ja | – |
| R-201 | Verpackungsmengen erfassen (je Sendung, Jahres-Export) | P5 | int | nein | `tests/int/legal/packaging-report.int.spec.ts`, `tests/unit/settings/rules.unit.spec.ts`, `tests/int/globals/settings.int.spec.ts` |
| R-202 | EU-Länder nur mit Pflicht-Bestätigung freischaltbar | P5 | int | nein | `tests/int/legal/eu-activation.int.spec.ts`, `tests/unit/settings/rules.unit.spec.ts`, `tests/int/globals/settings.int.spec.ts` |
| R-203 | GPSR-Herstellerpflichten am Produkt, Etiketten und Beileger | P5, P11 | int, manuell | ja | `tests/int/legal/compliance-docs.int.spec.ts`, `tests/int/legal/gpsr-label.int.spec.ts` |
| R-204 | Markenrecherche „Planet Claire“ (empfohlen) | P11 | manuell | ja | – |
| R-205 | Stammdaten und steuerliche Klärung | P11 | manuell | ja | – |
| R-210 | Startklar-Prüfung (Go-live-Gate) | P10, P11 | unit | ja | – |
| R-211 | Produktions-Rauchtest Recht | P11 | manuell | ja | – |

---

## 4. Anforderungen im Detail

### 4.1 Rahmen und Nachweis

#### R-001 · Nachverfolgbarkeit Anforderung ↔ Test
- **Anforderung:** Jede Anforderung mit Test-Art `unit`, `int` oder `e2e` ist durch mindestens einen automatisierten
  Test abgedeckt, dessen Titel die ID enthält. Manuelle Prüfungen werden in §7 abgehakt und in
  `docs/FORTSCHRITT.md` mit Datum vermerkt.
- **Rechtsgrundlage:** Rechenschaftspflicht Art. 5 Abs. 2 DSGVO; allgemeine Sorgfalt zur Abmahnvermeidung.
- **Umsetzung:** `tests/unit/legal/traceability.unit.spec.ts` liest die Tabelle in §3 (Zeilen, die mit `| R-` beginnen),
  filtert IDs mit Test-Art ≠ nur `manuell` und prüft per Dateisuche über `tests/**/*.ts`, dass jede ID als
  String vorkommt (Regex `R-\d{3}\b` in `test(`/`it(`/`describe(`-Titeln). Konstante `LEGAL_TRACE_PHASE` in der
  Testdatei: geprüft werden nur IDs, deren früheste Phase ≤ diesem Wert ist. Jede Phase erhöht den Wert auf ihre
  Nummer (P1 → 1 … P10 → 10).
- **Abnahme:** `unit` – Test grün; Gegenprobe: eine abgedeckte ID aus einem Testtitel entfernen → Test rot.
- **Phase:** P1 anlegen, jede Phase fortschreiben · **Owner:** nein

#### R-002 · Keine selbst formulierten Rechtstexte, Platzhalter-Kennzeichnung
- **Anforderung:** Sessions verfassen Impressum, Datenschutzerklärung, AGB, Widerrufsbelehrung,
  Muster-Widerrufsformular und Versand-/Zahlungsbedingungen **nicht** selbst. Bis zur Kanzlei-Lieferung gibt es
  Gliederungs-Platzhalter: Überschriften laut KANZLEI-BRIEFING §1, unter jeder Überschrift nur der Satz
  „Text folgt von der Kanzlei.“ Jede Seite mit Platzhalter zeigt oben ein gut sichtbares Band „PLATZHALTER – nicht
  rechtsverbindlich“; das Band rendert die Seite (`PlaceholderBanner`), es steht nicht im Inhalt.
  Kurze Textbausteine aus §6 dürfen mit der dort angegebenen Arbeitsfassung (`origin: 'draft'`) laufen.
  Wörtlich vorgegebene UI-Texte in diesem Dokument (Button-Beschriftungen) sind keine Platzhalter.
  Die sechs Platzhalter-Rechtstexte gehören zum **Grund-Seed** (`seed = false`, `origin = placeholder`,
  `validFrom = 2026-01-01`), nicht zum Beispielbestand: Sie bleiben beim Entfernen der Beispieldaten erhalten, bis
  Kanzleitexte aktiviert sind (DATENMODELL §13.1).
- **Rechtsgrundlage:** E-41; Haftungs- und Abmahnrisiko falscher Rechtstexte (§§ 3a, 5a UWG).
- **Umsetzung:** Feld `origin` (`placeholder` | `draft` | `lawyer`) an `legal-texts` und `legal-snippets` (R-012);
  `isPlaceholder` ist genau dann `true`, wenn `origin = placeholder`. Das vorhandene Feld `source` (`manual` |
  `itrk_lti`) beschreibt nur den Eingangsweg und ersetzt `origin` nicht. Komponente `PlaceholderBanner` rendert bei
  `origin !== 'lawyer'` für Volltexte. Go-live-Gate R-210 verlangt `origin = lawyer` für alle Volltexte und alle
  Bausteine mit „Kanzlei: ja“ in §6.
- **Abnahme:** `e2e` – mit Platzhalterdaten zeigt jede Rechtsseite den Banner; `unit` – Gate schlägt fehl, solange
  ein Pflichttext nicht `lawyer` ist.
- **Phase:** P6 · **Owner:** ja – Kanzlei beauftragen (KANZLEI-BRIEFING), Texte in P11 einspielen.

### 4.2 Rechtstexte und Pflichtseiten

#### R-010 · Pflichtseiten und stabile URLs
- **Anforderung:** Alle Seiten aus §2 existieren auf Deutsch und Englisch, werden serverseitig gerendert und sind
  **ohne JavaScript** vollständig lesbar. Kurz-URLs leiten per 308 weiter. Die URL der Widerrufsfunktion
  `https://planetclairetattoos.com/de/vertrag-widerrufen` bleibt dauerhaft stabil, weil sie in der
  Widerrufsbelehrung steht.
- **Rechtsgrundlage:** § 5 Abs. 1 DDG („leicht erkennbar, unmittelbar erreichbar und ständig verfügbar“);
  Art. 12, 13 DSGVO; § 312i Abs. 1 S. 1 Nr. 4 BGB; Art. 246a § 1 Abs. 2 EGBGB mit Anlage 1 und 2; § 356a BGB;
  § 312j Abs. 1 BGB.
- **Umsetzung:** Routen unter `src/app/(frontend)/[locale]/…` (Ordnernamen laut ARCHITEKTUR §2.1); Weiterleitungen
  laut §2 und KONZEPT §2.4; Inhalte aus `legal-texts` (R-012). `robots`: Rechtsseiten indexierbar; `noindex` nur für
  Kasse, Danke, Bestellstatus und Widerrufs-Schritte 2/Bestätigung.
- **Abnahme:** `e2e` – jede Route liefert 200 und genau eine `h1`; jede der sieben Kurz-URLs liefert 308 auf ihre
  DE-Route (auch mit `Accept-Language: en`) und setzt kein Cookie; `/en/imprint` und `/en/impressum` liefern 308 auf
  `/en/legal-notice`; mit `javaScriptEnabled: false` ist der Textkörper sichtbar.
- **Phase:** P2 (Routen mit Platzhaltern), P6 (Inhalte) · **Owner:** nein

#### R-011 · Footer mit Pflichtlinks auf jeder Seite
- **Anforderung:** Jede öffentliche Seite (alle `PUBLIC_PAGE_TYPES`, auch Kasse, Danke, 404, Fehlerseite) zeigt im
  Footer echte Links (`<a href>`) auf: Impressum, Datenschutz, AGB, Widerrufsbelehrung, Versand & Zahlung sowie
  hervorgehoben **„Vertrag widerrufen“** (R-090). Keine Animation, Linie, Coco-Figur oder Überlagerung verdeckt die
  Links; sie sind bei `prefers-reduced-motion` und ohne JavaScript sichtbar; kein Nachladen per JavaScript.
  Von jeder Seite höchstens 2 Klicks bis zu jeder Pflichtseite.
- **Rechtsgrundlage:** § 5 DDG; § 356a BGB; Art. 12 Abs. 1, Art. 13 DSGVO.
- **Umsetzung:** Server-Komponente `LegalFooter` als Unterkomponente des Fußbereichs `SiteFooter` (DESIGN KO-04) im
  Layout von `(frontend)/[locale]`, auch in `not-found.tsx` und `error.tsx`. Dekor-Ebenen (Tuschelinie, Coco) mit
  `pointer-events: none` und niedrigerem `z-index` als der Footer.
- **Abnahme:** `e2e` – für jeden Seitentyp, bei 390×844 und 1440×900, mit `reducedMotion: 'reduce'` und
  `'no-preference'`: 6 Links mit korrekten `href`, `toBeVisible()`, und `document.elementFromPoint()` in der
  Link-Mitte liefert den Link selbst (nach Scroll ans Seitenende).
- **Phase:** P2 · **Owner:** nein

#### R-012 · Rechtstexte und Textbausteine versioniert im CMS
- **Anforderung:** Collection `legal-texts` (DATENMODELL §6.12): `type` ∈ {`impressum`, `datenschutz`, `agb`,
  `widerrufsbelehrung`, `widerrufsformular`, `versand-zahlung`}; jede Fassung ist ein eigenes Dokument mit
  lokalisiertem Inhalt (`content`: DE verbindlich, EN unverbindliche Übersetzung; bereinigt, erlaubte Elemente siehe
  KANZLEI-BRIEFING §1.2), `version` (fortlaufend je Typ), `validFrom`, `status` ∈ {`draft`, `scheduled`, `active`,
  `superseded`} (`active` = „veröffentlicht“), `origin` (R-002), `isPlaceholder`, Hash des gerenderten Texts, PDFs je
  Sprache (bei Aktivierung erzeugt, mindestens für `agb`, `widerrufsbelehrung`, `widerrufsformular`, `datenschutz`),
  Aktivierungszeitpunkt und Änderungsnotiz. Aktive und abgelöste Fassungen sind **unveränderlich**; Änderung = neue
  Fassung. Je Typ ist genau eine Fassung `active` mit `validFrom ≤ jetzt`.
  **Textbausteine** (Schlüssel aus §6) folgen demselben Muster: bis P6 als versionierte Konstanten in
  `src/lib/legal/snippets.ts` (`origin: 'draft'`, Version `draft-1`), ab P6 in der Collection `legal-snippets`
  (Schlüssel, lokalisierter Text, Version, Status, `validFrom`, `origin`, Hash).
  **Platzhalter-Tokens** (kanonische Liste, gleichlautend mit KANZLEI-BRIEFING §16.3; keine weiteren Schreibweisen,
  keine Aliase) werden beim Rendern ersetzt:

  | Token | Wert |
  |---|---|
  | `{{name}}` | `settings.business.legalName`, bei gesetztem `tradeName` ergänzt um die Geschäftsbezeichnung |
  | `{{street}}`, `{{postalCode}}`, `{{city}}` | `settings.business.street`, `.postalCode`, `.city` |
  | `{{email}}`, `{{phone}}` | `settings.business.email`, `.phone` |
  | `{{wIdNr}}`, `{{ustIdNr}}` | `settings.business.economicId`, `.vatId` (die einzigen Tokens, die leer ersetzt werden dürfen) |
  | `{{siteUrl}}` | `NEXT_PUBLIC_SITE_URL` |
  | `{{withdrawalUrl}}` | `NEXT_PUBLIC_SITE_URL` + `/de/vertrag-widerrufen` (im EN-Inhalt `/en/withdraw-from-contract`) |
  | `{{shippingTable}}` | Tabelle aus `settings.shipping.rates` (Zone DE) plus Abholung und Regel „höchste Versandklasse“ |
  | `{{deliveryTime}}` | `settings.shipping.deliveryTimeText` in der Sprache des Inhalts |
  | `{{vorkasseDays}}` | `settings.payment.prepaymentDays` |
  | `{{returnCostsNote}}` | aktiver Baustein `withdrawal.returnCostsNote` (§6) |

  Ein unbekanntes oder unersetztes Token ist ein Render-Fehler (Aktivieren gesperrt, öffentliche Seiten zeigen nie
  rohe Tokens). Für die Steuernummer gibt es bewusst **kein** Token: `{{STEUERNUMMER}}` und jede andere Schreibweise
  gelten als unbekannt (E-46, R-020). Bausteine dürfen zusätzlich die Kontext-Tokens verwenden, die in §6 bei ihrer
  Arbeitsfassung stehen (z. B. `{{orderNumber}}` in `email.vorkasse.*`).
  Die Tabelle der Auftragsverarbeiter und Empfänger ist **kein** Token: Sie ist eine generierte Komponente, die die
  Seite unter bzw. neben dem Datenschutztext rendert (Quelle: YAML in DIENSTE.md §7 und
  `settings.processorAgreements`, R-155). Die Token-Liste oben bleibt damit geschlossen.
- **Rechtsgrundlage:** § 312i Abs. 1 S. 1 Nr. 4 BGB (Vertragsbestimmungen abrufbar und speicherbar), § 312f Abs. 2
  BGB, E-41.
- **Umsetzung:** Payload-Collections; Anlegen und Ändern nur im Status `draft`; Aktivierung über den Dienst
  `src/lib/legal/activate.ts` (Vorgängerfassung → `superseded` in derselben Transaktion; PDFs und Hash per Task
  `renderLegalTextPdf`; geplante Fassungen per `activateScheduledLegalTexts`). Ein Renderer für Rechtstexte und
  Bausteine (`src/lib/legal/`).
- **Abnahme:** `int` – v1 aktivieren, Update-Versuch → Fehler/403; v2 aktivieren → v1 `superseded`; Hash stimmt;
  Text mit `{{unknown}}` bzw. `{{STEUERNUMMER}}` → Render-Fehler; je Baustein-Schlüssel genau eine aktive Version.
- **Phase:** P1 (Modell `legal-texts`), P3 (Bausteine als Konstanten), P6 (`legal-snippets`, PDF, Rendering) ·
  **Owner:** nein

#### R-013 · Bestellung speichert Rechtstext-Versionen und Snapshot
- **Anforderung:** Beim Klick auf „Zahlungspflichtig bestellen“ speichert die Kasse (`checkouts`) und bei der
  Bestellanlage unverändert die Bestellung: die IDs der aktiven Fassungen von `agb`, `widerrufsbelehrung`,
  `widerrufsformular`, `datenschutz`, `versand-zahlung` (je Fassung DE und EN in einem Dokument), die Versionen der
  verwendeten Bausteine (`checkout.legalNotice`, `checkout.dhlEmailConsent`, `checkout.deviationAgreement`) sowie
  je Position einen Snapshot: Titel DE/EN, Objektnummer, Kategorie, angezeigte wesentliche Eigenschaften
  (Maße, Material/Fasern, Größe, Zustand, Lebensmittelkontakt, Metallteile, Abweichungstext), Preis, Versandklasse,
  Bildreferenz; dazu Versandkosten, Gesamtbetrag und Steuermodus. Der Snapshot ist nach dem Anlegen unveränderlich.
- **Rechtsgrundlage:** § 312f Abs. 2 BGB; § 312i Abs. 1 S. 1 Nr. 4 BGB; Beweisfunktion; Art. 7 Abs. 1 DSGVO
  (Nachweis der DHL-Einwilligung).
- **Umsetzung:** `checkouts.legalTextVersions` → `orders.legalTextVersions` (`agb`, `widerrufsbelehrung`,
  `widerrufsformular`, `datenschutz`, `versandZahlung`), Baustein-Versionen in `orders.legalSnippetVersions`,
  Positions-Snapshot in `orders.items[]` (u. a. `titleDe`/`titleEn`, `itemNumber`, `category`,
  `characteristicsDe`/`characteristicsEn`, `priceCents`, `shippingClass`, `foodContact`, `deviationText`,
  `deviationAgreedAt`), Einwilligungen und Vereinbarungen zusätzlich im `consent-log` (angezeigter Text + Hash);
  unveränderlich laut DATENMODELL §6.8.3.
- **Abnahme:** `int` – Bestellung anlegen, danach neue AGB aktivieren und Produkt ändern → Bestellung verweist
  weiter auf die alte Fassung, Snapshot unverändert.
- **Phase:** P4 · **Owner:** nein

#### R-014 · Jährliche Prüf-Erinnerung Rechtstexte
- **Anforderung:** Dashboard-Kachel „Rechtstexte“: je Typ Version, gültig ab, Herkunft (`origin`), Alter. Warnung,
  wenn ein Typ fehlt, `origin ≠ lawyer` oder die letzte Aktivierung/Prüfung älter als 365 Tage ist. Task
  `legalReviewReminder` (täglich, ARCHITEKTUR Anhang A.3) schickt beim Erreichen von 365 Tagen **eine** Mail
  (`admin_legal_review_due`) an `settings.adminNotificationEmail` und danach alle 30 Tage erneut, bis eine neue Fassung
  aktiviert oder „geprüft, keine Änderung“ gesetzt wurde.
- **Rechtsgrundlage:** E-41; Sorgfalt (Rechtsänderungen wie § 356a BGB 2026).
- **Umsetzung:** Payload-Task; Prüfstand je Typ in `settings.legal.reviews[]` {`type`, `reviewedAt`,
  `lastReminderSentAt`} (DATENMODELL §7.1).
- **Abnahme:** `int` mit Fake-Zeit: Tag 364 keine Mail, Tag 365 eine Mail, Tag 380 keine, Tag 395 eine.
- **Phase:** P6 · **Owner:** ja – jährlich prüfen lassen oder „geprüft“ klicken.

#### R-015 · Englische Rechtstexte als unverbindliche Übersetzung
- **Anforderung:** `/en/…`-Rechtsseiten zeigen die EN-Version, oben mit Baustein `translation.disclaimer`. Fehlt
  eine EN-Version, wird der deutsche Text mit englischem Hinweis „Only available in German“ angezeigt.
  Bestellbestätigungen enthalten immer die **deutschen** PDFs; bei EN-Bestellungen zusätzlich die EN-PDFs, falls
  vorhanden. Standard bis zur Kanzlei-Antwort (K-05): Vertragssprache Deutsch.
- **Rechtsgrundlage:** Art. 246c Nr. 4 EGBGB (Vertragssprachen); Transparenzgebot § 307 Abs. 1 S. 2 BGB.
- **Umsetzung:** Fallback-Logik im Rechtstext-Loader.
- **Abnahme:** `e2e` – `/en/terms` mit und ohne EN-Version.
- **Phase:** P6 · **Owner:** nein

### 4.3 Impressum und Anbieterkennzeichnung

#### R-020 · Impressum aus Stammdaten
- **Anforderung:** Das Impressum (Kanzleitext) füllt seine Werte aus der Einstellungsgruppe `settings.business`:
  `legalName` (Vor- und Nachname), optional `tradeName` („Planet Claire“), `street`, `postalCode`, `city`,
  `country`, `email` (jutta@planetclairetattoos.com), `phone` (R-021), optional `economicId` (W-IdNr.) und `vatId`
  (USt-IdNr.). Adresse = Privatadresse (E-40), **kein Postfach** (Validierung lehnt `/postfach|\bpf\.?\s?\d/i` ab).
  Dieselben Stammdaten speisen GPSR-Block (R-040), Rechnungen (R-120), Widerrufsbelehrung und Mail-Footer (R-080).
  `settings.business.taxNumber` (Steuernummer) ist nie öffentlich sichtbar (nicht in `getPublicSettings()`, kein
  Token, R-012), nur auf Rechnungen.
- **Rechtsgrundlage:** § 5 Abs. 1 Nr. 1, 2, 6 DDG; Art. 246a § 1 Abs. 1 S. 1 Nr. 2 EGBGB; E-40. Kanzlei: K-28, K-39
  (Privatadresse macht den Studio-Ort öffentlich, E-50; die Entscheidung bleibt bei Jutta, bis dahin gilt E-40).
- **Umsetzung:** Global `settings`, Gruppe `business` (DATENMODELL §7.1) mit Validierung; Token-Rendering (R-012).
- **Abnahme:** `int` – Postfach-Adresse wird abgelehnt; `e2e` – Impressum enthält alle gesetzten Felder, keine
  Steuernummer.
- **Phase:** P6 · **Owner:** ja – Daten in P11 eintragen.

#### R-021 · Telefonnummer für Impressum und Widerrufsbelehrung [ergänzt]
- **Anforderung:** `settings.business.phone` ist für den Go-live Pflicht (R-210). Es darf eine eigene Geschäftsnummer
  sein (z. B. zweite SIM oder VoIP). Anzeige im Impressum, in der Widerrufsbelehrung (Token `{{phone}}`) und in der
  Anbieterkennung der Bestellbestätigung; sonst nirgends.
- **Rechtsgrundlage:** Anlage 1 zu Art. 246a § 1 Abs. 2 S. 2 EGBGB, Gestaltungshinweis 2 (seit 28.05.2022
  Telefonnummer ohne Einschränkung „soweit verfügbar“); Art. 246a § 1 Abs. 1 S. 1 Nr. 2 EGBGB; § 5 Abs. 1 Nr. 2 DDG
  (schnelle elektronische Kontaktaufnahme). Kanzlei bestätigt: K-10, K-28.
- **Umsetzung:** Pflichtfeld für das Gate; Formatprüfung (E.164 oder deutsches Format).
- **Abnahme:** `unit` – Gate schlägt ohne Telefonnummer fehl.
- **Phase:** P6 · **Owner:** ja – Nummer festlegen.

#### R-022 · Impressum-Link im Instagram-Profil
- **Anforderung:** Das geschäftlich genutzte Instagram-Profil @planet.claire.tattoos hat in der Bio einen Link auf
  `https://planetclairetattoos.com/impressum` (zusätzlich zum Link auf die Startseite).
- **Rechtsgrundlage:** § 5 DDG (auch für geschäftliche Social-Media-Profile). Kanzlei: K-29.
- **Umsetzung:** Kurz-URL stabil (R-010); Schritt in der Owner-Anleitung.
- **Abnahme:** `manuell` – in P11 am Handy: Link in der Bio öffnet das Impressum im Instagram-In-App-Browser.
- **Phase:** P11 · **Owner:** ja

#### R-023 · Kontaktseite ohne Formular und ohne Karte
- **Anforderung:** `/de/kontakt` zeigt E-Mail-Adresse als `mailto:`-Link **und** als markierbaren Klartext,
  Instagram-Link (R-139) und nur den **Bezirk** (E-50). Keine Karte, kein Kontaktformular, kein Chat-Widget.
- **Rechtsgrundlage:** § 5 DDG (Erreichbarkeit); § 25 TDDDG und Art. 5 Abs. 1 lit. c DSGVO (keine Einbettungen);
  E-50, E-51.
- **Abnahme:** `e2e` – E-Mail-Text vorhanden, kein `iframe`, kein `<form>`.
- **Phase:** P6 (Kontaktseite R20 entsteht mit den Rechtsseiten, KONZEPT §3.13) · **Owner:** nein

### 4.4 Preisangaben und Steuer-Anzeige

#### R-030 · Kleinunternehmer-Preishinweis an jedem Preis
- **Anforderung:** Überall, wo ein Preis einer kaufbaren Ware oder eine Summe erscheint (Preisschilder in der
  Übersicht, Produktseite, Warenkorb, Kasse, Danke-Seite, Bestellstatus, Mails, Rechnung), steht der **Endpreis in
  Euro** mit dem Baustein `price.kleinunternehmerNote` und – auf Übersicht und Produktseite – `price.shippingNote`
  als Link auf `/de/versand-und-zahlung`. Auf Preisschildern ist ein Sternchen erlaubt; die Auflösung steht dann auf
  **derselben Seite** gut sichtbar (unter dem Raster und im Footer der Shop-Seiten). In Warenkorb und Kasse werden
  die Versandkosten konkret beziffert.
- **Rechtsgrundlage:** § 3 Abs. 1, § 6 PAngV; §§ 5, 5a UWG; § 19 UStG; E-02. Kanzlei: K-23.
- **Umsetzung:** Zentrale Komponente `PriceNote` und Geldformat `formatMoney` aus `src/lib/money.ts`; Text abhängig
  vom geltenden Steuermodus in `settings.tax.modes` (R-032). Keine Preisausgabe ohne diese Komponente (Lint-Regel oder
  Test auf `formatMoney`-Aufrufe außerhalb von `PriceNote`/Mail/PDF-Modulen).
- **Abnahme:** `unit` – `PriceNote` liefert je Modus den richtigen Text; `e2e` – Produktseite enthält Preis, Hinweis
  und Link; Übersicht enthält Sternchen und Auflösung.
- **Phase:** P3 (Anzeige), P4 (Warenkorb/Kasse), P5 (Mails/Rechnung) · **Owner:** nein

#### R-031 · Versandkosten vor dem Warenkorb erkennbar
- **Anforderung:** `/de/versand-und-zahlung` rendert die Versandklassen mit Preisen aus den Einstellungen (E-25:
  Brief 4,50 €, Paket klein 6,50 €, Keramik 8,90 €, Abholung 0 €), die Regel „im Warenkorb gilt die höchste
  Versandklasse“, das Liefergebiet, die Lieferzeit und die Zahlarten (Token `{{shippingTable}}`). Die Produktseite
  nennt die Versandklasse des Stücks mit Preis und die Abholoption. Der Warenkorb zeigt die berechneten Versandkosten
  vor dem Wechsel zur Kasse.
- **Rechtsgrundlage:** § 6 PAngV; Art. 246a § 1 Abs. 1 S. 1 Nr. 4 EGBGB; § 312j Abs. 1 BGB.
- **Umsetzung:** Server-seitige Berechnung (höchste Klasse); Revalidierung der Seiten bei Änderung der Einstellungen.
- **Abnahme:** `e2e` – Preis in den Einstellungen ändern → Versandseite und Produktseite zeigen den neuen Preis;
  Warenkorb mit Brief + Keramik zeigt 8,90 €.
- **Phase:** P3, P4 · **Owner:** nein

#### R-032 · Steuermodus-Schalter mit Gültig-ab
- **Anforderung:** Einstellung `settings.tax.modes` (Liste {`mode` ∈ {`kleinunternehmer`, `regelbesteuert`},
  `validFrom`}; Grund-Seed `kleinunternehmer` ab 2026-01-01); geltend ist der letzte Eintrag mit `validFrom ≤
  Zeitpunkt`. Jede Änderung wird unveränderlich protokolliert (Audit `tax_mode_changed`). Der Modus wirkt auf
  Preishinweise („inkl. X % USt.“ nur im Modus `regelbesteuert`), Kassen-Zusammenfassung, Rechnungen
  (§ 14 Abs. 4 UStG), Mails und JSON-LD. Belege vor `validFrom` bleiben unverändert. Produktfeld `vatCategory` ∈
  {`standard`, `reduced_art`}, Standard `standard`; `reduced_art` nur mit Pflicht-Begründung `vatReducedReason`
  (Anlage 2 Nr. 53 UStG: vollständig handgeschaffene Gemälde/Zeichnungen, Originalgrafik, Bildhauerkunst;
  **nicht** handbemalte Gebrauchsgegenstände wie Caps, Shirts, Schalen, Teller, Fliesen, Schmuck). Umschalten
  verlangt einen Bestätigungsdialog („mit Steuerberatung abgestimmt“).
- **Rechtsgrundlage:** § 19 UStG; § 12 Abs. 2 Nr. 1 i. V. m. Anlage 2 Nr. 53 UStG; § 14 Abs. 4 UStG; § 14c UStG.
- **Umsetzung:** Eine reine Steuerfunktion in `src/lib/tax.ts` (Modus zum Zeitpunkt, Steuerzeilen); alle Anzeigen,
  Belege und Mails lesen daraus. Namen laut DATENMODELL §4, §6.6.1, §7.1.
- **Abnahme:** `unit` – Preis- und Steuerberechnung in beiden Modi; `int` – Rechnung vor/nach `validFrom`.
- **Phase:** P1 (Modell), P4/P5 (Nutzung) · **Owner:** nein (Umschalten nur nach Rücksprache Steuerberatung)

#### R-033 · Keine Streich- und Rabattpreise, Preis-Historie
- **Anforderung:** Keine durchgestrichenen Preise, kein „statt“, „UVP“, „Sale“, „-x %“, keine Rabattcodes
  (ENTSCHEIDUNGEN „Später“). Das Produktmodell hat **kein** Vergleichspreis-Feld. Jede Preisänderung wird mit
  Zeitstempel sowie altem und neuem Preis protokolliert (Audit `product_price_changed`, DATENMODELL §6.6.8), damit
  § 11 PAngV später erfüllbar ist.
- **Rechtsgrundlage:** § 11 PAngV; § 5 UWG.
- **Abnahme:** `unit` – V-20-Scan; `int` – Preisänderung erzeugt Historien-Eintrag.
- **Phase:** P3 · **Owner:** nein

#### R-034 · Tattoo-Preise als Gesamtpreise
- **Anforderung:** Flash-Festpreise (`flash.priceCents`), Preisangaben zu Flash-Days (`tattoo-offers.priceNote`),
  Mindestpreis (`settings.tattoo.minPriceCents`) und Preisrahmen für Custom-Motive (`settings.tattoo.customPriceFromCents`
  / `customPriceToCents`, E-53) werden als Gesamtpreise in Euro mit Baustein `price.tattooNote` angezeigt. „ab“-Preise
  nur, wenn der genannte Preis tatsächlich angeboten wird. Keine Anzahlungsbeträge mit Verfallsklausel (V-24).
- **Rechtsgrundlage:** § 3 PAngV; § 5 UWG; E-53.
- **Abnahme:** `e2e` – Flash-Seite zeigt Preis + Hinweis; `unit` – V-24-Scan über Tattoo-Inhalte.
- **Phase:** P7 · **Owner:** nein

#### R-035 · Lieferzeit-Angabe
- **Anforderung:** Die Lieferzeit aus den Einstellungen (`settings.shipping.deliveryTimeText`, E-31, Standard
  „2–5 Werktage“) steht auf der Produktseite,
  im Warenkorb, in der Bestellübersicht und in der Bestellbestätigung. Bei Vorkasse mit dem Zusatz „ab
  Zahlungseingang“. Bei Abholung: Baustein `delivery.timePickup`. Keine vagen Angaben wie „ca.“ oder „in der Regel“.
- **Rechtsgrundlage:** Art. 246a § 1 Abs. 1 S. 1 Nr. 7 EGBGB; § 312j Abs. 2 BGB. Formulierung: K-06.
- **Abnahme:** `e2e` – Text auf allen vier Stellen vorhanden; mit Vorkasse gewählt steht der Zusatz in der Übersicht.
- **Phase:** P3, P4 · **Owner:** nein

#### R-036 · Zahlarten und Lieferbeschränkungen zu Beginn des Bestellvorgangs
- **Anforderung:** Der Warenkorb zeigt **vor** dem Button zur Kasse den Baustein `cart.paymentAndDeliveryInfo`:
  akzeptierte Zahlarten (Kredit-/Debitkarte, Apple Pay, Google Pay, PayPal, Vorkasse per Überweisung) und
  „Lieferung nur innerhalb Deutschlands; Abholung in Berlin nach Absprache“. Die Produktseite zeigt den Satz zum
  Liefergebiet in der Nähe von „In den Korb“.
- **Rechtsgrundlage:** § 312j Abs. 1 BGB.
- **Abnahme:** `e2e` – Warenkorb enthält beide Angaben oberhalb des Kassen-Buttons.
- **Phase:** P4 · **Owner:** nein

### 4.5 Produktangaben

#### R-040 · Block „Herstellerin & Produktsicherheit“ (GPSR)
- **Anforderung:** Jede Produktdetailseite – **alle Kategorien, auch Zeichnungen/Aquarelle** – zeigt ohne Klick
  (kein Akkordeon, kein Tab, kein `<details>`) einen Block mit: Name der Herstellerin (`legalName`, optional
  `tradeName`), Postanschrift, E-Mail-Adresse, Produktart (Kategorie), Objektnummer, Warn- und Sicherheitshinweise.
  Das Produktfoto auf derselben Seite erfüllt die Abbildungspflicht. Warnhinweise immer **auf Deutsch**; auf
  `/en/…` zusätzlich englisch. Stammdaten aus `settings.business` (E-40, Privatadresse).
- **Rechtsgrundlage:** Art. 19 lit. a, c, d VO (EU) 2023/988 (GPSR); E-40. Kanzlei: K-16, K-39.
- **Umsetzung:** Komponente `ProductSafetyBlock`; Produktfeld `safetyWarnings` (DE/EN), vorbelegt aus
  `settings.safetyTemplates` je Kategorie; die Pflicht-Hinweise aus den Bausteinen `product.*` (§6: Deko-Keramik,
  Schmuck-Kleinteile, Glasrahmen) ergänzt das System automatisch; bewusst „Keine besonderen Warnhinweise“ (Baustein
  `product.noSpecialWarnings`) ist möglich, außer bei Schmuck und Keramik.
- **Abnahme:** `e2e` – je Kategorie ein Seed-Stück: Block ohne Interaktion sichtbar, enthält Name, Straße, E-Mail,
  „Nr. …“ und Warntext; auf `/en/…` steht der deutsche Warntext zusätzlich zum englischen.
- **Phase:** P3 · **Owner:** nein

#### R-041 · Objektnummer als Produktkennung
- **Anforderung:** E-12: `products.itemNumber`, rein numerisch, von Jutta eingetragen, `UNIQUE`, System schlägt die
  nächste freie Zahl vor,
  nach der ersten Veröffentlichung unveränderlich. Anzeige „Nr. 017“ (mindestens dreistellig mit führenden Nullen).
  Die Nummer steht auf Produktseite, Preisschild, Warenkorb, Übersicht, Bestellbestätigung, Rechnung, Packzettel,
  Etikett und Beileger.
- **Rechtsgrundlage:** Art. 19 lit. c, Art. 9 Abs. 5 GPSR; § 34a UStDV (Bezeichnung der Ware).
- **Abnahme:** `unit` – Formatierung; `int` – doppelte Nummer abgelehnt; Änderung nach Veröffentlichung abgelehnt.
- **Phase:** P1 · **Owner:** nein

#### R-042 · Veröffentlichungs-Validierung je Kategorie
- **Anforderung:** Der Wechsel auf „online“ ist **serverseitig** gesperrt (Hook, gilt auch für REST/GraphQL/Local API),
  solange Pflichtfelder fehlen. Allgemein: Objektnummer, Titel DE, Beschreibung DE, ≥ 1 Bild mit Alt-Text DE und EN
  (R-191), Preis > 0, Kategorie, Versandklasse, Gewicht, Maße (bei Textil/Cap die Größe), Material (`materials`),
  `safetyWarnings` DE (oder bewusst „Keine besonderen Warnhinweise“, wo erlaubt), `ownDesignConfirmed` (R-047),
  Entscheidung zur Abweichung (R-048), vollständige Herstellerangaben in `settings.business`. Kategorie-spezifisch:
  R-043 bis R-046. Die vollständige Regeltabelle steht in DATENMODELL §6.6.6 (`validateForPublish`); sie erfüllt
  mindestens diese Anforderung. Fehlermeldungen nennen das fehlende Feld in einfachem Deutsch.
- **Rechtsgrundlage:** Art. 19 GPSR; Art. 16 VO (EU) 1007/2011; § 10 BedGgstV; REACH Anhang XVII Nr. 27, 63;
  § 476 BGB; E-15 bis E-18.
- **Abnahme:** `int` – je Kategorie: jedes Pflichtfeld einzeln leer → Veröffentlichung abgelehnt mit Feldname;
  vollständig → erfolgreich; auch über die Local API.
- **Phase:** P1 · **Owner:** nein

#### R-043 · Textil: Faserzusammensetzung, Größe, Zustand, Second-Hand
- **Anforderung:** Für Kleidung und Caps (Kategorien `textil`, `cap`; E-16) Pflicht:
  - `fiberComposition`: Liste {`component` (`main` | `lining` | `trim` | `other`), `fiber` aus dem Enum
    `TEXTILE_FIBERS` der **amtlichen deutschen Faserbezeichnungen nach Anhang I** VO (EU) 1007/2011 (z. B. Baumwolle,
    Polyester, Viskose, Elasthan, Wolle, Leinen, Polyamid, Polyacryl, Seide), `percent` (Ganzzahl)}; je Komponente
    Summe exakt 100, mindestens eine Zeile `main`. Keine Abkürzungen, keine Fasern als Freitext.
  - `sizeLabel` (Text, z. B. „M“ oder „Kopfumfang 56–60 cm“), `condition` (Enum `like_new` | `very_good` | `good` |
    `worn`) plus Freitext `conditionNote`.
  - `isSecondHand` ist für Textil und Cap immer `true`; Anzeige per Baustein `product.textileSecondHand`.
  - Option `labelMissing`: Faserangabe trotzdem Pflicht („nach bestem Wissen“) **und** der Freitext
    `fiberFreeText` (DE) mit Baustein `product.textileLabelMissing` (strengste Lesart, Standard bis K-12 beantwortet
    ist).
  - `careInstructions` als Text (optional, empfohlen); keine GINETEX-Symbole (V-13 Anmerkung).
  Die Faserangabe steht auf der Produktseite **vor** „In den Korb“ nahe Preis/Beschreibung (nicht eingeklappt) und
  als wesentliche Eigenschaft in Übersicht und Bestellbestätigung. Auf `/en/…` amtliche deutsche Bezeichnung plus
  englische Übersetzung in Klammern.
- **Rechtsgrundlage:** Art. 14, 16 Abs. 1 und 3, Anhang I VO (EU) 1007/2011 (Ausnahme Anhang V Nr. 13 für ausdrücklich
  als gebraucht bezeichnete Textilien – E-16 verlangt die Angabe trotzdem); § 5a UWG; E-16. Kanzlei: K-12.
- **Abnahme:** `unit` – Summe 99/101 abgelehnt, 100 akzeptiert; unbekannte Faser abgelehnt; `labelMissing` ohne
  Faserangabe oder ohne `fiberFreeText` abgelehnt; `e2e` – „100 % Baumwolle“ ohne Interaktion oberhalb des
  Korb-Buttons sichtbar.
- **Phase:** P1 (Modell), P3 (Anzeige) · **Owner:** nein

#### R-044 · Keramik: Lebensmittelkontakt-Status und Konformitätserklärung
- **Anforderung:** E-15. Feld `foodContact` ∈ {`deko`, `lebensmittelecht`}, Standard `deko`.
  - `deko`: Badge + Warnhinweis Baustein `product.ceramicsDecorative` („Dekorationsobjekt – nicht für
    Lebensmittel geeignet“).
  - `lebensmittelecht` ist nur **speicherbar** (Prüfung beim Speichern, nicht erst beim Veröffentlichen), wenn ≥ 1
    Konformitätserklärung verknüpft ist (`conformityDeclarations` → Collection `conformity-declarations`: Glasur,
    Hersteller, Laborbefund privat, Labor, Prüfdatum, öffentliches Erklärungs-PDF, Status `active`/`revoked`) und
    **jede** verknüpfte Erklärung `active` ist. Wird eine Erklärung `revoked`, gehen alle verknüpften
    `lebensmittelecht`-Stücke im Status `available` automatisch offline (Systemübergang `available → draft`), Jutta
    bekommt eine Admin-Mail und die Stücke einen `adminAttention`-Hinweis.
  - Bei `lebensmittelecht`: Badge „Für Lebensmittel geeignet“ mit Link auf die Erklärung unter
    `/de/konformitaetserklaerungen`. Die Seite R27 ist immer erreichbar; ohne aktive Erklärung zeigt sie nur einen
    neutralen Text („Derzeit sind alle Keramiken als Dekoration gekennzeichnet und nicht für Lebensmittel bestimmt.“,
    KONZEPT §3.14). Fußlink und Badge-Link erscheinen nur, wenn mindestens eine aktive Erklärung existiert.
  - Solange `deko`: Produkttexte dürfen „lebensmittelecht“, „spülmaschinenfest“, „mikrowellengeeignet“,
    „geprüft“, „für Speisen“ u. ä. nicht enthalten (Validierung blockiert die Veröffentlichung, V-13).
  - Der Status erscheint auch in Übersicht und Bestellbestätigung.
- **Rechtsgrundlage:** VO (EG) 1935/2004; RL 84/500/EWG i. d. F. 2005/31/EG; § 10 Abs. 2 BedGgstV und Anlage 6;
  Art. 19 lit. d GPSR; § 5 UWG; E-15. Kanzlei: K-14.
- **Abnahme:** `int` – `lebensmittelecht` ohne bzw. mit widerrufener Erklärung beim Speichern abgelehnt, mit aktiver
  Erklärung akzeptiert; Erklärung auf `revoked` → Stück `draft`, Admin-Mail eingereiht; `unit` – Text-Lint; `e2e` –
  Badge sichtbar; R27 ohne Erklärungen liefert 200 mit neutralem Text und steht nicht im Footer.
- **Phase:** P1, P3 · **Owner:** ja (optional) – Glasuren prüfen lassen, Erklärungen hochladen; Deko-Stücke am Boden
  dauerhaft „Nur Deko – nicht für Lebensmittel“ kennzeichnen (R-203).

#### R-045 · Schmuck: Nickel-Nachweis, bleifreie Glasur, Kleinteile-Warnung
- **Anforderung:** E-17. Veröffentlichung nur mit
  - `nickelFreeConfirmed = true` (Häkchen „Metallteile nickelfrei, Nachweis liegt vor“) und hochgeladenem Nachweis
    `nickelEvidence` (privat, `private-uploads`, R-136),
  - `metalPartsMaterial` (Text, z. B. „Edelstahl 316L“),
  - `leadFreeGlazeConfirmed = true` (Häkchen „Glasur bleifrei laut Hersteller-Datenblatt“) **[ergänzt]**.
  Der Warnhinweis `product.jewelrySmallParts` (`smallPartsWarning = true`) wird automatisch in `safetyWarnings`
  eingefügt und ist nicht entfernbar. Die Aussage „nickelfrei“ erscheint nur als Baustein `product.jewelryNickel`
  (mit Nachweis-Hinweis).
- **Rechtsgrundlage:** REACH (VO (EG) 1907/2006) Anhang XVII Nr. 27 (Nickel), Nr. 63 (Blei), Nr. 23 (Cadmium);
  Art. 19 lit. d GPSR; E-17. Kanzlei: K-15.
- **Abnahme:** `int` – ohne eines der Häkchen abgelehnt; Warnhinweis nach Speichern vorhanden und nicht löschbar.
- **Phase:** P1, P3 · **Owner:** ja – Ösen/Ketten nur mit Lieferantenerklärung kaufen; Glasur-Datenblatt ablegen.

#### R-046 · Zeichnungen und Aquarelle
- **Anforderung:** GPSR-Block trotz möglicher Kunst-Ausnahme immer anzeigen (R-040). Pflicht (Kategorie
  `zeichnung`): Technik und Papier/Träger (in `materials`, z. B. „Aquarell auf Papier 300 g“), Maße, `framed`
  (bool) und bei gerahmten Stücken `frameHasGlass`; bei Rahmen mit Glas automatisch Warnhinweis `product.glassFrame`.
  Nur Originale (E-10); `vatCategory = reduced_art` (R-032) nur für diese Kategorie auswählbar.
- **Rechtsgrundlage:** Art. 2 Abs. 2 lit. i, Art. 3 Nr. 28 GPSR (Ausnahme unsicher → Angaben trotzdem); Kanzlei: K-16.
- **Abnahme:** `int` – `framed` mit `frameHasGlass` ergänzt Warnhinweis; `reduced_art` bei anderer Kategorie
  abgelehnt.
- **Phase:** P1, P3 · **Owner:** nein

#### R-047 · Nur eigene Motive, keine fremden Marken
- **Anforderung:** E-18. Pflicht-Häkchen `ownDesignConfirmed` („Das Motiv zeigt nur eigene Figuren – keine
  geschützten fremden Figuren, Marken, Logos oder Schriftzüge Dritter“). Für Textil und Cap zusätzlich
  `blankBrandVisible` (sichtbares Hersteller-Logo auf dem gebrauchten Rohling): Ist es `true`, bleibt die
  Veröffentlichung gesperrt, bis die Einstellung `settings.legal.allowVisibleBlankBrands` (Standard `false`, nur nach
  Kanzlei-Antwort K-13 umstellbar) `true` ist. Titel und Beschreibung von Verkaufsware dürfen keine fremden Marken- oder
  Figurennamen enthalten (Lint-Liste V-16). Im Tattoo-Portfolio gilt diese Regel nicht (dort keine Verkaufsware).
- **Rechtsgrundlage:** §§ 14, 24 MarkenG; §§ 15 ff., 97 UrhG; § 5 UWG; E-18. Kanzlei: K-13.
- **Abnahme:** `int` – ohne Häkchen bzw. mit `blankBrandVisible` abgelehnt; `unit` – Lint erkennt „Godzilla“,
  „Nike“, „Disney“ in Produkttexten.
- **Phase:** P1 · **Owner:** nein

#### R-048 · Abweichende Beschaffenheit ausdrücklich und gesondert vereinbaren
- **Anforderung:** Felder `hasDeviation` (bool) und `deviationDescription` (DE/EN). Für Textil und Cap (immer
  Second-Hand) muss Jutta **ausdrücklich** entscheiden (Entscheidungsfeld laut DATENMODELL §6.6.1, ohne Vorbelegung):
  konkrete Abweichungen beschreiben (z. B. „kleiner Fleck am linken Ärmel“) **oder** „keine Abweichung“ wählen; bei
  den übrigen Kategorien bleibt die Beschreibung möglich (z. B. „Glasurfehler am Rand“). Bei `hasDeviation = true`:
  1. Produktseite zeigt „Besonderheit dieses Stücks: …“ nahe dem Preis.
  2. Die Kasse verlangt je betroffenem Stück eine **eigene, nicht vorangekreuzte Pflicht-Checkbox** mit Baustein
     `checkout.deviationAgreement`; ohne Haken ist der Bestell-Button deaktiviert **und** der Server lehnt ab.
  3. Gespeichert werden Text (`orders.items[].deviationText`), Zeitpunkt (`deviationAgreedAt`), angezeigter Text und
     Baustein-Version (`consent-log`, Zweck `deviation_agreement`); die Bestellbestätigung wiederholt die
     Vereinbarung.
  Keine Verkürzung der Verjährung für Gebrauchtware (§ 476 Abs. 2 BGB), solange K-17 nicht beantwortet und eine
  eigene gesonderte Vereinbarung gebaut ist.
- **Rechtsgrundlage:** § 476 Abs. 1 S. 2 BGB i. V. m. §§ 434 Abs. 3, 475b Abs. 4 BGB. Kanzlei: K-17.
- **Abnahme:** `e2e` – Stück mit Abweichung: Button erst nach Haken aktiv; `int` – API-Bestellung ohne Flag → 400.
- **Phase:** P1 (Modell), P3 (Anzeige), P4 (Kasse) · **Owner:** nein

#### R-049 · Harmonisierte Mitteilung zur gesetzlichen Gewährleistung [ergänzt]
- **Anforderung:** Ab **27.09.2026** zeigt die Website die EU-einheitliche „harmonisierte Mitteilung“ über das
  gesetzliche Gewährleistungsrecht (Pflicht-Design aus der Durchführungsverordnung (EU) 2025/1960: farbiges Logo,
  deutsche Sprachfassung, QR-Code/Link zur EU-Infoseite) **in hervorgehobener Weise**. Standardumsetzung
  (konservativ): auf jeder Produktseite (im Bereich Preis/Produktangaben), im Warenkorb und auf
  `/de/versand-und-zahlung`; auf `/en/…` die englische Fassung; zusätzlich ein Textlink auf die EU-Infoseite
  (für Screenreader). Grafik lokal ablegen (`public/legal/`), kein Hotlinking. Keine eigene „Garantie“-Kennzeichnung
  (das „GARAN“-Label betrifft nur Herstellergarantien – nicht einschlägig).
- **Rechtsgrundlage:** RL (EU) 2024/825 (Änderung RL 2011/83/EU), DVO (EU) 2025/1960; Art. 246, 246a EGBGB n. F.
  (ab 27.09.2026). Kanzlei: K-19.
- **Umsetzung:** Komponente `WarrantyNotice`. Kann die Cloud-Session die amtliche Grafik nicht laden (Netzsperre),
  Platzhalter-Grafik mit Text „Harmonisierte Mitteilung – amtliche Grafik folgt“ + Eintrag in OFFENE-PUNKTE; das
  Gate R-210 prüft, dass keine Platzhalter-Grafik aktiv ist.
- **Abnahme:** `e2e` – Grafik mit Alt-Text und Link auf Produkt-, Warenkorb- und Versandseite; `manuell` – Vergleich
  mit amtlicher Vorlage.
- **Phase:** P3, P6 · **Owner:** nein

### 4.6 Warenkorb, Kasse, Vertragsschluss

#### R-060 · Liefergebiet und Länder-Whitelist
- **Anforderung:** E-24. Einstellung `settings.shipping.enabledCountries`: nur DE aktiv; alle EU-Länder und CH sind
  im Enum `COUNTRY_CODES` vorbereitet, inaktiv; GB und US **nicht** im Enum und nicht aktivierbar. Solange nur DE aktiv ist, ist das
  Länderfeld fest „Deutschland“. Server prüft das Land bei Kassenstart und Bestellanlage; Abweichung → 400.
  Freischalten eines EU-Landes nur über R-202.
- **Rechtsgrundlage:** Art. 45 VO (EU) 2025/40 (PPWR); § 3c UStG; § 312j Abs. 1 BGB (Lieferbeschränkungen angeben).
- **Abnahme:** `unit` – GB/US nicht aktivierbar; `int` – Bestellung mit AT-Adresse abgelehnt.
- **Phase:** P4 · **Owner:** nein

#### R-061 · Gastbestellung mit minimalen Pflichtfeldern
- **Anforderung:** Keine Kundenkonten (E-30). Pflicht: E-Mail; Name als **ein** Feld „Vor- und Nachname“; bei
  Versand die Lieferadresse (Straße/Nr., PLZ, Ort; Land fest DE). Die Rechnungsadresse ist die Lieferadresse; weicht
  sie ab, setzt die Kund:in das **nicht vorangekreuzte** Häkchen „Rechnungsadresse weicht ab“
  (`billingAddressDiffers`) und gibt sie ein. Bei Abholung ist die Rechnungsadresse Pflicht (Standard bis K-07).
  Optional: Adresszusatz/Packstation. **Kein Telefonfeld**, **keine Anrede**, kein Firmen- oder Titelfeld, kein
  Geburtsdatum, kein Geschlecht, kein Passwort. Neben dem Formular ein Link auf die Datenschutzerklärung (R-138).
- **Rechtsgrundlage:** Art. 5 Abs. 1 lit. c, Art. 6 Abs. 1 lit. b, Art. 13 DSGVO; DSK-Beschluss vom 24.03.2022
  (Gastzugang); EuGH C-394/23 (Mousse, 09.01.2025: keine Pflicht-Anrede) [ergänzt]. Kanzlei: K-07.
- **Abnahme:** `e2e` – genau diese Pflichtfelder (`required`), kein Anrede- und kein Telefonfeld; „Rechnungsadresse
  weicht ab“ ist beim Laden nicht angehakt; Abholbestellung ohne Rechnungsadresse wird abgelehnt.
- **Phase:** P4 · **Owner:** nein

#### R-062 · Stripe nur auf der Kasse, Zahlarten technisch begrenzt
- **Anforderung:**
  1. Stripe.js wird **nur** auf der Kasse geladen: ausschließlich `loadStripe` aus `@stripe/stripe-js/pure`,
     aufgerufen in der Kassen-Client-Komponente. Kein Import von `@stripe/stripe-js` (ohne `/pure`) irgendwo.
  2. Nur das **Payment Element**. Kein Express Checkout Element, kein Payment Request Button, kein Link
     Authentication Element; **Stripe Link deaktiviert**; kein Address Element mit Autovervollständigung (keine
     Google-Places-Anfragen) – Adressen erfasst das eigene Formular (R-061).
  3. Erlaubte Stripe-Zahlarten genau: `card` (inkl. Apple Pay/Google Pay als Wallets) und `paypal`. Vorkasse läuft
     im Shop, nicht über Stripe. Klarna, SEPA-Lastschrift, Banküberweisung über Stripe usw. sind ausgeschlossen:
     Die Session wird serverseitig mit genau diesen Typen erzeugt (bzw. mit einer `payment_method_configuration`,
     deren aktivierte Typen beim Start im Live-Modus geprüft werden; Abweichung → Fehler + Admin-Mail).
  4. Stripe-Cookies (`__stripe_mid`, `__stripe_sid`) entstehen damit erst auf der Kasse nach Nutzeraktion.
- **Rechtsgrundlage:** § 25 Abs. 2 Nr. 2 TDDDG, DSK-OH Digitale Dienste Rn. 74, 80; Art. 5 Abs. 1 lit. c, Art. 25
  DSGVO; E-20, E-21, E-43. Kanzlei: K-30.
- **Abnahme:** `unit` – statischer Scan: Importe von `@stripe/stripe-js` nur im Kassenmodul und nur mit `/pure`;
  `int` – Mock-Treiber protokolliert Session-Parameter: nur `card`, `paypal`; `e2e` – auf keiner Nicht-Kassen-Seite
  ein Request an `*.stripe.com`/`*.stripe.network`.
- **Phase:** P4 · **Owner:** nein

#### R-063 · Bestellübersicht unmittelbar vor dem Button
- **Anforderung:** Direkt oberhalb des Bestell-Buttons (mobil ohne andere Inhalte dazwischen) stehen: je Position
  Miniaturbild, Titel, Objektnummer, wesentliche Eigenschaften (Kategorie, Maße, Material bzw. Faserzusammensetzung,
  Größe und Zustand bei Textil, Lebensmittelkontakt-Status bei Keramik, Metallteile bei Schmuck, Abweichungstext),
  Einzelpreis; Versandart und -kosten; **Gesamtpreis** mit Kleinunternehmer-Hinweis; Lieferzeit (R-035);
  Rechnungs-/Lieferadresse bzw. „Abholung in Berlin“; gewählte Zahlart; bei Vorkasse die Zahlungsfrist. Jeder Block
  hat einen „Ändern“-Link, der ohne Datenverlust zum jeweiligen Schritt führt. Darunter Baustein
  `checkout.legalNotice` mit Links auf AGB, Widerrufsbelehrung und Datenschutz (öffnen ohne Verlust der Eingaben).
  **Keine** Pflicht-Checkbox für AGB (Standard bis K-04). Einzige Pflicht-Checkboxen: Abweichungen (R-048).
  Optional: DHL-Einwilligung (R-101) und „Rechnungsadresse weicht ab“ (R-061). Nichts davon vorangekreuzt.
- **Rechtsgrundlage:** § 312j Abs. 2 BGB i. V. m. Art. 246a § 1 Abs. 1 S. 1 Nr. 1, 4, 5, 7, 8, 14, 15 EGBGB;
  § 312i Abs. 1 S. 1 Nr. 1, 2 BGB; Art. 246c EGBGB; § 305 Abs. 2 BGB. Kanzlei: K-04.
- **Abnahme:** `e2e` – Übersicht mit Seed-Warenkorb (Keramik + Textil mit Abweichung) enthält jede genannte Angabe;
  „Ändern“ führt zurück und Eingaben bleiben erhalten; axe ohne Verstöße der Stufe serious/critical.
- **Phase:** P4 · **Owner:** nein

#### R-064 · Bestell-Button „Zahlungspflichtig bestellen“
- **Anforderung:** Genau **ein** Bestell-Button mit exakt der Beschriftung **„Zahlungspflichtig bestellen“** (EN:
  **„Order with obligation to pay“**, bis K-03 beantwortet ist). Kein weiterer Text, kein Icon im Button. Derselbe
  Button für alle Zahlarten: Karte/Wallet → `confirm` (öffnet ggf. Apple-/Google-Pay-Dialog), PayPal → Weiterleitung
  nach dem Klick, Vorkasse → Bestellung wird angelegt. Nirgends sonst ein Element, das eine verbindliche Bestellung
  auslöst (kein „Jetzt kaufen“ auf der Produktseite, keine Express-/Wallet-Buttons, kein 1-Klick). Kontrast ≥ 4,5:1,
  Schriftgröße ≥ Fließtext; der Coco-Countdown verdeckt ihn nicht.
- **Rechtsgrundlage:** § 312j Abs. 3, 4 BGB; EuGH C-249/21 (07.04.2022, Beschriftung allein maßgeblich);
  LG Hildesheim 6 O 156/22. Kanzlei: K-03.
- **Abnahme:** `e2e` – `getByRole('button', { name: 'Zahlungspflichtig bestellen', exact: true })` hat Anzahl 1 auf
  `/de/kasse`; kein anderer Button in Kasse/Produktseite mit Kauf-Semantik (Liste verbotener Beschriftungen:
  „Jetzt kaufen“, „Kaufen“, „Bestellen“, „Weiter zur Zahlung“ als Abschluss).
- **Phase:** P4 · **Owner:** nein

#### R-065 · Vertragsschluss-Mechanik
- **Anforderung:** Standard bis K-01/K-02: Der Klick auf den Button ist das Angebot der Kund:in. Beim Klick
  speichert die **Kasse** (`checkouts`, DATENMODELL §6.25) den Zeitpunkt (`submittedAt`), alle Vertragsdaten
  (Eingaben, Lieferart, Zahlart), die angezeigten Positionen und Preise (Snapshot), die Fassungen der Rechtstexte
  (R-013) und die Einwilligungen/Vereinbarungen (`consent-log`). Damit ist das Angebot vollständig nachgewiesen, auch
  wenn keine Bestellung entsteht.
  - **Karte/Wallet/PayPal:** Die Kasse wechselt nach `confirming`. Die **Bestellung** entsteht erst nach bestätigter
    Zahlung (verifizierter Webhook `checkout.session.completed` mit `payment_status = paid` bzw.
    `checkout.session.async_payment_succeeded`) durch `fulfillCheckout` als `paid`; danach geht die
    Bestellbestätigung (R-081) raus. Scheitert die Zahlung: keine Bestellung, kein Vertrag, keine Bestätigungsmail,
    Hinweis in der Kasse, erneuter Versuch innerhalb der Reservierung möglich (Kasse wieder `open` bzw. `failed`).
  - **Vorkasse:** Die Bestellung entsteht sofort als `awaiting_prepayment`; die Bestellbestätigung mit
    Zahlungsdaten geht sofort raus (R-071).
  Es gibt **keine** Bestellstatus `pending_payment`, `payment_failed` oder `expired`: Diese Vorgänge sind Zustände
  der Kasse (`open`, `confirming`, `expired`, `cancelled`, `failed`). Texte auf Danke-Seite und in Mails behaupten
  nichts, was der AGB-Regelung widerspricht (Formulierungen aus den Bausteinen, bis dahin neutral: „Deine Bestellung
  ist eingegangen“).
- **Rechtsgrundlage:** §§ 145 ff. BGB; § 312i Abs. 1 S. 1 Nr. 3 BGB; AGB (Kanzlei). Kanzlei: K-01, K-02.
- **Abnahme:** `int` – Webhook erfolgreich → genau eine Bestellung `paid` + genau eine Mail `order_confirmation`;
  Zahlung fehlgeschlagen → keine Bestellung, keine Mail `order_confirmation`, Kasse mit gespeichertem Klick-Zeitpunkt
  und Rechtstext-Fassungen vorhanden.
- **Phase:** P4 · **Owner:** nein

#### R-066 · Danke-Seite
- **Anforderung:** Zeigt Bestellnummer, Zusammenfassung, Hinweis auf die Bestätigungsmail, bei Vorkasse die
  Zahlungsdaten und die Frist, Link zum Bestellstatus, Link „Vertrag widerrufen“ und den Footer. `noindex`. Keine
  personenbezogenen Daten in der URL (R-137).
- **Rechtsgrundlage:** § 312i Abs. 1 BGB (Transparenz); § 356a BGB; Art. 5 Abs. 1 lit. f DSGVO.
- **Abnahme:** `e2e` – Inhalte vorhanden; URL enthält weder E-Mail noch Namen.
- **Phase:** P4 · **Owner:** nein

#### R-067 · Bestellstatus-Seite per geheimem Link
- **Anforderung:** E-30. `/de/bestellung/[token]` bzw. `/en/order/[token]`: Token = 32 Zufallsbytes (base64url),
  zufällig erzeugt und **nicht** aus `PAYLOAD_SECRET` abgeleitet, in der DB **nie im Klartext**: gesucht wird nur über
  den SHA-256-Hash (`orders.statusTokenHash`). Damit spätere Mails und die Danke-Seite denselben Status-Link enthalten,
  liegt der Token zusätzlich **versiegelt** vor (`orders.statusTokenSealed`: AES-256-GCM, Schlüssel per HKDF laut
  ARCHITEKTUR §8.6, Bezeichner `pc:status-token-seal:v1`; im Admin ausgeblendet). Scheitert das Entsiegeln (z. B. nach
  einem Schlüsselwechsel), erzeugt der Dienst einen neuen Token (neuer Hash, neues Siegel, Audit) und mailt den neuen
  Link; Beispiel-Bestellungen (`seed = true`) werden nie automatisch neu erzeugt oder gemailt. Die Seite zeigt
  Status-Verlauf, Positionen (Snapshot), Versand/Sendungsverfolgung, Summen, Name, PLZ und Ort, maskierte E-Mail – **keine Straße** –, Downloads der **zum Bestellzeitpunkt gültigen**
  AGB-, Widerrufsbelehrungs- und Formular-PDFs sowie den Link „Vertrag widerrufen“.
  **Keine Rechnung und keine Gutschrift zum Download.** Schutzgrund: Der Status-Link steht in jeder Kund:innen-Mail,
  gilt bis zu 180 Tage nach Endstatus und kann weitergeleitet werden oder in fremde Hände geraten; die Rechnung
  enthält die vollständige Rechnungsadresse, die die Statusseite bewusst nicht zeigt (Art. 5 Abs. 1 lit. c, f,
  Art. 25, 32 DSGVO). Rechnung und Gutschrift kommen als Mail-Anhang (R-081, R-084) und sind in der Verwaltung
  abrufbar; die Dokument-Route der Statusseite liefert nur Rechtstext-PDFs.
  Header: `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`.
  Token nie loggen, nie an Statistik/Sentry senden (R-132, R-133). Gültigkeit: bis 180 Tage nach Endstatus
  (LOESCHKONZEPT L-05 Stufe B: Hash und Siegel werden gelöscht), danach Seite „Link abgelaufen“ mit Kontaktadresse.
- **Rechtsgrundlage:** Art. 5 Abs. 1 lit. c, f, Art. 25, 32 DSGVO; § 312i Abs. 1 S. 1 Nr. 4 BGB.
- **Abnahme:** `int` – DB enthält keinen Klartext-Token; entsiegeltes `statusTokenSealed` hat den Hash
  `statusTokenHash`; falscher Token → 404; abgelaufener → Ablaufseite, Hash und Siegel leer; Abruf
  eines Rechnungs-PDFs über die Token-Route → 404; `e2e` – Header gesetzt, keine Straße auf der Seite.
- **Phase:** P4 · **Owner:** nein

### 4.7 Zahlung und Vorkasse

#### R-070 · Zahlarten ohne Aufschläge
- **Anforderung:** Zahlarten genau nach E-20. Keine Gebühren, Aufschläge oder Rabatte je Zahlart; der Gesamtpreis ist
  von der Zahlart unabhängig.
- **Rechtsgrundlage:** § 270a BGB; § 312a Abs. 4 BGB; E-20.
- **Abnahme:** `unit` – `computeTotal()` liefert für alle Zahlarten denselben Betrag.
- **Phase:** P4 · **Owner:** nein

#### R-071 · Vorkasse: Zahlungsdaten, Erinnerung, automatische Stornierung
- **Anforderung:** E-23.
  1. Beim Bestellen: Status `awaiting_prepayment`, Stück reserviert bis zur **Zahlungsfrist**
     (`prepayment.dueAt`) = 23:59:59 Europe/Berlin am 5. Kalendertag (`settings.payment.prepaymentDays`) nach dem
     Bestelltag (Berliner Datum von `placedAt`). Eine einzige Implementierung der Fristberechnung in
     `src/lib/commerce/`.
  2. Sofort Bestellbestätigung (R-081, Mail `prepayment_instructions`) mit Baustein
     `email.vorkasse.paymentInstructions`: IBAN, Kontoinhaberin, Bank (optional BIC), Betrag,
     **Verwendungszweck = Bestellnummer**, Zahlungsfrist als konkretes Datum mit Uhrzeit (Europe/Berlin), Folge bei
     Nichtzahlung.
  3. Task `prepaymentReminders` (Weckzeit, ARCHITEKTUR §9.6/Anhang A.3): bei `placedAt + 72 h`
     (`settings.payment.prepaymentReminderHours`) und unbezahlt → genau eine Erinnerungsmail `prepayment_reminder`
     (Baustein `email.vorkasse.reminder`).
  4. Task `cancelOverduePrepayments` (Weckzeit): Zahlungsfrist abgelaufen und unbezahlt → Status `cancelled` mit
     `cancelReason = payment_timeout`, Stück wieder `available`, Mail `prepayment_cancelled` (Baustein
     `email.vorkasse.cancellation`), Admin-Mail `admin_prepayment_cancelled`. Es wurde nie eine Rechnungsnummer
     vergeben.
  5. Admin-Knopf „Zahlung erhalten“ (Datum, Betrag) → `paid`, Rechnung (R-120), Mail `prepayment_received` mit
     Rechnung. Zahlung nach Stornierung: Warnung; „Nachträglich bezahlt“ (`cancelled → paid`) nur bei
     `cancelReason = payment_timeout` **und** allen Stücken noch `available`, sonst „zurücküberweisen“ (manuell,
     Vermerk).
- **Rechtsgrundlage:** E-23; § 312i Abs. 1, § 312f Abs. 2 BGB; Rücktritts-/Stornoregelung in den AGB (K-02).
- **Abnahme:** `int` mit Fake-Zeit: Erinnerung genau einmal bei 72 h; Bestellung am 12.10. um 10:00 → am 17.10.
  um 23:59:59 (Berlin) noch reserviert, danach storniert; zweiter Fall über die Zeitumstellung am 25.10.2026:
  Bestellung am 22.10. → Frist 27.10., 23:59:59 MEZ (= 22:59:59 UTC); Stück wieder verfügbar;
  Rechnungszähler unverändert; Mails im Datei-Treiber vorhanden.
- **Phase:** P4 (Jobs), P5 (Admin) · **Owner:** ja – IBAN und Kontoinhaberin in P11 eintragen.

#### R-072 · Erstattung über dasselbe Zahlungsmittel
- **Anforderung:** Karte/Wallet/PayPal: Erstattung per Stripe-Refund-API (landet automatisch auf dem ursprünglichen
  Zahlungsmittel), voll oder je Position (`orders.refunds[]` mit `stripeRefundId`). Vorkasse: manuelle
  Rücküberweisung an das Absenderkonto aus Juttas Kontoauszug; Admin vermerkt Datum und Betrag
  (`manualTransferConfirmedAt`). **Keine IBAN von Kund:innen im Shop speichern** (die Bitte um eine Bankverbindung ist
  nur eine Mail-Vorlage zum Öffnen im Mailprogramm). Erstattungsvorschlag: Gesamtwiderruf = Warenwert + gezahlte
  Versandkosten; Teilwiderruf siehe vorläufige Regel. Frist-Countdown 14 Tage ab Eingang des Widerrufs
  (`withdrawals.refundDueAt`); Zurückbehaltung bis Ware oder Rücksendenachweis da ist. Erstattung erzeugt Gutschrift
  (R-121) und Mail `refund_confirmation` (R-084).
  **Vorläufige Regel (bis Kanzleifrage K-09):** Beim Teilwiderruf schlägt der Dialog Warenwert der widerrufenen Stücke
  **plus** die Differenz zwischen den bezahlten Versandkosten und den Versandkosten vor, die für die behaltenen Stücke
  angefallen wären (KONZEPT §5.3; kundenfreundlich und damit rechtlich sicherer); der Dialog weist auf K-09 hin. Jutta
  kann den Betrag nur erhöhen (Kulanz, Pflicht-Notiz).
- **Rechtsgrundlage:** § 357 BGB (Frist 14 Tage, Hinsendekosten, gleiches Zahlungsmittel, Zurückbehaltungsrecht);
  E-27. Kanzlei: K-09.
- **Abnahme:** `int` – Vorschlagsberechnung (Gesamt- und Teilwiderruf mit Versand-Differenz); Countdown;
  Mock-Refund mit richtiger Zahlungs-ID; Gutschrift angelegt.
- **Phase:** P6 · **Owner:** nein

### 4.8 E-Mails und Bestätigungen

#### R-080 · Transaktionsmails: Absender, Anbieterkennung, keine Werbung
- **Anforderung:** Alle Kund:innen-Mails: Absender `MAIL_FROM` (eigene Domain), Reply-To jutta@planetclairetattoos.com;
  Footer mit Name, Anschrift, E-Mail (Telefonnummer nur in der Bestellbestätigung M01/M02, R-021), Links auf Impressum
  und Datenschutz; Sprache der Bestellung; HTML plus
  Text-Alternative. **Keine Werbung**: keine Produktempfehlungen, keine Rabatt-/Gutscheincodes, kein „Folge mir auf
  Instagram“, keine Social-Icons, keine Hinweise auf neue Stücke. Keine Tracking-Pixel, kein Klick-Tracking (beim
  Mail-Anbieter deaktivieren), keine externen Bilder außer von der eigenen Domain. Kein OS-Link (V-01).
- **Rechtsgrundlage:** § 7 Abs. 2 Nr. 2, Abs. 3 UWG; BGH VI ZR 134/15 (Werbung in Bestätigungsmails); Art. 5
  Abs. 1 lit. c, Art. 25 DSGVO.
- **Abnahme:** `unit` – jede Vorlage mit Seed-Daten rendern: Footer-Daten vorhanden; V-09-Scan; kein `<img>` mit
  fremder Domain; keine Links mit Tracking-Parametern.
- **Phase:** P4 · **Owner:** nein

#### R-081 · Bestellbestätigung (Eingangs- und Vertragsbestätigung)
- **Anforderung:** Versand unmittelbar nach Zahlungs-Webhook (Karte/Wallet/PayPal, Mail `order_confirmation`) bzw.
  nach dem Klick (Vorkasse, Mail `prepayment_instructions`), spätestens nach 5 Minuten (Outbox, Task `sendEmail`).
  Inhalt:
  1. Anbieterkennung (Name, Anschrift, Telefon, E-Mail).
  2. Bestellnummer, Datum und Uhrzeit (Europe/Berlin).
  3. Positionen mit Titel, Objektnummer, wesentlichen Eigenschaften (wie R-063), Einzelpreis; vereinbarte
     Abweichungen (R-048).
  4. Versandart und -kosten, Gesamtpreis, Kleinunternehmer-Hinweis.
  5. Zahlart; bei Vorkasse Zahlungsdaten und Frist (R-071).
  6. Rechnungs- und Lieferadresse bzw. Abholung; Lieferzeit.
  7. Hinweis auf das gesetzliche Mängelhaftungsrecht und die harmonisierte Mitteilung (Link/Grafik, R-049).
  8. Widerrufsbelehrung mit Muster-Widerrufsformular und AGB **als PDF-Anhänge der zum Bestellzeitpunkt gültigen
     Version** (`AGB_v{n}.pdf`, `Widerrufsbelehrung-und-Formular_v{n}.pdf`; bei EN-Bestellung zusätzlich die
     vorhandenen EN-PDFs); Hinweis, dass die Rücksendekosten die Kund:in trägt; Link „Vertrag widerrufen“.
  9. Status der DHL-Einwilligung und wie man sie widerruft (nur wenn erteilt).
  10. Link zur Bestellstatus-Seite, Link zur Datenschutzerklärung.
  11. Rechnung als PDF, sobald bezahlt (bei Karte/PayPal in derselben Mail; eine DE-Bestellung mit Karte/PayPal hat
      damit genau drei PDF-Anhänge: Rechnung, AGB, Widerrufsbelehrung mit Formular).
  Nachweis im `email-log` (verknüpft mit der Bestellung): Vorlage und Vorlagen-Version, Empfänger, Zeitpunkt,
  Message-ID, Status, Anhänge mit Dateiname und SHA-256 sowie `bodySha256`. Der Hash wird über den gerenderten Inhalt
  mit einem festen Platzhalter an der Stelle des Status-Tokens gebildet, damit der Inhalt aus Bestell-Snapshot,
  Vorlagen-Version und Rechtstext-Fassungen reproduzierbar und prüfbar bleibt, ohne den Token zu speichern.
- **Rechtsgrundlage:** § 312i Abs. 1 S. 1 Nr. 3, § 312f Abs. 2 BGB; Art. 246a § 1, § 4 EGBGB; Art. 246c EGBGB;
  § 356a BGB.
- **Abnahme:** `int` – nach Mock-Webhook liegt genau eine Mail im Datei-Treiber mit allen 11 Elementen (Assertion je
  Element) und den Anhängen mit korrekten Versionsnummern; erneutes Rendern aus dem Snapshot ergibt denselben
  `bodySha256`.
- **Phase:** P4 · **Owner:** nein

#### R-082 · Versandmail
- **Anforderung:** Bei „Versendet melden“ (Status `shipped`) geht die Mail `order_shipped` raus: versandte
  Positionen, Sendungsnummer und Tracking-Link, Baustein `email.shipping.damageNotice` („Bitte melde Transportschäden
  möglichst schnell mit Fotos … – deine gesetzlichen Rechte bleiben davon unberührt“), Link „Vertrag widerrufen“.
  Keine Frist, die Rechte verkürzt (V-11). Die Sendungsnummer ist Pflicht für die Versandklassen `paket_klein` und
  `keramik`.
  **Vorläufige Regel (bis Kanzleifrage K-40):** Bei der Versandklasse `brief` ist die Sendungsnummer optional; ohne
  Nummer enthält die Mail keinen Verfolgungslink, sondern nur Versanddatum und Versandart.
- **Rechtsgrundlage:** §§ 475 Abs. 2, 476, 437 BGB; § 7 UWG. Kanzlei: K-21, K-40.
- **Abnahme:** `unit` – Vorlage enthält „unberührt“ und keinen V-11-Treffer; rendert mit und ohne Sendungsnummer
  (`brief`); `int` – `keramik` ohne Sendungsnummer kann nicht auf `shipped`.
- **Phase:** P5 · **Owner:** nein

#### R-083 · Abholmail und Übergabe
- **Anforderung:** Status `ready_for_pickup` → Mail `pickup_ready` (Baustein `email.pickup.ready`) mit Ort
  (Privatstudio, E-29) und Terminabsprache. Admin erfasst die Übergabe (Status `picked_up`,
  `timestamps.pickedUpAt`); dieses Datum ist Beginn der Widerrufsfrist und der Gewährleistung für Abholbestellungen.
- **Rechtsgrundlage:** § 356 Abs. 2 Nr. 1 BGB (Fristbeginn mit Erhalt der Ware); E-29. Kanzlei: K-08.
- **Abnahme:** `int` – `pickedUpAt` setzt Fristberechnung (R-094) und Gewährleistungsende (R-110).
- **Phase:** P5 · **Owner:** nein

#### R-084 · Weitere Pflichtmails
- **Anforderung:** Vorlagen DE/EN (Schlüssel laut DATENMODELL `EMAIL_TEMPLATES`) für: Vorkasse-Erinnerung und
  -Stornierung (`prepayment_reminder`, `prepayment_cancelled`, R-071), Zahlung eingegangen mit Rechnung
  (`prepayment_received`), Widerrufs-Eingangsbestätigung (`withdrawal_receipt`, R-093), Erstattungsbestätigung mit
  Gutschrift `GS-JJJJ-NNNNN` (`refund_confirmation`), Reklamationsantwort (`complaint_repair_choice`, KONZEPT M12,
  R-111), Streitbeilegungshinweis (`dispute_vsbg`, M13, R-112), Antworten auf Datenschutz-Anfragen
  (`privacy_access_response`, M14, R-150; `privacy_erasure_response`, M15, R-151) und Bestätigung eines
  Einwilligungswiderrufs (`consent_withdrawal_confirmation`, M16, R-152). Alle laufen über die Outbox (`email-log` + Task `sendEmail`) und
  werden damit protokolliert; alle erfüllen R-080. Nur Rückfragen ohne Rechtspflicht (Fotos anfordern, Bitte um
  Bankverbindung für eine Vorkasse-Erstattung) bleiben Vorlagen zum Öffnen im Mailprogramm.
- **Rechtsgrundlage:** wie R-080; § 356a, § 357 BGB.
- **Abnahme:** `unit` – jede Vorlage rendert mit Seed-Daten ohne unersetzte Tokens.
- **Phase:** P4–P6 · **Owner:** nein

### 4.9 Widerruf

#### R-090 · Link „Vertrag widerrufen“ überall
- **Anforderung:** Beschriftung exakt **„Vertrag widerrufen“** (EN: **„Withdraw from contract here“**, Wortlaut der
  RL (EU) 2023/2673, bis K-03). Hervorgehoben (Button-Optik, Kontrast) im Footer jeder öffentlichen Seite (R-011),
  in jeder bestellbezogenen Mail, auf Danke-Seite und Bestellstatus-Seite. Ziel `/de/vertrag-widerrufen` bzw.
  `/en/withdraw-from-contract` (§2).
  Ohne Login, dauerhaft (nicht nur 14 Tage), auch für Gast-, Vorkasse- und Abholbestellungen.
  **Wartungsmodus:** R26 bleibt erreichbar. Ist die Datenbank erreichbar, funktioniert die Widerrufsfunktion
  (R-091 bis R-093) auch im Wartungsmodus vollständig; nur wenn die Datenbank nicht erreichbar ist, zeigt R26 statt
  des Formulars den Weg per E-Mail an jutta@planetclairetattoos.com (mit Hinweis, dass der Eingang der Mail zählt).
- **Rechtsgrundlage:** § 356a BGB (seit 19.06.2026); RL (EU) 2023/2673; E-44.
- **Abnahme:** `e2e` – alle Seitentypen; im Wartungsmodus mit erreichbarer DB lässt sich ein Widerruf absenden;
  `unit` – alle Bestell-Mailvorlagen enthalten den Link.
- **Phase:** P2 (Footer-Link), P6 (Funktion) · **Owner:** nein

#### R-091 · Widerrufsfunktion Schritt 1: Erklärung erfassen
- **Anforderung:** Formular mit Pflichtfeldern **Name**, **Angaben zum Vertrag** (Bestellnummer oder Freitext, z. B.
  „Bestellung vom 12.10., Schale Nr. 017“), **E-Mail für die Eingangsbestätigung**. Optional: Freitext „Nur bestimmte
  Stücke widerrufen?“; wenn Bestellnummer + E-Mail zu einer Bestellung passen, zusätzlich Checkboxen je Position
  (alle **nicht** angehakt; keine Auswahl = ganzer Vertrag, so erklärt); optionales Feld „Grund“ (klar als freiwillig
  gekennzeichnet, nie Pflicht). **Kein** Login, **kein** CAPTCHA, **keine** E-Mail-Bestätigungsschleife. Erlaubt:
  Honeypot; großzügiges Rate-Limit von 30 Absendungen je Stunde und IP-Hash (Bucket `withdrawal_submit`,
  ARCHITEKTUR §8.5; der IP-Hash liegt nur im Rate-Limit-Zähler, nie im Widerrufs-Datensatz). Unbekannte
  Bestellnummern werden angenommen (`matchStatus = needs_manual_match`). Link auf die Datenschutzerklärung (R-138).
- **Rechtsgrundlage:** § 356a BGB. Kanzlei: K-11.
- **Abnahme:** `e2e` – Absenden mit unbekannter Bestellnummer funktioniert; „Grund“ leer funktioniert; kein
  CAPTCHA-Element im DOM; alle Checkboxen initial nicht angehakt.
- **Phase:** P6 · **Owner:** nein

#### R-092 · Widerrufsfunktion Schritt 2: „Widerruf bestätigen“
- **Anforderung:** Zusammenfassung der Eingaben mit „Ändern“-Möglichkeit und Button exakt **„Widerruf bestätigen“**
  (EN: **„Confirm withdrawal“**). Erst dieser Klick übermittelt die Erklärung; der Eingangszeitpunkt ist die
  Serverzeit dieses Klicks.
- **Rechtsgrundlage:** § 356a BGB.
- **Abnahme:** `e2e` – vor Schritt 2 entsteht kein Datensatz; nach Klick genau einer.
- **Phase:** P6 · **Owner:** nein

#### R-093 · Widerruf speichern und sofort bestätigen
- **Anforderung:** Beim Bestätigen entsteht ein **unveränderlicher** Datensatz in `withdrawals` (DATENMODELL §6.11):
  Nummer `WR-JJJJ-NNNNN`, `receivedAt` (Serverzeit, UTC), `name`, `contractIdentification`, `email`,
  Positionsauswahl (`affectedItemIds`) bzw. Freitext (`itemsText`), `reason`, `locale`, `submissionSnapshot`;
  Zuordnung zur Bestellung (`order`) automatisch nur bei passender Bestellnummer **und** E-Mail
  (`matchStatus = auto_matched`), sonst `needs_manual_match`; Status `received`. Keine IP, kein IP-Hash, kein
  User-Agent. **Sofort** (direkt nach dem Commit) geht an die angegebene Adresse die Mail `withdrawal_receipt` mit:
  vollständigem Inhalt der Erklärung, **Datum und Uhrzeit des Eingangs** (Europe/Berlin, z. B. „12.10.2026,
  14:03 Uhr (MESZ)“), Baustein `withdrawal.receiptNotice` (bestätigt nur den Eingang), Rücksendeadresse und Hinweis
  „Rücksendekosten trägst du“ (`withdrawal.returnInfo`). Kopie an Jutta (`admin_withdrawal_received`).
  **Wiederholung:** Scheitert der Versand, wiederholt `sendEmail` ihn im Abstand von höchstens 5 min bis 24 h nach
  Eingang; schon nach dem 2. Fehlversuch geht der Admin-Alarm A12 (`admin_alert`) an Jutta, und erneut, wenn nach
  24 h noch kein Versand gelang (dann Bestätigung manuell senden).
  Die Bestätigungsseite zeigt dieselben Angaben und einen Hinweis zum Speichern/Drucken. Ist der Widerruf zugeordnet,
  wechselt die Bestellung nach `withdrawal_received`; eine noch unbezahlte Vorkasse-Bestellung (`awaiting_prepayment`)
  wird stattdessen `cancelled` mit `cancelReason = withdrawn`, und der Widerruf wird `closed` mit
  `closeReason = unpaid_order_cancelled` (R-094).
- **Rechtsgrundlage:** § 356a BGB (Eingangsbestätigung auf dauerhaftem Datenträger); § 355 Abs. 1 BGB.
- **Abnahme:** `int` – Update am Datensatz → Fehler; Mail enthält Zeitstempel-String und alle Eingaben; Admin-Kopie;
  `e2e` – gesamter Ablauf inklusive Bestätigungsseite.
- **Phase:** P6 · **Owner:** nein

#### R-094 · Widerrufs-Posteingang in der Verwaltung
- **Anforderung:** Liste aller Widerrufe; automatische bzw. manuelle Zuordnung zur Bestellung (`matchStatus`; die
  Zuordnung ändert den Status nicht). Status und Übergänge exakt laut DATENMODELL §6.11:
  - `received` → `goods_returned` (Ware ist zurück);
  - `received` oder `goods_returned` → `refunded` bzw. `partially_refunded` (Erstattung erfolgreich);
    `partially_refunded` → `refunded` (weitere Erstattung bis zum vollen Betrag);
  - `received`, `goods_returned` oder `partially_refunded` → `closed` = ohne (weitere) Erstattung abgeschlossen, nur
    mit `closeReason` (bei `other` mit Begründung `closeNote`); das System setzt `closed` mit
    `unpaid_order_cancelled`, wenn der Widerruf eine unbezahlte Vorkasse-Bestellung storniert (R-093);
  - `received` → `rejected` nur manuell, Begründung (`closeNote`) Pflicht (z. B. Test/Spam, eindeutig verfristet).
  `refunded`, `rejected` und `closed` sind Endzustände. Test/Spam nur mit Begründung markieren (L-08). Eingang
  eines Rücksendenachweises wird mit Datum vermerkt (Zurückbehaltung endet). Countdown „Erstattung fällig bis“ =
  `refundDueAt` (`receivedAt` + 14 Tage), Warnung ab Tag 10 (Task `withdrawalDeadlines`, Mail
  `admin_withdrawal_deadline`). Manuelles Erfassen von Widerrufen per Mail oder Brief (Quelle, Eingangsdatum).
  Info-Anzeige der regulären Widerrufsfrist (Zustellung bzw. Übergabe + 14 Tage, Tagesende; bei automatisch
  gesetzter Zustellung, `shipment.deliveredSource = auto`, als „geschätzt“ gekennzeichnet) – **nie** automatisch
  ablehnen.
- **Rechtsgrundlage:** §§ 355, 356, 357 BGB.
- **Abnahme:** `int` – Countdown-Berechnung inkl. Sommerzeitwechsel; manuelle Erfassung.
- **Phase:** P6 · **Owner:** nein

#### R-095 · Widerrufsbelehrung, Muster-Formular, Rücksendekosten
- **Anforderung:** Die Kanzlei-Widerrufsbelehrung muss enthalten: Hinweis, dass die Kund:in die unmittelbaren Kosten
  der Rücksendung trägt (E-27); den neuen Satz zur Online-Widerrufsfunktion mit der kanonischen URL
  `https://planetclairetattoos.com/de/vertrag-widerrufen` (Token `{{withdrawalUrl}}`; in der englischen Lesefassung
  löst das Token zu `https://planetclairetattoos.com/en/withdraw-from-contract` auf); Telefonnummer (R-021).
  Das Muster-Widerrufsformular steht als HTML auf `/de/widerrufsbelehrung` und als PDF-Download. Keine Kulanz-
  Versprechen, keine Ausschlüsse für Shop-Ware (R-096).
- **Rechtsgrundlage:** Art. 246a § 1 Abs. 2 EGBGB, Anlage 1 (Gestaltungshinweise, Fassung ab 19.06.2026) und
  Anlage 2; § 357 BGB. Kanzlei: K-09, K-10.
- **Abnahme:** `unit` – mit `NEXT_PUBLIC_SITE_URL=https://planetclairetattoos.com` enthält die gerenderte
  DE-Belehrung genau `https://planetclairetattoos.com/de/vertrag-widerrufen` und die Telefonnummer; `manuell` –
  Kanzleitext gegen diese Liste prüfen.
- **Phase:** P6 · **Owner:** ja – Kanzleitext liefern lassen.

#### R-096 · Kein Widerrufsausschluss im Shop
- **Anforderung:** Alle Shop-Stücke sind vorgefertigte Unikate mit vollem Widerrufsrecht; Auftragsarbeiten sind nicht
  kaufbar (E-11). Das Produktmodell hat **kein** Feld „kein Widerrufsrecht“; das Sperrfeld `isCustomCommission` ist
  per DB-CHECK immer `false` und steuert nichts. Keine Seite, Mail oder Beschreibung enthält
  Ausschluss-Formulierungen (V-08).
- **Rechtsgrundlage:** § 312g Abs. 1, Abs. 2 Nr. 1 BGB (eng auszulegen).
- **Abnahme:** `unit` – V-08-Scan; Schema-Test: kein Feld wie `noWithdrawal`/`customMade` in `products`,
  `isCustomCommission = true` scheitert am DB-CHECK.
- **Phase:** P3, P6 · **Owner:** nein

### 4.10 Versand, Abholung, Transport

#### R-100 · Transportrisiko trägt die Verkäuferin
- **Anforderung:** Keine Klausel und kein Text, der das Transportrisiko auf die Kund:in verlagert (V-10). Verwaltung:
  Verpackungs-Checkliste je Versandklasse (`settings.packingChecklists`); Packfotos (0–4 je Bestellung, privat,
  `packingPhotos`) als Nachweis bei Bruch oder Anfechtung empfohlen; Hinweis „Transportversicherung buchen“ ab
  Warenwert > 500 € (`settings.shipping.insuranceHintThresholdCents`); Bruch-Vorlage: Fotos anfordern,
  DHL-Reklamation innerhalb von 7 Tagen, der Kund:in Reparatur oder Erstattung anbieten (Ersatz bei Unikat unmöglich).
  **Vorläufige Regel (bis Kanzleifrage K-40):** Ein Packfoto ist keine Pflicht. Markiert Jutta eine Bestellung mit
  Keramik-Stück (Versandklasse `keramik`) ohne Packfoto als „versendet“, fragt die Verwaltung nach („Ohne Packfoto
  versenden?“); erst nach Bestätigung wird der Status gesetzt, und die Bestätigung wird mit Zeitpunkt protokolliert
  (Status-Verlauf bzw. Audit, Feld laut DATENMODELL).
- **Rechtsgrundlage:** § 475 Abs. 2 BGB (Gefahrübergang erst mit Übergabe an die Verbraucherin); § 438 Abs. 2 HGB
  (7-Tage-Frist gegenüber DHL); § 427 Abs. 1 Nr. 2 HGB (ungenügende Verpackung). Kanzlei: K-40.
- **Abnahme:** `int` – Keramik-Bestellung ohne Foto: „versendet“ erst nach bestätigter Rückfrage, Bestätigung
  protokolliert; Nicht-Keramik ohne Foto ohne Rückfrage; Bestellung > 500 € zeigt den Hinweis.
- **Phase:** P5 · **Owner:** nein

#### R-101 · E-Mail-Adresse an DHL nur mit Einwilligung
- **Anforderung:** Nur bei Versandbestellungen (bei Abholung ausgeblendet) eine **optionale, nicht vorangekreuzte**
  Checkbox mit Baustein `checkout.dhlEmailConsent`, getrennt von anderen Erklärungen. Gespeichert werden an der
  Bestellung `carrierEmailConsent` (erteilt ja/nein) und `carrierEmailConsentRevokedAt` sowie im `consent-log`
  (Zweck `carrier_email_forwarding`) Zeitpunkt, exakt angezeigter Text mit Hash und Baustein-Version, bei Widerruf
  `withdrawnAt`. „Adresse kopieren“ im Admin gibt die E-Mail nur aus, wenn die Einwilligung erteilt und nicht
  widerrufen ist; Telefonnummern werden nie weitergegeben. Admin-Knopf „Einwilligung widerrufen“ setzt beide
  Widerrufs-Zeitpunkte.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. a, Art. 7 DSGVO; DSK-Position zur E-Mail-Weitergabe an Paketdienste. Kanzlei:
  K-31.
- **Abnahme:** `e2e` – Checkbox initial nicht angehakt, bei Abholung nicht vorhanden; `unit` – Adress-Formatter mit und
  ohne Einwilligung.
- **Phase:** P4 (Kasse), P5 (Admin) · **Owner:** nein

#### R-102 · Abholung in Berlin
- **Anforderung:** E-29: 0 €, nur nach Absprache, Ort nur in der Abholmail (R-083), keine Karte, keine öffentliche
  Adresse auf Tattoo-/Kontaktseiten (nur Bezirk). Abholbestellungen sind Fernabsatzverträge mit vollem Widerrufsrecht
  (Standard bis K-08); Fristbeginn mit Übergabe.
- **Rechtsgrundlage:** §§ 312c, 312g, 356 BGB; E-29, E-50.
- **Abnahme:** `int` – Abholbestellung erhält Widerrufslink und Fristberechnung ab `timestamps.pickedUpAt`.
- **Phase:** P4, P5 · **Owner:** nein

### 4.11 Gewährleistung und Streitbeilegung

#### R-110 · Gesetzliche Mängelhaftung, keine „Garantie“, Reklamationsakte
- **Anforderung:** Es gilt nur die gesetzliche Mängelhaftung; keine freiwillige Garantie, das Wort „Garantie“ wird für
  die Gewährleistung nicht verwendet (V-18). Verwaltung: Reklamationsakte je Bestellung mit mindestens Art
  (Transportschaden/Mangel), Eingang, Fotos (privat), gewählter Abhilfe, Versandzeitpunkt der Reparatur-Information
  (R-111), Wahl der Kund:in und Fristen; Erstattungen aus Reklamationen laufen als `orders.refunds[]` mit Grund
  `complaint`. Die Akte ist die Collection `complaints` (DATENMODELL §6.29, Fotos als `private-uploads` mit Zweck
  `complaint_photo`); diese Anforderung nennt nur die Mindestangaben.
  `warrantyEndsAt` = Zustellung bzw. Übergabe + 2 Jahre; + 12 Monate, wenn die Kund:in Reparatur wählt (R-111).
- **Rechtsgrundlage:** §§ 434, 437, 439, 475 ff. BGB; § 479 BGB; Art. 246a § 1 Abs. 1 S. 1 Nr. 8 EGBGB.
- **Abnahme:** `int` – Berechnung `warrantyEndsAt` mit und ohne Reparatur.
- **Phase:** P6 · **Owner:** nein

#### R-111 · Reklamationsvorlage „Recht auf Reparatur“
- **Anforderung:** Für Kaufverträge ab 31.07.2026: Vor der Nacherfüllung erhält die Kund:in eine Mail (Baustein
  `complaint.repairChoice`), die über das Wahlrecht Reparatur/Ersatzlieferung und die Verlängerung der Gewährleistung
  um 12 Monate bei Reparatur informiert; bei Unikaten wird erklärt, dass Ersatz in der Regel unmöglich ist. Admin-Knopf
  „Reklamation beantworten“ reiht die Mail `complaint_repair_choice` mit Bestelldaten über die Outbox ein
  (`email-log`), speichert den Versandzeitpunkt und später die Wahl der Kund:in in der Reklamationsakte (R-110).
- **Rechtsgrundlage:** RL (EU) 2024/1799; BGB i. d. F. des Gesetzes vom 16.07.2026 (laut Sekundärquellen § 475
  Abs. 4, § 475e Abs. 5 BGB). Kanzlei: K-20.
- **Abnahme:** `int` – Vorlage rendert; Wahl „Reparatur“ verlängert `warrantyEndsAt`.
- **Phase:** P6 · **Owner:** nein

#### R-112 · Streitbeilegung: § 37 VSBG-Vorlage, kein OS-Link
- **Anforderung:** Kein Link und kein Text zur EU-OS-Plattform – nirgends (V-01). Kein Pflichthinweis nach § 36 VSBG
  (≤ 10 Beschäftigte); ein freiwilliger Satz nur im Wortlaut der Kanzlei. Mail `dispute_vsbg` mit Baustein
  `dispute.vsbg37` (über die Outbox, protokolliert) für ungelöste Streitfälle in Textform: Universalschlichtungsstelle
  des Bundes, Zentrum für Schlichtung e. V.,
  Straßburger Straße 8, 77694 Kehl am Rhein, https://www.universalschlichtungsstelle.de, plus Angabe, ob Jutta zur
  Teilnahme bereit/verpflichtet ist (Arbeitsfassung: „nicht bereit und nicht verpflichtet“, bis K-22).
- **Rechtsgrundlage:** §§ 36, 37 VSBG; VO (EU) 2024/3228 (Aufhebung ODR-VO, OS-Plattform seit 20.07.2025 abgeschaltet).
- **Abnahme:** `unit` – Vorlage enthält Anschrift und URL; V-01-Scan.
- **Phase:** P6 · **Owner:** nein

### 4.12 Rechnungen, Buchhaltung, Kleinunternehmerin

#### R-120 · Rechnung je bezahlter Bestellung (§ 34a UStDV)
- **Anforderung:** Beim Übergang auf `paid` (Webhook oder „Zahlung erhalten“) entsteht automatisch ein Rechnungs-PDF.
  Pflichtinhalt im Kleinunternehmer-Modus: Überschrift „Rechnung“; Rechnungsnummer (R-121); Ausstellungsdatum;
  vollständiger Name und Anschrift der Verkäuferin (`settings.business`); Steuernummer
  (`settings.business.taxNumber`; alternativ USt-IdNr./W-IdNr. nach Steuerberatung); vollständiger Name und Anschrift
  der Kund:in (Rechnungsadresse, sonst Lieferadresse; bei Abholung Pflicht nach R-061);
  Positionen mit Menge (1), handelsüblicher Bezeichnung (Titel + Kategorie + „Nr. 017“) und Preis; Versandkosten als
  Position; Gesamtbetrag; Hinweis **„Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.“**; Leistungszeitpunkt als
  Monat (z. B. „Oktober 2026“); Zahlungsvermerk (bezahlt am … per …). Im Modus Regelbesteuerung zusätzlich die
  Angaben nach § 14 Abs. 4 UStG (Netto je Steuersatz, Steuersatz, Steuerbetrag, Liefertag bzw. -monat).
- **Rechtsgrundlage:** § 34a UStDV; § 33 UStDV; § 14 Abs. 4 UStG; § 31 Abs. 4 UStDV; GoBD; E-04.
- **Abnahme:** `int` – PDF-Text (z. B. mit `pdf-parse`) enthält alle Pflichtangaben, im KU-Modus kein „USt“-Betrag.
- **Phase:** P4, P5 · **Owner:** ja – Steuernummer in P11 eintragen.

#### R-121 · Lückenloser Nummernkreis, Storno statt Löschen
- **Anforderung:** Rechnungen `RE-JJJJ-NNNNN`, Gutschriften/Stornos `GS-JJJJ-NNNNN` (je Kalenderjahr Europe/Berlin
  ab 00001). Vergabe **in derselben DB-Transaktion** wie die Rechnung (Zähler-Zeile mit `SELECT … FOR UPDATE`), damit
  bei Abbruch keine Lücke entsteht. Rechnungen und Gutschriften sind für **alle** Rollen weder änderbar noch löschbar;
  Korrektur nur per Gutschrift mit Verweis auf die Ursprungsrechnung (voll oder teilweise), danach ggf. neue Rechnung.
  Beispiel-Belege des Seeds nutzen die **eigenen** Serien `BSP-RE-JJJJ-NNNNN`/`BSP-GS-JJJJ-NNNNN` (Nummernkreis
  `INVOICE_SERIES`, DATENMODELL) mit eigenem Zähler und tragen sichtbar „Beispiel“; der echte Zähler wird vom Seed nie
  berührt (R-180).
- **Rechtsgrundlage:** § 146 Abs. 4 AO; GoBD (Unveränderbarkeit, Vollständigkeit); § 14 Abs. 4 S. 1 Nr. 4 UStG.
- **Abnahme:** `int` – 20 parallel bezahlte Bestellungen → Nummern 1–20 ohne Lücke/Duplikat; Update/Delete → 403;
  nach Seed-Import und -Entfernung beginnt die echte Nummerierung bei 00001.
- **Phase:** P4 · **Owner:** nein

#### R-122 · Unveränderbarkeit der Rechnungs-PDFs
- **Anforderung:** Das PDF wird einmal erzeugt und im privaten Bucket unter dem Präfix `private/invoices/`
  (z. B. `private/invoices/{JJJJ}/{Nummer}.pdf`, ARCHITEKTUR §3.3) gespeichert; SHA-256 in der DB. Schreiben nur, wenn
  das Objekt nicht existiert (bedingtes PUT, z. B. `If-None-Match: *`). Für das Präfix gilt eine R2-Bucket-Sperre gegen
  Löschen/Überschreiben, soweit verfügbar (Dauer = `settings.retention.invoiceYears`), **keine** Versionierung (nach
  Fristende muss die Löschung wirken, LOESCHKONZEPT L-06); täglicher verschlüsselter Spiegel (ARCHITEKTUR §10.4).
  Rückfallebene: eigener Rechnungs-Bucket (DIENSTE §3.4). Task `invoiceIntegrityCheck` (monatlich) berechnet alle
  Hashes neu und meldet Abweichungen/fehlende Dateien per Mail.
- **Rechtsgrundlage:** § 146 Abs. 4, § 147 AO; GoBD.
- **Abnahme:** `int` – zweiter Schreibversuch schlägt fehl; manipulierte Datei wird erkannt.
- **Phase:** P5 · **Owner:** nein

#### R-123 · Aufbewahrung von Rechnungen und Aufzeichnungen
- **Anforderung:** Rechnungen/Gutschriften und Rechnungsregister **10 Jahre** ab Ende des Ausstellungsjahres
  (Konzept-Freigabe; gesetzliche Mindestfrist für Buchungsbelege 8 Jahre), Monatsexporte 10 Jahre; vorher weder
  manuell noch automatisch löschbar. Die Frist ist die Einstellung `settings.retention.invoiceYears` ∈ {8, 10},
  Standard 10 (Feld laut DATENMODELL §7.1; Umstellen nur nach Antwort von Steuerberatung/Kanzlei, Kanzleifrage K-33).
  Details und Jobs: LOESCHKONZEPT L-06, L-07.
- **Rechtsgrundlage:** § 147 Abs. 1 Nr. 1, 4, Abs. 3, 4 AO (i. d. F. BEG IV); § 14b Abs. 1 UStG; Art. 17 Abs. 3
  lit. b DSGVO. Kanzlei/Steuerberatung: K-33.
- **Abnahme:** `int` – Löschversuch vor Fristende abgelehnt; `retentionInvoices` löscht erst nach Fristende.
- **Phase:** P5, P6 · **Owner:** nein

#### R-124 · Monatsexport ohne Kundendaten
- **Anforderung:** E-04. Export je Monat: CSV (Trennzeichen `;`, UTF-8 mit BOM) mit Rechnungs-/Gutschriftsnummer,
  Datum, Bestellnummer, Betrag, Steuermodus, Steuerbetrag (0 im KU-Modus), Zahlart, Stripe-Zahlungs-/Erstattungs-ID,
  Stripe-Gebühr (falls verfügbar, im Mock 0), Auszahlungs-ID; optional DATEV-Buchungsstapel (EXTF 700). **Keine
  Namen, Adressen oder E-Mail-Adressen** im Export; dazu ZIP aller PDFs des Monats. Gleiche Eingaben erzeugen eine
  byte-identische Datei. **Nie Beispieldaten:** Monats-CSV, DATEV-Stapel und Rechnungs-ZIP (ebenso der
  Verpackungs-Export, R-201) enthalten keine Datensätze mit `seed = true` und keine Belege der Serien
  `BSP-RE`/`BSP-GS` – auch nicht bei wirksamem `SEED_PREVIEW_MODE` (R-180).
- **Rechtsgrundlage:** § 147 AO, GoBD (maschinelle Auswertbarkeit); Art. 5 Abs. 1 lit. c DSGVO.
- **Abnahme:** `int` – Export eines Monats aus Test-Fixtures (`seed = false`, nur Test-DB) entspricht der erwarteten
  Datei; kein `@` und kein Kundenname im CSV; mit geladenem Beispielbestand und `SEED_PREVIEW_MODE=true` enthält der
  Export keine `BSP-`-Nummer und keinen Seed-Datensatz.
- **Phase:** P5 · **Owner:** nein

#### R-125 · Umsatz-Wächter Kleinunternehmergrenzen
- **Anforderung:** E-45. Summe laufendes Jahr = Shop-Umsatz (bezahlte Rechnungen abzüglich Gutschriften, nach
  Rechnungsdatum, ohne Beispieldaten) + manuelle Monatssummen (`revenue-entries`) der Quellen `tattoo`, `flohmarkt`,
  `auftragsarbeiten`, `sonstiges` **[ergänzt: `auftragsarbeiten`, da außerhalb des Shops bezahlt, E-11; Enum
  `REVENUE_SOURCES` per Migration erweitert]**. Vorjahr: berechnet, für Jahre vor dem Shop manuell
  (`settings.revenueGuard.manualYearTotals`). Task `revenueGuardCheck`; Warnstufen laut KONZEPT §8.4 (Dashboard + je
  eine Mail `admin_revenue_guard` pro Stufe und Jahr):
  - U1 ≥ 20.000 € im laufenden Jahr: „Über 25.000 € dieses Jahr heißt: ab 01.01. nächsten Jahres keine
    Kleinunternehmerregelung. Sprich mit der Steuerberatung.“
  - U2 > 25.000 €: „Kleinunternehmerregelung endet voraussichtlich zum 01.01.{Jahr+1}; Umstellung vorbereiten.“
  - U3 ≥ 80.000 €: Hinweis „80 % der 100.000-€-Grenze erreicht“.
  - U3a ≥ 90.000 €: dringende Warnung zur 100.000-€-Grenze.
  - U4 ≥ 95.000 €: „Nur noch {Rest} € bis 100.000 € – Steuerberatung jetzt kontaktieren.“
  - U5 > 100.000 €: Alarm „Ab diesem Umsatz gilt sofort die Regelbesteuerung – Steuermodus umstellen“ (R-032).
  - U0 am 1. Januar: war das Vorjahr > 25.000 €, Alarm „Kleinunternehmerregelung gilt dieses Jahr nicht“.
- **Rechtsgrundlage:** § 19 Abs. 1 UStG i. d. F. ab 01.01.2025 (25.000 € Vorjahr, 100.000 € laufendes Jahr).
- **Abnahme:** `unit` – Stufen bei 19.999/20.000/25.001/80.000/90.000/95.000/100.001 €; `int` – Neujahrsprüfung,
  keine doppelten Mails.
- **Phase:** P5 · **Owner:** ja – monatlich Tattoo-, Flohmarkt- und Auftragsarbeiten-Summen eintragen.

#### R-126 · Kein Umsatzsteuerausweis im Kleinunternehmer-Modus
- **Anforderung:** Im KU-Modus erscheinen nirgends Umsatzsteuersätze oder -beträge: Seiten, Mails, Rechnungen, Stripe
  (keine Tax Rates, `automatic_tax` aus), JSON-LD (kein `valueAddedTaxIncluded: true`).
- **Rechtsgrundlage:** § 14c UStG; § 19 UStG; § 5 UWG.
- **Abnahme:** `unit` – V-02-Scan der gerenderten Mails/PDF-Texte; `e2e` – V-02-Scan der gerenderten Seiten.
- **Phase:** P3–P5 · **Owner:** nein

#### R-127 · „Offline verkauft“ ohne Kassenfunktion
- **Anforderung:** E-28. Der Knopf setzt nur `status = sold`, `soldChannel = offline`, `soldAt` (optional Notiz
  `offlineSaleNote` ohne Preis). Kein Betrag, kein Beleg,
  kein Kassenbuch, kein Tagesabschluss, keine Bestellung, keine Rechnung. Umsätze vom Markt nur als Monatssumme
  (R-125).
- **Rechtsgrundlage:** § 146a AO, KassenSichV (kein elektronisches Aufzeichnungssystem schaffen); E-28.
- **Abnahme:** `int` – „offline verkauft“ erzeugt weder Bestellung noch Rechnung.
- **Phase:** P5 · **Owner:** nein

### 4.13 Datenschutz-Architektur (kein Cookie-Banner)

#### R-130 · Kein Speichern/Auslesen auf dem Endgerät vor Nutzeraktion
- **Anforderung:** Auf allen öffentlichen Seiten gilt vor der ersten bewussten Nutzeraktion (erstes „In den Korb“,
  Klick auf den Schalter „Animationen“): **keine Cookies**, nichts in `localStorage`, `sessionStorage`, IndexedDB oder
  Cache Storage, kein Service Worker (die Admin-PWA registriert ihren Service Worker nur mit Scope `ADMIN_ROUTE`).
  next-intl ohne Locale-Cookie (`localeCookie: false`; Sprache nur über den Pfad, `/` leitet anhand
  `Accept-Language` ohne Cookie weiter). Kein Fingerprinting (Canvas, Audio, Schriften-Aufzählung).
  Jede **eigene** Speicherung auf dem Endgerät erfüllt **alle** Schutzziele (für die Stripe-Cookies auf der Kasse gelten
  R-062 und Kanzleifrage K-30 b, für die Verwaltung R-136):
  1. **Erst nach Nutzeraktion:** entsteht durch die Aktion selbst, nie beim bloßen Seitenaufruf, Rendern oder Prefetch.
  2. **Technisch notwendig** für den ausdrücklich gewünschten Dienst (§ 25 Abs. 2 Nr. 2 TDDDG): Warenkorb, Kasse,
     gewählte Darstellung, Anmeldung in der Verwaltung.
  3. **Minimaler Inhalt:** keine personenbezogenen Daten (kein Name, keine E-Mail, keine Adresse), nur was die
     Funktion braucht.
  4. **Keine Tracking-Kennung:** nichts, was Besucher:innen über Seiten oder Besuche hinweg wiedererkennbar macht. Eine
     zufällige Kennung ist nur erlaubt, wo ein serverseitiger Vorgang zugeordnet werden muss (Kasse); sie ist dann
     `HttpOnly` und kurzlebig.
  5. **Kurze Laufzeit:** eigene Cookies höchstens 7 Tage (Kassen-Kennung höchstens 1 Stunde); gelöscht, sobald der
     Zweck entfällt (leerer Korb, abgeschlossene Bestellung). Die Darstellungs-Einstellung (Zeile a) bleibt, bis die
     Person sie ändert oder löscht; sie enthält nur `reduced` oder `full`.

  Erlaubt ist **abschließend** (Namen und Attribute verbindlich laut ARCHITEKTUR §8.7):

  | Nr. | Speicher | entsteht durch | Inhalt | Laufzeit, Attribute |
  |---|---|---|---|---|
  | a | `localStorage['pc-motion']` | Klick auf den Schalter „Animationen“ | `reduced` oder `full` | bis zum nächsten Klick bzw. Löschen durch die Person |
  | b | Stripe-Cookies `__stripe_mid`, `__stripe_sid` | Aufruf der Kasse (R-062) | Stripe | laut Stripe (Kanzleifrage K-30 b) |
  | c | Admin-Cookie `payload-token` | Anmeldung unter `ADMIN_ROUTE` | Payload-Sitzung | ≤ 7 Tage, `HttpOnly`, `SameSite=Strict`, `Secure` (Produktion) |
  | d | Cookie `pc_cart` | erstes „In den Korb“ | base64url-JSON nur mit `v`, `items` (≤ 20 Einträge, je nur Stück-ID `id` und Preis beim Hinzufügen `p` in Cent – nur für den Hinweis „Preis wurde aktualisiert“) und `delivery` (`shipping`/`pickup`); keine Kennung, keine Personendaten | `Max-Age` 7 Tage, `Path=/`, `SameSite=Lax`, `Secure` (außer `localhost`); **nicht** `HttpOnly` (Korb-Anzahl auf statischen Seiten) – zulässig, weil der Inhalt nichts Schützenswertes enthält |
  | e | Cookie `pc_checkout` | Klick auf „Zur Kasse“ (POST) | zufälliger Kassen-Token (ARCHITEKTUR §8.6) | `Max-Age` 3600 (1 h), `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` |

  Es gibt **keinen** serverseitigen Warenkorb; der Server prüft bei jeder Aktion die Stücke neu. Jede weitere
  Speicherung braucht eine Änderung dieser Anforderung **und** von ARCHITEKTUR §8.7. Formular-Entwürfe werden nicht
  im Browser zwischengespeichert. Ob statt des Cookie-Warenkorbs ein Server-Warenkorb mit zufälliger ID
  (`HttpOnly`-Cookie, Warenkorb in der Datenbank) nötig ist, klärt Kanzleifrage K-38 (ARCHITEKTUR C-05); bis zur
  Antwort gilt die Umsetzung oben.
- **Rechtsgrundlage:** § 25 Abs. 1, Abs. 2 Nr. 2 TDDDG; DSK-Orientierungshilfe Digitale Dienste (Rn. 24, 74, 80, 88,
  116); EDPB-Leitlinien 2/2023; Art. 5 Abs. 1 lit. c, Art. 25 DSGVO; E-43. Kanzlei: K-30, K-38.
- **Abnahme:** `e2e` – frischer Browser-Kontext je Seitentyp: `context.cookies()` leer, `localStorage.length === 0`,
  `sessionStorage.length === 0`, `indexedDB.databases()` leer, keine Service-Worker-Registrierung; nach „In den Korb“
  genau ein Cookie `pc_cart` mit den Attributen aus Zeile d, dekodierter Inhalt hat nur die Schlüssel `v`, `items`,
  `delivery`, jedes Element von `items` nur `id` und `p`; nach „Zur Kasse“ zusätzlich `pc_checkout` (`HttpOnly`, Ablauf ≤ 3600 s); nach Leeren des Korbs ist
  `pc_cart` gelöscht; `localStorage` bleibt leer bis zum Klick auf „Animationen“, danach nur der Schlüssel `pc-motion`.
- **Phase:** P2 (Grundlage), P4 (Warenkorb), P10 (Gesamtprüfung) · **Owner:** nein

#### R-131 · Keine Drittanbieter-Requests, CSP, selbst gehostete Schriften
- **Anforderung:** Öffentliche Seiten laden Ressourcen nur vom eigenen Origin (Statistik läuft same-origin, R-132).
  Einzige Ausnahme: Kasse → Stripe-Hosts laut YAML in DIENSTE.md; Requests aus Stripe-Frames sind Stripes eigene.
  Schriften (Mansalva, Bricolage Grotesque, IBM Plex Mono – E-79) als lokale Dateien (`next/font/local` oder
  `@fontsource/*`); **kein** `next/font/google`, keine Font-/JS-CDNs, keine Einbettungen (V-04 bis V-07).
  **Schutzziel der Content-Security-Policy: keine fremden Hosts.** Kern der Seiten-Kontexte `public`, `dynamic` und
  `checkout`: `default-src 'self'`; `img-src 'self' data: blob:`; `font-src 'self'`; `connect-src 'self'`;
  `frame-src 'none'`; `frame-ancestors 'none'`; `form-action 'self'`; `object-src 'none'`; `base-uri 'self'`; nur auf
  der Kasse zusätzlich die Stripe-Hosts aus DIENSTE.md. Die Kontexte `admin` und `api` erlauben ebenfalls nur den
  eigenen Origin (`api`: `default-src 'none'`). Kontexte und Pfade laut ARCHITEKTUR §8.1 (`public`, `dynamic`,
  `checkout`, `admin`, `api`); `src/lib/security/csp.ts` exportiert die Host-Listen je Kontext.
  - **Soll für `script-src`:** keine `'unsafe-inline'`. Statische öffentliche Seiten (`public`) über Hashes/SRI
    (inklusive sha256-Hash des Inline-Skripts für `pc-motion`); Kasse (`checkout`), dynamische Seiten (`dynamic`) und
    Verwaltung (`admin`) mit Nonce je Anfrage.
  - **Vorläufige Regel (Rückfall, Kanzleifrage K-41):** Lassen sich statische öffentliche Seiten bzw. die Verwaltung
    ohne `'unsafe-inline'` nicht betreiben (ARCHITEKTUR Spike B-03 für `public`, Spike B-01 für `admin`), ist im
    betroffenen Kontext `public` bzw. `admin` `script-src 'self' 'unsafe-inline'` zulässig – nur zusammen mit
    `'self'` als einziger Host-Quelle, ohne jeden Fremd-Host, und mit ADR. Kasse und dynamische Seiten behalten die
    Nonce. Das Schutzziel dieser Anforderung (kein Request an Dritte) bleibt damit erfüllt; nur der zusätzliche Schutz
    gegen eingeschleuste Inline-Skripte ist schwächer.
- **Rechtsgrundlage:** Art. 5 Abs. 1 lit. c, f, Art. 25, 32, Art. 44 ff. DSGVO; § 25 TDDDG; LG München I 3 O 17493/20
  (Google Fonts); EuGH C-40/17 (Fashion ID). Kanzlei: K-41.
- **Abnahme:** `e2e` – Netzwerkmitschnitt je Seitentyp (mit `PAYMENTS_DRIVER=mock`): alle Request-Hosts = eigener
  Origin; keine CSP-Verstöße; `unit` – CSP-Hosts ⊆ YAML-Hosts aus DIENSTE.md für denselben Kontext; enthält
  `script-src` `'unsafe-inline'`, dann nur in den Kontexten `public` oder `admin` und ohne weitere Host-Quelle als
  `'self'`; statischer
  Scan V-04 bis V-07.
- **Phase:** P2 (Grundlage), P10 (Gesamtprüfung) · **Owner:** nein

#### R-132 · Statistik (Vercel Web Analytics) nur nach Freigabe
- **Anforderung:** E-96. `@vercel/analytics` wird nur gerendert, wenn `NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'`
  **und** `APP_ENV === 'production'` **und** die Einstellung `settings.analytics.enabled` gesetzt ist (Pflichtfeld
  `settings.analytics.confirmedAt` + Notiz „Kanzlei hat K-30 bestätigt“). Standard in allen Umgebungen: aus.
  `beforeSend`: keine Events für Warenkorb, Kasse, Danke-Seite, Bestellstatus (`/de/bestellung/*`, `/en/order/*`),
  Widerrufs-Schritte und Verwaltung; alle Query-Parameter entfernen; keine Custom Events. Kein Vercel Speed Insights,
  keine weitere Statistik.
- **Rechtsgrundlage:** § 25 TDDDG; Art. 6 Abs. 1 lit. f DSGVO; E-96. Kanzlei: K-30.
- **Abnahme:** `unit` – `beforeSend` verwirft/säubert Beispiel-URLs; `e2e` – Flag aus → kein Analytics-Skript.
- **Phase:** P10 · **Owner:** ja – Aktivierung in P11 erst nach Kanzlei-Antwort.

#### R-133 · Fehlerüberwachung ohne Personenbezug
- **Anforderung:** Sentry (EU-Region) nur serverseitig/Edge und in der Verwaltung; **kein Sentry-Browser-SDK auf
  öffentlichen Seiten** (Standard bis K-30). `sendDefaultPii: false`, kein Session Replay, kein Profiling mit
  Nutzerdaten; `beforeSend` entfernt E-Mail-Adressen, Namen, Adressen, IBANs, Tokens (Bestellstatus-Pfad) und IPs.
  Ohne `SENTRY_DSN` ist Sentry aus (Entwicklung, CI).
  **Browser-Fehler öffentlicher Seiten** (`POST /api/client-errors`, ARCHITEKTUR §2.5): standardmäßig **aus**, bis
  Kanzleifrage K-30 (c) beantwortet ist; auf öffentlichen Seiten wird bis dahin kein Fehler-Skript ausgeliefert. Wird
  der Endpunkt eingeschaltet, dann nur first-party (eigener Origin), ohne Cookies und Endgerätespeicher, ohne
  Speicherung der IP (nur Rate-Limit über den täglich wechselnden IP-Hash, R-134), ohne Personendaten, Tokens oder
  Formularinhalte (geschwärzt wie R-137) und nur serverseitig an Sentry weitergereicht.
- **Rechtsgrundlage:** Art. 5 Abs. 1 lit. c, Art. 25, 28, 32 DSGVO; § 25 TDDDG. Kanzlei: K-30.
- **Abnahme:** `unit` – Scrubber entfernt Beispieldaten; Endpunkt ist ohne Freischaltung aus (404 bzw. 204 ohne
  Verarbeitung); `e2e` – kein Sentry- und kein Fehler-Skript auf öffentlichen Seiten.
- **Phase:** P10 · **Owner:** nein

#### R-134 · Spamschutz ohne Drittanbieter
- **Anforderung:** Formulare (Auftragsarbeiten, Widerruf): Honeypot-Feld (gefüllt → Antwort 200, aber nichts
  gespeichert); Mindest-Ausfüllzeit serverseitig (Auftragsarbeiten 3 s, Widerruf keine); Rate-Limit über
  HMAC-SHA256(IP, täglich rotierendes Geheimnis), Zähler werden nach 24 h gelöscht; Grenzen je Formular laut
  ARCHITEKTUR §8.5 (u. a. Widerruf 30/h, R-091). Kein reCAPTCHA, hCaptcha, Turnstile, Friendly
  Captcha Cloud. Falls nötig nur selbst gehostetes ALTCHA für das Auftragsarbeiten-Formular.
- **Rechtsgrundlage:** Art. 5 Abs. 1 lit. c, e, Art. 6 Abs. 1 lit. f DSGVO; § 25 TDDDG.
- **Abnahme:** `int` – Honeypot verwirft; Rate-Limit-Einträge nach 24 h gelöscht (L-13).
- **Phase:** P6, P7 · **Owner:** nein

#### R-135 · Metadaten aus allen Bild-Uploads entfernen
- **Anforderung:** Jeder Upload (Produktfotos, Portfolio, Flash, Anfrage-Bilder) wird serverseitig mit `sharp`
  neu kodiert: EXIF, GPS, XMP, IPTC entfernt, Orientierung angewendet – für Original **und** alle Bildgrößen.
  Erlaubte Typen: JPEG, PNG, WebP.
- **Rechtsgrundlage:** Art. 5 Abs. 1 lit. c, Art. 25 DSGVO (Standort von Wohnung/Studio; Daten von Anfragenden).
- **Abnahme:** `int` – Fixture mit GPS-EXIF hochladen → alle gespeicherten Varianten ohne EXIF/GPS (z. B. `exifr`).
- **Phase:** P1 (Admin-Medien), P7 (Anfrage-Bilder) · **Owner:** nein

#### R-136 · Technisch-organisatorische Maßnahmen
- **Anforderung:** HTTPS + HSTS (≥ 1 Jahr); Header `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin` (Token-Seiten `no-referrer`), `Permissions-Policy` (Kamera nur
  im Admin für den Sendungsnummern-Scan), CSP (R-131). Verwaltung: `ADMIN_ROUTE ≠ /admin` in Produktion (E-93),
  `maxLoginAttempts` 5, `lockTime` 15 min, Passwort ≥ 12 Zeichen, Token-Laufzeit ≤ 7 Tage; Payload-Zugriffsregeln
  standardmäßig verweigernd. Privater Speicherbereich für Anfrage-Bilder, Einwilligungs-Nachweise und
  Compliance-Dokumente; Zugriff nur angemeldet über signierte URLs mit ≤ 5 min Gültigkeit. Geheimnisse nur in
  Umgebungsvariablen. Nächtliche, verschlüsselte Backups in der EU, ausgelöst in der App (`GET /api/cron/backup`,
  ARCHITEKTUR §10; aktiv nur mit `APP_ENV=production` und `BACKUP_ENABLED=true`, eingeschaltet in P11), **nie** über
  GitHub Actions (LOESCHKONZEPT L-23, DIENSTE §3.11).
- **Rechtsgrundlage:** Art. 25, 32 DSGVO; § 19 Abs. 4 TDDDG.
- **Abnahme:** `e2e` – Header vorhanden; `int` – privater Upload ohne Anmeldung → 403, signierte URL nach Ablauf → 403.
- **Phase:** P1, P10 · **Owner:** nein

#### R-137 · Keine personenbezogenen Daten in URLs und Logs
- **Anforderung:** Formulare senden per POST; keine E-Mail, kein Name, keine Adresse in Pfad oder Query. Der
  Bestellstatus-Token steht nur im Pfad der Statusseite und wird nie geloggt. Eigener Logger schwärzt E-Mail-Adressen,
  IBANs, Tokens und Telefonnummern; keine Logs vollständiger Request-Bodies oder Webhook-Payloads.
- **Rechtsgrundlage:** Art. 5 Abs. 1 lit. c, f, Art. 32 DSGVO.
- **Abnahme:** `unit` – Logger schwärzt Beispiele; `e2e` – nach Absenden von Kasse/Anfrage/Widerruf enthält die URL
  keine eingegebenen Daten.
- **Phase:** P4–P10 · **Owner:** nein

#### R-138 · Datenschutzhinweise am Ort der Erhebung
- **Anforderung:** Direkt am Formular ein Link auf den passenden Abschnitt der Datenschutzerklärung: Kasse,
  Widerrufsfunktion, Auftragsarbeiten-Formular (dort zusätzlich Baustein `inquiry.privacyNotice` mit Löschung nach
  6 Monaten).
- **Rechtsgrundlage:** Art. 13 DSGVO.
- **Abnahme:** `e2e` – Link bzw. Text an allen drei Formularen.
- **Phase:** P4, P6, P7 · **Owner:** nein

#### R-139 · Instagram nur als Link
- **Anforderung:** Instagram nur als einfacher Link (`https://www.instagram.com/planet.claire.tattoos/`,
  DM: `https://ig.me/m/planet.claire.tattoos`, jeweils `rel="noopener noreferrer"`). Bilder nur als selbst gehostete
  Kopien (E-64). Kein Embed, kein oEmbed, kein Feed über die Graph-API, kein Widget.
- **Rechtsgrundlage:** § 25 TDDDG; EuGH C-40/17; Art. 26 DSGVO.
- **Abnahme:** `unit` – V-05-Scan.
- **Phase:** P3, P7 · **Owner:** nein

### 4.14 Datenschutz-Organisation

#### R-150 · Auskunft und Datenübertragbarkeit (Art. 15, 20 DSGVO)
- **Anforderung:** Verwaltungsansicht „Datenschutz-Anfragen“ (Collection `privacy-requests`, Nummer `DS-JJJJ-NNNN`,
  R-153) mit Suche nach E-Mail (normalisiert, Groß-/Kleinschreibung egal), Bestellnummer oder Name über: `orders`
  (inkl. Snapshots, `statusHistory`), `checkouts`, `invoices` (Rechnungen/Gutschriften), `withdrawals`, `inquiries`
  (inkl. Bilder), `complaints` (Reklamationsakten, R-110, inkl. Fotos), `email-log`, `consent-log`, frühere
  `privacy-requests`. Export als ZIP: `daten.json` (strukturiert, maschinenlesbar – Art. 20), `auskunft.html` (lesbar,
  mit den Angaben nach Art. 15 Abs. 1 lit. a–h aus Bausteinen der Datenschutzerklärung), Kopien der Bilder und PDFs.
  Exportdateien liegen privat (`private-uploads`, Zweck `data_export`) und werden 30 Tage nach Versand der Antwort
  gelöscht (L-17).
- **Rechtsgrundlage:** Art. 12, 15, 20 DSGVO.
- **Abnahme:** `int` – Seed-Person mit Daten in allen Collections → Export enthält jeden Datensatz (Zählvergleich),
  JSON valide, Bilder enthalten.
- **Phase:** P6 · **Owner:** nein

#### R-151 · Löschen und Einschränken mit Aufbewahrungssperre (Art. 17, 18 DSGVO)
- **Anforderung:** Knopf „Löschen/Einschränken“ je Person zeigt je Datensatz die anwendbare Regel aus dem
  LOESCHKONZEPT und die Aktion: **sofort löschen** (inkl. Speicherobjekte und Mail-Protokoll), **einschränken bis
  {Datum}** (gesetzliche Aufbewahrung: `privacy.processingRestricted = true`, keine weiteren Mails/Verarbeitung,
  nicht erforderliche Felder sofort entfernen – Telefon, Notizen, Packfotos), oder **behalten** (Legal Hold
  `privacy.legalHold` bei Rechtsstreit, Pflicht-Begründung, Art. 17 Abs. 3 lit. e). Unveränderliche Rechnungen bleiben
  unverändert bis Fristende. Jede Aktion → `deletion-log`.
  Vorlage für die Antwort-Mail.
- **Rechtsgrundlage:** Art. 17, 18, 19 DSGVO; § 147 AO.
- **Abnahme:** `int` – Person mit alter und neuer Bestellung: alte (Frist abgelaufen) gelöscht, neue eingeschränkt,
  Rechnung unverändert, Log-Einträge vorhanden.
- **Phase:** P6 · **Owner:** nein

#### R-152 · Berichtigung, Widerspruch, Widerruf von Einwilligungen
- **Anforderung:** Art. 16: Name/Adresse/E-Mail in Bestellungen ohne Rechnung editierbar; nach Rechnungsstellung nur
  per Gutschrift + neuer Rechnung (R-121), Vermerk im Verlauf. Art. 21: Widerspruch gegen Verarbeitungen nach lit. f
  (Protokolle, Spamschutz) wird dokumentiert und geprüft. Art. 7 Abs. 3: DHL-Einwilligung (R-101) und
  Portfolio-Einwilligung (R-172) per Knopf widerrufbar, Wirkung ab sofort; Bestätigung an die Person per Mail
  `consent_withdrawal_confirmation` (KONZEPT M16).
- **Rechtsgrundlage:** Art. 7 Abs. 3, 16, 21 DSGVO.
- **Abnahme:** `int` – Berichtigung vor/nach Rechnung; Widerruf DHL-Einwilligung entfernt E-Mail aus „Adresse kopieren“.
- **Phase:** P6 · **Owner:** nein

#### R-153 · Fristüberwachung Betroffenenanfragen
- **Anforderung:** `privacy-requests` (DATENMODELL §6.26): Art (`types`: Auskunft, Berichtigung, Löschung,
  Einschränkung, Übertragbarkeit, Widerspruch, Einwilligungswiderruf), `receivedAt`, `dueAt` (+ 1 Monat,
  kalendergenau), optional `extendedDueAt` (+ 2 weitere Monate mit `extensionReason`, Mitteilung innerhalb des ersten
  Monats, `extensionNotifiedAt`), Status (`received`, `identity_check`, `in_progress`, `answered`, `rejected`),
  Identitätsprüfung (`identityVerified`, `identityMethod`), `answeredAt`. Task `privacyRequestsDeadlineReminder`
  (täglich) mailt (`admin_privacy_request_due`) 7 Tage und 1 Tag vor `extendedDueAt` bzw. `dueAt`. Dashboard-Hinweis
  bei offenen Anfragen. Ablauf: LOESCHKONZEPT §5.
- **Rechtsgrundlage:** Art. 12 Abs. 3, 4 DSGVO.
- **Abnahme:** `int` – Erinnerungen genau an Tag −7 und −1.
- **Phase:** P6 · **Owner:** nein

#### R-154 · Automatische Löschjobs
- **Anforderung:** Alle Jobs aus LOESCHKONZEPT §4 (Task-Slugs laut ARCHITEKTUR Anhang A.3, ausgelöst über den
  Job-Wecker `GET /api/cron/tick`, ARCHITEKTUR §9.6); jeder Job idempotent, Batch ≤ 500, schreibt
  `deletion-log`, unterstützt Trockenlauf (Admin-Ansicht „Löschvorschau“: was wird in den nächsten 30 Tagen gelöscht)
  und meldet Fehler per Mail. Collections mit personenbezogenen Daten (`checkouts`, `orders`, `withdrawals`,
  `complaints`, `inquiries`, `privacy-requests`, `email-log`, `consent-log`, `private-uploads`, `tattoo-gallery`)
  haben **keine** Payload-Versionen/Entwürfe und **keinen** Papierkorb (`trash`) (LOESCHKONZEPT §1 Nr. 6).
- **Rechtsgrundlage:** Art. 5 Abs. 1 lit. e, Art. 17, 25 DSGVO.
- **Abnahme:** `int` – je Regel mit Fake-Zeit: vor Fristende vorhanden, danach gelöscht/anonymisiert; Speicherobjekte
  gelöscht; `unit` – die Payload-Konfiguration der genannten Collections hat weder `versions` noch `trash`.
- **Phase:** P6 · **Owner:** nein

#### R-155 · Auftragsverarbeitungsverträge vor Go-live
- **Anforderung:** Für jeden Dienst mit `avv: required` in DIENSTE.md (YAML) schließt Jutta vor Go-live den AVV/DPA ab.
  Einstellung `settings.processorAgreements[]` {`serviceId` (= `id` aus der YAML), `signedAt`, `documentVersion`,
  `url`, optional `file` (`private-uploads`)}. Das Gate R-210 prüft Vollständigkeit. Aus derselben YAML (und diesen
  Einträgen) entsteht die Empfänger-Tabelle, die als Komponente unter dem Datenschutztext gerendert wird (kein Token,
  R-012).
- **Rechtsgrundlage:** Art. 28 DSGVO.
- **Abnahme:** `unit` – Gate mit fehlendem Eintrag schlägt fehl; `manuell` – P11-Checkliste in DIENSTE.md §6.
- **Phase:** P10 (Gate), P11 (Abschluss) · **Owner:** ja

#### R-156 · Verzeichnis von Verarbeitungstätigkeiten
- **Anforderung:** P6 erstellt `docs/recht/VVT.md` nach Art. 30 DSGVO (je Verarbeitung: Zweck, Kategorien betroffener
  Personen und Daten, Empfänger, Drittlandübermittlung, Löschfristen, Verweis auf TOM R-136) aus DIENSTE.md und
  LOESCHKONZEPT.md; Aktualisierung bei jeder Dienständerung. Jutta erhält es in P11 als Datei zum Aufbewahren.
- **Rechtsgrundlage:** Art. 30 DSGVO (Ausnahme Abs. 5 greift nicht: Verarbeitung nicht nur gelegentlich).
- **Abnahme:** `manuell` – Datei vorhanden, deckt alle Verarbeitungen aus KANZLEI-BRIEFING §11 ab.
- **Phase:** P6 · **Owner:** ja – aufbewahren.

#### R-157 · Prozess Datenpanne
- **Anforderung:** Abschnitt „Datenpanne“ im Betriebshandbuch (RUNBOOK) und eine einfache Anleitung für Jutta:
  erkennen (Sentry-/Anbieter-Meldung), bewerten, dokumentieren, Meldung an die Berliner Beauftragte für Datenschutz und
  Informationsfreiheit binnen 72 Stunden (Online-Formular), Benachrichtigung Betroffener bei hohem Risiko,
  Kontaktliste der Dienstleister.
- **Rechtsgrundlage:** Art. 33, 34 DSGVO.
- **Abnahme:** `manuell` – Abschnitt vorhanden, Vorlagen DE vorhanden.
- **Phase:** P10 · **Owner:** ja – im Ernstfall melden.

### 4.15 Formulare

#### R-160 · Anfrageformular Auftragsarbeiten
- **Anforderung:** E-11. Formular auf `/de/auftragsarbeiten`: **Name**, **E-Mail**, **„Was stellst du dir vor?“**
  (`idea`, 20–3000 Zeichen), Gegenstand (`objectType`, Auswahl laut DATENMODELL-Enum `INQUIRY_OBJECT_TYPES`; bei
  „Sonstiges“ kurzer Freitext), Wunschzeitraum (optional), Budget (optional), bis zu **5 Bilder** (optional;
  JPEG/PNG/WebP; Auswahl bis 15 MB, der Browser verkleinert vor dem Upload auf ≤ 2560 px und ≤ 4 MB, der Server lehnt
  Anfragen über 4,5 MB mit 413 ab – ARCHITEKTUR §8.8). Hinweis am Upload: „Bitte nur Motiv- oder Referenzbilder –
  keine Fotos von Personen, keine Gesundheitsangaben.“ Baustein `inquiry.privacyNotice` + Link auf die
  Datenschutzerklärung. **Keine** Einwilligungs-Checkbox (Rechtsgrundlage vorvertraglich), keine Altersabfrage, keine
  Zahlung, keine Preiszusage.
  Speicherung in `inquiries` (Nummer `AA-JJJJ-NNNN`; nur Admin-Zugriff, **nie** über die öffentliche API), Bilder im
  privaten Speicher (`private-uploads`, R-136), Metadaten entfernt (R-135). Benachrichtigung an Jutta
  (`admin_inquiry_received`) nur mit Referenznummer, Gegenstand, Anzahl der Bilder und Admin-Link – **ohne** Namen,
  Freitext, Bilder oder E-Mail-Adresse. Automatische Antwort (`inquiry_receipt`, Baustein `inquiry.autoReply`):
  Eingang, Referenz, „noch kein Vertrag, keine Zahlung“, Löschung nach 6 Monaten, Link Datenschutz – ohne Bilder.
  Löschung 6 Monate nach Eingang (LOESCHKONZEPT L-10).
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b, Art. 5 Abs. 1 lit. c, e, Art. 13 DSGVO; E-11. Kanzlei: K-25.
- **Abnahme:** `e2e` – Absenden mit 5 Bildern klappt, 6. Bild abgelehnt; `int` – `GET /api/inquiries` ohne Admin →
  403; Benachrichtigungsmail enthält weder Namen noch Freitext; gespeicherte Bilder ohne EXIF; Upload > 4,5 MB → 413.
- **Phase:** P7 · **Owner:** nein

#### R-161 · Verträge über Auftragsarbeiten außerhalb des Shops
- **Anforderung:** Angebot und Vertrag laufen per E-Mail (E-11). Die Verwaltung stellt eine Vorlage
  `commission.offer` bereit (Kanzleitext, bis dahin Platzhalter) mit: wesentlichen Eigenschaften, Gesamtpreis inkl.
  Versand, Lieferzeit, Zahlungsweg, Herstellerangaben/Warnhinweisen (GPSR) und der Widerrufsinformation: Ausschluss
  nur, wenn das Stück nach individuellen Vorgaben angefertigt wird (§ 312g Abs. 2 Nr. 1 BGB), sonst Widerrufsbelehrung
  und Muster-Formular beifügen. Umsätze werden als Monatssumme erfasst (R-125). Auftragsarbeiten sind nie im Shop
  kaufbar.
- **Rechtsgrundlage:** §§ 312c, 312d, 312g BGB; Art. 246a EGBGB; Art. 19 GPSR. Kanzlei: K-24.
- **Abnahme:** `manuell` – Vorlage vorhanden (Platzhalter bis P11), nach Kanzlei-Lieferung eingespielt.
- **Phase:** P7, P11 · **Owner:** ja – Kanzleitext beschaffen, Vorlage nutzen.

#### R-162 · Keine weiteren Datenerhebungen
- **Anforderung:** Außer Kasse, Widerrufsfunktion und Auftragsarbeiten-Formular gibt es auf öffentlichen Seiten
  **kein** Formular mit personenbezogenen Eingaben: kein Kontaktformular, kein Newsletter, keine Warteliste, keine
  Kundenkonten, keine Kommentare, keine Bewertungen (E-13, E-30, E-51).
- **Rechtsgrundlage:** Art. 5 Abs. 1 lit. c DSGVO; ENTSCHEIDUNGEN.
- **Abnahme:** `e2e` – Crawl aller Seitentypen: `<form>` mit Text-/E-Mail-Eingabe nur auf den drei erlaubten Seiten.
- **Phase:** P10 · **Owner:** nein

### 4.16 Tattoo-Bereich und Portfolio

#### R-170 · Tattoo-Bereich ohne Online-Vertragsschluss
- **Anforderung:** Kein Tattoo-Objekt (Flash, Aktion, Custom) kann in Warenkorb oder Kasse (API lehnt ab). Je Flash
  zwei Knöpfe (KONZEPT §9.4): der Mail-Knopf öffnet `mailto:` mit Betreff „Flash-Anfrage F-012 – {Titel}“ (der
  vorbefüllte Text enthält keine Personendaten und bittet ausdrücklich um keine Gesundheitsangaben), der DM-Knopf
  öffnet den DM-Link mit kopierbarem Text-Baustein „F-012 – {Titel}“; die Mail-Adresse steht zusätzlich als
  kopierbarer Text daneben (E-51). Kein Formular, kein Upload, keine Online-Anzahlung (E-53).
  FAQ-/Ablauf-Texte (Entwürfe von Claude, E-62) beschreiben die Kaution nur als „individuell vereinbart“, ohne
  Verfall- oder Nicht-Erstattungs-Klauseln (V-24), und nennen das Mindestalter 18.
- **Rechtsgrundlage:** §§ 312c, 312g, 356a BGB (kein Online-Vertrag); Art. 9 DSGVO (keine Gesundheitsdaten über die
  Website); E-51, E-53. Kanzlei: K-26.
- **Abnahme:** `int` – Warenkorb-API lehnt Tattoo-IDs ab; `e2e` – Mail-Knopf hat `href` `mailto:…?subject=…` mit
  „Flash-Anfrage F-…“, DM-Knopf verlinkt `ig.me`; `unit` – V-24/V-25-Scan der Tattoo-Inhalte.
- **Phase:** P7 · **Owner:** nein

#### R-171 · Abgelaufene Flash-Days/Aktionen ausblenden
- **Anforderung:** E-53. Angebote (`tattoo-offers`), deren `endsAt` erreicht ist (Standard: Ende des Starttags,
  23:59 Europe/Berlin), erscheinen nicht mehr öffentlich. Es wird **kein** Status gespeichert: Die öffentliche Abfrage
  filtert `endsAt > jetzt`, und der Task `revalidateEndedOffers` rendert zwischengespeicherte Seiten zu Beginn und Ende
  jedes Angebots neu (Weckzeit, spätestens 15 min nach `endsAt`).
- **Rechtsgrundlage:** § 5 UWG (keine abgelaufenen Angebote bewerben); E-53.
- **Abnahme:** `int` – Angebot mit `endsAt` in der Vergangenheit wird nicht ausgeliefert; nach Ablauf (vorgestellte
  Uhr) ist es spätestens nach dem nächsten Task-Lauf von allen Seiten verschwunden.
- **Phase:** P7 · **Owner:** nein

#### R-172 · Portfolio-Fotos nur mit Einwilligung
- **Anforderung:** E-42. Je Galerie-Eintrag (`tattoo-gallery`, DATENMODELL §6.16): `showsCustomer` (Standard
  `true`), `consentGiven` (Standard `false`), `consentDate`, `consentScope` (`tattoo_only` | `with_face`),
  `consentNote`, Erlaubnis zur Nennung des Instagram-Namens (ja/nein, Feld laut DATENMODELL), optional
  `consentEvidence` (privat), `consentWithdrawnAt`. Der Galerie-Eintrag hat **keine** Payload-Versionen/Entwürfe
  (R-154). Öffentliche Seiten und API liefern nur veröffentlichte Einträge mit
  `showsCustomer = false` oder `consentGiven = true`; die zugehörigen Bilder sind sonst `media.restricted` (einzige
  Ausnahme: Beispielbestand mit `seed = true` bei wirksamem `SEED_PREVIEW_MODE`, nie in Produktion, R-181).
  Widerruf („Einwilligung widerrufen“): sofort unveröffentlicht und `restricted`; öffentliche Bildvarianten innerhalb
  von 24 h gelöscht bzw. am Origin 404 (L-20). Bilder mit `showsPerson = customer` werden deshalb **nicht** mit
  `immutable`, sondern mit `max-age ≤ 86400` ausgeliefert. Hinweis in der Verwaltung: Eine Instagram-Freigabe deckt
  die Website nicht automatisch ab.
- **Rechtsgrundlage:** § 22 KUG; Art. 6 Abs. 1 lit. a, Art. 7 Abs. 3 DSGVO; E-42. Kanzlei: K-27.
- **Abnahme:** `int` – ohne Einwilligung nicht in der API-Antwort (mit `SEED_PREVIEW_MODE=false`); mit Einwilligung
  sichtbar; nach Widerruf liefert die Bild-URL am Origin 404; Cache-Header geprüft.
- **Phase:** P7 · **Owner:** ja – Einwilligungen nachholen und eintragen.

### 4.17 Beispielbestand und Vorschau

#### R-180 · Beispielbestand kennzeichnen und entfernbar
- **Anforderung:** E-63. **Schutzziel:** Beispieldaten sind nie mit echten Belegen, echten Bestellungen oder echten
  Personen verwechselbar und nie in Produktion. Jeder Beispieldatensatz trägt `seed: true` (alle Collections inkl.
  Medien, Bestellungen, Rechnungen, Widerrufe, Anfragen). Personen sind offensichtlich erfunden; E-Mail-Adressen nur
  `@example.com`/`@example.org`; der Mailversand unterdrückt unabhängig davon immer `example.com`, `example.org`,
  `example.net`, `*.invalid` und `*.test`. Straßennamen, die es in Berlin nicht gibt; keine Telefonnummern.
  Nummern laut DATENMODELL §13.3 und `content/seed/SEED-SPEC.md`: Stücke 901–930 (E2E-Fixtures 980–999 nur in der
  Test-DB; 901–999 sind für echte Stücke gesperrt, solange Beispieldaten existieren), Bestellungen `PC-2026-900NN`,
  Rechnungen/Gutschriften in den eigenen Serien `BSP-RE-…`/`BSP-GS-…` mit eigenem Zähler (R-121), Beispiel-IBAN
  `DE36000000000000000000`. Jede Beispiel-Bestellung, -Rechnung und -Gutschrift zeigt zusätzlich **sichtbar
  „Beispiel“** (Verwaltung, PDF, Mail). Keine erfundenen Bewertungen/Testimonials (V-17).
  Knopf „Beispieldaten entfernen“ (mit Bestätigung) löscht alle `seed: true`-Datensätze samt Speicherobjekten,
  idempotent, protokolliert die Anzahl, lässt echte Zähler unberührt. Nicht zum Beispielbestand gehört der
  Grund-Seed (`seed = false`), insbesondere die Platzhalter-Rechtstexte (R-002); sie bleiben, bis Kanzleitexte
  aktiviert sind. In die Produktionsdatenbank gelangt der Beispielbestand höchstens vorübergehend vor der Freischaltung
  (P11: Seiten- und FAQ-Texte übernehmen, danach „Beispieldaten entfernen“ mit „Seitentexte behalten“); bis dahin ist
  `settings.shop.isOpen = true` gesperrt (R-210, DATENMODELL §13.7), und öffentlich sichtbar ist er dort nie
  (Seed-Filter bei `APP_ENV=production`). Exporte (Monats-CSV, DATEV, Rechnungs-ZIP, Verpackungs-CSV) enthalten nie
  Beispieldaten, auch nicht im Vorschau-Modus (R-124, R-201).
- **Rechtsgrundlage:** Art. 5 DSGVO (keine realen Personen); § 5 UWG, UWG-Anhang Nr. 23b, 23c; GoBD (Nummernkreis).
- **Abnahme:** `int` – Seed laden → jedes Seed-Rechnungs-PDF enthält „Beispiel“ und eine Nummer mit `BSP-`; eine Mail
  an eine `@example.org`-Adresse wird als unterdrückt protokolliert; entfernen → in allen Collections 0 Datensätze
  mit `seed: true`; echter Rechnungszähler unverändert.
- **Phase:** P8 · **Owner:** nein

#### R-181 · `SEED_PREVIEW_MODE` nie in Produktion
- **Anforderung:** Beim Serverstart: Ist `APP_ENV === 'production'` (ARCHITEKTUR §4.2, nie `NODE_ENV` oder
  `VERCEL_ENV`) und `SEED_PREVIEW_MODE === 'true'`, bricht der Start mit klarer Fehlermeldung ab
  (`assertProductionEnv`). Unabhängig davon gilt der Vorschau-Modus bei `APP_ENV=production` nie als wirksam. Bilder
  mit `showsPerson = jutta` sind öffentlich nur mit dem Admin-Häkchen `media.ownerApproved`; `profil.jpg` und andere
  Bilder mit Jutta werden ohne ihre Freigabe weder importiert noch als Zeichenvorlage genutzt (DESIGN §12.4).
- **Rechtsgrundlage:** § 22 KUG; Art. 6 DSGVO; E-42.
- **Abnahme:** `unit` – Startprüfung wirft in der Produktionskonstellation; `int` – Bild mit `showsPerson = jutta`
  ohne `ownerApproved` liefert anonym 404.
- **Phase:** P8 · **Owner:** nein

#### R-182 · Vorschau-Datei als interne Datei
- **Anforderung:** E-98. `planet-claire-vorschau.html` zeigt auf jeder Seite ein Band „Interne Vorschau – nicht
  weitergeben · Beispieldaten · Rechtstexte sind Platzhalter“; die Kasse ist eine Attrappe („Vorschau – hier wird
  nichts gekauft“); keine externen Ressourcen. Kundenfotos ohne Einwilligung (nur durch `SEED_PREVIEW_MODE`) tragen ein
  kleines Etikett „intern – Einwilligung fehlt“. Verteilung nur als Artefakt/Release im **privaten** Repository, nie
  auf öffentlichem Hosting.
- **Rechtsgrundlage:** § 22 KUG; Art. 6 DSGVO. Kanzlei: K-34.
- **Abnahme:** `unit` – erzeugte Datei enthält das Band und keine `src=`/`href=` auf `http(s)://` außer Textlinks.
- **Phase:** P10 · **Owner:** nein

### 4.18 Barrierefreiheit

#### R-190 · BFSG-Ausnahme dokumentiert, keine Konformitätsbehauptung
- **Anforderung:** Keine gesetzliche Pflicht (Kleinstunternehmen, Dienstleistung). Keine „Erklärung zur
  Barrierefreiheit“ mit Konformitätsaussage, keine Aussagen „barrierefrei“, „WCAG-konform“, „BFSG-konform“ (V-26).
  Hinweis im Owner-Handbuch: Pflicht entsteht erst ab 10 Beschäftigten oder > 2 Mio. € Umsatz/Bilanzsumme.
- **Rechtsgrundlage:** § 2 Nr. 17, § 3 Abs. 3 BFSG. Kanzlei: K-36.
- **Abnahme:** `manuell` – Texte geprüft; V-26-Scan grün.
- **Phase:** P10 · **Owner:** nein

#### R-191 · Freiwillige Barrierearmut (Ziel WCAG 2.2 AA)
- **Anforderung:** axe-core ohne Verstöße der Stufe serious/critical auf allen Seitentypen; Kauf und Widerruf komplett
  per Tastatur möglich; Alt-Text DE/EN Pflicht für Produktbilder (R-042); `prefers-reduced-motion` → statisch;
  Textkontrast ≥ 4,5:1; sichtbarer Fokus; schlichte Textnavigation immer verfügbar (E-78, Konzept „Menü“).
- **Rechtsgrundlage:** keine Pflicht (freiwillig, schützt bei späterem Wachstum).
- **Abnahme:** `e2e` – axe je Seitentyp; Tastatur-Durchlauf Kasse und Widerruf.
- **Phase:** P2, P10 · **Owner:** nein

### 4.19 Verpackung, Produktpflichten, Owner-Pflichten

#### R-200 · LUCID-Registrierung und Systembeteiligung
- **Anforderung:** E-47: Jutta gilt als Herstellerin ihrer Versandverpackung (sie bringt die befüllte Verpackung
  erstmals in Verkehr). Vor dem ersten Versand **beides**: Registrierung im Verpackungsregister LUCID (ZSVR) **und**
  eigene Systembeteiligung (Kleinstlizenz) bei einem dualen System. Vorlizenzierte Kartons oder die Lizenz des
  Kartonhändlers reichen **nicht**. Das ist entschieden (E-47) und keine Kanzleifrage. Verpackung möglichst aus
  Papier/Pappe; Kunststoffanteile (z. B. Klebeband, Polster) werden mitgezählt (R-201). Die Planmenge beim
  Vertragsabschluss und die jährliche Mengenmeldung an LUCID und das duale System stammen aus dem Jahres-Export
  (R-201). Stammdaten: LUCID-Registrierungsnummer (`settings.business.lucidNumber`) sowie duales System und
  Vertragsbeginn (`settings.business.packagingScheme` {`name`, `contractFrom`}); das Gate R-210 verlangt beides,
  solange Versand aktiv ist.
- **Rechtsgrundlage:** VerpackDG (seit 12.08.2026); VO (EU) 2025/40 (PPWR); E-47. Kanzlei: K-35 (nur Details:
  Meldemengen, Nachweise, Fristen, Wahl des Systems).
- **Abnahme:** `unit` – Gate ohne LUCID-Nummer oder ohne Systembeteiligung rot; `manuell` – Registrierung öffentlich in
  LUCID auffindbar, Vertrag mit dem dualen System liegt vor.
- **Phase:** P10 (Gate), P11 (Registrierung, Vertrag) · **Owner:** ja – vor dem ersten Versand; danach jährlich Mengen
  melden.

#### R-201 · Verpackungsmengen erfassen
- **Anforderung:** E-47; im Umfang des Shops (kein Nicht-Ziel). Der Shop erfasst **je Sendung** Verpackungsart und
  -gewicht (Namen laut DATENMODELL §6.8.1, §6.8.8, §7.1):
  - Einstellungen: Verpackungsvorlagen `settings.packaging.templates` (Name, je Bestandteil Material ∈
    {`paper_cardboard` (Papier/Pappe), `plastic` (Kunststoff), `other` (Sonstiges)} und Gewicht in g) und je
    Versandklasse eine Standardvorlage (`settings.packaging.defaultsByShippingClass`; Startgewichte sind Schätzwerte,
    Jutta korrigiert sie beim ersten Packen).
  - Beim Packen ist die Standardvorlage der Versandklasse vorausgewählt; Jutta kann eine andere Vorlage wählen oder
    die Gewichte ändern. Gespeichert werden je Sendung Material und Gewicht jedes Bestandteils (`orders.packaging`,
    Wertkopie, unveränderlicher Stand zum Versandzeitpunkt); ohne erfasste Verpackung kein „versendet“. Abholungen
    ohne Versandverpackung zählen nicht.
  - **Jahres-Export** (`GET /api/admin/packaging-report?year=JJJJ`; CSV, Trennzeichen `;`, UTF-8 mit BOM) je
    Kalenderjahr (Europe/Berlin, nach Versanddatum): kg je Material (Papier/Pappe, Kunststoff, Sonstiges) und Anzahl
    Sendungen – für die Datenmeldung an LUCID und das duale System; dazu die laufende Jahressumme in der Verwaltung.
    Keine Kundendaten und keine Beispieldaten im Export (Sendungen mit `seed = true` zählen nie, auch nicht bei
    wirksamem `SEED_PREVIEW_MODE`; R-124).
- **Rechtsgrundlage:** VerpackDG/PPWR (Mengenmeldung an Register und System bei Systembeteiligung); E-47.
- **Abnahme:** `int` – Test-Sendungen (`seed = false`) mit Standardvorlage, geänderter Vorlage und eine Abholung →
  Jahres-Export summiert kg je Material korrekt, die Abholung zählt nicht, CSV enthält kein `@` und keinen
  Kundennamen; zusätzlich geladene Seed-Sendungen ändern die Summen nicht; eine geänderte Standardvorlage wirkt nur
  auf neue Sendungen.
- **Phase:** P5 · **Owner:** nein (Nutzung des Exports: R-200)

#### R-202 · EU-Länder nur mit Pflicht-Bestätigung freischaltbar
- **Anforderung:** Aktivieren eines EU-Landes verlangt Häkchen mit Datum: Bevollmächtigte:r nach Art. 45 PPWR
  benannt; 10.000-€-Schwelle/OSS mit Steuerberatung geprüft; Textilangaben in Landessprache geklärt;
  Versandpreise gepflegt; Rechtstexte angepasst (Felder je Land laut DATENMODELL §7.1). Keramik mit
  `foodContact = lebensmittelecht` ist für NL und LU automatisch gesperrt. GB/US nie (R-060). Gebaut werden nur diese
  Sperre und die Bestätigungen; EU-Versand bleibt aus (ENTSCHEIDUNGEN „Später“).
- **Rechtsgrundlage:** Art. 45 PPWR; § 3c UStG; Art. 16 Abs. 3 VO (EU) 1007/2011; nationale Keramik-Grenzwerte NL/LU.
- **Abnahme:** `int` – Aktivierung ohne Häkchen abgelehnt; NL + `lebensmittelecht` → Stück nicht bestellbar.
- **Phase:** P5 · **Owner:** nein

#### R-203 · GPSR-Herstellerpflichten am Produkt, Etiketten und Beileger
- **Anforderung:** System: druckbares Etikett und Beileger je Stück (PDF): Objektnummer, Name, Postanschrift,
  E-Mail, Warnhinweise, bei Deko-Keramik „Nur Deko – nicht für Lebensmittel“, optional QR-Code zur Produktseite;
  private Dokumentablage in `private-uploads` (Zwecke `supplier_document`, `lab_report`, `nickel_evidence`; je Datei
  Produktkategorie, Version und Datum; Risikoanalyse/technische Unterlagen je Kategorie, Sicherheitsdatenblätter,
  Lieferantenerklärungen, Prüfberichte) plus `conformity-declarations`; Erinnerung über `complianceDocsReview`
  (L-24). Owner: jedes Stück
  kennzeichnen (Stempel/Aufkleber am Keramikboden, Hangtag bei Textil, Schmuckkarte), technische Unterlagen je
  Kategorie anlegen, bei schweren Unfällen Meldung über das Safety Business Gateway.
- **Rechtsgrundlage:** Art. 9 Abs. 2, 3, 5, 6, 7, Art. 20 GPSR. Kanzlei: K-16.
- **Abnahme:** `int` – Etikett-PDF enthält alle Angaben; `manuell` – Owner-Checkliste in P11.
- **Phase:** P5, P11 · **Owner:** ja

#### R-204 · Markenrecherche „Planet Claire“ (empfohlen)
- **Anforderung:** Vor dem Start Recherche bei DPMA und EUIPO (u. a. Klassen 21 Keramik, 25 Bekleidung, 44
  Tätowierung), ggf. eigene Anmeldung. Nicht blockierend.
- **Rechtsgrundlage:** §§ 14, 15 MarkenG (Verletzungsrisiko). Kanzlei: K-37 (optional).
- **Abnahme:** `manuell` – Ergebnis in OFFENE-PUNKTE vermerkt.
- **Phase:** P11 · **Owner:** ja

#### R-205 · Stammdaten und steuerliche Klärung
- **Anforderung:** In P11 trägt Jutta ein bzw. klärt mit der Steuerberatung: vollständiger Name, Anschrift,
  Telefonnummer, Steuernummer, ggf. W-IdNr., Kleinunternehmer-Status bestätigt, Vorjahresumsatz (alle Tätigkeiten),
  IBAN/Kontoinhaberin für Vorkasse.
- **Rechtsgrundlage:** § 5 DDG; § 19 UStG; § 34a UStDV.
- **Abnahme:** `manuell` – Gate R-210 grün für diese Punkte.
- **Phase:** P11 · **Owner:** ja

### 4.20 Go-live

#### R-210 · Startklar-Prüfung (Go-live-Gate)
- **Anforderung:** Skript `pnpm check:golive` (und Admin-Seite „Startklar“) prüft und endet mit Code ≠ 0, wenn eines
  fehlt:
  1. Alle sechs `legal-texts`-Typen mit aktiver Fassung, `origin = lawyer` (kein `isPlaceholder`).
  2. Alle Bausteine mit „Kanzlei: ja“ (§6) mit aktiver Version `origin = lawyer`.
  3. `settings.business` vollständig (`legalName`, `street`, `postalCode`, `city`, `email`, `phone`, `taxNumber`) und
     ohne Platzhalter (`[`, `folgt`, `Muster`, `example`, PLZ `00000`); `settings.tattoo.studioDistrict` gesetzt.
  4. Vorkasse aktiv → `settings.payment.iban` (Prüfziffer gültig, nicht die Beispiel-IBAN
     `DE36000000000000000000`) und `settings.payment.accountHolder` gesetzt.
  5. `settings.business.lucidNumber` und Systembeteiligung (`settings.business.packagingScheme`: duales System,
     Vertragsbeginn) gesetzt (R-200).
  6. `settings.processorAgreements` für alle Dienste mit `avv: required` und `production: true` (DIENSTE.md YAML).
  7. 0 Datensätze mit `seed: true`; `SEED_PREVIEW_MODE` nicht `true`.
  8. `ADMIN_ROUTE` ≠ `/admin`.
  9. `PAYMENTS_DRIVER=stripe`, `EMAIL_DRIVER=smtp`, `STORAGE_DRIVER=s3`.
  10. Statistik-Entscheidung dokumentiert (`settings.analytics.enabled` mit `confirmedAt` oder bewusst aus).
  11. Harmonisierte Mitteilung ist die amtliche Grafik (kein Platzhalter, R-049).
  12. Steuerangaben von Jutta bestätigt (`settings.tax.confirmedAt`), Vorjahresumsatz eingetragen
      (`settings.revenueGuard.manualYearTotals`).
  13. `settings.shipping.enabledCountries` = nur DE (oder R-202-Bestätigungen vorhanden).
  14. `docs/recht/VVT.md` existiert.
  15. Kein öffentlich sichtbares Bild mit `showsPerson = jutta` ohne `media.ownerApproved` (R-181).
  Fehlende Einstellungsfelder (u. a. `lucidNumber`, `packagingScheme`, `processorAgreements`, `analytics.*`,
  `tax.confirmedAt`) legt die Phase, die sie zuerst braucht, per Migration an (spätestens P10).
- **Rechtsgrundlage:** Sammelprüfung der Anforderungen oben.
- **Abnahme:** `unit` – jede Prüfung einzeln mit Fixtures (grün/rot).
- **Phase:** P10 (bauen), P11 (bestehen) · **Owner:** ja

#### R-211 · Produktions-Rauchtest Recht
- **Anforderung:** Nach der DNS-Umstellung, am echten System: Seite im Instagram-In-App-Browser öffnen; Footer-Links;
  keine Cookies vor dem Warenkorb (Browser-Entwicklertools); echter Testkauf mit Karte, Bestellbestätigung mit
  PDFs prüfen, Widerruf über die Widerrufsfunktion, Eingangsbestätigung prüfen, Erstattung; Mail-Header SPF/DKIM/DMARC
  „pass“; Impressum-Link in der Instagram-Bio.
- **Rechtsgrundlage:** Sammelprüfung.
- **Abnahme:** `manuell` – Checkliste §7 Teil B mit Datum abgehakt.
- **Phase:** P11 · **Owner:** ja

---

## 5. Verbotene Inhalte und Muster (V-xx)

Gilt für Code (`src/**`), Inhalte und Seed (`content/**`), gerenderte Seiten, Mails, PDFs und Texte, die Claude für
Jutta entwirft. **Automatisch geprüft** durch `tests/unit/legal/forbidden.unit.spec.ts` (Quelltext/Inhalte, Muster
unten, Groß-/Kleinschreibung egal) und `tests/e2e/legal/forbidden.e2e.spec.ts` (gerenderter Text aller Seitentypen,
alle Mail-Vorlagen gerendert). Ausnahmen stehen in einer Allowlist-Datei mit Begründung je Eintrag
(z. B. der Zweig „Regelbesteuerung“ in `PriceNote`, das Wort „Godzilla“ in Tattoo-Portfolio-Daten).
Die Dateien unter `docs/` werden nicht gescannt.

| ID | Verbot | Grund | Prüfmuster / Prüfung |
|---|---|---|---|
| V-01 | Link oder Text zur EU-OS-Plattform | OS-Plattform seit 20.07.2025 abgeschaltet; irreführend, Abmahnrisiko (VO (EU) 2024/3228) | `ec\.europa\.eu/consumers/odr`, `Online-Streitbeilegung`, `OS-Plattform`, `\bODR\b` |
| V-02 | „inkl. MwSt.“ oder Steuerbeträge, solange Kleinunternehmer-Modus aktiv | § 19, § 14c UStG; § 5 UWG | gerendert: `inkl\.?\s*(MwSt\|USt\|Mehrwertsteuer\|Umsatzsteuer)`, `zzgl\.?\s*(MwSt\|USt)`, `\bMwSt\b`, `incl\.?\s*VAT`, `VAT included` |
| V-03 | Vorangekreuzte Checkboxen oder vorausgewählte Einwilligungen | Art. 4 Nr. 11, Art. 7 DSGVO; EuGH C-673/17 (Planet49); § 476 BGB | e2e: alle `input[type=checkbox]` initial `checked === false`; Quelltext: `defaultChecked` bzw. `checked={true}` an Checkboxen |
| V-04 | Externe Schriften und CDNs | Art. 44 ff. DSGVO; LG München I 3 O 17493/20; E-43, E-79 | `fonts\.googleapis\.com`, `fonts\.gstatic\.com`, `use\.typekit\.net`, `fonts\.bunny\.net`, `cdn\.jsdelivr\.net`, `unpkg\.com`, `cdnjs\.cloudflare\.com`, `next/font/google` |
| V-05 | Einbettungen/iframes Dritter (Instagram, YouTube, Vimeo, Karten, Spotify, SoundCloud) | § 25 TDDDG; EuGH C-40/17; E-43 | `<iframe` in `src/app/(frontend)`, `instagram\.com/(p\|reel)/.*/embed`, `instgrm`, `youtube(-nocookie)?\.com/embed`, `player\.vimeo`, `google\.[a-z.]+/maps`, `maps\.googleapis`, `tile\.openstreetmap`, `open\.spotify\.com/embed`, `w\.soundcloud` |
| V-06 | CAPTCHA-Dienste | § 25 TDDDG; Drittlandtransfer | `recaptcha`, `hcaptcha`, `challenges\.cloudflare\.com`, `turnstile`, `friendlycaptcha` |
| V-07 | Tracking/Analyse außer R-132 | § 25 TDDDG; E-43, E-96 | `googletagmanager`, `google-analytics`, `gtag\(`, `fbq\(`, `connect\.facebook\.net`, `analytics\.tiktok`, `hotjar`, `clarity\.ms`, `plausible`, `umami`, `matomo`, `mixpanel`, `posthog`, `segment\.(com\|io)`, `@vercel/speed-insights` |
| V-08 | Pauschaler Widerrufsausschluss („Handmade/Unikat = kein Widerruf“, „kein Umtausch“) | § 312g BGB (eng); häufiger Abmahngrund | `kein(e\|en)?\s+(Widerruf\|Umtausch\|Rückgabe\|Rücknahme)`, `vom\s+(Umtausch\|Widerruf)\s+ausgeschlossen`, `Rückgabe\s+ausgeschlossen`, `no\s+returns`, `final\s+sale` |
| V-09 | Werbung in Transaktionsmails | § 7 Abs. 2 Nr. 2 UWG; BGH VI ZR 134/15 | in gerenderten Mails: `instagram\.com`, `Folge\s+(mir\|uns)`, `Newsletter`, `Gutschein`, `Rabatt`, `neue\s+Stücke`, `Das\s+könnte\s+dir`, `utm_`, `<img` mit fremder Domain oder 1×1-Pixel |
| V-10 | Transportrisiko-Klauseln | § 475 Abs. 2 BGB | `auf\s+(Gefahr\|Risiko)\s+(des\|der)\s+(Käufer\|Kund)`, `keine\s+Haftung\s+für\s+(Transport\|Versand)schäden`, `Versand\s+auf\s+eigene\s+Gefahr` |
| V-11 | Rügefristen, die Rechte verkürzen | §§ 437, 476 BGB | `(innerhalb\|binnen)\s+(von\s+)?\d+\s+Tag(en)?.{0,60}(sonst\|andernfalls\|ausgeschlossen\|erlischt\|verfällt)`; Schadenshinweis nur mit „gesetzlichen Rechte bleiben unberührt“ |
| V-12 | „Unfreie Rücksendungen werden nicht angenommen“ | kann vom Widerruf abhalten (§ 355 BGB) | `unfrei(e)?\s+(Rück)?sendung.{0,40}(nicht\s+angenommen\|verweigert)` |
| V-13 | Unbelegte Produktaussagen: „lebensmittelecht“, „spülmaschinenfest“, „mikrowellengeeignet“, „geprüft“, „schadstofffrei“, „hypoallergen“, „nickelfrei“, „bleifrei“; GINETEX-Pflegesymbole | § 5 UWG; E-15, E-17; Markenrecht GINETEX | Validierung beim Veröffentlichen (R-044, R-045); erlaubt nur über die Bausteine mit Nachweis |
| V-14 | Allgemeine Umweltaussagen („nachhaltig“, „umweltfreundlich“, „klimaneutral“, „öko“, „grün“, „eco-friendly“, „sustainable“) [ergänzt] | UWG i. d. F. ab 27.09.2026 (Umsetzung RL (EU) 2024/825, Anhang Nr. 4a ff.) | `nachhaltig`, `umweltfreundlich`, `klimaneutral`, `CO2-neutral`, `\böko`, `eco-friendly`, `sustainable`; sachliche Angaben „Second-Hand“, „gebraucht“, „Vintage“ sind erlaubt (K-18) |
| V-15 | Gesundheits- und Heilversprechen (Aftercare, Produkte) | § 5 UWG | `heilt\s+garantiert`, `schmerzfrei`, `allergiefrei`, `hautfreundlich`, `medizinisch\s+geprüft` |
| V-16 | Fremde Figuren/Marken auf oder in Texten zu Verkaufsware | E-18; MarkenG, UrhG | Lint-Liste in Produkttexten: `Godzilla`, `Disney`, `Marvel`, `Pok[eé]mon`, `Hello\s*Kitty`, `Snoopy`, `Micky\|Mickey`, `Star\s*Wars`, `Harry\s*Potter`, `Simpsons`, `Barbie`, `Nike`, `Adidas`, `Puma`, `Carhartt`, `Levi'?s`, `Champion`, `New\s*Era` (Liste erweiterbar) |
| V-17 | Scheinverknappung, falsche Dringlichkeit, erfundene Bewertungen | UWG-Anhang Nr. 7, 23b, 23c; § 5 UWG | `nur\s+noch\s+heute`, `\d+\s+(Personen\|Leute)\s+(sehen\|schauen)`, `Bestseller`, `Kundenbewertung`, `★★★★★`; Countdown-Komponente nur in der Kasse (echte Reservierung) |
| V-18 | „Garantie“ für die gesetzliche Gewährleistung, freiwillige Garantieversprechen | § 479 BGB; § 5 UWG | `Garantie`, `garantiert` in Shop-Texten, Mails, FAQ (manuelle Sichtung der Treffer) |
| V-19 | Werbung mit Selbstverständlichkeiten (14 Tage Widerruf, 2 Jahre Gewährleistung, „sicher bezahlen“, „DSGVO-konform“, „rechtssicher“) als Vorteil | UWG-Anhang Nr. 10, Nr. 10a n. F. | `14\s*Tage\s*(Widerrufs\|Rückgabe)recht`, `2\s*Jahre\s*Gewährleistung`, `DSGVO-konform`, `rechtssicher`, `abmahnsicher` außerhalb von Rechtstexten/FAQ |
| V-20 | Streich-, Rabatt- und „statt“-Preise | § 11 PAngV; ENTSCHEIDUNGEN „Später“ | `<del`, `<s>`, `line-through` an Preisen, `\bstatt\b`, `\bUVP\b`, `\bSale\b`, `-\d+\s*%` |
| V-21 | Aufschläge für Zahlarten | § 270a, § 312a Abs. 4 BGB | `(PayPal\|Karten?)-?(Gebühr\|Aufschlag)`, `Zahlungsgebühr` |
| V-22 | Personenbezogene Daten in URLs | Art. 5 Abs. 1 lit. f DSGVO | Quelltext: `searchParams.get\(['"](email\|name\|phone\|address)`; e2e: URL nach Formularversand |
| V-23 | Zahlungsdaten von Kund:innen speichern (IBAN, Kartennummer) | Art. 5 Abs. 1 lit. c DSGVO; PCI DSS | Schema-Scan außerhalb `settings.payment` (Juttas eigene Bankverbindung): Felder `iban`, `cardNumber`, `creditCard`, `cvc` |
| V-24 | Tattoo-Anzahlung „nicht erstattbar“/„verfällt“ | §§ 648, 307 BGB (Kautionsregeln nur individuell) | `Anzahlung.{0,30}(nicht\s+erstatt\|verfällt\|einbehalten)`, `non-?refundable` |
| V-25 | Abfrage von Gesundheitsdaten auf der Website | Art. 9 DSGVO | Formularfelder/Labels mit `Allergi`, `Krankheit`, `Medikament`, `Schwanger`, `Hauterkrank` |
| V-26 | Behauptungen zu Barrierefreiheit oder Zertifikaten | § 5 UWG; R-190 | `barrierefrei(e\|er\|en)?\s+(Shop\|Website\|Seite)`, `WCAG-konform`, `BFSG-konform`, `zertifiziert` |
| V-27 | Links auf nicht geprüfte Fremdseiten, insbesondere `mystaelectric.com` (leitet auf Glücksspiel) | Haftung für Links, Jugendschutz | `mystaelectric`; externe Links nur aus Allowlist (Instagram, DHL-Tracking, EU-Infoseite, Schlichtungsstelle, Safer-Tattoo) |
| V-28 | Songtext oder Audio von „Planet Claire“ (The B-52's) | UrhG; GEMA | manuelle Sichtung; kein Audio-Element auf öffentlichen Seiten |
| V-29 | Selbst formulierte Rechtstexte ohne Platzhalter-Kennzeichnung | R-002 | manuelle Sichtung; `origin` ≠ `lawyer` → Banner |
| V-30 | Newsletter, Warteliste, Drops/Countdown, Kundenkonto, Gutscheine | ENTSCHEIDUNGEN „Später“ | `Newsletter`, `Warteliste`, `Benachrichtige\s+mich`, `Mein\s+Konto`, `Registrieren`, `Gutschein` im öffentlichen UI |
| V-31 | Private Adresse außerhalb der Pflichtorte (Impressum, GPSR-Block der Produktseiten, Rechtstexte, Anbieterkennung/Footer der Transaktionsmails (R-080), Rücksendeadresse in der Widerrufs-Eingangsbestätigung (R-093), Abholmail, Rechnungen/Gutschriften, Etiketten/Beileger) | E-50 (öffentlich nur Bezirk); Kanzleifrage K-39 | e2e: Straßenname aus `settings.business.street` erscheint nie auf Startseite, Shop-Übersicht, Archiv, Tattoo-Seiten, Kontakt, Über mich, Auftragsarbeiten, Bestellstatus (R-067) |

## 6. Rechtliche Textbausteine (`legal-snippets`)

Die Bausteine werden wie Rechtstexte versioniert (R-012; bis P6 als Konstanten in `src/lib/legal/snippets.ts`, ab P6
in der Collection `legal-snippets`; die Schlüssel dieser Tabelle sind die Konstante `LEGAL_SNIPPET_KEYS`). „Kanzlei:
ja“ = vor Go-live Kanzlei-Wortlaut nötig (R-210). Arbeitsfassungen sind **keine** geprüften Rechtstexte; sie laufen
mit `origin: 'draft'` bis zur Kanzlei-Lieferung. Neben den Tokens aus R-012 darf ein Baustein nur die
Kontext-Tokens verwenden, die in seiner Arbeitsfassung stehen (z. B. `{{itemTitle}}`, `{{objectNumber}}`,
`{{deviationText}}`, `{{metalMaterial}}`, `{{condition}}`, `{{amount}}`, `{{dueDate}}`, `{{accountHolder}}`,
`{{iban}}`, `{{orderNumber}}`); der Aufrufer liefert sie, fehlt einer, ist das ein Render-Fehler.
Feste UI-Texte (nicht editierbar, keine Bausteine): „Zahlungspflichtig bestellen“ / „Order with obligation to pay“;
„Vertrag widerrufen“ / „Withdraw from contract here“; „Widerruf bestätigen“ / „Confirm withdrawal“.

| Schlüssel | Verwendung | Kanzlei | Arbeitsfassung DE (bis zur Kanzlei-Lieferung) |
|---|---|---|---|
| `price.kleinunternehmerNote` | an jedem Preis (R-030) | ja | „Endpreis · gemäß § 19 UStG wird keine Umsatzsteuer berechnet“ |
| `price.shippingNote` | Übersicht, Produktseite | ja | „zzgl. Versandkosten“ (als Link) |
| `price.tattooNote` | Tattoo-Preise (R-034) | ja | „Gesamtpreis · gemäß § 19 UStG wird keine Umsatzsteuer berechnet“ |
| `delivery.timeShipping` | R-035 | ja | „Lieferzeit: {{deliveryTime}} (bei Vorkasse ab Zahlungseingang)“ |
| `delivery.timePickup` | R-035 | ja | „Abholbereit innerhalb von {{deliveryTime}} nach Zahlungseingang, Termin nach Absprache per E-Mail“ |
| `cart.paymentAndDeliveryInfo` | Warenkorb (R-036) | ja | „Wir liefern nur innerhalb Deutschlands. Abholung in Berlin nach Absprache. Zahlarten: Kredit-/Debitkarte, Apple Pay, Google Pay, PayPal, Vorkasse per Überweisung.“ |
| `checkout.legalNotice` | Übersicht (R-063) | ja | „Es gelten unsere AGB. Informationen zu deinem Widerrufsrecht findest du in der Widerrufsbelehrung, Hinweise zum Datenschutz in der Datenschutzerklärung.“ |
| `checkout.dhlEmailConsent` | Kasse (R-101) | ja | „Ich bin einverstanden, dass meine E-Mail-Adresse an DHL (DHL Paket GmbH bzw. Deutsche Post AG) übermittelt wird, damit DHL mich über die Zustellung informieren kann. Ich kann diese Einwilligung jederzeit per E-Mail an jutta@planetclairetattoos.com widerrufen.“ |
| `checkout.deviationAgreement` | Kasse (R-048) | ja | „Mir ist bekannt, dass {{itemTitle}} (Nr. {{objectNumber}}) folgende Abweichung aufweist: {{deviationText}}. Ich vereinbare diese Beschaffenheit ausdrücklich und gesondert.“ |
| `checkout.vorkasseInfo` | Kasse bei Vorkasse | ja | „Bei Vorkasse reservieren wir dein Stück {{vorkasseDays}} Tage. Geht die Zahlung bis dahin nicht ein, wird die Bestellung automatisch storniert.“ |
| `product.ceramicsDecorative` | Keramik (R-044) | ja | „Dekorationsobjekt – nicht für Lebensmittel geeignet.“ |
| `product.ceramicsFoodSafe` | Keramik (R-044) | ja | „Für den Kontakt mit Lebensmitteln geeignet – Konformitätserklärung ansehen.“ |
| `product.jewelrySmallParts` | Schmuck (R-045) | ja | „Achtung: Kein Spielzeug. Nicht für Kinder unter 3 Jahren geeignet – enthält verschluckbare Kleinteile.“ |
| `product.jewelryNickel` | Schmuck (R-045) | ja | „Metallteile: {{metalMaterial}}, nickelfrei (Lieferantennachweis liegt vor).“ |
| `product.textileSecondHand` | Textil (R-043) | ja | „Second-Hand/Vintage: gebrauchtes Stück, von Hand bemalt. Zustand: {{condition}}.“ |
| `product.textileLabelMissing` | Textil (R-043) | ja | „Das Originaletikett fehlt – Materialangabe nach bestem Wissen.“ |
| `product.noSpecialWarnings` | GPSR-Block (R-040) | nein | „Keine besonderen Warnhinweise.“ |
| `product.glassFrame` | Zeichnungen (R-046) | nein | „Rahmen mit Glas – zerbrechlich, vorsichtig auspacken.“ |
| `email.orderConfirmation.contractSentence` | Bestellbestätigung (R-081) | ja | – (Kanzlei, abhängig von K-01) |
| `email.vorkasse.paymentInstructions` | R-071 | ja | „Bitte überweise {{amount}} bis {{dueDate}} an {{accountHolder}}, IBAN {{iban}}, Verwendungszweck: {{orderNumber}}.“ |
| `email.vorkasse.reminder` | R-071 | ja | „Wir haben deine Zahlung für {{orderNumber}} noch nicht erhalten. Bitte überweise bis {{dueDate}}.“ |
| `email.vorkasse.cancellation` | R-071 | ja | – (Kanzlei, abhängig von K-02) |
| `email.shipping.damageNotice` | Versandmail (R-082) | ja | „Falls dein Paket beschädigt ankommt: Bitte melde dich möglichst schnell mit Fotos bei jutta@planetclairetattoos.com. Deine gesetzlichen Rechte bleiben davon unberührt.“ |
| `email.pickup.ready` | Abholmail (R-083) | nein | „Dein Stück ist bereit zur Abholung. Ort und Terminvorschläge: …“ |
| `withdrawal.intro` | Widerrufsfunktion | ja | „Hier kannst du deinen Vertrag widerrufen. Nach dem Absenden bekommst du sofort eine Eingangsbestätigung per E-Mail.“ |
| `withdrawal.receiptNotice` | R-093 | ja | „Diese E-Mail bestätigt den Eingang deiner Widerrufserklärung. Sie ist noch keine Prüfung, ob der Widerruf wirksam ist.“ |
| `withdrawal.returnInfo` | R-093 | ja | „Bitte sende die Ware an: {{name}}, {{street}}, {{postalCode}} {{city}}. Die unmittelbaren Kosten der Rücksendung trägst du.“ |
| `withdrawal.returnCostsNote` | Token `{{returnCostsNote}}` in Rechtstexten (R-012, R-095); zusätzlich in der Kassen-Übersicht unter `checkout.legalNotice` (KONZEPT §4.5) | ja | „Die unmittelbaren Kosten der Rücksendung der Waren trägst du.“ |
| `complaint.repairChoice` | R-111 | ja | – (Kanzlei) |
| `dispute.vsbg37` | R-112 | ja | „Zuständig ist die Universalschlichtungsstelle des Bundes, Zentrum für Schlichtung e. V., Straßburger Straße 8, 77694 Kehl am Rhein, www.universalschlichtungsstelle.de. Ich bin nicht bereit und nicht verpflichtet, an einem Streitbeilegungsverfahren teilzunehmen.“ |
| `inquiry.privacyNotice` | Auftragsarbeiten (R-160) | ja | „Deine Angaben und Bilder nutze ich nur, um deine Anfrage zu beantworten. Sie werden 6 Monate nach Eingang automatisch gelöscht. Mehr in der Datenschutzerklärung.“ |
| `inquiry.autoReply` | R-160 | ja | – (Kanzlei prüft; Inhalt laut R-160) |
| `commission.offer` | R-161 | ja | – (Kanzlei) |
| `translation.disclaimer` | EN-Rechtsseiten (R-015) | ja | „This English version is provided for convenience only. Only the German version is legally binding.“ |
| `privacyRequest.accessResponse` | R-150 | ja | – (Kanzlei, optional) |
| `privacyRequest.erasureResponse` | R-151 | ja | – (Kanzlei, optional) |

Englische Fassungen der Bausteine werden aus der Kanzlei-Lieferung übernommen; bis dahin übersetzt Claude die
Arbeitsfassung sinngemäß (`origin: 'draft'`).

## 7. Manuelle Abnahme-Checkliste

**Teil A – vor Abschluss von P10 (Cloud-Session hakt ab, Eintrag in `docs/FORTSCHRITT.md`):**
- [ ] R-049: Harmonisierte Mitteilung mit amtlicher Vorlage verglichen (oder Platzhalter in OFFENE-PUNKTE).
- [x] R-095: Platzhalter-Widerrufsbelehrung enthält Token `{{withdrawalUrl}}` und `{{phone}}`. (02.10.2026, P6.23; Grund-Seed `content/seed/data/base.json`, Prüfung `tests/unit/legal/render-tokens.unit.spec.ts`)
- [x] R-156: `docs/recht/VVT.md` vollständig. (02.10.2026, P6.21)
- [ ] R-157: Datenpannen-Abschnitt im RUNBOOK und Owner-Anleitung vorhanden.
- [x] R-161: Vorlage `commission.offer` als Platzhalter vorhanden. (02.10.2026, P7.14; Grund-Seed `src/lib/legal/snippetSeed.ts` mit Gliederung, Knopf „Angebots-Vorlage kopieren“ im Anfrage-Detail; Prüfung `tests/unit/legal/snippets.unit.spec.ts`)
- [x] R-190: Keine Barrierefreiheits-/Zertifikatsbehauptungen in Texten. (03.10.2026, P8.15; Scan `src/i18n`, `src/globals`, `content/seed/data`, Mail-Vorlagen ohne Treffer zu V-26)
- [x] V-18, V-28, V-29: manuelle Sichtung aller Seitentexte, FAQ, Aftercare, Mails. (03.10.2026, P8.15; „Garantie“ nur als EN-Fachbegriff „legal guarantee“ der EU-Mitteilung, kein Liedtext/Audio, Rechtstexte tragen das Platzhalter-Band aus P6)
- [x] Alle FAQ-/Tattoo-/Über-mich-Entwürfe (E-62) gegen §5 geprüft. (03.10.2026, P8.15; Verbotsmuster-Tests unit + E2E grün)

**Teil B – P11 mit Jutta (vor und nach DNS-Umstellung):**
- [ ] Kanzleitexte (alle Typen + Bausteine „Kanzlei: ja“) eingespielt, `origin: 'lawyer'` (R-002, R-012).
- [ ] Antworten auf die Kanzleifragen mit vorläufiger Regel (u. a. K-09, K-38, K-40, K-41) eingearbeitet (§0 Nr. 8).
- [ ] Stammdaten, Telefonnummer, Steuernummer, IBAN eingetragen (R-020, R-021, R-205).
- [ ] AVVs abgeschlossen und eingetragen (R-155, DIENSTE.md §6).
- [ ] LUCID-Nummer und Systembeteiligung eingetragen (R-200).
- [ ] Entscheidung zur öffentlichen Anschrift nach Kanzleifrage K-39 getroffen (E-40 gilt bis dahin).
- [ ] Statistik-Entscheidung nach K-30 getroffen (R-132).
- [ ] Beispieldaten entfernt (R-180); `pnpm check:golive` grün (R-210).
- [ ] Rauchtest R-211 vollständig; Instagram-Bio mit Impressum-Link (R-022).

## 8. Owner-Aufgaben (Übersicht für `docs/owner/AUFGABEN.md`)

| Wann | Aufgabe | R-ID |
|---|---|---|
| Während P1–P10 | Kanzlei mit dem KANZLEI-BRIEFING beauftragen (Angebot einholen) | R-002 |
| Während P1–P10 | Nickelfreie Ösen/Ketten mit Lieferantenerklärung, Glasur-Datenblätter für Schmuck | R-045 |
| Während P1–P10 | Optional: Glasuren im Labor prüfen lassen, Konformitätserklärungen | R-044 |
| Während P1–P10 | Einwilligungen für Tattoo-Fotos von Kund:innen einholen | R-172 |
| Während P1–P10 | Telefonnummer für Impressum/Widerrufsbelehrung festlegen | R-021 |
| Während P1–P10 | Steuerberatung: KU-Status, Vorjahresumsatz, Steuernummer, ggf. W-IdNr.; Aufbewahrungsfrist (K-33) | R-205, R-123 |
| Vor P11 | Deko-Keramik am Boden kennzeichnen; Etiketten/Hangtags für alle Stücke | R-203, R-044 |
| Vor P11 | Technische Unterlagen je Produktkategorie (Vorlage aus der Verwaltung) | R-203 |
| Vor P11 | LUCID-Registrierung **und** eigene Systembeteiligung (Kleinstlizenz) bei einem dualen System – vorlizenzierte Kartons reichen nicht (E-47) | R-200 |
| Nach Kanzlei-Antwort | Entscheiden, ob die Privatadresse im Impressum/GPSR bleibt (E-40) oder eine andere zulässige Anschrift genutzt wird (Kanzleifrage K-39) | R-020, R-040 |
| Optional | Markenrecherche „Planet Claire“ | R-204 |
| P11 | Kanzleitexte einspielen, AVVs abschließen, Stammdaten/IBAN eintragen, Statistik entscheiden | R-002, R-155, R-205, R-132 |
| P11 | Impressum-Link in die Instagram-Bio | R-022 |
| Laufend | Monatlich Tattoo-, Flohmarkt-, Auftragsarbeiten-Umsätze eintragen | R-125 |
| Jährlich | Verpackungsmengen aus dem Jahres-Export an LUCID und das duale System melden | R-200, R-201 |
| Laufend | Jährliche Rechtstext-Prüfung; Datenschutz-Anfragen fristgerecht beantworten | R-014, R-153 |
| Im Ernstfall | Datenpanne binnen 72 h melden | R-157 |

## 9. Quellen der Ergänzungen und Änderungsprotokoll

Ergänzungen [ergänzt] vom 26.09.2026 (über `docs/research/` hinaus):
- Telefonnummer in der Widerrufsbelehrung seit 28.05.2022 Pflicht:
  https://www.it-recht-kanzlei.de/widerrufsrecht-informationspflichten-2022.html,
  https://onlineunternehmer-info.de/aenderung-des-musters-der-widerrufsbelehrung-und-des-muster-widerrufsformulars-zum-28-05-2022/
- Harmonisierte Mitteilung Gewährleistung ab 27.09.2026 (RL (EU) 2024/825, DVO (EU) 2025/1960):
  https://www.internetrecht-rostock.de/harmonisierte-mitteilung-harmonisierte-kennzeichnung-gewaehrleistung-garantie,
  https://cms.law/de/deu/legal-updates/gewaehrleistung-und-garantien-was-haendler-ab-2026-beachten-muessen
- UWG-Änderungen ab 27.09.2026 (Umweltaussagen, Selbstverständlichkeiten):
  https://shopbetreiber-blog.de/ab-27.9.2026-die-umsetzung-der-empco-rl-im-uwg
- Universalschlichtungsstelle des Bundes: https://www.universalschlichtungsstelle.de/impressum
- EuGH C-394/23 (Mousse, Pflicht-Anrede) und C-249/21 (Button-Beschriftung): Stand Wissen, von der Kanzlei zu bestätigen.
- Stripe.js `pure`-Import und Betrugssignale: https://github.com/stripe/stripe-js,
  https://docs.stripe.com/disputes/prevention/advanced-fraud-detection

| Datum | Version | Änderung |
|---|---|---|
| 26.09.2026 | 1.0 | Erstfassung (P0) |
| 26.09.2026 | 1.1 | Angleichung an ARCHITEKTUR/KONZEPT/DATENMODELL: Routen laut KONZEPT §2.2 und Widerrufs-URL `/de/vertrag-widerrufen` (§2, R-010, R-090, R-095); R-130 als Schutzziele mit abschließender Speicherliste (ARCHITEKTUR §8.7), neue Kanzleifrage K-38; Vorkasse-Frist und Task-Slugs (R-014, R-071, R-093, R-154); Rate-Limits (R-091, R-134); Rechnungsablage `private/invoices/` ohne Versionierung (R-122) und `settings.retention.invoiceYears` (R-123); Beispiel-Nummern `PC-2026-900NN`/`BSP-RE`/`BSP-GS` (R-121, R-180); `APP_ENV` (R-181); Verpackung nach E-47 unbedingt LUCID plus eigene Lizenz, Mengen je Sendung und Jahres-Export (R-200, R-201, R-210); Collection-Slugs `privacy-requests`, `deletion-log`, `email-log`; K-xx = Kanzleifrage, KONZEPT-Annahmen = KA-xx (§0) |
| 26.09.2026 | 1.2 | Namen laut DATENMODELL (`legal-texts`/`legal-snippets` mit `origin`, `settings.business`/`tax`/`shipping`/`payment`, Produktfelder, `inquiries`, `tattoo-gallery`, Status `awaiting_prepayment`/`cancelled` + `cancelReason`, Mail-Schlüssel `EMAIL_TEMPLATES`); Kasse statt Bestellstatus vor der Zahlung (R-065); kanonische Token-Liste mit Zuordnung (R-012, neuer Baustein `withdrawal.returnCostsNote`); Statusseite ohne Rechnung mit Schutzgrund (R-067); Gastbestellung ohne Telefonfeld (R-061); vorläufige Regeln: Teilwiderruf mit Versand-Differenz (R-072, K-09), Packfoto als Rückfrage und Brief ohne Sendungsnummer (R-100, R-082, neue Kanzleifrage K-40), CSP-Rückfall (R-131, neue Kanzleifrage K-41); Browser-Fehler-Endpunkt standardmäßig aus (R-133); Reklamationsakte `complaints` (R-110, R-150, R-154); Umsatz-Wächter U0–U5 + U3a (R-125); Wartungsmodus (R-090); Anfrageformular 20–3000 Zeichen und Upload-Grenzen (R-160); Flash-Knöpfe (R-170); Angebote ohne gespeicherten Status (R-171); Kurz-URLs (§2, R-010); R-023 in P6 |
| 26.09.2026 | 1.3 | Platzhalter-Wortlaut und Band (R-002); Empfänger-Tabelle als Komponente, Token-Liste geschlossen (R-012, R-155); Status-Token zusätzlich versiegelt für spätere Mails (R-067); Widerrufs-Übergänge exakt laut DATENMODELL §6.11 (R-093, R-094); Mail-Zuordnung M12–M16 (R-084, R-152); Exporte nie mit Beispieldaten (R-124, R-180, R-201); `pc_cart` mit Preis beim Hinzufügen (R-130); CSP-Rückfall auch im Kontext `admin`, Kern je Kontext (R-131); `tattoo-gallery` ohne Versionen (R-154, R-172) |
