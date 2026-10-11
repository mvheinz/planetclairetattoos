# Betriebshandbuch (RUNBOOK) – planetclairetattoos.com

Stand: P10.15 (05.10.2026). Dieses Handbuch ist für die Person, die die Seite betreibt: Jutta mit einer Claude-Session
(„Session starten“, Abschnitt 5) oder eine technisch versierte Vertrauensperson. Quelle der Wahrheit für alle Namen und
Werte ist `docs/ARCHITEKTUR.md` (Verweise `§…`), für Entscheidungen `docs/ENTSCHEIDUNGEN.md`. **In diesem Dokument stehen
keine Geheimnisse und keine Werte von Zugangsdaten** – Werte liegen im Passwort-Manager von Jutta bzw. in Vercel
(ARCHITEKTUR §5.3, §8.9). Die Einrichtung der Konten und die DNS-Umstellung beim Start beschreibt `docs/GO-LIVE.md`.

Grundregeln für jeden Eingriff:

1. Erst atmen, dann schreiben: jeden Vorfall im **Vorfallprotokoll** (Abschnitt 13) festhalten – Zeit, was gesehen wurde, was getan wurde.
2. Nichts an Produktionsdaten ändern, was nicht rückgängig zu machen ist, ohne vorher ein Backup (Abschnitt 6) zu prüfen.
3. Geheimnisse nie in Chats, PR-Texte, Dokumente oder Bildschirmfotos kopieren (ARCHITEKTUR §8.9). Claude zeigt nur, wohin etwas gehört; Jutta tippt Passwörter, Schlüssel und Karten selbst ein.
4. Wiederherstellungen laufen nie in einer Claude-Cloud-Session oder in GitHub Actions, sondern lokal (§10.5, A-12).

## 1. Überblick und Topologie

```
 Besucher:innen / Jutta (Handy, PWA)                    IONOS: DNS-Zone und Postfach jutta@ (MX unverändert)
            │ HTTPS                                             ▲
            ▼                                                   │ Benachrichtigungen, Kundenmails
 Vercel Edge (TLS, CDN, Cron) ──► Vercel Functions fra1: Next.js 16 + Payload 3 (Node 24)
                                    │            │             │             │            │
                              Neon Postgres 17   Cloudflare R2  Lettermint    Stripe API   DeepL API, Sentry EU
                              aws-eu-central-1   EU, pct-*      SMTP (EU)     (Server)     (nur Server)
 Stripe ──Webhooks──► /api/stripe/webhook          Vercel Cron ──► /api/cron/tick (jede Minute)
 Stripe.js ◄── nur Kasse R07 (Browser)                         └─► /api/cron/backup (01:30 UTC)
```

(Quelle: ARCHITEKTUR §12.1.) Alle Dienste, ihre Rolle und Auftragsverarbeitungsverträge stehen in
`docs/recht/DIENSTE.md`. Umgebungen: lokal, CI, Vorschau-Export, Preview, Staging, Produktion (ARCHITEKTUR §4.1); fachliche
Regeln hängen nur an `APP_ENV` (§4.2). Nützliche Adressen der laufenden Seite:

| Adresse | Zweck |
|---|---|
| `/api/health` | App läuft; mit `?deep=1` (Bearer `CRON_SECRET`) auch Datenbank, Speicher, Zahlung |
| `/api/health/freshness` | Frische von Job-Wecker und Backup, ohne Datenbankzugriff (503 bei „late“) |
| `ADMIN_ROUTE` | Verwaltung (der Pfad ist nicht öffentlich; nur im Passwort-Manager) |
| Verwaltung → Einstellungen → System | Version, Job-Läufe, fehlgeschlagene Mails, Backup-Stand, Startklar-Prüfung |

## 2. Konfiguration (alle Variablen, ohne Werte)

Einzige Quelle im Code ist `src/lib/env.ts` (Schema `src/lib/env.schema.ts`); die Vorlage ist `.env.example`
(`pnpm env:example` erzeugt sie neu, `pnpm check` prüft sie). Spalte „Pflicht in“ aus ARCHITEKTUR §5.2. Werte je
Umgebung stehen in Vercel (Production / Preview / Staging getrennt, Geheimnisse als „Sensitive“), nie im Repository.
Zusammenfassung je Umgebung (ARCHITEKTUR §4.1): Produktion braucht `STORAGE_DRIVER=s3`, `EMAIL_DRIVER=smtp`,
`PAYMENTS_DRIVER=stripe` (Live) und `TRANSLATION_DRIVER=deepl`; Staging dasselbe mit Stripe-**Test** und
`MAIL_REDIRECT_ALL_TO`; Preview mit Mock-Zahlung; lokal und CI mit `local`/`file`/`mock`. Das Startprogramm bricht in
Produktion ab, wenn eine Regel verletzt ist (`assertProductionEnv`, ARCHITEKTUR §4.3) – die Meldung nennt alle Verstöße.

#### Kern und Laufzeit

