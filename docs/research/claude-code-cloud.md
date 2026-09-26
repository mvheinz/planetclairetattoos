# Recherche: Claude Code Cloud: Arbeitsweise und P0

> Stand 26.09.2026. Automatisch erzeugt aus dem Recherche-Workflow (Websuche mit Quellen). Konfidenz je Befund: high/medium/low. Wo ein Faktencheck vorliegt, steht er am Ende und hat Vorrang. Entscheidungen der Inhaberin stehen in docs/ENTSCHEIDUNGEN.md und haben immer Vorrang vor Empfehlungen hier.

## Zusammenfassung

Claude Code Cloud Sessions 2026 ermöglichen autonome, langfristige Entwicklung eines Webshop-Projekts. Das Modell: lokal eine robuste Foundation (P0) schaffen, dann Cloud-Agenten die PLAN.md-Checkliste abarbeiten lassen bis zum Finish. Kernfähigkeiten: Setup-Skripte, SessionStart-Hooks für Abhängigkeiten, Auto-Mode für Permission-freie Ausführung, /goal zur Completion-Verifikation, MCP-Server für externe Tools, Routines für CI-Integration. Deutsche Besonderheiten: GDPR-Datenschutz, SSL-Zertifikate, Impressum/AGB als Pages, Zahlungsintegration (Stripe DEU), E-Mail-Compliance.

## Befunde

### Cloud Session Anforderungen (v2.1.272+) `[high]`

Voraussetzungen: Claude.ai Pro/Max/Team-Plan, GitHub-Konto mit Claude GitHub App installiert (für Private Repos) oder /web-setup (Terminal-Token-Flow). Authentifizierung: OAuth oder API-Key. Cloud-VM: Ubuntu Linux, SSH-Netzwerk nur zu whitelisted Domains (Default: npm, pip, gem, Go, GitHub, GitLab, Bitbucket, major CDNs). Keine lokale .claude/ oder Hooks aus Desktop-Umgebung — nur CLAUDE.md und .claude/settings.json aus Repo.

**Auswirkung:** Kritisch für P0: GitHub-Zugang muss manuell eingerichtet werden vor Cloud-Sessions; Private Repos benötigen Claude GitHub App.

Quellen:
- https://code.claude.com/docs/en/web-quickstart.md
- https://code.claude.com/docs/en/claude-code-on-the-web.md

### Setup-Skripte vs. SessionStart Hooks `[high]`

Setup-Script (shell) läuft vor jedem Cloud-Session und wird gecacht — max. ~5 Minuten. Sollte: npm install, pip install, env-Variablen setzen. SessionStart Hook (shell) läuft nach, asynchron — kann langsame Downloads starten (Docker pulls, Model-Weights). Hooks in .claude/settings.json triggern auf 'SessionStart', 'PermissionRequest', 'PreToolUse', 'SessionEnd'. Wichtig: Secrets (API-Keys) dürfen nicht im Script sein — über Environment Variables oder API Credentials mechanism (nur Pro/Max).

**Auswirkung:** P0 Aufgabe: setup.sh schreiben, SessionStart Hook für optional async Tasks definieren, .env.example vorbereiten.

Quellen:
- https://code.claude.com/docs/en/cloud-environments.md
- https://code.claude.com/docs/en/hooks-guide.md

### Autonome Ausführung mit /goal und Auto-Mode `[high]`

/goal setzt eine Completion-Bedingung (z.B. 'npm test passes && db schema matches migration v3'); Cloud-Agent läuft in Schleife bis Bedingung erfüllt ist oder unmöglich. Auto-Mode genehmigt Tool-Calls via Classifier (nicht User-Prompts für jeden Bash-Call). Für Shop: autoMode.environment mit Trusted Repos (GitHub org), Trusted Domains (Stripe API, IONOS DNS), Cloud Buckets (S3 für Fotos). classifyAllShell: true macht auch Bash-Befehle sicher. Soft_deny: z.B. 'Produziere keine Kundendaten in Logs'.

**Auswirkung:** P0: autoMode.environment in ~/.claude/settings.json vorbereiten (wird vom Cloud-Agent gelesen). PLAN.md muss ausführliche /goal-Bedingungen für jeden Major Task haben.

