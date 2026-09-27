// Legt das eine Admin-Konto an (ARCHITEKTUR §8.4, E-03). E-Mail und Passwort werden interaktiv abgefragt – nie als
// Argument (landet sonst in der Shell-Historie). Aufruf: pnpm admin:create
import 'dotenv/config'

import { promptLine } from './lib/prompt'

async function main(): Promise<void> {
  if (process.argv.length > 2) {
    throw new Error('admin:create nimmt keine Argumente – E-Mail und Passwort werden abgefragt.')
  }
  const email = await promptLine('E-Mail-Adresse: ')
  const password = await promptLine('Passwort (mind. 12 Zeichen): ', { hidden: true })
  const repeat = await promptLine('Passwort wiederholen: ', { hidden: true })
  if (password !== repeat) throw new Error('Die Passwörter stimmen nicht überein.')
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const { createAdminAccount } = await import('./lib/admin')
  const payload = await getPayload({ config })
  try {
    const user = await createAdminAccount(payload, { email, password })
    console.log(`admin:create: Konto ${user.email} angelegt.`)
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
