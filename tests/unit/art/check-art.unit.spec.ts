import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { AUTO_IDS, buildReport, renderMarkdown } from '../../../scripts/art/check'
import * as A from '../../../scripts/art/lib/checks/art'
import * as L from '../../../scripts/art/lib/checks/line'
import * as rt from '../../../scripts/art/lib/checks/runtime'
import { KUNST_QA_FILE, parseCriteria } from '../../../scripts/art/lib/criteria'
import type { RawRun } from '../../../scripts/art/lib/perf'
import { buildPerfReport } from '../../../scripts/art/metrics'
import type { Probe, ProbeAnim, ProbeFile } from '../../../scripts/art/lib/probe'

// P9.5/P9.6 `pnpm art:check` (KUNST-QA §5): Parser gegen die Tabellen, jedes automatische Kriterium mit PASS/FAIL,
// Messwert und Schwelle; Negativ-Fixtures scheitern gezielt (perfekte Kreisschlaufe → LQ-04, <circle>/gespiegelter
// Frame → CO-07, #333333 → LQ-01, <text> im Platzhalter → AR-04, ease → MO-02, 7 s Boil → MO-04, Linie über Text →
// LG-01, LoAF 80 ms aus leash → PF-01).

const md = readFileSync(KUNST_QA_FILE, 'utf8')
const criteria = parseCriteria(md)

describe('P9.5/P9.6 Kriterien-Katalog aus KUNST-QA §5', () => {
  it('Parser liest alle Tabellenzeilen §5.1–§5.10 mit Schwelle, Methode und Schwere', () => {
    const tableIds = [
      ...md
        .slice(md.indexOf('## 5. Abnahmekriterien'), md.indexOf('\n## 6.'))
        .matchAll(/^\| ([A-Z0-9]+-\d{2}) \|/gm),
    ].map((m) => m[1])
    expect(criteria.map((c) => c.id)).toEqual(tableIds)
    expect(criteria).toHaveLength(76)
    for (const c of criteria) {
      expect(c.threshold, c.id).not.toBe('')
      expect(c.severity, c.id).toMatch(/[BMm]/)
    }
    expect(criteria.find((c) => c.id === 'LQ-06')).toMatchObject({ auto: true, judgement: 'R1' })
    expect(criteria.find((c) => c.id === 'MO-12')).toMatchObject({ auto: false, judgement: 'R2' })
  })

  it('jedes „auto“-Kriterium aus §5 hat eine Prüfung in art:check – und keine darüber hinaus', () => {
    expect([...AUTO_IDS].sort()).toEqual(
      criteria
        .filter((c) => c.auto)
        .map((c) => c.id)
        .sort(),
    )
  })

  it('check.md listet alle Kriterien; Urteilspunkte als R1/R2/R3 offen, nie automatisch bestanden', () => {
    const results = AUTO_IDS.map((id) => ({
      id,
      status: 'PASS' as const,
      value: '1',
      threshold: 't',
    }))
    const report = buildReport(
      '20261003-iter01-abcdef0',
      criteria,
      results,
      new Date('2026-10-03T00:00:00Z'),
    )
    expect(report.pass).toBe(true)
    expect(report.summary).toEqual({ auto: 62, pass: 62, fail: 0, judgement: 25 })
    const text = renderMarkdown(report)
    for (const c of criteria) expect(text).toContain(`| ${c.id} |`)
    const lq08 = text.split('\n').find((l) => l.startsWith('| LQ-08 |'))!
    expect(lq08).toContain('R1 offen')
    expect(lq08).not.toContain('PASS')
    expect(text.split('\n').find((l) => l.startsWith('| MO-08 |'))).toContain('R2 offen')
    expect(text.split('\n').find((l) => l.startsWith('| LG-05 |'))).toContain('R3 offen')
  })

  it('fehlendes Ergebnis = FAIL „keine Daten“, Exit-relevant', () => {
    const report = buildReport(null, criteria, [])
    expect(report.pass).toBe(false)
    const lg01 = report.criteria.find((c) => c.id === 'LG-01')!
    expect(lg01.result).toMatchObject({ status: 'FAIL', value: 'keine Daten' })
  })
})

// ---------- Linie ----------