Quellen:
- https://code.claude.com/docs/en/goal.md
- https://code.claude.com/docs/en/auto-mode-config.md

### CLAUDE.md für Cloud Persistierung `[high]`

CLAUDE.md im Repo-Root ist Projektkontext, den Cloud-Agent bei **jedem** Session-Start lädt. Sollte enthalten: Projekt-Überblick, Architektur-Entscheidungen, API-Spezifikationen, Tattoo-Shop-Anforderungen (Produktkategorien, Versand-Länder, Steuermodell), Wichtige Gotchas, Konventionen. Nicht: Ausführliche Setup-Anleitung (gehört in README.md). CLAUDE.md-Größe zählt zum Context — ~3000 Token ist OK, >10k werden komprimiert. Auto-Memory (Claude schreibt Notizen zu Korrektionen) lädt auch parallel.

**Auswirkung:** P0: CLAUDE.md mit Shop-Anforderungen, Datenmodell, Tattoo vs. eShop Unterscheidung schreiben.

Quellen:
- https://code.claude.com/docs/en/memory.md

### PLAN.md Struktur für phasierte Cloud-Arbeit `[high]`

PLAN.md ist eine Checklisten-Datei (Markdown) mit Phasen (P0, P1, P2...), jede Phase hat Aufgaben mit Definition-of-Done. Format: '- [ ] Task Name — DoD: X und Y'. Cloud-Agent lädt PLAN.md, aktualisiert Checkboxen während Arbeit, committet die fertige Phase. /goal am Ende jeder Phase prüft, ob alle Häkchen gesetzt sind und PR offen. Wichtig: PLAN.md muss im Repo committed sein, nicht generiert.

**Auswirkung:** P0: PLAN.md schreiben mit P0, P1, P2-Aufgaben (siehe Checklist unten); Cloud-Sessions triggern per PLAN.md Status.

Quellen:
- https://code.claude.com/docs/en/goal.md
- https://code.claude.com/docs/en/headless.md

### Monorepo Next.js + Payload CMS Layout `[medium]`

Empfohlene Struktur für Cloud-Skalierbarkeit: /apps/web (Next.js Frontend + Server Components), /apps/api (Payload CMS + Headless Backend), /packages/shared (Types, Utils), /infra (Terraform/CloudFormation), /db (Migrations, Seeds). Payload CMS als API-Layer: Admin UI, REST/GraphQL API, Media Handler (für Fotos), Role-Based Access für Tattoo-Anfragen. Next.js: App Router, Middleware für Auth, Client Components für Shop-UI, Server Components für Inventory. Dockerfile für beide Services.

**Auswirkung:** P0: Skeleton-Repo mit dieser Struktur vorbereiten; Cloud-Agent kann dann in isolierten Directories arbeiten, PR-Konflikte vermeiden.

Quellen:
- https://code.claude.com/docs/en/cloud-environments.md

### Secrets Management in Cloud Sessions `[high]`

API Keys, DB Passwords, Stripe Keys: **nicht ins Repo**. Optionen: (1) Pro/Max Plans: API Credentials UI auf cloud.claude.com — Keys bleiben außerhalb VM, Requests werden serverseitig signiert; (2) Environment Variables im Cloud Environment (lesbar im UI); (3) .env.local checkinned mit Platzhalter, SecretManager (AWS Secrets, Vault) zur Laufzeit. GitHub Secrets für CI/CD. IONOS API Key für DNS ebenfalls: Environment Variable oder AWS Secrets Manager Proxy.

**Auswirkung:** P0: Entscheiden: Welche Secrets via env var, welche via AWS Secrets Manager? .env.example ohne echte Werte vorbereiten.

Quellen:
- https://code.claude.com/docs/en/cloud-environments.md

### MCP-Server in Cloud-Sessions `[medium]`

Cloud-Sessions können **nur Standard-Tools** verwenden (Read, Write, Edit, Bash, WebSearch, WebFetch) — keine Desktop-App-Spezifika (computer use, Claude Browser). Custom MCP-Server können als 'url'-Type aufgerufen werden, wenn der Server publiziert ist (HTTP, nicht lokal). Beispiele: Private GitHub Actions Runner, Private Slack Webhook. Für Jutta: Möglichkeit, Custom MCP für IONOS DNS Management zu schreiben (URL-basiert).

