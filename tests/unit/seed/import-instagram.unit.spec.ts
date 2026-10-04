import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  collectJsonMedia,
  describeExportFile,
  importInstagramExport,
  kindFromUri,
  NO_EXPORT_MESSAGE,
  serializeMap,
} from '../../../scripts/seed/import-instagram'

// P8.10: Import-Skript für Juttas Instagram-Datenexport gegen eine fiktive Mini-Export-Struktur nach Instagram-Format
// (tests/fixtures/instagram-export/): hochskalierte Kopien zweier Seed-Bilder (DaDz8yljp3i lose im Monatsordner,
// DdHXUQsDjqm in einer ZIP-Datei), eine Story-Kopie im selben Monatsordner, ein fremdes Bild vom selben Tag wie die
// Cap, `posts_1.json`/`stories.json`, Video-Attrappen und `LIESMICH.txt`. Keine echten Daten, kein Netz.

const REPO = process.cwd()
const FIXTURE = path.join(REPO, 'tests/fixtures/instagram-export')
const MANIFEST = path.join(REPO, 'content/seed/instagram/manifest.json')
const EXPORT = 'content/seed/instagram-export'
const MAP = 'content/seed/instagram-export-map.json'
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')

const roots: string[] = []
afterEach(async () => {
  for (const r of roots.splice(0)) await rm(r, { recursive: true, force: true })
})

/** Leere Projektwurzel mit `content/seed/instagram-export/` (optional mit der Fixture). */
async function project(withFixture = true): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'pc-ig-'))
  roots.push(root)
  await mkdir(path.join(root, EXPORT), { recursive: true })
  if (withFixture) await cp(FIXTURE, path.join(root, EXPORT), { recursive: true })
  else await writeFile(path.join(root, EXPORT, 'LIESMICH.txt'), 'Hier kommt der Export hin.\n')
  return root
}

const run = (root: string) => importInstagramExport({ root, manifestFile: MANIFEST })

async function filesUnder(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) out.push(path.join(e.parentPath, e.name))
  }
  return out
}