function lineCase(points: (s: number) => { x: number; y: number }, len = 600, w = 2.2): L.LineCase {
  const n = len / 2 + 1
  const arr = () => new Float64Array(n)
  const c = { s: arr(), x: arr(), y: arr(), w: arr(), sx: arr(), sy: arr() }
  for (let i = 0; i < n; i++) {
    const s = i * 2
    const p = points(s)
    c.s[i] = s
    c.x[i] = p.x
    c.y[i] = p.y
    c.sx[i] = p.x
    c.sy[i] = p.y
    c.w[i] = w
  }
  return { label: 'fixture', samples: c, baseWidth: w, loops: [{ id: 'loop', len0: 0, len1: len }] }
}

describe('P9.5 Linie LQ', () => {
  it('LQ-04: perfekte Kreisschlaufe scheitert, unregelmäßige Schlaufe besteht', () => {
    const r = 40
    const circle = lineCase(
      (s) => ({ x: 100 + r * Math.cos(s / r), y: 100 + r * Math.sin(s / r) }),
      240,
    )
    const res = L.lq04([circle])
    expect(res.status).toBe('FAIL')
    expect(res.value).toMatch(/px/)
    expect(res.threshold).toMatch(/0,6 px/)
    const wobbly = lineCase((s) => {
      const rr = r * (1 + 0.12 * Math.sin(s / 7) + 0.05 * Math.cos(s / 3))
      return { x: 100 + rr * Math.cos(s / r), y: 100 + rr * Math.sin(s / r) }
    }, 240)
    expect(L.lq04([wobbly]).status).toBe('PASS')
  })

  it('LQ-03: gerade Strecke ≥ 120 px ohne Zittern scheitert', () => {
    const straight = lineCase((s) => ({ x: s, y: 0 }))
    const res = L.lq03([straight])
    expect(res.status).toBe('FAIL')
    expect(
      L.straightRuns(straight.samples.s, straight.samples.x, straight.samples.y).length,
    ).toBeGreaterThan(0)
  })

  it('LQ-02/LQ-05: gleichmäßige Breite ohne Verjüngung scheitert', () => {
    const c = lineCase((s) => ({ x: s, y: 0 }))
    expect(L.lq02([c]).status).toBe('FAIL')
    expect(L.lq05([c]).status).toBe('FAIL')
  })

  function frame(color: [number, number, number]): L.LineFrame {
    const width = 120
    const height = 60
    const data = new Uint8Array(width * height * 3).fill(244)
    const pts: L.LineFrame['pts'] = []
    for (let x = 5; x < 115; x++) {
      for (let dy = -1; dy <= 1; dy++) data.set(color, ((30 + dy) * width + x) * 3)
      pts.push({ len: x, x, y: 30 })
    }
    return {
      label: 'f',
      raster: { data, width, height, channels: 3 },
      pts,
      halfW: 1.5,
      seams: [60],
    }
  }

  it('LQ-01: Tusche #1C1A17 besteht, Linienfarbe #333333 scheitert (ΔE2000 > 3)', () => {
    expect(L.lq01([frame([0x1c, 0x1a, 0x17])]).status).toBe('PASS')
    const grey = L.lq01([frame([0x33, 0x33, 0x33])])
    expect(grey.status).toBe('FAIL')
    expect(grey.value).toMatch(/ΔE2000/)
  })

  it('LQ-06: heller Spalt an der Segmentgrenze scheitert', () => {
    const ok = frame([0x1c, 0x1a, 0x17])
    expect(L.lq06([ok]).status).toBe('PASS')
    const gap = frame([0x1c, 0x1a, 0x17])
    for (let x = 59; x <= 61; x++)
      for (let dy = -1; dy <= 1; dy++)
        gap.raster.data.set([244, 244, 244], ((30 + dy) * 120 + x) * 3)
    expect(L.lq06([gap]).status).toBe('FAIL')
  })

  it('ΔE2000 Referenzwert (Sharma 2005, Paar 1)', () => {
    expect(L.deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3)
  })
})

// ---------- Coco ----------

const STYLE = '<style>.line{fill:none;stroke:#000;stroke-width:1.6px}.fur{fill:#E2BF8E}</style>'
const parts = A.SPRITE_PARTS.map(
  (p, i) => `<g data-part="${p}"><path d="M${20 + i * 5} 40q5 -10 10 0t10 0"/></g>`,
).join('')
const symbol = (id: string, body: string) =>
  `<symbol id="${id}" viewBox="0 0 160 120"><g class="line">${body}</g></symbol>`
