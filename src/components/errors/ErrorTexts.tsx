'use client'

import React, { createContext, useContext } from 'react'

import { DEFAULT_LOCALE, type Locale } from '@/lib/routes/registry'

// Texte der Fehlerseite R29 für das Client-Boundary `[locale]/error.tsx` (P2.23, Tempo-Budget ARCHITEKTUR §7.7):
// Das Layout übersetzt die vier Texte serverseitig und reicht nur diese an den Client. So braucht keine Client-
// Komponente `next-intl` (NextIntlClientProvider samt ICU-Formatierer und allen Sprachtexten fiele sonst ins
// Erstlade-JavaScript jeder Seite).

export interface ErrorTexts {
  locale: Locale
  serverErrorTitle: string
  serverErrorText: string
  retry: string
  toHome: string
}

const FALLBACK: ErrorTexts = {
  locale: DEFAULT_LOCALE,
  serverErrorTitle: '',
  serverErrorText: '',
  retry: '',
  toHome: '',
}

const ErrorTextsContext = createContext<ErrorTexts>(FALLBACK)

export function ErrorTextsProvider({
  value,
  children,
}: {
  value: ErrorTexts
  children: React.ReactNode
}) {
  return <ErrorTextsContext.Provider value={value}>{children}</ErrorTextsContext.Provider>
}

export const useErrorTexts = (): ErrorTexts => useContext(ErrorTextsContext)
