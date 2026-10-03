import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const SKIP = new Set([
  'node_modules',
  '.next',
  '.next-preview',
  '.next-art',
  'artifacts',
  '.git',
  'dist',
  '.data',
])

/** Alle Dateien unter `dir` (relativ zu root, mit `/`), gefiltert nach Endung. */
export function listFiles(
  root: string,
  dir: string,
  exts = ['.ts', '.tsx', '.js', '.mjs', '.cjs'],
): string[] {
  const out: string[] = []
  const abs = path.join(root, dir)
  let entries: string[]
  try {
    entries = readdirSync(abs)
  } catch {
    return out
  }
  for (const name of entries) {
    if (SKIP.has(name)) continue
    const rel = `${dir}/${name}`
    const st = statSync(path.join(root, rel))
    if (st.isDirectory()) out.push(...listFiles(root, rel, exts))
    else if (exts.some((e) => name.endsWith(e))) out.push(rel)
  }
  return out
}

export const readText = (root: string, rel: string) => readFileSync(path.join(root, rel), 'utf8')