const blob = (dx: number) => `<path d="M${30 + dx} 30q20 -20 50 0t30 40q-20 30 -60 10t-20 -50"/>`
const blobMirror = (dx: number) =>
  `<path d="M${130 - dx} 30q-20 -20 -50 0t-30 40q20 30 60 10t20 -50"/>`

describe('P9.5 Coco CO', () => {
  it('CO-01: 22 IDs mit allen data-part bestehen, fehlendes Symbol scheitert', () => {
    const ids = [
      ...A.SPRITE_POSES.flatMap((p) => ['a', 'b', 'c'].map((f) => `coco-${p}-${f}`)),
      ...A.SPRITE_BRIDGES.map((b) => `coco-bridge-${b}`),
    ]
    const svg = `<svg>${STYLE}${ids.map((id) => symbol(id, parts)).join('')}</svg>`
    expect(A.co01(svg).status).toBe('PASS')
    expect(A.co01(svg.replace(/<symbol id="coco-sitzen-b"[\s\S]*?<\/symbol>/, '')).status).toBe(
      'FAIL',
    )
  })

  it('CO-07: Sprite mit <circle> scheitert; gespiegelter Frame scheitert; eigenständige Frames bestehen', async () => {
    const own = `<svg>${STYLE}${symbol('coco-sitzen-a', blob(0))}${symbol('coco-sitzen-b', `${blob(0)}<path d="M40 90q10 8 30 2"/>`)}</svg>`
    expect(A.co07(own, await A.silhouettes(own, 128)).status).toBe('PASS')
    const circle = own.replace('</symbol>', '<circle cx="5" cy="5" r="3"/></symbol>')
    const c = A.co07(circle, await A.silhouettes(own, 128))
    expect(c.status).toBe('FAIL')
    expect(c.details!.join()).toMatch(/circle/)
    const mirrored = `<svg>${STYLE}${symbol('coco-sitzen-a', blob(0))}${symbol('coco-sitzen-b', blobMirror(0))}</svg>`
    const m = A.co07(mirrored, await A.silhouettes(mirrored, 128))
    expect(m.status).toBe('FAIL')
    expect(m.details!.join()).toMatch(/Spiegelung/)
    const shifted = `<svg>${STYLE}${symbol('coco-sitzen-a', blob(0))}${symbol('coco-sitzen-b', blob(4))}</svg>`
    expect(A.co07(shifted, await A.silhouettes(shifted, 128)).details!.join()).toMatch(
      /Verschiebung/,
    )
  })

  it('CO-04: D-Ring springt um 4 Einheiten → FAIL', () => {
    const sym = (pose: string, frame: string, x: number) => ({
      id: `coco-${pose}-${frame}`,
      pose,
      frame,
      bridge: false,
      anchor: { x, y: 50 },
      groundY: 112,
    })
    const ok = A.SPRITE_POSES.flatMap((p) => ['a', 'b', 'c'].map((f) => sym(p, f, 60)))
    expect(A.co04(ok).status).toBe('PASS')
    expect(
      A.co04(ok.map((s) => (s.id === 'coco-sitzen-c' ? { ...s, anchor: { x: 64, y: 50 } } : s)))
        .status,
    ).toBe('FAIL')
  })

  it('CO-08: Strichstärken je Größe aus tokens.css/coco.css; 24 px mit 2 px scheitert', () => {
    const table = A.cocoStrokeTable(
      readFileSync('src/styles/tokens.css', 'utf8'),
      readFileSync('src/styles/coco.css', 'utf8'),
    )
    expect(table.map((t) => t.size)).toEqual(expect.arrayContaining([24, 40, 72, 180, 240]))
    expect(A.co08([{ size: 24, stroke: 2, label: 'horizon' }]).status).toBe('FAIL')
  })
})

// ---------- Zeichnungen ----------

