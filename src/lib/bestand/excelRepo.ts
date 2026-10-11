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
  const revert = (i: number, why: string) => {
    const nr = before[i]!.itemNumber
    out[i] = structuredClone(before[i]!)
    const prefix = `Nr. ${nr}:`
    report.changes = report.changes.filter((c) => !c.startsWith(prefix))
    report.englishTodo = report.englishTodo.filter((c) => !c.startsWith(prefix))
    report.problems.push(`Nr. ${nr}: Änderungen an diesem Stück nicht übernommen – ${why}.`)
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
