import type { LoopKind, SpritePose } from '@/leash/types'
import { PRESETS, type PresetId } from '@/lib/routes/registry'

// Parameter der synthetischen Langseite `/qa/leash?preset=…&stations=…` (KUNST-QA §3.2).

export const QA_LEASH_LOOPS: readonly LoopKind[] = [
  'right',
  'lasso',
  'left',
  'spiral',
  'right',
  'contour',
  'none',
]
export const QA_LEASH_POSES: readonly SpritePose[] = [
  'sitzen',
  'schnueffeln',
  'rennen',
  'kopfschief',
  'springen',
  'sitzen',
  'schlafen',
]

export function parseLeashQuery(q: Record<string, string | string[] | undefined>): {
  preset: PresetId
  stations: number
} {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const p = one(q.preset)
  const n = Number.parseInt(one(q.stations) ?? '', 10)
  return {
    preset: (PRESETS as readonly string[]).includes(p ?? '') ? (p as PresetId) : 'journey',
    stations: Number.isFinite(n) ? Math.min(20, Math.max(1, n)) : 7,
  }
}