describe('P9.5 Zeichnungen AR', () => {
  const base = { wash: '#E3D3BA', washes: ['#E3D3BA', '#F4CCDA'], inkHeight: 0.6 }
  const svg =
    '<svg viewBox="0 0 400 500"><rect fill="#EAE2D4"/><path fill="#E3D3BA" d="M0 0"/><g stroke-width="2.8"><path d="M1 1"/></g></svg>'

  it('AR-04: Platzhalter nach Regeln besteht; mit <text> scheitert', () => {
    expect(A.ar04([{ name: 'teller-01', svg, ...base }]).status).toBe('PASS')
    const bad = A.ar04([
      { name: 'teller-01', svg: svg.replace('</svg>', '<text>Hi</text></svg>'), ...base },
    ])
    expect(bad.status).toBe('FAIL')
    expect(bad.details).toEqual(['teller-01: <text>'])
  })

  it('AR-04: zweite Wash-Farbe oder Motiv zu klein scheitert', () => {
    expect(
      A.ar04([
        { name: 'x', svg: svg.replace('</svg>', '<path fill="#F4CCDA" d="M0 0"/></svg>'), ...base },
      ]).status,
    ).toBe('FAIL')
    expect(A.ar04([{ name: 'x', svg, ...base, inkHeight: 0.4 }]).status).toBe('FAIL')
  })

  it('AR-01: verbotene Quelle (Highlight/Godzilla) und Kundenhaut-Foto scheitern', () => {
    const sources = {
      vectorize: [{ id: 'keramik', file: 'post-A.jpg' }],
      derived: [{ id: 'hallo', from: 'sprite', kind: 'sprite' }],
    }
    expect(A.ar01(sources, ['hallo', 'keramik'], ['CUST1']).status).toBe('PASS')
    expect(
      A.ar01(
        { ...sources, vectorize: [{ id: 'keramik', file: 'highlight-coco.jpg' }] },
        ['hallo', 'keramik'],
        [],
      ).status,
    ).toBe('FAIL')
    expect(
      A.ar01(
        { ...sources, vectorize: [{ id: 'keramik', file: 'post-CUST1.jpg' }] },
        ['hallo', 'keramik'],
        ['CUST1'],
      ).status,
    ).toBe('FAIL')
    expect(A.ar01(sources, ['hallo'], []).status).toBe('FAIL')
  })

  it('AR-02: Strichbreite aus der Distanztransformation; doppelt so dicke Striche scheitern', () => {
    const w = 60
    const h = 60
    const stripe = (half: number) => {
      const m = new Uint8Array(w * h)
      for (let y = 0; y < h; y++) for (let x = 30 - half; x < 30 + half; x++) m[y * w + x] = 1
      return m
    }
    expect(A.medianStrokeWidth(stripe(2), w, h)).toBeGreaterThan(2)
    expect(A.ar02([{ id: 'ok', draw: stripe(2), src: stripe(2), w, h }]).status).toBe('PASS')
    expect(A.ar02([{ id: 'fett', draw: stripe(5), src: stripe(2), w, h }]).status).toBe('FAIL')
  })

  it('AR-03: Größengrenzen je Art', () => {
    expect(A.ar03([{ kind: 'icon', name: 'a.svg', bytes: 600 }]).status).toBe('PASS')
    expect(A.ar03([{ kind: 'icon', name: 'a.svg', bytes: 601 }]).status).toBe('FAIL')
  })

  it('IM-02: Streuung Median-L* > 6 scheitert', () => {
    const images = {
      summary: { count: 2, medianLStdDev: 7, medianCardBytes: 1, medianThumbBytes: 1 },
      items: [],
    }
    expect(A.im02(images).status).toBe('FAIL')
    expect(A.im02({ ...images, summary: { ...images.summary, medianLStdDev: 3 } }).status).toBe(
      'PASS',
    )
    expect(A.im05(null, null).status).toBe('FAIL')
  })
})

// ---------- Sonden-Fixtures für P9.6 ----------

function anim(over: Partial<ProbeAnim> = {}): ProbeAnim {
  return {
    n: 'mi-hop',
    k: 'CSSAnimation',
    s: 'running',
    d: 360,
    dl: 0,
    it: 1,
    e: 'linear',
    ke: ['cubic-bezier(0.15, 0.75, 0.35, 1)'],
    ct: 0,
    act: true,
    tg: 'div.coco__hop',
    z: 'main',
    pe: null,
    ...over,
  }
}

