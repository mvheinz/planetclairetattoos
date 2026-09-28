// Fehler mit Exit-Code des Vorschau-Exports (ARCHITEKTUR §14.1): 1 = Fehler oder Budget überschritten,
// 2 = Voraussetzung fehlt (mit deutscher Anleitung).
export class ExportError extends Error {
  constructor(
    readonly exitCode: 1 | 2,
    message: string,
  ) {
    super(message)
    this.name = 'ExportError'
  }
}

export const POSTGRES_HELP = [
  'Postgres ist nicht erreichbar – der Vorschau-Export braucht eine lokale Datenbank.',
  'So behebst du das:',
  '  1. Lokal: `docker compose up -d` starten (Postgres 17 + Mailpit).',
  '     In der Cloud-Sitzung: `scripts/cloud-setup.sh` ausführen (docs/CLOUD-SETUP.md).',
  '  2. In `.env` muss DATABASE_URL auf diesen Server zeigen (z. B. postgres://postgres:postgres@127.0.0.1:5432/planetclaire).',
  '  3. Danach `pnpm preview:export` erneut starten.',
].join('\n')

export const CHROMIUM_HELP = [
  'Chromium für Playwright fehlt – der Export braucht ihn für die Verwaltungs-Fotos und den Abnahmetest.',
  'So behebst du das:',
  '  pnpm exec playwright install chromium',
  '  (unter Linux ggf. zusätzlich: pnpm exec playwright install-deps chromium)',
  'Danach `pnpm preview:export` erneut starten.',
].join('\n')
