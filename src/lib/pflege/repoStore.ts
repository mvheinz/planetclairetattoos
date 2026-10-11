import 'server-only'

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { snapshotSchema, type ListKind, type ListSnapshot } from './snapshot'

// Gemerkte Stände vor dem Start (U-89 a): eine JSON-Datei je ausgegebener Liste unter `content/pflege/stand/`. Die
// Sitzung, die eine Liste ausgibt, committet den Stand mit – sonst findet die nächste Sitzung ihn beim Zurückspielen
// nicht (RUNBOOK „Jutta schickt eine Excel-Liste“).

export const PFLEGE_STAND_DIR = path.join('content', 'pflege', 'stand')

const fileOf = (root: string, id: string) => path.join(root, PFLEGE_STAND_DIR, `${id}.json`)

export async function saveSnapshot(root: string, s: ListSnapshot): Promise<string> {
  const file = fileOf(root, s.id)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(s, null, 1)}\n`)
  return file
}

export async function loadSnapshot(root: string, id: string): Promise<ListSnapshot | null> {
  let raw: string
  try {
    raw = await readFile(fileOf(root, id), 'utf8')
  } catch {
    return null
  }
  return snapshotSchema.parse(JSON.parse(raw)) as ListSnapshot
}

/** Listen-Nr. einer Art an einem Tag (für Dateinamen ohne Listen-Nr.: nur eindeutig verwendbar). */
export async function snapshotIdsOn(root: string, kind: ListKind, day: string): Promise<string[]> {
  const prefix = `${kind === 'bestand' ? 'B' : 'T'}-${day}-`
  try {
    return (await readdir(path.join(root, PFLEGE_STAND_DIR)))
      .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .sort()
  } catch {
    return []
  }
}
