# Recherche: Zahlung, Versand und Betrieb

> Stand 26.09.2026. Automatisch erzeugt aus dem Recherche-Workflow (Websuche mit Quellen). Konfidenz je Befund: high/medium/low. Wo ein Faktencheck vorliegt, steht er am Ende und hat Vorrang. Entscheidungen der Inhaberin stehen in docs/ENTSCHEIDUNGEN.md und haben immer Vorrang vor Empfehlungen hier.

## Zusammenfassung

Empfehlung (Stand 26.09.2026) für einen Berliner Mikro-Shop mit 5–50 Bestellungen im Monat.

Zahlung online: nur Stripe. Die Integration läuft über die Checkout Sessions API mit ui_mode "elements", also ein eigenes Zahlungsformular auf der Shop-Seite mit einem eigenen Button „Zahlungspflichtig bestellen“ (Button-Lösung nach § 312j BGB). Angeboten werden Karte, Apple Pay und Google Pay (1,5 % + 0,25 €), PayPal über Stripe (0,2 % + 0,10 € zusätzlich zu den PayPal-Gebühren von 2,99 % + 0,39 €) und optional Klarna (2,99 % + 0,35 €). Zahlarten, die erst nach Tagen bestätigen (SEPA-Lastschrift, Banküberweisung), bleiben aus, weil jedes Stück ein Unikat ist. Giropay und Sofort gibt es nicht mehr. Wero steht bei Stripe noch im Preview-Status. Mollie und SumUp Online sind für diesen Fall teurer und bringen keinen Vorteil.

Vor-Ort-Verkauf (Flohmarkt): Tap to Pay über die Stripe-Dashboard-App (1,4 % + 0,20 €; girocard nur über Co-Badge-Karten) oder SumUp Tap to Pay (1,39 %). Den Lagerbestand hält der Shop selbst synchron: ein „Markt-Modus“ mit Marktkiste, ein Tippen auf „verkauft“ und ein QR-Bezahllink pro Stück.

Versand: standardmäßig DHL, nur nach Deutschland und in die EU. In Großbritannien müsste man sich schon ab dem ersten Paket für die UK-Umsatzsteuer registrieren. In die USA können Privatkunden seit August 2025 keine Handelsware mehr per DHL verschicken. Die Schweiz kommt später dazu.
- Keramik: DHL Paket 5 kg (7,69 € online), verpackt Karton-in-Karton mit mindestens 6 cm Polster rundum.
- Textil: nur in Papier- oder Kartonverpackung, sonst berechnet DHL für Plastiktüten den Sperrgut-Zuschlag von 28,99 €.
- Zeichnungen: Großbrief mit Einschreiben oder Paket 2 kg.
- Zum Start werden Etiketten per Hand in der DHL Online-Frankierung oder App erstellt (die mobile Paketmarke braucht keinen Drucker). Die DHL Parcel DE Shipping API v2 lohnt sich erst mit Geschäftskundenvertrag (ab etwa 200 Paketen im Jahr, Monatspauschale ab 7,95 €). Sendcloud, Shipcloud und Shippo lohnen sich nicht (Shippo hat DHL DE im Mai 2025 eingestellt).

Wichtige Rechtspunkte: Das Transportrisiko trägt bei Privatkunden die Verkäuferin (§ 475 Abs. 2 BGB). Seit 19.06.2026 ist ein Widerrufsbutton Pflicht (§ 356a BGB). Rechnungen erzeugt der Shop selbst als GoBD-konforme PDFs mit Nummernkreis und unveränderbarem Archiv. Eine Anbindung an Lexware Office oder sevDesk lohnt sich bei diesem Volumen nicht, weil die API erst im Tarif für 32,90 € bzw. 34,90 € im Monat enthalten ist. Stattdessen gibt es einen Monatsexport als CSV bzw. im DATEV-Format.

Newsletter und Drops über Brevo (EU-Hosting, Double-Opt-in). Rabattcodes über Stripe Promotion Codes. Gutscheine erst in einer späteren Phase und mindestens 3 Jahre gültig.

Offen und vor dem Bau zu klären: Kleinunternehmer-Status und die Frage, ob Barverkäufe im Admin eine TSE auslösen.

## Befunde

### Stripe-Gebühren und Auszahlung für deutsche Konten (Sept. 2026) `[high]`

Kosten nach offizieller Stripe-Preisseite:
- Karten: Standard-Karten aus dem EWR 1,5 % + 0,25 €; Premium- und Firmenkarten aus dem EWR 2,8 % + 0,25 €; UK-Karten 2,5 % + 0,25 €; internationale Karten 3,15 % + 0,25 €; bei Währungsumrechnung +2 %. Apple Pay und Google Pay kosten wie die Karte dahinter.
- Lokale Zahlarten: SEPA-Lastschrift 0,35 € (plus 15 € bei Anfechtung, 3,50 € bei Fehlschlag); Klarna 2,99 % + 0,35 €; PayPal über Stripe 0,2 % + 0,10 € zusätzlich zu den PayPal-Gebühren; EPS 1,6 % + 0,25 €; iDEAL/Wero 0,29 €; Bancontact 1,4 % + 0,25 €.
- Anfechtungen (Chargebacks): 20 € pro Fall, dazu 20 € Widerspruchsgebühr, die bei Erfolg erstattet wird.
- Auszahlung: Standard kostenlos, T+3; die erste Auszahlung kommt 7 Kalendertage nach der ersten Live-Zahlung; Mindestauszahlung 1 €. Keine Monatsgebühr.
- Bei Rückerstattungen behält Stripe die ursprünglichen Gebühren.

**Auswirkung:** Grundlage für Preiskalkulation und Wahl der Zahlarten. Beispiel für eine Bestellung über 45 €: Karte ca. 0,93 €, Klarna ca. 1,70 €, PayPal über Stripe ca. 1,93 € (PayPal direkt ca. 1,74 €).

Quellen:
- https://stripe.com/de/pricing
- https://stripe.com/de/pricing/local-payment-methods
- https://docs.stripe.com/payouts
- https://docs.stripe.com/refunds

### PayPal direkt, Mollie, SumUp Online im Vergleich `[high]`

- PayPal (Gebührenseite, Version vom 07.09.2026): PayPal Checkout 2,99 % + 0,39 €. Aufschlag EWR 0 %, UK +1,29 %, andere Märkte +1,99 %. Chargeback 16 €. Bei Erstattungen behält PayPal die Festgebühr.
- PayPal über Stripe: für deutsche Stripe-Konten verfügbar (Aktivierung im Dashboard, bestehendes PayPal-Konto verknüpfen oder neues anlegen). Das Geld kann im Stripe-Guthaben landen, Erstattungen sind bis 180 Tage möglich, Anfechtungen laufen im Stripe-Dashboard.
- Mollie: Karten aus dem EWR 1,80 % + 0,25 €; PayPal = PayPal-Gebühr + 0,10 €; Klarna 2,99 % + 0,35 €; SEPA-Lastschrift 0,35 €; keine Monatsgebühr.
- SumUp Online: pauschal 2,5 %.
Für diesen Shop sind Mollie und SumUp Online bei Karten teurer als Stripe und bringen keinen Zusatznutzen.

**Auswirkung:** Stripe als einziger Zahlungsanbieter online genügt. PayPal wird ohne eigene PayPal-Integration über Stripe angeboten; das kostet etwa 0,19 € mehr pro Bestellung, spart aber viel Entwicklungsaufwand.

Quellen:
- https://www.paypal.com/de/webapps/mpp/merchant-fees
- https://docs.stripe.com/payments/paypal
- https://docs.stripe.com/payments/paypal/activate
- https://www.mollie.com/de/pricing
- https://www.sumup.com/de-de/preise/

### Stripe Checkout: Varianten und technische Grenzen `[high]`

Die Checkout Sessions API kennt vier Darstellungsarten: hosted_page, embedded_page, form und elements.
- submit_type erlaubt nur pay, book, donate oder subscribe; die Beschriftung des Buttons ist also nicht frei wählbar.
- custom_text und custom_fields sind im Custom- bzw. Elements-Modus nicht erlaubt.
- shipping_options: maximal 5 Optionen.
- expires_at: 30 Minuten bis 24 Stunden.
- Wenn eine Session abläuft, sendet Stripe checkout.session.expired; das ist der Auslöser, um reservierte Ware freizugeben. Sessions lassen sich per API auch früher manuell beenden.
- Versandpreise sind nur als Festbeträge pro Bestellung möglich.

