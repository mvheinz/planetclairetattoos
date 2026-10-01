'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { newIdempotencyKey } from '../../components/adminAction'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Notice } from '../../components/Notice'
import { adminText } from '../../translations'
import { SETTINGS_SECTIONS, type SettingsFieldSpec, type SettingsSectionKey } from './settingsForm'

// Handy-Formulare der Einstellungen, Teil 1 (PLAN P5.21, KONZEPT §7.14): je Bereich ein eigenes Formular mit
// „Speichern“, Vorprüfung im Browser (Postfach, Telefon, IBAN-Prüfziffer, BIC), Fehler je Feld (`aria-invalid`,
// `aria-describedby`, Fokus aufs erste fehlerhafte Feld). Endpunkte `POST /api/globals/settings/{section,tax-mode,password}`.

type Errors = Record<string, string>
type Feedback = { tone: 'success' | 'error'; text: string } | null

async function postSettings(
  url: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; unchanged?: boolean; error?: string; errors: Errors }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'idempotency-key': newIdempotencyKey() },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => ({}))) as {
      error?: string
      unchanged?: boolean
      errors?: { path: string; message: string }[]
    }
    const errors: Errors = {}
    for (const e of json.errors ?? []) errors[e.path] ??= e.message
    return { ok: res.ok, unchanged: json.unchanged, error: json.error, errors }
  } catch {
    return { ok: false, error: adminText('actionOffline'), errors: {} }
  }
}

