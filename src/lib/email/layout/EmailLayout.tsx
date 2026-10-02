import 'server-only'

import type { ReactNode } from 'react'

import type { Locale } from '@/lib/enums'

import { CidImage } from './CidImage'
import { S } from './styles'

// Grundgerüst jeder Mail (KONZEPT §6.1): einspaltig, ≤ 600 px, Inline-Stile, keine externen Ressourcen, keine
// Tracking-Pixel. Bilder nur per CID (`cid:…`).

export interface EmailLayoutProps {
  locale: Locale
  title: string
  /** Kurzer Vorschautext im Postfach (unsichtbar). */
  preheader?: string
  /** CID eines eingebetteten Bildes über dem Inhalt (Coco-Vignette), optional. */
  vignetteCid?: string | null
  vignetteAlt?: string
  children?: ReactNode
  footer: ReactNode
}

export function EmailLayout(props: EmailLayoutProps) {
  return (
    <html lang={props.locale}>
      {/* Mail-HTML, keine Next-Seite */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
      </head>
      <body style={S.body}>
        {props.preheader ? (
          <div style={{ display: 'none', maxHeight: 0, overflow: 'hidden' }}>{props.preheader}</div>
        ) : null}
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={S.outer}>
          <tbody>
            <tr>
              <td align="center">
                <table
                  role="presentation"
                  width={600}
                  cellPadding={0}
                  cellSpacing={0}
                  style={S.container}
                >
                  <tbody>
                    <tr>
                      <td style={S.cell}>
                        {props.vignetteCid ? (
                          <CidImage
                            cid={props.vignetteCid}
                            alt={props.vignetteAlt ?? ''}
                            width={96}
                            height={72}
                          />
                        ) : null}
                        <h1 style={S.h1}>{props.title}</h1>
                        {props.children}
                      </td>
                    </tr>
                    <tr>
                      <td style={S.footer}>{props.footer}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  )
}