**Auswirkung:** P0: Klarheit, ob Custom MCP-Server nötig ist. Sonst nur Standard-Tools + CLI (git, npm, curl) nutzen.

Quellen:
- https://code.claude.com/docs/en/cloud-environments.md

### CI/CD mit Cloud Sessions + GitHub Actions `[high]`

Cloud-Sessions können via GitHub Actions getriggert werden (claude.ai Bot auf PRs, Push-Events). Payload: PR diff, Commit-Messages. Cloud-Agent bearbeitet PR, pushes Branch, erstellt Review-Comments. Auto-Fix PRs: Cloud-Session monitort CI Failures, pushes Fixes automatisch. Für P0 erforderlich: GitHub Actions Workflow (YAML), Test-Runner (vitest, jest), Lint (biome), Type-Check (tsc). Cloud-Session muss Permissions haben (via Claude GitHub App).

**Auswirkung:** P0: .github/workflows/ mit test, lint, build Jobs schreiben; Cloud-Agent nutzt diese in /goal 'tests pass' Bedingung.

Quellen:
- https://code.claude.com/docs/en/github-actions.md
- https://code.claude.com/docs/en/claude-code-on-the-web.md

### Routines: Scheduled Cloud-Sessions `[medium]`

Routines triggern Cloud-Sessions auf Cron-Schedule (z.B. '0 9 * * MON' = jeden Montag 9h), GitHub Events (PR geöffnet, Merge), oder Webhooks (Zapier, custom). Routine wird einmal mit `/schedule` erstellt, dann lädt Cloud-Session PLAN.md, arbeitet Task ab, committet, pushes PR. Ideal für: Nightly Inventory Restock, Weekly Report Generation, Daily Instagram-Sync-Check. Für P0: decide welche Routines sinnvoll sind.

**Auswirkung:** P0: Liste von Kandidaten für Routines (z.B. 'nightly: validate inventory counts'); später in P2 implementieren.

Quellen:
- https://code.claude.com/docs/en/routines.md

### Datenbank & Migrations `[high]`

Payload CMS braucht SQL DB (PostgreSQL empfohlen für Deutschland/EU: GDPR-konform). Cloud-Session muss Zugriff auf DB haben — über Connection String in env var oder RDS-Proxy. Migrationen in /db/migrations/ als TypeScript (Payload Migration Hooks) oder Raw SQL. Schema-Versioning: PLAN.md trackt aktuelle Version. Cloud-Agent führt Migrationen vor Features durch, committet, dockt in PLAN.md. Seed Data für Dev: /db/seeds/tattoos.json, /db/seeds/ceramics.json.

**Auswirkung:** P0: PostgreSQL hosten wählen (RDS, Vercel Postgres, Supabase DEU); Connection String als env var; Migrations-Struktur vorbereiten.

Quellen:
- https://code.claude.com/docs/en/cloud-environments.md

### Testing & Quality Gates `[high]`

Cloud-Sessions müssen mit `npm test`, `npm run lint`, `npm run type-check` alle Green werden vor Merge. /goal trackt dies: 'npm test exits 0, npm run lint clean, type check clean'. Test Coverage: >80% für kritische Pfade (Auth, Checkout, Inventory). E2E Tests (Playwright): Checkout-Flow, Tattoo-Request-Form. Unit Tests: Preis-Kalkulationen, Versand-Logik, PDF-Rechnung-Generator.

**Auswirkung:** P0: Test-Harness (vitest) + E2E (Playwright) aufsetzen; GitHub Workflow für CI; /goal Bedingungen formulieren.

Quellen:
- https://code.claude.com/docs/en/goal.md

### Deutsche Besonderheiten: GDPR & Compliance `[high]`

