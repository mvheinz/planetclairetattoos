import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import React from 'react'

import { SiteDocument } from '@/components/layout/SiteDocument'

// Eigenes Wurzel-Layout der Entwurfs-Vorschau (PLAN P5.6, KONZEPT §7.4 „Vorschau“): Die Produktseite eines Entwurfs
// wird mit dem Rahmen der öffentlichen Website gerendert, aber unter dem Verwaltungspfad (`ADMIN_ROUTE/stuecke/:id/
// vorschau`, intern `/admin/…`) – nur für die angemeldete Verwaltung, ohne Draft-Mode-Cookie auf der öffentlichen Domain.

export const metadata: Metadata = {
  title: 'Vorschau',
  robots: { index: false, follow: false },
}

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  setRequestLocale('de')
  return <SiteDocument locale="de">{children}</SiteDocument>
}
