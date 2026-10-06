import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import React from 'react'

import {
  COCO_FRAMES,
  COCO_SPRITE_HREF,
  COCO_VIEWBOX,
  bridgeSymbol,
  cocoHref,
  poseSymbol,
  type CocoFrame,
} from '@/leash/cocoSprite'
import {
  QA_BRIDGES,
  QA_COCO_SIZES,
  QA_PARTS,
  QA_POSES,
  parseQaCocoQuery,
  symbolContent,
  type QaCocoQuery,
} from '@/lib/qa/cocoSheet'

import { requireArtQa } from '../guard'
import { QaFrame } from '../QaFrame'
import styles from '../qa.module.css'

// `/{locale}/qa/coco` (KUNST-QA §3.2, SC-12): alle 22 Coco-Symbole in allen Größenklassen; `?boil=0` Boil aus,
// `?parts=1` färbt die `data-part`-Gruppen (Symbole dafür inline statt `<use>`), `?frame=a|b|c` zeigt nur einen Frame.

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function queryHref(locale: string, q: QaCocoQuery): string {
  const sp = new URLSearchParams()
  if (!q.boil) sp.set('boil', '0')
  if (q.parts) sp.set('parts', '1')
  if (q.frame) sp.set('frame', q.frame)
  const s = sp.toString()
  return `/${locale}/qa/coco${s ? `?${s}` : ''}`
}

function Cell({
  ids,
  pose,
  w,
  size,
  stroke,
  boil,
  inline,
}: {
  ids: readonly { id: string; cls: string }[]
  pose: string
  w: number
  size: string
  stroke: number
  boil: boolean
  inline: Map<string, string> | null
}) {
  return (
    <span
      className={styles.cocoCell}
      style={{ '--qa-w': `${w}px`, '--qa-stroke': `${stroke}px` } as React.CSSProperties}
    >
      <span
        className="coco"
        data-size={size}
        data-pose={pose}
        data-boil={boil ? 'on' : 'off'}
        data-qa-symbol={ids.map((i) => i.id).join(' ')}
        data-qa-w={w}
        aria-hidden="true"
        style={{ display: 'block' }}
      >
        <span className="coco__hop" style={{ display: 'block' }}>
          <svg viewBox={`0 0 ${COCO_VIEWBOX.w} ${COCO_VIEWBOX.h}`} focusable="false">
            {ids.map(({ id, cls }) =>
              inline ? (
                <g
                  key={id}
                  className={cls}
                  dangerouslySetInnerHTML={{ __html: inline.get(id) ?? '' }}
                />
              ) : (
                <use key={id} className={cls} href={cocoHref(id, COCO_SPRITE_HREF)} />
              ),
            )}
          </svg>
        </span>
      </span>
    </span>
  )
}

export default async function QaCocoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: SearchParams
}) {
  const locale = await requireArtQa(params)
  const q = parseQaCocoQuery(await searchParams)
  const t = await getTranslations({ locale, namespace: 'qa' })
  let inline: Map<string, string> | null = null
  if (q.parts) {
    const sprite = await readFile(path.join(process.cwd(), 'public', COCO_SPRITE_HREF), 'utf8')
    const ids = [
      ...QA_POSES.flatMap((p) => COCO_FRAMES.map((f) => poseSymbol(p, f))),
      ...QA_BRIDGES.map(bridgeSymbol),
    ]
    inline = new Map(ids.map((id) => [id, symbolContent(sprite, id) ?? '']))
  }
  // Einzelner Frame: ein Symbol mit Klasse `f` (Boil aus → sichtbar); sonst die drei Frames wie `Coco.tsx`.
  const poseIds = (pose: (typeof QA_POSES)[number]) =>
    q.frame
      ? [{ id: poseSymbol(pose, q.frame), cls: 'f' }]
      : COCO_FRAMES.map((f: CocoFrame) => ({ id: poseSymbol(pose, f), cls: `f f-${f}` }))
  const boil = q.boil && !q.frame && !q.parts
  const rows = [
    ...QA_POSES.map((pose) => ({
      key: pose,
      label: `${t('pose')} ${pose}`,
      pose,
      ids: poseIds(pose),
      boil,
    })),
    ...QA_BRIDGES.map((b) => ({
      key: `bridge-${b}`,
      label: `${t('bridge')} ${b}`,
      pose: `bridge-${b}`,
      ids: [{ id: bridgeSymbol(b), cls: 'f' }],
      boil: false,
    })),
  ]
  const toggle = (patch: Partial<QaCocoQuery>) => queryHref(locale, { ...q, ...patch })

  return (
    <QaFrame locale={locale} page="coco" wide>
      <div className={styles.controls} data-qa-controls="">
        <Link href={toggle({ boil: !q.boil })} data-qa-toggle="boil">
          {q.boil ? t('boilOff') : t('boilOn')}
        </Link>
        <Link href={toggle({ parts: !q.parts })} data-qa-toggle="parts">
          {q.parts ? t('partsOff') : t('parts')}
        </Link>
        <Link href={toggle({ frame: null })} aria-current={q.frame === null ? 'true' : undefined}>
          {t('allFrames')}
        </Link>
        {COCO_FRAMES.map((f) => (
          <Link
            key={f}
            href={toggle({ frame: f })}
            aria-current={q.frame === f ? 'true' : undefined}
          >
            {t('frame', { frame: f.toUpperCase() })}
          </Link>
        ))}
      </div>
      {q.parts ? (
        <ul className={styles.legend} aria-label={t('parts')}>
          {QA_PARTS.map((p) => (
            <li key={p} className={styles.parts}>
              <svg width="14" height="8" aria-hidden="true">
                <g data-part={p}>
                  <path d="M1 4h12" strokeWidth="3" />
                </g>
              </svg>{' '}
              {p}
            </li>
          ))}
        </ul>
      ) : null}
      <table className={`${styles.cocoTable} ${q.parts ? styles.parts : ''}`} data-qa-coco="">
        <thead>
          <tr>
            <th scope="col" />
            {QA_COCO_SIZES.map((s) => (
              <th key={s.w} scope="col">
                {t('size', { px: s.w })} · {s.size}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} data-qa-row={r.key}>
              <th scope="row">{r.label}</th>
              {QA_COCO_SIZES.map((s) => (
                <td key={s.w}>
                  <Cell
                    ids={r.ids}
                    pose={r.pose}
                    w={s.w}
                    size={s.size}
                    stroke={s.stroke}
                    boil={r.boil}
                    inline={inline}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </QaFrame>
  )
}
