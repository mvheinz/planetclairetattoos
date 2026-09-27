import 'server-only'

import { APIError } from 'payload'

// Abgelehnter Statuswechsel (KONZEPT §5 Regel 3): deutsche Meldung für die Verwaltung, HTTP 409 (bzw. 403 ohne
// Übergangs-Kennung, DATENMODELL §6.6.8 Nr. 3).
export class TransitionError extends APIError {
  constructor(message: string, status = 409) {
    super(message, status, undefined, true)
    this.name = 'TransitionError'
  }
}
