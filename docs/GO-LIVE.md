# Go-live-Leitfaden (P11) – planetclairetattoos.com

Stand: P10.16 (05.10.2026). Ablauf für die gemeinsame P11-Session mit Jutta, in der Reihenfolge von **P11.1 bis P11.17**
(`PLAN.md`), verknüpft mit `docs/owner/AUFGABEN.md` (A23–A41) und `docs/owner/ANLEITUNGEN.md` (S3, S4, P2, D0–D6, N1, I3, T3,
Z1). Betrieb danach: `docs/RUNBOOK.md`. Alle Namen und Werte: `docs/ARCHITEKTUR.md` (§4.1, §5.2, §12), Entscheidungen:
`docs/ENTSCHEIDUNGEN.md`.

## 0. Spielregeln

**Wer tippt was.** Jutta meldet sich überall selbst an. Sie gibt **alle** Passwörter, Schlüssel, Verbindungsadressen, IBAN,
Ausweis- und Kartendaten **selbst** ein: in die Formulare der Anbieter, in die geschützten Vercel-Variablen („Sensitive“),
in die Verwaltung und – bei Befehlen mit Zugangsdaten – in ihrem **eigenen Terminal**. Claude zeigt nur, **wohin** sie
klickt oder tippt, prüft Ergebnisse, die kein Geheimnis zeigen, und behebt Fehler per Pull Request mit grüner CI. Claude
sieht, kopiert und speichert nie ein Geheimnis; in diesem Leitfaden stehen keine Werte. Geheimnisse landen nur im
Passwort-Manager von Jutta (und der private Backup-Schlüssel zusätzlich auf Papier).

**Zeit.** Etwa 5–6 Stunden am Computer, gern auf zwei Termine verteilt, Handy daneben (2FA-Codes, Tests). Die Mail-DNS-Einträge
(P11.5) liegen mindestens einen Tag vor der DNS-Umstellung (P11.14), besser sieben Tage.

**Tiefe Anbieter-URLs** stehen hier nicht (sie ändern sich); die Wege beschreiben `docs/owner/ANLEITUNGEN.md` und die Oberflächen
der Anbieter selbst. Ändert sich eine Oberfläche, wird die Anleitung per PR angepasst.

**Abbruchregel.** Stimmt ein Prüfkriterium nicht, wird nicht weitergemacht: Ursache klären, im Vorfallprotokoll
(`docs/RUNBOOK.md` Abschnitt 13) vermerken, erst dann der nächste Schritt. Zurück geht jederzeit der Rückweg in Abschnitt 4.

## 1. Konten und Ressourcen (ARCHITEKTUR §12.2)

Alle Konten laufen auf `jutta@planetclairetattoos.com`, mit 2FA und offline aufbewahrten Wiederherstellungscodes (E-94,
ANLEITUNGEN D0).

| Dienst | Ressource | Name / Einstellung |
|---|---|---|
| Vercel | Team + Projekt | Projekt `planetclairetattoos`, Pro, Region `fra1`, Node 24.x, Fluid Compute an, Git-Integration mit dem GitHub-Repo, Deployment Protection für Preview/Staging |
| Neon | Projekt | `planetclairetattoos`, Region `aws-eu-central-1`, Postgres 17, Datenbank `planetclaire`; Zweige `main`, `seed-root`, `staging`, `preview`; Scale-to-zero nach 5 min |
| Cloudflare R2 | Buckets (alle **EU-Jurisdiktion**, nicht öffentlich, keine `r2.dev`-URL) | `pct-media-prod`, `pct-private-prod`, `pct-media-staging`, `pct-private-staging`, `pct-media-preview`, `pct-private-preview`, `pct-backups` |
| Cloudflare R2 | API-Tokens (Object Read & Write, je auf die genannten Buckets beschränkt) | `pct-app-prod` (media+private prod), `pct-app-staging`, `pct-app-preview`, `pct-backup` (nur `pct-backups`) |
| Cloudflare R2 | Lebenszyklus `pct-backups` | `db/daily/` löschen nach 30 Tagen; `db/monthly/` nach 365 Tagen; unvollständige Multipart-Uploads nach 1 Tag abbrechen |
| Cloudflare R2 | Bucket-Sperren (soweit verfügbar, Anhang C C-06) | `pct-private-prod`, Präfix `private/invoices/`: Aufbewahrung laut `settings.retention.invoiceYears` (Standard 10 Jahre); `pct-backups`: `db/daily/` 30 Tage, `db/monthly/` 365 Tage |
| Lettermint | Projekt + Versanddomain | `planetclairetattoos.com`, Absender `shop@planetclairetattoos.com`; SMTP-Zugang je Umgebung (Staging mit `MAIL_REDIRECT_ALL_TO`) |
| Stripe | Konto (Live + Test) | Webhook-Endpunkte Produktion und Staging mit der gepinnten API-Version; Payment-Method-Domains; eingeschränkter Schlüssel `rk_live_…` |
| Sentry | Organisation in der EU-Region | Projekt `planetclairetattoos` |
| DeepL | API Free | Schlüssel endet auf `:fx` |
| GitHub | privates Repo | Dependabot-Sicherheitsupdates an; optional GitHub Pro für Branch-Schutz (C-03) |

