import type { Page } from '@playwright/test'

// CSP-Verstöße einer Seite sammeln (ARCHITEKTUR §8.1; genutzt von `security-headers.e2e.spec.ts` und der Suite
// `@privacy`, P3.16: „CSP-Verstöße lassen Tests scheitern“): `securitypolicyviolation`-Ereignisse im Dokument und
// CSP-Fehler auf der Konsole. Vor dem ersten `page.goto` aufrufen.

/** Liefert eine Funktion, die die Verstöße seit dem letzten Aufruf zurückgibt (und leert). */
export async function watchCsp(page: Page): Promise<() => Promise<string[]>> {
  const logged: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content[ -]Security[ -]Policy/i.test(msg.text()))
      logged.push(msg.text())
  })
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] }
    w.__csp = []
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)
    })
  })
  return async () => {
    const events = await page
      .evaluate(() => {
        const w = window as unknown as { __csp?: string[] }
        const out = w.__csp ?? []
        w.__csp = []
        return out
      })
      .catch(() => [] as string[])
    return [...events, ...logged.splice(0)]
  }
}
