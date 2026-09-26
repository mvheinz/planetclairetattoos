# Recherche: Tattoo-Bereich: Best Practices

> Stand 26.09.2026. Automatisch erzeugt aus dem Recherche-Workflow (Websuche mit Quellen). Konfidenz je Befund: high/medium/low. Wo ein Faktencheck vorliegt, steht er am Ende und hat Vorrang. Entscheidungen der Inhaberin stehen in docs/ENTSCHEIDUNGEN.md und haben immer Vorrang vor Empfehlungen hier.

## Zusammenfassung

Der Tattoo-Bereich wird ein eigener Nicht-Shop-Bereich ("Anfragen statt Kaufen"). Er hat sieben Bausteine: Haltung/Über mich, Flash-Bögen mit Status, Arbeiten (frisch/verheilt), Termine & Aktionen (Flash Days, Guest Spots), Anfrage, Ablauf & Preise, Pflege + FAQ. Bewährte Vorbilder (am 26.09.2026 geprüft): Blur Atelier Hamburg mit einem sehr guten Anfrageformular, Atelier Linéa mit einem eigenen "Wanna Do's"-Bereich und "ab"-Preisen, Jessi Cramer (Illustration + Tattoo + Shop auf einer Seite).

Rechtlich am wichtigsten:
- **Fernabsatz:** Wer per Website, Instagram, WhatsApp oder E-Mail bucht und eine Anzahlung leistet, schließt in der Regel einen Fernabsatzvertrag (§ 312c BGB). Dafür gilt das 14-tägige Widerrufsrecht. Laut tattoo-recht.de hat das AG Dresden (17.04.2026, 116 C 5571/25) ein Studio zur Rückzahlung von 310 € verurteilt.
- **Anzahlung:** Eine Anzahlung darf nicht einfach verfallen. Anwälte empfehlen eine individuell vereinbarte Terminkaution statt AGB-Klauseln.
- **Widerrufsbutton:** § 356a BGB (elektronischer "Vertrag widerrufen"-Button) gilt, sobald Anzahlungen über die Website abgeschlossen werden.
- **Gesundheitsdaten:** Sie gehören NICHT ins Anfrageformular (Art. 9 DSGVO).
- **Farben:** Laut REACH Anhang XVII Nr. 75 muss die Tätowiererin den Kunden vor dem Stechen die Etiketten-Angaben der Farbe geben.
- **Aufbewahrung:** Eine gesetzliche 10-Jahres-Pflicht für Einwilligungen habe ich nicht belegen können. Die Berliner Infektionsverhütungs-VO 2017 verlangt nur 5 Jahre für Sterilisator-Nachweise.

Meine Empfehlung für den Start: ein mehrstufiges Anfrageformular ohne Gesundheitsfragen. Spamschutz über Honeypot, Mindest-Ausfüllzeit, Rate-Limit und ALTCHA (MIT-Lizenz, ohne Cookies, selbst gehostet). Anzahlungen zuerst manuell per Zahlungslink und erst später integriert über Stripe. Einwilligungserklärung auf Papier oder Tablet im Studio, nicht in der Website-Datenbank. Dazu ein Löschkonzept je Anfrage-Status, ein Schalter "Books open/closed" und eine mobiltaugliche Flash-Verwaltung (Status mit 2 Taps).

Nicht prüfen konnte ich:
- den Volltext des AG-Dresden-Urteils,
- das genaue Anwendungsdatum der EU-Widerrufsbutton-Richtlinie,
- Berliner Preisniveaus,
- die Rechtslage bei Minderjährigen,
- die Website von Mira Mariah.
Grund: Das WebSearch-Budget der Session war aufgebraucht bzw. Seiten waren nicht erreichbar.

## Befunde

### Best Practices 2025/2026 für Tattoo-Websites `[medium]`

Branchenquellen (Dez. 2025 / März 2026) sind sich weitgehend einig:
- Portfolio nach Stil sortieren, nicht nach Datum.
- Ein 'Healed'-Filter schafft Vertrauen.
- Die Anfrage ist höchstens 2 Klicks entfernt, der Anfrage-Button ist auf jeder Seite sichtbar.
- Mobile-first: an 375 px Breite testen.
- Anzahlungs- und Absageregeln stehen vorab offen da.
- Instagram dient der Entdeckung, die eigene Domain ist das 'Zuhause'.
- Gesundheitsinfos und Kundenfotos sind besonders zu schützen.
- 'Eine Seite, die wie jede Startup-Landingpage aussieht, sagt nichts über dich.' Das passt zu 'verträumt-progressiv'.

**Auswirkung:** Grundlage für die Seitenstruktur. Es sind Branchenblogs (keine Studien), daher Tendenz statt harter Belege.

Quellen:
- https://tattoostudiopro.com/best-tattoo-artist-websites-get-bookings/
- https://tattoostudiopro.com/portfolio-websites-for-tattoo-artists/
- https://useapprentice.com/blog/best-practices-for-tattoo-shop-websites-in-2026-a-comprehensive-guide

### Geprüfte Vorbild-Websites (abgerufen 26.09.2026) `[high]`

1. **Blur Atelier Hamburg** (Fine Line, 'Safe Space'), bluratelier.com + bookings.bluratelier.com. Bestes Formular-Vorbild:
   - Pflichtfelder: Art des Vorhabens, Idee, Körperstelle, ungefähre Größe, Name, E-Mail, Altersbestätigung, Datenschutz.
   - Optional: Stil, bis zu 5 Referenzbilder, erstes Tattoo?, erster Besuch?, Anreise, Wunschtermine, Budget, WhatsApp, Sprache.
   - Kommunizierter 3-Schritte-Ablauf; ausdrücklich keine Anzahlung in diesem Schritt.
   - 18+-Checkbox: 'am Tag des Termins mindestens 18'.
2. **Jessi Cramer**, jcramertattoos.com (illustratives Blackwork/Fine Line, Pittsburgh). Hybrid wie Jutta: Portfolio in Custom / Flash / 'Drawn On' / Antique / Illustration, dazu ein Shop, FAQ und Pflege im Menü 'Info'.
3. **Atelier Linéa** (Deggendorf, Fine Line), linea-tattoostudio.de. Eigener Bereich 'Wanna Do's' (fertige, teils einmalige Motive), Preise 'ab ca. 80 €', ausführliche Pflegeanleitung, Buchung über Shore.
4. **Tattoo Anansi München**, tattooanansi.de/en/faq-2. Gut gegliederte FAQ, 18+ auch mit Elternerlaubnis, 'Flash ist nicht uncool'.
5. **Bang Bang NYC**, bangbangforever.com. Klar benannter Mindestpreis (500 $), 25 % Anzahlung, Vorbereitungstipps (z. B. 24 h kein Alkohol).

Nicht verifiziert: girlknewyork.com (Mira Mariah; SSL-Fehler), aka-berlin.com (Domain nicht auflösbar). Weitere Beispiel-Sammlungen: createtoday.io und tattoostudiopro.com.

**Auswirkung:** Konkrete Vorlagen für Formular, Flash-Präsentation und FAQ. Achtung: Anansi und Bang Bang nennen die Anzahlung 'nicht erstattbar'. Das ist in Deutschland rechtlich riskant (siehe unten), also NICHT übernehmen.

