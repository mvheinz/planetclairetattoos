import type { Metadata } from 'next'
import React from 'react'

// QA-Bereich (KUNST-QA §3.2): nie indexieren; jede Seite prüft selbst `ART_QA` (`requireArtQa`).
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function QaLayout({ children }: { children: React.ReactNode }) {
  return children
}
