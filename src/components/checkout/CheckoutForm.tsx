'use client'

import { useRouter } from 'next/navigation'
import React, { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import {
  changeCheckoutDelivery,
  mockConfirm,
  reopenCheckout,
  submitCheckout,
} from '@/app/(frontend)/[locale]/checkout/actions'
import { RESERVATION_EXPIRED_EVENT } from '@/behaviors/reservation-countdown'
import { Checkbox, Radio } from '@/components/ui/Choice'
import { Field, RequiredNote } from '@/components/ui/Field'
import {
  CHECKOUT_FIELD_IDS,
  CHECKOUT_FIELDS,
  checkoutRawFromFormData,
  orderedCheckoutErrors,
  validateCheckoutInput,
  type CheckoutChoice,
  type CheckoutFieldErrors,
  type CheckoutFieldKey,
  type CheckoutFulfillment,
} from '@/lib/commerce/checkoutSchema'
import type de from '@/i18n/messages/de.json'

import styles from './Checkout.module.css'
import { MockPaymentField } from './MockPaymentField'
import type { StripeConfirmInput, StripePaymentFieldHandle } from './StripePaymentField'

// Kasse R07 – Formular, Übersicht und Bestellknopf (KONZEPT §4.4/§4.5/§4.7, DESIGN KO-12/KO-14; PLAN P4.9/P4.10/
// P4.10b). Fünf Abschnitte mit Ankern (#kontakt, #lieferung, #rechnung, #zahlart, #uebersicht). Pflichtfelder prüft das
// gemeinsame Schema (`checkoutSchema.ts`) vor dem Absenden: Fehler am Feld und als Zusammenfassung oben mit
// Sprunglinks (`role="alert"`, Fokus). Die Lieferart wechselt per Server-Action (`changeCheckoutDelivery`); alle
// Eingaben bleiben erhalten, weil die Felder nur verborgen werden. Die Übersicht aktualisiert sich live aus den
// Eingaben; Positionen, Versand und Summen kommen vom Server (Kassen-Snapshot). Knopf exakt „Zahlungspflichtig
// bestellen“ (KO-11 „Bestellen (ruhig)“), Text ändert sich nie; Fortschritt in der `aria-live`-Zeile darunter. Ohne
// JavaScript ist das Formular ein normales POST-Formular (Server-Action mit 303). Keine Checkbox ist vorangekreuzt.

export type CheckoutMessages = (typeof de)['checkout']

type Address = {
  name?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  postalCode?: string | null
  city?: string | null
}

export interface CheckoutFormProps {
  locale: 'de' | 'en'
  messages: CheckoutMessages
  orderLabel: string
  fulfillmentMethod: CheckoutFulfillment
  pickupOnlyNote: string | null
  deliveryLabels: { shipping: React.ReactNode; pickup: React.ReactNode }
  pickupCity: string
  district: string
  defaults: {
    email: string
    shippingAddress: Address
    billingAddressDiffers: boolean
    billingAddress: Address
    paymentChoice: CheckoutChoice | null
  }
  paymentChoices: CheckoutChoice[]
  payment:
    | { driver: 'mock' }
    | { driver: 'stripe'; clientSecret: string; publishableKey: string }
    | { driver: 'preview' }
    | { driver: 'none' }
  prepaymentEnabled: boolean
  instagram: boolean
  dhlConsentText: string
  vorkasseInfoText: string
  prepaymentDueText: string | null
  deviations: { productId: number; text: string }[]
  summaryItems: React.ReactNode
  summaryTotals: React.ReactNode
  legalNotice: React.ReactNode
  compactCountdown: React.ReactNode
  expired: boolean
  paymentRunning: boolean
  notice: string | null
  privacyHref: string
  cartHref: string
}

// Stripe-Zahlungsfeld nur laden, wenn der Treiber `stripe` ist (R-062: mit `mock` kein Stripe-Code, keine Anfrage).
const StripePaymentField = lazy(() =>
  import('./StripePaymentField').then((m) => ({ default: m.StripePaymentField })),
)

const F = CHECKOUT_FIELDS
const ID = CHECKOUT_FIELD_IDS

type Values = Record<string, string>

function readValues(form: HTMLFormElement | null): Values {
  if (!form) return {}
  const fd = new FormData(form)
  const out: Values = {}
  for (const [k, v] of fd.entries()) if (typeof v === 'string' && !(k in out)) out[k] = v
  return out
}

const noopSubscribe = () => () => {}

/** Werte der Übersicht vor der ersten Eingabe (aus den gespeicherten Eingaben der Kasse). */
function initialValues(props: CheckoutFormProps): Values {
  const out: Values = { [F.email]: props.defaults.email }
  const own =
    props.fulfillmentMethod === 'shipping'
      ? props.defaults.shippingAddress
      : props.defaults.billingAddress
  out[F.name] = own.name ?? ''
  for (const [prefix, a] of [
    ['shippingAddress', props.defaults.shippingAddress],
    ['billingAddress', props.defaults.billingAddress],
  ] as const) {
    out[`${prefix}.addressLine1`] = a.addressLine1 ?? ''
    out[`${prefix}.addressLine2`] = a.addressLine2 ?? ''
    out[`${prefix}.postalCode`] = a.postalCode ?? ''
    out[`${prefix}.city`] = a.city ?? ''
  }
  if (props.defaults.billingAddressDiffers)
    out[F.billingName] = props.defaults.billingAddress.name ?? ''
  return out
}

const fill = (s: string, vars: Record<string, string>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)

const SECTION_FIRST_FIELD: Record<string, string> = {
  kontakt: ID.email,
  lieferung: ID.fulfillmentMethod,
  rechnung: ID.billingAddressDiffers,
  zahlart: ID.paymentChoice,
}

export function CheckoutForm(props: CheckoutFormProps) {
  const m = props.messages
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const stripeRef = useRef<StripePaymentFieldHandle>(null)
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  const [method, setMethod] = useState<CheckoutFulfillment>(props.fulfillmentMethod)
  const [differs, setDiffers] = useState(false)
  const [choice, setChoice] = useState<CheckoutChoice | null>(
    props.defaults.paymentChoice && props.paymentChoices.includes(props.defaults.paymentChoice)
      ? props.defaults.paymentChoice
      : (props.paymentChoices[0] ?? null),
  )
  const [agreed, setAgreed] = useState<Set<number>>(new Set())
  const [errors, setErrors] = useState<CheckoutFieldErrors>({})
  const [serverCode, setServerCode] = useState<string | null>(props.notice)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'sending' | 'processing'>('idle')
  const [expired, setExpired] = useState(props.expired)
  const [values, setValues] = useState<Values>(() => initialValues(props))
  const [deliveryBusy, setDeliveryBusy] = useState(false)

  useEffect(() => {
    const onExpired = () => setExpired(true)
    document.addEventListener(RESERVATION_EXPIRED_EVENT, onExpired)
    return () => document.removeEventListener(RESERVATION_EXPIRED_EVENT, onExpired)
  }, [])

  // Neue Lieferart vom Server (nach `router.refresh()`) übernehmen – während des Renderns, nicht im Effekt.
  const [serverMethod, setServerMethod] = useState(props.fulfillmentMethod)
  if (serverMethod !== props.fulfillmentMethod) {
    setServerMethod(props.fulfillmentMethod)
    setMethod(props.fulfillmentMethod)
  }

  const deviationMissing = props.deviations.some((d) => !agreed.has(d.productId))
  const noChoice = props.paymentChoices.length === 0
  const blocked =
    expired || props.paymentRunning || noChoice || deviationMissing || status !== 'idle'
  const shipping = method === 'shipping'
  const pickupOnly = props.pickupOnlyNote !== null

  const errorText = (key: CheckoutFieldKey) => {
    const code = errors[key]
    return code ? m.errors[code] : undefined
  }

  const refreshValues = () => setValues(readValues(formRef.current))

  const onFormChange = (e: React.FormEvent<HTMLFormElement>) => {
    const target = e.target as HTMLInputElement
    if (target.name === F.billingAddressDiffers) setDiffers(target.checked)
    if (target.name === F.paymentChoice) setChoice(target.value as CheckoutChoice)
    if (target.name === F.deviationAgreements) {
      const next = new Set(agreed)
      const id = Number(target.value)
      if (target.checked) next.add(id)
      else next.delete(id)
      setAgreed(next)
    }
    refreshValues()
  }

  const restoreDelivery = (previous: CheckoutFulfillment) => {
    setMethod(previous)
    const radio = document.getElementById(
      previous === 'shipping' ? ID.fulfillmentMethod : 'checkout-delivery-pickup',
    ) as HTMLInputElement | null
    if (radio) radio.checked = true
  }

  const onDeliveryChange = async (next: CheckoutFulfillment) => {
    if (next === method || deliveryBusy) return
    const previous = method
    setMethod(next)
    setDeliveryBusy(true)
    const fd = new FormData()
    fd.set('fulfillmentMethod', next)
    fd.set('locale', props.locale)
    fd.set('via', 'script')
    try {
      let result: Awaited<ReturnType<typeof changeCheckoutDelivery>> | null = null
      const run = async () => {
        result = await changeCheckoutDelivery(fd)
      }
      if (props.payment.driver === 'stripe' && stripeRef.current) {
        await stripeRef.current.runServerUpdate(run)
      } else await run()
      const res = result as Awaited<ReturnType<typeof changeCheckoutDelivery>> | null
      if (!res || !res.ok) {
        restoreDelivery(previous)
        setServerCode(res && !res.ok ? res.code : 'failed')
      } else {
        setServerCode(null)
      }
      router.refresh()
    } catch {
      restoreDelivery(previous)
      setServerCode('failed')
    } finally {
      setDeliveryBusy(false)
      refreshValues()
    }
  }

  const focusSummary = () => requestAnimationFrame(() => summaryRef.current?.focus())

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (blocked) return
    const form = e.currentTarget
    const fd = new FormData(form)
    const validation = validateCheckoutInput(checkoutRawFromFormData(fd), {
      deviationProductIds: props.deviations.map((d) => d.productId),
      paymentChoices: props.paymentChoices,
      pickupOnly,
    })
    setPaymentError(null)
    if (!validation.ok) {
      setErrors(validation.errors)
      setServerCode(null)
      focusSummary()
      return
    }
    setErrors({})
    setServerCode(null)
    setStatus('sending')
    fd.set('via', 'script')
    try {
      const res = await submitCheckout(fd)
      if (!res || !res.ok) {
        setErrors(res?.ok === false && res.errors ? res.errors : {})
        setServerCode(res?.ok === false ? res.code : 'failed')
        setStatus('idle')
        focusSummary()
        return
      }
      if (res.next !== 'confirm') return
      setStatus('processing')
      if (props.payment.driver === 'mock') {
        const outcome = String(fd.get('mockOutcome') ?? 'success')
        const mockMethod = String(fd.get('mockMethod') ?? 'card')
        const confirmed = await mockConfirm(outcome, mockMethod)
        // Erfolg, Abbruch und Verzögert leiten weiter; zurück kommt nur „Abgelehnt“ oder ein Fehler.
        if (confirmed && !confirmed.ok) {
          setPaymentError(
            confirmed.code === 'declined' ? m.mock.declinedMessage : m.errors.codes.failed,
          )
          setStatus('idle')
          router.refresh()
        }
        return
      }
      if (props.payment.driver === 'stripe' && stripeRef.current) {
        const v = validation.value
        const input: StripeConfirmInput = {
          email: v.email,
          ...(v.shippingAddress ? { shippingAddress: v.shippingAddress } : {}),
          ...(v.billingAddress ? { billingAddress: v.billingAddress } : {}),
          returnUrl: res.returnUrl,
        }
        const confirmed = await stripeRef.current.confirm(input)
        if (!confirmed.ok) {
          await reopenCheckout()
          setPaymentError(confirmed.message || m.stripe.failed)
          setStatus('idle')
        }
        return
      }
      await reopenCheckout()
      setServerCode('failed')
      setStatus('idle')
    } catch {
      setServerCode('failed')
      setStatus('idle')
    }
  }

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element
    const legal = target.closest<HTMLAnchorElement>('a[data-legal-dialog]')
    if (legal) {
      const dialog = document.getElementById(
        `legal-dialog-${legal.dataset.legalDialog}`,
      ) as HTMLDialogElement | null
      if (dialog && typeof dialog.showModal === 'function') {
        e.preventDefault()
        dialog.showModal()
      }
      return
    }
    const close = target.closest('[data-dialog-close]')
    if (close) {
      close.closest('dialog')?.close()
      return
    }
    const change = target.closest<HTMLAnchorElement>('a[data-change]')
    if (change) {
      // „Ändern“ springt per Anker zum Abschnitt und fokussiert dessen erstes sichtbares Feld (KONZEPT §4.4).
      const section = change.dataset.change ?? ''
      const preferred = SECTION_FIRST_FIELD[section]
      window.setTimeout(() => {
        const visible = (el: HTMLElement | null) =>
          !!el && !el.closest('[hidden]') && !(el as HTMLInputElement).disabled
        const first = preferred ? document.getElementById(preferred) : null
        const el = visible(first)
          ? first
          : Array.from(
              document.querySelectorAll<HTMLElement>(
                `#${section} input:not([type="hidden"]), #${section} select`,
              ),
            ).find(visible)
        el?.focus()
      }, 0)
    }
  }

  const list = orderedCheckoutErrors(errors)
  const hasSummary = list.length > 0 || !!serverCode
  const codeText = (code: string) =>
    (m.errors.codes as Record<string, string>)[code] ??
    (code === 'declined' ? m.mock.declinedMessage : m.errors.codes.failed)
  const showCartLink =
    serverCode === 'cart_changed' || serverCode === 'expired' || serverCode === 'not_found'

  // --- Übersicht (live) ---
  const v = (name: string) => (values[name] ?? '').trim()
  const addressLines = (prefix: 'shippingAddress' | 'billingAddress', name: string) =>
    [
      name,
      v(`${prefix}.addressLine1`),
      v(`${prefix}.addressLine2`),
      [v(`${prefix}.postalCode`), v(`${prefix}.city`)].filter(Boolean).join(' '),
    ].filter(Boolean)
  const missing = <span className={styles.missing}>{m.overview.missing}</span>
  const lines = (arr: string[]) =>
    arr.length > 1 || (arr.length === 1 && arr[0])
      ? arr.map((l, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <br /> : null}
            {l}
          </React.Fragment>
        ))
      : missing
  const name = v(F.name)
  const deliveryBlock = shipping
    ? lines(
        addressLines('shippingAddress', name).concat(
          name || v(`shippingAddress.addressLine1`) ? [m.fields.countryValue] : [],
        ),
      )
    : fill(m.overview.pickup, { city: props.pickupCity })
  const billingBlock = shipping
    ? differs
      ? lines(addressLines('billingAddress', v(F.billingName)))
      : m.overview.billingSame
    : lines(addressLines('billingAddress', name))
  const choiceLabel =
    choice === 'stripe'
      ? m.fields.paymentStripe
      : choice === 'prepayment'
        ? m.fields.paymentPrepayment
        : null

  const change = (section: string, label: string) => (
    <a
      href={`#${section}`}
      data-change={section}
      className={styles.textLink}
      aria-label={fill(m.overview.changeLabel, { section: label })}
    >
      {m.overview.change}
    </a>
  )

  const sectionHead = (n: number, id: string) => (
    <h2 id={`${id}-titel`} className={styles.sectionTitle}>
      <span className={styles.kicker}>{n}</span> {(m.sections as Record<string, string>)[id]}
    </h2>
  )

  const deliveryAction = changeCheckoutDelivery as unknown as (formData: FormData) => Promise<void>
  const submitAction = submitCheckout as unknown as (formData: FormData) => Promise<void>

  return (
    <div className={styles.layout} onClick={onClick} data-checkout-layout="">
      <form
        ref={formRef}
        action={submitAction}
        onSubmit={onSubmit}
        onChange={onFormChange}
        noValidate
        className={styles.form}
        data-checkout-form=""
        data-hydrated={hydrated ? 'true' : undefined}
      >
        <input type="hidden" name="locale" value={props.locale} />
        <div className={styles.main}>
          <div
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            className={hasSummary ? styles.errorSummary : undefined}
            data-error-summary=""
          >
            {hasSummary ? (
              <>
                <p className={styles.errorTitle}>
                  {list.length > 0 ? m.errors.summaryTitle : codeText(serverCode!)}
                </p>
                {list.length > 0 ? (
                  <ul className={styles.errorList}>
                    {list.map((e) => (
                      <li key={e.key}>
                        <a href={`#${ID[e.key]}`} data-error-link={e.key}>
                          {m.errors.fields[e.key]}: {m.errors[e.code]}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {showCartLink ? (
                  <p>
                    <a href={props.cartHref} className={styles.textLink}>
                      {m.fields.toCart}
                    </a>
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          <RequiredNote>{m.requiredNote}</RequiredNote>

          <section id="kontakt" aria-labelledby="kontakt-titel" className={styles.section}>
            {sectionHead(1, 'kontakt')}
            <Field
              id={ID.email}
              name={F.email}
              type="email"
              label={m.fields.email}
              hint={m.fields.emailHint}
              required
              autoComplete="email"
              maxLength={254}
              defaultValue={props.defaults.email}
              error={errorText('email')}
            />
          </section>

          <section id="lieferung" aria-labelledby="lieferung-titel" className={styles.section}>
            {sectionHead(2, 'lieferung')}
            <fieldset className={styles.fieldset} data-checkout-delivery="">
              <legend className={styles.legend}>{m.fields.deliveryLegend}</legend>
              <div
                onChange={(e) =>
                  onDeliveryChange((e.target as HTMLInputElement).value as CheckoutFulfillment)
                }
              >
                <Radio
                  id={ID.fulfillmentMethod}
                  name={F.fulfillmentMethod}
                  value="shipping"
                  checked={props.fulfillmentMethod === 'shipping'}
                  disabled={pickupOnly}
                  hint={props.pickupOnlyNote ?? undefined}
                  label={props.deliveryLabels.shipping}
                />
                <Radio
                  id="checkout-delivery-pickup"
                  name={F.fulfillmentMethod}
                  value="pickup"
                  checked={props.fulfillmentMethod === 'pickup'}
                  label={props.deliveryLabels.pickup}
                />
              </div>
              {!hydrated && !pickupOnly ? (
                <button
                  type="submit"
                  formAction={deliveryAction}
                  formNoValidate
                  className={styles.secondaryButton}
                >
                  {m.fields.deliveryApply}
                </button>
              ) : null}
            </fieldset>
            <Field
              id={ID.name}
              name={F.name}
              label={m.fields.name}
              required
              autoComplete="name"
              maxLength={100}
              defaultValue={
                (props.fulfillmentMethod === 'shipping'
                  ? props.defaults.shippingAddress.name
                  : props.defaults.billingAddress.name) ?? ''
              }
              error={errorText('name')}
            />
            <div hidden={!shipping} data-shipping-fields="">
              <Field
                id={ID.shippingLine1}
                name={F.shippingLine1}
                label={m.fields.line1}
                hint={m.fields.line1Hint}
                required
                autoComplete="shipping address-line1"
                maxLength={100}
                defaultValue={props.defaults.shippingAddress.addressLine1 ?? ''}
                error={shipping ? errorText('shippingLine1') : undefined}
              />
              <Field
                id={ID.shippingLine2}
                name={F.shippingLine2}
                label={m.fields.line2}
                autoComplete="shipping address-line2"
                maxLength={100}
                defaultValue={props.defaults.shippingAddress.addressLine2 ?? ''}
                error={shipping ? errorText('shippingLine2') : undefined}
              />
              <div className={styles.row2}>
                <Field
                  id={ID.shippingPostalCode}
                  name={F.shippingPostalCode}
                  label={m.fields.postalCode}
                  required
                  autoComplete="shipping postal-code"
                  inputMode="numeric"
                  maxLength={5}
                  defaultValue={props.defaults.shippingAddress.postalCode ?? ''}
                  error={shipping ? errorText('shippingPostalCode') : undefined}
                />
                <Field
                  id={ID.shippingCity}
                  name={F.shippingCity}
                  label={m.fields.city}
                  required
                  autoComplete="shipping address-level2"
                  maxLength={60}
                  defaultValue={props.defaults.shippingAddress.city ?? ''}
                  error={shipping ? errorText('shippingCity') : undefined}
                />
              </div>
              <p className={styles.country} data-country="">
                <span className={styles.countryLabel}>{m.fields.country}</span>{' '}
                <span>{m.fields.countryValue}</span>
                <input type="hidden" name={F.shippingCountry} value="DE" />
              </p>
              <Checkbox
                id={ID.carrierEmailConsent}
                name={F.carrierEmailConsent}
                value="on"
                label={<span data-snippet="checkout.dhlEmailConsent">{props.dhlConsentText}</span>}
              />
            </div>
            <p hidden={shipping} className={styles.note} data-pickup-hint="">
              {fill(m.fields.pickupHint, { district: props.district })}
            </p>
          </section>

          <section id="rechnung" aria-labelledby="rechnung-titel" className={styles.section}>
            {sectionHead(3, 'rechnung')}
            <div hidden={!shipping}>
              <Checkbox
                id={ID.billingAddressDiffers}
                name={F.billingAddressDiffers}
                value="on"
                label={m.fields.billingDiffers}
                hint={m.fields.billingSame}
              />
            </div>
            <p hidden={shipping} className={styles.note} data-billing-pickup-hint="">
              {m.fields.billingPickupHint}
            </p>
            <div hidden={shipping && !differs} data-billing-fields="">
              <div hidden={!shipping}>
                <Field
                  id={ID.billingName}
                  name={F.billingName}
                  label={m.fields.billingName}
                  required
                  autoComplete="billing name"
                  maxLength={100}
                  defaultValue={
                    props.defaults.billingAddressDiffers
                      ? (props.defaults.billingAddress.name ?? '')
                      : ''
                  }
                  error={shipping && differs ? errorText('billingName') : undefined}
                />
              </div>
              <Field
                id={ID.billingLine1}
                name={F.billingLine1}
                label={m.fields.line1}
                required
                autoComplete="billing address-line1"
                maxLength={100}
                defaultValue={props.defaults.billingAddress.addressLine1 ?? ''}
                error={errorText('billingLine1')}
              />
              <Field
                id={ID.billingLine2}
                name={F.billingLine2}
                label={m.fields.line2}
                autoComplete="billing address-line2"
                maxLength={100}
                defaultValue={props.defaults.billingAddress.addressLine2 ?? ''}
                error={errorText('billingLine2')}
              />
              <div className={styles.row2}>
                <Field
                  id={ID.billingPostalCode}
                  name={F.billingPostalCode}
                  label={m.fields.postalCode}
                  required
                  autoComplete="billing postal-code"
                  inputMode="numeric"
                  maxLength={5}
                  defaultValue={props.defaults.billingAddress.postalCode ?? ''}
                  error={errorText('billingPostalCode')}
                />
                <Field
                  id={ID.billingCity}
                  name={F.billingCity}
                  label={m.fields.city}
                  required
                  autoComplete="billing address-level2"
                  maxLength={60}
                  defaultValue={props.defaults.billingAddress.city ?? ''}
                  error={errorText('billingCity')}
                />
              </div>
              <p className={styles.country}>
                <span className={styles.countryLabel}>{m.fields.country}</span>{' '}
                <span>{m.fields.countryValue}</span>
                <input type="hidden" name={F.billingCountry} value="DE" />
              </p>
            </div>
          </section>

          <section id="zahlart" aria-labelledby="zahlart-titel" className={styles.section}>
            {sectionHead(4, 'zahlart')}
            {props.instagram ? (
              <p className={styles.note} data-instagram-hint="">
                {m.fields.instagramHint}
              </p>
            ) : null}
            {noChoice ? (
              <p className={styles.note} data-payment-impossible="">
                {m.fields.paymentImpossible}{' '}
                <a href={props.cartHref} className={styles.textLink}>
                  {m.fields.toCart}
                </a>
              </p>
            ) : (
              <fieldset className={styles.fieldset} data-payment-choice="">
                <legend className={styles.legend}>
                  {m.fields.paymentLegend}
                  <span aria-hidden="true"> *</span>
                </legend>
                {!props.paymentChoices.includes('stripe') ? (
                  <p className={styles.note} data-stripe-unavailable="">
                    {m.fields.stripeUnavailable}
                  </p>
                ) : null}
                {props.paymentChoices.includes('stripe') ? (
                  <Radio
                    id={ID.paymentChoice}
                    name={F.paymentChoice}
                    value="stripe"
                    checked={choice === 'stripe'}
                    label={m.fields.paymentStripe}
                  />
                ) : null}
                {props.paymentChoices.includes('prepayment') ? (
                  <Radio
                    id={
                      props.paymentChoices.includes('stripe')
                        ? 'checkout-payment-prepayment'
                        : ID.paymentChoice
                    }
                    name={F.paymentChoice}
                    value="prepayment"
                    checked={choice === 'prepayment'}
                    label={m.fields.paymentPrepayment}
                  />
                ) : null}
                {errors.paymentChoice ? (
                  <p className={styles.fieldError}>{errorText('paymentChoice')}</p>
                ) : null}
              </fieldset>
            )}
            <div hidden={choice !== 'stripe'} data-stripe-area="">
              {props.payment.driver === 'mock' ? (
                <MockPaymentField texts={m.mock} error={paymentError} />
              ) : props.payment.driver === 'stripe' ? (
                <Suspense
                  fallback={
                    <div className={styles.paymentField} data-payment-field="stripe">
                      <p className={styles.small}>{m.stripe.loading}</p>
                    </div>
                  }
                >
                  <StripePaymentField
                    key={props.payment.clientSecret}
                    ref={stripeRef}
                    publishableKey={props.payment.publishableKey}
                    clientSecret={props.payment.clientSecret}
                    locale={props.locale}
                    texts={m.stripe}
                    error={paymentError}
                  />
                </Suspense>
              ) : props.payment.driver === 'preview' ? (
                <div className={styles.paymentField} data-payment-field="preview">
                  <p>{m.stripe.placeholder}</p>
                </div>
              ) : null}
            </div>
            <div hidden={choice !== 'prepayment'} className={styles.note} data-prepayment-info="">
              <p>{m.fields.prepaymentBank}</p>
              <p data-snippet="checkout.vorkasseInfo">{props.vorkasseInfoText}</p>
              {props.prepaymentDueText ? (
                <p data-prepayment-due="">
                  {fill(m.fields.prepaymentDue, { date: props.prepaymentDueText })}
                </p>
              ) : null}
            </div>
          </section>

          <p className={styles.small} data-privacy-link="">
            {m.privacy.split('{link}')[0]}
            <a href={props.privacyHref} className={styles.textLink}>
              {m.privacyLink}
            </a>
            {m.privacy.split('{link}')[1]}
          </p>
        </div>
        <div className={styles.aside}>
          <section
            id="uebersicht"
            aria-labelledby="uebersicht-titel"
            className={`${styles.section} ${styles.overview}`}
          >
            {sectionHead(5, 'uebersicht')}
            {props.summaryItems}
            {props.summaryTotals}
            <dl className={styles.overviewBlocks}>
              <div className={styles.block} data-overview-block="lieferung">
                <dt>{shipping ? m.overview.deliveryAddress : m.fields.deliveryLegend}</dt>
                <dd data-overview-value="">{deliveryBlock}</dd>
                <dd>
                  {change(
                    'lieferung',
                    shipping ? m.overview.deliveryAddress : m.fields.deliveryLegend,
                  )}
                </dd>
              </div>
              <div className={styles.block} data-overview-block="rechnung">
                <dt>{m.overview.billingAddress}</dt>
                <dd data-overview-value="">{billingBlock}</dd>
                <dd>{change('rechnung', m.overview.billingAddress)}</dd>
              </div>
              <div className={styles.block} data-overview-block="kontakt">
                <dt>{m.overview.email}</dt>
                <dd data-overview-value="">{v(F.email) || missing}</dd>
                <dd>{change('kontakt', m.overview.email)}</dd>
              </div>
              <div className={styles.block} data-overview-block="zahlart">
                <dt>{m.overview.payment}</dt>
                <dd data-overview-value="">
                  {choiceLabel ?? missing}
                  {choice === 'prepayment' && props.prepaymentDueText ? (
                    <>
                      <br />
                      <span data-overview-deadline="">
                        {m.overview.deadline}:{' '}
                        {fill(m.overview.deadlineValue, { date: props.prepaymentDueText })}
                      </span>
                      <br />
                      <span>
                        {m.overview.deliveryTime}: {m.overview.fromPayment}
                      </span>
                    </>
                  ) : null}
                </dd>
                <dd>{change('zahlart', m.overview.payment)}</dd>
              </div>
            </dl>
            {props.legalNotice}
            {props.deviations.length > 0 ? (
              <div className={styles.deviations} data-deviations="">
                {props.deviations.map((d, i) => (
                  <Checkbox
                    key={d.productId}
                    id={
                      i === 0 ? ID.deviationAgreements : `${ID.deviationAgreements}-${d.productId}`
                    }
                    name={F.deviationAgreements}
                    value={String(d.productId)}
                    required
                    label={<span data-snippet="checkout.deviationAgreement">{d.text}</span>}
                    error={
                      errors.deviationAgreements && !agreed.has(d.productId)
                        ? m.errors.deviation
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : null}
          </section>

          <div className={styles.orderArea} data-order-area="">
            <button
              type="submit"
              className={styles.orderButton}
              disabled={blocked}
              aria-describedby={deviationMissing ? 'checkout-order-hint' : undefined}
              data-order-button=""
            >
              {props.orderLabel}
            </button>
            {deviationMissing ? (
              <p id="checkout-order-hint" className={styles.orderHint} data-order-hint="deviation">
                {m.order.deviationHint}
              </p>
            ) : null}
            <p aria-live="polite" className={styles.status} data-order-status="">
              {status === 'sending'
                ? m.order.sending
                : status === 'processing'
                  ? m.order.processing
                  : props.paymentRunning
                    ? m.order.confirming
                    : ''}
            </p>
            {choice === 'stripe' ? (
              <p className={styles.small} data-paypal-note="">
                {m.order.paypalNote}
              </p>
            ) : null}
            {props.compactCountdown}
          </div>
        </div>
      </form>
    </div>
  )
}
