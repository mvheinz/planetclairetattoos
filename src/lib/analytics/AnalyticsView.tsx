'use client'

import { Analytics } from '@vercel/analytics/next'
import React from 'react'

import { analyticsBeforeSend } from './beforeSend'

// Client-Teil der Statistik (über `AnalyticsClient` nachgeladen, nur wenn `AnalyticsSlot` alles freigegeben hat). Kein
// Speed Insights, keine Custom Events; `beforeSend` filtert Seiten und Query-Parameter.
export function AnalyticsView() {
  return <Analytics mode="production" beforeSend={analyticsBeforeSend} />
}
