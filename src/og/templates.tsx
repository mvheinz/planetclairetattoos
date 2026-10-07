import React from 'react'

import { inkStrokePath, type Pt } from '@/art/inkStroke'
import {
  STAMP_VIEWBOX,
  stampAngle,
  stampFramePaths,
  tagAngle,
  tagOutlinePath,
} from '@/lib/shop/priceTag'

import { keepCovered, textWidth } from './metrics'
import { wrapLines } from './text'

// Vorlagen der OG-Bilder (P3.14, DESIGN §12.6) als JSX für `next/og` (`ImageResponse`, satori): nur Flexbox, absolute
// Positionen, eingebettete Bilder als Data-URL, Schriften Spectral 500 Italic und Bricolage Grotesque 600 (TTF). Farben aus
// `src/styles/tokens.css` (satori kennt keine CSS-Variablen). Alle Texte laufen durch `keepCovered` – so lädt satori
// nie Ersatzschriften oder Emoji-Grafiken aus dem Netz.

export const OG_SIZE = { width: 1200, height: 630 } as const

const PAPER = '#E6EACD'
const PAPER_2 = '#DCE2C2'
const INK = '#1C1A17'
const INK_2 = '#4B463F'
const RULE = 'rgb(15,76,87)' // Petrol-Grau der Zeilenlinien
const STAMP = '#0F4C57' // Petrol (U-12)

const svgUrl = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`

/** Linienpapier (DESIGN §3.4): Zeilenlinien alle 32 px ab einem 56-px-Kopfband, kräftigere Linie unter dem Kopfband. */
function gridSvg(width: number, height: number): string {
  let lines = ''
  for (let y = 56 + 31.5; y < height; y += 32) lines += `M0 ${y}H${width}`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<path d="${lines}" stroke="${RULE}" stroke-opacity="0.12" stroke-width="1"/>` +
    `<path d="M0 55.5H${width}" stroke="${RULE}" stroke-opacity="0.2" stroke-width="1"/></svg>`
  )
}

/** Punkte einer Kette kubischer Bézier-Kurven `[p0, c1, c2, p1, c1, c2, p2, …]`. */
export function bezierPoints(ctrl: readonly Pt[], k = 24): Pt[] {
  const out: Pt[] = [ctrl[0]!]
  for (let i = 0; i + 3 < ctrl.length; i += 3) {
    const [a, b, c, d] = [ctrl[i]!, ctrl[i + 1]!, ctrl[i + 2]!, ctrl[i + 3]!]
    for (let j = 1; j <= k; j++) {
      const t = j / k
      const u = 1 - t
      out.push({
        x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
        y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
      })
    }
  }
  return out
}

/** Tuschelinie als gefülltes SVG (Druck, Zittern, verjüngte Enden – DESIGN §9.3 „Hand“). */
function inkLineSvg(
  width: number,
  height: number,
  ctrl: readonly Pt[],
  seed: number,
  stroke = 5,
): string {
  const d = inkStrokePath(bezierPoints(ctrl), { width: stroke, seed, wobble: 0.7, taper: 26 })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${d}" fill="${INK}"/></svg>`
}

const abs = (left: number, top: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
  position: 'absolute',
  left,
  top,
  display: 'flex',
  ...extra,
})

// --- Produktbild -------------------------------------------------------------------------------------------------

export interface ProductOgProps {
  title: string
  itemNumberText: string
  /** Preis wie auf dem Schild (`formatTagPrice` = `formatMoney(…, { style: 'tag' })`). */
  priceText: string
  /** Kurzhinweis unter dem Schild („Endpreis zzgl. Versand“, DA-6). */
  priceNote: string
  itemNumber: number
  sold: boolean
  soldText: string
  /** JPEG-Data-URL 504 × 630 oder `null` (dann Planet-Marke auf Papier). */
  photo: string | null
  art: { wordmark: string; wordmarkRatio: number; planet: string }
}

export const PRODUCT_TITLE = { fontSize: 52, lineHeight: 60, maxLines: 3, maxWidth: 572 } as const
const PANEL = { left: 504, width: 696, padX: 60 } as const

/** Titelzeilen des Produktbilds (Bricolage 600, höchstens 3 Zeilen, sonst „…“). */
export function productTitleLines(title: string): string[] {
  const text = keepCovered(title, 'bricolage600')
  return wrapLines(text, {
    maxWidth: PRODUCT_TITLE.maxWidth,
    maxLines: PRODUCT_TITLE.maxLines,
    measure: (t) => textWidth(t, 'bricolage600', PRODUCT_TITLE.fontSize),
  })
}

