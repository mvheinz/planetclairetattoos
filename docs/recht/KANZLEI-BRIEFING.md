# Mandatsbriefing: Rechtstexte für den Onlineshop planetclairetattoos.com

> **Mandantin:** [Vorname Nachname] („Jutta“), Künstlerin und Tätowiererin, Berlin – Geschäftsbezeichnung
> [z. B. „Planet Claire“]
> **Stand:** 26.09.2026 · **Version:** 1.3 · **Vertraulich**
> **Erstellt** mit KI-Unterstützung (Claude, Anthropic) auf Grundlage eines Interviews mit der Mandantin und einer
> Recherche mit Quellen (Stand September 2026). Das Briefing ist keine Rechtsberatung; alle rechtlichen Einordnungen
> darin sind Arbeitshypothesen, um deren Prüfung wir bitten.
>
> **Vor dem Versand von der Mandantin zu ergänzen:** Nachname, Anschrift, Telefonnummer, Bezirk des Studios,
> Geschäftsbezeichnung, ob eine Gewerbeanmeldung besteht, ggf. Wirtschafts-Identifikationsnummer,
> gewünschter Liefertermin.

---

## 0. Kurzüberblick

Sehr geehrte Damen und Herren,

die Mandantin eröffnet einen eigenen Onlineshop mit Website unter **planetclairetattoos.com**. Sie verkauft dort
ausschließlich **Unikate** (handgemachte Keramik, von Hand bemalte **Second-Hand-Textilien**, Original-Zeichnungen
und -Aquarelle, Keramikschmuck) an Verbraucher:innen **nur in Deutschland**, mit Abholmöglichkeit in Berlin. Sie ist
**Kleinunternehmerin nach § 19 UStG**. Daneben präsentiert die Website ihre Tätigkeit als **Tätowiererin** in einem
Privatstudio – dort gibt es **keine Online-Buchung und keine Online-Zahlung**. Auftragsarbeiten sind nur über ein
Anfrageformular möglich; Angebot und Vertrag laufen per E-Mail.

Die Software wird selbst entwickelt (Next.js mit Payload CMS) und ist so gebaut, dass **kein Cookie-Banner** nötig sein
soll, die **elektronische Widerrufsfunktion nach § 356a BGB** enthalten ist und alle Pflichtangaben je Produkt vor der
Veröffentlichung erzwungen werden. Die Rechtstexte werden im CMS versioniert; jede Bestellung speichert die bei
Vertragsschluss gültige Fassung.

Wir bitten Sie um die **einmalige Erstellung** der Rechtstexte (§1) und um Antworten auf die **Fragen in §17**.
Bitte senden Sie uns vorab ein **Pauschalangebot**.

## 1. Auftrag und gewünschte Lieferungen

### 1.1 Texte

| Nr. | Text | Wesentliche Anforderungen | Priorität |
|---|---|---|---|
| T1 | Impressum | § 5 DDG; Werte als Platzhalter (§16.3); Hinweis auf Instagram-Profil (§13); Anschrift: bitte K-39 beachten | Pflicht |
| T2 | Datenschutzerklärung Website/Shop | Art. 13 DSGVO; alle Verarbeitungen aus §11; Abschnitts-Anker nach §11.10 | Pflicht |
| T3 | Allgemeine Geschäftsbedingungen | Vertragsschluss (§5), Zahlung inkl. Vorkasse mit automatischer Stornierung, Lieferung/Abholung, Eigentumsvorbehalt, Mängelhaftung inkl. Gebrauchtware und Recht auf Reparatur, Vertragstextspeicherung und -sprache (Art. 246c EGBGB) | Pflicht |
| T4 | Widerrufsbelehrung | Fassung ab 19.06.2026 inkl. Satz zur Online-Widerrufsfunktion mit URL `https://planetclairetattoos.com/de/vertrag-widerrufen` (Platzhalter `{{withdrawalUrl}}`, §16.3); Rücksendekosten trägt die Kund:in; Telefonnummer | Pflicht |
| T5 | Muster-Widerrufsformular | Anlage 2 EGBGB | Pflicht |
| T6 | Versand- und Zahlungsinformationen | Liefergebiet, Versandkosten (Tabelle wird eingesetzt, §16.3), Lieferzeit, Abholung, Zahlarten, Vorkasse-Frist | Pflicht |
| T7 | Kurze Textbausteine | Liste in §1.4 (Kasse, Produktseite, Mails) | Pflicht |
| T8 | Vorlage Angebot/Vertrag Auftragsarbeit per E-Mail | Informationspflichten Fernabsatz, Widerrufsrecht bzw. Ausschluss nur bei individueller Anfertigung, GPSR-Angaben | optional, empfohlen |
| T9 | Unterlagen Tattoo-Termine per E-Mail/DM | Widerrufsbelehrung für Dienstleistungen, Formulierung „vorzeitiger Beginn“, Formulierungsvorschlag Terminkaution | optional, empfohlen |
| T10 | Einwilligung zur Veröffentlichung von Tattoo-Fotos | § 22 KUG, Art. 6/7 DSGVO; abgestuft (nur Tattoo / mit Gesicht; @-Nennung ja/nein); widerruflich | optional, empfohlen |
| T11 | Datenschutzhinweise für das Instagram-Profil | falls erforderlich (K-29) | optional |
| T12 | Antwortvorlagen für Datenschutz-Anfragen | Auskunft (Art. 15), Löschung/Einschränkung (Art. 17/18) | optional |
| T13 | Angebot jährliche Durchsicht | Die Mandantin erhält jährlich eine Erinnerung aus dem System | optional |

### 1.2 Formate

- Je Text **zwei Dateien**: reiner Text (`.txt`, UTF-8) und HTML-Fragment (`.html`).
- Erlaubte HTML-Elemente: `h2`, `h3`, `h4`, `p`, `ul`, `ol`, `li`, `strong`, `em`, `a`, `br`, `table`, `thead`,
  `tbody`, `tr`, `th`, `td`. Keine Inline-Styles, Klassen oder Skripte. Überschriften beginnen mit `h2`
  (die Seite setzt `h1`).
- Datei-Namen nach dem Schema `T2_datenschutz_de_2026-10-15.html` (Text-Nr., Kurzname, Sprache, Stand).
- Bitte für änderbare Werte die Platzhalter aus §16.3 verwenden statt fester Angaben.
- Ein Stand-Datum im Text ist willkommen. PDFs erzeugt das System selbst; ein zusätzliches Word-Dokument ist in
  Ordnung.

### 1.3 Sprachen

Die Website ist zweisprachig (Deutsch, Englisch). **Verbindlich ist die deutsche Fassung.** Wir bitten um eine
englische Übersetzung als unverbindliche Lesefassung – alternativ lassen wir übersetzen und bitten Sie um kurze
Durchsicht – sowie um einen Hinweissatz für die englischen Seiten (Baustein `translation.disclaimer`, K-05).

### 1.4 Textbausteine (T7)

Die Bausteine werden im CMS gepflegt; für alle liegt eine **Arbeitsfassung** vor (Anlage A, §6), die Sie gern als
Ausgangspunkt nutzen können.

| Schlüssel | Verwendung |
|---|---|
| `price.kleinunternehmerNote`, `price.shippingNote`, `price.tattooNote` | Preisangaben (Shop, Tattoo) |
| `delivery.timeShipping`, `delivery.timePickup` | Lieferzeit Versand/Abholung |
| `cart.paymentAndDeliveryInfo` | Warenkorb: Zahlarten und Liefergebiet |
| `checkout.legalNotice` | Hinweis auf AGB/Widerrufsbelehrung/Datenschutz über dem Bestell-Button |
| `checkout.dhlEmailConsent` | Einwilligung E-Mail-Weitergabe an DHL (optional, nicht vorangekreuzt) |
| `checkout.deviationAgreement` | Gesonderte Vereinbarung abweichender Beschaffenheit (§ 476 BGB) |
| `checkout.vorkasseInfo` | Hinweis Vorkasse-Frist und Stornierung |
| `product.ceramicsDecorative`, `product.ceramicsFoodSafe` | Keramik-Kennzeichnung |
| `product.jewelrySmallParts`, `product.jewelryNickel` | Schmuck-Warnhinweis, Nickel-Aussage |
| `product.textileSecondHand`, `product.textileLabelMissing` | Second-Hand-Textilien |
| `email.orderConfirmation.contractSentence` | Satz zum Vertragsschluss in der Bestellbestätigung |
| `email.vorkasse.paymentInstructions`, `email.vorkasse.reminder`, `email.vorkasse.cancellation` | Vorkasse-Mails |
| `email.shipping.damageNotice` | Hinweis Transportschäden in der Versandmail |
| `withdrawal.intro`, `withdrawal.receiptNotice`, `withdrawal.returnInfo` | Widerrufsfunktion und Eingangsbestätigung |
| `withdrawal.returnCostsNote` | Satz zu den Rücksendekosten (wird über `{{returnCostsNote}}` in die Rechtstexte eingesetzt, §16.3) |
| `complaint.repairChoice` | Reklamationsantwort (Wahlrecht Reparatur/Ersatz, Verlängerung um 12 Monate) |
| `dispute.vsbg37` | Hinweis auf Schlichtungsstelle im Streitfall (§ 37 VSBG) |
| `inquiry.privacyNotice`, `inquiry.autoReply` | Anfrageformular Auftragsarbeiten |
| `translation.disclaimer` | Hinweis auf englischen Seiten |