**Auswirkung:** Unikate müssen während des Bezahlvorgangs reserviert und danach wieder freigegeben werden; das muss der Shop selbst bauen. Die Versandkosten berechnet der Shop selbst und übergibt sie an Stripe.

Quellen:
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/payments/checkout
- https://docs.stripe.com/payments/checkout/managing-limited-inventory
- https://docs.stripe.com/api/checkout/sessions/expire

### Button-Lösung (§ 312j BGB) und Stripe-Checkout `[medium]`

§ 312j Abs. 3 BGB: Der Bestell-Button muss mit „zahlungspflichtig bestellen“ oder einer ebenso eindeutigen Formulierung beschriftet sein. Direkt vor der Bestellung müssen die Pflichtangaben nach Abs. 2 stehen: wesentliche Eigenschaften, Gesamtpreis, Versandkosten.
- LG Hildesheim (07.03.2023, 6 O 156/22) hielt „Mit PayPal bezahlen“ bzw. „Mit Kreditkarte bezahlen“ für unzureichend.
- Laut Sekundärquellen verlangt der EuGH (30.05.2024), dass der Button immer auf die Zahlungspflicht hinweist.
- Der Button der von Stripe gehosteten Seite ist nicht frei beschriftbar (siehe oben).
Ob der Stripe-Standardbutton reicht, ist rechtlich nicht geklärt.

**Auswirkung:** Deshalb die Variante Elements: eine eigene Bestellübersicht mit allen Pflichtangaben und eigenem Button „Zahlungspflichtig bestellen“, der die Zahlung auslöst. Auch Weiterleitungen zu PayPal oder Klarna funktionieren damit.

Quellen:
- https://www.gesetze-im-internet.de/bgb/__312j.html
- https://www.lhr-law.de/magazine-en/copyright-design-law/button-loesung-zahlungspflichtig/
- https://www.cr-online.de/blog/2025/02/14/die-button-loesung-im-online-handel-aktuelle-anforderungen-und-rechtliche-vorgaben/

### Zahlarten mit verzögerter Bestätigung sind für Unikate ungeeignet `[high]`

SEPA-Lastschrift bei Stripe:
- „verzögerte Benachrichtigung“: eine Zahlung gilt erst nach T+6 Geschäftstagen als erfolgreich;
- Kundinnen können bis 8 Wochen lang ohne Begründung zurückbuchen, das wird automatisch anerkannt;
- gegen eine SEPA-Anfechtung kann man keinen Widerspruch einlegen.
Klarna und PayPal bestätigen dagegen sofort (die Kundin bestätigt selbst). Klarna bietet deutschen Kundinnen unter anderem „Sofort bezahlen“, „Später bezahlen (30 Tage)“ und Ratenkauf; Stripe zahlt den vollen Betrag im Voraus aus, das Ausfallrisiko trägt Klarna.

**Auswirkung:** SEPA-Lastschrift und Banküberweisung deaktivieren. Ein Unikat darf erst als verkauft gelten, wenn die Zahlung bestätigt ist.

Quellen:
- https://docs.stripe.com/payments/sepa-debit
- https://docs.stripe.com/payments/klarna

### Abgekündigte und neue Zahlarten: giropay, Sofort, Wero `[medium]`

- giropay wurde am 31.12.2024 eingestellt.
- Sofort ist bei Stripe seit 31.03.2025 abgeschaltet; Nachfolger ist Klarna „Sofort bezahlen“.
- Wero ist seit November 2025 im deutschen Online-Handel gestartet (zunächst Sparkassen, Volks- und Raiffeisenbanken). Stripe führt Wero für deutsche Konten, die Seite zeigt aber noch den Preview-Status; Gebühren sind für DE nicht eindeutig veröffentlicht (iDEAL/Wero: 0,29 €).

**Auswirkung:** Keine Arbeit in giropay oder Sofort stecken. Wero später im Dashboard zuschalten, sobald es allgemein verfügbar ist; im Code nichts fest auf bestimmte Zahlarten verdrahten.

Quellen:
- https://support.stripe.com/questions/availability-of-giropay-june-2024-update
- https://docs.stripe.com/payments/sofort/replace
- https://stripe.com/de/payment-method/wero
- https://www.mobiflip.de/wero-startet-im-onlinehandel-wer-mitmacht-und-wie-der-kaeuferschutz-funktioniert/

### Kartenzahlung vor Ort (Flohmarkt): Stripe Tap to Pay vs. SumUp `[medium]`

Stripe Terminal in Deutschland:
- Karten aus dem EWR 1,4 % + 0,10 €; Tap to Pay kostet zusätzlich 0,10 € pro Autorisierung.
- Kartenleser: WisePad 3 59 €, S700 259 €.
- Ohne Code nutzbar über die Stripe-Dashboard-App (iPhone XS oder neuer; Android mit NFC).
- girocard nur mit WisePad 3 oder S700/S710, nicht per Tap to Pay. Co-Badge-Karten mit Visa oder Mastercard Debit laufen über diese Netze.
- Die Dashboard-App verknüpft Zahlungen nicht mit Produkten; den Bestand muss der Shop selbst führen.

SumUp:
- Tap to Pay 1,39 % ohne Grundgebühr; Tarif „Zahlungen Plus“ 19 €/Monat mit 0,79 %.
- Auszahlung am nächsten Tag bis 7 Uhr; PIN ab 50 €.
- girocard wird auf der Tap-to-Pay-Seite nicht genannt (nicht verifiziert).
- Laut Sekundärquelle ist der Air-Leser eingestellt und der Solo Lite (34 €) der Einstieg.

Beispiel für 25 €: Stripe ca. 0,55 €, SumUp ca. 0,35 €.

**Auswirkung:** Beide Wege funktionieren. Stripe bedeutet ein System und eine Buchhaltung, SumUp ist bei kleinen Beträgen günstiger. In jedem Fall braucht es eine Bestandsführung im Shop, unabhängig vom Zahlungsanbieter.

Quellen:
- https://stripe.com/de/pricing#terminal
- https://docs.stripe.com/no-code/in-person
- https://docs.stripe.com/terminal/payments/collect-card-payment/supported-card-brands
- https://www.sumup.com/de-de/tap-to-pay/
- https://www.sumup.com/de-de/preise/
- https://kartenkosten.de/blog/sumup-gebuehren

### DHL/Deutsche Post Privatkundenpreise national (für 2026 unverändert) `[high]`

Laut DHL-Preisliste (Stand 07/2025) und Broschüre „Leistungen und Preise“ (Stand 01.07.2026); für Privatkunden 2026 unverändert:
- Päckchen S 4,19 € (35×25×10 cm) und Päckchen M 5,19 € (60×30×15 cm): keine Haftung, Bedingungen wie Brief.
- Paket 2 kg 6,19 € (nur online; max. 60×30×15 cm), 5 kg 7,69 €, 10 kg 10,49 €, 20 kg 18,99 €, 31,5 kg 23,99 € (online); Haftung bis 500 €.
- Transportversicherung: bis 2.500 € für 6,99 €, bis 25.000 € für 19,99 €. Einlieferung nur in Filiale oder Paketshop gegen Beleg.
- Sperrgut +28,99 €. Als Sperrgut gilt auch jede Verpackung oder Versandtasche, die nicht aus Pappe oder Papier ist.
- Die mobile Paketmarke (QR-Code in der App) wird in der Filiale ausgedruckt; dafür braucht man keinen Drucker. Für Ziele außerhalb der EU nur mit Druck in Filiale oder Packstation, wegen der Zollpapiere.
- Briefe: Großbrief 1,80 €, Maxibrief 2,90 €. Einschreiben +2,65 € (Haftung max. 25 €), Einschreiben Einwurf +2,35 € (max. 20 €).

**Auswirkung:** Keramik mit Karton-in-Karton sprengt meist die 15 cm Höhe von Paket 2 kg, also Paket 5 kg einplanen. Textilien nie in Plastiktüten per DHL Paket verschicken, sonst fällt Sperrgut an. Päckchen nur für geringwertige, bruchsichere Ware.

