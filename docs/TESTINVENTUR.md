# Testinventur (P10.1)

Stand: 06.10.2026 (Phase P10). Wer wissen will, ob eine Anforderung oder ein Akzeptanzkriterium getestet ist, schaut
**nicht hier**, sondern lässt die beiden Nachverfolgungs-Tests entscheiden. Diese Seite erklärt nur, wo was liegt.

## Was liegt wo

| Art | Ordner | Dateien | Testfälle (ca.) | Läuft mit |
|---|---|---|---|---|
| Unit | `tests/unit/**/*.unit.spec.ts` | 225 | 1 560 | `pnpm test:unit` (in `pnpm check`), ohne Datenbank und Netz |
| Integration | `tests/int/**/*.int.spec.ts` | 168 | 1 000 | `pnpm test:int` gegen Postgres (`DATABASE_URL_TEST`) |
| E2E | `tests/e2e/**/*.e2e.spec.ts` | 121 | 790 | `pnpm test:e2e` (Playwright: `desktop`, `iphone-15`, `pixel-7`) |
| Vorschau-Datei | `tests/e2e/preview-export.e2e.spec.ts`, `preview-portable.e2e.spec.ts` | 2 | – | `pnpm test:preview-export` / `pnpm test:preview-portable` |
| Visuell | `tests/visual/*.visual.spec.ts` | 16 | – | `ci-full.yml`, Referenzbilder per `[ci:update-snapshots]` |
| Kunst-QA | `tests/art/*.art.spec.ts` | 18 | 19 | `art-qa.yml` (`[ci:art]`, nur P9) |
| Performance | `tests/perf/` | – | – | Lighthouse-CI und Budgets (`ci-full.yml`) |

Die Zahlen sind gerundet und werden nicht automatisch gepflegt.

## Nachverfolgung

1. **Rechtsanforderungen (R-001):** `tests/unit/legal/traceability.unit.spec.ts` liest die Tabelle in
   `docs/recht/ANFORDERUNGEN.md` §3. Jede Zeile mit Test-Art `unit`, `int` oder `e2e` bis `LEGAL_TRACE_PHASE = 10` braucht
   einen Testtitel mit der R-ID und in der Spalte „Nachweis“ existierende Testdateien (bzw. `§7` für manuelle Punkte).
2. **Akzeptanz-IDs:** `tests/unit/meta/ak-trace.unit.spec.ts` sammelt alle Akzeptanz-IDs aus KONZEPT (`AK-n-nn`, `EK-nn`),
   DATENMODELL (`DM-…`), ARCHITEKTUR (`AK-A-n-nn`, `T-01…T-22`), DESIGN (`AK-DS-nn`) und SEED-SPEC (`AK-SEED-nn`) und
   verlangt je ID einen Testtitel mit dieser ID **oder** einen Eintrag in `tests/manual-checks.json` (mit Begründung und
   Phase). Beide Tests haben eine Gegenprobe: Wird eine ID aus einem Testtitel entfernt, wird der Test rot.
3. **Testdisziplin:** derselbe Meta-Test verbietet `test.only` und erlaubt `test.fixme` nur mit Eintrag in
   `docs/OFFENE-PUNKTE.md` und nie bei Kasse, Reservierung oder Recht (ARCHITEKTUR §7.2).

## Manuelle Prüfpunkte (`tests/manual-checks.json`)

| ID | Phase | Warum nicht automatisch |
|---|---|---|
| AK-1-01 | P10 | Summenkriterium – belegt durch den grünen Phasenlauf ohne Zugangsdaten |
| EK-08 | P11 | Stoppuhr-Teil mit Jutta (der automatische Teil steht in den E2E-Tests) |
| EK-10 | P11 | Kosten ≤ 25 €/Monat aus echten Rechnungen nach dem Go-live |
| EK-12 | P9 | Kunst-Qualität per Studio-QA-Verfahren (`docs/design/KUNST-QA.md`) |
| AK-A-12-01 | P11 | DNS-Umstellung und Testmail an das echte Postfach |
| AK-A-12-02 | P11 | Weiterleitungen, Zertifikat und HSTS an der echten Domain |
| AK-A-12-03 | P11 | Rechnungen des ersten vollen Monats |

Rein manuelle Rechtsanforderungen (R-157, R-161, R-190 u. a.) stehen mit `§7` in der Nachweis-Spalte und werden mit der
Checkliste in `docs/recht/ANFORDERUNGEN.md` §7 abgenommen.

## Abdeckung (`pnpm test:coverage`)

v8, Unit und Integration zusammengeführt, Konfiguration `vitest.coverage.config.mts`. Schwellen (ARCHITEKTUR §7.8):
`src/lib/{commerce,payments,security,legal}/**` mindestens 90 % Zeilen und 85 % Zweige, `src/lib/**` gesamt mindestens
70 % Zeilen. Der Lauf ist Teil des Jobs `quality` in `ci-full.yml` (zusätzlich `test:unit` mit `TZ=Europe/Berlin`).
