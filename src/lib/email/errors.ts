import 'server-only'

// Fehlerarten des Mail-Versands (P4.12/P4.13).

/**
 * Ein Pflicht-Anhang ist noch nicht fertig (Rechnung `pending_pdf`, Rechtstext-PDF fehlt). Der Task `sendEmail` reiht
 * die Mail ohne Fehlversuch mit `waitUntil = jetzt + 1 min` neu ein (höchstens 30×, DATENMODELL §11).
 */
export class AttachmentNotReadyError extends Error {
  constructor(readonly attachment: string) {
    super(`Anhang „${attachment}“ ist noch nicht bereit.`)
    this.name = 'AttachmentNotReadyError'
  }
}