Quellen:
- https://www.bluratelier.com/
- https://bookings.bluratelier.com/
- https://www.jcramertattoos.com/
- https://linea-tattoostudio.de/
- https://www.tattooanansi.de/en/faq-2
- https://www.bangbangforever.com/
- https://createtoday.io/examples?category=tattoo

### Flash-Status und 'Wanna-do' `[medium]`

Für Flash-Status gibt es keinen Standard. Der Begriff 'Wanna Do's' wird im deutschen Markt aber aktiv genutzt (Linéa). Instagram-Highlights von Jutta ('Flash:)', 'one offs', 'healed') zeigen ihre eigene Logik.

Sinnvolles Status-Set:
- verfügbar
- reserviert (angefragt, mit Ablaufdatum)
- vergeben (One-off gestochen; bleibt sichtbar mit handgezeichnetem 'VERGEBEN'-Stempel, verlinkt aufs Foto)
- wiederholbar
- Wanna-do (Idee, bei der sie freier arbeiten darf)
- nur am Flash Day
- archiviert (versteckt)

**Auswirkung:** Bestimmt das Datenmodell und die mobile Bedienung. Vergebene One-offs sichtbar zu lassen, belegt die Exklusivität und passt zum 'one offs'-Highlight.

Quellen:
- https://linea-tattoostudio.de/

### Fernabsatz und Widerrufsrecht bei Tattoo-Buchungen `[medium]`

**Gesetzeslage:**
- § 312c BGB: Fernabsatz liegt vor, wenn Verhandlung UND Vertragsschluss ausschließlich über Fernkommunikationsmittel laufen (E-Mail, SMS, digitale Dienste).
- § 312g Abs. 1 BGB: Dann besteht ein Widerrufsrecht. Die Ausnahme Nr. 9 (Freizeit-Dienstleistungen mit festem Termin) umfasst Tattoos nach dem Wortlaut nicht erkennbar.
- § 356 BGB: Die Frist beginnt erst mit ordnungsgemäßer Belehrung. Ohne Belehrung erlischt das Recht spätestens nach 12 Monaten und 14 Tagen.
- Bei Dienstleistungen erlischt das Recht erst mit vollständiger Erbringung, und nur wenn der Kunde den vorzeitigen Beginn ausdrücklich verlangt und bestätigt hat, dass er sein Widerrufsrecht verliert.
- § 357a Abs. 2 BGB: Wertersatz (z. B. für einen Entwurf) gibt es nur bei ausdrücklichem Verlangen UND ordnungsgemäßer Belehrung.

**Urteil:** tattoo-recht.de berichtet vom AG Dresden, Urteil vom 17.04.2026, Az. 116 C 5571/25. Termin rein über WhatsApp, 310 € Anzahlung, Widerruf vor dem Termin: Das Studio musste 310 € plus Zinsen zurückzahlen, ohne Wertersatz für Planung oder Beratung. Den Volltext konnte ich nicht einsehen (Seite HTTP 500).

**Rechtsprechungsloses Detail:** Die Absatznummerierung von § 356 ist 2026 verschoben (beim Abruf: Abs. 4 = 12-Monats-Grenze, Abs. 5 = Dienstleistungen).

**Auswirkung:** Wenn Jutta Termine und Anzahlungen online oder per DM fix macht, braucht sie eine Widerrufsbelehrung, das Muster-Widerrufsformular und eine Checkbox bzw. Textbaustein 'Beginn vor Fristablauf gewünscht'. Sonst droht die Rückzahlung. Die Gesetzestexte sind sicher (high); ihre Anwendung auf Tattoos und das Urteil sind medium.

Quellen:
- https://www.gesetze-im-internet.de/bgb/__312c.html
- https://www.gesetze-im-internet.de/bgb/__312g.html
- https://www.gesetze-im-internet.de/bgb/__356.html
- https://www.gesetze-im-internet.de/bgb/__357a.html
- https://tattoo-recht.de/tattoo-per-whatsapp-gebucht-und-dann-widerrufen-das-geht/

### Anzahlung vs. Terminkaution `[medium]`

**Anwaltliche Einordnung (KKP.LAW, RA Christian Koch):**
- Eine Anzahlung ist eine Teilzahlung auf den Werklohn und kann nicht 'verfallen'.
- Der Kunde kann nach § 648 BGB jederzeit kündigen. Die Tätowiererin behält dann die Vergütung minus Ersparnis bzw. anderweitigem Erwerb; gesetzlich vermutet werden 5 % des offenen Teils.
- Vorab-Beträge sollen individuell ausgehandelt werden und 'gehören niemals in die AGB'.
- Empfehlung: Terminkaution (Sicherheit gegen No-Show, bleibt Kundengeld, Verfall bei No-Show vereinbar).

**Steuer (kisscal-Artikel von 2019):** Eine Anzahlung löst sofort Umsatzsteuer und Einkommensteuer aus, eine Kaution nicht. Für Jutta nur relevant, wenn sie keine Kleinunternehmerin nach § 19 UStG ist. Grenzen aktuell: 25.000 € Vorjahr / 100.000 € laufendes Jahr.

**Gegenbeispiel:** Die AGB von Linéa (Stand 07/2025) regeln Anzahlung, Staffel-Erstattung und unbeschränkte Foto-Rechte per AGB. Das ist verbreitete Praxis, nach obiger Einordnung aber angreifbar.

**Auswirkung:** Entscheidung für Jutta nötig: Terminkaution individuell per E-Mail vereinbaren, statt AGB-Klausel 'Anzahlung nicht erstattbar'. Steuerberater und Anwalt sollten das kurz prüfen.

Quellen:
- https://www.kkp.law/aktuelles/news/tattoorecht-anzahlung-oder-terminkaution/
- https://kisscal.tattoo/der-glaubenskrieg-anzahlung-oder-terminkaution/
- https://www.gesetze-im-internet.de/bgb/__648.html
- https://www.gesetze-im-internet.de/ustg_1980/__19.html
- https://linea-tattoostudio.de/wp-content/uploads/2025/07/AGB-fuer-E-Mail-und-Druckversion-1.pdf

### Elektronische Widerrufsfunktion (§ 356a BGB) `[high]`

§ 356a BGB ist in Kraft ('Elektronische Widerrufsfunktion bei Fernabsatzverträgen'). Wird ein Vertrag über eine Online-Benutzeroberfläche geschlossen, braucht es eine gut lesbare Funktion 'Vertrag widerrufen' o. ä. Sie muss während der Widerrufsfrist ständig verfügbar, hervorgehoben und leicht zugänglich sein. Abgefragt bzw. bestätigt werden Name, Vertragsidentifikation und der Kanal für die Eingangsbestätigung.

Grundlage ist die EU-Richtlinie 2023/2673. Das Anwendungsdatum (nach meinem Kenntnisstand 19.06.2026) konnte ich über EUR-Lex nicht verifizieren (Seite leer).

**Auswirkung:** Betrifft den Shop ohnehin. Für Tattoos wird es relevant, sobald Anzahlung/Kaution über ein Website-Checkout abgeschlossen wird: Dann den Widerrufsbutton des Shops wiederverwenden.

Quellen:
- https://www.gesetze-im-internet.de/bgb/__356a.html

