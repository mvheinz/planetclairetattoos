# Cloud-Setup: Claude Code in der Cloud (P1–P10)

> **Stand:** 26.09.2026. Alle Plattform-Fakten wurden an diesem Tag gegen die offizielle Doku geprüft (Liste mit Quellen: §7).
> **Für wen:** §1–§2 für Jutta (du-Form, ohne Technik-Vorwissen). §3–§6 für die Cloud-Sessions (Agenten).
> **Rangfolge:** `docs/ENTSCHEIDUNGEN.md` (v. a. E-97, E-99) und `CLAUDE.md` gehen dieser Datei vor.
> **Dazugehörige Dateien:** `scripts/cloud-setup.sh` (Setup + Start-Hook + Diagnose), `.claude/settings.json` (Hook, Rechte).

## Inhalt

1. [Einmalige Einrichtung (Jutta, ca. 15 Minuten)](#1-einmalige-einrichtung-jutta-ca-15-minuten)
2. [Arbeit starten und fortsetzen (Jutta)](#2-arbeit-starten-und-fortsetzen-jutta)
3. [So funktioniert die Cloud-Umgebung (Agenten)](#3-so-funktioniert-die-cloud-umgebung-agenten)
4. [Fortschritt, Abbrüche, lange Sessions (Agenten)](#4-fortschritt-abbrüche-lange-sessions-agenten)
5. [Fehlerbehebung](#5-fehlerbehebung)
6. [Änderungen an dieser Einrichtung](#6-änderungen-an-dieser-einrichtung)
7. [Geprüfte Fakten und Quellen](#7-geprüfte-fakten-und-quellen)

---

## 1. Einmalige Einrichtung (Jutta, ca. 15 Minuten)

Das machst du **ein einziges Mal**. Danach arbeitet Claude allein in der Cloud – also auf einem Rechner von Anthropic,
nicht auf deinem Laptop. Du kannst ihn zuklappen.

**Das brauchst du:**

- dein Claude-Abo **Pro oder Max**. Die Cloud-Arbeit zählt zu deinem normalen Kontingent; der Cloud-Rechner kostet
  nichts extra. Für viele Stunden am Stück ist Max angenehmer.
- dein GitHub-Konto und das private Repository `planetclairetattoos` (Repository = Projektordner auf GitHub). Das legt
  die lokale P0-Session mit dir an (Anleitung G1 in `docs/owner/ANLEITUNGEN.md`).

**Schritte:**

1. **Repository prüfen.** Öffne `https://github.com/<dein-github-name>/planetclairetattoos`. Du siehst die Ordner `docs`,
   `scripts`, `src` und die Datei `CLAUDE.md`, und neben dem Namen steht „Private“. Fehlt etwas: Sag der lokalen Session
   „Bitte alles auf GitHub hochladen“.
2. **Einstellung fürs Zusammenführen (einmalig).** „Zusammenführen“ (englisch *merge*) heißt: Claudes fertige Arbeit
   kommt in den Hauptstand. Mit dieser Einstellung übernimmt GitHub beim Zusammenführen nur Titel und Beschreibung –
   so startet danach zum Beispiel die fertige Vorschau zuverlässig. Nur du kannst sie setzen.
   1. Auf der Seite deines Repositorys oben auf **Settings** (Zahnrad) klicken. In schmalen Fenstern oder am Handy
      steckt **Settings** hinter den drei Punkten **…**.
   2. Links ist **General** schon ausgewählt. Nach unten scrollen bis zum Abschnitt **Pull Requests**.
   3. Häkchen bei **Allow squash merging** setzen (falls es noch fehlt).
   4. Direkt darunter ist ein Auswahlknopf; er zeigt anfangs **Default message**. Darauf klicken und
      **Default to pull request title and description** wählen.
   5. GitHub speichert das sofort: Neben **Allow squash merging** erscheint kurz ein grünes Häkchen. Einen
      Speichern-Knopf gibt es nicht. Die anderen Einstellungen lässt du, wie sie sind.
3. **Claude-GitHub-App installieren.** Damit darf Claude dein privates Repository lesen und Arbeitsstände hochladen.
   Öffne <https://github.com/apps/claude/installations/new> → dein Konto wählen → **Only select repositories** →
   `planetclairetattoos` wählen → **Install**. GitHub zeigt vorher eine Liste mit Rechten (Code, Pull Requests,
   Workflows …). Das ist normal. Ausführlich: Anleitung G2 in `docs/owner/ANLEITUNGEN.md`.
4. **Claude Code im Browser mit GitHub verbinden.** Öffne <https://claude.ai/code> und melde dich an. Fragt die Seite
   nach GitHub: auf **Sign in with GitHub** bzw. **Authorize** klicken. Danach bist du wieder auf claude.ai/code.
   Claude legt dabei selbst eine Umgebung „Default“ an. Die lässt du in Ruhe.
5. **Umgebung „planetclaire“ anlegen.** Eine Umgebung sind die Einstellungen für den Cloud-Rechner.
   Auf claude.ai/code in der Zeile **über** dem Eingabefeld auf das **Wolken-Symbol** mit dem Namen der aktuellen
   Umgebung klicken (meist „Default“) → **Add cloud environment**. Dann ausfüllen:
   1. **Name:** `planetclaire`
   2. **Network access:** **Custom** wählen. In das Feld **Allowed domains** den **Block A** (unten) einfügen.
      Das Häkchen **Also include default list of common package managers** **setzen**.
   3. **Environment variables:** den **Block B** (unten) einfügen.
   4. **Setup script:** den **Block C** (unten) einfügen.
   5. **Create environment** klicken.
6. **Schlüssel: nichts tun.** Bis zum Go-live (P11) läuft alles mit Attrappen. Trag **niemals** echte Zugangsdaten
   (Stripe „live“, Passwörter, Bankdaten) in die Umgebung ein: Alle, die die Umgebung benutzen, können sie lesen.
   Einen Stripe-**Test**-Schlüssel kannst du freiwillig geben, am besten als „API credential“ (§3.9).
7. **Fertig.** Weiter mit §2.1. Der allererste Start dauert ein paar Minuten länger, weil der Cloud-Rechner einmal
   eingerichtet wird. Danach geht es schneller.

Zum Kopieren: Jeden Block mit der Maus markieren (oder auf GitHub rechts oben am Block auf das Kopier-Symbol klicken)
und genau so einfügen.

**Block A – Allowed domains** (eine Adresse pro Zeile):

```text
cdn.playwright.dev
playwright.download.prss.microsoft.com
playwright.azureedge.net
registry.npmjs.org
nodejs.org
api.stripe.com
files.stripe.com
js.stripe.com
api-free.deepl.com
payloadcms.com
nextjs.org
react.dev
playwright.dev
vitest.dev
gsap.com
next-intl.dev
pnpm.io
docs.stripe.com
docs.github.com
cli.github.com
developer.mozilla.org
www.w3.org
www.gesetze-im-internet.de
eur-lex.europa.eu
```

**Block B – Environment variables** (keine Geheimnisse, nur Entwicklungswerte):

```text
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/planetclaire
DATABASE_URL_TEST=postgres://postgres:postgres@127.0.0.1:5432/planetclaire_test
PAYLOAD_SECRET=dev-only-cloud-planetclaire-not-a-secret-0000
SEED_PREVIEW_MODE=true
STORAGE_DRIVER=local
EMAIL_DRIVER=file
PAYMENTS_DRIVER=mock
TRANSLATION_DRIVER=mock
PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
NEXT_TELEMETRY_DISABLED=1
BASH_DEFAULT_TIMEOUT_MS=300000
BASH_MAX_TIMEOUT_MS=1200000
```

**Block C – Setup script** (ein kurzer Starter; die eigentliche Arbeit macht `scripts/cloud-setup.sh` im Repository):

```bash
#!/bin/bash
# planetclaire: startet scripts/cloud-setup.sh aus dem geklonten Repository (docs/CLOUD-SETUP.md, Block C).
# Endet immer mit 0 - was hier nicht klappt, erledigt der SessionStart-Hook beim Start der Session.
f=""
for d in "$PWD" "$HOME" /home /root /workspace /workspaces /code /repo /repos /srv /mnt /tmp; do
  [ -d "$d" ] && [ "$d" != "/" ] || continue
  f="$(find "$d" -maxdepth 4 -path '*/scripts/cloud-setup.sh' -not -path '*/node_modules/*' 2>/dev/null | xargs -r grep -l 'planetclaire' 2>/dev/null | head -n 1)"
  [ -n "$f" ] && break
done
if [ -n "$f" ]; then
  echo "planetclaire: starte $f"
  bash "$f" --provision || true
else
  echo "planetclaire: scripts/cloud-setup.sh nicht gefunden - der SessionStart-Hook richtet alles beim Start ein."
fi
exit 0
```

Wozu die Einträge gut sind (für Neugierige und für Agenten):

| Eintrag | Zweck | Pflicht? |
|---|---|---|
| `cdn.playwright.dev`, `playwright.download.prss.microsoft.com` | Test-Browser (Chromium, WebKit) für die automatischen Klick-Tests. Nicht in der Standardliste. | ja |
| `playwright.azureedge.net` | Alter Download-Ort; Playwright 1.58 nutzt ihn nicht mehr. Schadet nicht. | nein |
| `registry.npmjs.org`, `nodejs.org` | Pakete bzw. Node 24. Stehen schon in der Standardliste; doppelt schadet nicht und hilft, falls das Häkchen fehlt. | ja |
| `api.stripe.com`, `files.stripe.com`, `js.stripe.com` | Nur für einen späteren Stripe-**Test**modus (§3.9). Bis P11 ungenutzt. | nein |
| `api-free.deepl.com` | Nur mit DeepL-Schlüssel; sonst läuft der Übersetzen-Knopf mit Attrappe. | nein |
| `payloadcms.com` … `eur-lex.europa.eu` | Nur **Lesen** von Handbüchern und Gesetzestexten (Payload, Next.js, React, Playwright, Vitest, GSAP, next-intl, pnpm, Stripe, GitHub, MDN, W3C/WCAG, gesetze-im-internet.de, EUR-Lex). | empfohlen |
| `fonts.googleapis.com`, `fonts.gstatic.com` | Stehen in der Standardliste, werden aber **nicht** benutzt: Schriften kommen aus npm (`@fontsource/*`, E-43/E-79). | – |
| Block B | Datenbank der Cloud-VM, Attrappen statt echter Dienste (E-97, CLAUDE.md §2), Ort der Test-Browser, längere Befehls-Zeitlimits (§3.7). Namen wie in `.env.example` bzw. `docs/ARCHITEKTUR.md` §5.2. | ja |
| Block C | Sucht `scripts/cloud-setup.sh` im frisch geklonten Repository und führt es aus. Vorteil: Ändert sich das Skript, musst du nichts neu einfügen. | ja (leer lassen geht auch, §5) |

---

## 2. Arbeit starten und fortsetzen (Jutta)

### 2.1 Start (erste Session)

1. Öffne <https://claude.ai/code> (oder in der Claude-App den Tab **Code**, oder in der Desktop-App **Cloud** statt
   **Local**).
2. Unter dem Eingabefeld: Repository **planetclairetattoos**, Branch **main**. Nur dieses **eine** Repository wählen.
3. Über dem Eingabefeld (Wolken-Symbol): Umgebung **planetclaire**.
4. Modus-Auswahl neben dem Eingabefeld: **Auto**. Dann fragt Claude nicht bei jedem Befehl nach. Gibt es „Auto“ nicht,
   nimm **Accept edits** (dann kann Claude ab und zu auf dein OK warten, §2.3).
5. **Erste Nachricht – die Ziel-Zeile.** Einfügen und abschicken. Sie sorgt dafür, dass Claude nach einer Phase nicht
   stehen bleibt, sondern weitermacht, bis alles erledigt ist. Antwortet die Session, dass sie `/goal` nicht kennt, ist
   das nicht schlimm – einfach mit Schritt 6 weitermachen.

```text
/goal Alle Aufgaben von P1 bis P10 in PLAN.md sind nach CLAUDE.md erledigt: Die letzte Ausgabe von `bash scripts/cloud-setup.sh --plan-status` im Verlauf zeigt OFFEN_P1_P10=0, der Abschlussbericht nach CLAUDE.md §8 steht in docs/FORTSCHRITT.md, und der letzte Pull Request ist gemergt oder trägt oben „Bitte mergen – CI ist grün“. Ebenfalls erfüllt, wenn Claude einen Blocker gemeldet hat, den nur Jutta lösen kann (oben im Pull Request und in docs/OFFENE-PUNKTE.md). Fehlende Schlüssel, Konten oder Material von Jutta sind laut CLAUDE.md §2 kein Blocker.
```

6. **Zweite Nachricht – der Kickoff-Text.** Gleich danach schicken, auch wenn Claude schon arbeitet:

```text
Lies CLAUDE.md und halte dich genau daran. Arbeite PLAN.md ab der ersten offenen Aufgabe ab – Phase für Phase, bis alle Aufgaben von P1 bis P10 abgehakt sind. P11 fängst du nicht an.
Frag mich nichts: Alles steht in docs/. Ist etwas wirklich offen, nimm die vorsichtigste Variante und trag sie in docs/OFFENE-PUNKTE.md ein.
Lies zuerst die Zusammenfassung „Cloud-Umgebung“ vom Session-Start und geh nach docs/CLOUD-SETUP.md §4.2 vor: Arbeit früherer Sessions, die noch nicht in main ist, übernimmst du, bevor du weitermachst.
Nach jeder Aufgabe: Tests und pnpm check lokal, Häkchen in PLAN.md, Eintrag in docs/FORTSCHRITT.md, commit mit [skip ci] und push.
Nach jeder Phase: Beschreibung des Pull Requests aktualisieren und CI grün machen. Ich erlaube dir ausdrücklich, deinen eigenen Pull Request gegen main per Squash zu mergen, sobald alle CI-Prüfungen für den letzten Commit ohne [skip ci] grün sind und danach nur Notizen in PLAN.md, docs/FORTSCHRITT.md und docs/OFFENE-PUNKTE.md folgen (docs/ARCHITEKTUR.md §6.7) – das gilt für jede Phase. Als Merge-Nachricht nimmst du den Titel und eine Kurzfassung; [skip ci] steht nie in der Merge-Nachricht, im Titel oder in der Beschreibung des Pull Requests. Klappt das Mergen nicht, schreib oben in den Pull Request „Bitte mergen – CI ist grün“ und mach trotzdem mit der nächsten Phase weiter.
Nie: Force-Push, Änderungen an Repository-Einstellungen oder Secrets, echte Schlüssel oder Konten.
Wenn P10 fertig ist: Abschluss nach CLAUDE.md §8, dann bash scripts/cloud-setup.sh --plan-status ausführen und anhalten.
```

Mehr musst du nicht tun. Claude meldet sich mit einer kurzen Übersicht und legt los.

**Abkürzung (freiwillig):** Speichere dir diesen Link als Lesezeichen. Er öffnet claude.ai/code gleich mit dem
richtigen Repository und der richtigen Umgebung. Ersetze vorher `DEIN-GITHUB-NAME` durch deinen GitHub-Namen:
`https://claude.ai/code?environment=planetclaire&repositories=DEIN-GITHUB-NAME/planetclairetattoos`

### 2.2 Fortsetzen

| Situation | Was du tust |
|---|---|
| Die Session steht still (z. B. Nutzungslimit erreicht, Fehler, Claude hat angehalten) | In **derselben** Session schreiben: `Weiter nach CLAUDE.md und PLAN.md ab der ersten offenen Aufgabe. Frag mich nichts.` Hat Claude vorher „Goal cleared“ gemeldet, schick zuerst noch einmal die `/goal`-Zeile aus §2.1. |
| Die Session ist weg, kaputt oder sehr alt | Alte Session **archivieren** (in der Seitenleiste mit der Maus drüber → Archiv-Symbol). Dann eine **neue** Session wie in §2.1 starten, mit **derselben** `/goal`-Zeile und **demselben** Kickoff-Text. Es geht nichts verloren: Alles Wichtige steht im Repository, und die neue Session macht an der ersten offenen Aufgabe weiter. |
| Du bist unsicher | Neue Session wie oben. |

**Wichtig:** Immer nur **eine** Session gleichzeitig an diesem Projekt arbeiten lassen. Sonst kommen sich die beiden
in die Quere.

### 2.3 Was du zwischendurch tun kannst (alles freiwillig)

- **Mitlesen:** In der Session siehst du, was Claude macht. Kurzfassung pro Phase: der Pull Request auf GitHub unter
  **Pull requests** (Pull Request = Vorschlag für Änderungen) und die Datei `docs/FORTSCHRITT.md`.
- **Merge klicken:** Steht oben im Pull Request „Bitte mergen – CI ist grün“: Pull Request öffnen → unten am grünen
  Knopf über den kleinen Pfeil **Squash and merge** wählen → klicken → den vorgeschlagenen Text so lassen (dank der
  Einstellung aus §1 Schritt 2 sind das Titel und Beschreibung) → **Confirm squash and merge**. Mehr nicht. Claude
  arbeitet ohnehin weiter. Steht unten statt des grünen Hakens gar keine Prüfung, ist das auch in Ordnung: Claude prüft
  nur am Ende jeder Phase auf GitHub und schreibt danach nur noch Notizen, die keine Prüfung brauchen.
- **Claude wartet auf dein OK** (vor allem im Modus Accept edits): Ein Kästchen fragt, ob ein Befehl laufen darf.
  Erlaube ihn. Passiert das oft, starte die nächste Session im Modus **Auto**.
- **Vorschau ansehen (ab P2):** GitHub → **Actions** → oberster grüner Lauf → unten bei **Artifacts** die Datei
  `planet-claire-vorschau-…` herunterladen → ZIP entpacken → die HTML-Datei doppelklicken. Im Namen steht die Phase
  (z. B. `p3`). Eine neue Datei gibt es am Ende jeder Phase. Jede Datei bleibt 30 Tage liegen, es bleiben nur die 3
  neuesten. Ausführlich: Anleitung G6 in `docs/owner/ANLEITUNGEN.md`.
  **Nur für dich:** Die Vorschau zeigt Beispiel-Tattoofotos von Kund:innen ohne Einwilligung. Schau sie dir nur privat
  an, gib sie nicht weiter und veröffentliche sie nicht.
- **Fragen, die Claude für später sammelt:** `docs/OFFENE-PUNKTE.md`. Die gehen wir in P11 gemeinsam durch.

### 2.4 Übergang von P0 (lokal) in die Cloud

Zuerst schließt die lokale P0-Session P0 ab, committet alles und pusht `main` auf GitHub. Du machst §1, falls noch nicht
geschehen. Danach gibt es zwei **gleichwertige** Wege (Anleitung G3 in `docs/owner/ANLEITUNGEN.md` sagt dasselbe):

1. **Neue Cloud-Session (Standard):** wie in §2.1, mit Repository **planetclairetattoos**, Branch **main** (dem gepushten
   Stand) und Umgebung **planetclaire**, danach Ziel-Zeile und Kickoff-Text. Die neue Session liest alles aus dem
   Repository; von der lokalen Session braucht sie nichts.
2. **„Continue in“ aus der Desktop-App:** In der lokalen Session unten rechts in der Sitzungsleiste auf das VS-Code-Symbol
   → **Continue in** → **Claude Code on the Web**. Die App pusht den Branch, schreibt eine Zusammenfassung und startet
   damit eine Cloud-Session. Voraussetzung: keine uncommitteten Änderungen. Gleichwertig ist das nur, **wenn dabei die
   Umgebung planetclaire gewählt ist**: Fragt die App nach der Umgebung, wähl **planetclaire**. Danach wie in §2.1
   Modus **Auto** einstellen und Ziel-Zeile und Kickoff-Text schicken. So prüfst du, ob es geklappt hat: Claude nennt in
   der ersten Antwort die Übersicht „Cloud-Umgebung“ (Postgres, erste offene Aufgabe). Fehlt sie, die Session
   archivieren und Weg 1 nehmen.

Danach arbeitet die lokale Session nicht mehr weiter. Es arbeitet immer nur **eine** Session am Projekt (§2.2).

Für Geübte gibt es noch das **Terminal:** In Claude Code einmal `/remote-env` eingeben und `planetclaire` wählen. Dann in
der Shell `claude --cloud "<Kickoff-Text>"`. Die Cloud klont den **gepushten** Stand des aktuellen Branches, nicht deine
lokalen Dateien. Die `/goal`-Zeile schickst du danach in der Session auf claude.ai/code.

---

## 3. So funktioniert die Cloud-Umgebung (Agenten)

### 3.1 Ablauf beim Start einer Cloud-Session

1. Anthropic startet eine frische VM (Ubuntu 24.04, x86_64, ca. 4 vCPU / 16 GB RAM / 30 GB Platte) und klont das
   Repository (gewählter Branch).
2. **Setup-Skript** der Umgebung (Block C → `bash scripts/cloud-setup.sh --provision`, als root). Es läuft nur, wenn
   kein Umgebungs-Cache existiert: beim ersten Start, nach einer Änderung von Setup-Skript oder Allowlist und nach ca.
   7 Tagen. Sonst startet die VM vom Snapshot (Dateien ja, laufende Prozesse nein). Resume führt es nie erneut aus.
3. Netzwerk nach Umgebungsstufe (hier: Custom + Standardliste).
4. Claude Code startet und führt den **SessionStart-Hook** aus `.claude/settings.json` aus (Anlässe `startup`, `resume`,
   `clear`, `compact`, `fork`): `bash "$CLAUDE_PROJECT_DIR"/scripts/cloud-setup.sh --session-start`. Der Hook tut nur
   etwas, wenn `CLAUDE_CODE_REMOTE=true` (nur in Cloud-Sessions gesetzt); lokal endet er sofort. Claudes erste Antwort
   wartet, bis der Hook fertig ist.
5. Die Ausgabe des Hooks steht als Abschnitt **„## Cloud-Umgebung“** in deinem Kontext: Versionen, Postgres-Status,
   Abhängigkeiten, Playwright, aktueller Branch, Branches mit Commits, die nicht in `main` sind, offene PRs, offene
   PLAN-Checkboxen P1–P10 und die erste offene Aufgabe, Warnungen. Details: `/tmp/planetclaire-session-start.log`.
   Fehlt der Abschnitt: `bash scripts/cloud-setup.sh --session-start` selbst ausführen (in der Cloud ist
   `CLAUDE_CODE_REMOTE=true` bereits gesetzt).

### 3.2 Wer macht was

| Schritt | Setup-Skript (`--provision`) | SessionStart-Hook (`--session-start`) |
|---|---|---|
| Wann | nur beim Cache-Aufbau; Budget 270 s (Cache nur bei < ca. 5 min) | jede Session inkl. Resume und nach Kompaktierung; Budget 1080 s (Hook-Timeout 1200 s) |
| Node 24 | lädt `node-v24.21.0-linux-x64.tar.xz` von nodejs.org, prüft SHA-256, entpackt nach `/opt/node-v24.21.0-linux-x64`, Symlink `/opt/node24` | installiert nach, falls fehlend; setzt `PATH=/opt/node24/bin:…` für alle späteren Bash-Befehle (über `CLAUDE_ENV_FILE`) |
| pnpm | `corepack enable` + `corepack install -g pnpm@<packageManager>`; Fallback `npm i -g` | prüft Version, repariert bei Bedarf |
| Postgres 16 | startet, setzt Passwort `postgres`, legt `planetclaire` und `planetclaire_test` an, **stoppt** wieder (sauberer Snapshot) | startet den Dienst, prüft den Login beider DBs, legt Rolle/DBs bei Bedarf an |
| Playwright | `npx playwright@<Version aus package.json> install --with-deps chromium`, danach `webkit`, falls noch ≥ 90 s Budget; Ziel `/opt/ms-playwright` | `pnpm exec playwright install chromium` und `webkit` (schnell, wenn vorhanden; `--with-deps` nur, wenn der Marker `.planetclaire-deps-ok-<browser>` fehlt). WebKit scheitert → `PW_SKIP_WEBKIT=1` für die Session |
| Abhängigkeiten | wärmt den pnpm-Store mit `pnpm fetch` auf einer **Kopie** von `package.json`/`pnpm-lock.yaml` vor (fasst das Repo nicht an) | `pnpm install --frozen-lockfile --prefer-offline`, nur wenn `node_modules` fehlt oder sich Lockfile/package.json geändert haben (Hash in `node_modules/.planetclaire-deps-hash`) |
| `.env` | – | legt `.env` aus `.env.example` an bzw. ergänzt neue Schlüssel (überschreibt nie Werte) |
| Session-Variablen | – | über `CLAUDE_ENV_FILE`: `PATH`, `PLAYWRIGHT_BROWSERS_PATH`, `NEXT_TELEMETRY_DISABLED`, corepack ohne Rückfrage, `GH_REPO=<owner>/<repo>` (aus der origin-URL, damit `gh` auch hinter dem Git-Proxy das Repo kennt), ggf. `PW_SKIP_WEBKIT=1` |
| Git/GitHub | – | `git fetch` aller Branches (bei flachem Klon `--unshallow`); listet Branches mit Commits, die nicht in `main` stecken (erkennt Squash-Merges); offene PRs per REST |
| PLAN.md | – | zählt offene Checkboxen je Phase (wie `--plan-status`) |
| Ende | immer Exit 0 (sonst startet keine Session); Probleme als „WARNUNG“ | immer Exit 0; Warnungen stehen in der Zusammenfassung |

Weitere Modi: `bash scripts/cloud-setup.sh --check` (Diagnose, ändert nichts) und
`bash scripts/cloud-setup.sh --plan-status` (offene/gesamte Checkboxen je Phase, Zeile `OFFEN_P1_P10=<n>`, erste offene
Aufgabe; läuft auch lokal).

**Format von `PLAN.md`, auf das `--plan-status` sich verlässt:**

- Phasenüberschrift `## P<n> – <Titel>` (Gedankenstrich U+2013), z. B. `## P3 – Shop-Schaufenster`. Auch `Phase <n>`
  am Anfang einer Überschrift zählt.
- Aufgabe als Checkbox mit Kennung am Textanfang, fett: `- [ ] **P<n>.<m> <Titel>** – Beschreibung`
  (z. B. `- [ ] **P3.4 Produktseite** – …`). Die Kennung legt die Phase fest (`P3.4`, `P3-04` und `P3.10` → P3).
- Eingerückte Unterpunkte (Akzeptanzkriterien) ohne Checkbox zählen nicht. Eingerückte Unterpunkte **mit** Checkbox
  zählen zur Phase darüber.
- `### Phasen-Abnahme` je Phase: Die Checkboxen darunter haben keine Kennung und zählen zur letzten Phasenüberschrift.
  Andere Überschriften ohne `P<n>` am Anfang (z. B. `## Übersicht`) ändern die Phase nicht; Tabellen zählen nie.
- `## P0 – …` (alles `[x]`) und `## P11 – …` (Go-live mit Jutta) werden angezeigt, aber **nicht** mitgezählt:
  `OFFEN_P1_P10` ist die Summe der offenen Checkboxen von P1 bis P10. `ERSTE_OFFENE_AUFGABE` ist die erste offene
  Checkbox aus P1–P10; sind die erledigt, steht davor „(P1–P10 erledigt)“.
- Checkboxen in Codeblöcken zählen mit. Beispiele im Format-Abschnitt von `PLAN.md` deshalb nie als Checkbox-Zeile mit
  echter Kennung schreiben (sonst bleibt `OFFEN_P1_P10` nie 0).
- `[x]` und `[X]` gelten als erledigt; Windows-Zeilenenden (CRLF) stören nicht.

Getestet am 26.09.2026 mit Beispieldateien in diesem Format (gawk, auch im POSIX-Modus): P0 0/5, P1 4/6, P2 3/3,
P3 3/4, P10 2/2, P11 3/3 → `OFFEN_P1_P10=12`, erste offene Aufgabe `P1 – Fundament → **P1.3 Job-Wecker** – …`; mit
P1–P10 erledigt und P11 offen → `OFFEN_P1_P10=0`. Wer das Format ändert, passt `plan_status_raw()` im Skript an und
testet erneut.

### 3.3 Vorinstalliert und Abweichungen zur CI

| Werkzeug | In der Cloud-VM | CI (GitHub Actions) / lokal | Folge |
|---|---|---|---|
| Node | 20, 21, 22 unter `/opt/node20…22`, 22 im PATH; **wir** installieren 24.21.0 nach `/opt/node24` | `.nvmrc` = 24 | Meldet der Hook „Node v22 aktiv“: `export PATH=/opt/node24/bin:$PATH`. `engines` erlaubt ≥ 22.12, läuft also auch mit 22. |
| pnpm | vorinstalliert (Version nicht dokumentiert); wir aktivieren `10.34.5` | `packageManager: pnpm@10.34.5` | – |
| PostgreSQL | **16**, läuft nicht von selbst (`service postgresql start`) | **17** (`postgres:17-alpine`) | Nur SQL, das auf 16 **und** 17 läuft (ARCHITEKTUR §1). Maßgeblich ist die CI. |
| Docker | `docker`, `docker compose` vorhanden | lokal: `docker-compose.yml` (Postgres 17 + Mailpit) | In der Cloud nicht nötig. Bei Bedarf `docker compose up -d postgres` statt PG 16 (vorher `service postgresql stop`, Port 5432). Images von Docker Hub sind erlaubt (Standardliste). |
| Browser | Playwright-Chromium und -WebKit in `/opt/ms-playwright` (durch uns); scheitert die WebKit-Installation, setzt der Hook `PW_SKIP_WEBKIT=1` (Projekt `iphone-15` dann als markierte Chromium-Emulation, ARCHITEKTUR §7.3) | CI installiert selbst und führt WebKit **immer** aus | WebKit-Fehler zeigt spätestens die CI; maßgeblich ist die CI |
| Sonstiges | `git`, `gh`, `jq`, `yq`, `rg`, `tmux`, Redis 7 (ungenutzt), Befehl `check-tools` (Versionsübersicht) | – | – |

### 3.4 Netzwerk

- Aller Verkehr aus der VM geht über einen Sicherheits-Proxy. Erlaubt: Block A + Standardliste (Paket-Registries,
  GitHub, Ubuntu-Spiegel, Docker Hub, nodejs.org …). GitHub läuft über einen eigenen Proxy und ist immer erreichbar.
- **Nicht** erreichbar (Absicht bis P11): Vercel, Neon, Cloudflare-Konto-APIs, Lettermint, Sentry, IONOS.
- `WebSearch` läuft über Anthropic und funktioniert immer. `WebFetch` holt Seiten selbst; nimm an, dass nur Hosts aus
  Block A und der Standardliste gehen (Doku-Domains stehen in Block A).
- **Wenn ein Host blockiert ist:** nicht umgehen (keine anderen Spiegel, kein Abschalten von TLS-Prüfungen, kein
  Einbetten fremder Dateien aus Umwegen). Mit Mock/Fixture weiterarbeiten und in `docs/OFFENE-PUNKTE.md` eintragen:
  „Domain X in Umgebung planetclaire freigeben (Block A in docs/CLOUD-SETUP.md ergänzen)“. Die Umgebung kann nur Jutta
  ändern; Block A in dieser Datei darfst du per PR ergänzen.

### 3.5 GitHub: Branch, Push, Pull Request, Merge

- Die Session arbeitet auf ihrem **eigenen Arbeitsbranch** (von der Session vorgegeben, meist `claude/…`). `git push`
  geht **nur** auf diesen Branch (GitHub-Proxy). Klonen, Fetchen und PR-Operationen funktionieren normal.
- `gh` braucht keinen Login: `GH_TOKEN` enthält den Platzhalter `proxy-injected`, der Proxy setzt das echte Token ein.
  Der Hook setzt `GH_REPO`, damit `gh` das Repository auch dann kennt, wenn `origin` auf eine Proxy-Adresse zeigt.
  Nicht jede GraphQL-Abfrage ist freigeschaltet. Bei
  `403 … This GraphQL query is not enabled for this session` die REST-Form nehmen: `gh api repos/{owner}/{repo}/…`
  (`{owner}`/`{repo}` ersetzt `gh` selbst aus `GH_REPO`).
- **CI-Disziplin (ARCHITEKTUR §6.7 Nr. 2, §6.8):** Vor jedem Commit lokal `pnpm check`, `pnpm test:int`, betroffene
  E2E-Tests, bei UI-Änderungen `pnpm build`. Zwischen-Commits tragen `[skip ci]` (`feat(P1.4): … [skip ci]`), der
  letzte Commit einer Phase `[ci:full pN]`; höchstens ein Zwischenlauf `[ci:full]` je Phase, nur bei riskanten Aufgaben.
  Referenzbilder per `[ci:update-snapshots]` oder `gh workflow run ci-full.yml --ref <branch> -f update_snapshots=true`;
  in P9 zusätzlich Kunst-QA-Läufe mit `[ci:art]` (KUNST-QA §9). Welche Kennung welchen Workflow startet: ARCHITEKTUR
  §6.2. `pnpm ci:minutes` zu Beginn und vor jedem Push ohne `[skip ci]`; bei `MINUTEN_STATUS=knapp` oder `unbekannt` (ab 1.500 Minuten
  im Monat oder wenn die Abfrage scheitert) nur noch Phasenende-Läufe.
- **PR anlegen** (spätestens vor dem ersten CI-Lauf der Phase, Entwurf genügt – die CI-Workflows laufen nur über
  `pull_request`, nie bei `push`): `gh pr create --base main --title "P<n>…P<m>: <Titel>" --body-file <datei>`
  (Beschreibung Deutsch, für Jutta verständlich). PR-Titel und -Beschreibung enthalten **nie** `[skip ci]`, auch nicht
  als Erklärung: Mergt Jutta per Knopf, wird daraus die Merge-Nachricht (ARCHITEKTUR §6.7 Nr. 1). REST-Ersatz:
  `gh api repos/{owner}/{repo}/pulls -f title="…" -f head="$(git branch --show-current)" -f base=main -F body=@<datei>`.
  Commits und PR-Texte bekommen automatisch den Link zur Session (`Claude-Session:`-Trailer).
- **PR-Text ändern:** `gh pr edit <nr> --body-file <datei>`; REST-Ersatz:
  `gh api repos/{owner}/{repo}/pulls/<nr> -X PATCH -F body=@<datei>`.
- **CI verfolgen:** `gh run list --branch "$(git branch --show-current)" --limit 5`, dann `gh run watch <id> --exit-status`.
  Fehlerlog: `gh run view <id> --log-failed`.
- **Mergen (Merge-Regel ARCHITEKTUR §6.7 Nr. 3):** Maßgeblich ist der **letzte Commit ohne `[skip ci]`**; er muss der
  Phasenende-Commit `[ci:full pN]` sein: Alle seine Läufe sind grün, danach folgen nur Doku-Commits mit `[skip ci]` in `PLAN.md`,
  `docs/FORTSCHRITT.md`, `docs/OFFENE-PUNKTE.md` (Prüfung `git diff --name-only <sha>..HEAD`). Dann zuerst
  `gh pr merge <nr> --squash --subject "<PR-Titel>" --body "<Kurzfassung>"`; bei Ablehnung
  `gh api repos/{owner}/{repo}/pulls/<nr>/merge -X PUT -f merge_method=squash -f commit_title="<PR-Titel>" -f commit_message="<Kurzfassung>"`.
  Die Merge-Nachricht enthält in **keiner** Phase `[skip ci]`: Auf `main` startet sie nur `release.yml`, das bis zum
  leeren Plan nach Sekunden endet (ARCHITEKTUR §6.2, §6.6). Ob der Proxy Merges zulässt, ist nicht dokumentiert.
  Geht beides nicht: ganz oben in den PR-Text
  „**Bitte mergen – CI ist grün**“ mit Link zum grünen Lauf und Kurz-SHA, dann weiterarbeiten. Nie `--admin`, nie Checks
  abschalten (in `.claude/settings.json` verboten).
- **Nach einem Squash-Merge** auf demselben Branch weiterarbeiten:
  `git fetch origin && git merge origin/main -m "chore: merge main [skip ci]"` (kein Rebase, kein Force-Push –
  Force-Push ist verboten). Für die nächste Phase einen **neuen** PR vom selben Branch
  öffnen. Es gibt höchstens einen offenen PR pro Session.
- **Vorschau-Artefakte (ab P2, ARCHITEKTUR §6.2, §6.5, §14.8, §14.9):** Name `planet-claire-vorschau-<phase>-<sha7>`,
  nur am Phasenende. Die Phasen-Kennung kommt aus `[ci:full pN]` in der Commit-Nachricht (über `PREVIEW_PHASE`), lokal
  aus `PLAN.md` – **nie** aus dem Branch-Namen (Cloud-Branches heißen `claude/…`). `retention-days: 30`; der Workflow
  löscht ältere Artefakte, sodass nur die **3 neuesten** bleiben (GitHub Free: 500 MB Artefakt-Speicher). Fehlerberichte
  bleiben 2 Tage, Traces nur bei Fehlschlag. Größe der Vorschau: Ziel ≤ 20 MB, über 40 MB bricht der Export ab. Die Vorschau enthält Seed-Tattoofotos von Kund:innen ohne Einwilligung (`SEED_PREVIEW_MODE`, KA-21,
  Kanzleifrage K-34); Bilder mit Jutta kommen ohne ihre Freigabe nicht hinein (SEED-SPEC §4.1). Das finale Release heißt
  `vorschau-p10` („Planet Claire – Vorschau (Stand P10)“) und wird nach dem Merge auf `main` automatisch veröffentlicht,
  aber nur, wenn `--plan-status` die Zeile `OFFEN_P1_P10=0` ausgibt (`release.yml`, ARCHITEKTUR §6.6); fällt der Lauf
  nach dem Merge aus, holt ihn der tägliche Lauf um 06:00 UTC nach. PR-Kommentar und Release-Text sagen Jutta in
  einem Satz, dass sie die Datei nur privat ansieht und nicht weitergibt. Die Datei nie committen und nirgends außerhalb des privaten
  Repositorys ablegen.
- Die Claude-GitHub-App hat Schreibrechte u. a. für Contents, Pull requests, Checks, Actions und Workflows –
  Änderungen an `.github/workflows/` sind also möglich. Keine Rechte für Repository-Einstellungen („Administration“).

### 3.6 Rechte (Permission-Modus)

- In der Cloud gibt es nur **Auto**, **Accept edits** und **Plan** (kein Manual, kein Bypass). `bypassPermissions` und
  `dontAsk` aus Settings werden ignoriert, `auto` als `defaultMode` aus `.claude/settings.json` ebenfalls. Deshalb setzt
  `.claude/settings.json` **keinen** `defaultMode`; Jutta wählt **Auto**.
- **Auto:** Regeln aus `.claude/settings.json` gelten zuerst (allow/deny). Breite Regeln wie `Bash(pnpm *)` oder
  `Bash(node *)` entfallen im Auto-Modus; dann prüft ein Klassifikator. Er blockiert u. a. Force-Push, fremde
  Repositories und Merges ohne menschliche Freigabe – die Merge-Freigabe steht im Kickoff-Text (§2.1) und als Regel
  `Bash(gh pr *)` (E-97). Wird etwas blockiert: andere, erlaubte Form wählen; nach 3 Blockaden in Folge (oder 20 pro
  Session) fällt die Session auf Rückfragen zurück (= Stillstand, bis Jutta klickt).
- **Accept edits:** Dateiänderungen laufen ohne Rückfrage, jeder Befehl außerhalb der Allow-Liste wartet auf Jutta
  (= Stillstand). Deshalb die erlaubten Formen nutzen: `pnpm …` bzw. `pnpm exec …` statt fremder Wrapper, `psql` mit
  URL (`psql postgres://postgres:postgres@127.0.0.1:5432/planetclaire -c '…'`) statt `PGPASSWORD=… psql`
  (vorangestellte Variablen verhindern den Regel-Treffer), `curl -s http://localhost:3000/…`.
- **Geschützte Pfade** fragen immer (Accept edits) bzw. gehen an den Klassifikator (Auto), egal was die Allow-Liste sagt:
  u. a. `.claude/`, `.git/`, `.vscode/`, `.husky/`, `.npmrc`, `.mcp.json`, `.gitconfig`. Diese Dateien nur ändern, wenn
  es wirklich nötig ist, sonst Bedarf in `docs/OFFENE-PUNKTE.md` notieren.
- **Verboten** (deny in `.claude/settings.json`): Force-Push/`--mirror`/`--delete`, `gh repo delete|edit|archive|rename`,
  `gh secret`, `gh variable`, `gh auth token|logout`, `gh pr merge --admin`, `gh pr review`, `gh release delete`,
  `gh run delete`, `gh workflow disable`, `gh api` mit `DELETE`, Webhooks, Collaborators, Branch-Schutz.

### 3.7 Zeitlimits

| Was | Grenze | Was tun |
|---|---|---|
| Einzelner Bash-Befehl | Standard 5 min, maximal 20 min (`BASH_DEFAULT_TIMEOUT_MS=300000`, `BASH_MAX_TIMEOUT_MS=1200000` in Block B und in `.claude/settings.json`; ohne sie 2 bzw. 10 min) | Bei Überschreitung wandert der Befehl in den Hintergrund (wird nicht abgebrochen). Lange Läufe (`pnpm build`, `pnpm test:e2e`, Vorschau-Export) mit großzügigem Timeout starten. |
| Dev-Server | läuft unbegrenzt | `pnpm dev` im Hintergrund starten und danach beenden (`pkill -f "next dev"`). Playwright startet `pnpm dev` selbst (`reuseExistingServer`). |
| SessionStart-Hook | `timeout: 1200` s in `.claude/settings.json` (Standard wäre 600 s); typisch wenige Sekunden | – |
| Setup-Skript | Cache nur bei < ca. 5 min | Budget im Skript 270 s; schwere Teile holt der Hook nach. |
| Leerlauf | Die Session wird nach Inaktivität beendet, die VM verworfen | Beim Wiederöffnen: frische VM, Verlauf bleibt, Hintergrundprozesse (Postgres, Dev-Server, Subagenten) nicht → der Hook startet Postgres neu. |

### 3.8 Umgebungsvariablen und `.env`

- Reihenfolge: Variablen der Cloud-Umgebung (Block B) stehen im Prozess und gehen **vor** `.env` (Next.js und `dotenv`
  überschreiben vorhandene Prozessvariablen nicht). Block B hält damit Datenbank und Attrappen-Treiber fest.
- `.env` entsteht aus `.env.example` (Hook) und ist git-ignoriert. **Neue Variable** → nach `docs/ARCHITEKTUR.md` §5.1 in
  `src/lib/env.ts` (einzige Quelle) und die Tabelle §5.2 eintragen, dann `pnpm env:example` (erzeugt `.env.example`; ab
  P1, vorher von Hand), ggf. auch in `.github/workflows/`. Nur Namen aus ARCHITEKTUR §5.2 (z. B. `PAYMENTS_DRIVER`,
  `EMAIL_DRIVER`, `STORAGE_DRIVER`, `TRANSLATION_DRIVER`, `SEED_NOW`); Produktion erkennt der Code nur an
  `APP_ENV=production`. Der Hook ergänzt neue Schlüssel beim nächsten Start in `.env`; in der laufenden Session selbst in
  `.env` eintragen.
- Block B muss nur angepasst werden, wenn sich einer **seiner** Namen ändert (z. B. ein Treiber-Schalter). Dann in
  `docs/OFFENE-PUNKTE.md` eintragen: „Block B in der Umgebung planetclaire aktualisieren“ und Block B hier per PR ändern.
- Tests, die eine andere Datenbank oder einen anderen Treiber brauchen, setzen ihn ausdrücklich im Test-Setup
  (Prozessvariablen aus Block B würden Werte aus `.env`-Dateien sonst überdecken). `DATABASE_URL_TEST` zeigt auf die
  Test-DB `planetclaire_test`, die Tests leeren dürfen.

### 3.9 Geheimnisse und optionale Stripe-Testschlüssel

- Bis P11 gibt es **keine** echten Schlüssel (E-97, CLAUDE.md §2/§6). Umgebungsvariablen und Setup-Skript sind für alle
  Nutzer der Umgebung lesbar. Ein Stripe-Konto im Testmodus legt Jutta frühestens während der Cloud-Phasen an
  (`docs/owner/AUFGABEN.md` A09, E-94); die Entwicklung braucht keinen Schlüssel. Standard bis P11:
  `PAYMENTS_DRIVER=mock`.
- Falls es später (frühestens mit Stripe-Konto) Test-Schlüssel in der Cloud geben soll, gibt es zwei Wege. Beide nur mit
  **Test**-Schlüsseln (`sk_test_…` oder `rk_test_…`), niemals `sk_live_…`/`rk_live_…` – nie Live-Schlüssel vor P11 (die
  App bricht dann ab, ARCHITEKTUR §4.3):
  1. **Bevorzugt: „API credential“** (nur Pro/Max, ARCHITEKTUR §4.5). Jutta: Wolken-Symbol → Zahnrad bei
     planetclaire → **API credentials** → **Add credential** → Name `Stripe Test`, Allowed websites `api.stripe.com`,
     Header `Authorization`, Prefix `Bearer`, Value `sk_test_…` oder `rk_test_…` → **Connect**. Der Proxy hängt den
     Schlüssel außerhalb der VM an; niemand in der Session sieht ihn. Dazu in Block B: `PAYMENTS_DRIVER=stripe`,
     `STRIPE_SECRET_KEY=sk_test_proxy` (Platzhalter), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…` (öffentlich).
     **Prüfen (Agent):** `curl -s https://api.stripe.com/v1/balance -H "Authorization: Bearer sk_test_proxy" | jq .livemode`
     muss `false` ausgeben. `true` → sofort `PAYMENTS_DRIVER=mock`, Eintrag in `docs/OFFENE-PUNKTE.md` („Live-Schlüssel
     in der Cloud-Umgebung – bitte löschen“). Fehler 401 → der Proxy ersetzt den Platzhalter nicht; mit Mock weiterarbeiten
     und eintragen.
  2. **Rückfall, nur wenn Weg 1 nicht geht** (z. B. Prüfbefehl liefert 401): `STRIPE_SECRET_KEY=sk_test_…` (oder
     `rk_test_…`) direkt als Umgebungsvariable in Block B. Für alle Nutzer der Umgebung lesbar; nach CLAUDE.md §6 für
     Test-Schlüssel zulässig, weil sie kein echtes Geld bewegen. **Prüfen (Agent):** Präfix `sk_test_`/`rk_test_` und
     `curl -s https://api.stripe.com/v1/balance -u "$STRIPE_SECRET_KEY:" | jq .livemode` muss `false` ausgeben; sonst
     sofort `PAYMENTS_DRIVER=mock` und Eintrag in `docs/OFFENE-PUNKTE.md` wie oben. Den Schlüssel nie ausgeben, loggen
     oder committen.
- Webhooks erreichen die VM von außen nicht → Webhook-Tests bleiben bei Fixtures bzw. `stripe-mock`
  (`docker compose --profile payments up -d`, ARCHITEKTUR §4.4). Echte Stripe-Elements-E2E-Tests bräuchten zusätzlich
  `*.js.stripe.com` und `hooks.stripe.com` in Block A; sie sind bis P11 nicht vorgesehen.
- DeepL genauso (optional): API credential für `api-free.deepl.com` mit Header `Authorization`, Prefix `DeepL-Auth-Key`,
  sonst `TRANSLATION_DRIVER=mock`.

---

## 4. Fortschritt, Abbrüche, lange Sessions (Agenten)

### 4.1 Wo der Fortschritt steht

| Ort | Inhalt | Wer schreibt |
|---|---|---|
| `PLAN.md` | Checkboxen je Aufgabe (P1–P11) – **die** Quelle für „was ist als Nächstes dran“. Stand: `bash scripts/cloud-setup.sh --plan-status` | Session, nach jeder erledigten Aufgabe |
| `docs/FORTSCHRITT.md` | Log, neueste Einträge oben: Datum, Aufgabe, was, wie getestet. Am Phasenende zusätzlich eine Übergabe-Zeile: „Nächster Schritt: …; Stolpersteine: …“ | Session, nach jeder Aufgabe |
| PR-Beschreibung | Zusammenfassung je Phase für Jutta (Deutsch, du-Form) | Session, nach jeder Phase |
| `docs/OFFENE-PUNKTE.md` | Annahmen und Punkte für Jutta | Session, bei Bedarf |
| Git-Historie | Commits mit `Claude-Session:`-Link zum Verlauf | automatisch |

Auto-Memory gibt es in der Cloud nicht; jede Session beginnt mit einem frischen Klon. Was nicht committet **und
gepusht** ist, ist nach dem Ende der VM weg.

### 4.2 Wiederaufnahme (Session beginnt oder endet mitten in einer Phase)

1. Zusammenfassung „## Cloud-Umgebung“ lesen: aktueller Branch, Branches mit Commits, die nicht in `main` sind, offene
   PRs, offene Checkboxen, erste offene Aufgabe. Fehlt sie: `bash scripts/cloud-setup.sh --session-start`.
2. **Arbeit früherer Sessions übernehmen (CLAUDE.md §3):** Für jeden offenen PR bzw. Branch `claude/…` aus der Liste,
   der Änderungen an `PLAN.md` oder `docs/FORTSCHRITT.md` enthält (`git diff --stat origin/main...origin/<branch>`):
   `git merge origin/<branch> -m "chore: merge <branch> [skip ci]"` in den eigenen Branch (kein Rebase), Konflikte
   lösen, im eigenen PR-Text vermerken
   („enthält #<nr>“). Nach dem Merge des eigenen PRs den überholten PR schließen:
   `gh pr close <nr> --comment "In #<eigene nr> enthalten"`. Andere Branches (z. B. Dependabot) ignorieren.
3. Ist `main` weiter als der eigene Branch: `git merge origin/main -m "chore: merge main [skip ci]"`.
4. `PLAN.md` gegen `docs/FORTSCHRITT.md` abgleichen: Steht eine Aufgabe im Log, ist aber nicht abgehakt, ihre
   Akzeptanzkriterien mit Tests prüfen, dann fertigstellen oder abhaken.
5. `pnpm check` einmal laufen lassen (ist die Ausgangslage grün?), dann mit der ersten offenen Checkbox weitermachen.

### 4.3 Lange Sessions und Kontext

- Die Cloud komprimiert den Verlauf automatisch (die Session setzt `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` selbst). Nach jeder
  Kompaktierung läuft der Hook erneut und liefert die Zusammenfassung „Cloud-Umgebung“ inkl. erster offener Aufgabe.
  `/compact <Fokus>` geht, `/clear` nicht.
- Kontext sparen: große Dateien und Ausgaben nicht komplett lesen (`pnpm-lock.yaml`, Build-Logs, Testausgaben →
  `tail`/`grep`, Reporter `dot`); Recherche und Massen-Lesen an Subagenten geben.
- Nach **jeder** Aufgabe committen (mit `[skip ci]`, §3.5) und pushen – dann kostet ein Abbruch höchstens eine Aufgabe.
- Nutzungslimit erreicht: Die Session pausiert (ein aktives `/goal` wartet), Jutta schreibt später „Weiter …“ (§2.2).
- Wenn du feststeckst (dieselbe Aufgabe scheitert dreimal): konservativste Lösung umsetzen, Annahme in
  `docs/OFFENE-PUNKTE.md`, weiter. Nur echte Blocker, die ausschließlich Jutta lösen kann (z. B. Domain freigeben,
  Merge-Recht), melden – im PR ganz oben und in `docs/OFFENE-PUNKTE.md`.
- Für `/goal`: Der Prüfer liest nur den Verlauf. Deshalb am Ende `bash scripts/cloud-setup.sh --plan-status` ausführen,
  damit `OFFEN_P1_P10=0` sichtbar im Verlauf steht.

---

## 5. Fehlerbehebung

| Symptom | Ursache | Lösung |
|---|---|---|
| Session startet nicht, „Setup script failed“ | Block C unvollständig eingefügt (das Skript endet sonst immer mit 0) | Jutta: Wolken-Symbol → mit der Maus auf planetclaire → Zahnrad → Feld **Setup script** leeren, Block C erneut einfügen, speichern. Notlösung: Feld leer lassen – der Hook richtet alles beim Start ein (jede Session startet dann etwas langsamer). |
| Neue Sessions hängen beim Setup / Container-Fehler | Setup dauert über ca. 5 min | Das Skript hat ein 270-s-Budget; falls trotzdem: Feld **Setup script** leeren (s. o.) und Hinweis in `docs/OFFENE-PUNKTE.md`. |
| `ENOTFOUND`, `ECONNRESET`, `403` beim Download, `CONNECT tunnel failed` | Host nicht in der Allowlist | `bash scripts/cloud-setup.sh --check`: `000` bzw. `Proxy-CONNECT 403` zeigt den blockierten Host. Mit Mock weiter, Eintrag in `docs/OFFENE-PUNKTE.md`. Jutta: Umgebung bearbeiten → **Allowed domains** ergänzen, Häkchen „Also include default list…“ prüfen, danach **neue** Session (die Änderung baut auch den Umgebungs-Cache neu). |
| `ECONNREFUSED 127.0.0.1:5432` | Postgres läuft nicht (nach Resume/Leerlauf normal) | `bash scripts/cloud-setup.sh --session-start` oder `service postgresql start`. |
| `password authentication failed for user "postgres"` / `database "planetclaire" does not exist` | Rolle/DB nicht eingerichtet | Wie oben (der Hook richtet ein). Manuell: `runuser -u postgres -- psql -c "ALTER USER postgres WITH PASSWORD 'postgres'"`, `runuser -u postgres -- createdb planetclaire`, dasselbe für `planetclaire_test`. |
| Tests brauchen eine leere DB | Altlasten aus früheren Läufen | `runuser -u postgres -- dropdb --if-exists planetclaire_test && runuser -u postgres -- createdb planetclaire_test`, dann Migrationen/Seed laut PLAN. |
| `Executable doesn't exist at /opt/ms-playwright/chromium-…` | Browser fehlt (z. B. Playwright-Version erhöht) | `pnpm exec playwright install chromium` (braucht `cdn.playwright.dev`). |
| `error while loading shared libraries: lib….so` beim Browserstart | Systembibliotheken fehlen | `dpkg --configure -a`, dann `pnpm exec playwright install-deps chromium webkit` (root; Ubuntu-Spiegel sind erlaubt). |
| WebKit lässt sich nicht installieren | Download/Bibliotheken scheitern | Der Hook setzt `PW_SKIP_WEBKIT=1` (Projekt `iphone-15` läuft als Chromium-Emulation, ARCHITEKTUR §7.3). Eintrag in `docs/OFFENE-PUNKTE.md`; die CI bleibt maßgeblich. |
| Playwright sucht unter `~/.cache/ms-playwright` | `PLAYWRIGHT_BROWSERS_PATH` fehlt im Prozess | `export PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright`; Block B prüfen. |
| `ERR_PNPM_OUTDATED_LOCKFILE` / „frozen-lockfile“ schlägt fehl | `package.json` geändert, Lockfile nicht | `pnpm install` (ohne `--frozen-lockfile`), `pnpm-lock.yaml` committen. |
| `ERR_PNPM_BAD_PM_VERSION` / falsche pnpm-Version | corepack nicht aktiv | `corepack enable pnpm && corepack install -g pnpm@10.34.5`, sonst `npm i -g pnpm@10.34.5`. |
| `node --version` zeigt v22 | `PATH` ohne `/opt/node24/bin` | `export PATH=/opt/node24/bin:$PATH`; fehlt `/opt/node24`: Hook erneut ausführen. |
| Befehl „läuft im Hintergrund weiter“ | Bash-Timeout erreicht | Ausgabe des Hintergrundbefehls abwarten/lesen; nächstes Mal größeres Timeout. |
| `git push` → 403 | Push auf einen anderen als den Session-Branch | Nur auf den eigenen Arbeitsbranch pushen. |
| `gh`: „This GraphQL query is not enabled for this session“ | Der Proxy lässt nur bestimmte GraphQL-Abfragen zu | REST: `gh api repos/{owner}/{repo}/…` |
| `gh`: „none of the git remotes … point to a known GitHub host“ | `origin` zeigt auf die Proxy-Adresse | `export GH_REPO=<owner>/planetclairetattoos` (setzt der Hook normalerweise). |
| Session wartet auf die Freigabe eines Befehls | Modus Accept edits + Befehl nicht in der Allow-Liste, oder geschützter Pfad | Jutta: **Yes** klicken oder nächste Session im Modus **Auto**. Agent: erlaubte Befehlsform wählen (§3.6), Bedarf in `docs/OFFENE-PUNKTE.md`. |
| Hinweis „Cloud-Umgebung“ fehlt beim Start | Hook lief nicht (z. B. Session mit mehreren Repositories oder ein „Project“ mit mehreren Repos) | Session mit **nur** diesem Repository starten; notfalls `bash scripts/cloud-setup.sh --session-start` von Hand. |
| Privates Repository erscheint nicht in der Auswahl | GitHub-App nicht für das Repo installiert | §1 Schritt 3 wiederholen (Repository-Zugriff der App prüfen). |
| Platte voll (30 GB) | Build-Ordner, Videos, Docker-Images | `rm -rf .next .next-preview test-results playwright-report artifacts`, `docker system prune -f` (fragt ggf. nach). |
| Prozess wird beendet („Killed“), Build bricht ab | Speicher (16 GB) | Keine parallelen Builds/E2E-Läufe; Dev-Server vor `pnpm build` beenden. |
| CI rot, lokal grün | Postgres 17 vs. 16, Node 24 vs. 22, fehlende Variable im Workflow | `gh run view <id> --log-failed`; Abweichung beheben; die CI ist maßgeblich. |
| Kein CI-Lauf nach einem Push | Kopf-Commit mit `[skip ci]` (gewollt, ARCHITEKTUR §6.7 Nr. 2) oder noch kein offener PR (die CI-Workflows laufen nur über `pull_request`) | Am Phasenende `[ci:full pN]` verwenden; PR (Entwurf genügt) vor dem ersten CI-Lauf öffnen. |
| Label `art` gesetzt, aber `art-qa.yml` startet nicht | Kopf-Commit des PR trägt `[skip ci]` (dann gibt es auch keine Label-Ereignisse) | Leeren Commit mit `[ci:art]` pushen (KUNST-QA §9). |
| CI startet nicht mehr | GitHub-Actions-Freiminuten des Monats aufgebraucht (privates Repo, GitHub Free: 2.000 min; `pnpm ci:minutes` zeigt `MINUTEN_MONAT` ≥ 2000) | Nicht mergen; in `docs/OFFENE-PUNKTE.md` melden; lokal weiter prüfen (`pnpm check`, `pnpm test:int`, `pnpm build`); der Phasenende-Lauf folgt im nächsten Monat (ARCHITEKTUR §6.8). |
| Nach dem P10-Merge fehlt das Release `vorschau-p10` | Lauf von `release.yml` nach dem Merge ausgefallen | Der tägliche Lauf (06:00 UTC) holt es nach; sonst `gh workflow run release.yml --ref main` (ARCHITEKTUR §6.6, P11.1). |

---

## 6. Änderungen an dieser Einrichtung

| Was | Wer | Wie |
|---|---|---|
| `scripts/cloud-setup.sh` | Session per PR | Immer mit `bash -n scripts/cloud-setup.sh` prüfen; Exit-Code 0 garantieren; `--plan-status` gegen `PLAN.md` testen. Block C ruft die Datei aus dem Repo auf – Jutta muss nichts neu einfügen. Der Umgebungs-Cache wird aber erst nach ca. 7 Tagen neu gebaut; bis dahin holt der Hook Neues nach. |
| Node-Version | Session per PR | `NODE_VERSION_PIN` + beide `NODE_SHA256_PIN_…` (aus `https://nodejs.org/dist/v<version>/SHASUMS256.txt`), `.nvmrc`, `Dockerfile`, `engines` gemeinsam ändern. |
| Playwright-Version | Session per PR | Nur `package.json`/Lockfile; Setup-Skript und Hook lesen die Version selbst. |
| Block A (Allowlist), Block B (Variablen), Block C (Setup-Starter) | Text hier: Session per PR. Umgebung: **nur Jutta** | Bedarf in `docs/OFFENE-PUNKTE.md` eintragen („Umgebung planetclaire: Block A um X ergänzen“). Änderungen an Allowlist oder Setup-Skript bauen den Cache neu (nächster Start etwas langsamer). |
| `.claude/settings.json` (Rechte, Hook) | Session per PR | Geschützter Pfad (§3.6): nur ändern, wenn nötig. Muss gültiges JSON nach `https://json.schemastore.org/claude-code-settings.json` bleiben; wirkt ab der nächsten Session. Kein `defaultMode`, keine Geheimnisse im `env`-Block. Für P11 dürfen deny-Regeln (z. B. `gh secret`) mit Jutta gelockert werden. |

---

## 7. Geprüfte Fakten und Quellen

Geprüft am 26.09.2026 durch Abruf der Markdown-Fassung der offiziellen Seiten („Doku“ = `code.claude.com/docs/en/…`).
„Abgeleitet“ = nicht wörtlich dokumentiert, sondern daraus geschlossen; das Skript fängt diese Fälle ab.

| # | Fakt | Quelle |
|---|---|---|
| F-01 | Cloud-Sessions gibt es für Pro, Max, Team und Enterprise (Premium- bzw. Chat+Claude-Code-Sitze). Sie teilen das Kontingent des Kontos; keine separaten Rechenkosten. | <https://code.claude.com/docs/en/claude-code-on-the-web> (Note, Limitations) |
| F-02 | Umgebungen: Wolken-Symbol mit dem Umgebungsnamen in der Zeile über dem Eingabefeld (claude.ai/code) bzw. im Eingabefeld der Desktop-App → **Add cloud environment**; bestehende über das Zahnrad. Dialog: Name, Network access, Environment variables (`.env`-Format), Setup script. Keine Einstellungsseite/URL. Umgebungen sind persönlich, archivieren statt löschen. Pro/Max-Onboarding legt „Default“ (Trusted) an. | <https://code.claude.com/docs/en/cloud-environments#configure-your-environment>, <https://code.claude.com/docs/en/cloud-environments#the-default-environment> |
| F-03 | Netzwerkstufen None, Trusted (Standard), Full, Custom. Custom: eine Domain pro Zeile, `*.` für Subdomains, Häkchen „Also include default list of common package managers“ behält die Standardliste. GitHub (eigener Proxy), MCP-Connectoren, Hosts von API credentials und die Anthropic-API laufen an der Allowlist vorbei. | <https://code.claude.com/docs/en/cloud-environments#access-levels>, <https://code.claude.com/docs/en/cloud-environments#allow-specific-domains> |
| F-04 | Standardliste enthält u. a. `registry.npmjs.org`, `nodejs.org`, `*.ubuntu.com`, Docker Hub, `raw.githubusercontent.com`, `fonts.googleapis.com`, `fonts.gstatic.com`, `json.schemastore.org`, `code.claude.com`; **nicht** `cdn.playwright.dev`, `playwright.download.prss.microsoft.com`, `api.stripe.com`, `api-free.deepl.com`, `payloadcms.com`. | <https://code.claude.com/docs/en/cloud-environments#default-allowed-domains> |
| F-05 | Umgebungsvariablen: `.env`-Format; `#` beginnt in ungequoteten Werten einen Kommentar; Werte werden beim Session-Start kopiert (Änderungen gelten für neue Sessions); für alle Nutzer der Umgebung lesbar. `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` setzt die Session selbst. | <https://code.claude.com/docs/en/cloud-environments#set-environment-variables> |
| F-06 | Setup-Skript: Bash, als root, Ubuntu 24.04, vor dem Start von Claude Code, nach dem Klonen (Fehlerursache „references a file … that doesn't exist in a fresh clone“). Exit ≠ 0 → Session startet nicht. Cache = Dateisystem-Snapshot ohne Prozesse, nur bei < ca. 5 min; Neuaufbau bei Änderung von Skript oder Allowlist oder nach ca. 7 Tagen; Resume führt es nie erneut aus. `&`/`wait` empfohlen, große Downloads in einen SessionStart-Hook. | <https://code.claude.com/docs/en/cloud-environments#setup-scripts>, <https://code.claude.com/docs/en/cloud-environments#environment-caching>, <https://code.claude.com/docs/en/web-quickstart#setup-script-failed>, <https://code.claude.com/docs/en/web-quickstart#new-sessions-hang-or-time-out-during-setup> |
| F-07 | SessionStart-Hooks aus der `.claude/settings.json` des Repos laufen in Cloud-Sessions mit **einem** Repository bei jedem Start inkl. Resume, lokal wie in der Cloud; Hooks aus `~/.claude/settings.json` nicht. Empfohlenes Muster: Skript prüft `CLAUDE_CODE_REMOTE`. | <https://code.claude.com/docs/en/cloud-environments#setup-scripts-vs-sessionstart-hooks>, <https://code.claude.com/docs/en/cloud-environments#install-dependencies-with-a-sessionstart-hook> |
| F-08 | `CLAUDE_CODE_REMOTE` ist in Cloud-Sessions `true` und lokal nicht gesetzt; lesbar in Hooks und Setup-Skripten. `CLAUDE_CODE_REMOTE_SESSION_ID` enthält die Session-ID. | <https://code.claude.com/docs/en/env-vars>, <https://code.claude.com/docs/en/hooks#hook-handler-fields> |
| F-09 | SessionStart: Matcher `startup`, `resume`, `clear`, `compact`, `fork`; Klartext auf stdout wird Kontext (sachlich formulieren; > 10.000 Zeichen → Datei); stderr bei Exit 0 nur im Debug-Log. Command-Hooks: Standard-Timeout 600 s, Feld `timeout` in Sekunden, `statusMessage`. `CLAUDE_ENV_FILE` speichert `export`-Zeilen für spätere Bash-Befehle. `$CLAUDE_PROJECT_DIR` = Projektwurzel. Die erste Antwort wartet auf die Hooks. | <https://code.claude.com/docs/en/hooks#sessionstart>, <https://code.claude.com/docs/en/hooks#common-fields>, <https://code.claude.com/docs/en/hooks#persist-environment-variables>, <https://code.claude.com/docs/en/hooks#add-context-for-claude> |
| F-10 | Vorinstalliert: Node 20/21/22 unter `/opt/node20…22` (22 im PATH) mit npm, yarn, pnpm, bun, eslint, prettier, chromedriver; Docker + Compose; PostgreSQL 16 und Redis 7 (laufen nicht von selbst, `service postgresql start`); git, gh, jq, yq, ripgrep, tmux; Befehl `check-tools`. | <https://code.claude.com/docs/en/cloud-environments#installed-tools>, <https://code.claude.com/docs/en/cloud-environments#start-services> |
| F-11 | VM: Ubuntu 24.04, x86_64, ca. 4 vCPU, 16 GB RAM, 30 GB Platte. | <https://code.claude.com/docs/en/cloud-environments#resource-limits> |
| F-12 | Bash-Befehle: Standard 2 min, bis 10 min; bei Timeout in den Hintergrund. Anheben über `BASH_DEFAULT_TIMEOUT_MS`/`BASH_MAX_TIMEOUT_MS` in den Umgebungsvariablen. Inaktive Sessions enden; Wiederöffnen = frische VM mit Verlauf, ohne Hintergrundarbeit. | <https://code.claude.com/docs/en/cloud-environments#time-limits>, <https://code.claude.com/docs/en/env-vars>, <https://code.claude.com/docs/en/claude-code-on-the-web#environment-expired> |
| F-13 | GitHub-Zugang per Claude-GitHub-App (private Repos nur mit installierter App; Link `github.com/apps/claude/installations/new`) oder `/web-setup` (gh-Token). App-Rechte: Actions, Checks, Contents, Discussions, Issues, Pull requests, Repository hooks, Workflows lesen/schreiben; Members, Metadata, Statuses lesen; keine Administration. | <https://code.claude.com/docs/en/claude-code-on-the-web#github-authentication-options>, <https://code.claude.com/docs/en/web-quickstart#connect-github>, <https://code.claude.com/docs/en/github-actions#github-app-permissions> |
| F-14 | GitHub-Proxy: `git push` nur auf den aktuellen Arbeitsbranch der Session; Klonen, Fetch, PR-Operationen normal; GraphQL nur für freigegebene PR-Abfragen, sonst 403 mit REST-Hinweis; `GH_TOKEN`/`GITHUB_TOKEN` = `proxy-injected`; API/Release-Assets nur für angehängte Repos. | <https://code.claude.com/docs/en/cloud-environments#github-proxy>, <https://code.claude.com/docs/en/cloud-environments#work-with-github-issues-and-pull-requests> |
| F-15 | Commits aus Cloud-Sessions bekommen einen `Claude-Session:`-Trailer, PR-Texte den Session-Link. | <https://code.claude.com/docs/en/cloud-environments#link-output-back-to-the-session> |
| F-16 | Modi in der Cloud: Accept edits (= `default`, Dateiänderungen vorab erlaubt), Plan, Auto; kein Manual/Bypass. `bypassPermissions`/`dontAsk` aus Settings werden ignoriert; `defaultMode: "auto"` aus `.claude/settings.json` wirkt nicht; `acceptEdits` wird beachtet. | <https://code.claude.com/docs/en/web-quickstart#start-a-task>, <https://code.claude.com/docs/en/permission-modes> |
| F-17 | Auto-Modus: allow/ask/deny-Regeln entscheiden zuerst; breite Regeln (`Bash(*)`, Interpreter, Paketmanager-Run-Befehle) entfallen; Klassifikator blockiert u. a. Force-Push, Merges ohne menschliche Freigabe, Abschalten von CI; im Gespräch genannte Freigaben (Aktion + Details) können Blockaden lösen; nach 3 Blockaden in Folge Rückfall auf Rückfragen. Geschützte Pfade (`.claude/`, `.git/`, `.vscode/`, `.npmrc`, `.mcp.json` …) → Klassifikator (Auto) bzw. Rückfrage (Accept edits). | <https://code.claude.com/docs/en/permission-modes#eliminate-prompts-with-auto-mode>, <https://code.claude.com/docs/en/permission-modes#protected-paths> |
| F-18 | Regel-Syntax: `*` steht für beliebigen Text inkl. Leerzeichen; `:*` nur am Ende (= ` *`); Reihenfolge deny → ask → allow; zusammengesetzte Befehle werden einzeln geprüft; `timeout`, `nohup` usw. werden entfernt; eine allow-Regel greift nicht über vorangestellte Variablen (außer bekannten sicheren). Schema `https://json.schemastore.org/claude-code-settings.json` – `.claude/settings.json` wurde damit validiert (ajv, 26.09.2026). | <https://code.claude.com/docs/en/permissions#wildcard-patterns>, <https://code.claude.com/docs/en/permissions#compound-commands>, <https://code.claude.com/docs/en/settings> |
| F-19 | In Cloud-Sessions mit einem Repository gelten aus `.claude/settings.json` Rechte, Hooks und `env`; `.claude/settings.local.json` und `~/.claude/settings.json` nicht; bei mehreren Repositories nur `enabledPlugins`/`extraKnownMarketplaces`. Plugins aus dem Repo werden nicht installiert. | <https://code.claude.com/docs/en/settings#settings-in-cloud-sessions>, <https://code.claude.com/docs/en/cloud-environments#what-carries-over-from-your-setup> |
| F-20 | Übergabe: Desktop-App, VS-Code-Symbol unten rechts → **Continue in** → **Claude Code on the Web** pusht den Branch, erstellt eine Zusammenfassung und startet eine Cloud-Session (sauberer Arbeitsbaum nötig). CLI nur in eine Richtung: `claude --cloud "<Aufgabe>"` klont den gepushten Branch; `/remote-env` wählt die Umgebung; `--teleport` holt Cloud-Sessions ins Terminal. | <https://code.claude.com/docs/en/desktop#continue-in-another-surface>, <https://code.claude.com/docs/en/claude-code-on-the-web#move-tasks-between-terminal-and-cloud>, <https://code.claude.com/docs/en/cloud-environments#select-an-environment-from-the-cli> |
| F-21 | Kontext: `/compact` geht, `/clear` nicht; Auto-Kompaktierung früher als lokal; Subagenten funktionieren. | <https://code.claude.com/docs/en/claude-code-on-the-web#manage-context> |
| F-22 | `/goal`: nach jedem Zug prüft ein kleines Modell die Bedingung nur anhand des Verlaufs; max. 4.000 Zeichen; startet sofort einen Zug; ändert den Permission-Modus nicht; bei Nutzungslimit „Goal paused“; bei Resume wiederhergestellt; nicht verfügbar mit `disableAllHooks`. | <https://code.claude.com/docs/en/goal> |
| F-23 | claude.ai/code lässt sich per URL vorbelegen: `prompt`, `repositories` (`owner/repo`), `environment` (Name oder ID). | <https://code.claude.com/docs/en/web-quickstart#pre-fill-sessions> |
| F-24 | API credentials: nur Pro/Max, nur beim Bearbeiten einer bestehenden Umgebung, Typ Bearer (Header `Authorization`, Prefix `Bearer`); der Proxy hängt den Schlüssel außerhalb der VM an; nie an GitHub, `registry.npmjs.org` & Co. und nie an Anfragen des Setup-Skripts. Ob ein vom Client gesendeter Platzhalter ersetzt wird, ist nicht dokumentiert (→ Prüfbefehl §3.9). | <https://code.claude.com/docs/en/cloud-environments#add-api-credentials> |
| F-25 | `WebSearch` nutzt Anthropics Such-Backend; `WebFetch` holt die Seite selbst und hat vorab freigegebene Doku-Domains. Abgeleitet: `WebFetch` unterliegt in der Cloud der Netzwerk-Allowlist. | <https://code.claude.com/docs/en/tools-reference#webfetch-tool-behavior>, <https://code.claude.com/docs/en/tools-reference#websearch-tool-behavior> |
| F-26 | Playwright 1.58.2 (Version in `package.json`) lädt Chromium für `ubuntu24.04-x64` (Chrome for Testing) nur von `cdn.playwright.dev`, WebKit/ffmpeg über `cdn.playwright.dev/dbazure/…` bzw. `playwright.download.prss.microsoft.com`; `playwright.azureedge.net` kommt nicht mehr vor. | Quelltext `node_modules/playwright-core/lib/server/registry/index.js` (1.58.2), `PLAYWRIGHT_CDN_MIRRORS` und `DOWNLOAD_PATHS` |
| F-27 | Neueste Node-24-Version: 24.21.0 vom 07.09.2026 (LTS „Krypton“); SHA-256 `node-v24.21.0-linux-x64.tar.xz` = `fd8e59d5…6cb2d6`, `.tar.gz` = `6e1db87e…88dc5ff`. Aktuell ist außerdem 26.10.0. | <https://nodejs.org/dist/index.json>, <https://nodejs.org/dist/v24.21.0/SHASUMS256.txt> |
| F-28 | pnpm 10.34.5 und `@playwright/test` 1.58.2 existieren in der npm-Registry. | <https://registry.npmjs.org/pnpm/10.34.5>, <https://registry.npmjs.org/@playwright%2ftest/1.58.2> |
| F-29 | Stripe.js braucht `api.stripe.com`, `js.stripe.com`, `*.js.stripe.com`, für 3-D-Secure `hooks.stripe.com`. | <https://docs.stripe.com/security/guide> (CSP-Abschnitt) |
| F-31 | GitHub (geprüft 27.09.2026): Unter „Allow squash merging“ sitzt ein Auswahlknopf ohne eigene Überschrift (anfangs „Default message“) mit den Optionen „Default message“, „Default to pull request title“, „Default to pull request title and commit details“, „Default to pull request title and description“; Änderungen speichern sofort (grünes Häkchen). Neues-Repository-Formular seit 08/2025: „Choose visibility“ (Public/Private, voreingestellt Public), Schalter „Add README“ (Off), „Add .gitignore“ („No .gitignore“), „Add license“ („No license“). Erster `git push` unter Windows: Git Credential Manager öffnet das Fenster „Connect to GitHub“ → „Sign in with your browser“. | <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests>, <https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository>, <https://docs.github.com/en/get-started/git-basics/caching-your-github-credentials-in-git> |
| F-30 | Abgeleitet/nicht dokumentiert: Arbeitsverzeichnis und Benutzer, unter dem Claudes Befehle laufen; Form der `origin`-URL im Klon; ob der Proxy `gh pr merge` erlaubt; welche Umgebung „Continue in“ wählt. Das Skript sucht das Repo selbst, setzt `GH_REPO`, und die Doku nennt jeweils eine Ausweichlösung. | – |

**Korrekturen gegenüber `docs/research/`:** Das Setup-Skript läuft **nicht** vor jeder Session (nur beim Cache-Aufbau);
`autoMode`-Einstellungen aus dem Repo wirken in der Cloud nicht; Hooks im Format `{"SessionStart": "cmd &"}` sind
ungültig (richtig: siehe `.claude/settings.json`); `fonts.gstatic.com` steht bereits in der Standardliste (wird aber
nicht benutzt); `playwright.azureedge.net` braucht die gepinnte Playwright-Version nicht mehr; pnpm bleibt bei 10.34.5
(`package.json`), nicht 11.
