import { describe, expect, it } from 'vitest'

import { findAdminRouteLeaks } from '../../../scripts/check-external'

// AK-2-04 (Teil): Der Verwaltungspfad steht in keiner ausgelieferten Datei.
describe('check:external --built', () => {
  it('AK-2-04 meldet Dateien mit dem Verwaltungspfad', () => {
    const files = [
      { path: '.next/static/chunks/a.js', content: 'fetch("/api/users")' },
      { path: '.next/server/app/index.html', content: '<a href="/werkstatt/login">' },
    ]
    expect(findAdminRouteLeaks(files, '/werkstatt')).toEqual(['.next/server/app/index.html'])
    expect(findAdminRouteLeaks(files.slice(0, 1), '/werkstatt')).toEqual([])
  })
})
