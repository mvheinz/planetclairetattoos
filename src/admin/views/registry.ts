// Ansichten-Registry der Verwaltung (PLAN P5.1, KONZEPT §7.2): eine Quelle für Pfade, Titel, Phase und Symbol der
// eigenen Handy-Ansichten. Daraus entstehen die Payload-Custom-Views (`adminViewsConfig`, `src/payload.config.ts`), die
// Navigation (Leiste unten, Seitenleiste), die Direktlinks der Verwaltungs-Mails (`ADMIN_MAIL_PATHS`) und die Liste der
// Bildschirmfotos der Vorschau-Datei (`scripts/preview-export/adminViews.ts`). Pfade sind relativ zu `ADMIN_ROUTE`
// (der Pfad selbst steht nie hier, E-93). Rein und ohne Server-Abhängigkeiten – auch im Browser nutzbar.

export type AdminIconName =
  | 'today'
  | 'plus'
  | 'pieces'
  | 'box'
  | 'bank'
  | 'truck'
  | 'store'
  | 'undo'
  | 'mail'
  | 'needle'
  | 'text'
  | 'gear'
  | 'download'
  | 'more'
  | 'data'

export interface AdminViewDef {
  /** Schlüssel (auch Payload-View-Schlüssel und Bildschirmfoto-Schlüssel). */
  key: string
  /** Pfad relativ zu `ADMIN_ROUTE`, beginnt mit `/`; Detailpfade mit `:id`. */
  path: `/${string}`
  /** Titel (Deutsch, Verwaltung nur Deutsch). */
  title: string
  /** Kurzer Titel für die Leiste unten (sonst `title`). */
  short?: string
  /** Phase, ab der die Ansicht fertig ist (bis dahin Platzhalter mit Link zu „Alle Daten“). */
  phase: number
  /** Aufgabe in PLAN.md, die die Ansicht füllt. */
  task: string
  icon: AdminIconName
  /** Quelle in KONZEPT. */
  ref: string
  /** Rückfall in „Alle Daten“ (Standard-Payload), solange die Ansicht Platzhalter ist; `:id` wird ersetzt. */
  allData: `/${string}`
  /** Detailansicht: Schlüssel der Listen-Ansicht (erscheint nicht in der Navigation). */
  parent?: string
}

/** Hauptansichten in der Reihenfolge von KONZEPT §7.2 (Navigation, „Mehr“). */
export const ADMIN_VIEWS = [
  {
    key: 'heute',
    path: '/heute',
    title: 'Heute',
    phase: 5,
    task: 'P5.28',
    icon: 'today',
    ref: 'KONZEPT §7.3',
    allData: '/collections/orders',
  },
  {
    key: 'neues-stueck',
    path: '/neues-stueck',
    title: 'Neues Stück',
    phase: 5,
    task: 'P5.6',
    icon: 'plus',
    ref: 'KONZEPT §7.4',
    allData: '/collections/products/create',
  },
  {
    key: 'stuecke',
    path: '/stuecke',
    title: 'Meine Stücke',
    phase: 5,
    task: 'P5.8',
    icon: 'pieces',
    ref: 'KONZEPT §7.5',
    allData: '/collections/products',
  },
  {
    key: 'packen',
    path: '/packen',
    title: 'Zu packen',
    short: 'Packen',
    phase: 5,
    task: 'P5.10',
    icon: 'box',
    ref: 'KONZEPT §7.6',
    allData: '/collections/orders',
  },
  {
    key: 'vorkasse',
    path: '/vorkasse',
    title: 'Vorkasse offen',
    phase: 5,
    task: 'P5.18',
    icon: 'bank',
    ref: 'KONZEPT §7.7',
    allData: '/collections/orders',
  },
  {
    key: 'versendet',
    path: '/versendet',
    title: 'Versendet',
    phase: 5,
    task: 'P5.16',
    icon: 'truck',
    ref: 'KONZEPT §7.8',
    allData: '/collections/orders',
  },
  {
    key: 'abholung',
    path: '/abholung',
    title: 'Abholung',
    phase: 5,
    task: 'P5.17',
    icon: 'store',
    ref: 'KONZEPT §7.9',
    allData: '/collections/orders',
  },
  {
    key: 'widerrufe',
    path: '/widerrufe',
    title: 'Widerrufe',
    phase: 5,
    task: 'P5.19',
    icon: 'undo',
    ref: 'KONZEPT §7.10',
    allData: '/collections/withdrawals',
  },
  {
    key: 'anfragen',
    path: '/anfragen',
    title: 'Anfragen',
    phase: 5,
    task: 'P5.20',
    icon: 'mail',
    ref: 'KONZEPT §7.11',
    allData: '/collections/inquiries',
  },
  {
    key: 'tattoo',
    path: '/tattoo',
    title: 'Tattoo',
    phase: 7,
    task: 'P7.6',
    icon: 'needle',
    ref: 'KONZEPT §7.12',
    allData: '/collections/flash',
  },
  {
    key: 'texte',
    path: '/texte',
    title: 'Texte',
    phase: 5,
    task: 'P5.27',
    icon: 'text',
    ref: 'KONZEPT §7.13',
    allData: '/collections/legal-texts',
  },
  {
    key: 'einstellungen',
    path: '/einstellungen',
    title: 'Einstellungen',
    phase: 5,
    task: 'P5.21',
    icon: 'gear',
    ref: 'KONZEPT §7.14',
    allData: '/globals/settings',
  },
  {
    key: 'export',
    path: '/export',
    title: 'Export und Datenschutz',
    phase: 5,
    task: 'P5.24',
    icon: 'download',
    ref: 'KONZEPT §7.15',
    allData: '/collections/private-uploads',
  },
] as const satisfies readonly AdminViewDef[]