function probe(over: Partial<Probe> = {}): Probe {
  return {
    label: 'x',
    frame: null,
    t: null,
    url: '/de',
    vw: 390,
    vh: 844,
    dpr: 1,
    scale: 1,
    scrollY: 0,
    scrollW: 390,
    clientW: 390,
    leash: null,
    coco: null,
    text: [],
    ctrl: [],
    anims: [],
    deco: { hidden: true, focusable: 0, count: 2 },
    mansalva: [],
    storage: 0,
    marks: { stars: 0, perStation: 0 },
    transitions: 0,
    commerce: { price: 0, addToCart: 0 },
    focus: null,
    svg: { bytes: 1000, pathBytes: 500 },
    withdraw: null,
    canvasText: 'rgb(0, 0, 0)',
    lcp: null,
    measures: { build: [], frame: [] },
    poseLog: [],
    badges: [],
    ...over,
  }
}

const file = (
  sc: string,
  probes: Probe[],
  variant = 'motion',
  extra?: Record<string, unknown>,
): ProbeFile => ({
  sc,
  profile: 'art-pixel7',
  variant,
  probes,
  ...(extra ? { extra } : {}),
})

const leash = (
  pts: number[],
  over: Partial<NonNullable<Probe['leash']>> = {},
): NonNullable<Probe['leash']> => ({
  preset: 'journey',
  tier: 'A',
  drawnLen: 500,
  total: 1000,
  cocoLen: 480,
  pose: 'sitzen',
  rebuild: 1,
  readingY: 100,
  mapped: 500,
  halfW: 1.1,
  pts,
  seams: [],
  stroke: 'rgb(0, 0, 0)',
  stations: [],
  ...over,
})

const tokens = readFileSync('src/styles/tokens.css', 'utf8')

