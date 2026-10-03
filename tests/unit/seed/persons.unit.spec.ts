import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadSeedData, SEED_DATA_DIR } from '@/lib/seed/loader'
import { CANONICAL_SEED_NOW } from '@/lib/seed/time'

// P8.4: AK-SEED-12 (R-180) – erkennbar erfundene Personen: E-Mail nur @example.com/@example.org, keine Telefonnummer,
// Adressen außerhalb Berlins (außer der Musterstraße, SE-05); `customers.json` entspricht SEED-SPEC §6.

const dir = path.join(process.cwd(), SEED_DATA_DIR)
const SPEC = path.join(process.cwd(), 'content/seed/SEED-SPEC.md')

describe('AK-SEED-12 Personen im Beispielbestand', () => {
  it('alle E-Mail-Adressen in content/seed/data/*.json enden auf @example.com oder @example.org; keine Telefonnummern', async () => {
    for (const file of (await readdir(dir)).filter((f) => f.endsWith('.json'))) {
      if (file === 'base.json') continue
      const text = await readFile(path.join(dir, file), 'utf8')
      for (const mail of text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []) {
        expect(mail, file).toMatch(/@example\.(com|org)$/)
      }
      expect(text, file).not.toMatch(/"(phone|telefon|tel|mobile)"\s*:/i)
      expect(text, file).not.toMatch(/\+\d{2}[\s\d/-]{6,}|\bTel\.?\s*:?\s*\d/i)
    }
  })

  it('customers.json entspricht der Tabelle SEED-SPEC §6 (Name, E-Mail, Sprache, Adresse)', async () => {
    const md = await readFile(SPEC, 'utf8')
    const sec = md.slice(md.indexOf('## 6. Kund'), md.indexOf('## 7. Bestellungen'))
    const rows = sec
      .split('\n')
      .filter((l) => /^\| C\d\d \|/.test(l))
      .map((l) => l.split('|').map((c) => c.trim()))
    const data = await loadSeedData({ dir, now: new Date(CANONICAL_SEED_NOW) })
    expect(data.customers.map((c) => c.key)).toEqual(rows.map((r) => r[1]))
    for (const r of rows) {
      const c = data.customers.find((x) => x.key === r[1])!
      expect([c.name, c.email, c.locale], c.key).toEqual([r[2], r[3], r[5]])
      const addr = r[4]!.replace(/\s*\(Rechnungsadresse\)/, '')
      if (addr === '–') expect(c.address).toBeUndefined()
      else {
        expect(`${c.address!.addressLine1}, ${c.address!.postalCode} ${c.address!.city}`).toBe(addr)
        if (c.address!.city === 'Berlin') expect(c.address!.addressLine1).toMatch(/^Musterstraße/)
      }
    }
  })
})
