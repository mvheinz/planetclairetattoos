'use client'

import React from 'react'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Choice'
import type { WithdrawalFlowState, WithdrawalNotice } from '@/lib/legal/withdrawalForm'

import type { WithdrawalMessages } from './WithdrawalFlow'
import styles from './WithdrawalFlow.module.css'

// Schritte nach der Erklärung (Auswahl der Stücke, Schritt 2 „Widerruf bestätigen“, Ergebnis) der Widerrufsfunktion R26
// (PLAN P6.8). Eigenes Modul, das `WithdrawalFlow` per `next/dynamic` lädt: beim ersten Aufruf steht nur Schritt 1 auf
// der Seite, die übrigen Schritte (mit Checkboxen und Zusammenfassung) kommen nach dem `load`-Ereignis bzw. beim
// Absenden – hält das JS beim ersten Laden von R26 im Budget (firstLoadJs, tests/perf/budgets.json). Ohne JavaScript
// rendert der Server den jeweiligen Schritt wie bisher.

export interface WithdrawalStepContext {
  m: WithdrawalMessages
  confirmLabel: string
  contact: React.ReactNode
  dispatch: (payload: FormData) => void
  pending: boolean
  guard: (e: React.FormEvent<HTMLFormElement>) => void
  heading: (text: string) => React.ReactNode
  hidden: (stage: string) => React.ReactNode
  noticeText: (n: WithdrawalNotice | undefined) => string | null
  NoticeBox: (props: { children: React.ReactNode }) => React.ReactNode
}

export function WithdrawalSteps({
  state,
  ctx,
}: {
  state: Exclude<WithdrawalFlowState, { step: 'form' }>
  ctx: WithdrawalStepContext
}) {
  const { m } = ctx

  // Zusammenfassung (Schritt 2 und Bestätigung): Angaben in Formular-Reihenfolge, Stücke nur, wenn bekannt.
  const summaryRows = (
    d: {
      name: string
      contractIdentification: string
      email: string
      itemsText?: string | null
      reason?: string | null
    },
    items: React.ReactNode,
  ) => (
    <>
      <dt>{m.nameLabel}</dt>
      <dd>{d.name}</dd>
      <dt>{m.contractLabel}</dt>
      <dd>{d.contractIdentification}</dd>
      <dt>{m.emailLabel}</dt>
      <dd>{d.email}</dd>
      {items ? (
        <>
          <dt>{m.summaryItems}</dt>
          <dd>{items}</dd>
        </>
      ) : null}
      <dt>{m.itemsTextLabel}</dt>
      <dd>{d.itemsText?.trim() || m.summaryEmpty}</dd>
      <dt>{m.reasonLabel}</dt>
      <dd>{d.reason?.trim() || m.summaryEmpty}</dd>
    </>
  )

  if (state.step === 'select') {
    return (
      <section className={styles.step} data-withdraw-step="select" key={`select-${state.rev}`}>
        {ctx.heading(m.stepSelect)}
        <p>{m.selectIntro}</p>
        <form
          action={ctx.dispatch}
          onSubmit={ctx.guard}
          className={styles.form}
          data-withdraw-form=""
        >
          {ctx.hidden('select')}
          <input type="hidden" name="token" value={state.token} />
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{m.selectLegend}</legend>
            {state.choices.map((c, i) => (
              <Checkbox
                key={c.id}
                id={`widerruf-position-${i}`}
                name="affectedItemIds"
                value={c.id}
                label={c.label}
              />
            ))}
          </fieldset>
          <p className={styles.small} data-withdraw-whole="">
            {m.selectWhole}
          </p>
          <div className={styles.actions}>
            <Button type="submit" name="intent" value="edit" variant="secondary">
              {m.edit}
            </Button>
            <Button type="submit" name="intent" value="next" ariaDisabled={ctx.pending}>
              {m.next}
            </Button>
          </div>
        </form>
      </section>
    )
  }

  if (state.step === 'confirm') {
    const v = state.values
    const notice = ctx.noticeText(state.notice)
    const items = state.selectedLabels.length > 0 ? state.selectedLabels : null
    return (
      <section className={styles.step} data-withdraw-step="confirm" key={`confirm-${state.rev}`}>
        {ctx.heading(m.stepConfirm)}
        {notice ? (
          <ctx.NoticeBox>
            {notice}
            {ctx.contact}
          </ctx.NoticeBox>
        ) : null}
        <p>{m.confirmIntro}</p>
        <dl className={styles.summary} data-withdraw-summary="">
          {summaryRows(
            v,
            state.matched ? (
              items ? (
                <ul>
                  {items.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              ) : (
                m.summaryWhole
              )
            ) : null,
          )}
        </dl>
        <form
          action={ctx.dispatch}
          onSubmit={ctx.guard}
          className={styles.form}
          data-withdraw-form=""
        >
          {ctx.hidden('confirm')}
          <input type="hidden" name="token" value={state.token} />
          <div className={styles.actions}>
            <Button type="submit" name="intent" value="edit" variant="secondary">
              {m.edit}
            </Button>
            <Button type="submit" name="intent" value="confirm" ariaDisabled={ctx.pending}>
              {ctx.confirmLabel}
            </Button>
          </div>
          <p className={styles.live} aria-live="polite">
            {ctx.pending ? m.busy : ''}
          </p>
        </form>
      </section>
    )
  }

  const r = state.receipt
  return (
    <section className={styles.step} data-withdraw-step="done" key={`done-${state.rev}`}>
      {ctx.heading(m.stepDone)}
      {r ? (
        <>
          <dl className={styles.summary} data-withdraw-receipt="">
            <dt>{m.reference}</dt>
            <dd data-withdraw-reference="">{r.reference}</dd>
            <dt>{m.receivedAt}</dt>
            <dd data-withdraw-received-at="">{r.receivedAtText}</dd>
            {summaryRows(
              r,
              state.itemLabels.length > 0 ? (
                <ul>
                  {state.itemLabels.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              ) : null,
            )}
          </dl>
          {r.unpaidOrderCancelled ? <p data-withdraw-unpaid="">{m.unpaidCancelled}</p> : null}
          <p data-withdraw-mail-note="">{m.mailNote}</p>
          <p className={styles.small}>{m.printNote}</p>
          <p className="u-no-print">
            <Button variant="secondary" onClick={() => window.print()}>
              {m.print}
            </Button>
          </p>
        </>
      ) : (
        <p>{m.spamDone}</p>
      )}
    </section>
  )
}
