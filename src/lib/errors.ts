// Gemeinsame Fehlerklassen (ARCHITEKTUR §3.1 Regel 1). Reines Modul ohne Laufzeit-Abhängigkeiten.

/** Konfiguration unvollständig oder widersprüchlich (fehlender Schlüssel für einen gewählten echten Treiber). */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}
