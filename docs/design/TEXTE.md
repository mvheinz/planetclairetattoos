# TEXTE – Leitfaden für alle Texte auf Planet Claire (U-21, U-00)

> Stand 06.10.2026 · gilt für Seiten, Stationen, Shop, Tattoo-Bereich, FAQ, „Über mich“, Leerzustände, Fehlerseiten,
> Alt-Texte, Beispieldaten und E-Mail-Überschriften. **Rechtstexte** (Impressum, Datenschutz, AGB, Widerruf, Versand-/Zahlungs-
> Rechtstexte, Barrierefreiheit, IP-Klauseln) folgen `docs/recht/` und sind davon ausgenommen. Verbindlich: `docs/UEBERARBEITUNG.md`
> (U-00, U-15, U-21). Der Test `tests/unit/i18n/text-inventory.unit.spec.ts` verhindert, dass alte Wortlaute zurückkehren;
> `tests/unit/i18n/bilingual.unit.spec.ts` prüft DE/EN-Parität.

## 1. Stimme

- **Ich-Form von Jutta.** „Ich zeichne …“, „Schreib mir“. Die Besucher:in wird geduzt.
- **Verträumt-philosophisch, geheimnisvoll, nie erklärend.** Bilder statt Begründungen: Haut vergisst nicht, Ton erinnert sich
  an jede Berührung, die Linie darf zittern, Stücke „ziehen weiter“ statt „sind verkauft“.
- **Kaum Selbsterklärung.** Kein „so zeichne ich“, keine Beschreibung von Coco als Hund. Coco tritt als **Figur** auf: sie läuft
  voraus, folgt der Linie, hütet ein Stück.
- **Kurz.** Ein Satz Stimmung, dann Ruhe. Keine Ausrufezeichen-Ketten, keine Kosewörter, keine Werbesprache.

## 2. Sachtexte: poetisch gerahmt, Fakten klar

Pflege, Ablauf, Preise, Versand, FAQ, Kasse, Fehlerhinweise: **Überschrift oder erster Satz darf poetisch sein, die Fakten stehen
danach kurz und eindeutig** (Zahlen, Fristen, Namen, was zu tun ist). Poesie ersetzt nie eine Angabe.

| Muster | Beispiel |
|---|---|
| Rahmen + Fakt | „Haut lässt sich nicht hetzen. Die Oberfläche ist meist nach zwei bis drei Wochen zu …“ |
| Leerzustand | „In dieser Ecke ist es gerade still.“ + ein Weiterweg („Komm später wieder – oder wandere zu den anderen Stücken.“) |
| Fehler | „Der Faden hat sich verheddert“ + was passiert ist und was die Person tun kann („Atme kurz durch und versuch es noch einmal.“) |
| Status | Zustände bleiben eindeutig („reserviert“, „verkauft“, „abgesagt“); poetisch nur der Rahmen („weitergezogen“) |

## 3. Was nie poetisch umgeschrieben wird

- Pflichttexte und Rechtsformulierungen: Button **„Zahlungspflichtig bestellen“** (EN „Order with obligation to pay“), Footer-Link
  **„Vertrag widerrufen“**, Widerrufsfunktion, Steuer-/Preisangaben, Pflichtangaben der Anbieterin (`src/lib/legal/constants.ts`).
- Formularbeschriftungen, Navigation (Shop, Tattoo, Korb, Kontakt …), Fehlermeldungen zu einzelnen Feldern, Zahlarten, Status der
  Bestellung. Sie bleiben schlicht und eindeutig.
- E-Mails: Betreff, Zahlen, Fristen, Rechtshinweise bleiben sachlich; poetisch höchstens Titelzeile und Einleitung.

## 4. Verbotsliste (gilt auch für Texte)

Kein „inkl. MwSt.“ im Kleinunternehmer-Modus · kein Link/Text zur EU-OS-Plattform · **keine Erwähnung von DM/Direktnachricht;
Instagram nur als Profil-Link im Footer, nie als Anfrageweg** (U-15) · keine Werbung in Transaktionsmails · kein pauschales
„Handmade = kein Widerruf“ · keine vorangekreuzten Checkboxen · keine fremden geschützten Figuren · keine Liedtexte, Band-
oder Albumnamen (DESIGN §12 Hommage-Grenzen).

## 5. Zweisprachigkeit (U-00)

- Jede Textstelle hat **DE und EN**, **eigenständig formuliert**, gleichwertig im Ton – keine Wort-für-Wort-Übersetzung.
  Bildhafte Wendungen werden neu gefunden („die Linie darf zittern“ → „the line is allowed to tremble“; „Stück ist weitergezogen“ →
  „the piece has moved on“).
- Platzhalter (`{number}`, `<link>`) und ICU-Plurale bleiben in beiden Sprachen vorhanden; englische Plurale/Ordinalzahlen dürfen
  ICU-Blöcke verwenden, die es im Deutschen nicht gibt.
- Apostrophe in englischen Texten typografisch (’), damit ICU keine Klammern „quotet“.
- Ausnahmen (Namen, Marken, Zahlarten, Größen, Orte) stehen als Allowlist im Paritäts-Test, jeweils mit Grund. Einzige inhaltliche
  Ausnahme im Beispielbestand: Stücke S25 und S29 sind absichtlich nur deutsch (Zustand „Übersetzung fehlt“ der Verwaltung).
- Die **Verwaltungsoberfläche** bleibt deutsch (DATENMODELL §1.2); zweisprachig sind alle Inhalte, die Besucher:innen sehen, und
  alle in der Verwaltung gepflegten Felder (DE/EN-Reiter, Standardtexte in `site-texts`).

## 6. Alt-Texte

Alt-Texte **beschreiben das Bild sachlich** (was ist zu sehen, Material, Tier, Pose) – sie werden nicht poetisch umgeschrieben, damit
sie Screenreadern nützen. Bei Platzhalter-Zeichnungen steht „Platzhalter-Zeichnung: …“ / „Placeholder drawing: …“. Dekorative Bilder
bekommen `alt=""`.

## 7. Wo Texte liegen

| Ort | Inhalt |
|---|---|
| `src/i18n/messages/{de,en}.json` | Oberflächen-, Shop-, Tattoo-, Fehler- und Mailtexte |
| `src/globals/SiteTexts.ts` | Standardwerte der Texte, die Jutta in der Verwaltung ändern kann |
| `content/seed/data/*.json` | Beispielbestand (Seiten, Stationen, Kategorien, FAQ, Termine, Stücke) |
| `docs/recht/` | Rechtstexte (von diesem Leitfaden ausgenommen) |