describe('P9.6 Bewegung MO', () => {
  it('MO-02: ease als Timing-Funktion scheitert, Token-Kurve besteht', () => {
    const allowed = rt.allowedEasings(tokens)
    expect(allowed.length).toBeGreaterThanOrEqual(8)
    expect(rt.mo02([file('SC-05', [probe({ anims: [anim()] })])], allowed).status).toBe('PASS')
    const bad = rt.mo02(
      [file('SC-05', [probe({ anims: [anim({ k: 'CSSTransition', e: 'ease', ke: [] })] })])],
      allowed,
    )
    expect(bad.status).toBe('FAIL')
    expect(bad.details!.join()).toMatch(/ease/)
    expect(rt.easingAllowed('ease-in-out', allowed)).toBe(false)
    expect(rt.easingAllowed('steps(1, end)', allowed)).toBe(true)
  })

  it('MO-04: 7 s Boil ohne Nutzeraktion scheitert, Stillstand nach 5 s besteht', () => {
    const seq = (boil: string) =>
      [0, 2000, 5000, 6000, 7000].map((t) =>
        probe({
          t,
          label: `paid-t${t}`,
          coco: { x: 0, y: 0, w: 72, h: 54, boil: t > 5000 ? boil : 'on' },
        }),
      )
    expect(rt.mo04([file('SC-09', seq('off'))]).status).toBe('PASS')
    const bad = rt.mo04([file('SC-09', seq('on'))])
    expect(bad.status).toBe('FAIL')
    expect(bad.details!.join()).toMatch(/t7000.*Boil an/)
  })

  it('MO-01: Dauer außerhalb der Token ± 10 % scheitert', () => {
    const allowed = rt.allowedDurations(tokens, readFileSync('docs/design/DESIGN.md', 'utf8'))
    expect(allowed).toEqual(expect.arrayContaining([120, 200, 350, 900]))
    expect(rt.mo01([file('SC-05', [probe({ anims: [anim({ d: 360 })] })])], allowed).status).toBe(
      'PASS',
    )
    expect(rt.mo01([file('SC-05', [probe({ anims: [anim({ d: 4321 })] })])], allowed).status).toBe(
      'FAIL',
    )
  })

  it('MO-03: Boil-Takt und Reihenfolge A → B → C aus coco.css', () => {
    const css = readFileSync('src/styles/coco.css', 'utf8')
    expect(rt.mo03(css, tokens, []).value).toMatch(/Folge a→b→c/)
    expect(
      rt.mo03(
        css
          .replace('* -2)', '* -1)')
          .replace(/(\.f-c \{\s*animation-delay: calc\(var\(--boil-frame\) \*) -1\)/, '$1 -2)'),
        tokens,
        [],
      ).status,
    ).toBe('FAIL')
  })

  it('MO-09: Brücken laut DESIGN §10.4', () => {
    expect(rt.expectedBridge('rennen', 'sitzen')).toBe('bremsen')
    expect(rt.expectedBridge('sitzen', 'schlafen')).toBe('einrollen-1+einrollen-2')
    const log = [{ t: 1, from: 'rennen', to: 'sitzen', bridge: null }]
    const coco = { x: 0, y: 0, w: 10, h: 10, boil: 'off' }
    expect(rt.mo09([file('SC-01', [probe({ poseLog: log, coco })])]).status).toBe('FAIL')
    expect(
      rt.mo09([file('SC-01', [probe({ poseLog: [{ ...log[0]!, bridge: 'bremsen' }], coco })])])
        .status,
    ).toBe('PASS')
    // ohne Coco an der Leine (Shop-Schnur) meldet nur die Engine „Posen“: kein Befund
    expect(
      rt.mo09([
        file('SC-03', [probe({ poseLog: log })]),
        file('SC-01', [probe({ poseLog: [{ ...log[0]!, bridge: 'bremsen' }], coco })]),
      ]).status,
    ).toBe('PASS')
  })

  it('MO-15: Wechsel hell/dunkel 5× pro Sekunde über die Fläche scheitert', () => {
    const dark = new Float32Array(100).fill(0.05)
    const light = new Float32Array(100).fill(0.7)
    const t = Array.from({ length: 11 }, (_, i) => i * 100)
    const flashing = { label: 'x', t, lum: t.map((_, i) => (i % 2 ? light : dark)), areaFrac: 0.03 }
    expect(rt.mo15([flashing]).status).toBe('FAIL')
    expect(rt.mo15([{ ...flashing, lum: t.map(() => dark) }]).status).toBe('PASS')
  })
})

describe('P9.6 Lesbarkeit LG', () => {
  it('LG-01: Linie über einer Textzeile scheitert, Linie in der Rinne besteht', () => {
    const text = [40, 100, 300, 20]
    const inGutter = probe({ leash: leash([0, 20, 90, 4, 20, 110, 8, 20, 130]), text })
    expect(rt.lg01([file('SC-01', [inGutter])]).status).toBe('PASS')
    const overText = probe({ leash: leash([0, 20, 90, 4, 60, 110, 8, 100, 112]), text })
    const res = rt.lg01([file('SC-01', [overText])])
    expect(res.status).toBe('FAIL')
    expect(res.details!.join()).toMatch(/Linie bei \(60, 110\)/)
    const coco = probe({ coco: { x: 50, y: 95, w: 72, h: 54, boil: 'off' }, text })
    expect(rt.lg01([file('SC-04', [coco])]).status).toBe('FAIL')
  })

  it('LG-03: Mansalva unter 24 px oder als Fließtext scheitert', () => {
    expect(
      rt.lg03([file('SC-04', [probe({ mansalva: [{ tag: 'h1', size: 40, role: 'h1' }] })])]).status,
    ).toBe('PASS')
    expect(
      rt.lg03([file('SC-04', [probe({ mansalva: [{ tag: 'p', size: 18, role: 'body' }] })])])
        .status,
    ).toBe('FAIL')
  })

  it('LG-04: horizontales Scrollen bei 200 % scheitert', () => {
    const ext = { lg04: { rebuildBefore: 1, rebuildAfter: 2 } }
    expect(rt.lg04([file('SC-15', [probe({ label: 'font200-top' })], 'motion', ext)]).status).toBe(
      'PASS',
    )
    expect(
      rt.lg04([file('SC-15', [probe({ label: 'font200-top', scrollW: 450 })], 'motion', ext)])
        .status,
    ).toBe('FAIL')
  })
})

describe('P9.6 Tempo PF', () => {
  const raw = (mode: 'engine' | 'off', loaf: RawRun['dump']['loaf']): RawRun => ({
    route: 'R01',
    mode,
    run: 1,
    marks: { lcp: 1200, menuAt: null, addAt: null, scrollFrom: 0, scrollTo: 5000 },
    dump: { frames: [0, 16, 32, 48], loaf, longtasks: [], shifts: [], events: [], marks: [] },
  })

  it('PF-01: LoAF 80 ms aus leash scheitert', () => {
    const leashLoaf = [
      {
        startTime: 10,
        duration: 80,
        scripts: [{ sourceURL: '/_next/static/chunks/leash-runtime.js' }],
      },
    ]
    const bad = buildPerfReport('r', [raw('engine', leashLoaf), raw('off', [])], { R01: 2 })
    const res = rt.perfFromGates('PF-01', bad, 'th')
    expect(res.status).toBe('FAIL')
    expect(res.value).toMatch(/R01 1/)
    const ok = buildPerfReport('r', [raw('engine', []), raw('off', [])], { R01: 2 })
    expect(rt.perfFromGates('PF-01', ok, 'th').status).toBe('PASS')
    expect(rt.perfFromGates('PF-02', ok, 'th').value).toMatch(/R01a .*R01b/)
  })

  it('PF-11/PF-12 aus den Zusatzmessungen von SC-15', () => {
    expect(rt.pf11([file('SC-15', [], 'motion', { pf11: { hiddenFrames: 0 } })]).status).toBe(
      'PASS',
    )
    expect(rt.pf11([file('SC-15', [], 'motion', { pf11: { hiddenFrames: 12 } })]).status).toBe(
      'FAIL',
    )
    expect(
      rt.pf12([file('SC-15', [], 'motion', { pf12: { before: 'A', after: 'A' } })]).status,
    ).toBe('FAIL')
  })
})

describe('P9.6 Barrierefreiheit, Kontrast, Ruhezonen', () => {
  it('A11Y-01: laufende Animation in reduced scheitert', () => {
    const tc = [{ profile: 'art-pixel7', identical: true }]
    expect(rt.a11y01([file('SC-02', [probe()], 'reduced')], tc).status).toBe('PASS')
    expect(rt.a11y01([file('SC-02', [probe({ anims: [anim()] })], 'reduced')], tc).status).toBe(
      'FAIL',
    )
  })

  it('A11Y-03: fokussierbare Deko oder abweichende Tab-Reihenfolge scheitert', () => {
    const ext = { tabOrder: { engine: ['a|/de/shop|Shop'], off: ['a|/de/shop|Shop'] } }
    expect(rt.a11y03([file('SC-00', [probe()], 'motion', ext)]).status).toBe('PASS')
    expect(
      rt.a11y03([
        file('SC-00', [probe({ deco: { hidden: true, focusable: 1, count: 1 } })], 'motion', ext),
      ]).status,
    ).toBe('FAIL')
  })

  it('A11Y-04: axe serious → FAIL; A11Y-06: Transition auf der Kasse → FAIL', () => {
    const axe = (impact: string) =>
      ['motion', 'reduced'].map((variant) => ({
        sc: 'SC-00',
        profile: 'art-pixel7',
        variant,
        label: 'r01',
        url: '/de',
        violations: [{ id: 'x', impact, nodes: 1 }],
      }))
    expect(rt.a11y04(axe('minor')).status).toBe('PASS')
    expect(rt.a11y04(axe('serious')).status).toBe('FAIL')
    expect(rt.a11y06([file('SC-06', [probe({ url: '/de/kasse' })])]).status).toBe('PASS')
    expect(rt.a11y06([file('SC-06', [probe({ url: '/de/kasse', transitions: 2 })])]).status).toBe(
      'FAIL',
    )
  })

  it('A11Y-07: Fokusring von der Kauf-Leiste verdeckt scheitert', () => {
    const f = (hits: string[]) => file('SC-03', [probe({ focus: { desc: 'a', ring: true, hits } })])
    expect(rt.a11y07([f(['self', 'self', 'self', 'self'])]).status).toBe('PASS')
    expect(rt.a11y07([f(['self', 'buybar', 'self', 'self'])]).status).toBe('FAIL')
  })

  it('CT-03 Stempel < 3:1 scheitert; RZ-02 „In den Korb“ im Tattoo-Bereich scheitert', () => {
    expect(
      rt.ct03([file('SC-04', [probe({ badges: [{ sel: 'stamp', ratio: 2.5, size: 28 }] })])])
        .status,
    ).toBe('FAIL')
    expect(rt.rz02([file('SC-08', [probe({ url: '/de/tattoo/flash' })])]).status).toBe('PASS')
    expect(
      rt.rz02([
        file('SC-08', [probe({ url: '/de/tattoo/flash', commerce: { price: 0, addToCart: 1 } })]),
      ]).status,
    ).toBe('FAIL')
  })
})