Wo welche Werte liegen: nur im Passwort-Manager von Jutta und in den „Sensitive“-Variablen von Vercel (ARCHITEKTUR §5.3).

## 2. Variablen je Vercel-Umgebung (ARCHITEKTUR §4.1, §5.2)

Alle Variablen mit Zweck stehen in `docs/RUNBOOK.md` Abschnitt 2. Hier die Belegung am Start – **Werte** gibt Jutta selbst
ein, Spalte „Art“ zeigt nur, ob geheim:

| Variable | Production | Staging | Preview | Art |
|---|---|---|---|---|
| `APP_ENV` | `production` | `staging` | `preview` | offen |
| `NEXT_PUBLIC_SITE_URL` | `https://planetclairetattoos.com` | Staging-Adresse | Preview-Adresse | offen |
| `ADMIN_ROUTE` | eigener Pfad, 6–40 Zeichen, **nicht** `/admin`/`/werkstatt` | eigener Pfad | `/werkstatt` | nicht veröffentlichen |
| `DATABASE_URL` (gepoolt, `-pooler`), `DATABASE_URL_UNPOOLED` | Neon `main` | Neon `staging` | Neon `preview` | geheim |
| `PAYLOAD_SECRET`, `CRON_SECRET` | je Umgebung eigener Wert (selbst erzeugt, mindestens 32 Zeichen) | wie Production | wie Production | geheim |
| `STORAGE_DRIVER`, `S3_*` | `s3`, Buckets `pct-*-prod` | `s3`, `pct-*-staging` | `s3`, `pct-*-preview` | Tokens geheim |
| `EMAIL_DRIVER`, `SMTP_*`, `MAIL_REPLY_TO` | `smtp` (Lettermint) | `smtp` + `MAIL_REDIRECT_ALL_TO` | `log` | `SMTP_PASS` geheim |
| `PAYMENTS_DRIVER`, `STRIPE_*`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `stripe`, **Live**-Schlüssel (`rk_live_…`/`sk_live_…`, `pk_live_…`) | `stripe`, **Test**-Schlüssel | `mock` | Schlüssel und Webhook-Geheimnis geheim |
| `TRANSLATION_DRIVER`, `DEEPL_API_KEY` | `deepl` | `deepl` oder `mock` | `mock` | Schlüssel geheim |
| `SENTRY_DSN` | Produktions-DSN | Staging-DSN | leer | geheim |
| `SEED_PREVIEW_MODE` | `false` (`true` ist in Produktion verboten) | `true` | `true` | offen |
| `MAIL_REDIRECT_ALL_TO` | leer (wird in Produktion ignoriert) | `jutta@planetclairetattoos.com` | – | offen |
| `JOBS_AUTORUN` | `false` | `false` | `false` | offen |
| `DB_POOL_MAX` | `5` | `5` | `5` | offen |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | `false` (bis P11.11) | `false` | `false` | offen |
| `NEXT_PUBLIC_CLIENT_ERRORS_ENABLED` | `false` (bis P11.11) | `false` | `false` | offen |
| `BACKUP_ENABLED`, `BACKUP_AGE_RECIPIENT`, `BACKUP_S3_*`, `BACKUP_S3_BUCKET` | `false`, ab P11.12 `true` mit Werten | nicht gesetzt | nicht gesetzt | `BACKUP_S3_*` geheim |
| `MAINTENANCE_MODE` | `false` | `false` | `false` | offen |

Beim ersten Produktionsstart prüft `assertProductionEnv` alle Regeln und nennt jeden Verstoß einzeln (ARCHITEKTUR §4.3).

## 3. Datenbank-Ablauf (ARCHITEKTUR §4.7, §4.8)

1. Neon-Zweig `main` migrieren: `pnpm payload migrate` (in Juttas Terminal, die Verbindungsadresse steht nur in ihrer Shell).
2. **Beispielbestand in `main`, bevor der erste echte Auftrag kommt** (Startinhalt für die Seitentexte):
   `pnpm seed` mit `APP_ENV=staging`, leerem `SEED_NOW` und **ohne** `SEED_ADMIN_*`. Die Datenbank ist hier noch **nicht**
   als Produktion markiert; sonst bricht der Seed ab.
3. Zweig `seed-root` aus `main` anlegen; Zweige `staging` und `preview` **aus `seed-root`**, nie als Kopie von `main` nach dem
   ersten Auftrag (keine Produktionsdaten in Previews, DIENSTE §3.3). Erlaubt der Tarif keine weiteren Zweige, teilen sich
   Staging und Preview den Zweig `staging`.
