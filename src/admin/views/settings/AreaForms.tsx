'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Notice } from '../../components/Notice'
import { TranslateButton } from '../../components/TranslateButton'
import { adminText } from '../../translations'
import {
  areaText,
  CLOSED_MESSAGE_MAX,
  EU_CHECKLIST_LABELS,
  type AnalyticsValues,
  type AreaTextKey,
  type CostsValues,
  type EuChecklistKey,
  type LegalValues,
  type Localized,
  MAIL_TEXT_MAX,
  type MailTextsValues,
  type PackingValues,
  type SettingsArea,
  type ShippingValues,
  type ShopValues,
  type TemplatesValues,
  type YearRow,
} from './settingsAreas'
import { useSave } from './SettingsForms'

// Handy-Formulare der Einstellungen, Teil 2 und 3 (PLAN P5.22/P5.22a, KONZEPT §7.14): je Bereich ein Formular mit
// „Speichern“ auf `POST /api/globals/settings/area`. Fehler des Servers stehen am Feld (`aria-invalid`,
// `aria-describedby`) und als Liste über dem Knopf; Fokus springt aufs erste fehlerhafte Feld. Zeilen (Tarife,
// Monatswerte …) lassen sich hinzufügen und entfernen; jede Zeile ist eine `fieldset` mit eigener Beschriftung.

export type Option = { value: string; label: string }
type Errors = Record<string, string>

const AREA_URL = '/api/globals/settings/area'

/** Fehler zu einem Pfad (genau oder darunter, z. B. `…items.2.text` für die ganze Checkliste). */
function errorFor(errors: Errors, path: string): string | undefined {
  if (errors[path]) return errors[path]
  const key = Object.keys(errors).find((k) => k.startsWith(`${path}.`))
  return key ? errors[key] : undefined
}

const Ctx = React.createContext<Errors>({})

