import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { generateIdentity, identityToRecipient, Decrypter } from 'age-encryption'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { MISSING_GRACE_MS, runMirror } from '@/lib/backup/mirror'
import { dirMirror, localSource, sha256Key, type MirrorStore } from '@/lib/backup/stores'

// P10.9 – Datei-Spiegel (ARCHITEKTUR §10.4, AK-A-10-02): Spiegel-Schlüssel sind SHA-256-Hashes ohne Dateinamen, Inhalt
// age-verschlüsselt, inkrementell, Pending übersprungen, Löschungen wirken nach 7 Tagen, Zeitbudget begrenzt den Lauf.

let src: string
let dst: string
let identity: string
let recipient: string
const NOW = new Date('2033-03-01T01:30:00.000Z')

const write = async (rel: string, text: string, mtime = new Date('2020-02-01T00:00:00Z')) => {
  const f = path.join(src, rel)
  await mkdir(path.dirname(f), { recursive: true })
  await writeFile(f, text)
  await utimes(f, mtime, mtime)
}
const run = (over: Partial<Parameters<typeof runMirror>[0]> = {}) =>
  runMirror({
    source: localSource({ STORAGE_LOCAL_DIR: src }),
    mirror: dirMirror(dst),
    recipient,
    areas: ['private'],
    now: NOW,
    budgetMs: 60_000,
    ...over,
  })
const keys = async (m: MirrorStore = dirMirror(dst)) =>
  (await m.list('files/')).map((o) => o.key).sort()

beforeAll(async () => {
  identity = await generateIdentity()
  recipient = await identityToRecipient(identity)
})
beforeAll(async () => {
  src = await mkdtemp(path.join(os.tmpdir(), 'pc-mir-src-'))
  dst = await mkdtemp(path.join(os.tmpdir(), 'pc-mir-dst-'))
})
afterAll(async () => {
  await rm(src, { recursive: true, force: true })
  await rm(dst, { recursive: true, force: true })
})

describe('Datei-Spiegel (§10.4)', () => {
  it('AK-A-10-02 Spiegel-Schlüssel sind SHA-256-Hashes ohne Dateinamen; Inhalt age-verschlüsselt und entschlüsselbar', async () => {
    await write('private/rechnung-geheim-mueller.pdf', 'PDF-INHALT')
    const r = await run()
    expect(r.copied).toBe(1)
    const k = await keys()
    expect(k).toEqual([`files/private/${sha256Key('private/rechnung-geheim-mueller.pdf')}.age`])
    expect(k.join()).not.toContain('mueller')
    const cipher = await readFile(path.join(dst, k[0]!))
    expect(cipher.subarray(0, 21).toString()).toBe('age-encryption.org/v1')
    const d = new Decrypter()
    d.addIdentity(identity)
    expect(Buffer.from(await d.decrypt(new Uint8Array(cipher))).toString()).toBe('PDF-INHALT')
  })

  it('inkrementell: zweiter Lauf kopiert nichts; geänderte Quelle wird neu kopiert', async () => {
    expect((await run()).copied).toBe(0)
    await write('private/rechnung-geheim-mueller.pdf', 'NEU', new Date('2020-02-20T00:00:00Z'))
    // Spiegel-Objekt ist von „jetzt“ (Dateisystem) – Quelle in die Zukunft setzen.
    const future = new Date(Date.now() + 60_000)
    await utimes(path.join(src, 'private/rechnung-geheim-mueller.pdf'), future, future)
    expect((await run()).copied).toBe(1)
    // Quelle wieder in die Vergangenheit (jünger als der Stand des Spiegels ist sie dann nicht mehr).
    const past = new Date('2020-03-01T00:00:00Z')
    await utimes(path.join(src, 'private/rechnung-geheim-mueller.pdf'), past, past)
  })

  it('Pending-Dateien werden übersprungen und nicht als fehlend markiert', async () => {
    await write('private/pending.pdf', 'X')
    const r = await run({ skipKeys: new Set(['private/pending.pdf']) })
    expect(r.skippedPending).toBe(1)
    expect(r.copied).toBe(0)
    expect(await keys()).not.toContain(`files/private/${sha256Key('private/pending.pdf')}.age`)
  })

  it('fehlende Quelle: Marker, nach 7 Tagen Löschung; wieder da → Marker weg', async () => {
    await write('private/weg.pdf', 'W')
    await run()
    const h = sha256Key('private/weg.pdf')
    await rm(path.join(src, 'private/weg.pdf'))
    const r1 = await run()
    expect(r1.markedMissing).toBe(1)
    expect(await keys()).toContain(`files/private/${h}.missing`)
    // Vor Ablauf nichts gelöscht.
    expect((await run({ now: new Date(Date.now() + 3 * 86_400_000) })).deleted).toBe(0)
    // Quelle kommt zurück → Marker verschwindet.
    await write('private/weg.pdf', 'W', new Date('2020-01-01T00:00:00Z'))
    await run()
    expect(await keys()).not.toContain(`files/private/${h}.missing`)
    // Erneut weg → nach 7 Tagen gelöscht.
    await rm(path.join(src, 'private/weg.pdf'))
    await run()
    const r3 = await run({ now: new Date(Date.now() + MISSING_GRACE_MS + 60_000) })
    expect(r3.deleted).toBe(1)
    expect(await keys()).not.toContain(`files/private/${h}.age`)
  })

  it('Zeitbudget: der Rest folgt im nächsten Lauf', async () => {
    for (const n of [1, 2, 3]) await write(`private/budget-${n}.pdf`, `B${n}`)
    let t = 0
    const r = await run({ budgetMs: 10, clock: () => (t += 6) })
    expect(r.remaining).toBeGreaterThan(0)
    expect(r.copied + r.remaining).toBe(3)
    const r2 = await run()
    expect(r2.remaining).toBe(0)
  })

  it('Bereiche: media nur, wenn angefordert', async () => {
    await write('media/bild.webp', 'M')
    expect(await keys()).not.toContain(`files/media/${sha256Key('media/bild.webp')}.age`)
    await run({ areas: ['media'] })
    expect(await keys()).toContain(`files/media/${sha256Key('media/bild.webp')}.age`)
  })
})
