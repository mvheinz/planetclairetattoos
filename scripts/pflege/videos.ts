// Bewegungen als kurze Videos fürs iPad (V-66, U-93; PLAN P20.2). Die große Vorschau läuft am iPad nicht, und der
// Rundgang ist fotografiert – Coco, Leine und Koko sieht Jutta nur als Video. Nach jeder Änderung an Bewegungen
// schickt die Sitzung ihr die Videos (RUNBOOK §16, docs/owner/IPAD.md „F“).
//   pnpm pflege:videos [shop] [start] [alle] [--url=http://localhost:3000] [--sekunden=40] [--geraet=handy|gross]
//   → dist/videos/planet-claire-<szene>-<geraet>-<Tag>.mp4 (H.264, yuv420p, +faststart, ohne Ton)
// Voraussetzung: ein laufender Server (`pnpm dev` oder `pnpm start`). Adresse aus `--url=`, sonst `VIDEO_BASE_URL`,
// sonst http://localhost:3000. Aufnahme mit Playwright (`recordVideo`, Handy 390 × 844 und großer Bildschirm
// 1280 × 800, volle Bewegung), Umwandlung WebM → MP4 mit ffmpeg aus `FFMPEG_PATH` bzw. dem PATH. Ohne ffmpeg bleibt die
// WebM-Datei liegen, mit Hinweis. Videos nie committen (`/dist` ist ignoriert).
import { spawnSync } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { chromium, type Browser, type Page } from '@playwright/test'

import { berlinDay } from '../../src/lib/pflege/snapshot'

export const VIDEO_OUT = path.join('dist', 'videos')
export const DEFAULT_VIDEO_BASE_URL = 'http://localhost:3000'

export const VIDEO_DEVICES = [
  { key: 'handy', label: 'Handy', width: 390, height: 844, mobile: true },
  { key: 'gross', label: 'Großer Bildschirm', width: 1280, height: 800, mobile: false },
] as const
export type VideoDevice = (typeof VIDEO_DEVICES)[number]
export type VideoDeviceKey = VideoDevice['key']

/** Szenen: Seite, Titel und Länge in Sekunden (ab geladener Seite). */
export const VIDEO_SCENES = {
  /** Kleine Coco im Shop: kurz scrollen, dann stehen bleiben – Warte-Aktionen und Pausen (P20.1). */
  shop: { path: '/de/shop', title: 'Coco im Shop', seconds: 40 },
  /** Startseite: langsam nach unten – die Leine folgt, Koko an den Stationen. */
  start: { path: '/de', title: 'Startseite mit Leine und Koko', seconds: 30 },
} as const
export type VideoSceneKey = keyof typeof VIDEO_SCENES
const SCENE_KEYS = Object.keys(VIDEO_SCENES) as VideoSceneKey[]

export interface VideoArgs {
  baseUrl: string
  scenes: VideoSceneKey[]
  devices: VideoDeviceKey[]
  /** Feste Länge für alle Szenen (5–120 s); `null` = Länge der Szene. */
  seconds: number | null
}

export const VIDEO_USAGE =
  'Aufruf: pnpm pflege:videos [shop] [start] [alle] [--url=http://localhost:3000] [--sekunden=40] [--geraet=handy|gross]'

/** Argumente und Umgebung lesen (rein). Unbekanntes → Fehler mit Aufrufhinweis. */
export function parseVideoArgs(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>> = {},
): VideoArgs {
  const scenes = new Set<VideoSceneKey>()
  let url = env.VIDEO_BASE_URL?.trim() || DEFAULT_VIDEO_BASE_URL
  let seconds: number | null = null
  let devices: VideoDeviceKey[] = VIDEO_DEVICES.map((d) => d.key)
  for (const arg of argv) {
    if (arg === '--') continue // `pnpm pflege:videos -- …`
    const [flag, value] = arg.startsWith('--')
      ? [arg.slice(2).split('=')[0], arg.split('=').slice(1).join('=')]
      : []
    if (arg === 'alle') SCENE_KEYS.forEach((s) => scenes.add(s))
    else if ((SCENE_KEYS as string[]).includes(arg)) scenes.add(arg as VideoSceneKey)
    else if (flag === 'url' && value) url = value
    else if (flag === 'sekunden' && value) {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 5 || n > 120)
        throw new Error(`--sekunden=${value}: bitte eine ganze Zahl von 5 bis 120.\n${VIDEO_USAGE}`)
      seconds = n
    } else if (flag === 'geraet' && value) {
      const keys = VIDEO_DEVICES.map((d) => d.key) as string[]
      if (!keys.includes(value))
        throw new Error(`--geraet=${value}: handy oder gross.\n${VIDEO_USAGE}`)
      devices = [value as VideoDeviceKey]
    } else throw new Error(`Unbekannte Angabe „${arg}“.\n${VIDEO_USAGE}`)
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Adresse „${url}“ ist ungültig.\n${VIDEO_USAGE}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    throw new Error(`Adresse „${url}“: nur http:// oder https://.`)
  return {
    baseUrl: parsed.origin + parsed.pathname.replace(/\/+$/, ''),
    scenes: scenes.size > 0 ? SCENE_KEYS.filter((s) => scenes.has(s)) : ['shop'],
    devices,
    seconds,
  }
}