Quellen:
- https://www.dhl.de/de/privatkunden/pakete-versenden/deutschlandweit-versenden/preise-national.html
- https://www.dhl.de/dam/jcr:c0eb1285-9a22-40b2-8c51-3f70c1a897be/dp-leistungen-und-preise-092026.pdf
- https://kartonplus.de/lexikon/dhl-portotabelle-2026

### DHL international (Privatkunden, online) und Zoll `[high]`

- EU (Zone 1): Päckchen M 10,49 €, Paket 2 kg 14,49 €, 5 kg 17,49 €, 10 kg 22,49 €. Keine Zollpapiere nötig.
- Schweiz und UK (Zone 2): Päckchen M 15,49 €, Paket 2 kg 19,49 €, 5 kg 26,99 €. Zollinhaltserklärung nötig; die Online-Frankierung führt durch das Formular.
- USA (Zone 5): Paket 5 kg 47,99 €. Seit 29.08.2025 gibt es keine US-Zollfreigrenze mehr für Handelsware. DHL verschickt Handelsware in die USA seit 25.09.2025 nur für Geschäftskunden über PDDP (2 € pro Sendung plus weiterberechnete Zölle); für Privatkunden-Versand gilt das nicht.
- Im internationalen Paketversand ist eine Transportversicherung bis 500 € enthalten.

**Auswirkung:** USA zum Start ausschließen. Die Schweiz ist technisch machbar, aber die Kundin zahlt Einfuhr-MWST und Verzollungsgebühren; das muss vorher im Shop stehen.

Quellen:
- https://www.dhl.de/de/privatkunden/pakete-versenden/weltweit-versenden/preise-international.html
- https://group.dhl.com/de/presse/pressemitteilungen/2025/dhl-paket-nimmt-postalischen-warenversand-aus-deutschland-in-die-usa-und-puerto-rico-fuer-geschaeftskunden-wieder-auf.html
- https://www.dhl.de/dam/jcr:c0eb1285-9a22-40b2-8c51-3f70c1a897be/dp-leistungen-und-preise-092026.pdf

### UK- und Schweiz-Steuerfallen beim Auslandsversand `[high]`

- UK: Wer aus dem Ausland Sendungen bis 135 £ direkt an Privatkunden verkauft, muss sich für die UK-Umsatzsteuer (VAT) registrieren und sie beim Verkauf berechnen. Für ausländische Verkäufer gibt es keine Umsatzschwelle.
- Schweiz: Steuerpflichtig wird ein ausländischer Versandhändler erst ab 100.000 CHF Jahresumsatz mit einfuhrsteuerbefreiten Kleinsendungen (Einfuhrsteuer höchstens 5 CHF). Darunter zahlt die Empfängerin die Einfuhrabgaben.

**Auswirkung:** UK nicht beliefern, sonst entsteht eine VAT-Registrierungspflicht. Die Schweiz nur mit deutlichem Hinweis „Einfuhrabgaben zahlt die Empfängerin“ anbieten.

Quellen:
- https://www.gov.uk/guidance/vat-and-overseas-goods-sold-directly-to-customers-in-the-uk
- https://www.estv.admin.ch/de/mwst-versandhandel-und-plattformbesteuerung
- https://www.haufe.de/finance/steuern-finanzen/umsatzsteuerregeln-in-der-schweiz-fuer-auslaendische-unternehmen/schweiz-lieferungen-aus-dem-ausland-und-kleinsendungen_190_504080.html

### Alternative Paketdienste (Hermes, GLS, DPD) `[medium]`

- Hermes (Preise ab 02.03.2026, Abgabe und Zustellung im PaketShop): Päckchen 3,99 € (Haftung nur 50 €), S 4,89 €, M 5,90 €, L 9,90 €; Haustürzustellung jeweils ca. 1 € mehr; S bis L haften bis 500 €. Die Größe richtet sich nach längster plus kürzester Seite, nicht nach dem Gewicht (bis 25 kg).
- GLS (Stand April 2026): XS 4,59 €, S 5,49 €, M 6,89 €, L 10,99 €; laut Sekundärquelle 750 € Standardhaftung.
- DPD: XS 5,15 €, S 5,45 €, M 6,95 € (Sekundärquelle).

**Auswirkung:** Hermes ist für schwere Keramik günstiger, weil nach Größe abgerechnet wird. DHL bleibt Standard wegen Vertrauen der Kundinnen, Packstationen und späterer API. Hermes kann als zweiter Paketdienst im Datenmodell vorgesehen, zum Start aber deaktiviert werden.

Quellen:
- https://www.myhermes.de/preise/paeckchen-paket/
- https://www.paketda.de/news-preiserhoehung-dpd-gls.html
- https://www.secursus.com/de-de/transport-komparator/gls-versicherung/

### DHL-Geschäftskunde, Kleinpaket und Parcel DE Shipping API v2 `[medium]`

- Geschäftskunde wird man ab etwa 200 Sendungen im Jahr; der Vertrag lässt sich online abschließen, das Geschäftskundenportal ist inklusive (Label per Eingabe oder CSV).
- Seit 01.07.2025 gibt es eine Monatspauschale von 7,95 bis 119,95 €, bei leicht gesenkten Paketpreisen (Beispiel 5 kg: 5,95 € netto). Laut Händlerbund lohnt sich das erst ab deutlich höheren Mengen.
- DHL Kleinpaket (bis 1 kg, Höhe bis 8 cm, Haftung 20 €, mit Sendungsverfolgung) gibt es nur für Geschäftskunden.
- Die API setzt voraus: Geschäftskundenvertrag, EKP-Nummer, Abrechnungsnummern und einen System-Benutzer im Geschäftskundenportal. Die Freigabe für den Live-Betrieb erfolgt manuell in 1–3 Werktagen. Unterstützt werden unter anderem A4 und Thermoformat 103×150 mm, internationale Zollerklärungen (CN23) und Retourenlabel im Inland.

**Auswirkung:** Zum Start keine DHL-API. Etiketten werden per Hand erstellt. Die API-Anbindung kommt erst mit Geschäftskundenvertrag in einer späteren Phase und wird schon jetzt über eine Schnittstelle im Code vorbereitet.

Quellen:
- https://www.dhl.de/de/geschaeftskunden/paket/kunde-werden.html
- https://ohn.haendlerbund.de/logistik/paketdienste/dhl-monatspauschale-geschaeftskunden
- https://www.dhl.de/de/geschaeftskunden/paket/leistungen-und-services/dhl-kleinpaket.html
- https://developer.dhl.com/api-reference/parcel-de-shipping-post-parcel-germany-v2

### Versandplattformen: Sendcloud, Shipcloud, Shippo `[medium]`

- Sendcloud: Der Free-Tarif (0 € Grundgebühr) erlaubt nur Sendcloud-eigene Versandpreise, laut Hilfe-Center bis 20 Pakete im Monat, bezahlt wird pro Etikett. Lite kostet seit 01.06.2026 für Neukunden 39 €/Monat, dazu steigende Gebühren pro Etikett. Eigene Paketdienst-Verträge nur in bezahlten Tarifen. Laut einem Händlerforum (2024) sind die Sendcloud-Preise für DHL höher als die DHL-Online-Preise für Privatkunden.
- Shipcloud: nur individuelle Angebote, zielt auf mehr als 2.000 Pakete im Monat.
- Shippo: Unterstützung für DHL DE endete am 31.05.2025.

**Auswirkung:** Für 5–50 Pakete im Monat keine Versandplattform einbinden.

Quellen:
- https://www.sendcloud.com/de/preise/
- https://www.sendcloud.com/pricing/
- https://onlinemarktplatz.de/269003/sendcloud/
- https://www.sellerforum.de/forum/thread/62809-g%C3%BCnstige-dhl-versandtarife-f%C3%BCr-geringe-paketvolumen/
- https://shipcloud.com/de/preise/
- https://support.goshippo.com/hc/en-us/articles/360000243843-How-to-Connect-a-DHL-Germany-Account-to-Ship-with-Shippo

### Transportrisiko und Haftung bei Bruch `[high]`

