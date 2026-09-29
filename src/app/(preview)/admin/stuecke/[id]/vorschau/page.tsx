import config from '@payload-config'
import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { adminText } from '@/admin/translations'
import { ProductPage } from '@/components/shop/product/ProductPage'
import { toPublicProduct } from '@/lib/data/products'
import type { Product } from '@/payload-types'

import styles from './preview.module.css'

// Vorschau eines Stücks mit Entwurfsdaten (PLAN P5.6): nur angemeldet (sonst Anmeldung mit Rücksprung), liest das Stück
// mit `overrideAccess` in DE und rendert die Produktseite ohne Kaufknopf-Wirkung (`preview`). Kein Cache.

export const dynamic = 'force-dynamic'

export default async function PiecePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params
  setRequestLocale('de')
  const payload = await getPayload({ config })
  const adminRoute = payload.config.routes.admin
  const id = /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null
  if (!id) notFound()
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) {
    const back = `${adminRoute}/stuecke/${id}/vorschau`
    redirect(`${adminRoute}/login?redirect=${encodeURIComponent(back)}`)
  }
  const doc = (await payload.findByID({
    collection: 'products',
    id,
    locale: 'de',
    fallbackLocale: 'de',
    depth: 1,
    overrideAccess: true,
    disableErrors: true,
  })) as Product | null
  if (!doc) notFound()

  return (
    <>
      <div className={styles.banner} role="note" data-testid="piece-preview-banner">
        <p>{adminText('previewBanner')}</p>
        <a href={`${adminRoute}/stuecke/${id}`} className={styles.back}>
          {adminText('previewBack')}
        </a>
      </div>
      <ProductPage product={toPublicProduct(doc)} locale="de" preview />
    </>
  )
}
