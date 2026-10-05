// Backup prüfen, ohne zu entschlüsseln (ARCHITEKTUR §10.3): pnpm backup:verify --key=<db/…> | --input=<datei> [--sha256=<hex>]
// Existiert das Objekt, beginnt es mit `age-encryption.org/v1`, passt der SHA-256 zu `x-amz-meta-sha256` (bzw. --sha256)?
import 'dotenv/config'

import { createReadStream } from 'node:fs'

export function parseBackupVerifyArgs(argv: readonly string[]): {
  key: string | null
  input: string | null
  sha256: string | null
} {
  const out = {
    key: null as string | null,
    input: null as string | null,
    sha256: null as string | null,
  }
  for (const a of argv) {
    if (a.startsWith('--key=')) out.key = a.slice(6)
    else if (a.startsWith('--input=')) out.input = a.slice(8)
    else if (a.startsWith('--sha256=')) out.sha256 = a.slice(9)
    else throw new Error(`Unbekannte Option: ${a}`)
  }
  if (!out.key === !out.input)
    throw new Error('Genau eine Quelle angeben: --key=<db/…> oder --input=<datei>.')
  return out
}

async function main(): Promise<void> {
  const args = parseBackupVerifyArgs(process.argv.slice(2))
  const { sha256Of } = await import('../src/lib/backup/restore')
  const { AGE_MAGIC } = await import('../src/lib/backup/crypto')
  let stream: AsyncIterable<Buffer>
  let expected = args.sha256
  let label: string
  if (args.input) {
    stream = createReadStream(args.input)
    label = args.input
  } else {
    const { getEnv } = await import('../src/lib/env')
    const { getBackupS3 } = await import('../src/lib/backup/s3')
    const { GetObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3')
    const { client, bucket } = getBackupS3(getEnv())
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: args.key as string }),
    )
    expected = expected ?? head.Metadata?.sha256 ?? null
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: args.key as string }))
    stream = res.Body as AsyncIterable<Buffer>
    label = args.key as string
  }
  const r = await sha256Of(stream)
  const problems: string[] = []
  if (!r.head.toString('latin1').startsWith(AGE_MAGIC))
    problems.push('beginnt nicht mit age-encryption.org/v1')
  if (expected && expected !== r.sha256) problems.push(`sha256 ${r.sha256} ≠ erwartet ${expected}`)
  if (!expected) problems.push('kein SHA-256 zum Vergleich (Metadaten fehlen, --sha256 angeben)')
  if (problems.length) throw new Error(`backup:verify ${label}: ${problems.join('; ')}`)
  console.log(`backup:verify: ${label} ok (${r.sizeBytes} Bytes, sha256 ${r.sha256})`)
}

if (process.argv[1]?.endsWith('backup-verify.ts')) {
  main().then(
    () => process.exit(0),
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : e)
      process.exit(1)
    },
  )
}