- § 475 Abs. 2 BGB: Beim Verkauf an Privatkunden geht das Transportrisiko nur dann auf die Käuferin über, wenn sie den Transporteur selbst beauftragt hat. Bruch zahlt also die Verkäuferin.
- DHL-AGB Paket National, Ziff. 3 Abs. 4: Die Absenderin muss nach § 411 HGB so verpacken, dass die Ware vor Beschädigung geschützt ist. Ziff. 6 Abs. 3: DHL haftet bis 500 €.
- § 427 Abs. 1 Nr. 2 HGB: Bei ungenügender Verpackung haftet der Frachtführer nicht.
- Die Transportversicherung deckt keine Schäden durch mangelhafte Verpackung.
- § 438 Abs. 2 HGB: Äußerlich nicht erkennbare Schäden müssen innerhalb von 7 Tagen nach Zustellung angezeigt werden.

**Auswirkung:** Eine einheitliche Verpackungsvorschrift, Fotos vom gepackten Paket und ein Bruchprozess mit 7-Tage-Frist sind Pflicht. Bruch als Kostenposition einkalkulieren.

Quellen:
- https://www.gesetze-im-internet.de/bgb/__475.html
- https://www.dhl.de/dam/jcr:b2845bef-cd08-4139-a4a1-0a9253d0bfd1/dhl-agb-paket-express-national-de-07-2025.pdf
- https://www.gesetze-im-internet.de/hgb/__427.html
- https://www.gesetze-im-internet.de/hgb/__438.html

### Verpackung handgemachter Keramik (Best Practice) `[high]`

Aus dem DHL-Express-Verpackungsleitfaden (gültig ab 2026):
- Karton-in-Karton-Prinzip für Zerbrechliches.
- Außenkarton in allen Maßen mindestens 14 cm größer als der Innenkarton.
- Mindestens 6 cm Füllmaterial zu allen Außenwänden und Ecken, auch am Boden.
- Für zerbrechliche oder schwere Ware zwei- oder dreiwellige Wellpappe.
- Verschlussband mindestens 48 mm breit.
- Aufkleber „Vorsicht! Zerbrechlich!“ als Zusatz; in der automatischen Paketsortierung ersetzt er keine Polsterung.
Allgemeine Praxis: Hohlräume der Schalen mit Papier füllen, jedes Teil einzeln einwickeln, Schütteltest (nichts darf sich bewegen).

**Auswirkung:** Zum Start drei Standard-Kartongrößen festlegen und Versandklassen danach kalkulieren: Verpackungsmaterial ca. 1,50–3,00 € pro Keramikpaket (Schätzung, nicht verifiziert).

Quellen:
- https://mydhl.express.dhl/content/dam/downloads/global/de/packing-with-care/dhl_express_packing_guide_de.pdf.coredownload.pdf
- https://www.eurosender.com/de/pack-ship/geschirr

### Widerruf, Widerrufsbutton, Bestätigungen (Pflichten für Online-Käufe) `[high]`

- § 356a BGB (seit 19.06.2026): Elektronische Widerrufsfunktion, beschriftet mit „Vertrag widerrufen“, gut sichtbar und während der ganzen Widerrufsfrist erreichbar. Die Kundin gibt Name, Vertragskennung (z. B. Bestellnummer) und E-Mail an und bestätigt dann mit „Widerruf bestätigen“. Danach muss sofort eine Eingangsbestätigung mit Datum und Uhrzeit auf einem dauerhaften Datenträger kommen. Ein Button nur im Kundenkonto oder hinter einem Login reicht laut Sekundärquellen nicht.
- § 357 BGB: Erstattung innerhalb von 14 Tagen über dasselbe Zahlungsmittel. Zurückhalten ist erlaubt, bis die Ware zurück ist oder die Kundin die Rücksendung nachweist. Rücksendekosten trägt die Kundin nur, wenn sie vorher darüber informiert wurde.
- § 312g Abs. 2 Nr. 1 BGB: Kein Widerrufsrecht für nicht vorgefertigte Ware nach Kundenwunsch, also Auftragsarbeiten. Vorgefertigte Unikate sind nicht ausgenommen.
- § 312i Abs. 1 Nr. 3 BGB: Den Eingang der Bestellung sofort elektronisch bestätigen.
- § 312f Abs. 2 BGB: Vertragsbestätigung mit den Pflichtinformationen spätestens bei Lieferung, auf einem dauerhaften Datenträger.

**Auswirkung:** Pflichtfunktionen im Shop: öffentliche Widerrufsseite mit Zwei-Schritt-Ablauf, automatische Eingangsbestätigung, Bestell- und Vertragsbestätigung per E-Mail mit AGB, Widerrufsbelehrung und Muster-Formular als PDF. Diese Pflichten gelten auch bei Online-Bestellung mit Abholung in Berlin.

Quellen:
- https://www.gesetze-im-internet.de/bgb/__356a.html
- https://www.noerr.com/de/insights/umsetzungsgesetz-zum-widerrufsbutton-veroeffentlicht
- https://www.gesetze-im-internet.de/bgb/__357.html
- https://www.gesetze-im-internet.de/bgb/__312g.html
- https://www.gesetze-im-internet.de/bgb/__312i.html
- https://www.gesetze-im-internet.de/bgb/__312f.html

### Rückerstattung und Anfechtungen in Stripe `[high]`

Rückerstattungen:
- voll oder teilweise, mehrfach möglich, per Dashboard oder Refunds API; nur auf das ursprüngliche Zahlungsmittel;
- die Kundin sieht die Gutschrift nach 5–10 Werktagen; wird kurz nach der Zahlung erstattet, wird die Zahlung stattdessen storniert;
- Stripe-Gebühren werden nicht erstattet;
- Ereignisse: refund.created, refund.failed, charge.refunded.

Karten-Anfechtungen (Chargebacks):
- Die Kundin kann meist bis 120 Tage nach Zahlung anfechten.
- Die Händlerin hat 7–21 Tage Zeit zu antworten.
- Solange die Anfechtung offen ist, ist keine Erstattung außerhalb des Verfahrens möglich.

Klarna und PayPal:
- eigene Anfechtungsverfahren, bis 180 Tage;
- Erstattung bis 180 Tage nach Zahlung.

**Auswirkung:** Im Admin einen Erstatten-Button für die volle Summe oder einzelne Positionen einbauen. Anfechtungs-Ereignisse im Admin deutlich melden. Sendungsverfolgung, Zustellnachweis und Rechnung speichern, damit Belege für Anfechtungen vorliegen.

Quellen:
- https://docs.stripe.com/refunds
- https://docs.stripe.com/disputes/how-disputes-work
- https://docs.stripe.com/payments/klarna

### Rechnungen, Kleinunternehmer, GoBD-Nummernkreis, Aufbewahrung `[medium]`

- Rechnungspflicht: § 14 Abs. 2 UStG schreibt Rechnungen gegenüber Privatkunden nicht allgemein vor (Pflicht nur bei Geschäftskunden, Grundstücksleistungen und juristischen Personen). Als Buchungsbeleg und Service-Leistung ist eine Rechnung trotzdem sinnvoll.
- Kleinunternehmer (§ 19 UStG seit 2025): Vorjahresumsatz höchstens 25.000 €, laufendes Jahr höchstens 100.000 €; die Umsätze sind steuerfrei. Rechnungsinhalt nach § 34a UStDV: Namen und Anschriften, Steuernummer, Datum, Menge und Art der Ware, Gesamtbetrag und Hinweis auf die Steuerbefreiung für Kleinunternehmer.
- Reguläre Rechnung nach § 14 Abs. 4 UStG: zusätzlich eine fortlaufende, einmalige Rechnungsnummer.
- Aufbewahrung (§ 147 Abs. 3 AO): Buchungsbelege 8 Jahre, Bücher 10 Jahre.
- Steuersätze bei Regelbesteuerung: Vollständig handgemalte Gemälde und Zeichnungen fallen unter Anlage 2 Nr. 53 (7 % über § 12 Abs. 2 Nr. 1 UStG). Keramik (sofern keine Bildhauerkunst) und Textilien vermutlich 19 %. Die Einordnung für Keramik ist nicht verifiziert.

**Auswirkung:** Rechnungs-PDFs baut der Shop selbst: Kleinunternehmer-Status als Einstellung, Steuerklasse pro Produkt, Nummernkreis ohne Lücken, Storno per Korrekturbeleg statt Löschen, unveränderbare Ablage mit Prüfsumme.

