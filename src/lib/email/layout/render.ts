import 'server-only'

import type { ReactElement } from 'react'

import { renderStaticMarkup } from '@/lib/react/staticMarkup'

// HTML der Mails: React-Komponenten, gerendert mit `react-dom/server` `renderToStaticMarkup` (keine eigene
// Mail-Bibliothek, P4.13; Laden am Bundler vorbei: `src/lib/react/staticMarkup.ts`). Die Mail-Komponenten sind reine
// Funktionen ohne Hooks.

export async function renderMailHtml(element: ReactElement): Promise<string> {
  return `<!DOCTYPE html>${await renderStaticMarkup(element)}`
}
