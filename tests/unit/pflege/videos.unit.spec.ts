import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_VIDEO_BASE_URL,
  FFMPEG_HINT,
  ffmpegArgs,
  ffmpegHint,
  findFfmpeg,
  parseVideoArgs,
  VIDEO_DEVICES,
  VIDEO_OUT,
  VIDEO_SCENES,
  videoFileName,
} from '../../../scripts/pflege/videos'

// P20.2 (V-66, U-93): Bewegungen als kurze Videos fürs iPad – `pnpm pflege:videos` nimmt gegen einen laufenden Server
// auf (Handy und großer Bildschirm) und wandelt mit ffmpeg in MP4 (H.264) um; ohne ffmpeg bleibt WebM.

describe('pflege:videos – Aufruf', () => {
  it('Standard: Coco im Shop, beide Geräte, http://localhost:3000, Länge der Szene', () => {
    expect(parseVideoArgs([], {})).toEqual({
      baseUrl: DEFAULT_VIDEO_BASE_URL,
      scenes: ['shop'],
      devices: ['handy', 'gross'],
      seconds: null,
    })
    expect(DEFAULT_VIDEO_BASE_URL).toBe('http://localhost:3000')
    expect(VIDEO_SCENES.shop).toMatchObject({ path: '/de/shop', seconds: 40 })
    expect(VIDEO_SCENES.start.path).toBe('/de')
  })

  it('Adresse: --url vor VIDEO_BASE_URL, ohne Schrägstrich am Ende; nur http(s)', () => {
    expect(parseVideoArgs([], { VIDEO_BASE_URL: 'http://localhost:3210/' }).baseUrl).toBe(
      'http://localhost:3210',
    )
    expect(
      parseVideoArgs(['--url=https://vorschau.example.org/'], {
        VIDEO_BASE_URL: 'http://localhost:3210',
      }).baseUrl,
    ).toBe('https://vorschau.example.org')
    expect(parseVideoArgs([], { VIDEO_BASE_URL: '  ' }).baseUrl).toBe(DEFAULT_VIDEO_BASE_URL)
    expect(() => parseVideoArgs(['--url=kein-link'])).toThrow(/ungültig/)
    expect(() => parseVideoArgs(['--url=file:///tmp/x'])).toThrow(/http/)
  })

  it('Szenen, Länge und Gerät', () => {
    expect(parseVideoArgs(['start', 'shop']).scenes).toEqual(['shop', 'start'])
    expect(parseVideoArgs(['alle']).scenes).toEqual(['shop', 'start'])
    expect(parseVideoArgs(['--', 'start']).scenes).toEqual(['start'])
    expect(parseVideoArgs(['--sekunden=12']).seconds).toBe(12)
    expect(parseVideoArgs(['--geraet=handy']).devices).toEqual(['handy'])
    expect(() => parseVideoArgs(['--sekunden=2'])).toThrow(/5 bis 120/)
    expect(() => parseVideoArgs(['--sekunden=abc'])).toThrow(/5 bis 120/)
    expect(() => parseVideoArgs(['--geraet=tablet'])).toThrow(/handy oder gross/)
    expect(() => parseVideoArgs(['zeichnungen'])).toThrow(/Unbekannte Angabe/)
  })

  it('Geräte: Handy 390 × 844 und großer Bildschirm 1280 × 800; Ablage dist/videos (nie committet)', () => {
    expect(VIDEO_DEVICES.map((d) => [d.key, d.width, d.height, d.mobile])).toEqual([
      ['handy', 390, 844, true],
      ['gross', 1280, 800, false],
    ])
    expect(VIDEO_OUT).toBe(path.join('dist', 'videos'))
    expect(videoFileName('shop', 'handy', '2026-10-12', 'mp4')).toBe(
      'planet-claire-shop-handy-2026-10-12.mp4',
    )
    expect(videoFileName('start', 'gross', '2026-10-12', 'webm')).toBe(
      'planet-claire-start-gross-2026-10-12.webm',
    )
  })
})

describe('pflege:videos – ffmpeg', () => {
  it('FFMPEG_PATH zuerst, sonst ffmpeg im PATH; nichts da → null (WebM bleibt)', () => {
    const exe = (files: string[]) => (f: string) => files.includes(f)
    expect(findFfmpeg({ FFMPEG_PATH: '/opt/ff/ffmpeg' }, exe(['/opt/ff/ffmpeg']))).toBe(
      '/opt/ff/ffmpeg',
    )
    // gesetzt, aber nicht ausführbar: kein stiller Rückfall auf ein anderes ffmpeg
    expect(
      findFfmpeg({ FFMPEG_PATH: '/fehlt/ffmpeg', PATH: '/usr/bin' }, exe(['/usr/bin/ffmpeg'])),
    ).toBeNull()
    expect(
      findFfmpeg({ PATH: '/bin:/usr/local/bin' }, exe(['/usr/local/bin/ffmpeg']), 'linux'),
    ).toBe(path.join('/usr/local/bin', 'ffmpeg'))
    expect(findFfmpeg({ PATH: '/bin' }, exe([]), 'linux')).toBeNull()
    expect(findFfmpeg({}, exe([]))).toBeNull()
    // Hinweis nennt ein gesetztes, aber unbrauchbares FFMPEG_PATH ausdrücklich
    expect(ffmpegHint({})).toBe(FFMPEG_HINT)
    expect(ffmpegHint({ FFMPEG_PATH: '/fehlt/ffmpeg' })).toMatch(
      /^Hinweis: FFMPEG_PATH=\/fehlt\/ffmpeg ist keine ausführbare Datei\. ffmpeg nicht gefunden/,
    )
  })

  it('MP4 fürs iPad: H.264, yuv420p, +faststart, CRF 28, ohne Ton, gerade Kanten; leerer Anfang abgeschnitten', () => {
    const args = ffmpegArgs('in.webm', 'out.mp4', 1.234)
    const after = (flag: string) => args[args.indexOf(flag) + 1]
    expect(args[0]).toBe('-y')
    expect(after('-i')).toBe('in.webm')
    expect(after('-c:v')).toBe('libx264')
    expect(after('-pix_fmt')).toBe('yuv420p')
    expect(after('-movflags')).toBe('+faststart')
    expect(after('-crf')).toBe('28')
    expect(after('-ss')).toBe('1.23')
    expect(args.indexOf('-ss')).toBeGreaterThan(args.indexOf('-i'))
    expect(args).toContain('-an')
    expect(after('-vf')).toBe('scale=trunc(iw/2)*2:trunc(ih/2)*2')
    expect(args.at(-1)).toBe('out.mp4')
    expect(ffmpegArgs('a.webm', 'b.mp4')).not.toContain('-ss')
  })
})
