# CLAUDE.md – Arbeitsanweisung für alle Claude-Sessions

Projekt: Website, Shop und Tattoo-Bereich für **planetclairetattoos.com** (Jutta, Künstlerin in Berlin, Instagram
@planet.claire.tattoos). Next.js 16 + Payload CMS 3 + Postgres, pnpm. Inhaberin ist **nicht technisch**.

## 1. Lesereihenfolge (vor jeder Arbeit)

1. `docs/ENTSCHEIDUNGEN.md` – **verbindlich**, oberste Quelle der Wahrheit (IDs E-xx).
2. `PLAN.md` – Aufgaben P1–P11 mit Akzeptanzkriterien. Du arbeitest die **erste offene Aufgabe** ab.
3. Fachdokumente zur jeweiligen Aufgabe: `docs/KONZEPT.md` (Funktion), `docs/DATENMODELL.md`, `docs/ARCHITEKTUR.md`,
   `docs/design/DESIGN.md` + `docs/design/KUNST-QA.md`, `docs/recht/ANFORDERUNGEN.md` (R-xxx), `content/seed/SEED-SPEC.md`.
4. `docs/OFFENE-PUNKTE.md` (getroffene Annahmen, offene Fragen an Jutta/Kanzlei) und `docs/CLOUD-SETUP.md` §3–§5 (wie Cloud-Sessions laufen).
5. Hintergrund mit Quellen: `docs/research/*.md` (Empfehlungen dort gelten nur, wenn ENTSCHEIDUNGEN nichts anderes sagt).
6. Payload-Referenz: `.claude/skills/payload/SKILL.md` und `.claude/skills/payload/reference/`.

Rangfolge bei Widersprüchen: ENTSCHEIDUNGEN > Fachdokumente > PLAN > research. Namen im Code (Umgebungsvariablen,
Endpunkte, Job-Slugs, Cookies) legt `docs/ARCHITEKTUR.md` fest (§5.2, §2.5, §8.7, Anhang A.3).

IDs sind dokumentweit eindeutig: `E-xx` Entscheidungen · `KA-xx` Konzept-Annahmen · `R01…` Routen · `R-xxx` Rechts-
anforderungen · `L-xx` Löschkonzept · `K-xx` Kanzleifragen · `A-xx`/`B-xx`/`C-xx` Architektur-Prinzipien/Spikes/
Annahmen · `DM-xx` Datenmodell · `KO-xx`/`DA-x` Design-Komponenten/-Annahmen · `SE-xx` Beispielbestand · `P<n>.<m>` Aufgaben.

## 2. Autonomie-Regeln

- **Frag die Inhaberin nichts.** Alle Entscheidungen stehen in den Docs. Ist etwas wirklich offen: wähle die
  konservativste, rechtlich sicherste und am leichtesten änderbare Variante, setze sie um und trage sie in
  `docs/OFFENE-PUNKTE.md` ein (Datum, Aufgabe, Annahme, wie man sie später ändert). Dann weiterarbeiten.
- Ändere **nie** Entscheidungen in `docs/ENTSCHEIDUNGEN.md`. Du darfst nur unten „Umsetzungsnotizen“ ergänzen.
- Bis P11 gibt es **keine echten Konten/Schlüssel**. Jede Integration läuft über Adapter + Mock
  (`STORAGE_DRIVER=local`, `EMAIL_DRIVER=file`, `PAYMENTS_DRIVER=mock`, `TRANSLATION_DRIVER=mock`).
  Fehlende Schlüssel sind nie ein Grund anzuhalten. Nur P11 (Go-live) braucht Jutta.
- Aufgaben, die Material von Jutta brauchen (Instagram-Export, Coco-Fotos, Rechtstexte der Kanzlei, IBAN …),
  werden mit Platzhalter/Seed erledigt und in P11 als Nacharbeit gelistet – nicht blockieren.

## 3. Arbeitsablauf pro Phase

Cloud-Sessions dürfen nur ihren **eigenen Arbeitsbranch** pushen (von der Session vorgegeben, meist `claude/…`).
Deshalb:

1. Zu Beginn: prüfen, ob `main` neuer ist als dein Branch (offene PRs früherer Sessions?). Wenn ein früherer
   Session-PR noch nicht gemergt ist, baue auf dessen Stand auf (`git fetch && git merge origin/<branch>`), damit
   nichts verloren geht, und vermerke das im PR-Text.
