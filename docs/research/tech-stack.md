# Recherche: Tech-Stack und Hosting

> Stand 26.09.2026. Automatisch erzeugt aus dem Recherche-Workflow (Websuche mit Quellen). Konfidenz je Befund: high/medium/low. Wo ein Faktencheck vorliegt, steht er am Ende und hat Vorrang. Entscheidungen der Inhaberin stehen in docs/ENTSCHEIDUNGEN.md und haben immer Vorrang vor Empfehlungen hier.

## Zusammenfassung

Empfehlung (Stand 26.09.2026): eine einzige TypeScript-Anwendung aus Next.js 16.3.x und Payload CMS 3.90.x. Payload ist MIT-lizenziert und wird selbst gehostet. Hosting auf Vercel Pro mit Funktionsregion fra1 (Frankfurt), Datenbank Neon Postgres in aws-eu-central-1 (Frankfurt), Medien in Cloudflare R2 mit EU-Jurisdiktion, Zahlungen über Stripe. Für den Checkout nutzen wir Stripe Checkout Sessions mit ui_mode 'elements'. Dann steht der Bestell-Button auf der eigenen Seite, und die Sitzung läuft nach 30 Minuten ab (expires_at). Den Shop-Kern bauen wir als eigene, schlanke Commerce-Collections. Das offizielle Payload-Ecommerce-Plugin ist noch Beta und hat keine Reservierungslogik. Unikate werden atomar per SQL reserviert, damit nichts doppelt verkauft wird.

Laufende Fixkosten: etwa 18–30 € pro Monat, dazu die Stripe-Gebühren. Der Code bleibt portabel: ein Dockerfile ist ab Tag 1 Pflicht, damit ein Umzug auf Hetzner jederzeit möglich ist.

Fallback, falls ihr eine native Handy-App und null Verantwortung für die Shop-Technik wollt: Shopify Basic mit eigenem Frontend (headless, Hydrogen auf Oxygen). Das kostet 27–36 € pro Monat plus 2,1 % + 0,30 € je Kartenzahlung.

Nicht empfohlen:
- Medusa v2.21: stark im Commerce, aber für einen Ein-Frau-Shop zu schwer. Es braucht Server, Worker, Redis und ein zusätzliches CMS, und die Admin-Oberfläche ist nicht fürs Handy optimiert.
- Vendure, Saleor, Shopware 6: zu schwer bzw. PHP-lastig.
- Astro oder SvelteKit mit Sanity oder Directus: zwei Systeme, und Bestellwesen und Reservierung müssten wir komplett selbst bauen.
- Hetzner mit Coolify als Primärlösung: 2026 gab es zahlreiche kritische CVEs in Coolify, und die Server-Pflege landet bei einer nicht-technischen Eigentümerin.

Wichtige Stolperfallen für die Cloud-Agenten:
- Der Vercel-Hobby-Plan ist nicht kommerziell nutzbar, und die Standardregion ist iad1 (USA). Außerdem gibt es ein Upload-Limit von 4,5 MB pro Anfrage.
- Next.js hat am 30.09.2026 ein Sicherheitsrelease (16.3.7).
- Die Claude-Cloud-Umgebung hat standardmäßig Node 22. Die Vorlage verlangt Node ≥24.15, und das Playwright-CDN sowie die Stripe-API stehen nicht auf der Trusted-Allowlist.
- Umgebungsvariablen in der Cloud-Umgebung sind nicht geheim.
- Die DNS-Zone bei IONOS hat noch AAAA-Einträge der Parkseite. Die müssen entfernt werden. MX, SPF und DKIM von IONOS bleiben unverändert.

## Befunde

### Payload CMS 3: aktueller Stand, Figma-Übernahme, Payload 4 `[high]`

Die aktuelle stabile Version ist payload 3.90.2 vom 23.09.2026, geprüft per npm und auf GitHub. @payloadcms/next 3.90.2 verlangt als Peer-Abhängigkeit next >=16.3.3 <17.0.0. Next 15.5 ist ausgeschlossen. Payload 4 gibt es nur als Canary-Version (4.0.0-canary.37 vom 24.09.2026), mit Breaking Changes, z. B. overrideAccess ist in der Local API standardmäßig false. Laut einem Beitrag vom 30.08.2026 gibt es noch keine Beta und nichts Produktionsreifes. Figma hat Payload im Juni 2025 übernommen. MIT-Lizenz und Selbst-Hosting bleiben. Payload Cloud nimmt keine neuen Projekte an, Selbst-Hosting ist also der Normalfall. Die Weiterentwicklung unter Figma ist langfristig ein Risiko für die Roadmap, aber keine Lizenzfalle.

**Auswirkung:** Auf v3 festpinnen. Die Migration auf v4 erst als späteren Task nach dem stabilen Release einplanen. Keine Abhängigkeit von Payload Cloud.

Quellen:
- https://github.com/payloadcms/payload/releases
- https://www.npmjs.com/package/payload
- https://www.figma.com/blog/payload-joins-figma/
- https://www.buildwithmatija.com/blog/payload-4-0
- https://www.luckymedia.dev/insights/payload-cms

### Offizielles Payload-Ecommerce-Plugin und Vorlage `[high]`

@payloadcms/plugin-ecommerce ist laut Doku Beta: 'may have breaking changes'. Es bringt Produkte mit Varianten, Warenkörbe (auch für Gäste), Bestellungen, Transaktionen, Adressen, einen Stripe-Adapter mit Webhooks und mehrere Währungen mit. Ein Bestandsfeld wird beim Checkout geprüft und nach der Bestellung heruntergezählt. Es gibt aber keine Reservierung während des Checkouts. Versand, Steuern und Abos sind laut Doku nicht nativ enthalten. Die offizielle Ecommerce-Vorlage ist ebenfalls Beta und hat in ihrer package.json standardmäßig @payloadcms/db-mongodb eingetragen.

**Auswirkung:** Für Unikate mit Doppelverkaufsrisiko reicht das Plugin nicht. Empfehlung: eigene schlanke Collections bauen und nur die Muster aus der Vorlage übernehmen.

Quellen:
- https://payloadcms.com/docs/ecommerce/overview
- https://payloadcms.com/docs/ecommerce/plugin
- https://github.com/payloadcms/payload/tree/main/templates/ecommerce
- https://raw.githubusercontent.com/payloadcms/payload/main/templates/ecommerce/package.json

### Konkrete Toolchain-Versionen (npm, 26.09.2026) `[high]`

Die Payload-Ecommerce-Vorlage auf dem main-Branch nutzt: next 16.3.3, react 19.2.6, sharp 0.35.4, TypeScript 6.0.3, Vitest 5.0.1, @playwright/test 1.63.0, Tailwind 4.1.x, pnpm 11.9.0 und engines node >=24.15.0. Auf npm sind aktuell: next 16.3.6, react 19.3.0, TypeScript 7.0.2 (die neue Go-Version, von der Vorlage noch nicht genutzt), vitest 5.0.2, stripe 22.6.2, @stripe/stripe-js 9.17.0, next-intl 4.14.7, @react-pdf/renderer 4.9.0, gsap 3.15.0, motion 13.4.4, three 0.186.1, @sentry/nextjs 11.0.0. Node 24 ist Active LTS bis zum 20.10.2026 und wird bis 30.04.2028 unterstützt. Node 22 läuft am 30.04.2027 aus.

**Auswirkung:** Versionen exakt pinnen. Node 24 LTS verwenden, dafür Setup-Skript in der Cloud-Umgebung. TypeScript 6.0.x statt 7.x verwenden, bis Payload und Next offiziell TS 7 nutzen.

Quellen:
- https://raw.githubusercontent.com/payloadcms/payload/main/templates/ecommerce/package.json
- https://www.npmjs.com/package/next
- https://endoflife.date/nodejs
- https://nodejs.org/en/about/eol

### Next.js-Sicherheitsupdates September 2026 `[high]`

Am 22.09.2026 kamen out-of-band 16.3.6 und 15.5.26 wegen eines kritischen Upstream-Problems (GHSA-vcvr-r3jv-pc5j). Für den 30.09.2026 ist ein weiteres Release angekündigt, 16.3.7 und 15.5.27, das neun Schwachstellen behebt, darunter eine kritische.

**Auswirkung:** Mindestversion next 16.3.7. Renovate oder Dependabot für Sicherheitsupdates ist Pflicht.

Quellen:
- https://nextjs.org/blog/upcoming-nextjs-security-release-september-22-2026
- https://releasebot.io/updates/vercel/next-js

### Vercel: Plan, Region, Limits, Datenschutz `[high]`