const isExecutable = (file: string): boolean => {
  try {
    accessSync(file, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/**
 * ffmpeg finden: `FFMPEG_PATH` (muss ausführbar sein), sonst `ffmpeg` in einem Ordner des PATH. `null` = keins da.
 */
export function findFfmpeg(
  env: Readonly<Record<string, string | undefined>>,
  executable: (file: string) => boolean = isExecutable,
  platform: NodeJS.Platform = process.platform,
): string | null {
  const explicit = env.FFMPEG_PATH?.trim()
  if (explicit) return executable(explicit) ? explicit : null
  const names = platform === 'win32' ? ['ffmpeg.exe', 'ffmpeg'] : ['ffmpeg']
  const sep = platform === 'win32' ? ';' : ':'
  for (const dir of (env.PATH ?? '').split(sep).filter(Boolean)) {
    for (const name of names) {
      const file = path.join(dir, name)
      if (executable(file)) return file
    }
  }
  return null
}

/**
 * ffmpeg-Aufruf WebM → MP4 fürs iPad: H.264 (`libx264`), `yuv420p` (sonst spielt Safari nicht), `+faststart` (spielt
 * schon beim Laden), CRF 28 (klein genug für den Chat), ohne Ton, gerade Kantenlängen. `startSeconds` schneidet den
 * leeren Anfang ab (Aufnahme läuft schon, während die Seite lädt).
 */
export function ffmpegArgs(input: string, output: string, startSeconds = 0): string[] {
  return [
    '-y',
    '-loglevel',
    'error',
    '-i',
    input,
    ...(startSeconds > 0 ? ['-ss', startSeconds.toFixed(2)] : []),
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '28',
    '-pix_fmt',
    'yuv420p',
    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-movflags',
    '+faststart',
    output,
  ]
}

/** Dateiname: `planet-claire-<szene>-<geraet>-<JJJJ-MM-TT>.<endung>`. */
export function videoFileName(
  scene: VideoSceneKey,
  device: VideoDeviceKey,
  day: string,
  ext: 'mp4' | 'webm',
): string {
  return `planet-claire-${scene}-${device}-${day}.${ext}`
}

export const FFMPEG_HINT =
  'Hinweis: ffmpeg nicht gefunden – die Videos liegen als WebM vor (spielt am iPad nicht in jeder App). Für MP4 ' +
  'ffmpeg installieren (z. B. `sudo apt-get install ffmpeg` oder `brew install ffmpeg`) oder FFMPEG_PATH=/pfad/zu/ffmpeg ' +
  'setzen und `pnpm pflege:videos` noch einmal starten.'

/** Hinweis ohne ffmpeg; ist `FFMPEG_PATH` gesetzt, aber nicht ausführbar, steht das zuerst da (kein stiller Rückfall). */
export function ffmpegHint(env: Readonly<Record<string, string | undefined>>): string {
  const explicit = env.FFMPEG_PATH?.trim()
  return explicit
    ? `Hinweis: FFMPEG_PATH=${explicit} ist keine ausführbare Datei. ${FFMPEG_HINT.replace(/^Hinweis: /, '')}`
    : FFMPEG_HINT
}

/** Szene abspielen; `until` = Zeitpunkt (ms), bis zu dem die Aufnahme läuft. */
async function play(page: Page, scene: VideoSceneKey, until: number): Promise<void> {
  const rest = () => Math.max(0, until - Date.now())
  if (scene === 'shop') {
    // Ankommen, ein Stück scrollen (Coco reagiert), dann stehen bleiben (Warte-Aktionen mit Pausen)
    await page.waitForTimeout(4000)
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 60)
      await page.waitForTimeout(250)
    }
    await page.waitForTimeout(rest())
    return
  }
  // Startseite: langsam bis zum Ende scrollen (etwa zwei Drittel der Zeit), dann stehen bleiben
  await page.waitForTimeout(3000)
  const scrollUntil = Date.now() + rest() * 0.7
  while (Date.now() < scrollUntil) {
    const atEnd = await page.evaluate(
      () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2,
    )
    if (atEnd) break
    await page.mouse.wheel(0, 90)
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(rest())
}

/** Eine Aufnahme; Ergebnis: WebM-Datei und Sekunden bis zur geladenen Seite (zum Abschneiden). */
async function record(
  browser: Browser,
  baseUrl: string,
  scene: VideoSceneKey,
  device: VideoDevice,
  seconds: number,
  dir: string,
): Promise<{ webm: string; lead: number }> {
  const size = { width: device.width, height: device.height }
  const started = Date.now()
  const ctx = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 1,
    isMobile: device.mobile,
    hasTouch: device.mobile,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    // Volle Bewegung – darum geht es (die Rundgang-Fotos nutzen reduzierte Bewegung)
    reducedMotion: 'no-preference',
    recordVideo: { dir, size },
  })
  try {
    const page = await ctx.newPage()
    await page.goto(`${baseUrl}${VIDEO_SCENES[scene].path}`, {
      waitUntil: 'load',
      timeout: 120_000,
    })
    const lead = (Date.now() - started) / 1000 + 0.3
    await play(page, scene, Date.now() + seconds * 1000)
    const video = page.video()
    await ctx.close()
    if (!video) throw new Error('Playwright hat kein Video aufgenommen.')
    return { webm: await video.path(), lead }
  } catch (err) {
    await ctx.close().catch(() => undefined)
    throw err
  }
}

