import 'server-only'

// Verwaltungs-Mails A01–A16 (KONZEPT §6.4, P4.15/P5.2). A17 (Passwort-Reset) verschickt Payload selbst:
// `src/lib/email/render.ts` (`renderAdminPasswordReset`).
export * from './alert'
export * from './orders'
export * from './paths'
export * from './records'
export * from './reminders'