### 1.5 Zeitrahmen, Honorar, Kontakt

- Ein fester Starttermin besteht nicht; die Texte werden vor dem Go-live benötigt. Die Software arbeitet bis dahin mit
  gekennzeichneten Platzhaltern.
- Wir bitten um ein **Pauschalangebot** für T1–T7 und gesondert für die optionalen Texte T8–T13.
- Ansprechpartnerin ist die Mandantin: jutta@planetclairetattoos.com. Technische Detailfragen beantwortet sie nach
  Rücksprache; die technischen Anforderungen sind in den Anlagen dokumentiert.

## 2. Mandantin

| Angabe | Inhalt |
|---|---|
| Name | [Vorname Nachname] |
| Geschäftsbezeichnung | [z. B. „Planet Claire“] (Name angelehnt an den Song der B-52's, K-37) |
| Rechtsform | Einzelunternehmerin, nicht im Handelsregister eingetragen, keine Beschäftigten |
| Anschrift | [Straße Nr., PLZ Berlin] – **Privatadresse**; bewusst zugleich Impressum-, Hersteller- (GPSR) und Rücksendeadresse. Dort liegt auch das Tattoo-Studio, dessen Ort öffentlich nur mit dem Bezirk genannt werden soll – bitte K-39 beachten |
| Kontakt | jutta@planetclairetattoos.com · Telefon [folgt] · Instagram @planet.claire.tattoos |
| Tätigkeiten | Tätowiererin (Fine Line, naiv) im Privatstudio in Berlin-[Bezirk]; Künstlerin (Keramik, bemalte Textilien, Zeichnungen, Keramikschmuck); Verkauf online und auf Flohmärkten |
| Umsatzsteuer | Kleinunternehmerin nach § 19 UStG; die Umstellung auf Regelbesteuerung ist technisch vorbereitet |
| Identifikationsnummern | Steuernummer vorhanden (nur auf Rechnungen); W-IdNr./USt-IdNr.: [falls vorhanden] |
| Datenschutzbeauftragte:r | nicht benannt (§ 38 BDSG nicht erfüllt) |
| Erwartetes Volumen | Schätzung 5–50 Bestellungen im Monat |
| Buchhaltung | selbst (EÜR); der Shop erzeugt Rechnungs-PDFs und Monatsexporte |

## 3. Geschäftsmodell und Sortiment

### 3.1 Grundsätze

- **Nur Unikate** (Bestand 1), keine Serien, keine Größenvarianten. Jedes Stück hat eine von der Mandantin vergebene
  **Objektnummer** (z. B. „Nr. 017“), die auch am Stück angebracht wird.
- Neue Stücke gehen sofort online; verkaufte Stücke können mit „sold“-Stempel im Archiv sichtbar bleiben.
- Auf Verkaufsware nur **eigene Figuren**, keine geschützten fremden Figuren.
- Keine Rabatte, Gutscheine, Streichpreise, Drops oder Newsletter.

### 3.2 Warengruppen

| Warengruppe | Beschreibung | Rechtlich relevante Punkte |
|---|---|---|
| Keramik (Schalen, Teller, Fliesen, Objekte) | handgeformt, bemalt, glasiert; Beispiel: Schale 45 € | Standard **„Dekorationsobjekt – nicht für Lebensmittel geeignet“** (Kennzeichnung im Angebot und am Boden). Umstellung auf „für Lebensmittel geeignet“ technisch nur möglich, wenn für jede verwendete Glasur eine Konformitätserklärung hinterlegt ist; diese wird dann öffentlich zum Download angeboten (K-14) |
| Textilien (Shirts, Kleider, Caps) | **Second-Hand/Vintage**, von Hand bemalt; Beispiel: Cap 89 € | Faserzusammensetzung laut Originaletikett in amtlichen Bezeichnungen (Summe 100 %), Größe, Zustand; Option „Etikett fehlt – Angabe nach bestem Wissen“ (K-12); sichtbare Hersteller-Logos auf Rohlingen möglich (K-13); Zustandsbeschreibung und ggf. gesonderte Vereinbarung von Mängeln (K-17) |
| Zeichnungen, Aquarelle | Originale, ggf. gerahmt; Beispiel: Aquarell 120 € | GPSR-Ausnahme für Kunstwerke unsicher; Angaben werden trotzdem gezeigt (K-16) |
| Keramikschmuck | Anhänger ca. 1 × 1,5 cm mit Metallöse und Kette; Beispiel: 24 € | Veröffentlichung nur mit bestätigtem Nachweis nickelfreier Metallteile und bleifreier Glasur; Warnhinweis Kleinteile (K-15) |

Auf **jeder** Produktseite steht nicht einklappbar ein Block „Herstellerin & Produktsicherheit“ (Name, Anschrift,
E-Mail, Produktart, Objektnummer, Warnhinweise) sowie Preis mit Kleinunternehmer-Hinweis, Versandkosten-Link,
Lieferzeit, Maße und Material.

### 3.3 Auftragsarbeiten

- Nur über ein **Anfrageformular** (Name, E-Mail, Beschreibung, Gegenstand, Wunschzeitraum und Budget optional, bis zu
  5 Referenzbilder optional). Keine Bestellung im Shop.
- Angebot, Vertrag und Bezahlung laufen **per E-Mail** außerhalb des Shops (Überweisung o. ä.). Dafür wird die Vorlage
  T8 erbeten (K-24).
- Anfragen samt Bildern werden 6 Monate nach Eingang automatisch gelöscht (K-25).

### 3.4 Tattoo-Bereich (nicht kaufbar)

- Privatstudio; öffentlich wird nur der Bezirk genannt. Weil Impressum und Herstellerangabe die Privatadresse zeigen,
  ist der Studio-Ort trotzdem auffindbar (K-39).
- Inhalte: Stil, **Flash-Motive mit Festpreis** (einmalig oder wiederholbar; Status verfügbar/vergeben),
  **Flash-Days/Aktionen mit Datum** (nach Ablauf automatisch ausgeblendet), **Preisrahmen** für Custom-Motive,
  Galerie „fresh & healed“, Ablauf, Pflegehinweise, FAQ (u. a. Mindestalter 18).
- Anfragen **nur per E-Mail-Link oder Instagram-DM**; kein Formular, keine Uploads, keine Online-Buchung, keine
  Online-Anzahlung. Eine Kaution wird individuell per E-Mail/DM vereinbart und außerhalb der Website bezahlt;
  Einwilligungs-/Aufklärungsbogen auf Papier vor Ort (K-26).
- Portfolio-Fotos, die Kund:innen zeigen, werden nur mit dokumentierter Einwilligung veröffentlicht (Häkchen je Foto;
  K-27, T10).

### 3.5 Flohmärkte

Verkauf vor Ort, Kartenzahlung dort über ein eigenes Terminal (z. B. SumUp). Der Shop markiert das Stück nur als
„offline verkauft“; es gibt keine Kassenfunktion.

### 3.6 Instagram

Das Profil @planet.claire.tattoos dient der Präsentation; gekauft wird über den Shop (Link zum Stück). Instagram wird
auf der Website nur verlinkt, nicht eingebettet (K-29).

## 4. Vertriebswege und Liefergebiet

- Onlineshop, Bestellung **nur als Gast** (keine Kundenkonten); Bestellstatus über einen geheimen Link in der
  Bestellbestätigung.
- **Lieferung nur innerhalb Deutschlands**; **Abholung in Berlin** nach Absprache (Ort wird erst in der Abholmail
  genannt, da Privatstudio).
- EU-Länder sind technisch vorbereitet, aber abgeschaltet (Grund: Bevollmächtigtenpflicht nach Art. 45 PPWR je
  Zielland); Schweiz vorbereitet, aus; Großbritannien und USA gesperrt.
- Website auf Deutsch und Englisch; vorgesehene Vertragssprache Deutsch (K-05).

## 5. Bestellablauf

### 5.1 Schritte

1. **Produktseite:** Pflichtangaben (§3.2), Button „In den Korb“. Erst ab hier wird ein Warenkorb-Cookie gesetzt
   (nur Nummern der Stücke, der Preis beim Hinzufügen und die Lieferart, §11.3).
2. **Warenkorb:** Versand (höchste Versandklasse im Korb) oder Abholung wählen; Zahlarten und Liefergebiet werden
   angezeigt.
3. **Kasse** (eigene Seite, erreicht über den Button „Zur Kasse“, der ein kurzlebiges Kassen-Cookie setzt, §11.3):
   E-Mail, Name (ein Feld „Vor- und Nachname“), bei Versand die Lieferadresse; eine abweichende Rechnungsadresse nur
   über ein nicht vorangekreuztes Häkchen, bei Abholung ist die Rechnungsadresse Pflicht (K-07); Zahlart. **Kein**
   Telefonfeld. Mit Beginn des Bezahlvorgangs ist das Stück **30 Minuten reserviert** (sichtbarer Countdown); läuft
   die Zeit ab, wird es freigegeben.
4. Optionale, nicht vorangekreuzte Checkbox: Weitergabe der E-Mail-Adresse an DHL (K-31).
5. Bei Stücken mit beschriebenen Mängeln: je Stück eine gesonderte Pflicht-Checkbox zur Vereinbarung der Abweichung
   (K-17).
6. **Übersicht direkt über dem Button:** Stücke mit wesentlichen Eigenschaften und Objektnummer, Einzelpreise,
   Versandkosten, Gesamtpreis mit Kleinunternehmer-Hinweis, Lieferzeit, Adressen, Zahlart, „Ändern“-Links; Hinweis
   mit Links auf AGB, Widerrufsbelehrung und Datenschutzerklärung – **ohne** AGB-Checkbox (K-04).
7. **Button „Zahlungspflichtig bestellen“** (englisch vorgesehen: „Order with obligation to pay“, K-03).
8. **Zahlung:** Karte, Apple Pay, Google Pay laufen eingebettet über Stripe auf derselben Seite; bei PayPal wird nach
   dem Klick zu PayPal weitergeleitet. Bei **Vorkasse** wird die Bestellung sofort angelegt.
9. **Danke-Seite** mit Bestellnummer, Zusammenfassung, Link „Vertrag widerrufen“.
10. **Bestellbestätigung per E-Mail** (Inhalt §5.3), später Versand- bzw. Abholmail.

### 5.2 Vorgeschlagene Vertragsschluss-Mechanik (bitte prüfen, K-01, K-02)

- Der Klick auf „Zahlungspflichtig bestellen“ ist das Angebot der Kund:in. Das System speichert dabei Zeitpunkt,
  alle Vertragsdaten, die angezeigten Preise und die geltenden Fassungen der Rechtstexte.
- **Karte/Wallet/PayPal:** Die Bestellung wird erst nach bestätigter Zahlung angelegt; Annahme durch die
  Bestellbestätigung, die danach verschickt wird. Scheitert die Zahlung, entsteht keine Bestellung und kein Vertrag.
- **Vorkasse:** Die Bestellbestätigung mit Zahlungsdaten geht sofort raus. Das Stück bleibt bis zum Ende der
  **Zahlungsfrist** reserviert: 23:59 Uhr (Berliner Zeit) am 5. Kalendertag nach dem Bestelltag (Bestellung am 12.10. →
  Frist 17.10., 23:59 Uhr). 72 Stunden nach der Bestellung folgt eine Erinnerung; ist bis zum Fristende kein Geld
  eingegangen, wird die Bestellung **automatisch storniert** und das Stück wieder angeboten. Wir benötigen hierfür
  eine tragfähige Regelung in den AGB und die Formulierungen der Mails.

### 5.3 Bestätigungen und Vertragstext

- **Bestellbestätigung** (Eingangs- und Vertragsbestätigung): Anbieterkennung, Bestellnummer und Zeitpunkt,
  Positionen mit wesentlichen Eigenschaften, Preise, Versandkosten, Gesamtpreis, Zahlart (bei Vorkasse IBAN,
  Verwendungszweck, Frist), Adressen, Lieferzeit, Hinweis auf gesetzliche Mängelhaftung, **AGB und Widerrufsbelehrung
  mit Muster-Formular als PDF-Anhang in der bei Bestellung gültigen Fassung**, Link zur Widerrufsfunktion, Link zum
  Bestellstatus, bei Zahlung die Rechnung als PDF. Keine Werbung.
- Der Shop speichert jede Bestellung mit den Versionen der geltenden Rechtstexte. Die Kund:in kann die Texte über den
  Bestellstatus-Link erneut abrufen; die Rechnung gibt es dort bewusst nicht (sie enthält die volle Anschrift und kommt
  per E-Mail).
- Eingabefehler lassen sich über „Ändern“-Links vor dem Absenden korrigieren.

## 6. Zahlungsarten

| Zahlart | Abwicklung | Belastung | Hinweise |
|---|---|---|---|
| Kredit-/Debitkarte | Stripe Payments Europe, eingebettet auf der Kassenseite | sofort | – |
| Apple Pay, Google Pay | über Stripe | sofort | Wallet-Anbieter eigene Verantwortliche |
| PayPal | über Stripe; Weiterleitung zu PayPal | sofort | PayPal eigener Verantwortlicher |
| Vorkasse (Überweisung) | Bankkonto der Mandantin | bis 23:59 Uhr am 5. Kalendertag nach dem Bestelltag | Erinnerung nach 72 Stunden, automatische Stornierung nach Fristende |

Keine Aufschläge je Zahlart. Kein Klarna, keine SEPA-Lastschrift, kein Rechnungskauf, keine Ratenzahlung.

## 7. Versand, Lieferung, Abholung

| Versandklasse | Für | Versand | Preis für Kund:innen |
|---|---|---|---|
| Brief | Zeichnungen, Anhänger | Großbrief Einschreiben (Deutsche Post) | 4,50 € |
| Paket klein | Textilien, Caps | DHL Paket 2 kg | 6,50 € |
| Keramik | Keramik (Karton in Karton) | DHL Paket 5 kg | 8,90 € |
| Abholung | alle | Berlin nach Absprache | 0,00 € |

- Liegen mehrere Stücke im Korb, gilt die höchste Klasse. Preise sind im System änderbar und werden auf der Seite
  „Versand & Zahlung“ automatisch eingesetzt.
- **Lieferzeit** „2–5 Werktage“, bei Vorkasse ab Zahlungseingang (K-06).
- Versand mit **DHL** bzw. Deutscher Post; Labels erstellt die Mandantin manuell. Die Meldung „versendet“ löst eine
  Versandmail aus – bei Paketen mit Sendungsnummer und Sendungsverfolgung; bei Briefen ist die Sendungsnummer optional
  (K-40). Darin die Bitte, Transportschäden möglichst schnell mit Fotos zu melden – ohne Einschränkung der
  gesetzlichen Rechte (K-21).
- Das **Transportrisiko** trägt die Verkäuferin (§ 475 Abs. 2 BGB); Verpackungs-Checklisten und ein
  Versicherungshinweis ab 500 € Warenwert sind im Ablauf vorgesehen. Packfotos sind empfohlen, aber keine Pflicht;
  bei Keramik ohne Packfoto fragt das System vor dem Versand nach und protokolliert die Bestätigung (K-40).
- **Abholung:** Mitteilung „bereit zur Abholung“ mit Ort und Terminabsprache per E-Mail; Übergabe wird erfasst
  (Beginn Widerrufsfrist, K-08).
- **Verpackung:** Die Mandantin ist als Erstinverkehrbringerin ihrer befüllten Versandverpackungen Herstellerin im
  Sinne von VerpackDG/PPWR (ihre Entscheidung; hierzu erbitten wir keine Prüfung). Sie registriert sich vor dem ersten
  Versand im Verpackungsregister LUCID **und** schließt eine eigene Systembeteiligung (Kleinstlizenz) bei einem
  dualen System ab; vorlizenzierte Kartons des Händlers genügen nicht. Der Shop erfasst je Sendung Verpackungsart und
  -gewicht und erzeugt einen Jahres-Export der Mengen nach Material (Papier/Pappe, Kunststoff, Sonstiges) für die
  Meldungen (Detailfragen: K-35).

## 8. Widerruf und Rücksendung

- Gesetzliches Widerrufsrecht von 14 Tagen, keine freiwillige Verlängerung.
- **Die unmittelbaren Kosten der Rücksendung trägt die Kund:in**; Kulanz im Einzelfall wird nicht zugesagt.
- **Kein Ausschluss** des Widerrufsrechts im Shop: alle Stücke sind vorgefertigte Unikate; Auftragsarbeiten sind
  nicht über den Shop bestellbar.
- **Widerrufsfunktion** (§ 356a BGB) unter `https://planetclairetattoos.com/de/vertrag-widerrufen` (englische Seite
  `https://planetclairetattoos.com/en/withdraw-from-contract`; die Kurzadresse
  `https://planetclairetattoos.com/vertrag-widerrufen` leitet dauerhaft dorthin weiter, in der Widerrufsbelehrung
  steht die vollständige Adresse):
  - Link „Vertrag widerrufen“ auf jeder Seite (Footer, hervorgehoben), in jeder Bestellmail, auf Danke- und
    Statusseite; ohne Login, dauerhaft verfügbar, auch für Vorkasse- und Abholbestellungen.
  - Schritt 1: Name, Angaben zum Vertrag (Bestellnummer oder Freitext), E-Mail für die Bestätigung; optional
    Auswahl einzelner Stücke und ein freiwilliger Grund. Kein CAPTCHA, kein Login.
  - Schritt 2: Zusammenfassung und Button „Widerruf bestätigen“.
  - Danach sofort Eingangsbestätigung per E-Mail mit dem Inhalt der Erklärung, Datum und Uhrzeit des Eingangs,
    Rücksendeadresse und Hinweis zu den Rücksendekosten; Kopie an die Mandantin.
- **Erstattung** über dasselbe Zahlungsmittel (Stripe-Erstattung; bei Vorkasse Rücküberweisung auf das Absenderkonto)
  innerhalb von 14 Tagen; Zurückbehaltung bis Rücksendung oder Nachweis. Beim Widerruf nur einzelner Stücke wird
  vorläufig neben dem Warenwert die Differenz zwischen den bezahlten Versandkosten und den Versandkosten für die
  behaltenen Stücke erstattet (K-09).
- Die Widerrufsfunktion bleibt auch im Wartungsmodus der Website nutzbar; nur bei einem Datenbankausfall verweist die
  Seite auf den Widerruf per E-Mail.
- Bitte berücksichtigen Sie in der Widerrufsbelehrung den neuen Satz zur Online-Widerrufsfunktion (Anlage 1 EGBGB in
  der Fassung ab 19.06.2026), die Telefonnummer und die Rücksendekosten-Regel (K-09 bis K-11).

## 9. Gewährleistung, Reklamation, Streitbeilegung

- Es gilt die gesetzliche Mängelhaftung; es wird **keine Garantie** gegeben.
- Gebrauchte Textilien: Zustand wird beschrieben; konkrete Mängel werden gesondert vereinbart (Checkbox). Eine
  Verkürzung der Verjährung für Gebrauchtware ist derzeit **nicht** vorgesehen (K-17).
- **Recht auf Reparatur** (Kaufverträge ab 31.07.2026): Die Reklamationsantwort informiert über das Wahlrecht und die
  Verlängerung um 12 Monate bei Reparatur; bei Unikaten ist Ersatz in der Regel unmöglich (K-20).
- **Harmonisierte Mitteilung** über die gesetzliche Gewährleistung (ab 27.09.2026) wird auf Produktseiten, im Warenkorb
  und auf der Versandseite gezeigt (K-19).
- **Streitbeilegung:** kein Link auf die abgeschaltete OS-Plattform; § 36 VSBG nach Beschäftigtenzahl nicht
  verpflichtend; für den Streitfall eine Vorlage nach § 37 VSBG (K-22).

## 10. Preise, Steuer, Rechnungen

- Preise sind Endpreise; Hinweis „gemäß § 19 UStG wird keine Umsatzsteuer berechnet“ an jedem Preis, dazu „zzgl.
  Versandkosten“ mit Link (K-23). Nie „inkl. MwSt.“.
- Jede bezahlte Bestellung erhält automatisch eine **Rechnung nach § 34a UStDV** mit fortlaufender Nummer
  (RE-JJJJ-NNNNN), unveränderlich archiviert; Korrekturen per Gutschrift (GS-JJJJ-NNNNN).
- Ein Umsatzzähler warnt vor den Kleinunternehmergrenzen; der Wechsel zur Regelbesteuerung ist mit Gültig-ab-Datum
  vorbereitet (dann andere Preishinweise und Rechnungen).

## 11. Datenschutz

### 11.1 Verantwortliche, Aufsicht

- Verantwortliche: die Mandantin (Kontaktdaten §2). Ein:e Datenschutzbeauftragte:r ist nicht benannt.
- Zuständige Aufsichtsbehörde: Berliner Beauftragte für Datenschutz und Informationsfreiheit, Alt-Moabit 59–61,
  10555 Berlin.
- Ein Verzeichnis von Verarbeitungstätigkeiten wird geführt; Löschfristen und Verfahren für Betroffenenrechte sind
  festgelegt (Anlage C).

### 11.2 Architektur ohne Einwilligungsbanner (bitte prüfen, K-30)

- Vor der ersten Warenkorb-Aktion: **keine Cookies, kein localStorage/sessionStorage**, kein Service Worker, keine
  Anfragen an Drittanbieter. Auch danach wird nur gespeichert, was die gewünschte Funktion technisch braucht, ohne
  personenbezogene Daten und ohne Wiedererkennungs-Kennung, mit kurzer Laufzeit (vollständige Liste §11.3; K-38).
- Schriften selbst gehostet; keine Einbettungen (Instagram, YouTube, Karten), keine Social Plugins, kein reCAPTCHA,
  keine Tracking-Pixel, kein Fingerprinting. Eine Content-Security-Policy erlaubt technisch nur Ressourcen vom eigenen
  Server (Ausnahme: Stripe auf der Kassenseite), K-41.
- Sprache wird nur über den Pfad (`/de/…`, `/en/…`) bestimmt, ohne Cookie.
- Stripe.js wird **nur auf der Kassenseite** geladen, also erst nach aktiver Entscheidung der Kund:in.
- Statistik: **Vercel Web Analytics** (ohne Cookies; Besucher-Hash aus der Anfrage, nach 24 Stunden verworfen) ist
  vorbereitet, wird aber **erst nach Ihrer Bestätigung** eingeschaltet.
- Fehlerüberwachung (Sentry) nur serverseitig und in der Verwaltung; auf öffentlichen Seiten kein Skript. Vorbereitet,
  aber ausgeschaltet ist eine Meldung von Browser-Fehlern an einen eigenen Endpunkt der Website (ohne Cookies, ohne
  Speicherung der IP, ohne Personendaten, nur serverseitig an Sentry weitergereicht); sie wird erst nach Ihrer Antwort
  auf K-30 (c) eingeschaltet.

### 11.3 Cookies und Endgerätespeicher (vollständige Liste)

| Name | Zweck | Wann gesetzt | Dauer | Anbieter |
|---|---|---|---|---|
| `pc_cart` | Warenkorb: nur die Nummern der Stücke, je Stück der Preis beim Hinzufügen (nur für den Hinweis, dass sich ein Preis geändert hat) und die gewählte Lieferart (Versand/Abholung); keine Kennung, keine personenbezogenen Daten; per Skript lesbar, damit die Korb-Anzahl angezeigt werden kann | nach dem ersten „In den Korb“ | 7 Tage | eigen |
| `pc_checkout` | Zuordnung des laufenden Bezahlvorgangs und der Reservierung (zufällige Kassen-Kennung; nicht per Skript lesbar) | nach Klick auf „Zur Kasse“ | 1 Stunde | eigen |
| `__stripe_mid` | Betrugsprävention bei der Zahlung | nur auf der Kassenseite | ca. 1 Jahr (laut Stripe) | Stripe (First-Party-Cookie) |
| `__stripe_sid` | Betrugsprävention bei der Zahlung | nur auf der Kassenseite | ca. 30 Minuten (laut Stripe) | Stripe (First-Party-Cookie) |
| localStorage-Eintrag `pc-motion` | Einstellung des Schalters „Animationen“ (weniger/volle Bewegung) | nur wenn die Person den Schalter betätigt | bis zur Löschung | eigen |
| Anmelde-Cookie der Verwaltung | Login der Mandantin | nur im Verwaltungsbereich | ≤ 7 Tage | eigen |

Es gibt keinen serverseitigen Warenkorb (K-38). Vercel Web Analytics setzt keine Cookies (siehe 11.2); die Sprache wird
nicht gespeichert.

### 11.4 Verarbeitungen

Rechtsgrundlagen sind **Vorschläge** zur Prüfung.

| Nr. | Verarbeitung | Betroffene, Daten | Zweck | Rechtsgrundlage (Vorschlag) | Empfänger | Speicherdauer |
|---|---|---|---|---|---|---|
| V1 | Aufruf der Website | Besucher:innen: IP, URL, User-Agent, Zeit | Auslieferung, Sicherheit | Art. 6 Abs. 1 lit. f | Vercel | Logs nach Anbieter-Plan, eigene ≤ 14 Tage |
| V2 | Warenkorb und Kasse (Cookies) | Nummern der Stücke, Preis beim Hinzufügen, Lieferart; zufällige Kassen-Kennung | Warenkorb, Zuordnung des Bezahlvorgangs | Art. 6 Abs. 1 lit. b; § 25 Abs. 2 Nr. 2 TDDDG (K-38) | Vercel | Warenkorb-Cookie 7 Tage, Kassen-Cookie 1 Stunde; kein serverseitiger Warenkorb |
| V3 | Bestellung, Vertragsabwicklung, Bestellstatus-Link | Name, E-Mail, Adressen, Bestelldaten (kein Telefon) | Vertrag | Art. 6 Abs. 1 lit. b, c | Vercel, Neon, Lettermint | 6 Jahre (gestuft), Kassen-Daten (auch abgebrochene Vorgänge) 30 Tage |
| V4 | Zahlung | Name, E-Mail, Adresse, Betrag, Zahlungsdaten (nur beim Anbieter), Betrugssignale | Zahlung, Betrugsprävention | Art. 6 Abs. 1 lit. b, c, f | Stripe (AV und eigene Verantwortung), PayPal, Apple/Google (Wallets), Bank (Vorkasse) | beim Anbieter nach dessen Pflichten |
| V5 | Versand | Name, Lieferadresse; E-Mail nur mit Einwilligung | Zustellung | Art. 6 Abs. 1 lit. b; lit. a (E-Mail) | DHL Paket GmbH / Deutsche Post AG | mit der Bestellung |
| V6 | Transaktions-E-Mails | E-Mail, Name, Mailinhalt, Zustellprotokoll | Bestätigungen, Pflichtinformationen | Art. 6 Abs. 1 lit. b, c | Lettermint | Protokoll wie Bezugsobjekt |
| V7 | Rechnungen, Buchhaltung | Name, Anschrift, Beträge | gesetzliche Aufbewahrung | Art. 6 Abs. 1 lit. c | Finanzamt (bei Prüfung) | 10 Jahre (K-33) |
| V8 | Widerrufsfunktion | Name, Vertragsangaben, E-Mail, Grund (freiwillig) | Widerruf, Eingangsbestätigung | Art. 6 Abs. 1 lit. c | Lettermint | 6 Jahre |
| V9 | Reklamationen | Kontaktdaten, Fotos, Verlauf | Gewährleistung | Art. 6 Abs. 1 lit. b, c | – | mit der Bestellung |
| V10 | Anfrage Auftragsarbeiten | Name, E-Mail, Beschreibung, bis zu 5 Bilder | Anfrage beantworten | Art. 6 Abs. 1 lit. b (K-25) | Vercel, Neon, R2, Lettermint | 6 Monate ab Eingang |
| V11 | Kontakt per E-Mail/Instagram | Mailinhalt, Kontaktdaten | Kommunikation | Art. 6 Abs. 1 lit. b, f | IONOS; Meta (bei DM) | nach Zweck, Geschäftsbriefe 6 Jahre |
| V12 | Statistik (erst nach Bestätigung) | Seitenaufrufe, grobe Region, Browser, Gerätetyp, Hash 24 h | Reichweite | Art. 6 Abs. 1 lit. f (K-30) | Vercel | Hash 24 h |
| V13 | Fehlerüberwachung (serverseitig; Browser-Fehler erst nach K-30 c) | technische Fehlerdaten ohne Personendaten | Stabilität | Art. 6 Abs. 1 lit. f | Sentry (EU-Region) | kurz (Plan) |
| V14 | Spam- und Missbrauchsschutz | Hash der IP, 24 h | Sicherheit | Art. 6 Abs. 1 lit. f | – | 24 h |
| V15 | Portfolio-Fotos von Tattoo-Kund:innen | Fotos, Einwilligungsnachweis | Darstellung der Arbeit | Art. 6 Abs. 1 lit. a; § 22 KUG | Vercel, R2 | bis Widerruf; Nachweis + 3 Jahre |
| V16 | Datenschutz-Anfragen | Kontaktdaten, Schriftverkehr | Erfüllung der Rechte | Art. 6 Abs. 1 lit. c | – | 3 Jahre |
| V17 | Backups | alle Daten | Wiederherstellung | Art. 6 Abs. 1 lit. c, f; Art. 32 | R2 (EU, vor dem Upload verschlüsselt, eigener Backup-Speicher; nicht über GitHub) | 30 Tage / 12 Monate |
| V18 | Übersetzung (DeepL) | **keine** personenbezogenen Daten | Übersetzung eigener Texte | – | DeepL SE | – |
| V19 | Instagram-Profil | Daten der Nutzer:innen bei Meta | Präsentation | Art. 6 Abs. 1 lit. f; ggf. Art. 26 (K-29) | Meta Platforms Ireland Ltd. | nach Meta |

Es gibt **keine** Kundenkonten, keinen Newsletter, kein Kontaktformular, keine Bewertungen, kein Profiling und keine
automatisierten Entscheidungen durch die Mandantin (Stripe führt eigene Risikoprüfungen durch).

### 11.5 Auftragsverarbeiter und weitere Empfänger (Kurzfassung von Anlage B)

| Anbieter | Sitz | Rolle | Speicherort / Drittland |
|---|---|---|---|
| Vercel Inc. (Hosting, CDN, Statistik) | Covina, Kalifornien, USA | Auftragsverarbeiter | Funktionen in Frankfurt; US-Unternehmen (DPF, SCC) |
| Neon (Databricks) (Datenbank) | San Francisco, USA | Auftragsverarbeiter | Frankfurt; US-Zugriff möglich (DPF/SCC) |
| Cloudflare, Inc. (Objektspeicher R2) | San Francisco, USA | Auftragsverarbeiter | EU-Jurisdiktion; US-Unternehmen (DPF/SCC) |
| Stripe Payments Europe, Ltd. | Dublin, Irland | Auftragsverarbeiter und eigene Verantwortung | Übermittlung an Stripe, Inc., USA (DPF/SCC) |
| PayPal (Europe) S.à r.l. et Cie, S.C.A. | Luxemburg | eigene Verantwortung | gruppenintern laut PayPal |
| Lettermint B.V. (E-Mail-Versand) | Zwolle, Niederlande | Auftragsverarbeiter | EU |
| IONOS SE (Domain, Postfach) | Montabaur | Auftragsverarbeiter | Deutschland/EU |
| Functional Software, Inc. (Sentry) | San Francisco, USA | Auftragsverarbeiter | EU-Region Frankfurt (DPF/SCC) |
| DeepL SE | Köln | keine personenbezogenen Daten | – |
| DHL Paket GmbH / Deutsche Post AG | Bonn | eigene Verantwortung | Deutschland |
| Apple Distribution International Ltd. / Google Ireland Ltd. | Cork / Dublin, Irland | eigene Verantwortung (Wallets) | laut Anbieter |
| Bank der Mandantin | [Name] | eigene Verantwortung (Vorkasse) | – |

Die Auftragsverarbeitungsverträge werden vor dem Start abgeschlossen. Die Liste ist abschließend; weitere Dienste
kommen nur nach Entscheidung der Mandantin hinzu.

### 11.6 Speicherdauer (Kurzfassung von Anlage C)

| Daten | Dauer |
|---|---|
| Warenkorb (nur Cookie im Browser) | 7 Tage; Kassen-Cookie 1 Stunde |
| Kassen-Daten (abgebrochene und abgeschlossene Bezahlvorgänge) | 30 Tage |
| Bestellungen | gestuft: Status-Link 180 Tage nach Abschluss, Pack- und Rückgabefotos 12 Monate nach Versand bzw. Rückgabe, Rest 6 Jahre ab Jahresende, dann anonymisiert |
| Stornierte Vorkasse-Bestellungen | nach 30 Tagen reduziert, 6 Jahre ab Jahresende |
| Rechnungen, Gutschriften | 10 Jahre ab Jahresende, umstellbar auf 8 Jahre (gesetzliche Mindestfrist; K-33) |
| Monatsexporte | 10 Jahre ab Jahresende |
| Widerrufserklärungen | 6 Jahre ab Jahresende |
| Anfragen Auftragsarbeiten inkl. Bilder | 6 Monate ab Eingang |
| E-Mail-Protokoll | wie der Vorgang; ohne Bezug 90 Tage |
| Technische Protokolle | 24 Stunden bis 14 Tage (Webhook-Kennungen und Job-Protokoll ohne Personenbezug 90 Tage; Verwaltungsprotokoll mit maskierten Personendaten 3 Jahre, bei Beleg-, Bestell-, Widerrufs- und Rechtstext-Vorgängen 10 Jahre) |
| Löschprotokoll (ohne Inhalte) | 3 Jahre |
| Datenschutz-Anfragen | 3 Jahre ab Jahresende |
| Portfolio-Einwilligungen | Dauer der Veröffentlichung + 3 Jahre |
| Backups | 30 Tage (täglich), 12 Monate (monatlich); Wiederherstellungsfenster beim Datenbank-Anbieter höchstens 7 Tage |

### 11.7 Betroffenenrechte

Anfragen werden in der Verwaltung erfasst und mit Fristüberwachung (1 Monat) beantwortet; Auskunft und
Datenübertragbarkeit per Export, Löschung bzw. Einschränkung unter Beachtung der Aufbewahrungspflichten. Einzelheiten:
Anlage C, §5.

### 11.8 Nicht eingesetzt

Google Fonts, Google Analytics/Tag Manager, Meta Pixel, andere Tracker, Instagram- oder YouTube-Einbettungen, Karten,
reCAPTCHA/Turnstile, Newsletter-Dienste, Kundenkonten, Chat- oder Bewertungs-Widgets, Stripe Link.

### 11.9 Wünsche an die Datenschutzerklärung

- Abschnitte so gliedern, dass wir aus Formularen direkt verlinken können (Anker in §11.10).
- Statistik-Abschnitt bitte in zwei Varianten (mit/ohne Vercel Web Analytics), damit die Mandantin nach Ihrer Antwort
  auf K-30 umschalten kann.
- Hinweis zur Speicherdauer in Backups (Anlage C, L-23).

### 11.10 Anker-IDs (bitte als `id` der Überschriften verwenden)

`verantwortliche`, `hosting`, `cookies`, `bestellung`, `zahlung`, `versand`, `e-mails`, `widerruf`,
`auftragsarbeiten`, `kontakt`, `statistik`, `fehlerueberwachung`, `portfolio`, `instagram`, `empfaenger`,
`drittland`, `speicherdauer`, `rechte`, `beschwerde`.

## 12. Formulare

| Formular | Felder | Besonderheiten |
|---|---|---|
| Kasse | E-Mail, Name („Vor- und Nachname“ in einem Feld), bei Versand Lieferadresse (Pflicht); abweichende Rechnungsadresse über ein nicht vorangekreuztes Häkchen; bei Abholung Rechnungsadresse Pflicht (K-07); Adresszusatz/Packstation (optional) | kein Telefonfeld, keine Anrede, kein Firmen- oder Titelfeld, kein Geburtsdatum, kein Passwort; DHL-Checkbox optional und nicht vorangekreuzt; Abweichungs-Checkbox je betroffenem Stück |
| Widerrufsfunktion | Name, Angaben zum Vertrag, E-Mail für die Eingangsbestätigung (Pflicht); Stückauswahl, Grund (optional, klar als freiwillig gekennzeichnet) | kein Login, kein CAPTCHA, keine Bestätigungsschleife; unbekannte Bestellnummern werden angenommen; sofortige Eingangsbestätigung; keine IP-Adresse im Datensatz |
| Anfrage Auftragsarbeiten | Name, E-Mail, Beschreibung (20–3000 Zeichen) und Gegenstand (Pflicht); Wunschzeitraum, Budget, bis zu 5 Bilder (optional) | Hinweis „keine Fotos von Personen, keine Gesundheitsangaben“; Bilder privat gespeichert, Metadaten entfernt; Benachrichtigung an die Mandantin nur mit Referenznummer, Gegenstand und Anzahl der Bilder (ohne Namen und Text); automatische Antwort; Löschung nach 6 Monaten |

Weitere Formulare gibt es nicht.

## 13. Instagram-Präsenz

Das Profil @planet.claire.tattoos wird geschäftlich genutzt. Vorgesehen: Link auf die Website und ein zweiter Link auf
`https://planetclairetattoos.com/impressum` in der Bio. Die Website verlinkt Instagram nur (keine Einbettung). Bitte
prüfen Sie, ob das genügt und ob für das Profil eigene Datenschutzhinweise nötig sind (K-29).

## 14. Barrierefreiheit

Nach unserer Einschätzung greift die Ausnahme für Kleinstunternehmen, die Dienstleistungen erbringen (§ 3 Abs. 3
BFSG). Die Website wird trotzdem möglichst barrierearm gebaut (Ziel WCAG 2.2 AA, Tastaturbedienung, Alt-Texte). Eine
Erklärung zur Barrierefreiheit mit Konformitätsaussage ist nicht geplant (K-36).

## 15. Beispielbestand und Entwicklungsphase

- Bis zum Start arbeitet die Software mit einem gekennzeichneten **Beispielbestand** (fiktive Stücke, Bestellungen und
  Personen mit `@example.com`/`@example.org`-Adressen; Bestellnummern `PC-2026-900NN`, Belege in eigenen Serien
  `BSP-RE-…`/`BSP-GS-…` mit eigenem Zähler und sichtbarem Vermerk „Beispiel“, damit sie nicht mit echten Belegen
  verwechselt werden) und mit gekennzeichneten Platzhalter-Rechtstexten. Vor dem Start wird alles entfernt; ein
  technischer Check verhindert den Start mit Beispieldaten.
- Vorschau-Versionen sind passwortgeschützt bzw. eine interne HTML-Datei für die Mandantin.
- Im privaten Code-Repository liegen öffentlich auf Instagram gezeigte Bilder der Mandantin, darunter zwei
  Tattoo-Fotos von Kund:innen, die intern als Beispiel genutzt werden (K-34).

## 16. Technische Einbindung der Texte

### 16.1 Versionierung
Jeder Text wird mit Versionsnummer und Gültig-ab-Datum im CMS gespeichert; veröffentlichte Versionen sind
unveränderlich. Jede Fassung ist als Platzhalter, Arbeitsfassung oder Kanzleitext gekennzeichnet; solange kein
Kanzleitext aktiv ist, zeigt die Seite den Hinweis „PLATZHALTER – nicht rechtsverbindlich“, und die Website kann nicht
live gehen. Jede Bestellung speichert die geltenden Versionen; die Bestellbestätigung enthält AGB und
Widerrufsbelehrung mit Formular als PDF in dieser Fassung.

### 16.2 Englische Fassungen
Englische Seiten zeigen die Übersetzung mit Hinweissatz; fehlt sie, erscheint der deutsche Text.

### 16.3 Platzhalter
Bitte verwenden Sie für änderbare Angaben diese Platzhalter; das System setzt die aktuellen Werte ein:

| Platzhalter | Bedeutung |
|---|---|
| `{{name}}` | Name der Mandantin (ggf. mit Geschäftsbezeichnung) |
| `{{street}}`, `{{postalCode}}`, `{{city}}` | Anschrift |
| `{{email}}`, `{{phone}}` | Kontakt |
| `{{wIdNr}}`, `{{ustIdNr}}` | Identifikationsnummern (leer, falls nicht vorhanden) |
| `{{siteUrl}}` | `https://planetclairetattoos.com` |
| `{{withdrawalUrl}}` | `https://planetclairetattoos.com/de/vertrag-widerrufen` (in der englischen Fassung `https://planetclairetattoos.com/en/withdraw-from-contract`) |
| `{{shippingTable}}` | Tabelle der Versandklassen und Preise |
| `{{deliveryTime}}` | Lieferzeit, derzeit „2–5 Werktage“ |
| `{{vorkasseDays}}` | Vorkasse-Frist, derzeit 5 |
| `{{returnCostsNote}}` | Satz zur Tragung der Rücksendekosten (Textbaustein `withdrawal.returnCostsNote`, §1.4) |

Weitere Platzhalter oder andere Schreibweisen gibt es nicht; ein unbekannter Platzhalter verhindert die
Veröffentlichung. Für die Steuernummer gibt es bewusst keinen Platzhalter, weil sie nie öffentlich erscheinen soll.

Die Tabelle der Auftragsverarbeiter und weiteren Empfänger (§11.5, Anlage B) erzeugt das System selbst und zeigt sie
unter bzw. neben der Datenschutzerklärung; sie ist kein Platzhalter. Bitte verweisen Sie im Abschnitt `empfaenger`
(§11.10) auf diese Tabelle.

### 16.4 Feste Beschriftungen
„Zahlungspflichtig bestellen“, „Vertrag widerrufen“ und „Widerruf bestätigen“ sind fest im Code; englisch vorgesehen:
„Order with obligation to pay“, „Withdraw from contract here“, „Confirm withdrawal“ (K-03).

### 16.5 Spätere Änderungen
Eine Schnittstelle zu einem Update-Dienst (z. B. IT-Recht Kanzlei) ist nur als spätere Option vorgesehen. Neue
Fassungen werden über das CMS eingespielt; die Mandantin erhält jährlich eine Erinnerung.

## 17. Fragen an die Kanzlei

Zu jeder Frage steht in Klammern die **vorläufige Umsetzung**, die bis zu Ihrer Antwort gilt.

**A. Vertragsschluss und Kasse**
- **K-01** Ist die Vertragsschluss-Mechanik in §5.2 tragfähig (Annahme durch Bestellbestätigung nach Zahlung bzw. bei
  Vorkasse sofort)? Welche Formulierungen gehören auf Danke-Seite und in die Bestellbestätigung? *(Danke-Seite
  neutral: „Deine Bestellung ist eingegangen“.)*
- **K-02** Vorkasse: Wie ist die automatische Stornierung nach 5 Tagen rechtlich zu gestalten (z. B.
  Rücktrittsvorbehalt, auflösende Bedingung, Vertragsschluss erst mit Zahlungseingang)? Wie ist mit verspäteten
  Zahlungen umzugehen? *(Storno nach Ablauf der Zahlungsfrist um 23:59 Uhr am 5. Kalendertag nach dem Bestelltag,
  Erinnerung 72 Stunden nach der Bestellung; verspätete Zahlungen werden manuell erstattet oder reaktiviert.)*
- **K-03** Sind die englischen Beschriftungen „Order with obligation to pay“, „Withdraw from contract here“ und
  „Confirm withdrawal“ ausreichend?
- **K-04** Genügt der Hinweis mit Links auf AGB und Widerrufsbelehrung ohne Zustimmungs-Checkbox? *(keine Checkbox)*
- **K-05** Vertragssprache: nur Deutsch, auch bei Bestellung über die englische Seite? Ist eine englische Fassung
  als „unverbindliche Übersetzung“ zulässig, und wie ist der Hinweis zu formulieren? *(Deutsch verbindlich)*
- **K-06** Ist „Lieferzeit 2–5 Werktage (bei Vorkasse ab Zahlungseingang)“ ausreichend bestimmt? Formulierung für
  Abholung? *(wie Baustein `delivery.*`)*
- **K-07** Ist die Rechnungsadresse als Pflichtfeld auch bei Abholung zulässig (für die Rechnung nach § 34a UStDV),
  oder sollte sie bei Abholung optional sein (Kleinbetragsrechnung)? *(Pflicht)*

**B. Widerruf**
- **K-08** Besteht bei Online-Bestellung mit Abholung in Berlin ein Widerrufsrecht, und beginnt die Frist mit der
  Übergabe? Kann die Rückgabe persönlich erfolgen? *(Widerrufsrecht besteht, Frist ab Übergabe)*
- **K-09** Formulierung zu den Rücksendekosten; Umgang mit unfrei zurückgesandten Paketen; Erstattung der
  Hinsendekosten bei Teilwiderruf. *(Kund:in trägt Rücksendekosten; bei Teilwiderruf wird neben dem Warenwert die
  Differenz zwischen den bezahlten Versandkosten und den Versandkosten erstattet, die für die behaltenen Stücke
  angefallen wären)*
- **K-10** Bitte bestätigen Sie die Inhalte der Widerrufsbelehrung: neuer Satz zur Online-Widerrufsfunktion mit URL,
  Pflicht zur Angabe der Telefonnummer (Gestaltungshinweis seit 28.05.2022), Hinweise zum Wertersatz.
- **K-11** Entspricht die Widerrufsfunktion (§8) den Anforderungen des § 356a BGB, insbesondere optionale Stückauswahl,
  freiwilliger Grund, dauerhafte Verfügbarkeit, Annahme auch ohne passende Bestellnummer und der Text der
  Eingangsbestätigung?

**C. Produkte**
- **K-12** Second-Hand-Textilien: Ist die Faserangabe trotz Anhang V Nr. 13 VO (EU) 1007/2011 (ausdrücklich als
  gebraucht bezeichnete Erzeugnisse) nötig? Ist „Etikett fehlt – Materialangabe nach bestem Wissen“ zulässig? Wird die
  Mandantin durch das Bemalen Herstellerin im Sinne von Art. 15 der Verordnung? *(Angabe immer Pflicht, Option
  „Etikett fehlt“ mit Hinweis)*
- **K-13** Dürfen bemalte Second-Hand-Stücke mit sichtbarem Hersteller-Logo (z. B. Sportmarke auf einer Cap) verkauft
  werden (Erschöpfung, Veränderung der Ware, § 24 Abs. 2 MarkenG)? Darf die Marke in der Beschreibung genannt
  werden? *(Veröffentlichung solcher Stücke gesperrt, keine Markennamen in Texten)*
- **K-14** Genügt „Dekorationsobjekt – nicht für Lebensmittel geeignet“ bei Schalen und Tellern, wenn die Kennzeichnung
  auch am Boden angebracht ist? Wie sind die Konformitätserklärungen bei lebensmittelgeeigneter Keramik online
  bereitzustellen?
- **K-15** Schmuck: Wortlaut des Kleinteile-Warnhinweises; ist die Aussage „nickelfrei (Lieferantennachweis liegt vor)“
  zulässig; weitere Pflichtangaben (Blei, Cadmium)?
- **K-16** GPSR: Gelten die Pflichten für Original-Zeichnungen/Aquarelle, bemalte Fliesen und bemalte
  Second-Hand-Textilien (Gebrauchtware; Herstellerrolle durch Bemalung)? Reicht die Privatadresse als
  Herstelleranschrift? Welche technischen Unterlagen und Kennzeichnungen am Produkt sind für eine Kleinstherstellerin
  nötig? *(Block auf allen Produktseiten, Kennzeichnung aller Stücke)*
- **K-17** Gebrauchtware: Reicht eine Zustandsbeschreibung, oder müssen auch übliche Gebrauchsspuren nach § 476 Abs. 1
  S. 2 BGB gesondert vereinbart werden? Empfehlen Sie eine Verkürzung der Verjährung auf ein Jahr (§ 476 Abs. 2 BGB),
  und wie wäre sie umzusetzen? *(gesonderte Checkbox nur für konkret beschriebene Mängel; keine Verkürzung)*
- **K-18** Umweltaussagen (UWG ab 27.09.2026): Sind sachliche Angaben wie „Second-Hand“, „Vintage“, „gebraucht und neu
  bemalt“ unbedenklich? *(allgemeine Aussagen wie „nachhaltig“ sind gesperrt)*

**D. Gewährleistung und Streit**
- **K-19** Harmonisierte Mitteilung (ab 27.09.2026): Genügt die Platzierung auf Produktseiten, im Warenkorb und auf der
  Versandseite? Gilt sie auch für Gebrauchtware und Kunst? Welche Sprachfassung auf englischen Seiten?
- **K-20** Recht auf Reparatur: Vorlage für die Reklamationsantwort, Hinweise in den AGB, Umgang bei Unikaten
  (Ersatzlieferung unmöglich).
- **K-21** Formulierung des Transportschaden-Hinweises in der Versandmail ohne Rechtsverkürzung.
- **K-22** VSBG: Empfehlen Sie einen freiwilligen Hinweis nach § 36? Wortlaut der Vorlage nach § 37 und Erklärung zur
  Teilnahmebereitschaft. *(„nicht bereit und nicht verpflichtet“)*
- **K-40** Nachweise im Versand: (a) Packfotos sind empfohlen, aber keine Pflicht; bei Keramik fragt das System vor
  dem Versand ohne Foto nach („Ohne Packfoto versenden?“) und protokolliert die Bestätigung. (b) Briefsendungen
  (Zeichnungen, Anhänger) dürfen ohne Sendungsnummer versendet werden; die Versandmail enthält dann keinen
  Verfolgungslink. Reicht das zur Beweissicherung bei Transportschäden (auch gegenüber DHL, § 427 Abs. 1 Nr. 2 HGB),
  beim Zustellnachweis und für den Beginn der Widerrufsfrist, oder empfehlen Sie Pflicht-Packfotos bzw.
  Sendungsnummern für alle Sendungen? *(Rückfrage mit Protokoll bei Keramik; Sendungsnummer Pflicht für Pakete,
  optional für Briefe)*

**E. Preise**
- **K-23** Wortlaut des Kleinunternehmer-Hinweises am Preis, auf Preisschildern mit Sternchen und bei Tattoo-Preisen.

**F. Auftragsarbeiten und Tattoo**
- **K-24** Auftragsarbeiten per E-Mail: Welche Informationen muss das Angebot enthalten? Wann greift der Ausschluss nach
  § 312g Abs. 2 Nr. 1 BGB? Gilt § 356a BGB, wenn der Vertrag nur per E-Mail geschlossen wird? Bitte Vorlage T8.
- **K-25** Anfrageformular: Genügt Art. 6 Abs. 1 lit. b DSGVO (ohne Einwilligungs-Checkbox)? Ist die Löschung 6 Monate
  nach Eingang angemessen? Umgang mit unaufgefordert hochgeladenen Personenfotos.
- **K-26** Tattoo-Termine: Termin und Kaution werden per E-Mail/DM vereinbart. Handelt es sich um Fernabsatzverträge mit
  Widerrufsrecht? Bitte Unterlagen T9 (Belehrung, „vorzeitiger Beginn“, Formulierung Terminkaution) sowie Hinweise zu
  FAQ-Formulierungen (Mindestalter 18, Absagen).
- **K-27** Einwilligung zur Veröffentlichung von Tattoo-Fotos (T10): abgestuft, widerruflich; Umgang mit Fotos, die
  bereits mit Einwilligung für Instagram gezeigt wurden.

**G. Anbieterkennzeichnung**
- **K-28** Impressum: Ist eine Telefonnummer erforderlich (die Mandantin würde eine eigene Geschäftsnummer einrichten)?
  Angabe einer W-IdNr.? Sind Angaben nach § 18 Abs. 2 MStV nötig? Wie ist die Geschäftsbezeichnung aufzunehmen?
- **K-29** Instagram: Genügt der Impressum-Link in der Bio? Sind Datenschutzhinweise für das Profil erforderlich
  (gemeinsame Verantwortlichkeit mit Meta für Statistiken, Art. 26 DSGVO)?
- **K-39** Privatadresse und Ort des Studios: Das Tattoo-Studio liegt in der Wohnung der Mandantin. Nach ihrer
  bisherigen Entscheidung steht die **Privatadresse** im Impressum, als Herstelleranschrift (GPSR) auf jeder
  Produktseite, auf Etiketten und Beilegern, auf Rechnungen und als Rücksendeadresse. Zugleich soll öffentlich nur der
  **Bezirk** des Studios bekannt sein; die Abholadresse wird erst per E-Mail mitgeteilt. Faktisch macht die
  Impressumsadresse den Studio-Ort öffentlich. Bitte beantworten Sie: (a) Muss für § 5 Abs. 1 Nr. 1 DDG, die
  Postanschrift nach Art. 9 Abs. 6 und Art. 19 GPSR und die Widerrufsbelehrung die Wohnanschrift genannt werden, wenn
  die Tätigkeit dort ausgeübt wird, oder genügt eine andere ladungsfähige Anschrift (z. B. angemietete
  Geschäftsadresse, Coworking-Adresse, Anschriften- oder Postservice mit Zustellvollmacht)? Ein Postfach scheidet
  aus. (b) Welche Anforderungen und Risiken hätte eine solche Alternative (Zustellbarkeit, Abmahnrisiko,
  Rücksendungen)? (c) Gibt es weitere Schutzmöglichkeiten für die Wohnanschrift (z. B. Auskunftssperre im
  Melderegister) und helfen sie hier? *(Bis zur Entscheidung der Mandantin: Privatadresse in Impressum, GPSR-Angabe,
  Rechnung, Widerrufsbelehrung und Rücksendeadresse; Tattoo- und Kontaktseiten nennen nur den Bezirk; der Abholort
  steht nur in der Abholmail. Die Entscheidung trifft die Mandantin nach Ihrer Antwort.)*

**H. Datenschutz**
- **K-30** Ist die Architektur in §11.2 ohne Einwilligungsbanner zulässig, insbesondere (a) Vercel Web Analytics
  (JavaScript, Hash aus Anfrage, 24 Stunden, keine Cookies), (b) Stripe-Cookies und Betrugssignale ab Aufruf der
  Kassenseite, (c) Meldung von Browser-Fehlern an einen eigenen Endpunkt (eigener Server, keine Cookies, keine
  Speicherung der IP, keine Personendaten)? *(a und c aus, b an)*
- **K-31** Wortlaut der Einwilligung zur E-Mail-Weitergabe an DHL und des Widerrufshinweises. *(Arbeitsfassung in
  Anlage A §6)*
- **K-32** Rollen und Übermittlungen in der Datenschutzerklärung: Stripe (Auftragsverarbeiter und eigener
  Verantwortlicher), PayPal, Apple/Google Pay, US-Anbieter mit EU-Speicherort (Vercel, Neon, Cloudflare, Sentry).
  Muss DeepL genannt werden, wenn nur eigene Texte ohne Personenbezug übersetzt werden?
- **K-33** Aufbewahrung: Rechnungen 10 Jahre (Wunsch der Mandantin) statt der Mindestfrist von 8 Jahren – zulässig?
  Bestellungen 6 Jahre, stornierte Vorkasse-Bestellungen 6 Jahre (reduziert), Widerrufe 6 Jahre, Monatssicherungen
  12 Monate – angemessen?
- **K-38** Warenkorb ohne Server-Speicher (§11.3): Der Warenkorb liegt nur im Browser – Cookie `pc_cart` mit den
  Nummern der Stücke, dem Preis beim Hinzufügen und der Lieferart, ohne Kennung und ohne personenbezogene Daten, 7 Tage, per Skript lesbar (für
  die Korb-Anzahl auf statisch ausgelieferten Seiten), gesetzt erst beim ersten „In den Korb“. Beim Klick auf „Zur
  Kasse“ kommt `pc_checkout` hinzu: eine zufällige Kassen-Kennung, nicht per Skript lesbar, 1 Stunde, die Reservierung
  und Bezahlvorgang zuordnet. Sind beide Cookies nach § 25 Abs. 2 Nr. 2 TDDDG unbedingt erforderlich und ohne
  Einwilligung zulässig? Halten Sie stattdessen einen **serverseitigen Warenkorb mit zufälliger Warenkorb-ID**
  (HttpOnly-Cookie, Warenkorb in der Datenbank) für nötig oder vorzugswürdig? *(Cookie-Warenkorb wie beschrieben;
  eine Umstellung auf den Server-Warenkorb ist technisch möglich.)*
- **K-41** Technische Schutzmaßnahmen (Art. 25, 32 DSGVO): Die Content-Security-Policy der Website erlaubt nur
  Ressourcen vom eigenen Server (auf der Kasse zusätzlich Stripe). Ziel ist, auch eigene Inline-Skripte nur über
  Prüfsummen bzw. Einmal-Kennungen zuzulassen. Falls das Framework das auf statisch ausgelieferten Seiten oder im
  Verwaltungsbereich der Mandantin nicht erlaubt, würden dort Inline-Skripte generell zugelassen – weiterhin ohne
  jeden fremden Server. Sehen Sie darin ein datenschutzrechtliches Risiko (etwa bei einem Sicherheitsvorfall) oder
  genügt das? *(Rückfall zulässig nur auf statischen öffentlichen Seiten und in der Verwaltung, nur eigene Server;
  Kasse und übrige dynamische Seiten immer mit Einmal-Kennung; Ziel auch für die Verwaltung: Einmal-Kennung)*

**I. Sonstiges**
- **K-34** Beispielbestand und Vorschau: Bestehen Bedenken gegen die interne Nutzung der zwei Tattoo-Fotos von
  Kund:innen (öffentlich auf Instagram) im privaten Repository und in der internen Vorschau-Datei? Brauchen
  passwortgeschützte Vorschau-Umgebungen ein Impressum?
- **K-35** Verpackung (§7): Die Mandantin ist als Erstinverkehrbringerin ihrer befüllten Versandverpackungen
  Herstellerin nach VerpackDG/PPWR; sie registriert sich bei LUCID **und** beteiligt sich mit einer eigenen
  Kleinstlizenz an einem dualen System (entschieden, keine Prüfung erbeten). Bitte nennen Sie nur die Details:
  Mengenmeldungen (Planmenge, Jahresmeldung, Materialarten), Nachweise, Fristen und worauf bei der Wahl des dualen
  Systems zu achten ist. *(Der Shop erfasst Verpackungsmengen je Sendung und liefert einen Jahres-Export nach
  Material.)*
- **K-36** Bestätigen Sie die BFSG-Ausnahme? Ist ein freiwilliger Hinweis zur Barrierefreiheit sinnvoll?
- **K-37** Optional: Bestehen Bedenken gegen die Bezeichnung „Planet Claire“ (Songtitel der B-52's) für Shop und
  Bekleidung? Empfehlen Sie eine Markenrecherche oder -anmeldung?

## 18. Anlagen

| Anlage | Inhalt |
|---|---|
| A | `docs/recht/ANFORDERUNGEN.md` – technische Rechtsanforderungen (R-xxx), Verbotsliste, Textbausteine mit Arbeitsfassungen (§6) |
| B | `docs/recht/DIENSTE.md` – Dienstleister mit Rolle, Sitz, AVV und Drittlandtransfer |
| C | `docs/recht/LOESCHKONZEPT.md` – Speicherfristen, Löschjobs, Verfahren für Betroffenenrechte |
| D | Konzeptseite der Mandantin (auf Wunsch als PDF) |
| E | Nach Fertigstellung: Vorschau-Datei der Website und Bildschirmfotos der Kasse und der Widerrufsfunktion |

Die Anlagen A bis C sind technische Arbeitsdokumente für die Entwicklung. Maßgeblich für Ihre Prüfung sind dieses
Briefing und die dort genannten Arbeitsfassungen; Abweichungen zwischen Briefing und Anlagen bitten wir uns mitzuteilen.

## 19. Entstehung und Änderungsprotokoll

- Grundlage: Interview mit der Mandantin, Entscheidungsliste der Mandantin (`docs/ENTSCHEIDUNGEN.md`), Recherche
  (`docs/research/`), Stand September 2026. Mit „[ergänzt]“ markierte Punkte in Anlage A stammen nicht aus der
  Recherche, sondern wurden beim Zusammenstellen ergänzt (z. B. Telefonnummer in der Widerrufsbelehrung,
  harmonisierte Mitteilung, Umweltaussagen).
- Antworten der Kanzlei werden je Frage (K-xx) in Anlage A, B bzw. C übernommen; die dort genannten vorläufigen
  Umsetzungen werden dann angepasst.

| Datum | Version | Änderung |
|---|---|---|
| 26.09.2026 | 1.0 | Erstfassung |
| 26.09.2026 | 1.1 | Widerrufs-URL `https://planetclairetattoos.com/de/vertrag-widerrufen` (T4, §8, §16.3); Cookie-Liste und Warenkorb ohne Server-Speicher (§11.2, §11.3, §11.4 V2, §11.6) mit neuer Frage K-38; Frage K-39 zu Privatadresse und Studio-Ort (E-40/E-50); Vorkasse-Frist präzisiert (§5.2, §6, K-02); Verpackung nach Entscheidung der Mandantin (§7, K-35); Beispielbestand (§15) |
| 26.09.2026 | 1.2 | Kasse ohne Telefonfeld, Name in einem Feld, Rechnungsadresse per Häkchen (§5.1, §12, §11.4); Bestellung erst nach Zahlung (§5.2); keine Rechnung über den Status-Link (§5.3); Versandnachweise mit neuer Frage K-40 (§7); Verpackung nur noch Detailfragen (§7, K-35); vorläufige Teilwiderrufs-Regel (§8, K-09); Widerruf im Wartungsmodus (§8); Browser-Fehler-Endpunkt (§11.2, K-30 c); CSP mit neuer Frage K-41 (§11.2); Speicherdauern (§11.6); Baustein `withdrawal.returnCostsNote` und abschließende Platzhalterliste (§1.4, §16.3); Kennzeichnung der Fassungen (§16.1) |
| 26.09.2026 | 1.3 | Warenkorb-Cookie mit Preis beim Hinzufügen (§5.1, §11.3, §11.4 V2, K-38); Empfänger-Tabelle wird vom System erzeugt, Platzhalterliste unverändert (§16.3); CSP-Rückfall auch für die Verwaltung (K-41) |

Für Rückfragen steht Ihnen die Mandantin gern zur Verfügung. Vielen Dank für Ihre Unterstützung.

Mit freundlichen Grüßen
[Vorname Nachname]