describe('Instagram-Export: Formen und Zuordnung (P8.10)', () => {
  it('ohne Export: Meldung, Exit-Zweig ohne Schreiben, Map unverändert', async () => {
    const root = await project(false)
    const before = serializeMap({ entries: {} })
    await writeFile(path.join(root, MAP), before)
    const res = await run(root)
    expect(res.found).toBe(false)
    expect(res.lines).toEqual([NO_EXPORT_MESSAGE])
    expect(NO_EXPORT_MESSAGE).toBe(
      'Kein Instagram-Export gefunden – die Beispielbilder (640 px) bleiben.',
    )
    expect(await readFile(path.join(root, MAP), 'utf8')).toBe(before)
    expect(existsSync(path.join(root, '.data'))).toBe(false)
  })

  it('mit Export: richtige Zuordnung (Monatsordner + ZIP), fremdes Bild und Story nicht gemappt, Video ignoriert, Bericht je Kürzel', async () => {
    const root = await project()
    const res = await run(root)
    expect(res.found).toBe(true)
    expect(Object.keys(res.map.entries).sort()).toEqual(['DaDz8yljp3i', 'DdHXUQsDjqm'])
    const fox = res.map.entries.DaDz8yljp3i!
    expect(fox).toMatchObject({
      path: `${EXPORT}/202606/17841400000000001.jpg`,
      width: 1080,
      height: 1080,
      override: null,
    })
    expect(fox.distance).toBeLessThanOrEqual(10)
    expect(fox.sha256).toBe(sha(await readFile(path.join(FIXTURE, '202606/17841400000000001.jpg'))))
    // ZIP nach .data/instagram-export/ entpackt (nur Bilder und JSON, keine Videos)
    const cap = res.map.entries.DdHXUQsDjqm!
    expect(cap.path).toBe(
      '.data/instagram-export/instagram-planet.claire.tattoos-2026-10-01-part1/media/posts/202609/17841400000000003.jpg',
    )
    expect([cap.width, cap.height]).toEqual([960, 1280])
    const extracted = await filesUnder(path.join(root, '.data/instagram-export'))
    expect(extracted.some((f) => f.endsWith('.mp4'))).toBe(false)
    // Fremdes Bild vom selben Tag wie die Cap: nicht gemappt.
    expect(Object.values(res.map.entries).some((e) => e.path?.endsWith('004.jpg'))).toBe(false)
    // Bericht „gemappt / nicht gefunden / mehrdeutig“ je Kürzel
    expect(res.status.DaDz8yljp3i).toBe('gemappt')
    expect(res.status.DdHXUQsDjqm).toBe('gemappt')
    expect(res.status.DcrENrOjlGP).toBe('nicht gefunden')
    expect(Object.keys(res.status)).toHaveLength(12) // 11 Beiträge + 1 Reel-Cover, keine Highlights/kein Profil
    expect(res.lines.join('\n')).toContain('2 gemappt, 10 nicht gefunden, 0 mehrdeutig')
    expect(res.lines.join('\n')).not.toMatch(/highlight|profil/)
  })

  it('zweiter Lauf ändert nichts (Map byte-gleich, ZIP nicht erneut entpackt)', async () => {
    const root = await project()
    await run(root)
    const first = await readFile(path.join(root, MAP), 'utf8')
    const second = await run(root)
    expect(second.changed).toBe(false)
    expect(await readFile(path.join(root, MAP), 'utf8')).toBe(first)
    expect(second.lines.join('\n')).toContain('Map unverändert')
  })

  it('Zuordnung unabhängig vom Ordner: ältere Uploads mit media/posts/…-Pfaden und JSON an anderer Stelle', async () => {
    const reference = await run(await project())
    const root = await project()
    const dir = path.join(root, EXPORT)
    await mkdir(path.join(dir, 'alt/media/posts'), { recursive: true })
    await rename(path.join(dir, '202606'), path.join(dir, 'alt/media/posts/202606'))
    await rename(path.join(dir, 'your_instagram_activity'), path.join(dir, 'json-teil-2'))
    const res = await run(root)
    expect(res.map.entries.DaDz8yljp3i!.path).toBe(
      `${EXPORT}/alt/media/posts/202606/17841400000000001.jpg`,
    )
    for (const code of ['DaDz8yljp3i', 'DdHXUQsDjqm']) {
      expect(res.map.entries[code]!.sha256, code).toBe(reference.map.entries[code]!.sha256)
    }
  })

  it('Story über die JSON-uri erkannt: ohne stories.json ist die Story-Kopie ein zweiter Kandidat (mehrdeutig)', async () => {
    const root = await project()
    await rm(path.join(root, EXPORT, 'your_instagram_activity/content/stories.json'))
    const res = await run(root)
    expect(res.status.DaDz8yljp3i).toBe('mehrdeutig')
    expect(res.map.entries.DaDz8yljp3i).toBeUndefined()
    expect(res.lines.join('\n')).toMatch(/DaDz8yljp3i: mehrdeutig \(2 Kandidaten/)
  })

  it('override hat Vorrang vor dem Hash-Treffer und bleibt beim nächsten Lauf stehen', async () => {
    const root = await project()
    await run(root)
    const map = JSON.parse(await readFile(path.join(root, MAP), 'utf8')) as {
      entries: Record<string, Record<string, unknown>>
    }
    const foreign = `${EXPORT}/media/posts/202609/17841400000000004.jpg`
    map.entries.DaDz8yljp3i!.override = foreign
    map.entries.DcrENrOjlGP = { override: foreign }
    await writeFile(path.join(root, MAP), JSON.stringify(map))
    const res = await run(root)
    expect(res.status.DaDz8yljp3i).toBe('override')
    expect(res.status.DcrENrOjlGP).toBe('override')
    expect(res.map.entries.DaDz8yljp3i).toMatchObject({ path: foreign, override: foreign })
    expect(res.map.entries.DaDz8yljp3i!.sha256).toBe(
      sha(await readFile(path.join(FIXTURE, 'media/posts/202609/17841400000000004.jpg'))),
    )
    expect((await run(root)).changed).toBe(false)
  })
})

describe('Instagram-Export: Bausteine', () => {
  it('Art aus der uri; JSON in jeder Struktur (posts_1.json, ig_stories) mit geerbtem Zeitstempel', () => {
    expect(kindFromUri('media/posts/202607/1.jpg')).toBe('post')
    expect(kindFromUri('media/stories/202607/2.jpg')).toBe('story')
    expect(kindFromUri('media/reels/202607/3.mp4')).toBe('reel')
    expect(kindFromUri('media/profile/202601/4.jpg')).toBe('profile')
    expect(kindFromUri('irgendwo/5.jpg')).toBeNull()
    const json = collectJsonMedia([
      { creation_timestamp: 1_752_000_000, media: [{ uri: 'media/posts/202607/a.jpg' }] },
      { ig_stories: [{ uri: 'media/stories/202607/b.jpg', creation_timestamp: 1_752_100_000 }] },
    ])
    expect(json.get('a.jpg')).toEqual({ kind: 'post', timestamp: 1_752_000_000 })
    expect(json.get('b.jpg')).toEqual({ kind: 'story', timestamp: 1_752_100_000 })
  })

  it('ohne JSON: Datum aus dem Monatsordner, Art offen; mit JSON: Zeitpunkt und Art aus dem JSON', () => {
    const none = describeExportFile('content/seed/instagram-export/202607/x.jpg', new Map())
    expect(none.kind).toBeNull()
    expect(new Date(none.from!).toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(new Date(none.to!).toISOString()).toBe('2026-07-31T23:59:59.999Z')
    expect(describeExportFile('lose/x.jpg', new Map())).toEqual({
      kind: null,
      from: null,
      to: null,
    })
    const json = new Map([['x.jpg', { kind: 'story' as const, timestamp: 1_752_000_000 }]])
    expect(describeExportFile('202607/x.jpg', json)).toEqual({
      kind: 'story',
      from: 1_752_000_000_000,
      to: 1_752_000_000_000,
    })
  })

  it('kein Inhalt der Fixture liegt unter public/ oder .next/static (SHA-256)', async () => {
    const fixture = new Set<string>()
    for (const f of await filesUnder(FIXTURE)) fixture.add(sha(await readFile(f)))
    for (const dir of ['public', '.next/static']) {
      for (const f of await filesUnder(path.join(REPO, dir))) {
        if (!/\.(jpe?g|png|webp|avif)$/i.test(f)) continue
        expect(fixture.has(sha(await readFile(f))), f).toBe(false)
      }
    }
  })
})