Der Hobby-Plan ist nur für 'non-commercial personal use'. Jede Zahlungsabwicklung zählt als kommerziell, also ist Pro nötig: 20 USD pro Monat und Sitz, inklusive 20 USD Nutzungsguthaben. Neue Projekte laufen standardmäßig in iad1 (Washington), die Region muss also ausdrücklich auf fra1 gestellt werden. Request- und Response-Body von Funktionen sind auf 4,5 MB begrenzt, sonst gibt es 413. Payload-Storage-Adapter umgehen das mit clientUploads über signierte URLs. Payload-Jobs mit autoRun laufen nicht serverless; nötig ist ein Vercel Cron auf /api/payload-jobs/run mit CRON_SECRET. Pro erlaubt Cron-Jobs im Minutentakt mit Minuten-Präzision, Hobby nur einmal täglich. Vercel ist unter dem EU-US Data Privacy Framework zertifiziert. Der DPA gilt laut Sekundärquelle nur für Pro und Enterprise. Control Plane und Account-Daten liegen in den USA.

**Auswirkung:** Primäre Hosting-Wahl, aber nur mit Pro, fra1 und Workarounds für Upload und Cron. In der Datenschutzerklärung als Auftragsverarbeiter mit Drittlandtransfer aufführen.

Quellen:
- https://vercel.com/docs/limits/fair-use-guidelines
- https://vercel.com/pricing
- https://vercel.com/docs/functions/configuring-functions/region
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://payloadcms.com/docs/jobs-queue/queues
- https://vercel.com/changelog/vercel-is-now-certified-under-the-eu-us-data-privacy-framework-dpf
- https://complydog.com/blog/is-vercel-gdpr-compliant-the-dpa-and-your-deployment

### Neon Postgres `[high]`

Free-Plan: 0,5 GB pro Projekt und 100 CU-Stunden pro Monat. Scale-to-zero nach 5 Minuten, nicht abschaltbar. Point-in-Time-Restore nur 6 Stunden und maximal 1 GB Änderungen. Launch-Plan: 0,106 USD pro CU-Stunde und 0,35 USD pro GB-Monat, ohne Mindestumsatz. Wiederherstellungshistorie bis 7 Tage für 0,20 USD pro GB-Monat. Zusätzliche Branches kosten auf Bezahlplänen 1,50 USD pro Branch-Monat. EU-Regionen: aws-eu-central-1 (Frankfurt) und aws-eu-west-2 (London). Azure-Regionen sind abgekündigt, neue Projekte dort nicht mehr möglich. Neon gehört seit Mai 2025 zu Databricks (USA).

**Auswirkung:** Für ein kleines Shop-Datenvolumen reicht Free anfangs. Wegen der kurzen PITR-Zeit ist ein eigenes nächtliches pg_dump-Backup Pflicht. Kaltstart nach Leerlauf von einigen hundert Millisekunden ist akzeptabel.

Quellen:
- https://neon.com/docs/introduction/plans
- https://neon.com/docs/introduction/regions
- https://techcrunch.com/2025/05/14/databricks-to-buy-open-source-database-startup-neon-for-1b/

### Cloudflare R2 als Medienspeicher `[high]`

Speicher kostet 0,015 USD pro GB-Monat. Free-Tier: 10 GB, 1 Mio. Class-A- und 10 Mio. Class-B-Operationen. Egress ist kostenlos. Mit EU-Jurisdiktion bleiben Objekte garantiert in der EU; Endpoint ist https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com. Die Jurisdiktion ist nachträglich nicht änderbar. Eine eigene Domain für einen öffentlichen Bucket geht nur, wenn die Domain als Cloudflare-Zone im selben Account liegt. r2.dev-URLs sind rate-limitiert und laut Doku nur für Entwicklung gedacht. Payload bindet R2 über @payloadcms/storage-s3 an (region 'auto').

**Auswirkung:** Solange das DNS bei IONOS bleibt, keine Medien-Subdomain auf R2. Medien dann über die Payload-Dateiroute mit langem Cache-Control über das Vercel-CDN ausliefern, oder die Nameserver zu Cloudflare umziehen. Siehe offene Fragen.

Quellen:
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/reference/data-location/
- https://developers.cloudflare.com/r2/buckets/public-buckets/
- https://payloadcms.com/docs/upload/storage-adapters

### Selbst-Hosting: Hetzner und Coolify `[high]`

Hetzner-Preise ab 15.06.2026, Deutschland, netto: CX23 5,49 €, CX33 8,49 €, CAX11 5,99 €, CAX21 10,49 €. Dedizierte vCPU-Pläne kosten mehr als das Doppelte, z. B. CPX22 19,49 €. Object Storage laut Sekundärquelle 6,49 € pro Monat Basis mit etwa 1 TB. Coolify v4.0.0 ist seit 27.04.2026 stabil. Allein im Januar 2026 wurden 11 kritische Schwachstellen veröffentlicht, fünf davon mit CVSS 10, also Root-RCE. Weitere folgten bis ins Frühjahr, Update auf ≥4.2.0 ist dringend.

**Auswirkung:** EU-souveräne, günstigere Variante (etwa 11–18 € pro Monat), aber mit Betriebsaufwand: Betriebssystem-Updates, Coolify-Updates, Monitoring. Cloud-Agenten kommen ohne SSH nicht an den Server. Daher nur als Exit- oder Alternativ-Topologie empfohlen.

Quellen:
- https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
- https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans/
- https://thehackernews.com/2026/01/coolify-discloses-11-critical-flaws.html
- https://wz-it.com/en/blog/coolify-cve-security-vulnerabilities-update-2025-2026/
- https://temps.sh/blog/coolify-review-2026

### Weitere PaaS-Optionen (Railway, Render, Fly.io) `[medium]`

Railway: Hobby 5 USD pro Monat inklusive 5 USD Guthaben, Pro 20 USD. Etwa 20 USD pro vCPU und 10 USD pro GB RAM im Monat. EU-Region 'EU West Metal' in Amsterdam, PR-Umgebungen vorhanden. Laut Sekundärquelle gab es 2025/26 wiederholt Ausfälle, u. a. einen Build-Stopp in EU West im Dezember 2025. Render: Starter-Webservice 7 USD, Postgres ab etwa 6 USD, Region Frankfurt (Sekundärquellen). Fly.io habe ich nicht im Detail geprüft.

**Auswirkung:** Sinnvolle Alternative mit dauerhaft laufendem Node-Server: kein 4,5-MB-Limit, autoRun-Jobs möglich. Aber auch US-Firmen und etwas mehr Setup für Preview-Umgebungen. Nicht primär empfohlen.

Quellen:
- https://railway.com/pricing
- https://docs.railway.com/deployments/regions
- https://northflank.com/blog/should-you-use-railway-for-enterprise-deployments
- https://encore.dev/articles/render-vs-railway

### Medusa v2 (Option b) `[medium]`

Aktuell @medusajs/medusa 2.21.1 vom 22.09.2026; mit v2.19 kamen u. a. der Export von Lagerartikeln und eigene Fulfillment-Adressen. Medusa bringt ein echtes Inventory-Modul mit Reservierungen je Standort, legt die Reservierung aber erst bei der Bestellung an. Es gibt einen offenen Bug zur Überverkaufs-Prüfung bei gebündelten Artikeln. Für die Produktion braucht Medusa Postgres, Redis, S3 sowie getrennte Server- und Worker-Prozesse; empfohlen sind mindestens 2 GB RAM. Medusa Cloud kostet ab 29 USD pro Monat (Develop), Launch ab 99 USD. Die Admin-Oberfläche lässt sich anpassen, Mobil-Tauglichkeit ist aber ein bekannter Community-Wunsch und nicht ausgereift. Für Tattoo-Portfolio und redaktionelle Seiten wäre ein zweites CMS nötig.

**Auswirkung:** Fachlich starker Commerce-Kern, aber zwei bis drei Deployables, höhere Kosten und mehr Wartung, und für die Pflege am Handy ungeeignet. Für diesen Shop nicht empfohlen.

Quellen:
- https://www.npmjs.com/package/@medusajs/medusa
- https://medusajs.com/blog/newsletter-aug-26
- https://medusajs.com/pricing/
- https://docs.medusajs.com/learn/deployment/general
- https://docs.medusajs.com/resources/commerce-modules/inventory/inventory-in-flows
- https://github.com/medusajs/medusa/issues/16502
- https://github.com/medusajs/medusa/discussions/1092

### Shopify (Option c) `[medium]`