Quellen:
- https://www.gesetze-im-internet.de/ustg_1980/__14.html
- https://www.gesetze-im-internet.de/ustg_1980/__19.html
- https://www.gesetze-im-internet.de/ustdv_1980/__34a.html
- https://www.gesetze-im-internet.de/ao_1977/__147.html
- https://www.gesetze-im-internet.de/ustg_1980/anlage_2.html
- https://www.gesetze-im-internet.de/ustg_1980/__12.html

### Buchhaltungs-Tools: Lexware Office, sevDesk, DATEV `[medium]`

- Lexware Office (ehemals lexoffice): S 7,90 €, M 12,90 €, L 21,90 € (Buchhaltung, EÜR, Umsatzsteuer), XL 32,90 € netto pro Monat. Die Public API gibt es nur in XL. Die API erlaubt 2 Anfragen pro Sekunde und kann Rechnungen, Kontakte und Gutschriften anlegen.
- sevDesk: kostenlos (3 Rechnungen/Monat), Rechnung 11,90 €, Buchhaltung 25,90 €, Buchhaltung Pro 34,90 € pro Monat. Die REST-API gibt es nur in Pro.
- Für Stripe → Lexware Office und Stripe → DATEV gibt es Konnektoren von Drittanbietern (z. B. MiracleSync, finHero, DATEV-Export-App im Stripe App Marketplace). Stripe selbst exportiert kein DATEV-Format.
- Das DATEV-Format „Buchungsstapel“ ist eine CSV mit EXTF-Kopfzeile (Version 700) und öffentlich dokumentiert.

**Auswirkung:** Bei 5–50 Bestellungen im Monat rechnet sich eine API-Anbindung für 33–35 €/Monat nicht. Stattdessen Rechnungen aus dem Shop plus Monatsexport (CSV, optional DATEV-Format) für die Steuerberatung oder das Buchhaltungsprogramm.

Quellen:
- https://www.lexware.de/preise/
- https://developers.lexware.io/docs/
- https://sevdesk.de/preise/
- https://developer.datev.de/de/file-format/details/datev-format/format-description/booking-batch
- https://marketplace.stripe.com/apps/datev-export
- https://www.miraclesync.de/stripe-lexware/

### Barverkauf auf dem Markt und Kassenrecht (Risiko TSE) `[low]`

- § 146 Abs. 1 AO: Bei Barverkäufen an viele unbekannte Personen muss man nicht jeden Verkauf einzeln aufzeichnen. Diese Ausnahme entfällt aber, wenn man ein elektronisches Aufzeichnungssystem nach § 146a AO verwendet.
- § 1 KassenSichV: Erfasst sind „elektronische oder computergestützte Kassensysteme oder Registrierkassen“; Buchhaltungssoftware, Automaten usw. sind ausgenommen.
- Ob eine Admin-Funktion „bar verkauft, 35 €“ bereits als Kassensystem mit Pflicht zur TSE (technische Sicherheitseinrichtung) gilt, ist nicht verifiziert.

**Auswirkung:** Die Offline-Verkaufsfunktion zunächst nur als Bestandsänderung bauen: Status verkauft, Kanal Markt, Zahlungsart als Info, keine Kassenfunktionen wie Wechselgeld, Kassenbons oder Tagesabschluss. Barumsätze getrennt im Kassenbericht führen. Mit der Steuerberatung klären.

Quellen:
- https://www.gesetze-im-internet.de/ao_1977/__146.html
- https://www.gesetze-im-internet.de/kassensichv/__1.html
- https://www.lfst.bayern.de/steuerinfos/weitere-themen/elektronische-kassensysteme

### Drops, Rabatte, Gutscheine, Newsletter: Rechtsrahmen und Anbieter `[medium]`

- Rabatte: § 11 PAngV verlangt bei jeder angekündigten Preissenkung die Angabe des niedrigsten Preises der letzten 30 Tage. Individuelle Rabatte sind ausgenommen; öffentlich per Instagram beworbene Codes sind eine Grauzone.
- Gutscheine: Gekaufte Gutscheine verjähren nach 3 Jahren (§§ 195, 199 BGB). Eine Befristung auf 1 Jahr wurde vom OLG München als unwirksam angesehen; das gilt nicht für Gratis-Aktionsgutscheine.
- Werbe-E-Mails: § 7 Abs. 2 Nr. 2 UWG verlangt eine vorherige ausdrückliche Einwilligung (Double-Opt-in als Nachweis). § 7 Abs. 3 UWG erlaubt Werbung an Bestandskundinnen für ähnliche Waren nur mit Widerspruchshinweis bei der Erhebung der Adresse und bei jeder Mail.
- Anbieter:
  - Brevo: Free-Tarif 300 Mails pro Tag; Server in der EU (Frankreich und Deutschland); Double-Opt-in eingebaut.
  - MailerLite: Free-Tarif bis 250 Abonnentinnen und 2.500 Mails pro Monat, mit Branding; Rechenzentrum in der EU.
  - Buttondown: kostenlos bis 100 Abonnentinnen; Serverstandort nicht angegeben.

**Auswirkung:** Warteliste, „Benachrichtige mich“ und Newsletter laufen alle über ein gemeinsames Double-Opt-in-Verfahren mit Protokoll der Einwilligung. Rabattcodes nur gezielt einsetzen. Gutscheine mindestens 3 Jahre gültig machen.

Quellen:
- https://www.gesetze-im-internet.de/pangv_2022/__11.html
- https://www.gesetze-im-internet.de/uwg_2004/__7.html
- https://www.it-recht-kanzlei.de/gutscheine-verjaehrung-abmahnung.html
- https://help.brevo.com/hc/en-us/articles/360001005510-Data-storage-location
- https://www.mailerlite.com/pricing
- https://buttondown.com/pricing

## Empfehlungen

- **Zahlung online nur über Stripe: Checkout Sessions API mit ui_mode 'elements' (eigene Bestellübersicht mit allen Pflichtangaben nach § 312j und eigener Button 'Zahlungspflichtig bestellen'). Zahlarten werden im Stripe-Dashboard gesteuert: Karte, Apple Pay, Google Pay, PayPal (über Stripe) und Klarna an; SEPA-Lastschrift und Banküberweisung aus; EPS, Bancontact und iDEAL für EU-Kundinnen optional; Wero zuschalten, sobald es allgemein verfügbar ist. Die Beschreibung auf dem Kontoauszug wird auf 'PLANETCLAIRE' gesetzt.**  
  _BegrÃ¼ndung:_ Stripe ist für Karten der günstigste Anbieter (1,5 % + 0,25 €) und bündelt PayPal, Klarna, Tap to Pay, Webhooks, Erstattungen und Anfechtungen in einem System. Mit dem Elements-Modus bestimmt der Shop die Beschriftung des Bestellbuttons selbst, was die Rechtsunsicherheit beim gehosteten Button vermeidet. Zahlarten mit verzögerter Bestätigung passen nicht zu Unikaten.

- **Reservierung für Unikate: Beim Start des Bezahlvorgangs werden alle Artikel für 30 Minuten reserviert (Status reserved, mit Session-ID und Ablaufzeit), expires_at auf 30 Minuten. Freigabe über den Webhook checkout.session.expired, zusätzlich alle 5 Minuten per Cronjob; bricht die Kundin ab, wird die Session per API sofort beendet. Wird trotzdem ein bereits verkaufter Artikel bezahlt, erstattet der Shop automatisch, schickt eine Entschuldigungsmail mit Rabattcode und markiert den Fall im Admin.**  
  _BegrÃ¼ndung:_ Stripe verwaltet keinen Bestand. Bei Drops mit Unikaten sind doppelte Verkäufe sonst sehr wahrscheinlich.