/** Detailansichten (Direktlinks aus Listen und Verwaltungs-Mails). */
export const ADMIN_DETAIL_VIEWS = [
  {
    key: 'stueck',
    path: '/stuecke/:id',
    title: 'Stück',
    phase: 5,
    task: 'P5.6',
    icon: 'pieces',
    ref: 'KONZEPT §7.4',
    allData: '/collections/products/:id',
    parent: 'stuecke',
  },
  {
    key: 'bestellung',
    path: '/bestellungen/:id',
    title: 'Bestellung',
    phase: 5,
    task: 'P5.9',
    icon: 'box',
    ref: 'KONZEPT §7.6',
    allData: '/collections/orders/:id',
    parent: 'packen',
  },
  {
    key: 'widerruf',
    path: '/widerrufe/:id',
    title: 'Widerruf',
    phase: 5,
    task: 'P5.19',
    icon: 'undo',
    ref: 'KONZEPT §7.10',
    allData: '/collections/withdrawals/:id',
    parent: 'widerrufe',
  },
  {
    key: 'anfrage',
    path: '/anfragen/:id',
    title: 'Anfrage',
    phase: 5,
    task: 'P5.20',
    icon: 'mail',
    ref: 'KONZEPT §7.11',
    allData: '/collections/inquiries/:id',
    parent: 'anfragen',
  },
] as const satisfies readonly AdminViewDef[]

export type AdminViewKey = (typeof ADMIN_VIEWS)[number]['key']
export type AdminDetailViewKey = (typeof ADMIN_DETAIL_VIEWS)[number]['key']

export const ALL_ADMIN_VIEWS: readonly AdminViewDef[] = [...ADMIN_VIEWS, ...ADMIN_DETAIL_VIEWS]

/** Ansicht zum Schlüssel (Haupt- oder Detailansicht). */
export function adminView(key: string): AdminViewDef {
  const view = ALL_ADMIN_VIEWS.find((v) => v.key === key)
  if (!view) throw new Error(`Unbekannte Verwaltungs-Ansicht: ${key}`)
  return view
}

/** Startansicht: `ADMIN_ROUTE` selbst zeigt „Heute“ (Payload-Dashboard ersetzt). */
export const ADMIN_HOME_VIEW: AdminViewKey = 'heute'

/** Leiste unten auf dem Handy: „Heute · Neues Stück · Packen · Mehr“ (KONZEPT §7.2); „Mehr“ öffnet das Menü. */
export const ADMIN_BOTTOM_BAR: readonly AdminViewKey[] = ['heute', 'neues-stueck', 'packen']

/** Beschriftung der Standard-Payload-Ansichten in Navigation und „Mehr“. */
export const ALL_DATA_LABEL = 'Alle Daten'

/** Pfad (relativ zu `ADMIN_ROUTE`) einer Ansicht, `:id` ersetzt. */
export function adminViewPath(key: AdminViewKey): `/${string}`
export function adminViewPath(key: AdminDetailViewKey, id: number | string): `/${string}`
export function adminViewPath(key: string, id?: number | string): `/${string}` {
  return fillId(adminView(key).path, id)
}

/** Rückfall-Pfad in „Alle Daten“ für eine (Platzhalter-)Ansicht. */
export function allDataPath(view: AdminViewDef, id?: number | string): `/${string}` {
  return fillId(view.allData, id)
}

function fillId(path: `/${string}`, id: number | string | undefined): `/${string}` {
  if (!path.includes(':id')) return path
  if (id === undefined || id === '') throw new Error(`Pfad ${path} braucht eine ID.`)
  return path.replace(':id', encodeURIComponent(String(id))) as `/${string}`
}

export interface AdminViewMatch {
  view: AdminViewDef
  id?: string
}

/** Zu den Pfad-Segmenten unterhalb von `ADMIN_ROUTE` passende Ansicht (`[]` = Startansicht „Heute“). */
export function matchAdminView(segments: readonly string[] | undefined): AdminViewMatch | null {
  const parts = (segments ?? []).filter(Boolean)
  if (parts.length === 0) return { view: ALL_ADMIN_VIEWS.find((v) => v.key === ADMIN_HOME_VIEW)! }
  for (const view of ALL_ADMIN_VIEWS) {
    const pattern = view.path.slice(1).split('/')
    if (pattern.length !== parts.length) continue
    let id: string | undefined
    const ok = pattern.every((p, i) => {
      if (p === ':id') {
        id = parts[i]
        return /^[1-9]\d{0,9}$/.test(parts[i]!)
      }
      return p === parts[i]
    })
    if (ok) return id === undefined ? { view } : { view, id }
  }
  return null
}

/** Ist der sichtbare Pfad (unterhalb `ADMIN_ROUTE`) die Ansicht `key` oder eine ihrer Detailansichten? */
export function isActiveView(key: string, relativePath: string): boolean {
  const segments = relativePath.split('/').filter(Boolean)
  const match = matchAdminView(segments)
  if (!match) return false
  return match.view.key === key || match.view.parent === key
}
