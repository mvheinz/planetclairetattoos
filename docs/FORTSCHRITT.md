# Fortschritt

Neueste Einträge oben. Format: `## YYYY-MM-DD – Phase/Aufgabe` + was erledigt wurde + wie getestet.

## 2026-09-28 – P2.22

- `@axe-core/playwright` 4.13.0 exakt gepinnt; `tests/e2e/a11y.e2e.spec.ts` @a11y: axe (wcag2a/2aa/21a/21aa/22aa) auf allen live-Routen DE/EN sowie offenes Menü, 404, 500, Rechtsseite mit Platzhalter und Leerzustand der Startseite (home kurz auf Entwurf, Abruf im Draft-Modus ohne Cache-Schreiben, Advisory-Lock); Gate 0 serious/critical, moderate/minor als Annotation; `lang` je Seite (EN-Rückfall auf Deutsch als `lang="de"`).\n- `tests/e2e/keyboard.e2e.spec.ts`: Skip-Link zuerst und springt zu `#inhalt`, jedes fokussierbare Element per Tab erreichbar (vorwärts/rückwärts), Kopf→Menü (Falle, Esc), Fuß: Schalter „Animationen“ per Leertaste/Enter, Sprachumschalter; Fokus an jedem Halt sichtbar (Screenshot mit/ohne Fokus verschieden; Gegenprobe ohne Fokusring schlägt fehl). WebKit: Alt+Tab (Safari-Tastaturbedienung für Links).\n- Keine Verstöße im Produktcode gefunden.\n- Tests: a11y 84 + keyboard 18 E2E grün in 3 Projekten; Gesamtlauf `pnpm test:e2e` 478 grün.

## 2026-09-28 – P2.21

- `tests/e2e/privacy.e2e.spec.ts` @privacy: alle live-Routen (R01, R20–R27 je DE/EN, 404/500 je Sprache, Weiterleitung `/`) in frischem Kontext, 3 Projekte: keine Cookies, kein `Set-Cookie`, Local/Session Storage, IndexedDB und Service Worker leer; Requests nur eigener Origin/`data:`/`blob:`, nie Google Fonts; Registry-Abdeckung geprüft.\n- `pnpm check:external --built` prüft jetzt auch Fremd-URLs in öffentlich ausgelieferten Dateien (HTML/RSC + transitiv geladene Chunks), Allowlist Instagram + nie geladene Kennungen.\n- Tests: 72 E2E grün (desktop, iphone-15/WebKit, pixel-7), Unit check-external 2 grün, check:external ok.

## 2026-09-28 – P2.20

- Startseite R01 aus `pages:home` (`src/lib/data/home.ts`, öffentlicher Payload, Name aus `settings.business.tradeName`): Kopf-Station „Planet Claire“ mit Planet-Marke (Anker `orbit`, Intro MI-10) und 7 Stationen (`HomeStation`, KO-21): Stationsmarke Planet/Stern mit MI-12-„pop“, Kicker „Station 01“ (Plex Mono), H2 Mansalva, Text, Stationszeichnung (`src/art/stations` bzw. Ersatzzeichnung), Link „Alle …“ (Kategorie-Slugs je Sprache). Schlaufen je Station laut §11.4 (right/lasso/left/spiral/right/contour/left), Coco-Posen aus `cocoPose`; ab 768 Zeichnung links an der Rinne, damit die Linie keinen Text kreuzt. Keine Produktkarten (W-33). Fehlt `home`: Leerzustand (DM-PAGE-01).\n- Engine: `data-leash-reached` an erreichten Stations-Ankern (für MI-12).\n- Tests: int `pages/home-data.int.spec.ts` (4), e2e `home.e2e.spec.ts` (Reihenfolge DE/EN, ohne JS, Linie zeichnet beim Scrollen, mobil LCP < 2,5 s / CLS < 0,1) grün; volle E2E-Suite grün bis auf den vorbestehenden WebKit-Menütest; `pnpm check`, `test:int`, `build`, `check:bundle` grün.

## 2026-09-28 – P2.19

- 404 R28 „Coco hat sich losgerissen“ / „Coco slipped her leash“ (NotFoundContent): Preset `lost` für jede Adresse ohne Registry-Route, Tuschelinie vom Kopf in Schlingen (`coil`), Leinenende = offener Karabiner mit leerem roten Geschirr (Tuschestrich-Zeichnung `src/art/errorArt.ts`), Coco `horizon` rennt einmal weg und die Leine schwingt 2 × (Modul `lost`, MI-11, ≤ 5 s); CMS-Text `not_found` mit Rückfall-Satz; Links Start, Shop, Tattoo; Variante „Zuhause“ als Prop vorbereitet.\n- 500 R29 (`error.tsx`, `global-error.tsx`): Knäuel aus 3 Schlingen, Coco `kopfschief` xl, „Nochmal versuchen“ (`retry()`), Link Start, Fußbereich; ohne Preset, Engine abgebaut, keine Animation (`body[data-page-error]`). Test-Auslöser `/<sprache>/__fehler-test` wirft nur bei APP_ENV=test (Playwright-Webserver setzt es), sonst 404; nicht in Registry/Sitemap.\n- Abweichung: kein `[...rest]` – Next 16.3 liefert dafür nur eine leere Fehler-Hülle; 404 bleibt bei `global-not-found` (OFFENE-PUNKTE).\n- Tests: e2e `error-pages.e2e.spec.ts` 8 Tests × 3 Projekte grün (inkl. ohne JS, reduzierte Bewegung); Unit `art/error-art` + Verhaltensvertrag `lost`; volle E2E-Suite gegen Produktions-Build grün bis auf den vorbestehenden WebKit-Menütest; `pnpm check`, `test:int`, `build` grün.

## 2026-09-28 – P2.18

- Coco-Platzhalter-Sprite mit allen 22 Symbolen (6 Posen × A/B/C + 4 Brücken), gezeichnet im Tuschestrich mit Fell-/Geschirr-Wash, D-Ring-Anker, `data-part`-Gruppen, nur `<path>`; `pnpm art:coco-placeholder` (Generator), `pnpm art:sprite` (SVGO → `public/art/coco-sprite.v1.svg` ≈ 42,9 KB / 11,5 KB gz, `coco-sprite.json`), Kalibrierbogen `docs/design/qa-log/img/calibration-p2-placeholder.webp` (`pnpm art:calibration`).\n- `src/leash/coco.ts` (≈ 1,7 KB gz): Posenwechsel nur an Frame-Grenzen, Brücken (bremsen, abspringen, einrollen), Boil-Budget (höchstens 5 s ohne Aktion), reduzierte Bewegung = Ruhe-Pose Frame A. `src/components/Coco.tsx` + `src/styles/coco.css` (feste Box je Größe, kein CLS, forced-colors).\n- Coco läuft an der Leinenspitze der Startseite, sitzt im Menü (kopfschief) und in leeren Zuständen; Sprite mit `Cache-Control: immutable`.\n- View Transitions mit Coco: weich (React-`<ViewTransition>`, nicht zu/von calm, nicht bei reduzierter Bewegung) und hart (`view-transition-name: coco`); ADR 0003 ergänzt.\n- Tests: unit `tests/unit/art/sprite.unit.spec.ts` (12), `tests/unit/leash/coco.unit.spec.tsx` (11), Budgets in `check:bundle`; e2e `tests/e2e/coco.e2e.spec.ts` (8) – ganze E2E-Suite gegen `pnpm start` grün (266), `check:no-debug` grün.

## 2026-09-28 – P2.17

- `src/leash/static.ts`: statischer Renderer Stufe C (≈ 2,2 KB gz) – Randlinie auf Rechtsseiten, H1-Unterstreichung auf calm; die Laufzeit nutzt ihn bei reduzierter Bewegung. Rechtsseiten laden die Engine nicht.\n- Reduzierte Bewegung: Linie sofort vollständig, kein Intro, Coco ruht in der Ruhe-Pose (`REST_POSE`, §10.6) an Station 1; Umschalten ohne Neuladen.\n- Debug nur mit `NEXT_PUBLIC_LEASH_DEBUG=1`: `window.__leash` inkl. `pose()`, `setReadingY(y)`; `window.__qa` (frames, loaf, longtasks, shifts, events, poseLog, marks, start/stop/dump). `pnpm check:no-debug` neu; Modul-Budgets in `check:bundle`.\n- Tests: unit runtime (+5), static (4), check-no-debug/Budgets (3); e2e `reduced-motion.e2e.spec.ts` (AK-DS-14, AK-DS-03 R01/R21, Schalter, Rechtsseite ohne Engine) gegen `pnpm start` grün; `check:no-debug` grün (Gegenprobe mit Debug-Build schlägt an).

## 2026-09-28 – P2.16