- **Versand zum Start nur nach Deutschland und in die EU, dazu Abholung in Berlin. Großbritannien und USA gesperrt, Schweiz als Einstellung für später. Paketdienst ist DHL. Versandklassen pro Produkt (Werte sind Vorschläge und von Jutta festzulegen):
- BRIEF (Zeichnungen und Anhänger bis ca. 25 € Warenwert): Großbrief mit Einschreiben, ca. 4,50 €.
- PAKET_S (Textil, Caps, wertvolle Zeichnungen): DHL Paket 2 kg (6,19 €), Kundenpreis ca. 6,50 €.
- KERAMIK (Karton-in-Karton): DHL Paket 5 kg (7,69 €) plus Verpackung, Kundenpreis ca. 8,90 € in DE bzw. ca. 19,90 € in die EU.
- ABHOLUNG: 0 €.
Hat ein Warenkorb mehrere Versandklassen, gilt die höchste. Optional versandkostenfrei ab einem Mindestbestellwert.**  
  _BegrÃ¼ndung:_ Damit gibt es keine UK-VAT-Registrierung und kein Zollproblem mit den USA. DHL ist den Kundinnen vertraut, haftet bis 500 € und hat ein späteres Upgrade auf die API. Feste Versandklassen passen zu Stripes Grenze von Festbeträgen und höchstens 5 Versandoptionen.

- **Etiketten in Phase 1 per Hand: Im Admin gibt es pro Bestellung einen Button 'Adresse kopieren' (formatiert für die DHL Online-Frankierung), die Etiketten entstehen in der Post & DHL App als mobile Paketmarke (ohne Drucker) oder als A4-PDF. Danach wird die Sendungsnummer im Admin eingefügt oder mit der Handykamera gescannt; das löst die Versandmail aus. Phase 2 kommt ab etwa 200 Paketen im Jahr oder mehr als 25 im Monat: DHL-Geschäftskundenvertrag, Anbindung der Parcel DE Shipping API v2 hinter einer Schnittstelle für Paketdienste, Label-PDF im Format 103×150 mm und Thermodrucker. Keine Versandplattform (Sendcloud, Shipcloud, Shippo).**  
  _BegrÃ¼ndung:_ Geschäftskunden-Preise und API gibt es erst mit Vertrag (Monatspauschale ab 7,95 €, etwa 200 Pakete im Jahr). Versandplattformen kosten bei diesem Volumen extra und sind bei DHL teurer oder unterstützen DHL DE nicht mehr.

- **Verpackungsvorschrift als Checkliste im Admin (wird beim Packen angezeigt):
1. Keramik: Hohlräume mit Papier füllen, jedes Teil einzeln in Wabenpapier oder Luftpolster einwickeln, Innenkarton, dann Außenkarton aus zweiwelliger Pappe mit mindestens 6 cm Polster rundum. Schütteltest, H-Verklebung mit 48-mm-Band.
2. Textil: Papier- oder Kartonversandtasche, niemals Plastik (Sperrgut).
3. Zeichnungen: zwischen zwei festen Kartonplatten, Pergamin-Hülle, Aufschrift 'Bitte nicht knicken'.
4. Vor dem Verschließen zwei Fotos (offen und zu) aufnehmen und an die Bestellung hängen.
Bei Warenwert über 500 € die DHL-Transportversicherung (6,99 €) buchen und in der Filiale gegen Beleg abgeben.**  
  _BegrÃ¼ndung:_ Das Bruchrisiko trägt bei Privatkunden die Verkäuferin (§ 475 BGB). DHL haftet nicht bei ungenügender Verpackung (§ 427 HGB, AGB). Die Fotos dienen als Beleg bei Schadensmeldungen und Anfechtungen.

- **Tagesablauf für eine Person (Soll-Prozess):
1. Bei Zahlungseingang (Webhook) wird die Bestellung angelegt, der Artikel als verkauft markiert, die Rechnung erzeugt und die Bestellbestätigung verschickt (mit AGB, Widerrufsbelehrung und Muster-Formular als PDF).
2. Jutta erhält eine Push-Nachricht oder E-Mail.
3. Täglich (oder an 2–3 festen Versandtagen) öffnet sie im Admin 'Zu packen' und druckt den Packzettel: Foto des Artikels, Objektnummer, Lagerort, Pflegehinweis, Platz für eine handschriftliche Karte.
4. Packen nach Checkliste, Fotos, Etikett erstellen, Sendungsnummer eintragen; dann gilt der Status 'versendet' und die Versandmail geht raus (Sendungsverfolgung plus Hinweis 'Schaden bitte innerhalb von 7 Tagen mit Fotos melden').
5. Bei Abholung: Status 'bereit zur Abholung' und Mail mit Ort und Zeiten; bei Übergabe 'abgeholt'.
6. Eingehender Widerruf: Automatische Eingangsbestätigung mit Datum und Uhrzeit, Aufgabe im Admin, Rücksendung abwarten, Ware prüfen, im Admin erstatten (Stripe-API, inklusive Standard-Hinversandkosten), Gutschrift bzw. Stornorechnung erzeugen, Artikel wieder freigeben oder als 'beschädigt' markieren. Alles innerhalb von 14 Tagen ab Widerruf.
7. Bruch gemeldet: Fotos anfordern, bei DHL innerhalb von 7 Tagen reklamieren, der Kundin Ersatz oder Erstattung anbieten.
8. Anfechtung (Chargeback): Warnung im Admin, Belege (Sendungsverfolgung, Rechnung, Fotos, Nachrichten) im Stripe-Dashboard einreichen.
9. Monatlich: Export von Rechnungen und Auszahlungen (CSV bzw. DATEV-Format) und Stripe-Gebührenbelege an die Steuerberatung.**  
  _BegrÃ¼ndung:_ Erfüllt die Pflichten aus §§ 312f, 312i, 356a und 357 BGB und § 438 HGB und bleibt für eine Person in 15–30 Minuten am Tag machbar.

- **Widerruf: öffentliche Seite /widerruf (auch ohne Login erreichbar), in der Fußzeile und in jeder Bestellmail verlinkt, mit einem Button 'Vertrag widerrufen'. Ablauf in zwei Schritten: Name, Bestellnummer und E-Mail eingeben, dann 'Widerruf bestätigen'. Danach geht sofort eine Mail mit Inhalt, Datum und Uhrzeit des Eingangs raus. Rücksendekosten trägt die Kundin (in der Widerrufsbelehrung angekündigt); Kulanz entscheidet Jutta im Einzelfall. Auftragsarbeiten werden im Produkt als 'custom' gekennzeichnet und vom Widerruf ausgenommen.**  
  _BegrÃ¼ndung:_ Seit 19.06.2026 schreibt § 356a BGB diesen Ablauf vor. Fehlt er, drohen Abmahnungen und eine Verlängerung der Widerrufsfrist.

- **Rechnungen erstellt der Shop selbst als PDF. Einstellung isKleinunternehmer:
- true: Hinweis auf die Steuerbefreiung nach § 19 UStG, keine Umsatzsteuer.
- false: Steuerklasse pro Produkt (7 % für handgefertigte Zeichnungen und Gemälde, 19 % für Keramik und Textil; mit der Steuerberatung bestätigen).
Nummernkreis RE-JJJJ-NNNNN (lückenlos, in einer Datenbank-Transaktion vergeben), Gutschriften bzw. Stornos als GS-JJJJ-NNNNN. Einmal erzeugte PDFs sind unveränderbar (Prüfsumme SHA-256, Änderungsprotokoll, Aufbewahrung mindestens 10 Jahre). Monatsexport als CSV plus optional DATEV-Format (EXTF, Buchungsstapel). Keine API-Anbindung an Lexware Office oder sevDesk zum Start.**  
  _BegrÃ¼ndung:_ Bei 5–50 Bestellungen kostet eine API-Anbindung 33–35 €/Monat plus Entwicklungsaufwand. Eigene Rechnungen reichen für Buchungsbelege, die Aufbewahrung nach GoBD und den Export an die Steuerberatung.

- **Vor-Ort-Verkauf: Standard ist Tap to Pay über die Stripe-Dashboard-App (ein System, eine Auszahlung); falls Jutta SumUp schon nutzt, bleibt SumUp. Im Admin (mobile Web-App, die auch offline arbeitet) gibt es einen Markt-Modus:
1. Vor dem Markt die Stücke für die 'Marktkiste' auswählen; sie stehen dann online als 'heute auf dem Flohmarkt' und sind nicht kaufbar. Das verhindert Doppelverkäufe auch ohne Netz.
2. Jedes Stück bekommt einen Aufkleber mit QR-Code und Objektnummer; Scan oder Suche, dann Ein-Tipp-Knopf 'verkauft (bar / Karte extern)'.
3. Alternativ 'QR-Bezahllink' für PayPal oder Apple Pay: Das Handy der Kundin öffnet eine Checkout Session; der Webhook markiert das Stück automatisch als verkauft.
4. Nach dem Markt geben 'Marktkiste zurück' alle unverkauften Stücke wieder frei.**  
  _BegrÃ¼ndung:_ Unikate sind nur einmal da. Die Marktkiste löst das Sync-Problem bei schlechtem Netz ohne komplexe Konfliktlogik. Kassenfunktionen (Bons, Tagesabschluss) bewusst weglassen, bis die TSE-Frage geklärt ist.