### Gesundheitsdaten und Körperfotos (DSGVO) `[medium]`

- Gesundheitsangaben aus dem Einwilligungsbogen (Vorerkrankungen, Medikamente, Schwangerschaft) sind besondere Kategorien nach Art. 9 DSGVO.
- Viele Muster stützen sich auf Art. 9 Abs. 2 lit. h DSGVO + § 22 Abs. 1 Nr. 1 lit. b BDSG. § 22 verlangt aber Verarbeitung durch 'ärztliches Personal' oder Personen mit entsprechender Geheimhaltungspflicht. Für Tätowierer:innen ist das zweifelhaft (meine Einschätzung). Sicherer: ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a) und für die Aufbewahrung zur Rechtsverteidigung lit. f.
- Fotos sind nicht per se biometrisch (Erwägungsgrund 51). Hautfotos können aber Gesundheitsinfos zeigen (Narben, Hauterkrankungen).
- Laut EuGH C-252/21 gelten auch ungefragt übermittelte sensible Daten als verarbeitet (Einordnung datenschutzbeauftragter-hamburg.de, 25.03.2024).

**Folgerung:** Keine Gesundheitsfragen im Web-Formular, ein Hinweistext 'bitte keine Gesundheitsinfos', Körperstellen-Foto nur optional und privat speichern, kurze Löschfristen.

**Auswirkung:** Die Anfrage läuft über Art. 6 Abs. 1 lit. b DSGVO (vorvertraglich) ohne Einwilligungs-Checkbox; ein Datenschutz-Hinweis reicht. Gesundheitsdaten nur im Einwilligungsbogen vor Ort.

Quellen:
- https://www.gesetze-im-internet.de/bdsg_2018/__22.html
- https://dsgvo-gesetz.de/erwaegungsgruende/nr-51/
- https://datenschutzbeauftragter-hamburg.de/2024/03/aufgezwungene-besondere-kategorien-personbezogener-daten/
- https://www.tattoosafe.org/einwilligungserklaerung-dsgvo-konform

### Aufbewahrung und Löschung `[high]`

- **Keine gesetzliche 10-Jahres-Pflicht gefunden.** Die Berliner Infektionsverhütungs-Verordnung vom 05.05.2017 gilt ausdrücklich fürs Tätowieren. Sie verlangt einen Hygieneplan und 5 Jahre Aufbewahrung der Sterilisator-Prüfnachweise, aber keine Kundendokumentation. Muster-Einwilligungen behaupten zum Teil eine gesetzliche 10-Jahres-Pflicht; das konnte ich nicht belegen.
- **Verjährung:** regelmäßig 3 Jahre ab Jahresende und Kenntnis (§§ 195, 199 Abs. 1 BGB). Bei Körper- oder Gesundheitsschäden höchstens 30 Jahre ab dem Ereignis (§ 199 Abs. 2 BGB). Das spricht für eine bewusst dokumentierte Frist für Einwilligungen (üblich: 10 Jahre).
- **Steuer (§ 147 AO):** Buchungsbelege/Rechnungen 8 Jahre, Handels-/Geschäftsbriefe 6 Jahre, Bücher 10 Jahre, jeweils ab Jahresende.

**Auswirkung:** Das Löschkonzept wird statusbasiert automatisiert. Die Frist für Einwilligungsbögen ist eine Entscheidung mit Anwalt.

Quellen:
- https://www.parlament-berlin.de/ados/18/IIIPlen/vorgang/verordnungen/vo18-047.pdf
- https://www.gesetze-im-internet.de/bgb/__199.html
- https://www.gesetze-im-internet.de/ao_1977/__147.html

### Farben: Informationspflicht nach REACH `[high]`

Verordnung (EU) 2020/2081 (REACH Anhang XVII Nr. 75, gilt seit 04.01.2022; Pigment Blue 15:3 / Green 7 seit 04.01.2023): Vor dem Tätowieren muss die Person, die die Farbe verwendet, dem Kunden die Angaben vom Etikett bzw. aus der Gebrauchsanweisung zur Verfügung stellen. Dazu gehören Chargennummer, Inhaltsstoffe und gegebenenfalls 'Enthält Nickel/Chrom(VI)'.

Das BfR empfiehlt Kunden, die Inhaltsstoffliste zu lesen und Farben im EU-Schnellwarnsystem Safety Gate zu prüfen.

**Auswirkung:** Sinnvoll ist ein Farb-/Chargen-Katalog im Backoffice (Marke, Farbton, Charge, Etikettfoto) und die Verknüpfung mit der Sitzung. Der Kunde bekommt die Angaben ausgedruckt oder per Link. Das ist wenig bekannt und ein Qualitätsmerkmal.

Quellen:
- https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32020R2081
- https://www.bfr.bund.de/assets/01_Ver%C3%B6ffentlichungen/FAQ_englisch/questions-and-answers-about-tattoo-inks.pdf

### Hygiene und Erwartungen der Berliner Gesundheitsämter `[high]`

- Es gibt keinen Berufszugang (WD Bundestag 2018). Gesundheitsämter können Tätowierbetriebe überwachen (§ 36 Abs. 2 IfSG).
- In Berlin gilt die Infektionsverhütungs-VO 2017: sterile Arbeitsgeräte, Hygieneplan, VAH-gelistete Desinfektionsmittel, Nachweise für Sterilisatoren. Ob sie seitdem geändert wurde, habe ich nicht geprüft.
- Checkliste des Gesundheitsamts Neukölln für Kunden (Stand 2015): ausführliche Risiko-Aufklärung, schriftliche Nachsorgeanweisung zum Mitgeben, Haftpflichtversicherung für Gesundheitsschäden.
- DIN EN 17169:2020-05 (nicht verbindlich; das BfR empfiehlt Studios, die sie befolgen) beschreibt u. a. Pflegeinformationen für Kunden.

**Auswirkung:** Seiten 'Studio & Hygiene' und 'Pflege' mit PDF-Download. Wenn zutreffend, darf die Seite erwähnen, dass Jutta nach DIN EN 17169 arbeitet und haftpflichtversichert ist. Das schafft Vertrauen.

Quellen:
- https://www.bundestag.de/resource/blob/592496/761cf0d47a67e0b22b71624903e52757/WD-9-066-18-pdf-data.pdf
- https://www.berlin.de/ba-neukoelln/politik-und-verwaltung/aemter/gesundheitsamt/hygiene-und-umweltmedizin/tattoo-und-piercing.pdf
- https://www.bfr.bund.de/assets/01_Ver%C3%B6ffentlichungen/FAQ_englisch/questions-and-answers-about-tattoo-inks.pdf

### Inhalte für Pflegeseite und FAQ (amtliche Quellen) `[high]`

**BfR-FAQ (06.05.2025):**
- Tätowierte Haut ist oft lichtempfindlich, deshalb Sonnenschutz.
- In Schwangerschaft und Stillzeit wird Tätowieren nicht empfohlen.
- Infektionen sind möglich (Bakterien, Viren, Pilze).
- Laser-Entfernung dürfen seit 31.12.2020 nur Ärzt:innen mit Fachkunde vornehmen (NiSV).

**Bundesumweltministerium, 'Safer Tattoo':** 4 PDF-Checklisten (Studiowahl, Vorbereitung, erste Tage/Wochen, Langzeitpflege); die frühere Adresse bmuv.de/safer-tattoo leitet dorthin um.