2. Aufgaben in PLAN.md-Reihenfolge umsetzen (Reihenfolge in der Datei, nicht Nummer). Vor jedem Commit **lokal**
   prüfen: `pnpm check`, `pnpm test:int`, betroffene E2E, bei UI `pnpm build`. Danach Checkbox in `PLAN.md` abhaken
   (`- [ ]` → `- [x]`, Format nicht ändern – `scripts/cloud-setup.sh --plan-status` zählt sie) und kurzer Eintrag in
   `docs/FORTSCHRITT.md` (Datum, Aufgabe, was, Tests). Häufig committen und pushen.
3. Commits: Conventional Commits auf Englisch mit Aufgaben-ID, z. B. `feat(P1.4): add money helpers [skip ci]`.
   **GitHub-CI-Minuten sind knapp (2.000/Monat):** Zwischen-Commits tragen `[skip ci]`. CI läuft nur (a) am
   Phasenende – letzter Commit mit `[ci:full pN]` (N = Phase; erzeugt ab P2 das Artefakt „Vorschau-Datei“, KONZEPT §12)
   – und (b) höchstens einmal zwischendurch je Phase bei riskanten Aufgaben (`[ci:full]`); Ausnahme P9: Kunst-QA-Läufe
   per `[ci:art]` (begrenzt durch KUNST-QA §6.6). Merge-Nachricht, PR-Titel und -Beschreibung enthalten **nie**
   `[skip ci]`. Details ARCHITEKTUR §6.2/§6.7/§6.8.
4. Höchstens **ein** offener Pull Request je Session gegen `main` („P<n>…P<m>: <Titel>“), Beschreibung auf Deutsch,
   nach jeder Phase aktualisiert. Maßgeblich ist der letzte Commit **ohne** `[skip ci]` – er muss grün sein; danach nur
   reine Doku-Commits (`PLAN.md`, `docs/FORTSCHRITT.md`, `docs/OFFENE-PUNKTE.md`) mit `[skip ci]` – darin wird
   „CI grün“ abgehakt. Mergen, wenn die Rechte es erlauben (squash); sonst oben im PR-Text „Bitte mergen – CI ist grün“
   (Jutta klickt dann nur „Merge“). Nach einem Merge darf dieselbe Session einen neuen PR vom selben Branch öffnen.
5. Beispielbestand entsteht vollständig erst in P8: Tests in P1–P7 nutzen gleichartige Test-Fixtures (Nummern 980–999).
6. Weiter mit der nächsten Phase auf demselben Branch. **Bis der Plan leer ist (P10).** Danach Abschlussbericht
   (siehe §8) und anhalten.

Endet eine Session mitten in einer Phase, setzt die nächste an der ersten offenen Checkbox in `PLAN.md` fort
(auf dem Stand des letzten PR-Branches, falls noch nicht gemergt). Auto-Memory gibt es in der Cloud nicht –
alles Wissen gehört ins Repo.

## 4. Befehle

```bash
pnpm install              # Abhängigkeiten
pnpm dev                  # Entwicklungsserver http://localhost:3000 (Verwaltung unter ADMIN_ROUTE)
pnpm check                # lint + typecheck + unit tests (vor jedem Commit)
pnpm test:int             # Integrationstests gegen Postgres (DATABASE_URL)
pnpm test:e2e             # Playwright (startet pnpm dev)
pnpm build                # Produktions-Build
pnpm payload migrate:create <name>   # Migration anlegen (Schema-Änderungen immer als Migration committen)
pnpm generate:types && pnpm generate:importmap   # nach Änderungen an Collections/Admin-Komponenten
```

Lokale Dienste: `docker compose up -d` (Postgres 17 + Mailpit) – in der Cloud: siehe `docs/CLOUD-SETUP.md`.

## 5. Definition of Done (für jede Aufgabe)

- Akzeptanzkriterien der Aufgabe in PLAN.md erfüllt und durch Tests belegt (Unit/Int/E2E je nach Art).
- `pnpm check`, `pnpm test:int`, `pnpm build` grün; keine neuen Lint-Warnungen im geänderten Code.
- UI: mobil (390 px) und Desktop geprüft, per Tastatur bedienbar, `prefers-reduced-motion` beachtet, deutsche und
  englische Texte vorhanden (keine hart codierten Texte ohne i18n).
