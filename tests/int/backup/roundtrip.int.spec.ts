import { spawnSync } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'

import { generateIdentity, identityToRecipient } from 'age-encryption'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { decryptStream, AGE_MAGIC } from '@/lib/backup/crypto'
import { createDumpStream } from '@/lib/backup/dump'
import { runBackup } from '@/lib/backup/run'
import { restoreFromCipher, RestoreError } from '@/lib/backup/restore'
import { PRODUCTION_DB_COMMENT } from '@/lib/db/guard'
import { runMigrations } from '../../../scripts/db-reset'

import { getTestPayload } from '../helpers/payload'

// P10.8 Backup I (ARCHITEKTUR §10.3/§10.5, Spike B-06): Rundlauf mit Wegwerf-Schlüssel – synthetische Daten, kein
// Produktionszugang (A-12). AK-A-10-01, AK-A-10-02, AK-A-10-05.

const SOURCE = process.env.DATABASE_URL_TEST as string
const withDb = (url: string, name: string) => {
  const u = new URL(url)
  u.pathname = `/${name}`
  return u.toString()
}
const TARGET_NAME = `${new URL(SOURCE).pathname.slice(1)}_restore`
const TARGET = withDb(SOURCE, TARGET_NAME)

let dir: string
let identity: string
let recipient: string
let backupFile: string
let identityFile: string
let sourceEmail = ''

async function admin<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: withDb(SOURCE, 'postgres') })
  await c.connect()
  try {
    return await fn(c)
  } finally {
    await c.end()
  }
}

async function onTarget<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: TARGET })
  await c.connect()
  try {
    return await fn(c)
  } finally {
    await c.end()
  }
}

const readAll = async (s: Readable) => {
  const chunks: Buffer[] = []
  for await (const c of s as AsyncIterable<Buffer>) chunks.push(c)
  return Buffer.concat(chunks)
}

/** Klartext des Backups (age → gunzip). */
const plaintextOf = async (file: string) =>
  (await readAll(await decryptStream(createReadStream(file), identity))).toString('utf8')

/** Ohne Zeile 2 (Kopf mit `createdAt`). */
const withoutHeader = (text: string) =>
  text
    .split('\n')
    .filter((_, i) => i !== 1)
    .join('\n')

