import { describe, expect, it } from 'vitest'

import { decideAdminRoute } from '@/proxy'

// AK-A-8-02 (ARCHITEKTUR §8.4): ADMIN_ROUTE → interner Ordner /admin, direkte /admin-Aufrufe → 404.
describe('decideAdminRoute', () => {
  it('AK-A-8-02 schreibt ADMIN_ROUTE auf /admin um', () => {
    expect(decideAdminRoute('/werkstatt', '/werkstatt')).toEqual({
      kind: 'rewrite',
      pathname: '/admin',
    })
    expect(decideAdminRoute('/werkstatt/collections/users', '/werkstatt')).toEqual({
      kind: 'rewrite',
      pathname: '/admin/collections/users',
    })
  })

  it('AK-A-8-02 /admin und /admin/* ergeben 404', () => {
    expect(decideAdminRoute('/admin', '/werkstatt')).toEqual({ kind: 'not-found' })
    expect(decideAdminRoute('/admin/collections/users', '/werkstatt')).toEqual({
      kind: 'not-found',
    })
  })

  it('lässt andere Pfade durch', () => {
    expect(decideAdminRoute('/', '/werkstatt')).toEqual({ kind: 'next' })
    expect(decideAdminRoute('/werkstatt-news', '/werkstatt')).toEqual({ kind: 'next' })
    expect(decideAdminRoute('/administration', '/werkstatt')).toEqual({ kind: 'next' })
    expect(decideAdminRoute('/admin', '/admin')).toEqual({ kind: 'next' })
  })
})