| Variable | Zweck | Pflicht in | Geheim |
|---|---|---|---|
| `APP_ENV` | Umgebungskennung: development / test / preview / staging / production (ARCHITEKTUR §4.2) | CI, prev, stag, prod | nein |
| `DATABASE_URL` | Postgres-Verbindung der App (Neon: gepoolte URL mit -pooler) | alle | ja (stag/prod) |
| `DATABASE_URL_UNPOOLED` | Direkte Verbindung für Migrationen, Backup, db:*-Skripte (leer = DATABASE_URL) | prod/stag empfohlen | ja |
| `DATABASE_URL_TEST` | Test-Datenbank für test:int/test:e2e – wird geleert! | dev/test | nein |
| `DB_POOL_MAX` | Größe des pg-Pools (Int-Tests 25, Vercel 5) | – | nein |
| `PAYLOAD_SECRET` | Payload-Signaturen und Wurzel für abgeleitete Schlüssel (HKDF, ARCHITEKTUR §8.6); mindestens 32 zufällige Zeichen | alle | ja |
| `PAYLOAD_DB_PUSH` | Schema-Push, nur auf einer Wegwerf-Datenbank lokal | – | nein |
| `NEXT_PUBLIC_SITE_URL` | Kanonische Basis-URL ohne / am Ende | alle | nein |
| `ADMIN_ROUTE` | Pfad der Verwaltung (nicht /admin, E-93) | alle | nicht veröffentlichen |
| `CRON_SECRET` | Bearer für /api/cron/*, /api/health?deep=1, /api/payload-jobs/run (mindestens 32 Zeichen) | stag/prod (lokal Beispielwert) | ja |
| `JOBS_AUTORUN` | Payload jobs.autoRun im Prozess (true lokal/Docker, false Vercel/Tests) | – | nein |
| `LOG_LEVEL` | Log-Stufe: debug / info / warn / error | – | nein |
| `MAINTENANCE_MODE` | Wartungsmodus (ARCHITEKTUR §10.5) | – | nein |
| `TZ` | Prozess-Zeitzone, immer UTC (Code rechnet mit Europe/Berlin) | CI, Tests | nein |

#### Beispielbestand, Vorschau, QA

| Variable | Zweck | Pflicht in | Geheim |
|---|---|---|---|
| `SEED_PREVIEW_MODE` | Seed-Medien ohne Einwilligung und Banner zeigen (nie in Produktion, R-181) | – | nein |
| `SEED_NOW` | Referenzzeit des Beispielbestands (ISO 8601 mit Offset; leer = jetzt) | – | nein |
| `SEED_ADMIN_EMAIL` | Admin-Konto des Grund-Seeds (nur außerhalb von Produktion) | dev/test | nein |
| `SEED_ADMIN_PASSWORD` | Passwort dazu (nur Testwert, mindestens 12 Zeichen) | dev/test | Testwert |
| `PREVIEW_EXPORT` | Export-Modus der Vorschau-Datei (Kasse als Attrappe, keine Analytics) | – | nein |
| `PREVIEW_PHASE` | Phasen-Kennung für Banner, Bericht und Artefakt-Namen (leer = aus PLAN.md) | – | nein |
| `NEXT_PUBLIC_LEASH_DEBUG` | window.__leash/window.__qa einbauen (DESIGN §9.13) | E2E-Build | nein |
| `ART_QA` | QA-Seiten /{locale}/qa/* (KUNST-QA §3.1) | – | nein |

#### Speicher

| Variable | Zweck | Pflicht in | Geheim |
|---|---|---|---|
| `STORAGE_DRIVER` | Speicher-Treiber: local / s3 | alle | nein |
| `STORAGE_LOCAL_DIR` | Wurzelordner für local | – | nein |
| `S3_ENDPOINT` | S3-Endpunkt (R2: https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com) | wenn `s3` | nein |
| `S3_REGION` | Region | wenn `s3` | nein |
| `S3_BUCKET` | Bucket für media und documents | wenn `s3` | nein |
| `S3_PRIVATE_BUCKET` | Bucket für private-uploads und Systemdateien | wenn `s3` | nein |
| `S3_ACCESS_KEY_ID` | Zugangsschlüssel (R2-Token nur für diese zwei Buckets) | wenn `s3` | ja |
| `S3_SECRET_ACCESS_KEY` | Geheimnis dazu | wenn `s3` | ja |
| `S3_FORCE_PATH_STYLE` | Pfad-Adressierung (R2/MinIO) | wenn `s3` | nein |

#### E-Mail

| Variable | Zweck | Pflicht in | Geheim |
|---|---|---|---|
| `EMAIL_DRIVER` | Mail-Treiber: file / smtp / memory / log | alle | nein |
| `EMAIL_FILE_DIR` | Ablage für den Treiber file | – | nein |
| `SMTP_HOST` | SMTP-Server (Mailpit lokal, Lettermint in Produktion) | wenn `smtp` | nein |
| `SMTP_PORT` | Port (1025 Mailpit, 587 STARTTLS oder 465) | wenn `smtp` | nein |
| `SMTP_SECURE` | true nur bei Port 465 | – | nein |
| `SMTP_USER` | SMTP-Benutzer | wenn `smtp` prod | ja |
| `SMTP_PASS` | SMTP-Passwort/Token | wenn `smtp` prod | ja |
| `MAIL_FROM` | Absender | alle | nein |
| `MAIL_REPLY_TO` | Antwortadresse | alle | nein |
| `ADMIN_NOTIFY_EMAIL` | Startwert/Rückfall für settings.adminNotificationEmail | alle | nein |
| `MAIL_REDIRECT_ALL_TO` | Alle Mails an diese Adresse (nur außerhalb von Produktion) | stag | nein |

#### Zahlung

| Variable | Zweck | Pflicht in | Geheim |
|---|---|---|---|
| `PAYMENTS_DRIVER` | Zahlungs-Treiber: mock / stripe | alle | nein |
| `STRIPE_SECRET_KEY` | Stripe-Server-Schlüssel (sk_test_/rk_test_; Live nur in Produktion) | wenn `stripe` | ja |
| `STRIPE_WEBHOOK_SECRET` | Signatur-Geheimnis des Webhook-Endpunkts (whsec_…) | wenn `stripe` (stag/prod) | ja |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe-Browser-Schlüssel (nur Kasse) | wenn `stripe` | nein |
| `STRIPE_API_BASE_URL` | Nur Tests gegen stripe-mock | – | nein |

#### Übersetzung, Versand, Statistik, Monitoring

| Variable | Zweck | Pflicht in | Geheim |
|---|---|---|---|
| `TRANSLATION_DRIVER` | Übersetzungs-Treiber: mock / deepl | alle | nein |
| `DEEPL_API_KEY` | DeepL API Free (…:fx) | wenn `deepl` | ja |
| `CARRIER_DRIVER` | Versanddienst-Adapter: manual | – | nein |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | Vercel Web Analytics rendern (wirksam ab P10) | – | nein |
| `NEXT_PUBLIC_CLIENT_ERRORS_ENABLED` | Browser-Fehlermeldungen an POST /api/client-errors (nur Produktion, nach K-30 c) | – | nein |
| `SENTRY_DSN` | Sentry EU, leer = aus | prod/stag optional | ja |
| `SENTRY_ENVIRONMENT` | Umgebungsname in Sentry (leer = APP_ENV) | – | nein |

#### Backup (nur Produktion, §10)

| Variable | Zweck | Pflicht in | Geheim |
|---|---|---|---|
| `BACKUP_ENABLED` | Nächtliches Backup aktiv | prod (ab P11) | nein |
| `BACKUP_S3_BUCKET` | Backup-Bucket (EU) | wenn aktiv | nein |
| `BACKUP_S3_ACCESS_KEY_ID` | Eigener R2-Token nur für den Backup-Bucket | wenn aktiv | ja |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Geheimnis dazu | wenn aktiv | ja |
| `BACKUP_AGE_RECIPIENT` | Öffentlicher age-Schlüssel (age1…) für die Verschlüsselung | wenn aktiv | nein (öffentlich) |

#### Build und Test

| Variable | Zweck | Pflicht in | Geheim |
|---|---|---|---|
| `NEXT_OUTPUT_STANDALONE` | output: standalone (Docker) | Docker | nein |
| `BUILD_WITHOUT_DB` | Build ohne DB-Zugriff (Docker) | Docker | nein |
| `NEXT_TELEMETRY_DISABLED` | Next-Telemetrie aus | CI, Docker | nein |
| `NEXT_DIST_DIR` | Build-Ordner (leer = .next; Vorschau-Export .next-preview) | – | nein |
| `PREVIEW_EXPORT_DB_NAME` | Nur parallele Vorschau-Exporte: eigene Wegwerf-DB (planetclaire_…preview…; leer = planetclaire_preview_export) | – | nein |
| `PREVIEW_EXPORT_PORT` | Nur parallele Vorschau-Exporte: eigener Port des Export-Servers (leer = 3999) | – | nein |
| `PREVIEW_INVENTORY` | Bestand der Vorschau-Datei: bestand = Juttas echte Stücke (leer = bestand), demo = Beispielbestand | – | nein |
| `E2E_BASE_URL` | Ziel der E2E-Tests | – | nein |
| `E2E_SERVER` | dev (lokal) oder start (CI: Produktions-Build) | – | nein |
| `PW_SKIP_WEBKIT` | Nur wenn die WebKit-Installation scheitert (nie in CI) | – | nein |

## 3. Deploy, Rollback und Migrationen

- **Deploy:** Push bzw. Merge auf `main` → Vercel baut Produktion; Branch `staging` → Staging; Pull Request → Preview
  (ARCHITEKTUR §4.7, §6.9). Build-Befehl: `pnpm payload migrate && pnpm build`. Vorher muss die Startklar-Prüfung
  (`pnpm check:golive`) für den Shop-Start grün sein (nur beim ersten Start relevant, `docs/GO-LIVE.md`).
- **Nach jedem Deploy prüfen:** `/api/health` = 200, Verwaltung → System zeigt die neue Version
  (`VERCEL_GIT_COMMIT_SHA`), keine neuen Sentry-Meldungen in den ersten 15 Minuten.
- **Rollback (Code):** Vercel → Deployments → letztes grünes Deployment → „Instant Rollback“. Das rollt **nur den Code**,
  nicht die Datenbank. Deshalb sind Migrationen **rückwärtsverträglich**: erst erweitern, später aufräumen; eine
  Migration entfernt oder benennt nie eine Spalte um, die der zuletzt deployte Code noch liest (ARCHITEKTUR §6.7 Nr. 5).
  Geht ein Rollback nicht (Migration war nicht verträglich), gilt ein **Hotfix-PR** (Abschnitt 5, Session starten).
- **Migration anlegen:** `pnpm payload migrate:create <name>`, generierte Dateien nie von Hand ändern; eigenes SQL nur in
  einer eigenen Migration. Drift prüft `pnpm check:migrations`. **Kein** Schema-`push` außerhalb lokaler Entwicklung.
- **Datenbank-Schutz:** Nach dem ersten Grund-Seed einmalig `pnpm db:mark-production --yes`; danach brechen Seed, Reset und
  Test-Setups gegen diese Datenbank ab (ARCHITEKTUR §4.8). `db:reset` ist nur für Test-Datenbanken.

## 4. Geheimnisse tauschen

Regeln: 2-Faktor-Anmeldung auf allen Konten; neue Werte immer zuerst im Passwort-Manager speichern, dann in Vercel
eintragen (Sensitive), dann neu deployen, dann den alten Wert im Dienst ungültig machen. Jutta tippt Werte selbst ein.

| Geheimnis | Wann tauschen | Verfahren | Wirkung |
|---|---|---|---|
| `PAYLOAD_SECRET` | bei Verdacht (Leck, Fremdzugriff) | neuen Zufallswert (mindestens 32 Zeichen, 64 Hex-Zeichen empfohlen) erzeugen; in Vercel je Umgebung **eigener** Wert; neu deployen | alle Anmeldungen ungültig, in der Verwaltung neu anmelden; Status-Links aus Mails werden bei der nächsten Mail erneuert; Links für Datenschutz-Auskünfte neu senden (ARCHITEKTUR §8.6) |
| `CRON_SECRET` | jährlich und bei Verdacht | neuen Wert (mindestens 32 Zeichen) in Vercel setzen, neu deployen; Vercel sendet den neuen Wert selbst | keine Auswirkung für Besucher:innen; Docker: `scheduler` neu starten |
| Neon-Passwort (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`) | bei Verdacht | in Neon „Reset password“; beide URLs in Vercel aktualisieren; neu deployen | kurzer Fehler bis zum Deploy; Jobs holen sich die neue URL beim nächsten Tick |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | bei Verdacht oder Mitarbeiterwechsel | in Stripe den Schlüssel „Roll key“ (alten Schlüssel mit kurzer Übergangsfrist lassen) bzw. beim Webhook-Endpunkt das Signaturgeheimnis rollen; Vercel aktualisieren; neu deployen; Testzahlung im Testmodus bzw. Test-Ereignis senden | bis zum Deploy können Webhooks fehlschlagen – Stripe wiederholt sie bis zu 3 Tage; danach `pnpm payments:reconcile --since=<ISO>` |
| R2-Tokens (`S3_*`, `BACKUP_S3_*`) | jährlich, bei Verdacht | in Cloudflare neuen Token anlegen (App-Token nur für `pct-media-*`/`pct-private-*`, Backup-Token nur für `pct-backups`), Vercel aktualisieren, neu deployen, alten Token löschen | Bilder und private Dateien kurz nicht erreichbar bis zum Deploy; Backup-Lauf danach manuell prüfen (`/api/cron/backup` mit Bearer) |
| `SMTP_PASS`, `DEEPL_API_KEY`, `SENTRY_DSN` | bei Verdacht | im jeweiligen Dienst neu erzeugen, Vercel aktualisieren, neu deployen | Mails bleiben bis zum Deploy liegen und werden wiederholt (M-08); Übersetzen-Knopf bzw. Fehlermeldungen kurz aus |
| privater age-Schlüssel (Backup-Entschlüsselung) | nie routinemäßig | liegt **nur offline** (Passwort-Manager und Ausdruck bei Jutta); bei Verlust neuen Schlüssel erzeugen, `BACKUP_AGE_RECIPIENT` in Vercel ersetzen | nur neue Backups sind mit dem neuen Schlüssel lesbar – alte brauchen den alten |

Wurde ein Geheimnis womöglich offengelegt, gilt zusätzlich Abschnitt 9 (Datenpanne) – Bewertung, ob personenbezogene
Daten betroffen sein können.

## 5. Sicherheitsupdate (Verfahren)

1. **Auslöser:** Dependabot-Sicherheitsmeldung (GitHub-Mail), roter `pnpm audit`-Lauf in CI, Hinweis von Vercel/Next.js
   (M-11). Frist: **48 Stunden** für Sicherheits- und Next.js-Patch-Updates (ARCHITEKTUR §1.3).
2. **Session starten:** Jutta öffnet Claude Code im Browser mit dem Repository `planetclairetattoos` (Anleitung
   `docs/owner/HANDBUCH.md`, Kapitel „Notfall und Hilfe“) und schreibt: „Bitte spiel das Sicherheitsupdate aus der
   Dependabot-Meldung ein, Verfahren siehe docs/RUNBOOK.md Abschnitt 5.“
3. **Die Session:** prüft `pnpm audit --prod` und offene Dependabot-PRs, behebt `high`/`critical` vor allem anderen,
   hält die Versionsregeln ein (alle `@payloadcms/*` exakt gleich `payload`; `eslint-config-next` = `next`; `react` =
   `react-dom`; keine Bereichsangaben, `pnpm check:versions`), legt bei Payload-Minor eine Migration an, lässt `pnpm check`,
   `pnpm test:int` und `pnpm build` laufen und öffnet einen PR (CI muss grün sein).
4. **Merge:** Jutta klickt „Merge“ (Squash). Danach Abschnitt 3 „Nach jedem Deploy prüfen“. Ab Start Automerge für
   Patch-Updates (ARCHITEKTUR §1.3).
5. **Keine Lösung innerhalb von Payload 3.x bzw. Next 16.3.x:** dokumentierte Ausnahme (ARCHITEKTUR §8.10) im
   Vorfallprotokoll und in `docs/OFFENE-PUNKTE.md` festhalten, Risiko bewerten. Payload 4 wird nicht eingeführt.

## 6. Backups und Wiederherstellung

**Ziele:** Datenverlust höchstens 24 Stunden (RPO), wieder online höchstens 4 Stunden nach der Entscheidung (RTO). Backups
liegen ausschließlich in R2 (EU), verschlüsselt mit age **vor** dem Upload; Aufbewahrung täglich 30 Tage, monatlich
12 Monate (ARCHITEKTUR §10.1). Kein Backup über GitHub Actions oder Claude-Cloud (BK-1).

| Was | Wie oft | Wo |
|---|---|---|
| Datenbank-Dump „pcdump v1“ | täglich 01:30 UTC (`GET /api/cron/backup`, Bearer `CRON_SECRET`) | `pct-backups`, `db/daily/…` (30 Tage), Monatsstand `db/monthly/…` (365 Tage) |
| Private Dateien und Belege | täglich nach dem Dump (Spiegel) | `files/private/…` |
| Medien | wöchentlich (Sonntag) | `files/media/…` |

**Kontrolle:** Verwaltung → System zeigt Zeit, Größe und Monatsstand des letzten Backups; älter als 30 Stunden macht
`/api/health/freshness` rot (Alarm M-06). Skripte: `pnpm backup:run [--to=file:<pfad>|s3] [--recipient=age1…]`,
`pnpm backup:verify --key=<db/…>|--input=<datei> [--sha256=<hex>]` (prüft ohne Entschlüsselung),
`pnpm backup:restore (--input=<datei>|--key=<db/…>) --identity=<pfad> --target=<URL der leeren Datenbank> [--skip-migrate]`.

### 6.1 Welche Wiederherstellung?

| Lage | Weg |
|---|---|
| Fehler im Code nach einem Deploy, Daten intakt | Vercel „Instant Rollback“ (Abschnitt 3) – keine Datenwiederherstellung |
| Datenfehler, jünger als das Neon-Wiederherstellungsfenster | Neon: Zweig aus einem Zeitpunkt vor dem Fehler anlegen, prüfen, übernehmen; danach Schritte 1 und 5–8 |
| Datenfehler älter, Neon-Projekt verloren oder Anbieterwechsel | eigenes Backup: Schritte 1–8 |
| einzelne private Datei oder ein Bild fehlt | Spiegel-Objekt unter `files/…` in `pct-backups` (Name = SHA-256 des Quell-Schlüssels; Zuordnung in `files/state.json.age`) herunterladen, mit dem age-Werkzeug und der Schlüsseldatei entschlüsseln (`age --decrypt -i <schlüsseldatei> <objekt>.age`), Upload über die Verwaltung. Ein eigenes Skript dafür gibt es nicht (Eintrag in `docs/OFFENE-PUNKTE.md`) |

### 6.2 Schritt für Schritt

**Wer und wo:** lokal auf dem Rechner von Jutta oder einer Vertrauensperson (Node 24, Repo-Klon auf dem Commit
`appVersion` des Backups). Den privaten age-Schlüssel nur als Datei übergeben (`--identity=<pfad>`), nie als Variable.

1. **Wartungsmodus** an (Abschnitt 7). Stripe-Webhooks erhalten 503 und werden wiederholt; „Vertrag widerrufen“ bleibt nutzbar.
2. **Ziel anlegen:** leere Datenbank `planetclaire_restore` im Neon-Projekt.
3. **Einspielen:** `pnpm backup:restore --key=<db/…> --identity=<pfad> --target=<URL der leeren DB>`. Das Skript prüft Ziel
   leer und nicht als Produktion markiert, Format und `sha256`, führt Migrationen bis `lastMigration` aus, lädt alle
   Tabellen und vergleicht Zeilenzahl und `md5` je Tabelle (Abweichung → Abbruch, Exit-Code 1).
4. **Markieren:** `pnpm db:mark-production --yes` gegen das Ziel.
5. **Umschalten:** `DATABASE_URL` und `DATABASE_URL_UNPOOLED` in Vercel auf die neue Datenbank, neu deployen (weiter
   Wartungsmodus). Alte Datenbank in `planetclaire_broken_<YYYYMMDD>` umbenennen, nach 30 Tagen löschen.
6. **Nacharbeiten in der App** (Verwaltung → System → „Nach Wiederherstellung abgleichen“, nur im Wartungsmodus sichtbar), in
   dieser Reihenfolge: a) `retention:replay` (Löschprotokoll erneut anwenden); b) Zahlungsabgleich ab Backup-Zeit minus
   1 Stunde (Käufe und Erstattungen nach dem Backup entstehen neu, verkaufte Unikate werden wieder „verkauft“); c) Belegnummern
   auf die höchste gefundene Nummer setzen; d) Bericht lesen (Lücke, nachgeholte Ereignisse, fehlende Belege, Vorkasse-
   Bestellungen, Anfragen und Widerrufe aus dieser Zeit, Widerrufe aus der alten Datenbank übernehmen). Dieselbe Logik als
   Skripte: `pnpm retention:replay [--now=<ISO>] [--yes-production]` und `pnpm payments:reconcile [--since=<ISO>]`.
7. **Wieder öffnen:** `MAINTENANCE_MODE=false`, neu deployen.
8. **Prüfen:** `/api/health?deep=1` = ok, Anmeldung in der Verwaltung, letzte Bestellungen sichtbar, ein Stück öffentlich
   sichtbar, Stripe-Dashboard ohne offene Webhook-Fehler; Eintrag im Vorfallprotokoll.

### 6.3 Übung (halbjährlich)

Automatisch läuft die Übung mit synthetischen Daten (Int-Test `tests/int/backup/roundtrip.int.spec.ts`, Workflow
`restore-drill.yml`). **Manuell, halbjährlich** (Termine im Protokoll, Abschnitt 14): jüngstes Produktions-Backup lokal in
eine Wegwerf-Datenbank `planetclaire_drill` einspielen (Schritte 2–3), Stichprobe (letzte Bestellung vorhanden), Datenbank
löschen, Datum und Ergebnis im Protokoll vermerken. Ein Backup, das nie wiederhergestellt wurde, gilt als nicht vorhanden (BK-6).

## 7. Wartungsmodus

- **Einschalten:** in Vercel (Produktion) `MAINTENANCE_MODE=true` setzen und neu deployen.
- **Wirkung:** öffentliche Seiten antworten 503 mit Hinweis; erreichbar bleiben Impressum, Datenschutz, AGB,
  Widerrufsbelehrung und „Vertrag widerrufen“ samt Fußlink. Kasse und übrige Formulare sind gesperrt, der Stripe-Webhook
  antwortet 503 (Stripe wiederholt), der Tick antwortet 204, `/api/health/freshness` bleibt 200 mit `maintenance: true`
  (keine Fehlalarme). Widerrufe arbeiten normal, solange die Datenbank erreichbar ist; sonst zeigt die Seite den Widerruf
  per E-Mail (an `MAIL_REPLY_TO`).
- **Ausschalten:** `MAINTENANCE_MODE=false`, neu deployen, Abschnitt 3 „Nach jedem Deploy prüfen“. Nach einer
  Wiederherstellung erst nach den Nacharbeiten (6.2 Schritt 6).

## 8. Alarme M-01 bis M-12

Alarme enthalten keine Personendaten, nur IDs und Nummern. In-App-Alarme (Mails A01–A12) gehen an
`settings.adminNotificationEmail`, Dienst-Alarme an `jutta@planetclairetattoos.com` (IONOS-Postfach, unabhängig von
Lettermint). Gleiche Alarme werden gedrosselt (höchstens eine Mail je Fehlerart und Stunde).

| ID | Signal | Was tun |
|---|---|---|
| M-01 | Unbehandelte Serverfehler (Sentry-Mail „neues Problem“ oder „Rückfall“) | Sentry-Meldung lesen (nur IDs, keine Personendaten), betroffene Seite/Aktion notieren, Session starten und Fehler beheben lassen; bei Geldbezug zusätzlich M-03 |
| M-02 | Browserfehler öffentlicher Seiten (nur, wenn `NEXT_PUBLIC_CLIENT_ERRORS_ENABLED=true`; Standard aus) | wie M-01; bei „mehr als 20 Ereignisse je Stunde“ prüfen, ob ein Deploy die Seite kaputt gemacht hat → Rollback (Abschnitt 3) |
| M-03 | Geldrelevante Fehler (Webhook-Verarbeitung, Erstattung, Doppelzahlung, Anfechtung, Prüfsumme; Mails A06/A07/A08/A12, Hinweis unter „Heute“) | Mailtext befolgen: A06 doppelt bezahlt – wurde automatisch erstattet, Status in der Bestellung prüfen; A07 Zahlung angefochten – Belege (Sendungsnummer, Rechnung, Packfotos) im Stripe-Dashboard vor Ablauf der Antwortfrist einreichen; A08 Erstattung fehlgeschlagen – Fehlermeldung lesen, im Stripe-Dashboard manuell erstatten; A12 technischer Fehler – Bestellung öffnen, Zahlung in Stripe gegenprüfen |
| M-04 | Webhooks kommen nicht an (Stripe-Mail, A12 vom Abgleich) | Stripe → Webhook-Endpunkt: URL (`/api/stripe/webhook`), Status und Signaturgeheimnis prüfen; `STRIPE_WEBHOOK_SECRET` in Vercel; danach `pnpm payments:reconcile --since=<ISO>` (Standard: 3 Tage) |
| M-05 | Jobs laufen nicht (`/api/health/freshness` = 503 mit `jobs: late`) | Vercel → Cron-Protokoll von `/api/cron/tick` prüfen (Aufruf jede Minute, Bearer `CRON_SECRET`); `CRON_SECRET` stimmt?; einmalig Verwaltung → System → „Jetzt ausführen“ bzw. `pnpm jobs:run <task>`; Neon-Kontingent prüfen (M-09) |
| M-06 | Backup fehlgeschlagen oder älter als 30 Stunden (A12, Sentry, `backup: late`) | Verwaltung → System: Fehlercode lesen; R2-Token (`BACKUP_S3_*`) und `BACKUP_AGE_RECIPIENT` prüfen; Backup manuell auslösen (`/api/cron/backup` mit Bearer) oder `pnpm backup:run`; `pnpm backup:verify --key=<db/…>`; bei Dauerfehler Abschnitt 6 |
| M-07 | Website nicht erreichbar (Sentry Uptime: `/api/health` und `/api/health/freshness`, alle 5 Minuten, Alarm nach 2 Fehlschlägen) | Vercel-Status und Neon-Status ansehen; Vercel → letzte Deployments (Rollback, Abschnitt 3); `/api/health?deep=1` zeigt, welche Verbindung fehlt; bei längerem Ausfall Docker-Umzug (Abschnitt 12) erwägen |
| M-08 | Mails bleiben liegen (A12, Lettermint-Kontomail) | Verwaltung → System → fehlgeschlagene Mails: „erneut senden“; Lettermint-Konto (Kontingent, Domain-Status, SMTP-Zugang `SMTP_PASS`) prüfen; DKIM/SPF der Versanddomain prüfen (Abschnitt 11) |
| M-09 | Kosten und Kontingente (Vercel Spend Management, Neon, Cloudflare) | Kosten-Routine (Abschnitt 10); Neon-Free-Kontingent beachten, weil ein Erreichen die Datenbank stoppt = Ausfall |
| M-10 | Domain, DNS, Zertifikat (Vercel-Mail) | Vercel → Project → Domains: Status; DNS-Einträge bei IONOS mit Abschnitt 11 vergleichen (`dig`); nur Web-Einträge ändern, MX/SPF/DKIM/DMARC nie |
| M-11 | Sicherheitslücken in Abhängigkeiten (Dependabot, CI rot) | Abschnitt 5 (Sicherheitsupdate), Frist 48 Stunden |
| M-12 | Fristen (A09 Umsatz-Wächter, A10 Rechtstexte prüfen, `complianceDocsReview`) | Mailtext befolgen: A09 Schwelle erreicht – Steuerberatung informieren (Umsatz-Wächter in der Verwaltung); A10 – Rechtstexte von der Kanzlei prüfen lassen; Compliance-Dokumente prüfen |

Sentry-Projekteinstellungen (Region EU/Frankfurt, IP-Speicherung aus, Data Scrubber an, kürzeste Aufbewahrung, Alarmregeln
M-01, M-02, M-07, 2FA) stehen in `docs/GO-LIVE.md`.

## 9. Datenpanne (R-157, Art. 33 und Art. 34 DSGVO)

Eine Datenpanne ist jede Verletzung der Sicherheit, die zu Vernichtung, Verlust, Veränderung oder unbefugter Offenlegung von
personenbezogenen Daten führt – auch ein verlorenes Handy mit offener Verwaltung, eine falsch versendete Mail mit Namen
oder ein Fremdzugriff auf ein Konto. **Frist: Meldung an die Aufsichtsbehörde spätestens 72 Stunden, nachdem die Panne
bekannt wurde** (die Uhr startet bei Kenntnis, auch am Wochenende).

### 9.1 Erkennen

Hinweise: Sentry-Mail (M-01/M-03), Meldung eines Dienstleisters (Vercel, Neon, Cloudflare, Stripe, Lettermint, IONOS),
Kund:innen-Hinweis („ich habe fremde Daten in meiner Mail“), ungewöhnliche Anmeldungen, verlorenes Gerät, verlegter
Passwortzettel. Jede Vermutung sofort mit Zeitpunkt im Vorfallprotokoll notieren (Abschnitt 13).

### 9.2 Sofortmaßnahmen (in dieser Reihenfolge)

1. Weiteren Schaden stoppen: betroffenes Geheimnis tauschen (Abschnitt 4), Konto sperren bzw. Passwort ändern,
   Wartungsmodus einschalten (Abschnitt 7), `pnpm admin:unlock` nur, wenn Jutta sich selbst ausgesperrt hat.
2. Beweise sichern: Zeitpunkte, Sentry-Link, Mail-Header, Bildschirmfotos **ohne** Geheimnisse.
3. Session starten und die Ursache prüfen lassen (nur IDs und Nummern weitergeben, keine Kund:innen-Daten im Chat).

### 9.3 Bewerten (Risiko)

| Frage | Folge |
|---|---|
| Sind personenbezogene Daten betroffen (Name, Adresse, E-Mail, Bestellungen, Anfragen, Fotos von Personen, Zahlungsangaben)? | Nein → nur dokumentieren, keine Meldung. Ja → weiter |
| Besteht voraussichtlich ein Risiko für die Betroffenen (z. B. Missbrauch, finanzielle Folgen, Bloßstellung)? | Nein (z. B. verschlüsselt und Schlüssel sicher, sofort gelöscht, nur Jutta selbst betroffen) → nur dokumentieren; **Ja → Meldung an die Aufsicht binnen 72 Stunden** |
| Besteht ein **hohes** Risiko (z. B. Zahlungs- oder Adressdaten gelangten an Unbefugte, Fotos von Kund:innen)? | **Ja → zusätzlich die Betroffenen benachrichtigen** (9.5) |

Im Zweifel melden. Eine Meldung nach Art. 33 ist keine Selbstanzeige; sie darf auch unvollständig und in Etappen erfolgen
(„Erstmeldung“, Nachreichung folgt).

### 9.4 Meldung an die Aufsichtsbehörde

Zuständig: **Berliner Beauftragte für Datenschutz und Informationsfreiheit**. Meldung über das **Online-Formular für
Datenpannen** auf der Website der Behörde (`https://www.datenschutz-berlin.de`, dort „Datenpannen melden“ suchen; Adresse
vor Gebrauch prüfen). Das Formular fragt im Kern Folgendes – vorbereiten (Vorlage in 9.6):

1. Verantwortliche: Name und Anschrift laut Impressum, Kontakt (E-Mail, Telefon).
2. Wann ist die Panne passiert, wann wurde sie bemerkt?
3. Was ist passiert (Art der Verletzung), welche Datenkategorien, ungefähre Zahl der Betroffenen und Datensätze.
4. Wahrscheinliche Folgen für die Betroffenen.
5. Ergriffene und geplante Maßnahmen (Abhilfe, Vorbeugung).
6. Wurden Betroffene benachrichtigt (ja/nein, wann)?
7. Beteiligte Dienstleister (Auftragsverarbeiter).

Bestätigung/Aktenzeichen im Vorfallprotokoll ablegen. Die Kanzlei (Datenschutz-Beratung, Kanzleifrage laut
`docs/recht/KANZLEI-BRIEFING.md`) kann zur Formulierung hinzugezogen werden, ihre Antwort darf aber die Frist nicht verzögern.

### 9.5 Betroffene benachrichtigen (nur bei hohem Risiko)

Unverzüglich, in klarer einfacher Sprache, per E-Mail an die Betroffenen (Vorlage 9.6): was passiert ist, welche Daten
betroffen sind, mögliche Folgen, was Jutta getan hat, was die Betroffenen tun können (z. B. Passwort ändern, Bank
informieren), Kontakt für Rückfragen. Kein Marketing, keine Beschwichtigung.

### 9.6 Vorlagen (Deutsch)

**Stichpunkte für das Online-Formular (Erstmeldung):**

```
Verantwortliche: Jutta Dollmann (Planet Claire), <Anschrift laut Impressum>, <E-Mail>, <Telefon>
Zeitpunkt der Panne: <Datum, Uhrzeit oder „unbekannt, ca. …“>   Bemerkt am: <Datum, Uhrzeit>
Art: <z. B. unbefugter Zugriff / versehentlicher Versand / Verlust eines Geräts>
Betroffene Daten: <z. B. Name, E-Mail-Adresse, Lieferadresse, Bestellnummern>
Anzahl Betroffene / Datensätze: <ca. …>
Wahrscheinliche Folgen: <…>
Maßnahmen: <z. B. Zugang gesperrt, Schlüssel getauscht, Dienstleister informiert>
Betroffene benachrichtigt: <ja am … / nein, weil …>
Dienstleister: <Vercel / Neon / Cloudflare / Stripe / Lettermint / …>
Weitere Angaben folgen: <ja, bis …>
```

**Benachrichtigung der Betroffenen (E-Mail):**

```
Betreff: Wichtige Mitteilung zu deinen Daten bei Planet Claire

Hallo <Name>,

leider ist bei mir am <Datum> Folgendes passiert: <kurz und ehrlich, was geschehen ist>.
Betroffen sind folgende Angaben von dir: <Datenarten>.
Das kann für dich bedeuten: <mögliche Folgen>.
Das habe ich bereits getan: <Maßnahmen>.
Das empfehle ich dir: <z. B. Passwörter ändern, auf verdächtige Mails achten, Bank informieren>.

Bei Fragen schreib mir an <E-Mail> oder ruf an unter <Telefon>.
Es tut mir leid.

Jutta, Planet Claire
```

Die Mail geht **nicht** über die Transaktionsmails des Shops mit Werbung (verboten), sondern als einfache persönliche Mail aus
dem Postfach `jutta@planetclairetattoos.com`.

### 9.7 Kontaktliste der Dienstleister

Kontakt jeweils über den Support im eigenen Konto (Zugang im Passwort-Manager; keine Direktlinks hier, weil sie sich
ändern). Verantwortlich für die Meldung an die Behörde bleibt Jutta, nicht der Dienstleister.

| Dienst | Wofür | Kontakt |
|---|---|---|
| Vercel | Hosting, Funktionen, Cron | Support im Vercel-Konto |
| Neon | Datenbank | Support im Neon-Konto |
| Cloudflare R2 | Bilder, private Dateien, Backups | Support im Cloudflare-Konto |
| Stripe | Zahlungen | Support im Stripe-Dashboard |
| Lettermint | Mailversand | Support im Lettermint-Konto |
| IONOS | Domain, DNS, Postfach | Kundenservice im IONOS-Konto |
| Sentry | Fehlerberichte (EU) | Support im Sentry-Konto |
| Berliner Beauftragte für Datenschutz und Informationsfreiheit | Aufsichtsbehörde | `https://www.datenschutz-berlin.de` |

Danach: Eintrag im Verzeichnis und Vorfallprotokoll (Abschnitt 13), Ursachenanalyse, Vorbeugung (Test, Dokumentation),
bei Bedarf Datenschutzerklärung und `docs/recht/VVT.md` anpassen.

## 10. Kosten-Routine

Budget ≤ 25 € im Monat, Warnung ab 30 € (E-05); erwartet ca. 18,50 € (Vercel Pro) bei sonst kostenlosen Tarifen
(ARCHITEKTUR §12.3). **Monatlich (am Ersten, 10 Minuten):**

1. Vercel → Usage/Spend: Ausgaben und Nutzung des Guthabens ansehen. Spend Management: Budget 10 USD über dem Guthaben, Hinweise bei 50/75/100 %; „Pause production deployment“ bleibt **aus** (der Shop soll online bleiben; Entscheidung C-02).
2. Neon → Nutzung: **Rechenzeit (CU-h) des Free-Tarifs, Ziel höchstens 40 von 100**. Liegt der Verbrauch zur Monatsmitte über 50 CU-h, Wechsel auf den nutzungsbasierten Tarif (Annahme C-01), weil Neon Free beim Erreichen des Kontingents die Datenbank stoppt (= Ausfall).
3. Cloudflare → R2: Speicher (erwartet unter 6 GB inkl. Backups) und Operationen; „Billing usage“-Benachrichtigung aktiv.
4. DeepL: Zeichenverbrauch (500.000/Monat, sichtbar in der Verwaltung); Lettermint-Kontingent (Annahme C-04); Sentry-Ereigniskontingent.
5. Keine kostenpflichtigen Zusatzprodukte (Observability Plus, Speed Insights, KV, Blob, Neon-Add-ons) ohne Entscheidung.
6. Summe im Protokoll (Abschnitt 14) eintragen; über 30 € → Ursache suchen, ggf. Entscheidung von Jutta.

Vercel „Attack Challenge Mode“ setzt Cookies und wird nur bei einem akuten Angriff kurz eingeschaltet, mit Eintrag im
Vorfallprotokoll.

## 11. DNS und Start

Die **DNS-Umstellung** (Ist-/Soll-Tabelle, `dig`-Prüfungen, TTL, Rückweg) steht vollständig in `docs/GO-LIVE.md`
(Abschnitt „DNS-Umstellung“) und in ARCHITEKTUR §12.4. Grundregel (E-95): DNS bleibt bei IONOS, es ändern sich nur die
Web-Einträge; MX, SPF, IONOS-DKIM und DMARC bleiben **unverändert**. Prüfungen bei Mailproblemen:
`dig +short MX planetclairetattoos.com`, `dig +short TXT planetclairetattoos.com`, `dig +short CNAME _dmarc.planetclairetattoos.com`.
Der Ist-Stand (Bildschirmfoto der IONOS-Zone, `dig`-Ausgaben) gehört ins Protokoll (Abschnitt 14).

## 12. Docker-Umzug (Exit-Pfad, ARCHITEKTUR §13.3)

Dieselbe App läuft ohne Vercel und Neon, z. B. auf einem Server in Deutschland (E-91). Ein Umzug braucht einen neuen Eintrag in
`docs/recht/DIENSTE.md` (Auftragsverarbeitungsvertrag mit dem Hoster) und eine Entscheidung von Jutta. Bausteine:
`Dockerfile`, `docker-compose.prod.yml`, `deploy/Caddyfile`, `.env.production.example`. **Genau eine** App-Instanz.

1. Server anlegen (Ubuntu 24.04, SSH nur mit Schlüssel, Firewall 22/80/443, automatische Sicherheitsupdates), Docker Engine und Compose-Plugin installieren.
2. Repo-Stand auschecken, `.env.production` aus `.env.production.example` und dem Passwort-Manager füllen (keine Werte ins Repo).
3. `docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres`, dann jüngstes Backup einspielen (Abschnitt 6.2 Schritte 1–4 mit `--target` auf die Compose-Datenbank, per `docker compose exec` oder SSH-Tunnel).
4. `docker compose --env-file .env.production -f docker-compose.prod.yml up -d` (Migration, App, Caddy, Scheduler).
5. Prüfen gegen die Server-IP (`curl --resolve …`), dann den A-Eintrag bei IONOS auf die Server-IP umstellen (Ablauf wie GO-LIVE; AAAA nur, wenn der Server IPv6 hat).
6. Stripe-Webhook-URL bleibt gleich (gleiche Domain); Nacharbeiten wie 6.2 Schritt 6 mit `pnpm retention:replay` und `pnpm payments:reconcile` im `migrator`-Container.
7. Vercel-Projekt pausieren, Neon nach 30 Tagen löschen, `docs/recht/DIENSTE.md` und Datenschutzerklärung aktualisieren.

Unterschiede: Jobs über Payload `autoRun` (`JOBS_AUTORUN=true`), Backup über den Dienst `scheduler`
(`/api/cron/backup`), Statistik aus (nur Vercel), Protokolle `json-file` (`max-size: 10m`, `max-file: 3`), Caddy ohne
Zugriffsprotokoll.

## 13. Vorfallprotokoll (Vorlage)

Pro Vorfall eine Kopie ablegen (z. B. `docs/protokoll/<JJJJ-MM-TT>-<kurz>.md` im privaten Repository, **ohne** Personendaten
und Geheimnisse).

```
# Vorfall <JJJJ-MM-TT> – <Stichwort>

Erkannt am/um:            Erkannt durch (Alarm-ID M-xx, Mail, Kund:in):
Betroffen (System, IDs, Zeitraum):
Personenbezogene Daten betroffen? ja / nein   Risiko: kein / Risiko / hohes Risiko
Sofortmaßnahmen (Zeit, wer, was):
Ursache:
Behebung (PR, Deploy, Rollback):
Datenpanne? ja / nein   Meldung an Aufsichtsbehörde am … (Aktenzeichen …)   Betroffene benachrichtigt am …
Vorbeugung / Lehren:
Abgeschlossen am:
```

## 14. Betriebsprotokoll (laufende Einträge)

Hier trägt die P11-Session bzw. Jutta ein, was sich zu bestimmten Terminen ergibt (ohne Werte und Personendaten).

| Datum | Eintrag | Ergebnis |
|---|---|---|
| (P11) | DNS-Ist-Stand vor der Umstellung (`dig`, Bildschirmfoto der IONOS-Zone) | offen |
| (P11) | Erste Monatsrechnungen Vercel, Neon, Cloudflare, Lettermint, Sentry, DeepL (Summe ≤ 25 €, AK-A-12-03) | offen |
| (P11) | Erste manuelle Wiederherstellungs-Übung (Abschnitt 6.3), danach halbjährlich | offen |
| (monatlich) | Kosten-Routine (Abschnitt 10): Summe, Neon-CU-h | offen |