**Praxisbeispiel Linéa:** Salbe 2–3× täglich für 2–3 Wochen, kein Schwimmbad oder Sauna, 4+ Wochen keine Sonne, volle Heilung bis ca. 6 Wochen.

**Auswirkung:** Die Pflegeseite verlinkt auf Safer Tattoo. Jutta schreibt ihre eigene Methode (Folie / Second Skin) in Phasen auf, plus 'Warnzeichen: wann zum Arzt'.

Quellen:
- https://www.bfr.bund.de/assets/01_Ver%C3%B6ffentlichungen/FAQ_englisch/questions-and-answers-about-tattoo-inks.pdf
- https://www.bundesumweltministerium.de/safer-tattoo
- https://linea-tattoostudio.de/

### Kundenfotos im Portfolio (KUG und DSGVO) `[medium]`

Nach § 22 KUG dürfen Bildnisse nur mit Einwilligung verbreitet werden. Bei Körperfotos ohne Gesicht greift zusätzlich die DSGVO, sobald die Person erkennbar ist (Tattoo, Muttermale, Social-Media-Tag).

Viele Studios lassen sich Foto-Rechte per AGB pauschal einräumen (z. B. Linéa: 'unbeschränktes Veröffentlichungsrecht'). Eine separate, freiwillige, abgestufte und widerrufbare Einwilligung ist rechtssicherer (meine Einschätzung):
- nur Tattoo / mit Gesicht / nein
- @Handle nennen ja/nein

**Auswirkung:** Im CMS: Ein Portfolio-Foto lässt sich nur veröffentlichen, wenn eine passende Einwilligung verknüpft ist. Bei Widerruf wird es mit einem Klick depubliziert.

Quellen:
- https://www.gesetze-im-internet.de/kunsturhg/__22.html
- https://bebrave-tattoo.de/einwilligung-zur-lichtbildverwendung/
- https://linea-tattoostudio.de/wp-content/uploads/2025/07/AGB-fuer-E-Mail-und-Druckversion-1.pdf

### Spamschutz ohne Google reCAPTCHA `[high]`

**ALTCHA:**
- Open-Source-Widget, MIT-Lizenz, dauerhaft kostenlos, unsichtbarer Proof-of-Work.
- Laut Anbieter keine Cookies und keine personenbezogenen Daten, WCAG 2.2 AA, 50+ Sprachen.
- Bezahlt: Cloud ab 47 €/Monat, Sentinel (auch Self-Hosting) ab 99 €/Monat.

**Friendly Captcha:**
- Deutsches Unternehmen, ohne Cookies.
- Kostenlos nur für nicht-kommerzielle Nutzung (1 Domain, 1.000 Anfragen/Monat).
- Starter 9 €/Monat, Growth 39 €/Monat. Rechenzentren nur-EU erst ab Advanced (200 €/Monat).

**Cloudflare Turnstile:**
- Kostenlos, unbegrenzte Anfragen, 20 Widgets, auch ohne Cloudflare-Proxy nutzbar.
- Verarbeitet IP, TLS-Fingerprint und User-Agent; setzt laut Privacy Policy (18.06.2025) Cookies als 'strictly necessary'.
- US-Anbieter: Die Transfergrundlage (DPF) habe ich nicht geprüft.

**Honeypot + Mindest-Ausfüllzeit + Rate-Limit:** kostenlos, keine Dritten, als erste Stufe immer sinnvoll.

**Auswirkung:** Empfehlung: Honeypot + Zeitfalle + Rate-Limit + selbst gehostetes ALTCHA. Kein Drittanbieter, kein Consent-Banner nötig. Die DSGVO-Bewertung von Turnstile ist medium.

Quellen:
- https://altcha.org/
- https://friendlycaptcha.com/
- https://developers.cloudflare.com/turnstile/plans/
- https://www.cloudflare.com/turnstile-privacy-policy/

### Kalender- und Buchungstools, Online-Zahlung `[high]`

**Cal.com:** kostenlos für Einzelpersonen, US- und EU-Hosting, Stripe/PayPal-Zahlung bei der Buchung, Open Source (selbst hostbar).

**kisscal (tattoo-spezifisch, deutsch):**
- Studio-Verwaltung, Online-Buchung mit Zahlung, KI-gestützte Anfragen.
- Digitale Einwilligung 'kissSign' (laut Anbieter eIDAS-zertifiziert).
- 'Sorglospaket' mit Verträgen und Pflegeanleitungen.
- Preise nicht öffentlich.

**Shore:** wird von Linéa genutzt (nicht näher geprüft).

**Stripe Deutschland:** EWR-Standardkarten 1,5 % + 0,25 €, Premium-Karten 2,8 % + 0,25 €, SEPA-Lastschrift 0,35 €, Payment Links ohne Zusatzgebühr.

**Praxis:** Bei Custom-Tattoos gibt es fast nie Selbstbuchung. Stattdessen Anfrage → Vorschlag mit Terminoptionen → Kaution. Slot-Buchung lohnt sich höchstens für Flash Days.

**Auswirkung:** Für den Start kein externes Buchungstool: eigenes Formular + CMS-Inbox + E-Mail-Vorlagen. Cal.com optional für Flash-Day-Slots. kisscal/kissSign als Option für digitale Einwilligungen später prüfen.

Quellen:
- https://cal.com/pricing
- https://kisscal.tattoo/
- https://stripe.com/de/pricing
- https://linea-tattoostudio.de/

### Preiskommunikation `[medium]`

- **§ 3 PAngV:** Wer Verbrauchern Leistungen unter Angabe von Preisen anbietet oder damit wirbt, muss Gesamtpreise angeben. Als Kleinunternehmerin kommt der Hinweis 'gem. § 19 UStG keine USt' dazu.
- **Praxisbeispiele:** Linéa 'ab ca. 80 €' (Fine Line, Kleinstadt), Bang Bang Mindestpreis 500 $ (NYC), Anansi ganz ohne Preisliste.
- **Üblich:** Mindestpreis, fester Preis je Flash, Custom 'nach Entwurf' mit Richtwert Stunden- oder Tagessatz.
- 'Ab'-Preise sind nach meiner Kenntnis zulässig, wenn der Einstiegspreis real erhältlich ist (nicht mit Quelle verifiziert).
- Berliner Preisniveaus 2026 konnte ich nicht belegen.

**Auswirkung:** Jutta muss Zahlen festlegen. Das CMS braucht Felder für Mindestpreis, Stundensatz, Tagessatz und den Preistyp je Flash (fest / ab / auf Anfrage).

Quellen:
- https://www.gesetze-im-internet.de/pangv_2022/__3.html
- https://www.gesetze-im-internet.de/ustg_1980/__19.html
- https://linea-tattoostudio.de/
- https://www.bangbangforever.com/
- https://www.tattooanansi.de/en/faq-2

### Mindestalter `[medium]`

- **Praxis:** strikt 18+ (Linéa per AGB; Anansi auch nicht mit Elternerlaubnis; Blur Atelier mit Pflicht-Checkbox 'am Termintag 18').
- Für Tätowierer:innen gibt es keinen Berufszugang und keine eigene Altersregel im Hygienerecht (WD Bundestag, Berliner VO).
- Die zivil- und strafrechtliche Lage bei Minderjährigen (Einwilligungsfähigkeit, Eltern) konnte ich nicht mit Primärquelle verifizieren (Suchbudget erschöpft).

