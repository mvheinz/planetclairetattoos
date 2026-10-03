import type { FullConfig } from '@playwright/test'

// Vor der Aufnahme (KUNST-QA §4.1): Der Server muss der QA-Build sein (`pnpm art:build` → `ART_QA=1`); sonst bricht die
// Aufnahme mit einer klaren Meldung ab statt lauter 404-Bilder zu erzeugen.
export default async function globalSetup(config: FullConfig): Promise<void> {
  if (process.env.ART_NO_SERVER) return
  const baseURL = config.projects[0]?.use.baseURL
  if (!baseURL) return
  const res = await fetch(`${baseURL}/de/qa/coco`).catch(() => null)
  if (!res || res.status !== 200)
    throw new Error(
      `Kunst-QA: ${baseURL}/de/qa/coco antwortet ${res?.status ?? 'nicht'} – Server ohne ART_QA=1 oder kein QA-Build (pnpm art:build).`,
    )
}
