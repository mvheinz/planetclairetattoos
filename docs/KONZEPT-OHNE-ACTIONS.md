# Konzept: Entwicklung ohne GitHub-Actions-Minuten (Vorschlag, 09.10.2026)

Anlass: Jutta (09.10.2026): „Müssen unbedingt ohne Action-Minuten auskommen.“ Das Repository wird privat (U-63);
damit kosten alle Läufe auf GitHub-Rechnern Minuten aus dem 2.000-Minuten-Kontingent. Ziel: **0 Minuten**, ohne dass
die Prüfqualität sinkt.

## 1. Grundidee: Die Prüfschleuse läuft in der Claude-Sitzung

Jede Claude-Cloud-Sitzung hat bereits alles, was die GitHub-Läufe brauchen: Node, pnpm, Postgres, Chromium + WebKit,
Docker, 4 Kerne, 15 GB Speicher. Die Prüfungen aus `ci.yml`/`ci-full.yml`/`art-qa.yml`/`preview-export.yml` laufen
deshalb **dort** statt auf GitHub – kostenlos, und Fehler werden sofort sichtbar statt erst eine Stunde später.

| Heute (GitHub Actions) | Neu (lokal in der Sitzung) |
| --- | --- |
| `ci.yml` quick bei jedem Push | `pnpm ci:local quick` vor jedem Commit (lint, Typen, Unit, Geheimnis-Scan) |
| `ci-full.yml` bei `[ci:full pN]` (6 E2E-Shards, quality, docker) | `pnpm ci:local full` am Phasenende: Int + Abdeckung, Build, Budgets, E2E alle 3 Geräte, visuell, Lighthouse/INP, Docker-Build |
| `art-qa.yml` bei `[ci:art]` | `pnpm ci:local art` (gleiche Skripte `scripts/art`) |
| `preview-export.yml` / `release.yml` | Vorschau-HTML in der Sitzung bauen, prüfen und Jutta **direkt im Chat** schicken |
| `restore-drill.yml` (monatlich) | ab Go-live als Cron-Job auf dem eigenen Server (P11) |

Nachweis: `ci:local` schreibt einen Bericht (`ci-reports/<datum>-<commit>.json`, nicht im Repo) und setzt am Commit
einen **Commit-Status** „lokal/ci-full: grün“ über die GitHub-API (kostet keine Minuten). Merge nur bei grünem Status
– so bleibt die Regel „letzter Phasen-Commit muss grün sein“ (CLAUDE.md §3) erhalten.

## 2. GitHub Actions abschalten

- Alle Workflows nur noch per Hand startbar (`workflow_dispatch`), keine `push`-/`schedule`-Auslöser mehr
  → es kann nichts mehr unbemerkt Minuten verbrauchen. Die Dateien bleiben als Vorlage (z. B. für Variante B).
- Zusätzlich kann Jutta unter **Settings → Actions → General → „Disable actions“** alles hart abschalten und unter
  **Settings → Billing → Budgets** ein Ausgabelimit von 0 € setzen (dann bricht GitHub statt zu berechnen).
- Die Commit-Kennungen `[skip ci]`, `[ci:full pN]`, `[ci:art]` werden zu Hinweisen für die lokale Schleuse
  (Regeln in CLAUDE.md §3 und ARCHITEKTUR §6 werden angepasst).

## 3. Zeitbedarf in der Sitzung

Zwischenstand (gezielt betroffene Tests): 5–20 min. Phasenende komplett: geschätzt 2–3 h (E2E 3 Geräte nacheinander
≈ 90–120 min, Int + Abdeckung ≈ 30 min, Build/Budgets/visuell/Lighthouse ≈ 30 min). Läuft im Hintergrund, während
weitergearbeitet wird.

## 4. Alternativen (zum Vergleich)

- **B – eigener Runner:** GitHub-Läufe auf einem eigenen kleinen Server (≈ 5 €/Monat) statt auf GitHub-Rechnern. Heute
  ohne Minutenverbrauch; GitHub hatte für 2026 aber eine Gebühr pro Minute für eigene Runner in privaten Repos
  angekündigt und dann verschoben – unsicher. Zusätzlicher Server zu pflegen.
- **C – Repo öffentlich lassen:** Minuten gratis, aber Kundenfotos, Anschrift und Vorschauen öffentlich. Nicht empfohlen.
- **D – nur sparen:** weiter GitHub Actions, aber nur am Phasenende (≈ 225 min/Phase nach P14.13) – reicht für
  ~8 Phasen/Monat, aber nicht 0.

## 5. Was sich für Jutta ändert

Nichts im Alltag: Vorschauen kommen weiter als HTML im Chat; PR-Texte nennen „Prüfungen lokal grün“ statt
„CI grün“. Einmalig: Repository auf privat stellen, Actions abschalten, Budget 0 € setzen (Anleitung im Chat).
