'use client'

import { useRouter } from 'next/navigation'
import React from 'react'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { CopyButton } from '../../components/CopyButton'
import { adminText } from '../../translations'

// „Adresse kopieren“ (PLAN P5.10, KONZEPT §7.6, R-101): ganzer Block für die DHL-App plus Kopier-Symbol je Zeile; die
// Zeilen kommen vom Server (E-Mail nur mit wirksamer DHL-Einwilligung, nie Telefon). „Einwilligung widerrufen“ nur bei
// wirksamer Einwilligung.

export interface AddressCopyProps {
  orderId: number
  lines: string[]
  consentActive: boolean
  consentRevokedAt: string | null
}

export function AddressCopy({ orderId, lines, consentActive, consentRevokedAt }: AddressCopyProps) {
  const router = useRouter()
  return (
    <div className="pc-order-address" data-testid="order-address">
      <ul className="pc-order-address__lines" aria-label={adminText('packingAddress')}>
        {lines.map((line, i) => (
          <li key={i} className="pc-order-address__line">
            <span className="pc-order-address__text">{line}</span>
            <CopyButton
              text={line}
              iconOnly
              label={adminText('packingCopyLine', { line })}
              data-testid="copy-line"
            />
          </li>
        ))}
      </ul>
      <div className="pc-admin-row">
        <CopyButton
          text={lines.join('\n')}
          label={adminText('packingCopyAddress')}
          data-testid="copy-address"
        />
        {consentActive ? (
          <ActionButton
            variant="secondary"
            data-testid="withdraw-carrier-consent"
            confirm={{
              title: adminText('packingConsentWithdrawTitle'),
              consequence: adminText('packingConsentWithdrawConsequence'),
            }}
            action={() => postAdminAction(`/api/orders/${orderId}/withdraw-carrier-consent`)}
            onDone={() => router.refresh()}
          >
            {adminText('packingConsentWithdraw')}
          </ActionButton>
        ) : null}
      </div>
      {consentRevokedAt ? (
        <p className="pc-order__muted">
          {adminText('packingConsentRevoked', { date: consentRevokedAt })}
        </p>
      ) : null}
    </div>
  )
}
