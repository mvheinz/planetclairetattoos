import { ValidationError, type Endpoint, type PayloadRequest } from 'payload'

import {
  BIC_MESSAGE,
  BIC_RE,
  getPath,
  normalizeSettingValue,
  SETTINGS_SECTIONS,
  type SettingsSectionKey,
} from '@/admin/views/settings/settingsForm'
import { isAdminRequest } from '@/access'
import { ADMIN_NO_STORE } from '@/endpoints/adminResponse'
import { readJsonBody } from '@/endpoints/products/actions'
import { TAX_MODES, type TaxMode } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { berlinDayStart } from '@/lib/time'

// Speichern der Einstellungen, Teil 1 (PLAN P5.21, KONZEPT §7.14) – Endpunkte am Global `settings` (nur Verwaltung):
// `POST /api/globals/settings/section` `{ section, values }` – Felder eines Bereichs (Whitelist `SETTINGS_SECTIONS`),
// `POST /api/globals/settings/tax-mode` `{ mode, validFrom, reason, confirmedWithTaxAdvisor }` – neuer Steuermodus,
// `POST /api/globals/settings/password` `{ currentPassword, newPassword }` – eigenes Passwort ändern.
// Gespeichert wird immer das ganze Global (sonst sähen die Querschnittsregeln nur einen Teil); Prüfung und Audit
// (`settings_changed` mit maskiertem Diff, `tax_mode_changed`, `retention_setting_changed`) machen Feld-Validierung und
// Hooks des Globals (DATENMODELL §7.1). Fehler kommen als 400 `{ error, errors: [{ path, message }] }`.

const log = createLogger()
const META_KEYS = ['id', 'createdAt', 'updatedAt', 'globalType'] as const

type Obj = Record<string, unknown>
interface FieldError {
  path: string
  message: string
}

const json = (status: number, body: Obj) => Response.json(body, { status, headers: ADMIN_NO_STORE })
const fieldErrors = (errors: FieldError[], error = 'Bitte die markierten Felder prüfen.') =>
  json(400, { error, errors })

function setPath(doc: Obj, path: string, value: unknown): void {
  const keys = path.split('.')
  let cur = doc
  for (const key of keys.slice(0, -1)) {
    if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {}
    cur = cur[key] as Obj
  }
  cur[keys.at(-1)!] = value
}

/** Ganzes Global laden, ändern und speichern (Sprache `de`, englische Texte bleiben unberührt). */
async function updateSettings(req: PayloadRequest, mutate: (doc: Obj) => void) {
  const current = (await req.payload.findGlobal({
    slug: 'settings',
    depth: 0,
    locale: 'de',
    fallbackLocale: false,
    overrideAccess: true,
    req,
  })) as unknown as Obj
  const data = structuredClone(current)
  for (const key of META_KEYS) delete data[key]
  mutate(data)
  return req.payload.updateGlobal({
    slug: 'settings',
    data: data as never,
    depth: 0,
    locale: 'de',
    overrideAccess: true,
    req,
  })
}

function saveErrorResponse(err: unknown, where: string): Response {
  if (err instanceof ValidationError) {
    const errors = (err.data?.errors ?? []).map((e) => ({
      path: String(e.path ?? ''),
      message: e.message,
    }))
    return fieldErrors(errors)
  }
  log.error('settings.save_failed', { where, reason: (err as Error)?.message })
  return json(500, {
    error: 'Speichern hat nicht geklappt. Bitte die Seite neu laden und noch einmal versuchen.',
  })
}

const isSection = (v: unknown): v is SettingsSectionKey =>
  typeof v === 'string' && Object.hasOwn(SETTINGS_SECTIONS, v)

