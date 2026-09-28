import React from 'react'

import { Callout } from '@/components/ui/Callout'
import type { ContactInfo } from '@/lib/data/contact'
import type { Locale } from '@/lib/routes/registry'
import type { Page } from '@/payload-types'

import { ContactLinks } from './ContactLinks'
import { RichTextContent } from './RichTextContent'

// Blöcke einer `pages`-Seite (DATENMODELL §6.19) als Server-HTML. Bisher: `richText`, `callout`, `contactLinks`
// (Kontakt R20, Einleitung R27). Weitere Blocktypen rendern die Phasen ihrer Seiten (Startseite P2.20, FAQ-Listen,
// Galerien usw.); bis dahin werden sie übersprungen.
export type PageBlock = NonNullable<Page['layout']>[number]

export function PageBlocks({
  blocks,
  locale,
  contact,
}: {
  blocks: readonly PageBlock[] | null | undefined
  locale: Locale
  /** Kontaktwege für `contactLinks`; ohne Angabe wird der Block übersprungen. */
  contact?: ContactInfo
}) {
  return (
    <>
      {(blocks ?? []).map((block, i) => {
        const key = block.id ?? `${block.blockType}-${i}`
        switch (block.blockType) {
          case 'richText':
            return <RichTextContent key={key} data={block.content} />
          case 'callout':
            return (
              <Callout key={key} variant="info">
                <p>{block.text}</p>
              </Callout>
            )
          case 'contactLinks':
            return contact ? (
              <ContactLinks
                key={key}
                locale={locale}
                contact={contact}
                heading={block.heading}
                showEmail={block.showEmail}
                showInstagram={block.showInstagram}
                showDistrict={block.showDistrict}
                emailSubject={block.emailSubject}
              />
            ) : null
          default:
            return null
        }
      })}
    </>
  )
}