function FieldShell({
  path,
  label,
  hint,
  children,
}: {
  path: string
  label: string
  hint?: string
  children: (a: {
    id: string
    name: string
    describedBy: string | undefined
    invalid: true | undefined
  }) => React.ReactNode
}) {
  const errors = React.useContext(Ctx)
  const id = useId()
  const error = errorFor(errors, path)
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="pc-field">
      <label htmlFor={id} className="pc-field__label">
        {label}
      </label>
      {children({ id, name: path, describedBy, invalid: error ? true : undefined })}
      {hint ? (
        <p id={`${id}-hint`} className="pc-order__muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="pc-field__error" data-testid={`area-error-${path}`}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function TextField(props: {
  path: string
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  type?: 'text' | 'date' | 'month' | 'url'
  inputMode?: 'decimal' | 'numeric'
  multiline?: boolean
  maxLength?: number
}) {
  return (
    <FieldShell path={props.path} label={props.label} hint={props.hint}>
      {(a) =>
        props.multiline ? (
          <textarea
            id={a.id}
            name={a.name}
            rows={3}
            value={props.value}
            maxLength={props.maxLength}
            aria-invalid={a.invalid}
            aria-describedby={a.describedBy}
            data-testid={`area-field-${props.path}`}
            onChange={(e) => props.onChange(e.target.value)}
          />
        ) : (
          <input
            id={a.id}
            name={a.name}
            // `month` kennt nicht jeder Browser – Textfeld mit Muster JJJJ-MM ist überall gleich bedienbar.
            type={props.type === 'month' || props.type === 'url' ? 'text' : (props.type ?? 'text')}
            inputMode={props.type === 'url' ? 'url' : props.inputMode}
            placeholder={props.type === 'month' ? 'JJJJ-MM' : undefined}
            spellCheck={false}
            autoComplete="off"
            value={props.value}
            maxLength={props.maxLength}
            aria-invalid={a.invalid}
            aria-describedby={a.describedBy}
            data-testid={`area-field-${props.path}`}
            onChange={(e) => props.onChange(e.target.value)}
          />
        )
      }
    </FieldShell>
  )
}

export function SelectField(props: {
  path: string
  label: string
  value: string
  options: readonly Option[]
  onChange: (v: string) => void
  hint?: string
}) {
  return (
    <FieldShell path={props.path} label={props.label} hint={props.hint}>
      {(a) => (
        <select
          id={a.id}
          name={a.name}
          value={props.value}
          aria-invalid={a.invalid}
          aria-describedby={a.describedBy}
          data-testid={`area-field-${props.path}`}
          onChange={(e) => props.onChange(e.target.value)}
        >
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  )
}

export function CheckField(props: {
  path: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
  disabled?: boolean
}) {
  const errors = React.useContext(Ctx)
  const id = useId()
  const error = errorFor(errors, props.path)
  const describedBy =
    [props.hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(' ') ||
    undefined
  return (
    <div className="pc-field">
      <label className="pc-choice">
        <input
          type="checkbox"
          name={props.path}
          checked={props.checked}
          disabled={props.disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          data-testid={`area-field-${props.path}`}
          onChange={(e) => props.onChange(e.target.checked)}
        />
        {props.label}
      </label>
      {props.hint ? (
        <p id={`${id}-hint`} className="pc-order__muted">
          {props.hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="pc-field__error" data-testid={`area-error-${props.path}`}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

function LocalizedField(props: {
  path: string
  label: string
  value: Localized
  onChange: (v: Localized) => void
  hint?: string
  multiline?: boolean
  maxLength?: number
}) {
  return (
    <fieldset className="pc-field pc-settings__group">
      <legend className="pc-field__label">{props.label}</legend>
      {(['de', 'en'] as const).map((l) => (
        <TextField
          key={l}
          path={`${props.path}.${l}`}
          label={areaText(l)}
          value={props.value[l]}
          multiline={props.multiline}
          maxLength={props.maxLength}
          hint={l === 'en' ? props.hint : undefined}
          onChange={(v) => props.onChange({ ...props.value, [l]: v })}
        />
      ))}
    </fieldset>
  )
}

/** Zeilen-Liste mit „Zeile hinzufügen/entfernen“. */
function Rows<T>(props: {
  path: string
  legend: string
  hint?: string
  rows: T[]
  onChange: (rows: T[]) => void
  empty?: () => T
  fixed?: boolean
  rowTitle?: (row: T, i: number) => string
  render: (row: T, i: number, set: (row: T) => void) => React.ReactNode
}) {
  const errors = React.useContext(Ctx)
  const own = errors[props.path]
  const id = useId()
  return (
    <fieldset
      className="pc-field pc-settings__group"
      data-testid={`area-rows-${props.path}`}
      aria-describedby={own ? `${id}-err` : undefined}
    >
      <legend className="pc-field__label">{props.legend}</legend>
      {props.hint ? <p className="pc-order__muted">{props.hint}</p> : null}
      {own ? (
        <p id={`${id}-err`} className="pc-field__error" data-testid={`area-error-${props.path}`}>
          {own}
        </p>
      ) : null}
      {props.rows.map((row, i) => (
        <fieldset key={i} className="pc-settings__row" data-testid={`area-row-${props.path}-${i}`}>
          <legend>{props.rowTitle?.(row, i) ?? areaText('rowLabel', { n: i + 1 })}</legend>
          {props.render(row, i, (next) =>
            props.onChange(props.rows.map((r, j) => (j === i ? next : r))),
          )}
          {props.fixed ? null : (
            <p className="pc-admin-row">
              <button
                type="button"
                className="pc-admin-btn pc-admin-btn--secondary"
                onClick={() => props.onChange(props.rows.filter((_, j) => j !== i))}
              >
                {areaText('removeRow')}
                <span className="pc-visually-hidden">
                  {' '}
                  {props.rowTitle?.(row, i) ?? areaText('rowLabel', { n: i + 1 })}
                </span>
              </button>
            </p>
          )}
        </fieldset>
      ))}
      {props.fixed || !props.empty ? null : (
        <p className="pc-admin-row">
          <button
            type="button"
            className="pc-admin-btn pc-admin-btn--secondary"
            data-testid={`area-add-${props.path}`}
            onClick={() => props.onChange([...props.rows, props.empty!()])}
          >
            {areaText('addRow')}
          </button>
        </p>
      )}
    </fieldset>
  )
}

/** Formular eines Bereichs: Kontext für Feldfehler, Fehlerliste, Speichern-Knopf, Rückmeldung. */
function AreaForm<V>(props: {
  area: SettingsArea
  values: V
  children: React.ReactNode
  submitLabel?: string
  submitKey?: AreaTextKey
  confirm?: { title: string; consequence: string }
  onSaved?: () => void
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const { busy, errors, feedback, save } = useSave()
  const [asking, setAsking] = useState(false)
  const submit = () =>
    void save(AREA_URL, { area: props.area, values: props.values }, formRef.current, () => {
      setAsking(false)
      props.onSaved?.()
      router.refresh()
    })
  const messages = [...new Set(Object.values(errors))]
  return (
    <Ctx.Provider value={errors}>
      <form
        ref={formRef}
        className="pc-settings__form"
        noValidate
        data-testid={`area-form-${props.area}`}
        onSubmit={(e) => {
          e.preventDefault()
          if (props.confirm) setAsking(true)
          else submit()
        }}
      >
        {props.children}
        {messages.length > 0 ? (
          <div className="pc-field__error" data-testid={`area-errors-${props.area}`}>
            <p>{areaText('errorSummary')}</p>
            <ul>
              {messages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="pc-admin-row">
          <button
            type="submit"
            className="pc-admin-btn pc-admin-btn--primary"
            disabled={busy}
            aria-busy={busy || undefined}
            data-testid={`area-save-${props.area}`}
          >
            {busy ? adminText('actionBusy') : (props.submitLabel ?? areaText('save'))}
          </button>
        </p>
        {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}
        {props.confirm ? (
          <ConfirmDialog
            open={asking}
            title={props.confirm.title}
            consequence={props.confirm.consequence}
            busy={busy}
            onConfirm={submit}
            onCancel={() => setAsking(false)}
          />
        ) : null}
      </form>
    </Ctx.Provider>
  )
}

// --- Shop (P5.22a) ------------------------------------------------------------------------------------------------

export function ShopForm({
  initial,
  blocked,
  translateDisabled,
}: {
  initial: ShopValues
  blocked: string[] | null
  translateDisabled: string | null
}) {
  const [v, setV] = useState(initial)
  return (
    <AreaForm area="shop" values={v}>
      <CheckField
        path="shop.isOpen"
        label={areaText('shopIsOpen')}
        hint={areaText('shopIsOpenHint')}
        checked={v.isOpen}
        onChange={(isOpen) => setV({ ...v, isOpen })}
      />
      {blocked ? (
        <Notice tone="warning" data-testid="settings-shop-blocked">
          {areaText('shopProdBlocked')} {blocked.join('; ')}
        </Notice>
      ) : null}
      <LocalizedField
        path="shop.closedMessage"
        label={areaText('shopClosedMessage')}
        hint={areaText('shopClosedMessageHint')}
        multiline
        maxLength={CLOSED_MESSAGE_MAX + 50}
        value={v.closedMessage}
        onChange={(closedMessage) => setV({ ...v, closedMessage })}
      />
      <TranslateButton<{ text?: string }>
        endpoint={null}
        hasEnglish={v.closedMessage.en.trim() !== ''}
        disabledReason={translateDisabled}
        prepare={async () =>
          v.closedMessage.de.trim()
            ? `/api/globals/settings/translate?text=${encodeURIComponent(v.closedMessage.de)}`
            : null
        }
        onTranslated={(r) =>
          setV((cur) => ({ ...cur, closedMessage: { ...cur.closedMessage, en: r.text ?? '' } }))
        }
      />
      <TextField
        path="shop.maxItemsPerCheckout"
        label={areaText('shopMaxItems')}
        hint={areaText('shopMaxItemsHint')}
        inputMode="numeric"
        value={v.maxItemsPerCheckout}
        onChange={(maxItemsPerCheckout) => setV({ ...v, maxItemsPerCheckout })}
      />
    </AreaForm>
  )
}

// --- Versand (P5.22) ----------------------------------------------------------------------------------------------

export function ShippingForm(props: {
  initial: ShippingValues
  countries: readonly Option[]
  zones: readonly Option[]
  classes: readonly Option[]
  carriers: readonly Option[]
}) {
  const [v, setV] = useState(props.initial)
  const allChecked = Object.values(v.euChecklist).every(Boolean)
  return (
    <AreaForm area="shipping" values={v}>
      <fieldset className="pc-field pc-settings__group" data-testid="settings-countries">
        <legend className="pc-field__label">{areaText('shipCountries')}</legend>
        <p className="pc-order__muted">{areaText('shipCountriesHint')}</p>
        <div className="pc-choices">
          {props.countries.map((c) => (
            <label key={c.value} className="pc-choice">
              <input
                type="checkbox"
                name="shipping.enabledCountries"
                value={c.value}
                checked={v.enabledCountries.includes(c.value)}
                data-testid={`settings-country-${c.value}`}
                onChange={(e) =>
                  setV({
                    ...v,
                    enabledCountries: e.target.checked
                      ? [...v.enabledCountries, c.value]
                      : v.enabledCountries.filter((x) => x !== c.value),
                  })
                }
              />
              {c.label}
            </label>
          ))}
        </div>
        <ErrorLine path="shipping.enabledCountries" />
      </fieldset>
      <fieldset className="pc-field pc-settings__group">
        <legend className="pc-field__label">{areaText('shipEuChecklist')}</legend>
        {(Object.keys(EU_CHECKLIST_LABELS) as EuChecklistKey[]).map((k) => (
          <CheckField
            key={k}
            path={`shipping.euChecklist.${k}`}
            label={EU_CHECKLIST_LABELS[k]}
            checked={v.euChecklist[k]}
            onChange={(on) =>
              setV({
                ...v,
                euChecklist: { ...v.euChecklist, [k]: on },
                euShippingAcknowledged: on ? v.euShippingAcknowledged : false,
              })
            }
          />
        ))}
        <CheckField
          path="shipping.euShippingAcknowledged"
          label={areaText('shipEuAck')}
          hint={
            v.euShippingAcknowledgedAt && v.euShippingAcknowledged
              ? areaText('shipEuAckAt', { date: v.euShippingAcknowledgedAt })
              : areaText('shipEuAckHint')
          }
          checked={v.euShippingAcknowledged}
          disabled={!allChecked && !v.euShippingAcknowledged}
          onChange={(euShippingAcknowledged) => setV({ ...v, euShippingAcknowledged })}
        />
        <p className="pc-order__muted">{areaText('shipFoodNote')}</p>
      </fieldset>
      <CheckField
        path="shipping.pickupEnabled"
        label={areaText('shipPickup')}
        checked={v.pickupEnabled}
        onChange={(pickupEnabled) => setV({ ...v, pickupEnabled })}
      />
      <TextField
        path="shipping.pickupCity"
        label={areaText('shipPickupCity')}
        maxLength={60}
        value={v.pickupCity}
        onChange={(pickupCity) => setV({ ...v, pickupCity })}
      />
      <LocalizedField
        path="shipping.deliveryTimeText"
        label={areaText('shipDeliveryTime')}
        hint={areaText('shipDeliveryTimeHint')}
        maxLength={60}
        value={v.deliveryTimeText}
        onChange={(deliveryTimeText) => setV({ ...v, deliveryTimeText })}
      />
      <Rows
        path="shipping.rates"
        legend={areaText('shipRates')}
        rows={v.rates}
        onChange={(rates) => setV({ ...v, rates })}
        empty={() => ({ zone: 'DE', shippingClass: 'brief', price: '' })}
        render={(r, i, set) => (
          <>
            <SelectField
              path={`shipping.rates.${i}.zone`}
              label={areaText('shipZone')}
              options={props.zones}
              value={r.zone}
              onChange={(zone) => set({ ...r, zone })}
            />
            <SelectField
              path={`shipping.rates.${i}.shippingClass`}
              label={areaText('shipClass')}
              options={props.classes}
              value={r.shippingClass}
              onChange={(shippingClass) => set({ ...r, shippingClass })}
            />
            <TextField
              path={`shipping.rates.${i}.priceCents`}
              label={areaText('shipPrice')}
              inputMode="decimal"
              value={r.price}
              onChange={(price) => set({ ...r, price })}
            />
          </>
        )}
      />
      <Rows
        path="shipping.trackingUrlTemplates"
        legend={areaText('shipTracking')}
        rows={v.trackingUrlTemplates}
        onChange={(trackingUrlTemplates) => setV({ ...v, trackingUrlTemplates })}
        empty={() => ({ carrier: 'dhl', urlTemplate: '' })}
        render={(r, i, set) => (
          <>
            <SelectField
              path={`shipping.trackingUrlTemplates.${i}.carrier`}
              label={areaText('shipCarrier')}
              options={props.carriers}
              value={r.carrier}
              onChange={(carrier) => set({ ...r, carrier })}
            />
            <TextField
              path={`shipping.trackingUrlTemplates.${i}.urlTemplate`}
              label={areaText('shipUrl')}
              type="url"
              value={r.urlTemplate}
              onChange={(urlTemplate) => set({ ...r, urlTemplate })}
            />
          </>
        )}
      />
    </AreaForm>
  )
}

function ErrorLine({ path }: { path: string }) {
  const errors = React.useContext(Ctx)
  const error = errorFor(errors, path)
  return error ? (
    <p className="pc-field__error" data-testid={`area-error-${path}`}>
      {error}
    </p>
  ) : null
}

// --- Verpackung und Checklisten (P5.22) ---------------------------------------------------------------------------

export function PackingForm(props: {
  initial: PackingValues
  classes: readonly Option[]
  materials: readonly Option[]
  children?: React.ReactNode
}) {
  const [v, setV] = useState(props.initial)
  const classLabel = (c: string) => props.classes.find((o) => o.value === c)?.label ?? c
  const templateOptions = v.templates
    .filter((t) => t.key)
    .map((t) => ({ value: t.key, label: t.name || t.key }))
  return (
    <AreaForm area="packing" values={v}>
      <Rows
        path="packingChecklists"
        legend={areaText('packChecklists')}
        rows={v.packingChecklists}
        fixed
        rowTitle={(r) => classLabel(r.shippingClass)}
        onChange={(packingChecklists) => setV({ ...v, packingChecklists })}
        render={(r, i, set) => (
          <TextField
            path={`packingChecklists.${i}.items`}
            label={areaText('packChecklistItems')}
            multiline
            value={r.items}
            onChange={(items) => set({ ...r, items })}
          />
        )}
      />
      <Rows
        path="packaging.templates"
        legend={areaText('packTemplates')}
        hint={areaText('packTemplatesHint')}
        rows={v.templates}
        rowTitle={(t, i) => t.name || areaText('rowLabel', { n: i + 1 })}
        onChange={(templates) => setV({ ...v, templates })}
        empty={() => ({
          key: '',
          name: '',
          components: [{ material: 'paper_cardboard', grams: '' }],
        })}
        render={(t, i, set) => (
          <>
            <TextField
              path={`packaging.templates.${i}.key`}
              label={areaText('packKey')}
              maxLength={40}
              value={t.key}
              onChange={(key) => set({ ...t, key })}
            />
            <TextField
              path={`packaging.templates.${i}.name`}
              label={areaText('packName')}
              maxLength={80}
              value={t.name}
              onChange={(name) => set({ ...t, name })}
            />
            <Rows
              path={`packaging.templates.${i}.components`}
              legend={areaText('packMaterial')}
              rows={t.components}
              onChange={(components) => set({ ...t, components })}
              empty={() => ({ material: 'paper_cardboard', grams: '' })}
              render={(c, j, setC) => (
                <>
                  <SelectField
                    path={`packaging.templates.${i}.components.${j}.material`}
                    label={areaText('packMaterial')}
                    options={props.materials}
                    value={c.material}
                    onChange={(material) => setC({ ...c, material })}
                  />
                  <TextField
                    path={`packaging.templates.${i}.components.${j}.grams`}
                    label={areaText('packGrams')}
                    inputMode="numeric"
                    value={c.grams}
                    onChange={(grams) => setC({ ...c, grams })}
                  />
                </>
              )}
            />
          </>
        )}
      />
      <Rows
        path="packaging.defaultsByShippingClass"
        legend={areaText('packDefaults')}
        rows={v.defaultsByShippingClass}
        fixed
        rowTitle={(d) => classLabel(d.shippingClass)}
        onChange={(defaultsByShippingClass) => setV({ ...v, defaultsByShippingClass })}
        render={(d, i, set) => (
          <SelectField
            path={`packaging.defaultsByShippingClass.${i}.templateKey`}
            label={areaText('packTemplates')}
            options={templateOptions}
            value={d.templateKey}
            onChange={(templateKey) => set({ ...d, templateKey })}
          />
        )}
      />
      {props.children}
    </AreaForm>
  )
}

// --- Kosten (P5.22a) ----------------------------------------------------------------------------------------------

export function CostsForm({ initial }: { initial: CostsValues }) {
  const [v, setV] = useState(initial)
  return (
    <AreaForm area="costs" values={v}>
      <TextField
        path="costs.budgetCents"
        label={areaText('costsBudget')}
        inputMode="decimal"
        value={v.budget}
        onChange={(budget) => setV({ ...v, budget })}
      />
      <TextField
        path="costs.warningThresholdCents"
        label={areaText('costsWarning')}
        hint={areaText('costsWarningHint')}
        inputMode="decimal"
        value={v.warningThreshold}
        onChange={(warningThreshold) => setV({ ...v, warningThreshold })}
      />
      <Rows
        path="costs.monthlyEntries"
        legend={areaText('costsMonthly')}
        rows={v.monthlyEntries}
        onChange={(monthlyEntries) => setV({ ...v, monthlyEntries })}
        empty={() => ({ month: '', amount: '', note: '' })}
        rowTitle={(r, i) => r.month || areaText('rowLabel', { n: i + 1 })}
        render={(r, i, set) => (
          <>
            <TextField
              path={`costs.monthlyEntries.${i}.month`}
              label={areaText('costsMonth')}
              type="month"
              value={r.month}
              onChange={(month) => set({ ...r, month })}
            />
            <TextField
              path={`costs.monthlyEntries.${i}.amountCents`}
              label={areaText('costsAmount')}
              inputMode="decimal"
              value={r.amount}
              onChange={(amount) => set({ ...r, amount })}
            />
            <TextField
              path={`costs.monthlyEntries.${i}.note`}
              label={areaText('costsNote')}
              maxLength={200}
              value={r.note}
              onChange={(note) => set({ ...r, note })}
            />
          </>
        )}
      />
    </AreaForm>
  )
}

// --- Vorlagen (P5.22a) --------------------------------------------------------------------------------------------

export function TemplatesForm({
  initial,
  categories,
}: {
  initial: TemplatesValues
  categories: readonly Option[]
}) {
  const [v, setV] = useState(initial)
  const label = (c: string) => categories.find((o) => o.value === c)?.label ?? c
  const rows = (key: 'safetyTemplates' | 'careTemplates', legend: string) => (
    <Rows
      path={key}
      legend={legend}
      rows={v[key]}
      fixed
      rowTitle={(r) => label(r.category)}
      onChange={(next) => setV({ ...v, [key]: next })}
      render={(r, i, set) => (
        <LocalizedField
          path={`${key}.${i}.text`}
          label={label(r.category)}
          multiline
          value={r.text}
          onChange={(text) => set({ ...r, text })}
        />
      )}
    />
  )
  return (
    <AreaForm area="templates" values={v}>
      <p className="pc-order__muted">{areaText('tplHint')}</p>
      {rows('safetyTemplates', areaText('tplSafety'))}
      {rows('careTemplates', areaText('tplCare'))}
    </AreaForm>
  )
}

// --- Steuer-Bestätigung und Jahressummen (P5.22a, P5.23) ---------------------------------------------------------

export function TaxConfirmForm({ confirmedAt }: { confirmedAt: string | null }) {
  return (
    <AreaForm
      area="taxConfirm"
      values={{}}
      submitLabel={areaText('taxConfirmButton')}
      confirm={{
        title: areaText('taxConfirmDialog'),
        consequence: areaText('taxConfirmConsequence'),
      }}
    >
      <p className="pc-order__muted">{areaText('taxConfirmHint')}</p>
      <p data-testid="settings-tax-confirmed">
        {confirmedAt
          ? areaText('taxConfirmedAt', { date: confirmedAt })
          : areaText('taxConfirmNever')}
      </p>
    </AreaForm>
  )
}

/** Jahressummen vor dem Shop – dieselbe Komponente in „Steuer“ und „Umsatz-Wächter“ (P5.22a/P5.23). */
export function YearTotalsForm({ initial, idPrefix }: { initial: YearRow[]; idPrefix?: string }) {
  const [rows, setRows] = useState(initial)
  return (
    <AreaForm area="yearTotals" values={{ manualYearTotals: rows }}>
      <div data-testid={idPrefix ? `${idPrefix}-year-totals` : undefined}>
        <Rows
          path="revenueGuard.manualYearTotals"
          legend={areaText('yearTotals')}
          hint={areaText('yearTotalsHint')}
          rows={rows}
          onChange={setRows}
          empty={() => ({ year: '', amount: '', note: '' })}
          rowTitle={(r, i) => r.year || areaText('rowLabel', { n: i + 1 })}
          render={(r, i, set) => (
            <>
              <TextField
                path={`revenueGuard.manualYearTotals.${i}.year`}
                label={areaText('yearYear')}
                inputMode="numeric"
                maxLength={4}
                value={r.year}
                onChange={(year) => set({ ...r, year })}
              />
              <TextField
                path={`revenueGuard.manualYearTotals.${i}.amountCents`}
                label={areaText('yearAmount')}
                inputMode="decimal"
                value={r.amount}
                onChange={(amount) => set({ ...r, amount })}
              />
              <TextField
                path={`revenueGuard.manualYearTotals.${i}.note`}
                label={areaText('yearNote')}
                maxLength={200}
                value={r.note}
                onChange={(note) => set({ ...r, note })}
              />
            </>
          )}
        />
      </div>
    </AreaForm>
  )
}

// --- Statistik und Rechtstexte (P5.22a) --------------------------------------------------------------------------

export function AnalyticsForm({ initial }: { initial: AnalyticsValues }) {
  const [v, setV] = useState(initial)
  return (
    <AreaForm area="analytics" values={v}>
      <CheckField
        path="analytics.enabled"
        label={areaText('analyticsEnabled')}
        hint={areaText('analyticsHint')}
        checked={v.enabled}
        onChange={(enabled) => setV({ ...v, enabled })}
      />
      <TextField
        path="analytics.confirmedAt"
        label={areaText('analyticsConfirmedAt')}
        type="date"
        value={v.confirmedAt}
        onChange={(confirmedAt) => setV({ ...v, confirmedAt })}
      />
      <TextField
        path="analytics.note"
        label={areaText('analyticsNote')}
        multiline
        maxLength={300}
        value={v.note}
        onChange={(note) => setV({ ...v, note })}
      />
      <p className="pc-order__muted">{areaText('analyticsLater')}</p>
    </AreaForm>
  )
}

export function LegalForm({ initial }: { initial: LegalValues }) {
  const [v, setV] = useState(initial)
  return (
    <AreaForm area="legal" values={v}>
      <TextField
        path="legal.reviewIntervalDays"
        label={areaText('legalInterval')}
        hint={areaText('legalIntervalHint')}
        inputMode="numeric"
        value={v.reviewIntervalDays}
        onChange={(reviewIntervalDays) => setV({ ...v, reviewIntervalDays })}
      />
      <CheckField
        path="legal.allowVisibleBlankBrands"
        label={areaText('legalBrands')}
        hint={areaText('legalBrandsHint')}
        checked={v.allowVisibleBlankBrands}
        onChange={(allowVisibleBlankBrands) => setV({ ...v, allowVisibleBlankBrands })}
      />
    </AreaForm>
  )
}

// --- Manuelle Monatssummen (P5.23) --------------------------------------------------------------------------------

/** Eine Monatssumme (Monat, Quelle) eintragen oder ändern – `POST /api/globals/settings/revenue-entry`. */
export function RevenueEntryForm({
  months,
  sources,
}: {
  months: readonly Option[]
  sources: readonly Option[]
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const { busy, errors, feedback, save } = useSave()
  const [v, setV] = useState({
    month: months[1]?.value ?? months[0]?.value ?? '',
    source: sources[0]?.value ?? '',
    amount: '',
    note: '',
  })
  return (
    <Ctx.Provider value={errors}>
      <form
        ref={formRef}
        className="pc-settings__form"
        noValidate
        data-testid="revenue-entry-form"
        onSubmit={(e) => {
          e.preventDefault()
          void save('/api/globals/settings/revenue-entry', v, formRef.current, () => {
            setV((cur) => ({ ...cur, amount: '', note: '' }))
            router.refresh()
          })
        }}
      >
        <SelectField
          path="month"
          label={areaText('costsMonth')}
          options={months}
          value={v.month}
          onChange={(month) => setV({ ...v, month })}
        />
        <SelectField
          path="source"
          label={areaText('revenueSource')}
          options={sources}
          value={v.source}
          onChange={(source) => setV({ ...v, source })}
        />
        <TextField
          path="amountCents"
          label={areaText('revenueAmount')}
          hint={areaText('revenueAmountHint')}
          inputMode="decimal"
          value={v.amount}
          onChange={(amount) => setV({ ...v, amount })}
        />
        <TextField
          path="note"
          label={areaText('costsNote')}
          maxLength={200}
          value={v.note}
          onChange={(note) => setV({ ...v, note })}
        />
        <p className="pc-admin-row">
          <button
            type="submit"
            className="pc-admin-btn pc-admin-btn--primary"
            disabled={busy}
            aria-busy={busy || undefined}
            data-testid="revenue-entry-save"
          >
            {busy ? adminText('actionBusy') : areaText('save')}
          </button>
        </p>
        {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}
      </form>
    </Ctx.Provider>
  )
}

// --- Mail-Bausteine (P5.27, „Texte“) ------------------------------------------------------------------------------

type MailTextKey = keyof MailTextsValues

const MAIL_TEXT_FIELDS: readonly {
  key: MailTextKey
  path: string
  label: AreaTextKey
  hint: AreaTextKey
}[] = [
  {
    key: 'signature',
    path: 'emails.signature',
    label: 'mailSignature',
    hint: 'mailSignatureHint',
  },
  {
    key: 'pickupInstructions',
    path: 'pickup.instructions',
    label: 'mailPickup',
    hint: 'mailPickupHint',
  },
  {
    key: 'inquiryResponseTime',
    path: 'emails.inquiryResponseTime',
    label: 'mailResponseTime',
    hint: 'mailResponseTimeHint',
  },
]

/** Mail-Bausteine DE/EN mit „Übersetzen → EN“ je Baustein; gespeichert über den Bereich `mailTexts`. */
export function MailTextsForm({
  initial,
  translateDisabled,
}: {
  initial: MailTextsValues
  translateDisabled: string | null
}) {
  const [v, setV] = useState(initial)
  return (
    <AreaForm area="mailTexts" values={v}>
      {MAIL_TEXT_FIELDS.map((f) => (
        <div key={f.key} data-testid={`mail-text-${f.key}`}>
          <LocalizedField
            path={f.path}
            label={areaText(f.label)}
            hint={areaText(f.hint)}
            multiline
            maxLength={MAIL_TEXT_MAX}
            value={v[f.key]}
            onChange={(next) => setV((cur) => ({ ...cur, [f.key]: next }))}
          />
          <TranslateButton<{ text?: string }>
            endpoint={null}
            hasEnglish={v[f.key].en.trim() !== ''}
            disabledReason={translateDisabled}
            prepare={async () =>
              v[f.key].de.trim()
                ? `/api/globals/settings/translate?text=${encodeURIComponent(v[f.key].de)}`
                : null
            }
            onTranslated={(r) =>
              setV((cur) => ({ ...cur, [f.key]: { ...cur[f.key], en: r.text ?? '' } }))
            }
          />
        </div>
      ))}
    </AreaForm>
  )
}
