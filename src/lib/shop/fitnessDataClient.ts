// Abruf der Fitness-Coco-Bildfolge im Browser (P12.5): nur die versionierte Datei `/art/fitness-coco.v{N}.json`, ohne
// Cookie und Referrer. Die App reicht sie über `BehaviorHost` als `ctx.actions.fitnessData` an das Modul `fitness-coco`
// herein – die Vorschau-Laufzeit enthält so keinen Netzcode (AK-A-2-03). Framework-frei.

const PATH = /^\/art\/fitness-coco\.v\d+\.json$/

export async function fetchFitnessData(url: string): Promise<unknown> {
  if (!PATH.test(url)) return null
  const res = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' })
  return res.ok ? ((await res.json()) as unknown) : null
}
