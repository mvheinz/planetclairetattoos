// Import-Hook: `server-only` in tsx-/payload-CLI-Skripten auflösbar machen (ARCHITEKTUR §2.2, ADR 0001).
// Außerhalb von Next.js gibt es keine react-server-Bedingung; das Paket würde sonst beim Import werfen.
import { register } from 'node:module'

const stub = new URL('./server-only-stub.mjs', import.meta.url).href

register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: ${JSON.stringify(stub)}, shortCircuit: true, format: 'module' }
  return next(specifier, context)
}`),
  import.meta.url,
)
