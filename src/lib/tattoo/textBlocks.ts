// Tattoo-Texte der Verwaltung (PLAN P7.9, KONZEPT §7.12): welche Blöcke der Seiten `tattoo` und `tattoo_aftercare` das
// Handy-Formular bearbeitet (Felder je Block, Zeilen bei Ablauf/Pflege-Phasen) und in welcher Form die Werte zwischen
// Ansicht, Formular und Endpunkt wandern. Rich-Text-Felder erscheinen als Klartext mit einfacher Auszeichnung
// (`src/lib/richtext/plain.ts`). Andere Blöcke (z. B. FAQ-Liste ohne Überschrift, Bilder) bleiben unverändert und
// sind in „Alle Daten“ bearbeitbar. Rein, ohne Server-Abhängigkeiten.

export const TATTOO_TEXT_PAGE_KEYS = ['tattoo', 'tattoo_aftercare'] as const
export type TattooTextPageKey = (typeof TATTOO_TEXT_PAGE_KEYS)[number]

export type TextKind = 'text' | 'textarea' | 'rich'

export interface BlockFieldDef {
  name: string
  label: string
  kind: TextKind
  required?: boolean
  maxLength?: number
}

export interface BlockDef {
  label: string
  fields: readonly BlockFieldDef[]
  rows?: {
    name: string
    label: string
    fields: readonly BlockFieldDef[]
    min: number
    max: number
  }
}

const HEADING: BlockFieldDef = {
  name: 'heading',
  label: 'Überschrift',
  kind: 'text',
  maxLength: 120,
}

export const TATTOO_TEXT_BLOCKS: Readonly<Record<string, BlockDef>> = {
  richText: {
    label: 'Text',
    fields: [{ name: 'content', label: 'Text', kind: 'rich', required: true }],
  },
  priceInfo: {
    label: 'Preise',
    fields: [HEADING, { name: 'content', label: 'Text', kind: 'rich' }],
  },
  processSteps: {
    label: 'Ablauf',
    fields: [HEADING],
    rows: {
      name: 'steps',
      label: 'Schritt',
      min: 1,
      max: 8,
      fields: [
        { name: 'title', label: 'Titel', kind: 'text', required: true, maxLength: 80 },
        { name: 'text', label: 'Text', kind: 'textarea', required: true, maxLength: 600 },
      ],
    },
  },
  aftercareSteps: {
    label: 'Pflege-Phasen',
    fields: [HEADING],
    rows: {
      name: 'phases',
      label: 'Phase',
      min: 1,
      max: 8,
      fields: [
        { name: 'title', label: 'Titel', kind: 'text', required: true, maxLength: 80 },
        { name: 'content', label: 'Text', kind: 'rich', required: true },
      ],
    },
  },
  callout: {
    label: 'Hinweis',
    fields: [{ name: 'text', label: 'Text', kind: 'textarea', required: true, maxLength: 600 }],
  },
  faqList: { label: 'FAQ-Liste', fields: [HEADING] },
}

/** Seiten: Titel beim ersten Anlegen, Blöcke, die das Formular hinzufügen kann, eigene Block-Beschriftungen. */
export const TATTOO_TEXT_PAGES: Readonly<
  Record<
    TattooTextPageKey,
    {
      label: string
      title: { de: string; en: string }
      addable: readonly string[]
      blockLabels: Readonly<Record<string, string>>
    }
  >
> = {
  tattoo: {
    label: 'Seite „Tattoo“ (Stil, Preise, Ablauf)',
    title: { de: 'Tattoo', en: 'Tattoo' },
    addable: ['richText', 'priceInfo', 'processSteps'],
    blockLabels: { richText: 'Stil' },
  },
  tattoo_aftercare: {
    label: 'Seite „Aftercare“',
    title: { de: 'Aftercare', en: 'Aftercare' },
    addable: ['richText', 'aftercareSteps', 'callout'],
    blockLabels: { richText: 'Einleitung' },
  },
}

export interface LocalizedText {
  de: string
  en: string
}

export interface EditorRow {
  id?: string
  fields: Record<string, LocalizedText>
}

export interface EditorBlock {
  /** Block-ID (neue Blöcke ohne). */
  id?: string
  blockType: string
  /** `false`: Block bleibt unverändert (nur Anzeige). */
  editable: boolean
  fields: Record<string, LocalizedText>
  rows: EditorRow[]
  /** Der Rich Text enthält Formatierung, die das Formular vereinfacht. */
  lossy?: boolean
}

export function blockLabel(page: TattooTextPageKey, blockType: string): string {
  return (
    TATTOO_TEXT_PAGES[page].blockLabels[blockType] ??
    TATTOO_TEXT_BLOCKS[blockType]?.label ??
    blockType
  )
}

const empty = (): LocalizedText => ({ de: '', en: '' })

/** Leerer Block eines Typs (mit der Mindestzahl an Zeilen). */
export function newEditorBlock(blockType: string): EditorBlock {
  const def = TATTOO_TEXT_BLOCKS[blockType]
  if (!def) throw new Error(`Unbekannter Block: ${blockType}`)
  const fields = Object.fromEntries(def.fields.map((f) => [f.name, empty()]))
  const rows = def.rows ? Array.from({ length: def.rows.min }, () => newEditorRow(blockType)) : []
  return { blockType, editable: true, fields, rows }
}

export function newEditorRow(blockType: string): EditorRow {
  const def = TATTOO_TEXT_BLOCKS[blockType]?.rows
  return { fields: Object.fromEntries((def?.fields ?? []).map((f) => [f.name, empty()])) }
}

/** Alle Texte einer Sprache (für Warnungen und „gibt es schon Englisch?“). */
export function editorTexts(blocks: readonly EditorBlock[], locale: 'de' | 'en'): string[] {
  const out: string[] = []
  for (const b of blocks) {
    if (!b.editable) continue
    for (const v of Object.values(b.fields)) out.push(v[locale])
    for (const r of b.rows) for (const v of Object.values(r.fields)) out.push(v[locale])
  }
  return out.filter((t) => t.trim() !== '')
}
