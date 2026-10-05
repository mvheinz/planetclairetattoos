import { describe, expect, it } from 'vitest'

import {
  copyStatement,
  dailyKey,
  footerLine,
  headerLines,
  isSetvalLine,
  monthlyKey,
  parseCopyLine,
  parseFooterLine,
  parseHeaderLine,
  quoteIdent,
  setvalStatement,
  TableHasher,
} from '@/lib/backup/format'
import { parseIdentityFile } from '@/lib/backup/crypto'

// P10.8 „pcdump v1“-Format (ARCHITEKTUR §10.3): reine Hilfen.
describe('pcdump v1 Format', () => {
  it('AK-A-10-05 Kopf und Abschluss-Kommentar rundlaufen', () => {
    const header = {
      createdAt: '2026-10-05T01:30:00.000Z',
      appVersion: 'abc1234',
      lastMigration: '20261001_x',
      pgVersion: '17.2',
    }
    const [magic, json] = headerLines(header).trimEnd().split('\n')
    expect(magic).toBe('-- pcdump 1')
    expect(parseHeaderLine(json!)).toEqual(header)
    const footer = {
      tables: [
        { name: 'orders', columns: ['id', 'x'], rows: 3, md5: 'd41d8cd98f00b204e9800998ecf8427e' },
      ],
    }
    expect(parseFooterLine(footerLine(footer).trimEnd())).toEqual(footer)
    expect(parseFooterLine('-- pcdump-end {kaputt')).toBeNull()
    expect(parseFooterLine('-- irgendwas')).toBeNull()
  })

  it('COPY-Zeilen werden streng erkannt (auch Bezeichner mit Anführungszeichen)', () => {
    const line = copyStatement('orders', ['id', 'we"ird']).trimEnd()
    expect(line).toBe('COPY public."orders" ("id", "we""ird") FROM stdin;')
    expect(parseCopyLine(line)).toEqual({ table: 'orders', columns: ['id', 'we"ird'] })
    expect(parseCopyLine('COPY public."orders" ("id") FROM stdin; DROP TABLE x;')).toBeNull()
    expect(parseCopyLine('COPY other."orders" ("id") FROM stdin;')).toBeNull()
    expect(quoteIdent('a"b')).toBe('"a""b"')
  })

  it('setval-Zeilen: nur das erwartete Muster', () => {
    expect(isSetvalLine(setvalStatement('orders_id_seq', '123', true).trimEnd())).toBe(true)
    expect(isSetvalLine('SELECT pg_catalog.setval(\'public."x"\', 1, true); DROP TABLE y;')).toBe(
      false,
    )
  })

  it('TableHasher zählt rohe Zeilenumbrüche und bildet MD5 über alle Bytes', () => {
    const h = new TableHasher()
    h.update(Buffer.from('1\ta\n2\tb'))
    h.update(Buffer.from('\\nx\n'))
    expect(h.rows).toBe(2)
    const h2 = new TableHasher()
    h2.update(Buffer.from('1\ta\n2\tb\\nx\n'))
    expect(h.digest()).toBe(h2.digest())
  })

  it('Schlüsselnamen nach §10.2 (UTC)', () => {
    expect(dailyKey(new Date('2026-10-05T01:30:12Z'))).toBe(
      'db/daily/2026/10/pc-db-20261005T0130Z.pcdump.gz.age',
    )
    expect(monthlyKey('2026-10')).toBe('db/monthly/pc-db-2026-10.pcdump.gz.age')
  })

  it('Schlüsseldatei: nur die AGE-SECRET-KEY-Zeile zählt', () => {
    expect(parseIdentityFile('# created: x\n# public key: age1abc\nAGE-SECRET-KEY-1QQQ\n')).toBe(
      'AGE-SECRET-KEY-1QQQ',
    )
    expect(() => parseIdentityFile('nichts')).toThrow()
  })
})
