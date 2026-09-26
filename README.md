# Planet Claire

Website, Shop und Tattoo-Bereich für **planetclairetattoos.com** – Tattoos, handgemachte Unikat-Keramik, bemalte
Second-Hand-Textilien und Zeichnungen von Jutta aus Berlin ([@planet.claire.tattoos](https://www.instagram.com/planet.claire.tattoos/)).

## Wo steht was?

| Datei | Inhalt |
|---|---|
| [docs/konzept/planet-claire-konzept.html](docs/konzept/planet-claire-konzept.html) | Das freigegebene Konzept (im Browser öffnen) |
| [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md) | Alle verbindlichen Entscheidungen |
| [PLAN.md](PLAN.md) | Phasenplan P1–P11 mit Aufgaben und Abnahmekriterien |
| [docs/FORTSCHRITT.md](docs/FORTSCHRITT.md) | Was schon erledigt ist |
| [docs/owner/AUFGABEN.md](docs/owner/AUFGABEN.md) | Juttas Aufgabenliste mit Anleitungen |
| [docs/CLOUD-SETUP.md](docs/CLOUD-SETUP.md) | Einrichtung der Claude-Cloud-Entwicklung |
| [CLAUDE.md](CLAUDE.md) | Arbeitsanweisung für die KI-Entwicklung |

## Technik in Kürze

Next.js 16 + Payload CMS 3 (TypeScript) + Postgres, pnpm. Hosting später: Vercel (Frankfurt), Neon (Frankfurt),
Cloudflare R2 (EU), Stripe, Lettermint. Details: [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md).

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d   # Postgres + Mailpit
pnpm dev
```
