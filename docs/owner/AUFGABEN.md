# Deine Aufgaben

> **Für:** Jutta · **Stand:** 27.09.2026 (Ende von P0)
> **Schritt-für-Schritt-Anleitungen:** [ANLEITUNGEN.md](ANLEITUNGEN.md)

Hallo Jutta,

hier steht alles, was nur du erledigen kannst. Die Reihenfolge stimmt schon.

Die gute Nachricht zuerst: Die Cloud-Entwicklung (Phasen P1 bis P10) arbeitet mit Testdaten und Attrappen.
Sie wartet nur auf die ersten drei Punkte. Deine Konten und Unterlagen brauchen wir erst zum Start (P11),
und den machen wir zusammen.

## So benutzt du die Liste

- Jede Aufgabe hat eine Nummer (A01, A02 …) und steht in dem Abschnitt, in dem sie dran ist. Hat eine Nummer einen
  Buchstaben (zum Beispiel A33a), ist die Aufgabe später dazugekommen und steht dort, wo sie dran ist.
- **Warum:** ein Satz, wofür die Aufgabe gut ist.
- **Aufwand:** deine reine Arbeitszeit in Minuten. Wartezeiten zählen nicht mit, zum Beispiel wenn du auf eine Mail wartest.
- **Anleitung:** Dieser Link führt dich zur Schritt-für-Schritt-Erklärung.
- **Abhaken:** Druck die Liste aus und hak mit dem Stift ab. Oder du hakst direkt auf GitHub ab: Datei öffnen,
  oben rechts auf den Stift klicken, aus `[ ]` ein `[x]` machen und unten auf „Commit changes“ klicken
  („Commit“ heißt bei GitHub einfach „speichern“).

## Drei Regeln, die immer gelten

1. **Geheimes bleibt bei dir.** Passwörter, Bestätigungscodes, Schlüssel (lange Zeichenketten wie `sk_live_…`),
   Ausweis- und Kontodaten schickst du nie in einen Chat, eine Mail oder auf GitHub. Claude fragt nie danach
   und tippt so etwas auch nicht für dich ein. Das machst du selbst, Claude zeigt dir nur, wo.
2. **Alle neuen Konten laufen auf jutta@planetclairetattoos.com, immer mit Zwei-Faktor-Schutz.** Zwei-Faktor-Schutz
   (kurz 2FA) heißt: Beim Anmelden brauchst du außer dem Passwort noch einen Code aus einer App auf deinem Handy.
3. **Keine Kundendaten auf GitHub.** Also keine Instagram-Nachrichten, keine Screenshots von Einwilligungen und
   keine Adressen von Kund:innen.

## Auf einen Blick

| Wann | Aufgaben | Deine Zeit (ca.) | Hält die Entwicklung auf? |
|---|---|---|---|
| 1. Sofort nach P0 | A01–A05 (mit A01a) | 115 Min. | **Ja, A01–A03.** Ohne sie kann die Cloud nicht starten. |
| 2. Während der Cloud-Phasen | A06–A22 | 550 Min., verteilt über mehrere Wochen (plus Optionales) | Nein |
| 3. Vor dem Start (P11) | A23–A32 | 295 Min. plus ca. 25 Min. pro Stück | Nein, aber P11 braucht die Ergebnisse |
| 4. Am Start-Tag (P11, mit Claude) | A33–A41 (mit A33a und A36a) | 300 Min. plus ca. 10 Min. pro Stück | – |
| 5. Nach dem Start | A42–A50 | laufend | – |

---

## 1. Sofort nach P0

Diese drei Punkte sind der Schlüssel für die Cloud: **A01 → A02 → A03**. A01a, A04 und A05 halten nichts auf,
aber je früher, desto besser. A01a erledigst du am besten gleich nach A01.