export const settingsSectionEndpoint: Endpoint = {
  path: '/section',
  method: 'post',
  handler: async (req) => {
    if (!isAdminRequest(req)) return json(403, { error: 'Nicht erlaubt.' })
    const body = await readJsonBody(req)
    if (!isSection(body.section)) return json(400, { error: 'Unbekannter Bereich.' })
    const values = (body.values && typeof body.values === 'object' ? body.values : {}) as Obj
    const specs = SETTINGS_SECTIONS[body.section]
    const errors: FieldError[] = []
    const changes: [string, string | null][] = []
    for (const spec of specs) {
      if (!(spec.path in values)) continue
      const value = normalizeSettingValue(spec.path, values[spec.path])
      if (spec.check && value) {
        const problem = spec.check(value)
        if (problem) errors.push({ path: spec.path, message: problem })
      }
      if (spec.path === 'payment.bic' && value && !BIC_RE.test(value)) {
        errors.push({ path: spec.path, message: BIC_MESSAGE })
      }
      if (spec.options && value && !spec.options.some((o) => o.value === value)) {
        errors.push({ path: spec.path, message: 'Bitte einen der angebotenen Werte wählen.' })
      }
      changes.push([spec.path, value])
    }
    const unknown = Object.keys(values).filter((p) => !specs.some((s) => s.path === p))
    if (unknown.length > 0) return json(400, { error: `Nicht änderbar: ${unknown.join(', ')}` })
    if (errors.length > 0) return fieldErrors(errors)
    try {
      let changed = false
      const doc = await updateSettings(req, (data) => {
        for (const [path, value] of changes) {
          if ((getPath(data, path) ?? null) !== value) changed = true
          setPath(data, path, value)
        }
      })
      return json(200, {
        unchanged: !changed,
        values: Object.fromEntries(specs.map((s) => [s.path, getPath(doc, s.path) ?? null])),
      })
    } catch (err) {
      return saveErrorResponse(err, body.section)
    }
  },
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const settingsTaxModeEndpoint: Endpoint = {
  path: '/tax-mode',
  method: 'post',
  handler: async (req) => {
    if (!isAdminRequest(req)) return json(403, { error: 'Nicht erlaubt.' })
    const body = await readJsonBody(req)
    const mode = body.mode
    if (typeof mode !== 'string' || !(TAX_MODES as readonly string[]).includes(mode)) {
      return fieldErrors([{ path: 'mode', message: 'Bitte den Modus wählen.' }])
    }
    if (typeof body.validFrom !== 'string' || !DATE_RE.test(body.validFrom)) {
      return fieldErrors([{ path: 'validFrom', message: 'Bitte „gilt ab“ angeben.' }])
    }
    // „gilt ab“ = Beginn des Berliner Kalendertags
    const validFrom = berlinDayStart(new Date(`${body.validFrom}T12:00:00Z`)).toISOString()
    const entry = {
      mode: mode as TaxMode,
      validFrom,
      reason: typeof body.reason === 'string' ? body.reason.trim() : '',
      confirmedWithTaxAdvisor: body.confirmedWithTaxAdvisor === true,
    }
    try {
      await updateSettings(req, (data) => {
        const tax = (data.tax ?? {}) as Obj
        tax.modes = [...((tax.modes as Obj[] | undefined) ?? []), entry]
        data.tax = tax
      })
      return json(200, { unchanged: false })
    } catch (err) {
      if (err instanceof ValidationError) {
        // Pfade `tax.modes.N.feld` → Feld des Formulars „neuer Steuermodus“
        const errors = (err.data?.errors ?? []).map((e) => ({
          path: String(e.path ?? '')
            .replace(/^tax\.modes\.\d+\./, '')
            .replace(/^tax\.modes$/, 'mode'),
          message: e.message,
        }))
        return fieldErrors(errors)
      }
      return saveErrorResponse(err, 'tax-mode')
    }
  },
}

export const settingsPasswordEndpoint: Endpoint = {
  path: '/password',
  method: 'post',
  handler: async (req) => {
    if (!isAdminRequest(req) || !req.user || req.user.collection !== 'users') {
      return json(403, { error: 'Nicht erlaubt.' })
    }
    const body = await readJsonBody(req)
    const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    const next = typeof body.newPassword === 'string' ? body.newPassword : ''
    if (next.length < 12) {
      return fieldErrors([{ path: 'newPassword', message: 'Mindestens 12 Zeichen.' }])
    }
    if (next === current) {
      return fieldErrors([
        { path: 'newPassword', message: 'Bitte ein anderes als das bisherige Passwort wählen.' },
      ])
    }
    const email = String(req.user.email ?? '')
    try {
      await req.payload.login({ collection: 'users', data: { email, password: current } })
    } catch {
      return fieldErrors([
        { path: 'currentPassword', message: 'Das bisherige Passwort stimmt nicht.' },
      ])
    }
    try {
      await req.payload.update({
        collection: 'users',
        id: req.user.id,
        data: { password: next },
        overrideAccess: true,
        req,
      })
      log.info('settings.password_changed', { userId: req.user.id })
      return json(200, { unchanged: false })
    } catch (err) {
      if (err instanceof ValidationError) {
        return fieldErrors(
          (err.data?.errors ?? []).map((e) => ({ path: 'newPassword', message: e.message })),
        )
      }
      return saveErrorResponse(err, 'password')
    }
  },
}

export const settingsAdminEndpoints: Endpoint[] = [
  settingsSectionEndpoint,
  settingsTaxModeEndpoint,
  settingsPasswordEndpoint,
]