4. Nach „Beispieldaten entfernen“ und grüner Startklar-Prüfung: `pnpm db:mark-production` (setzt
   `COMMENT ON DATABASE … IS 'planetclaire:production'`; danach brechen Seed, Reset und Test-Setups ab). Prüfung per SQL:
   `SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname = current_database();` → `planetclaire:production`.
5. Wiederherstellungsfenster des Neon-Tarifs im Betriebsprotokoll notieren (C-16).

## 4. DNS-Umstellung bei IONOS (ARCHITEKTUR §12.4)

Regel (E-95): DNS bleibt bei IONOS; es ändern sich **nur** die Web-Einträge. MX, SPF, DKIM (IONOS) und DMARC bleiben
unverändert; für Lettermint kommen nur **neue** Einträge hinzu.

**Ist-Stand** (laut Recherche; vor der Umstellung erneut mit `dig` prüfen und im Betriebsprotokoll festhalten):

| Typ | Name | Wert |
|---|---|---|
| NS | `@` | IONOS (`ui-dns.*`) |
| A | `@` | `217.160.0.7` (IONOS-Parkseite, nur HTTP, kein Zertifikat) |
| AAAA | `@` | `2001:8d8:100f:f000::200` |
| A / AAAA | `www` | wie `@` |
| MX | `@` | `mx00.ionos.de`, `mx01.ionos.de` (Priorität 10) |
| TXT | `@` | `v=spf1 include:_spf-eu.ionos.com ~all` |
| CNAME | `s1-ionos._domainkey` | `s1.dkim.ionos.com` |
| CNAME | `s2-ionos._domainkey` | `s2.dkim.ionos.com` |
| CNAME | `s42582890._domainkey` | `s42582890.dkim.ionos.com` |
| CNAME | `_dmarc` | `dmarc.ionos.de` (`p=none`) |
| CAA | – | keine |

**Soll-Stand:**

| Typ | Name | Wert | Aktion |
|---|---|---|---|
| A | `@` | Wert laut Vercel → Project → Settings → Domains (derzeit `76.76.21.21` oder ein projektbezogener Wert) | ändern |
| AAAA | `@` | – | **löschen** (E-95) |
| A / AAAA | `www` | – | löschen (ein CNAME darf nicht neben A/AAAA stehen) |
| CNAME | `www` | Wert laut Vercel (z. B. `cname.vercel-dns.com` oder projektbezogen) | neu |
| CNAME | `staging` | wie `www` | neu |
| TXT | `_vercel` | nur falls Vercel eine Inhaber-Bestätigung verlangt | neu |
| TXT / CNAME | Lettermint-DKIM-Selektor(en), Return-Path-Subdomain | Werte laut Lettermint | neu |
| MX, TXT (SPF), CNAME `*._domainkey` (IONOS), CNAME `_dmarc` | – | wie Ist | **unverändert** |
| CAA | – | keine anlegen (falls später doch: `0 issue "letsencrypt.org"`) | – |

DMARC besteht für Lettermint-Mails über die ausgerichtete DKIM-Signatur (`d=planetclairetattoos.com`); der SPF-Eintrag der
Hauptdomain muss dafür nicht geändert werden, weil Lettermint eine eigene Return-Path-Subdomain nutzt.

**Ablauf mit TTL:**

1. **T−7:** Produktion läuft vollständig unter `<projekt>.vercel.app`. Lettermint-Domain angelegt, ihre DNS-Einträge bei
   IONOS ergänzt, Testmail besteht DKIM und DMARC. Vor HSTS mit `includeSubDomains` prüfen, dass keine Subdomain nur per HTTP
   genutzt wird.
2. **T−1:** TTL der Einträge `@` (A, AAAA) und `www` auf den kleinsten Wert setzen, den IONOS anbietet; Ist-Stand als
   Bildschirmfoto im Betriebsprotokoll ablegen.
3. **T0 (werktags vormittags):** Schritte laut P11.14 (unten).
4. **T+7:** TTL wieder auf den IONOS-Standard setzen.

**`dig`-Befehle** (vorher und nachher, Ergebnis ins Protokoll):

```
dig +short NS  planetclairetattoos.com
dig +short A   planetclairetattoos.com @1.1.1.1
dig +short AAAA planetclairetattoos.com @1.1.1.1
dig +short A   www.planetclairetattoos.com @1.1.1.1
dig +short CNAME www.planetclairetattoos.com @1.1.1.1
dig +short CNAME staging.planetclairetattoos.com @1.1.1.1
dig +short MX  planetclairetattoos.com
dig +short TXT planetclairetattoos.com
dig +short CNAME s1-ionos._domainkey.planetclairetattoos.com
dig +short CNAME s2-ionos._domainkey.planetclairetattoos.com
dig +short CNAME s42582890._domainkey.planetclairetattoos.com
dig +short CNAME _dmarc.planetclairetattoos.com
```

