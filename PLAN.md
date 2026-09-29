# PLAN – planetclairetattoos.com

Dieser Plan ist die Arbeitsliste für alle Claude-Sessions. Er wird von oben nach unten abgearbeitet: Die **erste offene
Checkbox** ist die nächste Aufgabe (CLAUDE.md §3). P1–P10 erledigen Cloud-Sessions selbstständig und ohne Rückfragen;
**P11 (Go-live) passiert nur gemeinsam mit Jutta.** Wenn P10 abgehakt ist, entsteht automatisch die Vorschau-Datei
`planet-claire-vorschau.html` (E-98), und die Session hält an (CLAUDE.md §8).

**Regeln für diese Datei**

- Format nicht ändern: Phasen `## P<n> – <Titel>`, Aufgaben `- [ ] **P<n>.<m> <Titel>** – …`, je Phase
  `### Phasen-Abnahme`. Erledigt = `- [x]`. `scripts/cloud-setup.sh --plan-status` zählt die offenen Checkboxen von P1–P10.
- Keine Checkboxen in Codeblöcken; Aufgaben nicht umnummerieren (andere Dokumente verweisen auf die IDs). Neue Aufgaben
  als `P<n>.<m>a` einfügen.
- Quellen: ENTSCHEIDUNGEN (E-xx) > Fachdokumente (KONZEPT, DATENMODELL, ARCHITEKTUR, DESIGN/KUNST-QA, RECHT, SEED-SPEC) >
  dieser Plan > research. Namen im Code laut ARCHITEKTUR, Datenmodell-Namen laut DATENMODELL.
- Jede Aufgabe gilt erst als erledigt, wenn ihre Akzeptanzkriterien durch Tests belegt sind und `pnpm check`,
  `pnpm test:int` und `pnpm build` grün sind (Definition of Done, CLAUDE.md §5).
- Fehlt etwas von Jutta (Fotos, Rechtstexte, Stammdaten, Schlüssel): Platzhalter bzw. Mock verwenden, in
  `docs/OFFENE-PUNKTE.md` eintragen, weiterarbeiten.

## Überblick

| Phase | Inhalt | Wer | Vorschau-Datei |
|---|---|---|---|
| P0 | Fundament: Entscheidungen, Konzept, Fachdokumente, Plan, App-Gerüst, CI, Cloud-Einrichtung | lokal mit Jutta | – |
| P1 | Datenmodell, Verwaltung und Werkzeuge | Cloud | – |
| P2 | Designsystem, Tuschelinie und Vorschau-Werkzeug | Cloud | ab hier nach jeder Phase |
| P3 | Shop-Schaufenster | Cloud | ✓ |
| P4 | Warenkorb, Kasse, Bezahlen (Mocks) | Cloud | ✓ |
| P5 | Abläufe hinter den Kulissen (Packen, Versand, Rechnungen, Jobs) | Cloud | ✓ |
| P6 | Recht und Datenschutz | Cloud | ✓ |
| P7 | Tattoo und Auftragsarbeiten | Cloud | ✓ |
| P8 | Inhalte und kompletter Beispielbestand | Cloud | ✓ |
| P9 | Kunst und Bewegung (Extra-Aufwand, Studio-QA) | Cloud | ✓ |
| P10 | Qualität, Startvorbereitung, finale Vorschau-Datei | Cloud | **final** (Release) |
| P11 | Go-live gemeinsam mit Jutta | Jutta + Session | – |

## P0 – Fundament (lokal, 26.09.2026)

### Aufgaben

- [x] **P0.1 Entscheidungen und Konzept** – Fragenkatalog mit Jutta, alle Antworten in `docs/ENTSCHEIDUNGEN.md`
  (E-01…E-99); Konzeptseite `docs/konzept/planet-claire-konzept.html` von Jutta freigegeben.
- [x] **P0.2 Recherche mit Faktencheck** – `docs/research/*.md` (Technik, Design, Recht, Compliance/Steuern, Zahlung/
  Versand/Betrieb, Claude-Cloud).
- [x] **P0.3 Fachdokumente** – `docs/KONZEPT.md`, `docs/DATENMODELL.md`, `docs/ARCHITEKTUR.md`, `docs/design/DESIGN.md`,
  `docs/design/KUNST-QA.md`, `docs/recht/*.md`, `content/seed/SEED-SPEC.md`, `docs/owner/*.md`; untereinander abgeglichen
  (gleiche Namen, Fristen, Nummern, IDs).
- [x] **P0.4 Beispielbilder** – 22 öffentliche Instagram-Bilder mit `manifest.json` in `content/seed/instagram/`;
  Upload-Ordner `content/seed/instagram-export/` und `content/seed/coco/` angelegt.
- [x] **P0.5 App-Gerüst** – Next.js 16.3.6 + Payload 3.90.2 (Postgres), pnpm 10.34.5, TypeScript, ESLint, Vitest (unit/int),
  Playwright; `docker-compose.yml` (Postgres 17 + Mailpit), `Dockerfile`, `.env.example`, `.gitattributes`;
  `pnpm check` und `pnpm build` lokal grün.
- [x] **P0.6 CI und Cloud-Einrichtung** – `.github/workflows/ci.yml`; `CLAUDE.md`; `docs/CLOUD-SETUP.md`,
  `scripts/cloud-setup.sh`, `.claude/settings.json`.
- [x] **P0.7 Plan** – diese Datei (P1–P11 mit Akzeptanzkriterien).
- [x] **P0.8 GitHub** – privates Repository `planetclairetattoos`, `main` gepusht, CI grün (27.09.2026).

### Phasen-Abnahme

- [x] Konzept von Jutta freigegeben (26.09.2026).
- [x] `pnpm check` und `pnpm build` lokal grün.
- [x] CI auf GitHub grün (erster Lauf inkl. Integrationstest gegen Postgres, 27.09.2026).

---

## Arbeitsregeln für P1–P11

Autonome Cloud-Sessions arbeiten die **erste offene Checkbox** ab (CLAUDE.md §3) und fragen Jutta nichts (E-97). Fehlt
etwas von ihr, gilt die Zeile „Ohne Jutta“ der Aufgabe; neue Annahmen kommen nach `docs/OFFENE-PUNKTE.md`.

- Quellen-Rangfolge: ENTSCHEIDUNGEN (E-xx) > Fachdokumente > dieser Plan > research (CLAUDE.md §1). Jedes Fachdokument
  ist für sein Gebiet zuständig: Namen im Code (Umgebungsvariablen, Endpunkte, Task-Slugs, Cookies, Skripte, Pfade)
  laut ARCHITEKTUR (Env-Tabelle §5.2, Baum §2.1, Skripte §6.10, Anhang A); Collections, Felder, Enums und Nummernformate
  laut DATENMODELL; Verhalten, Abläufe und Routen R01–R31 laut KONZEPT; rechtliche Pflichten laut RECHT (R-xxx, strengere
  Regel gewinnt) und LOESCHKONZEPT (L-xx); Gestaltung laut DESIGN (KO-xx, DA-x) + KUNST-QA; Beispielbestand laut
  SEED-SPEC (SE-xx); Cloud laut CLOUD-SETUP. Weicht eine Aufgabe hier davon ab, gilt das Fachdokument. Die Hinweise
  „W-nn“ unten regeln nur Reihenfolge und Umfang dieses Plans; P1.2 trägt sie nach `docs/OFFENE-PUNKTE.md` ein.
- Vor jedem Commit laufen die Prüfungen **lokal in der Session**: `pnpm check`, `pnpm test:int`, die betroffenen
  E2E-Tests und bei UI-Änderungen `pnpm build`. GitHub-CI ist die Abschlusskontrolle, nicht der Entwicklungs-Loop. Nach
  jeder Aufgabe: Checkbox abhaken, Eintrag in `docs/FORTSCHRITT.md`, PR-Text aktualisieren.
- Commits: Conventional Commits auf Englisch mit der Aufgaben-ID als Scope, z. B.
  `feat(P1.4): add enums, money and time helpers [skip ci]`; am Phasenende z. B. `chore(P3): finish phase [ci:full p3]`.
- CI-Minuten sind knapp (GitHub Free, 2.000 Minuten im Monat). Zwischen-Commits tragen `[skip ci]`. `ci.yml`,
  `ci-full.yml` und `preview-export.yml` laufen nur über den offenen PR (`pull_request`) oder per `workflow_dispatch`,
  **nie** bei einem Push auf `main` – der gemergte Stand ist der geprüfte PR-Stand. Ein Push auf `main` startet nur
  `release.yml` (ab P10, P10.21). CI läuft nur (a) am Phasenende mit `[ci:full pN]` (`quick`, `ci-full`,
  Vorschau-Export) und (b) höchstens **einmal** zwischendurch je Phase bei einer riskanten Aufgabe (Kasse, Webhooks,
  Belege) mit `[ci:full]` (`quick`, `ci-full`, kein Export). P9 ist von dieser Grenze ausgenommen: Kunst-QA-Läufe
  starten per `[ci:art]` (P9.7, P9.18, P9.18a), ihre Zahl begrenzt die KUNST-QA-Obergrenze von 12 Iterationen.
  Visuelle Referenzbilder entstehen nur in CI per `[ci:update-snapshots]` (P2.24, P2.28); diese Läufe zählen im
  Minutenbudget. Meldet der Minuten-Wächter `pnpm ci:minutes` (P1.33a) 1.500 Minuten oder mehr im Monat oder kann er
  nicht zählen, gibt es bis Monatsende nur noch Phasenende-Läufe, mit Hinweis oben im PR-Text.
- Maßgeblich für Merge und für das Häkchen „CI grün“ ist der letzte Commit **ohne** `[skip ci]`. Danach folgen nur reine
  Doku-Commits (nur `PLAN.md`, `docs/FORTSCHRITT.md`, `docs/OFFENE-PUNKTE.md`) mit `[skip ci]`; in so einem Doku-Commit
  wird „CI grün“ abgehakt, **nachdem** der Lauf grün ist. Kriterien, die nur ein GitHub-Lauf belegen kann, tragen den
  Vermerk „(CI-Nachweis)“: Die Aufgabe wird nach ihren lokalen Kriterien abgehakt; den CI-Nachweis erbringt der
  Phasenende-Lauf, er gehört zum Punkt „CI grün“ der Phasen-Abnahme.
- Höchstens ein offener PR je Session; nach einem Squash-Merge darf dieselbe Session einen neuen PR vom selben Branch
  öffnen. Der PR ist spätestens vor dem ersten CI-Lauf einer Phase offen (Entwurf genügt), weil CI nur über
  `pull_request` läuft.
- Mergen (wenn die Rechte es erlauben) nur mit ausdrücklicher Nachricht:
  `gh pr merge <nr> --squash --subject "<PR-Titel>" --body "<Kurzfassung>"`. Squash-Nachrichten und PR-Beschreibungen
  enthalten **nie** `[skip ci]` (auch nicht in P1–P9), sonst startet nach dem Merge auch `release.yml` nicht. Nur
  Merge-Commits von `main` in den Arbeitsbranch dürfen `[skip ci]` tragen
  (`git merge origin/main -m "chore: merge main [skip ci]"`). Mergt Jutta per Knopf, nimmt GitHub Titel und
  Beschreibung des PR als Nachricht; diese Repo-Einstellung stellt sie einmal ein (AUFGABEN A01a, CLOUD-SETUP §1,
  `docs/OFFENE-PUNKTE.md` J-44).
- Beispielbestand vor P8: Er entsteht vollständig erst in P8 (P1.30 legt nur den Mini-Satz an). Braucht ein Test in
  P1–P7 einen Seed-Anker, den es noch nicht gibt (z. B. Bestellung O14), nutzt er eine gleichartige Test-Fixture
  (Stücknummern 980–999, eigene Fixture-Dateien unter `tests/`, nie unter `content/seed/`). Das Kriterium heißt dann
  „Fixture analog O14 …; mit dem echten Anker prüft P8.21“. Fristen- und Erinnerungs-Jobs überspringen Datensätze mit
  `seed = true` (DATENMODELL §11); ihre Tests nutzen deshalb Fixtures mit `seed = false` und eine Gegenprobe mit
  `seed = true`.
- Testtitel enthalten die geprüften IDs (`AK-…`, `DM-…`, `R-…`, `T-…`), damit die Nachverfolgbarkeit (R-001) greift.
  Dateinamen: `tests/unit/**/*.unit.spec.ts`, `tests/int/**/*.int.spec.ts`, `tests/e2e/**/*.e2e.spec.ts`,
  `tests/visual/*.visual.spec.ts` (ARCHITEKTUR §7.1).
- Bis P11 gibt es keine echten Konten und keine Schlüssel: alle Treiber `local`/`file`/`mock`. Ein Netzwerk-Wächter lässt
  in Tests nur `127.0.0.1`, `localhost` und `::1` zu.
- Playwright-Browser: `scripts/cloud-setup.sh` installiert Chromium und WebKit (CLOUD-SETUP, ARCHITEKTUR §4.5). Nur wenn
  die WebKit-Installation scheitert, gilt `PW_SKIP_WEBKIT=1` (das Projekt `iphone-15` läuft dann als markierte
  Chromium-Emulation) plus Eintrag in `docs/OFFENE-PUNKTE.md`. CI führt WebKit immer aus.
- **Nicht bauen** (ENTSCHEIDUNGEN „Später“): EU-Versand je Land, Schweiz, DHL-API-Labels, Produktvideos, Drops,
  Countdown-Veröffentlichung, Newsletter, Warteliste, Gutscheine, Rabattcodes, Online-Anzahlung Tattoo, Klarna, eigene
  Handschrift-Font, Markt-Modus „Marktkiste“, Kundenkonten.

**Plan-Hinweise (W-Liste)**

Nur Festlegungen zu Umfang und Reihenfolge dieses Plans; fachliche Regeln stehen in den Fachdokumenten.

| ID | Thema | Hinweis (gilt für diesen Plan) |
|---|---|---|
| W-21 | Umfang des Beispielbestands in P1 | P1 baut Seed-Rahmen, Grund-Seed und einen Mini-Satz (P1.30); den vollständigen Bestand laut SEED-SPEC §0.1 liefert P8 |
| W-31 | Vorschau-Artefakt je Phase | In jeder Phase trägt der letzte Commit ohne `[skip ci]` die Kennung `[ci:full pN]` (ARCHITEKTUR §6.7), damit jeder Phasen-PR ein Vorschau-Artefakt hat (AK-12-02); danach folgen nur Doku-Commits mit `[skip ci]` |
| W-33 | Startseiten-Stationen in P2 | P2 zeigt die Stationen ohne Produktkarten (DESIGN §13); Karten (KO-07 in KO-21) und AK-3-02 kommen in P3 |

---

## P1 – Datenmodell, Verwaltung und Werkzeuge

**Ziel:** Das Datenmodell aus DATENMODELL (29 Collections, 2 Globals; P1 legt alle an außer `legal-snippets` und
`complaints`, die P6 per Migration ergänzt – DATENMODELL §10.1) steht mit Migrationen, eigenen
Postgres-Objekten, verweigerndem Zugriffsschutz und Tests. Dazu kommen die Werkzeuge, auf denen alle weiteren Phasen
aufbauen: Umgebungsprüfung, Enums, Geld/Zeit, Adapter mit Mocks (Speicher, Mail, Zahlung, Übersetzung, Versand),
Bildpipeline ohne Metadaten, Objektnummern- und Veröffentlichungsregeln je Kategorie, eine deutsche Verwaltung unter
`ADMIN_ROUTE` mit Sperre nach Fehlversuchen, Seed-Rahmen mit Grund-Seed und Mini-Beispielbestand sowie eine erweiterte
CI. Am Ende kann Jutta (später) in der Verwaltung ein Stück je Kategorie anlegen, und nur vollständige Stücke lassen sich
online stellen.
**Voraussetzungen:** P0 abgeschlossen; gemergt oder im Arbeitsbranch enthalten (Gerüst Next.js 16.3.6 + Payload 3.90.2,
CI grün; P0-Stand laut ARCHITEKTUR Anhang C-14);
Cloud-VM laut `docs/CLOUD-SETUP.md` (Postgres 16 gestartet, Node aus `.nvmrc`, `.env` aus `.env.example`); Docker nur für
die optionalen MinIO-/Mailpit-Tests. Migrationen und SQL laufen auf Postgres 16 (Cloud-VM) und 17 (CI, Produktion);
keine Funktionen, die nur Postgres 17 kennt (DM-P1-01).
**Referenzen:** E-02, E-03, E-10–E-18, E-22–E-25, E-28, E-31, E-40–E-45, E-47, E-52, E-53, E-60–E-64, E-90–E-93; R-001,
R-002 (Platzhalter-Modell), R-012, R-032, R-041–R-048, R-135, R-136, R-180 (dazu Verbotsmuster RECHT §5); KONZEPT §0.4, §1.5, §2.2, §5.1, §7.1–§7.4, §7.12–§7.16,
§11; DATENMODELL §1–§16; ARCHITEKTUR §1–§9, §15, Anhang A–C; DESIGN §12.2 (Schritte 1–3, 7, 8); SEED-SPEC §0–§4, §5,
§13.1, §17–§20; LOESCHKONZEPT L-01–L-25.
**Reihenfolge = Datei, nicht Nummer:** P1.25 (Globals) steht direkt hinter P1.14, P1.20 und P1.21 stehen vor P1.19.
Beziehungsfelder auf eine Collection, die erst eine spätere Aufgabe anlegt, ergänzt diese spätere Aufgabe in ihrer
Migration (`products.currentOrder` in P1.20; Verweise von `orders` auf `invoices`/`withdrawals` in P1.21;
`legalTextVersions` von Kassen und Bestellungen in P1.22; Verweise auf `complaints` in P6).

### Aufgaben

- [x] **P1.1 Gerüst-Abweichungen beheben und Werkzeugregeln** – Erste Aufgabe der Phase (ARCHITEKTUR Anhang C-14 Nr. 4,
  §1.3, §15). `ci.yml` und Test-Helfer folgen in P1.1a, Versionsprüfung und Next.js-Patch in P1.1b.
  - Prüfen, dass der P0-Stand noch gilt, sonst korrigieren (bereits in P0 erledigt, nicht neu bauen):
    - `.gitattributes` mit `* text=auto eol=lf` und Binärtypen (u. a. `png jpg jpeg webp avif gif ico pdf woff woff2`);
    - `.gitignore` mit `/.data` und `/.next-preview`;
    - `vitest.config.mts` (Int) mit `environment: 'node'`;
    - `next.config.ts` mit `images: { unoptimized: true }` und `distDir: process.env.NEXT_DIST_DIR || '.next'`;
    - Skript `build` mit `--max-old-space-size=6144`;
    - `ci.yml` mit `APP_ENV` und `ADMIN_ROUTE`; `.env.example` mit `APP_ENV`, `ADMIN_ROUTE=/werkstatt` und
      `CRON_SECRET` (≥ 32 Zeichen).
  - Noch offen, jetzt umsetzen:
    - `tsconfig.json`: `noUncheckedIndexedAccess`, `noImplicitOverride` (ARCHITEKTUR §15).
    - `.npmrc`: `save-exact=true` (C-14 Nr. 4). `package.json`: Laufzeit-Abhängigkeiten exakt pinnen (`cross-env`,
      `graphql` – bleibt als Peer von `@payloadcms/next` –, `eslint`, `prettier`).
    - `vitest.config.mts` (Int) zusätzlich `fileParallelism: false` und `include: ['tests/int/**/*.int.spec.ts']`;
      beide Vitest-Konfigurationen lösen `server-only` auf `tests/helpers/server-only-stub.ts` auf.
    - `eslint.config.mjs` (ARCHITEKTUR §15): `@typescript-eslint/no-explicit-any: error` (generierte Dateien
      `src/payload-types.ts`, `src/app/(payload)/**` ausgenommen); `no-console: error` in `src/**` (Ausnahme
      `src/lib/monitoring/logger.ts`); `no-restricted-syntax` für `new Date()` ohne Argument und `Date.now()` in
      `src/lib/commerce/**`, `src/lib/jobs/**`, `src/jobs/**` und `src/lib/legal/**`; `no-restricted-imports` für
      `react`, `react-dom`, `next`, `next/*`, `payload`, `@payloadcms/*` in `src/behaviors/**`, `src/leash/**` und
      `src/preview-runtime/**`. `pnpm lint` führt zusätzlich `pnpm format:check` aus.
  - Akzeptanz:
    - `pnpm typecheck` ist mit den neuen Compiler-Optionen grün.
    - ESLint meldet Fehler für `console.log` in `src/`, `new Date()` in `src/lib/commerce/`, `Date.now()` in `src/jobs/`,
      `any` in handgeschriebenem Code und einen `react`-Import in `src/behaviors/` (AK-A-15-01).
    - Prüfpunkt P0: `git check-attr eol -- src/payload.config.ts` liefert `lf`; `*.woff2` ist `binary`.
  - Tests: unit `tests/unit/lint/rules.unit.spec.ts` (AK-A-15-01): ruft die ESLint-API mit Beispiel-Quelltext unter
    virtuellen `src/`-Pfaden auf; im Repo liegen keine absichtlich fehlerhaften Dateien.
  - Ohne Jutta: –

- [x] **P1.1a `ci.yml` und Test-Helfer** – ARCHITEKTUR Anhang C-14 Nr. 1 und 3, §6.3.
  - `ci.yml` nach ARCHITEKTUR §6.3 (C-14 Nr. 3): Job `checks` heißt `quick` (Pflicht-Check „CI / quick“, Workflow-Name
    `CI` bleibt); Auslöser nur `pull_request` (Typen `opened`, `synchronize`, `reopened`, `ready_for_review`) und
    `workflow_dispatch` – der P0-Auslöser `push` auf `main` entfällt (Arbeitsregeln oben, ARCHITEKTUR §6.2);
    Service-`POSTGRES_DB` sowie `DATABASE_URL` und `DATABASE_URL_TEST` auf `planetclaire_test` (`db:reset` verweigert
    Namen ohne `_test`);
    Umgebung `TZ=UTC`, `DB_POOL_MAX=25`, `SEED_NOW`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`,
    `NEXT_PUBLIC_LEASH_DEBUG`, `E2E_SERVER` mit den Testwerten aus §6.3. Die übrigen Schritte der §6.3-Tabelle ergänzt
    die Aufgabe, die das jeweilige Skript anlegt (P1.3, P1.5, P1.30, P1.33).
  - `tests/helpers/login.ts`, `tests/helpers/seedUser.ts` und `tests/e2e/admin.e2e.spec.ts` nutzen `ADMIN_ROUTE`,
    `SEED_ADMIN_EMAIL` und `SEED_ADMIN_PASSWORD` statt `/admin`, `dev@payloadcms.com` und `test` (C-14 Nr. 1, E-03,
    Passwort ≥ 12 Zeichen). Bis die Umschreibung auf `ADMIN_ROUTE` steht (P1.12), trägt `admin.e2e.spec.ts` die
    Markierung `test.fixme` mit Hinweis „Admin-Pfad ab P1.12“.
  - Akzeptanz:
    - `ci.yml` ist gültiges YAML (lokal geparst), hat keinen `push`-Auslöser und definiert den Job `quick` gegen
      `planetclaire_test` mit `TZ=UTC`.
    - (CI-Nachweis) Der Pflicht-Check heißt „CI / quick“ und läuft gegen `planetclaire_test` mit `TZ=UTC`.
    - Kein Test-Helfer nutzt `/admin` als Admin-Pfad oder `dev@payloadcms.com`; der Pfad kommt aus `ADMIN_ROUTE`, die
      Zugangsdaten aus `SEED_ADMIN_*`.
  - Tests: Die YAML-Prüfung deckt ab P1.33 `tests/unit/ci/workflows.unit.spec.ts` ab; bis dahin lokales Parsen.
  - Ohne Jutta: –

- [x] **P1.1b Versionsprüfung und Next.js-Patch** – ARCHITEKTUR §1.1, §1.3, Anhang C-14 Nr. 5.
  - `scripts/check-versions.ts` (`pnpm check:versions`, ARCHITEKTUR §1.3, §6.10): alle `@payloadcms/*` = `payload`,
    `eslint-config-next` = `next`, `react` = `react-dom`, keine `^`/`~` bei Laufzeit-Abhängigkeiten. Ab P1.3 läuft es
    zusätzlich als Teilprüfung `versions` von `pnpm check:static` und damit in `pnpm check`.
  - Stichtag: Ab dem 30.09.2026 meldet die Prüfung eine **Warnung** (kein Fehler), solange `next` < 16.3.7 ist.
  - **Next.js-Patch (ARCHITEKTUR §1.1, AK-A-1-02):** P1.1b hebt `next` und `eslint-config-next` exakt auf den neuesten
    16.3.x-Patch – ab Veröffentlichung von 16.3.7 (angekündigt für 30.09.2026) mindestens 16.3.7. `pnpm build` und alle
    Tests müssen danach grün sein. Payload bleibt 3.90.2 (alle `@payloadcms/*` gleich). Ist 16.3.7 noch nicht
    erschienen: neuesten 16.3.x-Patch nehmen und eine Zeile in `docs/OFFENE-PUNKTE.md` anlegen; die Warnung erinnert
    jede folgende Session, die das Update dann vor jeder anderen Arbeit nachholt (ARCHITEKTUR §1.1).
  - Akzeptanz:
    - `pnpm check:versions` scheitert, wenn ein `@payloadcms/*`-Paket von `payload` abweicht oder eine
      Laufzeit-Abhängigkeit `^`/`~` trägt (AK-A-1-01).
    - Ab dem 30.09.2026 mit `next` < 16.3.7 gibt die Prüfung eine Warnung aus und scheitert nicht; mit `next` ≥ 16.3.7
      kommt keine Warnung.
    - AK-A-1-02: Ist 16.3.7 erschienen, tragen `next` und `eslint-config-next` denselben neuesten 16.3.x-Patch
      ≥ 16.3.7; `pnpm build` ist grün.
    - Die C-14-Punkte Nr. 1, 3, 4 und 5 (P1.1–P1.1b) und die P0-Prüfpunkte sind im PR-Text Punkt für Punkt abgehakt;
      Nr. 2 folgt mit P1.3.
  - Tests: unit `tests/unit/tooling/check-versions.unit.spec.ts` (AK-A-1-01/-02): prüft Fixture-`package.json`-Objekte
    mit injiziertem Datum (Fehler bei Versionsabweichung, Warnung am Stichtag).
  - Ohne Jutta: –

- [x] **P1.2 Spezifikationsabgleich prüfen und offene Punkte übernehmen** – Die W-Liste oben als Zeilen in
  `docs/OFFENE-PUNKTE.md` eintragen (Spalte „Thema“ beginnt mit der W-ID, Status „gilt (Plan)“). Die Annahmen aus
  ARCHITEKTUR Anhang C (C-xx), DATENMODELL §16 (DM-xx), DESIGN Anhang A.1 (DA-x), KONZEPT Anhang A (KA-xx) und
  SEED-SPEC §20 (SE-xx) übernehmen – je Zeile mit ihrer ID, Dubletten zusammengeführt, Status „Annahme gilt“ (P8.1
  aktualisiert die SE-Zeilen).
  - Prüfen, dass die Fachdokumente so stehen, sonst an der Stelle im Fachdokument korrigieren (Maßstab: das
    zuständige Fachdokument laut Arbeitsregeln oben; strengere RECHT-Regel gewinnt) und die Korrektur im PR-Text nennen:
    - DATENMODELL §1.2: Übersetzungs-Mock liefert `"[EN] " + Text` (ARCHITEKTUR §3.6).
    - DATENMODELL §6.6: Produktfelder nach RECHT R-043–R-048 – `leadFreeGlazeConfirmed` (Schmuck mit Glasur, R-045),
      `framed` + `frameHasGlass` (Glas-Warnhinweis automatisch, R-046), `blankBrandVisible` (R-047), ausdrückliche
      Abweichungs-Entscheidung bei `textil`/`cap` (R-048), bei `labelMissing` Fasern **und** Freitext (R-043);
      Statusautomat §6.6.7 = KONZEPT §5.1 (P1–P15, u. a. `available → draft`, `archived → draft`).
    - DATENMODELL §6.12: Rechtstexte mit `origin` ∈ {`placeholder`, `draft`, `lawyer`}, `isPlaceholder` =
      (`origin = placeholder`), `source` (`manual`/`itrk_lti`), Tokens genau laut R-012 (keine Aliase).
    - DATENMODELL §7.1: `payment.iban` Standard `DE36000000000000000000`, `retention.invoiceYears` ∈ {8, 10} (Standard
      10), `legal.allowVisibleBlankBrands` (Standard `false`), `packaging.*`.
    - DATENMODELL §11/§12 und LOESCHKONZEPT: Fristen zentral in `src/lib/retention/policy.ts`, Werte laut LOESCHKONZEPT.
    - ARCHITEKTUR §5.2: `CARRIER_DRIVER` seit P1; §6.10 enthält `seed:reset`; §2.1 nennt 29 Collections (= DATENMODELL),
      `content/seed/data/` und `src/art/`.
    - SEED-SPEC §1.4 (CLI `seed:remove` in Produktion: Abbruch, ARCHITEKTUR §4.8; der Admin-Knopf aus P8 ist die
      Produktionsvariante), §1.8 (P1-Umfang laut W-21), §2.1 (Bibliothek `src/lib/seed/`, CLI `scripts/seed/cli.ts`),
      §3.4 (Platzhalter-Rechtstexte mit `origin = placeholder` und Tokens laut R-012), §7 (keine Beispiel-Bestellung mit
      `pending_payment`/`expired` – diese Fälle sind Kassen in `checkouts`; Seed-Schlüssel der Kassen).
    - DATENMODELL §6.2 und ARCHITEKTUR §3.3: gleiche Cache-Dauer für Medien mit `showsPerson = customer` und
      Seed-Medien.
    - KONZEPT §3.0.3 und DESIGN KO-04: EN-Fußlink „Withdraw from contract here“ (R-090).
    - `docs/owner/AUFGABEN.md` (Abschnitt „Für Claude-Sessions“, Zuordnung): nennt die DATENMODELL-Namen.

  `docs/ENTSCHEIDUNGEN.md` bleibt unverändert (höchstens „Umsetzungsnotizen“ ergänzen).
  - Akzeptanz:
    - Jede in `PLAN.md` verwendete W-ID steht in `docs/OFFENE-PUNKTE.md`.
    - Jede Prüfstelle oben ist im PR-Text abgehakt; gefundene Abweichungen sind im selben PR im Fachdokument korrigiert.
    - Die Entscheidungen in `docs/ENTSCHEIDUNGEN.md` sind unverändert.
  - Tests: unit `tests/unit/docs/resolutions.unit.spec.ts` sammelt alle `W-\d{2}` aus `PLAN.md` und prüft, dass jede ID
    in `docs/OFFENE-PUNKTE.md` vorkommt.
  - Ohne Jutta: Jutta geht die Liste in P11 durch (A30/A31); nichts blockiert.

- [x] **P1.3 Umgebungsvariablen, Start-Prüfung und `check:static`** – `src/lib/env.ts` (mit `import 'server-only'`)
  enthält ein zod-4-Schema **aller** Variablen aus ARCHITEKTUR §5.2. Auch spätere Phasen sind enthalten, dann optional.
  Jede Variable hat `.describe()`, einen Standardwert, eine Geheimnis-Kennung und „Seit“.
  - Neu in P1 (Spalte „Seit“ in §5.2): `APP_ENV`, `DATABASE_URL_UNPOOLED`, `DATABASE_URL_TEST`, `DB_POOL_MAX`,
    `PAYLOAD_DB_PUSH`, `ADMIN_ROUTE`, `CRON_SECRET`, `JOBS_AUTORUN`, `LOG_LEVEL`, `TZ`, `SEED_NOW`, `SEED_ADMIN_EMAIL`,
    `SEED_ADMIN_PASSWORD`, `STORAGE_LOCAL_DIR`, `S3_PRIVATE_BUCKET`, `S3_FORCE_PATH_STYLE`, `EMAIL_FILE_DIR`,
    `SMTP_SECURE`, `CARRIER_DRIVER`, `NEXT_PUBLIC_ANALYTICS_ENABLED` (Schema und `.env.example`, wirksam ab P10),
    `E2E_BASE_URL`, `E2E_SERVER`, `PW_SKIP_WEBKIT`. Die Referenzzeit heißt nur `SEED_NOW` (ISO-8601 mit Offset); es
    gibt keinen Alias.
  - `getEnv()` wird einmal geparst und gecacht.
  - `assertProductionEnv(env)` setzt die Regeln aus ARCHITEKTUR §4.2/§4.3 um. Sie sammelt **alle** Verstöße und gibt
    sie in einer Meldung aus. „Produktion“ heißt immer `APP_ENV=production`.
  - `instrumentation.ts` ruft die Prüfung beim Start auf (Node-Runtime). Nur dort ist die Erkennung
    `NODE_ENV === 'production'` ohne `APP_ENV` erlaubt (AK-A-4-02).
  - `scripts/gen-env-example.ts` (`pnpm env:example`) erzeugt `.env.example` aus `src/lib/env.ts` (C-14 Nr. 2),
    gruppiert wie §5.2, Geheimnisse leer; P0-Werte (`ADMIN_ROUTE=/werkstatt`, `CRON_SECRET`-Platzhalter) bleiben.
  - `scripts/check-static.ts` (`pnpm check:static`, ARCHITEKTUR §6.3 Schritt 4) ist ein Rahmen mit registrierten
    Teilprüfungen; spätere Phasen hängen ihre an:
    - `versions` (`scripts/check-versions.ts` aus P1.1b);
    - `env-example`: identisch mit dem generierten Stand, und jede Schema-Variable steht in der §5.2-Tabelle
      (Markdown-Parser);
    - `import-rules` (ARCHITEKTUR §2.2);
    - `stripe-import`: `stripe` wird nur unter `src/lib/payments/stripe/` importiert (R-062 vorbereitet);
    - `external-urls`: http(s)-URLs im Quelltext nur aus einer Allowlist;
    - `i18n-parity` und `route-registry` kommen in P2.1 dazu.
  - `package.json`: `check` = `lint` + `typecheck` + `check:static` + `test:unit` (ARCHITEKTUR §6.10).
  - ESLint `no-restricted-properties` verbietet `process.env` außer in `src/lib/env.ts`, `next.config.ts` und
    `instrumentation.ts` (AK-A-5-02). `src/payload.config.ts` nutzt danach `getEnv()`.
  - `ci.yml` bekommt Schritt 4 (`pnpm check:static`) aus ARCHITEKTUR §6.3.
  - Akzeptanz:
    - T-17: Jede Zeile der Tabelle ARCHITEKTUR §4.3 wird einzeln verletzt und führt zum Abbruch mit Meldung:
      - Treiber `s3`/`smtp`/`stripe`; `TRANSLATION_DRIVER≠deepl` ergibt nur eine Warnung;
      - Stripe-Präfixe `sk_live_`/`rk_live_`, `whsec_`, `pk_live_`;
      - `PAYLOAD_SECRET` ≥ 32 Zeichen und ≠ `.env.example`, `CRON_SECRET` ≥ 32 Zeichen;
      - `ADMIN_ROUTE` ≠ `/admin` und `/werkstatt`, Muster `[a-z0-9-]`, 6–40 Zeichen;
      - `NEXT_PUBLIC_SITE_URL` exakt;
      - `S3_ENDPOINT` in der EU-Jurisdiktion.

      Mehrere Verstöße erscheinen in **einer** Meldung (AK-A-3-02). `SEED_PREVIEW_MODE=true` wird in `production`
      ignoriert und als Fehler geloggt (§4.2).
    - `sk_live_…` bei `APP_ENV≠production` bricht ab (AK-1-02).
    - `.env.example` weicht ab oder eine Schema-Variable fehlt in §5.2: `pnpm check:static` scheitert (AK-A-5-01).
    - AK-A-1-01 (Rest): Weicht ein `@payloadcms/*`-Paket von `payload` ab, scheitert auch `pnpm check`.
    - `process.env.X` in `src/lib/foo.ts` ist ein Lint-Fehler (AK-A-5-02).
    - Ein ungültiges `SEED_NOW` (kein ISO-8601 mit Offset) bricht mit Exit 1 und klarer Meldung ab (AK-SEED-16, Teil).
    - Mit den Standardwerten aus `.env.example` und leeren Zugangsdaten startet `pnpm dev` (AK-A-3-01, Teil).
  - Tests:
    - unit `tests/unit/env/assert-production.unit.spec.ts` (T-17, Tabelle je Regel);
    - unit `tests/unit/env/env-example.unit.spec.ts` (AK-A-5-01);
    - Lint-Regeltest aus P1.1 um `process.env` erweitert.
  - Ohne Jutta: Nur Testwerte. Echte Werte setzt P11 (A25, A33).

- [x] **P1.4 Basis-Module: Zeit, Geld, Logger, Enums** –
  - `src/lib/time.ts` (ARCHITEKTUR §3.9, A-08): `APP_TIME_ZONE = 'Europe/Berlin'`, `type Clock = { now(): Date }`,
    `systemClock`, `fixedClock(iso)`, `berlinDayStart(d)`, `berlinMonthRange(yyyyMm)`, `addBerlinDays(d, n)`,
    `formatBerlin(d, pattern, locale)`; zusätzlich `berlinYear(d)` und `berlinMonthKey(d)`. Die Uhr wird übergeben
    (kein globales `now()`); mit `date-fns` und `@date-fns/tz`, exakt gepinnt.
  - `src/lib/money.ts`: `formatMoney(cents, locale, { style: 'tag' | 'full' })` – einzige Formatierfunktion für
    Beträge (DESIGN §4.4, ARCHITEKTUR §15): `full` (Standard) immer mit zwei Nachkommastellen („38,50 €“ / „€38.50“,
    `de-DE`/`en-IE`), `tag` ganze Euro ohne Nachkommastellen („45 €“ / „€45“); `parseEuroInput('38,50') → 3850`,
    `assertCents` (Ganzzahl ≥ 0); keine Floats.
  - `src/lib/monitoring/logger.ts` (ARCHITEKTUR §8.11): JSON-Zeilen `{ level, time, event, ...felder }`, `LOG_LEVEL`.
    Schwärzung über `src/lib/security/redact.ts`: die Schlüsselliste aus §8.11 wird `"[redacted]"`; Freitext wird auf
    E-Mail-Adressen, IBANs und 43-Zeichen-base64url-Tokens geprüft, zusätzlich Telefonnummern (Grundlage für
    R-137/T-20).
  - `src/lib/enums.ts`: alle `as const`-Arrays und Typen aus DATENMODELL §4 wörtlich (einzige Quelle, DM-P1-05).
  - `src/lib/enumLabels.ts`: deutsche Admin-Labels und DE/EN-Anzeigelabels je Wert.
  - `src/lib/security/keys.ts` (ARCHITEKTUR §8.6, einzige Stelle): HKDF-SHA256 aus `PAYLOAD_SECRET` mit den Bezeichnern
    laut §8.6: `pc:ip-hash:v1`, `pc:form-token:v1`, `pc:mock-webhook:v1`, `pc:status-token-seal:v1` (Siegel des
    Status-Tokens, genutzt ab P4.1) und `pc:privacy-export:v1` (genutzt ab P6); `src/lib/security/ipHash.ts`:
    `ipHash(ip, clock)` mit täglich wechselndem Schlüssel (Berliner Datum), keine Klar-IP. Kunden-Token werden nie aus
    `PAYLOAD_SECRET` abgeleitet (zufällig, `src/lib/security/tokens.ts`).
  - Akzeptanz:
    - Jeder Enum-Wert hat ein DE-Label und, falls öffentlich, ein EN-Label.
    - `parseEuroInput` lehnt `38,555`, `-1` und `abc` ab; `formatMoney(4500, 'de', { style: 'tag' }) = '45 €'`,
      `formatMoney(3850, 'en') = '€38.50'`.
    - `berlinYear(2026-12-31T23:30Z) = 2027`; die Sommerzeit-Umstellung am 25.10.2026 wird korrekt behandelt
      (`addBerlinDays`, `berlinDayStart`).
    - `ipHash` liefert für dieselbe IP an zwei Berliner Tagen verschiedene Werte.
    - Der Logger gibt keine E-Mail-Adresse, keine IBAN und kein 43-Zeichen-Token im Klartext aus.
  - Tests: unit `tests/unit/lib/{time,money,logger,enums,keys}.unit.spec.ts`.
  - Ohne Jutta: –

- [x] **P1.5 Datenbank-Werkzeuge, Test-Infrastruktur, Migrationsregeln** –
  - `scripts/db-ensure.ts` (`db:ensure`) legt die Datenbanken aus `DATABASE_URL`/`DATABASE_URL_TEST` an, falls sie
    fehlen.
  - `scripts/db-reset.ts` (`db:reset --test`) arbeitet nur, wenn der DB-Name auf `_test` endet, `APP_ENV ≠ production`
    gilt und der DB-Kommentar nicht `planetclaire:production` ist (ARCHITEKTUR §4.8). Es leert das Schema `public` und
    führt `payload migrate` samt eigenem SQL aus; sobald P1.29 steht, folgt `seed:base` (ARCHITEKTUR §7.2; `test:e2e`
    zusätzlich `seed:example`).
  - `src/lib/db/guard.ts`: `isProductionDatabase()`, gemeinsam mit dem Seed-Guard genutzt.
  - `src/payload.config.ts`: `postgresAdapter({ pool: { connectionString, max: DB_POOL_MAX }, push: PAYLOAD_DB_PUSH &&
    APP_ENV === 'development', migrationDir: src/migrations })`.
  - Erste Migration `pnpm payload migrate:create p1_baseline` (users, media).
  - `scripts/check-migration-drift.ts` (`check:migrations`) nach DATENMODELL §10 Nr. 4: erzeugt `ci-drift-check`, wertet
    aus, löscht und scheitert bei Inhalt. `ci.yml` bekommt Schritt 6 (`payload migrate` → `check:migrations`,
    ARCHITEKTUR §6.3). Migrationsnamen immer `p<n>_<thema>` (ARCHITEKTUR §15).
  - Vitest-Int-Setup `tests/int/setup/global.ts`: `db:ensure` + `db:reset --test` gegen `DATABASE_URL_TEST`; Helfer
    `tests/int/helpers/payload.ts` (`getTestPayload()`, `withClock()`).
  - Netzwerk-Wächter `tests/setup/network-guard.ts`, für Unit und Int eingebunden über `vitest.setup.ts`
    (ARCHITEKTUR §7.2: undici-Dispatcher + `net.Socket.connect`-Hook): bricht Verbindungen zu anderen Hosts als
    `127.0.0.1`, `localhost`, `::1` mit Fehler ab (AK-A-3-01).
  - Skripte `test:int`/`test:e2e` rufen vorher `db:ensure` und `db:reset --test` auf (ARCHITEKTUR §7.2).
  - Spike: `server-only`-Module in `tsx`/`payload run`-Skripten. Entweder `--conditions=react-server` oder ein
    Import-Hook `scripts/lib/register-server-only.mjs`. Die Entscheidung wird als ADR `docs/adr/0001-server-only-in-scripts.md`
    festgehalten.
  - Akzeptanz:
    - DM-P1-01: `pnpm payload migrate` auf leerer DB (PG 16 in der VM, PG 17 in CI) ist fehlerfrei;
      `pnpm check:migrations` ist grün.
    - `db:reset --test` gegen `planetclaire` bricht mit Exit 1 ab.
    - Ein Test, der `https://example.org` aufruft, scheitert mit einer klaren Meldung des Wächters.
  - Tests:
    - int `tests/int/db/reset-guard.int.spec.ts`;
    - int `tests/int/db/migrate.int.spec.ts` (DM-P1-01);
    - unit `tests/unit/setup/network-guard.unit.spec.ts`.
  - Ohne Jutta: –

- [x] **P1.6 Zugriffsschicht, Kontext-Flags, öffentliche Lesezugriffe, Feldbausteine** –
  - `src/access/index.ts`: `isAdmin`, `none`, `publicRead(where)`, `adminField` (DATENMODELL §1.4). `publicRead` hängt
    `{ seed: { equals: false } }` an, wenn `SEED_PREVIEW_MODE !== 'true'`.
  - `src/lib/payload/context.ts`: Typ `AppContext` mit `system`, `transition`, `seed`, `skipAudit`, `translation`, dazu
    Helfer `withSystem(req, transition)`.
  - `src/lib/payload/public.ts`: `getPublicPayload()` (immer `overrideAccess: false`, ohne `user`) und
    `getPublicSettings()` mit Whitelist (Spalte „Öff.“ in DATENMODELL §7.1).
  - `src/lib/cache/tags.ts` (Tag-Namen laut ARCHITEKTUR §9.3) und `src/lib/cache/revalidate.ts` mit
    `revalidateProduct(id, { immediate })`, `revalidateContent(key)` und `revalidateAll()`; bei `context.seed` wird
    nichts ausgelöst. `cached.ts` folgt in P3.1.
  - `src/fields/` laut DATENMODELL §5: `seedField()` (`seed` + `seedKey`, Regex `^[a-z-]+:[A-Za-z0-9:#._-]{1,80}$`,
    Format `<collection>:<schlüssel>`, partieller UNIQUE-Index, SEED-SPEC §1.2), `privacyFields()`,
    `addressFields(prefix)`, `internalLinkFields()`, `moneyField(name)` (Admin-Komponente
    `src/admin/components/EuroInput.tsx`, Ganzzahl-Validierung), `sortOrderField()`.
  - Payload-Grundkonfiguration:
    - `localization` wie DATENMODELL §1.2;
    - Admin-Sprache nur Deutsch (`@payloadcms/translations`, `i18n.supportedLanguages: { de }`);
    - `graphQL: { disable: true }`;
    - `admin.avatar: 'default'` (kein Gravatar-Request).
  - Akzeptanz:
    - `publicRead` liefert für den Admin `true`, sonst die Where-Query mit bzw. ohne Seed-Filter je nach
      `SEED_PREVIEW_MODE`.
    - `EuroInput` speichert „38,50“ als 3850 und lehnt „38,555“ ab.
    - `seedKey` ohne Präfix `<collection>:` wird abgelehnt.
  - Tests:
    - unit `tests/unit/access/access.unit.spec.ts`;
    - unit `tests/unit/fields/money-field.unit.spec.ts` (jsdom für `EuroInput`);
    - unit `tests/unit/fields/seed-field.unit.spec.ts`.
  - Ohne Jutta: –

- [x] **P1.7 Protokoll-Collections und Audit** – Laut DATENMODELL §6.21–§6.24 und §6.27: `src/collections/AuditLog.ts`,
  `EmailLog.ts`, `ConsentLog.ts`, `WebhookEvents.ts` und `DeletionLog.ts` (`deletion-log`, L-18: ohne Inhalte, Namen
  oder E-Mail-Adressen).
  - Zugriff: `create: none`, Lesen nur Admin, `update`/`delete` gesperrt. Unveränderliche Felder werden per Hook
    geprüft.
  - `src/lib/retention/policy.ts`: alle Löschfristen als Konstanten mit L-ID (einzige Stelle, Werte laut LOESCHKONZEPT;
    Rechnungen/Belege über `settings.retention.invoiceYears`). `retainUntil` wird daraus berechnet.
  - `src/lib/audit.ts`: `writeAudit(req, entry)` (DATENMODELL §6.21; ohne Personendaten, `context.skipAudit` verhindert
    Schleifen) und `getStatusHistory(collection, id)` – Statusverlauf für Stücke, Widerrufe und Anfragen aus
    `audit-log`; Bestellungen haben zusätzlich `orders.statusHistory` (DM-21, P1.20).
  - `src/lib/retention/log.ts`: `writeDeletionLog(req, entry)` in derselben Transaktion wie die Löschung
    (DATENMODELL §6.27).
  - Migration `p1_logs`.
  - Akzeptanz:
    - Anonymes REST-`POST`/`PATCH`/`DELETE` auf alle fünf Collections ist verboten.
    - Local API ohne `overrideAccess` kann nicht anlegen.
    - `writeAudit` maskiert Werte, die wie E-Mail oder IBAN aussehen.
    - `deletion-log.ruleId` akzeptiert nur `L-xx` (laut Regex DATENMODELL §6.27), `DSGVO` oder `ADMIN`.
    - `retainUntil` stimmt mit LOESCHKONZEPT überein; die Tabelle wird im Test aus `docs/recht/LOESCHKONZEPT.md`
      geparst.
  - Tests:
    - int `tests/int/collections/logs.int.spec.ts`;
    - unit `tests/unit/retention/policy.unit.spec.ts` (L-IDs im Titel).
  - Ohne Jutta: –

- [x] **P1.8 Speicher-Adapter und Spike B-02** – `src/lib/storage/` laut ARCHITEKTUR §3.1/§3.3 (`import 'server-only'`,
  Auswahl nur über `STORAGE_DRIVER`): Speicher-Konfiguration für die Payload-Uploads, signierte URLs und
  `systemFiles.ts` (`readJson(key)`, `writeJson(key, value)`; `local` → `.data/<key>`, `s3` → `S3_PRIVATE_BUCKET`,
  Präfix `system/`).
  - `local`: `upload.staticDir` = `${STORAGE_LOCAL_DIR}/media`, `…/documents`, `…/private` (Standard
    `STORAGE_LOCAL_DIR=.data`, außerhalb von `public/`); Auslieferung nur über Payloads Dateirouten mit
    Zugriffsprüfung, private Dateien nur für die angemeldete Verwaltung.
  - `s3`: zwei Instanzen von `@payloadcms/storage-s3` (exakt gepinnt, gleiche Version wie `payload`): `media` +
    `documents` → `S3_BUCKET` (Präfixe `media/`, `documents/`); `private-uploads` → `S3_PRIVATE_BUCKET`, Präfix
    `private/`, `signedDownloads` 300 s; `forcePathStyle: S3_FORCE_PATH_STYLE`, `clientUploads: false`.
  - Antwort-Header der Dateirouten laut §3.3 (`upload.modifyResponseHeaders`): uneingeschränkte Medien `immutable`;
    Medien mit `showsPerson = customer` und Seed-Medien kurz gecacht ohne `immutable`; private Dateien
    `private, no-store`.
  - `docker-compose.yml` bekommt das Profil `s3` (`minio/minio` + `minio/mc`, Buckets `pct-media-dev`,
    `pct-private-dev`).
  - Spike B-02: zwei Instanzen, Präfix `private/invoices/` je Dokument, signierte URL läuft ab. Ergebnis in
    ARCHITEKTUR Anhang B eintragen; bei Abweichung ADR und Rückfallebene umsetzen.
  - Akzeptanz:
    - Der Kontrakttest ist für `local` immer grün.
    - Für `s3` gegen MinIO (wenn erreichbar, sonst `skip` mit Hinweis): private Datei nur per signierter URL, nach
      Ablauf 403 (R-136, DM-PRIV-01 vorbereitet).
    - Keine Anfrage an fremde Hosts.
  - Tests: int `tests/int/adapters/storage.contract.int.spec.ts` (R-136).
  - Ohne Jutta: MinIO statt R2. P11: R2-Buckets und Schlüssel (A25, A33).

- [x] **P1.9 E-Mail-Adapter, Outbox, Jobs-Grundgerüst und Spike B-09** –
  - `src/lib/email/{types,index,file,smtp,memory,log}.ts` (ARCHITEKTUR §3.4; `@payloadcms/email-nodemailer` und
    `nodemailer` exakt gepinnt).
  - Eine Transport-Fabrik `createMailTransport(env)` für alle Treiber; `file` schreibt `.eml` + `.json` nach
    `EMAIL_FILE_DIR`; Test-Helfer `tests/helpers/outbox.ts` (`readOutbox({ to, type })`).
  - Unterdrückung in allen Umgebungen für `example.com`, `example.org`, `example.net`, `*.invalid` und `*.test`
    (R-180); `MAIL_REDIRECT_ALL_TO` wirkt nur bei `APP_ENV ≠ production` (ARCHITEKTUR §3.4).
  - `docker-compose.yml`: Mailpit bleibt.
  - Outbox-Helfer `src/lib/email/outbox.ts` (DATENMODELL §1.5): `email-log`-Zeile `queued` +
    `payload.jobs.queue({ task: 'sendEmail', input: { emailLogId }, req })`.
  - Task `src/jobs/sendEmail.ts`; in P1 nur mit der Vorlage `admin_alert` (Schlüssel aus `EMAIL_TEMPLATES`, schlichter
    Text). Das Vorlagen-Rendering folgt in P4.
  - `payload.config.ts` `jobs`: Queues `commerce`, `email`, `documents`, `maintenance`; `autoRun` nur bei
    `JOBS_AUTORUN=true`; `access.run` = Admin oder `Authorization: Bearer CRON_SECRET`.
  - Job-Wecker als Hauptweg (ARCHITEKTUR §9.6): `src/lib/jobs/alarm.ts` (`jobAlarm.bump(at)`, liest/schreibt
    `job-alarm.json` über `systemFiles.ts` aus P1.8) sowie die Route-Handler `GET /api/cron/tick` und
    `POST /api/cron/run/[task]` unter `src/app/(api)/api/cron/` als Gerüst (Bearer `CRON_SECRET`; der Tick antwortet
    ohne DB-Zugriff `204`, wenn nichts fällig ist). P5.3 vervollständigt Tick, Lauf-Protokoll und Locks.
    `/api/payload-jobs/run` bleibt nur Rückfall.
  - `src/jobs/index.ts`: Liste aller Task-Slugs aus ARCHITEKTUR Anhang A.3 mit Queue und Phase. Registriert werden nur
    implementierte Tasks.
  - `pnpm jobs:run <task> [--now=<ISO>]` (`scripts/jobs-run.ts`); nur Slugs aus Anhang A.3.
  - Spike B-09: Stellen `payload.jobs.handleSchedules()` und `payload.jobs.run()` in 3.90.2 die angenommenen Funktionen
    bereit? Prüfung mit einer Test-Config mit geplantem Test-Task und vorgestellter Uhr. Ergebnis in ARCHITEKTUR
    Anhang B, bei Abweichung ADR.
  - Akzeptanz:
    - AK-A-3-04: Eine Mail an `erika@example.com` wird mit `suppressed: true` protokolliert und nicht zugestellt,
      geprüft mit allen Treibern (SMTP gegen einen lokalen Fake-Server).
    - Die Outbox legt Zeile und Job in derselben Transaktion an: Ein Rollback entfernt beide.
    - `sendEmail` ist idempotent: ein zweiter Lauf versendet nicht erneut (DM-JOB-01, Teil).
    - Der Unit-Test gleicht `src/jobs/index.ts` mit der A.3-Tabelle ab.
    - AK-A-9-01 (Teil): Ein Tick ohne fälligen Weckzeitpunkt öffnet keine DB-Verbindung und antwortet 204; ohne
      gültigen Bearer-Token 401.
  - Tests:
    - int `tests/int/adapters/email.contract.int.spec.ts`;
    - int `tests/int/jobs/send-email.int.spec.ts`;
    - int `tests/int/jobs/tick.int.spec.ts` (AK-A-9-01, Pool-Zähler);
    - int `tests/int/spikes/b09-jobs.int.spec.ts`;
    - unit `tests/unit/jobs/slugs.unit.spec.ts`.
  - Ohne Jutta: `EMAIL_DRIVER=file`. P11: Lettermint-SMTP (A25, A33).

- [x] **P1.10 Adapter für Zahlung, Übersetzung und Versand (Schnittstellen und Mocks)** –
  - `src/lib/payments/types.ts` und `index.ts` (`getPaymentsAdapter()`), Treiber-Ordner `mock/` und `stripe/`:
    `PaymentsAdapter`-Schnittstelle vollständig laut ARCHITEKTUR §3.5 (Sitzung anlegen/abrufen/beenden, Versand
    aktualisieren, Erstattung, Webhook prüfen, Ereignisse und Gebühren abrufen; Eingabe `checkoutRef`, nie ein Token).
    Der Mock arbeitet mit IDs `cs_mock_<uuid>`, `pi_mock_<uuid>`, `re_mock_<uuid>`, `evt_mock_<uuid>`; sein Zustand liegt
    in der Datenbank (Kasse/Reservierung, `webhook-events` mit `provider = 'mock'`) und ist in Produktion verboten.
  - `stripe/` ist nur ein Gerüst, das ohne Schlüssel mit klarer Meldung abbricht; die Umsetzung folgt in P4.
  - `docker-compose.yml`: Profil `payments` (`stripe/stripe-mock`).
  - `src/lib/translation/{types,index,mock,deepl}.ts`: der Mock liefert deterministisch `"[EN] " + Text` (ARCHITEKTUR
    §3.6) und `usage`; `deepl` ist ein Gerüst ohne Aufruf ohne Schlüssel.
  - `src/lib/carrier/{types,index,manual}.ts` (ARCHITEKTUR §3.7, `CARRIER_DRIVER=manual` seit P1):
    `getCarrierAdapter()`, `trackingUrl(carrier, trackingNumber, locale)` aus `settings.shipping.trackingUrlTemplates`
    (ohne Vorlage oder ohne Nummer `null`), `validateTrackingNumber(carrier, trackingNumber)`; `CarrierCode` =
    `'dhl' | 'deutsche_post'`. Keine API („Später“: DHL-API-Labels).
  - Akzeptanz:
    - Kontrakttests je Adapter sind mit dem Mock grün und machen keine Netzwerkanfrage.
    - `TRANSLATION_DRIVER=mock` übersetzt „Schale“ zu „[EN] Schale“.
    - `stripe`/`deepl` ohne Schlüssel werfen `ConfigError` mit deutscher Meldung.
    - `validateTrackingNumber('dhl', '00340434161234567890') === true`; eine leere Nummer ergibt `false`.
  - Tests:
    - int `tests/int/adapters/{payments,translation,carrier}.contract.int.spec.ts`;
    - `payments` gegen `stripe-mock`, nur wenn erreichbar.
  - Ohne Jutta: Mocks. P11: Stripe- und DeepL-Schlüssel (A09, A23, A24, A25).

- [x] **P1.11 Konto `users`: ein Admin, Sperre, Rate-Limits, Admin-CLI** – `src/collections/Users.ts` laut DATENMODELL
  §6.1.
  - Es gibt genau ein Konto (E-03): Access `create` nur, solange noch kein Konto existiert (Ersteinrichtung/Grund-Seed);
    der `beforeChange`-Hook lehnt jedes zweite Konto ab, auch über die Local API. `read`/`update` nur das eigene Konto,
    `delete` `none`.
  - `auth` laut DATENMODELL §6.1: `maxLoginAttempts: 5`, `lockTime: 15 min`, `tokenExpiration: 7 Tage`,
    `cookies: { secure: NEXT_PUBLIC_SITE_URL beginnt mit https://, sameSite: 'Strict' }`, `forgotPassword` 1 h.
  - Passwort ≥ 12 Zeichen, ≠ E-Mail, nicht nur Ziffern (Hook-Validierung); `afterLogin` setzt `lastLoginAt` über die
    injizierte Uhr.
  - Mail „Passwort vergessen“ (KONZEPT A17, Schlüssel `admin_password_reset` aus `EMAIL_TEMPLATES`, DATENMODELL §6.1):
    deutscher Betreff und Text über `auth.forgotPassword.generateEmailSubject`/`generateEmailHTML`, Reset-Link auf den
    Pfad aus `ADMIN_ROUTE`, Hinweis „1 Stunde gültig“; Versand über den Adapter aus P1.9 (Unterdrückungsregeln gelten).
    `afterForgotPassword` schreibt den Audit-Eintrag `password_reset_requested` und eine `email-log`-Zeile
    `admin_password_reset` (Token nicht gespeichert, `bodySha256` mit Platzhalter an der Token-Stelle). P5.2 prüft
    danach nur noch die Zuordnung.
  - Rate-Limit-Tabelle `rate_limit_hits` (eigene SQL-Migration `p1_rate_limit`, ARCHITEKTUR §3.9) und
    `src/lib/security/rateLimit.ts` mit `hit(bucket, key, now)` (ARCHITEKTUR §3.9; Grenzen §8.5, Zähler 24 h
    gespeichert):
    - `admin_login`: 10 je 15 min je IP-Hash;
    - `forgot_password`: 3 je Stunde.
  - `pnpm admin:create` (fragt E-Mail und Passwort interaktiv ab, nie als Argument; verweigert ein zweites Konto) und
    `pnpm admin:unlock` (`scripts/admin-*.ts`).
  - Akzeptanz:
    - DM-USER-01: 5 Fehlversuche, danach wird der 6. Versuch mit richtigem Passwort als „gesperrt“ abgelehnt; nach
      15 min (Uhr-Mock) klappt er.
    - DM-USER-02: Ein zweites Konto per Local API und per REST schlägt fehl.
    - DM-USER-03: Ein Passwort mit 11 Zeichen wird abgelehnt.
    - AK-A-8-03: Der 11. Login-Versuch derselben IP innerhalb von 15 min ergibt 429.
    - `admin:unlock` hebt die Sperre auf.
    - A17: „Passwort vergessen“ rendert eine deutsche Mail (Betreff, Text, Reset-Link unter `ADMIN_ROUTE`), schreibt
      eine `email-log`-Zeile `admin_password_reset` (bei einer `@example.com`-Adresse mit `status = suppressed`) und
      den Audit-Eintrag `password_reset_requested`; der Token steht weder im `email-log` noch in der Log-Ausgabe.
  - Tests: int `tests/int/collections/users.int.spec.ts` (DM-USER-01…03, AK-A-8-03, R-136, A17
    `admin_password_reset`).
  - Ohne Jutta: Test-Admin aus `SEED_ADMIN_*`. P11: Jutta legt ihr Konto selbst an (A33).

- [x] **P1.12 Verwaltungspfad (Spike B-01), GraphQL entfernen, Health-Endpunkt** –
  - `src/proxy.ts` schreibt `ADMIN_ROUTE/*` intern auf den Ordner `src/app/(payload)/admin/` um; `/admin` und
    `/admin/*` liefern 404 (ARCHITEKTUR §8.4).
  - `routes.admin` wird aus `getEnv()` gesetzt, damit Links, Passwort-Reset und Weiterleitungen den richtigen Pfad
    nutzen.
  - Rückfallebene, falls der Spike scheitert: Ordner umbenennen. Ergebnis in ARCHITEKTUR Anhang B.
  - CSP-Teil von B-01 (Verwaltung mit Nonce, ARCHITEKTUR §8.1 Kontext `admin`) wird mit P2.12 geprüft, sobald die
    Header stehen; Rückfall nur `script-src 'self' 'unsafe-inline'` im Kontext `admin`, Hosts bleiben `'self'`, per ADR
    (R-131).
  - `src/app/(payload)/api/graphql*` löschen (AK-A-2-02).
  - `src/app/(api)/api/health/route.ts`: 200 `{ status: 'ok', version, appEnv }` ohne DB-Zugriff (ARCHITEKTUR §2.5,
    AK-A-2-01).
  - JSON- und Code-Felder im Admin nicht mit Monaco rendern (lädt sonst vom CDN, ARCHITEKTUR §8.4): eigene
    Nur-Lese-Anzeige `src/admin/components/JsonPreview.tsx` (`<pre>`) oder `admin.hidden: true`.
  - `tests/e2e/admin.e2e.spec.ts` nutzt den Pfad aus `ADMIN_ROUTE` und das `admin:create`-Konto; die
    `test.fixme`-Markierung aus P1.1a entfällt.
  - Akzeptanz:
    - AK-A-8-02: `GET /admin` und `GET /admin/collections/users` ergeben 404; `GET /werkstatt` zeigt die Login-Seite.
    - Der Wert von `ADMIN_ROUTE` kommt in keiner Datei unter `.next/static` und in keinem öffentlichen HTML vor
      (AK-2-04, Teil).
    - `GET /api/graphql` ergibt 404.
    - `/api/health` antwortet in < 100 ms und öffnet keine Pool-Verbindung (Zähler im Test).
    - Login, Liste, Bearbeiten und Passwort-Reset-Link funktionieren unter `/werkstatt`.
  - Tests:
    - e2e `tests/e2e/admin-route.e2e.spec.ts` @smoke (AK-A-8-02, AK-A-2-02);
    - int `tests/int/api/health.int.spec.ts` (AK-A-2-01);
    - Build-Prüfung in `scripts/check-external.ts --built` auf den Pfad-String (Grundgerüst, P2 erweitert).
  - Ohne Jutta: Produktionspfad wählt P11 (A33).

- [x] **P1.13 `media` und Bildpipeline** – `src/collections/Media.ts` laut DATENMODELL §6.2 und DESIGN §12.2 (Schritte 1–3,
  7, 8).
  - `beforeOperation`: `sharp(buffer).rotate().toColourspace('srgb')` wendet die Orientierung an und wandelt in sRGB;
    die Neukodierung entfernt alle Metadaten (EXIF, GPS, XMP, IPTC); das Original wird als WebP q90 in maximal
    2560 px gespeichert.
  - Bildgrößen laut DATENMODELL §6.2 (verbindlich), alle `withoutEnlargement`:
    - `thumb` 400×500 und `card` 800×1000, 4:5 ab Fokuspunkt;
    - `detail` Breite 1600 und `zoom` Breite 2560;
    - `og` 1200×630 als JPEG q85 (Rückfall für Link-Vorschauen).

    Weitere Größen gibt es nicht; kleine Karten nutzen `thumb`.
  - Berechnete Felder `placeholderDataUrl` und `dominantColor`.
  - `alt` ist in DE Pflicht, EN lokalisiert.
  - `restricted`-Bilder sind nicht öffentlich, auch nicht über die Datei-URL.
  - Erlaubt sind nur JPEG, PNG und WebP.
  - Admin-Upload-Komponente `src/admin/components/DownscaleUpload.tsx` verkleinert im Browser auf 2560 px (JPEG q0.85).
    Der Server prüft trotzdem.
  - `beforeDelete`-Referenzprüfung über `src/lib/media/references.ts`. Collections registrieren ihre Upload-Felder dort.
  - Fixtures: `tests/fixtures/images/gps-orientation-6.jpg` (GPS, Orientation=6, XMP, IPTC, per Skript
    `scripts/fixtures/make-exif-fixture.ts` erzeugt) und `tests/fixtures/images/landscape-small.jpg`.
  - Migration `p1_media`.
  - Akzeptanz:
    - DM-MEDIA-01/T-05/R-135: Original und alle Größen haben kein EXIF/GPS/XMP/IPTC (`exifr` + `sharp().metadata()`)
      und sind richtig gedreht.
    - DM-MEDIA-02: `thumb`/`card` sind 4:5 WebP (0,800 ± 0,002, AK-DS-17 Teil), `og` ist 1200×630 JPEG, nichts wird
      hochskaliert.
    - DM-MEDIA-03: Speichern ohne DE-Alt-Text scheitert.
    - DM-MEDIA-04: Die Datei eines `restricted`-Bildes ist ohne Login nicht abrufbar (403/404), mit Login schon.
    - Ein GIF- oder SVG-Upload wird abgelehnt.
  - Tests: int `tests/int/collections/media.int.spec.ts` (DM-MEDIA-01…04, R-135, T-05). DM-MEDIA-05 folgt in P1.16.
  - Ohne Jutta: Fixtures und Instagram-Ausschnitte (E-64). Volle Auflösung kommt mit dem Export (A04, A06).

- [x] **P1.14 `documents`, `private-uploads` und Aufbewahrungsmodul** – `src/collections/Documents.ts` (öffentliche PDFs,
  §6.3) und `src/collections/PrivateUploads.ts` (§6.4).
  - `private-uploads` nutzt die private Speicher-Instanz (`.data/private` bzw. `S3_PRIVATE_BUCKET`), ausgeliefert nur
    angemeldet (signiert, ≤ 300 s); max. 10 MB je Datei.
  - Bild-Uploads laufen durch dieselbe Metadaten-Entfernung wie `media` (`rotate()`, max. 2560 px, JPEG q85).
  - `deleteAfter`/`retainUntil` werden je `purpose` aus `src/lib/retention/policy.ts` berechnet (Tabelle
    „Aufbewahrung je Zweck“ in DATENMODELL §6.4; Beleg-PDFs über `settings.retention.invoiceYears`, bis P1.25 steht als
    Parameter mit Standard 10); `deleteAfter` darf nur verkürzt werden.
  - `beforeDelete`: gesperrt vor `retainUntil` (außer `seed`).
  - Die zugehörigen `retention*`-Tasks (ARCHITEKTUR Anhang A.3, z. B. `retentionTechnical`, `retentionInvoices`) folgen
    in P6; sie stehen schon in der Liste `src/jobs/index.ts`.
  - Migration `p1_documents`.
  - Akzeptanz:
    - DM-PRIV-01: Ohne Login liefert jede Dateiroute 401/403. Mit `STORAGE_DRIVER=s3` (MinIO) enthält die Admin-URL
      eine Signatur mit ≤ 300 s Gültigkeit.
    - DM-PRIV-02: Ein Referenzbild mit GPS wird ohne EXIF gespeichert.
    - Ein PDF mit `retainUntil` in der Zukunft lässt sich nicht löschen. DM-DOC-01 wird in P1.22 mit Rechtstexten
      geprüft.
  - Tests: int `tests/int/collections/private-uploads.int.spec.ts` (DM-PRIV-01/-02, R-136, R-135).
  - Ohne Jutta: –

- [x] **P1.25 Globals `settings` und `site-texts`** – `src/globals/Settings.ts` und `SiteTexts.ts` laut DATENMODELL §7.
  Steht direkt hinter P1.14, weil Stücke, Veröffentlichungsprüfung, Belege und Rechtstexte `settings` brauchen.
  - Validierungen je Feld; `versions: { max: 50 }`.
  - Audit `settings_changed` mit maskiertem Diff, `tax_mode_changed` mit Bestätigungsfeld „mit Steuerberatung
    abgestimmt“ und Pflicht-Begründung (R-032; Namen `tax.modes`, `kleinunternehmer`/`regelbesteuert` laut
    DATENMODELL).
  - Felder laut DATENMODELL §7.1, u. a. `legal.allowVisibleBlankBrands` (Standard `false`, R-047),
    `retention.invoiceYears` ∈ {8, 10} (Standard 10; Warnhinweis beim Umstellen), `packaging.templates` und
    `packaging.defaultsByShippingClass` (E-47, R-201; Standardwerte sind Schätzwerte, KA-29), `payment.iban` mit
    Standard `DE36000000000000000000` (Beispiel-IBAN, die Go-live-Sperre meldet genau diesen Wert).
  - `retention.invoiceYears` wird ab hier an `src/lib/retention/policy.ts` übergeben (P1.7, P1.14).
  - `shipping.enabledCountries`: `DE` Pflicht, Nicht-DE nur mit `shipping.euShippingAcknowledged` (DATENMODELL §7.1).
    EU-Versand und Schweiz sind „Später“: Gebaut werden nur die EU-Sperre und die Bestätigungen (Oberfläche in P5.22);
    die Kasse bleibt fest auf Deutschland, kein EU/CH-Ablauf in P1–P10.
  - `getPublicSettings()` liefert nur Whitelist-Felder.
  - Nicht editierbare Rechtskonstanten stehen in `src/lib/legal/constants.ts`: „Zahlungspflichtig bestellen“ /
    „Order with obligation to pay“, „Vertrag widerrufen“ / „Withdraw from contract here“ (R-090), „Widerruf
    bestätigen“ und der Kleinunternehmer-Satz.
  - Migration `p1_globals`.
  - Akzeptanz:
    - `tax.modes` ohne Eintrag oder mit doppeltem `validFrom` wird abgelehnt.
    - Ein Moduswechsel ohne Bestätigung wird abgelehnt und bei Erfolg auditiert (R-032).
    - Eine IBAN mit falscher Prüfsumme wird abgelehnt.
    - `getPublicSettings()` enthält weder `payment.iban` noch `business.taxNumber`.
    - `enabledCountries: ['DE','AT']` ohne `euShippingAcknowledged` wird abgelehnt; ohne `DE` ebenfalls.
    - `packaging.defaultsByShippingClass` hat genau einen Eintrag je Versandklasse (ohne `nur_abholung`), und jeder
      `templateKey` existiert.
    - `retention.invoiceYears` akzeptiert nur 8 oder 10; mit 8 berechnet `policy.ts` die Frist für Beleg-PDFs mit
      8 Jahren.
  - Tests: int `tests/int/globals/settings.int.spec.ts` (R-032); unit `tests/unit/legal/constants.unit.spec.ts`.
  - Ohne Jutta: Platzhalter laut Grund-Seed (DATENMODELL §13.1) und die Beispiel-IBAN. P11: A11, A12, A26.

- [x] **P1.15 `categories` und `conformity-declarations`** –
  - `src/collections/Categories.ts` laut DATENMODELL §6.5: 6 feste Keys, lokalisierte Slugs (DE `keramik`, `textil`,
    `caps`, `zeichnungen`, `schmuck`, `sonstiges`; EN `ceramics`, `textiles`, `caps`, `drawings`, `jewellery`,
    `other`), `create`/`delete` = `none`, `key` unveränderlich, `revalidateTag('categories')`. Slugs werden nie im Code
    festgeschrieben.
  - `src/collections/ConformityDeclarations.ts` laut §6.13, Nachweis-PDF in `private-uploads`.
  - Status `active`/`revoked`; der Wechsel auf `revoked` läuft nur über den Service `revokeConformityDeclaration`
    (DATENMODELL §6.6.6, §6.13, R-044). P1.15 legt die Collection und die Sperre an: Ein direkter Statuswechsel ohne den
    Service wird abgelehnt. Den Service selbst und die Löschsperre bei verknüpften Stücken baut P1.19, sobald Stücke und
    Statusautomat stehen.
  - Migration `p1_categories`.
  - Akzeptanz:
    - Das Anlegen einer 7. Kategorie scheitert per REST und per Local API ohne `context.seed`.
    - Zwei gleiche DE-Slugs werden abgelehnt.
    - Ein direktes `update({ status: 'revoked' })` ohne den Service wird abgelehnt (R-044, Teil).
  - Tests: int `tests/int/collections/categories.int.spec.ts`, `conformity.int.spec.ts` (R-044).
  - Ohne Jutta: Alle Keramik bleibt `deko` (E-15). P11: Glasur-Nachweise (A18).

- [x] **P1.16 `products`: Felder, Tabs, Bedingungen, Voreinstellungen** – `src/collections/Products.ts` laut DATENMODELL
  §6.6.1–§6.6.3, §6.6.8, §6.6.9; Feldnamen, Enums und Pflichtangaben ausschließlich aus DATENMODELL (u. a.
  `ownDesignConfirmed`, `vatCategory`/`vatReducedReason`, `hasDeviation`/`deviationDescription`). Dazu die Felder nach
  RECHT R-043–R-048 aus §6.6.1:
  - `leadFreeGlazeConfirmed` (Schmuck, R-045);
  - `framed` und `frameHasGlass` (Zeichnung; Glas-Hinweis `product.glassFrame` wird automatisch angefügt, R-046);
  - `blankBrandVisible` (textil/cap, R-047; Sperre solange `settings.legal.allowVisibleBlankBrands = false`);
  - `deviationDecision` (select `DeviationDecision`, textil/cap, R-048; der Hook leitet `hasDeviation` ab);
  - bei `labelMissing` Fasern **und** `fiberFreeText` (R-043).

  Admin-Aufbau:
  - Tabs „Basis“, „Pflichtangaben“, „Bilder“, „Verkauf“, „Intern“ (DATENMODELL §6.6.1).
  - `admin.condition` je Kategorie, damit nur relevante Felder erscheinen.
  - Kategorie-Voreinstellungen in `beforeValidate`, nur für leere Felder (§6.6.3).
  - Virtuelle Felder `adminTitle`, `displayNumber`, `isPublic`, `characteristics`
    (`src/lib/products/characteristics.ts` → `buildCharacteristics`).
  - Keine Versionen (§1.6).
  - Medien-Referenzen werden in `src/lib/media/references.ts` registriert.

  Das Feld `currentOrder` (Beziehung auf `orders`) ergänzt P1.20. Migration `p1_products`.
  - Akzeptanz:
    - DM-PROD-07: Die öffentliche Abfrage liefert keine `draft`/`archived`-Stücke, verkaufte nur mit
      `showInArchiveAfterSale`, und nie `reservationRef`, `internalNote`, `storageLocation`, `nickelEvidence`.
    - DM-MEDIA-05: Das Löschen eines Bildes, das ein veröffentlichtes Stück nutzt, wird verweigert.
    - `category` ist nur bei `draft` änderbar.
    - Die Voreinstellung überschreibt keine gesetzten Felder.
    - `buildCharacteristics` liefert je Kategorie die erwartete Liste (Snapshot DE/EN).
  - Tests:
    - int `tests/int/collections/products-fields.int.spec.ts` (DM-PROD-07, DM-MEDIA-05);
    - unit `tests/unit/products/characteristics.unit.spec.ts`.
  - Ohne Jutta: –

- [x] **P1.17 Objektnummern und Slug** – `src/lib/products/itemNumber.ts` laut DATENMODELL §6.6.4 und §6.6.8 (E-12,
  R-041):
  - `itemNumber` ist eine Ganzzahl 1–99999 und UNIQUE.
  - Sie ist unveränderlich, sobald `firstPublishedAt` gesetzt ist: Standardformular, REST und Local API ohne `seed`.
    Im Admin erscheint das Feld dann `readOnly` mit Hinweis.
  - `GET /api/products/next-item-number` (nur Admin) schlägt max(Nicht-Seed) + 1 vor. Seed-Bereich 901–930, E2E-Fixtures
    980–999; 901–999 ist gesperrt, solange Beispieldaten existieren (DATENMODELL §13.3).
  - Der Slug je Locale ist `<nr3>-<slugify(titel)>` (EN aus dem EN-Titel, Fallback DE), UNIQUE je Locale.
  - `formatItemNumber(nr, locale)` („Nr. 017“ / „No. 017“, ab 1000 ohne Auffüllen) liegt nur hier (ARCHITEKTUR §2.1);
    das virtuelle Feld `displayNumber` („017“) nutzt dieselbe Auffüll-Regel.
  - Akzeptanz:
    - DM-PROD-05: Eine doppelte `itemNumber` wird abgelehnt; nach der Veröffentlichung ist sie nicht änderbar, auch
      nicht per REST-`PATCH` (AK-7-03).
    - Mit echten Stücken 1, 2, 17 und Seed 901 lautet der Vorschlag 18.
    - `slugify('Schale „Fuchs“ Nr. 1') = 'schale-fuchs-nr-1'`.
    - Slug für Nr. 17 ergibt `017-…`; `formatItemNumber(17, 'de') = 'Nr. 017'`, `formatItemNumber(1234, 'en') =
      'No. 1234'`.
  - Tests:
    - unit `tests/unit/products/item-number.unit.spec.ts` (R-041);
    - int `tests/int/products/item-number.int.spec.ts` (DM-PROD-05, AK-7-03, R-041).
  - Ohne Jutta: –

- [x] **P1.18 Veröffentlichungsprüfung je Kategorie** – `src/lib/products/validate.ts` → `validateForPublish(product,
  ctx)` setzt die Tabelle DATENMODELL §6.6.6 um (inklusive der Regeln nach R-043–R-048). Sie läuft bei
  `draft → available`, `sold → available` und bei jedem Speichern mit `status ∈ {available, reserved}`. Fehler werden
  gesammelt, deutsch und mit Feldname. Die Lint-Listen V-13 und V-16 liegen in `src/lib/legal/forbidden.ts`.
  - Faserregeln §6.6.5 in `src/lib/products/fibers.ts`:
    - Liste `TEXTILE_FIBERS` aus VO (EU) 1007/2011 Anhang I; die Liste mit EUR-Lex abgleichen und die Quelle im
      Kommentar nennen;
    - Summe genau 100;
    - `labelMissing` ⇒ `fiberFreeText.de` **und** Fasern.
  - `foodContact = lebensmittelecht` braucht eine aktive `conformity-declaration` und wird schon beim Speichern eines
    Entwurfs geprüft (AK-7-01, R-044).
  - Schmuck: `metalPartsMaterial.de`, `nickelFreeConfirmed`, `nickelEvidence`, `smallPartsWarning` und
    `leadFreeGlazeConfirmed` (R-045).
  - Zeichnung: `framed` gesetzt; `frameHasGlass` fügt den Baustein `product.glassFrame` automatisch an
    `safetyWarnings` an (R-046).
  - `ownDesignConfirmed`, Marken-Lint (V-16) auf Titel/Beschreibung und `blankBrandVisible` ⇒ nur mit
    `settings.legal.allowVisibleBlankBrands` (R-047).
  - Textil/Cap: `deviationDecision` gesetzt; bei `hasDeviation` gilt `deviationDescription.de` (R-048).
  - Keramik `deko`: Texte dürfen keine Lebensmittel-Versprechen enthalten (V-13, R-044).
  - `vatCategory = reduced_art` nur bei `zeichnung` mit Begründung (R-032).
  - `settings.business` muss vollständig sein (GPSR).
  - Akzeptanz:
    - DM-PROD-01: Je Kategorie „vollständig → veröffentlichbar“, und je fehlender Pflichtangabe ein Test „wird
      abgelehnt“ mit Feldname in der Meldung.
    - DM-PROD-02: Faser-Summe 99 % oder 101 % wird abgelehnt, 60/40 angenommen; `labelMissing` ohne `fiberFreeText`
      wird abgelehnt.
    - DM-PROD-03: `lebensmittelecht` ohne aktive Erklärung wird abgelehnt, mit aktiver angenommen.
    - DM-PROD-04: Schmuck ohne `nickelFreeConfirmed`, ohne `nickelEvidence` oder ohne `leadFreeGlazeConfirmed` wird
      abgelehnt.
    - DM-PROD-09: Zeichnung mit `frameHasGlass` enthält den Glas-Hinweis; textil/cap ohne `deviationDecision` bzw. mit
      `blankBrandVisible = true` (bei `allowVisibleBlankBrands = false`) wird nicht veröffentlicht; ein fremder
      Figurenname aus V-16 im Titel wird abgelehnt.
    - AK-7-01 (alle drei Fälle).
    - Jede Regel nach R-043–R-048 hat einen Ablehnungstest.
  - Tests:
    - unit `tests/unit/products/validate.unit.spec.ts` (Tabellentests; Titel mit R-042, R-043, R-044, R-045, R-046,
      R-047, R-048);
    - int `tests/int/products/publish-validation.int.spec.ts` (DM-PROD-01…04, DM-PROD-09, AK-7-01, R-042).
  - Ohne Jutta: Schmuck bleibt unveröffentlichbar, bis Nachweise da sind (A17). Glasur-Erklärungen: A18.

- [x] **P1.20 `checkouts`, `reservations` und `orders` (Schema)** – `src/collections/Checkouts.ts` (DATENMODELL
  §6.25), `Reservations.ts` (§6.7) und `Orders.ts` (§6.8.1–§6.8.4, §6.8.6). Vor der Zahlung existiert nur die Kasse;
  eine Bestellung entsteht erst über `createOrderFromCheckout()` – bei Karte/PayPal durch `fulfillCheckout` als `paid`
  (O1/O19), bei Vorkasse sofort als `awaiting_prepayment` (O2). Es gibt keine Bestellstatus für abgebrochene oder
  abgelaufene Bezahlvorgänge; das sind Kassen-Zustände.
  - Zugriff: `create`/`update`/`delete` `none` (nur Services), Lesen nur Admin.
  - Kasse: `tokenHash` statt des Tokens (Token zufällig, nie aus `PAYLOAD_SECRET`, ARCHITEKTUR §8.6), `reservationRef`
    UNIQUE, Snapshot `items`, Zustände `CheckoutStatus` (`open`, `confirming`, `completed`, `expired`, `cancelled`,
    `failed`); `src/lib/commerce/checkoutTransitions.ts` mit der Tabelle aus §6.25.3. `legalTextVersions` ergänzt P1.22.
  - Bestellung: Positionen und Summen sind nach dem Anlegen unveränderlich (Hook; für `legalTextVersions` ergänzt P1.22
    dieselbe Regel); `statusTokenHash` statt des Tokens, dazu `statusTokenSealed` (versiegelter Token für den
    Status-Link späterer Mails, im Admin ausgeblendet; Siegel-Logik in P4.1, DATENMODELL §6.8); `statusHistory` je
    Wechsel (`from`, `to`, `at`, `actorType`, `transition`, `note`; DM-21); `disputed` merkt sich
    `statusBeforeDispute`, `withdrawal_received` `statusBeforeWithdrawal`.
  - `orderNumber` kommt aus der Sequenz, die in P1.26 angelegt wird. Bis dahin prüft ein Test nur das Format
    `PC-\d{4}-\d{5}` (DATENMODELL §8.7).
  - `src/lib/commerce/orderTransitions.ts` enthält `ORDER_TRANSITIONS` aus §6.8.5 als Daten plus eine Prüf-Funktion;
    die Anlage (O1, O2, O19) läuft nicht über diese Tabelle. Die Services mit Nebenwirkungen (`startCheckout`,
    `submitCheckout`, `fulfillCheckout`) folgen in P4/P5.
  - An `products` kommt das Feld `currentOrder` dazu (Beziehung auf `orders`, nur Admin lesbar, DATENMODELL §6.6.1).
    Verweise von `orders` auf `invoices`/`withdrawals` ergänzt P1.21, auf `complaints` P6.
  - Migration `p1_orders`.
  - Akzeptanz:
    - DM-ORD-02 (Teil): Nach dem Anlegen lassen sich `items` und Summen per Local API nicht ändern
      (`legalTextVersions`: P1.22).
    - DM-PROD-07 (Rest): Öffentliche Produktabfragen enthalten `currentOrder` nicht.
    - DM-ORD-01 (Tabelle): Jeder nicht erlaubte Übergang wirft einen Fehler, jeder erlaubte ist als Datenpaar getestet;
      `ORDER_STATUSES` ist exakt das Enum aus DATENMODELL §4.
    - DM-CHK-02 (Tabelle): genau die Kassen-Übergänge aus §6.25.3 gelingen.
    - DM-CHK-01 (Teil): Eine Kasse speichert nur `tokenHash`; der Token erscheint in keinem Log.
    - Anonymes REST auf alle drei Collections: 403/404 für alle Methoden.
    - `DM-ORD-05`-Vorbedingung: `shippingCents` wird aus der höchsten Versandklasse berechnet (reine Funktion
      `computeShipping`).
  - Tests:
    - int `tests/int/collections/orders.int.spec.ts` (DM-ORD-02, DM-CHK-01, DM-PROD-07 `currentOrder`);
    - unit `tests/unit/commerce/order-transitions.unit.spec.ts` (DM-ORD-01);
    - unit `tests/unit/commerce/checkout-transitions.unit.spec.ts` (DM-CHK-02);
    - unit `tests/unit/commerce/shipping.unit.spec.ts`.
  - Ohne Jutta: –

- [x] **P1.21 `invoices`, `invoice-counters`, `withdrawals` (Schema)** – `src/collections/Invoices.ts` (§6.9),
  `InvoiceCounters.ts` (§6.10) und `Withdrawals.ts` (§6.11).
  - Belege sind nach `issued` unveränderlich. Der GoBD-Trigger kommt in P1.26.
  - `src/lib/commerce/invoiceNumber.ts` vergibt Nummern über eine Zählerzeile mit Row-Lock (§8.6). Serien `RE`, `GS`,
    `BSP-RE`, `BSP-GS`.
  - `src/lib/tax/` (einzige Stelle, ARCHITEKTUR §2.1): `getTaxModeAt(settings, date)` und `computeTax(lines, mode)`
    mit den DATENMODELL-Namen (`settings.tax.modes`, `kleinunternehmer`/`regelbesteuert`, `vatCategory`) und dem
    Verhalten aus R-032.
  - Widerrufe: `name`/`receivedAt` sind unveränderlich, `matchStatus`, Nummer `WR-<JJJJ>-<5 Stellen>` (DATENMODELL §8.7).
  - Ergänzt an `orders` die Beziehungen und Joins auf `invoices` und `withdrawals` (DATENMODELL §6.8).
  - Migration `p1_invoices`.
  - Akzeptanz:
    - DM-INV-01: 20 parallele Nummernvergaben (20 Verbindungen) ergeben `RE-2026-00001 … 00020` ohne Lücke und
      Dopplung.
    - DM-INV-02: Ein künstlicher Fehler nach der Vergabe verbraucht keine Nummer.
    - DM-WDR-03: `name`/`receivedAt` sind nicht änderbar.
    - DM-INV-04 (Logik): Ein Moduswechsel ab Datum X ändert keine alten Belege; `getTaxModeAt` liefert vor/nach X
      den richtigen Modus.
    - `computeTax` im Kleinunternehmer-Modus ergibt 0 Steuer.
  - Tests:
    - int `tests/int/commerce/invoice-number.int.spec.ts` (DM-INV-01/-02);
    - int `tests/int/collections/withdrawals.int.spec.ts` (DM-WDR-03);
    - unit `tests/unit/tax/tax-mode.unit.spec.ts` (R-032).
  - Ohne Jutta: Kleinunternehmer-Modus (E-02). Steuer-Nummer folgt in P11 (A11, A12).

- [x] **P1.19 Produkt-Statusautomat, Admin-Endpunkte, EN-Status und Übersetzen** –
  `src/lib/commerce/productTransitions.ts` (ARCHITEKTUR §2.1) mit der Tabelle `PRODUCT_TRANSITIONS` setzt DATENMODELL
  §6.6.7 um (Verhalten = KONZEPT §5.1 P1–P15). Steht hinter P1.20 und P1.21, weil `currentOrder`, `sell-offline` und
  P11/P13 Kassen und Bestellungen brauchen.
  - `transitionProduct(req, id, transition, input)` prüft den erlaubten Übergang und setzt die Nebenwirkungen
    (`firstPublishedAt`, `soldAt`, `soldChannel`, `archivedAt`, `currentOrder`).
  - Jeder Wechsel schreibt Audit `product_status_changed` (Statusverlauf, DM-21) und löst eine Revalidierung aus.
  - `beforeChange` lehnt `status`-Änderungen ohne `context.transition` ab.
  - Preis, Versandklasse und Kategorie sind bei `reserved`/`sold` gesperrt.
  - Endpunkte laut DATENMODELL §6.6.10 in `src/endpoints/products/*`: `next-item-number` (P1.17), `publish` (P2),
    `unpublish` (P3), `sell-offline` (P9; P10 nur mit `confirmReservedCheckout: true` und Kasse im Zustand `open`),
    `archive` (P12), `archive-after-return` (P13), `restore` (P14, `archived → draft`), `return-to-stock` (P11),
    `translate`, `adopt`.
  - System-Übergänge `reserve`/`release`/`sell` werden als Funktionen in der Matrix getestet; die SQL-Reservierung
    folgt in P4.
  - `enStatus`-Hook (§6.6.8 Nr. 5).
  - `translate` nutzt den Übersetzungs-Adapter mit `context.translation`; `force` überschreibt geprüfte EN-Texte.
  - `beforeDelete` nach §6.6.8 / P15.
  - Service `revokeConformityDeclaration` (DATENMODELL §6.6.6, §6.13, R-044; Sperre aus P1.15), eine Transaktion:
    verknüpfte `available`-Stücke mit `foodContact = lebensmittelecht` ohne andere gültige Erklärung gehen per
    Systemübergang P3 (`unpublish`) auf `draft`, jedes betroffene Stück bekommt `adminAttention`
    (`conformity_revoked`), eine Mail `admin_alert` wird über die Outbox eingereiht, Audit, danach Revalidierung. Dazu
    die Löschsperre: Eine Erklärung mit verknüpften Stücken lässt sich nicht löschen.
  - Akzeptanz:
    - AK-5-01 (Produkt), DM-PROD-10: Alle Übergänge P1–P15 gelingen mit ihren Bedingungen, jeder andere Übergang wird
      abgelehnt (Matrix aus allen Status-Paaren).
    - DM-PROD-06: Ein direktes `update({ status: 'sold' })` ohne `context.transition` schlägt fehl.
    - DM-PROD-08: Eine Preisänderung bei `reserved` wird abgelehnt.
    - AK-5-02 über das Audit: Jeder Wechsel erzeugt einen Eintrag mit Auslöser.
    - `translate` mit Mock setzt EN-Felder auf „[EN] …“ und `enStatus = machine`. Eine spätere manuelle EN-Änderung
      setzt `reviewed`.
    - Ein veröffentlichtes Stück kann nicht gelöscht werden.
    - P13 (`sold → archived`, `archive-after-return`) gelingt nur, wenn die Bestellposition `refunded` und die Ware
      zurück ist (`timestamps.returnReceivedAt`) **oder** die Bestellung mit `refunds[].reason = breakage` erstattet
      wurde (Bruch vor dem Versand; Fixture analog O08/S09; mit dem echten Anker prüft P8.21); P11
      (`return-to-stock`) zusätzlich nach Erstattung mit Grund `admin_cancellation`, bevor das Stück verschickt oder
      übergeben wurde; sonst Ablehnung mit deutscher Meldung (DATENMODELL §6.6.7, KONZEPT §5.1).
    - R-044: Der Widerruf einer Erklärung nimmt betroffene Stücke offline und erzeugt Audit-Eintrag und Mail-Zeile; ein
      Stück mit einer weiteren aktiven Erklärung bleibt online; eine Erklärung mit verknüpften Stücken ist nicht
      löschbar.
  - Tests:
    - unit `tests/unit/products/transitions.unit.spec.ts` (AK-5-01, DM-PROD-10);
    - int `tests/int/products/status.int.spec.ts` (DM-PROD-06, DM-PROD-08, AK-5-02);
    - int `tests/int/products/translate.int.spec.ts`;
    - int `tests/int/products/conformity-revoke.int.spec.ts` (R-044).
  - Ohne Jutta: DeepL-Schlüssel folgt in P11 (A25).

- [x] **P1.22 `legal-texts`: Fassungen, Aktivierung, Tokens** – `src/collections/LegalTexts.ts` laut DATENMODELL §6.12
  und RECHT R-002/R-012 (strengere Regel gilt).
  - Jede Fassung ist ein eigenes Dokument (Typen aus `LEGAL_TEXT_TYPES`: `impressum`, `datenschutz`, `agb`,
    `widerrufsbelehrung`, `widerrufsformular`, `versand-zahlung`), `status` `draft`/`scheduled`/`active`/`superseded`
    (`active` = „veröffentlicht“ in R-012).
  - Feld `origin` ∈ {`placeholder`, `draft`, `lawyer`} (R-002); `isPlaceholder` = (`origin = placeholder`), per Hook
    abgeleitet; das Feld `source` (`manual`/`itrk_lti`) beschreibt nur den Eingangsweg.
  - Rich Text DE/EN; `validFrom ≥ jetzt − 1 min` (Ausnahme `context.seed`).
  - `src/lib/legal/activate.ts` (`activateLegalText`, transaktional).
  - Renderer `src/lib/legal/render.ts` (DATENMODELL §6.12): genau die Token-Liste aus R-012 (`{{name}}`,
    `{{street}}`, `{{postalCode}}`, `{{city}}`, `{{email}}`, `{{phone}}`, `{{wIdNr}}`, `{{ustIdNr}}`, `{{siteUrl}}`,
    `{{withdrawalUrl}}`, `{{shippingTable}}`, `{{deliveryTime}}`, `{{vorkasseDays}}`, `{{returnCostsNote}}`), Werte
    aus `settings` bzw. `NEXT_PUBLIC_SITE_URL`; keine Aliase. Ein unbekanntes oder unersetztes Token ist ein
    Render-Fehler; `{{STEUERNUMMER}}` wird nie aufgelöst (E-46). Nur `{{wIdNr}}`/`{{ustIdNr}}` dürfen leer ersetzt
    werden.
  - `src/lib/legal/getActive.ts`: `getActiveLegalText(type, at)`.
  - PDF-Erzeugung (`renderLegalTextPdf`): Grundfassung in P4.12 (Anhänge von M01/M02), Ausbau mit Aktivierung, Vorschau
    und Prüfungen in P6.3.
  - Ergänzt an `checkouts` und `orders` die Gruppe `legalTextVersions` (`agb`, `widerrufsbelehrung`,
    `widerrufsformular`, `datenschutz`, `versandZahlung` → `legal-texts`; DATENMODELL §6.8, §6.25); bei Bestellungen
    nach dem Anlegen unveränderlich (Hook aus P1.20).
  - Migration `p1_legal`.
  - Akzeptanz:
    - DM-LEG-01: Die Aktivierung von AGB v2 setzt v1 auf `superseded`; zu jedem Zeitpunkt gibt es genau eine aktive
      Fassung je Typ.
    - DM-LEG-03: Eine Inhaltsänderung an einer aktiven Fassung wird abgelehnt.
    - DM-DOC-01: Das PDF einer abgelösten Fassung ist nicht löschbar (mit Fixture-PDF).
    - DM-LEG-04: `{{name}}` und `{{withdrawalUrl}}` (DE `…/de/vertrag-widerrufen`, EN `…/en/withdraw-from-contract`)
      werden ersetzt; `{{unknown}}`, `{{business.street}}` und `{{STEUERNUMMER}}` brechen ab (R-012);
      `origin = placeholder` ⇔ `isPlaceholder = true` (R-002).
    - Bestellungen und Kassen verweisen per `legalTextVersions` auf Fassungen (Schema, R-012).
    - DM-ORD-02 (Rest): `legalTextVersions` einer Bestellung lässt sich nach dem Anlegen per Local API nicht ändern.
  - Tests: int `tests/int/legal/legal-texts.int.spec.ts` (DM-LEG-01, DM-LEG-03, DM-LEG-04, DM-DOC-01, R-012); int
    `tests/int/collections/orders.int.spec.ts` um DM-ORD-02 (`legalTextVersions`) erweitert.
  - Ohne Jutta: Platzhalter-Fassungen (R-002). Die Kanzlei-Texte folgen in P11 (A08, A28).

- [x] **P1.23 Tattoo-Collections: `flash`, `tattoo-offers`, `tattoo-gallery`** – Laut DATENMODELL §6.14–§6.16 (E-42,
  E-52, E-53).
  - `flash`: einmalig/wiederholbar, `status` aus `FLASH_STATUSES` (`available`/`claimed`), `number` Ganzzahl 1–9999
    (Anzeige `F-012`, Seed `F-901`).
  - `tattoo-offers`: öffentliches `read` mit Filter `published = true` und `endsAt > now` (injizierte Uhr);
    `endsAt` standardmäßig Ende des Starttags 23:59 Europe/Berlin.
  - `tattoo-gallery`: `published` nur mit `consentGiven` + `consentDate` + `consentNote` bei `showsCustomer`;
    `afterChange` setzt `media.restricted` der verknüpften Bilder. Ausnahme: `seed = true` mit `SEED_PREVIEW_MODE=true`
    (nie in Produktion). Nachweis in `private-uploads` (`purpose = consent_evidence`). Keine Versionen und keine
    Drafts (Personendaten und Einwilligung, DATENMODELL §1.6).
  - Keine Anzahlung, keine Termine („Später“).
  - Migration `p1_tattoo`.
  - Akzeptanz:
    - DM-OFF-01 (Abfrage-Teil): Ein Angebot mit `endsAt` in der Vergangenheit fehlt in öffentlichen Abfragen. Die
      Revalidierung der Seiten (Task `revalidateEndedOffers`, Weckzeit exakt `startsAt`/`endsAt`, tägliches
      Sicherheitsnetz ab 00:05 Berlin) folgt in P7.
    - DM-GAL-01: `published = true` ohne Einwilligung bei `showsCustomer` wird abgelehnt.
    - AK-1-03: Mit `APP_ENV=production` und `SEED_PREVIEW_MODE=true` liefert die Galerie-Abfrage keine Bilder mit
      `consentGiven=false`.
  - Tests: int `tests/int/collections/tattoo.int.spec.ts` (DM-OFF-01, DM-GAL-01, AK-1-03).
  - Ohne Jutta: Einwilligungen holt Jutta nach (A13).

- [x] **P1.24 `inquiries`, `faqs`, `pages`, `revenue-entries`, `privacy-requests`** – Laut DATENMODELL §6.17–§6.20 und
  §6.26.
  - `inquiries`: `create: none` (Formular P7), Referenzbilder in `private-uploads`, `deleteAfter` = `createdAt` +
    6 Monate (L-10, aus `src/lib/retention/policy.ts`), `reference` `AA-<JJJJ>-<NNNN>`.
  - `faqs`.
  - `pages` mit `key` aus `PAGE_KEYS`, Drafts (`maxPerDoc: 25`) und den Blöcken aus §6.19 (`src/blocks/<Name>.ts`),
    u. a. `hero`, `station` mit `stationId`, `cocoPose`, `ornament`, `link` (`internalLinkFields`), `contactLinks`,
    `richText`.
  - Adopt-Regel: Speichern ohne `context.seed` setzt `seed = false`.
  - `revenue-entries`: UNIQUE (`month`, `source`), Cent-Beträge; ein echter Eintrag für denselben Monat und dieselbe
    Quelle ersetzt einen Seed-Eintrag (der Seed-Eintrag wird vorher gelöscht, kein UNIQUE-Konflikt).
  - `privacy-requests` (L-17, R-150–R-153): `reference` `DS-<JJJJ>-<NNNN>`, `dueAt` = `receivedAt` + 1 Monat
    kalendergenau (Europe/Berlin), Status `received → identity_check → in_progress → answered | rejected`, `delete`
    `none`, keine Versionen, `seedField()` (DM-19; die Beispiel-Anfragen DS1–DS5 legt P8.5a an); Aktionen aus einer
    Anfrage schreiben `deletion-log`. Oberfläche und Erinnerungs-Task folgen in P6.
  - Migration `p1_content`.
  - Akzeptanz:
    - Ein zweites Dokument mit `key = home` wird abgelehnt.
    - Das Speichern einer Seed-FAQ im Admin setzt `seed = false` (AK-SEED-17, Teil).
    - Ein doppelter echter Eintrag (`2026-09`, `tattoo`) wird abgelehnt; ein echter Eintrag ersetzt einen Seed-Eintrag.
    - Anonymes Lesen von `inquiries` und `privacy-requests` ergibt 403.
    - DM-PRQ-01: `dueAt` kalendergenau (15.10. → 15.11.; 31.01.2027 → 28.02.2027).
  - Tests: int `tests/int/collections/content.int.spec.ts`; int `tests/int/collections/privacy-requests.int.spec.ts`
    (DM-PRQ-01).
  - Ohne Jutta: Seitentexte sind Entwürfe im Insta-Ton (E-62); Jutta korrigiert sie später.

- [x] **P1.26 Eigene Postgres-Objekte (`p1_constraints`)** – Migration `pnpm payload migrate:create p1_constraints` mit
  eigenem SQL laut DATENMODELL §9. Tabellen- und Spaltennamen werden vorher im generierten SQL geprüft.
  - Sequenzen `order_number_seq`, `withdrawal_number_seq`, `inquiry_number_seq`, `privacy_request_number_seq` (§9.1).
  - CHECK-Constraints §9.2, u. a. Cent-Beträge ganzzahlig und ≥ 0, `item_number` 1–99999, Summen der Kassen
    (`checkouts_totals_consistent`).
  - Partielle UNIQUE-Indizes §9.3: `reservations_one_active_per_product`, `legal_texts_one_active_per_type`,
    `invoices_one_invoice_per_order` und `<tabelle>_seed_key_unique` (`WHERE seed_key IS NOT NULL`) für jede Tabelle der
    Liste in §9.3.
  - Trigger `invoices_guard` mit Funktion `pc_guard_invoices()` (GoBD, §9.4).
  - `down` entfernt alles.
  - Nummernvergabe für `orders`/`withdrawals`/`inquiries`/`privacy-requests` über die Sequenzen
    (`src/lib/db/sequences.ts`; Formate DATENMODELL §8.7).
  - Akzeptanz:
    - DM-P1-02/T-14: Alle Objekte aus §9 existieren. Der Test fragt `pg_indexes`, `pg_constraint`, `pg_trigger` und
      `pg_sequences` ab.
    - DM-RES-03: Ein zweites direktes `INSERT` einer aktiven Reservierung für dasselbe Produkt verletzt den Index.
    - DM-INV-03: `UPDATE invoices SET total_gross_cents = …` und `DELETE` per SQL schlagen fehl (außer Seed-Serien).
    - `pnpm check:migrations` ist grün.
  - Tests:
    - int `tests/int/db/pg-objects.int.spec.ts` (T-14, DM-P1-02);
    - int `tests/int/db/constraints.int.spec.ts` (DM-RES-03, DM-INV-03).
  - Ohne Jutta: –

- [x] **P1.27 Zugriffsmatrix aller Collections (T-15)** – Eine Datei `tests/int/access/matrix.ts` beschreibt für alle 27
  Collections der P1 (DATENMODELL §10.1; `legal-snippets` und `complaints` ergänzt P6) und 2 Globals das erlaubte
  anonyme Ergebnis für REST `GET`/`POST`/`PATCH`/`DELETE`, samt öffentlicher Where-Filter und versteckter Felder
  (DATENMODELL §1.4 und die Access-Abschnitte je Collection).
  - Akzeptanz:
    - DM-P1-03: Jeder Eintrag der Matrix wird gegen den laufenden REST-Handler geprüft.
    - Eine neue Collection ohne Matrix-Eintrag lässt den Test scheitern (Abgleich mit `payload.config.collections`).
    - Öffentliche Antworten enthalten keine `adminField`-Felder.
  - Tests: int `tests/int/access/access-matrix.int.spec.ts` (T-15, DM-P1-03, R-136).
  - Ohne Jutta: –

- [x] **P1.28 Seed-Rahmen** – Bibliothek `src/lib/seed/` und CLI `scripts/seed/cli.ts` (ARCHITEKTUR §2.1, SEED-SPEC
  §1.4); das Skript ruft nur die Bibliothek auf.
  - Aufruf: `payload run scripts/seed/cli.ts -- <base|example|all|remove|reset>`, Lösung aus dem Spike in P1.5.
  - `guard.ts` (SEED-SPEC §1.5 und ARCHITEKTUR §4.8):
    - Abbruch vor jedem Schreiben bei `APP_ENV = production`, bei einer als Produktion markierten DB oder bei
      `orders.stripe.livemode = true`; `NODE_ENV` und `VERCEL_ENV` werden nicht ausgewertet;
    - `seed:base` ist erlaubt (Erstbefüllung P11);
    - `seed`, `seed:example`, `seed:remove` und `seed:reset` brechen in Produktion ab; dort entfernt nur der
      Admin-Knopf aus P8 Beispieldaten.
  - `time.ts`: `resolveSeedTime(expr, { now })` für die Ausdrücke der Tabelle SEED-SPEC §2.2; `now` kommt aus
    `SEED_NOW` (CI `2026-10-15T10:00:00+02:00`; leer = aktuelle Zeit der injizierten Uhr).
  - `tokens.ts`: `seedToken(seedKey, purpose)` mit `purpose` `'checkout'` (Kassen, `checkouts.tokenHash`) bzw.
    `'status'` (Bestellungen, `orders.statusTokenHash`) laut SEED-SPEC §2.5, nur für `seed: true`; nie aus der
    Bestellnummer und nie aus `PAYLOAD_SECRET`.
  - `schemas.ts`: zod je Datei, Enum-Werte nur aus `src/lib/enums.ts`.
  - `loader.ts`: alles oder nichts.
  - `upsert.ts`: Idempotenz über `seedKey` (§1.3); übernommene Dokumente (`seed = false`) werden übersprungen.
  - `context.ts`: `{ seed: true, skipAudit: true }` (§1.6).
  - `fallbackArt.ts` (§4.3).
  - `remove.ts`: Reihenfolge laut DATENMODELL §13.5, Option `keepTexts`.
  - Ausgabe je Collection: angelegt / aktualisiert / übersprungen.
  - `package.json`: `seed`, `seed:base`, `seed:example`, `seed:remove`, `seed:reset` (SEED-SPEC §1.4; `seed:reset`
    gehört auch in ARCHITEKTUR §6.10).
  - Akzeptanz:
    - AK-SEED-04/AK-11-04/AK-A-4-01: `APP_ENV=production pnpm seed`, `… seed:example`, `… seed:remove --yes` und
      `… seed:reset` sowie `pnpm seed` gegen eine als Produktion markierte DB enden mit Exit 1 ohne Schreiboperation
      (Zähler `pg_stat_database.xact_commit` oder Spy).
    - AK-SEED-16: `resolveSeedTime` erfüllt jede Zeile der Tabelle §2.2; ein ungültiges `SEED_NOW` (kein ISO 8601 mit
      Offset) ergibt Exit 1.
    - AK-SEED-05 (Rahmen): Während des Seeds entstehen 0 Mails, 0 Jobs und 0 Adapter-Aufrufe (Spies).
    - Eine ungültige Datendatei bricht vor dem ersten Schreiben ab.
  - Tests:
    - unit `tests/unit/seed/time.unit.spec.ts` (AK-SEED-16);
    - int `tests/int/seed/guard.int.spec.ts` (AK-SEED-04, AK-11-04, AK-A-4-01);
    - int `tests/int/seed/side-effects.int.spec.ts` (AK-SEED-05).
  - Ohne Jutta: –

- [x] **P1.29 Grund-Seed (`pnpm seed:base`)** – `content/seed/data/base.json` und der Import laut SEED-SPEC §3,
  `seed = false`, nur anlegen, wenn es fehlt:
  - `settings` mit Standardwerten (§3.1, DATENMODELL §7.1): Versandtarife nur Zone DE (`brief` 450, `paket_klein` 650,
    `keramik` 890; EU/CH-Versand ist „Später“), Beispiel-IBAN `DE36000000000000000000`, `retention.invoiceYears` 10,
    `legal.allowVisibleBlankBrands` `false`, `packaging.templates` und `packaging.defaultsByShippingClass` mit den
    Schätzwerten aus DATENMODELL §7.1 (KA-29).
  - Vorlagen `safetyTemplates` (je Kategorie DE/EN), `careTemplates`, `packingChecklists` (§3.2).
  - 6 `categories` mit Intros und Slugs (§3.3).
  - 6 `legal-texts`-Platzhalter (Typen aus `LEGAL_TEXT_TYPES`): v1 `active`, `origin = placeholder`
    (⇒ `isPlaceholder = true`), `source = manual`, `seed = false`, `validFrom = 2026-01-01`; Inhalt = Überschriften
    laut KANZLEI-BRIEFING §1, unter jeder Überschrift nur der Satz „Text folgt von der Kanzlei.“ (R-002; das Band
    „PLATZHALTER – nicht rechtsverbindlich“ rendert die Seite, es steht nicht im Inhalt); Tokens nur aus der Liste in
    R-012 (§3.4). Sie gehören zum Grund-Seed und bleiben beim Entfernen der Beispieldaten erhalten.
  - Admin aus `SEED_ADMIN_*` (nur außerhalb von Produktion und nur, wenn `users` leer ist).
  - `site-texts`-Standards DE/EN (§3.5).
  - Ab hier ruft `db:reset --test` nach der Migration `seed:base` auf (ARCHITEKTUR §7.2).
  - Akzeptanz:
    - Ein zweiter `seed:base`-Lauf erzeugt keine Duplikate und überschreibt keinen vorhandenen Wert (DM-P1-04 Teil,
      AK-SEED-04 Teil).
    - Alle 6 Kategorien, 6 aktive Platzhalter-Fassungen (`origin = placeholder`) und genau ein Admin existieren.
    - `getActiveLegalText('agb', jetzt)` liefert v1; das Rendern jeder Platzhalter-Fassung wirft keinen Token-Fehler.
    - Verbotsmuster-Test über `content/seed/**` ist grün (AK-SEED-13, Teil).
  - Tests: int `tests/int/seed/base.int.spec.ts` (DM-P1-04, AK-SEED-02 Grund-Seed-Teil).
  - Ohne Jutta: Platzhalter für Name, Adresse und Bank (A11, A12, A26).

- [x] **P1.30 Mini-Beispielbestand und Entfernen** – Teilmenge der SEED-SPEC (W-21). Datendateien unter
  `content/seed/data/` mit den endgültigen `seedKey`s, damit P8 nur ergänzt:
  - `products.json`: die Stücke S01, S06, S09, S11, S15, S18, S20, S25, S26 und S27 aus SEED-SPEC §5.1 (Nummern 9nn,
    Status laut §5.1): zusammen `available`, `sold` (offline, im Archiv sichtbar), `archived`, `draft` und `reserved`.
    S09 entsteht direkt als `archived` (Stand nach der Erstattung von O08 wegen `breakage`; `soldAt`/`currentOrder`
    leer, SEED-SPEC §5.3); die Bestellung O08 folgt in P8. Stücke, deren Status an einer Beispiel-Bestellung hängt (u. a.
    S30 für `sonstiges`), folgen in P8.
  - S27 (`reserved`, „Kasse läuft“): dazu die offene Kasse `checkouts:KS2` (Status `open`, SEED-SPEC §7.3) und die
    aktive Reservierung `reservations:KS2` (`source = checkout_session`) mit den Zeitwerten aus SEED-SPEC
    (`displayExpiresAt` `N+24min`, `expiresAt` `N+30min`); Token nur als `tokenHash` (SHA-256 hex von
    `seedToken('checkouts:KS2', 'checkout')`).
  - `media.json`: die Instagram-Ausschnitte (§4.1), die diese Stücke und die Startseite brauchen, durch die Pipeline
    aus P1.13; `ph:`-Bilder über `src/lib/seed/fallbackArt.ts` (§4.3).
  - `private-uploads.json`: `nickel-demo` (ohne diesen Nickel-Nachweis besteht S26 `validateForPublish` nicht) und
    `glaze-demo` (§4.4).
  - `pages.json`: `home` vollständig laut §13.1 (Hero + 7 Stationen, DE/EN); dazu `contact` laut §13.3.
  - `pnpm seed:example` importiert in der Reihenfolge §1.7; `pnpm seed:remove --yes [--drop-texts]` und
    `pnpm seed:reset`. `ci.yml` bekommt Schritt 8 (`pnpm seed` vor `pnpm build`, ARCHITEKTUR §6.3).
  - Setzt `settings.seed.exampleDataPresent`/`importedAt`.
  - Akzeptanz:
    - DM-P1-04: `seed:example` zweimal ergibt keine Duplikate.
    - `seed:remove --yes` ergibt 0 Dokumente mit `seed = true` (auch keine Kasse und keine Reservierung), Seiten
      übernommen (bzw. mit `--drop-texts` gelöscht), Grund-Seed samt Platzhalter-Rechtstexten und `RE`/`GS`-Zähler
      unverändert (AK-11-03, AK-SEED-14 Teil).
    - AK-11-01: Zweimal `pnpm seed` ergibt identische Anzahlen je Collection.
    - AK-11-02: Jedes Beispiel-Dokument hat `seed = true` und einen `seedKey`.
    - AK-SEED-06 (Teil): Jedes Mini-Stück mit `available`/`reserved` besteht `validateForPublish`; S18 scheitert genau
      an der Faserangabe, S25 genau an der englischen Bildbeschreibung.
    - Nach `seed:example` ist S27 `reserved`, seine Kasse `open`, genau eine Reservierung `active`.
    - AK-SEED-18: `home` hat `hero` + genau 7 Stationen `hallo`, `keramik`, `textil`, `zeichnungen`, `schmuck`,
      `tattoo`, `jutta-und-coco`.
    - Ein echtes Stück Nr. 17 bleibt bei `seed`/`seed:remove`/`seed:reset` unverändert (AK-SEED-15, Teil).
  - Tests:
    - int `tests/int/seed/example.int.spec.ts` (DM-P1-04, AK-11-01…03, AK-SEED-06, AK-SEED-14, AK-SEED-15,
      AK-SEED-18);
    - unit `tests/unit/seed/data.unit.spec.ts` (zod-Schemas, AK-SEED-12 Mail-Domains).
  - Ohne Jutta: Vollständiger Bestand in P8, höher aufgelöste Bilder aus dem Export (A04, A06).

- [x] **P1.31 Verwaltung am Handy: Formular-Test und keine Fremd-Requests** – Playwright-Konfiguration nach ARCHITEKTUR
  §7.3:
  - Projekte `desktop`, `iphone-15` (WebKit, 390×844; nur wenn die WebKit-Installation in der Cloud scheitert, mit
    `PW_SKIP_WEBKIT=1` als markierte Chromium-Emulation plus OFFENE-PUNKTE-Eintrag; CI immer WebKit), `pixel-7`;
  - `baseURL = E2E_BASE_URL`, `webServer` je `E2E_SERVER`;
  - `trace: 'retain-on-failure'`, `video: 'off'` (Videos nur im KUNST-QA-Lauf, P9);
  - `testIgnore` für `preview-export.e2e.spec.ts`.

  `tests/e2e/fixtures.ts`: Login-Fixture (Grund-Seed-Admin) und Stück-Fixtures im Bereich 980–999.
  - Akzeptanz:
    - DM-P1-07: Bei 375 px Breite zeigt das Formular „Stück“ je Kategorie genau die Pflichtangaben aus DATENMODELL
      §6.6.6 (inklusive der Felder nach R-043–R-048). Ein fehlendes Pflichtfeld verhindert „Online stellen“ mit
      deutscher Meldung.
    - Die Verwaltung (Login, Liste, Formular) macht keine Anfrage an fremde Hosts: kein Gravatar, kein Monaco-CDN
      (Request-Log).
    - Upload der GPS-Fixture über das Admin-Formular: Die ausgelieferten Größen haben kein EXIF (T-05, e2e-Teil).
    - Das Formular ist bei 390×844 ohne horizontales Scrollen bedienbar (AK-7-04, Teil).
  - Tests: e2e `tests/e2e/admin-product-form.e2e.spec.ts` (DM-P1-07, T-05, R-135), `admin-privacy.e2e.spec.ts` @smoke.
  - Ohne Jutta: Die eigenen Handy-Ansichten (KONZEPT §7.3 ff.) folgen in P5.

- [x] **P1.32 Typen, Import-Map, Enum-Quelle und Rechts-Nachverfolgbarkeit** –
  - `pnpm generate:types` und `pnpm generate:importmap` aktualisieren; `src/payload-types.ts` und `importMap.js` werden
    committet.
  - `check:static` prüft, dass beide nach dem Erzeugen unverändert sind.
  - DM-P1-05-Test: keine String-Literale von Enum-Werten in `src/collections/*`, `src/globals/*` außerhalb der Importe
    aus `src/lib/enums.ts`.
  - `tests/unit/legal/traceability.unit.spec.ts` (R-001) mit `LEGAL_TRACE_PHASE = 1`: Die Tabelle in
    `docs/recht/ANFORDERUNGEN.md` §3 wird geparst.
  - `tests/unit/legal/forbidden.unit.spec.ts` (RECHT §5, V-01–V-31): Scan über `src/**` und `content/**`, Allowlist mit
    Begründung (SEED-SPEC §2.1).
  - Akzeptanz:
    - DM-P1-06: `pnpm generate:types` erzeugt Typen ohne `any` für alle Collections; `pnpm typecheck` ist grün.
    - DM-P1-05 ist grün.
    - R-001: Alle IDs mit frühester Phase P1 (R-001, R-012, R-032, R-041–R-048, R-135, R-136) kommen in Testtiteln
      vor. Gegenprobe im Test mit einer fehlenden ID ergibt rot.
    - Der Verbotsmuster-Test ist grün (kein OS-Link, kein „inkl. MwSt.“ im Kleinunternehmer-Modus, keine vorbelegten
      Häkchen).
  - Tests:
    - unit `tests/unit/enums/single-source.unit.spec.ts` (DM-P1-05);
    - unit `traceability.unit.spec.ts` (R-001);
    - unit `forbidden.unit.spec.ts`.
  - Ohne Jutta: –

- [x] **P1.33 CI-Erweiterung und Repo-Pflege** – `.github/workflows/ci.yml`, Job `quick`, mit Schritten und Umgebung genau
  nach ARCHITEKTUR §6.3:
  1. Installation;
  2. Lint;
  3. Typen;
  4. `check:static`;
  5. `test:unit`;
  6. `payload migrate` + `check:migrations`;
  7. `test:int`;
  8. `seed` + `build`;
  9. `check:bundle` und `check:external --built`. In P1 wird `scripts/check-bundle.ts` als Gerüst angelegt, das nur
     die Gesamtgröße meldet; die Budgets folgen in P2.23.
  10. `test:e2e --grep @smoke --project=desktop --project=iphone-15` mit Playwright Chromium + WebKit, gecacht;
  11. `gitleaks detect` (gepinnte CLI);
  12. `pnpm audit --prod --audit-level=critical`. Gibt es für einen Fund keinen Fix innerhalb von Payload 3.x bzw.
      Next 16.3, gilt eine dokumentierte Ausnahme über `pnpm.auditConfig.ignoreCves` in `package.json` plus Zeile in
      `docs/OFFENE-PUNKTE.md` (CVE, Grund, wann erneut prüfen).

  Dazu:
  - Artefakt-Upload nur bei Fehler (`playwright-report/`, `test-results/`; 2 Tage). Vorher läuft der Budget-Schritt
    `pnpm ci:artifacts` (`scripts/ci/artifact-budget.ts`, ARCHITEKTUR §6.2, §6.10; Skript in `package.json`;
    `permissions: actions: read`): Er summiert `size_in_bytes` aller nicht abgelaufenen Artefakte des Repos
    (`gh api repos/{owner}/{repo}/actions/artifacts --paginate`), schreibt `upload_optional=true|false` nach
    `$GITHUB_OUTPUT` – ab 350 MB und bei einem API-Fehler `false` – und nennt den Grund im Job-Summary; er scheitert
    nie;
  - `concurrency`, minimale `permissions`, `timeout-minutes`;
  - Auslöser wie P1.1a: `pull_request` und `workflow_dispatch`, kein `push` (ARCHITEKTUR §6.2);
  - Skelett eines E2E-Jobs für `ci-full.yml`, das P2 füllt (Datei anlegen, nur `workflow_dispatch`).

  Weitere Dateien:
  - `.github/dependabot.yml`: bis P11 **nur Sicherheits-Updates** – Versions-Updates für `npm` und `github-actions`
    stehen auf `open-pull-requests-limit: 0`; Sicherheits-PRs kommen über die Repo-Einstellung „Dependabot security
    updates“ (ARCHITEKTUR §1.3). Kein Automerge vor P11: `dependabot-automerge.yml` entsteht erst in P11;
  - `.github/pull_request_template.md` (deutsche Checkliste: lokal geprüft, Tests, `pnpm check`, FORTSCHRITT,
    OFFENE-PUNKTE, ab P2 Vorschau-Artefakt).
  - Akzeptanz:
    - (CI-Nachweis) Der PR-Lauf ist grün, bleibt unter 20 min und nutzt DB `planetclaire_test`.
    - (CI-Nachweis) Ein Push mit `[skip ci]` startet keinen Workflow; ohne Kennung startet nur `ci.yml` (AK-A-6-01,
      Teil).
    - (CI-Nachweis) gitleaks findet nichts.
    - Der Upload-Schritt läuft nur bei Fehler und bei `upload_optional=true`, bewahrt 2 Tage auf und hat den
      Budget-Schritt davor; Playwright nimmt Traces nur bei Fehlern auf, kein Video (P1.31).
    - AK-A-6-02 (Budget-Teil): `pnpm ci:artifacts` meldet mit aufgezeichneten API-Antworten bei 349 MB
      `upload_optional=true`, bei 350 MB und bei einem API-Fehler `upload_optional=false` und endet immer mit Exit 0.
    - `ci.yml` hat keinen `push`-Auslöser; ein Merge auf `main` startet keinen Lauf.
    - `dependabot.yml` enthält keine Versions-Updates (`open-pull-requests-limit: 0`); es gibt keinen
      Automerge-Workflow.
    - AK-A-3-01: Build, Tests und E2E laufen mit `.env.example`-Standards ohne Zugangsdaten, und der Wächter meldet
      keine fremden Hosts.
  - Tests:
    - unit `tests/unit/ci/workflows.unit.spec.ts`: parst die YAMLs und prüft Pflichtschritte, Umgebung, Auslöser (kein
      `push`), `permissions`, Upload-Bedingung und Aufbewahrung, Budget-Schritt und `dependabot.yml`;
    - unit `tests/unit/ci/artifact-budget.unit.spec.ts` (AK-A-6-02, Budget-Teil; ohne Netz);
    - CI-Nachweis im Phasenende-Lauf `[ci:full p1]`.
  - Ohne Jutta: Jutta klickt nur „Merge“ (A07).

- [x] **P1.33a Minuten-Wächter für GitHub Actions** – `pnpm ci:minutes` (`scripts/ci/minutes.ts`, ARCHITEKTUR §6.8,
  §6.10; Skript in `package.json`) summiert die abrechenbaren Minuten des laufenden Kalendermonats (UTC): Läufe über
  `gh api repos/{owner}/{repo}/actions/runs` (Filter `created`, alle Seiten), je Lauf
  `gh api repos/{owner}/{repo}/actions/runs/<id>/timing`, Summe über `billable.UBUNTU.job_runs[].duration_ms`, je Job
  auf volle Minuten aufgerundet. Fehlt `billable` in der Antwort, rechnet es mit den Jobs des Laufs
  (`gh api repos/{owner}/{repo}/actions/runs/<id>/jobs`, `completed_at − started_at` je Job, ebenfalls aufgerundet).
  - Ausgabe `MINUTEN_MONAT=<n>` und `MINUTEN_STATUS=ok|knapp|erschoepft|unbekannt` (ab 1.500 Minuten `knapp`, ab
    2.000 `erschoepft`; scheitert die Abfrage – kein `gh`, kein Netz, fehlende Rechte –, `unbekannt` mit deutscher
    Meldung); Exit-Code immer 0. Die API-Aufrufe sind injizierbar, damit der Test ohne Netz läuft; das Skript ruft nur
    lesende Endpunkte auf.
  - Nutzung (Arbeitsregeln oben, ARCHITEKTUR §6.8): Die Session ruft den Wächter zu Beginn und vor jedem Push ohne
    `[skip ci]` auf und trägt den Stand in den PR-Text ein. `unbekannt` gilt wie `knapp` als „Grenze erreicht“: bis
    Monatsende nur noch Phasenende-Läufe, oben im PR-Text „CI-Minuten fast aufgebraucht – bis Monatsende nur
    Phasenende-Läufe“ (bei `unbekannt` mit dem Vermerk „Minuten-Stand nicht abrufbar“). Bei `erschoepft` startet CI
    nicht mehr: nicht mergen, lokal weiter prüfen, Eintrag in `docs/OFFENE-PUNKTE.md`; der Phasenende-Lauf folgt im
    nächsten Monat.
  - Akzeptanz:
    - Mit Fixture-Antworten (drei Läufe, einer davon aus dem Vormonat; Jobs mit 61 s und 59 s) zählt die Summe nur die
      Läufe dieses Monats, je Job aufgerundet (61 s → 2 min, 59 s → 1 min); eine Antwort ohne `billable` ergibt über
      die Job-Zeiten dieselbe Summe.
    - AK-A-6-03: Ab 1.500 Minuten lautet die Ausgabe `MINUTEN_STATUS=knapp`, ab 2.000 `erschoepft`; ein API-Fehler
      ergibt `MINUTEN_STATUS=unbekannt` mit deutscher Meldung; der Exit-Code ist in jedem Fall 0.
  - Tests: unit `tests/unit/ci/minutes.unit.spec.ts` (AK-A-6-03).
  - Ohne Jutta: –

### Phasen-Abnahme
- [x] Alle Aufgaben P1.1–P1.33 einschließlich P1.1a, P1.1b und P1.33a sind abgehakt.
- [x] Lokal grün: `pnpm check`, `pnpm test:int`, `pnpm test:e2e --grep @smoke`, `pnpm build`.
- [x] CI grün – erst nach dem grünen Lauf abhaken, in einem Doku-Commit mit `[skip ci]`: Der letzte Commit ohne
  `[skip ci]` trägt `[ci:full p1]` (W-31; ARCHITEKTUR §6.7); `CI / quick` ist auf dem PR grün. Damit sind die
  „(CI-Nachweis)“-Kriterien aus P1.1a und P1.33 belegt.
- [x] DM-P1-01 bis DM-P1-07 grün; ebenso T-05, T-14, T-15, T-17. Alle 27 Collections der P1 (DATENMODELL §10.1: alle
  29 außer `legal-snippets` und `complaints`) und 2 Globals existieren.
- [x] `LEGAL_TRACE_PHASE = 1` grün.
- [x] `pnpm check:migrations` grün; `src/payload-types.ts` und `importMap.js` aktuell.
- [x] Spikes B-01, B-02, B-09 sind in ARCHITEKTUR Anhang B mit „Ergebnis: …, Datum, PR“ eingetragen, bei Abweichung
  mit ADR in `docs/adr/`. Die ADR zu `server-only` in Skripten existiert.
- [x] `pnpm seed:reset` läuft auf frischer Test-DB ohne Fehler; danach enthält die Verwaltung unter `/werkstatt` den
  Mini-Bestand.
- [x] `docs/OFFENE-PUNKTE.md` enthält die W-Liste und die übernommenen Annahmen (C-xx, DM-xx, DA-x, KA-xx, SE-xx); die
  Prüfstellen aus P1.2 sind abgehakt; neue Owner-Punkte stehen in `docs/owner/AUFGABEN.md` unter der nächsten freien
  A-Nummer (falls nötig).
- [x] Eintrag in `docs/FORTSCHRITT.md`: was erledigt wurde und wie es getestet ist.
- [x] PR-Titel und -Text (Deutsch) aktualisiert, oben „Bitte mergen – CI ist grün“.
- [x] Keine echten Schlüssel oder Konten im Repo (gitleaks grün).
- [x] Ein Vorschau-Artefakt ist in P1 nicht nötig; Pflicht ab P2.

---

## P2 – Designsystem, Tuschelinie und Vorschau-Datei

**Ziel:** Die öffentliche Website bekommt ihr Gesicht und ihr Gerüst:
- Design-Tokens, selbst gehostete Schriften, Schneidematten-Raster;
- Seitenrahmen mit Kopfleiste, Menü und Fußbereich mit allen Pflichtlinks auf jeder Seite, inklusive „Vertrag
  widerrufen“ und Gerüstseiten R20–R27, damit kein Pflichtlink ins Leere führt;
- Sprachen DE/EN mit Routen-Registry;
- die Tuschelinie als framework-unabhängiges Modul (`mount`/`unmount`) in den Stufen A/B/C;
- ein Coco-Platzhalter-Sprite mit allen 22 IDs;
- die Startseite mit Beispielinhalten;
- reduzierte Bewegung, Sicherheits-Header, a11y-, Datenschutz- und Tempo-Gates, visuelle Referenzen.

Zum Abschluss erzeugt `pnpm preview:export` die Einzeldatei `dist/planet-claire-vorschau.html`. CI lädt sie als
Zwischenstand-Artefakt hoch, damit Jutta den Stand offline ansehen kann.
**Voraussetzungen:** P1 abgeschlossen; gemergt oder im Arbeitsbranch enthalten (Datenmodell, `pages:home`-Seed,
Grund-Seed mit Rechtstext-Platzhaltern, `ADMIN_ROUTE`-Umschreibung, CI `quick`); Playwright Chromium und WebKit
installiert (CLOUD-SETUP; Ausnahme siehe Arbeitsregeln).
**Referenzen:** E-40, E-42–E-44, E-60, E-62, E-63, E-70–E-80, E-93, E-96, E-98; R-001, R-002 (Banner vorgezogen),
R-010, R-011, R-090, R-130, R-131, R-136 (Header), R-191; KONZEPT §1.4 (EK-01, EK-04, EK-05, EK-07, EK-09, EK-11), §2.1–§2.6,
§3.0, §3.1, §3.13–§3.17, §12 (inkl. §12.9); DATENMODELL §6.12, §6.19, §7; ARCHITEKTUR §2.3, §6.2–§6.5, §7.3–§7.7, §8.1,
§8.4, §8.7, §9.1–§9.5, §14; DESIGN §3–§11, §12.6, §13; KUNST-QA §3.1; SEED-SPEC §13.1, §17.

### Aufgaben

- [x] **P2.1 i18n-Grundlage und Routen-Registry** – `next-intl` (≥ 4.14, exakt gepinnt).
  - Routen-Registry `src/lib/routes/registry.ts` (ARCHITEKTUR §2.3) mit R01–R31 – reine Daten ohne Framework-Importe
    und ohne Pfad-Aliasse. Felder je Eintrag: `id`, DE/EN-Muster (exakt KONZEPT §2.2), `pageType`
    (`PUBLIC_PAGE_TYPES`), `preset`, `rendering`, `robots`, `headerContext` (public/dynamic/checkout), `status`
    (`live`/`planned`), `phase`; dazu die Listen `shortLinks` (die sieben Kurz-URLs aus R-010) und `aliases` (feste
    EN-Varianten wie `/en/imprint`, `/en/impressum`). Interner Schlüssel = EN-Pfad = Ordnername unter `[locale]/`.
  - `src/i18n/routing.ts` erzeugt daraus `defineRouting({ locales: ['de','en'], defaultLocale: 'de', localePrefix:
    'always', localeCookie: false, localeDetection: true, pathnames })` (z. B. `/impressum` ↔ `/legal-notice`).
  - `src/i18n/request.ts`, `src/i18n/navigation.ts`.
  - Nachrichten `src/i18n/messages/{de,en}.json`, Namensräume `common`, `header`, `menu`, `footer`, `legal`, `errors`,
    `home`, `a11y`, `previewExport`.
  - In P2 `live`: R01, R20–R29 (R30 ist eine Weiterleitung).
  - Helfer `localizedPath(id, locale, params)`, `alternatePath(pathname, locale)`.
  - App-Ordner `src/app/(frontend)/[locale]/…` mit englischen Ordnernamen laut ARCHITEKTUR §2.1 (z. B.
    `legal-notice/`, `withdraw-from-contract/`); der P0-Platzhalter `page.tsx`/`styles.css` entfällt.
  - `check:static` bekommt `i18n-parity` und `route-registry`.
  - Akzeptanz:
    - T-06: `de.json`/`en.json` haben dieselben Schlüssel, keine leeren Werte und kein `lorem` (EK-09 Teil).
    - AK-2-01/T-07 (Registry-Teil): Alle R01–R31 aus KONZEPT §2.2 (Tabelle wird geparst) haben DE- und EN-Muster,
      Pfade sind eindeutig, kein Pfad beginnt mit `/admin` oder `ADMIN_ROUTE`.
    - `alternatePath('/de/impressum','en') = '/en/legal-notice'`.
  - Tests: unit `tests/unit/i18n/parity.unit.spec.ts` (T-06), `tests/unit/routes/registry.unit.spec.ts` (T-07, AK-2-01).
  - Ohne Jutta: EN-Texte als Entwürfe (E-62); Jutta korrigiert später.

- [x] **P2.2 Proxy, Sprachumleitung und Weiterleitungen** – `src/proxy.ts` verbindet die Admin-Umschreibung (P1.12) mit
  der next-intl-Middleware.
  - Reihenfolge und Codes laut ARCHITEKTUR §2.3:
    - die sieben Kurz-URLs aus `shortLinks` (R-010) → 308 auf die kanonische DE-Route aus KONZEPT §2.2, statisch in
      `next.config.ts` `redirects()` (`permanent: true`), ohne Spracherkennung;
    - Pfad der anderen Sprache unter einem Sprachpräfix (z. B. `/en/vertrag-widerrufen`) und die `aliases`
      (`/en/imprint`, `/en/impressum` → `/en/legal-notice`) → 308, im Proxy aus der Registry;
    - `/` und übrige unpräfixierte Pfade → 307 nach `Accept-Language` in die erkannte Sprache, ohne Cookie (R30,
      KONZEPT §2.4, AK-2-02).
  - Abschließender Schrägstrich → 308 ohne.
  - Host `www.` → 308 auf den Apex-Host aus `NEXT_PUBLIC_SITE_URL`.
  - Nie `Set-Cookie`.
  - `pickLocale(acceptLanguage)` als reine Funktion.
  - Akzeptanz:
    - AK-2-02: `GET /` mit `Accept-Language: en-US,en;q=0.9` → 307 `/en`, ohne Header → 307 `/de`, kein
      `Set-Cookie`.
    - R-010, AK-A-2-04: Jede Kurz-URL liefert 308 auf die kanonische DE-Route, ohne `Set-Cookie`;
      `GET /en/vertrag-widerrufen` → 308 `/en/withdraw-from-contract`.
    - `/de/` → 308 `/de`.
    - `/admin` bleibt 404; `/werkstatt` bleibt Login.
  - Tests: unit `tests/unit/i18n/pick-locale.unit.spec.ts`; e2e `tests/e2e/routing.e2e.spec.ts` @smoke (AK-2-02,
    R-010, AK-A-2-04, AK-A-8-02).
  - Ohne Jutta: –

- [x] **P2.3 Design-Tokens, globale Styles, Raster und Lint-Tests** – `src/styles/tokens.css` wörtlich aus DESIGN §7.
  `src/styles/global.css`:
  - Reset;
  - Typografie §4.2/§4.3;
  - Links §3.2;
  - Fokus-Ring;
  - Abstände §5.1, Breiten §5.2, Rinne §5.3, Ebenen (z-index-Tokens) §5.5, Sticky-Regeln §5.6;
  - Schneidematten-Raster §3.4;
  - `color-scheme: only light` §3.3;
  - `@media (prefers-reduced-motion)` und `html[data-motion="reduced"]`.

  Ruheseiten (R06, R07, R09, R26, R21–R25, R27) bekommen **keine** eigene Routengruppe: Sie liegen in ihren englischen
  Routenordnern laut ARCHITEKTUR §2.1, der Ruhe-Modus kommt über Preset und Layout-Props (DESIGN §9.7, AK-DS-16).
  - Akzeptanz:
    - AK-DS-01: Jedes für Text freigegebene Token hat gegen Papier, Papier-2 und Raster `#E2E3D8` einen Kontrast
      ≥ 4,50.
    - AK-DS-02: Kein `color: var(--fox)` außerhalb `SoldStamp`/`CartLine`; kein `color` mit `--pink|--clay|--coco-*|
      --wash-*`; kein `#FFF`/`white` als Textfarbe.
    - AK-DS-06: Kein `box-shadow`/`text-shadow`/`drop-shadow` mit Unschärfe ≠ 0.
    - AK-DS-16: Kein `ease`/`ease-in`/`ease-out`/`ease-in-out`; keine `@keyframes` auf `width/height/top/left/margin/
      box-shadow`; keine `transition` in den Stylesheets der Ruheseiten-Ordner und unter `src/components/checkout/`.
  - Tests: unit `tests/unit/design/{contrast,lint-colors,lint-shadows,lint-motion}.unit.spec.ts` (AK-DS-01, -02, -06,
    -16).
  - Ohne Jutta: –

- [x] **P2.4 Selbst gehostete Schriften** – Pakete `@fontsource/mansalva`, `@fontsource-variable/bricolage-grotesque`,
  `@fontsource/ibm-plex-mono` als Dev-Abhängigkeiten (E-79).
  - `pnpm fonts:copy` (`scripts/fonts/copy.ts`) kopiert genau 3 `.woff2` nach `src/styles/fonts/` (Schnitte und
    Subsets laut DESIGN §4.1, Plex Mono nur 400, Annahme DA-3). Liegt Bricolage (variabel, Achse `wght`) über 45 KB,
    beschneidet das Skript die Datei auf `wght` 400–700 und das Subset „latin“ mit dem npm-Paket `subset-font`
    (harfbuzz-wasm, exakt gepinnte Dev-Abhängigkeit, in ARCHITEKTUR §1.2 eintragen) – ohne Python, kein
    `pyftsubset`/fonttools (DESIGN §4.1). Das Skript läuft ohne Netz und deterministisch.
  - Einbindung über `next/font/local` in `src/styles/fonts.ts` mit Fallback-Metriken.
  - Komponente `GlyphFallback` für fehlende Mansalva-Glyphen (DESIGN §4.4).
  - `fontkit` bzw. `opentype.js` als Dev-Abhängigkeit für den Test.
  - Akzeptanz:
    - AK-DS-04: Nach dem Build sind genau 3 `.woff2` ausgeliefert, zusammen ≤ 100 KB. Auf keiner Route gibt es eine
      Anfrage an `fonts.googleapis.com`/`fonts.gstatic.com` (R-131).
    - AK-DS-05: Die Glyphen-Pflichtliste ist gegen die Mansalva-Datei geprüft; `GlyphFallback` ist genau für fehlende
      Zeichen aktiv (Snapshot „38,50 €“).
    - Zwei `pnpm fonts:copy`-Läufe ergeben byte-gleiche Dateien; eine beschnittene Bricolage-Datei deckt `wght` 400–700
      und die Glyphen-Pflichtliste ab.
  - Tests: unit `tests/unit/design/glyphs.unit.spec.ts` (AK-DS-05), `tests/unit/fonts/copy.unit.spec.ts`
    (Determinismus, Achsenbereich nach dem Beschneiden); Build-Prüfung in `check:bundle` (AK-DS-04); e2e Request-Log in
    P2.21.
  - Ohne Jutta: Keine eigene Handschrift-Font („Später“).

- [x] **P2.5 Icons, Wortmarke, Planet-Marke, Favicon, Standard-OG** – Icons nach DESIGN §6.5: Quellen
  `src/art/icons/*.svg` (je ≤ 600 B), eingebunden als Inline-SVG-React-Komponenten in `src/components/icons/`
  (Komponente `Icon`, kein Sprite, kein `<use href>`); Bestand genau laut §6.5: `basket`, `menu`, `close`,
  `arrow-right`, `arrow-left`, `external`, `mail`, `instagram`, `copy`, `zoom`, `check`, `warn`, `info`, `planet`,
  `star`, `truck`, `pickup`, `withdraw`. Außerdem:
  - Wortmarke „planet claire“ `public/art/wordmark.svg` (≤ 5 KB) und Planet-Marke (DESIGN §12.6), Quellen unter
    `src/art/`;
  - `src/app/icon.svg`, `favicon.ico`, `apple-icon.png` (180 px) nach den Next.js-Dateikonventionen (ARCHITEKTUR §2.1;
    Inhalt laut DESIGN §12.6: Planet auf Papier-Kreis);
  - Admin-Logo/-Icon als `admin.components.graphics`;
  - Standard-OG-Bild `public/og/default.png` (1200×630), erzeugt von `scripts/art/build-brand.ts` (`sharp`, im Repo
    gespeichert).
  - Akzeptanz:
    - Jedes Icon ≤ 600 B und `aria-hidden`, außer mit Label.
    - Der Wortmarken-Link hat den zugänglichen Namen „planet claire – Startseite“.
    - Favicon und OG-Bild kommen vom eigenen Origin (200).
    - `pnpm build` ist grün.
  - Tests: unit `tests/unit/design/icons.unit.spec.ts`; e2e-Teil in P2.21.
  - Ohne Jutta: Marken sind vorläufig vektorisiert; P9 verfeinert (E-76).

- [x] **P2.6 Verhaltensmodule: `mount`/`unmount`-Architektur** – KONZEPT §12.9, ARCHITEKTUR §14.6, DESIGN §9.12.
  - `src/behaviors/types.ts`: `mount(root: Element, ctx?: { mode: 'app' | 'preview' }) → unmount`.
  - `src/behaviors/index.ts`: Register `name → modul`; Dateiname kebab-case = Wert von `data-behavior` (Tabelle DESIGN
    §9.12).
  - `src/components/BehaviorHost.tsx`: Client-Komponente, lädt nur die benötigten Module per `import()`, bindet alle
    `[data-behavior]` in Kopf, Inhalt und Fuß und löst sie bei Routenwechsel und Unmount wieder.
  - Module dürfen `react`, `next` und `payload` nicht importieren.
  - Das erste Modul ist `src/behaviors/cart-count.ts` (`data-behavior="cart-count"`). Es liest die Korb-Anzahl nur,
    wenn `pc_cart` existiert, setzt nichts, und macht MI-07.
  - Akzeptanz:
    - AK-A-15-02: Jede Datei unter `src/behaviors/` exportiert `mount` mit Rückgabe `unmount` und ist registriert.
    - AK-A-2-03: `src/behaviors`, `src/leash` und `src/preview-runtime` enthalten keine Importe von `react`, `next` oder
      `payload`.
    - AK-DS-18: Je Modul entfernt `mount()` → `unmount()` alle eigenen Listener, Observer, Timer und Animationen; ein
      zweites `mount()` auf neuem DOM funktioniert; im Modus `preview` kein `fetch`/`XMLHttpRequest` und kein Zugriff auf
      `document.cookie`, `localStorage` oder `sessionStorage`.
  - Tests: unit `tests/unit/behaviors/contract.unit.spec.ts` (AK-A-15-02, AK-A-2-03, AK-DS-18), `cart-count.unit.spec.ts`
    (jsdom).
  - Ohne Jutta: –

- [x] **P2.7 Grundbausteine KO-11, KO-12, KO-17, KO-22** – `src/components/ui/`:
  - `Button` mit den Varianten aus KO-11 (Primär, Sekundär mit MI-06-Unterstreichung, Link), Höhe ≥ 48 px;
  - `Field`, `Checkbox`, `Radio`, `Select` in der Basis von KO-12 (Label, Hilfe, Fehler, `aria-describedby`, nie
    vorbelegte Häkchen);
  - `EmptyState` (KO-17-Rahmen mit Coco-Platz);
  - `Callout` (KO-22: `info`/`warn`/`deviation`);
  - `PlaceholderBanner` (R-002: „PLATZHALTER – nicht rechtsverbindlich“ / „PLACEHOLDER – not legally binding“).
  - Akzeptanz:
    - `Checkbox` rendert nie `checked` ohne ausdrücklichen Wert (Verbotsmuster „vorbelegte Häkchen“).
    - Jedes Feld hat ein verknüpftes Label.
    - Die Knöpfe sind ≥ 44×44 px.
    - `PlaceholderBanner` ist ohne JS sichtbar.
  - Tests: unit `tests/unit/components/ui.unit.spec.tsx` (jsdom, Testing Library); a11y-Teil in P2.22.
  - Ohne Jutta: –

- [x] **P2.8 Seitenrahmen, Kopfleiste, Vorschau-Banner** – `src/app/(frontend)/[locale]/layout.tsx` setzt `<html lang>`
  aus der Route, `<body data-preset>` aus der Registry und `<html data-motion>` über ein Inline-Skript im `<head>`
  (DESIGN §11.7; der Hash wird für die CSP in `src/lib/security/inlineScripts.ts` hinterlegt).
  - `AppShell` (KO-01): Skip-Link „Zum Inhalt springen“ / „Skip to content“ → `SiteHeader` → Vorschau-Banner → `<main
    id="inhalt">` → `SiteFooter`. Die Linien-Ebene ist ein Geschwister von `<main>`.
  - `SiteHeader` (KO-02):
    - Wortmarke;
    - Links Shop und Tattoo (Ziele R02/R11, in P2 `planned`);
    - Korb mit reservierter Zahl (`data-behavior="cart-count"`);
    - Menü-Knopf mit `aria-expanded`/`aria-controls`/`aria-haspopup`;
    - unter 375 px nur die Planet-Marke;
    - Unterkante als Hand-Linie in 3 Varianten nach Routen-Seed.
  - Vorschau-Banner (KONZEPT §3.0.4): nur bei `SEED_PREVIEW_MODE=true` und `APP_ENV≠production`, „Vorschau mit
    Beispieldaten“; im Export zusätzlich „Phase P<n>“.
  - Akzeptanz:
    - AK-DS-07: Bei 320, 360, 390 und 1440 px kein Überlauf (`scrollWidth ≤ clientWidth`); Shop, Tattoo, Korb und Menü
      sind sichtbar und ≥ 44×44 px. Die Korb-Anzahl ändert die Breite nicht (Cookie-Fixture `pc_cart` mit 2 IDs im
      Test).
    - Der Skip-Link ist das erste fokussierbare Element.
    - Der Banner ist bei `SEED_PREVIEW_MODE=false` nicht vorhanden.
  - Tests: e2e `tests/e2e/shell.e2e.spec.ts` @smoke (AK-DS-07).
  - Ohne Jutta: –

- [x] **P2.9 Menü (KO-03) als Verhaltensmodul** – `src/components/MenuOverlay.tsx` rendert serverseitig
  `<dialog id="menu" aria-label="Menü">` mit der Hauptliste aus KONZEPT §3.0.2 (Start · Shop · Archiv ·
  Auftragsarbeiten · Tattoo · Über mich & Coco · Kontakt):
  - Kategorien aus `categories` (`getPublicPayload`, `showInNavigation`);
  - Tattoo-Unterseiten aus der Registry;
  - unten Sprachumschalter, Instagram und die Pflichtlinks klein, inklusive „Vertrag widerrufen“.

  `src/behaviors/menu.ts`:
  - `showModal()`, Fokus auf den ersten Link, Tab-Falle durch den Dialog, `Esc`/„Schließen“ mit Fokus zurück;
  - `html { overflow: hidden; scrollbar-gutter: stable }`;
  - MI-05 (clip-path per WAAPI, gestaffelte Links);
  - ein Linkklick schließt sofort.

  `LinkUnderline` (drei Pfade, Wahl per Hash des `href`, MI-06). Ohne JS ist der Menü-Knopf ein Link `#fussnavigation`.
  - Akzeptanz:
    - AK-DS-08: Enter/Leertaste öffnet, der Fokus liegt auf dem ersten Link, Tab bleibt im Dialog, `Esc` schließt, der
      Fokus kehrt zu „Menü“ zurück. Mit `reducedMotion: 'reduce'` ist der Endzustand nach ≤ 1 Frame erreicht.
    - Mit `javaScriptEnabled: false` führt „Menü“ zu `#fussnavigation`.
  - Tests: e2e `tests/e2e/menu.e2e.spec.ts` @smoke (AK-DS-08).
  - Ohne Jutta: –

- [x] **P2.10 Fußbereich mit Pflichtlinks, Sprachumschalter, Animationen-Schalter** – `src/components/SiteFooter.tsx`
  (KO-04) in DOM-Reihenfolge:
  1. „Vertrag widerrufen“ / „Withdraw from contract here“ (R-090, Konstante aus `src/lib/legal/constants.ts`)
     als hervorgehobener Knopf-Link → R26;
  2. Unterkomponente `LegalFooter` (Pflichtlink-Block, R-011): Impressum, Datenschutz, AGB, Widerrufsbelehrung,
     Versand & Zahlung, Kontakt; Konformitätserklärungen nur, wenn es mindestens eine aktive Erklärung gibt (R27 selbst
     bleibt erreichbar, KONZEPT §3.0.3);
  3. `<nav id="fussnavigation">` mit der Menüliste (Ersatz für das Menü ohne JavaScript) und dem Instagram-Link
     (einfacher Link, kein Embed);
  4. `LanguageSwitcher` (`alternatePath`, bei dynamischen Routen ohne Gegenstück die Startseite der anderen Sprache;
     `hreflang`/`lang`);
  5. Schalter „Animationen: an/aus“ (`src/behaviors/motion-toggle.ts`, `data-behavior="motion-toggle"`, DESIGN §11.7):
     - `aria-pressed`;
     - Standard aus der Systemeinstellung, dann Label „aus (Systemeinstellung)“;
     - `localStorage` `pc-motion` nur nach Klick, in `try/catch`;
     - im Modus `preview` nur im Speicher;
  6. Platz für die Preis-Fußnote (ab P3);
  7. „© {Berliner Jahr} Planet Claire · Berlin“.

  Der Fußbereich steht auch in `not-found.tsx`/`error.tsx`. Dekor-Ebenen haben `pointer-events: none` und einen
  niedrigeren z-index.
  - Akzeptanz:
    - R-011: Auf jedem `live`-Seitentyp gibt es bei 390×844 und 1440×900, mit `reduce` und `no-preference`, 6 Links
      mit korrektem `href`. Sie sind `toBeVisible()`, und `elementFromPoint` in der Linkmitte liefert den Link (nach
      Scroll ans Ende).
    - R-090/AK-3-11: „Vertrag widerrufen“ steht auf jeder öffentlichen Route einschließlich 404 und 500 im DOM und ist
      sichtbar.
    - AK-DS-09: Die Höhe ist ≥ 44 px, und `elementFromPoint` liefert den Link.
    - Vor dem Klick auf den Schalter ist der Storage leer; danach ist `pc-motion` gesetzt und `html[data-motion=
      "reduced"]`, auch nach Neuladen.
    - Der Sprachumschalter führt von `/de/impressum` nach `/en/legal-notice`.
  - Tests: e2e `tests/e2e/footer.e2e.spec.ts` @smoke (R-011, R-090, AK-3-11, AK-DS-09); `motion-toggle.e2e.spec.ts`;
    unit `tests/unit/legal/footer-links.unit.spec.ts` (R-090: Konstanten DE/EN).
  - Ohne Jutta: –

- [x] **P2.11 SEO-Grundlagen** – `src/lib/seo/metadata.ts` → `buildMetadata(routeId, locale, params)`:
  - Titel „{Seite} · Planet Claire“, Beschreibung aus den Nachrichten;
  - canonical und drei hreflang-Links (`de`, `en`, `x-default`) mit absoluten Apex-URLs aus `NEXT_PUBLIC_SITE_URL`;
  - `robots` aus der Registry.

  Weitere Teile:
  - Organization-JSON-LD auf R01 (Name, URL, Logo, `sameAs` Instagram, ohne Adresse, E-50);
  - `src/app/robots.ts`: Produktion `Allow` + Sitemap, sonst `Disallow: /`, nie `ADMIN_ROUTE`;
  - `src/app/sitemap.ts`: `live`, indexierbar, beide Sprachen mit Alternates;
  - Header `X-Robots-Tag: noindex, nofollow` außerhalb der Produktion.
  - Akzeptanz:
    - AK-2-05: Jede indexierbare `live`-Seite hat canonical und drei hreflang-Links mit absoluten URLs.
    - AK-2-04/T-07: Der Admin-Pfad steht weder in `robots.txt` noch in `sitemap.xml` noch im öffentlichen HTML.
    - AK-A-4-03: Mit `APP_ENV=staging` tragen alle Antworten `X-Robots-Tag: noindex, nofollow`, und `robots.txt`
      enthält `Disallow: /`.
    - R26 hat `noindex, follow`.
  - Tests: unit `tests/unit/seo/metadata.unit.spec.ts`; e2e `tests/e2e/seo.e2e.spec.ts` (AK-2-04, AK-2-05, AK-A-4-03,
    T-07).
  - Ohne Jutta: –

- [x] **P2.12 Sicherheits-Header und CSP (Spike B-03)** – `src/lib/security/headers.ts` und `src/lib/security/csp.ts`
  (Host-Listen je Kontext) mit den Kontexten `public`, `dynamic`, `checkout`, `admin`, `api` genau nach ARCHITEKTUR
  §8.1.
  - Anwendung: statische Routen über `next.config.ts headers()`, Nonce-Kontexte (`dynamic`, `checkout`, `admin`) über
    `src/proxy.ts`. R26 gehört zum Kontext `dynamic`.
  - Header für alle Antworten laut §8.1: `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` (Token-Seiten
    `no-referrer`), `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`, HSTS nur in
    `production`/`staging`, `X-Robots-Tag: noindex, nofollow` außerhalb von `production`. CSP-Kern je Kontext laut
    Tabelle §8.1 (u. a. `default-src 'self'`, `img-src 'self' data: blob:`, `font-src 'self'`, `connect-src 'self'`,
    `frame-ancestors 'none'`, `form-action 'self'`, `base-uri 'self'`, `object-src 'none'`).
  - `checkout` ergänzt die Stripe-Hosts aus der DIENSTE-YAML nur bei `PAYMENTS_DRIVER=stripe`.
  - Das Inline-Skript `pc-motion` aus P2.8 steht als Konstante in `src/lib/security/inlineScripts.ts`; `csp.ts`
    berechnet daraus den `sha256`-Hash für `script-src` im Kontext `public`, in `dynamic`/`checkout` trägt es die Nonce.
  - Spike B-03: `script-src` ohne `'unsafe-inline'` auf statischen Seiten (`experimental.sri`, Next-Inline-Daten)?
    Ergebnis in ARCHITEKTUR Anhang B plus ADR `docs/adr/0002-csp-script-src.md`; die Rückfallebene laut Anhang B wird
    ohne Rückfrage umgesetzt.
  - Kontext `admin`: Soll ist die Nonce; läuft die Verwaltung damit nicht (CSP-Teil von Spike B-01, P1.12), gilt der
    Rückfall `script-src 'self' 'unsafe-inline'` nur im Kontext `admin`, ohne fremde Hosts, per ADR (R-131).
  - Akzeptanz:
    - AK-A-8-01/T-16: Jede Antwort einer `live`-Registry-Route trägt die Header ihres Kontexts.
    - Alle CSP-Hosts sind eine Teilmenge der DIENSTE-YAML (`docs/recht/DIENSTE.md`) für den Kontext (R-131).
    - Auf keiner `live`-Route gibt es einen CSP-Verstoß (`securitypolicyviolation`/Konsole).
    - `/api/health` trägt den Kontext `api` (R-136).
    - Der Hash in der CSP passt zum Skripttext in `inlineScripts.ts`.
    - Login, Liste und Bearbeiten unter `ADMIN_ROUTE` laufen ohne CSP-Verstoß; Spike B-01 ist damit auch im CSP-Teil
      in ARCHITEKTUR Anhang B eingetragen (bei Rückfall mit ADR).
  - Tests: unit `tests/unit/security/headers.unit.spec.ts` (T-16, R-131, Hash-Abgleich); e2e
    `tests/e2e/security-headers.e2e.spec.ts` (AK-A-8-01, R-136).
  - Ohne Jutta: –

- [x] **P2.13 Rechtsseiten-Gerüste R21–R25, R27** – Seiten in `src/app/(frontend)/[locale]/` mit den englischen
  Ordnernamen laut ARCHITEKTUR §2.1: `legal-notice/`, `privacy/`, `terms/`, `right-of-withdrawal/`,
  `shipping-and-payment/`, `declarations-of-conformity/` (DE-Pfade `/de/impressum` usw. aus der Registry); keine
  Routengruppe.
  - Serverseitig gerendert aus `getActiveLegalText(type, jetzt)` (P1.22), Tokens laut R-012 ersetzt (P1.22), Lexical-
    Rich-Text als HTML, genau eine `h1`.
  - `PlaceholderBanner` bei `origin ≠ lawyer` (R-002 vorgezogen).
  - R25 zeigt vorerst nur den Text-Platzhalter; die Tariftabelle folgt in P4.
  - R27 listet aktive Erklärungen, sonst einen neutralen Text; die Seite bleibt erreichbar (KONZEPT §3.14).
  - Preset `legal` (statische Randlinie ab P2.17), keine Animation.
  - Bei fehlender Fassung erscheint ein neutraler Leerzustand statt 500.
  - Akzeptanz:
    - R-010: Jede Seite liefert in DE und EN 200 und genau eine `h1`. Mit `javaScriptEnabled: false` ist der
      Textkörper sichtbar.
    - Im HTML steht kein `{{`.
    - Mit Platzhalterdaten zeigt jede Rechtsseite den Banner (R-002).
    - AK-DS-11: `document.getAnimations()` ist 1000 ms nach `load` leer; `transition-duration` in `<main>` ist `0s`.
  - Tests: e2e `tests/e2e/legal-pages.e2e.spec.ts` @smoke (R-010, R-002, AK-DS-11).
  - Ohne Jutta: Kanzlei-Texte folgen in P11 (A08, A28); bis dahin Platzhalter, nicht live schalten.

- [x] **P2.14 Kontakt R20 und „Vertrag widerrufen“-Gerüst R26** –
  - R20 (`/de/kontakt`, `/en/contact`, Ordner `contact/`), Preset `margin`: Inhalt aus `pages:contact` (Seed P1.30),
    sonst ein neutraler Leerzustand (DM-PAGE-01). E-Mail-Adresse und Instagram-Link kommen aus `getPublicSettings()`;
    kein Formular (E-51).
  - R26 (`/de/vertrag-widerrufen`, `/en/withdraw-from-contract`, Ordner `withdraw-from-contract/`), Preset `calm`,
    Header-Kontext `dynamic`, `noindex, follow`: `h1` „Vertrag widerrufen“, Hinweis-Kasten „In dieser Vorschau noch
    ohne Funktion – kommt in P6“, Link zur Widerrufsbelehrung und E-Mail-Adresse als Alternative. Das zweistufige
    Formular folgt in P6 (R-091 ff.).
  - Akzeptanz:
    - Beide Seiten liefern in DE und EN 200 mit einer `h1`.
    - R26 trägt `noindex, follow`.
    - AK-DS-11 gilt auf R26.
    - DM-PAGE-01: Fehlt `pages:contact`, rendert R20 den Leerzustand statt 500.
    - Die Fußlinks aller Seiten führen nie auf 404. Die Linkprüfung umfasst die 6 Pflichtlinks aus R-011 plus Kontakt
      in DE und EN.
  - Tests: e2e `tests/e2e/contact-withdraw.e2e.spec.ts` @smoke (DM-PAGE-01, R-090, R-010).
  - Ohne Jutta: –

- [x] **P2.15 Tuschelinie-Kern (rein, ohne DOM)** – `src/leash/types.ts` wörtlich aus DESIGN §9.1, dazu:
  - `random.ts` (`fnv1a32`, `mulberry32`, `valueNoise1D`);
  - `presets.ts`: die ganze Tabelle §9.7 als Daten für alle 11 Presets;
  - `geometry.ts` → `buildGeometry(input)` mit den Schritten 1–11 aus §9.3, allen Schlaufenformen aus §9.5 inklusive
    Freiraum-Regeln und der `scrollMap` aus §9.6;
  - `poses.ts` mit `COCO_POSE_TO_SPRITE` (DESIGN §9.1/§10.3: CMS-Werte `COCO_POSES` aus DATENMODELL §4 → Sprite-IDs;
    `run → rennen`, `sniff → schnueffeln`, `sit → sitzen`, `sleep → schlafen`, `jump → springen`,
    `head_tilt → kopfschief`); `CocoPose` nur als Typ aus `src/lib/enums.ts`.

  `src/leash/` bleibt framework-frei (keine Importe von `react`, `next/*`, `payload`); React-Hüllen liegen in
  `src/components/leash/` (DESIGN §9.1).
  - Akzeptanz:
    - AK-DS-12: `buildGeometry` ist deterministisch (gleicher Hash von `outlineD`); `scrollMap` ist in beiden Spalten
      streng monoton; `lut` ist nach `len` sortiert mit Abstand 4 ± 0,01; jede Station hat `loopLen0 < loopLen1`;
      Breiten liegen in `[0,8; 1,35] × baseWidth`.
    - Rinnen-Schlaufen bleiben in der Rinne (Radius + halbe Linienbreite + 2 ≤ halbe Rinnenbreite).
    - `COCO_POSE_TO_SPRITE` deckt alle `COCO_POSES` ab.
    - Median-Laufzeit `journey`-Fixture ≤ 8 ms in Node (nur Bericht).
  - Tests: unit `tests/unit/leash/{random,geometry,loops,poses}.unit.spec.ts` (AK-DS-12).
  - Ohne Jutta: –

- [x] **P2.16 Tuschelinie-Laufzeit (Stufen A/B, Scroll-Kopplung)** –
  - `src/leash/measure.ts`: eine Lesephase.
  - `src/leash/runtime.ts` → `mountLeash(root, options): LeashHandle { destroy, rebuild, setMotion }`:
    - Stufenwahl A/B (Abstufung A → B nur im Speicher);
    - SVG-Aufbau in einer Schreibphase;
    - Segment-Zustände;
    - Lesezeile `scrollY + 0,72 · innerHeight`, `drawnLen` monoton, Coco-Glättung;
    - Neuaufbau über `ResizeObserver`, `fonts.ready` und `load`, entprellt 150 ms; Höhenänderungen < 120 px
      ignoriert;
    - IntersectionObserver-Pause;
    - `journey`-Intro (MI-10);
    - Leinen-Anschluss an der Kopfleiste (§9.8).
  - `src/leash/motion.ts`: `getMotion(): 'full' | 'reduced'` und `onMotionChange(cb)` aus `prefers-reduced-motion` +
    `html[data-motion]` – gemeinsam für Engine und `src/behaviors/*` (DESIGN §9.1, §9.11).
  - Die Linie ist kein Verhaltensmodul: `LeashLayer` und die Vorschau-Laufzeit rufen `mountLeash`/`destroy` direkt
    auf (DESIGN §9.12).
  - React-Hüllen in `src/components/leash/`: `LeashLayer.tsx` importiert die Runtime nach LCP + 300 ms, spätestens
    `load` + 1200 ms, per `requestIdleCallback`. `Station.tsx` rendert `data-leash-station`-Anker.
  - Spike View Transitions (§9.8) mit ADR `docs/adr/0003-view-transitions.md`. `@view-transition` nur innerhalb von
    `prefers-reduced-motion: no-preference`; keine Übergänge von und zu `calm`.
  - Akzeptanz:
    - AK-DS-13 (Chromium 390×844, R01): Die Linien-Ebene ist `aria-hidden` ohne fokussierbare Nachfahren. Nach Scroll
      zur Seitenmitte liegt `drawnLen / totalLength` in [0,35; 0,75]. Nach 400 px Hochscrollen ist `drawnLen`
      unverändert.
    - AK-DS-15: Resize 390 → 768 → 390 baut neu auf, ohne Konsolenfehler und mit CLS-Einträgen = 0.
    - Die Runtime ist nicht im Erstlade-Bundle (Chunk-Analyse).
  - Tests: e2e `tests/e2e/leash.e2e.spec.ts` (AK-DS-13, AK-DS-15) über `window.__leash`; unit
    `tests/unit/leash/runtime.unit.spec.ts` (jsdom, AK-DS-18 für `mountLeash`: `destroy` räumt alles),
    `tests/unit/leash/motion.unit.spec.ts`.
  - Ohne Jutta: –

- [x] **P2.17 Reduzierte Bewegung, statischer Renderer, Debug-Schnittstelle** –
  - `src/leash/static.ts`: Stufe C, ≤ 4 KB gz. Wird geladen auf `legal`/`calm`-Seiten und bei reduzierter Bewegung,
    auf R21–R25, R27 eingeschaltet.
  - `setMotion` reagiert auf `matchMedia`-Änderungen und den Schalter: Linie sofort vollständig, kein Intro, Coco
    Frame A der Ruhe-Pose (§10.6), kein Boil, keine Mikro-Interaktionen, `scroll-behavior: auto` (§9.11).
  - Debug nur bei `NEXT_PUBLIC_LEASH_DEBUG=1` zur Build-Zeit:
    - `window.__leash` (`geometry`, `drawnLen()`, `cocoLen()`, `tier()`, `pose()`, `rebuildCount()`,
      `setReadingY(y)`);
    - `window.__qa` im P2-Umfang laut KUNST-QA §3.1.
  - `pnpm check:no-debug` (`scripts/check-no-debug.ts`): Build ohne Flag, dann kommen `__leash`/`__qa` in
    `.next/static` und im HTML nicht vor.
  - Akzeptanz:
    - AK-DS-14: Mit `reducedMotion: 'reduce'` ist nach `load` + 1500 ms `drawnLen === totalLength`, es gibt keine
      `mask`-Attribute und 0 laufende Animationen.
    - AK-DS-03 (P2-Umfang R01, R21): Screenshots mit `colorScheme` `dark` und `light` bei `reduce` sind pixelgleich.
      Produktseite und Kasse ergänzen P3/P4.
    - Auf Rechtsseiten wird der Engine-Chunk nicht geladen (Request-Log).
    - `check:no-debug` ist grün.
  - Tests: e2e `tests/e2e/reduced-motion.e2e.spec.ts` (AK-DS-14, AK-DS-03); `pnpm check:no-debug` lokal (in CI läuft
    es im Job `quality`, P2.28).
  - Ohne Jutta: –

- [x] **P2.18 Coco-Platzhalter-Sprite und Coco-Steuerung** –
  - `src/art/coco/coco-sprite.svg` mit allen 22 Symbolen: `coco-{rennen|schnueffeln|sitzen|schlafen|springen|
    kopfschief}-{a|b|c}` und `coco-bridge-{bremsen|abspringen|einrollen-1|einrollen-2}` (DESIGN §10.4).
    - `viewBox 0 0 160 120`;
    - `data-anchor-x/y` (± 2 je Pose), `data-ground-y`;
    - Ebenen `.fur`/`.harness`/`.line`/`.solid`/`.hi`;
    - `data-part`-Gruppen;
    - nur `<path>`, keine Primitive;
    - vorläufige Zeichnungen auf Basis von `coco-run` der Konzeptseite in `docs/konzept/`.
  - `scripts/art/build-sprite.ts` (`pnpm art:sprite`, `svgo`) erzeugt `public/art/coco-sprite.v1.svg` und
    `src/art/coco/coco-sprite.json` (IDs, Anker, Bbox, fps).
  - `src/leash/coco.ts`: Posen, Brücken, Wechsel nur an Frame-Grenzen, Boil-Budget §10.3 mit höchstens 5 s ohne
    Aktion.
  - `src/components/Coco.tsx`: SSR-Markup §10.4, `aria-hidden`.
  - `src/styles/coco.css`: Boil `steps(1, end)`, Größen `horizon/leash/s/m/xl/xxl`, `forced-colors`.
  - Einsatz im Menü (`kopfschief`, m) und in `EmptyState`.
  - Kalibrierbogen `scripts/art/calibration-sheet.ts` → `docs/design/qa-log/img/calibration-p2-placeholder.webp` (alle
    22 Symbole in allen Größen, KUNST-QA).
  - Akzeptanz:
    - Genau 22 IDs, gleiche `viewBox`, Anker-Toleranz eingehalten.
    - Keine `circle`/`ellipse`/`rect`/`line`/`polygon`.
    - Sprite ≤ 45 KB roh / ≤ 12 KB gz; Coco-Steuerung ≤ 3 KB gz.
    - Posenwechsel nur an Frame-Grenzen (Fake-Timer); Boil stoppt nach Budget.
    - Die Coco-Box hat feste Maße (kein CLS beim Sprite-Laden).
    - Der Kalibrierbogen existiert.
  - Tests: unit `tests/unit/art/sprite.unit.spec.ts`, `tests/unit/leash/coco.unit.spec.ts`; Budget in `check:bundle`.
  - Ohne Jutta: Platzhalter bis P9. Optional liefert Jutta weitere Coco-Fotos (A05, E-75).

- [x] **P2.19 Fehlerseiten 404 (R28) und 500 (R29)** – KO-18.
  - `src/app/(frontend)/[locale]/not-found.tsx` + `[locale]/[...rest]/page.tsx` (→ `notFound()`), echter Status 404.
  - Preset `lost`: Linie vom Kopf, `coil`, offener Karabiner, Coco `horizon` rennt einmal weg.
  - H1 „Coco hat sich losgerissen“ / „Coco slipped her leash“, Satz „Diese Seite gibt es nicht (mehr).“, Links Start,
    Shop, Tattoo.
  - Nummernfeld nur, wenn R31 `live` ist (ab P3).
  - Variante „Zuhause“ als Prop vorbereitet (P3).
  - `error.tsx` und `global-error.tsx` (R29): „Hoppla – die Leine hat sich verheddert“, statisches Knäuel-SVG, Coco
    `kopfschief` (xl), Knopf „Nochmal versuchen“ (`reset()`), Fußbereich vorhanden.
  - Test-Auslöser: `[locale]/__fehler-test/page.tsx` wirft nur bei `APP_ENV=test`, sonst `notFound()`. Die Route ist
    nicht in Registry, Sitemap oder Crawl.
  - Akzeptanz:
    - `/de/gibt-es-nicht` und `/en/does-not-exist` liefern Status 404 mit der passenden H1.
    - Der Fehler-Auslöser zeigt die 500-Seite.
    - Auf beiden Seiten ist „Vertrag widerrufen“ sichtbar (AK-3-11, R-011).
    - Die 500-Seite hat keine Animation.
    - Mit `reduce` ist Coco nicht animiert.
  - Tests: e2e `tests/e2e/error-pages.e2e.spec.ts` @smoke (AK-3-11, R-011).
  - Ohne Jutta: –

- [x] **P2.20 Startseite R01 mit Beispielinhalten** – `src/app/(frontend)/[locale]/page.tsx` liest `pages` mit
  `key = home` über `getPublicPayload()`; Geschäftsangaben kommen aus `settings.business` (DATENMODELL; keine eigenen
  Globals für Start- oder Über-mich-Seite).
  - Kopf-Station „Planet Claire“: H1 mit Planet-Marke und `orbit`-Anker.
  - Danach genau 7 Stationen in fester Reihenfolge mit `Station` (KO-21):
    - Kicker „Station 01“ (Plex Mono), H2 (Mansalva), Text;
    - Stationszeichnung: `src/art/stations/{stationId}.svg` falls vorhanden, sonst `fallbackArt`;
    - Stationsmarke (MI-12);
    - Link „Alle …“; Ziele R03/R10/R11/R19 sind `planned`, im Export „nicht enthalten“.
  - Noch keine Produktkarten (W-33).
  - Coco an der Leinenspitze mit Posen aus `cocoPose` über `COCO_POSE_TO_SPRITE`; Choreografie-Grundzüge §11.4;
    MI-10-Intro.
  - Fehlt `home`, erscheint ein neutraler Leerzustand (DM-PAGE-01).
  - Organization-JSON-LD aus P2.11.
  - Akzeptanz:
    - AK-3-01: Die Startseite zeigt die Kopf-Station „Planet Claire“ und danach genau 7 Stationen: Hallo, Keramik,
      Textil, Zeichnungen, Schmuck, Tattoo, Jutta & Coco.
    - AK-SEED-18 (Anzeige): Die Reihenfolge der `stationId` stimmt.
    - DM-PAGE-01: Ohne `home` wird kein 500 ausgelöst.
    - Die Linie zeichnet beim Scrollen (AK-DS-13).
    - Der Inhalt ist ohne JS vollständig lesbar.
    - DE und EN sind vollständig.
  - Tests: e2e `tests/e2e/home.e2e.spec.ts` @smoke (AK-3-01, AK-SEED-18, DM-PAGE-01); int
    `tests/int/pages/home-data.int.spec.ts`.
  - Ohne Jutta: Seed-Texte in Juttas Ton (E-62). Stationszeichnungen folgen in P8/P9.

- [x] **P2.21 Datenschutz-E2E: keine Cookies, kein Speicher, keine Fremd-Requests** – Suite `@privacy` in
  `tests/e2e/privacy.e2e.spec.ts`. Für alle Registry-Routen mit Status `live` in DE und EN, in allen drei Projekten,
  mit frischem Kontext je Route.
  - Akzeptanz:
    - T-04/R-130/EK-04: `context.cookies()` ist leer, `localStorage`/`sessionStorage` leer, `indexedDB.databases()`
      leer, kein Service Worker, kein `Set-Cookie`.
    - T-03/R-131/EK-05: Das Request-Log enthält nur den eigenen Origin, `data:` und `blob:`.
    - Kein Request an Google-Fonts-Hosts (AK-DS-04).
    - `check:external --built`: keine Fremd-URLs in `.next/static` und im erzeugten HTML (Allowlist nur für
      `https://www.instagram.com/…` als Linkziel).
  - Tests: e2e `privacy.e2e.spec.ts` @privacy (T-03, T-04, R-130, R-131); Skript `scripts/check-external.ts`.
  - Ohne Jutta: –

- [x] **P2.22 Barrierefreiheit: axe und Tastatur** – `@axe-core/playwright` mit den Tags `wcag2a`, `wcag2aa`,
  `wcag21a`, `wcag21aa`, `wcag22aa` (ARCHITEKTUR §7.5). `tests/e2e/a11y.e2e.spec.ts` @a11y prüft:
  - jede `live`-Route je Sprache;
  - Zustände: offenes Menü, 404, 500, Leerzustand der Startseite (ohne `home`), Rechtsseite mit Platzhalter;
  - einen Tastatur-Durchlauf: Skip-Link, Kopf, Menü, Fuß, Schalter, Sprachumschalter;
  - Fokus-Sichtbarkeit.
  - Akzeptanz:
    - T-11/EK-07/R-191: 0 Verstöße `serious`/`critical`; `moderate`/`minor` als Annotation.
    - Alles ist per Tastatur erreichbar.
    - Der Fokusring ist sichtbar (Screenshot-Diff Fokus/ohne Fokus ≠ 0).
    - `lang` ist je Seite korrekt.
  - Tests: e2e `a11y.e2e.spec.ts` @a11y (T-11, R-191), `keyboard.e2e.spec.ts`.
  - Ohne Jutta: –

- [x] **P2.23 Tempo-Budgets: `check:bundle`, Lighthouse-CI, `@perf`** –
  - `tests/perf/budgets.json` mit allen Werten aus ARCHITEKTUR §7.7 und DESIGN §9.10:
    - JS: R01 ≤ 170 KB gz, übrige ≤ 150 KB;
    - Engine ≤ 12 KB, Coco ≤ 3 KB, Mikro ≤ 4 KB, statischer Renderer ≤ 4 KB;
    - Schriften 3 Dateien ≤ 100 KB;
    - R01-Seitengewicht ≤ 1,5 MB;
    - SVG-Budgets.
  - `scripts/check-bundle.ts` (`pnpm check:bundle`): lädt jede `live`-Route gegen `next start`, ordnet Skripte zu und
    gzipt mit Stufe 9 aus `.next/static`.
  - `tests/perf/lighthouserc.cjs`: Preset mobil, Median aus 3 Läufen, `ci.upload.target: 'filesystem'`, `chromePath`
    aus Playwright; `@lhci/cli` exakt gepinnt; Seiten in P2: R01.
  - `pnpm test:perf`.
  - `@perf`-Test `tests/e2e/perf.e2e.spec.ts` (`pixel-7`, CPU 4×): Menü öffnen ≤ 200 ms (INP-Ersatz), CLS über den
    Seitenaufbau.
  - Akzeptanz:
    - T-09: Alle JS-Budgets sind eingehalten; eine Überschreitung lässt `check:bundle` scheitern (Test mit
      Fixture-Budget).
    - T-10/EK-01 auf R01: LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms. Die Ziel-Werte werden nur berichtet.
    - Die Arbeit je Frame beim Scrollen ist ≤ 6 ms bei 4× Drosselung (Bericht aus `__leash`).
  - Tests: `check:bundle` (T-09), `test:perf` (T-10), e2e `perf.e2e.spec.ts` @perf.
  - Ohne Jutta: –

- [x] **P2.24 Visuelle Referenzen** – `tests/visual/*.visual.spec.ts` (ARCHITEKTUR §7.6):
  - Chromium `desktop` 1440×900 und Mobil 390×844, `reducedMotion: 'reduce'`;
  - Uhr fest, `document.fonts.ready`, `maxDiffPixelRatio: 0.01`;
  - Umfang P2: R01, Impressum, R26, 404, 500, Kopf, offenes Menü, Fuß.

  Referenzbilder gibt es nur für Linux (`__screenshots__/*-linux.png`), und sie entstehen nur in CI: Commit mit
  `[ci:update-snapshots]` → CI lädt die Bilder als Artefakt hoch → `gh run download <id>` → Commit der Bilder mit
  `[skip ci]` und Begründung. Lokal erzeugte Bilder werden vor dem Commit verworfen. Den CI-Schritt baut P2.28; dort
  entstehen die ersten Referenzen. Auf Windows/macOS werden die Tests übersprungen.
  - Akzeptanz:
    - Die Specs decken den P2-Umfang ab; lokal (Linux) läuft `pnpm test:visual --update-snapshots` fehlerfrei durch
      (nur zur Probe, die Bilder werden nicht committet).
    - Eine absichtliche Farbänderung am Token lässt den Test gegen die lokalen Probe-Bilder scheitern (einmalig lokal
      geprüft, im PR vermerkt).
  - Tests: visual `tests/visual/shell.visual.spec.ts`, `pages.visual.spec.ts` (T-12; eingecheckte Referenzen und
    grüner `quality`-Lauf: P2.28).
  - Ohne Jutta: –

- [x] **P2.25 Vorschau-Export: Umgebung, Datenbank, Server, Crawl** – `scripts/preview-export/` laut ARCHITEKTUR
  §14.1–§14.4:
  - `index.ts`: Ablauf §14.2, Exit-Codes 0/1/2, Server im `finally` beenden, Optionen `--skip-build`/`--keep-server`;
  - `env.ts`: Export-Umgebung §14.3, u. a. `PREVIEW_EXPORT=true`, `EMAIL_DRIVER=memory`,
    `NEXT_DIST_DIR=.next-preview`, `SEED_NOW` = Exportdatum 12:00 Berlin;
  - `db.ts`: `planetclaire_preview_export`: `db:ensure`, leeren, migrieren, `seed:base`, `seed:example`;
  - `server.ts`: Build nach `.next-preview` ohne Debug-Flag, `next start -p 3999`, Warten auf `/api/health` (≤ 120 s);
  - `crawl.ts`: Start-Menge aus der Registry (`status ≠ planned`, DE+EN), `/de/__404` und `/en/__404`, Breitensuche
    über interne Links (≤ 500), Filter §14.4; serverseitiges HTML und Dateien werden erfasst.

  `PREVIEW_EXPORT=true` in der App: `data-pv-block` an Kauf-, Kassen- und Formular-Knöpfen (ab P3/P4), keine Statistik.
  - Akzeptanz:
    - AK-A-14-03: Ist Postgres nicht erreichbar, endet `pnpm preview:export` mit Exit 2 und einer deutschen Anleitung;
      ebenso bei fehlendem Chromium.
    - Ein 5xx beim Crawl ergibt Exit 1.
    - Eine Registry-Route mit 404 steht im Bericht als `not-built`.
    - Keine Anfrage an fremde Hosts während des Exports.
  - Tests: unit `tests/unit/preview-export/{env,crawl-filter}.unit.spec.ts`; int
    `tests/int/preview-export/exit-codes.int.spec.ts` (AK-A-14-03, mit unerreichbarem Port).
  - Ohne Jutta: –

- [x] **P2.26 Vorschau-Export: Umwandlung, Laufzeit, Datei** – `scripts/preview-export/transform/{html,css,images,fonts,
  svg,links}.ts` mit `cheerio` (§14.5):
  - Skripte, Preloads und Next-Daten entfernen;
  - Templates `<template data-route …>`;
  - ein `<style>`, Schriften als Data-URI;
  - Bilder per `sharp` (≤ 1200 px, WebP q70, Deduplizierung) in `pv-assets`;
  - Sprites als `#pv-sprites`, `<use href="#id">`;
  - Links und Formulare nach KONZEPT §12.5;
  - Zusatzseiten `#/vorschau/nicht-enthalten` und `#/vorschau/verwaltung` (Texte `previewExport.*`);
  - Kopf mit `robots noindex` und CSP-Meta.

  `src/preview-runtime/{main,router,assets,dialogs,cartDemo,banner}.ts` (§14.6):
  - Hash-Router mit `unmount`/`destroy` und `mount`/`mountLeash`, Fokus auf `h1`, `window.__PV_ROUTES`;
  - Dialog „Vorschau – hier wird nichts gekauft“;
  - Korb nur im Speicher;
  - Banner mit „Alle Seiten“ und Phase.

  `runtime.ts` bündelt mit esbuild (`iife`, ≤ 300 KB). `write.ts` schreibt deterministisch: sortierte Reihenfolgen,
  keine Zeitstempel im HTML.
  - Akzeptanz:
    - AK-A-14-01: `pnpm preview:export` und danach `--skip-build` erzeugen am selben Tag byte-gleiche HTML-Dateien.
    - AK-A-14-02: Die Datei enthält weder `/_next/` noch `127.0.0.1:3999`, `__next_f`, `__leash` oder `/werkstatt`.
    - Die Datei enthält keine `http(s)://`-Ressourcen außer externen Linkzielen.
    - Die Laufzeit ist ≤ 300 KB minifiziert und importiert kein `react`/`next` (AK-A-2-03).
  - Tests: unit `tests/unit/preview-export/{transform-html,transform-css,links,router}.unit.spec.ts`; int
    `tests/int/preview-export/determinism.int.spec.ts` (AK-A-14-01, AK-A-14-02).
  - Ohne Jutta: –

- [x] **P2.27 Vorschau-Export: Verwaltungsfotos, Bericht, Phase, Abnahmetest** –
  - `adminViews.ts` listet die Ansichten aus KONZEPT §7.3–§7.15 mit Phase. In P2 existiert nur Login/Liste/Formular;
    der Rest erscheint als „kommt in P5“ usw.
  - `adminShots.ts`: Login mit `SEED_ADMIN_*` der Export-DB, 390×844 bei DPR 2, WebP 780 px q70.
  - `report.ts`: `PreviewReport` mit zod und Größenbudget §14.8: Ziel ≤ 20 MB (mailbar), darüber Warnung im Bericht;
    über 40 MB Stufung, danach immer noch über 40 MB Exit 1.
  - `phase.ts` laut ARCHITEKTUR §14.9: `PREVIEW_PHASE` (CI setzt es aus `[ci:full pN]` bzw. dem PR-Titel) → sonst die
    höchste vollständig abgehakte Phase aus `PLAN.md` (`p0`, solange P1 offen ist) → sonst `px`; nie aus dem
    Branch-Namen (Cloud-Branches heißen `claude/…`).
  - `playwright.preview.config.ts` (Projekte `pv-mobile` 390×844, `pv-desktop` 1440×900, `offline: true`, Route bricht
    alles außer `file:`/`data:`/`blob:` ab).
  - `tests/e2e/preview-export.e2e.spec.ts` prüft KONZEPT §12.7 Nr. 1–9 plus CSP-Meta, leeres Cookie/Storage nach allen
    Interaktionen und einen gültigen Bericht, der jede Registry-Route nennt.
    - Nr. 7 („In den Korb“, Bestellknopf, Formular) wird nur geprüft, wenn die Route in `__PV_ROUTES` gebaut ist;
      sonst `test.skip` mit Hinweis „ab P3/P4/P7“.
    - Nr. 8 nutzt in P2 `#/de` → `#/en` statt des Shops.
  - `pnpm test:preview-export`.
  - Akzeptanz:
    - T-13/EK-11/AK-12-01: `pnpm preview:export && pnpm test:preview-export` ist in der Cloud-Sandbox ohne
      Fremd-Netz grün.
    - Die Datei ist ≤ 40 MB (harte Grenze); über 20 MB steht eine Warnung im Bericht.
    - 0 Requests außer `file:`/`data:`/`blob:`, 0 Konsolenfehler.
    - Alle Bilder und alle drei Schriften sind geladen.
    - Die Linie zeichnet auf der Startseite beim Scrollen weiter; mit `reduce` ist sie vollständig und statisch.
    - Das Menü öffnet und schließt per Tastatur.
    - `phase.ts` ergibt für einen Plan mit abgehakter P1 `p1` (Unit).
  - Tests: e2e `preview-export.e2e.spec.ts` (T-13, EK-11); unit `tests/unit/preview-export/{report,phase}.unit.spec.ts`.
  - Ohne Jutta: Test-Admin nur für die Fotos (E-03, kein zweites Konto).

- [x] **P2.28 Workflows `ci-full.yml` und `preview-export.yml`** – Laut ARCHITEKTUR §6.2, §6.4, §6.5, §7.6. Beide
  Workflows laufen wie `ci.yml` nur bei `pull_request` (Typen wie P1.1a) und `workflow_dispatch`, **nie** bei `push`
  (Arbeitsregeln oben). Ein erster Schritt liest die Nachricht des Head-Commits des PR (z. B.
  `gh api repos/{owner}/{repo}/commits/<head-sha> --jq .commit.message`); danach richten sich die Jobs. Ein Head-Commit
  mit `[skip ci]` startet ohnehin keinen Lauf.
  - `ci-full.yml` läuft bei `[ci:full` im Head-Commit und per `workflow_dispatch` (Eingabe `update_snapshots: boolean`):
    - Job `e2e-full`: ein Build mit Debug-Flag, dann `desktop`, `iphone-15` (WebKit), `pixel-7` mit allen Tests außer
      `@visual`/`@perf`, inklusive `@a11y` und `@privacy`;
    - Job `quality`: Build ohne Debug, `check:no-debug`, `test:visual`, `test:perf`, `test:e2e --grep @perf
      --project=pixel-7`.
  - Referenzbilder: `[ci:update-snapshots]` im Head-Commit – oder günstiger, weil ohne `quick`,
    `gh workflow run ci-full.yml --ref <branch> -f update_snapshots=true` – startet in `ci-full.yml` nur den Job
    `snapshots`: Produktions-Build ohne Debug-Schalter, `pnpm test:visual --update-snapshots`, Upload von
    `tests/visual/__screenshots__/` als Artefakt `visual-snapshots-<sha7>` (2 Tage, Pflicht-Upload, ARCHITEKTUR §6.4).
    So entstehen die ersten P2-Referenzen: Lauf abwarten, `gh run download <id>`, Bilder mit `[skip ci]` und Begründung
    committen (P2.24). Diese Läufe zählen im Minutenbudget (ARCHITEKTUR §6.8).
  - Fehlerberichte in `ci-full.yml` laufen hinter dem Budget-Schritt `pnpm ci:artifacts` wie in `ci.yml` (P1.33: ab
    350 MB Gesamtsumme kein Upload); nur bei Fehler, 2 Tage.
  - `preview-export.yml` läuft nur bei `[ci:full pN]` im Head-Commit des PR (Phasenende) und per `workflow_dispatch` –
    nicht bei `[ci:full]` ohne Phase, nicht bei `[ci:update-snapshots]` und nie nach einem Merge auf `main`:
    - Postgres-Service, Installation, Chromium;
    - `preview:export` → `test:preview-export`;
    - Upload `planet-claire-vorschau-<phase>-<sha7>` (HTML + `report.json`, 30 Tage);
    - Aufräumen auf die 3 neuesten (`actions: write`);
    - Job-Summary mit deutscher Kurzanleitung;
    - PR-Kommentar anlegen oder aktualisieren (`pull-requests: write`).
  - Phase per Regex `\[ci:full\s+(p\d+)\]` (ARCHITEKTUR §6.4; W-31).
  - `ci.yml` bekommt `check:no-debug` nicht (nur `quality`), aber die P2-Budgets in `check:bundle`.
  - Akzeptanz:
    - Der Unit-Test belegt Auslöser (nur `pull_request`/`workflow_dispatch`, kein `push`; `[ci:full`, `[ci:full pN]`,
      `[ci:update-snapshots]`), Regex, `permissions`, Artefaktnamen, Aufräumschritt (3 neueste) und Budget-Schritt; der
      Export-Test ist ein eigener Schritt ohne `continue-on-error`, ein roter Export-Test lässt den Workflow also
      scheitern.
    - T-12: Die Linux-Referenzbilder aus dem `[ci:update-snapshots]`-Lauf sind eingecheckt.
    - (CI-Nachweis) T-12: Job `quality` ist mit den eingecheckten Referenzen grün (aus P2.24), ebenso
      `check:no-debug` im Build ohne Debug-Flag (aus P2.17).
    - (CI-Nachweis) AK-A-6-01: Ein Push mit `[ci:full p2]` startet `ci-full.yml` und `preview-export.yml`; `[ci:full]`
      startet `ci-full.yml`, aber nicht `preview-export.yml`; `[skip ci]` startet keinen; ohne Kennung startet nur
      `ci.yml`.
    - (CI-Nachweis) AK-A-6-02: Nach einem Export existieren höchstens 3 Artefakte mit dem Präfix.
    - (CI-Nachweis) AK-12-02: Der Phasen-PR hat ein Artefakt und einen PR-Kommentar.
  - Tests: unit `tests/unit/ci/workflows.unit.spec.ts` (Auslöser, Regex, `permissions`, Artefaktname, Aufräumschritt,
    Budget-Schritt); ein Lauf mit `[ci:update-snapshots]`; CI-Nachweis im Phasenende-Lauf `[ci:full p2]`.
  - Ohne Jutta: –

- [x] **P2.29 Nachverfolgbarkeit Phase 2 und Anleitung für Jutta** –
  - `LEGAL_TRACE_PHASE = 2` in `tests/unit/legal/traceability.unit.spec.ts`. R-010, R-011, R-090, R-130, R-131 und
    R-191 stehen in Testtiteln (P2.10–P2.22).
  - Verbotsmuster-Test zusätzlich als E2E über das gerenderte HTML aller `live`-Routen:
    `tests/e2e/forbidden-html.e2e.spec.ts`, z. B. kein OS-Link, kein „inkl. MwSt.“ im Kleinunternehmer-Modus.
  - `docs/owner/ANLEITUNGEN.md` bekommt den Abschnitt „Vorschau-Datei ansehen“: Checks → Summary → Artifacts, ZIP
    entpacken, doppelklicken; ohne Fachjargon.
  - `docs/design/qa-log/` bekommt einen Eintrag zum Kalibrierbogen.
  - Akzeptanz:
    - R-001 ist mit Phase 2 grün; die Gegenprobe mit fehlender ID ergibt rot.
    - Der Verbotsmuster-E2E ist grün.
    - Die Anleitung existiert und ist in einfachem Deutsch.
  - Tests: unit `traceability.unit.spec.ts` (R-001); e2e `forbidden-html.e2e.spec.ts`.
  - Ohne Jutta: Jutta kann die Datei ansehen, muss aber nicht (keine Blockade).

### Phasen-Abnahme
- [x] Alle Aufgaben P2.1–P2.29 sind abgehakt.
- [x] Lokal grün: `pnpm check`, `pnpm test:int`, `pnpm test:e2e` (Chromium und WebKit; WebKit nur mit dokumentierter
  Ausnahme `PW_SKIP_WEBKIT=1`), `pnpm test:preview-export`.
- [x] CI grün – erst nach dem grünen Lauf abhaken, in einem Doku-Commit mit `[skip ci]`: Der letzte Commit ohne
  `[skip ci]` trägt `[ci:full p2]` (W-31); `ci.yml` (`quick`), `ci-full.yml` (`e2e-full`, `quality`) und
  `preview-export.yml` sind grün. Damit sind die „(CI-Nachweis)“-Kriterien aus P2.28 belegt.
- [x] Artefakt `planet-claire-vorschau-p2-<sha7>` existiert, der PR-Kommentar mit Anleitung ist da, höchstens 3
  Vorschau-Artefakte (AK-12-02, AK-A-6-02) – abgehakt im selben Doku-Commit wie „CI grün“.
- [x] DESIGN-Abnahme (DESIGN §13): AK-DS-01 bis AK-DS-09, AK-DS-12 bis AK-DS-16 und AK-DS-18 grün. EK-01 (R01), EK-04,
  EK-05 (P2-Routen), EK-07 und EK-11 grün.
- [x] Querschnittstests T-03, T-04, T-06, T-07, T-09 bis T-13 und T-16 grün. `LEGAL_TRACE_PHASE = 2` grün.
- [x] Jeder Pflichtlink im Fußbereich (DE/EN) führt auf eine existierende Seite (kein 404).
- [x] Spike B-03, der CSP-Teil von Spike B-01 und der View-Transition-Spike sind in ARCHITEKTUR Anhang B eingetragen
  (B-03 und View Transitions mit ADR, B-01 bei Rückfall mit ADR).
- [x] Kalibrierbogen `docs/design/qa-log/img/calibration-p2-placeholder.webp` liegt vor. Die visuellen
  Linux-Referenzen aus dem `[ci:update-snapshots]`-Lauf sind eingecheckt.
- [x] Eintrag in `docs/FORTSCHRITT.md` (was, wie getestet, Link zum Artefakt-Lauf). Neue Annahmen stehen in
  `docs/OFFENE-PUNKTE.md`.
- [x] PR-Text (Deutsch) nennt die Vorschau-Datei und die Kurzanleitung, oben „Bitte mergen – CI ist grün“.

---

## P3 – Shop-Schaufenster

**Ziel:** Besucher:innen – meist aus dem Instagram-In-App-Browser – sehen alle Unikate schnell, ruhig und rechtssicher: Shop-Übersicht mit Flohmarkt-Preisschildern an der Schnur, Kategorie-Seiten mit Filtern, Archiv der verkauften Stücke mit „sold“-Stempel und eine Produktseite, die **alle** Pflichtangaben vor dem Knopf zeigt (Preis mit § 19-Hinweis, Versandlink, Lieferzeit, Faserangaben, Deko-/Lebensmittel-Badge, Nickel- und Kleinteile-Hinweis, abweichende Beschaffenheit, Block „Herstellerin & Sicherheit“, Gewährleistungs-Mitteilung). Dazu kommen kanonische URLs mit 308-Weiterleitungen, Kurzlink `/nr/17`, 404-Varianten, SEO (Sitemap, hreflang, JSON-LD `Product`/`Offer`, OG-Bilder für Instagram-/WhatsApp-Vorschauen), statische Auslieferung mit gezielter Revalidierung (Statuswechsel ≤ 5 s sichtbar) und der erste Warenkorb-Schritt „In den Korb“ – das erste und einzige öffentliche Cookie entsteht genau hier. Keine Fremd-Requests, keine Cookies vor der Nutzeraktion.

**Voraussetzungen:** P1 abgeschlossen (Collections `products`, `categories`, `media`, `conformity-declarations`, Globals `settings`/`site-texts` mit Grund-Seed, `validateForPublish`, Statusautomat mit Admin-Endpunkten `publish`/`unpublish`/`sell-offline`/`archive`/`restore`/`return-to-stock`/`translate`/`adopt`, `getPublicPayload()` mit Seed-Filter, Mini-Beispielbestand aus P1.30 (S01, S06, S09, S11, S15, S18, S20, S25, S26, S27, Kasse KS2; den vollen Bestand liefert P8, W-21), Rate-Limit-Tabelle, `getEnv()`, Admin-Login-Helfer für Tests; Cache-Helfer `src/lib/cache/tags.ts` und `revalidate.ts`; `formatMoney` in `src/lib/money.ts`; `src/lib/products/` mit `itemNumber.ts`, `characteristics.ts`, `fibers.ts`; `src/lib/tax/` mit `getTaxModeAt`). P2 abgeschlossen (next-intl-Routing mit Routen-Registry `src/lib/routes/registry.ts` und `src/i18n/routing.ts`, `AppShell`/Kopf/Menü/Fuß inkl. Verhaltensmodul `cart-count`, Tokens und selbst gehostete Schriften, Tuschelinie-Engine mit Preset-Schnittstelle, `BehaviorHost` + `src/behaviors/`, 404/500, Sicherheits-Header/CSP-Kontext `public`, Suiten T-03/T-04/T-06/T-07/T-11/T-12, Lighthouse-CI, Vorschau-Export mit `preview-export.yml`). Namen im Code: Felder und Enums laut DATENMODELL §4/§6.6 (z. B. `category` ∈ `keramik`, `textil`, `cap`, `zeichnung`, `schmuck`, `sonstiges`; Versandklassen `brief`/`paket_klein`/`keramik`/`nur_abholung`; `foodContact` `deko`/`lebensmittelecht`), Pfade, Cookies, Endpunkte und Rate-Limits laut ARCHITEKTUR (§2.1, §2.5, §8.5, §8.7). Kategorie-Slugs werden immer aus `categories` gelesen, nie im Code festgeschrieben. Verhaltensmodule heißen kebab-case wie ihr `data-behavior`-Wert (DESIGN §9.12, ARCHITEKTUR §15.1). Rechtliche Textbausteine (ANFORDERUNGEN §6) liegen bis P6 als versionierte Arbeitsfassungen im Code (P3.3). **Seed-Anker vor P8:** Der Beispielbestand entsteht vollständig erst in P8; diese Phase ergänzt `content/seed/data/` nicht. Nennt ein Kriterium einen Seed-Anker, den P1.30 noch nicht anlegt (u. a. S08, S14, S19, S29, S30), prüft der Test eine gleichartige Fixture mit einer Nummer aus 980–999 (`tests/e2e/fixtures.ts`; Int-Tests legen sie per Local API an), und das Kriterium lautet „Fixture analog S08 …; mit dem echten Anker prüft P8.21“. Die Anker des Mini-Satzes aus P1.30 (S01, S06, S09, S11, S15, S18, S20, S25, S26, S27, Kasse KS2) existieren schon und dürfen direkt genutzt werden, aber nur lesend: Tests, die Stücke reservieren oder kaufen, nutzen immer Fixtures (ARCHITEKTUR §7.2).

**Referenzen:** E-02, E-10, E-12, E-13, E-14, E-15, E-16, E-17, E-18, E-24, E-25, E-31, E-40, E-43, E-60, E-72, E-77, E-78; R-030, R-031, R-033, R-035, R-036, R-040, R-043, R-044, R-045, R-046, R-048, R-049, R-096, R-126, R-130, R-131, R-139, V-02, V-08, V-13, V-16, V-17, V-19, V-20, V-31; KONZEPT §1.4 (EK-01, EK-04, EK-05, EK-07, EK-09, EK-11), §1.6, §2.1–2.6, §3.0.5, §3.0.6, §3.1, §3.2, §3.3, §3.4, §3.5, §3.17, §4.2 (Aktion „Hinzufügen“), §5.1, §12.5, §12.9; DATENMODELL §1.4, §4, §6.2, §6.5, §6.6, §6.13, §6.28, §7.1, §7.2, §13.3; ARCHITEKTUR §2.1, §2.3, §2.5, §3.9, §7.2–7.7, §8.1, §8.5, §8.7, §9.1–9.5, §15.1, Anhang B (B-05); DESIGN §4.4, §9.7 (`shopString`, `product`, `lost`), §9.12, §11.5 (MI-01, MI-02, MI-03, MI-07, MI-15), §12.2, §12.6, §13, KO-05, KO-06, KO-07, KO-08, KO-09, KO-09a, KO-10, KO-11, KO-17, KO-18, KO-21, KO-22, DA-6; SEED-SPEC §0.3, §5, §17.

### Aufgaben

- [x] **P3.1 Öffentliche Shop-Datenschicht und Formatierer** – Lesefunktionen in `src/lib/data/products.ts` und `src/lib/data/categories.ts`, ausschließlich über `getPublicPayload()` und jeweils mit `cached(fn, { key, tags, revalidate })` aus dem neuen `src/lib/cache/cached.ts` (Tags aus `src/lib/cache/tags.ts` laut ARCHITEKTUR §9.3: `products`, `product:<id>`, `category:<key>`, `categories`, `settings`, `home`, `sitemap`; `tags.ts` und `revalidate.ts` stammen aus P1). Funktionen: `listShopProducts({ locale, categoryKeys?, availableOnly, page })`, `listArchiveProducts({ locale, categoryKey?, page })`, `getPublicProductByItemNumber(itemNumber, locale)`, `listRelatedProducts(product, limit = 4)`, `listStationProducts(categoryKeys, limit = 4)`, `getCategoryBySlug(locale, slug)` (liefert auch einen Treffer im Slug der anderen Sprache für die 308-Weiterleitung), `listNavCategories(locale)`. Anzeige-Formatierer in `src/lib/shop/format.ts` (ARCHITEKTUR §2.1), die für Nummer, Merkmale und Fasern die Funktionen aus `src/lib/products/` nutzen: `formatItemNumber` aus `src/lib/products/itemNumber.ts` („Nr. 017“/„No. 017“, ab 1000 ohne Auffüllen), `formatDimensions` („Ø 14 cm, H 6 cm“), `formatFibers(composition, locale)` (je Komponente absteigend nach Anteil; auf `/en` amtliche deutsche Bezeichnung + englische in Klammern, R-043; Regeln aus `src/lib/products/fibers.ts`), `formatCondition`, `formatWeight(grams, locale)` (`weightGrams`; unter 1000 g „210 g“, ab 1000 g in kg mit einer Nachkommastelle, „2,4 kg“/„2.4 kg“, „,0“ entfällt; DESIGN DA-9), `productPath(product, locale)` (kanonisch `/{locale}/shop/{nr 3-stellig}-{slug}`, EN-Slug mit Rückfall auf DE). Beträge formatiert ausschließlich `formatMoney(cents, locale, { style })` aus `src/lib/money.ts` (P1; `tag` = ganze Euro für Preisschilder, sonst `full`); einen eigenen Preis-Formatierer gibt es nicht.
  - Akzeptanz:
    - Sortierung R02/R03: zuerst `available` und `reserved` nach `firstPublishedAt` absteigend, danach `sold` mit `showInArchiveAfterSale = true` nach `soldAt` absteigend; 24 Stücke je Seite (KONZEPT §3.2).
    - `availableOnly` liefert kein `sold` (AK-3-03); `sold` mit `showInArchiveAfterSale = false`, `draft` und `archived` erscheinen in keiner Liste (AK-3-04, DM-PROD-07); das Archiv liefert nur `sold` + Archiv nach `soldAt` absteigend (AK-3-09).
    - Keine Antwort enthält Admin-Felder (`reservationRef`, `currentOrder`, `internalNote`, `storageLocation`, `nickelEvidence`, `customs`, `offlineSaleNote`, `i18n`).
    - Mit `SEED_PREVIEW_MODE ≠ true` liefern alle Funktionen keine Seed-Stücke.
    - Statischer Scan: in `src/lib/shop/`, `src/components/` und `src/app/(frontend)/` kommen weder `toFixed` noch `Intl.NumberFormat` mit `currency` vor (ARCHITEKTUR §15.4).
  - Tests: `tests/int/shop/data.int.spec.ts` (eigene Stücke im Bereich 980–999 per Local API: alle Status-/Archiv-Kombinationen, 25 Stücke → 2 Seiten, Seed-Filter an/aus, keine Admin-Felder); `tests/unit/shop/format.unit.spec.ts` (Nummern 17/999/1000, Maße, Gewicht 210 → „210 g“, 1000 → „1 kg“, 2400 → „2,4 kg“/„2.4 kg“, Fasern 60/40 und Mehrkomponenten, EN-Klammer; Preise über `formatMoney`: `4500` → „45 €“/„€45“ mit `tag`, `5390` → „53,90 €“/„€53.90“ mit `full`).
  - Ohne Jutta: Beispielbestand aus P1 genügt; Owner-Nacharbeit –.

- [x] **P3.2 Spike B-05: Listen-Varianten statisch ausliefern** – zuerst erledigen (ARCHITEKTUR Anhang B). Prototyp laut ARCHITEKTUR §9.1: `src/proxy.ts` übersetzt die bekannten Parameter `available` und `page` (R02, R03, R05) sowie `category` (nur R05) in einen internen Pfad `…/variant/<schlüssel>` (Schlüssel alphabetisch sortiert, Werte validiert, z. B. `available-1.page-2`) und verwirft unbekannte Parameter; die Varianten-Segmente haben `generateStaticParams` für die bekannten Kombinationen und `dynamicParams = true`. Hilfsfunktionen in `src/lib/shop/listParams.ts` (`parseListParams`, `variantKey`, `canonicalListUrl`). Ergebnis in ARCHITEKTUR Anhang B, Zeile B-05 („Ergebnis: …, Datum, PR“) eintragen. Scheitert das Soll, wird ohne Rückfrage die Rückfallebene umgesetzt (dynamisches Rendern mit Daten-Cache, zulässig nur, wenn T-10 grün bleibt) und als ADR `docs/adr/` dokumentiert.
  - Akzeptanz:
    - AK-A-9-03: `/de/shop?available=1&page=2` liefert im Produktions-Build dieselbe HTML wie die interne Variante und wird aus dem Cache bedient (`x-nextjs-cache: HIT` bzw. Eintrag im Prerender-Manifest) – oder der Rückfall ist per ADR dokumentiert.
    - Sichtbare und kanonische URL bleibt die Query-Form; canonical ohne `available`/`category`, mit `page` erst ab Seite 2 (KONZEPT §2.3); `?foo=bar` liefert dieselbe Antwort wie ohne Parameter; ungültige Werte (`page=0`, `page=abc`, `available=2`) werden wie fehlend behandelt.
    - Der Proxy öffnet keine DB-Verbindung und importiert kein Payload (ARCHITEKTUR §9.5).
  - Tests: `tests/unit/shop/list-params.unit.spec.ts` (Parsing, Schlüssel-Reihenfolge, ungültige Werte, canonical); `tests/e2e/shop/list-variants.e2e.spec.ts` `@smoke` gegen `E2E_SERVER=start` (Header bzw. Prerender-Manifest).
  - Ohne Jutta: –.

- [x] **P3.3 Preis-, Steuer-, Liefer- und Gewährleistungshinweise** – `src/lib/legal/snippets.ts` mit allen Bausteinen aus ANFORDERUNGEN §6 als Konstanten (Arbeitsfassung DE, sinngemäße EN-Fassung, je Baustein `origin: 'draft'`, `version: 'draft-1'`, `sha256` des DE-Texts; Konstante `LEGAL_SNIPPET_REQUIRES_LAWYER` laut DATENMODELL §4) und `getSnippet(key, locale, vars)` (Schlüssel nur aus `LEGAL_SNIPPET_KEYS`; unbekannter oder unersetzter Platzhalter → Fehler, Muster R-012). Ab P6 liest dieselbe Funktion die Collection `legal-snippets` (DATENMODELL §6.28); Aufrufer ändern sich nicht. Komponenten unter `src/components/shop/`: `PriceNote` (Modus `kleinunternehmer` → Baustein `price.kleinunternehmerNote`; Modus `regelbesteuert` ab dessen `validFrom` in `settings.tax.modes` → „inkl. 19 % USt.“ bzw. „inkl. 7 % USt.“ je `vatCategory`, Sätze aus `settings.tax.standardRate`/`reducedRate`), `MoneyAmount` (neutrale Betragsanzeige für Positionen, Versand und Summen; `formatMoney` mit `full`), `ShippingNoteLink` (Baustein `price.shippingNote` als Link auf R25 aus der Routen-Registry), `DeliveryTime` (Baustein `delivery.timeShipping` mit `settings.shipping.deliveryTimeText`; bei `nur_abholung` Baustein `delivery.timePickup`), `PriceFootnote` (Auflösung des Sternchens, einmal je Seite), `WarrantyNotice` (R-049: harmonisierte Mitteilung zur gesetzlichen Gewährleistung, Grafik lokal unter `public/legal/`, Alt-Text, Textlink zur EU-Infoseite, DE/EN). Den Steuermodus liefert `getTaxModeAt(settings, date)` aus `src/lib/tax/` (P1.21). `pnpm check:static` bekommt die Regel (R-030): `formatMoney` wird außerhalb von `src/lib/` nur in `PriceTag`, `PriceNote` und `MoneyAmount` aufgerufen; innerhalb von `src/lib/` nur in `src/lib/email/`, `src/lib/pdf/`, `src/lib/invoices/` und `src/lib/shop/`. Alle Texte über next-intl (`src/i18n/messages/{de,en}.json`).
  - Akzeptanz:
    - R-030: jede Preisausgabe läuft über diese Komponenten; im Modus `kleinunternehmer` erscheint nie „inkl. MwSt“ oder „inkl. USt“ (AK-3-07, V-02, R-126); im Modus `regelbesteuert` erscheint ab `validFrom` der passende Satz.
    - R-035: Lieferzeit ohne vage Zusätze („ca.“, „in der Regel“).
    - R-049: `WarrantyNotice` zeigt Grafik mit Alt-Text, Text und Link in DE und EN; die Grafik wird vom eigenen Origin geladen.
    - Jeder Schlüssel aus `LEGAL_SNIPPET_KEYS` hat eine DE-Fassung und eine EN-Fassung mit `origin: 'draft'`; die Komponenten kennen keinen Vergleichs-/Streichpreis (V-20).
  - Tests: `tests/unit/legal/snippets.unit.spec.ts` (jeder Schlüssel DE und EN vorhanden, `origin`/`version`/`sha256` gesetzt, Platzhalter-Fehler); `tests/unit/shop/price-note.unit.spec.ts` (jsdom; beide Modi, Datumsgrenze `validFrom`, Testname „R-030 …“); `tests/unit/static/money-usage.unit.spec.ts` (Aufrufstellen von `formatMoney`); `tests/unit/legal/forbidden.unit.spec.ts` um die neuen Dateien erweitern (V-02, V-19, V-20).
  - Ohne Jutta: Lässt sich die amtliche Grafik (DVO (EU) 2025/1960) in der Sandbox nicht laden: Platzhalter-Grafik „Harmonisierte Mitteilung – amtliche Grafik folgt“ + Eintrag in `docs/OFFENE-PUNKTE.md` (das Go-live-Gate R-210 prüft das). P11: Kanzlei-Wortlaut der Bausteine (AUFGABEN A28), amtliche Grafik abgleichen (Kanzleifrage K-19).

- [x] **P3.4 Preisschild, sold-Stempel, Badges, Produktkarte, Hinweis-Kasten** – Komponenten unter `src/components/shop/` nach DESIGN: `PriceTag` (KO-05; Varianten `hanging`, `pinned`, `mini`; Drehung `((nr × 37) mod 9) − 4` Grad, Ergebnis 0 → 2.5°; Fadenlänge `6 + ((nr × 13) mod 9)` px; Preis in Mansalva mit `formatMoney(…, { style: 'tag' })` und `*`, darunter `Nr. 017` in Plex Mono), `SoldStamp` (KO-06, `aria-hidden`, −14° ± 2° nach Nummer, `lang="en"`), `Badge` (KO-10: Unikat, Deko-Hinweis, Lebensmittelecht, reserviert, Second-Hand, Kleinteile), `ProductCard` (KO-07: die ganze Karte ist genau ein `<a>`, `aria-label` „{Titel}, {Preis}{, gerade reserviert | , verkauft}“, Foto 4:5 mit `srcset` aus `thumb`/`card` und `sizes` laut KO-07, die ersten zwei Karten ohne `loading="lazy"`, Dominanzfarbe als Lade-Hintergrund, Meta „Keramik · Ø 14 cm“), `Callout` (KO-22: `info`, `warn`, `deviation`). Verhaltensmodule `src/behaviors/price-tag-swing.ts` (`data-behavior="price-tag-swing"`, MI-02) und `src/behaviors/sold-stamp.ts` (`data-behavior="sold-stamp"`, MI-03 nur beim Live-Wechsel auf `sold`), beide im Register `src/behaviors/index.ts`, mit `mount(root, ctx) → unmount()`, ohne React/Next/Payload-Importe, bei reduzierter Bewegung aus.
  - Akzeptanz:
    - AK-DS-10: genau ein `<a>` je Karte, kein weiteres fokussierbares Element; Klick auf Foto, Schild, Titel und Meta navigiert zur Produktseite; `aria-label` enthält Titel und Preis; der Bild-Container hat vor dem Laden die Endhöhe.
    - Winkel und Fadenlänge sind deterministisch (Server = Client, keine Zufallswerte).
    - `sold`: Foto `opacity: 0.82`, Stempel über dem Schild, Text ungedämpft; `reserved`: Badge oben links auf dem Foto.
    - MI-02/MI-03 animieren nur `transform`/`opacity`; mit `prefers-reduced-motion: reduce` liefert `document.getAnimations()` keine laufende Animation.
    - AK-DS-18: `mount()` → `unmount()` entfernt alle Listener, Timer und Animationen beider Module; im Modus `preview` kein `fetch`, kein Cookie-/Storage-Zugriff.
  - Tests: `tests/unit/shop/price-tag.unit.spec.ts` (Nr. 1, 17, 999, 1000); `tests/unit/shop/product-card.unit.spec.ts` (jsdom, Struktur AK-DS-10); `tests/unit/behaviors/price-tag-swing.unit.spec.ts` und `sold-stamp.unit.spec.ts` (AK-DS-18); `tests/unit/behaviors/contract.unit.spec.ts` bleibt grün (Dateiname = `data-behavior`, keine verbotenen Importe; AK-A-15-02, AK-A-2-03); `tests/visual/shop-components.visual.spec.ts` (Schild normal/sold, Karte available/reserved/sold; die Linux-Referenzbilder entstehen nur in CI, gesammelt mit denen aus P3.16).
  - Ohne Jutta: –.

- [x] **P3.5 Shop-Übersicht (R02) und Kategorie-Seiten (R03)** – `src/app/(frontend)/[locale]/shop/page.tsx` und `shop/category/[slug]/page.tsx` samt Varianten-Segmenten aus P3.2: H1 „Shop“ bzw. Kategoriename, Einleitung (`site-texts.shop` bzw. `categories.intro`), Filter-Chips KO-08 als Links („Alle“ + Kategorien mit `showInNavigation`, aktiver Chip mit `aria-current="page"`, Chip „nur verfügbare“ → `?available=1`), Raster aus `ProductCard`, „Mehr zeigen“ als echter Link `?page=n+1`, `PriceFootnote` und Zeile „Lieferung innerhalb Deutschlands · Abholung in Berlin möglich“, Leerzustände KO-17 (Shop leer → Archiv-Link; Kategorie leer → „Alle Stücke“), Shop pausiert (`settings.shop.isOpen = false`) → Hinweis mit `settings.shop.closedMessage` über dem Raster, die Stücke bleiben sichtbar (KONZEPT §3.2), Leinen-Preset `shopString` (DESIGN §9.7) mit Coco-Platzhalter. Unbekannter Kategorie-Slug → 404; Slug der anderen Sprache → 308 auf den richtigen Slug (KONZEPT §2.4). R02/R03 in der Routen-Registry auf „gebaut“ setzen.
  - Akzeptanz:
    - AK-3-03 und AK-3-04 im gerenderten HTML; Karten `reserved` zeigen „gerade reserviert“, `sold` den Stempel (KONZEPT §3.2).
    - `GET /en/shop/category/keramik` → 308 auf den EN-Slug aus der DB; unbekannter Slug → 404 mit vollständigem Fußbereich.
    - Titel „Shop · Planet Claire“ bzw. „{Kategorie} · Shop · Planet Claire“ (DE/EN).
    - R-030/R-031: Sternchen am Preis und dessen Auflösung auf derselben Seite; kein „inkl. MwSt“ (AK-3-07).
    - Ohne JavaScript sind Filter, Paginierung und Karten voll bedienbar (echte Links).
  - Tests: `tests/e2e/shop/shop.e2e.spec.ts` (Filter, `?available=1`, Paginierung mit 25 Fixture-Stücken, Leerzustand über eine Kategorie ohne sichtbare Stücke, Shop pausiert per Local API → `closedMessage` über dem Raster, 308/404, Tastatur durch die Chips, `javaScriptEnabled: false`); `@a11y`-Lauf R02/R03 DE/EN.
  - Ohne Jutta: –.

- [x] **P3.6 Archiv (R05)** – `src/app/(frontend)/[locale]/archive/page.tsx` (DE `/de/archiv`, EN `/en/archive`): H1 „Archiv“/„Archive“, Satz „Schon ausgezogen – aber schön anzusehen“ (i18n), Kategorie-Chips als `?category=<slug der Seitensprache>` (nur Kategorien mit Archiv-Stücken), Raster aller `sold` mit `showInArchiveAfterSale = true` nach `soldAt` absteigend, 24 je Seite, Karte mit Preis und statischem Stempel (kein MI-03 beim Laden), Leerzustand KO-17 „Noch ist nichts verkauft.“ + Shop-Link, Preset `shopString`. Route R05 in der Registry auf „gebaut“.
  - Akzeptanz:
    - AK-3-09: kein Stück mit `available`, `reserved`, `draft` oder `archived` im Archiv; unbekannte `category` wird ignoriert.
    - canonical ohne `category`; beim Laden keine laufende Stempel-Animation.
  - Tests: `tests/e2e/shop/archive.e2e.spec.ts` (Seed-Anker S06 sichtbar; Fixture analog S08 – `sold`, `showInArchiveAfterSale = false` – nicht sichtbar; mit den echten Ankern S19 und S08 prüft P8.21; Filter; Leerzustand); `@a11y`.
  - Ohne Jutta: –.

- [x] **P3.7 Produktseite: Auflösung, Weiterleitungen, 404-Varianten, Kurzlink (R04, R31)** – `src/app/(frontend)/[locale]/shop/[product]/page.tsx`: Auflösung nur über die führenden Ziffern des Segments; nicht kanonische Form (andere Auffüllung, alter Slug nach Titeländerung, Slug der anderen Sprache, kein Slug) → 308 (`permanentRedirect`) auf `productPath()`; `draft`, `archived` oder unbekannt → 404; `sold` mit `showInArchiveAfterSale = false` → 404-Variante „Dieses Stück hat schon ein Zuhause gefunden“ (HTTP 404, `noindex`, Links Shop und Archiv, KO-18 mit Mini-Preisschild „sold“ am Leinenende und Preset `lost` ohne Weglauf-Animation); `generateStaticParams` für alle öffentlichen Stücke, `dynamicParams = true`. Kurzlink `src/app/(api)/nr/[nummer]/route.ts`: 307 auf die kanonische Produktseite in der per `Accept-Language` erkannten Sprache (q-Werte beachten, Standard `de`), `Vary: Accept-Language`, `Cache-Control: no-store`, kein Cookie; unbekannt oder nicht öffentlich → 404. Das Nummernfeld der 404-Seite (P2) zielt auf `/nr/[nummer]`. Routen R04 und R31 in der Registry auf „gebaut“.
  - Akzeptanz:
    - AK-2-03: `GET /de/shop/17` → 308 `/de/shop/017-<slug>`; `GET /en/shop/017-<de-slug>` → 308 auf den EN-Slug.
    - AK-2-06: `/nr/17` mit `Accept-Language: de` → 307 auf die DE-Seite; mit `en-US,en;q=0.9` → EN-Seite; unbekannte Nummer → 404.
    - AK-3-04: Fixture analog S08 (`sold`, `showInArchiveAfterSale = false`) → 404-Variante mit `noindex`; mit dem echten Anker S08 prüft P8.21. Seed-Anker S18/S25 (draft) und S09 (archived) → 404.
    - Keine dieser Antworten enthält `Set-Cookie`.
  - Tests: `tests/e2e/shop/product-routing.e2e.spec.ts` (Playwright `request`: Status, `Location`, `Vary`, Header; Fixture analog S08; Seed-Anker S09, S18, S25).
  - Ohne Jutta: –.

- [x] **P3.8 Produktseite: Kopf, Preis, Pflichtangaben und Kaufbereich** – Blöcke 2–6 aus KONZEPT §3.4 in genau dieser DOM-Reihenfolge: H1; Kurzdaten (`Nr. 017` · Badge „Unikat“ · Kategorie · Maße); `PriceTag` `pinned` + `PriceNote` + `ShippingNoteLink` + `DeliveryTime`; Pflichtangaben je Kategorie – `keramik`: Badge „Deko – nicht für Lebensmittel“ + Baustein `product.ceramicsDecorative`, bei `lebensmittelecht` Badge „Lebensmittelecht – Konformitätserklärung ansehen“ mit Link auf R27 `#glaze-<id>` (nur mit aktiver Erklärung); `textil`/`cap`: Faserzusammensetzung (`formatFibers`) oder „Etikett fehlt – Material nach bestem Wissen: …“ (`labelMissing`, `fiberFreeText`, Baustein `product.textileLabelMissing`), Größe (`sizeLabel`), Zustand (+ `conditionNote`), Badge + Baustein „Second-Hand/Vintage“; `schmuck`: `metalPartsMaterial` + Baustein `product.jewelryNickel` + Baustein `product.jewelrySmallParts` (voller Kleinteile-Warntext); `zeichnung`: Technik/Material (`materials`) und Maße, bei `framed` + `frameHasGlass` Baustein `product.glassFrame`; `hasDeviation` → `Callout deviation` „Besonderheit dieses Stücks: {deviationDescription}“ (Wortlaut RECHT R-048 Nr. 1); Liefergebiet-Satz „Lieferung nur innerhalb Deutschlands, Abholung in Berlin nach Absprache“ direkt am Kaufbereich (R-036). Kaufbereich serverseitig nach Status: `available` → Knopf „In den Korb“ (Aktion folgt in P3.11), `reserved` → `aria-disabled` mit „Gerade reserviert – schau in 30 Minuten nochmal“, `sold` → Stempel + „Schon verkauft“ + Links „Ähnliche Stücke“ (Kategorie) und Archiv; bei `settings.shop.isOpen = false` (Shop pausiert) und Stück nicht `sold` ist „In den Korb“ deaktiviert (`aria-disabled`), darüber steht der Text aus `settings.shop.closedMessage` (KONZEPT §3.4 Nr. 6, DATENMODELL §7.1). Fehlen EN-Texte, erscheint der DE-Text mit `lang="de"` am Element. Leinen-Preset `product` (Unterstreichung der H1 → Haken am Knopf), reservierte Coco-Box 48×40 neben dem Preisschild.
  - Akzeptanz:
    - AK-3-05: bei `textil`/`cap` stehen Material und Größe im DOM vor „In den Korb“; ebenso alle Pflichtangaben der übrigen Kategorien (R-043, R-044, R-045, R-046) und der Abweichungs-Kasten (R-048 Nr. 1).
    - AK-3-07; kein Pflichttext steckt in `<details>`, Tabs oder hinter einem Klick.
    - R-043: auf `/en/…` erscheint z. B. „100 % Baumwolle (cotton)“.
    - R-044: im Deko-Fall enthält der gerenderte Produkttext kein Wort aus V-13; der Lebensmittel-Badge verlinkt nur bei gültiger Erklärung.
    - Knopftexte exakt laut KONZEPT §3.4 und KO-11 (DE/EN); keine Beschriftung „Jetzt kaufen“, „Kaufen“, „Bestellen“, „Weiter zur Zahlung“ (Liste aus R-064).
    - Mit `settings.shop.isOpen = false` ist „In den Korb“ auf keiner Produktseite bedienbar (deaktiviert; der Server lehnt zusätzlich ab, P3.11), die `closedMessage` steht sichtbar darüber; verkaufte Stücke zeigen weiter „Schon verkauft“.
  - Tests: `tests/e2e/shop/product-page.e2e.spec.ts` mit den Seed-Ankern S01 (Keramik), S11 (Textil, Abweichung, Mischgewebe), S26 (Schmuck), S27 (reserviert) und S06 (sold) sowie Fixtures analog S14 (Textil, Etikett fehlt: `labelMissing` + `fiberFreeText`), S30 (`sonstiges`, nur Abholung) und S29 (Schmuck, EN-Rückfall) – mit den echten Ankern S14, S19, S29 und S30 prüft P8.21 – und einer Test-Fixture „Keramik lebensmittelecht“ (Nummer 980–999) mit eigener `conformity-declaration` (der Seed hat keine, SEED-SPEC §0.3); Shop geschlossen per Local API; DOM-Reihenfolge per `compareDocumentPosition`; `tests/e2e/legal/product-info.e2e.spec.ts` mit Testnamen „R-043 …“, „R-044 …“, „R-045 …“, „R-046 …“, „R-048 …“.
  - Ohne Jutta: –; P11: Kanzlei-Wortlaut der Produkt-Bausteine (Kanzleifragen K-12, K-14, K-15).

- [x] **P3.9 Produktseite: Beschreibung, Details, „Herstellerin & Sicherheit“, Versand & Rückgabe, „Mehr aus …“** – Blöcke 7–11 aus KONZEPT §3.4: Beschreibung (`description`, Absätze; EN-Rückfall) und optional „Jutta sagt“ (`juttaSays`); Details-Tabelle (Maße, Gewicht aus `weightGrams` über `formatWeight` im Format DESIGN DA-9, Material bzw. Technik, Größe, Zustand, Pflege `careInstructions`; leere Zeilen entfallen; KONZEPT §3.4 Nr. 8); `ProductSafetyBlock` „Herstellerin & Sicherheit“ – immer offen, für jede Kategorie: `business.legalName` (+ `tradeName`), Straße, PLZ Ort, E-Mail, Produktart, `Nr. 017`, `safetyWarnings` (DE immer, auf `/en` zusätzlich EN) inkl. Kleinteile-Zusatz; Block „Versand & Rückgabe kurz“: Versandklasse mit Preis aus `settings.shipping.rates` (Zone DE, z. B. „Versand als Keramik-Paket 8,90 €“), „Abholung in Berlin möglich“ (außer `nur_abholung`), Widerrufshinweis **ohne** die V-19-Formel im Wortlaut von KONZEPT §3.4 Nr. 10 („Infos zu deinem Widerrufsrecht findest du in der Widerrufsbelehrung. Die Kosten einer Rücksendung trägst du.“) mit Links R24 und R25; `WarrantyNotice` im Bereich Preis/Produktangaben (R-049); „Mehr aus {Kategorie}“ (bis zu 4 sichtbare, nicht `sold`, ohne das aktuelle Stück).
  - Akzeptanz:
    - AK-3-06/R-040: der Block ist ohne Interaktion sichtbar und enthält Name, Straße, E-Mail, „Nr. …“ und Warntext – für jede Kategorie inkl. Zeichnungen; auf `/en` steht der deutsche Warntext zusätzlich zum englischen.
    - R-031 (Produktseiten-Teil): Versandklasse mit Preis und Abholoption sichtbar.
    - V-08, V-19, V-31: kein Widerrufsausschluss, keine Werbung mit „14 Tage Widerrufsrecht“, die Privatadresse steht nur im GPSR-Block.
    - Die Details-Tabelle zeigt für jede Kategorie das Gewicht (Seed-Anker S01: „210 g“; DE und EN).
    - „Mehr aus …“ enthält kein `sold` und nicht das aktuelle Stück.
  - Tests: `tests/e2e/legal/gpsr.e2e.spec.ts` („R-040 …“, je Kategorie ein Seed-Stück aus P1.30, für `sonstiges` die Fixture analog S30; DE und EN); Erweiterung von `product-page.e2e.spec.ts` (Details mit Gewicht und ohne leere Zeilen, „Mehr aus …“); `tests/e2e/legal/forbidden.e2e.spec.ts` um R04 erweitern.
  - Ohne Jutta: Stammdaten sind Grund-Seed-Platzhalter („[Adresse folgt]“); P11: echte Stammdaten (AUFGABEN A26, A34; R-020, R-205).

- [x] **P3.10 Produktgalerie, Zoom und mobile Kauf-Leiste** – `ProductGallery` mit den Verhaltensmodulen `src/behaviors/gallery.ts`, `src/behaviors/lightbox.ts`, `src/behaviors/buy-bar.ts` (`data-behavior` = Dateiname; KO-09, KO-09a, MI-15): Scroll-Snap-Leiste (4:5, `object-position` am Fokuspunkt, `srcset` aus `card`/`detail`), Punkte-Anzeige und Zähler „2 / 5“, ab 768 px Knöpfe „vorheriges/nächstes Foto“ und Miniaturen mit `aria-current`, Leiste `tabindex="0"` mit `aria-roledescription` und Pfeiltasten, Zähler `aria-live` nur nach Knopf/Taste; Lightbox als `<dialog>` (Größe `zoom` bzw. größte vorhandene, Pinch-Zoom, Doppeltipp/Klick 1× ↔ 2×, Ziehen, Wischen, Schließen per „Schließen“, `Esc` und Browser-Zurück über `history.pushState`, Fokus zurück aufs auslösende Foto); erstes Foto als LCP mit `fetchpriority="high"` und ohne `lazy`; Kauf-Leiste nur unter 768 px und bei `available`, eingeblendet, sobald der Hauptknopf den Sichtbereich verlässt. Keine Slider-/Zoom-Bibliothek; alle Module laufen im Modus `preview` (Vorschau-Datei) ohne Server-Aufrufe.
  - Akzeptanz:
    - Tastatur: Pfeiltasten wechseln das Foto; `Esc` und Browser-Zurück schließen die Lightbox, der Fokus kehrt zurück; ohne JavaScript sind alle Fotos per Scrollen erreichbar.
    - Fotos verkaufter Stücke werden nicht gedämpft.
    - INP-Ersatz „Zoom öffnen“ ≤ 200 ms (`@perf`, Projekt `pixel-7`, CPU 4×).
    - AK-DS-18 für `gallery`, `lightbox` und `buy-bar` (sauberes `unmount()`, im Modus `preview` kein `fetch`/Storage).
  - Tests: `tests/e2e/shop/gallery.e2e.spec.ts` (Projekte `desktop` und `iphone-15`, Tastatur, Zurück-Taste, `reducedMotion: 'reduce'`); Erweiterung der `@perf`-Suite; `tests/unit/behaviors/gallery.unit.spec.ts` (Index-Berechnung aus der Scroll-Position, AK-DS-18), `lightbox.unit.spec.ts`, `buy-bar.unit.spec.ts` (AK-DS-18).
  - Ohne Jutta: Die Seed-Fotos sind nur 640 px breit, der Zoom wirkt weich (DESIGN §12.2, bekannte Grenze); besser nach dem Instagram-Export (AUFGABEN A04, A06).

- [x] **P3.11 Live-Zustand der Stücke und „In den Korb“** – Endpunkt `src/app/(api)/api/public/product-status/route.ts` (`GET ?ids=1,2`, höchstens 24 IDs, zod, Rate-Limit `product_status` 120/min, `Cache-Control: no-store`, Antwort je ID nur `available | reserved | sold | gone`) und Verhaltensmodul `src/behaviors/product-status.ts` (`data-behavior="product-status"`; aktualisiert nach dem Laden Kaufbereich, Karten-Badges und Stempel; startet `sold-stamp` (MI-03) beim Live-Wechsel auf `sold`; im Modus `preview` ohne Abfrage). Server-Action `addToCart` (Dienst in `src/lib/commerce/cart.ts`, eingebunden über `src/app/(frontend)/[locale]/shop/[product]/actions.ts`): prüft Shop geöffnet (`settings.shop.isOpen`), Stück öffentlich, `available`, noch nicht im Korb, Korb < 20 Stücke; setzt bzw. aktualisiert **erst jetzt** das Cookie `pc_cart` genau nach ARCHITEKTUR §8.7 (`Path=/; SameSite=Lax; Secure` außer auf `localhost`; `Max-Age=604800`; nicht `HttpOnly`; Inhalt base64url-JSON `{"v":1,"items":[{"id":12,"p":4500}],"delivery":"shipping"}` mit `p` = Preis in Cent beim Hinzufügen, nur für den Hinweis „Preis wurde aktualisiert“ in P4.7; `delivery` Standard `shipping`, bei einem `nur_abholung`-Stück `pickup`; keine Kennung, keine Personendaten). Das Format kapseln reine Funktionen `encodeCartCookie`/`decodeCartCookie` in `src/lib/commerce/cartCookie.ts` (ohne `server-only`), die auch `cart-count` (P2) nutzt. Rate-Limit `cart_add` (ARCHITEKTUR §8.5); bei Ablehnung Antwort mit dem aktuellen Zustand. Verhaltensmodul `src/behaviors/add-to-cart.ts` (`data-behavior="add-to-cart"`, KO-11): „In den Korb“ → „Liegt schon in deinem Korb“ + Link „Zum Korb“ (R06, Registry-Status bis P4.8 `planned`), kurze Bestätigung „Liegt im Korb“ ohne Seitenwechsel, Korb-Anzahl im Kopf +1 (MI-07), Coco-Hüpfer MI-01 als Grundfassung; im Modus `preview` nur Anzeige und Zählung im Speicher. Ohne JavaScript: Formular-POST → 303 zurück auf die Produktseite, die nun „Liegt schon in deinem Korb“ + „Zum Korb“ zeigt.
  - Akzeptanz:
    - AK-3-08: „In den Korb“ auf einem inzwischen reservierten, verkauften oder ausgeblendeten Stück (veraltete Seite) wird serverseitig abgelehnt und zeigt den aktuellen Zustand; bei geschlossenem Shop ebenso (Meldung `closedMessage`).
    - T-04/R-130/EK-04: vor dem ersten „In den Korb“ weder Cookies noch Web-Storage; danach genau `pc_cart` mit den Attributen oben; `product-status` setzt kein Cookie.
    - Das 21. Stück wird mit Meldung abgelehnt (Cookie unverändert); dasselbe Stück zweimal → kein Duplikat.
    - Das Cookie enthält nur Stück-IDs, `p` und die Lieferart; ein ungültiges oder manipuliertes Cookie wird als leer behandelt und neu geschrieben; ein manipuliertes `p` ändert keinen Preis (der Server rechnet immer mit dem DB-Preis).
    - AK-DS-18 für `product-status` und `add-to-cart`.
  - Tests: `tests/int/commerce/add-to-cart.int.spec.ts` (Zustände, Grenzen, Shop geschlossen); `tests/unit/commerce/cart-cookie.unit.spec.ts` (Serialisieren, Parsen, Manipulation, Attribute); `tests/unit/behaviors/product-status.unit.spec.ts`, `add-to-cart.unit.spec.ts` (AK-DS-18); `tests/e2e/privacy/cart-cookie.e2e.spec.ts` `@privacy` („R-130 …“, alle drei Projekte); `tests/e2e/shop/add-to-cart.e2e.spec.ts` (veraltete Seite: Stück im Hintergrund per Admin-Endpunkt „offline verkauft“, dann Klick → „Schon verkauft“; `javaScriptEnabled: false` → 303 und Zustand „Liegt schon in deinem Korb“).
  - Ohne Jutta: –.

- [x] **P3.12 Startseite: Stationen mit echten Stücken** – KO-21 in den Kategorie-Stationen der Startseite (P2-Gerüst): je Station bis zu 4 Stücke über `listStationProducts` (`available`/`reserved`, neueste zuerst; Station Textil = `textil` + `cap`, KA-17), Karten ohne Schnur mit Preisschild `pinned` am Kartenfuß, Link „Alle {Kategorie}“ → R03, Leerzustand „Gerade ist hier nichts – schau bald wieder oder stöbere im Archiv“ + Archiv-Link, Preis-Fußnote einmal pro Seite. Die Tattoo-Station bleibt bis P7 unverändert; Revalidierung über Tag `home`.
  - Akzeptanz:
    - AK-3-01 (Kopf-Station + genau 7 Stationen in der Reihenfolge), AK-3-02 (≤ 4 Stücke je Station, nie `sold`, `draft`, `archived`); AK-SEED-18 bleibt grün.
    - Die Stationen lesen über `cached(…)` mit Tag `home`; dass ein Statuswechsel (z. B. „offline verkauft“) das Stück nach Revalidierung von der Startseite entfernt, prüft P3.15.
  - Tests: `tests/e2e/home/stations.e2e.spec.ts` (Anzahl, Status, Leerzustand mit einer Test-Kategorie ohne Stücke); vorhandene Leinen-Tests (AK-DS-13, AK-DS-14) bleiben grün.
  - Ohne Jutta: –.

- [x] **P3.13 SEO: Metadaten, canonical/hreflang, JSON-LD, Sitemap** – `generateMetadata` für R02–R05 und die 404-Variante: Titel nach KONZEPT §3.0.5/§3.2–3.5 (Produkt `{Titel} – Nr. 017 · Planet Claire`), Beschreibung (Produkt: erste 155 Zeichen der Beschreibung bzw. `seo.metaDescription`; Listen: CMS-Text bzw. Vorlage mit 120–160 Zeichen), canonical absolut mit Apex-Domain aus `NEXT_PUBLIC_SITE_URL` und Slug der Seitensprache, `hreflang` `de`, `en`, `x-default` (= DE), Open Graph (`og:title`, `og:description`, `og:url`, `og:type` = `product` auf R04 sonst `website`, `og:locale` `de_DE`/`en_GB` mit Alternate). JSON-LD-Builder `src/lib/seo/jsonld.ts`: `Product` mit `name`, `image` (absolut), `description`, `sku` = „017“, `brand` „Planet Claire“, `itemCondition` (`UsedCondition` bei `isSecondHand`, sonst `NewCondition`), `offers` (`price` „45.00“ – aus Integer-Cent als Zeichenkette gebildet, ohne Fließkomma-Rechnung –, `priceCurrency` `EUR`, `availability` `InStock` bei `available`/`reserved`, `SoldOut` bei `sold`, `url`), **ohne** `valueAddedTaxIncluded` im Kleinunternehmer-Modus; `BreadcrumbList` auf R02–R05. Sitemap `src/app/sitemap.ts` (Tag `sitemap`) ergänzen: Produkte `available`/`reserved`/`sold` + Archiv, Kategorien, Archiv – mit `xhtml:link`-Alternates und `lastmod` aus `updatedAt`; Seed-Dokumente nur außerhalb `APP_ENV=production`; Korb, Kasse und Token-Seiten nie.
  - Akzeptanz:
    - AK-2-05 für alle P3-Routen; 404-Varianten ohne hreflang, mit `noindex`.
    - JSON-LD ist gültiges JSON mit den Feldern oben; R-126 (kein Steuer-Flag im KU-Modus).
    - `sitemap.xml` enthält die Seed-Anker S01 und S06 (sold, Archiv), nicht S09 und S18 und nicht die Fixture analog S08; mit den echten Ankern S19 und S08 prüft P8.21; der EN-Eintrag nutzt den EN-Slug; der Admin-Pfad kommt nicht vor (AK-2-04).
  - Tests: `tests/unit/seo/jsonld.unit.spec.ts` (Snapshot je Zustand und Steuermodus); `tests/e2e/seo/meta.e2e.spec.ts` (canonical, hreflang, og je Seitentyp DE/EN); `tests/e2e/seo/sitemap.e2e.spec.ts` (XML parsen).
  - Ohne Jutta: –; P11: Produktionswert `NEXT_PUBLIC_SITE_URL`.

- [x] **P3.14 OG-Bilder für Link-Vorschauen (Instagram, WhatsApp)** – `src/app/(frontend)/[locale]/shop/[product]/opengraph-image.tsx` mit `next/og` `ImageResponse`, 1200×630 nach DESIGN §12.6: links das erste Foto 504×630 am Fokuspunkt (aus der lokal gespeicherten Bildgröße gelesen, kein Netzwerkabruf), rechts Titel (höchstens 3 Zeilen), Preisschild mit `formatMoney(…, { style: 'tag' })`, Sternchen und „Endpreis zzgl. Versand“ (DA-6), `Nr. 017`, kleine Wortmarke, Linie vom Schild zur Wortmarke; verkaufte Stücke mit Stempel „sold“. Standard-OG-Bild (Papier-Raster, Planet-Marke, Wortmarke, Zeile „Tattoos & Unikate aus Berlin“, Coco-Platzhalter) für alle übrigen Seiten, DE/EN; Rückfall `public/og/default.png`. Schriften als **TTF** in `src/og/fonts/` (DESIGN §12.6, ARCHITEKTUR §2.1): Mansalva 400 und Bricolage Grotesque statisch 600 (satori liest weder WOFF2 noch variable Schriften). `pnpm fonts:copy` (`scripts/fonts/`) erzeugt sie offline per Konvertierung aus den WOFF2-Dateien der Pakete `@fontsource/mansalva` und `@fontsource/bricolage-grotesque` (statische Schnitte; kommt als Dev-Abhängigkeit dazu, die Website nutzt weiter die variable Fassung aus P2.4) mit der exakt gepinnten npm-Dev-Abhängigkeit `wawoff2` (WOFF2 → TTF, in ARCHITEKTUR §1.2 eintragen); **kein** Download von `fonts.gstatic.com` oder einem anderen Host. Das Skript prüft die Glyphen (Umlaute, ß, €, „“); die Dateien gehen nie an den Browser. Erneuerung über Tag `product:<id>`; `og:image:alt`, `og:image:width`, `og:image:height` gesetzt.
  - Akzeptanz:
    - Für jedes öffentliche Seed-Stück liefert die OG-Route 200, `image/png`, 1200×630; `sold` zeigt den Stempel; `/en` den englischen Titel.
    - Beim Rendern gibt es keine Anfrage an fremde Hosts (Netzwerk-Wächter); jede Seite verweist per absolutem `og:image` auf die Route.
    - `src/og/fonts/` enthält nur `.ttf`; kein Build-Artefakt unter `public/` oder `/_next/static` enthält diese Dateien.
    - `pnpm fonts:copy` läuft ohne Netzwerk-Anfrage; ein zweiter Lauf ergibt byte-gleiche TTF-Dateien.
  - Tests: `tests/e2e/seo/og-image.e2e.spec.ts` (Playwright `request` + `sharp().metadata()`: Maße, Format, ein `sold`-Stück); `tests/unit/seo/og-text.unit.spec.ts` (Titelkürzung auf 3 Zeilen); `tests/unit/fonts/og-fonts.unit.spec.ts` (Dateityp TTF, keine variable Schrift – keine `fvar`-Tabelle –, Glyphen-Abdeckung).
  - Ohne Jutta: –.

- [x] **P3.15 Aktualität: ISR und gezielte Revalidierung** – Produkt-Hooks und Admin-Endpunkte aus P1 (`publish`, `unpublish`, `sell-offline`, `archive`, `restore`, `return-to-stock`, `adopt`, Preisänderung) sowie Änderungen an `settings` und `categories` rufen die Helfer aus `src/lib/cache/revalidate.ts` auf (ARCHITEKTUR §9.3): Statuswechsel sofort (`revalidateProduct(id, { immediate: true })` → `revalidateTag(tag, { expire: 0 })` bzw. in Server-Actions `updateTag` für `product:<id>`, `products`, `category:<key>`, `home`, `sitemap`), Bearbeitungen mit `'max'`; Segment-Rückfall `revalidate = 3600`; bei `context.seed` nichts. Neu veröffentlichte Stücke sind über `dynamicParams` sofort erreichbar.
  - Akzeptanz:
    - KONZEPT §1.6: Im Produktions-Build zeigt die Produktseite nach „offline verkauft“ (Admin-Endpunkt) spätestens nach 5 s den sold-Zustand; Shop, Kategorie und Startseite ebenso; eine Textänderung im Admin ist nach ≤ 60 s sichtbar.
    - R-031: ein geänderter Klassenpreis in `settings.shipping.rates` erscheint auf R04 nach ≤ 60 s.
    - R-033: eine Preisänderung erzeugt einen `audit-log`-Eintrag `product_price_changed` mit alt/neu (Test ergänzen, falls P1 ihn nicht hat); es gibt kein Vergleichspreis-Feld.
  - Tests: `tests/e2e/shop/revalidation.e2e.spec.ts` `@slow` gegen `E2E_SERVER=start`; `tests/int/shop/revalidate.int.spec.ts` (Spy auf `revalidateTag`, keine Aufrufe mit `context.seed`, Testname „R-033 …“).
  - Ohne Jutta: –.

- [ ] **P3.16 Qualitätsgates P3: Datenschutz, Fremd-Requests, Barrierefreiheit, Tempo, Vorschau-Datei** – die Querschnittssuiten auf alle neuen Routen (Registry-Status „gebaut“) ausdehnen: T-03 `@privacy` Request-Log (nur eigener Origin, `data:`, `blob:`) und T-04 je Route in DE und EN in den Projekten `desktop`, `iphone-15`, `pixel-7`; CSP-Verstöße lassen Tests scheitern; T-11 axe (0 × `serious`/`critical`) für R02, R03, R05 und R04 je Kategorie und Zustand (reserviert, sold, 404-Variante) plus Tastatur-Durchlauf; T-12 visuelle Referenzen (Shop, Produktseite mobil/desktop, Archiv, 404-Variante) – alle neuen Referenzbilder der Phase (auch aus P3.4) entstehen in einem CI-Lauf mit `[ci:update-snapshots]` (Artefakt → `gh run download` → Commit mit `[skip ci]`), nie in der Sandbox; T-10 Lighthouse-CI für R02 und R04; T-09 JS-Budget; Bild-Budgets als Bericht; Verbotsmuster-Scan (V-02, V-08, V-13, V-16, V-17, V-19, V-20; R-139 Instagram nur als Link) über alle gerenderten P3-Seiten; i18n-Parität (T-06); Vorschau-Export: R02–R05, Varianten-URLs und alle Seed-Produktseiten sind enthalten, Galerie/Lightbox/Schild-Schwingen/„In den Korb“-Demo laufen im Modus `preview` ohne `fetch`.
  - Akzeptanz:
    - EK-01 für R02 und R04 (LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms), JS beim ersten Laden R02–R05 ≤ 150 KB gz; EK-04, EK-05, EK-07, EK-09 (P3-Teil).
    - EK-11: `pnpm preview:export && pnpm test:preview-export` grün, der Bericht führt R02–R05 als gebaut.
    - R-001: der Nachverfolgbarkeits-Test findet Tests für R-030, R-031, R-033, R-035, R-040, R-043 bis R-049, R-096, R-126, R-130, R-139.
  - Tests: Erweiterung von `tests/e2e/privacy/`, `tests/e2e/a11y/`, `tests/e2e/legal/forbidden.e2e.spec.ts`, `tests/visual/`, `tests/perf/budgets.json` und `tests/perf/lighthouserc.cjs`.
  - Ohne Jutta: Tempo wird mit den 640-px-Seedbildern gemessen; nach dem Instagram-Export (P8/P11) erneut messen.

### Phasen-Abnahme

- [ ] Alle Aufgaben P3.1–P3.16 abgehakt; `pnpm check`, `pnpm test:int`, `pnpm build` und `pnpm test:e2e` (Projekte `desktop`, `iphone-15` mit WebKit, `pixel-7`) in der Sandbox grün. Nur wenn die WebKit-Installation in der Cloud scheitert, läuft `iphone-15` mit `PW_SKIP_WEBKIT=1` als markierte Chromium-Emulation (Vermerk im PR); die CI führt WebKit immer aus.
- [ ] CI grün: Zwischen-Commits dieser Phase tragen `[skip ci]`, höchstens ein Zwischenlauf mit `[ci:full]` (ARCHITEKTUR §6.7). Alle Code- und Fachdoku-Änderungen der Phase stehen im letzten Commit ohne `[skip ci]`, z. B. `chore(P3): finish phase [ci:full p3]`; für ihn sind `ci.yml`, `ci-full.yml` (inkl. `@a11y`, `@privacy`, `@perf`, visuelle Tests, Lighthouse) und `preview-export.yml` grün. Das Häkchen setzt erst nach dem grünen Lauf ein reiner Doku-Commit (nur `PLAN.md`, `docs/FORTSCHRITT.md`, `docs/OFFENE-PUNKTE.md`) mit `[skip ci]`.
- [ ] Vorschau-Artefakt `planet-claire-vorschau-p3-<sha7>` gebaut; es zeigt Shop, Kategorien, Archiv, alle Seed-Produktseiten und die „In den Korb“-Demo.
- [ ] Routen-Registry: R02, R03, R04, R05, R31 gebaut; AK-2-01 und AK-2-05 grün.
- [ ] Dokumentation (vor dem Phasen-Lauf committet): Ergebnis Spike B-05 in ARCHITEKTUR Anhang B (ggf. ADR); neue Annahmen in `docs/OFFENE-PUNKTE.md` (Datum, Aufgabe, Annahme, Änderungsweg), z. B. Platzhalter der harmonisierten Mitteilung (falls nötig).
- [ ] Auf keiner P3-Seite: Cookie vor „In den Korb“, Fremd-Request, „inkl. MwSt“, Streichpreis oder Widerrufsausschluss (Suiten grün).
- [ ] `docs/FORTSCHRITT.md`: Eintrag für Jutta in einfachen Worten (was sie in der Vorschau-Datei jetzt sieht, wie „In den Korb“ wirkt); PR-Beschreibung aktualisiert (Aufgaben, AK-Nachweise, Tests, Link zum Vorschau-Artefakt).

## P4 – Warenkorb, Kasse, Bezahlen

**Ziel:** Vom Produktlink zur bezahlten Bestellung in höchstens vier Seiten (Produkt → Korb → Kasse → Danke), rechtssicher und ohne Doppelverkauf: Warenkorb mit automatischer Versandklasse und Abholung, Ein-Seiten-Kasse mit Übersicht direkt über dem Knopf „Zahlungspflichtig bestellen“, atomare 30-Minuten-Reservierung mit Coco-Countdown, Zahlung über einen Adapter mit Mock-Treiber und Stripe-Treiber (Checkout Sessions, `ui_mode: 'elements'`, nur Karte/Wallets und PayPal), idempotente und signaturgeprüfte Webhooks, automatische Erstattung, wenn ein bezahltes Stück schon weg ist, Streitfälle (Anfechtungen) mit eigenem Bestellstatus, Vorkasse mit IBAN-Mail, Erinnerung nach 72 h und automatischer Stornierung, Admin-Knopf „Zahlung erhalten“, Danke-Seite und Bestellstatus per geheimem Link, lückenlose Rechnungsnummern mit unveränderlichen PDFs und die Transaktionsmails mit den Rechtstext-PDFs der Bestellfassung. Alles läuft ohne Konten mit dem Mock; der Stripe-Testmodus ist optional.

**Voraussetzungen:** P3 abgeschlossen (Datenschicht, `PriceNote`/`MoneyAmount` und Bausteine aus `src/lib/legal/snippets.ts`, `addToCart` + Cookie `pc_cart`, `product-status`, Revalidierungs-Helfer). Aus P1: Collections `checkouts`, `reservations`, `orders` samt Übergangstabellen `src/lib/commerce/checkoutTransitions.ts` und `orderTransitions.ts` (P1.20), `invoices`, `invoice-counters` mit `src/lib/commerce/invoiceNumber.ts` (P1.21), `webhook-events`, `email-log`, `consent-log`, `legal-texts` (6 aktive Platzhalter-Fassungen mit `origin = placeholder`, Renderer `src/lib/legal/render.ts`, `getActive.ts`), `documents`, `private-uploads`; `src/lib/tax/` (`getTaxModeAt`, `computeTax`); Postgres-Objekte DATENMODELL §9 (partielle UNIQUE-Indizes, Beleg-Trigger, Sequenzen `order_number_seq` u. a.); Jobs-Queue mit Job-Wecker (`GET /api/cron/tick`, `POST /api/cron/run/[task]`, `jobAlarm.bump`, Spike B-09); E-Mail-Adapter mit Treibern `file`/`memory`, Outbox-Helfer `src/lib/email/outbox.ts` und `tests/helpers/outbox.ts`; `src/lib/security/rateLimit.ts`, `keys.ts`, `tokens.ts`; Logger `src/lib/monitoring/logger.ts`; `seedToken(seedKey, purpose)` in `src/lib/seed/tokens.ts` (SEED-SPEC §2.5; `purpose` `checkout` bzw. `status`); aus P1.30 nur die offene Beispiel-Kasse KS2 – die Beispiel-Bestellungen O01–O14 mit ihren Kassen legt P8.4 an. Bis dahin gilt die Regel „Seed-Anker vor P8“ aus P3: Tests dieser Phase, die O01–O14 oder Seed-Belege nennen, laufen gegen gleichartige Fixtures (Kasse/Bestellung `seed = true` mit Stücken 980–999, angelegt über `createOrderFromCheckout`, Token aus `createToken()`), die Kriterien lauten „Fixture analog O14 …; mit dem echten Anker prüft P8.21“; AK-SEED-08, AK-SEED-20 und die Danke-/Status-URLs aus `seedToken` prüfen P8.4 und P8.21 gegen die echten Anker. Tests, die Stücke reservieren oder kaufen, nutzen nie Seed-Stücke (ARCHITEKTUR §7.2). Aus P2: CSP-Kontexte, Leinen-Presets `calm`/`thanks`, Coco-Platzhalter-Sprite, Formular-Bausteine KO-12, Vorschau-Export.

**Grundsätze dieser Phase** (Quelle jeweils in Klammern; die Fachdokumente sind maßgeblich):
1. **Bestell-Lebenszyklus** (KONZEPT §4, §5.2, §5.3; DATENMODELL §6.8.5, §6.25): Vor der Zahlung existiert nur die **Kasse** (`checkouts`, Zustände `open`, `confirming`, `completed`, `expired`, `cancelled`, `failed`). Der Klick auf „Zahlungspflichtig bestellen“ speichert an der Kasse Zeitpunkt (`submittedAt`), alle Eingaben, die angezeigten Preise (Snapshot), `legalTextVersions` und `legalSnippetVersions` – damit ist R-065 erfüllt. Die **Bestellung** entsteht nur über `createOrderFromCheckout()`: bei Karte/PayPal erst in `fulfillCheckout` nach bestätigter Zahlung (`paid`, O1; fehlen alle Stücke: `refunded`, O19), bei Vorkasse sofort (`awaiting_prepayment`, O2). Abgebrochene, abgelaufene oder gescheiterte Bezahlvorgänge bleiben Kassen-Zustände; eigene Bestellstatus dafür gibt es nicht.
2. **Streitfälle** (KONZEPT §5.3 O16–O18, DATENMODELL §6.8.5): `charge.dispute.created` → Status `disputed` mit `statusBeforeDispute` (nur Stripe-Zahlungen); gewonnen → zurück auf `statusBeforeDispute` (O17); verloren → `refunded` mit Gutschrift, ohne M09 (O18).
3. **Stripe-Zuordnung** (ARCHITEKTUR §3.1 Nr. 6, §3.5; KONZEPT §4.7): `client_reference_id` und `metadata.checkoutRef` = `checkouts.reservationRef`, dazu `metadata.appEnv`; Idempotenz-Schlüssel `checkout:<checkoutRef>:<stripe.sessionSeq>`; der Kassen-Token erreicht Stripe nur über die `return_url`.
4. **Tokens** (ARCHITEKTUR §8.6, DATENMODELL §6.8.2, §6.25.2): Kassen- und Status-Token je 32 Zufallsbytes base64url (43 Zeichen), gesucht und verglichen nur über den SHA-256-Hash (hex, konstante Zeit), nie aus `PAYLOAD_SECRET` abgeleitet, nie geloggt; den Status-Token legt P4.1 zusätzlich versiegelt ab, damit spätere Mails denselben Link enthalten.
5. **Cookies** (ARCHITEKTUR §8.7): `pc_cart` wie in P3.11; `pc_checkout` = Kassen-Token, `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`, entsteht nur durch „Zur Kasse“ (POST).
6. **Kassenfelder** (R-061, KONZEPT §4.4, DATENMODELL §6.25.1): ein Feld „Vor- und Nachname“, kein Telefon-, Firmen-, Anrede-, Konto- oder Newsletter-Feld, Land fest Deutschland; Rechnungsadresse bei Versand nur über das nicht angehakte „Rechnungsadresse weicht ab“, bei Abholung immer Pflicht (Standard bis Kanzleifrage K-07, KA-31).
7. **Mails** (DATENMODELL `EMAIL_TEMPLATES`, KONZEPT §6): Schlüssel im Code, KONZEPT-IDs nur zur Anzeige – M01 `order_confirmation`, M02 `prepayment_instructions`, M03 `prepayment_reminder`, M04 `prepayment_cancelled`, M05 `prepayment_received`, M10 `oversold_apology`, A01/A02 `admin_order_placed`, A03 `admin_prepayment_cancelled`, A06 `admin_oversold`, A07 `admin_dispute_opened`, A08 `admin_refund_failed`, A12 `admin_alert`; Empfänger der Admin-Mails `settings.adminNotificationEmail`. M06/M07/A09/A11 folgen in P5, M08/M09/A04/A10/A13 in P6, M11/A05 in P7.
8. **Belege** (R-067, ARCHITEKTUR §8.3, C-24): Rechnungen und Gutschriften gibt es nie über einen Kunden-Token – nur als Mail-Anhang und in der Verwaltung.

**Referenzen:** E-02, E-04, E-10, E-20, E-21, E-22, E-23, E-24, E-25, E-27, E-29, E-30, E-31, E-40, E-41, E-43, E-44, E-92, E-98; R-013, R-030, R-031, R-035, R-036, R-048, R-049, R-060, R-061, R-062, R-063, R-064, R-065, R-066, R-067, R-070, R-071, R-080, R-081, R-084, R-101, R-102, R-120, R-121, R-126, R-130, R-131, R-137, R-138, V-01, V-02, V-03, V-09, V-11, V-17, V-21, V-22, V-23, V-31; KONZEPT §1.4 (EK-02, EK-03, EK-04, EK-05), §1.5, §3.6, §3.7, §3.8, §3.9, §3.15, §4.1–4.14, §5.2, §5.3, §6.1–6.4, §8.1, §8.2, §12.5, §12.7; DATENMODELL §1.5, §4, §6.7, §6.8, §6.9, §6.10, §6.12, §6.22, §6.23, §6.24, §6.25, §6.28, §7.1, §8.1–8.8, §9, §10, §11; ARCHITEKTUR §2.1, §2.4, §2.5, §3.1–3.5, §3.9, §4.3, §7.2, §7.4 (T-01, T-02, T-04, T-08, T-16, T-18, T-19, T-20, T-21), §8.1, §8.3, §8.5, §8.6, §8.7, §8.11, §9.3, §9.6, §9.7, §15.1, §15.4, Anhang A, Anhang B (B-07), Anhang C (C-05, C-24); DESIGN KO-11 („Bestellen (ruhig)“), KO-12, KO-13, KO-14, KO-15, KO-16, KO-17, KO-19, §9.7 (`calm`, `legal`, `thanks`), §9.12, §11.5 (MI-01, MI-03, MI-08, MI-09); LOESCHKONZEPT L-02, L-03, L-05; DIENSTE §3.5 + CSP-YAML; SEED-SPEC §2.5, §7, §9, §17; CLOUD-SETUP §3.9.

### Aufgaben

- [x] **P4.1 Bestellanlage aus der Kasse: `createOrderFromCheckout()`, Tokens, Schema-Abgleich** – Schema und Übergangstabellen stammen aus P1.20. Zuerst prüfen, dass `checkouts` und `orders` genau DATENMODELL §6.25.1 und §6.8.1 entsprechen (u. a. `checkouts.reservationRef`, `stripe.sessionSeq`, `mock.state`, `legalSnippetVersions` an Kasse **und** Bestellung, `orders.checkout` UNIQUE, `statusTokenSealed`, `statusBeforeDispute`, `statusHistory`) und `src/lib/enums.ts` die Werte aus DATENMODELL §4 führt (`CHECKOUT_STATUSES`, `CHECKOUT_CLOSE_REASONS`, `ORDER_STATUSES` mit 13 Werten, `REFUND_REASONS` inkl. `item_unavailable` und `dispute`, `EMAIL_TEMPLATES`); fehlt etwas, ergänzt die Migration `p4_checkout` genau das Fehlende. Dann: (a) `src/lib/security/tokens.ts` – `createToken()` (32 Zufallsbytes aus `crypto.randomBytes`, base64url, 43 Zeichen), `hashToken(token)` (SHA-256 hex), `matchesHash(token, hash)` (Vergleich in konstanter Zeit); dieselbe Hash-Funktion nutzt der Seed für die Token aus `seedToken(seedKey, purpose)`. (b) **Status-Link in späteren Mails** (DATENMODELL §6.8.2, ARCHITEKTUR §8.6): Damit jede Kund:innen-Mail und die Danke-Seite denselben Status-Link enthalten (R-067), obwohl nur über `statusTokenHash` gesucht wird, legt die Bestellanlage den Token zusätzlich **versiegelt** im Feld `orders.statusTokenSealed` ab (Schema aus P1.20; AES-256-GCM mit dem HKDF-Schlüssel `pc:status-token-seal:v1` aus `src/lib/security/keys.ts`, der Token selbst bleibt zufällig); `src/lib/security/tokens.ts` bekommt `sealToken`/`unsealToken`; `retentionOrderMinimize` (Stufe B) und die Anonymisierung leeren das Feld zusammen mit dem Hash; scheitert das Entsiegeln (z. B. nach Tausch von `PAYLOAD_SECRET`), erzeugt der Dienst einen neuen Token wie „Statuslink neu senden“ (neuer Hash + neues Siegel, Audit) und verwendet ihn in der gerade entstehenden Mail; der Seed legt ab P8.4 für Beispiel-Bestellungen Hash und Siegel aus `seedToken('orders:<Key>', 'status')` an; Bestellungen mit `seed = true` werden nie automatisch rotiert (DM-36; hier geprüft mit einer Fixture-Bestellung `seed = true`, AK-SEED-20 mit den echten Beispiel-Bestellungen prüft P8.4). (c) `src/lib/commerce/createOrderFromCheckout.ts` – `createOrderFromCheckout(req, checkoutId, { transition: 'O1' | 'O2' | 'O19', payment, now })` läuft in der Transaktion des Aufrufers und ist die **einzige** Stelle, die Bestellungen anlegt: `orderNumber` aus `order_number_seq` (`PC-JJJJ-NNNNN`, Jahr Europe/Berlin), Status `paid` (O1) bzw. `awaiting_prepayment` (O2) bzw. `refunded` (O19), `checkout`, `locale`, `items` aus dem Kassen-Snapshot (inkl. `characteristicsDe/En`, `deviationText`, `deviationAgreedAt` aus `deviationAgreements`, `coverImage`, `coverImageUrl`, `foodContact`), Summen, `shippingZone`/`shippingClass`, `taxModeAtOrder` = `getTaxModeAt(settings, submittedAt)`, `fulfillmentMethod`, Adressen, `customer.email`, `customer.name` (= `billingAddress.name` bzw. `shippingAddress.name`), `carrierEmailConsent`, `legalTextVersions`, `legalSnippetVersions`, `timestamps.placedAt` = `checkouts.submittedAt`, neuer Status-Token (Hash + Siegel, `statusTokenIssuedAt`), erster `statusHistory`-Eintrag (`from` leer, `to`, `at`, `actorType`, `transition`), Audit `order_created`; setzt `checkouts.order`. Rückgabe `{ order, statusToken }` (der Klartext-Token geht nur an die Mail-Daten im Speicher, nie in Logs).
  - Akzeptanz:
    - `pnpm payload migrate` auf leerer DB grün (falls eine Migration nötig war); `pnpm check:migrations` (Drift) grün; `pnpm generate:types` ohne `any`, `src/payload-types.ts` committet.
    - DM-ORD-02: Nach der Anlage lassen sich `items`, Summen, `legalTextVersions` und `legalSnippetVersions` per Local API nicht ändern.
    - Nach Anlage einer Kasse und einer Bestellung enthält weder die DB noch ein Log den Klartext eines Kassen- oder Status-Tokens (DM-CHK-01, R-067); `unsealToken(statusTokenSealed)` ergibt einen Token, dessen Hash `statusTokenHash` ist.
    - `createOrderFromCheckout` lehnt eine Kasse ohne `submittedAt` und eine Kasse mit gesetztem `order` ab; zwei parallele Aufrufe für dieselbe Kasse ergeben genau eine Bestellung (UNIQUE `orders.checkout_id`).
    - Statischer Scan: `orders` werden außerhalb von `createOrderFromCheckout.ts` und dem Seed nirgends angelegt (`payload.create({ collection: 'orders' …})`).
  - Tests: `tests/unit/security/tokens.unit.spec.ts` (43 Zeichen base64url, Hash, konstanter Vergleich, Siegeln/Entsiegeln, falscher Schlüssel → Fehler); `tests/int/commerce/create-order.int.spec.ts` (O1, O2, O19 aus einer vorbereiteten Kasse, Snapshot-Treue, `statusHistory`, Parallelität, Rotation bei defektem Siegel, keine Rotation bei `seed = true`); `tests/unit/static/order-create.unit.spec.ts`.
  - Ohne Jutta: –.

- [x] **P4.2 Rechenkern: Versand, Summen, Steuer, Fristen, GiroCode** – reine Funktionen ohne DB, `now` immer als Parameter (ARCHITEKTUR A-08): `src/lib/commerce/shipping.ts` (`computeShipping(items, method, settings)` aus P1.20 vervollständigen: Klasse mit dem höchsten `SHIPPING_CLASS_RANK`, Preis aus `settings.shipping.rates` Zone DE, `pickup` = 0, `nur_abholung` erzwingt `pickup` und lehnt `shipping` ab mit „Nr. 023 gibt es nur zur Abholung“; Land nur aus `settings.shipping.enabledCountries`, GB/US nie (R-060); Anzeigename „DHL Paket (Keramik)“ bzw. „Abholung in Berlin“), `src/lib/commerce/totals.ts` (`computeTotals`, unabhängig von der Zahlart, R-070), `computeTax` in `src/lib/tax/` (P1.21) um die Versandaufteilung ergänzen (KU → keine Steuerzeilen; Regelbesteuerung → Netto = `round(brutto / (1 + Satz))` je Satz, Versand anteilig nach Warenwert, KONZEPT §4.14, KA-10), `src/lib/commerce/deadlines.ts` (einzige Stelle für Fristen, ARCHITEKTUR §2.1: `reservationTimes(t0, settings)` = `displayExpiresAt` T0 + `reservationMinutes`, Stripe-Ablauf + 1 min, `expiresAt` = Stripe-Ablauf + 5 min nach DATENMODELL §8.1; `prepaymentDeadlines(placedAt, settings)` → `{ dueAt, reminderDueAt }` nach DATENMODELL §8.5: `dueAt` = 23:59:59 Europe/Berlin am `prepaymentDays`-ten Kalendertag nach dem Berliner Bestelltag, `reminderDueAt` = `placedAt` + `prepaymentReminderHours`), `src/lib/commerce/epc.ts` (`buildEpcPayload({ bic, name, iban, amountCents, reference })` nach EPC069-12, Verwendungszweck = Bestellnummer; `formatIban` in 4er-Gruppen), `src/lib/commerce/qr.ts` (EPC-QR als PNG-Buffer und SVG mit `qrcode` 1.x, exakt gepinnt).
  - Akzeptanz:
    - AK-4-01 (Brief + Keramik → 890 bei `shipping`, 0 bei `pickup`); AK-4-02 (Funktion lehnt `shipping` mit `nur_abholung` ab); R-060 (Land AT bei nur DE → Fehler).
    - AK-8-02/DM-ORD-06-Zeiten: Bestellung Sa 26.09.2026 10:00 Berlin → `reminderDueAt` Di 29.09.2026 10:00, `dueAt` Do 01.10.2026 23:59:59 Berlin (21:59:59 UTC); R-071-Beispiele 12.10. → 17.10. 23:59:59 und 22.10. → 27.10. 23:59:59 MEZ (22:59:59 UTC, über den Wechsel auf Winterzeit).
    - `reservationTimes` mit T0 = 10:00:00 → `displayExpiresAt` 10:30, Stripe-Ablauf 10:31, `expiresAt` 10:36.
    - AK-4-15 (Rechenteil): im KU-Modus kein Steuerbetrag; Regelbesteuerung mit 19/7 % und Versandaufteilung, Netto + Steuer = Brutto centgenau; R-070 (gleicher Gesamtbetrag für jede Zahlart).
    - EPC-Payload eines Beispiels ist byte-gleich mit einer Referenz-Zeichenkette (Betrag „EUR53.90“).
    - Der EPC-QR ist maschinell lesbar: PNG und SVG (mit `sharp` gerastert) werden im Test mit `jsqr` dekodiert und ergeben byte-gleich die Payload aus `buildEpcPayload`.
  - Tests: `tests/unit/commerce/{shipping,totals,deadlines,epc,qr}.unit.spec.ts` (`jsqr` als exakt gepinnte devDependency), `tests/unit/tax/compute-tax.unit.spec.ts` (Testnamen „R-060 …“, „R-070 …“, „R-071 …“); im `ci-full` zusätzlich ein Lauf mit `TZ=Europe/Berlin`.
  - Ohne Jutta: –; die Versandaufteilung bei Regelbesteuerung (KA-10) bleibt eine Frage an die Steuerberatung.

- [ ] **P4.3 Seite „Versand & Zahlung“ (R25)** – `src/app/(frontend)/[locale]/shipping-and-payment/page.tsx` (DE `/de/versand-und-zahlung`) ersetzt das P2-Gerüst: Einleitung (aktive `legal-texts`-Fassung Typ `versand-zahlung`, sonst gekennzeichneter Platzhalter), `ShippingTable` aus `settings.shipping.rates` Zone DE (Klasse, wofür, Preis, Versanddienst) + Zeile „Abholung in Berlin – 0,00 €“ – dieselbe Quelle wie `computeShipping` (E-25); Regel „mehrere Stücke: es zählt die höchste Versandklasse“; Lieferzeit (E-31); Liefergebiet (nur Deutschland, Abholung nach Absprache, Ausland derzeit nicht); Zahlarten (Karte, Apple Pay, Google Pay, PayPal über Stripe; Vorkasse per Überweisung, Stück bis zum Ende des 5. Kalendertags reserviert); wann abgebucht wird; Transportschaden-Hinweis mit „deine gesetzlichen Rechte bleiben davon unberührt“; Rücksendekosten bei Widerruf trägt die Kund:in (E-27); Link R24; `WarrantyNotice`; Preset `legal`; Platzhalter-Tokens der Rechtstext-Fassung über den Renderer aus P1 (`src/lib/legal/render.ts`, kanonische Liste R-012, keine Aliase; `{{shippingTable}}`, `{{deliveryTime}}`, `{{vorkasseDays}}` aus `settings`); jede Fassung mit `origin ≠ lawyer` zeigt „PLATZHALTER – nicht rechtsverbindlich“ (R-002); Erneuerung über Tag `settings`. Route R25 in der Registry auf „gebaut“.
  - Akzeptanz:
    - AK-3-10 (R25-Teil) und R-031: ein neuer Klassenpreis in den Einstellungen erscheint nach ≤ 60 s; R-035, R-049.
    - V-10, V-11, V-12, V-19, V-21 ohne Treffer.
  - Tests: `tests/e2e/legal/shipping-page.e2e.spec.ts` („R-031 …“, „R-049 …“; Einstellungen per Local API ändern); `@a11y`.
  - Ohne Jutta: Kanzleitext fehlt → Platzhalter-Fassung aus dem Grund-Seed mit Kennzeichnung; P11: Kanzleitext (AUFGABEN A28, R-002).

- [x] **P4.4 Zahlungs-Adapter: Schnittstelle und Mock-Treiber** – `src/lib/payments/types.ts` exakt nach ARCHITEKTUR §3.5 (`CreateCheckoutSessionInput` mit `checkoutRef` = `checkouts.reservationRef`, `metadata` = `{ checkoutRef, appEnv }`; `CheckoutSessionHandle`, `SessionState`, `ExpireResult`, `PaymentEvent`, `PaymentsAdapter`). `SessionState.clientSecret?` (ARCHITEKTUR §3.5): die Kasse speichert das Client-Secret nicht (DATENMODELL §6.25.1), sondern holt es bei jedem Seitenaufruf serverseitig über `getCheckoutSession`; fehlt es bei einer offenen Session, wird die Session mit derselben Reservierung neu angelegt (`stripe.sessionSeq + 1`, wie `recreate_required`). `src/lib/payments/index.ts` (`getPaymentsAdapter()`, `__setPaymentsAdapterForTests`), Mock unter `src/lib/payments/mock/`: IDs `cs_mock_…`, `pi_mock_…`, `re_mock_…`, `evt_mock_…`, `clientSecret = mock_secret_…`; Zustand in `checkouts.mock.state` (DB, nicht Prozess-Speicher: `open`/`complete`/`expired`, `paymentStatus`, nächstes Test-Ergebnis, Zahlart `card`/`paypal` mit optionaler Wallet-Kennung `apple_pay`/`google_pay`); Ereignisse aus `tests/fixtures/stripe/*.json` mit ersetzten Werten → dieselbe Normalisierung wie beim Stripe-Treiber und Ablage in `webhook-events` mit `provider = 'mock'`; Signatur als HMAC mit dem HKDF-Schlüssel `pc:mock-webhook:v1` im Header `x-pc-mock-signature`; Test-API `mockPayments.emit(sessionId, type)` und `mockPayments.setNextOutcome(...)` nur bei `APP_ENV ∈ {development, test}`; `refund` liefert `succeeded` oder das vorgegebene Ergebnis; `listBalanceTransactions` aus einer Fixture. `assertProductionEnv` (ARCHITEKTUR §4.3): `PAYMENTS_DRIVER=mock` in Produktion → Abbruch; `sk_live_`/`rk_live_` außerhalb von Produktion → Abbruch. Fixtures (bereinigt, ohne echte Kundendaten, Form der gepinnten API-Version): `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`, `refund.created`, `refund.updated`, `refund.failed`, `charge.dispute.created`, `charge.dispute.closed`; Skript `pnpm stripe:fixture <name>` prüft/erzeugt sie.
  - Akzeptanz:
    - Der Mock macht keine Netzwerk-Anfrage (Netzwerk-Wächter); die protokollierten Session-Parameter enthalten nur `card` und `paypal` (R-062, Teil `int`) und als Kennung nur `checkoutRef` (kein Token, keine Personendaten; ARCHITEKTUR §3.1 Nr. 6).
    - AK-1-02 und AK-A-3-02 (Treiber- und Schlüsselregeln) als Unit-Test je Regel (T-17).
    - Die Kontrakttest-Reihe läuft gegen `mock` vollständig grün: anlegen, abfragen (inkl. `clientSecret`), beenden (`expired`, `already_expired`, `already_complete_paid`, `already_complete_unpaid`), Erstattung, Webhook-Parsing aller zehn Fixtures, falsche Signatur → `InvalidSignatureError`.
    - Zwei Prozesse (zwei Adapter-Instanzen) sehen denselben Mock-Zustand, weil er in der DB liegt.
  - Tests: `tests/int/adapters/payments.contract.int.spec.ts`; `tests/unit/payments/normalize.unit.spec.ts` (Fixture → `PaymentEvent`); `tests/unit/env/production-rules.unit.spec.ts` erweitern.
  - Ohne Jutta: –.

- [x] **P4.5 Stripe-Treiber, Spike B-07 und Kassen-CSP** – Spike B-07 zuerst (Doku der gepinnten API-Version + stripe-mock bzw. Testmodus; Ergebnis in ARCHITEKTUR Anhang B; Rückfall `recreate_required`). `stripe` 22.x und `@stripe/stripe-js` 9.x exakt pinnen; `src/lib/payments/stripe/config.ts` mit `STRIPE_API_VERSION` = Version des gepinnten SDK. Treiber nach ARCHITEKTUR §3.5: `ui_mode: 'elements'`, `mode: 'payment'`, `currency: 'eur'`, `payment_method_types: ['card', 'paypal']` (keine `payment_method_configuration`), `expires_at`, `client_reference_id` = `checkoutRef`, `metadata = { checkoutRef, appEnv }`, `locale`, `return_url` = `{NEXT_PUBLIC_SITE_URL}/de/danke/{token}` bzw. `/en/thank-you/{token}`, genau eine `shipping_options[0].shipping_rate_data` mit `fixed_amount`; kein `success_url`/`cancel_url`/`submit_type`/`after_expiration`/Tax/Link; Idempotenz `checkout:<checkoutRef>:<stripe.sessionSeq>` und `refund:<orderId>:<refundSeq>`; `maxNetworkRetries: 2`, `timeout: 10000`; `STRIPE_API_BASE_URL` für stripe-mock (in `src/lib/env.ts` und `.env.example` sicherstellen); `parseWebhook` mit `STRIPE_WEBHOOK_SECRET`; `updateShipping` laut Spike. CSP-Kontext `checkout` in `src/lib/security/csp.ts`: Stripe-Hosts exakt aus der DIENSTE-YAML und nur bei `PAYMENTS_DRIVER=stripe`; `Permissions-Policy: payment=(self "https://js.stripe.com")`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`. Statischer Scan (R-062): `@stripe/stripe-js` nur als `@stripe/stripe-js/pure` und nur unter `src/components/checkout/`.
  - Akzeptanz:
    - Die Kontrakttest-Reihe aus P4.4 läuft zusätzlich gegen `stripe` + stripe-mock (`docker compose --profile payments up -d`), wenn erreichbar, sonst `skip` mit Hinweis; mit `sk_test_…` zusätzlich Anlegen/Abfragen/Beenden im Stripe-Testmodus.
    - Parameter-Test: nur `card`/`paypal`, `expires_at` ≥ 30 min nach Erstellung, Metadaten nur `checkoutRef` und `appEnv`, kein Token außer in `return_url`.
    - T-16: CSP-Hosts ⊆ DIENSTE-YAML je Kontext; mit `mock` enthält die Kassen-CSP keinen Stripe-Host.
    - Spike B-07 mit Ergebnis, Datum und PR dokumentiert.
  - Tests: `tests/unit/payments/stripe-params.unit.spec.ts` (Parameterbau ohne Netz); `tests/unit/security/stripe-imports.unit.spec.ts` („R-062 …“); `tests/unit/security/csp.unit.spec.ts` erweitern; Treiberschleife in `tests/int/adapters/payments.contract.int.spec.ts`.
  - Ohne Jutta: kein Stripe-Konto nötig (stripe-mock und Fixtures). P11 (AUFGABEN A23, A24, A33, A38): Stripe-Konto verifiziert, PayPal verbunden, Webhook-Endpunkt `/api/stripe/webhook` mit **derselben** API-Version und den Ereignissen aus KONZEPT §4.10, nur Karte und PayPal aktiv, Stripe Link und Stripe-Kundenquittungen aus, Apple-Pay-Domain registriert, Live-Schlüssel nur in Vercel.

- [x] **P4.6 Reservierung und Kassenstart (Services und „Zur Kasse“)** – `src/lib/commerce/reservation.ts` und `src/lib/commerce/checkout.ts`, `startCheckout({ cart, locale, existingToken, now })`: (1) Shop geöffnet (`settings.shop.isOpen`), Korb prüfen (öffentlich; höchstens `settings.shop.maxItemsPerCheckout` Stücke, sonst Meldung „Höchstens {n} Stücke pro Bestellung“); eine offene Kasse desselben `pc_checkout` mit gleicher Stückliste wird wiederverwendet, nie verlängert (S14), sonst wird die alte Kasse `cancelled` (`closeReason = replaced`) und freigegeben; (2) „lazy release“ nach DATENMODELL §8.1: abgelaufene Reservierungen (`reserved_until < $now`) der angefragten Stücke vorher wie im Task behandeln – Session beim Anbieter beenden, bei `already_complete_paid` keine Freigabe, sondern `fulfillCheckout` (die Übergabe verdrahtet P4.16a; bis dahin bleibt das Stück reserviert und der Start meldet „gerade reserviert“); (3) **eine** Drizzle-Transaktion nach DATENMODELL §8.1: erst die Kasse `open` anlegen (`tokenHash`, `reservationRef` = neue UUID v4, `locale`, `items`-Snapshot mit `titleDe/En`, `category`, `priceCents`, `vatCategory`, `shippingClass`, `characteristicsDe/En` aus `buildCharacteristics`, `deviationText`; `fulfillmentMethod` aus `pc_cart`, `shippingZone`/`shippingClass`, Summen, `expiresAt`/`displayExpiresAt` aus `reservationTimes`), dann atomares `UPDATE products … WHERE id = ANY($1) AND status = 'available' AND is_custom_commission = false RETURNING id` (weniger Zeilen → Rollback mit Liste der gesperrten Nummern) und `INSERT INTO reservations … source = 'checkout_session'`; (4) nach dem Commit Zahlungs-Session anlegen (`stripe.checkoutSessionId`, `sessionExpiresAt`, `sessionSeq = 1`, `livemode`); schlägt das fehl, bleibt die Kasse `open` ohne Session und bietet nur Vorkasse (S13); (5) `jobAlarm.bump(expiresAt)` und `revalidateProduct(id, { immediate: true })` je Stück. Weitere Dienste: `releaseReservation(ref, reason, now)` (DATENMODELL §8.2; vorher Session beenden, bei `already_complete_paid` nicht freigeben, sondern `fulfillCheckout`, verdrahtet in P4.16a) und `cancelCheckout(checkoutId, closeReason, now)` (`cart_changed` bzw. `replaced`; Freigabe `customer_cancelled`); Zustandswechsel der Kasse nur über `transitionCheckout()` aus `checkoutTransitions.ts`. Server-Action „Zur Kasse“ in `src/app/(frontend)/[locale]/cart/actions.ts` (nur POST, nie per Seitenaufruf oder Prefetch, Rate-Limit `checkout_start`): setzt `pc_checkout` (Kassen-Token aus `createToken()`; Attribute Grundsatz 5) und leitet mit 303 auf R07; Konflikt → zurück zum Korb mit „Nr. 017 ist gerade reserviert – schau in 30 Minuten nochmal.“ (S1).
  - Akzeptanz:
    - AK-4-07/T-01/EK-03: 20 gleichzeitige Kassenstarts für dasselbe Stück über 20 getrennte DB-Verbindungen → genau 1 Erfolg, 19 „gerade reserviert“, 100 Wiederholungen.
    - AK-4-08/DM-RES-02: Korb mit einem freien und einem reservierten Stück → keine Teilreservierung, das freie Stück bleibt `available`, keine Kasse angelegt; DM-RES-01/-03 bleiben grün, der CHECK `products_reserved_consistent` wird nie verletzt.
    - Nach dem Start gilt `checkouts.reservationRef` = `reservations.ref` = `products.reservationRef` und `checkouts.expiresAt` = `reservations.expiresAt` = `products.reservedUntil`.
    - S13: Adapter-Fehler beim Anlegen → Kasse `open` ohne Session, nur Vorkasse; S14: zweiter Start mit demselben Cookie und derselben Stückliste → dieselbe Kasse, keine zweite Reservierung, keine Verlängerung; geänderte Stückliste → alte Kasse `cancelled` (`replaced`), neue Kasse.
    - Geschlossener Shop → kein Kassenstart, Meldung `closedMessage`.
    - AK-A-9-02: nach einem Kassenstart gilt `nextDueAt ≤ expiresAt` im Job-Wecker.
  - Tests: `tests/int/commerce/reservation-race.int.spec.ts` (`DB_POOL_MAX ≥ 25`; bei > 2 min Laufzeit mit Tag `@slow` nur im `ci-full`); `tests/int/commerce/start-checkout.int.spec.ts` (S1, S13, S14, lazy release inkl. „bereits bezahlt“ → keine Freigabe – die Übergabe an `fulfillCheckout` prüft P4.16a –, Stück-Limit, Shop geschlossen; Uhr injiziert, A-08).
  - Ohne Jutta: –.

- [x] **P4.7 Warenkorb-Aktionen: Entfernen, Lieferart, Bewertung** – in `src/lib/commerce/cart.ts`: `readCart()` (tolerant, zod, über `decodeCartCookie`), Server-Actions `removeFromCart(productId)` (Cookie aktualisieren; leer → Cookie löschen; eine Kasse `open` wird `cancelled` mit `closeReason = cart_changed` und freigegeben, S6; bei einer Kasse `confirming` wird das Entfernen abgelehnt mit „Deine Zahlung läuft gerade“, weil DATENMODELL §6.25.3 dafür keinen Übergang kennt) und `setDeliveryMethod(method)` (`nur_abholung` erzwingt `pickup`, der Server lehnt `shipping` ab; eine laufende Kasse rechnet selbst neu, P4.10b; die Reservierung bleibt), `evaluateCart(cart, now)` für die Anzeige: je Position `available` | „Gerade reserviert – schau in 30 Minuten nochmal“ (fremde Kasse oder Vorkasse, S12) | „Leider schon verkauft“ (`sold`/nicht öffentlich) | „Preis wurde aktualisiert“ (DB-Preis ≠ `p`, KONZEPT §4.2; angezeigt und berechnet wird immer der DB-Preis), Versand und Summen über den Rechenkern, `canCheckout` (falsch bei nicht kaufbaren Positionen, mehr als `maxItemsPerCheckout` Stücken oder geschlossenem Shop). `GET /api/public/product-status` um das Feld `reservedByYou` erweitern (serverseitiger Abgleich mit der Kasse aus `pc_checkout`; ohne dieses Cookie immer `false`; die Antwort bleibt `no-store`); `product-status` zeigt damit auf der Produktseite „Du hast es gerade in der Kasse“ + Link „Zur Kasse“ (KONZEPT §3.4 Nr. 6).
  - Akzeptanz:
    - Jede Position wird serverseitig neu geprüft; das Cookie ist nur Merkliste (KONZEPT §4.2).
    - Entfernen während einer offenen Kasse → Kasse `cancelled` (`cart_changed`), Reservierung `released` (`customer_cancelled`), Stück `available` und nach ≤ 5 s öffentlich frei; ein Lieferartwechsel gibt nichts frei.
    - AK-4-02: `setDeliveryMethod('shipping')` mit einem `nur_abholung`-Stück wird abgelehnt.
    - Preisänderung nach dem Hinzufügen → Hinweis „Preis wurde aktualisiert“ und Summe mit dem neuen Preis.
  - Tests: `tests/int/commerce/cart-actions.int.spec.ts`; `tests/unit/commerce/evaluate-cart.unit.spec.ts`.
  - Ohne Jutta: –.

- [ ] **P4.8 Warenkorb-Seite (R06)** – `src/app/(frontend)/[locale]/cart/page.tsx` (DE `/de/warenkorb`; dynamisch, `noindex`, `Cache-Control: private, no-store`, CSP-Kontext `dynamic`, kein Stripe.js) nach KO-13: H1 „Dein Korb“; Positionen (Foto 64×80, Titel als Link, `Nr. 017 · Kategorie`, Preis über `MoneyAmount`, Text-Knopf „Entfernen“, Zustands-Hinweis; nicht kaufbare Zeilen gedämpft und aus der Summe ausgeschlossen); Radiogruppe „Versand innerhalb Deutschlands (DHL)“ mit Preis / „Abholung in Berlin – 0,00 €“ (bei `nur_abholung` Versand ausgegraut mit „Nr. 023 gibt es nur zur Abholung“); Zeile „Versandklasse: Keramik – die größte Klasse im Korb zählt“; Zwischensumme, Versand, **Gesamt** mit `PriceNote`; Lieferzeit (Baustein `delivery.timeShipping` bzw. `delivery.timePickup`); Baustein `cart.paymentAndDeliveryInfo` (Zahlarten als Text „Karte · Apple Pay · Google Pay · PayPal · Vorkasse“, Liefergebiet) **oberhalb** von „Zur Kasse“; `WarrantyNotice`; Knopf „Zur Kasse“ (Primär, POST-Formular; `aria-disabled` mit Hinweis, solange `canCheckout` falsch ist; bei `settings.shop.isOpen = false` steht `settings.shop.closedMessage` über den Positionen, KONZEPT §3.6); den Countdown KO-15 bei laufender Reservierung dieser Person ergänzt P4.9 mit dem Modul `reservation-countdown`; Leerzustand KO-17 „Hier ist noch nichts drin.“ + „Zum Shop“; Preset `calm`, Coco sitzt statisch neben der Summe. Ohne JavaScript voll bedienbar (Formulare mit POST + Redirect). Route R06 in der Registry auf „gebaut“.
  - Akzeptanz:
    - R-036: Zahlarten und Liefergebiet stehen im DOM vor dem Kassenknopf; R-035 Lieferzeit sichtbar; R-031 Versandkosten konkret beziffert; R-049 sichtbar.
    - AK-DS-11: keine Animation und keine Transition im `<main>`; keine Anfrage an `*.stripe.com`/`*.stripe.network`.
    - Der Kassenknopf ist ein POST; Seitenaufruf und Prefetch reservieren nichts; ein Aufruf ohne Cookie setzt kein Cookie (EK-04).
    - Seed-Anker S01 + S11 (nur im Korb-Cookie, keine Reservierung) → Versandklasse Keramik 8,90 €, Zwischensumme 109,00 €, Gesamt 117,90 € (SEED-SPEC §17).
  - Tests: `tests/e2e/cart/cart.e2e.spec.ts` (Anzeige, Entfernen, Lieferart, Zustände reserviert/verkauft/Preis geändert mit Fixture-Stücken, Seed-Anker S01 + S11, leerer Korb, Shop geschlossen, `javaScriptEnabled: false`); `tests/e2e/legal/cart-info.e2e.spec.ts` („R-035 …“, „R-036 …“, „R-049 …“); `@a11y`.
  - Ohne Jutta: –.

- [ ] **P4.9 Kasse (R07): Formular, Countdown und Zahlungsfeld** – `src/app/(frontend)/[locale]/checkout/page.tsx` (DE `/de/kasse`; dynamisch, `noindex`, `Cache-Control: private, no-store`, CSP-Kontext `checkout`, Preset `calm`, Aufbau KO-14): ohne gültiges `pc_checkout` oder bei Kasse `expired`/`cancelled`/`completed`/`failed` → 307 auf R06 (mit Meldung). Countdown KO-15 mit dem Verhaltensmodul `src/behaviors/reservation-countdown.ts` (`data-behavior="reservation-countdown"`; Basis `displayExpiresAt` minus Client-Offset, `role="timer"` mit `aria-live="off"`, getrennte `aria-live="polite"`-Ansage nur bei 10, 5 und 1 min und Ablauf, Farbwechsel ohne Übergang; bei ≤ 5:00 „Noch 5 Minuten reserviert“, bei ≤ 1:00 „Nur noch 1 Minute“; bei 0 Satz „Deine Reservierung ist abgelaufen.“ mit Primärknopf „Nochmal reservieren“ (POST Kassenstart, KO-15) und Link „Zum Korb“, Bestellknopf `disabled`; Demo ab 30:00 im Modus `preview`). Dasselbe Modul zeigt den Countdown auch im Korb (R06, P4.8), sobald `pc_checkout` auf eine Kasse `open` oder `confirming` dieser Person mit aktiver Reservierung zeigt (KO-13; Zeitbasis `displayExpiresAt` derselben Kasse); ohne solche Kasse gibt es im Korb keinen Countdown. Abschnitte mit Ankern `#kontakt`, `#lieferung`, `#rechnung`, `#zahlart`, `#uebersicht` (Felder laut KONZEPT §4.4, Namen laut DATENMODELL §6.25.1): E-Mail `customer.email` (Hinweis „Hierhin schicken wir Bestätigung und Rechnung“); Lieferart (änderbar, Eingaben bleiben erhalten); **ein** Feld „Vor- und Nachname“ (bei Versand `shippingAddress.name`, bei Abholung `billingAddress.name`); bei Versand Straße und Hausnummer (Packstation-Hinweis), Adresszusatz, PLZ (genau 5 Ziffern), Ort, Land als Text „Deutschland“, DHL-Einwilligung `carrierEmailConsent` (Baustein `checkout.dhlEmailConsent`, optional, nicht angehakt, nur bei Versand, R-101); bei Abholung der Hinweis „Privatstudio in Berlin-{Bezirk}. Ort und Termin sprechen wir per Mail ab.“ (`settings.tattoo.studioDistrict`); Rechnungsadresse: bei Versand Checkbox „Rechnungsadresse weicht ab“ (`billingAddressDiffers`, nicht angehakt) → Felder, bei Abholung Rechnungsadresse (Straße, Zusatz, PLZ, Ort, Land fest „Deutschland“) immer Pflicht (R-061, Kanzleifrage K-07); kein Telefon-, Firmen-, Anrede-, Konto- oder Newsletter-Feld, keine Checkbox „AGB akzeptieren“; Zahlart-Radio `paymentChoice` = `stripe` („Karte, Apple Pay, Google Pay oder PayPal“) | `prepayment` („Vorkasse per Überweisung“ + Baustein `checkout.vorkasseInfo` mit dem Datum aus `prepaymentDeadlines`; nur bei `settings.payment.prepaymentEnabled`); Zahlungsfeld: `src/components/checkout/MockPaymentField.tsx` (gleiche Größe, „Testmodus – keine echte Zahlung“, Auswahl Erfolg/Abgelehnt/Abbruch (wie PayPal zurück)/Verzögert, dazu Test-Zahlart Karte/Apple Pay/Google Pay/PayPal; nie bei `APP_ENV=production`) bzw. `src/components/checkout/StripePaymentField.tsx` (dynamischer Import, `loadStripe` aus `@stripe/stripe-js/pure`, Checkout-Objekt der gepinnten Stripe.js-Version mit dem serverseitig über `getCheckoutSession` geholten Client-Secret, nur Payment Element, Appearance laut KO-12, Schrift von der eigenen Domain) bzw. mit `PREVIEW_EXPORT=true` der statische Platzhalter „Hier erscheint die Zahlungsauswahl von Stripe (Karte, Apple Pay, Google Pay, PayPal)“; Kasse ohne Stripe-Session → nur Vorkasse mit „Kartenzahlung ist gerade nicht erreichbar“ (S13; ist Vorkasse ausgeschaltet, Hinweis „Bezahlen ist gerade nicht möglich“ + Link „Zum Korb“); Hinweis im Instagram-In-App-Browser (User-Agent enthält `Instagram`, KA-25). Gemeinsames zod-Schema `src/lib/commerce/checkoutSchema.ts` (Client + Server); Fehler am Feld und als Zusammenfassung oben mit Sprunglinks (`role="alert"`, Fokus); Link zur Datenschutzerklärung am Formular (R-138); `autocomplete`-Attribute. Route R07 in der Registry auf „gebaut“.
  - Akzeptanz:
    - AK-4-06 und V-03: keine Checkbox ist beim Laden angehakt.
    - Pflichtfelder genau (R-061): E-Mail, Vor- und Nachname, bei Versand die Lieferadresse, bei Abholung die Rechnungsadresse, bei „Rechnungsadresse weicht ab“ die Rechnungsadresse; kein Anrede-, Telefon- oder Firmenfeld im DOM.
    - R-062: Stripe.js lädt nur auf R07 und nur mit `PAYMENTS_DRIVER=stripe`; mit `mock` keine Anfrage an Stripe-Hosts; kein Express-Checkout-, Link- oder Address-Element.
    - AK-DS-11: keine Animation/Transition; der Countdown ändert nur Text; Schwellen, Ansagen und Ablaufzustand sind mit `page.clock` prüfbar; AK-DS-18 für `reservation-countdown`.
    - V-17: der Countdown erscheint in Kasse und Korb nur bei einer echten Reservierung dieser Person und zeigt in beiden dieselbe Restzeit; ein Korb ohne `pc_checkout` oder nach Ablauf zeigt keinen.
    - Der Wechsel Versand ↔ Abholung behält alle Eingaben.
  - Tests: `tests/e2e/checkout/checkout-form.e2e.spec.ts` (Pflichtfelder je Lieferart, Fehlerzusammenfassung, Lieferartwechsel, Instagram-User-Agent, Countdown mit `page.clock.install`, S13); `tests/e2e/cart/cart.e2e.spec.ts` erweitern (Countdown im Korb nach „Zur Kasse“ mit Fixture-Stücken, kein Countdown ohne Kasse, „V-17 …“); `tests/e2e/legal/checkout-fields.e2e.spec.ts` („R-061 …“, „R-101 …“, „R-138 …“, V-03); `tests/unit/commerce/checkout-schema.unit.spec.ts`; `tests/unit/behaviors/reservation-countdown.unit.spec.ts` (Schwellen, Ansagen, AK-DS-18); `@a11y` (R07 leer, mit Fehlern, Abholung).
  - Ohne Jutta: Bezirk ist Platzhalter („[Bezirk folgt]“, KA-13); P11: Bezirk (AUFGABEN A26, A34), Kanzlei-Wortlaut von `checkout.dhlEmailConsent` und `checkout.vorkasseInfo`, Antwort auf Kanzleifrage K-07 (Rechnungsadresse bei Abholung).

- [ ] **P4.10 Kasse (R07): Übersicht und Bestellknopf** – Abschnitt „Übersicht“ unmittelbar über dem Knopf (KONZEPT §4.5, R-063): Positionen aus dem Kassen-Snapshot (Foto 48×60, Titel, Nr., wesentliche Eigenschaften `characteristicsDe/En`, Preis), Versand (Klasse + Preis bzw. „Abholung in Berlin 0,00 €“), Gesamtpreis mit `PriceNote`, Lieferzeit (bei Vorkasse „ab Zahlungseingang“), Lieferadresse bzw. „Abholung in Berlin“, Rechnungsadresse, E-Mail, Zahlart, bei Vorkasse die Frist – je Block Text-Knopf „Ändern“ (springt zum Anker, fokussiert das erste Feld); Baustein `checkout.legalNotice` (Wortlaut der Arbeitsfassung aus ANFORDERUNGEN §6 über `getSnippet`, P3.3; KONZEPT §4.5) mit AGB und Widerrufsbelehrung als `<dialog>` mit der aktiven Fassung (kein Seitenwechsel, kein neuer Tab; ohne JavaScript normaler Link); je Stück mit `deviationText` eine eigene Pflicht-Checkbox (Baustein `checkout.deviationAgreement`, nicht angehakt; der Knopf ist `disabled` mit sichtbarem Hinweis, solange eine fehlt); Knopf „Zahlungspflichtig bestellen“ / „Order with obligation to pay“ (KO-11 „Bestellen (ruhig)“, kein Icon, Text ändert sich nie, Statuszeile `aria-live` darunter; bei Stripe die Zeile „Bei PayPal wirst du kurz zu PayPal weitergeleitet.“). Den Absende-Dienst baut P4.10a, Lieferartwechsel und Zahlungsbestätigung baut P4.10b.
  - Akzeptanz:
    - AK-4-04/R-064: `getByRole('button', { name: 'Zahlungspflichtig bestellen', exact: true })` hat auf `/de/kasse` genau einen Treffer (EN „Order with obligation to pay“); keine verbotenen Kauf-Beschriftungen in Kasse und Produktseite.
    - AK-4-05/R-063: die Übersicht enthält vor dem Knopf alle Positionen mit Nr., Eigenschaften und Preis, Versandkosten, Gesamtpreis, Lieferzeit, Adressen, Zahlart und vier „Ändern“-Links, die zum richtigen Abschnitt springen, ohne Eingaben zu verlieren.
    - R-048 (Oberfläche): ohne Haken ist der Knopf deaktiviert und der Hinweis sichtbar.
  - Tests: `tests/e2e/checkout/overview.e2e.spec.ts` („R-063 …“, „R-064 …“, „R-048 …“; Fixture-Korb analog S01 + S11 – Keramik 45,00 € und Textil 64,00 € mit Abweichung, Versand 8,90 €, Gesamt 117,90 € –; mit den echten Ankern prüft P8.21); `tests/e2e/checkout/legal-dialogs.e2e.spec.ts`.
  - Ohne Jutta: Rechtstexte sind Grund-Seed-Platzhalter; P11: Kanzleitexte (AUFGABEN A28), Wortlaut `checkout.legalNotice`/`checkout.deviationAgreement` (Kanzleifrage K-04), EN-Knopftext (Kanzleifrage K-03).

- [ ] **P4.10a Absenden (`submitCheckout`): Eingaben und Rechtsstand an der Kasse speichern** – Server-Action `submitCheckout` (Rate-Limit `checkout_submit` je Kassen-Token) nach DATENMODELL §6.25.3: prüft Kasse `open`, `expiresAt > now` (bei `stripe` zusätzlich `stripe.sessionExpiresAt > now`), Stücke noch mit dieser `reservationRef` reserviert und Korb = Kassen-Snapshot (sonst „Dein Korb hat sich geändert“ + Link zum Korb, S6), Preise/Versand aus dem Snapshot (S7), Pflichtfelder über das gemeinsame zod-Schema, Land (R-060), Abweichungs-Bestätigungen (fehlt eine → 400). In **einer** Transaktion speichert es **an der Kasse** (keine Bestellung): `customer.email`, Adressen, `billingAddressDiffers`, `carrierEmailConsent`, `deviationAgreements[]` (`agreedAt = now`), `paymentChoice`, `legalTextVersions` (aktive Fassungen `agb`, `widerrufsbelehrung`, `widerrufsformular`, `datenschutz`, `versand-zahlung` zum Zeitpunkt `now`), `legalSnippetVersions` (Schlüssel, `version`, `sha256` jedes in der Übersicht angezeigten Bausteins, mindestens `checkout.legalNotice`, ggf. `checkout.dhlEmailConsent` und `checkout.deviationAgreement`; R-013), `submittedAt = now`; dazu `consent-log`-Einträge (`carrier_email_forwarding` nur bei Häkchen, `deviation_agreement` je Stück, jeweils mit Textsnapshot, `snippetKey`/`snippetVersion` und SHA-256). Bei `stripe`: Kasse `open → confirming` (`timestamps.confirmingAt`), `jobAlarm.bump(confirmingAt + 10 min)`; bei `prepayment` weiter mit P4.19. Ein erneutes Absenden nach einem gescheiterten Zahlungsversuch (Kasse wieder `open`) überschreibt die Eingaben und `submittedAt` der Kasse.
  - Akzeptanz:
    - R-048 (Server): ein direkter Server-Aufruf ohne Abweichungs-Bestätigung → 400.
    - R-013/R-065 (Grundsatz 1): nach dem Klick mit Zahlart `stripe` existiert **keine** Bestellung; die Kasse ist `confirming` und enthält `submittedAt`, alle Eingaben, den Preis-Snapshot, `legalTextVersions` und `legalSnippetVersions`; eine danach aktivierte AGB-Fassung oder Produktänderung ändert daran nichts; keine Mail M01 vor der bestätigten Zahlung.
    - DM-CHK-02 (Teil): `submitCheckout` auf eine Kasse in `confirming`, `completed`, `expired`, `cancelled` oder `failed` wird abgelehnt.
    - R-137/V-22: die URL nach dem Absenden enthält keine Eingaben; Logs enthalten keine E-Mail, keinen Namen, keine Adresse.
  - Tests: `tests/int/commerce/submit-checkout.int.spec.ts` (Validierung, Kassen-Snapshot, Consent-Log, erneutes Absenden, S6, S7, abgelaufene Kasse, keine Bestellung vor Zahlung, Log-Schwärzung, „R-013 …“, „R-048 …“, „R-060 …“, „R-065 …“); `tests/e2e/checkout/overview.e2e.spec.ts` erweitern (URL nach dem Absenden, „R-137 …“).
  - Ohne Jutta: –.

- [ ] **P4.10b Kasse: Lieferartwechsel, Zahlungsbestätigung und Mock-Zahlungswege** – Server-Action `changeCheckoutDelivery` (Lieferart der Kasse wechseln: Versand und Summen neu aus `settings.shipping.rates` nach DATENMODELL §6.25.1, Session per `updateShipping` bzw. bei `recreate_required` neu mit **derselben** Reservierung und `sessionSeq + 1`; die Reservierung bleibt). Nach `submitCheckout` (P4.10a) übergibt der Client E-Mail und Adresse über das Checkout-Objekt von Stripe.js an die Session und ruft `confirm({ returnUrl })`; Fehler (Karte abgelehnt) → Meldung im Zahlungsfeld, Server-Action `reopenCheckout` setzt die Kasse `confirming → open`, die Reservierung läuft weiter (S8). Mock: Server-Action `mockConfirm(outcome, method)` → „Abgelehnt“ → Fehler im Feld und `reopenCheckout`; „Abbruch“ → Weiterleitung auf die Danke-Seite, Session bleibt `open` (Zustand „nicht bezahlt“, S9); „Verzögert“ → Mock-Zustand `complete`/`unpaid` ohne Ereignis, Weiterleitung auf die Danke-Seite (Zustand „wartet“, S10). Die Danke-Seite selbst baut P4.17. Den Weg „Erfolg“ baut P4.16a, weil er die Webhook-Verarbeitung und `fulfillCheckout` braucht.
  - Akzeptanz:
    - AK-4-03: geänderte Klassenpreise wirken auf neue Kassen; eine laufende Kasse ohne Lieferartwechsel behält ihren Snapshot.
    - `changeCheckoutDelivery` lässt `reservationRef` und `expiresAt` unverändert; bei `recreate_required` entsteht die neue Session mit `sessionSeq + 1` für dieselbe Reservierung.
    - S8: nach „Abgelehnt“ ist die Kasse wieder `open`, Reservierung und `expiresAt` sind unverändert, das Zahlungsfeld zeigt die Meldung, ein erneutes Absenden ist möglich.
    - „Abbruch“ und „Verzögert“ leiten mit 303 auf `/de/danke/<Kassen-Token>` bzw. `/en/thank-you/<Kassen-Token>` und erzeugen keine Bestellung; „Verzögert“ setzt den Mock-Zustand `complete`/`unpaid`, ohne ein Ereignis in `webhook-events` abzulegen.
  - Tests: `tests/int/commerce/change-delivery.int.spec.ts` (`updateShipping` und `recreate_required` mit derselben Reservierung); `tests/int/commerce/mock-confirm.int.spec.ts` („Abgelehnt“, „Abbruch“, „Verzögert“; keine Bestellung).
  - Ohne Jutta: –.

- [x] **P4.11 Rechnungen und Gutschriften (Belege und PDF)** – `src/lib/invoices/`: `createInvoiceForOrder(req, order, { lines, paidAt, now })` und `createCreditNote(req, invoice, { amountCents, reason, lines })` in der Transaktion des auslösenden Ereignisses (Nummer über `src/lib/commerce/invoiceNumber.ts` aus P1.21 per Zählerzeile nach DATENMODELL §8.6, Serien `RE`/`GS`, Seed `BSP-RE`/`BSP-GS`); `InvoiceDataV1` in `src/lib/invoices/schema.ts` (Verkäuferin aus `settings.business` inkl. Steuernummer bzw. W-IdNr./USt-IdNr., Empfänger:in aus der Rechnungsadresse – bei Versand ohne Abweichung die Lieferadresse, bei Abholung immer die Rechnungsadresse (R-061) –, Positionen „Nr. 017 · Titel · Kategorie“, Menge 1, Versand als Position, Zahlart und „bezahlt am“, Bestellnummer, Leistungszeitpunkt als Monat (R-120), KU-Satz „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.“ bzw. Steuerzeilen aus `computeTax`); PDF mit `@react-pdf/renderer` 4.x (exakt gepinnt; `src/lib/pdf/InvoiceDocument.tsx`, lokale TTF-Schriften, keine Netzwerk-Anfrage); Task `src/jobs/renderInvoicePdf.ts` (PDF → `private-uploads` mit `purpose = invoice_pdf | credit_note_pdf` unter `private/invoices/{JJJJ}/{Nummer}.pdf`, `sha256`, `renderedAt`, `status = issued`, genau einmal; nach dem Commit direkt ausgeführt). Für Belege mit `seed = true` (Serien `BSP-RE`/`BSP-GS`) setzt der Renderer das Wasserzeichen „BEISPIELBELEG – kein echter Beleg“; der Seed nutzt ihn ab P8.4 direkt ohne Job (SEED-SPEC §9).
  - Akzeptanz:
    - AK-4-13/T-19/DM-INV-01: 50 parallele Rechnungsanlagen → `RE-2026-00001 … 00050` ohne Lücke und ohne Dublette; DM-INV-02 (Rollback verbraucht keine Nummer).
    - AK-4-14/DM-INV-03: Ändern oder Löschen eines Belegs per Admin/API/SQL wird abgelehnt (außer `seed`); DM-INV-05 (gespeicherter Hash = Hash der Datei).
    - R-120: der PDF-Text enthält alle Pflichtangaben; im KU-Modus kein Steuerbetrag (V-02); DM-INV-04 (Regelbesteuerung ab `validFrom` mit Steuerzeilen, ältere Belege unverändert; AK-4-15 Rechnungsteil).
    - R-121 mit Fixture analog SEED-SPEC §9 (Fixture-Bestellung `seed = true` mit Beleg der Serie `BSP-RE` samt Wasserzeichen-PDF): der Zähler `RE` bleibt unberührt, nach `pnpm seed:remove --yes` beginnt die echte Nummerierung bei `RE-2026-00001`; AK-SEED-08 mit den echten Belegen prüft P8.4.
  - Tests: `tests/int/invoices/numbering.int.spec.ts` (Parallelität, „R-121 …“); `tests/int/invoices/pdf.int.spec.ts` (`pdf-parse` als exakt gepinnte devDependency, „R-120 …“, Wasserzeichen bei `seed = true`); `tests/int/invoices/immutability.int.spec.ts`.
  - Ohne Jutta: Steuernummer fehlt → Grund-Seed-Platzhalter; echte Belege erst nach P11 (Go-live-Sperre DATENMODELL §13.7). P11: Steuernummer/W-IdNr. eintragen (AUFGABEN A11, A34).

- [x] **P4.12 Rechtstext-PDFs für Bestellungen** – Grundfassung des Tasks `src/jobs/renderLegalTextPdf.ts` (DATENMODELL §6.12: ab P4, weil M01/M02 die PDFs anhängen; P6.3 baut Aktivierung, Vorschau und Prüfungen aus): DE und – falls vorhanden – EN je aktiver bzw. abgelöster Fassung → `legal-texts.pdfDe`/`pdfEn` (Upload in `documents`, `kind = legal_text_pdf`), `contentSha256De`/`contentSha256En`; Platzhalter-Tokens über den Renderer `src/lib/legal/render.ts` aus P1 (kanonische Liste R-012, keine Aliase; unbekanntes Token → Render-Fehler; `{{STEUERNUMMER}}` wird nie aufgelöst, E-46) und im PDF eingefroren; jede Fassung mit `origin ≠ lawyer` trägt oben „PLATZHALTER – nicht rechtsverbindlich“ (R-002); der Grund-Seed erzeugt die PDFs der Platzhalter-Fassungen direkt. `buildLegalAttachments(order)` in `src/lib/legal/` liefert `AGB_v{n}.pdf` und `Widerrufsbelehrung-und-Formular_v{n}.pdf` (Belehrung + Muster-Formular der in der Bestellung gespeicherten `legalTextVersions` in einem PDF, deterministisch) – bei EN-Bestellungen zusätzlich vorhandene EN-Fassungen. Öffentliche Route `src/app/(api)/api/legal/[...slug]/route.ts` für `/api/legal/[type].pdf?locale=de` und `/api/legal/[type]/[versionId].pdf` (`Cache-Control: public, max-age=3600`).
  - Akzeptanz:
    - Für jede aktive Fassung existiert ein PDF mit SHA-256; das Bündel-PDF enthält beide Texte der Bestellfassung (DM-LEG-02: eine Bestellung vor der Aktivierung einer neuen Fassung bekommt weiter die alten PDFs).
    - DM-LEG-04: `{{unknown}}`, `{{business.street}}` oder `{{STEUERNUMMER}}` im Text → Render-Fehler, kein PDF.
    - Download-Routen: 200 für aktive/abgelöste Fassungen, 404 für Entwürfe und unbekannte Typen.
  - Tests: `tests/int/legal/legal-pdf.int.spec.ts` (Inhalt per `pdf-parse`, Tokens ersetzt, Platzhalter-Kennzeichnung, Versionstreue nach neuer Fassung, „R-002 …“).
  - Ohne Jutta: Platzhalter-Texte mit Kennzeichnung; P11: Kanzleitexte (AUFGABEN A28, R-002).

- [x] **P4.13 Mail-Grundgerüst: Outbox, Layout, Versand-Job** – den Outbox-Helfer `src/lib/email/outbox.ts` aus P1 zu `enqueueEmail(req, { template, to, locale, data, idempotencyKey, relations })` ausbauen: `email-log`-Zeile `queued` + Job `sendEmail` in derselben Transaktion (Outbox, DATENMODELL §1.5); gleicher Schlüssel (Mail-Typ + Objekt-ID + Ereignis) → keine zweite Mail. `src/lib/email/registry.ts`: je Schlüssel aus `EMAIL_TEMPLATES` Vorlage, Empfängerart (Kund:in bzw. Verwaltung – Admin-Mails an `settings.adminNotificationEmail`, Rückfall `ADMIN_NOTIFY_EMAIL`), Pflicht-Anhänge und KONZEPT-ID (M01…, A01…) als Anzeige. `src/jobs/sendEmail.ts` fertigstellen: rendern (den Status-Link baut der Job aus `orders.statusTokenSealed`, P4.1), Anhänge laden; fehlt ein Pflicht-Anhang noch (Rechnung `pending_pdf`), neu einreihen mit `waitUntil +1 min` (höchstens 30×); Wiederholung nach 1, 5, 15, 60, 240 min, danach `failed` + A12; direkte Ausführung nach dem Commit; Unterdrückung für `example.com`, `example.org`, `example.net`, `*.invalid`, `*.test` (`suppressed`); `bodySha256` (mit festem Platzhalter an der Stelle des Status-Tokens, KONZEPT §6.3, R-081) und Anhangsliste mit SHA-256 im `email-log`. Layout `src/lib/email/layout/` (React-Komponenten, gerendert mit `react-dom/server` `renderToStaticMarkup` – keine neue Mail-Bibliothek; einspaltig ≤ 600 px, Inline-Stile, Textfassung je Vorlage; Bilder nur eingebettet per CID: Coco-Vignette, EPC-QR); Kund:innen-Fuß mit Name, Anschrift, E-Mail, Links Impressum und Datenschutz (die Telefonnummer `business.phone` steht nur in der Anbieterkennung der Bestellbestätigungen M01/M02, P4.14; DATENMODELL §7.1, R-021), bei Bestellmails Links Bestellstatus und „Vertrag widerrufen“ – kein Instagram, keine Werbung, kein OS-Link; Admin-Fuß mit Direktlink in die Verwaltung (`ADMIN_ROUTE`). `src/lib/email/alerts.ts`: A12 (`admin_alert`) höchstens einmal je Fehlerart und Stunde; Meldungen zu KONZEPT §4.11 S16/S17 (Geld zu erstatten) gehen immer (KONZEPT §6.4). Snapshot-Hilfe `tests/helpers/mails.ts` mit Fixture-Daten. Der Logger `src/lib/monitoring/logger.ts` schwärzt Empfänger, Tokens und Adressen (ARCHITEKTUR §8.11).
  - Akzeptanz:
    - AK-A-3-04: eine Mail an `erika@example.com` wird mit `suppressed` protokolliert und nicht zugestellt (alle Treiber).
    - AK-6-03, R-080, V-01, V-09: keine externen Bild-URLs, keine Tracking-Parameter, kein OS-Link, keine Werbung in irgendeiner Vorlage.
    - Rollback der auslösenden Transaktion → keine Mail; doppeltes Auslösen → genau eine Mail.
    - T-18: `sendEmail` mit vorgestellter Uhr (Wiederholkette, Übergang `failed`, A12 höchstens einmal je Stunde).
    - Der Status-Link in einer Mail öffnet die Statusseite der Bestellung; das `email-log` enthält weder den Token noch den Link im Klartext.
  - Tests: `tests/int/email/outbox.int.spec.ts` (inkl. Status-Link aus dem Siegel); `tests/unit/email/layout.unit.spec.ts` (Fuß, V-01/V-02/V-09-Scan, „R-080 …“); `tests/unit/logging/redact.unit.spec.ts` (T-20: E-Mail, IBAN, Token, Telefon, Name werden geschwärzt).
  - Ohne Jutta: Versand über `EMAIL_DRIVER=file` (`.data/mail-outbox`); P11: Lettermint-SMTP, Absender `shop@planetclairetattoos.com` (KA-05), Klick-Tracking beim Anbieter aus (AUFGABEN A25, A33).

- [x] **P4.14 Kund:innen-Mails zur Bestellung: M01, M02, M05** – Vorlagen `order_confirmation` (M01, Auslöser O1), `prepayment_instructions` (M02, Auslöser O2; ebenfalls Bestellbestätigung nach R-081) und `prepayment_received` (M05, Auslöser O3/O5) in DE und EN unter `src/lib/email/templates/`, mit allen Pflichtinhalten aus KONZEPT §6.3 und R-081: Anbieterkennung (nur bei M01 und M02 mit der Telefonnummer `business.phone`, R-021, DATENMODELL §7.1); Bestellnummer, Datum und Uhrzeit (Europe/Berlin); Positionen mit Nr., Titel, wesentlichen Eigenschaften und Preis; vereinbarte Abweichungen; Versandart/Abholung und Kosten; Gesamtpreis mit KU-Hinweis; Zahlart mit „bezahlt am“ bzw. Bankverbindung (Kontoinhaberin, IBAN in 4er-Gruppen, BIC, Betrag, Verwendungszweck = Bestellnummer, „bitte bis {Datum}“, EPC-QR per CID, Satz zur automatischen Stornierung); Liefer- und Rechnungsadresse; Lieferzeit bzw. „Ich melde mich wegen der Abholung“; Hinweis auf die gesetzliche Mängelhaftung mit Link zur harmonisierten Mitteilung (R-049); Hinweis auf die Anhänge „in der Fassung vom {Datum}“, Rücksendekosten trägt die Kund:in, Link „Vertrag widerrufen“; Status der DHL-Einwilligung und Widerrufsweg (nur wenn erteilt); Link zum Bestellstatus (Token-URL) und zur Datenschutzerklärung; Baustein `email.orderConfirmation.contractSentence` als gekennzeichneter Platzhalter. Anhänge: M01 = Rechnung + `AGB_v{n}.pdf` + `Widerrufsbelehrung-und-Formular_v{n}.pdf` (genau 3 bei DE-Bestellungen; bei EN-Bestellungen zusätzlich vorhandene EN-Fassungen), M02 = die beiden Rechtstext-PDFs (keine Rechnung), M05 = Rechnung. Platz für den Block „Leider schon weg: Nr. … – erstattet: … €“ in M01 (Daten aus P4.21). Betreffzeilen exakt nach KONZEPT §6.2.
  - Akzeptanz:
    - AK-6-02/R-081 (Vorlagen-Teil): die aus Fixture-Daten gerenderte M01 enthält alle 11 Elemente aus R-081 und nennt die Anhänge mit den richtigen Versionsnummern; M02 enthält Bankdaten, Frist und den EPC-QR als CID-Bild, das mit `jsqr` dekodiert byte-gleich die Payload aus `buildEpcPayload` ergibt; M05 führt die Rechnung als Anhang. Den Versandweg „Mock-Zahlung → genau eine M01 im Datei-Treiber“ prüft P4.16a.
    - AK-6-01 (Teil) und R-084: Snapshot-Tests DE und EN (HTML + Text) grün, keine unersetzten Tokens.
    - R-021: M01 und M02 (beide Bestellbestätigung, R-081) nennen die Telefonnummer aus `business.phone` in der Anbieterkennung; M05 und der gemeinsame Mail-Fuß enthalten sie nicht.
  - Tests: `tests/unit/email/templates/order-confirmation.unit.spec.ts`, `prepayment-instructions.unit.spec.ts` (inkl. EPC-QR-Dekodierung), `prepayment-received.unit.spec.ts` (Snapshots unter `tests/fixtures/mails/`, je Pflichtelement eine Assertion mit Testname „R-081 …“); der Integrationstest der Anhänge läuft in P4.16a.
  - Ohne Jutta: Seed-IBAN `DE36000000000000000000` und Platzhalter-Stammdaten; P11: echte IBAN, Kontoinhaberin, BIC (AUFGABEN A26, A34), Kanzlei-Satz zum Vertragsschluss (Kanzleifrage K-01).

- [x] **P4.15 Weitere Mails: M03, M04, M10 und Admin-Mails A01–A03, A06–A08, A12** – Vorlagen `prepayment_reminder` (M03: offener Betrag, Bankdaten + EPC-QR, Frist, „Hast du schon überwiesen? Dann ist alles gut – Überweisungen brauchen manchmal 1–2 Tage.“), `prepayment_cancelled` (M04, nur O4 durch Task oder Admin, nicht bei Widerruf: Grund „keine Zahlung eingegangen“ bzw. Text von Jutta, „Falls du doch schon überwiesen hast, melde dich – dann überweise ich dir das Geld zurück.“), `oversold_apology` (M10, O19: Entschuldigung, Erklärung, volle Erstattung über dasselbe Zahlungsmittel in 5–10 Werktagen, Link zum Shop – kein Rabattcode, keine Rechnung) in DE und EN; Admin-Vorlagen (immer Deutsch, kurz, Direktlink in die Verwaltung, keine Kund:innen-Freitexte): `admin_order_placed` (A01 bezahlt / A02 Vorkasse offen; Hinweise „Keramik“ und „> 500 €“), `admin_prepayment_cancelled` (A03, nur beim Task), `admin_oversold` (A06: Stücke, Bestellungen, erstatteter Betrag, Erstattungsstatus), `admin_dispute_opened` (A07: Betrag, Grund laut Stripe, Antwortfrist, Hinweis „Belege (Sendungsnummer, Rechnung, Packfotos) im Stripe-Dashboard einreichen“), `admin_refund_failed` (A08), `admin_alert` (A12); Empfänger über die Registry (P4.13). Betreffzeilen exakt nach KONZEPT §6.2/§6.4.
  - Akzeptanz:
    - AK-6-01 für diese Vorlagen (Snapshots DE/EN bzw. DE), AK-6-03; V-09-Scan grün; R-084 (keine unersetzten Tokens).
    - Jeder Schlüssel dieser Aufgabe und von P4.14 ist in `src/lib/email/registry.ts` genau einer KONZEPT-ID zugeordnet (Tabelle DATENMODELL §4).
  - Tests: `tests/unit/email/templates/*.unit.spec.ts` (je Vorlage Snapshot + Pflichtinhalt); `tests/unit/email/registry.unit.spec.ts` (Zuordnung Schlüssel ↔ ID, Admin-Empfänger mit Rückfall).
  - Ohne Jutta: –; P11: Kanzlei-Wortlaut `email.vorkasse.*` (AUFGABEN A28).

- [x] **P4.16 Webhook-Route und Ereignisverarbeitung (`processPaymentEvent`)** – Route `src/app/(api)/api/stripe/webhook/route.ts` (Rohkörper per `await req.text()`, `parseWebhook` des aktiven Treibers, ungültige Signatur → 400, Laufzeit `nodejs`, `maxDuration = 60`, Körper nie loggen) → `src/lib/payments/processPaymentEvent.ts` mit Idempotenz nach DATENMODELL §8.8 (`webhook_events` beanspruchen; bereits verarbeitet → 200; Fehler → `failed`, `lastError`, HTTP 500, bei Wiederholung A12); die Kasse wird über `client_reference_id` (= `reservationRef`) bzw. `stripe.checkoutSessionId` gefunden. Ereignisse: `checkout.completed` mit `unpaid` → nur protokollieren; `checkout.completed` (`paid`) und `checkout.async_succeeded` → `fulfillCheckout` (die Übergabe verdrahtet P4.16a); `checkout.async_failed` → Kasse `confirming → failed` (`closeReason = payment_failed`), Freigabe (`payment_failed`), keine Bestellung; `checkout.expired` → nur wenn die Kasse `open`/`confirming` ist und die Reservierungen `source = checkout_session` zu dieser Session gehören: Kasse `expired` (`closeReason = reservation_expired`), Freigabe (`session_expired`); ist die Kasse `completed` (z. B. Vorkasse), ignorieren; Erstattungs- und Anfechtungs-Ereignisse → P4.22; alle anderen Typen → 200 `ignored`. Optional `pnpm payments:reconcile [--since=<ISO>]` (holt fehlende Ereignisse über `listEventsSince`).
  - Akzeptanz:
    - T-02 (Teil): `checkout.session.expired`, `checkout.session.async_payment_failed` und `checkout.session.completed` mit `unpaid` als signierte Fixtures an die Route (Stripe: `stripe.webhooks.generateTestHeaderString` mit `whsec_test_local`; Mock: HMAC) haben die richtige Wirkung; falsche Signatur → 400; unbekannter Typ → 200 `ignored`; ein erzwungener Verarbeitungsfehler → 500, die Wiederholung gelingt; eine doppelte Zustellung wirkt nur einmal.
    - R-065 (Teil): nach `async_payment_failed` keine Bestellung, keine M01, Kasse `failed`, Stück `available`.
    - `checkout.session.expired` gibt nur Reservierungen `source = checkout_session` dieser Session frei; eine Kasse `completed` (im Test über `createOrderFromCheckout(…, { transition: 'O2' })` vorbereitet) bleibt unberührt.
  - Tests: `tests/int/payments/webhook.int.spec.ts` (T-02-Teil, Idempotenz, Signaturen je Treiber).
  - Ohne Jutta: Webhooks erreichen die Sandbox nicht → Fixtures und Mock; P11: Webhook-Endpunkt und `STRIPE_WEBHOOK_SECRET` (AUFGABEN A33, A38).

- [x] **P4.16a Bestellabschluss (`fulfillCheckout`) und Mock-„Erfolg“** – `src/lib/commerce/fulfillCheckout.ts` mit `fulfillCheckout(checkoutId, req)` nach DATENMODELL §8.3 und KONZEPT §4.10, eine Transaktion (`getTransaction(payload.db, req)` aus `@payloadcms/drizzle`, exakt die Version von `payload`): (1) `SELECT … FROM checkouts WHERE id = $1 FOR UPDATE`; Bestellung mit dieser `stripe_checkout_session_id` vorhanden → nichts tun (Idempotenz); Kasse weder `open` noch `confirming` → keine Bestellung (Meldung A12 und Hinweis an der Vorkasse-Bestellung ergänzt P4.16b); (2) die Stücke der Kasse `FOR UPDATE` sperren und prüfen: `reserved` mit dieser `reservationRef` oder `available` → lieferbar, sonst „fehlt“ (fehlt eines, weiter mit P4.21); (3) `createOrderFromCheckout(req, checkoutId, { transition: 'O1', payment })` (P4.1) mit `paymentMethod` `card` bzw. `paypal`, `stripe.paymentMethodType` (`card`, `apple_pay`, `google_pay`, `paypal`), `paymentProvider` `stripe` bzw. `mock`, `stripe.checkoutSessionId`, `stripe.paymentIntentId`, `stripe.chargeId`, `stripe.livemode`, `stripe.amountReceivedCents` (≠ `totalCents` → `adminAttention payment_amount_mismatch`), `timestamps.paidAt`; (4) Verkaufs-SQL §8.3 mit der neuen Bestell-ID (`soldChannel` `online` bzw. `pickup`, `currentOrder`), Reservierungen `converted`, Kasse `completed` (`completedAt`, `order`); (5) Rechnung (P4.11) in derselben Transaktion; M01 und A01 einreihen; nach dem Commit Beleg-PDF und Mail direkt ausführen und `revalidateProduct(id, { immediate: true })` für alle Stücke (Shop, Kategorie, Startseite, Sitemap). `processPaymentEvent` (P4.16) ruft `fulfillCheckout` für `checkout.completed` (`paid`) und `checkout.async_succeeded`; lazy release und `releaseReservation` (P4.6) rufen es bei `already_complete_paid`. Mock-„Erfolg“ in `mockConfirm` (P4.10b): setzt den Mock-Zustand auf `complete`/`paid`, erzeugt `checkout.session.completed` und ruft dieselbe Verarbeitung wie der Webhook (`processPaymentEvent`), dann Weiterleitung auf die Danke-Seite (die Seite baut P4.17).
  - Akzeptanz:
    - T-02 (Rest): `checkout.session.completed` (`paid`) und `checkout.session.async_payment_succeeded` als signierte Fixtures an die Route → genau eine Bestellung `paid`.
    - AK-4-11/DM-ORD-03/DM-CHK-03/AK-A-3-03: doppelte Zustellung bzw. Mock-„Erfolg“ + Fixture für dieselbe Kasse → genau eine Bestellung `paid`, eine Rechnung, eine M01 (mit den drei Anhängen), ein Verkauf; Kasse `completed`.
    - R-065 (Grundsatz 1): vor der bestätigten Zahlung gibt es keine Bestellung; nach erfolgreichem Webhook genau eine Bestellung `paid` mit `timestamps.placedAt` = `checkouts.submittedAt` und genau eine M01.
    - AK-6-02/R-081 (Versandweg): nach einer Mock-Zahlung liegt genau eine M01 im Datei-Treiber, mit Rechnung, `AGB_v{n}.pdf` und `Widerrufsbelehrung-und-Formular_v{n}.pdf` in den Versionen der Bestellung.
    - Mock-„Erfolg“ → 303 auf `/de/danke/<Kassen-Token>`, Bestellung `paid`, Stück `sold`; lazy release mit `already_complete_paid` (P4.6) ergibt genau eine Bestellung statt einer Freigabe.
    - `stripe.amountReceivedCents ≠ totalCents` → die Bestellung trägt `adminAttention` mit Grund `payment_amount_mismatch`.
    - `ORDER_STATUSES` enthält genau die 13 Werte aus DATENMODELL §4; kein Code-Pfad setzt einen anderen Bestellstatus.
    - Bestand und Bestellung ändern sich nie über die Rückkehr-URL (DATENMODELL §8.8 Nr. 5).
  - Tests: `tests/int/commerce/fulfill-checkout.int.spec.ts` (Kasse `open` und `confirming`, Reservierung abgelaufen aber Stück noch `available`, Kasse schon `completed`, Betragsabweichung, Rechnung/Mail genau einmal, M01-Anhänge, „R-065 …“, „R-081 …“); `tests/int/payments/webhook.int.spec.ts` erweitern (T-02-Rest); `tests/int/commerce/mock-confirm.int.spec.ts` um „Erfolg“ erweitern; `tests/int/commerce/start-checkout.int.spec.ts` um lazy release mit `already_complete_paid` erweitern.
  - Ohne Jutta: –.

- [x] **P4.16b Bezahlt, aber keine Bestellung möglich (S16/S17), und Sichtbarkeit des Verkaufs** – in `fulfillCheckout` Schritt (1) für bezahlte Sessions, zu denen keine Bestellung mehr entstehen darf (KONZEPT §4.10 Nr. 1, §4.11 S16/S17; DATENMODELL §8.8 Nr. 3, DM-37/DM-38): Kasse `expired`, `cancelled` oder `failed` → keine Bestellung, keine Rechnung, Stücke unverändert, kein Kassen-Übergang (DATENMODELL §6.25.3), Mail A12 `admin_alert` („Zahlung zu einer beendeten Kasse – bitte im Stripe-Dashboard erstatten“, Betrag, Session- und Zahlungs-ID), Ereignis `processed` mit `relatedCheckout`; Kasse `completed` mit Vorkasse-Bestellung → keine zweite Bestellung, die Vorkasse-Bestellung bleibt unverändert und bekommt `adminAttention` (Grund `manual`, Notiz „Vorkasse bestellt, aber Kartenzahlung eingegangen – bitte eine Zahlung erstatten“) und Jutta Mail A12. Außerdem weist T-21 nach, dass ein Verkauf nach dem Commit öffentlich sichtbar wird (Revalidierung aus P4.16a, Schritt 5).
  - Akzeptanz:
    - AK-4-17 (S16/S17): ein bezahltes `checkout.session.completed` zu einer Kasse in `expired`/`cancelled`/`failed` bzw. zu einer schon per Vorkasse abgeschlossenen Kasse erzeugt keine Bestellung und keine Rechnung, aber genau eine A12; bei S17 trägt die Vorkasse-Bestellung den Hinweis.
    - T-21: im Produktions-Build zeigt die Produktseite spätestens 5 s nach dem Mock-Webhook den sold-Zustand.
  - Tests: `tests/int/commerce/fulfill-checkout.int.spec.ts` erweitern (Kasse `expired`/`cancelled`/`failed` → A12 ohne Bestellung; Vorkasse-Kasse mit bezahlter Session → Hinweis + A12, „AK-4-17 …“; die Vorkasse-Bestellung legt der Test über `createOrderFromCheckout(…, { transition: 'O2' })` an, weil P4.19 später folgt); `tests/e2e/checkout/revalidation.e2e.spec.ts` `@slow` (T-21, Fixture-Stück).
  - Ohne Jutta: –.

- [ ] **P4.17 Danke-Seite (R08)** – `src/app/(frontend)/[locale]/thank-you/[token]/page.tsx` (DE `/de/danke/[token]`; dynamisch, `noindex`, `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`, Rate-Limit `token_pages`): der Token wird zuerst gegen `checkouts.tokenHash`, dann gegen `orders.statusTokenHash` geprüft (KONZEPT §4.12, ARCHITEKTUR §8.6); unbekannt → 404 (auch nach dem Löschen der Kasse nach 30 Tagen, L-03). Zustände nach KONZEPT §4.12 und KO-19: **wartet** (Kasse `confirming`, noch keine Bestellung) mit Verhaltensmodul `src/behaviors/thanks-poll.ts` (`data-behavior="thanks-poll"`: fragt alle 2 s bis 60 s `GET /api/checkout/[token]/state` ab und lädt die Seite neu, sobald sich der Zustand ändert; danach „Das dauert länger als sonst. Du bekommst eine Mail, sobald alles bestätigt ist.“; im Modus `preview` aus). Endpunkt `src/app/(api)/api/checkout/[token]/state/route.ts` (ARCHITEKTUR §2.5, KONZEPT §2.7): Kassen-Token, Rate-Limit `token_pages`, `Cache-Control: no-store`, Antwort nur ein Zustandscode (`waiting`, `paid`, `prepayment`, `gone`, `unpaid`), keine Bestellnummer und keine Personendaten, unbekannter Token → 404. Seite und Endpunkt nutzen dieselbe Funktion `getThanksState(token, now)` (`src/lib/commerce/thanksState.ts`): bei Kasse `confirming` höchstens einmal je Aufruf `getCheckoutSession` – bezahlt → `fulfillCheckout` (Rückfall 2, KONZEPT §4.10) → „bezahlt“; Session `open` → Kasse `confirming → open`, Zustand „nicht bezahlt“; sonst „wartet“; **bezahlt** (Bestellung `paid` oder später: „Danke!“, Bestellnummer, Positionen mit Mini-Preisschildern, Summe, Lieferart, nächste Schritte je Liefer-/Zahlart, bei fehlenden Stücken der Block „Leider schon weg: Nr. … – erstattet: … €“, Hinweis auf die Mail, Link zum Bestellstatus (Token aus `statusTokenSealed`, P4.1), Link „Vertrag widerrufen“); **Vorkasse** (Bestellung `awaiting_prepayment`: zusätzlich Bankdaten mit „IBAN kopieren“ und „Verwendungszweck kopieren“ über `src/behaviors/copy-button.ts`, Frist, EPC-QR 168 px); **leider schon weg** (Bestellung `refunded` durch O19: H1 „Leider schon weg“ / „Sorry, already gone“ statt „Danke!“, Text wie M10, Bestellnummer, Hinweis auf die Mail, Link zum Shop; keine Rechnung, keine Bankdaten, kein Rabattcode; KONZEPT §4.12); **nicht bezahlt** (Kasse `open`, `failed` oder `expired` nach der Rückkehr: „Die Zahlung hat nicht geklappt“, „Zurück zur Kasse“ bei Kasse `open` mit gültiger Reservierung, sonst „Zum Korb“). Wortlaut neutral („Deine Bestellung ist eingegangen“, Kanzleifrage K-01). Beim ersten Aufruf mit Bestellung werden `pc_cart` und `pc_checkout` gelöscht. Preset `thanks`, Coco-Zustände KO-19 mit Platzhalter-Sprite, MI-09 Grundfassung über `src/behaviors/thanks-moment.ts` (reduzierte Bewegung = Endzustand), Stempel-Knall MI-03 nur bei „bezahlt“; Sprachumschalter führt zur Token-Route der anderen Sprache. Die Zustände „Vorkasse“ und „leider schon weg“ prüft diese Aufgabe mit Fixture-Bestellungen aus `createOrderFromCheckout` (O2 bzw. O19), weil Vorkasse-Absenden (P4.19) und automatische Erstattung (P4.21) später folgen. Die Beispiel-Kassen `checkouts:O13` und `checkouts:O14` (SEED-SPEC §7.3, §17; `tokenHash` = `hashToken(seedToken('checkouts:<Key>', 'checkout'))`) legt erst P8.4 an. Route R08 in der Registry auf „gebaut“.
  - Akzeptanz:
    - R-066/AK-4-12: alle Inhalte vorhanden, Header `noindex`, `Referrer-Policy: no-referrer` und `Cache-Control: private, no-store`, die URL enthält weder E-Mail noch Namen (R-137).
    - S9: Mock „Abbruch“ → „nicht bezahlt“; „Zurück zur Kasse“ führt in die weiterlaufende Kasse. S10: Mock „Verzögert“ → „wartet“; setzt ein Test den Mock-Zustand danach auf bezahlt, zeigt die Seite nach der nächsten Abfrage „bezahlt“ (Rückfall `getCheckoutSession`).
    - Nach dem Abschluss sind beide Cookies gelöscht; ein erneuter Aufruf zeigt weiter „bezahlt“; der Status-Link der Seite öffnet R09.
    - AK-DS-18 für `thanks-poll`, `thanks-moment` und `copy-button`; `thanks-poll` stoppt nach 60 s und beim `unmount()`.
    - `GET /api/checkout/[token]/state` antwortet mit `no-store` und nur dem Zustandscode; unbekannter Token → 404; über dem Rate-Limit `token_pages` → 429.
    - Fixture analog O14 (EN, bezahlt) und Fixture analog O13 (Vorkasse, Bankdaten mit Beispiel-IBAN, Frist, EPC-QR): die Danke-URLs mit dem Kassen-Token aus `createToken()` öffnen die Seite im richtigen Zustand und zeigen „Beispiel“; mit den echten Ankern prüfen P8.4 (AK-SEED-20) und P8.21.
  - Tests: `tests/e2e/checkout/thank-you.e2e.spec.ts` (Zustände „wartet“, „bezahlt“ und „nicht bezahlt“ mit Mock; „Vorkasse“ und „leider schon weg“ mit Fixtures; Fixtures analog O14 EN und O13 Vorkasse; „R-066 …“); `tests/int/commerce/thank-you-fallback.int.spec.ts` (Rückfall über `getCheckoutSession` für Seite und Endpunkt, Token-Reihenfolge Kasse → Bestellung, 404 nach gelöschter Kasse mit Kassen-Token); `tests/int/api/checkout-state.int.spec.ts` (Header, Zustandscodes, keine Personendaten, 404, 429); `tests/unit/behaviors/thanks-poll.unit.spec.ts` (Fake-Timer, 2-s-Takt, Ende nach 60 s, AK-DS-18); `@a11y`.
  - Ohne Jutta: –.

- [ ] **P4.18 Jobs: Reservierungen freigeben und Kassen abgleichen** – Task `src/jobs/releaseExpiredReservations.ts` (Queue `commerce`; ausgelöst über die Weckzeiten `expiresAt` und Kasse `confirming` + 10 min sowie das stündliche Netz, ARCHITEKTUR §9.6/Anhang A.3; Advisory-Lock je Task; `now` injiziert; jede Aktion eigene Transaktion): (a) aktive Reservierungen mit `source = checkout_session` und `expiresAt < now` (Vorkasse-Reservierungen nie): Session per Adapter beenden → `already_complete_paid` ⇒ `fulfillCheckout` (S3), sonst (`expired`, `already_expired`, `already_complete_unpaid`) Freigabe (`session_expired`) und Kasse `open`/`confirming → expired` (`closeReason = reservation_expired`) in einer Transaktion; Kassen ohne Session direkt; (b) Kassen `confirming` seit > 10 min (`timestamps.confirmingAt`): Session abfragen → bezahlt ⇒ `fulfillCheckout` (S10); Session `open` und Reservierung gültig ⇒ `confirming → open`; sonst bis zum Ablauf warten; (c) neuen Weckzeitpunkt schreiben (`jobAlarm.bump`).
  - Akzeptanz:
    - AK-4-09/DM-CHK-04: nach vorgestellter Uhr und Joblauf ist das Stück `available`, die Mock-Session beendet und die Kasse `expired`; es existiert keine Bestellung.
    - AK-4-10 (S3-Teil): Zahlung in letzter Sekunde → der Job findet „bezahlt“, gibt nicht frei, es entsteht genau eine Bestellung `paid`.
    - AK-8-01/T-18: zwei Läufe hintereinander ohne Doppelwirkung; AK-A-9-02: ein Tick nach vorgestellter Uhr gibt das Stück frei.
    - Eine Vorkasse-Reservierung bleibt vom Task unberührt.
  - Tests: `tests/int/jobs/release-expired-reservations.int.spec.ts`; `tests/int/jobs/reconcile-confirming.int.spec.ts`.
  - Ohne Jutta: –.

- [ ] **P4.19 Vorkasse: Bestellen, Erinnerung, automatische Stornierung** – `submitCheckout` mit `paymentChoice = prepayment` (P4.10a erweitern; nur bei `settings.payment.prepaymentEnabled`), in **einer** Transaktion: Eingaben an der Kasse speichern (wie P4.10a), `createOrderFromCheckout(req, checkoutId, { transition: 'O2' })` → Bestellung `awaiting_prepayment` mit `paymentMethod = prepayment`, `paymentProvider = bank_transfer`, `prepayment.dueAt` und `prepayment.reminderDueAt` aus `prepaymentDeadlines(placedAt, settings)` (P4.2); Reservierung nach DATENMODELL §8.5 umstellen (`source = 'prepayment'`, `expires_at = dueAt`, `order_id`; Stücke `reserved_until = dueAt`, `current_order_id`); Kasse `open → completed` (`order`, `completedAt`); M02 + A02 einreihen; keine Rechnung. Nach dem Commit die Zahlungs-Session der Kasse beenden, falls vorhanden; meldet der Adapter `already_complete_paid` (theoretisch, weil die Kasse vorher nicht `confirming` war), bekommt die Bestellung `adminAttention` mit Grund `manual` und Jutta Mail A12 („Vorkasse bestellt, aber Kartenzahlung eingegangen – bitte eine Zahlung erstatten“; KONZEPT §4.11 S17, DATENMODELL §8.8, DM-38); dann `jobAlarm.bump(reminderDueAt)` und 303 auf die Danke-Seite. Tasks `src/jobs/prepaymentReminders.ts` (ab `reminderDueAt` genau einmal M03, `reminderSentAt` setzen) und `src/jobs/cancelOverduePrepayments.ts` (sobald `dueAt < now`: O4 mit `cancelReason = payment_timeout`, Freigabe `prepayment_overdue`, Stücke `available` + Revalidierung, M04 + A03; keine Rechnungsnummer; setzt den nächsten Weckzeitpunkt). Beide Tasks sind Fristen-Jobs und überspringen Bestellungen mit `seed = true`: keine Mail und kein Storno zu Beispieldaten; die Verwaltung zeigt deren Fristen trotzdem an (DATENMODELL §11, KONZEPT §8).
  - Akzeptanz:
    - AK-8-02/DM-ORD-06: Bestellung Sa 26.09.2026 10:00 → bis Di 29.09. 09:59 keine Mail, ab 10:00 genau eine M03; Do 01.10. 23:59 noch offen; beim ersten Joblauf nach 01.10. 23:59:59 genau einmal Storno + M04 + A03, Stück `available`.
    - Eine gleichartige Bestellung mit `seed = true` bekommt zu denselben Zeitpunkten weder M03 noch M04/A03 und bleibt `awaiting_prepayment`.
    - R-071: Rechnungszähler unverändert; M02/M03/M04 im Datei-Treiber; S12: das Stück zeigt bis Zahlung oder Storno „gerade reserviert“.
    - Ein nachfolgendes `checkout.session.expired` gibt nichts frei (Kasse `completed`, Quelle `prepayment`).
    - Wechsel von Karte auf Vorkasse: nach einem abgelehnten Kartenversuch (Kasse wieder `open`) entsteht mit Vorkasse genau eine Bestellung `awaiting_prepayment`.
  - Tests: `tests/int/commerce/prepayment.int.spec.ts` (Bestellen, Umstellung der Reservierung, Wechsel nach abgelehntem Kartenversuch, S13-Fall ohne Session, `already_complete_paid` → A12); `tests/int/jobs/prepayment-deadlines.int.spec.ts` (AK-8-02 mit vorgestellter Uhr und einer Bestellung `seed = false`, Doppel-Lauf, Gegenprobe `seed = true`, Testname „R-071 …“).
  - Ohne Jutta: –; P11: IBAN, Kontoinhaberin, BIC in den Einstellungen (AUFGABEN A26, A34).

- [ ] **P4.20 Verwaltung: „Zahlung erhalten“, Stornieren, „Nachträglich bezahlt“** – Payload-Custom-Endpoints (nur `isAdmin`, `src/endpoints/orders/*`): `POST /api/orders/:id/prepayment-received` (`{ amountCents, receivedAt? }`; ein Betrag ≠ Summe nur mit `confirmMismatch: true` und `adminAttention payment_amount_mismatch`) → O3 über `markPrepaymentPaid(orderId, req)` (DATENMODELL §8.3): Verkauf über die Vorkasse-Reservierung, `prepayment.receivedAt`/`receivedAmountCents`, `timestamps.paidAt`, Rechnung, M05; `POST /api/orders/:id/cancel` (`{ reason }` Pflicht; in P4 nur aus `awaiting_prepayment`) → O4 mit `cancelReason = admin`, Freigabe, M04 mit Juttas Text (keine A03); `POST /api/orders/:id/late-payment` (`{ action: 'reactivate' | 'refund_transfer_done', note? }`, nur `cancelled` mit `payment_timeout`) → O5, wenn alle Stücke `available` sind (Verkauf, Rechnung, M05), sonst 409 „Stück inzwischen verkauft – bitte Geld zurücküberweisen“ bzw. Notiz „Rücküberweisung erledigt“ ohne Rechnung. Admin-Komponente `src/admin/components/OrderActions.tsx` in der Bestell-Bearbeitungsansicht (danach `pnpm generate:importmap`): Knöpfe je Status mit Bestätigungsdialog, der die Folge nennt („Die Kundin bekommt eine Mail mit der Rechnung.“), Anzeige Betrag, Verwendungszweck und „noch X Tage bis Storno“, Schutz gegen Doppeltippen (Idempotenz-Schlüssel je Klick). Die Handy-Ansicht „Vorkasse offen“ baut P5 auf diesen Endpunkten auf.
  - Akzeptanz:
    - O3, O4 (Admin), O5 laut KONZEPT §5.3 inklusive Nebenwirkungen; ein doppelter Aufruf erzeugt keine zweite Rechnung und keine zweite Mail; anonym → 401/403.
    - Falsche Ausgangsstatus werden abgelehnt (Matrix-Teil von AK-5-01).
  - Tests: `tests/int/endpoints/order-prepayment-actions.int.spec.ts`; `tests/e2e/admin/order-actions.e2e.spec.ts` (Desktop und 390×844, Dialogtexte, `@a11y`).
  - Ohne Jutta: –; Juttas Ablauf steht in `docs/owner/AUFGABEN.md` (AUFGABEN A43).

- [ ] **P4.21 Bezahlt, aber schon weg: automatische Erstattung (S4)** – in `fulfillCheckout` nach DATENMODELL §8.4 und KONZEPT §4.10 Nr. 6: fehlt mindestens ein Stück (weder mit dieser `reservationRef` reserviert noch `available`), gibt es für die fehlenden Positionen **keine** Verkaufsbuchung. **Alle fehlen:** `createOrderFromCheckout(…, { transition: 'O19' })` legt die Bestellung direkt als `refunded` an, keine Rechnung, `refunds[]`-Eintrag (Grund `item_unavailable`, voller Betrag inkl. Versand, `includesShipping = true`, Status `pending`), alle Positionen `items[].status = refunded`, Kasse `completed`, M10 `oversold_apology` + A06 `admin_oversold`. **Einige fehlen:** Bestellung `paid` (O1), fehlende Positionen `items[].status = refunded` + `refundedCents`, Erstattung = Preise der fehlenden Stücke + (bezahlter Versand − Versand der höchsten verbleibenden Klasse) als `refunds[]`-Eintrag (`item_unavailable`) ohne Statuswechsel und ohne Gutschrift, Rechnung nur über die gelieferten Stücke und den verbleibenden Versand, Block „Leider schon weg: Nr. … – erstattet: … €“ in M01, A06. Immer `adminAttention` mit Grund `oversold` und Audit `reservation_conflict`. Die Erstattung läuft **nach** dem Commit über `adapter.refund` (Idempotenz `refund:<orderId>:<refundSeq>`); das Ergebnis setzt `refunds[].status` (`failed` → `adminAttention refund_failed` + A08). Kein Rabattcode (DATENMODELL §1.7).
  - Akzeptanz:
    - AK-4-10: S3 und S4 als Integrationstests mit Mock und vorgestellter Uhr; bei S4 genau eine Erstattung, eine M10 und eine A06; der Teilfall erstattet den richtigen Betrag, die Rechnung enthält das fehlende Stück nicht, es gibt keine Gutschrift.
    - O19: die Bestellung entsteht mit Status `refunded` und `statusHistory`-Eintrag `O19`; keine Rechnung, keine M01; eine zweite Zustellung desselben Ereignisses erstattet nicht erneut.
  - Tests: `tests/int/commerce/oversold.int.spec.ts` (Restfall nachgestellt: Kasse A in `confirming`, eine Testhilfe setzt ein bzw. alle Stücke direkt in der DB auf `sold` einer anderen Bestellung – z. B. Offline-Verkauf trotz Sperre –, danach signiertes `checkout.session.completed` für A; Voll- und Teilfall; Erstattung `failed` → A08).
  - Ohne Jutta: –.

- [ ] **P4.22 Webhooks: Erstattungsstatus und Streitfälle (`disputed`)** – in `processPaymentEvent`: `charge.refunded`, `refund.created`, `refund.updated` → `refunds[].status` über `stripeRefundId` (Stripe `pending` → Status bleibt, Anzeige „Erstattung läuft“); `refund.failed` bzw. `refund.updated` mit `status = failed` → `refunds[].status = failed`, `adminAttention` mit Grund `refund_failed`, A08 `admin_refund_failed`, kein Statuswechsel. Streitfälle über `transitionOrder()` nach DATENMODELL §6.8.5: `charge.dispute.created` → **O16** (nur Bestellungen mit Stripe-Zahlung in `paid`, `packed`, `shipped`, `delivered`, `ready_for_pickup`, `picked_up`, `withdrawal_received`, `return_received` oder `partially_refunded`): `statusBeforeDispute` = bisheriger Status, Status `disputed`, `timestamps.disputedAt`, `dispute.status = open`, `dispute.stripeDisputeId`, `adminAttention` mit Grund `dispute_open`, A07 `admin_dispute_opened`. `charge.dispute.closed` gewonnen → **O17**: Status zurück auf `statusBeforeDispute`, `dispute.status = won`, Hinweis entfernt, Notiz; verloren → **O18**: `dispute.status = lost`, `refunds[]`-Eintrag (Grund `dispute`, Status `succeeded`), Gutschrift GS (P4.11) mit Bezug zur Rechnung, Status `refunded`, Notiz „durch Anfechtung erstattet“, **keine** M09 (die Bank hat der Kund:in erstattet). Anfechtung zu einer Vorkasse-Bestellung oder in einem anderen Status → kein Statuswechsel, A12. Die Statusseite zeigt bei `disputed` den Status aus `statusBeforeDispute` (DATENMODELL §6.8.2, P4.23).
  - Akzeptanz:
    - T-02 für diese Ereignisse (signierte Fixtures, doppelte Zustellung ohne Doppelwirkung).
    - DM-ORD-01 (Teil): O16 aus jedem erlaubten Ausgangsstatus gelingt, aus `awaiting_prepayment`, `cancelled`, `refunded` und `disputed` nicht; O17 stellt genau den gespeicherten `statusBeforeDispute` wieder her; O18 führt immer nach `refunded`.
    - Eine verlorene Anfechtung erzeugt genau eine Gutschrift und keine M09; A07 und A08 werden je Ereignis genau einmal versendet; jeder Wechsel steht in `statusHistory` (`O16`/`O17`/`O18`).
  - Tests: `tests/int/payments/refund-dispute-events.int.spec.ts` (Erstattungsstatus, O16–O18 je Ausgangsstatus, Idempotenz); `tests/unit/commerce/order-transitions.unit.spec.ts` (Paare mit `disputed`).
  - Ohne Jutta: –; P11: im Stripe-Dashboard Benachrichtigungen zu Anfechtungen an jutta@planetclairetattoos.com prüfen (AUFGABEN A38).

- [ ] **P4.23 Bestellstatus-Seite (R09) und Dokument-Downloads** – `src/app/(frontend)/[locale]/order/[token]/page.tsx` (DE `/de/bestellung/[token]`; `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`, Rate-Limit `token_pages`; Suche über `statusTokenHash`, Vergleich in konstanter Zeit; unbekannt → 404; Preset `calm`, keine Animation): Bestellnummer, Datum, Statusverlauf aus `statusHistory` als `OrderStatusLine` (KO-16, `<ol>` mit `aria-current="step"`; Varianten Versand, Abholung, Vorkasse; Widerruf/Erstattung als eigene Einträge; bei `disputed` wird der Status aus `statusBeforeDispute` gezeigt, DATENMODELL §6.8.2), Sendungsnummer mit Link (Vorlage aus `settings.shipping.trackingUrlTemplates`; ohne Vorlage nur die Nummer), Positionen (Foto, Titel, Nr., Preis), Versand, Summe, Zahlart, bei `awaiting_prepayment` Bankdaten + Frist + EPC-QR, Dokumente **nur** AGB und Widerrufsbelehrung inkl. Muster-Formular in der Fassung der Bestellung (`AGB_v{n}.pdf`, `Widerrufsbelehrung-und-Formular_v{n}.pdf`) – **keine** Rechnung und keine Gutschrift (R-067, KONZEPT §4.12, ARCHITEKTUR C-24; Hinweis „Deine Rechnung hast du per Mail bekommen“), Knopf „Vertrag widerrufen“ → R26 mit `?order=<Bestellnummer>` (nie die E-Mail), Kontakt; personenbezogen nur Name, PLZ + Ort und die maskierte E-Mail (`j•••@outlook.de`), keine Straße. Route `src/app/(api)/api/orders/[token]/documents/[file]/route.ts` (ARCHITEKTUR §2.5, §8.3): liefert nur die beiden Rechtstext-PDFs aus `orders.legalTextVersions`; Belegtypen sind über die Konstante `STATUS_PAGE_INVOICE_DOWNLOAD = false` gesperrt (Freischaltung nur nach Kanzlei-Antwort, C-24); `private, no-store`; Token nie im Log, Pfad im Logger zu `/de/bestellung/[token]` normalisiert. Sprachumschalter führt zur Token-Route der anderen Sprache. Route R09 in der Registry auf „gebaut“.
  - Akzeptanz:
    - AK-4-12, R-067, DM-ORD-04: falscher Token → 404; Header `noindex`, `no-referrer`, `private, no-store` gesetzt; keine Adresse außer PLZ/Ort; die DB enthält keinen Klartext-Token; die Seite bietet keine Rechnung und keine Gutschrift an.
    - DM-ORD-10/Dokument-Route: zu gültigem Token 200 für die beiden Rechtstext-PDFs der Bestellung; jeder andere Dateiname (auch eine Rechnungs- oder Gutschrift-Datei derselben Bestellung) → 404; falscher Token → 404.
    - Fixtures analog O01 (`refunded`), O10 (`shipped`) und O13 (`awaiting_prepayment`): Bestellungen `seed = true` über `createOrderFromCheckout` (O1, O2 oder O19), Folgestatus per `transitionOrder()`, Status-Token aus `createToken()`; ihre Status-URLs öffnen die Seite und zeigen „Beispiel“; ein anderer Token → 404. AK-SEED-20 mit den echten Ankern (`seedToken('orders:<Key>', 'status')`) prüfen P8.4 und P8.21.
    - Eine Bestellung in `disputed` zeigt der Kund:in den Status aus `statusBeforeDispute` (Fixture analog O03: `disputed` mit `statusBeforeDispute = delivered`; mit dem echten Anker prüft P8.21).
  - Tests: `tests/e2e/order/order-status.e2e.spec.ts` (Fixtures analog O01, O03, O10, O13, Header, Maskierung, Link „Vertrag widerrufen“ mit `?order=`, keine Beleg-Links, „R-067 …“); `tests/int/orders/documents-route.int.spec.ts` (erlaubte und gesperrte Dateien, Konstante); `@a11y`.
  - Ohne Jutta: –; das Ablaufen des Links nach 180 Tagen (R-067, L-05 Stufe B, Task `retentionOrderMinimize`) setzt P6 um.

- [ ] **P4.24 Kaufpfad Ende-zu-Ende mit Mock (optional Stripe-Testmodus)** – Playwright-Suiten unter `tests/e2e/purchase/` mit Fixture-Stücken 980–999 (`tests/e2e/fixtures.ts`, vor jedem Test zurückgesetzt) in den Projekten `iphone-15` (390×844) und `pixel-7` (412×915): Karte „Erfolg“ mit Versand; Karte mit Wallet-Kennung (Mock `apple_pay`) und Abholung; PayPal „Abbruch“ → „Zurück zur Kasse“ → erneut „Erfolg“; „Abgelehnt“ → Meldung → erneuter Versuch; „Abgelehnt“ → Wechsel auf Vorkasse → genau eine Bestellung `awaiting_prepayment`; „Verzögert“ → Danke-Seite wartet → Testhilfe setzt den Mock-Zustand der Session auf bezahlt → die Danke-Seite zeigt nach der nächsten Abfrage „bezahlt“ (Rückfall `getCheckoutSession`; der Job-Pfad S10 ist in P4.18 getestet); Vorkasse mit Versand → Danke-Seite mit Bankdaten → Admin „Zahlung erhalten“ → M05; Abholung mit Vorkasse (Rechnungsadresse Pflicht); Reservierungsablauf mit `page.clock` → „Deine Reservierung ist abgelaufen.“ → „Nochmal reservieren“ (neue Kasse, falls das Stück frei ist); **zwei Käufer:innen** in zwei Browser-Kontexten: gleichzeitig „Zur Kasse“ → genau eine Kasse, die andere sieht „gerade reserviert“; nach Ablauf der ersten Reservierung kann die zweite kaufen. Je Fall werden die Mails im Datei-Treiber geprüft (`readOutbox`). Optional `tests/e2e/purchase/stripe-testmode.e2e.spec.ts` (Tag `@stripe`; läuft nur mit `PAYMENTS_DRIVER=stripe` und `STRIPE_SECRET_KEY` mit Präfix `sk_test_`, sonst `skip`): Payment Element mit der von Stripe veröffentlichten Testkarte, Rückkehr zur Danke-Seite, Bestellung `paid` über den Rückfall `getCheckoutSession` (Webhooks erreichen die Sandbox nicht; Playwright erlaubt Stripe-Hosts nur in dieser Datei).
  - Akzeptanz:
    - EK-02: Produkt → Warenkorb → Kasse → Danke (≤ 4 Seiten) für Karte, PayPal, Vorkasse und Abholung auf beiden Geräteprofilen.
    - EK-03: kein Doppelverkauf im Zwei-Käufer-Test.
    - In keinem Durchlauf entsteht eine Bestellung vor der bestätigten Zahlung (Karte/PayPal) bzw. vor dem Klick (Vorkasse); abgebrochene und abgelaufene Versuche hinterlassen nur Kassen (`expired`, `cancelled`, `failed`).
    - AK-3-10 (Korb/Kasse-Teil): ein geänderter Klassenpreis erscheint in R25, im Korb und in einer neuen Kasse gleich.
    - Keine Suite hat Konsolenfehler oder CSP-Verstöße; `test.fixme` ist hier nicht erlaubt (ARCHITEKTUR §7.2).
  - Tests: wie beschrieben; eine `@smoke`-Teilmenge (ein Kartenkauf, ein Vorkassekauf) läuft in `ci.yml`.
  - Ohne Jutta: Der Stripe-Testmodus läuft nur, wenn Jutta freiwillig Test-Schlüssel hinterlegt (CLOUD-SETUP §3.9); sonst genügt der Mock. P11: echter Testkauf mit Widerruf und Erstattung (AUFGABEN A39).

- [ ] **P4.25 Qualitätsgates P4 und Vorschau-Datei** – T-03/T-04 `@privacy` auf R06–R09 und R25 (vor „In den Korb“ keine Speicherung; nach „Zur Kasse“ nur `pc_cart` + `pc_checkout`; mit `mock` kein Stripe-Host; Stripe-Hosts nur auf R07 und nur mit `stripe`); T-16 Header je Kontext (`dynamic`, `checkout`, Token-Seiten); T-11 axe (R06 leer/gefüllt, R07 inkl. Fehlerzustand, R08 alle Zustände, R09, R25); AK-DS-11 für Korb, Kasse und Bestellstatus; T-09 JS-Budget R06/R07 ≤ 220 KB gz (ohne Stripe.js) und CLS ≤ 0,1 (T-10) für R06/R07; T-20 Logger-Schwärzung nach einem kompletten Kassen-Durchlauf; Abdeckung `src/lib/commerce/**` und `src/lib/payments/**` ≥ 90 % Zeilen / ≥ 85 % Zweige (`pnpm test:coverage`); T-12 visuelle Referenzen (Korb, Kasse, Danke, Status; Referenzbilder nur aus einem CI-Lauf mit `[ci:update-snapshots]` → Artefakt → `gh run download` → Commit mit `[skip ci]`); Verbotsmuster über alle P4-Seiten und gerenderten Mails (V-01, V-02, V-03, V-09, V-11, V-17 mit Allowlist-Eintrag „Countdown im Korb = dieselbe echte Reservierung wie in der Kasse, KO-13“, V-21, V-22, V-23, V-31 – die Anbieterkennung im Mail-Fuß ist laut V-31 ein Pflichtort, R-080); Statusliste: im Code kommen nur Bestellstatus aus `ORDER_STATUSES` vor (statischer Scan). Vorschau-Export (`scripts/preview-export/`): der Crawler legt S01 + S11 in den Korb, klickt „Zur Kasse“ und erfasst R06/R07 je Sprache (Zahlungsfeld-Platzhalter), Danke-Seiten O14/O13 über `seedToken('checkouts:<Key>', 'checkout')` und Status-Seiten O10/O13/O01/O03 über `seedToken('orders:<Key>', 'status')`, sobald P8.4 diese Anker angelegt hat (vorher vermerkt der Bericht sie als „ab P8“, ohne Fehler); in der Datei zeigen „Zahlungspflichtig bestellen“ und jedes Formular-Absenden „Vorschau – hier wird nichts gekauft“, der Countdown läuft als Demo ab 30:00, nichts wird gespeichert (KONZEPT §12.5 Nr. 7, §12.7 Nr. 7).
  - Akzeptanz:
    - EK-02, EK-03, EK-04, EK-05, EK-07 und EK-01 (CLS R06/R07) grün; EK-11: `pnpm test:preview-export` grün, der Bericht führt R06–R09 und R25 als gebaut.
    - R-001: der Nachverfolgbarkeits-Test findet Tests für R-013, R-031, R-035, R-036, R-048, R-060–R-067, R-070, R-071, R-080, R-081, R-084, R-101, R-102, R-120, R-121, R-126, R-130, R-137, R-138.
  - Tests: Erweiterung von `tests/e2e/privacy/`, `tests/e2e/a11y/`, `tests/e2e/legal/forbidden.e2e.spec.ts`, `tests/visual/`, `tests/perf/budgets.json`, `scripts/preview-export/crawl.ts` und `tests/e2e/preview-export.e2e.spec.ts`.
  - Ohne Jutta: –.

### Phasen-Abnahme

- [ ] Alle Aufgaben P4.1–P4.25 (inkl. P4.10a, P4.10b, P4.16a, P4.16b) abgehakt; `pnpm check`, `pnpm test:int` (inkl. Wettlauf-Test mit 100 Wiederholungen), `pnpm build` und `pnpm test:e2e` (Projekte `desktop`, `iphone-15` mit WebKit, `pixel-7`) in der Sandbox grün. Nur wenn die WebKit-Installation in der Cloud scheitert, läuft `iphone-15` mit `PW_SKIP_WEBKIT=1` als markierte Chromium-Emulation (Vermerk im PR); die CI führt WebKit immer aus.
- [ ] CI grün: Zwischen-Commits dieser Phase tragen `[skip ci]`, höchstens ein Zwischenlauf mit `[ci:full]` (ARCHITEKTUR §6.7; sinnvoll nach P4.16b für Kasse, Reservierung und Webhooks). Alle Code- und Fachdoku-Änderungen der Phase stehen im letzten Commit ohne `[skip ci]`, z. B. `chore(P4): finish phase [ci:full p4]`; für ihn sind `ci.yml`, `ci-full.yml` und `preview-export.yml` grün und die Abdeckungsziele erreicht. Das Häkchen setzt erst nach dem grünen Lauf ein reiner Doku-Commit (nur `PLAN.md`, `docs/FORTSCHRITT.md`, `docs/OFFENE-PUNKTE.md`) mit `[skip ci]`.
- [ ] Vorschau-Artefakt `planet-claire-vorschau-p4-<sha7>` gebaut; es enthält Korb, Kasse (Attrappe) und „Versand & Zahlung“; Danke-Seiten und Bestellstatus, soweit ihre Seed-Anker schon existieren (vollständig ab P8.21).
- [ ] Routen-Registry: R06, R07, R08, R09, R25 gebaut; AK-2-01 grün.
- [ ] Prüfen, dass Kasse, Bestellung, Mails und Tests dem Bestell-Lebenszyklus (Grundsatz 1, KONZEPT §5.2/§5.3) folgen: `grep` findet in `src/` und `tests/` keinen Bestellstatus außerhalb von `ORDER_STATUSES`; jede Bestellung entsteht über `createOrderFromCheckout()`.
- [ ] Dokumentation im selben PR (vor dem Phasen-Lauf committet): Ergebnis Spike B-07 in ARCHITEKTUR Anhang B; `.env.example` enthält `STRIPE_API_BASE_URL`; `docs/OFFENE-PUNKTE.md` mit neuen Annahmen dieser Phase (falls welche entstehen) und den offenen Kanzlei-/Steuerfragen (Kanzleifrage K-07 Rechnungsadresse bei Abholung, KA-10 Versandaufteilung). Prüfen (nicht neu anlegen), dass die Fachdokumente den umgesetzten Stand nennen: ARCHITEKTUR §2.5 (`GET /api/checkout/[token]/state`), §3.5 (`SessionState.clientSecret`), §8.6 (`pc:status-token-seal:v1`); DATENMODELL §6.8.2 (`statusTokenSealed`) und §8.8 (DM-37/DM-38); KONZEPT §3.2/§3.4/§3.6 (Shop pausiert), §4.11 S16/S17 (KA-34/KA-35) und §4.12 (Zustand „leider schon weg“); Abweichungen im Fachdokument korrigieren und im PR nennen.
- [ ] Sichtprüfung: je eine M01, M02 und M04 aus `.data/mail-outbox` (DE und EN) als HTML und Text gelesen – Pflichtinhalte und Anhänge vollständig; die Lesbarkeit des EPC-QR belegt die Dekodierung per `jsqr` (P4.2, P4.14); Ergebnis im PR vermerkt.
- [ ] `docs/FORTSCHRITT.md`: Eintrag für Jutta in einfachen Worten (Kaufen mit Testzahlung, Vorkasse, was sie in P11 bei Stripe und Bank erledigen muss: AUFGABEN A23, A24, A26, A33, A38); PR-Beschreibung aktualisiert (Aufgaben, AK-Nachweise, Tests, Link zum Vorschau-Artefakt).

---

## P5 – Abläufe hinter den Kulissen

**Ziel:** Jutta erledigt alles Tägliche vom Handy aus (390 px) und gleichwertig am Laptop: Stück fotografieren und online
stellen, Stücke verwalten und „offline verkauft“ melden, Bestellungen packen, versenden (Sendungsnummer tippen oder
scannen) oder zur Abholung übergeben, Vorkasse verbuchen, Anfragen und Widerrufe einsehen, Einstellungen pflegen,
Monatsexport ziehen. Alle zeitgesteuerten Abläufe laufen über den Job-Wecker, sind mit vorgestellter Uhr getestet und
melden Probleme per Mail. Die Verwaltung ist als Web-App installierbar – nur unter `ADMIN_ROUTE`.

**Voraussetzungen:** P4 abgeschlossen (Kasse, Bestellungen, Outbox mit Mails M01–M05/M10, Rechnungen und Gutschriften mit
PDF, Vorkasse-Jobs, Zahlungsadapter mit `refund`/`listBalanceTransactions`, `@react-pdf/renderer`, `qrcode`); aus P1 die
Verwaltung unter `ADMIN_ROUTE` (Spike B-01 entschieden), Job-Grundlage (Spike B-09), Grund-Seed (`seed:base`) und vom
Beispielbestand nur der Mini-Satz aus P1.30 (Stücke S01, S06, S09, S11, S15, S18, S20, S25, S26, S27, Kasse KS2, Seiten
`home` und `contact`); aus P2 Routen-Registry und Vorschau-Export mit `scripts/preview-export/adminViews.ts`. Die übrigen
Anker aus SEED-SPEC §17 (u. a. S14, Bestellungen O01–O14, Widerrufe W1–W7, Reklamationen RK1–RK4, Anfragen A1–A7,
Datenschutz-Anfragen DS1–DS5) legt erst P8 an. Deshalb
gilt die Arbeitsregel „Beispielbestand vor P8“ am Planbeginn: Kriterien dieser Phase, die solche Anker nennen, prüfen
gleichartige Test-Fixtures (Stücke 980–999, Bestellungen/Widerrufe/Anfragen mit eigenen Fixture-Dateien unter `tests/`
bzw. per Local API, nie unter `content/seed/`; `seed = true` wie ARCHITEKTUR §7.2, außer ein Kriterium verlangt echte
Datensätze, z. B. die Exporte in P5.11/P5.24); mit den echten Ankern prüft P8.21. Namen, Felder, Enums und Mail-Schlüssel stammen aus
DATENMODELL und liegen seit P1 im Schema (DATENMODELL §10.1). Eine Aufgabe, die darüber hinaus etwas braucht, legt es
per eigener Migration an und trägt es im selben PR in DATENMODELL nach.

**Referenzen:** E-03, E-04, E-05, E-12, E-14, E-15, E-16, E-17, E-18, E-22, E-23, E-24, E-25, E-26, E-28, E-29, E-31,
E-45, E-61, E-93; R-020, R-021, R-071, R-082, R-083, R-100, R-101, R-102, R-120, R-122, R-123, R-124, R-125, R-126,
R-127, R-201, R-202, R-203; KONZEPT §5.1, §5.3, §5.5, §6.1–§6.4, §7.1–§7.16, §8.1–§8.4, EK-08, KA-29; DATENMODELL §4,
§6.4, §6.6, §6.8 (inkl. §6.8.8), §6.9, §6.11, §6.17, §6.20, §7.1, §7.2, §8.7, §9, §10.1, §11, §13.5, §13.7; ARCHITEKTUR
§1.2, §2.4, §2.5,
§3.3, §3.5–§3.7, §3.9, §5.2, §7.4 (T-11,
T-15, T-18), §8.1, §8.4, §8.8, §9.6, §11.3, §11.5, §14.7, Anhang A.3; DESIGN §3.3, §12.6; SEED-SPEC §3.1, §3.2, §7, §10,
§11, §15, §17, SE-08; LOESCHKONZEPT L-07, L-24.

### Aufgaben

- [ ] **P5.1 Verwaltungs-Gerüst: Navigation, Ansichten-Registry, UI-Bausteine** – Registry
  `src/admin/views/registry.ts` (Schlüssel, Pfad, Titel DE, Phase, Symbol) für `/heute`, `/neues-stueck`, `/stuecke`,
  `/packen`, `/vorkasse`, `/versendet`, `/abholung`, `/widerrufe`, `/anfragen`, `/tattoo`, `/texte`, `/einstellungen`,
  `/export` (KONZEPT §7.2) plus Detailpfade `/stuecke/:id`, `/bestellungen/:id`, `/widerrufe/:id`, `/anfragen/:id`;
  Registrierung als Payload-Custom-Views (`admin.components.views` in `src/payload.config.ts`), `ADMIN_ROUTE` selbst
  zeigt „Heute“. `/tattoo` zeigt bis P7 „kommt in P7“. Handy: Leiste unten „Heute · Neues Stück · Packen · Mehr“, „Mehr“
  listet alle Ansichten und „Alle Daten“ (Standard-Payload); ab 1024 px Seitenleiste. Bausteine in
  `src/admin/components/`: `ActionButton` (≥ 44 px, gesperrt während der Anfrage), `ConfirmDialog` (nennt die Folge,
  z. B. „Die Kundin bekommt eine Versandmail.“; Pflicht für Aktionen, die Mails senden, Geld bewegen, Bestand ändern oder
  Daten löschen), `StatusBadge`, `CopyButton` (Clipboard-API, Rückfall: Text markieren + „Jetzt kopieren“), `Notice`
  (Erfolg/Fehler als Text mit Handlungsvorschlag, `aria-live`). Nur Deutsch, Payload-Variablen `--theme-*`, keine
  Animationen (KONZEPT §7.1, DESIGN §3.3). Admin-Aktionen sind Payload-Custom-Endpoints in `src/endpoints/`
  (ARCHITEKTUR §2.4) und zustandsbasiert idempotent (Zielzustand schon erreicht → 200 `{ unchanged: true }`, keine
  zweite Wirkung). `scripts/preview-export/adminViews.ts` um alle Ansichten mit Phase ergänzen (ARCHITEKTUR §14.7).
  Prüfen und ggf. nachziehen: „Alle Daten“ nach KONZEPT §7.16 (Status-Felder schreibgeschützt, Belege nur lesen, keine
  Lösch-Knöpfe für veröffentlichte Stücke, Bestellungen, Belege; `json`/`code`-Felder ohne Monaco-CDN, ARCHITEKTUR §8.4)
  und Header des Kontexts `admin` (ARCHITEKTUR §8.1: `X-Robots-Tag: noindex, nofollow`, `Permissions-Policy:
  camera=(self)`, `Cache-Control: no-store`).
  - Akzeptanz:
    - Alle 13 Pfade antworten nach Anmeldung unter `ADMIN_ROUTE` mit 200; `/admin/heute` → 404 (AK-2-04).
    - Bei 390×844 kein horizontales Scrollen, alle Tipp-Flächen ≥ 44 px, axe ohne `serious`/`critical` (AK-7-04, T-11).
    - Das Request-Log der Verwaltung enthält nur den eigenen Origin.
    - Doppeltipp auf einen `ActionButton` löst genau eine Anfrage aus.
  - Tests: `tests/unit/admin/registry.unit.spec.ts` (Pfade eindeutig, alle Pfade aus KONZEPT §7.2 vorhanden);
    `tests/e2e/admin/shell.e2e.spec.ts` (`@a11y`, Projekte `iphone-15` und `desktop`: Navigation, Header, Request-Log,
    404 unter `/admin`).
  - Ohne Jutta: –

- [ ] **P5.2 Admin-Benachrichtigungen A01–A17** – Renderer für alle Admin-Mails A01–A16 (KONZEPT §6.4) in
  `src/lib/email/templates/admin/`, immer Deutsch, kurz, mit Direktlink auf den passenden Admin-Pfad (Pfad aus der
  Registry P5.1). Dienst `notifyAdmin(kind, payload, { now })` schreibt in die Outbox; Empfänger
  `settings.adminNotificationEmail`, Rückfall `ADMIN_NOTIFY_EMAIL`. Nie Kund:innen-Freitexte, nie Anfrage-Bilder, bei
  A05 weder Name noch E-Mail noch Ideentext (R-160). A12 höchstens eine Mail je Fehlerart und Stunde
  (Idempotenz-Schlüssel `admin_alert:<art>:<Berliner Stunde>`). Zuordnung KONZEPT-ID → Schlüssel aus `EMAIL_TEMPLATES`
  (DATENMODELL §4) in `src/lib/email/registry.ts`: A01/A02 `admin_order_placed` (Variante Vorkasse), A03
  `admin_prepayment_cancelled`, A04 `admin_withdrawal_received`, A05 `admin_inquiry_received`, A06 `admin_oversold`, A07
  `admin_dispute_opened`, A08 `admin_refund_failed`, A09 `admin_revenue_guard`, A10 `admin_legal_review_due`, A11
  `admin_monthly_close`, A12 `admin_alert`, A13 `admin_withdrawal_deadline`, A14 `admin_privacy_request_due`, A15
  `admin_legal_hold_review`, A16 `admin_compliance_docs_review`, A17 `admin_password_reset` (Renderer und Auslöser
  „Passwort vergessen“ seit P1, hier nur in der Zuordnung prüfen). Bereits in P4 verdrahtete Auslöser (A01–A03, A06–A08)
  auf `notifyAdmin` umstellen; A04/A10/A13/A14/A15 verdrahtet P6, A05 P7, A09/A11/A16 P5.23/P5.26/P5.13.
  - Akzeptanz:
    - Für jede Mail A01–A17 existiert ein Renderer mit Snapshot DE (AK-6-01); `src/lib/email/registry.ts` ordnet jede
      A-Nummer genau dem Schlüssel aus DATENMODELL §4 zu.
    - Keine Admin-Mail enthält `ec.europa.eu/consumers/odr`, externe Bild-URLs oder Tracking-Parameter (AK-6-03).
    - Drei A12 derselben Art innerhalb einer Stunde → genau eine Mail; neue Stunde → neue Mail.
  - Tests: `tests/unit/email/admin-templates.unit.spec.ts` (Snapshots, Pflichtinhalte, A05 ohne Freitext);
    `tests/int/email/notify-admin.int.spec.ts` (Drosselung mit vorgestellter Uhr, Rückfall auf `ADMIN_NOTIFY_EMAIL`).
  - Ohne Jutta: –

- [ ] **P5.3 Jobs: Job-Wecker, Cron-Endpunkte, Lauf-Protokoll, Frische-Prüfung** – vervollständigen, was P1/P4
  angelegt haben (ARCHITEKTUR §9.6, §2.5, §11.3, Anhang A.3): `GET /api/cron/tick` (Bearer `CRON_SECRET`; liest
  `job-alarm.json` ohne DB, `204`, wenn nichts fällig ist; sonst `handleSchedules` + `run`, danach neuen Weckzeitpunkt
  schreiben), `POST /api/cron/run/[task]` (Bearer `CRON_SECRET` oder Admin-Sitzung; ohne Berechtigung 401, unbekannter
  Slug 404, Slug einer späteren Phase ohne Implementierung 501), CLI `pnpm jobs:run <slug> --now=<ISO>`. Slug-Liste
  `src/jobs/index.ts` = Tabelle ARCHITEKTUR Anhang A.3. Advisory-Lock je Task und für den Tick. Hilfsfunktion
  `runOncePer(task, 'day' | 'month', berlinHour, now)` für tägliche und monatliche Tasks (KONZEPT §8.1 Nr. 3, robust bei
  Sommerzeit). Lauf-Protokoll: SQL-Tabelle `job_runs` per Migration `p5_job_runs` (Spalten, CHECK und Index laut
  DATENMODELL §11; die einzige Schema-Migration von P5, DATENMODELL §10.1), ein Eintrag je Task-Lauf (auch „Jetzt
  ausführen“), Fehlertexte über den Schwärzer (R-137); Einträge älter als 90 Tage löscht der stündliche Task
  `retentionTechnical` (L-13 g, Regel ergänzt in P6.15).
  `GET /api/health/freshness` meldet `jobs: late`, wenn `lastFullRunAt` älter als 3 h ist. Fehlschlag eines Tasks der
  Queues `commerce` oder `documents` → A12 über `notifyAdmin` (P5.2).
  - Akzeptanz:
    - Tick ohne fällige Arbeit → 204 ohne DB-Verbindung (Pool-Zähler); mit fälliger Arbeit laufen die Tasks genau
      einmal, auch bei zwei parallelen Ticks (T-18, DM-JOB-01).
    - Ein täglicher Task läuft am 29.03.2026 und am 25.10.2026 (Zeitumstellung) genau einmal je Berliner Tag.
    - `src/jobs/index.ts` stimmt mit ARCHITEKTUR Anhang A.3 überein (Unit-Test liest die Tabelle).
    - `/api/health/freshness` → 200 bei frischem Lauf, 503 nach mehr als 3 h.
  - Tests: `tests/int/jobs/cron.int.spec.ts`, `tests/int/jobs/run-once.int.spec.ts`, `tests/unit/jobs/slugs.unit.spec.ts`,
    `tests/int/health/freshness.int.spec.ts`.
  - Ohne Jutta: –

- [ ] **P5.4 Übersetzungs-Adapter und Knopf „Übersetzen → EN“** – `src/lib/translation/{types,index,mock,deepl}.ts`
  nach ARCHITEKTUR §3.6 prüfen bzw. anlegen (`TRANSLATION_DRIVER` = `mock` | `deepl`, `DEEPL_API_KEY`; Mock liefert
  `"[EN] " + Text`, ARCHITEKTUR C-21; DeepL: `:fx`-Schlüssel → `api-free.deepl.com`, `target_lang: 'EN-GB'`, höchstens
  50 Texte je Anfrage). Lexical-Rich-Text: Textknoten einsammeln, gebündelt übersetzen, in dieselbe Struktur
  zurückschreiben. Allgemeiner Dienst `translateDocumentFields(collection, id, fieldPaths, { force })` in
  `src/lib/translation/translateDocument.ts` und allgemeine Admin-Komponente `src/admin/components/TranslateButton.tsx`
  (wird in P7 für Flash, Angebote, Tattoo-Seiten und FAQ wiederverwendet). Produkt-Endpunkt `POST
  /api/products/:id/translate` mit der Feldliste aus DATENMODELL §6.6.10; setzt `i18n.enStatus = machine` und
  `i18n.translatedAt`. Vorhandene EN-Texte nur mit `force` (Rückfrage-Dialog) überschreiben. `APP_ENV=production` mit
  Treiber `mock` → Knopf deaktiviert mit Hinweis „Übersetzen ist noch nicht eingerichtet“.
  - Akzeptanz:
    - Mock übersetzt „Schale mit Hund“ zu „[EN] Schale mit Hund“; Rich-Text-Struktur (Absätze, Listen, fett) bleibt gleich.
    - Vorhandener EN-Titel bleibt ohne `force` unverändert; mit `force` wird er ersetzt.
    - Kein Test erzeugt eine Netzwerk-Anfrage (Netzwerk-Wächter aus `vitest.setup.ts`); DeepL-Treiber gegen HTTP-Stub.
  - Tests: `tests/int/adapters/translation.contract.int.spec.ts` (beide Treiber), `tests/unit/translation/lexical.unit.spec.ts`,
    `tests/int/products/translate.int.spec.ts`.
  - Ohne Jutta: DeepL-Schlüssel kommt in P11; bis dahin nur Mock.

- [ ] **P5.5 „Neues Stück“, Teil 1: Fotos aufnehmen, verkleinern, sortieren** – Foto-Baustein
  `src/admin/components/PhotoPicker/` für `/neues-stueck` und `/stuecke/:id`: zwei Knöpfe „Foto aufnehmen“
  (`<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment">`) und „Aus Galerie wählen“ (ohne
  `capture`, `multiple`); iOS wandelt HEIC dadurch selbst um. Verkleinerung im Browser mit `createImageBitmap(file, {
  imageOrientation: 'from-image' })` + Canvas auf höchstens 2560 px lange Kante, JPEG Qualität 0,85 (ARCHITEKTUR §8.8);
  ein Bild je Upload-Anfrage an `POST /api/media` (≤ 4,5 MB, sonst verständlicher Fehler). 1–12 Fotos, Warnung unter 2
  („Mindestens 2 Fotos empfohlen“), Reihenfolge per Hoch/Runter-Knöpfen (Tastatur-bedienbar), erstes Foto = Titelbild,
  Fokuspunkt setzbar, Entfernen. Knopf „Vorschlag“ füllt `alt` DE nach KONZEPT §7.4 mit `„{Produktart} „{Titel}“, Nr.
  {017}, Foto {i} von {n}“`; `alt` EN über „Übersetzen“ (P5.4). EXIF/GPS entfernt der Server seit P1 (R-135); hier
  nur Ende-zu-Ende prüfen.
  - Akzeptanz:
    - Ein 6000×4000-JPEG kommt als Bild mit höchstens 2560 px langer Kante an; ein Foto mit GPS-EXIF wird in allen
      Größen ohne GPS ausgeliefert (AK-7-02).
    - Das 13. Foto wird mit Hinweis abgelehnt; Reihenfolge und Titelbild werden gespeichert.
    - Bedienbar bei 390×844 ohne horizontales Scrollen (AK-7-04).
  - Tests: `tests/unit/admin/resize.unit.spec.ts` (Zielmaße), `tests/e2e/admin/photo-picker.e2e.spec.ts` (`iphone-15`,
    Fixtures aus `tests/fixtures/images/`, EXIF-Prüfung mit `exifr`).
  - Ohne Jutta: –

- [ ] **P5.6 „Neues Stück“, Teil 2: Formular, Nummernprüfung, Online stellen** – Handy-Formular nach KONZEPT §7.4 mit
  den Feldern aus DATENMODELL §6.6.1 (u. a. `itemNumber`, `materials`, `sizeLabel`, `safetyWarnings`,
  `ownDesignConfirmed`, `showInArchiveAfterSale`, `conformityDeclarations`, `leadFreeGlazeConfirmed`, `framed`/
  `frameHasGlass`, `blankBrandVisible`, bei `textil`/`cap` die ausdrückliche Entscheidung `deviationDecision` mit
  `hasDeviation` + `deviationDescription`, §6.6.6; Kategorien und Werte laut DATENMODELL §4). Kategorie setzt
  Versandklasse und Sicherheits-/Pflegevorlagen (DATENMODELL §6.6.3); Felder je Kategorie bedingt eingeblendet.
  Objektnummer vorbelegt über `GET /api/products/next-item-number`, Live-Prüfung über `GET
  /api/products/item-number-status?n=` („✓ frei“ bzw. „✗ vergeben: Nr. 017 Schale mit Hund“; ARCHITEKTUR §2.5), nach
  erster Veröffentlichung gesperrt (E-12). Preis-Eingabe „45“
  oder „45,50“ → Cent (`parseEuroInput` in `src/lib/money.ts`). Knöpfe „Als Entwurf speichern“, „Vorschau“ (rendert die
  Produktseite mit Entwurfsdaten innerhalb der Verwaltung unter `/stuecke/:id/vorschau`, kein Draft-Mode-Cookie auf der
  öffentlichen Domain), „Online stellen“ (`POST /api/products/:id/publish`; bei Fehlern Liste „Das fehlt noch:“ aus
  `validateForPublish` mit Sprunglinks zum Feld) → Erfolgsseite mit „Link kopieren“ (kanonische DE-URL), „Kurzlink
  kopieren“ (`/nr/17`), „Noch ein Stück“. Bearbeiten unter `/stuecke/:id` mit demselben Formular.
  - Akzeptanz:
    - AK-7-01 (Keramik `lebensmittelecht` ohne gültige Erklärung nicht speicherbar; Schmuck ohne `nickelFreeConfirmed`
      und Textil ohne Faserangabe bzw. „Etikett fehlt“ nicht online stellbar) über dieses Formular.
    - AK-7-03: Objektnummer nach Veröffentlichung weder hier noch im Standardformular noch per API änderbar.
    - EK-08: Keramik-Stück von leerem Formular bis „online“ mit höchstens 10 Feld-Eingaben (Ausfüllen, Auswählen,
      Anhaken; Fotos und Knopf-Klicks nicht gezählt).
    - `parseEuroInput`: „45“ → 4500, „45,50“ → 4550, „0,99“ und „10.000,01“ werden abgelehnt.
  - Tests: `tests/unit/money/parse-euro.unit.spec.ts`, `tests/int/products/item-number.int.spec.ts`,
    `tests/e2e/admin/new-piece.e2e.spec.ts` (`iphone-15`, zählt Eingaben für EK-08).
  - Ohne Jutta: –

- [ ] **P5.7 Stück-Statusautomat nach KONZEPT §5.1** – Produkt-Dienst (`src/lib/commerce/productTransitions.ts`) und
  Endpunkte (`src/endpoints/products/*`, DATENMODELL §6.6.10) an die Übergänge P1–P15 aus KONZEPT §5.1 angleichen; das
  Verhalten von KONZEPT gilt, die Namen von DATENMODELL. Ergänzen: `available → draft` („Offline nehmen“, P3, nur ohne
  aktive Reservierung), `reserved → sold` offline nur bei Reservierungsquelle `checkout_session` mit Warnung und
  `confirmReservedCheckout: true` (P10: nur bei Kasse `open`, bei `confirming` gesperrt; Zahlungs-Session über den
  Adapter beenden, Reservierung freigeben, `soldChannel = offline`), nie bei `prepayment`; `draft → archived` (P12),
  `archived → draft` („Wieder bearbeiten“, P14), Löschen nie veröffentlichter Entwürfe (P15, Bilder mit löschen,
  Nummer wieder frei), `sold → available` (P11, erneute Veröffentlichungsprüfung) nur bei `soldChannel = offline`,
  bei erstatteter Position mit zurückgekommener Ware oder wenn die Bestellung mit Grund `admin_cancellation` erstattet
  wurde, bevor das Stück verschickt oder übergeben war (KA-37), und `sold → archived` (P13) nur bei erstatteter
  Position mit zurückgekommener Ware oder wenn die Bestellung mit Grund `breakage` erstattet wurde (Stück vor dem
  Versand beschädigt; Gründe aus `REFUND_REASONS`, KONZEPT §5.1, DATENMODELL §6.6.7). „Offline verkauft“ (`POST
  /api/products/:id/sell-offline`, `{ note?, showInArchive?, confirmReservedCheckout? }`) setzt nur `status`,
  `soldChannel`, `soldAt`, `offlineSaleNote`, `showInArchiveAfterSale` – keine Bestellung, kein Beleg, kein Betrag
  (R-127, E-28). Jeder Wechsel schreibt Audit `product_status_changed` mit `actorType` und Übergangs-ID (Statusverlauf
  laut DM-21) und revalidiert. Prüfen, dass DATENMODELL §6.6.7 Diagramm und Tabelle P1–P15 zeigt.
  - Akzeptanz:
    - Matrix-Test: alle Übergänge aus KONZEPT §5.1 gelingen, alle anderen scheitern (AK-5-01 Produkt); jeder Wechsel
      hat einen Audit-Eintrag `product_status_changed` mit Auslöser (AK-5-02).
    - Nie versendetes Stück: nach Erstattung mit Grund `breakage` gelingt P13 (Fixture analog S09/O08; mit dem echten
      Anker prüft P8.21), P11 nicht; nach
      Erstattung mit Grund `admin_cancellation` gelingt P11 (KA-37); mit Grund `goodwill` ohne Rücksendung scheitern
      beide.
    - „Offline verkauft“ erzeugt weder Bestellung noch Rechnung noch Umsatz-Eintrag (R-127).
    - Vorkasse-reserviertes Stück: „Offline verkauft“ → 409 mit Text „für eine Vorkasse-Bestellung reserviert“.
  - Tests: `tests/int/products/transitions.int.spec.ts` (Titel „AK-5-01 Produkt …“),
    `tests/int/legal/offline-sale.int.spec.ts` (Titel „R-127 …“).
  - Ohne Jutta: –

- [ ] **P5.8 „Meine Stücke“** – Ansicht `/stuecke` (KONZEPT §7.5): Suche nach Nummer (exakt) oder Titel (enthält),
  Filter Status (Entwurf, online, reserviert, verkauft, ausgeblendet) und Kategorie, seitenweise 20 Karten. Karte: Foto,
  `Nr. 017`, Titel, Preis, Status-Badge; bei `reserved` „reserviert bis HH:MM“ bzw. „Vorkasse PC-… bis {Datum}“. Knöpfe
  je Status laut KONZEPT §7.5 auf die Endpunkte aus P5.7; Dialog „Nr. 017 als offline verkauft markieren? Es
  verschwindet aus dem Shop.“ mit Schalter „Im Archiv mit sold-Stempel zeigen“ (Standard an, E-14); „Link kopieren“;
  „Zur Bestellung“ bei Vorkasse-Reservierung und online verkauften Stücken (`/bestellungen/:id`); Schalter „Im Archiv
  zeigen“ bei `sold`.
  - Akzeptanz:
    - Fixture-Stück (980–999, `available`, wie S01) „offline verkauft“ mit Schalter an → fehlt im Shop, erscheint im
      Archiv mit Stempel (Produktions-Build, ≤ 5 s wie T-21); mit Schalter aus → auch im Archiv nicht sichtbar. Die
      Mini-Satz-Stücke bleiben unverändert (ARCHITEKTUR §7.2).
    - Suche „017“ findet genau das Stück mit Nummer 17; Filter „reserviert“ zeigt ein Fixture-Stück mit
      Vorkasse-Reservierung samt Vorkasse-Hinweis (Fixture analog S14/O13; mit dem echten Anker prüft P8.21).
    - axe ohne `serious`/`critical` bei 390×844.
  - Tests: `tests/e2e/admin/pieces.e2e.spec.ts` (`iphone-15`, `@a11y`), `tests/int/admin/pieces-query.int.spec.ts`.
  - Ohne Jutta: –

- [ ] **P5.9 Bestell-Detail und Aktions-Grundlage für Bestellungen** – gemeinsame Ansicht `/bestellungen/:id` für
  Packen, Vorkasse, Versendet, Abholung: Positionen mit Foto, `Nr.`, Titel, Preis; Lieferart, Empfänger:in, Zahlart,
  Beträge, Status mit Historie, Hinweise (`adminAttention`, Anfechtung: Status `disputed` mit `statusBeforeDispute`
  und `dispute.status`), interne Notiz, Mail-Protokoll der Bestellung
  (`email-log`: Typ, Betreff, Zeitpunkt, Status) mit „erneut senden“ für M01, M02, M05, M06, M07 (Bestätigungsdialog,
  KONZEPT §6.1). Gemeinsamer Aktions-Rahmen `src/endpoints/orders/_action.ts`: Admin-Pflicht, Prüfung gegen
  `ORDER_TRANSITIONS` (DATENMODELL §6.8.5), eine Transaktion, `statusHistory`-Eintrag mit `actorType = admin` und
  O-Nummer in `transition`, Audit, Mails nur über die Outbox mit Idempotenz-Schlüssel „Mailtyp + Objekt-ID + Ereignis“
  (KONZEPT §6.1).
  - Akzeptanz:
    - Unerlaubter Übergang über den Rahmen → 409 ohne Änderung; erlaubter → Historie mit Auslöser (AK-5-02).
    - „Erneut senden“ von M01 legt genau einen neuen `email-log`-Eintrag an, zweiter Tipp innerhalb des Dialogs keinen
      weiteren (M06 prüft P5.15, M07 P5.17).
    - Ansicht bei 390×844 ohne horizontales Scrollen, axe ohne `serious`/`critical`.
  - Tests: `tests/int/orders/admin-action.int.spec.ts`, `tests/e2e/admin/order-detail.e2e.spec.ts`.
  - Ohne Jutta: –

- [ ] **P5.10 „Zu packen“: Liste, Hinweise, Adresse kopieren, Gepackt** – Ansicht `/packen` (KONZEPT §7.6):
  Bestellungen `paid` und `packed` mit `fulfillmentMethod = shipping`, älteste zuerst. Karte: Bestellnummer, Datum, Fotos
  und `Nr.` der Stücke, Versandklasse, Name und Ort. Hinweise wörtlich laut KONZEPT §7.6: „Keramik – Karton in Karton“
  (Versandklasse `keramik`), „Warenwert > 500 € – Transportversicherung buchen“ (Zwischensumme >
  `settings.shipping.insuranceHintThresholdCents`), „Brief über 25 € – Einschreiben haftet nur bis 25 €“ (Klasse `brief`,
  Zwischensumme > 2500), „E-Mail an DHL: ja/nein“, „Nicht mehr versenden – Widerruf!“ (Status `withdrawal_received` mit
  `statusBeforeWithdrawal` `paid`/`packed`). Formatierer `formatShippingAddress(order, { includeEmail })` in
  `src/lib/commerce/address.ts` (Grundlage des virtuellen Felds `copyAddressText`, DATENMODELL §6.8.1): `Name ⏎
  Adresszusatz ⏎ Straße Nr. ⏎ PLZ Ort`, E-Mail nur bei erteilter und nicht widerrufener DHL-Einwilligung, nie Telefon
  (R-101); Knopf „Adresse kopieren“ plus Kopier-Symbol je Zeile. Knopf „Einwilligung widerrufen“ setzt
  `carrierEmailConsentRevokedAt` (DATENMODELL §6.8.1), trägt `withdrawnAt` im
  `consent-log`-Eintrag mit Zweck `carrier_email_forwarding` ein und schreibt Audit `carrier_consent_withdrawn`.
  „Gepackt“ = O6 (`timestamps.packedAt`).
  - Akzeptanz:
    - Mit Fixtures analog O14 (`paid`) und O12 (`packed`), beide mit Versand, dazu einer bezahlten Abholbestellung und
      einer `shipped`-Bestellung zeigt die Liste genau die beiden Versand-Fixtures, älteste zuerst; mit den echten
      Ankern (SEED-SPEC §17) prüft P8.21.
    - Formatierer mit Einwilligung enthält die E-Mail, ohne bzw. nach Widerruf nicht; nie eine Telefonnummer (R-101,
      DM-ORD-09).
    - Bestellung mit Zwischensumme 50.001 Cent zeigt den Versicherungshinweis, 50.000 Cent nicht (R-100).
    - „Gepackt“ zweimal getippt → ein Statuswechsel.
  - Tests: `tests/unit/legal/address-formatter.unit.spec.ts` (Titel „R-101 …“), `tests/int/legal/packing-hints.int.spec.ts`
    (Titel „R-100 Versicherungshinweis …“), `tests/e2e/admin/packing.e2e.spec.ts`.
  - Ohne Jutta: –

- [ ] **P5.11 Verpackungs-Checkliste, Verpackungsmengen und Packfotos** – Checkliste je Versandklasse aus
  `settings.packingChecklists` (Seed laut SEED-SPEC §3.2) plus Punkte für alle Sendungen; Häkchen je Bestellung in
  `packingChecklistState` (KONZEPT §7.6). Verpackungsmengen (E-47, R-201, DATENMODELL §6.8.8): beim Packen ist
  `packaging` mit der Standard-Vorlage der Versandklasse vorbelegt (`settings.packaging.defaultsByShippingClass` →
  `settings.packaging.templates` {`key`, `name`, `components` {`material` aus `PACKAGING_MATERIALS`, `grams`}});
  Jutta kann eine andere Vorlage wählen, Bestandteile ergänzen und Gramm ändern. Gespeichert werden
  `packaging.templateKey`, `packaging.templateName`, `packaging.components` und `packaging.recordedAt` mit „Gepackt“,
  spätestens mit „Versendet melden“ (Pflicht vor O7, DM-ORD-07); eine später geänderte Vorlage wirkt nur auf neue
  Sendungen. Jahres-Export `GET /api/admin/packaging-report?year=JJJJ` (nur Admin; CSV UTF-8 mit BOM, `;`, Datei
  `planetclaire-verpackung-{JJJJ}.csv`; Sendungen und kg je Material nach `timestamps.shippedAt` im Berliner
  Kalenderjahr, nur `seed = false` – nie Beispieldaten, auch nicht bei wirksamem `SEED_PREVIEW_MODE`; Abholungen zählen
  nicht; keine Kundendaten); Download unter `/export` (KONZEPT §7.15), laufende Jahressumme (ebenfalls ohne
  Beispieldaten) unter Einstellungen → Versand. Prüfen, dass der Grund-Seed (seit P1) die drei Vorlagen und
  Standardzuordnungen aus DATENMODELL §7.1 enthält (Gewichte sind Schätzwerte, KA-29, DM-08). Packfotos: 0–4 je Bestellung über Kamera
  (`capture="environment"`) in `packingPhotos` (`private-uploads`, `purpose = packing_photo`, DATENMODELL-Maximum 6).
  R-100: Keramik ohne Packfoto ist kein Zwang – „Versendet melden“ fragt „Ohne Packfoto versenden?“; nach Bestätigung
  sendet die Oberfläche `confirmWithoutPackingPhoto: true`, der Versand-Dienst schreibt Audit `packing_photo_skipped`
  (DATENMODELL §6.8.5 O7).
  - Akzeptanz:
    - Test-Sendungen mit Standardvorlage, geänderter Vorlage und eine Abholung → Jahres-Export summiert kg je Material
      korrekt, die Abholung zählt nicht, CSV ohne `@` und ohne Kundennamen; geänderte Standardvorlage wirkt nur auf neue
      Sendungen (R-201).
    - Mit einer Fixture-Sendung `seed = true` (analog der versendeten Seed-Bestellungen) und `SEED_PREVIEW_MODE=true`
      enthält der Jahres-Export keine Seed-Sendung (R-124); mit dem echten Bestand prüft P8.21.
    - Keramik-Bestellung ohne Packfoto: Versand ohne `confirmWithoutPackingPhoto` → 409 mit Rückfrage-Text; mit
      Bestätigung → `shipped` und Audit `packing_photo_skipped` (R-100).
    - Versand ohne erfasste Verpackung → 409 (DM-ORD-07).
    - Packfotos sind ohne Admin-Anmeldung nicht abrufbar (403/404, DM-PRIV-01).
  - Tests: `tests/int/legal/packaging-report.int.spec.ts` (Titel „R-201 …“), `tests/int/legal/transport-risk.int.spec.ts`
    (Titel „R-100 Keramik ohne Packfoto – Rückfrage …“), `tests/e2e/admin/packing-photos.e2e.spec.ts`.
  - Ohne Jutta: Echte Verpackungsgewichte wiegt Jutta beim ersten Packen (KA-29); Aufgabe als A51 ff. in
    `docs/owner/AUFGABEN.md` ergänzen, soweit nicht vorhanden.

- [ ] **P5.12 Packzettel, Etikett und Beileger als PDF** – `src/lib/pdf/PackingSlip.tsx`: A4, **ohne Preise**:
  Bestellnummer, Datum, Empfänger:in, Positionen mit Foto, `Nr.`, Titel, Lagerort (`storageLocation`),
  Verpackungs-Checkliste, Beileger-Block je Stück (Herstellerin mit Name, Anschrift, E-Mail aus `settings.business`,
  `Nr.`, Warn-/Sicherheitshinweise, Pflegehinweise – GPSR), Platz für eine handschriftliche Karte (KONZEPT §7.6).
  `src/lib/pdf/ProductLabel.tsx` (R-203): druckbares Etikett und Beileger je Stück mit Objektnummer, Name,
  Postanschrift, E-Mail, Warnhinweisen, bei Deko-Keramik „Nur Deko – nicht für Lebensmittel“, QR-Code zur kanonischen
  Produktseite (`qrcode`). Nur lokale Schriften. Endpunkte (nur Admin): `GET /api/orders/:id/packing-slip.pdf`, `GET
  /api/products/:id/label.pdf`; Knöpfe in „Zu packen“, Bestell-Detail und „Meine Stücke“. Bei EN-Bestellungen enthält
  der Beileger zusätzlich die EN-Hinweise.
  - Akzeptanz:
    - Packzettel-Text enthält alle Pflichtangaben und kein „€“; im Kleinunternehmer-Modus kein V-02-Treffer.
    - Etikett-PDF einer Deko-Keramik enthält Objektnummer, Name, Anschrift, E-Mail, Warnhinweis und „Nur Deko – nicht
      für Lebensmittel“ (R-203).
  - Tests: `tests/int/pdf/packing-slip.int.spec.ts`, `tests/int/legal/gpsr-label.int.spec.ts` (Titel „R-203 Etikett …“;
    PDF-Text mit `pdf-parse`, falls aus P4 nicht vorhanden als devDependency ergänzen).
  - Ohne Jutta: Stammdaten sind bis P11 Platzhalter („[Name folgt]“); Kennzeichnung der Stücke ist Owner-Aufgabe (R-203).

- [ ] **P5.13 Ablage für Produktsicherheits-Unterlagen** – Dokumentablage nach R-203 und LOESCHKONZEPT L-24 über
  `private-uploads` (DATENMODELL §6.4): Zwecke `technical_file` (Risikoanalyse, technische Unterlagen je Kategorie),
  `supplier_document` (Lieferantenerklärungen, Sicherheitsdatenblätter), `lab_report` (Prüfberichte), `nickel_evidence`;
  Felder `complianceCategory` (bei `technical_file` Pflicht), `documentVersion`, `documentDate`, `note`; nur Admin,
  keine Auto-Löschung. Ansicht unter Einstellungen → „Produktsicherheit“ mit Liste je Kategorie, Hochladen
  (PDF-Prüfung per Magic Bytes, ARCHITEKTUR §8.8) und Vorlage „Technische Unterlagen je Kategorie“ als PDF (`GET
  /api/admin/compliance/template.pdf?category=`, Gliederung ohne Rechtsberatung; ARCHITEKTUR §2.5). Task `complianceDocsReview` (Queue `maintenance`, monatlich am 1. ab 08:10, DATENMODELL §11): Mail
  A16 `admin_compliance_docs_review` über `notifyAdmin` mit Kategorien, die Stücke haben, aber keine `technical_file`-Unterlage,
  und mit Unterlagen (`technical_file`, `supplier_document`, `lab_report`, `nickel_evidence`, `conformity-declarations`),
  deren 10-Jahres-Frist nach dem letzten Inverkehrbringen der Kategorie abgelaufen ist („kann gelöscht werden“) –
  keine automatische Löschung. Als Fristen-Job überspringt der Task Stücke und Unterlagen mit `seed = true` (keine
  Admin-Mail zu Beispieldaten; die Ablage zeigt sie trotzdem, DATENMODELL §11, KONZEPT §8).
  - Akzeptanz:
    - Anonymer REST-Zugriff auf `private-uploads` → 403 (T-15); Unterlage ohne Anmeldung nicht abrufbar; `technical_file`
      ohne `complianceCategory` wird abgelehnt.
    - Job mit vorgestellter Uhr: am 1. des Monats genau eine Erinnerung, zweiter Lauf ohne zweite Mail (AK-8-01).
    - Gibt es nur Stücke und Unterlagen mit `seed = true`, sendet der Job keine A16.
  - Tests: `tests/int/legal/compliance-docs.int.spec.ts` (Titel „R-203 Dokumentablage …“), Erweiterung T-15.
  - Ohne Jutta: Unterlagen lädt Jutta vor P11 hoch (Owner-Aufgabe R-203 aus ANFORDERUNGEN §8).

- [ ] **P5.14 Versanddienst-Adapter, Sendungsverfolgung und Barcode-Scan** – Adapter-Gerüst
  `src/lib/carrier/{types,index,manual}.ts` aus P1 nach ARCHITEKTUR §3.7 vervollständigen, `CARRIER_DRIVER=manual` in
  `src/lib/env.ts`, `.env.example` und ARCHITEKTUR §5.2 prüfen.
  `validateTrackingNumber`: Großbuchstaben, ohne Leerzeichen, `^[A-Z0-9]{8,35}$` (DATENMODELL §6.8); `trackingUrl` aus
  `settings.shipping.trackingUrlTemplates` (Platzhalter `{trackingNumber}`, EN-Variante mit `/en/`). Vorlage Deutsche Post
  (SEED-SPEC SE-08) = DHL-Sendungsverfolgung als Annahme DM-12: prüfen, dass der Grund-Seed sie laut DATENMODELL §7.1
  enthält, Eintrag in `docs/OFFENE-PUNKTE.md` („in P11 mit echter Sendung prüfen“). Scan-Baustein
  `src/admin/components/TrackingScanner.tsx`: Kamera erst nach Tipp; natives
  `BarcodeDetector` (Code 128, Code 39, ITF, Data Matrix) mit `getUserMedia({ video: { facingMode: 'environment' } })`;
  sonst Rückfall über Foto (`<input type="file" capture="environment">`) und `@zxing/browser` als dynamisch importierter
  Chunk, der nur in der Versand-Ansicht geladen wird (KONZEPT §7.1; Paket mit exakter Version in ARCHITEKTUR §1.2
  eintragen); Texteingabe immer möglich. Versanddienst-Auswahl vorbelegt: Klasse `brief` → `deutsche_post`, sonst `dhl`.
  Test-Fixtures `tests/fixtures/barcodes/*.png` mit `bwip-js` (devDependency) über `scripts/fixtures/barcodes.ts` erzeugen.
  - Akzeptanz:
    - „00340 4343 1234 5678 90“ wird zu `0034043431234567890` normalisiert und akzeptiert; „ABC“ (zu kurz) und
      Sonderzeichen werden abgelehnt.
    - Fixture-Foto eines Code-128-Barcodes füllt das Feld über den Rückfallweg (Chromium ohne `BarcodeDetector`).
    - Auf `/heute` wird der zxing-Chunk nicht geladen; kein Request an fremde Hosts.
  - Tests: `tests/int/adapters/carrier.contract.int.spec.ts`, `tests/unit/carrier/tracking.unit.spec.ts`,
    `tests/e2e/admin/tracking-scan.e2e.spec.ts`.
  - Ohne Jutta: Echte DHL-/Post-Nummern und Links prüft Jutta in P11 mit der ersten Sendung.

- [ ] **P5.15 „Versendet melden“ (O7, Mail M06)** – Endpunkt `POST /api/orders/:id/ship` (`{ carrier, trackingNumber?,
  confirmWithoutPackingPhoto? }`) über den Rahmen aus P5.9: nur `paid`/`packed` mit Versand, Verpackung erfasst und
  Packfoto-Rückfrage (P5.11), Sendungsnummer Pflicht bei Versandklasse `paket_klein` und `keramik`, bei `brief` optional
  (KONZEPT O7, DATENMODELL §6.8.5); setzt `shipment.carrier`, `shipment.trackingNumber`, `shipment.trackingUrl` (nur mit
  Sendungsnummer), `timestamps.shippedAt`; Mail M06 (`order_shipped`, DE/EN nach Bestellsprache, KONZEPT §6.3):
  versandte Positionen, Versanddienst, Sendungsnummer und Verfolgungslink (ohne Nummer entfallen beide), Laufzeit „meist
  1–3 Werktage“, Baustein `email.shipping.damageNotice` (R-082) über `getSnippet(key, locale)` – solange es die
  Collection `legal-snippets` nicht gibt (P6.1), liefert `src/lib/legal/snippets.ts` die Arbeitsfassung aus
  ANFORDERUNGEN §6 –, Links Bestellstatus (Token aus `orders.statusTokenSealed`, den `sendEmail` entsiegelt, P4.1) und
  „Vertrag widerrufen“. Dialog „Die Kundin bekommt eine Versandmail mit
  Sendungsnummer.“ bzw. ohne Nummer „… eine Versandmail ohne Sendungsnummer.“ Idempotenz-Schlüssel
  `order_shipped:<orderId>:<trackingNumber | none>`.
  - Akzeptanz:
    - AK-7-05: Fixture analog O14 (`paid`, Versand, Nicht-Keramik) → „Gepackt“ → Sendungsnummer eingeben → „Versendet
      melden“ → Status `shipped`, M06 im Mail-Log, höchstens 5 Taps plus Texteingabe (EK-08); mit dem echten Anker prüft
      P8.21.
    - „Erneut senden“ von M06 im Bestell-Detail (P5.9) legt genau einen neuen `email-log`-Eintrag an, zweiter Tipp
      innerhalb des Dialogs keinen weiteren.
    - `paket_klein`/`keramik` ohne Sendungsnummer → 409; `brief` ohne Nummer → `shipped`, M06 ohne Sendungsnummer und
      ohne Verfolgungslink (DM-ORD-08).
    - M06 enthält „unberührt“ und keinen V-11-Treffer (R-082); keine externen Bilder, kein OS-Link (AK-6-03).
    - Doppeltipp auf „Versendet melden“ → eine Mail.
  - Tests: `tests/e2e/admin/ship-order.e2e.spec.ts` (Titel „AK-7-05 …“, `iphone-15`),
    `tests/unit/legal/shipping-mail.unit.spec.ts` (Titel „R-082 …“, Snapshots DE/EN), `tests/int/orders/ship.int.spec.ts`.
  - Ohne Jutta: –

- [ ] **P5.16 „Versendet“, „Zugestellt“ und Job `markDelivered`** – Ansicht `/versendet` (KONZEPT §7.8): alle
  `shipped` und `delivered` der letzten 30 Tage mit Versanddatum, Sendungsnummer als Link (sofern vorhanden), Status.
  Knöpfe „Zugestellt“ (O10, `shipment.deliveredSource = manual`), „Sendungsnummer korrigieren“ bzw. „nachtragen“ (Dialog
  „Versandmail erneut senden?“ ja/nein; bei ja neue M06 mit neuem Idempotenz-Schlüssel), „Reklamation (Bruch)“ (bis P6
  Sprung zu den Vorlagen aus P5.27). Task `markDelivered` (Queue `commerce`, täglich ab 03:00 Berlin, ARCHITEKTUR
  Anhang A.3): `shipped` mit Versandtag (Europe/Berlin) mindestens 10 Kalendertage zurück → `delivered`,
  `shipment.deliveredSource = auto`, `timestamps.deliveredAt`, keine Mail (O10 laut DATENMODELL §6.8.5).
  - Akzeptanz:
    - Versand am 01.10. 10:00: Lauf am 10.10. ändert nichts, erster Lauf am 11.10. ab 03:00 setzt `delivered`; zweiter
      Lauf ohne Wirkung (AK-8-01).
    - „Sendungsnummer korrigieren“ mit „nein“ erzeugt keine Mail, mit „ja“ genau eine.
  - Tests: `tests/int/jobs/mark-delivered.int.spec.ts`, `tests/e2e/admin/shipped.e2e.spec.ts`.
  - Ohne Jutta: –

- [ ] **P5.17 Abholung: „Bereit zur Abholung“ (O8, M07) und „Abgeholt“ (O9)** – Ansicht `/abholung` (KONZEPT §7.9):
  `paid` mit Abholung und `ready_for_pickup` mit Wartetagen, mehr als 14 Tage markiert. „Bereit zur Abholung“: Textfeld
  vorbelegt aus `settings.pickup.instructions` (Sprache der Bestellung) plus Abholadresse aus `settings.business`,
  editierbar, gespeichert an der Bestellung (`orders.pickup.messageText`, DATENMODELL §6.8.1, seit P1 im Schema) → O8,
  Mail M07 (`pickup_ready`, Baustein `email.pickup.ready`, R-083). Die Adresse steht nur in dieser Mail (E-29).
  „Abgeholt“ → O9 (`timestamps.pickedUpAt`). Dienst `withdrawalPeriodEnd(order)` in `src/lib/legal/periods.ts`:
  Zustellung bzw. Übergabe + 14 Tage, Ende des Berliner Tages; Grundlage des virtuellen Felds `withdrawalDeadline`
  (nutzt P6).
  - Akzeptanz:
    - Fixture analog O09 (`ready_for_pickup`) erscheint mit Wartetagen; eine bezahlte Fixture-Abholbestellung →
      „Bereit zur Abholung“ → M07 enthält den bestätigten Text und die Adresse (Snapshots DE/EN); „Erneut senden“ von M07
      im Bestell-Detail (P5.9) erzeugt genau einen neuen `email-log`-Eintrag; mit dem echten Anker prüft P8.21.
    - `pickedUpAt` bestimmt Widerrufsfrist-Ende und Gewährleistungsbeginn der Abholbestellung (R-083, R-102).
  - Tests: `tests/int/legal/pickup.int.spec.ts` (Titel „R-083 …“, „R-102 …“), `tests/e2e/admin/pickup.e2e.spec.ts`.
  - Ohne Jutta: Abholtext ist Seed-Vorlage; Jutta passt ihn in den Einstellungen an.

- [ ] **P5.18 „Vorkasse offen“: Zahlung erhalten, Stornieren, Nachträglich bezahlt** – Ansicht `/vorkasse` (KONZEPT
  §7.7, §4.8): `awaiting_prepayment` nach `prepayment.dueAt`, Bestellnummer (= Verwendungszweck), Betrag, Bestelldatum,
  „noch X Tage bis Storno“ (am letzten Tag rot), Erinnerung ja/nein. „Zahlung erhalten“ (O3; Dialog mit Betrag und
  Verwendungszweck, `prepayment.receivedAmountCents` Pflicht, Abweichung vom Gesamtbetrag → Warnung, optional
  Eingangsdatum) → Stücke `sold`, Rechnung RE (P4-Dienst), M05. „Stornieren“ (O4, Grund Pflicht) → Stücke frei, M04.
  „Bankdaten kopieren“ (Kontoinhaberin, IBAN, BIC, Betrag, Verwendungszweck). Unterliste „Kürzlich automatisch storniert
  (30 Tage)“ mit „Nachträglich bezahlt“ (O5): nur bei `cancelReason = payment_timeout` und wenn alle Stücke noch
  `available` sind (atomar reservieren und verkaufen, RE, M05); sonst Hinweis „Stück ist schon weg – bitte Geld
  zurücküberweisen“ mit Vorlage „Bitte um IBAN“ (P5.27). `ORDER_TRANSITIONS` enthält O5 `cancelled → paid`
  (DATENMODELL §6.8.5); die Bedingungen prüft der Dienst. Prüfen, dass AK-8-02 aus P4 grün ist; sonst Test ergänzen.
  - Akzeptanz:
    - Fixture analog O13 (`awaiting_prepayment`, Versand) erscheint mit Frist; „Zahlung erhalten“ → `paid`, Rechnung,
      M05 genau einmal (R-071, R-120); mit dem echten Anker prüft P8.21.
    - O5 gelingt nur, wenn alle Stücke frei sind; ist ein Stück inzwischen verkauft → 409 ohne Änderung.
    - AK-8-02 grün (Freitag 26.09. 10:00 bis Donnerstag 02.10. 00:00).
  - Tests: `tests/int/orders/prepayment-admin.int.spec.ts` (Titel „R-071 …“), `tests/e2e/admin/prepayment.e2e.spec.ts`.
  - Ohne Jutta: Bankdaten sind bis P11 die Beispiel-IBAN aus dem Grund-Seed.

- [ ] **P5.19 „Widerrufe“ (Liste und Detail, nur lesend)** – Ansicht `/widerrufe` (KONZEPT §7.10) mit DATENMODELL-Namen
  (§6.11): Vorgangsnummer `WR-…`, Eingang (Datum und Uhrzeit Europe/Berlin), Name, Bestellung oder „nicht zugeordnet“,
  Kanal (`channel`), Status, „erstatten bis {`refundDueAt`}“ (= Eingang + 14 Tage, ab Tag 10 rot). Detail
  `/widerrufe/:id`: unveränderliche Erklärung
  (Snapshot), zugeordnete Bestellung mit Positionen und Zahlart, Admin-Notizen (separat speicherbar). Aktionen
  (Zuordnen, Ware zurück, Erstatten, Abschließen) folgen in P6.9/P6.10; bis dahin steht dort „Bearbeitung ab P6“.
  - Akzeptanz:
    - Fixtures analog W3, W4, W5 (SEED-SPEC §10: `goods_returned`, `received` mit `needs_manual_match`, `received` mit
      Eingang vor einem Tag) erscheinen als offen, der W4-Fall als „nicht zugeordnet“, der W5-Fall mit „erstatten bis“
      Eingang + 14 Tage (bei fester Uhr `D+13`); mit den echten Ankern (SEED-SPEC §17) prüft P8.21.
    - Die Erklärung ist in der Ansicht und über die API nicht änderbar (DM-WDR-03); Notizen schon.
  - Tests: `tests/e2e/admin/withdrawals-list.e2e.spec.ts`, `tests/int/withdrawals/notes.int.spec.ts`.
  - Ohne Jutta: –

- [ ] **P5.20 „Anfragen“ (Auftragsarbeiten) in der Verwaltung** – Ansicht `/anfragen` (KONZEPT §7.11): Referenz
  `AA-…`, Datum, Name, Gegenstand, Status, „wird gelöscht am {deleteAfter}“. Detail `/anfragen/:id`: alle Angaben,
  Referenzbilder nur über die angemeldete Dateiroute bzw. signierte URL ≤ 300 s (ARCHITEKTUR §8.3), interne Notizen,
  Status-Knöpfe mit den Werten aus `INQUIRY_STATUSES` (DATENMODELL §4) und den Übergängen aus KONZEPT §5.5 als Tabelle
  `INQUIRY_TRANSITIONS` in `src/lib/inquiries/transitions.ts`; jeder Wechsel schreibt Audit `inquiry_status_changed`
  (Statusverlauf laut DM-21),
  jeder Wechsel und jede Notiz setzt `lastActivityAt`, **nicht** `deleteAfter` (Löschung 6 Monate nach Eingang,
  LOESCHKONZEPT L-10). „Antworten“ öffnet `mailto:` mit Betreff „Deine Anfrage AA-2026-0007“ bzw. „Your request
  AA-2026-0007“ nach Sprache der Anfrage. „Jetzt löschen“ (Dialog) löscht Anfrage und Bilder sofort, Audit
  `inquiry_deleted` nur mit Referenz und Datum, Eintrag im `deletion-log` (`ruleId = ADMIN`, `trigger = admin`) über
  `writeDeletionLog` (`src/lib/retention/log.ts`).
  - Akzeptanz:
    - Matrix-Test der Anfrage-Übergänge (AK-5-01 Anfrage).
    - Referenzbild ohne Anmeldung nicht abrufbar (AK-10-04, Teil Zugriff).
    - „Jetzt löschen“ entfernt Datensatz und Dateien (Speicher leer).
  - Tests: `tests/int/inquiries/admin.int.spec.ts` (Titel „AK-5-01 Anfrage …“), `tests/e2e/admin/inquiries.e2e.spec.ts`.
  - Ohne Jutta: –

- [ ] **P5.21 Einstellungen, Teil 1: Stammdaten, Steuer, Zahlung, Benachrichtigungen, Konto** – Ansicht
  `/einstellungen` mit Bereichen (KONZEPT §7.14) als Handy-Formulare über dem Global `settings` (DATENMODELL §7.1):
  Stammdaten & Impressum (`business.*`, `tattoo.studioDistrict`, `social.instagramHandle`, `social.contactEmail`;
  Postfach-Adressen abgelehnt mit `/postfach|\bpf\.?\s?\d/i`, R-020; Telefon `business.phone` mit Formatprüfung
  E.164 oder deutsches Format und Hinweis „erscheint nur in Impressum, Widerrufsbelehrung und in der Anbieterkennung
  der Bestellbestätigung“ (M01), R-021;
  der Grund-Seed-Platzhalter „[Telefon folgt]“ bleibt speicherbar, die Startklar-Prüfung meldet ihn rot; Steuernummer mit
  Hinweis „nie öffentlich“), Steuer
  (`tax.modes` mit „gilt ab“ und Warnhinweis; `retention.invoiceYears` 8 oder 10 mit Warnhinweis „erst nach Antwort auf
  Kanzleifrage K-33 umstellen“, Audit `retention_setting_changed`), Zahlung (Kontoinhaberin, IBAN mit Prüfziffer mod
  97, BIC; Anzeige
  Zahlungsanbieter Mock/Test/Live ohne Schlüssel; Vorkasse-Fristen nur Anzeige), Benachrichtigungen
  (`adminNotificationEmail`), Rechtstexte (Liste je Typ „kommt in P6“; Intervall und Schalter folgen in P5.22a), Konto
  (Passwort ändern ≥ 12 Zeichen, Abmelden). Speichern schreibt Audit `settings_changed` mit maskiertem Diff
  (DATENMODELL §7.1).
  - Akzeptanz:
    - IBAN `DE36 0000 0000 0000 0000 00` (Grund-Seed, Beispiel-IBAN) wird akzeptiert, `DE00 0000 0000 0000 0000 00`
      abgelehnt.
    - Adresse „Postfach 1234“ wird mit Hinweis abgelehnt (R-020).
    - Telefon „+49 30 1234567“ und „030 1234567“ werden akzeptiert, „abc“ und „12“ abgelehnt; „[Telefon folgt]“ bleibt
      speicherbar (R-021).
    - Alle Bereiche bei 390×844 bedienbar, axe ohne `serious`/`critical`.
  - Tests: `tests/unit/payments/iban.unit.spec.ts`, `tests/int/legal/business-profile.int.spec.ts` (Titel „R-020
    Postfach …“, „R-021 Telefonformat …“), `tests/e2e/admin/settings.e2e.spec.ts`.
  - Ohne Jutta: Alle Werte bleiben Platzhalter bzw. Seed bis P11.

- [ ] **P5.22 Einstellungen, Teil 2: Versand mit EU-Sperre, Beispieldaten, System** – Versand: Tarife je Zone und Klasse
  (`shipping.rates`), Lieferzeit-Text DE/EN, Abholung an/aus, Tracking-Vorlagen, Checklisten, Verpackungsvorlagen
  (`settings.packaging.*`) und laufende Jahressumme (P5.11). Länderliste (`shipping.enabledCountries`): nur DE aktiv;
  Aktivieren eines EU-Landes verlangt die fünf Häkchen der Gruppe `shipping.euChecklist` (R-202:
  `authorisedRepresentativeNamed`, `ossThresholdChecked`, `textileLanguageChecked`, `ratesMaintained`,
  `legalTextsAdapted`); erst dann lässt sich `shipping.euShippingAcknowledged` setzen, das Datum steht in
  `shipping.euShippingAcknowledgedAt` (DATENMODELL §7.1). `lebensmittelecht`-Keramik ist für NL und LU nicht bestellbar
  (`isOrderableInCountry` in `src/lib/commerce/`, auch in
  der Kasse geprüft). Keine weiteren EU-Funktionen (ENTSCHEIDUNGEN „Später“). Beispieldaten: Anzahl `seed = true` je
  Collection über `GET /api/admin/seed/summary` und Knopf „Beispieldaten entfernen“ (Bestätigung durch Eintippen von
  „ENTFERNEN“) auf `POST /api/admin/seed/remove` (DATENMODELL §13.5); fehlen die Endpunkte noch, nur Anzeige mit
  Hinweis „kommt in P8“. System (ARCHITEKTUR §11.5): App-Version,
  `APP_ENV`, letzter voller Job-Lauf und nächster Weckzeitpunkt, Lauf-Protokoll 90 Tage aus `job_runs`, fehlgeschlagene
  Mails mit „erneut senden“, nicht verarbeitete Webhook-Ereignisse, „Jetzt ausführen“ je Task (`POST
  /api/cron/run/[task]` mit Admin-Sitzung, Dialog), Startklar-Prüfung als Hinweis „kommt in P10“.
  - Akzeptanz:
    - EU-Land ohne alle fünf Häkchen → abgelehnt; mit Häkchen gespeichert inkl. `euShippingAcknowledgedAt` (R-202).
    - Stück `lebensmittelecht` + Lieferland NL → nicht bestellbar (R-202).
    - „Jetzt ausführen“ für `markDelivered` erzeugt einen `job_runs`-Eintrag; fehlgeschlagene Mail lässt sich erneut senden.
  - Tests: `tests/int/legal/eu-activation.int.spec.ts` (Titel „R-202 …“), `tests/e2e/admin/settings-system.e2e.spec.ts`.
  - Ohne Jutta: EU bleibt aus; Freischaltung ist eine spätere Entscheidung.

- [ ] **P5.22a Einstellungen, Teil 3: Shop, Kosten, Vorlagen, Steuer-Bestätigung, Statistik, Rechtstexte** – restliche
  Bereiche aus KONZEPT §7.14 als Handy-Formulare über `settings` (Feldnamen und Grenzen DATENMODELL §7.1, seit P1 im
  Schema; Audit `settings_changed` wie P5.21):
  Shop (Schalter „Shop geöffnet“ `shop.isOpen`, Pausen-Text `shop.closedMessage` DE/EN ≤ 300 Zeichen mit
  „Übersetzen“ (P5.4), `shop.maxItemsPerCheckout` 1–10); Kosten (`costs.budgetCents`, `costs.warningThresholdCents`,
  Monatswerte `costs.monthlyEntries` mit Monat, Betrag, Notiz; E-05 – die Warnung unter „Heute“ baut P5.28); Vorlagen
  (Warnhinweise `safetyTemplates` DE/EN, genau eine je Kategorie; Pflegehinweise `careTemplates` für `textil`/`cap`;
  Änderungen wirken nur auf die Vorbelegung neuer Stücke, P5.6); Steuer-Bestätigung (Knopf „Steuerangaben bestätigt“
  setzt `tax.confirmedAt`; Jahressummen vor dem Shop `revenueGuard.manualYearTotals` mit Jahr, Betrag, Notiz und Hinweis
  „Vorjahr auch mit 0 € eintragen“ – P5.23 bindet dieselbe Eingabe im Bereich Umsatz-Wächter ein); Datenschutz & Dienste,
  Teil Statistik (`analytics.enabled` nur zusammen mit `analytics.confirmedAt` und `analytics.note`, Hinweis „wirkt nur
  mit `NEXT_PUBLIC_ANALYTICS_ENABLED=true`“, R-132; Auftragsverarbeitung folgt in P6.21); Rechtstexte
  (`legal.reviewIntervalDays`, Standard 365; Schalter `legal.allowVisibleBlankBrands` mit Warnhinweis „erst nach
  Antwort auf Kanzleifrage K-13 umstellen“, R-047; die Liste je Typ folgt in P6.4). „Shop öffnen“ in Produktion: mit
  `APP_ENV=production` lehnt der Server `shop.isOpen = true` ab, solange die Startklar-Prüfung nicht grün ist, und die
  Ansicht listet die offenen Punkte (DATENMODELL §13.7). Bis P10.14 gilt die Prüfung in Produktion als nicht grün
  (Meldung „Startklar-Prüfung kommt in P10“); P10.14 schließt hier die echte Prüffunktion an.
  - Akzeptanz:
    - Shop aus → Produktseite eines Fixture-Stücks zeigt nach dem Speichern `closedMessage` statt „In den Korb“; Shop an
      → Kaufbereich wieder da (DM-41).
    - Mit `APP_ENV=production` (injiziert) wird „Shop öffnen“ mit Hinweis abgelehnt; mit `APP_ENV=preview` gespeichert.
    - `maxItemsPerCheckout` 0 und 11 abgelehnt, 1 und 10 gespeichert; `closedMessage` mit 301 Zeichen abgelehnt.
    - Löschen der einzigen `safetyTemplates`-Zeile einer Kategorie wird abgelehnt; geänderte Vorlage erscheint beim
      nächsten neuen Stück, bestehende Stücke bleiben unverändert.
    - `analytics.enabled = true` ohne `confirmedAt` oder ohne Notiz wird abgelehnt (R-132).
    - „Steuerangaben bestätigt“ setzt `tax.confirmedAt`; Audit `settings_changed` mit maskiertem Diff.
    - Alle Bereiche bei 390×844 bedienbar, axe ohne `serious`/`critical`.
  - Tests: `tests/int/admin/settings-part3.int.spec.ts`, `tests/e2e/admin/settings-part3.e2e.spec.ts` (`iphone-15`,
    `@a11y`).
  - Ohne Jutta: Kosten, Vorlagen und Steuer-Bestätigung pflegt Jutta selbst; „Shop öffnen“ in Produktion erst in P11.

- [ ] **P5.23 Umsatz-Wächter** – reine Funktion `computeRevenueStatus({ year, now, … })` in `src/lib/revenue/guard.ts`:
  Shop-Umsatz = Rechnungen minus Gutschriften nach Belegdatum (Europe/Berlin), plus manuelle Monatssummen
  (`revenue-entries`) plus `revenueGuard.manualYearTotals` für Jahre vor dem Shop; Seed-Daten zählen nur bei
  `seedPreviewModeActive()` (KONZEPT §8.4). Stufen aus KONZEPT §8.4 und R-125 zusammengeführt, Grenzen aus
  `settings.revenueGuard`: U1 ≥ 20.000 € (80 % der Vorjahresgrenze), U2 > 25.000 €, U3 ≥ 80.000 €, U3a ≥ 90.000 € (R-125),
  U4 ≥ 95.000 €, U5 > 100.000 €, U0 am 1. Januar, wenn das Vorjahr > 25.000 € war (Stufen-IDs `REVENUE_GUARD_STAGES`).
  `REVENUE_SOURCES` enthält `auftragsarbeiten` (DATENMODELL §4, R-125). Task `revenueGuardCheck` (täglich ab 07:00 und
  nach jeder Beleg- oder Monatssummen-Änderung): A09 genau einmal je Stufe und Jahr; `settings.revenueGuard.lastNotified`
  hält je Jahr die bereits gemeldeten Stufen (`{ "2026": ["U1"] }`),
  Hinweis unter „Heute“ bis Jahresende. Ansicht Einstellungen → Umsatz-Wächter: Balken mit Stand und Schwellen,
  Monatstabelle (Shop, Tattoo, Flohmarkt, Auftragsarbeiten, Sonstiges) mit Eingabe der manuellen Summen, Eingabe der
  Jahressummen vor dem Shop (dieselbe Komponente wie in P5.22a), Verlauf, Satz
  „Der Wächter ersetzt keine Steuerberatung.“ Texte der Stufen aus KONZEPT §8.4 bzw. R-125.
  - Akzeptanz:
    - Stufen bei 19.999/20.000/25.001/90.000/100.001 € korrekt (R-125); 19.999 € keine Meldung, 20.000 € U1 mit genau
      einer A09 im Jahr (AK-8-04).
    - Neujahrslauf mit Vorjahr > 25.000 € → U0 einmal; zweiter Lauf ohne zweite Mail.
    - Belege mit `seed = true` (Fixture-Belege der Serie `BSP-RE`) zählen mit `APP_ENV=production` nie.
  - Tests: `tests/unit/legal/revenue-guard.unit.spec.ts` (Titel „R-125 …“), `tests/int/jobs/revenue-guard.int.spec.ts`
    (Titel „AK-8-04 …“).
  - Ohne Jutta: Monatliche Summen trägt Jutta ein (A45); Schwellen sind Standardwerte bis zur Steuerberatung.

- [ ] **P5.24 Export: Monats-CSV und Rechnungs-ZIP** – `src/lib/export/monthlyCsv.ts`: Monat wählen → Datei
  `planetclaire-{JJJJ-MM}.csv`, UTF-8 mit BOM, Trennzeichen `;`, Zeilenende CRLF, Dezimalkomma, Datum `TT.MM.JJJJ`,
  sortiert nach Belegnummer. Spalten laut KONZEPT §7.15: Belegdatum; Belegart (Rechnung/Stornorechnung/Gutschrift);
  Belegnummer; Bestellnummer; Zahlart; Betrag brutto; davon Versand; Steuermodus; Steuersatz; Steuerbetrag (0 im
  KU-Modus); Zahlungsdatum; Stripe-Zahlungs-ID bzw. Stripe-Erstattungs-ID; Stripe-Gebühr (Mock: 0); Auszahlungs-ID;
  Auszahlungsdatum. **Keine** Namen, Adressen, E-Mails (R-124). Gebühren und Auszahlungen über
  `payments.listBalanceTransactions` (Mock: Fixtures). Beispieldaten (`seed = true`, Serien `BSP-RE`/`BSP-GS`) sind
  immer ausgeschlossen, auch bei wirksamem `SEED_PREVIEW_MODE`; es gibt keine Option, sie einzuschließen (KONZEPT §11.4,
  ARCHITEKTUR §2.5). Rechnungs-ZIP mit `fflate` (exakte Version in ARCHITEKTUR §1.2 eintragen): alle RE/GS-PDFs des
  Monats als `{Nummer}.pdf` plus die CSV. Admin-Endpunkte `GET /api/admin/export/{JJJJ-MM}.csv` und `.zip`; Ansicht
  `/export` mit Monatsauswahl und Jahresauswahl für die Verpackungsmengen-CSV (P5.11, KONZEPT §7.15).
  - Akzeptanz:
    - Export eines Testmonats mit Fixture-Belegen (`seed = false`, Serien `RE`/`GS` der Test-DB) entspricht byte-genau
      der Fixture `tests/fixtures/csv/2026-10.csv`; zweiter Export ist byte-identisch (R-124).
    - Mit Fixture-Belegen `seed = true` (Serien `BSP-RE`/`BSP-GS`, analog SEED-SPEC §9) und `SEED_PREVIEW_MODE=true`
      enthalten CSV und ZIP keinen `BSP-`-Beleg; mit dem echten Bestand prüft P8.21.
    - CSV enthält kein `@` und keinen Kund:innen-Namen aus den Fixtures.
    - ZIP enthält genau die Belege des Monats.
  - Tests: `tests/int/legal/monthly-export.int.spec.ts` (Titel „R-124 …“), `tests/e2e/admin/export.e2e.spec.ts`.
  - Ohne Jutta: –

- [ ] **P5.25 DATEV-Buchungsstapel** – `src/lib/export/datev.ts`: Buchungsstapel im Format EXTF (Version 700,
  Kategorie 21) je Monat: Kopfzeile mit Berater-/Mandantennummer, Wirtschaftsjahr-Beginn, Zeitraum; je Beleg eine
  Buchung (Umsatz, Soll/Haben, Konto, Gegenkonto, Belegdatum, Belegfeld 1 = Belegnummer, Buchungstext ohne
  Personendaten), Stripe-Gebühren als eigene Buchungen; nie Beispieldaten, auch nicht bei wirksamem
  `SEED_PREVIEW_MODE` (wie P5.24). Einstellungen `settings.export.datev.*` (DATENMODELL §7.1, seit P1 im Schema; hier nur
  prüfen): `consultantNumber`, `clientNumber`, `fiscalYearStart`, `revenueAccount`, `stripeTransitAccount`,
  `bankAccount`, `feeAccount`; ohne diese Werte ist der Knopf ausgegraut mit Hinweis „Konten mit der Steuerberatung
  festlegen“ (KONZEPT §7.15). Kodierung Windows-1252 und Feldformate als [Annahme] in `docs/OFFENE-PUNKTE.md`
  („Steuerberatung prüft den ersten Import“). Endpunkt `GET /api/admin/export/{JJJJ-MM}.datev.csv`.
  - Akzeptanz:
    - Ohne Konten → 409 und ausgegrauter Knopf; mit Test-Konten entspricht die Datei der Fixture, zweiter Export
      byte-identisch, keine Namen oder E-Mails, kein `BSP-`-Beleg (R-124).
  - Tests: `tests/int/legal/datev-export.int.spec.ts` (Titel „R-124 DATEV …“).
  - Ohne Jutta: Kontenrahmen und Nummern legt die Steuerberatung fest; Aufgabe als A51 ff. in AUFGABEN ergänzen.

- [ ] **P5.26 Monatsabschluss und Belegprüfung** – Task `monthlyClose` (Queue `documents`, monatlich am 1. ab 04:00
  Berlin): für den Vormonat CSV und Rechnungs-ZIP erzeugen und privat ablegen (`private-uploads`, Zweck
  `monthly_export`, DATENMODELL §6.4; Aufbewahrung L-07), A11 mit Summen und Hinweis, falls manuelle Monatssummen
  fehlen; je Monat nur einmal. Task `invoiceIntegrityCheck` (Queue `maintenance`, monatlich am 1. ab 04:00 nach
  `monthlyClose`): SHA-256 aller
  ausgestellten RE/GS-PDFs neu berechnen und mit der DB vergleichen; Abweichung oder fehlende Datei → A12 mit
  Belegnummern. R-122 prüfen bzw. ergänzen: Beleg-PDFs werden nur geschrieben, wenn das Objekt nicht existiert
  (Speicher-Adapter `putIfAbsent`: `local` mit `fs.open(…, 'wx')`, `s3` mit `IfNoneMatch: '*'`), Pfad
  `private/invoices/{JJJJ}/{Nummer}.pdf` (ARCHITEKTUR §3.3).
  - Akzeptanz:
    - Zweiter Schreibversuch auf ein vorhandenes Beleg-PDF schlägt fehl; eine manipulierte Datei wird erkannt und
      gemeldet (R-122).
    - Lauf am 01.11. 04:00 legt genau ein Archiv für Oktober an und sendet genau eine A11; zweiter Lauf ohne Wirkung
      (AK-8-01).
  - Tests: `tests/int/legal/invoice-integrity.int.spec.ts` (Titel „R-122 …“), `tests/int/jobs/monthly-close.int.spec.ts`.
  - Ohne Jutta: –

- [ ] **P5.27 „Texte“: Mail-Bausteine und Vorlagen** – Ansicht `/texte` (KONZEPT §7.13) als Übersicht mit Bereichen
  Seiten und FAQ („kommt in P8“), Rechtstexte („kommt in P6“), Mail-Bausteine und Vorlagen. Mail-Bausteine DE/EN mit
  Übersetzen-Knopf: Signatur, Abhol-Vorlage (`settings.pickup.instructions`), Antwortzeit-Satz der
  Anfrage-Bestätigung (Standard „Ich melde mich meist innerhalb einer Woche.“) in den Feldern `site-texts.emails.signature`
  und `site-texts.emails.inquiryResponseTime` (DATENMODELL §7.2, seit P1 im Schema; hier nur prüfen). Vorlagen zum
  Kopieren bzw. als `mailto:` in
  `src/lib/legal/templates.ts` als „Arbeitsfassung“ gekennzeichnet: Reklamation Bruch (Fotos anfordern; für Jutta:
  „bis {Datum} bei DHL reklamieren“ = Versanddatum + 7 Tage), Hinweis Reparatur/Ersatz, § 37 VSBG, Bitte um IBAN für die
  Vorkasse-Erstattung. P6.11 ersetzt Reparatur- und VSBG-Vorlage durch die protokollierten Mails M12
  `complaint_repair_choice` und M13 `dispute_vsbg`.
  - Akzeptanz:
    - Jede Vorlage rendert mit einer Fixture-Bestellung (versendet, analog O10; für „Bitte um IBAN“ eine stornierte
      Vorkasse-Bestellung analog O07) ohne offene Platzhalter und ohne Treffer für V-01, V-09, V-11; mit den echten
      Ankern prüft P8.21.
    - Geänderte Signatur erscheint in der nächsten M06 (Snapshot).
  - Tests: `tests/unit/legal/admin-templates.unit.spec.ts`, `tests/int/email/signature.int.spec.ts`.
  - Ohne Jutta: Texte sind Entwürfe in Juttas Ton (E-62); sie passt sie selbst an.

- [ ] **P5.28 „Heute“** – Start-Ansicht `/heute` (KONZEPT §7.3) über einen Dienst `getTodaySummary(now)` in
  `src/lib/admin/today.ts` (wenige gebündelte Abfragen): Kacheln mit Zahl und Link – Zu packen, Vorkasse offen (davon
  heute fällig), Abholung, Widerrufe offen (nächste Frist), Neue Anfragen. Hinweise rot/gelb mit Link (KONZEPT §7.3):
  Umsatz-Wächter-Stufe, Rechtstexte älter als 1 Jahr (ab P6 je Typ), Stücke und Bestellungen mit `adminAttention`
  (rot, mit Grund aus `ATTENTION_REASONS`, z. B. `conformity_revoked` „Konformitätserklärung widerrufen“ am Stück,
  `payment_amount_mismatch` „abweichender Zahlbetrag“ an der Bestellung; Link auf `/stuecke/:id` bzw.
  `/bestellungen/:id`), „Aufbewahrungssperren zur Prüfung“ (Datensätze mit `privacy.legalHold`, deren letzte Prüfung –
  `legalHoldReviewedAt`, sonst `legalHoldSince` – mindestens 6 Monate zurückliegt; dieselbe Regel nutzt der Task
  `legalHoldReview` in P6.15), fehlgeschlagene Mails, fehlgeschlagene Jobs (letzte 24 h aus `job_runs`), offene
  Anfechtungen (Bestellungen mit Status `disputed`), Abholungen > 14 Tage, fehlende Monatssummen des Vormonats,
  Kostenwarnung (letzter Monatswert aus `costs.monthlyEntries` ≥ `costs.warningThresholdCents`, E-05 „ab 30 €“, Link
  Einstellungen → Kosten aus P5.22a), „Beispieldaten vorhanden“ (Anzahl, Link Einstellungen → Beispieldaten),
  Startklar-Prüfung (Platzhalter „kommt in P10“; P10.14 ersetzt ihn durch das echte Ergebnis).
  Letzte 5 Bestellungen (Nummer, Betrag, Status); Schnellknopf „Neues Stück“.
  - Akzeptanz:
    - Mit Fixtures analog SEED-SPEC §17 „Admin Heute“ (gleichartige Datensätze wie O14 `paid`, O12 `packed`, O13
      `awaiting_prepayment`, O09 `ready_for_pickup`, O03 `disputed`, W3–W5 offen, A4 `new`; `seed = true`) und fester
      Uhr: Zu packen 2, Vorkasse offen 1, Abholung 1, Widerrufe offen 3 (nächste Frist = der W3-Fall), Neue Anfragen 1,
      roter Hinweis Anfechtung, Hinweis „Beispieldaten vorhanden“; mit den echten Ankern und den Zahlen aus SEED-SPEC
      §17 bei kanonischem `SEED_NOW` prüft P8.21.
    - Fixture-Stück mit `adminAttention` `conformity_revoked` und Fixture-Bestellung mit `payment_amount_mismatch`
      erscheinen als rote Hinweise mit Link; ohne `adminAttention.flag` kein Hinweis.
    - Fixture-Bestellung mit `privacy.legalHold` und `legalHoldSince` vor 6 Monaten erscheint unter
      „Aufbewahrungssperren zur Prüfung“; mit `legalHoldSince` vor 5 Monaten oder `legalHoldReviewedAt` vor einem Monat
      nicht.
    - Kostenwarnung bei letztem Monatswert 30,00 € (Standard-Schwelle), keine bei 29,99 €.
    - Seite lädt bei 390×844 ohne horizontales Scrollen, axe ohne `serious`/`critical`.
  - Tests: `tests/int/admin/today.int.spec.ts`, `tests/e2e/admin/today.e2e.spec.ts` (`@a11y`).
  - Ohne Jutta: –

- [ ] **P5.29 Verwaltung als installierbare Web-App (PWA)** – Route-Handler
  `src/app/(payload)/admin/manifest.webmanifest/route.ts` und `src/app/(payload)/admin/sw.js/route.ts` (ARCHITEKTUR
  §2.1, §8.4), ausgeliefert unter `ADMIN_ROUTE/manifest.webmanifest`
  und `ADMIN_ROUTE/sw.js`: Name „Planet Claire Werkstatt“, Kurzname „Werkstatt“, `start_url` = `ADMIN_ROUTE/heute`,
  `scope` = `ADMIN_ROUTE/`, `display: standalone`, Icons 192/512 (`purpose: any maskable`) und Apple-Touch-Icon 180 mit
  der Planet-Marke auf Matte-Grün `#2F6B4C` (DESIGN §12.6), erzeugt mit sharp über `scripts/art/admin-icons.ts`, abgelegt
  in `src/admin/pwa/` und nur unter dem Admin-Pfad ausgeliefert (kein Dateiname unter `public/` verrät den Pfad).
  Service Worker ohne Daten-Cache, ohne Push, `fetch` wird durchgereicht. `<link rel="manifest">` und die Registrierung
  nur im Admin-Layout. Lighthouse hat sein PWA-Audit entfernt; AK-7-06 wird über die Chrome-Schnittstelle
  `Page.getInstallabilityErrors` nachgewiesen.
  - Akzeptanz:
    - Chromium (CDP) meldet für `ADMIN_ROUTE/heute` nach Anmeldung keine Installierbarkeits-Fehler (AK-7-06).
    - `/manifest.webmanifest`, `/admin/manifest.webmanifest` und `/sw.js` → 404; auf öffentlichen Seiten gibt es keine
      Service-Worker-Registrierung (T-04, R-130).
    - `sw.js` enthält weder `caches.` noch `push`; der Admin-Pfad steht in keiner Datei unter `public/` und nicht in
      `.next/static` (T-07).
  - Tests: `tests/e2e/admin/pwa.e2e.spec.ts` (Titel „AK-7-06 …“, Projekt `desktop`), `tests/unit/admin/sw.unit.spec.ts`.
  - Ohne Jutta: Installation auf ihrem Handy zeigt die Owner-Anleitung in P11.

### Phasen-Abnahme

- [ ] Alle Aufgaben P5.1–P5.29 (inkl. P5.22a) erledigt; `pnpm check`, `pnpm test:int`, `pnpm test:e2e` (Projekte
  `desktop` und `iphone-15`) und `pnpm build` lokal grün.
- [ ] Einzige P5-Migration `p5_job_runs` (DATENMODELL §10.1) rückwärtsverträglich (ARCHITEKTUR §6.7 Nr. 5),
  `pnpm check:migrations` ohne Drift, `pnpm generate:types` und `pnpm generate:importmap` committet; geprüft, dass die
  übrigen genutzten Strukturen seit P1 im Schema liegen (DATENMODELL §10.1: `orders.pickup.messageText`,
  `settings.export.datev.*`, `site-texts.emails.signature`/`inquiryResponseTime`, `REFUND_REASONS` mit `breakage` und
  `admin_cancellation`, `AUDIT_ACTIONS` mit `inquiry_status_changed`) und die Admin-Endpunkte
  (`item-number-status`, `packaging-report`, `compliance/template.pdf`, `export`) in ARCHITEKTUR §2.5 stehen; ARCHITEKTUR
  §1.2 (`@zxing/browser`, `fflate`, `bwip-js`) nachgezogen; `CARRIER_DRIVER=manual` in `.env.example` vorhanden.
- [ ] `LEGAL_TRACE_PHASE = 5` in `tests/unit/legal/traceability.unit.spec.ts`; der Test ist grün (jede R-ID mit
  frühester Phase ≤ 5 und Test-Art ≠ nur „manuell“ steht in mindestens einem Testtitel).
- [ ] Nachweise im PR-Text: AK-5-01/AK-5-02 (Produkt, Bestellung, Anfrage), AK-6-01 (A01–A17), AK-7-01 bis AK-7-06,
  AK-8-01, AK-8-02, AK-8-04, EK-08 sowie die R-IDs aus „Referenzen“ je mit Testdatei.
- [ ] CI grün: Der Phasenende-Commit (z. B. `chore(P5): finish phase [ci:full p5]`, der letzte Commit ohne
  `[skip ci]`) hat `CI / quick`, `ci-full` (`e2e-full` inkl. `@a11y` und `@privacy`, `quality`) und `preview-export`
  grün durchlaufen. Dieses Häkchen setzt ein reiner Doku-Commit mit `[skip ci]`, nachdem der Lauf grün ist.
- [ ] Vorschau-Artefakt `planet-claire-vorschau-p5-<sha7>` enthält Bildschirmfotos aller in P5 gebauten Admin-Ansichten
  (390×844); `/tattoo` erscheint als „kommt in P7“.
- [ ] `docs/FORTSCHRITT.md` mit Phasen-Eintrag; PR-Beschreibung nach Vorlage aktualisiert; neue Annahmen in
  `docs/OFFENE-PUNKTE.md` (mindestens: Deutsche-Post-Tracking-Vorlage, DATEV-Format, Verpackungsgewichte,
  zusammengeführte Umsatz-Wächter-Stufen, Telefon-Platzhalter speicherbar, Kostenwarnung ab Erreichen der Schwelle,
  „Shop öffnen“ in Produktion bis P10.14 gesperrt); neue Jutta-Aufgaben als A51 ff. in
  `docs/owner/AUFGABEN.md`, soweit nicht schon vorhanden.

## P6 – Recht & Datenschutz

**Ziel:** Alle Pflichtseiten stehen auf Deutsch und Englisch mit versionierten, klar gekennzeichneten Platzhalter- bzw.
Arbeitstexten; jede Seite hat den Link „Vertrag widerrufen“; die zweistufige Widerrufsfunktion nach § 356a BGB
bestätigt sofort per Mail, landet im Posteingang und wird über den Zahlungsadapter erstattet; Reklamation und
Streitbeilegung haben protokollierte Vorlagen; DSGVO-Werkzeuge (Auskunft, Löschen/Einschränken mit
Aufbewahrungssperre, Fristen) und alle Löschjobs laut LOESCHKONZEPT laufen; Verbotsmuster und Drittanbieter-Requests
werden automatisch geprüft; jede Rechtsanforderung bis P6 ist mit einem Test nachgewiesen; die Kanzlei-Mappe ist fertig.

**Voraussetzungen:** P5 abgeschlossen (Verwaltungs-Gerüst, Job-Wecker mit `job_runs`, `notifyAdmin`, Bestell-Detail,
„Texte“, „Widerrufe“ lesend, Einstellungen, Export); aus P4 Outbox, Gutschriften GS, Zahlungsadapter mit `refund`,
Rechtstext-PDFs als Bestell-Anhänge; aus P2 Rechtsrouten als Gerüst und Footer-Link. Namen und Schema wie in P5
beschrieben (DATENMODELL §10.1); eigene P6-Migration nur `p6_legal_snippets_complaints`. Beispielbestand wie in P5 nur
der Mini-Satz aus P1.30; Bestellungen, Widerrufe, Kund:innen und Protokolle des Beispielbestands legt P8 an. Es gilt die
Arbeitsregel „Beispielbestand vor P8“ am Planbeginn: Kriterien mit Seed-Datensätzen prüfen gleichartige Test-Fixtures
(Fixture-Dateien unter `tests/`); mit den echten Ankern prüft P8.21.

**Referenzen:** E-11, E-27, E-29, E-40, E-41, E-42, E-43, E-44, E-46, E-50, E-51; R-001, R-002, R-010, R-011, R-012,
R-014, R-015, R-020, R-021, R-023, R-049, R-072, R-084, R-090–R-096, R-110–R-112, R-123, R-130, R-131, R-134, R-137,
R-138, R-150–R-156, V-01–V-31; KONZEPT §3.13, §3.14, §3.16, §5.3, §5.4, §6.1–§6.4, §7.10, §7.13, §7.15, §8.2, §8.3,
AK-3-11, AK-3-12, AK-6-04, EK-04, EK-05, EK-06; DATENMODELL §5, §6.8, §6.11, §6.12, §6.22, §6.23, §6.26–§6.29, §7.1,
§9.4, §10.1, §11, §12; ARCHITEKTUR §2.5, §7.4 (T-03, T-04, T-16), §8.1, §8.5–§8.7, §8.11, Anhang A.2, A.3; DESIGN KO-04,
KO-12, §9.7 (`legal`), §11.7, AK-DS-09; LOESCHKONZEPT §1–§6; DIENSTE §6, §7; KANZLEI-BRIEFING §1, §8, §11, §12, §16–§18;
ANFORDERUNGEN §3, §5, §6, §7.

### Aufgaben

- [ ] **P6.1 Datenmodell Recht, Teil 1: Migration Rechtsbausteine und Reklamationen, Prüfung der Rechtsfelder** –
  Migration `p6_legal_snippets_complaints` (DATENMODELL §10.1): Collections `legal-snippets`
  (`src/collections/LegalSnippets.ts`, Felder, Access und Indizes laut DATENMODELL §6.28: `key` aus
  `LEGAL_SNIPPET_KEYS`, `version`, `status`, `validFrom`, `text` lokalisiert, `origin`, `changeNote`,
  `sha256De`/`sha256En`, `activatedAt`/`supersededAt`; partieller UNIQUE-Index je Schlüssel, öffentlich lesbar nur
  `status = active`) und `complaints` (`src/collections/Complaints.ts`, DATENMODELL §6.29), Feld
  `private-uploads.relatedComplaint`, Join `orders.complaints`, SQL aus DATENMODELL §9.3. Grund-Seed (`seed:base`,
  `seed = false`): je Schlüssel eine aktive Fassung v1 – mit Arbeitsfassung aus ANFORDERUNGEN §6 `origin = draft`
  (EN sinngemäß), ohne Arbeitsfassung (u. a. `complaint.repairChoice`, `inquiry.autoReply`, `commission.offer`,
  `privacyRequest.accessResponse`, `privacyRequest.erasureResponse`) „PLATZHALTER – Text folgt von der Kanzlei.“ mit
  `origin = placeholder`. `getSnippet(key, locale, at)` in `src/lib/legal/snippets.ts` liest ab jetzt die Collection
  (Rückgabe `{ text, version, sha256 }` unverändert); die Konstanten aus P3–P5 entfallen, Bestellungen behalten ihre
  `draft-1`-Einträge. Prüfen, dass seit P1 vorhanden ist: `legal-texts.origin`/`isPlaceholder`/`changeNote`/
  `contentSha256De`/`contentSha256En`/`pdfDe`/`pdfEn` (§6.12); `settings.legal.reviews`, `business.lucidNumber`,
  `business.packagingScheme`, `processorAgreements`, `retention.invoiceYears` (§7.1); `withdrawals.channel`,
  `closeReason`/`closeNote`, `returnProofReceivedAt`, `spam.*` (§6.11); alle P6-Schlüssel in `EMAIL_TEMPLATES`,
  `complaint_photo`/`return_photo`/`processor_agreement` in `PRIVATE_UPLOAD_PURPOSES`, die P6-Werte in `AUDIT_ACTIONS`
  (§4).
  - Akzeptanz:
    - T-14 ohne Drift; T-15: anonym nur aktive Bausteine lesbar, `complaints` anonym → 403.
    - Aktive Baustein-Version: Update → 403; neue Version aktivieren → alte `superseded`; eine Bestellung verweist
      weiter auf die alte Version (DM-SNIP-02, R-012).
    - Jeder Schlüssel aus `LEGAL_SNIPPET_KEYS` existiert nach `pnpm seed:base` genau einmal aktiv (DM-SNIP-01).
  - Tests: `tests/int/legal/snippets.int.spec.ts` (Titel „R-012 Bausteine …“), Erweiterung T-14/T-15.
  - Ohne Jutta: Kanzlei-Wortlaut kommt in P11; bis dahin Arbeitsfassungen (`origin = draft`) bzw. Platzhalter.

- [ ] **P6.2 Datenmodell Recht, Teil 2: Datenschutz-Anfragen, Löschprotokoll, Reklamationen, Legal Hold** – prüfen
  und verdrahten, was seit P1 im Schema liegt (LOESCHKONZEPT §5): `privacy-requests` (DATENMODELL §6.26: `reference`
  `DS-JJJJ-NNNN`, `types`, `channel`, `receivedAt`, `dueAt`, `extendedDueAt` mit `extensionReason`/
  `extensionNotifiedAt`, `status` aus `PRIVACY_REQUEST_STATUSES`, Identitätsprüfung, `exportFile` `data_export`,
  `remindersSent`, `retainUntil`), `deletion-log` (§6.27: `entityCollection`, `entityId`, `ruleId`, `action` aus
  `DELETION_ACTIONS`, `trigger`, `taskSlug`, `privacyRequestRef` – keine Inhalte, keine Personendaten; Schreiben nur
  über `writeDeletionLog` in `src/lib/retention/log.ts`), `privacyFields()` an `orders`, `withdrawals`, `inquiries`
  (§5: `privacy.processingRestricted`, `legalHold`, `legalHoldReason`, `legalHoldSince`, `legalHoldReviewedAt` …),
  `timestamps.finalStatusAt` an `orders` (§6.8.1, Fristbeginn L-05). Reklamationen (`complaints`, P6.1): Hooks für
  `carrierClaimDueAt` und `warrantyEndsAt`, Audit `complaint_changed`; das virtuelle Feld `orders.warrantyEndsAt`
  rechnet die Reparatur-Verlängerung aus der Reklamation ein (§6.8.1). R-154: `orders`, `checkouts`, `withdrawals`,
  `complaints`, `inquiries`, `privacy-requests`, `email-log`, `consent-log`, `private-uploads` und `tattoo-gallery`
  (Personendaten, Einwilligung) ohne `versions`/`drafts` und ohne `trash` (DATENMODELL §1.6, LOESCHKONZEPT §1).
  - Akzeptanz:
    - T-14 ohne Drift; T-15: anonymer Zugriff auf `privacy-requests`, `deletion-log`, `complaints` → 403.
    - Unit-Test liest die Payload-Konfiguration: keine der genannten Collections hat `versions` oder `trash` (R-154).
    - `warrantyEndsAt` mit und ohne gewählte Reparatur korrekt; `carrierClaimDueAt` = Zustellung + 7 Tage (DM-CMP-01).
  - Tests: `tests/unit/legal/no-versions.unit.spec.ts` (Titel „R-154 …“), `tests/int/legal/complaints-model.int.spec.ts`,
    Erweiterung T-14/T-15.
  - Ohne Jutta: –

- [ ] **P6.3 Rechtstext-Renderer: Tokens, Bereinigung, Aktivierung, PDF** – `src/lib/legal/render.ts` (vorhandene
  Teile aus P4 wiederverwenden). Kanonische Tokens nach R-012 und KANZLEI-BRIEFING §16.3: `{{name}}`, `{{street}}`,
  `{{postalCode}}`, `{{city}}`, `{{email}}`, `{{phone}}`, `{{wIdNr}}`, `{{ustIdNr}}`, `{{siteUrl}}`, `{{withdrawalUrl}}`
  (absolute URL von R26 in der Sprache der Fassung), `{{shippingTable}}`, `{{deliveryTime}}`, `{{vorkasseDays}}`,
  `{{returnCostsNote}}` (Quellen laut DATENMODELL §6.12) und für Bausteine die Kontext-Tokens laut DATENMODELL §6.28.
  Die Liste ist geschlossen: keine weiteren Tokens, keine weiteren Schreibweisen; die Auftragsverarbeiter-Tabelle der
  Datenschutzerklärung ist **kein** Token, sondern eine eigene Komponente (P6.21). `{{STEUERNUMMER}}` wird nie aufgelöst
  (Steuernummer nie öffentlich, E-46, R-020); jedes unbekannte oder nicht ersetzbare Token → `LegalRenderError`,
  Veröffentlichen gesperrt, öffentliche Seiten zeigen nie rohe Tokens. HTML-Bereinigung mit Allowlist aus
  KANZLEI-BRIEFING §16 über `sanitize-html` (exakte Version, ARCHITEKTUR §1.2). Prüfungen vor dem Veröffentlichen
  (KONZEPT §7.13):
  `widerrufsbelehrung` enthält `{{withdrawalUrl}}` oder die R26-URL; gesperrt bei `ec.europa.eu/consumers/odr` und im
  KU-Modus bei V-02-Treffern. Dienst `activateLegalText(id, { validFrom, now })` in `src/lib/legal/activate.ts` (auch
  für Bausteine): `scheduled` bzw. `active`, Vorgänger → `superseded` in einer Transaktion, `activatedAt` als Beginn der
  Prüf-Erinnerung (P6.20); Task `activateScheduledLegalTexts` mit Weckzeitpunkt (`jobAlarm.bump(validFrom)`); Task
  `renderLegalTextPdf` (DE/EN, lokale Schriften, `contentSha256De`/`contentSha256En`) → `documents`; Endpunkte `GET
  /api/legal/[type].pdf?locale=` und `GET /api/legal/[type]/[versionId].pdf` (ARCHITEKTUR §2.5). Bausteine nutzen
  denselben Renderer.
  - Akzeptanz:
    - R-012: v1 aktivieren, Update → 403; v2 aktivieren → v1 `superseded`; `contentSha256De` stimmt; Text mit
      `{{unknown}}`, `{{NAME}}`, `{{processorTable}}` oder `{{STEUERNUMMER}}` → Render-Fehler; die Token-Liste des
      Renderers ist identisch mit R-012, DATENMODELL §6.12 und KANZLEI-BRIEFING §16.3.
    - R-095: gerenderte Platzhalter-Belehrung enthält `https://…/vertrag-widerrufen` aufgelöst und die Telefonnummer.
    - Geplante Version wird am `validFrom` durch den Task aktiv (vorgestellte Uhr, doppelter Lauf ohne Wirkung).
  - Tests: `tests/int/legal/legal-texts.int.spec.ts` (Titel „R-012 …“), `tests/unit/legal/render-tokens.unit.spec.ts`
    (Titel „R-095 …“), `tests/int/jobs/activate-legal-texts.int.spec.ts`.
  - Ohne Jutta: –

- [ ] **P6.4 Rechtstexte und Bausteine in der Verwaltung** – Bereich „Rechtstexte“ unter `/texte` (KONZEPT §7.13): je
  Typ aktuelle Version, „Stand“, Herkunft (Platzhalter/Arbeitsfassung/Kanzlei), Alter, Anzahl Bestellungen mit dieser
  Version (`orders.legalTextVersions.*`). „Neue Version“: Text DE einfügen, EN optional (HTML oder Text), „Vorschau“
  (gerendert mit Tokens, Fehlerliste), „Veröffentlichen“ sofort oder ab Datum (Dialog „Ab {Datum} gilt dieser Text für
  neue Bestellungen.“); „Geprüft, keine Änderung“ je Typ setzt `legal.reviews[type].reviewedAt` (Audit
  `legal_review_confirmed`). Gleicher Ablauf für die Bausteine (Liste nach Schlüssel, Spalte „Kanzlei ja/nein“ aus
  `LEGAL_SNIPPET_REQUIRES_LAWYER` = ANFORDERUNGEN §6). Standard-Ansichten für aktive und
  abgelöste Versionen nur lesend (KONZEPT §7.16).
  - Akzeptanz:
    - Neue AGB-Version bei 390×844 veröffentlicht; danach nicht mehr änderbar; Anzahl Bestellungen je Version stimmt mit
      den Fixture-Bestellungen überein (Fixture analog den Seed-Bestellungen mit `legalTextVersions` = v1; mit dem
      echten Bestand prüft P8.21).
    - Vorschau zeigt Token-Fehler, ohne zu speichern.
  - Tests: `tests/e2e/admin/legal-texts.e2e.spec.ts`, `tests/int/legal/legal-texts-admin.int.spec.ts`.
  - Ohne Jutta: –

- [ ] **P6.5 Rechtsseiten R21–R24, R27, Kontakt R20 und Kurz-URLs** – Seiten `legal-notice`, `privacy`, `terms`,
  `right-of-withdrawal`, `declarations-of-conformity`, `contact` unter `src/app/(frontend)/[locale]/` (Registry-Status
  von `planned` auf gebaut): statisch mit Tag `legal:<type>`, ohne JavaScript vollständig lesbar, genau eine `h1`, „Stand:
  {Datum der Version}“, PDF-Download der aktuellen Version (außer Impressum), Preset `legal` der Tuschelinie (DESIGN
  §9.7). Solange `origin ≠ lawyer`: Banner „PLATZHALTER – nicht rechtsverbindlich“ oben (R-002); Platzhalter-Gliederung
  laut KANZLEI-BRIEFING §1, unter jeder Überschrift nur der Satz „Text folgt von der Kanzlei.“ (R-002); Anker-IDs der
  Datenschutzerklärung nach KANZLEI-BRIEFING §11.10; unter dem Text der Datenschutzerklärung ein Platz für die
  Auftragsverarbeiter-Tabelle (Komponente und Einbau in P6.21). EN-Seiten: EN-Fassung mit Baustein
  `translation.disclaimer`; fehlt sie, deutscher Text mit „Only available in German“ (R-015). Impressum aus
  `settings.business` über Tokens inkl. `{{phone}}`, nie die Steuernummer (R-020). Widerrufsbelehrung mit `{{phone}}`,
  Muster-Formular als HTML und PDF und Link „Vertrag widerrufen“ (R-095). Telefonnummer (R-021): nur in Impressum,
  Widerrufsbelehrung und in der Anbieterkennung der Bestellbestätigungen M01/M02 (P4-Renderer prüfen bzw. ergänzen), auf
  keiner anderen Seite und in keiner anderen Mail. Konformitätserklärungen R27 laut KONZEPT
  §3.14 inkl. Leer-Text. Kontakt R20 (KONZEPT §3.13, R-023): Inhalt aus `pages` Schlüssel `contact`, E-Mail als
  `mailto:` und markierbarer Text mit „Adresse kopieren“, Instagram-Profil- und DM-Link, nur Bezirk, kein Formular, keine
  Karte, kein `iframe`. Prüfen, dass die Weiterleitungen aus P2.2 (ARCHITEKTUR §2.3) für die gebauten Rechtsseiten
  greifen: die sieben Kurz-URLs aus `shortLinks` (R-010: `/impressum`, `/datenschutz`, `/agb`, `/widerrufsbelehrung`,
  `/versand`, `/vertrag-widerrufen`, `/widerruf`) → 308 auf das DE-Ziel; `/en/<de-slug>` → 308 auf den EN-Slug. Prüfen,
  dass `WarrantyNotice` (R-049) auf R25 DE/EN steht.
  - Akzeptanz:
    - Jede Rechtsroute DE/EN → 200, eine `h1`, Textkörper mit `javaScriptEnabled: false` sichtbar; jede Kurz-URL → 308
      auf das Ziel (R-010).
    - Mit Platzhaltern zeigt jede Rechtsseite den Banner (R-002); `/en/terms` ohne EN-Version zeigt den Hinweis (R-015).
    - Impressum enthält alle gesetzten Stammdaten und keine Steuernummer (R-020).
    - Mit gesetzter Test-Telefonnummer zeigen Impressum und Widerrufsbelehrung DE/EN sie über `{{phone}}`, M01 und M02 enthalten
      sie in der Anbieterkennung; keine andere Registry-Route und keine andere Kund:innen-Mail enthält sie (R-021).
    - Kontaktseite: E-Mail-Text vorhanden, kein `<form>`, kein `iframe` (R-023).
  - Tests: `tests/e2e/legal/pages.e2e.spec.ts` (Titel „R-010 …“, „R-002 …“, „R-015 …“, „R-020 …“, „R-021 …“, „R-023 …“,
    „R-049 …“), `tests/unit/legal/phone.unit.spec.ts` (Titel „R-021 …“: Token `{{phone}}` in Impressum und
    Widerrufsbelehrung, M01-Anbieterkennung, Snapshots der übrigen Kund:innen-Mails ohne Nummer).
  - Ohne Jutta: Kanzleitexte werden in P11 eingespielt; Stammdaten sind Platzhalter.

- [ ] **P6.6 Footer und „Vertrag widerrufen“ überall** – KO-04 `SiteFooter` mit der Unterkomponente `LegalFooter` mit
  echten Zielen fertigstellen (DESIGN §13 Zeile P6): „Vertrag widerrufen“ als hervorgehobener Knopf-Link,
  EN-Beschriftung „Withdraw from contract here“ (R-090), Links Impressum, Datenschutz, AGB, Widerrufsbelehrung, Versand &
  Zahlung, Kontakt, Konformitätserklärungen (Fußlink nur, wenn Erklärungen existieren); auch in `not-found.tsx`,
  `error.tsx`, Kasse, Danke, Bestellstatus. Alle bestellbezogenen
  Mailvorlagen (M01–M09) enthalten den Link; Danke- und Statusseite ebenso.
  - Akzeptanz:
    - Für jede Registry-Route DE/EN bei 390×844 und 1440×900, mit `reducedMotion` `reduce` und `no-preference`: 6
      Pflichtlinks mit korrektem `href`, sichtbar, `elementFromPoint` in der Linkmitte liefert den Link (R-011,
      AK-DS-09, AK-3-11), Knopf ≥ 44 px hoch.
    - Jede Bestell-Mailvorlage enthält den Link auf R26 (R-090).
  - Tests: `tests/e2e/legal/footer.e2e.spec.ts` (Titel „R-011 …“, „R-090 …“, „AK-3-11 …“),
    `tests/unit/legal/mail-withdrawal-link.unit.spec.ts` (Titel „R-090 Mails …“).
  - Ohne Jutta: –

- [ ] **P6.7 Widerrufs-Dienst: speichern, zuordnen, sofort bestätigen** – `src/lib/legal/withdrawal.ts`
  `submitWithdrawal(input, { now })` (KONZEPT §5.4, R-093, DATENMODELL §6.11): zod-Prüfung; unveränderlicher Datensatz
  mit `reference` `WR-JJJJ-NNNNN` aus `withdrawal_number_seq`, `receivedAt` = Serverzeit, Name, Vertragsangaben,
  E-Mail, Stück-Auswahl bzw. Freitext, Grund, Sprache, `channel = online_form`, `submissionSnapshot`, `refundDueAt`;
  **keine** IP, kein IP-Hash, kein User-Agent im Datensatz (R-093). Automatische Zuordnung nur, wenn Bestellnummer
  **und** E-Mail (Groß-/Kleinschreibung egal) passen (`auto_matched`), sonst `needs_manual_match`. Bestellung: O11 mit
  `statusBeforeWithdrawal`; bei `awaiting_prepayment` O4 (`withdrawn`) und Widerruf `closed` mit `closeReason =
  unpaid_order_cancelled` (W5), Stücke frei, keine M04. M08 (`withdrawal_receipt`, KONZEPT §6.3) im selben Request
  direkt nach dem Commit: gesamter Inhalt der Erklärung, Eingang als „12.10.2026, 14:03 Uhr (MESZ)“, Vorgangsnummer,
  Bausteine `withdrawal.receiptNotice` und `withdrawal.returnInfo`, Rücksendeadresse (`business.returnAddress` bzw.
  Geschäftsadresse), Erstattungshinweis;
  bei unbezahlter Vorkasse „Deine Bestellung ist damit storniert. Bitte nichts überweisen.“ Scheitert der Versand:
  `sendEmail` wiederholt höchstens alle 5 min bis 24 h nach Eingang (R-093, ARCHITEKTUR Anhang A.3), ab dem 2.
  Fehlversuch A12 und Hinweis unter „Heute“, nach 24 h `failed` und erneut A12. A04 (`admin_withdrawal_received`) an
  Jutta mit Kopie des M08-Inhalts. Rate-Limit `withdrawal_submit` 30/h je IP-Hash nur in `rate_limit_hits` (ARCHITEKTUR
  §8.5), Honeypot ohne Mindestzeit (R-134).
  - Akzeptanz:
    - Update am Widerrufs-Datensatz → Fehler (R-093, DM-WDR-03); Mail enthält Zeitstempel-Text und alle Eingaben;
      A04 geht an die Admin-Adresse.
    - Unbekannte Bestellnummer: Datensatz `needs_manual_match`, M08 trotzdem versendet mit Datum und Uhrzeit (AK-6-04).
    - Nach dem Bestätigen existiert genau ein unveränderlicher Datensatz und M08 steht im Mail-Log (AK-3-12).
    - Zeitstempel über die Zeitumstellung korrekt (MESZ/MEZ); Honeypot gefüllt → 200, nichts gespeichert (R-134).
  - Tests: `tests/int/legal/withdrawal.int.spec.ts` (Titel „R-093 …“, „AK-6-04 …“, „AK-3-12 …“, „R-134 Widerruf …“),
    `tests/int/email/withdrawal-retry.int.spec.ts` (Mail-Treiber mit Fehlermodus, vorgestellte Uhr).
  - Ohne Jutta: –

- [ ] **P6.8 Widerrufsfunktion R26: Schritt 1, Auswahl, Schritt 2, Bestätigung** – Seite `withdraw-from-contract`
  (DE `/de/vertrag-widerrufen`) mit Server Actions, funktioniert ohne JavaScript (KONZEPT §3.16, R-091, R-092): Schritt 1
  Pflichtfelder Name, Angaben zum Vertrag (Hinweis „z. B. PC-2026-00017 oder Bestelldatum und Stück“), E-Mail für die
  Eingangsbestätigung; optional „Nur bestimmte Stücke?“ (Freitext) und „Grund“ (klar freiwillig); Link zur
  Datenschutzerklärung (R-138); Honeypot; Vorbelegung nur der Bestellnummer über `?order=`. Passen Bestellnummer und
  E-Mail, zeigt ein Zwischenschritt Checkboxen je Position, alle nicht angehakt (keine Auswahl = ganzer Vertrag, so
  erklärt). Schritt 2: Zusammenfassung mit „Ändern“ und Knopf exakt „Widerruf bestätigen“ / „Confirm withdrawal“; die
  Eingaben laufen per POST in einem signierten Formular-Token (HKDF `pc:form-token:v1`), nie in der URL; erst dieser
  Klick ruft `submitWithdrawal`. Ergebnis-Seite mit allen Angaben, Datum und Uhrzeit, Vorgangsnummer, „Eine Bestätigung
  ist per E-Mail unterwegs“, Druck-CSS; `noindex`; Kontext `dynamic` (ARCHITEKTUR §8.1); 429-Text am Formular.
  Formularbausteine aus KO-12.
  - Akzeptanz:
    - Absenden mit unbekannter Bestellnummer und leerem „Grund“ funktioniert; kein CAPTCHA im DOM; alle Checkboxen
      initial nicht angehakt (R-091).
    - Vor Schritt 2 entsteht kein Datensatz, nach dem Klick genau einer (R-092); Bestätigungsseite zeigt alle Angaben (R-093).
    - Nach dem Absenden enthält die URL keine Eingaben (R-137); Datenschutz-Link am Formular (R-138).
    - Ablauf komplett per Tastatur und mit `javaScriptEnabled: false`; axe ohne `serious`/`critical`.
  - Tests: `tests/e2e/legal/withdrawal-flow.e2e.spec.ts` (Titel „R-091 …“, „R-092 …“, „R-093 Bestätigungsseite …“,
    „R-137 Widerruf …“, „R-138 Widerruf …“; Projekte `iphone-15` und `desktop`).
  - Ohne Jutta: –

- [ ] **P6.9 Widerrufs-Posteingang: Aktionen und Fristen-Job** – Aktionen in `/widerrufe/:id` (KONZEPT §7.10, §5.4,
  R-094) mit Status und Übergängen aus DATENMODELL §6.11 (`src/lib/commerce/withdrawalTransitions.ts`): „Bestellung
  zuordnen“ (Suche nach Nummer, E-Mail, Name; W2 → O11 bzw. O4; `matchStatus = manually_matched`, Widerrufsstatus
  bleibt), „Ware ist zurück“ (W3/O12, `goods_returned`, `goodsReturnedAt`, Zustandsnotiz, optional Fotos
  `returnPhotos` mit `purpose = return_photo`), „Nachweis der Rücksendung liegt vor“ (`returnProofReceivedAt`), „Ohne
  Erstattung abschließen“ (W5, `closed` mit `closeReason` Pflicht, bei `other` mit `closeNote`; die zugeordnete, nicht
  stornierte Bestellung geht per O20 auf `statusBeforeWithdrawal` zurück – aber nur, wenn kein anderer Widerruf
  derselben Bestellung offen ist (`received` oder `goods_returned`); sonst bleibt sie `withdrawal_received`, KONZEPT
  §5.3/§5.4, DATENMODELL §6.8.5/§6.11), „Ablehnen“ (nur
  manuell aus `received`, `rejected` mit `closeNote` Pflicht) und „Als Test/Spam markieren“ (`rejected` mit
  `spam.markedAt`/`spam.reason`, Löschung 30 Tage danach laut L-08), „Stück wieder verkaufen“ bzw. „Stück ausblenden“
  (P5.7). Manuelles Erfassen per Mail oder Brief über `POST /api/withdrawals/manual` (`channel` `email`/`letter`/`other`,
  vom Admin eingegebener Zugangszeitpunkt, E-Mail optional; Eingangsbestätigung nur, wenn eine E-Mail angegeben ist und
  Jutta „Eingangsbestätigung senden“ anhakt – nicht vorausgewählt). Anzeige der regulären Widerrufsfrist
  (Zustellung/Übergabe + 14 Tage, P5.17) nur als Info – nie automatisch ablehnen. Task `withdrawalDeadlines` (Queue
  `commerce`, täglich ab 08:00): Status `received`/`goods_returned` ohne Erstattung, Eingang vor mindestens 10 Tagen →
  A13 (`admin_withdrawal_deadline`) einmal je Widerruf über `deadlineReminderSentAt`. Als Fristen-Job überspringt er
  Widerrufe mit `seed = true` (keine Admin-Mail zu Beispieldaten; „erstatten bis“ zeigt die Verwaltung trotzdem,
  DATENMODELL §11, KONZEPT §8).
  - Akzeptanz:
    - Countdown „erstatten bis“ korrekt, auch über die Zeitumstellung; manuell erfasster Brief-Widerruf ohne E-Mail mit
      Kanal und Zugangszeitpunkt, ohne Kund:innen-Mail (R-094, DM-WDR-04).
    - Matrix der Widerrufs-Übergänge (AK-5-01 Widerruf); `received → refunded` ohne Erstattung und jede automatische
      Ablehnung schlagen fehl.
    - „Ohne Erstattung abschließen“: Bestellung mit genau einem offenen Widerruf → O20 auf `statusBeforeWithdrawal`;
      Bestellung mit zwei offenen Widerrufen → nach dem Abschließen des ersten bleibt sie `withdrawal_received`, erst
      das Abschließen des zweiten löst O20 aus; ein nicht zugeordneter Widerruf ändert keine Bestellung.
    - A13 genau einmal je Widerruf an Tag 10 (vorgestellte Uhr, doppelter Lauf, Widerruf `seed = false`, AK-8-01); ein
      gleichartiger Widerruf mit `seed = true` löst keine A13 aus.
  - Tests: `tests/int/legal/withdrawal-inbox.int.spec.ts` (Titel „R-094 …“, „AK-5-01 Widerruf …“),
    `tests/int/jobs/withdrawal-deadlines.int.spec.ts`, `tests/e2e/admin/withdrawal-inbox.e2e.spec.ts`.
  - Ohne Jutta: –

- [ ] **P6.10 Erstattungen über den Zahlungsadapter** – Dialog „Erstatten“ im Widerrufs-Detail und (O15) im
  Bestell-Detail (KONZEPT §5.3) mit Pflicht-Grund aus `REFUND_REASONS` (DATENMODELL §4): `admin_cancellation` für das
  Storno einer bezahlten Bestellung durch Jutta (Stück vor Versand/Übergabe danach wieder verkaufbar, P11, KA-37),
  `breakage` für ein vor dem Versand beschädigtes Stück (danach nur „Ausblenden“, P13), `goodwill` (Kulanz),
  `complaint` (Reklamation, P6.11); Positionen wählen;
  Betrag vorberechnet (`src/lib/commerce/refundAmount.ts`):
  Voll-Widerruf = Stückpreise + ursprüngliche Versandkosten; Teil-Widerruf = Preise der widerrufenen Stücke +
  Differenz aus bezahlten Versandkosten und den Versandkosten der behaltenen Stücke (Regel aus KONZEPT §5.3, vorläufig
  bis Kanzleifrage K-09, R-072; Hinweis im Dialog); erhöhbar mit Pflicht-Notiz, nie über den noch erstattbaren Betrag.
  Karte/PayPal:
  `payments.refund({ paymentIntentId, amountCents, reason, idempotencyKey })` (Mock bzw. Stripe), Eintrag in `refunds[]`
  mit `pending` → nach Erfolg (Webhook bzw. Mock) `succeeded` → Gutschrift GS (P4-Dienst) → O13/O14 bzw. O15, Widerruf
  W4 (`refunded`/`partially_refunded`), M09 (`refund_confirmation` mit GS-PDF); Fehlschlag → `failed` + A08
  (`admin_refund_failed`). Vorkasse: „Erstattung überwiesen“ bestätigen
  (`manualTransferConfirmedAt`) → GS + M09; keine Kund:innen-IBAN speichern (V-23). Idempotenz-Schlüssel
  `refund:<orderId>:<laufende Nummer>`.
  - Akzeptanz:
    - Erstattung läuft über dasselbe Zahlungsmittel wie die Zahlung (R-072); Teil-Widerruf rechnet die Versanddifferenz
      korrekt (Beispiele aus KONZEPT §5.3 mit den Tarifen aus dem Grund-Seed).
    - Doppelklick → eine Erstattung; Betrag über dem Rest → abgelehnt; Fehlschlag → A08.
    - Nach Erfolg: GS-Beleg, M09 im Mail-Log, Status `refunded` bzw. `partially_refunded`.
    - O15 ohne Grund → abgelehnt; Storno einer bezahlten Bestellung mit `admin_cancellation` bzw. Bruch vor dem Versand
      mit `breakage` → `refunded`, Gutschrift mit demselben Grund.
  - Tests: `tests/unit/commerce/refund-amount.unit.spec.ts`, `tests/int/legal/refund.int.spec.ts` (Titel „R-072 …“).
  - Ohne Jutta: –

- [ ] **P6.11 Reklamationen, „Recht auf Reparatur“ und § 37 VSBG** – Reklamation je Bestellung (Collection
  `complaints`, DATENMODELL §6.29) im Bestell-Detail und über „Reklamation (Bruch)“ in `/versendet`: `kind`,
  `receivedAt`, `photos` (`complaint_photo`, max. 6), `description`, betroffene Stücke; Hinweis für Jutta „bis
  {`carrierClaimDueAt`} bei DHL reklamieren“ und Feld `carrierClaimFiledAt`. „Reklamation beantworten“ sendet die Mail
  M12 `complaint_repair_choice` (Baustein `complaint.repairChoice`: Wahlrecht Reparatur/Ersatz, Verlängerung der
  Gewährleistung um 12 Monate bei Reparatur, bei Unikaten ist Ersatz in der Regel unmöglich) über die Outbox und
  speichert `repairChoiceSentAt`; Wahl der Kund:in in `customerChoice`/`customerChoiceAt`. `warrantyEndsAt` =
  Zustellung bzw. Übergabe + 2 Jahre, +12 Monate bei `customerChoice = repair` (R-110, R-111). Streitfall: Mail
  M13 `dispute_vsbg` (Baustein `dispute.vsbg37` mit Universalschlichtungsstelle des Bundes, Anschrift und URL laut R-112,
  Arbeitsfassung „nicht bereit und nicht verpflichtet“), protokolliert über `vsbgNoticeSentAt`. Fotoanforderung und
  IBAN-Bitte bleiben `mailto:`-Vorlagen (P5.27). Kulanz-/Reklamations-Erstattung über P6.10 (O15, `refunds[].reason =
  complaint`).
  - Akzeptanz:
    - `warrantyEndsAt` mit und ohne Reparatur korrekt (R-110); Wahl „Reparatur“ verlängert um 12 Monate (R-111).
    - VSBG-Vorlage enthält Anschrift und URL der Schlichtungsstelle, kein OS-Link (R-112, V-01).
    - Die bis hier gebauten P6-Kund:innen-Mails (M08, M09, M12, M13) rendern mit Fixture-Daten (Bestellung, Widerruf,
      Reklamation, gleichartig zum Beispielbestand) ohne offene Tokens (R-084; M14–M16 ergänzt P6.18); mit den echten
      Ankern prüft P8.21.
  - Tests: `tests/int/legal/complaints.int.spec.ts` (Titel „R-110 …“, „R-111 …“), `tests/unit/legal/vsbg.unit.spec.ts`
    (Titel „R-112 …“), `tests/unit/legal/p6-mails.unit.spec.ts` (Titel „R-084 …“, Snapshots DE/EN).
  - Ohne Jutta: Wortlaute sind Arbeitsfassungen bzw. Platzhalter bis zur Kanzlei (Kanzleifragen K-20, K-22).

- [ ] **P6.12 Prüf-Suite Bestellprozess (§ 312j, § 312i, § 312f BGB)** – Nachweise für den in P4 gebauten Kaufweg
  bündeln und Lücken sofort beheben: § 312j (Knopf exakt „Zahlungspflichtig bestellen“ / „Order with obligation to pay“,
  Übersicht mit wesentlichen Eigenschaften, Gesamtpreis, Versandkosten und Lieferzeit unmittelbar vor dem Knopf; Zahlarten
  und Lieferbeschränkungen spätestens zu Beginn des Bestellvorgangs – R-036, R-063, R-064), § 312i (Eingabefehler über
  „Ändern“-Links korrigierbar, Zugangsbestätigung unverzüglich, Vertragsbestimmungen abrufbar und speicherbar – R-065,
  R-081, R-012), § 312f (Vertragsbestätigung auf dauerhaftem Datenträger mit AGB und Widerrufsbelehrung in der
  Bestellfassung – AK-6-02, R-013). R-065 (Vertragsschluss) wird über den Kassen-Datensatz geprüft (`checkouts`,
  DATENMODELL §6.25: `submittedAt`, Snapshot, Rechtstext-Fassungen; gescheiterte Zahlung → keine Bestellung, keine
  M01). Alle Tests unter `tests/**/legal/`, Titel beginnen mit der R-ID.
  - Akzeptanz:
    - Suite grün auf `desktop`, `iphone-15`, `pixel-7`; jede gefundene Lücke ist im selben Task behoben und in
      `docs/FORTSCHRITT.md` genannt.
    - M01 einer DE-Bestellung mit Karte/PayPal hat genau drei PDF-Anhänge (Rechnung, AGB, Widerrufsbelehrung und
      Muster-Formular) in der Version der Bestellung; bei einer EN-Bestellung kommen die vorhandenen EN-PDFs hinzu
      (AK-6-02, R-015).
  - Tests: `tests/e2e/legal/checkout-compliance.e2e.spec.ts`, `tests/int/legal/contract-confirmation.int.spec.ts`.
  - Ohne Jutta: –

- [ ] **P6.13 Automatische Verbotsprüfungen und Privatsphäre-Suite** – `tests/unit/legal/forbidden.unit.spec.ts`:
  Quelltext-Scans (V-01; V-03 `defaultChecked`/`checked` ohne Nutzeraktion; V-04–V-07 Fremd-Hosts; V-16 in Produkttexten
  des Seeds; V-20; V-21; V-22 `searchParams.get` mit Personenfeldern; V-23 Schema-Scan auf `iban`/`cardNumber` außerhalb
  der Stammdaten; V-25 Formular-Labels; V-30 in öffentlichem Code und `messages`) und gerenderte Mails (V-01, V-02 im
  KU-Modus, V-09, V-11, V-18) mit Allowlist `tests/unit/legal/forbidden.allowlist.json` (Pflicht-Begründung je Eintrag,
  z. B. der Figurenname der Seed-Galerie G2, den P8.6 einträgt). `tests/e2e/legal/forbidden.e2e.spec.ts`: Crawl aller
  Registry-Routen DE/EN auf V-01, V-02
  (KU-Modus), V-03 (alle `input[type=checkbox]` initial nicht angehakt), V-08, V-10–V-15, V-17–V-21, V-26, V-27
  (externe Links nur aus Allowlist), V-28 (kein `audio`), V-31 (Straße aus den Stammdaten nur auf erlaubten Seiten).
  T-03 (`@privacy`: keine Fremd-Requests, auch in Admin-Ansichten) und T-04 (`@privacy`: kein Endgeräte-Speicher vor der
  ersten Warenkorb-Aktion; `pc-motion` erst nach Klick) für alle nicht mehr `planned` Routen prüfen bzw. erweitern
  (EK-04, EK-05). R-096: V-08-Scan und Schema-Test (kein Feld wie `noWithdrawal`/`customMade` in `products`).
  - Akzeptanz:
    - Alle Scans grün; eine absichtlich eingefügte Fixture mit OS-Link bzw. „inkl. MwSt.“ lässt den jeweiligen Test
      scheitern (Gegenprobe als eigener Test).
    - T-03 und T-04 grün für alle gebauten Routen (R-130, R-131).
  - Tests: die beiden Dateien oben (Titel je Verbot „V-xx …“ bzw. „R-096 …“, „R-130 …“, „R-131 …“),
    `tests/e2e/privacy/*.e2e.spec.ts` (`@privacy`).
  - Ohne Jutta: –

- [ ] **P6.14 Löschjobs, Teil 1: Bestellungen, Belege, Widerrufe** – Fristfunktionen in `src/lib/retention/policy.ts`
  (seit P1 die einzige Stelle für Fristen; hier um Kalenderjahresende Europe/Berlin, „ab Ereignis“, Monatsenden und
  Sommerzeit vervollständigen) und gemeinsamer Runner (LOESCHKONZEPT §4 „Regeln für alle Löschjobs“, DATENMODELL §11:
  idempotent, höchstens 500 Datensätze je Lauf, erst Speicherobjekte, dann Datensatz, nach 3 Fehlschlägen A12
  (`admin_alert`), Datensätze mit `privacy.legalHold` überspringen, `deletion-log` je Aktion über `writeDeletionLog`
  (`trigger = job`, `taskSlug`), Trockenlauf, injizierbare Uhr, Versions-Tabellen mitlöschen). Tasks (ARCHITEKTUR A.3):
  `retentionAbandonedCheckouts` (L-03, alle Kassen 30 Tage nach Anlage), `retentionOrderMinimize` (L-04 Stufe 1: 30 Tage
  nach dem Storno Liefer- und Rechnungsadresse und DHL-Einwilligung entfernen, Status-Token wie Stufe B; L-05 Stufe A
  Telefon – derzeit ohne Wirkung, es gibt kein Telefonfeld; Stufe B 180 Tage nach `finalStatusAt` `statusTokenHash` und
  `statusTokenSealed` gemeinsam leeren → Statusseite zeigt „abgelaufen“ (R-067); Stufe C Packfotos 12 Monate nach
  `shippedAt` bzw. `pickedUpAt`, Rückgabefotos 12 Monate nach `returnReceivedAt`, außer bei Legal Hold, offener
  Reklamation oder Anfechtung), `retentionOrders`
  (L-04 Stufe 2, L-05 Stufe D nach 6 Jahren ab Jahresende, L-09), `retentionInvoices` (L-06/L-07: nach
  `retention.invoiceYears` ab Ende des Ausstellungsjahres PDF löschen, Registerzeile anonymisieren; Monatsexporte),
  `retentionWithdrawals` (L-08: 6 Jahre ab Jahresende, Test/Spam 30 Tage nach Markierung). Belege: Trigger
  `pc_guard_invoices` (DATENMODELL §9.4) prüfen – `retentionInvoices` setzt in seiner Transaktion
  `set_config('pc.now', $now, true)`; ohne diesen Wert bleibt Anonymisieren gesperrt. Tests können damit die Uhr
  vorstellen.
  - Akzeptanz:
    - Je Regel: einen Tag vor Fristende vorhanden, einen Tag danach gelöscht bzw. anonymisiert; Speicherobjekte weg;
      Versions-Tabellen leer; `deletion-log` ohne Inhalte; Legal Hold wird übersprungen (R-154).
    - Löschversuch an einem Beleg vor Fristende scheitert (R-123).
    - Silvester 23:59 Berlin = 22:59 UTC korrekt berechnet.
  - Tests: `tests/unit/legal/retention-rules.unit.spec.ts`, `tests/int/legal/retention.int.spec.ts` (Titel „R-154 L-03
    …“ usw., „R-123 …“).
  - Ohne Jutta: Frist 10 Jahre (`retention.invoiceYears`) bleibt bis zur Antwort auf Kanzleifrage K-33.

- [ ] **P6.15 Löschjobs, Teil 2, Löschvorschau und `retention:replay`** – Tasks `retentionCommissionInquiries` (L-10:
  6 Monate nach `createdAt` inkl. Referenzbildern, unabhängig von der Aktivität), `retentionEmailLog` (L-12: wie
  Bezugsobjekt, ohne Bezug 90 Tage), `retentionPrivacyRequests` (L-17: Datensatz 3 Jahre ab Ende des Abschlussjahres,
  Exportdateien 30 Tage nach Antwort), `retentionConsentEvidence` (L-19/L-20: Nachweise 3 Jahre nach Widerruf bzw. Ende
  der Veröffentlichung), `retentionDeletionLog` (L-18: 3 Jahre), `retentionTechnical` (stündlich: L-02 Reservierungen 7
  Tage, `rate_limit_hits` > 24 h, Webhook-Ereignisse 90 Tage, `job_runs` 90 Tage, nicht abgeschickte `pending`-Uploads >
  24 h, `audit-log` mit `retainUntil ≤ now`), `legalHoldReview` (täglich ab 08:00: letzte Prüfung
  (`legalHoldReviewedAt`, sonst `legalHoldSince`) ≥ 6 Monate → Mail A15 `admin_legal_hold_review`, `legalHoldReviewedAt`;
  als Erinnerungs-Job überspringt er Datensätze mit `seed = true`, „Heute“ zeigt sie trotzdem, DATENMODELL §11),
  alle mit dem Runner aus P6.14. Ansicht „Löschvorschau“ (Einstellungen → Datenschutz): Trockenlauf je Regel für die
  nächsten 30 Tage. Skript `pnpm retention:replay` (ARCHITEKTUR §6.10, §10.5; DATENMODELL §6.27): wendet alle Einträge
  aus `deletion-log` in Reihenfolge `executedAt` erneut auf noch vorhandene IDs an und führt danach alle Löschjobs
  einmal aus; in Produktion nur mit `--yes-production` (ARCHITEKTUR §4.8). Prüfen, dass KONZEPT §8.3 und AK-8-03 für
  Anfragen auf L-10 verweisen (6 Monate nach Eingang).
  - Akzeptanz:
    - Je Regel „Tag vorher vorhanden, Tag danach gelöscht“ (R-154); Anfrage mit frischer Aktivität wird trotzdem 6
      Monate nach Eingang gelöscht (L-10).
    - `rate_limit_hits`-Einträge sind nach 24 h weg (R-134).
    - `retention:replay` nach Wiederherstellen eines älteren Stands löscht die protokollierten IDs erneut; zweiter Lauf
      ändert nichts (DM-DEL-02, AK-A-10-04).
  - Tests: `tests/int/legal/retention.int.spec.ts` (Teil 2), `tests/int/legal/retention-replay.int.spec.ts`,
    `tests/e2e/admin/deletion-preview.e2e.spec.ts`.
  - Ohne Jutta: –

- [ ] **P6.16 DSGVO-Anfragen: Erfassung und Fristen** – Ansicht `/export/datenschutz` (KONZEPT §7.15, LOESCHKONZEPT §5):
  Anfrage anlegen (`types`, `receivedAt` = Tag des Zugangs, `channel`, `contactEmail`, `locale`; Nummer `DS-JJJJ-NNNN`,
  DATENMODELL §6.26); `dueAt` = Eingang + 1 Monat (Art. 12 Abs. 3 DSGVO; 31.01. → 28./29.02.); Verlängerung um höchstens
  2 Monate nur mit `extensionReason` und `extensionNotifiedAt` innerhalb des ersten Monats; Status aus
  `PRIVACY_REQUEST_STATUSES` inkl. `identity_check` (Frist läuft weiter). Task `privacyRequestsDeadlineReminder`
  (täglich ab 08:00): Mail A14 `admin_privacy_request_due` 7 Tage und 1 Tag vor `extendedDueAt ?? dueAt`, je Stufe einmal
  über `remindersSent`; als Fristen-Job überspringt er Anfragen mit `seed = true` (DATENMODELL §11); Hinweis unter
  „Heute“ bei offenen Anfragen, auch bei Beispieldaten.
  - Akzeptanz:
    - Erinnerungen genau an Tag −7 und −1, keine sonst; verlängerte Frist verschiebt die Erinnerungen (R-153).
    - Eine gleichartige Anfrage mit `seed = true` löst keine A14 aus, erscheint aber unter „Heute“.
    - Monatsende-Fälle (31.01., 31.03.) korrekt (DM-PRQ-01).
  - Tests: `tests/int/legal/privacy-requests.int.spec.ts` (Titel „R-153 …“), `tests/unit/legal/gdpr-deadline.unit.spec.ts`.
  - Ohne Jutta: –

- [ ] **P6.17 DSGVO: Personensuche und Auskunft-Export** – Suche nach E-Mail (normalisiert, ohne Groß-/Kleinschreibung),
  Bestellnummer oder Name über Kassen, Bestellungen (inkl. Snapshots, Status-Historie, gesendeter Mails), Belege,
  Widerrufe, Anfragen (inkl. Bilder), Reklamationen, `email-log`, `consent-log` und frühere Anfragen (R-150); Treffer
  in `matchedOrders`/`matchedWithdrawals`/`matchedInquiries` der Anfrage. Export als ZIP
  (`fflate`) mit `daten.json` (strukturiert, Art. 20), `auskunft.html` (Angaben nach Art. 15 Abs. 1 lit. a–h aus
  Bausteinen, Empfängern laut DIENSTE und Fristen laut LOESCHKONZEPT, Beschwerderecht bei der Berliner Beauftragten) und
  Kopien der Bilder und PDFs; privat abgelegt (`data_export`), Audit `data_exported`. Antwort-Mail M14
  `privacy_access_response` (Baustein `privacyRequest.accessResponse`) nur an die gespeicherte Adresse mit signiertem
  Download-Link auf `GET /api/privacy-export/[token]` (ARCHITEKTUR §2.5; 7 Tage gültig, danach 410); Exportdatei wird 30
  Tage nach der Antwort gelöscht (P6.15).
  - Akzeptanz:
    - Fixture-Person (gleichartig zu einer Seed-Kundin, SEED-SPEC §6) mit Daten in allen Collections: Export enthält
      jeden Datensatz (Zählvergleich), JSON valide, Bilder enthalten (R-150); mit dem echten Bestand prüft P8.21.
    - Download-Link nach 7 Tagen → 410; Link enthält keine Personendaten (R-137).
  - Tests: `tests/int/legal/privacy-export.int.spec.ts` (Titel „R-150 …“).
  - Ohne Jutta: –

- [ ] **P6.18 DSGVO: Löschen/Einschränken, Berichtigung, Widerspruch, Einwilligungswiderruf** – Knopf
  „Löschen/Einschränken“ je Person (R-151): Plan je Datensatz mit Regel aus LOESCHKONZEPT und Aktion „sofort löschen“
  (inkl. Speicherobjekten und Mail-Protokoll), „einschränken bis {Datum}“ (`privacy.processingRestricted = true`, nicht
  nötige Felder sofort entfernen: Telefon, Notizen, Packfotos; Outbox unterdrückt Mails an eingeschränkte Bestellungen)
  oder „behalten“ (Art. 17 Abs. 3 lit. e, Begründung Pflicht); Belege bleiben unverändert; jede Aktion ins
  `deletion-log` (`trigger = privacy_request`, `ruleId = DSGVO`, `privacyRequestRef`); Antwort-Mail M15
  `privacy_erasure_response`. Berichtigung (R-152): Name/Adresse/E-Mail an Bestellungen ohne
  Rechnung direkt; nach Rechnung nur per Gutschrift + neuer Rechnung (`reissueInvoice(orderId, changes)`, R-121), Vermerk
  im Verlauf. Widerspruch (Art. 21) als Anfrage mit Prüfergebnis dokumentieren. Einwilligungswiderruf: DHL-Einwilligung
  (P5.10) verlinkt; Bestätigungs-Mail M16 `consent_withdrawal_confirmation` mit beiden Varianten laut KONZEPT §6.3
  (DHL-Weitergabe, Portfolio-Einwilligung); den Galerie-Widerruf verlinkt P7.8.
  - Akzeptanz:
    - Person mit alter (Frist abgelaufen) und neuer Bestellung: alte gelöscht, neue eingeschränkt, Rechnung unverändert,
      Log-Einträge vorhanden (R-151).
    - Berichtigung vor Rechnung ändert direkt; nach Rechnung entstehen GS und neue RE (R-152); DHL-Widerruf entfernt die
      E-Mail aus „Adresse kopieren“ (R-152).
    - Eingeschränkte Bestellung erhält keine Mail mehr (Outbox `suppressed`).
    - Alle P6-Kund:innen-Mails (M08, M09, M12–M16) rendern mit Fixture-Daten DE/EN ohne offene Tokens (R-084).
  - Tests: `tests/int/legal/privacy-erasure.int.spec.ts` (Titel „R-151 …“, „R-152 …“), Erweiterung
    `tests/unit/legal/p6-mails.unit.spec.ts` (Titel „R-084 …“, Snapshots M14–M16).
  - Ohne Jutta: –

- [ ] **P6.19 Einwilligungs- und Mail-Protokolle in der Verwaltung** – Anzeige `consent-log` an Bestellungen (Zweck,
  Zeitpunkt, Baustein-Version, Widerruf) und `email-log` an Widerrufen und Anfragen (Typ, Betreff, Zeitpunkt,
  Anbieter-ID, Status, Anhang-Namen). Gesamtliste `/export/protokolle` mit Filtern (Art, Zeitraum, Status), Empfänger
  teilweise maskiert. M08 lässt sich nur als Kopie an Jutta erneut senden (KONZEPT §6.1).
  - Akzeptanz:
    - „Kopie an mich“ für M08 geht ausschließlich an die Admin-Adresse; Protokolle zeigen keine Mail-Inhalte von
      Kund:innen-Freitexten in Listen.
  - Tests: `tests/int/email/logs-admin.int.spec.ts`, `tests/e2e/admin/logs.e2e.spec.ts`.
  - Ohne Jutta: –

- [ ] **P6.20 Jährliche Prüf-Erinnerung Rechtstexte** – Task `legalReviewReminder` (ARCHITEKTUR Anhang A.3,
  DATENMODELL §11), täglich ab 08:30: je Typ Alter = jüngeres Datum aus `activatedAt` der aktiven Fassung und
  `legal.reviews[type].reviewedAt`; ab 365 Tagen A10 (`admin_legal_review_due`) einmal mit allen fälligen Typen, danach
  alle 30 Tage erneut (`legal.reviews[type].lastReminderSentAt`), bis neue Version oder „geprüft“ (R-014).
  „Heute“-Kachel „Rechtstexte“ je Typ: Version, gültig ab, Herkunft, Alter; Warnung bei fehlendem
  Typ, `origin ≠ lawyer` oder mehr als 365 Tagen.
  - Akzeptanz:
    - Mit vorgestellter Uhr: Tag 364 keine Mail, Tag 365 eine, Tag 380 keine, Tag 395 eine (R-014).
  - Tests: `tests/int/jobs/legal-review.int.spec.ts` (Titel „R-014 …“).
  - Ohne Jutta: Jährliche Prüfung ist Owner-Aufgabe (ANFORDERUNGEN §8).

- [ ] **P6.21 Dienste-Daten, Auftragsverarbeitung und Verarbeitungsverzeichnis** – Generator
  `scripts/legal/gen-services.ts` liest die YAML aus DIENSTE §7 und schreibt `src/lib/legal/services.generated.ts`;
  `pnpm check:static` prüft, dass die Datei aktuell ist. Einstellungen → „Auftragsverarbeitung“ (DIENSTE §6): Liste aller
  Dienste mit `avv: required` mit Eingabe in `settings.processorAgreements` (Felder laut DATENMODELL §7.1, u. a. die
  optionale AVV-Datei `file` als `private-uploads` mit Zweck `processor_agreement`; R-155, Gate folgt in P10). Auftragsverarbeiter-Tabelle als generierte
  Komponente `ProcessorTable` (Spalten Name, Rolle, Sitz, Drittland; Quelle: DIENSTE-YAML über
  `services.generated.ts` und `settings.processorAgreements`), gerendert auf R22 DE/EN unter bzw. neben dem Text der
  Datenschutzerklärung. Sie ist **kein** Token: Die Token-Liste von R-012, DATENMODELL §6.12 und KANZLEI-BRIEFING §16.3
  bleibt geschlossen (P6.3). `docs/recht/VVT.md`
  (R-156) nach Art. 30 DSGVO aus DIENSTE und LOESCHKONZEPT: je Verarbeitung Zweck, Kategorien Betroffener und Daten,
  Empfänger, Drittland, Löschfristen, Verweis auf TOM (R-136); deckt alle Verarbeitungen aus KANZLEI-BRIEFING §11.4 ab.
  DIENSTE: `localStorage['pc-motion']` (DESIGN §11.7, ARCHITEKTUR §8.7) und Versand ohne Dienstleister-Schnittstelle
  (`CARRIER_DRIVER=manual`) vermerken.
  - Akzeptanz:
    - Jeder Dienst mit `avv: required` erscheint in der Admin-Liste (Unit-Test gegen die generierte Datei).
    - R22 DE/EN zeigt die Tabelle mit jedem Auftragsverarbeiter aus der YAML, auch mit dem Platzhalter-Rechtstext
      (die Tabelle hängt nicht von einem Token im Text ab).
    - CSP-Hosts ⊆ Hosts der YAML je Kontext (T-16) weiterhin grün.
    - `docs/recht/VVT.md` vorhanden; ANFORDERUNGEN §7 Teil A „R-156“ abgehakt, Datum in `docs/FORTSCHRITT.md`.
  - Tests: `tests/unit/legal/services.unit.spec.ts` (Titel „R-155 Liste …“), `tests/e2e/legal/processor-table.e2e.spec.ts`,
    T-16.
  - Ohne Jutta: AVVs schließt Jutta in P11 ab (A35).

- [ ] **P6.22 Kanzlei-Mappe fertigstellen (neue Version)** – `docs/recht/KANZLEI-BRIEFING.md` an die Umsetzung
  angleichen: Tokenliste §16.3 unverändert geschlossen (kanonische Tokens ohne weitere Schreibweisen, kein Token für
  die Auftragsverarbeiter-Tabelle; die Mappe nennt die Tabelle als Komponente unter der Datenschutzerklärung, P6.21),
  Cookie-/Speicherliste §11.3 = ARCHITEKTUR §8.7
  (inkl. `pc_checkout` und `pc-motion`), Verarbeitungen §11.4 = VVT, Speicherdauer §11.6 = LOESCHKONZEPT, Widerrufsablauf
  §8 (Schritte, Felder, Eingangsbestätigung, EN-Beschriftung „Withdraw from contract here“), Formulare §12 (Kasse,
  Widerruf, Auftragsanfrage mit höchstens 5 Bildern, ohne Einwilligungs-Checkbox). Anlage E: Skript
  `scripts/legal/briefing-screenshots.ts` (Playwright, Mock-Treiber, 390 px, DE) erzeugt `docs/recht/anlagen/E-01…E-06.png`
  (Kassen-Übersicht mit Bestellknopf, Widerruf Schritt 1, Auswahl, Schritt 2, Bestätigungsseite, gerenderte M08; je ≤
  300 KB) und §18 Anlage E verweist darauf. Versionsnummer erhöhen und Eintrag mit Datum im Änderungsprotokoll §19;
  der Block „Vor dem Versand von der Mandantin zu ergänzen“ bleibt unangetastet.
  - Akzeptanz:
    - Unit-Test: in der Mappe genannte Tokens = Tokenliste des Renderers; Cookie-Liste der Mappe = Liste aus ARCHITEKTUR
      §8.7 (beide Dateien werden geparst).
    - Sechs Bildschirmfotos vorhanden und in §18 verlinkt.
  - Tests: `tests/unit/legal/briefing.unit.spec.ts`.
  - Ohne Jutta: Versand an die Kanzlei ist Owner-Aufgabe (A08/A28).

- [ ] **P6.23 Nachverfolgbarkeit: Spalte „Nachweis“ und `LEGAL_TRACE_PHASE = 6`** – Tabelle ANFORDERUNGEN §3 um die
  Spalte „Nachweis“ erweitern (`| R-### | Titel | Phase | Test | Owner | Nachweis |`, Testdatei-Pfade, bei manuellen
  Punkten „§7“) und für alle Zeilen mit frühester Phase ≤ 6 füllen. Parser in `tests/unit/legal/traceability.unit.spec.ts`
  liest Spalten über die Kopfzeile statt über Positionen; zusätzlich prüft er, dass jeder genannte Pfad existiert.
  `LEGAL_TRACE_PHASE = 6`. ANFORDERUNGEN §7 Teil A: R-095 (Tokens in der Platzhalter-Belehrung) abhaken, Datum in
  `docs/FORTSCHRITT.md`.
  - Akzeptanz:
    - Traceability-Test grün; Gegenprobe: eine abgedeckte ID aus einem Testtitel entfernen bzw. einen Nachweis-Pfad
      umbenennen → Test rot (R-001).
    - Alle R-IDs mit frühester Phase ≤ 6 haben einen Nachweis (EK-06).
  - Tests: `tests/unit/legal/traceability.unit.spec.ts` (Titel „R-001 …“).
  - Ohne Jutta: –

### Phasen-Abnahme

- [ ] Alle Aufgaben P6.1–P6.23 erledigt; `pnpm check`, `pnpm test:int`, `pnpm test:e2e` und `pnpm build` lokal grün.
- [ ] Migration `p6_legal_snippets_complaints` rückwärtsverträglich, `pnpm check:migrations` ohne Drift, Typen und
  Importmap committet; geprüft, dass die Token-Listen von Renderer, R-012, DATENMODELL §6.12 und KANZLEI-BRIEFING
  §16.3 übereinstimmen (ohne Token für die Auftragsverarbeiter-Tabelle) und dass `tattoo-gallery` keine Versionen hat;
  ARCHITEKTUR §1.2 (`sanitize-html`) und DIENSTE nachgezogen; geprüft, dass KONZEPT §8.3/AK-8-03 auf L-10 verweisen.
- [ ] `LEGAL_TRACE_PHASE = 6`, Spalte „Nachweis“ vollständig bis P6; Nachweise im PR-Text: AK-3-11, AK-3-12, AK-6-04,
  AK-DS-09, AK-5-01 Widerruf, EK-04, EK-05, EK-06.
- [ ] CI grün: Der Phasenende-Commit (z. B. `chore(P6): finish phase [ci:full p6]`, der letzte Commit ohne
  `[skip ci]`) hat `CI / quick`, `ci-full` (`e2e-full` inkl. `@a11y` und `@privacy`, `quality` mit visuellen Referenzen
  für die neuen Seitentypen Rechtsseite, Widerruf Schritt 1/2/Bestätigung, Kontakt) und `preview-export` grün
  durchlaufen. Dieses Häkchen setzt ein reiner Doku-Commit mit `[skip ci]`, nachdem der Lauf grün ist.
- [ ] Vorschau-Artefakt `planet-claire-vorschau-p6-<sha7>` enthält alle Rechtsseiten DE/EN mit Platzhalter-Banner,
  R26 mit Schritten, Kontakt und die Admin-Fotos von Widerrufe, Texte → Rechtstexte, Datenschutz-Anfragen, Löschvorschau.
- [ ] `docs/recht/KANZLEI-BRIEFING.md` in neuer Version mit Eintrag in §19 und `docs/recht/VVT.md` vorhanden;
  ANFORDERUNGEN §7 Teil A für R-095 und R-156 abgehakt.
- [ ] `docs/FORTSCHRITT.md` mit Phasen-Eintrag; PR-Beschreibung aktualisiert; neue Annahmen in `docs/OFFENE-PUNKTE.md`
  (mindestens: Teil-Widerruf-Versanddifferenz bis Kanzleifrage K-09, Arbeitsfassungen der Bausteine, Rechnungsfrist 10
  Jahre bis Kanzleifrage K-33); neue Jutta-Aufgaben als A51 ff. in `docs/owner/AUFGABEN.md`, soweit nicht schon
  vorhanden.

## P7 – Tattoo & Auftragsarbeiten

**Ziel:** Der Tattoo-Bereich (R11–R18) zeigt Stil, Flash mit Festpreis und Status, Angebote mit automatischem Ablauf,
Preise, Galerie „fresh & healed“ nur mit Einwilligung, Ablauf, Aftercare und FAQ – ohne Kauf-, Formular- oder
Zahlungselemente; Anfragen laufen nur über Mail- und DM-Links mit kopierbarer Adresse. Jutta pflegt alles im Bereich
„Tattoo“ der Verwaltung. Die Seite Auftragsarbeiten (R10) nimmt Anfragen mit bis zu 5 privaten Bildern an, schützt
sich ohne Drittanbieter vor Spam, bestätigt per Mail und löscht alles 6 Monate nach Eingang.

**Voraussetzungen:** P6 abgeschlossen (Rechtsseiten, Bausteine `inquiry.*`, `price.tattooNote`, `commission.offer`,
Löschjob-Runner mit `retentionCommissionInquiries`, `retentionConsentEvidence`, `retentionTechnical`); aus P5
Verwaltungs-Gerüst, `TranslateButton`, Foto-Baustein, „Anfragen“, `notifyAdmin`; aus P2 Registry-Einträge R10–R18
(`planned`), Tuschelinie-Engine mit Presets; aus P3 Preis-Fußnote und Filter-Mechanik (Spike B-05). Namen und Schema
wie in P5 beschrieben (DATENMODELL §10.1). Vom Beispielbestand gibt es nur den Mini-Satz aus P1.30 (u. a. Seiten `home`
und `contact`); Flash F-901–F-910, Angebote TO1–TO3, Galerie G1–G6, Anfragen A1–A7, FAQ und die Seiten `tattoo`,
`tattoo_aftercare` und `commissions` legt erst P8 an (P8.5–P8.7). Es gilt die Arbeitsregel „Beispielbestand vor P8“
am Planbeginn: Tests dieser Phase nutzen gleichartige Test-Fixtures (Nummern 980–999, eigene Fixture-Dateien unter
`tests/` bzw. Local API; `seed = true` wie ARCHITEKTUR §7.2, außer ein Kriterium verlangt echte Datensätze) statt der
Anker aus SEED-SPEC §11–§14 und §17; mit den echten Ankern
prüft P8.21.

**Referenzen:** E-11, E-18, E-42, E-50, E-51, E-52, E-53, E-62, E-64; R-034, R-134, R-135, R-137, R-138, R-139, R-160,
R-161, R-170, R-171, R-172, V-05, V-15, V-24, V-25, V-31; KONZEPT §2.2 (R10–R18), §3.10, §3.11, §5.5, §5.6, §6.2 (M11),
§6.4 (A05), §7.11, §7.12, §9.1–§9.7, §10.1–§10.4, AK-9-01…05, AK-10-01…04, EK-01; DATENMODELL §6.4, §6.14–§6.19, §7.1
(`tattoo.*`, `social.*`), §8.7; ARCHITEKTUR §2.5 (`/api/uploads/commission`), §8.1–§8.3, §8.5, §8.6, §8.8, §9.3,
Anhang A.3; DESIGN KO-12, KO-17, KO-20, §9.7 (`stencil`, `frame`), §11.5 (MI-14); SEED-SPEC §11, §12, §13.4–§13.6,
§14, §17, SE-09; LOESCHKONZEPT L-10, L-19, L-20.

### Aufgaben

- [ ] **P7.1 Tattoo-Grundgerüst: Unter-Navigation, Kontakt-Block, Mail-Links, Datenzugriff** – Unter-Navigation
  `src/components/tattoo/TattooSubNav.tsx` (Übersicht · Flash · Angebote · Preise · Galerie · Ablauf · Aftercare · FAQ,
  Chip-Optik wie KO-08, `aria-current`); Kontakt-Block `TattooContactBlock` (KO-20): „Mail schreiben“ (`mailto:`),
  „Instagram-DM“ (`https://ig.me/m/{social.instagramHandle}`, `rel="noopener noreferrer"`, R-139), E-Mail
  (`social.contactEmail`) als Text + „Adresse kopieren“ (Rückmeldung „Kopiert“ per `aria-live` für 2 s, Rückfall:
  markieren + „Jetzt kopieren“). `src/lib/tattoo/mailto.ts`: `buildMailto({ to, subject, body })` nach RFC 6068
  (`encodeURIComponent`, Zeilenumbruch `%0D%0A`) und Betreff-Bausteine nach KONZEPT §9.4 (Flash `Flash-Anfrage F-012 –
  {Titel}` / `Flash request F-012 – {title}`; Angebot `Anfrage {Angebotstitel} am 12.10.2026` / `Request {offer title} on
  12 Oct 2026`; allgemein `Tattoo-Anfrage` / `Tattoo request`; eigene Idee `Tattoo-Anfrage – eigene Idee` / `Tattoo
  request – custom idea`) mit Text-Vorlage DE/EN inkl. „(Bitte keine Gesundheitsinfos – die klären wir persönlich.)“,
  ohne vorbefüllte Personendaten. Anzeige-Nummer `F-` + dreistellig. Gecachte Lesefunktionen `src/lib/data/tattoo.ts`
  (Tags `flash`, `tattoo-offers`, `tattoo-gallery`, `page:tattoo`, `page:tattoo_aftercare`, ARCHITEKTUR §9.3). Die
  Unterseiten R12–R18 lesen die Blöcke der Seite `tattoo` nach Typ, Aftercare die Seite `tattoo_aftercare`; die
  vorhandenen `PAGE_KEYS` reichen (SEED-SPEC SE-09: in P7 bestätigen und SE-09 dort als geklärt vermerken). Ort nur
  als „Privatstudio in Berlin-{Bezirk}“ (E-50). SEO-Titel
  `{Seitentitel} · Tattoo · Planet Claire`.
  - Akzeptanz:
    - Flash 12 „Kelch mit Schlange“ ergibt exakt den Betreff `Flash-Anfrage F-012 – Kelch mit Schlange` bzw. EN
      `Flash request F-012 – Chalice with snake` (AK-9-02).
    - Umlaute, „&“, „?“ und Zeilenumbrüche sind korrekt kodiert.
  - Tests: `tests/unit/tattoo/mailto.unit.spec.ts` (Titel „AK-9-02 …“, „R-170 Betreff …“).
  - Ohne Jutta: –

- [ ] **P7.2 R11 Übersicht und R12 Flash** – R11 (KONZEPT §9.2): H1 „Tattoo“, Block „Mein Stil“, laufendes bzw.
  nächstes Angebot als Karte, 3 verfügbare Flash-Motive, 3 Galerie-Bilder (bevorzugt `healed`, nur sichtbare), Links zu
  allen Unterseiten mit je einem Satz, Kontakt-Block; leere Blöcke entfallen. R12 (KONZEPT §9.3, KO-20): Einleitung,
  Filter „alle“/„verfügbar“ (`?available=1`, gleiche Technik wie der Shop-Filter nach Spike B-05), Raster 2 Spalten
  mobil, 3 ab 768 px, Abstände ≥ 32 px. Karte: Zeichnung, `F-012` (Plex Mono), Titel, Größe (`sizeCm` als „ca. 9 cm“ +
  `sizeNote`), Preis als Text mit Sternchen („120 €*“, kein Preisschild) und Fußnote `price.tattooNote` (R-034), Badge
  „einmalig“/„wiederholbar“. `status = available`: Knöpfe „Per Mail anfragen“ und „Per DM anfragen“ plus kopierbarer
  Baustein „F-012 – Kelch mit Schlange“ mit Hinweis „Schick mir das in die DM“; `status = claimed`: Stempel
  „vergeben“/„taken“ (KONZEPT §9.3) in
  `--stencil`, Text „Schon vergeben – schau dir die anderen an“, keine Anfrage-Knöpfe. Sortierung verfügbare nach
  `sortOrder`, dann vergebene; Anker `#f-012`. Leerzustände nach KONZEPT §9.2 bzw. DESIGN KO-17. Preset `stencil` und
  MI-14 (Stencil-Schatten bei Hover/Fokus ohne Übergang). Registry-Status R11/R12 auf gebaut. Die Angebots-Karte und
  die Galerie-Bilder auf R11 schließen P7.3 bzw. P7.5 an (Abfrage und Sichtbarkeitsregel); bis dahin entfallen die
  beiden Blöcke als leer.
  - Akzeptanz:
    - Fixture-Flash Nr. 981 „Kelch mit Schlange“ (`available`, analog F-901): Mail-Knopf hat `href`
      `mailto:…?subject=Flash-Anfrage%20F-981%20%E2%80%93%20Kelch%20mit%20Schlange…` (AK-9-02, R-170); vergebene
      Fixture-Motive (`claimed`, analog F-903, F-905) stehen ohne Anfrage-Knöpfe hinter den verfügbaren; mit den echten
      Ankern F-901, F-903, F-905 prüft P8.21.
    - Preise mit Sternchen und Gesamtpreis-Hinweis (R-034); Filter „verfügbar“ zeigt nur verfügbare.
    - axe ohne `serious`/`critical`, ohne JavaScript vollständig lesbar.
  - Tests: `tests/e2e/tattoo/flash.e2e.spec.ts` (Titel „AK-9-02 …“, „R-034 …“, `@a11y`), `tests/int/tattoo/flash-data.int.spec.ts`.
  - Ohne Jutta: Bis P8 zeigen die Tests Fixture-Motive, ab P8.6 den Seed-Flash F-901–F-910; echte Motive pflegt Jutta.

- [ ] **P7.3 R13 Angebote und Task `revalidateEndedOffers`** – Zustand abgeleitet aus `startsAt`/`endsAt` nach
  Europe/Berlin (KONZEPT §5.6: kommt, läuft, vorbei), kein gespeicherter Status; öffentliche Abfrage nur `published`
  und `endsAt > now` (DATENMODELL §6.15; R-171 wird über Filter + Task erfüllt). Karte (KONZEPT §9.5, KO-20):
  Datums-Badge in Mansalva im
  gezeichneten Kreis („Sa 12.10.“, mehrtägig „12.–13.10.“), Titel, Text, Uhrzeit abgeleitet aus `startsAt`/`endsAt`
  (nur wenn nicht ganztägig, z. B. „12–19 Uhr“ / „12:00–19:00“), Ort (`locationNote` oder „Privatstudio in
  Berlin-{Bezirk}“), `priceNote`, Vorschaubilder der verknüpften Flash-Motive mit Link auf `R12#f-012`, Mail-Knopf
  (Angebots-Betreff), DM-Knopf, Hinweis „läuft gerade“ bzw. „in X Tagen“; Sortierung nach Start; Leerzustand. Teaser
  auf R11 und auf der Startseite nutzen dieselbe Abfrage. Task `revalidateEndedOffers` (Queue `maintenance`):
  Weckzeitpunkte an `startsAt` und `endsAt` jedes Angebots (`jobAlarm.bump` beim Speichern, damit DM-OFF-01 „spätestens
  15 min“ hält), revalidiert `tattoo-offers`, R11, R13 und die Startseite; Sicherheitsnetz täglich ab 00:05 (DATENMODELL
  §11).
  - Akzeptanz:
    - Angebot mit Ende gestern wird nicht ausgeliefert (R-171, DM-OFF-01) und ist nach dem Task-Lauf auf R11, R13 und
      der Startseite nicht sichtbar (AK-9-03).
    - Fixtures analog TO1–TO3 (SEED-SPEC §12.2) bei fester Uhr: Beginn in 58 Tagen → „in 58 Tagen“, laufend →
      „läuft gerade“, abgelaufen → unsichtbar; mit den echten Ankern (SEED-SPEC §17) prüft P8.21.
    - R11 zeigt das laufende bzw. nächste Angebot als Karte (Anschluss aus P7.2).
    - Doppelter Task-Lauf ohne zusätzliche Wirkung (AK-8-01).
  - Tests: `tests/int/tattoo/offers.int.spec.ts` (Titel „R-171 …“), `tests/int/jobs/revalidate-offers.int.spec.ts`,
    `tests/e2e/tattoo/offers.e2e.spec.ts` (Titel „AK-9-03 …“; legt ein abgelaufenes Angebot über die Local API an und
    ruft `POST /api/cron/run/revalidateEndedOffers` mit `CRON_SECRET`).
  - Ohne Jutta: –

- [ ] **P7.4 R14 Preise, R16 Ablauf, R17 Aftercare, R18 FAQ** – R14 (KONZEPT §9.6, R-034): Mindestpreis aus
  `settings.tattoo.minPriceCents` („Mindestpreis 80 €*“), Preisrahmen eigene Ideen aus `customPriceFromCents`/
  `customPriceToCents` und `priceNote`, Flash-Hinweis mit Link R12, Anzahlung „vereinbaren wir persönlich, außerhalb der
  Website“ ohne Verfall-/Nicht-Erstattungs-Klauseln (V-24), Fußnote `price.tattooNote`, Kontakt-Block mit Betreff
  „Tattoo-Anfrage – eigene Idee“. R16: 5 Schritte aus dem Block `processSteps`, Hinweis „Tattoos erst ab 18“, Ort
  (Bezirk), Kontakt-Block. R17: Phasen aus `aftercareSteps` der Seite `tattoo_aftercare`, Warnzeichen, externer Link auf
  die Safer-Tattoo-Checklisten (einfacher Link, `rel="noopener noreferrer"`, in der V-27-Allowlist), Druck-CSS
  (`@media print`: Navigation, Tuschelinie und Coco ausgeblendet). R18: Einträge aus `faqs` (Kategorie `tattoo`, nach
  `sortOrder`) als `<details>`, ohne JavaScript bedienbar. Registry-Status auf gebaut.
  - Akzeptanz:
    - Alle Tattoo-Preise als Gesamtpreise mit Sternchen und KU-Hinweis (R-034); kein „nicht erstattbar“/„verfällt“ im
      Zusammenhang mit der Anzahlung (V-24).
    - Druckansicht von R17 (`emulateMedia print`) ohne Navigation, Text vollständig.
    - FAQ lässt sich per Tastatur auf- und zuklappen.
  - Tests: `tests/e2e/tattoo/info-pages.e2e.spec.ts` (Titel „R-034 …“).
  - Ohne Jutta: Texte sind Entwürfe (E-62, SEED-SPEC §13.5/§13.6); Jutta passt Aftercare an ihre Methode an.

- [ ] **P7.5 R15 Galerie mit Einwilligungsregel überall** – zentrale Regel `isPubliclyVisible(entry)` in
  `src/lib/tattoo/visibility.ts` nach KONZEPT §9.7 mit DATENMODELL-Namen: sichtbar, wenn `published` und
  (`showsCustomer = false` oder `consentGiven = true`) oder (`seed = true` und `seedPreviewModeActive()` =
  `SEED_PREVIEW_MODE === 'true'` und `APP_ENV ≠ production`). Angewendet in Galerie-Abfragen, Teasern (R11, Startseite),
  OG-Bildern, Sitemap und bei der Auslieferung der Bilddatei: `media.restricted` wird vom Galerie-Hook gepflegt
  (DATENMODELL §6.16); nicht sichtbare Dateien antworten mit **404** (nicht 403) für alle außer der angemeldeten
  Verwaltung, auch bei erratener URL (eigener `handlers`-Eintrag der Upload-Collection oder Route-Wrapper).
  Einwilligungsabhängige Medien (`media.showsPerson = customer`) und Seed-Medien mit `Cache-Control: public,
  max-age=300` und `CDN-Cache-Control: max-age=300`, nie `immutable` (ARCHITEKTUR §3.3; erfüllt R-172 mit höchstens 24 h).
  Seite R15: Filter „alle“/„fresh“/„healed“
  (`?kind=`), Raster ohne Preise, Bild antippen → Vollbild mit Bildunterschrift (ohne JS: Link auf die große Datei),
  Angabe „3,5 Jahre verheilt“/„3.5 years healed“ aus `healedLabel` bzw. `healedDurationMonths`, Etikett „intern –
  Einwilligung fehlt“ an Seed-Ausnahme-Bildern (R-182), Leerzustand „Hier kommen bald Fotos“.
  - Akzeptanz:
    - Ohne Einwilligung nicht in der API-Antwort (mit `SEED_PREVIEW_MODE=false`), mit Einwilligung sichtbar; Cache-Header
      geprüft (R-172).
    - AK-9-04: Bildroute eines Fixture-Tattoofotos analog G1 (`seed = true`, `showsCustomer = true`,
      `consentGiven = false`, `published = true`) → 404 bei `APP_ENV=production` + `SEED_PREVIEW_MODE=true`, 200 bei
      `APP_ENV=preview` + `true`, 404 ohne die Variable.
    - Fixtures analog G1–G6 (SEED-SPEC §12.3: zwei Kundenfotos ohne Einwilligung, vier ohne Kund:in): mit
      Vorschau-Modus die beiden G1/G2-Fälle mit Etikett sichtbar, ohne Vorschau-Modus nur die vier G3–G6-Fälle; R11
      zeigt nur sichtbare Bilder (Anschluss aus P7.2); mit den echten Ankern prüft P8.21.
  - Tests: `tests/int/legal/gallery-consent.int.spec.ts` (Titel „R-172 …“, „AK-9-04 …“; Umgebung als Parameter
    injiziert), `tests/e2e/tattoo/gallery.e2e.spec.ts`.
  - Ohne Jutta: Echte Einwilligungen holt Jutta nach (A13/A48).

- [ ] **P7.6 Tattoo-Verwaltung: Flash** – Ansicht `/tattoo` (KONZEPT §7.12) mit Reitern Flash · Angebote · Galerie ·
  Texte (ersetzt „kommt in P7“). Flash: Liste mit Status-Chips; Wechsel „verfügbar ↔ vergeben“ in höchstens 2 Taps
  (Chip antippen, bestätigen; Feld `status` `available` ↔ `claimed`, setzt/leert `claimedAt`). Wiederholbare Motive
  lassen sich nicht auf „vergeben“ stellen
  (DB-CHECK DATENMODELL §9.2); zum Pausieren dient „Offline nehmen“ (`published = false`). „Neuer Flash“: Zeichnung über
  den Foto-Baustein (P5.5, Alt-Text DE Pflicht, „Vorschlag“), Nummer vorbelegt mit höchster Nicht-Seed-Nummer + 1,
  Titel DE + „Übersetzen“ (`POST /api/flash/:id/translate` über `translateDocumentFields`), Größe (cm + Zusatz),
  Festpreis (≥ 10 €), einmalig/wiederholbar, veröffentlichen; Revalidierung `flash`.
  - Akzeptanz:
    - Wechsel „verfügbar → vergeben“ bei 390×844 in höchstens 2 Taps; öffentliche Seite zeigt danach den Stempel.
    - Nummernvorschlag ignoriert Nummern von Datensätzen mit `seed = true` (Seed 901–910, Fixtures 980–999) → 1 bei
      leerem echten Bestand.
    - Wiederholbares Motiv auf „vergeben“ → verständliche Ablehnung mit Hinweis auf „Offline nehmen“.
  - Tests: `tests/e2e/admin/tattoo-flash.e2e.spec.ts`, `tests/int/tattoo/flash-admin.int.spec.ts`.
  - Ohne Jutta: –

- [ ] **P7.7 Tattoo-Verwaltung: Angebote** – Reiter „Angebote“: Liste mit Zustand kommt/läuft/abgelaufen (abgelaufen
  grau); Formular „Neues Angebot“ (KONZEPT §7.12, DATENMODELL §6.15): Art (`flash_day`/`aktion`), Titel und Text DE/EN
  mit „Übersetzen“, Startdatum, Enddatum (eintägig = gleiches Datum), optionale Uhrzeiten; gespeichert als `startsAt`/
  `endsAt` in Europe/Berlin (ohne Uhrzeit 00:00 bzw. 23:59:59), Ort-Text (Prüfung: enthält nicht `business.street`, E-50),
  Preis-Info mit Hinweis „Gesamtpreise nennen“, verknüpfte Flash-Motive, Bild, veröffentlichen. Speichern setzt
  Weckzeitpunkte für P7.3.
  - Akzeptanz:
    - Angebot „Sa 12.12.2026, 12–19 Uhr“ wird als `startsAt` 11:00 UTC und `endsAt` 18:00 UTC gespeichert; ohne Uhrzeit
      endet es am Enddatum 23:59:59 Berlin.
    - Ort-Text mit der Straße aus den Stammdaten wird abgelehnt.
  - Tests: `tests/int/tattoo/offers-admin.int.spec.ts`, `tests/e2e/admin/tattoo-offers.e2e.spec.ts`.
  - Ohne Jutta: –

- [ ] **P7.8 Tattoo-Verwaltung: Galerie und Einwilligung** – Reiter „Galerie“: Liste mit Einwilligungs-Häkchen je Foto
  (E-42); „Veröffentlichen“ ohne Einwilligung bei `showsCustomer` gesperrt mit Text „Ohne Einwilligung der Kundin/des
  Kunden nicht veröffentlichen“; Felder laut DATENMODELL §6.16 (`consentScope`, `consentDate`, `consentNote`,
  `consentEvidence` privat, `creditHandleAllowed`, `creditHandle`) und `consentWithdrawnAt` (Fristbeginn für L-19 b/L-20;
  laut DATENMODELL §10.1 seit P1 im Schema – hier nur prüfen); `tattoo-gallery` hat keine Versionen/Entwürfe
  (DATENMODELL §1.6, P6.2); Hinweis „Eine Instagram-Freigabe deckt die Website nicht automatisch ab.“ Aktion „Einwilligung widerrufen“ (`POST /api/tattoo-gallery/:id/withdraw-consent`,
  DATENMODELL §6.16): `consentGiven = false`, `published = false`, `consentWithdrawnAt`, Bilder `restricted`, sofortige
  Revalidierung, Audit `gallery_consent_withdrawn`. `retentionConsentEvidence` (P6.15) um die Regel „Bilddateien und
  Varianten spätestens 24 h nach Widerruf löschen“ (L-20) erweitern; `consent_evidence` 3 Jahre nach Widerruf (L-19 b).
  Im DSGVO-Werkzeug „Einwilligungswiderruf“ (P6.18) neben der DHL-Einwilligung auch den Galerie-Widerruf verlinken
  (Sprung zu dieser Aktion am Galerie-Eintrag, LOESCHKONZEPT §5.10). Bestätigung an die Person: M16
  `consent_withdrawal_confirmation` in der Variante Portfolio (P6.18) optional an eine im Dialog eingetippte Adresse –
  der Galerie-Eintrag speichert keine E-Mail; kam der Widerruf per DM, antwortet Jutta dort.
  - Akzeptanz:
    - `published = true` ohne Einwilligung bei `showsCustomer` wird abgelehnt (DM-GAL-01).
    - Nach Widerruf liefert die Bild-URL sofort 404; mit vorgestellter Uhr sind die Dateien nach 24 h gelöscht (R-172,
      L-20); Nachweis bleibt bis zur Frist.
    - Der Link „Galerie-Einwilligung widerrufen“ im DSGVO-Werkzeug führt zur Galerie-Aktion; mit eingetippter Adresse
      steht genau eine M16 (Variante Portfolio) im Mail-Log, ohne Adresse keine (R-152).
  - Tests: `tests/int/legal/gallery-withdraw.int.spec.ts` (Titel „R-172 Widerruf …“, „R-154 L-20 …“, „R-152 Galerie
    …“), `tests/e2e/admin/tattoo-gallery.e2e.spec.ts`.
  - Ohne Jutta: –

- [ ] **P7.9 Tattoo-Texte in der Verwaltung** – Reiter „Texte“: Preise (`settings.tattoo.*`, DE/EN), Stil, Ablauf,
  Aftercare (Blöcke der Seiten `tattoo` und `tattoo_aftercare`) und FAQ der Kategorien `tattoo`/`aftercare`
  (sortierbar) mit „Übersetzen“ (`POST /api/pages/:id/translate`, `POST /api/faqs/:id/translate` über
  `translateDocumentFields`, Blöcke strukturgleich). Beim Speichern Warnung (Speichern bleibt möglich) bei V-24-Mustern
  im Zusammenhang mit Anzahlungen und bei V-15-Mustern (KONZEPT §9.6). Keine Eingabefelder für Gesundheitsdaten (V-25).
  Übrige Seiten und FAQ-Kategorien folgen in P8.
  - Akzeptanz:
    - Text „Anzahlung verfällt bei Absage“ speichert mit sichtbarer Warnung; Mock-Übersetzung setzt „[EN] …“ in alle
      EN-Felder der Blöcke, Struktur gleich.
  - Tests: `tests/int/tattoo/texts-admin.int.spec.ts`, `tests/e2e/admin/tattoo-texts.e2e.spec.ts`.
  - Ohne Jutta: –

- [ ] **P7.10 R10 Auftragsarbeiten-Seite** – Seite `commissions` (DE `/de/auftragsarbeiten`) aus `pages` Schlüssel
  `commissions` (DATENMODELL §6.19): H1 „Auftragsarbeiten“/„Commissions“,
  `processSteps` „So läuft’s“, `imageGallery` (3–9 Beispiele mit Bildunterschrift), Hinweis „individuell vereinbart,
  Bezahlung nicht im Shop, kein Online-Vertrag“, Formular-Block `commissionForm` (Formular folgt in P7.13; bis dahin
  Platzhalter-Text), `faqList` `commissions`, Kontaktalternative (Mail, DM). Kontext `dynamic` (CSP-Nonce, ARCHITEKTUR
  §8.1), Preset `frame` (Kontur um das Formular, DESIGN §9.7). Registry-Status auf gebaut. Die Seite `commissions`
  gehört nicht zum Mini-Satz aus P1.30 (Seed-Seite erst in P8.7): Fehlt sie, rendert R10 H1, Hinweis, Formular-Block und
  Kontaktalternative mit Leerzustand statt 500 (DM-PAGE-01).
  - Akzeptanz:
    - Mit einer Fixture-Seite `commissions` (gleichartig zu SEED-SPEC §13.4): DE/EN → 200, eine `h1`, ohne JavaScript
      lesbar, axe ohne `serious`/`critical`; ohne Seite → 200 mit Leerzustand; mit dem echten Anker prüft P8.21.
    - Kein Kauf-Knopf, kein Preisschild.
  - Tests: `tests/e2e/commission/page.e2e.spec.ts`.
  - Ohne Jutta: Beispielbilder sind ab P8.7 Seed-Ausschnitte (SEED-SPEC §13.4).

- [ ] **P7.11 Upload-Endpunkt `POST /api/uploads/commission`** – Route-Handler (ARCHITEKTUR §2.5, §8.8, KONZEPT §10.2,
  §10.3): Formular-Token (signiert `{ iat, purpose: 'commission', nonce }`, 2 h gültig, HKDF `pc:form-token:v1`, beim
  Rendern der Seite erzeugt) Pflicht; Rate-Limit `commission_upload` 15/h je IP-Hash; Anfragekörper > 4,5 MB → 413 mit
  Text; Typprüfung über den Inhalt (sharp: JPEG/PNG/WebP), sonst 415; Neukodierung mit angewendeter Orientierung, ohne
  EXIF/GPS/XMP/IPTC, Verkleinerung auf ≤ 2560 px falls nötig (R-135); Ablage als `private-uploads` mit `purpose =
  commission_reference`, `status = pending`, `deleteAfter = now + 24 h`; Antwort `{ uploadId, ticket }` mit `ticket` =
  HMAC(uploadId + Formular-Nonce); höchstens 5 Uploads je Formular-Nonce (6. → 409). Keine öffentliche URL.
  - Akzeptanz:
    - GPS-Fixture → gespeicherte Datei ohne EXIF/GPS, richtig gedreht (T-05, R-135).
    - Datei ohne Admin-Anmeldung nicht abrufbar (AK-10-04); umbenanntes PDF → 415; 5 MB → 413; 16. Upload je Stunde → 429;
      6. Upload je Formular → 409.
  - Tests: `tests/int/commission/upload.int.spec.ts` (Titel „R-135 …“, „AK-10-04 …“).
  - Ohne Jutta: –

- [ ] **P7.12 Anfrage absenden: Server Action und Dienst** – Server Action `submitCommissionInquiry` (progressiv) und
  Dienst `src/lib/commission/submit.ts` (KONZEPT §10, R-160, DATENMODELL §6.17): Felder mit DATENMODELL-Namen und
  -Grenzen: `name` 2–100, `email` gültig ≤ 254, `objectType` aus `INQUIRY_OBJECT_TYPES` (Auswahl-Texte: Cap, Shirt,
  Textil sonstiges, Teller, Schale, Tasse, Fliese, Zeichnung/Bild, Schmuck, Etwas anderes), `objectTypeOther` 2–80 bei
  `sonstiges`, `idea` 20–3000 (DATENMODELL §6.17), `desiredTimeframe` ≤ 120, `budget` ≤ 60, `locale`
  aus der Route. Honeypot `website` gefüllt oder Formular-Token jünger als 3 s → Schein-Erfolg ohne Datensatz und ohne
  Mail; Rate-Limit `commission_submit` 5/h und 20/Tag → 429 mit Text aus KONZEPT §10.3. Anlage mit `reference`
  `AA-JJJJ-NNNN` aus `inquiry_number_seq`, Status `new`, `privacyNoticeVersion` = aktive Datenschutzerklärung,
  `lastActivityAt` = jetzt, `deleteAfter` = Eingang + 6 Monate (LOESCHKONZEPT L-10); Uploads nur mit gültigem Ticket
  anhängen (`attached`, `relatedInquiry`, gleiches `deleteAfter`). Mails über die Outbox: M11 `inquiry_receipt` DE/EN
  (Referenz, Zusammenfassung mit Gegenstand, Idee, Zeitraum, Budget und **Anzahl** der Bilder, Antwortzeit-Satz,
  Baustein `inquiry.autoReply` „noch kein Vertrag, keine Zahlung“, Löschung nach 6 Monaten, Link Datenschutz) und A05
  (Referenz, Gegenstand, Anzahl Bilder, Admin-Link – ohne Name, E-Mail, Freitext, Bilder). Keine Personendaten in URL
  oder Logs (R-137).
  - Akzeptanz:
    - Honeypot gefüllt oder Absenden nach < 3 s → Erfolgsanzeige, kein Datensatz, keine Mail (AK-10-02, R-134).
    - 6. Absenden innerhalb einer Stunde vom selben IP-Hash → 429 (AK-10-03).
    - A05 enthält keinen Freitext und keine E-Mail-Adresse; `GET /api/inquiries` ohne Admin → 403 (R-160).
  - Tests: `tests/int/commission/submit.int.spec.ts` (Titel „AK-10-02 …“, „AK-10-03 …“, „R-160 …“, „R-134 Anfrage …“),
    `tests/unit/email/inquiry-receipt.unit.spec.ts` (Snapshots M11 DE/EN).
  - Ohne Jutta: Antwortzeit-Satz ist Seed-Vorlage.

- [ ] **P7.13 Formular im Browser: Bildauswahl, Verkleinerung, Fehlerfälle** –
  `src/components/commission/CommissionForm.tsx` mit den Formularbausteinen aus KO-12: Pflichtfelder mit „*“,
  Fehlerzusammenfassung mit Sprunglinks, FileDrop mit
  echtem `<input type="file" multiple accept="image/jpeg,image/png,image/webp">`, höchstens 5 Bilder (6. mit Hinweis
  abgelehnt), je Datei ≤ 15 MB vor der Verkleinerung, Verkleinerung im Browser auf ≤ 2560 px und ≤ 4 MB (JPEG, Qualität
  schrittweise 0,85 → 0,6), jedes Bild einzeln hochgeladen mit Fortschritt; fehlgeschlagener Upload → Hinweis am Bild,
  Absenden ohne dieses Bild möglich; Vorschau-Kacheln 72 px mit „Entfernen“. Hinweis „Bitte keine Fotos, auf denen
  Personen erkennbar sind, und keine Gesundheitsangaben.“ Unter „Anfrage senden“/„Send request“ Baustein
  `inquiry.privacyNotice` mit Link auf den passenden Abschnitt der Datenschutzerklärung (R-138); keine
  Einwilligungs-Checkbox. Erfolg ersetzt das Formular („Danke! Deine Anfrage AA-… ist angekommen. Du bekommst gleich eine
  Bestätigung per Mail.“, Fokus auf die Meldung); Serverfehler lassen die Eingaben stehen (nur Seitenzustand, kein
  Browser-Speicher, R-130). Ohne JavaScript: Formular funktioniert ohne Bilder, Hinweis „Bilder nur mit JavaScript“.
  - Akzeptanz:
    - Formular mit 5 Bildern à 3,9 MB wird vollständig gespeichert; ein 6. Bild wird abgelehnt (AK-10-01).
    - Nach dem Absenden enthält die URL keine Eingaben (R-137); Datenschutz-Hinweis und Link am Formular (R-138).
    - Tastatur-Durchlauf, axe ohne `serious`/`critical` bei 390×844; kein Eintrag in `localStorage`/`sessionStorage`.
  - Tests: `tests/e2e/commission/form.e2e.spec.ts` (Titel „AK-10-01 …“, „R-137 Anfrage …“, „R-138 Anfrage …“,
    „T-05 …“; Testbilder zur Laufzeit mit sharp erzeugt), Projekte `iphone-15` und `desktop`.
  - Ohne Jutta: –

- [ ] **P7.14 Anfragen Ende-zu-Ende, 6-Monats-Löschung und Vorlage `commission.offer`** – Durchstich Formular →
  Mails → „Anfragen“ (P5.20) → „Jetzt löschen“. Löschung prüfen: `retentionCommissionInquiries` löscht Datensatz und
  Bilder 6 Monate nach Eingang ohne Verlängerung, die Verwaltung zeigt „wird gelöscht am {Eingang + 6 Monate}“;
  `retentionTechnical` löscht nicht abgeschickte Uploads nach 24 h. Die Seed-Anfragen A1–A7 legt erst P8.5 an: hier nur
  prüfen, dass SEED-SPEC §11 `deleteAfter = createdAt + 6 Monate` vorgibt; die Löschung prüfen Fixture-Anfragen analog
  A1–A7 (mit den echten Ankern prüft P8.21). Baustein `commission.offer` (R-161) als Platzhalter (`origin = placeholder`, Grund-Seed
  aus P6.1) mit Gliederung: wesentliche Eigenschaften,
  Gesamtpreis inkl. Versand, Lieferzeit, Zahlungsweg, Herstellerangaben/Warnhinweise (GPSR), Widerrufsinformation
  (Ausschluss nur bei Anfertigung nach individuellen Vorgaben, sonst Belehrung und Muster-Formular beifügen); im
  Anfrage-Detail Knopf „Angebots-Vorlage kopieren“ bzw. `mailto:` mit Referenz; Hinweis „Umsatz als Monatssumme
  ‚Auftragsarbeiten‘ eintragen“ mit Link zum Umsatz-Wächter (R-125).
  - Akzeptanz:
    - Anfrage bleibt bis Eingang + 6 Monate, ist am Tag danach samt Dateien gelöscht, auch bei späterer Aktivität; mit
      Aufbewahrungssperre bleibt sie; je Anfrage ein `deletion-log`-Eintrag ohne Inhalte (L-10, DM-INQ-01, AK-8-03).
    - Gesamter Ablauf e2e: Formular mit 2 Bildern → M11 und A05 im Mail-Log → Anfrage in der Verwaltung mit Bildern nur
      nach Anmeldung → „Jetzt löschen“ entfernt alles.
    - Vorlage `commission.offer` vorhanden; ANFORDERUNGEN §7 Teil A „R-161“ abgehakt.
  - Tests: `tests/int/legal/retention-inquiries.int.spec.ts` (Titel „R-154 L-10 …“), `tests/e2e/commission/flow.e2e.spec.ts`.
  - Ohne Jutta: Kanzleitext für `commission.offer` kommt in P11 (Kanzleifrage K-24).

- [ ] **P7.15 Rechtliche Prüfungen Tattoo und Nachverfolgbarkeit bis P7** – `tests/e2e/tattoo/no-purchase.e2e.spec.ts`:
  auf allen Tattoo-Routen DE/EN kein „In den Korb“, kein `<form>`, kein Stripe-Request (AK-9-01); keine Straße aus den
  Stammdaten (AK-9-05, V-31); Instagram nur als Link (R-139, V-05). Int-Test: Warenkorb-Aktion mit Flash- oder
  Angebots-ID wird abgelehnt (R-170). Unit-Scan der Tattoo-Inhalte (Seed-Dateien unter `content/seed/data/` und
  Test-Fixtures, Seiten `tattoo`/`tattoo_aftercare`, FAQ `tattoo`/`aftercare`; die Seed-Dateien dafür kommen in
  P8.6/P8.7 hinzu und laufen dann automatisch mit) auf V-15, V-24, V-25. Tabelle ANFORDERUNGEN §3: Spalte „Nachweis“
  für alle P7-Zeilen füllen;
  `LEGAL_TRACE_PHASE = 7`. DESIGN §13 Zeile P7 (KO-20, Presets `stencil`/`frame`, MI-14) im PR-Text nachweisen.
  - Akzeptanz:
    - AK-9-01 und AK-9-05 grün auf `desktop`, `iphone-15`, `pixel-7`; R-170 int grün; V-15/V-24/V-25-Scan grün.
    - Traceability-Test mit `LEGAL_TRACE_PHASE = 7` grün (R-001).
  - Tests: `tests/e2e/tattoo/no-purchase.e2e.spec.ts` (Titel „AK-9-01 …“, „AK-9-05 …“, „R-139 …“),
    `tests/int/legal/tattoo-cart.int.spec.ts` (Titel „R-170 …“), `tests/unit/legal/tattoo-content.unit.spec.ts`,
    `tests/unit/legal/traceability.unit.spec.ts`.
  - Ohne Jutta: –

### Phasen-Abnahme

- [ ] Alle Aufgaben P7.1–P7.15 erledigt; `pnpm check`, `pnpm test:int`, `pnpm test:e2e` und `pnpm build` lokal grün.
- [ ] P7 braucht keine eigene Schema-Migration (DATENMODELL §10.1); `pnpm check:migrations` ohne Drift, Typen und
  Importmap committet; geprüft, dass `tattoo-gallery.consentWithdrawnAt` (DATENMODELL §6.16) seit P1 im Schema liegt und `tattoo-gallery` keine Versionen
  hat; geprüft, dass KONZEPT AK-8-03 und SEED-SPEC §11 die Löschung 6 Monate nach Eingang nennen; SEED-SPEC SE-09 als
  geklärt vermerkt.
- [ ] `LEGAL_TRACE_PHASE = 7`; Nachweise im PR-Text: AK-9-01 bis AK-9-05, AK-10-01 bis AK-10-04, T-05, R-IDs aus
  „Referenzen“ je mit Testdatei.
- [ ] CI grün: Der Phasenende-Commit (z. B. `chore(P7): finish phase [ci:full p7]`, der letzte Commit ohne
  `[skip ci]`) hat `CI / quick`, `ci-full` (`e2e-full` inkl. `@a11y` und `@privacy`; `quality` mit Lighthouse-CI für
  `/de/tattoo` innerhalb EK-01 und visuellen Referenzen für Flash, Angebote, Galerie, Auftragsarbeiten) und
  `preview-export` grün durchlaufen. Dieses Häkchen setzt ein reiner Doku-Commit mit `[skip ci]`, nachdem der Lauf grün
  ist.
- [ ] Vorschau-Artefakt `planet-claire-vorschau-p7-<sha7>` enthält R10–R18 DE/EN mit dem Mini-Bestand bzw. den
  Leerzuständen und die Admin-Fotos des Bereichs „Tattoo“; Flash, Angebote und Galerie des Beispielbestands (G1/G2 mit
  Etikett „intern – Einwilligung fehlt“, TO3 unsichtbar) zeigt die Vorschau erst ab P8.21.
- [ ] `docs/FORTSCHRITT.md` mit Phasen-Eintrag; PR-Beschreibung aktualisiert; neue Annahmen in `docs/OFFENE-PUNKTE.md`
  (mindestens: Pausieren wiederholbarer Flash über „Offline nehmen“, Anfrage-Löschung ab Eingang, M16-Portfolio nur an
  eine im Dialog eingetippte Adresse); neue
  Jutta-Aufgaben als A51 ff. in `docs/owner/AUFGABEN.md`, soweit nicht schon vorhanden.

---

## P8 – Inhalte & kompletter Beispielbestand

**Ziel:** Nach P8 wirken Website und Verwaltung „bewohnt“ (E-63): Der Beispielbestand entspricht exakt
`content/seed/SEED-SPEC.md`; die Mengen stehen **nur** in SEED-SPEC §0.1 (im Code `SEED_EXPECTED_COUNTS`, P8.1) – Stücke,
Bestellungen in allen Status und Kassen (Vorgänge ohne Bestellung sind Kassen) samt Reservierungen, Belegen,
Widerrufen, Anfragen, Umsätzen und Protokollen, Flash, Angebote, Galerie-Einträge, alle Seiten und die FAQ. Alle Texte
liegen DE und EN in Juttas Ton vor (E-62), Stücke ohne Foto zeigen handgezeichnete Platzhalter-SVGs, die Stationszeichnungen
v1 sind aus Juttas Bildern vektorisiert, leere Zustände, 404 und 500 sind fertig gestaltet, „Über mich & Coco“ (R19)
steht, und der Knopf „Beispieldaten entfernen“ funktioniert. Zwei wiederholbare Import-Skripte übernehmen Juttas
Instagram-Datenexport (volle Auflösung, E-64) und ihre Coco-Fotos (Zeichenvorlagen für P9, E-75), sobald sie im Repo
liegen – fehlen sie, läuft alles mit den 640-px-Bildern und den Highlight-Bildchen weiter.

**Voraussetzungen:** P1–P7 abgeschlossen; gemergt oder im Arbeitsbranch enthalten (Collections und Seed-Grundgerüst
aus P1 mit Lader, zod-Schemas, Guard, `time.ts`, `tokens.ts`, `fallbackArt.ts`, `remove.ts`; Beleg-PDF-Renderer P4;
Handy-Verwaltung P5; Rechtsseiten P6; Tattoo-Seiten und Auftragsarbeiten P7). Kanonische Referenzzeit `SEED_NOW=2026-10-15T10:00:00+02:00`
(ARCHITEKTUR §5.2). Vor jeder Arbeit mit Juttas Uploads `git fetch origin && git merge origin/main` (Uploads landen
direkt auf `main`, ANLEITUNGEN Anhang). Der Seed-Code liegt in `src/lib/seed/` (ARCHITEKTUR §2.1, SEED-SPEC §1.4,
§2.1), die CLI in `scripts/seed/cli.ts`; nichts wird doppelt angelegt. Umgebungsvariablen immer mit den Namen aus
ARCHITEKTUR §5.2; „Produktion“ heißt immer `APP_ENV=production`.

**Referenzen:** E-10, E-12, E-14…E-18, E-42, E-50…E-53, E-60…E-64, E-73, E-75, E-76, E-98; R-001, R-002, R-139, R-172,
R-180, R-181, R-190, V-01…V-31 (RECHT §5), RECHT §7 Teil A; KONZEPT §1.4 (EK-09), §2.2, §3.0.6, §3.1, §3.12, §3.14,
§3.17, §9.3, §9.7, §11, §12; DATENMODELL §4, §5, §6.2, §6.4, §6.8.8, §6.14–§6.20, §6.25, §7.2, §13; ARCHITEKTUR
§2.1, §2.4, §4.8, §6.10, §7.2, §8.8, §14.4, §14.7, Anhang C (C-15); DESIGN KO-17, KO-18, KO-21, §9.7 (`about`), §10.1,
§10.6, §12.1–§12.5, §13; SEED-SPEC §0–§20 (offene Punkte SE-xx in §20); ANLEITUNGEN I2, C1, Anhang.

### Aufgaben

- [ ] **P8.1 Bestandsaufnahme Beispielbestand und Abgleich der Seed-Festlegungen** – Nach `pnpm seed:reset`
  (kanonisches `SEED_NOW`) Datendateien `content/seed/data/*.json`, Schemas und Mengen mit SEED-SPEC §0.1 vergleichen
  (`pnpm seed:remove` ohne `--yes` liefert die Mengenvorschau). Soll-Mengen als einzige Quelle für Tests in
  `src/lib/seed/expected.ts` (`SEED_EXPECTED_COUNTS`) anlegen. In `docs/FORTSCHRITT.md` je folgender Datenaufgabe
  (P8.2–P8.9 einschließlich P8.4a und P8.5a) vermerken, ob sie „bauen“ oder „nur prüfen/ergänzen“ bedeutet.
  Prüfen, dass der Code die Seed-Festlegungen aus SEED-SPEC §0.3 und DATENMODELL §13.2–§13.3 (ARCHITEKTUR C-15) einhält: Nummern
  `PC-2026-900NN`, Belegserien `BSP-RE`/`BSP-GS`, Widerrufe `WR-2026-9000N`, Anfragen `AA-2026-900N`; sichtbares
  Etikett „Beispiel“; Bestellvorgänge nach dem Kassen-Modell (Vorgänge ohne Bestellung sind `checkouts`, DATENMODELL
  §6.25); keine erfundene Konformitätserklärung – alle Keramik `deko`; Beispiel-IBAN `DE36000000000000000000`.
  Abweichungen behebt P8 im Code und in den Seed-Daten, nicht in den Dokumenten. Die bei P8 noch offenen Punkte aus
  SEED-SPEC §20 (alle SE-Zeilen, die dort nicht als geklärt vermerkt sind; SE-09 nur, wenn P7 ihn nicht erledigt hat)
  als Zeilen in `docs/OFFENE-PUNKTE.md` übernehmen.
  - Akzeptanz:
    - `src/lib/seed/expected.ts` enthält jede Zeile aus SEED-SPEC §0.1 (u. a. `media`, `private-uploads`, `orders`,
      `checkouts`, `reservations`, `invoices`, `complaints`, `privacy-requests`, `email-log`, `consent-log`,
      `audit-log`); kein Test und keine
      Plan-Aufgabe hartkodiert Mengen an anderer Stelle.
    - FORTSCHRITT-Eintrag listet je Collection Ist/Soll.
    - OFFENE-PUNKTE enthält die offenen SE-Punkte mit ihrer ID und den Spalten „Standard“, „Entscheidet“,
      „So änderbar“.
    - Jede Seed-Bestellung hat einen Status aus `ORDER_STATUSES`; Vorgänge ohne Bestellung liegen nur als
      `checkouts` vor. Die Konventions-Tests (Nummern-Regex, Etikett, IBAN) laufen in P8.4, P8.4a und P8.9.
  - Tests: `tests/unit/seed/expected.unit.spec.ts` – liest die Tabelle SEED-SPEC §0.1 per Markdown-Parser und
    vergleicht sie mit `SEED_EXPECTED_COUNTS` (Doku und Code können nicht auseinanderlaufen).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: Jutta entscheidet die SE-Zeilen in OFFENE-PUNKTE (z. B. SE-01
    mögliche Liedzeilen auf S04–S06, SE-02 Cap-Foto, SE-06 Material- und Maßangaben, SE-07 Aftercare/FAQ).

- [ ] **P8.2 Medien und private Dateien des Beispielbestands** – `content/seed/data/media.json` exakt nach SEED-SPEC
  §4.1 (Instagram-Ausschnitte mit `crop`/`focal` in Prozent, Alt-Texte DE/EN, `showsPerson`, `restricted`,
  `sourceRef`) und §4.2 (Platzhalter mit Wash-Farbe und Alt „Platzhalter-Zeichnung: {Objekt}“ / “Placeholder
  drawing: {object}”), `content/seed/data/private-uploads.json` nach §4.4 (`nickel-demo`, `glaze-demo`,
  `O12:packing-1`, `O12:packing-2`, `A2:sketch-1`, vom Seed erzeugt; Beleg-PDFs kommen in P8.4a dazu). Der Seed schneidet mit sharp **vor** dem Upload aus
  (`round(pct / 100 × Kante)`), lädt über die Local API in `media` hoch und durchläuft damit dieselbe Pipeline wie
  Juttas Uploads (Größen `thumb`/`card`/`detail`/`zoom`/`og`, `dominantColor`, `placeholderDataUrl`, keine
  Metadaten; DESIGN §13 „Seed-Bilder durch die Pipeline“). Platzhalter kommen aus `src/art/placeholders/{typ}-{n}.svg`,
  fehlt die Datei aus `src/lib/seed/fallbackArt.ts`, gerastert als WebP 800×1000.
  - Akzeptanz:
    - `media`-Dokumente in der Menge aus `SEED_EXPECTED_COUNTS` (SEED-SPEC §0.1), alle mit `seed = true` und `seedKey`
      (`media:ig:…`, `media:ph:…`); `source` = `instagram_seed` bzw. `placeholder`.
    - Ausschnitt-Pixel entsprechen bei 640-px-Quellen exakt der Kontrollspalte in §4.1.
    - AK-SEED-19: kein Bild aus `highlight-*.jpg`/`profil.jpg` importiert (SHA-256-Vergleich);
      `post-DdHXUQsDjqm.jpg` existiert nur als Ausschnitt `#cap`.
    - `ig:DOZTG7PjLAD` und `ig:DZqBCSZDDiE`: `showsPerson = customer`, `restricted = true`; ohne Anmeldung liefert
      die Datei-URL 404 (DM-MEDIA-04).
    - Keine Bildgröße ist hochskaliert (`withoutEnlargement`); keine gespeicherte Datei enthält EXIF (DM-MEDIA-01).
    - Alle `private-uploads` aus §4.4 mit `seed = true`, ohne Anmeldung nie abrufbar (R-136).
  - Tests: `tests/unit/seed/crop.unit.spec.ts` (alle Zeilen §4.1: Prozent → Pixel);
    `tests/int/seed/media.int.spec.ts` (Mengen, Felder, AK-SEED-19, 404 für eingeschränkte Bilder ohne Login).
  - Ohne Jutta: mit den 640-px-Bildern aus `content/seed/instagram/`. P11-Nacharbeit: –

- [ ] **P8.3 Stücke mit allen Pflichtangaben** – `content/seed/data/products.json` nach SEED-SPEC §2.6 (Form),
  §5.1 (Übersicht), §5.2 (gemeinsame Werte), §5.3 (Maße, Gewicht, Textilangaben, Verkaufsfelder) und §5.4 (Texte DE/EN
  inkl. `juttaSays`). Status, Verkaufsfelder und Zeitstempel nur beim Anlegen setzen (SEED-SPEC §1.3, §1.6);
  `validateForPublish` läuft für `available`/`reserved`. Verweise `currentOrder`/`reservationRef` setzt P8.4.
  - Akzeptanz:
    - Anzahl Stücke gleich `SEED_EXPECTED_COUNTS.products`, Nummern im Seed-Bereich 901–930; Verteilung je Kategorie
      und Status exakt wie SEED-SPEC §0 und §5.1 (Soll-Werte nur in `src/lib/seed/expected.ts`, aus SEED-SPEC
      übernommen); `showInArchiveAfterSale` je verkauftem Stück laut §5.3; S09 ist `archived` (vor dem Versand
      zerbrochen, O08 mit Grund `breakage` erstattet).
    - AK-SEED-06: jedes `available`/`reserved`-Stück besteht `validateForPublish`; S18 scheitert genau an der
      Faserangabe, S25 genau an „Bildbeschreibung EN“.
    - Sonderfälle vorhanden: S11 Mischgewebe + abweichende Beschaffenheit, S14 `labelMissing` mit
      `fiberFreeText`, S22 Abweichung Papier, S26–S29 Nickel-Nachweis `private-uploads:nickel-demo` +
      `smallPartsWarning`, S30 `nur_abholung`, S29 `i18n.enStatus = missing`, S23 `machine`, alle Keramik
      `foodContact = deko`, alle Zeichnungen `vatCategory = reduced_art`, alle `ownDesignConfirmed = true` (E-18).
    - Produkttexte ohne Treffer der Verbotsmuster (RECHT §5, insb. V-08, V-13…V-20).
  - Tests: `tests/int/seed/products.int.spec.ts` (Mengen, Status, Sonderfälle, AK-SEED-06); der Verbotsmuster-Test
    `tests/unit/legal/forbidden.unit.spec.ts` läuft über `content/seed/**`.
  - Ohne Jutta: vollständig machbar; Material-, Faser- und Maßangaben sind Annahmen (SE-06, steht in OFFENE-PUNKTE),
    Bildinhalte S04–S06 neutral betitelt (SE-01). P11-Nacharbeit: –

- [ ] **P8.4 Bestellungen, Kassen und Reservierungen** – `content/seed/data/customers.json` (erfundene
  Personen, SEED-SPEC §6) und `orders.json` mit den Bestellungen und Kassen aus SEED-SPEC §7.1–§7.3 (Zeitleisten,
  Zahlungen, Sendungen, Erstattungen, Anfechtung). Es gilt das Kassen-Modell (KONZEPT §4, §5.2, §5.3; DATENMODELL §6.25,
  §13.2): Vorgänge ohne Bestellung – die abgebrochene PayPal-Kasse und die laufende Kasse – legt der Seed als
  `checkouts` mit `status = expired` bzw. `open` samt ihrer Reservierung an, nie als Bestellung. Bestellungen entstehen
  im Seed-Kontext direkt mit Endstatus (SEED-SPEC §1.6). Die Erstattung einer bezahlten Bestellung vor dem Versand ist
  `refunded` (Übergang O15, Gutschrift mit demselben Grund aus `REFUND_REASONS`): O08 – Keramik vor dem Versand
  zerbrochen – mit Grund `breakage`, Stück S09 danach `archived` (P13, SEED-SPEC §7.2); ein Storno ohne Bruch durch
  Jutta hätte den Grund `admin_cancellation`. `cancelled` gibt es nur für die überfällige Vorkasse
  (`cancelReason = payment_timeout`); die Anfechtung ist eine Bestellung im Status `disputed` mit
  `statusBeforeDispute`, `dispute.status = open` und `adminAttention.reason = dispute_open` (O16). Jede Bestellung, die
  `shipped` erreicht hat, trägt Verpackungsdaten (`packaging.templateKey`, `packaging.components`,
  `packaging.recordedAt`) aus `settings.packaging.defaultsByShippingClass` (DATENMODELL §6.8.8). Sendungsverfolgung:
  `shipment.trackingUrl` entsteht mit `trackingUrl(carrier, trackingNumber, locale)` aus den Vorlagen
  `settings.shipping.trackingUrlTemplates` des Grund-Seeds (DATENMODELL §7.1, DM-12) – O03 (Brief, `deutsche_post`)
  aus der Vorlage `deutsche_post`, O10 aus der Vorlage `dhl`; ohne Sendungsnummer kein Link (SEED-SPEC §7.2, SE-08).
  Daraus `reservations` (§8). Snapshot-Felder berechnet der Seed mit denselben Funktionen wie die Kasse
  (`buildCharacteristics()` usw., SEED-SPEC §2.6). Kunden-Token nur für `seed = true` deterministisch über
  `seedToken(seedKey, purpose)` aus `src/lib/seed/tokens.ts` (SEED-SPEC §2.5; nie aus `orderNumber`, nie aus `PAYLOAD_SECRET`; ARCHITEKTUR §8.6, §14.4):
  Bestellungen erhalten `statusTokenHash` aus `seedToken('orders:<Key>', 'status')` und in `statusTokenSealed` denselben
  Token versiegelt (P4.1); Kassen – auch `KS1`/`KS2` – erhalten `tokenHash` aus `seedToken('checkouts:<Key>',
  'checkout')`. Beispiel-Bestellungen werden nie automatisch rotiert: Scheitert das Entsiegeln (Schlüsselwechsel),
  entsteht für sie kein neuer Token und keine Mail. Danach `checkouts.order`, `orders.checkout`, `reservations.order`
  und `products.currentOrder`/`reservationRef` verknüpfen (SEED-SPEC §1.7 Schritt 5). Die Belege legt P8.4a an.
  - Akzeptanz:
    - AK-SEED-07: jeder Wert aus `ORDER_STATUSES` (inkl. `disputed`) und jeder Wert aus `PAYMENT_METHODS`,
      beide `FULFILLMENT_METHODS` und jede `products.status`-Ausprägung kommen vor; `cancelled` nur mit
      `cancelReason = payment_timeout`; die Erstattung vor dem Versand (O08) steht als `refunded` mit Grund `breakage`
      (Gutschrift prüft P8.4a), S09 ist `archived`.
    - Kassen: die Seed-`checkouts` stehen in `expired` (Reservierung `released`, `session_expired`) und `open`
      (Reservierung `active`); kein Datensatz enthält einen Bestellstatus außerhalb von `ORDER_STATUSES`.
    - Verpackung: jede versendete Seed-Bestellung hat `packaging.components` ≥ 1 und `packaging.recordedAt`; der
      Jahres-Export `GET /api/admin/packaging-report?year=2026` enthält keine Seed-Sendung, auch nicht mit
      `SEED_PREVIEW_MODE=true`.
    - AK-SEED-09: Zeitlogik je Bestellung monoton; Widerruf ≤ 14 Tage nach `deliveredAt`/`pickedUpAt`;
      `firstPublishedAt` < `placedAt`.
    - AK-SEED-12: alle Personen-E-Mails `@example.com`/`@example.org`, keine Telefonnummer.
    - Summen je Bestellung wie §7.1 (z. B. O05 = 11490, O14 = 18650); `stripe.livemode = false`; vorhandene
      Tracking-Nummern erfüllen `^[A-Z0-9]{8,35}$`; `legalTextVersions` zeigen auf die v1-Platzhalter
      (`origin = placeholder`).
    - Sendungsverfolgung: O03 hat `shipment.trackingUrl` = Vorlage `deutsche_post` mit eingesetzter Nummer
      `SEEDDP000000003DE`, O10 = Vorlage `dhl` mit seiner Nummer; beide Vorlagen stammen aus dem Grund-Seed (DM-12).
    - `seedToken(seedKey, 'checkout' | 'status')` liefert bei geändertem `PAYLOAD_SECRET` denselben Wert; echte
      Bestellungen und Kassen erhalten nie ein Seed-Token; `unsealToken(statusTokenSealed)` einer Seed-Bestellung ergibt
      `seedToken('orders:<Key>', 'status')`; schlägt das Entsiegeln fehl, wird eine Seed-Bestellung nicht rotiert.
  - Tests: `tests/int/seed/orders.int.spec.ts` (Status, Kassen, Verpackung, Sendungsverfolgung O03/O10),
    `tests/unit/seed/timeline.unit.spec.ts` (AK-SEED-09 direkt auf den Datendateien),
    `tests/unit/seed/persons.unit.spec.ts` (AK-SEED-12), `tests/unit/seed/tokens.unit.spec.ts` (unabhängig von
    `PAYLOAD_SECRET`); `tests/e2e/seed-status.e2e.spec.ts` (AK-SEED-20: Status-URLs aus
    `seedToken('orders:<Key>', 'status')` für O01, O10, O13 und Danke-URLs aus `seedToken('checkouts:<Key>', 'checkout')`
    für O13, O14 öffnen die Seiten mit „Beispiel“; fremder Token → 404).
  - Ohne Jutta: vollständig mit `PAYMENTS_DRIVER=mock`. P11-Nacharbeit: –

- [ ] **P8.4a Belege des Beispielbestands** – `invoices` nach SEED-SPEC §9 über den normalen Zähler mit den Serien
  `BSP-RE`/`BSP-GS`, je Serie streng nach `issueAt`; Snapshot-Felder mit denselben Funktionen wie die Kasse (SEED-SPEC
  §2.6). Beleg-PDFs rendert der Seed direkt mit dem P4-Renderer (ohne Job) mit dem Wasserzeichen „BEISPIELBELEG – kein
  echter Beleg“ und legt sie als `private-uploads` `invoice-pdf:<Nummer>` ab. Danach `orders.invoice` und
  `refunds[].creditNote` verknüpfen (SEED-SPEC §1.7 Schritt 6).
  - Akzeptanz:
    - AK-SEED-08: Belegnummern und Zählerstände `BSP-RE`/`BSP-GS` exakt wie SEED-SPEC §9; `RE`/`GS` unverändert.
    - `orders.invoice` und `refunds[].creditNote` zeigen auf die Belege laut §9; O08 hat seine Gutschrift mit Grund
      `breakage`.
    - Jedes Beleg-PDF enthält den Wasserzeichen-Text (Textextraktion), `sha256` gesetzt, `status = issued`.
  - Tests: `tests/int/seed/invoices.int.spec.ts`.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P8.5 Widerrufe, Anfragen und Umsätze** – `content/seed/data/withdrawals.json` (SEED-SPEC §10, W1–W7 inkl.
  `submissionSnapshot`, `refundDueAt`, unveränderlicher Texte; W6 `closed` mit `closeReason = duplicate`, W7 `rejected`
  mit `closeNote` und `spam.*`), `inquiries.json` (§11, A1–A7; Referenzbild nur bei A2 aus
  `private-uploads:A2:sketch-1`; `deleteAfter`), `revenue.json` (Einträge `M-9`…`M-1`, §15); Mengen laut SEED-SPEC
  §0.1. Für
  `revenue-entries` prüfen, dass die Regel aus P1.24 greift (ein echter Eintrag entfernt beim Anlegen einen Seed-Eintrag
  mit gleichem (`month`, `source`) in derselben Transaktion); der Seed überspringt belegte Paare (SEED-SPEC §1.3,
  DATENMODELL §6.20).
  - Akzeptanz:
    - `matchStatus`/`status` je Widerruf wie §10 (`auto_matched`, `manually_matched`, `needs_manual_match`, `no_order`;
      jeder Wert aus `WITHDRAWAL_STATUSES` kommt vor: `received`, `goods_returned`, `partially_refunded`, `refunded`,
      `closed` bei W6, `rejected` bei W7); W5 `locale = en`; W3 `refundDueAt` = `D+5@19:30`; W6 und W7 ändern keine
      Bestellung und zählen nicht zu den offenen Widerrufen (§17).
    - Anfragen A1–A7 in den Status laut §11; jeder Wert aus `INQUIRY_STATUSES` kommt genau einmal vor.
    - Verwaltung „Heute“ zeigt genau die Anker aus SEED-SPEC §17 (u. a. Zu packen, Vorkasse offen, Abholung,
      Widerrufe offen, neue Anfragen, roter Hinweis an der Bestellung im Status `disputed`, Hinweis „Beispieldaten
      vorhanden“); die Soll-Zahlen liest der Test aus `SEED_EXPECTED_COUNTS` bzw. einer Anker-Tabelle in
      `src/lib/seed/expected.ts`.
    - Umsatz-Wächter zeigt mit wirksamem `SEED_PREVIEW_MODE` „im grünen Bereich“ (< 80 % von 25 000 €); ohne
      wirksamen Modus zählen Seed-Umsätze nicht. AK-SEED-21: Monats-CSV, DATEV-Export, Rechnungs-ZIP und
      Verpackungs-CSV enthalten nie Seed-Daten – auch nicht bei wirksamem `SEED_PREVIEW_MODE` (KONZEPT §11.4, R-124).
    - AK-SEED-15 (Umsatz-Teil): ein echter Eintrag `2026-09/tattoo` bleibt bei `seed`, `seed:remove` und
      `seed:reset` unverändert.
  - Tests: `tests/int/seed/withdrawals-inquiries.int.spec.ts`; `tests/int/seed/revenue.int.spec.ts` (Verdrängen,
    Überspringen, Exporte ohne Seed).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P8.5a Reklamationen, Datenschutz-Anfragen und Status-Abdeckung** – Ergänzungen des Beispielbestands laut
  SEED-SPEC (Mengen in §0.1): Reklamationen RK1–RK4 (`complaints`, DATENMODELL §6.29, SEED-SPEC §10a) – je Wert aus
  `COMPLAINT_STATUSES` eine, jeweils an einer bezahlten Seed-Bestellung nach Versand bzw. Übergabe; Datenschutz-Anfragen
  DS1–DS5 (`privacy-requests`, DATENMODELL §6.26, SEED-SPEC §11a) – je Wert aus `PRIVACY_REQUEST_STATUSES` eine, ohne
  Exportdatei. Danach prüfen, dass zusammen mit P8.5 jeder Wert aus `WITHDRAWAL_STATUSES`,
  `WITHDRAWAL_MATCH_STATUSES`, `COMPLAINT_STATUSES`, `INQUIRY_STATUSES` und `PRIVACY_REQUEST_STATUSES` vorkommt
  (AK-SEED-22). Alle Datensätze mit `seed = true` und `seedKey`, Daten in `content/seed/data/`,
  Personen nur `@example.com`/`@example.org` ohne Telefonnummer, Nummern und Referenzen im Seed-Bereich laut DATENMODELL
  §13.3; alle entfernbar (P8.9). `privacy-requests` trägt `seedField()` seit P1.24 (DATENMODELL §6.26, DM-19): nur
  prüfen; fehlt das Feld doch, per eigener Migration nachziehen und DATENMODELL §10.1 im selben PR angleichen.
  - Akzeptanz:
    - Mengen = `SEED_EXPECTED_COUNTS` (SEED-SPEC §0.1); AK-SEED-22: jeder Wert aus `WITHDRAWAL_STATUSES`,
      `WITHDRAWAL_MATCH_STATUSES`, `COMPLAINT_STATUSES`, `INQUIRY_STATUSES` und `PRIVACY_REQUEST_STATUSES` kommt
      mindestens einmal vor (W6 `closed`, W7 `rejected` aus P8.5).
    - Bei kanonischem `N` ist keine Datenschutz-Erinnerung fällig; die Fristen-Jobs überspringen Beispieldaten ohnehin
      (DATENMODELL §11): `privacyRequestsDeadlineReminder` und `withdrawalDeadlines` senden nach `pnpm seed` und einem
      vollen Joblauf keine Mail.
    - Feldregeln eingehalten: Reklamationen nur an Bestellungen mit Zahlung, `carrierClaimDueAt`/`warrantyEndsAt`
      berechnet (DM-CMP-01); Datenschutz-Anfragen mit kalendergenauem `dueAt` (DM-PRQ-01), `answeredAt` bei
      `answered`/`rejected`, `resultNote` bei `rejected`.
    - „Heute“ zeigt genau die Anker aus SEED-SPEC §17 (Anker-Tabelle in `src/lib/seed/expected.ts`), einschließlich der
      Hinweise, die diese Datensätze auslösen (z. B. offene Datenschutz-Anfragen mit nächster Frist, KONZEPT §7.3); der
      Seed versendet nichts (AK-SEED-05).
    - `seed:remove --yes` entfernt alle diese Datensätze; ein zweiter `pnpm seed` legt nichts doppelt an (SEED-SPEC §1.3).
  - Tests: `tests/int/seed/complaints-privacy.int.spec.ts`; Erweiterung `tests/int/seed/withdrawals-inquiries.int.spec.ts`
    (alle Status).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P8.6 Tattoo-Bestand: Flash, Angebote, Galerie** – `content/seed/data/tattoo.json` nach SEED-SPEC §12.1
  (Flash mit Nummern 901–910, wiederholbare Motive laut Tabelle, F903/F905 vergeben mit Feld `status = claimed`, alle
  übrigen `status = available`), §12.2 (TO1 künftig, TO2 laufend, TO3 abgelaufen) und §12.3 (Galerie; G1/G2 echte
  Kundenfotos mit `consentGiven = false`, G3–G6 Platzhalter); Mengen laut SEED-SPEC §0.1. In der
  Allowlist der Verbotsmuster-Prüfung genau einen Eintrag für den fremden Figurennamen in `tattoo.json` mit Begründung
  „Tattoo-Portfolio, keine Verkaufsware (E-18)“.
  - Akzeptanz:
    - AK-SEED-10 / AK-9-03: bei kanonischem `N` sind TO1 und TO2 auf R11, R13 und der Startseite sichtbar, TO3 nicht.
    - AK-SEED-11 / AK-9-04 / AK-1-03: `SEED_PREVIEW_MODE=false` → G1/G2 fehlen in der öffentlichen API, ihre
      Bild-URLs liefern 404; `SEED_PREVIEW_MODE=true` + `APP_ENV=preview` → sichtbar; `APP_ENV=production` +
      `SEED_PREVIEW_MODE=true` → 404; G3–G6 immer sichtbar.
    - AK-9-02: Mail-Knopf F-907 hat exakt den Betreff `Flash-Anfrage F-907 – Winziger Planet` (DE) bzw.
      `Flash request F-907 – Tiny planet` (EN).
    - F-901 zeigt `ig:DbJ1QRrjCcb`; keine Tattoo-Route enthält „In den Korb“, ein Formular oder einen Stripe-Request
      (AK-9-01).
  - Tests: `tests/int/seed/tattoo.int.spec.ts` (Sichtbarkeit mit vorgestellter Uhr, Einwilligungsregel);
    Ergänzung der P7-E2E-Suite um Betreff und Sichtbarkeit mit Seed-Daten.
  - Ohne Jutta: G1/G2 erscheinen nur im Vorschau-Modus. P11-Nacharbeit: Einwilligungen (A13) – ohne sie werden G1/G2
    beim Entfernen der Beispieldaten gelöscht.

- [ ] **P8.7 Seiten und FAQ** – `content/seed/data/pages.json` für alle `PAGE_KEYS` nach SEED-SPEC §13
  (Startseite `hero` + 7 `station`-Blöcke mit `stationId`, `cocoPose`, `ornament`, Links; `about`, `contact`,
  `commissions`, `tattoo`, `tattoo_aftercare`, `shop`, `archive`, `conformity`, `withdrawal`, `order_status`, `thanks`,
  `not_found`) und `faqs.json` nach §14. Klartext → Lexical über `toLexical()` (Absätze, `- `-Listen, `**fett**`,
  `[Text](url)`; SEED-SPEC §2.4), Token `{{date:<expr>}}`. Stationsbilder bleiben leer (Code-Assets, P8.14).
  - Akzeptanz:
    - AK-SEED-18: Startseite liefert `hero` + genau 7 Stationen `hallo`, `keramik`, `textil`, `zeichnungen`,
      `schmuck`, `tattoo`, `jutta-und-coco` in dieser Reihenfolge.
    - AK-SEED-17: Speichern von FAQ05 in der Verwaltung setzt `seed = false`; ein weiterer `pnpm seed` legt FAQ05
      weder neu an noch ändert es.
    - Feldgrenzen eingehalten (Station-Text ≤ 400, Hero-Untertitel ≤ 300, `seo.metaTitle` ≤ 60);
      `home.seo.metaTitle` wie §13.7.
    - Seite `about` enthält kein Bild mit `showsPerson = jutta`, keinen Band-Namen, keine Liedzeile (V-28).
    - Jede Seite ist unter ihrer Route DE und EN erreichbar; `/en/…` zeigt die EN-Texte.
  - Tests: `tests/unit/seed/lexical.unit.spec.ts` (`toLexical`, Datums-Token DE `dd.MM.yyyy` / EN `d MMM yyyy`);
    `tests/int/seed/pages-faqs.int.spec.ts` (Mengen, AK-SEED-17, AK-SEED-18).
  - Ohne Jutta: Texte sind Entwürfe (E-62), Jutta übernimmt sie durch Bearbeiten. P11-Nacharbeit: Texte in der
    Produktion gegenlesen (P11.10).

- [ ] **P8.8 Protokolle: Mail-, Einwilligungs- und Audit-Log** – `content/seed/data/logs.json` mit den
  Ableitungsregeln aus SEED-SPEC §16: `email-log`-Einträge aus den Zeitleisten (§16.1: `status = sent`,
  `transport = file`, `attempts = 1`, `messageId` nach §2.5, `bodySha256`, Betreff aus `site-texts.emails` mit Nummer,
  Admin-Mails an `ADMIN_NOTIFY_EMAIL` in `de`), `consent-log`-Einträge (§16.2: `textSnapshot` = gerenderter
  RECHT-Baustein in der Sprache der Bestellung/Anfrage, `textSha256`) und `audit-log`-Einträge (§16.3); Mengen je
  Protokoll laut SEED-SPEC §0.1.
  `withdrawals.confirmationEmail` zeigt auf den `withdrawal_receipt`-Eintrag. Vorlagen-Schlüssel nur aus
  `EMAIL_TEMPLATES` (DATENMODELL §4; z. B. Anfechtung → `admin_dispute_opened`, Erstattung → `refund_confirmation`).
  Seed-Kassen ohne Bestellung erzeugen keine Mail. Der Seed versendet nichts.
  - Akzeptanz:
    - Anzahl je Bezug exakt wie die Ergebniszeile in SEED-SPEC §16.1; Summe = `SEED_EXPECTED_COUNTS['email-log']`;
      `consent-log` und `audit-log` = `SEED_EXPECTED_COUNTS`; jeder `template`-Wert ist in `EMAIL_TEMPLATES`
      enthalten; `bodySha256` wird wie im Echtbetrieb über den Mailtext mit festem Platzhalter statt Status-Token
      gebildet (DATENMODELL §6.22).
    - AK-SEED-05: während des Seeds 0 Dateien im `EMAIL_FILE_DIR`, 0 Jobs in der Queue, 0 Aufrufe an Zahlungs- und
      Übersetzungs-Adapter (Spies).
    - `consent-log`-Snapshots stammen aus `checkout.dhlEmailConsent`, `checkout.deviationAgreement` (mit Titel,
      Nr. 914, Abweichungstext) und `inquiry.privacyNotice` – kein erfundener Rechtstext.
  - Tests: `tests/int/seed/logs.int.spec.ts`.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P8.9 Lebenszyklus: Idempotenz, Produktionssperre, Entfernen, Reset (AK-SEED-Gesamtsuite)** –
  Import-Reihenfolge SEED-SPEC §1.7 (eine Transaktion je Schritt) und Idempotenzregeln §1.3 vollständig;
  `settings.seed.exampleDataPresent`/`importedAt` setzen, Audit `seed_imported`. `pnpm seed:remove --yes
  [--drop-texts]` nach SEED-SPEC §18 und DATENMODELL §13.5 (Reihenfolge, `BSP-*`-Zählerzeilen löschen, `keepTexts`
  übernimmt Seiten/FAQ samt referenzierter Medien, G1/G2 immer löschen, Verweise echter Dokumente auf Seed-Dokumente
  entfernen und im Bericht auflisten; Seed-`checkouts`, `complaints` und `privacy-requests` gehören dazu). Sperren nach SEED-SPEC §1.5 und ARCHITEKTUR §4.8:
  Abbruch mit Exit 1 **vor** dem ersten Schreiben bei `APP_ENV=production`, einer Bestellung mit
  `stripe.livemode = true` oder einer als Produktion markierten Datenbank (`planetclaire:production`); als
  Umgebungsangabe zählt nur `APP_ENV` (ARCHITEKTUR §5.2).
  - Akzeptanz:
    - AK-SEED-01, -02, -03 (Mengen = `SEED_EXPECTED_COUNTS`), -04, -14, -15, -16; KONZEPT AK-11-01, AK-11-02,
      AK-11-04; ARCHITEKTUR AK-A-4-01.
    - `pnpm seed:remove` ohne `--yes` schreibt nichts und zeigt die Mengen je Collection.
    - Nach `seed:remove --yes`: 0 Dokumente mit `seed = true`, keine `BSP-*`-Zähler; Grund-Seed und echte Sequenzen
      (`PC`, `WR`, `AA`, `RE`, `GS`) unverändert; Seiten/FAQ übernommen. Mit `--drop-texts` gelöscht.
  - Tests: `tests/int/seed/lifecycle.int.spec.ts` (Gegenprobe mit echtem Stück Nr. 17 und echtem Umsatz
    `2026-09/tattoo`); `tests/unit/seed/guard.unit.spec.ts` (jede Sperrbedingung einzeln);
    `tests/unit/seed/time.unit.spec.ts` (Tabelle §2.2, AK-SEED-16) bleibt grün.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P8.10 Import-Skript für Juttas Instagram-Datenexport** – `scripts/seed/import-instagram.ts` als
  `pnpm seed:import-instagram` (wiederholbar, deterministisch). Sucht in `content/seed/instagram-export/` rekursiv
  alle Formen aus ANLEITUNGEN Anhang: ZIP-Dateien (werden nach `.data/instagram-export/` entpackt, gitignored),
  Monatsordner `<JJJJMM>/…` direkt im Ordner (Beiträge und Stories gleichnamiger Monate zusammengelaufen), JSON-Ordner,
  ältere Uploads mit beliebigen Unterpfaden, Mischformen. Ignoriert `LIESMICH.txt`, `.mp4` und fehlende Dateien; ordnet
  Medien nur über den **Dateinamen** zu (JSON-`uri` → Basename), nie über einen festen Pfad; ob ein Bild Beitrag oder
  Story ist, bestimmt die `uri` im JSON (fehlt JSON: Art offen lassen). Datum aus JSON, sonst aus dem Monatsordner.
  Zuordnung zu den Beiträgen aus
  `content/seed/instagram/manifest.json` (nur `kind` `post`/`reel-cover`): Kandidaten ±1 Tag um das Manifest-Datum,
  dann Wahrnehmungs-Hash (dHash 64 Bit) gegen das 640-px-Bild – Treffer bei Hamming-Abstand ≤ 10 und
  Seitenverhältnis ±1 %. Ergebnis `content/seed/instagram-export-map.json` (committet, klein: Kürzel → relativer Pfad,
  `sha256`, Breite, Höhe, Abstand, `override` für manuelle Korrektur). Der Medien-Schritt aus P8.2 nimmt für gemappte
  Kürzel die volle Auflösung mit **denselben Prozent-Ausschnitten** und denselben `seedKey`s (`source =
  instagram_export`), sonst weiter das 640-px-Bild; `pnpm seed:example --refresh-media` lädt neu hoch. Highlights,
  `profil.jpg` und Beiträge außerhalb des Manifests werden nie importiert; Kundenfotos bleiben `restricted` mit
  `consentGiven = false` (E-42). Abgeleitete Großdateien werden nie committet.
  - Akzeptanz:
    - Ohne Export: Exit 0 mit „Kein Instagram-Export gefunden – die Beispielbilder (640 px) bleiben.“; Map unverändert.
    - Mit Export: Bericht „gemappt / nicht gefunden / mehrdeutig“ je Kürzel; zweiter Lauf ändert nichts;
      `override` hat Vorrang.
    - Nach `seed:example --refresh-media` haben gemappte Medien `source = instagram_export`, eine Originalbreite
      > 640 px und dieselben Ausschnitte in Prozent; AK-SEED-19 wird mit den aus den Prozenten berechneten Pixeln der
      tatsächlich verwendeten Quelle geprüft; `media`-Anzahl unverändert.
    - Kein Inhalt aus `content/seed/instagram-export/` landet unter `public/`, in `.next/static` oder ungeschnitten
      in `media` (`DdHXUQsDjqm` nur `#cap`).
  - Tests: `tests/unit/seed/import-instagram.unit.spec.ts` mit kleiner Fixture `tests/fixtures/instagram-export/`
    (hochskalierte Kopien zweier Seed-Bilder + ein fremdes Bild, `posts_1.json`, eine ZIP-Variante, ein Monatsordner
    direkt im Wurzelordner mit Beitrags- und Story-Bild, eine `.mp4`-Attrappe, `LIESMICH.txt`): richtige Zuordnung
    unabhängig vom Ordner, Story über die JSON-`uri` erkannt, fremdes Bild nicht gemappt, ZIP entpackt, Video
    ignoriert, zweiter Lauf ohne Änderung; `tests/int/seed/import-instagram.int.spec.ts` (Refresh ersetzt die Datei, `seedKey`
    und Anzahl gleich).
  - Ohne Jutta: Skript läuft ohne Export durch; OFFENE-PUNKTE-Zeile „Instagram-Bilder nur 640 px“ bleibt „wartet auf
    Jutta“ mit dem Befehl `pnpm seed:import-instagram && pnpm seed:example --refresh-media`. P11-Nacharbeit: falls der
    Export (A04/A06) später kommt, Skript laufen lassen, danach `pnpm art:vectorize` erneut.

- [ ] **P8.11 Import-Skript für Coco-Fotos (Zeichenvorlagen)** – `scripts/art/coco-refs.ts` als `pnpm art:coco-refs`:
  liest `content/seed/coco/` (JPG, PNG, HEIC; `.mp4` wird nur gelistet), normalisiert mit sharp (Orientierung, sRGB,
  **alle Metadaten entfernen**, längste Kante ≤ 1600 px) nach `.data/art-refs/coco/` (gitignored) und schreibt
  `content/art/coco-refs.json` (committet: Quelldatei, `sha256`, Maße, Pose aus dem Dateinamen `coco-<pose>-<n>` mit
  den Posen aus DESIGN §10.3 oder `unbekannt`, Herkunft). Die 10 Highlight-Referenzen aus dem Manifest
  (`use: coco-reference`, DESIGN §10.1) stehen immer mit drin. HEIC, das sharp nicht dekodieren kann, wird übersprungen
  und gemeldet.
  - Akzeptanz:
    - Ohne Coco-Ordner: Exit 0; `coco-refs.json` enthält nur die Highlights mit Hinweis „keine eigenen Fotos“.
    - Ausgabebilder enthalten keine EXIF/GPS-Daten (Fotos könnten Juttas Wohnort verraten).
    - Kein Bild aus `content/seed/coco/` oder `.data/art-refs/` erscheint in `media`, `public/`, `.next/static` oder
      der Vorschau-Datei (Hash-Vergleich) – die Fotos werden nie veröffentlicht (ANLEITUNGEN C1).
    - Zweiter Lauf erzeugt eine byte-gleiche `coco-refs.json`.
  - Tests: `tests/unit/art/coco-refs.unit.spec.ts` (GPS-Fixture aus `tests/fixtures/images/`, Posen-Erkennung am
    Namen, HEIC-Rückfall, Idempotenz).
  - Ohne Jutta: nur Highlights (150 px); OFFENE-PUNKTE-Zeile „Coco-Fotos fehlen – Coco nach Highlight-Bildchen
    gezeichnet“. P11-Nacharbeit: kommen Fotos (A05), `pnpm art:coco-refs` und Coco in einer Nach-Session mit dem
    P9-Verfahren nachschärfen.

- [ ] **P8.12 Platzhalter-Zeichnungen I: Werkzeug und Stück-Platzhalter** – Hilfsbibliothek
  `scripts/art/lib/handline.ts` (gesäter Wackel auf Pfaden, offene Enden, 1–2 Doppelkonturen, Schatten aus 5–7
  Schraffurstrichen unter 40°, eine um 3–4 Einheiten versetzte Wash-Fläche) und Generator
  `scripts/art/placeholders.ts` als `pnpm art:placeholders`, der aus Motiv-Skizzen
  `content/art/placeholders/{typ}-{n}.ts` (gezeichnete Bezier-Kontrollpunkte, keine Formen-Primitive) die Dateien
  `src/art/placeholders/{typ}-{n}.svg` erzeugt. Motive exakt nach den Motiv-Briefen SEED-SPEC §4.2 und DESIGN §12.3
  für `teller-01/02`, `fliese-01`, `shirt-01/02/03`, `kleid-01/02`, `cap-01/02`, `zeichnung-01/02/03`,
  `anhaenger-01/02/03`, `spiegel-01`. Danach `pnpm seed:example --refresh-media` (ersetzt die `fallbackArt`-Bilder).
  - Akzeptanz:
    - Jede Datei: `viewBox="0 0 400 500"`, Strich 2.4 in `--ink` mit runden Enden, genau eine Wash-Farbe aus DESIGN
      §3.1, Motiv 55–70 % der Bildhöhe (Tinten-Bounding-Box nach Rasterung), ±3° schief, kein `<text>`, ≤ 6 KB
      (KUNST-QA AR-03, AR-04).
    - Keine fremden Figuren, kein Text im Bild; Coco-Motive (`shirt-02`, `cap-01`, `zeichnung-01`, `anhaenger-01`)
      folgen DESIGN §10.1 (große Ohren, dunkle Augen, rotes Geschirr; die Erkennbarkeit bewertet die Prüf-Linse unten).
    - Generator deterministisch (zweimal ausführen → byte-gleiche SVGs).
    - Geschmacks-Urteil durch eine **frische Prüf-Linse**: ein neu gestarteter Subagent, der nur den Kontaktbogen
      `artifacts/placeholders-sheet.webp` (nicht committen), die Referenzen `post-DdUPhoZOoMW.jpg` und
      `post-DaJH_kADpsK.jpg`, die Motiv-Briefe (SEED-SPEC §4.2, DESIGN §12.3) und die Rubrik KUNST-QA §6.5 sieht – keinen
      Quellcode, keine Begründung der Umsetzer:in. Er beantwortet je Motiv „Zeichnung lesbar, Motiv erkennbar?“ und bei
      den Coco-Motiven „Coco erkennbar?“ mit ja/nein und Beleg und vergibt die Stilnote AR-05 (Antwortformat sinngemäß
      KUNST-QA §6.3). Alle Fragen „ja“; Urteil und Note in FORTSCHRITT (Ziel AR-05 ≥ 4 erst in P9.13). Ohne
      Subagenten-Werkzeug gilt KUNST-QA §6.1 Nr. 5. Dieselbe Prüf-Linse nutzen P9.8, P9.9, P9.12 und P9.13.
  - Tests: `tests/unit/art/placeholders.unit.spec.ts` (Regeln oben für alle Dateien unter `src/art/placeholders/`,
    gilt auch für P8.13).
  - Ohne Jutta: vollständig machbar; Feinschliff in P9 (Rubrik ≥ 4). P11-Nacharbeit: –

- [ ] **P8.13 Platzhalter-Zeichnungen II: Flash- und Tattoo-Platzhalter** – Mit dem Werkzeug aus P8.12
  `flash-902` … `flash-910` (ohne Wash, Grund `--paper-2`, Stencil-Anmutung, klare Kontur) und `tattoo-01` …
  `tattoo-04` (Körperumriss Knöchel, Handgelenk, Oberarm, Schienbein mit dem verknüpften Flash-Motiv, Wash
  `--wash-clay`, „frisch“ mit etwas kräftigerer Linie) nach SEED-SPEC §4.2; `pnpm seed:example --refresh-media`.
  - Akzeptanz:
    - Regeln aus P8.12 grün für alle Flash- und Tattoo-Platzhalter (Flash: 0 Wash-Flächen).
    - Flash-Motive passen zu den Titeln §12.1; Tattoo-Platzhalter zeigen das Motiv ihres Flash (G3 → F902,
      G4 → F907, G5 → F906, G6 → F910).
    - Flash-Raster (R12) und Galerie (R15) zeigen kein `fallbackArt`-Bild mehr.
  - Tests: Erweiterung `tests/unit/art/placeholders.unit.spec.ts`; `tests/int/seed/media.int.spec.ts` prüft, dass
    kein Platzhalter mehr aus `fallbackArt` stammt.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P8.14 Stationszeichnungen v1 aus Juttas Bildern** – `content/art/sources.json` (Schema DESIGN §12.4: `id`,
  `file`, `crop`, `channel`, `threshold`, `upscale`, `turdSize`, `alphaMax`, `optTolerance`) und
  `scripts/art/vectorize.ts` als `pnpm art:vectorize` (sharp-Vorverarbeitung → `potrace` **nur** als devDependency →
  SVGO, Füllung `currentColor`) für `keramik` (`post-DdUPhoZOoMW.jpg`, nur schwarze Linien), `textil`
  (`post-DcT7ErBDsWi.jpg`, Kanal `min`), `zeichnungen` (`post-DaJH_kADpsK.jpg`) und `tattoo` (`post-DbJ1QRrjCcb.jpg`);
  `schmuck` als Linienzeichnung im Platzhalter-Stil (nicht vektorisieren); `planet-claire`, `hallo`,
  `jutta-und-coco` aus Planet-Marke und Coco-Sprite. Ausgabe `src/art/stations/{stationId}.svg`, eingebunden in die
  Station-Komponente (KO-21) anstelle der P2-Platzhalter. Ist eine Quelle im Export gemappt (P8.10), wird sie genutzt.
  - Akzeptanz:
    - Deterministisch (zwei Läufe byte-gleich); jede Station ≤ 8 KB, alle SVG der Startseite zusammen ≤ 60 KB roh
      (DESIGN §9.10).
    - AR-01: Quellen nur aus der Zuordnung DESIGN §12.4 – keine Kundenhaut-Fotos, keine fremde Figur, keine Bilder mit
      Jutta.
    - `potrace` kommt in keinem Client-Chunk vor (`.next/static` enthält den String nicht; `pnpm check:bundle` grün).
    - Stationszeichnungen sind `aria-hidden` und über `currentColor` tuscheschwarz (E-73).
  - Tests: `tests/unit/art/stations.unit.spec.ts` (Größe, Quellen-Whitelist, Determinismus mit Mini-Quelle);
    E2E-Smoke: Startseite zeigt 7 Stationszeichnungen ohne Konsolenfehler.
  - Ohne Jutta: aus 640-px-Quellen (DA-8). P11-Nacharbeit: nach dem Instagram-Export `pnpm art:vectorize`
    erneut.

- [ ] **P8.15 Texte gegenlesen und vervollständigen (DE/EN, Juttas Ton)** – Alle Seed-Texte gegen SEED-SPEC prüfen
  (Stücke §5.4, Kategorien §3.3, Seiten §13, FAQ §14, Tattoo §12, Alt-Texte §4) und alle übrigen Texte fertig
  formulieren: Voreinstellungen von `site-texts` im Code (DATENMODELL §7.2: `navigation`, `footer`, `shop`, `product`,
  `cart`, `checkout`, `thanks`, `orderStatus`, `withdrawal`, `notFound`, `errors`, `emails` mit `subject`/`intro`/
  `outro`), `src/i18n/messages/{de,en}.json`, Einleitung „Versand & Zahlung“ (R25), Menü-Tagline, endgültige Texte der
  leeren Zustände (KO-17). Ton (E-62, SEED-SPEC §5.4): du-Form, locker, kurze Sätze, Tiere mit Kulleraugen; keine Heil-,
  Umwelt- oder Qualitätsversprechen, keine „Garantie“, keine fremden Figuren/Marken, keine Liedzeilen, keine
  Barrierefreiheits-Behauptungen. Rechtstexte und `legalSnippets` werden **nicht** selbst formuliert (R-002).
  - Akzeptanz:
    - EK-09: i18n-Schlüssel-Parität DE/EN ohne leere Werte (T-06), Routen-Parität (AK-2-01), kein „lorem“ in `src/**`
      und `content/**`.
    - Verbotsmuster grün: `tests/unit/legal/forbidden.unit.spec.ts` über `src/**` und `content/**` (Allowlist nur der
      Figurenname aus P8.6) und `tests/e2e/legal/forbidden.e2e.spec.ts` über alle gerenderten Seitentypen und
      Mail-Vorlagen (V-01…V-31).
    - RECHT §7 Teil A, Punkt „Alle FAQ-/Tattoo-/Über-mich-Entwürfe gegen §5 geprüft“ mit Datum in FORTSCHRITT; Treffer
      zu V-18, V-26, V-28 manuell gesichtet.
    - Die fachlichen Annahmen (SE-06 Material und Maße, SE-07 Aftercare-Methode und FAQ-Aussagen) stehen als
      Prüfliste für Jutta in OFFENE-PUNKTE.
  - Tests: bestehende Paritäts- und Verbotsmuster-Tests; neu `tests/unit/i18n/site-texts-defaults.unit.spec.ts`
    (jedes `site-texts`-Feld hat einen DE- und einen EN-Standardwert).
  - Ohne Jutta: Entwürfe; Jutta korrigiert im Admin. P11-Nacharbeit: Texte in der Produktion gegenlesen (P11.10).

- [ ] **P8.16 Leere Zustände, 404 und 500 fertigstellen** – `EmptyState` (KO-17) an jeder Liste: Korb, Shop,
  Kategorie, Archiv, Startseiten-Station ohne Stücke (Stationszeichnung + Satz + Archiv-Link, KONZEPT §3.1), Flash,
  Angebote, Galerie, FAQ-Block ohne Einträge, Konformitätserklärungen (Text aus KONZEPT §3.14); Posen laut DESIGN
  §10.6. 404 (R28) mit fester H1 „Coco hat sich losgerissen“ / “Coco slipped her leash”, Satz, Links Start/Shop/Tattoo
  und Nummernfeld → `/nr/[nummer]`; Variante „Dieses Stück hat schon ein Zuhause gefunden“ (S08); 500 (R29) „Hoppla –
  die Leine hat sich verheddert“ mit „Nochmal versuchen“ (DESIGN KO-18). Der Richtext der Seite `not_found`
  (SEED-SPEC §13.7) erscheint als Zusatztext unter der festen H1. DM-PAGE-01: fehlt die Seite zu einem `key`, rendert
  das Frontend einen neutralen Leerzustand statt 500.
  - Akzeptanz:
    - Nach `pnpm seed:remove --yes --drop-texts` liefert jede öffentliche Registry-Route DE/EN 200 (R28: 404), nie
      500; jede Liste zeigt ihren Leerzustand mit Weiter-Link; „Vertrag widerrufen“ ist überall sichtbar (AK-3-11).
    - `/de/shop/908-…` → 404-Variante „schon ein Zuhause“ mit Links zu Shop und Archiv, `noindex` (KONZEPT §2.3).
    - axe ohne `serious`/`critical` auf 404, 500 und allen Leerzuständen; mit reduzierter Bewegung statisch.
  - Tests: `tests/e2e/empty-states.e2e.spec.ts` (eigene DB-Vorbereitung mit `seed:remove --yes --drop-texts`, danach
    `seed:reset`); Visual-Referenzen (nur Linux, erzeugt in CI per `[ci:update-snapshots]`, mit `gh run download`
    übernommen) für 404, 404-Variante, 500 und „Shop leer“.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P8.17 Startseite mit vollständigem Beispielbestand (R01)** – Die Startseite liest Überschriften, Texte,
  `cocoPose`, `ornament` und Links aus `pages.home` (Stationen mit `data-leash-station`-Ankern), zeigt je
  Kategorie-Station bis zu 4 Stücke `available`/`reserved` (neueste zuerst; Textil-Station inkl. Caps), in der
  Tattoo-Station bis zu 3 verfügbare Flash-Motive und das laufende oder nächste Angebot als Datums-Badge, in „Jutta &
  Coco“ die Links zu R19, R10 und Instagram (KONZEPT §3.1, DESIGN KO-21). Preisfußnote einmal je Seite; JSON-LD
  `Organization` ohne Adresse.
  - Akzeptanz:
    - AK-3-01 und AK-SEED-18 (Reihenfolge); AK-3-02 (≤ 4 Stücke je Station, nie `sold`/`draft`/`archived`); Stücke je
      Station entsprechen SEED-SPEC §5.1 (z. B. Keramik S01, S04, S05, S07).
    - TO2 („läuft gerade“) als Badge sichtbar, TO3 nicht.
    - EK-01 unverändert grün (Lighthouse-CI R01), CLS ≤ 0,1.
  - Tests: `tests/e2e/home.e2e.spec.ts` (Stationen, Stücke, Badge, Links DE/EN).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P8.18 Über mich & Coco (R19) mit Preset `about`** – Route `/de/ueber-mich` · `/en/about` aus `pages.about`
  (Blöcke nach SEED-SPEC §13.2; KONZEPT §3.12): H1 „Jutta & Coco“, Text über Jutta, Coco-Abschnitt mit Coco-Zeichnung,
  „Was ich mache“ (Shop, Tattoo, Auftragsarbeiten), Instagram-Link mit `rel="noopener noreferrer"` (R-139). Fotos mit
  `showsPerson = jutta` nur mit Freigabe (P8.20). Tuschelinie Preset `about` (DESIGN §9.7: 3 Stationen Jutta/Coco/
  Werkstatt, Schlaufen `right`/`left`, Coco läuft ein kurzes Stück mit). Registry-Status „gebaut“, Sitemap,
  canonical/hreflang, OG-Bild.
  - Akzeptanz:
    - Route DE/EN 200, in `sitemap.xml`, canonical + drei hreflang-Links (AK-2-05).
    - Keine Abbildung von Jutta ohne Freigabe; Linie und Coco überdecken keinen Text (DESIGN §9.9).
    - `reducedMotion: 'reduce'` → Linie sofort vollständig und statisch (AK-DS-14 für R19); axe ohne
      `serious`/`critical`.
  - Tests: `tests/e2e/about.e2e.spec.ts`; Unit-Test der Preset-Daten `about` in der Engine-Suite.
  - Ohne Jutta: ohne Fotos von Jutta. P11-Nacharbeit: Jutta kann ein eigenes Foto hochladen und freigeben.

- [ ] **P8.19 Verwaltung „Beispieldaten“: zählen, entfernen, übernehmen** – Einstellungen → Beispieldaten
  (handytauglich, KONZEPT §7.14, §11.3; ersetzt den Hinweis „kommt in P8“ aus P5.22): Anzahl `seed = true` je
  Collection über `GET /api/admin/seed/summary`; Knopf „Beispieldaten entfernen“ mit Dialog (Mengen, Checkbox „Seitentexte und FAQ behalten“ vorausgewählt, Bestätigung durch
  Eintippen von `ENTFERNEN`) → `POST /api/admin/seed/remove` (`{ keepTexts }`, dieselbe Logik wie `seed:remove`,
  Payload-Custom-Endpoint mit Admin-Sitzung, ARCHITEKTUR §2.4). Sperre mit dem Text „Bitte zuerst die Texte der Kanzlei
  einsetzen – sonst wären die Rechtsseiten leer.“, solange ein aktiver Rechtstext ein Platzhalter ist
  (`origin = placeholder`, damit `isPlaceholder = true`; R-002). Aktion „Übernehmen“ für `products`, `flash`, `tattoo-gallery`, `media` (`…/:id/adopt`,
  Audit `product_adopted`, referenzierte Medien werden mit übernommen; DATENMODELL §13.4). Danach Revalidierung aller
  öffentlichen Seiten, Audit `seed_removed` mit Mengen, `settings.seed.exampleDataPresent = false`; der Hinweis
  „Beispieldaten vorhanden“ unter „Heute“ verschwindet.
  - Akzeptanz:
    - AK-11-03 und R-180: danach 0 Dokumente mit `seed = true`; echte Dokumente und echte Zähler unverändert; zweimal
      ausführbar.
    - Ohne Admin-Sitzung → 401/403; falsches Bestätigungswort → keine Wirkung.
    - Sperre greift mit Platzhalter-Rechtstexten und löst sich, sobald alle sechs Typen eine aktive
      Nicht-Platzhalter-Version haben (Test-Fixture).
    - Bedienbar bei 390×844 ohne horizontales Scrollen; axe ohne `serious`/`critical` (AK-7-04).
  - Tests: `tests/int/seed/admin-remove.int.spec.ts` (Endpunkte, Sperre, Übernahme);
    `tests/e2e/admin-seed.e2e.spec.ts` (Handy-Ablauf mit Fixture-Rechtstexten, eigene Test-DB).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: Jutta entfernt die Beispieldaten nach dem Einspielen der
    Kanzleitexte (P11.13).

- [ ] **P8.19a Verwaltung „Texte“: Seiten und FAQ** – Bereich „Seiten und FAQ“ der Ansicht `/texte` (KONZEPT §7.13;
  ersetzt den Hinweis „kommt in P8“ aus P5.27): Liste aller `PAGE_KEYS` mit einem Handy-Formular je Seite (Titel, Texte
  und Blöcke – bei `home` Hero und Stationstexte –, SEO-Felder; Feldgrenzen wie P8.7), DE und EN je Feld, Knopf
  „Übersetzen“ über `TranslateButton` (P5; Mock `"[EN] " + Text`). FAQ als sortierbare Liste (Frage/Antwort DE/EN,
  Reihenfolge per Auf-/Ab-Knöpfen, auch per Tastatur bedienbar). Speichern durch Jutta setzt `seed = false`
  (Übernahme, DATENMODELL §13.4) und revalidiert die betroffenen öffentlichen Seiten.
  - Akzeptanz:
    - Jede Seite aus `PAGE_KEYS` ist bei 390×844 in DE und EN bearbeitbar, ohne horizontales Scrollen; der
      Übersetzen-Knopf füllt die EN-Felder.
    - Die FAQ-Reihenfolge lässt sich ändern und erscheint öffentlich genauso.
    - AK-SEED-17: Speichern einer Seed-Seite oder eines Seed-FAQ-Eintrags setzt `seed = false`; ein weiterer
      `pnpm seed` legt ihn weder neu an noch ändert er ihn.
    - Eine gespeicherte Änderung ist öffentlich nach spätestens 60 s sichtbar (KONZEPT §1.6 „Aktualität“).
    - axe ohne `serious`/`critical` auf allen Ansichten dieses Bereichs.
    - Keine Verwaltungsansicht zeigt mehr „kommt in P…“, außer dem Startklar-Hinweis „kommt in P10“ (ersetzt P10.14).
  - Tests: `tests/e2e/admin/texts-pages.e2e.spec.ts` (Handy-Ablauf, Übersetzen, Sortieren, Sichtbarkeit ≤ 60 s, axe);
    `tests/int/admin/pages-adopt.int.spec.ts` (AK-SEED-17 für `pages` und `faqs`); Suche nach „kommt in P“ über alle
    Ansichten aus `scripts/preview-export/adminViews.ts`.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: Jutta liest die Texte in der Produktion gegen (P11.10).

- [ ] **P8.20 Vorschau-Modus nie in Produktion, Fotos von Jutta nur mit Freigabe (R-181)** – Prüfen (seit P1
  vorhanden, nicht neu bauen): `assertProductionEnv` (ARCHITEKTUR §4.2/§4.3) bricht den Serverstart mit klarer Meldung
  ab, wenn `SEED_PREVIEW_MODE=true` und `APP_ENV=production`; `seedPreviewModeActive()` liefert in Produktion immer
  `false` (KONZEPT §9.7, DATENMODELL §14). Neu in P8: Medien mit `showsPerson = jutta` sind öffentlich nur mit dem
  Häkchen `ownerApproved` (DATENMODELL §6.2; einziges neues Feld dieser Phase, Migration `p8_media_owner_approved`
  laut DATENMODELL §10.1; Admin-Hinweis „Nur ankreuzen, wenn Jutta dieses Foto freigegeben hat“);
  `isPubliclyVisible()`, der Lese-Zugriff (DATENMODELL §6.2) und die Bildroute berücksichtigen das. Startklar-Punkt
  dafür vormerken (Umsetzung P10.14).
  - Akzeptanz:
    - R-181: Startprüfung wirft in der Produktionskonstellation; in `development`/`test`/`preview` nicht.
    - DM-MEDIA-06: Bild mit `showsPerson = jutta` ohne `ownerApproved` → Bildroute 404 für Anonyme, 200 für die
      angemeldete Verwaltung; mit Häkchen → 200.
    - AK-1-03 und AK-9-04 bleiben grün.
  - Tests: `tests/unit/env/seed-preview.unit.spec.ts`; `tests/int/media/owner-approved.int.spec.ts`.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P8.21 Vorschau-Anker und Vorschau-Datei mit vollem Bestand** – Crawler und Verwaltungs-Bildschirmfotos des
  Vorschau-Exports (ARCHITEKTUR §14.4, §14.7) nutzen die Anker aus SEED-SPEC §17: Warenkorb-Beispiel S01 + S11
  (Versand `keramik` 8,90 €, Zwischensumme 109,00 €, Summe 117,90 €, Abweichung von S11 muss bestätigt werden),
  Danke-Seiten O14 (`en`) und O13 (Vorkasse mit Beispiel-IBAN `DE36 0000 0000 0000 0000 00` und Frist), Statusseiten
  O10/O13/O01 und O03, Produktseiten S01, S11, S14, S19, S26, S29 (EN-Rückfall), S30, S08 als 404-Variante,
  Verwaltung „Heute“ mit den Zahlen aus §17. G1/G2 tragen in der Datei das Etikett „intern – Einwilligung fehlt“
  (R-182). Außerdem laufen alle Kriterien aus P1–P7 mit dem Vermerk „mit dem echten Anker prüft P8.21“ jetzt gegen den
  Beispielbestand statt gegen die gleichartigen Test-Fixtures (Nummern 980–999). Ausdrücklich geprüft werden die Anker
  aus P3–P7:
  - Archiv und Sitemap (P3.6, P3.7, P3.13): S19 steht im Archiv, S08 nicht; `sitemap.xml` enthält S19, nicht S08;
    `/de/shop/908-…` liefert die 404-Variante „schon ein Zuhause“.
  - Bestellstatus (P4.23): O03 (`disputed`) zeigt der Kund:in den Status `delivered` aus `statusBeforeDispute`; O01,
    O10 und O13 öffnen mit `seedToken('orders:<Key>', 'status')`.
  - Verwaltung (P5.10, P5.15, P5.17, P5.18, P5.19): „Zu packen“ zeigt O14 (`paid`) und O12 (`packed`), „Vorkasse offen“
    O13, „Abholung“ O09, „Widerrufe“ W3–W5 als offen (W4 „nicht zugeordnet“, W5 mit Frist `D+13`), W6/W7 als
    abgeschlossen.
  - Tattoo (P7.2): F-901 mit Anfrage-Knopf, F-903 und F-905 (`claimed`) ohne Anfrage-Knöpfe hinter den verfügbaren.
  - Auftragsarbeiten (P7.10): Seite `commissions` DE/EN mit dem Seed-Text aus SEED-SPEC §13.4, eine `h1`.
  - Akzeptanz:
    - `pnpm preview:export && pnpm test:preview-export` grün; Bericht listet R19 und alle Tattoo-Routen als `ok`.
    - Die genannten Beträge und Hinweise stehen im erfassten HTML; keine anderen Personendaten als die Seed-Namen.
    - Jeder Anker aus der Liste oben ist durch einen Test gegen den Beispielbestand belegt (Testname nennt Anker und
      Aufgabe, z. B. „P8.21 S19 Archiv …“).
    - Jedes Kriterium mit dem Vermerk „mit dem echten Anker prüft P8.21“ (Suche in `PLAN.md`) ist durch einen Test mit
      dem Seed-Anker belegt; die Liste (Kriterium → Testname) steht in FORTSCHRITT.
    - Dateigröße ≤ 40 MB (harte Grenze), Ziel ≤ 20 MB; Wert im Bericht, über 20 MB mit Warnung.
  - Tests: Erweiterung `tests/e2e/preview-export.e2e.spec.ts` (Anker-Strings, Etikett G1/G2, Verwaltungsfoto „Heute“);
    `tests/e2e/seed-anchors.e2e.spec.ts` (Liste oben); die Seed-Anker-Tests zu den Vermerken aus P1–P7 in den jeweiligen
    Suiten.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

### Phasen-Abnahme

- [ ] Alle Aufgaben P8.1–P8.21 (einschließlich P8.4a, P8.5a und P8.19a) abgehakt; `pnpm seed:reset` mit kanonischem
  `SEED_NOW` ergibt exakt die Mengen aus SEED-SPEC §0.1 (`SEED_EXPECTED_COUNTS`);
  AK-SEED-01…22, AK-11-01…04, R-180 und R-181 durch Tests belegt.
- [ ] `pnpm check`, `pnpm test:int`, `pnpm build`, `pnpm test:e2e` und `pnpm preview:export && pnpm test:preview-export`
  lokal grün.
- [ ] R-001: `LEGAL_TRACE_PHASE = 8` in `tests/unit/legal/traceability.unit.spec.ts`, Test grün.
- [ ] Doku geprüft: die Skripte `seed:import-instagram`, `art:coco-refs`, `art:placeholders`, `art:vectorize`
  stehen so in ARCHITEKTUR §6.10 und in `package.json`; `media.ownerApproved` (DATENMODELL §6.2) per Migration
  `p8_media_owner_approved` umgesetzt (einzige geplante Schema-Änderung von P8, DATENMODELL §10.1; musste P8.5a
  `seedField()` an `privacy-requests` nachziehen, kommt dessen Migration dazu); Verdrängungsregel
  `revenue-entries` (DATENMODELL §6.20, seit P1) geprüft; `.env.example` aus `src/lib/env.ts` neu erzeugt; `.gitignore`
  enthält `.data/` und `artifacts/`.
- [ ] `docs/FORTSCHRITT.md`: Eintrag für Jutta (du-Form) – Beispielbestand komplett, wo sie die Texte in der
  Vorschau-Datei lesen kann, dass Instagram-Export und Coco-Fotos jederzeit nachgereicht werden können.
- [ ] `docs/OFFENE-PUNKTE.md` aktualisiert (offene SE-Punkte aus SEED-SPEC §20, Export-/Coco-Status, Annahmen dieser
  Phase).
- [ ] CI grün: Phasenende-Commit `chore(P8): finish phase [ci:full p8]` → `ci.yml`, `ci-full.yml` und
  `preview-export.yml` grün, Vorschau-Artefakt `planet-claire-vorschau-p8-<sha7>` erzeugt. Dieses Häkchen setzt erst
  ein reiner Doku-Commit mit `[skip ci]`, nachdem der Lauf grün ist (ARCHITEKTUR §6.7).
- [ ] PR-Beschreibung (Deutsch) aktualisiert: Aufgaben, AK-Nachweise, Tests, Doku-Änderungen, neue offene Punkte,
  Link zum Vorschau-Artefakt; gemergt oder oben „Bitte mergen – CI ist grün“.

## P9 – Kunst & Bewegung

**Ziel:** Juttas Wunsch nach besonders hochwertigen Bildern und Animationen (E-80) einlösen – mit Extra-Aufwand und
Studio-Abnahme. Coco wird nach den Referenzfotos als eigene Figur mit Charakterblatt gezeichnet (6 Posen × 3
Boil-Frames + 4 Brücken, 22 Symbole), die Tuschelinie lebt (variable Breite, Federansatz und -abheben, Tintenpunkte,
Zittern der Hand, nie perfekte Schlaufen), die Stationszeichnungen sind aus Juttas Zeichnungen vektorisiert, die
Choreografie der Startseite und alle Mikro-Interaktionen entsprechen DESIGN §11 exakt, der Foto-Look wird automatisch
vereinheitlicht. Abgenommen wird genau nach `docs/design/KUNST-QA.md`: Videoaufnahmen und deterministische Frames auf
iPhone 15 (WebKit), Pixel 7 (Chromium, CPU 4×) und Desktop, automatische Prüfung `pnpm art:check`, drei unabhängige
Prüf-Linsen (R1 Stiltreue, R2 Bewegung, R3 Tempo/Barrierefreiheit) als frische Subagenten je Iteration, nachbessern und
wiederholen, bis alle PASS melden oder die Obergrenze aus P9.18a greift – ohne die Tempo-Budgets (LCP ≤ 2,5 s,
CLS ≤ 0,1, TBT ≤ 200 ms) zu reißen.

**Voraussetzungen:** P8 abgeschlossen; gemergt oder im Arbeitsbranch enthalten (vollständiger Beispielbestand,
Platzhalter und Stationszeichnungen v1, `content/art/coco-refs.json`); Engine, Presets, Platzhalter-Sprite mit allen
22 IDs und Mikro-Interaktionen in Grundfassung aus P2–P8. Playwright Chromium **und** WebKit installiert: Die Cloud-Session versucht WebKit immer über
`scripts/cloud-setup.sh` (lokal `pnpm exec playwright install chromium webkit --with-deps`); nur wenn das scheitert,
gilt `PW_SKIP_WEBKIT=1` (Projekt `art-iphone15` dann als markierte Chromium-Emulation, Eintrag in OFFENE-PUNKTE,
KUNST-QA §3.3). Die CI führt WebKit immer aus; deshalb stammt das Bündel der abschließenden Iteration aus
`art-qa.yml`, wenn der Session WebKit fehlt (P9.18a). Subagenten-Werkzeug der Session verfügbar (sonst KUNST-QA §6.1
Nr. 5); Geschmacks-Kriterien außerhalb der Studio-QA-Schleife bewertet die frische Prüf-Linse aus P8.12. Vor Beginn
`git fetch origin && git merge origin/main`; liegen inzwischen Coco-Fotos oder der Instagram-Export im Repo: `pnpm art:coco-refs` bzw. `pnpm seed:import-instagram && pnpm seed:example
--refresh-media`.

**Referenzen:** E-07, E-18, E-42, E-43, E-70…E-80, E-98; R-130, R-131, R-191; KONZEPT §1.4 (EK-01, EK-07, EK-12),
§3.1, §12.7, §12.9; DATENMODELL §6.2 (`enhance`, `derivativesVersion`); ARCHITEKTUR §5.2 (`ART_QA`,
`NEXT_PUBLIC_LEASH_DEBUG`), §6.1, §6.2 (`art-qa.yml`), §6.10, §7.3, §7.7, §7.9 (G4), Anhang C (C-20); DESIGN §2, §3,
§6, §9 (vollständig), §10 (vollständig), §11 (vollständig), §12.2–§12.6, §13, Anhang A (DA-4, DA-5, DA-7, DA-8);
KUNST-QA §0–§10 (vollständig).

### Aufgaben

- [ ] **P9.1 QA-Modus und QA-Seiten** – `ART_QA` in `src/lib/env.ts` aufnehmen (Text laut ARCHITEKTUR §5.2,
  `.env.example` neu erzeugen). QA-Seiten unter `src/app/(frontend)/[locale]/qa/` nach KUNST-QA §3.2: `coco` (alle 22
  Symbole in 24/40/42/64/72/180/240 px mit passendem `data-size`, Boil an/aus, `?parts=1` färbt `data-part`-Gruppen,
  `?frame=a|b|c`), `art` (Stationszeichnungen neben ihrer Quelle im gleichen Maßstab, Platzhalter, Weltraum-Motive,
  Wortmarke, Favicon 16/32/180, OG-Bilder), `motion?mi=MI-xx` (jede Mikro-Interaktion isoliert mit „Abspielen“, gleicher
  Code wie im Produkt), `leash?preset=…&stations=…` (synthetische Langseite) und `error` (löst R29 für SC-10 aus). Ohne
  `ART_QA=1` → `notFound()`; nie in Routen-Registry, Sitemap oder robots. Schalter `?leash=off`, `?freeze=1`,
  `?qa-jank=30` nur mit `ART_QA`. Frame-Logger `window.__qa` (`frames`, `loaf`, `longtasks`, `shifts`, `events`,
  `poseLog`, `marks`, `start()`, `stop()`, `dump()`) nur im Debug-Build (`NEXT_PUBLIC_LEASH_DEBUG=1`); die Engine setzt
  `performance.measure('leash:build')`/`('leash:frame')`. `artifacts/` in `.gitignore`.
  - Akzeptanz:
    - Ohne `ART_QA`: `/de/qa/coco` → 404; mit: 200. QA-Routen erscheinen nicht in `sitemap.xml`, `robots.txt`, im
      Routen-Paritätstest oder im Vorschau-Export.
    - `pnpm check:no-debug` grün: der Produktions-Build ohne Debug enthält weder `__leash` noch `__qa`.
    - `?leash=off` lädt keinen Engine-Chunk (Request-Protokoll); `?freeze=1` setzt alle zeitbasierten Abläufe auf den
      Endzustand.
  - Tests: `tests/e2e/qa-mode.e2e.spec.ts` (mit/ohne Schalter); Unit-Test der Parameter-Auswertung.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P9.2 Aufnahme-Grundgerüst und Kalibrierbogen** – `playwright.art.config.ts` mit Projekten `art-iphone15`
  (WebKit, `devices['iPhone 15']`, Viewport aus dem Deskriptor), `art-pixel7` (Chromium, `devices['Pixel 7']`, CPU 4×
  per CDP nur in Tempo-Läufen), `art-desktop` (1440×900) und den Varianten `motion`/`reduced` (KUNST-QA §4.2). Helfer
  in `tests/art/helpers/` für die deterministische Aufnahme (§4.4: `scrollTo` + 2 rAF bzw. `__leash.setReadingY`,
  WAAPI-Seek über `getAnimations()`, `page.clock.install` vor der Navigation, Boil-Seek auf 0/1/2 Frame-Längen),
  Dateinamen `frames/<SC>/<profil>/<variante>/<nnn>-<label>.webp` (PNG → WebP q 90). Skripte `pnpm art:build`
  (Produktions-Build mit `NEXT_PUBLIC_LEASH_DEBUG=1 ART_QA=1` gegen die Seed-DB) und `pnpm art:record [--scope …]`
  (Lauf-ID `<YYYYMMDD>-iter<NN>-<sha7>`, verweigert bei unsauberem `git status`, Ablage `artifacts/art-qa/<lauf-id>/`,
  Videos `.webm` in Viewport-Größe). Szenarien SC-00, SC-12, SC-13 und SC-16 (Skript ohne Browser). **Vor jeder
  Zeichenarbeit:** Kalibrierbogen des P2-Platzhalter-Sprites (alle Posen, 72 und 180 px) als
  `docs/design/qa-log/img/calibration-p2-placeholder.webp` (≤ 150 KB) committen (KUNST-QA §3.1).
  - Akzeptanz:
    - `pnpm art:record --scope SC-00,SC-12,SC-13` erzeugt Videos und Frames in allen drei Profilen und beiden
      Varianten; zwei Läufe desselben Commits liefern pixelgleiche `reduced`-Standbilder.
    - Der Kalibrierbogen stammt nachweislich vom Sprite `v1` (Commit vor P9.9).
    - Fehlt WebKit: Aufnahme mit Chromium-Emulation, im Bündel-Manifest markiert, OFFENE-PUNKTE-Eintrag.
  - Tests: `tests/art/sc-00.art.spec.ts` läuft in der Sandbox grün; Unit-Test der Dateinamen- und Lauf-ID-Logik.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P9.3 Bewegungs-Szenarien aufnehmen** – Szenarien SC-01 bis SC-11, SC-14, SC-15 und SC-17 exakt nach KUNST-QA
  §4.3 als `tests/art/sc-XX.art.spec.ts`: Startseite (Intro, 600 px/s, 3000 px/s, 400 px zurück, 1,5 s je Station;
  Frames an `y − 40`, `y`, `y + loopScroll/2`, `y + loopScroll`, `+1,5 s`; Intro alle 100 ms), reduzierte Variante,
  Menü (Öffnen alle 40 ms), Shop/Archiv-Reihen, Produktseite mit „In den Korb“, Korb/Kasse (Mock-Zahlung)/Status/
  Widerruf mit `getAnimations()`-Protokoll, Countdown per Clock bei −10:05/−5:00/−1:00/0, Tattoo-Konturen, Danke-Zustände
  per Mock-Zahlung (alle 100 ms bis 6 s), 404/Variante/500 (alle 200 ms bis 6 s), weiche Navigation R01 → R02 → R04 →
  R06, jede MI auf `/de/qa/motion` (Seek alle 20 ms), Resize/Querformat/verzögerte Schrift, `forcedColors`.
  - Akzeptanz:
    - Jedes Szenario erzeugt die Aufnahmen aus der Spalte „Aufnahmen“ (§4.3) in allen genannten Profilen und beiden
      Varianten; Frame-Beschriftungen enthalten `t` bzw. `y`.
    - Kasse und Danke laufen mit `PAYMENTS_DRIVER=mock` ohne Netz; keine Anfrage an Fremd-Hosts.
    - Vollständige Aufnahme ≤ 25 min (sonst Szenarien auf Worker verteilen).
  - Tests: die Szenario-Dateien selbst; Vollständigkeitsprüfung im Bündel-Manifest (P9.5).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P9.4 Tempo-Messung (SC-18) und Auswertung** – `tests/art/sc-18.art.spec.ts` nach KUNST-QA §4.6 (Profil
  `art-pixel7`, CPU 4×, ohne Video, 1 Vorlauf verworfen, je Route R01, R02, R04, R07 drei Läufe **mit** Engine und drei
  mit `?leash=off`; `__qa.start()` → 5 s Scroll per `Input.synthesizeScrollGesture` 900 px/s → Menü → (R04) „In den
  Korb“ → `dump()`; ein CDP-Trace je Route). `scripts/art/metrics.ts` als `pnpm art:metrics` → `metrics/*.json`:
  rAF-Intervalle p50/p95 und Anteil > 33,4 ms, LoAF > 50 ms mit Skript-Zuordnung (`leash`/`coco`/`micro`),
  `leash:frame` p95, `leash:build`, CLS mit Quellen, Event-Timing Menü/„In den Korb“, LCP, `Layout`-Ereignisse im Trace –
  jeweils Median.
  - Akzeptanz:
    - `metrics/perf.json` enthält alle Größen je Route für „mit“ und „ohne“ Engine; ein Basis-Lauf ist als Kennzahl im
      ersten qa-log-Eintrag vermerkt.
    - Gates sind relativ zur Grundlinie `?leash=off` plus absolute Grenzen für Skriptzeit und Long Tasks (§4.6
      Headless-Hinweis).
  - Tests: `tests/unit/art/metrics.unit.spec.ts` mit aufgezeichneten Beispiel-JSONs in `tests/fixtures/art/`.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P9.5 Kontaktbögen, Bündel und automatische Prüfung I (Kunst)** – `scripts/art/sheets.ts` als
  `pnpm art:sheets` (sharp-Raster ≤ 2400 px breit, 6 Spalten, Beschriftung Szenario/Profil/`t`/`y`; Coco-Bögen je Pose
  A/B/C in allen Größen plus `?parts=1`-Fassung; Stationszeichnung neben Quelle; `sheets/art|motion|a11y/*.webp` je
  ≤ 1,5 MB; der Kalibrierbogen aus P9.2 liegt in jedem Bündel als `sheets/art/calibration-p2-placeholder.webp`),
  `scripts/art/bundle.ts` als `pnpm art:bundle` (`manifest.json` nach KUNST-QA §8 inkl. `toolVersions.webkit` bzw.
  Markierung „WebKit emuliert“, Vollständigkeitsprüfung aller Aufnahmen aus KUNST-QA §4.3 – Videos und Frames je
  Szenario, Profil und Variante –, Größenprüfung ≤ 100 MB, optional ZIP), `scripts/art/check.ts` als `pnpm art:check` (schreibt `check.json` und `check.md`, Exit ≠ 0 bei
  FAIL) mit den automatischen Kriterien LQ-01…LQ-06, CO-01, CO-02, CO-04…CO-08, AR-01…AR-04, AR-06 (Dichte), IM-01,
  IM-02, IM-05.
  - Akzeptanz:
    - Jedes Kriterium meldet PASS/FAIL mit Messwert und Schwelle; Urteilspunkte der Linsen sind in `check.md` als
      „R1/R2/R3“ gekennzeichnet, nicht automatisch bestanden.
    - Negativ-Fixtures scheitern gezielt: perfekte Kreisschlaufe → LQ-04; Sprite mit `<circle>` oder gespiegeltem
      Frame → CO-07; Linienfarbe `#333333` → LQ-01; Platzhalter mit `<text>` → AR-04.
    - Für einen vollständigen Lauf (`art:record` ohne `--scope`) bricht `pnpm art:bundle` mit Exit ≠ 0 ab, wenn ein
      Video, eine Frame-Sequenz oder der Kalibrierbogen fehlt.
  - Tests: `tests/unit/art/check-art.unit.spec.ts` mit synthetischen Fixtures; `tests/unit/art/bundle.unit.spec.ts`
    (Vollständigkeit, Manifest, Budget).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P9.6 Automatische Prüfung II (Bewegung, Lesbarkeit, Tempo, Barrierefreiheit)** – `pnpm art:check` um MO-01…
  MO-10, MO-13…MO-15, LG-01…LG-04, PF-01…PF-12, A11Y-01…A11Y-07, CT-01…CT-03, RZ-01 und RZ-02 ergänzen (Methoden laut
  KUNST-QA §5: LG-01 als Schnittmenge aus gezeichneten LUT-Punkten ± halbe Breite und Coco-Bbox mit
  `Range.getClientRects()` aller Textzeilen, Formularfelder, Knöpfe und Fußbereich-Links; PF gegen die Grundlinie aus
  P9.4; MO über `getAnimations()`, `poseLog` und `data-boil`).
  - Akzeptanz:
    - Alle automatischen Punkte aus §5 sind abgedeckt (Liste in `check.md` vollständig, Abgleich per Test gegen die
      Tabellen in `docs/design/KUNST-QA.md`).
    - Negativ-Fixtures: `ease` als Timing-Funktion → MO-02; 7 s Boil ohne Nutzeraktion → MO-04; Linie über einer
      Textzeile → LG-01; LoAF 80 ms aus `leash` → PF-01.
  - Tests: Erweiterung `tests/unit/art/check-art.unit.spec.ts`; Parser-Test gegen KUNST-QA §5.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P9.7 CI-Workflow `art-qa.yml` und Dauer-Gate** – `.github/workflows/art-qa.yml` nach KUNST-QA §9 und
  ARCHITEKTUR §6.2: Auslöser `workflow_dispatch` und `pull_request` (`labeled`, `synchronize`); der Job läuft, wenn der
  PR das Label `art` trägt oder die Nachricht des Head-Commits `[ci:art]` enthält (z. B.
  `chore(P9.18): record iteration 01 [ci:art]`); kein `push`-Auslöser. Postgres-Service, Installation (Cache),
  `pnpm payload migrate`, `pnpm seed`, `pnpm art:build`, Start, `art:record` (Chromium **und** WebKit, nie
  `PW_SKIP_WEBKIT`), `art:metrics`, `art:sheets`, `art:check` (Gate), `art:bundle` (≤ 100 MB), Upload nach KUNST-QA §8:
  grün → zuerst alle älteren `art-qa-*`-Artefakte löschen (`permissions: actions: write`, höchstens ein Bündel
  gleichzeitig), dann `art-qa-<lauf-id>` mit `retention-days: 30` hochladen; rot → nur `art-qa-check-<lauf-id>` mit
  `check.*` und `metrics/*.json` (≤ 5 MB, `retention-days: 2`). Vor dem optionalen Upload läuft der Budget-Schritt
  `pnpm ci:artifacts` (ab 350 MB kein optionaler Upload, ARCHITEKTUR §6.2). Sonst minimale `permissions`,
  Laufzeit-Ziel ≤ 25 min, Tempo-Läufe (SC-18) nur Chromium. Schnelle Teilmenge in der regulären E2E-Suite:
  `tests/e2e/art-gate.e2e.spec.ts` mit AK-DS-09, AK-DS-11, AK-DS-13, AK-DS-14 und LG-01 für R01 (Pixel 7, ohne Video),
  eingebunden in `ci-full.yml`. Der erste Lauf startet per Commit mit `[ci:art]` oder per Label `art` am PR:
  `workflow_dispatch` geht erst, wenn `art-qa.yml` auf `main` liegt, und ein Head-Commit mit `[skip ci]` unterdrückt
  jeden PR-Lauf, auch das Label-Ereignis. P9 ist von der Regel „höchstens ein Zwischenlauf je Phase“ ausgenommen
  (Arbeitsregeln am Planbeginn); die Zahl der Kunst-QA-Läufe begrenzt die KUNST-QA-Obergrenze von 12 Iterationen
  (KUNST-QA §6.6, §9; ARCHITEKTUR §6.7).
  - Akzeptanz:
    - Ein Lauf per `[ci:art]`, Label oder Dispatch ist grün, lädt ein Bündel ≤ 100 MB hoch und hinterlässt genau ein
      `art-qa-*`-Bündel. Den Rot-Pfad (nur `art-qa-check-<lauf-id>` ≤ 5 MB, 2 Tage) belegt ein Unit-Test der
      Workflow-Datei; ein eigener absichtlich roter Lauf ist nicht nötig.
    - Die Session kann das Bündel eines Laufs mit `gh run download <run-id> -n art-qa-<lauf-id>` nach
      `artifacts/art-qa/<lauf-id>/` holen (Probe in FORTSCHRITT notiert; scheitert es, Eintrag in OFFENE-PUNKTE).
    - `art-qa.yml` läuft nicht bei normalen Pushes und nicht bei PR-Commits ohne `[ci:art]` und ohne Label `art`
      (Minuten-Budget ARCHITEKTUR §6.8).
    - `art-gate.e2e.spec.ts` läuft in jedem `[ci:full …]`-Lauf.
  - Tests: der Workflow-Lauf selbst; `art-gate.e2e.spec.ts`; `tests/unit/ci/art-qa-workflow.unit.spec.ts` (Auslöser
    inkl. `[ci:art]` und Label, kein `push`, Lösch-vor-Upload, Rot-Pfad mit `if: failure()`, `retention-days`,
    Budget-Schritt).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P9.8 Coco-Charakterblatt aus den Referenzfotos** – `content/art/coco/character-sheet.svg` und gerendert
  `content/art/coco/character-sheet.webp` (≤ 300 KB): Seiten- und ¾-Ansicht mit Hilfslinien in der Einheit K
  (Kopflänge, DESIGN §10.1), alle Merkmale (große aufrechte, asymmetrische Ohren mit Innenohr-Linie; große dunkle Augen mit
  Glanzpunkt; kurze helle Schnauze; schwarze, leicht herzförmige Nase; Blesse; tiefe helle Brust; dünne Beine mit
  „Söckchen“; Sichelschwanz; rotes Geschirr mit D-Ring als Leinen-Anker), Fell-/Geschirr-Wash mit Versatz, Strich-Regeln
  §10.2, Gesten-Skizzen aller 6 Posen und 4 Brücken. Grundlage: `content/art/coco-refs.json` (eigene Fotos aus
  `content/seed/coco/`, Highlights); liegt der Instagram-Export vor, zusätzlich die Coco-Stories daraus ansehen (als
  Story erkannt über die JSON-`uri`, gefunden über den Dateinamen irgendwo unter `content/seed/instagram-export/`, wie
  in P8.10) und die gewählten in `coco-refs.json` mit `source: instagram-export` vermerken. Weichen Proportionen nach
  neuen Fotos ab (DA-7): Messwerte und Begründung im Blatt, in OFFENE-PUNKTE und – mit Begründungszeile im PR – in
  DESIGN §10.1.
  - Akzeptanz:
    - Messtabelle im Blatt (Ohrhöhe, Augenbreite, Schnauzenlänge, Nase je Kopflänge; Beinbreite/Beinlänge) liegt in
      den Bereichen von KUNST-QA CO-02.
    - Das Blatt enthält keine eingebetteten Fotos (`<image>` verboten) und wird nie ausgeliefert (nicht in `public/`,
      nicht im Build, nicht in der Vorschau-Datei).
    - Die frische Prüf-Linse (P8.12) vergleicht `character-sheet.webp` mit den Referenzbildern: „Coco erkennbar?“ = ja,
      jedes Merkmal der Liste CO-03 mit Beleg vorhanden, Stilnote CO-09 nach KUNST-QA §6.5; Urteil in FORTSCHRITT.
  - Tests: `tests/unit/art/character-sheet.unit.spec.ts` (kein `<image>`, Datei nicht unter `public/`).
  - Ohne Jutta: Highlights (150 px) als Referenz. P11-Nacharbeit: Jutta beantwortet „Ist das Coco?“ (KUNST-QA §10
    Nr. 4); Korrekturen an Ohren, Farbe, Geschirr als Nacharbeit.

- [ ] **P9.9 Coco-Posen I: `sitzen`, `kopfschief`, `schlafen` + Brücken `einrollen-1`, `einrollen-2`** – Frame A je
  Pose als gezeichnete Pfade (keine Formen-Primitive), Frames B und C als echte Nachzeichnungen (jede Linie neu,
  Abweichung 0,5–1,5 Einheiten, gleiche Anatomie, Anker ± 2) nach DESIGN §10.2–§10.4 und §10.7 in
  `src/art/coco/coco-sprite.svg` (Ebenen `fur`/`harness`/`line`/`solid`/`hi`, `data-part`-Gruppen,
  `data-hidden-parts`, `data-anchor-x/y`, `data-ground-y`; Schlaf-Pose mit 4–6 Schraffurstrichen, Augen als
  geschlossene Bögen). Build-Skript `scripts/art/build-sprite.ts` als `pnpm art:sprite` → `public/art/coco-sprite.v2.svg`
  + `src/art/coco/coco-sprite.json` (DESIGN §10.4; SVGO `floatPrecision: 1`, `collapseGroups: false`, `removeUnknownsAndDefaults: {
  keepDataAttrs: true }`); die Sprite-Version steht an **einer** Stelle im Code. Noch nicht neu gezeichnete Symbole
  bleiben bis P9.10 aus v1.
  - Akzeptanz:
    - `pnpm art:check` (SC-12 auf `/de/qa/coco`) für diese 11 Symbole: CO-01, CO-02, CO-04, CO-05 (IoU 0,88–0,97),
      CO-06, CO-07, CO-08 PASS.
    - CO-03-Merkmalliste je Frame von der frischen Prüf-Linse (P8.12) auf dem Coco-Bogen (SC-12) geprüft: Coco in jedem
      Frame erkennbar, Geschirr mit D-Ring überall, wo Rücken/Brust sichtbar; Urteil in FORTSCHRITT.
    - Ruhe-Posen (DESIGN §10.6) zeigen Frame A; Boil-Reihenfolge A → B → C (MO-03).
  - Tests: `tests/unit/art/sprite.unit.spec.ts` (keine Primitive, 22 IDs, `viewBox="0 0 160 120"`, Anker-Stabilität
    aus `coco-sprite.json`).
  - Ohne Jutta: nach Charakterblatt. P11-Nacharbeit: siehe P9.8.

- [ ] **P9.10 Coco-Posen II: `rennen`, `schnueffeln`, `springen` + Brücken `bremsen`, `abspringen`** – `rennen` mit
  drei echten Gangphasen (A Streckung, B Sammlung, C Flug; Silhouette wechselt deutlich, Anker am Rücken ± 3),
  `schnueffeln` (Nase am Boden, in C 1 Einheit Schnüffel-Zucken), `springen` (Luftbogen) und die Brücken; damit sind
  alle 22 Symbole final. `pnpm art:sprite` erneut, Größen-Budget prüfen.
  - Akzeptanz:
    - Alle 22 Symbole: CO-01…CO-08 automatisch PASS; CO-05 `rennen` IoU 0,55–0,85.
    - `COCO_POSE_TO_SPRITE` in `src/leash/poses.ts` bildet jeden Wert aus `COCO_POSES` (DATENMODELL §4) auf eine der
      sechs gezeichneten Posen ab (DESIGN §10.3); jede Pose hat Frames A, B und C.
    - PF-10: Sprite ≤ 45 KB roh / ≤ 12 KB gz; Coco-Steuerung ≤ 3 KB gz (PF-09).
    - MO-03: `rennen`/`springen` 12 fps, `schlafen` 8 fps, übrige 10 fps; Seek auf 0/1/2 Frame-Längen zeigt a/b/c.
  - Tests: Erweiterung `tests/unit/art/sprite.unit.spec.ts` (Budgets, fps-Zuordnung).
  - Ohne Jutta: nach Charakterblatt. P11-Nacharbeit: siehe P9.8.

- [ ] **P9.11 Lebendige Tuschelinie (Stufe A)** – Engine-Parameter innerhalb der DESIGN-Bereiche feinjustieren
  (§9.3 Schritte 6–9, §9.4, §9.5): Wackel-Amplituden je Breite, Breitenprofil mit Krümmungszuschlag im Band
  [0,8; 1,35] × Grundbreite, Federansatz (0,35 → 1 über 28 px) und Abheben (→ 0,45 über 18 px), Tintenpunkte an jedem
  Schlaufenstart, Schlaufen nie perfekt (Radius ±12 %, verkippte Ellipsen), nahtlose Segmente (2 px Überlappung), Stufe B
  „Feder“ als würdiger Rückfall, erzwungene Farben (`CanvasText`). Änderungen nur in `src/leash/presets.ts` und
  `src/leash/geometry.ts`/`runtime.ts`.
  - Akzeptanz:
    - LQ-01…LQ-06 automatisch PASS auf SC-01, SC-04, SC-05, SC-08, SC-15; A11Y-05 (SC-17) PASS.
    - AK-DS-12…AK-DS-15 grün; Geometrie weiterhin deterministisch.
    - PF-09: Engine-Chunk ≤ 12 KB gz; PF-12: künstliche Last schaltet innerhalb von 2 s auf Stufe B.
  - Tests: Engine-Unit-Tests erweitert (Breitenband, Verjüngung an Anfang/Ende, Anzahl Tintenpunkte = Anzahl
    Schlaufen, Nahtüberlappung).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P9.12 Stationszeichnungen final, Weltraum-Motive und Marke** – `content/art/sources.json` je Quelle
  feinjustieren und `pnpm art:vectorize` erneut (bei gemapptem Instagram-Export mit voller Auflösung); manuelle
  Nacharbeit nur als dokumentierte Pfad-Korrektur. Weltraum-Motive `src/art/space/*.svg` nach DESIGN §12.5 (Planet mit
  Ring, 4- und 5-zackiger Stern, Mondsichel, gestrichelte Umlaufbahn, Retro-Untertasse, Morse-Leiste „CLAIRE“, je
  ≤ 1,5 KB); Wortmarke, Favicon, Apple-Touch-Icon, PWA-Icons (Matte-Grün) und OG-Standardbild nach DESIGN §12.6 prüfen
  und bei Bedarf nachzeichnen.
  - Akzeptanz:
    - AR-01, AR-02 (Median-Strichbreite 0,75–1,25 × Quelle, keine Klumpen > 2 % der Fläche), AR-03, AR-06 (höchstens
      eine Marke je Station, ≤ 3 Sterne je Bildschirmhöhe, keine Band-Bezüge) automatisch PASS.
    - AR-07 von der frischen Prüf-Linse (P8.12) auf dem Bogen von `/de/qa/art` geprüft (Favicon bei 16 px als Planet mit
      Ring erkennbar, Wortmarke ab 24 px lesbar, Stationszeichnungen lesbar); `/de/qa/art` zeigt alles nebeneinander.
  - Tests: `tests/unit/art/stations.unit.spec.ts` und `tests/unit/art/space.unit.spec.ts` (Größen, Dichte-Regeln).
  - Ohne Jutta: aus 640-px-Quellen. P11-Nacharbeit: nach dem Export `pnpm art:vectorize` und SC-13 wiederholen.

- [ ] **P9.13 Platzhalter-Feinschliff** – Alle Platzhalter (SEED-SPEC §4.2) gegen DESIGN §12.3 und Juttas Referenzen prüfen und dort
  nachzeichnen, wo sie generisch wirken (Ziel Rubrik ≥ 4, AR-05; im Shop-Raster zwischen echten Fotos nicht „fremd“,
  IM-04); `pnpm art:placeholders && pnpm seed:example --refresh-media`.
  - Akzeptanz:
    - AR-03 und AR-04 automatisch PASS für alle Dateien unter `src/art/placeholders/`.
    - Kontaktbogen des Shop-Rasters (SC-04) mit Fotos und Platzhaltern im Wechsel liegt vor; die frische Prüf-Linse
      (P8.12) vergibt AR-05 und IM-04 nach KUNST-QA §6.5 je ≥ 4, mit Begründung im qa-log.
  - Tests: `tests/unit/art/placeholders.unit.spec.ts` bleibt grün.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P9.14 Foto-Look-Pipeline (Weißabgleich, Belichtung, Schalter)** – DESIGN §12.2 Schritte 4–6 in
  `src/lib/media/enhance.ts` (rein, testbar): Neutralpunkt aus hellen, unbunten Pixeln (L* im oberen 5 %-Quantil und
  Chroma < 12 in Lab), Kanal-Verstärkung begrenzt auf [0,92; 1,08], kein Abgleich bei < 0,5 % geeigneten Pixeln,
  Kategorie `drawing` halbe Stärke; Belichtung: Median-L* des mittleren 60 %-Bereichs, Korrektur nur außerhalb 56–68 auf
  Ziel 62 mit γ ∈ [0,8; 1,25] als Tonwertkurve, bei > 1 % Clipping Abstand von γ zu 1 halbieren. Das Feld
  `media.enhance` (`auto`/`off`) wirkt jetzt; Vorher/Nachher-Vorschau in der Verwaltung; `derivativesVersion` erhöhen
  und `pnpm media:regenerate` (alle Größen neu, idempotent). Fixtures `tests/fixtures/images/graycard.jpg` und
  `matte-only.jpg`.
  - Akzeptanz:
    - AK-DS-17: Graukarte wird auf ΔE2000 ≤ 3 neutralisiert, Nur-Matte-Bild bleibt unverändert, Verstärkungen im
      Bereich, `thumb`/`card` 0,800 ± 0,002, keine EXIF/GPS-Daten.
    - IM-01, IM-02 (Standardabweichung Median-L* aller Titelbilder ≤ 6; Papierflächen a*/b* innerhalb ± 4), IM-05
      (Median `thumb` ≤ 40 KB, `card` ≤ 90 KB, LCP-Bild der Produktseite ≤ 120 KB) automatisch PASS.
    - `enhance = off` liefert dieselben Dateien wie die P1-Pipeline.
  - Tests: `tests/unit/media/enhance.unit.spec.ts`; `tests/int/media/regenerate.int.spec.ts`.
  - Ohne Jutta: mit Seed-Bildern. P11-Nacharbeit: –

- [ ] **P9.15 Choreografie der Startseite (Preset `journey`)** – DESIGN §11.4 vollständig in `src/leash/coco.ts`,
  `runtime.ts` und `presets.ts`: Stationen S0–S8 mit Ankern und Schlaufen (`orbit` um die Planet-Marke, `right`,
  `right` + `lasso` ab 1200 px, `left`, `spiral`, Ketten-Schlaufe mit Tintenperle, `contour`, `left`), Posen
  „Ankunft → Verweilen“ mit den Brücken aus §10.3, Verweil-Timer 1,2 s bzw. 1,5 s, Sprung-Sequenz Schmuck (415 ms ab
  `loopLen1`), `rennen` zwischen den Stationen mit Richtungswechsel erst nach 24 px, beim Hochscrollen gespiegelt,
  Scrollstopp > 1,2 s → `sitzen`; Intro MI-10 ab LCP + 300 ms, MI-12, MI-13, MI-14; Boil-Budget (§10.3) und reduzierte
  Bewegung (§9.11). Umsetzung mit eigenem Code und Web Animations API; GSAP wird standardmäßig nicht verwendet (DA-4,
  DESIGN §9.10). Nur wenn nachgewiesen ist, dass WAAPI für die Choreografie nicht reicht: ADR in `docs/adr/`, dann nur
  `gsap` Core (+ `CustomEase`) als Lazy-Chunk ausschließlich auf R01, ≤ 30 KB gz (ARCHITEKTUR C-20).
  - Akzeptanz:
    - MO-04…MO-10 automatisch PASS auf SC-01/SC-02 in allen drei Profilen.
    - AK-DS-13, AK-DS-14, AK-DS-15 grün; LG-01 auf SC-01 leer.
    - PF-01…PF-06 ohne Verschlechterung gegenüber der Basis aus P9.4.
  - Tests: Engine-Unit-Test (Posen-Tabelle §11.4 → erwartete Sequenz inkl. Brücken);
    `tests/e2e/home-choreo.e2e.spec.ts` (Pose je Station über `__leash.pose()`).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P9.16 Mikro-Interaktionen und Seitenübergänge polieren** – MI-01 bis MI-16 exakt nach DESIGN §11.5
  (Auslöser, Ablauf, Dauer-Tokens §11.3, Easing-Tokens §11.2, nur `transform`/`opacity`/`clip-path`/
  `stroke-dashoffset`, Verhalten bei reduzierter Bewegung, „Nie auf“-Liste); Ruhezonen DESIGN §11.6 unverändert.
  View Transitions nach §9.8 (Namen `coco` und `leash-head`, nie von/zu `calm`-Routen, harte Navigation nur mit
  `prefers-reduced-motion: no-preference`); Ergebnis des P2-Spikes zu `ViewTransition` prüfen und als ADR in
  `docs/adr/` festhalten, falls noch nicht geschehen. Alle Module bleiben framework-frei (`mount(root) → unmount()`,
  KONZEPT §12.9), damit die Vorschau-Datei sie enthält.
  - Akzeptanz:
    - MO-01, MO-02, MO-03, MO-04, MO-13, MO-14, MO-15, RZ-01, RZ-02, A11Y-06 automatisch PASS.
    - AK-DS-11 und AK-DS-16 grün.
    - Vorschau-Datei: Linie und Coco bewegen sich beim Scrollen, „In den Korb“ spielt den Mikromoment (KONZEPT §12.7
      Nr. 5 und 7).
  - Tests: Unit-Test der Dauer-/Easing-Tabelle gegen DESIGN §11.3/§11.5; E2E-Teilmenge auf `/de/qa/motion`.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P9.17 Tempo, Lesbarkeit und Barrierefreiheit feinschleifen** – Vollständige Aufnahme, dann alle automatischen
  Kriterien aus KUNST-QA §5.5–§5.8 grün machen: LG-01…LG-04, PF-01…PF-12, A11Y-01…A11Y-07, CT-01…CT-03; JS- und
  SVG-Budgets (PF-09, PF-10; DESIGN §9.10). Engpässe nur bei verhandelbaren Punkten über die Vereinfachungsleiter
  (KUNST-QA §6.6 Nr. 5) lösen und dokumentieren.
  - Akzeptanz:
    - `pnpm art:check` über eine vollständige Aufnahme endet mit Exit 0.
    - `pnpm test:perf` (Lighthouse-CI, EK-01) und die axe-Suite (EK-07) unverändert grün.
    - Kennzahlen (p95 rAF mit/ohne Engine, Long Tasks, `leash:frame`, LCP-Differenz, Chunk-Größen) im qa-log.
  - Tests: `pnpm art:check`, `pnpm test:perf`, `pnpm test:e2e --grep @a11y`.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P9.18 Studio-QA-Schleife I: erste vollständige Iteration mit Protokoll** – Das Verfahren aus KUNST-QA §1 und
  §6; jede Iteration ist ein eigener Arbeitsblock mit eigenem Protokoll, die Nummer NN läuft fortlaufend über ganz P9.
  Diese Aufgabe führt Iteration 01 durch, immer mit **vollständiger** Aufnahme; P9.18a wiederholt den Ablauf bis PASS
  oder Obergrenze. Ablauf je Iteration NN:
  1. Sauberer Commit (`git status` leer), Befund-Commits der Vor-Iteration enthalten.
  2. Aufnahme: `pnpm art:build`, `pnpm art:record` – Zwischen-Iterationen dürfen `--scope` (betroffene Szenarien +
     SC-00) nutzen; die erste und die **abschließende** Iteration sind immer vollständig (alle Szenarien SC-00…SC-18 in
     den Profilen und Varianten, die KUNST-QA §4.3 und §4.6 je Szenario vorgeben, mit allen Videos und Frames). Dann
     `pnpm art:metrics`, `pnpm art:sheets`, `pnpm art:check` – rot → zuerst beheben, keine Prüfer verbrauchen (§6.6
     Nr. 1) – und `pnpm art:bundle`. Fehlt der Session WebKit, stammt das Bündel der abschließenden Iteration aus
     `art-qa.yml` auf demselben Commit (Commit mit `[ci:art]`, z. B. `chore(P9.18): record iteration 01 [ci:art]`,
     oder Label `art` am PR mit einem Head-Commit ohne `[skip ci]`, oder `gh workflow run art-qa.yml --ref <branch>`,
     sobald `art-qa.yml` auf `main` liegt; dann `gh run download`); ist das nicht möglich, gilt die Regel aus KUNST-QA
     §3.3 (R3 wertet `art-iphone15` als „nur visuell“) mit Vermerk im Protokoll und in OFFENE-PUNKTE. Kunst-QA-Läufe
     zählen nicht als Zwischenlauf der Phase (Arbeitsregeln am Planbeginn).
  3. Review: drei **frisch gestartete** Subagenten parallel (nie ein Prüf-Kontext aus einer früheren Iteration), jeder
     mit der Vorlage KUNST-QA §6.2 und ausschließlich seinem Material aus §1 „Sieht“ – kein Quellcode (Ausnahme R3:
     Build-Statistik und `check.json`), keine Begründungen der Umsetzer:in, keine Urteile der anderen Linsen. R1
     bewertet zuerst den Kalibrierbogen; eine Note ≥ 3 macht R1 ungültig, dann startet ein neuer R1. Ab Iteration 2
     bekommt jede Linse nur ihre **eigenen** offenen Befunde als Nachprüfliste und prüft trotzdem ihre ganze
     Checkliste. Antworten im Format §6.3 als `reviews/R1.md`, `R2.md`, `R3.md` im Bündel; ein Punkt ohne Beleg gilt als
     FAIL. Ohne Subagenten-Werkzeug: §6.1 Nr. 5.
  4. Protokoll `docs/design/qa-log/YYYY-MM-DD-iter-NN.md` nach Vorlage §7 (automatische Prüfung, Urteile, Kennzahlen,
     Befunde, Entscheidungen/Vereinfachungen, nächste Schritte) plus Zeile in `docs/design/qa-log/INDEX.md`; Commit.
  - Akzeptanz:
    - Iteration 01 stammt aus einer vollständigen Aufnahme mit grünem `pnpm art:check`; die drei Review-Dateien liegen
      im Bündel; Protokoll `…-iter-01.md` und die Zeile in `INDEX.md` sind committet.
    - Melden R1, R2 und R3 schon in Iteration 01 PASS, ist P9.18a mit Vermerk „PASS in Iteration 01“ erfüllt.
  - Tests: `pnpm art:check`; `pnpm art:bundle` (Vollständigkeit).
  - Ohne Jutta: die drei Subagenten-Linsen ersetzen menschliche Prüfer. P11-Nacharbeit: –

- [ ] **P9.18a Studio-QA-Schleife II: nachbessern bis PASS oder Obergrenze** – Je weitere Iteration zuerst
  nachbessern, dann den Ablauf aus P9.18 (Schritte 1–4) mit der nächsten Nummer; braucht die Iteration einen Lauf von
  `art-qa.yml`, trägt ihr Aufnahme-Commit `[ci:art]` (z. B. `chore(P9.18a): record iteration 03 [ci:art]`). Diese
  Läufe sind von der Regel „höchstens ein Zwischenlauf je Phase“ ausgenommen; ihre Zahl begrenzt Fall c unten
  (12 Iterationen):
  - Nachbessern: alle Blocker und Major beheben, Minor nach Aufwand (höchstens 3 bleiben offen, im Protokoll); je
    Befund ein Commit mit Befund-ID, z. B. `fix(P9.18a): redraw sitzen-b harness (R1-02-01) [skip ci]`. Scheitert
    derselbe Punkt am selben Objekt dreimal hintereinander: nächste Stufe der Vereinfachungsleiter (§6.6 Nr. 5),
    vermerkt im Protokoll und in OFFENE-PUNKTE; die nicht verhandelbaren Punkte (B-Punkte §5.5–§5.8, mindestens 6 Posen
    × 3 Frames, Linie tuscheschwarz, reduzierte Bewegung, Ruhezonen) werden immer behoben, nie vereinfacht.
  - Die Schleife endet – und die Checkbox wird abgehakt –, sobald einer dieser Fälle eintritt:
    - **a) PASS:** R1, R2 und R3 melden PASS in derselben Iteration, auf demselben Commit und demselben Bündel aus einer
      vollständigen Aufnahme, und `pnpm art:check` ist grün (KUNST-QA §0 Nr. 1–2, §6.4).
    - **b) Nach 8 Iterationen** (§6.6 Nr. 6): alle nicht verhandelbaren Punkte PASS; die restlichen Urteilspunkte
      stehen als „Kunst-QA offen: …“ in OFFENE-PUNKTE. Sind nicht verhandelbare Punkte offen, geht die Schleife weiter.
    - **c) Harte Grenze** (KUNST-QA §6.6): Iteration 12 ist abgeschlossen, oder derselbe B-Punkt ist in 3
      aufeinanderfolgenden Iterationen ohne Fortschritt FAIL. Jeder offene B-Punkt steht dann als Blocker oben in der
      PR-Beschreibung („Kunst-QA-Blocker: …“) und in OFFENE-PUNKTE (Befund-ID, Messwert, bisherige Versuche); die
      Aufgabe wird mit dem Vermerk „an der Obergrenze beendet“ abgehakt, weiter mit P9.19 und P10. Betrifft ein Blocker
      ein Kriterium des Dauer-Gates (P9.7), wird genau dieser Test mit `test.fixme` und Verweis auf den
      OFFENE-PUNKTE-Eintrag markiert (ARCHITEKTUR §7.2), damit die reguläre CI grün bleibt.
  - Akzeptanz:
    - Genau einer der Fälle a–c ist erreicht und im letzten Protokoll und in FORTSCHRITT benannt.
    - `INDEX.md` hat eine Zeile je Iteration; jede Iteration hat ein Protokoll mit den drei Review-Dateien als Beleg;
      Protokolle werden nie nachträglich geändert (nur datierte Status-Nachträge).
    - Das Manifest des abschließenden Bündels listet für jedes Szenario, Profil und jede Variante die Videos und Frames
      aus KUNST-QA §4.3 und die verwendeten Browser-Versionen (bei Emulation markiert).
    - Angewandte Vereinfachungen stehen im Protokoll und in OFFENE-PUNKTE.
  - Tests: `pnpm art:check`; `pnpm art:bundle` (Vollständigkeit); reguläre CI bleibt grün.
  - Ohne Jutta: die drei Subagenten-Linsen ersetzen menschliche Prüfer. P11-Nacharbeit: Sichtprüfung durch Jutta auf
    echten Geräten (KUNST-QA §10 Nr. 4); bei Fall b oder c entscheidet Jutta über die offenen Punkte (P11.1).

- [ ] **P9.19 Abschluss P9 und Übergabe** – KUNST-QA §10: End-Bündel als CI-Artefakt `art-qa-<lauf-id>` (30 Tage) –
  stammt das PASS-Bündel schon aus `art-qa.yml`, ist es das End-Bündel; sonst `art-qa.yml` auf dem PASS-Stand
  auslösen – per Commit mit `[ci:art]` (nach dem PASS-Commit nur Doku- und Protokoll-Änderungen, notfalls ein leerer
  Commit), per Label `art` am PR mit einem Head-Commit ohne `[skip ci]` oder per `workflow_dispatch`, sobald
  `art-qa.yml` auf `main` liegt –; `art:check` muss dort ebenfalls grün sein (mit echtem WebKit); ausgewählte Standbilder (≤ 8 WebP, je
  ≤ 150 KB, zusammen ≤ 1,2 MB) nach `docs/design/qa-log/img/<datum>-iter-NN/`; deterministische Referenz-Standbilder
  (nur `reduced`/`?freeze=1`) aus dem CI-Bündel (nie lokal erzeugt) nach `tests/art/__screenshots__/` (≤ 3 MB);
  `INDEX.md` vollständig; FORTSCHRITT-Eintrag für Jutta („Die Zeichnungen und Animationen sind fertig und dreifach
  geprüft. Die Videos kannst du dir hier ansehen: {Link, 30 Tage gültig}.“); offene Minor-Befunde und Vereinfachungen in
  OFFENE-PUNKTE; die P11-Checkliste aus KUNST-QA §10 Nr. 4 als Nacharbeit für `docs/GO-LIVE.md` (entsteht in P10.16) in
  FORTSCHRITT vormerken. Danach das Label `art` vom PR entfernen: `art-qa.yml` läuft nur noch per `workflow_dispatch`,
  `[ci:art]` oder erneut gesetztem Label; ersetzt ein späterer Lauf das Bündel, wird der Link in FORTSCHRITT aktualisiert
  (KUNST-QA §8). Endete P9.18a an der harten Grenze (Fall c): `art-qa.yml` trotzdem auf dem letzten Stand auslösen; ist
  `art:check` dort nur wegen der genannten Blocker rot, gibt es statt des Bündels `art-qa-check-<lauf-id>`, und der
  FORTSCHRITT-Eintrag nennt statt „dreifach geprüft“ die offenen Punkte in einfachen Worten.
  - Akzeptanz:
    - Artefakt existiert (`gh api repos/{owner}/{repo}/actions/artifacts` listet `art-qa-<lauf-id>`), sein Manifest
      nennt den PASS-Commit (bzw. den `[ci:art]`-Commit, der sich davon nur in Doku und Protokollen unterscheidet,
      `git diff --name-only`) und eine WebKit-Version (Fall c aus P9.18a: `art-qa-check-<lauf-id>` des letzten Stands,
      rot nur mit den Blockern aus dem PR).
    - Größen-Budgets der Repo-Bilder eingehalten (Skript-Prüfung in `pnpm art:bundle`).
    - Die schnelle Teilmenge aus P9.7 ist als Dauer-Gate in der regulären CI aktiv; das Label `art` ist entfernt.
  - Tests: `pnpm art:bundle` (Budget-Prüfung); `art-gate.e2e.spec.ts`.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: KUNST-QA §10 Nr. 4 (Instagram-In-App-Browser, „Ist das Coco?“,
    Neu-Vektorisierung nach Export, reduzierte Bewegung am Handy).

### Phasen-Abnahme

- [ ] Alle Aufgaben P9.1–P9.19 (einschließlich P9.18a) abgehakt; KUNST-QA §0 „P9 ist fertig“ Nr. 1–4 erfüllt (Gate G4,
  ARCHITEKTUR §7.9) – oder P9.18a endete nach Fall b bzw. c mit Vermerk, und die offenen Punkte stehen in OFFENE-PUNKTE
  (Fall c zusätzlich als Blocker oben im PR).
- [ ] EK-12 belegt (PASS-Iteration im qa-log, bei Fall b/c der Abschlussvermerk); EK-01 (Lighthouse-CI) und EK-07 (axe)
  unverändert grün.
- [ ] `pnpm check`, `pnpm test:int`, `pnpm build`, `pnpm test:e2e` lokal grün; `pnpm test:preview-export` lokal grün
  inklusive Linien- und Coco-Bewegung (KONZEPT §12.7 Nr. 5) und reduzierter Bewegung; Datei ≤ 40 MB.
- [ ] `art-qa.yml` auf dem Endstand von P9.18a (PASS-Commit bzw. letzter Stand bei Fall b/c) grün (P9.19; danach nur
  Doku-, Bild- und Referenz-Commits); bei Fall c rot nur mit den im PR genannten Blockern.
- [ ] R-001: `LEGAL_TRACE_PHASE = 9`.
- [ ] Doku geprüft: alle `art:*`-Skripte stehen so in ARCHITEKTUR §6.10 und `package.json`; Anhang B/ADR (View
  Transitions; GSAP nur falls per ADR eingeführt); DESIGN nur mit begründeter Änderung (z. B. DA-7 Proportionen);
  `.gitignore` enthält `artifacts/`.
- [ ] `docs/FORTSCHRITT.md` (du-Form, Video-Link) und `docs/OFFENE-PUNKTE.md` aktualisiert.
- [ ] CI grün: Phasenende-Commit `chore(P9): finish phase [ci:full p9]` → `ci.yml`, `ci-full.yml` und
  `preview-export.yml` grün, Vorschau-Artefakt `planet-claire-vorschau-p9-<sha7>` erzeugt. Dieses Häkchen setzt erst
  ein reiner Doku-Commit mit `[skip ci]`, nachdem der Lauf grün ist (ARCHITEKTUR §6.7).
- [ ] PR-Beschreibung aktualisiert; gemergt oder oben „Bitte mergen – CI ist grün“.

## P10 – Qualität, Startvorbereitung, finale Vorschau

**Ziel:** Die Seite ist technisch startklar, ohne dass schon ein echtes Konto existiert: vollständige und
nachverfolgbare Testsuite, Barrierefreiheits-Audit, Tempo-Budgets als Gate, Sicherheits-Header/CSP und Rate-Limits
geprüft, Wartungsmodus, Backups (Code, Test, monatliche Übung mit synthetischen Daten – in Produktion bis P11
inaktiv), Sentry (ohne DSN inaktiv), cookielose Statistik (bis zur Freigabe aus), Docker-Exit-Pfad mit CI-Rauchtest,
Vercel-Konfiguration und Startklar-Prüfung. Dazu die Dokumente für den Betrieb und den Start: `docs/RUNBOOK.md`,
`docs/GO-LIVE.md` (DNS-Umstellung und Start-Checkliste) und Juttas Handbuch mit Bildschirmfotos
(`docs/owner/HANDBUCH.md`). Zum Schluss entsteht die finale Single-File-Vorschau `dist/planet-claire-vorschau.html`,
besteht den Offline-Abnahmetest und wird nach dem Merge automatisch als GitHub-Release „Vorschau“ (`vorschau-p10`)
veröffentlicht; Jutta bekommt
einen Abschlussbericht in `docs/FORTSCHRITT.md`. Danach hält die Session an – P11 beginnt nur gemeinsam mit Jutta.

**Voraussetzungen:** P1–P9 abgeschlossen; gemergt oder im Arbeitsbranch enthalten; KUNST-QA-Dauer-Gate aus P9.7
aktiv. Keine echten Konten oder Geheimnisse (CLAUDE.md §2); alle Integrationen über Mock-Treiber, Test-Schlüssel nur als erkennbar unechte Werte
(`ci-only-…`, `sk_test_fake…`). Namen von Variablen, Skripten, Endpunkten strikt nach ARCHITEKTUR §2.5, §5.2, §6.10.

**Referenzen:** E-05, E-43, E-91…E-99; R-001, R-049, R-095, R-131…R-137, R-155…R-157, R-161, R-162, R-182, R-190,
R-191, R-210, RECHT §5, §7 Teil A; KONZEPT §1.4 (EK-01…EK-11), §1.5, §1.6, §2.5, §7.14–§7.16, §12; DATENMODELL §7.1,
§13.7; ARCHITEKTUR §1.3, §4.2–§4.8, §5, §6 (vollständig), §7 (vollständig), §8 (vollständig), §9.6, §10, §11, §12,
§13, §14, Anhang B (B-01, B-03, B-06, B-08), Anhang C; DESIGN §9.10, §9.12, §12.1, §13; KUNST-QA §9, §10; DIENSTE §3,
§6, §7; LOESCHKONZEPT §3.6; AUFGABEN; ANLEITUNGEN G5–G8, V1, V2, N1, Z1, Z2; CLAUDE.md §8; CLOUD-SETUP §3.2
(`--plan-status`), §4.3.

### Aufgaben

- [ ] **P10.1 Testinventur, Rückverfolgbarkeit und Abdeckung** – R-001 auf `LEGAL_TRACE_PHASE = 10` stellen und
  fehlende Tests zu R-IDs mit Test-Art `unit`/`int`/`e2e` ergänzen. Neuer Meta-Test
  `tests/unit/meta/ak-trace.unit.spec.ts`: sammelt alle Akzeptanz-IDs aus KONZEPT (`AK-…`, `EK-…`), DATENMODELL
  (`DM-…`), ARCHITEKTUR (`AK-A-…`, `T-01`…`T-22`), DESIGN (`AK-DS-…`) und SEED-SPEC (`AK-SEED-…`) und verlangt je ID
  einen Testtitel mit dieser ID **oder** einen Eintrag in `tests/manual-checks.json` mit Begründung und Phase (z. B.
  EK-08-Stoppuhr → P11, EK-10 → P11). `pnpm test:coverage` mit den Schwellen aus ARCHITEKTUR §7.8 im `ci-full`-Job
  `quality`; `test:unit` zusätzlich mit `TZ=Europe/Berlin` im `ci-full`.
  - Akzeptanz:
    - Beide Nachverfolgungs-Tests grün; Gegenprobe: eine ID aus einem Testtitel entfernen → Test rot.
    - Abdeckung: `src/lib/{commerce,payments,security,legal}/**` ≥ 90 % Zeilen / ≥ 85 % Zweige, `src/lib/**` ≥ 70 %.
    - Kein `test.only`; `test.fixme` nur mit OFFENE-PUNKTE-Eintrag und nie bei Kasse, Reservierung oder Recht
      (ARCHITEKTUR §7.2).
  - Tests: die beiden Meta-Tests; `pnpm test:coverage`.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: manuelle Punkte aus `tests/manual-checks.json` mit Phase P11.

- [ ] **P10.2 E2E-Gesamtlauf und Kaufpfad-Kennzahlen** – Alle Playwright-Projekte (`desktop`, `iphone-15` WebKit,
  `pixel-7`) mit allen Tags außer `@visual`/`@perf` sowie `pnpm test:visual` (Referenzen nur Linux und nur in CI
  erzeugt: Commit mit `[ci:update-snapshots]` → Artefakt → `gh run download` → Commit mit Begründung).
  Kennzahlen-Tests: EK-02 (Produkt → Warenkorb → Kasse → Danke in ≤ 4 Seiten für Karte, PayPal, Vorkasse, Abholung bei
  390×844 und 412×915), EK-08 automatisch (Keramik „Neues Stück“ bis „online“ mit ≤ 10 Eingaben
  ohne Fotos; „bezahlt → versendet“ in ≤ 5 Taps + Sendungsnummer; AK-7-05), AK-7-04, EK-03/T-01 (100 Wiederholungen).
  Flaky Tests reparieren (ARCHITEKTUR §7.2).
  - Akzeptanz:
    - Zwei aufeinanderfolgende Volläufe grün, Report ohne „flaky“.
    - Zähl-Assertions für Seiten, Eingaben und Taps grün.
  - Tests: bestehende Suiten; neu `tests/e2e/metrics/purchase-path.e2e.spec.ts` und
    `tests/e2e/metrics/admin-taps.e2e.spec.ts`.
  - Ohne Jutta: automatisch messbar. P11-Nacharbeit: Stoppuhr-Test „Neues Stück ≤ 3 min“ mit Jutta (EK-08, P11.9).

- [ ] **P10.3 Barrierefreiheits-Audit** – T-11 über jede Registry-Route DE/EN und die Zustände leer, Fehler,
  reserviert, verkauft sowie jede Admin-Handy-Ansicht; Tastatur-Durchläufe (Menü, Galerie/Zoom, Warenkorb, Kasse,
  Widerruf, Auftragsformular, Verwaltung); sichtbarer Fokus; 200 % Schriftgröße bei 390 px ohne horizontales Scrollen;
  erzwungene Farben; `prefers-reduced-motion` auf allen Routen (AK-DS-14); Alt-Texte DE/EN aller öffentlichen Bilder;
  keine Barrierefreiheits-, Konformitäts- oder Zertifikatsbehauptung (R-190, V-26).
  - Akzeptanz:
    - EK-07: 0 axe-Verstöße `serious`/`critical`; R-191: Kauf und Widerruf komplett per Tastatur (E2E).
    - AK-DS-07, AK-DS-08, AK-DS-09 grün.
    - Befunde behoben; Kurzfassung (ohne Konformitätsaussage) in FORTSCHRITT.
  - Tests: Erweiterung der `@a11y`-Suite; `tests/e2e/a11y/keyboard.e2e.spec.ts`.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P10.4 Tempo-Budgets als Gate** – `pnpm test:perf` (Lighthouse-CI mobil, Median aus 3) für R01, R02, R04, R11
  (LCP ≤ 2,5 s, TBT ≤ 200 ms, CLS ≤ 0,1) und CLS zusätzlich für R06/R07; `pnpm check:bundle` für alle Seitentypen
  (ARCHITEKTUR §7.7: R01 ≤ 170 KB, R02–R05/R11–R27 ≤ 150 KB, R06/R07 ≤ 220 KB ohne Stripe.js; Lazy-Chunks laut DESIGN
  §9.10; drei Schriften ≤ 100 KB; LCP-Bild ≤ 120 KB; R01 ≤ 1,5 MB); INP-Ersatz (`@perf`, `pixel-7`, CPU 4×).
  `tests/perf/budgets.json` aktuell; `lighthouserc.cjs` nur mit `ci.upload.target: 'filesystem'`.
  - Akzeptanz:
    - EK-01 als Gate im `ci-full`-Job `quality` grün; Zielwerte (LCP ≤ 2,0 s, CLS ≤ 0,05, R01-JS ≤ 140 KB) im
      FORTSCHRITT berichtet.
    - Keine Anfrage an einen öffentlichen Lighthouse-Speicher.
  - Tests: `pnpm test:perf`, `pnpm check:bundle`, `pnpm test:e2e --grep @perf --project=pixel-7`.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P10.5 Sicherheits-Header und CSP-Audit** – T-16/AK-A-8-01 über alle Registry-Routen und die Kontexte
  `public`, `dynamic`, `checkout`, `admin`, `api` (ARCHITEKTUR §8.1); CSP-Hosts ⊆ DIENSTE-YAML je Kontext (R-131);
  Spike B-03 (`script-src` ohne `'unsafe-inline'`) entscheiden und in ARCHITEKTUR Anhang B + ADR eintragen; Kontext
  `admin` mit Nonce, Rückfall `'unsafe-inline'` nur mit `'self'`-Hosts und nur per ADR (Spike B-01);
  CSP-Verstöße (`securitypolicyviolation`) lassen E2E-Tests scheitern; HSTS nur `production`/`staging`; außerhalb von
  Produktion `X-Robots-Tag: noindex, nofollow` (AK-A-4-03); AK-A-8-02 (Admin-Pfad in keiner Datei unter `.next/static`
  und in keinem öffentlichen HTML), AK-A-8-03 (Login-Sperren); R-136 (privater Upload ohne Anmeldung 403, signierte URL
  nach Ablauf 403); `pnpm check:external --built` (EK-05), `gitleaks`, `pnpm audit --prod` ohne `critical`/`high`.
  Gibt es für einen Befund keinen Fix innerhalb von Payload 3.x bzw. Next 16.3: dokumentierte Ausnahme in
  `package.json` unter `pnpm.auditConfig.ignoreCves` (nur diese CVE-ID) plus Zeile in `docs/OFFENE-PUNKTE.md` (Paket,
  CVE, Begründung, Prüfdatum; entfernen, sobald ein Fix erscheint).
  - Akzeptanz: alle genannten AK grün; Ergebnis B-03 dokumentiert; jede `ignoreCves`-Ausnahme hat ihre
    OFFENE-PUNKTE-Zeile.
  - Tests: Erweiterung `tests/unit/security/*.unit.spec.ts` und `tests/e2e/security-headers.e2e.spec.ts`.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P10.6 Rate-Limits, Spamschutz und Datensparsamkeit** – Jeder Bucket aus ARCHITEKTUR §8.5 mit Grenzwert-Test
  (N-ter Aufruf erlaubt, N+1 → 429 mit `Retry-After` und i18n-Text am Formular); Löschung der Zähler nach 24 h durch
  den Wartungs-Job (R-134, L-13a); Honeypot und Zeitfalle; R-137/T-20 (keine Personendaten in URLs und Logs,
  Logger-Schwärzung); R-162 (Crawl: `<form>` mit Text-/E-Mail-Eingaben nur auf Kasse, Widerruf, Auftragsarbeiten);
  Upload-Grenzen und Typprüfung über den Inhalt (413 über 4,5 MB, ARCHITEKTUR §8.8).
  - Akzeptanz: alle Buckets tabellengetrieben getestet; R-134, R-137, R-162 grün.
  - Tests: `tests/int/security/rate-limits.int.spec.ts`; `tests/e2e/privacy/forms.e2e.spec.ts` (R-162).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P10.7 Wartungsmodus** – `MAINTENANCE_MODE` in `src/lib/env.ts` (+ `.env.example`), Verhalten nach ARCHITEKTUR
  §5.2/§10.5, KONZEPT R26 und RECHT R-090: öffentliche Seiten antworten 503 mit Hinweis in Juttas Ton; Impressum,
  Datenschutz, AGB, Widerrufsbelehrung und R26 „Vertrag widerrufen“ samt Fußlink bleiben erreichbar. Ist die Datenbank
  erreichbar, arbeitet die Widerrufsfunktion R26 auch im Wartungsmodus vollständig (zweistufiges Formular, Datensatz,
  Eingangsbestätigung M08 über `sendEmail` direkt nach dem Commit; R-091 bis R-093); nur wenn die Datenbank nicht
  erreichbar ist, zeigt R26 statt des Formulars den Widerruf per E-Mail (mailto an `MAIL_REPLY_TO`, mit Hinweis, dass
  der Eingang der Mail zählt). Kasse und übrige Formulare gesperrt; Stripe-Webhook 503 (Stripe wiederholt); Tick 204;
  Verwaltung erreichbar; `/api/health/freshness` 200 mit `{ "maintenance": true }`.
  - Akzeptanz:
    - Jede Regel einzeln getestet; „Vertrag widerrufen“ auch im Wartungsmodus im Fußbereich (AK-3-11).
    - R-090: im Wartungsmodus mit erreichbarer DB lässt sich ein Widerruf absenden (Datensatz + M08 im Mail-Log);
      mit simuliert unerreichbarer DB zeigt R26 den mailto-Weg und liefert kein 5xx.
  - Tests: `tests/int/maintenance.int.spec.ts`, `tests/e2e/maintenance.e2e.spec.ts`.
  - Ohne Jutta: vollständig machbar; die Regel steht als Annahme KA-30 in OFFENE-PUNKTE. P11-Nacharbeit: –

- [ ] **P10.8 Backup I: Dump und Wiederherstellung (Spike B-06)** – `src/lib/backup/dump.ts` („pcdump v1“,
  ARCHITEKTUR §10.3: `REPEATABLE READ, READ ONLY`, Tabellen aus `pg_catalog` ohne `rate_limit_hits`, COPY-Text sortiert
  nach Primärschlüssel über `pg-copy-streams`, Kopf- und Abschluss-Kommentar mit Zeilenzahl und MD5 je Tabelle,
  `setval`), Kette gzip → age (`age-encryption`) → Ziel (`--to=file:<pfad>` oder S3 per `@aws-sdk/lib-storage`),
  `src/lib/backup/restore.ts` (§10.5 Schritt 3 a–d) und Skripte `pnpm backup:run`, `pnpm backup:restore`,
  `pnpm backup:verify`; privater Schlüssel nur als Datei (`--identity`), nie als Umgebungsvariable. Spike B-06 messen
  (zehnfacher Beispielbestand < 60 s, < 512 MB) und in ARCHITEKTUR Anhang B eintragen; bei Misserfolg Rückfallebene.
  - Akzeptanz: AK-A-10-01, AK-A-10-02, AK-A-10-05; T-22-Rundlauf im `quick`-Job.
  - Tests: `tests/int/backup/roundtrip.int.spec.ts` (Wegwerf-Schlüssel per `generateIdentity()`, gegenseitige
    Fremdschlüssel, Trigger, Sequenzen); `tests/unit/backup/format.unit.spec.ts`.
  - Ohne Jutta: nur synthetische Schlüssel und Daten. P11-Nacharbeit: age-Schlüsselpaar von Jutta (P11.12).

- [ ] **P10.9 Backup II: Spiegel, Cron-Route, Status, Übung** – `src/lib/backup/mirror.ts` (§10.4), Route
  `GET /api/cron/backup` (§10.3: nur bei `APP_ENV=production` **und** `BACKUP_ENABLED=true`, sonst 404 ohne
  DB-Verbindung; Bearer `CRON_SECRET`, sonst 401; Advisory-Lock `backup`; `maxDuration = 300`), `backup-status.json` über
  `systemFiles`, Monatsstand per `CopyObject`, gedrosselte A12-Mail bei Fehlern; `backup`-Wert in
  `/api/health/freshness` (§11.3); `pnpm retention:replay` (LOESCHKONZEPT §3.6) und in der Verwaltung System → „Nach
  Wiederherstellung abgleichen“ (nur im Wartungsmodus, `src/endpoints/postRestore.ts`, §10.5 Schritt 6 a–d, inkl.
  `payments:reconcile`); `.github/workflows/restore-drill.yml` (monatlich am 1. um 04:00 UTC, `workflow_dispatch` und
  `pull_request` mit `paths` `src/lib/backup/**` und `.github/workflows/restore-drill.yml`; nur synthetische Seed-Daten,
  Wegwerf-Schlüssel im Job, `permissions: contents: read`); `BACKUP_ENABLED`,
  `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_AGE_RECIPIENT` in
  `src/lib/env.ts` und `.env.example` (leer, `BACKUP_ENABLED=false`). **Kein** Produktions-Backup über GitHub Actions
  (DIENSTE §3.11, LOESCHKONZEPT L-23, ARCHITEKTUR C-07).
  - Akzeptanz:
    - AK-A-10-03 und AK-A-10-04; Spiegel-Schlüssel sind SHA-256-Hashes ohne Dateinamen (AK-A-10-02).
    - `/api/health/freshness` meldet `backup: off` außerhalb von Produktion bzw. ohne `BACKUP_ENABLED`.
    - Die Schritte von `restore-drill.yml` laufen lokal gegen eine Wegwerf-Datenbank grün. Den ersten grünen Lauf auf
      GitHub belegt die P10-Phasen-Abnahme: über `pull_request` mit dem Phasenende-Commit (`workflow_dispatch` geht
      erst, wenn die Datei auf `main` liegt).
  - Tests: `tests/int/backup/mirror.int.spec.ts`, `tests/int/backup/cron-route.int.spec.ts` (Pool-Zähler),
    `tests/int/backup/retention-replay.int.spec.ts`.
  - Ohne Jutta: alles vorhanden, aber inaktiv. P11-Nacharbeit: Bucket `pct-backups`, Backup-Token, Empfänger-Schlüssel,
    `BACKUP_ENABLED=true` (P11.3, P11.12).

- [ ] **P10.10 Fehlerüberwachung und Monitoring (Sentry, ohne DSN inaktiv)** – `@sentry/nextjs` 11 (exakt gepinnt)
  **nur** in `instrumentation.ts`: `register()` initialisiert nur bei `NEXT_RUNTIME === 'nodejs'` und gesetztem
  `SENTRY_DSN`; `onRequestError = Sentry.captureRequestError`; Optionen nach ARCHITEKTUR §11.4 (`sendDefaultPii: false`,
  `tracesSampleRate: 0`, `maxBreadcrumbs: 20`, `beforeSend`/`beforeBreadcrumb` → `redactSentryEvent()` in
  `src/lib/monitoring/sentry.ts`); kein Browser-SDK, kein `withSentryConfig`, keine Tunnel-Route, kein Replay.
  `POST /api/client-errors` nach ARCHITEKTUR §2.5 und M-02: **standardmäßig aus** bis Kanzleifrage K-30 (c)
  beantwortet ist – aktiv nur bei `NEXT_PUBLIC_CLIENT_ERRORS_ENABLED=true` **und** `APP_ENV=production`, sonst 404
  ohne Verarbeitung und kein Client-Skript; wenn aktiv: nur first-party, Stichprobe 10 %, höchstens 1 je Seitenaufruf,
  geschwärzt, keine Cookies, keine IP-Speicherung, keine Personendaten (R-133, R-137), Rate-Limit `client_errors`
  (§8.5). `SENTRY_ENVIRONMENT` und `NEXT_PUBLIC_CLIENT_ERRORS_ENABLED` (`false`) in `env.ts` und `.env.example`;
  Einstellungen → System zeigt die Inhalte aus §11.5; Alarm-Drosselung A12 prüfen.
  - Akzeptanz: AK-A-2-05, AK-A-11-01, AK-A-11-02, AK-A-11-03, AK-A-11-04; R-133; ohne DSN keine Initialisierung und
    kein Netzwerkzugriff; mit Standardwerten enthält keine öffentliche Seite ein Fehler-Meldeskript.
  - Tests: `tests/int/monitoring/sentry.int.spec.ts` (Test-Transport), `tests/int/monitoring/client-errors.int.spec.ts`
    (Schalter aus → 404; an → Schwärzung, kein IP-Speicher); `@privacy`-Suite ohne Anfragen an Sentry-Hosts.
  - Ohne Jutta: DSN leer, Browser-Fehlermeldungen aus. P11-Nacharbeit: Sentry-Projekt in der EU, DSN in Vercel
    (P11.7); `NEXT_PUBLIC_CLIENT_ERRORS_ENABLED` erst nach der Antwort auf Kanzleifrage K-30 (c) (P11.11).

- [ ] **P10.11 Statistik (cookielos, standardmäßig aus)** – `@vercel/analytics` exakt gepinnt;
  `src/lib/analytics/AnalyticsSlot.tsx` rendert `<Analytics />` nur bei `NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'`
  **und** `APP_ENV === 'production'` **und** Einstellung `settings.analytics.enabled` mit Pflichtfeld
  `settings.analytics.confirmedAt` und Notiz `settings.analytics.note` „Kanzlei hat Kanzleifrage K-30 bestätigt“ (R-210
  Nr. 10; Felder laut DATENMODELL §7.1 seit P1 im Schema – hier nur prüfen, nicht neu anlegen). `beforeSend` verwirft Kasse,
  Warenkorb, Danke-Seite, Bestellstatus, Widerrufs-Schritte und Admin-Pfade und entfernt alle Query-Parameter; keine
  Custom Events, kein Speed Insights; bei `PREVIEW_EXPORT=true` nie. `NEXT_PUBLIC_ANALYTICS_ENABLED` in `env.ts` und
  `.env.example` (`false`).
  - Akzeptanz: R-132 (`beforeSend` mit Beispiel-URLs; Flag aus → kein Skript, keine Anfrage an `/_vercel/insights`);
    T-04 (kein Endgeräte-Speicher) und V-07 grün.
  - Tests: `tests/unit/analytics/before-send.unit.spec.ts`; `tests/e2e/privacy/analytics.e2e.spec.ts`.
  - Ohne Jutta: aus. P11-Nacharbeit: Entscheidung nach Kanzlei-Antwort (A36, P11.11).

- [ ] **P10.12 Docker-Exit-Pfad und CI-Job `docker`** – `Dockerfile` ergänzen (Ziel `migrator` auf Basis `builder`
  mit `CMD ["pnpm","payload","migrate"]`, `HEALTHCHECK` gegen `/api/health`, Kopie von `src/styles/fonts` und
  `src/og/fonts`, falls das Standalone-Tracing sie nicht erfasst); `BUILD_WITHOUT_DB=1` (Spike B-08, Ergebnis in
  Anhang B); `docker-compose.prod.yml` (caddy, app, migrate, postgres ohne veröffentlichten Port, scheduler mit
  `30 1 * * *` → `/api/cron/backup`), `deploy/Caddyfile` (TLS, `www` → Apex 308, `encode zstd gzip`, kein
  Zugriffsprotokoll), `.env.production.example` (alle Variablen aus §5 mit Docker-Werten, ohne Geheimnisse); Job
  `docker` in `ci-full.yml` (ARCHITEKTUR §6.4).
  - Akzeptanz: AK-A-13-01 (Build ohne DB und Zugangsdaten, Image ≤ 500 MB, UID 1001) und AK-A-13-02
    (`docker compose -f docker-compose.prod.yml up -d` mit Testwerten → `/api/health` 200 in ≤ 120 s, `GET /de` 200,
    Migrationen angewendet, `down -v` räumt auf).
  - Tests: CI-Job `docker`.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: – (Umzug nur mit Juttas Entscheidung, ARCHITEKTUR §13).

- [ ] **P10.13 Deploy-Vorbereitung für Vercel und Produktionsschutz** – `vercel.json` (`"regions": ["fra1"]`, Crons
  `/api/cron/tick` jede Minute und `/api/cron/backup` `30 1 * * *`, „Ignored Build Step“-Skript für Änderungen nur an
  `docs/**`, `tests/**`, `content/art/**`); Build-Befehl `pnpm payload migrate && pnpm build` im RUNBOOK. Skripte
  `pnpm db:mark-production`, `pnpm admin:create` (interaktiv, Passwort nie als Argument, verweigert ein zweites Konto,
  E-03) und `pnpm admin:unlock` vorhanden und getestet. `assertProductionEnv` vollständig (ARCHITEKTUR §4.3 inkl.
  R-181). `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` wird serverseitig gelesen und als Prop übergeben (ein Image für alle
  Umgebungen). Vor der DNS-Umstellung muss die Produktion unter `<projekt>.vercel.app` bedienbar sein: die
  Vercel-Produktions-Domain (`https://${VERCEL_PROJECT_PRODUCTION_URL}`, nur gelesen) wird bei `APP_ENV=production`
  zusätzlich in Payloads `cors`/`csrf` zugelassen (ARCHITEKTUR §8.2, C-26; canonical-URLs bleiben Apex). Stand von Spike B-01 (Admin-Pfad per Umschreibung oder Ordner-Rückfall) für P11 festhalten.
  - Akzeptanz:
    - AK-1-02, AK-A-3-02, AK-A-4-01, AK-A-4-02 grün.
    - `vercel.json` gegen ein JSON-Schema im Test geprüft; Crons zeigen nur auf Routen, die ohne Freigabe-Flags 404 bzw.
      ohne Bearer 401 liefern.
    - Liste zugelassener Origins in Produktion = Apex + Vercel-Produktions-Domain (Unit-Test).
  - Tests: `tests/unit/deploy/vercel-json.unit.spec.ts`, `tests/unit/env/production.unit.spec.ts`,
    `tests/int/admin/admin-create.int.spec.ts`.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: Produktionswert für `ADMIN_ROUTE`, ggf. Ordner-Umbenennung (B-01
    Rückfall) per PR.

- [ ] **P10.14 Startklar-Prüfung und Go-live-Sperre** – `pnpm check:golive` und Ansicht Einstellungen → System →
  „Startklar“ (grün/rot mit Erklärung in Juttas Sprache) als Vereinigung von R-210 Nr. 1–15, KONZEPT §7.16 Nr. 1–14 und
  DATENMODELL §13.7 (Speichern von `settings.shop.isOpen = true` in Produktion wird mit der Liste aller offenen Punkte
  abgelehnt; maßgeblich ist `APP_ENV`, ARCHITEKTUR §4.2). Die Ansicht ersetzt ausdrücklich den Platzhalter „Startklar
  (kommt in P10)“ unter „Heute“ (P5.28) und unter Einstellungen → System (P5.22); „Heute“ zeigt danach den Hinweis
  „Startklar-Prüfung nicht grün“ mit Link, solange ein Punkt rot ist (KONZEPT §7.3, nur Anzeige). Der Knopf „Shop
  öffnen“ der Shop-Einstellungen (P5.22a) zeigt in Produktion dieselbe Liste der offenen Punkte. Rechtstexte gelten
  nur mit aktiver Fassung `origin = lawyer` als fertig (R-210 Nr. 1–2; `origin = placeholder` ⇒ `isPlaceholder`). Die geprüften
  Einstellungsfelder liegen laut DATENMODELL §7.1/§10.1 seit P1 im Schema – hier nur prüfen, nicht neu anlegen:
  `settings.business.lucidNumber`, `settings.business.packagingScheme.name`/`.contractFrom`,
  `settings.processorAgreements[]` (`serviceId`, `signedAt`, `documentVersion`, `url`, optional `file`),
  `settings.analytics.*`, `settings.tax.confirmedAt`, Vorjahresumsatz in `settings.revenueGuard.manualYearTotals`.
  Fehlt dennoch eines, ist das eine Abweichung von P1: per eigener Migration nachziehen und DATENMODELL im selben PR
  angleichen (§10.1). Beispiel-IBAN `DE36000000000000000000` gilt als Platzhalter;
  Platzhalter-Erkennung `[`, `folgt`, `Muster`, `example`, PLZ `00000`; AVV-Liste aus der DIENSTE-YAML
  (`avv: required`, `production: true`); Fotos mit `showsPerson = jutta` ohne `ownerApproved` und Galerie ohne
  Einwilligung → rot. Prüfen, dass `check:golive` so in ARCHITEKTUR §6.10 steht.
  - Akzeptanz:
    - R-210: jede Prüfung einzeln mit Fixtures grün/rot; R-155: fehlender AVV-Eintrag → rot.
    - Trockenlauf mit `APP_ENV=production`-Simulation (Gate G5) listet genau die erwarteten roten Punkte (Rechtstexte,
      Stammdaten, IBAN, LUCID und Systembeteiligung, AVVs, Beispieldaten, Treiber, Statistik-Entscheidung, Steuer,
      harmonisierte Mitteilung) – Ausgabe in FORTSCHRITT.
    - Exit-Code ≠ 0, solange ein Punkt rot ist.
    - Keine Verwaltungsansicht zeigt mehr „kommt in P…“ (Suche wie in P8.19a); „Shop öffnen“ listet in der
      Produktions-Simulation dieselben roten Punkte wie `pnpm check:golive`.
  - Tests: `tests/unit/golive/checks.unit.spec.ts`, `tests/int/golive/shop-open-lock.int.spec.ts`; Erweiterung der
    Suche aus `tests/e2e/admin/texts-pages.e2e.spec.ts` (P8.19a) ohne Ausnahme für „kommt in P10“.
  - Ohne Jutta: bleibt absichtlich rot. P11-Nacharbeit: wird in P11.13 grün.

- [ ] **P10.15 Betriebshandbuch `docs/RUNBOOK.md`** – Kapitel: Überblick/Topologie (ARCHITEKTUR §12.1); Konfiguration
  – alle Variablen aus §5.2 je Umgebung **ohne Werte**; Deploy, Rollback, rückwärtsverträgliche Migrationen (§6.7
  Nr. 5, §6.9); Schlüsseltausch je Geheimnis (§8.9); Verfahren „Sicherheitsupdate“ (§1.3); Backups, Wiederherstellung
  Schritt für Schritt (§10.5), manuelle Übung halbjährlich (§10.6); Wartungsmodus; Alarme M-01…M-12 mit Handlungsanweisung
  (§11.2); **Datenpanne** (R-157: erkennen, bewerten, dokumentieren, Meldung an die Berliner Beauftragte für Datenschutz
  und Informationsfreiheit binnen 72 h über das Online-Formular, Benachrichtigung Betroffener, DE-Vorlagen,
  Kontaktliste der Dienstleister); Kosten-Routine (§12.3, C-01, C-04); Verweis auf `docs/GO-LIVE.md` für die
  DNS-Umstellung; Docker-Umzug (§13.3); Vorlage Vorfallprotokoll.
  - Akzeptanz:
    - Jede Variable aus `src/lib/env.ts` steht in der Konfigurationsliste; jede Alarm-ID und jedes Geheimnis aus §8.9 hat
      ein Verfahren; Befehle und Flags stimmen mit den Skripten überein; keine Geheimniswerte.
    - RECHT §7 Teil A, Punkt R-157 (Runbook-Teil) erfüllt.
  - Tests: `tests/unit/docs/runbook.unit.spec.ts` (Variablen-Vollständigkeit, M-01…M-12, Pflichtüberschriften).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: Protokolleinträge (DNS-Ist-Stand, Kosten) in P11.

- [ ] **P10.16 Go-live-Leitfaden `docs/GO-LIVE.md` (DNS-Umstellung und Start-Checkliste)** – Schritt-für-Schritt-Ablauf
  für die P11-Session mit Jutta in der Reihenfolge von P11.1–P11.17, verknüpft mit AUFGABEN A23–A41 und ANLEITUNGEN
  (S3, S4, P2, D0–D6, N1, I3, T3, Z1): wer tippt was (Jutta gibt alle Passwörter, Schlüssel, IBAN, Karten selbst ein;
  Claude zeigt nur wohin), Konten- und Ressourcenliste (ARCHITEKTUR §12.2), Variablen je Vercel-Umgebung (§4.1, §5.2),
  Datenbank-Ablauf (Migration, Beispielbestand in `main` vor dem ersten echten Auftrag, Zweige `seed-root`/`staging`/
  `preview`, `db:mark-production`), **DNS-Umstellung** mit Ist-/Soll-Tabelle aus ARCHITEKTUR §12.4 (A `@` auf den
  Vercel-Wert, AAAA `@` und A/AAAA `www` der Parkseite löschen, CNAME `www` und `staging`, ggf. TXT `_vercel`, neue
  Lettermint-Einträge; MX, SPF, IONOS-DKIM und DMARC **unverändert**), `dig`-Befehle, TTL T−1/T+7, Rückweg,
  Prüfungen AK-A-12-01/-02, Stripe-Live-Schritte, Testkauf-Drehbuch, RECHT §7 Teil B, KUNST-QA §10 Nr. 4,
  EK-08-Stoppuhr, Überwachung der ersten 7 Tage.
  - Akzeptanz:
    - Jeder P11-Schritt hat einen Abschnitt mit Prüfkriterium; keine Geheimniswerte; keine ungeprüften tiefen
      Anbieter-URLs (ANLEITUNGEN Anhang).
    - DNS-Tabellen wörtlich identisch mit ARCHITEKTUR §12.4.
  - Tests: `tests/unit/docs/golive.unit.spec.ts` (Abschnitte P11.1–P11.17 vorhanden, DNS-Tabellen = ARCHITEKTUR).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: wird in P11 abgearbeitet.

- [ ] **P10.17 Bildschirmfotos für das Handbuch** – `scripts/handbook/shots.ts` als `pnpm handbook:shots` (in
  ARCHITEKTUR §6.10 eintragen): nutzt die Ansichtsliste des Vorschau-Exports (`scripts/preview-export/adminViews.ts`)
  und nimmt mit Seed-Daten und festem `SEED_NOW` bei 390×844 (DPR 2) jede Handy-Ansicht aus KONZEPT §7.3–§7.16 sowie die
  wichtigsten Dialoge auf (Neues Stück mit Pflichtfeldern, Übersetzen, Gepackt/Versendet melden, Zahlung erhalten,
  Abholung, Offline verkauft, Widerruf erstatten, Anfrage, Flash/Galerie mit Einwilligung, Umsatz-Wächter, Export,
  Datenschutz-Anfrage, Beispieldaten entfernen, Startklar) plus drei öffentliche Seiten → WebP nach
  `docs/owner/img/handbuch/`.
  - Akzeptanz:
    - Je Bild ≤ 150 KB, zusammen ≤ 3 MB; deterministisch; nur Seed-Daten, keine Adressleiste und kein
      `ADMIN_ROUTE`-Wert im Bild.
  - Tests: `tests/unit/docs/handbook-images.unit.spec.ts` (Größen, alle referenzierten Bilder existieren).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P10.18 Handbuch für Jutta `docs/owner/HANDBUCH.md`** – Du-Form, kurz, ohne Fachjargon (Fachbegriffe im
  Halbsatz erklärt), jedes Kapitel mit Bildschirmfoto aus P10.17: Anmelden und die Verwaltung aufs Handy legen (PWA);
  „Heute“; Neues Stück (Objektnummer, Pflichtangaben je Kategorie, Fotos nach DESIGN §12.1, Übersetzen-Knopf); Meine
  Stücke, Ausblenden, Offline verkauft, Archiv-Schalter; Zu packen → Versendet; Vorkasse; Abholung; Widerrufe und
  Erstattung (14-Tage-Frist); Anfragen; Tattoo (Flash, Angebote, Galerie nur mit Einwilligung); Texte bearbeiten;
  Einstellungen; Umsatz-Wächter; Monatsexport; Datenschutz-Anfragen; **Datenpanne** (R-157, einfache Anleitung);
  Startklar; Beispieldaten; Vorschau-Datei (G6, G7, V1); Hinweis zur Barrierefreiheitspflicht (R-190: entsteht erst ab
  10 Beschäftigten oder > 2 Mio. € Umsatz/Bilanzsumme); Notfall und Hilfe (Session starten, RUNBOOK). AUFGABEN §5 und
  ANLEITUNGEN §16/§17 verlinken das Handbuch statt „kommt in P10“.
  - Akzeptanz:
    - Alle Kapitel vorhanden; alle Links und Bilder relativ und gültig; keine Aussage „barrierefrei“/„WCAG-konform“
      (V-26); RECHT §7 Teil A, Punkt R-157 (Owner-Anleitung) erfüllt.
  - Tests: `tests/unit/docs/handbook.unit.spec.ts` (Link-/Bildprüfung, Pflichtkapitel, V-26-Muster).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: Jutta liest es vor dem Start (A31).

- [ ] **P10.19 Endkontrolle Inhalte und Recht (RECHT §7 Teil A)** – Checkliste RECHT §7 Teil A vollständig abhaken und
  mit Datum in FORTSCHRITT vermerken: R-049 (harmonisierte Mitteilung mit amtlicher Vorlage verglichen oder Platzhalter
  in OFFENE-PUNKTE), R-095 (Platzhalter-Widerrufsbelehrung enthält `{{withdrawalUrl}}` und `{{phone}}`), R-156
  (`docs/recht/VVT.md` vollständig; zugleich R-210 Nr. 14), R-157 (RUNBOOK + Handbuch), R-161 (`commission.offer` als
  Platzhalter), R-190, manuelle Sichtung V-18/V-28/V-29 aller Seitentexte, FAQ, Aftercare und Mails. EK-09 erneut.
  Liegen inzwischen Instagram-Export oder Coco-Fotos im Repo: `pnpm seed:import-instagram`,
  `pnpm seed:example --refresh-media`, `pnpm art:coco-refs`, `pnpm art:vectorize` und eine KUNST-QA-Teilaufnahme
  (`--scope SC-13,SC-00`) mit Protokoll. `docs/OFFENE-PUNKTE.md` bereinigen und nach „Jutta entscheidet“, „Kanzlei“,
  „Steuerberatung“, „technisch erledigt“ sortieren.
  - Akzeptanz: alle Punkte aus RECHT §7 Teil A abgehakt; Verbotsmuster- und Paritätstests grün.
  - Tests: bestehende Suiten; `tests/unit/legal/withdrawal-placeholder.unit.spec.ts` (R-095-Token).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: RECHT §7 Teil B (P11).

- [ ] **P10.20 Finale Vorschau-Datei und Offline-Abnahmetest** – Die finale Single-File-Vorschau nach E-98:
  `pnpm preview:export` auf dem Endstand erzeugt `dist/planet-claire-vorschau.html` – die ganze Website als **eine**
  HTML-Datei (alle Seiten, Bilder, Schriften, Animationen inline, Kasse als Attrappe): alle Registry-Routen gebaut
  (kein `not-built`), alle Verwaltungsansichten als Bilder (`adminViews` alle `ok`), Banner nach KONZEPT §12.5 Nr. 8 mit
  dem Band aus R-182 „Interne Vorschau – nicht weitergeben · Beispieldaten · Rechtstexte sind Platzhalter“, Etikett
  „intern – Einwilligung fehlt“ an G1/G2. Danach `pnpm test:preview-export` (KONZEPT §12.7 Nr. 1–9, ARCHITEKTUR §14.10).
  Zusätzlich beweist ein **Portabilitätstest**, dass die Datei auf einem anderen Rechner funktioniert: Der Test kopiert
  nur `planet-claire-vorschau.html` in ein frisches Temp-Verzeichnis außerhalb des Repos, öffnet sie dort per `file://`
  in einem neuen Browser-Kontext (offline, andere Zeitzone und Sprache als der Build, z. B. `America/New_York` und
  `en-US`) und prüft Startseite, Shop, eine Produktseite, Kasse, Widerruf, Tattoo und eine Verwaltungsansicht.
  - Akzeptanz:
    - AK-12-01, EK-11, AK-A-14-01 (zwei Läufe byte-gleich), AK-A-14-02 (keine Zeichenkette `/_next/`,
      `127.0.0.1:3999`, `__next_f`, `__leash`, `/werkstatt`), AK-A-14-03 (ohne Postgres Exit 2 mit deutscher Anleitung).
    - Portabilität: aus dem Temp-Verzeichnis 0 Anfragen außer der Datei selbst und `data:`/`blob:` (auch keine
      weiteren `file:`-Zugriffe), 0 Konsolenfehler, alle Bilder und alle drei Schriftfamilien geladen; die Datei
      enthält weder `localhost`, `127.0.0.1`, `file://` noch den absoluten Build-Pfad (`process.cwd()`); jedes
      `src`/`href` ist `data:`, `blob:`, `#…` oder ein reiner Textlink nach außen.
    - Gleicher Rauchtest der kopierten Datei zusätzlich mit WebKit (Safari-Engine: Startseite, Shop, Produktseite –
      H1, 0 Anfragen, 0 Konsolenfehler); fehlt der Session WebKit, zählt der CI-Lauf.
    - R-182: Band vorhanden, keine `src=`/`href=` auf `http(s)://` außer Textlinks; nach allen Interaktionen
      `document.cookie === ''` und leerer Web-Storage.
    - Dateigröße ≤ 40 MB (harte Grenze), Ziel ≤ 20 MB (mailbar); Wert im Bericht. Liegt sie über 20 MB, ergänzt
      `release.yml` den Release-Text um den Satz „Die Datei ist zu groß für eine Mail – per Link oder USB-Stick auf
      einen anderen eigenen Rechner bringen.“ (P10.21; passt zu R-182 „nicht weitergeben“).
  - Tests: `tests/e2e/preview-export.e2e.spec.ts` (Projekte `pv-mobile`, `pv-desktop`);
    `tests/e2e/preview-portable.e2e.spec.ts` (Temp-Kopie, Chromium und WebKit, in `playwright.preview.config.ts`);
    `tests/unit/preview/r182.unit.spec.ts`.
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: –

- [ ] **P10.21 GitHub-Release „Vorschau“ (automatisch, sobald der Plan leer ist)** – `.github/workflows/release.yml`
  nach ARCHITEKTUR §6.6 und `.github/vorschau-release.json` (`tag: vorschau-p10`, `title: "Planet Claire – Vorschau
  (Stand P10)"`, `notesDe` mit Öffnen-Anleitung nach ANLEITUNGEN V1, dem Satz „Nur privat ansehen, nicht weitergeben,
  nicht veröffentlichen“ (R-182; Seed-Tattoofotos ohne Einwilligung, CLOUD-SETUP) und einer Zeile „Stand: TT.MM.JJJJ“).
  Auslöser (ARCHITEKTUR §6.6): Push auf `main` mit Änderung an `.github/vorschau-release.json`, täglicher `schedule`
  um 06:00 UTC als Rückfall und `workflow_dispatch`; `release.yml` ist der einzige Workflow, den ein Push auf `main`
  startet (Juttas Uploads nach `content/seed/instagram-export/` und `content/seed/coco/` starten keinen, AK-A-6-01).
  `permissions: contents: write`; kein `cancel-in-progress`. Ein erster, schneller Schritt (ohne Postgres und ohne
  Build) beendet den Lauf nach Sekunden, solange `bash scripts/cloud-setup.sh --plan-status` nicht `OFFEN_P1_P10=0`
  meldet oder das Release aktuell ist (Release `vorschau-p10` vorhanden und seine Zeile „Stand“ gleich der in
  `vorschau-release.json`); veröffentlicht wird nur, wenn der Plan leer ist und das Release fehlt oder veraltet ist.
  Jobs:
  1. `publish`: Postgres-Service, `pnpm preview:export`, `pnpm test:preview-export` inkl. Portabilitätstest (P10.20);
     veröffentlicht nur unter der Bedingung oben (sonst Abbruch mit deutscher Meldung „Plan noch nicht leer“ bzw.
     „Release ist aktuell“), mit `gh release create <tag> dist/planet-claire-vorschau.html --title … --notes …` bzw.
     bei vorhandenem Tag `gh release upload <tag> dist/planet-claire-vorschau.html --clobber` und aktualisierten
     Notizen; der Asset-Name bleibt `planet-claire-vorschau.html`, nicht gezippt (ANLEITUNGEN G7); SHA-256 als
     Job-Ausgabe. Ist die Datei größer als 20 MB (20.000.000 Byte), hängt `publish` an `notesDe` den Satz „Die Datei
     ist zu groß für eine Mail – per Link oder USB-Stick auf einen anderen eigenen Rechner bringen.“ an (KONZEPT §12.6;
     R-182 „nicht weitergeben“).
  2. `verify-asset` (`needs: publish`, frischer Runner, frischer Checkout ohne Postgres und ohne Build, nur
     Abhängigkeiten und Playwright-Browser): `gh release download <tag> --pattern planet-claire-vorschau.html --dir
     dist`, SHA-256 mit `publish` vergleichen, dann nur den Portabilitätstest aus P10.20 gegen die heruntergeladene
     Datei – das ist der Nachweis „läuft auf einem anderen Rechner“.
  Zusätzlich ein Probelauf bei Pull Requests, die `release.yml` oder `vorschau-release.json` ändern: nur Bauen und
  Tests, ohne Veröffentlichung und ohne `contents: write`. Jeder PR, der die finale Vorschau ändert – spätestens der PR
  mit dem Abschlussbericht (P10.22) –, aktualisiert die Zeile „Stand“ in `notesDe`, damit der Merge den Workflow
  auslöst und das Release als veraltet erkannt und neu veröffentlicht wird. Squash-Nachrichten und PR-Beschreibungen
  enthalten nie `[skip ci]` (Arbeitsregeln am Planbeginn): Die Session merged mit
  `gh pr merge --squash --subject "<PR-Titel>" --body "<Kurzfassung>"`; mergt Jutta per Knopf, nimmt GitHub Titel und
  Beschreibung des PR (Repo-Einstellung AUFGABEN A01a, OFFENE-PUNKTE J-44, CLOUD-SETUP §1). Startet der Push auf
  `main` trotzdem keinen Lauf, holt ihn der tägliche `schedule` nach; P11.1 prüft das Ergebnis.
  - Akzeptanz (vor dem Merge prüfbar, zählt für das Häkchen):
    - Probelauf im PR grün; `tests/unit/release/config.unit.spec.ts` grün (Schema der JSON-Datei, Tag `vorschau-p10`,
      Asset-Name, Hinweis-Satz vorhanden, Größen-Satz wird erst über 20 MB angehängt; Auslöser `push` auf `main` mit
      Pfad `.github/vorschau-release.json`, `schedule` `0 6 * * *` und `workflow_dispatch`; der schnelle Prüfschritt
      endet ohne Veröffentlichung bei `OFFEN_P1_P10 ≠ 0` und bei aktuellem Release); `git ls-files` enthält keine
      `planet-claire-vorschau.html`; `dist/` in `.gitignore`.
    - Link zum Release (`https://github.com/<owner>/<repo>/releases/tag/vorschau-p10`) in PR-Beschreibung, Handbuch
      und FORTSCHRITT.
  - Nach dem Merge automatisch (ohne Einfluss auf das Häkchen; prüft P11.1): AK-12-02 – Release `vorschau-p10` mit der
    HTML-Datei als Asset (nicht gezippt); `verify-asset` grün. Darf die Session mergen, wartet sie beide Jobs ab und
    prüft `gh release view vorschau-p10 --json assets`; scheitert etwas, behebt sie es per neuem Commit samt neuer
    „Stand“-Zeile. Darf sie nicht mergen: PR-Text oben „Bitte mergen – CI ist grün. Danach erscheint die Vorschau
    automatisch unter Releases.“
  - Tests: PR-Probelauf; `tests/unit/release/config.unit.spec.ts`; nach dem Merge `publish` und `verify-asset`.
  - Ohne Jutta: vollständig machbar (Veröffentlichung spätestens mit Juttas Merge-Klick, A07). P11-Nacharbeit: in
    P11.1 prüfen, dass das Release existiert und sich auf Juttas Rechner öffnen lässt.

- [ ] **P10.22 Abschlussbericht für Jutta und Anhalten** – Abschluss nach CLAUDE.md §8, in dieser Reihenfolge:
  1. `docs/FORTSCHRITT.md` um den Abschlussbericht ergänzen (Deutsch, du-Form, ohne Fachjargon), mit genau diesen
     Teilen: was fertig ist; wie sie die Vorschau-Datei öffnet (Link zum Release `vorschau-p10`, ANLEITUNGEN G7/V1, auf
     jedem Rechner offline, nur privat ansehen); welche Punkte aus `docs/OFFENE-PUNKTE.md` sie entscheiden sollte
     (priorisiert, je Punkt ein Satz); was sie vor dem Start erledigen kann (AUFGABEN §3: A23–A32); was in P11
     gemeinsam passiert (AUFGABEN §4: A33–A41 und `docs/GO-LIVE.md`) und was nach dem Start folgt (A42–A50). Ist das
     KUNST-QA-Bündel aus P9 abgelaufen, `art-qa.yml` neu auslösen (`workflow_dispatch`, sobald die Datei auf `main`
     liegt, sonst Label `art` am PR mit dem Phasenende-Commit aus Schritt 4) und den Video-Link nach dem Lauf
     aktualisieren (KUNST-QA §8).
  2. Zeile „Stand“ in `.github/vorschau-release.json` aktualisieren (löst nach dem Merge P10.21 aus).
  3. Alle erfüllten Checkboxen von P10 abhaken, auch diese Aufgabe. Offen bleiben nur die Abnahme-Punkte „CI grün“,
     `--plan-status` und „PR-Beschreibung“; sie folgen nach dem grünen Lauf (Schritt 5).
  4. Phasenende-Commit `chore(P10): finish phase [ci:full p10]`, Push, alle Läufe abwarten: `ci.yml`, `ci-full.yml`
     (inkl. `docker`), `preview-export.yml`, Probelauf `release.yml` und `restore-drill.yml` (über `pull_request`).
  5. Nach dem grünen Lauf: PR-Beschreibung final (Deutsch, Release-Link, offene Punkte; darf die Session nicht mergen,
     oben „Bitte mergen – CI ist grün. Danach erscheint die Vorschau automatisch unter Releases.“), dann ein reiner
     Doku-Commit mit `[skip ci]` (nur `PLAN.md`, `docs/FORTSCHRITT.md`, `docs/OFFENE-PUNKTE.md`), der die drei
     offenen Abnahme-Punkte abhakt. Danach `bash scripts/cloud-setup.sh --plan-status`: die Ausgabe zeigt
     `OFFEN_P1_P10=0` und „(P1–P10 erledigt)“.
  6. Mergen (squash, Nachricht ohne `[skip ci]`, siehe P10.21), wenn die Rechte es erlauben, und P10.21 nach dem Merge
     prüfen.
  7. Zum Schluss erneut `bash scripts/cloud-setup.sh --plan-status` ausführen (letzte Ausgabe im Verlauf mit
     `OFFEN_P1_P10=0`, CLOUD-SETUP §4.3), dann **anhalten**: kein Schritt aus P11, keine Konten, keine Geheimnisse.
  - Akzeptanz (für das Häkchen in Schritt 3):
    - Der Bericht enthält alle Teile aus CLAUDE.md §8 Nr. 2; OFFENE-PUNKTE ist sortiert („Jutta entscheidet“,
      „Kanzlei“, „Steuerberatung“, „technisch erledigt“) und aktuell.
    - Zeile „Stand“ aktualisiert; alle übrigen P10-Checkboxen außer den drei Abnahme-Punkten aus Schritt 3 abgehakt.
  - Nach dem grünen Lauf (Phasen-Abnahme): Lauf des Phasenende-Commits grün; `--plan-status` zeigt `OFFEN_P1_P10=0`;
    PR gemergt oder oben „Bitte mergen – CI ist grün“.
  - Nach dem Merge automatisch (ohne Checkbox; prüft P11.1): Release `vorschau-p10` mit `planet-claire-vorschau.html`
    (P10.21, auch wenn Jutta mergt); die Session hat angehalten.
  - Tests: `--plan-status`-Ausgabe; `tests/unit/docs/final-report.unit.spec.ts` (Abschlussbericht vorhanden, enthält
    Release-Link, die Überschriften der Pflichtteile und A23–A41).
  - Ohne Jutta: vollständig machbar. P11-Nacharbeit: Jutta liest Bericht und offene Punkte (A30, A31) und legt den
    Start-Termin fest (A32).

### Phasen-Abnahme

- [ ] Alle Aufgaben P10.1–P10.22 abgehakt; Gate G5 erfüllt, soweit vor dem Merge prüfbar (G3 + PR-Probelauf von
  `release.yml` + Startklar-Trockenlauf mit `APP_ENV=production`-Simulation, ARCHITEKTUR §7.9).
- [ ] `pnpm check`, `pnpm test:int`, `pnpm build`, `pnpm test:e2e`, `pnpm test:visual`, `pnpm test:perf`,
  `pnpm test:coverage` lokal grün.
- [ ] EK-01, EK-04, EK-05, EK-07, EK-09, EK-11 durch Tests belegt; R-001 mit `LEGAL_TRACE_PHASE = 10` grün.
- [ ] Finale Vorschau `dist/planet-claire-vorschau.html` besteht Offline- und Portabilitätstest (P10.20); keine
  HTML-Vorschau im Repository.
- [ ] Doku vollständig: `docs/RUNBOOK.md`, `docs/GO-LIVE.md`, `docs/owner/HANDBUCH.md`, ARCHITEKTUR §6.10 und Anhang B
  (B-03, B-06, B-08 mit Ergebnis), `.env.example` und `.env.production.example` aus `src/lib/env.ts` konsistent.
- [ ] `docs/FORTSCHRITT.md` mit Abschlussbericht nach CLAUDE.md §8, `docs/OFFENE-PUNKTE.md` aktuell.
- [ ] CI grün: Phasenende-Commit `chore(P10): finish phase [ci:full p10]` → `ci.yml`, `ci-full.yml` (inkl. `docker`),
  `preview-export.yml` und der Probelauf von `release.yml` grün; `restore-drill.yml` (über `pull_request`) und
  `art-qa.yml` (Label `art` oder `workflow_dispatch`) je einmal grün. Dieses Häkchen setzt erst der Doku-Commit mit
  `[skip ci]` nach dem grünen Lauf (P10.22 Schritt 5, ARCHITEKTUR §6.7).
- [ ] `bash scripts/cloud-setup.sh --plan-status` zeigt `OFFEN_P1_P10=0` (auch als letzte Ausgabe vor dem Anhalten).
- [ ] PR-Beschreibung aktualisiert; gemergt oder oben „Bitte mergen – CI ist grün“.

Nach dem Merge automatisch (ohne Checkbox; prüft P11.1):

- `release.yml` veröffentlicht die Vorschau als Release `vorschau-p10` (Asset `planet-claire-vorschau.html`, nicht
  gezippt) – ausgelöst durch den Push auf `main`, sonst spätestens durch den täglichen `schedule` –; `publish` und
  `verify-asset` grün (Gate G5, zweiter Teil; bei eigenem Merge mit `gh release view` geprüft).
- Die Session hat angehalten; P11 wird nicht autonom begonnen.

## P11 – Go-live gemeinsam mit Jutta

**Ziel:** Die Seite geht unter https://planetclairetattoos.com live – zusammen mit Jutta, in der Reihenfolge von
`docs/GO-LIVE.md`, AUFGABEN §3/§4 und ANLEITUNGEN Z1. Dies ist die **einzige** Phase mit echten Konten; sie wird nicht
von der autonomen Cloud-Session ausgeführt. Grundregel: Jutta meldet sich überall selbst an und gibt Passwörter,
Schlüssel, Verbindungsadressen, IBAN, Ausweis- und Kartendaten **selbst** in die Formulare der Anbieter, in die
geschützten Vercel-Variablen („Sensitive“) und in die Verwaltung ein; Befehle mit Zugangsdaten führt sie in ihrem
eigenen Terminal aus. Claude sagt, wo sie klicken muss, prüft Ergebnisse, die keine Geheimnisse zeigen, und behebt
Fehler per Pull Request mit grüner CI. Am Ende sind Konten verbunden, Rechtstexte der Kanzlei eingespielt,
Beispieldaten entfernt, Startklar grün, DNS umgestellt, Stripe live, ein echter Testkauf mit Widerruf und Erstattung
bestanden, Backups und Überwachung aktiv.

**Voraussetzungen:** P10 abgeschlossen; Release `vorschau-p10` vorhanden (fehlt es, holt P11.1 es nach). AUFGABEN
A01–A32 erledigt – insbesondere
Kanzleitexte vollständig in Text- und HTML-Form (A08, A28), Steuerdaten und W-IdNr. (A11), Telefonnummer (A12),
Einwilligungen (A13), LUCID-Registrierung und Verpackungslizenz (A14, A15), Nickel-Nachweise (A17), Glasur-Entscheidung
(A18), Stripe verifiziert und PayPal verbunden (A23, A24), alle Konten angelegt (A25), Stammdaten und Bankverbindung
(A26), IONOS-Bildschirmfotos (A27), erste echte Stücke vorbereitet (A29), Vorschau und offene Punkte gelesen (A30,
A31), Termin (A32). Jutta hat ca. 5–6 Stunden am Computer, ggf. auf zwei Termine verteilt, ihr Handy daneben; die Mail-DNS-Einträge (P11.5) liegen
mindestens einen Tag vor der DNS-Umstellung.

**Referenzen:** E-02, E-05, E-20…E-24, E-40…E-47, E-63, E-91…E-99; R-002, R-012, R-020, R-021, R-022, R-049, R-132,
R-155, R-156, R-172, R-180, R-200, R-203, R-204, R-205, R-210, R-211, RECHT §7 Teil B; KONZEPT §1.4 (EK-08, EK-10),
§7.14–§7.16, §9.7, §11.3; DATENMODELL §7.1, §13.5, §13.7; ARCHITEKTUR §1.3, §4.1, §4.3, §4.7, §4.8, §5.2, §8.9, §10,
§11, §12 (vollständig), Anhang C (C-01…C-04, C-06, C-16, C-17); DESIGN –; KUNST-QA §10 Nr. 4; DIENSTE §3, §6;
LOESCHKONZEPT §3.6, §3.7, §7; AUFGABEN A23–A50; ANLEITUNGEN S3, S4, P2, D0–D6, N1, I3, T3, E1, M1–M3, L1, L2, Z1, Z2;
`docs/GO-LIVE.md`, `docs/RUNBOOK.md`.

### Aufgaben

- [ ] **P11.1 Startbesprechung und Unterlagen-Check** – Mit Jutta `docs/GO-LIVE.md` durchgehen; Status von A23–A32
  (AUFGABEN §3) prüfen; die Punkte prüfen, die die P10-Abnahme „nach dem Merge automatisch“ nennt: der P10-PR ist
  gemergt (sonst merged Jutta ihn jetzt), `release.yml` lief mit `publish` und `verify-asset` grün und das Release
  `vorschau-p10` hat das Asset `planet-claire-vorschau.html` (fehlt es trotz des täglichen `schedule`-Rückfalls,
  den letzten `release.yml`-Lauf auf `main` ansehen – z. B. meldete er „Plan noch nicht leer“ –, die Ursache beheben
  und `release.yml` per `workflow_dispatch` auf `main` starten), die autonome Session hat nach dem
  Abschlussbericht angehalten (keine späteren Commits von ihr, keine P11-Checkbox abgehakt); dann prüfen, dass sich
  die Datei auf Juttas Rechner öffnen lässt (A30, ANLEITUNGEN G7/V1); jede Zeile in `docs/OFFENE-PUNKTE.md`
  entscheiden (umsetzen per PR oder bewusst so lassen), darunter die SE-Punkte des Beispielbestands und die Adressfrage (Kanzleifrage K-39); Juttas
  Vorschau-Anmerkungen (A30) als Liste aufnehmen und per PR umsetzen; prüfen, dass die Kanzleitexte vollständig sind
  (alle sechs Typen, Bausteine „Kanzlei: ja“ aus RECHT §6, ggf. EN-Fassungen), LUCID-Nummer und Verpackungslizenz
  vorliegen (A14, A15, R-200), W-IdNr./Steuernummer/Telefon/IBAN bereitliegen (R-205); Ergebnis der optionalen
  Markenrecherche (R-204) in OFFENE-PUNKTE. Nachgelieferte Materialien: Instagram-Export/Coco-Fotos →
  `pnpm seed:import-instagram`, `pnpm art:coco-refs`, `pnpm art:vectorize` und Coco-Nachschärfen als Nach-Session planen.
  - Akzeptanz:
    - Release `vorschau-p10` mit dem Asset `planet-claire-vorschau.html` vorhanden, `verify-asset` grün
      (`gh release view vorschau-p10 --json assets`); die Datei öffnet sich auf Juttas Rechner.
    - Jede OFFENE-PUNKTE-Zeile hat einen Status; Änderungen gemergt (CI grün) oder mit Juttas Zustimmung verschoben.
    - Go/No-Go mit Datum in FORTSCHRITT; fehlende Pflichtunterlagen sind als Blocker benannt.
  - Tests: CI der Korrektur-PRs.
  - Ohne Jutta: nicht möglich. Claude bereitet die Liste der offenen Punkte und Anmerkungen vor.

- [ ] **P11.2 Konten prüfen und absichern** – Gemeinsam die Konten aus A25/ANLEITUNGEN D0–D6 durchgehen: überall 2FA
  mit offline aufbewahrten Wiederherstellungscodes (E-94); Sentry-Datenregion EU; Neon-Region `aws-eu-central-1`,
  Postgres 17; Cloudflare R2 aktiviert, Domain **nicht** bei Cloudflare; Lettermint Free; DeepL API Free (nicht Pro);
  Vercel Pro, Team „Planet Claire“; Stripe verifiziert, PayPal verbunden. GitHub: „Dependabot security updates“ an
  (ARCHITEKTUR §1.3); bis hierher liefen nur Sicherheits-Updates (`open-pull-requests-limit: 0` für Versions-Updates) –
  jetzt per PR die Versions-Updates mit dem Wert aus ARCHITEKTUR §1.3 und das automatische Mergen
  (`dependabot-automerge.yml`) einschalten; Entscheidung GitHub Pro für Branch-Schutz (C-03).
  - Akzeptanz: Konten-Checkliste in `docs/GO-LIVE.md` abgehakt; kein Geheimnis in Chat, Repo oder PR
    (`gitleaks` grün).
  - Tests: –
  - Ohne Jutta: nicht möglich.

- [ ] **P11.3 Cloudflare R2 einrichten** – Sieben Buckets mit **EU-Jurisdiktion**, nicht öffentlich, ohne `r2.dev`-URL:
  `pct-media-prod`, `pct-private-prod`, `pct-media-staging`, `pct-private-staging`, `pct-media-preview`,
  `pct-private-preview`, `pct-backups`; API-Tokens `pct-app-prod`, `pct-app-staging`, `pct-app-preview`, `pct-backup`
  (je nur Object Read & Write auf die genannten Buckets); Lebenszyklus `pct-backups` (`db/daily/` 30 Tage,
  `db/monthly/` 365 Tage, unvollständige Multipart-Uploads 1 Tag); Bucket-Sperren soweit verfügbar (C-06);
  Benachrichtigung „Billing usage“ (ARCHITEKTUR §12.2, §12.3).
  - Akzeptanz: Endpunkt endet auf `.eu.r2.cloudflarestorage.com`; Token-Umfang in der Oberfläche geprüft; Werte nur in
    Juttas Passwort-Manager.
  - Tests: später `assertProductionEnv` (S3-Prüfung) beim ersten Produktionsstart.
  - Ohne Jutta: nicht möglich.

- [ ] **P11.4 Neon-Datenbank vorbereiten** – Projekt `planetclairetattoos`, Datenbank `planetclaire`, Postgres 17,
  `aws-eu-central-1`, Scale-to-zero nach 5 min. Jutta führt in ihrem Terminal (Verbindungsadressen nur in ihrer Shell)
  aus: `pnpm payload migrate`, danach `pnpm seed` mit `APP_ENV=staging`, leerem `SEED_NOW` und **ohne**
  `SEED_ADMIN_*` gegen `main` – nur vor dem ersten echten Auftrag, Datenbank noch nicht markiert (ARCHITEKTUR §4.7:
  Startinhalt für die Übernahme der Seitentexte). Dann Zweig `seed-root` aus `main`, Zweige `staging` und `preview` aus
  `seed-root` (erlaubt der Tarif keine weiteren Zweige: gemeinsamer Zweig `staging`). Wiederherstellungsfenster des
  Tarifs im RUNBOOK notieren (C-16).
  - Akzeptanz: `pnpm seed:remove` (ohne `--yes`) zeigt in `main` die Mengen aus SEED-SPEC §0.1; Zweige vorhanden; keine
    Produktionsdaten in Preview/Staging (DIENSTE §3.3).
  - Tests: –
  - Ohne Jutta: nicht möglich.

- [ ] **P11.5 Lettermint und Mail-DNS (spätestens T−1, besser T−7)** – Domain `planetclairetattoos.com` in Lettermint;
  deren DKIM- und Return-Path-Einträge bei IONOS **nur hinzufügen** (MX, SPF, IONOS-DKIM, DMARC unverändert, E-95);
  SMTP-Zugang je Umgebung; Absender `shop@planetclairetattoos.com`, Antwort an `jutta@planetclairetattoos.com`;
  Datenverarbeitungsvertrag abschließen. Am Tag vor der Umstellung die TTL von `@` (A, AAAA) und `www` auf den kleinsten
  IONOS-Wert setzen und den Ist-Stand als Bildschirmfoto im RUNBOOK-Protokoll vermerken (ARCHITEKTUR §12.4 T−1).
  - Akzeptanz:
    - Testmail an `jutta@planetclairetattoos.com` kommt im IONOS-Postfach an; Kopfzeilen zeigen `dkim=pass` und
      `dmarc=pass`.
    - `dig` für MX, SPF-TXT, die drei IONOS-DKIM-CNAMEs und `_dmarc` liefert exakt den Ist-Stand (AK-A-12-01, Teil 1).
  - Tests: –
  - Ohne Jutta: nicht möglich.

- [ ] **P11.6 Stripe einrichten (Live und Test)** – Zahlarten-Konfiguration: Karte, Apple Pay, Google Pay, PayPal; kein
  Klarna, keine SEPA-Lastschrift, kein Link (E-20, R-062); PayPal in Stripe aktiv (A24); eingeschränkter Live-Schlüssel
  `rk_live_…` bzw. `sk_live_…` und `pk_live_…`; Webhook-Endpunkt Produktion zunächst auf
  `https://<projekt>.vercel.app/api/stripe/webhook` (die URL wird in P11.14 auf die Apex-Domain geändert, das Geheimnis
  bleibt), Staging-Endpunkt im Testmodus mit „Protection Bypass for Automation“; beide mit der gepinnten API-Version und
  den Ereignissen aus DATENMODELL §8.8; DPA-Datum notieren.
  - Akzeptanz: Endpunkte angelegt; Schlüssel nur bei Jutta; Zahlarten-Konfiguration entspricht E-20.
  - Tests: Test-Ereignis an den Staging-Endpunkt nach P11.8 → 200.
  - Ohne Jutta: nicht möglich.

- [ ] **P11.7 Sentry einrichten** – Organisation in der EU-Region, Projekt `planetclairetattoos`; „Prevent Storing of IP
  Addresses“ an; Data Scrubber an mit Zusatzfeldern `email`, `token`, `iban`; kürzeste Aufbewahrung (L-14);
  Alarmregeln M-01 (neues Problem, Rückfall) und M-02 (> 20 Ereignisse/h; wirkt erst, wenn die Browser-Fehlermeldungen
  nach Kanzleifrage K-30 (c) eingeschaltet sind, P11.11); Uptime-Monitore für `GET /api/health` und
  `GET /api/health/freshness` alle 5 min, Alarm nach 2 Fehlschlägen (M-07, C-04); DPA akzeptieren; DSN für Produktion und
  Staging.
  - Akzeptanz: Einstellungen laut ARCHITEKTUR §11.4 gesetzt; Uptime-Monitore aktiv, sobald die Domain umgestellt ist.
  - Tests: nach P11.8 ein absichtlich ausgelöster Serverfehler auf Staging erscheint ohne Personendaten.
  - Ohne Jutta: nicht möglich.

- [ ] **P11.8 Vercel-Projekt, Umgebungsvariablen und Kostenbremse (A33)** – Repo importieren; Pro, Region `fra1`
  (`vercel.json` + Projekteinstellung), Node 24.x, Fluid Compute; Build `pnpm payload migrate && pnpm build`;
  Umgebungen Production (`main`), Staging (Branch `staging`, `staging.planetclairetattoos.com` folgt in P11.14),
  Preview (PRs). Variablen je Umgebung nach ARCHITEKTUR §4.1/§5.2 – Jutta fügt alle Geheimnisse selbst als „Sensitive“
  ein (`DATABASE_URL` gepoolt, `DATABASE_URL_UNPOOLED`, `PAYLOAD_SECRET` und `CRON_SECRET` selbst erzeugt, `S3_*`,
  `SMTP_*`, `STRIPE_*`, `DEEPL_API_KEY`, `SENTRY_DSN`); nicht geheim: `APP_ENV`, `NEXT_PUBLIC_SITE_URL=
  https://planetclairetattoos.com`, `ADMIN_ROUTE` (Produktionswert: 6–40 Zeichen, nicht `/admin`/`/werkstatt`; bei
  B-01-Rückfall Ordner-Umbenennung per PR), `STORAGE_DRIVER=s3`, `EMAIL_DRIVER=smtp`, `PAYMENTS_DRIVER=stripe`,
  `TRANSLATION_DRIVER=deepl`, `SEED_PREVIEW_MODE=false` (Produktion) bzw. `true` (Staging/Preview),
  `MAIL_REDIRECT_ALL_TO` (Staging), `JOBS_AUTORUN=false`, `DB_POOL_MAX=5`, `NEXT_PUBLIC_ANALYTICS_ENABLED=false`,
  `NEXT_PUBLIC_CLIENT_ERRORS_ENABLED=false` (bis P11.11), `BACKUP_ENABLED=false` (bis P11.12). Deployment Protection für Preview/Staging; Spend Management: On-Demand-Budget
  10 USD, Benachrichtigungen 50/75/100 %, „Pause production deployment“ nach Juttas Entscheidung (Standard aus, C-02);
  keine Log Drains, Toolbar und Speed Insights aus.
  - Akzeptanz:
    - Produktions-Deployment unter `<projekt>.vercel.app` startet (`assertProductionEnv` ohne Verstoß); `/api/health`
      200; `/api/health?deep=1` mit Bearer ok; Staging nur mit Vercel-Anmeldung erreichbar.
    - Kein Geheimnis in Repo, PR oder Chat.
  - Tests: Deployment-Protokoll; `curl` auf `/api/health` (ohne Geheimnis).
  - Ohne Jutta: nicht möglich.

- [ ] **P11.9 Staging-Abnahme durch Jutta (AUFGABEN A33a)** – Staging mit Beispielbestand, Stripe-Testmodus und
  `MAIL_REDIRECT_ALL_TO=jutta@planetclairetattoos.com`. Jutta prüft am Laptop und am Handy – Link per DM an sich
  selbst, im Instagram-In-App-Browser auf iPhone und Android – nach ANLEITUNGEN V2 und KUNST-QA §10 Nr. 4 („Ist das
  Coco?“, „Bewegung reduzieren“ am Handy), Testkauf mit einer veröffentlichten Stripe-Testkarte (tippt sie selbst),
  Vorkasse, Abholung, Widerruf, Verwaltungsabläufe am Handy; Stoppuhr-Test „Neues Stück ≤ 3 min“ (EK-08). Befunde per PR
  beheben (CI grün, merge, Staging neu). Textkorrekturen nicht auf Staging (gingen verloren), sondern in P11.10 in der
  Produktion.
  - Akzeptanz: Juttas OK mit Datum und EK-08-Messwert in FORTSCHRITT; alle Blocker behoben.
  - Tests: CI der Korrektur-PRs.
  - Ohne Jutta: nicht möglich.

- [ ] **P11.10 Produktion befüllen (A34)** – Unter `<projekt>.vercel.app`, Shop geschlossen
  (`settings.shop.isOpen = false` bis P11.15): Jutta legt mit `pnpm admin:create` in ihrem Terminal das einzige Konto an
  (E-03) und trägt in der Verwaltung ein: Stammdaten (Name, Anschrift nach der Kanzlei-Antwort zu Kanzleifrage K-39,
  E-Mail, Telefon R-021, Steuernummer, W-IdNr. bzw. USt-IdNr. E-46; Steuernummer wird nicht veröffentlicht), Bezirk des
  Privatstudios, Abhol-Vorlage, Kontoinhaberin/IBAN/BIC, LUCID-Nummer und Systembeteiligung
  (`settings.business.lucidNumber`, `settings.business.packagingScheme`; R-200), Standard-Verpackungen nach dem ersten
  Wiegen (`settings.packaging`, KA-29, DM-08), Steuer-Bestätigung und Vorjahresumsatz (`settings.tax.confirmedAt`,
  `settings.revenueGuard.manualYearTotals`; R-205, E-45), Rechtstexte der Kanzlei für alle sechs Typen (DE, ggf. EN;
  `origin = lawyer`) und die Bausteine „Kanzlei: ja“, harmonisierte Mitteilung als amtliche Grafik (R-049),
  Nickel-Nachweise, Glasur-Erklärungen oder alles „Deko“ (E-15, E-17), technische Unterlagen je Produktart (R-203),
  Einwilligungen für Galerie-Fotos (A13, R-172), erste echte Stücke mit eigenen Nummern (A29), Seitentexte und FAQ
  gegenlesen und anpassen (Übernahme). Außerdem legt Jutta die Verwaltung als Web-App auf ihr Handy (P5.29,
  Handbuch-Kapitel „Anmelden und die Verwaltung aufs Handy legen“).
  - Akzeptanz:
    - Rechtsseiten ohne Platzhalter-Banner; Impressum mit W-IdNr. und ohne Steuernummer; Startklar-Punkte zu
      Stammdaten, Rechtstexten, IBAN, LUCID und Steuer grün.
    - Die Verwaltung ist als Web-App auf Juttas Handy installiert; der Start öffnet „Heute“ (`ADMIN_ROUTE/heute`), die
      Anmeldung klappt.
  - Tests: Startklar-Ansicht; Web-App-Start auf Juttas Handy.
  - Ohne Jutta: nicht möglich.

- [ ] **P11.11 Auftragsverarbeitung und Statistik-Entscheidung (A35, A36)** – AVVs nach DIENSTE §6 (Vercel, Neon,
  Cloudflare, Stripe, Lettermint, IONOS, Sentry) abschließen und unter Einstellungen → Auftragsverarbeitung eintragen
  (`settings.processorAgreements`, R-155); `docs/recht/VVT.md` an Jutta zur Aufbewahrung (R-156); Log-Aufbewahrung der
  Anbieter in DIENSTE.md nachtragen (LOESCHKONZEPT §7). Statistik (A36, R-132): nur mit Kanzlei-Bestätigung zu
  Kanzleifrage K-30 einschalten (`settings.analytics.enabled` + `settings.analytics.confirmedAt` + Notiz,
  `NEXT_PUBLIC_ANALYTICS_ENABLED=true`, neu deployen), sonst bewusst „aus“ dokumentieren. Browser-Fehlermeldungen
  (`NEXT_PUBLIC_CLIENT_ERRORS_ENABLED=true`, ARCHITEKTUR §2.5) nur, wenn die Kanzlei Kanzleifrage K-30 (c) bejaht hat;
  sonst bleiben sie aus (Standard).
  - Akzeptanz: R-210 Nr. 6 und Nr. 10 grün; Stand beider Schalter mit Datum und Grund in FORTSCHRITT.
  - Tests: Startklar-Ansicht.
  - Ohne Jutta: nicht möglich.

- [ ] **P11.12 Backups aktivieren (AUFGABEN A36a)** – Jutta erzeugt offline auf ihrem Rechner ein age-Schlüsselpaar; der private
  Schlüssel kommt in ihren Passwort-Manager und auf Papier, **nie** nach Vercel, GitHub oder in den Chat. Öffentlichen
  Schlüssel als `BACKUP_AGE_RECIPIENT`, Token `pct-backup` als `BACKUP_S3_*`, `BACKUP_S3_BUCKET=pct-backups`,
  `BACKUP_ENABLED=true` (nur Produktion), neu deployen. Ersten Lauf abwarten (01:30 UTC) oder von Jutta mit Bearer
  anstoßen lassen; `pnpm backup:verify --key=<key>` in ihrem Terminal; halbjährliche Wiederherstellungsübung im RUNBOOK
  terminieren.
  - Akzeptanz: Backup-Objekt beginnt mit `age-encryption.org/v1` (AK-A-10-02); `/api/health/freshness` meldet
    `backup: ok`.
  - Tests: `backup:verify`.
  - Ohne Jutta: nicht möglich.

- [ ] **P11.13 Beispieldaten entfernen, Startklar grün, Datenbank markieren (A41)** – In der Verwaltung „Beispieldaten
  entfernen“ mit „Seitentexte und FAQ behalten“ (die Sperre ist nach P11.10 gelöst); Bericht prüfen (entfernte Verweise,
  G1/G2 gelöscht, sofern nicht mit Einwilligung übernommen). Startklar-Ansicht vollständig grün (R-210, KONZEPT §7.16);
  danach `pnpm db:mark-production` in Juttas Terminal (ARCHITEKTUR §4.8) und Markierung per SQL-Abfrage prüfen.
  - Akzeptanz: 0 Dokumente mit `seed = true` (R-180, LOESCHKONZEPT §3.7); Startklar alle Punkte grün;
    Datenbank-Kommentar `planetclaire:production` gesetzt.
  - Tests: Startklar-Ansicht; Mengenvorschau `seed:remove` zeigt 0.
  - Ohne Jutta: nicht möglich.

- [ ] **P11.14 DNS-Umstellung bei IONOS (A37)** – T0 werktags vormittags nach `docs/GO-LIVE.md` und ARCHITEKTUR §12.4:
  in Vercel die Domains `planetclairetattoos.com` (primär), `www.planetclairetattoos.com` (308 auf Apex) und
  `staging.planetclairetattoos.com` (Branch `staging`) hinzufügen; bei IONOS ggf. zuerst auf „eigene DNS-Einträge“
  umstellen, ohne Mail-Einträge anzutasten; A `@` auf den Vercel-Wert, AAAA `@` der Parkseite löschen, A/AAAA `www`
  löschen, CNAME `www` und `staging` anlegen, ggf. TXT `_vercel`; warten, bis `dig +short A planetclairetattoos.com
  @1.1.1.1` den Vercel-Wert liefert und Vercel „Valid Configuration“ mit Zertifikat zeigt. Stripe-Webhook auf
  `https://planetclairetattoos.com/api/stripe/webhook` umstellen, Test-Ereignis senden; Payment-Method-Domains
  `planetclairetattoos.com` und `staging.planetclairetattoos.com` registrieren (Apple Pay). Rückweg laut GO-LIVE bereit.
  Danach legt Jutta die Web-App einmal neu von `https://planetclairetattoos.com` aufs Handy und entfernt die unter
  `<projekt>.vercel.app` angelegte aus P11.10.
  - Akzeptanz:
    - AK-A-12-01 (MX, SPF, IONOS-DKIM, `_dmarc` exakt wie vorher; Testmail kommt an) und AK-A-12-02
      (`http://` → 308 `https://`, `www` → 308 Apex, Zertifikat gültig, HSTS vorhanden, keine AAAA-Antwort mit
      IONOS-Adresse).
    - Stripe-Test-Ereignis an die neue URL → 200.
  - Tests: `dig`- und `curl -I`-Prüfungen aus GO-LIVE.
  - Ohne Jutta: nicht möglich.

- [ ] **P11.15 Shop öffnen und echter Testkauf (A38, A39, R-211)** – `settings.shop.isOpen = true` (die Go-live-Sperre
  lässt es jetzt zu); an der Kasse erscheinen Karte, Apple Pay, Google Pay, PayPal und Vorkasse. Jutta kauft mit ihrer
  eigenen Karte (tippt sie selbst) ein eigens dafür angelegtes, günstiges echtes Stück; prüft Bestellbestätigung mit
  PDFs (Rechnung `RE-…` im echten Nummernkreis) und Kopfzeilen `spf`/`dkim`/`dmarc` = pass; widerruft über „Vertrag
  widerrufen“ und erhält sofort die Eingangsbestätigung; erstattet in der Verwaltung (Stripe-Erstattung + Gutschrift
  `GS-…`). Zusätzlich im Browser: keine Cookies vor „In den Korb“, keine Fremd-Requests außer Stripe auf der Kasse,
  Fußbereich-Links, Impressum. RECHT §7 Teil B vollständig abhaken, Datum in FORTSCHRITT. Hinweis an Jutta: die
  Stripe-Gebühr (ca. 1 €) wird nicht erstattet.
  - Akzeptanz: R-211 vollständig; Beleg und Gutschrift lückenlos nummeriert; `email-log` ohne `failed`; EK-04 und EK-05
    am echten System bestätigt.
  - Tests: manuelle Checkliste RECHT §7 Teil B.
  - Ohne Jutta: nicht möglich.

- [ ] **P11.16 Instagram-Bio und Geräte-Check (A40, R-022)** – Links nach ANLEITUNGEN I3 setzen
  (`https://planetclairetattoos.com` „Shop & Tattoo“, `https://planetclairetattoos.com/impressum` „Impressum“; die
  Weiterleitung auf `/de/impressum` funktioniert); beide Links aus dem Profil antippen. Startseite, Shop, Produktseite
  und Danke-Seite im Instagram-In-App-Browser auf iPhone und Android ansehen; einen Kurzlink `/nr/<nummer>` testen.
  - Akzeptanz: beide Bio-Links öffnen die richtigen Seiten; R-022 abgehakt; Befunde als Nacharbeit notiert.
  - Tests: –
  - Ohne Jutta: nicht möglich.

- [ ] **P11.17 Nach dem Start: Überwachung und Nacharbeiten** – Erste 7 Tage täglich: Sentry-Probleme,
  `/api/health/freshness` (`jobs: ok`, `backup: ok`), `email-log` ohne `failed`, Stripe-Webhooks ohne Fehler,
  Vercel-Nutzung. T+7: TTL bei IONOS zurück auf den Standard. Nach dem ersten vollen Monat: Kosten aller Dienste ≤ 25 €
  im RUNBOOK-Protokoll (AK-A-12-03, EK-10), Neon-CU-h zur Monatsmitte (C-01), R2-Nutzung. Jährliche
  Rechtstext-Erinnerung gesetzt (R-014), Verfahren für Dependabot-Sicherheits-PRs (RUNBOOK), Termin der ersten
  Wiederherstellungsübung. Mit Jutta AUFGABEN §5 (A42–A50) einmal durchgehen und je Punkt das passende
  Handbuch-Kapitel zeigen (Packen und Versand, Vorkasse, Widerrufe mit 14-Tage-Frist, Monatsexport und Umsatz-Wächter,
  jährliche Verpackungsmeldung bis 1. Juni, jährliche Rechtstext-Prüfung, Einwilligungen, Datenschutz-Anfragen und
  Datenpanne, Kosten). Nacharbeiten: Coco-Nachschärfen bei neuen Fotos (E-75), Neu-Vektorisierung nach
  Instagram-Export, offene Punkte aus OFFENE-PUNKTE. FORTSCHRITT: „Die Seite ist live seit …“.
  - Akzeptanz: Überwachungsliste für 7 Tage abgehakt; A42–A50 mit Jutta besprochen (Datum in FORTSCHRITT);
    Kostennachweis nach dem ersten Monat; OFFENE-PUNKTE aktuell.
  - Tests: –
  - Ohne Jutta: Überwachung teilweise durch eine spätere Session möglich (nur Lesen, keine Produktionsgeheimnisse);
    Konten-Einsicht nur mit Jutta.

### Phasen-Abnahme

- [ ] AUFGABEN A23–A41 von Jutta abgehakt; A42–A50 mit ihr besprochen; `docs/GO-LIVE.md` vollständig durchlaufen.
- [ ] RECHT §7 Teil B vollständig mit Datum; Startklar (R-210) in Produktion grün; Rauchtest R-211 bestanden.
- [ ] AK-A-12-01 und AK-A-12-02 nach der Umstellung erfüllt; Testmail im IONOS-Postfach.
- [ ] Backups: drei aufeinanderfolgende erfolgreiche Nächte; `/api/health/freshness` 200.
- [ ] Sentry-Alarme und Uptime-Monitore aktiv; Vercel-Kostenbremse eingerichtet; Dependabot-Sicherheitsupdates an,
  Versions-Updates und automatisches Mergen aktiv (P11.2).
- [ ] `docs/FORTSCHRITT.md` mit „live“-Eintrag; `docs/OFFENE-PUNKTE.md` und RUNBOOK-Protokoll (DNS-Ist-Stand, Kosten)
  aktualisiert – ohne Geheimnisse.
- [ ] Nach dem ersten vollen Monat: AK-A-12-03 / EK-10 (≤ 25 €) belegt.