beforeAll(async () => {
  const payload = await getTestPayload()
  const users = await payload.find({
    collection: 'users',
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  sourceEmail = String((users.docs[0] as { email?: string } | undefined)?.email ?? '')
  dir = await mkdtemp(path.join(os.tmpdir(), 'pc-backup-'))
  identity = await generateIdentity()
  recipient = await identityToRecipient(identity)
  identityFile = path.join(dir, 'key.txt')
  await writeFile(identityFile, `# created\n# public key: ${recipient}\n${identity}\n`)
  backupFile = path.join(dir, 'backup.pcdump.gz.age')

  // Zieldatenbank neu anlegen und migrieren (§10.5 Schritt 2 und 3 b).
  await admin(async (c) => {
    await c.query(`DROP DATABASE IF EXISTS "${TARGET_NAME}" WITH (FORCE)`)
    await c.query(`CREATE DATABASE "${TARGET_NAME}"`)
  })
  runMigrations(TARGET)
}, 280_000)

afterAll(async () => {
  await admin((c) => c.query(`DROP DATABASE IF EXISTS "${TARGET_NAME}" WITH (FORCE)`)).catch(
    () => undefined,
  )
  await rm(dir, { recursive: true, force: true })
}, 60_000)

describe('Backup-Rundlauf (pcdump v1)', () => {
  it('AK-A-10-02 backup:run schreibt eine age-Datei ohne Klartext (keine E-Mail-Adresse, kein pcdump-Kopf)', async () => {
    const res = await runBackup({
      connectionString: SOURCE,
      recipient,
      appVersion: 'test123',
      now: new Date('2026-10-05T01:30:00Z'),
      target: { kind: 'file', path: backupFile },
    })
    expect(res.tables).toBeGreaterThan(20)
    expect(res.rows).toBeGreaterThan(0)
    const raw = await readFile(backupFile)
    expect(raw.subarray(0, AGE_MAGIC.length).toString('latin1')).toBe(AGE_MAGIC)
    expect(raw.length).toBe(res.sizeBytes)
    expect(raw.includes(Buffer.from('pcdump'))).toBe(false)
    if (sourceEmail) expect(raw.includes(Buffer.from(sourceEmail))).toBe(false)
    // rate_limit_hits ist nie im Dump (R-134)
    const text = await plaintextOf(backupFile)
    expect(text).not.toContain('"rate_limit_hits"')
    expect(text.startsWith('-- pcdump 1\n')).toBe(true)
    if (sourceEmail) expect(text).toContain(sourceEmail)
  }, 120_000)

  it('AK-A-10-01 Wiederherstellung in eine leere DB: Zeilenzahl und md5 je Tabelle, Sequenzen, Fremdschlüssel, Trigger', async () => {
    const before = await plaintextOf(backupFile)
    const fkCount = `SELECT count(*)::int AS n FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace`
    const trgCount = `SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace AND t.tgenabled='O'`
    const [fkBefore, trgBefore] = await onTarget(async (c) => [
      (await c.query(fkCount)).rows[0].n as number,
      (await c.query(trgCount)).rows[0].n as number,
    ])
    const res = await restoreFromCipher({
      cipher: createReadStream(backupFile),
      identity,
      targetUrl: TARGET,
    })
    expect(res.tables.length).toBeGreaterThan(20)
    // erneuter Dump des Ziels = Dump der Quelle (bis auf den Kopf)
    const { stream } = createDumpStream({
      connectionString: TARGET,
      appVersion: 'test123',
      now: new Date(),
      excludeTables: [],
    })
    const after = (await readAll(stream)).toString('utf8')
    expect(withoutHeader(after)).toBe(withoutHeader(before))
    await onTarget(async (c) => {
      expect((await c.query(fkCount)).rows[0].n).toBe(fkBefore)
      expect((await c.query(trgCount)).rows[0].n).toBe(trgBefore)
      // Sequenzen ≥ größter Id jeder Tabelle mit serieller Id
      const seqs = await c.query<{ tbl: string; seq: string }>(
        `SELECT c.relname AS tbl, pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), 'id') AS seq
           FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r' AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='id' AND a.attnum>0)`,
      )
      let checked = 0
      for (const s of seqs.rows.filter((r) => r.seq)) {
        const max = (
          await c.query(`SELECT coalesce(max(id),0)::bigint AS m FROM public."${s.tbl}"`)
        ).rows[0].m
        const next = (await c.query(`SELECT nextval('${s.seq}')::bigint AS v`)).rows[0].v
        expect(BigInt(next), s.tbl).toBeGreaterThan(BigInt(max))
        checked++
      }
      expect(checked).toBeGreaterThan(10)
    })
  }, 240_000)

  it('AK-A-10-05 zwei Dumps desselben Stands sind bis auf die Kopfzeile byte-gleich', async () => {
    const dump = async () =>
      (
        await readAll(
          createDumpStream({ connectionString: TARGET, appVersion: 'v', now: new Date() }).stream,
        )
      ).toString('utf8')
    const a = await dump()
    const b = await dump()
    expect(withoutHeader(a)).toBe(withoutHeader(b))
  }, 120_000)

  async function resetTarget() {
    await onTarget(async (c) => {
      const t = await c.query<{ relname: string }>(
        `SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname <> 'payload_migrations'`,
      )
      await c.query(
        `TRUNCATE ${t.rows.map((r) => `public."${r.relname}"`).join(', ')} RESTART IDENTITY CASCADE`,
      )
    })
  }

  it('AK-A-10-05 Dump ohne -- pcdump-end wird abgelehnt und das Ziel bleibt leer (Rollback)', async () => {
    await resetTarget()
    const text = await plaintextOf(backupFile)
    const cut = text.slice(0, text.lastIndexOf('-- pcdump-end'))
    await expect(
      import('@/lib/backup/restore').then((m) =>
        m.restoreDump({ plain: Readable.from([Buffer.from(cut)]), targetUrl: TARGET }),
      ),
    ).rejects.toThrow(/unvollständig/)
    await onTarget(async (c) => {
      expect((await c.query('SELECT count(*)::int AS n FROM public.users')).rows[0].n).toBe(0)
    })
  }, 120_000)

  it('verfälschte Prüfsumme (md5) wird abgelehnt; Ziel bleibt leer', async () => {
    const text = await plaintextOf(backupFile)
    const tampered = text.replace(
      /"md5":"[0-9a-f]{32}"/,
      '"md5":"00000000000000000000000000000000"',
    )
    expect(tampered).not.toBe(text)
    await expect(
      import('@/lib/backup/restore').then((m) =>
        m.restoreDump({ plain: Readable.from([Buffer.from(tampered)]), targetUrl: TARGET }),
      ),
    ).rejects.toThrow(RestoreError)
    await onTarget(async (c) => {
      expect((await c.query('SELECT count(*)::int AS n FROM public.users')).rows[0].n).toBe(0)
    })
  }, 120_000)

  it('falscher Schlüssel: Entschlüsselung scheitert, nichts wird geladen', async () => {
    const other = await generateIdentity()
    await expect(
      restoreFromCipher({
        cipher: createReadStream(backupFile),
        identity: other,
        targetUrl: TARGET,
      }),
    ).rejects.toThrow()
    await onTarget(async (c) => {
      expect((await c.query('SELECT count(*)::int AS n FROM public.users')).rows[0].n).toBe(0)
    })
  }, 120_000)

  it('nicht leeres Ziel und als Produktion markiertes Ziel werden verweigert', async () => {
    await restoreFromCipher({ cipher: createReadStream(backupFile), identity, targetUrl: TARGET })
    await expect(
      restoreFromCipher({ cipher: createReadStream(backupFile), identity, targetUrl: TARGET }),
    ).rejects.toThrow(/nicht leer/)
    await resetTarget()
    await admin((c) =>
      c.query(`COMMENT ON DATABASE "${TARGET_NAME}" IS '${PRODUCTION_DB_COMMENT}'`),
    )
    try {
      await expect(
        restoreFromCipher({ cipher: createReadStream(backupFile), identity, targetUrl: TARGET }),
      ).rejects.toThrow(/Produktion/)
    } finally {
      await admin((c) => c.query(`COMMENT ON DATABASE "${TARGET_NAME}" IS NULL`))
    }
  }, 240_000)

  it('Skripte: backup:run → backup:verify → backup:restore laufen über die Kommandozeile', async () => {
    await resetTarget()
    const out = path.join(dir, 'cli.age')
    const env = { ...process.env, DATABASE_URL: SOURCE, DATABASE_URL_UNPOOLED: SOURCE }
    const run = spawnSync(
      'pnpm',
      ['-s', 'backup:run', `--to=file:${out}`, `--recipient=${recipient}`],
      { env, encoding: 'utf8' },
    )
    expect(run.status, run.stderr).toBe(0)
    const sha = /sha256 ([0-9a-f]{64})/.exec(run.stdout)![1]!
    const verify = spawnSync('pnpm', ['-s', 'backup:verify', `--input=${out}`, `--sha256=${sha}`], {
      env,
      encoding: 'utf8',
    })
    expect(verify.status, verify.stderr).toBe(0)
    const bad = spawnSync(
      'pnpm',
      ['-s', 'backup:verify', `--input=${out}`, `--sha256=${'0'.repeat(64)}`],
      { env, encoding: 'utf8' },
    )
    expect(bad.status).toBe(1)
    const restore = spawnSync(
      'pnpm',
      [
        '-s',
        'backup:restore',
        `--input=${out}`,
        `--identity=${identityFile}`,
        `--target=${TARGET}`,
        '--skip-migrate',
      ],
      { env, encoding: 'utf8' },
    )
    expect(restore.status, restore.stderr).toBe(0)
    expect(restore.stdout).toContain('wiederhergestellt')
  }, 240_000)
})
