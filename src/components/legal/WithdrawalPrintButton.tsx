'use client'

import React from 'react'

import { Button } from '@/components/ui/Button'

/** „Drucken“ im Ergebnis der Widerrufsfunktion R26 (eigene Datei: gehört nie zum JS beim ersten Laden). */
export function WithdrawalPrintButton({ label }: { label: string }) {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      {label}
    </Button>
  )
}