**Rückweg:** Bei Problemen die Web-Einträge auf den Ist-Stand zurücksetzen (Mail ist nie betroffen). Bei längerem Ausfall
von Vercel: Docker-Pfad (`docs/RUNBOOK.md` Abschnitt 12) und A-Eintrag auf den Server zeigen lassen.

**Prüfungen nach der Umstellung:**

- **AK-A-12-01** Die Abfragen für MX, SPF-TXT, die drei IONOS-DKIM-CNAMEs und `_dmarc` liefern exakt den Ist-Stand; eine
  Testmail an `jutta@planetclairetattoos.com` kommt im IONOS-Postfach an.
- **AK-A-12-02** `curl -I http://planetclairetattoos.com` → 308 auf `https://planetclairetattoos.com/`;
  `curl -I https://www.planetclairetattoos.com/x` → 308 auf `https://planetclairetattoos.com/x`; Zertifikat gültig;
  HSTS-Header vorhanden; keine AAAA-Antwort mit IONOS-Adresse.
- **AK-A-12-03** (nach dem ersten vollen Monat) Rechnungen von Vercel, Neon, Cloudflare, Lettermint, Sentry, DeepL zusammen
  ≤ 25 € (Nachweis im Betriebsprotokoll).

## 5. Stand der Spikes aus ARCHITEKTUR Anhang B (für P11 relevant)

