import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Coco } from '@/components/Coco'
import { Icon } from '@/components/icons/Icon'
import { StaticHtml } from '@/components/StaticHtml'
import { renderResolvedToHtml, resolveServerTree } from '@/lib/react/staticMarkup'

// Nicht hydriertes Server-Markup (P7, Lighthouse-TBT): `StaticHtml` liefert dasselbe HTML wie normales Rendern, nur als
// `dangerouslySetInnerHTML` – React legt dafür im Browser keine Fasern an. Client-Komponenten und eifrige Bilder brechen
// laut ab (statt still falsches HTML zu liefern).

async function AsyncLabel({ text }: { text: string }) {
  await Promise.resolve()
  return <span data-async="">{text}</span>
}

function Item({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a href={href} hrefLang="en">
        {children}
      </a>
    </li>
  )
}

const tree = (
  <ul className="list">
    <Item href="/en">English</Item>
    <Item href="/de/kontakt">
      <AsyncLabel text="Kontakt" />
    </Item>
    <li>
      <Icon name="external" size={16} />
    </li>
  </ul>
)

describe('StaticHtml (TBT P7)', () => {
  it('P7 resolveServerTree löst (auch async) Server-Komponenten zu reinen HTML-Elementen auf', async () => {
    const resolved = await resolveServerTree(tree)
    const html = renderToStaticMarkup(<>{resolved}</>)
    expect(html).toContain('<a href="/en" hrefLang="en">English</a>')
    expect(html).toContain('<span data-async="">Kontakt</span>')
    expect(html).toContain('stroke-width="1.75"')
  })

  it('P7 HTML gleicht normalem Rendern (ohne async-Teil) – Optik und Barrierefreiheit bleiben gleich', async () => {
    const sync = (
      <nav aria-label="Seitenübersicht">
        <Item href="/en">English</Item>
        <Coco pose="kopfschief" size="m" deferSprite />
      </nav>
    )
    const expected = renderToStaticMarkup(sync)
    const el = (await StaticHtml({
      as: 'div',
      className: 'wrap',
      children: sync,
    })) as React.ReactElement<{ dangerouslySetInnerHTML: { __html: string } }>
    expect(el.type).toBe('div')
    expect(el.props.dangerouslySetInnerHTML.__html).toBe(expected)
    expect(renderToStaticMarkup(el)).toBe(`<div class="wrap">${expected}</div>`)
  })

  it('P7 ohne `as` wird das Wurzelelement des Inhalts selbst zum äußeren Element', async () => {
    const el = (await StaticHtml({ children: tree, 'data-x': '' })) as React.ReactElement
    expect(el.type).toBe('ul')
    const html = renderToStaticMarkup(el)
    expect(html.startsWith('<ul class="list" data-x="">')).toBe(true)
    expect(html).toContain('<span data-async="">Kontakt</span>')
    expect(await StaticHtml({ children: null })).toBeNull()
    await expect(StaticHtml({ children: <>text</> })).rejects.toThrow(/genau ein HTML-Element/)
  })

  it('P7 Client-Komponenten und Sonderformen brechen ab', async () => {
    const ClientRef = { $$typeof: Symbol.for('react.client.reference') } as unknown as React.FC
    await expect(resolveServerTree(<ClientRef />)).rejects.toThrow(/Client-Komponente/)
    const Memo = React.memo(() => <b />)
    await expect(resolveServerTree(<Memo />)).rejects.toThrow(/nicht unterstützter Elementtyp/)
  })

  it('P7 eifrige Bilder brechen ab (React würde sie mitten im <body> vorladen), faule sind erlaubt', async () => {
    await expect(renderResolvedToHtml(<img src="/a.svg" alt="" />)).rejects.toThrow(
      /loading="lazy"/,
    )
    expect(await renderResolvedToHtml(<img src="/a.svg" alt="" loading="lazy" />)).toBe(
      '<img src="/a.svg" alt="" loading="lazy"/>',
    )
    expect(await renderResolvedToHtml(<img src="/a.svg" alt="" fetchPriority="low" />)).toBe(
      '<img src="/a.svg" alt="" fetchPriority="low"/>',
    )
  })

  it('P7 vorhandenes dangerouslySetInnerHTML bleibt unverändert', async () => {
    const html = await renderResolvedToHtml(
      <div>
        <span dangerouslySetInnerHTML={{ __html: '<i>x</i>' }} />
      </div>,
    )
    expect(html).toBe('<div><span><i>x</i></span></div>')
  })
})
