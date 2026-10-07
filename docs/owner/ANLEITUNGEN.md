# Anleitungen

> **Für:** Jutta · **Stand:** 28.09.2026 · Gehört zu deiner Aufgabenliste [AUFGABEN.md](AUFGABEN.md)

Webseiten ändern sich ständig. Wenn ein Knopf etwas anders heißt als hier, such nach etwas Ähnlichem.
Wo wir uns beim Namen nicht sicher sind, steht **(so ähnlich)**. Genannt werden nur die Startseiten der Anbieter,
weil sich tiefere Links oft ändern.

## Inhalt

0. [Das gilt für alle Anleitungen](#regeln)
1. GitHub: [G1 Repository anlegen und einstellen](#g1) · [G2 Claude-App](#g2) · [G3 In die Cloud](#g3) ·
   [G4 Dateien hochladen](#g4) · [G5 Pull Request übernehmen](#g5) · [G6 Zwischen-Vorschau](#g6) ·
   [G7 Fertige Vorschau](#g7) · [G8 Dokument lesen oder als PDF speichern](#g8)
2. Vorschau-Datei: [V0 Vorschau-Datei ansehen](#v0) · [V1 Öffnen](#v1) · [V2 Worauf achten](#v2)
3. Instagram: [I1 Export anfordern](#i1) · [I2 Export hochladen](#i2) · [I3 Links in der Bio](#i3)
4. [C1 Coco-Fotos](#c1)
5. [E1 Einwilligungen für Tattoo-Fotos](#e1)
6. Stripe: [S1 Konto](#s1) · [S2 Schlüssel](#s2) · [S3 Verifizieren](#s3) · [S4 Start-Tag](#s4)
7. PayPal: [P1 Geschäftskonto](#p1) · [P2 Mit Stripe verbinden](#p2)
8. [K1 Kanzlei beauftragen](#k1)
9. Stammdaten: [T1 Telefon](#t1) · [T2 Steuerdaten](#t2) · [T3 Stammdaten und Bank](#t3)
10. Material: [M1 Nickelfreie Teile](#m1) · [M2 Glasuren](#m2) · [M3 Kennzeichnen](#m3)
11. Verpackung: [L1 LUCID](#l1) · [L2 Lizenz](#l2) · [L3 Material](#l3)
12. [R1 Markenrecherche](#r1)
13. Konten: [D0 Für alle](#d0) · [D1 Sentry](#d1) · [D2 DeepL](#d2) · [D3 Lettermint](#d3) · [D4 Neon](#d4) ·
    [D5 Cloudflare R2](#d5) · [D6 Vercel](#d6)
14. [N1 IONOS: DNS-Seite finden](#n1)
15. [F1 Erste echte Stücke](#f1)
16. [Z1 Der Start-Tag](#z1) · [Z2 Nach dem Start](#z2)
17. [Anhang für Claude-Sessions](#anhang)

---

<a id="regeln"></a>
## 0. Das gilt für alle Anleitungen

### Sicher anmelden

1. Nimm für jedes Konto ein eigenes, langes Passwort. Am einfachsten geht das mit einem Passwort-Manager. Das ist ein
   Programm, das Passwörter erzeugt und sich merkt. In deinem Handy und deinem Browser ist meist schon einer eingebaut.
2. Schalte überall die **Zwei-Faktor-Anmeldung (2FA)** ein. Dafür brauchst du eine Authenticator-App auf dem Handy,
   zum Beispiel „Google Authenticator“ oder „Microsoft Authenticator“ (beide kostenlos). Das Konto zeigt dir einen
   QR-Code, den scannst du mit der App. Ab dann zeigt die App alle 30 Sekunden einen neuen Code, den du beim
   Anmelden eintippst.
3. Viele Dienste geben dir dabei **Wiederherstellungscodes** (auch „Backup-Codes“). Druck sie aus oder schreib sie ab
   und leg sie zu deinen Unterlagen. Damit kommst du auch dann ins Konto, wenn das Handy weg ist.
4. Führ eine kleine Liste, aber **ohne Passwörter**: Dienst · angelegt am · Tarif · 2FA an (ja/nein).
   Die brauchen wir am Start-Tag.

### Was Claude nie tut

- Claude fragt dich nie nach Passwörtern, Codes, Schlüsseln, Ausweis- oder Kontodaten.
- Claude meldet sich nicht in deinen Konten an und tippt keine Zahlungs- oder Bankdaten ein. Das machst du, und
  Claude sagt dir, wo.
- Bittet dich jemand angeblich im Namen von Claude um so etwas, per Mail, Nachricht oder auf einer Webseite: nicht machen.
- Hast du aus Versehen einen Schlüssel in einen Chat kopiert? Sag es. Dann erzeugst du beim Anbieter einen neuen
  Schlüssel (so ähnlich: „Schlüssel rollen“ oder „neu generieren“), und der alte ist wertlos.

---

## 1. GitHub

Ein **Repository** (kurz Repo) ist dein Projektordner auf GitHub, in dem der ganze Code liegt.
Ein **Pull Request** (kurz PR) ist ein Änderungsvorschlag, den man prüfen und dann übernehmen („mergen“) kann.

<a id="g1"></a>
### G1 · Privates Repository anlegen und einstellen

> Hat Claude das Repository in P0 schon mit dir angelegt? Dann überspring die Schritte 3 bis 9. Schritt 2 und den Teil
> „Einmal einstellen“ weiter unten machst du trotzdem.

1. Öffne github.com und melde dich an.
2. Prüf die 2FA: Klick oben rechts auf dein Profilbild → „Settings“ → „Password and authentication“. Steht bei
   „Two-factor authentication“ „Enabled“, ist alles gut. Sonst klickst du auf „Enable two-factor authentication“
   und folgst den Schritten.
3. Oben rechts auf „+“ → „New repository“.
4. Bei „Repository name“ trägst du ein: `planetclairetattoos`
5. Stell bei „Choose visibility“ auf **„Private“** um (voreingestellt ist „Public“). Das ist wichtig, weil im Repo Fotos von Tattoos deiner Kund:innen und Beispieldaten liegen.
6. „Add README“ bleibt auf **Off**, bei „Add .gitignore“ bleibt **„No .gitignore“** und bei „Add license“
   **„No license“**. Das Repo muss leer sein.
7. Klick unten auf „Create repository“.
8. Schick Claude im Chat die Adresse aus der Adresszeile, zum Beispiel `https://github.com/dein-name/planetclairetattoos`.
   Die Adresse ist nicht geheim.
9. Claude lädt dann das Projekt hoch. Öffnet sich dabei ein Fenster zur GitHub-Anmeldung, meldest du dich dort selbst an.

<a id="g1a"></a>
**Einmal einstellen: was beim Übernehmen eines Pull Requests in die Nachricht kommt** (Aufgabe A01a)

Das machst du nur ein einziges Mal. Danach schreibt GitHub beim Übernehmen („mergen“) nur den Titel und die
Beschreibung des Pull Requests in die Nachricht. Sonst kommen alle Zwischenschritte hinein, und ein Vermerk darin kann
verhindern, dass die fertige Vorschau am Ende automatisch veröffentlicht wird.

1. Öffne dein Repo auf github.com. Du musst angemeldet sein.
2. Klick in der Reihe der Reiter oben (Code, Issues, Pull requests …) ganz rechts auf **„Settings“** (mit Zahnrad).
   Siehst du den Reiter nicht, klick auf „…“ am Ende der Reihe und dann auf „Settings“.
3. Links in der Spalte ist **„General“** schon ausgewählt. Wenn nicht, klick darauf.
4. Scroll nach unten bis zur Überschrift **„Pull Requests“**.
5. Setz das Häkchen bei **„Allow squash merging“**, falls es noch fehlt.
6. Direkt darunter ist ein Auswahlknopf ohne eigene Überschrift. Er zeigt anfangs „Default message“. Klick darauf
   und wähl **„Default to pull request title and description“**.
7. GitHub speichert das sofort: Neben „Allow squash merging“ erscheint kurz ein grünes Häkchen. Einen
   Speichern-Knopf gibt es nicht.
8. Die anderen Häkchen in diesem Abschnitt lässt du, wie sie sind. Fertig.

<a id="g2"></a>
### G2 · Claude GitHub App installieren

Mit dieser App darf Claude in der Cloud in genau diesem einen Repo arbeiten: Arbeitsstände hochladen und
Pull Requests anlegen.

1. Öffne github.com/apps/claude. Du musst bei GitHub angemeldet sein.
2. Klick auf „Install“. Ist die App schon installiert, heißt der Knopf „Configure“.
3. Wähl dein Konto.
4. Wähl „Only select repositories“ und darunter `planetclairetattoos`. So sieht Claude nur dieses eine Repo.
5. Bestätige mit „Install“ (manchmal „Install & Authorize“, bei schon installierter App „Save“). GitHub zeigt dir vorher, was die App darf, zum Beispiel Code lesen und
   schreiben oder Pull Requests anlegen. Das ist so nötig.
6. Will GitHub dein Passwort oder einen 2FA-Code, gibst du ihn selbst ein.

Es geht auch anders herum: Beim ersten Start einer Cloud-Session fragt Claude selbst nach der App und schickt dich
auf die richtige Seite. Dann folgst du einfach den Schritten dort.

<a id="g3"></a>
### G3 · Die Arbeit in die Cloud schieben

Die genauen Einstellungen der Cloud-Umgebung stehen in **`docs/CLOUD-SETUP.md`**: Netzwerk, Setup und welches
Claude-Abo nötig ist. Claude geht sie am Ende von P0 mit dir durch. Kurz gesagt:

1. Warte, bis Claude meldet: P0 ist fertig, alles liegt auf GitHub (im Branch `main`, das ist der Hauptstand des
   Projekts), die Prüfungen sind grün.
2. G1 und G2 sind erledigt.
3. Richte zusammen mit Claude die Cloud-Umgebung `planetclaire` ein (`docs/CLOUD-SETUP.md`, Abschnitt 1).
4. Starte eine **neue Cloud-Session**: Repository `planetclairetattoos`, Branch `main`, Umgebung `planetclaire`.
   Dann schickst du die zwei Nachrichten aus `docs/CLOUD-SETUP.md`, Abschnitt 2.1: die Ziel-Zeile und den
   Kickoff-Text.
   **Genauso gut geht:** In der Claude-Desktop-App in der P0-Session auf „Continue in“ → „Claude Code on the Web“
   klicken (so ähnlich: „In der Cloud fortsetzen“). Wichtig ist nur, dass dabei die Umgebung `planetclaire` gewählt
   ist. Danach schickst du dieselben zwei Nachrichten. Die Einzelheiten stehen in `docs/CLOUD-SETUP.md`, Abschnitt 2.4.
5. Die P0-Session auf deinem Computer arbeitet danach nicht weiter. Es arbeitet immer nur **eine** Session am Projekt.
6. Fertig. Dein Computer darf jetzt aus sein. Wenn es Neues gibt, schickt dir GitHub eine Mail, zum Beispiel zu
   einem neuen Pull Request.

Bleibt eine Session stehen, zum Beispiel weil dein Nutzungskontingent aufgebraucht ist, geht nichts verloren. Die
nächste Session macht bei der ersten offenen Aufgabe in `PLAN.md` weiter. Wie du sie startest, steht in
`docs/CLOUD-SETUP.md`, Abschnitt 2.2.

<a id="g4"></a>
### G4 · Dateien im Browser auf GitHub hochladen

Das brauchst du für den Instagram-Export ([I2](#i2)) und die Coco-Fotos ([C1](#c1)). Am besten machst du es am
Computer.

**Grenzen von GitHub:** höchstens **25 MB pro Datei** und höchstens **100 Dateien auf einmal**.

**Zum richtigen Ordner gehen**

Beide Ordner gibt es schon. Anlegen musst du nichts.

1. Öffne dein Repo auf github.com.
2. Klick nacheinander auf die Ordner `content` und dann `seed`.
3. Klick den Zielordner an: `coco` für die Coco-Fotos oder `instagram-export` für den Instagram-Export.
   Darin liegt schon eine kleine Datei `LIESMICH.txt`. Die lässt du einfach drin.

**Hochladen**

1. Klick im Zielordner auf „Add file“ → „Upload files“.
2. Zieh die Dateien in das Feld oder klick auf „choose your files“. Du kannst auch ganze Ordner hineinziehen, die
   Unterordner bleiben dabei erhalten.
3. Warte, bis alle Dateien unten in der Liste stehen. Eine rote Meldung heißt meist: Eine Datei ist größer als 25 MB,
   oder es sind mehr als 100 Dateien. Dann lässt du diese Datei weg oder lädst in kleineren Portionen hoch.
4. Unten bei „Commit changes“ schreibst du kurz rein, was es ist, zum Beispiel „Coco-Fotos“ oder „Instagram-Export Teil 2“.
5. Wähl „Commit directly to the main branch“ und klick auf „Commit changes“.
6. Warte, bis die Seite neu lädt und deine Dateien in der Liste stehen.

Tipp: Läuft gerade eine Cloud-Session, kannst du ihr kurz schreiben: „Ich habe neue Dateien in content/seed/coco
hochgeladen.“ Nötig ist das nicht, spätestens die nächste Session findet sie.

<a id="g5"></a>
### G5 · Einen Pull Request übernehmen („mergen“)

Meistens übernimmt Claude seine Arbeit selbst. Steht aber oben im Pull Request **„Bitte mergen – CI ist grün“**,
bist du dran:

1. Öffne dein Repo und geh auf den Reiter „Pull requests“.
2. Klick den Pull Request mit diesem Hinweis an.
3. Scroll ganz nach unten. Steht dort ein grüner Haken und „All checks have passed“? Dann machst du weiter.
   Steht dort **gar keine Prüfung**, nur „This branch has no conflicts with the base branch“ (so ähnlich)? Auch dann
   machst du weiter. Das ist normal: Claude lässt GitHub nur am Ende einer Phase prüfen und schreibt danach nur noch
   Notizen dazu, die keine Prüfung brauchen.
   Bei einem roten Kreuz, einem gelben Punkt (die Prüfung läuft noch) oder „This branch has conflicts“ tust du
   **nichts**. Darum kümmert sich Claude.
4. Klick auf „Squash and merge“ (so ähnlich, der Knopf kann auch „Merge pull request“ heißen).
5. GitHub zeigt dir jetzt die Nachricht zum Übernehmen (Titel und Beschreibung des Pull Requests). Lass sie, wie sie
   ist, und klick auf „Confirm squash and merge“ (oder „Confirm merge“).
6. Fertig. Den Knopf „Delete branch“, der danach erscheint, klickst du **nicht** an.

<a id="g6"></a>
### G6 · Eine Zwischen-Vorschau herunterladen (ab P2)

Am Ende jeder Phase baut GitHub automatisch eine Vorschau-Datei der ganzen Seite. Zwischendurch gibt es keine neue.
GitHub nennt so eine Datei „Artefakt“. Sie bleibt höchstens 30 Tage liegen, und es bleiben immer nur die 3 neuesten.
Im Namen steht, zu welcher Phase sie gehört, zum Beispiel `p3` für Phase P3.

**Nur für dich:** Die Vorschau zeigt Beispiel-Tattoofotos von Kund:innen, die noch nicht eingewilligt haben. Schau sie
dir nur privat an. Gib sie nicht weiter und veröffentliche sie nicht ([V1](#v1)).

Am einfachsten geht es über den Pull Request: Dort schreibt GitHub einen Kommentar wie „Neue Vorschau-Datei für
Phase P3“ mit einer kurzen Anleitung. Sonst so:

1. Öffne dein Repo (angemeldet) und geh auf den Reiter „Actions“.
2. Wähl links den Ablauf „Vorschau-Export“.
3. Klick in der Liste auf den obersten Lauf mit grünem Haken.
4. Scroll auf der Übersichtsseite („Summary“) nach unten bis „Artifacts“.
5. Klick auf den Namen, zum Beispiel `planet-claire-vorschau-p3-1a2b3c4`. Es lädt eine ZIP-Datei herunter.
6. Pack die ZIP-Datei aus: unter Windows mit Rechtsklick → „Alle extrahieren“, am Mac mit Doppelklick.
7. Öffne im ausgepackten Ordner `planet-claire-vorschau.html`, wie in [V1](#v1) beschrieben.

<a id="g7"></a>
### G7 · Die fertige Vorschau herunterladen (nach P10)

1. Öffne dein Repo und klick rechts auf „Releases“.
2. Klick auf „Planet Claire – Vorschau (Stand P12)“ (Kurzname `vorschau-p12`, die neueste Fassung nach deiner
   Überarbeitung; die ältere „Stand P10“ bleibt zum Vergleich stehen). Spätere Fassungen heißen `vorschau-JJJJ-MM-TT`.
3. Klick unter „Assets“ auf `planet-claire-vorschau.html`. Die Datei lädt direkt herunter, ohne ZIP.
4. Öffne sie wie in [V1](#v1) beschrieben.

Auch diese Datei ist **nur für dich**, genau wie die Zwischen-Vorschau ([G6](#g6)): nur privat ansehen, nicht
weitergeben, nicht veröffentlichen.

Im Text zum Release steht, wie groß die Datei ist. Ist sie größer als 20 MB, steht dort: „Die Datei ist zu groß für
eine Mail – auf einen anderen eigenen Rechner bringen (per Link oder USB-Stick).“ Willst du sie auf deinem anderen
Rechner ansehen, lädst du sie dort genauso herunter (bei GitHub angemeldet) oder kopierst sie per USB-Stick. Das ist in
Ordnung, solange nur deine eigenen Geräte sie bekommen.

<a id="g8"></a>
### G8 · Ein Dokument auf GitHub lesen oder als PDF speichern

So liest du zum Beispiel die Kanzlei-Mappe, den Abschlussbericht oder die offenen Punkte.

1. Öffne dein Repo und klick dich durch die Ordner, zum Beispiel `docs` → `recht` → `KANZLEI-BRIEFING.md`.
2. GitHub zeigt dir die Datei ordentlich formatiert an.
3. Als PDF speichern: Drück Strg + P (am Mac Cmd + P), wähl als Drucker „Als PDF speichern“ und klick auf „Speichern“.

---

## 2. Vorschau-Datei

Die Vorschau ist deine ganze Website in einer einzigen Datei. Sie läuft ohne Internet und ohne Konten.

<a id="v0"></a>
### V0 · Vorschau-Datei ansehen

Am Ende jeder Phase legt GitHub eine neue Vorschau-Datei an. So kommst du in drei Schritten hin:

1. **Checks:** Öffne den aktuellen Pull Request (Reiter „Pull requests“, dann den obersten Eintrag). Klick oben auf
   den Reiter „Checks“. Links siehst du eine Liste. Klick dort auf „Vorschau-Export“.
2. **Summary:** Klick links oben auf „Summary“ (Übersicht). Dort steht auch eine kurze Anleitung auf Deutsch.
3. **Artifacts:** Scroll ganz nach unten bis „Artifacts“ (das sind die Dateien zum Herunterladen). Klick auf den Namen,
   zum Beispiel `planet-claire-vorschau-p2-1a2b3c4`. Eine ZIP-Datei lädt herunter. `p2` heißt: Stand nach Phase P2.
4. **ZIP entpacken:** Unter Windows Rechtsklick auf die ZIP-Datei → „Alle extrahieren“. Am Mac reicht ein Doppelklick.
5. **Doppelklicken:** Im ausgepackten Ordner `planet-claire-vorschau.html` doppelklicken. Die Seite öffnet sich im
   Browser, ganz ohne Internet. Mehr dazu in [V1](#v1).

Einfacher geht es oft über den Kommentar im Pull Request: „Neue Vorschau-Datei für Phase …“. Darin ist ein Link direkt
zur richtigen Seite.

Gut zu wissen:

- Es bleiben immer nur die 3 neuesten Vorschau-Dateien, jede höchstens 30 Tage. Ältere verschwinden von selbst.
- Die Datei ist **nur für dich**: nur privat ansehen, nicht weitergeben, nicht veröffentlichen. Darin sind
  Beispieldaten und Rechtstexte, die noch Platzhalter sind (also noch nicht von der Kanzlei geprüft).
- Du musst sie nicht ansehen. Die Arbeit geht auch ohne dich weiter.

<a id="v1"></a>
### V1 · Öffnen

1. Doppelklick auf `planet-claire-vorschau.html`. Die Datei öffnet sich in deinem Browser. Am besten nimmst du einen
   aktuellen Chrome, Edge, Firefox oder Safari.
2. Fragt Windows, womit du die Datei öffnen willst, wählst du deinen Browser.
3. Die Datei ist groß (meist höchstens 20 MB, nie mehr als 40 MB). Warte ein paar Sekunden.
4. Vielleicht warnt der Browser beim Herunterladen, zum Beispiel „Diese Datei wird selten heruntergeladen“ oder
   „kann schädlich sein“ (so ähnlich). Kommt die Datei aus **deinem eigenen** GitHub-Repo, ist das unbedenklich.
   Die Warnung erscheint nur, weil HTML-Dateien selten heruntergeladen werden. Die Datei läuft nur auf deinem
   Rechner und schickt nichts ins Internet. Wähl „Behalten“ (so ähnlich). Kommt eine solche Datei aus einer anderen
   Quelle, zum Beispiel als Mail-Anhang von Unbekannten, öffnest du sie nie.
5. Oben steht der Streifen „Vorschau – hier wird nichts gekauft“. Über den Knopf „Alle Seiten“ kommst du zu jeder Seite.
6. Am Handy klappt das nicht zuverlässig, nimm lieber den Computer.

**Die Datei ist nur für dich.** Darin sind Beispieldaten und Tattoo-Fotos von Kund:innen, die noch nicht eingewilligt
haben. Fotos, auf denen du zu sehen bist, kommen erst hinein, wenn du sie freigibst. Deshalb:

- Schau sie dir nur privat an.
- Gib sie nicht an andere weiter, weder per Mail noch per Messenger noch auf einem USB-Stick. Auf deine eigenen Geräte
  darfst du sie kopieren ([G7](#g7)).
- Veröffentliche sie nicht und lade sie nirgends hoch, auch nicht auf Instagram oder in einen Online-Speicher wie Dropbox.
- Hast du sie aus Versehen weitergegeben? Sag es Claude beim nächsten Mal, dann überlegen wir zusammen, was zu tun ist.

<a id="v2"></a>
### V2 · Worauf du beim Anschauen achten kannst

- Klingen die Texte nach dir?
- Stimmen die Fakten über dich, Coco, deine Arbeit, die Preise und den Ablauf beim Tattoo?
- Gefallen dir die Linie, Coco, die Farben und die Schrift?
- Findest du dich zurecht, am Computer und im Handy-Format? Tipp: Zieh das Browserfenster ganz schmal.
- Die Kasse und alle Formulare sind Attrappen. Die Verwaltung siehst du nur als Bilder.

Schreib Anmerkungen am besten so auf: **Seite · was dir auffällt · wie es sein soll.**
Beispiel: „Über mich · da steht Koko · bitte ‚Coco‘“.
Sammle alles für den Start-Tag, dort gehen wir die Liste gemeinsam durch. Du kannst Anmerkungen auch als Kommentar in
den aktuellen Pull Request schreiben.

---

## 3. Instagram

<a id="i1"></a>
### I1 · Datenexport anfordern

Du bekommst ein Paket mit deinen Fotos in voller Qualität. Wir brauchen nur deine **Inhalte** (Beiträge, Stories,
Reels) und **keine Nachrichten**.

**Am Handy, in der Instagram-App:**

1. Geh auf dein Profil und tipp oben rechts auf das Menü (drei Striche).
2. Tipp auf „Kontenübersicht“ (bei Meta heißt das auch „Accounts Center“).
3. Dann „Deine Informationen und Berechtigungen“ → „Deine Informationen herunterladen“.
4. „Informationen herunterladen oder übertragen“ (so ähnlich) → wähl das Konto `planet.claire.tattoos`.
5. Wähl „Einige deiner Informationen“, **nicht** „Alle verfügbaren Informationen“.
6. Hak **nur „Inhalte“** an. Manchmal stehen die Punkte einzeln da: „Beiträge“, „Stories“, „Reels“. Profilfotos
   dürfen mit.
   **Nicht** anhaken: Nachrichten, Kommentare, Follower, Kontakte, persönliche Informationen. Darin stecken Daten
   anderer Leute, und die gehören nicht auf GitHub.
7. „Weiter“ → „Auf Gerät herunterladen“.
8. Stell ein: Zeitraum **„Gesamter Zeitraum“** · Format **„JSON“** · Medienqualität **„Hoch“**. Prüf die Mail-Adresse,
   an die die Benachrichtigung geht.
   JSON heißt: Beschreibungen und Daten kommen in einer Form, die ein Programm lesen kann. Die Fotos sind in beiden
   Formaten gleich.
9. Tipp auf „Dateien erstellen“.

**Am Computer** geht es genauso: instagram.com → unten links „Mehr“ → „Einstellungen“ → „Kontenübersicht“, dann ab Schritt 3.

Jetzt heißt es warten. Meist dauert es Minuten bis Stunden, höchstens etwa 48 Stunden. Wenn der Export fertig ist,
bekommst du eine Mail oder eine Benachrichtigung.

<a id="i2"></a>
### I2 · Export herunterladen und auf GitHub hochladen

Mach das bald nach der Mail, denn der Download-Link gilt nur wenige Tage.

1. Geh am Computer wieder zu „Deine Informationen herunterladen“ ([I1](#i1), Schritte 1–3). Dort steht dein Export
   mit einem Knopf „Herunterladen“.
2. Klick auf „Herunterladen“. Instagram fragt nach deinem Passwort, das gibst du selbst ein. Manchmal sind es mehrere
   ZIP-Dateien („Teil 1 von 3“). Dann lädst du alle herunter.
3. Schau nach, wie groß die ZIP-Datei ist: unter Windows mit Rechtsklick → „Eigenschaften“, am Mac mit
   Rechtsklick → „Informationen“.

Alles kommt in den Ordner `content/seed/instagram-export/`. Den gibt es schon ([G4](#g4)).

**Fall A: Jede ZIP-Datei ist höchstens 25 MB groß** (kommt selten vor)

Lad die ZIP-Datei(en) unverändert in den Ordner `content/seed/instagram-export/` hoch ([G4](#g4)). Fertig.

**Fall B: Die ZIP-Datei ist größer als 25 MB** (der Normalfall)

GitHub nimmt im Browser keine Dateien über 25 MB. Deshalb packst du die ZIP-Datei aus und lädst die Fotos in Portionen hoch.

1. Pack die ZIP-Datei aus: unter Windows mit Rechtsklick → „Alle extrahieren“, am Mac mit Doppelklick.
2. Im ausgepackten Ordner findest du (so ähnlich) einen Ordner `media` mit den Unterordnern `posts` und `stories`.
   Darin liegen Monatsordner wie `202507`. Außerdem gibt es einen Ordner mit Textdateien, die auf `.json` enden,
   zum Beispiel `your_instagram_activity`.
3. Geh auf GitHub in den Ordner `content/seed/instagram-export` ([G4](#g4)).
4. Öffne auf deinem Computer `media` → `posts`. Zieh jeweils ein paar Monatsordner auf einmal in das Upload-Feld
   bei GitHub, zusammen höchstens 100 Dateien. Dann „Commit changes“. Wiederhol das, bis alle Monate oben sind.
5. Mach es genauso mit den Monatsordnern aus `stories`. Da steckt auch Coco aus deinen Highlights drin. Heißt ein
   Monatsordner genauso wie einer aus `posts`, ist das kein Problem. Claude findet die Fotos später über ihre
   Dateinamen.
6. Den Ordner mit den `.json`-Dateien (zum Beispiel `your_instagram_activity`) ziehst du als Ganzes in denselben
   Ordner `content/seed/instagram-export`.
7. **Videos (Dateien auf `.mp4`) lässt du weg.** Sie sind meist zu groß und werden nicht gebraucht. Den Ordner
   `reels` brauchst du deshalb gar nicht.
8. Ist eine einzelne Datei größer als 25 MB, lässt du sie weg.

Wie viele Dateien in einem Ordner liegen, siehst du unter Windows mit Rechtsklick → „Eigenschaften“ (bei „Inhalt“),
am Mac, wenn du den Ordner auswählst und Cmd + I drückst.

Sind es sehr viele Fotos, mehr als etwa 500? Dann lad zuerst die Beiträge der letzten zwei Jahre und die Stories
mit Coco hoch. Das reicht für den Anfang.

Keine Sorge wegen der Fotos von Kund:innen im Export: Das Repo ist privat, und auf der echten Website erscheint kein
Foto mit Kund:innen ohne dein Einwilligungs-Häkchen ([E1](#e1)).

<a id="i3"></a>
### I3 · Links in der Instagram-Bio (erst am Start-Tag)

Das machst du erst, wenn die Seite live ist.

1. Instagram-App → dein Profil → „Profil bearbeiten“.
2. „Links“ → „Externen Link hinzufügen“.
3. Bei URL trägst du `https://planetclairetattoos.com` ein, als Titel „Shop & Tattoo“. Dann „Fertig“.
4. Noch einmal „Externen Link hinzufügen“: URL `https://planetclairetattoos.com/impressum`, Titel „Impressum“. Dann „Fertig“.
5. Test: Schau dir dein Profil an und tipp beide Links an. Das Impressum muss sich öffnen.

Warum das Impressum? Ein Profil, das du geschäftlich nutzt, braucht eine leicht erreichbare Anbieterangabe (§ 5 DDG).

---

<a id="c1"></a>
## 4. Coco-Fotos

Coco wird als Linienzeichnung in sechs Posen gezeichnet. Die Highlight-Bildchen sind nur 150 Pixel groß. Erst mit
deinen Fotos wird sie wirklich Coco.

**Gesucht sind 5–10 Fotos, am besten mindestens eins pro Pose:**

| Pose | Dateiname (Vorschlag) | Worauf achten |
|---|---|---|
| rennen | `coco-rennen-1.jpg` | von der Seite, ganzer Körper, alle Beine sichtbar |
| schnüffeln | `coco-schnueffeln-1.jpg` | Nase am Boden, von der Seite |
| sitzen | `coco-sitzen-1.jpg` | ganzer Körper, von vorn oder schräg |
| schlafen | `coco-schlafen-1.jpg` | eingerollt, von oben oder schräg |
| springen | `coco-springen-1.jpg` | in der Luft, von der Seite |
| Kopf schief | `coco-kopfschief-1.jpg` | Kopf und Ohren gut sichtbar |

Zusätzlich, wenn du welche hast: Coco im Stehen genau von der Seite, und Coco mit ihrem roten Geschirr.

**So werden die Fotos gut:**

- Der ganze Hund ist im Bild, nichts ist abgeschnitten, vor allem nicht Ohren, Pfoten und Schwanz.
- Die Fotos sind scharf. Bei Bewegung hilft ein Serienbild: den Auslöser gedrückt halten und das beste Foto aussuchen.
- Tageslicht, ein ruhiger Hintergrund, und die Kamera auf Cocos Höhe.
- Nimm Originalfotos aus deiner Galerie. Keine Screenshots und nichts, was schon über WhatsApp verschickt wurde, denn
  dabei werden die Fotos klein.
- Am besten ist das Format `.jpg`. iPhone-Fotos (`.heic`) gehen auch. Wenn du sie per Kabel auf einen Windows-PC
  überträgst, wandelt das iPhone sie meist in JPG um (Einstellung am iPhone: „Fotos“ → „Auf Mac oder PC übertragen“ → „Automatisch“).
- Umbenennen ist freiwillig, hilft aber beim Zuordnen.
- Nur wenn du magst: Ein kurzes Video vom Rennen (unter 25 MB) hilft bei der Animation.

**Hochladen:** in den Ordner `content/seed/coco/`, den es schon gibt ([G4](#g4)).

Die Fotos dienen nur als Zeichenvorlage und werden nie veröffentlicht.

---

<a id="e1"></a>
## 5. Einwilligungen für Tattoo-Fotos

Fotos, auf denen man die Haut oder das Gesicht deiner Kund:innen sieht, erscheinen auf der Website nur mit deren
Einwilligung. Pro Foto gibt es in der Verwaltung ein Häkchen, und ohne Häkchen wird das Foto nicht gezeigt.
**Eine Freigabe für Instagram gilt nicht automatisch auch für die Website.**

1. Such die Fotos aus, die du auf der Website zeigen willst (Fresh und Healed). Dazu gehören auch die zwei
   Beispielfotos „3,5 years healed“ und „Godzilla and the bunnies“.
2. Schick der Person eine DM mit dem Text unten und häng das Foto an.
3. Mach von der Antwort einen Screenshot.
4. Speicher die Screenshots in einem Ordner auf deinem Computer, zum Beispiel „Einwilligungen Website“.
   **Nicht auf GitHub.**
5. Führ eine Liste auf Papier oder in einer Tabelle: Datum · Instagram-Name · welches Foto · Antwort (1, 2 oder 3) ·
   Namen nennen ja/nein.
6. Am Start-Tag trägst du alles in der Verwaltung ein: Tattoo → Galerie → Foto → Häkchen „Einwilligung liegt vor“,
   dazu Datum, Umfang und ob der Instagram-Name dazu darf. Den Screenshot lädst du als Nachweis hoch.
7. Nimmt jemand die Einwilligung zurück, entfernst du das Häkchen. Dann ist das Foto sofort offline.

Die Antworten bedeuten: **1** = nur Fotos ohne Gesicht · **2** = auch Fotos, auf denen man das Gesicht erkennt ·
**3** = das Foto nicht zeigen.

Die Kanzlei kann den Text mitprüfen, er steht in der Briefing-Mappe. Du kannst ihn aber schon jetzt so benutzen.

**DM auf Deutsch** (zum Kopieren; auf GitHub gibt es oben rechts am Kasten einen Kopier-Knopf):

```text
Hi [Name], ich baue gerade meine Website planetclairetattoos.com. Darf ich dort das Foto von deinem Tattoo zeigen? Ich hänge es dir an. Es käme in die Tattoo-Galerie.

Bitte antworte kurz mit einer Zahl:
1 = Ja, aber nur das Tattoo, ohne dein Gesicht
2 = Ja, auch wenn man dein Gesicht erkennt
3 = Lieber nicht

Und: Soll ich deinen Instagram-Namen dazuschreiben? (ja/nein)

Das ist komplett freiwillig. Du kannst deine Zustimmung jederzeit zurücknehmen, eine kurze Nachricht an mich reicht. Dann nehme ich das Foto sofort von der Website. Es geht hier nur um die Website, nicht um Instagram.

Danke dir!
Jutta
```

**DM auf Englisch:**

```text
Hi [name], I'm building my website planetclairetattoos.com. May I show the photo of your tattoo there? It's attached. It would go into the tattoo gallery.

Please reply with a number:
1 = Yes, but only the tattoo, without your face
2 = Yes, even if your face can be recognised
3 = I'd rather not

And: should I add your Instagram name? (yes/no)

This is completely voluntary. You can withdraw your consent at any time, a short message to me is enough. I'll then take the photo off the website right away. This is only about the website, not Instagram.

Thank you!
Jutta
```

---

## 6. Stripe

Stripe wickelt Karte, Apple Pay, Google Pay und PayPal ab. Bis zum Start reicht der **Testmodus**, darin fließt kein
echtes Geld.

<a id="s1"></a>
### S1 · Konto anlegen und Testmodus

1. Geh auf stripe.com und klick auf „Jetzt starten“ (so ähnlich).
2. Gib ein: E-Mail `jutta@planetclairetattoos.com`, deinen vollen Namen, Land „Deutschland“ und ein sicheres Passwort.
3. Öffne die Mail von Stripe und bestätige deine Adresse.
4. Fragt Stripe gleich nach Firmendaten, Ausweis oder Bankkonto, klickst du auf „Später“ oder „Überspringen“ (so ähnlich).
   Das kommt erst in [S3](#s3).
5. Schalt die 2FA ein, in den Einstellungen unter „Sicherheit“ oder „Zwei-Schritt-Authentifizierung“ (so ähnlich).
   Heb den Backup-Code auf.
6. Oben im Dashboard gibt es einen Schalter „Testmodus“ (bei Stripe teils auch „Sandbox“). Damit kannst du dich ohne
   Risiko umschauen.
7. **Nicht einschalten**, auch wenn Stripe es anbietet: Klarna, SEPA-Lastschrift, Banküberweisung und „Link“. Das ist
   bewusst so entschieden. Die Zahlarten stellen wir am Start-Tag zusammen ein.

Mehr ist bis zum Start nicht zu tun. Die Entwicklung braucht deine Schlüssel nicht, sie arbeitet mit einer Attrappe.

<a id="s2"></a>
### S2 · Wo die Schlüssel liegen (nur zum Wissen)

Ein Schlüssel ist eine lange Zeichenkette, mit der sich deine Website bei Stripe ausweist.

- Du findest sie im Dashboard unter „Entwickler“ → „API-Schlüssel“ (so ähnlich).
- Der „veröffentlichbare Schlüssel“ beginnt mit `pk_`, der „geheime Schlüssel“ mit `sk_`. Im Testmodus steht darin
  `_test_`, bei echtem Geld `_live_`.
- Der geheime Schlüssel ist wie der Generalschlüssel zu deiner Kasse. Er kommt nie in einen Chat, eine Mail oder auf GitHub.
- Am Start-Tag kopierst du ihn selbst in die Einstellungen bei Vercel. Die heißen dort „Umgebungsvariablen“: geschützte
  Einstellungen, die nur deine Website lesen kann. Claude zeigt dir das Feld, sieht den Schlüssel aber nicht.
- Vor dem Start braucht die Cloud-Entwicklung keinen Schlüssel. Willst du ihr trotzdem einmal einen geben, dann nur
  einen **Test**-Schlüssel (mit `_test_`), am besten als „API credential“ der Cloud-Umgebung. So sieht niemand in der
  Session den Schlüssel. Wie das geht, steht in `docs/CLOUD-SETUP.md`, Abschnitt 3.9. Ein Schlüssel mit `_live_`
  kommt **nie** in die Cloud-Umgebung.
- Hast du ihn aus Versehen geteilt? Klick sofort im selben Menü auf „Schlüssel rollen“ (so ähnlich). Dann ist der
  alte Schlüssel ungültig.

<a id="s3"></a>
### S3 · Konto verifizieren (vor dem Start)

Mach das 1–2 Wochen vor dem Start, denn Stripe prüft manchmal einige Tage. Die erste Auszahlung kommt außerdem erst
7 Tage nach der ersten echten Zahlung.

**Leg dir bereit:** Personalausweis oder Reisepass, deine Steuernummer ([T2](#t2)), die IBAN des Kontos für
Auszahlungen und deine Handynummer.

1. Klick im Dashboard auf „Konto aktivieren“ oder „Zahlungen aktivieren“ (so ähnlich).
2. Unternehmensart: „Einzelunternehmen“. Einen Handelsregistereintrag hast du nicht.
3. Branche: so ähnlich wie „Kunst/Kunsthandwerk“ oder „Einzelhandel“.
4. Website: `https://planetclairetattoos.com`. Ist die Seite noch nicht online, gibst du dein Instagram-Profil an:
   `https://www.instagram.com/planet.claire.tattoos/`
5. Beschreibung, zum Beispiel: „Verkauf handgemachter Unikate: Keramik, bemalte Second-Hand-Kleidung, Zeichnungen, Schmuck“.
6. Persönliche Daten, Adresse und ein Foto deines Ausweises gibst du alles selbst ein.
7. Steuer: deine Steuernummer. Hast du als Kleinunternehmerin keine USt-IdNr., lässt du das Feld leer, falls es freiwillig ist.
8. Das Bankkonto (IBAN) für die Auszahlungen.
9. Text auf den Kontoauszügen deiner Kund:innen: `PLANETCLAIRE`
10. Mail für den Kundensupport: `jutta@planetclairetattoos.com`
11. Absenden. Fehlt noch etwas, meldet sich Stripe per Mail.

<a id="s4"></a>
### S4 · Was wir am Start-Tag zusammen einstellen

Merken musst du dir das nicht. Es steht hier nur, damit du weißt, was kommt.

- Zahlarten: nur Karte (mit Apple Pay und Google Pay) und PayPal.
- „Link“ aus. Außerdem die automatischen Stripe-Quittungen an Kund:innen aus, weil der Shop eigene Mails schickt.
- Webhook: eine Adresse, über die Stripe dem Shop meldet, dass bezahlt wurde. Zuerst zeigt sie auf die vorläufige
  Vercel-Adresse, nach dem Umstellen der Domain auf planetclairetattoos.com.
- Die echten Schlüssel (`_live_`) kopierst du selbst in Vercel, gleich beim Einrichten am Anfang des Start-Tags.
- „Live“ ist Stripe erst ganz am Ende: wenn der Webhook auf planetclairetattoos.com zeigt und wir den Shop öffnen.
  Direkt danach kommt der Testkauf ([Z1](#z1)).

---

## 7. PayPal

<a id="p1"></a>
### P1 · Geschäftskonto eröffnen

Ein privates PayPal-Konto reicht nicht. Die Mail-Adresse darf noch bei keinem anderen PayPal-Konto hinterlegt sein.

1. Geh auf paypal.com → „Registrieren“ → „Geschäftskonto“ (so ähnlich).
2. Gib `jutta@planetclairetattoos.com` und ein Passwort ein.
3. Geschäftsdaten: Einzelunternehmen, Geschäftsname „Planet Claire“, deine Adresse und eine Kategorie
   (so ähnlich wie „Kunst/Kunsthandwerk“).
4. Füll die persönlichen Angaben aus und bestätige die Mail.
5. Verknüpf dein Bankkonto (IBAN), das gibst du selbst ein. PayPal bestätigt es vielleicht mit einer kleinen
   Testüberweisung.
6. Will PayPal deine Identität prüfen, folgst du den Schritten.
7. 2FA: Einstellungen → „Sicherheit“ → „Bestätigung in zwei Schritten“ (so ähnlich).

<a id="p2"></a>
### P2 · PayPal mit Stripe verbinden

Das geht erst, wenn dein Stripe-Konto verifiziert ist ([S3](#s3)).

1. Stripe-Dashboard (Testmodus aus) → „Einstellungen“ → „Zahlungsmethoden“ (so ähnlich).
2. Such „PayPal“ und klick auf „Aktivieren“ oder „Einrichten“.
3. Stripe schickt dich zu PayPal. Melde dich dort selbst mit dem **Geschäftskonto** an und erlaube die Verbindung.
4. Zurück bei Stripe steht PayPal auf „Aktiv“ oder „Ausstehend“. „Ausstehend“ ist normal, PayPal prüft manchmal ein paar Tage.
5. Fragt Stripe, wohin das PayPal-Geld fließen soll (ins Stripe-Guthaben oder auf dein PayPal-Konto) und du bist
   unsicher? Dann brich hier ab, wir entscheiden das am Start-Tag zusammen. Gut zu wissen: Beim „Stripe-Guthaben“
   liegt alles an einem Ort, das macht die Monatsübersicht einfacher.
6. Ist der Knopf grau, ist die Prüfung deines Stripe-Kontos noch nicht fertig. Versuch es später noch einmal,
   spätestens am Start-Tag.

---

<a id="k1"></a>
## 8. Kanzlei beauftragen

Du brauchst einmalig von einer Anwältin oder einem Anwalt:
- Impressum
- Datenschutzerklärung
- AGB mit den Pflichtinfos für Kund:innen
- Widerrufsbelehrung mit Muster-Widerrufsformular, in der neuen Fassung mit Widerrufsbutton (seit 19.06.2026)
- kurze Textbausteine für Shop und Mails

Alles, was die Kanzlei wissen muss, steht in der Briefing-Mappe.

1. Öffne die Mappe `docs/recht/KANZLEI-BRIEFING.md` und speicher sie als PDF ([G8](#g8)).
   Fertig wird die Mappe bis P6. Für ein Angebot reicht aber schon die jetzige Fassung. Beauftragst du erst nach P6,
   schickst du die neueste Fassung, denn die Datei auf GitHub ist immer aktuell.
2. Ganz oben in der Mappe steht „Vor dem Versand von der Mandantin zu ergänzen“. Diese Angaben schreibst du nicht in die
   Datei auf GitHub, sondern in deine Mail an die Kanzlei (siehe Vorlage unten): Nachname, Anschrift, Telefonnummer,
   Bezirk des Studios, Geschäftsbezeichnung, ob du ein Gewerbe angemeldet hast, deine W-IdNr. (falls vorhanden) und
   deinen Wunsch-Liefertermin.
3. Such 2–3 Kanzleien, die sich mit Onlinehandel auskennen. Stichworte: „IT-Recht“, „E-Commerce“,
   „Rechtstexte Onlineshop“. Zum Beispiel über die Anwaltssuche des Deutschen Anwaltvereins (anwaltauskunft.de)
   oder mit einer Suche nach „Fachanwalt IT-Recht Berlin Onlineshop“.
4. Schick jeder Kanzlei eine Mail mit dem PDF (Vorlage unten) und bitte um ein Festpreis-Angebot und einen Liefertermin.
   Frag auch, was die freiwilligen Punkte aus der Mappe extra kosten (Abschnitt 1.1, „optional“), zum Beispiel den
   Text für die Foto-Einwilligung oder die englische Lesefassung.
5. Vergleich die Angebote und beauftrage eine Kanzlei.
6. Wenn die Texte da sind, prüf:
   - Sind alle Pflicht-Texte aus der Mappe dabei (Abschnitt 1.1, Priorität „Pflicht“)? Das sind Impressum,
     Datenschutzerklärung, AGB, Widerrufsbelehrung in der neuen Fassung mit Widerrufsbutton,
     Muster-Widerrufsformular, Versand- und Zahlungsinformationen und die kurzen Textbausteine.
   - Kamen sie in dem Format, um das die Mappe bittet (Abschnitt 1.2: je Text eine Text- und eine HTML-Datei)?
     Nur PDF reicht nicht, weil wir die Texte in die Verwaltung kopieren. Word zusätzlich ist in Ordnung.
   - Sind die offenen Fragen aus der Mappe beantwortet, zum Beispiel zu Second-Hand-Kleidung ohne Etikett, zur
     Statistik ohne Cookies, zum Warenkorb, den sich nur der Browser der Kund:innen merkt (Frage K-38), zu Anzahlungen
     für Tattoo-Termine und zu deiner Adresse im Impressum und dem Ort deines Studios (Frage K-39, [T3](#t3))?
7. Speicher die Texte in einem Ordner auf deinem Computer. Am Start-Tag kopieren wir sie zusammen in die Verwaltung.
   Plan genug Zeit ein, die Texte müssen vor dem Start fertig sein.

**Mail-Vorlage** (zum Kopieren):

```text
Betreff: Anfrage Festpreis-Angebot – Rechtstexte für kleinen Onlineshop (Unikate, Kleinunternehmerin, Berlin)

Guten Tag,

ich bin Künstlerin in Berlin und starte auf planetclairetattoos.com einen kleinen Onlineshop für handgemachte Unikate (Keramik, bemalte Second-Hand-Kleidung, Zeichnungen, Schmuck). Außerdem zeige ich dort meine Tattoo-Arbeiten, ohne Online-Buchung und ohne Online-Bezahlung.

Ich brauche einmalig: Impressum, Datenschutzerklärung, AGB mit Kundeninformationen, Widerrufsbelehrung mit Muster-Widerrufsformular (aktuelle Fassung mit Widerrufsbutton) sowie die Prüfung einiger kurzer Textbausteine und die Beantwortung offener Fragen. Alles ist in der angehängten Briefing-Mappe beschrieben.

Können Sie mir ein Festpreis-Angebot und einen möglichen Liefertermin nennen? Bitte nennen Sie die optionalen Punkte aus Abschnitt 1.1 der Mappe gern getrennt. Die Lieferformate stehen in Abschnitt 1.2.

Bitte beraten Sie mich auch zur Anschrift: Geplant ist meine Privatadresse im Impressum und als Herstellerangabe auf den Produktseiten. Dort ist auch mein Privatstudio. Wäre eine ladungsfähige Geschäftsadresse (z. B. ein gemieteter Geschäftsadress-Service) möglich und sinnvoll?

Ergänzungen zur Mappe:
- Name: Jutta [Nachname]
- Anschrift: [Straße, PLZ Berlin]
- Telefon: [Nummer]
- Bezirk des Studios: [Bezirk]
- Geschäftsbezeichnung: Planet Claire
- Gewerbe angemeldet: [ja/nein]
- Wirtschafts-Identifikationsnummer: [falls vorhanden]
- Gewünschter Liefertermin: [Datum]

Viele Grüße
Jutta [Nachname]
jutta@planetclairetattoos.com
```

---

## 9. Steuer, Stammdaten, Bank

<a id="t1"></a>
### T1 · Telefonnummer festlegen

Eine Telefonnummer ist im Impressum und in der Widerrufsbelehrung Pflicht. Sie steht nur dort, sonst nirgends. Es darf
eine eigene Nummer nur fürs Geschäft sein, zum Beispiel eine zweite SIM-Karte oder eine Nummer für Internet-Telefonie.

Überleg dir: Soll deine private Handynummer öffentlich sein? Wenn nicht, besorg dir jetzt eine zweite Nummer.

<a id="t2"></a>
### T2 · Steuerdaten zusammensuchen

Such diese Angaben zusammen. Heb sie auf Papier oder in einer Datei auf deinem Computer auf, **nicht auf GitHub**.

1. **Steuernummer** vom Finanzamt. Sie steht auf deinen Steuerbescheiden. Sie kommt auf die Rechnungen und zu Stripe,
   aber **nicht** ins Impressum.
2. **Wirtschafts-Identifikationsnummer (W-IdNr.).** Die hast du wahrscheinlich automatisch bekommen. Schau in dein
   ELSTER-Postfach oder such nach einem Brief vom Bundeszentralamt für Steuern. Sie sieht ungefähr so aus:
   `DE123456789-00001`. Sie kommt ins Impressum. Findest du keine, schreib das auf. Dann bleibt das Feld leer, bis
   die Nummer da ist.
3. **Umsatz 2025 insgesamt**, also Tattoo, Verkäufe und Flohmarkt zusammen, und dazu, was 2026 bisher zusammengekommen
   ist. Das braucht der Umsatz-Wächter.
4. **Kleinunternehmer-Status bestätigen:** Im Vorjahr höchstens 25.000 € Umsatz, im laufenden Jahr höchstens 100.000 €.
   Hast du eine Steuerberatung, frag dort kurz nach.

<a id="t3"></a>
### T3 · Stammdaten und Bankverbindung bereitlegen

Diese Angaben trägst du am Start-Tag selbst in der Verwaltung ein (unter „Einstellungen“):

- dein voller Name und die Geschäftsbezeichnung „Planet Claire“
- deine Adresse. So ist es bisher entschieden: Es ist deine Privatadresse. Sie steht im Impressum und als
  Herstellerangabe auf jeder Produktseite. **Gut zu wissen:** Damit ist auch der Ort deines Privatstudios praktisch
  öffentlich, obwohl die Tattoo-Seiten nur den Bezirk nennen. Besprich das mit der Kanzlei ([K1](#k1), die Mail-Vorlage
  fragt schon danach; in der Mappe ist es Frage K-39). Die Alternative ist eine Geschäftsadresse, unter der dich Briefe von Behörden und Gerichten
  sicher erreichen („ladungsfähige Anschrift“), zum Beispiel von einem Anbieter, der Geschäftsadressen vermietet. Das
  kostet meist eine monatliche Gebühr. Welche Adresse es wird, entscheidest du. Trag am Start-Tag die Adresse ein, für
  die du dich entschieden hast.
- E-Mail und Telefonnummer ([T1](#t1))
- Steuernummer und, falls vorhanden, W-IdNr. ([T2](#t2))
- der Bezirk deines Studios. Öffentlich steht nur der Bezirk.
- ein kurzer Text für die Abholmail: wo und wann man abholen kann
- Bankverbindung für Vorkasse: Kontoinhaberin, IBAN und BIC. Diese IBAN steht in jeder Vorkasse-Bestellmail.
  Viele nehmen dafür ein eigenes Konto nur fürs Geschäft, Pflicht ist das aber nicht.
- deine LUCID-Registrierungsnummer ([L1](#l1))

---

## 10. Material und Kennzeichnung

<a id="m1"></a>
### M1 · Nickelfreie Ösen und Ketten

Ohne Nachweis geht kein Schmuck online.

1. Kauf Ösen, Biegeringe, Ketten und Verschlüsse aus Edelstahl (zum Beispiel 316L), aus 925er Silber oder aus
   ausdrücklich nickelfreien Legierungen.
2. Bitte den Händler vor dem Kauf um eine schriftliche **Lieferantenerklärung**. Darin steht, dass die Teile die
   Nickel-Grenzwerte der EU-Chemikalienverordnung REACH einhalten (Anhang XVII Nr. 27). Frag, wenn möglich, auch nach
   Blei und Cadmium.
3. Leg Rechnung und Erklärung als PDF oder Foto in einen Ordner „Nachweise“ auf deinem Computer.
4. Für die Glasur der Anhänger: Leg das Datenblatt des Glasur-Herstellers dazu, auf dem „bleifrei“ steht.
5. Am Start-Tag lädst du die Nachweise in der Verwaltung hoch. Beim Schmuckstück setzt du dann die Häkchen
   „Metallteile nickelfrei, Nachweis liegt vor“ und „Glasur bleifrei laut Hersteller-Datenblatt“ und trägst das
   Material ein. Ohne beide Häkchen lässt der Shop das Stück nicht online.

Schreib Wörter wie „nickelfrei“ oder „hypoallergen“ nicht selbst in die Produkttexte. Den richtigen Hinweis setzt die
Seite automatisch.

<a id="m2"></a>
### M2 · Glasuren: Deko oder Geschirr?

Standard ist: Alle Keramik ist **„Deko – nicht für Lebensmittel“**. Wenn dir das reicht, ist hier nichts zu tun
(nur [M3](#m3)).

Willst du Schalen oder Teller als Geschirr verkaufen, brauchst du für jede Glasur einen Laborbefund und eine
**Konformitätserklärung**. Das ist eine schriftliche Bestätigung, dass die Grenzwerte für Blei und Cadmium eingehalten
werden.

**Entscheide:** A) alles bleibt Deko (Standard) · B) du lässt einzelne Glasuren prüfen.

Wenn du B wählst:

1. Schreib deine Glasuren auf: Hersteller, Name, Farbe. Am besten lässt du nur 1–2 Standardglasuren prüfen, die du
   oft benutzt.
2. Bitte den Glasur-Hersteller um das Datenblatt oder ein Analysenzertifikat. Steht dort „blei- und cadmiumfrei“?
3. Hol Angebote bei akkreditierten Prüflaboren ein, zum Beispiel beim FGK in Höhr-Grenzhausen, beim Keramik-Institut
   in Meißen, bei Eurofins oder bei Intertek. Frag nach: „Prüfung der Blei- und Cadmiumlässigkeit nach DIN EN 1388-1“.
   Richtwert: ca. 40–150 € pro Glasur. Braucht das Labor mehrere Teststücke (flach, tief, Becher), kann es mehr kosten.
4. Brenn die Teststücke und schick sie ein.
5. Mit dem Befund schreibst du eine Konformitätserklärung auf Deutsch. Hinein gehören: dein Name und deine Anschrift,
   welches Stück und welche Glasur, das Datum und die Bestätigung, dass die Grenzwerte eingehalten sind. Frag das Labor
   oder die Kanzlei nach einer Vorlage.
6. Am Start-Tag trägst du die Glasur in der Verwaltung unter „Konformitätserklärungen“ ein und lädst Befund und
   Erklärung hoch. Den Befund sieht nur du, die Erklärung steht öffentlich auf der Website. Erst dann lässt sich ein
   Stück auf „lebensmittelecht“ stellen.
7. Kommt eine neue Glasur dazu oder änderst du das Rezept, muss neu geprüft werden.

<a id="m3"></a>
### M3 · Stücke kennzeichnen

Nach der EU-Produktsicherheit brauchst du eine Kennzeichnung direkt am Stück, nicht nur online.

**Neue Keramik: ab jetzt dauerhaft am Boden**, zum Beispiel mit Unterglasurstift oder Stempel vor dem Brand:
- deine Objektnummer (zum Beispiel „017“)
- bei Deko: „Nur Deko – nicht für Lebensmittel“
- wenn du magst, dein Zeichen oder deine Signatur

**Ältere Stücke, Textil und Schmuck:** Die Verwaltung druckt ab P5 Aufkleber und Beileger mit Nummer,
Herstellerangaben und Hinweisen. Die klebst du unter die Keramik. Textil bekommt einen Anhänger, Schmuck eine
Schmuckkarte. Das machen wir ab dem Start-Tag.

Außerdem legst du für jede Produktart eine kurze Sicherheits-Beschreibung ab, die sogenannten technischen Unterlagen.
Die Vorlage dafür ist in der Verwaltung, Claude zeigt sie dir am Start-Tag.

---

## 11. Verpackung: LUCID, Lizenz, Material

**Warum beides?** Du stellst Karton, Polster und Klebeband selbst zusammen, damit giltst du als Herstellerin der
Verpackung. Deshalb brauchst du (1) eine Registrierung im Verpackungsregister **LUCID** und (2) eine **Lizenz bei einem
„dualen System“**. Das ist eine Firma, die das Recycling deiner Verpackung organisiert. Kartons, die als
„vorlizenziert“ verkauft werden, darfst du kaufen, sie ersetzen deine eigene Lizenz aber nicht.

Reihenfolge: [L1](#l1) → [L2](#l2) → zurück zu LUCID. Alles muss vor dem ersten Paket fertig sein.

<a id="l1"></a>
### L1 · LUCID-Registrierung (kostenlos)

Das darfst nur du selbst machen, niemand kann es für dich erledigen.

**Leg dir bereit:** Name, Anschrift, E-Mail, Telefon, Steuernummer und W-IdNr. ([T2](#t2)) sowie den Markennamen „Planet Claire“.

1. Geh auf verpackungsregister.org und dort auf „LUCID“ → „Registrieren“ (so ähnlich).
2. Als Rolle wählst du „Hersteller“ (so ähnlich).
3. Gib deine Daten ein und als Markennamen „Planet Claire“.
4. Öffne die Bestätigungsmail und setz ein Passwort.
5. Du bekommst eine Registrierungsnummer, die mit „DE“ beginnt. Schreib sie auf ([T3](#t3)). Am Start-Tag kommt sie in die Verwaltung.
6. Nach [L2](#l2): Trag in LUCID ein, bei welchem dualen System du lizenziert bist (so ähnlich: „Systembeteiligung“
   oder „Datenmeldung“). Nimm dieselben Mengen wie beim System.

<a id="l2"></a>
### L2 · Verpackungslizenz bei einem dualen System

1. Vergleich Anbieter, bei denen man online kleine Mengen lizenzieren kann, zum Beispiel Lizenzero,
   Reclay „activate“, Der Grüne Punkt oder Landbell. Richtwert: ca. 15–80 € im Jahr. Die Preise haben wir nicht
   beim Anbieter geprüft.
2. Achte darauf, dass der Vertrag nach dem **neuen** Verpackungsrecht geschlossen wird (VerpackDG, seit August 2026)
   und auch **für 2027** gilt. Ältere Verträge gelten nur bis 31.12.2026.
3. Schätz die Menge fürs erste Jahr. Wieg eine typische leere Verpackung (Karton, Papierpolster, Klebeband) mit der
   Küchenwaage. Nimm das mal die Zahl der Pakete und Briefe, die du im Jahr erwartest, und runde etwas auf.
   Beispiel: 400 g × 120 Pakete = 48 kg „Papier, Pappe, Karton“.
   Schreib dir die Gewichte deiner üblichen Verpackungen auf (Brief, kleines Paket, Keramik). Am Start-Tag tragen wir
   sie als Standardwerte in der Verwaltung ein.
4. Nimmst du nur Papier, Pappe und Papier-Klebeband, hast du nur diese eine Materialart. Plastik wie
   Luftpolsterfolie oder Plastikklebeband müsstest du extra melden.
5. Gib deine LUCID-Nummer an, schließ den Vertrag ab und bezahl selbst.
6. Geh zurück zu LUCID ([L1](#l1), Schritt 6).
7. **Einmal im Jahr, bis 1. Juni:** Melde die echten Mengen des Vorjahres in LUCID und beim System (Aufgabe A46).
   Die Zahlen liefert dir die Verwaltung: Beim Packen speichert sie für jede Sendung, welche Verpackung du genommen
   hast und wie schwer sie ist. Sie schlägt dafür die übliche Verpackung der Versandart vor, und du änderst sie nur,
   wenn du etwas anderes nimmst. Einmal im Jahr lädst du dort die Jahresliste herunter. Darin stehen die Mengen nach
   Material: Papier und Pappe, Kunststoff, Sonstiges. Diese Zahlen trägst du in LUCID und beim dualen System ein.

<a id="l3"></a>
### L3 · Versandmaterial

- **Keramik:** Innenkarton und Außenkarton aus zweiwelliger Pappe. Außen braucht es rundum mindestens 6 cm Platz für
  Polster, der Außenkarton ist also etwa 14 cm größer als der innere. Dazu Wabenpapier oder Packpapier und
  Papier-Klebeband, mindestens 48 mm breit.
- **Textil:** Versandtaschen aus Papier oder Karton. **Nie Plastik**, sonst berechnet DHL 28,99 € Sperrgut-Zuschlag.
- **Zeichnungen:** zwei feste Kartonplatten, eine Pergamin- oder Papierhülle und die Aufschrift „Bitte nicht knicken“.
- **Eine Küchenwaage** fürs Versandgewicht und die LUCID-Menge.
- Nimm neutrale Kartons ohne fremdes Logo. Stempeln oder Bemalen ist erlaubt, du bist ja ohnehin lizenziert.

---

<a id="r1"></a>
## 12. Markenrecherche „Planet Claire“ (freiwillig)

1. Geh auf dpma.de und dort in die Register-Recherche für Marken („DPMAregister“, so ähnlich). Such nach „Planet Claire“.
2. Geh auf euipo.europa.eu und nutz die Markensuche (so ähnlich: „eSearch“ oder „TMview“).
3. Schau, ob es eingetragene Marken gibt für Keramik und Geschirr (Klasse 21), Kleidung und Caps (Klasse 25),
   Bemalen und Bedrucken (Klasse 40) oder Tätowieren (Klasse 44).
4. Schreib das Ergebnis auf. Findest du etwas Ähnliches, frag kurz bei der Kanzlei nach.

---

## 13. Konten für die echte Seite

<a id="d0"></a>
### D0 · Das gilt für alle Konten

**Wann:** 1–2 Wochen vor dem Start. Vercel legst du zuletzt an, denn ab dann kostet es monatlich.

- E-Mail immer `jutta@planetclairetattoos.com`.
- Ein eigenes Passwort, 2FA an, Backup-Codes aufheben ([Abschnitt 0](#regeln)). Bietet ein Dienst keine 2FA an,
  schreib das in deine Liste. Wir schauen es uns am Start-Tag an.
- Leg nur das Konto an und stell ein, was unten steht. Projekte verbinden, Schlüssel erzeugen und Adressen eintragen
  machen wir am Start-Tag zusammen.
- Kopier keine Schlüssel oder Verbindungsdaten und gib sie nicht weiter.

| Dienst | Wofür | Tarif | Das Wichtigste | Kosten |
|---|---|---|---|---|
| Sentry | Fehlermeldungen der Seite | Developer | Datenstandort **EU**, geht nur beim Anlegen | 0 € |
| DeepL | „Übersetzen“-Knopf | API Free | **nicht** „DeepL Pro“ | 0 € |
| Lettermint | Shop-Mails (Bestellbestätigung usw.) | Free (300 Mails/Monat) | Domain noch nicht hinzufügen | 0 € |
| Neon | Datenbank | Free | Region **Frankfurt**, später nicht änderbar | 0 € |
| Cloudflare R2 | Bilder und PDFs | kostenloses Kontingent (10 GB) | Speicherort **EU**; deine Domain **nicht** hinzufügen | 0 € (eine Zahlungsart wird evtl. verlangt) |
| Vercel | die Website selbst | **Pro** | Der kostenlose Tarif ist für Shops nicht erlaubt | 20 US-Dollar/Monat (evtl. plus Umsatzsteuer) |

<a id="d1"></a>
### D1 · Sentry

1. Geh auf sentry.io und klick auf „Get Started“ oder „Sign up“ (so ähnlich).
2. Registrier dich mit deiner E-Mail-Adresse, nicht über Google oder GitHub.
3. Als Namen der Organisation gibst du `planetclaire` ein.
4. **Datenstandort: „European Union (EU)“** oder „Germany/Frankfurt“ (so ähnlich, das Feld heißt etwa
   „Data Storage Location“). Das geht nur jetzt und lässt sich später nicht mehr ändern.
5. Tarif: „Developer“ (kostenlos). Gib keine Kreditkarte ein. Bietet Sentry eine Probezeit für einen größeren Tarif
   an, ignorier sie oder lass sie ablaufen.
6. Will Sentry gleich ein erstes Projekt anlegen, überspring das, falls es geht. Wenn nicht: Plattform „Next.js“,
   Name `planetclaire`.
7. 2FA: Profil → „User Settings“ → „Security“ → „Two-Factor Authentication“ (so ähnlich).

<a id="d2"></a>
### D2 · DeepL API Free

1. Geh auf deepl.com, oben auf „API“ oder „Für Entwickler“ (so ähnlich) und dann auf „DeepL API Free“. Je nach
   Stand kann der Tarif auch anders heißen, zum Beispiel „Developer“.
   **Nicht** „DeepL Pro“ nehmen, das ist das kostenpflichtige Übersetzer-Abo.
2. „Kostenlos registrieren“, deine E-Mail und ein Passwort.
3. DeepL fragt meist nach einer Kreditkarte, nur zur Prüfung. Im Free-Tarif wird nichts abgebucht. Die Karte gibst
   du selbst ein.
4. Schalt 2FA ein, falls DeepL sie anbietet.
5. Den API-Schlüssel (so ähnlich: „Authentifizierungsschlüssel“) kopierst du nicht. Den brauchen wir erst am Start-Tag.

Gut zu wissen: Im Free-Tarif darf DeepL die Texte nutzen, um besser zu werden. Deshalb schickt der Shop nur Produkt-
und Seitentexte, nie Namen oder Adressen. Schreib also auch selbst keine Namen oder Kontaktdaten in Produkttexte.
Im Monat sind 500.000 Zeichen frei.

<a id="d3"></a>
### D3 · Lettermint

1. Geh auf lettermint.co und klick auf „Sign up“. Die Seite ist meist auf Englisch.
2. Deine E-Mail und ein Passwort, dann die Mail bestätigen.
3. Tarif: „Free“ (300 Mails im Monat).
4. Fragt Lettermint nach einem Namen für Team oder Projekt, gibst du „Planet Claire“ ein.
5. Schalt 2FA ein, falls Lettermint sie anbietet.
6. Füg deine Domain noch **nicht** hinzu. Dafür braucht es Einträge bei IONOS, und die machen wir am Start-Tag zusammen.

<a id="d4"></a>
### D4 · Neon

1. Geh auf neon.com und klick auf „Sign up“.
2. Registrier dich mit deiner E-Mail-Adresse.
3. Leg ein neues Projekt an: Name `planetclaire` · Postgres-Version 17 · Anbieter „AWS“ ·
   **Region „AWS Europe Central 1 (Frankfurt)“** (aws-eu-central-1). Die Region lässt sich später nicht ändern.
4. Tarif: „Free“.
5. Neon zeigt dir eine Verbindungsadresse („Connection string“, sie beginnt mit `postgresql://`). Nicht kopieren und
   nicht weitergeben, sie enthält ein Passwort. Wir brauchen sie erst am Start-Tag.
6. Schalt 2FA ein, falls Neon sie anbietet. Neon taucht teils auch unter dem Namen „Databricks“ oder „Lakebase“ auf,
   das ist derselbe Dienst.

<a id="d5"></a>
### D5 · Cloudflare R2

1. Geh auf cloudflare.com und klick auf „Registrieren“ oder „Sign up“.
2. E-Mail und Passwort eingeben, dann die Mail bestätigen.
3. Cloudflare schlägt vor, deine Domain hinzuzufügen („Add a domain“ oder „Website hinzufügen“): **Nicht machen,
   überspringen!** Deine Domain bleibt bei IONOS, sonst kann dein Postfach ausfallen.
4. 2FA: Profil → „Authentifizierung“ → „Zwei-Faktor-Authentifizierung“ (so ähnlich).
5. Such links im Menü „R2“ oder „R2 Object Storage“ und aktivier R2 (so ähnlich: „Purchase R2“ oder „Plan wählen“).
   Das kostenlose Kontingent von 10 GB reicht. Cloudflare verlangt dafür meist eine Zahlungsart, auch wenn nichts
   kostet. Die gibst du selbst ein.
6. Speicherbereiche heißen bei Cloudflare „Buckets“. Die legen wir am Start-Tag zusammen an, weil die Namen genau
   passen müssen. Damit du es schon kennst: „Create bucket“ → Name → bei „Location“ die Option
   „Specify jurisdiction“ → **„European Union (EU)“**. Diese EU-Einstellung lässt sich später nicht ändern.

<a id="d6"></a>
### D6 · Vercel (als Letztes)

1. Geh auf vercel.com und klick auf „Sign Up“.
2. Tarif: **Pro** (so ähnlich: „I'm working on commercial projects“). Der kostenlose Tarif „Hobby“ ist für Shops nicht erlaubt.
3. Als Namen des Teams gibst du „Planet Claire“ ein.
4. Registrier dich mit deiner E-Mail-Adresse. Vercel schickt dir einen Code per Mail.
5. Gib die Zahlungsdaten für Pro selbst ein: 20 US-Dollar im Monat, eventuell plus Umsatzsteuer.
6. Bietet Vercel an, ein Git-Repository zu importieren: **überspringen**. Das machen wir am Start-Tag.
7. 2FA: „Account Settings“ → „Authentication“ (so ähnlich) → Zwei-Faktor oder Passkey einrichten.
8. Am Start-Tag stellen wir zusammen ein: Region Frankfurt und ein Limit für Zusatzkosten (10 US-Dollar) mit
   Warn-Mails bei 50, 75 und 100 %. Vercel könnte die Seite beim Erreichen des Limits auch automatisch anhalten. Das
   ist erst einmal **aus**, weil dein Shop sonst plötzlich offline wäre. Ob du es einschaltest, entscheidest du am
   Start-Tag.

---

<a id="n1"></a>
## 14. IONOS: DNS-Seite finden

DNS ist das Adressbuch des Internets. Dort steht, wohin planetclairetattoos.com zeigt. Am Start-Tag ändern wir dort
ein paar Einträge, damit die Adresse auf die neue Seite zeigt. Dein Postfach bleibt, wie es ist.

**Jetzt findest du die Seite nur und machst Bildschirmfotos. Nichts ändern!**

1. Geh auf ionos.de → „Login“ und melde dich selbst an.
2. Klick im Menü auf „Domains & SSL“ (so ähnlich).
3. Klick auf `planetclairetattoos.com`.
4. Wähl den Reiter „DNS“ (so ähnlich, manchmal über das Zahnrad → „DNS“).
5. Du siehst eine Liste mit Einträgen wie A, AAAA, MX, TXT und CNAME.
6. Mach Bildschirmfotos der ganzen Liste (scroll dafür, wenn nötig) und speicher sie. Das ist deine Sicherung.

**Was am Start-Tag passiert (mit Claude):** Der A-Eintrag (@) und „www“ zeigen dann auf Vercel. Die AAAA-Einträge der
alten Parkseite werden gelöscht, und für Lettermint kommen neue Einträge dazu. **MX, SPF (TXT), DKIM und DMARC bleiben
unverändert**, denn die gehören zu deinem Postfach.

Außerdem am Start-Tag: Im IONOS-Kundenkonto schließt du den „Vertrag zur Auftragsverarbeitung“ ab. Du findest ihn
(so ähnlich) unter „Verträge“ oder „Datenschutz“.

---

<a id="f1"></a>
## 15. Erste echte Stücke vorbereiten

Zum Start löschen wir alle Beispieldaten, und danach sollen echte Stücke im Shop sein. Du bereitest jetzt Fotos und
Angaben vor. Am Start-Tag trägst du sie in der Verwaltung ein.

### Objektnummern

- Die Nummern vergibst du selbst. Es sind reine Zahlen, zum Beispiel 17. Angezeigt wird das als „Nr. 017“.
- Jede Nummer gibt es nur einmal, und nach dem Veröffentlichen lässt sie sich nicht mehr ändern.
- Führ eine Liste mit Nummer · Stück · Datum, damit keine Nummer doppelt vorkommt. Die Verwaltung schlägt später die
  nächste freie Nummer vor.

### Fotos

- **Hochkant.** Die Seite zeigt Fotos im Format 4:5, wie das Instagram-Hochformat. Das Stück steht in der Mitte, rundum ist etwas Luft.
- **Tageslicht** am Fenster. Kein Blitz, keine Lampen dazu.
- Als Untergrund helles Papier oder deine grüne Schneidematte.
- Reihenfolge: 1. das ganze Stück (Titelbild) · 2. ein Detail (Strich, Glasur, Stoff) · 3. ein Größenvergleich (Hand
  oder Matten-Raster) · danach, was du magst: Boden oder Rückseite, getragen.
- 3–5 Fotos pro Stück, höchstens 12.
- Keine Filter, keine Schrift im Bild, kein Wasserzeichen, keine fremden Logos oder Figuren und keine Gesichter anderer Leute.

### Angaben pro Stück (aufschreiben)

| Für | Angaben |
|---|---|
| alle Stücke | Objektnummer · Titel · kurze Beschreibung · Preis · Maße · Gewicht · Material · Versandklasse (Brief, Paket klein, Keramik oder nur Abholung) · Besonderheiten und Macken |
| Keramik | Deko oder lebensmittelecht (nur mit Nachweis, [M2](#m2)) · Glasur |
| Textil und Caps | Material laut Etikett in Prozent (zum Beispiel „100 % Baumwolle“); fehlt das Etikett, „Etikett fehlt“ plus deine Schätzung (zum Beispiel „Baumwolle, nach bestem Wissen“) · Größe · Zustand · Pflegehinweis als Text · Macken ja/nein (Flecken, Löcher – die bestätigt die Kund:in an der Kasse extra) · sichtbares fremdes Logo auf dem Rohling ja/nein (dann geht das Stück erst einmal nicht online) |
| Schmuck | Material der Metallteile · Nachweise vorhanden (Nickel und Glasur, [M1](#m1)) |
| Zeichnung | Technik (Tusche, Aquarell) · Papier · gerahmt ja/nein, wenn ja: mit Glas ja/nein |

Auf Verkaufsware kommen **nur deine eigenen Figuren**, keine bekannten Figuren anderer Leute.

---

<a id="z1"></a>
## 16. Der Start-Tag (P11)

Plan ca. 5–6 Stunden am Computer ein, gern mit Pausen oder auf zwei Termine verteilt, und leg dein Handy daneben (für
die 2FA-Codes und zum Testen). Du meldest dich überall selbst an, Claude sagt dir jeweils, wo du klicken musst.

**Leg dir bereit:**
- deine Liste der Konten ([Abschnitt 0](#regeln))
- Stammdaten und Bankverbindung ([T3](#t3)), mit der Adresse, für die du dich entschieden hast
- deine LUCID-Nummer und die Gewichte deiner üblichen Verpackungen ([L2](#l2))
- die Texte der Kanzlei
- die Nachweise für Nickel und Glasuren
- deine Einwilligungsliste mit den Screenshots
- Fotos und Angaben der ersten Stücke
- die Bildschirmfotos von IONOS
- eine eigene Bankkarte für den Testkauf
- deinen Passwort-Manager und einen Drucker (oder Papier und Stift) für den Backup-Schlüssel
- wenn möglich ein zweites Handy der anderen Sorte (iPhone bzw. Android), zum Beispiel geliehen, für den Probelauf

**Ablauf** (Claude führt dich):

1. Konten verbinden. Die Schlüssel kopierst du selbst in Vercel, auch die echten Stripe-Schlüssel ([S4](#s4)). Zu
   Vercels automatischer Pause bei Mehrkosten entscheidest du hier ([D6](#d6)).
2. **Probelauf auf der Test-Seite** („Staging“, eine Kopie deiner Seite mit den Beispieldaten). Dort fließt kein Geld,
   und alle Mails landen bei dir. Claude gibt dir den Link.
   - Schau dir die Seite am Laptop und am Handy an. Schick dir den Link per Instagram-DM an dich selbst und öffne ihn
     dort, auch auf dem zweiten Handy, wenn du eins hast. Achte auf die Punkte aus [V2](#v2) und auf Coco: Ist das
     Coco? Schalte am Handy einmal „Bewegung reduzieren“ ein (in den Bedienungshilfen, bei Android so ähnlich wie
     „Animationen entfernen“) und schau dir die Startseite an. Danach kannst du es wieder ausschalten.
   - Mach einen Testkauf. Claude nennt dir eine Testkarte von Stripe, die kein echtes Geld bewegt. Du tippst sie selbst ein.
   - Probier auch eine Vorkasse-Bestellung, eine Abholung und einen Widerruf. Klick dich am Handy durch die Verwaltung.
   - Stoppuhr-Test: Leg am Handy ein neues Stück an. Ziel: in höchstens 3 Minuten ist es online.
   - Was nicht passt, schreibst du auf. Claude behebt es vor dem Start. Texte korrigierst du hier noch nicht, das
     machst du gleich danach in der echten Verwaltung. Änderungen auf der Test-Seite gehen verloren.
3. In der Verwaltung: Admin-Passwort setzen, dann Stammdaten, IBAN, LUCID-Nummer, Verpackungsgewichte, Rechtstexte,
   Nachweise, technische Unterlagen, Einwilligungen und die ersten Stücke eintragen.
4. Die Verträge zur Auftragsverarbeitung bestätigen und eintragen: Vercel, Neon, Cloudflare, Stripe, Lettermint,
   IONOS und Sentry.
5. Die Statistik ein- oder ausschalten, je nach Antwort der Kanzlei.
6. **Backups einschalten.** Du erzeugst auf deinem eigenen Computer einen Backup-Schlüssel, Claude zeigt dir wie. Er hat
   zwei Teile:
   - Der **öffentliche** Teil beginnt mit `age1`. Den trägst du bei Vercel ein. Er ist nicht geheim.
   - Der **geheime** Teil beginnt mit `AGE-SECRET-KEY-`. Den speicherst du in deinem Passwort-Manager und druckst ihn
     aus (oder schreibst ihn ab) für deine Unterlagen. Er kommt **nie** zu Vercel, auf GitHub oder in einen Chat.
     Nur mit ihm lassen sich die Sicherungen öffnen. Verlierst du ihn, sind die alten Sicherungen nicht mehr lesbar.
   - Danach macht der Shop jede Nacht eine verschlüsselte Sicherung. Ob die erste geklappt hat, prüfen wir zusammen,
     sobald sie gelaufen ist.
7. Die Beispieldaten entfernen. Die Liste „Startklar“ in der Verwaltung muss danach ganz grün sein.
8. Das DNS bei IONOS umstellen ([N1](#n1)). Bis die neue Seite überall erscheint, kann es Minuten bis einige Stunden dauern.
   Danach stellen wir in Stripe die Webhook-Adresse auf planetclairetattoos.com um.
9. Stripe live schalten und den Shop öffnen ([S4](#s4)). Ab jetzt fließt echtes Geld.
10. Testkauf: Kauf ein Stück mit deiner eigenen Karte. Prüf die Bestellmail mit den PDFs. Widerruf den Kauf über
    „Vertrag widerrufen“ und prüf die Eingangsbestätigung. Dann erstattest du in der Verwaltung. Die Stripe-Gebühr für
    den Testkauf (ca. 1 €) bekommst du nicht zurück.
11. Die Seite im Instagram-Browser öffnen und die Links in die Bio setzen ([I3](#i3)).
12. Fertig. Jetzt wird gefeiert.

<a id="z2"></a>
## 17. Nach dem Start: was regelmäßig anfällt

Die genaue Bedienung der Verwaltung erklärt dein [Handbuch](HANDBUCH.md).

| Wie oft | Was |
|---|---|
| an Versandtagen | „Zu packen“ öffnen → nach Checkliste packen und 2 Fotos machen (freiwillig, hilft bei Transportschäden; bei Keramik ohne Foto fragt die Verwaltung einmal nach) → die vorgeschlagene Verpackung bestätigen oder ändern (so zählt der Shop die Verpackungsmengen) → Paketmarke in der Post & DHL App → Sendungsnummer eintippen oder scannen (beim Brief freiwillig) → die Bestellung ist „versendet“ |
| wenn Vorkasse-Geld da ist | in der Verwaltung auf „Zahlung erhalten“ tippen. 3 Tage nach der Bestellung erinnert der Shop die Kund:in automatisch. Ist bis zum Ende des 5. Tages nach dem Bestelltag kein Geld da, storniert der Shop automatisch, und das Stück ist wieder frei. |
| bei einem Widerruf | Ware prüfen und auf „Erstatten“ tippen, spätestens 14 Tage nach dem Widerruf. Die Verwaltung erinnert dich. |
| monatlich | Einnahmen aus Tattoo, Flohmarkt, Auftragsarbeiten und Sonstigem im Umsatz-Wächter eintragen; Monatsexport und Rechnungen für deine Buchhaltung herunterladen |
| jährlich bis 1. Juni | Jahresliste der Verpackungsmengen in der Verwaltung herunterladen, die Mengen des Vorjahres in LUCID und beim dualen System melden; Lizenz fürs neue Jahr prüfen ([L2](#l2)) |
| jährlich | Rechtstexte von der Kanzlei prüfen lassen. Die Verwaltung erinnert dich. |
| laufend | neue Tattoo-Fotos erst nach einer Einwilligung zeigen ([E1](#e1)) |
| bei einer Anfrage „Welche Daten habt ihr von mir?“ | innerhalb eines Monats antworten, mit dem Knopf „Auskunft“ in der Verwaltung |
| im Notfall (Daten in falsche Hände geraten, zum Beispiel ein gehacktes Konto) | innerhalb von 72 Stunden an die Berliner Datenschutzbeauftragte melden. Die Anleitung steht im [Handbuch, Kapitel 16](HANDBUCH.md#16-datenpanne-was-tun-im-ernstfall). |
| wenn eine Kosten-Warnung kommt | ernst nehmen: Das Ziel sind höchstens ca. 25 € im Monat, die Warnung kommt ab 30 €. |

---

<a id="anhang"></a>
## Anhang für Claude-Sessions (Jutta kann das überspringen)

**Was Jutta hochlädt und in welcher Form (für den Import in P8 und die Zeichnungen in P9):**

| Ordner | Mögliche Formen | Regeln für den Import |
|---|---|---|
| `content/seed/instagram-export/` (existiert seit P0 mit `LIESMICH.txt`) | (a) eine oder mehrere ZIP-Dateien ≤ 25 MB; (b) ausgepackt, in Portionen direkt in diesen Ordner hochgeladen: Monatsordner `<JJJJMM>/…` aus `media/posts` **und** `media/stories` (gleichnamige Monatsordner sind zusammengelaufen) sowie ein JSON-Ordner (z. B. `your_instagram_activity/…`); (c) Mischformen oder unvollständig, auch ältere Uploads mit `media/posts/…`-Pfaden | Dateien rekursiv suchen und Medien über den **Dateinamen** zuordnen, nicht über den Pfad. Beitrag oder Story über die `uri`-Pfade im JSON bestimmen; fehlt JSON (oder hat Jutta HTML gewählt), das Datum aus dem Monatsordner nehmen und die Art offen lassen. Videos (`.mp4`) und einzelne Dateien > 25 MB fehlen meist. `LIESMICH.txt` ignorieren, nicht löschen. Tattoo-Fotos von Kund:innen immer mit `consentGiven=false` importieren (E-42). Fotos, auf denen Jutta zu sehen ist (`showsPerson = jutta`), ohne ihre Freigabe weder auf „Über mich“ zeigen noch als Zeichenvorlage nutzen (DESIGN §12.4, SEED-SPEC §4.1). Beim Import keine abgeleiteten Großdateien committen. |
| `content/seed/coco/` (existiert seit P0 mit `LIESMICH.txt`) | 5–10 Fotos (`.jpg`, `.png`, evtl. `.heic`), optional ein kurzes `.mp4` ≤ 25 MB; Namensvorschlag `coco-<pose>-<n>` mit den Posen `rennen`, `schnueffeln`, `sitzen`, `schlafen`, `springen`, `kopfschief` (DESIGN) | Nur als Zeichenvorlage nutzen, nie veröffentlichen. Die Namen sind freiwillig, notfalls nach Bildinhalt zuordnen. `.heic` bei Bedarf umwandeln. `LIESMICH.txt` ignorieren, nicht löschen. |

**Was nie im Repo landen darf:** Einwilligungs-Screenshots, Instagram-Nachrichten, Kundendaten, Schlüssel,
Verbindungsadressen, IBAN, Ausweis- oder Vertragsunterlagen. Findet sich so etwas trotzdem, nicht verwenden, im PR
melden und Jutta bitten, es zu entfernen.

**Uploads kommen direkt auf `main`.** Jutta lädt über die Weboberfläche mit „Commit directly to the main branch“ hoch.
Ihre Uploads starten keinen Lauf: `ci.yml`, `ci-full.yml` und `preview-export.yml` laufen nur bei Pull Requests und
per `workflow_dispatch`, nie bei Pushes auf `main`; `release.yml` (der einzige Workflow mit `push` auf `main`) ignoriert
Pushes, die nur `content/seed/instagram-export/**` oder `content/seed/coco/**` ändern (`paths-ignore`, ARCHITEKTUR §6.2).
Vor der Arbeit mit ihren Dateien
`origin/main` in den Arbeitsbranch übernehmen
(`git merge origin/main -m "chore: merge main [skip ci]"`, CLAUDE.md §3, ARCHITEKTUR §6.7).

**Fehlt etwas?** Dann weiter mit Platzhalter oder Seed, Eintrag in `docs/OFFENE-PUNKTE.md` und als Nacharbeit für
P11 listen (CLAUDE.md §2). Jutta wird in P1–P10 nicht gefragt (E-97).

**Oberfläche geändert?** Knopfnamen und Menüwege in dieser Datei im PR anpassen. Keine tiefen Anbieter-URLs ergänzen,
die nicht geprüft sind.