- Recht: betroffene R-xxx aus `docs/recht/ANFORDERUNGEN.md` erfüllt; nichts aus der Verbotsliste (§6).
- Doku aktualisiert, wenn sich Verhalten/Datenmodell/Umgebungsvariablen ändern (inkl. `.env.example`).

## 6. Harte Regeln

- **Geld** immer als Integer-Cent. **Zeiten** in der DB UTC, Anzeige Europe/Berlin.
- **Unikate nie doppelt verkaufen:** Reservierung atomar in Postgres (`UPDATE … WHERE status='available' RETURNING`),
  Bestellung/Bestand nur per verifiziertem Webhook bzw. Admin-Aktion ändern, Webhooks idempotent.
- **Keine Cookies/Storage vor der ersten Warenkorb-Aktion** (einzige Ausnahme: `localStorage` `pc-motion` erst nach
  Klick auf den Animationen-Schalter, R-130 a; vollständige Liste ARCHITEKTUR §8.7). Keine Drittanbieter-Requests auf öffentlichen Seiten
  (keine Google Fonts, keine Embeds, kein reCAPTCHA, keine Tracker). Stripe-Skripte nur auf der Kasse.
  Schriften selbst gehostet (`@fontsource/*` o. ä.).
- **Verboten:** Link/Text zur EU-OS-Plattform; „inkl. MwSt.“ solange Kleinunternehmer-Modus aktiv; vorangekreuzte
  Checkboxen; pauschales „Handmade = kein Widerruf“; Werbung in Transaktionsmails; fremde geschützte Figuren auf
  Verkaufsware; Tattoo-Fotos von Kund:innen ohne `consentGiven` außerhalb von `SEED_PREVIEW_MODE`.
- Bestell-Button-Text exakt **„Zahlungspflichtig bestellen“** (EN: „Order with obligation to pay“).
- Link **„Vertrag widerrufen“** auf jeder Seite (Footer), zweistufige Widerrufsfunktion nach § 356a BGB.
- **Keine Secrets im Repo.** Nur `.env.example` mit Platzhaltern. Cloud-Umgebungsvariablen sind nicht geheim →
  Stripe-**Test**-Schlüssel bevorzugt als API-Credential der Cloud-Umgebung, sonst höchstens als Test-Variable
  (`livemode:false` prüfen). Nie Live-Schlüssel vor P11.
- Seed-Daten immer mit `seed: true`; Seed läuft nie automatisch in Produktion.
- Schema-Änderungen nur per Migration; kein `push` außerhalb lokaler Entwicklung.
- Payload: alle `@payloadcms/*` exakt gleiche Version wie `payload`; Payload 4 nicht einführen.

## 7. Qualität von Bildern & Animation (Wunsch der Inhaberin, E-80)

Die Seite lebt von Juttas Strich. Zeichnungen, Coco und die Tuschelinie müssen handgemacht wirken, nicht generisch.
Halte dich an `docs/design/DESIGN.md`; in P9 gilt das Studio-QA-Verfahren aus `docs/design/KUNST-QA.md`
(Videoaufnahmen, mehrere unabhängige Prüf-Durchgänge, nachbessern bis alle bestehen) – ohne die Tempo-Budgets
(mobil LCP < 2,5 s, CLS < 0,1) zu reißen.

## 8. Abschluss

Wenn P10 abgeschlossen ist (Plan bis auf P11 leer):
1. `dist/planet-claire-vorschau.html` erzeugen; nach dem Merge veröffentlicht `release.yml` sie automatisch als
   Release `vorschau-p10` („Planet Claire – Vorschau (Stand P10)“), sobald `OFFEN_P1_P10=0` (KONZEPT §12, P10.21).
2. `docs/FORTSCHRITT.md` um einen Abschlussbericht für Jutta ergänzen (Deutsch, du-Form, ohne Fachjargon):
   was fertig ist, wie sie die Vorschau-Datei öffnet, welche Punkte aus `docs/OFFENE-PUNKTE.md` sie entscheiden
   sollte und was in P11 gemeinsam passiert (Liste aus `docs/owner/AUFGABEN.md`).
3. Anhalten. P11 nur gemeinsam mit Jutta.

## 9. Kommunikation mit Jutta

Deutsch, „du“, freundlich, kurz, ohne Fachjargon (Fachbegriffe in einem Halbsatz erklären). Sie liest PR-Texte und
`docs/FORTSCHRITT.md`. Keine Fragen stellen, die in den Docs beantwortet sind.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