Preise Deutschland laut shopify.com/de/preise: Basic 36 € monatlich bzw. 27 € bei jährlicher Zahlung, Grow 105/79 €. Shopify Payments für Standard-Karten im EWR bei Basic: 2,1 % + 0,30 €. Bei externen Zahlungsanbietern kommen zusätzlich 2 % Transaktionsgebühr hinzu (Basic). Der Basic-Plan erlaubt einen Headless-Storefront. Oxygen-Hosting für Hydrogen ist laut Sekundärquellen in bezahlten Plänen enthalten, nicht im Starter-Plan. Die native Shopify-App kann Produktfotos direkt mit der Kamera aufnehmen. Shopify Flow ist ab Basic verfügbar. @shopify/hydrogen ist aktuell 2026.4.5. Offen bleiben: automatische Artikelnummern (per App oder Flow), deutsche Rechnungen (per App), DHL-Labels (per App).

**Auswirkung:** Bester Fallback, wenn eine native App und null Verantwortung für Checkout und Sicherheit wichtiger sind als Kosten, Kontrolle und Vermeidung von Anbieterbindung. Das Tattoo-Anfrageformular mit Bild-Upload bräuchte trotzdem ein eigenes Backend.

Quellen:
- https://www.shopify.com/de/preise
- https://shopify.dev/docs/storefronts/headless/hydrogen/fundamentals
- https://mgroupweb.com/blogs/shopify-oxygen-deployment/
- https://help.shopify.com/en/manual/products/product-media/add-media
- https://changelog.shopify.com/posts/shopify-flow-now-available-to-basic-plan

### Astro oder SvelteKit mit Sanity oder Directus und Stripe (Option d) `[medium]`

Astro ist aktuell 7.3.5; das Unternehmen hinter Astro gehört seit 16.01.2026 zu Cloudflare, bleibt aber MIT und plattformunabhängig. SvelteKit ist aktuell 2.70.3. Sanity Free: 20 Sitze und 10.000 Dokumente, aber kein zeitgesteuertes Veröffentlichen. Growth kostet 15 USD pro Sitz; Inhalte liegen laut Sanity-Antworten in der EU (Belgien). Directus steht seit v12 unter der MSCL-Lizenz und ist unter 5 Mio. USD Umsatz kostenlos, als eigener Docker-Dienst. Bestellwesen, Reservierung und Fulfillment-Dashboard müssten komplett neu gebaut werden, oder Sanity als Datenbank für Transaktionen herhalten, was sie nicht ist.

**Auswirkung:** Mehr Schnittstellen und zwei Systeme. Kein Vorteil gegenüber Payload, das CMS, Auth, Admin und Postgres-Transaktionen in einer App vereint. Nicht empfohlen.

Quellen:
- https://astro.build/blog/joining-cloudflare/
- https://www.sanity.io/pricing
- https://robotostudio.com/blog/sanity-cms-pricing-which-plan-is-right-for-you
- https://directus.com/resources/directus-v12-license-change
- https://www.npmjs.com/package/astro

### Vendure, Saleor, Shopware 6 (Optionen e und f) `[medium]`

Vendure 3.7.3: seit v3 GPLv3 (kommerzielle Lizenz nur auf Anfrage), NestJS und GraphQL, Server und Worker, neues React-Dashboard. Saleor: BSD-3, Python/Django und GraphQL, Saleor Cloud ab etwa 159–300 USD. Shopware 6 Community Edition: MIT, seit 2025 mit einer Fair-Usage-Grenze von 1 Mio. € GMV; PHP 8.2+, MySQL/MariaDB, Message-Queue als CLI-Prozess, empfohlen VPS mit mindestens 4 GB RAM. Ein unkonventionelles Frontend ginge nur headless mit erheblichem Aufwand.

**Auswirkung:** Alle drei sind überdimensioniert oder wartungsintensiv für einen Ein-Personen-Shop mit Unikaten. Nicht empfohlen.

Quellen:
- https://vendure.io/licensing
- https://www.npmjs.com/package/@vendure/core
- https://saleor.io/pricing
- https://docs.saleor.io/setup/overview
- https://qualimero.com/en/blog/shopware-6
- https://tobias-schaefer.com/blog/shopware-hosting/

### Stripe: Gebühren und Zahlarten für deutsche Händler `[high]`

Laut stripe.com/de/pricing: Standard-Karten im EWR 1,5 % + 0,25 €, Premium-Karten 2,8 % + 0,25 €, UK-Karten 2,5 % + 0,25 €, Karten von außerhalb des EWR 3,15 % + 0,25 € (jeweils +2 % bei Währungsumrechnung). SEPA-Lastschrift 0,35 €, Klarna ab 2,99 % + 0,35 €, Stripe Invoicing 0,4 % pro bezahlter Rechnung (maximal 2 €), Stripe Tax 0,5 %. PayPal ist für Stripe-Konten in Deutschland nativ verfügbar, auch in Checkout; dazu kommen PayPal-eigene Gebühren, die exakte Stripe-Gebühr für PayPal habe ich nicht verifiziert. Wero ist über Stripe für deutsche Kundinnen und Kunden als Vorschau verfügbar. Apple Pay und Google Pay laufen über die dynamischen Zahlarten.

**Auswirkung:** Stripe ist bei Karten günstiger als Shopify Payments Basic (bei 60 € Warenkorb etwa 1,15 € statt 1,56 €). Zahlarten lassen sich im Dashboard ohne Code aktivieren.

Quellen:
- https://stripe.com/de/pricing
- https://docs.stripe.com/payments/paypal
- https://stripe.com/payment-method/wero

### Stripe: Mechanik gegen Doppelverkäufe `[high]`

Bei Checkout Sessions muss expires_at zwischen 30 Minuten und 24 Stunden nach der Erstellung liegen, Standard sind 24 Stunden. Beim Ablauf feuert checkout.session.expired; Stripe empfiehlt, darüber reservierte Ware wieder freizugeben. Das Fulfillment muss per Webhook laufen und idempotent sein. Zahlarten mit verzögerter Bestätigung wie SEPA-Lastschrift liefern später checkout.session.async_payment_succeeded oder async_payment_failed. Mögliche ui_mode-Werte: hosted_page (Standard), embedded_page, form, elements. Bei 'elements' rendert man den Bezahl-Button selbst; submit_type ist dort nicht erlaubt, das Label legen wir also selbst fest.

**Auswirkung:** Unikat bei Checkout-Start atomar reservieren, Session mit expires_at = jetzt + 30 min anlegen, per Webhook verkaufen oder freigeben. Zahlarten mit Verzögerung für Unikate ausschließen, weil sie das Stück tagelang blockieren. Mit 'elements' ist ein eigener Button 'Zahlungspflichtig bestellen' möglich; die rechtliche Prüfung liegt in der Rechts-Dimension.

Quellen:
- https://docs.stripe.com/payments/checkout/managing-limited-inventory
- https://docs.stripe.com/checkout/fulfillment
- https://docs.stripe.com/api/checkout/sessions/create

### Handy-Fotos: HEIC, EXIF und Payload-Uploads `[medium]`

Payload-Uploads können imageSizes, formatOptions (webp/avif über sharp), resizeOptions, Fokuspunkt und Zuschnitt. Bulk-Upload aus der Listenansicht ist standardmäßig aktiv. Standard-Limit sind 20 MiB pro Datei und 50 MiB pro Request. Die fertigen sharp-Binaries unterstützen kein HEIC. iOS wandelt HEIC beim Upload über ein file input automatisch in JPEG um, solange image/heic nicht im accept-Attribut steht; ab Safari 17 gibt es dabei Sonderfälle. Handyfotos enthalten GPS-EXIF-Daten, also den Standort von Atelier oder Wohnung. Auf Vercel greift zusätzlich das 4,5-MB-Limit.

**Auswirkung:** accept auf image/jpeg, image/png und image/webp beschränken. Bilder im Browser vor dem Upload auf etwa 2560 px verkleinern. Das Original mit sharp neu kodieren, damit die Metadaten entfernt werden. Mit einem E2E-Test die EXIF-Entfernung und die Orientierung prüfen. Ob Payload bei clientUploads trotzdem Bildgrößen erzeugt, ist nicht verifiziert und muss in einem Spike geklärt werden.

Quellen:
- https://payloadcms.com/docs/upload/overview
- https://github.com/lovell/sharp/issues/3680
- https://developer.apple.com/forums/thread/743049
- https://github.com/payloadcms/payload/issues/16484
- https://github.com/lovell/sharp/issues/4059

### Claude-Code-Cloud-Umgebung (Entwicklung ab P1) `[high]`