- **Verkaufsmechanik in Phasen:
- Phase 1: Drops mit geplanter Veröffentlichung (publishAt), Countdown und optionalem Vorab-Zugang für Newsletter-Abonnentinnen über einen geheimen Link; Warteliste 'Benachrichtige mich beim nächsten Drop' pro Kategorie; Rabattcodes über Stripe Promotion Codes; Direktkauf-Link für Instagram-DMs (Checkout Session für ein Stück, 24 Stunden reserviert).
- Phase 2: Gutscheine (eigene Guthaben-Verwaltung, mindestens 3 Jahre gültig, Einlösung als einmaliger Stripe-Coupon).
- Newsletter und Warteliste über Brevo (Server in der EU, Double-Opt-in, Free-Tarif mit 300 Mails pro Tag), Einwilligungen mit Zeitstempel, IP und Text protokolliert.**  
  _BegrÃ¼ndung:_ Drops passen zu Instagram-Kunst. Double-Opt-in dient als Einwilligungsnachweis nach UWG und DSGVO. Gutscheine sind aufwendig und rechtlich heikel (Gültigkeit, Umsatzsteuer bei Mehrzweckgutscheinen) und kommen deshalb später.

- **Stripe-Konto vor der Entwicklung live-fähig machen: Einzelunternehmen verifizieren (Ausweis, IBAN, Steuernummer), PayPal über Stripe verbinden, Klarna aktivieren, Beschreibung auf dem Kontoauszug festlegen, E-Mail-Benachrichtigungen bei Rückerstattungen aktivieren. Bis zum Go-live nur im Testmodus mit der Stripe CLI arbeiten.**  
  _BegrÃ¼ndung:_ Die erste Auszahlung kommt 7 Tage nach der ersten Live-Zahlung, und PayPal kann eine zusätzliche Prüfung verlangen (Status 'ausstehend'). Frühe Einrichtung vermeidet Verzögerungen zum Launch.

## Umsetzungsanforderungen

- Stripe: Checkout Sessions API mit ui_mode='elements' (Payment Element und Address Element auf eigener Seite /kasse). Eigener Button mit dem Text 'Zahlungspflichtig bestellen' direkt unter der Übersicht mit Artikeln (Bild, Titel, Objektnummer, Kurzbeschreibung), Zwischensumme, Versand, Gesamtpreis und dem Hinweis auf § 19 UStG bzw. 'inkl. MwSt.'. Zahlarten dynamisch über das Dashboard (payment_method_configuration), nicht fest im Code.
- Stripe-Webhooks mit Signaturprüfung und idempotenter Verarbeitung (Event-ID speichern): checkout.session.completed, checkout.session.expired, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, charge.refunded, refund.created, refund.failed, charge.dispute.created, charge.dispute.closed. Bestand und Bestellung werden nur aus Webhooks geändert, nie über die Weiterleitungs-URL nach der Zahlung.
- Reservierung: Tabelle reservation(productId, checkoutSessionId, expiresAt). Anlegen in einer Transaktion mit Zeilensperre beim Erzeugen der Checkout Session; expires_at = jetzt + 30 min. Freigabe über checkout.session.expired und einen Cronjob alle 5 Minuten; bei Abbruch Stripe-Expire-Endpunkt aufrufen. Wird ein schon verkauftes Stück bezahlt: automatische Erstattung und Markierung im Admin.
- Datenmodell Produkt: itemNumber (eindeutig, z. B. K-0042 / T- / Z- / S- je Kategorie), status (draft, scheduled, available, reserved, at_market, sold, archived, damaged), priceCents, taxClass (reduced_7, standard_19), shippingClass (BRIEF, PAKET_S, KERAMIK, ABHOLUNG_ONLY), weightGrams, dimensions, storageLocation, publishAt, soldAt, soldChannel (online, markt, dm_link, abholung), isCustomCommission (schließt Widerruf aus). Varianten mit Bestandszahl für Mehrfachartikel (z. B. T-Shirt-Größen).
- Datenmodell Bestellung: orderNumber (z. B. PC-2026-00017), status (pending_payment, paid, packing, shipped, ready_for_pickup, picked_up, delivered, withdrawal_received, return_received, refunded_partial, refunded, cancelled, disputed), E-Mail, Name, Lieferadresse, shippingZone (DE, EU, CH später, PICKUP), shippingClass, shippingCents, carrier (DHL, DEUTSCHE_POST, HERMES), trackingNumber, packingPhotos[], stripeCheckoutSessionId, paymentIntentId, paymentMethodType, invoiceId, Notizen. Änderungsprotokoll für jeden Statuswechsel.
- Versandlogik: Versandzone und -klasse werden serverseitig berechnet (höchste Klasse im Warenkorb). Stripe erhält genau eine passende Versandoption als Festbetrag und shipping_address_collection.allowed_countries = Länder der gewählten Zone. GB und US sind nicht zugelassen, CH per Einstellung abschaltbar. Bei Abholung wird keine Lieferadresse abgefragt.
- Paketdienste über eine Schnittstelle im Code: createLabel, trackingUrl, cancel. Phase 1: ManualCarrier (Adresse kopieren, Sendungsnummer eingeben oder per Kamera scannen, Link zur Sendungsverfolgung pro Paketdienst konfigurierbar). Phase 2: DhlParcelDeV2Carrier (EKP, Abrechnungsnummer, System-Benutzer als Umgebungsvariablen/Secrets; Label im Format 103×150 bzw. A4; im Live-Betrieb erst nach DHL-Freigabe).
- Admin (mobil zuerst, installierbar als Web-App): Ansichten 'Zu packen', 'Versendet', 'Abholung', 'Widerrufe/Retouren', 'Anfechtungen'. Pro Bestellung: Packzettel-PDF (Artikelfoto, Objektnummer, Lagerort, Pflegehinweis), Verpackungs-Checkliste je Versandklasse, Upload der Packfotos, Knöpfe für Sendungsnummer, Erstatten (voll oder einzelne Positionen über die Stripe Refunds API) und Stornorechnung.
- Markt-Modus im Admin: Marktkiste zusammenstellen (Status at_market, online sichtbar als 'heute auf dem Flohmarkt', nicht kaufbar) und nach dem Markt wieder freigeben. QR-Aufkleber pro Stück erzeugen (Objektnummer und Admin-Link). Ein-Tipp-Knopf 'verkauft' mit Kanal und Zahlungsart als Information. QR-Bezahllink (Checkout Session für ein Stück). Warteschlange für Aktionen ohne Netz, die später synchronisiert wird. Keine Kassenfunktionen (kein Bon, kein Tagesabschluss), bis die TSE-Frage geklärt ist.
- Widerruf nach § 356a BGB: öffentliche Route /widerruf ohne Login, Link 'Vertrag widerrufen' in Fußzeile, Bestellbestätigung und Bestellstatus-Seite. Zwei Schritte: Name, Bestellnummer und E-Mail eingeben, dann Button 'Widerruf bestätigen'. Danach sofort eine E-Mail mit dem Inhalt der Erklärung sowie Datum und Uhrzeit des Eingangs (Zeitzone Europe/Berlin) und ein Eintrag in der Tabelle withdrawal(receivedAt, orderId, confirmationSentAt). Frist-Hinweis im Admin: erstatten innerhalb von 14 Tagen.
- Transaktions-E-Mails (deutsch, im Design des Shops): Bestelleingang sofort (§ 312i), Bestell- und Vertragsbestätigung mit AGB, Widerrufsbelehrung und Muster-Widerrufsformular als PDF-Anhang (§ 312f), Rechnung als PDF, Versandmail mit Sendungsverfolgung und Hinweis 'Schäden bitte innerhalb von 7 Tagen mit Fotos melden', Abholbereitschaft, Eingangsbestätigung Widerruf, Erstattungsbestätigung, Double-Opt-in-Mails. Absender auf der eigenen Domain mit SPF, DKIM und DMARC.
- Rechnungen: Einstellung isKleinunternehmer (true: Pflichtangaben nach § 34a UStDV mit Hinweis auf § 19 UStG; false: Steuersätze je taxClass, Pflichtangaben nach § 14 Abs. 4 UStG). Lückenloser Nummernkreis RE-JJJJ-NNNNN, Gutschriften GS-JJJJ-NNNNN, beide über Datenbank-Sequenz bzw. Transaktion. PDF nach Erzeugung unveränderbar (Prüfsumme SHA-256 speichern, Ablage im Objektspeicher mit Versionierung), keine Löschfunktion, Aufbewahrung mindestens 10 Jahre.
- Monatsexport im Admin: CSV mit Rechnungen, Gutschriften, Zahlart, Stripe-Zahlungs-ID und Gebühren (aus den Stripe Balance Transactions) sowie Auszahlungen. Optional DATEV-Buchungsstapel (EXTF, Version 700) mit einstellbarem Kontenrahmen (SKR03/SKR04), Konten vorerst als Einstellung.
- Newsletter und Warteliste: Anbindung an Brevo per API (Kontakte, Listen, Double-Opt-in-Vorlage). Eigene Tabelle consent_log (E-Mail, Zweck, Einwilligungstext, Zeitstempel, IP-Hash, Opt-in-Zeitpunkt, Abmeldung). Abmeldelink in jeder Mail. Hinweis nach § 7 Abs. 3 UWG an der Kasse, wenn Bestandskundinnen-Werbung genutzt wird.
- Drops: Produktfeld publishAt, geplante Veröffentlichung (Cron bzw. Prüfung bei jedem Seitenaufruf), Countdown-Komponente, optionaler Vorab-Zugang per geheimem Link mit Ablaufdatum. Rabattcodes über Stripe Coupons und Promotion Codes (allow_promotion_codes bzw. discounts in der Session). Bei angekündigter Preissenkung wird der niedrigste Preis der letzten 30 Tage aus der Preishistorie angezeigt (§ 11 PAngV).
- Preisanzeige im Shop: Hinweis 'zzgl. Versand' mit Link zur Versandkostenseite, Lieferzeit pro Versandklasse, Hinweistext zu Unikaten, bei Regelbesteuerung 'inkl. MwSt.', bei Kleinunternehmerin Hinweis auf § 19 UStG.
- Tests: Stripe-Testmodus und Stripe CLI (stripe listen, stripe trigger) für alle Webhook-Pfade. Szenarien: zwei parallele Käufe desselben Unikats, abgelaufene Session, Erstattung voll und teilweise, Anfechtung, PayPal- und Klarna-Weiterleitung, Widerruf mit Zeitstempel, lückenlose Rechnungsnummern bei parallelen Bestellungen.
- Geheimnisse und Konfiguration nur über Umgebungsvariablen: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY, BREVO_API_KEY, SMTP-Zugangsdaten, später DHL_API_KEY, DHL_GKP_USER, DHL_GKP_PASSWORD, DHL_EKP, DHL_BILLING_NUMBERS. Nichts davon ins Repository; eine .env.example mit Platzhaltern anlegen.

