import { redirect } from 'next/navigation'
import React from 'react'

import { Notice } from '../../components/Notice'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { FlashTab } from './FlashTab'
import { GalleryTab } from './GalleryTab'
import { TATTOO_TABS, type TattooTab, tattooText } from './tattooText'
import { TextsTab } from './TextsTab'

// Ansicht „Tattoo“ `/tattoo` (PLAN P7.6–P7.9, KONZEPT §7.12): Reiter Flash · Galerie · Texte als Links
// (`?reiter=…`, funktionieren ohne JavaScript, `aria-current` am aktiven Reiter); `&bearbeiten=neu|<id>` öffnet das
// Formular im Reiter. Unten je Reiter der Weg in „Alle Daten“. Die Termine sind seit P14.11 (U-60) ein eigener
// Menüpunkt `/termine`; die alte Adresse `?reiter=termine` (Lesezeichen, Handbuch) leitet dorthin weiter.

const ALL_DATA: Record<TattooTab, string> = {
  flash: '/collections/flash',
  galerie: '/collections/tattoo-gallery',
  texte: '/collections/pages',
}

function param(v: string | string[] | undefined): string {
  return ((Array.isArray(v) ? v[0] : v) ?? '').trim()
}

export async function TattooView({ adminRoute, req, searchParams }: AdminViewBodyProps) {
  const requested = param(searchParams?.reiter)
  if (requested === 'termine') {
    const editRaw = param(searchParams?.bearbeiten)
    const keep = editRaw === 'neu' || /^[1-9]\d{0,9}$/.test(editRaw) ? `?bearbeiten=${editRaw}` : ''
    redirect(`${adminRoute}/termine${keep}`)
  }
  const tab: TattooTab = (TATTOO_TABS as readonly string[]).includes(requested)
    ? (requested as TattooTab)
    : 'flash'
  const editRaw = param(searchParams?.bearbeiten)
  const edit = editRaw === 'neu' || /^[1-9]\d{0,9}$/.test(editRaw) ? editRaw : null
  const props = { req, adminRoute, edit }

  return (
    <div className="pc-tattoo" data-testid="tattoo-view" data-tab={tab}>
      <nav aria-label={tattooText('tabsLabel')} className="pc-tattoo__tabs">
        <ul>
          {TATTOO_TABS.map((t) => (
            <li key={t}>
              <a
                href={`${adminRoute}/tattoo?reiter=${t}`}
                className="pc-tattoo__tab"
                aria-current={t === tab ? 'page' : undefined}
                data-testid={`tattoo-tab-${t}`}
              >
                {tattooText(`tab_${t}`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {tab === 'flash' ? <FlashTab {...props} /> : null}
      {tab === 'galerie' ? <GalleryTab {...props} /> : null}
      {tab === 'texte' ? <TextsTab {...props} /> : null}
      <Notice
        tone="info"
        action={{ href: `${adminRoute}${ALL_DATA[tab]}`, label: adminText('shellOpenAllData') }}
      >
        {tattooText('allDataHint')}
      </Notice>
    </div>
  )
}