Vorinstalliert sind Node 20, 21 und 22 (22 im PATH), npm, yarn, pnpm, bun und chromedriver, außerdem Docker mit docker compose sowie PostgreSQL 16 und Redis 7.0. Die Datenbanken laufen nicht von selbst und müssen per service ... start gestartet werden. Die Standard-Netzstufe Trusted erlaubt npm, GitHub, Docker Hub, *.r2.cloudflarestorage.com, nodejs.org und fonts.googleapis.com. Nicht erlaubt sind api.stripe.com, cdn.playwright.dev und playwright.download.prss.microsoft.com; dazu gibt es ein bekanntes Issue, dass Playwright-Downloads blockiert werden. Umgebungsvariablen und Setup-Skript sind für alle Nutzer der Umgebung lesbar ('don't include secrets'). Auf Pro und Max gibt es 'API credentials', die die Sitzung nutzen, aber nicht lesen kann. Das Setup-Skript wird nur gecacht, wenn es in etwa 5 Minuten fertig wird. Befehle haben standardmäßig 2 Minuten Timeout, bis zu 10 Minuten sind möglich.

**Auswirkung:** Setup-Skript muss Node 24 und Playwright-Chromium installieren. Netzstufe 'Custom' mit ergänzten Domains. Nur Stripe-Test-Keys, niemals Produktionsgeheimnisse, in der Cloud-Umgebung. Tests laufen gegen lokales Postgres per Docker (postgres:17) oder das vorinstallierte PG16.

Quellen:
- https://code.claude.com/docs/en/cloud-environments
- https://code.claude.com/docs/en/claude-code-on-the-web
- https://github.com/anthropics/claude-code/issues/15583
- https://playwright.dev/docs/browsers

### Anbieter für Transaktions-E-Mails `[medium]`

Resend: Region eu-west-1 steuert nur den Versandort; laut Resend-Doku werden alle Account-Daten und Logs in den USA gespeichert. Lettermint (NL): eigene Infrastruktur ausschließlich in der EU, Free 300 Mails pro Monat, bezahlte Pläne ab 10 € für 10.000. Managed DKIM per CNAME, funktioniert also mit IONOS-DNS. Scaleway TEM (FR): laut Sekundärquellen 300 Mails pro Monat frei, danach 0,25 € pro 1.000, ohne Grundgebühr (Essential-Plan). Brevo (FR): Free 300 Mails pro Tag, laut Sekundärquellen aber mit Brevo-Logo in allen Mails. Postmark speichert laut Sekundärquellen in den USA. Payload bindet über @payloadcms/email-nodemailer jeden SMTP-Anbieter an.

**Auswirkung:** EU-Anbieter bevorzugen: Lettermint oder Scaleway TEM, angebunden per SMTP oder Adapter, damit ein Wechsel trivial bleibt. Resend und Postmark widersprechen der EU-Präferenz.

Quellen:
- https://resend.com/docs/dashboard/domains/regions
- https://lettermint.co/pricing
- https://www.scaleway.com/en/transactional-email-tem/
- https://www.emailtooltester.com/en/reviews/brevo/pricing/
- https://payloadcms.com/docs/email/overview

### DNS-Ist-Zustand planetclairetattoos.com (live abgefragt am 26.09.2026) `[high]`

Nameserver: ns1085.ui-dns.com, ns1055.ui-dns.biz, ns1107.ui-dns.org, ns1033.ui-dns.de (IONOS). A @ = 217.160.0.7 und AAAA @ = 2001:8d8:100f:f000::200 (IONOS-Parkseite), www löst genauso auf. MX @ = mx00.ionos.de und mx01.ionos.de, beide Priorität 10. TXT @ = 'v=spf1 include:_spf-eu.ionos.com ~all'. DKIM: s1-ionos._domainkey ist ein CNAME auf s1.dkim.ionos.com. Laut IONOS-Hilfe gehören dazu außerdem s2-ionos und s42582890, die bei IONOS-Nameservern automatisch angelegt werden. _dmarc ist ein CNAME auf dmarc.ionos.de mit 'v=DMARC1; p=none;'.

**Auswirkung:** Beim Umschalten auf Vercel nur A und www ändern und alle AAAA-Einträge der Parkseite löschen, sonst landen IPv6-Nutzer weiter auf der Parkseite. MX, SPF und die IONOS-DKIM-Einträge nicht anfassen. Für eigene DMARC-Berichte den CNAME durch einen eigenen TXT-Eintrag ersetzen.

Quellen:
- nslookup gegen 8.8.8.8 am 26.09.2026 (eigene Abfrage)
- https://www.ionos.com/help/domains/configuring-mail-servers-and-other-related-records/email-authentication-with-dkim/
- https://www.ionos.com/help/domains/general-information-about-dns-settings/default-dns-settings-for-11-ionos-domains/
- https://vercel.com/docs/domains/set-up-custom-domain

### Analytics ohne Cookies und Fehler-Monitoring `[medium]`

Vercel Web Analytics arbeitet ohne Cookies. Im Pro-Plan kostet es 0,03 USD pro 1.000 Events und wird aus dem Pro-Guthaben bezahlt; Hobby enthält 50.000 Events. Plausible (EU) kostet laut Sekundärquellen im Starter-Plan 9 € pro Monat für 10.000 Seitenaufrufe. Umami Cloud Hobby ist kostenlos (laut Sekundärquellen 100.000 Events), die Server liegen laut Umami in den USA und der EU, eine Regionswahl ist nicht dokumentiert. Sentry Developer ist kostenlos (etwa 5.000 Fehler pro Monat) und hat eine EU-Datenregion in Frankfurt.

**Auswirkung:** Die günstigste Lösung ohne zusätzlichen Anbieter ist Vercel Web Analytics. Streng EU-orientiert wäre Plausible. Sentry in der EU-Region ohne Session Replay und ohne PII.

Quellen:
- https://vercel.com/docs/analytics/limits-and-pricing
- https://seline.com/blog/plausible-analytics-pricing
- https://docs.umami.is/docs/cloud/faq
- https://umami.is/pricing
- https://blog.sentry.io/sentrys-eu-data-region-now-in-early-access
- https://costbench.com/software/developer-tools/sentry/free-plan/

### CI und GitHub Actions `[high]`

GitHub Free enthält für private Repos 2.000 Actions-Minuten und 500 MB Speicher pro Monat. Linux-Runner kosten seit 01.01.2026 0,006 USD pro Minute. Die angekündigte Plattformgebühr für self-hosted Runner wurde auf unbestimmte Zeit verschoben. Die Payload-Vorlage bringt Vitest-Integrationstests und Playwright-E2E-Tests bereits mit.

**Auswirkung:** CI mit Lint, Typecheck, Unit- und Integrationstests (Postgres-Service), Build und E2E gegen die Preview passt in das Freikontingent, solange die Pipelines schlank bleiben (Caching).

Quellen:
- https://github.com/resources/insights/2026-pricing-changes-for-github-actions
- https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/

### Animation und kreatives Frontend `[high]`

GSAP ist seit April 2025 vollständig kostenlos, auch kommerziell und inklusive DrawSVG, MorphSVG, SplitText und ScrollTrigger; ideal für Strichzeichnungs-Animationen im Tattoo-Look. Aktuelle Versionen: gsap 3.15.0, motion 13.4.4 für React-UI-Übergänge, three 0.186.1 für optionales WebGL. Alles funktioniert mit Next.js App Router in Client-Komponenten.

**Auswirkung:** Kein Lizenzrisiko für die unkonventionelle Navigation. WebGL nur lazy laden und prefers-reduced-motion respektieren.

Quellen:
- https://webflow.com/blog/gsap-becomes-free
- https://css-tricks.com/gsap-is-now-completely-free-even-for-commercial-use/
- https://gsap.com/svg/

### Pflege am Handy: Vergleich der Admin-Oberflächen `[medium]`

Shopify hat eine native App mit Kamera-Upload, am stärksten. Die Payload-Admin-Oberfläche ist responsiv, lässt sich über eigene Views und Komponenten stark anpassen und kann Bulk-Uploads, ist aber keine App. Mobile-spezifische Kamerafunktionen sind nicht dokumentiert. Die Medusa-Admin-Oberfläche ist mobil schwach; Mobil-Tauglichkeit ist ein offener Community-Wunsch. Sanity Studio und Directus sind responsiv, aber reine Content-Oberflächen ohne Bestellwesen.

**Auswirkung:** Mit Payload sind eigene, mobil optimierte Ansichten nötig, z. B. 'Neues Stück', 'Offene Bestellungen' und 'Versenden', dazu ein PWA-Manifest für den Homescreen. Sonst ist die Handy-Pflege der Schwachpunkt gegenüber Shopify.

Quellen:
- https://payloadcms.com/docs/admin/overview
- https://payloadcms.com/docs/upload/overview
- https://help.shopify.com/en/manual/products/product-media/add-media
- https://github.com/medusajs/medusa/discussions/1092

### Laufende Kosten pro Monat (Schätzung, ohne IONOS-Bestand) `[medium]`

Primärlösung: Vercel Pro 20 USD (inklusive 20 USD Guthaben), Neon Free (0 €; beim Launch-Plan nutzungsbasiert, geschätzt 2–10 €), R2 0 € bis 10 GB, Lettermint Free oder Scaleway TEM etwa 0 €, Sentry 0 €, Vercel Web Analytics wenige Cent aus dem Guthaben, GitHub Free 0 €. Summe etwa 18–30 € pro Monat plus Stripe-Gebühren. EU-souverän: Hetzner CX33 8,49 € plus Backups (laut Hetzner 20 % des Serverpreises, hier nicht verifiziert), Object Storage 6,49 € oder R2 0 €, Bunny CDN ab etwa 1 USD; Summe etwa 11–18 € mit Betriebsaufwand. Shopify-Fallback: 27–36 € plus 2,1 % + 0,30 € pro Kartenzahlung plus Apps. Medusa Cloud: ab 29 USD.

**Auswirkung:** Alle Varianten liegen im Ziel von 0–50 €. Die Primärlösung braucht einen Vercel-Ausgabenlimit (Spend Management) als Kostenbremse.

Quellen:
- https://vercel.com/pricing
- https://neon.com/docs/introduction/plans
- https://developers.cloudflare.com/r2/pricing/
- https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
- https://www.shopify.com/de/preise
- https://medusajs.com/pricing/
- https://bunny.net/pricing/

### Versandlabels mit DHL (Ausblick, nicht MVP) `[medium]`

Die DHL Parcel DE Shipping API v2 (REST) erzeugt Labels, setzt aber ein Geschäftskundenkonto (GKP) voraus. Die DHL Parcel DE Private Shipping API legt Warenkörbe für Privatkunden-Sendungen an. Bezahlt wird dabei im Frontend der DHL Online Frankierung, danach ruft man Label oder QR-Code ab.

**Auswirkung:** Im MVP die Sendungsnummer von Hand eintragen. Eine DHL-Integration später als optionaler Task, je nach Kontotyp.

Quellen:
- https://developer.dhl.com/api-reference/parcel-de-shipping-post-parcel-germany-v2?language_content_entity=en
- https://developer.dhl.com/api-reference/dhl-parcel-de-private-shipping-post-parcel-germany?language_content_entity=en

## Empfehlungen

- **Primärer Stack: eine einzige Next.js-App mit eingebettetem Payload. Versionen: Next.js ≥16.3.7 <17, Payload 3.90.x (payload und alle @payloadcms/* exakt gleiche Version), React 19.2.x, TypeScript 6.0.x, Node 24 LTS (≥24.15), pnpm 11.x, Tailwind 4.x, @payloadcms/db-postgres mit Postgres 17, @payloadcms/storage-s3 für R2, @payloadcms/plugin-seo, @payloadcms/email-nodemailer, next-intl 4.x, GSAP 3.15 und Motion 13 fürs Frontend.**  
  _BegrÃ¼ndung:_ CMS, Admin, Auth, Datenbank-Transaktionen, API und Frontend liegen in einem Repo mit Konfiguration als Code und generierten Typen. Das ist ideal für Claude-Agenten: alles ist testbar, und Änderungen landen per Git-Push in Preview und Produktion. MIT-Lizenz, keine Anbieterbindung, Kosten im Budget. Die Versionen stammen aus der aktuellen offiziellen Payload-Vorlage und dem npm-Stand vom 26.09.2026.

- **Hosting-Topologie: Vercel Pro mit regions ['fra1'] in vercel.json, Neon Postgres in aws-eu-central-1 (Frankfurt, gepoolte Verbindung), Cloudflare R2 mit EU-Jurisdiktion (Buckets pct-media-prod, pct-media-staging, pct-private-inquiries und pct-backups), Stripe mit Konto in DE. DNS bleibt bei IONOS. Medien werden über die Payload-Dateiroute mit 'Cache-Control: public, max-age=31536000, immutable' über das Vercel-CDN ausgeliefert. Wichtig: Dockerfile und docker-compose.prod.yml ab Tag 1 pflegen und in der CI bauen, als Exit-Pfad zu Hetzner.**  
  _BegrÃ¼ndung:_ Kein Server zu pflegen, was für eine nicht-technische Eigentümerin und für Agenten ohne SSH entscheidend ist. Automatische Preview-Deployments pro PR. Rechenleistung und Daten liegen in Frankfurt bzw. der EU, mit DPA und DPF. Der Hobby-Plan scheidet aus, weil er kommerzielle Nutzung verbietet. Der Hetzner-Exit sichert die Datenhoheit, falls sich Preise oder Politik ändern.

- **Commerce-Kern selbst bauen statt @payloadcms/plugin-ecommerce. Collections: Products (Art: unique oder stocked, Status: available, reserved, sold oder archived, Preis in Cent), Variants (nur für Größen), Categories, Collections/Drops, Orders, OrderItems, Reservations, Customers (nur Gast, E-Mail), ShippingRates, InvoiceCounter und Media.**  
  _BegrÃ¼ndung:_ Das Plugin ist Beta mit angekündigten Breaking Changes und hat keine Reservierung. Die Anforderungen (meist Unikate, einfache Varianten, ein Versandland, Rechnungsnummern) sind mit etwa zehn Collections überschaubar und sauber testbar.

- **Checkout über Stripe Checkout Sessions mit ui_mode 'elements' auf der eigenen Seite, samt eigenem Button 'Zahlungspflichtig bestellen'. Ablauf: Unikat per SQL UPDATE ... WHERE status='available' RETURNING atomar reservieren, Session mit expires_at = jetzt + 30 min anlegen. Webhooks: checkout.session.completed und async_payment_succeeded setzen auf sold und legen die Bestellung an; checkout.session.expired und async_payment_failed geben frei. Zusätzlich gibt ein Vercel-Cron alle 5 Minuten abgelaufene Reservierungen frei. Idempotenz über einen UNIQUE-Index auf stripeCheckoutSessionId.**  
  _BegrÃ¼ndung:_ So hat die Kundin die Button-Beschriftung und die Bestellübersicht selbst in der Hand, was für die deutsche Button-Lösung wichtig ist; rechtliche Details liegen in der Rechts-Dimension. Die 30-Minuten-Reservierung ist Stripes dokumentiertes Muster für begrenzten Bestand und verhindert Doppelverkäufe auch bei Drops mit gleichzeitigen Käufern.

- **Zahlarten: Karten, Apple Pay, Google Pay, PayPal (über Stripe), optional Klarna und Wero, sobald allgemein verfügbar. SEPA-Lastschrift und andere Zahlarten mit Verzögerung für Unikate ausschließen, über allowed_payment_method_types bzw. excluded_payment_method_types.**  
  _BegrÃ¼ndung:_ Zahlarten mit Verzögerung bestätigen erst nach Tagen. Ein Unikat wäre so lange blockiert oder würde doppelt verkauft. Alle übrigen Zahlarten bestätigen sofort und lassen sich im Stripe-Dashboard ohne Code einschalten.

- **Handy-Backoffice: eigene Payload-Admin-Views mit Mobile-First-Oberfläche. (1) 'Neues Stück': mehrere Fotos, im Browser verkleinert, Kategorie, Titel und Beschreibung (DE/EN), Preis, Maße; die Artikelnummer wird automatisch vergeben; Buttons 'Entwurf' oder 'Drop planen'. (2) 'Offene Bestellungen' mit Packliste und Adresse. (3) 'Versenden' mit Sendungsnummer, Statuswechsel und Versand-Mail. Dazu ein PWA-Manifest, damit die Admin-Oberfläche auf dem Homescreen liegt.**  
  _BegrÃ¼ndung:_ Die Standard-Admin-Oberfläche ist responsiv, aber für schnelle Einträge unterwegs und auf dem Flohmarkt zu generisch. Eigene Views schließen die Lücke zur nativen Shopify-App.

- **Bildpipeline: file input mit accept='image/jpeg,image/png,image/webp', damit iOS HEIC in JPEG wandelt. Im Browser auf maximal 2560 px und JPEG-Qualität etwa 0,85 verkleinern (bleibt unter 4,5 MB). In Payload formatOptions/resizeOptions für das Original, damit EXIF und GPS entfernt werden, plus imageSizes in WebP: thumb 400, card 800, detail 1600, zoom 2560. Fokuspunkt aktiv. Anfrage-Bilder vom Tattoo-Formular in einen privaten Bucket, lesbar nur für Admins, mit automatischer Löschung nach einer festgelegten Frist.**  
  _BegrÃ¼ndung:_ Löst das 4,5-MB-Limit, das fehlende HEIC in sharp und das Datenschutzrisiko durch GPS-Daten in Produktfotos. Liefert automatisch optimierte Bilder ohne Kosten für Vercel Image Optimization.

- **Umgebungen: lokal (docker compose mit postgres:17 und MinIO oder R2-Dev-Bucket, Stripe CLI), Preview pro PR (Vercel Preview mit Deployment Protection, Neon-Branch aus einem anonymisierten Staging-Seed, niemals aus Prod-Daten, Stripe-Testmodus), Staging (Branch staging auf staging.planetclairetattoos.com, Stripe-Test, geschützt) und Produktion (Branch main, Stripe live). Deploy ausschließlich per Git.**  
  _BegrÃ¼ndung:_ Agenten können jede Änderung in einer realistischen Vorschau prüfen, ohne Kundendaten offenzulegen oder echtes Geld zu bewegen. Stripe-Webhooks brauchen stabile URLs, deshalb die feste Staging-Domain.

- **Tests und CI: Vitest 5 für Unit-Tests (Artikelnummer, Preise, Reservierung) und Integrationstests (Payload Local API gegen echtes Postgres 17, Webhook-Handler mit Stripe-Fixtures bzw. stripe-mock). Playwright 1.63 für E2E: Checkout im Stripe-Testmodus, gleichzeitiger Kauf desselben Unikats, iPhone- und Android-Viewport, axe-Barrierefreiheit, EXIF-Entfernung. GitHub Actions mit lint, typecheck, test:int, build und test:e2e gegen die Preview-URL als Pflicht-Checks für main; Renovate wöchentlich, Sicherheitsupdates sofort.**  
  _BegrÃ¼ndung:_ Doppelverkauf, Zahlungsflüsse und Upload-Datenschutz sind die kritischsten Stellen und müssen automatisch abgesichert sein, damit Agenten ohne Rückfragen arbeiten können. Das Freikontingent von 2.000 Minuten reicht.

- **Backups: Neon-PITR plus ein nächtlicher GitHub-Actions-Workflow mit pg_dump im Custom-Format, verschlüsselt mit age, abgelegt im R2-Bucket pct-backups (EU). Aufbewahrung 30 Tage täglich und 12 Monate monatlich. Medien-Bucket wöchentlich per rclone auf einen zweiten EU-Speicher spiegeln (optional Hetzner Object Storage). Wiederherstellung vierteljährlich als Probe laut RUNBOOK.md.**  
  _BegrÃ¼ndung:_ Neon Free hält nur 6 Stunden PITR vor. Bestellungen und Rechnungen müssen wegen der Aufbewahrungspflichten sicher gesichert sein.

- **Beobachtbarkeit: Sentry in der EU-Region, Developer-Plan, sendDefaultPii false, ohne Session Replay, mit Tunnel-Route. Vercel Web Analytics ohne Cookies, oder Plausible bei strenger EU-Präferenz. Stripe-Benachrichtigungen bei fehlschlagenden Webhooks. In Vercel ein Ausgabenlimit mit Benachrichtigung ab etwa 30 USD.**  
  _BegrÃ¼ndung:_ Kostenlos oder fast kostenlos, ohne Cookie-Banner-Pflicht für die Reichweitenmessung (rechtliche Feinprüfung in der Rechts-Dimension), und Kostenkontrolle gegen böse Überraschungen.

- **Transaktions-Mails über einen EU-Anbieter, Lettermint oder Scaleway TEM, per SMTP über @payloadcms/email-nodemailer. Absender z. B. shop@planetclairetattoos.com, Reply-To jutta@planetclairetattoos.com. Mail-Vorlagen als React-Komponenten in DE/EN. IONOS bleibt das Postfach.**  
  _BegrÃ¼ndung:_ Daten bleiben in der EU (Resend und Postmark speichern in den USA). Das Free-Kontingent reicht für das erwartete Volumen. Über SMTP bleibt ein Wechsel trivial, und IONOS-Mail bleibt unberührt.

- **DNS bei IONOS in dieser Reihenfolge: (1) Die komplette Zone per Screenshot oder Export sichern. (2) Domain in Vercel hinzufügen und genau die dort angezeigten Werte übernehmen: A @ auf die von Vercel angegebene IP, www als CNAME auf das von Vercel angegebene Ziel, www leitet auf die Apex-Domain um. (3) Die AAAA-Einträge von @ und www (2001:8d8:100f:f000::200) löschen bzw. die Domain in IONOS vom Webspace-Produkt lösen. (4) MX mx00.ionos.de und mx01.ionos.de, SPF und die IONOS-DKIM-CNAMEs s1-ionos, s2-ionos und s42582890 unverändert lassen. (5) DKIM und Return-Path des Mail-Anbieters nur als dessen eigene Selektor- bzw. Subdomain-Einträge hinzufügen; einen SPF-Include nur, wenn der Anbieter ihn ausdrücklich verlangt, dann in denselben einen SPF-TXT-Eintrag einbauen. (6) _dmarc-CNAME ersetzen durch TXT 'v=DMARC1; p=none; rua=mailto:dmarc@planetclairetattoos.com; fo=1', nach 4–8 Wochen sauberer Berichte auf p=quarantine. (7) staging als CNAME auf Vercel. (8) Bei Stripe Elements die Domain unter 'Payment method domains' registrieren, für Apple Pay.**  
  _BegrÃ¼ndung:_ Die Live-Abfrage zeigt, dass die Mail-Einträge korrekt sind und nur die Web-Einträge auf die IONOS-Parkseite zeigen. Mit dieser Reihenfolge funktioniert IONOS-Mail durchgehend weiter.

- **Alle Konten (GitHub, Vercel, Neon, Cloudflare, Stripe, Mail-Anbieter, Sentry) auf Juttas E-Mail-Adresse anlegen, jeweils mit 2FA. Geheimnisse liegen nur in Vercel-Umgebungsvariablen, getrennt nach Production und Preview, sowie in GitHub-Actions-Secrets. In der Claude-Cloud-Umgebung nur Test-Keys, auf Pro/Max als 'API credentials'. Außerdem .env.example im Repo und ein PAYLOAD_SECRET mit mindestens 32 Byte.**  
  _BegrÃ¼ndung:_ Keine Bindung an Entwicklerkonten. Die Stripe-Identitätsprüfung (KYC) muss ohnehin auf Jutta laufen. Umgebungsvariablen der Cloud-Umgebung sind laut Doku für alle Nutzer lesbar.

- **Fallbacks. (A) Hosting-Fallback: dieselbe App als Docker auf Hetzner CX33 in Nürnberg oder Falkenstein mit Postgres 17 und Caddy, Deploy per GitHub Actions über GHCR und SSH; Coolify nur ab ≥4.2 und nicht öffentlich erreichbar. (B) Stack-Fallback: Shopify Basic mit Hydrogen 2026.x auf Oxygen, falls die Pflege am Handy per Web-Admin scheitert oder Jutta null Commerce-Verantwortung will.**  
  _BegrÃ¼ndung:_ (A) sichert Kosten und EU-Souveränität ohne Code-Umbau. (B) bietet die beste native App und fertige Commerce-Prozesse, ist aber mit höheren Gebühren und Anbieterbindung erkauft.

- **Update-Politik: Payload auf 3.x festhalten. Nach dem stabilen Release von Payload 4 einen eigenen Migrations-Task mit ADR anlegen. Next.js-Patches innerhalb von 48 Stunden einspielen (Renovate automerge für Patches bei grüner CI). TypeScript 7 erst, wenn die Payload-Vorlage umsteigt. Node 24 bis zum Ende seiner LTS am 30.04.2028.**  
  _BegrÃ¼ndung:_ Ein einmal gebauter Shop bleibt so sicher, ohne dass bei jeder Beta Umbrüche entstehen; das passt zum autonomen Arbeiten der Cloud-Agenten.

## Umsetzungsanforderungen

- Repo-Struktur: eine Next.js-App mit src/app/(frontend) und src/app/(payload), payload.config.ts und collections/ als Konfiguration als Code. Paketmanager pnpm 11.x mit packageManager-Feld. engines.node >=24.15 und .nvmrc mit 24.
- Exakte Pins: payload und alle @payloadcms/* 3.90.x (gleiche Version), next >=16.3.7 <17, react und react-dom 19.2.x, typescript 6.0.x, sharp 0.35.x, stripe (Node) 22.x, @stripe/stripe-js 9.x, vitest 5.0.x, @playwright/test 1.63.x, next-intl 4.x, gsap 3.15.x, motion 13.x.
- Datenbank: @payloadcms/db-postgres. Produktion: Neon-Projekt in aws-eu-central-1 mit Postgres 17, gepoolter Connection-String als DATABASE_URL. Migrationen mit payload migrate:create einchecken. Vercel-Build für Produktion und Staging: 'pnpm payload migrate && pnpm build'. Außerhalb von lokal nie Schema-push.
- Vercel: vercel.json mit regions ['fra1']. Crons: '/api/payload-jobs/run?allQueues=true' jede Minute sowie '/api/cron/release-reservations' alle 5 Minuten, beide mit CRON_SECRET-Prüfung. Deployment Protection für Preview und Staging. Ausgabenlimit mit Benachrichtigung aktiv.
- Medienspeicher: @payloadcms/storage-s3 mit Endpoint https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com, region 'auto', eigene Buckets je Umgebung, clientUploads für die Standard-Admin-Oberfläche aktiv. Tattoo-Anfragen in einem privaten Bucket, read-Zugriff nur für Admins. Dateiauslieferung mit Cache-Control 'public, max-age=31536000, immutable' und gehashten Dateinamen.
- Media-Collection: mimeTypes nur image/jpeg, image/png, image/webp. formatOptions/resizeOptions für das Original (Maximum 2560 px, EXIF und GPS entfernen, Orientierung korrigieren). imageSizes in WebP: thumb 400, card 800, detail 1600, zoom 2560. Pflichtfeld Alt-Text in DE und EN. E2E-Test prüft, dass ausgelieferte Dateien keine GPS-Daten enthalten.
- Artikelnummer: beforeChange-Hook beim Anlegen nutzt eine Postgres-Sequence pro Kategorie. Format PCT-{KAT}-{JJ}-{NNNN}, z. B. PCT-KER-26-0042. Kategorie-Kürzel: KER (Keramik), TEX (Textil), CAP (Caps), ZEI (Zeichnung/Druck), SCH (Schmuck), SON (Sonstiges). Unveränderlich, UNIQUE-Index. Etikett mit QR-Code als PDF druckbar.
- Produktmodell: Feld kind (unique oder stocked). Für unique: status available, reserved, sold oder archived, dazu reservedUntil und reservedBySession. Für stocked: Varianten (z. B. Größe) mit quantity und eigener Artikelnummer. Preis als Integer in Cent, EUR. Lokalisierte Felder (DE als Standard, EN mit Fallback): title, description (Lexical), materials, care. Außerdem dimensions, weight für die Versandklasse, drafts/versions mit schedulePublish für Drops.
- Reservierung: in einer DB-Transaktion atomar per SQL 'UPDATE ... SET status=reserved, reserved_until=now()+30min WHERE id=$1 AND status=available RETURNING id'. Bei stocked: bedingtes Herunterzählen. Nur bei Erfolg die Stripe-Session anlegen. Ein Integrationstest mit zwei parallelen Checkouts für dasselbe Unikat muss genau einen Erfolg liefern.
- Stripe: Checkout Sessions mit ui_mode 'elements', mode 'payment', locale 'de' oder 'en', expires_at jetzt + 30 min, shipping_address_collection für die festgelegten Länder, shipping_options aus der ShippingRates-Collection, allowed_payment_method_types ohne Zahlarten mit Verzögerung. Eigener Button mit festgelegter Beschriftung; der Text kommt aus der Rechts-Dimension. Die Domain ist bei Stripe unter 'Payment method domains' registriert.
- Webhook /api/stripe/webhook: Signatur prüfen und den Raw Body verwenden. Behandelte Events: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, charge.refunded. Idempotenz über einen UNIQUE-Index auf orders.stripeCheckoutSessionId. Nach dem Verkauf revalidateTag für Produkt- und Listenseiten.
- Orders-Collection: orderNumber als Sequenz, Positionen als Snapshot (Artikelnummer, Titel, Preis, Bild), Kundin bzw. Kunde (E-Mail, Name), Liefer- und Rechnungsadresse, Versandart und -kosten. Status: paid, packed, shipped, delivered, cancelled oder refunded, mit Zeitstempel je Status. Außerdem carrier, trackingNumber, trackingUrl und eine interne Notiz. Mails an die Kundschaft bei paid und shipped, an Jutta bei paid.
- PDFs mit @react-pdf/renderer 4.x, serverseitig: Packzettel ohne Preise und Rechnung mit fortlaufender Rechnungsnummer über eine Counter-Zeile mit Row-Lock. Die Pflichtangaben kommen aus der Rechts-Dimension, inklusive Umsatzsteuer-Variante. PDF unveränderlich in R2 ablegen und an die Bestellung hängen.
- E-Mail: @payloadcms/email-nodemailer mit SMTP des gewählten EU-Anbieters. Vorlagen als React-Komponenten in DE/EN. From shop@planetclairetattoos.com, Reply-To jutta@planetclairetattoos.com. Bestellbestätigung, Versandbestätigung, Eingangsbestätigung für Tattoo-Anfragen und Admin-Benachrichtigungen.
- Mobile Admin-Views (Payload custom views): Neues Stück (Mehrfach-Upload mit Verkleinerung im Browser, Kamera über das file input), Bestellungen offen und gepackt, Versenden (Sendungsnummer, Status), dazu der Schnellstatus 'Auf Flohmarkt verkauft' mit einem Tap. PWA-Manifest und Icons für den Admin-Bereich. Login mit maxLoginAttempts und lockTime.
- i18n: Payload-Lokalisierung mit den Locales de (Standard) und en, Fallback aktiv. Oberfläche mit next-intl 4.x, Routen /de und /en mit Erkennung per Accept-Language, hreflang und kanonische URLs.
- SEO: @payloadcms/plugin-seo, dynamische sitemap.xml und robots.txt, JSON-LD für Product mit Offer, availability InStock oder SoldOut und sku. Open-Graph-Bilder aus der Media-Größe card. Verkaufte Unikate bleiben als 'verkauft' im Archiv sichtbar statt 404.
- Tattoo-Bereich (nicht kaufbar): Collections TattooWorks (fresh oder healed, Heilungsdauer), Flash (available oder claimed), TattooOffers (Texte, Preisrahmen) und Inquiries (privat, Bild-Upload bis 5 Bilder, im Browser verkleinert). Spam-Schutz mit Honeypot, Rate-Limit und ALTCHA oder einer anderen selbst gehosteten Proof-of-Work-Lösung. Ein Löschjob entfernt Anfragen nach einer festgelegten Frist.
- Drops: Produkte als Entwurf mit schedulePublish. Die Payload-Jobs-Queue läuft per Vercel-Cron jede Minute. Nach dem Veröffentlichen revalidateTag. Countdown-Komponente im Frontend.
- Frontend: kreative Navigation mit GSAP (DrawSVG, MorphSVG, SplitText) und Motion. WebGL (three oder OGL) nur lazy laden. prefers-reduced-motion hat vollen Vorrang. Leistungsbudget mobil: LCP unter 2,5 s und CLS unter 0,1. Checkout- und Admin-Seiten bleiben animationsarm.
- Sicherheit: CSP- und Security-Header in next.config. Payload-Zugriffsregeln deny-by-default. Admin-Route ggf. umbenennen (routes.admin). Rate-Limits auf Checkout-Start und Anfrageformular. Nur Stripe-Test-Keys außerhalb der Produktion.
- Tests: Vitest 5 für Unit-Tests (Artikelnummer, Preisformat, Versandkosten, Reservierungs-Wettlauf) und Integrationstests (Payload Local API gegen Postgres 17, Webhook-Handler mit Stripe-Event-Fixtures bzw. stripe-mock). Playwright 1.63 für E2E: Kaufstrecke im Stripe-Testmodus, Viewports iPhone 15 und Pixel, Sprachwechsel, Tattoo-Anfrage, Admin 'Neues Stück', axe-Checks.
- CI (GitHub Actions): pro PR install mit Cache, lint, typecheck, test:int mit postgres:17-Service und build; test:e2e gegen die Vercel-Preview-URL. Branch-Schutz für main mit Pflicht-Checks. Renovate mit automerge für Patches bei grüner CI. Nächtlicher Backup-Workflow.
- Umgebungen: .env.example mit allen Variablen (DATABASE_URL, PAYLOAD_SECRET, S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, SMTP_*, CRON_SECRET, SENTRY_DSN, NEXT_PUBLIC_SITE_URL). Preview-Datenbanken als Neon-Branches aus einem anonymisierten Seed. Seed-Skript mit Beispielprodukten und Beispiel-Tattoos.
- Backups: GitHub-Action nachts mit pg_dump -Fc, verschlüsselt mit age, Upload in den R2-Bucket pct-backups (Lifecycle 30 Tage plus monatliche Kopien 12 Monate). Wöchentlicher rclone-Sync des Medien-Buckets. RUNBOOK.md mit geprobtem Restore.
- Monitoring: @sentry/nextjs 11.x mit EU-DSN (de.sentry.io), ohne PII und ohne Replay, mit Tunnel-Route. Vercel Web Analytics oder Plausible. Uptime-Check auf / und /api/health.
- Claude-Cloud-Umgebung: Netzstufe Custom, also die Trusted-Standards plus cdn.playwright.dev, playwright.download.prss.microsoft.com, playwright.azureedge.net, api.stripe.com und files.stripe.com. Setup-Skript installiert Node 24 von nodejs.org, pnpm 11 und Playwright-Chromium mit Abhängigkeiten und zieht postgres:17 per docker compose pull (muss in etwa 5 Minuten fertig sein, damit gecacht wird). Ein SessionStart-Hook startet Postgres. Keine Produktionsgeheimnisse.
- DNS (IONOS): Zone sichern; A @ und CNAME www laut Vercel-Domain-Dialog; AAAA-Einträge der Parkseite löschen; MX, SPF und die IONOS-DKIM-Einträge unverändert; DKIM und Return-Path des Mail-Anbieters ergänzen; _dmarc-CNAME durch eigenen TXT mit p=none und rua ersetzen, später p=quarantine; staging als CNAME auf Vercel. Nach der Umstellung Web und Mail getrennt prüfen (Testmail an Gmail mit Header-Check auf SPF, DKIM und DMARC pass).
- Dokumentation im Repo: CLAUDE.md (Konventionen, Befehle, Definition of Done), docs/adr/ (Stack-Wahl, eigene Commerce-Collections statt Plugin, Hosting), RUNBOOK.md (Deploy, Rollback, Restore, Schlüsselrotation), docs/owner-guide-de.md (Bedienung am Handy mit Screenshots).
- Exit-Pfad: Dockerfile (Next standalone output) und docker-compose.prod.yml (App, Postgres 17, Caddy) werden in der CI gebaut und per Smoke-Test geprüft, damit ein Umzug zu Hetzner ohne Code-Änderung möglich bleibt.

## Offene Fragen aus der Recherche (inzwischen im Interview beantwortet, siehe docs/ENTSCHEIDUNGEN.md)

- Welches Hosting-Prinzip soll gelten: Komfort mit EU-Regionen (Vercel, Neon, R2; etwa 18–30 € pro Monat; keine Serverpflege; US-Anbieter mit Datenverarbeitungsvertrag) oder streng EU-souverän (Hetzner-Server in Deutschland; etwa 11–18 € pro Monat; Serverpflege und Sicherheitsupdates nötig)? _(Optionen: Komfort: Vercel Pro (fra1), Neon (Frankfurt) und Cloudflare R2 (EU) / EU-souverän: Hetzner CX33 mit Docker und Hetzner Object Storage / Mischform: Railway EU (Amsterdam) oder Render (Frankfurt) mit dauerhaft laufendem Node-Server; Empfehlung: Komfort: Vercel Pro (fra1), Neon (Frankfurt) und Cloudflare R2 (EU), mit Docker-Exit-Pfad)_
- Reicht Jutta eine Web-Oberfläche am Handy (Payload-Admin mit eigenen, fürs Handy gebauten Ansichten, als Icon auf dem Homescreen), oder ist eine echte App aus dem App Store Pflicht? _(Optionen: Web-Oberfläche mit eigenen Handy-Ansichten reicht / Native App ist Pflicht, also Shopify headless; Empfehlung: Web-Oberfläche mit eigenen Handy-Ansichten reicht)_
- Welche Zahlarten sollen angeboten werden? _(Optionen: Karten, Apple Pay, Google Pay und PayPal / wie vorher plus Klarna / wie vorher plus SEPA-Lastschrift (nur für Artikel mit Lagerbestand, nicht für Unikate) / Wero ergänzen, sobald bei Stripe allgemein verfügbar; Empfehlung: Karten, Apple Pay, Google Pay und PayPal; Klarna optional; keine SEPA-Lastschrift für Unikate)_
- Sollen Kundinnen und Kunden Konten anlegen können, oder nur als Gast bestellen? _(Optionen: Nur Gastbestellung, Bestellstatus über einen Link per E-Mail / Gast und optionales Konto; Empfehlung: Nur Gastbestellung, Bestellstatus über einen Link per E-Mail)_
- Ist Jutta Kleinunternehmerin nach § 19 UStG oder weist sie Umsatzsteuer aus? Und welches Buchhaltungsprogramm nutzt sie, z. B. Lexware Office (früher lexoffice), sevDesk oder keins? _(Optionen: Kleinunternehmerin, Rechnungs-PDF selbst erzeugen / Regelbesteuerung, Rechnungs-PDF selbst erzeugen / Rechnungen über die API des Buchhaltungsprogramms erstellen / Stripe Invoicing (0,4 %, max. 2 € pro Rechnung); Empfehlung: Rechnungs-PDF selbst erzeugen mit fortlaufender Nummer; die Variante je nach Steuerstatus bestätigen lassen)_
- Welcher Anbieter soll die Shop-E-Mails (Bestell- und Versandbestätigungen) verschicken? _(Optionen: Lettermint (NL, EU-Infrastruktur, 300 Mails pro Monat frei, dann ab 10 €) / Scaleway TEM (FR, 300 frei, dann 0,25 € pro 1.000) / IONOS-SMTP mit eigenem Postfach (kostenlos, aber ohne Versandprotokolle und Webhooks) / Resend (US-Datenspeicherung); Empfehlung: Lettermint (NL, EU-Infrastruktur, 300 Mails pro Monat frei, dann ab 10 €))_
- Welche Besucherstatistik soll laufen, alle ohne Cookies? _(Optionen: Vercel Web Analytics (wenige Cent, aus dem Pro-Guthaben) / Plausible Cloud (EU, etwa 9 € pro Monat) / Umami Cloud Hobby (kostenlos) / Keine Statistik; Empfehlung: Vercel Web Analytics (wenige Cent, aus dem Pro-Guthaben))_
- Soll das DNS bei IONOS bleiben, oder dürfen die Nameserver kostenlos zu Cloudflare umziehen? Domain und Mail blieben bei IONOS. _(Optionen: DNS bleibt bei IONOS, Medien über die App mit CDN-Cache / Nameserver zu Cloudflare Free, alle Mail-Einträge 1:1 übernehmen; Empfehlung: DNS bleibt bei IONOS, Medien über die App mit CDN-Cache)_
- Wie soll der Versand im MVP laufen? _(Optionen: Manuell: Label in der DHL Online Frankierung kaufen, Sendungsnummer im Admin eintragen / Später: DHL Private Shipping API (Warenkorb vorbefüllen) / Später: DHL-Geschäftskundenkonto mit Parcel DE Shipping API v2; Empfehlung: Manuell: Label in der DHL Online Frankierung kaufen, Sendungsnummer im Admin eintragen)_
- Sollen Flohmarktverkäufe im System erfasst werden? _(Optionen: Ja, mit einem Tap 'Offline verkauft' in der Handy-Ansicht / Ja, plus später Kartenzahlung per Smartphone über Stripe / Nein, Flohmarkt-Ware kommt nie in den Online-Shop; Empfehlung: Ja, mit einem Tap 'Offline verkauft' in der Handy-Ansicht)_
- Auf wessen Namen und E-Mail-Adresse werden GitHub, Vercel, Neon, Cloudflare, Stripe, der Mail-Anbieter und Sentry angelegt, und wer bekommt Admin-Zugriff? _(Optionen: Alle Konten auf Jutta (jutta@planetclairetattoos.com), Helfer als eingeladene Mitglieder / GitHub-Organisation 'planetclairetattoos' mit Jutta als Owner; Empfehlung: Alle Konten auf Jutta (jutta@planetclairetattoos.com), Helfer als eingeladene Mitglieder, 2FA überall)_
- Wie hoch darf das monatliche Limit für Infrastrukturkosten sein, bevor gewarnt oder abgeschaltet wird? _(Optionen: Warnung ab 30 €, harte Grenze bei 50 € / Warnung ab 50 €, keine harte Grenze; Empfehlung: Warnung ab 30 €, harte Grenze bei 50 €)_