/** Erreichbarkeit des Servers prüfen, bevor ein Browser startet. */
async function assertReachable(baseUrl: string): Promise<void> {
  try {
    const res = await fetch(baseUrl + VIDEO_SCENES.shop.path, {
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    throw new Error(
      `Server unter ${baseUrl} nicht erreichbar (${err instanceof Error ? err.message : String(err)}) – erst ` +
        '`pnpm dev` (oder `pnpm start`) starten bzw. `--url=` angeben.',
    )
  }
}

async function main(argv: readonly string[]): Promise<void> {
  const root = process.cwd()
  const args = parseVideoArgs(argv, process.env)
  await assertReachable(args.baseUrl)
  const ffmpeg = findFfmpeg(process.env)
  const out = path.join(root, VIDEO_OUT)
  const raw = path.join(out, '.aufnahme')
  await mkdir(raw, { recursive: true })
  const day = berlinDay(new Date())
  const written: string[] = []
  const browser = await chromium.launch()
  try {
    for (const scene of args.scenes) {
      for (const device of VIDEO_DEVICES.filter((d) => args.devices.includes(d.key))) {
        const seconds = args.seconds ?? VIDEO_SCENES[scene].seconds
        console.log(`Aufnahme: ${VIDEO_SCENES[scene].title} · ${device.label} · ${seconds} s …`)
        const { webm, lead } = await record(browser, args.baseUrl, scene, device, seconds, raw)
        if (ffmpeg) {
          const mp4 = path.join(out, videoFileName(scene, device.key, day, 'mp4'))
          const res = spawnSync(ffmpeg, ffmpegArgs(webm, mp4, lead), { encoding: 'utf8' })
          if (res.status !== 0)
            throw new Error(
              `ffmpeg ist gescheitert (${res.status ?? res.error?.message}): ${res.stderr}`,
            )
          await rm(webm, { force: true })
          written.push(mp4)
        } else {
          const target = path.join(out, videoFileName(scene, device.key, day, 'webm'))
          await rename(webm, target)
          written.push(target)
        }
      }
    }
  } finally {
    await browser.close()
    // Rohaufnahmen (auch abgebrochene) nicht liegen lassen
    await rm(raw, { recursive: true, force: true })
  }
  for (const file of written) {
    const { size } = await stat(file)
    console.log(`${path.relative(root, file)} (${(size / 1024 / 1024).toFixed(1)} MB)`)
  }
  if (!ffmpeg) console.log(ffmpegHint(process.env))
  console.log('An Jutta schicken (Chat, SendUserFile) – Videos nie committen.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main(process.argv.slice(2))
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  }
}
