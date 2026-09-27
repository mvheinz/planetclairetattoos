import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { OutboxRecord } from '@/lib/email/file'

// Test-Helfer für den Mail-Treiber `file` (ARCHITEKTUR §3.4): liest die `.json`-Metadaten aus EMAIL_FILE_DIR.

export type { OutboxRecord }

export async function readOutbox(
  filter: { to?: string; type?: string } = {},
  dir: string = process.env.EMAIL_FILE_DIR ?? '.data/mail-outbox',
): Promise<OutboxRecord[]> {
  const abs = path.resolve(process.cwd(), dir)
  let names: string[]
  try {
    names = await readdir(abs)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
  const records: OutboxRecord[] = []
  for (const name of names.filter((n) => n.endsWith('.json')).sort()) {
    const r = JSON.parse(await readFile(path.join(abs, name), 'utf8')) as OutboxRecord
    const to = filter.to?.toLowerCase()
    if (to && !r.to.some((a) => a.toLowerCase() === to)) continue
    if (filter.type && r.type !== filter.type) continue
    records.push(r)
  }
  return records
}