function useSave() {
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [feedback, setFeedback] = useState<Feedback>(null)
  const save = async (
    url: string,
    body: Record<string, unknown>,
    form: HTMLFormElement | null,
    onOk?: () => void,
  ) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setFeedback(null)
    const res = await postSettings(url, body)
    running.current = false
    setBusy(false)
    setErrors(res.errors)
    if (res.ok) {
      setFeedback({
        tone: 'success',
        text: adminText(res.unchanged ? 'settingsUnchanged' : 'settingsSaved'),
      })
      onOk?.()
      return
    }
    setFeedback({ tone: 'error', text: res.error ?? adminText('settingsCheckFields') })
    const first = Object.keys(res.errors)[0]
    if (first && form) {
      const el = form.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]`)
      el?.focus()
    }
  }
  return { busy, errors, setErrors, feedback, save }
}

function Field({
  spec,
  value,
  error,
  onChange,
  options,
}: {
  spec: SettingsFieldSpec
  value: string
  error?: string
  onChange: (v: string) => void
  options?: readonly { value: string; label: string }[]
}) {
  const id = useId()
  const hintId = useId()
  const errId = useId()
  const describedBy = [spec.hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ')
  const common = {
    id,
    name: spec.path,
    value,
    required: spec.required,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
    'data-testid': `settings-field-${spec.path}`,
  }
  const opts = spec.options ?? options ?? []
  return (
    <div className="pc-field">
      <label htmlFor={id} className="pc-field__label">
        {spec.label}
        {spec.required ? (
          <span className="pc-field__required" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {spec.input === 'textarea' ? (
        <textarea
          {...common}
          rows={3}
          maxLength={spec.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : spec.input === 'select' ? (
        <select {...common} onChange={(e) => onChange(e.target.value)}>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={spec.input}
          inputMode={spec.input === 'tel' ? 'tel' : undefined}
          autoComplete={spec.autoComplete}
          maxLength={spec.maxLength}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {spec.hint ? (
        <p id={hintId} className="pc-order__muted">
          {spec.hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} className="pc-field__error" data-testid={`settings-error-${spec.path}`}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

export interface SettingsSectionFormProps {
  section: SettingsSectionKey
  initial: Record<string, string>
  /** Optionen für Auswahlfelder ohne feste Optionen (z. B. Land). */
  options?: Record<string, readonly { value: string; label: string }[]>
  /** Vor dem Speichern bestätigen (z. B. Aufbewahrungsdauer, K-33). */
  confirm?: { title: string; consequence: string }
}

export function SettingsSectionForm({
  section,
  initial,
  options,
  confirm,
}: SettingsSectionFormProps) {
  const router = useRouter()
  const specs = SETTINGS_SECTIONS[section]
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [asking, setAsking] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const { busy, errors, setErrors, feedback, save } = useSave()
  const dirty = specs.some((s) => (values[s.path] ?? '') !== (initial[s.path] ?? ''))

  const submit = () => {
    // Vorprüfung im Browser (der Server prüft dieselben Regeln)
    const local: Errors = {}
    for (const s of specs) {
      const v = (values[s.path] ?? '').trim()
      if (s.required && !v) local[s.path] = adminText('settingsRequired')
      else if (v && s.check) {
        const problem = s.check(v)
        if (problem) local[s.path] = problem
      }
    }
    if (Object.keys(local).length > 0) {
      setErrors(local)
      const first = formRef.current?.querySelector<HTMLElement>(
        `[name="${CSS.escape(Object.keys(local)[0]!)}"]`,
      )
      first?.focus()
      return
    }
    const changed = Object.fromEntries(
      specs.filter((s) => s.path in values).map((s) => [s.path, values[s.path] ?? '']),
    )
    void save(
      '/api/globals/settings/section',
      { section, values: changed },
      formRef.current,
      () => {
        setAsking(false)
        router.refresh()
      },
    )
  }

  return (
    <form
      ref={formRef}
      className="pc-settings__form"
      noValidate
      data-testid={`settings-form-${section}`}
      onSubmit={(e) => {
        e.preventDefault()
        if (confirm && dirty) setAsking(true)
        else submit()
      }}
    >
      {specs.map((spec) => (
        <Field
          key={spec.path}
          spec={spec}
          value={values[spec.path] ?? ''}
          error={errors[spec.path]}
          options={options?.[spec.path]}
          onChange={(v) => setValues((cur) => ({ ...cur, [spec.path]: v }))}
        />
      ))}
      <p className="pc-admin-row">
        <button
          type="submit"
          className="pc-admin-btn pc-admin-btn--primary"
          disabled={busy}
          aria-busy={busy || undefined}
          data-testid={`settings-save-${section}`}
        >
          {busy ? adminText('actionBusy') : adminText('settingsSave')}
        </button>
      </p>
      {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}
      {confirm ? (
        <ConfirmDialog
          open={asking}
          title={confirm.title}
          consequence={confirm.consequence}
          busy={busy}
          onConfirm={submit}
          onCancel={() => setAsking(false)}
        />
      ) : null}
    </form>
  )
}

export function TaxModeForm({
  modes,
  today,
}: {
  modes: readonly { value: string; label: string }[]
  today: string
}) {
  const router = useRouter()
  const [mode, setMode] = useState(modes[0]?.value ?? '')
  const [validFrom, setValidFrom] = useState(today)
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const { busy, errors, feedback, save } = useSave()
  const ids = { mode: useId(), from: useId(), reason: useId(), err: useId() }
  const err = (path: string) =>
    errors[path] ? (
      <p className="pc-field__error" id={`${ids.err}-${path}`}>
        {errors[path]}
      </p>
    ) : null
  const described = (path: string) => (errors[path] ? `${ids.err}-${path}` : undefined)

  return (
    <form
      ref={formRef}
      className="pc-settings__form"
      noValidate
      data-testid="settings-form-tax-mode"
      onSubmit={(e) => {
        e.preventDefault()
        void save(
          '/api/globals/settings/tax-mode',
          { mode, validFrom, reason, confirmedWithTaxAdvisor: confirmed },
          formRef.current,
          () => {
            setReason('')
            setConfirmed(false)
            router.refresh()
          },
        )
      }}
    >
      <h3>{adminText('settingsTaxNew')}</h3>
      <Notice tone="warning">{adminText('settingsTaxWarning')}</Notice>
      <div className="pc-field">
        <label htmlFor={ids.mode} className="pc-field__label">
          {adminText('settingsTaxMode')}
        </label>
        <select
          id={ids.mode}
          name="mode"
          value={mode}
          aria-invalid={errors.mode ? true : undefined}
          aria-describedby={described('mode')}
          onChange={(e) => setMode(e.target.value)}
        >
          {modes.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {err('mode')}
      </div>
      <div className="pc-field">
        <label htmlFor={ids.from} className="pc-field__label">
          {adminText('settingsTaxValidFrom')}
        </label>
        <input
          id={ids.from}
          name="validFrom"
          type="date"
          min={today}
          value={validFrom}
          aria-invalid={errors.validFrom ? true : undefined}
          aria-describedby={described('validFrom')}
          onChange={(e) => setValidFrom(e.target.value)}
        />
        {err('validFrom')}
      </div>
      <div className="pc-field">
        <label htmlFor={ids.reason} className="pc-field__label">
          {adminText('settingsTaxReason')}
        </label>
        <textarea
          id={ids.reason}
          name="reason"
          rows={3}
          maxLength={300}
          value={reason}
          aria-invalid={errors.reason ? true : undefined}
          aria-describedby={described('reason')}
          onChange={(e) => setReason(e.target.value)}
        />
        {err('reason')}
      </div>
      <label className="pc-choice">
        <input
          type="checkbox"
          name="confirmedWithTaxAdvisor"
          checked={confirmed}
          aria-invalid={errors.confirmedWithTaxAdvisor ? true : undefined}
          aria-describedby={described('confirmedWithTaxAdvisor')}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {adminText('settingsTaxConfirmed')}
      </label>
      {err('confirmedWithTaxAdvisor')}
      <p className="pc-admin-row">
        <button
          type="submit"
          className="pc-admin-btn pc-admin-btn--secondary"
          disabled={busy}
          aria-busy={busy || undefined}
          data-testid="settings-save-tax-mode"
        >
          {busy ? adminText('actionBusy') : adminText('settingsTaxAdd')}
        </button>
      </p>
      {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}
    </form>
  )
}

export function PasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const { busy, errors, setErrors, feedback, save } = useSave()
  const ids = { current: useId(), next: useId(), hint: useId(), err: useId() }
  return (
    <form
      ref={formRef}
      className="pc-settings__form"
      noValidate
      data-testid="settings-form-password"
      onSubmit={(e) => {
        e.preventDefault()
        if (next.length < 12) {
          setErrors({ newPassword: adminText('settingsPasswordShort') })
          formRef.current?.querySelector<HTMLElement>('[name="newPassword"]')?.focus()
          return
        }
        void save(
          '/api/globals/settings/password',
          { currentPassword: current, newPassword: next },
          formRef.current,
          () => {
            setCurrent('')
            setNext('')
          },
        )
      }}
    >
      <div className="pc-field">
        <label htmlFor={ids.current} className="pc-field__label">
          {adminText('settingsPasswordCurrent')}
        </label>
        <input
          id={ids.current}
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={current}
          aria-invalid={errors.currentPassword ? true : undefined}
          aria-describedby={errors.currentPassword ? `${ids.err}-current` : undefined}
          onChange={(e) => setCurrent(e.target.value)}
          data-testid="settings-password-current"
        />
        {errors.currentPassword ? (
          <p className="pc-field__error" id={`${ids.err}-current`}>
            {errors.currentPassword}
          </p>
        ) : null}
      </div>
      <div className="pc-field">
        <label htmlFor={ids.next} className="pc-field__label">
          {adminText('settingsPasswordNew')}
        </label>
        <input
          id={ids.next}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={next}
          aria-invalid={errors.newPassword ? true : undefined}
          aria-describedby={[ids.hint, errors.newPassword ? `${ids.err}-new` : null]
            .filter(Boolean)
            .join(' ')}
          onChange={(e) => setNext(e.target.value)}
          data-testid="settings-password-new"
        />
        <p id={ids.hint} className="pc-order__muted">
          {adminText('settingsPasswordHint')}
        </p>
        {errors.newPassword ? (
          <p className="pc-field__error" id={`${ids.err}-new`}>
            {errors.newPassword}
          </p>
        ) : null}
      </div>
      <p className="pc-admin-row">
        <button
          type="submit"
          className="pc-admin-btn pc-admin-btn--secondary"
          disabled={busy || !current || !next}
          aria-busy={busy || undefined}
          data-testid="settings-save-password"
        >
          {busy ? adminText('actionBusy') : adminText('settingsPasswordSave')}
        </button>
      </p>
      {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}
    </form>
  )
}