## Offene Fragen aus der Recherche (inzwischen im Interview beantwortet, siehe docs/ENTSCHEIDUNGEN.md)

- Bist du umsatzsteuerlich Kleinunternehmerin nach § 19 UStG (Vorjahr höchstens 25.000 €, dieses Jahr höchstens 100.000 € Gesamtumsatz inklusive Tattoos)? _(Optionen: Ja, Kleinunternehmerin / Nein, regelbesteuert (Umsatzsteuer wird ausgewiesen) / Weiß ich nicht, kläre ich mit der Steuerberatung; Empfehlung: Im Code als Einstellung bauen; Standard 'Ja', mit der Steuerberatung bestätigen)_
- Hast du schon ein Stripe-Konto und ein PayPal-Geschäftskonto? _(Optionen: Beides vorhanden / Nur PayPal / Keins von beiden, lege ich an; Empfehlung: Stripe-Konto jetzt anlegen, PayPal in Stripe verknüpfen)_
- Welche Zahlarten sollen online angeboten werden? _(Optionen: Karte + Apple/Google Pay + PayPal + Klarna / Karte + Apple/Google Pay + PayPal (ohne Klarna) / Zusätzlich SEPA-Lastschrift; Empfehlung: Karte + Apple/Google Pay + PayPal + Klarna, ohne SEPA-Lastschrift)_
- Wohin wird verschickt? _(Optionen: Nur Deutschland / Deutschland + EU / Deutschland + EU + Schweiz / Weltweit; Empfehlung: Deutschland + EU (Schweiz später per Einstellung))_
- Wie sollen Versandkosten berechnet werden, und bist du mit den Vorschlagspreisen einverstanden (Brief ca. 4,50 €, Paket klein ca. 6,50 €, Keramik DE ca. 8,90 € und EU ca. 19,90 €)? _(Optionen: Pauschale pro Versandklasse (Vorschlag) / Pauschale plus versandkostenfrei ab einem Betrag X / Eine Einheitspauschale für alles; Empfehlung: Pauschale pro Versandklasse, optional versandkostenfrei ab einem Betrag, den du festlegst)_
- Wer trägt bei Widerruf die Rücksendekosten? _(Optionen: Die Kundin trägt die Rücksendekosten / Ich übernehme die Rücksendekosten; Empfehlung: Die Kundin trägt sie; Kulanz im Einzelfall)_
- Womit nimmst du auf dem Flohmarkt Karten an? _(Optionen: Ich nutze schon SumUp (oder Zettle) / Stripe Tap to Pay auf dem Handy / Nur Bargeld / Noch nichts, bitte empfehlen; Empfehlung: Stripe Tap to Pay (ein System); SumUp behalten, falls schon vorhanden)_
- Sollen Barverkäufe vom Markt mit Preis im Shop-Admin erfasst werden, oder nur 'verkauft' für den Bestand? _(Optionen: Nur Bestand (verkauft) markieren, Bargeld separat im Kassenbericht / Mit Preis und Zahlungsart erfassen (nach Rücksprache mit der Steuerberatung) / Auf dem Markt nur noch bargeldlos (Karte oder QR-Link); Empfehlung: Nur Bestand markieren, bis die Steuerberatung es bestätigt)_
- Hast du eine Steuerberatung oder ein Buchhaltungsprogramm, und welches Exportformat brauchst du? _(Optionen: Steuerberatung mit DATEV / Lexware Office / sevDesk / Mache ich selbst (EÜR), keine Software; Empfehlung: Rechnungen aus dem Shop plus CSV- und DATEV-Export; keine API-Anbindung zum Start)_
- Soll es Abholung in Berlin geben, und wenn ja wo und wann (Atelier, Studio, nach Absprache)? _(Optionen: Ja, feste Adresse und Zeiten / Ja, nach individueller Absprache per Mail / Nein; Empfehlung: Ja, nach Absprache (Adresse erst in der Abholmail))_
- Gibt es Stücke über 500 € Warenwert, und welche Paketdienste möchtest du nutzen? _(Optionen: Nur DHL, keine Stücke über 500 € / Nur DHL, einzelne teure Stücke mit Versicherung / DHL und Hermes als Alternative; Empfehlung: Nur DHL; Versicherung über 500 € im Admin als Hinweis)_
- Welche Zusatzfunktionen sollen zum Start dabei sein? _(Optionen: Drops + Warteliste + Newsletter + Rabattcodes + DM-Kauflinks (ohne Gutscheine) / Zusätzlich Gutscheine / Nur Shop, Rest später; Empfehlung: Drops + Warteliste + Newsletter (Brevo) + Rabattcodes + DM-Kauflinks; Gutscheine in Phase 2)_
- Hast du einen Drucker, und wie viele Pakete erwartest du pro Monat? _(Optionen: Kein Drucker, unter 20 Pakete/Monat / A4-Drucker, 20–50 Pakete/Monat / Möchte einen Etikettendrucker, über 50 Pakete/Monat; Empfehlung: Zum Start mobile Paketmarke oder A4; API und Thermodrucker in Phase 2)_
