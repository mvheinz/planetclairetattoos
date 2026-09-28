import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidateTag = vi.fn()
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))

const { revalidatePage } = await import('../../../src/collections/Pages')

// ARCHITEKTUR §9.3, DM-PAGE-01: Seiten-Hook erneuert `page:<key>`; ein Statuswechsel wirkt sofort (`expire: 0`),
// sonst `'max'`; im Seed-Kontext nichts.
type HookArgs = Parameters<typeof revalidatePage>[0]
const run = (doc: Record<string, unknown>, previousDoc?: Record<string, unknown>, seed = false) =>
  revalidatePage({
    doc,
    previousDoc,
    req: { context: seed ? { seed: true } : {} },
    operation: previousDoc ? 'update' : 'create',
  } as unknown as HookArgs)

describe('revalidatePage', () => {
  beforeEach(() => revalidateTag.mockClear())

  it('DM-PAGE-01 Zurückziehen (published → draft) erneuert page:<key> sofort', () => {
    run({ key: 'contact', _status: 'draft' }, { key: 'contact', _status: 'published' })
    expect(revalidateTag).toHaveBeenCalledWith('page:contact', { expire: 0 })
  })

  it('DM-PAGE-01 Veröffentlichen (draft → published) erneuert sofort', () => {
    run({ key: 'contact', _status: 'published' }, { key: 'contact', _status: 'draft' })
    expect(revalidateTag).toHaveBeenCalledWith('page:contact', { expire: 0 })
  })

  it('inhaltliche Änderung ohne Statuswechsel: max (≤ 60 s)', () => {
    run({ key: 'home', _status: 'published' }, { key: 'home', _status: 'published' })
    expect(revalidateTag).toHaveBeenCalledTimes(1)
    expect(revalidateTag).toHaveBeenCalledWith('page:home', 'max')
  })

  it('Seed-Kontext löst nichts aus', () => {
    run({ key: 'contact', _status: 'draft' }, { key: 'contact', _status: 'published' }, true)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
