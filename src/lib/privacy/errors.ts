// Fachlicher Fehler der Datenschutz-Werkzeuge (PLAN P6.16–P6.18) mit HTTP-Status und Meldung für Jutta.
export class PrivacyActionError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'PrivacyActionError'
  }
}