export function ProductOgImage(props: ProductOgProps) {
  const lines = productTitleLines(props.title)
  const price = keepCovered(props.priceText, 'spectral500i')
  const nr = keepCovered(props.itemNumberText, 'bricolage600')
  const note = keepCovered(`* ${props.priceNote}`, 'bricolage600')
  const sold = keepCovered(props.soldText, 'spectral500i')

  // Schild (KO-05, Variante „pinned“ vergrößert): Breite aus dem Preis, Drehung um die Öse nach Nummer.
  const tagH = 164
  const tagW = Math.max(236, Math.round(textWidth(`${price}*`, 'spectral500i', 78) + 80))
  const tagLeft = PANEL.padX + 8
  const tagTop = 56 + Math.max(1, lines.length) * PRODUCT_TITLE.lineHeight + 46
  const angle = tagAngle(props.itemNumber)
  const eyelet = { x: tagLeft + tagW / 2, y: tagTop + 18 }
  const tagSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tagW}" height="${tagH}" viewBox="0 0 ${tagW} ${tagH}">` +
    `<path d="${tagOutlinePath(tagW, tagH, props.itemNumber)}" fill="${PAPER_2}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `<circle cx="${tagW / 2}" cy="18" r="7" fill="${PAPER}" stroke="${INK}" stroke-width="2.5"/></svg>`

  // Wortmarke klein unten rechts; Tuschelinie von der Öse des Schilds zur Wortmarke.
  const wmW = 250
  const wmH = Math.round(wmW / props.art.wordmarkRatio)
  const wmLeft = PANEL.width - PANEL.padX - wmW
  const wmTop = 630 - 44 - wmH
  const end = { x: wmLeft - 14, y: wmTop + wmH * 0.62 }
  // Faden: von der Öse nach oben rechts, rechts am Schild vorbei hinunter und in einem Bogen zur Wortmarke.
  const right = Math.min(tagLeft + tagW + 44, PANEL.width - 40)
  const line = inkLineSvg(
    PANEL.width,
    630,
    [
      eyelet,
      { x: eyelet.x + 20, y: eyelet.y - 62 },
      { x: right, y: eyelet.y - 64 },
      { x: right, y: eyelet.y + 60 },
      { x: right, y: eyelet.y + 170 },
      { x: end.x - 70, y: end.y - 12 },
      end,
    ],
    props.itemNumber,
    4.2,
  )

  const stampW = 232
  const stampH = Math.round((stampW * STAMP_VIEWBOX.h) / STAMP_VIEWBOX.w)
  const stampSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${stampW}" height="${stampH}" viewBox="0 0 ${STAMP_VIEWBOX.w} ${STAMP_VIEWBOX.h}" preserveAspectRatio="none">` +
    stampFramePaths(props.itemNumber)
      .map(
        (d) =>
          `<path d="${d}" fill="none" stroke="${STAMP}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`,
      )
      .join('') +
    '</svg>'

  return (
    <div style={{ display: 'flex', width: 1200, height: 630, backgroundColor: PAPER }}>
      {props.photo ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={props.photo} width={504} height={630} style={{ width: 504, height: 630 }} />
      ) : (
        <div
          style={{
            display: 'flex',
            width: 504,
            height: 630,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: PAPER_2,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={props.art.planet} width={220} height={220} />
        </div>
      )}
      <div style={{ display: 'flex', position: 'relative', width: PANEL.width, height: 630 }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img
          src={svgUrl(gridSvg(PANEL.width, 630))}
          width={PANEL.width}
          height={630}
          style={abs(0, 0)}
        />
        <div
          style={abs(PANEL.padX, 60, {
            flexDirection: 'column',
            width: PRODUCT_TITLE.maxWidth + 8,
          })}
        >
          {lines.map((l, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                fontFamily: 'Bricolage Grotesque',
                fontWeight: 600,
                fontSize: PRODUCT_TITLE.fontSize,
                lineHeight: `${PRODUCT_TITLE.lineHeight}px`,
                color: INK,
                whiteSpace: 'nowrap',
              }}
            >
              {l}
            </div>
          ))}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={svgUrl(line)} width={PANEL.width} height={630} style={abs(0, 0)} />
        <div
          style={abs(tagLeft, tagTop, {
            width: tagW,
            height: tagH,
            transform: `rotate(${angle}deg)`,
            transformOrigin: `${tagW / 2}px 18px`,
            flexDirection: 'column',
            alignItems: 'center',
          })}
        >
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={svgUrl(tagSvg)} width={tagW} height={tagH} style={abs(0, 0)} />
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              marginTop: 32,
              fontFamily: 'Spectral',
              fontStyle: 'italic',
              fontSize: 78,
              lineHeight: '82px',
              color: INK,
            }}
          >
            {price}
            <span style={{ fontSize: 46, lineHeight: '46px', marginLeft: 4 }}>*</span>
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 4,
              fontFamily: 'Bricolage Grotesque',
              fontWeight: 600,
              fontSize: 22,
              letterSpacing: 1,
              color: INK_2,
            }}
          >
            {nr}
          </div>
          {props.sold ? (
            <div
              style={abs((tagW - stampW) / 2 + 18, 84, {
                width: stampW,
                height: stampH,
                alignItems: 'center',
                justifyContent: 'center',
                transform: `rotate(${stampAngle(props.itemNumber) - angle}deg)`,
                opacity: 0.92,
              })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={svgUrl(stampSvg)} width={stampW} height={stampH} style={abs(0, 0)} />
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'Spectral',
                  fontStyle: 'italic',
                  fontSize: 86,
                  lineHeight: '86px',
                  color: STAMP,
                }}
              >
                {sold}
              </div>
            </div>
          ) : null}
        </div>
        <div
          style={abs(tagLeft - 4, tagTop + tagH + (props.sold ? 44 : 28), {
            fontFamily: 'Bricolage Grotesque',
            fontWeight: 600,
            fontSize: 22,
            color: INK_2,
          })}
        >
          {note}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={props.art.wordmark} width={wmW} height={wmH} style={abs(wmLeft, wmTop)} />
      </div>
    </div>
  )
}

