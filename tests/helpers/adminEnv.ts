// Admin-Pfad und Zugangsdaten für Tests kommen aus der Umgebung (E-03, E-93, ARCHITEKTUR Anhang C-14 Nr. 1).
export const adminRoute = process.env.ADMIN_ROUTE || '/werkstatt'
export const serverURL = process.env.E2E_BASE_URL || 'http://localhost:3000'

export const testUser = {
  email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
  password: process.env.SEED_ADMIN_PASSWORD || 'dev-only-password-2026',
}
