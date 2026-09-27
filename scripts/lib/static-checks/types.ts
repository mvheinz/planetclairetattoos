// Rahmen für pnpm check:static (ARCHITEKTUR §6.3 Schritt 4). Spätere Phasen registrieren weitere Teilprüfungen.
export interface CheckResult {
  errors: string[]
  warnings: string[]
}

export interface StaticCheck {
  name: string
  run(root: string, now: Date): CheckResult | Promise<CheckResult>
}