**Auswirkung:** Empfehlung: 18+ als feste Regel, Ausweis beim Termin nur ansehen (nicht kopieren), Checkbox im Formular.

Quellen:
- https://bookings.bluratelier.com/
- https://www.tattooanansi.de/en/faq-2
- https://linea-tattoostudio.de/wp-content/uploads/2025/07/AGB-fuer-E-Mail-und-Druckversion-1.pdf

### Instagram-Einbindung `[medium]`

Instagram-Posts nicht per Meta-Embed oder Feed-Widget einbinden: Dabei werden Daten an Meta übertragen. Nach EuGH C-40/17 'Fashion ID' (29.07.2019) ist der Websitebetreiber für eingebettete Social-Plugins gemeinsam verantwortlich. Das zitiere ich aus dem Gedächtnis; im Volltext in dieser Session nicht geprüft.

Besser: eigene Bilder im CMS und nur ein Link zum Profil.

**Auswirkung:** Kein Consent-Banner nur wegen Instagram. Dazu schnellere Ladezeiten und volle Kontrolle über die Bildauswahl.

Quellen:
- https://curia.europa.eu/juris/liste.jsf?num=C-40/17

## Empfehlungen

- **Tattoo-Bereich ('Tattoo-Planet') mit dieser Struktur anlegen, zweisprachig DE/EN:
- /tattoo (Hub: Haltung, Stil Fine Line/Blackwork, naiv-humorvoll, was ich gern / nicht steche, Coco als Guide)
- /tattoo/flash (Flash-Bögen mit Status-Filter)
- /tattoo/arbeiten (Portfolio mit Umschalter frisch ↔ verheilt, 'X Jahre verheilt'-Badge, Vorher/Nachher-Slider)
- /tattoo/termine (Flash Days, Specials, Guest Spots)
- /tattoo/anfrage
- /tattoo/ablauf-preise (5 Schritte, Mindestpreis, Kaution, Absage)
- /tattoo/pflege (plus PDF)
- /tattoo/faq
- /tattoo/studio (Ort, Anfahrt, Barrierefreiheit, Hygiene, Coco-Hinweis für Allergiker)**  
  _BegrÃ¼ndung:_ Deckt alle Kernbausteine der Vorbilder ab und hält die Anfrage in höchstens 2 Klicks erreichbar. Frisch/verheilt spiegelt Juttas vorhandene Instagram-Highlights ('healed', '3.5 years healed').

- **Tattoo-Bereich strikt vom Shop trennen:
- nirgends 'In den Warenkorb', stattdessen immer 'Diesen Flash anfragen' bzw. 'Idee anfragen'
- Tattoo-Objekte nie im Warenkorb oder Checkout
- erlaubte Querverweise: Flash als Print/Merch im Shop verlinken**  
  _BegrÃ¼ndung:_ Entspricht der Vorgabe 'nicht kaufbar'. Außerdem entsteht so kein Online-Vertragsschluss über Tattoos mit den Pflichten aus Widerruf und § 356a.

- **Flash-Status-Set einführen: verfügbar / reserviert (mit 'reserviert bis', Standard 72 h, danach automatisch zurück auf verfügbar) / vergeben / wiederholbar / Wanna-do / nur Flash Day / archiviert.
- Vergebene One-offs bleiben sichtbar mit handgezeichnetem 'VERGEBEN'-Stempel und Link zum Foto des gestochenen Tattoos.
- Eine Anfrage reserviert NICHT automatisch (Spam-Schutz): Jutta tippt in der Anfrage auf 'reservieren'.**  
  _BegrÃ¼ndung:_ Transparenz für Kundinnen, Exklusivität der One-offs und kein Blockieren durch Fake-Anfragen.

- **'Angebote' als hübsche Aktionskarten gestalten:
- Flash Day: handgeschriebenes Datums-Badge, Ort, Ablauf (first come / Slots), Gesamtpreis je Motiv, Karussell der Flash-Auswahl, Button
- Guest Spot: Stadt, Studio mit Link, Zeitraum, Status 'Anfragen offen / ausgebucht', Button öffnet das vorausgefüllte Anfrageformular
- Vergangene Aktionen wandern ins Archiv 'war schön' mit Fotos**  
  _BegrÃ¼ndung:_ Macht Angebote sichtbar, ohne sie kaufbar zu machen, und spielt die Planeten-/Orbit-Idee der Navigation aus.

- **Ablauf 'Vorschlag zuerst': Anfrage (ohne Zahlung) → Vorschlag per E-Mail (Richtung, Preis/Preisrahmen, Terminoptionen) → Annahme → Terminkaution → Bestätigung.

Für den Start zahlt man die Kaution manuell per Überweisung, PayPal oder Stripe Payment Link aus der Admin-Anfrage. Das integrierte Stripe-Checkout (gleicher Widerrufsbutton wie im Shop) kommt in einer späteren Phase.**  
  _BegrÃ¼ndung:_ So arbeitet Blur Atelier ('keine Anzahlung in diesem Schritt'). Das verringert Streit, und bei geringen Stückzahlen lohnt sich eine Online-Zahlung für den Start nicht. Stripe-Gebühren liegen bei 1,5 % + 0,25 €.

- **Kaution als individuell per E-Mail vereinbarte Terminkaution regeln, nicht als AGB-Klausel 'Anzahlung nicht erstattbar'.

Die Vorschlags-E-Mail enthält immer:
- Widerrufsbelehrung + Muster-Widerrufsformular
- den Satz 'Ich verlange ausdrücklich, dass du vor Ablauf der Widerrufsfrist mit dem Entwurf/Termin beginnst, und weiß, dass mein Widerrufsrecht bei vollständiger Erbringung erlischt' (Antwort 'Ja' genügt als Textform-Nachweis)

Vor Livegang anwaltlich prüfen lassen (Tattoo-Recht).**  
  _BegrÃ¼ndung:_ §§ 312c, 312g, 356, 357a BGB; AG Dresden 17.04.2026 laut tattoo-recht.de; Empfehlung von KKP.LAW.

- **Keine Gesundheitsdaten im Web-Formular. Hinweistext am Freitextfeld: 'Bitte keine Gesundheitsinfos – das klären wir persönlich vor dem Termin.'

Die Einwilligungserklärung für den Start auf Papier oder PDF-Tablet im Studio. Rechtsgrundlage für Gesundheitsangaben: ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO (nicht lit. h + § 22 BDSG). Digitale Lösung (z. B. kisscal kissSign) als eigene spätere Phase.**  
  _BegrÃ¼ndung:_ Hält die Website-Datenbank frei von besonders sensiblen Daten und damit das Risiko und den Sicherheitsaufwand klein.

