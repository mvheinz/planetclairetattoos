import { describe, expect, it } from 'vitest'

import { intWorkerCount, workerDatabaseUrl, workerStorageDir } from '../../int/setup/workers'

// Parallele Int-Worker (ARCHITEKTUR §7.2): je Worker eigene Datenbank und eigener Speicherordner.
describe('Int-Worker (PC_INT_WORKERS)', () => {
  it('Anzahl: Standard 1, ungültige Werte → 1, höchstens 8', () => {
    expect(intWorkerCount({})).toBe(1)
    expect(intWorkerCount({ PC_INT_WORKERS: '3' })).toBe(3)
    expect(intWorkerCount({ PC_INT_WORKERS: 'x' })).toBe(1)
    expect(intWorkerCount({ PC_INT_WORKERS: '0' })).toBe(1)
    expect(intWorkerCount({ PC_INT_WORKERS: '99' })).toBe(8)
  })

  it('Datenbank: Worker 1 unverändert, Worker n endet weiter auf _test', () => {
    const base = 'postgres://postgres:postgres@localhost:5432/planetclaire_test'
    expect(workerDatabaseUrl(base, 1)).toBe(base)
    expect(workerDatabaseUrl(base, 2)).toBe(
      'postgres://postgres:postgres@localhost:5432/planetclaire_w2_test',
    )
    expect(() => workerDatabaseUrl('postgres://x@localhost/planetclaire', 2)).toThrow('_test')
  })

  it('Speicherordner: Worker 1 Basis, Worker n daneben', () => {
    expect(workerStorageDir('/r/.data', 1)).toBe('/r/.data')
    expect(workerStorageDir('/r/.data', 3)).toBe('/r/.data-w3')
  })
})
