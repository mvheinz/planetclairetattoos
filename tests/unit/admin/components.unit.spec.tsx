// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ActionButton, type ActionButtonProps } from '@/admin/components/ActionButton'
import { postAdminAction } from '@/admin/components/adminAction'
import { CopyButton } from '@/admin/components/CopyButton'
import { Notice } from '@/admin/components/Notice'
import { StatusBadge } from '@/admin/components/StatusBadge'

// P5.1 – UI-Bausteine der Verwaltung: ActionButton (Doppeltipp = eine Anfrage, Bestätigung nennt die Folge),
// Notice (aria-live), CopyButton (Clipboard, Rückfall), StatusBadge.

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// jsdom kennt `showModal` nicht vollständig.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute('open')
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('ActionButton (P5.1)', () => {
  it('Doppeltipp löst genau eine Anfrage aus; gesperrt, solange sie läuft', async () => {
    const pending = deferred<Response>()
    const fetchImpl = vi.fn(() => pending.promise)
    render(
      <ActionButton action={() => postAdminAction('/api/x', {}, { fetchImpl })}>
        Gepackt
      </ActionButton>,
    )
    const button = screen.getByRole('button', { name: 'Gepackt' })
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.dblClick(button)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('button')).toHaveProperty('textContent', 'Wird gespeichert …')
    await act(async () => {
      pending.resolve(Response.json({ doc: {}, unchanged: false }))
      await pending.promise
    })
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Erledigt.')
    expect((screen.getByRole('button', { name: 'Gepackt' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
    // Idempotenz-Schlüssel je Klick
    const init = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect((init[1].headers as Record<string, string>)['idempotency-key']).toMatch(/.{8,}/)
  })

  it('Zielzustand schon erreicht → Text „schon erledigt“; Fehler mit Handlungsvorschlag (aria-live)', async () => {
    const { rerender } = render(
      <ActionButton action={async () => ({ unchanged: true })}>Online stellen</ActionButton>,
    )
    await act(async () => fireEvent.click(screen.getByRole('button')))
    expect(screen.getByRole('status').textContent).toBe('Das war schon erledigt – nichts geändert.')

    const fetchImpl = vi.fn(async () =>
      Response.json({ error: 'Stück ist schon verkauft.' }, { status: 409 }),
    )
    rerender(
      <ActionButton key="b" action={() => postAdminAction('/api/y', {}, { fetchImpl })}>
        Online stellen
      </ActionButton>,
    )
    await act(async () => fireEvent.click(screen.getByRole('button')))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Stück ist schon verkauft.')
    expect(alert.textContent).toContain('Bitte lade die Seite neu')
    expect(alert.getAttribute('aria-live')).toBe('assertive')
  })

  it('Aktion mit Wirkung: Dialog nennt die Folge, erst „Ja, weiter“ sendet – auch doppelt nur einmal', async () => {
    const pending = deferred<void>()
    const action = vi.fn(() => pending.promise)
    render(
      <ActionButton
        effects={['mail']}
        confirm={{ title: 'Versendet melden', consequence: 'Die Kundin bekommt eine Versandmail.' }}
        action={action}
      >
        Versendet melden
      </ActionButton>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Versendet melden' }))
    expect(action).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(dialog.textContent).toContain('Die Kundin bekommt eine Versandmail.')
    const ok = screen.getByTestId('confirm-dialog-ok')
    fireEvent.click(ok)
    fireEvent.click(ok)
    expect(action).toHaveBeenCalledTimes(1)
    await act(async () => {
      pending.resolve()
      await pending.promise
    })
    expect(screen.getByRole('status').textContent).toBe('Erledigt.')
  })

  it('Typen erzwingen den Dialog für Aktionen mit Wirkung', () => {
    // @ts-expect-error – `effects` ohne `confirm` ist nicht erlaubt
    const bad: ActionButtonProps = { effects: ['money'], action: async () => {}, children: 'x' }
    expect(bad).toBeTruthy()
  })
})

describe('CopyButton (P5.1)', () => {
  it('kopiert über die Clipboard-API und meldet „Kopiert.“', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    render(<CopyButton text={'Mia Muster\nStraße 1'} label="Adresse kopieren" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Adresse kopieren' })))
    expect(writeText).toHaveBeenCalledWith('Mia Muster\nStraße 1')
    expect(screen.getByRole('status').textContent).toBe('Kopiert.')
  })

  it('Rückfall ohne Clipboard-API: Text markiert + „Jetzt kopieren“', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    const exec = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true })
    render(<CopyButton text="PC-2026-00017" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Kopieren' })))
    const field = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(field.value).toBe('PC-2026-00017')
    expect(document.activeElement).toBe(field)
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt kopieren' }))
    expect(exec).toHaveBeenCalledWith('copy')
    expect(screen.getByRole('status').textContent).toBe('Kopiert.')
  })
})

describe('Notice und StatusBadge (P5.1)', () => {
  it('Notice: Erfolg höflich, Fehler sofort angesagt, Handlungsvorschlag als Link', () => {
    render(
      <>
        <Notice tone="success">Gespeichert.</Notice>
        <Notice tone="error" action={{ href: '/x', label: 'In „Alle Daten“ öffnen' }}>
          Ging nicht.
        </Notice>
      </>,
    )
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive')
    expect(screen.getByRole('link', { name: 'In „Alle Daten“ öffnen' }).getAttribute('href')).toBe(
      '/x',
    )
  })

  it('StatusBadge: Bedeutung steht im Text, Ton als Klasse', () => {
    render(<StatusBadge tone="warning">Vorkasse offen</StatusBadge>)
    const badge = screen.getByText('Vorkasse offen')
    expect(badge.className).toContain('pc-admin-badge--warning')
  })
})
