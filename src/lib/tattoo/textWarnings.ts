// Warnungen beim Speichern der Tattoo-Texte (PLAN P7.9, KONZEPT §9.6, RECHT §5): Formulierungen zu Anzahlungen mit
// Verfall/Nicht-Erstattung (V-24) und Heil- bzw. Gesundheitsversprechen (V-15). Speichern bleibt möglich – die Warnung
// sagt, warum die Stelle heikel ist. Muster wie `tests/helpers/forbiddenPatterns.ts`. Rein (auch im Browser).

export interface TattooTextRule {
  id: 'V-15' | 'V-24'
  re: RegExp
  message: string
}

export const TATTOO_TEXT_RULES: readonly TattooTextRule[] = [
  {
    id: 'V-24',
    re: /Anzahlung.{0,30}(nicht\s+erstatt|verfällt|einbehalten)|non-?refundable/iu,
    message:
      'Bitte keine Regel wie „Anzahlung verfällt“ oder „nicht erstattbar“ auf die Website schreiben – Anzahlungen vereinbarst du persönlich per Mail (Rechtsrisiko).',
  },
  {
    id: 'V-15',
    re: /heilt\s+garantiert|schmerzfrei|allergiefrei|hautfreundlich|medizinisch\s+geprüft/iu,
    message:
      'Bitte keine Heil- oder Gesundheitsversprechen (z. B. „schmerzfrei“, „heilt garantiert“) – das ist irreführende Werbung.',
  },
]

export interface TattooTextWarning {
  id: TattooTextRule['id']
  message: string
  /** Gefundene Stelle (zum Wiederfinden im Text). */
  match: string
}

/** Warnungen für die übergebenen Texte (je Regel höchstens einmal). */
export function tattooTextWarnings(
  texts: readonly (string | null | undefined)[],
): TattooTextWarning[] {
  const out: TattooTextWarning[] = []
  for (const rule of TATTOO_TEXT_RULES) {
    for (const t of texts) {
      const m = typeof t === 'string' ? rule.re.exec(t) : null
      if (m) {
        out.push({ id: rule.id, message: rule.message, match: m[0] })
        break
      }
    }
  }
  return out
}