- **Inhalt des Einwilligungsbogens festlegen:
- Name, Geburtsdatum (18+), 'Ausweis gesehen' (vom Artist abgehakt, keine Kopie)
- kurzer Gesundheits-Check nach Ja/Nein, Details nur bei Ja
- Aufklärung über Risiken nach BfR: Infektion, Allergie, Narben, Sonne, Dauerhaftigkeit, Entfernung nur ärztlich (NiSV); Schwangerschaft/Stillzeit ausschließen
- Farbangaben nach REACH (Marke, Farbton, Charge)
- Freigabe von Stencil und Platzierung, Pflegeanleitung erhalten
- separate, abgestufte Foto-Einwilligung (nur Tattoo / mit Gesicht / nein; @Handle ja/nein)
- Datum und Unterschrift, versionierter Formularstand**  
  _BegrÃ¼ndung:_ Deckt die Aufklärung, REACH Anhang XVII Nr. 75 und § 22 KUG ab, dazu die Nachweispflicht für Einwilligungen (Art. 7 Abs. 1 DSGVO).

- **Löschkonzept automatisieren (täglicher Job):
- Anfragen mit Status abgelehnt / keine Antwort / zurückgezogen: 90 Tage nach dem letzten Kontakt vollständig löschen, inklusive Bildern
- gebuchte Projekte: Referenzbilder 12 Monate nach der letzten Sitzung löschen (Nachstech-Fenster), danach nur noch minimaler Kundendatensatz
- Einwilligungsbögen: 10 Jahre ab Jahresende, getrennt oder verschlüsselt bzw. offline (Frist anwaltlich bestätigen)
- Rechnungen und Buchungsbelege: 8 Jahre (§ 147 AO)
- Rate-Limit-Logs: gehashte IP, 7 Tage
- Portfolio-Fotos: bis zum Widerruf**  
  _BegrÃ¼ndung:_ Speicherbegrenzung (Art. 5 Abs. 1 lit. e DSGVO) ist mit Verjährung (§ 199 BGB) und steuerlichen Fristen abgestimmt. Eine gesetzliche 10-Jahres-Pflicht ist nicht belegt, die 10 Jahre sind also eine bewusste Entscheidung.

- **Spamschutz in Schichten:
1. Honeypot-Feld
2. Mindest-Ausfüllzeit 3 s
3. Rate-Limit (z. B. 5 Anfragen pro IP-Hash und Stunde)
4. selbst gehostetes ALTCHA-Widget (MIT)

Kein reCAPTCHA, kein Turnstile (Standard). Fallback bei Bedarf: Friendly Captcha Starter (9 €/Monat).**  
  _BegrÃ¼ndung:_ Kostenlos, ohne Cookies und Drittanbieter, barrierearm (laut Anbieter WCAG 2.2 AA) und ohne Consent-Banner.

- **Bild-Uploads sicher gestalten:
- max. 5 Bilder à 10 MB; JPG/PNG/WebP/HEIC
- serverseitig neu kodieren (WebP/AVIF), EXIF/GPS entfernen
- privater Speicher-Bucket in der EU, Zugriff nur über signierte URLs im Admin
- Benachrichtigungs-E-Mail an Jutta ohne Bilder und ohne Freitext, nur Referenz + Link

Dasselbe gilt für Juttas eigene Handy-Uploads von Flash und Portfolio: automatisch GPS entfernen, verkleinern, zuschneiden.**  
  _BegrÃ¼ndung:_ Körperfotos sind heikel, und Handy-Fotos verraten über GPS sonst den Wohn- oder Studioort.

- **Schalter 'Books open/closed' in den Einstellungen:
- bei 'closed' zeigt das Formular ein Banner und nimmt nur Flash-Day- oder Guest-Spot-Anfragen oder Wartelisten-Einträge an
- optional Warteliste bzw. 'Flash-Alarm' als eigener Newsletter mit Double-Opt-in**  
  _BegrÃ¼ndung:_ Solo-Artists sind oft Monate ausgebucht. So lässt sich die Nachfrage steuern, ohne Anfragen zu verlieren.

- **Mobile Admin-Schnellaktionen (PWA, Login mit Passkey oder 2FA):
- Flash-Liste mit Status-Chips, Statuswechsel in höchstens 2 Taps
- 'Neuer Flash': Kamera → Zuschnitt → Titel → Status → veröffentlichen
- Anfrage-Inbox mit Status-Filtern und Antwort-Vorlagen DE/EN
- 'Als gestochen markieren' setzt einen One-off automatisch auf 'vergeben' und legt einen Portfolio-Entwurf an
- 'Kaution erhalten'-Haken
- Push/E-Mail bei neuer Anfrage**  
  _BegrÃ¼ndung:_ Jutta verwaltet vom Handy aus. Status-Pflege muss schneller gehen als eine Instagram-Story, sonst veraltet die Seite.

- **Auto-Antwort-E-Mail (DE/EN je nach gewählter Sprache) mit:
- Dank und Referenznummer T-2026-0042
- Zusammenfassung der Anfrage (ohne Bilder)
- ehrliche Antwortzeit ('meist innerhalb von 7 Tagen – wenn du nach 14 Tagen nichts hörst, passt es gerade leider nicht')
- 'Noch keine Zahlung nötig'
- nächste Schritte, Links zu FAQ, Pflege und Flash
- Datenschutz-Kurzinfo mit Löschfrist
- Absender jutta@planetclairetattoos.com mit SPF/DKIM/DMARC**  
  _BegrÃ¼ndung:_ Nimmt Unsicherheit, spart Nachfragen per DM und setzt realistische Erwartungen.

- **Seite 'Pflege': Phasen (direkt danach, Tag 1–3, Woche 1–2, Woche 3–6, langfristig mit Sonnenschutz), Warnzeichen mit 'Wann zum Arzt', PDF-Download plus QR-Code im Studio, Link zu den Safer-Tattoo-Checklisten des Bundesumweltministeriums.

Optional etwa 8 Wochen nach der Sitzung eine Service-Mail 'Schick mir dein verheiltes Tattoo' mit Upload-Link und Foto-Einwilligung.**  
  _BegrÃ¼ndung:_ Das Gesundheitsamt erwartet eine schriftliche Nachsorge, DIN EN 17169 und BfR stützen das. Die Mail erzeugt zugleich 'healed'-Material fürs Portfolio.

- **Keine Instagram-Embeds oder Feed-Widgets. Eigene Bilder aus dem CMS, dazu ein Profil-Link '@planet.claire.tattoos' als einfacher Link.**  
  _BegrÃ¼ndung:_ Datenschutz (keine gemeinsame Verantwortlichkeit mit Meta für Embeds), Ladezeit und eigene Kontrolle über die Bilder.

- **Später: Farb-/Chargen-Katalog im Backoffice (Marke, Farbton, Charge, Ablaufdatum, Etikettfoto, Datum der Safety-Gate-Prüfung), verknüpft mit Sitzungen. Kunden bekommen die Etikettangaben als Link oder Ausdruck.**  
  _BegrÃ¼ndung:_ Erfüllt REACH Anhang XVII Nr. 75 und macht die Rückverfolgung bei Rückrufen einfach.

## Umsetzungsanforderungen