- `src/leash/measure.ts` (eine Lesephase), `runtime.ts` → `mountLeash` mit Stufen A (Maske)/B (Feder)/C, Abstufung A → B nur im Speicher, Segment-Zuständen, Lesezeile 0,72, monotoner Tinte, Coco-Glättung, Neuaufbau (ResizeObserver, fonts.ready, load; 150 ms entprellt, < 120 px Höhe ignoriert), IntersectionObserver-Pause, journey-Intro und Leinen-Anschluss.\n- React-Hüllen `src/components/leash/{LeashLayer,Station,ViewTransitionOptIn}.tsx`; Laufzeit lädt nach LCP + 300 ms bzw. load + 1200 ms per Idle (`schedule.ts`), nie auf legal/calm; `window.__leash`-Grundumfang (`debug.ts`) nur bei NEXT_PUBLIC_LEASH_DEBUG=1.\n- Spike View Transitions → ADR 0003 (harte Navigation per @view-transition unter no-preference, ohne calm).\n- Tests: unit runtime (12, AK-DS-18) + motion (3); e2e tests/e2e/leash.e2e.spec.ts (AK-DS-13, AK-DS-15, Chunk-Analyse, legal ohne Laufzeit, View Transitions) gegen dev und start grün; Engine-Chunk 8,6 KB gz.

## 2026-09-28 – P2.15

- `src/leash/` Kern ohne DOM: `types.ts` (wörtlich DESIGN §9.1), `random.ts` (fnv1a32, mulberry32, valueNoise1D), `presets.ts` (Tabelle §9.7 für alle 11 Presets, Wackel, Rinnen, Scroll-Wege), `poses.ts` (COCO_POSE_TO_SPRITE).\n- `geometry.ts`: buildGeometry mit Schritten 1–11 (§9.3), allen Schlaufenformen (§9.5) inkl. Freiraum-Regel, Tintenpunkten, Verjüngung, Segmenten, LUT und scrollMap (§9.6); dazu mapReadingY/pointAt.\n- Tests: unit tests/unit/leash/{random,geometry,loops,poses}.unit.spec.ts (26 Tests, AK-DS-12); Median journey 390×844 ≈ 3 ms in Node; Pfaddaten ≈ 18 KB mobil / 23 KB Desktop.

## 2026-09-27 – P2.14

- Kontakt R20 (Preset margin) aus pages:contact mit Kontaktwegen aus getPublicSettings() (mailto mit Betreff, Instagram-Profil und DM-Link, Studio-Bezirk), Hinweise „Vertrag widerrufen“ und Impressum, kein Formular; ohne Seite neutraler Leerzustand (DM-PAGE-01).\n- „Vertrag widerrufen“ R26 (Preset calm, dynamisch, noindex/follow): h1, Hinweis „noch ohne Funktion – kommt in P6“, Link zur Widerrufsbelehrung, E-Mail als Alternative.\n- Gerüst-Komponente ScaffoldPage entfernt (alle Gerüstseiten ausgebaut).\n- Tests: e2e contact-withdraw (17 grün, 4 nur-desktop übersprungen), Fußlink-Prüfung 7 Links × DE/EN auf allen Live-Seiten = 200; bestehende Frontend-E2E (135) grün; pnpm check, test:int, build grün.

## 2026-09-27 – P2.13

- Rechtsseiten R21–R25 aus der gültigen legal-texts-Fassung (Loader src/lib/data/legal.ts, Tokens ersetzt, Lexical als Server-HTML mit h1→h2), Platzhalter-Band, „Stand“, EN-Rückfall auf Deutsch, neutraler Leerzustand statt 500; R24 mit Muster-Formular und Link „Vertrag widerrufen“; R25 nur Text (Tabelle P4).\n- R27 mit Einleitung aus pages:conformity (falls vorhanden) und Liste aktiver Erklärungen, sonst fester Satz.\n- Ruhe-Modus: keine Animation/Transition im <main> bei Preset legal/calm (global.css).\n- Tests: e2e legal-pages (48 grün, 3 Geräte), int public-pages (8 grün); pnpm check, test:int, build grün.

## 2026-09-27 – P2.12

- `src/lib/security/csp.ts` (Kontexte `public`, `dynamic`, `checkout`, `admin`, `api` nach §8.1; Fremd-Hosts nur Stripe auf der Kasse bei `PAYMENTS_DRIVER=stripe`; Nonce je Anfrage) und `headers.ts` (allgemeine Header, HSTS nur production/staging, `X-Robots-Tag` außerhalb production, Token-Seiten, Kasse, Verwaltung). Anwendung: `next.config.ts headers()` für alle Pfade (`public`) und `/api/*` (`api`), der Proxy überschreibt für Nonce-Kontexte (R26 jetzt dynamisch gerendert, Verwaltung); genau ein CSP-Header je Antwort.
- Spike B-03: Soll (SRI + Hash) scheitert an den Inline-RSC-Daten von Next → Rückfall `'unsafe-inline'` im Kontext `public`, nur `'self'` (ADR `docs/adr/0002-csp-script-src.md`, ARCHITEKTUR Anhang B). CSP-Teil B-01: Verwaltung läuft mit Nonce ohne Verstoß (Soll erfüllt).
- `pc-motion`-Hash aus `inlineScripts.ts` in `dynamic`/`checkout` neben der Nonce; `security/{csp,headers,inlineScripts}.ts` ohne `server-only` (von `next.config.ts` geladen, Ausnahme im Static-Check); Stripe-Hosts nur in diesen Dateien erlaubt. Gegenprobe in `admin-privacy.e2e.spec.ts` umgeht die CSP (`bypassCSP`), weil die CSP die Probe-Anfrage jetzt selbst blockiert.
- Tests: unit `tests/unit/security/headers.unit.spec.ts` (12; T-16, R-131 gegen DIENSTE-YAML, Hash-Abgleich), e2e `tests/e2e/security-headers.e2e.spec.ts` (AK-A-8-01, R-136, keine CSP-Verstöße auf live-Routen und in Login/Liste/Bearbeiten); volle E2E-Suite 183 grün (Produktions-Build, 3 Projekte), `pnpm check`, `pnpm test:int`, `pnpm build`, `check:external --built` grün.

## 2026-09-27 – P2.11

- `src/lib/seo/metadata.ts` → `buildMetadata(routeId, locale, params)`: Titel „{Seite} · Planet Claire“ (Start „Planet Claire – {Claim}“), Beschreibung je Seitentyp aus den Nachrichten (`seo.descriptions`, 120–160 Zeichen), Open Graph mit Standardbild, `robots` aus der Registry; canonical + hreflang `de`/`en`/`x-default` (absolute Apex-URLs aus `NEXT_PUBLIC_SITE_URL`) nur auf indexierbaren Seiten. Alle Seiten nutzen `routeMetadata(id)`.
- Organization-JSON-LD auf R01 (Name, URL, Logo, `sameAs` Instagram, ohne Adresse); `https://schema.org` als Bezeichner in die URL-Allowlist von `check:static` aufgenommen.
- `src/app/robots.ts` + `src/lib/seo/robots.ts` (Produktion `Allow` + Sperrliste aus der Registry + Sitemap, sonst `Disallow: /`, nie `ADMIN_ROUTE`), `src/app/sitemap.ts` (live + indexierbar, beide Sprachen mit Alternates); `X-Robots-Tag: noindex, nofollow` außerhalb der Produktion über `next.config.ts headers()`, für Weiterleitungen/404 des Proxys im Proxy.
- Tests: unit `tests/unit/seo/metadata.unit.spec.ts` (10), e2e `tests/e2e/seo.e2e.spec.ts` (AK-2-04, AK-2-05, AK-A-4-03, T-07, R26 `noindex, follow`) – 78 E2E grün (3 Projekte, Produktions-Build); `pnpm check`, `pnpm build`, `check:external --built` grün.

## 2026-09-27 – P2.10

