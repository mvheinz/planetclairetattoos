import 'server-only'

import type { Payload } from 'payload'

import { createLogger } from '@/lib/monitoring/logger'

import { createCommissionFormToken } from './formToken'
import { submitCommission, type CommissionFieldErrors, type SubmitCommissionResult } from './submit'

// Zustand des Auftragsarbeiten-Formulars R10 für `useActionState` (PLAN P7.12/P7.13): ohne JavaScript ein normales
// POST-Formular, dessen Antwort den Zustand rendert. Eingaben bleiben bei Fehlern nur im Seitenzustand stehen (kein
// Browser-Speicher, R-130), nie in der URL (R-137). Läuft das Formular-Token ab, gibt es ein neues mit Hinweis.

const log = createLogger()

export interface CommissionFormValues {
  name: string
  email: string
  objectType: string
  objectTypeOther: string
  idea: string
  desiredTimeframe: string
  budget: string
}

export type CommissionNotice = 'rate_limited' | 'expired' | 'failed'

export type CommissionFormState =
  | {
      step: 'form'
      rev: number
      token: string
      values: CommissionFormValues
      errors?: CommissionFieldErrors
      notice?: CommissionNotice
    }
  | { step: 'done'; rev: number; reference: string | null }

export const emptyCommissionValues = (): CommissionFormValues => ({
  name: '',
  email: '',
  objectType: '',
  objectTypeOther: '',
  idea: '',
  desiredTimeframe: '',
  budget: '',
})

/** Startzustand beim Rendern von R10 (neues Formular-Token, Zeitfalle beginnt jetzt). */
export function initialCommissionState(now: Date): CommissionFormState {
  return {
    step: 'form',
    rev: 0,
    token: createCommissionFormToken(now),
    values: emptyCommissionValues(),
  }
}

const LIMITS: Record<keyof CommissionFormValues, number> = {
  name: 200,
  email: 300,
  objectType: 40,
  objectTypeOther: 200,
  idea: 4000,
  desiredTimeframe: 300,
  budget: 200,
}

function valuesOf(fd: FormData): CommissionFormValues {
  const out = emptyCommissionValues()
  for (const key of Object.keys(LIMITS) as (keyof CommissionFormValues)[]) {
    const v = fd.get(key)
    out[key] = typeof v === 'string' ? v.slice(0, LIMITS[key]) : ''
  }
  return out
}

export interface CommissionStepContext {
  now: Date
  ip?: string | null
  payload?: Payload
}

/** Ein Absenden des Formulars → nächster Zustand. */
export async function commissionStep(
  prev: CommissionFormState | undefined,
  fd: FormData,
  ctx: CommissionStepContext,
): Promise<CommissionFormState> {
  const rev = (prev?.rev ?? 0) + 1
  const values = valuesOf(fd)
  const token = typeof fd.get('formToken') === 'string' ? String(fd.get('formToken')) : ''
  let result: SubmitCommissionResult
  try {
    result = await submitCommission(fd, { now: ctx.now, ip: ctx.ip ?? null, payload: ctx.payload })
  } catch (e) {
    log.error('commission.submit_failed', { reason: (e as Error)?.message })
    return { step: 'form', rev, token, values, notice: 'failed' }
  }
  if (result.ok) {
    return { step: 'done', rev, reference: result.spam ? null : result.reference }
  }
  if (result.code === 'expired') {
    return {
      step: 'form',
      rev,
      token: createCommissionFormToken(ctx.now),
      values,
      notice: 'expired',
    }
  }
  if (result.code === 'rate_limited')
    return { step: 'form', rev, token, values, notice: 'rate_limited' }
  return { step: 'form', rev, token, values, errors: result.errors }
}
