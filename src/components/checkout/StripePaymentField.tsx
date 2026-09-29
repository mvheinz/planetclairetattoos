'use client'

import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'

import styles from './Checkout.module.css'

// Stripe Payment Element (KONZEPT §4.7, ARCHITEKTUR §3.5, DESIGN KO-12; PLAN P4.9/P4.10b): nur auf der Kasse und nur mit
// `PAYMENTS_DRIVER=stripe` (R-062). `loadStripe` aus `@stripe/stripe-js/pure` wird erst hier dynamisch importiert; das
// Checkout-Objekt der gepinnten Stripe.js-Version (`initCheckoutElementsSdk`) bekommt das serverseitig über
// `getCheckoutSession` geholte Client-Secret. Nur das Payment Element – kein Express-Checkout-, Link- oder Address-
// Element. Appearance laut KO-12, Schrift von der eigenen Domain. Nach `submitCheckout` übergibt die Kasse E-Mail und
// Adressen über das Checkout-Objekt und ruft `confirm({ returnUrl })`; Fehler zeigt das Feld (S8).

type Address = {
  name: string
  addressLine1: string
  addressLine2?: string
  postalCode: string
  city: string
}

export interface StripeConfirmInput {
  email: string
  shippingAddress?: Address
  billingAddress?: Address
  returnUrl: string
}

export interface StripePaymentFieldHandle {
  confirm(input: StripeConfirmInput): Promise<{ ok: true } | { ok: false; message: string }>
  /** Server-Änderung (z. B. Lieferart) so ausführen, dass das Feld den neuen Betrag lädt. */
  runServerUpdate(fn: () => Promise<unknown>): Promise<void>
}

/** Appearance laut DESIGN KO-12. */
const APPEARANCE = {
  theme: 'flat' as const,
  variables: {
    colorPrimary: '#1C1A17',
    colorBackground: '#FBF8F1',
    colorText: '#1C1A17',
    colorTextSecondary: '#4B463F',
    colorDanger: '#A6261C',
    fontFamily: 'Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif',
    borderRadius: '8px',
    spacingUnit: '4px',
    focusBoxShadow: '0 0 0 3px #5A4BC4',
  },
}

/** `@font-face` der eigenen Bricolage-Datei (selbst gehostet unter `/_next/static/media/…`). */
function ownFontSources(): { family: string; src: string; weight: string }[] {
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSFontFaceRule)) continue
        const family = rule.style.getPropertyValue('font-family')
        if (!/bricolage/i.test(family)) continue
        const match = /url\(["']?([^"')]+)["']?\)/.exec(rule.style.getPropertyValue('src'))
        if (!match) continue
        const url = new URL(match[1]!, document.baseURI)
        if (url.origin !== window.location.origin) continue
        return [{ family: 'Bricolage Grotesque', src: `url(${url.href})`, weight: '400 700' }]
      }
    }
  } catch {
    // ohne eigene Schrift: Systemschrift
  }
  return []
}

const toContact = (a: Address) => ({
  name: a.name,
  address: {
    country: 'DE',
    line1: a.addressLine1,
    line2: a.addressLine2 ?? null,
    city: a.city,
    postal_code: a.postalCode,
  },
})

type Actions = {
  updateEmail(email: string): Promise<{ type: string; error?: { message: string } }>
  updateShippingAddress(
    c: ReturnType<typeof toContact>,
  ): Promise<{ type: string; error?: { message: string } }>
  updateBillingAddress(
    c: ReturnType<typeof toContact>,
  ): Promise<{ type: string; error?: { message: string } }>
  confirm(a: { returnUrl: string }): Promise<{ type: string; error?: { message: string } }>
  runServerUpdate(fn: () => Promise<unknown>): Promise<{ type: string }>
}

export function StripePaymentField({
  publishableKey,
  clientSecret,
  locale,
  texts,
  error,
  ref,
}: {
  publishableKey: string
  clientSecret: string
  locale: 'de' | 'en'
  texts: { loading: string; loadError: string; failed: string }
  error?: string | null
  ref?: React.Ref<StripePaymentFieldHandle>
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<Actions | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    let element: { mount(el: HTMLElement): void; destroy(): void } | null = null
    ;(async () => {
      try {
        const { loadStripe } = await import('@stripe/stripe-js/pure')
        const stripe = await loadStripe(publishableKey, { locale })
        if (!stripe || cancelled || !mountRef.current) return
        const checkout = stripe.initCheckoutElementsSdk({
          clientSecret,
          elementsOptions: { appearance: APPEARANCE, fonts: ownFontSources() },
        })
        const payment = checkout.createPaymentElement()
        element = payment as unknown as typeof element
        payment.mount(mountRef.current)
        const loaded = await checkout.loadActions()
        if (cancelled) return
        if (loaded.type !== 'success') throw new Error(loaded.error.message)
        actionsRef.current = loaded.actions as unknown as Actions
        setState('ready')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
      actionsRef.current = null
      element?.destroy()
    }
  }, [publishableKey, clientSecret, locale])

  useImperativeHandle(
    ref,
    () => ({
      async confirm(input) {
        const actions = actionsRef.current
        if (!actions) return { ok: false, message: texts.loadError }
        const steps = [
          () => actions.updateEmail(input.email),
          ...(input.shippingAddress
            ? [() => actions.updateShippingAddress(toContact(input.shippingAddress!))]
            : []),
          ...(input.billingAddress
            ? [() => actions.updateBillingAddress(toContact(input.billingAddress!))]
            : []),
        ]
        for (const step of steps) {
          const res = await step()
          if (res.type === 'error')
            return { ok: false, message: res.error?.message ?? texts.failed }
        }
        const res = await actions.confirm({ returnUrl: input.returnUrl })
        if (res.type === 'error') return { ok: false, message: res.error?.message ?? texts.failed }
        return { ok: true }
      },
      async runServerUpdate(fn) {
        const actions = actionsRef.current
        if (actions) await actions.runServerUpdate(fn)
        else await fn()
      },
    }),
    [texts],
  )

  return (
    <div className={styles.paymentField} data-payment-field="stripe">
      <div ref={mountRef} data-stripe-payment-element="" />
      {state === 'loading' ? <p className={styles.small}>{texts.loading}</p> : null}
      {state === 'error' ? <p className={styles.fieldError}>{texts.loadError}</p> : null}
      <div aria-live="polite" data-payment-error="">
        {error ? <p className={styles.fieldError}>{error}</p> : null}
      </div>
    </div>
  )
}