- Fußbereich `SiteFooter` (KO-04, liegt wie die übrigen Rahmen-Bausteine unter `src/components/layout/`) in DOM-Reihenfolge: „Vertrag widerrufen“ als Knopf-Link → R26, `LegalFooter` (6 Pflichtlinks, Konformitätserklärungen nur bei aktiver Erklärung), `nav#fussnavigation` mit Menüliste + Instagram, Sprachumschalter, Schalter „Animationen“ (`src/behaviors/motion-toggle.ts`, `aria-pressed`, „aus (Systemeinstellung)“, `pc-motion` erst nach Klick, Vorschau nur im Speicher), Platz für Preis-Fußnote, „© {Berliner Jahr} Planet Claire · Berlin“.
- Damit der Fuß auch auf 404/500 steht, gibt es minimale Grundformen: `[locale]/not-found.tsx`, `src/app/global-not-found.tsx` (Next `experimental.globalNotFound`, Kopf und Fuß schon im HTML) und `[locale]/error.tsx`; Gestaltung, Coco und Fehler-Auslöser folgen in P2.19. Gemeinsames Dokument `SiteDocument`, `RouteOverride` für 404 ohne Registry-Route.
- Tests: e2e `footer.e2e.spec.ts` @smoke (R-011, R-090, AK-3-11, AK-DS-09; 390/1440, reduce/no-preference, ohne JS) und `motion-toggle.e2e.spec.ts`; unit `motion-toggle.unit.spec.ts`, `footer-links.unit.spec.ts`; 102 E2E (3 Projekte, gegen Produktions-Build), `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P2.9

- MenuOverlay (KO-03): serverseitiges <dialog id="menu" aria-label="Menü"> mit Hauptliste (Start · Shop · Archiv · Auftragsarbeiten · Tattoo · Über mich & Coco · Kontakt), Kategorien aus categories (showInNavigation, src/lib/data/navigation.ts, gecacht, ohne DB robust), Tattoo-Unterseiten aus der Registry, unten Sprachumschalter, Instagram und Pflichtlinks inkl. „Vertrag widerrufen“, Coco-Platz\n- Verhaltensmodul src/behaviors/menu.ts: showModal, Fokus auf ersten Link, eigene Tab-Falle (auch Safari), Esc/„Schließen“ mit Fokus zurück, html[data-menu-open] (overflow hidden + scrollbar-gutter stable), MI-05 per WAAPI (≤ 700 ms), Linkklick schließt sofort; bei reduzierter Bewegung ohne Animation\n- LinkUnderline (MI-06, 3 Pfade per Hash des href) an Menü- und Kopflinks; ohne JS führt „Menü“ zu #fussnavigation\n- Tests: e2e tests/e2e/menu.e2e.spec.ts @smoke (AK-DS-08, ohne JS; 21 grün in 3 Projekten inkl. WebKit), Vertragstest AK-DS-18 um menu ergänzt; pnpm check, pnpm build grün

## 2026-09-27 – P2.8

- Seitenrahmen AppShell (KO-01): Skip-Link → SiteHeader → Vorschau-Banner → <main id="inhalt"> mit Linien-Ebene als Geschwister; <body data-preset>/<data-route> aus der Registry über die Layout-Segmente (PresetBody), <html data-motion> per festem Inline-Skript pc-motion (src/lib/security/inlineScripts.ts mit sha256-Hash für P2.12)\n- SiteHeader (KO-02): Wortmarke bzw. unter 375 px Planet-Marke, Shop/Tattoo (aria-current), Korb mit immer reserviertem Platz für die Anzahl (cart-count), Menü-Link #fussnavigation mit aria-controls/-haspopup/-expanded, handgezeichnete Unterkante in 3 Varianten nach Routen-Seed\n- Vorschau-Banner nur bei SEED_PREVIEW_MODE=true und APP_ENV≠production, im Export mit Phase\n- Tests: e2e tests/e2e/shell.e2e.spec.ts @smoke (AK-DS-07 bei 320/360/390/1440, Korb-Cookie, Skip-Link, Banner; 27 grün in desktop/iPhone-WebKit/Pixel), unit tests/unit/layout/shell.unit.spec.ts (15); pnpm check, pnpm build grün

## 2026-09-27 – P2.7

- Grundbausteine unter src/components/ui/: Button (Primär/Sekundär/Text, KO-11), Field/Select/Checkbox/Radio/RadioGroup (KO-12), EmptyState (KO-17-Rahmen mit Coco-Platz), Callout (KO-22), PlaceholderBanner (R-002), LinkUnderline (MI-06, für Sekundärknopf und Menü)\n- Checkbox/Radio haken nur bei ausdrücklichem checked=true an; Knopf-/Auswahl-Zielflächen ≥ 44 px\n- Tests: unit tests/unit/components/ui.unit.spec.tsx (14, jsdom + Testing Library); pnpm check, test:int grün

## 2026-09-27 – P2.6

- src/behaviors/types.ts (mount → unmount), Register src/behaviors/index.ts mit mountBehaviors (lädt per import() nur Benötigtes), BehaviorHost im Layout (bindet bei Routenwechsel neu)
- erstes Modul cart-count: liest pc_cart nur, wenn vorhanden, setzt nichts; MI-07 (scale 1→1.25→1, 240 ms, --ease-stamp), bei reduzierter Bewegung sofort; Vorschau zählt nur im Speicher
- Tests: unit behaviors/contract (10: AK-A-15-02, AK-A-2-03 inkl. transitiver Importe, AK-DS-18 mit Listener-/Observer-/Timer-/Animations-/Speicher-Protokoll, Gegenproben), cart-count (8), leash/motion (2); pnpm check, test:int, build, E2E (75) grün

## 2026-09-27 – P2.5

- 18 handgezeichnete Icons (src/art/icons, je ≤ 600 B) → pnpm art:icons → Inline-SVG-Komponente Icon (aria-hidden, mit label role=img)
- pnpm art:brand: Wortmarke (4,4 KB, Mansalva-Umrisse, Planet als i-Punkt), icon.svg, favicon.ico (16/32), apple-icon.png (180), public/og/default.png (1200×630); Komponente WordmarkLink; Verwaltung mit eigenem Logo/Icon/Favicon
- Tests: unit icons (9: Bestand, Größe, Attribute, Freshness, aria, Name „planet claire – Startseite“, ICO/PNG-Maße); Build grün, alle Dateien per pnpm start mit 200 vom eigenen Origin geprüft; pnpm check, test:int grün

## 2026-09-27 – P2.4

- Fontsource-Pakete, subset-font, fontkit als Dev-Abhängigkeiten; `pnpm fonts:copy` (scripts/fonts/copy.ts) erzeugt 3 WOFF2 unter src/styles/fonts (98,6 KB) und die Mansalva-Abdeckung
- next/font/local in src/styles/fonts.ts (Mansalva/Bricolage mit Preload, Plex Mono ohne), Klassen am <html>; GlyphFallback + .glyph-fallback (Bricolage 600)
- check:bundle prüft AK-DS-04 (genau 3 .woff2, ≤ 100 KB, keine Google-Fonts-Verweise)
- Tests: unit glyphs (5, AK-DS-05) und fonts/copy (6: Determinismus, Budget, Achse 400–700, eingecheckt = erzeugt, check:bundle); pnpm check, test:int, build + check:bundle grün

## 2026-09-27 – P2.3

- src/styles/tokens.css wörtlich aus DESIGN §7 (von Prettier ausgenommen; Test vergleicht Byte für Byte); src/styles/global.css: Reset, Typografie §4.2/§4.3, Links §3.2, Fokus-Ring, Container/Rinne je Preset (data-preset), Ebenen, Sticky/scroll-padding, Schneidematten-Raster §3.4, Bewegungsreduktion (prefers-reduced-motion und html[data-motion=reduced]), forced-colors, Druck; eingebunden im [locale]-Layout\n- Ruheseiten ohne eigene Routengruppe; Ruheseiten-Ordner kommen aus der Registry (Presets calm/legal)\n- Tests: tests/unit/design/{contrast,lint-colors,lint-shadows,lint-motion}.unit.spec.ts (AK-DS-01, -02, -06, -16; mit Negativproben), Helfer tests/helpers/designLint.ts; pnpm check, test:int, build grün; 390 px geprüft (kein Querscrollen)

## 2026-09-27 – P2.2

- src/proxy.ts: Reihenfolge www→Apex (308) → Verwaltung (ADMIN_ROUTE-Umschreibung, /admin 404) → Schrägstrich (308) → Sprachlogik → next-intl-Middleware; nie Set-Cookie\n- Reine Entscheidung decidePublicRoute (src/lib/routes/redirects.ts): / und unpräfixierte Pfade 307 nach Accept-Language mit Vary (übersetzt), Pfad der anderen Sprache und Aliasse 308; pickLocale als reine Funktion (src/i18n/pickLocale.ts)\n- Sieben Kurz-URLs (R-010) als statische redirects() in next.config.ts (308) aus der Registry; R30 in der Registry live\n- Tests: tests/unit/i18n/pick-locale.unit.spec.ts (26), tests/e2e/routing.e2e.spec.ts @smoke (AK-2-02, R-010, AK-A-2-04, AK-A-8-02; 3 Projekte grün), pnpm check + build grün

## 2026-09-27 – P2.1

- next-intl 4.14.7 exakt gepinnt; Routen-Registry src/lib/routes/registry.ts (R01–R31, shortLinks, aliases) + Pfad-Helfer src/lib/routes/paths.ts (localizedPath, alternatePath, matchRoute)\n- src/i18n/{routing,request,navigation}.ts, Nachrichten de/en (9 Namensräume, EN als Entwurf E-62)\n- App-Ordner [locale]/ mit Startseite (vorläufig) und Gerüsten R20–R27; P0-Platzhalter entfernt\n- check:static: neue Teilprüfungen i18n-parity und route-registry (inkl. Abgleich page.tsx ↔ live-Routen)\n- Tests: tests/unit/i18n/parity.unit.spec.ts (T-06), tests/unit/routes/registry.unit.spec.ts (T-07, AK-2-01); pnpm check + build grün
## 2026-09-27 – P1 CI grün

- Phasenende-Lauf `[ci:full p1]` auf PR #1 grün (`CI / quick`, 11 min, Kopf `f266c47`): Lint, Typen, statische
  Prüfungen, Unit, Migrationen + Drift, Int (reihenfolgeunabhängig dank Ausgangszustand je Datei), Seed + Build,
  Budgets, E2E-Rauchtest, gitleaks, audit. Zuvor behoben: falscher `CARRIER_DRIVER` in `ci.yml`, `db:reset` prüft den
  DB-Namen vor dem Verbinden, Int-Tests hingen von der Dateireihenfolge ab.

## 2026-09-27 – P1 Phasen-Abnahme (Datenmodell, Verwaltung, Werkzeuge)

- Alle Aufgaben P1.1–P1.33a erledigt: 27 Collections + 2 Globals mit Migrationen und eigenen Postgres-Objekten,
  Zugriffsschutz (Matrix T-15), Adapter mit Mocks (Speicher, Mail, Zahlung, Übersetzung, Versand), Bildpipeline ohne
  Metadaten, Objektnummern und Veröffentlichungsregeln je Kategorie, Verwaltung unter `/werkstatt` mit Sperre,
  Seed-Rahmen mit Grund-Seed und Mini-Beispielbestand, erweiterte CI (gitleaks, audit, Budget, Minuten-Wächter).
- Lokal grün: `pnpm check` (418 Unit-Tests), `pnpm test:int` (358 grün, 5 optional übersprungen: S3/stripe-mock ohne
  Dienst), `pnpm test:e2e --grep @smoke` (24, desktop/iphone-15/pixel-7), `pnpm build`, `check:migrations`,
  `seed:reset` auf frischer Test-DB.
- Spikes B-01, B-02, B-09 in ARCHITEKTUR Anhang B; ADR 0001 (`server-only` in Skripten).
- Nächster Schritt: CI-Lauf `[ci:full p1]` grün → Merge, dann P2.1. Stolpersteine: Login-Rate-Limit in E2E (Fixture
  `adminPage` meldet über die Local API an); lokalisierte Felder brauchen `localeSync`; Nummern kommen aus Sequenzen.

## 2026-09-27 – P1.33a

- `pnpm ci:minutes` (`scripts/ci/minutes.ts`): Läufe des laufenden UTC-Monats (`created>=JJJJ-MM-01`, alle Seiten), je Lauf `timing` (`billable.UBUNTU.job_runs`), sonst `jobs` (`completed_at − started_at`), je Job aufgerundet; Ausgabe `MINUTEN_MONAT`/`MINUTEN_STATUS` (knapp ab 1.500, erschoepft ab 2.000, `unbekannt` mit deutscher Meldung bei fehlendem `gh`/Netz/Rechten); Exit immer 0; nur GET über injizierbare `gh`-Aufrufe.\n- Lokal ohne `gh`: `MINUTEN_STATUS=unbekannt` („Minuten-Stand nicht abrufbar“).\n- Tests: `minutes.unit.spec.ts` (6, AK-A-6-03) mit aufgezeichneten Antworten unter `tests/fixtures/github/minutes/`; `pnpm check` grün.

## 2026-09-27 – P1.33

- `ci.yml` (Job `quick`) vollständig nach ARCHITEKTUR §6.3: Next-Cache, `check:bundle` + `check:external --built`, Playwright Chromium + WebKit (gecacht), E2E-Rauchtest, gitleaks 8.30.1 (gepinnt, Prüfsumme, nur PR-Commits, `.gitleaks.toml`), `pnpm audit` (critical blockiert, high als Warnung); bei Fehler Budget-Schritt `pnpm ci:artifacts` → Upload nur bei `upload_optional=true`, 2 Tage; `permissions: contents/actions: read`.\n- Neu: `scripts/check-bundle.ts` (Gerüst, nur Gesamtgröße), `scripts/ci/artifact-budget.ts` + `scripts/ci/gh.ts` (gh-Aufrufe injizierbar), `ci-full.yml` (Gerüst, nur `workflow_dispatch`), `.github/dependabot.yml` (nur Sicherheits-Updates), PR-Vorlage; Dev-Abhängigkeit `yaml` 2.9.1.\n- `pnpm audit --prod`: nur eine moderate Lücke (esbuild über drizzle-kit), keine high/critical.\n- Tests: `workflows.unit.spec.ts` (16), `artifact-budget.unit.spec.ts` (5) grün; `pnpm check`, E2E-Rauchtest mit `E2E_SERVER=start` (16 grün), gitleaks lokal ohne Fund.

## 2026-09-27 – P1.32

- `check:static` Teilprüfung `generated-files`: erzeugt `src/payload-types.ts` und `importMap.js` neu, meldet Abweichungen und `any` (DM-P1-06); `typescript.schema`-Hook entfernt Lexicals `tsType: 'any'`.\n- DM-P1-05-Test (TypeScript-AST) für Collections/Globals; `documents.language` nimmt die Optionen jetzt aus `LOCALES`.\n- R-001-Nachverfolgbarkeit (`LEGAL_TRACE_PHASE = 1`, Tabelle §3 geparst, Gegenprobe) und Verbotsmuster-Scan über `src/**`/`content/**` mit begründeter Allowlist.\n- Tests: 5 neue Unit-Dateien grün; `pnpm check`, `pnpm test:int`, `pnpm build`, `check:migrations` grün.

## 2026-09-27 – P1.31

- Playwright nach ARCHITEKTUR §7.3: `trace: 'retain-on-failure'`, Screenshots nur bei Fehler, `video: 'off'`, `testIgnore` für `preview-export.e2e.spec.ts`.\n- `tests/e2e/fixtures.ts`: Fremd-Host-Wächter (`context.route`, protokolliert), Admin-Anmeldung des Grund-Seed-Admins über die Local API (schont das Login-Rate-Limit), Stück-Fixtures 980–999 je Projekt eigener Block.\n- Neue E2E: `admin-product-form.e2e.spec.ts` (DM-P1-07 Pflichtangaben je Kategorie bei 375 px, fehlende Angabe → Publish 400 mit deutscher Meldung, AK-7-04 ohne horizontales Scrollen bei 390×844, T-05/R-135 GPS-Upload ohne EXIF) und `admin-privacy.e2e.spec.ts` @smoke (R-136: Login, Liste, Formulare, JSON-Feld ohne Fremd-Requests, Gegenprobe).\n- Tests: 19 E2E in desktop/iphone-15 (WebKit)/pixel-7 grün; `pnpm check`, `pnpm test:int` grün.

## 2026-09-27 – P1.30

- Mini-Satz in `content/seed/data/` (media, private-uploads, products S01/S06/S09/S11/S15/S18/S20/S25/S26/S27, orders mit Kasse und Reservierung KS2, pages home/contact) mit endgültigen seedKeys; Import `src/lib/seed/example.ts` (IG-Ausschnitte per sharp, Ersatzzeichnungen, Beispiel-PDFs), Entfernen `remove.ts`, settings.seed.\n- Station-Link optional (hallo ohne Link); `test:e2e` nutzt `db:reset --test --seed=all`; ci.yml Schritt „Seed + Build“.\n- Tests: int seed/example (DM-P1-04, AK-11-01…03, AK-SEED-06, AK-SEED-14, AK-SEED-15, AK-SEED-18), unit seed/data (zod, AK-SEED-12, AK-SEED-19 Teil); volle Int-Suite, check, check:migrations, build grün.

## 2026-09-27 – P1.29

- `content/seed/data/base.json` (settings §3.1/§3.2, 6 Kategorien, 6 Platzhalter-Rechtstexte v1) und Import `src/lib/seed/base.ts`: create-if-missing, nur leere Felder füllen, Admin aus SEED_ADMIN_* (nie in Produktion).\n- `db:reset --test` ruft danach `seed:base` auf (`--seed=none|base|all`).\n- Tests: int seed/base (DM-P1-04, AK-SEED-02, AK-SEED-13 Teil), volle Int-Suite grün.

## 2026-09-27 – P1.28

- Seed-Bibliothek `src/lib/seed/` (guard, time, tokens, schemas, loader, upsert, context, fallbackArt, remove, run) und CLI `scripts/seed/cli.ts` (payload run, Top-Level-await); Skripte seed, seed:base, seed:example, seed:remove, seed:reset.\n- Guard prüft vor dem Start von Payload über eine nur lesende Verbindung (APP_ENV, DB-Markierung, livemode-Bestellungen).\n- Tests: unit seed/time (AK-SEED-16), seed/loader; int seed/guard (AK-SEED-04, AK-11-04, AK-A-4-01, Fingerabdruck aller Tabellen), seed/side-effects (AK-SEED-05) – grün.

## 2026-09-27 – P1.27

- Zugriffsmatrix tests/int/access/matrix.ts: 27 Collections + 2 Globals mit anonymem Ergebnis für GET/POST/PATCH/DELETE, öffentlichem Where-Filter (inkl. Seed-Filter) und versteckten Feldern.\n- Test prüft jeden Eintrag über den REST-Handler (auch Einzelabruf und Massenänderung/-löschung), vergleicht die Zugriffsfunktion mit dem Matrix-Filter, scheitert bei fehlendem Eintrag und leitet die adminField-Felder aus der Konfiguration ab.\n- Tests: int access-matrix (32, T-15, DM-P1-03, R-136); pnpm check, test:int (336) grün.

## 2026-09-27 – P1.26

- Migration p1_constraints: 4 Sequenzen, CHECKs aus §9.2 (item_number 1–99999, Summen, Storno-Grund …) plus Cent-CHECK für jede *_cents-Spalte, partielle UNIQUE-Indizes (aktive Reservierung/Rechtstext, eine Rechnung je Bestellung, seed_key für 22 Tabellen), GoBD-Trigger invoices_guard; down entfernt alles.\n- Nummern PC-/WR-/AA-/DS- aus den Sequenzen (src/lib/db/sequences.ts, Hook assignSequenceNumber); die Verwaltung kann Datenschutz-Anfragen ohne Nummer anlegen.\n- DATENMODELL §8.7/§9 an die echten Spalten angepasst (reason, created_at, legal_texts).\n- Tests: int pg-objects (6, T-14/DM-P1-02, inkl. down/up), constraints (16, DM-RES-03, DM-INV-03, CHECKs, Sequenzen), angepasste Nummern-Tests; pnpm check, test:int (304), build grün.

## 2026-09-27 – P1.24

- Collections `inquiries` (Anlage nur serverseitig, Löschfrist createdAt + 6 Monate nur verkürzbar, Datenschutz-Fassung, Bilder werden mitgelöscht), `faqs`, `pages` (17 Blöcke unter src/blocks/, Entwürfe, key eindeutig, stationId je Seite eindeutig), `revenue-entries` (UNIQUE Monat+Quelle, echter Eintrag ersetzt Seed-Eintrag), `privacy-requests` (Frist +1 Monat kalendergenau Berlin, Übergänge, L-17, Audit ohne Inhalte, kein Löschen)\n- Übernahme-Regel für pages/faqs; email-log.inquiry, consent-log.inquiry, private-uploads.relatedInquiry/relatedPrivacyRequest; Migration `p1_content`\n- Tests: int content (5) und privacy-requests (3, DM-PRQ-01); check, test:int, build grün

## 2026-09-27 – P1.23

- Collections `flash` (Nummer max+1 ohne Seed, F-012, claimedAt, wiederholbar nie vergeben), `tattoo-offers` (öffentlich nur published und endsAt > jetzt mit injizierbarer Uhr, Ende standardmäßig 23:59 Berlin, keine Adresse im Ort), `tattoo-gallery` (Veröffentlichung nur mit Einwilligung, Ausnahme Seed + Vorschau außerhalb Produktion, keine Versionen, Einwilligungsfelder nur für Admin, media.restricted-Sync)\n- private-uploads.relatedGalleryItem, Medien-/Upload-Verweise registriert; Migration `p1_tattoo`\n- Tests: int tattoo (4: Flash, DM-OFF-01, DM-GAL-01, AK-1-03); check, test:int, build grün

## 2026-09-27 – P1.22

- Collection `legal-texts` (Fassungen, Status nur über `activateLegalText`, aktive/abgelöste unveränderlich, nur Entwürfe löschbar, `isPlaceholder` folgt `origin`, Version/Label automatisch, UNIQUE (type, version))\n- Renderer `src/lib/legal/render.ts` (geschlossene Token-Liste R-012, Fehler bei unbekannten/unersetzten Tokens), `getActiveLegalText`, Versandtabelle `src/lib/shop/shippingTable.ts`\n- `legalTextVersions` an Kassen und Bestellungen (dort Pflicht und unveränderlich); Migration `p1_legal`\n- Tests: int legal-texts (6: DM-LEG-01/03/04, DM-DOC-01, R-012), orders um DM-ORD-02 (legalTextVersions) erweitert; check, test:int, build grün

## 2026-09-27 – P1.19

- `src/lib/commerce/productTransitions.ts`: Tabelle `PRODUCT_TRANSITIONS` (P2–P14, Namen publish/unpublish/reserve/release/convertToPrepayment/sell/sellOffline/returnToStock/archive/archiveAfterReturn/restore), reine Prüfung `evaluateProductTransition` und Service `transitionProduct` (eine Transaktion, Nebenwirkungen firstPublishedAt/soldAt/soldChannel/archivedAt/currentOrder; P10 beendet Kasse und Reservierungen).
- Speicher-Hook: Status nur mit `context.transition` und erlaubtem Paar (sonst 403/409), Systemfelder gesperrt, Preis/Versandklasse/Kategorie bei reserved/sold gesperrt, EN-Status (machine/reviewed/missing), Audit `product_status_changed` je Wechsel (+ `product_published`, `product_offline_sold`), sofortige Revalidierung; Löschen nur nie veröffentlichter Entwürfe ohne Bestellposition, eigene Bilder mit.
- Endpunkte `/api/products/:id/{publish,unpublish,sell-offline,archive,archive-after-return,restore,return-to-stock,translate,adopt}`; Übersetzen über den Adapter (Mock "[EN] …") inkl. Alt-Texte.
- `revokeConformityDeclaration` (R-044): Erklärung widerrufen, betroffene Stücke per P3 offline + Hinweis, Mail `admin_alert` über die Outbox; Löschsperre bei verknüpften Stücken; Endpunkt `/api/conformity-declarations/:id/revoke`.
- Test-Fixtures mit Endstatus laufen im Seed-Kontext; REST-Test veröffentlicht über den Endpunkt.
- Tests: unit transitions (8, Matrix aller Statuspaare AK-5-01/DM-PROD-10); int status (10: DM-PROD-06, DM-PROD-08, AK-5-02, Endpunkte, P10, P11, P13, Übernahme, Löschen), translate (3), conformity-revoke (3, R-044); pnpm check, test:int, build grün.

## 2026-09-27 – P1.21

- Collections `invoices` (Nummer lückenlos per Zählerzeile mit Row-Lock in der Transaktion der Anlage, Serien RE/GS/BSP-RE/BSP-GS, Steuermodus je Beleg eingefroren, retainUntil nach settings.retention.invoiceYears, nach Anlage unveränderlich, ausgestellt genau einmal mit PDF und SHA-256, Löschen nur Beispielbelege), `invoice-counters` (UNIQUE Serie+Jahr) und `withdrawals` (Serverzeit bei der Widerrufsfunktion, Angaben unveränderlich, Snapshot, Frist + 14 Tage, Auto-Zuordnung über Bestellnummer + E-Mail, Übergänge laut `withdrawalTransitions.ts`, Ablehnen nie automatisch, Aufbewahrung L-08).
- `src/lib/commerce/invoiceNumber.ts`, `src/lib/db/tx.ts` (SQL in der Payload-Transaktion), `src/lib/tax/` (`getTaxModeAt`, `computeTax`); `orders.invoice`, Joins `creditNotes`/`withdrawals`, `refunds[].creditNote`, `email-log.withdrawal`. Migration `p1_invoices`.
- Tests: unit tax-mode (5, R-032/DM-INV-04 Logik); int invoice-number (5: DM-INV-01 20 parallele Vergaben ohne Lücke, DM-INV-02 Rollback verbraucht keine Nummer, Gutschrift, Unveränderlichkeit, DM-INV-04 alter Beleg bleibt Kleinunternehmer), int withdrawals (6: DM-WDR-03, Serverzeit, Zuordnung, manuelle Erfassung, Übergänge, REST 403/404); pnpm check, test:int, build grün.

## 2026-09-27 – P1.20

- Collections `checkouts` (nur Token-Hash, Snapshot fest, Zustände über `checkoutTransitions.ts`), `reservations` (active → converted/released mit Grund) und `orders` (Snapshot, Summen, Nummer, Steuermodus, Zahlart, Bausteinfassungen und Statusverlauf unveränderlich; Status nur mit Übergangs-Kennung nach `ORDER_TRANSITIONS`, je Wechsel Verlaufseintrag O1–O21, Zeitstempel, `finalStatusAt`/`retainUntil` Stufe D, Audit; Status-Token nur als Hash + verborgenes Siegel; Löschen echter Bestellungen gesperrt).
- `src/lib/commerce/`: `orderTransitions.ts`, `checkoutTransitions.ts`, `shipping.ts` (`computeShipping`: höchste Versandklasse, Abholung 0, nur_abholung nie versenden), `transitionError.ts`.
- `products.currentOrder` (nur Verwaltung), Bezüge `email-log.order`, `consent-log.checkout/order/product`, `webhook-events.relatedCheckout/relatedOrder`; Fristen der Nachweise folgen der Bestellung. Migration `p1_orders`.
- Tests: unit order-transitions (47, Matrix DM-ORD-01), checkout-transitions (DM-CHK-02), shipping (DM-ORD-05); int orders (13: DM-ORD-02, DM-CHK-01 Token in keinem Log/keiner Zeile, DM-PROD-07 currentOrder, anonymes REST 403/404, Fristen); pnpm check, test:int, build grün.

## 2026-09-27 – P1.18

- `src/lib/products/validate.ts`: `validateForPublish` (Regeltabelle DATENMODELL §6.6.6 inkl. R-043–R-048, gesammelte deutsche Meldungen mit Feldname) und `checkFoodContact` (lebensmittelecht schon beim Entwurf, AK-7-01).
- `src/lib/products/fibers.ts`: `checkFibers` (Summe genau 100 je Teil, Hauptstoff, keine Doppelten, sonstige Fasern ≤ 15 %, labelMissing ⇒ Fasern und fiberFreeText), Anhang-Nummern mit EUR-Lex-Quelle; deutsche Faserbezeichnungen korrigiert (DATENMODELL §6.6.5 nachgezogen).
- `src/lib/legal/forbidden.ts`: Lint-Listen V-13 und V-16.
- Speicher-Hook prüft bei Status available/reserved (auch draft → available, sold → available), lebensmittelecht bei jedem Entwurf; Systemschreibvorgänge nur bei publish/returnToStock.
- Tests: unit `tests/unit/products/validate.unit.spec.ts` (109, R-042–R-048), int `tests/int/products/publish-validation.int.spec.ts` (34: DM-PROD-01…04, DM-PROD-09, AK-7-01, R-042 inkl. REST); pnpm check, test:int, build grün.

## 2026-09-27 – P1.17

- `src/lib/products/itemNumber.ts`: `formatItemNumber`/`padItemNumber` (einzige Stelle), `slugify`, `buildProductSlug`, Nummernbereiche und `suggestItemNumber`.
- `GET /api/products/next-item-number` (nur Verwaltung, `src/endpoints/products/nextItemNumber.ts`): max(Nicht-Seed)+1, belegte und bei Beispieldaten 901–999 übersprungen; Vorschlag auch als Voreinstellung beim Anlegen.
- Hooks: Nummer nach erster Veröffentlichung fest (Local API ohne seed abgelehnt, Formular/REST schreibgeschützt), Meldung „Nr. 017 ist schon vergeben – nächste freie: …“, Sperre 901–999 bei Beispieldaten, Slug je Sprache (EN aus EN-Titel, Fallback DE).
- Tests: unit `tests/unit/products/item-number.unit.spec.ts` (7, R-041), int `tests/int/products/item-number.int.spec.ts` (6: DM-PROD-05, AK-7-03, R-041); pnpm check, test:int, build grün.

## 2026-09-27 – P1.16

- `src/collections/Products.ts` mit Tabs Basis/Pflichtangaben/Bilder/Verkauf/Intern, Feldern aus DATENMODELL §6.6.1 (inkl. R-043–R-048), Bedingungen je Kategorie, Zugriff §6.6.9, keine Versionen; Migration `p1_products` (inkl. Index category/status).
- Hooks (`src/collections/hooks/products.ts`): Trimmen, Kategorie-Voreinstellungen nur für leere Felder (DE und EN), Leeren fremder Angaben beim Kategoriewechsel, `hasDeviation` aus `deviationDecision`, Pflicht-Warnhinweise (Kleinteile, Glasrahmen) nicht entfernbar, Kategorie nur im Entwurf, Preis/Versandklasse gesperrt bei reserviert/verkauft, Audit Anlage/Preis, Cache.
- `src/lib/products/`: `characteristics.ts` (`buildCharacteristics`), `fibers.ts` (`formatFibers`), `categoryRules.ts`, `warnings.ts`, `itemNumber.ts` (Format); Medien-/Upload-Referenzen registriert.
- Tests: unit `tests/unit/products/characteristics.unit.spec.ts` (6, Snapshot DE/EN), int `tests/int/collections/products-fields.int.spec.ts` (12: DM-PROD-07, DM-MEDIA-05, Voreinstellungen, Kategorie-Sperre, DM-PROD-08); pnpm check, test:int, build grün.

## 2026-09-27 – P1.15

- Collection `categories`: 6 feste Schlüssel, Name aus den Labels (DE/EN), Slug je Sprache eindeutig (Index + Prüfung), Anlegen/Löschen nur mit Seed-Kontext, `key` unveränderlich, Versionen 10, Cache-Tag `categories`. Slugs stehen nicht im Code (kommen mit dem Grund-Seed P1.29).\n- Collection `conformity-declarations`: Laborbericht privat (nur Zweck `lab_report`), Erklärung als öffentliches PDF (Art `conformity_declaration`), öffentlich nur aktive ohne Labor/Notizen; Statuswechsel nur mit Übergang `revokeConformityDeclaration` (Service und Stück-Sperre in P1.19). Verwendete Dateien sind löschgesperrt; `private-uploads.relatedDeclaration` ergänzt.\n- Migration `p1_categories`.\n- Tests: int `categories.int.spec.ts` (4) und `conformity.int.spec.ts` (4, R-044 Teil), alle grün.

## 2026-09-27 – P1.25

- Global `settings` (alle Felder aus DATENMODELL §7.1 mit Standardwerten, Beispiel-IBAN, Versionen max. 50) mit Regeln in `src/lib/settings/rules.ts`: Steuermodus nur mit Begründung + „mit Steuerberatung abgestimmt“, IBAN-Prüfsumme, DE-Pflicht und EU-Sperre, Tarife je Zone, Verpackung genau 1 je Versandklasse, Umsatzwächter-Reihenfolge u. a.; Audit `settings_changed` (maskiert), `tax_mode_changed`, `retention_setting_changed`.\n- Global `site-texts` (DE/EN-Standardtexte, Navigation, Mail-Texte je Vorlage), öffentlich lesbar.\n- `src/lib/legal/constants.ts` (Bestell-Button, „Vertrag widerrufen“, „Widerruf bestätigen“, Kleinunternehmer-Satz); `getPublicSettings()` ans Global angeschlossen; `retention.invoiceYears` wirkt auf Beleg-PDFs; AV-Verträge sperren das Löschen ihrer Datei.\n- Migration `p1_globals`.\n- Tests: int `tests/int/globals/settings.int.spec.ts` (11 grün, R-032), unit `legal/constants` (4) und `settings/rules` (6).

## 2026-09-27 – P1.14

- Collections `documents` (öffentliche PDFs, nur PDF ≤ 20 MB, sha256, Rechtstext-PDFs nie löschbar) und `private-uploads` (privater Speicher, nur angemeldet, ≤ 10 MB, Typprüfung am Inhalt, Bilder gedreht/≤ 2560 px/JPEG q85 ohne Metadaten, Vorschau `thumb`).\n- Aufbewahrung je Zweck in `src/lib/retention/policy.ts` (`privateUploadRetention`): `deleteAfter` nur verkürzbar, `retainUntil` für Belege eingefroren, Löschsperre davor (außer Seed); Verweis-Register `src/lib/uploads/references.ts`; Audit `private_upload_deleted`. Bezüge (Bestellung, Anfrage, Rechnung …) verdrahten die späteren Aufgaben.\n- Migration `p1_documents`.\n- Tests: int `private-uploads.int.spec.ts` (14 grün, s3-Teil ohne MinIO übersprungen: DM-PRIV-01/-02, R-135, R-136), unit Fristen je Zweck (4 neu).

## 2026-09-27 – P1.13

- `media` laut DATENMODELL §6.2: Felder (Alt-Text DE Pflicht mit Regeln, EN optional; `showsPerson`, `restricted`, `source`, `enhance`, `derivativesVersion`, LQIP, Dominanzfarbe), öffentlich nur nicht gesperrte Bilder – auch über die Dateiroute; Migration `p1_media`.
- Bildpipeline (`src/lib/media/pipeline.ts`): nur JPEG/PNG/WebP (Inhalt geprüft), Orientierung + sRGB, alle Metadaten weg, Original WebP q90 ≤ 2560 px, Dateiname mit Inhalts-Hash; Größen `thumb`/`card` (4:5 am Fokuspunkt), `detail`, `zoom`, `og` (JPEG) – zu kleine Größen entfallen, nie hochskaliert.
- Admin: `DownscaleUpload` verkleinert große Fotos im Browser auf 2560 px (JPEG 0,85); `beforeDelete` prüft Verweise über `src/lib/media/references.ts`.
- Fixtures per `scripts/fixtures/make-exif-fixture.ts`: `gps-orientation-6.jpg` (GPS, Orientation 6, XMP, IPTC), `landscape-small.jpg`.
- Tests: int `tests/int/collections/media.int.spec.ts` (13 Fälle: DM-MEDIA-01…04, R-135, T-05, GIF/SVG, Verweise), unit `tests/unit/media/pipeline.unit.spec.ts`; Upload über die Verwaltung im Browser geprüft; `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.12

- Spike B-01 Soll erfüllt: `src/proxy.ts` schreibt `ADMIN_ROUTE/*` intern auf den Ordner `admin/` um, `/admin` und `/admin/*` → 404; `routes.admin` aus `getEnv()`, Import-Map-Pfad fest (ARCHITEKTUR Anhang B).
- GraphQL-Routen gelöscht (`/api/graphql` → 404); `GET /api/health` ohne DB (`{ status, version, appEnv }`, no-store).
- JSON-Felder in der Verwaltung ohne Monaco: Nur-Lese-Anzeige `JsonPreview` (auch für `payload-jobs`).
- `pnpm check:external --built` (Grundgerüst): Verwaltungspfad in keiner Datei unter `.next/static`/öffentlichem HTML.
- Playwright-Projekte desktop/iphone-15/pixel-7 (§7.3), E2E gegen die Test-DB; `test.fixme` in `admin.e2e.spec.ts` entfernt.
- Tests: e2e `admin-route.e2e.spec.ts` @smoke + `admin.e2e.spec.ts` (30/30 grün in 3 Projekten, `pnpm dev`; desktop auch gegen `pnpm start`), int `tests/int/api/health.int.spec.ts`, unit Proxy + check:external; `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.11

- Konto `users` laut DATENMODELL §6.1: genau ein Konto (Access + Hook, auch Local API), Passwortregel (auch beim Zurücksetzen), Sperre 5/15 min, Cookie SameSite=Strict, `lastLoginAt` + Audit `login_succeeded`.
- „Passwort vergessen“ (A17): deutsche Mail mit Link unter `ADMIN_ROUTE`, 1 h gültig; `email-log` `admin_password_reset` ohne Token, Audit `password_reset_requested`.
- Rate-Limit-Tabelle `rate_limit_hits` (Migration `p1_rate_limit`) + `src/lib/security/rateLimit.ts`: `admin_login` 10/15 min, `forgot_password` 3/h → 429 mit Retry-After; Migration `p1_users`.
- `pnpm admin:create` (interaktiv, verweigert zweites Konto) und `pnpm admin:unlock`.
- Tests: int `tests/int/collections/users.int.spec.ts` (17 Fälle: DM-USER-01…03, AK-A-8-03, R-136, A17, Unlock, Reset hebt Sperre auf); `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.10

- `src/lib/payments/` (Schnittstelle vollständig nach ARCHITEKTUR §3.5, `getPaymentsAdapter()`, Mock mit `cs_mock_`/`pi_mock_`/`re_mock_`/`evt_mock_`, HMAC-Webhook-Prüfung, in Produktion verboten; `stripe/` als Gerüst mit ConfigError ohne Schlüssel), `src/lib/translation/` (Mock "[EN] " + Text mit `usage`, DeepL-Gerüst), `src/lib/carrier/` (`manual`, `trackingUrl`, `validateTrackingNumber`).
- `docker-compose.yml`: Profil `payments` (stripe-mock); DHL-Verfolgungslink in der URL-Allowlist von `check:static`.
- Mock-Zustand bis P4.4 im Prozess-Speicher hinter `MockPaymentsStore` (OFFENE-PUNKTE).
- Tests: int payments/translation/carrier.contract (20; stripe-mock-Teil nur wenn erreichbar, lokal geprüft); `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.9

- `src/lib/email/` (Treiber file/smtp/memory/log, eine Transport-Fabrik `createMailTransport` auch für Payloads eigene Mails, Unterdrückung R-180 und Umleitung im Transport), Outbox `outbox.ts`, `tests/helpers/outbox.ts`; `@payloadcms/email-nodemailer` 3.90.2, `nodemailer` 9.1.1.
- Jobs: `src/jobs/index.ts` (alle Slugs aus A.3 mit Queue und Phase), Task `sendEmail` (P1: `admin_alert`), `jobs` in payload.config (vier Queues, autoRun nur bei JOBS_AUTORUN, access.run Admin oder Bearer), Migration `p1_jobs`; Job-Wecker `src/lib/jobs/alarm.ts`, Routen `/api/cron/tick` und `/api/cron/run/[task]` (Gerüst), `pnpm jobs:run <task> [--now=<ISO>]`.
- Spike B-09: Soll erfüllt (handleSchedules/run/runByID in 3.90.2, auch mit vorgestellter Uhr).
- Tests: int email.contract (18, SMTP gegen lokalen Fake-Server), jobs/send-email (5), jobs/tick (7, Pool-Zähler), spikes/b09-jobs (2); unit jobs/slugs (3); `pnpm check`, `pnpm test:int`, `pnpm build` grün; Routen zusätzlich per `pnpm start` geprüft (401/200/204/409).

## 2026-09-27 – P1.8

- `src/lib/storage/`: `uploadStorage(area)` (staticDir `.data/{media,documents,private}`, Datei-Handler mit dokumentabhängigen Cache-Headern), `storagePlugins()` mit zwei Instanzen `@payloadcms/storage-s3` 3.90.2 (öffentlich/privat, signierte Downloads 300 s), `systemFiles.ts`, `signed.ts`; `media` nutzt es; Migration `p1_storage` (Felder `prefix`, `_objectKey`).
- `docker-compose.yml`: Profil `s3` (MinIO + Bucket-Anlage).
- Spike B-02: Soll erfüllt (gegen RustFS als MinIO-Ersatz, siehe OFFENE-PUNKTE).
- Tests: int `tests/int/adapters/storage.contract.int.spec.ts` (11 Tests: local immer, s3 gegen lokalen S3-Dienst inkl. Ablauf 403); `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.7

- Protokoll-Collections `audit-log`, `email-log`, `consent-log`, `webhook-events`, `deletion-log` (Gruppe „System“, nur lesen; Anlegen/Ändern/Löschen nur über Server-Code; unveränderliche Felder per Hook gesperrt); Migration `p1_logs`.\n- `src/lib/retention/policy.ts` mit allen Fristen als L-Konstanten und `retainUntil()` (Berliner Kalender, Jahresende-Regel); `writeAudit()` maskiert E-Mail, IBAN, Namen und Adressen; `getStatusHistory()`; `writeDeletionLog()` in der Transaktion des Aufrufers.\n- Tests: unit policy (47, Fristen aus LOESCHKONZEPT geparst), int logs (43: anonymes REST verboten, Local API ohne overrideAccess verboten, Maskierung, ruleId-Muster, Fristen, Rollback); pnpm check, test:int, build grün.

## 2026-09-27 – P1.6

- Zugriffsschicht `src/access` (isAdmin, none, publicRead mit Seed-Filter, adminField), Kontext-Flags `AppContext`/`withSystem`, `getPublicPayload()`/`getPublicSettings()` mit Whitelist, Cache-Tags und Revalidierung (nichts bei `context.seed`).\n- Feldbausteine `src/fields/` (seedField, privacyFields, addressFields, internalLinkFields, moneyField mit Admin-Komponente EuroInput, sortOrderField).\n- Payload: Sprachen de/en mit Rückfall, Verwaltung nur Deutsch (`@payloadcms/translations` 3.90.2), GraphQL aus, Avatar ohne Gravatar; Migration `p1_localization` (Enum `_locales`).\n- Tests: unit access (8), money-field mit jsdom (5), seed-field (4); pnpm check, test:int, build grün.

## 2026-09-27 – P1.5

- `scripts/db-ensure.ts` (`db:ensure`), `scripts/db-reset.ts` (`db:reset --test`, nur `*_test`, nicht bei `APP_ENV=production` oder markierter DB), `src/lib/db/guard.ts` (`isProductionDatabase`, gemeinsame Sperrregel).
- `payload.config.ts`: Pool `max = DB_POOL_MAX`, Push nur mit `PAYLOAD_DB_PUSH` in `development`, `migrationDir`; erste Migration `p1_baseline`.
- `scripts/check-migration-drift.ts` (`check:migrations`); `ci.yml` Schritt 6 (migrate + Drift). Gegenprobe: ein Feld ohne Migration lässt die Prüfung scheitern.
- Int-Setup (`tests/int/setup/global.ts`, `env.ts` → immer `DATABASE_URL_TEST`), Helfer `getTestPayload()`/`withClock()`; Netzwerk-Wächter `tests/setup/network-guard.ts` (Socket, `http(s).request`, `fetch`) in Unit und Int.
- Spike `server-only` in Skripten → ADR `docs/adr/0001-server-only-in-scripts.md` (Import-Hook).
- Tests: int `tests/int/db/reset-guard.int.spec.ts`, `tests/int/db/migrate.int.spec.ts` (DM-P1-01), unit `tests/unit/setup/network-guard.unit.spec.ts`; `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.4

- `src/lib/time.ts` (Uhr, Berliner Tag/Monat/Jahr, Zeitumstellung korrekt, `formatBerlin`) mit `date-fns`/`@date-fns/tz` (exakt gepinnt); `src/lib/money.ts` (`formatMoney` full/tag, `parseEuroInput`, `assertCents`, ohne Fließkomma-Rechnung).
- `src/lib/monitoring/logger.ts` (JSON-Zeilen, `LOG_LEVEL`) mit `src/lib/security/redact.ts` (Schlüsselliste §8.11, E-Mail, IBAN, 43-Zeichen-Token, Telefonnummern).
- `src/lib/enums.ts` wörtlich aus DATENMODELL §4 (inkl. 64 Fasern), `src/lib/enumLabels.ts` (DE für alle, EN für öffentliche Enums).
- `src/lib/security/keys.ts` (HKDF, feste Bezeichner), `ipHash.ts` (täglich wechselnd), `tokens.ts` (Zufalls-Token, Hash, konstanter Vergleich).
- Tests: `tests/unit/lib/{time,money,logger,enums,keys}.unit.spec.ts`; `pnpm check` grün.

## 2026-09-27 – P1.3

- `src/lib/env.schema.ts` (Registry aller Variablen aus ARCHITEKTUR §5.2 mit Beschreibung, Beispiel, Geheimnis-Kennung, „Seit“) und `src/lib/env.ts` (`getEnv()` gecacht, `collectEnvViolations`/`assertProductionEnv` sammeln alle Verstöße, `seedPreviewModeActive`); `src/instrumentation.ts` prüft beim Start (Produktion ohne `APP_ENV` bricht ab).
- `pnpm env:example` erzeugt `.env.example`; `pnpm check:static` mit Teilprüfungen `versions`, `env-example`, `import-rules`, `stripe-import`, `external-urls`; `pnpm check` enthält sie; `ci.yml` Schritt 4.
- ESLint: `process.env` nur in `src/lib/env.ts`/`instrumentation.ts`; `getPayload` nicht in öffentlichen Seiten. `payload.config.ts` nutzt `getEnv()`.
- Import-Hook `scripts/lib/register-server-only.mjs` macht `server-only` in CLI-Skripten (payload, tsx) ladbar.
- Tests: `tests/unit/env/assert-production.unit.spec.ts` (T-17, AK-A-3-02, AK-1-02, AK-SEED-16), `tests/unit/env/env-example.unit.spec.ts` (AK-A-5-01), Lint-Regeltest (AK-A-5-02); `pnpm check`, `pnpm test:int`, `pnpm build` grün, `pnpm dev` startet.

## 2026-09-27 – P1.2

- Prüfstellen abgeglichen (Liste im PR-Text). Korrigiert: DATENMODELL §6.12 (Begriffe laut R-012/R-002), SEED-SPEC §1.4, §1.8, §2.1.
- OFFENE-PUNKTE §4: fehlende IDs C-28 und SE-14 ergänzt; alle W-, C-, DM-, DA-, KA-, SE-IDs vorhanden. ENTSCHEIDUNGEN unverändert.
- Tests: `tests/unit/docs/resolutions.unit.spec.ts` (W-IDs in OFFENE-PUNKTE); `pnpm test:unit` grün.

## 2026-09-27 – P1.1b

- `scripts/check-versions.ts` (`pnpm check:versions`): `@payloadcms/*` = `payload`, `eslint-config-next` = `next`, `react` = `react-dom`, kein `^`/`~` bei Laufzeit-Abhängigkeiten; ab 30.09.2026 Warnung bei `next` < 16.3.7.
- Next.js-Patch: 16.3.7 ist noch nicht erschienen, 16.3.6 ist der neueste 16.3.x-Patch → bleibt; Zeile in OFFENE-PUNKTE.
- Tests: `tests/unit/tooling/check-versions.unit.spec.ts` (AK-A-1-01/-02); `pnpm check` grün.

## 2026-09-27 – P1.1a

- `ci.yml` nach ARCHITEKTUR §6.3: Job `quick`, nur `pull_request`/`workflow_dispatch` (kein `push`), Wegwerf-DB `planetclaire_test`, `TZ=UTC`, `DB_POOL_MAX`, `SEED_*`, `NEXT_PUBLIC_LEASH_DEBUG`, `E2E_SERVER`; Schritt „Kennung“ überspringt bei `[ci:update-snapshots]`/`[ci:art]`.
- Test-Helfer (`tests/helpers/adminEnv.ts`, `login.ts`, `seedUser.ts`) nutzen `ADMIN_ROUTE` und `SEED_ADMIN_*`; `admin.e2e.spec.ts` bis P1.12 als `fixme`.
- Tests: YAML lokal geparst (Auslöser, Job `quick`); `pnpm check` grün.

## 2026-09-27 – P1.1

- tsconfig: `noUncheckedIndexedAccess`, `noImplicitOverride`; `.npmrc` `save-exact=true`; `cross-env`, `graphql`, `eslint`, `prettier` exakt gepinnt.
- ESLint nach ARCHITEKTUR §15: `no-explicit-any` als Fehler, `no-console` in `src/` (außer Logger), Uhr-Verbot (`new Date()`, `Date.now()`) in commerce/jobs/legal, `toFixed` in commerce, framework-freie `behaviors`/`leash`/`preview-runtime`. `pnpm lint` prüft zusätzlich das Format (`.prettierignore` für Doku und generierte Dateien).
- Vitest: Int-Tests nacheinander (`fileParallelism: false`), `server-only` → Stub in beiden Konfigurationen.
- P0-Prüfpunkte bestätigt (`.gitattributes` lf/binary, `.gitignore`, `next.config.ts`, Build-Speicher).
- Tests: `tests/unit/lint/rules.unit.spec.ts` (AK-A-15-01); `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P0 abgeschlossen (P0.8 GitHub)

- Plan zu einer Datei `PLAN.md` zusammengeführt (P0 erledigt, P1–P10: 329 offene Aufgaben, P11 mit Jutta);
  `bash scripts/cloud-setup.sh --plan-status` → erste offene Aufgabe P1.1.
- GitHub-Beschriftungen am 27.09.2026 nachgeprüft und in CLOUD-SETUP, ANLEITUNGEN, AUFGABEN, ARCHITEKTUR,
  OFFENE-PUNKTE korrigiert (Squash-Einstellung „Default to pull request title and description“, CLOUD-SETUP F-31).
- Privates Repository `planetclairetattoos` angelegt, `main` gepusht; erster CI-Lauf (Lint, Typen, Unit,
  Integrationstest gegen Postgres 17, Build) grün – von Jutta im Reiter „Actions“ bestätigt.
- `pnpm check` und `pnpm build` lokal grün.
- Nächster Schritt: Jutta richtet die Cloud ein (`docs/CLOUD-SETUP.md` §1–§2) und startet die erste Cloud-Session;
  sie beginnt mit P1.1.

## 2026-09-26 – P0 Fundament (lokal)

- Interview mit Jutta (13 Fragerunden) und Recherche (Recht, Produkt-Compliance, Technik, Zahlung/Versand, Design,
  Tattoo, Cloud-Arbeitsweise) mit Faktencheck; Ergebnisse in `docs/research/`.
- Konzept freigegeben („Freigabe, Instagram-Bilder darfst du herunterladen“); Entscheidungen in `docs/ENTSCHEIDUNGEN.md`.
- 22 Instagram-Bilder (öffentlich sichtbar, mit Erlaubnis) in `content/seed/instagram/` + `manifest.json`.
- Fachdokumente: KONZEPT, DATENMODELL, ARCHITEKTUR, DESIGN + KUNST-QA, Recht (Anforderungen, Kanzlei-Briefing,
  Dienste, Löschkonzept), Aufgaben & Anleitungen für Jutta, Cloud-Setup, Beispielbestand-Spezifikation, PLAN.md.
- App-Gerüst: Next.js 16.3.6 + Payload 3.90.2 (Postgres), pnpm 10.34.5; Lint, Typprüfung, Unit-Test und Build
  lokal grün; CI-Workflow (inkl. Integrationstest gegen Postgres) angelegt.
- Nächster Schritt: Session in die Cloud verschieben, dort P1 starten (siehe `docs/CLOUD-SETUP.md`).