| Spike | Stand | Was P11 damit tut |
|---|---|---|
| **B-01** Verwaltung unter `ADMIN_ROUTE` (Proxy-Umschreibung, Nonce-CSP) | **Soll erfüllt.** Pfad-Teil (P1, 27.09.2026, PR #1): `src/proxy.ts` schreibt `ADMIN_ROUTE/*` intern auf den Ordner `admin/` um, `/admin` antwortet 404 (kein Weiterleiten), Login, Übersicht, Liste, Bearbeiten und Passwort-Reset-Link funktionieren; der Pfad steht in keiner Datei unter `.next/static`. CSP-Teil (P2.12, ADR 0002): `script-src 'self' 'nonce-…' 'strict-dynamic'` unter `ADMIN_ROUTE`. Manifest/Service Worker (PWA) in P5.29 geprüft. **Rückfall (Ordner heißt wie der Pfad) ist nicht nötig.** | Der Produktionspfad ist reine Konfiguration (`ADMIN_ROUTE` in Vercel, P11.8); keine Umbenennung per PR. Nach dem ersten Deploy einmal die Anmeldung und die PWA-Installation unter dem Produktionspfad prüfen (P11.10) |
| B-06 Backup-Dump auf Vercel | bestanden (P10.8, lokal) | Erster echter Lauf in P11.12; Frische prüfen |
| B-07 `checkout.sessions.update` mit neuen Versandoptionen | umgesetzt, im Stripe-Testmodus **noch unbestätigt** | im Staging-Testkauf (P11.9) Versandland wechseln und prüfen; sonst greift der Rückfall `recreate_required` |
| B-08 Docker-Build ohne Datenbank | bestanden (P10.12) | nur bei einem Umzug relevant (RUNBOOK Abschnitt 12) |

## 6. Die Schritte P11.1 bis P11.17

### P11.1 Startbesprechung und Unterlagen-Check

Verknüpfung: AUFGABEN A23–A32 (A28 Kanzleitexte vollständig, A29 erste echte Stücke, A30 Vorschau angesehen, A31 Abschlussbericht und offene Punkte gelesen, A32 Termin), ANLEITUNGEN G7, V1.

1. Diesen Leitfaden mit Jutta durchgehen. Status von A23–A32 prüfen (AUFGABEN §3).
2. Der P10-PR ist gemergt; `release.yml` lief mit `publish` und `verify-asset` grün; das Release `vorschau-p10` hat das Asset
   `planet-claire-vorschau.html`. Fehlt es, letzten `release.yml`-Lauf auf `main` ansehen, Ursache beheben, `release.yml`
   per `workflow_dispatch` auf `main` starten.
3. Die Vorschau-Datei öffnet sich auf Juttas Rechner (A30).
4. Jede Zeile in `docs/OFFENE-PUNKTE.md` entscheiden (per PR umsetzen oder bewusst lassen), darunter die Adressfrage
   (Kanzleifrage K-39); Juttas Vorschau-Anmerkungen als Liste aufnehmen und per PR umsetzen.
5. Kanzleitexte vollständig (sechs Typen, Bausteine „Kanzlei: ja“), LUCID-Nummer und Verpackungslizenz (A14, A15), W-IdNr./
   Steuernummer/Telefon/IBAN (R-205) bereit; Ergebnis der Markenrecherche (R-204) in OFFENE-PUNKTE.
6. Nachgelieferte Materialien: `pnpm seed:import-instagram`, `pnpm art:coco-refs`, `pnpm art:vectorize` als Nach-Session planen.

**Prüfkriterium:** `gh release view vorschau-p10 --json assets` zeigt das Asset; jede OFFENE-PUNKTE-Zeile hat einen Status;
Go/No-Go mit Datum in `docs/FORTSCHRITT.md`; fehlende Pflichtunterlagen sind als Blocker benannt.

### P11.2 Konten prüfen und absichern

Verknüpfung: A25, ANLEITUNGEN D0 (für alle Konten), D1 Sentry, D2 DeepL, D3 Lettermint, D4 Neon, D5 Cloudflare, D6 Vercel.

Überall 2FA mit offline aufbewahrten Wiederherstellungscodes; Sentry-Datenregion EU; Neon `aws-eu-central-1`, Postgres 17;
Cloudflare R2 aktiviert, Domain **nicht** bei Cloudflare; Lettermint Free; DeepL API Free (nicht Pro); Vercel Pro,
Team „Planet Claire“; Stripe verifiziert, PayPal verbunden. GitHub: „Dependabot security updates“ an; per PR die
Versions-Updates (`open-pull-requests-limit` 5 bzw. 2) und `dependabot-automerge.yml` einschalten (ARCHITEKTUR §1.3);
Entscheidung GitHub Pro für Branch-Schutz (C-03).

**Prüfkriterium:** Konten-Checkliste (Abschnitt 1) abgehakt; kein Geheimnis in Chat, Repo oder PR (`gitleaks` grün).

### P11.3 Cloudflare R2 einrichten

Verknüpfung: A25, A33, ANLEITUNGEN D5.

Sieben Buckets und vier Tokens wie in Abschnitt 1; Lebenszyklus für `pct-backups`; Bucket-Sperren soweit verfügbar (C-06);
Benachrichtigung „Billing usage“ (ARCHITEKTUR §12.3). Werte nur in Juttas Passwort-Manager.

**Prüfkriterium:** Endpunkt endet auf `.eu.r2.cloudflarestorage.com`; Token-Umfang in der Oberfläche geprüft.

### P11.4 Neon-Datenbank vorbereiten

Verknüpfung: A25, A33, ANLEITUNGEN D4.

Projekt, Datenbank und Region wie in Abschnitt 1; Migration, Beispielbestand und Zweige wie in Abschnitt 3.

**Prüfkriterium:** `pnpm seed:remove` (ohne `--yes`) zeigt in `main` die Mengen aus SEED-SPEC §0.1; Zweige vorhanden; keine
Produktionsdaten in Preview/Staging.

### P11.5 Lettermint und Mail-DNS (spätestens T−1, besser T−7)

Verknüpfung: A25, ANLEITUNGEN D3, N1.

Domain `planetclairetattoos.com` in Lettermint anlegen; deren DKIM- und Return-Path-Einträge bei IONOS **nur hinzufügen**
(MX, SPF, IONOS-DKIM, DMARC unverändert); SMTP-Zugang je Umgebung; Absender `shop@planetclairetattoos.com`, Antwort an
`jutta@planetclairetattoos.com`; Datenverarbeitungsvertrag abschließen. Am Tag vor der Umstellung TTL senken (Abschnitt 4,
T−1) und den Ist-Stand als Bildschirmfoto im Betriebsprotokoll ablegen.

**Prüfkriterium:** Testmail kommt im IONOS-Postfach an, Kopfzeilen zeigen `dkim=pass` und `dmarc=pass`; `dig` für MX, SPF-TXT,
die drei IONOS-DKIM-CNAMEs und `_dmarc` liefert exakt den Ist-Stand.

### P11.6 Stripe einrichten (Live und Test)

Verknüpfung: A23, A24, A38, ANLEITUNGEN S3, S4, P2.

Zahlarten: Karte, Apple Pay, Google Pay, PayPal; **kein** Klarna, keine SEPA-Lastschrift, kein Link (E-20, R-062).
Eingeschränkter Live-Schlüssel und `pk_live_…`. Webhook-Endpunkt Produktion zunächst auf
`https://<projekt>.vercel.app/api/stripe/webhook` (die URL wird in P11.14 auf die Apex-Domain geändert, das Geheimnis bleibt);
Staging-Endpunkt im Testmodus mit „Protection Bypass for Automation“; beide mit der gepinnten API-Version und den Ereignissen
aus DATENMODELL §8.8; DPA-Datum notieren.

**Prüfkriterium:** Endpunkte angelegt, Zahlarten-Konfiguration entspricht E-20, Schlüssel nur bei Jutta; Test-Ereignis an den
Staging-Endpunkt nach P11.8 → 200.

### P11.7 Sentry einrichten

Verknüpfung: A25, ANLEITUNGEN D1.

Organisation in der EU-Region, Projekt `planetclairetattoos`; „Prevent Storing of IP Addresses“ an; Data Scrubber an mit
Zusatzfeldern `email`, `token`, `iban`; kürzeste Aufbewahrung (L-14); Alarmregeln M-01 (neues Problem, Rückfall) und M-02
(> 20 Ereignisse/h; wirkt erst nach Kanzleifrage K-30 c); Uptime-Monitore für `GET /api/health` und `GET /api/health/freshness`
alle 5 min, Alarm nach 2 Fehlschlägen (M-07, C-04); DPA akzeptieren; DSN für Produktion und Staging.

**Prüfkriterium:** Einstellungen laut ARCHITEKTUR §11.4 gesetzt; nach P11.8 erscheint ein absichtlich ausgelöster Serverfehler
auf Staging ohne Personendaten; Uptime-Monitore aktiv, sobald die Domain umgestellt ist.

### P11.8 Vercel-Projekt, Umgebungsvariablen und Kostenbremse (A33)

Verknüpfung: A33, ANLEITUNGEN D6, S4.

Repo importieren; Pro, Region `fra1`, Node 24.x, Fluid Compute; Build `pnpm payload migrate && pnpm build`; Umgebungen
Production (`main`), Staging (Branch `staging`), Preview (PRs). Variablen laut Abschnitt 2 (Jutta fügt alle Geheimnisse
selbst als „Sensitive“ ein). Deployment Protection für Preview/Staging. Spend Management: On-Demand-Budget 10 USD,
Benachrichtigungen 50/75/100 %, „Pause production deployment“ nach Juttas Entscheidung (Standard aus, C-02); keine Log
Drains, Toolbar und Speed Insights aus.

**Prüfkriterium:** Produktions-Deployment unter `<projekt>.vercel.app` startet (`assertProductionEnv` ohne Verstoß);
`curl https://<projekt>.vercel.app/api/health` → 200; `/api/health?deep=1` mit Bearer ok; Staging nur mit Vercel-Anmeldung
erreichbar; kein Geheimnis in Repo, PR oder Chat.

### P11.9 Staging-Abnahme durch Jutta (A33a)

Verknüpfung: A33a, ANLEITUNGEN V2, Z1; EK-08; KUNST-QA §10 Nr. 4.

Staging mit Beispielbestand, Stripe-Testmodus und `MAIL_REDIRECT_ALL_TO=jutta@planetclairetattoos.com`. Jutta prüft am Laptop
und am Handy (Link per DM an sich selbst, im Instagram-In-App-Browser auf iPhone und Android): „Ist das Coco?“, „Bewegung
reduzieren“ am Handy, Testkauf mit einer veröffentlichten Stripe-Testkarte (tippt sie selbst), Vorkasse, Abholung, Widerruf,
Verwaltungsabläufe am Handy. **EK-08-Stoppuhr:** „Neues Stück“ am Handy bis online in höchstens 3 Minuten (Keramik: höchstens
10 Eingaben ohne Fotos). Spike B-07 (Versandland wechseln) prüfen. Befunde per PR beheben (CI grün, merge, Staging neu).
Textkorrekturen nicht auf Staging, sondern in P11.10 in der Produktion.

**Prüfkriterium:** Juttas OK mit Datum und EK-08-Messwert in `docs/FORTSCHRITT.md`; alle Blocker behoben.

### P11.10 Produktion befüllen (A34)

Verknüpfung: A26, A28, A29, A34, ANLEITUNGEN T3, Handbuch Kapitel „Anmelden und die Verwaltung aufs Handy legen“.

Unter `<projekt>.vercel.app`, Shop **geschlossen** (`settings.shop.isOpen = false` bis P11.15). Jutta legt mit
`pnpm admin:create` in ihrem Terminal das einzige Konto an (E-03; E-Mail und Passwort werden abgefragt, nie als Argument) und
trägt in der Verwaltung ein: Stammdaten (Name, Anschrift nach der Antwort zu K-39, E-Mail, Telefon, Steuernummer, W-IdNr. bzw.
USt-IdNr.), Bezirk, Abhol-Vorlage, Kontoinhaberin/IBAN/BIC, LUCID-Nummer und Systembeteiligung, Standard-Verpackungen,
Steuer-Bestätigung und Vorjahresumsatz, Rechtstexte der Kanzlei für alle sechs Typen (`origin = lawyer`) und die Bausteine
„Kanzlei: ja“, harmonisierte Mitteilung als amtliche Grafik (R-049), Nickel-Nachweise, Glasur-Erklärungen oder alles „Deko“,
technische Unterlagen, Einwilligungen für Galerie-Fotos, erste echte Stücke, Seitentexte und FAQ gegenlesen. Außerdem legt
sie die Verwaltung als Web-App aufs Handy (PWA).

**Prüfkriterium:** Rechtsseiten ohne Platzhalter-Banner; Impressum ohne Steuernummer; Startklar-Punkte zu Stammdaten,
Rechtstexten, IBAN, LUCID und Steuer grün; die Web-App öffnet „Heute“, die Anmeldung klappt.

### P11.11 Auftragsverarbeitung und Statistik-Entscheidung (A35, A36)

Verknüpfung: A35, A36, R-155, R-132.

AVVs nach DIENSTE §6 (Vercel, Neon, Cloudflare, Stripe, Lettermint, IONOS, Sentry) abschließen und unter Einstellungen →
Auftragsverarbeitung mit Datum eintragen; `docs/recht/VVT.md` an Jutta zur Aufbewahrung; Log-Aufbewahrung der Anbieter in
DIENSTE.md nachtragen. Statistik nur mit Kanzlei-Bestätigung zu K-30 einschalten (`settings.analytics.enabled` +
`confirmedAt` + Notiz, `NEXT_PUBLIC_ANALYTICS_ENABLED=true`, neu deployen), sonst bewusst „aus“ dokumentieren.
Browser-Fehlermeldungen (`NEXT_PUBLIC_CLIENT_ERRORS_ENABLED=true`) nur, wenn die Kanzlei K-30 c bejaht hat.

**Prüfkriterium:** `pnpm check:golive` bzw. die Startklar-Ansicht zeigt R-210 Nr. 6 (AVV) und Nr. 10 (Statistik) grün; Stand
beider Schalter mit Datum und Grund in `docs/FORTSCHRITT.md`.

### P11.12 Backups aktivieren (A36a)

Verknüpfung: A36a, ANLEITUNGEN Z1 Schritt 6; `docs/RUNBOOK.md` Abschnitt 6.

Jutta erzeugt **offline** auf ihrem Rechner ein age-Schlüsselpaar. Der **private** Schlüssel (`AGE-SECRET-KEY-…`) kommt in
ihren Passwort-Manager und auf Papier, **nie** nach Vercel, GitHub oder in den Chat. Der öffentliche Schlüssel (`age1…`)
wird `BACKUP_AGE_RECIPIENT`; Token `pct-backup` als `BACKUP_S3_*`, `BACKUP_S3_BUCKET=pct-backups`, `BACKUP_ENABLED=true`
(nur Produktion), neu deployen. Ersten Lauf abwarten (01:30 UTC) oder von Jutta mit Bearer anstoßen lassen;
`pnpm backup:verify --key=<key>` in ihrem Terminal. Halbjährliche Wiederherstellungsübung im Betriebsprotokoll terminieren.

**Prüfkriterium:** Backup-Objekt beginnt mit `age-encryption.org/v1` (AK-A-10-02, `backup:verify` ok);
`/api/health/freshness` meldet `backup: ok`.

### P11.13 Beispieldaten entfernen, Startklar grün, Datenbank markieren (A41)

Verknüpfung: A41, R-180, R-210.

In der Verwaltung „Beispieldaten entfernen“ mit „Seitentexte und FAQ behalten“ (die Sperre ist nach P11.10 gelöst); Bericht
prüfen. Startklar-Ansicht vollständig grün (`pnpm check:golive` mit `APP_ENV=production` endet mit Code 0); danach
`pnpm db:mark-production --yes` in Juttas Terminal und Markierung per SQL prüfen (Abschnitt 3).

**Prüfkriterium:** 0 Dokumente mit `seed = true` (Mengenvorschau `seed:remove` zeigt 0); alle 15 Startklar-Punkte grün;
Datenbank-Kommentar `planetclaire:production` gesetzt.

### P11.14 DNS-Umstellung bei IONOS (A37)

Verknüpfung: A27, A37, ANLEITUNGEN N1; Abschnitt 4.

T0 werktags vormittags: in Vercel die Domains `planetclairetattoos.com` (primär), `www.planetclairetattoos.com` (Weiterleitung
308 auf die Hauptdomain) und `staging.planetclairetattoos.com` (Branch `staging`) hinzufügen; bei IONOS ggf. zuerst die
Verwendung auf „eigene DNS-Einträge“ umstellen, **ohne** E-Mail-Einträge anzutasten; Einträge laut Soll-Tabelle ändern;
warten, bis `dig +short A planetclairetattoos.com @1.1.1.1` den Vercel-Wert liefert und Vercel „Valid Configuration“ mit
Zertifikat zeigt. Stripe-Live-Webhook auf `https://planetclairetattoos.com/api/stripe/webhook` umstellen, Test-Ereignis
senden; Payment-Method-Domains `planetclairetattoos.com` und `staging.planetclairetattoos.com` registrieren (Apple Pay).
Danach legt Jutta die Web-App einmal neu von der echten Adresse aufs Handy und entfernt die alte.

**Prüfkriterium:** AK-A-12-01 und AK-A-12-02 (Abschnitt 4); Stripe-Test-Ereignis an die neue URL → 200. Rückweg bereit.

### P11.15 Shop öffnen und echter Testkauf (A38, A39, R-211)

Verknüpfung: A38, A39, ANLEITUNGEN S4, Z1; RECHT §7 Teil B; EK-04, EK-05.

`settings.shop.isOpen = true` (die Go-live-Sperre lässt es jetzt zu). An der Kasse erscheinen Karte, Apple Pay, Google Pay,
PayPal und Vorkasse. **Testkauf-Drehbuch:**

1. Jutta legt ein eigens dafür gedachtes, günstiges echtes Stück an und kauft es mit **ihrer eigenen Karte** (tippt sie selbst).
2. Bestellbestätigung prüfen: Mail mit PDFs, Rechnung `RE-…` im echten Nummernkreis; Kopfzeilen `spf`, `dkim`, `dmarc` = pass.
3. Über „Vertrag widerrufen“ widerrufen; die Eingangsbestätigung kommt sofort.
4. In der Verwaltung erstatten (Stripe-Erstattung + Gutschrift `GS-…`). Hinweis: die Stripe-Gebühr (ca. 1 €) wird nicht erstattet.
5. Im Browser: keine Cookies vor „In den Korb“; keine Fremd-Requests außer Stripe auf der Kasse; Fußbereich-Links, Impressum.

RECHT §7 Teil B vollständig abhaken (Datum in `docs/FORTSCHRITT.md`).

**Prüfkriterium:** R-211 vollständig; Beleg und Gutschrift lückenlos nummeriert; `email-log` ohne `failed`; EK-04 und EK-05 am
echten System bestätigt.

### P11.16 Instagram-Bio und Geräte-Check (A40, R-022)

Verknüpfung: A40, ANLEITUNGEN I3; KUNST-QA §10 Nr. 4.

Links setzen: `https://planetclairetattoos.com` („Shop & Tattoo“) und `https://planetclairetattoos.com/impressum` („Impressum“;
leitet auf `/de/impressum`); beide aus dem Profil antippen. Startseite, Shop, Produktseite und Danke-Seite im
Instagram-In-App-Browser auf iPhone und Android ansehen; einen Kurzlink `/nr/<nummer>` testen.

**Prüfkriterium:** beide Bio-Links öffnen die richtigen Seiten; R-022 abgehakt; Befunde als Nacharbeit notiert.

### P11.17 Nach dem Start: Überwachung und Nacharbeiten

Verknüpfung: AUFGABEN §5 (A42–A50), `docs/RUNBOOK.md`, `docs/owner/HANDBUCH.md`.

**Überwachung der ersten 7 Tage, täglich** (Liste abhaken): Sentry-Probleme; `/api/health/freshness` mit `jobs: ok` und
`backup: ok`; `email-log` ohne `failed`; Stripe-Webhooks ohne Fehler; Vercel-Nutzung. **T+7:** TTL bei IONOS zurück auf den
Standard. **Nach dem ersten vollen Monat:** Kosten aller Dienste ≤ 25 € im Betriebsprotokoll (AK-A-12-03, EK-10), Neon-CU-h
zur Monatsmitte (C-01), R2-Nutzung. Jährliche Rechtstext-Erinnerung gesetzt, Verfahren für Dependabot-Sicherheits-PRs
(RUNBOOK Abschnitt 5), Termin der ersten Wiederherstellungsübung. AUFGABEN §5 (A42–A50) einmal mit Jutta durchgehen und je
Punkt das passende Handbuch-Kapitel zeigen. Nacharbeiten: Coco-Nachschärfen bei neuen Fotos, Neu-Vektorisierung nach
Instagram-Export, offene Punkte aus OFFENE-PUNKTE. `docs/FORTSCHRITT.md`: „Die Seite ist live seit …“.

**Prüfkriterium:** Überwachungsliste für 7 Tage abgehakt; A42–A50 mit Jutta besprochen (Datum in `docs/FORTSCHRITT.md`);
Kostennachweis nach dem ersten Monat; OFFENE-PUNKTE aktuell.

## 7. Gesamtabnahme P11

- AUFGABEN A23–A41 von Jutta abgehakt; A42–A50 besprochen; dieser Leitfaden vollständig durchlaufen.
- RECHT §7 Teil B vollständig mit Datum; Startklar (R-210) in Produktion grün; Rauchtest R-211 bestanden.
- AK-A-12-01 und AK-A-12-02 erfüllt; Testmail im IONOS-Postfach.
- Backups: drei aufeinanderfolgende erfolgreiche Nächte; `/api/health/freshness` 200.
- Sentry-Alarme und Uptime-Monitore aktiv; Kostenbremse eingerichtet; Dependabot-Sicherheitsupdates an, Versions-Updates und
  automatisches Mergen aktiv.
- `docs/FORTSCHRITT.md` mit „live“-Eintrag; `docs/OFFENE-PUNKTE.md` und Betriebsprotokoll (DNS-Ist-Stand, Kosten) aktualisiert –
  ohne Geheimnisse.
- Nach dem ersten vollen Monat: AK-A-12-03 / EK-10 (≤ 25 €) belegt.