- Routen /tattoo, /tattoo/flash, /tattoo/arbeiten, /tattoo/termine, /tattoo/anfrage, /tattoo/ablauf-preise, /tattoo/pflege, /tattoo/faq, /tattoo/studio (+ /en/tattoo/...). Kein Tattoo-Objekt darf in den Warenkorb oder Checkout gelangen (per Test absichern).
- CMS-Collection tattoo_flash:
- id (FL-YYYY-NNN), title_de/en, slug, drawing_image (Pflicht), extra_images[], sheet (→ flash_sheet)
- status enum [available, reserved, claimed, repeatable, wanna_do, flash_day_only, archived], reserved_until, reserved_for_inquiry (→ inquiry)
- is_one_off (bool), size_min_cm, size_max_cm, suggested_placements[], color_mode enum [black, black_accent, color]
- price_type enum [fixed, from, on_request], price_eur (Gesamtpreis), times_tattooed, tattooed_work (→ tattoo_work)
- tags[], sort_order, published, internal_note
- CMS-Collection flash_sheet: title_de/en, intro, cover_image, active, sort_order.
- CMS-Collection tattoo_work (Portfolio):
- images[] mit Rolle [fresh, healed, drawing, stencil], healed_after_months, tattooed_on (Monat), placement, size_cm, style_tags[], flash (→ tattoo_flash), caption_de/en
- photo_consent_ref (Pflicht zum Veröffentlichen), consent_scope enum [tattoo_only, with_face], credit_handle (optional), featured, published
- Validierung: published=true nur mit gültigem photo_consent_ref
- CMS-Collection tattoo_event: type enum [flash_day, guest_spot, special, walk_in_day], title_de/en, start/end, location_name, city, address (optional), location_url, booking_mode enum [inquiry, first_come, slots], price_info, flash_selection (→ tattoo_flash[]), status enum [announced, open, fully_booked, past], cover_image, published. Nach dem Enddatum automatisch auf past setzen.
- Collection inquiry (privat, nie öffentlich über die API):
- ref (T-YYYY-NNNN), created_at, type enum [flash, wanna_do, custom, event_slot, question], flash (→), event (→)
- idea_text (20–2000 Zeichen), placement enum + placement_text, size_w_cm, size_h_cm, color_mode, reference_images[] (max. 5, privat)
- preferred_dates_text, flexible (bool), budget_range enum [<150, 150–300, 300–500, 500+, unknown], first_tattoo enum [yes, no, n/a]
- name, email, instagram_handle, language enum [de, en], age_confirmed_at, privacy_notice_version, source/utm
- status enum [new, reviewing, proposal_sent, accepted, deposit_pending, scheduled, done, declined, no_response, withdrawn]
- proposal {price_text, dates[], deposit_eur, deposit_type [terminkaution, anzahlung], sent_at}, internal_notes, delete_after (berechnet)
- Collection appointment: inquiry (→), start, duration_min, location, deposit {amount, type, paid_at, method, refunded_at}, price_final, invoice_ref, consent_form_ref (Referenz auf Papier/extern, keine Gesundheitsdaten in der Web-DB), inks_used (→ ink_batch[], später), aftercare_sent_at, healed_request_sent_at.
- Singleton tattoo_settings:
- books_open (bool), books_closed_message_de/en, response_time_text
- min_price_eur, hourly_rate_eur, day_rate_eur, show_rates (bool), kleinunternehmer_hint (bool)
- deposit_policy_text_de/en (versioniert), withdrawal_notice_text (versioniert, Muster nach Anlage 1 zu Art. 246a EGBGB), privacy_notice_inquiry (versioniert)
- Plus Collections faq_item und aftercare_section (DE/EN, sortierbar) sowie aftercare_pdf.
- Anfrageformular mehrstufig:
1. Art (Flash / Wanna-do / eigene Idee / Termin-Slot / Frage), bei Einstieg über eine Flash-Karte vorausgefüllt
2. Idee: Text, Referenzbilder 0–5, Körperstelle (klickbare, handgezeichnete Körperfigur + Textfeld), Größe in cm (mit Vergleichshilfe Münze/Karte), schwarz/Farbe
3. Zeit & Budget (optional): Wunschzeitraum, flexibel?, Budget-Spanne, erstes Tattoo?
4. Kontakt: Name, E-Mail (Pflicht), Instagram-Handle, Sprache
5. Checkbox 'Ich bin am Tag des Termins mindestens 18' (Pflicht) + Link zum Datenschutzhinweis (keine Einwilligungs-Checkbox; Rechtsgrundlage Art. 6 Abs. 1 lit. b)

KEINE Gesundheitsfelder; Hinweistext am Freitextfeld. Zwischenstand clientseitig in sessionStorage (try/catch). WCAG 2.2 AA.
- Anti-Spam: Honeypot-Feld, serverseitige Prüfung der Mindest-Ausfüllzeit (≥3 s), Rate-Limit pro IP-Hash (5/h, Logs 7 Tage), ALTCHA-Widget selbst gehostet mit serverseitiger Verifikation. Keine Google- oder Cloudflare-Skripte.
- Upload-Pipeline: MIME- und Größenprüfung (≤10 MB, JPG/PNG/WebP/HEIC), Neu-Kodierung, EXIF/GPS-Strip, Speicherung in privatem EU-Bucket, nur signierte Admin-URLs mit kurzer TTL. Gilt auch für Admin-Uploads von Flash und Portfolio (plus automatische Web-Varianten).
- E-Mails:
- Auto-Antwort DE/EN mit Referenznummer, Zusammenfassung ohne Bilder, Antwortzeit, 'noch keine Zahlung', Links zu FAQ/Pflege, Löschfrist
- Admin-Benachrichtigung nur mit Referenz + Link (ohne Freitext und Bilder)
- Vorlagen 'Vorschlag', 'Kaution anfordern' (mit Widerrufsbelehrung, Muster-Widerrufsformular und Textbaustein zum vorzeitigen Beginn), 'Termin bestätigt', 'Pflege', 'Healed-Foto'
- Absender jutta@planetclairetattoos.com, SPF/DKIM/DMARC konfiguriert
- Hintergrundjobs (täglich):
- abgelaufene Flash-Reservierungen auf available zurücksetzen
- Events nach Ende auf past setzen
- Anfragen nach delete_after löschen: declined/no_response/withdrawn 90 Tage nach letztem Kontakt; Referenzbilder erledigter Projekte 12 Monate nach der letzten Sitzung
- Löschprotokoll nur mit Referenz + Datum
- Mobile Admin (PWA):
- Flash-Liste mit Status-Chips und Swipe-/Tap-Aktionen (Statuswechsel in ≤2 Taps)
- 'Neuer Flash' mit Kamera-Upload
- Anfrage-Inbox mit Statusfiltern, Antwort-Vorlagen, 'reservieren'-Button, 'Kaution erhalten', 'als gestochen markieren' (One-off → claimed + Portfolio-Entwurf)
- Schalter books_open
- Login mit Passkey oder TOTP-2FA
- Portfolio-Darstellung: Umschalter frisch/verheilt, Badge 'X Monate/Jahre verheilt', optionaler Vorher/Nachher-Slider, Stil-Filter, Bilder mit Lazy Loading und responsiven Varianten. Keine Instagram-Embeds, nur ein Profil-Link.
- Rechtstexte im Tattoo-Kontext:
- Datenschutzhinweis-Abschnitt 'Tattoo-Anfragen' (Zwecke, Art. 6 Abs. 1 lit. b, Speicherorte, Löschfristen, keine Gesundheitsdaten)
- Widerrufsbelehrung für Tattoo-Dienstleistungen als versionierter CMS-Text
- keine Tattoo-AGB mit Anzahlungs-Verfallklausel; Kaution nur per individueller E-Mail-Vereinbarung
- Anwaltsprüfung als Abnahmekriterium vor dem Livegang der Kautionsregeln
- Spätere Phase (nicht P0/MVP): Stripe-Checkout für die Kaution, erzeugt aus der Anfrage (Metadaten ref; Webhook setzt deposit.paid_at), mit Widerrufsbutton 'Vertrag widerrufen' nach § 356a BGB (gemeinsam mit dem Shop). Dazu Collection ink_batch (brand, color, batch_no, expiry, opened_at, label_photo, ingredients, safety_gate_checked_at) und eine digitale Einwilligung über ein externes Tool (z. B. kissSign) statt Eigenbau.

