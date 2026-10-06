import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { ROOT_FILES } from '@/lib/routes/redirects'
import { baseHeaders } from '@/lib/security/headers'
import { buildMetadata, robotsFor } from '@/lib/seo/metadata'
import {
  AI_CRAWLERS,
  AI_ROBOTS_DIRECTIVES,
  aiRobotsTag,
  robotsRules,
  xRobotsTag,
  type AppEnvName,
} from '@/lib/seo/robots'

// P12.11 / U-22 (c): KI-/Text-und-Data-Mining-Vorbehalt (§ 44b Abs. 3 UrhG) auch technisch – robots.txt, ai.txt, Meta,
// Header, TDMRep –, ohne die Indexierung durch Suchmaschinen zu verhindern.

const ROOT = path.resolve(import.meta.dirname, '../../..')
const SITE = 'https://planetclairetattoos.com'
const REQUIRED = [
  'GPTBot',
  'ClaudeBot',
  'CCBot',
  'Google-Extended',
  'PerplexityBot',
  'Bytespider',
  'anthropic-ai',
]

describe('R-141 U-22 c robots.txt (Produktion)', () => {
  it('R-141 eigene Gruppe Disallow: / für alle bekannten KI-Crawler, Suchmaschinen bleiben über „*“ erlaubt', () => {
    const rules = robotsRules('production', SITE)
    const groups = Array.isArray(rules.rules) ? rules.rules : [rules.rules]
    const ai = groups.find((g) => Array.isArray(g.userAgent))!
    expect(ai.disallow).toBe('/')
    for (const bot of REQUIRED) expect(ai.userAgent, bot).toContain(bot)
    expect(ai.userAgent).toEqual([...AI_CRAWLERS])
    const star = groups.find((g) => g.userAgent === '*')!
    expect(star.allow).toBe('/')
    // keine Suchmaschine ist gesperrt
    for (const search of ['Googlebot', 'Bingbot', 'DuckDuckBot', 'Applebot', 'Googlebot-Image'])
      expect(AI_CRAWLERS, search).not.toContain(search)
    expect(rules.sitemap).toBe(`${SITE}/sitemap.xml`)
  })

  it('R-141 außerhalb der Produktion bleibt alles gesperrt (eine Regel)', () => {
    for (const env of ['development', 'test', 'preview', 'staging'] as const)
      expect(robotsRules(env, SITE)).toEqual({ rules: { userAgent: '*', disallow: '/' } })
  })
})

describe('R-141 U-22 c ai.txt und TDMRep', () => {
  const aiTxt = readFileSync(path.join(ROOT, 'public/ai.txt'), 'utf8')

  it('R-141 /ai.txt ist eine echte Wurzeldatei und sperrt jeden Crawler aus der Liste (Disallow: /)', () => {
    expect(ROOT_FILES.has('/ai.txt')).toBe(true)
    const groups = aiTxt
      .split(/\n\s*\n/)
      .map((g) => g.split('\n').filter((l) => !l.startsWith('#') && l.trim()))
      .filter((g) => g.length)
    const agents = groups.map((g) => g[0]!.replace(/^User-Agent:\s*/i, ''))
    expect(agents).toContain('*')
    for (const bot of AI_CRAWLERS) expect(agents, bot).toContain(bot)
    for (const g of groups) expect(g[1], g[0]).toBe('Disallow: /')
    expect(aiTxt).toMatch(/44b/)
    expect(aiTxt).toMatch(/Contact/)
  })

  it('R-141 /.well-known/tdmrep.json (TDM Reservation Protocol) gültig und für alle Pfade gesetzt', () => {
    const file = path.join(ROOT, 'public/.well-known/tdmrep.json')
    expect(existsSync(file)).toBe(true)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual([
      { location: '/*', 'tdm-reservation': 1 },
    ])
  })
})

describe('R-141 U-22 c Meta-Tags und Header', () => {
  it('R-141 indexierbare Seiten: „index, follow, noai, noimageai“ + TDMRep-Meta; noindex-Seiten bleiben unverändert', () => {
    const meta = buildMetadata('R01', 'de', {}, { siteUrl: SITE })
    expect(meta.robots).toBe(`index, follow, ${AI_ROBOTS_DIRECTIVES}`)
    expect(meta.robots).not.toMatch(/noindex/)
    expect(meta.other).toEqual({ 'tdm-reservation': '1' })
    expect(robotsFor('noindex')).toEqual({ index: false })
    expect(robotsFor('noindex,follow')).toEqual({ index: false, follow: true })
  })

  it('R-141 X-Robots-Tag „noai, noimageai“ nur in Produktion, sonst „noindex, nofollow“; TDMRep-Header überall', () => {
    expect(aiRobotsTag('production')).toBe('noai, noimageai')
    expect(xRobotsTag('production')).toBeNull()
    for (const env of ['production', 'staging', 'preview', 'development', 'test'] as AppEnvName[]) {
      const h = baseHeaders(env)
      expect(h['tdm-reservation'], env).toBe('1')
      expect(h['X-Robots-Tag'], env).toBe(
        env === 'production' ? 'noai, noimageai' : 'noindex, nofollow',
      )
    }
    // schließt die Indexierung nicht aus
    expect(baseHeaders('production')['X-Robots-Tag']).not.toMatch(/noindex|nofollow/)
  })
})
