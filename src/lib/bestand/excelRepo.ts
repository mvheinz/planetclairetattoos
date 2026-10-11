import 'server-only'

import type { PflegeReport } from '@/lib/pflege/merge'

import { bestandProductSchema, bestandSchema, type BestandProduct } from './schema'

// Rückweg der Bestandsliste vor dem Start (U-85, U-89): Nach dem Übernehmen muss `content/bestand/products.json` gültig
// bleiben. Ein Stück, das durch Juttas Änderungen ungültig würde (z. B. Name schon vergeben), bleibt auf dem alten Stand –
// mit Meldung; die übrigen Änderungen gelten trotzdem (eine falsche Zelle hält nicht die ganze Liste auf).

const same = (a: BestandProduct, b: BestandProduct) => JSON.stringify(a) === JSON.stringify(b)

export function keepValid(
  before: readonly BestandProduct[],
  next: readonly BestandProduct[],
  report: PflegeReport,
): { products: BestandProduct[]; ok: boolean } {
  const out = next.map((p) => p)
  /**
   * Stück auf den alten Stand setzen. „Verkauft“ und „Deine Notiz“ bleiben, wenn das Stück damit gültig ist – ein
   * Markt-Verkauf darf nie an einer anderen falschen Zelle scheitern (sonst droht ein Doppelverkauf).
   */
  const revert = (i: number, why: string) => {
    const old = before[i]!
    const nr = old.itemNumber
    const prefix = `Nr. ${nr}:`
    const keep = structuredClone(old)
    for (const f of ['sold', 'ownerNote'] as const) {
      if (out[i]![f] === undefined) delete keep[f]
      else (keep as Record<string, unknown>)[f] = structuredClone(out[i]![f])
    }
    const kept = bestandProductSchema.safeParse(keep).success && !same(keep, old)
    out[i] = kept ? keep : structuredClone(old)
    const stays = (c: string) =>
      kept && (c.startsWith(`${prefix} Verkauft`) || c.startsWith(`${prefix} Deine Notiz`))
    report.changes = report.changes.filter((c) => !c.startsWith(prefix) || stays(c))
    report.englishTodo = report.englishTodo.filter((c) => !c.startsWith(prefix))
    report.problems.push(
      `${prefix} Änderungen an diesem Stück nicht übernommen – ${why}${kept ? ' („Verkauft“ und „Deine Notiz“ schon)' : ''}.`,
    )
    if (!kept && out[i]!.sold === undefined && next[i]!.sold !== undefined)
      report.problems.push(`${prefix} „Verkauft“ ist NICHT eingetragen – bitte im Chat bestätigen.`)
  }
  out.forEach((p, i) => {
    if (same(p, before[i]!)) return
    const r = bestandProductSchema.safeParse(p)
    if (!r.success)
      revert(i, r.error.issues.map((x) => x.message.replace(/^B\d{3}: /, '')).join('; '))
  })
  // Namen müssen eindeutig bleiben (DE und EN)
  for (const lang of ['de', 'en'] as const) {
    out.forEach((p, i) => {
      if (same(p, before[i]!) || p.title[lang] === before[i]!.title[lang]) return
      const other = out.find((q, j) => j !== i && q.title[lang] === p.title[lang])
      if (other) revert(i, `den Namen „${p.title[lang]}“ hat schon Nr. ${other.itemNumber}`)
    })
  }
  return { products: out, ok: bestandSchema.safeParse(out).success }
}