## Offene Fragen aus der Recherche (inzwischen im Interview beantwortet, siehe docs/ENTSCHEIDUNGEN.md)

- Wo tätowierst du (eigenes Studio, Platz in einem Gemeinschaftsstudio, privates Atelier) und darf die Adresse öffentlich auf der Website stehen? _(Optionen: Eigenes Studio – Adresse öffentlich / Gemeinschafts-/Gaststudio – Studio verlinken / Privates Atelier – nur Bezirk öffentlich, Adresse nach Buchung; Empfehlung: Studio-Adresse öffentlich, falls es ein Geschäftsraum ist. Sonst nur den Bezirk nennen und die Adresse nach der Buchung schicken; die Impressumsadresse separat klären.)_
- Welche Preise sollen sichtbar sein: Mindestpreis, feste Flash-Preise, Stunden- oder Tagessatz? Wie hoch sind sie? _(Optionen: Nur Mindestpreis + feste Flash-Preise, Custom 'nach Entwurf' / Zusätzlich Stunden- und Tagessatz anzeigen / Gar keine Preise, alles auf Anfrage; Empfehlung: Mindestpreis und feste Flash-Preise zeigen. Custom 'nach Entwurf' mit Richtwert Tagessatz.)_
- Kaution: Terminkaution oder Anzahlung? Wie hoch (fix oder %), welche Absagefrist, was passiert bei No-Show oder Verschiebung? _(Optionen: Terminkaution fix (z. B. 50–100 €), wird verrechnet, Verfall nur bei No-Show oder Absage < 48 h, individuell per E-Mail vereinbart / Anzahlung in % vom Preis / Keine Kaution; Empfehlung: Terminkaution mit festem Betrag, individuell per E-Mail vereinbart, Verrechnung am Termintag. Vor dem Start anwaltlich prüfen lassen.)_
- Bist du umsatzsteuerliche Kleinunternehmerin (§ 19 UStG)? _(Optionen: Ja / Nein (Regelbesteuerung) / Unklar – Steuerberater fragen; Empfehlung: Mit dem Steuerberater klären. Das CMS bekommt einen Schalter dafür.)_
- Sollen Kautionen zum Start online über die Website bezahlt werden oder manuell per Überweisung, PayPal oder Zahlungslink? _(Optionen: Manuell zum Start (Überweisung / PayPal / Stripe Payment Link) / Sofort integriertes Stripe-Checkout / Nur bar vor Ort; Empfehlung: Zum Start manuell, integriertes Stripe-Checkout in einer späteren Phase.)_
- Bestätigst du das Flash-Status-Set (verfügbar / reserviert / vergeben / wiederholbar / Wanna-do / nur Flash Day / archiviert) und die Reservierungsdauer? _(Optionen: Set wie vorgeschlagen, Reservierung 72 h / Vereinfacht: verfügbar / vergeben / wiederholbar / Wanna-do / Eigene Begriffe (bitte nennen); Empfehlung: Set wie vorgeschlagen, Reservierung 72 h; die Anzeigenamen sind im CMS frei änderbar.)_
- Was stichst du, was nicht: Farbe? Cover-ups? Schriftzüge? Kopien fremder Motive? Handpoke? _(Optionen: Nur Schwarz/Grau + wenig Farbakzent, keine Cover-ups, keine Kopien / Auch Farbe / Eigene Liste; Empfehlung: Erlaubte Optionen im CMS pflegbar machen. Auf der Seite ehrlich sagen, was du nicht machst.)_
- Einwilligungserklärung: Papier bzw. PDF-Tablet vor Ort oder digitales Tool (z. B. kisscal kissSign)? Wie lange aufbewahren? _(Optionen: Papier/PDF vor Ort, 10 Jahre sicher verwahrt / Digitales Fachtool (kissSign o. ä.) / Eigenbau in der Website (nicht empfohlen); Empfehlung: Zum Start Papier/PDF vor Ort. Die Frist von 10 Jahren anwaltlich bestätigen lassen. Ein digitales Tool später prüfen.)_
- Sprachen: Soll der Tattoo-Bereich zweisprachig (DE/EN) sein? _(Optionen: DE + EN / Nur DE / Nur EN; Empfehlung: DE + EN.)_
- Wie oft gibt es Flash Days oder Guest Spots, und wie sollen sie gebucht werden? _(Optionen: First come / Walk-in, nur ankündigen / Feste Slots über das eigene Formular / Slots über Cal.com mit Kaution; Empfehlung: Zum Start ankündigen + first come oder Anfrage. Slots erst, wenn Flash Days regelmäßig stattfinden.)_
- Soll es einen Schalter 'Books open/closed' mit Warteliste bzw. 'Flash-Alarm'-Newsletter geben? _(Optionen: Schalter + Warteliste/Newsletter / Nur Schalter mit Hinweistext / Kein Schalter; Empfehlung: Schalter sofort. Warteliste/Newsletter in einer späteren Phase.)_
- Wie bekommst du Foto-Freigaben und Healed-Fotos: separat im Einwilligungsbogen und per Healed-Upload-Link etwa 8 Wochen nach der Sitzung? _(Optionen: Abgestufte Foto-Einwilligung + automatische Healed-Mail mit Upload / Nur Foto-Einwilligung, keine Mail / Pauschal per AGB (nicht empfohlen); Empfehlung: Abgestufte Einwilligung + Healed-Mail mit Upload-Link.)_
- Sollen Tattoo-Gutscheine im Shop kaufbar sein? _(Optionen: Nein / Ja, als Wertgutschein im Shop (anrechenbar auf Tattoo, Prints, Keramik) / Später entscheiden; Empfehlung: Später entscheiden. Im Datenmodell einen Produkttyp 'Gutschein' vorsehen, aber nicht aktivieren.)_
- Nimmst du Anfragen weiter per Instagram-DM an oder leitest du sie aufs Formular um? _(Optionen: Nur Formular, DMs mit Link beantworten / Beides, DMs manuell im Admin anlegen / Nur DMs; Empfehlung: Nur Formular. Eine DM-Schnellantwort mit Link zu /tattoo/anfrage einrichten.)_
- Welchen Spamschutz möchtest du? _(Optionen: Honeypot + Zeitfalle + Rate-Limit + ALTCHA selbst gehostet / Friendly Captcha Starter (9 €/Monat) / Cloudflare Turnstile (kostenlos, US-Anbieter); Empfehlung: Honeypot + Zeitfalle + Rate-Limit + ALTCHA selbst gehostet.)_
