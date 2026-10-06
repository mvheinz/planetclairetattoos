'use client'

import { Analytics } from '@vercel/analytics/next'
import React from 'react'

import { analyticsBeforeSend } from './beforeSend'

// Client-Teil der Statistik (nur von `AnalyticsSlot` eingebunden, wenn alles freigegeben ist). Kein Speed Insights, keine
// Custom Events; `beforeSend` filtert Seiten und Query-Parameter.
export function AnalyticsClient() {
  return <Analytics mode="production" beforeSend={analyticsBeforeSend} />
}