GDPR (DSGVO): Datenschutzerklärung erforderlich, User-Einwilligung für Cookies (Matomo, Google Analytics), Widerspruchsrecht, Recht auf Löschung. Impressum-Seite: Pflicht in Deutschland — Name, Anschrift, Kontakt, Steuernummer. AGB: Erforderlich. Zahlungsanbieter: Stripe ist DSGVO-konform (Data Processing Agreement möglich). Hosting: EU-Server (Vercel bietet EU-hosted Optionen, AWS Frankfurt, Hetzner). SSL-Zertifikat: HTTPS Pflicht (Let's Encrypt via Vercel/Hetzner kostenlos).

**Auswirkung:** P0: Impressum + Datenschutz + AGB als Inhalte in CLAUDE.md-Request vorbereiten; Rechtsberatung empfohlen für AGB.

### Zahlungsintegration & Steuern `[medium]`

Stripe Deutschland: SEPA-Bankverbindung für Auszahlungen, Zahlungsabwicklung in EUR. Steuern: 19% USt (Regelsatz, Kunsthandwerk), Kleinunternehmer-Option möglich (< 22.500 EUR p.a. = 0% Steuern). Payload Hook vor Checkout: Steuerbetrag berechnen basierend auf Customer-Land + Produkt-Typ. Rechnung-Generator: PDF mit USt-ID (falls UStId registriert). Compliance: Tracking von Transaktionen für Finanzamt (GoBD). Versand: DHL, DPD, Hermes — Integration via API für Tracking-Link im Bestellbestätigungs-Email.

**Auswirkung:** P0: Steuer-Modell konfigurieren; Stripe Account + SEPA Bankverbindung vor P1; Versand-Anbieter auswählen.

### Hosting & Deployment `[medium]`

Empfohlen für Jutta: Vercel (Frontend + API, kostenlos ab $20/mo, GDPR-konform EU-Region), RDS für DB (AWS, Frankfurt Region ~€15/mo), S3 für Product Images (€1/mo typical). Alternative: Hetzner VPS (€6/mo) mit Docker + Caddy (SSL), PostgreSQL lokal. DNS: IONOS (aktuell) — API-Integration für Auto-Renewal möglich. Deployment: GitHub Actions → Vercel (auto on main), Manual Reviews vor Production-Push.

**Auswirkung:** P0: Hosting-Provider wählen; Vercel + RDS Setup; DNS an IONOS bleiben oder migrieren?

### Tattoo-Bereich (nicht kaufbar) `[high]`

Separate Seite /tattoos: Portfolio mit Beispielen, Anfrage-Formular (Name, Email, Beschreibung, Größe, Placement, Foto-Anhang). Form sendet Email an jutta@planetclairetattoos.com + speichert in Payload unter 'TattooInquiries' Collection (nicht Public, nur Admin). Design: Galerie mit Hover-Effekten, suchbar nach Style (Blackwork, Illustrative, Minimalist), Filterbar nach Größe. Unterscheid von Shop-Produkten: Keine Preise sichtbar, CTAs heißen 'Request' statt 'Buy'.

**Auswirkung:** P0: TattooInquiries Collection im Datenmodell; Design-Richtlinie im CLAUDE.md ('Tattoos ≠ Shop-Produkte').

### Instagram-Integration `[high]`

Bio-Link → planetclairetattoos.com (Live nach Launch). Story Highlights: 'more ceramics', 'Tattoos', 'Shop', 'About'. Shop-Seite zeigt neuste Produkte (Keramiken, bemalte T-Shirts, Caps), Link zu Instagram oben. Möglichkeit später: Instagram Shopping Tag (erfordert FB Business Account + Catalog). Für P0: nur URL-Link, kein Shop-API-Sync nötig.

**Auswirkung:** P0: Landing Page mit Instagram-Bio-Link-bereit; Später: Social Meta Tags (OG Image, Description) für Instagram Share-Preview.

## Empfehlungen

- **GitHub & Claude Setup SOFORT**  
  _BegrÃ¼ndung:_ Bevor P0 startet: (1) Jutta + Developer müssen Claude.ai Pro/Max haben (Team-Plan falls mehrere arbeiten), (2) GitHub Account für Jutta, (3) Private Repo 'planetclairetattoos' erstellen, (4) Claude GitHub App installieren auf Account/Org, (5) `/web-setup` in Terminal laufen lassen damit Cloud-Sessions Repo sehen. Verzögerung hier = verzögerte P0.

- **PLAN.md als Single Source of Truth für Cloud**  
  _BegrÃ¼ndung:_ Jedes Cloud-Session wird PLAN.md lesen + aktualisieren. Format: Phasen mit Häkchen, klare Definition-of-Done. Cloud-Agent braucht keine Nachfragen, nur Checklist abarbeiten. Beispiel P1-Aufgabe: '- [ ] Payload CMS Setup — DoD: Admin UI lädt, DB migrations applied, Test-Benutzer existiert'. Am Ende jedes Task: git commit 'P1: CMS aufgesetzt', PR push.

- **CLAUDE.md mit Shop-Context + Tattoo-Unterscheidung**  
  _BegrÃ¼ndung:_ Cloud-Agent muss verstehen: (1) Jutta ist Künstlerin mit 3 Product-Linien (Tattoos, Keramiken, Clothing), (2) Shop = Keramiken + Clothing kaufbar, Tattoos = nur Anfrage, (3) Design soll 'verträumt-progressiv, unkonventionell' sein, (4) Deutsche Compliance-Anforderungen. CLAUDE.md speichert dies, nicht im Prompt bei jedem Task.

- **Auto-Mode + /goal für autonome Cloud-Arbeit**  
  _BegrÃ¼ndung:_ Nach P0 Setup: Cloud-Session startet mit `--permission-mode auto`, /goal 'P1 PLAN.md alle Häkchen gesetzt'. Auto-Mode genehmigt Tool-Calls via Classifier, braucht keine User-Prompt für jeden git push oder npm install. Für Shop: autoMode.environment mit Trusted Domains (Stripe, IONOS DNS, GitHub.com), Trusted Cloud Buckets (S3 für Bilder).

- **SessionStart Hook für Optional-Services**  
  _BegrÃ¼ndung:_ setup.sh lädt Dependencies und cached (npm, pip). SessionStart Hook startet optional async: 'docker pull postgres:15' im Hintergrund, so Cloud-Session sofort nutzbar, DB später ready. Hook in .claude/settings.json: 'hooks': { 'SessionStart': 'sh scripts/async-setup.sh &' }

- **Secrets via Environment Variables + AWS Secrets Manager**  
  _BegrÃ¼ndung:_ Pro/Max Plans: nutze API Credentials UI für Stripe Key. Für DB Password + IONOS API Key: AWS Secrets Manager (kostet fast nichts, sehr sicher). SessionStart Hook: `aws secretsmanager get-secret-value` in .env schreiben. Alternativ: .env.local mit Platzhalter im Repo, nur Developer hat echte Werte lokal.

- **Monorepo mit /apps/web und /apps/api trennen**  
  _BegrÃ¼ndung:_ Next.js Frontend + Payload CMS als separate Apps ermöglicht: (1) Cloud-Sessions arbeiten isoliert an Web oder API ohne Merge-Konflikte, (2) Deployment unabhängig (Web auf Vercel, API auf Vercel oder Hetzner), (3) Types werden aus /packages/shared geteilt. Struktur: /apps/web (next.js), /apps/api (payload), /db (migrations), /packages/shared (types), /.github/workflows/ (CI), /PLAN.md, /CLAUDE.md

- **GitHub Actions + Test Gates vor Merge**  
  _BegrÃ¼ndung:_ Jede Cloud-Session müsste PR mit Tests pushed. Workflow: push → npm test, npm run lint, npm run type-check müssen GREEN sein. /goal in Cloud-Session: 'npm test passes && lint clean && PR created'. Wenn Test fehlschlägt, Auto-Fix Loop triggert Cloud-Session erneut.

- **PostgreSQL + Payload CMS als Backend von Anfang an**  
  _BegrÃ¼ndung:_ Payload CMS bietet: Admin UI für Jutta (Produkte hochladen), REST API für Frontend, Role-Based Access (Kunde vs Admin), Media Handler (Bilder speichern), Hooks für Business Logic (Steuern berechnen, Email senden). Migrations tracken in /db/migrations/, Cloud-Agent kann neue Fields hinzufügen ohne manuelles SQL.

- **Vercel für Frontend, AWS RDS für DB**  
  _BegrÃ¼ndung:_ Vercel: kostenlos für kleine Sites, EU-hosted Option (DE Server), auto-SSL, git-connected Deployments. RDS: €15/mo kleine PostgreSQL, 99.95% uptime. Vercel-Postgres Alternative: auch OK, aber RDS ist etablierter. IONOS DNS bleibt. Gesamt-Kosten P0→P1: ~€30-40/mo, skalierbar.

- **Rechtliche Vorab-Klärung vor P1**  
  _BegrÃ¼ndung:_ AGB + Datenschutz sollte Jurist checken (Kunsthandwerk vs Kleinunternehmer-Regeln). StB auch consulten für Steuer-Modell (19% USt?, Exceptions für Unikate?). Kostet einmalig €200-500, spart später Ärger. Links in Footer: /datenschutz, /impressum, /agb (Payload Pages).

## Umsetzungsanforderungen

- GitHub: Repo erstellen, Claude GitHub App installieren, Developer User einladen
- Claude Setup: Pro/Max Plan, /login durchführen, /web-setup Terminal-Token verbinden
- Lokal aufsetzen: Node.js 18+, Docker für PostgreSQL-Dev, git configured
- PLAN.md schreiben: P0 (Skelett), P1 (Frontend + Backend), P2 (Shop-Features), P3 (Tattoo-Seite), P4 (Admin + Inventory), mit DoD für jeden Task
- CLAUDE.md schreiben: Shop-Anforderungen, Tattoo/eShop-Unterscheidung, Design-Richtlinie, Datenmodell-Übersicht
- .claude/settings.json vorbereiten: autoMode.environment (Trusted Repos, Domains, Buckets), hooks (SessionStart), permissions.allow (Bash Commands)
- .env.example erstellen: DB_URL, STRIPE_SECRET_KEY, IONOS_API_KEY (Platzhalter, echte Werte lokal)
- setup.sh schreiben: npm install, TypeScript setup, pg Client
- Monorepo-Struktur: /apps/web, /apps/api, /packages/shared, /db, /.github
- .github/workflows/*.yml: test.yml, lint.yml, build.yml, deploy-web.yml
- Datenmodell: Products (Ceramics, Clothing), TattooInquiries, Orders, Inventory, Users (Admin Role)
- TypeScript Types: /packages/shared/types/product.ts, /packages/shared/types/order.ts, /packages/shared/types/tattoo.ts
- Seed Data: /db/seeds/tattoos.json, /db/seeds/ceramics.json (Jutta's 5-10 Beispiele mit Fotos)
- Test Setup: vitest für Unit Tests, Playwright für E2E (Checkout-Flow)
- Vercel: Projekt erstellen (Web), env vars konfigurieren (DB_URL, STRIPE_KEY aus Secrets), GitHub Connected Deployments an
- AWS RDS: PostgreSQL Instanz (Frankfurt), Security Group mit Vercel IPs + Local Dev IP whitelist
- Stripe: Account in DEU registrieren, Test vs Live Keys, Webhook Endpoints für Zahlungen + Rechnungen
- IONOS: API Token für DNS generieren, in Secrets Manager oder env var speichern
- Instagram: Bio Link auf planetclairetattoos.com vorbereiten (nach Domain SSL live)
- Jutta Account: Instagram @planet.claire.tattoos besteht, Email jutta@planetclairetattoos.com existiert

## Offene Fragen aus der Recherche (inzwischen im Interview beantwortet, siehe docs/ENTSCHEIDUNGEN.md)

- Steuer-Modell: Ist Jutta Kleinunternehmer (<22.500 EUR p.a.), Regelsatz (19% USt), oder registriert UStId? _(Optionen: Kleinunternehmer (0% USt, vereinfacht) / Regelsatz (19% USt, komplexer) / Noch nicht klar, muss mit StB klären; Empfehlung: Noch nicht klar, muss mit StB klären)_
- Versand-Land: Nur Deutschland, oder auch EU/International? _(Optionen: Nur Deutschland (DHL Standard) / EU (DHL Parcel, USt Regelung beachten) / Weltweit (DHL Express, Komplexität hoch); Empfehlung: Nur Deutschland (DHL Standard))_
- Hosting: Vercel + RDS, oder Hetzner VPS Docker? _(Optionen: Vercel (Web) + AWS RDS (DB) / Hetzner VPS 6 EUR/mo mit Docker + Caddy / Hybrid: Vercel Web + Hetzner API server; Empfehlung: Vercel + RDS)_
- Datenbank: PostgreSQL lokal / RDS, oder Vercel Postgres? _(Optionen: Vercel Postgres (managed, EU region) / AWS RDS PostgreSQL (Frankfurt) / Lokal Docker für Dev, Heroku/Railway für Production; Empfehlung: Vercel Postgres (managed, EU region))_
- Zahlungs-Gateway: Stripe only, oder auch PayPal/Klarna? _(Optionen: Stripe only / Stripe + PayPal / Stripe + Klarna (BNPL, beliebter in DE); Empfehlung: Stripe + PayPal)_
- Admin Interface: Payload CMS Admin, oder Custom Next.js Dashboard? _(Optionen: Payload CMS Admin (out-of-the-box, einfach) / Custom Next.js Admin (komplexer, Jutta muss verstehen) / Hybrid (Payload Admin für Products, Custom für Inventory); Empfehlung: Payload CMS Admin (out-of-the-box, einfach))_
- Inventory System: Simpel (manuell, Cloud-Agent synced täglich), oder Echtzeit-Tracking? _(Optionen: Manuell: Jutta setzt Mengen in Admin UI, Cloud-Agent prüft täglich 'zeigt X Stücke übrig' / Echtzeit: Order-Hook senkt Inventory sofort / Spreadsheet-Sync: Google Sheets ↔ Payload API; Empfehlung: Manuell: Jutta setzt Mengen in Admin UI, Cloud-Agent prüft täglich)_
- Cloud-Session Frequency: Täglich, oder nur on-demand per github.io/code? _(Optionen: Nur on-demand: Jutta öffnet claude.ai/code, beschreibt Task, Cloud-Agent läuft / Nightly Routine: 23h cron, prüft PLAN.md, arbeitet offene Tasks ab / Hybrid: Routine für Reporte, on-demand für Features; Empfehlung: Hybrid: Routine für Reporte, on-demand für Features)_
- Email: SendGrid, Brevo (ex-Sendinblue DEU), oder SMTP-Relay? _(Optionen: SendGrid (Standard, nicht EU) / Brevo (DEU, GDPR-freundlich) / AWS SES (cheapest, aber komplexer); Empfehlung: Brevo (DEU, GDPR-freundlich))_
- SSL-Zertifikat: Let's Encrypt via Vercel, oder manuell? _(Optionen: Vercel managed SSL (auto, kostenlos, easiest) / IONOS SSL Zertifikat + manual renewal / AWS Certificate Manager (wenn auf Hetzner hosten); Empfehlung: Vercel managed SSL (auto, kostenlos, easiest))_
- Analytics: Matomo (privat), Google Analytics 4 (cloud), oder skip? _(Optionen: Skip (minimal, legal safe, aber blind) / Google Analytics 4 mit Consent-Banner (kostenlos, popular, aber USA) / Matomo self-hosted (kostenlos open-source, GDPR-sauber, aber mehr Setup); Empfehlung: Google Analytics 4 mit Consent-Banner)_
- Newsletter: Brevo Newsletter, oder skip für MVP? _(Optionen: Skip MVP, später in P3 hinzufügen / MVP: Brevo Double-Opt-in List + Email-Collect Form im Shop / Form + Manual Email (Jutta sendet sich selbst); Empfehlung: Skip MVP, später in P3 hinzufügen)_
- Design System: Component Library (React Storybook), oder Inline Tailwind? _(Optionen: Inline Tailwind in Next.js components (simple, schnell) / Storybook + Tailwind (organized, aber mehr Setup) / shadcn/ui components (pre-made, Tailwind-based, dazwischen); Empfehlung: shadcn/ui components (pre-made, Tailwind-based))_
