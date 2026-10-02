// Erzeugt src/lib/legal/services.generated.ts aus der YAML in docs/recht/DIENSTE.md §7 (PLAN P6.21, R-155, R-131).
// Aufruf: pnpm legal:services. `pnpm check:static` (generated-files) erzeugt die Datei neu und meldet Abweichungen.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { format, resolveConfig } from 'prettier'
import { parse } from 'yaml'
import { z } from 'zod'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const DIENSTE_PATH = 'docs/recht/DIENSTE.md'
export const SERVICES_OUT = 'src/lib/legal/services.generated.ts'

const CSP_CONTEXTS = ['public', 'dynamic', 'checkout', 'admin', 'api'] as const
const hosts = z.array(z.string().min(1))

export const serviceSchema = z.strictObject({
  id: z.string().regex(/^[a-z][A-Za-z0-9]{1,59}$/),
  name: z.string().min(1),
  seat: z.strictObject({ de: z.string().min(1), en: z.string().min(1) }),
  role: z.enum(['processor', 'controller', 'processorAndController', 'none']),
  avv: z.enum(['required', 'coveredBy', 'notRequired', 'notAvailable']),
  avvCoveredBy: z.string().optional(),
  production: z.boolean(),
  personalData: z.enum(['yes', 'minimal', 'no']),
  thirdCountry: z.enum(['US', 'EU', 'none']),
  activeFrom: z.string().regex(/^P\d+$/),
  driverEnv: z.string().nullable(),
  csp: z.partialRecord(z.enum(CSP_CONTEXTS), z.record(z.string(), hosts)),
  serverHosts: hosts,
})

export const servicesDocSchema = z
  .strictObject({ version: z.literal(1), services: z.array(serviceSchema).min(1) })
  .superRefine((doc, ctx) => {
    const ids = new Set<string>()
    for (const s of doc.services) {
      if (ids.has(s.id)) ctx.addIssue({ code: 'custom', message: `doppelte id ${s.id}` })
      ids.add(s.id)
    }
    for (const s of doc.services) {
      if (s.avv === 'coveredBy' && (!s.avvCoveredBy || !ids.has(s.avvCoveredBy))) {
        ctx.addIssue({ code: 'custom', message: `${s.id}: avvCoveredBy fehlt oder unbekannt` })
      }
    }
  })
export type ServicesDoc = z.infer<typeof servicesDocSchema>

/** Liest den einzigen YAML-Block aus DIENSTE.md und prüft die Felder. */
export function parseServicesYaml(markdown: string): ServicesDoc {
  const blocks = [...markdown.matchAll(/```yaml\n([\s\S]*?)```/g)]
  if (blocks.length !== 1) {
    throw new Error(`${DIENSTE_PATH}: genau ein YAML-Block erwartet, gefunden ${blocks.length}`)
  }
  const res = servicesDocSchema.safeParse(parse(blocks[0]![1]!))
  if (!res.success) {
    throw new Error(`${DIENSTE_PATH} §7: ${res.error.issues.map((i) => i.message).join('; ')}`)
  }
  return res.data
}

/** Quelltext des erzeugten Moduls (mit Prettier formatiert, damit `format:check` grün bleibt). */
export async function renderServicesModule(markdown: string): Promise<string> {
  const doc = parseServicesYaml(markdown)
  const services = doc.services.map((s) => ({
    ...s,
    avvCoveredBy: s.avvCoveredBy ?? null,
    csp: s.csp,
  }))
  const src = `import 'server-only'

// ERZEUGT von scripts/legal/gen-services.ts aus ${DIENSTE_PATH} §7 – nicht von Hand ändern (pnpm legal:services).
// Quelle für Einstellungen → „Auftragsverarbeitung“ (R-155), die Auftragsverarbeiter-Tabelle unter der
// Datenschutzerklärung (\`ProcessorTable\`, kein Token) und den CSP-Abgleich (T-16, R-131).

export type ServiceRole = 'processor' | 'controller' | 'processorAndController' | 'none'
export type ServiceAvv = 'required' | 'coveredBy' | 'notRequired' | 'notAvailable'
export type ServiceThirdCountry = 'US' | 'EU' | 'none'
export type ServiceCspContext = ${CSP_CONTEXTS.map((c) => `'${c}'`).join(' | ')}

export interface ServiceEntry {
  id: string
  name: string
  seat: { de: string; en: string }
  role: ServiceRole
  avv: ServiceAvv
  avvCoveredBy: string | null
  production: boolean
  personalData: 'yes' | 'minimal' | 'no'
  thirdCountry: ServiceThirdCountry
  activeFrom: string
  driverEnv: string | null
  csp: Partial<Record<ServiceCspContext, Record<string, readonly string[]>>>
  serverHosts: readonly string[]
}

export const SERVICES_YAML_VERSION = ${doc.version}

export const SERVICES: readonly ServiceEntry[] = ${JSON.stringify(services, null, 2)}
`
  const config = (await resolveConfig(path.join(ROOT, SERVICES_OUT))) ?? {}
  return format(src, { ...config, filepath: path.join(ROOT, SERVICES_OUT) })
}

async function main(): Promise<void> {
  const md = readFileSync(path.join(ROOT, DIENSTE_PATH), 'utf8')
  writeFileSync(path.join(ROOT, SERVICES_OUT), await renderServicesModule(md))
  console.log(`${SERVICES_OUT} erzeugt`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    console.error((err as Error).message)
    process.exit(1)
  })
}
