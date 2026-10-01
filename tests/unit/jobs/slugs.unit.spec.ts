import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { JOB_QUEUES, JOB_TASKS, TASK_DEFS, TASK_SLUGS } from '@/jobs/index'

// P1.9: src/jobs/index.ts entspricht der Tabelle in ARCHITEKTUR Anhang A.3 (Slug und Queue).

function tableA3(): { slug: string; queue: string }[] {
  const doc = readFileSync(path.resolve(process.cwd(), 'docs/ARCHITEKTUR.md'), 'utf8')
  const start = doc.indexOf('### A.3 Task-Slugs der Jobs-Queue')
  const end = doc.indexOf('### A.4', start)
  expect(start).toBeGreaterThan(0)
  return doc
    .slice(start, end)
    .split('\n')
    .filter((l) => l.startsWith('| `'))
    .map((l) => {
      const cells = l.split('|').map((c) => c.trim())
      return { slug: cells[1]!.replace(/`/g, ''), queue: cells[2]! }
    })
}

describe('Task-Slugs (ARCHITEKTUR Anhang A.3)', () => {
  it('gleiche Slugs in gleicher Reihenfolge wie die A.3-Tabelle', () => {
    const rows = tableA3()
    expect(rows.length).toBeGreaterThan(20)
    expect(TASK_SLUGS).toEqual(rows.map((r) => r.slug))
  })

  it('gleiche Queue je Slug; nur die vier Queues aus DATENMODELL §11', () => {
    for (const { slug, queue } of tableA3()) {
      expect(TASK_DEFS[slug as keyof typeof TASK_DEFS].queue, slug).toBe(queue)
    }
    expect([...JOB_QUEUES]).toEqual(['commerce', 'email', 'documents', 'maintenance'])
  })

  it('registriert werden nur umgesetzte Tasks, und nur Slugs aus A.3', () => {
    const registered = JOB_TASKS.map((t) => t.slug)
    expect(registered).toEqual([
      'releaseExpiredReservations',
      'prepaymentReminders',
      'cancelOverduePrepayments',
      'sendEmail',
      'renderInvoicePdf',
      'renderLegalTextPdf',
      'markDelivered',
      'revenueGuardCheck',
      'monthlyClose',
      'invoiceIntegrityCheck',
      'complianceDocsReview',
    ])
    for (const slug of registered) expect(TASK_SLUGS).toContain(slug)
  })
})
