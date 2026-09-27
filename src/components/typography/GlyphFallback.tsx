import React from 'react'

import { splitGlyphRuns } from '@/styles/glyphs'

// Setzt Zeichen, die Mansalva nicht hat, in Bricolage 600 (DESIGN §4.4) – nie Systemschrift-Mischung. Nur für Text in
// Mansalva (Überschriften, Preisschild, Stempel). Ohne fehlende Zeichen bleibt der Text unverändert (kein Wrapper).
export function GlyphFallback({ children }: { children: string }) {
  const runs = splitGlyphRuns(children)
  if (runs.every((r) => !r.fallback)) return <>{children}</>
  return (
    <>
      {runs.map((run, i) =>
        run.fallback ? (
          <span key={i} className="glyph-fallback">
            {run.text}
          </span>
        ) : (
          <React.Fragment key={i}>{run.text}</React.Fragment>
        ),
      )}
    </>
  )
}
