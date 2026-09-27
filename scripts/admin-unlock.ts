// Hebt die Login-Sperre des Admin-Kontos auf (ARCHITEKTUR §8.4, Notfall-Runbook). Aufruf: pnpm admin:unlock
import 'dotenv/config'

async function main(): Promise<void> {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const { unlockAdminAccounts } = await import('./lib/admin')
  const payload = await getPayload({ config })
  try {
    const n = await unlockAdminAccounts(payload)
    console.log(
      n > 0 ? 'admin:unlock: Sperre aufgehoben.' : 'admin:unlock: Es gibt noch kein Konto.',
    )
  } finally {
    await payload.destroy()
  }
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  },
)