// --- Standardbild --------------------------------------------------------------------------------------------------

export interface DefaultOgProps {
  tagline: string
  art: { wordmark: string; wordmarkRatio: number; planet: string; coco: string | null }
}

/** Spitze der Tuschelinie, an der Coco läuft (Anker am Geschirr, Sprite-viewBox 160 × 120). */
const COCO = { tip: { x: 1100, y: 182 }, scale: 1.1, anchor: { x: 90.5, y: 54 } } as const
/** Planet-Marke (Mittelpunkt, Kantenlänge), um die die Linie einen Orbit zieht. */
const PLANET = { x: 940, y: 330, size: 250 } as const

export function DefaultOgImage(props: DefaultOgProps) {
  const tagline = keepCovered(props.tagline, 'bricolage600')
  const wmW = 640
  const wmH = Math.round(wmW / props.art.wordmarkRatio)
  const wm = { left: 88, top: 150 }
  // Bogen von links unten unter Wortmarke und Zeile entlang, Orbit um die Planet-Marke, Spitze oben rechts bei Coco.
  const line = inkLineSvg(
    1200,
    630,
    [
      { x: -20, y: 560 },
      { x: 140, y: 520 },
      { x: 300, y: 470 },
      { x: 470, y: 480 },
      { x: 640, y: 490 },
      { x: 760, y: 560 },
      { x: 860, y: 550 },
      { x: 960, y: 540 },
      { x: 1060, y: 410 },
      { x: 1020, y: 322 },
      { x: 980, y: 236 },
      { x: 860, y: 206 },
      { x: 810, y: 274 },
      { x: 770, y: 330 },
      { x: 830, y: 422 },
      { x: 930, y: 428 },
      { x: 1040, y: 434 },
      { x: 1130, y: 320 },
      COCO.tip,
    ],
    7,
    5.2,
  )
  const cocoW = Math.round(160 * COCO.scale)
  const cocoH = Math.round(120 * COCO.scale)
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: 1200,
        height: 630,
        backgroundColor: PAPER,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={svgUrl(gridSvg(1200, 630))} width={1200} height={630} style={abs(0, 0)} />
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img
        src={props.art.planet}
        width={PLANET.size}
        height={PLANET.size}
        style={abs(PLANET.x - PLANET.size / 2, PLANET.y - PLANET.size / 2)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={svgUrl(line)} width={1200} height={630} style={abs(0, 0)} />
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={props.art.wordmark} width={wmW} height={wmH} style={abs(wm.left, wm.top)} />
      <div
        style={abs(wm.left + 6, wm.top + wmH + 42, {
          fontFamily: 'Bricolage Grotesque',
          fontWeight: 600,
          fontSize: 46,
          color: INK,
        })}
      >
        {tagline}
      </div>
      {props.art.coco ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img
          src={props.art.coco}
          width={cocoW}
          height={cocoH}
          style={abs(
            Math.round(COCO.tip.x - COCO.anchor.x * COCO.scale),
            Math.round(COCO.tip.y - COCO.anchor.y * COCO.scale),
          )}
        />
      ) : null}
    </div>
  )
}