- [ ] **A01 · Privates GitHub-Repository „planetclairetattoos“ anlegen und 2FA bei GitHub prüfen**
  - Warum: Dort liegt der ganze Code, und die Cloud-Entwicklung arbeitet nur damit. Es muss privat sein, weil darin
    Tattoo-Fotos deiner Kund:innen und Beispieldaten liegen.
  - Aufwand: ca. 15 Min. (fällt weg, wenn Claude es in P0 schon mit dir angelegt hat)
  - Anleitung: [G1](ANLEITUNGEN.md#g1)

- [ ] **A01a · Im Repository einmal einstellen, was beim Übernehmen eines Pull Requests in die Nachricht kommt**
  - Warum: Dann schreibt GitHub beim Übernehmen („mergen“) nur den Titel und die Beschreibung des Pull Requests in die
    Nachricht. Sonst kommen alle Zwischenschritte hinein, und ein Vermerk darin kann verhindern, dass die fertige
    Vorschau am Ende automatisch veröffentlicht wird.
  - So geht's: dein Repository auf github.com öffnen → oben „Settings“ → links „General“ → nach unten bis
    „Pull Requests“ → Häkchen bei „Allow squash merging“ → direkt darunter bei „Default commit message“
    **„Pull request title and description“** wählen.
  - Aufwand: ca. 5 Min. (einmalig; auch nötig, wenn Claude das Repository in P0 schon mit dir angelegt hat)
  - Anleitung: [G1, Teil „Einmal einstellen“](ANLEITUNGEN.md#g1a)

- [ ] **A02 · Claude GitHub App für das Repository installieren**
  - Warum: Erst damit darf Claude in der Cloud dein privates Repository lesen, Arbeitsstände hochladen und
    Änderungsvorschläge (Pull Requests) anlegen.
  - Aufwand: ca. 5 Min.
  - Anleitung: [G2](ANLEITUNGEN.md#g2)

- [ ] **A03 · Die Arbeit in die Cloud schieben**
  - Warum: P1 bis P10 laufen in der Cloud weiter. Dein Computer darf dann aus sein.
  - Aufwand: ca. 20 Min. (zusammen mit Claude)
  - Anleitung: [G3](ANLEITUNGEN.md#g3) und `docs/CLOUD-SETUP.md`

- [ ] **A04 · Instagram-Datenexport anfordern**
  - Warum: Die Bilder aus deinem Profil sind nur 640 Pixel klein. Der Export liefert deine Fotos in voller Qualität
    für den Shop, die Zeichnungen und Coco.
  - Aufwand: ca. 10 Min., danach bis zu 48 Stunden warten
  - Anleitung: [I1](ANLEITUNGEN.md#i1)

- [ ] **A05 · 5–10 Fotos von Coco machen oder aussuchen und hochladen** (in den Ordner `content/seed/coco/`, den gibt es schon)
  - Warum: Coco wird nach Fotos gezeichnet, in sechs Posen: rennen, schnüffeln, sitzen, schlafen, springen und
    Kopf schief. Die Highlight-Bildchen sind dafür nur 150 Pixel groß.
  - Aufwand: ca. 45 Min. fürs Fotografieren (gern über ein paar Tage verteilt) und 15 Min. fürs Hochladen
  - Anleitung: [C1](ANLEITUNGEN.md#c1), Hochladen: [G4](ANLEITUNGEN.md#g4)

---

## 2. Während der Cloud-Phasen – blockiert nichts

Die Entwicklung läuft auch ohne diese Punkte weiter. Sie sind aber alle **vor dem Start** nötig. Die ersten
Punkte haben die längste Vorlaufzeit, deshalb stehen sie oben.

- [ ] **A06 · Instagram-Export herunterladen und auf GitHub hochladen** (in den Ordner `content/seed/instagram-export/`, den gibt es schon)
  - Warum: Aus dem Export entstehen in P8 der Beispielbestand in voller Qualität und in P9 die Zeichnungen.
    Der Download-Link gilt nur wenige Tage, also bald nach der Mail erledigen.
  - Aufwand: ca. 30–90 Min., je nachdem, wie viele Fotos es sind
  - Anleitung: [I2](ANLEITUNGEN.md#i2), [G4](ANLEITUNGEN.md#g4)

- [ ] **A07 · Pull Requests übernehmen („mergen“), wenn Claude darum bittet** (fällt immer wieder an)
  - Warum: Meist übernimmt Claude seine Arbeit selbst. Wenn im Pull Request oben „Bitte mergen – CI ist grün“ steht,
    braucht es deinen Klick. Sonst baut die nächste Session nicht auf der vorherigen auf.
  - Aufwand: ca. 2 Min. pro Pull Request
  - Anleitung: [G5](ANLEITUNGEN.md#g5)

- [ ] **A08 · Kanzlei beauftragen, mit der Briefing-Mappe** (`docs/recht/KANZLEI-BRIEFING.md`)
  - Warum: Impressum, Datenschutzerklärung, AGB und Widerrufsbelehrung kommen einmalig von einer Anwältin oder einem
    Anwalt. Ohne diese Texte kann die Seite nicht starten. Die Kanzlei braucht Zeit, also früh anfragen.
  - Aufwand: ca. 60 Min. für die Angebote, 15 Min. für die Beauftragung
  - Dabei auch besprechen: welche Adresse ins Impressum kommt (siehe den Hinweis bei A26).
  - Anleitung: [K1](ANLEITUNGEN.md#k1)

- [ ] **A09 · Stripe-Konto anlegen (der Testmodus reicht vorerst)**
  - Warum: Stripe wickelt Karte, Apple Pay, Google Pay und PayPal ab. Wenn das Konto früh da ist, geht der Start schneller.
  - Aufwand: ca. 20 Min.
  - Anleitung: [S1](ANLEITUNGEN.md#s1), [S2](ANLEITUNGEN.md#s2)

- [ ] **A10 · PayPal-Geschäftskonto eröffnen**
  - Warum: PayPal läuft an der Kasse über Stripe. Dafür braucht es ein PayPal-**Geschäfts**konto, ein privates reicht nicht.
  - Aufwand: ca. 30 Min.
  - Anleitung: [P1](ANLEITUNGEN.md#p1)

- [ ] **A11 · Steuerdaten zusammensuchen: Steuernummer, W-IdNr., Umsatz 2025, Kleinunternehmer-Status**
  - Warum: Das brauchen die Rechnungen, das Impressum, die Stripe-Prüfung und der Umsatz-Wächter. Der warnt dich,
    bevor du die Kleinunternehmer-Grenze erreichst.
  - Aufwand: ca. 45 Min.
  - Anleitung: [T2](ANLEITUNGEN.md#t2)

- [ ] **A12 · Telefonnummer fürs Impressum festlegen**
  - Warum: Eine Telefonnummer ist im Impressum und in der Widerrufsbelehrung Pflicht. Es darf eine eigene Nummer
    nur fürs Geschäft sein.
  - Aufwand: ca. 10 Min. (länger, wenn du dir eine zweite Nummer besorgst)
  - Anleitung: [T1](ANLEITUNGEN.md#t1)

- [ ] **A13 · Einwilligungen für Tattoo-Fotos einholen** (fertige DM-Texte auf Deutsch und Englisch in der Anleitung)
  - Warum: Fotos mit Haut oder Gesicht deiner Kund:innen erscheinen auf der Website nur mit Einwilligung. Ohne
    Häkchen wird nichts gezeigt.
  - Aufwand: ca. 5 Min. pro Person (bei 12 Fotos etwa 60 Min.)
  - Anleitung: [E1](ANLEITUNGEN.md#e1)

- [ ] **A14 · Im Verpackungsregister LUCID registrieren**
  - Warum: Das ist Pflicht vor dem ersten Paket, sonst drohen Verkaufsverbot und Bußgeld. Das darfst nur du selbst
    machen, niemand für dich. Die Registrierung ist kostenlos.
  - Aufwand: ca. 30 Min.
  - Anleitung: [L1](ANLEITUNGEN.md#l1)

- [ ] **A15 · Verpackungslizenz bei einem „dualen System“ abschließen**
  - Warum: Du stellst Karton, Polster und Klebeband selbst zusammen, damit giltst du als Herstellerin der
    Verpackung. Deshalb brauchst du eine eigene Lizenz. „Vorlizenzierte“ Kartons reichen dafür nicht.
    Die Menge fürs erste Jahr schätzt du. Danach zählt der Shop beim Packen mit (siehe A42 und A46).
  - Aufwand: ca. 45 Min., Kosten grob 15–80 € im Jahr (nur Richtwert)
  - Anleitung: [L2](ANLEITUNGEN.md#l2)

- [ ] **A16 · Versandmaterial ohne Plastik kaufen**
  - Warum: Keramik muss bruchsicher reisen (Karton in Karton). Textil darf nie in Plastik verschickt werden, sonst
    berechnet DHL 28,99 € Sperrgut-Zuschlag.
  - Aufwand: ca. 60 Min.
  - Anleitung: [L3](ANLEITUNGEN.md#l3)

- [ ] **A17 · Nickelfreie Ösen und Ketten mit Lieferantenerklärung besorgen**
  - Warum: Ohne Nachweis lässt der Shop keinen Schmuck online.
  - Aufwand: ca. 45 Min.
  - Anleitung: [M1](ANLEITUNGEN.md#m1)

- [ ] **A18 · Glasur-Frage entscheiden: alles Deko oder einzelne Glasuren im Labor prüfen lassen**
  - Warum: Ohne Laborprüfung und schriftliche Erklärung ist Keramik „Deko – nicht für Lebensmittel“. Wenn dir das
    reicht, musst du nichts weiter tun.
  - Aufwand: ca. 15 Min. zum Entscheiden. Mit Labor mehrere Stunden plus Wochen Wartezeit, grob 40–150 € pro Glasur (nur Richtwert)
  - Anleitung: [M2](ANLEITUNGEN.md#m2)

- [ ] **A19 · Neue Keramik ab jetzt am Boden kennzeichnen** (Objektnummer und „Nur Deko – nicht für Lebensmittel“)
  - Warum: Nach der EU-Produktsicherheit müssen Nummer und Hinweis dauerhaft am Stück stehen, nicht nur online.
  - Aufwand: ca. 2 Min. pro Stück
  - Anleitung: [M3](ANLEITUNGEN.md#m3)

- [ ] **A20 · Liste der Objektnummern anfangen**
  - Warum: Du vergibst die Nummern selbst, als reine Zahlen. Nach dem Veröffentlichen lassen sie sich nicht mehr
    ändern. Mit einer Liste gibt es keine doppelten Nummern.
  - Aufwand: ca. 15 Min.
  - Anleitung: [F1](ANLEITUNGEN.md#f1)

- [ ] **A21 · (optional) Zwischen-Vorschau anschauen, ab P2 nach jeder Phase**
  - Warum: Du siehst früh, wie die Seite wird. Anmerkungen sammelst du für P11.
  - **Nur für dich:** Die Datei zeigt Beispiel-Tattoofotos von Kund:innen, die noch nicht eingewilligt haben. Schau sie
    dir nur privat an. Gib sie nicht weiter und veröffentliche sie nicht, auch nicht auf Instagram. Fotos, auf denen du
    selbst zu sehen bist, kommen erst hinein, wenn du sie freigibst.
  - Aufwand: ca. 20 Min. pro Vorschau
  - Anleitung: [G6](ANLEITUNGEN.md#g6), [V1](ANLEITUNGEN.md#v1), [V2](ANLEITUNGEN.md#v2)

- [ ] **A22 · (optional) Markenrecherche „Planet Claire“**
  - Warum: So prüfst du, ob jemand den Namen für Keramik, Kleidung oder Tattoo schon als Marke geschützt hat.
  - Aufwand: ca. 30 Min.
  - Anleitung: [R1](ANLEITUNGEN.md#r1)

---

## 3. Vor dem Start (P11)

**Wann?** Sobald in den Pull Requests P8 oder eine spätere Phase steht, spätestens 2 Wochen vor deinem
Wunsch-Starttermin. A30 und A31 gehen erst, wenn P10 fertig ist.

- [ ] **A23 · Stripe-Konto verifizieren** (mit Ausweis, IBAN und Steuernummer, alles gibst du selbst ein)
  - Warum: Erst danach darf Stripe echtes Geld annehmen und auszahlen. Die Prüfung kann einige Tage dauern, und die
    erste Auszahlung kommt erst 7 Tage nach der ersten echten Zahlung.
  - Aufwand: ca. 30 Min.
  - Anleitung: [S3](ANLEITUNGEN.md#s3)

- [ ] **A24 · PayPal in Stripe verbinden** (geht erst nach A23)
  - Warum: Erst dann erscheint PayPal an der Kasse.
  - Aufwand: ca. 10 Min.
  - Anleitung: [P2](ANLEITUNGEN.md#p2)

- [ ] **A25 · Konten für die echte Seite anlegen, alle auf jutta@planetclairetattoos.com und mit 2FA**
  - Warum: Auf diesen Diensten läuft später die echte Seite. Vercel legst du zuletzt an, weil es ab dann monatlich kostet.
  - Aufwand: ca. 90 Min. für alle zusammen
  - Anleitung: [D0](ANLEITUNGEN.md#d0)
  - [ ] Sentry, Tarif „Developer“, Datenregion **EU** ([D1](ANLEITUNGEN.md#d1))
  - [ ] DeepL API Free ([D2](ANLEITUNGEN.md#d2))
  - [ ] Lettermint, Tarif „Free“ ([D3](ANLEITUNGEN.md#d3))
  - [ ] Neon, Tarif „Free“, Region **Frankfurt** ([D4](ANLEITUNGEN.md#d4))
  - [ ] Cloudflare mit R2, Speicherort **EU**, die Domain **nicht** hinzufügen ([D5](ANLEITUNGEN.md#d5))
  - [ ] Vercel, Tarif **Pro** ([D6](ANLEITUNGEN.md#d6))

- [ ] **A26 · Stammdaten und Bankverbindung für Vorkasse bereitlegen**
  - Warum: Name, Adresse, Telefon, Bezirk, Abhol-Infos, IBAN und LUCID-Nummer sind Pflichtangaben. Ohne sie bleibt die
    „Startklar“-Prüfung rot. In P11 trägst du sie selbst in die Verwaltung ein.
  - **Wichtig zur Adresse:** Im Impressum und bei den Produktsicherheitsangaben auf jeder Produktseite steht deine
    Privatadresse. So ist es bisher entschieden. Damit kann jede:r herausfinden, wo dein Privatstudio ist, obwohl die
    Tattoo-Seiten nur den Bezirk nennen. Besprich das mit der Kanzlei (A08, in der Mappe Frage K-39). Die Alternative ist eine
    Geschäftsadresse, unter der dich Briefe von Behörden und Gerichten sicher erreichen („ladungsfähige Anschrift“),
    zum Beispiel von einem Anbieter, der Geschäftsadressen vermietet. Das kostet meist eine monatliche Gebühr.
    Welche Adresse es wird, entscheidest du.
  - Aufwand: ca. 20 Min.
  - Anleitung: [T3](ANLEITUNGEN.md#t3)

- [ ] **A27 · Bei IONOS die DNS-Seite finden und Bildschirmfotos machen, aber nichts ändern!**
  - Warum: Am Start-Tag stellen wir dort die Adresse planetclairetattoos.com auf die neue Seite um. Die Fotos sind
    deine Sicherung. Dein Postfach bleibt unberührt.
  - Aufwand: ca. 10 Min.
  - Anleitung: [N1](ANLEITUNGEN.md#n1)

- [ ] **A28 · Prüfen, ob die Kanzleitexte vollständig da sind**
  - Warum: Ohne sie gibt es keinen Start. Du brauchst sie in dem Format, um das die Mappe bittet
    (Text- und HTML-Datei), nicht nur als PDF.
  - Aufwand: ca. 10 Min.
  - Anleitung: [K1](ANLEITUNGEN.md#k1), Schritt 6

- [ ] **A29 · Erste echte Stücke fotografieren und die Angaben notieren**
  - Warum: Zum Start löschen wir alle Beispieldaten, und im Shop sollen echte Stücke stehen.
  - Aufwand: ca. 25 Min. pro Stück
  - Anleitung: [F1](ANLEITUNGEN.md#f1)

- [ ] **A30 · Die fertige Vorschau-Datei anschauen und Anmerkungen notieren** (nach P10)
  - Warum: Das ist deine Abnahme, bevor die Seite live geht.
  - **Nur für dich**, wie bei A21: nur privat ansehen, nicht weitergeben, nicht veröffentlichen.
  - Aufwand: ca. 90 Min.
  - Anleitung: [G7](ANLEITUNGEN.md#g7), [V1](ANLEITUNGEN.md#v1), [V2](ANLEITUNGEN.md#v2)

- [ ] **A31 · Abschlussbericht und offene Punkte lesen** (`docs/FORTSCHRITT.md` und `docs/OFFENE-PUNKTE.md`, nach P10)
  - Warum: Dort stehen Annahmen, die Claude ohne dich treffen musste. Die entscheidest du.
  - Aufwand: ca. 30 Min.
  - Anleitung: [G8](ANLEITUNGEN.md#g8)

- [ ] **A32 · Termin für den Start-Tag festlegen**
  - Warum: Den Start machen wir zusammen. Plane ca. 5–6 Stunden am Computer ein, gern mit Pausen oder auf zwei Termine
    verteilt. Dein Handy liegt daneben.
  - Aufwand: ca. 5 Min.
  - Anleitung: [Z1](ANLEITUNGEN.md#z1)

---

## 4. Am Start-Tag (P11, zusammen mit Claude)

Du meldest dich überall selbst an und gibst Geheimes selbst ein. Claude sagt dir jeweils, wo du klicken musst.
Die Reihenfolge steht in [Z1](ANLEITUNGEN.md#z1).

- [ ] **A33 · Konten verbinden und Schlüssel sicher hinterlegen**
  - Warum: So spricht die Seite mit Stripe, der Datenbank, dem Bildspeicher, dem Mail-Dienst und DeepL. Die Schlüssel
    kopierst du selbst in die geschützten Einstellungen bei Vercel.
  - Aufwand: ca. 45 Min.

- [ ] **A33a · Probelauf auf der Test-Seite: alles einmal durchklicken**
  - Warum: Bevor echtes Geld fließt, probierst du alles auf einer Test-Kopie deiner Seite aus (sie heißt „Staging“).
    Dort stehen noch die Beispieldaten, es fließt kein Geld, und alle Mails landen bei dir. Du schaust am Laptop und am
    Handy, auch im Instagram-Browser. Du machst einen Testkauf, eine Vorkasse-Bestellung, eine Abholung und einen
    Widerruf und legst mit der Stoppuhr ein neues Stück an (Ziel: höchstens 3 Minuten). Was nicht passt, behebt Claude
    vor dem Start.
  - Aufwand: ca. 60 Min.
  - Anleitung: [Z1](ANLEITUNGEN.md#z1), Schritt 2, und [V2](ANLEITUNGEN.md#v2)

- [ ] **A34 · In der Verwaltung eintragen:** Admin-Passwort, Stammdaten, IBAN, LUCID-Nummer, Rechtstexte der
  Kanzlei, Nachweise (Nickel, Glasuren), technische Unterlagen je Produktart, Einwilligungen und die ersten Stücke
  - Warum: Das sind echte Daten statt Platzhalter. Erst damit wird die „Startklar“-Prüfung grün.
  - Aufwand: ca. 60 Min. plus ca. 10 Min. pro Stück
  - Anleitung: [T3](ANLEITUNGEN.md#t3), [E1](ANLEITUNGEN.md#e1), [F1](ANLEITUNGEN.md#f1), [M3](ANLEITUNGEN.md#m3)

- [ ] **A35 · Verträge zur Auftragsverarbeitung (AVV) bestätigen und eintragen**
  - Warum: Ein AVV ist ein Vertrag, in dem ein Dienst zusagt, Kundendaten nur in deinem Auftrag zu verarbeiten.
    Nach dem Datenschutzrecht ist er Pflicht für Vercel, Neon, Cloudflare, Stripe, Lettermint, IONOS und Sentry.
  - Aufwand: ca. 30 Min.

- [ ] **A36 · Entscheiden: Besucher-Statistik an oder aus**
  - Warum: Die Statistik kommt ohne Cookies aus. Einschalten erst, wenn die Kanzlei es bestätigt hat.
  - Aufwand: ca. 5 Min.

- [ ] **A36a · Backup-Schlüssel erzeugen und sicher aufheben**
  - Warum: Der Shop macht jede Nacht eine verschlüsselte Sicherung aller Daten. Öffnen kann sie nur dein geheimer
    Backup-Schlüssel. Du erzeugst ihn auf deinem eigenen Computer, Claude zeigt dir wie. Der Schlüssel hat zwei Teile:
    Den öffentlichen Teil trägst du bei Vercel ein. Den geheimen Teil hebst du in deinem Passwort-Manager und
    ausgedruckt bei deinen Unterlagen auf, **nie** bei Vercel, auf GitHub oder im Chat. Verlierst du den geheimen Teil,
    lassen sich die alten Sicherungen nicht mehr öffnen.
  - Aufwand: ca. 15 Min.
  - Anleitung: [Z1](ANLEITUNGEN.md#z1), Schritt 6

- [ ] **A41 · Beispieldaten entfernen und „Startklar“ komplett grün sehen**
  - Warum: Im echten Shop dürfen keine erfundenen Stücke oder Bestellungen stehen.
  - Aufwand: ca. 10 Min.

- [ ] **A37 · DNS bei IONOS umstellen, zusammen mit Claude**
  - Warum: Dann zeigt planetclairetattoos.com auf die neue Seite. Die Einträge für dein Postfach bleiben unverändert.
  - Aufwand: ca. 20 Min., danach Minuten bis einige Stunden warten
  - Anleitung: [N1](ANLEITUNGEN.md#n1)

- [ ] **A38 · Stripe live schalten**
  - Warum: Ab jetzt fließt echtes Geld. Die echten Stripe-Schlüssel hast du schon beim Einrichten am Start-Tag in
    Vercel eingetragen. „Live“ heißt jetzt: Nach dem Umstellen der Adresse (A37) meldet Stripe Zahlungen an
    planetclairetattoos.com, und wir öffnen den Shop.
  - Aufwand: ca. 20 Min.
  - Anleitung: [S4](ANLEITUNGEN.md#s4)

- [ ] **A39 · Echter Testkauf: kaufen, widerrufen, erstatten**
  - Warum: Das ist der Beweis, dass Kasse, Mails, Widerruf und Erstattung wirklich funktionieren.
  - Aufwand: ca. 30 Min.

- [ ] **A40 · Links in die Instagram-Bio setzen: zur Website und zum Impressum**
  - Warum: So findet man dich. Außerdem braucht ein Profil, das du geschäftlich nutzt, einen leicht erreichbaren Link
    zum Impressum.
  - Aufwand: ca. 5 Min.
  - Anleitung: [I3](ANLEITUNGEN.md#i3)

---

## 5. Nach dem Start

Die genaue Bedienung erklärt dein Handbuch, das in P10 in diesen Ordner kommt.
Überblick: [Z2](ANLEITUNGEN.md#z2).

- [ ] **A42 · Bestellungen bearbeiten:** „Zu packen“ → packen (Checkliste, 2 Fotos, Verpackung bestätigen) → Paketmarke → Sendungsnummer eintragen
  - Warum: Erst dann bekommt die Kund:in die Versandmail mit der Sendungsverfolgung. Beim Brief ist die Sendungsnummer
    freiwillig, die Mail kommt dann ohne Verfolgungslink. Die Fotos sind nicht Pflicht, aber sie helfen bei Streit über
    Transportschäden. Versendest du Keramik ohne Foto, fragt die Verwaltung einmal nach. Beim Packen schlägt die
    Verwaltung die übliche Verpackung für die Versandart vor, mit Gewicht. Nimmst du etwas anderes, änderst du es dort.
    So zählt der Shop deine Verpackungsmengen für die Jahresmeldung (A46).
  - Aufwand: ca. 15–30 Min. pro Versandtag

- [ ] **A43 · Vorkasse:** Wenn das Geld auf dem Konto ist, in der Verwaltung auf „Zahlung erhalten“ tippen
  - Warum: 3 Tage (72 Stunden) nach der Bestellung bekommt die Kund:in automatisch eine Erinnerung. Ist das Geld bis
    zum Ende des 5. Tages nach dem Bestelltag nicht da, storniert der Shop die Bestellung automatisch, und das Stück ist
    wieder frei.
  - Aufwand: ca. 1 Min. pro Bestellung

- [ ] **A44 · Widerrufe: Ware prüfen und spätestens 14 Tage nach dem Widerruf erstatten**
  - Warum: Das ist eine gesetzliche Frist. Die Verwaltung erinnert dich daran.
  - Aufwand: ca. 10 Min. pro Fall

- [ ] **A45 · Monatlich:** Einnahmen aus Tattoo, Flohmarkt, Auftragsarbeiten und Sonstigem im Umsatz-Wächter eintragen, Monatsexport und Rechnungen herunterladen
  - Warum: Alle Einnahmen zählen zur Kleinunternehmer-Grenze. Den Export brauchst du für deine Buchhaltung (EÜR).
  - Aufwand: ca. 15 Min. pro Monat

- [ ] **A46 · Jährlich bis 1. Juni:** Verpackungsmengen des Vorjahres in LUCID und beim dualen System melden, Lizenz fürs neue Jahr prüfen
  - Warum: Die Meldung ist Pflicht, und nur du selbst darfst sie abgeben. Die Zahlen holst du dir aus der Verwaltung:
    Dort gibt es eine Jahresliste der Verpackungsmengen, sortiert nach Material (Papier und Pappe, Kunststoff, Sonstiges).
  - Aufwand: ca. 30 Min. pro Jahr
  - Anleitung: [L2](ANLEITUNGEN.md#l2), Schritt 7

- [ ] **A47 · Jährlich:** Rechtstexte von der Kanzlei prüfen lassen
  - Warum: Gesetze ändern sich. Die Verwaltung erinnert dich einmal im Jahr.
  - Aufwand: ca. 15 Min. plus die Arbeit der Kanzlei

- [ ] **A48 · Laufend:** Neue Tattoo-Fotos erst nach einer Einwilligung zeigen. Nimmt jemand die Einwilligung zurück, entfernst du das Häkchen.
  - Warum: So verlangen es das Recht am eigenen Bild und der Datenschutz.
  - Aufwand: ca. 5 Min. pro Foto
  - Anleitung: [E1](ANLEITUNGEN.md#e1)

- [ ] **A49 · Datenschutz:** Auskunftsanfragen innerhalb eines Monats beantworten, Datenpannen innerhalb von 72 Stunden melden
  - Warum: Beides sind gesetzliche Fristen. Für die Auskunft gibt es in der Verwaltung einen eigenen Knopf.
  - Aufwand: nur wenn es vorkommt

- [ ] **A50 · Kosten im Blick behalten**
  - Warum: Das Ziel sind höchstens ca. 25 € im Monat. Du trägst die Kosten des Monats in der Verwaltung ein. Ab 30 €
    zeigt sie dir unter „Heute“ eine Warnung. Außerdem schicken dir die Anbieter Mails, wenn ein Limit fast erreicht
    ist. Beides nimmst du ernst.
  - Aufwand: ca. 5 Min. pro Monat

---

## Für Claude-Sessions (Jutta kann das überspringen)

**Regeln**
- Die Nummern A01–A50 (und A01a, A33a, A36a) bleiben fest. Nicht umnummerieren; neue Aufgaben kommen ans Ende (A51 …). Muss
  eine neue Aufgabe zwischen bestehende, bekommt sie die Nummer davor mit Buchstaben (wie A33a). Abschnitt 4 folgt der
  Reihenfolge von P11 bzw. ANLEITUNGEN Z1.
- In P1–P10 wird Jutta nichts gefragt (E-97). Fehlt Material von ihr, läuft die Arbeit mit Platzhalter oder Seed
  weiter, und der Punkt kommt in `docs/OFFENE-PUNKTE.md` (CLAUDE.md §2).
- In P11 werden Abschnitt 3 und 4 in dieser Reihenfolge abgehakt. Claude gibt keine Passwörter, Schlüssel, IBAN,
  Ausweis- oder Kartendaten ein und fordert sie nicht im Chat an. Jutta gibt sie selbst in die Formulare der
  Anbieter bzw. in die Verwaltung ein.
- Ändert ein Anbieter seine Oberfläche, wird `docs/owner/ANLEITUNGEN.md` im PR angepasst, nie `docs/ENTSCHEIDUNGEN.md`.

**Zuordnung**

| Aufgabe | Bezug | Wo es in der Software landet | Ersatz bis dahin |
|---|---|---|---|
| A01–A03 | E-97, E-99 | – | – |
| A01a | ARCHITEKTUR §6.6/§6.7, `docs/CLOUD-SETUP.md` §1 | Repository-Einstellung „Allow squash merging“ mit „Default commit message = Pull request title and description“ (API-Felder `squash_merge_commit_title = PR_TITLE`, `squash_merge_commit_message = PR_BODY`). Sessions ändern keine Repository-Einstellungen; sie mergen mit eigener Nachricht (`gh pr merge --squash --subject "<PR-Titel>" --body "<Kurzfassung>"`), und weder diese Nachricht noch eine PR-Beschreibung enthält je `[skip ci]` | Rückfall: `release.yml` läuft zusätzlich täglich (06:00 UTC) und per `workflow_dispatch` |
| A04, A06 | E-64 | `content/seed/instagram-export/` (Ordner mit `LIESMICH.txt` existiert seit P0) → Import in P8 (Formate: ANLEITUNGEN, Anhang) | 640-px-Bilder aus `content/seed/instagram/` |
| A05 | E-75 | `content/seed/coco/` (Ordner mit `LIESMICH.txt` existiert seit P0) → Coco-Zeichnungen in P9 | Highlight-Bilder (150 px) |
| A07 | E-97 | – | PR-Text „Bitte mergen – CI ist grün“ |
| A08, A28 | E-41, R-002 | `legal-texts` und `legal-snippets` mit `origin: 'lawyer'` | Rechtstexte als Platzhalter (`origin: 'placeholder'`, Grund-Seed), Textbausteine als Arbeitsfassung (`origin: 'draft'`) |
| A09, A23, A24, A38 | E-20, E-21 | Stripe-Schlüssel als Vercel-Umgebungsvariablen `STRIPE_*`, eingetragen in P11.6/P11.8. „Live“ heißt: Webhook auf `https://planetclairetattoos.com/api/stripe/webhook` (P11.14) und `settings.shop.isOpen = true` (P11.15). Vorher höchstens **Test**-Schlüssel in der Cloud, bevorzugt als API-Credential der Umgebung (`docs/CLOUD-SETUP.md` §3.9); nie Live-Schlüssel vor P11 | `PAYMENTS_DRIVER=mock` |
| A11, A12, A26 | E-40, E-46, E-50, KA-14, Kanzleifragen K-28 und K-39, R-021, R-205 | `settings.business.*` (Name, Adresse, Telefon, `economicId`, `taxNumber`), `settings.tax.modes`, `settings.payment.*` (IBAN, Kontoinhaberin), `settings.tattoo.studioDistrict`, `settings.pickup.instructions`. Adresse bleibt laut E-40 die Privatadresse, bis Jutta nach der Kanzleiberatung (Kanzleifrage K-39) anders entscheidet (Geschäftsadresse wäre nur ein anderer Wert im selben Feld) | Platzhalter („[Adresse folgt]“, Beispiel-IBAN) |
| A13, A48 | E-42, R-172 | `tattoo-gallery`: `consentGiven`, `consentDate`, `consentScope`, `creditHandleAllowed`, `consentEvidence` (privat) | Seed-Fotos nur bei `SEED_PREVIEW_MODE` |
| A14, A15, A42, A46 | E-47, R-200, R-201 | `settings.business.lucidNumber`, `settings.business.packagingScheme.*`; Verpackungsvorlagen `settings.packaging.templates` und Standard je Versandklasse `settings.packaging.defaultsByShippingClass` (Schätzwerte, KA-29), je Sendung `orders.packaging.*` beim Packen änderbar; Jahres-CSV `GET /api/admin/packaging-report?year=JJJJ` nach Material (Papier/Pappe, Kunststoff, Sonstiges) für LUCID und duales System (P5, im Umfang) | leer → Startklar rot |
| A17 | E-17, R-045 | Schmuck: `nickelFreeConfirmed`, `nickelEvidence` (privat), `metalPartsMaterial`, `leadFreeGlazeConfirmed` (Datenblatt als private Unterlage) | Schmuck nicht veröffentlichbar |
| A18 | E-15, R-044 | `conformity-declarations` (Laborbefund privat, Konformitätserklärung öffentlich) | alle Keramik `foodContact = deko` |
| A19, A34 | R-203 | Etikett-/Beileger-PDF (P5); technische Unterlagen und Lieferantenunterlagen als `private-uploads` (`technical_file`, `supplier_document`, je Kategorie) | – |
| A25, A33 | E-61, E-91–E-94 | Umgebungsvariablen (P11) | `STORAGE_DRIVER=local`, `EMAIL_DRIVER=file`, `TRANSLATION_DRIVER=mock`, `SENTRY_DSN` leer |
| A33a | EK-08, KUNST-QA §10 Nr. 4 | P11.9: Staging (Branch `staging`, Stripe-Testmodus, `SEED_PREVIEW_MODE=true`, `MAIL_REDIRECT_ALL_TO`); Testkauf mit einer veröffentlichten Stripe-Testkarte, die Jutta selbst eintippt; Befunde per PR (CI grün); Textkorrekturen erst in P11.10 in der Produktion (auf Staging gingen sie verloren) | – |
| A26 (IBAN) | E-23 | Einstellungen → Zahlung | Seed-IBAN |
| A27, A37 | E-95 | DNS bei IONOS (nur A/CNAME/AAAA; MX/SPF/DKIM/DMARC unverändert) | – |
| A21 | E-98, KA-21, Kanzleifrage K-34 | Artefakt `planet-claire-vorschau-<phase>-<sha7>` aus `preview-export.yml`; Phasen-Kennung aus `PREVIEW_PHASE` bzw. `[ci:full pN]` bzw. `PLAN.md` (ARCHITEKTUR §14.9), nie aus dem Branch-Namen; 30 Tage aufbewahrt, nur die 3 neuesten bleiben | – |
| A30, A31 | E-98, KA-21, CLAUDE.md §8 | Release `vorschau-p10` („Planet Claire – Vorschau (Stand P10)“), `docs/FORTSCHRITT.md`, `docs/OFFENE-PUNKTE.md`. Vorschau enthält Seed-Tattoofotos ohne Einwilligung → Banner „nicht öffentlich teilen“ (KA-21); derselbe Hinweis gehört in PR-Kommentar und Release-Text. Fotos mit Jutta sind nicht enthalten, solange sie nicht freigibt | – |
| A35 | R-155 | `settings.processorAgreements` | – |
| A36 | E-96, R-132 | `settings.analytics.enabled` + `settings.analytics.confirmedAt` (und `NEXT_PUBLIC_ANALYTICS_ENABLED`) | aus |
| A36a | ARCHITEKTUR §8.9, §10 | P11.12: age-Schlüsselpaar, offline von Jutta erzeugt; öffentlicher Schlüssel als `BACKUP_AGE_RECIPIENT`, `BACKUP_ENABLED=true` nur in Produktion; privater Schlüssel nur im Passwort-Manager und ausgedruckt, nie in Vercel, GitHub, Chat oder Umgebungsvariablen (Wiederherstellung mit `--identity <pfad>`) | `BACKUP_ENABLED=false` |
| A40 | R-022 | – | – |
| A41 | E-63, R-180, R-210 | „Beispieldaten entfernen“, `pnpm check:golive` | – |
| A45 | E-45 | Umsatz-Wächter: `revenue-entries` (manuelle Monatssummen je Quelle `tattoo`, `flohmarkt`, `auftragsarbeiten`, `sonstiges`) | – |
