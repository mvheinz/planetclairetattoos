// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { ResponsiveImage } from '@/components/media/ResponsiveImage'

// R04-LCP (ARCHITEKTUR §7.7, P5-Phasenlauf): Das LCP-Foto (`fetchPriority="high"`) wird synchron dekodiert, damit es im
// ersten Frame steht; alle anderen Bilder bleiben `async`. Die Fotos 2…n der Galerie werden während des Schriften-Tors
// nicht gerendert, damit das Nachbarfoto (lazy, aber im Lade-Abstand) nicht vor dem LCP-Foto lädt.

afterEach(cleanup)

const media = {
  alt: 'Schale',
  url: '/media/schale.webp',
  width: 1600,
  height: 2000,
  focalX: 50,
  focalY: 50,
  dominantColor: '#ddccbb',
  sizes: {
    card: { url: '/media/schale-800.webp', width: 800, height: 1000 },
    detail: { url: '/media/schale-1600.webp', width: 1600, height: 2000 },
  },
} as never

const img = (props: Partial<React.ComponentProps<typeof ResponsiveImage>>) =>
  render(
    React.createElement(ResponsiveImage, {
      media,
      aspectRatio: '4 / 5',
      sizes: '100vw',
      srcSizes: ['card', 'detail'],
      ...props,
    }),
  ).container.querySelector('img')!

describe('ResponsiveImage – Dekodieren', () => {
  it('LCP-Foto (fetchPriority high, eager): decoding="sync", ohne lazy', () => {
    const el = img({ loading: 'eager', fetchPriority: 'high' })
    expect(el.getAttribute('decoding')).toBe('sync')
    expect(el.getAttribute('loading')).toBeNull()
  })

  it('alle anderen Bilder: decoding="async"', () => {
    expect(img({}).getAttribute('decoding')).toBe('async')
    expect(img({ loading: 'eager' }).getAttribute('decoding')).toBe('async')
  })

  it('Galerie: Fotos 2…n bleiben während des Schriften-Tors ungerendert', () => {
    const css = readFileSync(
      path.join(process.cwd(), 'src/components/shop/product/ProductGallery.module.css'),
      'utf8',
    )
    expect(css).toMatch(
      /:global\(:root\[data-fonts='wait'\]\) \.slide:not\(:first-child\) img \{\s*display: none;/,
    )
  })
})
