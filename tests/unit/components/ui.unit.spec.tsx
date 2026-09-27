// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import {
  Button,
  Callout,
  Checkbox,
  EmptyState,
  Field,
  PlaceholderBanner,
  Radio,
  RadioGroup,
  Select,
} from '@/components/ui'
import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'

import { readTokens, resolveToken } from '../../helpers/designLint'

// P2.7 Grundbausteine (DESIGN KO-11, KO-12, KO-17, KO-22; R-002). a11y-Prüfung mit axe folgt in P2.22.

const ROOT = path.resolve(import.meta.dirname, '../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

function withIntl(ui: React.ReactNode, locale: 'de' | 'en' = 'de') {
  return (
    <NextIntlClientProvider locale={locale} messages={locale === 'de' ? de : en}>
      {ui}
    </NextIntlClientProvider>
  )
}

afterEach(cleanup)

describe('KO-12 Checkbox/Radio – nie vorbelegte Häkchen', () => {
  it('Checkbox ohne ausdrücklichen Wert ist nicht angehakt (auch im Server-HTML kein checked)', () => {
    const html = renderToStaticMarkup(<Checkbox id="agb" name="agb" label="AGB gelesen" />)
    expect(html).not.toMatch(/checked/)
    render(<Checkbox id="agb" name="agb" label="AGB gelesen" />)
    expect((screen.getByLabelText('AGB gelesen') as HTMLInputElement).checked).toBe(false)
  })

  it('Checkbox mit checked={false} bleibt leer, nur checked={true} hakt an', () => {
    render(
      <>
        <Checkbox id="a" name="a" label="A" checked={false} />
        <Checkbox id="b" name="b" label="B" checked />
      </>,
    )
    expect((screen.getByLabelText('A') as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText('B') as HTMLInputElement).checked).toBe(true)
  })

  it('Radio und RadioGroup ohne Wert wählen nichts vor', () => {
    const html = renderToStaticMarkup(
      <RadioGroup
        id="lieferung"
        name="lieferung"
        legend="Lieferung"
        options={[
          { value: 'shipping', label: 'Versand' },
          { value: 'pickup', label: 'Abholung' },
        ]}
      />,
    )
    expect(html).not.toMatch(/checked/)
    render(<Radio id="r" name="r" value="x" label="X" />)
    expect((screen.getByLabelText('X') as HTMLInputElement).checked).toBe(false)
  })

  it('RadioGroup mit ausdrücklichem Wert wählt genau diese Option', () => {
    render(
      <RadioGroup
        id="g"
        name="g"
        legend="Lieferung"
        value="pickup"
        options={[
          { value: 'shipping', label: 'Versand' },
          { value: 'pickup', label: 'Abholung' },
        ]}
      />,
    )
    expect((screen.getByLabelText('Versand') as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText('Abholung') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByRole('group', { name: 'Lieferung' })).toBeTruthy()
  })

  it('Gegenprobe: das Quellmuster erlaubt kein anderes Vorbelegen', () => {
    const src = read('src/components/ui/Choice.tsx')
    expect(src).toContain('defaultChecked={checked === true ? true : undefined}')
    // Das Eingabeelement bekommt keine durchgereichten Props (kein Weg an `checked === true` vorbei).
    const input = /<input[\s\S]*?\/>/.exec(src)?.[0] ?? ''
    expect(input).not.toMatch(/\{\.\.\./)
    expect(input).not.toMatch(/\schecked=/)
  })
})

describe('KO-12 jedes Feld hat ein verknüpftes Label', () => {
  it('Field, Textarea, Select, Checkbox, Radio sind über ihr Label auffindbar', () => {
    render(
      <form>
        <Field id="name" name="name" label="Name" required autoComplete="name" />
        <Field id="nachricht" name="nachricht" label="Nachricht" multiline />
        <Select
          id="land"
          name="land"
          label="Land"
          emptyOption="Bitte wählen"
          options={[{ value: 'DE', label: 'Deutschland' }]}
        />
        <Checkbox id="ok" name="ok" label="Einverstanden" />
        <Radio id="r1" name="r" value="1" label="Eins" />
      </form>,
    )
    expect(screen.getByLabelText(/Name/).tagName).toBe('INPUT')
    expect(screen.getByLabelText('Nachricht').tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText('Land').tagName).toBe('SELECT')
    expect(screen.getByLabelText('Einverstanden').getAttribute('type')).toBe('checkbox')
    expect(screen.getByLabelText('Eins').getAttribute('type')).toBe('radio')
    // Jedes Eingabeelement hat ein <label for> mit passender id.
    for (const el of document.querySelectorAll('input, select, textarea')) {
      expect(document.querySelector(`label[for="${el.id}"]`), el.id).not.toBeNull()
    }
    expect((screen.getByLabelText('Land') as HTMLSelectElement).value).toBe('')
  })

  it('Hinweis und Fehler hängen per aria-describedby am Feld, Fehler setzt aria-invalid', () => {
    render(
      <Field
        id="email"
        name="email"
        type="email"
        label="E-Mail"
        hint="Für die Bestellbestätigung"
        error="Bitte eine gültige E-Mail-Adresse eingeben."
      />,
    )
    const input = screen.getByLabelText('E-Mail')
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ')
    expect(ids).toEqual(['email-fehler', 'email-hinweis'])
    expect(document.getElementById('email-fehler')?.textContent).toContain('gültige')
    expect(document.getElementById('email-hinweis')?.textContent).toContain('Bestellbestätigung')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    // Fehler nie nur über Farbe: Text + Icon.
    expect(document.querySelector('#email-fehler svg')).not.toBeNull()
  })

  it('ohne Hinweis/Fehler kein aria-describedby und kein aria-invalid', () => {
    render(<Field id="plz" name="plz" label="PLZ" />)
    const input = screen.getByLabelText('PLZ')
    expect(input.hasAttribute('aria-describedby')).toBe(false)
    expect(input.hasAttribute('aria-invalid')).toBe(false)
  })
})

describe('KO-11 Button', () => {
  it('rendert Varianten als <button type="button"> bzw. echten Link', () => {
    render(
      <>
        <Button>In den Korb</Button>
        <Button variant="secondary" href="/de/shop">
          Mehr zeigen
        </Button>
        <Button variant="link" type="submit">
          Entfernen
        </Button>
      </>,
    )
    const primary = screen.getByRole('button', { name: 'In den Korb' })
    expect(primary.getAttribute('type')).toBe('button')
    expect(primary.getAttribute('data-variant')).toBe('primary')
    const secondary = screen.getByRole('link', { name: 'Mehr zeigen' })
    expect(secondary.getAttribute('href')).toBe('/de/shop')
    expect(secondary.hasAttribute('data-underline-host')).toBe(true)
    expect(secondary.querySelector('svg[data-ink-underline]')?.getAttribute('aria-hidden')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: 'Entfernen' }).getAttribute('type')).toBe('submit')
  })

  it('deaktiviert über aria-disabled', () => {
    render(
      <>
        <Button disabled>Zur Kasse</Button>
        <Button href="/de/kasse" disabled>
          Kasse
        </Button>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Zur Kasse' }).getAttribute('aria-disabled')).toBe(
      'true',
    )
    const link = screen.getByRole('link', { name: 'Kasse' })
    expect(link.getAttribute('aria-disabled')).toBe('true')
    expect(link.hasAttribute('href')).toBe(false)
  })

  it('Knöpfe sind ≥ 44 × 44 px (min-height/min-width aller Varianten laut Stylesheet)', () => {
    const tokens = readTokens(read('src/styles/tokens.css'))
    const css = read('src/components/ui/Button.module.css')
    const px = (value: string): number => {
      const v = value.trim()
      const ref = /^var\((--[\w-]+)\)$/.exec(v)
      return Number.parseFloat(ref ? resolveToken(tokens, ref[1]!) : v)
    }
    const block = (selector: string) =>
      new RegExp(`\\n${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''
    const base = block('.button')
    expect(px(/min-height:\s*([^;]+);/.exec(base)![1]!)).toBeGreaterThanOrEqual(48)
    expect(px(/min-width:\s*([^;]+);/.exec(base)![1]!)).toBeGreaterThanOrEqual(44)
    for (const variant of ['.primary', '.link']) {
      const m = /min-height:\s*([^;]+);/.exec(block(variant))
      expect(m, `${variant} min-height`).not.toBeNull()
      expect(px(m![1]!)).toBeGreaterThanOrEqual(44)
    }
    // Checkbox/Radio: Zielfläche 44 px.
    const forms = read('src/components/ui/forms.module.css')
    expect(/\.choiceInput\s*\{[^}]*width:\s*var\(--tap-min\)/.test(forms)).toBe(true)
    expect(/\.choice\s*\{[^}]*min-height:\s*var\(--tap-min\)/.test(forms)).toBe(true)
    expect(px('var(--tap-min)')).toBe(44)
  })
})

describe('R-002 PlaceholderBanner', () => {
  it('R-002 zeigt den Wortlaut DE/EN ohne JavaScript (reines Server-HTML, nicht versteckt)', () => {
    const htmlDe = renderToStaticMarkup(withIntl(<PlaceholderBanner />, 'de'))
    const htmlEn = renderToStaticMarkup(withIntl(<PlaceholderBanner />, 'en'))
    expect(htmlDe).toContain('PLATZHALTER – nicht rechtsverbindlich')
    expect(htmlEn).toContain('PLACEHOLDER – not legally binding')
    for (const html of [htmlDe, htmlEn]) {
      expect(html).not.toMatch(/\shidden(=|\s|>)|display:\s*none|aria-hidden="true"><strong/)
      expect(html).not.toMatch(/<script/)
    }
    const src = read('src/components/ui/PlaceholderBanner.tsx')
    expect(src).not.toMatch(/['"]use client['"]/)
    const css = read('src/components/ui/PlaceholderBanner.module.css')
    expect(css).not.toMatch(
      /display:\s*none|visibility:\s*hidden|opacity:\s*0|animation|transition/,
    )
  })
})

describe('KO-22 Callout und KO-17 EmptyState', () => {
  it('Callout-Varianten: info/warn mit Icon, deviation mit Titel „Bitte beachten:“', () => {
    render(
      withIntl(
        <>
          <Callout>Info-Text</Callout>
          <Callout variant="warn">Warn-Text</Callout>
          <Callout variant="deviation">Kleine Glasurblase am Boden.</Callout>
        </>,
      ),
    )
    const notes = screen.getAllByRole('note')
    expect(notes.map((n) => n.getAttribute('data-callout'))).toEqual(['info', 'warn', 'deviation'])
    expect(notes[0]!.querySelector('svg')).not.toBeNull()
    expect(notes[1]!.querySelector('svg')).not.toBeNull()
    expect(notes[2]!.textContent).toContain('Bitte beachten:')
  })

  it('EmptyState: H2, Erklärung, Weiter-Link als Sekundärknopf, Coco-Platz dekorativ', () => {
    render(
      <EmptyState
        title="Hier ist noch nichts drin."
        text="Stöber doch mal im Shop."
        pose="schnueffeln"
        action={{ href: '/de/shop', label: 'Zum Shop' }}
      />,
    )
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Hier ist noch nichts drin.')
    const link = screen.getByRole('link', { name: 'Zum Shop' })
    expect(link.getAttribute('data-variant')).toBe('secondary')
    const coco = document.querySelector('[data-coco-slot]')
    expect(coco?.getAttribute('aria-hidden')).toBe('true')
    expect(coco?.getAttribute('data-coco-pose')).toBe('schnueffeln')
  })
})
