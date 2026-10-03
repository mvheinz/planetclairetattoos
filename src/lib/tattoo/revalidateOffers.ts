import 'server-only'

import type { PayloadRequest } from 'payload'

import { revalidateOfferPages } from '@/lib/cache/revalidate'
import { listJobRuns, poolDb } from '@/lib/jobs/runLog'
import { periodOf } from '@/lib/jobs/runOnce'

import { boundariesBetween, nextOfferBoundary } from './offers'

// Task `revalidateEndedOffers` (KONZEPT §8.2, DATENMODELL §11, ARCHITEKTUR §9.3/Anhang A.3, R-171): Seit dem letzten
// erfolgreichen Lauf erreichte Beginn- oder Endzeitpunkte veröffentlichter Angebote ⇒ `tattoo-offers` und `home`
// sofort erneuern sowie R01, R11, R13 neu erzeugen. Zusätzlich ein tägliches Sicherheitsnetz ab 00:05 Berlin (damit
// „in X Tagen“ stimmt). Zustandsbasiert: Ein zweiter Lauf zur selben Zeit findet nichts Neues (AK-8-01). Weckzeit des
// nächsten Beginns bzw. Endes über `jobAlarm.bump` (beim Speichern setzt der Collection-Hook sie zusätzlich).

export const REVALIDATE_OFFERS_TASK = 'revalidateEndedOffers'
/** Sicherheitsnetz täglich ab 00:05 Europe/Berlin. */
export const OFFERS_SAFETY_NET = { berlinHour: 0, berlinMinute: 5 } as const

export interface RevalidateOffersResult {
  revalidated: boolean
  /** Erreichte Zeitpunkte (Beginn/Ende) seit dem letzten Lauf. */
  boundaries: number
  /** Tagesschlüssel des Sicherheitsnetzes, wenn dieser Lauf es erledigt hat. */
  period: string | null
  /** Bis hierhin abgearbeitet (nächster Lauf zählt ab hier). */
  handledUntil: string
  /** Nächster Beginn/Ende nach `now`. */
  nextDueAt: Date | null
  targets: string[]
}

/** Letzter abgearbeiteter Zeitpunkt aus dem Lauf-Protokoll (`counts.handledUntil` des letzten erfolgreichen Laufs). */
async function lastHandled(
  req: PayloadRequest,
): Promise<{ at: Date | null; periods: Set<string> }> {
  const runs = await listJobRuns(poolDb(req.payload), { task: REVALIDATE_OFFERS_TASK, limit: 50 })
  let at: Date | null = null
  const periods = new Set<string>()
  for (const run of runs) {
    if (run.status !== 'ok' || !run.counts) continue
    const until = run.counts.handledUntil
    if (at === null && typeof until === 'string' && !Number.isNaN(Date.parse(until))) {
      at = new Date(until)
    }
    if (typeof run.counts.period === 'string') periods.add(run.counts.period)
  }
  return { at, periods }
}

export async function revalidateEndedOffers(
  req: PayloadRequest,
  now: Date,
): Promise<RevalidateOffersResult> {
  const res = await req.payload.find({
    collection: 'tattoo-offers',
    where: { published: { equals: true } },
    depth: 0,
    limit: 1000,
    pagination: false,
    select: { startsAt: true, endsAt: true },
    overrideAccess: true,
    req,
  })
  const offers = res.docs.map((d) => ({ startsAt: d.startsAt, endsAt: d.endsAt }))
  const { at, periods } = await lastHandled(req)
  // Ohne früheren Lauf zählt jeder schon erreichte Zeitpunkt (erster Lauf nach der Einführung).
  const boundaries = boundariesBetween(offers, at, now)
  const net = periodOf('day', OFFERS_SAFETY_NET.berlinHour, now, OFFERS_SAFETY_NET.berlinMinute)
  const netDue = net.reached && !periods.has(net.period)
  const due = boundaries > 0 || netDue
  const targets = due ? revalidateOfferPages({ context: req.context }) : []
  return {
    revalidated: due,
    boundaries,
    period: due && net.reached ? net.period : null,
    handledUntil: now.toISOString(),
    nextDueAt: nextOfferBoundary(offers, now),
    targets,
  }
}
