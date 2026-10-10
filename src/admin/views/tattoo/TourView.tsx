import React from 'react'

import { Notice } from '../../components/Notice'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { TourTab } from './TourTab'
import { tattooText } from './tattooText'

// Ansicht „Termine“ `/termine` (U-60, P14.11): Markt-Termine „Planet Claire on Tour“ als eigener Menüpunkt – bis P14 ein
// Reiter in „Tattoo“ (`/tattoo?reiter=termine`, leitet hierher weiter). `?bearbeiten=neu|<id>` öffnet das Formular.

function param(v: string | string[] | undefined): string {
  return ((Array.isArray(v) ? v[0] : v) ?? '').trim()
}

const ID_RE = /^[1-9]\d{0,9}$/

export async function TourView({ adminRoute, req, searchParams }: AdminViewBodyProps) {
  const editRaw = param(searchParams?.bearbeiten)
  const edit = editRaw === 'neu' || ID_RE.test(editRaw) ? editRaw : null
  return (
    <div className="pc-tattoo" data-testid="tour-view">
      <TourTab req={req} adminRoute={adminRoute} edit={edit} />
      <Notice
        tone="info"
        action={{
          href: `${adminRoute}/collections/tour-dates`,
          label: adminText('shellOpenAllData'),
        }}
      >
        {tattooText('allDataHint')}
      </Notice>
    </div>
  )
}
