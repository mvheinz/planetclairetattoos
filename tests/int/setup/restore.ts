// Vor jeder Int-Testdatei: gesicherten Ausgangszustand herstellen (siehe setup/baseline.ts). Läuft nach setup/env.ts.
import { restoreBaseline } from './baseline'

await restoreBaseline(process.env.DATABASE_URL_TEST!)
