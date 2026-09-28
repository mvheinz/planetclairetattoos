// Bündelt die Vorschau-Laufzeit `src/preview-runtime/main.ts` mit esbuild (ARCHITEKTUR §14.6): `iife`, Ziel
// Safari 16.4 / Chrome 111 / Firefox 111, minifiziert, ohne Lizenzkommentare, ≤ 300 KB. Import von `react`/`next`/
// `payload` ist ein Fehler (AK-A-2-03); dynamische Importe löst esbuild beim Bündeln auf (eine Datei, kein Nachladen).
import path from 'node:path'

import { build, type Plugin } from 'esbuild'

import { ExportError } from './errors'

export const RUNTIME_ENTRY = 'src/preview-runtime/main.ts'
export const RUNTIME_MAX_BYTES = 300_000

const FORBIDDEN = /^(react|react-dom|next|payload|@payloadcms)(\/|$)/

const forbidFrameworks: Plugin = {
  name: 'pv-forbid-frameworks',
  setup(b) {
    b.onResolve({ filter: FORBIDDEN }, (args) => ({
      errors: [{ text: `Vorschau-Laufzeit darf ${args.path} nicht importieren (AK-A-2-03).` }],
    }))
  },
}

export interface RuntimeBundle {
  code: string
  bytes: number
  /** Alle gebündelten Quelldateien (relativ zum Repo). */
  inputs: string[]
}

export async function bundleRuntime(root = process.cwd()): Promise<RuntimeBundle> {
  const result = await build({
    entryPoints: [path.join(root, RUNTIME_ENTRY)],
    bundle: true,
    write: false,
    format: 'iife',
    target: ['safari16.4', 'chrome111', 'firefox111'],
    minify: true,
    legalComments: 'none',
    platform: 'browser',
    metafile: true,
    logLevel: 'silent',
    absWorkingDir: root,
    plugins: [forbidFrameworks],
    define: { 'process.env.NODE_ENV': '"production"' },
  }).catch((e: unknown) => {
    throw new ExportError(
      1,
      `Vorschau-Laufzeit lässt sich nicht bündeln: ${e instanceof Error ? e.message : e}`,
    )
  })
  const code = result.outputFiles[0]!.text.trim()
  const bytes = Buffer.byteLength(code)
  if (bytes > RUNTIME_MAX_BYTES) {
    throw new ExportError(
      1,
      `Vorschau-Laufzeit ist ${bytes} Byte groß (Grenze ${RUNTIME_MAX_BYTES}).`,
    )
  }
  return { code, bytes, inputs: Object.keys(result.metafile.inputs).sort() }
}
