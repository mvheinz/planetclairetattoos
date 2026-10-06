# ADR 0002 – `script-src` der CSP (Spike B-03, CSP-Teil von B-01)

- **Status:** angenommen (27.09.2026, P2.12)
- **Kontext:** ARCHITEKTUR §8.1 sieht im Kontext `public` (statische Seiten) als Soll `script-src 'self'` plus
  `experimental.sri` und den `sha256`-Hash des festen Inline-Skripts `pc-motion` vor – ohne `'unsafe-inline'`. In den
  Nonce-Kontexten `dynamic`, `checkout` und `admin` setzt der Proxy je Anfrage eine Nonce mit `'strict-dynamic'`.
- **Spike B-03 (Next.js 16.3.6, Produktions-Build):** Mit `experimental.sri: { algorithm: 'sha256' }` und
  `script-src 'self' 'sha256-<pc-motion>'` meldet Chromium auf **jeder** statischen Seite (R01, R20–R25, R27, 404)
  zwei blockierte Inline-Skripte: `(self.__next_f=self.__next_f||[]).push([0])` und die RSC-Daten
  `self.__next_f.push([1,"…"])`. SRI versieht nur `<script src>`-Dateien mit `integrity`; die Inline-Daten wechseln je
  Seite und Build und lassen sich in `next.config.ts headers()` (beim Laden der Konfiguration, vor dem Build berechnet)
  nicht per Hash erlauben. Eine Nonce setzt dynamisches Rendern voraus (Next-Doku „Content Security Policy“) – die
  Seiten wären nicht mehr statisch (Erfolgskriterium B-03 verletzt). → **Soll nicht erreichbar.**
- **Entscheidung B-03 (Rückfallebene laut Anhang B):** Kontext `public`: `script-src 'self' 'unsafe-inline'`, keine
  fremden Hosts (R-131 erfüllt, Kanzleifrage K-41). Der Hash von `pc-motion` steht dort **nicht** mit in `script-src`,
  weil Browser `'unsafe-inline'` ignorieren, sobald ein Hash oder eine Nonce vorhanden ist. `experimental.sri` bleibt
  aus (bringt ohne strikte `script-src` keinen Gewinn, ist experimentell). Schalter: `PUBLIC_SCRIPT_POLICY` in
  `src/lib/security/csp.ts`.
- **Entscheidung `pc-motion` in `dynamic`/`checkout`:** Das Skript steht im gemeinsamen Wurzel-Layout (`SiteDocument`),
  das auch statische Seiten rendert und die Nonce nicht kennt (Lesen von `headers()` dort machte alle Seiten dynamisch).
  Es wird in diesen Kontexten deshalb über seinen `sha256`-Hash **neben** der Nonce erlaubt (`'self' 'nonce-…'
  'strict-dynamic' 'sha256-…'`) – gleich streng, nur exakt dieser Text. Abweichung von §8.1 („trägt die Nonce“), dort
  angepasst.
- **CSP-Teil Spike B-01 (Verwaltung):** Soll erfüllt. Unter `ADMIN_ROUTE` setzt der Proxy
  `script-src 'self' 'nonce-…' 'strict-dynamic'`; Login, Liste und Bearbeiten laufen ohne CSP-Verstoß
  (`tests/e2e/security-headers.e2e.spec.ts`, `admin*.e2e.spec.ts`). Kein Rückfall nötig (`ADMIN_SCRIPT_POLICY = 'nonce'`).
- **Anwendung / `server-only`:** `src/lib/security/{csp,headers,inlineScripts}.ts` sind reine Konfiguration ohne
  Geheimnisse und werden von `next.config.ts` geladen, wo `import 'server-only'` wirft (keine `react-server`-Bedingung,
  vgl. ADR 0001). Sie stehen deshalb in `SERVER_ONLY_EXEMPT` (`scripts/lib/static-checks/import-rules.ts`).
  `next.config.ts headers()` setzt die allgemeinen Header und die CSP `public` für alle Pfade und `api` für `/api/*`; der
  Proxy überschreibt CSP und Zusatz-Header der Nonce-Kontexte (genau ein CSP-Header je Antwort, E2E-geprüft).
- **Folgen:** Ein Inline-Skript-Angriff auf statischen Seiten wird nicht durch die CSP, sondern nur durch React-Escaping
  und fehlende Nutzereingaben auf diesen Seiten verhindert; Kasse, Warenkorb, Token-Seiten, Widerruf und Verwaltung
  bleiben strikt (Nonce). Wieder prüfen, wenn Next.js Hashes für Inline-RSC-Daten statischer Seiten anbietet
  (`PUBLIC_SCRIPT_POLICY = 'hash'`, `experimental.sri`, E2E `security-headers` zeigt Verstöße sofort).
- **Bestätigung P10.5 (05.10.2026):** Entscheidung B-03 und der CSP-Teil von B-01 unverändert. Audit: Kontext je
  Registry-Route (Unit, alle Umgebungen x Kontexte), Header aller API-Endpunkte (Kontext `api`), Verwaltungs-Kontext,
  Auto-Fixture `cspViolations` in `tests/e2e/fixtures.ts` (jeder CSP-Verstoß in jedem E2E-Test lässt ihn scheitern).
