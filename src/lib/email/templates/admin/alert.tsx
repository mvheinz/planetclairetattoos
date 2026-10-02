import 'server-only'

import { z } from 'zod'

import { AdminFooter, adminFooterText, EmailLayout, renderMailHtml } from '../../layout'
import type { RenderedMail, TemplateRenderInput } from '../../registry'
import { S } from '../../layout/styles'

// A12 `admin_alert` (KONZEPT §6.4): „Technisches Problem: {Kurzbeschreibung}“ – was betroffen ist, was automatisch
// passiert ist, was zu tun ist; Direktlink in die Verwaltung. Immer Deutsch, ohne Kund:innen-Freitexte.

export const ADMIN_ALERT_VERSION = 'a12-v2'

export const adminAlertDataSchema = z.object({
  /** Fehlerart (höchstens eine Mail je Art und Stunde, `src/lib/email/alerts.ts`). */
  kind: z.string().min(1).max(80),
  summary: z.string().min(1).max(160),
  affected: z.string().max(1000).optional(),
  automatic: z.string().max(1000).optional(),
  todo: z.string().max(1000).optional(),
  /** Pfad unterhalb von `ADMIN_ROUTE`, z. B. `/collections/orders/17`. */
  adminPath: z
    .string()
    .regex(/^\/[\w\-/?=&.]*$/)
    .max(200)
    .optional(),
})
export type AdminAlertData = z.infer<typeof adminAlertDataSchema>

const SECTIONS = [
  ['affected', 'Betroffen'],
  ['automatic', 'Automatisch passiert'],
  ['todo', 'Zu tun'],
] as const

export async function renderAdminAlert(
  input: TemplateRenderInput<AdminAlertData>,
): Promise<RenderedMail> {
  const { data, links } = input
  const subject = `Technisches Problem: ${data.summary}`.slice(0, 200)
  const parts = SECTIONS.filter(([k]) => data[k])
  const html = await renderMailHtml(
    <EmailLayout
      locale="de"
      title={subject}
      footer={<AdminFooter links={links} adminPath={data.adminPath} />}
    >
      {parts.map(([k, label]) => (
        <p key={k} style={S.p}>
          <strong>{label}:</strong> {data[k]}
        </p>
      ))}
    </EmailLayout>,
  )
  const text = [
    subject,
    '',
    ...parts.flatMap(([k, label]) => [`${label}: ${data[k]}`, '']),
    adminFooterText(links, data.adminPath),
    '',
  ].join('\n')
  return { subject, html, text, images: [] }
}
