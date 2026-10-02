import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { resetEnvCache } from '@/lib/env'
import { hashToken, sealToken, unsealToken } from '@/lib/security/tokens'
import { seedToken, seedTokenHash } from '@/lib/seed/tokens'

// P8.4: Seed-Token (SEED-SPEC §2.5, ARCHITEKTUR §8.6) – deterministisch aus dem seedKey, unabhängig von PAYLOAD_SECRET;
// das Siegel öffnet denselben Token; nur der Seed nutzt `seedToken` (echte Bestellungen und Kassen bekommen nie eins).

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

async function sourceFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await sourceFiles(p)))
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p)
  }
  return out
}

describe('seedToken', () => {
  it('liefert bei geändertem PAYLOAD_SECRET denselben Wert (Kasse und Status)', () => {
    const a = seedToken('checkouts:O14', 'checkout')
    const b = seedToken('orders:O10', 'status')
    vi.stubEnv('PAYLOAD_SECRET', 'ein-voellig-anderes-geheimnis-fuer-den-test-0123456789')
    resetEnvCache()
    expect(seedToken('checkouts:O14', 'checkout')).toBe(a)
    expect(seedToken('orders:O10', 'status')).toBe(b)
    expect(seedTokenHash('orders:O10', 'status')).toBe(hashToken(b))
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('unsealToken(sealToken(seedToken)) ergibt den Token; ein fremder Schlüssel öffnet das Siegel nicht', () => {
    const token = seedToken('orders:O13', 'status')
    expect(unsealToken(sealToken(token))).toBe(token)
    const foreign = sealToken(token, Buffer.alloc(32, 9))
    expect(() => unsealToken(foreign)).toThrow()
  })

  it('nie aus der Bestellnummer; außerhalb von src/lib/seed nutzt kein Code seedToken', async () => {
    expect(() => seedToken('PC-2026-90010', 'status')).toThrow()
    const files = await sourceFiles(path.join(process.cwd(), 'src'))
    const users = []
    for (const f of files) {
      const rel = path.relative(process.cwd(), f)
      if (rel.startsWith(path.join('src', 'lib', 'seed'))) continue
      const code = (await readFile(f, 'utf8'))
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      if (/\bseedToken(Hash)?\b/.test(code)) users.push(rel)
    }
    expect(users).toEqual([])
  })
})
